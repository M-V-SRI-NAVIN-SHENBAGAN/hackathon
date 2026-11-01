/* =====================================================================
   demo.js — browser simulation of the Python/psycopg2 application.

   The model below mirrors the rules implemented in app/*.py:
     * unique e-mail, phone, ID number and room number
     * 10-digit phone, name with at least 3 characters
     * check-out after check-in
     * a room is free only when no Booked/CheckedIn reservation overlaps
     * bill = nights * price_per_night
     * one payment per reservation, status Pending -> Paid -> Refunded
     * check-in / check-out update reservation AND room together

   `window.HMSModel` is pure (no DOM) so it can be tested with Node.
   ===================================================================== */
(function () {
  "use strict";

  var STORAGE_KEY = "hms-site-demo-v1";
  var ROOM_TYPES = ["Single", "Double", "Deluxe", "Suite"];
  var ID_TYPES = ["Aadhaar", "Passport", "Driving Licence", "Voter ID"];
  var METHODS = ["Cash", "Card", "UPI"];

  /* ------------------------------------------------------------------
     Small helpers
     ------------------------------------------------------------------ */
  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function isoToday() {
    var now = new Date();
    var offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
  }

  function addDays(iso, days) {
    var d = new Date(iso + "T00:00:00");
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function nights(checkIn, checkOut) {
    var a = new Date(checkIn + "T00:00:00");
    var b = new Date(checkOut + "T00:00:00");
    return Math.round((b - a) / 86400000);
  }

  function isValidDate(text) {
    return /^\d{4}-\d{2}-\d{2}$/.test(text) && !isNaN(new Date(text + "T00:00:00"));
  }

  function money(value) {
    return Number(value).toLocaleString("en-IN", {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    });
  }

  function round2(value) { return Math.round(value * 100) / 100; }

  /* ------------------------------------------------------------------
     State
     ------------------------------------------------------------------ */
  function createState(sample) {
    var state = clone(sample);
    state.seq = {
      customer: maxId(state.customers, "customer_id"),
      room: maxId(state.rooms, "room_id"),
      reservation: maxId(state.reservations, "reservation_id"),
      payment: maxId(state.payments, "payment_id")
    };
    return state;
  }

  function maxId(rows, field) {
    return rows.reduce(function (best, row) {
      return Math.max(best, Number(row[field]) || 0);
    }, 0);
  }

  function nextId(state, kind) {
    state.seq[kind] = (state.seq[kind] || 0) + 1;
    return state.seq[kind];
  }

  /* ------------------------------------------------------------------
     Lookups
     ------------------------------------------------------------------ */
  function room(state, roomId) {
    return state.rooms.find(function (r) { return r.room_id === Number(roomId); });
  }
  function customer(state, customerId) {
    return state.customers.find(function (c) { return c.customer_id === Number(customerId); });
  }
  function reservation(state, id) {
    return state.reservations.find(function (r) { return r.reservation_id === Number(id); });
  }
  function paymentFor(state, reservationId) {
    return state.payments.find(function (p) { return p.reservation_id === Number(reservationId); });
  }

  function overlaps(startA, endA, startB, endB) {
    return startA < endB && endA > startB;   // ISO dates compare as strings
  }

  function availableRooms(state, checkIn, checkOut, guests) {
    return state.rooms.filter(function (r) {
      if (r.status === "Maintenance") return false;
      if (guests && r.max_occupancy < Number(guests)) return false;
      var blocked = state.reservations.some(function (res) {
        return res.room_id === r.room_id &&
          (res.status === "Booked" || res.status === "CheckedIn") &&
          overlaps(res.check_in_date, res.check_out_date, checkIn, checkOut);
      });
      return !blocked;
    }).sort(function (a, b) {
      return a.price_per_night - b.price_per_night || a.room_number.localeCompare(b.room_number);
    });
  }

  /* ------------------------------------------------------------------
     Customers
     ------------------------------------------------------------------ */
  function validateCustomer(state, data, ignoreId) {
    var name = (data.full_name || "").trim();
    if (name.length < 3) return "Full name must contain at least 3 characters (CHECK constraint).";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email || ""))
      return "Invalid e-mail address, for example guest@example.com.";
    if (!/^\d{10}$/.test(data.phone || ""))
      return "Phone number must contain exactly 10 digits (CHECK constraint).";
    if (!(data.id_proof_number || "").trim())
      return "ID proof number cannot be empty (NOT NULL constraint).";
    if (!ID_TYPES.includes(data.id_proof_type))
      return "ID proof type must be one of: " + ID_TYPES.join(", ") + ".";
    var duplicate = state.customers.find(function (c) {
      return c.customer_id !== ignoreId &&
        (c.email.toLowerCase() === data.email.toLowerCase() ||
         c.phone === data.phone ||
         c.id_proof_number === data.id_proof_number);
    });
    if (duplicate) {
      if (duplicate.email.toLowerCase() === data.email.toLowerCase())
        return "A record with this e-mail already exists (UNIQUE constraint).";
      if (duplicate.phone === data.phone)
        return "A record with this phone number already exists (UNIQUE constraint).";
      return "A record with this ID proof number already exists (UNIQUE constraint).";
    }
    return null;
  }

  function addCustomer(state, data) {
    var problem = validateCustomer(state, data, null);
    if (problem) return { ok: false, error: problem };
    var row = {
      customer_id: nextId(state, "customer"),
      full_name: data.full_name.trim(),
      email: data.email.trim().toLowerCase(),
      phone: data.phone,
      address: (data.address || "").trim() || null,
      id_proof_type: data.id_proof_type,
      id_proof_number: data.id_proof_number.trim()
    };
    state.customers.push(row);
    return {
      ok: true, customer: row,
      message: "Customer #" + row.customer_id + " (" + row.full_name + ") added.",
      statements: [{
        sql: "INSERT INTO customer\n    (full_name, email, phone, address, id_proof_type, id_proof_number)\nVALUES (%s, %s, %s, %s, %s, %s)\nRETURNING customer_id;",
        params: [row.full_name, row.email, row.phone, row.address, row.id_proof_type, row.id_proof_number]
      }]
    };
  }

  function deleteCustomer(state, customerId) {
    var bookings = state.reservations.filter(function (r) { return r.customer_id === Number(customerId); });
    if (bookings.length) {
      return {
        ok: false,
        error: "This customer has " + bookings.length + " reservation(s); deleting would violate " +
               "the FOREIGN KEY (ON DELETE RESTRICT). Cancel the reservations first.",
        statements: [{
          sql: "-- DELETE FROM customer WHERE customer_id = %s;\n-- ERROR: update or delete on table \"customer\" violates foreign key constraint \"fk_reservation_customer\"",
          params: [Number(customerId)]
        }]
      };
    }
    var index = state.customers.findIndex(function (c) { return c.customer_id === Number(customerId); });
    var name = state.customers[index].full_name;
    state.customers.splice(index, 1);
    return {
      ok: true, message: "Customer #" + customerId + " (" + name + ") deleted.",
      statements: [{ sql: "DELETE FROM customer WHERE customer_id = %s;", params: [Number(customerId)] }]
    };
  }

  /* ------------------------------------------------------------------
     Rooms
     ------------------------------------------------------------------ */
  function addRoom(state, data) {
    if (!/^[A-Za-z0-9-]{1,10}$/.test(data.room_number || ""))
      return { ok: false, error: "Room number must be 1-10 letters/digits." };
    if (state.rooms.some(function (r) { return r.room_number === data.room_number; }))
      return { ok: false, error: "Room number " + data.room_number + " already exists (UNIQUE constraint)." };
    if (!ROOM_TYPES.includes(data.room_type))
      return { ok: false, error: "Room type must be one of: " + ROOM_TYPES.join(", ") + "." };
    if (!(data.price_per_night > 0)) return { ok: false, error: "Price per night must be greater than 0." };
    if (!(data.max_occupancy >= 1 && data.max_occupancy <= 6))
      return { ok: false, error: "Maximum guests must be between 1 and 6." };
    var row = {
      room_id: nextId(state, "room"),
      room_number: String(data.room_number),
      room_type: data.room_type,
      floor_no: Number(data.floor_no || 1),
      price_per_night: round2(Number(data.price_per_night)),
      max_occupancy: Number(data.max_occupancy),
      status: data.status || "Available"
    };
    state.rooms.push(row);
    return {
      ok: true, message: "Room " + row.room_number + " added (room_id " + row.room_id + ").",
      statements: [{
        sql: "INSERT INTO room\n    (room_number, room_type, floor_no, price_per_night,\n     max_occupancy, status)\nVALUES (%s, %s, %s, %s, %s, %s)\nRETURNING room_id;",
        params: [row.room_number, row.room_type, row.floor_no, row.price_per_night,
                 row.max_occupancy, row.status]
      }]
    };
  }

  function setRoomStatus(state, roomId, status) {
    var row = room(state, roomId);
    if (!row) return { ok: false, error: "Room not found." };
    var inHouse = state.reservations.some(function (r) {
      return r.room_id === row.room_id && r.status === "CheckedIn";
    });
    if (inHouse && status === "Available")
      return { ok: false, error: "A guest is checked in — check the guest out first." };
    if (inHouse && status === "Maintenance")
      return { ok: false, error: "A guest is checked in — the room cannot go under maintenance." };
    row.status = status;
    return {
      ok: true, message: "Room " + row.room_number + " is now " + status + ".",
      statements: [{ sql: "UPDATE room SET status = %s WHERE room_id = %s;", params: [status, row.room_id] }]
    };
  }

  /* ------------------------------------------------------------------
     Reservations
     ------------------------------------------------------------------ */
  function bookRoom(state, data) {
    var who = customer(state, data.customer_id);
    if (!who) return { ok: false, error: "Select a customer first." };
    if (!isValidDate(data.check_in_date) || !isValidDate(data.check_out_date))
      return { ok: false, error: "Both dates are required (YYYY-MM-DD)." };
    if (data.check_out_date <= data.check_in_date)
      return { ok: false, error: "Check-out date must be after the check-in date (CHECK constraint)." };
    var stay = nights(data.check_in_date, data.check_out_date);
    if (!(data.num_guests >= 1 && data.num_guests <= 6))
      return { ok: false, error: "Number of guests must be between 1 and 6." };
    var chosen = room(state, data.room_id);
    if (!chosen) return { ok: false, error: "Select an available room." };
    if (chosen.status === "Maintenance")
      return { ok: false, error: "Room " + chosen.room_number + " is under maintenance." };
    if (chosen.max_occupancy < Number(data.num_guests))
      return { ok: false, error: "Room " + chosen.room_number + " allows at most " +
                chosen.max_occupancy + " guest(s)." };
    var free = availableRooms(state, data.check_in_date, data.check_out_date, data.num_guests)
      .some(function (r) { return r.room_id === chosen.room_id; });
    if (!free) {
      return {
        ok: false,
        error: "Room " + chosen.room_number + " is already booked for those dates " +
               "(overlapping reservation) — the application re-checks availability before inserting.",
        statements: [{
          sql: "-- Availability re-check before INSERT\nSELECT COUNT(*) FROM room rm\nWHERE rm.room_id = %s\n  AND NOT EXISTS (SELECT 1 FROM reservation r\n                  WHERE r.room_id = rm.room_id\n                    AND r.status IN ('Booked','CheckedIn')\n                    AND r.check_in_date  < %s\n                    AND r.check_out_date > %s);\n-- result: 0 rows -> booking refused",
          params: [chosen.room_id, data.check_out_date, data.check_in_date]
        }]
      };
    }

    var total = round2(stay * Number(chosen.price_per_night));
    var row = {
      reservation_id: nextId(state, "reservation"),
      customer_id: who.customer_id,
      room_id: chosen.room_id,
      check_in_date: data.check_in_date,
      check_out_date: data.check_out_date,
      booking_date: isoToday(),
      num_guests: Number(data.num_guests),
      total_amount: total,
      status: "Booked",
      actual_check_in: null,
      actual_check_out: null
    };
    state.reservations.push(row);

    var pay = {
      payment_id: nextId(state, "payment"),
      reservation_id: row.reservation_id,
      amount: total,
      payment_method: "Cash",
      payment_status: "Pending",
      payment_date: isoToday(),
      transaction_ref: null
    };
    state.payments.push(pay);

    return {
      ok: true,
      reservation: row,
      message: "Reservation #" + row.reservation_id + " confirmed — " + stay +
               " night(s) in room " + chosen.room_number + " for ₹ " + money(total) + ". Payment is Pending.",
      statements: [
        {
          sql: "INSERT INTO reservation\n    (customer_id, room_id, check_in_date, check_out_date,\n     booking_date, num_guests, total_amount, status)\nVALUES (%s, %s, %s, %s, CURRENT_DATE, %s, %s, 'Booked')\nRETURNING reservation_id;",
          params: [row.customer_id, row.room_id, row.check_in_date, row.check_out_date,
                   row.num_guests, row.total_amount]
        },
        {
          sql: "INSERT INTO payment\n    (reservation_id, amount, payment_method, payment_status)\nVALUES (%s, %s, 'Cash', 'Pending');",
          params: [row.reservation_id, row.total_amount]
        }
      ]
    };
  }

  function cancelReservation(state, reservationId) {
    var res = reservation(state, reservationId);
    if (!res) return { ok: false, error: "Reservation not found." };
    if (res.status === "Cancelled") return { ok: false, error: "This reservation is already cancelled." };
    if (res.status === "CheckedIn")
      return { ok: false, error: "The guest is checked in — check the guest out first." };
    if (res.status === "CheckedOut")
      return { ok: false, error: "Completed stays cannot be cancelled." };

    res.status = "Cancelled";
    var pay = paymentFor(state, res.reservation_id);
    var statements = [{
      sql: "UPDATE reservation SET status = 'Cancelled'\nWHERE reservation_id = %s;",
      params: [res.reservation_id]
    }];
    if (pay && pay.payment_status === "Paid") {
      pay.payment_status = "Refunded";
      statements.push({
        sql: "UPDATE payment SET payment_status = 'Refunded'\nWHERE reservation_id = %s;",
        params: [res.reservation_id]
      });
    } else if (pay && pay.payment_status === "Pending") {
      state.payments.splice(state.payments.indexOf(pay), 1);
      statements.push({
        sql: "DELETE FROM payment WHERE reservation_id = %s;",
        params: [res.reservation_id]
      });
    }
    return {
      ok: true, message: "Reservation #" + res.reservation_id + " cancelled — the room is free for those dates again.",
      statements: statements
    };
  }

  /* ------------------------------------------------------------------
     Front desk
     ------------------------------------------------------------------ */
  function checkIn(state, reservationId) {
    var res = reservation(state, reservationId);
    if (!res) return { ok: false, error: "Reservation not found." };
    if (res.status === "CheckedIn") return { ok: false, error: "This guest has already been checked in." };
    if (res.status !== "Booked")
      return { ok: false, error: "A reservation with status '" + res.status + "' cannot be checked in." };
    if (res.check_in_date > isoToday())
      return { ok: false, error: "Check-in date is " + res.check_in_date + " (in the future)." };
    var r = room(state, res.room_id);
    if (r.status === "Maintenance") return { ok: false, error: "The room is under maintenance." };
    if (r.status === "Occupied") return { ok: false, error: "The room is already occupied." };

    res.status = "CheckedIn";
    res.actual_check_in = isoToday() + " 14:00";
    r.status = "Occupied";
    return {
      ok: true,
      message: "Checked in: " + customer(state, res.customer_id).full_name +
               " → room " + r.room_number + ". Reservation is CheckedIn, room is Occupied.",
      statements: [
        {
          sql: "-- one transaction: reservation + room\nUPDATE reservation\n   SET status = 'CheckedIn', actual_check_in = CURRENT_TIMESTAMP\n WHERE reservation_id = %s AND status = 'Booked';",
          params: [res.reservation_id]
        },
        {
          sql: "UPDATE room SET status = 'Occupied'\n WHERE room_id = %s AND status = 'Available';",
          params: [r.room_id]
        }
      ]
    };
  }

  function checkOut(state, reservationId) {
    var res = reservation(state, reservationId);
    if (!res) return { ok: false, error: "Reservation not found." };
    if (res.status === "CheckedOut") return { ok: false, error: "This guest has already been checked out." };
    if (res.status !== "CheckedIn")
      return { ok: false, error: "A reservation with status '" + res.status + "' cannot be checked out." };
    var r = room(state, res.room_id);
    var pay = paymentFor(state, res.reservation_id);

    res.status = "CheckedOut";
    res.actual_check_out = isoToday() + " 11:00";
    r.status = "Available";
    return {
      ok: true,
      warning: pay && pay.payment_status !== "Paid"
        ? "Note: the bill of ₹ " + money(res.total_amount) + " is still " +
          pay.payment_status.toLowerCase() + "."
        : null,
      message: "Checked out: room " + r.room_number + " is Available again; reservation is CheckedOut.",
      statements: [
        {
          sql: "-- one transaction: reservation + room\nUPDATE reservation\n   SET status = 'CheckedOut', actual_check_out = CURRENT_TIMESTAMP\n WHERE reservation_id = %s AND status = 'CheckedIn';",
          params: [res.reservation_id]
        },
        {
          sql: "UPDATE room SET status = 'Available' WHERE room_id = %s;",
          params: [r.room_id]
        }
      ]
    };
  }

  /* ------------------------------------------------------------------
     Payments
     ------------------------------------------------------------------ */
  function recordPayment(state, reservationId, method, reference) {
    var res = reservation(state, reservationId);
    if (!res) return { ok: false, error: "Reservation not found." };
    if (res.status === "Cancelled") return { ok: false, error: "Cancelled reservations cannot be paid." };
    if (!METHODS.includes(method)) return { ok: false, error: "Payment method must be Cash, Card or UPI." };
    var pay = paymentFor(state, res.reservation_id);
    if (pay && pay.payment_status === "Paid")
      return { ok: false, error: "This reservation is already paid." };

    if (pay) {
      pay.payment_status = "Paid";
      pay.payment_method = method;
      pay.amount = res.total_amount;
      pay.payment_date = isoToday();
      pay.transaction_ref = reference || null;
    } else {
      pay = {
        payment_id: nextId(state, "payment"),
        reservation_id: res.reservation_id,
        amount: res.total_amount,
        payment_method: method,
        payment_status: "Paid",
        payment_date: isoToday(),
        transaction_ref: reference || null
      };
      state.payments.push(pay);
    }
    return {
      ok: true,
      message: "Payment of ₹ " + money(res.total_amount) + " recorded as Paid (" + method + ").",
      statements: [{
        sql: "UPDATE payment\n   SET payment_status = 'Paid', payment_method = %s,\n       amount = %s, payment_date = CURRENT_TIMESTAMP,\n       transaction_ref = %s\n WHERE payment_id = %s;",
        params: [method, res.total_amount, reference || null, pay.payment_id]
      }]
    };
  }

  function refundPayment(state, paymentId) {
    var pay = state.payments.find(function (p) { return p.payment_id === Number(paymentId); });
    if (!pay) return { ok: false, error: "Payment not found." };
    if (pay.payment_status === "Refunded") return { ok: false, error: "Already refunded." };
    if (pay.payment_status !== "Paid") return { ok: false, error: "Only a Paid payment can be refunded." };
    pay.payment_status = "Refunded";
    return {
      ok: true, message: "Payment #" + pay.payment_id + " marked Refunded.",
      statements: [{
        sql: "UPDATE payment SET payment_status = 'Refunded'\nWHERE payment_id = %s;",
        params: [pay.payment_id]
      }]
    };
  }

  /* ------------------------------------------------------------------
     Reports (the same aggregates the SQL queries calculate)
     ------------------------------------------------------------------ */
  function reports(state) {
    var paid = state.payments.filter(function (p) { return p.payment_status === "Paid"; });
    var pending = state.payments.filter(function (p) { return p.payment_status === "Pending"; });
    var refunded = state.payments.filter(function (p) { return p.payment_status === "Refunded"; });
    var sum = function (rows) {
      return round2(rows.reduce(function (t, r) { return t + Number(r.amount); }, 0));
    };

    var byMethod = METHODS.map(function (method) {
      var rows = paid.filter(function (p) { return p.payment_method === method; });
      return { method: method, count: rows.length, total: sum(rows) };
    });

    var byType = {};
    ROOM_TYPES.forEach(function (type) { byType[type] = 0; });
    state.reservations.forEach(function (res) {
      if (res.status === "Cancelled") return;
      var r = room(state, res.room_id);
      if (r) byType[r.room_type] = (byType[r.room_type] || 0) + 1;
    });
    var popular = Object.keys(byType).sort(function (a, b) {
      return byType[b] - byType[a] || a.localeCompare(b);
    })[0];

    var occupied = state.rooms.filter(function (r) { return r.status === "Occupied"; }).length;
    var available = state.rooms.filter(function (r) { return r.status === "Available"; }).length;
    var maintenance = state.rooms.filter(function (r) { return r.status === "Maintenance"; }).length;
    var inHouse = state.reservations.filter(function (r) { return r.status === "CheckedIn"; }).length;
    var bookingValue = round2(state.reservations
      .filter(function (r) { return r.status !== "Cancelled"; })
      .reduce(function (t, r) { return t + Number(r.total_amount); }, 0));

    var history = state.customers.map(function (c) {
      var rows = state.reservations.filter(function (r) { return r.customer_id === c.customer_id; });
      return {
        customer_id: c.customer_id,
        full_name: c.full_name,
        bookings: rows.length,
        completed: rows.filter(function (r) { return r.status === "CheckedOut"; }).length,
        cancelled: rows.filter(function (r) { return r.status === "Cancelled"; }).length,
        spent: round2(rows.filter(function (r) { return r.status !== "Cancelled"; })
          .reduce(function (t, r) { return t + Number(r.total_amount); }, 0))
      };
    }).sort(function (a, b) { return b.spent - a.spent || a.full_name.localeCompare(b.full_name); });

    return {
      revenue: sum(paid), paidCount: paid.length,
      pending: sum(pending), pendingCount: pending.length,
      refunded: sum(refunded), refundedCount: refunded.length,
      average: paid.length ? round2(sum(paid) / paid.length) : 0,
      largest: paid.length ? Math.max.apply(null, paid.map(function (p) { return Number(p.amount); })) : 0,
      byMethod: byMethod, byType: byType, popular: popular,
      popularCount: byType[popular], occupied: occupied, available: available,
      maintenance: maintenance, inHouse: inHouse, bookingValue: bookingValue,
      totalRooms: state.rooms.length, history: history
    };
  }

  var Model = {
    createState: createState, addCustomer: addCustomer, deleteCustomer: deleteCustomer,
    addRoom: addRoom, setRoomStatus: setRoomStatus, bookRoom: bookRoom,
    cancelReservation: cancelReservation, checkIn: checkIn, checkOut: checkOut,
    recordPayment: recordPayment, refundPayment: refundPayment, reports: reports,
    availableRooms: availableRooms, nights: nights, money: money, addDays: addDays,
    todayISO: isoToday, customer: customer, room: room, reservation: reservation,
    paymentFor: paymentFor, ROOM_TYPES: ROOM_TYPES, ID_TYPES: ID_TYPES, METHODS: METHODS,
    isValidDate: isValidDate
  };

  if (typeof window !== "undefined") window.HMSModel = Model;

  /* ==================================================================
     Browser UI
     ================================================================== */
  if (typeof document === "undefined") return;

  var state = null;
  var activeTab = "customers";
  var draft = { customerId: "", checkIn: "", checkOut: "", guests: 1, roomId: null };
  var flash = null;      // { kind, text }
  var panel = null;
  var logBody = null;

  function esc(text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.customers || !parsed.rooms) return null;
      return parsed;
    } catch (e) { return null; }
  }

  /* ---------------------------- SQL log ---------------------------- */
  function logStatements(statements, ok) {
    if (!logBody) return;
    var empty = logBody.querySelector(".log-empty");
    if (empty) empty.remove();

    (statements || []).forEach(function (statement) {
      var entry = document.createElement("div");
      entry.className = "log-entry";
      var params = statement.params && statement.params.length
        ? '<div class="log-params">$ ' + statement.params.map(function (p) {
            return p === null ? "NULL" : (typeof p === "number" ? p : "'" + esc(p) + "'");
          }).join(", ") + "</div>"
        : "";
      entry.innerHTML =
        '<div><span class="log-time">' + new Date().toLocaleTimeString() + '</span>' +
        '<span class="log-status ' + (ok ? "log-ok" : "log-fail") + '">' +
        (ok ? "executed" : "rejected") + "</span></div>" +
        '<div class="log-sql">' + esc(statement.sql) + "</div>" + params;
      logBody.prepend(entry);
    });
    while (logBody.children.length > 40) logBody.lastChild.remove();
  }

  /* ---------------------------- helpers ---------------------------- */
  function statusPill(status) {
    var map = {
      Available: "pill-ok", Occupied: "pill-info", Maintenance: "pill-muted",
      Booked: "pill-warn", CheckedIn: "pill-info", CheckedOut: "pill-ok",
      Cancelled: "pill-bad", Paid: "pill-ok", Pending: "pill-warn",
      Refunded: "pill-muted"
    };
    return '<span class="pill ' + (map[status] || "pill-muted") + '">' + esc(status) + "</span>";
  }

  function customerName(id) {
    var c = customer(state, id);
    return c ? c.full_name : "—";
  }

  function roomLabel(id) {
    var r = room(state, id);
    return r ? r.room_number : "—";
  }

  function notice() {
    if (!flash) return "";
    var kind = { ok: "notice-ok", bad: "notice-bad", info: "notice-info", warn: "notice-warn" }[flash.kind] || "notice-info";
    var html = '<div class="notice ' + kind + '">' + esc(flash.text) + "</div>";
    flash = null;
    return html;
  }

  function apply(result, options) {
    options = options || {};
    logStatements(result.statements, result.ok);
    if (result.ok) {
      save();
      flash = { kind: "ok", text: result.message + (result.warning ? " " + result.warning : "") };
      render();
    } else {
      flash = { kind: "bad", text: result.error };
      render();
    }
  }

  /* ---------------------------- customers ---------------------------- */
  function customersView() {
    var rows = state.customers.slice().sort(function (a, b) { return a.customer_id - b.customer_id; });
    var html = notice();
    html += '<div class="panel-head"><h4>Customer management</h4>' +
      '<span class="muted">' + rows.length + ' records · UNIQUE email, phone and ID number</span></div>';

    html +=
      '<div class="form-card"><strong>Add a customer</strong>' +
      '<p class="hint">The same checks run in the Python program and in the database constraints.</p>' +
      '<div class="form-grid">' +
      '<div class="field"><label>Full name</label><input id="c_name" type="text" placeholder="Aarav Krishnan"></div>' +
      '<div class="field"><label>Email</label><input id="c_email" type="email" placeholder="aarav@example.com"></div>' +
      '<div class="field"><label>Phone (10 digits)</label><input id="c_phone" type="text" maxlength="10" placeholder="9876500011"></div>' +
      '<div class="field wide"><label>Address</label><input id="c_address" type="text" placeholder="15, Beach Road, Chennai"></div>' +
      '<div class="field"><label>ID proof type</label><select id="c_type">' +
      ID_TYPES.map(function (t) { return "<option>" + t + "</option>"; }).join("") +
      "</select></div>" +
      '<div class="field"><label>ID proof number</label><input id="c_number" type="text" placeholder="AAD777777777"></div>' +
      "</div><div class=\"form-actions\"><button class=\"btn btn-gold\" id=\"addCustomer\">Add customer</button></div></div>";

    html += '<div class="demo-table-wrap"><table class="demo"><thead><tr>' +
      "<th>ID</th><th>Name</th><th>Phone</th><th>Email</th><th>ID proof</th><th>Bookings</th><th></th>" +
      "</tr></thead><tbody>";
    rows.forEach(function (c) {
      var bookings = state.reservations.filter(function (r) { return r.customer_id === c.customer_id; }).length;
      html += "<tr><td class='num'>" + c.customer_id + "</td><td>" + esc(c.full_name) +
        "</td><td class='num'>" + esc(c.phone) + "</td><td>" + esc(c.email) +
        "</td><td>" + esc(c.id_proof_type) + "<br><span class='muted small'>" + esc(c.id_proof_number) + "</span></td>" +
        "<td class='num'>" + bookings + "</td>" +
        "<td><div class='actions'><button class='mini-btn danger' data-del-customer='" + c.customer_id + "'>Delete</button></div></td></tr>";
    });
    html += "</tbody></table></div>";
    return html;
  }

  /* ---------------------------- rooms ---------------------------- */
  function roomsView() {
    var rows = state.rooms.slice().sort(function (a, b) {
      return a.room_number.localeCompare(b.room_number, undefined, { numeric: true });
    });
    var html = notice();
    html += '<div class="panel-head"><h4>Room management</h4>' +
      '<span class="muted">' + rows.length + ' rooms · four categories · status drives availability</span></div>';

    html += '<div class="form-card"><strong>Add a room</strong>' +
      '<div class="form-grid">' +
      '<div class="field"><label>Room number</label><input id="r_number" type="text" placeholder="113"></div>' +
      '<div class="field"><label>Type</label><select id="r_type">' +
      ROOM_TYPES.map(function (t) { return "<option>" + t + "</option>"; }).join("") + "</select></div>" +
      '<div class="field"><label>Floor</label><input id="r_floor" type="number" min="0" max="20" value="1"></div>' +
      '<div class="field"><label>Price per night (₹)</label><input id="r_price" type="number" min="1" value="2000"></div>' +
      '<div class="field"><label>Max guests</label><input id="r_occ" type="number" min="1" max="6" value="2"></div>' +
      '<div class="field"><label>Initial status</label><select id="r_status">' +
      ["Available", "Occupied", "Maintenance"].map(function (s) { return "<option>" + s + "</option>"; }).join("") +
      "</select></div></div>" +
      '<div class="form-actions"><button class="btn btn-gold" id="addRoom">Add room</button></div></div>';

    html += '<div class="demo-table-wrap"><table class="demo"><thead><tr>' +
      "<th>ID</th><th>Room</th><th>Type</th><th>Floor</th><th>Price / night</th><th>Max</th><th>Status</th><th>Change status</th>" +
      "</tr></thead><tbody>";
    rows.forEach(function (r) {
      html += "<tr><td class='num'>" + r.room_id + "</td><td><b>" + esc(r.room_number) + "</b></td><td>" +
        esc(r.room_type) + "</td><td class='num'>" + r.floor_no + "</td><td class='num'>₹ " +
        money(r.price_per_night) + "</td><td class='num'>" + r.max_occupancy + "</td><td>" +
        statusPill(r.status) + "</td><td><select class='mini-select' data-room-status='" + r.room_id + "'>" +
        ["Available", "Occupied", "Maintenance"].map(function (s) {
          return "<option" + (s === r.status ? " selected" : "") + ">" + s + "</option>";
        }).join("") + "</select></td></tr>";
    });
    html += "</tbody></table></div>";
    return html;
  }

  /* ---------------------------- reservations ---------------------------- */
  function reservationsView() {
    var html = notice();
    html += '<div class="panel-head"><h4>Book a room</h4>' +
      '<span class="muted">availability is checked again before the INSERT</span></div>';

    html += '<div class="form-grid">' +
      '<div class="field wide"><label>Customer</label><select id="b_customer"><option value="">— choose a customer —</option>' +
      state.customers.slice().sort(function (a, b) { return a.full_name.localeCompare(b.full_name); })
        .map(function (c) {
          return "<option value='" + c.customer_id + "'" +
            (String(c.customer_id) === String(draft.customerId) ? " selected" : "") + ">" +
            esc(c.full_name) + " (ID " + c.customer_id + ", " + esc(c.phone) + ")</option>";
        }).join("") + "</select></div>" +
      '<div class="field"><label>Check-in</label><input id="b_in" type="date" value="' + draft.checkIn + '"></div>' +
      '<div class="field"><label>Check-out</label><input id="b_out" type="date" value="' + draft.checkOut + '"></div>' +
      '<div class="field"><label>Guests</label><input id="b_guests" type="number" min="1" max="6" value="' + draft.guests + '"></div>' +
      "</div>";

    var valid = draft.checkIn && draft.checkOut && draft.checkOut > draft.checkIn;
    html += '<div id="availability">' + availabilityHtml(valid) + "</div>";
    html += '<div id="bookingBill">' + billHtml() + "</div>";

    var list = state.reservations.slice().sort(function (a, b) { return b.reservation_id - a.reservation_id; });
    html += '<div class="panel-head" style="margin-top:22px"><h4>Reservations</h4>' +
      '<span class="muted">' + list.length + ' records</span></div>';
    html += '<div class="demo-table-wrap"><table class="demo"><thead><tr>' +
      "<th>#</th><th>Customer</th><th>Room</th><th>Dates</th><th>Nights</th><th>Amount</th><th>Status</th><th>Payment</th><th></th>" +
      "</tr></thead><tbody>";
    list.forEach(function (res) {
      var r = room(state, res.room_id) || {};
      var pay = paymentFor(state, res.reservation_id);
      var stay = nights(res.check_in_date, res.check_out_date);
      var canCancel = res.status === "Booked";
      html += "<tr><td class='num'>" + res.reservation_id + "</td><td>" + esc(customerName(res.customer_id)) +
        "</td><td><b>" + esc(r.room_number) + "</b><br><span class='muted small'>" + esc(r.room_type) + "</span></td>" +
        "<td class='small'>" + res.check_in_date + "<br>" + res.check_out_date + "</td>" +
        "<td class='num'>" + stay + "</td><td class='num'>₹ " + money(res.total_amount) + "</td>" +
        "<td>" + statusPill(res.status) + "</td><td>" + statusPill(pay ? pay.payment_status : "Not Paid") + "</td>" +
        "<td><div class='actions'><button class='mini-btn danger' data-cancel='" + res.reservation_id + "'" +
        (canCancel ? "" : " disabled title='Only a Booked reservation can be cancelled'") +
        ">Cancel</button></div></td></tr>";
    });
    html += "</tbody></table></div>";
    return html;
  }

  function availabilityHtml(valid) {
    if (!valid) return '<p class="muted small">Choose a check-in and check-out date to see available rooms.</p>';
    var list = availableRooms(state, draft.checkIn, draft.checkOut, draft.guests);
    if (!list.length) {
      return '<div class="notice notice-warn">No room is free for ' + draft.checkIn + " → " +
        draft.checkOut + " for " + draft.guests + " guest(s).</div>";
    }
    var stay = nights(draft.checkIn, draft.checkOut);
    var html = '<p class="muted small"><b>' + list.length + '</b> room(s) free for ' +
      draft.checkIn + " → " + draft.checkOut + " (" + stay + " night(s)):</p><div class=\"room-pick\">";
    list.forEach(function (r) {
      html += "<button class='room-option" + (draft.roomId === r.room_id ? " is-selected" : "") +
        "' data-pick-room='" + r.room_id + "'>" +
        "<b>" + esc(r.room_number) + " · " + esc(r.room_type) + "</b>" +
        "<span>₹ " + money(r.price_per_night) + " / night · up to " + r.max_occupancy + " guests</span>" +
        "<span>stay: ₹ " + money(stay * r.price_per_night) + "</span></button>";
    });
    return html + "</div>";
  }

  function billHtml() {
    var chosen = draft.roomId ? room(state, draft.roomId) : null;
    if (!chosen || !draft.checkIn || !draft.checkOut || draft.checkOut <= draft.checkIn) return "";
    var stay = nights(draft.checkIn, draft.checkOut);
    var total = round2(stay * chosen.price_per_night);
    return '<div class="bill"><div>Room ' + esc(chosen.room_number) + " · " + stay + " night(s) × ₹ " +
      money(chosen.price_per_night) + "</div><b>₹ " + money(total) + "</b></div>" +
      '<div class="form-actions"><button class="btn btn-gold" id="confirmBooking">Confirm booking</button>' +
      '<span class="muted small">Creates the reservation (Booked) and a Pending payment.</span></div>';
  }

  /* ---------------------------- front desk ---------------------------- */
  function frontdeskView() {
    var today = isoToday();
    var arrivals = state.reservations.filter(function (r) { return r.status === "Booked"; })
      .sort(function (a, b) { return a.check_in_date.localeCompare(b.check_in_date); });
    var inHouse = state.reservations.filter(function (r) { return r.status === "CheckedIn"; })
      .sort(function (a, b) { return a.check_out_date.localeCompare(b.check_out_date); });

    var html = notice();
    html += '<div class="panel-head"><h4>Check-in / check-out</h4>' +
      '<span class="muted">demo date: ' + today + " · both actions update the reservation and the room</span></div>";

    html += '<h4 style="margin-top:4px">Arrivals (status Booked)</h4>';
    if (!arrivals.length) html += '<p class="muted small">No upcoming arrivals.</p>';
    else {
      html += '<div class="demo-table-wrap"><table class="demo"><thead><tr><th>#</th><th>Guest</th><th>Room</th><th>Check-in</th><th>Nights</th><th>Payment</th><th></th></tr></thead><tbody>';
      arrivals.forEach(function (res) {
        var r = room(state, res.room_id) || {};
        var pay = paymentFor(state, res.reservation_id);
        var late = res.check_in_date > today;
        html += "<tr><td class='num'>" + res.reservation_id + "</td><td>" + esc(customerName(res.customer_id)) +
          "</td><td><b>" + esc(r.room_number) + "</b></td><td class='small'>" + res.check_in_date +
          (late ? " <span class='muted'>(future)</span>" : "") + "</td><td class='num'>" +
          nights(res.check_in_date, res.check_out_date) + "</td><td>" + statusPill(pay ? pay.payment_status : "—") +
          "</td><td><div class='actions'><button class='mini-btn' data-checkin='" + res.reservation_id +
          "'>Check in</button></div></td></tr>";
      });
      html += "</tbody></table></div>";
    }

    html += '<h4 style="margin-top:18px">In house (status CheckedIn)</h4>';
    if (!inHouse.length) html += '<p class="muted small">No guest is currently checked in.</p>';
    else {
      html += '<div class="demo-table-wrap"><table class="demo"><thead><tr><th>#</th><th>Guest</th><th>Room</th><th>Check-out</th><th>Bill</th><th>Payment</th><th></th></tr></thead><tbody>';
      inHouse.forEach(function (res) {
        var r = room(state, res.room_id) || {};
        var pay = paymentFor(state, res.reservation_id);
        html += "<tr><td class='num'>" + res.reservation_id + "</td><td>" + esc(customerName(res.customer_id)) +
          "</td><td><b>" + esc(r.room_number) + "</b></td><td class='small'>" + res.check_out_date +
          "</td><td class='num'>₹ " + money(res.total_amount) + "</td><td>" +
          statusPill(pay ? pay.payment_status : "—") +
          "</td><td><div class='actions'><button class='mini-btn' data-checkout='" + res.reservation_id +
          "'>Check out</button></div></td></tr>";
      });
      html += "</tbody></table></div>";
    }
    return html;
  }

  /* ---------------------------- payments ---------------------------- */
  function paymentsView() {
    var pending = state.payments.filter(function (p) { return p.payment_status === "Pending"; });
    var all = state.payments.slice().sort(function (a, b) { return b.payment_id - a.payment_id; });
    var html = notice();
    html += '<div class="panel-head"><h4>Payment management</h4><span class="muted">' +
      pending.length + " pending · ₹ " + money(pending.reduce(function (t, p) { return t + Number(p.amount); }, 0)) +
      " outstanding</span></div>";

    if (pending.length) {
      html += '<div class="form-card"><strong>Collect a pending payment</strong>' +
        '<p class="hint">Method must be Cash, Card or UPI (CHECK constraint).</p>' +
        '<div class="form-grid">' +
        '<div class="field wide"><label>Reservation</label><select id="p_res">' +
        pending.map(function (p) {
          return "<option value='" + p.reservation_id + "'>#" + p.reservation_id + " · " +
            esc(customerName((reservation(state, p.reservation_id) || {}).customer_id)) + " · ₹ " +
            money(p.amount) + "</option>";
        }).join("") + "</select></div>" +
        '<div class="field"><label>Method</label><select id="p_method">' +
        METHODS.map(function (m) { return "<option>" + m + "</option>"; }).join("") + "</select></div>" +
        '<div class="field"><label>Reference (optional)</label><input id="p_ref" type="text" placeholder="TXN99887766"></div>' +
        '</div><div class="form-actions"><button class="btn btn-gold" id="recordPayment">Record payment</button></div></div>';
    }

    html += '<div class="demo-table-wrap"><table class="demo"><thead><tr>' +
      "<th>Pay ID</th><th>Resv</th><th>Customer</th><th>Amount</th><th>Method</th><th>Status</th><th>Date</th><th>Reference</th><th></th>" +
      "</tr></thead><tbody>";
    all.forEach(function (p) {
      var res = reservation(state, p.reservation_id) || {};
      html += "<tr><td class='num'>" + p.payment_id + "</td><td class='num'>" + p.reservation_id +
        "</td><td>" + esc(customerName(res.customer_id)) + "</td><td class='num'>₹ " + money(p.amount) +
        "</td><td>" + esc(p.payment_method) + "</td><td>" + statusPill(p.payment_status) +
        "</td><td class='small'>" + esc(p.payment_date) + "</td><td class='small'>" + esc(p.transaction_ref || "—") +
        "</td><td><div class='actions'><button class='mini-btn' data-refund='" + p.payment_id + "'" +
        (p.payment_status === "Paid" ? "" : " disabled") + ">Refund</button></div></td></tr>";
    });
    html += "</tbody></table></div>";
    return html;
  }

  /* ---------------------------- reports ---------------------------- */
  function reportsView() {
    var r = reports(state);
    var html = notice();
    html += '<div class="panel-head"><h4>Reports</h4><span class="muted">computed from the same aggregates the SQL views use</span></div>';
    html += '<div class="report-grid">';

    html += '<div class="report-card"><h5>Total revenue (payment_status = Paid)</h5><div class="kpi">' +
      "<div><b>₹ " + money(r.revenue) + "</b><span>collected</span></div>" +
      "<div><b>" + r.paidCount + "</b><span>paid bills</span></div>" +
      "<div><b>₹ " + money(r.average) + "</b><span>average</span></div></div></div>";

    html += '<div class="report-card"><h5>Outstanding &amp; refunds</h5><div class="kpi">' +
      "<div><b>₹ " + money(r.pending) + "</b><span>pending</span></div>" +
      "<div><b>₹ " + money(r.refunded) + "</b><span>refunded</span></div>" +
      "<div><b>₹ " + money(r.bookingValue) + "</b><span>booking value</span></div></div></div>";

    html += '<div class="report-card"><h5>Revenue by payment method</h5>';
    var maxMethod = Math.max.apply(null, r.byMethod.map(function (m) { return m.total; }).concat([1]));
    r.byMethod.forEach(function (m) {
      html += '<div class="bar-row"><span class="bar-label">' + m.method + "</span>" +
        '<span class="bar-track"><span class="bar-fill" style="width:' + (m.total / maxMethod * 100) + '%"></span></span>' +
        '<span class="bar-val">₹ ' + money(m.total) + "</span></div>";
    });
    html += "</div>";

    html += '<div class="report-card"><h5>Room occupancy</h5><div class="kpi">' +
      "<div><b>" + r.occupied + " / " + r.totalRooms + "</b><span>occupied</span></div>" +
      "<div><b>" + r.available + "</b><span>available</span></div>" +
      "<div><b>" + r.maintenance + "</b><span>maintenance</span></div>" +
      "<div><b>" + r.inHouse + "</b><span>guests in house</span></div></div></div>";

    html += '<div class="report-card"><h5>Reservations per room type</h5>';
    var maxType = Math.max.apply(null, Object.keys(r.byType).map(function (k) { return r.byType[k]; }).concat([1]));
    Object.keys(r.byType).forEach(function (type) {
      html += '<div class="bar-row"><span class="bar-label">' + type + "</span>" +
        '<span class="bar-track"><span class="bar-fill" style="width:' + (r.byType[type] / maxType * 100) + '%"></span></span>' +
        '<span class="bar-val">' + r.byType[type] + " booking(s)</span></div>";
    });
    html += '<p class="muted small" style="margin:8px 0 0">Most frequently booked: <b>' +
      esc(r.popular) + "</b> (" + r.popularCount + " confirmed bookings)</p></div>";

    html += '<div class="report-card"><h5>Customer booking history</h5><div class="demo-table-wrap" style="border:none">' +
      '<table class="demo"><thead><tr><th>Customer</th><th>Bookings</th><th>Completed</th><th>Cancelled</th><th>Spent</th></tr></thead><tbody>';
    r.history.slice(0, 6).forEach(function (row) {
      html += "<tr><td>" + esc(row.full_name) + "</td><td class='num'>" + row.bookings +
        "</td><td class='num'>" + row.completed + "</td><td class='num'>" + row.cancelled +
        "</td><td class='num'>₹ " + money(row.spent) + "</td></tr>";
    });
    html += "</tbody></table></div></div>";

    html += "</div>";
    return html;
  }

  /* ---------------------------- rendering ---------------------------- */
  function render() {
    if (!panel) return;
    var views = {
      customers: customersView, rooms: roomsView, reservations: reservationsView,
      frontdesk: frontdeskView, payments: paymentsView, reports: reportsView
    };
    panel.innerHTML = views[activeTab]();
    if (activeTab === "reservations") {
      var bill = document.getElementById("bookingBill");
      if (bill) bill.innerHTML = billHtml();
    }
    var saved = scrollPos;
    scrollPos = null;
  }

  var scrollPos = null;

  function refreshAvailability() {
    var box = document.getElementById("availability");
    if (box) box.innerHTML = availabilityHtml(draft.checkIn && draft.checkOut && draft.checkOut > draft.checkIn);
    var bill = document.getElementById("bookingBill");
    if (bill) bill.innerHTML = billHtml();
  }

  /* ---------------------------- events ---------------------------- */
  function bindEvents() {
    document.getElementById("demoTabs").addEventListener("click", function (event) {
      var button = event.target.closest("[data-demo]");
      if (!button) return;
      activeTab = button.dataset.demo;
      Array.prototype.forEach.call(this.children, function (child) {
        child.classList.toggle("is-active", child === button);
      });
      flash = null;
      render();
    });

    document.getElementById("resetDemo").addEventListener("click", function () {
      if (!confirm("Restore the original sample data? Your demo changes will be lost.")) return;
      state = createState(window.HMS.demo);
      save();
      flash = { kind: "info", text: "Sample data restored (12 customers, 14 rooms, 16 reservations, 16 payments)." };
      render();
    });

    panel.addEventListener("click", function (event) {
      var target = event.target;

      if (target.id === "addCustomer") {
        var data = {
          full_name: value("c_name"), email: value("c_email"), phone: value("c_phone"),
          address: value("c_address"), id_proof_type: value("c_type"),
          id_proof_number: value("c_number")
        };
        apply(addCustomer(state, data));
        return;
      }
      if (target.id === "addRoom") {
        apply(addRoom(state, {
          room_number: value("r_number"), room_type: value("r_type"),
          floor_no: value("r_floor"), price_per_night: value("r_price"),
          max_occupancy: value("r_occ"), status: value("r_status")
        }));
        return;
      }
      if (target.id === "confirmBooking") {
        if (!draft.roomId) {
          flash = { kind: "warn", text: "Choose a room from the availability list first." };
          render();
          return;
        }
        var result = bookRoom(state, {
          customer_id: draft.customerId, room_id: draft.roomId,
          check_in_date: draft.checkIn, check_out_date: draft.checkOut,
          num_guests: draft.guests
        });
        if (result.ok) draft.roomId = null;
        apply(result);
        return;
      }
      if (target.id === "recordPayment") {
        apply(recordPayment(state, value("p_res"), value("p_method"), value("p_ref")));
        return;
      }

      var deleteId = target.dataset.delCustomer;
      if (deleteId) {
        if (!confirm("Delete this customer permanently?")) return;
        apply(deleteCustomer(state, deleteId));
        return;
      }
      var cancelId = target.dataset.cancel;
      if (cancelId) {
        if (!confirm("Cancel reservation #" + cancelId + "?")) return;
        apply(cancelReservation(state, cancelId));
        return;
      }
      var checkinId = target.dataset.checkin;
      if (checkinId) { apply(checkIn(state, checkinId)); return; }
      var checkoutId = target.dataset.checkout;
      if (checkoutId) { apply(checkOut(state, checkoutId)); return; }
      var refundId = target.dataset.refund;
      if (refundId) { apply(refundPayment(state, refundId)); return; }

      var pick = target.closest("[data-pick-room]");
      if (pick) {
        draft.roomId = Number(pick.dataset.pickRoom);
        refreshAvailability();
      }
    });

    panel.addEventListener("change", function (event) {
      var el = event.target;
      if (el.id === "b_customer") draft.customerId = el.value;
      if (el.id === "b_in") { draft.checkIn = el.value; draft.roomId = null; refreshAvailability(); }
      if (el.id === "b_out") { draft.checkOut = el.value; draft.roomId = null; refreshAvailability(); }
      if (el.id === "b_guests") { draft.guests = Number(el.value) || 1; draft.roomId = null; refreshAvailability(); }
      if (el.dataset && el.dataset.roomStatus) {
        apply(setRoomStatus(state, el.dataset.roomStatus, el.value));
      }
    });
  }

  function value(id) {
    var el = document.getElementById(id);
    return el ? el.value : "";
  }

  function init() {
    panel = document.getElementById("demoPanel");
    logBody = document.getElementById("sqlLog");
    if (!panel || !window.HMS || !window.HMS.demo) return;

    state = load() || createState(window.HMS.demo);
    draft.checkIn = isoToday();
    draft.checkOut = addDays(draft.checkIn, 2);
    bindEvents();
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
