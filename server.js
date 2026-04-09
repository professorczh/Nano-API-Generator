const http = require('http');
const fs = require('fs');
const path = require('path');

// 加载环境变量
require('dotenv').config();

const { GoogleGenAI } = require('@google/genai');

process.env.TZ = 'Asia/Shanghai';

// 代理配置：全面交由系统环境变量接管
// 不再手动指定端口或注入 Agent，以确保与生图成功的环境一致
if (process.env.HTTP_PROXY || process.env.HTTPS_PROXY) {
    console.log(`[Proxy] 检测到系统代理变量，将由 Node.js 原生 Fetch 自动处理转发。`);
}

const PORT = 8000;
const GENERATED_IMAGES_DIR = './DL';
const GENERATED_VIDEOS_DIR = './DL/videos';
const GENERATED_AUDIO_DIR = './DL/audio';

// 磁盘权限自检
let storageCapabilities = { canWrite: false };

function checkDiskWritePermission() {
    try {
        const testFile = path.join(GENERATED_IMAGES_DIR, '.write-test');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        storageCapabilities.canWrite = true;
        console.log('🧪 [SYSTEM] 磁盘权限检查：可写');
    } catch (e) {
        storageCapabilities.canWrite = false;
        console.log('🧪 [SYSTEM] 磁盘权限检查：不可写 -', e.message);
    }
}

const envConfig = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
    GEMINI_MODEL_NAME: process.env.GEMINI_MODEL_NAME || 'gemini-3-flash-preview',
    GEMINI_IMAGE_MODEL_NAME: process.env.GEMINI_IMAGE_MODEL_NAME || 'gemini-3-pro-image-preview'
};

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function getDateFolder() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

function getNextImageNumber(dateFolder) {
    const folderPath = path.join(GENERATED_IMAGES_DIR, dateFolder);
    ensureDirectoryExists(folderPath);
    
    const files = fs.readdirSync(folderPath);
    const imageFiles = files.filter(file => file.match(/^\d+_/));
    
    if (imageFiles.length === 0) {
        return 1;
    }
    
    const maxNumber = imageFiles.reduce((max, file) => {
        const number = parseInt(file.split('_')[0]);
        return number > max ? number : max;
    }, 0);
    
    return maxNumber + 1;
}

function saveImage(base64Data, prompt, aspectRatio, imageSize) {
    const dateFolder = getDateFolder();
    const imageNumber = getNextImageNumber(dateFolder);
    
    const now = new Date();
    const timeStr = String(now.getHours()).padStart(2, '0') + 
                   String(now.getMinutes()).padStart(2, '0') + 
                   String(now.getSeconds()).padStart(2, '0');
    
    const cleanPrompt = prompt.trim().substring(0, 20).replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '') || '未命名';
    const cleanAspectRatio = aspectRatio.replace(/:/g, 'x');
    const fileName = `${String(imageNumber).padStart(2, '0')}_${cleanPrompt}_${timeStr}_${cleanAspectRatio}_${imageSize}.png`;
    const folderPath = path.join(GENERATED_IMAGES_DIR, dateFolder);
    const filePath = path.join(folderPath, fileName);
    
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, buffer);
    
    const txtFileName = fileName.replace('.png', '.txt');
    const txtFilePath = path.join(folderPath, txtFileName);
    const txtContent = `提示词: ${prompt}\n宽高比: ${aspectRatio}\n分辨率: ${imageSize}\n生成时间: ${now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;
    fs.writeFileSync(txtFilePath, txtContent, 'utf-8');
    
    return {
        path: filePath.replace(/\\/g, '/'),
        filename: fileName,
        txtFileName: txtFileName,
        dateFolder: dateFolder,
        imageNumber: imageNumber,
        resolution: imageSize
    };
}

function getNextVideoNumber(dateFolder) {
    const folderPath = path.join(GENERATED_VIDEOS_DIR, dateFolder);
    ensureDirectoryExists(folderPath);
    
    const files = fs.readdirSync(folderPath);
    const videoFiles = files.filter(file => file.match(/^\d+_/));
    
    if (videoFiles.length === 0) {
        return 1;
    }
    
    const maxNumber = videoFiles.reduce((max, file) => {
        const number = parseInt(file.split('_')[0]);
        return number > max ? number : max;
    }, 0);
    
    return maxNumber + 1;
}

async function saveVideo(videoUrl, prompt, aspectRatio, duration, modelName) {
    const dateFolder = getDateFolder();
    const videoNumber = getNextVideoNumber(dateFolder);
    
    const now = new Date();
    const timeStr = String(now.getHours()).padStart(2, '0') + 
                   String(now.getMinutes()).padStart(2, '0') + 
                   String(now.getSeconds()).padStart(2, '0');
    
    const cleanPrompt = prompt.trim().substring(0, 20).replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '') || '未命名';
    const cleanAspectRatio = aspectRatio.replace(/:/g, 'x');
    const fileName = `${String(videoNumber).padStart(2, '0')}_${cleanPrompt}_${timeStr}_${cleanAspectRatio}_${duration}s.mp4`;
    const folderPath = path.join(GENERATED_VIDEOS_DIR, dateFolder);
    const filePath = path.join(folderPath, fileName);
    
    const response = await fetch(videoUrl);
    if (!response.ok) {
        throw new Error(`Failed to download video: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(filePath, buffer);
    
    const txtFileName = fileName.replace('.mp4', '.txt');
    const txtFilePath = path.join(folderPath, txtFileName);
    const txtContent = `提示词: ${prompt}\n宽高比: ${aspectRatio}\n时长: ${duration}秒\n模型: ${modelName}\n生成时间: ${now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;
    fs.writeFileSync(txtFilePath, txtContent, 'utf-8');
    
    return {
        path: filePath.replace(/\\/g, '/'),
        fileName: fileName,
        txtFileName: txtFileName,
        dateFolder: dateFolder,
        videoNumber: videoNumber
    };
}

function getNextAudioNumber(dateFolder) {
    const folderPath = path.join(GENERATED_AUDIO_DIR, dateFolder);
    ensureDirectoryExists(folderPath);
    
    const files = fs.readdirSync(folderPath);
    const audioFiles = files.filter(file => file.match(/^\d+_/));
    
    if (audioFiles.length === 0) {
        return 1;
    }
    
    const maxNumber = audioFiles.reduce((max, file) => {
        const number = parseInt(file.split('_')[0]);
        return number > max ? number : max;
    }, 0);
    
    return maxNumber + 1;
}

async function saveAudio(audioUrl, prompt, format, duration, modelName) {
    const dateFolder = getDateFolder();
    const audioNumber = getNextAudioNumber(dateFolder);
    
    const now = new Date();
    const timeStr = String(now.getHours()).padStart(2, '0') + 
                   String(now.getMinutes()).padStart(2, '0') + 
                   String(now.getSeconds()).padStart(2, '0');
    
    const cleanPrompt = prompt.trim().substring(0, 20).replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '') || '未命名';
    const fileName = `${String(audioNumber).padStart(2, '0')}_${cleanPrompt}_${timeStr}_${duration}s.${format}`;
    const folderPath = path.join(GENERATED_AUDIO_DIR, dateFolder);
    const filePath = path.join(folderPath, fileName);
    
    console.log(`[Audio Save] Downloading: ${audioUrl}`);
    const response = await fetch(audioUrl);
    if (!response.ok) throw new Error(`Failed to download audio: ${response.status}`);
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(filePath, buffer);
    
    const txtFileName = fileName.replace(`.${format}`, '.txt');
    const txtFilePath = path.join(folderPath, txtFileName);
    const txtContent = `提示词: ${prompt}\n格式: ${format}\n时长: ${duration}秒\n模型: ${modelName}\n生成时间: ${now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;
    fs.writeFileSync(txtFilePath, txtContent, 'utf-8');
    
    return {
        path: filePath.replace(/\\/g, '/').replace(/^.*outputs\//, '/DL/'), // 对齐静态资源路径
        fileName: fileName,
        txtFileName: txtFileName,
        dateFolder: dateFolder,
        audioNumber: audioNumber
    };
}

const server = http.createServer((req, res) => {
    // API 路由
    if (req.url.startsWith('/api/')) {
        console.log(`[API] ${req.method} ${req.url}`);
    }
    
    // 配置接口 - 返回服务器存储能力
    if (req.url === '/api/config' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ storageCapabilities }));
        return;
    }

    if (req.url === '/clear-env' && req.method === 'POST') {
        try {
            const existingEnv = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf-8') : '';
            const envLines = existingEnv.split('\n').filter(line => 
                !line.startsWith('GEMINI_API_KEY=') && 
                !line.startsWith('GEMINI_MODEL_NAME=') && 
                !line.startsWith('GEMINI_IMAGE_MODEL_NAME=')
            );
            
            envLines.unshift('GEMINI_IMAGE_MODEL_NAME=gemini-3-pro-image-preview');
            envLines.unshift('GEMINI_MODEL_NAME=gemini-3-flash-preview');
            envLines.unshift('GEMINI_API_KEY=');
            
            fs.writeFileSync('.env', envLines.join('\n'), 'utf-8');
            
            envConfig.GEMINI_API_KEY = '';
            envConfig.GEMINI_MODEL_NAME = 'gemini-3-flash-preview';
            envConfig.GEMINI_IMAGE_MODEL_NAME = 'gemini-3-pro-image-preview';
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: true, 
                message: 'API Key cleared successfully' 
            }));
        } catch (error) {
            console.error('Error clearing .env file:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
        
        return;
    }
    
    if (req.url === '/reload-env' && req.method === 'POST') {
        try {
            delete require.cache[require.resolve('dotenv')];
            const dotenv = require('dotenv');
            dotenv.config();
            
            envConfig.GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
            envConfig.GEMINI_MODEL_NAME = process.env.GEMINI_MODEL_NAME || 'gemini-3-flash-preview';
            envConfig.GEMINI_IMAGE_MODEL_NAME = process.env.GEMINI_IMAGE_MODEL_NAME || 'gemini-3-pro-image-preview';
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: true, 
                message: 'Environment variables reloaded successfully',
                config: envConfig
            }));
        } catch (error) {
            console.error('Error reloading environment:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
        
        return;
    }
    
    if (req.url === '/save-env' && req.method === 'POST') {
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const apiKey = data.apiKey?.trim();
                const modelName = data.modelName?.trim() || 'gemini-3-flash-preview';
                const imageModelName = data.imageModelName?.trim() || 'gemini-3-pro-image-preview';
                
                if (!apiKey) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'API key is required' }));
                    return;
                }
                
                const existingEnv = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf-8') : '';
                const envLines = existingEnv.split('\n').filter(line => 
                    !line.startsWith('GEMINI_API_KEY=') && 
                    !line.startsWith('GEMINI_MODEL_NAME=') && 
                    !line.startsWith('GEMINI_IMAGE_MODEL_NAME=')
                );
                
                envLines.unshift(`GEMINI_IMAGE_MODEL_NAME=${imageModelName}`);
                envLines.unshift(`GEMINI_MODEL_NAME=${modelName}`);
                envLines.unshift(`GEMINI_API_KEY=${apiKey}`);
                
                fs.writeFileSync('.env', envLines.join('\n'), 'utf-8');
                
                envConfig.GEMINI_API_KEY = apiKey;
                envConfig.GEMINI_MODEL_NAME = modelName;
                envConfig.GEMINI_IMAGE_MODEL_NAME = imageModelName;
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: true, 
                    message: '.env file created successfully' 
                }));
            } catch (error) {
                console.error('Error saving .env file:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        
        return;
    }
    
    
    if (req.url === '/save-image' && req.method === 'POST') {
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const imageData = data.imageData;
                const prompt = data.prompt || '';
                const aspectRatio = data.aspectRatio || '16:9';
                const imageSize = data.imageSize || '1K';
                const saveToDisk = data.saveToDisk !== false;
                
                console.log(`🧪 [DEBUG] saveToDisk 为 ${saveToDisk}，${saveToDisk ? '执行存盘' : '跳过存盘'}`);
                
                if (!imageData) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'No image data provided' }));
                    return;
                }
                
                if (!saveToDisk) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, skipped: true, message: '跳过存盘' }));
                    return;
                }
                
                const result = saveImage(imageData, prompt, aspectRatio, imageSize);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: true, 
                    ...result 
                }));
            } catch (error) {
                console.error('Error saving image:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        
        return;
    }

    if (req.url === '/save-video' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const { videoUrl, prompt, aspectRatio, duration, modelName } = data;
                
                if (!videoUrl) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'videoUrl is required' }));
                    return;
                }
                
                const result = await saveVideo(videoUrl, prompt, aspectRatio, duration, modelName);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: true, 
                    ...result 
                }));
            } catch (error) {
                console.error('Error saving video:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        return;
    }

    if (req.url === '/save-audio' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const { audioUrl, prompt, format, duration, modelName, saveToDisk = true } = data;
                
                if (!audioUrl) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'No audioUrl provided' }));
                    return;
                }
                
                if (!saveToDisk) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, skipped: true }));
                    return;
                }
                
                const result = await saveAudio(audioUrl, prompt, format, duration, modelName);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, ...result }));
            } catch (e) {
                console.error('Error in /save-audio:', e);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }
    
    if (req.url === '/open-folder' && req.method === 'POST') {
        const dateFolder = getDateFolder();
        const folderPath = path.resolve(path.join(GENERATED_IMAGES_DIR, dateFolder));
        
        try {
            ensureDirectoryExists(folderPath);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: true, 
                path: folderPath,
                message: `文件夹路径: ${folderPath}`
            }));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
        
        return;
    }
    
    // Google 全能代理网关 (处理生图、生文、生音等)
    if (req.url === '/api/google/proxy-command' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { apiKey, model, action, payload } = JSON.parse(body);
                // 根据 action 构造 URL (备用，默认通用 generateContent)
                const baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
                const apiUrl = `${baseUrl}/models/${model}:${action}?key=${apiKey}`;
                
                console.log(`[Google Proxy] [${action}] 转发请求至: ${model}`);
                
                const fetchOptions = {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                };

                const response = await fetch(apiUrl, fetchOptions);
                const result = await response.json();
                
                res.writeHead(response.status, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (e) {
                console.error('[Google Proxy] Error:', e);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    // Google 音频生成 API
    if (req.url === '/api/google/generate-audio' && req.method === 'POST') {
        console.log('>>> [SERVER] BACKEND RECEIVED AUDIO REQUEST AT:', new Date().toISOString());
        
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const { apiKey, model, prompt, format } = data;
                
                if (!apiKey || apiKey === 'none' || apiKey.trim() === '') {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: '前端未传递有效 API Key' }));
                    return;
                }

                console.log(`[Google Audio] 收到音频生成请求, 模型: ${model}, 格式: ${format}`);
                
                // 构造多模态内容 Parts
                const parts = [];
                
                // 1. 添加图片数据 (如果是多模态请求)
                if (data.media && Array.isArray(data.media)) {
                    data.media.forEach(item => {
                        let base64Data = item.data;
                        let mimeType = item.mimeType || 'image/jpeg';
                        
                        // 清理 base64
                        if (base64Data.includes(',')) {
                            base64Data = base64Data.split(',')[1];
                        }
                        
                        parts.push({
                            inline_data: {
                                data: base64Data,
                                mime_type: mimeType
                            }
                        });
                    });
                }
                
                // 2. 添加文本提示
                parts.push({ "text": prompt });
                
                // 构建符合官方文档的请求体
                const googlePayload = {
                    "contents": [{
                        "parts": parts
                    }],
                    "generationConfig": {
                        "responseModalities": ["AUDIO", "TEXT"]
                        // 移除 responseMimeType，Google Lyria 3 会报错
                    }
                };

                const baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
                const apiUrl = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;
                
                console.log(`[Google Audio] 正在发送请求...`);
                
                const apiResponse = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(googlePayload)
                });

                if (!apiResponse.ok) {
                    const errorText = await apiResponse.text();
                    console.error('[Google Audio] API Error:', errorText);
                    res.writeHead(apiResponse.status, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: errorText }));
                    return;
                }

                const result = await apiResponse.json();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (error) {
                console.error('[Google Audio] 生成失败:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        return;
    }

    // Google Veo 视频生成 API
    if (req.url === '/api/google/generate-video' && req.method === 'POST') {
        console.log('>>> [SERVER] BACKEND RECEIVED REQUEST AT:', new Date().toISOString());
        
        if (!GoogleGenAI) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Google GenAI SDK not installed. Run: npm install @google/genai' }));
            return;
        }
        
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const { apiKey, model, instances, parameters, payload: legacyPayload } = data;
                
                // 自动纠正前端发来的套娃结构
                const finalInstances = instances || (legacyPayload ? legacyPayload.instances : null);
                const finalParameters = parameters || (legacyPayload ? legacyPayload.parameters : {});
                
                if (!finalInstances) {
                    throw new Error('Request must contain instances');
                }

                // 准备发往 Google 的根对象
                const googlePayload = {
                    instances: finalInstances,
                    parameters: finalParameters || {}
                };
                
                // 安全审计：检查前端传来的 apiKey
                if (!apiKey || apiKey === 'none' || apiKey.trim() === '') {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: '前端未传递有效 API Key' }));
                    return;
                }
                
                console.log(`[Google Veo] 收到视频生成请求, 模型: ${model}, API Key: ${apiKey.substring(0, 10)}...`);
                
                const requestId = Math.random().toString(36).substring(2, 15);
                const startTime = Date.now();
                console.log(`[Google Veo] [${requestId}] 开始调用 Google SDK, 时间: ${startTime}`);
                
                // 准备开始
                
                // 调试：检查 SDK 状态
                console.log(`[Google Veo] [${requestId}] SDK 准备就绪，遵循系统代理配置`);
                
                // 超时保护：30秒超时
                const TIMEOUT_MS = 30000;
                let timeoutHandle;
                const timeoutPromise = new Promise((_, reject) => {
                    timeoutHandle = setTimeout(() => {
                        reject(new Error(`请求超时 (${TIMEOUT_MS/1000}秒): Google API 响应超时`));
                    }, TIMEOUT_MS);
                });
                
                let operation;
                try {
                    // --- 极简直连方案 ---
                    // 构造符合 SDK 预期的预测请求
                    
                    // 使用原生 fetch 发起请求
                    const baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
                    const apiUrl = `${baseUrl}/models/${model}:predictLongRunning?key=${apiKey}`;
                    
                    const fetchOptions = {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(googlePayload)
                    };

                    console.log(`[Google Veo] [${requestId}] 正在通过直连启动生成任务...`);
                    const apiResponse = await Promise.race([
                        fetch(apiUrl, fetchOptions),
                        timeoutPromise
                    ]);
                    
                    clearTimeout(timeoutHandle);

                    if (!apiResponse.ok) {
                        const errorText = await apiResponse.text();
                        throw new Error(`Google API (${apiResponse.status}): ${errorText}`);
                    }

                    operation = await apiResponse.json();
                } catch (error) {
                    clearTimeout(timeoutHandle);
                    throw error;
                }
                
                const endTime = Date.now();
                const elapsed = endTime - startTime;
                console.log(`[Google Veo] [${requestId}] Google SDK 调用完成, 耗时: ${elapsed}ms`);
                
                // 打印 operation 对象用于调试
                console.log('[Google Veo] Operation created:', JSON.stringify(operation, null, 2));
                
                const operationName = operation.name;
                
                // 保存 operation 信息用于后续查询
                const operationFile = path.join(GENERATED_IMAGES_DIR, 'video-operations.json');
                let operations = {};
                if (fs.existsSync(operationFile)) {
                    operations = JSON.parse(fs.readFileSync(operationFile, 'utf-8'));
                }
                operations[operationName] = {
                    createdAt: new Date().toISOString(),
                    model: model,
                    prompt: (finalInstances && finalInstances[0]) ? finalInstances[0].prompt : (data.prompt || ''),
                    apiKey: apiKey
                };
                fs.writeFileSync(operationFile, JSON.stringify(operations, null, 2));
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: true,
                    operationName: operationName
                }));
            } catch (error) {
                console.error('Error generating video:', error);
                // 打印完整错误对象用于调试
                console.error('[Google Veo] 完整错误:', JSON.stringify(error, null, 2));
                
                // 穿透 Google 返回的真实状态码和完整响应
                const statusCode = error.status || error.statusCode || 500;
                
                // 尝试多种方式获取 response 和 headers
                let errorResponse = null;
                let errorHeaders = null;
                
                if (error.response) {
                    errorResponse = error.response;
                    // 尝试多种方式获取 headers
                    if (error.response.headers) {
                        errorHeaders = {};
                        error.response.headers.forEach((value, key) => {
                            errorHeaders[key] = value;
                        });
                    } else if (error.response._headers) {
                        errorHeaders = error.response._headers;
                    }
                } else if (error.error) {
                    // 有时错误嵌套在 error 对象中
                    errorResponse = error.error;
                    if (error.error.response) {
                        errorHeaders = error.error.response.headers || error.error.response._headers;
                    }
                }
                
                console.error('[Google Veo] 状态码:', statusCode);
                console.error('[Google Veo] 响应头:', JSON.stringify(errorHeaders, null, 2));
                
                // 检查是否有 Google 特定的 header
                let hasGoogleHeader = false;
                if (errorHeaders) {
                    const googHeaders = {};
                    Object.keys(errorHeaders).forEach(key => {
                        if (key.startsWith('x-goog') || key.includes('ratelimit')) {
                            googHeaders[key] = errorHeaders[key];
                            hasGoogleHeader = true;
                        }
                    });
                    console.error('[Google Veo] Google 特定 Header:', JSON.stringify(googHeaders, null, 2));
                }
                
                // 关键判断：是否有 Google 官方 Header
                if (!hasGoogleHeader) {
                    console.error('⚠️ 警告: 响应头中没有 Google 官方标志 (x-goog-*)，可能是本地拦截或缓存！');
                    
                    // 网络诊断
                    const errorMsg = error.message || '';
                    if (errorMsg.includes('ECONNREFUSED') || errorMsg.includes('ETIMEDOUT') || errorMsg.includes('timeout') || errorMsg.includes('ENOTFOUND')) {
                        console.error('🔍 网络诊断: 检测到网络错误，可能无法访问 Google API');
                        console.error('🔍 建议: 请确保 HTTP_PROXY 环境变量已配置');
                    }
                } else {
                    console.error('✅ 确认: 响应来自 Google 官方 API');
                }
                
                res.writeHead(statusCode, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    error: error.message, 
                    status: statusCode,
                    response: errorResponse,
                    headers: errorHeaders
                }));
            }
        });
        
        return;
    }
    
    // 获取所有视频操作任务列表
    if (req.url === '/api/google/list-operations' && req.method === 'GET') {
        const operationFile = path.join(GENERATED_IMAGES_DIR, 'video-operations.json');
        let operations = {};
        if (fs.existsSync(operationFile)) {
            try {
                operations = JSON.parse(fs.readFileSync(operationFile, 'utf-8'));
            } catch (e) {
                console.error('Error reading operations file:', e);
            }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(operations));
        return;
    }

    // Google Veo 视频生成状态查询 API
    if (req.url.startsWith('/api/google/video-status') && req.method === 'GET') {
        if (!GoogleGenAI) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Google GenAI SDK not installed' }));
            return;
        }
        
        (async () => {
            try {
                const url = new URL(req.url, `http://localhost:${PORT}`);
                const operationName = url.searchParams.get('operation');
                
                if (!operationName) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Operation name is required' }));
                    return;
                }
                
                // 从保存的 operation 中获取 apiKey
                const operationFile = path.join(GENERATED_IMAGES_DIR, 'video-operations.json');
                let operations = {};
                if (fs.existsSync(operationFile)) {
                    operations = JSON.parse(fs.readFileSync(operationFile, 'utf-8'));
                }
                const operationInfo = operations[operationName];
                const apiKey = operationInfo?.apiKey;
                
                if (!apiKey) {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: '未找到该 Operation 的 API Key，请重新生成视频' }));
                    return;
                }
                
                // 使用保存的 apiKey 查询状态
                const statusUrl = `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`;
                
                console.log('[Google Veo] Querying status for:', operationName);
                
                const statusResponse = await fetch(statusUrl);
                
                if (!statusResponse.ok) {
                    const errorText = await statusResponse.text();
                    console.error('[Google Veo] Status query failed:', errorText);
                    // 穿透 Google 返回的真实状态码
                    const googleStatus = statusResponse.status;
                    res.writeHead(googleStatus, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: errorText, status: googleStatus }));
                    return;
                }
                
                const operation = await statusResponse.json();
                
                // 打印 operation 对象用于调试
                console.log('[Google Veo] Operation status:', JSON.stringify(operation, null, 2));
                
                const response = {
                    done: operation.done || false
                };
                
                if (operation.done) {
                    if (operation.error) {
                        response.error = operation.error;
                    } else if (operation.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri) {
                        const videoUri = operation.response.generateVideoResponse.generatedSamples[0].video.uri;
                        response.videoUrl = `${videoUri}&key=${apiKey}`;
                    } else if (operation.response?.generatedVideos?.[0]?.video?.uri) {
                        const videoUri = operation.response.generatedVideos[0].video.uri;
                        response.videoUrl = `${videoUri}&key=${apiKey}`;
                    }
                }

                // 处理保存到磁盘逻辑
                const urlObj = new URL(req.url, `http://localhost:${PORT}`);
                const saveToDisk = urlObj.searchParams.get('saveToDisk') === 'true';
                
                console.log(`🧪 [DEBUG] saveToDisk 为 ${saveToDisk}，${saveToDisk ? '执行存盘' : '跳过存盘'}`);
                
                if (saveToDisk && response.videoUrl) {
                    try {
                        const timestamp = Date.now();
                        const videoFileName = `video_${timestamp}.mp4`;
                        const videoFilePath = path.join(GENERATED_VIDEOS_DIR, videoFileName);
                        
                        // 确保目录存在
                        if (!fs.existsSync(GENERATED_VIDEOS_DIR)) {
                            fs.mkdirSync(GENERATED_VIDEOS_DIR, { recursive: true });
                        }
                        
                        // 下载视频
                        const videoResponse = await fetch(response.videoUrl);
                        const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
                        fs.writeFileSync(videoFilePath, videoBuffer);
                        
                        response.savedPath = `/DL/videos/${videoFileName}`;
                        console.log(`[Video] 视频已保存到: ${videoFilePath}`);
                    } catch (writeError) {
                        console.error('[Video] 保存失败:', writeError.message);
                        response.warn = 'write_failed';
                    }
                }
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(response));
            } catch (error) {
                console.error('Error checking video status:', error);
                // 穿透真实错误状态码
                const statusCode = error.status || error.statusCode || 500;
                res.writeHead(statusCode, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message, status: statusCode }));
            }
        })();
        
        return;
    }
    
    // 火山方舟视频生成 API
    if (req.url === '/api/volces/generate-video' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const { apiKey, model, prompt, images = [], aspectRatio, duration, resolution } = data;
                
                if (!apiKey) {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'API Key is required' }));
                    return;
                }

                console.log(`[Volces] 收到视频生成请求, 模型: ${model}, 比例: ${aspectRatio}, 时长: ${duration}`);
                
                const payload = {
                    model: model,
                    content: data.content || { texts: [{ text: prompt }] },
                    ratio: aspectRatio || "16:9",
                    duration: parseInt(duration) || 5,
                    resolution: resolution || "720p"
                };

                // 如果没有显式传 content 但传了 images，则按 1.0 逻辑兜底
                if (!data.content && images && images.length > 0) {
                    payload.content.images = images.map(url => ({ url }));
                }

                const arkResponse = await fetch('https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify(payload)
                });

                const responseData = await arkResponse.json();
                if (!arkResponse.ok) {
                    throw new Error(responseData.error?.message || `Ark API Error: ${arkResponse.status}`);
                }

                const taskId = responseData.id;

                // 保存元数据
                const operationFile = path.join(GENERATED_IMAGES_DIR, 'video-operations.json');
                let operations = {};
                if (fs.existsSync(operationFile)) {
                    operations = JSON.parse(fs.readFileSync(operationFile, 'utf-8'));
                }
                operations[taskId] = {
                    provider: 'volces',
                    createdAt: new Date().toISOString(),
                    model: model,
                    prompt: prompt,
                    apiKey: apiKey, // 用于后续状态轮询
                    aspectRatio: aspectRatio || "16:9",
                    duration: duration || "5",
                    resolution: resolution || "720p"
                };
                fs.writeFileSync(operationFile, JSON.stringify(operations, null, 2));

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, taskId: taskId }));
            } catch (error) {
                console.error('[Volces] Generate video error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        return;
    }

    // 火山方舟视频状态查询 API
    if (req.url.startsWith('/api/volces/video-status') && req.method === 'GET') {
        (async () => {
            try {
                const url = new URL(req.url, `http://localhost:${PORT}`);
                const taskId = url.searchParams.get('taskId');
                const saveToDisk = url.searchParams.get('saveToDisk') === 'true';

                if (!taskId) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Task ID is required' }));
                    return;
                }

                const operationFile = path.join(GENERATED_IMAGES_DIR, 'video-operations.json');
                let operations = {};
                if (fs.existsSync(operationFile)) {
                    operations = JSON.parse(fs.readFileSync(operationFile, 'utf-8'));
                }
                const opInfo = operations[taskId];
                if (!opInfo || !opInfo.apiKey) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Task metadata or API Key not found' }));
                    return;
                }

                const arkResponse = await fetch(`https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/${taskId}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${opInfo.apiKey}` }
                });

                if (!arkResponse.ok) {
                    throw new Error(`Ark Status Query Error: ${arkResponse.status}`);
                }

                const arkData = await arkResponse.json();
                const response = {
                    done: ['succeeded', 'failed', 'cancelled'].includes(arkData.status),
                    status: arkData.status,
                    progress: arkData.status === 'succeeded' ? 100 : (arkData.status === 'running' ? 50 : 0)
                };

                if (arkData.status === 'succeeded') {
                    // Seedance 2.0 官方文档显示在 content.video_url，部分 1.0 在 result.videos[0].url
                    response.videoUrl = arkData.content?.video_url || arkData.output?.video_url || arkData.result?.videos?.[0]?.url || arkData.response?.video_url;
                    
                    if (saveToDisk && response.videoUrl) {
                        try {
                            const resMode = opInfo.resolution || "720p";
                            const durMode = opInfo.duration || "5";
                            const ratioMode = opInfo.aspectRatio || "16:9";
                            const diskResult = await saveVideo(response.videoUrl, opInfo.prompt, ratioMode, durMode, opInfo.model);
                            response.savedPath = diskResult.path;
                            console.log(`[Volces] 视频已存盘: ${diskResult.path} (${resMode})`);
                        } catch (e) {
                            console.error('[Volces] 存盘失败:', e.message);
                            response.warn = 'write_failed';
                        }
                    }
                } else if (arkData.status === 'failed') {
                    response.error = { message: arkData.reason || '生成失败' };
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(response));
            } catch (error) {
                console.error('[Volces] Status error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        })();
        return;
    }

    // 视频代理 API - 用于避免 CORS 问题
    if (req.url.startsWith('/api/video-proxy') && req.method === 'GET') {
        (async () => {
            try {
                const url = new URL(req.url, `http://localhost:${PORT}`);
                const videoUrl = url.searchParams.get('url');
                
                if (!videoUrl) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Video URL is required' }));
                    return;
                }
                
                console.log('[Video Proxy] Fetching:', videoUrl);
                
                const response = await fetch(videoUrl);
                
                if (!response.ok) {
                    console.error('[Video Proxy] Fetch failed:', response.status);
                    res.writeHead(response.status, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: `Failed to fetch video: ${response.status}` }));
                    return;
                }
                
                const contentType = response.headers.get('content-type') || 'video/mp4';
                const contentLength = response.headers.get('content-length');
                
                res.writeHead(200, {
                    'Content-Type': contentType,
                    'Access-Control-Allow-Origin': '*',
                    ...(contentLength && { 'Content-Length': contentLength })
                });
                
                const reader = response.body.getReader();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    res.write(Buffer.from(value));
                }
                res.end();
                
                console.log('[Video Proxy] Stream completed');
            } catch (error) {
                console.error('[Video Proxy] Error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        })();
        
        return;
    }
    
    
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 Not Found</h1>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end('Server Error: ' + error.code, 'utf-8');
            }
        } else {
            if (filePath === './index.html') {
                delete require.cache[require.resolve('dotenv')];
                const dotenv = require('dotenv');
                dotenv.config();
                
                const currentEnvConfig = {
                    GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
                    GEMINI_MODEL_NAME: process.env.GEMINI_MODEL_NAME || 'gemini-3-flash-preview',
                    GEMINI_IMAGE_MODEL_NAME: process.env.GEMINI_IMAGE_MODEL_NAME || 'gemini-3-pro-image-preview'
                };
                
                const envScript = `<script>window.ENV = ${JSON.stringify(currentEnvConfig)};</script>`;
                const modifiedContent = content.toString().replace('</head>', `${envScript}</head>`);
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(modifiedContent, 'utf-8');
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content, 'utf-8');
            }
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    checkDiskWritePermission();
    console.log(`Server running at http://0.0.0.0:${PORT}/`);
    console.log(`Generated images will be saved to: ${path.resolve(GENERATED_IMAGES_DIR)}`);
    console.log(`Press Ctrl+C to stop the server`);
});