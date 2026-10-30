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

- `app/` — routes: `/` (home), `/shop`, `/stores`, `/stores/[storeId]`, `/products/[itemId]`, `/brief`, `/proposals/[briefId]` (all four stores' proposals), `/proposals/[briefId]/[proposalId]` (try-on, edit, pick, video), `/saved/[briefId]/[proposalId]`; favicon `icon.svg`
- `components/` — shop (`ProductCard`, `StoreCard`, `ShopBrowser`, `ProductActions`), brief (`BriefForm`), proposals (`ProposalCard`, `ItemRow`, `TryOnViewer`, `VideoPanel`), `Header`, `ProductImage`
- `data/catalog.json` — the shared catalog: four sample stores, 48 products; photos in `public/catalog/`
- `lib/` — `types.ts` (shared API contract), `api.ts` (backend calls + mock switch), `catalog.ts`, `parseBrief.ts` (fills budget and size from the brief sentence), `briefStore.ts` (session storage), `usePollStatus.ts`, `items.ts`, `format.ts`, `errors.ts`
- `mocks/` — mock responses matching the contract

Colors and type are theme tokens in `app/globals.css`; use the token classes (`bg-stone`, `text-ink`, `bg-sage`), never raw hex values.
