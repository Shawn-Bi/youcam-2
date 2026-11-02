# Look Exchange — frontend

Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4. See [the frontend PRD](../docs/frontend-prd.md).

**Live:** https://look-exchange.vercel.app (talks to the backend on Render).

## Run it

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

## Mock mode

`NEXT_PUBLIC_USE_MOCKS=true` (the default in `.env.example`) makes `lib/api.ts` return the data in `mocks/` instead of calling the backend: no YouCam units are spent, the "try-on" shows your own photo, and the video is a slow zoom recorded in the browser. Set it to `false` and point `NEXT_PUBLIC_API_BASE_URL` at the backend to use real data.

## Deploy (Vercel)

The Vercel project `look-exchange` is deployed from this folder with the Vercel CLI, not from GitHub, so pushing does not redeploy it:

```bash
cd frontend
vercel deploy --prod
```

Production settings live in the Vercel project, not in a file: `NEXT_PUBLIC_API_BASE_URL=https://look-exchange-backend.onrender.com` and `NEXT_PUBLIC_USE_MOCKS=false`. `.vercelignore` keeps `.env.local` (mock mode) out of uploads. The backend must list the live address in its `FRONTEND_ORIGINS`, or the browser blocks every call.

## Layout

On page arrival, one bounded `/api/health` request starts waking the backend while the shopper browses. It does not block the interface, generate media, retry repeatedly, or keep the server awake indefinitely. Mock mode skips it. Browser-console timing events measure health/request latency and when generation is observed or video becomes playable; they contain no photos, user text, task IDs or signed URLs.

Preview/video status reads allow 195/915 seconds, including grace after the backend's 180/900-second windows. A slow, disconnected or unconfirmed task is checked again using the same ID. Only confirmed generation failure offers regeneration. Unknown/expired tasks do not silently start paid work. In-memory backend state still cannot survive a restart.

- `app/` — routes: `/` (home), `/shop`, `/stores`, `/stores/[storeId]`, `/products/[itemId]`, `/brief`, `/example` (a replay of the first live run: no photo, no API calls), `/proposals/[briefId]` (all four stores' proposals), `/proposals/[briefId]/[proposalId]` (try-on, edit, pick, video), `/saved/[briefId]/[proposalId]`; favicon `icon.svg`
- `components/` — shop (`ProductCard`, `StoreCard`, `ShopBrowser`, `ProductActions`), brief (`BriefForm`), proposals (`ProposalCard`, `ItemRow`, `TryOnViewer`, `VideoPanel`), `Header`, `ProductImage`
- `data/catalog.json` — the shared catalog: four sample stores, 48 products; photos in `public/catalog/`
- `public/demo/` — the shopper photo, try-on and video from the first live run, shown by `/example` (see `docs/demo/README.md`)
- `lib/` — `types.ts` (shared API contract), `api.ts` (backend calls + mock switch), `catalog.ts`, `example.ts` (the brief and the four answers that `/example` replays), `parseBrief.ts` (fills budget and size from the brief sentence), `briefStore.ts` (session storage), `usePollStatus.ts`, `items.ts`, `format.ts`, `errors.ts`

`/example` reuses `ProposalCard`, `TryOnViewer` and `VideoPanel`: they take a finished result (`finished`) or no actions, so they show a stored run and never ask the backend.
- `mocks/` — mock responses matching the contract

Colors and type are theme tokens in `app/globals.css`; use the token classes (`bg-stone`, `text-ink`, `bg-sage`), never raw hex values.
