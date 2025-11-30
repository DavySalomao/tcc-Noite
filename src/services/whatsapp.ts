import axios from 'axios';

const TEXTMEBOT_BASE_URL = 'http://api.textmebot.com/send.php';
const API_KEY = 'qhawSZRKUjPd';
const DEFAULT_RECIPIENT = '+5517997322355';

// URL pública da imagem do alarme no Imgur
const ALARM_IMAGE_URL = 'https://i.imgur.com/jrfyI9B.png';

interface SendMessageParams {
  recipient?: string;
  text: string;
  imageUrl?: string;
}

export const whatsappService = {
  /**
   * Envia uma mensagem de texto via WhatsApp
   */
  async sendMessage({ recipient = DEFAULT_RECIPIENT, text, imageUrl }: SendMessageParams): Promise<boolean> {
    try {
      const params = new URLSearchParams({
        recipient,
        apikey: API_KEY,
        text,
      });

      if (imageUrl) {
        params.append('file', imageUrl);
      }

      const url = `${TEXTMEBOT_BASE_URL}?${params.toString()}`;
      const response = await axios.get(url, { timeout: 10000 });

      return response.status === 200;
    } catch (error) {
      console.error('Erro ao enviar mensagem WhatsApp:', error);
      return false;
    }
  },

  /**
   * Envia notificação de alarme configurado
   */
  async notifyAlarmCreated(alarmName: string, hour: string, minute: string, recipient?: string): Promise<boolean> {
    const text = `✅ *Alarme Configurado*\n\n` +
                 `📋 Nome: ${alarmName}\n` +
                 `⏰ Horário: ${hour}:${minute}\n\n` +
                 `O alarme foi criado com sucesso no MedTime!`;

    return this.sendMessage({ recipient, text });
  },

  /**
   * Envia notificação quando alarme está tocando (com imagem)
   */
  async notifyAlarmActive(alarmName: string, hour: string, minute: string, recipient?: string): Promise<boolean> {
    const text = `🔔 *ALARME ATIVO!*\n\n` +
                 `📋 ${alarmName}\n` +
                 `⏰ ${hour}:${minute}\n\n` +
                 `⚠️ Não esqueça de tomar seu medicamento!`;

    return this.sendMessage({ 
      recipient, 
      text, 
      imageUrl: ALARM_IMAGE_URL 
    });
  },

  /**
   * Envia notificação quando alarme é confirmado
   */
  async notifyAlarmAcknowledged(alarmName: string, recipient?: string): Promise<boolean> {
    const text = `✅ *Alarme Confirmado*\n\n` +
                 `📋 ${alarmName}\n\n` +
                 `Medicamento tomado com sucesso! 💊`;

    return this.sendMessage({ recipient, text });
  },

  /**
   * Envia notificação de teste
   */
  async sendTestMessage(recipient?: string): Promise<boolean> {
    const text = `*Teste MedTime 💊🕗*\n\n` +
                 `Esta é uma mensagem de teste do sistema MedTime.\n\n` +
                 `✅ WhatsApp conectado com sucesso!`;

    return this.sendMessage({ recipient, text });
  },

  /**
   * Envia resumo diário de alarmes
   */
  async sendDailySummary(alarms: Array<{ name: string; hour: string; minute: string }>, recipient?: string): Promise<boolean> {
    let text = `📅 *Resumo de Alarmes - MedTime*\n\n`;
    text += `Você tem ${alarms.length} alarme(s) configurado(s):\n\n`;

    alarms.forEach((alarm, index) => {
      text += `${index + 1}. ${alarm.name} - ${alarm.hour}:${alarm.minute}\n`;
    });

    text += `\n💊 Não esqueça de tomar seus medicamentos!`;

    return this.sendMessage({ recipient, text });
  },
};
