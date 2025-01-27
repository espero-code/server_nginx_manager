import { WebSocketServer } from 'ws';
import { NginxManager } from '@/lib/nginx';

const nginx = new NginxManager();
let wss: WebSocketServer | null = null;

export function GET(req: Request) {
  if (!wss) {
    wss = new WebSocketServer({ noServer: true });
    
    // Start metrics collection when first client connects
    wss.on('connection', (ws) => {
      const unsubscribe = nginx.subscribeToMetrics((metrics) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify(metrics));
        }
      });

      ws.on('close', () => {
        unsubscribe();
        if (wss?.clients.size === 0) {
          nginx.stopMetricsCollection();
        }
      });

      if (wss?.clients.size === 1) {
        nginx.startMetricsCollection();
      }
    });
  }

  // Upgrade the HTTP request to WebSocket
  const { socket, response } = Deno.upgradeWebSocket(req);
  wss.handleUpgrade(req, socket, Buffer.alloc(0), (ws) => {
    wss?.emit('connection', ws);
  });

  return response;
}