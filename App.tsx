import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Image,
  Switch,
  Alert,
  TextInput,
  FlatList,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";

type AlarmType = {
  id: number;
  hour: string;
  minute: string;
  name: string;
  led: number;
  enabled: boolean;
};

type AlertItem = {
  id: number;
  timestamp: number;
  title: string;
  message: string;
};

export default function App() {
  const [horaAtual, setHoraAtual] = useState("--:--");
  const [status, setStatus] = useState("Desconhecido");
  const [alarms, setAlarms] = useState<AlarmType[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [showAlarmPicker, setShowAlarmPicker] = useState(false);
  const [tempHour, setTempHour] = useState("");
  const [tempMinute, setTempMinute] = useState("");
  const [tempName, setTempName] = useState("");
  const [tempLed, setTempLed] = useState(0);
  const [tab, setTab] = useState<"alarms" | "alerts">("alarms");

  const [activeAlarm, setActiveAlarm] = useState<any>(null);
  const activeFetchedRef = useRef<number | null>(null);

  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  const ESP_IP = "http://192.168.0.5";

  async function registerForPushNotificationsAsync() {
    try {
      if (!Device.isDevice) return null;

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted") return null;

      const token = (await Notifications.getExpoPushTokenAsync()).data;
      return token;
    } catch {
      return null;
    }
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  useEffect(() => {
    (async () => {
      await registerForPushNotificationsAsync();

      if (Platform.OS === "android") {
        try {
          await Notifications.setNotificationChannelAsync("default", {
            name: "default",
            importance: Notifications.AndroidImportance.HIGH,
            sound: "default",
          });
        } catch {}
      }
    })();

    notificationListener.current = Notifications.addNotificationReceivedListener(() => {});
    responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {});

    return () => {
      if (notificationListener.current)
        Notifications.removeNotificationSubscription(notificationListener.current);
      if (responseListener.current)
        Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  useEffect(() => {
    atualizarStatus();
    carregarAlarmes();
    carregarAlerts();
    const intervalo = setInterval(() => {
      atualizarStatus();
      pollActive();
    }, 2000);
    return () => clearInterval(intervalo);
  }, []);

  const atualizarStatus = async () => {
    try {
      const res = await fetch(`${ESP_IP}/status`);
      const data = await res.json();
      setHoraAtual(data.hora);
      setStatus("Conectado");
    } catch {
      setStatus("Falha na conexão com o ESP");
      setHoraAtual("--:--");
    }
  };

  const carregarAlarmes = async () => {
    try {
      const data = await AsyncStorage.getItem("alarms");
      if (data) setAlarms(JSON.parse(data));
    } catch (error) {
      console.error("Erro ao carregar alarmes:", error);
    }
  };

  const salvarAlarmes = async (novos: AlarmType[]) => {
    try {
      setAlarms(novos);
      await AsyncStorage.setItem("alarms", JSON.stringify(novos));
      enviarProximoAlarme(novos);
    } catch (error) {
      console.error("Erro ao salvar alarmes:", error);
    }
  };

  const carregarAlerts = async () => {
    try {
      const data = await AsyncStorage.getItem("alerts");
      if (data) setAlerts(JSON.parse(data));
    } catch (error) {
      console.error("Erro ao carregar alerts:", error);
    }
  };

  const salvarAlerts = async (novos: AlertItem[]) => {
    try {
      setAlerts(novos);
      await AsyncStorage.setItem("alerts", JSON.stringify(novos));
    } catch (error) {
      console.error("Erro ao salvar alerts:", error);
    }
  };

  const pushAlert = async (title: string, message: string) => {
    const item: AlertItem = {
      id: Date.now() ^ Math.floor(Math.random() * 1000),
      timestamp: Date.now(),
      title,
      message,
    };
    const novos = [item, ...alerts];
    await salvarAlerts(novos);
  };

  const enviarProximoAlarme = async (lista = alarms) => {
    const ativos = lista.filter((a) => a.enabled);
    if (ativos.length === 0) return;

    const agora = new Date();
    const agoraMin = agora.getHours() * 60 + agora.getMinutes();

    const proximo = ativos.reduce((menor, atual) => {
      const minutosAtual = parseInt(atual.hour) * 60 + parseInt(atual.minute);
      const diffAtual = (minutosAtual - agoraMin + 1440) % 1440;
      const diffMenor = menor
        ? (parseInt(menor.hour) * 60 + parseInt(menor.minute) - agoraMin + 1440) % 1440
        : Infinity;
      return diffAtual < diffMenor ? atual : menor;
    }, null as AlarmType | null);

    if (proximo) {
      try {
        await fetch(`${ESP_IP}/setAlarm`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `hour=${proximo.hour}&minute=${proximo.minute}&led=${proximo.led}`,
        });

        setStatus(`Alarme enviado: ${proximo.hour}:${proximo.minute}`);

        await pushAlert(
          "Alarme agendado",
          `LED ${proximo.led + 1} às ${proximo.hour}:${proximo.minute}`
        );
      } catch {
        setStatus("Falha ao enviar alarme ativo");
      }
    }
  };

  const abrirAlarmPicker = () => {
    setTempHour("");
    setTempMinute("");
    setTempName("");
    setTempLed(0);
    setShowAlarmPicker(true);
  };

  const adicionarNumero = (num: string) => {
    if (tempHour.length < 2) setTempHour((s) => s + num);
    else if (tempMinute.length < 2) setTempMinute((s) => s + num);
  };

  const apagar = () => {
    if (tempMinute.length > 0) setTempMinute((s) => s.slice(0, -1));
    else if (tempHour.length > 0) setTempHour((s) => s.slice(0, -1));
  };

  const salvarNovoAlarme = async () => {
    const hora = parseInt(tempHour || "0", 10);
    const minuto = parseInt(tempMinute || "0", 10);
    const nome = tempName.trim() || "Alarme";

    if (
      isNaN(hora) ||
      hora < 0 ||
      hora > 23 ||
      isNaN(minuto) ||
      minuto < 0 ||
      minuto > 59
    ) {
      Alert.alert("Horário inválido", "Informe um horário entre 00:00 e 23:59");
      return;
    }

    const novo: AlarmType = {
      id: Date.now(),
      hour: hora.toString().padStart(2, "0"),
      minute: minuto.toString().padStart(2, "0"),
      name: nome,
      led: tempLed,
      enabled: true,
    };

    const novos = [...alarms, novo];
    await salvarAlarmes(novos);
    setShowAlarmPicker(false);
  };

  const alternarAlarme = async (id: number) => {
    const novos = alarms.map((a) =>
      a.id === id ? { ...a, enabled: !a.enabled } : a
    );
    await salvarAlarmes(novos);
  };

  const excluirAlarme = async (id: number) => {
    const novos = alarms.filter((a) => a.id !== id);
    await salvarAlarmes(novos);
    await pushAlert("Alarme excluído", `ID ${id} removido`);
  };

  const pollActive = async () => {
    try {
      const res = await fetch(`${ESP_IP}/active`);
      const data = await res.json();
      if (data.active) {
        if (activeFetchedRef.current !== data.id) {
          activeFetchedRef.current = data.id;
          setActiveAlarm(data);

          const msg = `Hora do remédio "${data.name}", LED ${data.led + 1}.`;
          await pushAlert("Alerta de remédio", msg);

          try {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: "Hora do remédio",
                body: msg,
                sound: "default",
              },
              trigger: null,
            });
          } catch {}
        }
      } else {
        activeFetchedRef.current = null;
        setActiveAlarm(null);
      }
    } catch {}
  };

  const confirmarAlarmeAtivo = async () => {
    if (!activeAlarm) return;
    try {
      await fetch(`${ESP_IP}/stopAlarm`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `id=${activeAlarm.id}`,
      });

      await pushAlert(
        "Alarme confirmado",
        `Confirmado: ${activeAlarm.name}`
      );

      setActiveAlarm(null);
      activeFetchedRef.current = null;
      Alert.alert("Confirmado", "Alarme interrompido.");
    } catch {
      Alert.alert("Erro", "Falha ao confirmar alarme.");
    }
  };

  const simularDisparo = async (a: AlarmType) => {
    const msg = `Simulação: "${a.name}", LED ${a.led + 1}.`;
    await pushAlert("Simulação de disparo", msg);

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Simulação de alarme",
          body: msg,
        },
        trigger: null,
      });
    } catch {}

    Alert.alert("Simulado", "Entrada adicionada ao histórico.");
  };

  const limparMemoriaAlarmes = async () => {
    await AsyncStorage.setItem("alarms", JSON.stringify([]));
    setAlarms([]);
    Alert.alert("Memória apagada", "Nenhum horário ativo.");
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.topbar}>
        <TouchableOpacity
          onPress={() => setTab("alarms")}
          style={[styles.tabBtn, tab === "alarms" && styles.tabActive]}
        >
          <Text style={styles.tabText}>Alarmes</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setTab("alerts")}
          style={[styles.tabBtn, tab === "alerts" && styles.tabActive]}
        >
          <Text style={styles.tabText}>Alertas ({alerts.length})</Text>
        </TouchableOpacity>
      </View>

      {activeAlarm && (
        <View style={styles.activeBanner}>
          <Text style={{ color: "#fff", fontWeight: "700" }}>
            ALERTA: {activeAlarm.name} — LED {activeAlarm.led + 1}
          </Text>

          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={confirmarAlarmeAtivo}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>
              Confirmar
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {tab === "alarms" ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.container}
        >
          <View style={{ alignItems: "center" }}>
            <Image
              source={require("./assets/images/logoTeste.png")}
              style={{ width: 140, height: 140, resizeMode: "contain" }}
            />
          </View>

          <Text style={styles.title}>Alarme Medicinal</Text>
          <Text style={styles.hora}>Hora atual: {horaAtual}</Text>

          {alarms.map((alarm) => (
            <View key={alarm.id} style={styles.alarmCard}>
              <View style={styles.rowBetween}>
                <View>
                  <Text style={styles.alarmTitle}>
                    {alarm.hour}:{alarm.minute}
                  </Text>
                  <Text style={styles.alarmName}>
                    {alarm.name} — LED {alarm.led + 1}
                  </Text>
                </View>

                <Switch
                  value={alarm.enabled}
                  onValueChange={() => alternarAlarme(alarm.id)}
                  thumbColor={alarm.enabled ? "#41A579" : "#888"}
                />
              </View>

              <View
                style={{ flexDirection: "row", marginTop: 12, gap: 8 }}
              >
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: "#555", flex: 1 }]}
                  onPress={() => excluirAlarme(alarm.id)}
                >
                  <Text style={styles.btnText}>Excluir</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: "#2C674D", flex: 1 }]}
                  onPress={() => simularDisparo(alarm)}
                >
                  <Text style={styles.btnText}>Simular</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={[styles.btn, styles.addBtn]}
            onPress={abrirAlarmPicker}
          >
            <Text style={styles.btnText}>+ Adicionar Alarme</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: "#922", marginTop: 10 }]}
            onPress={limparMemoriaAlarmes}
          >
            <Text style={styles.btnText}>Limpar Memória</Text>
          </TouchableOpacity>

          <Text style={styles.status}>Status: {status}</Text>

          <Modal visible={showAlarmPicker} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <View style={styles.modalBox}>
                <Text style={styles.modalTitle}>Novo Alarme</Text>

                <TextInput
                  placeholder="Nome do alarme"
                  placeholderTextColor="#aaa"
                  style={styles.input}
                  value={tempName}
                  onChangeText={setTempName}
                />

                <View style={styles.modalRow}>
                  <Text style={styles.displayText}>
                    {tempHour.padStart(2, "0") || "--"}
                  </Text>
                  <Text style={styles.modalDots}>:</Text>
                  <Text style={styles.displayText}>
                    {tempMinute.padStart(2, "0") || "--"}
                  </Text>
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    width: "100%",
                    marginBottom: 10,
                  }}
                >
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((led) => (
                    <TouchableOpacity
                      key={led}
                      style={[
                        styles.dayBtn,
                        tempLed === led && { backgroundColor: "#41A579" },
                      ]}
                      onPress={() => setTempLed(led)}
                    >
                      <Text style={{ color: "#fff" }}>LED {led + 1}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.keypad}>
                  {[
                    "1",
                    "2",
                    "3",
                    "4",
                    "5",
                    "6",
                    "7",
                    "8",
                    "9",
                    "0",
                  ].map((num) => (
                    <TouchableOpacity
                      key={num}
                      style={styles.key}
                      onPress={() => adicionarNumero(num)}
                    >
                      <Text style={styles.keyText}>{num}</Text>
                    </TouchableOpacity>
                  ))}

                  <TouchableOpacity style={styles.key} onPress={apagar}>
                    <Text style={styles.keyText}>⌫</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[
                      styles.btn,
                      styles.addBtn,
                      { backgroundColor: "#555", flex: 1 },
                    ]}
                    onPress={() => setShowAlarmPicker(false)}
                  >
                    <Text style={styles.btnText}>Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.btn, styles.addBtn, { flex: 1 }]}
                    onPress={salvarNovoAlarme}
                  >
                    <Text style={styles.btnText}>OK</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          <View
            style={{
              padding: 12,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff" }}>Histórico de alertas</Text>
            <TouchableOpacity
              onPress={async () => {
                await salvarAlerts([]);
              }}
              style={{ backgroundColor: "#922", padding: 8, borderRadius: 8 }}
            >
              <Text style={{ color: "#fff" }}>Limpar</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={alerts}
            keyExtractor={(it) => String(it.id)}
            contentContainerStyle={{ padding: 16 }}
            ListEmptyComponent={
              <Text
                style={{
                  color: "#aaa",
                  textAlign: "center",
                  marginTop: 20,
                }}
              >
                Sem alertas
              </Text>
            }
            renderItem={({ item }) => (
              <View
                style={{
                  backgroundColor: "#2c2c2c",
                  padding: 12,
                  borderRadius: 10,
                  marginBottom: 12,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>
                  {item.title}
                </Text>
                <Text style={{ color: "#ccc", marginTop: 6 }}>
                  {new Date(item.timestamp).toLocaleString()}
                </Text>
                <Text style={{ color: "#ddd", marginTop: 8 }}>
                  {item.message}
                </Text>
              </View>
            )}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, backgroundColor: "#1c1c1c" },

  topbar: { flexDirection: "row", backgroundColor: "#111", paddingVertical: 8 },
  tabBtn: { flex: 1, alignItems: "center", padding: 10 },
  tabActive: { backgroundColor: "#222" },
  tabText: { color: "#fff", fontWeight: "600" },

  activeBanner: {
    backgroundColor: "#922",
    padding: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  confirmBtn: { backgroundColor: "#2C674D", padding: 8, borderRadius: 8 },

  title: {
    fontSize: 22,
    marginBottom: 10,
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",
  },
  hora: {
    fontSize: 14,
    marginBottom: 20,
    color: "#aaa",
    textAlign: "center",
  },

  alarmCard: {
    backgroundColor: "#41A579",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  alarmTitle: { fontSize: 22, fontWeight: "700", color: "#fff" },
  alarmName: { color: "#fff", opacity: 0.8, fontSize: 14 },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  btn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  addBtn: { backgroundColor: "#2C674D", marginTop: 10 },

  status: { marginTop: 20, fontSize: 14, textAlign: "center", color: "#aaa" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBox: {
    backgroundColor: "#2c2c2c",
    padding: 20,
    borderRadius: 12,
    width: "80%",
    alignItems: "center",
  },
  modalTitle: { color: "#fff", fontSize: 18, marginBottom: 12 },

  input: {
    width: "100%",
    backgroundColor: "#3c3c3c",
    color: "#fff",
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
    fontSize: 16,
  },

  modalRow: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  displayText: {
    fontSize: 40,
    color: "#fff",
    fontWeight: "700",
    width: 60,
    textAlign: "center",
  },
  modalDots: { color: "#fff", fontSize: 28, marginHorizontal: 8 },

  keypad: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: 20,
  },
  key: {
    backgroundColor: "#444",
    width: "28%",
    margin: "2%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
  },
  keyText: { color: "#fff", fontSize: 24, fontWeight: "600" },

  modalButtons: { flexDirection: "row", width: "100%", gap: 8 },

  dayBtn: {
    backgroundColor: "#333",
    padding: 8,
    borderRadius: 10,
    alignItems: "center",
    flex: 1,
    marginHorizontal: 4,
  },
});
