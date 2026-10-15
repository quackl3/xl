import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { MessageSquare, Users, Send, Plus, History, CreditCard, CheckCircle } from "lucide-react";

interface User {
  id: number;
  username: string;
  role: string;
  isActive: boolean;
}

interface SmsHistory {
  id: number;
  userId: number;
  phoneNumber: string;
  message: string;
  sentAt: string;
  status: string;
  errorMessage?: string;
}

const SmsManagementSimple = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Estados locales
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [creditsToAdd, setCreditsToAdd] = useState<number>(0);
  const [isSendSmsDialogOpen, setIsSendSmsDialogOpen] = useState(false);
  
  // Estados para el formulario de envío de SMS
  const [phoneNumbers, setPhoneNumbers] = useState("");
  const [smsMessage, setSmsMessage] = useState("");
  const [prefix, setPrefix] = useState("+52");
  const [routeType, setRouteType] = useState("long_code");

  // Obtener lista de usuarios regulares
  const { data: users = [] } = useQuery({
    queryKey: ['/api/users/regular'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/users/regular');
      return await res.json();
    }
  });

  // Obtener créditos de usuario seleccionado
  const { data: userCredits = 0 } = useQuery({
    queryKey: ['/api/sms/credits', selectedUserId],
    enabled: !!selectedUserId,
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/sms/credits/${selectedUserId}`);
      const data = await res.json();
      return data.credits;
    }
  });

  // Obtener historial de SMS de usuario seleccionado
  const { data: smsHistory = [] } = useQuery({
    queryKey: ['/api/sms/history', selectedUserId],
    enabled: !!selectedUserId,
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/sms/history/${selectedUserId}`);
      const data = await res.json();
      return data.history;
    }
  });

  // Mutación para agregar créditos
  const addCreditsMutation = useMutation({
    mutationFn: async ({ userId, amount }: { userId: number; amount: number }) => {
      const res = await apiRequest('POST', '/api/sms/credits/add', { userId, amount });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Créditos agregados",
        description: `Se han agregado ${creditsToAdd} créditos al usuario`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/sms/credits', selectedUserId] });
      setCreditsToAdd(0);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al agregar créditos",
        variant: "destructive",
      });
    }
  });

  // Mutación para enviar SMS
  const sendSmsMutation = useMutation({
    mutationFn: async ({ phoneNumbers, message, prefix, routeType }: { phoneNumbers: string; message: string; prefix: string; routeType: string }) => {
      const res = await apiRequest('POST', '/api/sms/send', { phoneNumbers, message, prefix, routeType });
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "SMS enviado",
        description: data.message || "El SMS se ha enviado correctamente",
      });
      setIsSendSmsDialogOpen(false);
      setPhoneNumbers("");
      setSmsMessage("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al enviar SMS",
        variant: "destructive",
      });
    }
  });

  const handleAddCredits = () => {
    if (selectedUserId && creditsToAdd > 0) {
      addCreditsMutation.mutate({ userId: selectedUserId, amount: creditsToAdd });
    }
  };

  const handleSendSms = () => {
    if (phoneNumbers.trim() && smsMessage.trim()) {
      console.log('Enviando SMS con datos:', { phoneNumbers, message: smsMessage, prefix, routeType });
      sendSmsMutation.mutate({ phoneNumbers, message: smsMessage, prefix, routeType });
    } else {
      toast({
        title: "Error",
        description: "Debes ingresar números de teléfono y mensaje",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Sistema SMS</h2>
          <p className="text-muted-foreground">
            Gestiona el envío de mensajes de texto y créditos de usuarios
          </p>
        </div>
      </div>

      {/* Estado de la API */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Estado del Sistema SMS
          </CardTitle>
          <CardDescription>
            La API de Sofmex está configurada automáticamente y lista para usar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Badge variant="default" className="bg-green-100 text-green-800">
              Activo
            </Badge>
            <span className="text-sm text-muted-foreground">
              Sistema listo para envío de mensajes
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Panel de gestión de créditos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Gestión de Créditos
            </CardTitle>
            <CardDescription>
              Administra los créditos SMS de los usuarios
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user-select">Seleccionar Usuario</Label>
              <Select value={selectedUserId?.toString() || ""} onValueChange={(value) => setSelectedUserId(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un usuario" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user: User) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.username} ({user.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedUserId && (
              <div className="space-y-4">
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-sm font-medium">Créditos actuales</div>
                  <div className="text-2xl font-bold">{userCredits}</div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="credits-input">Créditos a agregar</Label>
                  <Input
                    id="credits-input"
                    type="number"
                    min="1"
                    value={creditsToAdd === 0 ? '' : creditsToAdd}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || value === '0') {
                        setCreditsToAdd(0);
                      } else {
                        const numValue = parseInt(value);
                        if (!isNaN(numValue) && numValue > 0) {
                          setCreditsToAdd(numValue);
                        }
                      }
                    }}
                    placeholder="Ingresa cantidad (ej: 10)"
                  />
                </div>

                <Button 
                  onClick={handleAddCredits}
                  disabled={creditsToAdd <= 0 || addCreditsMutation.isPending}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {addCreditsMutation.isPending ? 'Agregando...' : 'Agregar Créditos'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Panel de envío de SMS */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Envío de SMS
            </CardTitle>
            <CardDescription>
              Envía mensajes de texto directamente desde el panel
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog open={isSendSmsDialogOpen} onOpenChange={setIsSendSmsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full">
                  <Send className="h-4 w-4 mr-2" />
                  Enviar SMS
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Enviar SMS Masivo</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4">
                  {/* Selección de Ruta */}
                  <div className="space-y-2">
                    <Label htmlFor="route-select">Tipo de ruta</Label>
                    <Select value={routeType} onValueChange={setRouteType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona el tipo de ruta" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="premium">
                          <div className="flex justify-between items-center w-full">
                            <span>Ruta Premium - eims (1.0 crédito)</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="long_code">
                          <div className="flex justify-between items-center w-full">
                            <span>Ruta Económica (0.5 créditos)</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Prefijo de País */}
                  <div className="space-y-2">
                    <Label htmlFor="prefix-select">Prefijo del país</Label>
                    <Select value={prefix} onValueChange={setPrefix}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="+52">México (+52)</SelectItem>
                        <SelectItem value="+1">EE.UU. (+1)</SelectItem>
                        <SelectItem value="+57">Colombia (+57)</SelectItem>
                        <SelectItem value="+34">España (+34)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Números de Teléfono */}
                  <div className="space-y-2">
                    <Label htmlFor="phone-numbers">Números de teléfono</Label>
                    <Textarea
                      id="phone-numbers"
                      value={phoneNumbers}
                      onChange={(e) => setPhoneNumbers(e.target.value)}
                      placeholder="Ej: 5512345678,5523456789 (máximo 250)"
                      rows={3}
                    />
                    <p className="text-sm text-muted-foreground">
                      Separar múltiples números con comas
                      {phoneNumbers.trim() && (
                        <span className="font-medium ml-2">
                          ({phoneNumbers.split(',').filter(n => n.trim()).length} números)
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Mensaje */}
                  <div className="space-y-2">
                    <Label htmlFor="sms-message">Mensaje</Label>
                    <Textarea
                      id="sms-message"
                      value={smsMessage}
                      onChange={(e) => setSmsMessage(e.target.value)}
                      placeholder="Escribe tu mensaje aquí..."
                      rows={4}
                      maxLength={160}
                    />
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>{smsMessage.length}/160 caracteres</span>
                      {phoneNumbers.trim() && routeType && (
                        <span className="font-medium">
                          Total: {((routeType === 'premium' ? 1.0 : 0.5) * 
                            phoneNumbers.split(',').filter(n => n.trim()).length).toFixed(1)} créditos
                        </span>
                      )}
                    </div>
                  </div>

                  <Button 
                    onClick={handleSendSms}
                    disabled={!phoneNumbers.trim() || !smsMessage.trim() || !routeType || sendSmsMutation.isPending}
                    className="w-full"
                  >
                    {sendSmsMutation.isPending ? 'Enviando...' : 'Enviar SMS'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>

      {/* Historial de SMS */}
      {selectedUserId && smsHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Historial de SMS
            </CardTitle>
            <CardDescription>
              Últimos mensajes enviados por el usuario seleccionado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {smsHistory.slice(0, 5).map((sms: SmsHistory) => (
                <div key={sms.id} className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">{sms.phoneNumber}</div>
                    <Badge variant={sms.status === 'sent' ? 'default' : 'destructive'}>
                      {sms.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mb-1">
                    {sms.message}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(sms.sentAt).toLocaleString()}
                  </div>
                  {sms.errorMessage && (
                    <div className="text-xs text-red-600 mt-1">
                      Error: {sms.errorMessage}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SmsManagementSimple;