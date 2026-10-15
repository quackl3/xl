import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Send, Users, CheckCircle, AlertCircle, Bot, Shield, Zap } from 'lucide-react';

interface UserWithTelegram {
  id: number;
  username: string;
  telegramChatId?: string;
  role: string;
}

const TelegramBotManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [adminMessage, setAdminMessage] = useState('');
  const [targetChatId, setTargetChatId] = useState('');
  const [isBroadcast, setIsBroadcast] = useState(false);
  const [adminChatId, setAdminChatId] = useState('');

  // Obtener usuarios con Chat ID configurado
  const { data: users = [] } = useQuery({
    queryKey: ['/api/users/regular'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/users/regular');
      return res.json();
    },
  });

  // Obtener datos del administrador actual
  const { data: currentAdmin } = useQuery({
    queryKey: ['/api/user'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/user');
      return res.json();
    },
  });

  // Mutación para enviar mensaje de administrador
  const sendAdminMessageMutation = useMutation({
    mutationFn: async (data: { message: string; userChatId?: string; isBroadcast: boolean }) => {
      const res = await apiRequest('POST', '/api/telegram/send-admin-message', data);
      return res.json();
    },
    onSuccess: (data) => {
      setAdminMessage('');
      setTargetChatId('');
      toast({
        title: "Mensaje enviado",
        description: data.message || "Mensaje enviado correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error enviando mensaje",
        variant: "destructive",
      });
    },
  });

  // Mutación para actualizar Chat ID del administrador
  const updateAdminChatIdMutation = useMutation({
    mutationFn: async (data: { telegramChatId: string }) => {
      const res = await apiRequest('PUT', '/api/user/profile', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      toast({
        title: "Chat ID actualizado",
        description: "Tu Chat ID de Telegram ha sido configurado correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error actualizando Chat ID",
        variant: "destructive",
      });
    },
  });

  // Enviar mensaje individual o broadcast
  const handleSendMessage = () => {
    if (!adminMessage.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingresa un mensaje",
        variant: "destructive",
      });
      return;
    }

    if (!isBroadcast && !targetChatId.trim()) {
      toast({
        title: "Error",
        description: "Por favor selecciona un usuario o activa el modo broadcast",
        variant: "destructive",
      });
      return;
    }

    sendAdminMessageMutation.mutate({
      message: adminMessage,
      userChatId: isBroadcast ? undefined : targetChatId,
      isBroadcast,
    });
  };

  // Usuarios con Chat ID configurado
  const usersWithChatId = users.filter((user: UserWithTelegram) => user.telegramChatId);

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <Bot className="h-6 w-6 text-blue-500" />
        <h2 className="text-2xl font-bold text-white">Bot de Telegram</h2>
        <Badge variant="outline" className="text-green-400 border-green-400">
          Activo
        </Badge>
      </div>

      <Tabs defaultValue="messaging" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="messaging" className="flex items-center space-x-2">
            <MessageSquare className="h-4 w-4" />
            <span>Mensajería</span>
          </TabsTrigger>
          <TabsTrigger value="2fa" className="flex items-center space-x-2">
            <Shield className="h-4 w-4" />
            <span>2FA</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center space-x-2">
            <Users className="h-4 w-4" />
            <span>Usuarios</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="messaging" className="space-y-6">
          <Card className="bg-[#1a1a1a] border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center space-x-2">
                <Send className="h-5 w-5" />
                <span>Enviar Mensaje</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    checked={!isBroadcast}
                    onChange={() => setIsBroadcast(false)}
                    className="text-blue-500"
                  />
                  <span className="text-white">Mensaje individual</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    checked={isBroadcast}
                    onChange={() => setIsBroadcast(true)}
                    className="text-blue-500"
                  />
                  <span className="text-white">Mensaje masivo (broadcast)</span>
                </label>
              </div>

              {!isBroadcast && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Chat ID del usuario
                  </label>
                  <Input
                    type="text"
                    value={targetChatId}
                    onChange={(e) => setTargetChatId(e.target.value)}
                    placeholder="Ej: 1234567890"
                    className="bg-[#2c2c2c] border-gray-700 text-white"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Usa la tabla de usuarios para copiar el Chat ID
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Mensaje
                </label>
                <Textarea
                  value={adminMessage}
                  onChange={(e) => setAdminMessage(e.target.value)}
                  placeholder="Escribe tu mensaje aquí..."
                  className="bg-[#2c2c2c] border-gray-700 text-white"
                  rows={4}
                />
              </div>

              <Button
                onClick={handleSendMessage}
                disabled={sendAdminMessageMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 w-full"
              >
                {sendAdminMessageMutation.isPending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                {isBroadcast ? 'Enviar a todos los usuarios' : 'Enviar mensaje'}
              </Button>

              {isBroadcast && (
                <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-3">
                  <div className="flex items-center space-x-2 text-yellow-400">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Mensaje masivo</span>
                  </div>
                  <p className="text-xs text-yellow-300 mt-1">
                    Se enviará a {usersWithChatId.length} usuarios con Chat ID configurado
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="2fa" className="space-y-6">
          <Card className="bg-[#1a1a1a] border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <span>Autenticación de Doble Factor</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#2c2c2c] p-4 rounded-lg text-center">
                  <Zap className="h-8 w-8 text-green-500 mx-auto mb-2" />
                  <h3 className="text-white font-medium">Estado</h3>
                  <p className="text-green-400 text-sm">Activo</p>
                </div>
                <div className="bg-[#2c2c2c] p-4 rounded-lg text-center">
                  <CheckCircle className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                  <h3 className="text-white font-medium">Códigos generados</h3>
                  <p className="text-blue-400 text-sm">Sistema automático</p>
                </div>
                <div className="bg-[#2c2c2c] p-4 rounded-lg text-center">
                  <AlertCircle className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                  <h3 className="text-white font-medium">Expiración</h3>
                  <p className="text-yellow-400 text-sm">10 minutos</p>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <h4 className="text-white font-medium mb-2">Funcionamiento del 2FA</h4>
                <ul className="text-gray-300 text-sm space-y-1">
                  <li>• Se envía código automático al Chat ID del usuario al iniciar sesión</li>
                  <li>• Los códigos expiran en 10 minutos por seguridad</li>
                  <li>• También se envía copia al administrador para monitoreo</li>
                  <li>• Limpieza automática de códigos expirados cada 30 minutos</li>
                </ul>
              </div>

              {/* Configuración Chat ID del Administrador */}
              <div className="bg-blue-900/30 border border-blue-600 rounded-lg p-4">
                <h4 className="text-white font-medium mb-3 flex items-center">
                  <Bot className="h-4 w-4 mr-2" />
                  Configurar tu Chat ID
                </h4>
                <div className="space-y-3">
                  <div className="text-sm text-blue-300">
                    Chat ID actual: {currentAdmin?.telegramChatId ? (
                      <span className="text-green-400 font-mono">{currentAdmin.telegramChatId}</span>
                    ) : (
                      <span className="text-red-400">No configurado</span>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <Input
                      type="text"
                      placeholder="Ej: 1234567890"
                      value={adminChatId}
                      onChange={(e) => setAdminChatId(e.target.value)}
                      className="bg-[#2c2c2c] border-gray-700 text-white flex-1"
                    />
                    <Button
                      onClick={() => {
                        if (adminChatId.trim()) {
                          updateAdminChatIdMutation.mutate({ telegramChatId: adminChatId });
                          setAdminChatId('');
                        }
                      }}
                      disabled={updateAdminChatIdMutation.isPending || !adminChatId.trim()}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {updateAdminChatIdMutation.isPending ? 'Guardando...' : 'Guardar'}
                    </Button>
                  </div>
                  <div className="text-xs text-gray-400">
                    Para obtener tu Chat ID, envía /id al bot @panelbalonxbot
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <Card className="bg-[#1a1a1a] border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Usuarios con Telegram</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-sm text-gray-400">
                  Total de usuarios con Chat ID: {usersWithChatId.length} de {users.length}
                </div>

                <div className="grid gap-3">
                  {usersWithChatId.length === 0 ? (
                    <div className="text-center py-6 text-gray-500">
                      No hay usuarios con Chat ID configurado
                    </div>
                  ) : (
                    usersWithChatId.map((user: UserWithTelegram) => (
                      <div
                        key={user.id}
                        className="bg-[#2c2c2c] p-3 rounded-lg flex items-center justify-between"
                      >
                        <div>
                          <div className="text-white font-medium">{user.username}</div>
                          <div className="text-gray-400 text-xs">
                            Chat ID: {user.telegramChatId}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setTargetChatId(user.telegramChatId || '');
                              setIsBroadcast(false);
                            }}
                            className="text-blue-400 hover:text-blue-300"
                          >
                            Seleccionar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(user.telegramChatId || '');
                              toast({
                                title: "Copiado",
                                description: "Chat ID copiado al portapapeles",
                              });
                            }}
                            className="text-gray-400 hover:text-gray-300"
                          >
                            Copiar ID
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="bg-blue-900/30 border border-blue-600 rounded-lg p-3">
                  <div className="flex items-center space-x-2 text-blue-400">
                    <Bot className="h-4 w-4" />
                    <span className="text-sm font-medium">Información del Bot</span>
                  </div>
                  <p className="text-xs text-blue-300 mt-1">
                    Bot: @panelbalonxbot | Los usuarios pueden obtener su Chat ID con /id
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TelegramBotManagement;