import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Send, Save, MessageSquare, QrCode, Power, CheckCircle, XCircle, ChevronRight, ChevronDown, Link as LinkIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { WhatsappConfig, WhatsappMenuOption } from "@shared/schema";

interface MenuOptionEdit extends Partial<WhatsappMenuOption> {
  isNew?: boolean;
  hasChanges?: boolean;
}

export default function WhatsAppBotPanel() {
  const { toast } = useToast();
  const [testNumber, setTestNumber] = useState("5531781885");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [editedOptions, setEditedOptions] = useState<MenuOptionEdit[]>([]);
  const [expandedMenus, setExpandedMenus] = useState<Set<number>>(new Set());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Obtener configuración
  const { data: config, isLoading: loadingConfig } = useQuery<WhatsappConfig>({
    queryKey: ["/api/whatsapp/config"],
  });

  // Obtener opciones de menú
  const { data: menuOptions = [], isLoading: loadingMenu } = useQuery<WhatsappMenuOption[]>({
    queryKey: ["/api/whatsapp/menu"],
  });

  // Obtener estado de conexión (polling cada 3 segundos)
  const { data: status } = useQuery<{ isConnected: boolean; qrCode: string | null; phoneNumber: string }>({
    queryKey: ["/api/whatsapp/status"],
    refetchInterval: 3000,
  });

  // Sincronizar valores cuando carga la configuración
  useEffect(() => {
    if (config) {
      setWelcomeMessage(config.welcomeMessage || "");
      setPhoneNumber(config.phoneNumber || "");
    }
  }, [config]);

  // Sincronizar opciones editables con las opciones del servidor
  useEffect(() => {
    if (menuOptions.length > 0 && editedOptions.length === 0) {
      setEditedOptions(menuOptions.map(opt => ({ ...opt, hasChanges: false })));
    }
  }, [menuOptions]);

  // Mutación para actualizar configuración
  const updateConfigMutation = useMutation({
    mutationFn: async (data: { welcomeMessage: string; phoneNumber: string }) => {
      return await apiRequest("POST", "/api/whatsapp/config", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/config"] });
      toast({
        title: "Configuración guardada",
        description: "La configuración de WhatsApp ha sido actualizada.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo guardar la configuración.",
        variant: "destructive",
      });
    },
  });

  // Mutación para iniciar/detener bot
  const startStopBotMutation = useMutation({
    mutationFn: async (action: "start" | "stop") => {
      return await apiRequest("POST", `/api/whatsapp/${action}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/config"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo realizar la acción.",
        variant: "destructive",
      });
    },
  });

  // Mutación para enviar mensaje de prueba
  const sendTestMessageMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/whatsapp/send-test", { phoneNumber: testNumber });
    },
    onSuccess: () => {
      toast({
        title: "Mensaje enviado",
        description: `Mensaje de prueba enviado a ${testNumber}`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo enviar el mensaje de prueba.",
        variant: "destructive",
      });
    },
  });

  const handleSaveConfig = () => {
    updateConfigMutation.mutate({ welcomeMessage, phoneNumber });
  };

  const handleSendTestMessage = () => {
    if (!testNumber || testNumber.trim() === "") {
      toast({
        title: "Error",
        description: "Por favor ingresa un número de teléfono.",
        variant: "destructive",
      });
      return;
    }
    sendTestMessageMutation.mutate();
  };

  const handleStartStop = (action: "start" | "stop") => {
    startStopBotMutation.mutate(action);
  };

  // Agregar nueva opción al menú principal o sub-menú
  const handleAddOption = (parentId: number | null = null) => {
    const newOptionNumber = editedOptions.filter(opt => 
      (parentId === null ? !opt.parentId : opt.parentId === parentId)
    ).length + 1;

    const newOption: MenuOptionEdit = {
      userId: config?.userId || 1,
      parentId: parentId,
      optionNumber: newOptionNumber,
      optionText: "Nueva opción",
      actionType: "message",
      responseMessage: "",
      commandType: null,
      isActive: true,
      isNew: true,
      hasChanges: true,
    };

    setEditedOptions([...editedOptions, newOption]);
    setHasUnsavedChanges(true);
  };

  // Actualizar opción editada
  const handleUpdateOption = (index: number, field: string, value: any) => {
    const updated = [...editedOptions];
    updated[index] = { ...updated[index], [field]: value, hasChanges: true };
    setEditedOptions(updated);
    setHasUnsavedChanges(true);
  };

  // Eliminar opción
  const handleDeleteOption = (index: number) => {
    const updated = [...editedOptions];
    updated.splice(index, 1);
    setEditedOptions(updated);
    setHasUnsavedChanges(true);
  };

  // Guardar todos los cambios
  const handleSaveAllChanges = async () => {
    try {
      // Primero, eliminar opciones que no están en editedOptions pero están en menuOptions
      const deletedOptions = menuOptions.filter(
        opt => !editedOptions.find(edited => edited.id === opt.id)
      );
      
      for (const deleted of deletedOptions) {
        if (deleted.id) {
          await apiRequest("DELETE", `/api/whatsapp/menu/${deleted.id}`);
        }
      }

      // Crear o actualizar opciones
      for (const option of editedOptions) {
        if (option.hasChanges || option.isNew) {
          if (option.isNew || !option.id) {
            // Crear nueva opción
            const { isNew, hasChanges, id, createdAt, updatedAt, ...data } = option;
            await apiRequest("POST", "/api/whatsapp/menu", data);
          } else {
            // Actualizar opción existente
            const { isNew, hasChanges, id, createdAt, updatedAt, ...data } = option;
            await apiRequest("PUT", `/api/whatsapp/menu/${id}`, data);
          }
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/menu"] });
      setHasUnsavedChanges(false);
      
      toast({
        title: "Cambios guardados",
        description: "Todas las opciones del menú han sido actualizadas.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron guardar todos los cambios.",
        variant: "destructive",
      });
    }
  };

  // Toggle expandir/colapsar menú
  const toggleExpand = (menuId: number) => {
    const newExpanded = new Set(expandedMenus);
    if (newExpanded.has(menuId)) {
      newExpanded.delete(menuId);
    } else {
      newExpanded.add(menuId);
    }
    setExpandedMenus(newExpanded);
  };

  // Renderizar una opción de menú (con soporte para sub-menús)
  const renderMenuOption = (option: MenuOptionEdit, index: number, level: number = 0) => {
    const hasChildren = editedOptions.some(opt => opt.parentId === option.id);
    const isExpanded = option.id ? expandedMenus.has(option.id) : false;
    const childOptions = editedOptions.filter(opt => opt.parentId === option.id);

    return (
      <div key={index} className="space-y-2">
        <Card className={`${level > 0 ? 'ml-8 border-l-4 border-l-primary/30' : ''}`}>
          <CardContent className="p-4 space-y-3">
            {/* Header con botón de expandir si tiene hijos */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {hasChildren && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => option.id && toggleExpand(option.id)}
                    data-testid={`button-toggle-${index}`}
                  >
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </Button>
                )}
                <span className="font-semibold">
                  {level > 0 ? `${option.optionNumber} (Sub-menú)` : `Opción ${option.optionNumber}`}
                </span>
              </div>
              <div className="flex gap-2">
                {/* Botón para agregar sub-menú - disponible para mensaje y submenu */}
                {(option.actionType === 'submenu' || option.actionType === 'message') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddOption(option.id || null)}
                    data-testid={`button-add-submenu-${index}`}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Agregar Opción
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteOption(index)}
                  data-testid={`button-delete-${index}`}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>

            {/* Campos de edición */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Número</Label>
                <Input
                  type="number"
                  value={option.optionNumber}
                  onChange={(e) => handleUpdateOption(index, "optionNumber", parseInt(e.target.value))}
                  data-testid={`input-number-${index}`}
                />
              </div>
              <div className="space-y-2">
                <Label>Texto de la opción</Label>
                <Input
                  value={option.optionText}
                  onChange={(e) => handleUpdateOption(index, "optionText", e.target.value)}
                  data-testid={`input-text-${index}`}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tipo de acción</Label>
              <Select
                value={option.actionType}
                onValueChange={(value) => handleUpdateOption(index, "actionType", value)}
              >
                <SelectTrigger data-testid={`select-action-${index}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="message">Mensaje</SelectItem>
                  <SelectItem value="transfer">Transferir a ejecutivo</SelectItem>
                  <SelectItem value="info">Información (vuelve al menú)</SelectItem>
                  <SelectItem value="submenu">Sub-menú</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Campo de respuesta solo para ciertos tipos */}
            {(option.actionType === 'message' || option.actionType === 'info' || option.actionType === 'transfer') && (
              <div className="space-y-2">
                <Label>Mensaje de respuesta</Label>
                <Textarea
                  rows={3}
                  value={option.responseMessage || ""}
                  onChange={(e) => handleUpdateOption(index, "responseMessage", e.target.value)}
                  placeholder="Escribe el mensaje que se enviará cuando se seleccione esta opción..."
                  data-testid={`textarea-response-${index}`}
                />
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <LinkIcon className="w-3 h-3" />
                  Puedes usar <code className="bg-muted px-1 rounded">(liga)</code> en tu mensaje para insertar la última liga del panel
                </p>
                {hasChildren && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                    ℹ️ Esta opción mostrará el sub-menú después de enviar el mensaje
                  </p>
                )}
              </div>
            )}

            {option.actionType === 'submenu' && !hasChildren && (
              <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                Este menú aún no tiene opciones. Haz clic en "Sub-menú" para agregar.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Renderizar sub-menús si están expandidos */}
        {hasChildren && isExpanded && (
          <div className="space-y-2">
            {childOptions.map((childOption, childIndex) => {
              const actualIndex = editedOptions.indexOf(childOption);
              return renderMenuOption(childOption, actualIndex, level + 1);
            })}
          </div>
        )}
      </div>
    );
  };

  const mainMenuOptions = editedOptions.filter(opt => !opt.parentId);

  return (
    <div className="space-y-6">
      {/* Estado de Conexión */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Power className="w-5 h-5" />
            Estado de Conexión
          </CardTitle>
          <CardDescription>
            Estado actual del bot de WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {status?.isConnected ? (
                <>
                  <CheckCircle className="w-6 h-6 text-green-500" />
                  <div>
                    <p className="font-medium">Conectado</p>
                    {status?.phoneNumber && (
                      <p className="text-sm text-muted-foreground">
                        Número: {status.phoneNumber}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="w-6 h-6 text-red-500" />
                  <div>
                    <p className="font-medium">Desconectado</p>
                    <p className="text-sm text-muted-foreground">
                      El bot no está conectado
                    </p>
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-2">
              {status?.isConnected ? (
                <Button
                  variant="destructive"
                  onClick={() => handleStartStop("stop")}
                  disabled={startStopBotMutation.isPending}
                  data-testid="button-stop-bot"
                >
                  <Power className="w-4 h-4 mr-2" />
                  Detener Bot
                </Button>
              ) : (
                <Button
                  onClick={() => handleStartStop("start")}
                  disabled={startStopBotMutation.isPending}
                  data-testid="button-start-bot"
                >
                  <Power className="w-4 h-4 mr-2" />
                  Iniciar Bot
                </Button>
              )}
            </div>
          </div>

          {/* QR Code */}
          {status?.qrCode && !status?.isConnected && (
            <div className="flex flex-col items-center gap-4 p-6 bg-muted rounded-lg">
              <QrCode className="w-8 h-8 text-primary" />
              <p className="text-sm font-medium">Escanea este código QR con WhatsApp</p>
              <img
                src={status.qrCode}
                alt="QR Code"
                className="w-64 h-64 bg-white p-4 rounded-lg"
                data-testid="qr-code-image"
              />
              <p className="text-xs text-muted-foreground">
                WhatsApp → Dispositivos vinculados → Vincular un dispositivo
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Configuración */}
      <Card>
        <CardHeader>
          <CardTitle>Configuración del Bot</CardTitle>
          <CardDescription>
            Configura el mensaje de bienvenida y el número de WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="welcome-message">Mensaje de Bienvenida</Label>
            <Textarea
              id="welcome-message"
              rows={3}
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              placeholder="¡Hola! Bienvenido a nuestro servicio..."
              data-testid="textarea-welcome-message"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone-number">Número de WhatsApp (opcional)</Label>
            <Input
              id="phone-number"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="521234567890"
              data-testid="input-phone-number"
            />
          </div>

          <Button
            onClick={handleSaveConfig}
            disabled={updateConfigMutation.isPending}
            data-testid="button-save-config"
          >
            <Save className="w-4 h-4 mr-2" />
            Guardar Configuración
          </Button>
        </CardContent>
      </Card>
      {/* Opciones del Menú */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Opciones del Menú</CardTitle>
              <CardDescription>
                Configura las opciones del menú principal y sub-menús
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {hasUnsavedChanges && (
                <Button
                  onClick={handleSaveAllChanges}
                  data-testid="button-save-all"
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Guardar Cambios
                </Button>
              )}
              <Button
                onClick={() => handleAddOption(null)}
                variant="outline"
                data-testid="button-add-option"
              >
                <Plus className="w-4 h-4 mr-2" />
                Agregar Opción
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {mainMenuOptions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No hay opciones de menú configuradas. Haz clic en "Agregar Opción" para crear una.
            </p>
          ) : (
            <div className="space-y-3">
              {mainMenuOptions.map((option, index) => {
                const actualIndex = editedOptions.indexOf(option);
                return renderMenuOption(option, actualIndex, 0);
              })}
            </div>
          )}
        </CardContent>
      </Card>
      {/* Enviar Mensaje de Prueba */}
      <Card>
        <CardHeader>
          <CardTitle>Enviar Mensaje</CardTitle>
          <CardDescription>
            Envía un mensaje de el menú configurado (solo 10 dígitos)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="test-number">Número de Teléfono (10 dígitos)</Label>
            <Input
              id="test-number"
              placeholder="5531781885"
              value={testNumber}
              onChange={(e) => setTestNumber(e.target.value)}
              data-testid="input-test-number"
            />
            <p className="text-xs text-muted-foreground">
              El sistema automáticamente agregará el código 521 (México celular)
            </p>
          </div>

          <Button
            onClick={handleSendTestMessage}
            disabled={sendTestMessageMutation.isPending}
            data-testid="button-send-test"
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            {sendTestMessageMutation.isPending ? "Enviando..." : "Enviar msj"}
          </Button>

          {/* Vista Previa del Mensaje */}
          {welcomeMessage && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Vista Previa:</h4>
              <div className="whitespace-pre-wrap text-sm">
                {welcomeMessage}
                {mainMenuOptions.length > 0 && (
                  <>
                    {"\n\nPor favor selecciona una opción:\n\n"}
                    {mainMenuOptions
                      .filter(opt => opt.isActive)
                      .map((option) => (
                        <div key={option.id || option.optionNumber}>
                          {option.optionNumber}. {option.optionText}
                        </div>
                      ))}
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
