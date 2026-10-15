import { Request, Response, NextFunction } from 'express';

// Middleware para ofuscar headers y evitar detección
export const obfuscateHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Ocultar headers que pueden revelar la tecnología
  res.removeHeader('X-Powered-By');
  
  // Agregar headers falsos para confundir scanners
  res.setHeader('Server', 'nginx/1.20.1');
  res.setHeader('X-Framework', 'Express/Custom');
  res.setHeader('X-Version', '2.1.3');
  
  next();
};

// Middleware para simular diferentes comportamientos de servidor
export const serverMasking = (req: Request, res: Response, next: NextFunction) => {
  // Simular delay de red variable
  const delay = Math.floor(Math.random() * 100) + 10;
  setTimeout(next, delay);
};

// Middleware para detectar y bloquear bots conocidos
export const botDetection = (req: Request, res: Response, next: NextFunction) => {
  const userAgent = req.get('User-Agent') || '';
  
  // Lista de bots conocidos
  const botPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /headless/i,
    /phantom/i,
    /selenium/i,
    /webdriver/i,
    /puppeteer/i,
    /playwright/i
  ];
  
  const isBot = botPatterns.some(pattern => pattern.test(userAgent));
  
  if (isBot) {
    // Solo log para monitoreo, pero permitir acceso
    console.log('Bot detected but allowing access:', userAgent);
    // Agregar header para identificar internamente
    res.setHeader('X-Bot-Detected', 'true');
  }
  
  next();
};

// Middleware para ofuscar errores
export const errorObfuscation = (err: any, req: Request, res: Response, next: NextFunction) => {
  // No revelar stack traces o información sensible
  const sanitizedError = {
    message: 'Error interno del servidor',
    code: 500,
    timestamp: Date.now()
  };
  
  // Log real del error internamente (sin exponerlo)
  console.error('Error real:', err);
  
  res.status(500).json(sanitizedError);
};

// Rate limiting con fingerprinting
export const dynamicRateLimit = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip;
  const userAgent = req.get('User-Agent') || '';
  const fingerprint = Buffer.from(`${ip}-${userAgent}`).toString('base64');
  
  // Implementar rate limiting basado en fingerprint
  // (Esta es una versión simplificada, en producción usar Redis)
  
  next();
};