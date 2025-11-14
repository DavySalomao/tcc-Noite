#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <time.h>

const char* SSID = "Casa";
const char* PASSWORD = "flavinho1982";

ESP8266WebServer server(80);

const int ledPins[8] = { 16, 5, 4, 0, 14, 12, 13, 15 };
const int buzzerPin = 15;                            

// alarm struct
struct Alarm {
  int id;
  int hour;
  int minute;
  uint8_t ledIndex;  // 0–7
  uint8_t dayIndex;  // 0 = Segunda / 1 = Terça
  bool enabled;
  char name[32];
  int lastTriggeredDay;
};

const int MAX_ALARMS = 16;
Alarm alarms[MAX_ALARMS];
int alarmCount = 0;

String diasSemana[2] = { "Segunda-feira", "Terça-feira" };

// estado de alarme ativo (não bloqueante)
bool alarmActive = false;
int activeAlarmIdx = -1;
unsigned long alarmStartMs = 0;
const unsigned long alarmDurationMs = 180000UL;  // 3 minutos
const unsigned long sequenceRepeatMs = 5000UL;   // repetir sequência a cada 5s

// sequência: não bloqueante
bool playingSequence = false;
unsigned long seqStartMs = 0;
int seqStage = 0;  // 0 = idle, 1 após first tone, 2 after second, 3 after third
unsigned long lastSequenceRepeat = 0;

void notFound() {
  server.send(404, "text/plain", "Not found");
}

void setupPins() {
  for (int i = 0; i < 8; i++) {
    pinMode(ledPins[i], OUTPUT);
    digitalWrite(ledPins[i], LOW);
  }
  pinMode(buzzerPin, OUTPUT);
  digitalWrite(buzzerPin, LOW);
}

void playConfirmationSequenceBlocking() {
  // sequência de confirmação (bloqueante curto)
  tone(buzzerPin, 2000, 300);
  delay(500);
  tone(buzzerPin, 1500, 300);
  delay(500);
  tone(buzzerPin, 2500, 300);
  delay(200);
  noTone(buzzerPin);
}

// start a non-blocking sequence immediately
void startSequenceNow() {
  playingSequence = true;
  seqStartMs = millis();
  seqStage = 1;
  tone(buzzerPin, 2000, 300);  // 1º beep
  lastSequenceRepeat = millis();
}

// call to force stop active alarm immediately
void stopActiveAlarm() {
  if (alarmActive && activeAlarmIdx >= 0 && activeAlarmIdx < alarmCount) {
    int led = alarms[activeAlarmIdx].ledIndex;
    digitalWrite(ledPins[led], LOW);
  }
  alarmActive = false;
  activeAlarmIdx = -1;
  playingSequence = false;
  seqStage = 0;
  noTone(buzzerPin);
}

// ----------------- actions -------------------

void triggerAlarmStart(int idx) {
  if (idx < 0 || idx >= alarmCount) return;
  // se já existe outro alarme ativo, ignore ou pare o outro
  if (alarmActive) {
    stopActiveAlarm();
  }
  alarmActive = true;
  activeAlarmIdx = idx;
  alarmStartMs = millis();
  lastSequenceRepeat = 0;
  playingSequence = false;
  seqStage = 0;

  // mensagem no serial (simula envio WhatsApp)
  Serial.println();
  Serial.println("=========== ALERTA DE REMÉDIO ===========");
  Serial.printf("[MENSAGEM] Olá usuário! Já está na hora do remédio \"%s\" do dia %s, LED %d.\n",
                alarms[idx].name,
                diasSemana[alarms[idx].dayIndex].c_str(),
                (alarms[idx].ledIndex % 4) + 1);
  Serial.println("==========================================");
  Serial.println();

  // acende LED (será desligado quando alarmActive for false)
  int led = alarms[idx].ledIndex;
  digitalWrite(ledPins[led], HIGH);

  // já dispara a sequência imediatamente
  startSequenceNow();
}

// ----------------- HTTP handlers ----------------

void addOrUpdateAlarmFromArgs() {
  if (!server.hasArg("hour") || !server.hasArg("minute") || !server.hasArg("led") || !server.hasArg("day")) {
    server.send(400, "text/plain", "missing params");
    return;
  }

  int hour = server.arg("hour").toInt();
  int minute = server.arg("minute").toInt();
  int led = server.arg("led").toInt();  // 0..3 (slot)
  int day = server.arg("day").toInt();  // 0..1
  String name = server.hasArg("name") ? server.arg("name") : "Remédio";
  int id = server.hasArg("id") ? server.arg("id").toInt() : -1;
  bool enabled = !server.hasArg("enabled") || server.arg("enabled") != "0";

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || led < 0 || led > 3 || day < 0 || day > 1) {
    server.send(400, "text/plain", "invalid params");
    return;
  }

  int realLedIndex = led + (day * 4);

  if (id >= 0) {
    for (int i = 0; i < alarmCount; i++) {
      if (alarms[i].id == id) {
        alarms[i].hour = hour;
        alarms[i].minute = minute;
        alarms[i].ledIndex = realLedIndex;
        alarms[i].dayIndex = day;
        alarms[i].enabled = enabled;
        strncpy(alarms[i].name, name.c_str(), sizeof(alarms[i].name) - 1);
        playConfirmationSequenceBlocking();
        server.send(200, "text/plain", "updated");
        return;
      }
    }
  }

  if (alarmCount >= MAX_ALARMS) {
    server.send(500, "text/plain", "full");
    return;
  }

  Alarm& a = alarms[alarmCount++];
  a.id = millis() ^ random(1000, 9999);
  a.hour = hour;
  a.minute = minute;
  a.ledIndex = realLedIndex;
  a.dayIndex = day;
  a.enabled = enabled;
  strncpy(a.name, name.c_str(), sizeof(a.name) - 1);
  a.lastTriggeredDay = -1;

  playConfirmationSequenceBlocking();
  server.send(200, "text/plain", "added");
}

void handleSetAlarm() {
  addOrUpdateAlarmFromArgs();
}

void handleListAlarms() {
  String s = "[";
  for (int i = 0; i < alarmCount; i++) {
    Alarm& a = alarms[i];
    s += "{";
    s += "\"id\":" + String(a.id) + ",";
    s += "\"hour\":" + String(a.hour) + ",";
    s += "\"minute\":" + String(a.minute) + ",";
    s += "\"led\":" + String(a.ledIndex % 4) + ",";
    s += "\"day\":" + String(a.dayIndex) + ",";
    s += "\"enabled\":" + String(a.enabled ? "true" : "false") + ",";
    s += "\"name\":\"" + String(a.name) + "\"";
    s += "}";
    if (i < alarmCount - 1) s += ",";
  }
  s += "]";
  server.send(200, "application/json", s);
}

void handleDeleteAlarm() {
  if (!server.hasArg("id")) {
    server.send(400, "text/plain", "missing id");
    return;
  }
  int id = server.arg("id").toInt();
  int writeIdx = 0;
  for (int i = 0; i < alarmCount; i++) {
    if (alarms[i].id != id) {
      alarms[writeIdx++] = alarms[i];
    }
  }
  alarmCount = writeIdx;
  playConfirmationSequenceBlocking();
  server.send(200, "text/plain", "deleted");
}

void handleStatus() {
  time_t now = time(nullptr);
  struct tm* t = localtime(&now);
  char buf[64];
  sprintf(buf, "{\"hora\":\"%02d:%02d\",\"alarms\":%d}", t->tm_hour, t->tm_min, alarmCount);
  server.send(200, "application/json", String(buf));
}

// retorna alarme ativo (se houver)
void handleActive() {
  if (!alarmActive || activeAlarmIdx < 0 || activeAlarmIdx >= alarmCount) {
    server.send(200, "application/json", "{\"active\":false}");
    return;
  }
  Alarm& a = alarms[activeAlarmIdx];
  String s = "{";
  s += "\"active\":true,";
  s += "\"id\":" + String(a.id) + ",";
  s += "\"hour\":" + String(a.hour) + ",";
  s += "\"minute\":" + String(a.minute) + ",";
  s += "\"led\":" + String(a.ledIndex % 4) + ",";
  s += "\"day\":" + String(a.dayIndex) + ",";
  s += "\"name\":\"" + String(a.name) + "\"";
  s += "}";
  server.send(200, "application/json", s);
}

// para alarme ativo via app
void handleStopAlarm() {
  // optional id param not strictly necessary
  if (server.hasArg("id")) {
    int id = server.arg("id").toInt();
    if (alarmActive && activeAlarmIdx >= 0 && alarms[activeAlarmIdx].id == id) {
      stopActiveAlarm();
      server.send(200, "text/plain", "stopped");
      return;
    }
  } else {
    // stop regardless
    stopActiveAlarm();
    server.send(200, "text/plain", "stopped");
    return;
  }
  server.send(400, "text/plain", "no active");
}

// ----------------- setup / loop ----------------

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n=== Caixa de Remédios ESP (Modo Teste) ===");

  setupPins();

  WiFi.begin(SSID, PASSWORD);
  Serial.print("Conectando-se ao WiFi");

  int tentativas = 0;
  while (WiFi.status() != WL_CONNECTED && tentativas < 60) {
    delay(250);
    Serial.print(".");
    tentativas++;
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("Falha no WiFi");
    ESP.restart();
  }

  configTime(-3 * 3600, 0, "pool.ntp.org", "time.nist.gov");

  server.on("/setAlarm", HTTP_POST, handleSetAlarm);
  server.on("/listAlarms", HTTP_GET, handleListAlarms);
  server.on("/deleteAlarm", HTTP_POST, handleDeleteAlarm);
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/active", HTTP_GET, handleActive);
  server.on("/stopAlarm", HTTP_POST, handleStopAlarm);
  server.onNotFound(notFound);

  server.begin();
  Serial.println("Servidor HTTP iniciado");

  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, HIGH);
}

int dayOfYearNow() {
  time_t now = time(nullptr);
  struct tm* t = localtime(&now);
  return t->tm_yday;
}

void loop() {
  server.handleClient();

  time_t now = time(nullptr);
  struct tm* t = localtime(&now);

  int today = t->tm_yday;
  int weekday = t->tm_wday;  // 0=domingo,1=segunda,2=terca

  // verifica triggers
  for (int i = 0; i < alarmCount; i++) {
    Alarm& a = alarms[i];
    if (!a.enabled) continue;

    bool isCorrectDay =
      (a.dayIndex == 0 && weekday == 1) || (a.dayIndex == 1 && weekday == 2);

    if (isCorrectDay && a.hour == t->tm_hour && a.minute == t->tm_min && t->tm_sec == 0) {

      if (a.lastTriggeredDay != today) {
        a.lastTriggeredDay = today;
        triggerAlarmStart(i);
      }
    }
  }

  // se alarme ativo -> controlar sequência não-bloqueante e terminar após duration ou pedido de stop
  if (alarmActive && activeAlarmIdx >= 0) {
    // desligar se durou mais que duration
    if (millis() - alarmStartMs >= alarmDurationMs) {
      stopActiveAlarm();
    } else {
      // sequência: iniciar se passou interval desde última sequência
      if (!playingSequence && millis() - lastSequenceRepeat >= sequenceRepeatMs) {
        startSequenceNow();
      }

      // controlar etapas da sequência (não bloqueante)
      if (playingSequence) {
        unsigned long dt = millis() - seqStartMs;
        if (seqStage == 1 && dt >= 800) {  // 300ms tone + 500ms gap
          tone(buzzerPin, 1500, 300);
          seqStage = 2;
        } else if (seqStage == 2 && dt >= 1600) {  // +800
          tone(buzzerPin, 2500, 300);
          seqStage = 3;
        } else if (seqStage == 3 && dt >= 1900) {  // after final beep (~300)
          // sequence finished
          playingSequence = false;
          seqStage = 0;
          lastSequenceRepeat = millis();
        }
      }
    }
  }

  delay(50);
}
