# B-PLUM-FushengRecords · 浮生录

> 把发生过的事和想抵达的未来，制成一张值得收藏的人生票根。

《浮生录》把你讲述的一幕人生做成复古票根，再收进一本可以翻阅的互动古籍。它是一个面向 ChatGPT 与 Codex 的本地优先插件：你可以只做一张票，也可以从故事开始，一路做到成册和导出。

![浮生录演示](docs/images/album-preview.png)

## 它会做这些事

- 把已经发生的人生片段做成“往昔纪念票”。
- 把希望体验或抵达的一幕写进“宇宙订单票”。它记录愿望，但不承诺结果。
- 在两种横向长票之外，为未来篇制作专属的竖向章节方票。
- 建立一本默认在本地运行的互动古籍藏册。
- 将同名的 PNG 与 JSON 票根成对收录，原始文件不会被重绘或裁切。
- 植入明确标注为虚构内容的演示票，用来测试或展示。
- 把藏册里的票根打包成 ZIP，方便备份和迁移。

## 效果示例

以下示例均为虚构内容，不对应任何真实个人经历。

| 往昔纪念票 | 宇宙订单票 |
| --- | --- |
| ![第一次独自看雪](examples/tickets/LT-P-20260824-SNOW.png) | ![写完一本书](examples/tickets/LT-U-20260824-BOOK.png) |

一张正式票根包含两个同名文件：PNG 是票面，JSON 保存可再次读取的数据。字段说明见 [`skills/make-life-ticket/references/ticket-data.md`](skills/make-life-ticket/references/ticket-data.md)。

## 安装

1. 克隆仓库：

   ```bash
   git clone https://github.com/AKIIIIIIIIIII/B-PLUM-FushengRecords.git
   ```

2. 在 ChatGPT 或 Codex 的 Plugins 页面添加本地插件来源，选择包含 `.codex-plugin/plugin.json` 的仓库根目录。
3. 启用“浮生录”，新建一个任务，然后直接说你想做什么。

这个仓库用于查看源码和本地安装。若要进入官方公共插件目录，仍需单独提交审核。

## 使用示例

```text
帮我制作一张人生票根。
为我建立一本空白人生藏册。
用样票生成一本可浏览的《浮生录》。
把这些票根收录进我的浮生录。
导出藏册里的全部票根。
```

制作个人票根时，插件会先整理一份出票单。只有你明确回复“出票”，它才会生成文件。样票则始终标注为虚构演示，不会冒充你的经历。

## 隐私与数据

- 藏册默认在本地创建和保存，插件不会自行发布到互联网。
- 插件不内置开发者 API Key，也不会让你把个人密钥写进仓库。
- 你的照片不会被复制进插件；票根 JSON 也不保存照片路径或二进制内容。
- 请勿把包含真实个人经历的生成目录直接提交到公开仓库。

## 支持与商业定制

如果《浮生录》替你留住了一幕人生，可以[请造册人喝杯茶](https://buymeacoffee.com/plum.b)。这只是自愿支持，不等同于购买商业授权。

商业使用、付费再分发、品牌活动或客户项目需要另行获得书面授权，请通过 [https://b-plum.com/](https://b-plum.com/) 联系作者。

## 许可证

- 软件代码：[`PolyForm Noncommercial 1.0.0`](LICENSE)，个人及非商用免费；商业使用需另行书面授权。
- 内置字体：各自遵循 `SIL Open Font License 1.1`，详见 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。

由于禁止商业使用，本项目准确地说是“源码公开 / source-available”，并非 OSI 定义下的开源软件。

---

## English

B-PLUM-FushengRecords turns a story from your life into a collectible ticket, then places it in an interactive album styled after a traditional Chinese book. It runs locally by default and works with both ChatGPT and Codex. You can stop after one ticket or carry the whole collection into an album and export it.

Past Memorial Tickets come in two horizontal formats. Universe Order Tickets can use either of those or the vertical `chapter-pass` format made for the future chapter.

### Features

- Turn something that happened into a Past Memorial Ticket.
- Record a hoped-for experience as a Universe Order Ticket, without treating the wish as a promise.
- Build an interactive album that stays local by default.
- Keep each ticket's PNG and JSON together, without redrawing or cropping the original image.
- Add clearly fictional sample tickets for testing or demonstrations.
- Export the album as a ZIP without changing the source files.

### Install

```bash
git clone https://github.com/AKIIIIIIIIIII/B-PLUM-FushengRecords.git
```

In the ChatGPT or Codex Plugins page, add a local plugin source and select the repository root containing `.codex-plugin/plugin.json`. Enable **B-PLUM-FushengRecords**, start a new task, and tell it what you want to make.

### Example prompts

```text
Make a life ticket for me.
Create an empty B-PLUM-FushengRecords album.
Build a browsable album with fictional sample tickets.
Collect these tickets into my album.
Export every ticket from the album.
```

### Privacy

Albums stay local unless you choose to publish them. The plugin ships without a developer API key and never asks you to commit a personal key. It does not copy user photos into the plugin or store photo paths and binary data in ticket JSON. Keep generated albums with private stories out of public repositories.

### Support and commercial work

If Fusheng Records helped you keep a moment, you can [buy the maker a coffee](https://buymeacoffee.com/plum.b). This is voluntary support, not a commercial license. Commercial use, paid redistribution, brand campaigns, and client work require separate written permission. Contact the author through [https://b-plum.com/](https://b-plum.com/).

### Licensing

- Software: [PolyForm Noncommercial 1.0.0](LICENSE).
- Bundled fonts retain their SIL Open Font License 1.1 terms; see [third-party notices](THIRD_PARTY_NOTICES.md).

Because commercial use is restricted, this project is source-available rather than OSI-approved open source.

## License scope

The software is released under the [PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0). Unless explicitly stated otherwise, documentation, screenshots, and example artwork are not separately licensed and remain protected by copyright. Third-party fonts and other external materials remain under their respective licenses.
