const fs = require('fs');
const filePath = 'e:/20460101_MiniProgram/31_Nano_API_Test_Viewer/js/api-operations.js';

try {
    let content = fs.readFileSync(filePath, 'utf8');
    let lines = content.split(/\r?\n/);
    
    // 修复第 230 行 (数组索引为 229)
    lines[229] = '                    statusTag.innerText = "图片预处理失败";';
    // 修复第 244 行 (数组索引为 243)
    lines[243] = '            statusTag.innerText = "正在请求";';
    // 修复第 216 行 (数组索引为 215)
    lines[215] = '                debugLog(`[图片预处理] 转换 blob URL 为 base64: ${mediaData.name}`, "info");';
    // 修复第 249 行 (数组索引为 248)
    lines[248] = '    debugLog(`[请求状态] 活跃请求数: ${activeRequests}`, "info");';

    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    console.log('Successfully repaired api-operations.js');
} catch (err) {
    console.error('Failed to repair file:', err);
    process.exit(1);
}
