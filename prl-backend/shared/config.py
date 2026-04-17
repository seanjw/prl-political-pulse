"""
Shared configuration module for PRL backend.
Loads secrets from AWS Secrets Manager and provides DB connection strings.
"""

import os
import json
import tempfile
from contextlib import contextmanager
from functools import lru_cache

import boto3


@lru_cache(maxsize=4)
def get_secrets(secret_name: str) -> dict:
    """Retrieve secrets from AWS Secrets Manager."""
    client = boto3.client(
        "secretsmanager", region_name=os.environ.get("AWS_REGION", "us-east-1")
    )
    response = client.get_secret_value(SecretId=secret_name)
    return json.loads(response["SecretString"])


def get_db_url(database: str = "elite", dialect: str = "mysql+pymysql") -> str:
    """Build a DB connection string using Secrets Manager credentials.

    Args:
        database: Database name (default: "elite")
        dialect: SQLAlchemy dialect string (default: "mysql+pymysql")
    """
    secrets = get_secrets("prl/database")
    from urllib.parse import quote

    password = quote(secrets["DB_PASSWORD"])
    host = secrets["DB_HOST"]
    port = secrets["DB_PORT"]
    user = secrets["DB_USER"]
    return f"{dialect}://{user}:{password}@{host}:{port}/{database}"


def get_tortoise_db_url(database: str = "pulse") -> str:
    """Build a Tortoise ORM-compatible DB connection string (async mysql).

    Tortoise ORM uses 'mysql://' and auto-detects asyncmy when installed.
    """
    return get_db_url(database, dialect="mysql")


def load_config():
    """Load all secrets into environment variables for backward compatibility.

    Call this at the start of batch job entrypoints so existing code that reads
    os.environ['DB_USER'] etc. continues to work.
    """
    db_secrets = get_secrets("prl/database")
    for key, value in db_secrets.items():
        os.environ[key] = str(value)

    api_secrets = get_secrets("prl/api-keys")
    for key, value in api_secrets.items():
        os.environ[key] = str(value)

    os.environ.setdefault("PATH_TO_SECRETS", "")


@contextmanager
def setup_google_creds():
    """Download Google credentials from Secrets Manager to a temp file.

    Yields the path to the temp credentials file and sets
    PATH_TO_GOOGLE_CREDS in the environment. Cleans up on exit.

    Usage::

        with setup_google_creds() as creds_path:
            subprocess.run(["python", "script.py"], ...)
    """
    google_creds = get_secrets("prl/google-credentials")
    tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False)
    try:
        json.dump(google_creds, tmp)
        tmp.close()
        os.environ["PATH_TO_GOOGLE_CREDS"] = tmp.name
        yield tmp.name
    finally:
        os.environ.pop("PATH_TO_GOOGLE_CREDS", None)
        try:
            os.unlink(tmp.name)
        except OSError:
            pass
