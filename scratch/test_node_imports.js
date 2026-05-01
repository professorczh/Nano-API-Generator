const { GoogleGenAI } = require('@google/genai');

async function test() {
    try {
        // 尝试通过构造函数传入 Vertex AI 配置
        // 这里的 project ID 使用我们之前探测到的 maphi-2026
        const ai = new GoogleGenAI({
            vertexai: true,
            project: 'maphi-2026',
            location: 'us-central1'
        });

        console.log("Initialization success. Testing model generateContent...");
        
        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: 'hi'
        });

        console.log("Response success:", response.text);
    } catch (e) {
        console.log("Test failed!");
        console.log("Error:", e.message);
        // 如果报错没有构造函数，尝试通过实例属性设置
    }
}

test();
