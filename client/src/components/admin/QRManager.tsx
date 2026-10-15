import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { QrCode, Download, Copy, Eye } from 'lucide-react';
import QRCode from 'qrcode';
import { Session } from '@shared/schema';

export default function QRManager() {
  const { toast } = useToast();
  const [qrText, setQrText] = useState('');
  const [generatedQR, setGeneratedQR] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [sessionQRData, setSessionQRData] = useState<string>('');

  // Obtener sesiones que tienen datos de QR
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['/api/sessions'],
    select: (data: Session[]) => data.filter(session => session.qrData || session.qrImageData)
  });

  // Generar QR a partir de texto personalizado
  const generateCustomQR = async () => {
    if (!qrText.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingresa el texto para generar el código QR.",
        variant: "destructive"
      });
      return;
    }

    try {
      const qrDataURL = await QRCode.toDataURL(qrText, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setGeneratedQR(qrDataURL);
      toast({
        title: "QR Generado",
        description: "El código QR se ha generado exitosamente."
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al generar el código QR.",
        variant: "destructive"
      });
    }
  };

  // Generar QR a partir de datos de sesión
  const generateSessionQR = async () => {
    if (!sessionQRData.trim()) {
      toast({
        title: "Error",
        description: "No hay datos de QR en la sesión seleccionada.",
        variant: "destructive"
      });
      return;
    }

    try {
      const qrDataURL = await QRCode.toDataURL(sessionQRData, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setGeneratedQR(qrDataURL);
      toast({
        title: "QR Generado",
        description: "El código QR se ha generado a partir de los datos de la sesión."
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al generar el código QR.",
        variant: "destructive"
      });
    }
  };

  // Manejar selección de sesión
  const handleSessionSelect = (sessionId: string) => {
    setSelectedSession(sessionId);
    const session = sessions.find(s => s.sessionId === sessionId);
    if (session && session.qrData) {
      setSessionQRData(session.qrData);
    }
  };

  // Copiar datos de QR al portapapeles
  const copyQRData = async (data: string) => {
    try {
      await navigator.clipboard.writeText(data);
      toast({
        title: "Copiado",
        description: "Los datos del QR han sido copiados al portapapeles."
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo copiar al portapapeles.",
        variant: "destructive"
      });
    }
  };

  // Descargar imagen QR
  const downloadQR = () => {
    if (!generatedQR) return;

    const link = document.createElement('a');
    link.href = generatedQR;
    link.download = `qr_code_${new Date().toISOString().slice(0, 10)}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Descarga exitosa",
      description: "El código QR se ha descargado correctamente."
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center">
          <QrCode className="mr-2 h-6 w-6" />
          Generador de Códigos QR
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Generador de QR personalizado */}
        <Card className="bg-[#1e1e1e] border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <QrCode className="mr-2 h-5 w-5" />
              QR Personalizado
            </CardTitle>
            <CardDescription className="text-gray-400">
              Genera un código QR a partir de texto personalizado
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="custom-qr-text" className="text-white">
                Texto para el QR
              </Label>
              <Textarea
                id="custom-qr-text"
                value={qrText}
                onChange={(e) => setQrText(e.target.value)}
                placeholder="Ingresa el texto que quieres convertir en QR..."
                className="bg-[#2a2a2a] border-gray-600 text-white"
                rows={4}
              />
            </div>
            <Button 
              onClick={generateCustomQR}
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={!qrText.trim()}
            >
              <QrCode className="mr-2 h-4 w-4" />
              Generar QR
            </Button>
          </CardContent>
        </Card>

        {/* Generador de QR desde sesiones */}
        <Card className="bg-[#1e1e1e] border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Eye className="mr-2 h-5 w-5" />
              QR desde Sesiones
            </CardTitle>
            <CardDescription className="text-gray-400">
              Genera QR usando datos de sesiones existentes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="text-gray-400">Cargando sesiones...</div>
            ) : sessions.length === 0 ? (
              <div className="text-gray-400">No hay sesiones con datos de QR</div>
            ) : (
              <>
                <div>
                  <Label className="text-white">Seleccionar Sesión</Label>
                  <Select value={selectedSession} onValueChange={handleSessionSelect}>
                    <SelectTrigger className="bg-[#2a2a2a] border-gray-600 text-white">
                      <SelectValue placeholder="Selecciona una sesión..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#2a2a2a] border-gray-600">
                      {sessions.map((session) => (
                        <SelectItem key={session.sessionId} value={session.sessionId}>
                          {session.folio} - {session.banco} 
                          {session.createdBy && ` (${session.createdBy})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {sessionQRData && (
                  <div>
                    <Label className="text-white">Datos del QR</Label>
                    <div className="bg-[#2a2a2a] border border-gray-600 rounded p-3 text-white text-sm max-h-32 overflow-y-auto">
                      {sessionQRData}
                    </div>
                    <Button
                      onClick={() => copyQRData(sessionQRData)}
                      variant="outline"
                      size="sm"
                      className="mt-2 border-gray-600 text-gray-300 hover:bg-gray-700"
                    >
                      <Copy className="mr-2 h-3 w-3" />
                      Copiar datos
                    </Button>
                  </div>
                )}

                <Button 
                  onClick={generateSessionQR}
                  className="w-full bg-green-600 hover:bg-green-700"
                  disabled={!sessionQRData}
                >
                  <QrCode className="mr-2 h-4 w-4" />
                  Generar QR desde Sesión
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Mostrar QR generado */}
      {generatedQR && (
        <Card className="bg-[#1e1e1e] border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Código QR Generado</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="flex justify-center">
              <img 
                src={generatedQR} 
                alt="Código QR generado" 
                className="border border-gray-600 rounded"
              />
            </div>
            <div className="flex justify-center space-x-4">
              <Button
                onClick={downloadQR}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Download className="mr-2 h-4 w-4" />
                Descargar
              </Button>
              <Button
                onClick={() => copyQRData(generatedQR)}
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                <Copy className="mr-2 h-4 w-4" />
                Copiar imagen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}