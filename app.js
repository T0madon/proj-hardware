// ==========================================
// 1. CONFIGURAÇÕES E ESTADO GLOBAL
// ==========================================

const STORAGE_KEY = "fruteira_configs";

// Estado Dinâmico
let limiteAtivo = 5.0; // Agora: ACIMA disso = Ruim
let perfilAtivoNome = "Padrão";

let intervaloFetch = null;
let ipDoEsp = "";
let ultimoLogTempo = 0; // Controle dos 30s do histórico

// Elementos do DOM
const btnConectar = document.getElementById("btnConectar");
const txtStatusConexao = document.getElementById("statusConexao");
const inputIp = document.getElementById("ipEsp");
const elPeso = document.getElementById("valPeso");
const elTemp = document.getElementById("valTemp");
const elUmid = document.getElementById("valUmid");
const elGas = document.getElementById("valGas");
const elAlc = document.getElementById("valAlc");
const elStatusBarra = document.getElementById("statusFruta");
const lblPerfilAtivo = document.getElementById("lblPerfilAtivo");
const tabelaLogs = document.getElementById("tabelaLogs");

// Elementos CRUD
const form = document.getElementById("crudForm");
const inputId = document.getElementById("configId");
const inputNome = document.getElementById("nomePerfil");
const inputGas = document.getElementById("limiteGas");
const listaUl = document.getElementById("listaConfigs");
const tituloForm = document.getElementById("tituloForm");
const btnCancelar = document.getElementById("btnCancelar");

// Configuração do Gráfico (Chart.js)
const ctx = document.getElementById("graficoRazao").getContext("2d");
const grafico = new Chart(ctx, {
    type: "line",
    data: {
        labels: [], // Eixo X (Horários)
        datasets: [
            {
                label: "Razão Gás/Kg",
                data: [], // Eixo Y (Valores)
                borderColor: "#27ae60",
                backgroundColor: "rgba(39, 174, 96, 0.2)",
                borderWidth: 2,
                fill: true,
                tension: 0.3,
            },
        ],
    },
    options: {
        responsive: true,
        scales: { y: { beginAtZero: true } },
        animation: false, // Desliga animação para não piscar a cada 2s
    },
});

// ==========================================
// 2. LÓGICA DE CONEXÃO E PROCESSAMENTO
// ==========================================

function alternarConexao() {
    if (intervaloFetch) {
        clearInterval(intervaloFetch);
        intervaloFetch = null;
        txtStatusConexao.textContent = "Desconectado";
        txtStatusConexao.className = "desconectado";
        btnConectar.textContent = "📡 Conectar Wi-Fi";
        inputIp.disabled = false;
    } else {
        ipDoEsp = inputIp.value.trim();
        if (!ipDoEsp) return alert("Digite o IP do ESP32.");

        txtStatusConexao.textContent = "Conectando...";
        btnConectar.textContent = "🛑 Desconectar";
        inputIp.disabled = true;

        buscarDadosHardware();
        intervaloFetch = setInterval(buscarDadosHardware, 2000);
    }
}

async function buscarDadosHardware() {
    try {
        const resposta = await fetch(`http://${ipDoEsp}/dados`);
        if (!resposta.ok) throw new Error("Falha");
        const dados = await resposta.json();
        processarDados(dados);
        txtStatusConexao.textContent = "Conectado";
        txtStatusConexao.className = "conectado";
    } catch (erro) {
        txtStatusConexao.textContent = "Falha na Rede";
        txtStatusConexao.className = "desconectado";
    }
}

function processarDados(dados) {
    // 1. MATEMÁTICA INVERTIDA E PROPORCIONAL
    let pesoKg = dados.peso / 1000; // ESP manda em gramas
    let razaoGas = 0;
    let razaoAlcool = 0;

    if (pesoKg >= 0.05) {
        // Só calcula se tiver pelo menos 50g de fruta
        // Inverte a leitura (1/leitura) e divide pelo peso
        razaoGas = 1 / dados.etileno / pesoKg;
        razaoAlcool = 1 / dados.alcool / pesoKg;
    }

    // 2. Atualiza a tela
    elPeso.textContent = pesoKg.toFixed(2);
    elTemp.textContent = dados.temp.toFixed(1);
    elUmid.textContent = dados.umid.toFixed(1);
    elGas.textContent = razaoGas.toFixed(2);
    elAlc.textContent = razaoAlcool.toFixed(2);

    // 3. Avalia o Status
    const statusAtual = atualizarStatusVisual(pesoKg, razaoGas, razaoAlcool);

    // 4. Atualiza o Gráfico (Eixo X = Hora, Eixo Y = Razão Gás)
    atualizarGrafico(razaoGas);

    // 5. Registra Histórico a cada 30 segundos
    const agora = Date.now();
    if (agora - ultimoLogTempo >= 30000) {
        registrarLog(pesoKg, razaoGas, statusAtual);
        ultimoLogTempo = agora;
    }
}

function atualizarStatusVisual(pesoKg, razaoGas, razaoAlcool) {
    elStatusBarra.className = "status-barra";
    let mensagem = "";
    let classeCor = "";

    if (pesoKg < 0.05) {
        mensagem = "Status: Sem frutas";
        classeCor = "status-vazio";
    } else if (razaoAlcool > 15.0) {
        // Alerta Fixo de fermentação
        mensagem = "ALERTA: Fermentação detectada!";
        classeCor = "status-podre";
    } else {
        // AGORA É PROPORCIONAL: Acima do limite é ruim.
        if (razaoGas <= limiteAtivo) {
            mensagem = "Status: Frutas em bom estado";
            classeCor = "status-bom";
        } else {
            mensagem = "STATUS: Limite de Gás Excedido! (Apodrecendo)";
            classeCor = "status-podre";
        }
    }

    elStatusBarra.textContent = mensagem;
    elStatusBarra.classList.add(classeCor);
    return mensagem; // Retorna para salvar no Log
}

function atualizarGrafico(valorRazao) {
    const hora = new Date().toLocaleTimeString();

    grafico.data.labels.push(hora);
    grafico.data.datasets[0].data.push(valorRazao);

    // Mantém no máximo os últimos 20 pontos no gráfico
    if (grafico.data.labels.length > 20) {
        grafico.data.labels.shift();
        grafico.data.datasets[0].data.shift();
    }
    grafico.update();
}

function registrarLog(peso, razaoGas, status) {
    const hora = new Date().toLocaleTimeString();
    const tr = document.createElement("tr");
    tr.style.borderBottom = "1px solid #eee";
    tr.innerHTML = `
        <td style="padding: 5px;">${hora}</td>
        <td>${perfilAtivoNome}</td>
        <td>${peso.toFixed(2)}</td>
        <td>${razaoGas.toFixed(2)}</td>
        <td>${status}</td>
    `;

    // Adiciona no topo da tabela
    tabelaLogs.insertBefore(tr, tabelaLogs.firstChild);
}

// ==========================================
// 3. LÓGICA DO CRUD
// ==========================================

function obterConfigsDoBanco() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
}

function salvarNoBanco(lista) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
}

function renderizarLista() {
    const configs = obterConfigsDoBanco();
    listaUl.innerHTML = "";

    configs.forEach((conf) => {
        const li = document.createElement("li");
        li.innerHTML = `
            <div class="info-config">
                <strong>${conf.nome}</strong>
                <div>Razão Gás Máxima: ${conf.limiteGas}</div>
            </div>
            <div class="acoes-config">
                <button class="btn-usar" onclick='ativarConfiguracao(${JSON.stringify(conf)})'>Ativar</button>
                <button class="btn-editar" onclick='carregarNoFormulario(${JSON.stringify(conf)})'>Editar</button>
                <button class="btn-excluir" onclick='excluirConfig(${conf.id})'>Excluir</button>
            </div>
        `;
        listaUl.appendChild(li);
    });
}

function salvarFormulario(e) {
    e.preventDefault();
    const id = inputId.value;
    const configData = {
        nome: inputNome.value,
        limiteGas: parseFloat(inputGas.value),
    };

    const configs = obterConfigsDoBanco();

    if (id) {
        configData.id = parseInt(id);
        const idx = configs.findIndex((c) => c.id === configData.id);
        if (idx > -1) configs[idx] = configData;
    } else {
        configData.id = Date.now();
        configs.push(configData);
    }

    salvarNoBanco(configs);
    cancelarEdicao();
    renderizarLista();
}

function carregarNoFormulario(config) {
    inputId.value = config.id;
    inputNome.value = config.nome;
    inputGas.value = config.limiteGas;
    tituloForm.textContent = `Editando: ${config.nome}`;
    btnCancelar.style.display = "block";
}

function cancelarEdicao() {
    form.reset();
    inputId.value = "";
    tituloForm.textContent = "Nova Configuração";
    btnCancelar.style.display = "none";
}

function excluirConfig(id) {
    if (confirm("Excluir este perfil?")) {
        const configs = obterConfigsDoBanco().filter((c) => c.id !== id);
        salvarNoBanco(configs);
        renderizarLista();
    }
}

// ==========================================
// 4. INTERAÇÃO CRUD -> HARDWARE
// ==========================================

function ativarConfiguracao(config) {
    limiteAtivo = config.limiteGas;
    perfilAtivoNome = config.nome;
    lblPerfilAtivo.textContent = `${config.nome} (Razão Max: ${config.limiteGas})`;
    alert(`Perfil ${config.nome} ativado!`);
}

// ==========================================
// 5. INICIALIZAÇÃO
// ==========================================

btnConectar.addEventListener("click", alternarConexao);
form.addEventListener("submit", salvarFormulario);
btnCancelar.addEventListener("click", cancelarEdicao);
renderizarLista();
