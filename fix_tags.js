const fs = require('fs');

const newTagLogic = `        let _dn = modelName, _pn = '';
        if (typeof modelName === 'object' && modelName && modelName.name) {
            _dn = modelName.name; _pn = modelName.provider || '';
        } else if (typeof modelName === 'string' && modelName.includes('(')) {
            const _p = modelName.split('(');
            _dn = _p[0].trim(); _pn = _p[1].replace(')', '').trim();
        }
        if (_pn) {
            modelTag.innerHTML = \`<div class="model-name">\${_dn}</div><div class="model-provider">\${_pn}</div>\`;
            modelTag.title = \`\${_dn} (\${_pn})\`;
        } else {
            modelTag.textContent = _dn;
            modelTag.title = _dn;
        }`;

// Pattern to match existing simple tag logic (handles both CRLF and LF)
const pattern = /if \(typeof modelName === 'object' && modelName\.name\) \{[\s\S]*?modelTag\.innerHTML = `<div class="model-name">\$\{modelName\.name\}<\/div><div class="model-provider">\$\{modelName\.provider\}<\/div>`;\s*\n\s*modelTag\.title = `\$\{modelName\.name\} \(\$\{modelName\.provider\}\)`;\s*\n\s*\} else \{\s*\n\s*modelTag\.textContent = modelName;\s*\n\s*modelTag\.title = modelName;\s*\n\s*\}/g;

const files = [
    'js/node-manager.js',
    'js/loading-placeholder.js'
];

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    const matches = content.match(pattern);
    console.log(`${file}: found ${matches ? matches.length : 0} occurrences`);
    const updated = content.replace(pattern, newTagLogic);
    fs.writeFileSync(file, updated);
    console.log(`${file}: done`);
});

console.log('All files updated successfully!');
