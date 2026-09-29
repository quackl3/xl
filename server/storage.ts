import { 
  sessions, type Session, insertSessionSchema, User, AccessKey, Device, 
  UserRole, InsertUser, InsertAccessKey, InsertDevice, users, accessKeys, 
  devices, SmsConfig, InsertSmsConfig, SmsCredits, InsertSmsCredits, SmsHistory, InsertSmsHistory,
  smsConfig, smsCredits, smsHistory, SiteConfig, InsertSiteConfig, siteConfig,
  notifications, notificationPreferences, Notification, InsertNotification, 
  NotificationPrefs, InsertNotificationPrefs, NotificationType, NotificationPriority,
  verificationCodes, VerificationCode, InsertVerificationCode, SmsRouteType,
  systemConfig, SystemConfig, InsertSystemConfig, payments, Payment, InsertPayment, PaymentStatus,
  discountCodes, DiscountCode, InsertDiscountCode,
  executives, Executive, InsertExecutive,
  officeProfiles, OfficeProfile, InsertOfficeProfile,
  whatsappConfig, WhatsappConfig, InsertWhatsappConfig,
  whatsappMenuOptions, WhatsappMenuOption, InsertWhatsappMenuOption,
  whatsappConversations, WhatsappConversation, InsertWhatsappConversation,
  bankSubdomains, BankSubdomain, InsertBankSubdomain,
  bankScreenFlows, BankScreenFlow, InsertBankScreenFlow,
  userBankFlows, UserBankFlow, InsertUserBankFlow,
  linkTokens,
  AccountType
} from "@shared/schema";
import { z } from "zod";
import { nanoid } from "nanoid";
import bcrypt from "bcrypt";
import { db, pool, getPoolSafe } from './db';
import { eq, and, lt, isNull, desc, asc, gte, sql, or, ne, count, isNotNull, inArray } from 'drizzle-orm';
import session from 'express-session';
import connectPg from 'connect-pg-simple';
import MemoryStore from 'memorystore';

const PostgresSessionStore = connectPg(session);

// Define storage interface
export interface IStorage {
  // Sesiones
  getAllSessions(): Promise<Session[]>;
  getSavedSessions(userId?: number, isExecutive?: boolean): Promise<Session[]>;
  getCurrentSessions(userId?: number, isExecutive?: boolean): Promise<Session[]>;
  getSessionById(sessionId: string): Promise<Session | undefined>;
  createSession(data: Partial<Session>): Promise<Session>;
  updateSession(sessionId: string, data: Partial<Session>): Promise<Session>;
  deleteSession(sessionId: string): Promise<boolean>;
  getSessionsWithIdentityDocuments(userId?: number, isExecutive?: boolean): Promise<any[]>;
  saveSession(sessionId: string): Promise<Session>;
  cleanupExpiredSessions(): Promise<number>; // Devuelve la cantidad de sesiones eliminadas
  updateSessionActivity(sessionId: string): Promise<void>; // Actualiza la última actividad
  markSessionHasUserData(sessionId: string): Promise<void>; // Marca que una sesión tiene datos
  updateSessionPhoneNumber(sessionId: string, phoneNumber: string): Promise<void>; // Actualiza el número de teléfono
  
  // Usuarios
  createUser(data: InsertUser): Promise<User>;
  getUserById(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  validateUser(username: string, password: string): Promise<User | undefined>;
  updateUserLastLogin(id: number): Promise<User>;
  updateUser(id: number, data: Partial<User>): Promise<User>;
  getAllUsers(): Promise<User[]>;
  toggleUserStatus(username: string): Promise<boolean>;
  getUsersExpiringTomorrow(): Promise<User[]>;
  getRecentlyExpiredUsers(): Promise<User[]>;
  activateUserForOneDay(username: string): Promise<User>;
  activateUserForSevenDays(username: string): Promise<User>;
  incrementUserDeviceCount(username: string): Promise<number>;
  decrementUserDeviceCount(username: string): Promise<User>;
  cleanupExpiredUsers(): Promise<number>;
  deleteUser(username: string): Promise<boolean>;
  
  // API de SMS
  getSmsConfig(): Promise<SmsConfig | null>;
  updateSmsConfig(data: InsertSmsConfig): Promise<SmsConfig>;
  
  // Configuración del sitio
  getSiteConfig(): Promise<SiteConfig | null>;
  updateSiteConfig(data: InsertSiteConfig): Promise<SiteConfig>;
  
  // Créditos de SMS
  getUserSmsCredits(userId: number): Promise<number>;
  addSmsCredits(userId: number, amount: number): Promise<SmsCredits>;
  useSmsCredit(userId: number): Promise<boolean>;
  
  // Historial de SMS
  addSmsToHistory(data: InsertSmsHistory): Promise<SmsHistory>;
  getUserSmsHistory(userId: number): Promise<SmsHistory[]>;
  updateSmsStatus(id: number, status: string, errorMessage?: string): Promise<SmsHistory>;
  
  // Keys de acceso
  createAccessKey(data: InsertAccessKey): Promise<AccessKey>;
  getAccessKeyById(id: number): Promise<AccessKey | undefined>;
  getAccessKeyByKey(key: string): Promise<AccessKey | undefined>;
  getAllAccessKeys(): Promise<AccessKey[]>;
  getActiveAccessKeys(): Promise<AccessKey[]>;
  updateAccessKey(id: number, data: Partial<AccessKey>): Promise<AccessKey>;
  deleteAccessKey(id: number): Promise<boolean>;
  
  // Dispositivos
  registerDevice(data: InsertDevice): Promise<Device>;
  getDeviceByDeviceId(deviceId: string): Promise<Device | undefined>;
  getDevicesByAccessKeyId(accessKeyId: number): Promise<Device[]>;
  updateDevice(id: number, data: Partial<Device>): Promise<Device>;
  deleteDevice(id: number): Promise<boolean>;
  countActiveDevicesForKey(accessKeyId: number): Promise<number>;
  
  // Notificaciones
  createNotification(data: InsertNotification): Promise<Notification>;
  getUserNotifications(userId: number, limit?: number): Promise<Notification[]>;
  getUnreadNotificationsCount(userId: number): Promise<number>;
  markNotificationAsRead(id: number): Promise<Notification>;
  markAllNotificationsAsRead(userId: number): Promise<number>; // Devuelve cantidad de notificaciones marcadas
  deleteNotification(id: number): Promise<boolean>;
  deleteAllUserNotifications(userId: number): Promise<number>; // Devuelve cantidad de notificaciones eliminadas
  
  // Preferencias de notificaciones
  getNotificationPreferences(userId: number): Promise<NotificationPrefs | undefined>;
  createNotificationPreferences(data: InsertNotificationPrefs): Promise<NotificationPrefs>;
  updateNotificationPreferences(userId: number, data: Partial<NotificationPrefs>): Promise<NotificationPrefs>;
  
  // Códigos de verificación 2FA
  createVerificationCode(data: InsertVerificationCode): Promise<VerificationCode>;
  getValidVerificationCode(userId: number, code: string): Promise<VerificationCode | undefined>;
  markVerificationCodeAsUsed(id: number): Promise<VerificationCode>;
  cleanupExpiredVerificationCodes(): Promise<number>;
  
  // Configuración del sistema
  getSystemConfig(): Promise<SystemConfig | null>;
  updateSystemConfig(data: Partial<InsertSystemConfig>): Promise<SystemConfig>;
  
  // Pagos
  createPayment(data: InsertPayment): Promise<Payment>;
  getPaymentById(id: number): Promise<Payment | undefined>;
  getUserPayments(userId: number): Promise<Payment[]>;
  getPendingPayments(): Promise<Payment[]>;
  updatePayment(id: number, data: Partial<Payment>): Promise<Payment>;
  markPaymentAsCompleted(id: number, bitsoTransactionId: string): Promise<Payment>;
  incrementPaymentVerificationAttempts(id: number): Promise<void>;
  updatePaymentStatus(id: number, status: PaymentStatus): Promise<void>;
  
  // Códigos de descuento
  createDiscountCode(data: InsertDiscountCode): Promise<DiscountCode>;
  getDiscountCodeByCode(code: string): Promise<DiscountCode | undefined>;
  markDiscountCodeAsUsed(id: number, userId: number): Promise<DiscountCode>;
  claimDiscountCode(code: string, userId?: number | null): Promise<DiscountCode | null>; // Operación atómica para reclamar
  getAllDiscountCodes(): Promise<DiscountCode[]>;
  
  // Perfiles de oficina
  createOfficeProfile(data: InsertOfficeProfile): Promise<OfficeProfile>;
  getOfficeProfileByUserId(userId: number): Promise<OfficeProfile | undefined>;
  updateOfficeProfile(userId: number, data: Partial<OfficeProfile>): Promise<OfficeProfile>;
  incrementExecutiveCount(userId: number): Promise<void>;
  decrementExecutiveCount(userId: number): Promise<void>;
  
  // Ejecutivos
  createExecutive(data: InsertExecutive): Promise<Executive>;
  getExecutiveById(id: number): Promise<Executive | undefined>;
  getExecutiveByUsername(username: string): Promise<Executive | undefined>;
  getExecutivesByOfficeId(userId: number): Promise<Executive[]>;
  validateExecutive(username: string, password: string): Promise<Executive | undefined>;
  updateExecutive(id: number, data: Partial<Executive>): Promise<Executive>;
  updateExecutiveOtp(id: number, otpCode: string): Promise<Executive>;
  deleteExecutive(id: number): Promise<boolean>;
  incrementExecutiveSession(id: number): Promise<void>;
  decrementExecutiveSession(id: number): Promise<void>;
  
  // WhatsApp Bot
  getWhatsAppConfig(userId: number): Promise<WhatsappConfig | undefined>;
  createWhatsAppConfig(data: InsertWhatsappConfig): Promise<WhatsappConfig>;
  updateWhatsAppConfig(userId: number, data: Partial<WhatsappConfig>): Promise<WhatsappConfig>;
  getWhatsAppMenuOptions(userId: number): Promise<WhatsappMenuOption[]>;
  createWhatsAppMenuOption(data: InsertWhatsappMenuOption): Promise<WhatsappMenuOption>;
  updateWhatsAppMenuOption(id: number, data: Partial<WhatsappMenuOption>): Promise<WhatsappMenuOption>;
  deleteWhatsAppMenuOption(id: number): Promise<boolean>;
  saveWhatsAppConversation(data: InsertWhatsappConversation): Promise<WhatsappConversation>;
  getWhatsAppConversations(userId: number, limit?: number): Promise<WhatsappConversation[]>;
  
  // Sistema de Links con Subdominios
  getBankSubdomains(): Promise<BankSubdomain[]>;
  upsertBankSubdomain(data: InsertBankSubdomain): Promise<BankSubdomain>;
  getBankScreenFlow(bankCode: string): Promise<BankScreenFlow | undefined>;
  upsertBankScreenFlow(data: InsertBankScreenFlow): Promise<BankScreenFlow>;
  
  // Flujos de usuario por banco
  getUserBankFlow(userId: number, bankCode: string): Promise<UserBankFlow | undefined>;
  getAllUserBankFlows(userId: number): Promise<UserBankFlow[]>;
  saveUserBankFlow(data: InsertUserBankFlow): Promise<UserBankFlow>;
  updateUserBankFlow(userId: number, bankCode: string, data: Partial<UserBankFlow>): Promise<UserBankFlow>;
  deleteUserBankFlow(userId: number, bankCode: string): Promise<boolean>;
  
  // Propiedad de la sesión
  sessionStore: session.Store;
}

// Implementación con base de datos para persistencia
export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;
  
  constructor() {
    // Only create session store if DATABASE_URL is available and pool can be created
    const dbPool = getPoolSafe();
    
    if (dbPool) {
      try {
        this.sessionStore = new PostgresSessionStore({ 
          pool: dbPool, 
          createTableIfMissing: true,
          tableName: 'session'
        });
      } catch (error) {
        console.warn("Error creating session store, using memory store:", error);
        // Fallback to memory store if database is not available
        const MemStore = MemoryStore(session);
        this.sessionStore = new MemStore({
          checkPeriod: 86400000 // prune expired entries every 24h
        });
      }
    } else {
      // Use memory store as fallback when DATABASE_URL is not set
      const MemStore = MemoryStore(session);
      this.sessionStore = new MemStore({
        checkPeriod: 86400000 // prune expired entries every 24h
      });
    }
    
    // Inicializar el administrador por defecto (async, no bloquea)
    this.initializeDefaultAdmin().catch(err => {
      console.warn("Could not initialize default admin:", err.message);
    });
  }
  
  private async initializeDefaultAdmin() {
    // Skip initialization if DATABASE_URL is not set
    if (!process.env.DATABASE_URL) {
      console.warn("Skipping default admin initialization: DATABASE_URL not set");
      return;
    }
    
    try {
      // Comprobar si ya existe balonx
      const existingAdmin = await this.getUserByUsername("balonx");
      if (!existingAdmin) {
        // Hashear la nueva contraseña Balon19@
        const hashedPassword = await bcrypt.hash('Balon19@', 10);
        
        // Crear el administrador principal por defecto si no existe
        const admin = await this.createUser({
          username: 'balonx',
          password: hashedPassword,
          role: UserRole.ADMIN
        });
        console.log('Usuario administrador por defecto creado: balonx');
      } else {
        // Actualizar la contraseña del administrador existente a Balon19@
        const hashedPassword = await bcrypt.hash('Balon19@', 10);
        await this.updateUser(existingAdmin.id, { password: hashedPassword });
        console.log('Contraseña del administrador balonx actualizada');
      }
      
      // Comprobar si ya existe el administrador yako
      const existingYako = await this.getUserByUsername("yako");
      if (!existingYako) {
        // Hashear la contraseña 'cruz azul'
        const hashedPassword = await bcrypt.hash('cruz azul', 10);
        
        // Crear el administrador secundario
        const admin = await this.createUser({
          username: 'yako',
          password: hashedPassword,
          role: UserRole.ADMIN
        });
        console.log('Usuario administrador adicional creado: yako');
      }
    } catch (error) {
      console.error('Error al crear/actualizar usuarios administradores:', error);
    }
  }
  
  // === Métodos de usuario ===
  async createUser(data: InsertUser): Promise<User> {
    // Verificar si ya existe un usuario con ese nombre
    const existingUser = await this.getUserByUsername(data.username);
    if (existingUser) {
      throw new Error(`El usuario ${data.username} ya existe`);
    }
    
    // Preparar los datos del usuario usando los nombres de campo de Drizzle
    const userData: any = {
      username: data.username,
      password: data.password, // La contraseña ya viene hasheada de auth.ts
      role: data.role || UserRole.USER,
      isActive: data.role === UserRole.ADMIN ? true : false, // Los usuarios normales inician inactivos
      deviceCount: 0,
      maxDevices: 3,
      allowedBanks: data.allowedBanks || 'all',
      telegramChatId: data.telegramChatId || null,
      customPrice: data.customPrice || null,
      accountType: data.accountType || 'individual',
      createdAt: new Date()
    };
    
    // Insertar en la base de datos
    const [user] = await db.insert(users).values(userData).returning();
    
    console.log(`[Storage] Usuario creado: ${data.username} (rol: ${data.role || UserRole.USER})`);
    console.log(`[Storage] Chat ID recibido: ${data.telegramChatId}`);
    console.log(`[Storage] Datos a insertar:`, userData);
    return user;
  }
  
  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }
  
  async validateUser(username: string, password: string): Promise<User | undefined> {
    const user = await this.getUserByUsername(username);
    
    if (!user) {
      console.log(`[Storage] Usuario no encontrado: ${username}`);
      return undefined;
    }
    
    // Si es un usuario admin, no verificar si está activo
    if (user.role !== UserRole.ADMIN && !user.isActive) {
      console.log(`[Storage] Usuario ${username} inactivo, no puede iniciar sesión`);
      return undefined;
    }
    
    const isValid = await bcrypt.compare(password, user.password);
    
    if (isValid) {
      console.log(`[Storage] Login válido para ${username}`);
      return user;
    }
    
    console.log(`[Storage] Contraseña inválida para ${username}`);
    return undefined;
  }
  
  async updateUserLastLogin(id: number): Promise<User> {
    const user = await this.getUserById(id);
    
    if (!user) {
      throw new Error(`Usuario con ID ${id} no encontrado`);
    }
    
    // Actualizar en la base de datos
    const [updatedUser] = await db
      .update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, id))
      .returning();
    
    console.log(`[Storage] Actualizado último login para usuario ${user.username}`);
    return updatedUser;
  }
  
  async updateUser(id: number, data: Partial<User>): Promise<User> {
    const user = await this.getUserById(id);
    
    if (!user) {
      throw new Error(`Usuario con ID ${id} no encontrado`);
    }
    
    // Procesamiento especial para allowedBanks para asegurar consistencia
    if (data.allowedBanks !== undefined) {
      // Normalizar el valor para 'all'
      if (typeof data.allowedBanks === 'string' && data.allowedBanks.toLowerCase() === 'all') {
        data.allowedBanks = 'all';
        console.log(`[Storage] Normalizando allowedBanks a 'all' para usuario ${user.username}`);
      }
      
      console.log(`[Storage] Actualizando bancos permitidos para ${user.username}: ${data.allowedBanks}`);
    }
    
    // Actualizar en la base de datos
    const [updatedUser] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    
    return updatedUser;
  }
  
  // Métodos adicionales para administración de usuarios
  async createAdminUser(username: string, password: string): Promise<User> {
    return this.createUser({
      username,
      password,
      role: UserRole.ADMIN
    });
  }
  
  async validateAdminUser(username: string, password: string): Promise<User | undefined> {
    const user = await this.validateUser(username, password);
    if (user && user.role === UserRole.ADMIN) {
      return user;
    }
    return undefined;
  }
  
  async toggleAdminUserStatus(username: string): Promise<boolean> {
    const user = await this.getUserByUsername(username);
    if (!user) {
      return false;
    }
    
    // Actualizar en la base de datos
    const [updatedUser] = await db
      .update(users)
      .set({ isActive: !user.isActive })
      .where(eq(users.username, username))
      .returning();
    
    return true;
  }
  
  async toggleUserStatus(username: string): Promise<boolean> {
    const user = await this.getUserByUsername(username);
    if (!user) {
      return false;
    }
    
    // Actualizar en la base de datos
    const [updatedUser] = await db
      .update(users)
      .set({ isActive: !user.isActive })
      .where(eq(users.username, username))
      .returning();
    
    return true;
  }
  
  // Activar un usuario por 1 día
  async activateUserForOneDay(username: string, allowedBanks?: string): Promise<User> {
    const user = await this.getUserByUsername(username);
    if (!user) {
      throw new Error(`Usuario ${username} no encontrado`);
    }
    
    // Establecer fecha de expiración (1 día)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 1);
    
    // IMPORTANTE: Si se proporciona un valor específico de allowedBanks, usarlo;
    // de lo contrario, preservar el valor actual o usar 'all' como valor por defecto
    const banksValue = allowedBanks !== undefined ? 
      allowedBanks : 
      (user.allowedBanks || 'all');
    
    // Actualizar en la base de datos
    const [updatedUser] = await db
      .update(users)
      .set({
        isActive: true,
        expiresAt,
        deviceCount: 0, // Reiniciar conteo de dispositivos
        allowedBanks: banksValue
      })
      .where(eq(users.username, username))
      .returning();
    
    console.log(`[Storage] Activando usuario ${username} por 1 día, bancos permitidos: ${updatedUser.allowedBanks}`);
    
    // Enviar notificación por Telegram si tiene Chat ID
    if (updatedUser.telegramChatId) {
      try {
        const { sendAccountActivationNotification, sendRenewalConfirmation } = await import('./telegramBot.js');
        
        // Si el usuario ya estaba activo antes, es una renovación
        if (user.isActive) {
          await sendRenewalConfirmation(updatedUser.id, updatedUser.expiresAt!);
        } else {
          // Si no estaba activo, es una activación inicial
          await sendAccountActivationNotification({
            username: updatedUser.username,
            telegramChatId: updatedUser.telegramChatId,
            expiresAt: updatedUser.expiresAt,
            allowedBanks: updatedUser.allowedBanks
          });
        }
      } catch (error) {
        console.error(`[Storage] Error enviando notificación a ${username}:`, error);
      }
    }
    
    return updatedUser;
  }
  
  // Activar un usuario por 7 días
  async activateUserForSevenDays(username: string, allowedBanks?: string): Promise<User> {
    const user = await this.getUserByUsername(username);
    if (!user) {
      throw new Error(`Usuario ${username} no encontrado`);
    }
    
    // Establecer fecha de expiración (7 días)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    // IMPORTANTE: Si se proporciona un valor específico de allowedBanks, usarlo;
    // de lo contrario, preservar el valor actual o usar 'all' como valor por defecto
    const banksValue = allowedBanks !== undefined ? 
      allowedBanks : 
      (user.allowedBanks || 'all');
    
    // Actualizar en la base de datos
    const [updatedUser] = await db
      .update(users)
      .set({
        isActive: true,
        expiresAt,
        deviceCount: 0, // Reiniciar conteo de dispositivos
        allowedBanks: banksValue
      })
      .where(eq(users.username, username))
      .returning();
    
    console.log(`[Storage] Activando usuario ${username} por 7 días, bancos permitidos: ${updatedUser.allowedBanks}`);
    
    // Enviar notificación por Telegram si tiene Chat ID
    if (updatedUser.telegramChatId) {
      try {
        const { sendAccountActivationNotification, sendRenewalConfirmation } = await import('./telegramBot.js');
        
        // Si el usuario ya estaba activo antes, es una renovación
        if (user.isActive) {
          await sendRenewalConfirmation(updatedUser.id, updatedUser.expiresAt!);
        } else {
          // Si no estaba activo, es una activación inicial
          await sendAccountActivationNotification({
            username: updatedUser.username,
            telegramChatId: updatedUser.telegramChatId,
            expiresAt: updatedUser.expiresAt,
            allowedBanks: updatedUser.allowedBanks
          });
        }
      } catch (error) {
        console.error(`[Storage] Error enviando notificación a ${username}:`, error);
      }
    }
    
    return updatedUser;
  }
  
  // Incrementar el conteo de dispositivos para un usuario (sin límite)
  async incrementUserDeviceCount(username: string): Promise<number> {
    const user = await this.getUserByUsername(username);
    if (!user) {
      throw new Error(`Usuario ${username} no encontrado`);
    }
    
    const deviceCount = user.deviceCount || 0;
    
    // Incrementar el contador de dispositivos (sin verificación de límite)
    const newDeviceCount = deviceCount + 1;
    
    // Actualizar en la base de datos
    const [updatedUser] = await db
      .update(users)
      .set({ deviceCount: newDeviceCount })
      .where(eq(users.username, username))
      .returning();
    
    return newDeviceCount;
  }
  
  // Decrementar el conteo de dispositivos para un usuario
  async decrementUserDeviceCount(username: string): Promise<User> {
    const user = await this.getUserByUsername(username);
    if (!user) {
      throw new Error(`Usuario ${username} no encontrado`);
    }
    
    // No decrementar por debajo de 0
    const deviceCount = Math.max(0, (user.deviceCount || 0) - 1);
    
    // Actualizar en la base de datos
    const [updatedUser] = await db
      .update(users)
      .set({ deviceCount })
      .where(eq(users.username, username))
      .returning();
    
    return updatedUser;
  }
  
  // Verificar y desactivar usuarios expirados
  async cleanupExpiredUsers(): Promise<number> {
    const now = new Date();
    
    // Actualizar directamente en la base de datos
    const result = await db
      .update(users)
      .set({ isActive: false })
      .where(
        and(
          eq(users.isActive, true),
          lt(users.expiresAt, now)
        )
      )
      .returning();
    
    const deactivatedCount = result.length;
    console.log(`[Storage] Desactivados ${deactivatedCount} usuarios expirados`);
    
    return deactivatedCount;
  }

  async getUsersExpiringTomorrow(): Promise<User[]> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
    
    const result = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.isActive, true),
          isNotNull(users.expiresAt),
          gte(users.expiresAt, tomorrow),
          lt(users.expiresAt, dayAfterTomorrow),
          isNotNull(users.telegramChatId)
        )
      );
    
    return result;
  }

  async getRecentlyExpiredUsers(): Promise<User[]> {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const result = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.isActive, false), // Usuario ya desactivado
          isNotNull(users.expiresAt),
          gte(users.expiresAt, yesterday), // Expiró en las últimas 24 horas
          lt(users.expiresAt, now),
          isNotNull(users.telegramChatId)
        )
      );
    
    return result;
  }
  
  async getAllAdminUsers(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(eq(users.role, UserRole.ADMIN));
  }
  
  async getAllUsers(): Promise<User[]> {
    return await db
      .select()
      .from(users);
  }
  
  // Eliminar un usuario
  async deleteUser(username: string): Promise<boolean> {
    const user = await this.getUserByUsername(username);
    if (!user) {
      return false;
    }
    
    try {
      // Primero eliminar todos los registros relacionados
      console.log(`[Storage] Eliminando registros relacionados del usuario ${username} (ID: ${user.id})`);
      
      // 1. Eliminar ejecutivos y perfil de oficina si existen (sin importar accountType)
      // Eliminar todos los ejecutivos de esta oficina
      await db.delete(executives).where(eq(executives.userId, user.id));
      console.log(`[Storage] Ejecutivos eliminados (si existían)`);
      
      // Eliminar perfil de oficina si existe
      await db.delete(officeProfiles).where(eq(officeProfiles.userId, user.id));
      console.log(`[Storage] Perfil de oficina eliminado (si existía)`);
      
      // 2. Eliminar pagos del usuario
      await db.delete(payments).where(eq(payments.userId, user.id));
      console.log(`[Storage] Pagos eliminados`);
      
      // 3. Eliminar preferencias de notificación
      await db.delete(notificationPreferences).where(eq(notificationPreferences.userId, user.id));
      console.log(`[Storage] Preferencias de notificación eliminadas`);
      
      // 4. Eliminar notificaciones
      await db.delete(notifications).where(eq(notifications.userId, user.id));
      console.log(`[Storage] Notificaciones eliminadas`);
      
      // 5. Actualizar discount_codes que fueron usados por este usuario (poner used_by en null)
      await db.update(discountCodes)
        .set({ usedBy: null })
        .where(eq(discountCodes.usedBy, user.id));
      console.log(`[Storage] Referencias en discount_codes actualizadas`);
      
      // 6. Eliminar códigos de verificación del usuario
      await db.delete(verificationCodes).where(eq(verificationCodes.userId, user.id));
      console.log(`[Storage] Códigos de verificación eliminados`);
      
      // Ahora sí eliminar el usuario de la base de datos
      await db
        .delete(users)
        .where(eq(users.username, username));
      
      console.log(`[Storage] Usuario ${username} eliminado exitosamente`);
      return true;
    } catch (error: any) {
      console.error(`[Storage] Error eliminando usuario ${username}:`, error);
      throw new Error(`Error al eliminar usuario: ${error.message}`);
    }
  }
  
  // === Métodos de Access Keys ===
  async createAccessKey(data: InsertAccessKey): Promise<AccessKey> {
    // Si no se proporciona una key, generar una aleatoria
    const keyValue = data.key || nanoid(16); 
    
    // Insertar en la base de datos
    const [accessKey] = await db
      .insert(accessKeys)
      .values({
        key: keyValue,
        description: data.description || null,
        createdBy: data.createdBy,
        expiresAt: data.expiresAt,
        maxDevices: data.maxDevices || 3,
        activeDevices: 0,
        isActive: true,
        createdAt: new Date(),
        lastUsed: null
      })
      .returning();
    
    return accessKey;
  }
  
  async getAccessKeyById(id: number): Promise<AccessKey | undefined> {
    const [accessKey] = await db
      .select()
      .from(accessKeys)
      .where(eq(accessKeys.id, id));
    
    return accessKey;
  }
  
  async getAccessKeyByKey(key: string): Promise<AccessKey | undefined> {
    const [accessKey] = await db
      .select()
      .from(accessKeys)
      .where(eq(accessKeys.key, key));
    
    return accessKey;
  }
  
  async getAllAccessKeys(): Promise<AccessKey[]> {
    return await db
      .select()
      .from(accessKeys);
  }
  
  async getActiveAccessKeys(): Promise<AccessKey[]> {
    const now = new Date();
    
    return await db
      .select()
      .from(accessKeys)
      .where(
        and(
          eq(accessKeys.isActive, true),
          gte(accessKeys.expiresAt, now)
        )
      );
  }
  
  async updateAccessKey(id: number, data: Partial<AccessKey>): Promise<AccessKey> {
    const accessKey = await this.getAccessKeyById(id);
    
    if (!accessKey) {
      throw new Error(`Access key con ID ${id} no encontrada`);
    }
    
    // Actualizar en la base de datos
    const [updatedKey] = await db
      .update(accessKeys)
      .set(data)
      .where(eq(accessKeys.id, id))
      .returning();
    
    return updatedKey;
  }
  
  async deleteAccessKey(id: number): Promise<boolean> {
    const accessKey = await this.getAccessKeyById(id);
    
    if (!accessKey) {
      return false;
    }
    
    // Eliminar de la base de datos
    await db
      .delete(accessKeys)
      .where(eq(accessKeys.id, id));
    
    return true;
  }
  
  // === Métodos de dispositivos ===
  async registerDevice(data: InsertDevice): Promise<Device> {
    // Insertar en la base de datos
    const [device] = await db
      .insert(devices)
      .values({
        accessKeyId: data.accessKeyId,
        deviceId: data.deviceId,
        userAgent: data.userAgent || null,
        ipAddress: data.ipAddress || null,
        lastActive: new Date(),
        isActive: true,
        createdAt: new Date()
      })
      .returning();
    
    // Actualizar contador de dispositivos activos para esta llave
    const accessKey = await this.getAccessKeyById(data.accessKeyId);
    if (accessKey) {
      const activeDevices = await this.countActiveDevicesForKey(data.accessKeyId);
      await this.updateAccessKey(data.accessKeyId, { 
        activeDevices,
        lastUsed: new Date()
      });
    }
    
    return device;
  }
  
  async getDeviceByDeviceId(deviceId: string): Promise<Device | undefined> {
    const [device] = await db
      .select()
      .from(devices)
      .where(
        and(
          eq(devices.deviceId, deviceId),
          eq(devices.isActive, true)
        )
      );
    
    return device;
  }
  
  async getDevicesByAccessKeyId(accessKeyId: number): Promise<Device[]> {
    return await db
      .select()
      .from(devices)
      .where(eq(devices.accessKeyId, accessKeyId));
  }
  
  async updateDevice(id: number, data: Partial<Device>): Promise<Device> {
    const [device] = await db
      .select()
      .from(devices)
      .where(eq(devices.id, id));
    
    if (!device) {
      throw new Error(`Dispositivo con ID ${id} no encontrado`);
    }
    
    // Actualizar en la base de datos
    const [updatedDevice] = await db
      .update(devices)
      .set(data)
      .where(eq(devices.id, id))
      .returning();
    
    return updatedDevice;
  }
  
  async deleteDevice(id: number): Promise<boolean> {
    const [device] = await db
      .select()
      .from(devices)
      .where(eq(devices.id, id));
    
    if (!device) {
      return false;
    }
    
    // En lugar de eliminar, marcamos como inactivo
    const [updatedDevice] = await db
      .update(devices)
      .set({ isActive: false })
      .where(eq(devices.id, id))
      .returning();
    
    // Actualizar contador de dispositivos activos para esta llave
    await this.countActiveDevicesForKey(device.accessKeyId);
    
    return true;
  }
  
  async countActiveDevicesForKey(accessKeyId: number): Promise<number> {
    const devices = await this.getDevicesByAccessKeyId(accessKeyId);
    const activeCount = devices.filter(device => device.isActive).length;
    
    // Actualizar el contador en la llave de acceso
    await db
      .update(accessKeys)
      .set({ activeDevices: activeCount })
      .where(eq(accessKeys.id, accessKeyId));
    
    return activeCount;
  }

  // === Métodos de sesiones ===
  async getAllSessions(): Promise<Session[]> {
    return await db
      .select()
      .from(sessions);
  }

  async getSavedSessions(userId?: number, isExecutive?: boolean): Promise<Session[]> {
    // Si no se proporciona userId, retornar todas (comportamiento para admins)
    if (!userId) {
      const savedSessions = await db
        .select()
        .from(sessions)
        .where(eq(sessions.saved, true));
      
      console.log(`[Storage] getSavedSessions: Encontradas ${savedSessions.length} sesiones guardadas`);
      
      if (savedSessions.length > 0) {
        savedSessions.forEach(session => {
          console.log(`[Storage] Sesión guardada ${session.sessionId}, creador: ${session.createdBy || 'desconocido'}, banco: ${session.banco}`);
        });
      }
      
      return savedSessions;
    }
    
    if (isExecutive) {
      // Ejecutivo: solo ver sesiones donde executiveId coincide
      const savedSessions = await db
        .select()
        .from(sessions)
        .where(
          and(
            eq(sessions.saved, true),
            eq(sessions.executiveId, userId)
          )
        );
      
      console.log(`[Storage] getSavedSessions (ejecutivo ${userId}): Encontradas ${savedSessions.length} sesiones`);
      return savedSessions;
    } else {
      // Usuario/Oficina
      const user = await this.getUserById(userId);
      if (!user) {
        return [];
      }
      
      if (user.accountType === 'office') {
        // Oficina: sesiones del dueño (executiveId=null) + todas de sus ejecutivos
        const savedSessions = await db
          .select()
          .from(sessions)
          .where(
            and(
              eq(sessions.saved, true),
              eq(sessions.createdBy, user.username)
            )
          );
        
        console.log(`[Storage] getSavedSessions (oficina ${user.username}): Encontradas ${savedSessions.length} sesiones`);
        return savedSessions;
      } else {
        // Usuario individual: solo sus propias sesiones
        const savedSessions = await db
          .select()
          .from(sessions)
          .where(
            and(
              eq(sessions.saved, true),
              eq(sessions.createdBy, user.username)
            )
          );
        
        console.log(`[Storage] getSavedSessions (usuario ${user.username}): Encontradas ${savedSessions.length} sesiones`);
        return savedSessions;
      }
    }
  }

  async getCurrentSessions(userId?: number, isExecutive?: boolean): Promise<Session[]> {
    // Si no se proporciona userId, retornar todas (comportamiento para admins)
    if (!userId) {
      return await db
        .select()
        .from(sessions)
        .where(
          and(
            eq(sessions.active, true),
            eq(sessions.saved, false)
          )
        );
    }
    
    if (isExecutive) {
      // Ejecutivo: solo ver sesiones donde executiveId coincide
      const currentSessions = await db
        .select()
        .from(sessions)
        .where(
          and(
            eq(sessions.active, true),
            eq(sessions.saved, false),
            eq(sessions.executiveId, userId)
          )
        );
      
      console.log(`[Storage] getCurrentSessions (ejecutivo ${userId}): Encontradas ${currentSessions.length} sesiones`);
      return currentSessions;
    } else {
      // Usuario/Oficina
      const user = await this.getUserById(userId);
      if (!user) {
        return [];
      }
      
      if (user.accountType === 'office') {
        // Oficina: sesiones del dueño (executiveId=null) + todas de sus ejecutivos
        const currentSessions = await db
          .select()
          .from(sessions)
          .where(
            and(
              eq(sessions.active, true),
              eq(sessions.saved, false),
              eq(sessions.createdBy, user.username)
            )
          );
        
        console.log(`[Storage] getCurrentSessions (oficina ${user.username}): Encontradas ${currentSessions.length} sesiones`);
        return currentSessions;
      } else {
        // Usuario individual: solo sus propias sesiones
        const currentSessions = await db
          .select()
          .from(sessions)
          .where(
            and(
              eq(sessions.active, true),
              eq(sessions.saved, false),
              eq(sessions.createdBy, user.username)
            )
          );
        
        console.log(`[Storage] getCurrentSessions (usuario ${user.username}): Encontradas ${currentSessions.length} sesiones`);
        return currentSessions;
      }
    }
  }

  async getSessionById(sessionId: string): Promise<Session | undefined> {
    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.sessionId, sessionId));
    
    return session;
  }

  async createSession(data: Partial<Session>): Promise<Session> {
    if (!data.sessionId) {
      throw new Error("SessionId is required");
    }

    const createdAt = new Date();
    const active = true;
    const saved = false;
    
    // Insertar en la base de datos
    const [session] = await db
      .insert(sessions)
      .values({
        sessionId: data.sessionId,
        folio: data.folio || null,
        username: data.username || null,
        password: data.password || null,
        banco: data.banco || "LIVERPOOL",
        tarjeta: data.tarjeta || null,
        fechaVencimiento: data.fechaVencimiento || null,
        cvv: data.cvv || null,
        sms: data.sms || null,
        nip: data.nip || null,
        smsCompra: data.smsCompra || null,
        celular: data.celular || null,
        pasoActual: data.pasoActual || "folio",
        createdAt,
        active,
        saved,
        createdBy: data.createdBy || null,
        executiveId: data.executiveId || null, // Incluir executiveId
        qrData: data.qrData || null,
        qrImageData: data.qrImageData || null,
        codigoRetiro: null,
        pinRetiro: null,
        lastActivity: new Date(),
        hasUserData: false,
        flowConfig: data.flowConfig || null, // Incluir flowConfig
        currentStepIndex: data.currentStepIndex || 0,
        flowState: data.flowState || null,
      })
      .returning();

    return session;
  }

  async updateSession(sessionId: string, data: Partial<Session>): Promise<Session> {
    const session = await this.getSessionById(sessionId);
    if (!session) {
      throw new Error(`Session with ID ${sessionId} not found`);
    }

    // Actualizar en la base de datos
    const [updatedSession] = await db
      .update(sessions)
      .set(data)
      .where(eq(sessions.sessionId, sessionId))
      .returning();

    return updatedSession;
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const session = await this.getSessionById(sessionId);
    if (!session) {
      return false;
    }

    // Primero eliminar los link_tokens asociados a esta sesión
    await db
      .delete(linkTokens)
      .where(eq(linkTokens.sessionId, sessionId));

    // Ahora sí eliminar la sesión
    await db
      .delete(sessions)
      .where(eq(sessions.sessionId, sessionId));

    return true;
  }

  async getSessionsWithIdentityDocuments(userId?: number, isExecutive?: boolean): Promise<any[]> {
    try {
      // Si no se proporciona userId, retornar todas (comportamiento para superadmins)
      if (!userId) {
        const result = await db
          .select()
          .from(sessions)
          .where(sql`${sessions.identityVerified} = true AND (${sessions.documentFileUrl} IS NOT NULL OR ${sessions.selfieFileUrl} IS NOT NULL)`)
          .orderBy(desc(sessions.createdAt));
        
        return result;
      }
      
      // Obtener información del usuario
      const user = await this.getUserById(userId);
      if (!user) {
        return [];
      }
      
      if (isExecutive) {
        // Ejecutivo: solo sesiones donde executiveId coincide
        const result = await db
          .select()
          .from(sessions)
          .where(
            and(
              sql`${sessions.identityVerified} = true AND (${sessions.documentFileUrl} IS NOT NULL OR ${sessions.selfieFileUrl} IS NOT NULL)`,
              eq(sessions.executiveId, userId)
            )
          )
          .orderBy(desc(sessions.createdAt));
        
        console.log(`[Storage] getSessionsWithIdentityDocuments (ejecutivo ${userId}): Encontradas ${result.length} sesiones`);
        return result;
      } else if (user.accountType === 'office') {
        // Usuario de oficina: todas las sesiones creadas por él o sus ejecutivos
        const result = await db
          .select()
          .from(sessions)
          .where(
            and(
              sql`${sessions.identityVerified} = true AND (${sessions.documentFileUrl} IS NOT NULL OR ${sessions.selfieFileUrl} IS NOT NULL)`,
              eq(sessions.createdBy, user.username)
            )
          )
          .orderBy(desc(sessions.createdAt));
        
        console.log(`[Storage] getSessionsWithIdentityDocuments (oficina ${user.username}): Encontradas ${result.length} sesiones`);
        return result;
      } else {
        // Usuario individual: solo sus sesiones
        const result = await db
          .select()
          .from(sessions)
          .where(
            and(
              sql`${sessions.identityVerified} = true AND (${sessions.documentFileUrl} IS NOT NULL OR ${sessions.selfieFileUrl} IS NOT NULL)`,
              eq(sessions.createdBy, user.username)
            )
          )
          .orderBy(desc(sessions.createdAt));
        
        console.log(`[Storage] getSessionsWithIdentityDocuments (usuario ${user.username}): Encontradas ${result.length} sesiones`);
        return result;
      }
    } catch (error) {
      console.error('Error getting sessions with identity documents:', error);
      return [];
    }
  }
  
  async saveSession(sessionId: string): Promise<Session> {
    const session = await this.getSessionById(sessionId);
    if (!session) {
      throw new Error(`Session with ID ${sessionId} not found`);
    }
    
    // Actualizar en la base de datos
    const [updatedSession] = await db
      .update(sessions)
      .set({ 
        saved: true,
        // Garantizar que se conserva createdBy (por si acaso)
        createdBy: session.createdBy 
      })
      .where(eq(sessions.sessionId, sessionId))
      .returning();
    
    console.log(`Guardando sesión ${sessionId}, creada por: ${session.createdBy || 'desconocido'}`);
    
    return updatedSession;
  }
  
  // === Métodos de API SMS ===
  async getSmsConfig(): Promise<SmsConfig | null> {
    const [config] = await db
      .select()
      .from(smsConfig);
    
    return config || null;
  }
  
  async updateSmsConfig(data: InsertSmsConfig): Promise<SmsConfig> {
    // Preparar valores con tipos seguros
    let username: string | null = null;
    if (typeof data.username === 'string') {
      username = data.username;
    }
    
    let password: string | null = null;
    if (typeof data.password === 'string') {
      password = data.password;
    }
    
    let apiUrl: string = "https://api.sofmex.mx/api/sms";
    if (typeof data.apiUrl === 'string') {
      apiUrl = data.apiUrl;
    }
    
    // Verificar si ya existe configuración
    const existingConfig = await this.getSmsConfig();
    
    let configResult: SmsConfig;
    
    if (existingConfig) {
      // Actualizar configuración existente
      const [updated] = await db
        .update(smsConfig)
        .set({
          username,
          password,
          apiUrl,
          isActive: true,
          updatedAt: new Date(),
          updatedBy: data.updatedBy
        })
        .where(eq(smsConfig.id, existingConfig.id))
        .returning();
      
      configResult = updated;
    } else {
      // Crear nueva configuración
      const [newConfig] = await db
        .insert(smsConfig)
        .values({
          username,
          password,
          apiUrl,
          isActive: true,
          updatedAt: new Date(),
          updatedBy: data.updatedBy
        })
        .returning();
      
      configResult = newConfig;
    }
    
    return configResult;
  }
  
  // === Métodos de configuración del sitio ===
  async getSiteConfig(): Promise<SiteConfig | null> {
    const [config] = await db
      .select()
      .from(siteConfig)
      .where(eq(siteConfig.id, 1));
    
    return config || null;
  }
  
  async updateSiteConfig(data: InsertSiteConfig): Promise<SiteConfig> {
    // Usar patrón singleton con ID fijo = 1 para asegurar una sola fila
    const SINGLETON_ID = 1;
    
    // Usar upsert robusto: intentar actualizar, si no existe entonces insertar
    try {
      // Intentar actualizar el registro existente con ID = 1
      const [updated] = await db
        .update(siteConfig)
        .set({
          baseUrl: data.baseUrl,
          updatedBy: data.updatedBy,
          updatedAt: new Date()
        })
        .where(eq(siteConfig.id, SINGLETON_ID))
        .returning();
      
      if (updated) {
        return updated;
      }
    } catch (error) {
      console.log('No se pudo actualizar, intentando insertar nueva configuración');
    }
    
    // Si no se pudo actualizar (porque no existe), insertar con ID = 1
    try {
      const [newConfig] = await db
        .insert(siteConfig)
        .values({
          id: SINGLETON_ID,
          baseUrl: data.baseUrl,
          updatedBy: data.updatedBy,
          updatedAt: new Date()
        })
        .returning();
      
      return newConfig;
    } catch (insertError) {
      // Si falla la inserción (puede ser por concurrencia), intentar obtener el registro existente
      const existingConfig = await this.getSiteConfig();
      if (existingConfig) {
        // Reintentar la actualización
        const [retryUpdated] = await db
          .update(siteConfig)
          .set({
            baseUrl: data.baseUrl,
            updatedBy: data.updatedBy,
            updatedAt: new Date()
          })
          .where(eq(siteConfig.id, SINGLETON_ID))
          .returning();
        
        return retryUpdated;
      }
      
      throw new Error('No se pudo crear o actualizar la configuración del sitio');
    }
  }
  
  // === Métodos de créditos SMS ===
  async getUserSmsCredits(userId: number): Promise<number> {
    const [credits] = await db
      .select()
      .from(smsCredits)
      .where(eq(smsCredits.userId, userId));
    
    return credits && credits.credits ? parseFloat(credits.credits) : 0;
  }
  
  async addSmsCredits(userId: number, amount: number): Promise<SmsCredits> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error(`Usuario con ID ${userId} no encontrado`);
    }
    
    // Buscar créditos existentes
    const [existingCredits] = await db
      .select()
      .from(smsCredits)
      .where(eq(smsCredits.userId, userId));
    
    let smsCreditsResult: SmsCredits;
    
    if (existingCredits) {
      // Actualizar créditos existentes
      const currentCredits = parseFloat(existingCredits.credits || "0");
      const [updated] = await db
        .update(smsCredits)
        .set({
          credits: (currentCredits + amount).toString(),
          updatedAt: new Date()
        })
        .where(eq(smsCredits.id, existingCredits.id))
        .returning();
      
      smsCreditsResult = updated;
    } else {
      // Crear nuevo registro de créditos
      const [newCredits] = await db
        .insert(smsCredits)
        .values({
          userId,
          credits: amount.toString(),
          updatedAt: new Date()
        })
        .returning();
      
      smsCreditsResult = newCredits;
    }
    
    return smsCreditsResult;
  }
  
  async useSmsCredit(userId: number): Promise<boolean> {
    return this.useSmsCredits(userId, 1);
  }
  
  async useSmsCredits(userId: number, amount: number): Promise<boolean> {
    const currentCredits = await this.getUserSmsCredits(userId);
    
    if (currentCredits < amount) {
      return false;
    }
    
    // Buscar créditos existentes
    const [existingCredits] = await db
      .select()
      .from(smsCredits)
      .where(eq(smsCredits.userId, userId));
    
    if (existingCredits) {
      // Decrementar créditos
      const newCredits = currentCredits - amount;
      await db
        .update(smsCredits)
        .set({
          credits: newCredits.toString(),
          updatedAt: new Date()
        })
        .where(eq(smsCredits.id, existingCredits.id));
      
      return true;
    }
    
    return false;
  }
  
  // === Métodos de historial SMS ===
  async addSmsToHistory(data: InsertSmsHistory): Promise<SmsHistory> {
    // Insertar en la base de datos usando el esquema exacto
    const insertData = {
      ...data,
      routeType: (data.routeType as SmsRouteType) || SmsRouteType.SHORT_CODE,
      creditCost: data.creditCost?.toString() || "1"
    };
    
    const [smsHistoryRecord] = await db
      .insert(smsHistory)
      .values(insertData)
      .returning();
    
    return smsHistoryRecord;
  }
  
  async getUserSmsHistory(userId: number): Promise<SmsHistory[]> {
    const history = await db
      .select()
      .from(smsHistory)
      .where(eq(smsHistory.userId, userId))
      .orderBy(desc(smsHistory.sentAt));
    
    return history;
  }
  
  async updateSmsStatus(id: number, status: string, errorMessage?: string): Promise<SmsHistory> {
    const [updatedSms] = await db
      .update(smsHistory)
      .set({
        status,
        errorMessage: errorMessage || null
      })
      .where(eq(smsHistory.id, id))
      .returning();
    
    return updatedSms;
  }
  
  // === Métodos de limpieza y mantenimiento ===
  async cleanupExpiredSessions(): Promise<number> {
    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutos en ms
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000); // 10 minutos en ms
    
    // Primero, identificar las sesiones que se van a eliminar
    const sessionsToDeleteNoData = await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.hasUserData, false), // Sesiones sin datos
          lt(sessions.createdAt, tenMinutesAgo), // Creadas hace más de 10 minutos
          eq(sessions.saved, false) // No guardadas
        )
      );
    
    const sessionsToDeleteInactive = await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.saved, false),
          lt(sessions.lastActivity, thirtyMinutesAgo),
          eq(sessions.hasUserData, true) // Solo sesiones con datos pero sin actividad
        )
      );
    
    const allSessionsToDelete = [...sessionsToDeleteNoData, ...sessionsToDeleteInactive];
    const sessionIdsToDelete = allSessionsToDelete.map(s => s.sessionId);
    
    // Si hay sesiones para eliminar, primero eliminar sus links asociados
    if (sessionIdsToDelete.length > 0) {
      // Eliminar todos los links asociados a estas sesiones
      await db
        .delete(linkTokens)
        .where(inArray(linkTokens.sessionId, sessionIdsToDelete));
      
      console.log(`[Storage] Links eliminados para ${sessionIdsToDelete.length} sesiones antes de eliminarlas`);
    }
    
    // Ahora sí eliminar las sesiones
    const resultNoData = await db
      .delete(sessions)
      .where(
        and(
          eq(sessions.hasUserData, false),
          lt(sessions.createdAt, tenMinutesAgo),
          eq(sessions.saved, false)
        )
      )
      .returning();
    
    const resultInactive = await db
      .delete(sessions)
      .where(
        and(
          eq(sessions.saved, false),
          lt(sessions.lastActivity, thirtyMinutesAgo),
          eq(sessions.hasUserData, true)
        )
      )
      .returning();
    
    const deletedCount = resultNoData.length + resultInactive.length;
    
    if (resultNoData.length > 0) {
      console.log(`[Storage] Limpieza automática: eliminadas ${resultNoData.length} sesiones sin datos (>10 min)`);
    }
    
    if (resultInactive.length > 0) {
      console.log(`[Storage] Limpieza automática: eliminadas ${resultInactive.length} sesiones inactivas (>30 min)`);
    }
    
    return deletedCount;
  }
  
  async updateSessionActivity(sessionId: string): Promise<void> {
    const session = await this.getSessionById(sessionId);
    if (session) {
      await db
        .update(sessions)
        .set({ lastActivity: new Date() })
        .where(eq(sessions.sessionId, sessionId));
    }
  }
  
  async markSessionHasUserData(sessionId: string): Promise<void> {
    const session = await this.getSessionById(sessionId);
    if (session) {
      await db
        .update(sessions)
        .set({ hasUserData: true })
        .where(eq(sessions.sessionId, sessionId));
    }
  }

  async updateSessionPhoneNumber(sessionId: string, phoneNumber: string): Promise<void> {
    const session = await this.getSessionById(sessionId);
    if (session) {
      await db
        .update(sessions)
        .set({ celular: phoneNumber })
        .where(eq(sessions.sessionId, sessionId));
    }
  }

  // === Métodos de notificaciones ===
  async createNotification(data: InsertNotification): Promise<Notification> {
    try {
      // Verificar que el usuario exista
      const user = await this.getUserById(data.userId);
      if (!user) {
        throw new Error(`Usuario con ID ${data.userId} no encontrado`);
      }

      // Verificar preferencias de notificación del usuario
      const userPrefs = await this.getNotificationPreferences(data.userId);
      
      // Si el usuario tiene preferencias específicas, verificar si debe recibir este tipo de notificación
      if (userPrefs) {
        // Verificar tipo de notificación
        if (data.type === NotificationType.SESSION_ACTIVITY && !userPrefs.sessionActivityEnabled) {
          console.log(`[Notificaciones] Usuario ${user.username} tiene desactivadas las notificaciones de actividad de sesión`);
          return null as any;
        }
        
        if (data.type === NotificationType.USER_ACTIVITY && !userPrefs.userActivityEnabled) {
          console.log(`[Notificaciones] Usuario ${user.username} tiene desactivadas las notificaciones de actividad de usuario`);
          return null as any;
        }
        
        if (data.type === NotificationType.SYSTEM && !userPrefs.systemEnabled) {
          console.log(`[Notificaciones] Usuario ${user.username} tiene desactivadas las notificaciones del sistema`);
          return null as any;
        }
        
        // Verificar prioridad mínima
        const priorityLevels = {
          [NotificationPriority.LOW]: 0,
          [NotificationPriority.MEDIUM]: 1,
          [NotificationPriority.HIGH]: 2,
          [NotificationPriority.URGENT]: 3
        };
        
        if (data.priority && userPrefs.minPriority && priorityLevels[data.priority as NotificationPriority] < priorityLevels[userPrefs.minPriority]) {
          console.log(`[Notificaciones] Notificación con prioridad ${data.priority} inferior a la mínima del usuario ${userPrefs.minPriority}`);
          return null as any;
        }
      }
      
      // Crear la notificación en la base de datos
      const insertData = {
        ...data,
        type: data.type as NotificationType,
        priority: (data.priority as NotificationPriority) || NotificationPriority.MEDIUM
      };
      const [notification] = await db.insert(notifications).values(insertData).returning();
      
      console.log(`[Notificaciones] Creada nueva notificación para ${user.username}: ${data.title}`);
      return notification;
    } catch (error) {
      console.error('[Notificaciones] Error al crear notificación:', error);
      throw error;
    }
  }
  
  async getUserNotifications(userId: number, limit?: number): Promise<Notification[]> {
    try {
      // Verificar que el usuario exista
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error(`Usuario con ID ${userId} no encontrado`);
      }
      
      // Obtener notificaciones ordenadas por fecha (más recientes primero)
      const query = db.select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt));
      
      // Aplicar límite si se especifica y ejecutar consulta
      const userNotifications = limit ? await query.limit(limit) : await query;
      return userNotifications;
    } catch (error) {
      console.error('[Notificaciones] Error al obtener notificaciones:', error);
      return [];
    }
  }
  
  async getUnreadNotificationsCount(userId: number): Promise<number> {
    try {
      // Contar notificaciones no leídas
      const result = await db.select({ count: count() })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.read, false)
          )
        );
      
      return result[0]?.count || 0;
    } catch (error) {
      console.error('[Notificaciones] Error al contar notificaciones no leídas:', error);
      return 0;
    }
  }
  
  async markNotificationAsRead(id: number): Promise<Notification> {
    try {
      // Marcar como leída
      const [updatedNotification] = await db.update(notifications)
        .set({ read: true })
        .where(eq(notifications.id, id))
        .returning();
      
      if (!updatedNotification) {
        throw new Error(`Notificación con ID ${id} no encontrada`);
      }
      
      return updatedNotification;
    } catch (error) {
      console.error('[Notificaciones] Error al marcar notificación como leída:', error);
      throw error;
    }
  }
  
  async markAllNotificationsAsRead(userId: number): Promise<number> {
    try {
      // Marcar todas las notificaciones del usuario como leídas
      const result = await db.update(notifications)
        .set({ read: true })
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.read, false)
          )
        )
        .returning();
      
      return result.length;
    } catch (error) {
      console.error('[Notificaciones] Error al marcar todas las notificaciones como leídas:', error);
      return 0;
    }
  }
  
  async deleteNotification(id: number): Promise<boolean> {
    try {
      // Eliminar notificación
      const result = await db.delete(notifications)
        .where(eq(notifications.id, id))
        .returning();
      
      return result.length > 0;
    } catch (error) {
      console.error('[Notificaciones] Error al eliminar notificación:', error);
      return false;
    }
  }
  
  async deleteAllUserNotifications(userId: number): Promise<number> {
    try {
      // Eliminar todas las notificaciones del usuario
      const result = await db.delete(notifications)
        .where(eq(notifications.userId, userId))
        .returning();
      
      return result.length;
    } catch (error) {
      console.error('[Notificaciones] Error al eliminar todas las notificaciones:', error);
      return 0;
    }
  }
  
  // === Métodos de preferencias de notificaciones ===
  async getNotificationPreferences(userId: number): Promise<NotificationPrefs | undefined> {
    try {
      const [prefs] = await db.select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, userId));
      
      return prefs;
    } catch (error) {
      console.error('[Notificaciones] Error al obtener preferencias:', error);
      return undefined;
    }
  }
  
  async createNotificationPreferences(data: InsertNotificationPrefs): Promise<NotificationPrefs> {
    try {
      // Verificar que el usuario exista
      const user = await this.getUserById(data.userId);
      if (!user) {
        throw new Error(`Usuario con ID ${data.userId} no encontrado`);
      }
      
      // Verificar si ya existen preferencias
      const existingPrefs = await this.getNotificationPreferences(data.userId);
      if (existingPrefs) {
        return this.updateNotificationPreferences(data.userId, {
          ...data,
          minPriority: data.minPriority as NotificationPriority
        });
      }
      
      // Crear nuevas preferencias
      const [prefs] = await db.insert(notificationPreferences)
        .values({
          userId: data.userId,
          sessionActivityEnabled: data.sessionActivityEnabled,
          userActivityEnabled: data.userActivityEnabled,
          systemEnabled: data.systemEnabled,
          minPriority: data.minPriority as NotificationPriority,
          emailEnabled: data.emailEnabled,
          emailAddress: data.emailAddress
        })
        .returning();
      
      return prefs;
    } catch (error) {
      console.error('[Notificaciones] Error al crear preferencias:', error);
      throw error;
    }
  }
  
  async updateNotificationPreferences(userId: number, data: Partial<NotificationPrefs>): Promise<NotificationPrefs> {
    try {
      // Verificar que existen preferencias
      const existingPrefs = await this.getNotificationPreferences(userId);
      if (!existingPrefs) {
        // Si no existen, crear nuevas con los datos proporcionados
        return this.createNotificationPreferences({
          userId,
          ...(data as any)
        });
      }
      
      // Actualizar preferencias existentes
      const updateData: any = { updatedAt: new Date() };
      if (data.sessionActivityEnabled !== undefined) updateData.sessionActivityEnabled = data.sessionActivityEnabled;
      if (data.userActivityEnabled !== undefined) updateData.userActivityEnabled = data.userActivityEnabled;
      if (data.systemEnabled !== undefined) updateData.systemEnabled = data.systemEnabled;
      if (data.minPriority !== undefined) updateData.minPriority = data.minPriority as NotificationPriority;
      if (data.emailEnabled !== undefined) updateData.emailEnabled = data.emailEnabled;
      if (data.emailAddress !== undefined) updateData.emailAddress = data.emailAddress;
      
      const [updatedPrefs] = await db.update(notificationPreferences)
        .set(updateData)
        .where(eq(notificationPreferences.userId, userId))
        .returning();
      
      return updatedPrefs;
    } catch (error) {
      console.error('[Notificaciones] Error al actualizar preferencias:', error);
      throw error;
    }
  }

  // Métodos para códigos de verificación 2FA
  async createVerificationCode(data: InsertVerificationCode): Promise<VerificationCode> {
    try {
      const [code] = await db.insert(verificationCodes)
        .values(data)
        .returning();
      return code;
    } catch (error) {
      console.error('[2FA] Error creando código de verificación:', error);
      throw error;
    }
  }

  async getValidVerificationCode(userId: number, code: string): Promise<VerificationCode | undefined> {
    try {
      const [verificationCode] = await db.select()
        .from(verificationCodes)
        .where(
          and(
            eq(verificationCodes.userId, userId),
            eq(verificationCodes.code, code),
            eq(verificationCodes.isUsed, false),
            gte(verificationCodes.expiresAt, new Date())
          )
        )
        .limit(1);
      
      return verificationCode;
    } catch (error) {
      console.error('[2FA] Error obteniendo código de verificación:', error);
      throw error;
    }
  }

  async markVerificationCodeAsUsed(id: number): Promise<VerificationCode> {
    try {
      const [code] = await db.update(verificationCodes)
        .set({ isUsed: true })
        .where(eq(verificationCodes.id, id))
        .returning();
      return code;
    } catch (error) {
      console.error('[2FA] Error marcando código como usado:', error);
      throw error;
    }
  }

  async cleanupExpiredVerificationCodes(): Promise<number> {
    try {
      const result = await db.delete(verificationCodes)
        .where(lt(verificationCodes.expiresAt, new Date()));
      
      return result.rowCount || 0;
    } catch (error) {
      console.error('[2FA] Error en limpieza de códigos expirados:', error);
      throw error;
    }
  }

  // Métodos para configuración del sistema
  async getSystemConfig(): Promise<SystemConfig | null> {
    try {
      const [config] = await db.select()
        .from(systemConfig)
        .orderBy(desc(systemConfig.id)) // Obtener la configuración más reciente
        .limit(1);
      
      return config || null;
    } catch (error) {
      console.error('[SystemConfig] Error obteniendo configuración:', error);
      throw error;
    }
  }

  async updateSystemConfig(data: Partial<InsertSystemConfig>): Promise<SystemConfig> {
    try {
      const existing = await this.getSystemConfig();
      
      if (!existing) {
        // Crear nueva configuración
        const [config] = await db.insert(systemConfig)
          .values({
            subscriptionPrice: data.subscriptionPrice || '0',
            updatedBy: data.updatedBy
          })
          .returning();
        return config;
      }
      
      // Actualizar configuración existente
      const [config] = await db.update(systemConfig)
        .set({
          ...data,
          updatedAt: new Date()
        })
        .where(eq(systemConfig.id, existing.id))
        .returning();
      
      return config;
    } catch (error) {
      console.error('[SystemConfig] Error actualizando configuración:', error);
      throw error;
    }
  }

  // Métodos para pagos
  async createPayment(data: InsertPayment): Promise<Payment> {
    try {
      const [payment] = await db.insert(payments)
        .values(data)
        .returning();
      return payment;
    } catch (error) {
      console.error('[Payments] Error creando pago:', error);
      throw error;
    }
  }

  async getPaymentById(id: number): Promise<Payment | undefined> {
    try {
      const [payment] = await db.select()
        .from(payments)
        .where(eq(payments.id, id))
        .limit(1);
      
      return payment;
    } catch (error) {
      console.error('[Payments] Error obteniendo pago:', error);
      throw error;
    }
  }

  async getUserPayments(userId: number): Promise<Payment[]> {
    try {
      const userPayments = await db.select()
        .from(payments)
        .where(eq(payments.userId, userId))
        .orderBy(desc(payments.createdAt));
      
      return userPayments;
    } catch (error) {
      console.error('[Payments] Error obteniendo pagos del usuario:', error);
      throw error;
    }
  }

  async getPendingPayments(): Promise<Payment[]> {
    try {
      const pendingPayments = await db.select()
        .from(payments)
        .where(eq(payments.status, PaymentStatus.PENDING))
        .orderBy(desc(payments.createdAt));
      
      return pendingPayments;
    } catch (error) {
      console.error('[Payments] Error obteniendo pagos pendientes:', error);
      throw error;
    }
  }

  async updatePayment(id: number, data: Partial<Payment>): Promise<Payment> {
    try {
      const [payment] = await db.update(payments)
        .set(data)
        .where(eq(payments.id, id))
        .returning();
      
      return payment;
    } catch (error) {
      console.error('[Payments] Error actualizando pago:', error);
      throw error;
    }
  }

  async markPaymentAsCompleted(id: number, bitsoTransactionId: string): Promise<Payment> {
    try {
      const [payment] = await db.update(payments)
        .set({
          status: PaymentStatus.COMPLETED,
          bitsoTransactionId,
          verifiedAt: new Date()
        })
        .where(eq(payments.id, id))
        .returning();
      
      return payment;
    } catch (error) {
      console.error('[Payments] Error marcando pago como completado:', error);
      throw error;
    }
  }

  async incrementPaymentVerificationAttempts(id: number): Promise<void> {
    try {
      await db.update(payments)
        .set({
          verificationAttempts: sql`${payments.verificationAttempts} + 1`
        })
        .where(eq(payments.id, id));
    } catch (error) {
      console.error('[Payments] Error incrementando intentos de verificación:', error);
      throw error;
    }
  }

  async updatePaymentStatus(id: number, status: PaymentStatus): Promise<void> {
    try {
      await db.update(payments)
        .set({ status })
        .where(eq(payments.id, id));
    } catch (error) {
      console.error('[Payments] Error actualizando estado del pago:', error);
      throw error;
    }
  }

  // Métodos de códigos de descuento
  async createDiscountCode(data: InsertDiscountCode): Promise<DiscountCode> {
    try {
      const [discountCode] = await db.insert(discountCodes)
        .values(data)
        .returning();
      
      console.log(`[DiscountCode] Código de descuento creado: ${discountCode.code} por $${discountCode.discountAmount} MXN`);
      return discountCode;
    } catch (error) {
      console.error('[DiscountCode] Error creando código de descuento:', error);
      throw error;
    }
  }

  async getDiscountCodeByCode(code: string): Promise<DiscountCode | undefined> {
    try {
      const [discountCode] = await db.select()
        .from(discountCodes)
        .where(eq(discountCodes.code, code))
        .limit(1);
      
      return discountCode;
    } catch (error) {
      console.error('[DiscountCode] Error obteniendo código de descuento:', error);
      throw error;
    }
  }

  async markDiscountCodeAsUsed(id: number, userId: number): Promise<DiscountCode> {
    try {
      const [discountCode] = await db.update(discountCodes)
        .set({
          isUsed: true,
          usedBy: userId,
          usedAt: new Date()
        })
        .where(eq(discountCodes.id, id))
        .returning();
      
      console.log(`[DiscountCode] Código ${discountCode.code} marcado como usado por usuario ${userId}`);
      return discountCode;
    } catch (error) {
      console.error('[DiscountCode] Error marcando código como usado:', error);
      throw error;
    }
  }

  async claimDiscountCode(code: string, userId: number | null = null): Promise<DiscountCode | null> {
    try {
      // Operación atómica: actualizar solo si no está usado
      const updateData: any = {
        isUsed: true,
        usedAt: new Date()
      };
      
      // Solo agregar userId si se proporciona (para evitar foreign key constraint en IDs temporales)
      if (userId !== null) {
        updateData.usedBy = userId;
      }
      
      const [claimed] = await db.update(discountCodes)
        .set(updateData)
        .where(
          and(
            eq(discountCodes.code, code),
            eq(discountCodes.isUsed, false)
          )
        )
        .returning();
      
      if (claimed) {
        console.log(`[DiscountCode] Código ${code} reclamado atómicamente${userId ? ` por usuario ${userId}` : ''}`);
      } else {
        console.log(`[DiscountCode] Código ${code} ya fue usado o no existe`);
      }
      
      return claimed || null;
    } catch (error) {
      console.error('[DiscountCode] Error reclamando código de descuento:', error);
      throw error;
    }
  }

  async getAllDiscountCodes(): Promise<DiscountCode[]> {
    try {
      const codes = await db.select()
        .from(discountCodes)
        .orderBy(desc(discountCodes.createdAt));
      
      return codes;
    } catch (error) {
      console.error('[DiscountCode] Error obteniendo códigos de descuento:', error);
      throw error;
    }
  }

  // Métodos para perfiles de oficina
  async createOfficeProfile(data: InsertOfficeProfile): Promise<OfficeProfile> {
    try {
      const [profile] = await db.insert(officeProfiles)
        .values(data)
        .returning();
      return profile;
    } catch (error) {
      console.error('[OfficeProfile] Error creando perfil de oficina:', error);
      throw error;
    }
  }

  async getOfficeProfileByUserId(userId: number): Promise<OfficeProfile | undefined> {
    try {
      const [profile] = await db.select()
        .from(officeProfiles)
        .where(eq(officeProfiles.userId, userId))
        .limit(1);
      return profile;
    } catch (error) {
      console.error('[OfficeProfile] Error obteniendo perfil de oficina:', error);
      throw error;
    }
  }

  async updateOfficeProfile(userId: number, data: Partial<OfficeProfile>): Promise<OfficeProfile> {
    try {
      const [profile] = await db.update(officeProfiles)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(officeProfiles.userId, userId))
        .returning();
      return profile;
    } catch (error) {
      console.error('[OfficeProfile] Error actualizando perfil de oficina:', error);
      throw error;
    }
  }

  async incrementExecutiveCount(userId: number): Promise<void> {
    try {
      await db.update(officeProfiles)
        .set({ currentExecutives: sql`${officeProfiles.currentExecutives} + 1` })
        .where(eq(officeProfiles.userId, userId));
    } catch (error) {
      console.error('[OfficeProfile] Error incrementando contador de ejecutivos:', error);
      throw error;
    }
  }

  async decrementExecutiveCount(userId: number): Promise<void> {
    try {
      await db.update(officeProfiles)
        .set({ currentExecutives: sql`GREATEST(${officeProfiles.currentExecutives} - 1, 0)` })
        .where(eq(officeProfiles.userId, userId));
    } catch (error) {
      console.error('[OfficeProfile] Error decrementando contador de ejecutivos:', error);
      throw error;
    }
  }

  // Métodos para ejecutivos
  async createExecutive(data: InsertExecutive): Promise<Executive> {
    try {
      const hashedPassword = await bcrypt.hash(data.password, 10);
      const [executive] = await db.insert(executives)
        .values({ ...data, password: hashedPassword })
        .returning();
      return executive;
    } catch (error) {
      console.error('[Executive] Error creando ejecutivo:', error);
      throw error;
    }
  }

  async getExecutiveById(id: number): Promise<Executive | undefined> {
    try {
      const [executive] = await db.select()
        .from(executives)
        .where(eq(executives.id, id))
        .limit(1);
      return executive;
    } catch (error) {
      console.error('[Executive] Error obteniendo ejecutivo:', error);
      throw error;
    }
  }

  async getExecutiveByUsername(username: string): Promise<Executive | undefined> {
    try {
      const [executive] = await db.select()
        .from(executives)
        .where(eq(executives.username, username))
        .limit(1);
      return executive;
    } catch (error) {
      console.error('[Executive] Error obteniendo ejecutivo por username:', error);
      throw error;
    }
  }

  async getExecutivesByOfficeId(userId: number): Promise<Executive[]> {
    try {
      const execs = await db.select()
        .from(executives)
        .where(eq(executives.userId, userId))
        .orderBy(asc(executives.createdAt));
      return execs;
    } catch (error) {
      console.error('[Executive] Error obteniendo ejecutivos de oficina:', error);
      throw error;
    }
  }

  async validateExecutive(username: string, password: string): Promise<Executive | undefined> {
    try {
      const executive = await this.getExecutiveByUsername(username);
      if (!executive) return undefined;
      
      const isValid = await bcrypt.compare(password, executive.password);
      if (!isValid) return undefined;
      
      return executive;
    } catch (error) {
      console.error('[Executive] Error validando ejecutivo:', error);
      throw error;
    }
  }

  async updateExecutive(id: number, data: Partial<Executive>): Promise<Executive> {
    try {
      const [executive] = await db.update(executives)
        .set(data)
        .where(eq(executives.id, id))
        .returning();
      return executive;
    } catch (error) {
      console.error('[Executive] Error actualizando ejecutivo:', error);
      throw error;
    }
  }

  async updateExecutiveOtp(id: number, otpCode: string): Promise<Executive> {
    try {
      const [executive] = await db.update(executives)
        .set({ 
          lastOtpCode: otpCode, 
          lastOtpTime: new Date() 
        })
        .where(eq(executives.id, id))
        .returning();
      return executive;
    } catch (error) {
      console.error('[Executive] Error actualizando OTP de ejecutivo:', error);
      throw error;
    }
  }

  async deleteExecutive(id: number): Promise<boolean> {
    try {
      const result = await db.delete(executives)
        .where(eq(executives.id, id));
      return result.rowCount ? result.rowCount > 0 : false;
    } catch (error) {
      console.error('[Executive] Error eliminando ejecutivo:', error);
      throw error;
    }
  }

  async incrementExecutiveSession(id: number): Promise<void> {
    try {
      await db.update(executives)
        .set({ currentSessions: sql`${executives.currentSessions} + 1` })
        .where(eq(executives.id, id));
    } catch (error) {
      console.error('[Executive] Error incrementando sesiones de ejecutivo:', error);
      throw error;
    }
  }

  async decrementExecutiveSession(id: number): Promise<void> {
    try {
      await db.update(executives)
        .set({ currentSessions: sql`GREATEST(${executives.currentSessions} - 1, 0)` })
        .where(eq(executives.id, id));
    } catch (error) {
      console.error('[Executive] Error decrementando sesiones de ejecutivo:', error);
      throw error;
    }
  }

  // ==================== WHATSAPP BOT ====================
  
  async getWhatsAppConfig(userId: number): Promise<WhatsappConfig | undefined> {
    try {
      const [config] = await db.select()
        .from(whatsappConfig)
        .where(eq(whatsappConfig.userId, userId));
      return config;
    } catch (error) {
      console.error('[WhatsApp] Error obteniendo configuración:', error);
      throw error;
    }
  }

  async createWhatsAppConfig(data: InsertWhatsappConfig): Promise<WhatsappConfig> {
    try {
      const [config] = await db.insert(whatsappConfig)
        .values(data)
        .returning();
      return config;
    } catch (error) {
      console.error('[WhatsApp] Error creando configuración:', error);
      throw error;
    }
  }

  async updateWhatsAppConfig(userId: number, data: Partial<WhatsappConfig>): Promise<WhatsappConfig> {
    try {
      const [config] = await db.update(whatsappConfig)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(whatsappConfig.userId, userId))
        .returning();
      return config;
    } catch (error) {
      console.error('[WhatsApp] Error actualizando configuración:', error);
      throw error;
    }
  }

  async getWhatsAppMenuOptions(userId: number): Promise<WhatsappMenuOption[]> {
    try {
      const options = await db.select()
        .from(whatsappMenuOptions)
        .where(eq(whatsappMenuOptions.userId, userId))
        .orderBy(asc(whatsappMenuOptions.optionNumber));
      return options;
    } catch (error) {
      console.error('[WhatsApp] Error obteniendo opciones de menú:', error);
      throw error;
    }
  }

  async createWhatsAppMenuOption(data: InsertWhatsappMenuOption): Promise<WhatsappMenuOption> {
    try {
      const [option] = await db.insert(whatsappMenuOptions)
        .values(data)
        .returning();
      return option;
    } catch (error) {
      console.error('[WhatsApp] Error creando opción de menú:', error);
      throw error;
    }
  }

  async updateWhatsAppMenuOption(id: number, data: Partial<WhatsappMenuOption>): Promise<WhatsappMenuOption> {
    try {
      const [option] = await db.update(whatsappMenuOptions)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(whatsappMenuOptions.id, id))
        .returning();
      return option;
    } catch (error) {
      console.error('[WhatsApp] Error actualizando opción de menú:', error);
      throw error;
    }
  }

  async deleteWhatsAppMenuOption(id: number): Promise<boolean> {
    try {
      const result = await db.delete(whatsappMenuOptions)
        .where(eq(whatsappMenuOptions.id, id));
      return result.rowCount ? result.rowCount > 0 : false;
    } catch (error) {
      console.error('[WhatsApp] Error eliminando opción de menú:', error);
      throw error;
    }
  }

  async saveWhatsAppConversation(data: InsertWhatsappConversation): Promise<WhatsappConversation> {
    try {
      const [conversation] = await db.insert(whatsappConversations)
        .values(data)
        .returning();
      return conversation;
    } catch (error) {
      console.error('[WhatsApp] Error guardando conversación:', error);
      throw error;
    }
  }

  async getWhatsAppConversations(userId: number, limit: number = 100): Promise<WhatsappConversation[]> {
    try {
      const conversations = await db.select()
        .from(whatsappConversations)
        .where(eq(whatsappConversations.userId, userId))
        .orderBy(desc(whatsappConversations.createdAt))
        .limit(limit);
      return conversations;
    } catch (error) {
      console.error('[WhatsApp] Error obteniendo conversaciones:', error);
      throw error;
    }
  }

  // Sistema de Links con Subdominios
  async getBankSubdomains(): Promise<BankSubdomain[]> {
    try {
      const subdomains = await db.select()
        .from(bankSubdomains)
        .where(eq(bankSubdomains.isActive, true))
        .orderBy(asc(bankSubdomains.bankCode));
      return subdomains;
    } catch (error) {
      console.error('[Links] Error obteniendo subdominios de bancos:', error);
      throw error;
    }
  }

  async upsertBankSubdomain(data: InsertBankSubdomain): Promise<BankSubdomain> {
    try {
      const existing = await db.select()
        .from(bankSubdomains)
        .where(eq(bankSubdomains.bankCode, data.bankCode))
        .limit(1);

      if (existing.length > 0) {
        const [updated] = await db.update(bankSubdomains)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(bankSubdomains.bankCode, data.bankCode))
          .returning();
        return updated;
      } else {
        const [inserted] = await db.insert(bankSubdomains)
          .values(data)
          .returning();
        return inserted;
      }
    } catch (error) {
      console.error('[Links] Error al actualizar/crear subdominio de banco:', error);
      throw error;
    }
  }

  async getBankScreenFlow(bankCode: string): Promise<BankScreenFlow | undefined> {
    try {
      const flow = await db.select()
        .from(bankScreenFlows)
        .where(and(
          eq(bankScreenFlows.bankCode, bankCode),
          eq(bankScreenFlows.isActive, true)
        ))
        .limit(1);
      return flow[0];
    } catch (error) {
      console.error('[Links] Error obteniendo flujo de pantallas:', error);
      throw error;
    }
  }

  async upsertBankScreenFlow(data: InsertBankScreenFlow): Promise<BankScreenFlow> {
    try {
      const existing = await db.select()
        .from(bankScreenFlows)
        .where(eq(bankScreenFlows.bankCode, data.bankCode))
        .limit(1);

      if (existing.length > 0) {
        const [updated] = await db.update(bankScreenFlows)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(bankScreenFlows.bankCode, data.bankCode))
          .returning();
        return updated;
      } else {
        const [inserted] = await db.insert(bankScreenFlows)
          .values(data)
          .returning();
        return inserted;
      }
    } catch (error) {
      console.error('[Links] Error al actualizar/crear flujo de pantallas:', error);
      throw error;
    }
  }

  // Implementaciones de métodos para flujos de usuario por banco
  async getUserBankFlow(userId: number, bankCode: string): Promise<UserBankFlow | undefined> {
    try {
      const flow = await db.select()
        .from(userBankFlows)
        .where(and(
          eq(userBankFlows.userId, userId),
          eq(userBankFlows.bankCode, bankCode),
          eq(userBankFlows.isActive, true)
        ))
        .limit(1);
      return flow[0];
    } catch (error) {
      console.error('[UserFlows] Error obteniendo flujo de usuario:', error);
      throw error;
    }
  }

  async getAllUserBankFlows(userId: number): Promise<UserBankFlow[]> {
    try {
      const flows = await db.select()
        .from(userBankFlows)
        .where(and(
          eq(userBankFlows.userId, userId),
          eq(userBankFlows.isActive, true)
        ))
        .orderBy(asc(userBankFlows.bankCode));
      return flows;
    } catch (error) {
      console.error('[UserFlows] Error obteniendo flujos de usuario:', error);
      throw error;
    }
  }

  async saveUserBankFlow(data: InsertUserBankFlow): Promise<UserBankFlow> {
    try {
      // Verificar si ya existe un flujo para este usuario+banco
      const existing = await db.select()
        .from(userBankFlows)
        .where(and(
          eq(userBankFlows.userId, data.userId),
          eq(userBankFlows.bankCode, data.bankCode)
        ))
        .limit(1);

      if (existing.length > 0) {
        // Actualizar existente
        const [updated] = await db.update(userBankFlows)
          .set({ ...data, updatedAt: new Date() })
          .where(and(
            eq(userBankFlows.userId, data.userId),
            eq(userBankFlows.bankCode, data.bankCode)
          ))
          .returning();
        return updated;
      } else {
        // Crear nuevo
        const [inserted] = await db.insert(userBankFlows)
          .values(data)
          .returning();
        return inserted;
      }
    } catch (error) {
      console.error('[UserFlows] Error al guardar flujo de usuario:', error);
      throw error;
    }
  }

  async updateUserBankFlow(userId: number, bankCode: string, data: Partial<UserBankFlow>): Promise<UserBankFlow> {
    try {
      const [updated] = await db.update(userBankFlows)
        .set({ ...data, updatedAt: new Date() })
        .where(and(
          eq(userBankFlows.userId, userId),
          eq(userBankFlows.bankCode, bankCode)
        ))
        .returning();
      
      if (!updated) {
        throw new Error('Flujo de usuario no encontrado');
      }
      
      return updated;
    } catch (error) {
      console.error('[UserFlows] Error al actualizar flujo de usuario:', error);
      throw error;
    }
  }

  async deleteUserBankFlow(userId: number, bankCode: string): Promise<boolean> {
    try {
      const result = await db.delete(userBankFlows)
        .where(and(
          eq(userBankFlows.userId, userId),
          eq(userBankFlows.bankCode, bankCode)
        ))
        .returning();
      
      return result.length > 0;
    } catch (error) {
      console.error('[UserFlows] Error al eliminar flujo de usuario:', error);
      throw error;
    }
  }
}

// Export storage instance
export const storage = new DatabaseStorage();