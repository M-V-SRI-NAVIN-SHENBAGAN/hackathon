# Hotel Management System — Database Systems (DBS) Mini Project

A complete, beginner-friendly hotel front-desk application built with
**Python 3 + PostgreSQL + psycopg2**. Data lives in a normalized (3NF)
PostgreSQL database; the program is a simple menu-driven console application
that performs real database operations for customers, rooms, reservations,
check-in/check-out, payments and reports.

```
hotel_management_system/
├── sql/      database creation, schema, sample data, demonstration queries
├── app/      the Python application (one file per module)
└── docs/     project report, ER diagram, screenshots, helper scripts
```

---

## 1. What the project contains

| Requirement | Where |
|---|---|
| Database design (4 tables, PK/FK/NOT NULL/UNIQUE/CHECK) | `sql/01_schema.sql` |
| ER diagram | `docs/ER_DIAGRAM.png` (and `.svg`) |
| Relational schema, normalization, notes | `docs/PROJECT_REPORT.md` §9–§10 |
| 34 SQL queries (WHERE, ORDER BY, all aggregates, GROUP BY, HAVING, INNER/LEFT JOIN, subqueries, views) | `sql/03_queries.sql` |
| Sample data (12 customers, 14 rooms, 16 reservations, 16 payments) | `sql/02_sample_data.sql` |
| Menu-driven Python application with 6 modules | `app/main.py` + module files |
| Project report (Markdown + Word) | `docs/PROJECT_REPORT.md`, `docs/PROJECT_REPORT.docx` |
| Screenshots of every module | `docs/screenshots/` (21 images) |
| Demonstration script for the viva | `docs/PROJECT_REPORT.md`, Appendix B |

---

## 2. Requirements

* PostgreSQL 14 or newer (tested on 16) — server running locally
* Python 3.10 or newer
* `psycopg2` driver: `pip install psycopg2-binary`

Nothing else — no Django/Flask/Tkinter, no external libraries.

---

## 3. Setup (5 commands)

```bash
# 1. create the database (creates hotel_db)
psql -U postgres -f sql/00_create_database.sql

# 2. create tables, constraints, indexes and views
psql -U postgres -d hotel_db -f sql/01_schema.sql

# 3. load the sample data
psql -U postgres -d hotel_db -f sql/02_sample_data.sql

# 4. configure the connection (put your own PostgreSQL password in .env)
cp .env.example .env        # Windows: copy .env.example .env

# 5. start the application
cd app && python main.py
```

Optional: run every demonstration query and see its output —

```bash
psql -U postgres -d hotel_db -f sql/03_queries.sql
```

> On Windows, if `psql` is not on `PATH`, use the full path, e.g.
> `"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -f sql/00_create_database.sql`.
> Use `py main.py` if `python` is not recognised.

### Connection settings

`app/config.py` reads these keys from `.env` (or from environment
variables, or a single `DATABASE_URL`):

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hotel_db
DB_USER=postgres
DB_PASSWORD=postgres
```

No password is hard-coded in the Python sources.

---

## 4. Main menu

```
  1. Customer Management      add / view / search / update / delete customers
  2. Room Management          add / view rooms, tariff by category, update status
  3. Reservation Management   book, check availability, view, cancel
  4. Check-in / Check-out     check-in, check-out, today's arrivals/departures
  5. Payment Management       record payment, view, pending list, refund
  6. Reports and Search       reservations, occupied/available rooms, history,
                              revenue, most booked room type, occupancy, search
  7. Database information     connection details and row counts
  0. Exit
```

Every prompt accepts `q` (or ENTER on an empty prompt) to cancel the current
operation and return safely to the menu.

---

## 5. Database at a glance

| Table | Primary key | Foreign keys | Highlights |
|---|---|---|---|
| `customer` | `customer_id` | — | `UNIQUE` email/phone/ID number, `CHECK` on name, e-mail, 10-digit phone |
| `room` | `room_id` | — | `UNIQUE` room number, `CHECK` on type/price/occupancy/status |
| `reservation` | `reservation_id` | `customer_id` → customer, `room_id` → room | `CHECK (check_out_date > check_in_date)`, status life cycle |
| `payment` | `payment_id` | `reservation_id` → reservation | `UNIQUE` (one payment per reservation), Cash/Card/UPI, Pending/Paid/Refunded |

Five views: `vw_reservation_details`, `vw_room_current_status`,
`vw_payment_details`, `vw_customer_booking_history`, `vw_hotel_revenue`.

### How double booking is prevented

A room is offered only when **no** active reservation overlaps the requested
stay:

```sql
existing.check_in_date < requested_check_out
AND existing.check_out_date > requested_check_in
AND existing.status IN ('Booked', 'CheckedIn')
```

Cancelled reservations are ignored, so cancelling a booking frees the room
automatically.

### How the bill is calculated

```
total_amount = (check_out_date - check_in_date) * room.price_per_night
```

The amount is shown for confirmation before the reservation is saved, and it
is stored so that old bills do not change when a tariff changes later.

---

## 6. Application structure

| File | Purpose |
|---|---|
| `app/main.py` | banner, connection test, main menu, top-level error handling |
| `app/config.py` | reads `.env` / environment variables |
| `app/db.py` | psycopg2 wrapper: parameterized queries, transactions, readable errors |
| `app/ui.py` | table rendering, messages, validated input helpers |
| `app/customers.py` | module 1 — customer management |
| `app/rooms.py` | module 2 — room management + date-wise availability query |
| `app/reservations.py` | module 3 — booking, availability, cancellation |
| `app/frontdesk.py` | module 4 — check-in / check-out (transactions) |
| `app/payments.py` | module 5 — payments, refunds, pending list |
| `app/reports.py` | module 6 — reports and search |

---

## 7. Regenerating the documentation (optional)

Only needed if you change the schema or the program output. Requires
`matplotlib`, `pillow` and `python-docx`.

```bash
python docs/tools/make_er_diagram.py     # docs/ER_DIAGRAM.png / .svg
python docs/tools/make_screenshots.py    # docs/screenshots/*.png  (needs psql on PATH)
python docs/tools/make_report_docx.py    # docs/PROJECT_REPORT.docx
```

`make_screenshots.py` **reloads the sample data** before every screenshot, so
run it on a demo copy of the database if you have entered your own data.

---

## 8. Troubleshooting

| Message | Fix |
|---|---|
| `Could not connect to PostgreSQL` | Is the PostgreSQL service running? Is the password in `.env` correct? Does `hotel_db` exist? |
| `A table is missing…` | Run `sql/01_schema.sql` and `sql/02_sample_data.sql`. |
| `psql: command not found` | Add the PostgreSQL `bin` folder to `PATH` or use the full path. |
| Duplicate key on `INSERT` | The table already holds that e-mail / phone / room number / ID number (`UNIQUE` constraint working as intended). |
| `ModuleNotFoundError: psycopg2` | `pip install psycopg2-binary` (use the same Python that runs `main.py`). |

---

## 9. Documentation

* `docs/PROJECT_REPORT.md` / `docs/PROJECT_REPORT.docx` — full report:
  abstract, problem statement, objectives, existing vs proposed system,
  hardware/software requirements, modules, database design, ER diagram,
  relational schema, normalization, SQL commands with expected output,
  implementation notes, screenshots, results, conclusion, setup steps and
  the demonstration sequence.
* `docs/SAMPLE_RUN_OUTPUT.txt` — plain-text transcript of one demo session.
