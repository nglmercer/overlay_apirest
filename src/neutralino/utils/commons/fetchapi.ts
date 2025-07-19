import { safeParse } from "./safeparse";

import {
  http
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

    const info:UserInfo = safeParse(localStorage.getItem("info")) || {};
    this.token = info.token || localStorage.getItem("token") || undefined;
    this.user = safeParse(info.user || safeParse(localStorage.getItem("user"))) || {};
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
   * @param newConfig - Un objeto con las propiedades a cambiar (host, port).
   */
  updateConfig(newConfig: { host?: string; port?: number | string }): void {
    this.config.update(newConfig);
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
}

export default BaseApi;