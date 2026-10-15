// Utilidades para generar fingerprints únicos y ofuscar identidad del navegador
export class FingerprintObfuscator {
  private static instance: FingerprintObfuscator;
  private fingerprint: string;
  
  private constructor() {
    this.fingerprint = this.generateObfuscatedFingerprint();
  }
  
  public static getInstance(): FingerprintObfuscator {
    if (!FingerprintObfuscator.instance) {
      FingerprintObfuscator.instance = new FingerprintObfuscator();
    }
    return FingerprintObfuscator.instance;
  }
  
  private generateObfuscatedFingerprint(): string {
    // Generar datos falsos para fingerprinting
    const fakeScreen = {
      width: [1920, 1366, 1440, 1536][Math.floor(Math.random() * 4)],
      height: [1080, 768, 900, 864][Math.floor(Math.random() * 4)],
      colorDepth: [24, 32][Math.floor(Math.random() * 2)],
      pixelDepth: [24, 32][Math.floor(Math.random() * 2)]
    };
    
    const fakeTimezone = [
      'America/Mexico_City',
      'America/New_York',
      'Europe/Madrid',
      'America/Los_Angeles'
    ][Math.floor(Math.random() * 4)];
    
    const fakeLanguages = [
      ['es-ES', 'es', 'en'],
      ['es-MX', 'es', 'en'],
      ['en-US', 'en', 'es'],
      ['es', 'en']
    ][Math.floor(Math.random() * 4)];
    
    // Combinar datos falsos para crear fingerprint único
    const data = [
      fakeScreen.width,
      fakeScreen.height,
      fakeScreen.colorDepth,
      fakeTimezone,
      fakeLanguages.join(','),
      Math.random().toString(36).substring(7)
    ].join('|');
    
    return btoa(data).substring(0, 32);
  }
  
  public getFingerprint(): string {
    return this.fingerprint;
  }
  
  public refreshFingerprint(): string {
    this.fingerprint = this.generateObfuscatedFingerprint();
    return this.fingerprint;
  }
  
  // Ofuscar WebRTC para evitar leak de IP real
  public obfuscateWebRTC(): void {
    if (typeof window !== 'undefined' && window.RTCPeerConnection) {
      const originalRTC = window.RTCPeerConnection;
      window.RTCPeerConnection = class extends originalRTC {
        constructor(config?: RTCConfiguration) {
          // Forzar uso de servidores TURN/STUN falsos
          const obfuscatedConfig = {
            ...config,
            iceServers: [
              { urls: 'stun:stun.example.com:19302' },
              { urls: 'turn:turn.example.com:3478', username: 'user', credential: 'pass' }
            ]
          };
          super(obfuscatedConfig);
        }
      };
    }
  }
  
  // Ofuscar geolocalización
  public obfuscateGeolocation(): void {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      const originalGetCurrentPosition = navigator.geolocation.getCurrentPosition;
      navigator.geolocation.getCurrentPosition = function(success, error, options) {
        // Simular ubicación falsa
        const fakePosition = {
          coords: {
            latitude: 19.4326 + (Math.random() - 0.5) * 0.1,
            longitude: -99.1332 + (Math.random() - 0.5) * 0.1,
            accuracy: Math.random() * 100 + 10,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null
          },
          timestamp: Date.now()
        };
        
        if (success) {
          success(fakePosition as GeolocationPosition);
        }
      };
    }
  }
  
  // Ofuscar battery API
  public obfuscateBattery(): void {
    if (typeof window !== 'undefined' && 'getBattery' in navigator) {
      const originalGetBattery = (navigator as any).getBattery;
      (navigator as any).getBattery = function() {
        return Promise.resolve({
          charging: Math.random() > 0.5,
          chargingTime: Math.random() * 7200,
          dischargingTime: Math.random() * 28800,
          level: Math.random()
        });
      };
    }
  }
  
  // Inicializar todas las ofuscaciones
  public initializeObfuscation(): void {
    this.obfuscateWebRTC();
    this.obfuscateGeolocation();
    this.obfuscateBattery();
    
    // Ofuscar propiedades del navegador
    if (typeof window !== 'undefined') {
      // Ocultar automation flags
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
        configurable: true
      });
      
      Object.defineProperty(window, 'chrome', {
        get: () => ({
          runtime: {},
          webstore: {},
          csi: () => {},
          loadTimes: () => {}
        }),
        configurable: true
      });
      
      // Falsificar plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => ({
          length: Math.floor(Math.random() * 5) + 3,
          item: () => null,
          namedItem: () => null,
          refresh: () => {}
        }),
        configurable: true
      });
    }
  }
}