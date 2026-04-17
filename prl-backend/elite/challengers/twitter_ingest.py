"""
Fetch tweets for active challengers and store in tweets_challengers table.
Reuses the existing get_tweets_by_user() function from the incumbent pipeline.
"""

import os
import sys
import datetime
import time

import dataset
import requests
import sqlalchemy as sql

# Add the incumbent twitter ingest module to path for reuse
_project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, os.path.join(_project_root, "elite", "twitter", "ingest-tweets"))
from ingestor import get_tweets_by_user, clean_text  # noqa: E402


def get_follower_count(user_id, bearer_token):
    """Fetch the current follower count for a Twitter user."""
    url = f"https://api.twitter.com/2/users/{user_id}"
    headers = {"Authorization": f"Bearer {bearer_token}"}
    params = {"user.fields": "public_metrics"}

    retries = 0
    while retries < 1:
        try:
            response = requests.get(url, headers=headers, params=params)
            if response.status_code == 200:
                data = response.json().get("data", {})
                return data.get("public_metrics", {}).get("followers_count")
            elif response.status_code == 429:
                print(f"Rate limit exceeded, backing off 15s | {response.status_code}")
                time.sleep(15)
            else:
                print(
                    f"  Failed to get follower count for {user_id}: "
                    f"HTTP {response.status_code}"
                )
                retries += 1
                time.sleep(2**retries)
        except Exception as e:
            print(f"  Error fetching follower count for {user_id}: {e}")
            retries += 1

    return None


def run(db_url):
    """Fetch tweets for all active challengers with twitter IDs."""
    bearer_token = os.environ.get("TWITTER_API", "")
    if not bearer_token:
        print("No TWITTER_API token available, aborting")
        return {"new_tweets": 0, "candidates_processed": 0, "api_errors": 0}

    # Get active challengers with twitter IDs, excluding those already
    # collected via the incumbent pipeline (bioguide_id IS NOT NULL means
    # they are a current officeholder whose tweets are already ingested)
    dbx = dataset.connect(db_url + "?charset=utf8mb4")
    challengers = list(
        dbx.query(
            "SELECT * FROM challengers "
            "WHERE active = 1 AND candidate_inactive = 0 "
            "AND twitter_id IS NOT NULL AND bioguide_id IS NULL"
        )
    )
    skipped = list(
        dbx.query(
            "SELECT candidate_id, name FROM challengers "
            "WHERE active = 1 AND twitter_id IS NOT NULL AND bioguide_id IS NOT NULL"
        )
    )
    if skipped:
        print(
            f"Skipping {len(skipped)} existing officeholders "
            f"(tweets already collected via incumbent pipeline)"
        )
    print(
        f"Start: {len(challengers)} challengers to ingest, "
        f"{dbx['tweets_challengers'].count()} existing tweets"
    )
    dbx.engine.dispose()
    dbx.close()

    new_tweets = 0
    candidates_processed = 0
    api_errors = 0
    seen_twitter_ids = set()  # dedup: skip if same twitter_id already processed
    total_candidates = len(challengers)
    last_progress_time = time.time()
    progress_interval = 180  # Log progress every 3 minutes

    for challenger in challengers:
        candidate_id = challenger["candidate_id"]
        name = challenger["name"]

        # Skip if we already ingested tweets for this twitter_id
        # (e.g. same person running for multiple offices)
        tid_key = str(challenger["twitter_id"]).strip()
        if tid_key in seen_twitter_ids:
            continue
        seen_twitter_ids.add(tid_key)

        try:
            # Get the most recent tweet date for this candidate
            start_date = datetime.date(2025, 10, 1)
            dbx = dataset.connect(db_url + "?charset=utf8mb4")
            max_date = (
                sql.select([sql.func.max(dbx["tweets_challengers"].table.c.date)])
                .where(dbx["tweets_challengers"].table.c.candidate_id == candidate_id)
                .execute()
                .first()[0]
            )
            dbx.engine.dispose()
            dbx.close()

            if max_date:
                start_date = max_date

            end_date = (datetime.datetime.now() - datetime.timedelta(days=1)).date()

            if start_date >= end_date:
                continue

            twitter_ids = str(challenger["twitter_id"]).split(",")

            start_datetime = datetime.datetime.combine(
                start_date, datetime.datetime.min.time()
            )
            end_datetime = datetime.datetime.combine(
                end_date, datetime.datetime.max.time()
            )

            entries = []
            for twitter_id in twitter_ids:
                twitter_id = twitter_id.strip()
                if not twitter_id:
                    continue

                tweets = get_tweets_by_user(
                    twitter_id, start_datetime, end_datetime, bearer_token
                )

                for tweet in tweets:
                    entries.append(
                        {
                            "date": datetime.datetime.strptime(
                                tweet["created_at"], "%Y-%m-%dT%H:%M:%S.%fZ"
                            ).date(),
                            "candidate_id": candidate_id,
                            "text": clean_text(tweet["text"]),
                            "tweet_id": tweet["id"],
                            "created_at": datetime.datetime.strptime(
                                tweet["created_at"], "%Y-%m-%dT%H:%M:%S.%fZ"
                            ),
                            "public_metrics": tweet["public_metrics"],
                            "media": tweet.get("attachments"),
                            "twitter_id": twitter_id,
                            "media_urls": (
                                tweet.get("media_urls")
                                if tweet.get("media_urls")
                                else None
                            ),
                            "follower_count": None,
                        }
                    )

            if entries:
                dbx = dataset.connect(db_url + "?charset=utf8mb4")
                dbx["tweets_challengers"].upsert_many(entries, ["tweet_id"])
                dbx.engine.dispose()
                dbx.close()
                new_tweets += len(entries)

            candidates_processed += 1

        except Exception as e:
            print(f"  Error processing {name} ({candidate_id}): {e}")
            api_errors += 1

        # Log progress every 3 minutes
        now = time.time()
        if now - last_progress_time >= progress_interval:
            dbx = dataset.connect(db_url + "?charset=utf8mb4")
            total_tweets = dbx["tweets_challengers"].count()
            dbx.engine.dispose()
            dbx.close()
            print(
                f"PROGRESS: {candidates_processed}/{total_candidates} candidates, "
                f"{new_tweets} new tweets this run, {total_tweets} total tweets, "
                f"{api_errors} errors"
            )
            last_progress_time = now

    # Print final counts
    dbx = dataset.connect(db_url + "?charset=utf8mb4")
    print(f"End: {dbx['tweets_challengers'].count()} total tweets")
    dbx.engine.dispose()
    dbx.close()

    return {
        "new_tweets": new_tweets,
        "candidates_processed": candidates_processed,
        "api_errors": api_errors,
    }
