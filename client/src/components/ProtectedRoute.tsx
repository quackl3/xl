import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";

interface ProtectedRouteProps {
  path: string;
  component: React.ComponentType;
  adminOnly?: boolean;
  superAdminOnly?: boolean; // Solo para el usuario balonx (superadmin)
}

export function ProtectedRoute({
  path,
  component: Component,
  adminOnly = false,
  superAdminOnly = false,
}: ProtectedRouteProps) {
  const { user, isLoading, isAdmin } = useAuth();
  
  // Comprobar si el usuario es el superadministrador (balonx)
  const isSuperAdmin = user?.username === 'balonx' && user?.role === 'admin';

  return (
    <Route path={path}>
      {() => {
        if (isLoading) {
          return (
            <div className="flex items-center justify-center min-h-screen">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          );
        }

        if (!user) {
          return <Redirect to="/auth" />;
        }

        // Verificar permisos de administrador general
        if (adminOnly && !isAdmin) {
          return (
            <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
              <h1 className="text-2xl font-bold text-red-500">Acceso denegado</h1>
              <p className="text-gray-600">No tienes permisos de administrador para acceder a esta página.</p>
            </div>
          );
        }
        
        // Verificar si la ruta es solo para super administrador (balonx)
        if (superAdminOnly && !isSuperAdmin) {
          return (
            <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
              <h1 className="text-2xl font-bold text-red-500">Acceso denegado</h1>
              <p className="text-gray-600">Esta sección es exclusiva para el administrador principal.</p>
            </div>
          );
        }

        return <Component />;
      }}
    </Route>
  );
}