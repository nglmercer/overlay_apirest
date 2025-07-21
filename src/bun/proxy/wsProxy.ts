// proxy/wsProxy.ts
import { URL } from 'url';
export interface WSProxyConfig {
  timeout?: number;
  maxConnections?: number;
  heartbeatInterval?: number;
}

export class WebSocketProxy {
  private config: WSProxyConfig;
  private connections = new Map<string, { client: WebSocket; target: WebSocket; }>();

  constructor(config: WSProxyConfig = {}) {
    this.config = {
      timeout: 30000,
      maxConnections: 1000,
      heartbeatInterval: 30000,
      ...config
    };
  }

  /**
   * Manejador para upgrade de WebSocket con proxy
   */
  async handleUpgrade(request: Request, server: any): Promise<Response> {
    const targetUrl = request.headers.get('X-Proxy-Target');
    
    if (!targetUrl) {
      return new Response('X-Proxy-Target header required for WebSocket proxy', { status: 400 });
    }

    // Validar URL objetivo
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(decodeURIComponent(targetUrl));
    } catch {
      return new Response('Invalid X-Proxy-Target URL format', { status: 400 });
    }

    // Validar protocolo WebSocket
    if (!['ws:', 'wss:'].includes(parsedUrl.protocol)) {
      return new Response('Invalid protocol for WebSocket proxy (use ws: or wss:)', { status: 400 });
    }

    // Verificar límite de conexiones
    if (this.connections.size >= this.config.maxConnections!) {
      return new Response('Too many WebSocket connections', { status: 429 });
    }

    // Realizar upgrade del cliente
    const upgrade = server.upgrade(request, {
      data: {
        targetUrl: parsedUrl.toString(),
        headers: this.prepareWSHeaders(request)
      }
    });

    if (upgrade) {
      return upgrade;
    }

    return new Response('WebSocket upgrade failed', { status: 400 });
  }

  /**
   * Configurar eventos del WebSocket proxy
   */
  setupWebSocketHandlers(ws: any, server: any) {
    const connectionId = this.generateConnectionId();
    
    ws.addEventListener('open', () => {
      this.handleWebSocketOpen(ws, connectionId);
    });

    ws.addEventListener('message', (event: MessageEvent) => {
      this.handleWebSocketMessage(ws, connectionId, event);
    });

    ws.addEventListener('close', (event: CloseEvent) => {
      this.handleWebSocketClose(connectionId, event);
    });

    ws.addEventListener('error', (event: Event) => {
      this.handleWebSocketError(connectionId, event);
    });
  }

  private async handleWebSocketOpen(clientWs: any, connectionId: string) {
    const { targetUrl, headers } = clientWs.data;

    try {
      // Crear conexión al servidor objetivo
      const targetWs = new WebSocket(targetUrl, {
        headers: headers
      });

      // Configurar eventos del WebSocket objetivo
      targetWs.onopen = () => {
        console.log(`✅ WebSocket proxy connection established: ${connectionId}`);
        // Guardar la conexión
        this.connections.set(connectionId, {
          client: clientWs,
          target: targetWs
        });
      };

      targetWs.onmessage = (event) => {
        // Reenviar mensajes del servidor al cliente
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(event.data);
        }
      };

      targetWs.onclose = (event) => {
        console.log(`🔌 Target WebSocket closed: ${connectionId}`, event.code, event.reason);
        // Cerrar conexión del cliente
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.close(event.code, event.reason);
        }
        this.connections.delete(connectionId);
      };

      targetWs.onerror = (error) => {
        console.error(`❌ Target WebSocket error: ${connectionId}`, error);
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.close(1011, 'Target server error');
        }
        this.connections.delete(connectionId);
      };

    } catch (error) {
      console.error(`❌ Failed to connect to target WebSocket: ${connectionId}`, error);
      clientWs.close(1011, 'Failed to connect to target server');
    }
  }

  private handleWebSocketMessage(clientWs: any, connectionId: string, event: MessageEvent) {
    const connection = this.connections.get(connectionId);
    
    if (!connection || connection.target.readyState !== WebSocket.OPEN) {
      console.warn(`⚠️ Target WebSocket not ready for message: ${connectionId}`);
      return;
    }

    // Reenviar mensaje del cliente al servidor objetivo
    connection.target.send(event.data);
  }

  private handleWebSocketClose(connectionId: string, event: CloseEvent) {
    console.log(`🔌 Client WebSocket closed: ${connectionId}`, event.code, event.reason);
    
    const connection = this.connections.get(connectionId);
    if (connection && connection.target.readyState === WebSocket.OPEN) {
      connection.target.close(event.code, event.reason);
    }
    
    this.connections.delete(connectionId);
  }

  private handleWebSocketError(connectionId: string, event: Event) {
    console.error(`❌ Client WebSocket error: ${connectionId}`, event);
    
    const connection = this.connections.get(connectionId);
    if (connection && connection.target.readyState === WebSocket.OPEN) {
      connection.target.close(1011, 'Client error');
    }
    
    this.connections.delete(connectionId);
  }

  private prepareWSHeaders(request: Request): Record<string, string> {
    const headers: Record<string, string> = {};
    
    // Headers importantes para WebSocket
    const importantHeaders = [
      'sec-websocket-protocol',
      'sec-websocket-extensions',
      'authorization',
      'cookie',
      'user-agent'
    ];

    importantHeaders.forEach(headerName => {
      const value = request.headers.get(headerName);
      if (value) {
        headers[headerName] = value;
      }
    });

    // Manejar autenticación proxy
    const authHeader = request.headers.get('Proxy-Authorization');
    if (authHeader?.startsWith('Basic ')) {
      headers['authorization'] = authHeader;
    }

    return headers;
  }

  private generateConnectionId(): string {
    return `ws-proxy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Obtener estadísticas del proxy
   */
  getStats() {
    return {
      activeConnections: this.connections.size,
      maxConnections: this.config.maxConnections,
      config: this.config
    };
  }

  /**
   * Cerrar todas las conexiones
   */
  closeAllConnections(code: number = 1001, reason: string = 'Server shutdown') {
    for (const [connectionId, connection] of this.connections) {
      try {
        connection.client.close(code, reason);
        connection.target.close(code, reason);
      } catch (error) {
        console.error(`Error closing connection ${connectionId}:`, error);
      }
    }
    this.connections.clear();
  }
}