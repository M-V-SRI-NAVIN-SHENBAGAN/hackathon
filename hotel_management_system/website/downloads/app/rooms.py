"""
rooms.py
========
MODULE 2 - ROOM MANAGEMENT

Operations: add a room, list all rooms, list available rooms, view the
tariff of each category, update room details / status.

`status` is the CURRENT physical state of a room:
    Available   - nobody is inside, can be sold
    Occupied    - a guest has checked in
    Maintenance - out of service
Date-wise availability (for a future stay) is calculated separately from
the reservation table, see reservations.py.
"""

from db import DatabaseError
from ui import (Cancel, ask, ask_choice, ask_int, ask_money, error,
                info, menu_choice, money, pause, print_table, print_record,
                success, subtitle, title)

ROOM_TYPES = ["Single", "Double", "Deluxe", "Suite"]
ROOM_STATUSES = ["Available", "Occupied", "Maintenance"]

# Occupancy limit suggested for each category.
DEFAULT_OCCUPANCY = {"Single": 1, "Double": 2, "Deluxe": 3, "Suite": 4}

ROOM_COLUMNS = [
    ("room_id", "ID", 4, "r"),
    ("room_number", "Room", 6, "l"),
    ("room_type", "Type", 9, "l"),
    ("floor_no", "Floor", 6, "r"),
    ("price_per_night", "Price/night", 12, "r"),
    ("max_occupancy", "Max guests", 11, "r"),
    ("status", "Status", 12, "l"),
]


# ----------------------------------------------------------------------
# Helpers used by other modules
# ----------------------------------------------------------------------
def get_room(db, room_id: int):
    return db.query_one("SELECT * FROM room WHERE room_id = %s", (room_id,))


def show_rooms(rows, empty_message="No rooms found."):
    print_table(rows, ROOM_COLUMNS, empty_message=empty_message)


def available_rooms_for_dates(db, check_in, check_out):
    """
    Return the rooms that are free for the whole stay.

    A room is free when no active reservation (Booked or CheckedIn)
    overlaps the requested dates.  Two ranges overlap when
        existing.check_in_date  < requested.check_out_date
    AND existing.check_out_date > requested.check_in_date
    Rooms under maintenance are never offered.
    """
    return db.query(
        """
        SELECT rm.room_id, rm.room_number, rm.room_type, rm.floor_no,
               rm.price_per_night, rm.max_occupancy, rm.status
        FROM room rm
        WHERE rm.status <> 'Maintenance'
          AND NOT EXISTS (
                SELECT 1
                FROM reservation r
                WHERE r.room_id = rm.room_id
                  AND r.status IN ('Booked', 'CheckedIn')
                  AND r.check_in_date  < %s
                  AND r.check_out_date > %s
              )
        ORDER BY rm.price_per_night, rm.room_number
        """, (check_out, check_in))


# ----------------------------------------------------------------------
# 1. Add room
# ----------------------------------------------------------------------
def add_room(db):
    subtitle("ADD NEW ROOM")
    print("Press ENTER alone to cancel.\n")
    try:
        room_number = ask("Room number (e.g. 113)")
        room_type = ask_choice("Room type", ROOM_TYPES)
        floor_no = ask_int("Floor number", minimum=0, maximum=20,
                           default=1)
        price = ask_money("Price per night (Rs.)")
        max_occupancy = ask_int(
            "Maximum guests",
            minimum=1, maximum=6,
            default=DEFAULT_OCCUPANCY[room_type])
        status = ask_choice("Initial status", ROOM_STATUSES,
                            default="Available")
    except Cancel:
        info("Add room cancelled.")
        return

    try:
        row = db.execute_returning(
            """
            INSERT INTO room
                (room_number, room_type, floor_no, price_per_night,
                 max_occupancy, status)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING room_id, room_number
            """,
            (room_number, room_type, floor_no, price, max_occupancy, status))
    except DatabaseError as exc:
        error(f"Could not add the room.\n  {exc}")
        return

    success(f"Room {row['room_number']} added with ID {row['room_id']}.")


# ----------------------------------------------------------------------
# 2. View all rooms
# ----------------------------------------------------------------------
def view_rooms(db):
    subtitle("ALL ROOMS")
    rows = db.query(
        """
        SELECT room_id, room_number, room_type, floor_no, price_per_night,
               max_occupancy, status
        FROM room
        ORDER BY room_number
        """)
    show_rooms(rows)
    if rows:
        total = sum(r["price_per_night"] for r in rows)
        print(f"\nTotal rooms: {len(rows)}   "
              f"Sum of tariffs: Rs. {money(total)}   "
              f"Average tariff: Rs. {money(total / len(rows))}")


# ----------------------------------------------------------------------
# 3. Available rooms
# ----------------------------------------------------------------------
def view_available_rooms(db):
    subtitle("AVAILABLE ROOMS (currently free)")
    rows = db.query(
        """
        SELECT room_id, room_number, room_type, floor_no, price_per_night,
               max_occupancy, status
        FROM room
        WHERE status = 'Available'
        ORDER BY price_per_night, room_number
        """)
    show_rooms(rows, empty_message="No room is free at the moment.")
    print("\nNote: use 'Reservation -> Check availability for dates' to")
    print("check rooms for a FUTURE stay (availability depends on dates).")


# ----------------------------------------------------------------------
# 4. Tariff by category
# ----------------------------------------------------------------------
def view_tariff(db):
    subtitle("TARIFF AND AVAILABILITY BY ROOM TYPE")
    rows = db.query(
        """
        SELECT room_type,
               COUNT(*)                                     AS total_rooms,
               COUNT(*) FILTER (WHERE status = 'Available')  AS available,
               COUNT(*) FILTER (WHERE status = 'Occupied')   AS occupied,
               MIN(price_per_night)                          AS min_price,
               MAX(price_per_night)                          AS max_price,
               ROUND(AVG(price_per_night), 2)                AS avg_price
        FROM room
        GROUP BY room_type
        ORDER BY avg_price
        """)
    print_table(rows, [
        ("room_type", "Room type", 10, "l"),
        ("total_rooms", "Total", 6, "r"),
        ("available", "Available", 10, "r"),
        ("occupied", "Occupied", 9, "r"),
        ("min_price", "Min price", 11, "r"),
        ("max_price", "Max price", 11, "r"),
        ("avg_price", "Avg price", 11, "r"),
    ], empty_message="No rooms defined yet.")


# ----------------------------------------------------------------------
# 5. Update room
# ----------------------------------------------------------------------
def update_room(db):
    subtitle("UPDATE ROOM DETAILS")
    try:
        room_id = ask_int("Room ID to update", minimum=1)
    except Cancel:
        return

    room = get_room(db, room_id)
    if not room:
        error(f"No room with ID {room_id}.")
        return
    print("\nCurrent values are shown in brackets; press ENTER to keep them.\n")
    print_record(room, labels={
        "room_id": "Room ID", "room_number": "Room number",
        "room_type": "Type", "floor_no": "Floor",
        "price_per_night": "Price/night", "max_occupancy": "Max guests",
        "status": "Status", "created_at": "Created",
    })
    print()

    try:
        room_number = ask("Room number", default=room["room_number"])
        room_type = ask_choice("Room type", ROOM_TYPES, default=room["room_type"])
        floor_no = ask_int("Floor number", 0, 20, default=room["floor_no"])
        price = ask_money("Price per night", default=str(room["price_per_night"]))
        max_occupancy = ask_int("Maximum guests", 1, 6,
                                default=room["max_occupancy"])
        status = ask_choice("Status", ROOM_STATUSES, default=room["status"])
    except Cancel:
        info("Update cancelled.")
        return

    # Business check: a room with a guest inside cannot be set to Available.
    active = db.scalar(
        """
        SELECT COUNT(*) FROM reservation
        WHERE room_id = %s AND status = 'CheckedIn'
        """, (room_id,), default=0)
    if active and status == "Available":
        error("This room has a checked-in guest; check the guest out first.")
        return

    try:
        affected = db.execute(
            """
            UPDATE room
               SET room_number = %s, room_type = %s, floor_no = %s,
                   price_per_night = %s, max_occupancy = %s, status = %s
             WHERE room_id = %s
            """,
            (room_number, room_type, floor_no, price, max_occupancy,
             status, room_id))
    except DatabaseError as exc:
        error(f"Could not update the room.\n  {exc}")
        return
    success(f"Room {room_id} updated ({affected} row affected).")


# ----------------------------------------------------------------------
# Menu
# ----------------------------------------------------------------------
def menu(db):
    while True:
        title("ROOM MANAGEMENT")
        print("  1. Add new room")
        print("  2. View all rooms")
        print("  3. View available rooms")
        print("  4. View tariff / occupancy by room type")
        print("  5. Update room details or status")
        print("  0. Back to main menu")
        try:
            choice = menu_choice()
        except Cancel:
            return
        try:
            if choice == "1":
                add_room(db)
            elif choice == "2":
                view_rooms(db)
            elif choice == "3":
                view_available_rooms(db)
            elif choice == "4":
                view_tariff(db)
            elif choice == "5":
                update_room(db)
            elif choice == "0":
                return
            else:
                error("Invalid option. Please choose a number from the menu.")
                continue
        except DatabaseError as exc:
            error(str(exc))
        pause()
