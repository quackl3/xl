import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, MessageCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface VerifyResponse {
  id: number;
  username: string;
  role: string;
  isActive: boolean;
}

export default function TwoFactorVerification() {
  const [code, setCode] = useState("");
  const [, setLocation] = useLocation();

  const verifyMutation = useMutation({
    mutationFn: async (code: string): Promise<VerifyResponse> => {
      const response = await apiRequest("POST", "/api/verify-2fa", { code });
      return await response.json();
    },
    onSuccess: (data) => {
      console.log("[2FA] Verificación exitosa:", data);
      
      // Actualizar el cache del usuario autenticado
      queryClient.setQueryData(["/api/user"], data);
      
      // Invalidar queries para forzar una recarga
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      
      // Redirigir automáticamente al panel según el rol del usuario
      if (data.role === "admin") {
        setLocation("/admin");
      } else {
        setLocation("/panel");
      }
    },
    onError: (error: any) => {
      console.error("[2FA] Error en verificación:", error);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length === 6) {
      verifyMutation.mutate(code.trim());
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
    setCode(value);
    
    // Envío automático cuando se completan los 6 dígitos
    if (value.length === 6) {
      setTimeout(() => {
        verifyMutation.mutate(value);
      }, 500); // Pequeño delay para mejor UX
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 rounded-full bg-blue-100">
              <Lock className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            Verificación de Dos Factores
          </CardTitle>
          <CardDescription className="text-center">
            Ingresa el código de 6 dígitos enviado a tu Telegram
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Código de Verificación</Label>
              <Input
                id="code"
                type="text"
                placeholder="123456"
                value={code}
                onChange={handleCodeChange}
                className="text-center text-2xl font-mono tracking-widest"
                maxLength={6}
                autoComplete="off"
                autoFocus
              />
            </div>

            {verifyMutation.error && (
              <Alert className="border-red-200 bg-red-50">
                <AlertDescription className="text-red-700">
                  {verifyMutation.error?.message || "Código inválido. Intenta nuevamente."}
                </AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={code.length !== 6 || verifyMutation.isPending}
            >
              {verifyMutation.isPending ? "Verificando..." : "Verificar Código"}
            </Button>

            <div className="text-center text-sm text-gray-600">
              <div className="flex items-center justify-center gap-2 mb-2">
                <MessageCircle className="h-4 w-4" />
                <span>Código enviado por Telegram</span>
              </div>
              <p>¿No recibiste el código? Revisa tu chat de Telegram</p>
              <p className="mt-1">Soporte: @BalonxSistema</p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}