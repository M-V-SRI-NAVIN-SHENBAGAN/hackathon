-- =====================================================================
-- HOTEL MANAGEMENT SYSTEM  --  Database Systems (DBS) Mini Project
-- File    : 03_queries.sql
-- Purpose : Demonstrate every SQL concept required by the project.
-- Run as  : psql -U postgres -d hotel_db -f sql/03_queries.sql
--
-- Every query is numbered (Q1 ... Q28) and the expected result is
-- described in a comment above it.  Data-changing examples (INSERT,
-- UPDATE, DELETE) run inside a transaction that is rolled back at the
-- end, so the sample database is left unchanged.
-- =====================================================================

\echo '====================================================='
\echo ' PART A : DATA DEFINITION AND DATA MANIPULATION'
\echo '====================================================='

-- ---------------------------------------------------------------------
-- Q1. CREATE TABLE (recap)
--     The four base tables are created in 01_schema.sql.  Here a
--     temporary table is created from a query, showing CREATE TABLE AS.
--     Expected: a temporary table top_rooms with 3 expensive rooms.
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS top_rooms;
CREATE TEMP TABLE top_rooms AS
    SELECT room_number, room_type, price_per_night
    FROM room
    ORDER BY price_per_night DESC
    LIMIT 3;

SELECT * FROM top_rooms;

-- ---------------------------------------------------------------------
-- Q2. INSERT ... RETURNING
--     Adds a new customer and returns the generated primary key.
--     Expected: one row with the new customer_id and name 'Demo Guest'.
-- ---------------------------------------------------------------------
BEGIN;

INSERT INTO customer (full_name, email, phone, address, id_proof_type, id_proof_number)
VALUES ('Demo Guest', 'demo.guest@example.com', '9000000001',
        '1, Demo Street, Chennai', 'Aadhaar', 'AAD999999999')
RETURNING customer_id, full_name, email, created_at;

-- ---------------------------------------------------------------------
-- Q3. UPDATE with WHERE
--     Changes the address of the newly inserted customer.
--     Expected: UPDATE 1 and the new address in the SELECT.
-- ---------------------------------------------------------------------
UPDATE customer
SET address = '2, New Street, Chennai'
WHERE email = 'demo.guest@example.com';

SELECT customer_id, full_name, address
FROM customer
WHERE email = 'demo.guest@example.com';

-- ---------------------------------------------------------------------
-- Q4. DELETE with WHERE
--     Removes only the temporary demo customer.
--     Expected: DELETE 1.
-- ---------------------------------------------------------------------
DELETE FROM customer
WHERE email = 'demo.guest@example.com';

SELECT COUNT(*) AS remaining_customers FROM customer;   -- Expected: 12

ROLLBACK;   -- Undo everything from Q2-Q4 so sample data stays clean.

\echo '====================================================='
\echo ' PART B : BASIC QUERIES (SELECT, WHERE, ORDER BY)'
\echo '====================================================='

-- ---------------------------------------------------------------------
-- Q5. SELECT with WHERE and ORDER BY
--     Rooms costing more than 4000 per night, cheapest first.
--     Expected: 5 rooms (4200, 4500, 7500, 7500, 8000).
-- ---------------------------------------------------------------------
SELECT room_number, room_type, price_per_night, status
FROM room
WHERE price_per_night > 4000
ORDER BY price_per_night;

-- ---------------------------------------------------------------------
-- Q6. WHERE with IN, AND, OR, comparison operators
--     Deluxe or Suite rooms that are currently free.
--     Expected: 6 Available rows.
-- ---------------------------------------------------------------------
SELECT room_number, room_type, price_per_night
FROM room
WHERE room_type IN ('Deluxe', 'Suite')
  AND status = 'Available'
ORDER BY price_per_night DESC;

-- ---------------------------------------------------------------------
-- Q7. Pattern matching with LIKE and DISTINCT
--     Customers whose e-mail belongs to example.com.
--     Expected: 12 rows.
-- ---------------------------------------------------------------------
SELECT DISTINCT full_name, email
FROM customer
WHERE email LIKE '%@example.com'
ORDER BY full_name;

-- ---------------------------------------------------------------------
-- Q8. Search by name OR phone (what the app's search box does)
--     Expected: 1 row - Arjun Kumar (customer_id 1).
-- ---------------------------------------------------------------------
SELECT customer_id, full_name, phone, email
FROM customer
WHERE LOWER(full_name) LIKE LOWER('%arjun%')
   OR phone = '9840012301';

-- ---------------------------------------------------------------------
-- Q9. BETWEEN on dates + ORDER BY
--     Reservations that start within the next 7 days.
--     Expected: 4 rows (reservations 15, 9, 6, 5 in date order).
-- ---------------------------------------------------------------------
SELECT reservation_id, customer_id, room_id, check_in_date, check_out_date, status
FROM reservation
WHERE check_in_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
ORDER BY check_in_date;

-- ---------------------------------------------------------------------
-- Q10. LIMIT / OFFSET (top-N query)
--     The three most expensive rooms.
--     Expected: rooms 112, 107, 108.
-- ---------------------------------------------------------------------
SELECT room_number, room_type, price_per_night
FROM room
ORDER BY price_per_night DESC
LIMIT 3;

\echo '====================================================='
\echo ' PART C : AGGREGATE FUNCTIONS, GROUP BY, HAVING'
\echo '====================================================='

-- ---------------------------------------------------------------------
-- Q11. All five aggregate functions on a single column
--     Expected: 14 rooms, min 1500.00, max 8000.00,
--               average 3900.00, total 54600.00.
-- ---------------------------------------------------------------------
SELECT COUNT(*)                    AS total_rooms,
       MIN(price_per_night)        AS cheapest_room,
       MAX(price_per_night)        AS costliest_room,
       ROUND(AVG(price_per_night), 2) AS average_tariff,
       SUM(price_per_night)        AS sum_of_tariffs
FROM room;

-- ---------------------------------------------------------------------
-- Q12. Aggregate with WHERE
--     Total revenue actually collected (Paid payments only).
--     Expected: 9 paid transactions, total 101100.00
-- ---------------------------------------------------------------------
SELECT COUNT(*)               AS paid_transactions,
       SUM(amount)            AS total_revenue,
       ROUND(AVG(amount), 2)  AS average_payment
FROM payment
WHERE payment_status = 'Paid';

-- ---------------------------------------------------------------------
-- Q13. GROUP BY with several aggregates
--     Room count, average tariff, cheapest and dearest tariff per type.
--     Expected: 4 groups (Deluxe, Double, Single, Suite).
-- ---------------------------------------------------------------------
SELECT room_type,
       COUNT(*)                       AS rooms,
       ROUND(AVG(price_per_night), 2) AS avg_price,
       MIN(price_per_night)           AS min_price,
       MAX(price_per_night)           AS max_price
FROM room
GROUP BY room_type
ORDER BY avg_price DESC;

-- ---------------------------------------------------------------------
-- Q14. GROUP BY + HAVING
--     Room types that have at least 3 rooms AND an average tariff
--     above 3000.
--     Expected: Deluxe and Suite.
-- ---------------------------------------------------------------------
SELECT room_type,
       COUNT(*)                       AS rooms,
       ROUND(AVG(price_per_night), 2) AS avg_price
FROM room
GROUP BY room_type
HAVING COUNT(*) >= 3
   AND AVG(price_per_night) > 3000
ORDER BY avg_price DESC;

-- ---------------------------------------------------------------------
-- Q15. GROUP BY + HAVING on reservations
--     Customers who booked more than once.
--     Expected: 4 rows - Arjun Kumar, Priya Raman, Suresh Babu and
--               Vikram Nair, each with 2 bookings.
-- ---------------------------------------------------------------------
SELECT c.customer_id,
       c.full_name,
       COUNT(r.reservation_id) AS total_bookings
FROM customer c
INNER JOIN reservation r ON r.customer_id = c.customer_id
GROUP BY c.customer_id, c.full_name
HAVING COUNT(r.reservation_id) > 1
ORDER BY total_bookings DESC, c.full_name;

-- ---------------------------------------------------------------------
-- Q16. GROUP BY + HAVING on revenue
--     Revenue and transaction count per payment method, only methods
--     that actually collected money.
--     Expected: Card 44400, UPI 28500, Cash 28200 (Paid only).
-- ---------------------------------------------------------------------
SELECT payment_method,
       COUNT(*)               AS transactions,
       SUM(amount)            AS collected
FROM payment
WHERE payment_status = 'Paid'
GROUP BY payment_method
HAVING SUM(amount) > 0
ORDER BY collected DESC;

-- ---------------------------------------------------------------------
-- Q17. CASE expression + GROUP BY (price band report)
--     Expected: Budget / Standard / Premium bands with counts.
-- ---------------------------------------------------------------------
SELECT CASE WHEN price_per_night < 2500 THEN 'Budget'
            WHEN price_per_night <= 5000 THEN 'Standard'
            ELSE 'Premium'
       END AS price_band,
       COUNT(*) AS rooms
FROM room
GROUP BY price_band
ORDER BY rooms DESC;

\echo '====================================================='
\echo ' PART D : JOINS'
\echo '====================================================='

-- ---------------------------------------------------------------------
-- Q18. INNER JOIN of three tables
--     Every reservation with the guest name and room details.
--     Expected: 16 rows.
-- ---------------------------------------------------------------------
SELECT r.reservation_id,
       c.full_name,
       rm.room_number,
       rm.room_type,
       r.check_in_date,
       r.check_out_date,
       r.total_amount,
       r.status
FROM reservation r
INNER JOIN customer c ON c.customer_id = r.customer_id
INNER JOIN room     rm ON rm.room_id   = r.room_id
ORDER BY r.reservation_id;

-- ---------------------------------------------------------------------
-- Q19. INNER JOIN reservation + payment
--     Reservations whose payment is still pending.
--     Expected: 6 rows.
-- ---------------------------------------------------------------------
SELECT r.reservation_id, c.full_name, rm.room_number,
       p.amount, p.payment_method, p.payment_status
FROM reservation r
INNER JOIN customer c ON c.customer_id = r.customer_id
INNER JOIN room     rm ON rm.room_id   = r.room_id
INNER JOIN payment  p  ON p.reservation_id = r.reservation_id
WHERE p.payment_status = 'Pending'
ORDER BY p.amount DESC;

-- ---------------------------------------------------------------------
-- Q20. LEFT JOIN
--     All customers with their number of bookings, including those
--     who never booked (shown as 0).
--     Expected: 12 rows, all current customers have >= 1 booking
--     except any newly added customer.
-- ---------------------------------------------------------------------
SELECT c.customer_id,
       c.full_name,
       COUNT(r.reservation_id) AS bookings,
       COALESCE(SUM(r.total_amount), 0) AS booking_value
FROM customer c
LEFT JOIN reservation r ON r.customer_id = c.customer_id
GROUP BY c.customer_id, c.full_name
ORDER BY bookings DESC, c.customer_id;

-- ---------------------------------------------------------------------
-- Q21. LEFT JOIN room -> reservation
--     Every room with the number of confirmed bookings; rooms that were
--     never booked appear with 0 (e.g. the room under maintenance).
--     Expected: 14 rows; room 110 has 0 bookings.
-- ---------------------------------------------------------------------
SELECT rm.room_id,
       rm.room_number,
       rm.room_type,
       COUNT(r.reservation_id) FILTER (WHERE r.status <> 'Cancelled') AS confirmed_bookings
FROM room rm
LEFT JOIN reservation r ON r.room_id = rm.room_id
GROUP BY rm.room_id, rm.room_number, rm.room_type
ORDER BY rm.room_id;

\echo '====================================================='
\echo ' PART E : SUBQUERIES'
\echo '====================================================='

-- ---------------------------------------------------------------------
-- Q22. Subquery with IN
--     Customers who have at least one confirmed (non-cancelled) booking.
--     Expected: 12 rows (most of the sample customers).
-- ---------------------------------------------------------------------
SELECT customer_id, full_name, phone
FROM customer
WHERE customer_id IN (
        SELECT customer_id
        FROM reservation
        WHERE status <> 'Cancelled'
      )
ORDER BY customer_id;

-- ---------------------------------------------------------------------
-- Q23. Subquery with NOT EXISTS
--     Rooms that have never been booked.
--     Expected: room 110 (Double, under maintenance).
-- ---------------------------------------------------------------------
SELECT room_number, room_type, status
FROM room rm
WHERE NOT EXISTS (
        SELECT 1
        FROM reservation r
        WHERE r.room_id = rm.room_id
      )
ORDER BY room_number;

-- ---------------------------------------------------------------------
-- Q24. Scalar subquery in WHERE
--     Rooms priced above the average room price.
--     Expected: the Deluxe and Suite rooms.
-- ---------------------------------------------------------------------
SELECT room_number, room_type, price_per_night
FROM room
WHERE price_per_night > (SELECT AVG(price_per_night) FROM room)
ORDER BY price_per_night;

-- ---------------------------------------------------------------------
-- Q25. Correlated subquery
--     Customers whose total booking value is above the overall average
--     booking value.
--     Expected: customers with the Suite / long-stay reservations.
-- ---------------------------------------------------------------------
SELECT c.customer_id,
       c.full_name,
       SUM(r.total_amount) AS total_booking_value
FROM customer c
INNER JOIN reservation r ON r.customer_id = c.customer_id
GROUP BY c.customer_id, c.full_name
HAVING SUM(r.total_amount) > (
        SELECT AVG(total_amount) FROM reservation
      )
ORDER BY total_booking_value DESC;

-- ---------------------------------------------------------------------
-- Q26. Subquery in the FROM clause (derived table) + ORDER BY + LIMIT
--     The most frequently booked room type.
--     Expected: Deluxe with 5 confirmed bookings.
-- ---------------------------------------------------------------------
SELECT room_type, times_booked
FROM (
        SELECT rm.room_type,
               COUNT(*) AS times_booked
        FROM reservation r
        INNER JOIN room rm ON rm.room_id = r.room_id
        WHERE r.status <> 'Cancelled'
        GROUP BY rm.room_type
     ) AS booking_counts
ORDER BY times_booked DESC, room_type
LIMIT 1;

\echo '====================================================='
\echo ' PART F : DATE-WISE ROOM AVAILABILITY'
\echo '====================================================='

-- ---------------------------------------------------------------------
-- Q27. Rooms free for a given date range.
--     Two bookings overlap when: existing.check_in < wanted.check_out
--                                AND existing.check_out > wanted.check_in.
--     Cancelled bookings do not block a room.
--     Expected: rooms not booked between 2026-11-03 and 2026-11-05
--               (exact list depends on CURRENT_DATE sample dates).
-- ---------------------------------------------------------------------
SELECT rm.room_id, rm.room_number, rm.room_type,
       rm.price_per_night, rm.max_occupancy
FROM room rm
WHERE rm.status <> 'Maintenance'
  AND NOT EXISTS (
        SELECT 1
        FROM reservation r
        WHERE r.room_id = rm.room_id
          AND r.status IN ('Booked', 'CheckedIn')
          AND r.check_in_date  < (CURRENT_DATE + 5)::date
          AND r.check_out_date > (CURRENT_DATE + 3)::date
      )
ORDER BY rm.price_per_night;

-- ---------------------------------------------------------------------
-- Q28. Confirm that the already chosen room is free
--     (the exact query used by the Python application).
--     Expected: 1 row for room 103 in the range below.
-- ---------------------------------------------------------------------
SELECT room_id, room_number, status
FROM room
WHERE room_id = 3
  AND status <> 'Maintenance'
  AND NOT EXISTS (
        SELECT 1 FROM reservation r
        WHERE r.room_id = room.room_id
          AND r.status IN ('Booked', 'CheckedIn')
          AND r.check_in_date  < DATE '2026-12-10'
          AND r.check_out_date > DATE '2026-12-08'
      );

\echo '====================================================='
\echo ' PART G : VIEWS'
\echo '====================================================='

-- ---------------------------------------------------------------------
-- Q29. View: full reservation details
--      Expected: 16 rows with customer, room and payment status.
-- ---------------------------------------------------------------------
SELECT * FROM vw_reservation_details ORDER BY reservation_id;

-- ---------------------------------------------------------------------
-- Q30. View: currently occupied rooms
--      Expected: 5 rooms (102, 104, 107, 112, 202) with guest names.
-- ---------------------------------------------------------------------
SELECT room_number, room_type, guest_name, check_in_date, check_out_date
FROM vw_room_current_status
WHERE booking_status = 'CheckedIn'
ORDER BY room_number;

-- ---------------------------------------------------------------------
-- Q31. View: payment details
--      Expected: 16 payment rows.
-- ---------------------------------------------------------------------
SELECT payment_id, customer_name, room_number, amount,
       payment_method, payment_status
FROM vw_payment_details
ORDER BY payment_id;

-- ---------------------------------------------------------------------
-- Q32. View: customer booking history
--      Expected: 12 rows, one per customer.
-- ---------------------------------------------------------------------
SELECT full_name, total_bookings, completed_stays,
       cancelled_bookings, total_spent
FROM vw_customer_booking_history
ORDER BY total_spent DESC, full_name;

-- ---------------------------------------------------------------------
-- Q33. View: hotel revenue summary
--      Expected: 9 paid transactions, total 101100.00.
-- ---------------------------------------------------------------------
SELECT * FROM vw_hotel_revenue;

-- ---------------------------------------------------------------------
-- Q34. View + aggregate: revenue per month of payment
--      Expected: one row per month in which money was received.
-- ---------------------------------------------------------------------
SELECT TO_CHAR(payment_date, 'YYYY-MM') AS month,
       COUNT(*)                          AS transactions,
       SUM(amount)                       AS revenue
FROM payment
WHERE payment_status = 'Paid'
GROUP BY TO_CHAR(payment_date, 'YYYY-MM')
ORDER BY month;

\echo '====================================================='
\echo ' All queries executed successfully.'
\echo '====================================================='
