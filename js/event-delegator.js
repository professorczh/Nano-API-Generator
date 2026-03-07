// 事件委托工具

export class EventDelegator {
    static delegatedEvents = new Map();
    
    static delegate(parentElement, eventType, selector, handler) {
        const key = `${parentElement.id || parentElement.className}-${eventType}`;
        
        if (!this.delegatedEvents.has(key)) {
            const delegatedHandler = (event) => {
                const target = event.target.closest(selector);
                if (target && parentElement.contains(target)) {
                    handler.call(target, event, target);
                }
            };
            
            parentElement.addEventListener(eventType, delegatedHandler);
            this.delegatedEvents.set(key, delegatedHandler);
        }
        
        return this.delegatedEvents.get(key);
    }
    
    static undelegate(parentElement, eventType) {
        const key = `${parentElement.id || parentElement.className}-${eventType}`;
        
        if (this.delegatedEvents.has(key)) {
            parentElement.removeEventListener(eventType, this.delegatedEvents.get(key));
            this.delegatedEvents.delete(key);
        }
    }
}
