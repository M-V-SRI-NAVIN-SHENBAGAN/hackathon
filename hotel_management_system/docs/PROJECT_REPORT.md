# HOTEL MANAGEMENT SYSTEM

### A Database Systems (DBS) Mini Project

**Technology stack:** Python 3 · PostgreSQL · psycopg2

---

| | |
|---|---|
| **Project title** | Hotel Management System (HMS) — a database-driven front-desk application |
| **Subject** | Database Systems (DBS) — Mini Project |
| **Course** | B.E. Computer Science and Engineering (2nd year) |
| **Student name** | ________________________________ |
| **Register number** | ________________________________ |
| **Class / Section** | ________________________________ |
| **Faculty in-charge** | ________________________________ |
| **Academic year** | 2026 – 2027 |
| **Date of submission** | ________________________________ |

---

## Table of contents

1. [Abstract](#1-abstract)
2. [Problem statement](#2-problem-statement)
3. [Objectives](#3-objectives)
4. [Existing system and proposed system](#4-existing-system-and-proposed-system)
5. [Hardware and software requirements](#5-hardware-and-software-requirements)
6. [Description of functional modules](#6-description-of-functional-modules)
7. [Database design](#7-database-design)
8. [ER diagram](#8-er-diagram)
9. [Relational schema](#9-relational-schema)
10. [Normalization](#10-normalization)
11. [SQL commands and queries](#11-sql-commands-and-queries)
12. [Application implementation](#12-application-implementation)
13. [Screenshots and sample outputs](#13-screenshots-and-sample-outputs)
14. [Results and observations](#14-results-and-observations)
15. [Conclusion](#15-conclusion)
16. [Appendix A — How to create the database and run the project](#appendix-a--how-to-create-the-database-and-run-the-project)
17. [Appendix B — Demonstration sequence](#appendix-b--demonstration-sequence)
18. [Appendix C — Project file structure](#appendix-c--project-file-structure)

---

## 1. Abstract

Hotels still lose money and time because room bookings, guest records,
check-ins, check-outs and payments are maintained in separate paper
registers and spreadsheets. The same room gets allotted twice, the bill of
a guest is calculated by hand, and management has no quick answer to
questions such as *"How much revenue did we collect this month?"* or
*"Which room type is booked the most?"*

This mini project, **Hotel Management System**, solves these problems with
a small, complete, database-driven desktop application. All data is stored
in a **PostgreSQL** relational database consisting of four normalized
tables — `customer`, `room`, `reservation` and `payment` — protected by
primary keys, foreign keys, `NOT NULL`, `UNIQUE`, `CHECK` constraints and
referential-integrity rules. The front desk staff use a **menu-driven
Python application** that talks to PostgreSQL through `psycopg2` and
performs real `INSERT`, `SELECT`, `UPDATE` and `DELETE` operations using
parameterized queries.

The system covers six functional modules: customer management, room
management, reservation management, check-in/check-out, payment management
and reports. Room availability is calculated date-wise from the reservation
table, the booking amount is computed automatically as *number of nights ×
room price*, and check-in/check-out update the reservation **and** the room
in one atomic transaction. Five SQL views and thirty-four demonstration
queries (joins, subqueries, aggregates, `GROUP BY`, `HAVING`, `ORDER BY`)
provide the reports needed by the management.

The result is a working, easy-to-understand mini project in which the ER
diagram, the relational schema, the SQL scripts and the Python code all
describe exactly the same database.

**Keywords:** hotel management, relational database, PostgreSQL, psycopg2,
normalization, ER model, constraints, transactions.

---

## 2. Problem statement

A small hotel (about 10–30 rooms) records everything manually:

* Guest details are written in a register. Searching an old guest means
  turning pages for several minutes.
* Room allotment is decided by looking at a whiteboard, so the same room is
  sometimes given to two guests for overlapping dates.
* The bill is calculated by hand, so arithmetic mistakes happen and the
  amount is sometimes not recorded against the guest at all.
* Payment details (cash / card / UPI) are kept in a separate cash book, so
  the reception cannot say whether a guest has paid.
* At the end of the month the manager has to add up pages of the register
  to find the revenue or the most popular room type.

**Problem statement:** *Design and implement a database-backed Hotel
Management System that stores customer, room, reservation and payment data
in a normalized relational database, prevents duplicate bookings,
calculates bills automatically, records check-in/check-out and payments,
and produces the management reports instantly — while remaining simple
enough to be understood and demonstrated by a second-year CSE student.*

---

## 3. Objectives

1. Design an ER model and a normalized (up to 3NF) relational schema for a
   hotel front-desk system.
2. Implement the schema in PostgreSQL with all necessary integrity
   constraints (`PRIMARY KEY`, `FOREIGN KEY`, `NOT NULL`, `UNIQUE`,
   `CHECK`, `ON DELETE` rules).
3. Build a beginner-friendly, menu-driven Python application using
   `psycopg2` that performs real database operations for every module.
4. Automate the calculation of the total booking amount
   (`nights × price per night`).
5. Prevent double booking by checking date-wise room availability before a
   reservation is stored.
6. Record check-in, check-out and payments, keeping the reservation status
   and room status consistent in a single transaction.
7. Demonstrate the SQL concepts required by the syllabus — `CREATE TABLE`,
   `INSERT`, `UPDATE`, `DELETE`, `SELECT … WHERE`, `ORDER BY`, aggregate
   functions, `GROUP BY`, `HAVING`, `INNER JOIN`, `LEFT JOIN`, subqueries
   and views — with realistic sample data and their actual output.
8. Produce complete documentation: ER diagram, relational schema,
   normalization notes, screenshots and a demonstration script.

---

## 4. Existing system and proposed system

### 4.1 Existing (manual) system

| Area | How it works today | Problem |
|---|---|---|
| Guest records | Paper register | Slow search, torn pages, no backup |
| Room allotment | Whiteboard / memory | Double booking, no date-wise check |
| Billing | Manual calculation | Arithmetic errors, no history |
| Payments | Separate cash book | Payment status of a guest unknown |
| Reports | Manual counting | Takes hours, often inaccurate |
| Security | Anyone can read the register | No controlled access |

### 4.2 Proposed (computerised) system

| Area | How the new system works | Benefit |
|---|---|---|
| Guest records | `customer` table with `UNIQUE` email, phone and ID number | Instant search, no duplicates |
| Room allotment | Availability query on `reservation` for the chosen dates | No double booking |
| Billing | `total_amount` computed by the application and stored | Accurate, reproducible bills |
| Payments | `payment` table with method and status | Payment status always visible |
| Reports | SQL aggregates and views | Instant, accurate reports |
| Integrity | Primary keys, foreign keys, `CHECK` constraints | Invalid data rejected by the database itself |

**Advantages of the proposed system**

* Single source of truth — one PostgreSQL database for all modules.
* Data integrity enforced by the DBMS, not only by the program.
* Availability and revenue reports are produced in milliseconds.
* The application uses parameterized queries, so SQL injection is avoided.
* Check-in / check-out are atomic: the reservation and the room can never
  disagree.

---

## 5. Hardware and software requirements

### 5.1 Hardware requirements

| Component | Minimum | Recommended |
|---|---|---|
| Processor | Intel Core i3 (2 GHz) | Intel Core i5 or better |
| RAM | 4 GB | 8 GB |
| Free disk space | 500 MB (PostgreSQL + Python) | 2 GB |
| Display | 1366 × 768 | 1920 × 1080 |
| Network | Not required (single PC demo) | LAN if multiple counters share one database server |

### 5.2 Software requirements

| Software | Version used | Purpose |
|---|---|---|
| Operating system | Windows 10/11, Ubuntu 22.04+ or macOS | Run the project |
| PostgreSQL | 16 (14 or later works) | Relational database server |
| pgAdmin 4 *or* `psql` | Any recent version | Create the database, run SQL scripts |
| Python | 3.10 or later (3.11 used) | Application language |
| psycopg2 | `psycopg2-binary` 2.9.x | PostgreSQL driver for Python |
| Terminal / Command Prompt | Built in | Run `python main.py` |
| Text editor / VS Code | Any | Edit the source code |

No external Python framework (Django, Flask, Tkinter, pandas, …) is used.
The project needs **only** the Python standard library plus `psycopg2`, which
keeps it beginner-friendly.

---

## 6. Description of functional modules

The application has a main menu with six functional modules. Each module
has its own sub-menu and calls the functions of one Python file.

### 6.1 Customer management (`app/customers.py`)

| Operation | SQL used |
|---|---|
| Add a customer | `INSERT INTO customer … RETURNING customer_id` |
| View all customers | `SELECT … ORDER BY customer_id` |
| Search by ID / name / phone | `SELECT … WHERE customer_id = %s OR phone = %s OR LOWER(full_name) LIKE %s` |
| Update details | `UPDATE customer SET … WHERE customer_id = %s` |
| Delete a customer | `DELETE FROM customer WHERE customer_id = %s` |

The program validates the e-mail format, the 10-digit phone number and the
ID-proof type before contacting the database. A customer who already has
reservations cannot be deleted — the foreign key from `reservation`
(`ON DELETE RESTRICT`) protects referential integrity, and the program
explains this to the user instead of showing an SQL error.

### 6.2 Room management (`app/rooms.py`)

* Add a room (room number, category, floor, price per night, maximum guests,
  initial status).
* Display all rooms and the tariff of every category (with `GROUP BY`).
* Display currently available rooms.
* Update a room's details or status (`Available`, `Occupied`,
  `Maintenance`). A room with a checked-in guest cannot be set to
  `Available`.
* Availability **for a date range** is computed in the reservation module by
  looking for overlapping reservations — this is the correct way, because a
  room can be sold today and free next week.

### 6.3 Reservation management (`app/reservations.py`)

* **Book a room:** choose the customer (search by name/phone/ID), choose
  check-in and check-out dates and the number of guests, then the system
  lists only the rooms that are free for those dates and can hold the party.
* **Availability check:** `NOT EXISTS` sub-query over `reservation` with the
  overlap test `existing.check_in < wanted.check_out AND
  existing.check_out > wanted.check_in`, ignoring cancelled bookings and
  rooms under maintenance.
* **Bill calculation:** `total_amount = (check_out − check_in) × price_per_night`,
  shown to the user for confirmation before saving.
* A `payment` row with status `Pending` is inserted in the same flow, so the
  payment module always has a record to work on.
* View all reservations (filtered by status or customer), view one
  reservation with its payment, and cancel a reservation (only a `Booked`
  reservation can be cancelled; a refundable amount is marked `Refunded`).

### 6.4 Check-in and check-out management (`app/frontdesk.py`)

| Operation | Reservation status | Room status |
|---|---|---|
| Check-in | `Booked` → `CheckedIn`, `actual_check_in` set | `Available` → `Occupied` |
| Check-out | `CheckedIn` → `CheckedOut`, `actual_check_out` set | `Occupied` → `Available` |

Both statements are executed inside **one transaction**
(`db.run_in_transaction`). If the second `UPDATE` fails, the first is rolled
back, so the database can never end up with a guest inside a "free" room.
The module also lists today's expected arrivals and departures, and offers
to collect the payment during check-out.

### 6.5 Payment management (`app/payments.py`)

* Record a payment against a reservation (method **Cash / Card / UPI**,
  optional transaction reference).
* Change the payment status from `Pending` to `Paid`, or mark a paid amount
  as `Refunded`.
* Display payment details, including a filter for pending payments and the
  outstanding amount.

### 6.6 Reports and search (`app/reports.py`)

1. All reservations (with customer, room, payment status).
2. Currently occupied rooms and the guests staying in them (occupancy %).
3. Rooms available right now.
4. Customer booking history (bookings, completed stays, cancellations,
   money spent) — all customers or one selected customer.
5. Total hotel revenue — overall, by payment method and by month, plus the
   pending and refunded amounts.
6. Most frequently booked room type.
7. Room-status / occupancy summary and per-room-type performance.
8. Search reservations by customer, by date or by status.

---

## 7. Database design

**Database name:** `hotel_db`  
**Schema scripts:** `sql/01_schema.sql` (tables, constraints, indexes, views),
`sql/02_sample_data.sql` (sample data).

### 7.1 Entity–relationship summary

| Relationship | Cardinality | Meaning |
|---|---|---|
| CUSTOMER — makes — RESERVATION | 1 : N | One customer can make many reservations; every reservation belongs to exactly one customer. |
| ROOM — booked in — RESERVATION | 1 : N | One room can be booked many times (on different dates); every reservation is for exactly one room. |
| RESERVATION — paid by — PAYMENT | 1 : 1 | Every reservation has at most one payment record (`UNIQUE` on `reservation_id`). |

### 7.2 Table: `customer`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `customer_id` | `SERIAL` | **PRIMARY KEY** | Surrogate key, auto-incremented |
| `full_name` | `VARCHAR(100)` | `NOT NULL`, `CHECK (length ≥ 3)` | Guest name |
| `email` | `VARCHAR(120)` | `NOT NULL`, `UNIQUE`, `CHECK` contains `@` and `.` | Contact e-mail |
| `phone` | `VARCHAR(15)` | `NOT NULL`, `UNIQUE`, `CHECK` 10 digits | Mobile number |
| `address` | `VARCHAR(200)` | — | Postal address (optional) |
| `id_proof_type` | `VARCHAR(20)` | `NOT NULL`, `CHECK IN ('Aadhaar','Passport','Driving Licence','Voter ID')` | Type of government ID |
| `id_proof_number` | `VARCHAR(30)` | `NOT NULL`, `UNIQUE` | ID number |
| `created_at` | `TIMESTAMP` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | Registration time |

### 7.3 Table: `room`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `room_id` | `SERIAL` | **PRIMARY KEY** | Surrogate key |
| `room_number` | `VARCHAR(10)` | `NOT NULL`, `UNIQUE` | Printed room number, e.g. `101` |
| `room_type` | `VARCHAR(20)` | `NOT NULL`, `CHECK IN ('Single','Double','Deluxe','Suite')` | Category |
| `floor_no` | `INTEGER` | `NOT NULL`, `CHECK BETWEEN 0 AND 20` | Floor |
| `price_per_night` | `NUMERIC(10,2)` | `NOT NULL`, `CHECK > 0` | Tariff per night |
| `max_occupancy` | `INTEGER` | `NOT NULL`, `CHECK BETWEEN 1 AND 6` | Maximum guests |
| `status` | `VARCHAR(20)` | `NOT NULL DEFAULT 'Available'`, `CHECK IN ('Available','Occupied','Maintenance')` | Current physical state |
| `created_at` | `TIMESTAMP` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | When the room was added |

### 7.4 Table: `reservation`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `reservation_id` | `SERIAL` | **PRIMARY KEY** | Surrogate key |
| `customer_id` | `INTEGER` | `NOT NULL`, **FOREIGN KEY** → `customer.customer_id` (`ON DELETE RESTRICT`) | Who booked |
| `room_id` | `INTEGER` | `NOT NULL`, **FOREIGN KEY** → `room.room_id` (`ON DELETE RESTRICT`) | Which room |
| `check_in_date` | `DATE` | `NOT NULL` | Planned arrival |
| `check_out_date` | `DATE` | `NOT NULL`, `CHECK (check_out_date > check_in_date)` | Planned departure |
| `booking_date` | `DATE` | `NOT NULL DEFAULT CURRENT_DATE`, `CHECK (booking_date <= check_in_date)` | When the booking was made |
| `num_guests` | `INTEGER` | `NOT NULL`, `CHECK BETWEEN 1 AND 6` | Number of guests |
| `total_amount` | `NUMERIC(10,2)` | `NOT NULL`, `CHECK >= 0` | Bill = nights × room price |
| `status` | `VARCHAR(20)` | `NOT NULL DEFAULT 'Booked'`, `CHECK IN ('Booked','CheckedIn','CheckedOut','Cancelled')` | Reservation life cycle |
| `actual_check_in` | `TIMESTAMP` | `CHECK` not earlier than `check_in_date` | Real arrival time |
| `actual_check_out` | `TIMESTAMP` | `CHECK` not earlier than `actual_check_in` | Real departure time |

### 7.5 Table: `payment`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `payment_id` | `SERIAL` | **PRIMARY KEY** | Surrogate key |
| `reservation_id` | `INTEGER` | `NOT NULL`, **UNIQUE**, **FOREIGN KEY** → `reservation.reservation_id` (`ON DELETE CASCADE`) | One payment per reservation |
| `amount` | `NUMERIC(10,2)` | `NOT NULL`, `CHECK > 0` | Amount collected |
| `payment_method` | `VARCHAR(10)` | `NOT NULL`, `CHECK IN ('Cash','Card','UPI')` | Mode of payment |
| `payment_status` | `VARCHAR(20)` | `NOT NULL DEFAULT 'Pending'`, `CHECK IN ('Pending','Paid','Refunded')` | Payment state |
| `payment_date` | `TIMESTAMP` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | When it was recorded |
| `transaction_ref` | `VARCHAR(40)` | — | Card / UPI reference (optional) |

### 7.6 Supporting objects

* **Indexes** on all foreign keys and on frequently filtered columns
  (`idx_reservation_customer`, `idx_reservation_room`,
  `idx_reservation_status`, `idx_reservation_dates`,
  `idx_payment_status`, `idx_room_type`).
* **Function** `fn_stay_nights(check_in, check_out)` returns the number of
  nights — used by the views and the application.
* **Views** (5): `vw_reservation_details`, `vw_room_current_status`,
  `vw_payment_details`, `vw_customer_booking_history`,
  `vw_hotel_revenue`.

---

## 8. ER diagram

![Entity Relationship Diagram](ER_DIAGRAM.png)

*Figure 8.1 — ER diagram of the Hotel Management System (generated by
`docs/tools/make_er_diagram.py`).*

**Reading the diagram**

* Rectangles are entities; every attribute of the entity is listed inside.
* `PK` marks the primary key (also underlined), `FK` marks a foreign key and
  `UQ` marks a `UNIQUE` attribute.
* Diamonds are relationships, and the `1` / `N` marks give the cardinality.
* `CUSTOMER (1) ── makes ── (N) RESERVATION`: a customer can book many
  times.
* `ROOM (1) ── booked in ── (N) RESERVATION`: a room appears in many
  reservations over time.
* `RESERVATION (1) ── paid by ── (1) PAYMENT`: one payment record per
  reservation (enforced by the `UNIQUE` constraint on
  `payment.reservation_id`).

The diagram matches the implemented schema exactly: the same attribute
names, the same keys and the same optional (`NULL`-able) columns —
`address`, `actual_check_in`, `actual_check_out` and `transaction_ref`.

---

## 9. Relational schema

Notation: **bold** = primary key, *italic* = foreign key,
`[UQ]` = unique, `[NN]` = not null.

```
CUSTOMER (customer_id, full_name, email[UQ], phone[UQ], address,
          id_proof_type, id_proof_number[UQ], created_at)

ROOM     (room_id, room_number[UQ], room_type, floor_no, price_per_night,
          max_occupancy, status, created_at)

RESERVATION (reservation_id, customer_id[FK→CUSTOMER], room_id[FK→ROOM],
             check_in_date, check_out_date, booking_date, num_guests,
             total_amount, status, actual_check_in, actual_check_out)

PAYMENT  (payment_id, reservation_id[FK→RESERVATION][UQ], amount,
          payment_method, payment_status, payment_date, transaction_ref)
```

### 9.1 Key identification

| Table | Primary key | Foreign keys | Other important constraints |
|---|---|---|---|
| `customer` | `customer_id` | — | `email`, `phone`, `id_proof_number` are `UNIQUE` |
| `room` | `room_id` | — | `room_number` is `UNIQUE`; `CHECK` on type, price, occupancy |
| `reservation` | `reservation_id` | `customer_id`, `room_id` | `CHECK (check_out_date > check_in_date)` |
| `payment` | `payment_id` | `reservation_id` | `UNIQUE(reservation_id)`, `CHECK` on method and status |

### 9.2 Referential integrity rules

| Foreign key | On update | On delete | Why |
|---|---|---|---|
| `reservation.customer_id` | `CASCADE` | `RESTRICT` | A customer with bookings must not be deleted; their history stays intact. |
| `reservation.room_id` | `CASCADE` | `RESTRICT` | A booked room cannot be removed from the hotel. |
| `payment.reservation_id` | `CASCADE` | `CASCADE` | If a reservation is removed, its payment record is meaningless and is removed with it. |

The application additionally *checks* these rules and prints a friendly
message before the database has to reject anything.

---

## 10. Normalization

Normalization removes redundancy and update anomalies. The design below is
in **third normal form (3NF)**.

### 10.1 First Normal Form (1NF) — atomic values only

Every column of every table stores a single, indivisible value: no repeating
groups, no comma-separated lists and no multiple phone numbers in one
column. If a guest had two phone numbers, a separate row (a new guest
record) would be needed rather than `"98400…, 98401…"` in one cell.

### 10.2 Second Normal Form (2NF) — no partial dependency

2NF applies to tables with composite primary keys. In this design each table
has a **single-column surrogate key** (`customer_id`, `room_id`,
`reservation_id`, `payment_id`), so *every* non-key attribute depends on the
whole key — there is no partial dependency. Example: in `reservation`,
`total_amount` depends on `check_in_date`, `check_out_date` **and**
`room_id`, all of which are attributes of the same reservation row.

### 10.3 Third Normal Form (3NF) — no transitive dependency

No non-key column depends on another non-key column:

* `price_per_night` is stored **once**, in `room`, not copied into every
  reservation; `reservation.total_amount` is a *derived, stored historical
  value* (the price at the time of booking, needed for old bills) and not a
  copy of a mutable attribute.
* A room's category, floor and tariff are all properties of the room alone,
  so they live in `room`, not in `reservation`.
* The guest's name, phone and e-mail live only in `customer`;
  `payment` contains only payment data and a reference to the reservation,
  instead of repeating the customer's name.
* `payment_status` belongs to `payment`, `status` belongs to `reservation`;
  they are never duplicated in another table.

### 10.4 Decomposition example

An un-normalized booking sheet would look like:

```
BOOKING (customer_name, customer_phone, customer_email, room_no, room_type,
         price, check_in, check_out, nights, total_amount, payment_method,
         payment_status)
```

Problems: the same customer's phone is typed again for every booking (update
anomaly), a new room cannot be recorded without a booking (insert anomaly),
and deleting the last booking of a customer erases the customer (delete
anomaly).

Decomposition:

| New table | Attributes kept |
|---|---|
| `customer` | `customer_id`, `full_name`, `email`, `phone`, `address`, ID proof |
| `room` | `room_id`, `room_number`, `room_type`, `floor_no`, `price_per_night`, `max_occupancy`, `status` |
| `reservation` | `reservation_id`, `customer_id`, `room_id`, dates, `num_guests`, `total_amount`, `status` |
| `payment` | `payment_id`, `reservation_id`, `amount`, method, status, date |

Each relationship that was inside `BOOKING` is now represented by a foreign
key, and the decomposition is **loss-less** because every table can be
re-joined on its primary key.

### 10.5 Why not a separate `room_type` table?

A `room_type(room_type_id, category, default_price)` table would be
"more normalized", but the category list is fixed by a `CHECK` constraint and
the tariff differs per room (room 111 costs 4200 while room 105 costs 4000),
so a separate table would add a join without removing any redundancy. For a
college mini-project the simpler four-table design is correct and still 3NF.

---

## 11. SQL commands and queries

All statements are in `sql/` and were executed on PostgreSQL 16. The complete
output of every query is produced by running
`psql -d hotel_db -f sql/03_queries.sql`.

### 11.1 `CREATE TABLE` (excerpt — full script in `sql/01_schema.sql`)

```sql
CREATE TABLE reservation (
    reservation_id    SERIAL        PRIMARY KEY,
    customer_id       INTEGER       NOT NULL,
    room_id           INTEGER       NOT NULL,
    check_in_date     DATE          NOT NULL,
    check_out_date    DATE          NOT NULL,
    booking_date      DATE          NOT NULL DEFAULT CURRENT_DATE,
    num_guests        INTEGER       NOT NULL CHECK (num_guests BETWEEN 1 AND 6),
    total_amount      NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
    status            VARCHAR(20)   NOT NULL DEFAULT 'Booked'
                      CHECK (status IN ('Booked','CheckedIn','CheckedOut','Cancelled')),
    actual_check_in   TIMESTAMP,
    actual_check_out  TIMESTAMP,

    CONSTRAINT fk_reservation_customer
        FOREIGN KEY (customer_id) REFERENCES customer (customer_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_reservation_room
        FOREIGN KEY (room_id) REFERENCES room (room_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_reservation_dates
        CHECK (check_out_date > check_in_date),
    CONSTRAINT chk_reservation_booking_date
        CHECK (booking_date <= check_in_date)
);
```

### 11.2 `INSERT`, `UPDATE`, `DELETE`

```sql
-- INSERT (Q2): the generated primary key is returned to the caller
INSERT INTO customer (full_name, email, phone, address, id_proof_type, id_proof_number)
VALUES ('Demo Guest', 'demo.guest@example.com', '9000000001',
        '1, Demo Street, Chennai', 'Aadhaar', 'AAD999999999')
RETURNING customer_id, full_name, email, created_at;

-- UPDATE with WHERE (Q3)
UPDATE customer SET address = '2, New Street, Chennai'
WHERE email = 'demo.guest@example.com';

-- DELETE with WHERE (Q4)
DELETE FROM customer WHERE email = 'demo.guest@example.com';
```

Expected output of the `INSERT`: one row with `customer_id = 13`. The
`UPDATE` reports `UPDATE 1`, the `DELETE` reports `DELETE 1`. These three
statements run inside a transaction that is rolled back, so the sample data
stays unchanged.

### 11.3 `SELECT` with `WHERE`, `ORDER BY`, `LIKE`, `BETWEEN`, `LIMIT`

```sql
-- Q5: rooms above 4000, cheapest first
SELECT room_number, room_type, price_per_night, status
FROM room
WHERE price_per_night > 4000
ORDER BY price_per_night;
```

| room_number | room_type | price_per_night | status |
|---|---|---|---|
| 111 | Deluxe | 4200.00 | Available |
| 201 | Deluxe | 4500.00 | Available |
| 107 | Suite | 7500.00 | Occupied |
| 108 | Suite | 7500.00 | Available |
| 112 | Suite | 8000.00 | Occupied |

```sql
-- Q8: what the app's search box runs
SELECT customer_id, full_name, phone, email
FROM customer
WHERE LOWER(full_name) LIKE LOWER('%arjun%') OR phone = '9840012301';
```

| customer_id | full_name | phone | email |
|---|---|---|---|
| 1 | Arjun Kumar | 9840012301 | arjun.kumar@example.com |

### 11.4 Aggregate functions, `GROUP BY`, `HAVING`

```sql
-- Q11: all five aggregate functions on one column
SELECT COUNT(*) AS total_rooms,
       MIN(price_per_night) AS cheapest_room,
       MAX(price_per_night) AS costliest_room,
       ROUND(AVG(price_per_night), 2) AS average_tariff,
       SUM(price_per_night) AS sum_of_tariffs
FROM room;
```

| total_rooms | cheapest_room | costliest_room | average_tariff | sum_of_tariffs |
|---|---|---|---|---|
| 14 | 1500.00 | 8000.00 | 3900.00 | 54600.00 |

```sql
-- Q13 + Q14: per-category statistics, filtered with HAVING
SELECT room_type, COUNT(*) AS rooms,
       ROUND(AVG(price_per_night), 2) AS avg_price,
       MIN(price_per_night) AS min_price,
       MAX(price_per_night) AS max_price
FROM room
GROUP BY room_type
HAVING COUNT(*) >= 3 AND AVG(price_per_night) > 3000
ORDER BY avg_price DESC;
```

| room_type | rooms | avg_price | min_price | max_price |
|---|---|---|---|---|
| Suite | 3 | 7666.67 | 7500.00 | 8000.00 |
| Deluxe | 4 | 4175.00 | 4000.00 | 4500.00 |

```sql
-- Q12: revenue collected
SELECT COUNT(*) AS paid_transactions, SUM(amount) AS total_revenue,
       ROUND(AVG(amount), 2) AS average_payment
FROM payment
WHERE payment_status = 'Paid';
```

| paid_transactions | total_revenue | average_payment |
|---|---|---|
| 9 | 101100.00 | 11233.33 |

### 11.5 Joins

```sql
-- Q18: INNER JOIN of three tables
SELECT r.reservation_id, c.full_name, rm.room_number, rm.room_type,
       r.check_in_date, r.check_out_date, r.total_amount, r.status
FROM reservation r
INNER JOIN customer c ON c.customer_id = r.customer_id
INNER JOIN room     rm ON rm.room_id    = r.room_id
ORDER BY r.reservation_id;
```

First rows of the result (16 rows in total):

| reservation_id | full_name | room_number | room_type | check_in_date | check_out_date | total_amount | status |
|---|---|---|---|---|---|---|---|
| 1 | Arjun Kumar | 102 | Single | 2026-10-28 | 2026-11-01 | 6000.00 | CheckedIn |
| 2 | Priya Raman | 104 | Double | 2026-10-29 | 2026-11-02 | 10000.00 | CheckedIn |
| 3 | Rahul Sharma | 107 | Suite | 2026-10-27 | 2026-10-31 | 30000.00 | CheckedIn |
| 4 | Sneha Iyer | 202 | Double | 2026-10-26 | 2026-11-01 | 16200.00 | CheckedIn |

```sql
-- Q20: LEFT JOIN keeps customers who never booked
SELECT c.customer_id, c.full_name,
       COUNT(r.reservation_id) AS bookings,
       COALESCE(SUM(r.total_amount), 0) AS booking_value
FROM customer c
LEFT JOIN reservation r ON r.customer_id = c.customer_id
GROUP BY c.customer_id, c.full_name
ORDER BY bookings DESC, c.customer_id;
```

```sql
-- Q21: LEFT JOIN room -> reservation shows the never-booked room
SELECT rm.room_id, rm.room_number, rm.room_type,
       COUNT(r.reservation_id) FILTER (WHERE r.status <> 'Cancelled')
                                 AS confirmed_bookings
FROM room rm
LEFT JOIN reservation r ON r.room_id = rm.room_id
GROUP BY rm.room_id, rm.room_number, rm.room_type
ORDER BY rm.room_id;
```

Room `110` (Double, under maintenance) appears with `0` bookings, which an
`INNER JOIN` would have hidden.

### 11.6 Subqueries

```sql
-- Q24: scalar subquery — rooms above the average price
SELECT room_number, room_type, price_per_night
FROM room
WHERE price_per_night > (SELECT AVG(price_per_night) FROM room)
ORDER BY price_per_night;

-- Q23: NOT EXISTS — rooms never booked
SELECT room_number, room_type, status
FROM room rm
WHERE NOT EXISTS (SELECT 1 FROM reservation r WHERE r.room_id = rm.room_id);

-- Q26: derived table — the most frequently booked room type
SELECT room_type, times_booked
FROM (SELECT rm.room_type, COUNT(*) AS times_booked
      FROM reservation r
      INNER JOIN room rm ON rm.room_id = r.room_id
      WHERE r.status <> 'Cancelled'
      GROUP BY rm.room_type) AS booking_counts
ORDER BY times_booked DESC, room_type
LIMIT 1;
```

| room_type | times_booked |
|---|---|
| Deluxe | 5 |

```sql
-- Q25: correlated subquery — customers above the average booking value
SELECT c.customer_id, c.full_name, SUM(r.total_amount) AS total_booking_value
FROM customer c
INNER JOIN reservation r ON r.customer_id = c.customer_id
GROUP BY c.customer_id, c.full_name
HAVING SUM(r.total_amount) > (SELECT AVG(total_amount) FROM reservation)
ORDER BY total_booking_value DESC;
```

### 11.7 Date-wise availability query

```sql
-- Q27: rooms free between two dates (the heart of the booking module)
SELECT rm.room_id, rm.room_number, rm.room_type, rm.price_per_night
FROM room rm
WHERE rm.status <> 'Maintenance'
  AND NOT EXISTS (
        SELECT 1
        FROM reservation r
        WHERE r.room_id = rm.room_id
          AND r.status IN ('Booked', 'CheckedIn')
          AND r.check_in_date  < DATE '2026-12-03'     -- wanted check-out
          AND r.check_out_date > DATE '2026-12-01'     -- wanted check-in
      )
ORDER BY rm.price_per_night;
```

Two stays overlap when the existing check-in is before the wanted check-out
**and** the existing check-out is after the wanted check-in. Cancelled
reservations are ignored, so cancelling a booking frees the room
automatically.

### 11.8 Views

```sql
CREATE VIEW vw_reservation_details AS
SELECT r.reservation_id, c.customer_id, c.full_name AS customer_name,
       c.phone AS customer_phone, rm.room_number, rm.room_type,
       rm.price_per_night, r.check_in_date, r.check_out_date,
       fn_stay_nights(r.check_in_date, r.check_out_date) AS nights,
       r.num_guests, r.total_amount, r.status,
       COALESCE(p.payment_status, 'Not Paid') AS payment_status
FROM reservation r
INNER JOIN customer c ON c.customer_id = r.customer_id
INNER JOIN room     rm ON rm.room_id   = r.room_id
LEFT  JOIN payment  p  ON p.reservation_id = r.reservation_id;
```

| View | What it answers |
|---|---|
| `vw_reservation_details` | Every reservation with guest, room and payment status (used by most screens) |
| `vw_room_current_status` | Which guest is currently in which room |
| `vw_payment_details` | Payments with guest and room information |
| `vw_customer_booking_history` | Per customer: bookings, completed stays, cancellations, total spent |
| `vw_hotel_revenue` | Paid transactions, total revenue, average/min/max payment |

### 11.9 Query index (all 34 queries in `sql/03_queries.sql`)

| Query | Concept demonstrated |
|---|---|
| Q1 | `CREATE TABLE AS` (table from a query) |
| Q2 | `INSERT … RETURNING` |
| Q3 | `UPDATE … WHERE` |
| Q4 | `DELETE … WHERE` |
| Q5 | `SELECT`, `WHERE`, `ORDER BY` |
| Q6 | `IN`, `AND`, comparison operators |
| Q7 | `LIKE`, `DISTINCT` |
| Q8 | Case-insensitive search with `LOWER()` |
| Q9 | `BETWEEN` on dates |
| Q10 | `ORDER BY … LIMIT` (top-N) |
| Q11 | `COUNT`, `MIN`, `MAX`, `AVG`, `SUM` |
| Q12 | Aggregates with `WHERE` |
| Q13 | `GROUP BY` with several aggregates |
| Q14 | `GROUP BY … HAVING` |
| Q15 | `HAVING` on joined data |
| Q16 | `HAVING` on revenue |
| Q17 | `CASE` expression + `GROUP BY` |
| Q18 | `INNER JOIN` of three tables |
| Q19 | `INNER JOIN` with a filter |
| Q20 | `LEFT JOIN` (customers without bookings) |
| Q21 | `LEFT JOIN` + `FILTER` (rooms never booked) |
| Q22 | Subquery with `IN` |
| Q23 | Subquery with `NOT EXISTS` |
| Q24 | Scalar subquery |
| Q25 | Correlated subquery |
| Q26 | Subquery in `FROM` + `ORDER BY … LIMIT` |
| Q27 | Overlap test for date-wise availability |
| Q28 | Availability of one specific room (used by the app) |
| Q29–Q33 | The five views |
| Q34 | `TO_CHAR` + `GROUP BY` for monthly revenue |

---

## 12. Application implementation

### 12.1 Architecture

```
        +-----------------------------+
        |        main.py              |   menu, dispatch, error handling
        +--------------+--------------+
                       |
   +---------+---------+--------+-------------+-----------+
   |         |                  |             |           |
customers  rooms        reservations     frontdesk     payments   reports
   |         |                  |             |           |
   +---------+---------+--------+-------------+-----------+
                       |
                  db.py  (only place that runs SQL)
                       |
                   psycopg2
                       |
                 PostgreSQL  hotel_db
```

| File | Responsibility |
|---|---|
| `app/main.py` | Banner, connection test, main menu, calls the module menus |
| `app/config.py` | Reads `.env` / environment variables for the connection settings |
| `app/db.py` | `Database` class: `query`, `query_one`, `scalar`, `execute`, `execute_returning`, `run_in_transaction`; converts PostgreSQL errors into readable messages |
| `app/ui.py` | Table printing, success/error/warning messages, and all validated input helpers (`ask`, `ask_int`, `ask_money`, `ask_date`, `ask_choice`, `ask_email`, `ask_phone`, `confirm`) |
| `app/customers.py` | Customer management module |
| `app/rooms.py` | Room management module + availability query |
| `app/reservations.py` | Reservation management module |
| `app/frontdesk.py` | Check-in / check-out module |
| `app/payments.py` | Payment management module |
| `app/reports.py` | Reports and search module |

### 12.2 Programming techniques used (deliberately simple)

1. **Functions and modules** — one file per functional module, imported by
   `main.py`. No classes are needed inside the modules, apart from the small
   `Database` helper class.
2. **Parameterized queries** — every value is passed as a `%s` parameter, so
   user input is never concatenated into SQL text:

   ```python
   rows = db.query(
       "SELECT * FROM customer WHERE LOWER(full_name) LIKE LOWER(%s)",
       (f"%{keyword}%",))
   ```

3. **Transactions** — `db.run_in_transaction([(sql, params), …])` commits all
   statements or rolls all of them back. Used by booking, check-in,
   check-out and cancellation.
4. **Input validation** — the `ui.py` helpers re-ask until the input is
   valid (dates in `YYYY-MM-DD`, 10-digit phone, positive money amount with
   two decimals, menu options, yes/no answers).
5. **Error handling** — `DatabaseError` carries a friendly explanation
   (`UNIQUE` violation, `FOREIGN KEY` violation, `CHECK` violation, …);
   `main.py` catches the remaining unexpected errors so the program never
   crashes back to a traceback.
6. **Views and aggregates** — the reports read the five views and use
   `GROUP BY` / `HAVING` / `LEFT JOIN` directly in SQL instead of computing
   totals in Python.

### 12.3 Connection settings

`app/config.py` reads the file `.env` (next to the `app` folder) or the
environment variables `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`,
`DB_PASSWORD` (or a single `DATABASE_URL`). Copy `.env.example` to `.env`
and edit it:

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hotel_db
DB_USER=postgres
DB_PASSWORD=postgres
```

Passwords are never written inside the Python source files.

---

## 13. Screenshots and sample outputs

All screenshots are real console output of the program (generated by
`docs/tools/make_screenshots.py`) and were taken on the sample database.

### 13.1 Main menu and database connection

![Main menu](screenshots/01_main_menu.png)

*Figure 13.1 — Startup screen: the connection to `hotel_db` is verified and
the row counts prove that the sample data is loaded.*

### 13.2 Customer management

![Add customer](screenshots/02_add_customer.png)

*Figure 13.2 — Adding a customer (`INSERT … RETURNING` gives the new ID).*

![View customers](screenshots/03_view_customers.png)

*Figure 13.3 — Listing all customers ordered by `customer_id`.*

![Search customer](screenshots/04_search_customer.png)

*Figure 13.4 — Searching by name (`LIKE`) and showing the booking count from
a `LEFT JOIN`.*

### 13.3 Room management

![Room list](screenshots/05_room_list.png)

*Figure 13.5 — All 14 rooms with category, floor, tariff and current
status.*

![Tariff by type](screenshots/06_room_tariff.png)

*Figure 13.6 — Per-category room count, availability and price range
(`GROUP BY` with `COUNT … FILTER`).*

### 13.4 Reservation management

![Check availability](screenshots/07_check_availability.png)

*Figure 13.7 — Date-wise availability: only rooms without an overlapping
`Booked` / `CheckedIn` reservation are listed.*

![Book room](screenshots/08_book_room.png)

*Figure 13.8 — Booking flow: guest → dates → available rooms → bill preview
→ confirmation. The total (13,500.00) is 3 nights × 4,500.00.*

![View reservation](screenshots/09_view_reservation.png)

*Figure 13.9 — One reservation with its payment record.*

### 13.5 Check-in and check-out

![Check-in](screenshots/10_check_in.png)

*Figure 13.10 — Check-in sets the reservation to `CheckedIn`, the room to
`Occupied`, and offers to collect the pending payment.*

![Check-out](screenshots/11_check_out.png)

*Figure 13.11 — Check-out sets the reservation to `CheckedOut` and frees the
room (`Available`), in one transaction.*

### 13.6 Payment management

![Pending payments](screenshots/12_payment_pending.png)

*Figure 13.12 — Pending payments with the total outstanding amount.*

![Record payment](screenshots/13_record_payment.png)

*Figure 13.13 — Recording a card payment with a transaction reference.*

### 13.7 Reports

![All reservations](screenshots/14_report_all_reservations.png)

*Figure 13.14 — Reservation report built from `vw_reservation_details`.*

![Occupied rooms](screenshots/15_report_occupied_rooms.png)

*Figure 13.15 — Currently occupied rooms, guests and occupancy percentage.*

![Customer history](screenshots/16_report_customer_history.png)

*Figure 13.16 — Customer booking history (`LEFT JOIN` + `GROUP BY`).*

![Revenue](screenshots/17_report_revenue.png)

*Figure 13.17 — Total revenue, revenue by payment method and by month.*

![Popular room type](screenshots/18_report_popular_room_type.png)

*Figure 13.18 — Most frequently booked room type (Deluxe, 5 bookings).*

### 13.8 SQL demonstration in `psql`

![SQL structure](screenshots/19_sql_tables_and_aggregates.png)

*Figure 13.19 — Table structure and constraints, plus the five aggregate
functions.*

![SQL group by](screenshots/20_sql_groupby_having.png)

*Figure 13.20 — `GROUP BY` with `HAVING` and an `INNER JOIN`.*

![SQL left join](screenshots/21_sql_leftjoin_subquery.png)

*Figure 13.21 — `LEFT JOIN`, a subquery in `FROM` and a view.*

A complete text transcript of one demo session is available in
`docs/SAMPLE_RUN_OUTPUT.txt`.

---

## 14. Results and observations

### 14.1 Results

* All four tables, five views, indexes and the helper function were created
  successfully in PostgreSQL 16 (`sql/01_schema.sql`).
* The sample database contains **12 customers, 14 rooms (Single, Double,
  Deluxe, Suite), 16 reservations (Booked, CheckedIn, CheckedOut, Cancelled)
  and 16 payments (Cash, Card, UPI; Pending, Paid, Refunded)**.
* Total revenue in the sample data is **₹1,01,100.00** from 9 paid
  transactions; pending amount ₹83,000 and refunded amount ₹3,200 are
  reported separately.
* All **34 demonstration queries** run without errors and produce the output
  documented in section 11.
* Every module of the Python application was executed against the real
  database: customer add/search/update/delete, room add/update, booking with
  availability check and automatic billing, check-in, check-out, payment
  recording, refund and all eight reports.
* Integrity rules were verified by deliberately trying to break them:
  a duplicate e-mail, an invalid ID-proof type, a two-character name, a
  check-out date before the check-in date, a room booked twice for the same
  dates and deleting a customer who has reservations — each attempt was
  rejected with a clear message.

### 14.2 Observations

1. **Constraints are the real safety net.** The application validates input,
   but a `UNIQUE` or `CHECK` constraint also protects the data when somebody
   edits the tables directly with `psql` or pgAdmin.
2. **Availability must be date-based.** Using only `room.status` would let a
   room be booked twice for future dates; the `NOT EXISTS` overlap query is
   the correct approach and is also fast because of
   `idx_reservation_dates`.
3. **Transactions matter.** Check-in and check-out change two tables. Without
   a transaction, a failure between the two `UPDATE`s would leave a guest in
   a "free" room.
4. **Views simplify the Python code.** `vw_reservation_details` removed the
   need to repeat a three-table join in six different screens.
5. **Storing the bill amount is deliberate.** `reservation.total_amount` is
   kept even though it can be recalculated, because the tariff of a room can
   change later and old bills must not change.
6. **Small usability details matter**: showing the bill before saving,
   offering to collect payment at check-out, and printing the outstanding
   amount in the pending-payments report make the program pleasant to use.

### 14.3 Limitations and future scope

* One payment per reservation (partial payments are not supported).
* No login/authentication — the menu is meant for a single front-desk
  terminal.
* Availability is checked when the booking is saved, but there is no
  database-level `EXCLUDE` constraint against two overlapping bookings
  inserted at exactly the same moment (a single-user mini project does not
  need it; it is mentioned as future work).
* Possible extensions: a Tkinter GUI, invoice printing/PDF, e-mail
  confirmation, housekeeping module, GST calculation, and a
  `room_type` master table with seasonal pricing.

---

## 15. Conclusion

A complete, working Hotel Management System was designed, implemented and
tested. The database is a normalized (3NF) PostgreSQL schema of four related
tables with primary keys, foreign keys, `UNIQUE`, `NOT NULL` and `CHECK`
constraints, five views and an availability query based on date overlap.
The Python application connects through `psycopg2` and offers a simple
menu-driven interface for customers, rooms, reservations, check-in,
check-out, payments and reports, using parameterized SQL and transactions.

The ER diagram, the relational schema, the SQL scripts and the Python code
all describe the same four entities and the same relationships, and every
required SQL concept — from `CREATE TABLE` to `GROUP BY … HAVING`, joins,
subqueries and views — is demonstrated with realistic data and actual output.

The project therefore fulfils the objectives of the Database Systems mini
project: it shows database design, integrity enforcement, SQL skills and a
functional application that interacts with the database, while remaining
simple enough to be explained and extended in a viva.

---

## Appendix A — How to create the database and run the project

### Step 1 — Install the software

* Install PostgreSQL (remember the password you set for the `postgres`
  user) and make sure the service is running.
* Install Python 3.10+ and the driver:

  ```bash
  pip install psycopg2-binary
  ```

### Step 2 — Create the database

From the `hotel_management_system` folder:

```bash
psql -U postgres -f sql/00_create_database.sql
```

This creates the database `hotel_db` and connects to it.

### Step 3 — Create the tables and load the sample data

```bash
psql -U postgres -d hotel_db -f sql/01_schema.sql
psql -U postgres -d hotel_db -f sql/02_sample_data.sql
```

`01_schema.sql` can be re-run safely (it drops and recreates the objects).
`02_sample_data.sql` restarts the IDs and reloads the 12 + 14 + 16 + 16
sample rows.

### Step 4 — Demonstrate the SQL queries (optional)

```bash
psql -U postgres -d hotel_db -f sql/03_queries.sql
```

### Step 5 — Configure the connection

```bash
cp .env.example .env      # Windows: copy .env.example .env
```

Edit `.env` and put your own PostgreSQL password.

### Step 6 — Run the application

```bash
cd app
python main.py
```

The main menu appears. Type the number of a module and press ENTER.

> **Note (Windows):** if `py` is the Python launcher on your system use
> `py main.py`; if `psql` is not on `PATH`, use the full path such as
> `"C:\Program Files\PostgreSQL\16\bin\psql.exe"`.

---

## Appendix B — Demonstration sequence

Suggested order for the practical exam / viva (about 12 minutes):

| Step | Action in the program | What to show |
|---|---|---|
| 1 | Start `python main.py` | Connection status and row counts |
| 2 | **1 → 1** add a customer | New customer ID returned by `INSERT … RETURNING` |
| 3 | **1 → 3** search that customer | Search by ID / name / phone |
| 4 | **2 → 2** view all rooms | 14 rooms, four categories, tariffs |
| 5 | **2 → 4** tariff by type | `GROUP BY` result inside the application |
| 6 | **3 → 2** check availability | Choose `2026-12-01` to `2026-12-03`; note the free rooms |
| 7 | **3 → 1** book a room | Guest → dates → room list → bill preview → confirmation; the amount = nights × tariff |
| 8 | **3 → 1** again with the same dates and the same room | Room no longer appears in the available list (no double booking) |
| 9 | **4 → 3** today's expected check-ins | Preparations for check-in |
| 10 | **4 → 1** check-in | Reservation `Booked → CheckedIn`, room `Available → Occupied` |
| 11 | **5 → 1** record the payment | Cash / Card / UPI, status becomes `Paid` |
| 12 | **4 → 2** check-out | Reservation `CheckedOut`, room back to `Available` |
| 13 | **3 → 4** view a reservation | Status and payment status together |
| 14 | **6 → 2** occupied rooms, **6 → 6** revenue, **6 → 7** popular room type | The three main reports |
| 15 | `psql -d hotel_db` then `\d reservation`, and run any query from `sql/03_queries.sql` | Table structure and SQL concepts |
| 16 | `psql -d hotel_db -f sql/03_queries.sql` | All 34 queries in one go |

Useful viva questions prepared by the design: *Why is `total_amount` stored
even though it can be calculated?* (tariff history) · *How is double booking
prevented?* (overlap test with `NOT EXISTS`) · *Which normal form and why?*
(3NF, no transitive dependency) · *What happens if a customer with bookings
is deleted?* (`ON DELETE RESTRICT` protects the history) · *Where is SQL
injection prevented?* (parameterized queries in `db.py`).

---

## Appendix C — Project file structure

```
hotel_management_system/
├── README.md                  quick start guide
├── .env.example               connection settings template
├── sql/
│   ├── 00_create_database.sql create database hotel_db
│   ├── 01_schema.sql          tables, constraints, indexes, views
│   ├── 02_sample_data.sql     12 customers, 14 rooms, 16 reservations, 16 payments
│   └── 03_queries.sql         34 demonstration queries
├── app/
│   ├── main.py                entry point and main menu
│   ├── config.py              reads .env / environment variables
│   ├── db.py                  psycopg2 wrapper (queries, transactions, errors)
│   ├── ui.py                  tables, messages and validated input helpers
│   ├── customers.py           module 1 - customer management
│   ├── rooms.py               module 2 - room management
│   ├── reservations.py        module 3 - reservation management
│   ├── frontdesk.py           module 4 - check-in / check-out
│   ├── payments.py            module 5 - payment management
│   └── reports.py             module 6 - reports and search
└── docs/
    ├── PROJECT_REPORT.md      this report
    ├── PROJECT_REPORT.docx    the same report, ready to print
    ├── ER_DIAGRAM.png / .svg  ER diagram
    ├── SAMPLE_RUN_OUTPUT.txt  text transcript of a demo session
    ├── screenshots/           21 screenshots used in this report
    └── tools/
        ├── make_er_diagram.py generate the ER diagram
        └── make_screenshots.py regenerate the screenshots
```

---

### References

1. Elmasri R. and Navathe S. B., *Fundamentals of Database Systems*, 7th
   edition, Pearson, 2016.
2. Silberschatz A., Korth H. F. and Sudarshan S., *Database System
   Concepts*, 7th edition, McGraw-Hill, 2019.
3. PostgreSQL Global Development Group, *PostgreSQL 16 Documentation*,
   <https://www.postgresql.org/docs/16/>.
4. Psycopg Development Team, *Psycopg 2 Documentation*,
   <https://www.psycopg.org/docs/>.
5. Python Software Foundation, *The Python Tutorial*,
   <https://docs.python.org/3/tutorial/>.
