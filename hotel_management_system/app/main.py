"""
main.py
=======
HOTEL MANAGEMENT SYSTEM - entry point.

Run from the folder that contains this file:

    python main.py

The program connects to PostgreSQL with psycopg2, shows the main menu and
dispatches to the six functional modules.
"""

import sys

import config
from db import Database, DatabaseError
from ui import (Cancel, clear_screen, error, info, menu_choice, pause,
                print_record, title)

import customers
import frontdesk
import payments
import reports
import reservations
import rooms

APP_NAME = "HOTEL MANAGEMENT SYSTEM"
VERSION = "1.0"
SEPARATOR = "=" * 92


def show_banner():
    print(SEPARATOR)
    print(f"  {APP_NAME}   (Database Systems Mini Project - v{VERSION})")
    print("  Python 3 + PostgreSQL + psycopg2")
    print(SEPARATOR)


def database_status(db):
    """Show connection details and a few row counts."""
    db_info = db.query_one(
        """
        SELECT current_database() AS database,
               current_user       AS username,
               version()          AS version
        """)
    counts = db.query_one(
        """
        SELECT (SELECT COUNT(*) FROM customer)    AS customers,
               (SELECT COUNT(*) FROM room)        AS rooms,
               (SELECT COUNT(*) FROM reservation) AS reservations,
               (SELECT COUNT(*) FROM payment)     AS payments
        """)
    print_record({
        "Connection": config.describe(db.config),
        "Database": db_info["database"],
        "User": db_info["username"],
        "Customers": counts["customers"],
        "Rooms": counts["rooms"],
        "Reservations": counts["reservations"],
        "Payments": counts["payments"],
    })


def main():
    clear_screen()
    show_banner()

    db = Database()
    try:
        db.connect()
        info("Connected to PostgreSQL successfully.")
        database_status(db)
    except DatabaseError as exc:
        error(str(exc))
        print("\nThe program cannot work without a database connection.")
        sys.exit(1)

    while True:
        title("MAIN MENU")
        print("  1. Customer Management")
        print("  2. Room Management")
        print("  3. Reservation Management")
        print("  4. Check-in / Check-out")
        print("  5. Payment Management")
        print("  6. Reports and Search")
        print("  7. Database connection information")
        print("  0. Exit")
        try:
            choice = menu_choice()
        except Cancel:
            choice = "0"

        try:
            if choice == "1":
                customers.menu(db)
            elif choice == "2":
                rooms.menu(db)
            elif choice == "3":
                reservations.menu(db)
            elif choice == "4":
                frontdesk.menu(db)
            elif choice == "5":
                payments.menu(db)
            elif choice == "6":
                reports.menu(db)
            elif choice == "7":
                database_status(db)
                pause()
            elif choice == "0":
                print("\nThank you for using the Hotel Management System.")
                break
            else:
                error("Invalid option. Please choose a number from the menu.")
                pause()
        except DatabaseError as exc:
            error(str(exc))
            pause()
        except (KeyboardInterrupt, Cancel):
            print("\nReturning to the main menu...")
        except Exception as exc:                      # last-resort guard
            error(f"Unexpected problem: {exc}")
            pause()

        clear_screen()
        show_banner()

    db.close()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nProgram interrupted. Goodbye!")
