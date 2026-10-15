import { createContext, ReactNode, useContext, useEffect, useRef, useState } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { User, UserRole } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  isAdmin: boolean;
  loginMutation: UseMutationResult<any, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<any, Error, RegisterData>;
};

type LoginData = {
  username: string;
  password: string;
};

type RegisterData = {
  username: string;
  password: string;
  telegramChatId?: string;
  role?: UserRole;
  discountCode?: string;
  accountType?: 'individual' | 'office';
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  // Referencia para el temporizador de inactividad
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Estado para controlar cuándo se está por cerrar sesión
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  
  const {
    data: user,
    error,
    isLoading,
    refetch,
  } = useQuery<any | null, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  console.log("[Auth] Estado de autenticación:", user ? `Usuario ${user.username} autenticado` : "No autenticado");
  // Actualizada la comprobación de administrador para conceder permisos de administrador a usuarios normales
  // Todos los usuarios activos tendrán acceso a la interfaz de administrador pero con visibilidad restringida
  const isAdmin = user ? user.isActive === true : false;
  
  // Configuración de tiempo de inactividad (10 minutos = 600000 ms)
  const INACTIVITY_TIMEOUT = 600000;
  const INACTIVITY_WARNING_TIME = 30000; // Mostrar advertencia 30 segundos antes

  // Función para reiniciar el temporizador de inactividad
  const resetInactivityTimer = () => {
    // Limpiar el temporizador existente si hay uno
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    
    // Solo configurar el temporizador si el usuario está autenticado
    if (user) {
      // Primero configurar el temporizador para mostrar la advertencia
      inactivityTimerRef.current = setTimeout(() => {
        setShowInactivityWarning(true);
        
        // Luego configurar el temporizador para cerrar sesión
        inactivityTimerRef.current = setTimeout(() => {
          if (user) {
            logoutMutation.mutate();
            toast({
              title: "Sesión cerrada",
              description: "Su sesión ha sido cerrada por inactividad",
              variant: "destructive",
            });
            setShowInactivityWarning(false);
          }
        }, INACTIVITY_WARNING_TIME);
      }, INACTIVITY_TIMEOUT - INACTIVITY_WARNING_TIME);
    }
  };
  
  // Reiniciar el temporizador cuando el usuario se autentica
  useEffect(() => {
    if (user) {
      resetInactivityTimer();
    }
  }, [user]);
  
  // Configurar los event listeners para detectar actividad del usuario
  useEffect(() => {
    if (!user) return;
    
    const activityEvents = [
      'mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'
    ];
    
    const handleUserActivity = () => {
      if (showInactivityWarning) {
        setShowInactivityWarning(false);
      }
      resetInactivityTimer();
    };
    
    // Agregar event listeners para cada tipo de evento
    activityEvents.forEach(event => {
      window.addEventListener(event, handleUserActivity);
    });
    
    // Limpiar event listeners al desmontar
    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleUserActivity);
      });
      
      // Limpiar cualquier temporizador pendiente
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [user, showInactivityWarning]);

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Error al iniciar sesión");
      }
      return await res.json();
    },
    onSuccess: (data) => {
      console.log("[Auth] Login response:", data);
      
      // Detectar si requiere 2FA
      if (data.requiresTwoFactor) {
        console.log("[Auth] 2FA requerido, redirigiendo a verificación");
        toast({
          title: "Código de verificación enviado",
          description: data.message || "Revisa tu Telegram para el código de verificación",
        });
        // Redirigir a la página de verificación 2FA
        window.location.href = "/2fa-verify";
        return;
      }
      
      // Login exitoso completo
      console.log("[Auth] Login exitoso:", data);
      queryClient.setQueryData(["/api/user"], data);
      refetch();
      toast({
        title: "Inicio de sesión exitoso",
        description: "Bienvenido al panel de administración",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al iniciar sesión",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (userData: RegisterData) => {
      const res = await apiRequest("POST", "/api/register", userData);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Error al registrar usuario");
      }
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Registro completado",
        description: "Envía un mensaje a @BalonxSistema por Telegram para que active tu cuenta. Serás redirigido al inicio de sesión...",
        duration: 5000,
      });
      
      // Redirigir al login después de 3 segundos
      setTimeout(() => {
        // Triggering a re-render to switch to login tab
        window.dispatchEvent(new CustomEvent('switchToLogin'));
      }, 3000);
    },
    onError: (error: Error) => {
      toast({
        title: "Error al registrar usuario",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      toast({
        title: "Sesión cerrada",
        description: "Has cerrado sesión correctamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al cerrar sesión",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        isAdmin,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {/* Diálogo de advertencia de inactividad */}
      <Dialog open={showInactivityWarning} onOpenChange={setShowInactivityWarning}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-500">Advertencia de inactividad</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>Su sesión se cerrará automáticamente en 30 segundos debido a inactividad.</p>
            <p className="mt-2">¿Desea continuar en la sesión?</p>
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              variant="default" 
              onClick={() => {
                // Reiniciar el temporizador cuando el usuario confirma que quiere seguir
                setShowInactivityWarning(false);
                resetInactivityTimer();
              }}
            >
              Continuar sesión
            </Button>
            <Button 
              type="button" 
              variant="destructive"
              onClick={() => {
                logoutMutation.mutate();
                setShowInactivityWarning(false);
              }}
            >
              Cerrar sesión
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe ser usado dentro de un AuthProvider");
  }
  return context;
}