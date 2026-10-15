// Sistema de detección de bots para login
export class BotDetector {
  private static behaviorScore = 0;
  private static interactions: Array<{ type: string; timestamp: number }> = [];
  private static mouseMovements = 0;
  private static keyboardPatterns: number[] = [];
  
  // Detectar comportamiento de bot
  public static detectBot(): { isBot: boolean; confidence: number; reasons: string[] } {
    const reasons: string[] = [];
    let score = 0;
    
    // 1. Verificar propiedades del navegador
    if (this.checkBrowserAutomation()) {
      score += 30;
      reasons.push('Propiedades de automatización detectadas');
    }
    
    // 2. Verificar patrones de interacción
    if (this.checkInteractionPatterns()) {
      score += 25;
      reasons.push('Patrones de interacción sospechosos');
    }
    
    // 3. Verificar movimiento del mouse
    if (this.mouseMovements < 3) {
      score += 20;
      reasons.push('Falta de movimiento natural del mouse');
    }
    
    // 4. Verificar timing de teclas
    if (this.checkKeyboardTiming()) {
      score += 15;
      reasons.push('Patrones de tecleo no humanos');
    }
    
    // 5. Verificar características del navegador
    if (this.checkBrowserFeatures()) {
      score += 10;
      reasons.push('Características del navegador sospechosas');
    }
    
    return {
      isBot: score >= 50,
      confidence: Math.min(score, 100),
      reasons
    };
  }
  
  private static checkBrowserAutomation(): boolean {
    if (typeof window === 'undefined') return false;
    
    return !!(
      (window as any).webdriver ||
      (window as any).__selenium_unwrapped ||
      (window as any).__webdriver_evaluate ||
      (window as any).__selenium_evaluate ||
      (window as any).__fxdriver_evaluate ||
      (window as any).__driver_unwrapped ||
      (window as any).__webdriver_unwrapped ||
      (window as any).__driver_evaluate ||
      (window as any).phantom ||
      (window as any).__nightmare ||
      (window as any).callPhantom ||
      (window as any)._phantom
    );
  }
  
  private static checkInteractionPatterns(): boolean {
    const now = Date.now();
    const recentInteractions = this.interactions.filter(i => now - i.timestamp < 10000);
    
    if (recentInteractions.length === 0) return true;
    
    // Verificar si todas las interacciones son muy rápidas
    const timings = recentInteractions.map((_, i) => {
      if (i === 0) return 0;
      return recentInteractions[i].timestamp - recentInteractions[i-1].timestamp;
    }).filter(t => t > 0);
    
    const avgTiming = timings.reduce((a, b) => a + b, 0) / timings.length;
    return avgTiming < 100; // Menos de 100ms entre interacciones
  }
  
  private static checkKeyboardTiming(): boolean {
    if (this.keyboardPatterns.length < 3) return false;
    
    // Verificar si el timing entre teclas es demasiado uniforme
    const differences = this.keyboardPatterns.slice(1).map((time, i) => 
      time - this.keyboardPatterns[i]
    );
    
    const avgDiff = differences.reduce((a, b) => a + b, 0) / differences.length;
    const variance = differences.reduce((sum, diff) => sum + Math.pow(diff - avgDiff, 2), 0) / differences.length;
    
    // Si la varianza es muy baja, es probablemente un bot
    return variance < 100;
  }
  
  private static checkBrowserFeatures(): boolean {
    if (typeof window === 'undefined') return false;
    
    // Verificar características que suelen estar ausentes en bots
    const suspiciousFeatures = [
      !window.navigator.plugins || window.navigator.plugins.length === 0,
      !window.navigator.languages || window.navigator.languages.length === 0,
      window.navigator.hardwareConcurrency === 0,
      !window.screen || window.screen.width === 0 || window.screen.height === 0
    ];
    
    return suspiciousFeatures.filter(Boolean).length >= 2;
  }
  
  // Registrar interacciones del usuario
  public static recordInteraction(type: string): void {
    this.interactions.push({
      type,
      timestamp: Date.now()
    });
    
    // Mantener solo las últimas 20 interacciones
    if (this.interactions.length > 20) {
      this.interactions = this.interactions.slice(-20);
    }
  }
  
  public static recordMouseMovement(): void {
    this.mouseMovements++;
  }
  
  public static recordKeyPress(): void {
    this.keyboardPatterns.push(Date.now());
    
    // Mantener solo los últimos 10 registros
    if (this.keyboardPatterns.length > 10) {
      this.keyboardPatterns = this.keyboardPatterns.slice(-10);
    }
  }
  
  // Inicializar listeners
  public static initialize(): void {
    if (typeof window === 'undefined') return;
    
    // Escuchar movimientos del mouse
    document.addEventListener('mousemove', () => {
      this.recordMouseMovement();
    });
    
    // Escuchar teclas presionadas
    document.addEventListener('keydown', () => {
      this.recordKeyPress();
    });
    
    // Escuchar clics
    document.addEventListener('click', () => {
      this.recordInteraction('click');
    });
    
    // Escuchar focus en inputs
    document.addEventListener('focusin', (e) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') {
        this.recordInteraction('input_focus');
      }
    });
  }
  
  // Generar reporte detallado
  public static generateReport(): object {
    const detection = this.detectBot();
    
    return {
      ...detection,
      stats: {
        mouseMovements: this.mouseMovements,
        interactions: this.interactions.length,
        keyboardPatterns: this.keyboardPatterns.length,
        browserFeatures: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
          plugins: navigator.plugins?.length || 0,
          hardwareConcurrency: navigator.hardwareConcurrency
        }
      },
      timestamp: new Date().toISOString()
    };
  }
  
  // Reset para nueva sesión
  public static reset(): void {
    this.behaviorScore = 0;
    this.interactions = [];
    this.mouseMovements = 0;
    this.keyboardPatterns = [];
  }
}