# 🤖 ai-agent 项目介绍
本项目是 抖音搜索训练营--AI Agent应用搭建 作业（结果搞错了作业截止时间，两天肝完😇）

# 📸 界面截图
<img width="2559" height="1337" alt="image" src="https://github.com/user-attachments/assets/74098086-160f-406e-a39a-bb6375271a9c" />
<img width="2559" height="1338" alt="image" src="https://github.com/user-attachments/assets/a3a4b76f-8743-45c7-ad59-ffd8de61183b" />
<img width="2559" height="1335" alt="image" src="https://github.com/user-attachments/assets/f19f2eeb-669a-4843-a8da-30eb1b3b71d0" />


## 🛠️ 技术栈与工具
- 框架: 通过 Modern.js 完成前后端一体应用搭建 (React + Node.js BFF)。
- 大模型:
  - 主模型 (Actor): 接入阿里云 DashScope Qwen3-VL-Plus，支持超强视觉识别与深度思考。
  - 评估模型 (Critic): 接入火山引擎 Doubao-Seed-1.6-lite，用于对主模型的回答进行“判卷”。
- 搜索增强: 利用 Tavily 封装搜索工具，赋予 Agent 联网能力。
- 数据持久化: 使用 MongoDB (Mongoose) 配合本地缓存，持久化存储会话、消息、图片URL及思考过程。

## 🔗 项目结构
<img width="815" height="543" alt="image" src="https://github.com/user-attachments/assets/2b410450-ead3-4a8e-b9e9-209886e712ac" />

## ✨ 实现功能
### 🚀 核心功能
- 🧠 深度思考 (Deep Thinking): 集成 Qwen 的思维链能力，流式输出 AI 的思考过程（Reasoning Content），让用户看到 AI 是如何一步步解题的。
- 👀 多模态视觉 (Vision Analysis): 支持上传多张图片（.jpg/.png），AI 可对图片内容进行深度分析与问答。
- ⚖️ GAN 模式 / 模型自评 (Test Mode): 创新性的“测试模式”。开启后，Qwen 生成回答，随后自动调用 Doubao 对该回答进行准确性与逻辑性评估，并将评估报告流式追加在回答下方。
- 🌍 国际化 (i18n): 完整的中英文切换支持，覆盖界面 UI、系统提示词 (System Prompt) 及错误提示。
### ⚡基础功能
- 流式输出 (SSE): 打字机效果，支持Markdown实时渲染。
- 联网搜索 (RAG): 自动提取关键词搜索网络，并基于最新信息回答。
- 会话管理: 侧边栏多会话切换、创建、删除、重命名。
- 数据持久化: 完整的历史记录回显，包括图片、思考过程和评估结果。
### 🎨 UI
- 深色/浅色主题
- 响应式侧边栏
- Markdown 渲染
- 交互反馈：加载动画、错误提示气泡、操作确认

# 🧩 遇到的难点及解决方案
1. 输入框样式遮挡
	- 问题：原方案中按钮组采用绝对定位悬浮在输入框底部，当输入文字过多产生滚动时，底部的文字会被按钮遮挡，且单纯增加 padding-bottom 无法完美解决滚动到底部时的视线遮挡问题
	- 解决方案：Flexbox 布局重构。将输入框容器改为 flex-direction: column 布局，文本区域设置为 flex: 1 自动占据剩余空间，按钮区域取消绝对定位改为底部静态块。实现了文本滚动区与按钮操作区的物理隔离，彻底解决遮挡
2. 滚动条美化
	- 问题：滚动条出现在 message-container 容器边缘，而非 window 边缘
	- 解决方案：使用 CSS ::-webkit-scrollbar { display: none; } 隐藏滚动条
3. 图标居中
    - 问题：创建会话、切换语言图标在侧边栏收缩时难以居中
    - 解决方案：通过绝对定位解决了，但不知道为什么 flex 就没法居中
4. markdown 表格渲染
	- 问题：表格没有渲染
	- 解决方案：暂无
5. 后端
	- 问题：完全没有后端基础，根本不会写后端
	- 解决方案：该问 ai 就问 ai，先把项目做完再慢慢学
6. 串行流式编排
   - 问题: 在“测试模式”下，需要先流式输出 Qwen 的回答，待其结束后，再将完整内容发给 Doubao 进行评估，最后将 Doubao 的评估也流式输出给前端，保持连接不断开
   - 解决方案: 在 BFF 层手动控制 ReadableStream 的 controller。先 pipe Qwen 的流，同时在后端 buffer 完整回答；Qwen 结束后不关闭流，立即请求 Doubao，将其输出伪造成 SSE 格式继续 enqueue 到同一个流中

# 🐛 待修 bug
- 创建新会话偶尔会创建了两个（目前只触发过一次）
- ✅loading 时禁止切换会话列表
- ✅输入框遮挡

# 📅 未来规划
- 重命名会话样式优化，现在看不清字
- ✅多语言支持 (i18n)：留了位置但没时间写了（后端提示没有英文）
- ✅深度思考模式：留了位置但选的模型根本没有 thinking 所以没写
- 用户系统：注册/登录，计划是点击侧边栏上侧头像跳出注册/登录界面
- 大模型微调/基于langgraph搭建一个智能agent（已放弃，本地微调跑一半崩了）
- ✅数据库保存思考内容

# 📚 参考
- **ai**：后端；markdown 样式；侧边栏的删除、重命名会话样式；国际化资源
- **b站**：山羊の前端小窝 (侧边栏 UI 参考: BV1JM411Z78n)
