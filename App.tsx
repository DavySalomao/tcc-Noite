import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Button, TextInput } from "react-native";

export default function App() {
  const [status, setStatus] = useState("Desconhecido");
  const [horaAtual, setHoraAtual] = useState("");
  const [horaDesligar, setHoraDesligar] = useState("");
  const [ledLigado, setLedLigado] = useState(false);
  const [agendamentoAtivo, setAgendamentoAtivo] = useState(false);

  const [hora, setHora] = useState("");
  const [minuto, setMinuto] = useState("");

  // IP do ESP8266 (ajuste conforme necessário)
  const ESP_IP = "http://192.168.0.2";

  const atualizarStatus = async () => {
    try {
      const res = await fetch(`${ESP_IP}/status`);
      const data = await res.json();
      setHoraAtual(data.horaAtual);
      setHoraDesligar(data.horaDesligar);
      setLedLigado(data.ledLigado);
      setAgendamentoAtivo(data.agendamentoAtivo);
      setStatus("OK");
    } catch (err) {
      setStatus("Erro ao conectar");
    }
  };

  useEffect(() => {
    atualizarStatus();
    const intervalo = setInterval(atualizarStatus, 5000); // atualiza a cada 5s
    return () => clearInterval(intervalo);
  }, []);

  const ligarLED = async () => {
    try {
      await fetch(`${ESP_IP}/on`);
      atualizarStatus();
    } catch (err) {
      setStatus("Erro ao conectar");
    }
  };

  const desligarLED = async () => {
    try {
      await fetch(`${ESP_IP}/off`);
      atualizarStatus();
    } catch (err) {
      setStatus("Erro ao conectar");
    }
  };

  const configurarHora = async () => {
    if (!hora || !minuto) {
      setStatus("Preencha hora e minuto");
      return;
    }
    try {
      await fetch(`${ESP_IP}/sethora?hora=${hora}&minuto=${minuto}`);
      atualizarStatus();
    } catch (err) {
      setStatus("Erro ao configurar hora");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Controle do LED</Text>

      <View style={{ flexDirection: "row", marginBottom: 20 }}>
        <Button title="LED ON" onPress={ligarLED} color="#00cc00" />
        <View style={{ width: 20 }} />
        <Button title="LED OFF" onPress={desligarLED} color="#cc0000" />
      </View>

      <Text style={styles.label}>Configurar horário de desligar:</Text>
      <View style={{ flexDirection: "row", marginBottom: 20 }}>
        <TextInput
          style={styles.input}
          placeholder="Hora"
          keyboardType="numeric"
          value={hora}
          onChangeText={setHora}
        />
        <TextInput
          style={styles.input}
          placeholder="Minuto"
          keyboardType="numeric"
          value={minuto}
          onChangeText={setMinuto}
        />
        <Button title="Agendar" onPress={configurarHora} />
      </View>

      <Text style={styles.text}>Hora atual: {horaAtual}</Text>
      <Text style={styles.text}>Hora programada: {horaDesligar}</Text>
      <Text style={styles.text}>
        LED está: {ledLigado ? "Ligado" : "Desligado"}
      </Text>
      <Text style={styles.text}>
        Agendamento: {agendamentoAtivo ? "Ativo" : "Inativo"}
      </Text>
      <Text style={styles.status}>Status: {status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 20,
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
    fontWeight: "bold",
  },
  label: {
    fontSize: 18,
    marginBottom: 10,
  },
  text: {
    marginTop: 10,
    fontSize: 18,
  },
  status: {
    marginTop: 20,
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 8,
    marginRight: 10,
    width: 70,
    textAlign: "center",
  },
});
