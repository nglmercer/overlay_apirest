// proxy/httpProxy.ts
import type { Context, Next } from 'hono';
import { URL } from 'url';
export interface ProxyConfig {
  timeout?: number;
  allowOrigins?: string[];
  maxRedirects?: number;
}

export class HttpProxy {
  private config: ProxyConfig;

  constructor(config: ProxyConfig = {}) {
    this.config = {
      timeout: 30000,
      allowOrigins: ['*'],
      maxRedirects: 5,
      ...config
    };
  }

  /**
   * Middleware para manejar proxy HTTP
   */
  middleware = async (c: Context, next: Next) => {
    const targetUrl = c.req.header('X-Proxy-Target');

    if (!targetUrl) {
      await next();
      return;
    }

    return await this.handleHttpProxy(c);
  };

  private async handleHttpProxy(c: Context): Promise<Response> {
    const targetUrl = c.req.header('X-Proxy-Target')!;
    
    // Validar y parsear URL objetivo
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(decodeURIComponent(targetUrl));
    } catch {
      return c.text('Invalid X-Proxy-Target URL format', 400);
    }

    // Validar protocolo (solo HTTP/HTTPS para proxy HTTP)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return c.text('Invalid protocol for HTTP proxy', 400);
    }

    // Preparar headers
    const headers = this.prepareHeaders(c);
    
    // Preparar body
    const body = await this.prepareBody(c);

    // Configurar timeout
    const timeout = Number(c.req.header('X-Proxy-Timeout')) || this.config.timeout!;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      console.log(`🔄 Proxying ${c.req.method} to: ${parsedUrl.toString()}`);
      
      const response = await fetch(parsedUrl.toString(), {
        method: c.req.method,
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      
      console.log(`✅ Proxy response: ${response.status} ${response.statusText}`);
      console.log(`📋 Response headers:`, Object.fromEntries(response.headers.entries()));
      
      return await this.createProxyResponse(response);

    } catch (error) {
      clearTimeout(timeoutId);
      console.error(`❌ Proxy error for ${parsedUrl.toString()}:`, error);
      return this.handleProxyError(error as Error);
    }
  }

  private prepareHeaders(c: Context): Record<string, string> {
    const headers: Record<string, string> = {};
    
    // Copiar headers originales (excepto algunos específicos)
    const skipHeaders = ['host', 'content-length', 'x-proxy-target', 'x-proxy-timeout'];
    
    for (const [key, value] of c.req.raw.headers) {
      if (!skipHeaders.includes(key.toLowerCase())) {
        headers[key] = value;
      }
    }

    // Manejar autenticación proxy
    const authHeader = c.req.header('Proxy-Authorization');
    if (authHeader?.startsWith('Basic ')) {
      headers['Authorization'] = authHeader;
    }

    return headers;
  }

  private async prepareBody(c: Context): Promise<ReadableStream | null> {
    if (['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
      return null;
    }
    
    return c.req.raw.body;
  }

  private async createProxyResponse(response: Response): Promise<Response> {
    const responseHeaders = new Headers(response.headers);
    
    // Configurar CORS
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', '*');
    responseHeaders.set('Access-Control-Expose-Headers', '*');

    // Verificar si la respuesta es JSON y validar su formato
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/json') || contentType.includes('text/json')) {
      try {
        // Leer el body como texto para validar el JSON
        const text = await response.text();
        
        // Intentar parsear para verificar que es JSON válido
        if (text.trim()) {
          JSON.parse(text);
        }
        
        // Si llegamos aquí, el JSON es válido, crear respuesta con el texto
        return new Response(text, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        });
      } catch (jsonError) {
        console.warn('⚠️ Invalid JSON response from target:', jsonError);
        
        // Si el JSON es inválido, devolver como texto plano
        responseHeaders.set('Content-Type', 'text/plain');
        responseHeaders.set('X-Proxy-Warning', 'Invalid JSON converted to text');
        
        // Obtener el texto original nuevamente
        const originalText = await response.clone().text();
        
        return new Response(originalText, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        });
      }
    }

    // Para respuestas no-JSON, pasar el body directamente
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  }

  private handleProxyError(error: Error): Response {
    console.error('🚨 Proxy Error Details:', {
      name: error.name,
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n') // Primeras 3 líneas del stack
    });

    if (error.name === 'AbortError') {
      return new Response(JSON.stringify({
        error: 'Proxy timeout',
        message: 'Target server did not respond within timeout period',
        code: 'PROXY_TIMEOUT'
      }), { 
        status: 504,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    if (error.message.includes('fetch')) {
      return new Response(JSON.stringify({
        error: 'Network error',
        message: 'Could not connect to target server',
        code: 'PROXY_NETWORK_ERROR',
        details: error.message
      }), { 
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    return new Response(JSON.stringify({
      error: 'Proxy error',
      message: error.message,
      code: 'PROXY_GENERAL_ERROR'
    }), { 
      status: 502,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}