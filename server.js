const http = require('http');
const fs = require('fs');
const path = require('path');

// 加载环境变量
require('dotenv').config();

// Google GenAI SDK
let GoogleGenAI;
try {
    GoogleGenAI = require('@google/genai').GoogleGenAI;
} catch (e) {
    console.warn('[@google/genai] SDK not installed. Google Veo video generation will not be available.');
}

process.env.TZ = 'Asia/Shanghai';

// 代理配置：支持 HTTP_PROXY/HTTPS_PROXY 环境变量
const HTTP_PROXY = process.env.HTTP_PROXY || process.env.HTTPS_PROXY || process.env.http_proxy || process.env.https_proxy;
const USE_PROXY = !!HTTP_PROXY;

if (USE_PROXY) {
    console.log(`[Proxy] 已启用代理: ${HTTP_PROXY}`);
    process.env.HTTP_PROXY = HTTP_PROXY;
    process.env.HTTPS_PROXY = HTTP_PROXY;
    process.env.http_proxy = HTTP_PROXY;
    process.env.https_proxy = HTTP_PROXY;
}

const PORT = 8000;
const GENERATED_IMAGES_DIR = './DL';
const GENERATED_VIDEOS_DIR = './DL/videos';

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
    GEMINI_IMAGE_MODEL_NAME: process.env.GEMINI_IMAGE_MODEL_NAME || 'gemini-3-pro-image-preview',
    TWELVE_AI_API_KEY: process.env['12AI_API_KEY'] || '',
    TWELVE_AI_SELECTED_LINE: process.env['12AI_SELECTED_LINE'] || '1'
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
        path: filePath,
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
        path: filePath,
        fileName: fileName,
        txtFileName: txtFileName,
        dateFolder: dateFolder,
        videoNumber: videoNumber
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
            envConfig.TWELVE_AI_API_KEY = process.env['12AI_API_KEY'] || '';
            envConfig.TWELVE_AI_SELECTED_LINE = process.env['12AI_SELECTED_LINE'] || '1';
            
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
    
    if (req.url === '/save-env-12ai' && req.method === 'POST') {
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const apiKey = data.apiKey?.trim();
                const selectedLine = data.selectedLine || '1';
                
                if (!apiKey) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'API key is required' }));
                    return;
                }
                
                const existingEnv = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf-8') : '';
                const envLines = existingEnv.split('\n').filter(line => 
                    !line.startsWith('12AI_API_KEY=') && 
                    !line.startsWith('12AI_SELECTED_LINE=')
                );
                
                envLines.push(`12AI_API_KEY=${apiKey}`);
                envLines.push(`12AI_SELECTED_LINE=${selectedLine}`);
                
                fs.writeFileSync('.env', envLines.join('\n'), 'utf-8');
                
                envConfig.TWELVE_AI_API_KEY = apiKey;
                envConfig.TWELVE_AI_SELECTED_LINE = selectedLine;
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: true, 
                    message: '12AI config saved successfully' 
                }));
            } catch (error) {
                console.error('Error saving 12AI config:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        
        return;
    }
    
    if (req.url === '/clear-env-12ai' && req.method === 'POST') {
        try {
            const existingEnv = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf-8') : '';
            const envLines = existingEnv.split('\n').filter(line => 
                !line.startsWith('12AI_API_KEY=') && 
                !line.startsWith('12AI_SELECTED_LINE=')
            );
            
            envLines.push('12AI_API_KEY=');
            envLines.push('12AI_SELECTED_LINE=1');
            
            fs.writeFileSync('.env', envLines.join('\n'), 'utf-8');
            
            envConfig.TWELVE_AI_API_KEY = '';
            envConfig.TWELVE_AI_SELECTED_LINE = '1';
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: true, 
                message: '12AI config cleared successfully' 
            }));
        } catch (error) {
            console.error('Error clearing 12AI config:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
        
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
                // 严禁使用 process.env.GOOGLE_API_KEY 兜底，必须且仅能使用前端传来的 apiKey
                const apiKey = data.apiKey;
                const model = data.model;
                const prompt = data.prompt;
                const config = data.config;
                
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
                
                const googleAI = new GoogleGenAI({ apiKey: apiKey });
                
                // 调试：检查 SDK 版本和配置
                console.log(`[Google Veo] [${requestId}] SDK 初始化完成, 代理: ${USE_PROXY ? HTTP_PROXY : '无'}`);
                
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
                    operation = await Promise.race([
                        googleAI.models.generateVideos({
                            model: model,
                            prompt: prompt,
                            config: config
                        }),
                        timeoutPromise
                    ]);
                    clearTimeout(timeoutHandle);
                } catch (timeoutError) {
                    clearTimeout(timeoutHandle);
                    throw timeoutError;
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
                    prompt: prompt,
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
    
    // 视频保存 API
    if (req.url === '/api/save-video' && req.method === 'POST') {
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const { videoUrl, prompt, aspectRatio, duration, modelName } = data;
                
                if (!videoUrl) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Video URL is required' }));
                    return;
                }
                
                console.log('[Save Video] Saving video from:', videoUrl);
                
                const result = await saveVideo(videoUrl, prompt || '', aspectRatio || '16:9', duration || '6', modelName || '');
                
                console.log('[Save Video] Saved to:', result.path);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: true, 
                    ...result 
                }));
            } catch (error) {
                console.error('[Save Video] Error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        
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
                    GEMINI_IMAGE_MODEL_NAME: process.env.GEMINI_IMAGE_MODEL_NAME || 'gemini-3-pro-image-preview',
                    '12AI_API_KEY': process.env['12AI_API_KEY'] || '',
                    '12AI_SELECTED_LINE': process.env['12AI_SELECTED_LINE'] || '1'
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