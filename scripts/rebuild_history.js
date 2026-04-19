const fs = require('fs');
const path = require('path');

const DL_DIR = './DL';
const OUTPUT_FILE = path.join(DL_DIR, 'history.jsonl');

console.log('🚀 [History Rebuild] Starting asset scan...');

function parseTxtContent(content) {
    const lines = content.split('\n').map(l => l.trim());
    const data = {};
    lines.forEach(line => {
        if (line.startsWith('提示词:')) data.prompt = line.replace('提示词:', '').trim();
        else if (line.startsWith('宽高比:')) data.ratio = line.replace('宽高比:', '').trim();
        else if (line.startsWith('分辨率:')) data.resolution = line.replace('分辨率:', '').trim();
        else if (line.startsWith('时长:')) data.duration = line.replace('时长:', '').trim();
        else if (line.startsWith('模型:')) data.model = line.replace('模型:', '').trim();
        else if (line.startsWith('协议:')) data.protocol = line.replace('协议:', '').trim();
        else if (line.startsWith('格式:')) data.format = line.replace('格式:', '').trim();
    });
    return data;
}

function processFolder(dir, type, relativePrefix = '') {
    if (!fs.existsSync(dir)) return [];
    
    const results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
        if (entry.isDirectory()) {
            // Recursively process date folders or sub-types
            const subResults = processFolder(path.join(dir, entry.name), type, path.join(relativePrefix, entry.name));
            results.push(...subResults);
            continue;
        }

        const ext = path.extname(entry.name).toLowerCase();
        const mediaExts = ['.png', '.mp4', '.mp3', '.wav'];
        
        if (mediaExts.includes(ext)) {
            const baseName = path.basename(entry.name, ext);
            const txtPath = path.join(dir, baseName + '.txt');
            
            let record = {
                timestamp: new Date(fs.statSync(path.join(dir, entry.name)).mtime).toISOString(),
                type: type === 'auto' ? (ext === '.png' ? 'image' : ext === '.mp4' ? 'video' : 'audio') : type,
                filename: entry.name,
                path: path.join(relativePrefix, entry.name).replace(/\\/g, '/'),
                prompt: baseName, // Default to filename if no TXT
                params: {}
            };

            if (fs.existsSync(txtPath)) {
                try {
                    const content = fs.readFileSync(txtPath, 'utf-8');
                    const parsed = parseTxtContent(content);
                    record.prompt = parsed.prompt || record.prompt;
                    record.params = {
                        ratio: parsed.ratio,
                        resolution: parsed.resolution,
                        duration: parsed.duration,
                        model: parsed.model,
                        protocol: parsed.protocol,
                        format: parsed.format || ext.replace('.', '')
                    };
                    // Clean up undefined params
                    Object.keys(record.params).forEach(key => record.params[key] === undefined && delete record.params[key]);
                } catch (e) {
                    console.error(`[Error] Failed to parse TXT for ${entry.name}:`, e.message);
                }
            }
            results.push(record);
        }
    }
    return results;
}

// 1. Scan Images (Root folders in DL)
const imageResults = [];
const dlEntries = fs.readdirSync(DL_DIR, { withFileTypes: true });
dlEntries.forEach(entry => {
    // Only process YYYYMMDD style folders in root
    if (entry.isDirectory() && /^\d{8}$/.test(entry.name)) {
        imageResults.push(...processFolder(path.join(DL_DIR, entry.name), 'image', entry.name));
    }
});

// 2. Scan Videos
const videoResults = processFolder(path.join(DL_DIR, 'videos'), 'video', 'videos');

// 3. Scan Audio
const audioResults = processFolder(path.join(DL_DIR, 'audio'), 'audio', 'audio');

const allRecords = [...imageResults, ...videoResults, ...audioResults];
allRecords.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

// Write to history.jsonl
const stream = fs.createWriteStream(OUTPUT_FILE, { encoding: 'utf-8' });
allRecords.forEach(record => {
    stream.write(JSON.stringify(record) + '\n');
});
stream.end();

console.log(`✅ [History Rebuild] Completed! Processed ${allRecords.length} assets.`);
console.log(`📂 Log saved to: ${OUTPUT_FILE}`);
