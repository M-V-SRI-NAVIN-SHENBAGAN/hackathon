-- =====================================================================
-- HOTEL MANAGEMENT SYSTEM  --  Database Systems (DBS) Mini Project
-- File    : 01_schema.sql
-- Purpose : Create all relational tables, constraints and views.
-- Run as  : psql -U postgres -d hotel_db -f sql/01_schema.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Clean start (safe to re-run)
--    Children are dropped before parents because of the foreign keys.
-- ---------------------------------------------------------------------
DROP VIEW  IF EXISTS vw_hotel_revenue           CASCADE;
DROP VIEW  IF EXISTS vw_customer_booking_history CASCADE;
DROP VIEW  IF EXISTS vw_payment_details         CASCADE;
DROP VIEW  IF EXISTS vw_room_current_status     CASCADE;
DROP VIEW  IF EXISTS vw_reservation_details     CASCADE;

DROP TABLE IF EXISTS payment    CASCADE;
DROP TABLE IF EXISTS reservation CASCADE;
DROP TABLE IF EXISTS room       CASCADE;
DROP TABLE IF EXISTS customer   CASCADE;

-- ---------------------------------------------------------------------
-- 1. CUSTOMER  (strong entity)
--    Stores every guest of the hotel. Email and phone are unique so
--    that the same person cannot be registered twice by mistake.
-- ---------------------------------------------------------------------
CREATE TABLE customer (
    customer_id     SERIAL        PRIMARY KEY,
    full_name       VARCHAR(100)  NOT NULL,
    email           VARCHAR(120)  NOT NULL UNIQUE,
    phone           VARCHAR(15)   NOT NULL UNIQUE,
    address         VARCHAR(200),
    id_proof_type   VARCHAR(20)   NOT NULL
                    CHECK (id_proof_type IN ('Aadhaar', 'Passport',
                                             'Driving Licence', 'Voter ID')),
    id_proof_number VARCHAR(30)   NOT NULL UNIQUE,
    created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_customer_name  CHECK (LENGTH(TRIM(full_name)) >= 3),
    CONSTRAINT chk_customer_email CHECK (email LIKE '%_@_%._%'),
    CONSTRAINT chk_customer_phone CHECK (phone ~ '^[0-9]{10}$')
);

COMMENT ON TABLE  customer IS 'Guests registered with the hotel';
COMMENT ON COLUMN customer.id_proof_number IS 'Government ID number, unique per guest';

-- ---------------------------------------------------------------------
-- 2. ROOM  (strong entity)
--    room_type decides the category, price_per_night stores the tariff.
--    status is the CURRENT physical state of the room.
--    Date-wise availability is calculated from the reservation table.
-- ---------------------------------------------------------------------
CREATE TABLE room (
    room_id         SERIAL        PRIMARY KEY,
    room_number     VARCHAR(10)   NOT NULL UNIQUE,
    room_type       VARCHAR(20)   NOT NULL
                    CHECK (room_type IN ('Single', 'Double', 'Deluxe', 'Suite')),
    floor_no        INTEGER       NOT NULL CHECK (floor_no BETWEEN 0 AND 20),
    price_per_night NUMERIC(10,2) NOT NULL CHECK (price_per_night > 0),
    max_occupancy   INTEGER       NOT NULL CHECK (max_occupancy BETWEEN 1 AND 6),
    status          VARCHAR(20)   NOT NULL DEFAULT 'Available'
                    CHECK (status IN ('Available', 'Occupied', 'Maintenance')),
    created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE  room IS 'Hotel rooms and their tariffs';
COMMENT ON COLUMN room.status IS 'Available = free, Occupied = guest checked in, Maintenance = out of service';

-- ---------------------------------------------------------------------
-- 3. RESERVATION  (weak-ish entity: depends on CUSTOMER and ROOM)
--    One customer can make many reservations; one room can be booked
--    many times (on different dates).
--    total_amount = number_of_nights * room.price_per_night, calculated
--    by the application at booking time and stored for billing history.
-- ---------------------------------------------------------------------
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
                      CHECK (status IN ('Booked', 'CheckedIn',
                                        'CheckedOut', 'Cancelled')),
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
        CHECK (booking_date <= check_in_date),

    CONSTRAINT chk_reservation_checkin_time
        CHECK (actual_check_in IS NULL OR actual_check_in::date >= check_in_date),

    CONSTRAINT chk_reservation_checkout_time
        CHECK (actual_check_out IS NULL
               OR (actual_check_in IS NOT NULL
                   AND actual_check_out >= actual_check_in))
);

COMMENT ON TABLE  reservation IS 'Room bookings made by customers';
COMMENT ON COLUMN reservation.status IS 'Booked -> CheckedIn -> CheckedOut, or Booked -> Cancelled';

-- ---------------------------------------------------------------------
-- 4. PAYMENT  (depends on RESERVATION)
--    One reservation has at most one payment record (UNIQUE), which
--    keeps the mini-project simple and avoids partial-payment logic.
-- ---------------------------------------------------------------------
CREATE TABLE payment (
    payment_id      SERIAL        PRIMARY KEY,
    reservation_id  INTEGER       NOT NULL UNIQUE,
    amount          NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    payment_method  VARCHAR(10)   NOT NULL
                    CHECK (payment_method IN ('Cash', 'Card', 'UPI')),
    payment_status  VARCHAR(20)   NOT NULL DEFAULT 'Pending'
                    CHECK (payment_status IN ('Pending', 'Paid', 'Refunded')),
    payment_date    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    transaction_ref VARCHAR(40),

    CONSTRAINT fk_payment_reservation
        FOREIGN KEY (reservation_id) REFERENCES reservation (reservation_id)
        ON UPDATE CASCADE ON DELETE CASCADE
);

COMMENT ON TABLE payment IS 'Payment made against a reservation';

-- ---------------------------------------------------------------------
-- 5. INDEXES on foreign keys and frequently filtered columns
--    (PostgreSQL does NOT create indexes for FK columns automatically.)
-- ---------------------------------------------------------------------
CREATE INDEX idx_reservation_customer ON reservation (customer_id);
CREATE INDEX idx_reservation_room     ON reservation (room_id);
CREATE INDEX idx_reservation_status   ON reservation (status);
CREATE INDEX idx_reservation_dates    ON reservation (check_in_date, check_out_date);
CREATE INDEX idx_payment_status       ON payment (payment_status);
CREATE INDEX idx_room_type            ON room (room_type);

-- ---------------------------------------------------------------------
-- 6. A small helper function used by views and the application to get
--    the number of nights of a stay.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_stay_nights(p_check_in DATE, p_check_out DATE)
RETURNS INTEGER
LANGUAGE SQL
IMMUTABLE
AS $$
    SELECT (p_check_out - p_check_in);
$$;

-- =====================================================================
-- 7. VIEWS
-- =====================================================================

-- 7.1 Full reservation information (customer + room + payment status)
CREATE VIEW vw_reservation_details AS
SELECT r.reservation_id,
       c.customer_id,
       c.full_name        AS customer_name,
       c.phone            AS customer_phone,
       rm.room_number,
       rm.room_type,
       rm.price_per_night,
       r.check_in_date,
       r.check_out_date,
       fn_stay_nights(r.check_in_date, r.check_out_date) AS nights,
       r.num_guests,
       r.total_amount,
       r.status,
       COALESCE(p.payment_status, 'Not Paid') AS payment_status
FROM reservation r
INNER JOIN customer c ON c.customer_id = r.customer_id
INNER JOIN room     rm ON rm.room_id   = r.room_id
LEFT  JOIN payment  p  ON p.reservation_id = r.reservation_id;

COMMENT ON VIEW vw_reservation_details IS 'Reservation joined with customer, room and payment';

-- 7.2 Which guest is currently inside which room
CREATE VIEW vw_room_current_status AS
SELECT rm.room_id,
       rm.room_number,
       rm.room_type,
       rm.price_per_night,
       rm.status                                              AS room_status,
       r.reservation_id,
       c.full_name                                            AS guest_name,
       r.check_in_date,
       r.check_out_date,
       COALESCE(r.status, 'No Active Booking')                AS booking_status
FROM room rm
LEFT JOIN reservation r
       ON r.room_id = rm.room_id
      AND r.status = 'CheckedIn'
LEFT JOIN customer c ON c.customer_id = r.customer_id;

COMMENT ON VIEW vw_room_current_status IS 'Occupied rooms with the guest staying in them';

-- 7.3 Payment details for each reservation
CREATE VIEW vw_payment_details AS
SELECT p.payment_id,
       p.reservation_id,
       c.full_name          AS customer_name,
       rm.room_number,
       p.amount,
       p.payment_method,
       p.payment_status,
       p.payment_date,
       p.transaction_ref
FROM payment p
INNER JOIN reservation r ON r.reservation_id = p.reservation_id
INNER JOIN customer    c ON c.customer_id    = r.customer_id
INNER JOIN room       rm ON rm.room_id       = r.room_id;

COMMENT ON VIEW vw_payment_details IS 'Payment with guest and room information';

-- 7.4 Booking history of every customer (LEFT JOIN keeps customers
--     who have never booked a room).
CREATE VIEW vw_customer_booking_history AS
SELECT c.customer_id,
       c.full_name,
       c.email,
       c.phone,
       COUNT(r.reservation_id)                                   AS total_bookings,
       COUNT(r.reservation_id) FILTER (WHERE r.status = 'CheckedOut')
                                                                 AS completed_stays,
       COUNT(r.reservation_id) FILTER (WHERE r.status = 'Cancelled')
                                                                 AS cancelled_bookings,
       COALESCE(SUM(r.total_amount) FILTER (WHERE r.status <> 'Cancelled'), 0)
                                                                 AS total_spent
FROM customer c
LEFT JOIN reservation r ON r.customer_id = c.customer_id
GROUP BY c.customer_id, c.full_name, c.email, c.phone;

COMMENT ON VIEW vw_customer_booking_history IS 'One row per customer with booking counts and money spent';

-- 7.5 Revenue collected from successful payments
CREATE VIEW vw_hotel_revenue AS
SELECT COUNT(*)                        AS paid_transactions,
       COALESCE(SUM(amount), 0)        AS total_revenue,
       COALESCE(AVG(amount), 0)        AS average_payment,
       COALESCE(MIN(amount), 0)        AS smallest_payment,
       COALESCE(MAX(amount), 0)        AS largest_payment
FROM payment
WHERE payment_status = 'Paid';

COMMENT ON VIEW vw_hotel_revenue IS 'Aggregate revenue from payments with status Paid';

-- =====================================================================
-- 8. Verification: list the objects that were created
-- =====================================================================
\echo '--- Tables created ---'
\dt
\echo '--- Views created ---'
\dv
