const fs = require('fs');
let c = fs.readFileSync('js/node-factory.js', 'utf8');

c = c.replace(/contentArea\.style\.cssText = \`[\s\S]*?align-items: center;\s*\`;/g, `contentArea.style.cssText = \`
            background: #0f172a;
            position: relative;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            width: 100%;
            height: 100%;
            border-radius: 8px;
        \`;`);

fs.writeFileSync('js/node-factory.js', c);
console.log('Fixed cssText!');
