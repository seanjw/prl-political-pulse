import os
import logging
import contextvars
from typing import List, Optional

from fastapi import FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from starlette.responses import JSONResponse
from tortoise import Tortoise
from mangum import Mangum

# Use shared config for secrets (replaces dotenv)
from shared.config import get_tortoise_db_url

from models import (
    Data,
    Legislators,
    FederalProfiles,
    StateProfiles,
    PrimaryStatements,
    DownloadCounts,
)

logger = logging.getLogger()

ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")
logger.setLevel(logging.INFO)

# # # # # # # # # # #
# SETUP
# # # # # # # # # # #
db_url = get_tortoise_db_url("pulse")
app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Tortoise 0.25+ stores connection state in contextvars. Mangum creates a new
# async context per Lambda invocation, so the contextvar is lost on warm containers.
# Use our own contextvar to track init per-invocation, and always re-init when needed.
_ctx_initialized = contextvars.ContextVar("_tortoise_init", default=False)


async def _init_db():
    """Ensure Tortoise ORM is initialized in the current async context.

    Must be called per Lambda invocation because Mangum creates a fresh
    async context each time, losing Tortoise's internal contextvar state.
    """
    if _ctx_initialized.get():
        return
    logger.info("Initializing Tortoise ORM...")
    await Tortoise.init(
        db_url=db_url,
        modules={"models": ["models"]},
    )
    _ctx_initialized.set(True)
    logger.info("Tortoise ORM initialized successfully")


# # # # # # # # # # #
# ENDPOINTS
# # # # # # # # # # #
@app.get("/")
def read_root():
    return {"message": "sup"}


@app.get("/health")
async def health():
    """Verify DB connectivity."""
    try:
        await _init_db()
        count = await Data.all().count()
        return {"status": "ok", "data_rows": count}
    except Exception as e:
        import traceback

        logger.error(f"Health check failed: {e}")
        traceback.print_exc()
        return JSONResponse(
            status_code=503, content={"status": "error", "detail": str(e)}
        )


# -- Raw Data --
@app.get("/data/{path:path}")
async def pull_data(path: str):
    await _init_db()
    result = await Data.filter(endpoint=path).first()
    if result is None:
        raise HTTPException(status_code=404, detail="Data not found")

    result = {
        "data": result.data,
    }

    return result


# -- Primary Statements --
@app.get("/primary/statements/{candidate_id}")
async def primary_statements(candidate_id: str):
    await _init_db()
    try:
        conn = Tortoise.get_connection("default")
        rows = await conn.execute_query_dict(
            "SELECT id, candidate_id, date, source, text, categories, tweet_id "
            "FROM primary_statements WHERE candidate_id = %s ORDER BY date DESC LIMIT 20",
            [candidate_id],
        )
        # categories is stored as JSON string by dataset lib — parse if needed
        import json as _json

        for row in rows:
            if isinstance(row.get("categories"), str):
                try:
                    row["categories"] = _json.loads(row["categories"])
                except Exception:
                    row["categories"] = []
            if row.get("date"):
                row["date"] = str(row["date"])
        return {"data": rows}
    except Exception as e:
        logger.warning(f"primary_statements query failed: {e}")
        return {"data": []}


# -- Query --
fields = {
    "state",
    "party",
    "level",
    "bioguide_id",
    "name",
    "type",
    "source_id",
    "candidate_id",
}

ops = {
    "eq",
    "gt",
    "gte",
    "lt",
    "lte",
    "in",
    "icontains",
}

tables = {
    "legislators": Legislators,
    "federal_profiles": FederalProfiles,
    "state_profiles": StateProfiles,
    "primary_statements": PrimaryStatements,
}

pagesize = 20


@app.post("/query/")
async def data_query(request: Request):
    await _init_db()
    query = await request.json()

    if query.get("table") not in tables:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid table: {query.get('table')}. Must be one of: {', '.join(tables.keys())}",
        )
    table = tables[query["table"]]
    page = query.get("nextpage", 0)

    conditionals = {}
    for filt in query["filters"]:
        # !!! vvv DANGER: SECURITY DEPENDS ON THIS IF STATEMENT WORKING CORRECTLY vvv !!!
        if (filt["field"] in fields) and (filt["op"] in ops):
            if filt["op"] == "eq":
                conditionals[f"{filt['field']}"] = filt["value"]
            else:
                conditionals[f"{filt['field']}__{filt['op']}"] = filt["value"]

    result = (
        await table.filter(**conditionals).offset(page * pagesize).limit(pagesize).all()
    )

    # Build the next link
    if len(result) == 0:
        next_page = None
    elif len(result) < pagesize:
        next_page = None
    else:
        next_page = page + 1

    result = {
        "data": result,
        "nextpage": next_page,
    }

    return result


@app.get("/count/{path:path}")
async def count(path: str):
    await update_download_count(path)
    cloudfront_domain = os.environ["CLOUDFRONT_DOMAIN"]
    return RedirectResponse(url=f"https://{cloudfront_domain}/downloads/{path}")


async def update_download_count(path: str):
    await _init_db()
    file_entry = await DownloadCounts.filter(file="all_files").first()
    if file_entry is not None:
        file_entry.downloads = (file_entry.downloads or 0) + 1
        await file_entry.save()


# # # # # # # # # # #
# ADMIN ENDPOINTS
# # # # # # # # # # #


def _check_admin_password(password: str = Header(None, alias="x-admin-password")):
    """Validate admin password from header."""
    if not ADMIN_PASSWORD or password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Unauthorized")


class SaveWinnersRequest(BaseModel):
    password: str
    race_id: str
    winner_candidate_ids: List[str]


@app.get("/admin/primary-winners")
async def get_primary_winners(x_admin_password: str = Header(None)):
    """Return all current primary winner records."""
    _check_admin_password(x_admin_password)
    await _init_db()
    conn = Tortoise.get_connection("default")
    rows = await conn.execute_query_dict(
        "SELECT candidate_id, race_id, called_at FROM elite.primary_winners"
    )
    for row in rows:
        if row.get("called_at"):
            row["called_at"] = str(row["called_at"])
    return {"data": rows}


@app.post("/admin/primary-winners")
async def save_primary_winners(req: SaveWinnersRequest):
    """Save winners for a race. Replaces any existing winners for that race."""
    if not ADMIN_PASSWORD or req.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Unauthorized")
    if not req.race_id:
        raise HTTPException(status_code=400, detail="race_id is required")
    if not req.winner_candidate_ids:
        raise HTTPException(
            status_code=400, detail="winner_candidate_ids must not be empty"
        )

    await _init_db()
    conn = Tortoise.get_connection("default")

    # Delete existing winners for this race, then insert new ones
    await conn.execute_query(
        "DELETE FROM elite.primary_winners WHERE race_id = %s", [req.race_id]
    )
    for cid in req.winner_candidate_ids:
        await conn.execute_query(
            "INSERT INTO elite.primary_winners (candidate_id, race_id) VALUES (%s, %s)",
            [cid, req.race_id],
        )

    return {
        "message": "Winners saved",
        "race_id": req.race_id,
        "winners_count": len(req.winner_candidate_ids),
    }


@app.delete("/admin/primary-winners/{race_id}")
async def clear_primary_winners(race_id: str, x_admin_password: str = Header(None)):
    """Un-call a race by removing all winners."""
    _check_admin_password(x_admin_password)
    await _init_db()
    conn = Tortoise.get_connection("default")
    await conn.execute_query(
        "DELETE FROM elite.primary_winners WHERE race_id = %s", [race_id]
    )
    return {"message": "Race cleared", "race_id": race_id}


# # # # # # # # # # #
# STATE LEGISLATORS ADMIN
# # # # # # # # # # #

LEGISLATOR_FIELDS = [
    "name",
    "first_name",
    "last_name",
    "gender",
    "party",
    "position",
    "district",
    "email",
    "campaign_website",
    "government_website",
    "twitter_handle",
    "facebook",
    "instagram",
    "linkedin",
    "youtube",
    "truth_social",
    "tiktok",
]


class UpdateLegislatorRequest(BaseModel):
    name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    gender: Optional[str] = None
    party: Optional[str] = None
    position: Optional[str] = None
    district: Optional[str] = None
    email: Optional[str] = None
    campaign_website: Optional[str] = None
    government_website: Optional[str] = None
    twitter_handle: Optional[str] = None
    facebook: Optional[str] = None
    instagram: Optional[str] = None
    linkedin: Optional[str] = None
    youtube: Optional[str] = None
    truth_social: Optional[str] = None
    tiktok: Optional[str] = None
    reviewed: Optional[int] = None


class MarkReviewedRequest(BaseModel):
    ids: List[int]
    reviewed: int


@app.get("/admin/state-legislators")
async def list_state_legislators(
    x_admin_password: str = Header(None),
    reviewed: Optional[int] = Query(None),
    state: Optional[str] = Query(None),
    party: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(0, ge=0),
    page_size: int = Query(50, ge=1, le=200),
):
    """List state legislators with filtering and pagination."""
    _check_admin_password(x_admin_password)
    await _init_db()
    conn = Tortoise.get_connection("default")

    where = ["level = 'state'", "active = 1"]
    params = []

    if reviewed is not None:
        where.append("reviewed = %s")
        params.append(reviewed)
    if state:
        where.append("state = %s")
        params.append(state)
    if party:
        where.append("party = %s")
        params.append(party)
    if search:
        where.append("name LIKE %s")
        params.append(f"%{search}%")

    where_clause = " AND ".join(where)

    # Get total count
    count_rows = await conn.execute_query_dict(
        f"SELECT COUNT(*) as total FROM elite.officials WHERE {where_clause}",
        params,
    )
    total = count_rows[0]["total"] if count_rows else 0

    # Get page of results
    select_cols = ", ".join(
        ["id", "openstates_id", "state", "active", "reviewed"] + LEGISLATOR_FIELDS
    )
    rows = await conn.execute_query_dict(
        f"SELECT {select_cols} FROM elite.officials "
        f"WHERE {where_clause} ORDER BY state, name "
        f"LIMIT %s OFFSET %s",
        params + [page_size, page * page_size],
    )

    return {"data": rows, "total": total, "page": page, "page_size": page_size}


@app.get("/admin/state-legislators/stats")
async def state_legislators_stats(x_admin_password: str = Header(None)):
    """Summary counts for the state legislators dashboard."""
    _check_admin_password(x_admin_password)
    await _init_db()
    conn = Tortoise.get_connection("default")

    totals = await conn.execute_query_dict(
        "SELECT COUNT(*) as total, "
        "SUM(CASE WHEN reviewed = 1 THEN 1 ELSE 0 END) as reviewed "
        "FROM elite.officials WHERE level = 'state' AND active = 1"
    )
    total = totals[0]["total"] if totals else 0
    reviewed_count = int(totals[0]["reviewed"] or 0) if totals else 0

    by_state = await conn.execute_query_dict(
        "SELECT state, COUNT(*) as total, "
        "SUM(CASE WHEN reviewed = 0 THEN 1 ELSE 0 END) as unreviewed "
        "FROM elite.officials WHERE level = 'state' AND active = 1 "
        "GROUP BY state ORDER BY state"
    )
    state_map = {}
    for row in by_state:
        state_map[row["state"]] = {
            "total": row["total"],
            "unreviewed": int(row["unreviewed"] or 0),
        }

    return {
        "total": total,
        "reviewed": reviewed_count,
        "unreviewed": total - reviewed_count,
        "by_state": state_map,
    }


@app.put("/admin/state-legislators/{legislator_id}")
async def update_state_legislator(
    legislator_id: int,
    req: UpdateLegislatorRequest,
    x_admin_password: str = Header(None),
):
    """Update fields for a single state legislator."""
    _check_admin_password(x_admin_password)
    await _init_db()
    conn = Tortoise.get_connection("default")

    # Build dynamic SET clause from non-None fields
    updates = {}
    for field in LEGISLATOR_FIELDS:
        val = getattr(req, field)
        if val is not None:
            updates[field] = val
    if req.reviewed is not None:
        updates["reviewed"] = req.reviewed

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_parts = [f"{k} = %s" for k in updates]
    params = list(updates.values())
    params.append(legislator_id)

    result = await conn.execute_query(
        f"UPDATE elite.officials SET {', '.join(set_parts)} "
        f"WHERE id = %s AND level = 'state'",
        params,
    )
    affected = result[0]
    if affected == 0:
        raise HTTPException(status_code=404, detail="Legislator not found")

    return {"message": "Legislator updated", "id": legislator_id}


@app.post("/admin/state-legislators/mark-reviewed")
async def mark_legislators_reviewed(
    req: MarkReviewedRequest,
    x_admin_password: str = Header(None),
):
    """Bulk mark legislators as reviewed or unreviewed."""
    _check_admin_password(x_admin_password)
    if req.reviewed not in (0, 1):
        raise HTTPException(status_code=400, detail="reviewed must be 0 or 1")
    if not req.ids:
        raise HTTPException(status_code=400, detail="ids must not be empty")

    await _init_db()
    conn = Tortoise.get_connection("default")

    placeholders = ", ".join(["%s"] * len(req.ids))
    result = await conn.execute_query(
        f"UPDATE elite.officials SET reviewed = %s "
        f"WHERE id IN ({placeholders}) AND level = 'state'",
        [req.reviewed] + req.ids,
    )
    affected = result[0]

    return {
        "message": f"Marked {affected} legislators as reviewed={req.reviewed}",
        "affected": affected,
    }


lambda_handler = Mangum(app, lifespan="off")
