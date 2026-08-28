# 浮生录 Skill 维护指南

本仓库是由多个相互协作的 Codex Skill 组成的插件。修改应保持范围小、意图单一，并优先维护 Skill 的行为与路由，不把普通的指令调整扩展为代码或产品改造。

## 工作方式

1. 修改前完整读取目标 `SKILL.md`。
2. 只按目标 Skill 中的路由读取当前任务需要的 `references/`、`scripts/` 或 `assets/`；不要无目的加载整个插件。
3. 默认只修改用户指定的 Skill。除非请求或契约兼容性明确要求，否则不要顺带修改网页模板、其他 Skill、插件版本或 marketplace。
4. 以最小改动实现目标，并在结束前检查 diff，确认没有生成物、缓存或无关格式化。

新增或调整内容时遵循以下分工：

- 新能力、触发条件、核心流程和关键边界写入 `SKILL.md`。
- 仅在特定情形下需要的大量细节放入 `references/`，并从 `SKILL.md` 明确说明何时读取。
- 只有重复执行且需要确定性结果的操作才放入 `scripts/`。
- 供生成结果使用的模板、字体和图片放入 `assets/`，不要把资产当作指令加载。
- 修改展示名称、简短描述或默认提示时，同步对应的 `agents/openai.yaml`。

## 关联链路

修改工作流、输入输出或数据约定时，检查直接关联的 Skill，重点确认以下链路仍然连贯：

- `make-life-ticket` → `bind-life-album` → `collect-life-tickets`
- `implant-sample-tickets` → `make-life-ticket` → `collect-life-tickets`
- `create-fusheng-record` 与它协调的各子 Skill

只有跨 Skill 契约确实变化时才修改关联 Skill；不要为了“保持一致”复制重复规则。共享的详细规则应保留在负责该行为的 Skill 中，协调入口只负责路由和顺序。

## 验证与外部操作

- 修改 Skill 后，运行 Skill Creator 提供的 `quick_validate.py <skill-directory>` 验证目标 Skill。
- 修改 `.codex-plugin/plugin.json` 或插件结构时，再运行 Plugin Creator 提供的 `validate_plugin.py <plugin-directory>`。
- 修改脚本或资产时，按目标 Skill 的说明执行与该改动直接相关的检查；未修改代码时不要额外引入代码测试或依赖。
- 验证器因环境依赖缺失而无法运行时，明确报告原因，不把未运行描述为通过。
- 不自动执行 cachebuster、重装插件、发布网站或修改外部 marketplace。这些操作必须由用户明确要求。

## Git 与提交规则

- `main` 用于已确认的基线；日常修改通过功能分支和 PR 合入，并使用 Merge Commit。
- 分支名使用小写 kebab-case：`feat/<topic>`、`fix/<topic>`、`docs/<topic>` 或 `chore/<topic>`。
- 提交格式为 `<type>(<scope>): <中文简洁描述>`，标题末尾不加句号。
- 常用类型：
  - `feat`：增加可观察的 Skill 能力。
  - `fix`：修正路由、约束或执行行为。
  - `refactor`：整理指令结构但不改变行为。
  - `docs`：只调整说明文字。
  - `test`：调整验证或测试样例。
  - `chore`：维护插件清单或仓库。
- scope 优先使用完整 Skill 名；仓库级维护使用 `repo`，插件清单使用 `plugin`。
- 每个提交只处理一个 Skill 行为或一个跨 Skill 契约，相关说明和验证随同提交。
- PR 标题沿用相同的 Conventional Commit 格式；PR 内保留原子提交，不 squash 或 rebase。

示例：

```text
fix(make-life-ticket): 明确出票前的确认门槛
feat(bind-life-album): 支持浏览器本地票根导出
refactor(create-fusheng-record): 简化子技能路由说明
```

不要提交生成的票根、藏本、ZIP、缓存、依赖目录或 `+codex.local-*` cachebuster。
