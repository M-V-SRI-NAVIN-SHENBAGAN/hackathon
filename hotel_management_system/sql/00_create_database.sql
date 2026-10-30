-- =====================================================================
-- HOTEL MANAGEMENT SYSTEM  --  Database Systems (DBS) Mini Project
-- File    : 00_create_database.sql
-- Purpose : Create the PostgreSQL database and the application user.
-- Run as  : A PostgreSQL superuser (e.g. postgres).
--           psql -U postgres -f sql/00_create_database.sql
-- Note    : Run this file ONCE. Re-running it drops the database and
--           all of its data.
-- =====================================================================

-- 1. Remove an old copy of the database (if it exists) and recreate it.
DROP DATABASE IF EXISTS hotel_db;

CREATE DATABASE hotel_db
    WITH ENCODING 'UTF8'
         TEMPLATE template0;

-- 2. (Optional) A dedicated application user instead of using postgres.
--    Uncomment these lines if you prefer a separate login.
-- CREATE USER hotel_app WITH PASSWORD 'hotel123';
-- GRANT ALL PRIVILEGES ON DATABASE hotel_db TO hotel_app;
-- \c hotel_db
-- GRANT ALL ON SCHEMA public TO hotel_app;

-- 3. Connect to the new database. (psql meta-command)
\c hotel_db

-- Confirm the connection.
SELECT current_database() AS connected_database,
       current_user      AS connected_user,
       version()         AS postgres_version;
