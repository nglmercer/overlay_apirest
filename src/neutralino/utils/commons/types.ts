// types.ts - Tipos para la configuración de proxy
export interface ProxyConfig {
  enabled: boolean;
  url: string;
  auth?: {
    username: string;
    password: string;
  };
  timeout?: number;
}

export interface ApiConfig {
  host: string;
  port: number | string;
  protocol: 'http' | 'https';
  getFullUrl: () => string;
  update: (newConfig: Partial<Omit<ApiConfig, 'getFullUrl' | 'update'>>) => void;
  proxy?: ProxyConfig;
}