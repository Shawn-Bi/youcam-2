# Look Exchange — frontend

Next.js (App Router) + TypeScript + Tailwind CSS. See [the frontend PRD](../docs/frontend-prd.md).

## Run it

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

## Mock mode

`NEXT_PUBLIC_USE_MOCKS=true` (the default in `.env.example`) makes `lib/api.ts` return the data in `mocks/` instead of calling the backend, so screens can be built before the API is ready. Set it to `false` and point `NEXT_PUBLIC_API_BASE_URL` at the backend to use real data.

## Layout

- `app/` — routes: `/` (brief), `/proposals/[briefId]` (placeholder until the proposals screen is built), favicon `icon.svg`
- `components/` — `Header`, `BriefForm`
- `lib/` — `types.ts` (shared API contract), `api.ts` (backend calls + mock switch), `briefStore.ts`
- `mocks/` — mock responses matching the contract

Colors and type are theme tokens in `app/globals.css`; use the token classes (`bg-stone`, `text-ink`, `bg-sage`), never raw hex values.
