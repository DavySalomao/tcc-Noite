#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <Servo.h>
#include <time.h>

Servo servo;
ESP8266WebServer server(80);

// Pinos usando números GPIO
int ledPin = 5;      // GPIO5 (equivale ao D1 físico)
int buzzerPin = 4;   // GPIO4 (equivale ao D2 físico)  
int servoPin = 14;   // GPIO14 (equivale ao D5 físico)

// Variáveis de controle do alarme
int alarmHour = -1;
int alarmMinute = -1;
bool alarmSet = false;
bool alarmTriggered = false;


void setup() {
  Serial.begin(115200);
  delay(1000); // Aguarda inicialização do Serial
  
  Serial.println("Iniciando ESP8266...");
  
  // Configuração do Wi-Fi - SUBSTITUA pelos seus dados
  WiFi.begin("Casa", "flavinho1982");
  
  Serial.println("Tentando conectar ao Wi-Fi...");
  Serial.println("SSID: SUA_SSID");
  
  int tentativas = 0;
  while (WiFi.status() != WL_CONNECTED && tentativas < 20) {
    delay(500);
    Serial.print(".");
    tentativas++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ Wi-Fi conectado com sucesso!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("RSSI: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
  } else {
    Serial.println("\n❌ Falha ao conectar ao Wi-Fi!");
    Serial.println("Verifique:");
    Serial.println("- SSID e senha corretos");
    Serial.println("- Rede Wi-Fi disponível");
    Serial.println("- Sinal forte o suficiente");
    Serial.println("Tentando novamente em 5 segundos...");
    delay(5000);
    ESP.restart(); // Reinicia o ESP8266
  }

  // Configuração dos pinos
  pinMode(ledPin, OUTPUT);
  pinMode(buzzerPin, OUTPUT);
  servo.attach(servoPin);
  servo.write(0);

  // Configura o horário de Brasília (UTC-3)
  configTime(-3 * 3600, 0, "pool.ntp.org", "time.nist.gov");

  // Endpoint principal para status (compatível com app React Native)
  server.on("/status", HTTP_GET, []() {
    time_t now = time(nullptr);
    struct tm* timeinfo = localtime(&now);
    
    String horaAtual = String(timeinfo->tm_hour) + ":" + 
                      String(timeinfo->tm_min < 10 ? "0" : "") + String(timeinfo->tm_min);
    
    String json = "{";
    json += "\"horaAtual\":\"" + horaAtual + "\",";
    json += "\"leds\":[]";
    json += "}";
    server.send(200, "application/json", json);
  });


  // Endpoint para definir o alarme
  server.on("/setAlarm", HTTP_POST, []() {
    if (server.hasArg("hour") && server.hasArg("minute")) {
      alarmHour = server.arg("hour").toInt();
      alarmMinute = server.arg("minute").toInt();
      alarmSet = true;
      alarmTriggered = false;
      Serial.printf("Alarme definido para %02d:%02d\n", alarmHour, alarmMinute);
      
      // Faz um bip para confirmar que o agendamento foi ativado
      fazerBip();
      
      server.send(200, "text/plain", "Alarme definido com sucesso!");
    } else {
      server.send(400, "text/plain", "Parâmetros ausentes (use hour e minute)");
    }
  });

  // Endpoint para verificar status do alarme
  server.on("/alarmStatus", HTTP_GET, []() {
    String status = "{";
    status += "\"alarmSet\":" + String(alarmSet ? "true" : "false") + ",";
    status += "\"alarmTime\":\"" + String(alarmHour) + ":" + String(alarmMinute) + "\",";
    status += "\"alarmTriggered\":" + String(alarmTriggered ? "true" : "false");
    status += "}";
    server.send(200, "application/json", status);
  });

  server.begin();
  Serial.println("🌐 Servidor HTTP iniciado na porta 80");
  Serial.println("📡 Endpoints disponíveis:");
  Serial.println("  GET  /status");
  Serial.println("  POST /setAlarm");
  Serial.println("  GET  /alarmStatus");
  Serial.println("✅ Sistema pronto!");
}

// Função para fazer um bip no buzzer
void fazerBip() {
  digitalWrite(buzzerPin, HIGH);
  delay(200);
  digitalWrite(buzzerPin, LOW);
}

void loop() {
  server.handleClient();

  // Verifica alarme
  if (alarmSet && !alarmTriggered) {
    time_t now = time(nullptr);
    struct tm* timeinfo = localtime(&now);

    if (timeinfo->tm_hour == alarmHour && timeinfo->tm_min == alarmMinute) {
      triggerAlarm();
      alarmTriggered = true;
    }
  }

}

void triggerAlarm() {
  Serial.println("⏰ Alarme disparado!");

  // LED piscando por 6 ciclos (total ~3.6 segundos)
  for (int i = 0; i < 6; i++) {
    digitalWrite(ledPin, HIGH);
    delay(300);
    digitalWrite(ledPin, LOW);
    delay(300);
  }

  // Buzzer faz apenas 1 bip curto
  digitalWrite(buzzerPin, HIGH);
  delay(200);
  digitalWrite(buzzerPin, LOW);

  // Servo faz 1 rotação de 360° simulada
  for (int i = 0; i <= 180; i++) {
    servo.write(i);
    delay(10);
  }
  for (int i = 180; i >= 0; i--) {
    servo.write(i);
    delay(10);
  }

  Serial.println("✅ Ação do alarme concluída!");
}