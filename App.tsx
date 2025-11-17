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

  // NOVO ESTADO para rastrear o campo ativo no modal
  const [activeField, setActiveField] = useState<"hour" | "minute">("hour");

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
        } catch { }
      }
    })();

    notificationListener.current = Notifications.addNotificationReceivedListener(() => { });
    responseListener.current = Notifications.addNotificationResponseReceivedListener(() => { });

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
    setActiveField("hour"); // Reseta para a hora
    setShowAlarmPicker(true);
  };

  // LÓGICA DE DIGITAÇÃO ATUALIZADA
  const adicionarNumero = (num: string) => {
    if (activeField === "hour") {
      const newHour = tempHour + num;
      if (newHour.length <= 2) {
        setTempHour(newHour);
        // Regra de transição: se tem 2 dígitos OU se o primeiro dígito é 2 e o segundo é 4-9 (hora inválida)
        if (newHour.length === 2 || (newHour.length === 1 && parseInt(newHour) > 2)) {
          setActiveField("minute");
        }
      }
    } else if (activeField === "minute") {
      const newMinute = tempMinute + num;
      if (newMinute.length <= 2) {
        setTempMinute(newMinute);
        // Regra de transição: se tem 2 dígitos ou é maior que 5 (minuto inválido)
        if (newMinute.length === 2 || (newMinute.length === 1 && parseInt(newMinute) > 5)) {
          // Não faz nada, deve aguardar o OK ou a correção pelo usuário
        }
      }
    }
  };

  // LÓGICA DE APAGAR ATUALIZADA
  const apagar = () => {
    if (tempMinute.length > 0) {
      setTempMinute((s) => s.slice(0, -1));
      setActiveField("minute"); // Permanece no minuto para apagar
    }
    else if (tempHour.length > 0) {
      setTempHour((s) => s.slice(0, -1));
      setActiveField("hour"); // Volta para a hora se o minuto estiver vazio
    }
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
          } catch { }
        }
      } else {
        activeFetchedRef.current = null;
        setActiveAlarm(null);
      }
    } catch { }
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
          <Text style={[styles.tabText, tab === "alarms" && { color: "#fff" }]}>Alarmes</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setTab("alerts")}
          style={[styles.tabBtn, tab === "alerts" && styles.tabActive]}
        >
          <Text style={[styles.tabText, tab === "alerts" && { color: "#fff" }]}>Alertas ({alerts.length})</Text>
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
              style={{ width: 250, height: 250, resizeMode: "contain", marginTop: -50 }}
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
                  thumbColor={alarm.enabled ? "#41A579" : "#ccc"}
                  trackColor={{ false: "#ccc", true: "#41A579" }} // Cores atualizadas para Switch
                />
              </View>

              <View
                style={{ flexDirection: "row", marginTop: 12, gap: 8 }}
              >
                <TouchableOpacity
                  style={[styles.btn, styles.deleteBtn, { flex: 1 }]}
                  onPress={() => excluirAlarme(alarm.id)}
                >
                  <Text style={styles.deleteBtnText}>Excluir</Text>
                </TouchableOpacity>

              </View>
            </View>
          ))}

          <TouchableOpacity
            style={[styles.btn, styles.addBtn]}
            onPress={abrirAlarmPicker}
          >
            <Text style={styles.btnText}>Adicionar Alarme</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.clearBtn, { marginTop: 10 }]}
            onPress={limparMemoriaAlarmes}
          >
            <Text style={styles.btnText}>Limpar Memória</Text>
          </TouchableOpacity>

          <Text style={styles.status}>Status: {status}</Text>

          {/* NOVO MODAL DE ALARME */}
          <Modal visible={showAlarmPicker} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <View style={styles.modalBox}>
                <Text style={styles.modalTitle}>Novo Alarme</Text>

                <TextInput
                  placeholder="Nome do alarme"
                  placeholderTextColor="#888"
                  style={styles.input}
                  value={tempName}
                  onChangeText={setTempName}
                />

                {/* DISPLAY DE HORÁRIO COM DESTAQUE CLICÁVEL */}
                <View style={styles.modalRow}>
                  <TouchableOpacity onPress={() => setActiveField('hour')}>
                    <Text
                      style={[
                        styles.displayText,
                        activeField === 'hour' && styles.activeDisplay,
                        (parseInt(tempHour) > 23 || tempHour.length === 0) && styles.invalidDisplay // Validação visual
                      ]}
                    >
                      {tempHour.padStart(2, "0") || "--"}
                    </Text>
                  </TouchableOpacity>

                  <Text style={styles.modalDots}>:</Text>

                  <TouchableOpacity onPress={() => setActiveField('minute')}>
                    <Text
                      style={[
                        styles.displayText,
                        activeField === 'minute' && styles.activeDisplay,
                        (parseInt(tempMinute) > 59 || tempMinute.length === 0) && styles.invalidDisplay // Validação visual
                      ]}
                    >
                      {tempMinute.padStart(2, "0") || "--"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* BOTÕES LED */}
                <View
                  style={styles.ledButtonsContainer}
                >
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((led) => (
                    <TouchableOpacity
                      key={led}
                      style={[
                        styles.dayBtn,
                        tempLed === led && styles.ledActive,
                      ]}
                      onPress={() => setTempLed(led)}
                    >
                      <Text style={styles.dayBtnText}>LED {led + 1}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* KEYPAD ATUALIZADO */}
                <View style={styles.keypad}>
                  {[
                    "1", "2", "3", "4", "5", "6", "7", "8", "9", "0",
                  ].map((num) => (
                    <TouchableOpacity
                      key={num}
                      style={styles.key}
                      onPress={() => adicionarNumero(num)}
                    >
                      <Text style={styles.keyText}>{num}</Text>
                    </TouchableOpacity>
                  ))}

                  <TouchableOpacity style={styles.deleteKey} onPress={apagar}>
                    <Text style={styles.deleteKeyText}>⌫</Text>
                  </TouchableOpacity>
                </View>

                {/* BOTÕES DE AÇÃO */}
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[
                      styles.btn,
                      styles.cancelBtn,
                      { flex: 1 },
                    ]}
                    onPress={() => setShowAlarmPicker(false)}
                  >
                    <Text style={styles.cancelBtnText}>Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.btn, styles.addBtn, { flex: 1, marginTop: 0 }]}
                    onPress={salvarNovoAlarme}
                  >
                    <Text style={styles.btnText}>OK</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
          {/* FIM DO NOVO MODAL */}

        </ScrollView>
      ) : (
        <View style={{ flex: 1, backgroundColor: "#fff" }}>
          <View
            style={{
              padding: 12,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              backgroundColor: "#f0f0f0", // Fundo leve para o cabeçalho dos alertas
            }}
          >
            <Text style={{ color: "#333" }}>Histórico de alertas</Text>
            <TouchableOpacity
              onPress={async () => {
                await salvarAlerts([]);
              }}
              style={styles.clearAlertsBtn}
            >
              <Text style={styles.clearAlertsBtnText}>Limpar</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={alerts}
            keyExtractor={(it) => String(it.id)}
            contentContainerStyle={{ padding: 16 }}
            ListEmptyComponent={
              <Text
                style={{
                  color: "#888",
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
                  backgroundColor: "#f5f5f5", // Fundo claro para o card de alerta
                  padding: 12,
                  borderRadius: 10,
                  marginBottom: 12,
                  borderLeftWidth: 4,
                  borderLeftColor: "#41A579",
                }}
              >
                <Text style={{ color: "#333", fontWeight: "700" }}>
                  {item.title}
                </Text>
                <Text style={{ color: "#666", marginTop: 6, fontSize: 12 }}>
                  {new Date(item.timestamp).toLocaleString()}
                </Text>
                <Text style={{ color: "#555", marginTop: 8 }}>
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
  container: { flexGrow: 1, padding: 16, backgroundColor: "#fff" },

  topbar: { flexDirection: "row", backgroundColor: "#2C674D", paddingVertical: 10, borderBottomColor: "#ddd" }, // Fundo verde
  tabBtn: { flex: 1, alignItems: "center", padding: 10 },
  tabActive: { backgroundColor: "#4cac82ff" },
  tabText: { color: "#Ffff", fontWeight: "600" },

  activeBanner: {
    backgroundColor: "#D9534F",
    padding: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  confirmBtn: { backgroundColor: "#1e6443", padding: 8, borderRadius: 8 },

  title: {
    fontSize: 24,
    marginBottom: 8,
    fontWeight: "700",
    color: "#333",
    textAlign: "center",
  },
  hora: {
    fontSize: 14,
    marginBottom: 20,
    color: "#666",
    textAlign: "center",
  },

  alarmCard: {
    backgroundColor: "#F5F5F5",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 6,
    borderLeftColor: "#41A579",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },

  alarmTitle: { fontSize: 24, fontWeight: "800", color: "#333" },
  alarmName: { color: "#666", fontSize: 14, marginTop: 4 },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  btn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },

  addBtn: { backgroundColor: "#2C674D", marginTop: 10 }, // Botão Adicionar (Verde)

  deleteBtn: { backgroundColor: "#dc3545", flex: 1 }, // Botão Excluir (Vermelho)
  deleteBtnText: { color: "#fff", fontWeight: "700" },

  clearBtn: { backgroundColor: "#dc3545" }, // Botão Limpar Memória (Vermelho)

  // Status
  status: { marginTop: 20, fontSize: 14, textAlign: "center", color: "#888" },

  // Modal (Novo Alarme)
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBox: {
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: 16,
    width: "90%",
    maxWidth: 400,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 10,
  },
  modalTitle: { color: "#333", fontSize: 20, fontWeight: "600", marginBottom: 16 },

  input: {
    width: "100%",
    backgroundColor: "#f5f5f5",
    color: "#333",
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#ddd",
  },

  modalRow: { flexDirection: "row", alignItems: "center", marginBottom: 20 },

  displayText: {
    fontSize: 48,
    color: "#333",
    fontWeight: "800",
    width: 80,
    textAlign: "center",
    paddingBottom: 5,
  },
  modalDots: { color: "#333", fontSize: 36, marginHorizontal: 5 },

  activeDisplay: {
    borderBottomWidth: 3,
    borderBottomColor: '#2C674D',
  },
  invalidDisplay: {
    color: '#dc3545',
  },

  keypad: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    width: "100%",
    marginBottom: 20,
  },
  key: {
    backgroundColor: "#eee",
    width: "28%",
    margin: "2%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  keyText: { color: "#333", fontSize: 28, fontWeight: "700" },

  deleteKey: {
    backgroundColor: '#6c757d',
    width: "28%",
    margin: "2%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
  },
  deleteKeyText: { color: '#fff', fontSize: 28, fontWeight: '700' },

  modalButtons: { flexDirection: "row", width: "100%", gap: 10, marginTop: 10 },
  cancelBtn: { backgroundColor: "#6c757d" },
  cancelBtnText: { color: "#fff", fontWeight: "700" },

  ledButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 10,
  },
  dayBtn: {
    backgroundColor: "#e9ecef",
    padding: 8,
    borderRadius: 10,
    alignItems: "center",
    flex: 1,
    marginHorizontal: 2,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  ledActive: {
    backgroundColor: "#41A579",
  },
  dayBtnText: { color: "#333", fontWeight: "600" },

  clearAlertsBtn: { backgroundColor: "#dc3545", padding: 8, borderRadius: 8 },
  clearAlertsBtnText: { color: "#fff" },
});