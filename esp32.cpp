#include <WiFi.h>
#include <WebServer.h>
#include "DHT.h"
#include "HX711.h"

// ---------- CREDENCIAIS WI-FI ----------
const char* ssid = "NOME_DO_SEU_WIFI";
const char* password = "SENHA_DO_SEU_WIFI";

// ---------- SERVIDOR WEB ----------
WebServer server(80);

// ---------- PINOS E SENSORES ----------
const int pinoMQ135 = 34;
const int pinoMQ3   = 35;
const int pinoDHT   = 23;
const int LOADCELL_DOUT_PIN = 32;
const int LOADCELL_SCK_PIN = 33;

#define DHTTYPE DHT22
DHT dht(pinoDHT, DHTTYPE);
HX711 escala;

// ---------- CONFIGURAÇÕES ----------
const float RL = 1.0;
const float VCC_ESP = 3.3;
float FATOR_COMPENSACAO = 0.90; 
float R0_MQ135 = 1.0;
float R0_MQ3   = 1.0;
float fator_calibracao = -463.0; 

// ---------- VARIÁVEIS DE MÉDIA ----------
unsigned long tempoLeitura = 0;
unsigned long tempoMedia = 0;

float somaUmid = 0, somaTemp = 0, somaPeso = 0;
float somaEtileno = 0, somaAlcool = 0;
int contLeituras = 0;

// Variáveis que armazenam a média final para envio
float mediaUmid = 0, mediaTemp = 0, mediaPeso = 0;
float mediaEtileno = 0, mediaAlcool = 0;

float calcularRS_Sensivel(int pino) {
  long soma = 0;
  for(int i = 0; i < 100; i++) {
    soma += analogRead(pino);
    delay(2);
  }
  float vOut = (soma / 100.0) * (VCC_ESP / 4095.0);
  if (vOut < 0.02) vOut = 0.02; 
  return ((VCC_ESP - vOut) * RL) / vOut;
}

void setup() {
  Serial.begin(115200);
  dht.begin();

  Serial.println("\n--- MONITOR DE FRUTEIRA PRO (WI-FI) ---");
  Serial.println("Calibrando sensores... Aguarde.");
  delay(5000); 
  
  R0_MQ135 = calcularRS_Sensivel(pinoMQ135);
  R0_MQ3   = calcularRS_Sensivel(pinoMQ3);

  escala.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN);
  escala.set_scale(fator_calibracao);
  escala.tare(); 

  // Conexão Wi-Fi
  Serial.print("Conectando ao Wi-Fi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWi-Fi conectado!");
  Serial.print("Endereço IP para conectar na Interface: ");
  Serial.println(WiFi.localIP());

  // Rota da API REST que a interface vai consumir
  server.on("/dados", []() {
    // Permite que a interface web (localhost) leia os dados sem bloqueio de CORS
    server.sendHeader("Access-Control-Allow-Origin", "*"); 
    
    String json = "{";
    json += "\"temp\":" + String(mediaTemp, 1) + ",";
    json += "\"umid\":" + String(mediaUmid, 1) + ",";
    json += "\"peso\":" + String(mediaPeso, 2) + ",";
    json += "\"etileno\":" + String(mediaEtileno, 3) + ",";
    json += "\"alcool\":" + String(mediaAlcool, 3);
    json += "}";
    
    server.send(200, "application/json", json);
  });

  server.begin();
}

void loop() {
  server.handleClient(); // Mantém o servidor web ouvindo requisições

  unsigned long tempoAtual = millis();

  // 1. FAZ LEITURA A CADA 1 SEGUNDO E ACUMULA
  if (tempoAtual - tempoLeitura >= 1000) {
    tempoLeitura = tempoAtual;

    float p = escala.get_units(5); 
    if (p < 5.0) p = 0.0;

    float rs135 = calcularRS_Sensivel(pinoMQ135);
    float rs3   = calcularRS_Sensivel(pinoMQ3);
    float razao135 = rs135 / R0_MQ135;
    float razao3   = rs3 / R0_MQ3;
    float correcao = (1.0 - razao3) * FATOR_COMPENSACAO;
    
    somaUmid += dht.readHumidity();
    somaTemp += dht.readTemperature();
    somaPeso += p;
    somaEtileno += (razao135 + correcao);
    somaAlcool += razao3;
    contLeituras++;
  }

  // 2. CALCULA A MÉDIA A CADA 10 SEGUNDOS E ATUALIZA AS VARIÁVEIS GLOBAIS
  if (tempoAtual - tempoMedia >= 10000) {
    tempoMedia = tempoAtual;

    if (contLeituras > 0) {
      mediaUmid = somaUmid / contLeituras;
      mediaTemp = somaTemp / contLeituras;
      mediaPeso = somaPeso / contLeituras;
      mediaEtileno = somaEtileno / contLeituras;
      mediaAlcool = somaAlcool / contLeituras;

      Serial.println("Novas médias calculadas e prontas para a interface web.");
    }

    // Zera os acumuladores para o próximo ciclo
    somaUmid = 0; somaTemp = 0; somaPeso = 0;
    somaEtileno = 0; somaAlcool = 0;
    contLeituras = 0;
  }
}