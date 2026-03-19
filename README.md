# SketchAI

> Unlimited AI diagramming for engineers — hand-drawn style, no rate limits, built for how developers actually work.

![License](https://img.shields.io/badge/license-MIT-blue)
![Stack](https://img.shields.io/badge/stack-React%20%2B%20Rust-informational)
![Status](https://img.shields.io/badge/status-in%20development-yellow)

---

## What Is SketchAI?

SketchAI is a focused AI diagram generation tool built for software engineers and technical writers. You describe what you need in plain English, choose a diagram type, and get a fully editable hand-drawn style diagram in seconds — with no daily request cap.

It is the product that Excalidraw's AI Beta hints at but does not fully deliver: unlimited, technically deep, and integrated into developer workflows.

---

## Why SketchAI?

| Problem | SketchAI's Answer |
|---|---|
| Excalidraw AI is capped at 9 requests/day | Unlimited generation on Pro |
| Enterprise tools feel heavy and corporate | Hand-drawn aesthetic — a thinking tool, not a presentation tool |
| AI diagram tools lack software architecture vocabulary | Deep support for C4, ERD, Sequence, Architecture diagrams |
| Diagrams are locked inside tools | One-click export to GitHub, Notion, Confluence |

---

## Diagram Types Supported

- **Flowchart** — process flows, decision trees, user journeys
- **System Architecture** — microservices, APIs, databases, infrastructure
- **Sequence Diagram** — authentication flows, API calls, time-ordered interactions
- **Component Diagram** — software modules and their relationships
- **Entity Relationship Diagram (ERD)** — database schema and table relationships
- **C4 Model** — context, container, component, and code diagrams

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React + TypeScript | Component model fits canvas-heavy UI |
| Styling | Tailwind CSS | Fast, utility-first, no design overhead |
| Canvas | Excalidraw (library) | Hand-drawn aesthetic, fully editable output |
| Backend | Rust (Axum) | Fast, memory-safe, lean resource usage |
| Auth | Supabase Auth | Email/password + OAuth out of the box, zero custom JWT setup |
| Database | Supabase (PostgreSQL) | Managed Postgres, real-time, generous free tier |
| AI Layer | Anthropic Claude API | Best instruction following for structured diagram output |
| Payments (card) | Stripe | Industry standard, reliable subscription billing |
| Payments (crypto) | NOWPayments | BTC, ETH, USDC support — right fit for a developer audience |

> **No Redis at Phase 1.** Rate limiting is handled via Supabase row-level logic and Axum middleware. Redis will be introduced in Phase 3 when caching becomes a real cost concern.

---

## Project Structure

```
sketchai/
├── frontend/                   # React + TypeScript app
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   ├── pages/              # Route-level pages
│   │   ├── hooks/              # Custom React hooks
│   │   ├── lib/
│   │   │   ├── supabase.ts     # Supabase client initialisation
│   │   │   └── api.ts          # Rust backend API client
│   │   └── types/              # Shared TypeScript types
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
│
├── backend/                    # Rust + Axum API server
│   ├── src/
│   │   ├── main.rs
│   │   ├── routes/             # HTTP route handlers
│   │   ├── services/           # Business logic
│   │   │   ├── diagram.rs      # AI generation, Excalidraw JSON building
│   │   │   ├── billing.rs      # Stripe + NOWPayments
│   │   │   └── usage.rs        # Free tier enforcement
│   │   ├── middleware/         # Supabase JWT verification, rate limiting
│   │   └── config.rs           # Environment config loader
│   └── Cargo.toml
│
├── supabase/                   # Supabase project config
│   ├── migrations/             # Versioned SQL migrations
│   └── seed.sql                # Development seed data
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── ROADMAP.md
│   └── CHANGELOG.md
│
├── .env.example
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- Rust 1.75+ — install via [rustup.rs](https://rustup.rs)
- Supabase CLI — `npm install -g supabase`
- A Supabase project — free at [supabase.com](https://supabase.com)
- An Anthropic API key — [console.anthropic.com](https://console.anthropic.com)

### 1. Clone

```bash
git clone https://github.com/yourusername/sketchai.git
cd sketchai
```

### 2. Environment variables

```bash
cp .env.example .env
# Fill in all values — see .env.example for descriptions
```

### 3. Supabase setup

```bash
supabase link --project-ref your-project-ref
supabase db push
```

### 4. Backend

```bash
cd backend
cargo build
cargo run
# Listening on http://localhost:8080
```

### 5. Frontend

```bash
cd frontend
npm install
npm run dev
# Running on http://localhost:5173
```

---

## Payments

SketchAI supports two payment methods for Pro and Team plans:

**Stripe** — credit/debit card subscriptions. Standard monthly billing.

**Crypto via NOWPayments** — pay with BTC, ETH, USDC, and other major chains. Engineers who prefer crypto should not be forced to use a card. Crypto payments grant the equivalent Pro or Team access for the paid period.

---

## License

MIT — see `LICENSE` for details.