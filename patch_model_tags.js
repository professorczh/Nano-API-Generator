const fs = require('fs');
const path = 'js/node-factory.js';
let content = fs.readFileSync(path, 'utf8');

// 1. 注入辅助函数
const helperFunc = `
function renderModelTag(container, modelName) {
    if (!modelName) return;
    const modelTag = document.createElement('div');
    modelTag.className = 'node-model-tag';
    modelTag.style.display = 'block';
    let displayName = modelName;
    let providerName = '';
    if (typeof modelName === 'object' && modelName.name) {
        displayName = modelName.name;
        providerName = modelName.provider;
    } else if (typeof modelName === 'string' && modelName.includes('(')) {
        const parts = modelName.split('(');
        displayName = parts[0];
        providerName = parts[1].replace(')', '');
    }
    if (providerName) {
        modelTag.innerHTML = \`<div class="model-name">\${displayName}</div><div class="model-provider">\${providerName}</div>\`;
        modelTag.title = \`\${displayName} (\${providerName})\`;
    } else {
        modelTag.textContent = displayName;
        modelTag.title = displayName;
    }
    container.appendChild(modelTag);
}
`;

// 插入到 imports 之后或第一个函数之前
if (!content.includes('function renderModelTag')) {
    content = content.replace(/(function formatGenerationTime[\s\S]*?\n\})/, '$1\n' + helperFunc);
}

// 2. 全局替换那些写死的可恶标签逻辑
// 这里使用正则匹配那些典型的 node-model-tag 渲染块
content = content.replace(/if\s*\((?:modelName|savedModelName)\)\s*\{[\s\S]*?sidebar\.appendChild\(modelTag\);[\s\S]*?\}/g, (match) => {
    const varName = match.includes('savedModelName') ? 'savedModelName' : 'modelName';
    return `renderModelTag(sidebar, ${varName});`;
});

// 3. 特别处理音频节点的那个残余逻辑
content = content.replace(/const modelTag = document\.createElement\('div'\);[\s\S]*?sidebar\.appendChild\(modelTag\);/g, (match) => {
    if (match.includes('renderModelTag')) return match;
    const varName = match.includes('savedModelName') ? 'savedModelName' : (match.includes('modelName') ? 'modelName' : '');
    if (!varName) return match;
    return `renderModelTag(sidebar, ${varName});`;
});

fs.writeFileSync(path, content);
console.log('Successfully patched node-factory.js');
