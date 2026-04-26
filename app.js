// ==========================================
// 1. CONFIGURAÇÕES E ESTADO GLOBAL
// ==========================================

const STORAGE_KEY = "fruteira_configs";

// Limites Ativos: Como a resistência (Rs/R0) CAI quando o gás sobe, os limites funcionam de forma inversa.
// Valores menores que o limite indicam MAIS gás.
let limitesAtivos = {
    bom: 0.95, // Acima de 0.95 = Bom
    alerta: 0.85, // Entre 0.85 e 0.95 = Amadurecendo. Abaixo de 0.85 = Apodrecendo.
};

let intervaloFetch = null;
let ipDoEsp = "";

// Elementos do DOM - Monitor
const btnConectar = document.getElementById("btnConectar");
const txtStatusConexao = document.getElementById("statusConexao");
const inputIp = document.getElementById("ipEsp");
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
// 2. LÓGICA DE CONEXÃO WI-FI (POLLING)
// ==========================================

function alternarConexao() {
    if (intervaloFetch) {
        // Desconectar
        clearInterval(intervaloFetch);
        intervaloFetch = null;
        txtStatusConexao.textContent = "Desconectado";
        txtStatusConexao.className = "desconectado";
        btnConectar.textContent = "📡 Conectar Wi-Fi";
        btnConectar.style.backgroundColor = "var(--accent)";
        inputIp.disabled = false;
    } else {
        // Conectar
        ipDoEsp = inputIp.value.trim();
        if (!ipDoEsp) {
            alert("Por favor, digite o endereço IP do ESP32.");
            return;
        }

        txtStatusConexao.textContent = "Conectando...";
        txtStatusConexao.className = "alerta"; // Pode criar essa classe amarela no CSS se quiser
        btnConectar.textContent = "🛑 Desconectar";
        btnConectar.style.backgroundColor = "var(--danger)";
        inputIp.disabled = true;

        // Inicia requisições a cada 2 segundos para atualizar a interface rapidamente
        // (Lembrando que o ESP32 recalcula as médias a cada 10s internamente)
        buscarDadosHardware();
        intervaloFetch = setInterval(buscarDadosHardware, 2000);
    }
}

async function buscarDadosHardware() {
    try {
        const resposta = await fetch(`http://${ipDoEsp}/dados`);
        if (!resposta.ok) throw new Error("Falha na resposta do hardware");

        const dados = await resposta.json();
        processarDados(dados);

        txtStatusConexao.textContent = "Conectado";
        txtStatusConexao.className = "conectado";
    } catch (erro) {
        console.error("Erro na leitura Wi-Fi:", erro);
        txtStatusConexao.textContent = "Falha na Rede";
        txtStatusConexao.className = "desconectado";
    }
}

function processarDados(dados) {
    // Atualiza a tela com dados brutos
    elPeso.textContent = dados.peso.toFixed(1);
    elTemp.textContent = dados.temp.toFixed(1);
    elUmid.textContent = dados.umid.toFixed(1);
    elGas.textContent = dados.etileno.toFixed(3);
    elAlc.textContent = dados.alcool.toFixed(3);

    // Delega a avaliação para a inteligência da interface
    atualizarStatusVisual(dados);
}

function atualizarStatusVisual(dados) {
    elStatusBarra.className = "status-barra";
    let mensagem = "";
    let classeCor = "";

    // LÓGICA DE NEGÓCIO AGORA RESIDE AQUI NA INTERFACE
    // Atenção à lógica inversa do sensor: Valores MENORES indicam MAIS gás presente.

    if (dados.peso < 5.0) {
        mensagem = "Status: Sem frutas";
        classeCor = "status-vazio";
    } else if (dados.alcool < 0.85) {
        // Regra de segurança dura (hard-coded): Se tiver muito álcool, independentemente do etileno
        mensagem = "ALERTA: Fermentação/Álcool detectado!";
        classeCor = "status-podre";
    } else {
        // Regra de etileno baseada nos inputs dinâmicos do CRUD do usuário
        if (dados.etileno >= limitesAtivos.bom) {
            mensagem = "Status: Ar limpo / Frutas boas";
            classeCor = "status-bom";
        } else if (dados.etileno >= limitesAtivos.alerta) {
            mensagem = "Status: Maturação ativa (Amadurecendo)";
            classeCor = "status-alerta";
            if (dados.peso < 50) mensagem += " - Fruteira quase vazia";
        } else {
            mensagem = "STATUS: ATENÇÃO! Limite crítico de gás atingido!";
            classeCor = "status-podre";
        }
    }

    elStatusBarra.textContent = mensagem;
    elStatusBarra.classList.add(classeCor);
}

// ==========================================
// 3. LÓGICA DO CRUD (Mantida igual, com parseFloat em vez de parseInt)
// ==========================================

function obterConfigsDoBanco() {
    const dados = localStorage.getItem(STORAGE_KEY);
    return dados ? JSON.parse(dados) : [];
}

function salvarNoBanco(listaConfigs) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(listaConfigs));
}

function renderizarLista() {
    const configs = obterConfigsDoBanco();
    listaUl.innerHTML = "";

    configs.forEach((conf) => {
        const li = document.createElement("li");

        const divInfo = document.createElement("div");
        divInfo.className = "info-config";
        divInfo.innerHTML = `
            <strong>${conf.nome}</strong>
            <div>Limites Gás: Bom >= ${conf.gasBom} | Alerta >= ${conf.gasAlerta}</div>
        `;

        const divAcoes = document.createElement("div");
        divAcoes.className = "acoes-config";

        const btnUsar = document.createElement("button");
        btnUsar.textContent = "Ativar";
        btnUsar.className = "btn-usar";
        btnUsar.onclick = () => ativarConfiguracao(conf);

        const btnEdit = document.createElement("button");
        btnEdit.textContent = "Editar";
        btnEdit.className = "btn-editar";
        btnEdit.onclick = () => carregarNoFormulario(conf);

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

function salvarFormulario(event) {
    event.preventDefault();

    const id = inputId.value;
    const configData = {
        nome: inputNome.value,
        gasBom: parseFloat(inputGasBom.value),
        gasAlerta: parseFloat(inputGasAlerta.value),
    };

    const configs = obterConfigsDoBanco();

    if (id) {
        configData.id = parseInt(id);
        const index = configs.findIndex((conf) => conf.id === configData.id);
        if (index !== -1) configs[index] = configData;
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
    inputGasBom.value = config.gasBom;
    inputGasAlerta.value = config.gasAlerta;
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
    if (confirm("Tem certeza que deseja excluir este perfil?")) {
        const configs = obterConfigsDoBanco();
        const listaNova = configs.filter((conf) => conf.id !== id);
        salvarNoBanco(listaNova);
        renderizarLista();
    }
}

// ==========================================
// 4. INTERAÇÃO CRUD -> HARDWARE
// ==========================================

function ativarConfiguracao(config) {
    limitesAtivos = {
        bom: config.gasBom,
        alerta: config.gasAlerta,
    };
    alert(
        `Limites ativados para avaliar o sensor!\nValores configurados: Bom >= ${config.gasBom} | Alerta >= ${config.gasAlerta}`,
    );
}

// ==========================================
// 5. INICIALIZAÇÃO
// ==========================================

btnConectar.addEventListener("click", alternarConexao);
form.addEventListener("submit", salvarFormulario);
btnCancelar.addEventListener("click", cancelarEdicao);

renderizarLista();
