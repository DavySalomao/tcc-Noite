#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <ESP8266_ISR_Servo.h>
#include <time.h>

// ===== Config Wi-Fi =====
const char* SSID = "Casa";
const char* PASSWORD = "flavinho1982";

ESP8266WebServer server(80);

// ===== Pinos =====
const int ledPin = 5;      // D1
const int buzzerPin = 4;   // D2
const int servoPin = 14;   // D5

// ===== Servo =====
int servoIndex = -1;

// ===== Estado do alarme =====
int alarmHour = -1;
int alarmMinute = -1;
bool alarmSet = false;
bool alarmTriggered = false;

// ===== Funções =====
void fazerBip(int ms = 150) {
  digitalWrite(buzzerPin, HIGH);
  delay(ms);
  digitalWrite(buzzerPin, LOW);
}

void girarServoIdaVolta() {
  for (int p = 0; p <= 180; p += 5) {
    ISR_Servo.setPosition(servoIndex, p);
    delay(10);
  }
  for (int p = 180; p >= 0; p -= 5) {
    ISR_Servo.setPosition(servoIndex, p);
    delay(10);
  }
  ISR_Servo.setPosition(servoIndex, 0);
}

void triggerAlarm() {
  Serial.println("⏰ Alarme disparado!");

  for (int i = 0; i < 3; ++i) {
    digitalWrite(ledPin, HIGH);
    digitalWrite(buzzerPin, HIGH);
    delay(300);
    digitalWrite(ledPin, LOW);
    digitalWrite(buzzerPin, LOW);
    delay(300);
  }

  fazerBip(200);
  girarServoIdaVolta();

  Serial.println("✅ Ação do alarme concluída!");
}

// ===== HTTP =====
void handleStatus() {
  time_t now = time(nullptr);
  struct tm* t = localtime(&now);
  char buf[6];
  sprintf(buf, "%02d:%02d", t->tm_hour, t->tm_min);

  char alarmBuf[6];
  if (alarmHour >= 0 && alarmMinute >= 0) {
    sprintf(alarmBuf, "%02d:%02d", alarmHour, alarmMinute);
  } else {
    strcpy(alarmBuf, "--:--");
  }

  String json = "{";
  json += "\"horaAtual\":\"" + String(buf) + "\",";
  json += "\"alarmSet\":" + String(alarmSet ? "true" : "false") + ",";
  json += "\"alarmTime\":\"" + String(alarmBuf) + "\"";
  json += "}";

  server.send(200, "application/json", json);
}

void handleSetAlarm() {
  if (server.hasArg("hour") && server.hasArg("minute")) {
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
    fazerBip(100);
    delay(100);
    fazerBip(100);
    server.send(200, "text/plain", "Alarme definido");
  } else {
    server.send(400, "text/plain", "Parâmetros ausentes (hour, minute)");
  }
}

void handleAlarmStatus() {
  char buf[6];
  if (alarmHour >= 0 && alarmMinute >= 0) sprintf(buf, "%02d:%02d", alarmHour, alarmMinute);
  else strcpy(buf, "--:--");

  String s = "{";
  s += "\"alarmSet\":" + String(alarmSet ? "true" : "false") + ",";
  s += "\"alarmTime\":\"" + String(buf) + "\",";
  s += "\"alarmTriggered\":" + String(alarmTriggered ? "true" : "false");
  s += "}";
  server.send(200, "application/json", s);
}

// ===== Setup =====
void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println();
  Serial.println("=== Iniciando ESP8266 Alarm ===");

  pinMode(ledPin, OUTPUT);
  pinMode(buzzerPin, OUTPUT);
  digitalWrite(ledPin, LOW);
  digitalWrite(buzzerPin, LOW);

  servoIndex = ISR_Servo.setupServo(servoPin, 500, 2400);
  if (servoIndex != -1) {
    ISR_Servo.setPosition(servoIndex, 0);
  }

  WiFi.begin(SSID, PASSWORD);
  Serial.print("Conectando a ");
  Serial.println(SSID);
  int tentativas = 0;
  while (WiFi.status() != WL_CONNECTED && tentativas < 40) {
    delay(250);
    Serial.print(".");
    tentativas++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ Wi-Fi conectado");
    Serial.print("IP: "); Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n❌ Falha Wi-Fi, reiniciando...");
    delay(2000);
    ESP.restart();
  }

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

  server.on("/status", HTTP_GET, handleStatus);
  server.on("/setAlarm", HTTP_POST, handleSetAlarm);
  server.on("/alarmStatus", HTTP_GET, handleAlarmStatus);
  server.begin();
  Serial.println("Servidor HTTP iniciado");
}

// ===== Loop =====
void loop() {
  server.handleClient();
  ISR_Servo.run(); // ✅ necessário para manter o servo atualizado

  time_t now = time(nullptr);
  struct tm* t = localtime(&now);

  if (alarmSet && !alarmTriggered) {
    if (t->tm_hour == alarmHour && t->tm_min == alarmMinute && t->tm_sec == 0) {
      triggerAlarm();
      alarmTriggered = true;
    }
  }

  if (alarmTriggered && (t->tm_hour != alarmHour || t->tm_min != alarmMinute)) {
    alarmTriggered = false;
  }

  delay(100);
}
