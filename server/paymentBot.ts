import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import { storage } from './storage';
import fs from 'fs';

const PAYMENT_BOT_TOKEN = process.env.PAYMENT_BOT_TOKEN;
const PAYMENT_BOT_CHAT_ID = process.env.PAYMENT_BOT_CHAT_ID;

if (!PAYMENT_BOT_TOKEN || !PAYMENT_BOT_CHAT_ID) {
  console.warn('[Payment Bot] PAYMENT_BOT_TOKEN y PAYMENT_BOT_CHAT_ID no están configurados. El bot de pagos estará deshabilitado.');
}

let paymentBotInstance: TelegramBot | null = null;
let isPaymentBotShuttingDown = false;

async function stopPaymentBot() {
  if (paymentBotInstance && !isPaymentBotShuttingDown) {
    isPaymentBotShuttingDown = true;
    try {
      console.log('🛑 Deteniendo bot de pagos...');
      await paymentBotInstance.stopPolling();
      paymentBotInstance.removeAllListeners();
      paymentBotInstance = null;
      console.log('✅ Bot de pagos detenido correctamente');
    } catch (error) {
      console.log('⚠️ Error al detener bot de pagos (continuando)');
    } finally {
      isPaymentBotShuttingDown = false;
    }
  }
}

async function cleanupPaymentBotInstances() {
  try {
    await stopPaymentBot();
    await axios.get(`https://api.telegram.org/bot${PAYMENT_BOT_TOKEN}/deleteWebhook?drop_pending_updates=true`);
    console.log('🧹 Limpieza de webhooks del bot de pagos completada');
    await new Promise(resolve => setTimeout(resolve, 2000));
  } catch (error) {
    console.log('⚠️ Error al limpiar configuraciones del bot de pagos');
  }
}

interface ActivationSession {
  chatId: number;
  state: 'awaiting_username' | 'awaiting_duration';
  username?: string;
}

const activationSessions = new Map<number, ActivationSession>();

let paymentBot: TelegramBot;

async function initPaymentBot() {
  await cleanupPaymentBotInstances();

  try {
    paymentBot = new TelegramBot(PAYMENT_BOT_TOKEN!, { 
      polling: {
        interval: 1000,
        autoStart: true,
        params: {
          timeout: 10
        }
      }
    });
    paymentBotInstance = paymentBot;
    console.log('💰 Bot de pagos iniciado correctamente');

    setupBotHandlers();
  } catch (error) {
    console.error('❌ Error iniciando bot de pagos:', error);
    throw error;
  }
}

function setupBotHandlers() {
  paymentBot.onText(/\/activar/, async (msg) => {
    const chatId = msg.chat.id;
    
    activationSessions.set(chatId, {
      chatId,
      state: 'awaiting_username'
    });
    
    await paymentBot.sendMessage(chatId, 
      '👤 *Activar Usuario*\n\n' +
      'Por favor, ingresa el nombre de usuario que deseas activar:', 
      { parse_mode: 'Markdown' }
    );
  });

  paymentBot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    if (!text || text.startsWith('/')) return;
    
    const session = activationSessions.get(chatId);
    if (!session) return;
    
    if (session.state === 'awaiting_username') {
      const username = text.trim();
      
      const user = await storage.getUserByUsername(username);
      if (!user) {
        await paymentBot.sendMessage(chatId, 
          '❌ *Usuario no encontrado*\n\n' +
          `No existe ningún usuario con el nombre: *${username}*\n\n` +
          'Por favor, verifica el nombre e intenta nuevamente:', 
          { parse_mode: 'Markdown' }
        );
        return;
      }
      
      session.username = username;
      session.state = 'awaiting_duration';
      activationSessions.set(chatId, session);
      
      const keyboard = {
        inline_keyboard: [
          [
            { text: '1 día ⏰', callback_data: `activate_1_${username}` },
            { text: '7 días 📅', callback_data: `activate_7_${username}` }
          ],
          [
            { text: '❌ Cancelar', callback_data: 'activate_cancel' }
          ]
        ]
      };
      
      await paymentBot.sendMessage(chatId, 
        `✅ *Usuario encontrado*\n\n` +
        `👤 Usuario: *${username}*\n` +
        `📧 ID: ${user.id}\n\n` +
        `Selecciona la duración de activación:`,
        { 
          parse_mode: 'Markdown',
          reply_markup: keyboard
        }
      );
    }
  });

  paymentBot.on('callback_query', async (query) => {
    const chatId = query.message?.chat.id;
    const data = query.data;
    const messageId = query.message?.message_id;
    
    if (!chatId || !data || !messageId) return;
    
    await paymentBot.answerCallbackQuery(query.id);
    
    if (data === 'activate_cancel') {
      activationSessions.delete(chatId);
      await paymentBot.editMessageText(
        '❌ Activación cancelada.',
        {
          chat_id: chatId,
          message_id: messageId
        }
      );
      return;
    }
    
    const match = data.match(/^activate_(\d+)_(.+)$/);
    if (!match) return;
    
    const days = parseInt(match[1]);
    const username = match[2];
    
    try {
      const user = await storage.getUserByUsername(username);
      if (!user) {
        await paymentBot.editMessageText(
          '❌ Error: Usuario no encontrado.',
          {
            chat_id: chatId,
            message_id: messageId
          }
        );
        return;
      }
      
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + days);
      
      await storage.updateUser(user.id, {
        isActive: true,
        expiresAt: expiresAt
      });
      
      const durationText = days === 1 ? '1 día ⏰' : '7 días 📅';
      const expirationDate = expiresAt.toLocaleDateString('es-MX', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      await paymentBot.editMessageText(
        `✅ *Usuario activado exitosamente*\n\n` +
        `👤 Usuario: *${username}*\n` +
        `⏱️ Duración: *${durationText}*\n` +
        `📅 Vence el: ${expirationDate}\n\n` +
        `El usuario ahora puede acceder al panel.`,
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown'
        }
      );
      
      activationSessions.delete(chatId);
      console.log(`[PaymentBot] Usuario ${username} activado por ${days} día(s)`);
      
    } catch (error) {
      console.error('[PaymentBot] Error activando usuario:', error);
      await paymentBot.editMessageText(
        '❌ Error al activar el usuario. Por favor, intenta nuevamente.',
        {
          chat_id: chatId,
          message_id: messageId
        }
      );
    }
  });
}

if (PAYMENT_BOT_TOKEN && PAYMENT_BOT_CHAT_ID) {
  initPaymentBot();
}

process.on('SIGINT', async () => {
  console.log('\n🔄 SIGINT recibido, cerrando bot de pagos...');
  await stopPaymentBot();
});

process.on('SIGTERM', async () => {
  console.log('\n🔄 SIGTERM recibido, cerrando bot de pagos...');
  await stopPaymentBot();
});

export async function sendPaymentReceipt(data: {
  username: string;
  amount: string;
  referenceCode: string;
  screenshotPath?: string;
  status: 'pending' | 'verified' | 'rejected';
  userId: number;
}): Promise<void> {
  if (!paymentBot || !PAYMENT_BOT_CHAT_ID) {
    console.error('[PaymentBot] Bot no inicializado o CHAT_ID no configurado');
    return;
  }

  try {
    let message = `💳 *COMPROBANTE DE PAGO*\n\n`;
    message += `👤 *Usuario:* ${data.username}\n`;
    message += `💰 *Monto:* $${data.amount} MXN\n`;
    message += `🔖 *Referencia:* \`${data.referenceCode}\`\n`;
    message += `📊 *Estado:* ${data.status === 'pending' ? '⏳ Pendiente' : data.status === 'verified' ? '✅ Verificado' : '❌ Rechazado'}\n`;
    message += `⏰ *Fecha:* ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}\n`;
    
    if (data.screenshotPath && fs.existsSync(data.screenshotPath)) {
      await paymentBot.sendPhoto(PAYMENT_BOT_CHAT_ID, data.screenshotPath, {
        caption: message,
        parse_mode: 'Markdown'
      });
    } else {
      await paymentBot.sendMessage(PAYMENT_BOT_CHAT_ID, message, {
        parse_mode: 'Markdown'
      });
    }
    
    console.log(`[PaymentBot] Comprobante enviado para usuario ${data.username}`);
  } catch (error) {
    console.error('[PaymentBot] Error enviando comprobante:', error);
  }
}

export async function notifyPaymentVerification(data: {
  username: string;
  amount: string;
  referenceCode: string;
  verificationMethod: 'bitso' | 'ai' | 'manual';
  success: boolean;
  details?: string;
}): Promise<void> {
  if (!paymentBot || !PAYMENT_BOT_CHAT_ID) {
    console.error('[PaymentBot] Bot no inicializado o CHAT_ID no configurado');
    return;
  }

  try {
    let message = `🔍 *VERIFICACIÓN DE PAGO*\n\n`;
    message += `👤 *Usuario:* ${data.username}\n`;
    message += `💰 *Monto:* $${data.amount} MXN\n`;
    message += `🔖 *Referencia:* \`${data.referenceCode}\`\n`;
    message += `🤖 *Método:* ${data.verificationMethod === 'bitso' ? 'API Bitso' : data.verificationMethod === 'ai' ? 'IA Vision' : 'Manual'}\n`;
    message += `${data.success ? '✅' : '❌'} *Resultado:* ${data.success ? 'VERIFICADO' : 'NO VERIFICADO'}\n`;
    
    if (data.details) {
      message += `\n📝 *Detalles:*\n${data.details}`;
    }
    
    message += `\n⏰ *Fecha:* ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}`;
    
    await paymentBot.sendMessage(PAYMENT_BOT_CHAT_ID, message, {
      parse_mode: 'Markdown'
    });
    
    console.log(`[PaymentBot] Notificación de verificación enviada`);
  } catch (error) {
    console.error('[PaymentBot] Error enviando notificación de verificación:', error);
  }
}

export { paymentBot };
