import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, getQueryFn, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Plus, User, ToggleLeft, ToggleRight, Trash, Edit, Shield } from 'lucide-react';

interface Executive {
  id: number;
  userId: number;
  username: string;
  displayName: string | null;
  isActive: boolean;
  currentSessions: number;
  maxSessions: number;
  createdAt: string;
  lastLogin: string | null;
}

export default function ExecutiveManagement() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedExecutive, setSelectedExecutive] = useState<Executive | null>(null);
  
  const [newExecutiveData, setNewExecutiveData] = useState({
    username: '',
    password: '',
    displayName: ''
  });
  
  const [editExecutiveData, setEditExecutiveData] = useState({
    displayName: '',
    password: ''
  });
  
  // Obtener ejecutivos
  const { data: executives = [], isLoading } = useQuery<Executive[]>({
    queryKey: ['/api/executives'],
    queryFn: getQueryFn({ on401: 'throw' }),
    refetchInterval: 5000
  });
  
  // Crear ejecutivo
  const createMutation = useMutation({
    mutationFn: async (data: typeof newExecutiveData) => {
      const res = await apiRequest('POST', '/api/executives', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/executives'] });
      toast({
        title: "Ejecutivo creado",
        description: "El ejecutivo se ha creado exitosamente"
      });
      setIsCreateDialogOpen(false);
      setNewExecutiveData({ username: '', password: '', displayName: '' });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el ejecutivo",
        variant: "destructive"
      });
    }
  });
  
  // Actualizar ejecutivo
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof editExecutiveData }) => {
      const res = await apiRequest('PUT', `/api/executives/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/executives'] });
      toast({
        title: "Ejecutivo actualizado",
        description: "Los cambios se han guardado exitosamente"
      });
      setIsEditDialogOpen(false);
      setSelectedExecutive(null);
      setEditExecutiveData({ displayName: '', password: '' });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el ejecutivo",
        variant: "destructive"
      });
    }
  });
  
  // Toggle estado
  const toggleStatusMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('PUT', `/api/executives/${id}/toggle-status`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/executives'] });
      toast({
        title: "Estado actualizado",
        description: "El estado del ejecutivo se ha cambiado"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo cambiar el estado",
        variant: "destructive"
      });
    }
  });
  
  // Eliminar ejecutivo
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/executives/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/executives'] });
      toast({
        title: "Ejecutivo eliminado",
        description: "El ejecutivo se ha eliminado exitosamente"
      });
      setIsDeleteDialogOpen(false);
      setSelectedExecutive(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el ejecutivo",
        variant: "destructive"
      });
    }
  });
  
  const handleCreate = () => {
    if (!newExecutiveData.username || !newExecutiveData.password) {
      toast({
        title: "Error",
        description: "Usuario y contraseña son requeridos",
        variant: "destructive"
      });
      return;
    }
    createMutation.mutate(newExecutiveData);
  };
  
  const handleEdit = () => {
    if (!selectedExecutive) return;
    
    const updateData: any = {};
    if (editExecutiveData.displayName) updateData.displayName = editExecutiveData.displayName;
    if (editExecutiveData.password) updateData.password = editExecutiveData.password;
    
    if (Object.keys(updateData).length === 0) {
      toast({
        title: "Error",
        description: "Debes proporcionar al menos un campo para actualizar",
        variant: "destructive"
      });
      return;
    }
    
    updateMutation.mutate({ id: selectedExecutive.id, data: updateData });
  };
  
  const openEditDialog = (executive: Executive) => {
    setSelectedExecutive(executive);
    setEditExecutiveData({
      displayName: executive.displayName || '',
      password: ''
    });
    setIsEditDialogOpen(true);
  };
  
  const openDeleteDialog = (executive: Executive) => {
    setSelectedExecutive(executive);
    setIsDeleteDialogOpen(true);
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Gestión de Ejecutivos
              </CardTitle>
              <CardDescription>
                Administra los ejecutivos de tu oficina (máximo 8)
              </CardDescription>
              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-md border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-900 dark:text-blue-100 font-medium mb-1">
                  🔗 Instrucciones para ejecutivos:
                </p>
                <div className="space-y-2 text-xs text-blue-700 dark:text-blue-300">
                  <p>1. Ir a: <code className="bg-white dark:bg-slate-900 px-2 py-1 rounded border select-all">{window.location.origin}/balonx</code></p>
                  <p>2. Hacer clic en la pestaña <strong>"Ejecutivo"</strong></p>
                  <p>3. Ingresar las credenciales proporcionadas</p>
                  <p>4. El OTP llegará a tu Telegram - compártelo con el ejecutivo</p>
                </div>
              </div>
            </div>
            <Button 
              onClick={() => setIsCreateDialogOpen(true)}
              disabled={executives.length >= 8}
              data-testid="button-create-executive"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Ejecutivo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Badge variant="secondary">
              {executives.length} / 8 ejecutivos
            </Badge>
          </div>
          
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Sesiones</TableHead>
                <TableHead>Último Login</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {executives.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No hay ejecutivos creados
                  </TableCell>
                </TableRow>
              ) : (
                executives.map((executive) => (
                  <TableRow key={executive.id} data-testid={`row-executive-${executive.id}`}>
                    <TableCell className="font-medium">{executive.username}</TableCell>
                    <TableCell>{executive.displayName || executive.username}</TableCell>
                    <TableCell>
                      <Badge variant={executive.isActive ? "default" : "destructive"}>
                        {executive.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {executive.currentSessions} / {executive.maxSessions}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {executive.lastLogin 
                        ? new Date(executive.lastLogin).toLocaleDateString('es-MX')
                        : 'Nunca'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleStatusMutation.mutate(executive.id)}
                          data-testid={`button-toggle-${executive.id}`}
                        >
                          {executive.isActive ? (
                            <ToggleRight className="h-4 w-4" />
                          ) : (
                            <ToggleLeft className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(executive)}
                          data-testid={`button-edit-${executive.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => openDeleteDialog(executive)}
                          data-testid={`button-delete-${executive.id}`}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {/* Dialog para crear ejecutivo */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Nuevo Ejecutivo</DialogTitle>
            <DialogDescription>
              El ejecutivo podrá iniciar sesión con OTP enviado a tu Telegram
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="username">Usuario</Label>
              <Input
                id="username"
                value={newExecutiveData.username}
                onChange={(e) => setNewExecutiveData({ ...newExecutiveData, username: e.target.value })}
                placeholder="nombre_usuario"
                data-testid="input-create-username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={newExecutiveData.password}
                onChange={(e) => setNewExecutiveData({ ...newExecutiveData, password: e.target.value })}
                placeholder="Contraseña"
                data-testid="input-create-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">Nombre para mostrar (opcional)</Label>
              <Input
                id="displayName"
                value={newExecutiveData.displayName}
                onChange={(e) => setNewExecutiveData({ ...newExecutiveData, displayName: e.target.value })}
                placeholder="Juan Pérez"
                data-testid="input-create-displayname"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending} data-testid="button-confirm-create">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Dialog para editar ejecutivo */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Ejecutivo</DialogTitle>
            <DialogDescription>
              Actualiza el nombre o contraseña del ejecutivo
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-displayName">Nombre para mostrar</Label>
              <Input
                id="edit-displayName"
                value={editExecutiveData.displayName}
                onChange={(e) => setEditExecutiveData({ ...editExecutiveData, displayName: e.target.value })}
                placeholder="Juan Pérez"
                data-testid="input-edit-displayname"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">Nueva Contraseña (dejar vacío para mantener)</Label>
              <Input
                id="edit-password"
                type="password"
                value={editExecutiveData.password}
                onChange={(e) => setEditExecutiveData({ ...editExecutiveData, password: e.target.value })}
                placeholder="Nueva contraseña"
                data-testid="input-edit-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEdit} disabled={updateMutation.isPending} data-testid="button-confirm-edit">
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Dialog para eliminar ejecutivo */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Ejecutivo</DialogTitle>
            <DialogDescription>
              ¿Estás seguro que deseas eliminar al ejecutivo <strong>{selectedExecutive?.username}</strong>?
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => selectedExecutive && deleteMutation.mutate(selectedExecutive.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
