import { ProtocolClient } from './protocol-client';

describe('ProtocolClient', () => {
  it('queues messages while offline and flushes on connect', () => {
    const client = new ProtocolClient();
    const sent: string[] = [];
    client.subscribe(message => sent.push(message));

    client.disconnect();
    client.send('/search gen9ou');

    expect(sent).toEqual([]);
    expect(client.queuedCount()).toBe(1);

    client.connect();

    expect(sent).toEqual(['/search gen9ou']);
    expect(client.queuedCount()).toBe(0);
  });
});
