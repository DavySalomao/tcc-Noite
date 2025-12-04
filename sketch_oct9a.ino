#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <ESP8266mDNS.h>
#include <WiFiManager.h>
#include <time.h>

ESP8266WebServer server(80);
WiFiManager wifiManager;

// Mapeamento dos LEDs aos pinos do ESP8266
// LED 1 -> D6 (GPIO12)
// LED 2 -> D4 (GPIO2)
// LED 3 -> D3 (GPIO0)
// LED 4 -> D0 (GPIO16)
// LED 5 -> D7 (GPIO13)
// LED 6 -> D5 (GPIO14)
// LED 7 -> D2 (GPIO4)
// LED 8 -> D1 (GPIO5)

const uint8_t ledPins[8] = { 12, 2, 0, 16, 13, 14, 4, 5 };
const uint8_t buzzerPin = 15; 
const char* mdnsName = "medtime";

struct Alarm {
  uint8_t id;
  uint8_t hour;
  uint8_t minute;
  uint8_t ledIndex;
  bool enabled;
  int16_t lastTriggeredDay;
  char name[20];
  bool isActiveNow;
};

const uint8_t MAX_ALARMS = 16;
Alarm alarms[MAX_ALARMS];
uint8_t alarmCount = 0;

bool alarmActive = false;
unsigned long alarmStartMs = 0;

const unsigned long alarmDurationMs = 180000UL;
const unsigned long sequenceRepeatMs = 5000UL;

bool playingSequence = false;
unsigned long seqStartMs = 0;
uint8_t seqStage = 0;
unsigned long lastSequenceRepeat = 0;

void setupWiFi() {
  Serial.println("========================================");
  Serial.println("    MEDTIME - Configuração WiFi");
  Serial.println("========================================");
  
  wifiManager.setAPCallback([](WiFiManager *myWiFiManager) {
    Serial.println("📡 Modo de configuração ativado!");
    Serial.println("========================================");
    Serial.println("Conecte-se à rede WiFi: MedTime");
    Serial.println("Acesse: http://192.168.4.1");
    Serial.println("Configure sua rede WiFi");
    Serial.println("========================================");
    
    tone(buzzerPin, 1000);
    delay(200);
    noTone(buzzerPin);
    delay(100);
    tone(buzzerPin, 1500);
    delay(200);
    noTone(buzzerPin);
  });
  
  wifiManager.setSaveConfigCallback([]() {
    Serial.println("✓ Configuração WiFi salva!");
    Serial.println("Conectando à rede...");
  });
  
  wifiManager.setConfigPortalTimeout(180);
  
  if (!wifiManager.autoConnect("MedTime", "12345678")) {
    Serial.println("✗ Falha ao conectar. Reiniciando...");
    delay(3000);
    ESP.restart();
  }
  
  Serial.println("========================================");
  Serial.println("✅ CONECTADO À REDE WIFI!");
  Serial.println("========================================");
  Serial.print("SSID: ");
  Serial.println(WiFi.SSID());
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
  Serial.print("RSSI: ");
  Serial.print(WiFi.RSSI());
  Serial.println(" dBm");
  Serial.println("========================================");
  
  if (MDNS.begin(mdnsName)) {
    Serial.println("✓ mDNS iniciado com sucesso!");
    Serial.print("Acesse: http://");
    Serial.print(mdnsName);
    Serial.println(".local");
    
    MDNS.addService("http", "tcp", 80);
    
    Serial.println("========================================");
  } else {
    Serial.println("✗ Erro ao iniciar mDNS");
  }
  
  playConfirmation();
}

void handleResetWiFi() {
  addCORSHeaders();
  
  Serial.println("=== Resetando configurações WiFi ===");
  
  wifiManager.resetSettings();
  
  server.send(200, "application/json", "{\"success\":true,\"message\":\"wifi_reset\"}");
  
  Serial.println("Configurações WiFi limpas!");
  Serial.println("Reiniciando...");
  
  delay(2000);
  ESP.restart();
}

void setupPins() {
  Serial.println("=== Configurando pinos ===");
  
  pinMode(buzzerPin, OUTPUT);
  digitalWrite(buzzerPin, LOW);
  
  for (uint8_t i = 0; i < 8; i++) {
    pinMode(ledPins[i], OUTPUT);
    digitalWrite(ledPins[i], LOW);
  }
  
  Serial.println("✓ Pinos configurados");
}

void addCORSHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}


void playConfirmation() {
  // Tom 1
  tone(buzzerPin, 2000);
  delay(150);
  noTone(buzzerPin);
  delay(50);
  
  // Tom 2
  tone(buzzerPin, 1500);
  delay(150);
  noTone(buzzerPin);
  delay(50);
  
  // Tom 3
  tone(buzzerPin, 2500);
  delay(150);
  noTone(buzzerPin);
}

void setLed(uint8_t ledIndex, bool on) {
  if (ledIndex > 7) return;
  
  uint8_t pin = ledPins[ledIndex];
  digitalWrite(pin, on ? HIGH : LOW);
  
  Serial.print("LED ");
  Serial.print(ledIndex + 1);
  Serial.print(": ");
  Serial.println(on ? "LIGADO" : "DESLIGADO");
}

void stopActiveAlarm() {
  Serial.println("========================================");
  Serial.println("✓ PARANDO TODOS OS ALARMES ATIVOS!");
  
  // Desliga todos os LEDs dos alarmes ativos
  for (uint8_t i = 0; i < alarmCount; i++) {
    if (alarms[i].isActiveNow) {
      Serial.print("Desligando alarme: ");
      Serial.println(alarms[i].name);
      setLed(alarms[i].ledIndex, false);
      alarms[i].isActiveNow = false;
    }
  }
  
  Serial.println("========================================");
  
  alarmActive = false;
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
  // Não para alarmes ativos anteriores - permite múltiplos simultâneos
  
  if (!alarmActive) {
    alarmActive = true;
    alarmStartMs = millis();
    lastSequenceRepeat = 0;
    playingSequence = false;
    seqStage = 0;
  }

  alarms[idx].isActiveNow = true;
  setLed(alarms[idx].ledIndex, true);
  
  Serial.println("========================================");
  Serial.println("🔔 ALARME INICIADO!");
  Serial.print("Nome: ");
  Serial.println(alarms[idx].name);
  Serial.print("Horário: ");
  Serial.print(alarms[idx].hour);
  Serial.print(":");
  Serial.println(alarms[idx].minute);
  Serial.print("LED: ");
  Serial.println(alarms[idx].ledIndex + 1);
  Serial.print("Duração: ");
  Serial.print(alarmDurationMs / 1000);
  Serial.println(" segundos");
  Serial.println("========================================");
  
  if (!playingSequence) {
    startSequenceNow();
  }
}

void addOrUpdateAlarm() {
  addCORSHeaders();
  
  if (!server.hasArg("hour") || !server.hasArg("minute") || !server.hasArg("led")) {
    server.send(400, "application/json", "{\"success\":false,\"error\":\"missing_params\"}");
    return;
  }

  uint8_t hour = server.arg("hour").toInt();
  uint8_t minute = server.arg("minute").toInt();
  uint8_t led = server.arg("led").toInt();
  const String name = server.hasArg("name") ? server.arg("name") : "Alarme";

  if (hour > 23 || minute > 59 || led > 7) {
    server.send(400, "application/json", "{\"success\":false,\"error\":\"invalid_params\"}");
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
        server.send(200, "application/json", "{\"success\":true,\"message\":\"alarm_updated\"}");
        return;
      }
    }
  }

  if (alarmCount >= MAX_ALARMS) {
    server.send(400, "application/json", "{\"success\":false,\"error\":\"alarm_limit\"}");
    return;
  }

  Alarm &a = alarms[alarmCount];
  a.id = alarmCount;
  a.hour = hour;
  a.minute = minute;
  a.ledIndex = led;
  a.enabled = true;
  a.lastTriggeredDay = -1;
  a.isActiveNow = false;
  strncpy(a.name, name.c_str(), sizeof(a.name) - 1);

  alarmCount++;

  playConfirmation();
  server.send(200, "application/json", "{\"success\":true,\"message\":\"alarm_created\"}");
}

void listAlarms() {
  addCORSHeaders();
  
  char buffer[1024];
  uint16_t pos = 0;

  pos += snprintf(buffer + pos, sizeof(buffer) - pos, "[");

  for (uint8_t i = 0; i < alarmCount; i++) {
    Alarm &a = alarms[i];
    
    char hourStr[3], minStr[3];
    snprintf(hourStr, sizeof(hourStr), "%02d", a.hour);
    snprintf(minStr, sizeof(minStr), "%02d", a.minute);
    
    pos += snprintf(buffer + pos, sizeof(buffer) - pos,
      "{\"id\":%d,\"hour\":\"%s\",\"minute\":\"%s\",\"led\":%d,\"enabled\":%s,\"name\":\"%s\"}%s",
      a.id, hourStr, minStr, a.ledIndex, 
      a.enabled ? "true" : "false", 
      a.name,
      (i < alarmCount - 1 ? "," : "")
    );
  }

  snprintf(buffer + pos, sizeof(buffer) - pos, "]");
  server.send(200, "application/json", buffer);
}

void handleStatus() {
  addCORSHeaders();
  
  time_t now = time(nullptr);
  struct tm* t = localtime(&now);

  String wifiStatus = WiFi.isConnected() ? "connected" : "disconnected";
  String currentIp = WiFi.localIP().toString();
  String hostname = String(mdnsName) + ".local";

  char out[300];
  snprintf(out, sizeof(out),
           "{\"time\":\"%02d:%02d\",\"wifi\":\"%s\",\"ip\":\"%s\",\"hostname\":\"%s\",\"ssid\":\"%s\",\"alarmCount\":%d}",
           t->tm_hour, t->tm_min,
           wifiStatus.c_str(),
           currentIp.c_str(),
           hostname.c_str(),
           WiFi.SSID().c_str(),
           alarmCount);

  server.send(200, "application/json", out);
}

void deleteAlarm() {
  addCORSHeaders();
  
  if (!server.hasArg("id")) {
    server.send(400, "application/json", "{\"success\":false,\"error\":\"missing_id\"}");
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
  server.send(200, "application/json", "{\"success\":true,\"message\":\"alarm_deleted\"}");
}

void setup() {
  Serial.begin(115200);

  for (int i = 0; i < 30 && !Serial; i++) {
    delay(100);
  }
  
  Serial.println();
  Serial.println();
  Serial.println();
  Serial.println("========================================");
  Serial.println("    MEDTIME - Sistema de Alarmes");
  Serial.println("    Versão 2.0 - WiFiManager + mDNS");
  Serial.println("========================================");
  Serial.flush(); 

  setupPins();
  setupWiFi();
  
  configTime(-3 * 3600, 0, "pool.ntp.org", "time.nist.gov");

  server.onNotFound([]() {
    if (server.method() == HTTP_OPTIONS) {
      addCORSHeaders();
      server.send(204);
    } else {
      addCORSHeaders();
      server.send(404, "application/json", "{\"error\":\"endpoint_not_found\"}");
    }
  });

  server.on("/setAlarm", HTTP_POST, addOrUpdateAlarm);
  server.on("/listAlarms", HTTP_GET, listAlarms);
  server.on("/deleteAlarm", HTTP_POST, deleteAlarm);
  
  server.on("/toggleAlarm", HTTP_POST, []() {
    addCORSHeaders();
    
    if (!server.hasArg("id")) {
      server.send(400, "application/json", "{\"success\":false,\"error\":\"missing_id\"}");
      return;
    }

    uint8_t id = server.arg("id").toInt();
    
    for (uint8_t i = 0; i < alarmCount; i++) {
      if (alarms[i].id == id) {
        alarms[i].enabled = !alarms[i].enabled;
        
        Serial.print("Alarme ");
        Serial.print(id);
        Serial.print(alarms[i].enabled ? " ativado" : " desativado");
        Serial.println();
        
        playConfirmation();
        
        char response[100];
        snprintf(response, sizeof(response), 
                 "{\"success\":true,\"enabled\":%s}", 
                 alarms[i].enabled ? "true" : "false");
        server.send(200, "application/json", response);
        return;
      }
    }
    
    server.send(404, "application/json", "{\"success\":false,\"error\":\"alarm_not_found\"}");
  });
  
  server.on("/stopAlarm", HTTP_POST, []() {
    addCORSHeaders();
    
    Serial.println("Requisição para parar alarme recebida");
    stopActiveAlarm();
    server.send(200, "application/json", "{\"ok\":true,\"acknowledged\":true,\"success\":true}");
  });

  server.on("/active", HTTP_GET, []() {
    addCORSHeaders();
    
    if (!alarmActive) {
      server.send(200, "application/json", "{\"active\":false}");
      return;
    }

    // Encontra o primeiro alarme ativo para retornar
    int8_t firstActiveIdx = -1;
    for (uint8_t i = 0; i < alarmCount; i++) {
      if (alarms[i].isActiveNow) {
        firstActiveIdx = i;
        break;
      }
    }
    
    if (firstActiveIdx < 0) {
      server.send(200, "application/json", "{\"active\":false}");
      return;
    }

    Alarm &a = alarms[firstActiveIdx];
    unsigned long started = alarmStartMs;
    long remaining = (long)alarmDurationMs - (long)(millis() - alarmStartMs);
    if (remaining < 0) remaining = 0;
    
    // Conta quantos alarmes estão ativos
    uint8_t activeCount = 0;
    String ledList = "[";
    for (uint8_t i = 0; i < alarmCount; i++) {
      if (alarms[i].isActiveNow) {
        if (activeCount > 0) ledList += ",";
        ledList += String(alarms[i].ledIndex);
        activeCount++;
      }
    }
    ledList += "]";
    
    char out[400];
    snprintf(out, sizeof(out),
             "{\"active\":true,\"id\":%d,\"hour\":%d,\"minute\":%d,\"led\":%d,\"name\":\"%s\",\"startedAt\":%lu,\"remainingMs\":%ld,\"acknowledged\":false,\"activeCount\":%d,\"activeLeds\":%s}",
             a.id, a.hour, a.minute, a.ledIndex, a.name, started, remaining, activeCount, ledList.c_str());

    server.send(200, "application/json", out);
  });

  server.on("/status", HTTP_GET, handleStatus);
  server.on("/resetWiFi", HTTP_POST, handleResetWiFi);
  
  server.on("/ping", HTTP_GET, []() {
    addCORSHeaders();
    server.send(200, "application/json", "{\"pong\":true,\"device\":\"ESP8266\",\"version\":\"1.0\"}");
  });
  
  server.on("/info", HTTP_GET, []() {
    addCORSHeaders();
    
    char out[300];
    snprintf(out, sizeof(out),
             "{\"device\":\"ESP8266\",\"hostname\":\"%s.local\",\"ip\":\"%s\",\"ssid\":\"%s\",\"alarms\":%d,\"maxAlarms\":%d,\"rssi\":%d}",
             mdnsName,
             WiFi.localIP().toString().c_str(),
             WiFi.SSID().c_str(),
             alarmCount,
             MAX_ALARMS,
             WiFi.RSSI());
    server.send(200, "application/json", out);
  });
  
  server.on("/reset", HTTP_POST, []() {
    addCORSHeaders();
    
    Serial.println("=== Resetando configurações ===");
    
    wifiManager.resetSettings();
    
    server.send(200, "application/json", "{\"success\":true,\"message\":\"settings_reset\"}");
    
    playConfirmation();
    
    Serial.println("Configurações resetadas!");
    Serial.println("Reiniciando...");
    delay(2000);
    ESP.restart();
  });
  
  server.begin();
  
  Serial.println("========================================");
  Serial.println("=== Servidor HTTP iniciado ===");
  Serial.print("Acesse: http://");
  Serial.print(mdnsName);
  Serial.println(".local");
  Serial.print("ou IP: ");
  Serial.println(WiFi.localIP());
  Serial.println("========================================");
}
 
void loop() {
  server.handleClient();
  MDNS.update(); 

  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    
    if (cmd.equalsIgnoreCase("RESET")) {
      Serial.println("=== Comando RESET recebido ===");
      Serial.println("Resetando configurações WiFi...");
      
      wifiManager.resetSettings();
      
      Serial.println("Configurações resetadas!");
      Serial.println("Reiniciando...");
      delay(1000);
      ESP.restart();
    }
    else if (cmd.equalsIgnoreCase("STATUS")) {
      Serial.println("========================================");
      Serial.println("📊 STATUS DO SISTEMA");
      Serial.println("========================================");
      Serial.println("SSID: " + WiFi.SSID());
      Serial.println("IP: " + WiFi.localIP().toString());
      Serial.print("Hostname: ");
      Serial.print(mdnsName);
      Serial.println(".local");
      Serial.println("RSSI: " + String(WiFi.RSSI()) + " dBm");
      Serial.println("Alarmes: " + String(alarmCount));
      Serial.println("Alarme ativo: " + String(alarmActive ? "Sim" : "Não"));
      Serial.println("========================================");
    }
  }

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
      
      Serial.print("🔔 Alarme disparado: ");
      Serial.print(a.name);
      Serial.print(" (");
      Serial.print(a.hour);
      Serial.print(":");
      Serial.print(a.minute);
      Serial.print(") - LED ");
      Serial.println(a.ledIndex + 1);
      
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
