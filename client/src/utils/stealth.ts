// Utilidades stealth para evitar detección automatizada
export class StealthMode {
  private static isInitialized = false;
  
  public static initialize(): void {
    if (this.isInitialized) return;
    
    this.hideAutomationTraces();
    this.obfuscateTimingPatterns();
    this.simulateHumanBehavior();
    this.protectAgainstFingerprinting();
    
    this.isInitialized = true;
  }
  
  private static hideAutomationTraces(): void {
    if (typeof window === 'undefined') return;
    
    // Eliminar trazas de automation
    delete (window as any).__nightmare;
    delete (window as any).__phantomas;
    delete (window as any).callPhantom;
    delete (window as any)._phantom;
    delete (window as any).phantom;
    delete (window as any).__selenium_unwrapped;
    delete (window as any).__webdriver_evaluate;
    delete (window as any).__selenium_evaluate;
    delete (window as any).__fxdriver_evaluate;
    delete (window as any).__driver_unwrapped;
    delete (window as any).__webdriver_unwrapped;
    delete (window as any).__driver_evaluate;
    delete (window as any).__selenium_unwrapped;
    delete (window as any).__fxdriver_unwrapped;
    
    // Ocultar chrome automation
    if (window.chrome && window.chrome.runtime) {
      Object.defineProperty(window.chrome.runtime, 'onConnect', {
        value: undefined,
        writable: false
      });
    }
  }
  
  private static obfuscateTimingPatterns(): void {
    if (typeof window === 'undefined') return;
    
    // Sobrescribir setTimeout y setInterval para agregar jitter aleatorio
    const originalSetTimeout = window.setTimeout;
    const originalSetInterval = window.setInterval;
    
    window.setTimeout = function(callback: Function, delay: number = 0, ...args: any[]) {
      const jitter = Math.random() * 50 - 25; // ±25ms jitter
      return originalSetTimeout.call(window, callback, Math.max(0, delay + jitter), ...args);
    };
    
    window.setInterval = function(callback: Function, delay: number = 0, ...args: any[]) {
      const jitter = Math.random() * 20 - 10; // ±10ms jitter para intervals
      return originalSetInterval.call(window, callback, Math.max(1, delay + jitter), ...args);
    };
  }
  
  private static simulateHumanBehavior(): void {
    if (typeof window === 'undefined') return;
    
    // Simular actividad humana con movimientos aleatorios del mouse
    let mouseX = 0;
    let mouseY = 0;
    
    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });
    
    // Generar movimientos sintéticos ocasionales
    setInterval(() => {
      if (Math.random() < 0.1) { // 10% probabilidad cada segundo
        const syntheticEvent = new MouseEvent('mousemove', {
          clientX: mouseX + (Math.random() - 0.5) * 2,
          clientY: mouseY + (Math.random() - 0.5) * 2,
          bubbles: true
        });
        document.dispatchEvent(syntheticEvent);
      }
    }, 1000);
    
    // Simular focus/blur aleatorio
    setInterval(() => {
      if (Math.random() < 0.05) { // 5% probabilidad
        window.dispatchEvent(new Event('blur'));
        setTimeout(() => {
          window.dispatchEvent(new Event('focus'));
        }, Math.random() * 2000 + 500);
      }
    }, 5000);
  }
  
  private static protectAgainstFingerprinting(): void {
    if (typeof window === 'undefined') return;
    
    // Proteger contra detección de automatización via performance timing
    const originalPerformanceNow = performance.now;
    let timeOffset = Math.random() * 1000;
    
    performance.now = function() {
      return originalPerformanceNow.call(performance) + timeOffset;
    };
    
    // Agregar ruido a Date.now()
    const originalDateNow = Date.now;
    Date.now = function() {
      return originalDateNow.call(Date) + Math.floor(Math.random() * 10 - 5);
    };
    
    // Proteger contra detección via stack traces
    const originalError = Error.captureStackTrace;
    if (originalError) {
      Error.captureStackTrace = function(targetObject: any, constructorOpt?: Function) {
        const result = originalError.call(Error, targetObject, constructorOpt);
        if (targetObject.stack) {
          targetObject.stack = targetObject.stack.replace(/headless|phantom|selenium|webdriver/gi, 'browser');
        }
        return result;
      };
    }
  }
  
  // Método para detectar si estamos siendo analizados (modo pasivo)
  public static detectAnalysis(): boolean {
    if (typeof window === 'undefined') return false;
    
    const suspiciousPatterns = [      
      // Solo propiedades de automatización obvias
      () => !!(window as any).webdriver,
      () => !!(window as any).phantom,
      () => !!(window as any).__nightmare,
      () => !!(window as any).selenium,
    ];
    
    return suspiciousPatterns.some(pattern => {
      try {
        return pattern();
      } catch {
        return false;
      }
    });
  }
  
  // Activar modo evasivo si se detecta análisis
  public static activateEvasiveMode(): void {
    if (this.detectAnalysis()) {
      // Solo limpiar console, no redirigir para mantener funcionalidad
      console.clear();
      
      // Log silencioso para debug interno
      console.log('Analysis detected - stealth mode active');
    }
  }
}