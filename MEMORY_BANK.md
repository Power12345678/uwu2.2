# uwu 小手机记忆移植 Memory Bank

最后更新：2026-05-12

## 当前目标

把微信机器人当前正在启用的记忆系统移植到 uwu 小手机。原则是只移植真实启用链路，不移植微信机器人里已经关闭的实验按钮。

## 已完成进度

1. 已完成技术文档初版：`WECHAT_CORE_MEMORY_PORTING_TECH_DOC.md`。
2. 已确认微信机器人当前启用链路：
   - 核心记忆启用。
   - 核心记忆独立 JSON 文件启用。
   - 记忆上传给 AI 启用。
   - 关键词不上传给生成回复的 AI，只用于召回。
   - 自动总结按聊天轮数触发，阈值 12 轮。
   - 最新记忆池 70 条，老记忆池召回 20 条。
   - Stage A 使用轻量模式，rerank 开启。
3. 已在 uwu 小手机新增核心记忆模块：
   - `js/modules/core_memory.js`
   - `js/modules/core_memory_recall.js`
   - `js/modules/core_memory_summary.js`
   - `js/modules/core_memory_ui.js`
4. 已将 Dexie 升级，新增 `coreMemoryFiles` 表用于存储微信同格式核心记忆。
5. 已把旧“日记/总结”主界面替换为“核心记忆管理”界面：
   - 支持核心记忆列表。
   - 支持手动新增、编辑、删除、搜索、多选。
   - 支持导入/导出微信同格式核心记忆 JSON。
6. 已接入主聊天、群聊、偷看、小剧场等主要 prompt 路径，让 AI 读取核心记忆。
7. 已停用旧日记自动总结链路，避免与核心记忆链路并行造成重复记忆。
8. 已移除启动时的远程验证/登录入口，页面会直接进入小手机主界面。
9. 已新增微信 `chat_contexts.json` 兼容短期记忆层：`js/modules/short_memory.js`。
10. 已新增 Dexie `shortMemoryContexts` 表，保存独立于界面聊天记录的“发送给 AI 的短期上下文”。
11. 已在“记忆”页面增加分段：
   - 长期核心记忆
   - 短期上下文
12. 短期上下文页面已支持：
   - 编辑 user / assistant 文本。
   - 添加一轮。
   - 删除一轮。
   - 保存为独立短期上下文。
   - 从当前界面聊天记录重建。
   - 清空发送给 AI 的短期记忆，且不删除界面聊天记录。
   - 导入微信 `chat_contexts.json` 或单用户数组。
   - 导出微信完整对象格式 `chat_contexts.json`。
13. 已新增“手动总结核心记忆”按钮，支持未满 12 轮时按当前可用完整轮次总结。
14. 已修正轮次定义：一次用户触发的完整 AI 调用，即使在界面拆成多条 AI 气泡，也在短期记忆和核心总结里作为一个 assistant 回合。
15. AI prompt 构建已优先读取独立短期上下文；没有独立短期上下文时才从界面 `chat.history` 推导。
16. 已将私聊默认输出协议改为微信机器人式纯文字：
   - 普通回复不再要求 `[角色名的消息：...]`。
   - 换行、`$`、`\n`、连续反斜杠会拆成多条气泡。
   - AI 返回旧式 `[角色名的消息：...]` 时会自动降级为普通文字。
17. 已新增私聊特殊能力开关，默认关闭：
   - 表情包、语音、图片/视频、转账、礼物、位置、状态、引用、撤回、商城、通话、HTML。
   - 只有开启对应能力时，prompt 才注入对应中括号格式。
   - 未开启时，AI 偶发输出的特殊格式会降级为普通文字，不触发对应功能。
18. 群聊仍保留小手机原结构化协议，不参与微信机器人记忆互通目标，避免多人发言人与小手机特色功能被私聊协议影响。
19. 已将核心记忆总结 prompt 对齐微信机器人 `memory_summary_prompt_template.txt`：
   - 使用“你将扮演 PROMPT_NAME”的总结口径。
   - 输出字段为 `summary`、`keywords`、`importance`。
   - summary 要求第一人称、客观中立、只记录事实。
   - keywords 要求从对话原文抽取，限制 5-12 个。
20. 已将私聊短期上下文里的用户消息对齐微信机器人格式：
   - 小手机内部 UI 可继续显示原消息。
   - 发送给 AI / 写入短期上下文时，用户消息转为 `[2026-05-12 Tuesday 01:18:29] 原文`。
   - 不再把用户消息作为 `用户名的消息：...` 发送给私聊 AI。
   - 核心总结日志按微信机器人重建为 `2026-05-12 Tuesday 01:18:29 | [用户键] 原文`。
21. 已把微信机器人当前启用的 A/B 召回精排链路迁入小手机：
   - Stage A 默认轻量桶选：hard -> event -> aux，按锚点排名分桶，输出候选再进入 rerank。
   - Stage A complex/V1 公式也已实现，保留 hard/event/aux pool weight、query assist、overlap、importance、soft floor、bucket 排序。
   - B 阶段 `rerank_archive_memories_with_context()` 已接入 hard/event/aux 池、池内/池外权重、无池命中禁用档位分、B 阶段 penetration、优先替换弱尾部、topic lock、动态门控保护框架、泛词禁止入硬锚点池。
   - 当前默认值对齐微信 `config.py`：rerank 开、Stage A light 开、Stage A complex 关、无池命中禁用档位分开、B 阶段 penetration 开、泛词禁止入硬锚点池开、carryover 本体关但 `carryoverRequireLink` 保持开。
   - 浏览器端没有 jieba/Python 分词，因此额外做了“核心记忆关键词词库反扫查询文本”的兼容层，让 `调试软件/重启/修复` 这类微信词表关键词能进入事件候选池。

## 当前验证状态

已执行：

```text
node --check js/modules/core_memory.js
node --check js/modules/core_memory_recall.js
node --check js/modules/core_memory_summary.js
node --check js/modules/short_memory.js
node --check js/modules/core_memory_ui.js
node --check js/modules/journal.js
node --check js/modules/chat_ai.js
node --check js/modules/character_import.js
node --check js/group_chat.js
node --check js/modules/theater.js
node --check js/modules/peek.js
node --check js/settings.js
node --check js/db.js
node --check js/main.js
```

浏览器验证结果：

1. 记忆入口显示为“记忆”。
2. 记忆页标题显示“核心记忆”。
3. 旧自动日记 UI 已隐藏。
4. 导入测试核心记忆后，短期池/长期池展示可用。
5. 刷新后不再出现登录验证层。
6. 召回精排样例验证通过：查询 `[2026-05-12 Tuesday 01:18:29] 那个破软件又冒烟了，帮我调试软件然后重启修复` 时，Stage A light 只选中含 `调试软件/重启/修复` 的事件记忆，B 阶段 queryKeywords 为 `mode:unified`、`evt:调试软件`、`evt:重启`、`evt:修复`。
7. Stage A complex/V1 公式手动切换验证通过：同一查询下 `poolEventComponent` 生效并选中同一条事件记忆。

## 重要不变式

核心记忆导出必须保持微信机器人格式：

```json
[
  {
    "timestamp": "2026-01-26 Monday 20:15",
    "summary": "...",
    "importance": 5,
    "keywords": ["..."]
  }
]
```

导出时只允许包含：

1. `timestamp`
2. `summary`
3. `importance`
4. `keywords`

不要导出 uwu 内部字段，例如 `id`、`chatId`、`chatType`、`settings`、`roundCounter`、`lastSummarizedRound`。

## 当前差异与风险

1. 当前 uwu 已做到“当前启用链路功能对齐”，但不是微信机器人后台配置页的像素级复刻。
2. 核心记忆 JSON 已保持微信同格式；短期记忆也已支持微信 `chat_contexts.json` 结构导入/导出。
3. 短期记忆和核心总结的一轮已经按“用户一次发送触发一次完整 AI 调用 + 该调用的完整 AI 回复”处理。
4. 私聊普通多气泡协议已改为微信机器人式分隔符，记忆和输出都更贴近 `chat_contexts.json`。
5. 小手机特殊能力仍需要中括号指令，但已改为按角色开关注入，默认关闭，避免默认 token 膨胀。
6. 群聊仍使用小手机内部结构化协议，不要求与微信机器人互通。
7. 核心记忆总结 prompt 已改为微信机器人 `config.py` 当前启用模板，并按 `bot.py` 的实际拼装逻辑注入 `IMPORTANCE_RULES` / `EXTRA_FILTERS`；API、模型与温度仍来自小手机设置，如果模型不同，输出风格仍可能有轻微差异。
8. 私聊用户短期上下文已使用微信机器人时间戳格式；群聊仍保留小手机发言人格式。
9. 核心记忆设置页已加入可编辑项：手动泛词词表、核心记忆总结提示词、核心记忆重要度提示词。默认值与微信机器人 `config.py` 当前启用配置一致，并会按当前角色/会话保存到核心记忆 record 的 `settings` 中。
10. 已补齐微信当前开启记忆链路里的多张本地精排词表：泛词、亲密词、事件动词白名单、事件结果词、事件候选阻断词、硬锚点名词白名单、硬锚点阻断词、强制辅助锚点、统一别名表、字母代号词表。小手机召回逻辑会读取这些可编辑表，不再只使用早期轻量小表。
11. A/B 阶段召回精排已从“轻量近似”升级为小手机前端可运行的完整移植版。主要剩余差异不是功能链路，而是运行环境：微信机器人使用 Python/jieba 分词，小手机浏览器端使用 JS 规则分词 + 核心记忆关键词反扫，因此极少数没有写入 keywords 的中文长句，锚点抽取结果可能与微信后台略有差异。

## 下一阶段开发方向

下一阶段建议做“私聊微信文字协议真实对话验收 + 特殊能力开关细化”。

核心原则：

1. 私聊普通文本保持微信式协议，不把 `[角色名的消息：...]` 作为默认要求。
2. 特殊能力只在开关开启时注入 prompt。
3. 短期记忆继续保存 `role/content`，不为普通气泡写入小手机 UI 包装。
4. 群聊保留原小手机协议，不追求微信机器人导入导出互通。
5. 继续观察短期上下文清空后下一次 AI 是否只读取当前新消息，确保不会回读界面历史。

## 下次接手建议顺序

1. 先看 `WECHAT_CORE_MEMORY_PORTING_TECH_DOC.md` 的“19. 私聊微信文字协议落地结果”。
2. 用真实私聊测试：AI 输出裸文本多行，界面拆成多条气泡，短期记忆保存为一个 assistant 完整回合。
3. 用真实私聊测试：AI 输出 `$` 或 `\n`，界面按微信规则拆气泡。
4. 用真实私聊测试：发送一条用户消息后，短期上下文 user 项应为 `[YYYY-MM-DD Weekday HH:MM:SS] 原文`。
5. 手动总结一段对话，检查 summary 是否为“司洛口吻、第一视角日记流水账”的微信机器人当前风格。
6. 分别开启语音、表情包、转账等能力，确认只有开启后 prompt 才出现对应格式。
7. 用群聊测试多人回复，确认群聊仍按原结构化格式区分发言人。
8. 在角色设置里编辑泛词词表和核心记忆提示词，保存后手动总结一次，确认总结 prompt 使用自定义内容。
9. 在角色设置里编辑本地精排词表，保存后用对应关键词测试老记忆召回排序是否变化。
10. 用真实核心记忆文件批量测试召回：重点看事件类记忆、泛词密集记忆、亲密泛词记忆、只有单锚点的记忆，确认 Stage A light 候选与 B 阶段排序都符合微信当前使用习惯。

## 2026-05-13 追加进度：uwu2.1 API 自动重试

本次把 `uwu小手机/uwu-main` 中已经验证过的 API 失败/空回重试逻辑同步移植到 `uwu2.1-main/uwu2.1-main`。

已改文件：

1. `index.html`：API 设置页新增“API失败自动重试”数字输入，默认 2，填 0 表示关闭。
2. `js/settings.js`：读取/保存 `db.apiSettings.apiRetryCount`。
3. `js/db.js`：默认 `apiSettings = { apiRetryCount: 2 }`，旧数据迁移时补默认值。
4. `js/utils.js`：新增 `runApiRequestWithRetry()`、空回复检测、失败分类与延迟重试；所有调用 `fetchAiResponse()` 的模块都会受益。
5. `js/modules/chat_ai.js`：主聊天直接 API 请求接入同一套重试；流式/非流式空回都会触发重试。

验证：

1. `node --check js/utils.js`
2. `node --check js/modules/chat_ai.js`
3. `node --check js/settings.js`
4. `node --check js/db.js`
5. Node 模拟空回复两次、第三次成功：`calls = 3`，返回 `ok-after-retry`。
6. DevTools 打开 `file://.../uwu2.1-main/index.html` 后确认 `#api-retry-count` 存在且默认值为 `2`，`runApiRequestWithRetry/getApiRetryOptions/isEmptyAiResponseText` 均为全局函数。
