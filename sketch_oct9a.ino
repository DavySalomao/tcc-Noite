#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <WiFiManager.h>
#include <time.h>

ESP8266WebServer server(80);

const uint8_t ledPins[8] = { 16, 5, 4, 0, 2, 14, 12, 13 };
const uint8_t buzzerPin = 15;

struct Alarm {
  uint8_t id;
  uint8_t hour;
  uint8_t minute;
  uint8_t ledIndex;
  bool enabled;
  int16_t lastTriggeredDay;
  char name[20];
};

const uint8_t MAX_ALARMS = 16;
Alarm alarms[MAX_ALARMS];
uint8_t alarmCount = 0;

bool alarmActive = false;
int8_t activeAlarmIdx = -1;
unsigned long alarmStartMs = 0;

const unsigned long alarmDurationMs = 180000UL;
const unsigned long sequenceRepeatMs = 5000UL;

bool playingSequence = false;
unsigned long seqStartMs = 0;
uint8_t seqStage = 0;
unsigned long lastSequenceRepeat = 0;


// ----------------------------------------------------------
// WIFI
// ----------------------------------------------------------

void setupWiFiAutomatico() {
  Serial.println("WiFiManager...");

  WiFiManager wm;
  wm.setConnectTimeout(10);
  wm.setConfigPortalTimeout(300);

  bool ok = wm.autoConnect("Medtime", "12345678");

  if (!ok) {
    Serial.println("Aguardando configuração...");
  } else {
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
  }
}


// ----------------------------------------------------------
// PINOS
// ----------------------------------------------------------

void setupPins() {
  for (uint8_t i = 0; i < 8; i++) {
    pinMode(ledPins[i], OUTPUT);
    digitalWrite(ledPins[i], LOW);
  }
  pinMode(buzzerPin, OUTPUT);
  digitalWrite(buzzerPin, LOW);
}


// ----------------------------------------------------------
// SEQUÊNCIA DE CONFIRMAÇÃO (não bloqueante)
// ----------------------------------------------------------

void playConfirmation() {
  tone(buzzerPin, 2000, 120);
  delay(150);
  tone(buzzerPin, 1500, 120);
  delay(150);
  tone(buzzerPin, 2500, 120);
  delay(100);
  noTone(buzzerPin);
}


// ----------------------------------------------------------
// ALARM START/STOP
// ----------------------------------------------------------

void stopActiveAlarm() {
  if (alarmActive && activeAlarmIdx >= 0) {
    digitalWrite(ledPins[alarms[activeAlarmIdx].ledIndex], LOW);
  }
  alarmActive = false;
  activeAlarmIdx = -1;
  playingSequence = false;
  seqStage = 0;
  noTone(buzzerPin);
}

void startSequenceNow() {
  playingSequence = true;
  seqStartMs = millis();
  seqStage = 1;
  tone(buzzerPin, 2000, 300);
  lastSequenceRepeat = millis();
}

void triggerAlarmStart(uint8_t idx) {
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


// ----------------------------------------------------------
// HTTP HANDLERS
// ----------------------------------------------------------

void addOrUpdateAlarm() {
  if (!server.hasArg("hour") || !server.hasArg("minute") || !server.hasArg("led")) {
    server.send(400, "text/plain", "missing");
    return;
  }

  uint8_t hour = server.arg("hour").toInt();
  uint8_t minute = server.arg("minute").toInt();
  uint8_t led = server.arg("led").toInt();
  const String name = server.hasArg("name") ? server.arg("name") : "Alarme";

  if (hour > 23 || minute > 59 || led > 7) {
    server.send(400, "text/plain", "invalid");
    return;
  }

  bool update = server.hasArg("id");
  uint8_t id = server.arg("id").toInt();

  if (update) {
    for (uint8_t i = 0; i < alarmCount; i++) {
      if (alarms[i].id == id) {
        alarms[i].hour = hour;
        alarms[i].minute = minute;
        alarms[i].ledIndex = led;
        alarms[i].enabled = true;
        strncpy(alarms[i].name, name.c_str(), sizeof(alarms[i].name) - 1);
        playConfirmation();
        server.send(200, "text/plain", "ok");
        return;
      }
    }
  }

  if (alarmCount >= MAX_ALARMS) {
    server.send(400, "text/plain", "full");
    return;
  }

  Alarm &a = alarms[alarmCount];
  a.id = alarmCount;
  a.hour = hour;
  a.minute = minute;
  a.ledIndex = led;
  a.enabled = true;
  a.lastTriggeredDay = -1;
  strncpy(a.name, name.c_str(), sizeof(a.name) - 1);

  alarmCount++;

  playConfirmation();
  server.send(200, "text/plain", "ok");
}

void listAlarms() {
  char buffer[700];
  uint16_t pos = 0;

  pos += snprintf(buffer + pos, sizeof(buffer) - pos, "[");

  for (uint8_t i = 0; i < alarmCount; i++) {
    Alarm &a = alarms[i];
    pos += snprintf(buffer + pos, sizeof(buffer) - pos,
      "{\"id\":%d,\"hour\":%d,\"minute\":%d,\"led\":%d,\"enabled\":%d,\"name\":\"%s\"}%s",
      a.id, a.hour, a.minute, a.ledIndex, a.enabled, a.name,
      (i < alarmCount - 1 ? "," : "")
    );
  }

  snprintf(buffer + pos, sizeof(buffer) - pos, "]");
  server.send(200, "application/json", buffer);
}

void handleStatus() {
  time_t now = time(nullptr);
  struct tm* t = localtime(&now);

  char out[60];
  snprintf(out, sizeof(out),
           "{\"time\":\"%02d:%02d\",\"wifi\":\"%s\"}",
           t->tm_hour, t->tm_min,
           WiFi.isConnected() ? "connected" : "disconnected");

  server.send(200, "application/json", out);
}

void deleteAlarm() {
  if (!server.hasArg("id")) {
    server.send(400, "text/plain", "missing");
    return;
  }

  uint8_t id = server.arg("id").toInt();
  uint8_t w = 0;

  for (uint8_t i = 0; i < alarmCount; i++) {
    if (alarms[i].id != id) {
      alarms[w++] = alarms[i];
    }
  }

  alarmCount = w;
  playConfirmation();
  server.send(200, "text/plain", "ok");
}


// ----------------------------------------------------------
// SETUP
// ----------------------------------------------------------

void setup() {
  Serial.begin(115200);
  delay(200);

  setupPins();
  setupWiFiAutomatico();

  configTime(-3 * 3600, 0, "pool.ntp.org", "time.nist.gov");

  server.on("/setAlarm", HTTP_POST, addOrUpdateAlarm);
  server.on("/listAlarms", HTTP_GET, listAlarms);
  server.on("/deleteAlarm", HTTP_POST, deleteAlarm);
  server.on("/stopAlarm", HTTP_POST, []() { stopActiveAlarm(); server.send(200, "text/plain", "ok"); });
  server.on("/active", HTTP_GET, []() {
    if (!alarmActive || activeAlarmIdx < 0) {
      server.send(200, "application/json", "{\"active\":false}");
      return;
    }

    Alarm &a = alarms[activeAlarmIdx];
    char out[120];
    snprintf(out, sizeof(out),
             "{\"active\":true,\"id\":%d,\"hour\":%d,\"minute\":%d,\"led\":%d,\"name\":\"%s\"}",
             a.id, a.hour, a.minute, a.ledIndex, a.name);

    server.send(200, "application/json", out);
  });

  server.begin();
}


// ----------------------------------------------------------
// LOOP
// ----------------------------------------------------------

void loop() {
  server.handleClient();

  time_t now = time(nullptr);
  struct tm* t = localtime(&now);
  uint16_t today = t->tm_yday;

  for (uint8_t i = 0; i < alarmCount; i++) {
    Alarm &a = alarms[i];
    if (!a.enabled) continue;

    if (a.hour == t->tm_hour &&
        a.minute == t->tm_min &&
        t->tm_sec <= 2 &&
        a.lastTriggeredDay != today)
    {
      a.lastTriggeredDay = today;
      triggerAlarmStart(i);
    }
  }

  if (alarmActive) {
    if (millis() - alarmStartMs >= alarmDurationMs) {
      stopActiveAlarm();
    }

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

  delay(30);
}
