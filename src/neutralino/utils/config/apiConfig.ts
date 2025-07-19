// src/config/apiConfig.ts

// 1. Define una interfaz clara para la configuración
// types.ts - Tipos para la configuración de proxy
interface ProxyConfig {
  enabled: boolean;
  url: string;
  auth?: {
    username: string;
    password: string;
  };
  timeout?: number;
}

interface ApiConfig {
  host: string;
  port: number | string;
  protocol: 'http' | 'https';
  getFullUrl: () => string;
  update: (newConfig: Partial<Omit<ApiConfig, 'getFullUrl' | 'update'>>) => void;
  proxy?: ProxyConfig;
}
/*
const windowurl: string = typeof window !== "undefined" ? window.location.origin : "";
// 2. Crea el objeto de configuración como la única fuente de la verdad
  protocol: import.meta.env.MODE === 'development' ? 'http' : 'https',
  api Unoficial y local, en el build usamos http y no http porque no es un deploy ni esta en el mismo dominio
*/
const apiConfig: ApiConfig = {
  // Lee de variables de entorno si están disponibles, si no, usa valores por defecto
  host: import.meta.env.VITE_API_HOST || 'localhost',
  port: import.meta.env.VITE_API_PORT || 3001,
  protocol: 'http' ,

  /**
   * Construye la URL completa dinámicamente.
   * La lógica de construcción vive aquí, no en la clase Api.
   */
  getFullUrl(): string {
    // Para producción, normalmente no se especifica el puerto y se usa el host de la ventana.
    return `${this.protocol}://${this.host}:${this.port}`;
  },

  /**
   * Permite actualizar la configuración en tiempo de ejecución.
   */
  update(newConfig: Partial<Omit<ApiConfig, 'getFullUrl' | 'update'>>) {
    Object.assign(this, newConfig);
    console.log('API config updated:', this.getFullUrl());
  }
};

export default apiConfig;
export type{ ApiConfig, ProxyConfig};