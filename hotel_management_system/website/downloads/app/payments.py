"""
payments.py
===========
MODULE 5 - PAYMENT MANAGEMENT

A payment row is created together with every reservation with status
'Pending'.  This module records the money actually received and changes
the status to 'Paid', or marks a paid amount as 'Refunded' when a
reservation is cancelled.

Payment methods allowed by the CHECK constraint: Cash, Card, UPI.
Payment statuses: Pending, Paid, Refunded.
"""

from db import DatabaseError
from ui import (Cancel, ask, ask_choice, ask_int, confirm, error, info,
                menu_choice, money, pause, print_record, print_table,
                success, subtitle, title, warn)

PAYMENT_METHODS = ["Cash", "Card", "UPI"]
PAYMENT_STATUSES = ["Pending", "Paid", "Refunded"]

PAYMENT_COLUMNS = [
    ("payment_id", "Pay ID", 6, "r"),
    ("reservation_id", "Resv", 5, "r"),
    ("customer_name", "Customer", 18, "l"),
    ("room_number", "Room", 6, "l"),
    ("amount", "Amount", 11, "r"),
    ("payment_method", "Method", 8, "l"),
    ("payment_status", "Status", 10, "l"),
    ("payment_date", "Paid on", 16, "l"),
    ("transaction_ref", "Reference", 13, "l"),
]


def show_payments(rows, empty_message="No payments found."):
    print_table(rows, PAYMENT_COLUMNS, empty_message=empty_message)


def payment_for(db, reservation_id: int):
    return db.query_one(
        "SELECT * FROM vw_payment_details WHERE reservation_id = %s",
        (reservation_id,))


# ----------------------------------------------------------------------
# 1. Record payment for an existing reservation (used by the menu and
#    also automatically from check-in / check-out)
# ----------------------------------------------------------------------
def record_payment_for(db, reservation_id: int):
    """Ask for the method and mark the reservation's payment as Paid."""
    reservation = db.query_one(
        "SELECT * FROM vw_reservation_details WHERE reservation_id = %s",
        (reservation_id,))
    if not reservation:
        error(f"No reservation with ID {reservation_id}.")
        return

    print("\nReservation to be paid:")
    print_record(reservation, labels={
        "reservation_id": "Reservation ID",
        "customer_id": "Customer ID",
        "customer_name": "Customer",
        "customer_phone": "Phone",
        "room_number": "Room",
        "room_type": "Room type",
        "price_per_night": "Price per night",
        "check_in_date": "Check-in",
        "check_out_date": "Check-out",
        "nights": "Nights",
        "num_guests": "Guests",
        "total_amount": "Bill amount",
        "status": "Status",
        "payment_status": "Payment status",
    })

    if reservation["status"] == "Cancelled":
        error("This reservation is cancelled; there is nothing to collect.")
        return

    existing = db.query_one(
        "SELECT * FROM payment WHERE reservation_id = %s", (reservation_id,))
    if existing and existing["payment_status"] == "Paid":
        info(f"Payment for reservation {reservation_id} is already recorded "
             f"(Rs. {money(existing['amount'])} on {existing['payment_date']}).")
        return

    amount = reservation["total_amount"]
    try:
        method = ask_choice("Payment method", PAYMENT_METHODS)
        reference = ""
        if method in ("Card", "UPI"):
            reference = ask("Transaction reference (press ENTER to skip)",
                            required=False)
        if not confirm(f"Collect Rs. {money(amount)} by {method}?"):
            info("Payment cancelled.")
            return
    except Cancel:
        info("Payment cancelled.")
        return

    try:
        if existing:
            db.execute(
                """
                UPDATE payment
                   SET payment_status = 'Paid',
                       payment_method = %s,
                       amount = %s,
                       payment_date = CURRENT_TIMESTAMP,
                       transaction_ref = %s
                 WHERE payment_id = %s
                """,
                (method, amount, reference or None, existing["payment_id"]))
        else:
            db.execute(
                """
                INSERT INTO payment
                    (reservation_id, amount, payment_method, payment_status,
                     transaction_ref)
                VALUES (%s, %s, %s, 'Paid', %s)
                """,
                (reservation_id, amount, method, reference or None))
    except DatabaseError as exc:
        error(f"Could not record the payment.\n  {exc}")
        return

    success(f"Payment of Rs. {money(amount)} recorded as Paid ({method}).")
    row = payment_for(db, reservation_id)
    if row:
        print_record(row, labels={
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
# 2. Record a payment by reservation id (menu entry)
# ----------------------------------------------------------------------
def record_payment(db):
    subtitle("RECORD A PAYMENT")
    try:
        reservation_id = ask_int("Reservation ID", minimum=1)
    except Cancel:
        return
    record_payment_for(db, reservation_id)


# ----------------------------------------------------------------------
# 3. View payments
# ----------------------------------------------------------------------
def view_payments(db):
    subtitle("PAYMENT DETAILS")
    print("  1. All payments")
    print("  2. Only Pending")
    print("  3. Only Paid")
    print("  4. Only Refunded")
    try:
        choice = menu_choice("Choose a filter")
    except Cancel:
        return

    mapping = {"2": "Pending", "3": "Paid", "4": "Refunded"}
    if choice in mapping:
        rows = db.query(
            "SELECT * FROM vw_payment_details WHERE payment_status = %s "
            "ORDER BY payment_id", (mapping[choice],))
    elif choice == "1":
        rows = db.query("SELECT * FROM vw_payment_details ORDER BY payment_id")
    else:
        error("Invalid filter option.")
        return

    show_payments(rows)
    if rows:
        total = sum(r["amount"] for r in rows)
        print(f"\nTotal of the rows shown: Rs. {money(total)}")


# ----------------------------------------------------------------------
# 4. Refund a payment
# ----------------------------------------------------------------------
def refund_payment(db):
    subtitle("MARK A PAYMENT AS REFUNDED")
    try:
        payment_id = ask_int("Payment ID", minimum=1)
    except Cancel:
        return

    row = db.query_one("SELECT * FROM vw_payment_details WHERE payment_id = %s",
                       (payment_id,))
    if not row:
        error(f"No payment with ID {payment_id}.")
        return
    print()
    print_record(row, labels={
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

    if row["payment_status"] == "Refunded":
        warn("This payment is already refunded.")
        return
    if row["payment_status"] != "Paid":
        error("Only a Paid payment can be refunded.")
        return

    if not confirm(f"Refund Rs. {money(row['amount'])} to "
                   f"{row['customer_name']}?"):
        info("Refund cancelled.")
        return

    try:
        db.execute(
            "UPDATE payment SET payment_status = 'Refunded' WHERE payment_id = %s",
            (payment_id,))
    except DatabaseError as exc:
        error(f"Could not update the payment.\n  {exc}")
        return
    success(f"Payment {payment_id} marked as Refunded.")


# ----------------------------------------------------------------------
# 5. Pending payments list (front-desk follow-up)
# ----------------------------------------------------------------------
def pending_payments(db):
    subtitle("PAYMENTS STILL PENDING")
    rows = db.query(
        """
        SELECT * FROM vw_payment_details
        WHERE payment_status = 'Pending'
        ORDER BY payment_id
        """)
    show_payments(rows, empty_message="Every reservation has been paid.")
    if rows:
        total = sum(r["amount"] for r in rows)
        print(f"\nOutstanding amount: Rs. {money(total)}")


# ----------------------------------------------------------------------
# Menu
# ----------------------------------------------------------------------
def menu(db):
    while True:
        title("PAYMENT MANAGEMENT")
        print("  1. Record a payment for a reservation")
        print("  2. View payment details")
        print("  3. Show pending payments")
        print("  4. Mark a payment as refunded")
        print("  0. Back to main menu")
        try:
            choice = menu_choice()
        except Cancel:
            return
        try:
            if choice == "1":
                record_payment(db)
            elif choice == "2":
                view_payments(db)
            elif choice == "3":
                pending_payments(db)
            elif choice == "4":
                refund_payment(db)
            elif choice == "0":
                return
            else:
                error("Invalid option. Please choose a number from the menu.")
                continue
        except DatabaseError as exc:
            error(str(exc))
        pause()
