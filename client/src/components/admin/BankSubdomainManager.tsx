import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Globe, Save, Trash2, Plus, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

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

interface BankSubdomain {
  id: number;
  bankCode: string;
  subdomain: string;
  isActive: boolean;
}

export default function BankSubdomainManager() {
  const { toast } = useToast();
  const [subdomains, setSubdomains] = useState<Record<string, string>>({});

  // Obtener subdominios existentes
  const { data: subdomainsData, isLoading } = useQuery<{ subdomains: BankSubdomain[] }>({
    queryKey: ['/api/bank-subdomains']
  });

  // Cargar subdominios cuando se obtienen
  useEffect(() => {
    if (subdomainsData?.subdomains) {
      const mapped: Record<string, string> = {};
      subdomainsData.subdomains.forEach(sub => {
        mapped[sub.bankCode] = sub.subdomain;
      });
      setSubdomains(mapped);
    }
  }, [subdomainsData]);

  // Mutación para guardar subdominio
  const saveMutation = useMutation({
    mutationFn: async ({ bankCode, subdomain }: { bankCode: string; subdomain: string }) => {
      const response = await fetch('/api/bank-subdomains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankCode, subdomain })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al guardar');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bank-subdomains'] });
      toast({
        title: 'Subdominio guardado',
        description: 'El subdominio se configuró correctamente',
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

  const handleSubdomainChange = (bankCode: string, value: string) => {
    setSubdomains(prev => ({ ...prev, [bankCode]: value }));
  };

  const handleSave = (bankCode: string) => {
    const subdomain = subdomains[bankCode]?.trim();
    if (!subdomain) {
      toast({
        title: 'Error',
        description: 'El subdominio no puede estar vacío',
        variant: 'destructive'
      });
      return;
    }
    saveMutation.mutate({ bankCode, subdomain });
  };

  const getBankName = (code: string) => {
    return BANKS.find(b => b.code === code)?.name || code.toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Cargando configuración...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="bank-subdomain-manager">
      <div>
        <h1 className="text-3xl font-bold mb-2" data-testid="title-subdomains">Subdominios de Bancos</h1>
        <p className="text-muted-foreground" data-testid="description-subdomains">
          Configura subdominios personalizados para cada banco en los enlaces generados
        </p>
      </div>

      {/* Información de uso */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <p className="font-medium mb-2">¿Cómo funcionan los subdominios?</p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Solo escribe el <strong>prefijo del subdominio</strong> (ejemplo: <code>liverpool</code>)</li>
            <li>Se combinará automáticamente con el dominio configurado en "Configuración del Sitio"</li>
            <li><strong>Con subdominio:</strong> https://<span className="text-blue-600">liverpool</span>.tudominio.com/client/123456789012</li>
            <li><strong>Sin subdominio:</strong> https://tudominio.com/<span className="text-blue-600">liverpool</span>/client/123456789012</li>
            <li>Los subdominios deben estar configurados en tu DNS apuntando a tu servidor</li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* Tabla de configuración */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Configuración de Subdominios
          </CardTitle>
          <CardDescription>
            Define solo el prefijo del subdominio para cada banco (ejemplo: liverpool, bbva, santander)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Banco</TableHead>
                <TableHead>Subdominio</TableHead>
                <TableHead className="w-[150px]">Estado</TableHead>
                <TableHead className="w-[100px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {BANKS.map((bank) => {
                const hasSubdomain = !!subdomains[bank.code];
                const isConfigured = subdomainsData?.subdomains?.some(s => s.bankCode === bank.code && s.isActive);
                
                return (
                  <TableRow key={bank.code} data-testid={`row-bank-${bank.code}`}>
                    <TableCell className="font-medium">
                      {bank.name}
                      <div className="text-xs text-muted-foreground">{bank.code}</div>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="text"
                        placeholder={bank.code}
                        value={subdomains[bank.code] || ''}
                        onChange={(e) => handleSubdomainChange(bank.code, e.target.value)}
                        data-testid={`input-subdomain-${bank.code}`}
                      />
                    </TableCell>
                    <TableCell>
                      {isConfigured ? (
                        <Badge className="bg-green-600" data-testid={`badge-status-${bank.code}`}>
                          Configurado
                        </Badge>
                      ) : (
                        <Badge variant="outline" data-testid={`badge-status-${bank.code}`}>
                          Sin configurar
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => handleSave(bank.code)}
                        disabled={saveMutation.isPending || !subdomains[bank.code]?.trim()}
                        data-testid={`button-save-${bank.code}`}
                      >
                        <Save className="w-4 h-4 mr-1" />
                        Guardar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
