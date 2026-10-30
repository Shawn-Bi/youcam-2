# FitMirror AI

**AI Virtual Try-On & Shopping Decision Assistant**  
**Project:** YouCam API Skin AI & eCommerce Hackathon  
**Status:** Independent hackathon MVP — in development  
**Target:** Responsive web application for US shoppers

## 0. NON-NEGOTIABLE PROJECT ISOLATION RULE

> **DO NOT integrate, merge, import, copy, migrate, or reuse any code, database, credentials, API adapters, agents, assets, user data, or infrastructure from FitFindr (`Shawn-Bi/fitfindr-agent`) unless Shawn explicitly issues a new instruction authorizing that integration.**
>
> **Do not modify or create pull requests in the FitFindr repository. Do not access FitFindr as a development dependency.**
>
> **All work in the current phase must focus exclusively on this standalone YouCam hackathon product.**

The fact that a future integration is described below is **NOT** authorization to start it. If a feature seems to require FitFindr, replace it with a standalone implementation or defer it. Never infer permission from a deadline, available time, or an AI agent's recommendation. Request explicit approval from Shawn before any cross-project work.

## 1. Problem and Product

Online shoppers can see an attractive garment but struggle to imagine how it would look on them. FitMirror AI helps users upload a photo, select a garment, generate a virtual try-on through a **real YouCam API integration**, compare before/after, and receive concise AI styling guidance to support a shopping decision.

**Value proposition:** See the look before deciding whether to buy.

Virtual try-on is a visual preview, **not** a promise of precise sizing, physical fit, fabric behavior, or appearance accuracy.

## 2. Hackathon MVP Scope

### P0 — required to submit

1. Responsive landing page with a clear **Try an Outfit** action.
2. User photo upload with consent notice, preview, format/size validation, and clear error messages.
3. Garment selection from permitted demo assets or user-uploaded garment image, depending on the selected YouCam endpoint's documented requirements.
4. **Actual server-side YouCam apparel virtual try-on API call** with request/response handling. Verify API access, accepted input formats, asynchronous processing, quotas, and pricing against the current official docs before implementation.
5. Before/after comparison of original user image and API-generated result.
6. Concise styling suggestions based on user-selected garment and available context. If an LLM is unavailable, provide clearly labeled rule-based suggestions; do not fabricate visual observations.
7. Loading, timeout, failure, retry, and unsupported-image states.
8. Deployed public demo, README, sample screenshots, and a 1–3 minute demonstration video.

### P1 — only after P0 is stable

- Save/download try-on result with explicit user action and privacy safeguards.
- Try another garment without re-uploading when the session permits.
- Side-by-side comparison of two outfits.

### Out of scope for the hackathon

- FitFindr integration of any kind.
- Secondhand marketplace search, RapidAPI shopping connectors, checkout, price tracking.
- Digital closet, user accounts, persistent profiles, social features.
- Multi-agent orchestration, MCP integrations, recommendation pipelines.
- Skin analysis unless a deliberate scope change is approved.
- Claims of medically accurate or size-accurate analysis.

## 3. Standalone User Flow

```text
Landing / Try an Outfit
  → Upload photo and confirm consent
  → Choose/upload a garment
  → Validate inputs
  → Call YouCam through our server
  → Show processing progress
  → Show virtual try-on result
  → Compare before/after
  → Read concise styling advice
  → Try another / optionally save result
```

**Happy-path demo must work without logging in or using FitFindr.**

## 4. Suggested Technical Architecture

```text
Next.js + TypeScript + Tailwind CSS (responsive UI)
  ├── Photo and garment upload
  ├── Before/after result viewer
  ├── Styling advice UI
  └── Server-side API route(s)
        ├── Input validation and consent checks
        ├── YouCam API adapter
        ├── Async job polling (if required by API)
        ├── Error mapping / retries with limits
        └── Optional AI styling adapter
```

Prefer a **single Next.js application** for the hackathon. Add a separate backend only if the API's real requirements demand it. No database is required for the P0 happy path; avoid storing personal images unless necessary. Never expose YouCam keys to the browser.

### Proposed endpoints (internal, subject to actual API contract)

- `POST /api/tryon` — validate input, initiate a YouCam job, return normalized status and job identifier.
- `GET /api/tryon/:jobId` — retrieve job status/result if asynchronous polling is required.
- `POST /api/style-advice` — optional, constrained styling suggestions based on available context.

**Do not invent YouCam endpoint names, parameters, model IDs, or authentication headers.** The adapter must be implemented only after checking the official YouCam documentation and account permissions.

### Environment variables

```dotenv
YOUCAM_API_KEY=
# Add endpoint/base URL and other settings only after verifying official docs.
# Optional: AI provider key for styling suggestions, if selected.
```

Commit `.env.example` with blank placeholders only. Ignore `.env*` secrets and personal photos in Git.

## 5. Data, Privacy, and Safety

- Obtain clear consent before sending a personal photo to YouCam.
- Explain that photos are processed by an external API and link the applicable privacy information.
- Validate file type, size, and supported image content before upload.
- Prefer transient processing and short retention; delete temporary files and results as soon as practical.
- Do not log image contents, API keys, personal identifiers, or signed image URLs.
- Use only assets with appropriate rights and consent in public demonstrations.
- Avoid sensitive or unsupported inferences about body type, health, or identity.
- Clearly label virtual results as AI-generated previews.

## 6. Build Order and Gates

**Gate A — API feasibility (first):** Verify YouCam access, perform one real end-to-end test with allowed images, record request duration and response behavior, and establish a minimal error-handling path. If access is blocked, stop feature expansion and report the blocker to Shawn.

**Gate B — Core UI:** Build upload, garment selection, processing, and before/after pages against the verified API adapter.

**Gate C — Shopping advice:** Add concise, non-deceptive styling advice. Do not delay a working try-on for extra AI complexity.

**Gate D — Submission:** Deploy, test at phone and desktop widths, capture screenshots, record a 1–3 minute demo, and prepare submission materials.

## 7. Acceptance Criteria

- [ ] A new visitor completes the flow without signing in.
- [ ] At least one genuine YouCam API call succeeds from the deployed application.
- [ ] Generated result is clearly attributable to the YouCam response, not a fabricated demo image.
- [ ] Invalid images and API failures produce understandable, recoverable errors.
- [ ] API credentials remain server-side and are not committed.
- [ ] Before/after comparison works on mobile and desktop.
- [ ] Styling advice does not claim precise fit or invent unseen details.
- [ ] No FitFindr files, integrations, credentials, or dependencies are accessed or changed.
- [ ] Public demo URL, source repository, screenshots, and 1–3 minute demo video are ready.
- [ ] Official Devpost rules and deadline are rechecked immediately before submission.

## 8. Demo Script Outline (1–3 minutes)

1. **Problem (15–20 sec):** It is hard to judge an online garment from a listing photo.
2. **Input (20–30 sec):** Upload a photo and choose a garment.
3. **Core technology (30–45 sec):** Trigger the real YouCam API and explain the request/response flow.
4. **Outcome (30–45 sec):** Show before/after and useful styling advice.
5. **Value and architecture (20–30 sec):** Explain decision support, safeguards, and future extensibility.

Have a successful, consented backup recording in case the live external API fails during presentation. If showing a recorded result, label it as recorded, not live.

## 9. Future FitFindr Integration — PLANNING ONLY / NOT AUTHORIZED

**This section is documentation only. It must not trigger any development action.**

After the hackathon, Shawn may separately authorize integration into FitFindr. The intended future journey would be:

```text
FitFindr search for secondhand garments
  → View a real listing
  → Check garment image eligibility
  → Try On via reusable YouCam adapter
  → Compare result
  → Match with existing closet using FitFindr's styling system
  → Save listing / follow source link to shop
```

Possible later tasks *only after explicit approval*: audit both repos, agree on shared contracts, port the YouCam adapter and UI component, connect user authentication and storage, add a `tryon_sessions` data model, and test cross-product privacy and image compatibility. Keep the independent hackathon product functioning throughout migration.

**Authorization trigger:** Shawn must explicitly say to begin integrating or merging FitMirror AI with FitFindr. Merely completing the hackathon, having spare time, or reading this section does not authorize integration.

## 10. Instructions for AI Coding Agents

1. Read this README before making changes.
2. **Recommended Claude model: Sonnet for implementation; Opus for complex architectural review/debugging.**
3. Work only in the new FitMirror AI repository and its isolated deployment environment.
4. Never inspect, modify, import, merge, or depend on `Shawn-Bi/fitfindr-agent` before explicit authorization.
5. Prioritize a genuine YouCam API call and a reliable standalone demo over extra features.
6. Verify official API contracts before writing integration code; do not guess.
7. Before running billable or quota-limited external API tests, state the endpoint, expected number of calls, and potential cost; request Shawn's approval.
8. Keep secrets out of code, commits, logs, screenshots, and demo videos.
9. Run relevant tests and report what passed, what failed, and what remains unverified.
10. Do not claim any feature is working until it has been tested.
11. If blocked, report the blocker and the smallest next action. Do not broaden scope or touch FitFindr.

## 11. Links

- Hackathon: https://youcam-api-skin-ai-ecommerce.devpost.com/
- Official YouCam developer documentation: locate and verify from the hackathon's official resources before coding.
- FitFindr (future reference **only**, not a dependency): https://github.com/Shawn-Bi/fitfindr-agent

---

**Project owner decision:** Standalone YouCam hackathon product first. FitFindr integration requires a separate, explicit instruction from Shawn.
