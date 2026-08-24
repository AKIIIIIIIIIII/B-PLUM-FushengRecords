# 票根数据契约

只接收人生票根标准版输出的同名 PNG 与 JSON。优先使用无后缀 PNG，其次使用 -main.png，最后使用 -preview.png。

## 必填字段

- schemaVersion：必须为 1
- ticketNumber：唯一编号，也是 PNG 与 JSON 的文件名主体
- kind：past 或 universe
- title
- createdAt

## 票型相容规则

- `past` 只接受 `intermission-stub`、`film-edge`。
- `universe` 接受 `intermission-stub`、`film-edge`、`chapter-pass`。
- 优先读取 `design.shapeStyle`，并同时用 PNG 尺寸复核。声明票型未知、JSON 与 PNG 不一致或 `past + chapter-pass` 时拒绝导入。
- 网页端仅有旧式 PNG 时，可根据 `LT-P-`／`LT-U-` 票号和图片尺寸识别；过去竖票仍然拒绝。正式目录收录仍要求同名 PNG 与 JSON。

## 展示映射

- kind 为 past：往昔纪念票，进入过去篇
- kind 为 universe：宇宙订单票，进入未来篇
- 日期使用 time.display，其次 time.raw
- 地点使用 place
- 一句话记录仅在 note 存在时展示
- 图片只使用原始 PNG；不得重绘、裁切、加滤镜或叠加网页标签

## 排序

过去篇按事件发生时间升序。精确日期优先使用年月日；月份、年份和季节转换为稳定的近似排序键；“日期未详”排在可识别日期之后，再按 createdAt 稳定排序。未来篇按 createdAt 升序。

以 ticketNumber 去重；再次导入同一编号时更新该票根。
