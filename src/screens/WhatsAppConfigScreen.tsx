import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useWhatsApp } from '../hooks/useWhatsApp';

export default function WhatsAppConfigScreen() {
  const {
    config,
    loading,
    loadConfig,
    setEnabled,
    setPhoneNumber,
    setNotifyOnCreate,
    setNotifyOnActive,
    setNotifyOnAcknowledge,
    sendTestMessage,
  } = useWhatsApp();

  const [phoneInput, setPhoneInput] = useState(config.phoneNumber);
  const [testLoading, setTestLoading] = useState(false);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    setPhoneInput(config.phoneNumber);
  }, [config.phoneNumber]);

  // Formata o número de telefone automaticamente
  const formatPhoneNumber = (text: string) => {
    // Remove todos os caracteres que não são números
    const numbers = text.replace(/\D/g, '');
    
    // Se começar com 55, mantém (código do Brasil)
    // Se não, adiciona 55 no início
    let formatted = numbers;
    
    if (formatted.length === 0) {
      setPhoneInput('');
      return;
    }
    
    // Garante que sempre tenha o + no início
    formatted = '+' + (formatted.startsWith('55') ? formatted : '55' + formatted);
    
    // Limita a 13 caracteres (+55 + 11 dígitos)
    if (formatted.length > 14) {
      formatted = formatted.substring(0, 14);
    }
    
    setPhoneInput(formatted);
  };

  const handleSavePhone = () => {
    // Remove caracteres não numéricos para validar
    const numbers = phoneInput.replace(/\D/g, '');
    
    if (numbers.length < 12 || numbers.length > 13) {
      Alert.alert('Erro', 'Número inválido. Formato esperado: +55 + DDD (2 dígitos) + Número (9 dígitos)\nExemplo: +5517997322355');
      return;
    }
    
    setPhoneNumber(phoneInput);
    Alert.alert('Sucesso', 'Número de telefone salvo!');
  };

  const handleTestMessage = async () => {
    if (!config.enabled) {
      Alert.alert('WhatsApp Desativado', 'Ative o WhatsApp primeiro para enviar mensagens de teste.');
      return;
    }

    setTestLoading(true);
    const success = await sendTestMessage();
    setTestLoading(false);

    if (success) {
      Alert.alert(
        'Mensagem Enviada!',
        'Verifique seu WhatsApp. A mensagem de teste foi enviada com sucesso!'
      );
    } else {
      Alert.alert(
        'Erro',
        'Não foi possível enviar a mensagem. Verifique sua conexão e tente novamente.'
      );
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Configurações WhatsApp</Text>
        <Text style={styles.headerSubtitle}>
          Configure notificações via WhatsApp
        </Text>
      </View>

      <View style={styles.section}>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Ativar WhatsApp</Text>
            <Text style={styles.settingDescription}>
              Receber notificações via WhatsApp
            </Text>
          </View>
          <Switch
            value={config.enabled}
            onValueChange={setEnabled}
            trackColor={{ false: '#767577', true: '#41A579' }}
            thumbColor={config.enabled ? '#2C674D' : '#f4f3f4'}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📱 Número de Telefone</Text>
        <Text style={styles.sectionDescription}>
          Digite apenas os números. Formato automático: +55 + DDD + número
        </Text>
        <View style={styles.phoneContainer}>
          <TextInput
            style={styles.phoneInput}
            value={phoneInput}
            onChangeText={formatPhoneNumber}
            placeholder="+5517997322355"
            keyboardType="number-pad"
            editable={config.enabled}
            maxLength={14}
          />
          <TouchableOpacity
            style={[styles.saveButton, !config.enabled && styles.saveButtonDisabled]}
            onPress={handleSavePhone}
            disabled={!config.enabled}
          >
            <Text style={styles.saveButtonText}>💾</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔔 Tipos de Notificação</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Alarme Criado</Text>
            <Text style={styles.settingDescription}>
              Notificar quando um alarme for configurado
            </Text>
          </View>
          <Switch
            value={config.notifyOnCreate}
            onValueChange={setNotifyOnCreate}
            disabled={!config.enabled}
            trackColor={{ false: '#767577', true: '#41A579' }}
            thumbColor={config.notifyOnCreate ? '#2C674D' : '#f4f3f4'}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Alarme Tocando</Text>
            <Text style={styles.settingDescription}>
              Notificar quando um alarme estiver tocando
            </Text>
          </View>
          <Switch
            value={config.notifyOnActive}
            onValueChange={setNotifyOnActive}
            disabled={!config.enabled}
            trackColor={{ false: '#767577', true: '#41A579' }}
            thumbColor={config.notifyOnActive ? '#2C674D' : '#f4f3f4'}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Alarme Confirmado</Text>
            <Text style={styles.settingDescription}>
              Notificar quando um alarme for confirmado
            </Text>
          </View>
          <Switch
            value={config.notifyOnAcknowledge}
            onValueChange={setNotifyOnAcknowledge}
            disabled={!config.enabled}
            trackColor={{ false: '#767577', true: '#41A579' }}
            thumbColor={config.notifyOnAcknowledge ? '#2C674D' : '#f4f3f4'}
          />
        </View>
      </View>

      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.saveConfigButton, !config.enabled && styles.saveConfigButtonDisabled]}
          onPress={() => Alert.alert('Salvo!', 'Configurações salvas com sucesso!')}
          disabled={!config.enabled}
        >
          <Text style={styles.saveConfigButtonText}>Salvar Configurações</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.testButton, (!config.enabled || testLoading) && styles.testButtonDisabled]}
          onPress={handleTestMessage}
          disabled={!config.enabled || testLoading}
        >
          {testLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.testButtonText}>Enviar Mensagem de Teste</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>ℹ️ Informações</Text>
        <Text style={styles.infoText}>
          • As notificações são enviadas via TextMeBot{'\n'}
          • Certifique-se de que o número está correto{'\n'}
          • O número deve incluir código do país (+55){'\n'}
          • Teste a conexão antes de usar
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2C674D',
    padding: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 15,
    padding: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  sectionDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 10,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  settingInfo: {
    flex: 1,
    marginRight: 10,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
    marginBottom: 3,
  },
  settingDescription: {
    fontSize: 12,
    color: '#666',
  },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phoneInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  saveButton: {
    marginLeft: 10,
    backgroundColor: '#2C674D',
    padding: 12,
    borderRadius: 8,
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    fontSize: 20,
  },
  saveConfigButton: {
    backgroundColor: '#2C674D',
    padding: 15,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveConfigButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveConfigButtonIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  saveConfigButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  testButton: {
    backgroundColor: '#2C674D',
    padding: 15,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  testButtonDisabled: {
    backgroundColor: '#ccc',
  },
  testButtonIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  testButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    margin: 15,
    padding: 15,
    borderRadius: 10,
    marginBottom: 30,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#1565C0',
    lineHeight: 18,
  },
});
