"""
ui.py
=====
Everything that touches the screen lives here: headings, colour-free
tables, success/error messages and safe input helpers.

The console is kept narrow enough (about 100 characters) so that it
also looks correct when pasted into the project report.
"""

from datetime import date, datetime
from decimal import Decimal

LINE = "-" * 92
DOUBLE = "=" * 92


class Cancel(Exception):
    """Raised when the user presses Enter on an empty prompt to go back."""


# ----------------------------------------------------------------------
# Messages
# ----------------------------------------------------------------------
def clear_screen():
    # A blank screen between menus keeps the output readable.  Using
    # new lines instead of an ANSI clear code keeps the screenshots and
    # redirected output clean.
    print("\n" * 2)


def title(text: str):
    print("\n" + DOUBLE)
    print(" " + text)
    print(DOUBLE)


def subtitle(text: str):
    print("\n" + text)
    print(LINE)


def success(text: str):
    print(f"\n[SUCCESS] {text}")


def error(text: str):
    print(f"\n[ERROR] {text}")


def info(text: str):
    print(f"\n[INFO] {text}")


def warn(text: str):
    print(f"\n[WARNING] {text}")


def pause():
    try:
        input("\nPress ENTER to continue...")
    except (EOFError, KeyboardInterrupt):
        pass


# ----------------------------------------------------------------------
# Value formatting
# ----------------------------------------------------------------------
def money(value) -> str:
    if value is None:
        return "-"
    if isinstance(value, (int, float, Decimal)):
        return f"{Decimal(value):,.2f}"
    return str(value)


def date_text(value) -> str:
    if value is None:
        return "-"
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M")
    if isinstance(value, date):
        return value.strftime("%Y-%m-%d")
    return str(value)


def _cell(value) -> str:
    if value is None:
        return "-"
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M")
    if isinstance(value, date):
        return value.strftime("%Y-%m-%d")
    if isinstance(value, Decimal):
        return f"{value:,.2f}"
    return str(value)


# ----------------------------------------------------------------------
# Tables
# ----------------------------------------------------------------------
def print_table(rows, columns, empty_message="No records found."):
    """
    Print a simple ASCII table.

    rows    : list of dictionaries (RealDictRow works too)
    columns : list of (key, heading, width, align) tuples
              align is 'l' (left) or 'r' (right)
    """
    if not rows:
        info(empty_message)
        return

    # Header
    header = "  ".join(
        (str(head)[:width].ljust(width) if align == "l"
         else str(head)[:width].rjust(width))
        for _, head, width, align in columns
    )
    print("\n" + header)
    print("-" * len(header))

    for row in rows:
        cells = []
        for key, _head, width, align in columns:
            text = _cell(row.get(key))[:width]
            cells.append(text.ljust(width) if align == "l" else text.rjust(width))
        print("  ".join(cells))

    print("-" * len(header))
    print(f"({len(rows)} row{'s' if len(rows) != 1 else ''})")


def print_record(record, labels=None):
    """Print a single row as 'Label : value' lines."""
    if not record:
        info("No record found.")
        return
    width = max(len(str(k)) for k in record) + 2
    for key, value in record.items():
        label = labels.get(key, key) if labels else key
        print(f"  {str(label).ljust(width)}: {_cell(value)}")


# ----------------------------------------------------------------------
# Input helpers (every one of them validates before returning)
# ----------------------------------------------------------------------
def ask(prompt: str, default=None, required=True, allow_cancel=True) -> str:
    """
    Ask for a text value.

    * An empty answer returns `default` when a default exists.
    * Otherwise the question is repeated until something is typed.
    * Typing  q  (or just ENTER when there is no default) cancels the
      current operation, which the menu catches and ignores.
    """
    while True:
        suffix = f" [{default}]" if default not in (None, "") else ""
        hint = " (q = cancel)" if allow_cancel else ""
        try:
            answer = input(f"{prompt}{suffix}{hint}: ").strip()
        except EOFError:
            raise Cancel()
        if answer.lower() == "q" and allow_cancel:
            raise Cancel()
        if answer:
            return answer
        if default not in (None, ""):
            return str(default)
        if not required:
            return ""
        error("This field cannot be empty. Please type a value.")


def ask_int(prompt: str, minimum=None, maximum=None, default=None,
            allow_cancel=True):
    """Ask for a whole number inside an optional range."""
    while True:
        raw = ask(prompt, default=default, allow_cancel=allow_cancel)
        try:
            value = int(raw)
        except ValueError:
            error("Please enter a whole number (digits only).")
            continue
        if minimum is not None and value < minimum:
            error(f"Value must be at least {minimum}.")
            continue
        if maximum is not None and value > maximum:
            error(f"Value must be at most {maximum}.")
            continue
        return value


def ask_money(prompt: str, minimum=1, default=None):
    """Ask for a positive amount with up to two decimals."""
    while True:
        raw = ask(prompt, default=default)
        try:
            value = Decimal(raw.replace(",", ""))
        except Exception:
            error("Please enter a valid amount, for example 2500 or 2499.50")
            continue
        if value < minimum:
            error(f"Amount must be at least {minimum}.")
            continue
        if value > Decimal("1000000"):
            error("Amount looks too large (more than 10,00,000).")
            continue
        if value.as_tuple().exponent < -2:
            error("Please use at most two decimal places.")
            continue
        return value.quantize(Decimal("0.01"))


def ask_date(prompt: str, default=None):
    """Ask for a date in YYYY-MM-DD format."""
    while True:
        raw = ask(prompt, default=default)
        try:
            return datetime.strptime(raw, "%Y-%m-%d").date()
        except ValueError:
            error("Invalid date. Use the format YYYY-MM-DD, e.g. 2026-11-05.")


def ask_choice(prompt: str, options, default=None):
    """Ask the user to pick one item from `options`."""
    printable = ", ".join(options)
    while True:
        raw = ask(f"{prompt} ({printable})", default=default)
        for option in options:
            if raw.lower() == option.lower():
                return option
        error(f"'{raw}' is not valid. Choose one of: {printable}")


def ask_email(prompt: str = "Email", default=None):
    """Very small e-mail check: something@something.something"""
    while True:
        raw = ask(prompt, default=default)
        if "@" in raw and "." in raw.split("@")[-1] and " " not in raw:
            return raw.lower()
        error("Invalid e-mail address, for example guest@example.com")


def ask_phone(prompt: str = "Phone (10 digits)", default=None):
    while True:
        raw = ask(prompt, default=default)
        digits = raw.replace(" ", "").replace("-", "")
        if digits.isdigit() and len(digits) == 10:
            return digits
        error("Phone number must contain exactly 10 digits.")


def menu_choice(prompt: str = "Enter your choice") -> str:
    """Read a menu option number/letter without extra validation."""
    try:
        return input(f"\n{prompt}: ").strip()
    except EOFError:
        raise Cancel()


def confirm(prompt: str) -> bool:
    while True:
        raw = input(f"{prompt} (y/n): ").strip().lower()
        if raw in ("y", "yes"):
            return True
        if raw in ("n", "no"):
            return False
        error("Please answer y or n.")
