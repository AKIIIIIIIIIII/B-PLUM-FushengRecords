---
name: implant-sample-tickets
description: "为已有空白《浮生录》批量生成并植入虚构样票，默认过去 5 张、未来 5 张且数量可调。用于用户说“样票植入”“放些示例票”“生成测试票根”“给空册加入样票”时；真实个人经历使用 make-life-ticket。"
---

# 样票植入

样票只用于演示和测试，不冒充用户经历。默认生成 5 张往昔纪念票与 5 张宇宙订单票；接受用户指定两个数量与可选随机种子，总数至少一张。

## 准备清单

1. 确认目标藏本目录；目标不存在时先使用 `../bind-life-album` 建立空册。
2. 运行以下脚本取得随机清单。脚本只输出草案，不创建最终票根：

       node scripts/generate-sample-plan.mjs [--past-count 5] [--future-count 5] [--seed <值>]

3. 一次展示全部样票的类型、标题、时间和地点，允许用户修改。
4. 明确提示：如无修改，请回复“植入”。“可以”“继续”或其他表达不视为确认。

## 植入

用户明确回复“植入”后：

1. 读取 `../make-life-ticket/references/ticket-data.md`、`visual-language.md` 与 `rendering-workflow.md`。
2. 为每张样票生成唯一票号和完整 schemaVersion 1 JSON。样票内容可由清单生成，必须标注为虚构演示；不要写入用户个人信息。
3. 按人生出票完整流程逐张生成无文字插画，再调用 `../make-life-ticket/scripts/render_ticket.py` 排版；不能用程序化简化画面替代，除非图像生成失败且原出票规则要求降级。
4. 把所有 PNG 与 JSON 写入同一临时输出目录。
5. 调用 `../collect-life-tickets/scripts/collect-tickets.mjs <藏本目录> <输出目录>` 收录。
6. 构建并使用 `../bind-life-album/scripts/validate-album.mjs` 检查藏本。

默认批量可能耗时较长；持续报告已完成数量，但不要跳过失败项。失败项保留在结果清单中，成功票仍可收录。
