# 麦当劳 MCP 集成说明

## 服务与实际代码

- 官方服务：https://mcp.mcd.cn ，Streamable HTTP，Bearer 个人 Token。
- 实现：`site/src/mcp.js`；本地入口 `site/server.mjs`；线上构建 `site/scripts/build.mjs` 生成 Worker ESM，使用同一后端。
- 顺序：initialize → notifications/initialized → tools/list（支持目录分页）→ tools/call → DELETE 结束有状态会话。支持 JSON 与 SSE 响应。
- 仅开放 order-list、query-order、list-nutrition-foods、now-time-info 四种查询工具；工具不存在或必填参数缺失时阻止调用，不允许消费或下单。

## 产品调用链

用户在网页输入 Token → 后端发现实际 schema → 自动并行查询营养与近期订单 → 自动从列表提取订单号并补齐必要详情 → `rules.js` 解析 → 已完成订单与精确餐品/规格匹配 → 生成收藏。普通用户无需填写 JSON 参数；只保留一键重新同步。自动编排见 `site/src/sync.js`。

业务价值：把难读的历史订单与营养信息转成可解释的个人收藏；卡牌背面展示营养口径，大号娱乐属性可追溯至规则，三卡组可导出分享。

## 当前适配边界（重要）

2026-10-23：用户已通过网页输入个人 Token，真实连接及工具发现成功，旧版已读到 10 笔订单，但尚未识别完成状态。实际观察到 order-list 和 list-nutrition-foods 均无入参，query-order 仅要求 orderId。新版已据此移除用户参数表单、自动补齐详情；完整发卡仍待新版真实账户复测，不宣称端到端已通过。未读取、记录或保存用户 Token。

- 订单支持常见 JSON 容器 orders/orderList/list/records/items，以及 data/result/response 包装；已完成状态仅接受明确的中英文文本，不猜测数字状态码。
- 餐品列表支持 products/items/orderItems/goodsList/productList；子项支持 children/subItems/components/subProducts。实际返回如不同，需根据脱敏响应新增映射并补充测试。
- 仅匹配首批六种卡及显式别名；其他餐品列为待识别。
- 只有明确 `basis` 或 `nutritionBasis` 为 `per-serving` 的数据才计算属性。未验证的中文字段、Markdown 表格、每100g数据及未知单位保留待补全，不能伪造。
- 当前不自动遍历历史订单分页。同步会对未知状态或缺少餐品的订单自动查询详情，最多 20 笔、每批并发 3 笔；失败保留其他可确认结果。新出现的必填参数若无法自动填充，会友好报错，不把技术参数交给普通用户。列表与详情适配仍需真实联调后完善。
- 每次查询重建当前结果并去重。未持久化全历史收藏；断开和切换用户清除卡册。订单详情补充应合并到当前结果，而不代替全部历史。
- Mock 协议测试与规则测试不代表真实麦当劳接口已验证。接入实际 Token 后应核验状态、退款、规格、数量、套餐实际子项及营养单位。

## 凭证与隐私

Token 仅在当前标签页内存和当前请求的后端 MCP 上下文中短暂使用，不记录日志、不落库、不进入 URL 或浏览器持久存储。每请求独立初始化，无共享全局 Token。接口 no-store；来源检查限制跨站调用；只返回给当前请求。

真实模式不持久保存订单。切换/断开连接递增连接代次，丢弃旧请求响应。公开导出不包含订单号、地址和手机号。部署端也应关闭含 Authorization 的访问日志和请求体采集。

## 验证命令

Node.js 22+：根目录执行 `npm test`、`npm run build`；`cd site` 后执行 `npm run validate`。协议测试使用 mock fetch，不包含真实 Token。
