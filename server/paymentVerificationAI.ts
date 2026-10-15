import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface PaymentVerificationResult {
  isValid: boolean;
  extractedAmount: string | null;
  extractedTime: string | null;
  confidence: number;
  reason: string;
}

export async function verifyPaymentScreenshot(
  imageBase64: string,
  expectedAmount: string,
  username: string
): Promise<PaymentVerificationResult> {
  try {
    const prompt = `Analiza esta captura de pantalla de una transferencia bancaria o pago.

INSTRUCCIONES:
1. Extrae el MONTO de la transferencia (busca números con $ o MXN)
2. Extrae la HORA o FECHA de la transferencia
3. Verifica si el monto coincide con: $${expectedAmount} MXN (tolerancia ±1%)

Responde SOLO en formato JSON con esta estructura:
{
  "monto": "cantidad exacta encontrada",
  "hora": "hora/fecha de la transferencia",
  "coincide": true o false,
  "confianza": número entre 0 y 1,
  "razon": "explicación breve"
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`
              }
            }
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 500,
    });

    const aiResponse = JSON.parse(response.choices[0].message.content || '{}');
    
    console.log('[AI Verification] Respuesta de IA:', aiResponse);

    const extractedAmount = aiResponse.monto || null;
    const extractedTime = aiResponse.hora || null;
    const matches = aiResponse.coincide === true;
    const confidence = aiResponse.confianza || 0;
    const reason = aiResponse.razon || 'No se pudo verificar';

    return {
      isValid: matches && confidence > 0.7,
      extractedAmount,
      extractedTime,
      confidence,
      reason
    };

  } catch (error: any) {
    console.error('[AI Verification] Error:', error);
    return {
      isValid: false,
      extractedAmount: null,
      extractedTime: null,
      confidence: 0,
      reason: `Error al analizar la imagen: ${error.message}`
    };
  }
}

export async function generatePaymentConfirmationMessage(
  username: string,
  amount: string,
  verificationTime: string,
  expirationDate: Date
): Promise<string> {
  const expirationDateStr = expirationDate.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return `✅ *¡Pago Verificado Exitosamente!*

Hola *${username}*,

Tu pago de *$${amount} MXN* ha sido verificado automáticamente.

📅 *Detalles:*
• Hora de verificación: ${verificationTime}
• Monto confirmado: $${amount} MXN
• Cuenta activa hasta: ${expirationDateStr}

🎉 Tu suscripción por 7 días está ahora activa.

¡Gracias por tu pago!`;
}
