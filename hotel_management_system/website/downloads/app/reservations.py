"""
reservations.py
===============
MODULE 3 - RESERVATION MANAGEMENT

Operations: book a room, check availability for a date range, list all
reservations, view one reservation, cancel a reservation.

Business rules implemented here
-------------------------------
* check_out_date must be later than check_in_date.
* A room cannot be double-booked: an overlapping reservation with status
  'Booked' or 'CheckedIn' blocks the room.
* total_amount = number of nights x room.price_per_night.
* A 'Pending' payment row is created together with the reservation, so
  the payment module has something to mark as Paid.
* Only a 'Booked' reservation can be cancelled.  A guest who is already
  checked in must be checked out (or the stay continues).
"""

from datetime import date, timedelta

from db import DatabaseError
from ui import (Cancel, ask_date, ask_int, confirm, error, info,
                menu_choice, money, pause, print_table, print_record,
                success, subtitle, title, warn)

import customers
import rooms

RESERVATION_COLUMNS = [
    ("reservation_id", "Resv", 5, "r"),
    ("customer_name", "Customer", 18, "l"),
    ("room_number", "Room", 6, "l"),
    ("room_type", "Type", 8, "l"),
    ("check_in_date", "Check-in", 11, "l"),
    ("check_out_date", "Check-out", 11, "l"),
    ("nights", "Nights", 6, "r"),
    ("total_amount", "Amount", 11, "r"),
    ("status", "Status", 11, "l"),
    ("payment_status", "Payment", 11, "l"),
]


def show_reservations(rows, empty_message="No reservations found."):
    print_table(rows, RESERVATION_COLUMNS, empty_message=empty_message)


def get_reservation(db, reservation_id: int):
    """Full reservation row from the view plus the raw room/customer ids."""
    return db.query_one(
        "SELECT * FROM vw_reservation_details WHERE reservation_id = %s",
        (reservation_id,))


def print_reservation(row):
    print_record(row, labels={
        "reservation_id": "Reservation ID",
        "customer_id": "Customer ID",
        "customer_name": "Customer",
        "customer_phone": "Phone",
        "room_number": "Room",
        "room_type": "Room type",
        "price_per_night": "Price per night",
        "check_in_date": "Check-in date",
        "check_out_date": "Check-out date",
        "nights": "Nights",
        "num_guests": "Guests",
        "total_amount": "Total amount",
        "status": "Reservation status",
        "payment_status": "Payment status",
    })


# ----------------------------------------------------------------------
# 1. Check availability for a date range
# ----------------------------------------------------------------------
def check_availability(db):
    """Ask for a date range and list every room that is free."""
    subtitle("CHECK ROOM AVAILABILITY")
    try:
        check_in = ask_date("Check-in date (YYYY-MM-DD)",
                            default=str(date.today()))
        check_out = ask_date(
            "Check-out date (YYYY-MM-DD)",
            default=str(check_in + timedelta(days=2)))
    except Cancel:
        return

    if check_out <= check_in:
        error("Check-out date must be after the check-in date.")
        return

    rows = rooms.available_rooms_for_dates(db, check_in, check_out)
    nights = (check_out - check_in).days
    print(f"\nStay: {check_in} to {check_out}  ({nights} night(s))")
    if not rows:
        warn("Sorry, no room is free for the selected dates.")
        return

    print_table(rows, [
        ("room_id", "ID", 4, "r"),
        ("room_number", "Room", 6, "l"),
        ("room_type", "Type", 9, "l"),
        ("floor_no", "Floor", 6, "r"),
        ("max_occupancy", "Max guests", 11, "r"),
        ("price_per_night", "Price/night", 12, "r"),
    ])
    print(f"\n{len(rows)} room(s) available for these dates.")
    print("Room is blocked if a 'Booked' or 'CheckedIn' reservation overlaps")
    print("the requested dates; cancelled reservations do not block a room.")


# ----------------------------------------------------------------------
# 2. Book a room
# ----------------------------------------------------------------------
def book_room(db):
    subtitle("BOOK A ROOM")

    # Step 1 - who is booking?
    print("\nStep 1: select the customer")
    customer_id = customers.choose_customer(db)
    if customer_id is None:
        info("Booking cancelled.")
        return

    # Step 2 - dates
    print("\nStep 2: stay details")
    try:
        check_in = ask_date("Check-in date (YYYY-MM-DD)",
                            default=str(date.today()))
        check_out = ask_date(
            "Check-out date (YYYY-MM-DD)",
            default=str(check_in + timedelta(days=2)))
    except Cancel:
        info("Booking cancelled.")
        return

    if check_in < date.today():
        warn("The check-in date is in the past. Use today or a future date.")
        return
    if check_out <= check_in:
        error("Check-out date must be after the check-in date.")
        return

    nights = (check_out - check_in).days

    # Step 3 - occupancy
    try:
        num_guests = ask_int("Number of guests", minimum=1, maximum=6, default=1)
    except Cancel:
        info("Booking cancelled.")
        return

    # Step 4 - availability (before showing the room list)
    available = rooms.available_rooms_for_dates(db, check_in, check_out)
    if not available:
        warn("No room is available for the selected dates. "
             "Please try different dates.")
        return

    print(f"\nStep 3: choose a room ({nights} night(s), "
          f"{check_in} to {check_out})")
    print("\nRooms free for these dates:\n")
    print(f"  {'ID':>4}  {'Room':<6}  {'Type':<9}  {'Guests':>6}  "
          f"{'Price/night':>12}  {'Stay total':>12}")
    print("  " + "-" * 62)
    for room in available:
        if room["max_occupancy"] < num_guests:
            continue        # too small for this party
        stay_total = room["price_per_night"] * nights
        print(f"  {room['room_id']:>4}  {room['room_number']:<6}  "
              f"{room['room_type']:<9}  {room['max_occupancy']:>6}  "
              f"{money(room['price_per_night']):>12}  "
              f"{money(stay_total):>12}")

    suitable = [r for r in available if r["max_occupancy"] >= num_guests]
    if not suitable:
        warn(f"No available room can hold {num_guests} guest(s).")
        return

    try:
        room_id = ask_int("Enter the Room ID to book", minimum=1)
    except Cancel:
        info("Booking cancelled.")
        return

    room = rooms.get_room(db, room_id)
    if not room:
        error(f"No room with ID {room_id}.")
        return

    # Step 5 - re-check the chosen room (the query the report expects)
    free = db.scalar(
        """
        SELECT COUNT(*) FROM room rm
        WHERE rm.room_id = %s
          AND rm.status <> 'Maintenance'
          AND NOT EXISTS (
                SELECT 1 FROM reservation r
                WHERE r.room_id = rm.room_id
                  AND r.status IN ('Booked', 'CheckedIn')
                  AND r.check_in_date  < %s
                  AND r.check_out_date > %s
              )
        """, (room_id, check_out, check_in), default=0)
    if not free:
        error(f"Room {room['room_number']} is not available for those dates.")
        return
    if room["max_occupancy"] < num_guests:
        error(f"Room {room['room_number']} allows at most "
              f"{room['max_occupancy']} guest(s).")
        return

    # Step 6 - bill
    total_amount = room["price_per_night"] * nights
    print("\nStep 4: bill preview")
    print("  " + "-" * 50)
    print(f"  Room                : {room['room_number']} ({room['room_type']})")
    print(f"  Price per night     : Rs. {money(room['price_per_night'])}")
    print(f"  Number of nights    : {nights}")
    print(f"  Total booking amount: Rs. {money(total_amount)}")
    print("  " + "-" * 50)

    if not confirm("Confirm this booking?"):
        info("Booking cancelled.")
        return

    # Step 7 - write both rows in ONE transaction
    try:
        result = db.run_in_transaction([
            ("""
             INSERT INTO reservation
                 (customer_id, room_id, check_in_date, check_out_date,
                  booking_date, num_guests, total_amount, status)
             VALUES (%s, %s, %s, %s, CURRENT_DATE, %s, %s, 'Booked')
             RETURNING reservation_id
             """,
             (customer_id, room_id, check_in, check_out, num_guests,
              total_amount)),
        ])
        reservation_id = result[0][0]["reservation_id"]

        # Payment record created as Pending so the Payment module can
        # mark it as Paid later.
        db.execute(
            """
            INSERT INTO payment (reservation_id, amount, payment_method,
                                 payment_status)
            VALUES (%s, %s, 'Cash', 'Pending')
            """, (reservation_id, total_amount))
    except DatabaseError as exc:
        error(f"Booking failed and was rolled back.\n  {exc}")
        return

    success(f"Reservation confirmed. Reservation ID = {reservation_id}")
    row = get_reservation(db, reservation_id)
    print()
    print_reservation(row)
    print("\nThe payment is recorded as 'Pending'. Use Payment Management")
    print("to record the money received.")


# ----------------------------------------------------------------------
# 3. View reservations (filtered list)
# ----------------------------------------------------------------------
def view_reservations(db):
    subtitle("VIEW RESERVATIONS")
    print("  1. All reservations")
    print("  2. Only Booked (upcoming)")
    print("  3. Only CheckedIn (in house)")
    print("  4. Only CheckedOut (completed)")
    print("  5. Only Cancelled")
    print("  6. For one customer")
    try:
        choice = menu_choice("Choose a filter")
    except Cancel:
        return

    sql = "SELECT * FROM vw_reservation_details"
    params = ()
    if choice == "2":
        sql += " WHERE status = %s"
        params = ("Booked",)
    elif choice == "3":
        sql += " WHERE status = %s"
        params = ("CheckedIn",)
    elif choice == "4":
        sql += " WHERE status = %s"
        params = ("CheckedOut",)
    elif choice == "5":
        sql += " WHERE status = %s"
        params = ("Cancelled",)
    elif choice == "6":
        customer_id = customers.choose_customer(db)
        if customer_id is None:
            return
        sql += " WHERE customer_id = %s"
        params = (customer_id,)
    elif choice != "1":
        error("Invalid filter option.")
        return

    rows = db.query(sql + " ORDER BY reservation_id", params)
    show_reservations(rows, empty_message="No matching reservations.")


# ----------------------------------------------------------------------
# 4. View one reservation
# ----------------------------------------------------------------------
def view_reservation(db):
    subtitle("RESERVATION DETAILS")
    try:
        reservation_id = ask_int("Reservation ID", minimum=1)
    except Cancel:
        return
    row = get_reservation(db, reservation_id)
    if not row:
        error(f"No reservation with ID {reservation_id}.")
        return
    print()
    print_reservation(row)

    payment = db.query_one(
        "SELECT * FROM vw_payment_details WHERE reservation_id = %s",
        (reservation_id,))
    if payment:
        print("\nPayment record:")
        print_record(payment, labels={
            "payment_id": "Payment ID",
            "reservation_id": "Reservation",
            "customer_name": "Customer",
            "room_number": "Room",
            "amount": "Amount",
            "payment_method": "Method",
            "payment_status": "Status",
            "payment_date": "Date",
            "transaction_ref": "Reference",
        })


# ----------------------------------------------------------------------
# 5. Cancel a reservation
# ----------------------------------------------------------------------
def cancel_reservation(db):
    subtitle("CANCEL RESERVATION")
    try:
        reservation_id = ask_int("Reservation ID", minimum=1)
    except Cancel:
        return

    row = get_reservation(db, reservation_id)
    if not row:
        error(f"No reservation with ID {reservation_id}.")
        return
    print()
    print_reservation(row)

    if row["status"] == "Cancelled":
        warn("This reservation is already cancelled.")
        return
    if row["status"] == "CheckedIn":
        error("The guest is checked in. Please check the guest out first "
              "(Check-in / Check-out menu).")
        return
    if row["status"] == "CheckedOut":
        error("Completed stays cannot be cancelled.")
        return

    if not confirm("Cancel this reservation?"):
        info("Cancellation aborted.")
        return

    # Room stays free because availability ignores cancelled bookings.
    # Money already collected is marked Refunded; a Pending payment row
    # (nothing received yet) is removed.
    payment = db.query_one(
        "SELECT payment_id, payment_status FROM payment WHERE reservation_id = %s",
        (reservation_id,))

    try:
        steps = [
            ("UPDATE reservation SET status = 'Cancelled' "
             "WHERE reservation_id = %s", (reservation_id,)),
        ]
        if payment and payment["payment_status"] == "Paid":
            steps.append((
                "UPDATE payment SET payment_status = 'Refunded' "
                "WHERE reservation_id = %s", (reservation_id,)))
        elif payment and payment["payment_status"] == "Pending":
            steps.append((
                "DELETE FROM payment WHERE reservation_id = %s",
                (reservation_id,)))
        db.run_in_transaction(steps)
    except DatabaseError as exc:
        error(f"Could not cancel the reservation.\n  {exc}")
        return

    success(f"Reservation {reservation_id} cancelled. "
            "The room is free again for those dates.")


# ----------------------------------------------------------------------
# Menu
# ----------------------------------------------------------------------
def menu(db):
    while True:
        title("RESERVATION MANAGEMENT")
        print("  1. Book a room")
        print("  2. Check availability for dates")
        print("  3. View reservations")
        print("  4. View one reservation (with payment)")
        print("  5. Cancel a reservation")
        print("  0. Back to main menu")
        try:
            choice = menu_choice()
        except Cancel:
            return
        try:
            if choice == "1":
                book_room(db)
            elif choice == "2":
                check_availability(db)
            elif choice == "3":
                view_reservations(db)
            elif choice == "4":
                view_reservation(db)
            elif choice == "5":
                cancel_reservation(db)
            elif choice == "0":
                return
            else:
                error("Invalid option. Please choose a number from the menu.")
                continue
        except DatabaseError as exc:
            error(str(exc))
        pause()
