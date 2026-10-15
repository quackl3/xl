import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  CreditCard, 
  MessageSquare, 
  Bell, 
  Clock, 
  User, 
  Settings,
  Send,
  History,
  Calendar,
  Bot
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import UserWhatsAppPanel from "@/components/user/UserWhatsAppPanel";

interface UserData {
  id: number;
  username: string;
  role: string;
  isActive: boolean;
  expiresAt: string | null;
  deviceCount: number;
  maxDevices: number;
  allowedBanks: string;
  telegramChatId: string | null;
  createdAt: string | null;
  lastLogin: string | null;
}

interface SmsCredits {
  credits: number;
}

interface SmsHistory {
  id: number;
  phone: string;
  message: string;
  status: string;
  createdAt: string;
  errorMessage: string | null;
}

export default function UserPanel() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  // Obtener datos del usuario
  const { data: userData, isLoading: userLoading } = useQuery<UserData>({
    queryKey: ['/api/user'],
    enabled: !!user
  });

  // Obtener créditos SMS
  const { data: smsCredits, isLoading: creditsLoading } = useQuery<SmsCredits>({
    queryKey: ['/api/sms/credits'],
    enabled: !!user
  });

  // Obtener historial SMS
  const { data: smsHistory, isLoading: historyLoading } = useQuery<SmsHistory[]>({
    queryKey: ['/api/sms/history'],
    enabled: !!user
  });

  // Mutación para enviar SMS
  const sendSmsMutation = useMutation({
    mutationFn: async (data: { phone: string; message: string }) => {
      return await apiRequest("POST", "/api/sms/send", data);
    },
    onSuccess: () => {
      toast({
        title: "SMS Enviado",
        description: "El mensaje ha sido enviado exitosamente"
      });
      setPhone("");
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ['/api/sms/credits'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sms/history'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al enviar SMS",
        variant: "destructive"
      });
    }
  });

  const handleSendSms = (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.trim() && message.trim()) {
      sendSmsMutation.mutate({ phone: phone.trim(), message: message.trim() });
    }
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const getStatusBadge = (isActive: boolean, expiresAt: string | null) => {
    if (!isActive) {
      return <Badge variant="destructive">Inactivo</Badge>;
    }
    
    if (expiresAt) {
      const expiry = new Date(expiresAt);
      const now = new Date();
      const hoursLeft = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      if (hoursLeft <= 24) {
        return <Badge variant="outline" className="border-orange-500 text-orange-700">Expira pronto</Badge>;
      }
    }
    
    return <Badge variant="default" className="bg-green-600">Activo</Badge>;
  };

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Cargando panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Panel de Usuario</h1>
            <p className="text-gray-600">Bienvenido, {userData?.username}</p>
          </div>
          <Button onClick={() => logoutMutation.mutate()} variant="outline">
            Cerrar Sesión
          </Button>
        </div>

        {/* Mensaje de Soporte Técnico */}
        <Alert className="border-blue-200 bg-blue-50">
          <MessageSquare className="h-4 w-4 text-blue-600" />
          <AlertDescription>
            <div className="flex flex-col gap-1">
              <span className="font-medium text-blue-800">Soporte Técnico y Suscripciones:</span>
              <span className="text-blue-700">
                Para soporte técnico o gestión de suscripciones, comunícate por Telegram con{' '}
                <span className="font-semibold">@BalonxSistema</span>
              </span>
            </div>
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="account" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="account" data-testid="tab-account">
              <User className="h-4 w-4 mr-2" />
              Cuenta
            </TabsTrigger>
            <TabsTrigger value="sms" data-testid="tab-sms">
              <MessageSquare className="h-4 w-4 mr-2" />
              SMS
            </TabsTrigger>
            <TabsTrigger value="whatsapp" data-testid="tab-whatsapp">
              <Bot className="h-4 w-4 mr-2" />
              WhatsApp Bot
            </TabsTrigger>
          </TabsList>

          <TabsContent value="account" className="space-y-6">
            {/* Información del Usuario */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Información de la Cuenta
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Estado</Label>
                    <div className="mt-1">
                      {userData && getStatusBadge(userData.isActive, userData.expiresAt)}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Dispositivos</Label>
                    <p className="text-lg font-semibold">{userData?.deviceCount || 0}/{userData?.maxDevices || 0}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Bancos Permitidos</Label>
                    <p className="text-sm">{userData?.allowedBanks === 'all' ? 'Todos' : userData?.allowedBanks}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Expira</Label>
                    <p className="text-sm">
                      {userData?.expiresAt 
                        ? format(new Date(userData.expiresAt), "dd/MM/yyyy HH:mm", { locale: es })
                        : "Sin fecha"
                      }
                    </p>
                  </div>
                </div>

                {userData?.expiresAt && userData?.isActive && (
                  <Alert className="mt-4">
                    <Calendar className="h-4 w-4" />
                    <AlertDescription>
                      Tu suscripción expira el {format(new Date(userData.expiresAt), "dd 'de' MMMM 'a las' HH:mm", { locale: es })}. 
                      Para renovar, contacta a @balonxSistema
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Información de Soporte */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Soporte y Configuración
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Chat ID de Telegram</Label>
                    <p className="text-sm font-mono bg-gray-100 p-2 rounded">
                      {userData?.telegramChatId || "No configurado"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Soporte</Label>
                    <p className="text-sm">
                      Para soporte técnico, contacta: <span className="font-medium">@balonxSistema</span>
                    </p>
                  </div>
                </div>

                <Alert className="mt-4">
                  <Bell className="h-4 w-4" />
                  <AlertDescription>
                    Las notificaciones y códigos 2FA se envían automáticamente a tu Telegram configurado.
                    Si no recibes notificaciones, verifica tu Chat ID con el bot.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sms" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Envío de SMS */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Envío de SMS
              </CardTitle>
              <CardDescription>
                Créditos disponibles: <span className="font-semibold">{smsCredits?.credits || 0}</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSendSms} className="space-y-4">
                <div>
                  <Label htmlFor="phone">Número de Teléfono</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+525512345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="message">Mensaje</Label>
                  <Textarea
                    id="message"
                    placeholder="Escribe tu mensaje aquí..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    required
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    {message.length}/160 caracteres
                  </p>
                </div>
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={!phone.trim() || !message.trim() || sendSmsMutation.isPending || (smsCredits?.credits || 0) <= 0}
                >
                  {sendSmsMutation.isPending ? (
                    <>Enviando...</>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Enviar SMS
                    </>
                  )}
                </Button>
              </form>

              {(smsCredits?.credits || 0) <= 0 && (
                <Alert className="mt-4">
                  <CreditCard className="h-4 w-4" />
                  <AlertDescription>
                    No tienes créditos SMS disponibles. Contacta al administrador para solicitar más créditos.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Historial de SMS */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Historial de SMS
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                {historyLoading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  </div>
                ) : smsHistory && smsHistory.length > 0 ? (
                  <div className="space-y-3">
                    {smsHistory.map((sms) => (
                      <div key={sms.id} className="border rounded-lg p-3">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium">{sms.phone}</span>
                          <Badge variant={sms.status === 'sent' ? 'default' : 'destructive'}>
                            {sms.status === 'sent' ? 'Enviado' : 'Error'}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{sms.message}</p>
                        <div className="flex items-center text-xs text-gray-500">
                          <Clock className="h-3 w-3 mr-1" />
                          {format(new Date(sms.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}
                        </div>
                        {sms.errorMessage && (
                          <p className="text-xs text-red-600 mt-1">{sms.errorMessage}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No hay mensajes enviados</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
            </div>
          </TabsContent>

          <TabsContent value="whatsapp">
            <UserWhatsAppPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}