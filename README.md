# 🍌 Nano Generator

**版本：v0.2.0**

一个基于 Google Gemini API 的 AI 图像生成测试工具。

## 🌐 在线版本

无需安装，直接访问在线版本：https://nano-api-generator.vercel.app/

## 🚀 功能特性

- ✅ 文本生成和图片识别
- ✅ AI 图像生成
- ✅ 多模型支持
- ✅ 图片预览和下载
- ✅ 自动保存到本地
- ✅ API Key 掩码显示
- ✅ 面板折叠/展开

### 🖼️ 画布功能

- ✅ 画布导航（缩略图实时显示）
- ✅ 画布缩放控制（50%-250%，支持 25% 步长）
- ✅ Ctrl+鼠标滚轮 缩放画布
- ✅ 画布拖动（支持中键拖动）
- ✅ 画布焦点管理

### 📌 图片节点功能

- ✅ 图片拖动和调整大小（保持宽高比）
- ✅ PIN 标记功能（Ctrl+点击添加位置标记）
- ✅ 图片插入到输入框（与其他图片一起发送）
- ✅ 节点工具栏（复制提示词、插入输入框、复制图片、删除）
- ✅ 中心坐标和分辨率显示
- ✅ 提示词显示（图片下方显示）

### 🛠️ 调试功能

- ✅ 调试控制台面板（Ctrl+` 快捷键）
- ✅ 鼠标事件日志记录
- ✅ 坐标和网格显示
- ✅ 实时日志输出

## 📦 安装步骤

### 1. 克隆项目

```bash
git clone https://github.com/your-username/nano-generator.git
cd nano-generator
```

### 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，填入你的 Google AI Studio API Key
# 将 YOUR_API_KEY_HERE 替换为你的真实 API Key
```

环境变量配置项：
- `GEMINI_API_KEY`: Google AI Studio API Key
- `GEMINI_MODEL_NAME`: 文本/识图模型（默认：gemini-3-flash-preview）
- `GEMINI_IMAGE_MODEL_NAME`: 生图模型（默认：gemini-3-pro-image-preview）

### 3. 启动项目

```bash
# 使用 Node.js 启动
node server.js

# 或使用 Docker 启动
docker build -t nano-generator .
docker run -d -p 8000:8000 -v "$(pwd)/DL:/app/DL" --name nano-generator nano-generator
```

### 4. 访问应用

打开浏览器访问：http://localhost:8000/

## 🔑 获取 API Key

1. 访问 [Google AI Studio](https://aistudio.google.com/app/apikey)
2. 创建新的 API Key
3. 将 API Key 填入 `.env` 文件或 Vercel 环境变量中

## 🌐 部署到 Vercel

### 1. 连接 GitHub 仓库

在 Vercel 中导入你的 GitHub 仓库。

### 2. 配置环境变量

在 Vercel 项目设置中添加以下环境变量：

- `GEMINI_API_KEY`: 你的 Google AI Studio API Key
- `GEMINI_MODEL_NAME`: gemini-3-flash-preview
- `GEMINI_IMAGE_MODEL_NAME`: gemini-3-pro-image-preview

### 3. 部署配置

确保以下设置正确：
- **Build Command**: 留空（不需要构建）
- **Output Directory**: 留空（根目录）
- **Node.js Version**: 18 或更高

### 4. 部署

点击 "Deploy" 按钮开始部署。

## 📖 使用说明

### 基本操作

1. 在 API Key 输入框中输入你的 API Key
2. 选择模型（文本模型、识图模型、生图模型）
3. 输入提示词
4. 勾选"生图模式"生成图片
5. 点击"发送"按钮

### 画布操作

- **画布拖动**：鼠标中键拖动或直接拖动
- **画布缩放**：
  - 使用缩放滑块（50%-250%）
  - Ctrl + 鼠标滚轮
  - 缩放按钮 (+/-)
  - 点击百分比重置为 100%
- **画布导航**：右下角缩略图实时显示当前视口

### 图片节点操作

- **选择图片**：点击图片节点
- **添加 PIN 标记**：选中图片后，Ctrl + 点击图片位置
- **调整图片大小**：拖动右下角调整手柄（保持宽高比）
- **拖动图片**：直接拖动图片节点
- **工具栏操作**：
  - 📝 复制提示词
  - ✏️ 插入到输入框
  - 📋 复制图片
  - 🗑️ 删除图片

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| Ctrl + ` | 切换调试控制台 |
| Ctrl + +/- | 缩放画布 |
| Ctrl + 鼠标滚轮 | 缩放画布 |
| Ctrl + 点击图片 | 添加 PIN 标记 |

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！
