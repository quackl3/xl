// Utilidades para ofuscar el código fuente dinámicamente
export class CodeObfuscator {
  private static dynamicFunctions: Map<string, Function> = new Map();
  
  // Crear funciones ofuscadas dinámicamente
  public static createObfuscatedFunction(code: string, functionName: string): Function {
    // Ofuscar nombres de variables
    const obfuscatedCode = this.obfuscateVariableNames(code);
    
    // Crear función usando eval (en contexto seguro)
    try {
      const obfuscatedFunction = new Function('return ' + obfuscatedCode)();
      this.dynamicFunctions.set(functionName, obfuscatedFunction);
      return obfuscatedFunction;
    } catch (error) {
      console.error('Error creating obfuscated function:', error);
      return () => {};
    }
  }
  
  // Ofuscar nombres de variables en el código
  private static obfuscateVariableNames(code: string): string {
    const variableMap = new Map<string, string>();
    let obfuscatedCode = code;
    
    // Buscar declaraciones de variables
    const variableRegex = /\b(var|let|const)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
    let match;
    
    while ((match = variableRegex.exec(code)) !== null) {
      const originalName = match[2];
      if (!variableMap.has(originalName)) {
        const obfuscatedName = this.generateObfuscatedName();
        variableMap.set(originalName, obfuscatedName);
      }
    }
    
    // Reemplazar nombres de variables
    for (const [original, obfuscated] of variableMap) {
      const regex = new RegExp(`\\b${original}\\b`, 'g');
      obfuscatedCode = obfuscatedCode.replace(regex, obfuscated);
    }
    
    return obfuscatedCode;
  }
  
  // Generar nombres ofuscados
  private static generateObfuscatedName(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const length = Math.floor(Math.random() * 10) + 5;
    let result = '';
    
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return '_' + result;
  }
  
  // Ofuscar strings en runtime
  public static obfuscateString(str: string): string {
    return Array.from(str)
      .map(char => String.fromCharCode(char.charCodeAt(0) + Math.floor(Math.random() * 3) - 1))
      .join('');
  }
  
  // Crear proxy para ofuscar acceso a propiedades
  public static createObfuscatedProxy<T extends object>(target: T): T {
    return new Proxy(target, {
      get(obj, prop) {
        // Agregar delay aleatorio para acceso a propiedades
        if (Math.random() < 0.1) {
          setTimeout(() => {}, Math.random() * 10);
        }
        return obj[prop as keyof T];
      },
      set(obj, prop, value) {
        // Agregar ruido a las asignaciones
        if (Math.random() < 0.05) {
          console.log(`Setting ${String(prop)} to obfuscated value`);
        }
        obj[prop as keyof T] = value;
        return true;
      }
    });
  }
  
  // Método para ejecutar código de forma ofuscada
  public static executeObfuscated(functionName: string, ...args: any[]): any {
    const func = this.dynamicFunctions.get(functionName);
    if (func) {
      // Agregar delay aleatorio antes de ejecutar
      const delay = Math.random() * 50;
      return new Promise(resolve => {
        setTimeout(() => {
          resolve(func.apply(null, args));
        }, delay);
      });
    }
    return null;
  }
  
  // Limpiar funciones dinámicas para evitar análisis
  public static cleanupDynamicFunctions(): void {
    this.dynamicFunctions.clear();
    
    // Forzar garbage collection si está disponible
    if (typeof window !== 'undefined' && (window as any).gc) {
      (window as any).gc();
    }
  }
}