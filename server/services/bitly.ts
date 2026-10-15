import axios from 'axios';

const BITLY_API_URL = 'https://api-ssl.bitly.com/v4';
const BITLY_TOKEN = process.env.BITLY_ACCESS_TOKEN;

export interface BitlyResponse {
  id: string;
  link: string;
  long_url: string;
  created_at: string;
}

export interface BitlyShortenOptions {
  longUrl: string;
  domain?: string;
  title?: string;
}

export class BitlyService {
  private token: string | undefined;

  constructor() {
    this.token = BITLY_TOKEN;
    if (!this.token) {
      console.warn('[Bitly] BITLY_ACCESS_TOKEN no está configurado. El servicio de acortamiento estará deshabilitado.');
    }
  }

  private ensureToken(): void {
    if (!this.token) {
      throw new Error('Bitly no está configurado. Por favor configura BITLY_ACCESS_TOKEN en las variables de entorno.');
    }
  }

  async shorten(options: BitlyShortenOptions): Promise<BitlyResponse> {
    this.ensureToken();
    try {
      const response = await axios.post(
        `${BITLY_API_URL}/shorten`,
        {
          long_url: options.longUrl,
          domain: options.domain || 'bit.ly',
          title: options.title
        },
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Error al acortar URL con Bitly:', error.response?.data || error.message);
      
      if (error.response?.status === 429) {
        throw new Error('Límite de rate de Bitly alcanzado. Por favor espera un momento.');
      }
      
      throw new Error(`Error al acortar URL: ${error.response?.data?.message || error.message}`);
    }
  }

  async expand(bitlink: string): Promise<{ long_url: string }> {
    this.ensureToken();
    try {
      const encodedBitlink = encodeURIComponent(bitlink);
      const response = await axios.get(
        `${BITLY_API_URL}/expand`,
        {
          params: { bitlink_id: encodedBitlink },
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Error al expandir URL con Bitly:', error.response?.data || error.message);
      throw new Error(`Error al expandir URL: ${error.response?.data?.message || error.message}`);
    }
  }

  async updateLink(bitlink: string, title: string): Promise<BitlyResponse> {
    try {
      const response = await axios.patch(
        `${BITLY_API_URL}/bitlinks/${bitlink}`,
        { title },
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Error al actualizar link de Bitly:', error.response?.data || error.message);
      throw new Error(`Error al actualizar link: ${error.response?.data?.message || error.message}`);
    }
  }

  async getLinkClicks(bitlink: string): Promise<{ link_clicks: number }> {
    try {
      const response = await axios.get(
        `${BITLY_API_URL}/bitlinks/${bitlink}/clicks`,
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Error al obtener clics de Bitly:', error.response?.data || error.message);
      throw new Error(`Error al obtener clics: ${error.response?.data?.message || error.message}`);
    }
  }

  async delete(bitlinkId: string): Promise<void> {
    this.ensureToken();
    try {
      // Bitly usa el formato completo del link para eliminar (ej: bit.ly/abc123)
      await axios.delete(
        `${BITLY_API_URL}/bitlinks/${bitlinkId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`[Bitly] Link ${bitlinkId} eliminado exitosamente de Bitly`);
    } catch (error: any) {
      console.error('[Bitly] Error al eliminar link:', error.response?.data || error.message);
      // No lanzar error para que la cancelación del link continúe aunque falle Bitly
    }
  }
}

export const bitlyService = new BitlyService();
