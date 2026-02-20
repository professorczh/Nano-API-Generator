# 🍌 Nano Generator

**版本：v0.1.0**

一个基于 Google Gemini API 的 AI 图像生成测试工具。

## 🚀 功能特性

- ✅ 文本生成和图片识别
- ✅ AI 图像生成
- ✅ 多模型支持
- ✅ 图片预览和下载
- ✅ 自动保存到本地
- ✅ API Key 掩码显示
- ✅ 面板折叠/展开

## 📦 安装步骤

### 1. 克隆项目

```bash
git clone https://github.com/your-username/nano-generator.git
cd nano-generator
```

### 2. 配置 API Key

```bash
# 复制示例配置文件
cp config.example.js config.js

# 编辑 config.js，填入你的 Google AI Studio API Key
# 将 YOUR_API_KEY_HERE 替换为你的真实 API Key
```

### 3. 启动项目

```bash
# 使用 Node.js 启动
node server.js

# 或使用 Docker 启动
docker build -t nano-generator .
docker run -d -p 8001:8000 -v "$(pwd)/DL:/app/DL" --name nano-generator nano-generator
```

### 4. 访问应用

打开浏览器访问：http://localhost:8001/

## 🔑 获取 API Key

1. 访问 [Google AI Studio](https://aistudio.google.com/app/apikey)
2. 创建新的 API Key
3. 将 API Key 填入 config.js 文件

## 📖 使用说明

1. 在 API Key 输入框中输入你的 API Key
2. 选择模型（文本模型、识图模型、生图模型）
3. 输入提示词
4. 勾选"生图模式"生成图片
5. 点击"发送"按钮

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！
