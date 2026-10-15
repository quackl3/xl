import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Download, Trash2, File } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FileManagerProps {
  sessionId: string;
  currentFile?: {
    fileName: string;
    fileUrl: string;
    fileSize: string;
  };
  onFileUpdate: () => void;
}

export const FileManager: React.FC<FileManagerProps> = ({ 
  sessionId, 
  currentFile, 
  onFileUpdate 
}) => {
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sessionId', sessionId);

      const response = await fetch('/api/upload-protection-file', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error subiendo archivo');
      }

      const result = await response.json();
      
      toast({
        title: "Archivo subido exitosamente",
        description: `${result.fileName} (${result.fileSize})`,
      });

      onFileUpdate();
    } catch (error) {
      console.error('Error subiendo archivo:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Error subiendo archivo',
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      // Reset the input
      event.target.value = '';
    }
  };

  const handleFileRemove = async () => {
    if (!currentFile) return;

    setRemoving(true);
    try {
      const response = await fetch(`/api/remove-protection-file/${sessionId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error eliminando archivo');
      }

      toast({
        title: "Archivo eliminado",
        description: "El archivo de protección ha sido eliminado",
      });

      onFileUpdate();
    } catch (error) {
      console.error('Error eliminando archivo:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Error eliminando archivo',
        variant: "destructive",
      });
    } finally {
      setRemoving(false);
    }
  };

  const handleFileDownload = () => {
    if (!currentFile) return;
    
    const link = document.createElement('a');
    link.href = currentFile.fileUrl;
    link.download = currentFile.fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <File className="h-5 w-5" />
          Archivo de Protección Bancaria
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {currentFile ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <p className="font-medium text-gray-900">{currentFile.fileName}</p>
                <p className="text-sm text-gray-500">{currentFile.fileSize}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFileDownload}
                  className="flex items-center gap-1"
                >
                  <Download className="h-4 w-4" />
                  Descargar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleFileRemove}
                  disabled={removing}
                  className="flex items-center gap-1"
                >
                  <Trash2 className="h-4 w-4" />
                  {removing ? 'Eliminando...' : 'Eliminar'}
                </Button>
              </div>
            </div>
            
            <div className="text-sm text-gray-600">
              <p>El cliente podrá descargar este archivo cuando acceda a la pantalla de Protección Bancaria.</p>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <File className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 mb-4">
              No hay archivo de protección configurado para esta sesión.
            </p>
          </div>
        )}

        <div className="border-t pt-4">
          <div className="relative">
            <input
              type="file"
              id={`file-upload-${sessionId}`}
              onChange={handleFileUpload}
              disabled={uploading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              accept=".zip,.rar,.exe,.msi,.apk,.pkg,.dmg,.deb,.rpm"
            />
            <Button
              disabled={uploading}
              className="w-full flex items-center gap-2 pointer-events-none"
            >
              <Upload className="h-4 w-4" />
              {uploading ? 'Subiendo archivo...' : 
               currentFile ? 'Reemplazar archivo' : 'Subir archivo de protección'}
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Formatos recomendados: .zip, .exe, .msi, .apk, .pkg, .dmg (máximo 50MB)
          </p>
        </div>
      </CardContent>
    </Card>
  );
};