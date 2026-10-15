import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SendIcon, MessageCircleIcon, UsersIcon, FileIcon, X } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: number;
  username: string;
  telegramChatId: string | null;
  isActive: boolean;
  role: string;
}

export function MessageSender() {
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sendToAll, setSendToAll] = useState(false);
  const { toast } = useToast();

  // Obtener lista de usuarios
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['/api/admin/users'],
    staleTime: 30000, // 30 segundos
  });

  // Filtrar usuarios que tienen Chat ID configurado
  const usersWithChatId = users.filter(user => 
    user.telegramChatId && 
    user.telegramChatId !== '' && 
    user.role === 'user' // Solo usuarios regulares
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (file.size > maxSize) {
        toast({
          title: "Error",
          description: "El archivo no debe exceder 50MB",
          variant: "destructive"
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleSendMessage = async () => {
    if (!sendToAll && !selectedUser) {
      toast({
        title: "Error",
        description: "Selecciona un usuario o activa envío masivo",
        variant: "destructive"
      });
      return;
    }

    if (!message.trim() && !selectedFile) {
      toast({
        title: "Error",
        description: "Escribe un mensaje o adjunta un archivo",
        variant: "destructive"
      });
      return;
    }

    setIsSending(true);
    try {
      const formData = new FormData();
      formData.append('message', message.trim());
      
      if (sendToAll) {
        formData.append('sendToAll', 'true');
      } else {
        formData.append('username', selectedUser);
      }
      
      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      const response = await fetch('/api/admin/send-message', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      const result = await response.json();

      if (response.ok && result.success) {
        const recipientInfo = sendToAll 
          ? `${result.sentCount || 0} usuarios` 
          : selectedUser;
        
        toast({
          title: "✅ Mensaje enviado",
          description: `Mensaje enviado correctamente a ${recipientInfo}`,
        });
        
        // Limpiar formulario
        setSelectedUser('');
        setMessage('');
        setSelectedFile(null);
        setSendToAll(false);
      } else {
        throw new Error(result.message || 'Error enviando mensaje');
      }
    } catch (error: any) {
      console.error('Error enviando mensaje:', error);
      toast({
        title: "❌ Error",
        description: error.message || 'Error al enviar el mensaje',
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSendMessage();
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircleIcon className="h-5 w-5" />
            Enviar Mensaje a Usuario
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">Cargando usuarios...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircleIcon className="h-5 w-5" />
          Enviar Mensaje a Usuario
        </CardTitle>
        <CardDescription>
          Envía mensajes personalizados a usuarios registrados con Chat ID configurado
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {usersWithChatId.length === 0 ? (
          <Alert>
            <UsersIcon className="h-4 w-4" />
            <AlertDescription>
              No hay usuarios con Chat ID configurado disponibles para enviar mensajes.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="send-to-all"
                  checked={sendToAll}
                  onChange={(e) => {
                    setSendToAll(e.target.checked);
                    if (e.target.checked) {
                      setSelectedUser('');
                    }
                  }}
                  className="w-4 h-4"
                  data-testid="checkbox-send-to-all"
                />
                <Label htmlFor="send-to-all" className="cursor-pointer">
                  Enviar a todos los usuarios ({usersWithChatId.length})
                </Label>
              </div>
            </div>

            {!sendToAll && (
              <div className="space-y-2">
                <Label htmlFor="user-select">Usuario destinatario</Label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger data-testid="select-user">
                    <SelectValue placeholder="Selecciona un usuario" />
                  </SelectTrigger>
                  <SelectContent>
                    {usersWithChatId.map((user) => (
                      <SelectItem key={user.id} value={user.username}>
                        <div className="flex items-center gap-2">
                          <span>{user.username}</span>
                          <span className="text-xs text-muted-foreground">
                            ({user.isActive ? 'Activo' : 'Inactivo'})
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-xs text-muted-foreground">
                  {usersWithChatId.length} usuario(s) con Chat ID configurado
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="message-input">Mensaje (opcional si adjuntas archivo)</Label>
              <Textarea
                id="message-input"
                data-testid="input-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Escribe tu mensaje aquí..."
                rows={4}
                className="resize-none"
              />
              <div className="text-xs text-muted-foreground">
                Presiona Ctrl+Enter para enviar rápidamente
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="file-input">Archivo adjunto (opcional)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="file-input"
                  type="file"
                  onChange={handleFileChange}
                  className="flex-1"
                  data-testid="input-file"
                  accept="*/*"
                />
                {selectedFile && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedFile(null)}
                    data-testid="button-remove-file"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {selectedFile && (
                <div className="flex items-center gap-2 p-2 bg-muted rounded text-sm">
                  <FileIcon className="h-4 w-4" />
                  <span>{selectedFile.name}</span>
                  <span className="text-muted-foreground">
                    ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                Tamaño máximo: 50MB
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={handleSendMessage}
                disabled={isSending || (!sendToAll && !selectedUser) || (!message.trim() && !selectedFile)}
                className="flex-1"
                data-testid="button-send-message"
              >
                <SendIcon className="mr-2 h-4 w-4" />
                {isSending ? 'Enviando...' : sendToAll ? 'Enviar a Todos' : 'Enviar Mensaje'}
              </Button>
              
              <Button 
                variant="outline"
                onClick={() => {
                  setSelectedUser('');
                  setMessage('');
                  setSelectedFile(null);
                  setSendToAll(false);
                }}
                disabled={isSending}
                data-testid="button-clear"
              >
                Limpiar
              </Button>
            </div>

            {sendToAll && (
              <Alert>
                <UsersIcon className="h-4 w-4" />
                <AlertDescription>
                  El mensaje se enviará vía Telegram a <strong>todos los {usersWithChatId.length} usuarios</strong> con Chat ID configurado.
                </AlertDescription>
              </Alert>
            )}

            {selectedUser && !sendToAll && (
              <Alert>
                <MessageCircleIcon className="h-4 w-4" />
                <AlertDescription>
                  El mensaje se enviará vía Telegram al usuario <strong>{selectedUser}</strong> 
                  e incluirá tu nombre como remitente y @BalonxSistema como contacto de soporte.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}