# Look Exchange — Frontend PRD

**Owner:** Dennis · **Version:** 1.0 · October 30, 2026
**Parent:** [Look Exchange PRD](look-exchange-prd.md) · **Flow:** [User flow](look-exchange-user-flow.md) · **Mockups:** [concepts/](concepts/)
**Deadline:** November 2, 2026, 11:45 AM EST

## 1. What you are building

The whole user-facing app: a responsive React site where a shopper posts a brief, compares two stores' proposals, previews them on their own photo, revises, picks a store, generates a video, and saves. You never call YouCam directly; everything goes through Shawn's backend using the [shared contract](look-exchange-prd.md#6-shared-api-contract).

## 2. Stack

- **React + Vite + TypeScript.**
- **Base:** Shawn's FitFindr agent repo (permission granted; access pending while the repo is 404). When you get access:
  1. Check its stack (React version, router, styling, state library) and what UI already exists.
  2. Reuse layout, components and styles that fit. Leave out anything tied to FitFindr's own backend, accounts or secrets.
  3. If it isn't React, port only the visual pieces.
  Until access arrives, scaffold a plain app (`npm create vite@latest -- --template react-ts`) so you aren't blocked.
- **Routing:** React Router (or whatever FitFindr uses).
- **Data fetching:** plain `fetch` wrapped in a small `api.ts`, or TanStack Query if FitFindr already has it. Polling is the main need.
- **Styling:** match the concept images: warm off-white background, black type, silver accent, rounded cards.
- **Config:** `VITE_API_BASE_URL` for the backend URL. No secrets in the frontend, ever.

## 3. Screens

### 3.1 Brief (`/`) — concept `01-brief.png`
- Photo upload: drag/drop or file picker, preview, JPG/PNG only, under 10 MB, clear error text.
- Consent checkbox, required: "I agree to send this photo to YouCam for try-on processing." Link to a short privacy note.
- Brief text area plus structured fields: **budget** (number), **occasion**, **sizes** (top/jacket XS–XXL required; bottom optional), **keep** (owned pieces as chips).
- "Get proposals" disabled until photo, consent, budget and top size are set.
- Calls `POST /api/photos` then `POST /api/briefs`. Show `422` field errors next to the right field.

### 3.2 Proposals (`/proposals/:briefId`) — concept `02-proposals.png`
- Two cards side by side on desktop, stacked on mobile.
- Each card: store name + **"Sample store"** badge, item photos with name, **size**, price; "Kept: your boots" chip; subtotal; styling note; **Preview on me**; **Pick this store**.
- While the backend is building: a skeleton card per store with "Building a proposal…".
- No-match: the store's card says it found nothing and offers "Edit brief".

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
- `src/mocks/` holds JSON that matches the contract types exactly (copy `Item` and `Proposal` from the main PRD into `src/types.ts`).
- `VITE_USE_MOCKS=true` swaps `api.ts` to return mocks with fake delays, including one failing preview so you can build error states.
- Switch to the real backend as soon as Shawn's endpoints are deployed.

## 7. Quality bar

- Works at 375 px phone width and desktop; no horizontal scroll.
- Keyboard reachable; images have alt text; buttons have clear labels.
- AI labels on every generated image and video. No claims about exact fit.
- Photo stays in memory/upload only; nothing stored in `localStorage`.

## 8. Your tasks

| # | Task | Day |
| --- | --- | --- |
| F1 | Request FitFindr agent repo access from Shawn; scaffold React + Vite + TS meanwhile | Fri |
| F2 | `types.ts` + mocks from the contract; `api.ts` with mock switch | Fri |
| F3 | Brief screen with validation and consent | Fri |
| F4 | Proposals screen with loading and no-match states | Sat |
| F5 | Preview & revise: lock, replace, size picker, subtotal, outdated previews | Sat |
| F6 | `usePollStatus` hook with timeouts | Sat |
| F7 | Pick a store + video panel | Sun |
| F8 | Saved screen | Sun |
| F9 | Switch to the real backend; fix contract mismatches with Shawn | Sun |
| F10 | Mobile + accessibility pass; deploy (Vercel or Netlify) with `VITE_API_BASE_URL` | Sun |
| F11 | Screenshots + 1–3 min demo video on YouTube, naming the YouCam APIs used | Mon AM |

## 9. Done means

- Full flow works on the deployed site against the real backend, on phone and desktop.
- One real try-on and one real video shown in the demo.
- No secrets in the repo or bundle (search the build output for the key to be sure).
