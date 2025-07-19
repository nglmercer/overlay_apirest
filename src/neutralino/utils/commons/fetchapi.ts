import { safeParse } from "./safeparse";
import {
  http,
  proxyConfig,
  type FetchOptions,
  type ProxyConfig
} from './httpservice.ts';
import apiConfig from '../config/apiConfig';

interface UserInfo {
  token?: string;
  user?: Record<string, any>;
  [key: string]: any;
}

// Polyfill (SSR)
const ssrSafeStorage: Storage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  length: 0,
  key: () => null
};

// Se asigna el localStorage real si está en el navegador, si no, el polyfill
const localStorage: Storage = typeof window !== 'undefined'
  ? (window.localStorage || ssrSafeStorage)
  : ssrSafeStorage;

class BaseApi {
  // Ya no guardamos 'host' como un string. Guardamos una referencia a la configuración.
  private config: typeof apiConfig;
  http: typeof http;
  token?: string;
  user: Record<string, any>;

  // El constructor ahora recibe el módulo de configuración
  constructor(config: typeof apiConfig) {
    this.config = config; // <-- Guarda la referencia
    this.http = http;
    const info: UserInfo = safeParse(localStorage.getItem("info")) || {};
    this.token = info.token || localStorage.getItem("token") || undefined;
    this.user = safeParse(info.user || safeParse(localStorage.getItem("user"))) || {};
    
    // Configurar proxy si está disponible en la configuración
    this.initializeProxy();
  }

  /**
   * Inicializa la configuración del proxy si está disponible en apiConfig
   */
  private initializeProxy(): void {
    if (this.config.proxy) {
      proxyConfig.update(this.config.proxy);
    }
  }

  /**
   * Devuelve la URL base actual obtenida desde el módulo de configuración.
   * Esto asegura que siempre usemos los valores más recientes.
   */
  get host(): string {
    return this.config.getFullUrl();
  }

  /**
   * Método para actualizar la configuración de la API dinámicamente.
   * Delega la lógica de actualización al módulo de configuración.
   * @param newConfig - Un objeto con las propiedades a cambiar (host, port, proxy).
   */
  updateConfig(newConfig: { 
    host?: string; 
    port?: number | string;
    proxy?: ProxyConfig;
  }): void {
    this.config.update(newConfig);
    
    // Si se actualiza la configuración del proxy, aplicarla
    if (newConfig.proxy) {
      proxyConfig.update(newConfig.proxy);
    }
  }

  /**
   * Configura el proxy globalmente
   * @param config - Configuración del proxy
   */
  configureProxy(config: ProxyConfig): void {
    proxyConfig.update(config);
  }

  /**
   * Habilita o deshabilita el proxy globalmente
   * @param enabled - Estado del proxy
   */
  toggleProxy(enabled: boolean): void {
    proxyConfig.update({ enabled });
  }

  /**
   * Obtiene la configuración actual del proxy
   * @returns La configuración actual del proxy
   */
  getProxyConfig(): ProxyConfig {
    return proxyConfig.get();
  }

  /**
   * Genera las cabeceras de autenticación.
   * @param contentType - El tipo de contenido de la solicitud.
   * @returns Un objeto con las cabeceras.
   */
  protected _authHeaders(contentType: string | null = 'application/json'): Record<string, string> {
    const headers: Record<string, string> = {
      'Authorization': `${this.token}`
    };
    if (contentType) {
      headers['Content-Type'] = contentType;
    }
    return headers;
  }

  /**
   * Genera opciones base para las peticiones con autenticación
   * @param options - Opciones adicionales
   * @param contentType - Tipo de contenido
   * @returns Opciones completas para la petición
   */
  protected _requestOptions(
    options: Partial<FetchOptions> = {}, 
    contentType: string | null = 'application/json'
  ): FetchOptions {
    return {
      headers: {
        ...this._authHeaders(contentType),
        ...options.headers
      },
      ...options
    };
  }

  /**
   * Envuelve una promesa de solicitud a la API para manejar errores de forma centralizada.
   * @param promise - La promesa de fetch a ejecutar.
   * @returns La promesa con el resultado de la API.
   */
  async request<T>(promise: Promise<T>): Promise<T> {
    try {
      return await promise;
    } catch (error) {
      console.error('Error en la llamada a la API:', error);
      throw error;
    }
  }

  // Métodos de conveniencia para realizar peticiones con configuración específica de proxy

  /**
   * GET con opciones de proxy personalizadas
   */
  async get<T>(
    endpoint: string, 
    options: FetchOptions = {}
  ): Promise<T> {
    const url = `${this.host}${endpoint}`;
    const requestOptions = this._requestOptions(options);
    return this.request(this.http.get<T>(url, requestOptions));
  }

  /**
   * POST con opciones de proxy personalizadas
   */
  async post<T>(
    endpoint: string, 
    body: any = {}, 
    options: FetchOptions = {}
  ): Promise<T> {
    const url = `${this.host}${endpoint}`;
    const requestOptions = this._requestOptions(options);
    return this.request(this.http.post<T>(url, body, requestOptions));
  }

  /**
   * PUT con opciones de proxy personalizadas
   */
  async put<T>(
    endpoint: string, 
    body: any = {}, 
    options: FetchOptions = {}
  ): Promise<T> {
    const url = `${this.host}${endpoint}`;
    const requestOptions = this._requestOptions(options);
    return this.request(this.http.put<T>(url, body, requestOptions));
  }

  /**
   * PATCH con opciones de proxy personalizadas
   */
  async patch<T>(
    endpoint: string, 
    body: any = {}, 
    options: FetchOptions = {}
  ): Promise<T> {
    const url = `${this.host}${endpoint}`;
    const requestOptions = this._requestOptions(options);
    return this.request(this.http.patch<T>(url, body, requestOptions));
  }

  /**
   * DELETE con opciones de proxy personalizadas
   */
  async delete<T>(
    endpoint: string, 
    options: FetchOptions = {}
  ): Promise<T> {
    const url = `${this.host}${endpoint}`;
    const requestOptions = this._requestOptions(options);
    return this.request(this.http.delete<T>(url, requestOptions));
  }

  // Métodos específicos para usar proxy en peticiones individuales

  /**
   * Realiza una petición GET usando proxy específico
   */
  async getWithProxy<T>(
    endpoint: string, 
    proxySettings: ProxyConfig,
    options: Omit<FetchOptions, 'proxyConfig'> = {}
  ): Promise<T> {
    return this.get<T>(endpoint, {
      ...options,
      useProxy: true,
      proxyConfig: proxySettings
    });
  }

  /**
   * Realiza una petición POST usando proxy específico
   */
  async postWithProxy<T>(
    endpoint: string, 
    body: any = {},
    proxySettings: ProxyConfig,
    options: Omit<FetchOptions, 'proxyConfig'> = {}
  ): Promise<T> {
    return this.post<T>(endpoint, body, {
      ...options,
      useProxy: true,
      proxyConfig: proxySettings
    });
  }

  /**
   * Realiza una petición sin proxy (forzar bypass)
   */
  async getWithoutProxy<T>(
    endpoint: string, 
    options: Omit<FetchOptions, 'useProxy'> = {}
  ): Promise<T> {
    return this.get<T>(endpoint, {
      ...options,
      useProxy: false
    });
  }
}

export default BaseApi;