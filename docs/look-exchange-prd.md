# Look Exchange — Product Requirements / 产品需求文档

[English](#english) · [简体中文](#简体中文)

| Document | Language | Owner |
| --- | --- | --- |
| **This PRD** — whole project, shared contract | English + 简体中文 | Dennis + Shawn |
| [Frontend PRD](frontend-prd.md) | English | Dennis |
| [Backend PRD / 后端需求文档](backend-prd-zh.md) | 简体中文 | Shawn |
| [User flow / 用户流程](look-exchange-user-flow.md) | English + 简体中文 | Both |
| [Concept images / 概念图](concepts/) | — | Both |

## English

**Version:** 1.0 · October 30, 2026
**Hackathon:** [YouCam API Skin AI & eCommerce VTO Hackathon](https://youcam-api-skin-ai-ecommerce.devpost.com/)
**Deadline:** **November 2, 2026, 11:45 AM EST.** Aim to submit by 9:00 AM that day.

### 1. Product

Shoppers describe the look they want; stores compete to win it with personalized, shoppable try-on proposals.

Example brief: *"Silver-and-black concert look, under $120, size M. Keep my boots."* Two sample stores each answer with a proposal (a jacket or top, plus an optional bag) in the shopper's size and budget. The shopper previews each proposal **on their own photo** through YouCam virtual try-on, swaps items or sizes, picks the store they like, and can turn the final look into a **short AI video**.

**Why it wins the hackathon:** it uses three YouCam APIs in one flow (clothes try-on, bag try-on, image-to-video) for a real eCommerce decision: *which store's look should I buy?*

The stores are clearly labeled **sample stores** with local catalogs. No payments, no live bidding.

### 2. User flow

Full detail with diagrams: [look-exchange-user-flow.md](look-exchange-user-flow.md).

1. **Brief** — upload a photo (with consent), write the brief, choose budget, occasion, **sizes**, and pieces to keep.
2. **Proposals** — two sample stores each return one proposal: items in the shopper's size, prices, subtotal, styling note.
3. **Preview** — "Preview on me" runs YouCam try-on for the proposal's top/jacket and bag. Results sit beside the product photos.
4. **Revise** — lock items, replace one, or change a size. Only the changed item's preview is regenerated.
5. **Pick a store** — the shopper selects the proposal they like best.
6. **Video (new)** — on the picked proposal, "Generate video" turns the try-on preview into a 5-second video with YouCam's AI Video Generator.
7. **Save** — save the proposal with sizes and open product links.

### 3. Scope

**P0 — required to submit**
- Brief screen with photo upload, consent, sizes, budget.
- Two sample-store catalogs; proposals filtered by size, budget and availability, checked in code.
- Real YouCam clothes try-on from the deployed app.
- Proposal comparison, lock/replace, size change.
- Video generation for the picked proposal.
- Loading, timeout, failure and retry states everywhere.
- Deployed frontend + backend, README, screenshots, 1–3 minute demo video on YouTube.

**P1 — only after P0 works**
- Bag try-on preview.
- Revision history.
- Download the video.

**Out of scope:** payments, real seller bidding, user accounts, scraping, a single combined "full outfit" render, size or fit guarantees.

### 4. YouCam APIs

All verified against the official docs on October 30, 2026. Server: `https://yce-api-01.makeupar.com`. Auth: `Authorization: Bearer <API key>`. Keys stay on the backend.

| Feature | Task endpoint | Status check | Cost (units) |
| --- | --- | --- | --- |
| Clothes try-on V4 | `POST /s2s/v2.0/task/cloth-v4` | `GET /s2s/v2.0/task/cloth-v4/{task_id}` | Not listed for V4 in docs (V3 = 2). Check in the API console before the first run. |
| Bag try-on (P1) | `POST /s2s/v2.0/task/bag` | `GET /s2s/v2.0/task/bag/{task_id}` | 2 |
| Image-to-video V2 | `POST /s2s/v2.0/task/image-to-video/youcam` | `GET /s2s/v2.0/task/image-to-video/youcam/{task_id}` | 1 per second at 480p, 2 at 720p, 3 at 1080p → **5 s at 480p = 5 units** |

Video request basics: `src_file_url` or `src_file_id` (the try-on result image), `dst_duration` 5 or 10, `resolution` `"480"`/`"720"`/`"1080"`, optional `prompt` (max 1,500 characters), `model: "youcam-video-v2"`. Input: JPG/PNG under 10 MB, aspect ratio between 1:2.5 and 2.5:1.

The hackathon gives **1,000 free units** per account via a redeem code on the [Resources page](https://youcam-api-skin-ai-ecommerce.devpost.com/resources). One full demo run (clothes + bag + 5 s video at 480p) costs roughly 9–10 units, so the budget is fine if the backend caps retries.

### 5. Architecture

```text
React frontend (Dennis)                 Backend (Shawn)                    YouCam
─────────────────────                   ───────────────                    ──────
Brief / Proposals / Preview  ── JSON ─▶ /api/... routes
Revise / Video / Save                   ├─ brief validation
polls status endpoints  ◀── status ──   ├─ sample catalogs (JSON) + size/budget checks
                                        ├─ proposal builder                ┌─ File API
                                        ├─ YouCam adapter  ─────────────▶  ├─ cloth-v4 / bag
                                        └─ unit budget cap                 └─ image-to-video
```

- The frontend never calls YouCam directly and never sees the API key.
- Long tasks (try-on, video) are **asynchronous**: the backend starts the task and returns an ID; the frontend polls the backend.
- Product choice, sizes, stock and subtotals are computed **in code**, never invented by a model.

### 6. Shared API contract

Both sides build against this contract from day one. The frontend uses mock JSON with the same shapes until the backend is live. Change it only by agreement, and update this section when you do.

| Method + path | Request | Response |
| --- | --- | --- |
| `POST /api/photos` | multipart `photo`, `consent=true` | `{ photoId }` |
| `POST /api/briefs` | `{ photoId, text, budget, occasion, sizes: { top, bottom? }, keep: [] }` | `{ briefId, proposals: Proposal[] }` or `422 { errors: { field: message } }` |
| `PATCH /api/proposals/:id/items/:itemId` | `{ size }` or `{ locked }` | `Proposal` or `409 { code: "out_of_stock", alternatives: Item[] }` |
| `POST /api/proposals/:id/replace` | `{ itemId, instruction? }` | `Proposal` |
| `POST /api/proposals/:id/previews` | `{ itemId }` | `{ previewId }` |
| `GET /api/previews/:previewId` | — | `{ status, imageUrl?, error? }` |
| `POST /api/proposals/:id/select` | — | `Proposal` (with `selected: true`) |
| `POST /api/proposals/:id/videos` | `{ previewId, duration: 5, resolution: "480" }` | `{ videoId }` |
| `GET /api/videos/:videoId` | — | `{ status, videoUrl?, error? }` |

`status` is one of `queued`, `running`, `success`, `failed`.

```ts
type Item = {
  itemId: string; name: string; category: "top" | "outer" | "bottom" | "bag";
  price: number; size: string | null; sizesInStock: string[];
  imageUrl: string; productUrl: string; locked: boolean;
};
type Proposal = {
  id: string; storeId: string; storeName: string; sampleStore: true;
  items: Item[]; kept: string[]; subtotal: number; rationale: string;
  version: number; selected: boolean;
};
```

### 7. Team split

| | **Dennis — Frontend** | **Shawn — Backend** |
| --- | --- | --- |
| Stack | React (Vite + TypeScript), based on the FitFindr agent repo | Shawn's choice (Node/TypeScript or Python), must match the contract |
| Owns | All screens, states, polling, mock data, mobile layout, frontend deploy, demo recording | YouCam account + credits, API key, catalogs, proposal logic, YouCam adapter, video, backend deploy |
| Detail | [Frontend PRD](frontend-prd.md) | [Backend PRD (中文)](backend-prd-zh.md) |

**First thing for Shawn:** check whether you already have a YouCam API account. If not, register at [yce.makeupar.com/ai-api](https://yce.makeupar.com/ai-api). Then redeem the hackathon code for 1,000 units and create an API key. Step-by-step instructions are in the backend PRD.

### 8. Timeline (October 30 – November 2)

| Day | Dennis (frontend) | Shawn (backend) | Together |
| --- | --- | --- | --- |
| **Fri Oct 30** | Get FitFindr agent repo access; scaffold React app; brief screen on mocks | YouCam account, credits, API key; one real clothes try-on call (Gate A) | Agree the contract above |
| **Sat Oct 31** | Proposals, preview, revise screens on mocks | Catalogs, proposal builder, sizes, preview endpoints | Confirm one real preview end to end |
| **Sun Nov 1** | Video screen, error states, mobile pass, deploy | Video endpoint, unit cap, deploy, CORS | Connect deployed frontend to deployed backend; full test |
| **Mon Nov 2** | Record demo video | Standby for fixes | Submit on Devpost by 9:00 AM EST (deadline 11:45 AM) |

### 9. FitFindr

- **Frontend base:** Dennis builds the React frontend on top of Shawn's **FitFindr agent** repo, with Shawn's permission. The repo is currently private or unavailable (404); Shawn will restore access. Until then, Dennis scaffolds a plain React app and moves components over once access is back.
- **Backend:** Shawn is not reusing FitFindr for the backend.
- Nothing from FitFindr that contains secrets, user data or API keys is copied.

### 10. Risks

| Risk | Plan |
| --- | --- |
| YouCam result quality or latency is poor | Test one real call on day 1; keep a recorded backup for the demo, labeled as recorded |
| Video costs or takes too long | 5 s at 480p by default; generate only on the picked proposal; show progress |
| FitFindr repo access is delayed | Start with a plain React scaffold; move pieces over later |
| Contract drift | Mock JSON matches section 6 exactly; change the contract only together |
| Running out of units | Backend caps tasks per session and retries; ordinary tests use mocks |

### 11. Done means

- A new visitor finishes brief → proposals → preview → pick a store → video, without signing in, on the deployed site.
- At least one real YouCam try-on and one real YouCam video come from the deployed app.
- Sizes, stock and subtotals are always correct and come from the catalog.
- Errors are understandable and recoverable.
- No API key in the frontend, the repo, logs or the demo video.
- Demo video (1–3 min, on YouTube) explains which YouCam APIs are used.

---

## 简体中文

**版本：** 1.0 · 2026 年 10 月 30 日
**黑客松：** [YouCam API Skin AI & eCommerce VTO Hackathon](https://youcam-api-skin-ai-ecommerce.devpost.com/)
**截止时间：** **2026 年 11 月 2 日美东时间上午 11:45。** 目标当天上午 9:00 前提交。

### 1. 产品

用户描述想要的造型，商店用个性化、可购买的试穿方案来争取这笔订单。

示例需求：*“银黑色演唱会造型，预算 120 美元以内，M 码，保留我的靴子。”* 两家示例商店各给出一个方案（一件上衣或外套，加一个可选包袋），符合用户的尺码和预算。用户通过 YouCam 虚拟试穿**在自己的照片上**预览每个方案，可替换商品或尺码，选出喜欢的商店，并可把最终造型生成一段**简短的 AI 视频**。

**为什么能在黑客松中脱颖而出：** 一个流程里使用三个 YouCam API（服装试穿、包袋试穿、图片生成视频），解决真实的电商决策问题：*该买哪家店的造型？*

商店均明确标注为**示例商店**，使用本地商品目录。不涉及支付，也没有真实竞价。

### 2. 用户流程

详细流程图见 [look-exchange-user-flow.md](look-exchange-user-flow.md)。

1. **需求** — 上传照片（需同意授权），填写需求，选择预算、场合、**尺码**和要保留的单品。
2. **方案** — 两家示例商店各返回一个方案：符合尺码的商品、价格、小计和搭配说明。
3. **预览** — “在我身上预览”调用 YouCam 试穿上衣/外套和包袋，结果与商品图并排展示。
4. **修改** — 锁定商品、替换一件或更换尺码，只重新生成受影响商品的预览。
5. **选择商店** — 用户选出最喜欢的方案。
6. **视频（新增）** — 在选中的方案上点击“生成视频”，用 YouCam AI Video Generator 把试穿预览变成 5 秒视频。
7. **保存** — 保存含尺码的方案并打开商品链接。

### 3. 范围

**P0 — 提交必需**
- 需求页：照片上传、授权、尺码、预算。
- 两个示例商店目录；方案按尺码、预算和库存筛选，由代码校验。
- 从已部署的应用发起真实的 YouCam 服装试穿。
- 方案比较、锁定/替换、更换尺码。
- 为选中的方案生成视频。
- 所有环节都有加载、超时、失败和重试状态。
- 部署前端和后端，提供 README、截图、1–3 分钟 YouTube 演示视频。

**P1 — P0 完成后再做**
- 包袋试穿预览。
- 修改历史。
- 下载视频。

**不做：** 支付、真实商家竞价、用户账号、抓取商品、单张“完整造型”合成图、尺码或合身保证。

### 4. YouCam API

均已于 2026 年 10 月 30 日对照官方文档核实。服务器：`https://yce-api-01.makeupar.com`。认证：`Authorization: Bearer <API key>`。密钥只保存在后端。

| 功能 | 任务接口 | 状态查询 | 费用（单位） |
| --- | --- | --- | --- |
| 服装试穿 V4 | `POST /s2s/v2.0/task/cloth-v4` | `GET /s2s/v2.0/task/cloth-v4/{task_id}` | 文档未列出 V4 费用（V3 为 2）。首次调用前在 API 控制台确认。 |
| 包袋试穿（P1） | `POST /s2s/v2.0/task/bag` | `GET /s2s/v2.0/task/bag/{task_id}` | 2 |
| 图片生成视频 V2 | `POST /s2s/v2.0/task/image-to-video/youcam` | `GET /s2s/v2.0/task/image-to-video/youcam/{task_id}` | 480p 每秒 1，720p 每秒 2，1080p 每秒 3 → **480p 5 秒 = 5 单位** |

视频请求要点：`src_file_url` 或 `src_file_id`（试穿结果图）、`dst_duration` 为 5 或 10、`resolution` 为 `"480"`/`"720"`/`"1080"`、可选 `prompt`（最多 1,500 字符）、`model: "youcam-video-v2"`。输入：JPG/PNG，小于 10 MB，宽高比在 1:2.5 到 2.5:1 之间。

黑客松在 [Resources 页面](https://youcam-api-skin-ai-ecommerce.devpost.com/resources) 提供兑换码，每个账号可领 **1,000 免费单位**。一次完整演示（服装 + 包袋 + 480p 5 秒视频）约 9–10 单位，只要后端限制重试次数，额度足够。

### 5. 系统架构

```text
React 前端（Dennis）                    后端（Shawn）                      YouCam
──────────────────                      ────────────                       ──────
需求 / 方案 / 预览          ── JSON ─▶  /api/... 路由
修改 / 视频 / 保存                      ├─ 需求校验
轮询状态接口      ◀── 状态 ──           ├─ 示例商品目录（JSON）+ 尺码/预算校验
                                        ├─ 方案生成                        ┌─ File API
                                        ├─ YouCam 适配层 ──────────────▶   ├─ cloth-v4 / bag
                                        └─ 单位用量上限                    └─ image-to-video
```

- 前端从不直接调用 YouCam，也看不到 API 密钥。
- 耗时任务（试穿、视频）为**异步**：后端创建任务并返回 ID，前端轮询后端。
- 选品、尺码、库存和小计都由**代码计算**，绝不由模型编造。

### 6. 共享接口契约

双方从第一天起按此契约开发。后端上线前，前端使用相同结构的模拟 JSON。修改契约须双方同意，并同步更新本节。

接口表和数据类型见英文部分第 6 节（代码与字段名两种语言通用）。`status` 取值为 `queued`、`running`、`success`、`failed`。

### 7. 分工

| | **Dennis — 前端** | **Shawn — 后端** |
| --- | --- | --- |
| 技术栈 | React（Vite + TypeScript），以 FitFindr agent 仓库为基础 | 由 Shawn 选择（Node/TypeScript 或 Python），须符合契约 |
| 负责 | 所有页面、状态、轮询、模拟数据、移动端布局、前端部署、录制演示 | YouCam 账号与额度、API 密钥、商品目录、方案逻辑、YouCam 适配层、视频、后端部署 |
| 详细文档 | [Frontend PRD](frontend-prd.md) | [后端需求文档](backend-prd-zh.md) |

**Shawn 的第一件事：** 确认是否已有 YouCam API 账号。没有的话，在 [yce.makeupar.com/ai-api](https://yce.makeupar.com/ai-api) 注册。然后兑换黑客松的 1,000 单位并创建 API 密钥。具体步骤见后端需求文档。

### 8. 时间安排（10 月 30 日 – 11 月 2 日）

| 日期 | Dennis（前端） | Shawn（后端） | 共同 |
| --- | --- | --- | --- |
| **周五 10/30** | 获取 FitFindr agent 仓库权限；搭建 React 项目；需求页（模拟数据） | YouCam 账号、额度、API 密钥；完成一次真实服装试穿调用（Gate A） | 确认上面的接口契约 |
| **周六 10/31** | 方案、预览、修改页面（模拟数据） | 商品目录、方案生成、尺码、预览接口 | 端到端跑通一次真实预览 |
| **周日 11/1** | 视频页面、错误状态、移动端检查、部署 | 视频接口、用量上限、部署、CORS | 已部署前后端联调，完整测试 |
| **周一 11/2** | 录制演示视频 | 随时修复问题 | 美东上午 9:00 前在 Devpost 提交（截止 11:45） |

### 9. FitFindr

- **前端基础：** 经 Shawn 许可，Dennis 以 Shawn 的 **FitFindr agent** 仓库为基础开发 React 前端。该仓库目前为私有或不可访问（404），Shawn 会恢复访问权限。在此之前，Dennis 先搭建普通 React 项目，权限恢复后再迁移组件。
- **后端：** Shawn 的后端不复用 FitFindr。
- 不复制 FitFindr 中任何密钥、用户数据或 API key。

### 10. 风险

| 风险 | 应对 |
| --- | --- |
| YouCam 结果质量或速度不理想 | 第一天先测一次真实调用；准备一段标注为“录制”的备用演示 |
| 视频费用高或耗时长 | 默认 480p、5 秒；只为选中的方案生成；显示进度 |
| FitFindr 仓库权限延迟 | 先用普通 React 项目，之后再迁移 |
| 契约不一致 | 模拟 JSON 与第 6 节完全一致；契约只能共同修改 |
| 单位用完 | 后端限制每个会话的任务数和重试次数；普通测试使用模拟数据 |

### 11. 完成标准

- 新访客无需登录，即可在已部署网站完成：需求 → 方案 → 预览 → 选择商店 → 视频。
- 至少一次真实的 YouCam 试穿和一次真实的 YouCam 视频来自已部署的应用。
- 尺码、库存和小计始终正确，且来自商品目录。
- 错误提示易懂，且可以恢复。
- API 密钥不出现在前端、仓库、日志或演示视频中。
- 演示视频（1–3 分钟，YouTube）说明使用了哪些 YouCam API。
