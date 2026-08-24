# 票面与数据规范

在用户确认“出票”后读取本文件。统一票面字段、时间、票号、文件名与 JSON；不要自行改名或增加用户未提供的文案。

## 目录

- [票面字段](#票面字段)
- [时间格式](#时间格式)
- [票根编号与文件名](#票根编号与文件名)
- [JSON 结构](#json-结构)

## 票面字段

两种票都显示：

- 产品名：人生票根
- 票种
- 标题
- 地点或场域
- 票根编号
- 制票日或下单日
- 状态
- 主画面

往昔纪念票必须显示发生时间。宇宙订单票按时间选项显示；选择“不显示时间”时，移除整个时间项目，不保留标签、空框或占位符。

只在用户填写时显示“一句话记录”。未填写时完全移除，不由 AI 补写。情绪和视觉元素只影响画面，永远不作为票面文字。

## 时间格式

保留用户原始表达为 `raw`，另生成统一票面值 `display`。

### 往昔纪念票

| mode | display 格式 | 示例 |
|---|---|---|
| `exact` | `YYYY.MM.DD` | `2024.04.06` |
| `month` | `YYYY.MM` | `2024.04` |
| `year` | `YYYY` | `2024` |
| `season` | `YYYY·季节` | `2024·春` |
| `unknown` | `日期未详` | `日期未详` |

“日期未详”是有效的发生时间表达，不要继续追问具体日期。

### 宇宙订单票

| mode | display |
|---|---|
| `cosmic` | `宇宙时区` |
| `best` | `最佳时机` |
| `custom` | 用户确认后的自定义时间表达 |
| `hidden` | 不创建 `display`，票面移除时间项目 |

用户未选择时默认 `cosmic`。

## 票根编号与文件名

使用统一格式：

`LT-{TYPE}-{YYYYMMDD}-{RANDOM}`

- 往昔纪念票的 `TYPE` 为 `P`。
- 宇宙订单票的 `TYPE` 为 `U`。
- `YYYYMMDD` 使用出票当天的本地日期。
- `RANDOM` 使用 4 位大写英文字母或数字。
- 如果输出位置已有同名文件，重新生成随机段。

PNG 与 JSON 使用票根编号作为相同的文件名。例如：

- `LT-P-20260810-A7K2.png`
- `LT-P-20260810-A7K2.json`

## JSON 结构

使用 UTF-8 编码和 2 空格缩进。除 `note` 外保留所有字段；未填写 `note` 时完全省略该属性。不要保存用户照片文件、二进制内容或照片路径。

```json
{
  "schemaVersion": 1,
  "ticketNumber": "LT-P-20260810-A7K2",
  "kind": "past",
  "status": "ended",
  "title": "第一次独自看雪",
  "scene": "2023年我第一次一个人在东京看到雪",
  "time": {
    "mode": "year",
    "raw": "2023年",
    "display": "2023"
  },
  "place": "东京",
  "note": "那天的世界忽然安静了。",
  "emotion": ["安静", "惊喜"],
  "visualElements": ["雪", "街灯", "围巾"],
  "image": {
    "source": "generated",
    "concept": "一个人站在初雪中的东京街头，远处亮着街灯。",
    "prompt": "原创复古寓言卡绘式场景……",
    "referenceUsed": false
  },
  "design": {
    "shapeStyle": "intermission-stub",
    "layoutStyle": "stage-triptych",
    "imageStyle": "symbolic-card-illustration",
    "finishStyle": "modern-vintage-editorial",
    "typographyStyle": "qiji-source-han"
  },
  "createdAt": "2026-08-10T12:00:00+09:00"
}
```

字段枚举：

- `kind`：`past`、`universe`
- `status`：`ended`、`ordered`
- `image.source`：`uploaded`、`generated`、`procedural`
- `design.shapeStyle`：`intermission-stub`、`film-edge`、`chapter-pass`
- `design.layoutStyle`：`stage-triptych`、`chapter-poster`
- `design.imageStyle`：固定为 `symbolic-card-illustration`
- `design.finishStyle`：固定为 `modern-vintage-editorial`
- `design.typographyStyle`：固定为 `qiji-source-han`（中文齐伋体，英文与数字思源宋体）

票种与票形必须相容：

- `past`：只允许 `intermission-stub`、`film-edge`
- `universe`：允许 `intermission-stub`、`film-edge`、`chapter-pass`

`chapter-pass` 是未来专属票形，不得写入往昔纪念票。

当宇宙订单票选择不显示时间时，使用：

```json
"time": {
  "mode": "hidden"
}
```

`scene` 保存用户对这一幕的完整原始描述。`title` 保存用户确认后的 4–12 字票面标题。`createdAt` 使用带时区偏移的 ISO 8601 时间。
