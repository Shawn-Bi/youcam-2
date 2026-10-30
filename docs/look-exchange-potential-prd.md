# Look Exchange — Potential PRD / 候选产品需求简述

[English](#english) · [简体中文](#简体中文)

## English

**Status:** Candidate idea; not implemented.

**Version:** 0.1 · October 29, 2026

### Product idea

Shoppers describe an outcome; participating stores compete through personalized, shoppable virtual try-on proposals. The first prototype generates proposals from two clearly labeled sample store catalogs. These are software-generated recommendations, not live seller bids.

Example brief: “Silver-and-black concert look, under $120. Keep my boots.” The value is comparing offers on yourself, then revising the products and previews together.

### Shopper experience

1. Upload a permitted photo, enter a budget/style brief, and identify owned pieces to keep.
2. Receive two store proposals showing catalog items, item prices, subtotal, source links, and styling rationale. Shipping/tax are excluded unless known.
3. Request clothing and bag previews. Keep original product photos beside the generated results; initially show each category in a separate panel.
4. Lock a favorite item and ask to replace another. Retrieve an alternative, recheck the subtotal, and regenerate only the affected preview.
5. Save the preferred proposal and open its product links. Sample inventory is labeled; the prototype does not process purchases.

### YouCam API tools

| Tool | Planned use | Interface |
| --- | --- | --- |
| AI Clothes Virtual Try-On V4 | Preview the proposal's top or jacket on the shopper | `POST /s2s/v2.0/task/cloth-v4`; `garment_category: upper_body` or `outer` |
| AI Bag Virtual Try-On | Preview a proposed bag using its reference image | `POST /s2s/v2.0/task/bag` |
| File API and task status | Upload input images, retain returned file IDs, and retrieve completed previews | `POST /s2s/v2.0/file`, upload bytes to its returned URL; poll the relevant task's `GET .../{task_id}` |

Use source/reference file IDs or URLs as supported by each endpoint. Choose the account's documented regional server during setup. API keys stay on the backend. The MVP can use bounded polling with timeout and visible failure states.

Clothing V4 documents outerwear and category selection; Bag accepts a shopper image plus a bag reference. Exact request fields, category-specific image requirements, access, latency, and cost need a small live proof. Separate previews avoid assuming reliable multi-API image composition. Keeping owned boots is a proposal constraint, not a guarantee that generated images preserve every pixel.

### FitFindr reuse

Source: [FitFindr](https://github.com/Shawn-Bi/ai201-project2-fitfindr-starter-v2026). Proposed reuse, subject to licensing/ownership review:

- `search_listings`: adapt keyword, tagged-size, and price filtering to store-specific catalogs. Add seller ID, product image, product URL, and availability.
- `suggest_outfit`: reuse wardrobe context to explain proposals; extend output to structured item IDs so the backend can validate selections.
- `run_agent` and session state: extend the existing first-result flow into two proposals with locked items and revision history.
- `create_fit_card`: adapt into a grounded proposal explanation; remove seller-like caption claims.

FitFindr does not currently implement VTO, seller competition, multi-item budget validation, or checkout. Do not assume its existing parser understands a complete shopping brief.

### How it comes together

**Proposed stack:** React web interface → Python/Flask backend adapted from FitFindr → local JSON catalogs and YouCam REST APIs. Retain FitFindr's model adapter for language generation; validate the brief and item selections separately.

The backend extracts a structured brief, retrieves candidates per store, assembles proposals, and checks item IDs, availability, and total price in code. On preview request, it uploads images, starts a YouCam task, and returns status/results. On revision, it preserves locked IDs and invalidates previews associated with changed items. No match or API failure produces an explicit state rather than an invented product or preview.

### First proof and boundaries

Demonstrate two catalogs, one apparel item plus an optional bag per proposal, real YouCam previews, and one item-replacement cycle. Success means valid catalog selections, correct subtotals, respected locked items, and previews tied to the current proposal. Try a new compatible brief without editing code before claiming general capability.

No live bidding, payments, scraping, or unified full-look rendering in this proof. Obtain image-use permission and define photo retention/deletion before public use. Generated previews illustrate appearance; they do not certify size, fit, condition, or exact product reproduction. No API calls or implementation tests have been performed for this PRD.

### Documentation basis

Official references checked October 29, 2026:

- [YouCam clothing V4](https://docs.perfectcorp.com/reference/ai_clothes/v4.0)
- [Clothing integration guide](https://docs.perfectcorp.com/reference/ai_clothes/section/overview/integration-guide)
- [Bag VTO guide](https://docs.perfectcorp.com/reference/ai_bag)
- [Hackathon](https://youcam-api-skin-ai-ecommerce.devpost.com/)

---

## 简体中文

**状态：** 候选方案，尚未实现。

**版本：** 0.1 · 2026 年 10 月 29 日

### 产品概念

用户描述想达到的穿搭效果，参与商店通过个性化、可购买的虚拟试穿方案展开竞争。首个原型从两个明确标注的示例商店目录生成方案。这些是软件推荐，不是真实商家的实时报价。

例如：“银黑色演唱会造型，预算 120 美元以内，保留我自己的靴子。”核心价值是让用户在自己身上比较方案，并让商品选择与试穿预览同步更新。

### 用户流程

1. 上传有权使用的照片，填写预算和风格需求，指定要保留的自有单品。
2. 收到两个商店方案，包含目录商品、单价、小计、来源链接及搭配理由。未知的运费和税费不计入小计。
3. 请求服装和包袋预览。原始商品图与生成结果同时展示；初期按品类分开展示。
4. 锁定喜欢的商品，要求替换另一件。系统检索替代品，重新检查小计，仅更新受影响的预览。
5. 保存方案并打开商品链接。示例库存需明确标注；原型不处理购买交易。

### 使用的 YouCam API 工具

| 工具 | 计划用途 | 接口 |
| --- | --- | --- |
| AI Clothes Virtual Try-On V4 | 在用户照片上预览方案中的上衣或外套 | `POST /s2s/v2.0/task/cloth-v4`；`garment_category` 使用 `upper_body` 或 `outer` |
| AI Bag Virtual Try-On | 使用包袋参考图生成个性化预览 | `POST /s2s/v2.0/task/bag` |
| File API 与任务状态查询 | 上传图片、保存返回的文件 ID、获取完成后的预览 | `POST /s2s/v2.0/file`，再向返回的 URL 上传文件；通过对应任务的 `GET .../{task_id}` 轮询 |

根据各接口支持情况使用源图和参考图的文件 ID 或 URL。配置时选择账号对应区域的官方服务器。API 密钥只保存在后端。MVP 可采用有次数和时间上限的轮询，并显示超时或失败状态。

服装 V4 文档提供外套和品类选项；Bag 接口接受用户图和包袋参考图。具体字段、各品类图片要求、账号权限、延迟和费用仍需小规模真实调用验证。分开展示预览，避免假定多个 API 能可靠合成一张完整造型图。“保留靴子”是选品约束，不代表生成图能保证所有像素不变。

### 复用 FitFindr 的部分

来源：[FitFindr](https://github.com/Shawn-Bi/ai201-project2-fitfindr-starter-v2026)。以下为计划，复用前需确认许可与代码权属：

- `search_listings`：将关键词、标签尺码和价格筛选适配到各商店目录，增加商家 ID、商品图、商品链接和可售状态。
- `suggest_outfit`：复用衣橱上下文来解释方案；扩展为带商品 ID 的结构化结果，供后端校验。
- `run_agent` 和会话状态：将当前选择首个搜索结果的流程扩展为两个方案，记录锁定商品与修改历史。
- `create_fit_card`：改为有商品依据的方案说明，移除类似卖家宣传文案的表述。

FitFindr 当前没有实现虚拟试穿、商家竞争、多商品总价校验或结账。现有解析器也不能直接视为能理解完整购物需求。

### 系统如何串联

**建议技术栈：** React 网页界面 → 基于 FitFindr 改造的 Python/Flask 后端 → 本地 JSON 商品目录与 YouCam REST API。保留 FitFindr 的模型调用适配层处理语言生成；购物需求与商品选择另行校验。

后端将需求转为结构化数据，按商店检索候选商品，组装方案，并用代码校验商品 ID、可售状态和总价。用户请求预览时，后端上传图片、创建 YouCam 任务，再返回状态与结果。修改方案时保留已锁定商品的 ID，并使已变更商品对应的旧预览失效。无匹配商品或 API 失败时明确提示，不编造商品或预览。

### 首次验证与范围

演示两个商品目录、每个方案一件服装及可选包袋、真实 YouCam 预览，以及一次商品替换。成功标准：选品来自有效目录、小计正确、锁定商品不变、预览对应当前方案。宣称具有通用能力前，应在不修改代码的情况下测试一个新的兼容需求。

本次验证不包含实时竞价、支付、抓取商品或完整造型合成。公开使用前需取得图片使用许可，并明确照片保留和删除规则。生成图仅展示外观，不保证尺码、实际合身程度、商品成色或精确还原。本 PRD 尚未执行 API 调用或实现测试。

### 文档依据

以下官方资料于 2026 年 10 月 29 日核对：

- [YouCam 服装 V4](https://docs.perfectcorp.com/reference/ai_clothes/v4.0)
- [服装集成指南](https://docs.perfectcorp.com/reference/ai_clothes/section/overview/integration-guide)
- [包袋 VTO 指南](https://docs.perfectcorp.com/reference/ai_bag)
- [黑客松页面](https://youcam-api-skin-ai-ecommerce.devpost.com/)
