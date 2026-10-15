import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, CheckCircle, AlertTriangle } from 'lucide-react';

interface HCaptchaProps {
  onVerify: (token: string | null) => void;
  disabled?: boolean;
  siteKey?: string;
}

// Declarar tipos para hCaptcha
declare global {
  interface Window {
    hcaptcha: {
      render: (container: string | HTMLElement, parameters: {
        sitekey: string;
        callback?: (token: string) => void;
        'expired-callback'?: () => void;
        'error-callback'?: () => void;
        theme?: 'light' | 'dark';
        size?: 'normal' | 'compact';
      }) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
      getResponse: (widgetId?: string) => string;
    };
  }
}

export function HCaptcha({ onVerify, disabled = false, siteKey }: HCaptchaProps) {
  const captchaRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [widgetId, setWidgetId] = useState<string | null>(null);
  
  // Usar clave del entorno o fallback
  const HCAPTCHA_SITE_KEY = siteKey || import.meta.env.VITE_HCAPTCHA_SITE_KEY || '10000000-ffff-ffff-ffff-000000000001'; // Clave de prueba de hCaptcha
  
  // Cargar script de hCaptcha
  useEffect(() => {
    if (window.hcaptcha) {
      setIsLoaded(true);
      return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://js.hcaptcha.com/1/api.js';
    script.async = true;
    script.defer = true;
    script.onload = () => setIsLoaded(true);
    script.onerror = () => setError('Error al cargar hCaptcha');
    
    document.head.appendChild(script);
    
    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);
  
  // Renderizar hCaptcha cuando esté listo
  useEffect(() => {
    if (!isLoaded || !captchaRef.current || widgetId !== null) return;
    
    try {
      const id = window.hcaptcha.render(captchaRef.current!, {
        sitekey: HCAPTCHA_SITE_KEY,
        callback: (token: string) => {
          setIsVerified(true);
          setError(null);
          onVerify(token);
        },
        'expired-callback': () => {
          setIsVerified(false);
          setError('hCaptcha expirado, por favor verifica nuevamente');
          onVerify(null);
        },
        'error-callback': () => {
          setIsVerified(false);
          setError('Error en hCaptcha, intenta nuevamente');
          onVerify(null);
        },
        theme: 'light',
        size: 'normal'
      });
      setWidgetId(id);
    } catch (err) {
      setError('Error al inicializar hCaptcha');
      console.error('hCaptcha error:', err);
    }
  }, [isLoaded, HCAPTCHA_SITE_KEY, onVerify]);
  
  // Reset hCaptcha
  const resetCaptcha = () => {
    if (widgetId !== null && window.hcaptcha) {
      window.hcaptcha.reset(widgetId);
      setIsVerified(false);
      setError(null);
      onVerify(null);
    }
  };
  
  return (
    <Card className="w-full">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Shield className="h-4 w-4" />
          <span>Verificación hCaptcha</span>
        </div>
        
        {error ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
            <button
              onClick={resetCaptcha}
              className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
            >
              Intentar nuevamente
            </button>
          </div>
        ) : (
          <>
            <div className="flex justify-center">
              <div 
                ref={captchaRef}
                className={disabled ? 'opacity-50 pointer-events-none' : ''}
              />
            </div>
            
            {!isLoaded && (
              <div className="text-center text-sm text-gray-500">
                Cargando hCaptcha...
              </div>
            )}
            
            {isVerified && (
              <div className="flex items-center justify-center gap-2 text-green-600 text-sm">
                <CheckCircle className="h-4 w-4" />
                <span>Verificación completada</span>
              </div>
            )}
          </>
        )}
        
        {HCAPTCHA_SITE_KEY === '10000000-ffff-ffff-ffff-000000000001' && (
          <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
            ⚠️ Usando clave de prueba de hCaptcha. Para producción, configura VITE_HCAPTCHA_SITE_KEY
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Hook para usar hCaptcha de forma más sencilla
export function useHCaptcha() {
  const [token, setToken] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  
  const handleVerify = (captchaToken: string | null) => {
    setToken(captchaToken);
    setIsVerified(!!captchaToken);
  };
  
  const reset = () => {
    setToken(null);
    setIsVerified(false);
  };
  
  return {
    token,
    isVerified,
    handleVerify,
    reset
  };
}