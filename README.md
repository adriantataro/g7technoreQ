<div align="center">

<img src="assets/Logo.png" alt="RESQ ME logo" width="220" />

# RESQ ME

**Your critical health information, reachable when time is limited.**

A student-built health-technology service that turns a short medical intake form into a scannable QR/NFC emergency profile, so first responders can see allergies, medications, and emergency contacts in seconds — without unlocking a phone or searching for paperwork.

</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [How It Works](#how-it-works)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Data Model](#data-model)
- [Product Tiers](#product-tiers)
- [Data Privacy & Compliance](#data-privacy--compliance)
- [Security Notes](#security-notes)
- [Roadmap](#roadmap)
- [Team](#team)
- [License](#license)
- [Contact](#contact)

---

## Overview

RESQ ME addresses the "Golden Hour" problem in emergency medicine: the minutes a responder spends trying to figure out a patient's allergies, conditions, or who to call, instead of treating them. The platform lets anyone fill out a one-time intake form with the health details that actually matter in a crisis. That submission becomes a unique **Patient ID** (`PT-YYYYMMDD-XXXXXXXX`) and a QR code linking to a read-only emergency profile page.

From there, the user can keep things fully digital (a free screenshot of their QR code) or order a physical product — a keychain or wallet card — that pairs the same QR code with an NFC chip, so a phone tap opens the profile without needing to unlock the device.

This repository contains both halves of the system:

1. **Public website** — the marketing site, patient intake form, order form, contact form, and "retrieve my QR code" form.
2. **Apps Script backend** — a Google Apps Script project that stores submissions in Google Sheets, generates QR codes, sends transactional emails, and serves the read-only patient record page that opens when a code is scanned.

> This started as a student capstone project (DIT 1-1, Group 7) at PUP — see [Team](#team).

## Features

- **Three-tier product model** — free digital QR profile, ₱100 QR + NFC keychain, ₱150 QR + NFC wallet card.
- **Conditional intake form** — allergies, medications, chronic conditions, history, insurance, and primary care provider each have a Yes/No toggle that reveals a detail field only when needed, so the form stays short for healthy users and thorough for those who need it.
- **Patient photo upload** — converted to base64 client-side and stored alongside the record (no separate file storage required).
- **Auto-generated QR codes** via the QuickChart API, rendered both in the browser and as a live formula inside the Google Sheet.
- **Patient Record Viewer** — the page a QR/NFC scan opens; pulls the record live from Google Sheets and renders it as a clean, read-only profile with a light/dark toggle.
- **Order form with live pricing** — recalculates unit price, flat shipping fee, and total as the buyer picks a product and quantity, and toggles shipping fields off for the free digital tier.
- **Resilient email delivery** — a three-step fallback chain (Brevo → Gmail/MailApp → EmailJS) so confirmation and QR-code emails still go out if one provider is rate-limited or down.
- **Retrieve QR code** — a self-service lookup that verifies Patient ID + email before re-sending a lost QR code.
- **RA 10173 consent modal** — a blocking Data Privacy Act notice shown once per session before any form can be used.
- **Light/dark theme** with `prefers-color-scheme` detection, plus a responsive mobile nav.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3 (custom properties for theming), vanilla JavaScript |
| Backend | Google Apps Script (serverless `doGet` / `doPost` Web App) |
| Database | Google Sheets (`Patients`, `Orders`, `Contact Messages`) |
| QR generation | [QuickChart](https://quickchart.io/) QR API |
| Transactional email | Brevo API (primary), Gmail `MailApp` (fallback), EmailJS (final fallback) |
| Fonts | Raleway, Inter, DM Sans, Syne (Google Fonts) |

## How It Works

**Registering a patient**
1. User fills out the intake form on the public site; the photo (if any) is converted to base64 in the browser.
2. The payload is `POST`ed as JSON to the Apps Script Web App.
3. The backend generates a Patient ID, appends a row to the `Patients` sheet, builds a record URL (`<web-app-url>?id=<patient-id>`), and asks QuickChart for a QR image of that URL.
4. A confirmation email (with the QR code) goes to the user, and a notification goes to the admin inbox.

**Scanning a code**
1. Scanning the QR or tapping the NFC chip opens `<web-app-url>?id=<patient-id>`.
2. `doGet` detects the `id` parameter and serves the Patient Record Viewer template instead of the JSON API response.
3. The viewer page calls `getRecord(patientId)` over `google.script.run`, looks the row up in `Patients`, and renders the fields — showing "None" for any section the patient marked No, instead of leaking an empty field.

**Ordering a physical product / contacting support / recovering a lost code**
- All three flows are separate `POST` payloads (`form_type: "order" | "contact" | "retrieve"`) routed by the same `doPost` entry point to their own sheet and email logic. Free-tier orders are auto-emailed a QR code immediately; paid orders get payment instructions and a manual confirmation step before shipping.

## Project Structure

```
resq-me/
├── index.html              # Public site: hero, shop, intake form, order form,
│                            #   promos, about, contact, retrieve-QR sections
├── style.css                # Theming (light/dark CSS variables) and layout
├── script.js                 # Form logic, conditional fields, order pricing,
│                            #   theme toggle, product image modal
├── assets/
│   ├── Logo.png
│   ├── Product1.png         # Free QR screenshot (phone mockup)
│   ├── Product2.png         # QR + NFC keychain
│   └── Product3.png         # QR + NFC wallet card
└── apps-script/
    ├── Code.gs               # doGet/doPost router, sheet I/O, QR + email logic
    └── Index.html             # Patient Record Viewer template (served on scan)
```

> The Apps Script project intentionally has its own file named `Index.html` (referenced via `HtmlService.createTemplateFromFile("Index")`). It is a different file from the root `index.html` — one is the public marketing/intake site, the other is the bare-bones page a scanned QR code opens.

## Getting Started

### 1. Set up the backend

1. Create a new Google Sheet — this becomes the database.
2. Open **Extensions → Apps Script** from that Sheet.
3. Create a script file named `Code` and paste in the contents of `apps-script/Code.gs`.
4. Create an HTML file named `Index` and paste in the contents of `apps-script/Index.html`.
5. Replace the placeholder constants at the top of `Code.gs` with your own values (see [Security Notes](#security-notes) before hardcoding anything):
   - `NOTIFY_EMAIL` — inbox that receives admin notifications.
   - `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID`, `EMAILJS_PUBLIC_KEY` — from your EmailJS account.
   - `BREVO_API_KEY` — from your Brevo account.

### 2. Deploy the Web App

1. **Deploy → New deployment → Web app**.
2. Set **Execute as: Me** and **Who has access: Anyone**.
3. Copy the generated `/exec` URL — this is your `SCRIPT_URL`.
4. Paste that URL back into the `SCRIPT_URL` constant in `Code.gs` (used to build QR/record links) and redeploy.

### 3. Set up the frontend

1. Update `APPS_SCRIPT_URL` at the top of `script.js` with the same `/exec` URL from step 2.
2. Host `index.html`, `style.css`, `script.js`, and `assets/` on any static host (GitHub Pages, Netlify, Vercel, etc.) — no build step is required.

### 4. Test the loop

1. Submit the intake form on the deployed site and confirm a row appears in the `Patients` sheet and the QR code renders.
2. Open the record URL (or scan the QR) in a separate browser/incognito session and confirm the Patient Record Viewer loads the data.
3. Submit a free-tier order and confirm the QR-code email arrives; submit a paid order and confirm the order appears in the `Orders` sheet.

### 5. Produce physical products

For the keychain/card tiers, encode each patient's record URL onto an NFC tag (a phone with NFC write support is enough for small batches) and pair it with a printed QR sticker of the same URL.

## Data Model

**`Patients` sheet**
`patient_id, created_at, full_name, sex, dob, address, phone, email, emergency_name, emergency_relationship, emergency_phone, allergies_yn, allergies, medications_yn, medications, chronic_yn, chronic_conditions, history_yn, history, insurance_yn, insurance_provider, insurance_policy, pcp_yn, pcp_name, pcp_contact, photo_base64, record_url, qr_formula`

**`Orders` sheet**
`Timestamp, Name, Patient ID, Email, Phone, Product, Quantity, Unit Price, Shipping Fee, Total, Payment Method, Address, City, Province, ZIP, Notes`

**`Contact Messages` sheet**
`Timestamp, Name, Email, Subject, Message`

All three sheets are created automatically (with a styled header row) the first time their corresponding form type is submitted.

## Product Tiers

| Product | Price | Format |
|---|---|---|
| QR Code Screenshot | Free | Digital only — QR emailed, save or print it yourself |
| QR Keychain w/ NFC | ₱100 | Acrylic keychain, printed QR + embedded NFC chip |
| QR Card w/ NFC | ₱150 | Wallet-sized PVC card, printed QR + embedded NFC chip, with a blank name field |

Paid orders add a flat ₱60 shipping fee, calculated live in the order form.

## Data Privacy & Compliance

The site shows a blocking consent modal before any form is usable, referencing the **Data Privacy Act of 2012 (Republic Act No. 10173)**. It outlines what's collected, how it's used, and the rights it's designed to support — to be informed, to access, to correct, to request erasure, and to data portability. Profile deletion requests are handled by contacting the support email; there's no self-service delete button in this version, so plan for that workflow (or build it) before relying on this for production use with real patient data.

## Security Notes

The uploaded source files contain working API keys and a live deployment URL hardcoded as constants (`BREVO_API_KEY`, `EMAILJS_PUBLIC_KEY`, `SCRIPT_URL`, etc.). Before pushing this repo somewhere public:

- **Rotate any keys that have already been exposed.** Treat anything that was ever in a file you're about to publish as compromised.
- **Move secrets out of source.** `BREVO_API_KEY` in particular should live in Apps Script's `PropertiesService` (Project Settings → Script Properties), not in the committed `.gs` file.
- **EmailJS's public key is meant to be client-visible** by design, but its template and service IDs are still worth reviewing for any default rate limits or quotas you don't want abused.
- **The `Patients` sheet stores photos as base64 strings directly in cells.** That's fine for a prototype at low volume, but will hit Sheets' cell-size and sheet-size limits faster than you'd expect — budget for moving to Drive-backed storage (there's a `savePhotoToDrive` helper already started in `Code.gs`) if this scales past a class project.

## Roadmap

Carried over from the team's business plan:

- Move from manual, phone-based NFC encoding to industrial encoding + thermal card printing for larger batches.
- Add a self-service "delete my record" flow to fully back the RA 10173 erasure right described in the privacy notice.
- Move patient photos to Drive (or another object store) instead of inline base64.
- Formal business registration and expansion beyond the initial PUP ITECH campus trade area.

## Team

Developed by **DIT 1-1, Group 7** at the Polytechnic University of the Philippines — Institute of Technology (PUP ITECH).

| Role | Members |
|---|---|
| CEO / Operations Lead | Markus Qriane Vallejos, Kyle Rowan Tanagon |
| CTO / Lead Developer | Kiel Anthony Villanueva, Adrian R. Tataro |
| Marketing & Customer Relations Lead | Eliana Jane Tan, Andrei John Tobias |
| Production & Logistics Coordinator | Miguel S. Traqueña, Trishia Doll Torrefiel |

## License

No license has been specified yet. If you intend to open-source this, add a `LICENSE` file (MIT is a common default for student/portfolio projects); otherwise treat the code as all-rights-reserved by the team above.

## Contact

support@resqme.com
