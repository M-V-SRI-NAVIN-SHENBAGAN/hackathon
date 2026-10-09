# MediVault — Your health history. Always with you.

A responsive healthcare-records hackathon demo that brings patient and doctor workflows into one consent-first app. **The dataset is fictional. This is not a certified clinical system or medical advice.**

## Run locally

```bash
npm install
npm run dev
```

Vite serves the app on port `5173`. To create a production bundle, run `npm run build`.

## Try the demo

From the landing page, choose **Patient login** or **Doctor login**, then use the one-click fictional accounts:

- **Arjun Kumar** — patient
- **Dr. Priya Raman** — General Physician; has a seeded, time-limited demo consent grant so the doctor workspace is ready to explore
- **Dr. Karthik Raj** — Endocrinologist; has a pending patient access request to review

No demo passwords are displayed or required. You can also create local patient or doctor profiles from the sign-up form.

Suggested end-to-end flow:

1. Enter as Arjun and explore the timeline, record vault, medication list and pending request.
2. Upload a fictional PDF/JPG/PNG test report (maximum 3 MB per file in demo mode).
3. Open **Sharing & access** and grant Dr. Priya access to selected records or a category. Confirm consent and choose an expiry.
4. Sign in as Dr. Priya and open the authorized patient workspace. Compare matching test results, review flags, add a clinician-authored note, or create a clearly marked prescription draft.
5. Return to Arjun, revoke access, then return to Priya. The workspace now displays an access-denied state and protected records are not retrieved by the demo access helper.
6. Review record-access and consent events in **Activity log**.

The patient portal also includes record search, date/category/provider filters, previews/downloads, a unified timeline, medication tracking, a portable health summary, simulated appointments and an emergency card. Doctors see only patients covered by a current grant in the demo UI; an emergency request requires a reason and explicit patient authorization and exposes essential card fields only.

## Demo-mode storage and security boundary

This checkout has no Supabase credentials. The app therefore runs in **local browser demo mode**:

- Fictional data and actions are persisted in this browser’s `localStorage` and shared by the two demo portals in that browser.
- Passwords for accounts created in the demo are **not stored in plaintext**; a salted PBKDF2 verifier is kept locally. This is still not production authentication.
- Demo authorization helpers check role, grant scope, expiry and revocation before doctor record retrieval. This is client-side behavior, **not a secure backend or server-enforced access control**. Browser storage can be inspected or altered.
- Uploaded files stay in local browser storage; they are not uploaded to private cloud storage. Never use real patient information in this prototype.
- The QR code contains only a protected-workflow token, not health information. It does not bypass patient consent.

Use **Clear site data** in the browser’s site settings (or remove the `medivault_demo_v2` local-storage key) to reset the fictional dataset.

## Supabase deployment baseline

`supabase/schema.sql` documents a relational schema, RLS policies, scoped/time-limited record checks, grant/revocation RPCs and a private storage bucket for a future Supabase deployment. It is **not automatically applied or wired into this demo**. A real deployment still needs a Supabase project, migrations applied and reviewed, verified clinician onboarding, Supabase Auth integration, server-enforced file access, security testing, monitoring, and an appropriate privacy/compliance review. Do not expose a service-role key in frontend code.

## Stack

React + TypeScript, Vite, Tailwind CSS, Recharts, Lucide icons, QRCode SVG and a fictional localStorage data adapter. English is default; a basic Tamil navigation/help translation is available in the top bar.
