// proxy/ProxyManager.ts
import { HttpProxy, type ProxyConfig } from './httpProxy';
import { WebSocketProxy,type WSProxyConfig } from './wsProxy';
import type { Context, Next } from 'hono';

export interface ProxyManagerConfig {
  http?: ProxyConfig;
  websocket?: WSProxyConfig;
  enableStats?: boolean;
}

export class ProxyManager {
  private httpProxy: HttpProxy;
  private wsProxy: WebSocketProxy;
  private stats: {
    httpRequests: number;
    wsConnections: number;
    errors: number;
  };

  constructor(config: ProxyManagerConfig = {}) {
    this.httpProxy = new HttpProxy(config.http);
    this.wsProxy = new WebSocketProxy(config.websocket);
    
    this.stats = {
      httpRequests: 0,
      wsConnections: 0,
      errors: 0
    };
  }

  /**
   * Middleware principal que maneja tanto HTTP como WebSocket
   */
  middleware = async (c: Context, next: Next) => {
    // Verificar si es una petición de upgrade a WebSocket
    const upgrade = c.req.header('upgrade');
    const connection = c.req.header('connection');
    
    if (upgrade?.toLowerCase() === 'websocket' && 
        connection?.toLowerCase().includes('upgrade')) {
      // Es una petición WebSocket, pero en Hono se maneja en el servidor
      return c.text('WebSocket upgrade should be handled at server level', 400);
    }

    // Es una petición HTTP normal
    const targetUrl = c.req.header('X-Proxy-Target');
    if (targetUrl) {
      this.stats.httpRequests++;
      return await this.httpProxy.middleware(c, next);
    }

    await next();
  };

  /**
   * Configurar el servidor para manejar WebSockets
   */
  configureServer(server: any) {
    return {
      ...server,
      websocket: {
        open: (ws: any) => {
          this.stats.wsConnections++;
          this.wsProxy.setupWebSocketHandlers(ws, server);
        },
        message: (ws: any, message: string | ArrayBuffer) => {
          // Los mensajes se manejan en setupWebSocketHandlers
        },
        close: (ws: any, code: number, reason: string) => {
          // El cierre se maneja en setupWebSocketHandlers
        },
        error: (ws: any, error: Error) => {
          this.stats.errors++;
          console.error('WebSocket error:', error);
        }
      }
    };
  }

  /**
   * Manejar upgrade de WebSocket
   */
  async handleWebSocketUpgrade(request: Request, server: any): Promise<Response> {
    return await this.wsProxy.handleUpgrade(request, server);
  }

  /**
   * Obtener estadísticas combinadas
   */
  getStats() {
    return {
      ...this.stats,
      websocket: this.wsProxy.getStats()
    };
  }

  /**
   * Cerrar todas las conexiones
   */
  async shutdown() {
    this.wsProxy.closeAllConnections(1001, 'Server shutdown');
    console.log('🛑 Proxy Manager shutdown complete');
  }
}