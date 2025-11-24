#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <EEPROM.h>
#include <time.h>

ESP8266WebServer server(80);

// LEDs externos conectados aos pinos D0-D7
// NOTA: O pino GPIO2 (índice 4 no array) é compartilhado com o LED embutido da placa
// O LED embutido é controlado com lógica invertida (HIGH=apagado, LOW=aceso)
const uint8_t ledPins[8] = { 16, 5, 4, 0, 2, 14, 12, 13 };
const uint8_t buzzerPin = 15;
const uint8_t ledBuiltIn = 2; // LED embutido da placa (GPIO2 / D4)

// Configuração de rede padrão (AP Mode)
const char* ap_ssid = "Medtime";
const char* ap_password = "12345678";
IPAddress ap_ip(192, 168, 4, 1);
IPAddress ap_gateway(192, 168, 4, 1);
IPAddress ap_subnet(255, 255, 255, 0);

// Estrutura para salvar credenciais na EEPROM
struct WiFiCredentials {
  char ssid[32];
  char password[64];
  bool configured;
};

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

bool isAPMode = true;

void setupWiFi() {
  Serial.println("=== Iniciando WiFi ===");
  
  EEPROM.begin(512);
  
  // Tenta ler credenciais salvas
  WiFiCredentials creds;
  EEPROM.get(0, creds);
  
  // Se há credenciais salvas, tenta conectar
  if (creds.configured && strlen(creds.ssid) > 0) {
    Serial.println("Credenciais encontradas, tentando conectar...");
    Serial.print("SSID: ");
    Serial.println(creds.ssid);
    
    WiFi.mode(WIFI_STA);
    WiFi.begin(creds.ssid, creds.password);
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
      delay(500);
      Serial.print(".");
      attempts++;
    }
    Serial.println();
    
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("Conectado à rede WiFi!");
      Serial.print("IP: ");
      Serial.println(WiFi.localIP());
      isAPMode = false;
      return;
    } else {
      Serial.println("Falha ao conectar. Iniciando modo AP...");
    }
  } else {
    Serial.println("Nenhuma credencial salva. Iniciando modo AP...");
  }
  
  // Inicia em modo AP com IP fixo
  WiFi.mode(WIFI_AP);
  WiFi.softAPConfig(ap_ip, ap_gateway, ap_subnet);
  WiFi.softAP(ap_ssid, ap_password);
  
  Serial.println("Modo AP ativo");
  Serial.print("SSID: ");
  Serial.println(ap_ssid);
  Serial.print("IP: ");
  Serial.println(WiFi.softAPIP());
  Serial.println("Aguardando configuração via /configure");
  
  isAPMode = true;
}

// Função para reconfigurar WiFi via endpoint
void handleConfigure() {
  if (!server.hasArg("ssid")) {
    server.send(400, "application/json", "{\"success\":false,\"error\":\"missing_ssid\"}");
    return;
  }

  String ssid = server.arg("ssid");
  String pass = server.hasArg("pass") ? server.arg("pass") : "";

  Serial.println("=== Recebendo configuração WiFi ===");
  Serial.print("SSID: ");
  Serial.println(ssid);

  // Salva credenciais na EEPROM
  WiFiCredentials creds;
  memset(&creds, 0, sizeof(creds));
  strncpy(creds.ssid, ssid.c_str(), sizeof(creds.ssid) - 1);
  strncpy(creds.password, pass.c_str(), sizeof(creds.password) - 1);
  creds.configured = true;
  
  EEPROM.put(0, creds);
  EEPROM.commit();
  Serial.println("Credenciais salvas na EEPROM");

  // Muda para modo Station e tenta conectar
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid.c_str(), pass.c_str());
  
  // Aguarda até 20 segundos para conectar
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("✓ Conectado com sucesso!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
    
    isAPMode = false;
    
    // Retorna sucesso com o novo IP
    char response[100];
    snprintf(response, sizeof(response), 
             "{\"success\":true,\"ip\":\"%s\"}", 
             WiFi.localIP().toString().c_str());
    server.send(200, "application/json", response);
    
    playConfirmation();
    
    // Reinicia após 2 segundos para consolidar conexão
    delay(2000);
    ESP.restart();
  } else {
    Serial.println("✗ Falha ao conectar");
    
    // Limpa credenciais inválidas
    WiFiCredentials emptyCreeds;
    memset(&emptyCreeds, 0, sizeof(emptyCreeds));
    emptyCreeds.configured = false;
    EEPROM.put(0, emptyCreeds);
    EEPROM.commit();
    
    server.send(500, "application/json", "{\"success\":false,\"error\":\"connection_failed\"}");
    
    // Volta para modo AP
    delay(1000);
    WiFi.mode(WIFI_AP);
    WiFi.softAPConfig(ap_ip, ap_gateway, ap_subnet);
    WiFi.softAP(ap_ssid, ap_password);
    isAPMode = true;
    
    Serial.println("Voltou para modo AP");
    Serial.print("IP: ");
    Serial.println(WiFi.softAPIP());
  }
}

void setupPins() {
  for (uint8_t i = 0; i < 8; i++) {
    pinMode(ledPins[i], OUTPUT);
    digitalWrite(ledPins[i], LOW);
  }
  pinMode(buzzerPin, OUTPUT);
  digitalWrite(buzzerPin, LOW);
  
  // Desliga o LED embutido da placa (LOW = aceso, HIGH = apagado no ESP8266)
  pinMode(ledBuiltIn, OUTPUT);
  digitalWrite(ledBuiltIn, HIGH);
}

void playConfirmation() {
  tone(buzzerPin, 2000, 120);
  delay(150);
  tone(buzzerPin, 1500, 120);
  delay(150);
  tone(buzzerPin, 2500, 120);
  delay(100);
  noTone(buzzerPin);
}

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

  String wifiStatus = isAPMode ? "ap_mode" : (WiFi.isConnected() ? "connected" : "disconnected");

  char out[100];
  snprintf(out, sizeof(out),
           "{\"time\":\"%02d:%02d\",\"wifi\":\"%s\",\"ip\":\"%s\"}",
           t->tm_hour, t->tm_min,
           wifiStatus.c_str(),
           isAPMode ? WiFi.softAPIP().toString().c_str() : WiFi.localIP().toString().c_str());

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

void setup() {
  Serial.begin(115200);
  delay(200);

  setupPins();
  setupWiFi();

  configTime(-3 * 3600, 0, "pool.ntp.org", "time.nist.gov");

  // Endpoints de alarmes
  server.on("/setAlarm", HTTP_POST, addOrUpdateAlarm);
  server.on("/listAlarms", HTTP_GET, listAlarms);
  server.on("/deleteAlarm", HTTP_POST, deleteAlarm);
  
  // Endpoints de controle de alarme ativo
  server.on("/stopAlarm", HTTP_POST, []() {
    stopActiveAlarm();
    server.send(200, "application/json", "{\"ok\":true,\"acknowledged\":true}");
  });

  server.on("/active", HTTP_GET, []() {
    if (!alarmActive || activeAlarmIdx < 0) {
      server.send(200, "application/json", "{\"active\":false}");
      return;
    }

    Alarm &a = alarms[activeAlarmIdx];
    unsigned long started = alarmStartMs;
    long remaining = (long)alarmDurationMs - (long)(millis() - alarmStartMs);
    if (remaining < 0) remaining = 0;
    char out[300];
    snprintf(out, sizeof(out),
             "{\"active\":true,\"id\":%d,\"hour\":%d,\"minute\":%d,\"led\":%d,\"name\":\"%s\",\"startedAt\":%lu,\"remainingMs\":%ld,\"acknowledged\":%d}",
             a.id, a.hour, a.minute, a.ledIndex, a.name, started, remaining, 0);

    server.send(200, "application/json", out);
  });

  // Endpoints de status e configuração
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/configure", HTTP_POST, handleConfigure);
  
  // Endpoint para resetar EEPROM
  server.on("/reset", HTTP_POST, []() {
    Serial.println("=== Resetando EEPROM ===");
    
    // Limpa credenciais
    WiFiCredentials emptyCreeds;
    memset(&emptyCreeds, 0, sizeof(emptyCreeds));
    emptyCreeds.configured = false;
    EEPROM.put(0, emptyCreeds);
    EEPROM.commit();
    
    Serial.println("EEPROM limpa!");
    server.send(200, "application/json", "{\"success\":true,\"message\":\"EEPROM resetada\"}");
    
    // Toca som de confirmação
    playConfirmation();
    
    // Reinicia em modo AP
    delay(2000);
    ESP.restart();
  });

  server.begin();
  
  Serial.println("=== Servidor HTTP iniciado ===");
  if (isAPMode) {
    Serial.println("Aguardando conexão no IP: 192.168.4.1");
  } else {
    Serial.print("Servidor disponível em: ");
    Serial.println(WiFi.localIP());
  }
}
 
void loop() {
  server.handleClient();

  // Comando via Serial para resetar EEPROM
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    
    if (cmd.equalsIgnoreCase("RESET")) {
      Serial.println("=== Comando RESET recebido ===");
      Serial.println("Limpando EEPROM...");
      
      WiFiCredentials emptyCreeds;
      memset(&emptyCreeds, 0, sizeof(emptyCreeds));
      emptyCreeds.configured = false;
      EEPROM.put(0, emptyCreeds);
      EEPROM.commit();
      
      Serial.println("EEPROM limpa!");
      Serial.println("Reiniciando em modo AP...");
      delay(1000);
      ESP.restart();
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
