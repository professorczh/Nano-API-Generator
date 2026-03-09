import { CONFIG, getModelDisplayName } from '../config.js';
import { AppState, CanvasState } from './app-state.js';
import { PinManager, drawPinsOnImage, updateImageDataList } from './pin-manager.js';
import { apiClient } from './api-client.js';
import { debugLog } from './utils.js';
import { NodeFactory } from './node-factory.js';

export async function handleAPICall(params) {
    const {
        promptInput,
        temperature,
        topP,
        aspectRatio,
        imageSize,
        videoRatioSelect,
        videoResolutionSelect,
        videoDurationSelect,
        loader,
        statusTag,
        imageResponseContainer,
        createLoadingPlaceholder,
        createTextLoadingPlaceholder,
        updateMinimapWithImage,
        selectNode,
        incrementNodeCounter
    } = params;

    debugLog(`[开始调用] handleAPICall 函数`, 'info');
    
    updateImageDataList();
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = promptInput.innerHTML;
    const imageTags = tempDiv.querySelectorAll('.pasted-image-item');
    imageTags.forEach(tag => tag.remove());
    
    const pinnedImageTags = tempDiv.querySelectorAll('.pinned-image-tag');
    let processedPrompt = tempDiv.textContent.trim();
    
    const pinInfo = [];
    pinnedImageTags.forEach(tag => {
        const imageUrl = tag.dataset.imageUrl;
        const pinNumber = tag.dataset.pinNumber;
        const filename = tag.querySelector('.pin-filename').textContent;
        
        const node = PinManager.findNodeByImageUrl(imageUrl);
        if (node) {
            const pins = JSON.parse(node.dataset.pins || '[]');
            const pin = pins.find(p => p.number == pinNumber);
            if (pin) {
                pinInfo.push({
                    imageUrl: imageUrl,
                    pinNumber: pinNumber,
                    filename: filename,
                    x: pin.x,
                    y: pin.y
                });
            }
        }
    });
    
    if (pinInfo.length > 0) {
        pinInfo.forEach(info => {
            const pinTag = `[${info.pinNumber}]`;
            if (processedPrompt.includes(pinTag)) {
                processedPrompt = processedPrompt.replace(pinTag, `[图片中 PIN ${info.pinNumber} 标记的位置]`);
            }
        });
    }
    
    const prompt = processedPrompt;
    const currentMode = CanvasState.currentMode;
    const isImageGenMode = currentMode === 'image';
    const imageDataList = PinManager.getImageDataList();
    
    debugLog(`[参数检查] 模式: ${currentMode}, 提示词: "${prompt}", 图片数量: ${imageDataList.length}, PIN数量: ${pinInfo.length}`, 'info');
    
    let modelName;
    let modelProvider;
    
    if (currentMode === 'image') {
        modelName = CONFIG.IMAGE_MODEL_NAME;
        modelProvider = CONFIG.IMAGE_MODEL_PROVIDER;
    } else if (currentMode === 'text') {
        modelName = CONFIG.MODEL_NAME;
        modelProvider = CONFIG.MODEL_PROVIDER;
    } else {
        modelName = CONFIG.VIDEO_MODEL_NAME;
        modelProvider = CONFIG.VIDEO_MODEL_PROVIDER;
    }
    
    const modelDisplayName = getModelDisplayName(modelName, modelProvider);
    
    const generationConfig = {
        temperature: parseFloat(temperature.value),
        topP: parseFloat(topP.value),
        topK: 40,
        maxOutputTokens: 8192
    };
    
    if (isImageGenMode) {
        generationConfig.imageConfig = {
            aspectRatio: aspectRatio.value,
            imageSize: imageSize.value
        };
    }
    
    debugLog(`[模型配置] 模型: ${modelName}, 温度: ${generationConfig.temperature}, TopP: ${generationConfig.topP}`, 'info');
    
    let allImageData = [...imageDataList];
    
    for (const info of pinInfo) {
        const node = PinManager.findNodeByImageUrl(info.imageUrl);
        if (node) {
            const img = node.querySelector('img');
            const pins = JSON.parse(node.dataset.pins || '[]');
            
            let base64Data;
            if (img.src.startsWith('data:')) {
                base64Data = img.src;
            } else {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.naturalWidth || img.width;
                canvas.height = img.naturalHeight || img.height;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                base64Data = canvas.toDataURL('image/png');
            }
            
            if (pins.length > 0) {
                debugLog(`[PIN标记] 在图片上绘制 ${pins.length} 个PIN标记`, 'info');
                base64Data = await drawPinsOnImage(base64Data, pins);
            }
            
            const existing = allImageData.find(data => data.data === base64Data);
            if (!existing) {
                allImageData.push({
                    data: base64Data,
                    name: info.filename
                });
            }
        }
    }
    
    CanvasState.activeRequests++;
    const activeRequests = CanvasState.activeRequests;
    
    if (activeRequests === 1) {
        loader.classList.remove('hidden');
        if (statusTag) {
            statusTag.innerText = "请求中";
            statusTag.className = "text-xs px-2 py-1 rounded bg-blue-50 text-blue-600";
        }
    }
    
    debugLog(`[请求状态] 活跃请求数: ${activeRequests}`, 'info');
    imageResponseContainer.classList.remove('hidden');
    
    let loadingPlaceholder = null;
    if (isImageGenMode) {
        const aspectRatioValue = aspectRatio.value;
        const imageSizeValue = imageSize.value;
        
        let width, height;
        const baseSize = imageSizeValue === '512px' ? 512 : imageSizeValue === '1K' ? 1024 : imageSizeValue === '2K' ? 2048 : 3840;
        
        switch (aspectRatioValue) {
            case '1:1': width = baseSize; height = baseSize; break;
            case '16:9': width = baseSize; height = Math.round(baseSize * 9 / 16); break;
            case '9:16': width = Math.round(baseSize * 9 / 16); height = baseSize; break;
            case '21:9': width = baseSize; height = Math.round(baseSize * 9 / 21); break;
            case '4:3': width = baseSize; height = Math.round(baseSize * 3 / 4); break;
            case '3:4': width = Math.round(baseSize * 3 / 4); height = baseSize; break;
            case '3:2': width = baseSize; height = Math.round(baseSize * 2 / 3); break;
            case '2:3': width = Math.round(baseSize * 2 / 3); height = baseSize; break;
            case '5:4': width = baseSize; height = Math.round(baseSize * 4 / 5); break;
            case '4:5': width = Math.round(baseSize * 4 / 5); height = baseSize; break;
            default: width = baseSize; height = Math.round(baseSize * 9 / 16);
        }
        
        const displayWidth = Math.min(width, 300);
        const displayHeight = Math.round(displayWidth * height / width);
        
        const existingNodes = imageResponseContainer.querySelectorAll('.canvas-node');
        let x = 5000;
        let y = 5000;
        
        if (existingNodes.length > 0) {
            const lastNode = existingNodes[existingNodes.length - 1];
            const lastNodeX = parseInt(lastNode.style.left) || 0;
            const lastNodeY = parseInt(lastNode.style.top) || 0;
            const lastNodeWidth = lastNode.offsetWidth;
            const lastNodeHeight = lastNode.offsetHeight;
            
            x = lastNodeX + lastNodeWidth + 50;
            y = lastNodeY;
            
            if (x > 6000) {
                x = 5000;
                y = lastNodeY + lastNodeHeight + 50;
            }
        }
        
        loadingPlaceholder = createLoadingPlaceholder(displayWidth, displayHeight, x, y, modelDisplayName);
        imageResponseContainer.appendChild(loadingPlaceholder);
        updateMinimapWithImage(loadingPlaceholder);
        
        const imgGenStartTime = Date.now();
        const imgTimeElement = loadingPlaceholder.querySelector('.node-sidebar .node-generation-time');
        if (imgTimeElement) {
            imgTimeElement.textContent = '⏱️ 0.0s';
            const imgTimer = setInterval(() => {
                const elapsed = (Date.now() - imgGenStartTime) / 1000;
                imgTimeElement.textContent = `⏱️ ${elapsed.toFixed(1)}s`;
            }, 100);
            loadingPlaceholder._timer = imgTimer;
            loadingPlaceholder._startTime = imgGenStartTime;
        }
    } else if (currentMode !== 'video') {
        const existingNodes = imageResponseContainer.querySelectorAll('.canvas-node');
        let x = 5000;
        let y = 5000;
        
        if (existingNodes.length > 0) {
            const lastNode = existingNodes[existingNodes.length - 1];
            const lastNodeX = parseInt(lastNode.style.left) || 0;
            const lastNodeY = parseInt(lastNode.style.top) || 0;
            const lastNodeWidth = lastNode.offsetWidth;
            const lastNodeHeight = lastNode.offsetHeight;
            
            x = lastNodeX + lastNodeWidth + 50;
            y = lastNodeY;
            
            if (x > 6000) {
                x = 5000;
                y = lastNodeY + lastNodeHeight + 50;
            }
        }
        
        loadingPlaceholder = createTextLoadingPlaceholder(prompt, x, y, modelDisplayName);
        imageResponseContainer.appendChild(loadingPlaceholder);
        updateMinimapWithImage(loadingPlaceholder);
        
        const textGenStartTime = Date.now();
        const textTimeElement = loadingPlaceholder.querySelector('.node-generation-time');
        if (textTimeElement) {
            textTimeElement.textContent = '⏱️ 0.0s';
            const textTimer = setInterval(() => {
                const elapsed = (Date.now() - textGenStartTime) / 1000;
                textTimeElement.textContent = `⏱️ ${elapsed.toFixed(1)}s`;
            }, 100);
            loadingPlaceholder._timer = textTimer;
            loadingPlaceholder._startTime = textGenStartTime;
        }
    }
    
    try {
        const isVideoGenMode = currentMode === 'video';
        
        if (isVideoGenMode) {
            const apiKey = localStorage.getItem('12AI_API_KEY') || '';
            if (!apiKey) {
                debugLog(`[12AI] 请输入 12AI API Key`, 'error');
                alert('请输入 12AI API Key');
                return;
            }
            
            apiClient.update12AIKey(apiKey);
            
            const selectedNode = AppState.selectedNode;
            let selectedImageUrl = null;
            if (selectedNode && selectedNode.querySelector('img')) {
                selectedImageUrl = selectedNode.querySelector('img').src;
            }
            
            const existingNodes = imageResponseContainer.querySelectorAll('.canvas-node');
            let nodeX = 5000;
            let nodeY = 5000;
            
            if (existingNodes.length > 0) {
                const lastNode = existingNodes[existingNodes.length - 1];
                const lastNodeX = parseInt(lastNode.style.left) || 0;
                const lastNodeY = parseInt(lastNode.style.top) || 0;
                const lastNodeWidth = lastNode.offsetWidth;
                const lastNodeHeight = lastNode.offsetHeight;
                
                nodeX = lastNodeX + lastNodeWidth + 50;
                nodeY = lastNodeY;
                
                if (nodeX > 6000) {
                    nodeX = 5000;
                    nodeY = lastNodeY + lastNodeHeight + 50;
                }
            }
            
            const videoModel = CONFIG.VIDEO_MODEL_NAME;
            const videoProvider = CONFIG.VIDEO_MODEL_PROVIDER;
            const videoModelDisplayName = getModelDisplayName(videoModel, videoProvider);
            const videoPlaceholder = NodeFactory.createVideoPlaceholder(nodeX, nodeY, prompt, videoModelDisplayName, videoRatioSelect.value);
            imageResponseContainer.appendChild(videoPlaceholder);
            updateMinimapWithImage(videoPlaceholder);
            selectNode(videoPlaceholder);
            
            const videoGenStartTime = Date.now();
            const videoTimeElement = videoPlaceholder.querySelector('.node-sidebar .node-generation-time');
            if (videoTimeElement) {
                videoTimeElement.textContent = '⏱️ 0.0s';
                const videoTimer = setInterval(() => {
                    const elapsed = (Date.now() - videoGenStartTime) / 1000;
                    videoTimeElement.textContent = `⏱️ ${elapsed.toFixed(1)}s`;
                }, 100);
                videoPlaceholder._timer = videoTimer;
                videoPlaceholder._startTime = videoGenStartTime;
            }
            
            await apiClient.request({
                prompt,
                isVideoGenMode: true,
                videoModel: CONFIG.VIDEO_MODEL_NAME,
                videoProvider: CONFIG.VIDEO_MODEL_PROVIDER,
                videoRatio: videoRatioSelect.value,
                videoResolution: videoResolutionSelect.value,
                videoDuration: videoDurationSelect.value,
                selectedImageUrl: selectedImageUrl,
                onVideoProgress: (progress) => {
                    debugLog(`[视频进度] ${progress}%`, 'info');
                    if (videoPlaceholder && videoPlaceholder._updateProgress) {
                        videoPlaceholder._updateProgress(progress);
                    }
                },
                onVideoGenerated: async (videoUrl) => {
                    debugLog(`[视频完成] ${videoUrl}`, 'info');
                    
                    if (videoPlaceholder && videoPlaceholder._timer) {
                        clearInterval(videoPlaceholder._timer);
                        videoPlaceholder._timer = null;
                    }
                    
                    if (videoPlaceholder && videoPlaceholder._updateProgress) {
                        videoPlaceholder._updateProgress(100);
                    }
                    
                    const videoGenEndTime = Date.now();
                    const genTime = videoPlaceholder._startTime ? (videoGenEndTime - videoPlaceholder._startTime) / 1000 : 0;
                    
                    const proxyUrl = `/api/video-proxy?url=${encodeURIComponent(videoUrl)}`;
                    debugLog(`[视频代理] 使用代理URL: ${proxyUrl}`, 'info');
                    
                    try {
                        debugLog(`[保存视频] 开始保存到服务器`, 'info');
                        const saveResponse = await fetch('/api/save-video', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                videoUrl: videoUrl,
                                prompt: prompt,
                                aspectRatio: videoRatioSelect.value,
                                duration: videoDurationSelect.value,
                                modelName: videoModelDisplayName
                            })
                        });
                        const saveResult = await saveResponse.json();
                        if (saveResult.success) {
                            debugLog(`[保存视频] 保存成功: ${saveResult.fileName}`, 'success');
                        } else {
                            debugLog(`[保存视频] 保存失败: ${saveResult.error}`, 'error');
                        }
                    } catch (saveError) {
                        debugLog(`[保存视频] 保存异常: ${saveError.message}`, 'error');
                    }
                    
                    NodeFactory.replaceWithVideo(videoPlaceholder, proxyUrl, prompt, videoModelDisplayName, genTime, videoRatioSelect.value);
                },
                onError: (error) => {
                    debugLog(`[视频错误] ${error.message}`, 'error');
                    if (videoPlaceholder) {
                        if (videoPlaceholder._timer) {
                            clearInterval(videoPlaceholder._timer);
                        }
                        videoPlaceholder.remove();
                    }
                }
            });
            
            incrementNodeCounter();
            return;
        }
        
        await apiClient.request({
            prompt,
            images: allImageData,
            pinInfo,
            modelName,
            modelProvider,
            generationConfig,
            isImageGenMode,
            aspectRatio: aspectRatio.value,
            imageSize: imageSize.value,
            onImageGenerated: async (imageData) => {
                debugLog(`[API响应] 收到响应, 候选数量: 1`, 'info');
                
                const byteCharacters = atob(imageData);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'image/png' });
                const blobUrl = URL.createObjectURL(blob);
                
                let filename = '';
                let resolution = '';
                
                try {
                    debugLog(`[保存图片] 开始保存到服务器`, 'info');
                    const saveResponse = await fetch('/save-image', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            imageData: imageData,
                            prompt: prompt,
                            aspectRatio: aspectRatio.value,
                            imageSize: imageSize.value
                        })
                    });
                    const saveResult = await saveResponse.json();
                    if (saveResult.success) {
                        filename = saveResult.filename;
                        resolution = saveResult.resolution;
                        debugLog(`[保存图片] 保存成功: ${filename}`, 'success');
                    }
                } catch (saveError) {
                    debugLog(`[保存图片] 保存失败: ${saveError.message}`, 'error');
                }
                
                if (loadingPlaceholder && loadingPlaceholder._timer) {
                    clearInterval(loadingPlaceholder._timer);
                    loadingPlaceholder._timer = null;
                }
                
                const imgGenEndTime = Date.now();
                const genTime = loadingPlaceholder._startTime ? (imgGenEndTime - loadingPlaceholder._startTime) / 1000 : 0;
                
                const newNode = createImageNode(blobUrl, prompt, 0, filename, resolution, genTime, modelDisplayName);
                newNode.dataset.generationConfig = JSON.stringify(generationConfig);
                
                if (loadingPlaceholder) {
                    loadingPlaceholder.replaceWith(newNode);
                } else {
                    imageResponseContainer.appendChild(newNode);
                }
                
                updateMinimapWithImage(newNode);
                selectNode(newNode);
                incrementNodeCounter();
            },
            onTextGenerated: (text) => {
                debugLog(`[API响应] 收到文本响应`, 'info');
                
                if (loadingPlaceholder && loadingPlaceholder._timer) {
                    clearInterval(loadingPlaceholder._timer);
                    loadingPlaceholder._timer = null;
                }
                
                const textGenEndTime = Date.now();
                const genTime = loadingPlaceholder._startTime ? (textGenEndTime - loadingPlaceholder._startTime) / 1000 : 0;
                
                const textNode = createTextNode(text, prompt, genTime, modelDisplayName);
                
                if (loadingPlaceholder) {
                    loadingPlaceholder.replaceWith(textNode);
                } else {
                    imageResponseContainer.appendChild(textNode);
                }
                
                updateMinimapWithImage(textNode);
                selectNode(textNode);
                incrementNodeCounter();
            },
            onError: (error) => {
                debugLog(`[API错误] ${error.message}`, 'error');
                
                if (loadingPlaceholder) {
                    if (loadingPlaceholder._timer) {
                        clearInterval(loadingPlaceholder._timer);
                    }
                    loadingPlaceholder.remove();
                }
                
                if (statusTag) {
                    statusTag.innerText = "错误";
                    statusTag.className = "text-xs px-2 py-1 rounded bg-red-50 text-red-600";
                }
            }
        });
    } finally {
        CanvasState.activeRequests--;
        if (CanvasState.activeRequests === 0) {
            loader.classList.add('hidden');
        }
    }
}
