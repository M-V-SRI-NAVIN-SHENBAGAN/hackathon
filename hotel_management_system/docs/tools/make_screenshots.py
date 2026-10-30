"""
make_screenshots.py
===================
Creates the screenshots used in the project report.

For every screenshot the script
    1. resets the database with sql/01_schema.sql + sql/02_sample_data.sql,
    2. runs app/main.py with a scripted sequence of keystrokes,
    3. crops the interesting part of the console output,
    4. renders it as a terminal-style PNG in docs/screenshots/.

The screenshots therefore show genuine program output, not mock-ups.

Run (from the hotel_management_system folder):
    export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hotel_db
    python docs/tools/make_screenshots.py

Optional environment variables:
    PSQL_BIN   path to the psql executable (default: psql)
    PYTHON_BIN python interpreter that has psycopg2 (default: sys.executable)
"""

import os
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent.parent      # hotel_management_system/
APP_DIR = ROOT / "app"
SQL_DIR = ROOT / "sql"
OUT_DIR = ROOT / "docs" / "screenshots"

PSQL = os.environ.get("PSQL_BIN", "psql")
PYTHON = os.environ.get("PYTHON_BIN", sys.executable)

FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"

FONT_SIZE = 15
LINE_HEIGHT = 21
PADDING = 22
BG = "#101722"
FG = "#e6edf3"
TITLE_BG = "#1f6feb"
WIDTH_CHARS = 118          # crop very long lines to keep images readable


# ----------------------------------------------------------------------
# Database helpers
# ----------------------------------------------------------------------
def database_url() -> str:
    url = os.environ.get("DATABASE_URL")
    if url:
        return url
    return ("postgresql://{user}:{password}@{host}:{port}/{db}".format(
        user=os.environ.get("DB_USER", "postgres"),
        password=os.environ.get("DB_PASSWORD", "postgres"),
        host=os.environ.get("DB_HOST", "localhost"),
        port=os.environ.get("DB_PORT", "5432"),
        db=os.environ.get("DB_NAME", "hotel_db")))


def reset_database():
    """Recreate the schema and reload the sample data with psql."""
    for script in ("01_schema.sql", "02_sample_data.sql"):
        result = subprocess.run(
            [PSQL, database_url(), "-q", "-v", "ON_ERROR_STOP=1",
             "-f", str(SQL_DIR / script)],
            capture_output=True, text=True)
        if result.returncode != 0:
            raise SystemExit(f"psql failed on {script}:\n{result.stderr}")


def run_app(keys: str) -> str:
    """Feed `keys` to the application and return what was printed."""
    env = dict(os.environ, DATABASE_URL=database_url())
    result = subprocess.run(
        [PYTHON, "main.py"], cwd=APP_DIR, input=keys,
        capture_output=True, text=True, env=env)
    output = result.stdout
    if result.returncode != 0:
        output += "\n" + result.stderr
    return output


# ----------------------------------------------------------------------
# Cropping and rendering
# ----------------------------------------------------------------------
def crop(lines, start_marker=None, end_marker=None, keep_header=False,
         use_last=False):
    """Keep the lines between two markers (markers included)."""
    text = "\n".join(lines)
    if start_marker:
        index = (text.rfind(start_marker) if use_last
                 else text.find(start_marker))
        if index == -1:
            raise SystemExit(f"marker not found in output: {start_marker!r}")
        text = text[index:]
    if end_marker:
        index = text.find(end_marker)
        if index != -1:
            # keep the whole line that contains the end marker
            line_end = text.find("\n", index)
            text = text[:line_end if line_end != -1 else len(text)]
    cleaned = [line.rstrip() for line in text.splitlines()]
    # remove leading/trailing empty lines
    while cleaned and not cleaned[0].strip():
        cleaned.pop(0)
    while cleaned and not cleaned[-1].strip():
        cleaned.pop()
    if not keep_header:
        # drop the "Press ENTER to continue..." prompt line
        cleaned = [line for line in cleaned
                   if not line.startswith("Press ENTER to continue")]
    return cleaned


def render(lines, title, path: Path):
    lines = [line[:WIDTH_CHARS] for line in lines]
    font = ImageFont.truetype(FONT_PATH, FONT_SIZE)
    bold = ImageFont.truetype(FONT_BOLD, FONT_SIZE)

    width = max(max((font.getlength(line) for line in lines), default=600), 700)
    width = int(width) + PADDING * 2
    height = LINE_HEIGHT * len(lines) + PADDING * 2 + 34

    image = Image.new("RGB", (width, height), BG)
    draw = ImageDraw.Draw(image)

    # window title bar
    draw.rectangle([0, 0, width, 30], fill="#1c2533")
    for i, colour in enumerate(("#ff5f56", "#ffbd2e", "#27c93f")):
        draw.ellipse([14 + i * 20, 10, 26 + i * 20, 22], fill=colour)
    draw.text((width - PADDING, 7), title, font=bold, fill="#8b98a5",
              anchor="ra")

    y = 34 + PADDING - 6
    for line in lines:
        colour = FG
        stripped = line.strip()
        if stripped.startswith("[SUCCESS]"):
            colour = "#7ee787"
        elif stripped.startswith("[ERROR]"):
            colour = "#ff7b72"
        elif stripped.startswith("[WARNING]"):
            colour = "#e3b341"
        elif stripped.startswith("[INFO]"):
            colour = "#79c0ff"
        elif set(stripped) == {"="} and stripped:
            colour = "#58a6ff"
        elif set(stripped) == {"-"} and stripped:
            colour = "#6e7681"
        draw.text((PADDING, y), line, font=font, fill=colour)
        y += LINE_HEIGHT

    image.save(path)
    print(f"  saved {path.relative_to(ROOT)}  ({len(lines)} lines)")


# ----------------------------------------------------------------------
# The screenshots
# ----------------------------------------------------------------------
MAIN_MENU = "MAIN MENU"
CHOICE = "Enter your choice"

SCENARIOS = [
    # name, title, keystrokes, start marker, end marker, template
    dict(name="01_main_menu",
         title="Hotel Management System - main menu",
         keys="0\n",
         start="HOTEL MANAGEMENT SYSTEM",
         end=None,
         template="output"),

    dict(name="02_add_customer",
         title="Customer Management > Add new customer",
         keys=("1\n1\nAarav Krishnan\naarav.krishnan@example.com\n"
               "9876500011\n15, Beach Road, Chennai\nAadhaar\n"
               "AAD777777777\n\n0\n0\n"),
         start="ADD NEW CUSTOMER",
         end="Registered on",
         template="output"),

    dict(name="03_view_customers",
         title="Customer Management > View all customers",
         keys="1\n2\n\n0\n0\n",
         start="ALL CUSTOMERS",
         end="Total customers registered: 12",
         template="output"),

    dict(name="04_search_customer",
         title="Customer Management > Search customer",
         keys="1\n3\nPriya\n\n0\n0\n",
         start="SEARCH CUSTOMERS",
         end="Total bookings",
         template="output"),

    dict(name="05_room_list",
         title="Room Management > View all rooms",
         keys="2\n2\n\n0\n0\n",
         start="ALL ROOMS",
         end="Average tariff",
         template="output"),

    dict(name="06_room_tariff",
         title="Room Management > Tariff and availability by room type",
         keys="2\n4\n\n0\n0\n",
         start="TARIFF AND AVAILABILITY BY ROOM TYPE",
         end=None,
         template="output"),

    dict(name="07_check_availability",
         title="Reservation > Check room availability",
         keys="3\n2\n2026-12-01\n2026-12-03\n\n0\n0\n",
         start="CHECK ROOM AVAILABILITY",
         end="do not block a room.",
         template="output"),

    dict(name="08_book_room",
         title="Reservation > Book a room",
         keys=("3\n1\nKarthik Raj\n2026-12-01\n2026-12-04\n2\n13\ny\n\n0\n0\n"),
         start="BOOK A ROOM",
         end="to record the money received.",
         template="output"),

    dict(name="09_view_reservation",
         title="Reservation > View one reservation with payment",
         keys="3\n4\n7\n\n0\n0\n",
         start="RESERVATION DETAILS",
         end="Reference",
         template="output"),

    dict(name="10_check_in",
         title="Check-in / Check-out > Record check-in",
         keys="4\n1\n15\ny\ny\nCash\ny\n\n0\n0\n",
         start="RECORD CUSTOMER CHECK-IN",
         end="Reference",
         template="output"),

    dict(name="11_check_out",
         title="Check-in / Check-out > Record check-out",
         # check-in first so that check-out has a real guest to release
         keys="4\n1\n15\ny\ny\nCash\ny\n4\n2\n15\ny\n\n0\n0\n",
         start="RECORD CUSTOMER CHECK-OUT",
         end="Reservation status  : CheckedOut",
         use_last=True,
         template="output"),

    dict(name="12_payment_pending",
         title="Payment Management > Pending payments",
         keys="5\n3\n\n0\n0\n",
         start="PAYMENTS STILL PENDING",
         end="Outstanding amount",
         template="output"),

    dict(name="13_record_payment",
         title="Payment Management > Record a payment",
         keys="5\n1\n6\nCard\nTXN99887766\ny\n\n0\n0\n",
         start="RECORD A PAYMENT",
         end="Reference        : TXN99887766",
         template="output"),

    dict(name="14_report_all_reservations",
         title="Reports > All reservations",
         keys="6\n1\n\n0\n0\n",
         start="REPORT 1: ALL RESERVATIONS",
         end="Booking value",
         template="output"),

    dict(name="15_report_occupied_rooms",
         title="Reports > Currently occupied rooms",
         keys="6\n2\n\n0\n0\n",
         start="REPORT 2: CURRENTLY OCCUPIED ROOMS",
         end="Occupancy:",
         template="output"),

    dict(name="16_report_customer_history",
         title="Reports > Customer booking history",
         keys="6\n4\n\n0\n0\n",
         start="REPORT 4: CUSTOMER BOOKING HISTORY",
         end=None,
         template="output"),

    dict(name="17_report_revenue",
         title="Reports > Total hotel revenue",
         keys="6\n6\n\n0\n0\n",
         start="REPORT 5: TOTAL HOTEL REVENUE",
         end="Refunded amount",
         template="output"),

    dict(name="18_report_popular_room_type",
         title="Reports > Most frequently booked room type",
         keys="6\n7\n\n0\n0\n",
         start="REPORT 6: MOST FREQUENTLY BOOKED ROOM TYPE",
         end="confirmed bookings)",
         template="output"),

    dict(name="19_sql_queries",
         title="SQL demonstration - psql output (part 1)",
         keys=None,          # filled by the SQL template
         start=None, end=None, template="sql"),
]

SQL_SHOTS = [
    dict(name="19_sql_tables_and_aggregates",
         title="psql - table structure and aggregate queries",
         sql="""
\\echo '--- Structure of the reservation table (information_schema) ---'
SELECT ordinal_position AS pos, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'reservation'
ORDER BY ordinal_position;
\\echo '--- Constraints of the reservation table ---'
SELECT conname AS constraint_name, contype AS type
FROM pg_constraint
WHERE conrelid = 'reservation'::regclass
ORDER BY contype, conname;
\\echo '--- Aggregate functions (Q11, Q12) ---'
SELECT COUNT(*) AS rooms, MIN(price_per_night) AS min_price,
       MAX(price_per_night) AS max_price,
       ROUND(AVG(price_per_night),2) AS avg_price,
       SUM(price_per_night) AS total_tariff
FROM room;
SELECT COUNT(*) AS paid_transactions, SUM(amount) AS total_revenue,
       ROUND(AVG(amount),2) AS average_payment
FROM payment WHERE payment_status = 'Paid';
"""),
    dict(name="20_sql_groupby_having",
         title="psql - GROUP BY, HAVING and joins",
         sql="""
\\echo '--- GROUP BY + HAVING (Q13, Q14) ---'
SELECT room_type, COUNT(*) AS rooms, ROUND(AVG(price_per_night),2) AS avg_price
FROM room GROUP BY room_type
HAVING COUNT(*) >= 3 AND AVG(price_per_night) > 3000
ORDER BY avg_price DESC;
\\echo '--- INNER JOIN: reservations with guest and room (Q18) ---'
SELECT r.reservation_id, c.full_name, rm.room_number, r.check_in_date,
       r.check_out_date, r.total_amount, r.status
FROM reservation r
INNER JOIN customer c ON c.customer_id = r.customer_id
INNER JOIN room rm ON rm.room_id = r.room_id
ORDER BY r.reservation_id LIMIT 8;
"""),
    dict(name="21_sql_leftjoin_subquery",
         title="psql - LEFT JOIN, subquery and view",
         sql="""
\\echo '--- LEFT JOIN: every customer with booking count (Q20) ---'
SELECT c.customer_id, c.full_name, COUNT(r.reservation_id) AS bookings
FROM customer c
LEFT JOIN reservation r ON r.customer_id = c.customer_id
GROUP BY c.customer_id, c.full_name
ORDER BY bookings DESC, c.customer_id LIMIT 8;
\\echo '--- Subquery in FROM: most booked room type (Q26) ---'
SELECT room_type, times_booked FROM (
    SELECT rm.room_type, COUNT(*) AS times_booked
    FROM reservation r INNER JOIN room rm ON rm.room_id = r.room_id
    WHERE r.status <> 'Cancelled' GROUP BY rm.room_type) AS bc
ORDER BY times_booked DESC LIMIT 1;
\\echo '--- View: vw_hotel_revenue ---'
SELECT * FROM vw_hotel_revenue;
"""),
]


def run_sql(script: str) -> str:
    """Execute a psql snippet (written to a temp file) and return its output."""
    import tempfile

    with tempfile.NamedTemporaryFile("w", suffix=".sql", delete=False) as handle:
        handle.write(script)
        snippet = handle.name

    result = subprocess.run(
        [PSQL, database_url(), "-q", "-v", "ON_ERROR_STOP=1", "-f", snippet],
        capture_output=True, text=True)
    Path(snippet).unlink(missing_ok=True)
    if result.returncode != 0:
        raise SystemExit(f"psql failed:\n{result.stderr}")
    return result.stdout


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print("Generating screenshots from real program runs...")

    session_log = []
    for scenario in SCENARIOS:
        if scenario["template"] == "sql":
            continue
        print(f"[{scenario['name']}]")
        reset_database()
        output = run_app(scenario["keys"])
        session_log.append(f"### {scenario['title']}\n{output}")
        lines = crop(output.splitlines(), scenario["start"], scenario["end"],
                     use_last=scenario.get("use_last", False))
        render(lines, scenario["title"], OUT_DIR / f"{scenario['name']}.png")

    # SQL screenshots share one freshly reset database.
    reset_database()
    for shot in SQL_SHOTS:
        print(f"[{shot['name']}]")
        output = run_sql(shot["sql"])
        lines = [line for line in output.splitlines()]
        while lines and not lines[0].strip():
            lines.pop(0)
        while lines and not lines[-1].strip():
            lines.pop()
        render(lines, shot["title"], OUT_DIR / f"{shot['name']}.png")

    # A text version of one complete demo session (handy for the report).
    log_path = ROOT / "docs" / "SAMPLE_RUN_OUTPUT.txt"
    log_path.write_text("\n\n".join(session_log), encoding="utf-8")
    print(f"\nWritten {log_path.relative_to(ROOT)}")
    print(f"Total screenshots: {len(list(OUT_DIR.glob('*.png')))}")


if __name__ == "__main__":
    main()
