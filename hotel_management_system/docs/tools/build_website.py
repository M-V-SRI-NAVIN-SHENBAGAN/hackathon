"""
build_website.py
================
Builds the project website in `website/` from the real project files.

The website is generated, never hand-edited, so it always matches:

    sql/*.sql              -> SQL viewer + downloadable scripts
    app/*.py               -> source-code viewer + downloads
    docs/PROJECT_REPORT.md -> website/report.html
    docs/screenshots/*.png -> screenshot gallery
    docs/ER_DIAGRAM.*      -> design section
    the live database      -> demo data, query results, statistics

Run (from hotel_management_system/):

    python docs/tools/build_website.py

Requirements: psycopg2 (already needed by the app), markdown, and a running
PostgreSQL database loaded with sql/01_schema.sql + sql/02_sample_data.sql.
Install the extra tools with:  pip install -r docs/tools/requirements-docs.txt
Connection settings come from the same .env / environment variables as the
application (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD or DATABASE_URL).
"""

import json
import os
import shutil
import sys
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent      # hotel_management_system/
SITE = ROOT / "website"
ASSETS = SITE / "assets"
DATA_DIR = ASSETS / "data"
DOWNLOADS = SITE / "downloads"

sys.path.insert(0, str(ROOT / "app"))
import config  # noqa: E402  (reuse the application's connection settings)
import psycopg2  # noqa: E402
from psycopg2.extras import RealDictCursor  # noqa: E402


# ----------------------------------------------------------------------
# Metadata shown in the site
# ----------------------------------------------------------------------
SQL_FILES = [
    ("00_create_database.sql", "1. Create the database",
     "Creates the PostgreSQL database `hotel_db` and (optionally) an application user."),
    ("01_schema.sql", "2. Schema, constraints and views",
     "Four tables with PRIMARY KEY, FOREIGN KEY, NOT NULL, UNIQUE and CHECK "
     "constraints, indexes, a helper function and five SQL views."),
    ("02_sample_data.sql", "3. Sample data",
     "12 customers, 14 rooms, 16 reservations and 16 payments covering every "
     "room type, reservation status, payment method and payment status."),
    ("03_queries.sql", "4. SQL demonstration",
     "34 numbered queries: WHERE, ORDER BY, aggregates, GROUP BY, HAVING, "
     "INNER JOIN, LEFT JOIN, subqueries, views and date-wise availability."),
]

APP_FILES = [
    ("main.py", "Entry point", "Banner, connection test, main menu and top-level error handling."),
    ("config.py", "Configuration", "Reads the PostgreSQL connection settings from .env or the environment."),
    ("db.py", "Database layer", "All SQL goes through this psycopg2 wrapper: parameterised queries, explicit transactions and readable error messages."),
    ("ui.py", "Console UI helpers", "ASCII tables, success/error messages and validated input prompts."),
    ("customers.py", "Module 1 · Customers", "Add, view, search, update and delete customer records."),
    ("rooms.py", "Module 2 · Rooms", "Add rooms, list rooms and tariffs, update status, date-wise availability query."),
    ("reservations.py", "Module 3 · Reservations", "Book a room, check availability, calculate the bill, view and cancel reservations."),
    ("frontdesk.py", "Module 4 · Check-in / out", "Check-in and check-out, executed as single atomic transactions."),
    ("payments.py", "Module 5 · Payments", "Record payments (Cash / Card / UPI), pending list and refunds."),
    ("reports.py", "Module 6 · Reports", "Eight reports built with joins, GROUP BY, HAVING, subqueries and views."),
]

SCREENSHOTS = [
    ("01_main_menu.png", "Startup", "Connection verified and sample row counts displayed."),
    ("02_add_customer.png", "Add customer", "INSERT … RETURNING gives the new customer ID."),
    ("03_view_customers.png", "View customers", "All 12 sample customers, ordered by customer_id."),
    ("04_search_customer.png", "Search customer", "Search by name with LIKE, plus the booking count from a LEFT JOIN."),
    ("05_room_list.png", "Room list", "14 rooms with category, floor, tariff and live status."),
    ("06_room_tariff.png", "Tariff by type", "GROUP BY over room categories with availability counts."),
    ("07_check_availability.png", "Check availability", "Only rooms without an overlapping active reservation are offered."),
    ("08_book_room.png", "Book a room", "Guest → dates → available rooms → bill preview → confirmation."),
    ("09_view_reservation.png", "Reservation details", "One reservation with its payment record."),
    ("10_check_in.png", "Check-in", "Reservation becomes CheckedIn and the room becomes Occupied."),
    ("11_check_out.png", "Check-out", "Reservation becomes CheckedOut and the room is freed, in one transaction."),
    ("12_payment_pending.png", "Pending payments", "Outstanding amount still to be collected."),
    ("13_record_payment.png", "Record payment", "Card payment recorded with a transaction reference."),
    ("14_report_all_reservations.png", "All reservations", "Report built on vw_reservation_details."),
    ("15_report_occupied_rooms.png", "Occupied rooms", "Guests in house and the occupancy percentage."),
    ("16_report_customer_history.png", "Customer history", "Bookings, completed stays, cancellations and money spent."),
    ("17_report_revenue.png", "Revenue", "Total revenue, by payment method and by month."),
    ("18_report_popular_room_type.png", "Popular room type", "Deluxe is the most frequently booked category."),
    ("19_sql_tables_and_aggregates.png", "SQL · structure", "Table columns, constraints and aggregate functions in psql."),
    ("20_sql_groupby_having.png", "SQL · GROUP BY", "GROUP BY with HAVING and a three-table INNER JOIN."),
    ("21_sql_leftjoin_subquery.png", "SQL · LEFT JOIN", "LEFT JOIN, a derived-table subquery and a view."),
]

# ----------------------------------------------------------------------
# Queries with live results (the site renders SQL + real output table)
# ----------------------------------------------------------------------
QUERIES = [
    ("Q5", "SELECT with WHERE and ORDER BY", "Where / Order by", """
        SELECT room_number, room_type, price_per_night, status
        FROM room
        WHERE price_per_night > 4000
        ORDER BY price_per_night;
    """),
    ("Q8", "Search a customer by name or phone", "Where / LIKE", """
        SELECT customer_id, full_name, phone, email
        FROM customer
        WHERE LOWER(full_name) LIKE LOWER('%arjun%')
           OR phone = '9840012301';
    """),
    ("Q11", "All five aggregate functions", "COUNT · MIN · MAX · AVG · SUM", """
        SELECT COUNT(*)                        AS total_rooms,
               MIN(price_per_night)            AS cheapest_room,
               MAX(price_per_night)            AS costliest_room,
               ROUND(AVG(price_per_night), 2)  AS average_tariff,
               SUM(price_per_night)            AS sum_of_tariffs
        FROM room;
    """),
    ("Q12", "Revenue actually collected", "Aggregate with WHERE", """
        SELECT COUNT(*)               AS paid_transactions,
               SUM(amount)            AS total_revenue,
               ROUND(AVG(amount), 2)  AS average_payment
        FROM payment
        WHERE payment_status = 'Paid';
    """),
    ("Q13", "Statistics per room type", "GROUP BY", """
        SELECT room_type,
               COUNT(*)                       AS rooms,
               ROUND(AVG(price_per_night), 2) AS avg_price,
               MIN(price_per_night)           AS min_price,
               MAX(price_per_night)           AS max_price
        FROM room
        GROUP BY room_type
        ORDER BY avg_price DESC;
    """),
    ("Q14", "Room types worth promoting", "GROUP BY … HAVING", """
        SELECT room_type,
               COUNT(*)                       AS rooms,
               ROUND(AVG(price_per_night), 2) AS avg_price
        FROM room
        GROUP BY room_type
        HAVING COUNT(*) >= 3 AND AVG(price_per_night) > 3000
        ORDER BY avg_price DESC;
    """),
    ("Q16", "Revenue per payment method", "GROUP BY … HAVING", """
        SELECT payment_method,
               COUNT(*)    AS transactions,
               SUM(amount) AS collected
        FROM payment
        WHERE payment_status = 'Paid'
        GROUP BY payment_method
        HAVING SUM(amount) > 0
        ORDER BY collected DESC;
    """),
    ("Q18", "Reservations with guest and room", "INNER JOIN (3 tables)", """
        SELECT r.reservation_id, c.full_name, rm.room_number, rm.room_type,
               r.check_in_date, r.check_out_date, r.total_amount, r.status
        FROM reservation r
        INNER JOIN customer c ON c.customer_id = r.customer_id
        INNER JOIN room     rm ON rm.room_id   = r.room_id
        ORDER BY r.reservation_id;
    """),
    ("Q20", "Every customer and their booking count", "LEFT JOIN", """
        SELECT c.customer_id, c.full_name,
               COUNT(r.reservation_id)           AS bookings,
               COALESCE(SUM(r.total_amount), 0)  AS booking_value
        FROM customer c
        LEFT JOIN reservation r ON r.customer_id = c.customer_id
        GROUP BY c.customer_id, c.full_name
        ORDER BY bookings DESC, c.customer_id;
    """),
    ("Q21", "Rooms that were never booked", "LEFT JOIN + FILTER", """
        SELECT rm.room_id, rm.room_number, rm.room_type,
               COUNT(r.reservation_id) FILTER (WHERE r.status <> 'Cancelled')
                   AS confirmed_bookings
        FROM room rm
        LEFT JOIN reservation r ON r.room_id = rm.room_id
        GROUP BY rm.room_id, rm.room_number, rm.room_type
        ORDER BY rm.room_id;
    """),
    ("Q23", "Rooms that have never been booked", "NOT EXISTS subquery", """
        SELECT room_number, room_type, status
        FROM room rm
        WHERE NOT EXISTS (
                SELECT 1 FROM reservation r WHERE r.room_id = rm.room_id
              )
        ORDER BY room_number;
    """),
    ("Q24", "Rooms priced above the average", "Scalar subquery", """
        SELECT room_number, room_type, price_per_night
        FROM room
        WHERE price_per_night > (SELECT AVG(price_per_night) FROM room)
        ORDER BY price_per_night;
    """),
    ("Q26", "Most frequently booked room type", "Derived-table subquery", """
        SELECT room_type, times_booked
        FROM (
                SELECT rm.room_type, COUNT(*) AS times_booked
                FROM reservation r
                INNER JOIN room rm ON rm.room_id = r.room_id
                WHERE r.status <> 'Cancelled'
                GROUP BY rm.room_type
             ) AS booking_counts
        ORDER BY times_booked DESC, room_type
        LIMIT 1;
    """),
    ("Q27", "Rooms free for a date range", "NOT EXISTS overlap test", """
        SELECT rm.room_id, rm.room_number, rm.room_type, rm.price_per_night
        FROM room rm
        WHERE rm.status <> 'Maintenance'
          AND NOT EXISTS (
                SELECT 1
                FROM reservation r
                WHERE r.room_id = rm.room_id
                  AND r.status IN ('Booked', 'CheckedIn')
                  AND r.check_in_date  < DATE '2026-12-03'
                  AND r.check_out_date > DATE '2026-12-01'
              )
        ORDER BY rm.price_per_night;
    """),
    ("Q33", "Revenue summary view", "VIEW", """
        SELECT * FROM vw_hotel_revenue;
    """),
]


# ----------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------
def connect():
    settings = config.get_config()
    if settings.get("dsn"):
        conn = psycopg2.connect(settings["dsn"])
    else:
        conn = psycopg2.connect(
            host=settings["DB_HOST"], port=settings["DB_PORT"],
            dbname=settings["DB_NAME"], user=settings["DB_USER"],
            password=settings["DB_PASSWORD"])
    conn.set_session(readonly=True)
    return conn


def json_value(value):
    """Convert database values to something JSON/JavaScript friendly."""
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M")
    if isinstance(value, date):
        return value.isoformat()
    return value


def rows_as_dicts(cursor):
    names = [d[0] for d in cursor.description]
    out = []
    for record in cursor.fetchall():
        out.append({name: json_value(record[i]) for i, name in enumerate(names)})
    return names, out


def fetch_sample_data(conn):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT customer_id, full_name, email, phone, address,
                   id_proof_type, id_proof_number
            FROM customer ORDER BY customer_id""")
        customers = [{k: json_value(v) for k, v in row.items()} for row in cur.fetchall()]

        cur.execute("""
            SELECT room_id, room_number, room_type, floor_no, price_per_night,
                   max_occupancy, status
            FROM room ORDER BY room_id""")
        rooms = [{k: json_value(v) for k, v in row.items()} for row in cur.fetchall()]

        cur.execute("""
            SELECT reservation_id, customer_id, room_id, check_in_date,
                   check_out_date, booking_date, num_guests, total_amount,
                   status, actual_check_in, actual_check_out
            FROM reservation ORDER BY reservation_id""")
        reservations = [{k: json_value(v) for k, v in row.items()}
                        for row in cur.fetchall()]

        cur.execute("""
            SELECT payment_id, reservation_id, amount, payment_method,
                   payment_status, payment_date, transaction_ref
            FROM payment ORDER BY payment_id""")
        payments = [{k: json_value(v) for k, v in row.items()}
                    for row in cur.fetchall()]
    return {"customers": customers, "rooms": rooms,
            "reservations": reservations, "payments": payments}


def run_queries(conn):
    results = []
    for number, title, concept, sql in QUERIES:
        clean_sql = "\n".join(line.strip() for line in sql.strip().splitlines())
        with conn.cursor() as cur:
            cur.execute(sql)
            columns, rows = rows_as_dicts(cur)
        results.append({"number": number, "title": title, "concept": concept,
                        "sql": clean_sql, "columns": columns, "rows": rows})
    return results


def read_code(path: Path) -> str:
    return path.read_text(encoding="utf-8").replace("\t", "    ")


def copy_assets():
    for folder in ("screenshots", "downloads", "assets/css", "assets/js", "assets/data"):
        (SITE / folder).mkdir(parents=True, exist_ok=True)

    # screenshots + ER diagram (used by the site and by report.html)
    for png in sorted((ROOT / "docs" / "screenshots").glob("*.png")):
        shutil.copy2(png, SITE / "screenshots" / png.name)
    for name in ("ER_DIAGRAM.png", "ER_DIAGRAM.svg"):
        shutil.copy2(ROOT / "docs" / name, SITE / name)

    # downloadable originals
    (DOWNLOADS / "sql").mkdir(parents=True, exist_ok=True)
    (DOWNLOADS / "app").mkdir(parents=True, exist_ok=True)
    (DOWNLOADS / "docs").mkdir(parents=True, exist_ok=True)
    for sql in sorted((ROOT / "sql").glob("*.sql")):
        shutil.copy2(sql, DOWNLOADS / "sql" / sql.name)
    for py in sorted((ROOT / "app").glob("*.py")):
        shutil.copy2(py, DOWNLOADS / "app" / py.name)
    for doc in ("PROJECT_REPORT.md", "PROJECT_REPORT.docx", "SAMPLE_RUN_OUTPUT.txt"):
        shutil.copy2(ROOT / "docs" / doc, DOWNLOADS / "docs" / doc)
    for extra in ("README.md", "requirements.txt", ".env.example"):
        source = ROOT / extra
        if source.is_file():
            shutil.copy2(source, DOWNLOADS / extra)


def build_download_index():
    """List of every downloadable file with its size, for the Files section."""
    groups = {"SQL scripts": "downloads/sql", "Python application": "downloads/app",
              "Documentation": "downloads/docs", "Project files": "downloads"}
    files = []
    for label, folder in groups.items():
        base = SITE / folder
        for path in sorted(base.iterdir()):
            if not path.is_file():
                continue
            if (label == "Project files"
                    and path.suffix not in (".md", ".txt")
                    and not path.name.startswith(".env")):
                continue
            size = path.stat().st_size
            files.append({
                "group": label,
                "name": path.name,
                "path": f"{folder}/{path.name}",
                "size": f"{size / 1024:.1f} KB" if size >= 1024 else f"{size} B",
                "lines": sum(1 for _ in path.open("rb")) if path.suffix in
                         (".py", ".sql", ".md", ".txt") else None,
            })
    return files


# ----------------------------------------------------------------------
# Report page
# ----------------------------------------------------------------------
def build_report():
    import markdown

    source = (ROOT / "docs" / "PROJECT_REPORT.md").read_text(encoding="utf-8")
    # The report's own title is rendered by the page header instead.
    body = markdown.markdown(
        source,
        extensions=["tables", "fenced_code", "toc", "attr_list", "sane_lists"],
    )

    template = (SITE / "assets" / "report_template.html").read_text(encoding="utf-8")
    html = (template
            .replace("{{TITLE}}", "Project Report · Hotel Management System")
            .replace("{{CONTENT}}", body))
    (SITE / "report.html").write_text(html, encoding="utf-8")
    print("  report.html")


# ----------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------
def main():
    print("Building website …")
    SITE.mkdir(exist_ok=True)

    conn = connect()
    try:
        sample = fetch_sample_data(conn)
        queries = run_queries(conn)
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM customer")
            n_customers = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM room")
            n_rooms = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM reservation")
            n_reservations = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM payment")
            n_payments = cur.fetchone()[0]
            cur.execute("""
                SELECT COALESCE(SUM(amount), 0) FROM payment
                WHERE payment_status = 'Paid'""")
            revenue = float(cur.fetchone()[0])
    finally:
        conn.close()

    print(f"  demo data: {n_customers} customers, {n_rooms} rooms, "
          f"{n_reservations} reservations, {n_payments} payments")

    sql_docs = []
    for name, title, purpose in SQL_FILES:
        code = read_code(ROOT / "sql" / name)
        sql_docs.append({"name": name, "title": title, "purpose": purpose,
                         "code": code,
                         "lines": len(code.splitlines()),
                         "statements": code.count(";")})

    app_docs = []
    for name, title, purpose in APP_FILES:
        code = read_code(ROOT / "app" / name)
        app_docs.append({"name": name, "title": title, "purpose": purpose,
                         "code": code,
                         "lines": len(code.splitlines())})

    copy_assets()
    files = build_download_index()

    screenshots = []
    for name, title, caption in SCREENSHOTS:
        if (SITE / "screenshots" / name).is_file():
            screenshots.append({"file": f"screenshots/{name}",
                                "title": title, "caption": caption})

    stats = {
        "customers": n_customers,
        "rooms": n_rooms,
        "reservations": n_reservations,
        "payments": n_payments,
        "revenue": f"{revenue:,.2f}",
        "tables": 4,
        "views": 5,
        "queries": 34,
        "screenshots": len(screenshots),
        "python_lines": sum(doc["lines"] for doc in app_docs),
        "sql_lines": sum(doc["lines"] for doc in sql_docs),
        "modules": 6,
        "tests": 24,
    }

    payload = {
        "generated_at": datetime.now().strftime("%d %B %Y, %H:%M"),
        "stats": stats,
        "sql": sql_docs,
        "app": app_docs,
        "queries": queries,
        "screenshots": screenshots,
        "files": files,
        "demo": sample,
    }

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    target = DATA_DIR / "project.js"
    target.write_text(
        "/* Generated by docs/tools/build_website.py - do not edit by hand. */\n"
        "window.HMS = " + json.dumps(payload, indent=1) + ";\n",
        encoding="utf-8")
    print(f"  {target.relative_to(SITE)} ({target.stat().st_size / 1024:.0f} KB)")

    build_report()

    total = sum(1 for _ in SITE.rglob("*") if _.is_file())
    print(f"Done. {total} files in website/")


if __name__ == "__main__":
    main()
