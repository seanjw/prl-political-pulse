import os
import io
import csv
import json
import urllib.parse
from datetime import datetime, date

import boto3
from botocore.exceptions import ClientError
from flask import Response

from .database import DatabaseManager
from .search_phrase_logic import build_search_logic_sql

# ------------------------------------------------------------------------------
# Env & DB init (kept here so routes stay "thin")
# ------------------------------------------------------------------------------


def get_db_credentials():
    """Get database credentials from AWS Secrets Manager or fall back to env vars."""
    secret_name = "legislator-search/db-credentials"

    try:
        client = boto3.client("secretsmanager", region_name="us-east-1")
        response = client.get_secret_value(SecretId=secret_name)
        secrets = json.loads(response["SecretString"])
        return {
            "dialect": os.environ.get("DB_DIALECT", "mysql+pymysql"),
            "user": secrets["DB_USER"],
            "password": secrets["DB_PASSWORD"],
            "host": secrets["DB_HOST"],
            "port": secrets.get("DB_PORT", "3306"),
            "name": secrets.get("DB_NAME", "elite"),
        }
    except ClientError:
        # Fall back to environment variables
        return {
            "dialect": os.environ["DB_DIALECT"],
            "user": os.environ["DB_USER"],
            "password": os.environ["DB_PASSWORD"],
            "host": os.environ["DB_HOST"],
            "port": os.environ.get("DB_PORT", "3306"),
            "name": os.environ.get("DB_NAME", "elite"),
        }


_creds = get_db_credentials()
DB_STRING = (
    f"{_creds['dialect']}://"
    f"{_creds['user']}:{urllib.parse.quote(_creds['password'])}"
    f"@{_creds['host']}:{_creds['port']}/{_creds['name']}"
)

database_manager = DatabaseManager(DB_STRING)

# ------------------------------------------------------------------------------
# Constants
# ------------------------------------------------------------------------------

PAGE_SIZE = 100
PAGE_SIZE_MAX = 1000
EXPORT_LIMIT = 50_000

CLASS_FIELDS = [
    "source",
    "bioguide_id",
    "policy",
    "attack_personal",
    "attack_policy",
    "outcome_bipartisanship",
    "outcome_creditclaiming",
    "extreme_label",
    "party",
    "state",
    "name",
    "gender",
    "type",
    "district",
    "active",
    "level",
]

DISALLOWED_PARTIES_PR = (
    "Partido Nuevo Progresista",
    "Partido Popular Democrático",
    "Partido Independentista Puertorriqueño",
    "Movimiento Victoria Ciudadana",
    "Proyecto Dignidad",
)

PARTY_DEM_ALIASES = (
    "Democrat",
    "Democratic-Farmer-Labor",
    "Democratic/Independence/Working Families",
    "Democratic/Progressive",
    "Democratic/Working Families",
)

PARTY_GOP_ALIASES = (
    "Republican",
    "Republican/Conservative",
    "Republican/Conservative/Independence",
    "Republican/Conservative/Independence/Ref",
)

PARTY_IND_ALIASES = ("Independent", "Nonpartisan")

PREDEFINED_PARTY_ORDER = ["Democrat", "Republican", "Independent"]

SORT_MAP = {
    "date-asc": "date ASC",
    "date-desc": "date DESC",
    "alpha-asc": "last_name ASC",
    "alpha-desc": "last_name DESC",
    "speaker-freq": "freq DESC, last_name ASC",
}

SQL_PARTY_GROUP_CASE = """
CASE
    WHEN party IN ({dem}) THEN 'Democrat'
    WHEN party IN ({gop}) THEN 'Republican'
    WHEN party IN ({ind}) THEN 'Independent'
    ELSE NULL
END
""".format(
    dem=",".join(["%s"] * len(PARTY_DEM_ALIASES)),
    gop=",".join(["%s"] * len(PARTY_GOP_ALIASES)),
    ind=",".join(["%s"] * len(PARTY_IND_ALIASES)),
).strip()

# Tweets posted after this date will have their text replaced in exports
TWEET_TEXT_CUTOFF_DATE = date(2020, 1, 1)

TWEET_UNAVAILABLE_MESSAGE_TEMPLATE = (
    "Tweets after [DATE] are unavailable due to Twitter API access restrictions introduced at that time. "
    "Use the tweet_id to find the source."
)

TWEET_SOURCES = {"tweets", "tweets_state"}

# ------------------------------------------------------------------------------
# Helpers & building blocks
# ------------------------------------------------------------------------------


def clamp_page(page_raw, page_size=PAGE_SIZE):
    try:
        page_number = int(page_raw or 1)
    except Exception:
        page_number = 1

    page_number = max(page_number, 1)
    safe_page_size = min(page_size, PAGE_SIZE_MAX)

    return safe_page_size, (page_number - 1) * safe_page_size


def parse_date_safe(raw_value):
    if not raw_value:
        return None
    try:
        return datetime.strptime(raw_value, "%Y-%m-%d").strftime("%Y-%m-%d")
    except ValueError:
        return None


def party_case_params():
    return list(PARTY_DEM_ALIASES) + list(PARTY_GOP_ALIASES) + list(PARTY_IND_ALIASES)


def order_by_for(sort_mode):
    return SORT_MAP.get(sort_mode, SORT_MAP["date-desc"])


def extract_filters(form_data):
    conditions, values = [], []

    PARTY_GROUPS = {
        "Democrat": PARTY_DEM_ALIASES,
        "Republican": PARTY_GOP_ALIASES,
        "Independent": PARTY_IND_ALIASES,
    }

    for field in CLASS_FIELDS:
        field_value = form_data.get(field)
        if not field_value:
            continue

        if field == "extreme_label":
            if field_value == "no":
                conditions.append("(extreme_label IS NULL OR extreme_label = 'no')")
            else:
                conditions.append("(extreme_label = %s)")
                values.append(field_value)

        elif field == "source" and field_value == "tweets":
            conditions.append("(source = %s OR source = %s)")
            values.extend(["tweets", "tweets_state"])

        elif field == "party":
            aliases = PARTY_GROUPS.get(field_value)

            if aliases:
                placeholders = ", ".join(["%s"] * len(aliases))
                conditions.append(f"(party IN ({placeholders}))")
                values.extend(list(aliases))
            else:
                conditions.append("(party = %s)")
                values.append(field_value)

        else:
            conditions.append(f"({field} = %s)")
            values.append(field_value)

    return conditions, values


def build_where_clause(condition_list, search_value, start_date_value, end_date_value):
    where_conditions = list(condition_list)
    param_values = []
    highlight_terms = []

    if search_value:
        match_sql, match_params, highlight_terms = build_search_logic_sql(
            search_value, "text"
        )
        if match_sql:
            where_conditions.append(match_sql)
            param_values.extend(match_params)

    normalized_start_date = parse_date_safe(start_date_value)
    normalized_end_date = parse_date_safe(end_date_value)

    if normalized_start_date:
        where_conditions.append("(date >= %s)")
        param_values.append(normalized_start_date)
    if normalized_end_date:
        where_conditions.append("(date <= %s)")
        param_values.append(normalized_end_date)

    return (
        " AND ".join(where_conditions) if where_conditions else "TRUE",
        param_values,
        highlight_terms,
    )


def query_classifications(where_sql, params, page=1, sort_mode="date-desc"):
    page_limit, page_offset = clamp_page(page)
    limit_plus_one = page_limit + 1

    order_by_clause = order_by_for(sort_mode)
    extra_select = ""
    extra_join = ""
    final_params = list(params)

    if sort_mode == "speaker-freq":
        extra_select = ", freq_table.freq"
        extra_join = f"""
            JOIN (
                SELECT bioguide_id, COUNT(*) AS freq
                FROM mat_classification_legislator
                WHERE {where_sql} AND text IS NOT NULL AND text != ''
                GROUP BY bioguide_id
            ) AS freq_table
            ON freq_table.bioguide_id = mat_classification_legislator.bioguide_id
        """
        final_params = list(params) + list(params)

    sql = f"""
        SELECT *
        {extra_select}
        FROM mat_classification_legislator
        {extra_join}
        WHERE {where_sql} AND text IS NOT NULL AND text != ''
        ORDER BY {order_by_clause}
        LIMIT {limit_plus_one} OFFSET {page_offset}
    """

    query_results = database_manager.query(sql, final_params)

    for index, row in enumerate(query_results):
        row["result_index"] = page_offset + index + 1

    has_more_results = len(query_results) > page_limit

    return (
        query_results[:page_limit] if has_more_results else query_results
    ), has_more_results


def count_query(base_sql, params, distinct=False):
    count_select = (
        "COUNT(DISTINCT COALESCE(bioguide_id, openstates_id))"
        if distinct
        else "COUNT(*)"
    )
    sql = f"SELECT {count_select} FROM mat_classification_legislator WHERE {base_sql}"

    return database_manager.query_scalar(sql, params)


# ------------------------------------------------------------------------------
# Export Functions
# ------------------------------------------------------------------------------


def _generate_csv_stream(base_sql, all_params, fieldnames):
    """Generate CSV data in streaming chunks"""
    try:
        # Create CSV writer that writes to a string buffer
        csv_buffer = io.StringIO()
        writer = csv.DictWriter(csv_buffer, fieldnames=fieldnames)
        writer.writeheader()

        # Yield the header first
        csv_buffer.seek(0)
        yield csv_buffer.getvalue()
        csv_buffer.seek(0)
        csv_buffer.truncate(0)

        # Process data in streaming chunks
        chunk_size = 4000  # Larger chunks for better performance
        offset = 0

        while True:
            # Get next chunk from database
            chunk_sql = f"{base_sql} LIMIT {chunk_size} OFFSET {offset}"

            chunk_rows = database_manager.query(chunk_sql, all_params)

            if not chunk_rows:
                break

            # Apply tweet text replacement to this chunk
            apply_tweet_cutoff_text_replacement(chunk_rows)

            # Write chunk to CSV
            for row in chunk_rows:
                # Convert row to dict if needed
                if hasattr(row, "_asdict"):
                    row_dict = row._asdict()
                elif isinstance(row, dict):
                    row_dict = row
                else:
                    row_dict = dict(row)

                writer.writerow(row_dict)

            # Yield this chunk
            csv_buffer.seek(0)
            chunk_data = csv_buffer.getvalue()
            csv_buffer.seek(0)
            csv_buffer.truncate(0)

            yield chunk_data
            offset += chunk_size

    except Exception:
        raise


def export_csv_streaming(base_sql, all_params, fieldnames):
    """Stream CSV export directly to response without loading all data into memory"""
    return Response(
        _generate_csv_stream(base_sql, all_params, fieldnames),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=export.csv"},
    )


def export_csv(rows):
    """Legacy CSV export for small datasets"""
    csv_buffer = io.StringIO()

    if not rows:
        return Response("", mimetype="text/csv")

    try:
        # Memory-efficient CSV generation
        fieldnames = list(rows[0].keys())

        writer = csv.DictWriter(csv_buffer, fieldnames=fieldnames)
        writer.writeheader()

        # Process rows in chunks to avoid memory issues
        chunk_size = 1000
        for chunk_start in range(0, len(rows), chunk_size):
            chunk = rows[chunk_start : chunk_start + chunk_size]
            writer.writerows(chunk)

        csv_buffer.seek(0)
        csv_content = csv_buffer.read()

        return Response(
            csv_content,
            mimetype="text/csv",
            headers={"Content-Disposition": "attachment; filename=export.csv"},
        )
    except Exception:
        raise


def _generate_json_stream(base_sql, all_params):
    """Generate JSON data in streaming chunks"""
    try:
        import json

        # Start JSON array
        yield "["

        # Process data in streaming chunks
        chunk_size = 2000  # Larger chunks for better performance
        offset = 0
        first_chunk = True

        while True:
            # Get next chunk from database
            chunk_sql = f"{base_sql} LIMIT {chunk_size} OFFSET {offset}"

            chunk_rows = database_manager.query(chunk_sql, all_params)

            if not chunk_rows:
                break

            # Apply tweet text replacement to this chunk
            apply_tweet_cutoff_text_replacement(chunk_rows)

            # Convert chunk to JSON
            for row_index, row in enumerate(chunk_rows):
                # Convert row to dict if needed
                if hasattr(row, "_asdict"):
                    row_dict = row._asdict()
                elif isinstance(row, dict):
                    row_dict = row
                else:
                    row_dict = dict(row)

                # Add comma separator (except for first item)
                if not first_chunk or row_index > 0:
                    yield ","

                # Yield JSON for this row
                yield json.dumps(row_dict, default=str)

                if first_chunk and row_index == 0:
                    first_chunk = False

            offset += chunk_size

        # End JSON array
        yield "]"

    except Exception:
        raise


def export_json_streaming(base_sql, all_params):
    """Stream JSON export directly to response without loading all data into memory"""
    return Response(
        _generate_json_stream(base_sql, all_params),
        mimetype="application/json",
        headers={"Content-Disposition": "attachment; filename=export.json"},
    )


def export_json(rows):
    """Legacy JSON export for small datasets"""
    if not rows:
        return []

    try:
        # Memory optimization: convert to list of dicts more efficiently
        result = []
        chunk_size = 1000

        for chunk_start in range(0, len(rows), chunk_size):
            chunk = rows[chunk_start : chunk_start + chunk_size]
            # Convert each row to a dict to ensure JSON serialization works
            for row in chunk:
                if hasattr(row, "_asdict"):  # SQLAlchemy Row object
                    result.append(row._asdict())
                elif isinstance(row, dict):  # Already a dict
                    result.append(row)
                else:  # Convert to dict
                    result.append(dict(row))

        return result

    except Exception:
        raise


# ------------------------------------------------------------------------------
# Tweet cutoff helpers
# ------------------------------------------------------------------------------


def coerce_to_date(value):
    if value is None:
        return None
    if isinstance(value, date):
        return value
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, str):
        try:
            return datetime.strptime(value[:10], "%Y-%m-%d").date()
        except ValueError:
            return None
    return None


def apply_tweet_cutoff_text_replacement(rows):
    if not rows:
        return rows

    message = TWEET_UNAVAILABLE_MESSAGE_TEMPLATE.replace(
        "[DATE]", TWEET_TEXT_CUTOFF_DATE.strftime("%Y-%m-%d")
    )

    for row in rows:
        try:
            source = (row.get("source") or "").strip().lower()
            if source in TWEET_SOURCES:
                row_date = coerce_to_date(row.get("date"))
                if row_date and row_date > TWEET_TEXT_CUTOFF_DATE and "text" in row:
                    row["text"] = message
        except Exception:
            # Do not let a single bad row break export
            continue

    return rows


# ------------------------------------------------------------------------------
# Service functions (called by routes)
# ------------------------------------------------------------------------------


def service_autocomplete_data():
    names_rows = database_manager.query("SELECT * FROM DistinctLegislatorNames")
    twitter_rows = database_manager.query(
        "SELECT * FROM DistinctLegislatorTwitterHandles"
    )
    district_rows = database_manager.query("SELECT * FROM DistinctLegislatorDistricts")

    return {
        "full_names": list({row["name"] for row in names_rows if row.get("name")}),
        "twitter_handles": list(
            {row["twitter_handle"] for row in twitter_rows if row.get("twitter_handle")}
        ),
        "districts": list(
            {row["district"] for row in district_rows if row.get("district")}
        ),
    }


def service_export_results(form_data):
    try:
        condition_clauses, condition_values = extract_filters(form_data)
        search_text = form_data.get("search", "").strip()
        sort_mode = form_data.get("sort_mode", "date-desc")
        range_type = form_data.get("range", "all")
        export_format = form_data.get("format", "json")
    except Exception as exception:
        return {"error": f"Parameter parsing failed: {str(exception)}"}, 500

    if range_type == "selected":
        import json

        selected_ids_raw = form_data.get("selected_ids", "[]")

        try:
            selected_ids = json.loads(selected_ids_raw)
        except json.JSONDecodeError as json_error:
            return {"error": f"Invalid selected_ids JSON: {str(json_error)}"}, 400

        if not selected_ids:
            return {"error": "No selected results provided"}, 400

        if len(selected_ids) > EXPORT_LIMIT:
            return {
                "error": f"Export limited to {EXPORT_LIMIT:,} results. "
                "Download the full dataset at https://polarizationresearchlab.org/data#section=elites"
            }, 400

        id_placeholders = ", ".join(["%s"] * len(selected_ids))

        base_sql = f"""
            SELECT *
            FROM mat_classification_legislator
            WHERE classification_id IN ({id_placeholders})
              AND text IS NOT NULL AND text != ''
            ORDER BY FIELD(classification_id, {id_placeholders})
        """

        all_params = list(selected_ids) + list(selected_ids)
    else:
        where_sql, search_param_values, _ = build_where_clause(
            condition_clauses,
            search_text,
            form_data.get("start_date"),
            form_data.get("end_date"),
        )

        all_params = condition_values + search_param_values
        start_index_value = int(form_data.get("start_index", 1))
        end_index_value = int(form_data.get("end_index", start_index_value))
        result_limit = 200 if range_type == "first" else None
        result_offset = (
            0 if range_type in ("first", "all") else max(start_index_value - 1, 0)
        )

        if range_type == "custom":
            result_limit = max(end_index_value - start_index_value + 1, 0)

        base_sql = f"""
            SELECT *
            FROM mat_classification_legislator
            WHERE {where_sql} AND text IS NOT NULL AND text != ''
            ORDER BY {order_by_for(sort_mode)}
        """
        if result_limit is not None:
            base_sql += f" LIMIT {result_limit} OFFSET {result_offset}"

        # Enforce export limit
        effective_limit = result_limit if result_limit is not None else None
        if effective_limit is None or effective_limit > EXPORT_LIMIT:
            # For "all" range or large custom ranges, check actual count
            count_sql = (
                f"SELECT COUNT(*) FROM mat_classification_legislator "
                f"WHERE {where_sql} AND text IS NOT NULL AND text != ''"
            )
            row_count = database_manager.query_scalar(count_sql, all_params)
            if row_count > EXPORT_LIMIT:
                return {
                    "error": f"Export limited to {EXPORT_LIMIT:,} results. "
                    f"Your query matches {row_count:,} results. "
                    "Download the full dataset at https://polarizationresearchlab.org/data#section=elites"
                }, 400

    try:
        rows = database_manager.query(base_sql, all_params)

        # Only stream for "all" range (no LIMIT in base_sql).
        # Other ranges already have LIMIT, so appending another would cause a syntax error.
        use_streaming = range_type == "all"

        if use_streaming:
            # Get fieldnames from first row for streaming
            if rows:
                fieldnames = list(rows[0].keys())
            else:
                # For empty results, we need to get fieldnames from a sample query
                sample_sql = f"{base_sql} LIMIT 1"
                sample_rows = database_manager.query(sample_sql, all_params)
                fieldnames = list(sample_rows[0].keys()) if sample_rows else []

            if export_format == "csv":
                result = export_csv_streaming(base_sql, all_params, fieldnames)
                return result
            else:
                result = export_json_streaming(base_sql, all_params)
                return result
        else:
            apply_tweet_cutoff_text_replacement(rows)

            if export_format == "csv":
                result = export_csv(rows)
                return result

            result = export_json(rows)
            return result
    except Exception as exception:
        # Check if it's a memory-related error
        if (
            "memory" in str(exception).lower()
            or "out of memory" in str(exception).lower()
        ):
            return {
                "error": "Export failed due to memory limitations. Try exporting a smaller range or contact support."
            }, 500

        return {"error": f"Export processing failed: {str(exception)}"}, 500


def query_monthly_counts_by_party_predefined(
    where_sql_no_date, filter_parameters, start_month="2017-07-01", end_month=None
):
    today_value = date.today()
    if end_month is None:
        end_month = date(today_value.year, today_value.month, 1).strftime("%Y-%m-%d")
    case_params_values = party_case_params()
    exclusion_placeholders = ",".join(["%s"] * len(DISALLOWED_PARTIES_PR))

    # Simplified query - just group by month and party, fill gaps in Python
    sql = f"""
        SELECT DATE_FORMAT(date, '%%Y-%%m-01') AS month_start,
               {SQL_PARTY_GROUP_CASE} AS party_group,
               COUNT(*) AS hits
        FROM mat_classification_legislator
        WHERE {where_sql_no_date}
          AND text IS NOT NULL AND text != ''
          AND date IS NOT NULL
          AND date >= %s
          AND date <= %s
          AND party IS NOT NULL AND party <> ''
          AND party NOT IN ({exclusion_placeholders})
        GROUP BY 1, 2
        HAVING party_group IS NOT NULL
        ORDER BY month_start, party_group
    """

    sql_params = []
    sql_params += case_params_values
    sql_params += list(filter_parameters)
    sql_params += [start_month, end_month]
    sql_params += list(DISALLOWED_PARTIES_PR)

    histogram_rows = database_manager.query(sql, sql_params)

    month_labels = []
    month_index = {}
    parties_seen = set()

    for record in histogram_rows:
        month_value = record["month_start"]
        month_key = (
            month_value.strftime("%Y-%m")
            if hasattr(month_value, "strftime")
            else str(month_value)[:7]
        )

        if month_key not in month_index:
            month_index[month_key] = len(month_labels)
            month_labels.append(month_key)
        if record["party_group"]:
            parties_seen.add(record["party_group"])

    total_months = len(month_labels)
    series_by_party = {party_name: [0] * total_months for party_name in parties_seen}

    for record in histogram_rows:
        party_group_name = record["party_group"]

        if not party_group_name:
            continue

        month_value = record["month_start"]
        month_key = (
            month_value.strftime("%Y-%m")
            if hasattr(month_value, "strftime")
            else str(month_value)[:7]
        )
        series_by_party[party_group_name][month_index[month_key]] = int(record["hits"])

    ordered_parties = [
        party for party in PREDEFINED_PARTY_ORDER if party in parties_seen
    ]
    data_series = [series_by_party[party] for party in ordered_parties]

    return {
        "start_month": start_month,
        "end_month": end_month,
        "labels": month_labels,
        "parties": ordered_parties,
        "series": data_series,
    }


def service_search_totals(form_data):
    # Totals always show full history from 2017-07-01 to now
    # (date filters only affect search results, not the share visualization)
    # This matches the histogram behavior for consistency
    start_date_value = "2017-07-01"
    end_date_value = datetime.now().strftime("%Y-%m-%d")

    conditions, condition_values = extract_filters(form_data)
    search_text = form_data.get("search", "").strip()
    where_no_date_sql, where_no_date_params, _ = build_where_clause(
        conditions, search_text, None, None
    )

    case_params_values = party_case_params()

    sql = f"""
        SELECT party_group, COUNT(*) AS hits
        FROM (
            SELECT
                {SQL_PARTY_GROUP_CASE} AS party_group
            FROM mat_classification_legislator
            WHERE {where_no_date_sql}
              AND text IS NOT NULL AND text != ''
              AND party IS NOT NULL AND party <> ''
              AND date IS NOT NULL
              AND date >= %s
              AND date <= %s
        ) grouped
        WHERE party_group IS NOT NULL
        GROUP BY party_group
    """

    sql_params = []
    sql_params += case_params_values
    sql_params += list(condition_values) + list(where_no_date_params)
    sql_params += [start_date_value, end_date_value]

    total_rows = database_manager.query(sql, sql_params)
    ordered_labels = PREDEFINED_PARTY_ORDER
    counts_map = {row["party_group"]: int(row["hits"]) for row in total_rows}
    totals = [counts_map.get(label, 0) for label in ordered_labels]

    return {
        "parties": ordered_labels,
        "totals": totals,
        "start_date": start_date_value,
        "end_date": end_date_value,
    }


def service_search_histogram(form_data):
    condition_clauses, condition_values = extract_filters(form_data)
    search_text = form_data.get("search", "").strip()
    where_sql_without_date, search_params_without_date, _ = build_where_clause(
        condition_clauses, search_text, None, None
    )
    all_params_without_date = condition_values + search_params_without_date

    # Histogram always shows full history from 2017-07-01 to now
    # (date filters only affect search results, not the histogram visualization)
    start_month = "2017-07-01"

    return query_monthly_counts_by_party_predefined(
        where_sql_without_date,
        all_params_without_date,
        start_month=start_month,
        end_month=None,
    )


def service_search(form_data):
    condition_clauses, condition_values = extract_filters(form_data)
    search_text = form_data.get("search", "").strip()
    page_number = int(form_data.get("page", 1))
    sort_mode = form_data.get("sort_mode", "date-desc")

    where_sql, search_params, highlight_terms = build_where_clause(
        condition_clauses,
        search_text,
        form_data.get("start_date"),
        form_data.get("end_date"),
    )
    all_params_combined = condition_values + search_params

    search_results, has_more_results = query_classifications(
        where_sql, all_params_combined, page_number, sort_mode
    )
    total_count = (
        count_query(where_sql, all_params_combined) if page_number == 1 else None
    )
    unique_count = (
        count_query(where_sql, all_params_combined, distinct=True)
        if page_number == 1
        else None
    )

    return {
        "results": search_results,
        "highlight_terms": highlight_terms,
        "has_more_results": has_more_results,
        "page": page_number,
        "total_result_count": total_count,
        "unique_legislator_count": unique_count,
    }


# ------------------------------------------------------------------------------
# Small utility used by /warmup route
# ------------------------------------------------------------------------------


def ping_db():
    database_manager.query("SELECT 1")
