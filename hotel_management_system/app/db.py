"""
db.py
=====
A thin, beginner-friendly wrapper around psycopg2.

Why a wrapper?
    * Every SQL statement in the project is executed from one place, so
      parameterised queries (and therefore SQL-injection safety) are
      guaranteed everywhere.
    * PostgreSQL errors are converted into a short, readable message
      that the menu can display instead of a Python traceback.
    * Transactions are explicit: a block either commits completely or
      rolls back completely (important for check-in / check-out, where
      two tables must change together).

Usage
-----
    db = Database()
    db.connect()
    rows = db.query("SELECT * FROM room WHERE status = %s", ("Available",))
    db.execute("UPDATE ...", (...))          # runs inside a transaction
"""

import psycopg2
from psycopg2 import errorcodes
from psycopg2.extras import RealDictCursor

import config


class DatabaseError(Exception):
    """Raised for every database problem, with a friendly message."""


# Maps PostgreSQL error codes to hints a second-year student can act on.
ERROR_HINTS = {
    errorcodes.UNIQUE_VIOLATION:
        "A record with the same value already exists (UNIQUE constraint).",
    errorcodes.FOREIGN_KEY_VIOLATION:
        "This record is referenced by other records, or the referenced "
        "record does not exist (FOREIGN KEY constraint).",
    errorcodes.CHECK_VIOLATION:
        "A value breaks a CHECK constraint of the table.",
    errorcodes.NOT_NULL_VIOLATION:
        "A required column was left empty (NOT NULL constraint).",
    errorcodes.INVALID_TEXT_REPRESENTATION:
        "A value has the wrong type (for example text where a number "
        "or date was expected).",
    errorcodes.UNDEFINED_TABLE:
        "A table is missing. Run sql/01_schema.sql and sql/02_sample_data.sql.",
    errorcodes.UNDEFINED_COLUMN:
        "A column name is wrong - the database schema and the program "
        "may be out of date.",
    errorcodes.NUMERIC_VALUE_OUT_OF_RANGE:
        "A number is too large for its column type.",
}


class Database:
    """Owns the single psycopg2 connection used by the application."""

    def __init__(self):
        self.config = config.get_config()
        self.conn = None

    # ------------------------------------------------------------------
    # Connection handling
    # ------------------------------------------------------------------
    def connect(self):
        """Open the connection. Raises DatabaseError if it fails."""
        if self.conn is not None and self.conn.closed == 0:
            return self
        try:
            if self.config.get("dsn"):
                self.conn = psycopg2.connect(self.config["dsn"])
            else:
                self.conn = psycopg2.connect(
                    host=self.config["DB_HOST"],
                    port=self.config["DB_PORT"],
                    dbname=self.config["DB_NAME"],
                    user=self.config["DB_USER"],
                    password=self.config["DB_PASSWORD"],
                    client_encoding="UTF8",
                )
            self.conn.autocommit = False
        except psycopg2.OperationalError as exc:
            # psycopg2 repeats the same message once for IPv6 and once for
            # IPv4, so only the first part is shown - one readable line.
            reason = " ".join(str(exc).split())
            if " Is the server running" in reason:
                reason = reason.split(" Is the server running")[0]
            if len(reason) > 170:
                reason = reason[:167] + "..."
            raise DatabaseError(
                "Could not connect to PostgreSQL.\n"
                f"  Tried  : {config.describe(self.config)}\n"
                f"  Reason : {reason}\n"
                "  Check that the PostgreSQL service is running, that the "
                "database exists (sql/00_create_database.sql) and that the "
                "credentials in .env are correct."
            ) from exc
        return self

    def close(self):
        if self.conn is not None and self.conn.closed == 0:
            self.conn.close()

    def is_connected(self) -> bool:
        return self.conn is not None and self.conn.closed == 0

    # ------------------------------------------------------------------
    # Reading data
    # ------------------------------------------------------------------
    def query(self, sql: str, params: tuple = ()) -> list:
        """Run a SELECT and return a list of dictionaries."""
        cur = None
        try:
            cur = self.conn.cursor(cursor_factory=RealDictCursor)
            cur.execute(sql, params)
            return cur.fetchall()
        except psycopg2.Error as exc:
            self.conn.rollback()
            raise DatabaseError(self.explain(exc)) from exc
        finally:
            if cur is not None:
                cur.close()

    def query_one(self, sql: str, params: tuple = ()):
        """Run a SELECT that returns at most one row (or None)."""
        rows = self.query(sql, params)
        return rows[0] if rows else None

    def scalar(self, sql: str, params: tuple = (), default=None):
        """Run a SELECT that returns a single value."""
        row = self.query_one(sql, params)
        if not row:
            return default
        return list(row.values())[0]

    # ------------------------------------------------------------------
    # Writing data
    # ------------------------------------------------------------------
    def execute(self, sql: str, params: tuple = ()) -> int:
        """
        Run one INSERT/UPDATE/DELETE and commit it.
        Returns the number of affected rows.
        """
        cur = None
        try:
            cur = self.conn.cursor()
            cur.execute(sql, params)
            affected = cur.rowcount
            self.conn.commit()
            return affected
        except psycopg2.Error as exc:
            self.conn.rollback()
            raise DatabaseError(self.explain(exc)) from exc
        finally:
            if cur is not None:
                cur.close()

    def execute_returning(self, sql: str, params: tuple = ()):
        """Run INSERT ... RETURNING and return the first row as a dict."""
        cur = None
        try:
            cur = self.conn.cursor(cursor_factory=RealDictCursor)
            cur.execute(sql, params)
            row = cur.fetchone()
            self.conn.commit()
            return row
        except psycopg2.Error as exc:
            self.conn.rollback()
            raise DatabaseError(self.explain(exc)) from exc
        finally:
            if cur is not None:
                cur.close()

    def run_in_transaction(self, steps):
        """
        Execute several statements atomically.

        `steps` is a list of (sql, params) tuples.  If any statement
        fails, all previous statements are rolled back, so the database
        never ends up half-updated (used by check-in, check-out and
        cancellation).
        """
        cur = None
        try:
            cur = self.conn.cursor(cursor_factory=RealDictCursor)
            results = []
            for sql, params in steps:
                cur.execute(sql, params)
                if cur.description is not None:
                    results.append(cur.fetchall())
                else:
                    results.append(cur.rowcount)
            self.conn.commit()
            return results
        except psycopg2.Error as exc:
            self.conn.rollback()
            raise DatabaseError(self.explain(exc)) from exc
        finally:
            if cur is not None:
                cur.close()

    # ------------------------------------------------------------------
    # Error translation
    # ------------------------------------------------------------------
    @staticmethod
    def explain(exc) -> str:
        """Turn a psycopg2 exception into a readable, single message."""
        code = getattr(exc, "pgcode", None)
        detail = (getattr(exc, "pgerror", None) or str(exc)).strip()
        # pgerror may span several lines - keep the first meaningful one.
        detail = " ".join(detail.split())
        hint = ERROR_HINTS.get(code)
        if hint:
            return f"{hint}\n  Database says: {detail}"
        return f"Database error: {detail}"
