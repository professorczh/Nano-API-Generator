// 动态Provider系统
// 目标：根据用户配置的Provider动态加载对应的API模块

import { GeminiProvider } from './gemini-provider.js';
import { TwelveAIProvider } from './12ai.js';
import { PROTOCOL_MAP } from '../../config.js';

class DynamicProviderManager {
    constructor() {
        this.providers = new Map();
        this.initialize();
    }

    initialize() {
        console.log('[DynamicProvider] 初始化动态Provider系统');
    }

    // 从localStorage获取Provider配置
    getStoredProviders() {
        try {
            const savedProviders = localStorage.getItem('nano_api_providers');
            if (savedProviders) {
                return JSON.parse(savedProviders);
            }
        } catch (e) {
            console.error('[DynamicProvider] 读取配置失败:', e);
        }
        return [];
    }

    // 注册Provider
    registerProvider(name, providerClass, config) {
        if (this.providers.has(name)) {
            return;
        }
        this.providers.set(name, {
            class: providerClass,
            config: config,
            instance: null
        });
        console.log(`[DynamicProvider] 注册Provider: ${name}`);
    }

    // 获取最终协议（模型协议 > Provider协议）
    getFinalProtocol(providerProtocol, modelProtocol) {
        if (modelProtocol && modelProtocol !== 'openai') {
            return modelProtocol;
        }
        return providerProtocol || 'openai';
    }

    // 根据配置创建Provider实例
    createProviderFromConfig(providerConfig) {
        const { id, name, baseUrl, apiKey, protocol: providerProtocol, textModels, imageModels, videoModels } = providerConfig;
        
        // 收集所有模型的协议信息
        const allModels = [...(textModels || []), ...(imageModels || []), ...(videoModels || [])];
        
        // 为每个模型协议注册Provider
        const protocols = new Set();
        protocols.add(providerProtocol || 'openai');
        allModels.forEach(model => {
            if (model.protocol) {
                protocols.add(model.protocol);
            }
        });
        
        // 根据协议类型选择Provider类
        protocols.forEach(protocol => {
            const protocolConfig = PROTOCOL_MAP[protocol] || PROTOCOL_MAP['openai'];
            
            let ProviderClass;
            if (protocol === 'gemini') {
                ProviderClass = GeminiProvider;
            } else {
                ProviderClass = TwelveAIProvider;
            }
            
            const config = {
                apiKey: apiKey,
                baseUrl: baseUrl,
                providerProtocol: providerProtocol || 'openai',
                modelProtocols: allModels.reduce((acc, m) => {
                    if (m.name) acc[m.name] = m.protocol || providerProtocol || 'openai';
                    return acc;
                }, {}),
                getProtocol: function(modelName) {
                    return this.modelProtocols[modelName] || this.providerProtocol;
                }
            };
            
            // 注册Provider
            this.registerProvider(id, ProviderClass, config);
            
            // 按name注册
            const nameUpper = name.toUpperCase();
            if (nameUpper !== id) {
                this.registerProvider(nameUpper, ProviderClass, config);
            }
            
            // 常见映射
            const commonMapping = {
                'google': 'GEMINI',
                'gemini': 'GEMINI',
                '12ai': '12AI'
            };
            if (commonMapping[nameUpper]) {
                this.registerProvider(commonMapping[nameUpper], ProviderClass, config);
            }
            
            // 直接注册小写名称（如 google, 12ai）
            if (nameUpper.toLowerCase() !== nameUpper) {
                this.registerProvider(nameUpper.toLowerCase(), ProviderClass, config);
            }
            
            console.log(`[DynamicProvider] 从配置创建Provider: id=${id}, name=${name}, 协议=${protocol}, apiKey=${apiKey ? apiKey.substring(0, 10) + '...' : 'none'}`);
        });
    }

    // 初始化所有已保存的Provider
    initializeFromStorage() {
        const providers = this.getStoredProviders();
        console.log(`[DynamicProvider] 从存储加载 ${providers.length} 个Provider配置`);
        
        // 每次重新初始化时清空
        this.providers.clear();
        
        providers.forEach(providerConfig => {
            if (providerConfig.enabled) {
                this.createProviderFromConfig(providerConfig);
            }
        });
        
        console.log(`[DynamicProvider] 注册的Provider:`, Array.from(this.providers.keys()));
    }

    // 获取Provider实例
    getProvider(name) {
        if (!this.providers.has(name)) {
            console.warn(`[DynamicProvider] 未找到Provider: ${name}`);
            return null;
        }

        const providerInfo = this.providers.get(name);
        
        if (!providerInfo.instance) {
            providerInfo.instance = new providerInfo.class(providerInfo.config);
        }
        
        return providerInfo.instance;
    }

    // 获取所有已注册的Provider列表
    getProviderList() {
        return Array.from(this.providers.keys());
    }

    // 检查Provider是否可用
    isProviderAvailable(name) {
        return this.providers.has(name);
    }
}

// 全局实例
window.dynamicProviderManager = new DynamicProviderManager();

// 导出供其他模块使用
export { DynamicProviderManager };
