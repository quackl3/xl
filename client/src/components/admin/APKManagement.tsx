import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Download, Upload, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: number;
  username: string;
  apkFileName?: string;
  apkFileUrl?: string;
  hasApk: boolean;
}

export function APKManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [uploadedAPK, setUploadedAPK] = useState<{fileName: string, fileUrl: string} | null>(null);
  const [loading, setLoading] = useState(false);
  const [userSearchFilter, setUserSearchFilter] = useState<string>('');
  const { toast } = useToast();

  // Cargar lista de usuarios al inicializar
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users-for-apk', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUsers(userData);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Verificar que sea un APK
    if (!file.name.toLowerCase().endsWith('.apk')) {
      toast({
        title: "Error",
        description: "El archivo debe ser un APK (.apk)",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      const formData = new FormData();
      formData.append('apkFile', file);

      const response = await fetch('/api/upload-apk', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      const result = await response.json();

      if (response.ok) {
        setUploadedAPK({
          fileName: result.fileName,
          fileUrl: result.fileUrl
        });
        
        toast({
          title: "Éxito",
          description: `APK ${result.fileName} subido correctamente (${result.fileSize})`
        });
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Error uploading APK:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al subir APK",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAssignAPK = async () => {
    if (!selectedUserId || !uploadedAPK) {
      toast({
        title: "Error",
        description: "Selecciona un usuario y sube un APK primero",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/assign-apk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: selectedUserId,
          apkFileName: uploadedAPK.fileName,
          apkFileUrl: uploadedAPK.fileUrl
        }),
        credentials: 'include'
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: "Éxito",
          description: result.message
        });

        // Limpiar formulario y recargar usuarios
        setSelectedUserId('');
        setUploadedAPK(null);
        fetchUsers();
        
        // Limpiar el input file
        const fileInput = document.getElementById('apk-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Error assigning APK:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al asignar APK",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAPK = async (userId: number, username: string) => {
    try {
      const response = await fetch('/api/assign-apk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId,
          apkFileName: null,
          apkFileUrl: null
        }),
        credentials: 'include'
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: "Éxito",
          description: `APK removido del usuario ${username}`
        });

        fetchUsers();
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Error removing APK:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al remover APK",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <Package className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Gestión de APKs</h1>
      </div>

      {/* Formulario para subir y asignar APK */}
      <Card>
        <CardHeader>
          <CardTitle>Subir y Asignar APK</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="apk-upload">Archivo APK</Label>
            <Input
              id="apk-upload"
              type="file"
              accept=".apk"
              onChange={handleFileUpload}
              disabled={loading}
            />
            {uploadedAPK && (
              <div className="mt-2 p-2 bg-green-50 border rounded-md">
                <div className="flex items-center space-x-2">
                  <Upload className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-700">
                    {uploadedAPK.fileName} subido correctamente
                  </span>
                </div>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="user-search">Buscar Usuario</Label>
            <Input
              id="user-search"
              type="text"
              placeholder="Escribe para buscar usuarios..."
              value={userSearchFilter}
              onChange={(e) => setUserSearchFilter(e.target.value)}
              disabled={loading}
              className="mb-2"
            />
            <Label htmlFor="user-select">Usuario</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId} disabled={loading}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar usuario" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px] overflow-y-auto">
                {users
                  .filter(user => 
                    user.username.toLowerCase().includes(userSearchFilter.toLowerCase())
                  )
                  .map((user) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.username} {user.hasApk && '(ya tiene APK)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-sm text-gray-500 mt-1">
              {users.filter(user => 
                user.username.toLowerCase().includes(userSearchFilter.toLowerCase())
              ).length} de {users.length} usuarios mostrados
            </div>
          </div>

          <Button 
            onClick={handleAssignAPK} 
            disabled={!selectedUserId || !uploadedAPK || loading}
            className="w-full"
          >
            {loading ? "Procesando..." : "Asignar APK al Usuario"}
          </Button>
        </CardContent>
      </Card>

      {/* Lista de usuarios con APKs asignados */}
      <Card>
        <CardHeader>
          <CardTitle>Usuarios con APKs Asignados</CardTitle>
        </CardHeader>
        <CardContent>
          {users.filter(user => user.hasApk).length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No hay usuarios con APKs asignados
            </div>
          ) : (
            <div className="space-y-2">
              {users.filter(user => user.hasApk).map((user) => (
                <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Package className="h-4 w-4 text-blue-600" />
                    <div>
                      <div className="font-medium">{user.username}</div>
                      <div className="text-sm text-gray-500">{user.apkFileName}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(user.apkFileUrl, '_blank')}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveAPK(user.id, user.username)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}