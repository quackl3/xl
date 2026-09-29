import crypto from 'crypto';
import axios from 'axios';
import { PaymentStatus } from '@shared/schema';

const BITSO_API_KEY = process.env.BITSO_API_KEY;
const BITSO_API_SECRET = process.env.BITSO_API_SECRET;
const BITSO_RECEIVING_ACCOUNT = process.env.BITSO_RECEIVING_ACCOUNT;
const BITSO_API_URL = 'https://api.bitso.com/v3';

if (!BITSO_API_KEY || !BITSO_API_SECRET || !BITSO_RECEIVING_ACCOUNT) {
  console.warn('[Bitso Service] BITSO_API_KEY, BITSO_API_SECRET y BITSO_RECEIVING_ACCOUNT no están configurados. El servicio de Bitso estará deshabilitado.');
}

interface BitsoTransaction {
  tid: string;
  amount: string;
  currency: string;
  method: string;
  created_at: string;
  status: string;
  details?: {
    sender?: string;
    receiving_account?: string;
  };
}

interface BitsoFundingsResponse {
  success: boolean;
  payload: BitsoTransaction[];
}

function generateBitsoSignature(httpMethod: string, requestPath: string, nonce: string, jsonPayload: string = ''): string {
  if (!BITSO_API_SECRET) {
    throw new Error('BITSO_API_SECRET no está configurado');
  }
  const message = nonce + httpMethod + requestPath + jsonPayload;
  const signature = crypto.createHmac('sha256', BITSO_API_SECRET).update(message).digest('hex');
  return signature;
}

export async function getBitsoBalance(): Promise<any> {
  try {
    const nonce = Date.now().toString();
    const httpMethod = 'GET';
    const requestPath = '/v3/balance/';
    
    const signature = generateBitsoSignature(httpMethod, requestPath, nonce);
    
    const headers = {
      'Authorization': `Bitso ${BITSO_API_KEY}:${nonce}:${signature}`,
      'Content-Type': 'application/json'
    };

    const response = await axios.get(`${BITSO_API_URL}/balance/`, {
      headers
    });

    if (response.data.success) {
      return response.data.payload;
    } else {
      console.error('[Bitso] Error en respuesta:', response.data);
      return null;
    }
  } catch (error: any) {
    console.error('[Bitso] Error obteniendo balance:', error.response?.data || error.message);
    return null;
  }
}

export async function getMXNBalance(): Promise<string | null> {
  try {
    const balanceData = await getBitsoBalance();
    if (!balanceData) return null;
    
    const mxnBalance = balanceData.balances?.find((b: any) => b.currency === 'mxn');
    if (!mxnBalance) return null;
    
    return mxnBalance.total;
  } catch (error) {
    console.error('[Bitso] Error obteniendo balance MXN:', error);
    return null;
  }
}

export async function verifyBalanceIncrease(previousBalance: string, expectedAmount: string): Promise<boolean> {
  try {
    const currentBalance = await getMXNBalance();
    if (!currentBalance) {
      console.log('[Bitso] No se pudo obtener el balance actual');
      return false;
    }
    
    const previous = parseFloat(previousBalance);
    const current = parseFloat(currentBalance);
    const expected = parseFloat(expectedAmount);
    
    const increase = current - previous;
    
    console.log(`[Bitso] Verificación de balance:`);
    console.log(`  - Balance anterior: $${previous.toFixed(2)} MXN`);
    console.log(`  - Balance actual: $${current.toFixed(2)} MXN`);
    console.log(`  - Aumento: $${increase.toFixed(2)} MXN`);
    console.log(`  - Esperado: $${expected.toFixed(2)} MXN`);
    
    // Verificar que el aumento sea EXACTAMENTE el monto esperado (con 2 decimales)
    const increaseMatch = increase.toFixed(2) === expected.toFixed(2);
    
    if (increaseMatch) {
      console.log(`[Bitso] ✅ Balance aumentó exactamente $${expected.toFixed(2)} MXN`);
    } else {
      console.log(`[Bitso] ❌ Balance no coincide - Aumento: $${increase.toFixed(2)}, Esperado: $${expected.toFixed(2)}`);
    }
    
    return increaseMatch;
  } catch (error) {
    console.error('[Bitso] Error verificando aumento de balance:', error);
    return false;
  }
}

export async function getBitsoFundings(limit: number = 100): Promise<BitsoTransaction[]> {
  try {
    const nonce = Date.now().toString();
    const httpMethod = 'GET';
    const requestPath = '/v3/fundings/';
    
    const signature = generateBitsoSignature(httpMethod, requestPath, nonce);
    
    const headers = {
      'Authorization': `Bitso ${BITSO_API_KEY}:${nonce}:${signature}`,
      'Content-Type': 'application/json'
    };

    const response = await axios.get<BitsoFundingsResponse>(`${BITSO_API_URL}/fundings/`, {
      headers,
      params: { limit }
    });

    if (response.data.success) {
      return response.data.payload;
    } else {
      console.error('[Bitso] Error en respuesta:', response.data);
      return [];
    }
  } catch (error: any) {
    console.error('[Bitso] Error obteniendo fundings:', error.response?.data || error.message);
    return [];
  }
}

export async function verifyPayment(expectedAmount: string, receivingAccount?: string): Promise<BitsoTransaction | null> {
  const accountToVerify = receivingAccount || BITSO_RECEIVING_ACCOUNT;
  if (!accountToVerify) {
    throw new Error('BITSO_RECEIVING_ACCOUNT no está configurado');
  }
  try {
    console.log(`[Bitso] Buscando depósito de exactamente $${expectedAmount} MXN`);
    
    const fundings = await getBitsoFundings(50);
    
    // Buscar un depósito que coincida EXACTAMENTE con el monto esperado
    const recentPayment = fundings.find(funding => {
      // Comparar montos con exactitud de 2 decimales
      const fundingAmount = parseFloat(funding.amount).toFixed(2);
      const expected = parseFloat(expectedAmount).toFixed(2);
      const amountMatch = fundingAmount === expected;
      
      const accountMatch = funding.details?.receiving_account === accountToVerify;
      
      // Buscar en las últimas 24 horas
      const isRecent = new Date(funding.created_at).getTime() > Date.now() - 24 * 60 * 60 * 1000;
      
      const isCompleted = funding.status === 'complete';
      
      if (amountMatch) {
        console.log(`[Bitso] Coincidencia encontrada: Monto=${funding.amount}, Cuenta=${funding.details?.receiving_account}, Reciente=${isRecent}, Completado=${isCompleted}`);
      }
      
      return amountMatch && accountMatch && isRecent && isCompleted;
    });

    if (recentPayment) {
      console.log(`[Bitso] ✅ Depósito verificado: ${recentPayment.tid} - $${recentPayment.amount} ${recentPayment.currency}`);
      return recentPayment;
    } else {
      console.log(`[Bitso] ❌ No se encontró depósito de $${expectedAmount} MXN en las últimas 24 horas`);
      return null;
    }
  } catch (error) {
    console.error('[Bitso] Error verificando pago:', error);
    return null;
  }
}

// Flag para prevenir ejecuciones concurrentes
let isCheckingPayments = false;

export async function checkPendingPayments(): Promise<void> {
  // Prevenir ejecuciones concurrentes
  if (isCheckingPayments) {
    console.log('[Bitso] Ya hay una verificación en curso, saltando...');
    return;
  }
  
  isCheckingPayments = true;
  console.log('[Bitso] Verificando pagos pendientes...');
  
  try {
    const { storage } = await import('./storage');
    const pendingPayments = await storage.getPendingPayments();
    
    if (pendingPayments.length === 0) {
      console.log('[Bitso] No hay pagos pendientes');
      return;
    }

    for (const payment of pendingPayments) {
      // Incrementar intentos de verificación
      const newAttempts = (payment.verificationAttempts || 0) + 1;
      await storage.incrementPaymentVerificationAttempts(payment.id);
      
      const user = await storage.getUserById(payment.userId);
      if (!user) {
        console.error(`[Bitso+AI] Usuario ${payment.userId} no encontrado`);
        
        // Si se alcanza el límite de intentos, escalar a revisión manual
        if (newAttempts >= 7) {
          console.log(`[Bitso+AI] ⚠️ Usuario no encontrado después de ${newAttempts} intentos - Marcando para revisión manual`);
          await storage.updatePaymentStatus(payment.id, PaymentStatus.MANUAL_REVIEW);
        }
        continue;
      }
      
      console.log(`[Bitso+AI] Verificando pago ${payment.referenceCode} - Intento ${newAttempts}/7`);
      
      // Paso 1: Verificar aumento de balance en Bitso (si tenemos previousBalance)
      let bitsoVerified = false;
      
      if (payment.previousBalance) {
        bitsoVerified = await verifyBalanceIncrease(payment.previousBalance, payment.amount);
      } else {
        // Fallback: usar método antiguo de buscar transacción
        console.log(`[Bitso] Sin balance previo guardado, usando método de búsqueda de transacciones`);
        const bitsoPayment = await verifyPayment(payment.amount);
        bitsoVerified = bitsoPayment !== null;
      }
      
      // Paso 2: Verificar con AI Vision la captura de pantalla
      let aiVerified = false;
      let aiConfidence = 0;
      
      if (payment.telegramFileId) {
        try {
          const TelegramBot = await import('node-telegram-bot-api');
          const bot = new TelegramBot.default(process.env.TELEGRAM_TOKEN || '', { polling: false });
          const fileLink = await bot.getFileLink(payment.telegramFileId);
          
          const axios = await import('axios');
          const imageResponse = await axios.default.get(fileLink, { responseType: 'arraybuffer' });
          const imageBase64 = Buffer.from(imageResponse.data).toString('base64');
          
          const { verifyPaymentScreenshot } = await import('./paymentVerificationAI');
          const aiAnalysis = await verifyPaymentScreenshot(imageBase64, payment.amount, user.username);
          
          aiVerified = aiAnalysis.isValid && aiAnalysis.confidence > 0.7;
          aiConfidence = aiAnalysis.confidence;
          
          console.log(`[AI] Confianza: ${(aiConfidence * 100).toFixed(0)}% - Válido: ${aiVerified}`);
        } catch (aiError: any) {
          console.error(`[AI] Error verificando:`, aiError.message);
        }
      }
      
      // Paso 3: Activar SOLO si AMBOS métodos confirman
      if (bitsoVerified && aiVerified) {
        console.log(`[Bitso+AI] ✅ VERIFICACIÓN COMPLETA - Balance: ✓ | AI: ${(aiConfidence * 100).toFixed(0)}% confianza`);
        
        await storage.markPaymentAsCompleted(payment.id, 'balance_verified');
        
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + 7);
        
        await storage.updateUser(payment.userId, {
          isActive: true,
          expiresAt: expirationDate
        });
        
        if (user.telegramChatId) {
          try {
            const { sendPaymentConfirmation } = await import('./telegramBot');
            await sendPaymentConfirmation(user.id, payment.amount, expirationDate);
          } catch (notifError: any) {
            console.error(`[Bitso+AI] Error enviando confirmación:`, notifError.message);
          }
        }
        
        console.log(`[Bitso+AI] Usuario ${user.username} activado hasta ${expirationDate.toLocaleDateString('es-ES')}`);
      } else {
        // Al menos uno de los métodos no confirmó
        console.log(`[Bitso+AI] Verificación parcial - Bitso: ${bitsoVerified ? '✓' : '✗'} | AI: ${aiVerified ? '✓' : '✗'} - Intento ${newAttempts}/7`);
        
        // Si se alcanza el límite de intentos, enviar a revisión manual
        if (newAttempts >= 7) {
          console.log(`[Bitso+AI] ⚠️ No se pudo verificar completamente después de ${newAttempts} intentos (15 min) - Enviando a revisión manual`);
          
          await storage.updatePaymentStatus(payment.id, PaymentStatus.MANUAL_REVIEW);
          
          try {
            if (payment.telegramFileId) {
              const { sendManualVerificationRequest } = await import('./telegramBot');
              await sendManualVerificationRequest(payment.id, user, payment.amount, payment.telegramFileId);
            }
          } catch (notifError: any) {
            console.error(`[Bitso+AI] Error enviando solicitud manual:`, notifError.message);
          }
        }
      }
    }
  } catch (error) {
    console.error('[Bitso] Error en verificación de pagos pendientes:', error);
  } finally {
    isCheckingPayments = false;
  }
}

setInterval(checkPendingPayments, 2 * 60 * 1000);
console.log('🔄 Verificación automática de pagos Bitso iniciada (cada 2 minutos)');
