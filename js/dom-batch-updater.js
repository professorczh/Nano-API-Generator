// DOM批量更新工具

export class DOMBatchUpdater {
    static updateQueue = new Map();
    static isScheduled = false;
    
    static scheduleUpdate(element, property, value) {
        if (!this.updateQueue.has(element)) {
            this.updateQueue.set(element, new Map());
        }
        this.updateQueue.get(element).set(property, value);
        
        if (!this.isScheduled) {
            this.isScheduled = true;
            requestAnimationFrame(() => this.flushUpdates());
        }
    }
    
    static flushUpdates() {
        this.updateQueue.forEach((properties, element) => {
            properties.forEach((value, property) => {
                element.style[property] = value;
            });
        });
        this.updateQueue.clear();
        this.isScheduled = false;
    }
    
    static batchUpdate(element, updates) {
        Object.entries(updates).forEach(([property, value]) => {
            this.scheduleUpdate(element, property, value);
        });
    }
}
