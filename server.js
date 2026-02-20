const http = require('http');
const fs = require('fs');
const path = require('path');

// 加载环境变量
require('dotenv').config();

process.env.TZ = 'Asia/Shanghai';

const PORT = 8000;
const GENERATED_IMAGES_DIR = './DL';

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
        path: filePath,
        fileName: fileName,
        txtFileName: txtFileName,
        dateFolder: dateFolder,
        imageNumber: imageNumber
    };
}

const server = http.createServer((req, res) => {
    if (req.url === '/clear-env' && req.method === 'POST') {
        try {
            const envContent = `GEMINI_API_KEY=\nGEMINI_MODEL_NAME=gemini-3-flash-preview\nGEMINI_IMAGE_MODEL_NAME=gemini-3-pro-image-preview\n`;
            fs.writeFileSync('.env', envContent, 'utf-8');
            
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
                
                const envContent = `GEMINI_API_KEY=${apiKey}\nGEMINI_MODEL_NAME=${modelName}\nGEMINI_IMAGE_MODEL_NAME=${imageModelName}\n`;
                fs.writeFileSync('.env', envContent, 'utf-8');
                
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
    console.log(`Server running at http://0.0.0.0:${PORT}/`);
    console.log(`Generated images will be saved to: ${path.resolve(GENERATED_IMAGES_DIR)}`);
    console.log(`Press Ctrl+C to stop the server`);
});