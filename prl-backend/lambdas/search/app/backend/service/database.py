import re
import time
from contextlib import contextmanager

from sqlalchemy import create_engine, inspect
from sqlalchemy.engine import Engine, Connection, Result


class DatabaseManager:
    def __init__(
        self,
        db_connection_string,
        pool_size=10,
        max_overflow=20,
        pool_recycle=280,
        pool_pre_ping=True,
    ):
        self.db_connection_string = db_connection_string

        self.engine: Engine = create_engine(
            self.db_connection_string,
            pool_size=pool_size,
            max_overflow=max_overflow,
            pool_recycle=pool_recycle,
            pool_pre_ping=pool_pre_ping,
            future=True,
        )

        self._test_connection()

    @contextmanager
    def _connect(self):
        conn = None

        try:
            conn: Connection = self.engine.connect()
            yield conn
        finally:
            if conn is not None:
                conn.close()

    def _mask_password(self, connection_string):
        return re.sub(r"://([^:]+):([^@]+)@", r"://\1:***@", connection_string)

    def _test_connection(self):
        try:
            with self._connect() as conn:
                _ = conn.exec_driver_sql("SELECT 1").scalar_one()
        except Exception as exc:
            print(f"Database connectivity test failed: {exc}")
            raise

    # ------------------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------------------
    def query(self, sql_query, params=None):
        start = time.perf_counter()
        params = tuple(params or ())

        try:
            with self._connect() as conn:
                result: Result = conn.exec_driver_sql(sql_query, params)
                rows = [dict(row._mapping) for row in result]

            return rows

        except Exception as exc:
            elapsed = time.perf_counter() - start
            print(f"Query failed after {elapsed:.3f} seconds: {exc}")
            print(f"Failed SQL: {sql_query}")

            if params:
                print(f"Failed Parameters: {params}")

            return []

    def query_scalar(self, sql_query, params=None):
        start = time.perf_counter()
        params = tuple(params or ())

        try:
            with self._connect() as conn:
                result = conn.exec_driver_sql(sql_query, params)
                value = result.scalar_one_or_none()

            return 0 if value is None else value

        except Exception as exc:
            elapsed = time.perf_counter() - start
            print(f"Scalar query failed after {elapsed:.3f} seconds: {exc}")
            print(f"Failed SQL: {sql_query}")

            if params:
                print(f"Failed Parameters: {params}")

            return 0

    def print_all_tables(self):
        try:
            inspector = inspect(self.engine)
            tables = inspector.get_table_names()

            if tables:
                print("Tables in database:")
                for i, t in enumerate(tables, 1):
                    print(f"{i}. {t}")
            else:
                print("No tables found in database.")
        except Exception as exc:
            print(f"Failed to get table names: {exc}")
