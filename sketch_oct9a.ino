#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <WiFiManager.h>
#include <time.h>

ESP8266WebServer server(80);

const int ledPins[8] = { 16, 5, 4, 0, 2, 14, 12, 13 };
const int buzzerPin = 15;

struct Alarm {
  int id;
  int hour;
  int minute;
  uint8_t ledIndex;
  bool enabled;
  int lastTriggeredDay;
  char name[32];
};

const int MAX_ALARMS = 16;
Alarm alarms[MAX_ALARMS];
int alarmCount = 0;

bool alarmActive = false;
int activeAlarmIdx = -1;
unsigned long alarmStartMs = 0;

const unsigned long alarmDurationMs = 180000UL;
const unsigned long sequenceRepeatMs = 5000UL;

bool playingSequence = false;
unsigned long seqStartMs = 0;
int seqStage = 0;
unsigned long lastSequenceRepeat = 0;

// ------------------ WIFI AUTOMÁTICO ------------------

void setupWiFiAutomatico() {
  Serial.println("Iniciando WiFiManager...");

  WiFiManager wm;

  wm.setConnectTimeout(10);
  wm.setConfigPortalTimeout(300);

  // AP fixo com senha
  bool conectado = wm.autoConnect("Medtime", "12345678");

  if (!conectado) {
    Serial.println("Falha ao conectar. Aguardando configuração...");
  } else {
    Serial.println("WiFi conectado!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
  }
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
  tone(buzzerPin, 2000, 300);
  delay(500);
  tone(buzzerPin, 1500, 300);
  delay(500);
  tone(buzzerPin, 2500, 300);
  delay(200);
  noTone(buzzerPin);
}

void startSequenceNow() {
  playingSequence = true;
  seqStartMs = millis();
  seqStage = 1;
  tone(buzzerPin, 2000, 300);
  lastSequenceRepeat = millis();
}

void stopActiveAlarm() {
  if (alarmActive && activeAlarmIdx >= 0 && activeAlarmIdx < alarmCount) {
    digitalWrite(ledPins[alarms[activeAlarmIdx].ledIndex], LOW);
  }
  alarmActive = false;
  activeAlarmIdx = -1;
  playingSequence = false;
  seqStage = 0;
  noTone(buzzerPin);
}

void triggerAlarmStart(int idx) {
  if (idx < 0 || idx >= alarmCount) return;

  if (alarmActive) stopActiveAlarm();

  alarmActive = true;
  activeAlarmIdx = idx;
  alarmStartMs = millis();
  lastSequenceRepeat = 0;
  playingSequence = false;
  seqStage = 0;

  digitalWrite(ledPins[alarms[idx].ledIndex], HIGH);

  startSequenceNow();
}

void addOrUpdateAlarmFromArgs() {
  if (!server.hasArg("hour") || !server.hasArg("minute") || !server.hasArg("led")) {
    server.send(400, "text/plain", "missing params");
    return;
  }

  int hour = server.arg("hour").toInt();
  int minute = server.arg("minute").toInt();
  int led = server.arg("led").toInt();
  String name = server.hasArg("name") ? server.arg("name") : "Alarme";
  int id = server.hasArg("id") ? server.arg("id").toInt() : -1;
  bool enabled = !server.hasArg("enabled") || server.arg("enabled") != "0";

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || led < 0 || led > 7) {
    server.send(400, "text/plain", "invalid params");
    return;
  }

  if (id >= 0) {
    for (int i = 0; i < alarmCount; i++) {
      if (alarms[i].id == id) {
        alarms[i].hour = hour;
        alarms[i].minute = minute;
        alarms[i].ledIndex = led;
        alarms[i].enabled = enabled;
        strncpy(alarms[i].name, name.c_str(), sizeof(alarms[i].name) - 1);
        playConfirmationSequenceBlocking();
        server.send(200, "text/plain", "updated");
        return;
      }
    }
  }

  if (alarmCount < MAX_ALARMS) {
    alarms[alarmCount].id = alarmCount;
    alarms[alarmCount].hour = hour;
    alarms[alarmCount].minute = minute;
    alarms[alarmCount].ledIndex = led;
    alarms[alarmCount].enabled = enabled;
    strncpy(alarms[alarmCount].name, name.c_str(), sizeof(alarms[alarmCount].name) - 1);
    alarms[alarmCount].lastTriggeredDay = -1;
    alarmCount++;
    playConfirmationSequenceBlocking();
    server.send(200, "text/plain", "added");
  } else {
    server.send(400, "text/plain", "full");
  }
}

void handleListAlarms() {
  String s = "[";
  for (int i = 0; i < alarmCount; i++) {
    Alarm& a = alarms[i];
    s += "{";
    s += "\"id\":" + String(a.id) + ",";
    s += "\"hour\":" + String(a.hour) + ",";
    s += "\"minute\":" + String(a.minute) + ",";
    s += "\"led\":" + String(a.ledIndex) + ",";
    s += "\"enabled\":" + String(a.enabled ? "true" : "false") + ",";
    s += "\"name\":\"" + String(a.name) + "\"";
    s += "}";
    if (i < alarmCount - 1) s += ",";
  }
  s += "]";
  server.send(200, "application/json", s);
}

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
  s += "\"led\":" + String(a.ledIndex) + ",";
  s += "\"name\":\"" + String(a.name) + "\"";
  s += "}";
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
    if (alarms[i].id != id) alarms[writeIdx++] = alarms[i];
  }

  alarmCount = writeIdx;
  playConfirmationSequenceBlocking();
  server.send(200, "text/plain", "deleted");
}

void handleStopAlarm() {
  stopActiveAlarm();
  server.send(200, "text/plain", "stopped");
}

// ---------- STATUS ----------
void handleStatus() {
  time_t now = time(nullptr);
  struct tm* t = localtime(&now);

  char timeStr[6];
  snprintf(timeStr, sizeof(timeStr), "%02d:%02d", t->tm_hour, t->tm_min);

  String json = "{";
  json += "\"time\":\"" + String(timeStr) + "\",";
  json += "\"wifi\":\"" + String(WiFi.status() == WL_CONNECTED ? "connected" : "disconnected") + "\"";
  json += "}";

  server.send(200, "application/json", json);
}

// ------------------ SETUP ------------------

void setup() {
  Serial.begin(115200);
  delay(500);

  setupPins();
  setupWiFiAutomatico();

  configTime(-3 * 3600, 0, "pool.ntp.org", "time.nist.gov");

  server.on("/setAlarm", HTTP_POST, addOrUpdateAlarmFromArgs);
  server.on("/listAlarms", HTTP_GET, handleListAlarms);
  server.on("/deleteAlarm", HTTP_POST, handleDeleteAlarm);
  server.on("/stopAlarm", HTTP_POST, handleStopAlarm);
  server.on("/active", HTTP_GET, handleActive);
  server.on("/status", HTTP_GET, handleStatus);

  server.begin();
}

// ------------------ LOOP ------------------

void loop() {
  server.handleClient();

  time_t now = time(nullptr);
  struct tm* t = localtime(&now);

  int today = t->tm_yday;

  for (int i = 0; i < alarmCount; i++) {
    Alarm& a = alarms[i];
    if (!a.enabled) continue;

    if (a.hour == t->tm_hour && a.minute == t->tm_min && t->tm_sec <= 2) {
      if (a.lastTriggeredDay != today) {
        a.lastTriggeredDay = today;
        triggerAlarmStart(i);
      }
    }
  }

  if (alarmActive && activeAlarmIdx >= 0) {
    if (millis() - alarmStartMs >= alarmDurationMs) {
      stopActiveAlarm();
    } else {
      if (!playingSequence && millis() - lastSequenceRepeat >= sequenceRepeatMs) {
        startSequenceNow();
      }

      if (playingSequence) {
        unsigned long dt = millis() - seqStartMs;

        if (seqStage == 1 && dt >= 800) {
          tone(buzzerPin, 1500, 300);
          seqStage = 2;
        } else if (seqStage == 2 && dt >= 1600) {
          tone(buzzerPin, 2500, 300);
          seqStage = 3;
        } else if (seqStage == 3 && dt >= 1900) {
          playingSequence = false;
          seqStage = 0;
          lastSequenceRepeat = millis();
        }
      }
    }
  }

  delay(50);
}