"""
Lambda function to fetch Google Scholar citation data and update S3.
Triggered daily by CloudWatch Events.
"""

import json
import os
import boto3
from datetime import datetime
import requests
from bs4 import BeautifulSoup
import time
import random

S3_BUCKET = os.environ["S3_BUCKET"]
SCHOLAR_USER_ID = os.environ.get("SCHOLAR_USER_ID", "AFD0pYEAAAAJ")


def get_scholar_stats(user_id):
    """
    Scrape Google Scholar profile for citation stats.
    Returns dict with citations and h_index.
    """
    url = f"https://scholar.google.com/citations?user={user_id}&hl=en"

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Connection": "keep-alive",
    }

    # Add random delay to be respectful
    time.sleep(random.uniform(1, 3))

    response = requests.get(url, headers=headers, timeout=30)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")

    # Find the citation stats table
    stats = {}

    # Look for the stats in the gsc_rsb_st table
    table = soup.find("table", {"id": "gsc_rsb_st"})
    if table:
        rows = table.find_all("tr")
        for row in rows:
            cells = row.find_all("td")
            if len(cells) >= 2:
                label = cells[0].get_text(strip=True).lower()
                value = cells[1].get_text(strip=True)

                if "citations" in label:
                    # Get "All" citations (first value)
                    stats["citations"] = int(value.replace(",", ""))
                elif "h-index" in label:
                    stats["h_index"] = int(value)
                elif "i10-index" in label:
                    stats["i10_index"] = int(value)

    # Fallback: try to find stats in other locations
    if "citations" not in stats:
        # Try finding in gsc_rsb_std class
        citation_elements = soup.find_all("td", {"class": "gsc_rsb_std"})
        if len(citation_elements) >= 3:
            try:
                stats["citations"] = int(
                    citation_elements[0].get_text(strip=True).replace(",", "")
                )
                stats["h_index"] = int(citation_elements[2].get_text(strip=True))
                if len(citation_elements) >= 5:
                    stats["i10_index"] = int(citation_elements[4].get_text(strip=True))
            except (ValueError, IndexError):
                pass

    return stats


def update_profile_json(stats):
    """
    Update the westwood-publications.json file in S3 with new citation stats.
    """
    s3 = boto3.client("s3")

    # Download current profile data
    try:
        response = s3.get_object(
            Bucket=S3_BUCKET, Key="data/westwood-publications.json"
        )
        profile_data = json.loads(response["Body"].read().decode("utf-8"))
    except Exception as e:
        print(f"Error fetching profile data: {e}")
        raise

    # Update citation stats
    if "profile" in profile_data:
        profile_data["profile"]["googleCitations"] = stats.get("citations")
        profile_data["profile"]["hIndex"] = stats.get("h_index")
        profile_data["profile"]["citationsLastUpdated"] = datetime.utcnow().isoformat()

    # Upload updated profile data
    s3.put_object(
        Bucket=S3_BUCKET,
        Key="data/westwood-publications.json",
        Body=json.dumps(profile_data, indent=2),
        ContentType="application/json",
        CacheControl="max-age=3600",
    )

    return profile_data["profile"]


def handler(event, context):
    """
    Lambda handler function.
    Triggered by CloudWatch Events (daily) or can be invoked manually.
    """
    print(f"Starting Google Scholar stats fetch at {datetime.utcnow().isoformat()}")
    print(f"Scholar User ID: {SCHOLAR_USER_ID}")

    try:
        # Fetch stats from Google Scholar
        stats = get_scholar_stats(SCHOLAR_USER_ID)
        print(f"Fetched stats: {stats}")

        if not stats.get("citations"):
            return {
                "statusCode": 500,
                "body": json.dumps(
                    {
                        "error": "Could not fetch citation data",
                        "timestamp": datetime.utcnow().isoformat(),
                    }
                ),
            }

        # Update S3
        update_profile_json(stats)
        print("Updated profile in S3")

        return {
            "statusCode": 200,
            "body": json.dumps(
                {
                    "message": "Successfully updated citation stats",
                    "stats": stats,
                    "timestamp": datetime.utcnow().isoformat(),
                }
            ),
        }

    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            "statusCode": 500,
            "body": json.dumps(
                {"error": str(e), "timestamp": datetime.utcnow().isoformat()}
            ),
        }


# For local testing
if __name__ == "__main__":
    result = handler({}, None)
    print(json.dumps(json.loads(result["body"]), indent=2))
