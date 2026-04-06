type Handler = (...args: any[]) => void;

class EventBus {
  private handlers: Map<string, Handler[]> = new Map();

  on(event: string, handler: Handler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
  }

  off(event: string, handler: Handler) {
    const list = this.handlers.get(event);
    if (list) {
      this.handlers.set(event, list.filter(h => h !== handler));
    }
  }

  emit(event: string, ...args: any[]) {
    const list = this.handlers.get(event);
    if (list) {
      list.forEach(h => h(...args));
    }
  }

  removeAll() {
    this.handlers.clear();
  }
}

export const eventBus = new EventBus();
