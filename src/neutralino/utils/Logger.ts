// Enums y tipos
enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    LOG = 3,
    DEBUG = 4,
    DISABLED = 5
}

interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: Date;
    loggerName: string;
    caller?: string;
    data?: any[];
}

interface LoggerConfig {
    level: LogLevel;
    enableDebug: boolean;
    enableCaller: boolean;
    enableTimestamp: boolean;
    prefix?: string;
}

// Clase principal del Logger
class BrowserLogger {
    private config: LoggerConfig;
    private name: string;
    private static globalConfig: LoggerConfig = {
        level: LogLevel.INFO,
        enableDebug: false,
        enableCaller: false,
        enableTimestamp: false
    };
    private static loggers: BrowserLogger[] = [];

    constructor(name: string, config?: Partial<LoggerConfig>) {
        this.name = name;
        this.config = {
            ...BrowserLogger.globalConfig,
            ...config
        };

        // Registrar el logger para gestión global
        BrowserLogger.loggers.push(this);
    }

    // Configuración global para todos los loggers
    static setGlobalConfig(config: Partial<LoggerConfig>): void {
        BrowserLogger.globalConfig = { ...BrowserLogger.globalConfig, ...config };

        // Actualizar todos los loggers existentes que no tienen configuración específica
        BrowserLogger.loggers.forEach(logger => {
            logger.updateFromGlobalConfig(config);
        });
    }

    // Actualizar desde configuración global (solo propiedades no personalizadas)
    private updateFromGlobalConfig(globalConfig: Partial<LoggerConfig>): void {
        // Solo actualizar propiedades que no han sido configuradas específicamente
        Object.keys(globalConfig).forEach(key => {
            const configKey = key as keyof LoggerConfig;
            if (globalConfig[configKey] !== undefined) {
                (this.config as any)[configKey] = globalConfig[configKey];
            }
        });
    }

    // Configurar este logger específico
    configure(config: Partial<LoggerConfig>): BrowserLogger {
        this.config = { ...this.config, ...config };
        return this; // Para chaining
    }

    // Habilitar/deshabilitar debug globalmente
    static enableDebug(enable: boolean = true): void {
        BrowserLogger.setGlobalConfig({
            enableDebug: enable,
            enableCaller: enable,
            level: enable ? LogLevel.DEBUG : LogLevel.INFO
        });
    }

    // Habilitar debug solo para este logger
    enableDebug(enable: boolean = true): BrowserLogger {
        this.config.enableDebug = enable;
        this.config.enableCaller = enable;
        if (enable && this.config.level > LogLevel.DEBUG) {
            this.config.level = LogLevel.DEBUG;
        }
        return this;
    }

    // Obtener información del caller (de dónde se llamó el log)
    private getCaller(): string | undefined {
        if (!this.config.enableCaller && !this.config.enableDebug) return undefined;

        const stack = new Error().stack;
        if (!stack) return undefined;

        const lines = stack.split('\n');
        // Buscar la línea que no sea del logger (saltamos las primeras líneas internas)
        for (let i = 3; i < lines.length; i++) {
            const line = lines[i];
            if (line && !line.includes('BrowserLogger') && !line.includes('at log') &&
                !line.includes('at info') && !line.includes('at warn') &&
                !line.includes('at error') && !line.includes('at debug')) {

                // Extraer información útil de la línea del stack
                const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/) ||
                    line.match(/at\s+(.+?):(\d+):(\d+)/);

                if (match) {
                    const functionName = match[1] || 'anonymous';
                    const fileName = match[2] ? match[2].split('/').pop() : 'unknown';
                    const lineNum = match[3] || match[2];
                    return `${functionName} (${fileName}:${lineNum})`;
                }

                return line.trim().replace('at ', '');
            }
        }

        return undefined;
    }

    // Formatear el mensaje de log
    private formatMessage(level: LogLevel, message: string, caller?: string): string {
        const parts: string[] = [];

        // Timestamp
        if (this.config.enableTimestamp) {
            parts.push(`[${new Date().toISOString()}]`);
        }

        // Nivel
        parts.push(`[${LogLevel[level]}]`);

        // Nombre del logger
        parts.push(`[${this.name}]`);

        // Caller info
        if (caller) {
            parts.push(`[${caller}]`);
        }

        // Prefix personalizado
        if (this.config.prefix) {
            parts.push(`[${this.config.prefix}]`);
        }

        return `${parts.join(' ')}: ${message}`;
    }

    // Método principal de logging
    private writeLog(level: LogLevel, message: string, ...data: any[]): void {
        // Verificar si el nivel está habilitado
        if (level > this.config.level) return;
        if (this.config.level === LogLevel.DISABLED) return;
        const caller = this.getCaller();
        const formattedMessage = this.formatMessage(level, message, caller);

        // Crear entrada de log
        const logEntry: LogEntry = {
            level,
            message: formattedMessage,
            timestamp: new Date(),
            loggerName: this.name,
            caller,
            data: data.length > 0 ? data : undefined
        };

        // Seleccionar el método de console apropiado
        const consoleMethod = this.getConsoleMethod(level);

        // Aplicar estilos según el nivel
        const styles = this.getLogStyles(level);

        if (data.length > 0) {
            consoleMethod(`%c${formattedMessage}`, styles, ...data);
        } else {
            consoleMethod(`%c${formattedMessage}`, styles);
        }
    }

    // Obtener el método de console apropiado
    private getConsoleMethod(level: LogLevel): (...args: any[]) => void {
        switch (level) {
            case LogLevel.ERROR:
                return console.error.bind(console);
            case LogLevel.WARN:
                return console.warn.bind(console);
            case LogLevel.INFO:
                return console.info.bind(console);
            case LogLevel.DEBUG:
                return console.debug.bind(console);
            default:
                return console.log.bind(console);
        }
    }

    // Estilos CSS para diferentes niveles de log
    private getLogStyles(level: LogLevel): string {
        const baseStyle = 'font-weight: normal;';

        switch (level) {
            case LogLevel.ERROR:
                return `${baseStyle} color: #ff4444; font-weight: bold;`;
            case LogLevel.WARN:
                return `${baseStyle} color: #ffaa00; font-weight: bold;`;
            case LogLevel.INFO:
                return `${baseStyle}`;
            case LogLevel.DEBUG:
                return `${baseStyle} font-style: italic;`;
            default:
                return `${baseStyle}`;
        }
    }

    // Métodos públicos de logging
    error(message: string, ...data: any[]): BrowserLogger {
        this.writeLog(LogLevel.ERROR, message, ...data);
        return this;
    }

    warn(message: string, ...data: any[]): BrowserLogger {
        this.writeLog(LogLevel.WARN, message, ...data);
        return this;
    }

    info(message: string, ...data: any[]): BrowserLogger {
        this.writeLog(LogLevel.INFO, message, ...data);
        return this;
    }

    log(message: string, ...data: any[]): BrowserLogger {
        this.writeLog(LogLevel.LOG, message, ...data);
        return this;
    }

    debug(message: string, ...data: any[]): BrowserLogger {
        this.writeLog(LogLevel.DEBUG, message, ...data);
        return this;
    }

    // Métodos de utilidad con chaining
    setLevel(level: LogLevel): BrowserLogger {
        this.config.level = level;
        return this;
    }

    setPrefix(prefix: string): BrowserLogger {
        this.config.prefix = prefix;
        return this;
    }

    enableTimestamp(enable: boolean = true): BrowserLogger {
        this.config.enableTimestamp = enable;
        return this;
    }

    enableCaller(enable: boolean = true): BrowserLogger {
        this.config.enableCaller = enable;
        return this;
    }

    // Getters
    getLevel(): LogLevel {
        return this.config.level;
    }

    getName(): string {
        return this.name;
    }

    getConfig(): LoggerConfig {
        return { ...this.config };
    }

    // Métodos estáticos de utilidad
    static getLoggers(): BrowserLogger[] {
        return [...BrowserLogger.loggers];
    }

    static getLoggersByName(name: string): BrowserLogger[] {
        return BrowserLogger.loggers.filter(logger => logger.name === name);
    }

    static clearLoggers(): void {
        BrowserLogger.loggers.length = 0;
    }

    // Crear un child logger que hereda configuración
    child(childName: string, config?: Partial<LoggerConfig>): BrowserLogger {
        const fullName = `${this.name}.${childName}`;
        return new BrowserLogger(fullName, { ...this.config, ...config });
    }
}

// Exportar para uso
export { BrowserLogger, LogLevel };

// Ejemplo de uso mejorado:
/*
// Ahora puedes usar new BrowserLogger()
const appLogger = new BrowserLogger('APP');
const apiLogger = new BrowserLogger('API', { level: LogLevel.DEBUG });
const dbLogger = new BrowserLogger('DATABASE');
 
// Configuración con chaining
const userLogger = new BrowserLogger('USER')
  .setPrefix('👤')
  .enableDebug()
  .setLevel(LogLevel.DEBUG);
 
// Child loggers
const authLogger = appLogger.child('AUTH');
const routeLogger = appLogger.child('ROUTES', { prefix: '🛣️' });
 
// Configuración global (afecta a todos los loggers existentes y futuros)
BrowserLogger.enableDebug(true);
 
// Usar los loggers con chaining
function ejemploDeUso() {
  appLogger
    .info('Aplicación iniciada')
    .warn('Advertencia del sistema', { code: 'WARN_001' })
    .error('Error crítico', new Error('Algo salió mal'));
  
  apiLogger
    .setPrefix('🌐')
    .log('Realizando petición HTTP')
    .debug('Datos de debug', { url: '/api/users', method: 'GET' });
  
  userLogger
    .info('Usuario logueado')
    .debug('Datos del usuario', { id: 123, role: 'admin' });
 
  authLogger.info('Verificando token');
  routeLogger.debug('Ruta procesada', { path: '/dashboard' });
}
 
// Configuración global
BrowserLogger.setGlobalConfig({
  level: LogLevel.DEBUG,
  enableTimestamp: true,
  enableCaller: true
});
 
// ejemploDeUso(); // Descomenta para probar
*/