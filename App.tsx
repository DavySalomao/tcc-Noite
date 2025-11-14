import React, { useEffect, useState } from "react";
import { View, Text, Button, Alert, ScrollView } from "react-native";
import notifee, { AndroidImportance, EventType } from '@notifee/react-native';

const ESP_IP = "http://192.168.0.5";

export default function App() {
  const [horaAtual, setHoraAtual] = useState("--:--");

  // =====================================================
  // CRIAÇÃO DO CANAL DE NOTIFICAÇÃO
  // =====================================================
  async function setupChannel() {
    await notifee.requestPermission();

    await notifee.createChannel({
      id: 'alarm-channel',
      name: 'Alarmes de Remédio',
      importance: AndroidImportance.HIGH,
      vibration: true,
      sound: 'default',
    });
  }

  // =====================================================
  // EVENTOS DE NOTIFICAÇÃO (FOREGROUND)
  // =====================================================
  useEffect(() => {
    return notifee.onForegroundEvent(async ({ type, detail }) => {

      // Botão: CONFIRMAR
      if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'confirmar') {

        const alarmId = detail.notification?.data?.alarmId;
        if (alarmId) {
          await fetch(`${ESP_IP}/confirm?id=${alarmId}`);
        }

        await notifee.cancelNotification(detail.notification.id);
      }

      // Botão: ADIAR 5 MIN
      if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'adiar') {
        await notifee.cancelNotification(detail.notification.id);
      }
    });
  }, []);

  // =====================================================
  // BUSCA STATUS DO ESP
  // =====================================================
  async function fetchStatus() {
    try {
      const res = await fetch(`${ESP_IP}/status`);
      const data = await res.json();
      setHoraAtual(data.hora);
    } catch (e) {
      setHoraAtual("--:--");
    }
  }

  useEffect(() => {
    setupChannel();
    fetchStatus();
    const t = setInterval(fetchStatus, 1000);
    return () => clearInterval(t);
  }, []);

  // =====================================================
  // EXIBE NOTIFICAÇÃO DE ALARME
  // =====================================================
  async function showAlarmNotification(remedio, dia, led, alarmId) {
    await notifee.displayNotification({
      id: "alarm-" + alarmId,
      title: "⏰ Horário do Remédio!",
      body: `Use o medicamento "${remedio}" — Dia: ${dia} — LED ${led}`,
      android: {
        channelId: 'alarm-channel',
        importance: AndroidImportance.HIGH,
        smallIcon: 'ic_launcher',
        fullScreenAction: { id: 'default' },
        vibrationPattern: [500, 1000],
        sound: 'default',
        ongoing: true,
        autoCancel: false,
        actions: [
          { title: 'Confirmar', pressAction: { id: 'confirmar' } },
          { title: 'Adiar 5 min', pressAction: { id: 'adiar' } }
        ]
      },
      data: { alarmId }
    });
  }

  // TESTE MANUAL
  async function testeNotificacao() {
    await showAlarmNotification("Paracetamol", "Segunda-feira", 2, 1234);
  }

  return (
    <ScrollView style={{ padding: 20 }}>
      <Text style={{ fontSize: 26, fontWeight: "bold", marginBottom: 10 }}>
        Caixa de Remédios
      </Text>

      <Text style={{ fontSize: 22, marginBottom: 20 }}>
        Hora Atual: {horaAtual}
      </Text>

      <Button title="TESTAR NOTIFICAÇÃO" onPress={testeNotificacao} />

      <View style={{ height: 40 }} />

      <Button
        title="LIMPAR ALARMES"
        color="red"
        onPress={() => {
          fetch(`${ESP_IP}/reset`);
          Alert.alert("Memória apagada");
        }}
      />
    </ScrollView>
  );
}
