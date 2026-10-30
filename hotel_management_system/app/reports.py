"""
reports.py
==========
MODULE 6 - REPORTS AND SEARCH

Each function below is one report of the project.  The SQL used is also
useful for the viva: joins, LEFT JOIN, GROUP BY, HAVING, aggregate
functions, subqueries, ORDER BY and views all appear here.
"""

from datetime import date

from db import DatabaseError
from ui import (Cancel, ask, ask_date, error, menu_choice, money,
                pause, print_table, subtitle, title, warn)

import reservations


# ----------------------------------------------------------------------
# 1. All reservations
# ----------------------------------------------------------------------
def all_reservations(db):
    subtitle("REPORT 1: ALL RESERVATIONS")
    rows = db.query(
        "SELECT * FROM vw_reservation_details ORDER BY reservation_id")
    reservations.show_reservations(rows)
    if rows:
        booked = sum(float(r["total_amount"]) for r in rows
                     if r["status"] != "Cancelled")
        print(f"\nBooking value (excluding cancelled): Rs. {money(booked)}")


# ----------------------------------------------------------------------
# 2. Currently occupied rooms
# ----------------------------------------------------------------------
def occupied_rooms(db):
    subtitle("REPORT 2: CURRENTLY OCCUPIED ROOMS")
    rows = db.query(
        """
        SELECT rm.room_number, rm.room_type, rm.price_per_night,
               c.full_name AS guest_name, c.phone,
               r.check_in_date, r.check_out_date,
               (r.check_out_date - CURRENT_DATE) AS days_left
        FROM room rm
        INNER JOIN reservation r
                ON r.room_id = rm.room_id AND r.status = 'CheckedIn'
        INNER JOIN customer c ON c.customer_id = r.customer_id
        ORDER BY rm.room_number
        """)
    print_table(rows, [
        ("room_number", "Room", 6, "l"),
        ("room_type", "Type", 9, "l"),
        ("guest_name", "Guest", 18, "l"),
        ("phone", "Phone", 11, "l"),
        ("check_in_date", "Check-in", 11, "l"),
        ("check_out_date", "Check-out", 11, "l"),
        ("days_left", "Days left", 9, "r"),
        ("price_per_night", "Tariff", 10, "r"),
    ], empty_message="No guest is currently checked in.")
    total_rooms = db.scalar("SELECT COUNT(*) FROM room", default=0)
    if total_rooms:
        print(f"\nOccupancy: {len(rows)} of {total_rooms} rooms "
              f"({len(rows) * 100 / total_rooms:.1f}%)")


# ----------------------------------------------------------------------
# 3. Available rooms
# ----------------------------------------------------------------------
def available_rooms(db):
    subtitle("REPORT 3: ROOMS AVAILABLE RIGHT NOW")
    rows = db.query(
        """
        SELECT room_number, room_type, floor_no, price_per_night,
               max_occupancy
        FROM room
        WHERE status = 'Available'
        ORDER BY price_per_night
        """)
    print_table(rows, [
        ("room_number", "Room", 6, "l"),
        ("room_type", "Type", 9, "l"),
        ("floor_no", "Floor", 6, "r"),
        ("max_occupancy", "Max guests", 11, "r"),
        ("price_per_night", "Price/night", 12, "r"),
    ], empty_message="No room is available right now.")

    maintenance = db.scalar(
        "SELECT COUNT(*) FROM room WHERE status = 'Maintenance'", default=0)
    print(f"\nAvailable: {len(rows)} room(s). "
          f"Under maintenance: {maintenance}.")


# ----------------------------------------------------------------------
# 4. Customer booking history
# ----------------------------------------------------------------------
def customer_history(db):
    subtitle("REPORT 4: CUSTOMER BOOKING HISTORY")
    rows = db.query(
        """
        SELECT customer_id, full_name, phone, total_bookings,
               completed_stays, cancelled_bookings, total_spent
        FROM vw_customer_booking_history
        ORDER BY total_spent DESC, full_name
        """)
    print_table(rows, [
        ("customer_id", "ID", 4, "r"),
        ("full_name", "Customer", 20, "l"),
        ("phone", "Phone", 11, "l"),
        ("total_bookings", "Bookings", 9, "r"),
        ("completed_stays", "Completed", 10, "r"),
        ("cancelled_bookings", "Cancelled", 10, "r"),
        ("total_spent", "Total spent", 13, "r"),
    ])


def one_customer_history(db):
    subtitle("REPORT 4b: BOOKING HISTORY OF ONE CUSTOMER")
    import customers
    customer_id = customers.choose_customer(db)
    if customer_id is None:
        return

    rows = db.query(
        """
        SELECT * FROM vw_reservation_details
        WHERE customer_id = %s
        ORDER BY check_in_date
        """, (customer_id,))
    reservations.show_reservations(
        rows, empty_message="This customer has no bookings.")

    summary = db.query_one(
        "SELECT * FROM vw_customer_booking_history WHERE customer_id = %s",
        (customer_id,))
    if summary:
        print("\nSummary")
        print("  " + "-" * 46)
        print(f"  Total bookings      : {summary['total_bookings']}")
        print(f"  Completed stays     : {summary['completed_stays']}")
        print(f"  Cancelled bookings  : {summary['cancelled_bookings']}")
        print(f"  Total amount spent  : Rs. {money(summary['total_spent'])}")


# ----------------------------------------------------------------------
# 5. Total revenue
# ----------------------------------------------------------------------
def revenue_report(db):
    subtitle("REPORT 5: TOTAL HOTEL REVENUE")
    summary = db.query_one(
        """
        SELECT COUNT(*)               AS paid_transactions,
               COALESCE(SUM(amount), 0)   AS total_revenue,
               COALESCE(AVG(amount), 0)   AS average_payment,
               COALESCE(MIN(amount), 0)   AS smallest_payment,
               COALESCE(MAX(amount), 0)   AS largest_payment
        FROM payment
        WHERE payment_status = 'Paid'
        """)
    print("Revenue collected (payments with status = Paid)\n")
    print("  " + "-" * 52)
    print(f"  Number of paid transactions : {summary['paid_transactions']}")
    print(f"  Total revenue               : Rs. {money(summary['total_revenue'])}")
    print(f"  Average payment             : Rs. {money(summary['average_payment'])}")
    print(f"  Smallest payment            : Rs. {money(summary['smallest_payment'])}")
    print(f"  Largest payment             : Rs. {money(summary['largest_payment'])}")
    print("  " + "-" * 52)

    print("\nRevenue by payment method (GROUP BY)")
    rows = db.query(
        """
        SELECT payment_method, COUNT(*) AS transactions, SUM(amount) AS revenue
        FROM payment
        WHERE payment_status = 'Paid'
        GROUP BY payment_method
        ORDER BY revenue DESC
        """)
    print_table(rows, [
        ("payment_method", "Method", 8, "l"),
        ("transactions", "Transactions", 13, "r"),
        ("revenue", "Revenue", 13, "r"),
    ])

    print("\nRevenue by month (GROUP BY on payment_date)")
    rows = db.query(
        """
        SELECT TO_CHAR(payment_date, 'Mon YYYY') AS month,
               COUNT(*)                          AS transactions,
               SUM(amount)                       AS revenue
        FROM payment
        WHERE payment_status = 'Paid'
        GROUP BY TO_CHAR(payment_date, 'Mon YYYY'),
                 DATE_TRUNC('month', payment_date)
        ORDER BY DATE_TRUNC('month', payment_date)
        """)
    print_table(rows, [
        ("month", "Month", 12, "l"),
        ("transactions", "Transactions", 13, "r"),
        ("revenue", "Revenue", 13, "r"),
    ])

    other = db.query_one(
        """
        SELECT COALESCE(SUM(amount) FILTER (WHERE payment_status = 'Pending'), 0)
                    AS pending,
               COALESCE(SUM(amount) FILTER (WHERE payment_status = 'Refunded'), 0)
                    AS refunded
        FROM payment
        """)
    print(f"\nPending amount : Rs. {money(other['pending'])}")
    print(f"Refunded amount: Rs. {money(other['refunded'])}")


# ----------------------------------------------------------------------
# 6. Most frequently booked room type
# ----------------------------------------------------------------------
def popular_room_type(db):
    subtitle("REPORT 6: MOST FREQUENTLY BOOKED ROOM TYPE")
    rows = db.query(
        """
        SELECT rm.room_type,
               COUNT(*) AS times_booked,
               SUM(r.total_amount) AS booking_value
        FROM reservation r
        INNER JOIN room rm ON rm.room_id = r.room_id
        WHERE r.status <> 'Cancelled'
        GROUP BY rm.room_type
        ORDER BY times_booked DESC, rm.room_type
        """)
    if not rows:
        warn("No confirmed reservations yet.")
        return

    print_table(rows, [
        ("room_type", "Room type", 10, "l"),
        ("times_booked", "Times booked", 13, "r"),
        ("booking_value", "Booking value", 15, "r"),
    ])
    best = rows[0]
    print(f"\nMost frequently booked room type: {best['room_type']} "
          f"({best['times_booked']} confirmed bookings)")


# ----------------------------------------------------------------------
# 7. Occupancy summary
# ----------------------------------------------------------------------
def occupancy_summary(db):
    subtitle("REPORT 7: ROOM STATUS SUMMARY")
    rows = db.query(
        """
        SELECT status,
               COUNT(*) AS rooms,
               ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS percentage
        FROM room
        GROUP BY status
        ORDER BY rooms DESC
        """)
    print_table(rows, [
        ("status", "Room status", 12, "l"),
        ("rooms", "Rooms", 6, "r"),
        ("percentage", "Percentage", 11, "r"),
    ])

    print("\nRoom type performance (reservations + revenue)")
    rows = db.query(
        """
        SELECT rm.room_type,
               COUNT(rm.room_id)                                        AS total_rooms,
               COUNT(r.reservation_id)                                  AS bookings,
               COUNT(r.reservation_id) FILTER (WHERE r.status = 'CheckedIn')
                                                                        AS in_house,
               COALESCE(SUM(r.total_amount) FILTER (WHERE r.status <> 'Cancelled'), 0)
                                                                        AS booking_value
        FROM room rm
        LEFT JOIN reservation r ON r.room_id = rm.room_id
        GROUP BY rm.room_type
        ORDER BY booking_value DESC
        """)
    print_table(rows, [
        ("room_type", "Room type", 10, "l"),
        ("total_rooms", "Rooms", 6, "r"),
        ("bookings", "Bookings", 9, "r"),
        ("in_house", "In house", 9, "r"),
        ("booking_value", "Booking value", 15, "r"),
    ])

    arrivals = db.scalar(
        "SELECT COUNT(*) FROM reservation WHERE check_in_date = CURRENT_DATE",
        default=0)
    departures = db.scalar(
        "SELECT COUNT(*) FROM reservation WHERE check_out_date = CURRENT_DATE",
        default=0)
    in_house = db.scalar(
        "SELECT COUNT(*) FROM reservation WHERE status = 'CheckedIn'",
        default=0)

    print("\nDays business summary")
    print("  " + "-" * 52)
    print(f"  Arrivals today   : {arrivals}")
    print(f"  Departures today : {departures}")
    print(f"  Guests in house  : {in_house}")


# ----------------------------------------------------------------------
# 8. Search reservations
# ----------------------------------------------------------------------
def search_reservations(db):
    subtitle("SEARCH RESERVATIONS")
    print("  1. By customer name / phone / customer ID")
    print("  2. By date (reservations active on that date)")
    print("  3. By status")
    try:
        choice = menu_choice("Choose a search option")
        if choice == "1":
            keyword = ask("Customer name, phone or customer ID")
            rows = db.query(
                """
                SELECT * FROM vw_reservation_details
                WHERE LOWER(customer_name) LIKE LOWER(%s)
                   OR customer_phone = %s
                   OR CAST(customer_id AS TEXT) = %s
                ORDER BY reservation_id
                """, (f"%{keyword}%", keyword, keyword))
        elif choice == "2":
            day = ask_date("Date (YYYY-MM-DD)", default=str(date.today()))
            rows = db.query(
                """
                SELECT * FROM vw_reservation_details
                WHERE %s BETWEEN check_in_date AND check_out_date - 1
                  AND status <> 'Cancelled'
                ORDER BY room_number
                """, (day,))
            print(f"\nReservations staying on {day}:")
        elif choice == "3":
            status = ask("Status (Booked / CheckedIn / CheckedOut / Cancelled)")
            rows = db.query(
                "SELECT * FROM vw_reservation_details WHERE status = %s "
                "ORDER BY reservation_id", (status,))
        else:
            error("Invalid search option.")
            return
    except Cancel:
        return

    reservations.show_reservations(
        rows, empty_message="No reservation matched your search.")


# ----------------------------------------------------------------------
# Menu
# ----------------------------------------------------------------------
def menu(db):
    while True:
        title("REPORTS AND SEARCH")
        print("  1. All reservations")
        print("  2. Currently occupied rooms")
        print("  3. Available rooms")
        print("  4. Customer booking history (all customers)")
        print("  5. Booking history of one customer")
        print("  6. Total hotel revenue")
        print("  7. Most frequently booked room type")
        print("  8. Room status / occupancy summary")
        print("  9. Search reservations")
        print("  0. Back to main menu")
        try:
            choice = menu_choice()
        except Cancel:
            return
        try:
            if choice == "1":
                all_reservations(db)
            elif choice == "2":
                occupied_rooms(db)
            elif choice == "3":
                available_rooms(db)
            elif choice == "4":
                customer_history(db)
            elif choice == "5":
                one_customer_history(db)
            elif choice == "6":
                revenue_report(db)
            elif choice == "7":
                popular_room_type(db)
            elif choice == "8":
                occupancy_summary(db)
            elif choice == "9":
                search_reservations(db)
            elif choice == "0":
                return
            else:
                error("Invalid option. Please choose a number from the menu.")
                continue
        except DatabaseError as exc:
            error(str(exc))
        pause()
