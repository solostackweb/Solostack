# Stackivo — Claude Design Prompt
# Paste this entire prompt into claude.ai/design

---

## STEP 1: Web Capture (do this first inside Claude Design)

Use the web capture tool to grab the following pages from **https://stackivo.me**:
- Dashboard / Pulse page
- Clients list page
- Invoice creation page
- Contracts page
- Client portal view

If any page requires login, I will upload screenshots instead (see attached screenshots below the prompt).

---

## STEP 2: The Prompt

I need you to build an **animated product demo prototype** for Stackivo — a SaaS business operating system for Indian freelancers. This demo will be screen-recorded to create a 2-minute marketing video.

### About Stackivo
- **What it is:** All-in-one workspace for Indian freelancers — GST invoicing, digital contracts, client portal, UPI payments, and analytics dashboard
- **Target user:** Indian freelancers and consultants who currently manage their business across Excel, WhatsApp, and Google Drive
- **Core pain point:** Manual GST calculation in Excel, chasing payments on WhatsApp, no professional client-facing experience
- **Key features to show:** Clients, Invoices (with CGST/SGST auto-calc), Contracts (e-sign), Client Portal, Pulse Dashboard

### Brand System
- **Primary gradient:** #2563EB (blue) → #4F46E5 (indigo), direction: top-left to bottom-right
- **Background (dark mode):** #0A1020
- **Background (light mode):** #F8FAFC
- **Text:** #0F172A (dark), #334155 (body), #64748B (muted)
- **Success/Paid:** #16A34A
- **Warning/Overdue:** #DC2626
- **Font:** Inter or system-ui, weight 400/500/600
- **Border radius:** 12px cards, 8px buttons, 6px inputs
- **UI style:** shadcn/ui components — clean, minimal, professional SaaS

### Demo Data to Use
- **Clients:** Mehta Digital Solutions, Priya Designs Pvt Ltd, TechNest Startup, Coastal Traders
- **Revenue this month:** ₹1,18,000
- **Outstanding:** ₹1,75,360
- **Active projects:** 2
- **Invoice statuses to show:** PAID (green), SENT (blue), OVERDUE (red), DRAFT (grey)

---

## STEP 3: The 9-Scene Animation Flow

Build each scene as a separate animated panel. The full demo runs 2:05 min. Scenes should auto-advance or be click-to-advance.

**Scene 1 — 0:00 to 0:07 — Dashboard WOW**
Show the Stackivo Pulse dashboard with:
- Revenue card: ₹1,18,000
- Outstanding: ₹1,75,360
- Clients: 4 | Active Projects: 2
- A clean bar/line chart showing monthly revenue trend
- Animate: numbers count up from 0 on load (700ms ease-out)
- Hold static for 3 seconds after count-up completes

**Scene 2 — 0:07 to 0:20 — Pain (Excel)**
Show a realistic messy Excel invoice:
- Manual CGST/SGST columns
- A cell showing wrong total in red
- A note: "Check IGST or CGST+SGST??"
- Animate: screen appears, slight shake/jitter to emphasise chaos, then fades to grey
- Transition: cross-dissolve to Scene 3

**Scene 3 — 0:20 to 0:30 — Stackivo Introduction**
Show the full Stackivo dashboard again, this time with the Stackivo logo and wordmark visible in the sidebar
- Animate: fade in from Scene 2, sidebar slides in from left, cards pop in with staggered 80ms delay

**Scene 4 — 0:30 to 0:43 — Add Client**
Show the Clients page → click "New Client" → form slides in → fill in:
- Company: Mehta Digital Solutions
- GSTIN: 22AABCM1234A1Z5
- State: Maharashtra (auto-populated from GSTIN)
- A badge appears: "CGST + SGST will apply" in blue
- Click Save → client card appears in list with a smooth pop animation

**Scene 5 — 0:43 to 1:15 — Invoice Flow (most important scene)**
This scene has 5 sub-steps, auto-advancing every 6-7 seconds:

5a. Open draft invoice for Coastal Traders — two line items visible, GST columns auto-filled
5b. Zoom into GST breakdown: IGST 18% = ₹14,465 (highlight with a soft pulse animation)
5c. Click PDF Preview — a professional invoice PDF slides in from the right (show full invoice with Stackivo branding, client details, line items, GST breakdown, QR code at bottom)
5d. Click Send — success toast: "Invoice sent to Fatima Shaikh" — QR code panel appears showing UPI payment QR
5e. Cut to Invoices list — INV-001 badge animates from SENT → PAID with a green pulse and confetti burst (3 particles max, subtle)
— Also show small mid-screen text overlay: "stackivo.me" in blue for 1.5 seconds

**Scene 6 — 1:15 to 1:28 — Contracts**
Show Contracts page → one contract with SIGNED badge (green checkmark) → click New Contract → contract editor appears with template text → Click Send → animated envelope icon flies off screen

**Scene 7 — 1:28 to 1:42 — Client Portal**
Show client portal view (as the client sees it):
- Header: "Mehta Digital Solutions — Client Portal"
- Sections: Invoices (1 paid shown), Files, Projects
- Animate: sections fade in sequentially with 150ms stagger
- Show a subtle "Powered by Stackivo" footer badge

**Scene 8 — 1:42 to 1:52 — Pulse Dashboard**
Return to the full Pulse dashboard
- Animate: revenue chart draws itself left-to-right (600ms)
- Highlight top client card: Mehta Digital Solutions — ₹1,18,000

**Scene 9 — 1:52 to 2:05 — CTA**
Clean screen: Stackivo gradient background (#2563EB → #4F46E5)
- Stackivo logo + wordmark centre-screen (white)
- Text below: "GST Invoicing · UPI Payments · Digital Contracts · Client Portal"
- Large CTA button: "Start Free at stackivo.me"
- Button pulses gently (scale 1 → 1.03 → 1, 2s loop)
- Small text: "No credit card required"

---

## STEP 4: Animation & Polish Requirements

- **Overall feel:** Premium SaaS — smooth, confident, never rushed
- **Transition between scenes:** 300ms cross-dissolve or slide (consistent throughout)
- **Cursor:** Show a simulated cursor that clicks and moves naturally during form-filling scenes
- **Loading states:** Add 200ms skeleton shimmer before content appears in each scene (makes it feel like a real app)
- **Easing:** Use ease-out for entrances, ease-in for exits. No linear animations.
- **Dark/Light mode:** Build in dark mode (#0A1020 background). Sidebar dark, content area slightly lighter (#0F172A).
- **Resolution target:** 1920×1080 (16:9) — this will be screen-recorded

---

## STEP 5: Export

Export as a **standalone HTML file** that:
- Auto-plays through all 9 scenes on load
- Has a subtle progress bar at the bottom showing position in the demo
- Has a pause/resume on spacebar
- Can be opened in Chrome full-screen (F11) for recording with OBS

---

## Screenshots I'm Providing (attach these to the Claude Design prompt):

1. Pulse dashboard screenshot
2. Invoice creation page screenshot
3. Clients list screenshot
4. Contracts page screenshot
5. Client portal screenshot

These are the real Stackivo UI — match the layout, spacing, and components as closely as possible when web capture isn't sufficient.
