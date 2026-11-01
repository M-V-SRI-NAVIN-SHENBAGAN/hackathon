# Hotel Management System — Website

A static, dependency-free website that presents the complete **Database
Systems mini project**: PostgreSQL schema, 34 SQL queries, ER diagram, all
Python source code, screenshots, the printable report — plus a **live
in-browser demo** of the hotel front-desk application.

Built with plain HTML, CSS and JavaScript. No framework, no build step, no
server needed.

---

## Deploy to Vercel (2 minutes)

### Option A — dashboard (easiest)

1. Push this repository to GitHub (already done).
2. Open <https://vercel.com/new>.
3. **Import Git Repository** → choose this repo.
4. Vercel detects a static project. Confirm these settings:
   * **Framework Preset:** `Other`
   * **Build Command:** *(leave empty)*
   * **Output Directory:** *(leave empty or `.`)*
   * **Install Command:** *(leave empty)*
5. **Deploy**. You get a public link such as
   `https://hotel-management-system.vercel.app`.

### Option B — command line

```bash
npm i -g vercel
vercel login
vercel --prod          # run inside this folder
```

The included `vercel.json` sets clean URLs, long-term caching for
`/assets`, basic security headers, and Vercel automatically serves
`404.html` for unknown paths.

---

## What visitors can do with the link

| Section | Interactive? |
|---|---|
| Overview, database design, SQL, code, screenshots | Read / download |
| Query gallery | Real query results captured from PostgreSQL |
| **Live demo** | Fully interactive: add customers and rooms, book a room with date-overlap availability and automatic billing, check in / out, take Cash / Card / UPI payments, refund, and view all reports. The equivalent parameterized SQL is printed for every action. |
| Downloads | Every SQL script, Python file, the report (MD + DOCX) and the sample run |

### About the demo data

The public demo runs **entirely in the browser** on a snapshot of the sample
data (12 customers, 14 rooms, 16 reservations, 16 payments) and stores changes
in that browser's `localStorage`. Rules enforced there mirror the real
program: unique e-mail / phone / ID number, check-out after check-in,
no double booking, bill = nights × tariff, one payment per reservation, and
check-in / check-out updating the reservation *and* the room together.

That means the link is safe to share: nobody can break anybody else's data,
and the *Reset data* button restores the snapshot. To get a genuinely shared,
multi-user database behind the website you would add a serverless API plus a
hosted PostgreSQL (Neon / Supabase / Vercel Postgres) — the SQL in
`downloads/sql/` is ready for it; see "Making the website genuinely
multi-user" below.

---

## Making the website genuinely multi-user (optional)

The project database is written in standard PostgreSQL, so a hosted copy can
be added without changing the schema:

1. Create a free PostgreSQL database at <https://neon.tech> (or Supabase /
   Vercel Postgres) and run `downloads/sql/01_schema.sql` and
   `downloads/sql/02_sample_data.sql` in its SQL editor.
2. Add `/api/data.js`, `/api/customers.js`, `/api/reservations.js`,
   `/api/payments.js` as Vercel serverless functions using the `pg` driver
   and `process.env.DATABASE_URL`.
3. Replace the `localStorage` calls in `assets/js/demo.js` with `fetch()` to
   those endpoints — the function signatures and validation already match.
4. Set `DATABASE_URL` in **Vercel → Project → Settings → Environment
   Variables** and redeploy.

---

## Run locally

```bash
python -m http.server 8080 --directory .
# open http://localhost:8080
```

Any static file server works. Opening `index.html` directly from disk also
works in most browsers, but a local server gives correct MIME types.

---

## Structure

```
.
├── index.html            project site (overview, design, SQL, code, demo, files)
├── report.html           the full report, printable to PDF
├── 404.html              not-found page
├── vercel.json           deployment configuration
├── assets/
│   ├── css/site.css
│   ├── js/site.js        rendering, code viewer, query gallery, lightbox
│   ├── js/demo.js        browser simulation of the Python application
│   └── data/project.js   generated data (queries + live results, code, stats)
├── screenshots/          21 real console screenshots
├── downloads/            every project file (sql, app, report)
└── ER_DIAGRAM.png/.svg
```

## Source of the project

The full project — SQL scripts, the psycopg2 console application, the report
and the generator scripts — lives in the parent repository under
`hotel_management_system/`. The site is generated from those files with
`docs/tools/build_website.py`, so it never drifts from the code.
