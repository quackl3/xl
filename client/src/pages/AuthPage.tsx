import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertTriangle, CheckCircle, MessageCircle, Info } from 'lucide-react';
import { useLocation } from 'wouter';
import { BotDetector } from '@/utils/botDetector';
import { HCaptcha, useHCaptcha } from '@/components/ReCaptcha';
import balonxLogo from '../assets/balonx_logo.png';

export default function AuthPage() {
  const { loginMutation, registerMutation, user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const [loginData, setLoginData] = useState({
    username: '',
    password: ''
  });
  
  const [registerData, setRegisterData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    telegramChatId: '',
    hasDiscountCode: false,
    discountCode: '',
    accountType: 'individual' // 'individual' o 'office'
  });
  
  const [executiveData, setExecutiveData] = useState({
    username: '',
    password: '',
    otpCode: '',
    requiresOtp: false
  });
  
  const [botDetection, setBotDetection] = useState({
    isBot: false,
    confidence: 0,
    reasons: [] as string[],
    showDetection: false
  });
  
  const [allowBotLogin, setAllowBotLogin] = useState(false);
  const [activeTab, setActiveTab] = useState("login");
  const { token: captchaToken, isVerified: captchaVerified, handleVerify: handleCaptchaVerify } = useHCaptcha();
  
  // Inicializar detector de bots
  useEffect(() => {
    BotDetector.initialize();
    
    // Verificar detección de bots cada 3 segundos
    const interval = setInterval(() => {
      const detection = BotDetector.detectBot();
      setBotDetection({
        ...detection,
        showDetection: detection.confidence > 30
      });
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Listener para cambiar a la pestaña de login después del registro
  useEffect(() => {
    const handleSwitchToLogin = () => {
      setActiveTab("login");
    };
    
    window.addEventListener('switchToLogin', handleSwitchToLogin);
    
    return () => {
      window.removeEventListener('switchToLogin', handleSwitchToLogin);
    };
  }, []);

  // Usar useEffect para el redireccionamiento cuando el usuario ya está autenticado
  useEffect(() => {
    if (user) {
      console.log('Usuario ya autenticado, redirigiendo al panel de administración');
      setLocation('/admin');
    }
  }, [user, setLocation]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!loginData.username || !loginData.password) {
      toast({
        title: "Error de validación",
        description: "Por favor ingresa todos los campos requeridos",
        variant: "destructive"
      });
      return;
    }
    
    if (!captchaVerified || !captchaToken) {
      toast({
        title: "Verificación requerida",
        description: "Por favor completa la verificación hCaptcha",
        variant: "destructive"
      });
      return;
    }
    
    // Verificar detección de bots antes del login
    const currentDetection = BotDetector.detectBot();
    
    if (currentDetection.isBot && !allowBotLogin) {
      toast({
        title: "Acceso denegado",
        description: `Se detectó comportamiento automatizado (${currentDetection.confidence}% confianza). Usa la opción de administrador para permitir bots.`,
        variant: "destructive"
      });
      
      // Mostrar detalles de la detección
      setBotDetection({
        ...currentDetection,
        showDetection: true
      });
      
      return;
    }
    
    // Registrar intento de login
    BotDetector.recordInteraction('login_attempt');
    
    // Agregar información de detección y hCaptcha al login
    const loginDataWithDetection = {
      ...loginData,
      botDetection: BotDetector.generateReport(),
      hcaptchaToken: captchaToken
    };
    
    loginMutation.mutate(loginDataWithDetection);
  };

  const handleExecutiveLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch("/api/executive/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ 
          username: executiveData.username, 
          password: executiveData.password 
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Error en el login");
      }

      const data = await response.json();

      if (data.requiresOtp) {
        setExecutiveData({ ...executiveData, requiresOtp: true });
        toast({
          title: "OTP Enviado",
          description: "Se ha enviado un código al Telegram de la oficina",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error de autenticación",
        description: error.message || "Credenciales inválidas",
        variant: "destructive",
      });
    }
  };

  const handleExecutiveOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch("/api/executive/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ otpCode: executiveData.otpCode }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Error en la verificación");
      }

      const data = await response.json();

      toast({
        title: "Acceso concedido",
        description: "Acceso concedido exitosamente",
      });

      // Ejecutivos van al mismo panel que el dueño de la oficina
      window.location.href = "/admin";
    } catch (error: any) {
      toast({
        title: "Error de verificación",
        description: error.message || "Código OTP inválido",
        variant: "destructive",
      });
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!registerData.username || !registerData.password || !registerData.telegramChatId) {
      toast({
        title: "Error de validación",
        description: "Por favor ingresa todos los campos requeridos, incluyendo tu Chat ID de Telegram",
        variant: "destructive"
      });
      return;
    }
    
    if (registerData.password !== registerData.confirmPassword) {
      toast({
        title: "Error de validación",
        description: "Las contraseñas no coinciden",
        variant: "destructive"
      });
      return;
    }
    
    registerMutation.mutate({
      username: registerData.username,
      password: registerData.password,
      telegramChatId: registerData.telegramChatId,
      discountCode: registerData.hasDiscountCode ? registerData.discountCode : undefined,
      accountType: registerData.accountType as 'individual' | 'office'
    });
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Logo */}
      <div className="hidden md:flex flex-col justify-center items-center w-1/2 bg-gradient-to-br from-blue-600 to-blue-800 p-10 text-white">
        <div className="max-w-md text-center">
          <img 
            src={balonxLogo} 
            alt="Balonx Logo" 
            className="w-64 h-64 mx-auto mb-8"
          />
        </div>
      </div>
      {/* Formularios */}
      <div className="w-full md:w-1/2 flex justify-center items-center p-5">
        <div className="w-full max-w-md">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="login">Iniciar Sesión</TabsTrigger>
              <TabsTrigger value="register">Registrar</TabsTrigger>
              <TabsTrigger value="executive">Ejecutivo</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Iniciar Sesión
                  </CardTitle>
                  <CardDescription>
                    Ingresa tus credenciales para acceder al panel de administración
                  </CardDescription>
                  
                  <Alert className="mt-4 border-red-500 bg-red-50 dark:bg-red-950">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800 dark:text-red-200">
                      <strong>⚠️ ¡No se dejen estafar!</strong> La única venta oficial es por Telegram con <strong>@balonxsistema</strong>
                    </AlertDescription>
                  </Alert>
                  
                  {/* Indicador de detección de bots */}
                  {botDetection.showDetection && (
                    <Alert className={botDetection.isBot ? "border-red-500" : "border-yellow-500"}>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="flex items-center justify-between">
                          <span>
                            {botDetection.isBot ? "Bot detectado" : "Comportamiento sospechoso"} 
                            ({botDetection.confidence}% confianza)
                          </span>
                          <Badge variant={botDetection.isBot ? "destructive" : "secondary"}>
                            {botDetection.isBot ? "BOT" : "SOSPECHOSO"}
                          </Badge>
                        </div>
                        {botDetection.reasons.length > 0 && (
                          <ul className="mt-2 text-xs">
                            {botDetection.reasons.map((reason, index) => (
                              <li key={index}>• {reason}</li>
                            ))}
                          </ul>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {/* Opción para permitir bots (solo para administradores) */}
                  {botDetection.isBot && (
                    <div className="flex items-center space-x-2 p-3 bg-yellow-50 rounded-lg">
                      <input
                        type="checkbox"
                        id="allowBot"
                        checked={allowBotLogin}
                        onChange={(e) => setAllowBotLogin(e.target.checked)}
                        className="rounded"
                      />
                      <Label htmlFor="allowBot" className="text-sm">
                        Permitir acceso de bots (Solo administradores)
                      </Label>
                    </div>
                  )}
                </CardHeader>
                <form onSubmit={handleLoginSubmit}>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-username">Usuario</Label>
                      <Input 
                        id="login-username" 
                        type="text" 
                        value={loginData.username} 
                        onChange={e => {
                          setLoginData({...loginData, username: e.target.value});
                          BotDetector.recordInteraction('username_input');
                        }}
                        onFocus={() => BotDetector.recordInteraction('username_focus')}
                        placeholder="Nombre de usuario"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Contraseña</Label>
                      <Input 
                        id="login-password" 
                        type="password" 
                        value={loginData.password} 
                        onChange={e => {
                          setLoginData({...loginData, password: e.target.value});
                          BotDetector.recordInteraction('password_input');
                        }}
                        onFocus={() => BotDetector.recordInteraction('password_focus')}
                        placeholder="Contraseña"
                      />
                    </div>
                    
                    {/* Componente de hCaptcha */}
                    <HCaptcha 
                      onVerify={handleCaptchaVerify}
                      disabled={loginMutation.isPending}
                    />
                  </CardContent>
                  <CardFooter className="flex flex-col space-y-2">
                    <Button 
                      type="submit" 
                      className={`w-full ${
                        (botDetection.isBot && !allowBotLogin) || !captchaVerified 
                          ? 'bg-red-600 hover:bg-red-700' 
                          : captchaVerified 
                          ? 'bg-green-600 hover:bg-green-700' 
                          : ''
                      }`}
                      disabled={
                        loginMutation.isPending || 
                        (botDetection.isBot && !allowBotLogin) ||
                        !captchaVerified
                      }
                      onClick={() => BotDetector.recordInteraction('login_button_click')}
                    >
                      {loginMutation.isPending ? "Procesando..." : 
                       botDetection.isBot && !allowBotLogin ? "Bot Bloqueado" :
                       !captchaVerified ? "Complete hCaptcha" :
                       "Iniciar Sesión"}
                    </Button>
                    
                    {/* Indicador de estado de detección y verificación */}
                    <div className="flex flex-col items-center space-y-1 text-xs text-gray-500">
                      <div className="flex items-center space-x-2">
                        {botDetection.confidence < 30 ? (
                          <>
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            <span>Comportamiento humano detectado</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-3 w-3 text-yellow-500" />
                            <span>Monitoreando comportamiento...</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {captchaVerified ? (
                          <>
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            <span>hCaptcha verificado</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-3 w-3 text-orange-500" />
                            <span>Esperando verificación hCaptcha</span>
                          </>
                        )}
                      </div>
                    </div>
                  </CardFooter>
                </form>
              </Card>
            </TabsContent>
            
            <TabsContent value="register">
              <Card>
                <CardHeader>
                  <CardTitle>Registrar Usuario</CardTitle>
                  <CardDescription>
                    Crea una nueva cuenta para acceder al sistema
                  </CardDescription>
                  <Alert className="mt-4 border-red-500 bg-red-50 dark:bg-red-950">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800 dark:text-red-200">
                      <strong>⚠️ ¡No se dejen estafar!</strong> La única venta oficial es por Telegram con <strong>@balonxsistema</strong>
                    </AlertDescription>
                  </Alert>
                </CardHeader>
                <form onSubmit={handleRegisterSubmit}>
                  <CardContent className="space-y-4">
                    {/* Tabs para tipo de cuenta */}
                    <div className="space-y-3">
                      <Label className="text-base font-semibold">Tipo de Cuenta</Label>
                      <Tabs 
                        value={registerData.accountType} 
                        onValueChange={(value) => setRegisterData({...registerData, accountType: value})}
                        className="w-full"
                      >
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="individual" data-testid="tab-account-individual">
                            Usuario Individual
                          </TabsTrigger>
                          <TabsTrigger value="office" data-testid="tab-account-office">
                            Oficina
                          </TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="individual" className="mt-3">
                          <Alert className="border-blue-500">
                            <Info className="h-4 w-4 text-blue-600" />
                            <AlertDescription className="text-sm">
                              <strong>Cuenta Individual</strong><br/>
                              • Máximo 2 dispositivos<br/>
                              • Precio: <strong>3,000 MXN / semana</strong><br/>
                              • Ideal para uso personal
                            </AlertDescription>
                          </Alert>
                        </TabsContent>
                        
                        <TabsContent value="office" className="mt-3">
                          <Alert className="border-purple-500">
                            <Info className="h-4 w-4 text-purple-600" />
                            <AlertDescription className="text-sm">
                              <strong>Cuenta Oficina</strong><br/>
                              • Hasta 8 ejecutivos<br/>
                              • 1 sesión activa por ejecutivo<br/>
                              • OTP por Telegram para ejecutivos<br/>
                              • Precio: <strong>6,000 MXN / semana</strong><br/>
                              • Ideal para equipos
                            </AlertDescription>
                          </Alert>
                        </TabsContent>
                      </Tabs>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="register-username">Usuario</Label>
                      <Input 
                        id="register-username" 
                        type="text" 
                        value={registerData.username} 
                        onChange={e => setRegisterData({...registerData, username: e.target.value})}
                        placeholder="Nombre de usuario"
                        data-testid="input-register-username"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-password">Contraseña</Label>
                      <Input 
                        id="register-password" 
                        type="password" 
                        value={registerData.password} 
                        onChange={e => setRegisterData({...registerData, password: e.target.value})}
                        placeholder="Contraseña"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-confirm-password">Confirmar Contraseña</Label>
                      <Input 
                        id="register-confirm-password" 
                        type="password" 
                        value={registerData.confirmPassword} 
                        onChange={e => setRegisterData({...registerData, confirmPassword: e.target.value})}
                        placeholder="Confirmar contraseña"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-telegram-chat-id" className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4" />
                        Chat ID de Telegram
                      </Label>
                      <Input 
                        id="register-telegram-chat-id" 
                        type="text" 
                        value={registerData.telegramChatId} 
                        onChange={e => setRegisterData({...registerData, telegramChatId: e.target.value})}
                        placeholder="Tu Chat ID de Telegram"
                      />
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          <strong>¿Cómo obtener tu Chat ID?</strong><br/>
                          <strong>Opción 1 (Recomendada):</strong><br/>
                          1. Busca nuestro bot en Telegram<br/>
                          2. Envía el comando /start<br/>
                          3. El bot te dará tu Chat ID directamente<br/>
                          <strong>Opción 2:</strong><br/>
                          1. Abre Telegram y busca el bot "@userinfobot"<br/>
                          2. Envía /start y copia el número que te proporciona<br/>
                          <br/>
                          <strong>Nota:</strong> Necesitas este Chat ID para recibir códigos 2FA
                        </AlertDescription>
                      </Alert>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        ¿Tienes un código de descuento?
                      </Label>
                      <div className="flex gap-4">
                        <button
                          type="button"
                          onClick={() => setRegisterData({...registerData, hasDiscountCode: true})}
                          className={`px-4 py-2 rounded-md transition-colors ${
                            registerData.hasDiscountCode 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          Sí
                        </button>
                        <button
                          type="button"
                          onClick={() => setRegisterData({...registerData, hasDiscountCode: false, discountCode: ''})}
                          className={`px-4 py-2 rounded-md transition-colors ${
                            !registerData.hasDiscountCode 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          No
                        </button>
                      </div>
                    </div>
                    
                    {registerData.hasDiscountCode && (
                      <div className="space-y-2">
                        <Label htmlFor="register-discount-code">Código de descuento</Label>
                        <Input 
                          id="register-discount-code" 
                          type="text" 
                          value={registerData.discountCode} 
                          onChange={e => setRegisterData({...registerData, discountCode: e.target.value.toUpperCase()})}
                          placeholder="Ingresa tu código"
                          className="uppercase"
                        />
                      </div>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={registerMutation.isPending}
                    >
                      {registerMutation.isPending ? "Procesando..." : "Registrar"}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </TabsContent>
            
            <TabsContent value="executive">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    {executiveData.requiresOtp ? "Verificación OTP" : "Acceso Ejecutivo"}
                  </CardTitle>
                  <CardDescription>
                    {executiveData.requiresOtp 
                      ? "Ingresa el código OTP enviado al Telegram de la oficina" 
                      : "Ingresa tus credenciales de ejecutivo"}
                  </CardDescription>
                </CardHeader>
                
                {!executiveData.requiresOtp ? (
                  <form onSubmit={handleExecutiveLogin}>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="executive-username">Usuario</Label>
                        <Input 
                          id="executive-username" 
                          data-testid="input-executive-username"
                          type="text" 
                          value={executiveData.username} 
                          onChange={(e) => setExecutiveData({...executiveData, username: e.target.value})}
                          placeholder="usuario_ejecutivo"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="executive-password">Contraseña</Label>
                        <Input 
                          id="executive-password" 
                          data-testid="input-executive-password"
                          type="password" 
                          value={executiveData.password} 
                          onChange={(e) => setExecutiveData({...executiveData, password: e.target.value})}
                          placeholder="••••••••"
                          required
                        />
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button 
                        type="submit" 
                        data-testid="button-executive-login"
                        className="w-full"
                      >
                        Iniciar Sesión
                      </Button>
                    </CardFooter>
                  </form>
                ) : (
                  <form onSubmit={handleExecutiveOtpVerify}>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="executive-otp">Código OTP</Label>
                        <Input 
                          id="executive-otp" 
                          data-testid="input-executive-otp"
                          type="text" 
                          value={executiveData.otpCode} 
                          onChange={(e) => setExecutiveData({...executiveData, otpCode: e.target.value})}
                          placeholder="123456"
                          required
                          maxLength={6}
                          className="text-center text-2xl tracking-widest"
                        />
                      </div>
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription className="text-sm">
                          El código OTP fue enviado al Telegram del dueño de la oficina. Solicítalo para continuar.
                        </AlertDescription>
                      </Alert>
                    </CardContent>
                    <CardFooter className="flex flex-col space-y-2">
                      <Button 
                        type="submit" 
                        data-testid="button-verify-executive-otp"
                        className="w-full"
                      >
                        Verificar OTP
                      </Button>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        className="w-full"
                        onClick={() => setExecutiveData({...executiveData, requiresOtp: false, otpCode: ''})}
                      >
                        Volver
                      </Button>
                    </CardFooter>
                  </form>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}