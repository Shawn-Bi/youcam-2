# Look Exchange — Frontend PRD

**Owner:** Dennis · **Version:** 1.1 · October 30, 2026 — Next.js + Tailwind, based on FitFindr's prototypes
**Parent:** [Look Exchange PRD](look-exchange-prd.md) · **Flow:** [User flow](look-exchange-user-flow.md) · **Mockups:** [concepts/](concepts/)
**Deadline:** November 2, 2026, 11:45 AM EST

## 1. What you are building

The whole user-facing app: a responsive React site where a shopper posts a brief, compares four stores' proposals, previews them on their own photo, revises, picks a store, generates a video, and saves. You never call YouCam directly; everything goes through Shawn's backend using the [shared contract](look-exchange-prd.md#6-shared-api-contract).

## 2. Stack

- **Next.js (App Router) + TypeScript + Tailwind CSS**, the same stack FitFindr plans, so screens can move into FitFindr later. Deploy on Vercel.
- **Start fresh:** `npx create-next-app@latest frontend --ts --tailwind --app --eslint`. The FitFindr agent repo (private; Shawn granted access) has no frontend code yet, so there is nothing to fork.
- **Data fetching:** plain `fetch` wrapped in a small `lib/api.ts`. Pages that poll are client components (`"use client"`). Polling is the main need.
- **Config:** `NEXT_PUBLIC_API_BASE_URL` for the backend URL. No secrets in the frontend, ever.

### What to take from FitFindr

The FitFindr agent repo is the visual base. Use:

| FitFindr source | Use it for |
| --- | --- |
| `docs/prototype/*.dc.html` — approved HTML screens | Copy layout, spacing and component patterns. Ignore the `<x-dc>` / `DCLogic` wrapper. `Results.dc.html` / `DesktopResults.dc.html` → proposal cards; `ItemDetail.dc.html` → item rows on the revise panel; `Home.dc.html` → brief screen |
| UI rules | 375 px with no horizontal scroll; multi-column at 1280 px; touch targets ≥ 44 px; contrast ≥ 4.5:1; real `<button>`, `<a>`, `<label>` |
| Empty-results pattern (its `DECISIONS.md` #17) | No-match state: show what was searched + one-click "Remove size" / "Raise budget" |
| `docs/legal/privacy.md` | Starting point for the photo-consent privacy note |

Leave out: FitFindr's color tokens (Look Exchange has its own design system), Supabase auth, closet, profile and sign-up screens, its resale-store search, and its Python/Gemini backend. Copy no keys or `.env` values.

Our [concept images](concepts/) show the screens and flow.

### Visual design

Colors, fonts, spacing and the favicon come from Dennis's design system and go into the Tailwind theme and `app/` as part of task F1. Screens use token names, never raw hex values.

## 3. Screens

### 3.0 Shop (new)
- Home (`/`): photo hero "Four stores. One look. Yours." with "Post a style brief" and "Browse the shops", a tile for each store, and a "New in" row.
- All products (`/shop`), stores (`/stores`), one store (`/stores/:storeId`): product grid with filters for category, store, size and price, and a "Not sure? Post a style brief" banner.
- Product (`/products/:itemId`): photo, price, size buttons (sold-out sizes disabled), "More from" the store, and "Style a look around this", which opens `/brief?item=…&size=…` with the piece written into the brief.
- All product data comes from the shared catalog `data/catalog.json`; photos are in `public/catalog/`. No cart.

### 3.1 Brief (`/brief`) — concept `01-brief.png`
- Photo upload: drag/drop or file picker, preview, JPG/PNG only, under 10 MB, clear error text.
- Consent checkbox, required: "I agree to send this photo to YouCam for try-on processing." Link to a short privacy note.
- Layout (concept C2): title "Tell us the look" centered; full-body photo on the left with the consent line under it; on the right, one sentence "The look you want" and "Pieces you already own and want to keep" (chips). Fits one desktop screen.
- Budget (required), top or jacket size (required) and bottoms size (optional) sit under the sentence, matching the backend. `lib/parseBrief.ts` reads a size ("in size S", "I wear a medium") and a budget ("under $120", "80 dollars") from the sentence and fills those fields until the shopper edits them by hand. No occasion field.
- "Get proposals" needs a photo, consent, the sentence, a budget and a top size. A 422 error for a field the form doesn't show appears above the button.
- Calls `POST /api/photos` then `POST /api/briefs`. Show `422` field errors next to the right field.

### 3.2 Proposals (`/proposals/:briefId`) — concept `02-proposals.png`
- Two cards side by side on desktop, stacked on mobile.
- Each card: store name, item photos with name, **size**, price; "Kept: your boots" chip; subtotal; styling note; **Preview on me**; **Pick this store**.
- While the backend is building: a skeleton card per store with "Building a proposal…".
- No-match: the store's card shows what was searched and offers **Remove size**, **Raise budget** and **Edit brief** (FitFindr's empty-results pattern).

### 3.3 Preview & revise (`/proposals/:briefId/:proposalId`) — concept `03-preview-revise.png`
- Left: the try-on image labeled **"AI-generated preview"**. Next to it: the product photo labeled **"Product photo"**.
- Right panel: item list. Each item has a **lock** toggle, **Replace** button, and **size picker** (from `sizesInStock`).
- Size change → `PATCH .../items/:itemId { size }`. On `409 out_of_stock`, show the alternatives in a small list.
- Replace → `POST .../replace`, optional instruction ("cheaper silver bag").
- Only the changed item's preview reloads; mark old previews "Out of date" until the new one is ready.
- Subtotal updates on every change; flag it red if it goes over budget.
- **Pick this store** → `POST .../select`, which unlocks the video panel.

### 3.4 Video (panel on the preview page, after picking a store)
- Shows only on the selected proposal.
- "Generate video" with a short note: "5-second AI video of your look. Takes about a minute."
- Calls `POST /api/proposals/:id/videos { previewId, duration: 5, resolution: "480" }`, then polls `GET /api/videos/:videoId`.
- Progress state, then a `<video>` player (autoplay muted, loop, controls). Label it **"AI-generated video"**.
- Failure: plain message + "Try again". The proposal stays usable.

### 3.5 Saved (`/saved/:proposalId`)
- Final items with sizes, prices, subtotal, product links, the preview image and the video if made.
- "Start a new brief".

## 4. Async polling

Try-on and video tasks take seconds to minutes. One shared hook, for example `usePollStatus(url)`:
- Poll every 2 s; back off to 5 s after 20 s.
- Stop on `success` or `failed`, or after a timeout (try-on 90 s, video 4 min) → show a timeout state with Retry.
- Cancel polling when the component unmounts.

## 5. States checklist

Every screen handles: loading, empty/no match, validation error, API failure, timeout, out-of-stock size, over budget, outdated preview. Never show a broken image or a silent spinner.

## 6. Mock mode

Build against mocks first so you aren't blocked by the backend:
- `mocks/` holds JSON that matches the contract types exactly (copy `Item` and `Proposal` from the main PRD into `lib/types.ts`).
- `NEXT_PUBLIC_USE_MOCKS=true` swaps `lib/api.ts` to return mocks with fake delays, including one failing preview so you can build error states.
- Switch to the real backend as soon as Shawn's endpoints are deployed.

## 7. Quality bar

- FitFindr's UI rules (section 2): 375 px with no horizontal scroll, multi-column desktop, 44 px touch targets, 4.5:1 contrast.
- Keyboard reachable; images have alt text; buttons have clear labels.
- AI labels on every generated image and video. No claims about exact fit.
- Photo stays in memory/upload only; nothing stored in `localStorage`.

## 8. Your tasks

| # | Task | Day |
| --- | --- | --- |
| F1 | Scaffold Next.js + TS + Tailwind; add the design-system tokens, fonts and favicon | Fri |
| F2 | `lib/types.ts` + mocks from the contract; `lib/api.ts` with mock switch | Fri |
| F3 | Brief screen with validation and consent | Fri |
| F4 | Proposals screen with loading and no-match states | Sat |
| F5 | Preview & revise: lock, replace, size picker, subtotal, outdated previews | Sat |
| F6 | `usePollStatus` hook with timeouts | Sat |
| F7 | Pick a store + video panel | Sun |
| F8 | Saved screen | Sun |
| F9 | Switch to the real backend; fix contract mismatches with Shawn | Sun |
| F10 | Mobile + accessibility pass; deploy on Vercel with `NEXT_PUBLIC_API_BASE_URL` | Sun |
| F11 | Screenshots + 1–3 min demo video on YouTube, naming the YouCam APIs used | Mon AM |

## 9. Done means

- Full flow works on the deployed site against the real backend, on phone and desktop.
- One real try-on and one real video shown in the demo.
- No secrets in the repo or bundle (search the build output for the key to be sure).
