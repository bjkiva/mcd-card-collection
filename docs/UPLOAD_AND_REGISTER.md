# GitHub 上传与参赛操作

核对日期：2026-10-23（北京时间）。本指南没有执行 GitHub 发布或报名。

## 1. 当前结论

可以把当前版本作为开发版上传 GitHub，但尚不能称为已完成的正式参赛交付。必需文件齐全、官方声明与当前原文完全一致、19 项测试和构建通过；尚需确认真实订单成功解锁卡牌及营养属性。WorkBuddy 专项材料目前不满足要求。

| 项目 | 检查结果 |
| --- | --- |
| 原创界面、六种插画、演示翻卡、图鉴、卡组及海报预览 | 已实现，浏览器已验证核心交互 |
| README.md / CONTEST_DECLARATION.md / MCP_INTEGRATION.md / 脱敏配置 / 源码 | 已提供，声明原文比对一致 |
| 规则与 MCP 协议 mock 测试 | 19 项通过；不是实网端到端验证 |
| 真实 Token 连接、工具发现、读取订单 | 旧版实网已成功读到 10 笔订单 |
| 新版自动同步后成功发卡、营养口径和数值 | 尚未验收，不能宣称通过 |
| 公开在线 Demo | 尚未上线；Sites 当前没有已发布版本，之前上传失败 |
| workbuddy.md | 仍是待补充骨架，需实际使用 WorkBuddy 后导出真实对话 |
| GitHub 公开仓库与报名 Issue | 尚未创建 |

公开 Demo 是展示与传播建议，不是当前规则列出的报名必需文件。真实使用 MCP、公开仓库、指定文件和合规要求才是规则明确要求。审核是否通过以官方回复为准。

## 2. 建议先补齐

1. 在本地新版页面输入个人 Token，完整走通“自动同步 → 真实卡牌解锁 → 属性来源正确 → 卡组海报”。若已有完成订单却全部待识别，应先修复状态、餐品与营养适配，再宣称完成。
2. 在 WorkBuddy 中打开本项目，让它实际参与联调、修改和验收。可输入：“请检查麦麦卡牌图鉴的真实 MCP 自动同步，验证订单状态、套餐实际子项及每份营养口径，修复问题并运行测试，保留实际开发对话。”随后把实际导出上下文脱敏写入小写 workbuddy.md。不要把 Codex 工作归为 WorkBuddy 工作，也不要直接提交待填骨架申请专项奖励。
3. 需要在线展示时，将前端与 MCP 后端一起部署，取得可供访客访问的 HTTPS 地址，并更新 README 的 Demo 链接。localhost 只在本机有效，私人预览也不能当作公众 Demo。
4. 补齐上述内容后重新导出上传包，避免上传旧快照。

## 3. 准备上传目录

原目录中的 site/.git 属于 Sites 源码同步仓库。不要只上传 site 子目录，它缺少项目外层的必需参赛文件；也不要直接把嵌套仓库当子模块提交。

在项目根目录运行：

```powershell
Set-Location 'D:\workspace\mcd-card-collection'
python scripts/prepare-github.py
```

脚本输出一个新的 release/github-upload-时间戳 目录和 ZIP。上传目录保留外层参赛文件及完整 site 源码，排除 .git、dist、环境变量文件、日志和旧压缩包。它仅做有限格式的凭证扫描，仍需人工确认 workbuddy.md、截图和其他文档已经脱敏。

后续源码仍以原项目为准；快照生成后若继续修复或更新 WorkBuddy 记录，必须重新导出，或将相同修改同步到待上传目录。

## 4. 在 GitHub 新建公开仓库

1. 登录 https://github.com ，打开 https://github.com/new 。
2. Owner 选择个人账号，仓库名建议 mcd-card-collection，选择 Public。
3. Description 可填写：“将麦当劳餐品营养转化为原创卡牌属性，通过个人 MCP 历史订单解锁收藏。”
4. 不勾选预生成 README、.gitignore 或许可证：本地已有文件，空远程便于首次推送。开源许可证请根据自己的授权意愿另行选择，本项目目前未附 LICENSE。
5. 点击 Create repository，复制新仓库 HTTPS 地址。

依据：https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository

## 5. 用 Git 推送

先安装或升级至 Node.js 22+（https://nodejs.org/），重开终端确认。核对本机时，默认 Node 是 v16.18.1，不能用它作为本项目 MCP 后端的运行环境；此前测试使用了 Codex 自带的 Node 24。

在“新导出的上传目录”打开 PowerShell，逐条执行：

```powershell
node --version
npm test
npm run build
git init -b main
git add .
git status
git diff --cached --name-only
git commit -m "Initial release: McD Card Collection"
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/mcd-card-collection.git
git push -u origin main
```

将 YOUR_GITHUB_USERNAME 替换为个人 GitHub 用户名；若仓库名不同，也替换仓库名。暂存列表必须包含 site/src/sync.js、site/public/app.js 和外层参赛文件，不能只有一个 site 子模块条目。

首次提交如提示缺少身份，先在此仓库设置，然后重新执行 commit：

```powershell
git config user.name "你的 GitHub 用户名"
git config user.email "GitHub Settings → Emails 提供的 noreply 邮箱"
```

推送需要 GitHub 身份验证；有浏览器授权窗口时按提示登录。麦当劳 MCP Token 不能用于 GitHub 登录。不要把密码或任何 Token 写入 remote URL。

上传后用未登录窗口打开仓库，检查 README、图片、声明、集成说明、脱敏配置及源码可公开访问。

依据：https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github

## 6. 在线 Demo 的部署边界

GitHub 仓库公开不等于网站已经上线。当前后端需要 Node.js 22+ 或构建生成的 Worker ESM；GitHub Pages 只能托管静态内容，不能运行此 Node/MCP 后端。

在支持 Node.js 22+ 的主机中，以仓库根目录为工作目录、npm start 为启动命令，设置 HOST=0.0.0.0，并使用主机提供的 PORT 与 HTTPS。不需要配置开发者的个人麦当劳 Token，访客使用各自的 Token。服务器不记录 Authorization 和订单请求体。

Windows 本地服务默认仍只监听 127.0.0.1。Worker 部署使用 site/dist/server/index.js；Sites 发布必须沿用该项目的托管工作流，不要把源码仓库 URL 当网站地址。

发布后实测：首页可访问、演示可体验、个人 Token 能查询真实 MCP、静态资源完整、刷新正常、手机可用。把真实地址加到 README 第一屏和 GitHub About → Website 中。

## 7. 正式报名

在北京时间 **2026-10-25 23:59 前**，到官方仓库的 Issues 选择 New issue，优先使用当时官方提供的报名模板：

https://github.com/M-China/mcd-developer-innovation-challenge/issues

标题可用：

```text
【参赛申请】麦麦卡牌图鉴：把订单变成收藏卡
```

正文按官方 README 格式填写，发布前把仓库地址换成真实公开地址。以下简介按项目定位拟写，只有在相应功能确实验证后再使用；未完成的功能应如实删改。

```text
【参赛申请】
项目名称：麦麦卡牌图鉴
项目地址：https://github.com/YOUR_GITHUB_USERNAME/mcd-card-collection
项目简介：基于麦当劳 MCP 的原创餐品卡牌收藏 Skill，通过个人历史订单解锁餐品卡，将可核验的每份营养数据转化为娱乐属性，支持原创卡面、收藏图鉴、三卡组搭配与海报分享，并提供网页演示。
```

每个字段及其内容在同一行，尤其“项目简介：”后不要换行；项目地址用纯文本，不加 Markdown 链接语法。不要在报名正文中填写 Token、手机号、地址或其他个人信息。

发布后等待官方自动回复。收到成功通知才算报名成功；若失败，按具体原因修改并依当时说明重新提交。公开仓库应持续可访问。

官方说明：https://github.com/M-China/mcd-developer-innovation-challenge

官方规则：https://github.com/M-China/mcd-developer-innovation-challenge/blob/main/activityGuidelines.md

## 8. WorkBuddy 积分

真实使用 WorkBuddy 和提交真实小写 workbuddy.md 是专项要求，不能用一个自动生成的空记录文件替代。积分还取决于最终排名、资格核验和官方完整规则；并非所有报名项目都必然获得积分。
