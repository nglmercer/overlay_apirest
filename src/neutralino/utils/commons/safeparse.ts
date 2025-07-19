interface ParseResult<T = any> {
    success: boolean;
    value: T;
    type: string;
    error?: string;
}

interface Parser<T = any> {
    name: string;
    canParse: (value: string) => boolean;
    parse: (value: string) => T;
    priority: number; // Menor número = mayor prioridad
}

class ExtensibleParser {
    private parsers: Parser[] = [];

    constructor() {
        // Registrar parsers por defecto
        this.registerDefaultParsers();
    }

    // Registrar un nuevo parser
    registerParser<T>(parser: Parser<T>): void {
        this.parsers.push(parser);
        // Ordenar por prioridad
        this.parsers.sort((a, b) => a.priority - b.priority);
    }

    // Remover un parser por nombre
    removeParser(name: string): boolean {
        const index = this.parsers.findIndex(p => p.name === name);
        if (index !== -1) {
            this.parsers.splice(index, 1);
            return true;
        }
        return false;
    }

    // Parsear valor con intentos múltiples
    safeParse<T = any>(value: any): ParseResult<T> {
        // Si no es string o es null/undefined, retornar tal como está
        if (value == null || typeof value !== 'string') {
            return {
                success: true,
                value: value as T,
                type: typeof value
            };
        }

        const trimmed = value.trim();

        // Si es string vacío
        if (!trimmed) {
            return {
                success: true,
                value: trimmed as T,
                type: 'string'
            };
        }

        // Intentar con cada parser registrado
        for (const parser of this.parsers) {
            if (parser.canParse(trimmed)) {
                try {
                    const parsed = parser.parse(trimmed);
                    return {
                        success: true,
                        value: parsed as T,
                        type: parser.name
                    };
                } catch (error) {
                    console.warn(`Parser '${parser.name}' falló:`, error);
                    continue;
                }
            }
        }

        // Si ningún parser funcionó, retornar string original
        return {
            success: true,
            value: trimmed as T,
            type: 'string'
        };
    }

    private registerDefaultParsers(): void {
        // Parser para JSON estricto
        this.registerParser({
            name: 'json-strict',
            priority: 1,
            canParse: (value: string) => {
                return (value.startsWith('{') && value.endsWith('}')) ||
                    (value.startsWith('[') && value.endsWith(']'));
            },
            parse: (value: string) => JSON.parse(value)
        });

        // Parser para JSON "sloppy" (con correcciones)
        this.registerParser({
            name: 'json-sloppy',
            priority: 2,
            canParse: (value: string) => {
                return value.includes('{') || value.includes('[') ||
                    value.includes(':') || value.includes(',');
            },
            parse: (value: string) => {
                // Aplicar correcciones comunes
                let fixed = value;

                // Agregar comillas a las claves
                fixed = fixed.replace(/([{,]\s*)([a-zA-Z0-9_$]+)\s*:/g, '$1"$2":');

                // Convertir comillas simples a dobles en valores string
                fixed = fixed.replace(/:\s*'([^']*)'/g, ': "$1"');

                // Manejar valores sin comillas que parecen strings
                fixed = fixed.replace(/:\s*([a-zA-Z][a-zA-Z0-9_]*)\s*([,}])/g, ': "$1"$2');

                // Remover comas finales
                fixed = fixed.replace(/,\s*([}\]])/g, '$1');

                // Intentar agregar llaves faltantes si parece un objeto
                if (fixed.includes(':') && !fixed.trim().startsWith('{')) {
                    fixed = `{${fixed}}`;
                }

                return JSON.parse(fixed);
            }
        });

        // Parser para números
        this.registerParser({
            name: 'number',
            priority: 3,
            canParse: (value: string) => {
                return /^-?\d*\.?\d+([eE][+-]?\d+)?$/.test(value);
            },
            parse: (value: string) => {
                const num = Number(value);
                if (isNaN(num)) throw new Error('No es un número válido');
                return num;
            }
        });

        // Parser para booleanos
        this.registerParser({
            name: 'boolean',
            priority: 4,
            canParse: (value: string) => {
                const lower = value.toLowerCase();
                return lower === 'true' || lower === 'false' ||
                    lower === 'yes' || lower === 'no' ||
                    lower === 'on' || lower === 'off' ||
                    lower === '1' || lower === '0';
            },
            parse: (value: string) => {
                const lower = value.toLowerCase();
                return lower === 'true' || lower === 'yes' ||
                    lower === 'on' || lower === '1';
            }
        });

        // Parser para fechas ISO
        this.registerParser({
            name: 'date-iso',
            priority: 5,
            canParse: (value: string) => {
                return /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/.test(value);
            },
            parse: (value: string) => new Date(value)
        });

        // Parser para URLs
        this.registerParser({
            name: 'url',
            priority: 6,
            canParse: (value: string) => {
                try {
                    new URL(value);
                    return true;
                } catch {
                    return false;
                }
            },
            parse: (value: string) => new URL(value)
        });

        // Parser para arrays separados por comas
        this.registerParser({
            name: 'csv-array',
            priority: 7,
            canParse: (value: string) => {
                return value.includes(',') && !value.includes('{') && !value.includes('[');
            },
            parse: (value: string) => {
                return value.split(',').map(item => {
                    const trimmed = item.trim();
                    // Intentar parsear cada elemento recursivamente
                    const result = this.safeParse(trimmed);
                    return result.value;
                });
            }
        });

        // Parser para null/undefined
        this.registerParser({
            name: 'null',
            priority: 8,
            canParse: (value: string) => {
                const lower = value.toLowerCase();
                return lower === 'null' || lower === 'undefined' || lower === 'none';
            },
            parse: (value: string) => {
                const lower = value.toLowerCase();
                return lower === 'undefined' ? undefined : null;
            }
        });
    }

    // Método de conveniencia que solo retorna el valor
    parse<T = any>(value: any): T {
        return this.safeParse<T>(value).value;
    }

    // Obtener información sobre todos los parsers registrados
    getRegisteredParsers(): string[] {
        return this.parsers.map(p => p.name);
    }
}

// Crear instancia global
const parser = new ExtensibleParser();

// Función de conveniencia para mantener compatibilidad
function safeParse<T = any>(value: any): T {
    return parser.parse<T>(value);
}

// Función que retorna información completa del parsing
function safeParseWithInfo<T = any>(value: any): ParseResult<T> {
    return parser.safeParse<T>(value);
}

// Ejemplos de uso personalizado:
/*
// Parser personalizado para coordenadas geográficas
parser.registerParser({
    name: 'coordinates',
    priority: 3,
    canParse: (value: string) => {
        return /^-?\d+\.?\d*\s*,\s*-?\d+\.?\d*$/.test(value);
    },
    parse: (value: string) => {
        const [lat, lng] = value.split(',').map(s => parseFloat(s.trim()));
        return { latitude: lat, longitude: lng };
    }
});

// Parser personalizado para colores hexadecimales
parser.registerParser({
    name: 'hex-color',
    priority: 4,
    canParse: (value: string) => {
        return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value);
    },
    parse: (value: string) => {
        return {
            hex: value,
            rgb: value.length === 4
                ? [
                    parseInt(value[1] + value[1], 16),
                    parseInt(value[2] + value[2], 16),
                    parseInt(value[3] + value[3], 16)
                ]
                : [
                    parseInt(value.slice(1, 3), 16),
                    parseInt(value.slice(3, 5), 16),
                    parseInt(value.slice(5, 7), 16)
                ]
        };
    }
});
*/
// Exportar para uso
export {
    ExtensibleParser,
    safeParse,
    safeParseWithInfo,
    parser as defaultParser,
    type Parser,
    type ParseResult
};