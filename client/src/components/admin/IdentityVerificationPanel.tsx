import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Eye, Download, User, FileText, Image } from 'lucide-react';

interface IdentitySession {
  id: string;
  banco: string;
  documentType: string;
  documentFileName?: string;
  documentFileUrl?: string;
  documentBackFileName?: string;
  documentBackFileUrl?: string;
  selfieFileName?: string;
  selfieFileUrl?: string;
  identityVerified: boolean;
  createdAt: string;
  createdBy: string;
}

export function IdentityVerificationPanel() {
  const [selectedSession, setSelectedSession] = useState<IdentitySession | null>(null);
  const [viewingImage, setViewingImage] = useState<{ url: string; title: string } | null>(null);

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['/api/admin/identity-sessions'],
    refetchInterval: 5000
  });

  const openImageViewer = (url: string, title: string) => {
    setViewingImage({ url, title });
  };

  const downloadFile = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Verificación de Identidad
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Cargando...</div>
        </CardContent>
      </Card>
    );
  }

  const identitySessions = Array.isArray(sessions) ? sessions : [];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Verificación de Identidad ({identitySessions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {identitySessions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No hay documentos de identidad subidos
            </div>
          ) : (
            <div className="space-y-4">
              {identitySessions.map((session: IdentitySession) => (
                <div key={session.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <User className="h-5 w-5 text-blue-600" />
                      <div>
                        <div className="font-medium">Sesión {session.id}</div>
                        <div className="text-sm text-gray-600">
                          {session.banco} • {session.documentType} • {session.createdBy}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(session.createdAt).toLocaleString('es-MX')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={session.identityVerified ? "default" : "secondary"}>
                        {session.identityVerified ? "Verificado" : "Pendiente"}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedSession(session)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Ver Documentos
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal para ver documentos */}
      <Dialog open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Documentos de Identidad - Sesión {selectedSession?.id}
            </DialogTitle>
          </DialogHeader>
          
          {selectedSession && (
            <div className="space-y-6">
              <div className={`grid gap-6 ${
                selectedSession.documentBackFileUrl 
                  ? 'grid-cols-1 md:grid-cols-3' 
                  : 'grid-cols-1 md:grid-cols-2'
              }`}>
                
                {/* Documento Frontal */}
                {selectedSession.documentFileUrl && (
                  <div className="space-y-2">
                    <h3 className="font-medium text-lg">
                      {selectedSession.documentType?.toUpperCase() || 'DOCUMENTO'} - Frente
                    </h3>
                    <div className="border rounded-lg overflow-hidden">
                      <img
                        src={selectedSession.documentFileUrl}
                        alt="Documento frontal"
                        className="w-full h-48 object-cover cursor-pointer"
                        onClick={() => openImageViewer(
                          selectedSession.documentFileUrl!,
                          `${selectedSession.documentType?.toUpperCase() || 'DOCUMENTO'} - Frente`
                        )}
                      />
                    </div>
                    <div className="flex gap-2 justify-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openImageViewer(
                          selectedSession.documentFileUrl!,
                          `${selectedSession.documentType?.toUpperCase() || 'DOCUMENTO'} - Frente`
                        )}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Ver
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadFile(
                          selectedSession.documentFileUrl!,
                          selectedSession.documentFileName || 'documento_frente.jpg'
                        )}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Descargar
                      </Button>
                    </div>
                  </div>
                )}

                {/* Documento Reverso (solo para INE) */}
                {selectedSession.documentBackFileUrl && (
                  <div className="space-y-2">
                    <h3 className="font-medium text-lg">
                      {selectedSession.documentType?.toUpperCase() || 'DOCUMENTO'} - Reverso
                    </h3>
                    <div className="border rounded-lg overflow-hidden">
                      <img
                        src={selectedSession.documentBackFileUrl}
                        alt="Documento reverso"
                        className="w-full h-48 object-cover cursor-pointer"
                        onClick={() => openImageViewer(
                          selectedSession.documentBackFileUrl!,
                          `${selectedSession.documentType?.toUpperCase() || 'DOCUMENTO'} - Reverso`
                        )}
                      />
                    </div>
                    <div className="flex gap-2 justify-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openImageViewer(
                          selectedSession.documentBackFileUrl!,
                          `${selectedSession.documentType?.toUpperCase() || 'DOCUMENTO'} - Reverso`
                        )}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Ver
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadFile(
                          selectedSession.documentBackFileUrl!,
                          selectedSession.documentBackFileName || 'documento_reverso.jpg'
                        )}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Descargar
                      </Button>
                    </div>
                  </div>
                )}

                {/* Selfie */}
                {selectedSession.selfieFileUrl && (
                  <div className="space-y-2">
                    <h3 className="font-medium text-lg">Selfie</h3>
                    <div className="border rounded-lg overflow-hidden">
                      <img
                        src={selectedSession.selfieFileUrl}
                        alt="Selfie"
                        className="w-full h-48 object-cover cursor-pointer"
                        onClick={() => openImageViewer(
                          selectedSession.selfieFileUrl!,
                          'Selfie'
                        )}
                      />
                    </div>
                    <div className="flex gap-2 justify-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openImageViewer(
                          selectedSession.selfieFileUrl!,
                          'Selfie'
                        )}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Ver
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadFile(
                          selectedSession.selfieFileUrl!,
                          selectedSession.selfieFileName || 'selfie.jpg'
                        )}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Descargar
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Información adicional */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Información de la Sesión</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Banco:</span> {selectedSession.banco}
                  </div>
                  <div>
                    <span className="font-medium">Tipo de Documento:</span> {selectedSession.documentType}
                  </div>
                  <div>
                    <span className="font-medium">Creado por:</span> {selectedSession.createdBy}
                  </div>
                  <div>
                    <span className="font-medium">Fecha:</span> {new Date(selectedSession.createdAt).toLocaleString('es-MX')}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal para visualizar imagen completa */}
      <Dialog open={!!viewingImage} onOpenChange={() => setViewingImage(null)}>
        <DialogContent className="max-w-6xl max-h-[95vh]">
          <DialogHeader>
            <DialogTitle>{viewingImage?.title}</DialogTitle>
          </DialogHeader>
          {viewingImage && (
            <div className="flex justify-center">
              <img
                src={viewingImage.url}
                alt={viewingImage.title}
                className="max-w-full max-h-[80vh] object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}