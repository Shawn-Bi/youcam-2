# Look Exchange — 后端需求文档

**负责人：** Shawn · **版本：** 1.0 · 2026 年 10 月 30 日
**上级文档：** [Look Exchange PRD](look-exchange-prd.md) · **流程：** [用户流程](look-exchange-user-flow.md)
**截止时间：** 2026 年 11 月 2 日美东时间上午 11:45

## 1. 你要做什么

后端负责所有 YouCam 调用、商品目录、方案生成和尺码/预算校验。前端（Dennis）只通过[共享接口契约](look-exchange-prd.md#6-shared-api-contract)与后端通信，从不直接访问 YouCam，也看不到 API 密钥。

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
| `POST /api/briefs` | 校验预算、上衣尺码等必填项（不合格返回 `422` 和字段错误）；为两家商店各生成一个方案 |
| `PATCH /api/proposals/:id/items/:itemId` | 改尺码或锁定状态；尺码无货时返回 `409 out_of_stock` 和同尺码替代品 |
| `POST /api/proposals/:id/replace` | 保留锁定商品，替换指定商品，重新计算小计，`version + 1` |
| `POST /api/proposals/:id/previews` | 上传照片和商品图，创建服装（或包袋）试穿任务，返回 `previewId` |
| `GET /api/previews/:previewId` | 返回 `queued` / `running` / `success` / `failed` 以及结果图 URL |
| `POST /api/proposals/:id/select` | 标记用户选中的商店 |
| `POST /api/proposals/:id/videos` | 仅限已选中的方案；用该方案的试穿结果图创建视频任务，返回 `videoId` |
| `GET /api/videos/:videoId` | 返回状态和视频 URL |

数据类型 `Item`、`Proposal` 见主 PRD 第 6 节。修改契约前先和 Dennis 商量，并更新主 PRD。

## 6. 商品目录与方案生成

- 两个 JSON 目录，例如 `catalogs/northline.json`、`catalogs/mono-studio.json`，每家 8–12 件商品即可。
- 每件商品：`itemId`、`name`、`category`（`top`/`outer`/`bottom`/`bag`）、`price`、`sizesInStock`、`colors`、`styleTags`、`imageUrl`、`productUrl`。
- 商品图需是有使用权的图片（自己拍、AI 生成或可商用素材），并适合 YouCam 试穿（干净背景、平铺或模特图，按文档要求）。
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
| B5 | 两个商品目录 + 方案生成 + 尺码/预算校验 | 周六 |
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
