# ARCHITECTURE.md

> System design, technical decisions, and architecture notes for SketchAI.

---

## System Overview

SketchAI is a client-server application. The React frontend handles UI and canvas rendering. The Rust backend handles AI generation, business logic, and payment processing. Supabase provides auth, database, and real-time capabilities. The frontend talks to both Supabase directly (for auth) and the Rust backend (for everything else).

```
┌──────────────────────────────────────────────────────────────┐
│                         Browser                              │
│                                                              │
│   React App (Vite + TypeScript)                              │
│   ┌────────────────┐     ┌──────────────────┐               │
│   │  Prompt UI     │     │  Excalidraw      │               │
│   │  + Controls    │     │  Canvas          │               │
│   └───────┬────────┘     └────────▲─────────┘               │
│           │                       │ Excalidraw JSON          │
│     Auth  │ (Supabase SDK)        │                          │
│     ──────▼──────     API calls   │                          │
└───────────┼───────────────────────┼──────────────────────────┘
            │                       │
            ▼                       │
┌───────────────────┐    ┌──────────┴───────────────────────┐
│   Supabase        │    │   Rust Backend (Axum)            │
│                   │    │                                  │
│  ┌─────────────┐  │    │  ┌────────────┐  ┌───────────┐  │
│  │  Auth       │◄─┼────┼─►│  Supabase  │  │  Diagram  │  │
│  │  (JWT)      │  │    │  │  JWT Verify│  │  Service  │  │
│  └─────────────┘  │    │  └────────────┘  └─────┬─────┘  │
│                   │    │                         │        │
│  ┌─────────────┐  │    │  ┌────────────┐         ▼        │
│  │  PostgreSQL │◄─┼────┼─►│  Billing   │  ┌───────────┐  │
│  │  (diagrams, │  │    │  │  Service   │  │  Claude   │  │
│  │   usage,    │  │    │  └────────────┘  │  API      │  │
│  │   subs)     │  │    │                  └───────────┘  │
│  └─────────────┘  │    │                                  │
└───────────────────┘    └──────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
           ┌─────────────┐                ┌─────────────────┐
           │   Stripe    │                │  NOWPayments    │
           │   (cards)   │                │  (crypto)       │
           └─────────────┘                └─────────────────┘
```

---

## Auth Architecture

**Supabase Auth handles everything at Phase 1.** There is no custom JWT implementation.

### How It Works

1. User signs up or logs in via the Supabase Auth SDK in the frontend
2. Supabase issues a JWT (signed with the project's secret)
3. The frontend includes this JWT in every request to the Rust backend as `Authorization: Bearer <token>`
4. The Rust backend verifies the JWT using Supabase's public JWKS endpoint — no secret sharing needed
5. The `sub` field in the JWT is the Supabase user UUID, used to scope all database queries

### Supabase Auth Features Used

- Email + password registration and login
- Email verification
- Password reset via email
- JWT auto-refresh (handled by Supabase SDK client-side)
- Row Level Security (RLS) — Supabase enforces that users can only read/write their own rows

### What We Do Not Need to Build

Because of Supabase Auth, we do not need to build:
- Custom JWT signing/verification
- Refresh token rotation
- Password hashing
- Email sending for verification and reset

---

## Frontend Architecture

### Stack

- **React 18** with TypeScript
- **Vite** for bundling and dev server
- **Tailwind CSS** for styling
- **Excalidraw** npm package — library mode, full programmatic control
- **TanStack Query** — server state, caching, background refetch
- **Zustand** — client state (current diagram, UI state)
- **React Router v6** — routing
- **Supabase JS SDK** — auth and any direct database reads

### Key Decisions

**Excalidraw in library mode**
We use `@excalidraw/excalidraw` as an npm package, not an iframe. This gives full control over canvas state — we inject AI-generated Excalidraw JSON directly without any postMessage complexity.

**Auth split: Supabase SDK for auth, Rust backend for everything else**
Auth state (login, logout, session) is managed entirely by the Supabase JS client. The Rust backend never issues tokens — it only verifies them. This keeps auth logic in one place and removes a whole category of bugs.

**AI output is Excalidraw JSON**
The backend returns JSON that maps directly to Excalidraw's element schema. The frontend sets it as canvas state. Users edit on a live canvas, not a static image.

### Component Structure

```
App
├── SupabaseAuthProvider       # Manages Supabase session state
├── Router
│   ├── /                     → LandingPage
│   ├── /login                → LoginPage
│   ├── /register             → RegisterPage
│   ├── /app                  → AppLayout (protected)
│   │   ├── PromptPanel       # Text input + diagram type selector
│   │   ├── CanvasPanel       # Excalidraw component wrapper
│   │   └── ExportPanel       # Export controls
│   ├── /history              → DiagramHistory (protected)
│   ├── /pricing              → PricingPage
│   └── /settings             → UserSettings (protected)
```

---

## Backend Architecture

### Stack

- **Rust** (stable 1.75+)
- **Axum** — async web framework
- **SQLx** — async PostgreSQL with compile-time checked queries (connects to Supabase PostgreSQL)
- **jsonwebtoken** crate — verifies Supabase-issued JWTs
- **reqwest** — HTTP client for Claude API, Stripe API, NOWPayments API
- **tokio** — async runtime
- **serde / serde_json** — serialisation

### Why Rust?

1. **Cost efficiency** — Every diagram request calls the Anthropic API which costs money. Server-side compute needs to be as cheap as possible. Rust's memory footprint is tiny, meaning we run on a small VPS and keep margins healthy.
2. **Safety** — No null pointer exceptions, no memory leaks. Billing and user data code needs to be correct.
3. **Speed** — Axum is among the fastest web frameworks across all languages. Fast response outside of the AI call makes the product feel snappy.

### Route Structure

```
backend/src/routes/
├── diagrams.rs    POST /diagrams/generate
│                  GET  /diagrams
│                  GET  /diagrams/:id
│                  DELETE /diagrams/:id
│
├── users.rs       GET  /users/me
│
├── billing.rs     POST /billing/stripe/create-checkout
│                  POST /billing/stripe/portal
│                  POST /billing/stripe/webhook
│                  POST /billing/crypto/create-payment
│                  POST /billing/crypto/webhook
│
└── health.rs      GET  /health
```

Note: Auth routes (register, login, logout, refresh) are handled entirely by Supabase. The Rust backend has no auth routes.

### Diagram Generation Flow

```
1.  Client sends POST /diagrams/generate
    { prompt: string, diagram_type: DiagramType }
    Authorization: Bearer <supabase_jwt>

2.  Axum auth middleware:
    - Fetches Supabase JWKS (cached in memory)
    - Verifies JWT signature and expiry
    - Extracts user_id from JWT sub claim

3.  Usage check (Supabase PostgreSQL):
    - Query usage table for user's current month count
    - If Free plan and count >= 15 → return 429

4.  DiagramService builds the Claude prompt:
    - System prompt with Excalidraw JSON schema + hand-drawn style rules
    - Diagram-type specific layout instructions
    - User's plain English prompt

5.  POST to Anthropic Claude API
    - Model: claude-sonnet-4-6
    - Expects response: valid Excalidraw JSON only

6.  Validate and sanitise returned JSON
    - Ensure elements array is present and non-empty
    - Strip any non-Excalidraw fields
    - If invalid → retry once, then return 502

7.  Save diagram to Supabase PostgreSQL
    - Insert into diagrams table
    - Increment usage count for current month

8.  Return Excalidraw JSON to client

9.  Client renders JSON onto Excalidraw canvas
```

### Prompt Engineering

The system prompt sent to Claude is the most critical engineering surface in the product. It instructs Claude to:

- Respond **only** with valid Excalidraw JSON — no prose, no markdown fences
- Use hand-drawn style parameters: `roughness: 1`, hand-drawn font family, informal stroke widths
- Follow diagram-type specific layout rules (e.g. sequence diagrams flow vertically, flowcharts use diamonds for decisions, ERDs show cardinality on arrows)
- Use meaningful labels, not placeholder text
- Keep diagrams readable at standard canvas zoom

Prompt quality is the primary lever for diagram quality. This will need ongoing tuning based on real user output.

---

## Database Schema (Supabase PostgreSQL)

Supabase manages the database. Migrations live in `supabase/migrations/`.

```sql
-- Profiles (extends Supabase auth.users)
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan        TEXT NOT NULL DEFAULT 'free',  -- free | pro | team
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Diagrams
CREATE TABLE diagrams (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT,
  prompt        TEXT NOT NULL,
  diagram_type  TEXT NOT NULL,
  canvas_json   JSONB NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Usage tracking (for free tier enforcement)
CREATE TABLE usage (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  month       TEXT NOT NULL,  -- format: "2026-03"
  count       INTEGER DEFAULT 0,
  UNIQUE(user_id, month)
);

-- Subscriptions
CREATE TABLE subscriptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider            TEXT NOT NULL,  -- stripe | crypto
  provider_customer   TEXT,           -- Stripe customer ID or crypto wallet
  provider_sub_id     TEXT,           -- Stripe subscription ID or NOWPayments payment ID
  plan                TEXT NOT NULL,  -- pro | team
  status              TEXT NOT NULL,  -- active | canceled | past_due | expired
  current_period_end  TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ DEFAULT now()
);
```

### Row Level Security (RLS)

Supabase RLS policies enforce that users can only access their own data. This is the primary data security layer — no cross-user data leakage is possible at the database level regardless of what the application layer does.

```sql
-- Example RLS policies
ALTER TABLE diagrams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own diagrams"
  ON diagrams FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own diagrams"
  ON diagrams FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own diagrams"
  ON diagrams FOR DELETE
  USING (auth.uid() = user_id);
```

---

## Payment Architecture

### Stripe (Card Payments)

Standard Stripe Checkout flow:

1. User clicks upgrade → frontend calls `POST /billing/stripe/create-checkout`
2. Backend creates a Stripe Checkout Session and returns the URL
3. User completes payment on Stripe-hosted page
4. Stripe sends webhook to `POST /billing/stripe/webhook`
5. Backend verifies webhook signature, activates Pro/Team plan in Supabase

### Crypto Payments (NOWPayments)

NOWPayments provides a crypto payment gateway supporting BTC, ETH, USDC, and others.

1. User selects crypto payment → frontend calls `POST /billing/crypto/create-payment`
2. Backend creates a NOWPayments payment invoice and returns the payment URL and address
3. User sends crypto to the provided address
4. NOWPayments sends IPN (Instant Payment Notification) webhook to `POST /billing/crypto/webhook`
5. Backend verifies the IPN, activates plan based on payment amount

**Crypto plan duration:** Crypto payments are treated as one-time payments granting a fixed access period (30 days Pro, 365 days annual Pro). There is no auto-renewal — user must pay again to extend.

**Why NOWPayments over direct wallet?**
NOWPayments handles exchange rate calculation, multi-chain support, and IPN notifications. Building direct wallet payment detection is significantly more complex and error-prone for Phase 1.

---

## Rate Limiting (Phase 1 — No Redis)

At Phase 1, rate limiting is handled in two layers without Redis:

**IP-level (Axum middleware)**
Simple in-memory request counter per IP using a `DashMap`. Resets on server restart. Good enough for Phase 1 — not suitable for multi-instance deployments.

**User-level (Supabase PostgreSQL)**
The `usage` table tracks diagrams generated per user per month. Checked on every generation request. Atomic increment using `INSERT ... ON CONFLICT DO UPDATE`.

```sql
INSERT INTO usage (user_id, month, count)
VALUES ($1, $2, 1)
ON CONFLICT (user_id, month)
DO UPDATE SET count = usage.count + 1
RETURNING count;
```

Redis will replace the in-memory IP limiter in Phase 3 when horizontal scaling becomes necessary.

---

## Deployment

| Service | Provider | Cost at Launch |
|---|---|---|
| Frontend | Vercel | Free |
| Backend | Fly.io | ~$5/month (512MB RAM instance) |
| Database + Auth | Supabase | Free (up to 500MB, 50k MAU) |
| File storage | Supabase Storage (Phase 2) | Free tier |

**Total Phase 1 infrastructure cost: ~$5/month.**

The Anthropic API is the only variable cost. At $3 per million input tokens (Sonnet), diagram generation costs roughly $0.01–0.03 per diagram. At 5,000 diagrams/month that is $50–150/month in API costs. Pro tier revenue at that volume is $450+/month. Margins are healthy from the start.

---

## Security

- Supabase Auth handles password hashing, token signing, and email verification
- Rust backend never stores passwords or issues tokens
- Anthropic and Stripe API keys live only in backend environment variables
- All database queries scoped by `user_id` from verified JWT — no application-level auth bypass possible
- Supabase RLS provides database-level data isolation as a second layer
- Stripe webhooks verified using Stripe signature header
- NOWPayments IPN verified using NOWPayments IPN secret
- CORS configured to allow only the frontend origin