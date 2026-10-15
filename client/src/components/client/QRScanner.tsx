import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Html5Qrcode } from 'html5-qrcode';
import { toPng } from 'html-to-image';
import { BankType } from '@shared/schema';

// Importamos los logos de los bancos
import plataCardLogo from '@assets/Plata_Card_Logo.png';
import banorteLogo from '@assets/Banorte-01.png';
import liverpoolLogo from '@assets/logo-brand-liverpool-f-c-design-acaab2087aa7319e33227c007e2d759b.png';
import hsbcLogo from '@assets/Hsbc.png';
import banregioLogo from '@assets/Banregio.png.png';
import invexLogo from '@assets/Invex.png';
import bancoppelLogo from '@assets/bancoppel.png';
import scotiaLogo from '@assets/Skotia.png';
import amexLogo from '@assets/Amex.png';

interface QRScannerProps {
  onScanSuccess: (qrData: string, qrImageData?: string) => void;
  onCancel: () => void;
  bankType: BankType; // Añadimos el tipo de banco
}

const QRScanner: React.FC<QRScannerProps> = ({ onScanSuccess, onCancel, bankType }) => {
  const [scanning, setScanning] = useState<boolean>(false);
  const [permissionDenied, setPermissionDenied] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [capturedQR, setCapturedQR] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const qrBoxId = "qr-reader";
  const captureRef = useRef<HTMLDivElement>(null);

  // Obtener el logo según el tipo de banco
  const getBankLogo = () => {
    switch (bankType) {
      case BankType.PLATACARD:
        return plataCardLogo;
      case BankType.BANORTE:
        return banorteLogo;
      case BankType.LIVERPOOL:
        return liverpoolLogo;
      case BankType.HSBC:
        return hsbcLogo;
      case BankType.BANREGIO:
        return banregioLogo;
      case BankType.INVEX:
        return invexLogo;
      case BankType.BANCOPPEL:
        return bancoppelLogo;
      case BankType.SCOTIABANK:
        return scotiaLogo;
      case BankType.AMEX:
        return amexLogo;
      default:
        // Si no es Plata Card, no debemos mostrar el logo de Plata Card en QR Scanner
        return "";
    }
  };

  // Obtener el estilo del botón según el tipo de banco
  const getButtonStyle = () => {
    switch (bankType) {
      case BankType.PLATACARD:
        return "bg-orange-500 hover:bg-orange-600";
      case BankType.BANORTE:
        return "bg-red-600 hover:bg-red-700";
      case BankType.LIVERPOOL:
        return "bg-pink-600 hover:bg-pink-700";
      case BankType.HSBC:
        return "bg-red-600 hover:bg-red-700";
      case BankType.BANREGIO:
        return "bg-blue-600 hover:bg-blue-700";
      case BankType.INVEX:
        return "bg-purple-600 hover:bg-purple-700";
      case BankType.BANCOPPEL:
        return "bg-yellow-600 hover:bg-yellow-700";
      case BankType.SCOTIABANK:
        return "bg-red-600 hover:bg-red-700";
      case BankType.AMEX:
        return "bg-blue-600 hover:bg-blue-700";
      case BankType.INBURSA:
        return "bg-[#1B4B72] hover:bg-[#0F3A5F]";
      default:
        return "bg-orange-500 hover:bg-orange-600";
    }
  };

  // Obtener el estilo del encabezado según el tipo de banco
  const getHeaderStyle = () => {
    switch (bankType) {
      case BankType.PLATACARD:
        return "bg-gray-800 text-white";
      case BankType.BANORTE:
        return "bg-red-600 text-white";
      case BankType.LIVERPOOL:
        return "bg-pink-600 text-white";
      case BankType.HSBC:
        return "bg-white text-black";
      case BankType.BANREGIO:
        return "bg-blue-600 text-white";
      case BankType.INVEX:
        return "bg-purple-600 text-white";
      case BankType.BANCOPPEL:
        return "bg-yellow-500 text-black";
      case BankType.SCOTIABANK:
        return "bg-red-600 text-white";
      case BankType.AMEX:
        return "bg-blue-600 text-white";
      case BankType.INBURSA:
        return "bg-[#1B4B72] text-white";
      default:
        return "bg-gray-800 text-white";
    }
  };

  // Obtener la clase de logo según el tipo de banco
  const getLogoClass = () => {
    switch (bankType) {
      case BankType.HSBC:
        return "h-20 mb-2";
      case BankType.INVEX:
        return "h-10 mb-2";
      case BankType.SANTANDER:
      case BankType.SCOTIABANK:
        return "h-28 mb-2";
      default:
        return "h-16 mb-2";
    }
  };

  // Función para capturar la imagen del QR como base64 directamente de la cámara
  const captureQRImage = async (qrData: string) => {
    try {
      // Capturar la vista actual del escáner QR
      if (captureRef.current) {
        // Crear un contenedor personalizado para la captura que incluya el QR y metadata
        const captureContainer = document.createElement('div');
        captureContainer.className = "qr-capture-container";
        captureContainer.style.width = '320px';
        captureContainer.style.height = '420px';
        captureContainer.style.backgroundColor = 'white';
        captureContainer.style.padding = '15px';
        captureContainer.style.borderRadius = '10px';
        captureContainer.style.boxSizing = 'border-box';
        captureContainer.style.display = 'flex';
        captureContainer.style.flexDirection = 'column';
        captureContainer.style.alignItems = 'center';
        
        // Añadir logo y título según el tipo de banco
        const titleContainer = document.createElement('div');
        titleContainer.style.marginBottom = '15px';
        titleContainer.style.textAlign = 'center';
        titleContainer.style.display = 'flex';
        titleContainer.style.flexDirection = 'column';
        titleContainer.style.alignItems = 'center';
        
        // Agregar logo del banco solo si es Plata Card
        if (bankType === BankType.PLATACARD) {
          const logoSrc = getBankLogo();
          if (logoSrc) {
            const logo = document.createElement('img');
            logo.src = logoSrc;
            logo.style.width = '120px';
            logo.style.marginBottom = '10px';
            titleContainer.appendChild(logo);
          }
        }
        
        const date = document.createElement('div');
        date.textContent = new Date().toLocaleString();
        date.style.fontSize = '12px';
        date.style.color = '#666';
        date.style.marginTop = '5px';
        
        titleContainer.appendChild(date);
        
        // Clonar el elemento del escáner para la captura
        const qrViewClone = captureRef.current.cloneNode(true) as HTMLElement;
        qrViewClone.style.width = '280px';
        qrViewClone.style.height = '280px';
        qrViewClone.style.border = '1px solid #ccc';
        qrViewClone.style.borderRadius = '5px';
        qrViewClone.style.overflow = 'hidden';
        
        // Añadir sección para el texto del QR
        const qrDataContainer = document.createElement('div');
        qrDataContainer.style.marginTop = '15px';
        qrDataContainer.style.width = '100%';
        qrDataContainer.style.padding = '10px';
        qrDataContainer.style.backgroundColor = '#f0f0f0';
        qrDataContainer.style.borderRadius = '5px';
        qrDataContainer.style.fontSize = '12px';
        qrDataContainer.style.wordBreak = 'break-all';
        qrDataContainer.style.maxHeight = '60px';
        qrDataContainer.style.overflow = 'hidden';
        qrDataContainer.textContent = qrData;
        
        // Construir la estructura completa
        captureContainer.appendChild(titleContainer);
        captureContainer.appendChild(qrViewClone);
        captureContainer.appendChild(qrDataContainer);
        
        // Añadir al DOM temporalmente
        document.body.appendChild(captureContainer);
        
        // Tomar la captura
        const dataUrl = await toPng(captureContainer);
        
        // Eliminar del DOM
        document.body.removeChild(captureContainer);
        
        return dataUrl;
      }
      
      // Si no se pudo acceder al elemento de la cámara, capturar solo los datos
      return null;
    } catch (error) {
      console.error('Error al capturar la imagen del QR:', error);
      return null;
    }
  };

  // Iniciar el escáner
  const startScanner = async () => {
    try {
      setScanning(true);
      setError(null);
      setCapturedQR(null);

      // Comprobamos primero si tenemos permisos de cámara
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // Cerramos el stream inmediatamente, solo necesitábamos verificar los permisos
      stream.getTracks().forEach(track => track.stop());

      // Inicializar el escáner HTML5
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(qrBoxId);
      }

      const qrCodeSuccessCallback = async (decodedText: string) => {
        // Detener el escáner después de un escaneo exitoso
        stopScanner();
        setCapturedQR(decodedText);
        
        // Capturar la imagen del QR
        const qrImageData = await captureQRImage(decodedText);
        
        // Enviar el texto del QR y la imagen (si está disponible)
        onScanSuccess(decodedText, qrImageData || undefined);
      };

      const config = { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        formatsToSupport: ['QR_CODE']
      };

      // Iniciar el escáner con la cámara trasera preferiblemente
      await scannerRef.current.start(
        { facingMode: "environment" }, 
        config, 
        qrCodeSuccessCallback, 
        undefined
      );
    } catch (err: any) {
      console.error("Error al iniciar el escáner:", err);
      
      // Verificar si el error es por negación de permisos
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionDenied(true);
        setError("No se otorgaron permisos para acceder a la cámara");
      } else {
        setError(`Error: ${err.message || "No se pudo iniciar el escáner QR"}`);
      }
      
      setScanning(false);
    }
  };

  // Detener el escáner
  const stopScanner = async () => {
    if (scannerRef.current && scanning) {
      try {
        await scannerRef.current.stop();
      } catch (error) {
        console.error("Error al detener el escáner:", error);
      }
    }
    setScanning(false);
  };

  // Limpiar al desmontar el componente
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const headerClasses = `flex flex-col items-center mb-4 p-4 w-full ${getHeaderStyle()}`;
  const buttonClass = getButtonStyle();
  const logoClass = getLogoClass();

  return (
    <div className="flex flex-col items-center">
      <div className={headerClasses}>
        {/* Solo mostrar el logo si el banco es Plata Card */}
        {bankType === BankType.PLATACARD && (
          <img src={plataCardLogo} alt="Plata Card Logo" className={logoClass} />
        )}
        <h2 className="text-xl font-bold">Escanea el QR de tu tarjeta para identificarte</h2>
        <p className={bankType === BankType.HSBC ? "text-gray-600" : "text-gray-200"}>
          Posiciona el código QR dentro del recuadro para escanearlo
        </p>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
          {permissionDenied && (
            <p className="mt-2 text-sm">
              Para usar esta función, debes permitir el acceso a la cámara en la configuración de tu navegador.
            </p>
          )}
        </div>
      )}

      <div className="relative mb-4 border-2 border-dashed border-gray-300 rounded-lg p-1">
        <div 
          id={qrBoxId} 
          className="w-80 h-80 bg-gray-100 rounded" 
          ref={captureRef}
          style={{ 
            filter: 'brightness(1.2) contrast(1.2)',  // Mejora la visibilidad del escáner
          }}
        ></div>
        {!scanning && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 rounded-lg">
            <p className="text-white font-bold">Cámara desactivada</p>
          </div>
        )}
      </div>

      {capturedQR && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
          <p className="font-bold">QR escaneado correctamente</p>
          <p className="text-sm truncate w-80">{capturedQR}</p>
        </div>
      )}

      <div className="flex space-x-4">
        {!scanning ? (
          <Button 
            className={buttonClass}
            onClick={startScanner}
          >
            Iniciar cámara
          </Button>
        ) : (
          <Button 
            className="bg-red-500 hover:bg-red-600"
            onClick={stopScanner}
          >
            Detener cámara
          </Button>
        )}
        <Button 
          variant="outline" 
          onClick={onCancel}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
};

export default QRScanner;