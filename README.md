# Fruteira Inteligente IoT 🍎⚙️

O desperdício de alimentos é um desafio global presente significativamente no ambiente doméstico, especialmente ao se tratar de alimentos perecíveis. Frutas e vegetais frequentemente são descartados por passarem do ponto de maturação ideal devido ao armazenamento inadequado ou esquecimento por parte do consumidor.

Ao se tratar de frutas climatéricas (que continuam o processo de maturação após a colheita), sua conservação exige atenção de variáveis microclimáticas, como temperatura e umidade, além do monitoramento de gás etileno, um acelerador natural do amadurecimento.

Este projeto propõe o desenvolvimento de uma **Fruteira Inteligente**, baseada no conceito de Internet das Coisas (IoT). A iniciativa alinha-se aos Objetivos de Desenvolvimento Sustentável (ODS) da ONU, atendendo ao **ODS 12** (Consumo e Produção Responsáveis) e **ODS 9** (Indústria, Inovação e Infraestrutura).

---

## 🏗️ Arquitetura do Sistema

O projeto adota uma **arquitetura descentralizada (Cliente-Servidor Local)**, otimizando o processamento e garantindo escalabilidade.

### 1. Hardware (Servidor de Dados)

O microcontrolador **ESP32** atua exclusivamente como um coletor de dados e servidor web local.

- **Componentes:** Sensores de temperatura/umidade (DHT22), peso (célula de carga com módulo HX711) e detecção de gás (MQ-3 e MQ-135).
- **Lógica Interna:** Realiza leituras a cada 1 segundo, acumula os valores para mitigar ruídos analógicos e calcula médias suavizadas a cada 10 segundos.
- **Comunicação:** Disponibiliza as médias consolidadas em uma rota HTTP (`/dados`) no formato estruturado JSON.

### 2. Software (Cliente e Regra de Negócio)

A interface web (HTML, CSS, JavaScript) opera como o "cérebro" do sistema (**Edge Computing**).

- **HTTP Polling:** A cada 2 segundos, o cliente solicita os dados via API REST (`fetch`) para o endereço IP do ESP32 na rede Wi-Fi local.
- **Inteligência:** Processa os dados brutos, cruza com as definições cadastradas pelo usuário e decide o acionamento dos alertas em tempo real.
- **Persistência (CRUD):** Utiliza a API `localStorage` do navegador para criar, ler, atualizar e excluir limites toleráveis de gases para diferentes frutas, sem necessidade de banco de dados externo ou custos de nuvem.

---

## 🧮 Lógica Matemática: A Razão Proporcional

O sistema não avalia o volume bruto de gás no ambiente, pois isso geraria falsos positivos (10 bananas emitem mais gás que apenas 1 banana). A lógica central baseia-se na **Razão Gás/Massa**:

- **Inversão do Sensor:** A resistência do sensor MQ cai conforme o gás aumenta. A interface inverte esse valor matematicamente (`1 / leitura_sensor`) para criar uma métrica onde "valores maiores significam mais gás".
- **A Fórmula:** A métrica invertida é dividida pelo peso das frutas em quilogramas.

```
Razão Gás/Kg = (1 / Gás) / Peso_em_Kg
```

- **Avaliação:** O usuário define no CRUD um limite máximo para essa razão. Se o limite for excedido independentemente da quantidade de frutas na cesta, o sistema decreta o estado de apodrecimento (**Alerta Vermelho**). Existe também um alerta fixo primário focado na emissão de álcool, visando detectar fermentação ativa.

---

## 🚀 Funcionalidades da Interface

- **Painel em Tempo Real:** Exibe temperatura, umidade, peso e as razões calculadas.
- **Gráfico Dinâmico (Chart.js):** Traça a evolução histórica da emissão de etileno em uma linha do tempo.
- **Tabela de Logs (Auditoria):** Registra o status da fruteira a cada 30 segundos, consolidando horário, peso, razão de gás e estado ativo.
- **Configuração de Perfis (Templates):** Permite cadastrar um único valor crítico de gás personalizado para diferentes frutas.

---

## 🛠️ Como Executar o Projeto

### Preparação do Hardware

1. Abra o arquivo `.ino` na **Arduino IDE**.
2. Instale as bibliotecas **DHT sensor library** e **HX711 Arduino Library**.
3. Altere as variáveis `ssid` e `password` para as credenciais da sua rede Wi-Fi local.
4. Faça o upload para o ESP32.
5. Abra o **Monitor Serial** (115200 baud), aguarde a estabilização de **5 minutos** (aquecimento dos filamentos MQ) e anote o **Endereço IP** gerado.

### Execução do Software

1. O computador deve estar conectado na mesma rede Wi-Fi que o ESP32.
2. Abra o arquivo `index.html` em um navegador web (Google Chrome ou Edge).
3. Insira o **Endereço IP** do ESP32 no cabeçalho superior.
4. Clique em **"Conectar Wi-Fi"**.

---

## 👥 Equipe de Desenvolvimento

Projeto de Engenharia da Computação — **Universidade Tecnológica Federal do Paraná (UTFPR)**, Câmpus Ponta Grossa.

- João Vitor Tomadon Daciuk
- Gabriel Burack Rosa
- Caroline Heloise
- Guilherme Bastos

---

## 📚 Referências Principais

- MIHALJO, K. et al. _Design of stored grain monitoring system based on NB-IoT_. TELFOR, 2020.
- TANG, P. et al. _Reefer Container Monitoring System_. ATEE, 2019.
