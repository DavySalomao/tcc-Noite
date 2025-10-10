// alarm_esp8266.ino
#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <ESP8266_ISR_Servo.h>
#include <time.h>

// ===== Config Wi-Fi =====
const char* SSID = "Casa";
const char* PASSWORD = "flavinho1982";

ESP8266WebServer server(80);

// ===== Pinos (GPIO numbers) =====
const int ledPin = 5;      // GPIO5 (D1)
const int buzzerPin = 4;   // GPIO4 (D2)
const int servoPin = 14;   // GPIO14 (D5)

// ===== Servo (ESP8266 ISR library) =====
ESP8266ISRServo servo;     // requer instalação de ESP8266_ISR_Servo

// ===== Estado do alarme =====
int alarmHour = -1;
int alarmMinute = -1;
bool alarmSet = false;
bool alarmTriggered = false;

// ===== Funções utilitárias =====
void fazerBip(int ms = 150) {
  digitalWrite(buzzerPin, HIGH);
  delay(ms);
  digitalWrite(buzzerPin, LOW);
}

void girarServoIdaVolta() {
  for (int p = 0; p <= 180; p += 5) {
    servo.write(p);
    delay(10);
  }
  for (int p = 180; p >= 0; p -= 5) {
    servo.write(p);
    delay(10);
  }
  servo.write(0);
}

// ===== Ação do alarme =====
void triggerAlarm() {
  Serial.println("⏰ Alarme disparado!");

  // pisca LED e buzzer 3 vezes
  for (int i = 0; i < 3; ++i) {
    digitalWrite(ledPin, HIGH);
    digitalWrite(buzzerPin, HIGH);
    delay(300);
    digitalWrite(ledPin, LOW);
    digitalWrite(buzzerPin, LOW);
    delay(300);
  }

  // um bip curto extra
  fazerBip(200);

  // movimento do servo (180 ida + 180 volta = "360" visual)
  girarServoIdaVolta();

  Serial.println("✅ Ação do alarme concluída!");
}

// ===== Endpoints HTTP =====
void handleStatus() {
  time_t now = time(nullptr);
  struct tm* t = localtime(&now);
  char buf[6];
  sprintf(buf, "%02d:%02d", t->tm_hour, t->tm_min);

  String json = "{";
  json += "\"horaAtual\":\"" + String(buf) + "\",";
  json += "\"alarmSet\":" + String(alarmSet ? "true" : "false") + ",";
  json += "\"alarmTime\":\"" + String(alarmHour < 0 ? "--:--" : (String(alarmHour).padStart(2,'0') + ":" + String(alarmMinute).padStart(2,'0'))) + "\"";
  json += "}";

  server.send(200, "application/json", json);
}

void handleSetAlarm() {
  // espera application/x-www-form-urlencoded com hour e minute
  if (server.hasArg("hour") && server.hasArg("minute") &&
      server.arg("hour") != "" && server.arg("minute") != "") {
    int h = server.arg("hour").toInt();
    int m = server.arg("minute").toInt();
    if (h < 0 || h > 23 || m < 0 || m > 59) {
      server.send(400, "text/plain", "Parâmetros inválidos (hour 0-23, minute 0-59)");
      return;
    }
    alarmHour = h;
    alarmMinute = m;
    alarmSet = true;
    alarmTriggered = false;
    Serial.printf("Alarme definido para %02d:%02d\n", alarmHour, alarmMinute);
    // feedback imediato
    fazerBip(100);
    delay(100);
    fazerBip(100);
    server.send(200, "text/plain", "Alarme definido");
  } else {
    server.send(400, "text/plain", "Parâmetros ausentes (hour, minute)");
  }
}

void handleAlarmStatus() {
  String s = "{";
  s += "\"alarmSet\":" + String(alarmSet ? "true" : "false") + ",";
  if (alarmSet) {
    char buf[6]; sprintf(buf, "%02d:%02d", alarmHour, alarmMinute);
    s += "\"alarmTime\":\"" + String(buf) + "\",";
  } else {
    s += "\"alarmTime\":\"--:--\",";
  }
  s += "\"alarmTriggered\":" + String(alarmTriggered ? "true" : "false");
  s += "}";
  server.send(200, "application/json", s);
}

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println();
  Serial.println("=== Iniciando ESP8266 Alarm ===");

  pinMode(ledPin, OUTPUT);
  pinMode(buzzerPin, OUTPUT);
  digitalWrite(ledPin, LOW);
  digitalWrite(buzzerPin, LOW);

  // Servo attach com pulse range (ajuste se necessário)
  servo.attach(servoPin, 500, 2400); // minPulse 500µs, maxPulse 2400µs
  servo.write(0);

  // Conexão Wi-Fi
  Serial.print("Conectando a SSID: ");
  Serial.println(SSID);
  WiFi.begin(SSID, PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(250);
    Serial.print(".");
    attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("✅ Wi-Fi conectado");
    Serial.print("IP: "); Serial.println(WiFi.localIP());
    Serial.print("RSSI: "); Serial.print(WiFi.RSSI()); Serial.println(" dBm");
  } else {
    Serial.println();
    Serial.println("❌ Falha Wi-Fi, reiniciando...");
    delay(2000);
    ESP.restart();
  }

  // Configura NTP (fuso -3h)
  configTime(-3 * 3600, 0, "pool.ntp.org", "time.nist.gov");
  Serial.print("Sincronizando hora NTP");
  time_t now = time(nullptr);
  while (now < 1000000000) {
    delay(500);
    Serial.print(".");
    now = time(nullptr);
  }
  Serial.println();
  struct tm* tmnow = localtime(&now);
  Serial.printf("Hora local: %02d:%02d:%02d\n", tmnow->tm_hour, tmnow->tm_min, tmnow->tm_sec);

  // Rotas
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/setAlarm", HTTP_POST, handleSetAlarm);
  server.on("/alarmStatus", HTTP_GET, handleAlarmStatus);
  server.begin();
  Serial.println("Servidor HTTP iniciado na porta 80");
}

void loop() {
  server.handleClient();

  // atualiza hora
  time_t now = time(nullptr);
  struct tm* t = localtime(&now);

  // lógica do alarme: dispara apenas quando segundo == 0 para evitar múltiplos triggers no mesmo minuto
  if (alarmSet && !alarmTriggered) {
    if (t->tm_hour == alarmHour && t->tm_min == alarmMinute && t->tm_sec == 0) {
      triggerAlarm();
      alarmTriggered = true;
    }
  }

  // reseta alarmTriggered quando o minuto muda (permitir disparo no próximo dia)
  if (alarmTriggered) {
    if (t->tm_hour != alarmHour || t->tm_min != alarmMinute) {
      alarmTriggered = false;
    }
  }

  delay(100); // pequeno delay para reduzir uso de CPU
}
