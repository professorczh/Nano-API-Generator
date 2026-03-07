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

const PORT = 8000;
const GENERATED_IMAGES_DIR = './DL';
const GENERATED_VIDEOS_DIR = './DL/videos';

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
        fileName: fileName,
        txtFileName: txtFileName,
        dateFolder: dateFolder,
        imageNumber: imageNumber
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
                
                if (!imageData) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'No image data provided' }));
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
                const { model, prompt, config } = data;
                
                if (!envConfig.GEMINI_API_KEY) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }));
                    return;
                }
                
                // 调用 Google GenAI API
                const googleAI = new GoogleGenAI({ apiKey: envConfig.GEMINI_API_KEY });
                
                const operation = await googleAI.models.generateVideos({
                    model: model,
                    prompt: prompt,
                    config: config
                });
                
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
                    prompt: prompt
                };
                fs.writeFileSync(operationFile, JSON.stringify(operations, null, 2));
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: true,
                    operationName: operationName
                }));
            } catch (error) {
                console.error('Error generating video:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
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
                
                if (!envConfig.GEMINI_API_KEY) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }));
                    return;
                }
                
                // 使用 REST API 查询状态（更可靠）
                const statusUrl = `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${envConfig.GEMINI_API_KEY}`;
                
                console.log('[Google Veo] Querying status for:', operationName);
                
                const statusResponse = await fetch(statusUrl);
                
                if (!statusResponse.ok) {
                    const errorText = await statusResponse.text();
                    console.error('[Google Veo] Status query failed:', errorText);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: `Status query failed: ${statusResponse.status}` }));
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
                        // REST API 返回格式 - 添加 API Key 用于下载
                        const videoUri = operation.response.generateVideoResponse.generatedSamples[0].video.uri;
                        response.videoUrl = `${videoUri}&key=${envConfig.GEMINI_API_KEY}`;
                    } else if (operation.response?.generatedVideos?.[0]?.video?.uri) {
                        // SDK 返回格式（备用）- 添加 API Key 用于下载
                        const videoUri = operation.response.generatedVideos[0].video.uri;
                        response.videoUrl = `${videoUri}&key=${envConfig.GEMINI_API_KEY}`;
                    }
                }
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(response));
            } catch (error) {
                console.error('Error checking video status:', error);
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
    console.log(`Server running at http://0.0.0.0:${PORT}/`);
    console.log(`Generated images will be saved to: ${path.resolve(GENERATED_IMAGES_DIR)}`);
    console.log(`Press Ctrl+C to stop the server`);
});