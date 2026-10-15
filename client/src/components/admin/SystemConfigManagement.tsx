import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { DollarSign, Save, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SystemConfig {
  id?: number;
  subscriptionPrice: string;
  updatedAt?: string | null;
  updatedBy?: number | null;
}

const SystemConfigManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [subscriptionPrice, setSubscriptionPrice] = useState("");

  const { data: systemConfig, isLoading } = useQuery({
    queryKey: ['/api/system-config'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/system-config');
      if (!res.ok) {
        throw new Error('Error al obtener la configuración del sistema');
      }
      const data = await res.json();
      setSubscriptionPrice(data.subscriptionPrice || "0");
      return data as SystemConfig;
    }
  });

  const updateConfigMutation = useMutation({
    mutationFn: async (newPrice: string) => {
      const res = await apiRequest('POST', '/api/system-config', {
        subscriptionPrice: newPrice
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Error al actualizar la configuración');
      }
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Configuración actualizada",
        description: "El precio de suscripción ha sido actualizado correctamente.",
        variant: "default"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/system-config'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const price = parseFloat(subscriptionPrice);
    if (isNaN(price) || price < 0) {
      toast({
        title: "Error de validación",
        description: "Por favor ingresa un precio válido (número mayor o igual a 0).",
        variant: "destructive"
      });
      return;
    }

    updateConfigMutation.mutate(subscriptionPrice);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Configuración de Precios
          </CardTitle>
          <CardDescription>
            Configura el precio de suscripción que se cobrará a los usuarios por 7 días de acceso
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-800 dark:text-blue-200">
              <strong>Sistema de Pagos Automático con Bitso:</strong>
              <ul className="mt-2 ml-4 list-disc space-y-1">
                <li>Los usuarios depositarán a la cuenta Bitso configurada</li>
                <li>El bot verificará los pagos automáticamente con la API de Bitso</li>
                <li>Los usuarios serán activados por 7 días al confirmar el pago</li>
                <li>Se enviarán recordatorios 1 día antes del vencimiento</li>
              </ul>
            </AlertDescription>
          </Alert>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subscriptionPrice">Precio de Suscripción (7 días)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <Input
                  id="subscriptionPrice"
                  type="number"
                  step="0.01"
                  value={subscriptionPrice}
                  onChange={(e) => setSubscriptionPrice(e.target.value)}
                  placeholder="0.00"
                  className="pl-8"
                  disabled={isLoading}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Este es el monto que se cobrará a los usuarios por una suscripción de 7 días
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button 
                type="submit" 
                disabled={updateConfigMutation.isPending || isLoading}
                className="w-full sm:w-auto"
              >
                <Save className="w-4 h-4 mr-2" />
                {updateConfigMutation.isPending ? "Guardando..." : "Guardar Configuración"}
              </Button>
            </div>
          </form>

          {systemConfig?.updatedAt && (
            <div className="mt-6 pt-6 border-t">
              <p className="text-sm text-muted-foreground">
                Última actualización: {new Date(systemConfig.updatedAt).toLocaleString('es-MX')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5" />
            Información de Pago
          </CardTitle>
          <CardDescription>
            Detalles importantes sobre el sistema de pagos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-semibold">Cuenta de Depósito</h3>
            <p className="text-sm text-muted-foreground">
              <strong>Plataforma:</strong> Bitso<br />
              <strong>Seguridad:</strong> La cuenta está configurada de forma segura en Replit Secrets<br />
              <strong>Nota:</strong> El bot NO compartirá esta información con los usuarios. Solo el administrador del sistema tiene acceso a estos datos.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">Funcionamiento del Bot</h3>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Respuestas de IA simples solo relacionadas a pagos</li>
              <li>Guía a los usuarios sobre cómo realizar el pago</li>
              <li>Verifica automáticamente los pagos con la API de Bitso</li>
              <li>Activa usuarios por 7 días al confirmar el pago</li>
              <li>Envía recordatorios de renovación 1 día antes del vencimiento</li>
            </ul>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              El precio configurado aquí será el monto que el bot verificará en los depósitos de Bitso.
              Asegúrate de mantenerlo actualizado.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemConfigManagement;
