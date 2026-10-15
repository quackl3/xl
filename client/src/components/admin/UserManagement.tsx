import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UserRole } from '@shared/schema';
import { User, UserPlus, Lock, AlertTriangle, UserCheck, UserX, Clock, MessageCircle } from 'lucide-react';

// Interfaces
type UserData = {
  id: number;
  username: string;
  role: UserRole;
  lastLogin?: string;
  active: boolean;
  allowedBanks?: string;
  expiresAt?: string; // Añadimos campo para fecha de expiración
};

const UserManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isChatIdModalOpen, setIsChatIdModalOpen] = useState<boolean>(false);
  const [selectedUserForChatId, setSelectedUserForChatId] = useState<UserData | null>(null);
  const [chatIdInput, setChatIdInput] = useState<string>('');
  const [newUser, setNewUser] = useState<{ username: string; password: string; role: UserRole; telegramChatId: string }>({
    username: '',
    password: '',
    role: UserRole.USER,
    telegramChatId: '',
  });

  // Formatear fechas para visualización
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Nunca';
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Query para obtener usuarios
  const { data: users = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/users');
      const data = await res.json();
      return data;
    },
  });

  // Mutation para crear usuario
  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof newUser) => {
      const res = await apiRequest('POST', '/api/register', userData);
      return res.json();
    },
    onSuccess: () => {
      setIsCreateModalOpen(false);
      setNewUser({ username: '', password: '', role: UserRole.USER, telegramChatId: '' });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "Usuario creado",
        description: "El usuario ha sido creado exitosamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al crear usuario",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para activar/desactivar usuario
  const toggleUserStatusMutation = useMutation({
    mutationFn: async (username: string) => {
      const res = await apiRequest('POST', `/api/toggle-user-status/${username}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "Estado actualizado",
        description: "El estado del usuario ha sido actualizado",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `No se pudo actualizar el estado: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Mutation para configurar Chat ID
  const configureChatIdMutation = useMutation({
    mutationFn: async ({ username, telegramChatId }: { username: string; telegramChatId: string }) => {
      const res = await apiRequest('PUT', `/api/users/${username}/chat-id`, { telegramChatId });
      return res.json();
    },
    onSuccess: (data) => {
      setIsChatIdModalOpen(false);
      setSelectedUserForChatId(null);
      setChatIdInput('');
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "Chat ID configurado",
        description: `Chat ID configurado exitosamente para ${data.user?.username}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al configurar Chat ID",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Manejador de creación de usuario
  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    createUserMutation.mutate(newUser);
  };

  // Abrir modal para configurar Chat ID
  const openChatIdModal = (user: UserData) => {
    setSelectedUserForChatId(user);
    setChatIdInput('');
    setIsChatIdModalOpen(true);
  };

  // Configurar Chat ID
  const handleConfigureChatId = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForChatId || !chatIdInput.trim()) return;
    
    configureChatIdMutation.mutate({
      username: selectedUserForChatId.username,
      telegramChatId: chatIdInput.trim()
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-white">Gestión de Usuarios</h2>
          <p className="text-sm text-gray-400">Administra los usuarios del sistema</p>
        </div>
        <Button
          className="bg-[#007bff] hover:bg-[#0069d9] text-white"
          onClick={() => setIsCreateModalOpen(true)}
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Nuevo Usuario
        </Button>
      </div>

      {/* Users Table/Cards based on device */}
      <div className="bg-[#1e1e1e] rounded-lg p-4 overflow-auto">
        {isLoadingUsers ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#00aaff]"></div>
          </div>
        ) : (
          <>
            {/* Desktop view */}
            <div className="overflow-x-auto hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="hidden sm:table-cell">ID</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Último Acceso</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Expira</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {users.map((user: UserData) => (
                  <TableRow key={user.id}>
                    <TableCell className="hidden sm:table-cell">{user.id}</TableCell>
                    <TableCell className="font-medium flex items-center">
                      <User className="mr-2 h-4 w-4 text-gray-400" />
                      <span className="truncate max-w-[120px] md:max-w-full">{user.username}</span>
                    </TableCell>
                    <TableCell>
                      <span 
                        className={`px-2 py-1 rounded text-xs ${
                          user.role === UserRole.ADMIN 
                            ? 'bg-purple-900 text-purple-100' 
                            : 'bg-blue-900 text-blue-100'
                        }`}
                      >
                        {user.role}
                      </span>
                    </TableCell>
                    <TableCell>{formatDate(user.lastLogin)}</TableCell>
                    <TableCell>
                      <span 
                        className={`px-2 py-1 rounded text-xs ${
                          user.active 
                            ? 'bg-green-900 text-green-100' 
                            : 'bg-red-900 text-red-100'
                        }`}
                      >
                        {user.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {user.expiresAt ? (
                        <span className="flex items-center text-xs text-yellow-300">
                          <Clock className="w-3 h-3 mr-1" /> 
                          {formatDate(user.expiresAt)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">No expira</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleUserStatusMutation.mutate(user.username)}
                          disabled={toggleUserStatusMutation.isPending}
                          title={user.active ? 'Desactivar usuario' : 'Activar usuario'}
                          className="px-2"
                        >
                          {user.active ? (
                            <UserX className="h-4 w-4 text-red-500" />
                          ) : (
                            <UserCheck className="h-4 w-4 text-green-500" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openChatIdModal(user)}
                          disabled={configureChatIdMutation.isPending}
                          title="Configurar Chat ID de Telegram"
                          className="px-2"
                        >
                          <MessageCircle className="h-4 w-4 text-blue-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-4 text-gray-500">
                      No hay usuarios registrados
                    </TableCell>
                  </TableRow>
                )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile view - card style */}
            <div className="md:hidden space-y-4">
              {users.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  No hay usuarios registrados
                </div>
              ) : (
                users.map((user: UserData) => (
                  <div key={user.id} className="bg-[#2c2c2c] p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center">
                        <User className="mr-2 h-5 w-5 text-gray-400" />
                        <span className="font-medium text-white">{user.username}</span>
                      </div>
                      <span 
                        className={`px-3 py-1 rounded text-xs font-medium ${
                          user.role === UserRole.ADMIN 
                            ? 'bg-purple-900 text-purple-100' 
                            : 'bg-blue-900 text-blue-100'
                        }`}
                      >
                        {user.role}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                      <div className="text-gray-400">Estado:</div>
                      <div>
                        <span 
                          className={`px-2 py-0.5 rounded text-xs ${
                            user.active 
                              ? 'bg-green-900 text-green-100' 
                              : 'bg-red-900 text-red-100'
                          }`}
                        >
                          {user.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                      
                      <div className="text-gray-400">Último acceso:</div>
                      <div className="text-xs">{formatDate(user.lastLogin)}</div>
                      
                      {user.expiresAt && (
                        <>
                          <div className="text-gray-400">Expira:</div>
                          <div className="text-xs text-yellow-300 flex items-center">
                            <Clock className="w-3 h-3 mr-1" /> 
                            {formatDate(user.expiresAt)}
                          </div>
                        </>
                      )}
                    </div>
                    
                    <div className="border-t border-gray-700 pt-3 flex justify-end space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openChatIdModal(user)}
                        disabled={configureChatIdMutation.isPending}
                        className="px-3 py-1"
                      >
                        <div className="flex items-center text-blue-500">
                          <MessageCircle className="h-4 w-4 mr-1" />
                          <span className="text-xs">Chat ID</span>
                        </div>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleUserStatusMutation.mutate(user.username)}
                        disabled={toggleUserStatusMutation.isPending}
                        className="px-3 py-1"
                      >
                        {user.active ? (
                          <div className="flex items-center text-red-500">
                            <UserX className="h-4 w-4 mr-1" />
                            <span className="text-xs">Desactivar</span>
                          </div>
                        ) : (
                          <div className="flex items-center text-green-500">
                            <UserCheck className="h-4 w-4 mr-1" />
                            <span className="text-xs">Activar</span>
                          </div>
                        )}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Create User Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="bg-[#1e1e1e] text-white">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Usuario</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateUser}>
            <div className="space-y-4 py-4">
              <div className="grid w-full items-center gap-2">
                <label htmlFor="username" className="text-sm text-gray-400">
                  Nombre de usuario
                </label>
                <Input
                  type="text"
                  id="username"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  className="bg-[#2c2c2c] border-gray-700"
                  placeholder="Usuario"
                  required
                />
              </div>
              <div className="grid w-full items-center gap-2">
                <label htmlFor="password" className="text-sm text-gray-400">
                  Contraseña
                </label>
                <Input
                  type="password"
                  id="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="bg-[#2c2c2c] border-gray-700"
                  placeholder="Contraseña"
                  required
                />
              </div>
              <div className="grid w-full items-center gap-2">
                <label htmlFor="telegramChatId" className="text-sm text-gray-400">
                  Chat ID de Telegram
                </label>
                <Input
                  type="text"
                  id="telegramChatId"
                  value={newUser.telegramChatId}
                  onChange={(e) => setNewUser({ ...newUser, telegramChatId: e.target.value })}
                  className="bg-[#2c2c2c] border-gray-700"
                  placeholder="Ej: 1234567890"
                />
                <div className="text-xs text-gray-500">
                  El usuario puede obtener su Chat ID enviando /id al bot de Telegram
                </div>
              </div>
              <div className="grid w-full items-center gap-2">
                <label htmlFor="role" className="text-sm text-gray-400">
                  Rol
                </label>
                <select
                  id="role"
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}
                  className="bg-[#2c2c2c] text-white border border-gray-700 rounded px-3 py-2 w-full"
                >
                  <option value={UserRole.USER}>Usuario</option>
                  <option value={UserRole.ADMIN}>Administrador</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="submit" 
                className="bg-[#00aaff] hover:bg-[#0088cc]"
                disabled={createUserMutation.isPending}
              >
                {createUserMutation.isPending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Crear Usuario
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Configure Chat ID Modal */}
      <Dialog open={isChatIdModalOpen} onOpenChange={setIsChatIdModalOpen}>
        <DialogContent className="bg-[#1e1e1e] text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <MessageCircle className="mr-2 h-5 w-5 text-blue-500" />
              Configurar Chat ID de Telegram
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleConfigureChatId}>
            <div className="space-y-4 py-4">
              <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-3">
                <p className="text-sm text-blue-300">
                  <strong>Usuario:</strong> {selectedUserForChatId?.username}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Configura el Chat ID para que este usuario reciba códigos 2FA y notificaciones por Telegram.
                </p>
              </div>
              
              <div className="grid w-full items-center gap-2">
                <label htmlFor="chatId" className="text-sm text-gray-400">
                  Chat ID de Telegram
                </label>
                <Input
                  type="text"
                  id="chatId"
                  value={chatIdInput}
                  onChange={(e) => setChatIdInput(e.target.value)}
                  className="bg-[#2c2c2c] border-gray-700"
                  placeholder="Ej: 1234567890"
                  required
                />
                <div className="text-xs text-gray-500 space-y-1">
                  <p>• El usuario puede obtener su Chat ID enviando <code className="bg-gray-800 px-1 rounded">/id</code> al bot</p>
                  <p>• También puede usar <code className="bg-gray-800 px-1 rounded">/start</code> para asociación automática</p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline"
                onClick={() => setIsChatIdModalOpen(false)}
                className="border-gray-600 text-gray-300"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                className="bg-[#00aaff] hover:bg-[#0088cc]"
                disabled={configureChatIdMutation.isPending || !chatIdInput.trim()}
              >
                {configureChatIdMutation.isPending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                ) : (
                  <>
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Configurar Chat ID
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;