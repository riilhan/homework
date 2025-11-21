# 项目介绍
本项目是 抖音搜索训练营--AI Agent应用搭建 作业（结果搞错了作业截止时间，两天肝完😇）

# 界面截图
<img width="2559" height="1337" alt="image" src="https://github.com/user-attachments/assets/74098086-160f-406e-a39a-bb6375271a9c" />
<img width="2559" height="1338" alt="image" src="https://github.com/user-attachments/assets/a3a4b76f-8743-45c7-ad59-ffd8de61183b" />
<img width="2559" height="1335" alt="image" src="https://github.com/user-attachments/assets/f19f2eeb-669a-4843-a8da-30eb1b3b71d0" />

## 相关工具
- 通过 Modern.js 完成前后端一体应用搭建
- 通过[火山云](https://www.volcengine.com/)，接入模型（本项目选择 Doubao-Seed-1.6-lite)
- 利用 tavily 封装搜索工具，给 agent 提供联网能力
- 利用 mongodb 配合本地缓存持久化对话目录

## 项目结构
<img width="815" height="543" alt="image" src="https://github.com/user-attachments/assets/2b410450-ead3-4a8e-b9e9-209886e712ac" />

## 实现功能
### 核心功能
- 流式输出
- 联网搜索
- 会话持久化 & 多会话管理
### UI
- 深色/浅色主题
- 响应式侧边栏
- Markdown 渲染
- 交互反馈：加载动画、错误提示气泡、操作确认

# 遇到的难点及解决方案
1. 输入框样式遮挡
	- 问题：当字数过多时，用户输入的内容会遮住输入框底部的操作按钮
	- 解决方案：尝试调整 padding，未能成功解决
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

# 待修 bug
- 创建新会话偶尔会创建了两个（目前只触发过一次）
- loading 时禁止切换会话列表

# 未来规划
- 重命名会话样式优化，现在看不清字
- 多语言支持 (i18n)：留了位置但没时间写了
- 深度思考模式：留了位置但选的模型根本没有 thinking 所以没写
- 用户系统：注册/登录，计划是点击侧边栏上侧头像跳出注册/登录界面
- 大模型微调/基于langgraph搭建一个智能agent

# 参考
## ai
- 后端
- markdown 样式
- 侧边栏的删除、重命名会话样式
# b站：山羊の前端小窝
- 侧边栏参考：BV1JM411Z78n
