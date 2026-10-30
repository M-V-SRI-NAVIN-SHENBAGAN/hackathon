"""
make_er_diagram.py
==================
Draws the ER diagram of the Hotel Management System and saves it as
docs/ER_DIAGRAM.png (for the report) and docs/ER_DIAGRAM.svg (vector).

The picture is generated from the same attribute lists that are used in
sql/01_schema.sql, so the diagram cannot drift away from the code.

Run:
    python docs/tools/make_er_diagram.py
Requires: matplotlib  (pip install matplotlib)
"""

from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Polygon

DOCS = Path(__file__).resolve().parent.parent

# ----------------------------------------------------------------------
# Entities: (attribute, key-marker)
#   PK = primary key, FK = foreign key, UQ = UNIQUE constraint
# ----------------------------------------------------------------------
ENTITIES = {
    "CUSTOMER": [
        ("customer_id", "PK"),
        ("full_name", ""),
        ("email", "UQ"),
        ("phone", "UQ"),
        ("address", ""),
        ("id_proof_type", ""),
        ("id_proof_number", "UQ"),
        ("created_at", ""),
    ],
    "ROOM": [
        ("room_id", "PK"),
        ("room_number", "UQ"),
        ("room_type", ""),
        ("floor_no", ""),
        ("price_per_night", ""),
        ("max_occupancy", ""),
        ("status", ""),
        ("created_at", ""),
    ],
    "RESERVATION": [
        ("reservation_id", "PK"),
        ("customer_id", "FK"),
        ("room_id", "FK"),
        ("check_in_date", ""),
        ("check_out_date", ""),
        ("booking_date", ""),
        ("num_guests", ""),
        ("total_amount", ""),
        ("status", ""),
        ("actual_check_in", ""),
        ("actual_check_out", ""),
    ],
    "PAYMENT": [
        ("payment_id", "PK"),
        ("reservation_id", "FK, UQ"),
        ("amount", ""),
        ("payment_method", ""),
        ("payment_status", ""),
        ("payment_date", ""),
        ("transaction_ref", ""),
    ],
}

# (left, bottom, width) in a 160 x 100 canvas
POSITIONS = {
    "CUSTOMER":    (5, 65, 38),
    "ROOM":        (117, 65, 38),
    "RESERVATION": (60, 40, 38),
    "PAYMENT":     (60, 4, 38),
}

ROW_HEIGHT = 2.7
HEADER_HEIGHT = 3.6


def draw_entity(ax, name, attributes, left, bottom, width):
    height = HEADER_HEIGHT + ROW_HEIGHT * len(attributes)

    ax.add_patch(FancyBboxPatch(
        (left, bottom), width, height,
        boxstyle="round,pad=0.35,rounding_size=0.9",
        linewidth=1.6, edgecolor="#123a63", facecolor="#eef4fb", zorder=2))
    ax.add_patch(FancyBboxPatch(
        (left, bottom + height - HEADER_HEIGHT), width, HEADER_HEIGHT,
        boxstyle="round,pad=0.35,rounding_size=0.9",
        linewidth=1.6, edgecolor="#123a63", facecolor="#123a63", zorder=3))
    ax.text(left + width / 2, bottom + height - HEADER_HEIGHT / 2,
            name, ha="center", va="center", color="white",
            fontsize=13, fontweight="bold", zorder=4)

    y = bottom + height - HEADER_HEIGHT - ROW_HEIGHT / 2
    for attribute, marker in attributes:
        ax.text(left + 1.6, y, attribute, ha="left", va="center",
                fontsize=10.4, fontweight=("bold" if marker.startswith("PK")
                                           else "normal"),
                color="#10233a", zorder=4)
        if marker:
            ax.text(left + width - 1.6, y, marker, ha="right", va="center",
                    fontsize=9, color="#a33", zorder=4)
        if marker.startswith("PK"):
            ax.plot([left + 1.5, left + 1.6 + 0.64 * len(attribute)],
                    [y - 1.05, y - 1.05], color="#10233a", linewidth=1,
                    zorder=4)
        y -= ROW_HEIGHT

    return {"left": left, "right": left + width, "bottom": bottom,
            "top": bottom + height, "cx": left + width / 2}


def connect(ax, waypoints, label, card_labels, diamond_at=1):
    """
    Draw a relationship as a polyline through `waypoints`.

    card_labels : list of (x, y, '1' or 'N') - exactly where each
                  cardinality symbol is printed.
    diamond_at  : index of the waypoint used as the centre of the
                  relationship diamond.
    """
    xs = [p[0] for p in waypoints]
    ys = [p[1] for p in waypoints]
    ax.plot(xs, ys, color="#33475b", linewidth=1.6, zorder=1,
            solid_capstyle="round")

    midx, midy = waypoints[diamond_at]
    width, height = 17, 6.6
    ax.add_patch(Polygon(
        [[midx, midy + height / 2], [midx + width / 2, midy],
         [midx, midy - height / 2], [midx - width / 2, midy]],
        closed=True, facecolor="#fff3d6", edgecolor="#8a6d1f",
        linewidth=1.2, zorder=5))
    ax.text(midx, midy, label, ha="center", va="center", fontsize=10,
            color="#4a3a0c", fontweight="bold", zorder=6)

    for x, y, text in card_labels:
        ax.text(x, y, text, ha="center", va="center", fontsize=13.5,
                fontweight="bold", color="#1b5e20", zorder=6)


def main():
    fig, ax = plt.subplots(figsize=(16, 10))
    ax.set_xlim(0, 160)
    ax.set_ylim(0, 100)
    ax.set_aspect("equal")
    ax.axis("off")

    ax.text(80, 97, "HOTEL MANAGEMENT SYSTEM - ENTITY RELATIONSHIP DIAGRAM",
            ha="center", va="center", fontsize=17, fontweight="bold",
            color="#0d1b2a")
    ax.text(80, 93,
            "1 : N   one customer makes many reservations, one room is "
            "booked many times          1 : 1   one reservation has at most "
            "one payment record",
            ha="center", va="center", fontsize=10, color="#33475b")

    a = {name: draw_entity(ax, name, attrs, *POSITIONS[name])
         for name, attrs in ENTITIES.items()}

    cus, room = a["CUSTOMER"], a["ROOM"]
    res, pay = a["RESERVATION"], a["PAYMENT"]

    # CUSTOMER 1 --- N RESERVATION  (down, then right into the box)
    y_link = 52
    connect(ax,
            [(cus["cx"], cus["bottom"]), (cus["cx"], y_link), (res["left"], y_link)],
            "makes",
            [(cus["cx"] + 4.5, cus["bottom"] - 3.5, "1"),
             (res["left"] - 5.5, y_link + 3.5, "N")],
            diamond_at=1)

    # ROOM 1 --- N RESERVATION  (down, then left into the box)
    connect(ax,
            [(room["cx"], room["bottom"]), (room["cx"], y_link), (res["right"], y_link)],
            "booked in",
            [(room["cx"] - 4.5, room["bottom"] - 3.5, "1"),
             (res["right"] + 5.5, y_link + 3.5, "N")],
            diamond_at=1)

    # RESERVATION 1 --- 1 PAYMENT
    gap_middle = (res["bottom"] + pay["top"]) / 2
    connect(ax,
            [(res["cx"], res["bottom"]), (res["cx"], gap_middle),
             (res["cx"], pay["top"])],
            "paid by",
            [(res["cx"] + 13.0, gap_middle + 4.6, "1"),
             (res["cx"] + 13.0, gap_middle - 4.6, "1")],
            diamond_at=1)

    # Legend
    ax.text(5, 30, "How to read an entity box:", fontsize=11.5,
            fontweight="bold", color="#0d1b2a")
    ax.text(5, 25.5,
            "PK   primary key (underlined)\n"
            "FK   foreign key\n"
            "UQ   UNIQUE constraint\n"
            "bold attribute names are key attributes",
            fontsize=10, color="#33475b", va="top", linespacing=1.6)
    ax.text(5, 7,
            "Every foreign key has a matching PRIMARY KEY in its parent "
            "table.\nNOT NULL, CHECK and ON DELETE rules are defined in "
            "sql/01_schema.sql.",
            fontsize=9.4, color="#4a5a6a", style="italic", va="top")

    fig.tight_layout()
    png = DOCS / "ER_DIAGRAM.png"
    svg = DOCS / "ER_DIAGRAM.svg"
    fig.savefig(png, dpi=170, bbox_inches="tight", facecolor="white")
    fig.savefig(svg, bbox_inches="tight", facecolor="white")
    print(f"written: {png}")
    print(f"written: {svg}")


if __name__ == "__main__":
    main()
