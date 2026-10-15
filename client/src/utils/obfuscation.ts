// Utilidades de ofuscación y anti-detección
export const encodeStr = (str: string): string => {
  return btoa(unescape(encodeURIComponent(str))).split('').reverse().join('');
};

export const decodeStr = (str: string): string => {
  return decodeURIComponent(escape(atob(str.split('').reverse().join(''))));
};

// Fingerprint aleatorio para evitar detección
export const generateRandomFingerprint = (): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Headers aleatorios para requests
export const getRandomHeaders = () => {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
  ];
  
  const acceptLanguages = [
    'es-ES,es;q=0.9,en;q=0.8',
    'es-MX,es;q=0.9,en;q=0.8',
    'en-US,en;q=0.9,es;q=0.8'
  ];

  return {
    'User-Agent': userAgents[Math.floor(Math.random() * userAgents.length)],
    'Accept-Language': acceptLanguages[Math.floor(Math.random() * acceptLanguages.length)],
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Cache-Control': 'max-age=0'
  };
};

// Delay aleatorio entre acciones
export const randomDelay = (min: number = 100, max: number = 300): Promise<void> => {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
};

// Ofuscar nombres de funciones en runtime
export const createObfuscatedFunction = (fn: Function, name: string) => {
  const obfuscatedName = btoa(name).replace(/[^a-zA-Z]/g, '');
  Object.defineProperty(fn, 'name', { value: obfuscatedName });
  return fn;
};

// Canvas fingerprinting protection
export const protectCanvas = () => {
  if (typeof window !== 'undefined') {
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    
    HTMLCanvasElement.prototype.toDataURL = function(...args) {
      const noise = Math.random() * 0.001;
      const context = this.getContext('2d');
      if (context) {
        context.fillStyle = `rgba(${Math.floor(noise * 255)}, ${Math.floor(noise * 255)}, ${Math.floor(noise * 255)}, 0.01)`;
        context.fillRect(0, 0, 1, 1);
      }
      return originalToDataURL.apply(this, args);
    };
    
    CanvasRenderingContext2D.prototype.getImageData = function(...args) {
      const imageData = originalGetImageData.apply(this, args);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        if (Math.random() < 0.001) {
          data[i] = Math.floor(Math.random() * 256);
          data[i + 1] = Math.floor(Math.random() * 256);
          data[i + 2] = Math.floor(Math.random() * 256);
        }
      }
      return imageData;
    };
  }
};

// WebGL fingerprinting protection
export const protectWebGL = () => {
  if (typeof window !== 'undefined') {
    const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(parameter) {
      if (parameter === this.RENDERER || parameter === this.VENDOR) {
        return 'Privacy Protected';
      }
      return originalGetParameter.apply(this, [parameter]);
    };
  }
};

// Audio context fingerprinting protection
export const protectAudioContext = () => {
  if (typeof window !== 'undefined' && window.AudioContext) {
    const OriginalAudioContext = window.AudioContext;
    window.AudioContext = class extends OriginalAudioContext {
      constructor(...args: any[]) {
        super(...args);
        const originalCreateOscillator = this.createOscillator;
        this.createOscillator = function() {
          const oscillator = originalCreateOscillator.call(this);
          const originalStart = oscillator.start;
          oscillator.start = function(when?: number) {
            const noise = Math.random() * 0.0001;
            return originalStart.call(this, when ? when + noise : noise);
          };
          return oscillator;
        };
      }
    };
  }
};

// Inicializar todas las protecciones
export const initAntiDetection = () => {
  protectCanvas();
  protectWebGL();
  protectAudioContext();
  
  // Importar y usar el obfuscador de fingerprints
  import('./fingerprint').then(({ FingerprintObfuscator }) => {
    const obfuscator = FingerprintObfuscator.getInstance();
    obfuscator.initializeObfuscation();
  });
  
  // Ocultar propiedades del navegador que pueden ser detectadas
  if (typeof window !== 'undefined') {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
    
    // Sobrescribir console.log para evitar detección de debugging
    const originalLog = console.log;
    console.log = (...args) => {
      if (args.some(arg => typeof arg === 'string' && arg.includes('webdriver'))) {
        return;
      }
      originalLog.apply(console, args);
    };
    
    // Proteger contra detección de DevTools
    let devtools = {open: false, orientation: null};
    const threshold = 160;
    
    setInterval(() => {
      if (window.outerHeight - window.innerHeight > threshold || 
          window.outerWidth - window.innerWidth > threshold) {
        if (!devtools.open) {
          devtools.open = true;
          // En lugar de bloquear, simplemente limpiar console
          console.clear();
        }
      } else {
        devtools.open = false;
      }
    }, 500);
  }
};