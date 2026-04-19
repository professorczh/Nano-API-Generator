const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT_DIR = path.resolve(__dirname, '..');
const DL_DIR = path.join(ROOT_DIR, 'DL');
const ASSETS_DIR = path.join(DL_DIR, 'assets');
const MANIFEST_FILE = path.join(ASSETS_DIR, '_manifest.json');
const ALIASES_FILE = path.join(ASSETS_DIR, '_aliases.json');

const MEDIA_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.mp4', '.webm', '.mp3', '.wav', '.ogg', '.m4a']);
const DATE_FOLDER_REGEX = /^\d{8}$/;

function calcHash(filePath) {
    const buffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

function processDir(dirPath, relBase, manifest, aliases) {
    if (!fs.existsSync(dirPath)) return;
    const entries = fs.readdirSync(dirPath);
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry);
        const relPath = relBase ? `${relBase}/${entry}` : entry;
        
        if (fs.statSync(fullPath).isDirectory()) {
            if (!relBase && DATE_FOLDER_REGEX.test(entry)) {
                processDir(fullPath, entry, manifest, aliases);
            } else if (relBase) {
                processDir(fullPath, relPath, manifest, aliases);
            }
        } else {
            const ext = path.extname(entry).toLowerCase();
            if (!MEDIA_EXTENSIONS.has(ext)) continue;

            const hash = calcHash(fullPath);
            if (manifest[hash]) {
                aliases[relPath] = manifest[hash];
            }
        }
    }
}

function main() {
    if (!fs.existsSync(MANIFEST_FILE)) {
        console.error('No _manifest.json found. Run migration script first.');
        process.exit(1);
    }
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf-8'));
    const aliases = {};

    console.log('Building alias map...');
    
    // Process root DL_DIR for date folders
    const rootEntries = fs.readdirSync(DL_DIR);
    for (const entry of rootEntries) {
        const fullPath = path.join(DL_DIR, entry);
        if (fs.statSync(fullPath).isDirectory()) {
            if (DATE_FOLDER_REGEX.test(entry)) {
                processDir(fullPath, entry, manifest, aliases);
            }
        }
    }
    
    processDir(path.join(DL_DIR, 'uploads'), 'uploads', manifest, aliases);
    processDir(path.join(DL_DIR, 'videos'), 'videos', manifest, aliases);
    processDir(path.join(DL_DIR, 'audio'), 'audio', manifest, aliases);
    
    fs.writeFileSync(ALIASES_FILE, JSON.stringify(aliases, null, 2), 'utf-8');
    console.log(`Generated ^_aliases.json with ${Object.keys(aliases).length} mappings.`);
}

main();
