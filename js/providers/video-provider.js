// 视频生成 Provider
// 支持动态配置 apiKey 和 baseUrl

export class VideoProvider {
    constructor(config = {}) {
        this.apiKey = config.apiKey || '';
        this.baseUrl = (config.baseUrl || '').replace(/\/$/, '');
    }

    updateAPIKey(apiKey) {
        this.apiKey = apiKey;
    }

    updateBaseUrl(baseUrl) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
    }

    async generateVideo(config) {
        const {
            model,
            prompt,
            images = [],
            aspectRatio = "16:9",
            resolution = "720p",
            durationSeconds = 6,
            onProgressUpdate,
            onVideoGenerated,
            onError,
            debugLog
        } = config;

        if (!this.apiKey) {
            const error = new Error("API Key 未设置");
            if (onError) onError(error);
            throw error;
        }

        if (!this.baseUrl) {
            const error = new Error("Base URL 未设置");
            if (onError) onError(error);
            throw error;
        }

        if (debugLog) {
            debugLog(`[VideoProvider] 开始生成视频, 模型: ${model}, 提示词: ${prompt}`, 'info');
        }

        try {
            const taskId = await this.submitTask({
                model,
                prompt,
                images,
                aspectRatio,
                resolution,
                durationSeconds,
                debugLog
            });

            if (debugLog) {
                debugLog(`[VideoProvider] 任务已提交, Task ID: ${taskId}`, 'info');
            }

            await this.pollTask({
                taskId,
                onProgressUpdate,
                onVideoGenerated,
                onError,
                debugLog
            });

        } catch (error) {
            if (debugLog) {
                debugLog(`[VideoProvider] 错误: ${error.message}`, 'error');
            }
            if (onError) onError(error);
            throw error;
        }
    }

    async submitTask({ model, prompt, images, aspectRatio, resolution, durationSeconds, debugLog }) {
        const payload = {
            model,
            prompt
        };

        if (images && images.length > 0) {
            payload.images = images;
        }

        payload.metadata = {
            aspectRatio: aspectRatio
        };

        if (!model.startsWith('seedance')) {
            payload.metadata.durationSeconds = durationSeconds;
            payload.metadata.resolution = resolution;
        }

        if (debugLog) {
            debugLog(`[VideoProvider] 请求Payload: ${JSON.stringify(payload)}`, 'info');
        }

        const response = await fetch(`${this.baseUrl}/v1/videos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify(payload)
        });

        const responseText = await response.text();
        
        if (debugLog) {
            debugLog(`[VideoProvider] 响应状态: ${response.status}, 响应内容: ${responseText}`, 'info');
        }

        if (!response.ok) {
            let errorData = {};
            try {
                errorData = JSON.parse(responseText);
            } catch (e) {}
            throw new Error(errorData.error?.message || `提交任务失败: ${response.status} - ${responseText}`);
        }

        const data = JSON.parse(responseText);
        return data.task_id || data.id;
    }

    async pollTask({ taskId, onProgressUpdate, onVideoGenerated, onError, debugLog }) {
        return new Promise((resolve, reject) => {
            const pollInterval = setInterval(async () => {
                try {
                    const result = await this.checkTaskStatus(taskId);

                    if (debugLog) {
                        debugLog(`[VideoProvider] 状态: ${result.status}, 进度: ${result.progress}%`, 'info');
                    }

                    if (onProgressUpdate && result.progress !== undefined) {
                        onProgressUpdate(result.progress);
                    }

                    if (result.status === 'completed') {
                        clearInterval(pollInterval);
                        if (debugLog) {
                            debugLog(`[VideoProvider] 生成完成, 视频URL: ${result.video_url}`, 'info');
                        }
                        if (onVideoGenerated) {
                            onVideoGenerated(`${this.baseUrl}/v1/videos/${taskId}/content`);
                        }
                        resolve(result);
                    } else if (result.status === 'failure') {
                        clearInterval(pollInterval);
                        const error = new Error(result.fail_reason || '视频生成失败');
                        if (onError) onError(error);
                        reject(error);
                    }

                } catch (error) {
                    clearInterval(pollInterval);
                    if (onError) onError(error);
                    reject(error);
                }
            }, 3000);
        });
    }

    async checkTaskStatus(taskId) {
        const response = await fetch(`${this.baseUrl}/v1/videos/${taskId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`
            }
        });

        if (!response.ok) {
            throw new Error(`查询任务状态失败: ${response.status}`);
        }

        const data = await response.json();
        return {
            status: data.status,
            progress: data.progress,
            video_url: data.video_url,
            error: data.error
        };
    }
}
