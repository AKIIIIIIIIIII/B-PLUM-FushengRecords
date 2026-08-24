---
name: export-life-tickets
description: "把《浮生录》中的人生票根按 PNG 与 JSON 配对导出为 ZIP。用于用户说“导出票根”“打包册子里的票”“下载所有 PNG 和 JSON”“备份浮生录票根”时；既支持藏本目录，也指导使用网页按钮导出浏览器本地票。"
---

# 导出票根

导出是只读备份，不改变藏本、隐藏状态或浏览器数据。

## 从藏本目录导出

1. 确认藏本目录和可选 ZIP 输出路径。
2. 运行：

       python3 scripts/export_tickets.py <藏本目录> [--output <ZIP路径>]

3. 报告导出数量、重建 JSON 数量、缺失图片数量和 ZIP 路径。
4. 不把“重建”描述成原始 JSON；导出清单会逐票标明来源。

## 导出浏览器本地票

浏览器 IndexedDB 不属于藏本目录。用户要求“全部票根”或提到后来拖入的本地票时，使用生成网站内的“导出票根”按钮；该按钮会合并网站自带票和浏览器本地票，本地同票号覆盖自带版本，并下载 ZIP。

若当前环境可控制本地预览，可打开页面让用户点击或在用户已明确要求下载时触发按钮；否则说明需在册内点击一次。不要上传票根到外部服务。

## ZIP 约定

- `past/<ticketNumber>.png|json`
- `future/<ticketNumber>.png|json`
- `export-manifest.json`

旧票缺少原始 JSON 时，仅用现有标题、时间、地点、状态等字段重建最小 schemaVersion 1 JSON，并写入 `export.reconstructed: true`。
