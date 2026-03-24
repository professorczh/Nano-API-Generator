// 模板加载器

export class TemplateLoader {
    static async loadTemplate(templatePath) {
        try {
            const response = await fetch(templatePath);
            if (!response.ok) {
                throw new Error(`Failed to load template: ${templatePath}`);
            }
            const html = await response.text();
            return html;
        } catch (error) {
            console.error('Error loading template:', error);
            return null;
        }
    }
    
    static async loadAndInsertTemplate(templatePath, targetElement) {
        const html = await this.loadTemplate(templatePath);
        if (html) {
            targetElement.insertAdjacentHTML('beforeend', html);
            return true;
        }
        return false;
    }
    
    static async loadSettingsPanel() {
        const settingsPanel = document.getElementById('settingsPanel');
        if (!settingsPanel) {
            const html = await this.loadTemplate('./templates/settings-panel.html');
            if (html) {
                document.body.insertAdjacentHTML('beforeend', html);
                return true;
            }
        }
        return false;
    }
}
