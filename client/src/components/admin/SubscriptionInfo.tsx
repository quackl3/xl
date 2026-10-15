import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X, Clock, AlertCircle, Calendar, RefreshCw } from 'lucide-react';
import { formatDate } from '@/utils/helpers';
import { useQuery } from '@tanstack/react-query';
import { getQueryFn, queryClient } from '@/lib/queryClient';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useMediaQuery } from '@/hooks/use-media-query';

interface SubscriptionData {
  isActive: boolean;
  isPaid: boolean;
  isAdmin: boolean;
  expiresAt: string | null;
  daysRemaining: number | null;
  hoursRemaining: number | null;
  message: string;
}

const SubscriptionInfo: React.FC = () => {
  const [isExpiringSoon, setIsExpiringSoon] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  
  // Consultar la información de suscripción
  const { data, isLoading, error } = useQuery<SubscriptionData>({
    queryKey: ['/api/user/subscription'],
    queryFn: getQueryFn({ on401: "returnNull" }),
    refetchInterval: 3600000, // Refrescar cada hora (3600000 ms)
  });
  
  useEffect(() => {
    if (data && !data.isAdmin && data.expiresAt) {
      // Si queda menos de un día, consideramos que está expirando pronto
      const isExpiring = (data.daysRemaining === 0 && data.hoursRemaining !== null && data.hoursRemaining < 24) || 
                          (data.daysRemaining !== null && data.daysRemaining <= 1);
      setIsExpiringSoon(isExpiring);
    }
  }, [data]);
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Estado de Suscripción</CardTitle>
          <CardDescription>Cargando información...</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }
  
  if (error || !data) {
    return (
      <Card className="border-red-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Estado de Suscripción</CardTitle>
          <CardDescription>Error al cargar información</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center text-red-500">
            <AlertCircle className="w-4 h-4 mr-2" />
            <span>No se pudo cargar la información de suscripción</span>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Si es administrador, mostrar un mensaje especial
  if (data.isAdmin) {
    if (isDesktop) {
      // Versión compacta para escritorio
      return (
        <Card className="w-full">
          <CardHeader className="p-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-500 text-white hover:bg-blue-500/80">
                  <Check className="w-3 h-3 mr-1" /> Admin
                </Badge>
                <span className="text-xs text-muted-foreground">Acceso completo</span>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/user/subscription'] })}
                className="h-6 w-6 p-0"
                title="Actualizar información"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
        </Card>
      );
    }

    // Versión normal para móvil
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Estado de Cuenta</CardTitle>
          <CardDescription>Administrador del sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center">
            <Badge className="bg-blue-500 text-white hover:bg-blue-500/80">
              <Check className="w-3 h-3 mr-1" /> Administrador
            </Badge>
            <span className="ml-2 text-sm text-muted-foreground">
              Acceso completo al sistema
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Función para refrescar manualmente la información
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/user/subscription'] });
  };
  
  // Versión de escritorio, más compacta
  if (isDesktop) {
    return (
      <Card className={isExpiringSoon ? 'border-orange-300' : (data.isPaid ? 'border-green-200' : 'border-red-200')}>
        <CardHeader className="p-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {data.isActive ? (
                <Badge className="bg-green-500 text-white hover:bg-green-500/80">
                  <Check className="w-3 h-3 mr-1" /> Activo
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <X className="w-3 h-3 mr-1" /> Inactivo
                </Badge>
              )}
              
              {data.expiresAt && data.isPaid && (
                <span className="text-xs text-muted-foreground flex items-center">
                  <Calendar className="w-3 h-3 mr-1" />
                  {data.daysRemaining === 0 
                    ? `${data.hoursRemaining}h restantes` 
                    : `${data.daysRemaining}d ${data.hoursRemaining}h restantes`}
                </span>
              )}
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleRefresh}
              className="h-6 w-6 p-0"
              title="Actualizar información"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
      </Card>
    );
  }
  
  // Versión móvil, completa
  return (
    <Card className={isExpiringSoon ? 'border-orange-300' : (data.isPaid ? 'border-green-200' : 'border-red-200')}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-base">Estado de Suscripción</CardTitle>
            <CardDescription>
              {data.isPaid ? 'Suscripción activa' : 'Suscripción inactiva'}
            </CardDescription>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleRefresh}
            className="h-8 w-8 p-0"
            title="Actualizar información"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center">
            {data.isActive ? (
              <Badge className="bg-green-500 text-white hover:bg-green-500/80">
                <Check className="w-3 h-3 mr-1" /> Activo
              </Badge>
            ) : (
              <Badge variant="destructive">
                <X className="w-3 h-3 mr-1" /> Inactivo
              </Badge>
            )}
            
            {data.expiresAt && (
              <span className="ml-2 text-sm flex items-center">
                <Clock className="w-3 h-3 mr-1" /> 
                Expira: {formatDate(new Date(data.expiresAt))}
              </span>
            )}
          </div>
          
          {data.expiresAt && data.isPaid && (
            <div className="text-sm flex items-center">
              <Calendar className="w-3 h-3 mr-1" />
              <span className={isExpiringSoon ? 'text-orange-500 font-medium' : 'text-muted-foreground'}>
                {data.daysRemaining === 0 
                  ? `${data.hoursRemaining} horas restantes` 
                  : `${data.daysRemaining} días y ${data.hoursRemaining} horas restantes`}
              </span>
            </div>
          )}
          
          <div className={`text-sm mt-2 ${isExpiringSoon ? 'text-orange-500' : (data.isPaid ? 'text-green-600' : 'text-red-500')}`}>
            {data.message}
          </div>
          
          {!data.isPaid && (
            <div className="mt-3 text-sm text-blue-500">
              Contacta al administrador en Telegram: @BalonxSistema para renovar tu suscripción
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SubscriptionInfo;