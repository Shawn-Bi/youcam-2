# Look Exchange backend

Python 3.12+, FastAPI. Run all commands below from `backend/`.

```sh
python -m venv .venv
.venv/bin/pip install -r requirements.txt pytest
.venv/bin/python -m pytest -q
.venv/bin/uvicorn app:app --host 0.0.0.0 --port 8000 --workers 1
```

On Windows use `.venv\Scripts\python.exe` and the corresponding `pip.exe` and `uvicorn.exe` paths. Run one worker only: all state is in memory.

## Configuration

Copy `.env.example` to `.env` (git-ignored) or set the variables on the hosting platform. A real environment variable always wins over `.env`. Tests ignore `.env` and any real key, so they cannot spend YouCam units.

| Variable | Purpose |
| --- | --- |
| `YOUCAM_API_KEY` | YouCam key. Without it previews and videos return 503. Never commit it. |
| `FRONTEND_ORIGINS` | Comma-separated exact frontend origins, no trailing slash. Default `http://localhost:3000`. |
| `FRONTEND_ORIGIN_REGEX` | Optional pattern for preview deployments, for example `https://look-exchange(-.*)?\.vercel\.app`. |
| `FRONTEND_PUBLIC_URL` | The live frontend, used only to download a product photo when the repo's copy is not on disk. Default `https://look-exchange.vercel.app`. |
| `CATALOG_FILE` | Optional path to a catalog file. Default is the shared `frontend/data/catalog.json`. |
| `BAG_GENDER` | `female` or `male`, used for bag try-on when the request does not say. Default `female`. |
| `SESSION_PREVIEW_LIMIT`, `SESSION_VIDEO_LIMIT`, `DAILY_TASK_LIMIT`, `DAILY_VIDEO_LIMIT` | Unit guards, see below. Defaults 6, 2, 40, 10. |
| `SESSION_PREVIEW_ATTEMPTS`, `SESSION_VIDEO_ATTEMPTS`, `DAILY_ATTEMPT_LIMIT` | Hard caps on tries including failed ones. Defaults 12, 4, 150. |

`GET /api/health` returns `{"status":"ok","youcamConfigured":true|false,"catalogItems":48}`.

## API

Routes follow the shared contract in `docs/look-exchange-prd.md` section 6 and the integration notes in `docs/backend-prd-zh.md` section 5.1.

- Uploaded photos are decoded, rotated upright, stripped of metadata (including location), flattened to RGB and capped at 2048 px, then kept as JPEG for one hour. Photos under 512 px, wider than 2.5:1, or over 10 MB are refused with `422 {"errors":{"photo":…}}`.
- **Catalog:** the four stores and their 48 products come from the shared `frontend/data/catalog.json`, which Dennis owns. `imageUrl` and `productUrl` are returned as written (relative paths), so the frontend resolves them. Product photos come from `frontend/public/catalog/`.
- **Proposals** are built by rules in `catalog.py`, never by a model. Each of the four stores answers every brief with an upper piece (top or jacket) and an optional bag, in the shopper's size and budget, scored by style tags and colors found in the brief. Bottoms use `sizes.bottom` when given, otherwise the top size, and appear only when a brief is built around them.
- **Built around a piece:** if the brief carries an optional `itemId`, or its text names a catalog product ("Build a look around the Grey knit sweater from Mono Studio."), the store that sells it must include it when it comes in the shopper's size. It takes over its slot (a top and a jacket share one; bottoms and bags each have their own) and the other stores answer as usual. A bag alone is never a look.
- **Revise:** lock, change size (409 `out_of_stock` with alternatives), replace (new `itemId`, optional instruction such as "cheaper" or a color), select a store.
- Previews upload the shopper's photo and the product photo to YouCam and run clothes try-on V4 (`upper_body` for tops, `outer` for jackets, `lower_body` for bottoms), or bag try-on for bags. Bag try-on needs a gender: `BAG_GENDER` applies unless the request adds an optional `"gender": "female" | "male"`. YouCam restages the shopper in a new scene for bags, so a bag preview cannot be used to make a video.
- Videos are 5 seconds at 480p. They require a selected proposal and a successful clothing preview of an item that is still in it. The try-on result is downloaded and re-uploaded to YouCam, with the result URL as a fallback.
- A size change does not invalidate a preview: try-on shows appearance only. Replacing an item gives it a new `itemId`, which needs its own preview.
- Task records live for an hour after last use, so a client can poll the same `previewId` or `videoId` again without paying for a new task.
- Errors other than field validation are `{"error": "plain English"}`; the frontend shows them to shoppers as written.

## Measured with the real API (2026-10-30)

One clothes try-on (`outer`, full-body photo) took about 13 seconds and cost 2 units. One 5-second 480p video made from that result took 47 to 59 seconds and cost 5 units. One bag try-on took 19 to 40 seconds and cost 2 units; both `female` and `male` are accepted. One video on the live site took more than five minutes; YouCam still finished it and charged 5 units after the backend had given up, so the deadlines are 180 seconds for a preview and 900 seconds for a video. Request URLs are never logged, because YouCam's are signed.

## Unit guards

YouCam charges only for successful tasks. A session is one uploaded photo. Per session the defaults allow 6 running or successful previews and 2 videos; a failed task gives its slot back (except one that timed out, because YouCam may still finish and charge for it), while the attempt caps still bound retries. Per UTC day the defaults allow 40 tasks and 10 videos. Limits reset when the server restarts and a new upload starts a new session, so they are a guard rail, not abuse prevention.

## Limitations

Session data lives in memory and is lost on restart. `render.yaml` is a proposed Render free-service configuration; free services sleep after idle time and lose state when they do. The Render service builds from the whole repository, so `frontend/data/catalog.json` is available at runtime.
