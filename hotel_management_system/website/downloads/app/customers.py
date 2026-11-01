"""
customers.py
============
MODULE 1 - CUSTOMER MANAGEMENT

Operations: add, view all, search (by id / name / phone), update, delete.

Every SQL statement uses %s placeholders, so the values typed by the
user are sent to PostgreSQL separately from the SQL text.  This is what
protects the application from SQL injection.
"""

from db import DatabaseError
from ui import (Cancel, ask, ask_choice, ask_email, ask_int, ask_phone,
                confirm, error, info, menu_choice, pause, print_table,
                print_record, success, subtitle, title, warn)

ID_TYPES = ["Aadhaar", "Passport", "Driving Licence", "Voter ID"]

CUSTOMER_COLUMNS = [
    ("customer_id", "ID", 5, "r"),
    ("full_name", "Customer name", 22, "l"),
    ("phone", "Phone", 12, "l"),
    ("email", "Email", 28, "l"),
    ("id_proof_type", "ID type", 16, "l"),
    ("address", "Address", 28, "l"),
]


# ----------------------------------------------------------------------
# Helpers shared with the reservation and payment modules
# ----------------------------------------------------------------------
def customer_exists(db, customer_id: int) -> bool:
    return bool(db.scalar("SELECT 1 FROM customer WHERE customer_id = %s",
                          (customer_id,)))


def show_customers(db, rows):
    print_table(rows, CUSTOMER_COLUMNS)


def choose_customer(db):
    """
    Ask for a customer ID, phone number or (part of a) name, show the
    matching customer(s) and return the chosen customer_id.
    Returns None if the user cancels or nothing matches.
    """
    try:
        keyword = ask("Customer ID / phone / name")
    except Cancel:
        return None

    rows = db.query(
        """
        SELECT customer_id, full_name, phone, email
        FROM customer
        WHERE CAST(customer_id AS TEXT) = %s
           OR phone = %s
           OR LOWER(full_name) LIKE LOWER(%s)
        ORDER BY full_name
        """, (keyword, keyword, f"%{keyword}%"))

    if not rows:
        error(f"No customer matched '{keyword}'. "
              "Add the customer first (Customer Management -> 1).")
        return None

    if len(rows) == 1:
        row = rows[0]
    else:
        show_customers(db, rows)
        try:
            customer_id = ask_int("Enter the Customer ID to select", minimum=1)
        except Cancel:
            return None
        selected = [r for r in rows if r["customer_id"] == customer_id]
        if not selected:
            error("That ID was not in the list above.")
            return None
        row = selected[0]

    info(f"Selected customer: {row['full_name']} "
         f"(ID {row['customer_id']}, phone {row['phone']})")
    return row["customer_id"]


# ----------------------------------------------------------------------
# 1. Add
# ----------------------------------------------------------------------
def add_customer(db):
    subtitle("ADD NEW CUSTOMER")
    print("Enter the customer details. Press ENTER alone to cancel.\n")
    try:
        full_name = ask("Full name")
        email = ask_email()
        phone = ask_phone()
        address = ask("Address", required=False)
        id_type = ask_choice("ID proof type", ID_TYPES)
        id_number = ask("ID proof number")
    except Cancel:
        info("Add customer cancelled.")
        return

    try:
        row = db.execute_returning(
            """
            INSERT INTO customer
                (full_name, email, phone, address, id_proof_type, id_proof_number)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING customer_id, full_name, created_at
            """,
            (full_name, email, phone, address or None, id_type, id_number),
        )
    except DatabaseError as exc:
        error(f"Could not add the customer.\n  {exc}")
        return

    success(f"Customer added successfully. New customer ID = {row['customer_id']}")
    print_record({
        "Customer ID": row["customer_id"],
        "Name": row["full_name"],
        "Registered on": row["created_at"],
    })


# ----------------------------------------------------------------------
# 2. View all
# ----------------------------------------------------------------------
def view_customers(db):
    subtitle("ALL CUSTOMERS")
    rows = db.query(
        """
        SELECT customer_id, full_name, phone, email, id_proof_type, address
        FROM customer
        ORDER BY customer_id
        """)
    show_customers(db, rows)
    print(f"\nTotal customers registered: {len(rows)}")


# ----------------------------------------------------------------------
# 3. Search
# ----------------------------------------------------------------------
def search_customers(db):
    subtitle("SEARCH CUSTOMERS")
    try:
        keyword = ask("Enter customer ID, name (part of name) or phone")
    except Cancel:
        return

    sql = """
        SELECT customer_id, full_name, phone, email, id_proof_type, address
        FROM customer
        WHERE CAST(customer_id AS TEXT) = %s
           OR phone = %s
           OR LOWER(full_name) LIKE LOWER(%s)
        ORDER BY full_name
    """
    rows = db.query(sql, (keyword, keyword, f"%{keyword}%"))
    if not rows:
        warn(f"No customer matched '{keyword}'. Try a shorter name or a phone number.")
        return
    show_customers(db, rows)

    if len(rows) == 1:
        detail = db.query_one(
            """
            SELECT c.customer_id, c.full_name, c.email, c.phone, c.address,
                   c.id_proof_type, c.id_proof_number, c.created_at,
                   COUNT(r.reservation_id) AS total_bookings
            FROM customer c
            LEFT JOIN reservation r ON r.customer_id = c.customer_id
            WHERE c.customer_id = %s
            GROUP BY c.customer_id
            """, (rows[0]["customer_id"],))
        subtitle("CUSTOMER DETAILS")
        print_record(detail, labels={
            "customer_id": "Customer ID",
            "full_name": "Full name",
            "email": "Email",
            "phone": "Phone",
            "address": "Address",
            "id_proof_type": "ID proof type",
            "id_proof_number": "ID proof number",
            "created_at": "Registered on",
            "total_bookings": "Total bookings",
        })


# ----------------------------------------------------------------------
# 4. Update
# ----------------------------------------------------------------------
def update_customer(db):
    subtitle("UPDATE CUSTOMER")
    customer_id = choose_customer(db)
    if customer_id is None:
        return

    current = db.query_one("SELECT * FROM customer WHERE customer_id = %s",
                           (customer_id,))
    print("\nPress ENTER to keep the value shown in brackets.\n")
    try:
        full_name = ask("Full name", default=current["full_name"])
        email = ask_email(default=current["email"])
        phone = ask_phone(default=current["phone"])
        address = ask("Address", default=current["address"] or "-",
                      required=False)
        id_type = ask_choice("ID proof type", ID_TYPES,
                             default=current["id_proof_type"])
        id_number = ask("ID proof number", default=current["id_proof_number"])
    except Cancel:
        info("Update cancelled.")
        return

    try:
        affected = db.execute(
            """
            UPDATE customer
               SET full_name = %s,
                   email = %s,
                   phone = %s,
                   address = %s,
                   id_proof_type = %s,
                   id_proof_number = %s
             WHERE customer_id = %s
            """,
            (full_name, email, phone, None if address in ("", "-") else address,
             id_type, id_number, customer_id))
    except DatabaseError as exc:
        error(f"Could not update the customer.\n  {exc}")
        return

    success(f"Customer {customer_id} updated ({affected} row affected).")


# ----------------------------------------------------------------------
# 5. Delete
# ----------------------------------------------------------------------
def delete_customer(db):
    subtitle("DELETE CUSTOMER")
    customer_id = choose_customer(db)
    if customer_id is None:
        return

    booking_count = db.scalar(
        "SELECT COUNT(*) FROM reservation WHERE customer_id = %s",
        (customer_id,), default=0)
    if booking_count:
        warn(f"This customer has {booking_count} reservation record(s).")
        print("A customer with booking history cannot be deleted because")
        print("reservations must always point to a valid customer")
        print("(referential integrity). Cancel those reservations first if")
        print("the records really must be removed.")
        return

    if not confirm(f"Delete customer {customer_id} permanently?"):
        info("Delete cancelled.")
        return

    try:
        db.execute("DELETE FROM customer WHERE customer_id = %s", (customer_id,))
    except DatabaseError as exc:
        error(f"Could not delete the customer.\n  {exc}")
        return
    success(f"Customer {customer_id} deleted.")


# ----------------------------------------------------------------------
# Menu
# ----------------------------------------------------------------------
def menu(db):
    while True:
        title("CUSTOMER MANAGEMENT")
        print("  1. Add new customer")
        print("  2. View all customers")
        print("  3. Search customer (ID / name / phone)")
        print("  4. Update customer details")
        print("  5. Delete customer")
        print("  0. Back to main menu")
        try:
            choice = menu_choice()
        except Cancel:
            return
        try:
            if choice == "1":
                add_customer(db)
            elif choice == "2":
                view_customers(db)
            elif choice == "3":
                search_customers(db)
            elif choice == "4":
                update_customer(db)
            elif choice == "5":
                delete_customer(db)
            elif choice == "0":
                return
            else:
                error("Invalid option. Please choose a number from the menu.")
                continue
        except DatabaseError as exc:
            error(str(exc))
        pause()
