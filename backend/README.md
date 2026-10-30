# Look Exchange backend

Python 3.12+, FastAPI. Run all commands below from `backend/`.

```sh
python -m venv .venv
.venv/bin/pip install -r requirements.txt pytest
.venv/bin/python -m pytest -q
.venv/bin/uvicorn app:app --host 0.0.0.0 --port 8000 --workers 1
```

On Windows use `.venv\Scripts\python.exe` and the corresponding `pip.exe` and `uvicorn.exe` paths. Set environment variables in the shell or hosting platform. `.env.example` documents names; `.env` is not loaded automatically.

`GET /api/health` returns `{"status":"ok"}`. Set `FRONTEND_ORIGINS` to comma-separated exact frontend origins (no trailing slash). Default allows only `http://localhost:3000`. Set `YOUCAM_API_KEY` securely on the deployment platform. Never commit it.

Routes follow `docs/look-exchange-prd.md` section 6. Previews and videos run in asynchronous background jobs with a 180-second deadline. Repeated active requests reuse existing job IDs. Videos require a selected proposal and successful preview of its current version. Videos are fixed at 5 seconds / 480p. Bag try-on is not implemented.

## Current limitations

This is not production-ready. Catalogs contain eight original sample illustrations per store. They are not photographs of real merchandise and their suitability for YouCam is unverified. Product links point to sample catalog JSON; there is no real checkout. Set PUBLIC_BASE_URL to the public backend origin so YouCam can retrieve the reference images. Real YouCam output parsing and generation have not been validated against a paid task.

Session data lives in memory, expires after one hour on API activity, and is lost on restart. Run one worker only. Attempt limits are four clothing tasks and one video per uploaded-photo session, plus 30 total tasks per UTC day. Limits reset on server restart and new photo uploads create new sessions; they do not provide durable abuse prevention. Failed attempts count toward limits to bound retries.

`render.yaml` is a proposed Render free-service configuration, not proof of deployment. Render free services can sleep and lose in-memory state. Configure real secrets directly in Render; cloud-development proxy credentials must not be copied into Render configuration.
