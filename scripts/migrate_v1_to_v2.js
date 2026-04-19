/**
 * ============================================================
 * Nano Generator - V1 to V2 Migration Tool
 * ============================================================
 * 策略: 【安全复制模式】仅复制，不删除原文件
 * 执行后: 请手动确认 ./DL/assets/ 内容无误后，再删除旧目录
 * 
 * 用法: node scripts/migrate_v1_to_v2.js [--dry-run]
 *   --dry-run: 仅模拟，不执行任何文件操作
 * ============================================================
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// ============================================================
// 配置常量
// ============================================================
const ROOT_DIR = path.resolve(__dirname, '..');
const DL_DIR = path.join(ROOT_DIR, 'DL');

// V1 旧目录
const V1_IMAGES_DIR = DL_DIR; // 图片直接在日期子目录下（如 DL/20260210/xxx.png）
const V1_UPLOADS_DIR = path.join(DL_DIR, 'uploads');
const V1_VIDEOS_DIR = path.join(DL_DIR, 'videos');
const V1_AUDIO_DIR = path.join(DL_DIR, 'audio');
const V1_HISTORY_FILE = path.join(DL_DIR, 'history.jsonl');

// V2 新目录
const GLOBAL_ASSETS_DIR = path.join(DL_DIR, 'assets');
const DEFAULT_USER_ID = 'admin';
const DEFAULT_PROJECT_ID = 'default';
const PROJECT_DIR = path.join(DL_DIR, DEFAULT_USER_ID, 'projects', DEFAULT_PROJECT_ID);
const NEW_HISTORY_FILE = path.join(PROJECT_DIR, 'history.jsonl');
const CANVAS_STATE_FILE = path.join(PROJECT_DIR, 'canvas_state.json');
const ASSET_MANIFEST_FILE = path.join(DL_DIR, 'assets', '_manifest.json');

// 日期文件夹格式（纯8位数字，如 20260210）
const DATE_FOLDER_REGEX = /^\d{8}$/;

// 支持的媒体扩展名
const MEDIA_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.mp4', '.webm', '.mp3', '.wav', '.ogg', '.m4a']);

// ============================================================
// 工具函数
// ============================================================
const isDryRun = process.argv.includes('--dry-run');

function log(level, msg) {
    const icons = { INFO: 'ℹ️', SUCCESS: '✅', WARN: '⚠️', ERROR: '❌', SKIP: '♻️', DRY: '🔵' };
    const prefix = isDryRun ? '[DRY-RUN] ' : '';
    console.log(`${icons[level] || '  '} ${prefix}${msg}`);
}

function ensureDir(dirPath) {
    if (!isDryRun && !fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        log('INFO', `创建目录: ${path.relative(ROOT_DIR, dirPath)}`);
    }
}

function calcHash(filePath) {
    const buffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

function getExtension(filePath) {
    return path.extname(filePath).toLowerCase();
}

// ============================================================
// 核心：将单个文件复制到全局哈希池
// 返回: { hash, assetPath, relativePath, alreadyExisted }
// ============================================================
function copyFileToAssetPool(srcPath, manifest) {
    const ext = getExtension(srcPath);
    if (!MEDIA_EXTENSIONS.has(ext)) return null; // 跳过非媒体文件（如 .txt）

    const hash = calcHash(srcPath);
    
    // 已存在于 manifest 中，直接复用
    if (manifest[hash]) {
        return { hash, relativePath: manifest[hash], alreadyExisted: true };
    }

    const destFileName = `${hash}${ext}`;
    const destPath = path.join(GLOBAL_ASSETS_DIR, destFileName);
    const relativePath = `assets/${destFileName}`; // 相对于 DL/ 的路径

    if (!isDryRun) {
        if (!fs.existsSync(destPath)) {
            fs.copyFileSync(srcPath, destPath);
        }
        manifest[hash] = relativePath;
    }

    return { hash, relativePath, alreadyExisted: false };
}

// ============================================================
// Phase 1: 扫描 V1 图片目录（日期子文件夹下的图片）
// ============================================================
function migrateImageDirs(manifest, pathRemap) {
    log('INFO', '--- Phase 1: 扫描旧图片目录 (DL/YYYYMMDD/) ---');
    
    const entries = fs.readdirSync(DL_DIR);
    let processed = 0, skipped = 0, deduped = 0;

    for (const entry of entries) {
        if (!DATE_FOLDER_REGEX.test(entry)) continue; // 只处理日期格式的文件夹
        
        const dateDirPath = path.join(DL_DIR, entry);
        const stat = fs.statSync(dateDirPath);
        if (!stat.isDirectory()) continue;

        const files = fs.readdirSync(dateDirPath);
        for (const file of files) {
            const srcPath = path.join(dateDirPath, file);
            if (!fs.statSync(srcPath).isFile()) continue;

            const ext = getExtension(srcPath);
            if (!MEDIA_EXTENSIONS.has(ext)) { skipped++; continue; }

            const result = copyFileToAssetPool(srcPath, manifest);
            if (!result) { skipped++; continue; }

            // 建立旧路径 -> 新路径 的映射表
            const oldRelativePath = `${entry}/${file}`;
            pathRemap[oldRelativePath] = result.relativePath;

            if (result.alreadyExisted) {
                deduped++;
                log('SKIP', `去重命中: ${oldRelativePath}`);
            } else {
                processed++;
                if (isDryRun) log('DRY', `将复制: ${oldRelativePath} → ${result.relativePath}`);
            }
        }
    }

    log('SUCCESS', `Phase 1 完成: 复制 ${processed} 个, 去重 ${deduped} 个, 跳过 ${skipped} 个`);
}

// ============================================================
// Phase 2: 扫描 uploads/ 目录
// ============================================================
function migrateUploadsDir(manifest, pathRemap) {
    log('INFO', '--- Phase 2: 扫描上传目录 (DL/uploads/) ---');
    if (!fs.existsSync(V1_UPLOADS_DIR)) { log('WARN', 'uploads/ 目录不存在，跳过'); return; }

    let processed = 0, deduped = 0, skipped = 0;
    
    function walkDir(dirPath, relBase) {
        const entries = fs.readdirSync(dirPath);
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry);
            const relPath = `${relBase}/${entry}`;
            if (fs.statSync(fullPath).isDirectory()) {
                walkDir(fullPath, relPath);
                continue;
            }
            const ext = getExtension(fullPath);
            if (!MEDIA_EXTENSIONS.has(ext)) { skipped++; continue; }

            const result = copyFileToAssetPool(fullPath, manifest);
            if (!result) { skipped++; continue; }

            pathRemap[relPath] = result.relativePath;
            if (result.alreadyExisted) { deduped++; } else { processed++; }
        }
    }

    walkDir(V1_UPLOADS_DIR, 'uploads');
    log('SUCCESS', `Phase 2 完成: 复制 ${processed} 个, 去重 ${deduped} 个, 跳过 ${skipped} 个`);
}

// ============================================================
// Phase 3: 扫描 videos/ 目录
// ============================================================
function migrateVideosDir(manifest, pathRemap) {
    log('INFO', '--- Phase 3: 扫描视频目录 (DL/videos/) ---');
    if (!fs.existsSync(V1_VIDEOS_DIR)) { log('WARN', 'videos/ 目录不存在，跳过'); return; }

    let processed = 0, deduped = 0, skipped = 0;

    function walkDir(dirPath, relBase) {
        for (const entry of fs.readdirSync(dirPath)) {
            const fullPath = path.join(dirPath, entry);
            const relPath = `${relBase}/${entry}`;
            if (fs.statSync(fullPath).isDirectory()) { walkDir(fullPath, relPath); continue; }
            const ext = getExtension(fullPath);
            if (!MEDIA_EXTENSIONS.has(ext)) { skipped++; continue; }
            const result = copyFileToAssetPool(fullPath, manifest);
            if (!result) { skipped++; continue; }
            pathRemap[relPath] = result.relativePath;
            if (result.alreadyExisted) { deduped++; } else { processed++; }
        }
    }

    walkDir(V1_VIDEOS_DIR, 'videos');
    log('SUCCESS', `Phase 3 完成: 复制 ${processed} 个, 去重 ${deduped} 个, 跳过 ${skipped} 个`);
}

// ============================================================
// Phase 4: 扫描 audio/ 目录
// ============================================================
function migrateAudioDir(manifest, pathRemap) {
    log('INFO', '--- Phase 4: 扫描音频目录 (DL/audio/) ---');
    if (!fs.existsSync(V1_AUDIO_DIR)) { log('WARN', 'audio/ 目录不存在，跳过'); return; }

    let processed = 0, deduped = 0, skipped = 0;

    function walkDir(dirPath, relBase) {
        for (const entry of fs.readdirSync(dirPath)) {
            const fullPath = path.join(dirPath, entry);
            const relPath = `${relBase}/${entry}`;
            if (fs.statSync(fullPath).isDirectory()) { walkDir(fullPath, relPath); continue; }
            const ext = getExtension(fullPath);
            if (!MEDIA_EXTENSIONS.has(ext)) { skipped++; continue; }
            const result = copyFileToAssetPool(fullPath, manifest);
            if (!result) { skipped++; continue; }
            pathRemap[relPath] = result.relativePath;
            if (result.alreadyExisted) { deduped++; } else { processed++; }
        }
    }

    walkDir(V1_AUDIO_DIR, 'audio');
    log('SUCCESS', `Phase 4 完成: 复制 ${processed} 个, 去重 ${deduped} 个, 跳过 ${skipped} 个`);
}

// ============================================================
// Phase 5: 重写 history.jsonl → 迁移到新项目目录
// ============================================================
function migrateHistoryFile(pathRemap) {
    log('INFO', '--- Phase 5: 重写 history.jsonl ---');
    
    if (!fs.existsSync(V1_HISTORY_FILE)) {
        log('WARN', '旧 history.jsonl 不存在，跳过');
        return 0;
    }

    const rawLines = fs.readFileSync(V1_HISTORY_FILE, 'utf-8').split('\n').filter(l => l.trim());
    let rewrote = 0, failed = 0;
    const newLines = [];

    for (const line of rawLines) {
        try {
            const record = JSON.parse(line);
            
            // 重写 path 字段
            if (record.path && pathRemap[record.path]) {
                record.path = pathRemap[record.path];
                record._migrated = true;
                record._migration_version = 'v2.0';
            } else if (record.path) {
                // 无法映射的路径，保留原样并标注
                record._migration_unresolved = true;
                log('WARN', `无法解析路径: ${record.path} (记录已保留，路径未变)`);
                failed++;
            }

            newLines.push(JSON.stringify(record));
            rewrote++;
        } catch (e) {
            log('ERROR', `解析 history 记录失败: ${line.slice(0, 60)}...`);
        }
    }

    if (!isDryRun) {
        ensureDir(PROJECT_DIR);
        fs.writeFileSync(NEW_HISTORY_FILE, newLines.join('\n') + '\n', 'utf-8');
    } else {
        log('DRY', `将写入: ${path.relative(ROOT_DIR, NEW_HISTORY_FILE)} (${rewrote} 条记录)`);
    }

    log('SUCCESS', `Phase 5 完成: 成功 ${rewrote} 条, 路径未解析 ${failed} 条`);
    return rewrote;
}

// ============================================================
// Phase 6: 创建默认项目 canvas_state.json
// ============================================================
function createDefaultProjectState() {
    log('INFO', '--- Phase 6: 初始化默认项目状态文件 ---');

    const canvasState = {
        version: "2.0.0",
        metadata: {
            projectId: DEFAULT_PROJECT_ID,
            projectName: "Default Project",
            userId: DEFAULT_USER_ID,
            createdAt: new Date().toISOString(),
            lastSavedAt: new Date().toISOString(),
            migrated_from: "v1.0",
            migration_date: new Date().toISOString()
        },
        global: {
            scale: 1,
            pan: { x: 0, y: 0 }
        },
        nodes: [] // 空画布，用户可通过"历史记录"一键复用旧资产
    };

    if (!isDryRun) {
        ensureDir(PROJECT_DIR);
        if (!fs.existsSync(CANVAS_STATE_FILE)) {
            fs.writeFileSync(CANVAS_STATE_FILE, JSON.stringify(canvasState, null, 2), 'utf-8');
            log('SUCCESS', `创建: ${path.relative(ROOT_DIR, CANVAS_STATE_FILE)}`);
        } else {
            log('SKIP', `canvas_state.json 已存在，跳过`);
        }
    } else {
        log('DRY', `将创建: ${path.relative(ROOT_DIR, CANVAS_STATE_FILE)}`);
    }
}

// ============================================================
// Phase 7: 保存资产 Manifest 和迁移报告
// ============================================================
function saveMigrationReport(manifest, pathRemap) {
    // 保存 manifest（hash -> relativePath）
    if (!isDryRun) {
        fs.writeFileSync(ASSET_MANIFEST_FILE, JSON.stringify(manifest, null, 2), 'utf-8');
    }

    // 生成报告
    const report = {
        migration_date: new Date().toISOString(),
        strategy: 'copy_only',
        total_assets_processed: Object.keys(pathRemap).length,
        unique_assets_in_pool: Object.keys(manifest).length,
        deduplication_savings: Object.keys(pathRemap).length - Object.keys(manifest).length,
        path_remap_sample: Object.entries(pathRemap).slice(0, 5).map(([old, newP]) => ({ old, new: newP }))
    };

    const reportFile = path.join(PROJECT_DIR, '_migration_report.json');
    if (!isDryRun) {
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), 'utf-8');
    }

    log('INFO', '\n📊 =========== 迁移报告 ===========');
    log('INFO', `处理资产总数:    ${report.total_assets_processed}`);
    log('INFO', `哈希池唯一资产:  ${report.unique_assets_in_pool}`);
    log('INFO', `去重节省数量:    ${report.deduplication_savings}`);
    log('INFO', `策略:            ${report.strategy} (原文件保持不变)`);
    log('INFO', '=====================================\n');

    return report;
}

// ============================================================
// 主入口
// ============================================================
async function main() {
    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║     Nano Generator - V1 → V2 Migration Tool    ║');
    console.log('║         策略: 安全复制模式 (不删除原文件)         ║');
    if (isDryRun) {
        console.log('║              ⚡ DRY-RUN 模拟模式 ⚡              ║');
    }
    console.log('╚════════════════════════════════════════════════╝\n');

    // 准备全局哈希池目录
    ensureDir(GLOBAL_ASSETS_DIR);
    ensureDir(PROJECT_DIR);

    // 加载已有 manifest（支持断点续传）
    let manifest = {};
    if (fs.existsSync(ASSET_MANIFEST_FILE)) {
        manifest = JSON.parse(fs.readFileSync(ASSET_MANIFEST_FILE, 'utf-8'));
        log('INFO', `已加载现有 manifest，包含 ${Object.keys(manifest).length} 条记录（支持断点续传）`);
    }

    // 旧路径 → 新路径 映射表（本次运行内存保留）
    const pathRemap = {};

    // 执行各阶段迁移
    migrateImageDirs(manifest, pathRemap);
    migrateUploadsDir(manifest, pathRemap);
    migrateVideosDir(manifest, pathRemap);
    migrateAudioDir(manifest, pathRemap);
    migrateHistoryFile(pathRemap);
    createDefaultProjectState();
    saveMigrationReport(manifest, pathRemap);

    console.log('\n🎉 迁移完成！请按以下步骤手动确认并操作：');
    console.log(`   1. 检查 ./DL/assets/ 目录，确认文件已正确复制`);
    console.log(`   2. 检查 ./DL/admin/projects/default/history.jsonl，确认记录路径已更新`);
    console.log(`   3. 启动应用验证功能正常`);
    console.log(`   4. 确认无误后，可手动删除 ./DL/uploads/、./DL/videos/、./DL/audio/ 等旧目录`);
    console.log(`\n⚠️  旧的日期目录（DL/20260210/ 等）保留了图片原件，请确认后再处理\n`);
}

main().catch(err => {
    log('ERROR', `迁移脚本崩溃: ${err.message}`);
    console.error(err);
    process.exit(1);
});
