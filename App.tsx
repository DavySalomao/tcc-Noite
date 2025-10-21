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
  const [horaAtual, setHoraAtual] = useState("");
  const [status, setStatus] = useState("Desconhecido");
  const [showAlarmPicker, setShowAlarmPicker] = useState(false);
  const [alarms, setAlarms] = useState([]);
  const [tempHour, setTempHour] = useState("");
  const [tempMinute, setTempMinute] = useState("");
  const [tempName, setTempName] = useState("");
  const [tempLed, setTempLed] = useState(0);
  const [editing, setEditing] = useState(null);

  const ESP_IP = "http://192.168.137.247";

  useEffect(() => {
    atualizarStatus();
    carregarAlarmes();
    const intervalo = setInterval(atualizarStatus, 5000);
    return () => clearInterval(intervalo);
  }, []);

  const atualizarStatus = async () => {
    try {
      const res = await fetch(`${ESP_IP}/status`);
      const data = await res.json();
      setHoraAtual(data.horaAtual || "--:--");
      setStatus("Conectado");
    } catch {
      setStatus("Falha na conexão com o ESP");
    }
  };

  const carregarAlarmes = async () => {
    try {
      const res = await fetch(`${ESP_IP}/listAlarms`);
      const data = await res.json();
      setAlarms(data);
      await AsyncStorage.setItem("alarms", JSON.stringify(data));
    } catch {
      const local = await AsyncStorage.getItem("alarms");
      if (local) setAlarms(JSON.parse(local));
    }
  };

  const salvarAlarmesLocal = async (lista) => {
    setAlarms(lista);
    await AsyncStorage.setItem("alarms", JSON.stringify(lista));
  };

  const salvarAlarmeESP = async (alarm) => {
    try {
      await fetch(`${ESP_IP}/setAlarm`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `id=${alarm.id}&name=${alarm.name}&hour=${alarm.hour}&minute=${alarm.minute}&led=${alarm.led}&enabled=${alarm.enabled ? 1 : 0}`,
      });
      atualizarStatus();
    } catch {
      setStatus("Falha ao enviar para o ESP");
    }
  };

  const deletarAlarmeESP = async (id) => {
    try {
      await fetch(`${ESP_IP}/deleteAlarm`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `id=${id}`,
      });
    } catch {
      console.log("Falha ao deletar alarme no ESP");
    }
  };

  const abrirModal = (alarm = null) => {
    setEditing(alarm);
    setTempHour(alarm ? alarm.hour : "");
    setTempMinute(alarm ? alarm.minute : "");
    setTempName(alarm ? alarm.name : "");
    setTempLed(alarm ? alarm.led : 0);
    setShowAlarmPicker(true);
  };

  const salvarNovoAlarme = async () => {
    const hora = parseInt(tempHour || "0", 10);
    const minuto = parseInt(tempMinute || "0", 10);
    const nome = tempName.trim() || "Remédio";

    if (isNaN(hora) || hora > 23 || isNaN(minuto) || minuto > 59) {
      Alert.alert("Erro", "Informe um horário válido entre 00:00 e 23:59.");
      return;
    }

    const novo = {
      id: editing ? editing.id : Date.now(),
      hour: hora.toString().padStart(2, "0"),
      minute: minuto.toString().padStart(2, "0"),
      name: nome,
      led: tempLed,
      enabled: true,
    };

    const atualizados = editing
      ? alarms.map((a) => (a.id === novo.id ? novo : a))
      : [...alarms, novo];

    await salvarAlarmesLocal(atualizados);
    await salvarAlarmeESP(novo);
    setShowAlarmPicker(false);
    setEditing(null);
  };

  const alternarAtivo = async (id) => {
    const atualizados = alarms.map((a) =>
      a.id === id ? { ...a, enabled: !a.enabled } : a
    );
    await salvarAlarmesLocal(atualizados);
    const alterado = atualizados.find((a) => a.id === id);
    await salvarAlarmeESP(alterado);
  };

  const excluirAlarme = async (id) => {
    const novos = alarms.filter((a) => a.id !== id);
    await salvarAlarmesLocal(novos);
    await deletarAlarmeESP(id);
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container}>
      <View style={{ alignItems: "center" }}>
        <Image
          source={require("./assets/images/logoTeste.png")}
          style={{ width: 160, height: 160, resizeMode: "contain" }}
        />
      </View>

      <Text style={styles.title}>Caixa de Remédios</Text>
      <Text style={styles.hora}>Hora atual: {horaAtual}</Text>

      {alarms.map((alarm) => (
        <View key={alarm.id} style={styles.alarmCard}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.alarmTitle}>
                {alarm.hour}:{alarm.minute}
              </Text>
              <Text style={styles.alarmName}>
                {alarm.name} — LED {alarm.led}
              </Text>
            </View>

            <Switch
              value={alarm.enabled}
              onValueChange={() => alternarAtivo(alarm.id)}
              thumbColor={alarm.enabled ? "#41A579" : "#888"}
            />
          </View>

          <View style={styles.rowBetween}>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: "#2C674D", flex: 1, marginRight: 6 }]}
              onPress={() => abrirModal(alarm)}
            >
              <Text style={styles.btnText}>Editar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: "#555", flex: 1 }]}
              onPress={() => excluirAlarme(alarm.id)}
            >
              <Text style={styles.btnText}>Excluir</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <TouchableOpacity style={[styles.btn, styles.addBtn]} onPress={() => abrirModal()}>
        <Text style={styles.btnText}>+ Adicionar Alarme</Text>
      </TouchableOpacity>

      <Text style={styles.status}>Status: {status}</Text>

      {/* Modal */}
      <Modal visible={showAlarmPicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {editing ? "Editar Alarme" : "Novo Alarme"}
            </Text>

            <TextInput
              placeholder="Nome do remédio"
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

            <View style={styles.keypad}>
              {["1","2","3","4","5","6","7","8","9","0"].map((num) => (
                <TouchableOpacity key={num} style={styles.key} onPress={() => {
                  if (tempHour.length < 2) setTempHour(tempHour + num);
                  else if (tempMinute.length < 2) setTempMinute(tempMinute + num);
                }}>
                  <Text style={styles.keyText}>{num}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.key} onPress={() => {
                if (tempMinute.length > 0) setTempMinute(tempMinute.slice(0, -1));
                else if (tempHour.length > 0) setTempHour(tempHour.slice(0, -1));
              }}>
                <Text style={styles.keyText}>⌫</Text>
              </TouchableOpacity>
            </View>

            <Text style={{ color: "#fff", marginBottom: 8 }}>Escolha o LED:</Text>
            <View style={{ flexDirection: "row", justifyContent: "space-around", width: "100%" }}>
              {[0, 1, 2, 3].map((i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.ledBtn,
                    { backgroundColor: tempLed === i ? "#41A579" : "#555" },
                  ]}
                  onPress={() => setTempLed(i)}
                >
                  <Text style={styles.btnText}>LED {i}</Text>
                </TouchableOpacity>
              ))}
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
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  btn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  addBtn: { backgroundColor: "#2C674D", marginTop: 10 },
  status: { marginTop: 20, fontSize: 14, textAlign: "center", color: "#aaa" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  modalBox: { backgroundColor: "#2c2c2c", padding: 20, borderRadius: 12, width: "85%", alignItems: "center" },
  modalTitle: { color: "#fff", fontSize: 18, marginBottom: 12 },
  input: { width: "100%", backgroundColor: "#3c3c3c", color: "#fff", borderRadius: 10, padding: 10, marginBottom: 16, fontSize: 16 },
  modalRow: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  displayText: { fontSize: 40, color: "#fff", fontWeight: "700", width: 60, textAlign: "center" },
  modalDots: { color: "#fff", fontSize: 28, marginHorizontal: 8 },
  keypad: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginBottom: 20 },
  key: { backgroundColor: "#444", width: "28%", margin: "2%", aspectRatio: 1, justifyContent: "center", alignItems: "center", borderRadius: 12 },
  keyText: { color: "#fff", fontSize: 24, fontWeight: "600" },
  modalButtons: { flexDirection: "row", width: "100%", gap: 8 },
  ledBtn: { padding: 10, borderRadius: 10, marginHorizontal: 4, flex: 1, alignItems: "center" },
});
