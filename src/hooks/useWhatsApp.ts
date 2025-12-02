import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { whatsappService } from '../services/whatsapp';

const STORAGE_KEYS = {
  ENABLED: '@medtime:whatsapp:enabled',
  PHONE: '@medtime:whatsapp:phone',
  NOTIFY_CREATE: '@medtime:whatsapp:notify_create',
  NOTIFY_ACTIVE: '@medtime:whatsapp:notify_active',
  NOTIFY_ACK: '@medtime:whatsapp:notify_ack',
};

interface WhatsAppConfig {
  enabled: boolean;
  phoneNumber: string;
  notifyOnCreate: boolean;
  notifyOnActive: boolean;
  notifyOnAcknowledge: boolean;
}

export const useWhatsApp = () => {
  const [config, setConfig] = useState<WhatsAppConfig>({
    enabled: false,
    phoneNumber: '+5517997322355',
    notifyOnCreate: true,
    notifyOnActive: true,
    notifyOnAcknowledge: true,
  });
  const [loading, setLoading] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      const [enabled, phone, notifyCreate, notifyActive, notifyAck] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.ENABLED),
        AsyncStorage.getItem(STORAGE_KEYS.PHONE),
        AsyncStorage.getItem(STORAGE_KEYS.NOTIFY_CREATE),
        AsyncStorage.getItem(STORAGE_KEYS.NOTIFY_ACTIVE),
        AsyncStorage.getItem(STORAGE_KEYS.NOTIFY_ACK),
      ]);

      const newConfig = {
        enabled: enabled === 'true',
        phoneNumber: phone || '+5517997322355',
        notifyOnCreate: notifyCreate === 'true' || notifyCreate === null,
        notifyOnActive: notifyActive === 'true' || notifyActive === null,
        notifyOnAcknowledge: notifyAck === 'true' || notifyAck === null,
      };

      setConfig(newConfig);
    } catch (error) {
      console.error('Erro ao carregar config WhatsApp:', error);
    }
  }, []);

  const setEnabled = useCallback(async (enabled: boolean) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ENABLED, enabled.toString());
      setConfig(prev => ({ ...prev, enabled }));
    } catch (error) {
      console.error('Erro ao salvar enabled:', error);
    }
  }, []);

  const setPhoneNumber = useCallback(async (phoneNumber: string) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PHONE, phoneNumber);
      setConfig(prev => ({ ...prev, phoneNumber }));
    } catch (error) {
      console.error('Erro ao salvar telefone:', error);
    }
  }, []);

  const setNotifyOnCreate = useCallback(async (notify: boolean) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.NOTIFY_CREATE, notify.toString());
      setConfig(prev => ({ ...prev, notifyOnCreate: notify }));
    } catch (error) {
      console.error('Erro ao salvar notifyOnCreate:', error);
    }
  }, []);

  const setNotifyOnActive = useCallback(async (notify: boolean) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.NOTIFY_ACTIVE, notify.toString());
      setConfig(prev => ({ ...prev, notifyOnActive: notify }));
    } catch (error) {
      console.error('Erro ao salvar notifyOnActive:', error);
    }
  }, []);

  const setNotifyOnAcknowledge = useCallback(async (notify: boolean) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.NOTIFY_ACK, notify.toString());
      setConfig(prev => ({ ...prev, notifyOnAcknowledge: notify }));
    } catch (error) {
      console.error('Erro ao salvar notifyOnAck:', error);
    }
  }, []);

  const sendTestMessage = useCallback(async () => {
    if (!config.enabled) return false;
    
    setLoading(true);
    try {
      const success = await whatsappService.sendTestMessage(config.phoneNumber);
      return success;
    } finally {
      setLoading(false);
    }
  }, [config.enabled, config.phoneNumber]);

  const notifyAlarmCreated = useCallback(async (alarmName: string, hour: string, minute: string) => {
    if (!config.enabled || !config.notifyOnCreate) {
      return;
    }
    
    await whatsappService.notifyAlarmCreated(alarmName, hour, minute, config.phoneNumber);
  }, [config.enabled, config.notifyOnCreate, config.phoneNumber]);

  const notifyAlarmActive = useCallback(async (alarmName: string, hour: string, minute: string) => {
    if (!config.enabled || !config.notifyOnActive) {
      return;
    }
    
    await whatsappService.notifyAlarmActive(alarmName, hour, minute, config.phoneNumber);
  }, [config.enabled, config.notifyOnActive, config.phoneNumber]);

  const notifyAlarmAcknowledged = useCallback(async (alarmName: string) => {
    if (!config.enabled || !config.notifyOnAcknowledge) {
      return;
    }
    
    await whatsappService.notifyAlarmAcknowledged(alarmName, config.phoneNumber);
  }, [config.enabled, config.notifyOnAcknowledge, config.phoneNumber]);

  return {
    config,
    loading,
    loadConfig,
    setEnabled,
    setPhoneNumber,
    setNotifyOnCreate,
    setNotifyOnActive,
    setNotifyOnAcknowledge,
    sendTestMessage,
    notifyAlarmCreated,
    notifyAlarmActive,
    notifyAlarmAcknowledged,
  };
};
