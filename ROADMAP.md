# ROADMAP.md

> Planned features and milestones for SketchAI. Updated as priorities evolve.

---

## How This Roadmap Works

Features are grouped by phase, not by date. Dates shift — phases do not. Each phase has one clear goal. **Do not start the next phase until the current phase goal is met.**

---

## Phase 1 — MVP (Weeks 1–8)

**Goal: Ship a working product. Get 300 free signups. Talk to every user.**

### Infrastructure

- [ ] Supabase project setup — auth, database, RLS policies
- [ ] SQL migrations — profiles, diagrams, usage, subscriptions tables
- [ ] Rust backend scaffolding — Axum, SQLx, Supabase JWT verification
- [ ] React frontend scaffolding — Vite, TypeScript, Tailwind, Supabase SDK
- [ ] Excalidraw npm package integration (library mode)
- [ ] Deploy backend to Fly.io
- [ ] Deploy frontend to Vercel
- [ ] Environment variable setup for all services

### Auth (Supabase)

- [ ] Email + password registration
- [ ] Email verification flow
- [ ] Login and logout
- [ ] Password reset via email
- [ ] Protected route handling in React

### Core Product

- [ ] Plain English prompt input with diagram type selector
- [ ] AI diagram generation via Claude API (Anthropic)
- [ ] Excalidraw canvas rendering of AI output — fully editable
- [ ] Diagram history — last 20 diagrams per user
- [ ] PNG and SVG export
- [ ] Shareable read-only link per diagram
- [ ] Free tier enforcement — 15 diagrams/month via usage table
- [ ] Upgrade prompt shown when free limit is hit

### Diagram Types at Phase 1

- [ ] Flowchart
- [ ] System Architecture
- [ ] Sequence Diagram
- [ ] Component Diagram
- [ ] ERD
- [ ] C4 Model

### Definition of Done

- A user can register, generate a diagram, edit it, and export it
- Free tier is enforced correctly
- App is live and publicly accessible
- At least 10 real users have given written feedback

---

## Phase 2 — Traction (Month 3–4)

**Goal: 50 paying users. $450 MRR. Pro tier live.**

### Monetisation

- [ ] Stripe integration — Pro plan ($9/month) and Team plan ($19/user/month)
- [ ] Stripe Checkout session creation
- [ ] Stripe Customer Portal (cancel, update card)
- [ ] Stripe webhook handling — activate, renew, cancel, payment failure
- [ ] NOWPayments integration — crypto payment invoices
- [ ] NOWPayments IPN webhook — activate plan on confirmed payment
- [ ] Supported crypto: BTC, ETH, USDC, USDT
- [ ] Billing settings page in UI

### Product

- [ ] Conversational refinement — follow-up prompts on the same diagram
- [ ] Prompt library — 20 pre-built prompts for common engineering diagrams
- [ ] Diagram variants — generate 3 versions from one prompt
- [ ] One-click export for Notion (correct image dimensions)
- [ ] One-click export for GitHub README (hosted image URL in markdown)
- [ ] Diagram title editing inline on canvas

---

## Phase 3 — Growth (Month 5–8)

**Goal: 200 paying users. $1,800 MRR. Team plan growing.**

### Infrastructure

- [ ] Redis integration — replace in-memory IP rate limiter
- [ ] Prompt result caching (identical prompts return cached Excalidraw JSON)
- [ ] Internal analytics — diagrams generated per day, conversion rate, plan breakdown

### Product

- [ ] Diagram from code — paste SQL schema → ERD, paste class → component diagram
- [ ] Team workspace — shared diagram library
- [ ] Team invite system via email
- [ ] One-click export for Confluence and Dev.to
- [ ] Diagram version history — last 5 versions per diagram (Pro only)
- [ ] Dark mode

### Growth

- [ ] AppSumo or Gumroad lifetime deal campaign
- [ ] API access for Pro users ($29/month add-on)

---

## Phase 4 — Expansion (Month 9–12)

**Goal: 500 paying users. $4,500 MRR.**

- [ ] REST API with API key auth for Pro/Team users
- [ ] Embeddable diagram widget (web component)
- [ ] Diagram-to-project-scaffold — architecture diagram → folder structure + README
- [ ] Template marketplace — community uploads, SketchAI takes 30%
- [ ] Begin migration planning from Excalidraw to independent renderer (Rough.js evaluation)

---

## Phase 5 — Vision (Year 2+)

- [ ] Migrate to independent hand-drawn renderer — no Excalidraw dependency
- [ ] Real-time collaborative editing
- [ ] Spec-to-diagram-to-code-scaffold pipeline
- [ ] Enterprise plan — SSO, SAML, audit logs
- [ ] White-label licensing for consulting firms

---

## Deliberately Out of Scope

| Feature | Reason |
|---|---|
| Gantt / roadmap charts | Different audience entirely |
| Presentation mode | Against our positioning as a thinking tool |
| Mobile app | Web-first until Phase 4 at earliest |
| AI image generation | Not a diagram product |
| Offline mode | Complexity not justified at this scale |