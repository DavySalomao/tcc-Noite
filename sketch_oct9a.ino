#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <time.h>

const char* SSID = "eduardo";
const char* PASSWORD = "eduardods";

ESP8266WebServer server(80);

const int ledPins[8] = {16, 5, 4, 0, 2, 14, 12, 13}; // D0-D7
const int buzzerPin = 15; // D8

struct Alarm {
  int id;
  int hour;
  int minute;
  uint8_t ledIndex;
  uint8_t dayIndex; // 0 = Segunda, 1 = Terça
  bool enabled;
  char name[32];
  int lastTriggeredDay;
};

const int MAX_ALARMS = 16;
Alarm alarms[MAX_ALARMS];
int alarmCount = 0;

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

void beep(int ms = 150) {
  digitalWrite(buzzerPin, HIGH);
  delay(ms);
  digitalWrite(buzzerPin, LOW);
}

void triggerAlarmAction(int idx) {
  if (idx < 0 || idx >= alarmCount) return;
  Alarm &a = alarms[idx];
  int led = a.ledIndex;
  if (led < 0 || led > 7) return;

  digitalWrite(ledPins[led], HIGH);
  beep(200);
  delay(60000); // LED aceso por 1 minuto
  digitalWrite(ledPins[led], LOW);
}

void addOrUpdateAlarmFromArgs() {
  if (!server.hasArg("hour") || !server.hasArg("minute") || !server.hasArg("led") || !server.hasArg("day")) {
    server.send(400, "text/plain", "missing params");
    return;
  }

  int hour = server.arg("hour").toInt();
  int minute = server.arg("minute").toInt();
  int led = server.arg("led").toInt();
  int day = server.arg("day").toInt(); // 0 = Segunda, 1 = Terça
  String name = server.hasArg("name") ? server.arg("name") : "Remedio";
  int id = server.hasArg("id") ? server.arg("id").toInt() : -1;
  bool enabled = true;
  if (server.hasArg("enabled")) enabled = server.arg("enabled") != "0";

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || led < 0 || led > 3 || day < 0 || day > 1) {
    server.send(400, "text/plain", "invalid params");
    return;
  }

  int realLedIndex = led + (day * 4); // Mapeia LED correto (0–3 segunda, 4–7 terça)

  if (id >= 0) {
    for (int i = 0; i < alarmCount; i++) {
      if (alarms[i].id == id) {
        alarms[i].hour = hour;
        alarms[i].minute = minute;
        alarms[i].ledIndex = realLedIndex;
        alarms[i].dayIndex = day;
        alarms[i].enabled = enabled;
        strncpy(alarms[i].name, name.c_str(), sizeof(alarms[i].name) - 1);
        server.send(200, "text/plain", "updated");
        beep(100);
        return;
      }
    }
  }

  if (alarmCount >= MAX_ALARMS) {
    server.send(500, "text/plain", "full");
    return;
  }

  Alarm &a = alarms[alarmCount++];
  a.id = millis() ^ random(1000, 9999);
  a.hour = hour;
  a.minute = minute;
  a.ledIndex = realLedIndex;
  a.dayIndex = day;
  a.enabled = enabled;
  strncpy(a.name, name.c_str(), sizeof(a.name) - 1);
  a.lastTriggeredDay = -1;

  beep(100);
  server.send(200, "text/plain", "added");
}

void handleSetAlarm() { addOrUpdateAlarmFromArgs(); }

void handleListAlarms() {
  String s = "[";
  for (int i = 0; i < alarmCount; i++) {
    Alarm &a = alarms[i];
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
  beep(100);
  server.send(200, "text/plain", "deleted");
}

void handleStatus() {
  time_t now = time(nullptr);
  struct tm* t = localtime(&now);
  char buf[64];
  sprintf(buf, "{\"hora\":\"%02d:%02d\",\"alarms\":%d}", t->tm_hour, t->tm_min, alarmCount);
  server.send(200, "application/json", String(buf));
}

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n=== Caixa de Remedios ESP (Segunda e Terça) ===");

  setupPins();

  WiFi.begin(SSID, PASSWORD);
  Serial.print("Conectando-se ao Wi-Fi");
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
  server.onNotFound(notFound);
  server.begin();
  Serial.println("Servidor HTTP iniciado");
}

void loop() {
  server.handleClient();

  time_t now = time(nullptr);
  struct tm* t = localtime(&now);
  int today = t->tm_yday;
  int weekday = t->tm_wday; // 0 = domingo, 1 = segunda, 2 = terça...

  for (int i = 0; i < alarmCount; i++) {
    Alarm &a = alarms[i];
    if (!a.enabled) continue;

    // Apenas ativa se for o dia correto
    if ((a.dayIndex == 0 && weekday == 1) || (a.dayIndex == 1 && weekday == 2)) {
      if (a.hour == t->tm_hour && a.minute == t->tm_min && t->tm_sec == 0) {
        if (a.lastTriggeredDay != today) {
          a.lastTriggeredDay = today;
          Serial.printf("Ativando alarme %s (LED %d, Dia %d, %02d:%02d)\n",
                        a.name, a.ledIndex, a.dayIndex, a.hour, a.minute);
          triggerAlarmAction(i);
        }
      }
    }
  }

  delay(200);
}
