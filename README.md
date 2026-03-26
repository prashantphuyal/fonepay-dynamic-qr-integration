# Fonepay Dynamic QR — Demo Integration

A minimal, production-ready reference implementation for integrating **Fonepay Dynamic QR** payments into a React web app using **Supabase Edge Functions**.

Scan a QR → pay via any Nepali banking app → payment confirmed in real time via WebSocket + polling fallback.

---
<img width="456" height="595" alt="image" src="https://github.com/user-attachments/assets/85975896-4280-4f4e-8ace-8f4e620d3036" />
<img width="1794" height="967" alt="image" src="https://github.com/user-attachments/assets/d591b347-9b13-4d94-8586-c0c7889f0d27" />


## How it works

```
Browser (React + Vite)
  └── POST /functions/v1/generate-fonepay-qr   → Fonepay API → returns QR string + WebSocket URL
  └── WebSocket (wss://ws.fonepay.com/...)      → real-time payment confirmation
  └── POST /functions/v1/verify-fonepay-payment → polling fallback every 3s
```

The merchant credentials **never touch the browser** — all signing (HMAC-SHA512) happens inside Supabase Edge Functions.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite |
| Backend | Supabase Edge Functions (Deno) |
| Payments | Fonepay Dynamic QR API |
| Real-time | Fonepay WebSocket + polling fallback |

---

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started) (`npm i -g supabase`)
- A Supabase project — [create one free](https://supabase.com)
- Fonepay merchant credentials (merchant code, secret, username, password)

---

## Local development

### 1. Clone & install

```bash
git clone https://github.com/your-username/fonepay-demo.git
cd fonepay-demo
npm install
```

### 2. Set up environment variables

```bash
# Frontend env
cp .env.local.example .env.local
# Fill in your Supabase project URL and anon key
```

```bash
# Edge Function secrets (local dev only)
cp supabase/functions/.env.example supabase/functions/.env
# Fill in your Fonepay merchant credentials
```

### 3. Link your Supabase project

```bash
supabase login
supabase link --project-ref your-project-ref
```

### 4. Run locally

```bash
# Terminal 1 — serve edge functions
supabase functions serve --env-file supabase/functions/.env

# Terminal 2 — run the React app
npm run dev
```

Open http://localhost:5173

---

## Deploying to production

### 1. Deploy edge functions

```bash
supabase functions deploy generate-fonepay-qr
supabase functions deploy verify-fonepay-payment
```

### 2. Set production secrets

```bash
supabase secrets set \
  FONEPAY_MERCHANT_CODE=your-merchant-code \
  FONEPAY_MERCHANT_SECRET=your-merchant-secret \
  FONEPAY_USERNAME=your-phone \
  FONEPAY_PASSWORD=your-password
```

### 3. Build & deploy the frontend

```bash
npm run build
# Deploy the `dist/` folder to Vercel, Netlify, Cloudflare Pages, etc.
```

Set these environment variables on your hosting platform:
```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## Edge Functions

### `generate-fonepay-qr`

**POST** `/functions/v1/generate-fonepay-qr`

Request:
```json
{ "amount": 10, "remarks1": "Order #123", "remarks2": "CustomerName" }
```

Response:
```json
{
  "qrMessage": "...",
  "thirdpartyQrWebSocketUrl": "wss://ws.fonepay.com/...",
  "prn": "POS_abc123..."
}
```

### `verify-fonepay-payment`

**POST** `/functions/v1/verify-fonepay-payment`

Request:
```json
{ "prn": "POS_abc123..." }
```

Response: Fonepay status object. Payment is confirmed when `statusCode === "S00"` or `paymentSuccess === true`.

---

## Security notes

- Merchant credentials are stored as **Supabase secrets** — never in client code
- HMAC-SHA512 signatures are computed server-side
- `verify_jwt` is disabled on these functions so they are callable without a logged-in user — enable it if your app requires authentication

---

## Keeping the project active

Supabase pauses **free-tier projects** after 1 week of inactivity. To prevent this, either upgrade to a paid plan or set up a periodic health-check ping to your project URL.

---

## License

MIT
