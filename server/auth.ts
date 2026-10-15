import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { storage } from "./storage";
import { UserRole } from "@shared/schema";
import { nanoid } from "nanoid";
import MemoryStore from "memorystore";
import bcrypt from "bcrypt";

// Use an interface instead of the direct User type to avoid circular references
export interface UserWithAuth {
  id: number;
  username: string;
  password: string;
  role: UserRole;
  isActive: boolean;
  expiresAt: Date | null;
  deviceCount: number;
  maxDevices: number;
  allowedBanks: string; // 'all' o lista separada por comas
  telegramChatId: string | null;
  createdAt: Date | null;
  lastLogin: Date | null;
}

declare global {
  namespace Express {
    // Define the User interface for express session
    interface User extends UserWithAuth {}
  }
}

// Extend session data from express-session
declare module 'express-session' {
  interface SessionData {
    pendingUser?: {
      id: number;
      username: string;
      timestamp: number;
    };
  }
}

// Crear almacenamiento para sesiones
const MemoryStoreSession = MemoryStore(session);
const sessionStore = new MemoryStoreSession({
  checkPeriod: 86400000 // Prune expired entries every 24h
});

// Sistema de control de sesiones concurrentes
interface ActiveSession {
  sessionId: string;
  userId: number;
  timestamp: number;
  userAgent?: string;
}

// Map para rastrear sesiones activas por usuario
const activeSessions = new Map<number, ActiveSession[]>();
const MAX_SESSIONS_PER_USER = 2;

// Función para limpiar sesiones de un usuario
function cleanupUserSessions(userId: number, sessionId?: string) {
  const userSessions = activeSessions.get(userId) || [];
  const filteredSessions = sessionId 
    ? userSessions.filter(session => session.sessionId !== sessionId)
    : [];
  
  if (filteredSessions.length === 0) {
    activeSessions.delete(userId);
  } else {
    activeSessions.set(userId, filteredSessions);
  }
}

// Función para agregar sesión activa
function addActiveSession(userId: number, sessionId: string, userAgent?: string) {
  const userSessions = activeSessions.get(userId) || [];
  const newSession: ActiveSession = {
    sessionId,
    userId,
    timestamp: Date.now(),
    userAgent
  };
  
  userSessions.push(newSession);
  activeSessions.set(userId, userSessions);
}

// Función para cerrar sesiones más antiguas
function closeOldestSessions(userId: number, keepCount: number = MAX_SESSIONS_PER_USER - 1) {
  const userSessions = activeSessions.get(userId) || [];
  
  if (userSessions.length >= MAX_SESSIONS_PER_USER) {
    // Ordenar por timestamp (más antiguas primero)
    userSessions.sort((a, b) => a.timestamp - b.timestamp);
    
    // Determinar cuántas sesiones cerrar
    const sessionsToClose = userSessions.length - keepCount;
    const oldSessions = userSessions.splice(0, sessionsToClose);
    
    // Cerrar sesiones en el store
    oldSessions.forEach(session => {
      console.log(`[SessionControl] Cerrando sesión antigua ${session.sessionId} del usuario ${userId}`);
      sessionStore.destroy(session.sessionId, (err) => {
        if (err) {
          console.error(`[SessionControl] Error cerrando sesión ${session.sessionId}:`, err);
        }
      });
    });
    
    // Actualizar el mapa
    activeSessions.set(userId, userSessions);
    
    return oldSessions.length;
  }
  
  return 0;
}

// Función para hashear contraseñas
export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

// Función para comparar contraseñas (hash almacenado vs contraseña proporcionada)
export async function comparePasswords(supplied: string, stored: string) {
  return bcrypt.compare(supplied, stored);
}

export function setupAuth(app: Express) {
  // Configurar sesiones y passport
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || nanoid(),
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    name: 'platform.secure.token', // Nombre genérico para evitar detección
    rolling: true, // Renueva la cookie en cada interacción para reiniciar el tiempo de inactividad
    cookie: {
      secure: process.env.NODE_ENV === 'production', // Cookies seguras solo en producción
      maxAge: 40 * 60 * 1000, // 40 minutos de inactividad máxima
      sameSite: 'lax', // Menos restrictivo que 'strict', más seguro que 'none'
      httpOnly: true, // Mayor seguridad
      path: '/'
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Middleware para rastrear sesiones activas
  app.use((req, res, next) => {
    // Si hay un usuario autenticado y no está registrado en el control de sesiones, agregarlo
    if (req.isAuthenticated() && req.user) {
      const user = req.user as Express.User;
      const sessionId = req.sessionID;
      const userSessions = activeSessions.get(user.id) || [];
      
      // Verificar si esta sesión ya está registrada
      const sessionExists = userSessions.some(session => session.sessionId === sessionId);
      if (!sessionExists) {
        const userAgent = req.get('User-Agent');
        addActiveSession(user.id, sessionId, userAgent);
        console.log(`[SessionControl] Sesión existente ${sessionId} agregada al control para usuario ${user.username}`);
      }
    }
    next();
  });

  // Limpieza periódica de sesiones inválidas cada 5 minutos
  setInterval(() => {
    console.log(`[SessionControl] Ejecutando limpieza de sesiones inválidas...`);
    let cleanedSessions = 0;
    
    Array.from(activeSessions.entries()).forEach(([userId, userSessions]) => {
      const validSessions: ActiveSession[] = [];
      
      userSessions.forEach((session) => {
        // Verificar si la sesión aún existe en el store
        sessionStore.get(session.sessionId, (err, sessionData) => {
          if (err || !sessionData) {
            console.log(`[SessionControl] Sesión inválida ${session.sessionId} removida del usuario ${userId}`);
            cleanedSessions++;
          } else {
            validSessions.push(session);
          }
        });
      });
      
      // Actualizar la lista de sesiones válidas
      if (validSessions.length === 0) {
        activeSessions.delete(userId);
      } else if (validSessions.length !== userSessions.length) {
        activeSessions.set(userId, validSessions);
      }
    });
    
    if (cleanedSessions > 0) {
      console.log(`[SessionControl] Limpieza completada: ${cleanedSessions} sesiones inválidas removidas`);
    }
  }, 5 * 60 * 1000); // Cada 5 minutos

  // Configurar estrategia local (username + password)
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) {
          return done(null, false);
        }
        
        // Verificar si la contraseña coincide
        const passwordMatches = await comparePasswords(password, user.password);
        if (!passwordMatches) {
          return done(null, false);
        }

        // Verificar si el usuario está activo (solo para usuarios no admin)
        if (user.role !== UserRole.ADMIN && !user.isActive) {
          console.log(`[Auth] Usuario inactivo: ${username}, no puede iniciar sesión`);
          return done(null, false, { message: "Tu cuenta requiere aprobación del administrador. Una vez aprobada, recibirás una notificación por Telegram. Contacta: @BalonxSistema" });
        }
        
        // Verificar si la cuenta ha vencido (expiresAt en el pasado)
        if (user.role !== UserRole.ADMIN && user.expiresAt && new Date(user.expiresAt) < new Date()) {
          console.log(`[Auth] Usuario con cuenta vencida: ${username}, expiresAt: ${user.expiresAt}`);
          
          // Desactivar automáticamente el usuario si está vencido
          await storage.updateUser(user.id, { isActive: false });
          
          return done(null, false, { 
            message: "Tu cuenta ha vencido. Por favor contacta al administrador en Telegram: @BalonxSistema para renovar tu suscripción." 
          });
        }
        
        // Verificar si la cuenta está por vencer pronto (en menos de 24 horas)
        let expirationWarning = null;
        if (user.role !== UserRole.ADMIN && user.expiresAt) {
          const expiresAt = new Date(user.expiresAt);
          const now = new Date();
          const hoursRemaining = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
          
          if (hoursRemaining < 24) {
            expirationWarning = `Tu cuenta vence en menos de 24 horas. Contacta al administrador en Telegram: @BalonxSistema para renovar.`;
            console.log(`[Auth] Usuario con cuenta por vencer pronto: ${username}, horas restantes: ${hoursRemaining.toFixed(1)}`);
          }
        }
        
        console.log(`[Auth] Login exitoso para: ${username}, role: ${user.role}, isActive: ${user.isActive}`);
        
        // Actualizar la fecha del último inicio de sesión
        await storage.updateUserLastLogin(user.id);

        return done(null, user as Express.User);
      } catch (error) {
        return done(error);
      }
    })
  );

  // Serialización y deserialización de usuario
  passport.serializeUser((user: any, done) => {
    // Guardar tipo de usuario (ejecutivo o normal) junto con el ID
    const serializedData = {
      id: user.id,
      isExecutive: user.isExecutive || false,
      officeUserId: user.officeUserId
    };
    done(null, serializedData);
  });

  passport.deserializeUser(async (serializedData: any, done) => {
    try {
      // Si es un ejecutivo, reconstruir el usuario virtual
      if (serializedData.isExecutive) {
        const executive = await storage.getExecutiveById(serializedData.id);
        if (!executive) {
          return done(null, false);
        }
        
        const officeUser = await storage.getUserById(serializedData.officeUserId || executive.userId);
        if (!officeUser) {
          return done(null, false);
        }
        
        // Reconstruir el usuario virtual del ejecutivo
        const executiveUser = {
          id: executive.id,
          username: executive.username,
          displayName: executive.displayName,
          role: officeUser.role,
          isActive: executive.isActive,
          allowedBanks: officeUser.allowedBanks,
          accountType: officeUser.accountType,
          isExecutive: true,
          officeUserId: officeUser.id,
          officeUsername: officeUser.username
        };
        
        return done(null, executiveUser as Express.User);
      } else {
        // Usuario normal
        const user = await storage.getUserById(serializedData.id || serializedData);
        done(null, user as Express.User);
      }
    } catch (error) {
      done(error);
    }
  });

  // Ruta para registro de usuarios
  app.post("/api/register", async (req, res, next) => {
    try {
      const { username, password, telegramChatId, role = UserRole.USER, allowedBanks = 'all', discountCode, accountType = 'individual' } = req.body;
      
      // Validar datos
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }
      
      // El telegramChatId ahora es opcional - puede configurarse después por administradores
      
      // Verificar si el usuario ya existe
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      // Determinar precio base y límite de dispositivos según tipo de cuenta
      const isOffice = accountType === 'office';
      const basePrice = isOffice ? 6000 : 3000; // Oficina: 6000 MXN, Individual: 3000 MXN
      const maxDevices = 2; // Ambos tipos tienen 2 dispositivos
      const maxExecutives = isOffice ? 8 : 0; // Solo oficinas tienen ejecutivos
      
      // Validar y aplicar código de descuento si se proporcionó
      let customPrice: string | undefined = undefined;
      let discountApplied = 0;
      let claimedDiscount: any = null;
      
      if (discountCode) {
        // Reclamar código de forma atómica (marca como usado sin userId primero)
        claimedDiscount = await storage.claimDiscountCode(discountCode);
        
        if (!claimedDiscount) {
          return res.status(400).json({ message: "Código de descuento no válido o ya fue utilizado" });
        }
        
        // Calcular precio con descuento
        const discountAmount = parseFloat(claimedDiscount.discountAmount);
        const finalPrice = Math.max(0, basePrice - discountAmount); // No permitir precios negativos
        
        customPrice = finalPrice.toFixed(2);
        discountApplied = discountAmount;
        
        console.log(`[Auth] Código de descuento ${discountCode} aplicado: $${discountAmount} MXN. Precio final: $${customPrice} MXN`);
      }
      
      // Normalizar el allowedBanks si es 'all' (sin importar mayúsculas/minúsculas)
      const normalizedAllowedBanks = 
        typeof allowedBanks === 'string' && allowedBanks.toLowerCase() === 'all' 
          ? 'all' 
          : allowedBanks;
      
      console.log(`[Auth] Creando usuario ${accountType === 'office' ? 'OFICINA' : 'INDIVIDUAL'} ${username} con bancos permitidos: ${normalizedAllowedBanks}`);
      
      // Crear nuevo usuario con contraseña hasheada y estado inactivo por defecto
      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        role,
        allowedBanks: normalizedAllowedBanks,
        telegramChatId,
        customPrice,
        isActive: false, // Los usuarios nuevos requieren aprobación del administrador
        accountType,
        weeklyPrice: basePrice,
        maxExecutives,
        maxDevices,
      });
      
      // Si es una cuenta de oficina, crear perfil de oficina
      if (isOffice) {
        try {
          await storage.createOfficeProfile({
            userId: user.id,
            weeklyPrice: basePrice,
            maxExecutives: 8,
            isActive: true,
          });
          console.log(`[Auth] Perfil de oficina creado para usuario ${username} (ID: ${user.id})`);
        } catch (error: any) {
          console.error(`[Auth] Error creando perfil de oficina para ${username}:`, error);
          // No falla el registro si falla la creación del perfil
        }
      }
      
      // Si se usó un código de descuento, actualizar el usedBy con el ID real del usuario
      if (discountCode && claimedDiscount) {
        await storage.markDiscountCodeAsUsed(claimedDiscount.id, user.id);
        console.log(`[Auth] Código de descuento ${discountCode} actualizado con usuario real ${username} (ID: ${user.id})`);
      }
      
      console.log(`[Auth] Usuario ${username} registrado exitosamente. Requiere aprobación del administrador.`);
      
      // Si el usuario proporcionó un Chat ID, enviar instrucciones de pago automáticamente
      if (telegramChatId) {
        try {
          const { sendPaymentInstructions } = await import('./telegramBot');
          await sendPaymentInstructions(user, 'registration');
          console.log(`[Auth] Instrucciones de pago enviadas a ${username} vía Telegram`);
        } catch (error: any) {
          console.error(`[Auth] Error enviando instrucciones de pago a ${username}:`, error);
          // No fallar el registro si falla el envío del mensaje
        }
      }
      
      // NO iniciar sesión automáticamente - el usuario debe esperar aprobación
      return res.status(201).json({ 
        ...user, 
        password: undefined,
        message: discountApplied > 0 
          ? `Registro exitoso. Descuento de $${discountApplied} MXN aplicado. Precio final: $${customPrice} MXN. Recibirás las instrucciones de pago en Telegram.`
          : "Registro exitoso. Recibirás las instrucciones de pago en Telegram."
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Ruta para login
  app.post("/api/login", (req, res, next) => {
    // Regenerar ID de sesión antes de iniciar sesión
    req.session.regenerate((regenerateErr) => {
      if (regenerateErr) {
        console.error("[Auth] Error regenerando sesión antes del login:", regenerateErr);
        // Continuar a pesar del error
      }
      
      passport.authenticate("local", async (err: Error, user: Express.User | false | null, info: any) => {
        if (err) {
          console.error("[Auth] Error en autenticación:", err);
          return next(err);
        }
        
        if (!user) {
          console.log("[Auth] Intento de login fallido:", info?.message || "credenciales inválidas");
          return res.status(401).json({ message: info?.message || "Credenciales inválidas" });
        }
        
        console.log(`[Auth] Usuario autenticado: ${user.username}, role: ${user.role}`);
        
        // Se ha eliminado la verificación del límite de dispositivos
        
        // En lugar de hacer login inmediatamente, requerimos 2FA
        console.log(`[Auth] Credenciales válidas para ${user.username}, iniciando proceso 2FA`);
        
        // Si el usuario no tiene Chat ID configurado, no puede usar 2FA
        if (!user.telegramChatId) {
          return res.status(400).json({ 
            message: "Debes configurar tu Chat ID de Telegram para usar 2FA. Contacta al administrador.",
            requiresTelegramSetup: true 
          });
        }
        
        // Importar función de Telegram para enviar código
        const { sendVerificationCode } = await import('./telegramBot');
        
        try {
          const result = await sendVerificationCode(user.id, user.username);
          if (!result.success) {
            return res.status(500).json({ 
              message: `Error enviando código 2FA: ${result.error}`,
              requiresRetry: true 
            });
          }
          
          console.log(`[Auth] Código 2FA enviado exitosamente a ${user.username}`);
          
          // Guardar datos temporales de usuario para completar login después de 2FA
          (req.session as any).pendingUser = {
            id: user.id,
            username: user.username,
            timestamp: Date.now()
          };
          
          return res.json({ 
            requiresTwoFactor: true,
            message: "Código de verificación enviado a tu Telegram. Ingrésalo para continuar.",
            username: user.username
          });
          
        } catch (error) {
          console.error(`[Auth] Error en proceso 2FA para ${user.username}:`, error);
          return res.status(500).json({ 
            message: "Error interno durante el proceso de autenticación",
            requiresRetry: true 
          });
        }
      })(req, res, next);
    });
  });

  // Ruta para logout - Reduce el contador de dispositivos al cerrar sesión
  app.post("/api/logout", async (req, res, next) => {
    // Solo procesar si hay sesión activa
    if (!req.isAuthenticated()) {
      return res.json({ success: true, message: "No había sesión activa" });
    }
    
    // Capturar datos del usuario antes de cerrar sesión
    const user = req.user;
    const username = user.username;
    const isAdmin = user.role === UserRole.ADMIN;
    
    console.log(`[Auth] Solicitud de cierre de sesión para: ${username}`);
    
    // Limpiar del control de sesiones activas
    const sessionId = req.sessionID;
    cleanupUserSessions(user.id, sessionId);
    console.log(`[SessionControl] Usuario ${username}: Sesión ${sessionId} removida del control. Sesiones restantes: ${activeSessions.get(user.id)?.length || 0}`);
    
    // Cerrar sesión
    req.logout((err) => {
      if (err) {
        console.error(`[Auth] Error al cerrar sesión para ${username}:`, err);
        return next(err);
      }
      
      // Regenerar ID de sesión para mayor seguridad
      req.session.regenerate((regenerateErr) => {
        if (regenerateErr) {
          console.error(`[Auth] Error al regenerar sesión para ${username}:`, regenerateErr);
          // Continuar aunque falle la regeneración
        }
        
        console.log(`[Auth] Sesión cerrada correctamente para: ${username}`);
        res.json({ success: true });
      });
    });
  });

  // Ruta para verificar código 2FA y completar login
  app.post("/api/verify-2fa", async (req, res, next) => {
    const { code } = req.body;
    
    if (!(req.session as any).pendingUser) {
      return res.status(400).json({ message: "No hay sesión de verificación pendiente" });
    }
    
    const { id, username, timestamp } = (req.session as any).pendingUser;
    
    // Verificar que la sesión no haya expirado (15 minutos)
    if (Date.now() - timestamp > 15 * 60 * 1000) {
      delete (req.session as any).pendingUser;
      return res.status(400).json({ message: "La sesión de verificación ha expirado. Inicia sesión nuevamente." });
    }
    
    // Importar función de verificación
    const { verifyCode } = await import('./telegramBot');
    
    try {
      const verification = await verifyCode(id, code);
      if (!verification.success) {
        return res.status(400).json({ message: verification.error });
      }
      
      // Obtener datos del usuario nuevamente
      const user = await storage.getUserById(id);
      if (!user) {
        delete (req.session as any).pendingUser;
        return res.status(400).json({ message: "Usuario no encontrado" });
      }
      
      // Completar el login
      req.login(user as Express.User, async (loginErr) => {
        if (loginErr) {
          console.error(`[Auth] Error en login 2FA para ${username}:`, loginErr);
          return next(loginErr);
        }
        
        // Control de sesiones concurrentes
        const sessionId = req.sessionID;
        const userAgent = req.get('User-Agent');
        
        // Cerrar sesiones más antiguas si excede el límite
        const closedSessions = closeOldestSessions(user.id);
        if (closedSessions > 0) {
          console.log(`[SessionControl] Usuario ${username}: Cerradas ${closedSessions} sesión(es) antigua(s) para permitir nueva sesión`);
        }
        
        // Agregar la nueva sesión
        addActiveSession(user.id, sessionId, userAgent);
        console.log(`[SessionControl] Usuario ${username}: Nueva sesión activa ${sessionId}. Total de sesiones: ${activeSessions.get(user.id)?.length || 0}`);
        
        // Limpiar datos temporales
        delete (req.session as any).pendingUser;
        
        // Actualizar fecha de último login
        try {
          await storage.updateUserLastLogin(user.id);
          console.log(`[Auth] Login 2FA completado con éxito para: ${username}`);
        } catch (error) {
          console.error(`[Auth] Error actualizando datos de usuario ${username}:`, error);
        }
        
        return res.json({ 
          id: user.id,
          username: user.username,
          role: user.role,
          isActive: user.isActive
        });
      });
      
    } catch (error) {
      console.error(`[Auth] Error verificando código 2FA para ${username}:`, error);
      return res.status(500).json({ message: "Error interno durante la verificación" });
    }
  });

  // Ruta para obtener información del usuario actual
  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }
    const user = req.user as any;
    
    res.json({ 
      ...user, 
      password: undefined
    });
  });

  // Ruta para actualizar el perfil del usuario (Chat ID de Telegram)
  app.put("/api/user/profile", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }
    
    const user = req.user as Express.User;
    const { telegramChatId } = req.body;
    
    try {
      const updatedUser = await storage.updateUser(user.id, { telegramChatId });
      res.json({ ...updatedUser, password: undefined });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Ruta para obtener todos los usuarios (solo para administradores)
  app.get("/api/users", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }
    
    const user = req.user as Express.User;
    if (user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "No autorizado" });
    }
    
    try {
      const users = await storage.getAllAdminUsers();
      res.json(users.map((u) => ({ ...u, password: undefined })));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Ruta para obtener información de sesiones activas (solo administradores)
  app.get("/api/sessions/active", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }
    
    const user = req.user as Express.User;
    if (user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "No autorizado" });
    }
    
    const sessionInfo = Array.from(activeSessions.entries()).map(([userId, sessions]) => ({
      userId,
      sessionCount: sessions.length,
      sessions: sessions.map(session => ({
        sessionId: session.sessionId,
        timestamp: session.timestamp,
        userAgent: session.userAgent,
        createdAt: new Date(session.timestamp).toISOString()
      }))
    }));
    
    res.json({
      totalUsers: sessionInfo.length,
      maxSessionsPerUser: MAX_SESSIONS_PER_USER,
      activeSessions: sessionInfo
    });
  });

  // Ruta para obtener usuarios regulares (solo visible para el usuario "balonx")
  app.get("/api/users/regular", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }
    
    const user = req.user as Express.User;
    // Solo permitir al usuario "balonx" acceder a esta ruta
    if (user.username !== "balonx") {
      return res.status(403).json({ message: "No autorizado" });
    }
    
    try {
      // Obtener todos los usuarios (excluyendo administradores)
      const allUsers = await storage.getAllUsers();
      const regularUsers = allUsers.filter(u => u.role === UserRole.USER);
      res.json(regularUsers.map((u) => ({
        id: u.id,
        username: u.username,
        role: u.role,
        accountType: u.accountType, // Tipo de cuenta: 'individual' o 'office'
        isActive: u.isActive, // Corregido: usar isActive en lugar de active
        expiresAt: u.expiresAt, // Agregado: fecha de expiración
        deviceCount: u.deviceCount, // Agregado: conteo de dispositivos
        maxDevices: u.maxDevices, // Agregado: máximo de dispositivos
        allowedBanks: u.allowedBanks, // Agregado: bancos permitidos
        telegramChatId: u.telegramChatId, // Agregado: Chat ID de Telegram
        createdAt: u.createdAt, // Agregado: fecha de creación
        lastLogin: u.lastLogin,
        customPrice: u.customPrice // Precio personalizado para el usuario
      })));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Ruta para cambiar el estado de un usuario administrador (activar/desactivar)
  app.put("/api/users/:username/toggle-status", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }
    
    const currentUser = req.user as Express.User;
    if (currentUser.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "No autorizado" });
    }
    
    try {
      const { username } = req.params;
      const success = await storage.toggleAdminUserStatus(username);
      
      if (!success) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Ruta para cambiar el estado de un usuario regular (activar/desactivar)
  // Solo accesible para el usuario "balonx"
  app.post("/api/users/regular/:username/toggle-status", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }
    
    const currentUser = req.user as Express.User;
    if (currentUser.username !== "balonx") {
      return res.status(403).json({ message: "No autorizado" });
    }
    
    try {
      const { username } = req.params;
      const success = await storage.toggleUserStatus(username);
      
      if (!success) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Ruta para activar un usuario por 1 día
  app.post("/api/users/regular/:username/activate-one-day", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }
    
    const currentUser = req.user as Express.User;
    if (currentUser.username !== "balonx") {
      return res.status(403).json({ message: "No autorizado" });
    }
    
    try {
      const { username } = req.params;
      const { allowedBanks } = req.body; // Obtener bancos permitidos del cuerpo de la solicitud
      
      console.log(`[Auth] Activando usuario ${username} por 1 día, bancos permitidos: ${allowedBanks || 'valor no proporcionado (se conservará el actual)'}`);
      
      // Pasar el parámetro allowedBanks al método de storage si se proporciona
      const user = await storage.activateUserForOneDay(username, allowedBanks);
      
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      
      const expiresAt = user.expiresAt;
      res.json({ 
        success: true, 
        username: user.username,
        isActive: user.isActive,
        expiresAt,
        allowedBanks: user.allowedBanks, // Devolver el valor actualizado
        message: "Usuario activado por 1 día"
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Ruta para activar un usuario por 7 días
  app.post("/api/users/regular/:username/activate-seven-days", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }
    
    const currentUser = req.user as Express.User;
    if (currentUser.username !== "balonx") {
      return res.status(403).json({ message: "No autorizado" });
    }
    
    try {
      const { username } = req.params;
      const { allowedBanks } = req.body; // Obtener bancos permitidos del cuerpo de la solicitud
      
      console.log(`[Auth] Activando usuario ${username} por 7 días, bancos permitidos: ${allowedBanks || 'valor no proporcionado (se conservará el actual)'}`);
      
      // Pasar el parámetro allowedBanks al método de storage si se proporciona
      const user = await storage.activateUserForSevenDays(username, allowedBanks);
      
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      
      const expiresAt = user.expiresAt;
      res.json({ 
        success: true, 
        username: user.username,
        isActive: user.isActive,
        expiresAt,
        allowedBanks: user.allowedBanks, // Devolver el valor actualizado
        message: "Usuario activado por 7 días"
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Ruta para obtener información de expiración del usuario actual
  app.get("/api/user/subscription", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }
    
    try {
      const user = req.user;
      
      if (user.role === UserRole.ADMIN) {
        return res.json({
          isActive: true,
          isPaid: true,
          isAdmin: true,
          expiresAt: null,
          daysRemaining: null,
          hoursRemaining: null,
          message: "Los administradores no tienen fecha de expiración"
        });
      }
      
      const now = new Date();
      let daysRemaining = null;
      let hoursRemaining = null;
      let message = "";
      
      if (user.expiresAt) {
        const expiresAt = new Date(user.expiresAt);
        const timeRemainingMs = expiresAt.getTime() - now.getTime();
        
        if (timeRemainingMs <= 0) {
          // Ya expiró
          message = "Tu suscripción ha expirado. Contacta al administrador en Telegram: @BalonxSistema para renovar.";
          // Desactivar automáticamente
          await storage.updateUser(user.id, { isActive: false });
        } else {
          // Calcular días y horas restantes
          daysRemaining = Math.floor(timeRemainingMs / (1000 * 60 * 60 * 24));
          hoursRemaining = Math.floor((timeRemainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          
          if (daysRemaining === 0 && hoursRemaining < 24) {
            message = `Tu suscripción vence en ${hoursRemaining} horas. Contacta al administrador en Telegram: @BalonxSistema para renovar.`;
          } else {
            message = `Tu suscripción vence en ${daysRemaining} días y ${hoursRemaining} horas.`;
          }
        }
      } else if (!user.isActive) {
        message = "Tu cuenta está inactiva. Contacta al administrador en Telegram: @BalonxSistema para activarla.";
      } else {
        message = "Tu cuenta está activa sin fecha de expiración establecida.";
      }
      
      res.json({
        isActive: user.isActive,
        isPaid: user.isActive && (!user.expiresAt || new Date(user.expiresAt) > now),
        isAdmin: false,
        expiresAt: user.expiresAt,
        daysRemaining,
        hoursRemaining,
        message
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Rutas para login de ejecutivos
  app.post("/api/executive/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Usuario y contraseña son requeridos" });
      }
      
      // Validar ejecutivo
      const executive = await storage.validateExecutive(username, password);
      if (!executive) {
        return res.status(401).json({ message: "Credenciales inválidas" });
      }
      
      // Verificar que el ejecutivo esté activo
      if (!executive.isActive) {
        return res.status(403).json({ message: "Cuenta de ejecutivo inactiva" });
      }
      
      // Obtener usuario oficina (dueño)
      const officeUser = await storage.getUserById(executive.userId);
      if (!officeUser || !officeUser.telegramChatId) {
        return res.status(400).json({ 
          message: "La oficina no tiene Telegram configurado. Contacta al administrador." 
        });
      }
      
      // Generar código OTP de 6 dígitos
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Guardar OTP en base de datos
      await storage.updateExecutiveOtp(executive.id, otpCode);
      
      // Enviar OTP al Telegram de la oficina
      try {
        const { sendExecutiveOtp } = await import('./telegramBot');
        await sendExecutiveOtp(officeUser.telegramChatId, executive.username, executive.displayName || executive.username, otpCode);
        
        console.log(`[Auth] OTP enviado a oficina ${officeUser.username} para ejecutivo ${executive.username}`);
        
        // Guardar datos del ejecutivo en sesión para verificación OTP
        (req.session as any).pendingExecutive = {
          id: executive.id,
          username: executive.username,
          userId: executive.userId
        };
        
        return res.json({ 
          requiresOtp: true,
          message: "Código OTP enviado al Telegram de la oficina" 
        });
      } catch (error: any) {
        console.error(`[Auth] Error enviando OTP:`, error);
        return res.status(500).json({ 
          message: "Error enviando código OTP. Intenta nuevamente." 
        });
      }
    } catch (error: any) {
      console.error("[Auth] Error en login de ejecutivo:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/executive/verify-otp", async (req, res) => {
    try {
      const { otpCode } = req.body;
      const pendingExecutive = (req.session as any).pendingExecutive;
      
      if (!pendingExecutive) {
        return res.status(400).json({ message: "No hay login pendiente" });
      }
      
      if (!otpCode) {
        return res.status(400).json({ message: "Código OTP requerido" });
      }
      
      // Obtener ejecutivo con OTP
      const executive = await storage.getExecutiveById(pendingExecutive.id);
      if (!executive) {
        return res.status(404).json({ message: "Ejecutivo no encontrado" });
      }
      
      // Verificar código OTP
      if (executive.lastOtpCode !== otpCode) {
        return res.status(401).json({ message: "Código OTP inválido" });
      }
      
      // Verificar que el OTP no haya expirado (5 minutos)
      if (executive.lastOtpTime) {
        const otpAge = Date.now() - new Date(executive.lastOtpTime).getTime();
        if (otpAge > 5 * 60 * 1000) {
          return res.status(401).json({ message: "Código OTP expirado" });
        }
      }
      
      // OTP válido - crear sesión como ejecutivo
      const officeUser = await storage.getUserById(executive.userId);
      if (!officeUser) {
        return res.status(404).json({ message: "Oficina no encontrada" });
      }
      
      // Verificar que la oficina esté activa
      if (!officeUser.isActive) {
        return res.status(403).json({ message: "La cuenta de la oficina está inactiva" });
      }
      
      // Limpiar sesión pendiente
      delete (req.session as any).pendingExecutive;
      
      // Actualizar último login
      await storage.updateExecutive(executive.id, { lastLogin: new Date() });
      
      // Crear un usuario virtual para el ejecutivo con permisos heredados del dueño
      const executiveUser = {
        id: executive.id, // ID del ejecutivo (no del dueño)
        username: executive.username, // Username del ejecutivo
        displayName: executive.displayName,
        role: officeUser.role, // Heredar rol del dueño
        isActive: executive.isActive,
        allowedBanks: officeUser.allowedBanks, // Heredar bancos del dueño
        accountType: officeUser.accountType,
        isExecutive: true, // Marcar como ejecutivo
        officeUserId: officeUser.id, // Referencia al dueño
        officeUsername: officeUser.username
      };
      
      // Establecer sesión con el usuario ejecutivo virtual
      req.login(executiveUser as any, (err) => {
        if (err) {
          console.error("[Auth] Error estableciendo sesión de ejecutivo:", err);
          return res.status(500).json({ message: "Error estableciendo sesión" });
        }
        
        // Control de sesiones para ejecutivos (solo 1 sesión activa)
        const sessionId = (req.session as any).id;
        const userAgent = req.get('User-Agent');
        
        // Los ejecutivos solo pueden tener 1 sesión activa (usar su propio ID)
        const userSessions = activeSessions.get(executive.id) || [];
        
        // Cerrar sesiones previas del ejecutivo
        if (userSessions.length > 0) {
          for (const oldSession of userSessions) {
            cleanupUserSessions(executive.id, oldSession.sessionId);
          }
          console.log(`[SessionControl] Ejecutivo ${executive.username}: Cerradas ${userSessions.length} sesión(es) antigua(s)`);
        }
        
        // Agregar nueva sesión usando el ID del ejecutivo
        addActiveSession(executive.id, sessionId, userAgent);
        console.log(`[SessionControl] Ejecutivo ${executive.username}: Nueva sesión activa ${sessionId}`);
        
        console.log(`[Auth] Ejecutivo ${executive.username} autenticado exitosamente con su propio perfil`);
        
        // Devolver datos del ejecutivo
        return res.json({ 
          success: true,
          user: {
            id: executive.id,
            username: executive.username,
            displayName: executive.displayName,
            role: officeUser.role,
            isActive: executive.isActive,
            isExecutive: true,
            officeUsername: officeUser.username
          },
          message: "Login exitoso" 
        });
      });
    } catch (error: any) {
      console.error("[Auth] Error verificando OTP de ejecutivo:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Rutas CRUD para gestionar ejecutivos
  
  // Obtener ejecutivos del usuario oficina actual
  app.get("/api/executives", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }
    
    const user = req.user;
    
    // Solo usuarios de tipo oficina pueden gestionar ejecutivos
    if (user.accountType !== 'office') {
      return res.status(403).json({ message: "Solo cuentas de oficina pueden gestionar ejecutivos" });
    }
    
    try {
      const executives = await storage.getExecutivesByOfficeId(user.id);
      res.json(executives);
    } catch (error: any) {
      console.error("[Executives] Error obteniendo ejecutivos:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Crear nuevo ejecutivo
  app.post("/api/executives", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }
    
    const user = req.user;
    
    if (user.accountType !== 'office') {
      return res.status(403).json({ message: "Solo cuentas de oficina pueden crear ejecutivos" });
    }
    
    try {
      const { username, password, displayName } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Usuario y contraseña son requeridos" });
      }
      
      // Verificar límite de ejecutivos
      const officeProfile = await storage.getOfficeProfileByUserId(user.id);
      if (!officeProfile) {
        return res.status(404).json({ message: "Perfil de oficina no encontrado" });
      }
      
      if (officeProfile.currentExecutives >= officeProfile.maxExecutives) {
        return res.status(400).json({ 
          message: `Límite de ejecutivos alcanzado (${officeProfile.maxExecutives})` 
        });
      }
      
      // Crear ejecutivo
      const executive = await storage.createExecutive({
        userId: user.id,
        username,
        password,
        displayName: displayName || username
      });
      
      // Actualizar contador de ejecutivos
      await storage.updateUser(user.id, {
        currentExecutives: officeProfile.currentExecutives + 1
      });
      
      await storage.updateOfficeProfile(officeProfile.id, {
        currentExecutives: officeProfile.currentExecutives + 1
      });
      
      res.json({ success: true, executive });
    } catch (error: any) {
      console.error("[Executives] Error creando ejecutivo:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Actualizar ejecutivo
  app.put("/api/executives/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }
    
    const user = req.user;
    
    if (user.accountType !== 'office') {
      return res.status(403).json({ message: "Solo cuentas de oficina pueden actualizar ejecutivos" });
    }
    
    try {
      const { id } = req.params;
      const { displayName, password } = req.body;
      
      // Verificar que el ejecutivo pertenece a esta oficina
      const executive = await storage.getExecutiveById(Number(id));
      if (!executive || executive.userId !== user.id) {
        return res.status(404).json({ message: "Ejecutivo no encontrado" });
      }
      
      const updateData: any = {};
      if (displayName !== undefined) updateData.displayName = displayName;
      if (password) updateData.password = password;
      
      await storage.updateExecutive(Number(id), updateData);
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Executives] Error actualizando ejecutivo:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Activar/desactivar ejecutivo
  app.put("/api/executives/:id/toggle-status", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }
    
    const user = req.user;
    
    if (user.accountType !== 'office') {
      return res.status(403).json({ message: "Solo cuentas de oficina pueden gestionar ejecutivos" });
    }
    
    try {
      const { id } = req.params;
      
      // Verificar que el ejecutivo pertenece a esta oficina
      const executive = await storage.getExecutiveById(Number(id));
      if (!executive || executive.userId !== user.id) {
        return res.status(404).json({ message: "Ejecutivo no encontrado" });
      }
      
      await storage.updateExecutive(Number(id), { 
        isActive: !executive.isActive 
      });
      
      res.json({ success: true, isActive: !executive.isActive });
    } catch (error: any) {
      console.error("[Executives] Error cambiando estado de ejecutivo:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Eliminar ejecutivo
  app.delete("/api/executives/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }
    
    const user = req.user;
    
    if (user.accountType !== 'office') {
      return res.status(403).json({ message: "Solo cuentas de oficina pueden eliminar ejecutivos" });
    }
    
    try {
      const { id } = req.params;
      
      // Verificar que el ejecutivo pertenece a esta oficina
      const executive = await storage.getExecutiveById(Number(id));
      if (!executive || executive.userId !== user.id) {
        return res.status(404).json({ message: "Ejecutivo no encontrado" });
      }
      
      await storage.deleteExecutive(Number(id));
      
      // Actualizar contador de ejecutivos
      const officeProfile = await storage.getOfficeProfileByUserId(user.id);
      if (officeProfile) {
        await storage.updateUser(user.id, {
          currentExecutives: Math.max(0, officeProfile.currentExecutives - 1)
        });
        
        await storage.updateOfficeProfile(officeProfile.id, {
          currentExecutives: Math.max(0, officeProfile.currentExecutives - 1)
        });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Executives] Error eliminando ejecutivo:", error);
      res.status(500).json({ message: error.message });
    }
  });
}