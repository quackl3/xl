import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, getQueryFn } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Check, X, Clock, User, Calendar, Smartphone, ToggleLeft, ToggleRight, Trash, Settings, Building, Link as LinkIcon, MessageCircle, DollarSign, Search, Filter, Plus } from 'lucide-react';
import { formatDate } from '@/utils/helpers';
import { useToast } from '@/hooks/use-toast';
import { useDeviceInfo } from '@/hooks/use-device-orientation';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BankType } from '@shared/schema';

// Interfaces
interface User {
  id: number;
  username: string;
  role: string;
  accountType?: 'individual' | 'office';
  isActive: boolean;
  expiresAt: string | null;
  deviceCount: number;
  maxDevices: number;
  createdAt: string | null;
  lastLogin: string | null;
  allowedBanks?: string;
  customPrice?: string | null;
  telegramChatId?: string | null;
}

interface LinkQuota {
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string;
}

const RegisteredUsersManagement: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);
  const [isPriceDialogOpen, setIsPriceDialogOpen] = useState(false);
  const [bankOptions, setBankOptions] = useState<string[]>(['all']);
  const [generatedLink, setGeneratedLink] = useState<string>('');
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [selectedBank, setSelectedBank] = useState<string>('BANORTE');
  const [messageText, setMessageText] = useState<string>('');
  const [customPriceValue, setCustomPriceValue] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const { isMobile, isLandscape } = useDeviceInfo();
  const [userQuotas, setUserQuotas] = useState<Map<number, LinkQuota>>(new Map());

  // Consultar los usuarios (solo el usuario balonx puede ver esto)
  const { 
    data: users = [], 
    isLoading, 
    error, 
    refetch 
  } = useQuery<User[]>({
    queryKey: ['/api/users/regular'],
    queryFn: getQueryFn({ on401: 'throw' }),
    retry: 1,
    // Forzar refresco automático cada 3 segundos para mantener los datos actualizados
    // Esto es necesario porque parece que la invalidación de caché no está funcionando correctamente
    refetchInterval: 3000
  });
  
  // Manejar errores y éxitos de manera independiente
  React.useEffect(() => {
    if (error) {
      console.error('[RegisteredUsers] Error al obtener usuarios:', error);
    }
  }, [error]);
  
  React.useEffect(() => {
    if (users && users.length > 0) {
      console.log('[RegisteredUsers] Usuarios obtenidos:', users.length);
      // Mostrar detalles de los usuarios para depuración
      users.forEach(user => {
        console.log(`Usuario: ${user.username}, Activo: ${user.isActive}, Expira: ${user.expiresAt || 'No establecido'}`);
      });
      // Cargar cuotas de links para cada usuario
      fetchUserQuotas();
    }
  }, [users]);

  // Cargar cuotas de links para todos los usuarios (paralelo para mejor rendimiento)
  const fetchUserQuotas = async () => {
    const quotasMap = new Map<number, LinkQuota>();
    
    // Obtener todas las cuotas en paralelo para mejor rendimiento
    const quotaPromises = users.map(async (user) => {
      try {
        const response = await fetch(`/api/admin/users/${user.id}/link-quota`);
        if (response.ok) {
          const data = await response.json();
          return { userId: user.id, quota: data.quota };
        }
      } catch (error) {
        console.error(`Error al obtener cuota para usuario ${user.id}:`, error);
      }
      return null;
    });
    
    const results = await Promise.all(quotaPromises);
    
    // Mapear los resultados
    results.forEach((result) => {
      if (result) {
        quotasMap.set(result.userId, result.quota);
      }
    });
    
    setUserQuotas(quotasMap);
  };

  // Filtrar usuarios según búsqueda y estado
  const filteredUsers = React.useMemo(() => {
    let filtered = [...users];
    
    // Filtro por búsqueda
    if (searchQuery.trim()) {
      filtered = filtered.filter(user => 
        user.username.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Filtro por estado
    if (statusFilter === 'active') {
      filtered = filtered.filter(user => user.isActive);
    } else if (statusFilter === 'inactive') {
      filtered = filtered.filter(user => !user.isActive);
    }
    
    return filtered;
  }, [users, searchQuery, statusFilter]);

  // Activar usuario por 1 día
  const activateOneDayMutation = useMutation({
    mutationFn: async (data: { username: string, allowedBanks: string }) => {
      const { username, allowedBanks } = data;
      console.log(`[RegisteredUsers] Intentando activar usuario ${username} por 1 día`);
      console.log(`[RegisteredUsers] Bancos permitidos: ${allowedBanks}`);
        
      const res = await apiRequest(
        'POST',
        `/api/users/regular/${username}/activate-one-day`,
        { allowedBanks }
      );
      const responseData = await res.json();
      console.log(`[RegisteredUsers] Respuesta de activación por 1 día:`, responseData);
      return responseData;
    },
    onSuccess: (data) => {
      console.log(`[RegisteredUsers] Activación por 1 día exitosa:`, data);
      // Invalidar la consulta y forzar su recarga
      queryClient.invalidateQueries({ queryKey: ['/api/users/regular'] });
      refetch(); // Forzar una recarga inmediata
      toast({
        title: 'Usuario activado',
        description: 'El usuario ha sido activado por 1 día. ' + 
          (data.user?.expiresAt ? `Expira: ${formatDate(new Date(data.user.expiresAt))}` : ''),
      });
      
      // Cerrar el diálogo si está abierto
      setSelectedUser(null);
    },
    onError: (error: Error) => {
      console.error(`[RegisteredUsers] Error al activar usuario por 1 día:`, error);
      toast({
        title: 'Error al activar usuario',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Activar usuario por 7 días
  const activateSevenDaysMutation = useMutation({
    mutationFn: async (data: { username: string, allowedBanks: string }) => {
      const { username, allowedBanks } = data;
      console.log(`[RegisteredUsers] Intentando activar usuario ${username} por 7 días`);
      console.log(`[RegisteredUsers] Bancos permitidos: ${allowedBanks}`);
        
      const res = await apiRequest(
        'POST',
        `/api/users/regular/${username}/activate-seven-days`,
        { allowedBanks }
      );
      const responseData = await res.json();
      console.log(`[RegisteredUsers] Respuesta de activación por 7 días:`, responseData);
      return responseData;
    },
    onSuccess: (data) => {
      console.log(`[RegisteredUsers] Activación por 7 días exitosa:`, data);
      // Invalidar la consulta y forzar su recarga
      queryClient.invalidateQueries({ queryKey: ['/api/users/regular'] });
      refetch(); // Forzar una recarga inmediata
      toast({
        title: 'Usuario activado',
        description: 'El usuario ha sido activado por 7 días. ' + 
          (data.user?.expiresAt ? `Expira: ${formatDate(new Date(data.user.expiresAt))}` : ''),
      });
      
      // Cerrar el diálogo si está abierto
      setSelectedUser(null);
    },
    onError: (error: Error) => {
      console.error(`[RegisteredUsers] Error al activar usuario por 7 días:`, error);
      toast({
        title: 'Error al activar usuario',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Alternar estado (activar/desactivar)
  const toggleUserStatusMutation = useMutation({
    mutationFn: async (username: string) => {
      console.log(`[RegisteredUsers] Intentando alternar estado del usuario ${username}`);
      const res = await apiRequest(
        'POST',
        `/api/users/regular/${username}/toggle-status`
      );
      const data = await res.json();
      console.log(`[RegisteredUsers] Respuesta de toggle estado:`, data);
      return data;
    },
    onSuccess: (data) => {
      console.log(`[RegisteredUsers] Toggle de estado exitoso:`, data);
      // Invalidar la consulta y forzar su recarga
      queryClient.invalidateQueries({ queryKey: ['/api/users/regular'] });
      refetch(); // Forzar una recarga inmediata
      toast({
        title: `Usuario ${data.user.isActive ? 'activado' : 'desactivado'}`,
        description: `El estado del usuario ha sido cambiado a ${data.user.isActive ? 'activo' : 'inactivo'}.`,
      });
    },
    onError: (error: Error) => {
      console.error(`[RegisteredUsers] Error al alternar estado:`, error);
      toast({
        title: 'Error al cambiar estado',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Limpiar usuarios expirados
  const cleanupExpiredUsersMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/users/cleanup-expired');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/users/regular'] });
      refetch(); // Forzar recarga inmediata
      toast({
        title: 'Limpieza completada',
        description: `Se han desactivado ${data.deactivatedCount} usuarios expirados.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al limpiar usuarios',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  // Eliminar un usuario
  const deleteUserMutation = useMutation({
    mutationFn: async (username: string) => {
      console.log(`[RegisteredUsers] Intentando eliminar usuario ${username}`);
      const res = await apiRequest(
        'DELETE',
        `/api/users/regular/${username}`
      );
      const data = await res.json();
      console.log(`[RegisteredUsers] Respuesta de eliminación:`, data);
      return data;
    },
    onSuccess: (data) => {
      console.log(`[RegisteredUsers] Eliminación exitosa:`, data);
      // Invalidar la consulta y forzar su recarga
      queryClient.invalidateQueries({ queryKey: ['/api/users/regular'] });
      refetch(); // Forzar una recarga inmediata
      toast({
        title: 'Usuario eliminado',
        description: data.message || 'El usuario ha sido eliminado correctamente.',
      });
    },
    onError: (error: Error) => {
      console.error(`[RegisteredUsers] Error al eliminar usuario:`, error);
      toast({
        title: 'Error al eliminar usuario',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  // Generar enlace para usuario
  const generateLinkMutation = useMutation({
    mutationFn: async (banco: string) => {
      console.log(`[RegisteredUsers] Generando enlace para el banco: ${banco}`);
      const res = await apiRequest('GET', `/api/generate-link?banco=${banco}`);
      return await res.json();
    },
    onSuccess: (data) => {
      setGeneratedLink(data.link);
      setGeneratedCode(data.code);
      setIsLinkDialogOpen(true);
      
      toast({
        title: "Enlace generado",
        description: `Enlace generado exitosamente con código: ${data.code}`,
      });
      
      // Invalidar la consulta para actualizar la lista de sesiones
      queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al generar enlace",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Enviar mensaje directo de Telegram
  const sendTelegramMessageMutation = useMutation({
    mutationFn: async ({ username, message }: { username: string; message: string }) => {
      const res = await apiRequest(
        'POST',
        '/api/telegram/send-direct-message',
        { 
          username,
          message 
        }
      );
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Mensaje enviado',
        description: data.message,
      });
      setMessageText('');
      setIsMessageDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al enviar mensaje',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Actualizar precio personalizado
  const updateCustomPriceMutation = useMutation({
    mutationFn: async ({ userId, customPrice }: { userId: number; customPrice: string | null }) => {
      const res = await apiRequest(
        'PATCH',
        `/api/users/${userId}/custom-price`,
        { customPrice }
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users/regular'] });
      refetch();
      toast({
        title: 'Precio actualizado',
        description: 'El precio personalizado se ha actualizado correctamente.',
      });
      setIsPriceDialogOpen(false);
      setCustomPriceValue('');
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al actualizar precio',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Manejar activaciones de usuario
  const handleOpenBankOptions = (user: User) => {
    setSelectedUser(user);
    // Inicializar las opciones de bancos seleccionadas basadas en el usuario actual
    const banksList = user.allowedBanks === 'all' 
      ? ['all'] 
      : user.allowedBanks?.split(',') || ['all'];
    setBankOptions(banksList);
    setIsDialogOpen(true);
  };
  
  const handleUpdateBankOptions = () => {
    if (!selectedUser) return;
    
    // Actualizaremos los bancos permitidos cuando el usuario se active
    // No necesitamos hacer nada más aquí, ya que las mutaciones de activación
    // enviarán la información actualizada
    setIsDialogOpen(false);
  };
  
  const handleBankOptionChange = (bank: string) => {
    // Si seleccionamos 'all', eliminamos todas las demás opciones
    if (bank === 'all') {
      setBankOptions(['all']);
      return;
    }
    
    // Si ya tenemos 'all' seleccionado y elegimos una opción específica, eliminamos 'all'
    if (bankOptions.includes('all')) {
      setBankOptions([bank]);
      return;
    }
    
    // Si ya tenemos la opción seleccionada, la removemos, a menos que sea la única
    if (bankOptions.includes(bank) && bankOptions.length > 1) {
      setBankOptions(bankOptions.filter(b => b !== bank));
      return;
    }
    
    // Si tenemos menos de 3 bancos seleccionados y no incluye 'all', agregamos la opción
    if (bankOptions.length < 3 && !bankOptions.includes('all') && !bankOptions.includes(bank)) {
      setBankOptions([...bankOptions, bank]);
      return;
    }
    
    // Si ya tenemos 3 bancos y seleccionamos uno nuevo, mostramos un mensaje
    if (bankOptions.length >= 3 && !bankOptions.includes(bank) && !bankOptions.includes('all')) {
      toast({
        title: 'Límite alcanzado',
        description: 'Solo puede seleccionar hasta 3 bancos específicos, o la opción "Todos".',
        variant: 'destructive',
      });
    }
  };
  
  const handleActivateOneDay = (username: string) => {
    // Actualizar correctamente los bancos permitidos en la mutación
    console.log(`[RegisteredUsers] Activando por 1 día: ${username}, bancos:`, bankOptions);
    
    // Si hemos seleccionado "todos los bancos", usamos "all" como valor
    const allowedBanksValue = bankOptions.includes('all') ? 'all' : bankOptions.join(',');
    
    console.log(`[RegisteredUsers] Valor final de allowedBanks: ${allowedBanksValue}`);
    
    activateOneDayMutation.mutate({
      username, 
      allowedBanks: allowedBanksValue
    });
  };

  const handleActivateSevenDays = (username: string) => {
    // Actualizar correctamente los bancos permitidos en la mutación
    console.log(`[RegisteredUsers] Activando por 7 días: ${username}, bancos:`, bankOptions);
    
    // Si hemos seleccionado "todos los bancos", usamos "all" como valor
    const allowedBanksValue = bankOptions.includes('all') ? 'all' : bankOptions.join(',');
    
    console.log(`[RegisteredUsers] Valor final de allowedBanks: ${allowedBanksValue}`);
    
    activateSevenDaysMutation.mutate({
      username,
      allowedBanks: allowedBanksValue
    });
  };

  const handleToggleStatus = (username: string) => {
    toggleUserStatusMutation.mutate(username);
  };

  const handleOpenPriceDialog = (user: User) => {
    setSelectedUser(user);
    setCustomPriceValue(user.customPrice || '');
    setIsPriceDialogOpen(true);
  };

  const handleUpdateCustomPrice = () => {
    if (!selectedUser) return;
    
    const priceValue = customPriceValue.trim() === '' ? null : customPriceValue;
    updateCustomPriceMutation.mutate({
      userId: selectedUser.id,
      customPrice: priceValue
    });
  };

  const handleCleanupExpiredUsers = () => {
    cleanupExpiredUsersMutation.mutate();
  };
  
  const handleDeleteUser = (username: string) => {
    // Confirmación antes de eliminar
    if (window.confirm(`¿Estás seguro de que deseas eliminar al usuario "${username}"? Esta acción no se puede deshacer.`)) {
      deleteUserMutation.mutate(username);
    }
  };
  
  // Resetear cuota de links de un usuario
  const resetLinkQuotaMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest('POST', `/api/admin/users/${userId}/reset-link-quota`, {});
      return await res.json();
    },
    onSuccess: (data, userId) => {
      toast({
        title: 'Cuota reseteada',
        description: data.message || 'El usuario puede generar 150 links adicionales',
      });
      // Actualizar la cuota en el estado local
      fetchUserQuotas();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al resetear cuota',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Obtener el color del contador según el porcentaje de uso
  const getQuotaColor = (used: number, limit: number): string => {
    const percentage = (used / limit) * 100;
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 70) return 'text-yellow-600';
    return 'text-green-600';
  };

  // Manejador para resetear la cuota de links
  const handleResetLinkQuota = (user: User) => {
    if (window.confirm(`¿Estás seguro de que deseas resetear la cuota de links para "${user.username}"? Esto permitirá al usuario generar 150 links adicionales.`)) {
      resetLinkQuotaMutation.mutate(user.id);
    }
  };

  // Manejador para generar un nuevo enlace
  const handleGenerateLink = (user: User) => {
    // Verificar si el usuario está activo
    if (!user.isActive) {
      toast({
        title: "Usuario inactivo",
        description: "El usuario debe estar activo para generar enlaces",
        variant: "destructive"
      });
      return;
    }
    
    // Determinar qué banco usar
    let bancoSeleccionado = selectedBank;
    
    // Verificar las restricciones de bancos del usuario
    if (user.allowedBanks && user.allowedBanks !== 'all') {
      const bancosPermitidos = user.allowedBanks.split(',').map(b => b.trim());
      console.log(`[RegisteredUsers] Bancos permitidos para ${user.username}:`, bancosPermitidos);
      
      // Verificar si el banco seleccionado está permitido para el usuario
      if (!bancosPermitidos.includes(bancoSeleccionado)) {
        // Si el banco seleccionado no está permitido, usar el primero disponible
        if (bancosPermitidos.length > 0) {
          bancoSeleccionado = bancosPermitidos[0].toUpperCase();
          toast({
            title: "Banco cambiado",
            description: `Banco seleccionado no disponible para este usuario. Usando ${bancoSeleccionado} en su lugar.`,
          });
        } else {
          toast({
            title: "Error",
            description: "Este usuario no tiene bancos permitidos configurados.",
            variant: "destructive"
          });
          return;
        }
      }
    }
    
    console.log(`[RegisteredUsers] Generando enlace para ${user.username} con banco ${bancoSeleccionado}`);
    
    // Para cualquier usuario (incluido el superadmin), usamos la API normal
    // que ya tiene la lógica para verificar restricciones de bancos
    generateLinkMutation.mutate(bancoSeleccionado);
  };
  
  // Función para copiar el enlace al portapapeles
  const copyGeneratedLink = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink)
        .then(() => {
          toast({
            title: "Enlace copiado",
            description: "El enlace ha sido copiado al portapapeles",
          });
        })
        .catch(err => {
          console.error('Error al copiar al portapapeles:', err);
          toast({
            title: "Error al copiar",
            description: "No se pudo copiar el enlace",
            variant: "destructive",
          });
        });
    }
  };

  // Funciones para manejo de mensajes de Telegram
  const handleOpenMessageDialog = (user: User) => {
    setSelectedUser(user);
    setMessageText('');
    setIsMessageDialogOpen(true);
  };

  const handleSendMessage = () => {
    if (!selectedUser || !messageText.trim()) return;
    
    sendTelegramMessageMutation.mutate({
      username: selectedUser.username,
      message: messageText.trim()
    });
  };

  // Revisar si hay error de permisos
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Usuarios Registrados</CardTitle>
          <CardDescription>
            Gestión de usuarios normales del sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <X className="w-12 h-12 text-destructive mb-2" />
            <h3 className="text-lg font-semibold mb-1">Acceso Denegado</h3>
            <p className="text-muted-foreground">
              Solo el usuario "balonx" puede acceder a esta sección.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Usuarios Registrados</CardTitle>
          <CardDescription>
            Administra los usuarios que pueden acceder al sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filtros de búsqueda y estado */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar usuario..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-md bg-background"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('all')}
                className="flex-1 sm:flex-none"
              >
                <Filter className="h-4 w-4 mr-2" />
                Todos ({users.length})
              </Button>
              <Button
                variant={statusFilter === 'active' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('active')}
                className="flex-1 sm:flex-none"
              >
                <Check className="h-4 w-4 mr-2" />
                Activos ({users.filter(u => u.isActive).length})
              </Button>
              <Button
                variant={statusFilter === 'inactive' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('inactive')}
                className="flex-1 sm:flex-none"
              >
                <X className="h-4 w-4 mr-2" />
                Inactivos ({users.filter(u => !u.isActive).length})
              </Button>
            </div>
          </div>
          
          {isLoading ? (
            <div className="flex justify-center items-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {filteredUsers.length === 0 ? (
                <div className="text-center p-6 border rounded-md bg-muted/30">
                  <p className="text-muted-foreground">
                    {searchQuery || statusFilter !== 'all' 
                      ? 'No se encontraron usuarios con los filtros aplicados' 
                      : 'No hay usuarios registrados'}
                  </p>
                </div>
              ) : (
                <>
                  {/* Renderización condicional basada en si es móvil y orientación */}
                  {!isMobile || isLandscape ? (
                    /* Vista para desktop o móvil en landscape: tabla */
                    <div className="overflow-x-auto max-h-[70vh] overflow-y-auto pr-2">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                          <TableRow>
                            <TableHead>Usuario</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Precio</TableHead>
                            <TableHead>Links</TableHead>
                            <TableHead>Caduca</TableHead>
                            <TableHead>Dispositivos</TableHead>
                            <TableHead>Último Login</TableHead>
                            <TableHead>Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredUsers.map((user) => (
                            <TableRow key={user.id}>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  {user.username}
                                  {user.allowedBanks && (
                                    <Badge variant="outline" className="px-1.5 py-0 h-5">
                                      <Building className="h-3 w-3 mr-1" /> 
                                      {user.allowedBanks === 'all' ? 'Todos' : user.allowedBanks.split(',').length}
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {user.accountType === 'office' ? (
                                  <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">
                                    <Building className="w-3 h-3 mr-1" /> Oficina
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary">
                                    <User className="w-3 h-3 mr-1" /> Individual
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {user.isActive ? (
                                  <Badge className="bg-green-500 text-white hover:bg-green-500/80">
                                    <Check className="w-3 h-3 mr-1" /> Activo
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive">
                                    <X className="w-3 h-3 mr-1" /> Inactivo
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <DollarSign className="w-3 h-3 text-green-600" />
                                  <span className="font-medium">
                                    ${user.customPrice || (user.accountType === 'office' ? '6000' : '3000')}
                                  </span>
                                  {user.customPrice && (
                                    <span className="text-xs text-muted-foreground ml-1">(personalizado)</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {(() => {
                                  const quota = userQuotas.get(user.id);
                                  if (!quota) {
                                    return (
                                      <div className="flex items-center gap-2">
                                        <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                                        <span className="text-xs text-muted-foreground">Cargando...</span>
                                      </div>
                                    );
                                  }
                                  
                                  return (
                                    <div className="flex flex-col gap-1">
                                      <div className="flex items-center gap-2">
                                        <LinkIcon className="w-3 h-3 text-muted-foreground" />
                                        <span className={`font-medium ${getQuotaColor(quota.used, quota.limit)}`}>
                                          {quota.used} / {quota.limit}
                                        </span>
                                      </div>
                                      {quota.used >= quota.limit * 0.7 && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleResetLinkQuota(user)}
                                          disabled={resetLinkQuotaMutation.isPending}
                                          className="h-6 px-2 text-xs"
                                          title="Resetear cuota y agregar 150 links más"
                                        >
                                          <Plus className="w-3 h-3 mr-1" />
                                          Agregar
                                        </Button>
                                      )}
                                    </div>
                                  );
                                })()}
                              </TableCell>
                              <TableCell>
                                {user.expiresAt ? (
                                  <div className="flex flex-col">
                                    <span className="flex items-center text-sm">
                                      <Clock className="w-3 h-3 mr-1" /> 
                                      {formatDate(new Date(user.expiresAt))}
                                    </span>
                                    {user.isActive && (
                                      <span className="text-xs text-muted-foreground mt-1">
                                        {(() => {
                                          const now = new Date();
                                          const expiresAt = new Date(user.expiresAt);
                                          if (expiresAt < now) {
                                            return (
                                              <Badge variant="destructive" className="text-xs">
                                                Vencido
                                              </Badge>
                                            );
                                          }
                                          const timeRemainingMs = expiresAt.getTime() - now.getTime();
                                          const daysRemaining = Math.floor(timeRemainingMs / (1000 * 60 * 60 * 24));
                                          const hoursRemaining = Math.floor((timeRemainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                          
                                          if (daysRemaining === 0 && hoursRemaining < 24) {
                                            return (
                                              <Badge variant="destructive" className="text-xs">
                                                Vence en {hoursRemaining}h
                                              </Badge>
                                            );
                                          }
                                          return `Restante: ${daysRemaining}d ${hoursRemaining}h`;
                                        })()}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">No establecido</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {user.deviceCount || 0} / {user.maxDevices || 3}
                              </TableCell>
                              <TableCell>
                                {user.lastLogin ? formatDate(new Date(user.lastLogin)) : 'Nunca'}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => handleOpenBankOptions(user)}
                                    disabled={activateOneDayMutation.isPending || activateSevenDaysMutation.isPending}
                                    title="Configurar bancos y activar"
                                  >
                                    <Building className="w-4 h-4 mr-1" /> Activar
                                  </Button>
                                  <Button 
                                    variant={user.isActive ? "destructive" : "default"}
                                    size="sm"
                                    className="ml-2"
                                    onClick={() => handleToggleStatus(user.username)}
                                    disabled={toggleUserStatusMutation.isPending}
                                  >
                                    {user.isActive ? 
                                      <><ToggleRight className="w-4 h-4 mr-1" /> Desactivar</> : 
                                      <><ToggleLeft className="w-4 h-4 mr-1" /> Activar</>
                                    }
                                  </Button>
                                  <Button 
                                    variant="destructive" 
                                    size="sm"
                                    className="ml-2"
                                    onClick={() => handleDeleteUser(user.username)}
                                    disabled={deleteUserMutation.isPending}
                                  >
                                    <Trash className="w-4 h-4" />
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="ml-2"
                                    onClick={() => handleOpenMessageDialog(user)}
                                    disabled={!user.telegramChatId || sendTelegramMessageMutation.isPending}
                                    title={!user.telegramChatId ? "Usuario sin Chat ID configurado" : "Enviar mensaje de Telegram"}
                                  >
                                    <MessageCircle className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    /* Vista para móvil en portrait: tarjetas */
                    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                      {filteredUsers.map((user) => (
                        <div key={user.id} className="border rounded-lg p-4 bg-card">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-2">
                              <User className="h-5 w-5 text-muted-foreground" />
                              <span className="font-medium">{user.username}</span>
                              {user.allowedBanks && (
                                <Badge variant="outline" className="px-1.5 py-0 h-5 ml-1">
                                  <Building className="h-3 w-3 mr-1" /> 
                                  {user.allowedBanks === 'all' ? 'Todos' : user.allowedBanks.split(',').length}
                                </Badge>
                              )}
                            </div>
                            {user.isActive ? (
                              <Badge className="bg-green-500 text-white hover:bg-green-500/80">
                                <Check className="w-3 h-3 mr-1" /> Activo
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                <X className="w-3 h-3 mr-1" /> Inactivo
                              </Badge>
                            )}
                          </div>
                          
                          <div className="space-y-2 text-sm mb-4">
                            <div className="flex items-center">
                              {user.accountType === 'office' ? (
                                <>
                                  <Building className="h-4 w-4 text-blue-500 mr-2" />
                                  <span className="text-muted-foreground mr-1">Tipo:</span>
                                  <Badge variant="default" className="bg-blue-500 hover:bg-blue-600 h-5">
                                    Oficina
                                  </Badge>
                                </>
                              ) : (
                                <>
                                  <User className="h-4 w-4 text-muted-foreground mr-2" />
                                  <span className="text-muted-foreground mr-1">Tipo:</span>
                                  <Badge variant="secondary" className="h-5">
                                    Individual
                                  </Badge>
                                </>
                              )}
                            </div>
                            <div className="flex items-start">
                              <Calendar className="h-4 w-4 text-muted-foreground mr-2 mt-0.5" />
                              <div className="flex flex-col">
                                <div>
                                  <span className="text-muted-foreground mr-1">Caduca:</span>
                                  {user.expiresAt ? (
                                    <span>{formatDate(new Date(user.expiresAt))}</span>
                                  ) : (
                                    <span className="text-muted-foreground">No establecido</span>
                                  )}
                                </div>
                                {user.expiresAt && user.isActive && (
                                  <div className="text-xs mt-0.5">
                                    {(() => {
                                      const now = new Date();
                                      const expiresAt = new Date(user.expiresAt);
                                      if (expiresAt < now) {
                                        return (
                                          <Badge variant="destructive" className="text-xs">
                                            Vencido
                                          </Badge>
                                        );
                                      }
                                      const timeRemainingMs = expiresAt.getTime() - now.getTime();
                                      const daysRemaining = Math.floor(timeRemainingMs / (1000 * 60 * 60 * 24));
                                      const hoursRemaining = Math.floor((timeRemainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                      
                                      if (daysRemaining === 0 && hoursRemaining < 24) {
                                        return (
                                          <Badge variant="destructive" className="text-xs">
                                            Vence en {hoursRemaining}h
                                          </Badge>
                                        );
                                      }
                                      return `Restante: ${daysRemaining}d ${hoursRemaining}h`;
                                    })()}
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center">
                              <Smartphone className="h-4 w-4 text-muted-foreground mr-2" />
                              <span className="text-muted-foreground mr-1">Dispositivos:</span>
                              <span>{user.deviceCount || 0} / {user.maxDevices || 3}</span>
                            </div>
                            
                            <div className="flex items-center">
                              <Clock className="h-4 w-4 text-muted-foreground mr-2" />
                              <span className="text-muted-foreground mr-1">Último login:</span>
                              <span>{user.lastLogin ? formatDate(new Date(user.lastLogin)) : 'Nunca'}</span>
                            </div>
                          </div>
                          
                          <div className="flex gap-2 pt-2 border-t">
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="flex-1"
                              onClick={() => handleOpenBankOptions(user)}
                              disabled={activateOneDayMutation.isPending || activateSevenDaysMutation.isPending}
                            >
                              <Building className="w-4 h-4 mr-1" /> Configurar bancos
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="flex-1"
                              onClick={() => handleGenerateLink(user)}
                              disabled={!user.isActive || generateLinkMutation.isPending}
                            >
                              <LinkIcon className="w-4 h-4 mr-1" /> Generar enlace
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="flex-1 ml-2"
                              onClick={() => handleOpenMessageDialog(user)}
                              disabled={!user.telegramChatId || sendTelegramMessageMutation.isPending}
                              title={!user.telegramChatId ? "Usuario sin Chat ID configurado" : "Enviar mensaje de Telegram"}
                            >
                              <MessageCircle className="w-4 h-4 mr-1" /> Mensaje
                            </Button>
                          </div>
                          <div className="flex gap-2 pt-2 border-t">
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="flex-1"
                              onClick={() => handleOpenPriceDialog(user)}
                              disabled={updateCustomPriceMutation.isPending}
                            >
                              <DollarSign className="w-4 h-4 mr-1" /> 
                              {user.customPrice 
                                ? `Precio: $${user.customPrice} (pers.)` 
                                : `Precio: $${user.accountType === 'office' ? '6000' : '3000'}`}
                            </Button>
                          </div>
                          <div className="mt-2 pt-2 border-t">
                            <Button 
                              variant={user.isActive ? "destructive" : "default"}
                              size="sm"
                              className="w-full mb-2"
                              onClick={() => handleToggleStatus(user.username)}
                              disabled={toggleUserStatusMutation.isPending}
                            >
                              {user.isActive ? 
                                <><ToggleRight className="w-4 h-4 mr-1" /> Desactivar usuario</> : 
                                <><ToggleLeft className="w-4 h-4 mr-1" /> Activar usuario</>
                              }
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              className="w-full"
                              onClick={() => handleDeleteUser(user.username)}
                              disabled={deleteUserMutation.isPending}
                            >
                              <Trash className="w-4 h-4 mr-1" /> Eliminar usuario
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </CardContent>
        <CardFooter className={`flex ${isMobile ? 'flex-col space-y-2' : 'justify-between'}`}>
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isLoading}
            className={isMobile ? 'w-full' : ''}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cargando...
              </>
            ) : (
              'Actualizar'
            )}
          </Button>
          <Button
            variant="secondary"
            onClick={handleCleanupExpiredUsers}
            disabled={cleanupExpiredUsersMutation.isPending}
            className={isMobile ? 'w-full' : ''}
          >
            {cleanupExpiredUsersMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Limpiando...
              </>
            ) : (
              'Limpiar usuarios expirados'
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* Dialog para configurar bancos permitidos */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar Bancos Permitidos</DialogTitle>
            <DialogDescription>
              {selectedUser && (
                <>
                  Selecciona los bancos a los que el usuario <strong>{selectedUser.username}</strong> tendrá acceso.
                  Puedes seleccionar hasta 3 bancos específicos o la opción "Todos".
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <div 
                  className={`cursor-pointer px-3 py-2 rounded-md flex items-center ${
                    bankOptions.includes('all') ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}
                  onClick={() => handleBankOptionChange('all')}
                >
                  <Building className="w-4 h-4 mr-2" />
                  <span>Todos los bancos</span>
                </div>
                {Object.values(BankType)
                  .filter(bank => bank !== BankType.ALL) // Excluir "all" ya que lo mostramos arriba
                  .map((bank) => (
                    <div 
                      key={bank}
                      className={`cursor-pointer px-3 py-2 rounded-md flex items-center ${
                        bankOptions.includes(bank) ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}
                      onClick={() => handleBankOptionChange(bank)}
                    >
                      <span className="capitalize">{bank}</span>
                    </div>
                  ))}
              </div>
            </div>
            
            <div className="bg-muted p-3 rounded-md">
              <h4 className="font-medium text-sm mb-2">Bancos seleccionados:</h4>
              <div className="text-sm">
                {bankOptions.includes('all') ? (
                  <p>Todos los bancos</p>
                ) : (
                  <p>{bankOptions.map(bank => (
                    <span key={bank} className="inline-block bg-primary/20 rounded px-2 py-1 mr-1 mb-1 capitalize">
                      {bank}
                    </span>
                  ))}</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              className="sm:w-auto w-full"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (selectedUser) {
                  setIsDialogOpen(false);
                  // Abrimos un diálogo para elegir la duración de la activación
                  const duration = window.confirm(
                    "¿Desea activar el usuario por 7 días?\n\nPresione OK para activar por 7 días o Cancelar para activar por 1 día."
                  );
                  
                  if (duration) {
                    handleActivateSevenDays(selectedUser.username);
                  } else {
                    handleActivateOneDay(selectedUser.username);
                  }
                }
              }}
              className="sm:w-auto w-full"
            >
              Activar Usuario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo para mostrar el enlace generado */}
      <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enlace Generado</DialogTitle>
            <DialogDescription>
              Se ha generado un nuevo enlace de cliente con el siguiente código.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex items-center justify-center">
              <span className="font-bold text-xl px-3 py-1 rounded-md bg-green-600/20 text-green-400">
                Código: <span className="text-2xl tracking-wider">{generatedCode}</span>
              </span>
            </div>
            
            <div className="bg-muted/30 p-4 rounded-md break-all">
              <p className="text-primary font-medium mb-2">Enlace del cliente:</p>
              <a 
                href={generatedLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline break-all"
              >
                {generatedLink}
              </a>
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsLinkDialogOpen(false)}
              className="sm:w-auto w-full"
            >
              Cerrar
            </Button>
            <Button
              type="button"
              onClick={copyGeneratedLink}
              className="sm:w-auto w-full"
            >
              <LinkIcon className="mr-2 h-4 w-4" />
              Copiar Enlace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo para enviar mensaje de Telegram */}
      <Dialog open={isMessageDialogOpen} onOpenChange={setIsMessageDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar Mensaje de Telegram</DialogTitle>
            <DialogDescription>
              Enviar un mensaje directo a <strong>{selectedUser?.username}</strong> vía Telegram
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="message">Mensaje</Label>
              <Textarea
                id="message"
                placeholder="Escribe tu mensaje aquí..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <div className="text-xs text-muted-foreground">
                Chat ID: {selectedUser?.telegramChatId || 'No configurado'}
              </div>
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsMessageDialogOpen(false)}
              className="sm:w-auto w-full"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSendMessage}
              disabled={!messageText.trim() || sendTelegramMessageMutation.isPending}
              className="sm:w-auto w-full"
            >
              {sendTelegramMessageMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Enviar Mensaje
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPriceDialogOpen} onOpenChange={setIsPriceDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar Precio Personalizado</DialogTitle>
            <DialogDescription>
              Establecer precio de suscripción personalizado para <strong>{selectedUser?.username}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="customPrice">Precio en MXN (dejar vacío para usar precio del sistema)</Label>
              <input
                id="customPrice"
                type="text"
                placeholder="Ej: 150.00"
                value={customPriceValue}
                onChange={(e) => setCustomPriceValue(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <div className="text-xs text-muted-foreground">
                Precio actual del sistema: Consultar en Configuración del Sistema
              </div>
              <div className="text-xs text-muted-foreground">
                {selectedUser?.customPrice 
                  ? `Precio personalizado actual: $${selectedUser.customPrice} MXN` 
                  : 'Sin precio personalizado (usa precio del sistema)'}
              </div>
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsPriceDialogOpen(false)}
              className="sm:w-auto w-full"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleUpdateCustomPrice}
              disabled={updateCustomPriceMutation.isPending}
              className="sm:w-auto w-full"
            >
              {updateCustomPriceMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <DollarSign className="mr-2 h-4 w-4" />
                  Guardar Precio
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RegisteredUsersManagement;