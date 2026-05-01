const { GoogleGenAI } = require('@google/genai');

async function check() {
    try {
        console.log("Checking SDK Initialization...");
        // 尝试用你的配置初始化
        const client = new GoogleGenAI({
            vertexai: true,
            project: 'maphi-2026',
            location: 'global'
        });
        
        console.log("Client created.");
        // 打印出内部的配置，看看它到底想去哪个 URL
        // 注意：不同版本的内部属性名可能不同
        console.log("Internal Options:", client.options || "N/A");
        
    } catch (e) {
        console.error("Error:", e.message);
    }
}

check();
