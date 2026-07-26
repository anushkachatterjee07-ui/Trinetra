export type SocketMessage = {
  type: string;
  data: any;
};

export type MessageListener = (data: any) => void;

const resolveWebSocketUrl = () => {
  const apiBase = import.meta.env.VITE_API_BASE_URL?.trim();
  if (apiBase) {
    return `${apiBase.replace(/^http/, 'ws').replace(/\/$/, '')}/ws/telemetry`;
  }

  if (typeof window !== 'undefined' && window.location.hostname) {
    const host = window.location.hostname === 'localhost' ? '127.0.0.1' : window.location.hostname;
    return `ws://${host}:8002/ws/telemetry`;
  }

  return 'ws://127.0.0.1:8002/ws/telemetry';
};

class TelemetryWebSocketService {
  private socket: WebSocket | null = null;
  private url: string;
  private listeners: Map<string, Set<MessageListener>> = new Map();
  private reconnectTimeout: number = 3000;
  private onStatusChangeCallbacks: Set<(status: 'connecting' | 'connected' | 'disconnected') => void> = new Set();
  public connectionStatus: 'connecting' | 'connected' | 'disconnected' = 'disconnected';

  constructor(url: string = resolveWebSocketUrl()) {
    this.url = url;
  }

  public connect() {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.updateStatus('connecting');

    try {
      this.socket = new WebSocket(this.url);

      this.socket.onopen = () => {
        this.updateStatus('connected');
        console.log('Telemetry WS connected');
      };

      this.socket.onmessage = (event) => {
        try {
          const message: SocketMessage = JSON.parse(event.data);
          this.triggerListeners(message.type, message.data);
        } catch (e) {
          console.error('Error parsing WS message:', e);
        }
      };

      this.socket.onerror = (error) => {
        console.error('WS Error:', error);
      };

      this.socket.onclose = () => {
        this.updateStatus('disconnected');
        this.socket = null;
        console.log(`Telemetry WS disconnected. Retrying in ${this.reconnectTimeout / 1000}s...`);
        setTimeout(() => this.connect(), this.reconnectTimeout);
      };
    } catch (e) {
      console.error('Failed to create WebSocket instance:', e);
      this.updateStatus('disconnected');
      setTimeout(() => this.connect(), this.reconnectTimeout);
    }
  }

  public disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  public subscribe(type: string, listener: MessageListener): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);

    // Return an unsubscribe function
    return () => {
      const typeListeners = this.listeners.get(type);
      if (typeListeners) {
        typeListeners.delete(listener);
        if (typeListeners.size === 0) {
          this.listeners.delete(type);
        }
      }
    };
  }

  public onStatusChange(callback: (status: 'connecting' | 'connected' | 'disconnected') => void): () => void {
    this.onStatusChangeCallbacks.add(callback);
    callback(this.connectionStatus);
    return () => {
      this.onStatusChangeCallbacks.delete(callback);
    };
  }

  public send(type: string, data: any) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type, data }));
    } else {
      console.warn('Cannot send WS message, socket not open.');
    }
  }

  private triggerListeners(type: string, data: any) {
    // 1. Trigger specific listener
    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      typeListeners.forEach((listener) => {
        try {
          listener(data);
        } catch (e) {
          console.error(`Error in listener for ${type}:`, e);
        }
      });
    }

    // 2. Trigger global listener if any
    const globalListeners = this.listeners.get('*');
    if (globalListeners) {
      globalListeners.forEach((listener) => {
        try {
          listener({ type, data });
        } catch (e) {
          console.error('Error in global listener:', e);
        }
      });
    }
  }

  private updateStatus(status: 'connecting' | 'connected' | 'disconnected') {
    this.connectionStatus = status;
    this.onStatusChangeCallbacks.forEach((cb) => cb(status));
  }
}

// Export a singleton instance
export const telemetrySocket = new TelemetryWebSocketService();
