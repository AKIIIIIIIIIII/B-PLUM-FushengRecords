---
name: implant-sample-tickets
description: "为已有空白《浮生录》批量生成并植入完整的虚构样票，默认过去 5 张、未来 5 张且数量可调。用于用户说“样票植入”“放些示例票”“生成测试票根”“给空册加入样票”时；真实个人经历使用 make-life-ticket。"
---

# 样票植入

样票只用于演示和测试，不冒充用户经历。默认生成 5 张往昔纪念票与 5 张宇宙订单票；接受用户指定两个数量与可选随机种子，总数至少一张。每张样票的内容和视觉设置均为虚构随机结果。

## 准备清单

1. 确认目标藏本目录；目标不存在时先使用 `../bind-life-album` 建立空册。
2. 运行以下脚本取得完整随机出票单。脚本只输出草案，不生成图片或最终票根：

       node scripts/generate-sample-plan.mjs [--past-count 5] [--future-count 5] [--seed <值>]

   脚本为每张票确定票种、状态、标题、场景、时间、地点、一句话记录、情绪、视觉元素、画面构想、票形、印章款式和事件涂鸦。相同数量与 seed 必须得到完全相同的出票单。
3. 一次展示全部随机出票信息，并明确每张均为“虚构演示”。允许用户修改内容、数量或要求重新随机；修改后的内容成为本批次的确定输入。
4. 提示：如无修改，请回复“出票”。只有“出票”视为确认；“可以”“继续”“植入”或其他表达均不开始渲染。

## 批量出票与植入

用户明确回复“出票”后：

1. 读取 `../make-life-ticket/references/ticket-data.md`、`visual-language.md` 与 `rendering-workflow.md`，并严格遵循其中的正式出票、印章、涂鸦与渲染规则。
2. 为每张已确认样票生成唯一票号与 `createdAt`，构造完整 schemaVersion 1 JSON。除票号、创建时间和生成结果外，不得在此阶段再随机或改写确认过的内容；不要写入用户个人信息。
3. 逐张先生成与已确认画面构想相符的无文字主图；首轮因审核、乱码、带字、签名、水印或主体不完整而失败时，用非品牌化描述重试一次。重试仍失败时，将 `image.source` 设为 `procedural`，使用相关的本地程序化象征画面继续出票。
4. 逐张独立生成已确认关键词的透明事件涂鸦 PNG；首轮失败时以更中性的视觉描述重试一次。仍失败时把 `design.eventDoodle.status` 设为 `skipped`，不传 `--doodle`，继续出票；不得用程序化图标替代。
5. 使用 `../make-life-ticket/scripts/render_ticket.py` 渲染：主图成功时传 `--image <图片路径> --require-image`，涂鸦成功时传 `--doodle <透明 PNG 路径>`；程序化主图或跳过涂鸦时依照 `rendering-workflow.md` 省略对应参数。渲染器必须使用确认好的 `design.shapeStyle`、`stampStyle` 与涂鸦 metadata。
6. 将所有完成的 PNG 与 JSON 写入同一临时输出目录；只有两者完整且可打开的票才可收录。调用 `../collect-life-tickets/scripts/collect-tickets.mjs <藏本目录> <输出目录>` 收录，并使用 `../bind-life-album/scripts/validate-album.mjs` 检查藏本。

默认批量可能耗时较长；持续报告完成数量。最终汇总成功收录数、使用程序化主图数、跳过涂鸦数和未完成项。失败项不得阻断已经完成的票收录，也不得被静默跳过。
