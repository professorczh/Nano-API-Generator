import { AppState } from './app-state.js';
import { getIcon } from './icons.js';
import { PersistenceManager } from './persistence-manager.js';

/**
 * 项目管理器 - 负责项目切换、新建与重命名
 */
export const ProjectManager = {
    projects: [],
    
    init() {
        this.btn = document.getElementById('projectManagerBtn');
        this.panel = document.getElementById('projectManagerPanel');
        this.list = document.getElementById('projectListContainer');
        this.nameDisplay = document.getElementById('activeProjectName');
        this.createBtn = document.getElementById('createNewProjectBtn');
        this.iconContainer = document.getElementById('projectIconContainer');

        if (!this.btn || !this.panel) return;

        // 初始化图标
        if (this.iconContainer) {
            this.iconContainer.innerHTML = getIcon('folder', 16, 'text-blue-500');
        }

        // 绑定事件
        this.btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePanel();
        });

        this.createBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleCreateProject();
        });

        document.addEventListener('click', (e) => {
            if (!this.panel.contains(e.target) && !this.btn.contains(e.target)) {
                this.panel.classList.add('hidden');
            }
        });

        // 监听全局项目切换事件 (由 AppState 派发)
        window.addEventListener('projectSwitched', (e) => {
            this.onProjectSwitched(e.detail.projectId);
        });

        // 首次加载
        this.loadProjects();
    },

    async loadProjects() {
        try {
            // 顺便触发一次初始化，确保老项目也有元数据
            await fetch('/api/project/init-all', { method: 'POST' });
            
            const response = await fetch('/api/projects');
            if (response.ok) {
                const data = await response.json();
                this.projects = Array.isArray(data) ? data : [];
            } else {
                console.error('[ProjectManager] 获取项目失败:', response.status);
                this.projects = [];
            }
            this.renderList();
            this.updateActiveName();
        } catch (e) {
            console.error('[ProjectManager] 加载失败:', e);
            this.projects = [];
        }
    },

    updateActiveName() {
        const active = this.projects.find(p => p.id === AppState.projectId);
        if (active) {
            this.nameDisplay.textContent = active.name;
            this.nameDisplay.title = active.name;
        } else {
            this.nameDisplay.textContent = '未知项目';
        }
    },

    togglePanel() {
        const isHidden = this.panel.classList.toggle('hidden');
        if (!isHidden) {
            this.loadProjects(); // 展开时刷新列表
        }
    },

    renderList() {
        this.list.innerHTML = '';
        this.projects.forEach(project => {
            const isActive = project.id === AppState.projectId;
            const item = document.createElement('div');
            item.className = `project-item ${isActive ? 'active' : ''}`;
            item.style = `
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 10px 12px;
                border-radius: 10px;
                cursor: pointer;
                transition: all 0.2s;
                background: ${isActive ? 'rgba(59, 130, 246, 0.1)' : 'transparent'};
                border: 1px solid ${isActive ? 'rgba(59, 130, 246, 0.2)' : 'transparent'};
            `;

            // 项目信息
            const info = document.createElement('div');
            info.style = 'display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0;';
            info.innerHTML = `
                <div style="color: ${isActive ? '#2563eb' : '#9ca3af'};">${getIcon('folder', 14)}</div>
                <span class="project-name-text" style="font-size: 13px; font-weight: ${isActive ? '700' : '500'}; color: ${isActive ? '#1e40af' : '#4b5563'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${project.name}
                </span>
            `;

            // 操作区
            const actions = document.createElement('div');
            actions.className = 'project-actions';
            actions.style = 'display: flex; align-items: center; gap: 4px; opacity: 0.6;';
            
            const editBtn = document.createElement('button');
            editBtn.innerHTML = getIcon('edit', 12);
            editBtn.style = 'padding: 4px; background: none; border: none; cursor: pointer; color: #6b7280;';
            editBtn.title = '重命名';
            editBtn.onclick = (e) => {
                e.stopPropagation();
                this.enterRenameMode(item, project);
            };

            actions.appendChild(editBtn);
            item.appendChild(info);
            item.appendChild(actions);

            // 点击切换
            item.addEventListener('click', () => {
                if (isActive) return;
                AppState.switchProject(project.id);
                this.panel.classList.add('hidden');
            });

            // Hover 效果
            item.onmouseover = () => { if(!isActive) item.style.background = 'rgba(0,0,0,0.03)'; actions.style.opacity = '1'; };
            item.onmouseout = () => { if(!isActive) item.style.background = 'transparent'; actions.style.opacity = '0.6'; };

            this.list.appendChild(item);
        });
    },

    enterRenameMode(item, project) {
        const textSpan = item.querySelector('.project-name-text');
        const originalName = project.name;
        
        // 创建输入框
        const input = document.createElement('input');
        input.type = 'text';
        input.value = originalName;
        input.style = 'flex: 1; min-width: 0; font-size: 13px; padding: 2px 4px; border: 1px solid #3b82f6; border-radius: 4px; outline: none; background: white;';
        
        const saveBtn = document.createElement('button');
        saveBtn.innerHTML = getIcon('check', 12);
        saveBtn.style = 'padding: 4px; color: #059669; border: none; background: #ecfdf5; border-radius: 4px; cursor: pointer;';
        
        // 替换显示
        const info = item.firstElementChild;
        const actions = item.lastElementChild;
        const oldSpan = info.querySelector('.project-name-text');
        const oldActions = actions.innerHTML;
        
        info.replaceChild(input, oldSpan);
        actions.innerHTML = '';
        actions.appendChild(saveBtn);
        actions.style.opacity = '1';

        const doSave = async () => {
            const newName = input.value.trim();
            if (newName && newName !== originalName) {
                try {
                    const res = await fetch('/api/project/rename', {
                        method: 'POST',
                        body: JSON.stringify({ projectId: project.id, newName })
                    });
                    if (res.ok) {
                        project.name = newName;
                        if (project.id === AppState.projectId) this.updateActiveName();
                    }
                } catch (e) {
                    console.error('命名失败', e);
                }
            }
            this.renderList(); // 退出并刷新
        };

        input.onkeydown = (e) => {
            if (e.key === 'Enter') doSave();
            if (e.key === 'Escape') this.renderList();
        };
        saveBtn.onclick = (e) => { e.stopPropagation(); doSave(); };
        input.onclick = (e) => e.stopPropagation();
        input.focus();
        input.select();
    },

    async handleCreateProject() {
        const name = prompt('请输入新项目名称:', `项目_${new Date().toLocaleDateString()}`);
        if (!name) return;

        try {
            const response = await fetch('/api/project/create', {
                method: 'POST',
                body: JSON.stringify({ name })
            });
            const result = await response.json();
            if (result.success) {
                await this.loadProjects();
                AppState.switchProject(result.projectId);
                this.panel.classList.add('hidden');
            }
        } catch (e) {
            console.error('创建失败', e);
            alert('创建项目失败');
        }
    },

    async onProjectSwitched(projectId) {
        console.log(`[ProjectManager] 监测到项目切换至: ${projectId}`);
        this.updateActiveName();
        
        // 核心：触发持久化层重新加载画布
        const success = await PersistenceManager.loadProjectState();
        if (!success) {
            // 如果加载失败（比如是全新项目还没状态），则清空当前画布
            PersistenceManager.restoreFromData({ nodes: [], global: { scale: 1, pan: { x: 0, y: 0 } } });
        }
        
        // 可选：如果历史记录面板也是按项目隔离的，通知它刷新
        if (window.historyManager) {
            window.historyManager.currentPage = 1;
            window.historyManager.loadHistory();
        }
    }
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    ProjectManager.init();
});
