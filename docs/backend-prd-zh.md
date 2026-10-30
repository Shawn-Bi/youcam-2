# Look Exchange — 后端需求文档

**负责人：** Shawn · **版本：** 1.0 · 2026 年 10 月 30 日
**上级文档：** [Look Exchange PRD](look-exchange-prd.md) · **流程：** [用户流程](look-exchange-user-flow.md)
**截止时间：** 2026 年 11 月 2 日美东时间上午 11:45

## 1. 你要做什么

后端负责所有 YouCam 调用、方案生成和尺码/预算校验（商品目录由 Dennis 提供，见第 6 节）。前端（Dennis）只通过[共享接口契约](look-exchange-prd.md#6-shared-api-contract)与后端通信，从不直接访问 YouCam，也看不到 API 密钥。

## 2. 第一步：YouCam 账号与额度

**先确认你是否已有 YouCam API 账号。**

**还没有账号：**
1. 在 [yce.makeupar.com/ai-api](https://yce.makeupar.com/ai-api) 免费注册 YouCam API 账号。
2. 继续下面“已有账号”的步骤。

**已有账号：**
1. 打开黑客松 [Resources 页面](https://youcam-api-skin-ai-ecommerce.devpost.com/resources)，复制兑换码。
2. 登录后进入 **Account → Redeem Code**，输入兑换码。**1,000 单位**会立即到账。
3. 在 [API 控制台](https://yce.makeupar.com/api-console/en/api-keys/) 的 **API Key** 标签页生成密钥。同一页面可查看余额和用量记录。
4. 把密钥放进后端的 `.env`（`YOUCAM_API_KEY=...`）。`.env` 必须在 `.gitignore` 中；仓库里只提交空值的 `.env.example`。
5. 在控制台确认 **Clothes V4** 的单位费用（官方文档目前只列出 V3 = 2 单位）。

## 3. 如何使用 YouCam API

以下内容已于 2026 年 10 月 30 日对照官方文档核实。

- **服务器：** `https://yce-api-01.makeupar.com`
- **认证：** 请求头 `Authorization: Bearer <YOUCAM_API_KEY>`
- **费用：** 只有成功的任务扣单位；`error` 和 `running` 不扣。

**通用流程（每个功能相同）：**
1. **上传图片** — 调用该功能的 File API，拿到 `file_id` 和上传地址 `requests.url`，再用返回的方法把图片字节 `PUT` 到该地址。也可以直接传公开图片 URL（`src_file_url`）。
2. **创建任务** — `POST` 到任务接口，传入 `file_id` 或 URL 以及参数，得到 `task_id`。
3. **轮询状态** — `GET {任务接口}/{task_id}`，直到 `task_status` 为 `success` 或 `error`。设上限（如每 2 秒一次，最多 90 秒）。
4. **获取结果** — 成功响应中包含结果图或视频的下载地址。由后端下载或转交，不要把 YouCam 的签名 URL 写进日志。

**本项目用到的功能：**

| 功能 | 任务接口 | 要点 | 单位 |
| --- | --- | --- | --- |
| 服装试穿 V4（P0） | `POST /s2s/v2.0/task/cloth-v4` | 用户照片 + 服装参考图；`garment_category` 用 `upper_body` 或 `outer` | 待确认 |
| 包袋试穿（P1） | `POST /s2s/v2.0/task/bag` | 用户照片 + 包袋参考图 | 2 |
| 图片生成视频 V2（P0） | `POST /s2s/v2.0/task/image-to-video/youcam` | `src_file_url` 或 `src_file_id`（试穿结果图）；`dst_duration`: 5；`resolution`: `"480"`；`model`: `"youcam-video-v2"`；可选 `prompt` | 480p 每秒 1 → 5 秒 = 5 |

**官方文档：**
- [快速入门](https://docs.perfectcorp.com/develop/quick_start_guide)
- [服装试穿 V4](https://docs.perfectcorp.com/reference/ai_clothes/v4.0)
- [包袋试穿](https://docs.perfectcorp.com/reference/ai_bag)
- [AI Video Generator](https://docs.perfectcorp.com/reference/ai_video_generator)（单位消耗见其 Unit Consumption 页）

**需要用一次真实调用确认的问题（Gate A）：**
- V4 的具体请求字段、图片要求和耗时。
- 试穿结果 URL 能否直接作为视频任务的 `src_file_url`。不行的话，先下载结果图，再通过 File API 重新上传。
- 视频提示词建议简短，例如：“The person turns slowly and smiles, showing the outfit.” 生成视频不保证服装细节完全不变。

Dennis 之前在另一个黑客松项目里写过经过测试的 YouCam 适配代码（File API、试穿任务、轮询、单位预算）。需要的话可以找他要链接参考。

## 4. 技术栈

由你选择（Node.js + TypeScript/Express 或 Python/FastAPI/Flask 都可以），但必须完全实现共享接口契约。要求：
- JSON API，开启 CORS，只允许前端域名。
- 不需要数据库：会话、方案和任务状态存在内存即可（演示规模足够）。
- 部署到 Render、Railway 或同类平台，环境变量中配置 `YOUCAM_API_KEY`。

## 5. 接口（与契约一致）

| 接口 | 后端要做的事 |
| --- | --- |
| `POST /api/photos` | 校验 `consent=true`、JPG/PNG、小于 10 MB；保存在内存或临时目录；返回 `photoId` |
| `POST /api/briefs` | 校验预算、上衣尺码等必填项（不合格返回 `422` 和字段错误）；为四家商店各生成一个方案 |
| `PATCH /api/proposals/:id/items/:itemId` | 改尺码或锁定状态；尺码无货时返回 `409 out_of_stock` 和同尺码替代品 |
| `POST /api/proposals/:id/replace` | 保留锁定商品，替换指定商品，重新计算小计，`version + 1` |
| `POST /api/proposals/:id/previews` | 上传照片和商品图，创建服装（或包袋）试穿任务，返回 `previewId` |
| `GET /api/previews/:previewId` | 返回 `queued` / `running` / `success` / `failed` 以及结果图 URL |
| `POST /api/proposals/:id/select` | 标记用户选中的商店 |
| `POST /api/proposals/:id/videos` | 仅限已选中的方案；用该方案的试穿结果图创建视频任务，返回 `videoId` |
| `GET /api/videos/:videoId` | 返回状态和视频 URL |

数据类型 `Item`、`Proposal` 见主 PRD 第 6 节。修改契约前先和 Dennis 商量，并更新主 PRD。

### 5.1 前端对接要点

前端已经完成，目前用模拟数据运行。接上真实后端时，下面这些细节必须一致，否则前端会报错或显示不出来。

1. **CORS：** 允许前端的 Vercel 域名（部署后 Dennis 发给你）和本地 `http://localhost:3000`。需要允许 `GET`、`POST`、`PATCH` 方法和 `Content-Type` 请求头。前端不发送 cookie。
2. **照片上传：** `POST /api/photos` 使用 `multipart/form-data`，字段名是 `photo`（文件）和 `consent`（字符串 `"true"`）。其他接口都是 JSON。
3. **图片和视频必须是公开 URL：** 商品 `imageUrl`、试穿结果 `imageUrl`、视频 `videoUrl` 都由浏览器直接加载，不能需要密钥或登录。YouCam 也要通过 URL 读取照片和商品图。如果返回 YouCam 的签名 URL，要确保它在会话期间（约 1 小时）不会过期，否则请转存后再返回。
4. **`422` 字段错误：** 返回 `{ "errors": { "字段": "提示文字" } }`。前端只认这几个字段名：`photo`、`consent`、`text`、`budget`、`topSize`，提示文字会直接显示给用户，请用英文写。
5. **`409` 尺码无货：** 必须是 `{ "code": "out_of_stock", "alternatives": Item[] }`。`code` 不对的话，前端只会显示通用错误。
6. **其他错误：** 任何其他非 2xx 响应，前端都显示通用提示“Something went wrong”。
7. **替换商品：** 替换后的商品必须有新的 `itemId`。前端靠新 `itemId` 判断哪件被替换了，并要求用户重新生成试穿预览。
8. **任务状态：** `GET /api/previews/:id` 和 `GET /api/videos/:id` 返回 `{ status, imageUrl?, videoUrl?, error? }`，`status` 只能是 `queued`、`running`、`success`、`failed`。`success` 时必须带 `imageUrl` 或 `videoUrl`。`failed` 时的 `error` 会显示给用户，请用英文写。前端每 2 秒查询一次，20 秒后改为每 5 秒；预览最多等 90 秒，视频最多等 4 分钟。
9. **视频请求：** 前端发送 `{ "previewId": "...", "duration": 5, "resolution": "480" }`。`previewId` 是该方案主单品（上衣或外套）的试穿结果，前端只在预览成功后才允许生成视频。
10. **任务 ID 要能重复查询：** 视频超时后，前端会用同一个 `videoId` 再次查询，不会新建任务（避免重复花费单位）。所以任务记录至少保留 1 小时。

## 6. 商品目录与方案生成

- **商品目录已经做好，你不用再做：** 直接读取 `frontend/data/catalog.json`。里面有四家商店（`stores`）和 48 件商品（`items`），每家 12 件。每家商店还有 `tone`（`dark`/`light`），只给前端用。前端的购物页面读同一个文件，所以价格、尺码和图片会一致。需要改目录时先和 Dennis 商量。
- 每件商品：`itemId`、`storeId`、`name`、`category`（`top`/`outer`/`bottom`/`bag`）、`price`、`sizesInStock`（包袋为空数组）、`colors`、`styleTags`、`imageUrl`、`productUrl`。
- 商品图是 AI 生成的纯色背景平铺图，放在 `frontend/public/catalog/`，适合 YouCam 试穿。
- **`imageUrl` 和 `productUrl` 是相对路径**（例如 `/catalog/nl_racer_jacket.jpg`、`/products/nl_racer_jacket`）。返回给前端时原样返回即可。发给 YouCam 时要拼上前端的公开域名，例如 `${FRONTEND_PUBLIC_URL}/catalog/nl_racer_jacket.jpg`（把 `FRONTEND_PUBLIC_URL` 放进环境变量，部署后 Dennis 发给你）。
- 方案里每个商品的 `itemId` 必须来自目录；前端的模拟数据也使用这些 `itemId`。
- **围绕指定商品搭配：** 用户在商品页点击“Style a look around this”后，需求文字会是 `Build a look around the {商品名} from {商店名}.`。如果需求文字里出现目录中的商品名，该商店的方案必须包含这件商品（尺码有货时），并替换同位置的单品：上衣和外套算同一个位置，下装和包袋各算一个位置。另一家商店照常搭配。前端模拟数据已按这个规则实现（`frontend/mocks/data.ts`）。
- 一套方案至少要有一件衣服；只有包袋时按“无匹配”返回，并说明原因。
- **方案生成用代码规则完成，不依赖模型：**
  1. 按品类筛选，再按用户尺码有货筛选。
  2. 按颜色和风格标签打分（例如“银色”“黑色”“演唱会”）。
  3. 选出总价不超过预算的最佳组合（一件上衣/外套 + 可选包袋）。
  4. 用户要保留的单品放进 `kept`，不作为商品出售。
- `rationale`（搭配说明）可以用模板生成，也可以选用 LLM，但只能描述已选中的商品，不能编造商品或价格。
- 找不到匹配时返回空方案和明确原因，不编造商品。

## 7. 安全与额度

- API 密钥只在后端环境变量里；不要出现在日志、响应、仓库或截图中。
- 不记录照片内容和 YouCam 签名 URL。
- 照片和结果只做短期保存（例如 1 小时后删除）。
- **单位上限：** 每个会话最多 N 次试穿、1 次视频；全局设每日上限。达到上限时返回清楚的错误。
- 普通测试使用模拟的 YouCam 响应，不消耗单位。花费单位的真实测试前先告诉 Dennis 次数和预计费用。

## 8. 任务清单

| # | 任务 | 时间 |
| --- | --- | --- |
| B1 | 确认/注册 YouCam 账号，兑换 1,000 单位，创建 API 密钥 | 周五 |
| B2 | 搭建后端项目、`.env.example`、CORS、健康检查 `GET /api/health` | 周五 |
| B3 | Gate A：一次真实的服装 V4 试穿调用，记录字段、耗时和单位 | 周五 |
| B4 | 和 Dennis 确认接口契约 | 周五 |
| B5 | 读取共享商品目录 + 方案生成 + 尺码/预算校验 | 周六 |
| B6 | 照片上传、预览任务、状态查询接口 | 周六 |
| B7 | 替换、改尺码、锁定、选择商店接口 | 周六 |
| B8 | 视频接口（image-to-video V2），确认结果图能否直接作为输入 | 周日 |
| B9 | 单位上限、错误处理、超时 | 周日 |
| B10 | 部署后端，与已部署的前端联调 | 周日 |
| B11 | 包袋试穿（P1，时间允许再做） | 周日 |
| B12 | 演示当天待命修复问题 | 周一上午 |

## 9. 完成标准

- 所有契约接口在部署环境可用，前端能完成完整流程。
- 至少一次真实服装试穿和一次真实视频生成成功。
- 尺码、库存、小计始终正确，且来自目录。
- YouCam 失败或超时时返回明确状态，前端可以重试。
- 密钥未出现在仓库、日志或响应中。
