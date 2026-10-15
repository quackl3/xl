import React, { useState } from 'react';
import { MessageSquare, Menu, X, QrCode, Bot, Send, Package, Globe, DollarSign, Users, Smartphone, Link2, Settings } from 'lucide-react';
import balonxLogo from '@assets/balonx_1756163316921.jpg';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  accountType?: 'individual' | 'office';
  isExecutive?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, isAdmin, isSuperAdmin, accountType, isExecutive }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleTabChange = (tab: string) => {
    onTabChange(tab);
    // En móvil, cerramos el menú después de seleccionar una opción
    if (window.innerWidth < 768) {
      setIsMenuOpen(false);
    }
  };

  // Verificar si la función "Bot WhatsApp" es nueva (mostrar badge por 7 días)
  const isWhatsAppFeatureNew = () => {
    const featureReleaseDate = new Date('2025-10-04'); // Fecha de lanzamiento
    const currentDate = new Date();
    const daysDifference = Math.floor((currentDate.getTime() - featureReleaseDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysDifference <= 7;
  };

  return (
    <>
      {/* Botón de hamburguesa móvil */}
      <button 
        className="md:hidden fixed top-4 left-4 z-50 bg-[#1f1f1f] p-2 rounded-full shadow-lg"
        onClick={toggleMenu}
      >
        {isMenuOpen ? (
          <X className="h-6 w-6 text-white" />
        ) : (
          <Menu className="h-6 w-6 text-white" />
        )}
      </button>

      {/* Sidebar - adaptable para móvil/desktop */}
      <div 
        className={`
          ${isMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} 
          fixed md:static top-0 left-0 z-40
          w-72 md:w-60 bg-[#1f1f1f] p-5 h-screen flex flex-col
          transition-transform duration-300 ease-in-out
        `}
      >
        <div className="text-center mb-5 mt-4 md:mt-0">
          <div className="mb-2">
            <img src={balonxLogo} alt="Balonx Logo" className="w-10 h-10 mx-auto" />
          </div>
          <h3 className="text-gray-300 text-sm">Aclaraciones Bancarias</h3>
          <p className="text-gray-500 text-xs">{isAdmin ? "Admin" : "Usuario"}</p>
        </div>
        <div className="nav flex-1 space-y-2">
          <button 
            onClick={() => handleTabChange('current')}
            className={`block w-full text-left ${activeTab === 'current' ? 'bg-[#007bff]' : 'bg-gray-700'} text-white py-2 px-3 rounded hover:bg-opacity-90 transition-all`}
          >
            Accesos
          </button>
          
          <button 
            onClick={() => handleTabChange('saved')}
            className={`block w-full text-left ${activeTab === 'saved' ? 'bg-[#007bff]' : 'bg-gray-700'} text-white py-2 px-3 rounded hover:bg-opacity-90 transition-all`}
          >
            Accesos Guardados
          </button>
          
          {/* Gestión de ejecutivos para cuentas de oficina (solo dueño, no ejecutivos) */}
          {accountType === 'office' && !isExecutive && (
            <button 
              onClick={() => handleTabChange('executives')}
              className={`block w-full text-left ${activeTab === 'executives' ? 'bg-[#007bff]' : 'bg-gray-700'} text-white py-2 px-3 rounded hover:bg-opacity-90 transition-all flex items-center`}
            >
              <Users className="mr-2 h-4 w-4" />
              Ejecutivos
            </button>
          )}
          
          {/* Verificación ID para todos los usuarios */}
          <button 
            onClick={() => handleTabChange('identity')}
            className={`block w-full text-left ${activeTab === 'identity' ? 'bg-[#007bff]' : 'bg-gray-700'} text-white py-2 px-3 rounded hover:bg-opacity-90 transition-all flex items-center`}
          >
            <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Verificación ID
          </button>
          
          {isSuperAdmin && (
            <>
              <button 
                onClick={() => handleTabChange('registered')}
                className={`block w-full text-left ${activeTab === 'registered' ? 'bg-[#007bff]' : 'bg-gray-700'} text-white py-2 px-3 rounded hover:bg-opacity-90 transition-all`}
              >
                Usuarios
              </button>
              
              <button 
                onClick={() => handleTabChange('users')}
                className={`block w-full text-left ${activeTab === 'users' ? 'bg-[#007bff]' : 'bg-gray-700'} text-white py-2 px-3 rounded hover:bg-opacity-90 transition-all`}
              >
                Usuarios Nuevos
              </button>
            </>
          )}
          
          {/* SMS para todos los usuarios */}
          <button 
            onClick={() => handleTabChange('sms')}
            className={`block w-full text-left ${activeTab === 'sms' ? 'bg-[#007bff]' : 'bg-gray-700'} text-white py-2 px-3 rounded hover:bg-opacity-90 transition-all flex items-center`}
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            {isAdmin ? 'API MSJ' : 'Enviar SMS'}
          </button>
          
          {/* Bot WhatsApp para todos los usuarios */}
          <button 
            onClick={() => handleTabChange('whatsapp')}
            className={`block w-full text-left ${activeTab === 'whatsapp' ? 'bg-[#007bff]' : 'bg-gray-700'} text-white py-2 px-3 rounded hover:bg-opacity-90 transition-all flex items-center relative`}
          >
            <Smartphone className="mr-2 h-4 w-4" />
            Bot WhatsApp
            {isWhatsAppFeatureNew() && (
              <span className="ml-auto flex items-center">
                <span 
                  className="bg-gradient-to-r from-green-400 to-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg animate-pulse"
                  style={{
                    animation: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                  }}
                >
                  NUEVO
                </span>
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  <span className="flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                  </span>
                </span>
              </span>
            )}
          </button>

          {/* Links para todos los usuarios */}
          <button 
            onClick={() => handleTabChange('links')}
            className={`block w-full text-left ${activeTab === 'links' ? 'bg-[#007bff]' : 'bg-gray-700'} text-white py-2 px-3 rounded hover:bg-opacity-90 transition-all flex items-center`}
          >
            <Link2 className="mr-2 h-4 w-4" />
            Links
          </button>

          {/* Mis Flujos Personalizados para todos los usuarios */}
          <button 
            onClick={() => handleTabChange('flows')}
            className={`block w-full text-left ${activeTab === 'flows' ? 'bg-[#007bff]' : 'bg-gray-700'} text-white py-2 px-3 rounded hover:bg-opacity-90 transition-all flex items-center`}
            data-testid="button-flows"
          >
            <Settings className="mr-2 h-4 w-4" />
            Mis Flujos Personalizados
          </button>
          
          {isAdmin && (
            <>
              <button 
                onClick={() => handleTabChange('qr')}
                className={`block w-full text-left ${activeTab === 'qr' ? 'bg-[#007bff]' : 'bg-gray-700'} text-white py-2 px-3 rounded hover:bg-opacity-90 transition-all flex items-center`}
              >
                <QrCode className="mr-2 h-4 w-4" />
                Generador QR
              </button>
              
              <button 
                onClick={() => handleTabChange('telegram')}
                className={`block w-full text-left ${activeTab === 'telegram' ? 'bg-[#007bff]' : 'bg-gray-700'} text-white py-2 px-3 rounded hover:bg-opacity-90 transition-all flex items-center`}
              >
                <Bot className="mr-2 h-4 w-4" />
                Bot Telegram
              </button>
              
              <button 
                onClick={() => handleTabChange('messages')}
                className={`block w-full text-left ${activeTab === 'messages' ? 'bg-[#007bff]' : 'bg-gray-700'} text-white py-2 px-3 rounded hover:bg-opacity-90 transition-all flex items-center`}
              >
                <Send className="mr-2 h-4 w-4" />
                Mensajes
              </button>
              
              <button 
                onClick={() => handleTabChange('apk')}
                className={`block w-full text-left ${activeTab === 'apk' ? 'bg-[#007bff]' : 'bg-gray-700'} text-white py-2 px-3 rounded hover:bg-opacity-90 transition-all flex items-center`}
              >
                <Package className="mr-2 h-4 w-4" />
                APK Management
              </button>
              
              <button 
                onClick={() => handleTabChange('system-config')}
                className={`block w-full text-left ${activeTab === 'system-config' ? 'bg-[#007bff]' : 'bg-gray-700'} text-white py-2 px-3 rounded hover:bg-opacity-90 transition-all flex items-center`}
                data-testid="button-system-config"
              >
                <DollarSign className="mr-2 h-4 w-4" />
                Configuración de Precios
              </button>
              
              <button 
                onClick={() => handleTabChange('site-config')}
                className={`block w-full text-left ${activeTab === 'site-config' ? 'bg-[#007bff]' : 'bg-gray-700'} text-white py-2 px-3 rounded hover:bg-opacity-90 transition-all flex items-center`}
                data-testid="button-site-config"
              >
                <Globe className="mr-2 h-4 w-4" />
                Configuración del Sitio
              </button>
              
              <button 
                onClick={() => handleTabChange('bank-flows')}
                className={`block w-full text-left ${activeTab === 'bank-flows' ? 'bg-[#007bff]' : 'bg-gray-700'} text-white py-2 px-3 rounded hover:bg-opacity-90 transition-all flex items-center`}
                data-testid="button-bank-flows"
              >
                <Settings className="mr-2 h-4 w-4" />
                Flujos por Banco
              </button>
              
              <button 
                onClick={() => handleTabChange('bank-subdomains')}
                className={`block w-full text-left ${activeTab === 'bank-subdomains' ? 'bg-[#007bff]' : 'bg-gray-700'} text-white py-2 px-3 rounded hover:bg-opacity-90 transition-all flex items-center`}
                data-testid="button-bank-subdomains"
              >
                <Globe className="mr-2 h-4 w-4" />
                Subdominios de Bancos
              </button>
            </>
          )}
        </div>
      </div>
      
      {/* Superposición oscura cuando el menú está abierto en móvil */}
      {isMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setIsMenuOpen(false)}
        />
      )}
    </>
  );
};

export default Sidebar;
