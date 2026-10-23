# 原创餐品插画

- 工具：内置 imagegen；没有使用外部 API Key。工具未返回可核验的具体模型版本，因此不声称已确认底层型号为 gpt-image-2。
- 项目文件：`site/public/art.png`，1536 × 1024，三列两行的六种餐品图集。
- 画面顺序：汉堡、薯条、可乐、鸡块、冰淇淋、早餐麦满分。背景通过 CSS 图集定位用于卡牌，导出 PNG 时用 Canvas 裁切对应区域。
- 所有图片为风格化原创示意，不是官方餐品摄影；图片不用于证明实际配料、份量或营养。

## 最终生成提示词

Use case: stylized-concept. Create a premium original collectible food trading-card art atlas for a Chinese fast-food collection web app. Landscape image, EXACT 3 columns by 2 rows of equal-sized square panels, no gutters. Each panel is a standalone luxurious 3D clay-meets-editorial food illustration centered on a solid soft pastel background. Top left: towering double beef cheeseburger sesame buns lettuce, warm pale apricot backdrop. Top middle: crispy golden french fries in plain red carton, pale buttery yellow backdrop. Top right: cola in plain red paper cup white lid straw with ice sparkles, pale blush backdrop. Bottom left: four crispy chicken nuggets levitating, pale sage green backdrop. Bottom middle: vanilla soft serve swirl in wafer cone, pale lilac backdrop. Bottom right: golden egg breakfast muffin with cheese, pale sky blue backdrop. Beautiful tangible textures, whimsical tiny star sparkles and floating ingredients, soft studio shadows, appetizing, sophisticated art direction, objects occupy central 70 percent of each panel, consistent scale. NO text, NO letters, NO numbers, NO logos, NO card frames, NO trademarks. This atlas is the final art asset for six card types; make every panel distinct and professionally art-directed.
