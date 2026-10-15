import * as React from "react";

// Definimos tipos para la orientación del dispositivo
export type DeviceOrientation = 'portrait' | 'landscape' | 'unknown';

export function useDeviceOrientation() {
  const [orientation, setOrientation] = React.useState<DeviceOrientation>('unknown');

  React.useEffect(() => {
    // Función para determinar la orientación actual
    const updateOrientation = () => {
      if (window.matchMedia("(orientation: portrait)").matches) {
        setOrientation('portrait');
      } else if (window.matchMedia("(orientation: landscape)").matches) {
        setOrientation('landscape');
      } else {
        // Para escritorio o casos donde la orientación no está bien definida
        setOrientation(window.innerWidth > window.innerHeight ? 'landscape' : 'portrait');
      }
    };

    // Actualizar orientación inicialmente
    updateOrientation();

    // Escuchar cambios de orientación
    const handleOrientationChange = () => {
      updateOrientation();
    };

    // Evento de cambio de orientación y cambio de tamaño
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
    };
  }, []);

  return orientation;
}

// Hook combinado que devuelve información sobre el dispositivo
export function useDeviceInfo() {
  const [deviceInfo, setDeviceInfo] = React.useState({
    isMobile: false,
    isLandscape: false,
    isPortrait: false,
    screenWidth: 0
  });

  React.useEffect(() => {
    const updateDeviceInfo = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isMobile = width < 768;
      const isLandscape = width > height;
      
      setDeviceInfo({
        isMobile,
        isLandscape,
        isPortrait: !isLandscape,
        screenWidth: width
      });
    };
    
    // Actualizar inicialmente
    updateDeviceInfo();
    
    // Escuchar eventos de cambio
    window.addEventListener('resize', updateDeviceInfo);
    window.addEventListener('orientationchange', updateDeviceInfo);
    
    return () => {
      window.removeEventListener('resize', updateDeviceInfo);
      window.removeEventListener('orientationchange', updateDeviceInfo);
    };
  }, []);
  
  return deviceInfo;
}