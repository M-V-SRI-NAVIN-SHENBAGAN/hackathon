-- =====================================================================
-- HOTEL MANAGEMENT SYSTEM  --  Database Systems (DBS) Mini Project
-- File    : 02_sample_data.sql
-- Purpose : Insert realistic sample data.
--           12 customers, 14 rooms, 16 reservations, 16 payments.
-- Run as  : psql -U postgres -d hotel_db -f sql/02_sample_data.sql
--
-- NOTE: Reservation dates are written relative to CURRENT_DATE so the
--       data always contains past, present (checked-in) and future
--       bookings whenever the script is executed.
-- =====================================================================

BEGIN;

-- Remove old data (child first) so this file can be re-run.
TRUNCATE TABLE payment, reservation, room, customer RESTART IDENTITY CASCADE;

-- ---------------------------------------------------------------------
-- 1. CUSTOMERS  (12 records)
-- ---------------------------------------------------------------------
INSERT INTO customer
    (customer_id, full_name, email, phone, address, id_proof_type, id_proof_number)
VALUES
 (1,  'Arjun Kumar',      'arjun.kumar@example.com',   '9840012301',
      '12, Anna Nagar, Chennai',          'Aadhaar',         'AAD100000001'),
 (2,  'Priya Raman',      'priya.raman@example.com',   '9840012302',
      '45, T. Nagar, Chennai',            'Passport',        'PAS200000002'),
 (3,  'Rahul Sharma',     'rahul.sharma@example.com',  '9840012303',
      '7, MG Road, Bengaluru',            'Driving Licence', 'DL300000003'),
 (4,  'Sneha Iyer',       'sneha.iyer@example.com',    '9840012304',
      '23, Adyar, Chennai',               'Aadhaar',         'AAD100000004'),
 (5,  'Vikram Nair',      'vikram.nair@example.com',   '9840012305',
      '9, Marine Drive, Kochi',           'Voter ID',        'VOT400000005'),
 (6,  'Ananya Reddy',     'ananya.reddy@example.com',  '9840012306',
      '56, Banjara Hills, Hyderabad',     'Passport',        'PAS200000006'),
 (7,  'Karthik Raj',      'karthik.raj@example.com',   '9840012307',
      '18, Gandhipuram, Coimbatore',      'Aadhaar',         'AAD100000007'),
 (8,  'Divya Menon',      'divya.menon@example.com',   '9840012308',
      '4, Kalyan Nagar, Bengaluru',       'Driving Licence', 'DL300000008'),
 (9,  'Suresh Babu',      'suresh.babu@example.com',   '9840012309',
      '31, Tiruvottiyur, Chennai',        'Voter ID',        'VOT400000009'),
 (10, 'Meena Krishnan',   'meena.krishnan@example.com','9840012310',
      '82, Mylapore, Chennai',            'Aadhaar',         'AAD100000010'),
 (11, 'Ravi Verma',       'ravi.verma@example.com',    '9840012311',
      '14, Salt Lake, Kolkata',           'Passport',        'PAS200000011'),
 (12, 'Lakshmi Devi',     'lakshmi.devi@example.com',  '9840012312',
      '67, Jayanagar, Bengaluru',         'Aadhaar',         'AAD100000012');

-- ---------------------------------------------------------------------
-- 2. ROOMS  (14 records, 4 categories, one room under maintenance)
-- ---------------------------------------------------------------------
INSERT INTO room
    (room_id, room_number, room_type, floor_no, price_per_night, max_occupancy, status)
VALUES
 (1,  '101', 'Single', 1, 1500.00, 1, 'Available'),
 (2,  '102', 'Single', 1, 1500.00, 1, 'Occupied'),
 (3,  '103', 'Double', 1, 2500.00, 2, 'Available'),
 (4,  '104', 'Double', 1, 2500.00, 2, 'Occupied'),
 (5,  '105', 'Deluxe', 2, 4000.00, 3, 'Available'),
 (6,  '106', 'Deluxe', 2, 4000.00, 3, 'Available'),
 (7,  '107', 'Suite',  3, 7500.00, 4, 'Occupied'),
 (8,  '108', 'Suite',  3, 7500.00, 4, 'Available'),
 (9,  '109', 'Single', 2, 1600.00, 1, 'Available'),
 (10, '110', 'Double', 2, 2600.00, 2, 'Maintenance'),
 (11, '111', 'Deluxe', 2, 4200.00, 3, 'Available'),
 (12, '112', 'Suite',  3, 8000.00, 4, 'Occupied'),
 (13, '201', 'Deluxe', 2, 4500.00, 3, 'Available'),
 (14, '202', 'Double', 2, 2700.00, 2, 'Occupied');

-- ---------------------------------------------------------------------
-- 3. RESERVATIONS (16 records)
--    statuses used: Booked (6), CheckedIn (5), CheckedOut (4), Cancelled (1)
--    total_amount = nights * price_per_night
-- ---------------------------------------------------------------------
INSERT INTO reservation
    (reservation_id, customer_id, room_id, check_in_date, check_out_date,
     booking_date, num_guests, total_amount, status, actual_check_in, actual_check_out)
VALUES
 -- --- Currently staying (CheckedIn) -----------------------------------
 (1, 1, 2,  CURRENT_DATE - 2, CURRENT_DATE + 2, CURRENT_DATE - 5, 1,  6000.00,
     'CheckedIn', (CURRENT_DATE - 2) + TIME '14:10', NULL),
 (2, 2, 4,  CURRENT_DATE - 1, CURRENT_DATE + 3, CURRENT_DATE - 4, 2, 10000.00,
     'CheckedIn', (CURRENT_DATE - 1) + TIME '12:35', NULL),
 (3, 3, 7,  CURRENT_DATE - 3, CURRENT_DATE + 1, CURRENT_DATE - 6, 3, 30000.00,
     'CheckedIn', (CURRENT_DATE - 3) + TIME '15:00', NULL),
 (4, 4, 14, CURRENT_DATE - 4, CURRENT_DATE + 2, CURRENT_DATE - 7, 2, 16200.00,
     'CheckedIn', (CURRENT_DATE - 4) + TIME '11:45', NULL),

 -- --- Future bookings (Booked) ----------------------------------------
 (5, 5, 1,  CURRENT_DATE + 3, CURRENT_DATE + 5, CURRENT_DATE - 1, 1,  3000.00,
     'Booked', NULL, NULL),
 (15, 9, 13, CURRENT_DATE, CURRENT_DATE + 2, CURRENT_DATE - 1, 2,  9000.00,
     'Booked', NULL, NULL),
 (6, 6, 5,  CURRENT_DATE + 2, CURRENT_DATE + 6, CURRENT_DATE - 2, 2, 16000.00,
     'Booked', NULL, NULL),
 (7, 7, 8,  CURRENT_DATE + 7, CURRENT_DATE + 9, CURRENT_DATE,     3, 15000.00,
     'Booked', NULL, NULL),
 (8, 8, 12, CURRENT_DATE + 10, CURRENT_DATE + 14, CURRENT_DATE - 3, 4, 32000.00,
     'Booked', NULL, NULL),
 (9, 9, 6,  CURRENT_DATE + 1, CURRENT_DATE + 3, CURRENT_DATE - 1, 2,  8000.00,
     'Booked', NULL, NULL),

 -- --- Checked in yesterday, leaving today (departure demo) -------------
 (16, 5, 12, CURRENT_DATE - 1, CURRENT_DATE, CURRENT_DATE - 4, 2,  8000.00,
     'CheckedIn', (CURRENT_DATE - 1) + TIME '15:20', NULL),

 -- --- Completed stays (CheckedOut) ------------------------------------
 (10, 10, 3,  CURRENT_DATE - 12, CURRENT_DATE - 9, CURRENT_DATE - 20, 2, 7500.00,
     'CheckedOut', (CURRENT_DATE - 12) + TIME '13:00', (CURRENT_DATE - 9) + TIME '10:30'),
 (11, 1, 5,   CURRENT_DATE - 20, CURRENT_DATE - 17, CURRENT_DATE - 25, 2, 12000.00,
     'CheckedOut', (CURRENT_DATE - 20) + TIME '14:30', (CURRENT_DATE - 17) + TIME '11:00'),
 (12, 11, 11, CURRENT_DATE - 15, CURRENT_DATE - 13, CURRENT_DATE - 22, 3, 8400.00,
     'CheckedOut', (CURRENT_DATE - 15) + TIME '12:00', (CURRENT_DATE - 13) + TIME '09:45'),
 (13, 12, 1,  CURRENT_DATE - 8, CURRENT_DATE - 6, CURRENT_DATE - 14, 1, 3000.00,
     'CheckedOut', (CURRENT_DATE - 8) + TIME '16:20', (CURRENT_DATE - 6) + TIME '10:15'),

 -- --- Cancelled booking ------------------------------------------------
 (14, 2, 9,  CURRENT_DATE + 4, CURRENT_DATE + 6, CURRENT_DATE - 2, 1, 3200.00,
     'Cancelled', NULL, NULL);

-- ---------------------------------------------------------------------
-- 4. PAYMENTS (16 records -> one per reservation)
--    CheckedOut / CheckedIn : Paid
--    Booked (future)        : Pending
--    Cancelled              : Refunded
-- ---------------------------------------------------------------------
INSERT INTO payment
    (payment_id, reservation_id, amount, payment_method, payment_status,
     payment_date, transaction_ref)
VALUES
 (1,  1,  6000.00, 'Card', 'Paid',     (CURRENT_DATE - 5) + TIME '10:15', 'TXN60000001'),
 (2,  2, 10000.00, 'UPI',  'Paid',     (CURRENT_DATE - 4) + TIME '18:40', 'TXN60000002'),
 (3,  3, 30000.00, 'Card', 'Paid',     (CURRENT_DATE - 6) + TIME '09:05', 'TXN60000003'),
 (4,  4, 16200.00, 'Cash', 'Paid',     (CURRENT_DATE - 7) + TIME '16:25', NULL),
 (5,  5,  3000.00, 'Cash', 'Pending',  (CURRENT_DATE - 1) + TIME '11:00', NULL),
 (6,  6, 16000.00, 'Card', 'Pending',  (CURRENT_DATE - 2) + TIME '13:30', 'TXN60000006'),
 (7,  7, 15000.00, 'UPI',  'Pending',  (CURRENT_DATE)     + TIME '09:50', 'TXN60000007'),
 (8,  8, 32000.00, 'Card', 'Pending',  (CURRENT_DATE - 3) + TIME '20:10', 'TXN60000008'),
 (9,  9,  8000.00, 'Cash', 'Pending',  (CURRENT_DATE - 1) + TIME '15:45', NULL),
 (15, 15, 9000.00, 'Cash', 'Pending',  (CURRENT_DATE - 1) + TIME '17:10', NULL),
 (16, 16, 8000.00, 'UPI',  'Paid',     (CURRENT_DATE - 4) + TIME '16:05', 'TXN60000016'),
 (10, 10, 7500.00, 'UPI',  'Paid',     (CURRENT_DATE - 20) + TIME '12:20', 'TXN60000010'),
 (11, 11, 12000.00,'Cash', 'Paid',     (CURRENT_DATE - 25) + TIME '10:00', NULL),
 (12, 12, 8400.00, 'Card', 'Paid',     (CURRENT_DATE - 22) + TIME '17:35', 'TXN60000012'),
 (13, 13, 3000.00, 'UPI',  'Paid',     (CURRENT_DATE - 14) + TIME '19:05', 'TXN60000013'),
 (14, 14, 3200.00, 'UPI',  'Refunded', (CURRENT_DATE - 2) + TIME '14:00', 'TXN60000014');

-- ---------------------------------------------------------------------
-- 5. Re-synchronise the SERIAL sequences with the manually inserted IDs
--    Without this, the next INSERT made by the application would try to
--    reuse id 1 and fail with a duplicate-key error.
-- ---------------------------------------------------------------------
SELECT setval(pg_get_serial_sequence('customer',    'customer_id'),
              (SELECT MAX(customer_id)    FROM customer));
SELECT setval(pg_get_serial_sequence('room',        'room_id'),
              (SELECT MAX(room_id)        FROM room));
SELECT setval(pg_get_serial_sequence('reservation', 'reservation_id'),
              (SELECT MAX(reservation_id) FROM reservation));
SELECT setval(pg_get_serial_sequence('payment',     'payment_id'),
              (SELECT MAX(payment_id)     FROM payment));

COMMIT;

-- ---------------------------------------------------------------------
-- 6. Verdict
-- ---------------------------------------------------------------------
\echo '--- Row counts ---'
SELECT 'customer'    AS table_name, COUNT(*) AS rows FROM customer
UNION ALL SELECT 'room',        COUNT(*) FROM room
UNION ALL SELECT 'reservation', COUNT(*) FROM reservation
UNION ALL SELECT 'payment',     COUNT(*) FROM payment
ORDER BY table_name;
