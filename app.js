// ==========================================
// 1. CONFIGURAÇÕES E ESTADO GLOBAL
// ==========================================

// Chave para salvar no LocalStorage
const STORAGE_KEY = "fruteira_configs";

// Limites Ativos Atualmente (carregados do CRUD ou padrão)
let limitesAtivos = {
    bom: 1500,
    alerta: 3000,
};

// Variáveis da Web Serial API
let port;
let reader;
let inputBuffer = ""; // Buffer para acumular dados da serial

// Elementos do DOM (HTML) - Monitor
const btnConectar = document.getElementById("btnConectar");
const txtStatusConexao = document.getElementById("statusConexao");
const elPeso = document.getElementById("valPeso");
const elTemp = document.getElementById("valTemp");
const elUmid = document.getElementById("valUmid");
const elGas = document.getElementById("valGas");
const elAlc = document.getElementById("valAlc");
const elStatusBarra = document.getElementById("statusFruta");

// Elementos do DOM - CRUD
const form = document.getElementById("crudForm");
const inputId = document.getElementById("configId");
const inputNome = document.getElementById("nomePerfil");
const inputGasBom = document.getElementById("limiteGasBom");
const inputGasAlerta = document.getElementById("limiteGasAlerta");
const listaUl = document.getElementById("listaConfigs");
const tituloForm = document.getElementById("tituloForm");
const btnCancelar = document.getElementById("btnCancelar");

// ==========================================
// 2. LÓGICA DO CONECTOR SERIAL (HARDWARE)
// ==========================================

async function conectarSerial() {
    if ("serial" in navigator) {
        try {
            // Solicita ao usuário para selecionar a porta COM
            port = await navigator.serial.requestPort();
            // Abre a porta com o baud rate configurado no Arduino
            await port.open({ baudRate: 115200 });

            txtStatusConexao.textContent = "Conectado";
            txtStatusConexao.className = "conectado";
            btnConectar.style.display = "none";

            // Inicia o loop de leitura
            lerDadosSerial();
        } catch (error) {
            console.error("Erro ao conectar:", error);
            alert("Não foi possível conectar à porta Serial.");
        }
    } else {
        alert(
            "Seu navegador não suporta Web Serial API. Use Chrome, Edge ou Opera atualizados.",
        );
    }
}

async function lerDadosSerial() {
    while (port.readable) {
        const textDecoder = new TextDecoderStream();
        const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
        reader = textDecoder.readable.getReader();

        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) break; // Reader cancelado

                if (value) {
                    inputBuffer += value; // Adiciona o pedaço lido ao buffer

                    // Verifica se temos uma linha completa (terminada em \n enviado pelo Serial.println)
                    if (inputBuffer.includes("\n")) {
                        let linhas = inputBuffer.split("\n");
                        // A última "linha" pode estar incompleta, guardamos de volta no buffer
                        inputBuffer = linhas.pop();

                        // Processa cada linha completa
                        for (let linha of linhas) {
                            linha = linha.trim();
                            if (linha.startsWith("{") && linha.endsWith("}")) {
                                processarJsonHardware(linha);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Erro na leitura:", error);
            txtStatusConexao.textContent = "Erro/Desconectado";
            txtStatusConexao.className = "desconectado";
            btnConectar.style.display = "block";
        } finally {
            reader.releaseLock();
        }
    }
}

function processarJsonHardware(jsonString) {
    try {
        const dados = JSON.parse(jsonString);

        // Atualiza a tela com dados brutos
        elPeso.textContent = dados.peso.toFixed(3);
        elTemp.textContent = dados.temp.toFixed(1);
        elUmid.textContent = dados.umid;
        elGas.textContent = dados.idxGas.toFixed(0);
        elAlc.textContent = dados.idxAlc.toFixed(0);

        // Aplica a Lógica de Status baseada nos limites do CRUD
        atualizarStatusVisual(dados);
    } catch (e) {
        // Ignora linhas que não são JSON válido (mensagens de boot do ESP, etc)
        // console.warn("Dados inválidos recebidos", jsonString);
    }
}

function atualizarStatusVisual(dados) {
    // Lógica inteligente espelhada do Arduino, mas usando limitesAtivos do JS
    elStatusBarra.className = "status-barra"; // Reseta classes

    if (dados.peso < 0.1) {
        elStatusBarra.textContent = "Status: Sem frutas";
        elStatusBarra.classList.add("status-vazio");
    } else if (
        dados.idxGas < limitesAtivos.bom &&
        dados.idxAlc < limitesAtivos.bom
    ) {
        elStatusBarra.textContent = "Status: Frutas em bom estado";
        elStatusBarra.classList.add("status-bom");
    } else if (dados.idxGas < limitesAtivos.alerta) {
        elStatusBarra.textContent = "Status: Frutas amadurecendo";
        elStatusBarra.classList.add("status-alerta");
    } else {
        elStatusBarra.textContent = "Status: ATENÇÃO! Frutas apodrecendo";
        elStatusBarra.classList.add("status-podre");
    }
}

// ==========================================
// 3. LÓGICA DO CRUD (BANCO DE DADOS LOCAL)
// ==========================================

// --- Funções Auxiliares de Banco (JSON no LocalStorage) ---
function obterConfigsDoBanco() {
    const dados = localStorage.getItem(STORAGE_KEY);
    // Se não houver nada, retorna lista vazia. Se houver, converte string JSON para Objeto JS.
    return dados ? JSON.parse(dados) : [];
}

function salvarNoBanco(listaConfigs) {
    // Converte Objeto JS para string JSON e salva
    localStorage.setItem(STORAGE_KEY, JSON.stringify(listaConfigs));
}

// --- Operações do CRUD ---

// Carregar Lista na Tela (READ)
function renderizarLista() {
    const configs = obterConfigsDoBanco();
    listaUl.innerHTML = ""; // Limpa a lista atual na tela

    configs.forEach((conf) => {
        const li = document.createElement("li");

        // Parte do texto
        const divInfo = document.createElement("div");
        divInfo.className = "info-config";
        divInfo.innerHTML = `
            <strong>${conf.nome}</strong>
            <div>Limites Gás: Bom < ${conf.gasBom} | Alerta < ${conf.gasAlerta}</div>
        `;

        // Parte dos botões de ação
        const divAcoes = document.createElement("div");
        divAcoes.className = "acoes-config";

        // Botão USAR (Aplica os limites agora)
        const btnUsar = document.createElement("button");
        btnUsar.textContent = "Ativar";
        btnUsar.className = "btn-usar";
        btnUsar.onclick = () => ativarConfiguracao(conf);

        // Botão EDITAR
        const btnEdit = document.createElement("button");
        btnEdit.textContent = "Editar";
        btnEdit.className = "btn-editar";
        btnEdit.onclick = () => carregarNoFormulario(conf);

        // Botão EXCLUIR
        const btnExcluir = document.createElement("button");
        btnExcluir.textContent = "Excluir";
        btnExcluir.className = "btn-excluir";
        btnExcluir.onclick = () => excluirConfig(conf.id);

        divAcoes.appendChild(btnUsar);
        divAcoes.appendChild(btnEdit);
        divAcoes.appendChild(btnExcluir);

        li.appendChild(divInfo);
        li.appendChild(divAcoes);
        listaUl.appendChild(li);
    });
}

// Salvar / Atualizar no Banco (CREATE / UPDATE)
function salvarFormulario(event) {
    event.preventDefault(); // Não recarrega a página ao submeter form

    const id = inputId.value; // Pega ID oculto (null se novo, numero se editar)
    const configData = {
        nome: inputNome.value,
        gasBom: parseInt(inputGasBom.value),
        gasAlerta: parseInt(inputGasAlerta.value),
    };

    const configs = obterConfigsDoBanco();

    if (id) {
        // UPDATE: Editar existente
        // Converte ID para número se não for null
        configData.id = parseInt(id);
        const index = configs.findIndex((conf) => conf.id === configData.id);
        if (index !== -1) {
            configs[index] = configData;
        }
    } else {
        // CREATE: Novo perfil
        // Cria ID simples incremental usando o timestamp atual (único)
        configData.id = Date.now();
        configs.push(configData);
    }

    // Salva a lista de volta no banco (localStorage)
    salvarNoBanco(configs);

    // Reseta o formulário
    cancelarEdicao();

    // Atualiza a lista na tela
    renderizarLista();
}

// Carregar Dados para Edição (UPDATE)
function carregarNoFormulario(config) {
    inputId.value = config.id;
    inputNome.value = config.nome;
    inputGasBom.value = config.gasBom;
    inputGasAlerta.value = config.gasAlerta;

    tituloForm.textContent = `Editando: ${config.nome}`;
    btnCancelar.style.display = "block";
}

function cancelarEdicao() {
    form.reset(); // Limpa inputs
    inputId.value = ""; // Limpa ID oculto

    tituloForm.textContent = "Nova Configuração";
    btnCancelar.style.display = "none";
}

// Excluir Perfil do Banco (DELETE)
function excluirConfig(id) {
    if (confirm("Tem certeza que deseja excluir este perfil?")) {
        const configs = obterConfigsDoBanco();
        // Filtra para manter todos MENOS o que queremos excluir
        const listaNova = configs.filter((conf) => conf.id !== id);
        salvarNoBanco(listaNova);
        renderizarLista();
    }
}

// ==========================================
// 4. INTERAÇÃO CRUD -> HARDWARE
// ==========================================

// Aplica limites escolhidos na lista ao hardware
function ativarConfiguracao(config) {
    limitesAtivos = {
        bom: config.gasBom,
        alerta: config.gasAlerta,
    };

    // Dá um feedback visual para o usuário
    alert(
        `Limites ativados: Bom < ${config.gasBom} | Alerta < ${config.gasAlerta}\nAguardando novos dados serial...`,
    );
}

// ==========================================
// 5. INICIALIZAÇÃO
// ==========================================

// Event Listeners (Associa eventos aos elementos)
btnConectar.addEventListener("click", conectarSerial);
form.addEventListener("submit", salvarFormulario);
btnCancelar.addEventListener("click", cancelarEdicao);

// Carrega a lista do banco ao abrir a página
renderizarLista();
