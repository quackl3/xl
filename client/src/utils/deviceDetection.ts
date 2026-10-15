export interface DeviceInfo {
  type: 'Android' | 'iPhone' | 'PC';
  model: string;
  browser: string;
  os: string;
  userAgent: string;
}

export function detectDevice(): DeviceInfo {
  const userAgent = navigator.userAgent;
  let type: 'Android' | 'iPhone' | 'PC' = 'PC';
  let model = 'Desconocido';
  let browser = 'Desconocido';
  let os = 'Desconocido';

  // Detectar tipo de dispositivo y OS
  if (/Android/i.test(userAgent)) {
    type = 'Android';
    os = 'Android';
    
    // Detectar modelos específicos de Android
    const androidModels = [
      { pattern: /SM-G998B/i, name: 'Samsung Galaxy S21 Ultra' },
      { pattern: /SM-G996B/i, name: 'Samsung Galaxy S21+' },
      { pattern: /SM-G991B/i, name: 'Samsung Galaxy S21' },
      { pattern: /SM-G988B/i, name: 'Samsung Galaxy S20 Ultra' },
      { pattern: /SM-G985F/i, name: 'Samsung Galaxy S20+' },
      { pattern: /SM-G981B/i, name: 'Samsung Galaxy S20' },
      { pattern: /SM-N986B/i, name: 'Samsung Galaxy Note 20 Ultra' },
      { pattern: /SM-N981B/i, name: 'Samsung Galaxy Note 20' },
      { pattern: /SM-A536B/i, name: 'Samsung Galaxy A53' },
      { pattern: /SM-A525F/i, name: 'Samsung Galaxy A52' },
      { pattern: /SM-A515F/i, name: 'Samsung Galaxy A51' },
      { pattern: /Pixel 7 Pro/i, name: 'Google Pixel 7 Pro' },
      { pattern: /Pixel 7/i, name: 'Google Pixel 7' },
      { pattern: /Pixel 6 Pro/i, name: 'Google Pixel 6 Pro' },
      { pattern: /Pixel 6/i, name: 'Google Pixel 6' },
      { pattern: /Pixel 5/i, name: 'Google Pixel 5' },
      { pattern: /Pixel 4a/i, name: 'Google Pixel 4a' },
      { pattern: /OnePlus/i, name: 'OnePlus' },
      { pattern: /Xiaomi/i, name: 'Xiaomi' },
      { pattern: /Redmi/i, name: 'Xiaomi Redmi' },
      { pattern: /HUAWEI/i, name: 'Huawei' },
      { pattern: /LG-/i, name: 'LG' },
      { pattern: /Moto/i, name: 'Motorola' },
    ];

    for (const androidModel of androidModels) {
      if (androidModel.pattern.test(userAgent)) {
        model = androidModel.name;
        break;
      }
    }

    if (model === 'Desconocido') {
      // Intentar extraer modelo genérico
      const match = userAgent.match(/Android.*?;\s*([^)]+)/);
      if (match) {
        model = `Android ${match[1].trim()}`;
      } else {
        model = 'Android Desconocido';
      }
    }

  } else if (/iPhone/i.test(userAgent)) {
    type = 'iPhone';
    os = 'iOS';
    
    // Detectar modelos específicos de iPhone
    const iphoneModels = [
      { pattern: /iPhone15,3/i, name: 'iPhone 14 Pro Max' },
      { pattern: /iPhone15,2/i, name: 'iPhone 14 Pro' },
      { pattern: /iPhone14,8/i, name: 'iPhone 14 Plus' },
      { pattern: /iPhone14,7/i, name: 'iPhone 14' },
      { pattern: /iPhone14,3/i, name: 'iPhone 13 Pro Max' },
      { pattern: /iPhone14,2/i, name: 'iPhone 13 Pro' },
      { pattern: /iPhone14,5/i, name: 'iPhone 13' },
      { pattern: /iPhone14,4/i, name: 'iPhone 13 mini' },
      { pattern: /iPhone13,4/i, name: 'iPhone 12 Pro Max' },
      { pattern: /iPhone13,3/i, name: 'iPhone 12 Pro' },
      { pattern: /iPhone13,2/i, name: 'iPhone 12' },
      { pattern: /iPhone13,1/i, name: 'iPhone 12 mini' },
      { pattern: /iPhone12,8/i, name: 'iPhone SE (2020)' },
      { pattern: /iPhone12,5/i, name: 'iPhone 11 Pro Max' },
      { pattern: /iPhone12,3/i, name: 'iPhone 11 Pro' },
      { pattern: /iPhone12,1/i, name: 'iPhone 11' },
      { pattern: /iPhone11,8/i, name: 'iPhone XR' },
      { pattern: /iPhone11,6/i, name: 'iPhone XS Max' },
      { pattern: /iPhone11,2/i, name: 'iPhone XS' },
      { pattern: /iPhone10,6/i, name: 'iPhone X' },
      { pattern: /iPhone10,5/i, name: 'iPhone 8 Plus' },
      { pattern: /iPhone10,4/i, name: 'iPhone 8' },
      { pattern: /iPhone9,4/i, name: 'iPhone 7 Plus' },
      { pattern: /iPhone9,3/i, name: 'iPhone 7' },
    ];

    for (const iphoneModel of iphoneModels) {
      if (iphoneModel.pattern.test(userAgent)) {
        model = iphoneModel.name;
        break;
      }
    }

    if (model === 'Desconocido') {
      // Intentar extraer versión de iOS
      const iosMatch = userAgent.match(/OS (\d+_\d+)/);
      if (iosMatch) {
        const iosVersion = iosMatch[1].replace('_', '.');
        model = `iPhone (iOS ${iosVersion})`;
      } else {
        model = 'iPhone Desconocido';
      }
    }

  } else if (/iPad/i.test(userAgent)) {
    type = 'iPhone'; // Consideramos iPad como iOS
    os = 'iPadOS';
    
    const ipadModels = [
      { pattern: /iPad14,1|iPad14,2/i, name: 'iPad Pro 11" (4th gen)' },
      { pattern: /iPad14,3|iPad14,4/i, name: 'iPad Pro 12.9" (6th gen)' },
      { pattern: /iPad13,18|iPad13,19/i, name: 'iPad (10th gen)' },
      { pattern: /iPad14,5|iPad14,6/i, name: 'iPad Air (5th gen)' },
      { pattern: /iPad11,6|iPad11,7/i, name: 'iPad (9th gen)' },
      { pattern: /iPad13,1|iPad13,2/i, name: 'iPad Air (4th gen)' },
      { pattern: /iPad8,11|iPad8,12/i, name: 'iPad Pro 12.9" (4th gen)' },
    ];

    for (const ipadModel of ipadModels) {
      if (ipadModel.pattern.test(userAgent)) {
        model = ipadModel.name;
        break;
      }
    }

    if (model === 'Desconocido') {
      model = 'iPad';
    }

  } else {
    // PC/Desktop
    type = 'PC';
    
    if (/Windows NT 10.0/i.test(userAgent)) {
      os = 'Windows 10/11';
    } else if (/Windows NT 6.3/i.test(userAgent)) {
      os = 'Windows 8.1';
    } else if (/Windows NT 6.2/i.test(userAgent)) {
      os = 'Windows 8';
    } else if (/Windows NT 6.1/i.test(userAgent)) {
      os = 'Windows 7';
    } else if (/Mac OS X/i.test(userAgent)) {
      os = 'macOS';
      const macMatch = userAgent.match(/Mac OS X (\d+_\d+)/);
      if (macMatch) {
        const macVersion = macMatch[1].replace('_', '.');
        os = `macOS ${macVersion}`;
      }
    } else if (/Linux/i.test(userAgent)) {
      os = 'Linux';
    } else if (/CrOS/i.test(userAgent)) {
      os = 'Chrome OS';
    }

    model = `Escritorio ${os}`;
  }

  // Detectar navegador
  if (/Chrome/i.test(userAgent) && !/Edge/i.test(userAgent)) {
    browser = 'Chrome';
    const chromeMatch = userAgent.match(/Chrome\/(\d+)/);
    if (chromeMatch) {
      browser = `Chrome ${chromeMatch[1]}`;
    }
  } else if (/Firefox/i.test(userAgent)) {
    browser = 'Firefox';
    const firefoxMatch = userAgent.match(/Firefox\/(\d+)/);
    if (firefoxMatch) {
      browser = `Firefox ${firefoxMatch[1]}`;
    }
  } else if (/Safari/i.test(userAgent) && !/Chrome/i.test(userAgent)) {
    browser = 'Safari';
    const safariMatch = userAgent.match(/Version\/(\d+)/);
    if (safariMatch) {
      browser = `Safari ${safariMatch[1]}`;
    }
  } else if (/Edge/i.test(userAgent)) {
    browser = 'Edge';
    const edgeMatch = userAgent.match(/Edge\/(\d+)/);
    if (edgeMatch) {
      browser = `Edge ${edgeMatch[1]}`;
    }
  } else if (/Opera/i.test(userAgent)) {
    browser = 'Opera';
  }

  return {
    type,
    model,
    browser,
    os,
    userAgent
  };
}

export function getDeviceDisplayName(deviceInfo: DeviceInfo): string {
  if (deviceInfo.type === 'Android') {
    return `📱 Android - ${deviceInfo.model}`;
  } else if (deviceInfo.type === 'iPhone') {
    return `📱 iOS - ${deviceInfo.model}`;
  } else {
    return `💻 Escritorio - ${deviceInfo.model}`;
  }
}