# API.md

> REST API reference for the SketchAI Rust backend.

---

## Important: Auth is Supabase, Not This Backend

**Registration, login, logout, and token refresh are handled entirely by the Supabase Auth SDK on the frontend.** The Rust backend has no auth endpoints. It only verifies the JWT that Supabase issues.

See [Supabase Auth Docs](https://supabase.com/docs/guides/auth) for the client-side auth flow.

---

## Base URL

```
Development:  http://localhost:8080
Production:   https://api.sketchai.app
```

---

## Authentication

All protected endpoints require the Supabase JWT in the `Authorization` header:

```
Authorization: Bearer <supabase_access_token>
```

Obtain this token from the Supabase JS client:

```typescript
const { data: { session } } = await supabase.auth.getSession()
const token = session?.access_token
```

The Supabase SDK handles token refresh automatically. Tokens expire after 1 hour by default (configurable in Supabase project settings).

---

## Response Format

All responses return JSON.

**Success:**
```json
{ "data": { ... } }
```

**Error:**
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description."
  }
}
```

### Error Codes

| Code | HTTP Status | Meaning |
|---|---|---|
| `UNAUTHORIZED` | 401 | Missing, expired, or invalid Supabase JWT |
| `FORBIDDEN` | 403 | Valid token but resource belongs to another user |
| `NOT_FOUND` | 404 | Resource does not exist |
| `RATE_LIMIT_EXCEEDED` | 429 | Free tier monthly diagram limit reached |
| `VALIDATION_ERROR` | 422 | Request body failed validation |
| `AI_GENERATION_FAILED` | 502 | Claude API returned an unexpected response |
| `PAYMENT_VERIFICATION_FAILED` | 400 | Webhook signature verification failed |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Endpoints

---

### Diagrams

#### `POST /diagrams/generate`

Generate a new diagram from a plain English prompt.

**Auth** — Required

**Request**
```json
{
  "prompt": "draw a user authentication flow with JWT and refresh tokens",
  "diagram_type": "sequence",
  "title": "JWT Auth Flow"
}
```

**Diagram Types**

| Value | Description |
|---|---|
| `flowchart` | Process flows, decision trees, user journeys |
| `architecture` | System architecture, microservices, infrastructure |
| `sequence` | Time-ordered interactions between systems or actors |
| `component` | Software modules and their relationships |
| `erd` | Database schema and table relationships |
| `c4` | C4 model — context, container, component diagrams |

**Response `201`**
```json
{
  "data": {
    "diagram": {
      "id": "uuid",
      "title": "JWT Auth Flow",
      "prompt": "draw a user authentication flow with JWT and refresh tokens",
      "diagram_type": "sequence",
      "canvas_json": {
        "type": "excalidraw",
        "version": 2,
        "elements": [],
        "appState": {}
      },
      "created_at": "2026-03-01T10:00:00Z"
    }
  }
}
```

**Error `429`**
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Free tier limit of 15 diagrams per month reached.",
    "upgrade_url": "https://sketchai.app/pricing"
  }
}
```

---

#### `GET /diagrams`

List the authenticated user's diagrams. Returns most recent first.

**Auth** — Required

**Query Parameters**

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | integer | 20 | Max results (max 50) |
| `offset` | integer | 0 | Pagination offset |
| `type` | string | — | Filter by `diagram_type` |

**Response `200`**
```json
{
  "data": {
    "diagrams": [
      {
        "id": "uuid",
        "title": "JWT Auth Flow",
        "diagram_type": "sequence",
        "created_at": "2026-03-01T10:00:00Z"
      }
    ],
    "total": 12,
    "limit": 20,
    "offset": 0
  }
}
```

Note: `canvas_json` is omitted from the list for performance. Fetch a single diagram to get the full canvas JSON.

---

#### `GET /diagrams/:id`

Fetch a single diagram with full canvas JSON.

**Auth** — Required

**Response `200`**
```json
{
  "data": {
    "diagram": {
      "id": "uuid",
      "title": "JWT Auth Flow",
      "prompt": "draw a user authentication flow with JWT and refresh tokens",
      "diagram_type": "sequence",
      "canvas_json": { "..." : "..." },
      "created_at": "2026-03-01T10:00:00Z"
    }
  }
}
```

---

#### `DELETE /diagrams/:id`

Delete a diagram. Users can only delete their own diagrams.

**Auth** — Required

**Response `204`** — No content.

---

### Users

#### `GET /users/me`

Fetch current user profile and usage stats.

**Auth** — Required

**Response `200`**
```json
{
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "plan": "free",
      "usage": {
        "month": "2026-03",
        "diagrams_generated": 8,
        "limit": 15
      }
    }
  }
}
```

`limit` is `null` for Pro and Team users (unlimited). Free users see `15`.

---

### Billing — Stripe (Card)

#### `POST /billing/stripe/create-checkout`

Create a Stripe Checkout session to upgrade to Pro or Team.

**Auth** — Required

**Request**
```json
{
  "plan": "pro",
  "success_url": "https://sketchai.app/app?upgraded=true",
  "cancel_url": "https://sketchai.app/pricing"
}
```

| Plan | Price |
|---|---|
| `pro` | $9/month |
| `team` | $19/user/month |

**Response `200`**
```json
{
  "data": {
    "checkout_url": "https://checkout.stripe.com/pay/cs_..."
  }
}
```

Redirect the user to `checkout_url` to complete payment on Stripe's hosted page.

---

#### `POST /billing/stripe/portal`

Create a Stripe Customer Portal session. Allows user to cancel, update card, or view invoices.

**Auth** — Required

**Request**
```json
{
  "return_url": "https://sketchai.app/settings"
}
```

**Response `200`**
```json
{
  "data": {
    "portal_url": "https://billing.stripe.com/session/..."
  }
}
```

---

#### `POST /billing/stripe/webhook`

Stripe webhook endpoint. Not called by the frontend — called by Stripe servers only.

**Auth** — Stripe signature (`Stripe-Signature` header), verified server-side.

**Handled Events**

| Stripe Event | Action |
|---|---|
| `checkout.session.completed` | Activate Pro/Team, create subscription record |
| `invoice.payment_succeeded` | Extend subscription period |
| `invoice.payment_failed` | Mark subscription `past_due`, email user |
| `customer.subscription.deleted` | Downgrade user to free plan |

**Response `200`** — Empty body. Any non-200 response causes Stripe to retry.

---

### Billing — Crypto (NOWPayments)

#### `POST /billing/crypto/create-payment`

Create a crypto payment invoice via NOWPayments.

**Auth** — Required

**Request**
```json
{
  "plan": "pro",
  "currency": "eth",
  "period": "monthly"
}
```

**Supported currencies**

`btc`, `eth`, `usdc`, `usdt`, `bnb`, `sol`

**Periods**

| Value | Duration | Notes |
|---|---|---|
| `monthly` | 30 days Pro access | Manual renewal |
| `annual` | 365 days Pro access | Better value, same manual renewal |

**Response `200`**
```json
{
  "data": {
    "payment_id": "nowpayments-uuid",
    "payment_address": "0xABC...",
    "payment_amount": "0.00312",
    "currency": "eth",
    "expires_at": "2026-03-01T11:00:00Z",
    "payment_url": "https://nowpayments.io/payment/..."
  }
}
```

The user sends the exact `payment_amount` in `currency` to `payment_address` before `expires_at`. Alternatively redirect to `payment_url` for a NOWPayments-hosted payment page.

---

#### `POST /billing/crypto/webhook`

NOWPayments IPN webhook. Called by NOWPayments when payment status changes.

**Auth** — IPN signature verification using `x-nowpayments-sig` header.

**Handled Statuses**

| Status | Action |
|---|---|
| `confirmed` | Activate Pro plan for paid period |
| `failed` | No action — log for monitoring |
| `expired` | No action — log for monitoring |

**Response `200`** — NOWPayments retries on non-200.

---

### Health

#### `GET /health`

Health check for uptime monitoring. No auth required.

**Response `200`**
```json
{
  "status": "ok",
  "version": "0.1.0"
}
```

---

## Rate Limits

| Limit | Scope | Value |
|---|---|---|
| IP-based (all endpoints) | Per IP per minute | 60 requests |
| Diagram generation (Free plan) | Per user per month | 15 diagrams |
| Diagram generation (Pro/Team) | Per user | Unlimited |

---

## Supabase Direct Access (Frontend Only)

The frontend uses the Supabase JS client directly for auth operations. These are not routed through the Rust backend.

```typescript
// Register
await supabase.auth.signUp({ email, password })

// Login
await supabase.auth.signInWithPassword({ email, password })

// Logout
await supabase.auth.signOut()

// Get current session
const { data: { session } } = await supabase.auth.getSession()

// Listen to auth changes
supabase.auth.onAuthStateChange((event, session) => { ... })
```