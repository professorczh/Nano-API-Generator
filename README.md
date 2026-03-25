🍌 Nano Generator

版本：v0.2.1-stable

Nano Generator 是一个面向未来的 多模态 AI 无限画布创作终端。它不再局限于传统的对话界面，而是提供了一个 10000x10000 的自由创作空间，支持多模型接入、视觉对齐（PIN）以及节点化内容管理。

🌐 快速开始 (零配置)

本工具采用 纯前端配置架构，您的 API Key 和所有设置仅存储在浏览器本地（LocalStorage），不经过任何第三方服务器，确保隐私安全。

访问在线版本：https://nano-api-generator.vercel.app/

配置 API Key：点击页面左下角的 设置(Settings) 按钮。

填入 Key：从您的 API 供应商（如 Google AI Studio, OpenAI, Anthropic 等）获取 Key 并填入对应面板。

开始创作：在画布中心输入提示词，即可生成图像、文本或视频节点。

🚀 核心特性

🖼️ 无限画布创作系统

空间管理：提供 10000x10000 的超大画布，所有内容以“节点”形式存在，自由排列。

视觉对齐 (PIN)：独创 PIN 功能，在图片上点击即可标记空间坐标，模型将根据标记点进行精准创作。

智能导航：右下角小地图实时追踪视口位置，支持点击小地图快速跳转。

丝滑缩放：支持以鼠标指针为中心的精准缩放（50%-250%），消除布局偏移干扰。

🤖 多模型供应商支持

模型无关性：支持 Google Gemini 全系列、OpenAI 格式兼容接口以及 Claude 等主流模型。

动态切换：支持为不同的创作任务（生图、识图、对话、视频）指定不同的供应商和模型。

异步并行：支持多个请求同时生成，每个节点独立计时，互不干扰。

📌 节点化交互

多功能工具栏：每个节点自带工具栏，支持复制提示词、反向插入输入框、下载或删除。

智能占位：生成过程中提供实时进度与耗时显示，位置自动对齐当前视窗中心。

多模态组合：支持将多个图片节点及其 PIN 坐标组合，作为上下文发送给模型。

📦 本地部署

如果您希望在本地运行或开启“本地存盘”模式：

1. 克隆项目

git clone [https://github.com/professorczh/Nano-API-Generator.git](https://github.com/professorczh/Nano-API-Generator.git)
cd Nano-API-Generator


2. 启动服务

# 使用 Node.js 启动
node server.js

# 或使用 Docker 启动
docker build -t nano-generator .
docker run -d -p 8000:8000 -v "$(pwd)/DL:/app/DL" --name nano-generator nano-generator


注意：本地启动时，系统会检测磁盘写入权限。若权限开启，生成的图片/视频将自动备份至 /DL 文件夹。

📖 交互说明

操作

快捷键 / 动作

缩放画布

Ctrl + 鼠标滚轮 或 Ctrl + +/-

平移画布

鼠标中键拖拽 或 空格 + 左键拖拽

添加 PIN

选中图片节点后，Ctrl + 点击 图片任意位置

调试控制台

Ctrl + ~ (反引号) 快速切换

快速发送

Ctrl + Enter

🔑 获取 API Key

您可以从以下官方渠道获取 API Key 并直接填入本工具的设置面板：

Google Gemini: [Google AI Studio](https://aistudio.google.com/app/apikey)

其他供应商: 请访问您对应的 API 供应商后台获取

📄 隐私声明

Nano Generator 坚守隐私第一原则：

不存储：我们不提供后端数据库，您的 API Key 永远不会上传到我们的服务器。

本地化：所有配置均保存在您自己的浏览器 LocalStorage 中。

透明化：本项目开源，您可以随时审计坐标计算与请求分发逻辑。

Banana Team | 赋能每一位多模态创作者