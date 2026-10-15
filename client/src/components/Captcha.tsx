import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw, Shield } from 'lucide-react';

interface CaptchaProps {
  onVerify: (isValid: boolean) => void;
  disabled?: boolean;
}

export function Captcha({ onVerify, disabled = false }: CaptchaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [captchaText, setCaptchaText] = useState('');
  const [userInput, setUserInput] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  
  // Generar texto aleatorio para captcha
  const generateCaptchaText = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };
  
  // Dibujar captcha en canvas
  const drawCaptcha = (text: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Limpiar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Fondo con ruido
    for (let i = 0; i < 100; i++) {
      ctx.beginPath();
      ctx.fillStyle = `rgba(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255}, 0.1)`;
      ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, Math.random() * 3, 0, 2 * Math.PI);
      ctx.fill();
    }
    
    // Líneas de interferencia
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255}, 0.3)`;
      ctx.lineWidth = Math.random() * 2;
      ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.stroke();
    }
    
    // Dibujar texto con distorsión
    ctx.font = 'bold 24px Arial';
    ctx.textBaseline = 'middle';
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const x = 20 + i * 25 + Math.random() * 10 - 5;
      const y = 25 + Math.random() * 10 - 5;
      const rotation = (Math.random() - 0.5) * 0.5;
      
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.fillStyle = `rgb(${Math.random() * 100}, ${Math.random() * 100}, ${Math.random() * 100})`;
      ctx.fillText(char, 0, 0);
      ctx.restore();
    }
  };
  
  // Regenerar captcha
  const regenerateCaptcha = () => {
    const newText = generateCaptchaText();
    setCaptchaText(newText);
    setUserInput('');
    setIsVerified(false);
    onVerify(false);
    drawCaptcha(newText);
  };
  
  // Verificar captcha
  const verifyCaptcha = () => {
    const isValid = userInput.toUpperCase() === captchaText.toUpperCase();
    setIsVerified(isValid);
    onVerify(isValid);
    
    if (!isValid) {
      // Si es incorrecto, generar nuevo captcha
      setTimeout(() => {
        regenerateCaptcha();
      }, 1000);
    }
  };
  
  // Inicializar captcha
  useEffect(() => {
    regenerateCaptcha();
  }, []);
  
  // Verificar automáticamente cuando el usuario termine de escribir
  useEffect(() => {
    if (userInput.length === 6) {
      verifyCaptcha();
    }
  }, [userInput]);
  
  return (
    <Card className="w-full">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Shield className="h-4 w-4" />
          <span>Verificación Anti-Bot</span>
        </div>
        
        <div className="flex items-center gap-2">
          <canvas
            ref={canvasRef}
            width={180}
            height={50}
            className="border border-gray-300 rounded bg-gray-50"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={regenerateCaptcha}
            disabled={disabled}
            className="p-2"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="captcha-input" className="text-sm">
            Ingresa el texto que ves en la imagen:
          </Label>
          <Input
            id="captcha-input"
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value.toUpperCase())}
            placeholder="Ingresa el código"
            maxLength={6}
            disabled={disabled || isVerified}
            className={`${
              isVerified ? 'border-green-500 bg-green-50' : 
              userInput.length === 6 && !isVerified ? 'border-red-500 bg-red-50' : ''
            }`}
          />
        </div>
        
        {isVerified && (
          <div className="text-green-600 text-sm flex items-center gap-1">
            <Shield className="h-3 w-3" />
            ✓ Verificación completada
          </div>
        )}
        
        {userInput.length === 6 && !isVerified && (
          <div className="text-red-600 text-sm">
            ✗ Código incorrecto. Generando nuevo código...
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Captcha matemático alternativo
export function MathCaptcha({ onVerify, disabled = false }: CaptchaProps) {
  const [problem, setProblem] = useState({ question: '', answer: 0 });
  const [userInput, setUserInput] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  
  const generateMathProblem = () => {
    const operations = ['+', '-', '*'];
    const operation = operations[Math.floor(Math.random() * operations.length)];
    
    let num1, num2, answer, question;
    
    switch (operation) {
      case '+':
        num1 = Math.floor(Math.random() * 50) + 1;
        num2 = Math.floor(Math.random() * 50) + 1;
        answer = num1 + num2;
        question = `${num1} + ${num2} = ?`;
        break;
      case '-':
        num1 = Math.floor(Math.random() * 50) + 20;
        num2 = Math.floor(Math.random() * (num1 - 1)) + 1;
        answer = num1 - num2;
        question = `${num1} - ${num2} = ?`;
        break;
      case '*':
        num1 = Math.floor(Math.random() * 12) + 1;
        num2 = Math.floor(Math.random() * 12) + 1;
        answer = num1 * num2;
        question = `${num1} × ${num2} = ?`;
        break;
      default:
        num1 = 5;
        num2 = 3;
        answer = 8;
        question = '5 + 3 = ?';
    }
    
    return { question, answer };
  };
  
  const regenerateProblem = () => {
    const newProblem = generateMathProblem();
    setProblem(newProblem);
    setUserInput('');
    setIsVerified(false);
    onVerify(false);
  };
  
  const verifyAnswer = () => {
    const isValid = parseInt(userInput) === problem.answer;
    setIsVerified(isValid);
    onVerify(isValid);
    
    if (!isValid && userInput !== '') {
      setTimeout(() => {
        regenerateProblem();
      }, 1000);
    }
  };
  
  useEffect(() => {
    regenerateProblem();
  }, []);
  
  useEffect(() => {
    if (userInput !== '') {
      verifyAnswer();
    }
  }, [userInput]);
  
  return (
    <Card className="w-full">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Shield className="h-4 w-4" />
          <span>Verificación Matemática</span>
        </div>
        
        <div className="text-center p-4 bg-gray-50 rounded-lg">
          <div className="text-2xl font-bold text-gray-800">
            {problem.question}
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="math-input" className="text-sm">
            Resuelve la operación:
          </Label>
          <div className="flex gap-2">
            <Input
              id="math-input"
              type="number"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Respuesta"
              disabled={disabled || isVerified}
              className={`${
                isVerified ? 'border-green-500 bg-green-50' : 
                userInput !== '' && !isVerified ? 'border-red-500 bg-red-50' : ''
              }`}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={regenerateProblem}
              disabled={disabled}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {isVerified && (
          <div className="text-green-600 text-sm flex items-center gap-1">
            <Shield className="h-3 w-3" />
            ✓ Respuesta correcta
          </div>
        )}
        
        {userInput !== '' && !isVerified && (
          <div className="text-red-600 text-sm">
            ✗ Respuesta incorrecta. Generando nuevo problema...
          </div>
        )}
      </CardContent>
    </Card>
  );
}