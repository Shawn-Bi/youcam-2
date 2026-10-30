# Look Exchange — Potential PRD

**Status:** Candidate idea; not implemented.

**Version:** 0.1 · October 29, 2026

**Language:** English · [简体中文](look-exchange-potential-prd.zh-CN.md)

## Product idea

Shoppers describe an outcome; participating stores compete through personalized, shoppable virtual try-on proposals. The first prototype generates proposals from two clearly labeled sample store catalogs. These are software-generated recommendations, not live seller bids.

Example brief: “Silver-and-black concert look, under $120. Keep my boots.” The value is comparing offers on yourself, then revising the products and previews together.

## Shopper experience

1. Upload a permitted photo, enter a budget/style brief, and identify owned pieces to keep.
2. Receive two store proposals showing catalog items, item prices, subtotal, source links, and styling rationale. Shipping/tax are excluded unless known.
3. Request clothing and bag previews. Keep original product photos beside the generated results; initially show each category in a separate panel.
4. Lock a favorite item and ask to replace another. Retrieve an alternative, recheck the subtotal, and regenerate only the affected preview.
5. Save the preferred proposal and open its product links. Sample inventory is labeled; the prototype does not process purchases.

## YouCam API tools

| Tool | Planned use | Interface |
| --- | --- | --- |
| AI Clothes Virtual Try-On V4 | Preview the proposal's top or jacket on the shopper | `POST /s2s/v2.0/task/cloth-v4`; `garment_category: upper_body` or `outer` |
| AI Bag Virtual Try-On | Preview a proposed bag using its reference image | `POST /s2s/v2.0/task/bag` |
| File API and task status | Upload input images, retain returned file IDs, and retrieve completed previews | `POST /s2s/v2.0/file`, upload bytes to its returned URL; poll the relevant task's `GET .../{task_id}` |

Use source/reference file IDs or URLs as supported by each endpoint. Choose the account's documented regional server during setup. API keys stay on the backend. The MVP can use bounded polling with timeout and visible failure states.

Clothing V4 documents outerwear and category selection; Bag accepts a shopper image plus a bag reference. Exact request fields, category-specific image requirements, access, latency, and cost need a small live proof. Separate previews avoid assuming reliable multi-API image composition. Keeping owned boots is a proposal constraint, not a guarantee that generated images preserve every pixel.

## FitFindr reuse

Source: [FitFindr](https://github.com/Shawn-Bi/ai201-project2-fitfindr-starter-v2026). Proposed reuse, subject to licensing/ownership review:

- `search_listings`: adapt keyword, tagged-size, and price filtering to store-specific catalogs. Add seller ID, product image, product URL, and availability.
- `suggest_outfit`: reuse wardrobe context to explain proposals; extend output to structured item IDs so the backend can validate selections.
- `run_agent` and session state: extend the existing first-result flow into two proposals with locked items and revision history.
- `create_fit_card`: adapt into a grounded proposal explanation; remove seller-like caption claims.

FitFindr does not currently implement VTO, seller competition, multi-item budget validation, or checkout. Do not assume its existing parser understands a complete shopping brief.

## How it comes together

**Proposed stack:** React web interface → Python/Flask backend adapted from FitFindr → local JSON catalogs and YouCam REST APIs. Retain FitFindr's model adapter for language generation; validate the brief and item selections separately.

The backend extracts a structured brief, retrieves candidates per store, assembles proposals, and checks item IDs, availability, and total price in code. On preview request, it uploads images, starts a YouCam task, and returns status/results. On revision, it preserves locked IDs and invalidates previews associated with changed items. No match or API failure produces an explicit state rather than an invented product or preview.

## First proof and boundaries

Demonstrate two catalogs, one apparel item plus an optional bag per proposal, real YouCam previews, and one item-replacement cycle. Success means valid catalog selections, correct subtotals, respected locked items, and previews tied to the current proposal. Try a new compatible brief without editing code before claiming general capability.

No live bidding, payments, scraping, or unified full-look rendering in this proof. Obtain image-use permission and define photo retention/deletion before public use. Generated previews illustrate appearance; they do not certify size, fit, condition, or exact product reproduction. No API calls or implementation tests have been performed for this PRD.

## Documentation basis

Official references checked October 29, 2026:

- [YouCam clothing V4](https://docs.perfectcorp.com/reference/ai_clothes/v4.0)
- [Clothing integration guide](https://docs.perfectcorp.com/reference/ai_clothes/section/overview/integration-guide)
- [Bag VTO guide](https://docs.perfectcorp.com/reference/ai_bag)
- [Hackathon](https://youcam-api-skin-ai-ecommerce.devpost.com/)
