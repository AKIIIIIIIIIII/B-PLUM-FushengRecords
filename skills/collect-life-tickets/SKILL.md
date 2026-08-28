---
name: collect-life-tickets
description: "将人生票根同名 PNG 与 JSON 收入已有《浮生录》，保留原始文件并按 ticketNumber 更新。用于用户说“收录票根”“收入浮生录”“追加票根”“把这些票放进册子”时；建立空册使用 bind-life-album。"
---

# 收录票根

将已经完成的人生票根无损收入现有藏本。每张票必须优先使用同名 PNG 与 JSON；只有 PNG 时拒绝正式目录收录并列出缺失 JSON，避免永久丢失票据数据。

## 选择票根来源

- 用户要收录当前对话刚完成的票根时，直接复用本轮成功交付的 PNG 与 JSON，不再要求用户下载、重新上传或提供本地路径。
- 票根来自旧对话、其他 GPT 或其他聊天产品时，请用户附上同名 PNG 与 JSON，也可附上包含二者的 ZIP。不要声称能够自动搜索聊天缓存、Library、Images、下载目录或其他未明确提供的位置。
- 收到 ZIP 时，先解压到当前任务新建的临时目录，递归找出其中的 PNG 与 JSON，再将这些文件作为显式输入交给收录脚本；不要改写原 ZIP，也不要把压缩包内的其他文件收入藏本。
- 当前对话与外部附件中同时存在票根时，只收录用户本次明确指定的范围；范围不明确时优先使用当前对话刚生成的完整票根，不自动合并旧附件。

## 执行

1. 确认已有藏本目录，并按上面的来源规则取得票根文件；只有来源尚未提供时才向用户索取附件或路径。
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
- 导入时同时核对 JSON 的 `design.shapeStyle` 与 PNG 尺寸：过去只接受 `intermission-stub`、`film-edge`，未来接受全部三种；声明与图片不一致或 `past + chapter-pass` 时明确拒绝。
