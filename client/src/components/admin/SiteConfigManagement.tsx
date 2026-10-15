import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Globe, Save, RefreshCw } from "lucide-react";

interface SiteConfig {
  baseUrl: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

const SiteConfigManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Estado local para el formulario
  const [baseUrl, setBaseUrl] = useState("");

  // Obtener la configuración actual del sitio
  const { data: siteConfig, isLoading } = useQuery({
    queryKey: ['/api/site-config'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/site-config');
      if (!res.ok) {
        throw new Error('Error al obtener la configuración del sitio');
      }
      const data = await res.json();
      // Actualizar el estado local cuando se carga la configuración
      setBaseUrl(data.baseUrl || "https://aclaracionesditales.com");
      return data as SiteConfig;
    }
  });

  // Mutación para actualizar la configuración
  const updateConfigMutation = useMutation({
    mutationFn: async (newBaseUrl: string) => {
      const res = await apiRequest('POST', '/api/site-config', {
        baseUrl: newBaseUrl
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
        description: "La URL base del sitio ha sido actualizada correctamente.",
        variant: "default"
      });
      // Invalidar la consulta para refrescar los datos
      queryClient.invalidateQueries({ queryKey: ['/api/site-config'] });
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
    
    // Validar que la URL no esté vacía
    if (!baseUrl.trim()) {
      toast({
        title: "Error de validación",
        description: "La URL base no puede estar vacía.",
        variant: "destructive"
      });
      return;
    }

    // Validar formato básico de URL
    try {
      new URL(baseUrl);
    } catch {
      toast({
        title: "Error de validación",
        description: "Por favor ingresa una URL válida (ej: https://ejemplo.com).",
        variant: "destructive"
      });
      return;
    }

    updateConfigMutation.mutate(baseUrl);
  };

  const resetToDefault = () => {
    setBaseUrl("https://aclaracionesditales.com");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Configuración del sitio
          </CardTitle>
          <CardDescription>
            Configura la URL base que se utilizará para generar los enlaces de las sesiones.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="baseUrl">URL base del sitio</Label>
              <Input
                id="baseUrl"
                type="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://aclaracionesditales.com"
                disabled={isLoading || updateConfigMutation.isPending}
                data-testid="input-base-url"
              />
              <p className="text-sm text-muted-foreground">
                Esta URL se utilizará como base para generar los enlaces de las sesiones.
                Ejemplo: si ingresas "https://midominio.com", los enlaces generados serán "https://midominio.com/ID_SESION"
              </p>
            </div>

            <div className="flex gap-2">
              <Button 
                type="submit" 
                disabled={isLoading || updateConfigMutation.isPending}
                data-testid="button-save-config"
              >
                {updateConfigMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Guardar configuración
                  </>
                )}
              </Button>

              <Button 
                type="button" 
                variant="outline" 
                onClick={resetToDefault}
                disabled={isLoading || updateConfigMutation.isPending}
                data-testid="button-reset-default"
              >
                Restablecer por defecto
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Información de la configuración actual */}
      {siteConfig && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Configuración actual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">URL base actual:</Label>
                <p className="text-sm text-muted-foreground break-all" data-testid="text-current-url">
                  {siteConfig.baseUrl}
                </p>
              </div>
              
              {siteConfig.updatedBy && (
                <div>
                  <Label className="text-sm font-medium">Última actualización por:</Label>
                  <p className="text-sm text-muted-foreground" data-testid="text-updated-by">
                    {siteConfig.updatedBy}
                  </p>
                </div>
              )}
              
              {siteConfig.updatedAt && (
                <div>
                  <Label className="text-sm font-medium">Fecha de actualización:</Label>
                  <p className="text-sm text-muted-foreground" data-testid="text-updated-at">
                    {new Date(siteConfig.updatedAt).toLocaleString('es-ES')}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SiteConfigManagement;