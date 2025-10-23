import React, { useState, useEffect } from "react";
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
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function App() {
  const [horaAtual, setHoraAtual] = useState("--:--");
  const [status, setStatus] = useState("Desconhecido");
  const [showAlarmPicker, setShowAlarmPicker] = useState(false);
  const [tempHour, setTempHour] = useState("");
  const [tempMinute, setTempMinute] = useState("");
  const [tempName, setTempName] = useState("");
  const [tempDay, setTempDay] = useState(0);
  const [tempLed, setTempLed] = useState(0);
  const [alarms, setAlarms] = useState<any[]>([]);

  const ESP_IP = "http://192.168.137.221";

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

  useEffect(() => {
    atualizarStatus();
    carregarAlarmes();
    const intervalo = setInterval(atualizarStatus, 5000);
    return () => clearInterval(intervalo);
  }, []);

  const carregarAlarmes = async () => {
    try {
      const data = await AsyncStorage.getItem("alarms");
      if (data) setAlarms(JSON.parse(data));
    } catch (error) {
      console.error("Erro ao carregar alarmes:", error);
    }
  };

  const salvarAlarmes = async (novos: any[]) => {
    try {
      setAlarms(novos);
      await AsyncStorage.setItem("alarms", JSON.stringify(novos));
      enviarProximoAlarme(novos);
    } catch (error) {
      console.error("Erro ao salvar alarmes:", error);
    }
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
    }, null);

    if (proximo) {
      try {
        await fetch(`${ESP_IP}/setAlarm`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `hour=${proximo.hour}&minute=${proximo.minute}&led=${proximo.led}&day=${proximo.day}`,
        });
        setStatus(`Enviado alarme ${proximo.hour}:${proximo.minute}`);
      } catch {
        setStatus("Falha ao enviar alarme ativo");
      }
    }
  };

  const abrirAlarmPicker = () => {
    setTempHour("");
    setTempMinute("");
    setTempName("");
    setTempDay(0);
    setTempLed(0);
    setShowAlarmPicker(true);
  };

  const adicionarNumero = (num: string) => {
    if (tempHour.length < 2) setTempHour(tempHour + num);
    else if (tempMinute.length < 2) setTempMinute(tempMinute + num);
  };

  const apagar = () => {
    if (tempMinute.length > 0) setTempMinute(tempMinute.slice(0, -1));
    else if (tempHour.length > 0) setTempHour(tempHour.slice(0, -1));
  };

  const salvarNovoAlarme = async () => {
    const hora = parseInt(tempHour || "0", 10);
    const minuto = parseInt(tempMinute || "0", 10);
    const nome = tempName.trim() || "Alarme";

    if (isNaN(hora) || hora < 0 || hora > 23 || isNaN(minuto) || minuto < 0 || minuto > 59) {
      Alert.alert("Horário inválido", "Informe um horário entre 00:00 e 23:59");
      return;
    }

    const novo = {
      id: Date.now(),
      hour: hora.toString().padStart(2, "0"),
      minute: minuto.toString().padStart(2, "0"),
      name: nome,
      led: tempLed,
      day: tempDay,
      enabled: true,
    };

    const novos = [...alarms, novo];
    await salvarAlarmes(novos);
    setShowAlarmPicker(false);
  };

  const alternarAlarme = async (id: number) => {
    const novos = alarms.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a));
    await salvarAlarmes(novos);
  };

  const excluirAlarme = async (id: number) => {
    const novos = alarms.filter((a) => a.id !== id);
    await salvarAlarmes(novos);
  };

  const dias = ["Segunda-feira", "Terça-feira"];

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container}>
      <View style={{ alignItems: "center" }}>
        <Image
          source={require("./assets/images/logoTeste.png")}
          style={{ width: 160, height: 160, resizeMode: "contain" }}
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
                {alarm.name} — {dias[alarm.day]} — LED {alarm.led + 1}
              </Text>
            </View>
            <Switch
              value={alarm.enabled}
              onValueChange={() => alternarAlarme(alarm.id)}
              thumbColor={alarm.enabled ? "#41A579" : "#888"}
            />
          </View>

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: "#555", marginTop: 10 }]}
            onPress={() => excluirAlarme(alarm.id)}
          >
            <Text style={styles.btnText}>Excluir</Text>
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity style={[styles.btn, styles.addBtn]} onPress={abrirAlarmPicker}>
        <Text style={styles.btnText}>+ Adicionar Alarme</Text>
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
              <Text style={styles.displayText}>{tempHour.padStart(2, "0") || "--"}</Text>
              <Text style={styles.modalDots}>:</Text>
              <Text style={styles.displayText}>{tempMinute.padStart(2, "0") || "--"}</Text>
            </View>

            <View style={{ flexDirection: "row", justifyContent: "space-between", width: "100%", marginBottom: 10 }}>
              {dias.map((d, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.dayBtn,
                    tempDay === i && { backgroundColor: "#41A579" },
                  ]}
                  onPress={() => setTempDay(i)}
                >
                  <Text style={{ color: "#fff", fontSize: 14 }}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: "row", justifyContent: "space-between", width: "100%", marginBottom: 10 }}>
              {[0, 1, 2, 3].map((led) => (
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
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map((num) => (
                <TouchableOpacity key={num} style={styles.key} onPress={() => adicionarNumero(num)}>
                  <Text style={styles.keyText}>{num}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.key} onPress={apagar}>
                <Text style={styles.keyText}>⌫</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.btn, styles.addBtn, { backgroundColor: "#555", flex: 1 }]}
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
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, backgroundColor: "#1c1c1c" },
  title: { fontSize: 22, marginBottom: 10, fontWeight: "600", color: "#fff", textAlign: "center" },
  hora: { fontSize: 14, marginBottom: 20, color: "#aaa", textAlign: "center" },
  alarmCard: { backgroundColor: "#41A579", borderRadius: 16, padding: 20, marginBottom: 16 },
  alarmTitle: { fontSize: 22, fontWeight: "700", color: "#fff" },
  alarmName: { color: "#fff", opacity: 0.8, fontSize: 14 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  btn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  addBtn: { backgroundColor: "#2C674D", marginTop: 10 },
  status: { marginTop: 20, fontSize: 14, textAlign: "center", color: "#aaa" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  modalBox: { backgroundColor: "#2c2c2c", padding: 20, borderRadius: 12, width: "80%", alignItems: "center" },
  modalTitle: { color: "#fff", fontSize: 18, marginBottom: 12 },
  input: { width: "100%", backgroundColor: "#3c3c3c", color: "#fff", borderRadius: 10, padding: 10, marginBottom: 16, fontSize: 16 },
  modalRow: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  displayText: { fontSize: 40, color: "#fff", fontWeight: "700", width: 60, textAlign: "center" },
  modalDots: { color: "#fff", fontSize: 28, marginHorizontal: 8 },
  keypad: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginBottom: 20 },
  key: { backgroundColor: "#444", width: "28%", margin: "2%", aspectRatio: 1, justifyContent: "center", alignItems: "center", borderRadius: 12 },
  keyText: { color: "#fff", fontSize: 24, fontWeight: "600" },
  modalButtons: { flexDirection: "row", width: "100%", gap: 8 },
  dayBtn: { backgroundColor: "#333", padding: 8, borderRadius: 10, alignItems: "center", flex: 1, marginHorizontal: 4 },
});
