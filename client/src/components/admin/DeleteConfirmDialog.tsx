import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Session } from '@shared/schema';
import { Trash2, QrCode, Download } from 'lucide-react';

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  session: Session | null;
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  session
}) => {
  if (!session) return null;
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-[#1e1e1e] text-white border-gray-700">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Trash2 className="mr-2 h-5 w-5 text-red-500" />
            Confirmar eliminación
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            ¿Está seguro que desea eliminar esta sesión? Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        
        <div className="mt-4 bg-[#252525] p-3 rounded-md">
          <div className="mb-1">
            <span className="font-semibold">Banco:</span> {session.banco}
          </div>
          <div className="mb-1">
            <span className="font-semibold">Folio:</span> {session.folio || 'N/A'}
          </div>
          {session.username && (
            <div className="mb-1">
              <span className="font-semibold">Usuario:</span> {session.username}
            </div>
          )}
          {session.tarjeta && (
            <div className="mb-1">
              <span className="font-semibold">Tarjeta:</span> {session.tarjeta}
            </div>
          )}
          <div className="mb-1">
            <span className="font-semibold">Estado:</span> {session.pasoActual || 'Inicial'}
          </div>
          
          {session.qrData && (
            <div className="mt-2 pt-2 border-t border-gray-700">
              <div className="flex items-center mb-1">
                <QrCode className="mr-2 h-4 w-4 text-[#00aaff]" />
                <span className="font-semibold">Código QR escaneado</span>
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose} className="border-gray-700 hover:bg-gray-800">
            Cancelar
          </Button>
          <Button 
            variant="destructive" 
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="bg-red-600 hover:bg-red-700"
          >
            Eliminar sesión
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};