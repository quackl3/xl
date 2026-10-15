import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Send, Save, MessageSquare, QrCode, Power, CheckCircle, XCircle, ChevronRight, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { WhatsappConfig, WhatsappMenuOption } from "@shared/schema";

interface MenuOptionEdit extends Partial<WhatsappMenuOption> {
  isNew?: boolean;
  hasChanges?: boolean;
}

export default function UserWhatsAppPanel() {
  const { toast } = useToast();
  const [testNumber, setTestNumber] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [editedOptions, setEditedOptions] = useState<MenuOptionEdit[]>([]);
  const [expandedMenus, setExpandedMenus] = useState<Set<number>>(new Set());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const { data: config, isLoading: loadingConfig } = useQuery<WhatsappConfig>({
    queryKey: ["/api/whatsapp/config"],
  });

  const { data: menuOptions = [], isLoading: loadingMenu } = useQuery<WhatsappMenuOption[]>({
    queryKey: ["/api/whatsapp/menu"],
  });

  const { data: status } = useQuery<{ isConnected: boolean; qrCode: string | null; phoneNumber: string }>({
    queryKey: ["/api/whatsapp/status"],
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (config) {
      setWelcomeMessage(config.welcomeMessage || "");
      setPhoneNumber(config.phoneNumber || "");
    }
  }, [config]);

  useEffect(() => {
    if (menuOptions.length > 0 && editedOptions.length === 0) {
      setEditedOptions(menuOptions.map(opt => ({ ...opt, hasChanges: false })));
    }
  }, [menuOptions]);

  const updateConfigMutation = useMutation({
    mutationFn: async (data: { welcomeMessage: string; phoneNumber: string }) => {
      return await apiRequest("POST", "/api/whatsapp/config", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/config"] });
      toast({
        title: "Configuración guardada",
        description: "Tu configuración de WhatsApp ha sido actualizada.",
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

  const createOptionMutation = useMutation({
    mutationFn: async (option: any) => {
      return await apiRequest("POST", "/api/whatsapp/menu", option);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/menu"] });
      toast({ title: "Opción creada", description: "La opción ha sido agregada al menú." });
      setHasUnsavedChanges(false);
      setEditedOptions([]);
    },
  });

  const updateOptionMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      return await apiRequest("PUT", `/api/whatsapp/menu/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/menu"] });
      toast({ title: "Opción actualizada", description: "Los cambios han sido guardados." });
      setHasUnsavedChanges(false);
      setEditedOptions([]);
    },
  });

  const deleteOptionMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/whatsapp/menu/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/menu"] });
      toast({ title: "Opción eliminada", description: "La opción ha sido eliminada." });
      setHasUnsavedChanges(false);
      setEditedOptions([]);
    },
  });

  const handleSaveConfig = () => {
    updateConfigMutation.mutate({ welcomeMessage, phoneNumber });
  };

  const handleSendTestMessage = () => {
    if (!testNumber || testNumber.trim() === "") {
      toast({ title: "Error", description: "Ingresa un número de teléfono válido.", variant: "destructive" });
      return;
    }
    sendTestMessageMutation.mutate();
  };

  const toggleMenu = (optionId: number) => {
    setExpandedMenus(prev => {
      const newSet = new Set(prev);
      if (newSet.has(optionId)) {
        newSet.delete(optionId);
      } else {
        newSet.add(optionId);
      }
      return newSet;
    });
  };

  const handleAddOption = (parentId: number | null = null) => {
    const newOption: MenuOptionEdit = {
      isNew: true,
      hasChanges: true,
      parentId: parentId,
      optionNumber: parentId ? 0 : (editedOptions.filter(o => !o.parentId).length + 1),
      optionText: '',
      actionType: 'message',
      responseMessage: '',
    };
    setEditedOptions([...editedOptions, newOption]);
    setHasUnsavedChanges(true);
  };

  const handleOptionChange = (index: number, field: keyof MenuOptionEdit, value: any) => {
    const updated = [...editedOptions];
    updated[index] = { ...updated[index], [field]: value, hasChanges: true };
    setEditedOptions(updated);
    setHasUnsavedChanges(true);
  };

  const handleDeleteOption = (index: number) => {
    const option = editedOptions[index];
    if (option.isNew) {
      setEditedOptions(editedOptions.filter((_, i) => i !== index));
      setHasUnsavedChanges(editedOptions.length > 1);
    } else if (option.id) {
      deleteOptionMutation.mutate(option.id);
    }
  };

  const handleSaveAllChanges = async () => {
    for (const option of editedOptions) {
      if (option.hasChanges) {
        if (option.isNew) {
          await createOptionMutation.mutateAsync({
            parentId: option.parentId,
            optionNumber: option.optionNumber,
            optionText: option.optionText,
            actionType: option.actionType,
            responseMessage: option.responseMessage,
          });
        } else if (option.id) {
          await updateOptionMutation.mutateAsync({
            id: option.id,
            parentId: option.parentId,
            optionNumber: option.optionNumber,
            optionText: option.optionText,
            actionType: option.actionType,
            responseMessage: option.responseMessage,
          });
        }
      }
    }
  };

  const renderMenuOption = (option: MenuOptionEdit, index: number, depth: number = 0) => {
    const children = editedOptions.filter(o => o.parentId === option.id);
    const hasChildren = children.length > 0;
    const isExpanded = option.id ? expandedMenus.has(option.id) : false;

    return (
      <div key={option.id || `new-${index}`} className="mb-3">
        <div className="border rounded-lg p-4 bg-white" style={{ marginLeft: `${depth * 20}px` }}>
          <div className="flex items-center gap-2 mb-3">
            {hasChildren && option.id && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleMenu(option.id!)}
                className="p-0 h-6 w-6"
                data-testid={`button-toggle-submenu-${option.id}`}
              >
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            )}
            <span className="font-semibold">Opción {option.optionNumber}</span>
            {option.hasChanges && <Badge variant="outline" className="text-xs">Sin guardar</Badge>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Número</Label>
              <Input
                value={option.optionNumber || ''}
                onChange={(e) => handleOptionChange(index, 'optionNumber', e.target.value)}
                placeholder="1"
                data-testid={`input-option-number-${index}`}
              />
            </div>
            <div>
              <Label>Tipo de Acción</Label>
              <Select
                value={option.actionType || 'message'}
                onValueChange={(value) => handleOptionChange(index, 'actionType', value)}
              >
                <SelectTrigger data-testid={`select-action-type-${index}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="message">Mensaje</SelectItem>
                  <SelectItem value="transfer">Transferir</SelectItem>
                  <SelectItem value="info">Información</SelectItem>
                  <SelectItem value="submenu">Submenú</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-3">
            <Label>Texto de Opción</Label>
            <Input
              value={option.optionText || ''}
              onChange={(e) => handleOptionChange(index, 'optionText', e.target.value)}
              placeholder="¿Cómo puedo ayudarte?"
              data-testid={`input-option-text-${index}`}
            />
          </div>

          {(option.actionType === 'message' || option.actionType === 'info') && (
            <div className="mt-3">
              <Label>Respuesta</Label>
              <Textarea
                value={option.responseMessage || ''}
                onChange={(e) => handleOptionChange(index, 'responseMessage', e.target.value)}
                placeholder="Usa (liga) para insertar el enlace del panel y (banco) para el nombre del banco"
                rows={3}
                data-testid={`textarea-response-${index}`}
              />
            </div>
          )}

          <div className="flex gap-2 mt-3">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleDeleteOption(index)}
              data-testid={`button-delete-option-${index}`}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Eliminar
            </Button>
            {option.actionType !== 'transfer' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAddOption(option.id || null)}
                data-testid={`button-add-suboption-${index}`}
              >
                <Plus className="h-4 w-4 mr-1" />
                Agregar subopción
              </Button>
            )}
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="mt-2">
            {children.map((child, childIndex) => {
              const childGlobalIndex = editedOptions.findIndex(o => o === child);
              return renderMenuOption(child, childGlobalIndex, depth + 1);
            })}
          </div>
        )}
      </div>
    );
  };

  if (loadingConfig || loadingMenu) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p>Cargando configuración...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Alert>
        <MessageSquare className="h-4 w-4" />
        <AlertDescription>
          Configura tu propio bot de WhatsApp para automatizar respuestas a tus clientes. 
          El bot puede enviar enlaces de panel y nombres de bancos automáticamente.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Power className="h-5 w-5" />
              Estado de Conexión
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span>Estado:</span>
              {status?.isConnected ? (
                <Badge className="bg-green-600">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Conectado
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <XCircle className="h-3 w-3 mr-1" />
                  Desconectado
                </Badge>
              )}
            </div>

            {status?.isConnected && status?.phoneNumber && (
              <div>
                <Label>Número conectado:</Label>
                <p className="text-sm font-mono bg-gray-100 p-2 rounded mt-1">
                  {status.phoneNumber}
                </p>
              </div>
            )}

            {!status?.isConnected && status?.qrCode && (
              <div>
                <Label>Escanea este código QR con WhatsApp:</Label>
                <div className="bg-white p-4 rounded-lg border mt-2">
                  <img 
                    src={status.qrCode} 
                    alt="QR Code" 
                    className="mx-auto"
                    data-testid="img-qr-code"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={() => startStopBotMutation.mutate("start")}
                disabled={status?.isConnected || startStopBotMutation.isPending}
                className="flex-1"
                data-testid="button-start-bot"
              >
                <Power className="h-4 w-4 mr-2" />
                Iniciar Bot
              </Button>
              <Button
                onClick={() => startStopBotMutation.mutate("stop")}
                disabled={!status?.isConnected || startStopBotMutation.isPending}
                variant="destructive"
                className="flex-1"
                data-testid="button-stop-bot"
              >
                <Power className="h-4 w-4 mr-2" />
                Detener Bot
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Configuración del Bot
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Número de WhatsApp (10 dígitos)</Label>
              <Input
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="5531781885"
                data-testid="input-phone-number"
              />
            </div>

            <div>
              <Label>Mensaje de Bienvenida</Label>
              <Textarea
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                placeholder="Hola! Bienvenido..."
                rows={4}
                data-testid="textarea-welcome-message"
              />
            </div>

            <Button
              onClick={handleSaveConfig}
              disabled={updateConfigMutation.isPending}
              className="w-full"
              data-testid="button-save-config"
            >
              <Save className="h-4 w-4 mr-2" />
              Guardar Configuración
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Opciones del Menú
            </span>
            <Button
              onClick={() => handleAddOption()}
              size="sm"
              data-testid="button-add-main-option"
            >
              <Plus className="h-4 w-4 mr-1" />
              Agregar Opción
            </Button>
          </CardTitle>
          <CardDescription>
            Configura las opciones del menú de tu bot. Usa (liga) para insertar enlaces y (banco) para nombres de bancos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            {editedOptions.filter(o => !o.parentId).map((option, index) => {
              const globalIndex = editedOptions.findIndex(o => o === option);
              return renderMenuOption(option, globalIndex);
            })}

            {editedOptions.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No hay opciones configuradas. Haz clic en "Agregar Opción" para comenzar.</p>
              </div>
            )}
          </ScrollArea>

          {hasUnsavedChanges && (
            <Button
              onClick={handleSaveAllChanges}
              className="w-full mt-4"
              data-testid="button-save-all-changes"
            >
              <Save className="h-4 w-4 mr-2" />
              Guardar Todos los Cambios
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Enviar Mensaje de Prueba
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Número de Prueba (10 dígitos)</Label>
            <Input
              value={testNumber}
              onChange={(e) => setTestNumber(e.target.value)}
              placeholder="5531781885"
              data-testid="input-test-number"
            />
          </div>

          <Button
            onClick={handleSendTestMessage}
            disabled={!status?.isConnected || sendTestMessageMutation.isPending}
            className="w-full"
            data-testid="button-send-test"
          >
            <Send className="h-4 w-4 mr-2" />
            Enviar Mensaje de Prueba
          </Button>

          {!status?.isConnected && (
            <Alert>
              <AlertDescription>
                El bot debe estar conectado para enviar mensajes de prueba.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
