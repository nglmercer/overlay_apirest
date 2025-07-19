// proxyConfig.ts - Configuración de proxyo
import type{ ProxyConfig } from "./Types";
class ProxyConfiguration {
  private config: ProxyConfig = {
    enabled: false,
    url: '',
    timeout: 30000 // 30 segundos por defecto
  };

  /**
   * Actualiza la configuración del proxy
   */
  update(newConfig: Partial<ProxyConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Obtiene la configuración actual del proxy
   */
  get(): ProxyConfig {
    return { ...this.config };
  }

  /**
   * Verifica si el proxy está habilitado
   */
  isEnabled(): boolean {
    return this.config.enabled && !!this.config.url;
  }

  /**
   * Genera las headers de autenticación para el proxy
   */
  getAuthHeaders(): Record<string, string> {
    if (!this.config.auth) return {};
    
    const credentials = btoa(`${this.config.auth.username}:${this.config.auth.password}`);
    return {
      'Proxy-Authorization': `Basic ${credentials}`
    };
  }

  /**
   * Obtiene la URL del proxy
   */
  getProxyUrl(): string {
    return this.config.url;
  }

  /**
   * Obtiene el timeout configurado
   */
  getTimeout(): number {
    return this.config.timeout || 30000;
  }
}

export const proxyConfig = new ProxyConfiguration();