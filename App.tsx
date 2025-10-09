import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Modal,
  Image
} from "react-native";

export default function App() {
  const [status, setStatus] = useState("Desconhecido");
  const [horaAtual, setHoraAtual] = useState("");
  const [tempHour, setTempHour] = useState("");
  const [tempMinute, setTempMinute] = useState("");
  
  // Estados do alarme
  const [alarmTime, setAlarmTime] = useState({ hour: "", minute: "" });
  const [alarmSet, setAlarmSet] = useState(false);
  const [showAlarmPicker, setShowAlarmPicker] = useState(false);

  const ESP_IP = "http://192.168.0.4";

  const atualizarStatus = async () => {
    try {
      const res = await fetch(`${ESP_IP}/status`);
      const data = await res.json();
      setHoraAtual(data.horaAtual);
      setStatus("OK");
    } catch {
      setStatus("Erro ao conectar");
    }
  };

  useEffect(() => {
    atualizarStatus();
    const intervalo = setInterval(atualizarStatus, 5000);
    return () => clearInterval(intervalo);
  }, []);



  const adicionarNumero = (num) => {
    if (tempHour.length < 2) {
      setTempHour(tempHour + num);
    } else if (tempMinute.length < 2) {
      setTempMinute(tempMinute + num);
    }
  };

  const apagar = () => {
    if (tempMinute.length > 0) {
      setTempMinute(tempMinute.slice(0, -1));
    } else if (tempHour.length > 0) {
      setTempHour(tempHour.slice(0, -1));
    }
  };

  // Funções do alarme

  const abrirAlarmPicker = () => {
    setTempHour("");
    setTempMinute("");
    setShowAlarmPicker(true);
  };

  const salvarAlarmPicker = async () => {
    let hora = parseInt(tempHour || "0", 10);
    let minuto = parseInt(tempMinute || "0", 10);

    if (isNaN(hora) || isNaN(minuto)) {
      setStatus("Horário inválido — insira números válidos");
      return;
    }

    if (hora < 0 || hora > 23) {
      setStatus("Hora inválida (use 00–23)");
      return;
    }

    if (minuto < 0 || minuto > 59) {
      setStatus("Minuto inválido (use 00–59)");
      return;
    }

    const horaStr = hora.toString().padStart(2, "0");
    const minutoStr = minuto.toString().padStart(2, "0");

    setAlarmTime({ hour: horaStr, minute: minutoStr });
    setShowAlarmPicker(false);
    
    // Configura automaticamente o alarme no ESP8266
    try {
      const response = await fetch(`${ESP_IP}/setAlarm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `hour=${hora}&minute=${minuto}`
      });

      if (response.ok) {
        setAlarmSet(true);
        setStatus(`Alarme configurado para ${horaStr}:${minutoStr}`);
      } else {
        setStatus("Erro ao configurar alarme");
      }
    } catch (error) {
      setStatus("Erro de conexão ao configurar alarme");
    }
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container}>
      <View style={{ alignItems: 'center' }}>
        <Image
          source={require('./assets/images/logoTeste.png')}
          style={{ width: 180, height: 180, resizeMode: 'contain' }}
        />
      </View>
      <Text style={styles.title}>Alarme Medicinal</Text>
      <Text style={styles.hora}>Hora atual: {horaAtual}</Text>

      {/* Seção do Alarme */}
      <View style={styles.alarmCard}>
        <Text style={styles.alarmTitle}>REMEDIO X</Text>
        <Text style={styles.text}>
          Alarme: {alarmSet ? `${alarmTime.hour}:${alarmTime.minute}` : "Não configurado"}
        </Text>
        
        <View style={styles.alarmButtonContainer}>
          <TouchableOpacity
          style={[styles.btn, styles.alarmBtn]}
          onPress={abrirAlarmPicker}
        >
          <Text style={styles.btnText}>Definir Horário</Text>
        </TouchableOpacity>
        </View>
      </View>


      <Text style={styles.status}>Status: {status}</Text>


      {/* Modal para seleção de horário do alarme */}
      <Modal visible={showAlarmPicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Definir horário do alarme</Text>

            {/* Display da hora/minuto */}
            <View style={styles.modalRow}>
              <Text style={styles.displayText}>
                {tempHour.padStart(2, "0") || "--"}
              </Text>
              <Text style={styles.modalDots}>:</Text>
              <Text style={styles.displayText}>
                {tempMinute.padStart(2, "0") || "--"}
              </Text>
            </View>

            {/* Teclado numérico */}
            <View style={styles.keypad}>
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map((num) => (
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

            {/* Botões Cancelar / OK */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: "#555", flex: 1 }]}
                onPress={() => setShowAlarmPicker(false)}
              >
                <Text style={styles.btnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: "#FF6B35", flex: 1 }]}
                onPress={salvarAlarmPicker}
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
  container: {
    flexGrow: 1,
    padding: 16,
    backgroundColor: "#1c1c1c",
  },
  title: {
    fontSize: 22,
    marginBottom: 10,
    fontWeight: "600",
    color: "#fff",
  },
  hora: {
    fontSize: 14,
    marginBottom: 20,
    color: "#aaa",
  },
  card: {
    backgroundColor: "#41A579",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  subtitle: {
    fontSize: 36,
    fontWeight: "700",
    color: "#fff",
  },
  text: {
    fontSize: 14,
    color: "#ddd",
    marginTop: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginHorizontal: 4,
    alignItems: "center",
  },
  scheduleBtn: { backgroundColor: "#2C674D", flex: 1 },
  applyBtn: { backgroundColor: "#2C674D", marginTop: 16 },
  btnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
    textAlign: "center",
  },
  status: {
    marginTop: 20,
    fontSize: 14,
    textAlign: "center",
    color: "#aaa",
  },
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
  modalTitle: {
    color: "#fff",
    fontSize: 18,
    marginBottom: 16,
  },
  modalRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  displayText: {
    fontSize: 40,
    color: "#fff",
    fontWeight: "700",
    width: 60,
    textAlign: "center",
  },
  modalDots: {
    color: "#fff",
    fontSize: 28,
    marginHorizontal: 8,
  },
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
  keyText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "600",
  },
  modalButtons: {
    flexDirection: "row",
    width: "100%",
    gap: 8,
  },
  alarmCard: {
    backgroundColor: "#41A579",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  alarmTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
  },
  alarmBtn: { 
    backgroundColor: "#2C674D", 
    flex: 1 
  },
  alarmButtonContainer: {
    marginTop: 16,
  },
});
