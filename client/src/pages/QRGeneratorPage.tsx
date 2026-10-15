import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { QrCode, Download, Copy, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function QRGeneratorPage() {
  const [inputText, setInputText] = useState('');
  const [qrImageUrl, setQrImageUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  // Función para validar que el input sea alfanumérico
  const validateInput = (input: string) => {
    // Permite letras, números y espacios
    return /^[a-zA-Z0-9\s]*$/.test(input);
  };

  // Función para generar el código QR
  const generateQR = () => {
    if (!inputText) {
      toast({
        title: "Error al generar QR",
        description: "Debes ingresar un texto alfanumérico para generar el código QR",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      // Usar la API de QR Code Generator
      const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(inputText)}`;
      setQrImageUrl(url);
      
      toast({
        title: "QR generado",
        description: "El código QR se ha generado correctamente",
      });
    } catch (error) {
      console.error("Error generando QR:", error);
      toast({
        title: "Error al generar QR",
        description: "Ocurrió un error al generar el código QR",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Función para descargar el código QR como imagen
  const downloadQR = () => {
    if (!qrImageUrl) return;
    
    fetch(qrImageUrl)
      .then(response => response.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `qr-code-${inputText}.png`;
        document.body.appendChild(link);
        link.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
        
        toast({
          title: "QR descargado",
          description: "El código QR se ha descargado correctamente",
        });
      })
      .catch(error => {
        console.error("Error descargando QR:", error);
        toast({
          title: "Error al descargar",
          description: "No se pudo descargar el código QR",
          variant: "destructive",
        });
      });
  };

  // Función para copiar el texto del QR al portapapeles
  const copyQRText = () => {
    navigator.clipboard.writeText(inputText)
      .then(() => {
        toast({
          title: "Texto copiado",
          description: "El código ha sido copiado al portapapeles",
        });
      })
      .catch((error) => {
        console.error("Error copiando al portapapeles:", error);
        toast({
          title: "Error al copiar",
          description: "No se pudo copiar el texto al portapapeles",
          variant: "destructive",
        });
      });
  };

  // Manejar cambios en el input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Solo permitir caracteres alfanuméricos y espacios
    if (validateInput(value)) {
      setInputText(value);
    }
  };

  return (
    <div className="bg-[#121212] min-h-screen flex flex-col">
      <div className="flex items-center justify-between p-4 bg-[#1a1a1a] border-b border-gray-800">
        <h1 className="text-xl md:text-2xl font-bold text-white">
          <QrCode className="inline-block mr-2 h-6 w-6" />
          Generador de Códigos QR
        </h1>
        
        <a href="/admin" className="text-blue-400 hover:text-blue-300 text-sm">
          &larr; Volver al panel de administración
        </a>
      </div>
      
      <div className="flex-1 p-4 md:p-6">
        <Card className="bg-[#1e1e1e] text-white border-gray-700 max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center">
              <QrCode className="mr-2 h-5 w-5" />
              Generador de Códigos QR
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="col-span-1 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="qr-input">Ingresa texto alfanumérico</Label>
                    <Input
                      id="qr-input"
                      type="text"
                      value={inputText}
                      onChange={handleInputChange}
                      placeholder="Ej: ABC123"
                      className="bg-[#2a2a2a] border-gray-700 text-white"
                      maxLength={50}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Button 
                      onClick={generateQR} 
                      className="w-full bg-[#007bff] hover:bg-blue-700 text-white flex items-center justify-center"
                      disabled={isGenerating || !inputText}
                    >
                      {isGenerating ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Generando...
                        </>
                      ) : (
                        <>
                          <QrCode className="h-4 w-4 mr-2" />
                          Generar QR
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {qrImageUrl && (
                    <div className="space-y-2">
                      <div className="flex space-x-2">
                        <Button
                          onClick={downloadQR}
                          className="flex-1 bg-[#28a745] hover:bg-green-700 text-white flex items-center justify-center"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Descargar
                        </Button>
                        <Button
                          onClick={copyQRText}
                          className="flex-1 bg-[#6c757d] hover:bg-gray-700 text-white flex items-center justify-center"
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copiar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="col-span-2 flex flex-col items-center justify-center bg-[#2a2a2a] rounded-lg p-4 min-h-[300px]">
                  {qrImageUrl ? (
                    <>
                      <img 
                        src={qrImageUrl} 
                        alt="Código QR generado" 
                        className="max-w-full max-h-60 md:max-h-80"
                      />
                      <div className="mt-4 text-center">
                        <span className="text-sm text-gray-400">
                          Código: <span className="font-mono">{inputText}</span>
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="text-center text-gray-500 py-16">
                      <QrCode className="h-16 w-16 mx-auto mb-4 opacity-50" />
                      <p>Ingresa un código alfanumérico y presiona "Generar QR" para crear un código QR.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default QRGeneratorPage;