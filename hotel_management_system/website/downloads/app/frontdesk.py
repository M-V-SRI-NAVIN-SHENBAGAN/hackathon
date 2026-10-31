"""
frontdesk.py
============
MODULE 4 - CHECK-IN AND CHECK-OUT MANAGEMENT

Check-in  : reservation Booked      -> CheckedIn   , room -> Occupied
Check-out : reservation CheckedIn   -> CheckedOut , room -> Available

Both operations change TWO tables, so they run inside a single
transaction (db.run_in_transaction).  If the second UPDATE failed for any
reason, the first one would be undone as well - this is the classic
"either all or nothing" property of a transaction.
"""

from datetime import date

from db import DatabaseError
from ui import (Cancel, ask_int, confirm, error, info, menu_choice, money,
                pause, print_record, print_table, success, subtitle, title,
                warn)

import payments
import reservations


def todays_arrivals(db):
    subtitle("TODAY'S EXPECTED CHECK-INS")
    rows = db.query(
        """
        SELECT r.reservation_id, c.customer_id, c.full_name, c.phone,
               rm.room_number, rm.room_type, r.check_in_date, r.check_out_date,
               r.num_guests, r.total_amount
        FROM reservation r
        INNER JOIN customer c ON c.customer_id = r.customer_id
        INNER JOIN room rm    ON rm.room_id    = r.room_id
        WHERE r.status = 'Booked'
          AND r.check_in_date = CURRENT_DATE
        ORDER BY r.reservation_id
        """)
    print_table(rows, [
        ("reservation_id", "Resv", 5, "r"),
        ("customer_id", "Cust", 5, "r"),
        ("full_name", "Guest", 20, "l"),
        ("phone", "Phone", 11, "l"),
        ("room_number", "Room", 6, "l"),
        ("room_type", "Type", 8, "l"),
        ("num_guests", "Guests", 7, "r"),
        ("total_amount", "Amount", 11, "r"),
    ], empty_message="No reservation starts today.")


def todays_departures(db):
    subtitle("TODAY'S EXPECTED CHECK-OUTS")
    rows = db.query(
        """
        SELECT r.reservation_id, c.full_name, rm.room_number, rm.room_type,
               r.check_in_date, r.check_out_date, r.total_amount,
               COALESCE(p.payment_status, 'Not Paid') AS payment_status
        FROM reservation r
        INNER JOIN customer c ON c.customer_id = r.customer_id
        INNER JOIN room rm    ON rm.room_id    = r.room_id
        LEFT JOIN payment p   ON p.reservation_id = r.reservation_id
        WHERE r.status = 'CheckedIn'
          AND r.check_out_date <= CURRENT_DATE
        ORDER BY r.reservation_id
        """)
    print_table(rows, [
        ("reservation_id", "Resv", 5, "r"),
        ("full_name", "Guest", 20, "l"),
        ("room_number", "Room", 6, "l"),
        ("room_type", "Type", 8, "l"),
        ("check_out_date", "Due", 11, "l"),
        ("total_amount", "Amount", 11, "r"),
        ("payment_status", "Payment", 11, "l"),
    ], empty_message="No guest is due to leave today.")


# ----------------------------------------------------------------------
# Check-in
# ----------------------------------------------------------------------
def check_in(db):
    subtitle("RECORD CUSTOMER CHECK-IN")
    try:
        reservation_id = ask_int("Reservation ID", minimum=1)
    except Cancel:
        return

    row = reservations.get_reservation(db, reservation_id)
    if not row:
        error(f"No reservation with ID {reservation_id}.")
        return

    print()
    reservations.print_reservation(row)

    if row["status"] == "CheckedIn":
        warn("This guest has already been checked in.")
        return
    if row["status"] != "Booked":
        error(f"A reservation with status '{row['status']}' cannot be checked in.")
        return
    if row["check_in_date"] > date.today():
        warn(f"Check-in date is {row['check_in_date']}, "
             "which is in the future. Check-in is not allowed yet.")
        return

    room = db.query_one(
        "SELECT room_id, room_number, status FROM room WHERE room_number = %s",
        (row["room_number"],))
    if room["status"] == "Maintenance":
        error("This room is under maintenance and cannot be occupied.")
        return
    if room["status"] == "Occupied":
        error("The room is already marked Occupied. Please verify with the "
              "front desk before checking in.")
        return

    if not confirm(f"Check in {row['customer_name']} to room "
                   f"{row['room_number']}?"):
        info("Check-in cancelled.")
        return

    # Two statements, one transaction.
    try:
        db.run_in_transaction([
            ("""
             UPDATE reservation
                SET status = 'CheckedIn',
                    actual_check_in = CURRENT_TIMESTAMP
              WHERE reservation_id = %s AND status = 'Booked'
             """, (reservation_id,)),
            ("""
             UPDATE room
                SET status = 'Occupied'
              WHERE room_id = %s AND status = 'Available'
             """, (room["room_id"],)),
        ])
    except DatabaseError as exc:
        error(f"Check-in failed and was rolled back.\n  {exc}")
        return

    success(f"Check-in recorded for reservation {reservation_id}.")
    print_record({
        "Guest": row["customer_name"],
        "Room": f"{row['room_number']} ({row['room_type']})",
        "Check-in": row["check_in_date"],
        "Planned check-out": row["check_out_date"],
        "Room status": "Occupied",
        "Reservation status": "CheckedIn",
    })

    if row["payment_status"] != "Paid":
        warn(f"Payment for this reservation is '{row['payment_status']}'.")
        if confirm("Record the payment now?"):
            payments.record_payment_for(db, reservation_id)


# ----------------------------------------------------------------------
# Check-out
# ----------------------------------------------------------------------
def check_out(db):
    subtitle("RECORD CUSTOMER CHECK-OUT")
    try:
        reservation_id = ask_int("Reservation ID", minimum=1)
    except Cancel:
        return

    row = reservations.get_reservation(db, reservation_id)
    if not row:
        error(f"No reservation with ID {reservation_id}.")
        return

    print()
    reservations.print_reservation(row)

    if row["status"] == "CheckedOut":
        warn("This guest has already been checked out.")
        return
    if row["status"] != "CheckedIn":
        error(f"A reservation with status '{row['status']}' cannot be checked out.")
        return

    room = db.query_one("SELECT room_id FROM room WHERE room_number = %s",
                        (row["room_number"],))

    print("\nFinal bill")
    print("  " + "-" * 46)
    print(f"  Room charge        : Rs. {money(row['total_amount'])}")
    print(f"  Payment status     : {row['payment_status']}")
    print("  " + "-" * 46)

    if row["payment_status"] != "Paid":
        warn("The bill has not been paid yet.")
        if not confirm("Record the payment before check-out?"):
            if not confirm("Continue check-out with payment still pending?"):
                info("Check-out cancelled.")
                return
        else:
            payments.record_payment_for(db, reservation_id)

    if not confirm(f"Check out {row['customer_name']} from room "
                   f"{row['room_number']}?"):
        info("Check-out cancelled.")
        return

    try:
        db.run_in_transaction([
            ("""
             UPDATE reservation
                SET status = 'CheckedOut',
                    actual_check_out = CURRENT_TIMESTAMP
              WHERE reservation_id = %s AND status = 'CheckedIn'
             """, (reservation_id,)),
            ("""
             UPDATE room
                SET status = 'Available'
              WHERE room_id = %s
             """, (room["room_id"],)),
        ])
    except DatabaseError as exc:
        error(f"Check-out failed and was rolled back.\n  {exc}")
        return

    success(f"Check-out recorded for reservation {reservation_id}.")
    print_record({
        "Guest": row["customer_name"],
        "Room": f"{row['room_number']} ({row['room_type']})",
        "Amount billed": money(row["total_amount"]),
        "Payment status": row["payment_status"],
        "Room status": "Available (free for the next guest)",
        "Reservation status": "CheckedOut",
    })


# ----------------------------------------------------------------------
# Menu
# ----------------------------------------------------------------------
def menu(db):
    while True:
        title("CHECK-IN / CHECK-OUT MANAGEMENT")
        print("  1. Record check-in")
        print("  2. Record check-out")
        print("  3. Show today's expected check-ins")
        print("  4. Show today's expected check-outs")
        print("  0. Back to main menu")
        try:
            choice = menu_choice()
        except Cancel:
            return
        try:
            if choice == "1":
                check_in(db)
            elif choice == "2":
                check_out(db)
            elif choice == "3":
                todays_arrivals(db)
            elif choice == "4":
                todays_departures(db)
            elif choice == "0":
                return
            else:
                error("Invalid option. Please choose a number from the menu.")
                continue
        except DatabaseError as exc:
            error(str(exc))
        pause()
