export type ConnectionState = 'connected' | 'reconnecting' | 'offline';

type ProtocolMessageHandler = (message: string) => void;

export class ProtocolClient {
  private queue: string[] = [];
  private handlers = new Set<ProtocolMessageHandler>();
  state: ConnectionState = 'connected';

  connect() {
    this.state = 'connected';
    const queued = [...this.queue];
    this.queue = [];
    queued.forEach(message => this.send(message));
  }

  disconnect() {
    this.state = 'offline';
  }

  reconnect() {
    this.state = 'reconnecting';
  }

  send(message: string) {
    if (this.state !== 'connected') {
      this.queue.push(message);
      return;
    }
    this.handlers.forEach(handler => handler(message));
  }

  subscribe(handler: ProtocolMessageHandler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  queuedCount() {
    return this.queue.length;
  }
}
