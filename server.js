const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');

// =============================================================
// V2 Legacy Alias Cache 
// =============================================================
let legacyAliasesCache = null;
function getLegacyAliases() {
    if (legacyAliasesCache) return legacyAliasesCache;
    const aliasesPath = path.join(__dirname, 'DL', 'assets', '_aliases.json');
    if (fs.existsSync(aliasesPath)) {
        try {
            legacyAliasesCache = JSON.parse(fs.readFileSync(aliasesPath, 'utf8'));
            return legacyAliasesCache;
        } catch (e) {
            console.error('[AliasRouter] Failed to parse _aliases.json');
        }
    }
    return {};
}

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

// ── V1 路径常量（保留，用于文件服务兼容）
const GENERATED_IMAGES_DIR = './DL';
const GENERATED_VIDEOS_DIR = './DL/videos';
const GENERATED_AUDIO_DIR = './DL/audio';
const UPLOADS_DIR = './DL/uploads';
const THUMBNAILS_DIR = './DL/thumbnails';

// ── V2 路径常量
const DL_ROOT = './DL';
const GLOBAL_ASSETS_DIR = './DL/assets';     // 全局哈希池（★ 项目删除时严禁触碰此目录）
const DEFAULT_USER_ID = 'admin';
const DEFAULT_PROJECT_ID = 'default';

/**
 * V2: 获取项目目录路径
 */
function getProjectDir(userId = DEFAULT_USER_ID, projectId = DEFAULT_PROJECT_ID) {
    return path.join(DL_ROOT, userId, 'projects', projectId);
}

/**
 * V2: 确保项目目录存在，并返回路径
 */
function ensureProjectDir(userId = DEFAULT_USER_ID, projectId = DEFAULT_PROJECT_ID) {
    const dir = getProjectDir(userId, projectId);
    ensureDirectoryExists(dir);
    return dir;
}

/**
 * V2: 哈希去重核心 — 将 buffer 存入全局资产池
 * 如果已存在相同内容，直接返回现有路径（零写入）
 * @returns { hash, assetPath, relativePath, reused }
 */
function resolveAssetPath(buffer, ext) {
    ensureDirectoryExists(GLOBAL_ASSETS_DIR);
    const hash = calculateHash(buffer);
    const manifestPath = path.join(GLOBAL_ASSETS_DIR, '_manifest.json');

    // 读取 manifest
    let manifest = {};
    if (fs.existsSync(manifestPath)) {
        try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')); } catch (e) {}
    }

    const cleanExt = ext.startsWith('.') ? ext : `.${ext}`;
    const fileName = `${hash}${cleanExt}`;
    const assetPath = path.join(GLOBAL_ASSETS_DIR, fileName);
    const relativePath = `assets/${fileName}`; // 相对于 DL/ 的路径（供前端访问）

    if (manifest[hash]) {
        console.log(`♻️ [AssetPool] Hash 命中，复用: ${relativePath}`);
        return { hash, assetPath: path.join(GLOBAL_ASSETS_DIR, path.basename(manifest[hash])), relativePath: manifest[hash], reused: true };
    }

    // 写入文件
    fs.writeFileSync(assetPath, buffer);
    manifest[hash] = relativePath;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`💾 [AssetPool] 新资产入库: ${relativePath}`);
    return { hash, assetPath, relativePath, reused: false };
}

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
    '.ico': 'image/x-icon',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm'
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

/**
 * 计算文件哈希 (SHA-256)
 */
function calculateHash(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * 使用 FFmpeg 生成视频缩略图 (提取第1秒)
 */
function generateThumbnail(videoPath, thumbFileName) {
    return new Promise((resolve, reject) => {
        ensureDirectoryExists(THUMBNAILS_DIR);
        const thumbPath = path.join(THUMBNAILS_DIR, thumbFileName);
        
        // 如果缩略图已存在，跳过
        if (fs.existsSync(thumbPath)) return resolve(thumbPath);

        const cmd = `ffmpeg -i "${videoPath}" -ss 00:00:01 -vframes 1 -f image2 -y "${thumbPath}"`;
        exec(cmd, (error) => {
            if (error) {
                console.error(`❌ [FFmpeg] 缩略图生成失败: ${error.message}`);
                return reject(error);
            }
            console.log(`🖼️ [FFmpeg] 缩略图生成成功: ${thumbFileName}`);
            resolve(thumbPath);
        });
    });
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

function appendToHistory(record, metadata = {}, userId = DEFAULT_USER_ID, projectId = DEFAULT_PROJECT_ID) {
    // V2: 写入项目专属目录；同时向根目录写一份 V1 兼容副本
    const projectDir = ensureProjectDir(userId, projectId);
    const projectHistoryPath = path.join(projectDir, 'history.jsonl');
    const v1HistoryPath = path.join(GENERATED_IMAGES_DIR, 'history.jsonl'); // V1 兼容

    const line = JSON.stringify({
        timestamp: new Date().toISOString(),
        projectId,
        userId,
        ...record,
        metadata: metadata
    }) + '\n';
    try {
        fs.appendFileSync(projectHistoryPath, line, 'utf-8');
        fs.appendFileSync(v1HistoryPath, line, 'utf-8'); // 保持 V1 向后兼容
        console.log(`📜 [History] 记录写入项目[${projectId}]: ${record.filename || record.path}`);
    } catch (err) {
        console.error('[HistoryLog] 写入失败:', err);
    }
}

function saveImage(base64Data, prompt, aspectRatio, imageSize, metadata = {}, generationTime = 0) {
    const now = new Date();
    const dateFolder = getDateFolder();

    // V2: 写入全局哈希池
    const buffer = Buffer.from(base64Data, 'base64');
    const asset = resolveAssetPath(buffer, '.png');

    // V1 兼容：同时保留日期目录副本（供历史文件服务读取）
    const imageNumber = getNextImageNumber(dateFolder);
    const timeStr = String(now.getHours()).padStart(2, '0') +
                   String(now.getMinutes()).padStart(2, '0') +
                   String(now.getSeconds()).padStart(2, '0');
    const cleanPrompt = prompt.trim().substring(0, 20).replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '') || '未命名';
    const cleanAspectRatio = aspectRatio.replace(/:/g, 'x');
    const fileName = `${String(imageNumber).padStart(2, '0')}_${cleanPrompt}_${timeStr}_${cleanAspectRatio}_${imageSize}.png`;
    const folderPath = path.join(GENERATED_IMAGES_DIR, dateFolder);
    const filePath = path.join(folderPath, fileName);

    if (!asset.reused) {
        ensureDirectoryExists(folderPath);
        fs.writeFileSync(filePath, buffer); // 保留原始风格副本
    }

    const userId = metadata?.userId || DEFAULT_USER_ID;
    const projectId = metadata?.projectId || DEFAULT_PROJECT_ID;

    appendToHistory({
        type: 'image',
        filename: fileName,
        path: asset.relativePath, // V2: 指向哈希池
        v1_path: `${dateFolder}/${fileName}`,
        prompt: prompt,
        hash: asset.hash,
        generation_time: generationTime,
        params: { ratio: aspectRatio, size: imageSize, model: metadata.model || '' }
    }, metadata, userId, projectId);

    return {
        path: `/DL/${asset.relativePath}`,
        filename: fileName,
        dateFolder: dateFolder,
        imageNumber: imageNumber,
        resolution: imageSize,
        hash: asset.hash
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

async function saveVideo(videoUrl, prompt, aspectRatio, duration, modelName, protocol = 'google', metadata = {}, generationTime = 0) {
    const now = new Date();
    const dateFolder = getDateFolder();
    const videoNumber = getNextVideoNumber(dateFolder);

    const timeStr = String(now.getHours()).padStart(2, '0') +
                   String(now.getMinutes()).padStart(2, '0') +
                   String(now.getSeconds()).padStart(2, '0');

    const cleanPrompt = prompt.trim().substring(0, 20).replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '') || '未命名';
    const cleanAspectRatio = aspectRatio.replace(/:/g, 'x');
    const fileName = `${String(videoNumber).padStart(2, '0')}_${cleanPrompt}_${timeStr}_${cleanAspectRatio}_${duration}s.mp4`;

    // V2: 下载并入全局哈希池
    const response = await fetch(videoUrl);
    if (!response.ok) throw new Error(`Failed to download video: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const asset = resolveAssetPath(buffer, '.mp4');

    // V1 兼容: 保留日期目录副本
    const folderPath = path.join(GENERATED_VIDEOS_DIR, dateFolder);
    const filePath = path.join(folderPath, fileName);
    if (!asset.reused) {
        ensureDirectoryExists(folderPath);
        fs.writeFileSync(filePath, buffer);
    }

    // 提取缩略图（从 V1 副本或哈希池文件提取）
    let thumbnailPath = null;
    const thumbSource = asset.reused ? asset.assetPath : filePath;
    try {
        const thumbFileName = `${path.basename(fileName, '.mp4')}.jpg`;
        await generateThumbnail(thumbSource, thumbFileName);
        thumbnailPath = `thumbnails/${thumbFileName}`;
    } catch (e) {
        console.error('[SaveVideo] Thumbnail failed:', e.message);
    }

    const userId = metadata?.userId || DEFAULT_USER_ID;
    const projectId = metadata?.projectId || DEFAULT_PROJECT_ID;

    appendToHistory({
        type: 'video',
        filename: fileName,
        path: asset.relativePath, // V2: 指向哈希池
        v1_path: `videos/${dateFolder}/${fileName}`,
        thumbnail: thumbnailPath,
        prompt: prompt,
        hash: asset.hash,
        generation_time: generationTime,
        params: { ratio: aspectRatio, duration: duration + 's', model: modelName, protocol: protocol }
    }, metadata, userId, projectId);

    return {
        path: `/DL/${asset.relativePath}`,
        fileName: fileName,
        dateFolder: dateFolder,
        videoNumber: videoNumber,
        hash: asset.hash
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

async function saveAudio(audioUrl, prompt, format, duration, modelName, lyrics = '', caption = '', metadata = {}, generationTime = 0) {
    const now = new Date();
    const dateFolder = getDateFolder();
    const audioNumber = getNextAudioNumber(dateFolder);

    const timeStr = String(now.getHours()).padStart(2, '0') +
                   String(now.getMinutes()).padStart(2, '0') +
                   String(now.getSeconds()).padStart(2, '0');

    const cleanPrompt = prompt.trim().substring(0, 20).replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '') || '未命名';
    const fileName = `${String(audioNumber).padStart(2, '0')}_${cleanPrompt}_${timeStr}_${duration}s.${format}`;

    // V2: 下载并入全局哈希池
    console.log(`[Audio Save] Downloading: ${audioUrl}`);
    const response = await fetch(audioUrl);
    if (!response.ok) throw new Error(`Failed to download audio: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const asset = resolveAssetPath(buffer, `.${format}`);

    // V1 兼容: 保留日期目录副本
    const folderPath = path.join(GENERATED_AUDIO_DIR, dateFolder);
    const filePath = path.join(folderPath, fileName);
    if (!asset.reused) {
        ensureDirectoryExists(folderPath);
        fs.writeFileSync(filePath, buffer);
    }

    const userId = metadata?.userId || DEFAULT_USER_ID;
    const projectId = metadata?.projectId || DEFAULT_PROJECT_ID;

    appendToHistory({
        type: 'audio',
        filename: fileName,
        path: asset.relativePath, // V2: 指向哈希池
        v1_path: `audio/${dateFolder}/${fileName}`,
        prompt: prompt,
        hash: asset.hash,
        generation_time: generationTime,
        params: { format, duration: duration + 's', model: modelName, lyrics: lyrics.substring(0, 100), caption }
    }, metadata, userId, projectId);

    return {
        path: `/DL/${asset.relativePath}`,
        fileName: fileName,
        dateFolder: dateFolder,
        audioNumber: audioNumber,
        hash: asset.hash
    };
}

const server = http.createServer((req, res) => {
    // API 路由
    if (req.url.startsWith('/api/')) {
        console.log(`[API] ${req.method} ${req.url}`);
    }

    // =============================================================
    // V2 项目初始化：首次访问自动创建默认项目
    // =============================================================
    if (req.url === '/api/project/init' && req.method === 'POST') {
        (async () => {
            try {
                let body = '';
                req.on('data', chunk => { body += chunk; });
                await new Promise(r => req.on('end', r));
                const data = body ? JSON.parse(body) : {};
                const userId = data.userId || DEFAULT_USER_ID;
                const projectId = data.projectId || DEFAULT_PROJECT_ID;

                const projectDir = ensureProjectDir(userId, projectId);
                const stateFile = path.join(projectDir, 'canvas_state.json');
                const historyFile = path.join(projectDir, 'history.jsonl');

                let isNew = false;
                if (!fs.existsSync(stateFile)) {
                    const defaultState = {
                        version: '2.0.0',
                        metadata: {
                            projectId,
                            projectName: data.projectName || '新建项目',
                            userId,
                            createdAt: new Date().toISOString(),
                            lastSavedAt: new Date().toISOString()
                        },
                        global: { scale: 1, pan: { x: 0, y: 0 } },
                        nodes: []
                    };
                    fs.writeFileSync(stateFile, JSON.stringify(defaultState, null, 2));
                    isNew = true;
                }

                // 确保 history.jsonl 存在
                if (!fs.existsSync(historyFile)) fs.writeFileSync(historyFile, '', 'utf-8');

                const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, isNew, projectId, userId, state }));
            } catch (err) {
                console.error('[ProjectInit] 失败:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        })();
        return;
    }

    // =============================================================
    // V2 项目状态持久化：读写 canvas_state.json
    // =============================================================
    if (req.url.startsWith('/api/project/state') && (req.method === 'GET' || req.method === 'POST')) {
        (async () => {
            try {
                const urlObj = new URL(req.url, `http://localhost:${PORT}`);
                const userId = urlObj.searchParams.get('userId') || req.headers['x-user-id'] || DEFAULT_USER_ID;
                const projectId = urlObj.searchParams.get('projectId') || req.headers['x-project-id'] || DEFAULT_PROJECT_ID;
                const projectDir = ensureProjectDir(userId, projectId);
                const stateFile = path.join(projectDir, 'canvas_state.json');

                if (req.method === 'GET') {
                    if (!fs.existsSync(stateFile)) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: '项目状态文件不存在' }));
                        return;
                    }
                    const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(state));
                } else {
                    // POST: 保存快照
                    let body = '';
                    req.on('data', chunk => { body += chunk; });
                    await new Promise(r => req.on('end', r));
                    const newState = JSON.parse(body);

                    // 确保 metadata 字段完整
                    if (!newState.metadata) newState.metadata = {};
                    newState.metadata.lastSavedAt = new Date().toISOString();
                    newState.metadata.projectId = projectId;
                    newState.metadata.userId = userId;
                    newState.version = '2.0.0';

                    fs.writeFileSync(stateFile, JSON.stringify(newState, null, 2));
                    console.log(`💾 [ProjectState] 快照已保存: ${projectId}`);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, savedAt: newState.metadata.lastSavedAt }));
                }
            } catch (err) {
                console.error('[ProjectState] 失败:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        })();
        return;
    }

    // =============================================================
    // V2 静默上传/重传端点：对接全局哈希池
    // =============================================================
    if (req.url === '/api/upload' && req.method === 'POST') {
        const userId = req.headers['x-user-id'] || DEFAULT_USER_ID;
        const projectId = req.headers['x-project-id'] || DEFAULT_PROJECT_ID;
        const filename = req.headers['x-filename'] || 'upload.bin';
        const ext = path.extname(filename) || '.bin';

        let chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => {
            try {
                const buffer = Buffer.concat(chunks);
                const asset = resolveAssetPath(buffer, ext);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    path: asset.relativePath,
                    hash: asset.hash,
                    reused: asset.reused
                }));
            } catch (err) {
                console.error('[Upload] 处理失败:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
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
                const metadata = data.metadata || {};
                const generationTime = data.generationTime || 0;
                
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
                
                const result = saveImage(imageData, prompt, aspectRatio, imageSize, metadata, generationTime);
                
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
                const { videoUrl, prompt, aspectRatio, duration, modelName, protocol, metadata = {}, generationTime = 0 } = data;
                
                if (!videoUrl) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'videoUrl is required' }));
                    return;
                }
                
                const result = await saveVideo(videoUrl, prompt, aspectRatio, duration, modelName, protocol, metadata, generationTime);
                
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
                const { audioUrl, prompt, format, duration, modelName, lyrics, caption, saveToDisk = true, metadata = {}, generationTime = 0 } = data;
                
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
                
                const result = await saveAudio(audioUrl, prompt, format, duration, modelName, lyrics, caption, metadata, generationTime);
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
                    apiKey: apiKey,
                    aspectRatio: data.aspectRatio || '16:9',
                    duration: data.duration || '5s'
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
                    } else {
                        // 尝试所有的 Google 视频路径可能
                        const candidateUri = 
                            operation.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ||
                            operation.response?.generatedVideos?.[0]?.video?.uri ||
                            operation.response?.videos?.[0]?.uri ||
                            (operation.response?.generateVideoResponse?.generatedSamples?.[0]?.uri); // 某些版本可能在这里
                            
                        if (candidateUri) {
                            response.videoUrl = candidateUri.includes('?') ? `${candidateUri}&key=${apiKey}` : `${candidateUri}?key=${apiKey}`;
                        } else {
                            console.error('[Google Veo] 完成但无法在响应中找到视频 URI. 完整响应:', JSON.stringify(operation.response, null, 2));
                        }
                    }
                }

                // 处理保存到磁盘逻辑
                const urlObj = new URL(req.url, `http://localhost:${PORT}`);
                const saveToDisk = urlObj.searchParams.get('saveToDisk') === 'true';
                
                if (saveToDisk && response.videoUrl) {
                    try {
                        const ratio = operationInfo?.aspectRatio || '16:9';
                        const dur = operationInfo?.duration || '5s';
                        const model = operationInfo?.model || 'veo';
                        const prompt = operationInfo?.prompt || 'Google Video';
                        
                        console.log(`[Google Veo] 正在通过统一入口执行归一化存盘...`);
                        const diskResult = await saveVideo(response.videoUrl, prompt, ratio, dur, model, 'google');
                        
                        response.savedPath = diskResult.path;
                        // 重要：如果存盘成功，直接让 videoUrl 指向本地，避免前端重复存盘
                        response.videoUrl = response.savedPath;
                        console.log(`[Google Veo] 归一化存盘成功: ${diskResult.path}`);
                    } catch (writeError) {
                        console.error('[Google Veo] 归一化存盘异常:', writeError.message);
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

    // 资产上传 API (Local-First 核心)
    if (req.url === '/api/upload' && req.method === 'POST') {
        (async () => {
            try {
                const chunks = [];
                for await (const chunk of req) {
                    chunks.push(chunk);
                }
                const buffer = Buffer.concat(chunks);
                const originalName = req.headers['x-filename'] || 'upload_file';
                const fileType = req.headers['content-type'] || 'application/octet-stream';
                
                // 1. 去重校验 (Hash Deduplication)
                const fileHash = calculateHash(buffer);
                const hashFilePath = path.join(GENERATED_IMAGES_DIR, 'file_hashes.json');
                let hashMap = {};
                if (fs.existsSync(hashFilePath)) {
                    hashMap = JSON.parse(fs.readFileSync(hashFilePath, 'utf-8'));
                }

                if (hashMap[fileHash]) {
                    console.log(`♻️ [Upload] Hash match found, reusing: ${hashMap[fileHash]}`);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                        success: true, 
                        path: hashMap[fileHash],
                        reused: true 
                    }));
                    return;
                }

                // 2. 存储文件
                const dateFolder = getDateFolder();
                const uploadSubDir = path.join(UPLOADS_DIR, dateFolder);
                ensureDirectoryExists(uploadSubDir);
                
                const ext = path.extname(originalName) || '.bin';
                const fileName = `${Date.now()}_${Math.random().toString(36).slice(-4)}${ext}`;
                const fullPath = path.join(uploadSubDir, fileName);
                const relativePath = path.join('uploads', dateFolder, fileName).replace(/\\/g, '/');

                fs.writeFileSync(fullPath, buffer);
                console.log(`💾 [Upload] Saved new file: ${relativePath}`);

                // 3. 记录哈希
                hashMap[fileHash] = relativePath;
                fs.writeFileSync(hashFilePath, JSON.stringify(hashMap, null, 2));

                // 4. 处理缩略图 (如果是视频)
                let thumbnailPath = null;
                if (fileType.startsWith('video/')) {
                    const thumbFileName = `${path.basename(fileName, ext)}.jpg`;
                    try {
                        const thumbResult = await generateThumbnail(fullPath, thumbFileName);
                        thumbnailPath = `thumbnails/${thumbFileName}`;
                    } catch (e) {
                        console.error('[Upload] Thumbnail generation failed, skipping.');
                    }
                }

                // 5. 记录到历史 (作为上传资产项)
                const record = {
                    type: fileType.split('/')[0] || 'file',
                    filename: originalName,
                    path: relativePath,
                    thumbnail: thumbnailPath,
                    is_upload: true,
                    hash: fileHash
                };
                appendToHistory(record);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: true, 
                    path: relativePath,
                    thumbnail: thumbnailPath,
                    hash: fileHash
                }));
            } catch (error) {
                console.error('[Upload] Error:', error);
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
    
    
    let decodedUrl = req.url;
    try {
        decodedUrl = decodeURIComponent(req.url);
    } catch (e) {
        console.error('[Server] URL Decode failed:', e);
    }
    
    let filePath = '.' + decodedUrl;
    if (filePath === './') {
        filePath = './index.html';
    }

    // =============================================================
    // V1 到 V2 的遗留路径兼容层 (支持用户安全删除旧文件夹)
    // =============================================================
    if (decodedUrl.startsWith('/DL/')) {
        const relativeDL = decodedUrl.substring(4); // 例如 "20260414/xxx.png" 或 "uploads/xxx.mp4"
        const aliases = getLegacyAliases();
        if (aliases[relativeDL]) {
            // 如果别名存在，强制将请求物理路径重定向为哈希池中的文件
            filePath = './DL/' + aliases[relativeDL];
        }
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