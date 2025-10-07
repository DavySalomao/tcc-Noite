import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Modal,
} from "react-native";

export default function App() {
  const [status, setStatus] = useState("Desconhecido");
  const [horaAtual, setHoraAtual] = useState("");
  const [leds, setLeds] = useState([]);
  const [showPicker, setShowPicker] = useState(null); // {id,tipo}
  const [selectedTimes, setSelectedTimes] = useState({});
  const [tempHour, setTempHour] = useState("");
  const [tempMinute, setTempMinute] = useState("");

  const ESP_IP = "http://192.168.137.28";

  const atualizarStatus = async () => {
    try {
      const res = await fetch(`${ESP_IP}/status`);
      const data = await res.json();
      setHoraAtual(data.horaAtual);
      setLeds(data.leds);
      setStatus("OK");

      const novo = {};
      data.leds.forEach((led) => {
        novo[led.id] = {
          inicio: led.inicio || "--:--",
          fim: led.fim || "--:--",
        };
      });
      setSelectedTimes(novo);
    } catch {
      setStatus("Erro ao conectar");
    }
  };

  useEffect(() => {
    atualizarStatus();
    const intervalo = setInterval(atualizarStatus, 5000);
    return () => clearInterval(intervalo);
  }, []);

  const toggleLED = async (id, value) => {
    try {
      await fetch(`${ESP_IP}/${value ? "on" : "off"}${id}`);
      atualizarStatus();
    } catch {
      setStatus("Erro ao conectar");
    }
  };

  const configurarPeriodo = async (id) => {
    const inicio = selectedTimes[id]?.inicio;
    const fim = selectedTimes[id]?.fim;
    if (!inicio || !fim || inicio === "--:--" || fim === "--:--") {
      setStatus(`LED ${id}: selecione início e fim`);
      return;
    }

    const [hi, mi] = inicio.split(":").map((x) => parseInt(x, 10));
    const [hf, mf] = fim.split(":").map((x) => parseInt(x, 10));

    try {
      const res = await fetch(
        `${ESP_IP}/setperiodo${id}?hi=${hi}&mi=${mi}&hf=${hf}&mf=${mf}`
      );
      const data = await res.json();
      setStatus(data.status || `LED ${id}: Período configurado`);
      atualizarStatus();
    } catch {
      setStatus(`LED ${id}: erro ao configurar período`);
    }
  };

  const abrirPicker = (id, tipo) => {
    setTempHour("");
    setTempMinute("");
    setShowPicker({ id, tipo });
  };

  const salvarPicker = () => {
    let hora = parseInt(tempHour || "0", 10);
    let minuto = parseInt(tempMinute || "0", 10);

    // --- Validação rígida de faixa ---
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

    // --- Formatação padrão ---
    const horaStr = hora.toString().padStart(2, "0");
    const minutoStr = minuto.toString().padStart(2, "0");

    setSelectedTimes({
      ...selectedTimes,
      [showPicker.id]: {
        ...selectedTimes[showPicker.id],
        [showPicker.tipo]: `${horaStr}:${minutoStr}`,
      },
    });

    setShowPicker(null);
    setStatus(`Horário ${showPicker.tipo} definido: ${horaStr}:${minutoStr}`);
  };

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

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Controle dos LEDs</Text>
      <Text style={styles.hora}>Hora atual: {horaAtual}</Text>

      {leds.map((led) => (
        <View key={led.id} style={styles.card}>
          <View style={styles.rowTop}>
            <Text style={styles.subtitle}>
              {selectedTimes[led.id]?.inicio || "--:--"}
            </Text>
            <Switch
              value={led.ligado}
              onValueChange={(val) => toggleLED(led.id, val)}
              trackColor={{ false: "#555", true: "#441AFD" }}
              thumbColor={"#fff"}
            />
          </View>

          <Text style={styles.text}>
            Agendamento: {led.agendamentoAtivo ? "Ativo" : "Inativo"}
          </Text>
          <Text style={styles.text}>
            Início: {selectedTimes[led.id]?.inicio || "--:--"}
          </Text>
          <Text style={styles.text}>
            Fim: {selectedTimes[led.id]?.fim || "--:--"}
          </Text>

          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.btn, styles.scheduleBtn]}
              onPress={() => abrirPicker(led.id, "inicio")}
            >
              <Text style={styles.btnText}>Escolher Início</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.scheduleBtn]}
              onPress={() => abrirPicker(led.id, "fim")}
            >
              <Text style={styles.btnText}>Escolher Fim</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.btn, styles.applyBtn]}
            onPress={() => configurarPeriodo(led.id)}
          >
            <Text style={styles.btnText}>Agendar Período</Text>
          </TouchableOpacity>
        </View>
      ))}

      <Text style={styles.status}>Status: {status}</Text>

      {/* Modal customizado com teclado numérico */}
      <Modal visible={!!showPicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Selecionar horário</Text>

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
                onPress={() => setShowPicker(null)}
              >
                <Text style={styles.btnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: "#2C674D", flex: 1 }]}
                onPress={salvarPicker}
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
});
