import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { MessageSquare, Send, CreditCard, AlertCircle, History, ExternalLink } from "lucide-react";

const UserSmsPanel = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [phoneNumbers, setPhoneNumbers] = useState("");
  const [message, setMessage] = useState("");
  const [prefix, setPrefix] = useState("+52");
  const [routeType, setRouteType] = useState<string>("long_code");

  // Obtener créditos del usuario
  const { data: userCredits = 0 } = useQuery({
    queryKey: ['/api/sms/credits'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/sms/credits');
      if (!res.ok) throw new Error('Error al obtener créditos');
      const data = await res.json();
      return data.credits || 0;
    },
    refetchInterval: 30000, // Actualizar cada 30 segundos
  });

  // Obtener historial de SMS
  const { data: smsHistory = [] } = useQuery({
    queryKey: ['/api/sms/history'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/sms/history');
      if (!res.ok) throw new Error('Error al obtener historial');
      const data = await res.json();
      return data || [];
    },
  });

  // Mutación para enviar SMS
  const sendSmsMutation = useMutation({
    mutationFn: async (data: { phoneNumbers: string; message: string; prefix: string; routeType: string }) => {
      const res = await apiRequest('POST', '/api/sms/send', data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Error al enviar SMS');
      }
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "SMS enviado exitosamente",
        description: `Se enviaron ${data.data?.sent || 0} mensajes`,
        variant: "default",
      });
      
      // Limpiar formulario
      setPhoneNumbers("");
      setMessage("");
      
      // Actualizar créditos e historial
      queryClient.invalidateQueries({ queryKey: ['/api/sms/credits'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sms/history'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al enviar SMS",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSendSms = () => {
    if (!phoneNumbers.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingresa al menos un número de teléfono",
        variant: "destructive",
      });
      return;
    }

    if (!message.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingresa un mensaje",
        variant: "destructive",
      });
      return;
    }

    // Calcular cuántos números se van a enviar y el costo total
    const numbers = phoneNumbers.split(',').map(n => n.trim()).filter(n => n.length > 0);
    const costPerSms = routeType === 'premium' ? 1.0 : 0.5;
    const totalCost = numbers.length * costPerSms;
    
    if (userCredits < totalCost) {
      toast({
        title: "Créditos insuficientes",
        description: `Necesitas ${totalCost} créditos para ${numbers.length} SMS, tienes ${userCredits}`,
        variant: "destructive",
      });
      return;
    }

    sendSmsMutation.mutate({ phoneNumbers, message, prefix, routeType });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Panel de créditos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Mis Créditos SMS
          </CardTitle>
          <CardDescription>
            Ruta Premium: 1.0 crédito • Ruta Económica: 0.5 créditos por SMS
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Créditos disponibles</p>
              <p className="text-3xl font-bold text-green-600">{userCredits}</p>
            </div>
            {userCredits === 0 && (
              <Alert className="max-w-md">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Sin créditos.</strong><br />
                  Para recargar saldo, envía un mensaje en Telegram a:{" "}
                  <a 
                    href="https://t.me/BalonxSistema" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline inline-flex items-center gap-1"
                  >
                    @BalonxSistema <ExternalLink className="h-3 w-3" />
                  </a>
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Panel de envío de SMS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Enviar SMS
          </CardTitle>
          <CardDescription>
            Envía mensajes SMS a múltiples números
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Selección de Ruta */}
          <div className="space-y-2">
            <Label htmlFor="route-select">Tipo de ruta</Label>
            <Select value={routeType} onValueChange={setRouteType}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona el tipo de ruta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="premium">
                  <span>Ruta Premium (1.0 crédito)</span>
                </SelectItem>
                <SelectItem value="long_code">
                  <span>Ruta Económica (0.5 créditos)</span>
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
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escribe tu mensaje aquí..."
              rows={4}
              maxLength={160}
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{message.length}/160 caracteres</span>
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
            disabled={!phoneNumbers.trim() || !message.trim() || !routeType || sendSmsMutation.isPending || userCredits === 0}
            className="w-full"
          >
            {sendSmsMutation.isPending ? 'Enviando...' : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Enviar SMS
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Historial de SMS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historial de SMS
          </CardTitle>
          <CardDescription>
            Últimos mensajes enviados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {smsHistory.length === 0 ? (
            <div className="text-center p-6 text-muted-foreground">
              No hay historial de SMS
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {smsHistory.slice(0, 10).map((sms: any) => (
                <div key={sms.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="text-sm font-medium">A: {sms.phoneNumber}</p>
                      <p className="text-sm text-muted-foreground">{sms.message}</p>
                    </div>
                    <Badge variant={sms.status === 'sent' ? 'default' : 'destructive'}>
                      {sms.status === 'sent' ? 'Enviado' : 'Error'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(sms.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UserSmsPanel;