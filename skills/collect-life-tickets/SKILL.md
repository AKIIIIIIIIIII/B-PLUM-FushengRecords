---
name: collect-life-tickets
description: "将人生票根同名 PNG 与 JSON 收入已有《浮生录》，保留原始文件并按 ticketNumber 更新。用于用户说“收录票根”“收入浮生录”“追加票根”“把这些票放进册子”时；建立空册使用 bind-life-album。"
---

# 收录票根

将已经完成的人生票根无损收入现有藏本。每张票必须优先使用同名 PNG 与 JSON；只有 PNG 时拒绝正式目录收录并列出缺失 JSON，避免永久丢失票据数据。

## 执行

1. 确认已有藏本目录和票根文件或目录；优先复用当前对话刚生成的文件。
2. 运行，可重复提供输入：

       node scripts/collect-tickets.mjs <藏本目录> <票根文件或目录...>

3. 检查输出中的 `imported`、`updated` 与 `rejected`。有拒绝项时说明具体文件，不宣称全部成功。
4. 在藏本目录运行 `npm run build`，再运行同 Plugin 中 `bind-life-album/scripts/validate-album.mjs <藏本目录>`。
5. 如本地预览正在运行，提醒用户刷新；不要擅自发布。

## 数据规则

- 将原始文件保存为 `public/tickets/<ticketNumber>.png` 与 `.json`。
- 在 `album-manifest.json` 同时写入 `imageUrl` 与 `dataUrl`。
- 同一 `ticketNumber` 再次收录时覆盖该票的 PNG、JSON 与清单记录，不产生重复票。
- 过去票按发生时间排序，未来票按创建时间排序。
- 不改写原始 JSON 内容；清单只提取页面显示需要的字段。
