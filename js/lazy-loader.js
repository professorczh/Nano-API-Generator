// 懒加载工具

export class LazyLoader {
    static loadedModules = new Map();
    
    static async loadModule(modulePath, moduleName) {
        if (this.loadedModules.has(moduleName)) {
            return this.loadedModules.get(moduleName);
        }
        
        try {
            const module = await import(modulePath);
            this.loadedModules.set(moduleName, module);
            return module;
        } catch (error) {
            console.error(`Failed to load module: ${moduleName}`, error);
            return null;
        }
    }
    
    static async loadGoogleGenerativeAI() {
        const module = await this.loadModule('@google/generative-ai', 'GoogleGenerativeAI');
        return module?.GoogleGenerativeAI;
    }
    
    static async loadPinManager() {
        const module = await this.loadModule('./js/pin-manager.js', 'PinManager');
        return module?.PinManager;
    }
    
    static async loadTemplateLoader() {
        const module = await this.loadModule('./js/template-loader.js', 'TemplateLoader');
        return module?.TemplateLoader;
    }
}
