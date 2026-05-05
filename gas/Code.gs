// =====================================================================
// INTENTO — BACKEND GOOGLE APPS SCRIPT (versão refatorada)
// =====================================================================

const ID_PLANILHA_MODELO = "1PXvzmMoM8g1JzN70HVvzaYT5ZMikrqd0bhxgkjPPFp8";
const ID_PASTA_TRIAGEM   = "1hx2RLHhHkY3nkPSr2tfWvgRZnduqG6u5";
const EMAIL_GESTOR       = "filippe@metodointento.com.br";
const URL_APP            = "https://mentoria.metodointento.com.br";

const ABA = {
  MESTRE:           "BD_Alunos",
  MENTORES:         "BD_Mentores",
  VENDEDORES:       "BD_Vendedores",
  LEADS:            "BD_Leads",
  EVENTOS_PIPELINE: "Eventos_Pipeline",
  CACHE:            "Cache_Alunos",
  PUSH_SUBS:        "Push_Subscriptions",
  LOGS_ERRO:        "Logs_Erro",
  ONBOARDING:       "BD_Onboarding",
  DIAGNOSTICO:      "BD_Diagnostico",
  REGISTROS:        "BD_Registro",
  ENCONTROS:        "BD_Diario",
  SEMANA:           "BD_Semana",
  SIMULADOS:        "BD_Sim_ENEM",
  CADERNO:          "BD_Caderno",
  TOPICOS:          "BD_Topicos",
  LGPD_ACEITES:     "LGPD_Aceites",
  DISPONIBILIDADE_EXCECOES: "BD_Disponibilidade_Excecoes",
  AVALIACOES:       "BD_Avaliacoes",
  LOGS_ERRO_FRONTEND: "Logs_Erro_Frontend"
};

// BD_Disponibilidade_Excecoes (8 cols)
const COL_EXCECAO = {
  ID: 0, VENDEDOR_EMAIL: 1, TIPO: 2, DT_INICIO: 3, DT_FIM: 4,
  MOTIVO: 5, CRIADO_EM: 6, CRIADO_POR: 7
};

// BD_Avaliacoes (10 cols) — provas escolares de alunos EM. Cadastrada pelo mentor responsável.
// nota (0-10) e observacao podem ser editadas após a prova vencer (post-mortem).
// substitui_id: id de outra avaliação que esta substitui (típico: recuperação substitui bimestral).
//   Quando preenchido, o Boletim ignora a substituída e usa a nota desta.
const COL_AV = {
  ID: 0, ID_ALUNO: 1, DATA: 2, MATERIA: 3, TIPO: 4,
  OBSERVACAO: 5, NOTA: 6, CRIADO_POR: 7, CRIADO_EM: 8,
  SUBSTITUI_ID: 9
};
const TIPOS_AVAL = ['bimestral', 'mensal', 'semanal', 'recuperacao'];

const FOLDER_BACKUPS_ID = "1UZjX1mZSsjMBRDDTYHKDHJglAj5iMUmp";

const FASES_LEAD = [
  'Lead', 'Numero invalido', 'Contactado WPP', 'Ativo WPP',
  'Reuniao agendada', 'Reuniao realizada',
  'Convertido', 'Taxa matricula paga', 'Contrato assinado',
  '1a mensalidade paga', 'Em mentoria', 'Churn'
];

// Outcomes possíveis pra reunião — campo separado da fase (padrão HubSpot/Pipedrive).
// Lead em qualquer fase pode ter outcome (ou não); o mais comum é setar quando
// move pra "Reuniao realizada" (o vendedor escolhe via dialog se foi realizada/no-show/etc).
const OUTCOMES_REUNIAO = ['', 'realizada', 'no-show', 'reagendada', 'cancelada'];

// Layout BD_Alunos (28 cols A–AB, snake_case headers)
// Cols 24–27 adicionadas pra fac-símile Acompanhamento Escolar (EM).
// Ativos no MVP: tipo_aluno (EM|ENEM, default ENEM), escola.
// Reservados/deprecated no MVP fac-símile (cols mantidas no schema mas inertes): turma, fase.
const COL_MESTRE = {
  TIMESTAMP: 0, NOME: 1, DATA_NASCIMENTO: 2, TELEFONE: 3,
  RESPONSAVEL_FINANCEIRO: 4, EMAIL: 5, CIDADE: 6, ESTADO: 7,
  ESCOLARIDADE: 8, ORIGEM_ENSINO_MEDIO: 9, COTA: 10, FEZ_ENEM_ANTES: 11,
  PROVAS_INTERESSE: 12, CURSO_INTERESSE: 13, PLATAFORMA_ONLINE: 14,
  NOTA_LINGUAGENS: 15, NOTA_HUMANAS: 16, NOTA_NATUREZA: 17, NOTA_MATEMATICA: 18,
  NOTA_REDACAO: 19, ID_PLANILHA: 20, MENTOR_RESPONSAVEL: 21, STATUS_ONBOARDING: 22,
  PLANO: 23,
  TIPO_ALUNO: 24, TURMA: 25, ESCOLA: 26, FASE: 27
};

const TIPOS_ALUNO = ['ENEM', 'EM'];

// Cache_Alunos: cache em aba separada — escrita em writes, leitura em dashboardLider
const COL_CACHE = {
  ID_PLANILHA: 0, ULTIMA_DATA_REGISTRO: 1, ULTIMA_SEMANA_REGISTRO: 2, ULTIMO_ENCONTRO: 3
};

// Push_Subscriptions: 1 linha por device subscrito
const COL_PUSH = {
  EMAIL: 0, ENDPOINT: 1, P256DH: 2, AUTH: 3, DT_SUBSCRICAO: 4, USER_AGENT: 5
};

// BD_Vendedores
const COL_VENDEDOR = {
  EMAIL: 0, NOME: 1, STATUS: 2, DT_ENTRADA: 3, HORARIOS: 4
};

// BD_Leads
const COL_LEAD = {
  ID:                     0,
  DT_CADASTRO:            1,
  NOME:                   2,
  TIPO_PERFIL:            3,
  NOME_RELACIONADO:       4,
  TELEFONE:               5,
  EMAIL:                  6,
  CIDADE:                 7,
  ESTADO:                 8,
  ORCAMENTO:              9,
  TEMPO_PREPARANDO:       10,
  VESTIBULARES:           11,
  CURSO_INTERESSE:        12,
  ORIGEM:                 13,
  INDICADO_POR:           14,
  VENDEDOR:               15,
  FASE:                   16,
  ANOTACOES:              17,
  PROXIMA_ACAO:           18,
  DATA_PROXIMA_ACAO:      19,
  DT_ULTIMA_ATUALIZACAO:  20,
  DADOS_TYPEBOT_RAW:      21,
  ID_ALUNO_GERADO:        22,
  PLANO:                  23,
  GCAL_EVENT_ID:          24,
  DT_ENTRADA_FASE:        25,
  OUTCOME_REUNIAO:        26
};

// Eventos_Pipeline (apend-only audit log)
const COL_EVENTO = {
  TIMESTAMP: 0, ID_LEAD: 1, ACAO: 2, DE_FASE: 3, PARA_FASE: 4, POR_EMAIL: 5
};

const COL_REG = {
  SEMANA: 0, MES: 1, DATA: 2, META: 3, HORAS: 4,
  DOMINIO_TOTAL: 5, PROGRESSO_TOTAL: 6, REVISOES: 7,
  ESTRESSE: 8, ANSIEDADE: 9, MOTIVACAO: 10, SONO: 11,
  DOM_BIO: 12, PROG_BIO: 13, DOM_QUI: 14, PROG_QUI: 15,
  DOM_FIS: 16, PROG_FIS: 17, DOM_MAT: 18, PROG_MAT: 19
};

const COL_ENC = {
  DATA: 0, AUTOAVALIACAO: 1, VITORIAS: 2, DESAFIOS: 3, CATEGORIA: 4,
  META: 5, EXPLORACAO: 6,
  ACAO_1: 7, ACAO_2: 8, ACAO_3: 9, ACAO_4: 10, ACAO_5: 11,
  RESULTADO_1: 12, RESULTADO_2: 13, RESULTADO_3: 14, RESULTADO_4: 15, RESULTADO_5: 16,
  NOTAS_PRIVADAS: 17  // ⚠️ Campo privado do mentor — NÃO incluir em obterDadosDoPainel
};

const COL_SIM = {
  ID: 0, STATUS: 1, DATA: 2, ESPECIFICACAO: 3,
  LG: 4, CH: 5, CN: 6, MAT: 7, REDACAO: 8, ERROS_JSON: 9,
  KOLB_EXP: 10, KOLB_REF: 11, KOLB_CON: 12, KOLB_ACAO: 13, KOLB_REDACAO: 14
};

const COL_CAD = {
  ID: 0, DISCIPLINA: 1, TOPICO: 2, DATA_ERRO: 3, PERGUNTA: 4,
  RESPOSTA: 5, ESTAGIO: 6, PROXIMA_REVISAO: 7, HISTORICO: 8,
  FONTE: 9, CLASSIFICACAO: 10
};

const CLASSIFICACOES_CADERNO = [
  'Erro de recordação', 'Erro de lacuna',
  'Erro de atenção', 'Erro de interpretação'
];

const COL_MENTOR = {
  EMAIL: 0, NOME: 1, STATUS: 2, DT_ENTRADA: 3
};

const COL_BD_ONB = {
  DATA_REGISTRO: 0, NOME: 1, DATA_NASCIMENTO: 2, TELEFONE: 3, EMAIL: 4,
  RESPONSAVEL_FINANCEIRO: 5, CIDADE: 6, ESTADO: 7, ESCOLARIDADE: 8,
  ORIGEM_ENSINO_MEDIO: 9, COTA: 10, FEZ_ENEM_ANTES: 11, PROVAS_INTERESSE: 12,
  CURSO_INTERESSE: 13, PLATAFORMA_ONLINE: 14, HISTORICO_ESTUDOS: 15,
  OBSTACULOS: 16, EXPECTATIVAS: 17, NOTA_LG: 18, NOTA_CH: 19, NOTA_CN: 20,
  NOTA_MAT: 21, NOTA_REDACAO: 22, TECNICA_INICIO: 23
};

// Defesa server-to-server: o /exec é uma URL pública. Sem token, qualquer um
// na internet pode chamar qualquer ação. O Next.js injeta API_TOKEN em todo
// payload via lib/gasClient.js. Para desligar temporariamente em debug, mude
// pra false — mas NUNCA faça deploy em produção com false.
const VALIDAR_TOKEN = false;


// =====================================================================
// HELPERS
// =====================================================================

function normalizarData(valor) {
  if (valor === null || valor === undefined || valor === "") return "";
  if (valor instanceof Date) return Utilities.formatDate(valor, "GMT-3", "dd/MM/yyyy");
  if (typeof valor === "number") {
    const d = new Date((valor - 25569) * 86400 * 1000);
    return Utilities.formatDate(d, "GMT-3", "dd/MM/yyyy");
  }
  const s = String(valor).trim();
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const partes = s.split("/");
    return partes[0].padStart(2, "0") + "/" + partes[1].padStart(2, "0") + "/" + partes[2];
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const partes = s.substring(0, 10).split("-");
    return partes[2] + "/" + partes[1] + "/" + partes[0];
  }
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return Utilities.formatDate(d, "GMT-3", "dd/MM/yyyy");
  } catch (e) {}
  return s;
}

function num(valor, padrao) {
  if (padrao === undefined) padrao = 0;
  if (valor === null || valor === undefined || valor === "") return padrao;
  var n = parseFloat(String(valor).replace(",", "."));
  return isNaN(n) ? padrao : n;
}

function txt(valor, padrao) {
  if (padrao === undefined) padrao = "";
  if (valor === null || valor === undefined) return padrao;
  return String(valor).trim();
}

function emailNorm(valor) {
  return txt(valor).toLowerCase();
}

function exigirIdPlanilha(dados, campo) {
  campo = campo || "idPlanilha";
  var id = dados[campo] || dados.idPlanilhaAluno || dados.idAluno;
  if (!id) throw new Error("ID da planilha ausente (campo esperado: " + campo + ").");
  return String(id).trim();
}

function pct(valor) {
  var n = num(valor);
  return (n > 0 && n <= 1 ? Math.round(n * 100) : Math.round(n)) + '%';
}


// =====================================================================
// PONTO DE ENTRADA
// =====================================================================

function doPost(e) {
  try {
    const dados = JSON.parse(e.postData.contents);

    if (VALIDAR_TOKEN) {
      const tokenEsperado = PropertiesService.getScriptProperties().getProperty("API_TOKEN");
      if (!tokenEsperado) {
        Logger.log("ERRO DE CONFIG: API_TOKEN não está em Script Properties. Setar via Project Settings > Script Properties.");
        return responderJSON({ status: "erro", mensagem: "Servidor mal configurado." }, 500);
      }
      if (dados.token !== tokenEsperado)
        return responderJSON({ status: "erro", mensagem: "Não autorizado." }, 401);
    }

    const acao = dados.acao || dados.tipo || "onboarding";

    if (acao === "onboarding")              return handleOnboarding(dados);
    if (acao === "diagnostico")             return handleDiagnostico(dados);
    if (acao === "login")                   return handleLogin(dados);
    if (acao === "listaAlunosMentor")       return handleListaAlunosMentor(dados);
    if (acao === "salvarDiario")            return handleSalvarDiario(dados);
    if (acao === "salvarSemanaLote")        return handleSalvarSemanaLote(dados);
    if (acao === "salvarRegistroGlobal")    return handleSalvarRegistroGlobal(dados);
    if (acao === "deletarRegistro")         return handleDeletarRegistro(dados);
    if (acao === "verificarRegistroSemana") return handleVerificarRegistroSemana(dados);
    if (acao === "buscarDadosAluno")        return handleBuscarDadosAluno(dados);
    if (acao === "buscarMetaAnterior")      return handleBuscarMetaAnterior(dados);
    if (acao === "loginGlobal")             return handleLoginGlobal(dados);
    if (acao === "avaliarEncontroPassado")  return handleAvaliarEncontroPassado(dados);
    if (acao === "salvarNovoEncontro")      return handleSalvarNovoEncontro(dados);
    if (acao === "salvarSimulado")          return handleSalvarSimulado(dados);
    if (acao === "buscarTopicosGlobais")    return handleBuscarTopicosGlobais();
    if (acao === "salvarAutopsia")          return handleSalvarAutopsia(dados);
    if (acao === "listarCaderno")           return handleListarCaderno(dados);
    if (acao === "salvarCardCaderno")       return handleSalvarCardCaderno(dados);
    if (acao === "incrementarRepeticao")    return handleIncrementarRepeticao(dados);
    if (acao === "deletarCardCaderno")      return handleDeletarCardCaderno(dados);
    if (acao === "buscarOnboarding")        return handleBuscarOnboarding(dados);
    if (acao === "registrarRevisaoCaderno") return handleRegistrarRevisaoCaderno(dados);
    if (acao === "editarRegistro")          return handleEditarRegistro(dados);
    if (acao === "editarEncontro")          return handleEditarEncontro(dados);
    if (acao === "dashboardLider")          return handleDashboardLider(dados);
    if (acao === "designarMentor")          return handleDesignarMentor(dados);
    if (acao === "atualizarDadosAluno")     return handleAtualizarDadosAluno(dados);
    if (acao === "cadastrarAvaliacoes")     return handleCadastrarAvaliacoes(dados);
    if (acao === "listarAvaliacoesAluno")   return handleListarAvaliacoesAluno(dados);
    if (acao === "atualizarAvaliacao")      return handleAtualizarAvaliacao(dados);
    if (acao === "deletarAvaliacao")        return handleDeletarAvaliacao(dados);
    if (acao === "subscribePush")           return handleSubscribePush(dados);
    if (acao === "unsubscribePush")         return handleUnsubscribePush(dados);
    if (acao === "listarPushSubscriptions") return handleListarPushSubscriptions(dados);
    if (acao === "criarLead")               return handleCriarLead(dados);
    if (acao === "editarLead")              return handleEditarLead(dados);
    if (acao === "moverLeadFase")           return handleMoverLeadFase(dados);
    if (acao === "listarLeads")             return handleListarLeads(dados);
    if (acao === "dashboardCrm")            return handleDashboardCrm(dados);
    if (acao === "converterLeadEmAluno")    return handleConverterLeadEmAluno(dados);
    if (acao === "deletarLead")             return handleDeletarLead(dados);
    if (acao === "buscarLead")              return handleBuscarLead(dados);
    if (acao === "buscarLeadPorEmail")      return handleBuscarLeadPorEmail(dados);
    if (acao === "buscarLeadPorGcalEventId") return handleBuscarLeadPorGcalEventId(dados);
    if (acao === "listarVendedoresAtendimento") return handleListarVendedoresAtendimento(dados);
    if (acao === "salvarHorariosPadrao")    return handleSalvarHorariosPadrao(dados);
    if (acao === "lerHorariosPadrao")       return handleLerHorariosPadrao(dados);
    if (acao === "criarExcecaoDisponibilidade") return handleCriarExcecaoDisponibilidade(dados);
    if (acao === "removerExcecaoDisponibilidade") return handleRemoverExcecaoDisponibilidade(dados);
    if (acao === "listarExcecoesDisponibilidade") return handleListarExcecoesDisponibilidade(dados);
    if (acao === "cargaPorVendedorNoMes")   return handleCargaPorVendedorNoMes(dados);
    if (acao === "registrarErroFrontend")   return handleRegistrarErroFrontend(dados);

    throw new Error("Ação não reconhecida: " + acao);

  } catch (error) {
    registrarErro(error, e ? e.postData.contents : "Sem payload");
    return responderJSON({ status: "erro", mensagem: error.message }, 400);
  }
}


// =====================================================================
// CONTROLADORES
// =====================================================================

function handleLogin(dados) {
  const emailAluno = emailNorm(dados.email);
  if (!emailAluno) throw new Error("E-mail não fornecido para login.");

  const ssMestre   = SpreadsheetApp.getActiveSpreadsheet();
  const sheetMestre = ssMestre.getSheetByName(ABA.MESTRE);
  if (!sheetMestre) throw new Error("Aba mestre '" + ABA.MESTRE + "' não encontrada.");

  const dataMatriz  = sheetMestre.getDataRange().getValues();
  const cabecalho   = dataMatriz[0] || [];
  let colEmail      = COL_MESTRE.EMAIL;
  let colIdPlanilha = COL_MESTRE.ID_PLANILHA;

  for (let c = 0; c < cabecalho.length; c++) {
    const h = txt(cabecalho[c]).toLowerCase().replace(/[^a-z]/g, '');
    if (h === 'email') colEmail = c;
    if (h === 'iddaplanilha' || h === 'idplanilha' || h === 'idplanilhaaluno') colIdPlanilha = c;
  }

  let idPlanilhaAluno = null;
  let tipoAlunoLogin = 'ENEM';
  for (let i = dataMatriz.length - 1; i >= 1; i--) {
    if (dataMatriz[i][colEmail] && emailNorm(dataMatriz[i][colEmail]) === emailAluno) {
      idPlanilhaAluno = dataMatriz[i][colIdPlanilha] || null;
      tipoAlunoLogin = txt(dataMatriz[i][COL_MESTRE.TIPO_ALUNO]) || 'ENEM';
      break;
    }
  }

  if (!idPlanilhaAluno)
    return responderJSON({ status: 200, email: emailAluno, perfil: "PENDENTE" });

  const ssAluno      = SpreadsheetApp.openById(idPlanilhaAluno);
  const dashboardData = obterDadosDoPainel(ssAluno, emailAluno);
  return responderJSON({ status: 200, email: emailAluno, idPlanilha: idPlanilhaAluno, tipoAluno: tipoAlunoLogin, dadosPainel: dashboardData });
}


// === LGPD: registra aceite em aba dedicada (append-only audit log) ===
// Cria a aba LGPD_Aceites na primeira chamada se não existir.
function registrarAceiteLGPD(dados) {
  try {
    var ssMestre = SpreadsheetApp.getActiveSpreadsheet();
    var aba = ssMestre.getSheetByName(ABA.LGPD_ACEITES);
    if (!aba) {
      aba = ssMestre.insertSheet(ABA.LGPD_ACEITES);
      aba.getRange(1, 1, 1, 8).setValues([[
        'timestamp', 'tipo', 'identificador', 'email',
        'lgpd_aceito', 'eh_menor', 'responsavel_aceitou', 'user_agent'
      ]]);
    }
    aba.appendRow([
      new Date(),
      txt(dados.tipo),
      txt(dados.identificador),
      emailNorm(dados.email),
      dados.lgpdAceito === true,
      dados.ehMenor === true,
      dados.responsavelAceitou === true,
      txt(dados.userAgent)
    ]);
  } catch (e) {
    Logger.log('registrarAceiteLGPD EXCEPTION: ' + e.message);
  }
}

function handleOnboarding(dados) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheetMestre = ss.getSheetByName(ABA.MESTRE);
    if (!sheetMestre) sheetMestre = ss.insertSheet(ABA.MESTRE);

    const dp = dados.dadosPessoais       || {};
    const pa = dados.perfilAcademico     || {};
    const na = dados.notasAnteriores     || {};
    const dt = dados.diagnosticoTecnica  || {};
    const agora = new Date();

    const arrayOnboarding = new Array(53).fill("");
    arrayOnboarding[COL_BD_ONB.DATA_REGISTRO]          = agora;
    arrayOnboarding[COL_BD_ONB.NOME]                   = txt(dp.nome);
    arrayOnboarding[COL_BD_ONB.DATA_NASCIMENTO]        = txt(dp.dataNascimento);
    arrayOnboarding[COL_BD_ONB.TELEFONE]               = txt(dp.telefone);
    arrayOnboarding[COL_BD_ONB.EMAIL]                  = emailNorm(dp.email);
    arrayOnboarding[COL_BD_ONB.RESPONSAVEL_FINANCEIRO] = txt(dp.responsavelFinanceiro);
    arrayOnboarding[COL_BD_ONB.CIDADE]                 = txt(dp.cidade);
    arrayOnboarding[COL_BD_ONB.ESTADO]                 = txt(dp.estado);
    arrayOnboarding[COL_BD_ONB.ESCOLARIDADE]           = txt(pa.escolaridade);
    arrayOnboarding[COL_BD_ONB.ORIGEM_ENSINO_MEDIO]    = txt(pa.origemEnsinoMedio);
    arrayOnboarding[COL_BD_ONB.COTA]                   = txt(pa.cota);
    arrayOnboarding[COL_BD_ONB.FEZ_ENEM_ANTES]         = txt(pa.fezEnemAntes);
    arrayOnboarding[COL_BD_ONB.PROVAS_INTERESSE]       = txt(pa.provasInteresse);
    arrayOnboarding[COL_BD_ONB.CURSO_INTERESSE]        = txt(pa.cursoInteresse);
    arrayOnboarding[COL_BD_ONB.PLATAFORMA_ONLINE]      = txt(pa.plataformaOnline);
    arrayOnboarding[COL_BD_ONB.HISTORICO_ESTUDOS]      = txt(pa.historicoEstudos);
    arrayOnboarding[COL_BD_ONB.OBSTACULOS]             = txt(pa.tresMaioresObstaculos);
    arrayOnboarding[COL_BD_ONB.EXPECTATIVAS]           = txt(pa.expectativasMentoria);
    arrayOnboarding[COL_BD_ONB.NOTA_LG]                = txt(na.linguagens);
    arrayOnboarding[COL_BD_ONB.NOTA_CH]                = txt(na.humanas);
    arrayOnboarding[COL_BD_ONB.NOTA_CN]                = txt(na.natureza);
    arrayOnboarding[COL_BD_ONB.NOTA_MAT]               = txt(na.matematica);
    arrayOnboarding[COL_BD_ONB.NOTA_REDACAO]           = txt(na.redacao);

    const tecnicas = [
      dt.leituraPrevia, dt.estruturaMental, dt.interacaoAula, dt.atencaoConceitos,
      dt.escrevePerguntas, dt.escreveMinimo, dt.poucasPalavras, dt.setasFiguras,
      dt.logicaPropria, dt.revisaAnotacoes, dt.procuraMaterial, dt.ferramentasMemorizacao,
      dt.passaVariasVezes, dt.cronogramaRevisoes, dt.revisaoEspacada, dt.padraoRevisao,
      dt.revisaoAtiva, dt.diferentesMetodos, dt.criaFlashcards, dt.procuraFraquezas,
      dt.durmo8Horas, dt.horarioRegular, dt.sonoReparador, dt.exercicioFisico,
      dt.treinoAtencao, dt.estudaLugaresDiferentes, dt.objetivosClaros, dt.gestaoAtencao,
      dt.pausasDescanso, dt.pausasSemTelas
    ];
    for (let i = 0; i < tecnicas.length; i++)
      arrayOnboarding[COL_BD_ONB.TECNICA_INICIO + i] = txt(tecnicas[i]);

    const nomeMentorado   = txt(dp.nome) || "Novo Mentorado";
    const emailMentorado  = emailNorm(dp.email);
    const idNovaPlanilha  = provisionarPlanilhaAluno(nomeMentorado, emailMentorado, arrayOnboarding);

    const linhaMestre = new Array(28).fill("");
    linhaMestre[COL_MESTRE.TIMESTAMP]              = agora;
    linhaMestre[COL_MESTRE.NOME]                   = nomeMentorado;
    linhaMestre[COL_MESTRE.DATA_NASCIMENTO]        = normalizarData(dp.dataNascimento);
    linhaMestre[COL_MESTRE.TELEFONE]               = txt(dp.telefone);
    linhaMestre[COL_MESTRE.RESPONSAVEL_FINANCEIRO] = txt(dp.responsavelFinanceiro);
    linhaMestre[COL_MESTRE.EMAIL]                  = emailMentorado;
    linhaMestre[COL_MESTRE.CIDADE]                 = txt(dp.cidade);
    linhaMestre[COL_MESTRE.ESTADO]                 = txt(dp.estado);
    linhaMestre[COL_MESTRE.ESCOLARIDADE]           = txt(pa.escolaridade);
    linhaMestre[COL_MESTRE.ORIGEM_ENSINO_MEDIO]    = txt(pa.origemEnsinoMedio);
    linhaMestre[COL_MESTRE.COTA]                   = txt(pa.cota);
    linhaMestre[COL_MESTRE.FEZ_ENEM_ANTES]         = txt(pa.fezEnemAntes);
    linhaMestre[COL_MESTRE.PROVAS_INTERESSE]       = txt(pa.provasInteresse);
    linhaMestre[COL_MESTRE.CURSO_INTERESSE]        = txt(pa.cursoInteresse);
    linhaMestre[COL_MESTRE.PLATAFORMA_ONLINE]      = txt(pa.plataformaOnline);
    linhaMestre[COL_MESTRE.NOTA_LINGUAGENS]        = txt(na.linguagens);
    linhaMestre[COL_MESTRE.NOTA_HUMANAS]           = txt(na.humanas);
    linhaMestre[COL_MESTRE.NOTA_NATUREZA]          = txt(na.natureza);
    linhaMestre[COL_MESTRE.NOTA_MATEMATICA]        = txt(na.matematica);
    linhaMestre[COL_MESTRE.NOTA_REDACAO]           = txt(na.redacao);
    linhaMestre[COL_MESTRE.ID_PLANILHA]            = idNovaPlanilha;
    linhaMestre[COL_MESTRE.STATUS_ONBOARDING]      = "Aguardando Diagnóstico";
    linhaMestre[COL_MESTRE.TIPO_ALUNO]             = "ENEM";

    sheetMestre.appendRow(linhaMestre);

    // Registra aceite LGPD (audit log append-only)
    if (dados.consentimento) {
      registrarAceiteLGPD({
        tipo: 'aluno_onboarding',
        identificador: idNovaPlanilha,
        email: emailMentorado,
        lgpdAceito: dados.consentimento.lgpdAceito,
        ehMenor: dados.consentimento.ehMenor,
        responsavelAceitou: dados.consentimento.responsavelLegalAceitou,
        userAgent: dados.consentimento.userAgent
      });
    }

    return responderJSON({ status: "sucesso", idPlanilha: idNovaPlanilha });

  } finally {
    lock.releaseLock();
  }
}


function handleDiagnostico(dados) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    const emailAluno = emailNorm(dados.email);
    if (!emailAluno) throw new Error("E-mail não fornecido no diagnóstico.");

    const ssMestre    = SpreadsheetApp.getActiveSpreadsheet();
    const sheetMestre = ssMestre.getSheetByName(ABA.MESTRE) || ssMestre.getSheets()[0];
    const dataMatriz  = sheetMestre.getDataRange().getValues();
    let linhaMestreIndex = -1;
    let fileIdEncontrado = null;

    for (let i = dataMatriz.length - 1; i >= 0; i--) {
      if (dataMatriz[i][COL_MESTRE.EMAIL] && emailNorm(dataMatriz[i][COL_MESTRE.EMAIL]) === emailAluno) {
        linhaMestreIndex = i + 1;
        fileIdEncontrado = dataMatriz[i][COL_MESTRE.ID_PLANILHA] || null;
        break;
      }
    }

    if (linhaMestreIndex === -1) throw new Error("Onboarding não localizado para este e-mail.");
    if (!fileIdEncontrado)       throw new Error("Planilha do aluno não encontrada para este e-mail.");

    const ssAluno = SpreadsheetApp.openById(fileIdEncontrado);
    let abaDiag   = ssAluno.getSheetByName(ABA.DIAGNOSTICO);
    if (!abaDiag) {
      abaDiag = ssAluno.insertSheet(ABA.DIAGNOSTICO);
      abaDiag.appendRow(["Data", "Acertos_Bio", "Acertos_Qui", "Acertos_Fis", "Acertos_Mat"]);
    }
    abaDiag.appendRow([
      new Date(),
      num(dados.acertosBiologia), num(dados.acertosQuimica),
      num(dados.acertosFisica),   num(dados.acertosMatematica)
    ]);

    sheetMestre.getRange(linhaMestreIndex, COL_MESTRE.STATUS_ONBOARDING + 1).setValue("Onboarding Completo");

    // Notifica líder imediatamente que tem aluno aguardando designação
    try {
      var nomeAluno = txt(dataMatriz[linhaMestreIndex - 1][COL_MESTRE.NOME]) || emailAluno;
      _notificarLiderAlunoAguardando(nomeAluno);
    } catch (e) { Logger.log('falha notificar lider: ' + e.message); }

    return responderJSON({ status: "sucesso" });

  } finally {
    lock.releaseLock();
  }
}


// =====================================================================
// SERVIÇOS E EXTRAÇÃO DE DADOS
// =====================================================================

// Retry exponencial pra erros transitórios do Drive (ex: "Service error: Drive").
// Não retenta erros de permissão/ID inválido — esses são determinísticos.
function _retryDrive(fn, tentativas) {
  tentativas = tentativas || 3;
  let ultimoErro;
  for (let i = 0; i < tentativas; i++) {
    try { return fn(); }
    catch (e) {
      ultimoErro = e;
      const msg = String(e.message || '');
      if (!/Service error|tempor[áa]ri|Internal|timed?\s*out|backend/i.test(msg)) throw e;
      Logger.log('_retryDrive tentativa ' + (i+1) + '/' + tentativas + ' falhou: ' + msg);
      if (i < tentativas - 1) Utilities.sleep(500 * Math.pow(2, i)); // 500ms, 1s, 2s
    }
  }
  throw ultimoErro;
}

function provisionarPlanilhaAluno(nomeMentorado, emailMentorado, arrayOnboarding) {
  const primeiroNome  = nomeMentorado.split(" ")[0];
  const pastaTriagem  = DriveApp.getFolderById(ID_PASTA_TRIAGEM);
  const arquivoModelo = DriveApp.getFileById(ID_PLANILHA_MODELO);
  const novoArquivo   = _retryDrive(function() {
    return arquivoModelo.makeCopy("Mentoria - " + nomeMentorado, pastaTriagem);
  });
  const idNovaPlanilha = novoArquivo.getId();

  const novaPlanilha = SpreadsheetApp.openById(idNovaPlanilha);
  const abaOnb       = novaPlanilha.getSheetByName(ABA.ONBOARDING);
  if (!abaOnb) {
    registrarErro(new Error("Modelo não tem aba '" + ABA.ONBOARDING + "'."), "provisionarPlanilhaAluno");
  } else {
    abaOnb.getRange(2, 1, 1, arrayOnboarding.length).setValues([arrayOnboarding]);
  }

  if (emailMentorado) {
    try {
      MailApp.sendEmail(emailMentorado,
        "Intento — próximo passo: seu Diagnóstico Teórico",
        "Olá, " + primeiroNome + ",\n\n" +
        "Recebi agora seu Questionário de Onboarding. Antes de qualquer coisa,\n" +
        "obrigado pela confiança em nos escolher.\n\n" +
        "O próximo passo é o Diagnóstico Teórico (cerca de 15 minutos).\n\n" +
        "Como acessar:\n" +
        "  1. Entre em " + URL_APP + "\n" +
        "  2. Faça login com este mesmo e-mail (" + emailMentorado + ")\n" +
        "  3. No Hub, clique em 'Diagnóstico Teórico'\n\n" +
        "Filippe Lemos\nHead de Mentoria — Intento"
      );
    } catch (e) { registrarErro(e, "email ao aluno: " + emailMentorado); }
  }

  try {
    MailApp.sendEmail(EMAIL_GESTOR, "Novo Aluno: " + nomeMentorado,
      "Nome: " + nomeMentorado + "\nEmail: " + emailMentorado +
      "\nPlanilha: " + novoArquivo.getUrl());
  } catch (e) { registrarErro(e, "email ao gestor"); }

  return idNovaPlanilha;
}


function obterDadosDoPainel(ss, emailAluno) {
  try {
    const shRegistros  = ss.getSheetByName(ABA.REGISTROS);
    const shEncontros  = ss.getSheetByName(ABA.ENCONTROS);
    const shOnboarding = ss.getSheetByName(ABA.ONBOARDING);

    // ---- Aluno ----
    let nomeAluno = emailAluno;
    if (shOnboarding) {
      const dadosOb = shOnboarding.getDataRange().getValues();
      for (let i = 1; i < dadosOb.length; i++) {
        if (emailNorm(dadosOb[i][COL_BD_ONB.EMAIL]) === emailNorm(emailAluno)) {
          nomeAluno = dadosOb[i][COL_BD_ONB.NOME] || emailAluno;
          break;
        }
      }
    }

    // ---- Registros semanais ----
    const historicoRegistros = [];
    const mensal = { labels: [], meta: [], horas: [], domTot: [], progTot: [], estresse: [], ansiedade: [], motivacao: [], sono: [] };
    const snapshot = { dom: [0, 0, 0, 0], prog: [0, 0, 0, 0] };

    if (shRegistros) {
      const dadosReg = shRegistros.getDataRange().getValues();
      let ultimoReg  = null;
      for (let i = 1; i < dadosReg.length; i++) {
        const row = dadosReg[i];
        if (!row[COL_REG.SEMANA]) continue;
        historicoRegistros.push(row.slice(0, 20));
        mensal.labels.push(String(row[COL_REG.SEMANA]));
        mensal.meta.push(num(row[COL_REG.META]));
        mensal.horas.push(num(row[COL_REG.HORAS]));
        mensal.domTot.push(num(row[COL_REG.DOMINIO_TOTAL]));
        mensal.progTot.push(num(row[COL_REG.PROGRESSO_TOTAL]));
        mensal.estresse.push(num(row[COL_REG.ESTRESSE]));
        mensal.ansiedade.push(num(row[COL_REG.ANSIEDADE]));
        mensal.motivacao.push(num(row[COL_REG.MOTIVACAO]));
        mensal.sono.push(num(row[COL_REG.SONO]));
        ultimoReg = row;
      }
      if (ultimoReg) {
        snapshot.dom  = [num(ultimoReg[COL_REG.DOM_BIO]), num(ultimoReg[COL_REG.DOM_QUI]), num(ultimoReg[COL_REG.DOM_FIS]), num(ultimoReg[COL_REG.DOM_MAT])];
        snapshot.prog = [num(ultimoReg[COL_REG.PROG_BIO]), num(ultimoReg[COL_REG.PROG_QUI]), num(ultimoReg[COL_REG.PROG_FIS]), num(ultimoReg[COL_REG.PROG_MAT])];
      }
    }

    // ---- Semanal (cards estruturados para o frontend) ----
    const n       = historicoRegistros.length;
    const regCurr = n > 0 ? historicoRegistros[n - 1] : null;
    const regPrev = n > 1 ? historicoRegistros[n - 2] : null;

    function mkCard(name, theme, currVal, prevVal) {
      return { name: name, theme: theme, curr: String(currVal ?? ''), prev: String(prevVal ?? '') };
    }

    let autoAvalCurr = '', autoAvalPrev = '';
    if (shEncontros) {
      const dadosEnc = shEncontros.getDataRange().getValues();
      const encRows  = [];
      for (let i = 1; i < dadosEnc.length; i++)
        if (dadosEnc[i][COL_ENC.DATA]) encRows.push(dadosEnc[i]);
      if (encRows.length > 0) autoAvalCurr = txt(encRows[encRows.length - 1][COL_ENC.AUTOAVALIACAO]);
      if (encRows.length > 1) autoAvalPrev = txt(encRows[encRows.length - 2][COL_ENC.AUTOAVALIACAO]);
    }

    const semanal = { isFirstWeek: n === 0, streak: [], geral: [], estilo: [], desempenho: [] };

    if (shEncontros) {
      const dadosEncS = shEncontros.getDataRange().getValues();
      for (let i = 1; i < dadosEncS.length; i++)
        if (dadosEncS[i][COL_ENC.DATA])
          semanal.streak.push(dadosEncS[i][COL_ENC.RESULTADO_1] ? 1 : 0);
    }

    if (regCurr) {
      semanal.geral = [
        mkCard('Horas Estudadas',    'emerald', num(regCurr[COL_REG.HORAS]),          regPrev ? num(regPrev[COL_REG.HORAS])          : ''),
        mkCard('Domínio Geral',      'blue',    pct(regCurr[COL_REG.DOMINIO_TOTAL]),  regPrev ? pct(regPrev[COL_REG.DOMINIO_TOTAL])  : ''),
        mkCard('Progresso Geral',    'purple',  pct(regCurr[COL_REG.PROGRESSO_TOTAL]),regPrev ? pct(regPrev[COL_REG.PROGRESSO_TOTAL]): ''),
        mkCard('Revisões Atrasadas', 'red',     num(regCurr[COL_REG.REVISOES]),       regPrev ? num(regPrev[COL_REG.REVISOES])       : '')
      ];
      semanal.estilo = [
        mkCard('Estresse',  'red',     num(regCurr[COL_REG.ESTRESSE]),  regPrev ? num(regPrev[COL_REG.ESTRESSE])  : ''),
        mkCard('Ansiedade', 'red',     num(regCurr[COL_REG.ANSIEDADE]), regPrev ? num(regPrev[COL_REG.ANSIEDADE]) : ''),
        mkCard('Motivação', 'emerald', num(regCurr[COL_REG.MOTIVACAO]), regPrev ? num(regPrev[COL_REG.MOTIVACAO]) : ''),
        mkCard('Sono',      'blue',    num(regCurr[COL_REG.SONO]),      regPrev ? num(regPrev[COL_REG.SONO])      : '')
      ];
      semanal.desempenho = [
        mkCard('Dom. Biologia',    'emerald', pct(regCurr[COL_REG.DOM_BIO]),  regPrev ? pct(regPrev[COL_REG.DOM_BIO])  : ''),
        mkCard('Prog. Biologia',   'emerald', pct(regCurr[COL_REG.PROG_BIO]), regPrev ? pct(regPrev[COL_REG.PROG_BIO]) : ''),
        mkCard('Dom. Química',     'purple',  pct(regCurr[COL_REG.DOM_QUI]),  regPrev ? pct(regPrev[COL_REG.DOM_QUI])  : ''),
        mkCard('Prog. Química',    'purple',  pct(regCurr[COL_REG.PROG_QUI]), regPrev ? pct(regPrev[COL_REG.PROG_QUI]) : ''),
        mkCard('Dom. Física',      'blue',    pct(regCurr[COL_REG.DOM_FIS]),  regPrev ? pct(regPrev[COL_REG.DOM_FIS])  : ''),
        mkCard('Prog. Física',     'blue',    pct(regCurr[COL_REG.PROG_FIS]), regPrev ? pct(regPrev[COL_REG.PROG_FIS]) : ''),
        mkCard('Dom. Matemática',  'slate',   pct(regCurr[COL_REG.DOM_MAT]),  regPrev ? pct(regPrev[COL_REG.DOM_MAT])  : ''),
        mkCard('Prog. Matemática', 'slate',   pct(regCurr[COL_REG.PROG_MAT]), regPrev ? pct(regPrev[COL_REG.PROG_MAT]) : '')
      ];
    }

    // ---- Plano + Último Encontro do Diário (snapshot completo) ----
    // ⚠️ ESTE CAMINHO É CONSUMIDO PELO ALUNO (rota /painel). NÃO incluir
    // COL_ENC.NOTAS_PRIVADAS aqui — esse campo é privado do mentor e só
    // vai pelo handleBuscarDadosAluno (rota /mentor/[id]).
    const plano = { data: "--", meta: "Nenhuma meta definida", acao: [] };
    let ultimoEncontro = null;
    if (shEncontros) {
      const dadosEnc = shEncontros.getDataRange().getValues();
      for (let i = dadosEnc.length - 1; i >= 1; i--) {
        const row = dadosEnc[i];
        if (!row[COL_ENC.DATA]) continue;
        const rawData = row[COL_ENC.DATA];
        const dataFmt = rawData instanceof Date
          ? Utilities.formatDate(rawData, Session.getScriptTimeZone(), "dd/MM/yyyy")
          : String(rawData);
        plano.data = dataFmt;
        plano.meta = txt(row[COL_ENC.META]) || plano.meta;
        const acoes = [row[COL_ENC.ACAO_1], row[COL_ENC.ACAO_2], row[COL_ENC.ACAO_3], row[COL_ENC.ACAO_4], row[COL_ENC.ACAO_5]];
        plano.acao  = acoes.map(function(a) { return txt(a); }).filter(function(a) { return a !== ""; });

        ultimoEncontro = {
          data:          dataFmt,
          autoavaliacao: parseInt(row[COL_ENC.AUTOAVALIACAO]) || 0,
          vitorias:      txt(row[COL_ENC.VITORIAS]),
          desafios:      txt(row[COL_ENC.DESAFIOS]),
          categoria:     txt(row[COL_ENC.CATEGORIA]),
          meta:          txt(row[COL_ENC.META]),
          exploracao:    txt(row[COL_ENC.EXPLORACAO]),
          acoes:         acoes.map(txt),
          resultados:    [
            txt(row[COL_ENC.RESULTADO_1]), txt(row[COL_ENC.RESULTADO_2]),
            txt(row[COL_ENC.RESULTADO_3]), txt(row[COL_ENC.RESULTADO_4]),
            txt(row[COL_ENC.RESULTADO_5])
          ]
        };
        break;
      }
    }

    // ---- Simulados ----
    const simAgg = lerSimulados(ss);
    const simKpi = simAgg.kpi;
    const histSim = simAgg.hist;
    const listaSimulados = simAgg.lista;

    // Semana Padrão (rotina): lê BD_semana e monta { dia: [{hora, atividade}, ...] }
    // BD_semana é gravado pelo mentor com colunas na ordem Seg→Dom; o painel do aluno
    // espera rotinaDias em ordem Dom→Sáb (alinhado com new Date().getDay()).
    const rotinaDias       = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    const COLUNAS_BD_SEMANA = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];
    const HORARIOS_ROTINA  = ["07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00"];
    const rotina = {};
    rotinaDias.forEach(function(d) { rotina[d] = []; });
    const abaSemanaPadrao = ss.getSheetByName(ABA.SEMANA);
    if (abaSemanaPadrao) {
      const matrizSemana = abaSemanaPadrao.getRange(2, 2, 16, 7).getValues();
      for (let l = 0; l < 16; l++) {
        for (let c = 0; c < 7; c++) {
          const atividade = txt(matrizSemana[l][c]);
          if (atividade) rotina[COLUNAS_BD_SEMANA[c]].push({ hora: HORARIOS_ROTINA[l], atividade: atividade });
        }
      }
    }

    return {
      aluno: { nome: nomeAluno }, snapshot: snapshot, mensal: mensal,
      semanal: semanal, plano: plano, ultimoEncontro: ultimoEncontro,
      rotina: rotina, rotinaDias: rotinaDias,
      sim: { kpi: simKpi, hist: histSim, lista: listaSimulados },
      registros: historicoRegistros, idPlanilha: ss.getId()
    };

  } catch (err) {
    Logger.log("obterDadosDoPainel error: " + err.message);
    return { erro: err.message };
  }
}


// =====================================================================
// UTILITÁRIOS
// =====================================================================

function responderJSON(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}

// Recebe erros não-tratados do frontend (Error Boundary do Next).
// Não exige autorização — erros podem acontecer pré-login. O Next já filtra
// chamadas externas pelo GAS_API_TOKEN, então só nosso próprio frontend chega.
// Limita tamanho de campos pra evitar log inflado por stack gigante.
function handleRegistrarErroFrontend(dados) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let aba = ss.getSheetByName(ABA.LOGS_ERRO_FRONTEND);
    if (!aba) {
      aba = ss.insertSheet(ABA.LOGS_ERRO_FRONTEND);
      aba.appendRow(['timestamp', 'email', 'url', 'message', 'stack', 'user_agent']);
      aba.setFrozenRows(1);
    }
    aba.appendRow([
      new Date(),
      emailNorm(dados.email).slice(0, 120),
      txt(dados.url).slice(0, 500),
      txt(dados.message).slice(0, 500),
      txt(dados.stack).slice(0, 4000),
      txt(dados.userAgent).slice(0, 300)
    ]);
    return responderJSON({ status: 'sucesso' });
  } catch (e) {
    // Não deixa erro do log de erro virar erro pro client.
    Logger.log('handleRegistrarErroFrontend EXCEPTION: ' + e.message);
    return responderJSON({ status: 'sucesso' });
  }
}

function registrarErro(error, payloadRecebido) {
  try {
    const ssErro    = SpreadsheetApp.getActiveSpreadsheet();
    let sheetErro   = ssErro.getSheetByName(ABA.LOGS_ERRO);
    if (!sheetErro) sheetErro = ssErro.insertSheet(ABA.LOGS_ERRO);
    sheetErro.appendRow([new Date(), error.message, error.stack, payloadRecebido]);
  } catch (eLog) { console.error("Falha catastrófica:", eLog); }
}

// Cron diário — manda email pro EMAIL_GESTOR se houve erro novo nas últimas
// 24h. Sem isso, erros caem no Logs_Erro silenciosamente e ninguém vê até
// alguém abrir a aba. Configurar trigger time-based diário (qualquer hora,
// idealmente cedo) no editor do Apps Script: Triggers > cronAvisoErrosNovos.
function cronAvisoErrosNovos() {
  Logger.log('===== cronAvisoErrosNovos =====');
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var aba = ss.getSheetByName(ABA.LOGS_ERRO);
    if (!aba || aba.getLastRow() < 2) {
      Logger.log('Sem aba ou aba vazia — nada a notificar.');
      return;
    }
    var corte = new Date();
    corte.setHours(corte.getHours() - 24);

    var matriz = aba.getDataRange().getValues();
    var novos = [];
    for (var i = 1; i < matriz.length; i++) {
      var ts = matriz[i][0];
      if (!(ts instanceof Date)) continue;
      if (ts >= corte) {
        novos.push({
          ts: ts,
          message: txt(matriz[i][1]),
          payload: txt(matriz[i][3]).slice(0, 200)
        });
      }
    }

    if (novos.length === 0) {
      Logger.log('Nenhum erro novo nas últimas 24h.');
      return;
    }

    // Agrupa por mensagem pra reduzir ruído (mesmo erro 50x = 1 linha no email)
    var porMsg = {};
    novos.forEach(function(e) {
      var k = e.message || '(sem mensagem)';
      if (!porMsg[k]) porMsg[k] = { count: 0, ultimo: e.ts, payloadExemplo: e.payload };
      porMsg[k].count++;
      if (e.ts > porMsg[k].ultimo) porMsg[k].ultimo = e.ts;
    });

    var assunto = '⚠️ Intento — ' + novos.length + ' erro(s) novo(s) nas últimas 24h';
    var corpo = 'Resumo dos erros novos em Logs_Erro (agrupados por mensagem):\n\n';
    Object.keys(porMsg).forEach(function(msg) {
      var info = porMsg[msg];
      corpo += '• [' + info.count + 'x] ' + msg + '\n';
      corpo += '  último: ' + Utilities.formatDate(info.ultimo, 'GMT-3', 'dd/MM HH:mm') + '\n';
      if (info.payloadExemplo) corpo += '  payload: ' + info.payloadExemplo + '\n';
      corpo += '\n';
    });
    corpo += '\nVer aba Logs_Erro pra detalhes completos.\n';

    MailApp.sendEmail(EMAIL_GESTOR, assunto, corpo);
    Logger.log('Email enviado: ' + novos.length + ' erro(s).');
  } catch (e) {
    Logger.log('cronAvisoErrosNovos EXCEPTION: ' + e.message);
  }
}

function removerAcentos(str) {
  return str.normalize("NFD").replace(/[̀-ͯ]/g, "");
}


// =====================================================================
// SALA DO MENTOR
// =====================================================================

function handleListaAlunosMentor(dados) {
  const emailMentor = emailNorm(dados.email);
  if (!emailMentor) throw new Error("E-mail do mentor não fornecido.");

  const ssMestre  = SpreadsheetApp.getActiveSpreadsheet();
  const abaMestre = ssMestre.getSheetByName(ABA.MESTRE);
  if (!abaMestre) throw new Error("Aba mestre '" + ABA.MESTRE + "' não encontrada.");

  const matriz = abaMestre.getDataRange().getValues();
  const colMentor = COL_MESTRE.MENTOR_RESPONSAVEL;

  const listaFiltrada = [];
  for (let i = 1; i < matriz.length; i++) {
    if (emailNorm(matriz[i][colMentor]) === emailMentor) {
      listaFiltrada.push({
        id:     matriz[i][COL_MESTRE.ID_PLANILHA],
        nome:   matriz[i][COL_MESTRE.NOME],
        email:  matriz[i][COL_MESTRE.EMAIL],
        status: txt(matriz[i][COL_MESTRE.STATUS_ONBOARDING]) || "Desconhecido",
        tipoAluno: txt(matriz[i][COL_MESTRE.TIPO_ALUNO]) || "ENEM"
      });
    }
  }

  _enriquecerComProximaProva(listaFiltrada);
  return responderJSON({ status: "sucesso", alunos: listaFiltrada });
}

// Anexa { proximaProva: { data, materia, dias } | null } a cada aluno EM da lista.
// Lê BD_Avaliacoes 1x e cruza in-memory.
function _enriquecerComProximaProva(alunos) {
  var idsEM = alunos.filter(function(a) { return a.tipoAluno === 'EM'; })
                    .map(function(a) { return a.id; });
  if (idsEM.length === 0) return;

  var ssMestre = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ssMestre.getSheetByName(ABA.AVALIACOES);
  if (!aba) return;
  var lastRow = aba.getLastRow();
  if (lastRow < 2) return;

  var matriz = aba.getRange(2, 1, lastRow - 1, 9).getValues();
  var hoje = new Date(); hoje.setHours(0, 0, 0, 0);

  var proxima = {}; // idAluno -> { data: Date, materia: string }
  for (var i = 0; i < matriz.length; i++) {
    var idA = txt(matriz[i][COL_AV.ID_ALUNO]);
    if (idsEM.indexOf(idA) === -1) continue;
    var d = matriz[i][COL_AV.DATA] instanceof Date ? matriz[i][COL_AV.DATA] : new Date(matriz[i][COL_AV.DATA]);
    if (isNaN(d.getTime()) || d < hoje) continue;
    if (!proxima[idA] || d < proxima[idA].data) {
      proxima[idA] = { data: d, materia: txt(matriz[i][COL_AV.MATERIA]) };
    }
  }

  alunos.forEach(function(a) {
    var p = proxima[a.id];
    if (p) {
      var dias = Math.ceil((p.data - hoje) / (1000 * 60 * 60 * 24));
      a.proximaProva = { data: p.data.toISOString(), materia: p.materia, dias: dias };
    }
  });
}


// =====================================================================
// DIÁRIO DE BORDO
// =====================================================================

function handleAvaliarEncontroPassado(dados) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const idPlanilha = exigirIdPlanilha(dados);
    _exigirAcessoAluno(dados.email, idPlanilha);
    const abaDiario  = SpreadsheetApp.openById(idPlanilha).getSheetByName(ABA.ENCONTROS);
    if (!abaDiario) throw new Error("Aba '" + ABA.ENCONTROS + "' não encontrada.");
    const linha = parseInt(dados.linha);
    if (!linha || linha < 2) throw new Error("Linha inválida para avaliação.");
    const resultados = Array.isArray(dados.resultados) ? dados.resultados : [];
    abaDiario.getRange(linha, COL_ENC.RESULTADO_1 + 1, 1, 5).setValues([[
      txt(resultados[0]), txt(resultados[1]), txt(resultados[2]), txt(resultados[3]), txt(resultados[4])
    ]]);
    return responderJSON({ status: "sucesso" });
  } catch (e) { return responderJSON({ status: "erro", mensagem: e.message }); }
  finally     { lock.releaseLock(); }
}

function handleEditarEncontro(dados) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const idPlanilha = exigirIdPlanilha(dados);
    _exigirAcessoAluno(dados.email, idPlanilha);
    const abaDiario  = SpreadsheetApp.openById(idPlanilha).getSheetByName(ABA.ENCONTROS);
    if (!abaDiario) throw new Error("Aba '" + ABA.ENCONTROS + "' não encontrada.");
    const linha = parseInt(dados.linha);
    if (!linha || linha < 2) throw new Error("Linha inválida.");
    const acoes      = Array.isArray(dados.acoes) ? dados.acoes : [];
    const resultados = Array.isArray(dados.resultados) ? dados.resultados : [];
    abaDiario.getRange(linha, 1, 1, 18).setValues([[
      txt(dados.data),
      txt(dados.autoavaliacao),
      txt(dados.vitorias),
      txt(dados.desafios),
      txt(dados.categoria),
      txt(dados.meta),
      txt(dados.exploracao),
      txt(acoes[0]), txt(acoes[1]), txt(acoes[2]), txt(acoes[3]), txt(acoes[4]),
      txt(resultados[0]), txt(resultados[1]), txt(resultados[2]), txt(resultados[3]), txt(resultados[4]),
      txt(dados.notasPrivadas)
    ]]);
    return responderJSON({ status: "sucesso" });
  } catch (e) { return responderJSON({ status: "erro", mensagem: e.message }); }
  finally     { lock.releaseLock(); }
}

function handleSalvarNovoEncontro(dados) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const idPlanilha = exigirIdPlanilha(dados);
    _exigirAcessoAluno(dados.email, idPlanilha);
    const abaDiario  = SpreadsheetApp.openById(idPlanilha).getSheetByName(ABA.ENCONTROS);
    if (!abaDiario) throw new Error("Aba '" + ABA.ENCONTROS + "' não encontrada.");
    const dataHoje = Utilities.formatDate(new Date(), "GMT-3", "dd/MM/yyyy");
    const acoes    = Array.isArray(dados.acoes) ? dados.acoes : [];
    abaDiario.appendRow([
      dataHoje, txt(dados.autoavaliacao), txt(dados.vitorias), txt(dados.desafios),
      txt(dados.categoria), txt(dados.meta), txt(dados.exploracao),
      txt(acoes[0]), txt(acoes[1]), txt(acoes[2]), txt(acoes[3]), txt(acoes[4]),
      '', '', '', '', '',  // resultados (preenchidos depois via avaliarEncontroPassado)
      txt(dados.notasPrivadas)
    ]);
    atualizarCacheMestre(idPlanilha, { ULTIMO_ENCONTRO: dataHoje });
    return responderJSON({ status: "sucesso" });
  } catch (e) { return responderJSON({ status: "erro", mensagem: e.message }); }
  finally     { lock.releaseLock(); }
}


// =====================================================================
// SEMANA PADRÃO
// =====================================================================

function handleSalvarSemanaLote(dados) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const idPlanilha     = exigirIdPlanilha(dados, "idPlanilhaAluno");
    _exigirAcessoAluno(dados.email, idPlanilha);
    const rotinaCompleta = Array.isArray(dados.rotina) ? dados.rotina : [];
    const ssAluno        = SpreadsheetApp.openById(idPlanilha);
    const abaDB          = ssAluno.getSheetByName(ABA.SEMANA);
    if (!abaDB) return responderJSON({ status: "erro", mensagem: "Aba '" + ABA.SEMANA + "' não encontrada." });

    const HORARIOS = ["07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00"];
    const DIAS     = ["Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado","Domingo"];
    const matrizParaGravar = [];
    for (let l = 0; l < 16; l++) matrizParaGravar.push(["","","","","","",""]);

    let contadorSucesso = 0;
    rotinaCompleta.forEach(function(item) {
      const linhaIndex   = HORARIOS.map(h => h.trim()).indexOf(txt(item.hora));
      const colunaIndex  = DIAS.map(d => d.toLowerCase().trim()).indexOf(txt(item.dia).toLowerCase());
      if (linhaIndex !== -1 && colunaIndex !== -1) {
        matrizParaGravar[linhaIndex][colunaIndex] = txt(item.atividade);
        contadorSucesso++;
      }
    });

    abaDB.getRange(2, 2, 16, 7).setValues(matrizParaGravar);
    return responderJSON({ status: "sucesso", atualizadas: contadorSucesso });
  } catch (erro) { return responderJSON({ status: "erro", mensagem: erro.message }); }
  finally        { lock.releaseLock(); }
}


// =====================================================================
// REGISTRO SEMANAL
// =====================================================================

/**
 * Atualiza linha do aluno na aba Cache_Alunos. Se o aluno não tem linha
 * ainda, cria uma nova (appendRow). Falha silenciosa — não propaga erro
 * pra operação principal.
 * updates: { CHAVE_COL_CACHE: valor, ... }
 * Ex: atualizarCacheMestre(id, { ULTIMA_DATA_REGISTRO: '15/04/2026', ULTIMA_SEMANA_REGISTRO: '06/04/2026 a 12/04/2026' })
 */
function atualizarCacheMestre(idPlanilha, updates) {
  Logger.log('atualizarCacheMestre INICIO · idPlanilha=' + idPlanilha + ' · keys=' + Object.keys(updates).join(','));
  try {
    const ssMestre = SpreadsheetApp.getActiveSpreadsheet();
    const abaCache = ssMestre.getSheetByName(ABA.CACHE);
    if (!abaCache) { Logger.log('  aba ' + ABA.CACHE + ' não encontrada'); return; }

    const lastRow = abaCache.getLastRow();
    let linhaAluno = -1;
    if (lastRow >= 2) {
      const ids = abaCache.getRange(2, COL_CACHE.ID_PLANILHA + 1, lastRow - 1, 1).getValues();
      for (let i = 0; i < ids.length; i++) {
        if (String(ids[i][0]).trim() === String(idPlanilha).trim()) { linhaAluno = i + 2; break; }
      }
    }

    if (linhaAluno === -1) {
      // Cria nova linha de cache pra esse aluno
      const novaLinha = [String(idPlanilha), '', '', ''];
      Object.keys(updates).forEach(function(chave) {
        const col = COL_CACHE[chave];
        if (typeof col === 'number') novaLinha[col] = updates[chave];
      });
      abaCache.appendRow(novaLinha);
      Logger.log('  novo registro de cache criado para ' + idPlanilha);
      return;
    }

    Object.keys(updates).forEach(function(chave) {
      const col = COL_CACHE[chave];
      if (typeof col !== 'number') { Logger.log('  chave desconhecida ' + chave); return; }
      abaCache.getRange(linhaAluno, col + 1).setValue(updates[chave]);
      Logger.log('  escrito ' + chave + '=' + updates[chave] + ' na col ' + (col + 1));
    });
    Logger.log('atualizarCacheMestre FIM OK');
  } catch (e) {
    Logger.log('atualizarCacheMestre EXCEPTION: ' + e.message);
  }
}

// Lê toda a Cache_Alunos e devolve mapa idPlanilha → { ultimaDataRegistro, ultimaSemanaRegistro, ultimoEncontro }
function lerCacheTodos() {
  const ssMestre = SpreadsheetApp.getActiveSpreadsheet();
  const abaCache = ssMestre.getSheetByName(ABA.CACHE);
  if (!abaCache) return {};
  const lastRow = abaCache.getLastRow();
  if (lastRow < 2) return {};
  const matriz = abaCache.getRange(2, 1, lastRow - 1, 4).getValues();
  const mapa = {};
  for (let i = 0; i < matriz.length; i++) {
    const id = String(matriz[i][COL_CACHE.ID_PLANILHA]).trim();
    if (!id) continue;
    mapa[id] = {
      ultimaDataRegistro:   txt(matriz[i][COL_CACHE.ULTIMA_DATA_REGISTRO]),
      ultimaSemanaRegistro: txt(matriz[i][COL_CACHE.ULTIMA_SEMANA_REGISTRO]),
      ultimoEncontro:       txt(matriz[i][COL_CACHE.ULTIMO_ENCONTRO])
    };
  }
  return mapa;
}

// Lê BD_Registro do aluno e identifica a SEMANA mais recente registrada
// (parsing de "DD/MM/YYYY a DD/MM/YYYY" → maior data início). Atualiza
// o cache em Cache_Alunos com essa semana, garantindo que ULTIMA_SEMANA_REGISTRO
// reflete o estado real mesmo após edições.
function _atualizarCacheUltimoRegistro(idPlanilha, abaRegistro) {
  try {
    var matriz = abaRegistro.getDataRange().getValues();
    var semanaMaisRecente = '';
    var dataInicioMaisRecente = 0;
    for (var i = 1; i < matriz.length; i++) {
      var sem = String(matriz[i][COL_REG.SEMANA] || '').trim();
      if (!sem) continue;
      var ini = sem.split(' a ')[0];
      var p = ini.split('/');
      if (p.length !== 3) continue;
      var t = new Date(+p[2], +p[1] - 1, +p[0]).getTime();
      if (t > dataInicioMaisRecente) {
        dataInicioMaisRecente = t;
        semanaMaisRecente = sem;
      }
    }
    var dataFmt = semanaMaisRecente
      ? Utilities.formatDate(new Date(dataInicioMaisRecente), Session.getScriptTimeZone(), 'dd/MM/yyyy')
      : '';
    atualizarCacheMestre(idPlanilha, {
      ULTIMA_SEMANA_REGISTRO: semanaMaisRecente,
      ULTIMA_DATA_REGISTRO:   dataFmt
    });
  } catch (e) {
    Logger.log('_atualizarCacheUltimoRegistro EXCEPTION: ' + e.message);
  }
}

// === Handler: lê a meta da última semana registrada (pra preencher rápido o modal) ===
function handleBuscarMetaAnterior(dados) {
  try {
    const idPlanilha = txt(dados.idAluno);
    if (!idPlanilha) return responderJSON({ status: "erro", mensagem: "idAluno obrigatório" });
    _exigirAcessoAluno(dados.email, idPlanilha);
    const ssAluno = SpreadsheetApp.openById(idPlanilha);
    const aba = ssAluno.getSheetByName(ABA.REGISTROS);
    if (!aba) return responderJSON({ status: "sucesso", metaSemanal: "" });
    const last = aba.getLastRow();
    if (last < 2) return responderJSON({ status: "sucesso", metaSemanal: "" });
    // Col 4 = meta_semanal (ver handleSalvarRegistroGlobal)
    const valor = aba.getRange(last, 4).getValue();
    return responderJSON({ status: "sucesso", metaSemanal: txt(valor) });
  } catch (e) {
    Logger.log('buscarMetaAnterior EXCEPTION: ' + e.message);
    return responderJSON({ status: "erro", mensagem: e.message });
  }
}

function handleSalvarRegistroGlobal(dados) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const idPlanilha = exigirIdPlanilha(dados, "idAluno");
    _exigirAcessoAluno(dados.email, idPlanilha);
    const ssAluno    = SpreadsheetApp.openById(idPlanilha);
    const abaDB      = ssAluno.getSheetByName(ABA.REGISTROS);
    if (!abaDB) return responderJSON({ status: "erro", mensagem: "Aba '" + ABA.REGISTROS + "' não encontrada." });

    const semanaSalvar = txt(dados.semana);
    if (semanaSalvar) {
      const existing = abaDB.getDataRange().getValues();
      for (let j = 1; j < existing.length; j++) {
        if (txt(existing[j][COL_REG.SEMANA]) === semanaSalvar) {
          return responderJSON({ status: "erro", codigo: "duplicado", mensagem: "Já existe registro para essa semana." });
        }
      }
    }

    const novaLinha = [
      txt(dados.semana),
      txt(dados.mes),
      txt(dados.dataRegistro),
      txt(dados.metaSemanal),          // texto, não número
      num(dados.horasEstudadas),
      num(dados.dominioTotal),
      num(dados.progressoTotal),
      num(dados.revisoesAtrasadas),
      num(dados.estresse),
      num(dados.ansiedade),
      num(dados.motivacao),
      num(dados.sono),
      num(dados.dominioBio),
      num(dados.progressoBio),
      num(dados.dominioQui),
      num(dados.progressoQui),
      num(dados.dominioFis),
      num(dados.progressoFis),
      num(dados.dominioMat),
      num(dados.progressoMat)
    ];

    const colA = abaDB.getRange(1, 1, abaDB.getMaxRows(), 1).getValues();
    let ultimaLinhaComDados = 0;
    for (let i = colA.length - 1; i >= 0; i--) {
      if (String(colA[i][0]).trim() !== "") { ultimaLinhaComDados = i + 1; break; }
    }
    const linhaDestino = ultimaLinhaComDados + 1;
    abaDB.getRange(linhaDestino, 1, 1, novaLinha.length).setValues([novaLinha]);
    _atualizarCacheUltimoRegistro(idPlanilha, abaDB);
    return responderJSON({ status: "sucesso" });
  } catch (erro) { return responderJSON({ status: "erro", mensagem: erro.message }); }
  finally        { lock.releaseLock(); }
}


// =====================================================================
// LER DADOS COMPLETOS DO ALUNO
// =====================================================================

// =====================================================================
// Helper: lê BD_Sim_ENEM e devolve { kpi, hist, lista } (últimos 3)
// =====================================================================
function lerSimulados(ss) {
  const kpi = { realizados: 0, medAcertos: 0, medRedacao: 0, medLG: 0, medCH: 0, medCN: 0, medMAT: 0, erros: { atencao: 0, inter: 0, rec: 0, lac: 0 } };
  const hist = { labels: [], lg: [], ch: [], cn: [], mat: [] };
  const lista = [];

  const shSimulados = ss.getSheetByName(ABA.SIMULADOS);
  if (!shSimulados) return { kpi: kpi, hist: hist, lista: lista };

  const dadosSim  = shSimulados.getDataRange().getValues();
  const concluidos = [];
  for (let i = 1; i < dadosSim.length; i++) {
    const row = dadosSim[i];
    if (!row[COL_SIM.ID]) continue;
    const dataStr = row[COL_SIM.DATA] instanceof Date
      ? Utilities.formatDate(row[COL_SIM.DATA], Session.getScriptTimeZone(), "yyyy-MM-dd")
      : String(row[COL_SIM.DATA]).split(" ")[0];
    let errosObj = { atencao: 0, inter: 0, rec: 0, lac: 0 };
    let errosLista = [];
    try {
      if (row[COL_SIM.ERROS_JSON]) {
        const parsed = JSON.parse(String(row[COL_SIM.ERROS_JSON]));
        if (Array.isArray(parsed)) {
          errosLista = parsed.filter(function(e) { return e && (e.tipo || e.questao || e.disciplina || e.topico); });
          parsed.forEach(function(e) {
            const tipo = txt(e && e.tipo);
            if (tipo === 'Atenção')             errosObj.atencao++;
            else if (tipo === 'Interpretação')  errosObj.inter++;
            else if (tipo === 'Recordação')     errosObj.rec++;
            else if (tipo === 'Lacuna')         errosObj.lac++;
          });
        } else if (parsed && typeof parsed === 'object') {
          errosObj = {
            atencao: parsed.atencao || 0,
            inter:   parsed.inter   || 0,
            rec:     parsed.rec     || 0,
            lac:     parsed.lac     || 0,
          };
        }
      }
    } catch (e) {}
    const sim = {
      id: String(row[COL_SIM.ID]), status: txt(row[COL_SIM.STATUS]) || "Pendente",
      data: dataStr, modelo: "ENEM", especificacao: txt(row[COL_SIM.ESPECIFICACAO]),
      lg: num(row[COL_SIM.LG]), ch: num(row[COL_SIM.CH]), cn: num(row[COL_SIM.CN]),
      mat: num(row[COL_SIM.MAT]), redacao: num(row[COL_SIM.REDACAO]),
      erros: errosObj, errosLista: errosLista,
      kolb: {
        exp: txt(row[COL_SIM.KOLB_EXP]), ref: txt(row[COL_SIM.KOLB_REF]),
        con: txt(row[COL_SIM.KOLB_CON]), acao: txt(row[COL_SIM.KOLB_ACAO]),
        redacao: txt(row[COL_SIM.KOLB_REDACAO])
      }
    };
    lista.push(sim);
    if (sim.status === "Concluída") concluidos.push(sim);
  }

  concluidos.forEach(function(s) {
    hist.labels.push(s.data); hist.lg.push(s.lg); hist.ch.push(s.ch);
    hist.cn.push(s.cn); hist.mat.push(s.mat);
  });
  kpi.realizados = concluidos.length;
  if (concluidos.length > 0) {
    const ultimas3 = concluidos.slice(-3);
    const nn = ultimas3.length;
    let somaLG = 0, somaCH = 0, somaCN = 0, somaMAT = 0, somaTotal = 0;
    let somaAt = 0, somaIn = 0, somaRec = 0, somaLac = 0;
    ultimas3.forEach(function(s) {
      somaLG += s.lg; somaCH += s.ch; somaCN += s.cn; somaMAT += s.mat;
      somaTotal += (s.lg + s.ch + s.cn + s.mat);
      somaAt += (s.erros.atencao || 0); somaIn += (s.erros.inter || 0);
      somaRec += (s.erros.rec || 0); somaLac += (s.erros.lac || 0);
    });
    kpi.medLG  = Math.round(somaLG / nn);  kpi.medCH  = Math.round(somaCH / nn);
    kpi.medCN  = Math.round(somaCN / nn);  kpi.medMAT = Math.round(somaMAT / nn);
    kpi.medAcertos = Math.round(somaTotal / nn);
    kpi.erros = { atencao: Math.round(somaAt / nn), inter: Math.round(somaIn / nn), rec: Math.round(somaRec / nn), lac: Math.round(somaLac / nn) };
    const ultimasComRedacao = concluidos.filter(function(s) { return s.redacao > 0; }).slice(-3);
    if (ultimasComRedacao.length > 0) {
      kpi.medRedacao = Math.round(ultimasComRedacao.reduce(function(acc, s) { return acc + s.redacao; }, 0) / ultimasComRedacao.length);
    }
  }
  return { kpi: kpi, hist: hist, lista: lista };
}


function handleBuscarDadosAluno(dados) {
  try {
    const idPlanilha    = exigirIdPlanilha(dados, "idPlanilhaAluno");
    _exigirAcessoAluno(dados.email, idPlanilha);
    const ssAluno       = SpreadsheetApp.openById(idPlanilha);
    const pacoteDeDados = { status: "sucesso", semana: [], registros: [], diarios: [], tipoAluno: 'ENEM' };

    // Lê tipo_aluno do mestre pra UI condicional (Provas só pra EM)
    try {
      const ssMestre = SpreadsheetApp.getActiveSpreadsheet();
      const abaMestre = ssMestre.getSheetByName(ABA.MESTRE);
      if (abaMestre) {
        const matrizMestre = abaMestre.getDataRange().getValues();
        for (let i = 1; i < matrizMestre.length; i++) {
          if (txt(matrizMestre[i][COL_MESTRE.ID_PLANILHA]) === idPlanilha) {
            pacoteDeDados.tipoAluno = txt(matrizMestre[i][COL_MESTRE.TIPO_ALUNO]) || 'ENEM';
            pacoteDeDados.escola    = txt(matrizMestre[i][COL_MESTRE.ESCOLA]);
            break;
          }
        }
      }
    } catch (eMestre) { Logger.log('handleBuscarDadosAluno: leitura do mestre falhou (não-bloqueante): ' + eMestre.message); }

    const abaSemana = ssAluno.getSheetByName(ABA.SEMANA);
    if (abaSemana) pacoteDeDados.semana = abaSemana.getRange(2, 2, 16, 7).getValues();

    const abaRegistro = ssAluno.getSheetByName(ABA.REGISTROS);
    if (abaRegistro) {
      const todosRegistros = abaRegistro.getDataRange().getDisplayValues();
      if (todosRegistros.length > 1) pacoteDeDados.registros = todosRegistros.slice(1);
    }

    const abaDiario  = ssAluno.getSheetByName(ABA.ENCONTROS);
    const encontros  = [];
    if (abaDiario) {
      const matriz = abaDiario.getDataRange().getValues();
      for (let i = 1; i < matriz.length; i++) {
        if (matriz[i][COL_ENC.DATA]) {
          encontros.push({
            linha: i + 1, data: matriz[i][COL_ENC.DATA],
            autoavaliacao: matriz[i][COL_ENC.AUTOAVALIACAO], vitorias: matriz[i][COL_ENC.VITORIAS],
            desafios: matriz[i][COL_ENC.DESAFIOS], categoria: matriz[i][COL_ENC.CATEGORIA],
            meta: matriz[i][COL_ENC.META], exploracao: matriz[i][COL_ENC.EXPLORACAO],
            acoes: [matriz[i][COL_ENC.ACAO_1], matriz[i][COL_ENC.ACAO_2], matriz[i][COL_ENC.ACAO_3], matriz[i][COL_ENC.ACAO_4], matriz[i][COL_ENC.ACAO_5]],
            resultados: [matriz[i][COL_ENC.RESULTADO_1], matriz[i][COL_ENC.RESULTADO_2], matriz[i][COL_ENC.RESULTADO_3], matriz[i][COL_ENC.RESULTADO_4], matriz[i][COL_ENC.RESULTADO_5]],
            notasPrivadas: txt(matriz[i][COL_ENC.NOTAS_PRIVADAS])
          });
        }
      }
    }
    pacoteDeDados.diarios = encontros.reverse();
    pacoteDeDados.simulados = lerSimulados(ssAluno);
    return responderJSON(pacoteDeDados);
  } catch (erro) { return responderJSON({ status: "erro", mensagem: erro.message }); }
}


// =====================================================================
// LOGIN GLOBAL (SSO)
// =====================================================================

function handleLoginGlobal(dados) {
  try {
    const emailStr = emailNorm(dados.email);
    if (!emailStr) return responderJSON({ status: "erro", mensagem: "E-mail não fornecido." });

    // Detecta papéis
    var ehLider    = (emailStr === "filippe@metodointento.com.br" || emailStr === "rafael@metodointento.com.br");
    var ehVendedor = !!lerVendedoresAtivos()[emailStr];
    var ehMentor   = !!lerMentoresAtivos()[emailStr] || (emailStr.endsWith("@metodointento.com.br") && !ehVendedor && !ehLider);
    // Nota: se está no domínio mas não em BD_Mentores nem BD_Vendedores, considera mentor (legado)

    // Líderes sempre vão pra selecionar-modo (mantém comportamento atual)
    if (ehLider)
      return responderJSON({ status: "sucesso", perfil: "lider", rota: "/selecionar-modo", papeis: { lider: true, vendedor: ehVendedor, mentor: ehMentor } });

    // Híbrido: vendedor + mentor → escolhe entre /vendas e /mentor
    if (ehVendedor && ehMentor)
      return responderJSON({ status: "sucesso", perfil: "hibrido", rota: "/selecionar-modo", papeis: { lider: false, vendedor: true, mentor: true } });

    // Só vendedor
    if (ehVendedor)
      return responderJSON({ status: "sucesso", perfil: "vendedor", rota: "/vendas", papeis: { lider: false, vendedor: true, mentor: false } });

    // Só mentor (resto do domínio)
    if (emailStr.endsWith("@metodointento.com.br"))
      return responderJSON({ status: "sucesso", perfil: "mentor", rota: "/mentor", papeis: { lider: false, vendedor: false, mentor: true } });

    const ss        = SpreadsheetApp.getActiveSpreadsheet();
    const abaAlunos = ss.getSheetByName(ABA.MESTRE);
    if (!abaAlunos) throw new Error("Aba '" + ABA.MESTRE + "' não encontrada.");
    const ultimaLinha = abaAlunos.getLastRow();
    if (ultimaLinha < 2) return responderJSON({ status: "sucesso", perfil: "aluno", rota: "/hub", novo: true });

    const matriz = abaAlunos.getRange(1, 1, ultimaLinha, 23).getValues();
    for (let i = matriz.length - 1; i >= 1; i--) {
      if (emailNorm(matriz[i][COL_MESTRE.EMAIL]) === emailStr) {
        const statusBH    = txt(matriz[i][COL_MESTRE.STATUS_ONBOARDING]);
        const idPlanilha  = matriz[i][COL_MESTRE.ID_PLANILHA] || "";
        const rotaDestino = statusBH === "Onboarding Completo" ? "/painel" : "/hub";
        return responderJSON({ status: "sucesso", perfil: "aluno", rota: rotaDestino, nome: matriz[i][COL_MESTRE.NOME] || "Estudante", idPlanilha: idPlanilha });
      }
    }
    return responderJSON({ status: "sucesso", perfil: "aluno", rota: "/hub", nome: "Novo Aluno" });
  } catch (erro) { return responderJSON({ status: "erro", mensagem: "Erro no Porteiro: " + erro.message }); }
}


// =====================================================================
// SIMULADOS
// =====================================================================

function handleSalvarSimulado(dados) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const idPlanilha = exigirIdPlanilha(dados);
    _exigirAcessoAluno(dados.email, idPlanilha);
    const ssAluno    = SpreadsheetApp.openById(idPlanilha);
    const aba        = ssAluno.getSheetByName(ABA.SIMULADOS);
    if (!aba) throw new Error("Aba '" + ABA.SIMULADOS + "' não encontrada.");
    const idSimulado = "sim_" + new Date().getTime();
    let dataFormatada = txt(dados.data);
    if (dataFormatada && dataFormatada.indexOf("-") !== -1) {
      const partes = dataFormatada.split("-");
      dataFormatada = partes[2] + "/" + partes[1] + "/" + partes[0];
    }
    aba.appendRow([idSimulado, "Pendente", dataFormatada, txt(dados.especificacao),
      num(dados.lg), num(dados.ch), num(dados.cn), num(dados.mat), num(dados.redacao),
      "", "", "", "", "", ""]);
    return responderJSON({ status: "sucesso", id: idSimulado });
  } catch (e) { return responderJSON({ status: "erro", mensagem: e.message }); }
  finally     { lock.releaseLock(); }
}

function handleSalvarAutopsia(dados) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const idPlanilha  = exigirIdPlanilha(dados);
    _exigirAcessoAluno(dados.email, idPlanilha);
    const ssAluno     = SpreadsheetApp.openById(idPlanilha);
    const aba         = ssAluno.getSheetByName(ABA.SIMULADOS);
    if (!aba) throw new Error("Aba '" + ABA.SIMULADOS + "' não encontrada.");
    const idProcurado = txt(dados.idSimulado);
    if (!idProcurado) throw new Error("idSimulado ausente.");
    const matriz      = aba.getDataRange().getValues();
    let linhaAlvo     = -1;
    for (let i = 1; i < matriz.length; i++) {
      if (String(matriz[i][COL_SIM.ID]) === idProcurado) { linhaAlvo = i + 1; break; }
    }
    if (linhaAlvo === -1) throw new Error("Simulado não encontrado.");
    const statusFinal      = txt(dados.statusAnalise) || "Concluída";
    const errosCompactados = JSON.stringify(dados.erros || []);
    const kolb             = dados.kolb || {};
    aba.getRange(linhaAlvo, COL_SIM.STATUS       + 1).setValue(statusFinal);
    aba.getRange(linhaAlvo, COL_SIM.ERROS_JSON   + 1).setValue(errosCompactados);
    aba.getRange(linhaAlvo, COL_SIM.KOLB_EXP     + 1).setValue(txt(kolb.exp));
    aba.getRange(linhaAlvo, COL_SIM.KOLB_REF     + 1).setValue(txt(kolb.ref));
    aba.getRange(linhaAlvo, COL_SIM.KOLB_CON     + 1).setValue(txt(kolb.con));
    aba.getRange(linhaAlvo, COL_SIM.KOLB_ACAO    + 1).setValue(txt(kolb.acao));
    aba.getRange(linhaAlvo, COL_SIM.KOLB_REDACAO + 1).setValue(txt(kolb.redacao));
    return responderJSON({ status: "sucesso" });
  } catch (e) { return responderJSON({ status: "erro", mensagem: e.message }); }
  finally     { lock.releaseLock(); }
}


// =====================================================================
// TÓPICOS GLOBAIS
// =====================================================================

function handleBuscarTopicosGlobais() {
  try {
    const ssMestre   = SpreadsheetApp.getActiveSpreadsheet();
    const abaTopicos = ssMestre.getSheetByName(ABA.TOPICOS);
    if (!abaTopicos) throw new Error("Aba '" + ABA.TOPICOS + "' não encontrada.");
    const matriz             = abaTopicos.getDataRange().getValues();
    const cabecalhos         = matriz[0];
    const dicionarioTopicos  = {};
    for (let c = 0; c < cabecalhos.length; c++) {
      const disciplina = txt(cabecalhos[c]);
      if (!disciplina) continue;
      dicionarioTopicos[disciplina] = [];
      for (let r = 1; r < matriz.length; r++) {
        const topico = txt(matriz[r][c]);
        if (topico !== "") dicionarioTopicos[disciplina].push(topico);
      }
    }
    return responderJSON({ status: "sucesso", topicos: dicionarioTopicos });
  } catch (e) { return responderJSON({ status: "erro", mensagem: e.message }); }
}


// =====================================================================
// CADERNO DE ERROS
// =====================================================================

// Adiciona colunas fonte/classificacao em BD_Caderno se não existirem.
// Idempotente; chamada dentro dos handlers pra cobrir planilhas antigas
// criadas com layout de 9 colunas.
function _garantirColunasCaderno_(aba) {
  var lastCol = aba.getLastColumn();
  if (lastCol >= 11) return;
  var alvo = ['fonte', 'classificacao'];
  for (var k = lastCol; k < 9 + alvo.length; k++) {
    if (k < 9) continue;
    aba.getRange(1, k + 1).setValue(alvo[k - 9]);
  }
}

function handleListarCaderno(dados) {
  try {
    const idPlanilha = exigirIdPlanilha(dados);
    _exigirAcessoAluno(dados.email, idPlanilha);
    const aba        = SpreadsheetApp.openById(idPlanilha).getSheetByName(ABA.CADERNO);
    if (!aba) return responderJSON({ status: "sucesso", cards: [] });
    _garantirColunasCaderno_(aba);
    const hoje  = Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd");
    const linhas = aba.getDataRange().getValues();
    const cards  = linhas.slice(1).map(function(r) {
      return {
        id: r[COL_CAD.ID], disciplina: r[COL_CAD.DISCIPLINA], topico: r[COL_CAD.TOPICO],
        data_erro: r[COL_CAD.DATA_ERRO], pergunta: r[COL_CAD.PERGUNTA], resposta: r[COL_CAD.RESPOSTA],
        estagio: parseInt(r[COL_CAD.ESTAGIO]) || 0,
        proxima_revisao: r[COL_CAD.PROXIMA_REVISAO]
          ? Utilities.formatDate(new Date(r[COL_CAD.PROXIMA_REVISAO]), "GMT-3", "yyyy-MM-dd")
          : hoje,
        historico: r[COL_CAD.HISTORICO] || "[]",
        fonte: r[COL_CAD.FONTE] || "",
        classificacao: r[COL_CAD.CLASSIFICACAO] || ""
      };
    }).filter(function(c) { return c.id; });
    return responderJSON({ status: "sucesso", cards: cards });
  } catch (e) { return responderJSON({ status: "erro", mensagem: e.message }); }
}

function handleSalvarCardCaderno(dados) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const idPlanilha = exigirIdPlanilha(dados);
    _exigirAcessoAluno(dados.email, idPlanilha);
    const ss         = SpreadsheetApp.openById(idPlanilha);
    let aba          = ss.getSheetByName(ABA.CADERNO);
    if (!aba) {
      aba = ss.insertSheet(ABA.CADERNO);
      aba.appendRow(["id","disciplina","topico","data_erro","pergunta","resposta","estagio","proxima_revisao","historico","fonte","classificacao"]);
    }
    _garantirColunasCaderno_(aba);
    const classificacao = txt(dados.classificacao);
    if (classificacao && CLASSIFICACOES_CADERNO.indexOf(classificacao) === -1) {
      return responderJSON({ status: "erro", mensagem: "classificação inválida" });
    }
    const hoje = Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd");
    aba.appendRow([txt(dados.id), txt(dados.disciplina), txt(dados.topico),
      txt(dados.data), txt(dados.pergunta), txt(dados.resposta),
      0, calcularProximaRevisao(hoje, 0), "[]",
      txt(dados.fonte), classificacao]);
    return responderJSON({ status: "sucesso" });
  } catch (e) { return responderJSON({ status: "erro", mensagem: e.message }); }
  finally     { lock.releaseLock(); }
}

function handleIncrementarRepeticao(dados) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const idPlanilha  = exigirIdPlanilha(dados);
    _exigirAcessoAluno(dados.email, idPlanilha);
    const aba         = SpreadsheetApp.openById(idPlanilha).getSheetByName(ABA.CADERNO);
    if (!aba) return responderJSON({ status: "erro", mensagem: "'" + ABA.CADERNO + "' não encontrada." });
    const linhas      = aba.getDataRange().getValues();
    const idProcurado = txt(dados.id);
    for (let i = 1; i < linhas.length; i++) {
      if (String(linhas[i][COL_CAD.ID]) === idProcurado) {
        aba.getRange(i + 1, COL_CAD.ESTAGIO + 1).setValue((parseInt(linhas[i][COL_CAD.ESTAGIO]) || 0) + 1);
        break;
      }
    }
    return responderJSON({ status: "sucesso" });
  } catch (e) { return responderJSON({ status: "erro", mensagem: e.message }); }
  finally     { lock.releaseLock(); }
}

function handleDeletarCardCaderno(dados) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const idPlanilha  = exigirIdPlanilha(dados);
    _exigirAcessoAluno(dados.email, idPlanilha);
    const aba         = SpreadsheetApp.openById(idPlanilha).getSheetByName(ABA.CADERNO);
    if (!aba) return responderJSON({ status: "erro", mensagem: "'" + ABA.CADERNO + "' não encontrada." });
    const linhas      = aba.getDataRange().getValues();
    const idProcurado = txt(dados.id);
    for (let i = 1; i < linhas.length; i++) {
      if (String(linhas[i][COL_CAD.ID]) === idProcurado) { aba.deleteRow(i + 1); break; }
    }
    return responderJSON({ status: "sucesso" });
  } catch (e) { return responderJSON({ status: "erro", mensagem: e.message }); }
  finally     { lock.releaseLock(); }
}

function handleRegistrarRevisaoCaderno(dados) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const idPlanilha  = exigirIdPlanilha(dados);
    _exigirAcessoAluno(dados.email, idPlanilha);
    const aba         = SpreadsheetApp.openById(idPlanilha).getSheetByName(ABA.CADERNO);
    if (!aba) return responderJSON({ status: "erro", mensagem: "'" + ABA.CADERNO + "' não encontrada." });
    const linhas      = aba.getDataRange().getValues();
    const idProcurado = txt(dados.id);
    for (let i = 1; i < linhas.length; i++) {
      if (String(linhas[i][COL_CAD.ID]) === idProcurado) {
        const estagioAtual = parseInt(linhas[i][COL_CAD.ESTAGIO]) || 0;
        let historico = [];
        try { historico = JSON.parse(String(linhas[i][COL_CAD.HISTORICO] || "[]")); } catch (e) {}
        const hoje           = Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd");
        historico.push({ data: hoje, acertou: !!dados.acertou });
        const novoEstagio    = dados.acertou ? Math.min(estagioAtual + 1, 5) : 0;
        const proximaRevisao = calcularProximaRevisao(hoje, novoEstagio);
        aba.getRange(i + 1, COL_CAD.ESTAGIO        + 1).setValue(novoEstagio);
        aba.getRange(i + 1, COL_CAD.PROXIMA_REVISAO + 1).setValue(proximaRevisao);
        aba.getRange(i + 1, COL_CAD.HISTORICO       + 1).setValue(JSON.stringify(historico));
        return responderJSON({ status: "sucesso", novoEstagio: novoEstagio, proximaRevisao: proximaRevisao });
      }
    }
    return responderJSON({ status: "erro", mensagem: "Card não encontrado." });
  } catch (e) { return responderJSON({ status: "erro", mensagem: e.message }); }
  finally     { lock.releaseLock(); }
}

function calcularProximaRevisao(dataBaseStr, estagio) {
  const intervalos = [3, 7, 14, 30, 60, 90];
  const dias = intervalos[Math.min(estagio, 5)];
  const data = new Date(dataBaseStr + "T12:00:00");
  data.setDate(data.getDate() + dias);
  return Utilities.formatDate(data, "GMT-3", "yyyy-MM-dd");
}


// =====================================================================
// BUSCAR ONBOARDING
// =====================================================================

function handleBuscarOnboarding(dados) {
  try {
    const idPlanilha = exigirIdPlanilha(dados, "idPlanilhaAluno");
    _exigirAcessoAluno(dados.email, idPlanilha);
    const ssAluno    = SpreadsheetApp.openById(idPlanilha);

    // Onboarding (formulário inicial)
    let onboarding = null;
    const abaOn = ssAluno.getSheetByName(ABA.ONBOARDING);
    if (abaOn) {
      const linhas = abaOn.getDataRange().getValues();
      if (linhas.length >= 2) {
        const cabecalho = linhas[0];
        const linha     = linhas[1];
        const obj       = {};
        for (let i = 0; i < cabecalho.length; i++)
          if (cabecalho[i]) obj[txt(cabecalho[i])] = linha[i] || "";
        onboarding = obj;
      }
    }

    // Diagnóstico — pega a última linha (mais recente) de BD_Diagnostico
    let diagnostico = null;
    const abaDiag = ssAluno.getSheetByName(ABA.DIAGNOSTICO);
    if (abaDiag) {
      const matriz = abaDiag.getDataRange().getValues();
      if (matriz.length >= 2) {
        const ultima = matriz[matriz.length - 1];
        const dataRaw = ultima[0];
        const dataFmt = dataRaw instanceof Date
          ? Utilities.formatDate(dataRaw, Session.getScriptTimeZone(), "dd/MM/yyyy")
          : String(dataRaw || "");
        diagnostico = {
          data:       dataFmt,
          biologia:   num(ultima[1]),
          quimica:    num(ultima[2]),
          fisica:     num(ultima[3]),
          matematica: num(ultima[4]),
        };
      }
    }

    return responderJSON({ status: "sucesso", onboarding: onboarding, diagnostico: diagnostico });
  } catch (e) { return responderJSON({ status: "erro", mensagem: e.message }); }
}


// =====================================================================
// EDITAR REGISTRO
// =====================================================================

function handleEditarRegistro(dados) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const idPlanilha = exigirIdPlanilha(dados);
    _exigirAcessoAluno(dados.email, idPlanilha);
    const aba        = SpreadsheetApp.openById(idPlanilha).getSheetByName(ABA.REGISTROS);
    if (!aba) return responderJSON({ status: "erro", mensagem: "'" + ABA.REGISTROS + "' não encontrada." });
    const matrix      = aba.getDataRange().getValues();
    const semanaAlvo  = txt(dados.semana);
    const dataAlvo    = normalizarData(dados.dataRegistro);
    for (let i = 1; i < matrix.length; i++) {
      if (txt(matrix[i][COL_REG.SEMANA]) === semanaAlvo && normalizarData(matrix[i][COL_REG.DATA]) === dataAlvo) {
        const novaLinha = [
          txt(dados.semana), txt(dados.mes), txt(dados.dataRegistro),
          txt(dados.metaSemanal),          // texto
          num(dados.horasEstudadas), num(dados.dominioTotal), num(dados.progressoTotal),
          num(dados.revisoesAtrasadas), num(dados.estresse), num(dados.ansiedade),
          num(dados.motivacao), num(dados.sono),
          num(dados.dominioBio), num(dados.progressoBio), num(dados.dominioQui),
          num(dados.progressoQui), num(dados.dominioFis), num(dados.progressoFis),
          num(dados.dominioMat), num(dados.progressoMat)
        ];
        aba.getRange(i + 1, 1, 1, novaLinha.length).setValues([novaLinha]);
        _atualizarCacheUltimoRegistro(idPlanilha, aba);
        return responderJSON({ status: "sucesso" });
      }
    }
    return responderJSON({ status: "erro", mensagem: "Registro não encontrado." });
  } catch (e) { return responderJSON({ status: "erro", mensagem: e.message }); }
  finally     { lock.releaseLock(); }
}


// =====================================================================
// VERIFICAR / DELETAR REGISTRO
// =====================================================================

function handleVerificarRegistroSemana(dados) {
  try {
    const idPlanilha = txt(dados.idAluno);
    const semana     = txt(dados.semana);
    if (!idPlanilha || !semana) return responderJSON({ status: "erro", mensagem: "idAluno e semana obrigatórios" });
    _exigirAcessoAluno(dados.email, idPlanilha);
    const aba = SpreadsheetApp.openById(idPlanilha).getSheetByName(ABA.REGISTROS);
    if (!aba) return responderJSON({ status: "sucesso", existe: false });
    const matrix = aba.getDataRange().getValues();
    for (let i = 1; i < matrix.length; i++) {
      if (txt(matrix[i][COL_REG.SEMANA]) === semana) {
        return responderJSON({
          status: "sucesso",
          existe: true,
          dataRegistro: txt(matrix[i][COL_REG.DATA])
        });
      }
    }
    return responderJSON({ status: "sucesso", existe: false });
  } catch (e) {
    return responderJSON({ status: "erro", mensagem: e.message });
  }
}

function handleDeletarRegistro(dados) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const idPlanilha = exigirIdPlanilha(dados, "idAluno");
    _exigirAcessoAluno(dados.email, idPlanilha);
    const aba = SpreadsheetApp.openById(idPlanilha).getSheetByName(ABA.REGISTROS);
    if (!aba) return responderJSON({ status: "erro", mensagem: "'" + ABA.REGISTROS + "' não encontrada." });
    const semana = txt(dados.semana);
    if (!semana) return responderJSON({ status: "erro", mensagem: "semana obrigatória" });
    const matrix = aba.getDataRange().getValues();
    for (let i = matrix.length - 1; i >= 1; i--) {
      if (txt(matrix[i][COL_REG.SEMANA]) === semana) {
        aba.deleteRow(i + 1);
        _atualizarCacheUltimoRegistro(idPlanilha, aba);
        return responderJSON({ status: "sucesso" });
      }
    }
    return responderJSON({ status: "erro", mensagem: "Registro não encontrado." });
  } catch (e) { return responderJSON({ status: "erro", mensagem: e.message }); }
  finally     { lock.releaseLock(); }
}


// =====================================================================
// PAINEL DO LÍDER
// =====================================================================

// Lê BD_Mentores e devolve mapa email → { email, nome, dtEntrada } só dos ativos.
// Tolera ausência da aba (devolve {}) durante migração.
function lerMentoresAtivos() {
  var ssMestre = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ssMestre.getSheetByName(ABA.MENTORES);
  if (!aba) return {};
  var matriz = aba.getDataRange().getValues();
  var map = {};
  for (var i = 1; i < matriz.length; i++) {
    var row = matriz[i];
    var email = emailNorm(row[COL_MENTOR.EMAIL]);
    if (!email || txt(row[COL_MENTOR.STATUS]) !== 'Ativo') continue;
    map[email] = {
      email: email,
      nome:  txt(row[COL_MENTOR.NOME]),
      dtEntrada: row[COL_MENTOR.DT_ENTRADA]
    };
  }
  return map;
}

// Semana anterior (dom→sab passados) no formato "DD/MM/YYYY a DD/MM/YYYY"
// (mesmo formato que getSemanaKey do frontend e ULTIMA_SEMANA_REGISTRO)
function computarSemanaAnterior_() {
  var hoje = new Date();
  var domingo = new Date(hoje);
  domingo.setDate(hoje.getDate() - hoje.getDay() - 7);
  var sabado = new Date(domingo);
  sabado.setDate(domingo.getDate() + 6);
  var tz = "GMT-3";
  return Utilities.formatDate(domingo, tz, "dd/MM/yyyy") + ' a ' +
         Utilities.formatDate(sabado,  tz, "dd/MM/yyyy");
}

// Agregado da base — lê BD_Registro e BD_Sim_ENEM de cada aluno.
// Parte cara. Se >45s no log, otimizar.
function agregarMetricasBase_(alunos) {
  var distribuicao = [
    { faixa: '0-5h',   min: 0,  max: 5,   count: 0 },
    { faixa: '5-10h',  min: 5,  max: 10,  count: 0 },
    { faixa: '10-15h', min: 10, max: 15,  count: 0 },
    { faixa: '15-20h', min: 15, max: 20,  count: 0 },
    { faixa: '20h+',   min: 20, max: 999, count: 0 }
  ];
  var historicoPorSemana = {};
  var somas = { domBio:0, cDomBio:0, domQui:0, cDomQui:0, domFis:0, cDomFis:0, domMat:0, cDomMat:0,
                progBio:0, cProgBio:0, progQui:0, cProgQui:0, progFis:0, cProgFis:0, progMat:0, cProgMat:0 };
  var bem = { est:0, cEst:0, ans:0, cAns:0, mot:0, cMot:0, son:0, cSon:0 };
  var totalSim4W = 0;
  var quatroSemanasAtras = new Date(new Date().getTime() - 28 * 24 * 60 * 60 * 1000);

  // Domínio e progresso são gravados em formato misto (decimal 0–1 ou
  // percentual 0–100). Normaliza pra percentual antes de agregar.
  function normPct(valor) {
    var n = parseFloat(valor);
    if (isNaN(n) || n <= 0) return null;
    return n <= 1 ? n * 100 : n;
  }

  // Acumula em dois alvos ao mesmo tempo (global e por-aluno) pra que o front
  // possa recalcular agregado filtrado sem round-trip ao backend.
  function accDual(valor, campoSoma, campoCount, alvoGlobal, alvoAluno) {
    var n = parseFloat(valor);
    if (!isNaN(n) && n > 0) {
      alvoGlobal[campoSoma] += n; alvoGlobal[campoCount]++;
      alvoAluno[campoSoma]  += n; alvoAluno[campoCount]++;
    }
  }

  for (var a = 0; a < alunos.length; a++) {
    var alunoBem      = { est:0, cEst:0, ans:0, cAns:0, mot:0, cMot:0, son:0, cSon:0 };
    var alunoMaterias = { domBio:0, cDomBio:0, domQui:0, cDomQui:0, domFis:0, cDomFis:0, domMat:0, cDomMat:0,
                          progBio:0, cProgBio:0, progQui:0, cProgQui:0, progFis:0, cProgFis:0, progMat:0, cProgMat:0 };
    var alunoHist     = {}; // { 'sem-label': { horas, meta, count } }
    var alunoFaixa    = -1;
    var alunoSim4W    = 0;

    try {
      var ss = SpreadsheetApp.openById(alunos[a].idAluno);
      var abaReg = ss.getSheetByName(ABA.REGISTROS);
      if (abaReg) {
        var m = abaReg.getDataRange().getValues();
        var filtrados = []; for (var k = 1; k < m.length; k++) if (m[k][COL_REG.SEMANA]) filtrados.push(m[k]);
        var ultimos = filtrados.slice(-12);
        var ultimo  = ultimos[ultimos.length - 1];
        var ultimas4 = filtrados.slice(-4);

        if (ultimo) {
          var horas = parseFloat(ultimo[COL_REG.HORAS]) || 0;
          for (var f = 0; f < distribuicao.length; f++) {
            if (horas >= distribuicao[f].min && horas < distribuicao[f].max) {
              distribuicao[f].count++;
              alunoFaixa = f;
              break;
            }
          }
          accDual(ultimo[COL_REG.ESTRESSE],  'est', 'cEst', bem, alunoBem);
          accDual(ultimo[COL_REG.ANSIEDADE], 'ans', 'cAns', bem, alunoBem);
          accDual(ultimo[COL_REG.MOTIVACAO], 'mot', 'cMot', bem, alunoBem);
          accDual(ultimo[COL_REG.SONO],      'son', 'cSon', bem, alunoBem);
        }

        for (var u = 0; u < ultimos.length; u++) {
          var lbl = String(ultimos[u][COL_REG.SEMANA]);
          var horasReg = parseFloat(ultimos[u][COL_REG.HORAS]) || 0;
          var metaReg  = parseFloat(ultimos[u][COL_REG.META])  || 0;
          if (!historicoPorSemana[lbl]) historicoPorSemana[lbl] = { horas: 0, meta: 0, count: 0 };
          historicoPorSemana[lbl].horas += horasReg;
          historicoPorSemana[lbl].meta  += metaReg;
          historicoPorSemana[lbl].count++;
          if (!alunoHist[lbl]) alunoHist[lbl] = { horas: 0, meta: 0, count: 0 };
          alunoHist[lbl].horas += horasReg;
          alunoHist[lbl].meta  += metaReg;
          alunoHist[lbl].count++;
        }

        for (var w = 0; w < ultimas4.length; w++) {
          var r = ultimas4[w];
          accDual(normPct(r[COL_REG.DOM_BIO]),  'domBio',  'cDomBio',  somas, alunoMaterias);
          accDual(normPct(r[COL_REG.DOM_QUI]),  'domQui',  'cDomQui',  somas, alunoMaterias);
          accDual(normPct(r[COL_REG.DOM_FIS]),  'domFis',  'cDomFis',  somas, alunoMaterias);
          accDual(normPct(r[COL_REG.DOM_MAT]),  'domMat',  'cDomMat',  somas, alunoMaterias);
          accDual(normPct(r[COL_REG.PROG_BIO]), 'progBio', 'cProgBio', somas, alunoMaterias);
          accDual(normPct(r[COL_REG.PROG_QUI]), 'progQui', 'cProgQui', somas, alunoMaterias);
          accDual(normPct(r[COL_REG.PROG_FIS]), 'progFis', 'cProgFis', somas, alunoMaterias);
          accDual(normPct(r[COL_REG.PROG_MAT]), 'progMat', 'cProgMat', somas, alunoMaterias);
        }
      }

      var abaSim = ss.getSheetByName(ABA.SIMULADOS);
      if (abaSim) {
        var ms = abaSim.getDataRange().getValues();
        for (var si = 1; si < ms.length; si++) {
          var rs = ms[si];
          if (!rs[COL_SIM.ID] || txt(rs[COL_SIM.STATUS]) !== 'Concluída') continue;
          var raw = rs[COL_SIM.DATA]; var d;
          if (raw instanceof Date) d = raw;
          else {
            var s = String(raw).split(' ')[0];
            if (s.indexOf('/') > 0) { var p = s.split('/'); d = new Date(+p[2], +p[1]-1, +p[0]); }
            else d = new Date(s);
          }
          if (d && !isNaN(d.getTime()) && d >= quatroSemanasAtras) { totalSim4W++; alunoSim4W++; }
        }
      }

      // Encontros do mês corrente (BD_Diario)
      var abaDiario = ss.getSheetByName(ABA.ENCONTROS);
      if (abaDiario) {
        var hoje = new Date();
        var mesAtual = hoje.getMonth();
        var anoAtual = hoje.getFullYear();
        var md = abaDiario.getDataRange().getValues();
        var contMes = 0;
        for (var di = 1; di < md.length; di++) {
          var rawData = md[di][COL_ENC.DATA];
          if (!rawData) continue;
          var dd;
          if (rawData instanceof Date) dd = rawData;
          else {
            var sd = String(rawData).split(' ')[0];
            if (sd.indexOf('/') > 0) { var pp = sd.split('/'); dd = new Date(+pp[2], +pp[1]-1, +pp[0]); }
            else dd = new Date(sd);
          }
          if (dd && !isNaN(dd.getTime()) && dd.getMonth() === mesAtual && dd.getFullYear() === anoAtual) {
            contMes++;
          }
        }
        alunos[a].encontrosMesCorrente = contMes;
      }
    } catch (e) { Logger.log('agregar: erro em ' + alunos[a].idAluno + ' — ' + e.message); }

    alunos[a].metricas = {
      faixaHoras: alunoFaixa,
      bem: alunoBem,
      materias: alunoMaterias,
      historico: alunoHist,
      simulados4w: alunoSim4W
    };
  }

  var labels = Object.keys(historicoPorSemana).sort(function(a, b) {
    function pl(l) { var p = l.split(' a ')[0].split('/'); return new Date(+p[2], +p[1]-1, +p[0]).getTime(); }
    return pl(a) - pl(b);
  }).slice(-8);

  function avg(s, c) { return c > 0 ? +(s / c).toFixed(1) : 0; }

  return {
    horasEstudadas: {
      distribuicao: distribuicao.map(function(d){ return { faixa: d.faixa, count: d.count }; }),
      historico8Semanas: labels.map(function(l){
        var h = historicoPorSemana[l];
        return { semana: l, mediaHoras: avg(h.horas, h.count), mediaMeta: avg(h.meta, h.count) };
      })
    },
    dominioPorMateria:   { bio: avg(somas.domBio,  somas.cDomBio),  qui: avg(somas.domQui,  somas.cDomQui),  fis: avg(somas.domFis,  somas.cDomFis),  mat: avg(somas.domMat,  somas.cDomMat) },
    progressoPorMateria: { bio: avg(somas.progBio, somas.cProgBio), qui: avg(somas.progQui, somas.cProgQui), fis: avg(somas.progFis, somas.cProgFis), mat: avg(somas.progMat, somas.cProgMat) },
    bemEstar:            { estresse: avg(bem.est, bem.cEst), ansiedade: avg(bem.ans, bem.cAns), motivacao: avg(bem.mot, bem.cMot), sono: avg(bem.son, bem.cSon) },
    simuladosUltimas4Semanas: totalSim4W
  };
}

// Calcula encontros esperados no mês corrente baseado no plano + data de matrícula.
// Retorna null se não der pra calcular (Custom, vazio, plano desconhecido).
function calcularEncontrosEsperados_(plano, dataMatricula) {
  if (!plano) return null;
  switch (plano) {
    case 'Mensal':    return 1;
    case 'Quinzenal': return 2;
    case 'Semanal':   return 4;
    case 'Padrão':
    case 'Padrao':
      if (!dataMatricula) return 2;
      var inicio = (dataMatricula instanceof Date) ? dataMatricula : new Date(dataMatricula);
      if (isNaN(inicio.getTime())) return 2;
      var diasDesdeMatricula = (new Date().getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24);
      return diasDesdeMatricula < 90 ? 2 : 1;
    case 'Custom': return null;
    default:       return null;
  }
}

function handleDashboardLider(dados) {
  try {
    var email = emailNorm(dados.email);
    if (email !== 'filippe@metodointento.com.br' && email !== 'rafael@metodointento.com.br') {
      return responderJSON({ status: 'erro', codigo: 403, mensagem: 'Não autorizado' });
    }

    var semanaAtual = computarSemanaAnterior_();
    var ssMestre  = SpreadsheetApp.getActiveSpreadsheet();
    var abaMestre = ssMestre.getSheetByName(ABA.MESTRE);
    if (!abaMestre) throw new Error('Aba mestre não encontrada');
    var matriz = abaMestre.getDataRange().getValues();

    var mentoresAtivos = lerMentoresAtivos();
    var cacheAlunos    = lerCacheTodos();
    var alunos = [];
    for (var i = 1; i < matriz.length; i++) {
      var row = matriz[i];
      var statusOn   = txt(row[COL_MESTRE.STATUS_ONBOARDING]);
      var idPlanilha = txt(row[COL_MESTRE.ID_PLANILHA]);
      if (statusOn !== 'Onboarding Completo' || !idPlanilha) continue;
      var emailMentor = emailNorm(row[COL_MESTRE.MENTOR_RESPONSAVEL]);
      var mentorObj = mentoresAtivos[emailMentor];
      var c = cacheAlunos[idPlanilha] || {};
      var plano = txt(row[COL_MESTRE.PLANO]);
      var dataMatricula = row[COL_MESTRE.TIMESTAMP];
      alunos.push({
        idAluno: idPlanilha,
        nome:    txt(row[COL_MESTRE.NOME]),
        email:   emailNorm(row[COL_MESTRE.EMAIL]),
        mentor:  emailMentor,
        mentorNome:  mentorObj ? mentorObj.nome : emailMentor,
        mentorAtivo: !!mentorObj,
        registrouSemanaAtual: c.ultimaSemanaRegistro === semanaAtual,
        ultimoEncontro: c.ultimoEncontro || '',
        plano: plano,
        encontrosEsperados: calcularEncontrosEsperados_(plano, dataMatricula),
        encontrosMesCorrente: 0,
        tipoAluno: txt(row[COL_MESTRE.TIPO_ALUNO]) || 'ENEM',
        escola: txt(row[COL_MESTRE.ESCOLA])
      });
    }

    var listaMentoresAtivos = Object.keys(mentoresAtivos).map(function(e) {
      return { email: e, nome: mentoresAtivos[e].nome };
    }).sort(function(a, b) { return a.nome.localeCompare(b.nome); });

    if (dados.skipAgregado) {
      return responderJSON({ status: 'sucesso', semanaAtual: semanaAtual, alunos: alunos, mentoresAtivos: listaMentoresAtivos, agregado: null });
    }

    Logger.log('dashboardLider: agregando ' + alunos.length + ' alunos');
    var t0 = new Date().getTime();
    var agregado = agregarMetricasBase_(alunos);
    Logger.log('dashboardLider: agregado em ' + ((new Date().getTime() - t0) / 1000) + 's');

    return responderJSON({ status: 'sucesso', semanaAtual: semanaAtual, alunos: alunos, mentoresAtivos: listaMentoresAtivos, agregado: agregado });
  } catch (e) {
    Logger.log('dashboardLider EXCEPTION: ' + e.message);
    return responderJSON({ status: 'erro', mensagem: e.message });
  }
}


// =====================================================================
// DESIGNAR MENTOR (Líder → atribui mentor a aluno + notifica por email)
// =====================================================================
function handleDesignarMentor(dados) {
  try {
    var emailLider = emailNorm(dados.email);
    if (emailLider !== 'filippe@metodointento.com.br') {
      return responderJSON({ status: 'erro', codigo: 403, mensagem: 'Não autorizado' });
    }

    var idAluno = txt(dados.idAluno);
    var emailMentor = emailNorm(dados.emailMentor);
    var plano = txt(dados.plano);
    if (!idAluno || !emailMentor) {
      return responderJSON({ status: 'erro', mensagem: 'idAluno e emailMentor obrigatórios' });
    }

    var PLANOS_VALIDOS = ['Mensal', 'Quinzenal', 'Semanal', 'Padrão', 'Padrao', 'Custom'];
    if (!plano) {
      return responderJSON({ status: 'erro', mensagem: 'plano obrigatório na designação' });
    }
    if (PLANOS_VALIDOS.indexOf(plano) === -1) {
      return responderJSON({ status: 'erro', mensagem: 'plano inválido (use: ' + PLANOS_VALIDOS.join(', ') + ')' });
    }

    // Mentor deve estar Ativo em BD_Mentores
    var mentoresAtivos = lerMentoresAtivos();
    var mentorObj = mentoresAtivos[emailMentor];
    if (!mentorObj) {
      return responderJSON({ status: 'erro', mensagem: 'Mentor não cadastrado como Ativo em BD_Mentores' });
    }

    // Localiza aluno em BD_Alunos
    var ssMestre = SpreadsheetApp.getActiveSpreadsheet();
    var abaMestre = ssMestre.getSheetByName(ABA.MESTRE);
    if (!abaMestre) throw new Error('BD_Alunos não encontrada');
    var matriz = abaMestre.getDataRange().getValues();
    var linhaAluno = -1;
    var dadosAluno = null;
    for (var i = 1; i < matriz.length; i++) {
      if (txt(matriz[i][COL_MESTRE.ID_PLANILHA]) === idAluno) {
        linhaAluno = i + 1;
        dadosAluno = {
          nome: txt(matriz[i][COL_MESTRE.NOME]),
          email: txt(matriz[i][COL_MESTRE.EMAIL]),
          telefone: txt(matriz[i][COL_MESTRE.TELEFONE]),
          mentorAnterior: emailNorm(matriz[i][COL_MESTRE.MENTOR_RESPONSAVEL])
        };
        break;
      }
    }
    if (linhaAluno === -1) {
      return responderJSON({ status: 'erro', mensagem: 'Aluno não encontrado em BD_Alunos' });
    }

    // Atualiza colunas mentor_responsavel e plano na mestre
    abaMestre.getRange(linhaAluno, COL_MESTRE.MENTOR_RESPONSAVEL + 1).setValue(emailMentor);
    abaMestre.getRange(linhaAluno, COL_MESTRE.PLANO + 1).setValue(plano);

    var emailsEnviados = { aluno: false, mentor: false };

    // Email pro aluno (GmailApp = mais confiável que MailApp pra entregabilidade)
    if (dadosAluno.email) {
      try {
        GmailApp.sendEmail(
          dadosAluno.email,
          'Sua mentoria começa agora — bem-vindo(a) à Intento',
          'Olá ' + (dadosAluno.nome || '') + ',\n\n' +
          'Você foi designado(a) para o(a) mentor(a) ' + mentorObj.nome + '.\n\n' +
          'Em breve ele(a) entrará em contato com você pelo WhatsApp para agendar a primeira reunião e alinhar os primeiros passos da sua mentoria.\n\n' +
          'Se tiver alguma dúvida nesse meio tempo, é só responder este email diretamente.\n\n' +
          'Bons estudos!\n— Filippe Ximenes\nEquipe Intento',
          {
            name: 'Filippe Ximenes — Intento',
            replyTo: 'filippe@metodointento.com.br',
            htmlBody:
              '<p>Olá <b>' + (dadosAluno.nome || '') + '</b>,</p>' +
              '<p>Você foi designado(a) para o(a) mentor(a) <b>' + mentorObj.nome + '</b>.</p>' +
              '<p>Em breve ele(a) entrará em contato com você pelo WhatsApp para agendar a primeira reunião e alinhar os primeiros passos da sua mentoria.</p>' +
              '<p>Se tiver alguma dúvida nesse meio tempo, é só responder este email diretamente.</p>' +
              '<p>Bons estudos!<br/>— Filippe Ximenes<br/><b>Equipe Intento</b></p>'
          }
        );
        emailsEnviados.aluno = true;
        Logger.log('email aluno OK: ' + dadosAluno.email);
      } catch (e) { Logger.log('email aluno falhou: ' + e.message); }
    }

    // Email pro mentor
    try {
      GmailApp.sendEmail(
        emailMentor,
        'Novo mentorado: ' + (dadosAluno.nome || 'sem nome'),
        'Olá ' + mentorObj.nome + ',\n\n' +
        'Um novo mentorado foi designado pra você:\n\n' +
        '- Nome: ' + (dadosAluno.nome || '—') + '\n' +
        '- Email: ' + (dadosAluno.email || '—') + '\n' +
        '- Telefone: ' + (dadosAluno.telefone || '—') + '\n\n' +
        'Por favor, entre em contato em até 48h e cadastre o primeiro encontro no Diário de Bordo após a reunião inicial.\n\n' +
        '— Filippe Ximenes\nEquipe Intento',
        {
          name: 'Filippe Ximenes — Intento',
          replyTo: 'filippe@metodointento.com.br',
          htmlBody:
            '<p>Olá <b>' + mentorObj.nome + '</b>,</p>' +
            '<p>Um novo mentorado foi designado pra você:</p>' +
            '<ul>' +
              '<li><b>Nome:</b> ' + (dadosAluno.nome || '—') + '</li>' +
              '<li><b>Email:</b> ' + (dadosAluno.email || '—') + '</li>' +
              '<li><b>Telefone:</b> ' + (dadosAluno.telefone || '—') + '</li>' +
            '</ul>' +
            '<p>Por favor, entre em contato em até 48h e cadastre o primeiro encontro no Diário de Bordo após a reunião inicial.</p>' +
            '<p>— Filippe Ximenes<br/><b>Equipe Intento</b></p>'
        }
      );
      emailsEnviados.mentor = true;
      Logger.log('email mentor OK: ' + emailMentor);
    } catch (e) { Logger.log('email mentor falhou: ' + e.message); }

    return responderJSON({
      status: 'sucesso',
      mentorAnterior: dadosAluno.mentorAnterior,
      mentorNovo: emailMentor,
      mentorNome: mentorObj.nome,
      aluno: { nome: dadosAluno.nome, telefone: dadosAluno.telefone, email: dadosAluno.email },
      emailsEnviados: emailsEnviados
    });
  } catch (e) {
    Logger.log('handleDesignarMentor EXCEPTION: ' + e.message);
    return responderJSON({ status: 'erro', mensagem: e.message });
  }
}


// =====================================================================
// ATUALIZAR DADOS DO ALUNO (líder ou mentor responsável)
// — atualiza campos do fac-símile EM: tipo_aluno, turma, escola, fase
// =====================================================================
function handleAtualizarDadosAluno(dados) {
  try {
    var emailRequester = emailNorm(dados.email);
    var idAluno = txt(dados.idAluno);
    if (!idAluno) {
      return responderJSON({ status: 'erro', mensagem: 'idAluno obrigatório' });
    }

    var ssMestre = SpreadsheetApp.getActiveSpreadsheet();
    var abaMestre = ssMestre.getSheetByName(ABA.MESTRE);
    if (!abaMestre) throw new Error('BD_Alunos não encontrada');
    var matriz = abaMestre.getDataRange().getValues();
    var linhaAluno = -1;
    var mentorResponsavel = '';
    for (var i = 1; i < matriz.length; i++) {
      if (txt(matriz[i][COL_MESTRE.ID_PLANILHA]) === idAluno) {
        linhaAluno = i + 1;
        mentorResponsavel = emailNorm(matriz[i][COL_MESTRE.MENTOR_RESPONSAVEL]);
        break;
      }
    }
    if (linhaAluno === -1) {
      return responderJSON({ status: 'erro', mensagem: 'Aluno não encontrado' });
    }

    var ehLider = emailRequester === 'filippe@metodointento.com.br';
    var ehMentorResponsavel = emailRequester === mentorResponsavel;
    if (!ehLider && !ehMentorResponsavel) {
      return responderJSON({ status: 'erro', codigo: 403, mensagem: 'Não autorizado: precisa ser líder ou mentor responsável' });
    }

    var atualizacoes = [];
    if (Object.prototype.hasOwnProperty.call(dados, 'tipoAluno')) {
      var tipo = txt(dados.tipoAluno);
      if (TIPOS_ALUNO.indexOf(tipo) === -1) {
        return responderJSON({ status: 'erro', mensagem: 'tipoAluno inválido (deve ser EM ou ENEM)' });
      }
      atualizacoes.push({ col: COL_MESTRE.TIPO_ALUNO + 1, valor: tipo });
    }
    if (Object.prototype.hasOwnProperty.call(dados, 'escola')) {
      atualizacoes.push({ col: COL_MESTRE.ESCOLA + 1, valor: txt(dados.escola) });
    }

    if (atualizacoes.length === 0) {
      return responderJSON({ status: 'erro', mensagem: 'nenhum campo pra atualizar' });
    }

    for (var k = 0; k < atualizacoes.length; k++) {
      abaMestre.getRange(linhaAluno, atualizacoes[k].col).setValue(atualizacoes[k].valor);
    }

    return responderJSON({ status: 'sucesso', idAluno: idAluno, atualizados: atualizacoes.length });

  } catch (e) {
    Logger.log('handleAtualizarDadosAluno EXCEPTION: ' + e.message);
    return responderJSON({ status: 'erro', mensagem: e.message });
  }
}


// =====================================================================
// AVALIAÇÕES ESCOLARES (BD_Avaliacoes)
// — provas de alunos EM. Mentor cadastra, aluno lê, líder lê tudo.
// =====================================================================

// Localiza aluno e retorna { linha, mentor, email }. linha=-1 se não achou.
function _acharAlunoPorId(idAluno) {
  var ssMestre = SpreadsheetApp.getActiveSpreadsheet();
  var abaMestre = ssMestre.getSheetByName(ABA.MESTRE);
  if (!abaMestre) throw new Error('BD_Alunos não encontrada');
  var matriz = abaMestre.getDataRange().getValues();
  for (var i = 1; i < matriz.length; i++) {
    if (txt(matriz[i][COL_MESTRE.ID_PLANILHA]) === idAluno) {
      return {
        linha: i + 1,
        mentor: emailNorm(matriz[i][COL_MESTRE.MENTOR_RESPONSAVEL]),
        email:  emailNorm(matriz[i][COL_MESTRE.EMAIL]),
        nome:   txt(matriz[i][COL_MESTRE.NOME])
      };
    }
  }
  return { linha: -1 };
}

// Localiza avaliação por id. Retorna { linha, row, idAluno } ou linha=-1.
function _acharAvaliacaoPorId(idAv) {
  var ssMestre = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ssMestre.getSheetByName(ABA.AVALIACOES);
  if (!aba) throw new Error('BD_Avaliacoes não encontrada — rode migrarBDAvaliacoesFacSimile()');
  var matriz = aba.getDataRange().getValues();
  for (var i = 1; i < matriz.length; i++) {
    if (txt(matriz[i][COL_AV.ID]) === idAv) {
      return { linha: i + 1, row: matriz[i], idAluno: txt(matriz[i][COL_AV.ID_ALUNO]), aba: aba };
    }
  }
  return { linha: -1 };
}

function _ehLider(email) {
  return email === 'filippe@metodointento.com.br';
}

// Authz: garante que o requester é líder, mentor responsável OU o próprio aluno.
// Lança erro se sem permissão. Usar em qualquer handler que aceite
// idPlanilhaAluno/idAluno do payload e devolva ou modifique dados do aluno.
// Sem isso, qualquer email autenticado consegue acessar dados de qualquer aluno.
// Importante: o `email` aqui DEVE ser o email vindo do Firebase ID Token
// (sobrescrito pelo Next em ACOES_AUTENTICADAS), nunca o do body cru.
function _exigirAcessoAluno(emailRequester, idPlanilhaAluno) {
  var email = emailNorm(emailRequester);
  if (!email) {
    throw new Error('Sem identidade — token ausente.');
  }
  if (_ehLider(email)) return { papel: 'lider', aluno: null };
  var aluno = _acharAlunoPorId(idPlanilhaAluno);
  if (aluno.linha === -1) {
    // Não revela se o id existe ou não — mensagem genérica.
    throw new Error('Aluno não encontrado ou acesso negado.');
  }
  if (email === aluno.mentor) return { papel: 'mentor', aluno: aluno };
  if (email === aluno.email)  return { papel: 'aluno',  aluno: aluno };
  throw new Error('Acesso negado a este aluno.');
}

// Valida uma avaliação a cadastrar. Retorna { ok, erro?, normalizada? }
function _validarAvaliacao(av, idx) {
  var prefix = 'avaliação #' + (idx + 1) + ': ';
  var dataStr = txt(av && av.data);
  if (!dataStr) return { ok: false, erro: prefix + 'data obrigatória' };
  var dataObj = new Date(dataStr);
  if (isNaN(dataObj.getTime())) return { ok: false, erro: prefix + 'data inválida' };

  var materia = txt(av.materia);
  if (!materia) return { ok: false, erro: prefix + 'matéria obrigatória' };

  var tipo = txt(av.tipo);
  if (TIPOS_AVAL.indexOf(tipo) === -1) {
    return { ok: false, erro: prefix + 'tipo inválido (esperado: ' + TIPOS_AVAL.join(', ') + ')' };
  }

  var nota = '';
  if (av.nota !== undefined && av.nota !== null && av.nota !== '') {
    var n = Number(av.nota);
    if (isNaN(n) || n < 0 || n > 10) return { ok: false, erro: prefix + 'nota deve ser número entre 0 e 10' };
    nota = n;
  }

  return {
    ok: true,
    normalizada: {
      data: dataObj,
      materia: materia,
      tipo: tipo,
      observacao: txt(av.observacao),
      nota: nota,
      substituiId: txt(av.substituiId)
    }
  };
}

// Cadastra 1+ avaliações em batch transacional.
// Input: { email, idAluno, avaliacoes: [{data, materia, tipo, observacao?, nota?}, ...] }
function handleCadastrarAvaliacoes(dados) {
  try {
    var emailRequester = emailNorm(dados.email);
    var idAluno = txt(dados.idAluno);
    var lista = Array.isArray(dados.avaliacoes) ? dados.avaliacoes : [];
    if (!idAluno) return responderJSON({ status: 'erro', mensagem: 'idAluno obrigatório' });
    if (lista.length === 0) return responderJSON({ status: 'erro', mensagem: 'avaliacoes vazia' });

    var aluno = _acharAlunoPorId(idAluno);
    if (aluno.linha === -1) return responderJSON({ status: 'erro', mensagem: 'aluno não encontrado' });

    if (!_ehLider(emailRequester) && emailRequester !== aluno.mentor) {
      return responderJSON({ status: 'erro', codigo: 403, mensagem: 'apenas líder ou mentor responsável' });
    }

    // Valida TODAS antes de gravar (transacional)
    var normalizadas = [];
    for (var i = 0; i < lista.length; i++) {
      var v = _validarAvaliacao(lista[i], i);
      if (!v.ok) return responderJSON({ status: 'erro', mensagem: v.erro, indice: i });
      normalizadas.push(v.normalizada);
    }

    var ssMestre = SpreadsheetApp.getActiveSpreadsheet();
    var aba = ssMestre.getSheetByName(ABA.AVALIACOES);
    if (!aba) throw new Error('BD_Avaliacoes não encontrada — rode migrarBDAvaliacoesFacSimile()');

    var agora = new Date();
    var idsCriados = [];
    var rows = normalizadas.map(function(n) {
      var id = 'av_' + agora.getTime() + '_' + Math.floor(Math.random() * 100000);
      idsCriados.push(id);
      var row = new Array(10).fill('');
      row[COL_AV.ID]            = id;
      row[COL_AV.ID_ALUNO]      = idAluno;
      row[COL_AV.DATA]          = n.data;
      row[COL_AV.MATERIA]       = n.materia;
      row[COL_AV.TIPO]          = n.tipo;
      row[COL_AV.OBSERVACAO]    = n.observacao;
      row[COL_AV.NOTA]          = n.nota;
      row[COL_AV.CRIADO_POR]    = emailRequester;
      row[COL_AV.CRIADO_EM]     = agora;
      row[COL_AV.SUBSTITUI_ID]  = n.substituiId;
      return row;
    });

    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      var startRow = aba.getLastRow() + 1;
      aba.getRange(startRow, 1, rows.length, 10).setValues(rows);
    } finally {
      lock.releaseLock();
    }

    return responderJSON({ status: 'sucesso', idsCriados: idsCriados, total: rows.length });
  } catch (e) {
    Logger.log('handleCadastrarAvaliacoes EXCEPTION: ' + e.message);
    return responderJSON({ status: 'erro', mensagem: e.message });
  }
}

// Lista avaliações de um aluno. Auth: líder, mentor responsável, ou o próprio aluno.
// Retorna ordenado por data ASC.
function handleListarAvaliacoesAluno(dados) {
  try {
    var emailRequester = emailNorm(dados.email);
    var idAluno = txt(dados.idAluno);
    if (!idAluno) return responderJSON({ status: 'erro', mensagem: 'idAluno obrigatório' });

    var aluno = _acharAlunoPorId(idAluno);
    if (aluno.linha === -1) return responderJSON({ status: 'erro', mensagem: 'aluno não encontrado' });

    var autorizado = _ehLider(emailRequester) || emailRequester === aluno.mentor || emailRequester === aluno.email;
    if (!autorizado) return responderJSON({ status: 'erro', codigo: 403, mensagem: 'não autorizado' });

    var ssMestre = SpreadsheetApp.getActiveSpreadsheet();
    var aba = ssMestre.getSheetByName(ABA.AVALIACOES);
    if (!aba) {
      // Aba ainda não foi criada — devolve lista vazia em vez de erro.
      return responderJSON({ status: 'sucesso', avaliacoes: [] });
    }
    var lastRow = aba.getLastRow();
    if (lastRow < 2) return responderJSON({ status: 'sucesso', avaliacoes: [] });

    // lê 10 cols ou menos se a aba ainda não foi migrada com substitui_id
    var nCols = Math.min(10, aba.getLastColumn());
    var matriz = aba.getRange(2, 1, lastRow - 1, nCols).getValues();
    var lista = [];
    for (var i = 0; i < matriz.length; i++) {
      var r = matriz[i];
      if (txt(r[COL_AV.ID_ALUNO]) !== idAluno) continue;
      var dataObj = r[COL_AV.DATA] instanceof Date ? r[COL_AV.DATA] : new Date(r[COL_AV.DATA]);
      lista.push({
        id: txt(r[COL_AV.ID]),
        idAluno: idAluno,
        data: isNaN(dataObj.getTime()) ? '' : dataObj.toISOString(),
        materia: txt(r[COL_AV.MATERIA]),
        tipo: txt(r[COL_AV.TIPO]),
        observacao: txt(r[COL_AV.OBSERVACAO]),
        nota: r[COL_AV.NOTA] === '' || r[COL_AV.NOTA] === null ? null : Number(r[COL_AV.NOTA]),
        substituiId: nCols > COL_AV.SUBSTITUI_ID ? txt(r[COL_AV.SUBSTITUI_ID]) : ''
      });
    }
    lista.sort(function(a, b) {
      return (a.data || '').localeCompare(b.data || '');
    });
    return responderJSON({ status: 'sucesso', avaliacoes: lista });
  } catch (e) {
    Logger.log('handleListarAvaliacoesAluno EXCEPTION: ' + e.message);
    return responderJSON({ status: 'erro', mensagem: e.message });
  }
}

// Atualiza campos de uma avaliação. Auth: líder ou mentor responsável.
// Lock obrigatório: deleteRow concorrente shifta índices; sem lock, update pode
// gravar na linha errada se outra request deletou nesse meio-tempo.
function handleAtualizarAvaliacao(dados) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    var emailRequester = emailNorm(dados.email);
    var idAv = txt(dados.idAvaliacao);
    if (!idAv) return responderJSON({ status: 'erro', mensagem: 'idAvaliacao obrigatório' });

    var av = _acharAvaliacaoPorId(idAv);
    if (av.linha === -1) return responderJSON({ status: 'erro', mensagem: 'avaliação não encontrada' });

    var aluno = _acharAlunoPorId(av.idAluno);
    if (aluno.linha === -1) return responderJSON({ status: 'erro', mensagem: 'aluno da avaliação não encontrado' });

    if (!_ehLider(emailRequester) && emailRequester !== aluno.mentor) {
      return responderJSON({ status: 'erro', codigo: 403, mensagem: 'apenas líder ou mentor responsável' });
    }

    var atualizacoes = [];
    if (Object.prototype.hasOwnProperty.call(dados, 'data')) {
      var d = new Date(txt(dados.data));
      if (isNaN(d.getTime())) return responderJSON({ status: 'erro', mensagem: 'data inválida' });
      atualizacoes.push({ col: COL_AV.DATA + 1, valor: d });
    }
    if (Object.prototype.hasOwnProperty.call(dados, 'materia')) {
      var m = txt(dados.materia);
      if (!m) return responderJSON({ status: 'erro', mensagem: 'matéria não pode ser vazia' });
      atualizacoes.push({ col: COL_AV.MATERIA + 1, valor: m });
    }
    if (Object.prototype.hasOwnProperty.call(dados, 'tipo')) {
      var t = txt(dados.tipo);
      if (TIPOS_AVAL.indexOf(t) === -1) return responderJSON({ status: 'erro', mensagem: 'tipo inválido' });
      atualizacoes.push({ col: COL_AV.TIPO + 1, valor: t });
    }
    if (Object.prototype.hasOwnProperty.call(dados, 'observacao')) {
      atualizacoes.push({ col: COL_AV.OBSERVACAO + 1, valor: txt(dados.observacao) });
    }
    if (Object.prototype.hasOwnProperty.call(dados, 'nota')) {
      if (dados.nota === '' || dados.nota === null || dados.nota === undefined) {
        atualizacoes.push({ col: COL_AV.NOTA + 1, valor: '' });
      } else {
        var n = Number(dados.nota);
        if (isNaN(n) || n < 0 || n > 10) return responderJSON({ status: 'erro', mensagem: 'nota deve ser número entre 0 e 10' });
        atualizacoes.push({ col: COL_AV.NOTA + 1, valor: n });
      }
    }
    if (Object.prototype.hasOwnProperty.call(dados, 'substituiId')) {
      atualizacoes.push({ col: COL_AV.SUBSTITUI_ID + 1, valor: txt(dados.substituiId) });
    }

    if (atualizacoes.length === 0) return responderJSON({ status: 'erro', mensagem: 'nenhum campo pra atualizar' });

    for (var k = 0; k < atualizacoes.length; k++) {
      av.aba.getRange(av.linha, atualizacoes[k].col).setValue(atualizacoes[k].valor);
    }
    return responderJSON({ status: 'sucesso', idAvaliacao: idAv });
  } catch (e) {
    Logger.log('handleAtualizarAvaliacao EXCEPTION: ' + e.message);
    return responderJSON({ status: 'erro', mensagem: e.message });
  } finally {
    lock.releaseLock();
  }
}

// Deleta uma avaliação. Auth: líder ou mentor responsável.
// Lock obrigatório: deletes concorrentes shiftariam índices e poderiam apagar a linha errada.
function handleDeletarAvaliacao(dados) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    var emailRequester = emailNorm(dados.email);
    var idAv = txt(dados.idAvaliacao);
    if (!idAv) return responderJSON({ status: 'erro', mensagem: 'idAvaliacao obrigatório' });

    var av = _acharAvaliacaoPorId(idAv);
    if (av.linha === -1) return responderJSON({ status: 'erro', mensagem: 'avaliação não encontrada' });

    var aluno = _acharAlunoPorId(av.idAluno);
    if (aluno.linha === -1) return responderJSON({ status: 'erro', mensagem: 'aluno da avaliação não encontrado' });

    if (!_ehLider(emailRequester) && emailRequester !== aluno.mentor) {
      return responderJSON({ status: 'erro', codigo: 403, mensagem: 'apenas líder ou mentor responsável' });
    }

    av.aba.deleteRow(av.linha);
    return responderJSON({ status: 'sucesso', idAvaliacao: idAv });
  } catch (e) {
    Logger.log('handleDeletarAvaliacao EXCEPTION: ' + e.message);
    return responderJSON({ status: 'erro', mensagem: e.message });
  } finally {
    lock.releaseLock();
  }
}


// =====================================================================
// PUSH NOTIFICATIONS — subscriptions
// =====================================================================

function handleSubscribePush(dados) {
  try {
    var email = emailNorm(dados.email);
    var sub = dados.subscription || {};
    if (!email) return responderJSON({ status: 'erro', mensagem: 'email obrigatório' });
    if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth)
      return responderJSON({ status: 'erro', mensagem: 'subscription inválida' });

    var ssMestre = SpreadsheetApp.getActiveSpreadsheet();
    var aba = ssMestre.getSheetByName(ABA.PUSH_SUBS);
    if (!aba) return responderJSON({ status: 'erro', mensagem: 'aba ' + ABA.PUSH_SUBS + ' não encontrada' });

    // Se já existir linha com mesmo endpoint (mesmo device), atualiza em vez de duplicar
    var lastRow = aba.getLastRow();
    if (lastRow >= 2) {
      var endpoints = aba.getRange(2, COL_PUSH.ENDPOINT + 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < endpoints.length; i++) {
        if (String(endpoints[i][0]) === sub.endpoint) {
          var linha = i + 2;
          aba.getRange(linha, 1, 1, 6).setValues([[
            email, sub.endpoint, sub.keys.p256dh, sub.keys.auth,
            new Date(), txt(dados.userAgent)
          ]]);
          return responderJSON({ status: 'sucesso', updated: true });
        }
      }
    }

    aba.appendRow([email, sub.endpoint, sub.keys.p256dh, sub.keys.auth, new Date(), txt(dados.userAgent)]);
    return responderJSON({ status: 'sucesso', created: true });
  } catch (e) {
    Logger.log('subscribePush EXCEPTION: ' + e.message);
    return responderJSON({ status: 'erro', mensagem: e.message });
  }
}

function handleUnsubscribePush(dados) {
  try {
    var endpoint = txt(dados.endpoint);
    if (!endpoint) return responderJSON({ status: 'erro', mensagem: 'endpoint obrigatório' });

    var ssMestre = SpreadsheetApp.getActiveSpreadsheet();
    var aba = ssMestre.getSheetByName(ABA.PUSH_SUBS);
    if (!aba) return responderJSON({ status: 'sucesso', removidas: 0 });

    var lastRow = aba.getLastRow();
    if (lastRow < 2) return responderJSON({ status: 'sucesso', removidas: 0 });

    var endpoints = aba.getRange(2, COL_PUSH.ENDPOINT + 1, lastRow - 1, 1).getValues();
    var removidas = 0;
    for (var i = endpoints.length - 1; i >= 0; i--) {
      if (String(endpoints[i][0]) === endpoint) {
        aba.deleteRow(i + 2);
        removidas++;
      }
    }
    return responderJSON({ status: 'sucesso', removidas: removidas });
  } catch (e) {
    Logger.log('unsubscribePush EXCEPTION: ' + e.message);
    return responderJSON({ status: 'erro', mensagem: e.message });
  }
}

// Lista subscriptions filtradas por email(s). Aceita { email } ou { emails: [...] }.
function handleListarPushSubscriptions(dados) {
  try {
    var ssMestre = SpreadsheetApp.getActiveSpreadsheet();
    var aba = ssMestre.getSheetByName(ABA.PUSH_SUBS);
    if (!aba) return responderJSON({ status: 'sucesso', subscriptions: [] });

    var lastRow = aba.getLastRow();
    if (lastRow < 2) return responderJSON({ status: 'sucesso', subscriptions: [] });

    var matriz = aba.getRange(2, 1, lastRow - 1, 6).getValues();
    var emailsFiltro = null;
    if (dados.email) emailsFiltro = [emailNorm(dados.email)];
    else if (Array.isArray(dados.emails)) emailsFiltro = dados.emails.map(emailNorm);

    var subs = [];
    for (var i = 0; i < matriz.length; i++) {
      var em = emailNorm(matriz[i][COL_PUSH.EMAIL]);
      if (!em) continue;
      if (emailsFiltro && emailsFiltro.indexOf(em) === -1) continue;
      subs.push({
        email:    em,
        endpoint: String(matriz[i][COL_PUSH.ENDPOINT]),
        keys: {
          p256dh: String(matriz[i][COL_PUSH.P256DH]),
          auth:   String(matriz[i][COL_PUSH.AUTH])
        }
      });
    }
    return responderJSON({ status: 'sucesso', subscriptions: subs });
  } catch (e) {
    Logger.log('listarPushSubscriptions EXCEPTION: ' + e.message);
    return responderJSON({ status: 'erro', mensagem: e.message });
  }
}


// =====================================================================
// PUSH NOTIFICATIONS — cron jobs e disparos automáticos
// =====================================================================

// Helper: dispara 1 push notification via /api/push/send
// Requer Script Property AGENT_API_TOKEN (mesmo valor da env AGENT_API_TOKEN no Vercel).
function _enviarPush(email, title, body, url) {
  try {
    var agentToken = PropertiesService.getScriptProperties().getProperty("AGENT_API_TOKEN");
    if (!agentToken) {
      Logger.log('_enviarPush abortado: AGENT_API_TOKEN ausente em Script Properties');
      return;
    }
    UrlFetchApp.fetch(URL_APP + '/api/push/send', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-agent-token': agentToken },
      payload: JSON.stringify({ email: email, title: title, body: body, url: url || '/' }),
      muteHttpExceptions: true,
    });
  } catch (e) {
    Logger.log('_enviarPush falhou pra ' + email + ': ' + e.message);
  }
}

// SEGUNDA 8h — Lembrete pro aluno conferir o plano de ação semanal
function cronLembreteAluno() {
  Logger.log('===== cronLembreteAluno =====');
  var ssMestre = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ssMestre.getSheetByName(ABA.MESTRE);
  if (!aba) return;
  var matriz = aba.getDataRange().getValues();
  var count = 0;
  for (var i = 1; i < matriz.length; i++) {
    if (txt(matriz[i][COL_MESTRE.STATUS_ONBOARDING]) !== 'Onboarding Completo') continue;
    var em = emailNorm(matriz[i][COL_MESTRE.EMAIL]);
    if (!em) continue;
    _enviarPush(
      em,
      '📚 Sua semana começou',
      'Veja o plano de ação que você combinou com seu mentor pra essa semana.',
      '/painel'
    );
    count++;
  }
  Logger.log('cronLembreteAluno: ' + count + ' alunos notificados');
}

// SEGUNDA 9h — Lembrete pro mentor fazer registros semanais
function cronLembreteMentor() {
  Logger.log('===== cronLembreteMentor =====');
  var mentores = lerMentoresAtivos();
  var emails = Object.keys(mentores);
  emails.forEach(function(em) {
    _enviarPush(
      em,
      '📝 Hora dos registros semanais',
      'Faça o fechamento da semana de cada um dos seus mentorados.',
      '/mentor'
    );
  });
  Logger.log('cronLembreteMentor: ' + emails.length + ' mentores notificados');
}

// TERÇA 9h — Avisa o líder se algum mentor não fez registro semanal
function cronAlertaLiderMentoresFaltantes() {
  Logger.log('===== cronAlertaLiderMentoresFaltantes =====');
  var semanaAtual = computarSemanaAnterior_();
  var ssMestre = SpreadsheetApp.getActiveSpreadsheet();
  var abaMestre = ssMestre.getSheetByName(ABA.MESTRE);
  var matriz = abaMestre.getDataRange().getValues();
  var cache = lerCacheTodos();
  var mentoresAtivos = lerMentoresAtivos();

  // Conta alunos por mentor que não foram registrados
  var faltantesPorMentor = {};
  for (var i = 1; i < matriz.length; i++) {
    if (txt(matriz[i][COL_MESTRE.STATUS_ONBOARDING]) !== 'Onboarding Completo') continue;
    var idPlanilha = txt(matriz[i][COL_MESTRE.ID_PLANILHA]);
    if (!idPlanilha) continue;
    var emailMentor = emailNorm(matriz[i][COL_MESTRE.MENTOR_RESPONSAVEL]);
    if (!emailMentor || !mentoresAtivos[emailMentor]) continue;
    var c = cache[idPlanilha] || {};
    if (c.ultimaSemanaRegistro !== semanaAtual) {
      faltantesPorMentor[emailMentor] = (faltantesPorMentor[emailMentor] || 0) + 1;
    }
  }

  var totalFaltantes = Object.values(faltantesPorMentor).reduce(function(s, n) { return s + n; }, 0);
  var totalMentoresFaltantes = Object.keys(faltantesPorMentor).length;
  Logger.log('faltantes: ' + totalFaltantes + ' alunos · ' + totalMentoresFaltantes + ' mentores');

  if (totalFaltantes === 0) return;

  var nomesMentores = Object.keys(faltantesPorMentor).map(function(em) {
    return (mentoresAtivos[em]?.nome || em) + ' (' + faltantesPorMentor[em] + ')';
  }).join(', ');

  _enviarPush(
    'filippe@metodointento.com.br',
    '⚠️ ' + totalMentoresFaltantes + ' mentor(es) com registros pendentes',
    totalFaltantes + ' aluno(s) sem registro da semana ' + semanaAtual + '. Mentores: ' + nomesMentores,
    '/lider'
  );
}

// Push imediato quando aluno completa onboarding (chamado dentro de handleDiagnostico)
function _notificarLiderAlunoAguardando(nomeAluno) {
  _enviarPush(
    'filippe@metodointento.com.br',
    '🎯 Aluno aguardando designação',
    nomeAluno + ' completou o onboarding e está pronto pra ser designado a um mentor.',
    '/lider'
  );
}

// =====================================================================
// INSTALAR TRIGGERS — rode 1× no editor
// =====================================================================
function instalarTriggersCron() {
  // Limpa triggers antigos com nomes desses crons (idempotente)
  var existentes = ScriptApp.getProjectTriggers();
  var nomes = ['cronLembreteAluno', 'cronLembreteMentor', 'cronAlertaLiderMentoresFaltantes'];
  existentes.forEach(function(t) {
    if (nomes.indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });

  // Segunda 8h — aluno
  ScriptApp.newTrigger('cronLembreteAluno').timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).create();

  // Segunda 9h — mentor
  ScriptApp.newTrigger('cronLembreteMentor').timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(9).create();

  // Terça 9h — líder
  ScriptApp.newTrigger('cronAlertaLiderMentoresFaltantes').timeBased()
    .onWeekDay(ScriptApp.WeekDay.TUESDAY).atHour(9).create();

  Logger.log('===== TRIGGERS INSTALADOS =====');
  Logger.log('· cronLembreteAluno              — Segunda 8h');
  Logger.log('· cronLembreteMentor             — Segunda 9h');
  Logger.log('· cronAlertaLiderMentoresFaltantes — Terça 9h');
}


// =====================================================================
// CRM / PIPELINE DE VENDAS
// =====================================================================

// Lê BD_Vendedores e devolve mapa email → { email, nome, dtEntrada } ativos
function lerVendedoresAtivos() {
  var ssMestre = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ssMestre.getSheetByName(ABA.VENDEDORES);
  if (!aba) return {};
  var matriz = aba.getDataRange().getValues();
  var map = {};
  for (var i = 1; i < matriz.length; i++) {
    var row = matriz[i];
    var email = emailNorm(row[COL_VENDEDOR.EMAIL]);
    if (!email || txt(row[COL_VENDEDOR.STATUS]) !== 'Ativo') continue;
    map[email] = {
      email: email,
      nome: txt(row[COL_VENDEDOR.NOME]),
      dtEntrada: row[COL_VENDEDOR.DT_ENTRADA],
      horariosAtendimento: txt(row[COL_VENDEDOR.HORARIOS])
    };
  }
  return map;
}

// === Handler: deleta um lead (hard delete) + log de auditoria ===
// Antes de apagar, registra um evento em Eventos_Pipeline com acao='apagado'
// e snapshot mínimo do lead pra rastreabilidade.
function handleDeletarLead(dados) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var idLead = txt(dados.idLead);
    if (!idLead) return responderJSON({ status: 'erro', mensagem: 'idLead obrigatório' });
    var loc = _acharLinhaLead(idLead);
    if (loc.linha === -1) return responderJSON({ status: 'erro', mensagem: 'lead não encontrado' });
    var matriz = loc.aba.getRange(loc.linha, 1, 1, 27).getValues()[0];
    var lead = _leadToObj(matriz);

    // Permissões: vendedor não-líder só pode deletar lead próprio ou sem dono.
    var emailRequisitanteDel = emailNorm(dados.porEmail);
    var ehLiderDel = (emailRequisitanteDel === 'filippe@metodointento.com.br' || emailRequisitanteDel === 'rafael@metodointento.com.br');
    if (!ehLiderDel) {
      var donoAtualDel = emailNorm(matriz[COL_LEAD.VENDEDOR]);
      if (donoAtualDel && donoAtualDel !== emailRequisitanteDel) {
        return responderJSON({ status: 'erro', codigo: 403, mensagem: 'sem permissão pra deletar lead de outro vendedor' });
      }
    }

    var snapshot = lead.nome + ' / ' + lead.email + ' / ' + lead.telefone + ' (fase: ' + lead.fase + ')';
    registrarEventoPipeline(idLead, 'apagado', lead.fase || '', '', emailNorm(dados.porEmail) || '');
    // Adiciona o snapshot no campo paraFase pro contexto do log (já que o evento "apagado"
    // não tem destino — usamos esse campo pra preservar info útil).
    try {
      var ssMestre = SpreadsheetApp.getActiveSpreadsheet();
      var abaEv = ssMestre.getSheetByName(ABA.EVENTOS_PIPELINE);
      if (abaEv) {
        var lastEv = abaEv.getLastRow();
        if (lastEv >= 2) abaEv.getRange(lastEv, COL_EVENTO.PARA_FASE + 1).setValue(snapshot);
      }
    } catch (e) { Logger.log('snapshot evento apagado: ' + e.message); }
    loc.aba.deleteRow(loc.linha);
    return responderJSON({ status: 'sucesso', idLead: idLead });
  } catch (e) {
    Logger.log('deletarLead EXCEPTION: ' + e.message);
    return responderJSON({ status: 'erro', mensagem: e.message });
  } finally { lock.releaseLock(); }
}

// === Handler: busca um lead pelo idLead (usado pela /api/agenda) ===
function handleBuscarLead(dados) {
  try {
    var loc = _acharLinhaLead(dados.idLead);
    if (loc.linha === -1) return responderJSON({ status: 'erro', mensagem: 'lead não encontrado' });
    var matriz = loc.aba.getRange(loc.linha, 1, 1, 27).getValues()[0];
    var lead = _leadToObj(matriz);
    return responderJSON({ status: 'sucesso', lead: lead });
  } catch (e) {
    Logger.log('buscarLead EXCEPTION: ' + e.message);
    return responderJSON({ status: 'erro', mensagem: e.message });
  }
}

// === Handler: busca lead por email (usado pelo /api/agenda/sync) ===
function handleBuscarLeadPorEmail(dados) {
  try {
    var emailBusca = emailNorm(dados.email);
    if (!emailBusca) return responderJSON({ status: 'erro', mensagem: 'email obrigatório' });
    var ssMestre = SpreadsheetApp.getActiveSpreadsheet();
    var aba = ssMestre.getSheetByName(ABA.LEADS);
    if (!aba) return responderJSON({ status: 'sucesso', lead: null });
    var lastRow = aba.getLastRow();
    if (lastRow < 2) return responderJSON({ status: 'sucesso', lead: null });
    var matriz = aba.getRange(2, 1, lastRow - 1, 27).getValues();
    for (var i = 0; i < matriz.length; i++) {
      if (emailNorm(matriz[i][COL_LEAD.EMAIL]) === emailBusca) {
        return responderJSON({ status: 'sucesso', lead: _leadToObj(matriz[i]) });
      }
    }
    return responderJSON({ status: 'sucesso', lead: null });
  } catch (e) {
    Logger.log('buscarLeadPorEmail EXCEPTION: ' + e.message);
    return responderJSON({ status: 'erro', mensagem: e.message });
  }
}

// === Handler: busca lead por gcal_event_id (dedup do sync) ===
function handleBuscarLeadPorGcalEventId(dados) {
  try {
    var idEvento = txt(dados.gcalEventId);
    if (!idEvento) return responderJSON({ status: 'erro', mensagem: 'gcalEventId obrigatório' });
    var ssMestre = SpreadsheetApp.getActiveSpreadsheet();
    var aba = ssMestre.getSheetByName(ABA.LEADS);
    if (!aba) return responderJSON({ status: 'sucesso', lead: null });
    var lastRow = aba.getLastRow();
    if (lastRow < 2) return responderJSON({ status: 'sucesso', lead: null });
    var matriz = aba.getRange(2, 1, lastRow - 1, 27).getValues();
    for (var i = 0; i < matriz.length; i++) {
      if (txt(matriz[i][COL_LEAD.GCAL_EVENT_ID]) === idEvento) {
        return responderJSON({ status: 'sucesso', lead: _leadToObj(matriz[i]) });
      }
    }
    return responderJSON({ status: 'sucesso', lead: null });
  } catch (e) {
    Logger.log('buscarLeadPorGcalEventId EXCEPTION: ' + e.message);
    return responderJSON({ status: 'erro', mensagem: e.message });
  }
}

// === Handler: lista vendedores ativos com horarios_padrao ===
// Retorna {email, nome, horariosPadrao}. Disponibilidade real é
// (horariosPadrao MENOS exceções de bloqueio MENOS reuniões já marcadas).
function handleListarVendedoresAtendimento(dados) {
  try {
    var ativos = lerVendedoresAtivos();
    var lista = Object.keys(ativos).map(function(em) {
      var v = ativos[em];
      var horarios = null;
      try { horarios = v.horariosAtendimento ? JSON.parse(v.horariosAtendimento) : null; }
      catch (e) { horarios = null; }
      return { email: v.email, nome: v.nome, horariosPadrao: horarios };
    });
    return responderJSON({ status: 'sucesso', vendedores: lista });
  } catch (e) {
    Logger.log('listarVendedoresAtendimento EXCEPTION: ' + e.message);
    return responderJSON({ status: 'erro', mensagem: e.message });
  }
}

// === Handler: salvar horários padrão do vendedor ===
function handleSalvarHorariosPadrao(dados) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var emailV = emailNorm(dados.email);
    if (!emailV) return responderJSON({ status: 'erro', mensagem: 'email obrigatório' });
    if (!dados.horarios || typeof dados.horarios !== 'object') {
      return responderJSON({ status: 'erro', mensagem: 'horarios obrigatórios' });
    }
    var ssMestre = SpreadsheetApp.getActiveSpreadsheet();
    var aba = ssMestre.getSheetByName(ABA.VENDEDORES);
    if (!aba) return responderJSON({ status: 'erro', mensagem: 'BD_Vendedores não encontrada' });
    var matriz = aba.getDataRange().getValues();
    var linha = -1;
    for (var i = 1; i < matriz.length; i++) {
      if (emailNorm(matriz[i][COL_VENDEDOR.EMAIL]) === emailV) { linha = i + 1; break; }
    }
    if (linha === -1) return responderJSON({ status: 'erro', mensagem: 'vendedor não cadastrado em BD_Vendedores' });
    aba.getRange(linha, COL_VENDEDOR.HORARIOS + 1).setValue(JSON.stringify(dados.horarios));
    return responderJSON({ status: 'sucesso' });
  } catch (e) {
    Logger.log('salvarHorariosPadrao EXCEPTION: ' + e.message);
    return responderJSON({ status: 'erro', mensagem: e.message });
  } finally { lock.releaseLock(); }
}

// === Handler: ler horários padrão de um vendedor ===
function handleLerHorariosPadrao(dados) {
  try {
    var emailV = emailNorm(dados.email);
    if (!emailV) return responderJSON({ status: 'erro', mensagem: 'email obrigatório' });
    var ativos = lerVendedoresAtivos();
    var v = ativos[emailV];
    if (!v) return responderJSON({ status: 'erro', mensagem: 'vendedor não está ativo em BD_Vendedores' });
    var horarios = null;
    try { horarios = v.horariosAtendimento ? JSON.parse(v.horariosAtendimento) : null; }
    catch (e) { horarios = null; }
    return responderJSON({ status: 'sucesso', email: v.email, nome: v.nome, horariosPadrao: horarios });
  } catch (e) {
    Logger.log('lerHorariosPadrao EXCEPTION: ' + e.message);
    return responderJSON({ status: 'erro', mensagem: e.message });
  }
}

// === Helper: garante aba de exceções (cria com cabeçalhos se não existir) ===
function _garantirAbaExcecoes() {
  var ssMestre = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ssMestre.getSheetByName(ABA.DISPONIBILIDADE_EXCECOES);
  if (!aba) {
    aba = ssMestre.insertSheet(ABA.DISPONIBILIDADE_EXCECOES);
    aba.getRange(1, 1, 1, 8).setValues([[
      'id', 'vendedor_email', 'tipo', 'dt_inicio', 'dt_fim',
      'motivo', 'criado_em', 'criado_por'
    ]]);
  }
  return aba;
}

// === Handler: criar exceção (bloqueio ou disponibilidade extra) ===
function handleCriarExcecaoDisponibilidade(dados) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var emailV = emailNorm(dados.email);
    var tipo = txt(dados.tipo) || 'bloqueio';
    if (!emailV) return responderJSON({ status: 'erro', mensagem: 'email obrigatório' });
    if (tipo !== 'bloqueio' && tipo !== 'extra') {
      return responderJSON({ status: 'erro', mensagem: 'tipo deve ser bloqueio ou extra' });
    }
    var dtInicio = txt(dados.dtInicio);
    var dtFim    = txt(dados.dtFim);
    if (!dtInicio || !dtFim) return responderJSON({ status: 'erro', mensagem: 'dtInicio e dtFim obrigatórios (ISO)' });

    var aba = _garantirAbaExcecoes();
    var id = Utilities.getUuid();
    aba.appendRow([
      id, emailV, tipo, dtInicio, dtFim,
      txt(dados.motivo), new Date(), emailNorm(dados.criadoPor) || emailV
    ]);
    return responderJSON({ status: 'sucesso', id: id });
  } catch (e) {
    Logger.log('criarExcecao EXCEPTION: ' + e.message);
    return responderJSON({ status: 'erro', mensagem: e.message });
  } finally { lock.releaseLock(); }
}

// === Handler: remover exceção (delete físico) ===
function handleRemoverExcecaoDisponibilidade(dados) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var idAlvo = txt(dados.id);
    if (!idAlvo) return responderJSON({ status: 'erro', mensagem: 'id obrigatório' });
    var aba = _garantirAbaExcecoes();
    var lastRow = aba.getLastRow();
    if (lastRow < 2) return responderJSON({ status: 'sucesso', removidos: 0 });
    var matriz = aba.getRange(2, 1, lastRow - 1, 8).getValues();
    for (var i = 0; i < matriz.length; i++) {
      if (txt(matriz[i][COL_EXCECAO.ID]) === idAlvo) {
        aba.deleteRow(i + 2);
        return responderJSON({ status: 'sucesso', removidos: 1 });
      }
    }
    return responderJSON({ status: 'sucesso', removidos: 0 });
  } catch (e) {
    Logger.log('removerExcecao EXCEPTION: ' + e.message);
    return responderJSON({ status: 'erro', mensagem: e.message });
  } finally { lock.releaseLock(); }
}

// === Handler: carga (qtd de reuniões agendadas) por vendedor no mês corrente ===
// Conta leads em BD_Leads com fase 'Reuniao agendada' e data_proxima_acao
// no mês corrente, agrupados por vendedor. Usado pra round-robin no /agendar.
function handleCargaPorVendedorNoMes(dados) {
  try {
    var ssMestre = SpreadsheetApp.getActiveSpreadsheet();
    var aba = ssMestre.getSheetByName(ABA.LEADS);
    if (!aba) return responderJSON({ status: 'sucesso', cargas: {} });
    var lastRow = aba.getLastRow();
    if (lastRow < 2) return responderJSON({ status: 'sucesso', cargas: {} });
    var matriz = aba.getRange(2, 1, lastRow - 1, 27).getValues();
    var hoje = new Date();
    var mesAtual = hoje.getMonth();
    var anoAtual = hoje.getFullYear();
    var cargas = {};
    for (var i = 0; i < matriz.length; i++) {
      var row = matriz[i];
      if (txt(row[COL_LEAD.FASE]) !== 'Reuniao agendada') continue;
      var vendedor = emailNorm(row[COL_LEAD.VENDEDOR]);
      if (!vendedor) continue;
      var dataStr = txt(row[COL_LEAD.DATA_PROXIMA_ACAO]);
      if (!dataStr) continue;
      // Aceita YYYY-MM-DD ou YYYY-MM-DDTHH...
      var d = new Date(dataStr);
      if (isNaN(d.getTime())) continue;
      if (d.getMonth() !== mesAtual || d.getFullYear() !== anoAtual) continue;
      cargas[vendedor] = (cargas[vendedor] || 0) + 1;
    }
    return responderJSON({ status: 'sucesso', cargas: cargas });
  } catch (e) {
    Logger.log('cargaPorVendedorNoMes EXCEPTION: ' + e.message);
    return responderJSON({ status: 'erro', mensagem: e.message });
  }
}

// === Handler: listar exceções de um vendedor (opcionalmente em janela de tempo) ===
// Se email não fornecido, retorna de todos os vendedores (uso interno do /sugestoes).
function handleListarExcecoesDisponibilidade(dados) {
  try {
    var aba = _garantirAbaExcecoes();
    var lastRow = aba.getLastRow();
    if (lastRow < 2) return responderJSON({ status: 'sucesso', excecoes: [] });
    var matriz = aba.getRange(2, 1, lastRow - 1, 8).getValues();
    var emailFiltro = emailNorm(dados.email);
    var dtIniFiltro = dados.dtInicio ? new Date(dados.dtInicio) : null;
    var dtFimFiltro = dados.dtFim ? new Date(dados.dtFim) : null;
    var lista = [];
    for (var i = 0; i < matriz.length; i++) {
      var row = matriz[i];
      var id = txt(row[COL_EXCECAO.ID]);
      if (!id) continue;
      var emailRow = emailNorm(row[COL_EXCECAO.VENDEDOR_EMAIL]);
      if (emailFiltro && emailRow !== emailFiltro) continue;
      var dtInicio = row[COL_EXCECAO.DT_INICIO];
      var dtFim    = row[COL_EXCECAO.DT_FIM];
      var dtIniDate = dtInicio instanceof Date ? dtInicio : new Date(txt(dtInicio));
      var dtFimDate = dtFim instanceof Date ? dtFim : new Date(txt(dtFim));
      if (dtIniFiltro && dtFimDate < dtIniFiltro) continue;
      if (dtFimFiltro && dtIniDate > dtFimFiltro) continue;
      lista.push({
        id: id,
        vendedorEmail: emailRow,
        tipo: txt(row[COL_EXCECAO.TIPO]),
        dtInicio: dtIniDate.toISOString(),
        dtFim: dtFimDate.toISOString(),
        motivo: txt(row[COL_EXCECAO.MOTIVO]),
        criadoEm: row[COL_EXCECAO.CRIADO_EM] instanceof Date ? row[COL_EXCECAO.CRIADO_EM].toISOString() : txt(row[COL_EXCECAO.CRIADO_EM]),
        criadoPor: emailNorm(row[COL_EXCECAO.CRIADO_POR])
      });
    }
    return responderJSON({ status: 'sucesso', excecoes: lista });
  } catch (e) {
    Logger.log('listarExcecoes EXCEPTION: ' + e.message);
    return responderJSON({ status: 'erro', mensagem: e.message });
  }
}

// Registra evento na aba Eventos_Pipeline (apend-only)
function registrarEventoPipeline(idLead, acao, deFase, paraFase, porEmail) {
  try {
    var ssMestre = SpreadsheetApp.getActiveSpreadsheet();
    var aba = ssMestre.getSheetByName(ABA.EVENTOS_PIPELINE);
    if (!aba) { Logger.log('aba Eventos_Pipeline não encontrada'); return; }
    aba.appendRow([new Date(), idLead, acao, deFase || '', paraFase || '', porEmail || '']);
  } catch (e) { Logger.log('registrarEventoPipeline EXCEPTION: ' + e.message); }
}

// Helper interno: converte linha da matriz de leads em objeto normalizado
function _leadToObj(row) {
  return {
    idLead:           txt(row[COL_LEAD.ID]),
    dtCadastro:       row[COL_LEAD.DT_CADASTRO] instanceof Date ? row[COL_LEAD.DT_CADASTRO].toISOString() : txt(row[COL_LEAD.DT_CADASTRO]),
    nome:             txt(row[COL_LEAD.NOME]),
    tipoPerfil:       txt(row[COL_LEAD.TIPO_PERFIL]),
    nomeRelacionado:  txt(row[COL_LEAD.NOME_RELACIONADO]),
    telefone:         txt(row[COL_LEAD.TELEFONE]),
    email:            txt(row[COL_LEAD.EMAIL]),
    cidade:           txt(row[COL_LEAD.CIDADE]),
    estado:           txt(row[COL_LEAD.ESTADO]),
    orcamento:        txt(row[COL_LEAD.ORCAMENTO]),
    tempoPreparando:  txt(row[COL_LEAD.TEMPO_PREPARANDO]),
    vestibulares:     txt(row[COL_LEAD.VESTIBULARES]),
    cursoInteresse:   txt(row[COL_LEAD.CURSO_INTERESSE]),
    origem:           txt(row[COL_LEAD.ORIGEM]),
    indicadoPor:      txt(row[COL_LEAD.INDICADO_POR]),
    vendedor:         emailNorm(row[COL_LEAD.VENDEDOR]),
    fase:             txt(row[COL_LEAD.FASE]) || 'Lead',
    anotacoes:        txt(row[COL_LEAD.ANOTACOES]),
    proximaAcao:      txt(row[COL_LEAD.PROXIMA_ACAO]),
    dataProximaAcao:  row[COL_LEAD.DATA_PROXIMA_ACAO] instanceof Date ? Utilities.formatDate(row[COL_LEAD.DATA_PROXIMA_ACAO], Session.getScriptTimeZone(), 'yyyy-MM-dd') : txt(row[COL_LEAD.DATA_PROXIMA_ACAO]),
    dtUltimaAtualizacao: row[COL_LEAD.DT_ULTIMA_ATUALIZACAO] instanceof Date ? row[COL_LEAD.DT_ULTIMA_ATUALIZACAO].toISOString() : txt(row[COL_LEAD.DT_ULTIMA_ATUALIZACAO]),
    idAlunoGerado:    txt(row[COL_LEAD.ID_ALUNO_GERADO]),
    plano:            txt(row[COL_LEAD.PLANO]),
    gcalEventId:      txt(row[COL_LEAD.GCAL_EVENT_ID]),
    dtEntradaFase:    row[COL_LEAD.DT_ENTRADA_FASE] instanceof Date ? row[COL_LEAD.DT_ENTRADA_FASE].toISOString() : txt(row[COL_LEAD.DT_ENTRADA_FASE])
  };
}

// Helper: localiza linha do lead pelo id na BD_Leads
function _acharLinhaLead(idLead) {
  var ssMestre = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ssMestre.getSheetByName(ABA.LEADS);
  if (!aba) return { aba: null, linha: -1 };
  var lastRow = aba.getLastRow();
  if (lastRow < 2) return { aba: aba, linha: -1 };
  var ids = aba.getRange(2, COL_LEAD.ID + 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (txt(ids[i][0]) === txt(idLead)) return { aba: aba, linha: i + 2 };
  }
  return { aba: aba, linha: -1 };
}

// === Handler: criar lead ===
function handleCriarLead(dados) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ssMestre = SpreadsheetApp.getActiveSpreadsheet();
    var aba = ssMestre.getSheetByName(ABA.LEADS);
    if (!aba) return responderJSON({ status: 'erro', mensagem: ABA.LEADS + ' não encontrada' });

    if (!txt(dados.nome) || !txt(dados.telefone))
      return responderJSON({ status: 'erro', mensagem: 'nome e telefone obrigatórios' });

    var idLead = 'lead_' + new Date().getTime() + '_' + Math.floor(Math.random() * 1000);
    var agora = new Date();
    var fase = txt(dados.fase) || 'Lead';
    var vendedor = emailNorm(dados.vendedor);

    var novaLinha = new Array(27).fill('');
    novaLinha[COL_LEAD.ID]                    = idLead;
    novaLinha[COL_LEAD.DT_CADASTRO]           = agora;
    novaLinha[COL_LEAD.NOME]                  = txt(dados.nome);
    novaLinha[COL_LEAD.TIPO_PERFIL]           = txt(dados.tipoPerfil) || 'self';
    novaLinha[COL_LEAD.NOME_RELACIONADO]      = txt(dados.nomeRelacionado);
    novaLinha[COL_LEAD.TELEFONE]              = txt(dados.telefone);
    novaLinha[COL_LEAD.EMAIL]                 = txt(dados.email);
    novaLinha[COL_LEAD.CIDADE]                = txt(dados.cidade);
    novaLinha[COL_LEAD.ESTADO]                = txt(dados.estado);
    novaLinha[COL_LEAD.ORCAMENTO]             = txt(dados.orcamento);
    novaLinha[COL_LEAD.TEMPO_PREPARANDO]      = txt(dados.tempoPreparando);
    novaLinha[COL_LEAD.VESTIBULARES]          = Array.isArray(dados.vestibulares) ? dados.vestibulares.join(',') : txt(dados.vestibulares);
    novaLinha[COL_LEAD.CURSO_INTERESSE]       = txt(dados.cursoInteresse);
    novaLinha[COL_LEAD.ORIGEM]                = txt(dados.origem);
    novaLinha[COL_LEAD.INDICADO_POR]          = txt(dados.indicadoPor);
    novaLinha[COL_LEAD.VENDEDOR]              = vendedor;
    novaLinha[COL_LEAD.FASE]                  = fase;
    novaLinha[COL_LEAD.ANOTACOES]             = txt(dados.anotacoes);
    novaLinha[COL_LEAD.PROXIMA_ACAO]          = txt(dados.proximaAcao);
    novaLinha[COL_LEAD.DATA_PROXIMA_ACAO]     = txt(dados.dataProximaAcao);
    novaLinha[COL_LEAD.DT_ULTIMA_ATUALIZACAO] = agora;
    novaLinha[COL_LEAD.DADOS_TYPEBOT_RAW]     = dados.dadosTypebotRaw ? JSON.stringify(dados.dadosTypebotRaw) : '';
    novaLinha[COL_LEAD.PLANO]                 = txt(dados.plano);
    novaLinha[COL_LEAD.DT_ENTRADA_FASE]       = agora;

    aba.appendRow(novaLinha);
    registrarEventoPipeline(idLead, 'criado', '', fase, emailNorm(dados.porEmail) || vendedor || 'sistema');

    return responderJSON({ status: 'sucesso', idLead: idLead });
  } catch (e) {
    Logger.log('criarLead EXCEPTION: ' + e.message);
    return responderJSON({ status: 'erro', mensagem: e.message });
  } finally { lock.releaseLock(); }
}

// === Handler: editar lead (atualiza qualquer campo exceto fase) ===
function handleEditarLead(dados) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var loc = _acharLinhaLead(dados.idLead);
    if (loc.linha === -1) return responderJSON({ status: 'erro', mensagem: 'lead não encontrado' });

    var aba = loc.aba;
    var matriz = aba.getRange(loc.linha, 1, 1, 27).getValues()[0];

    // Permissões: vendedor não-líder só pode editar lead próprio ou sem dono;
    // se está mexendo em "vendedor", só pode atribuir a si mesmo (ou desatribuir).
    var emailRequisitante = emailNorm(dados.porEmail);
    var ehLiderReq = (emailRequisitante === 'filippe@metodointento.com.br' || emailRequisitante === 'rafael@metodointento.com.br');
    if (!ehLiderReq) {
      var donoAtual = emailNorm(matriz[COL_LEAD.VENDEDOR]);
      if (donoAtual && donoAtual !== emailRequisitante) {
        return responderJSON({ status: 'erro', codigo: 403, mensagem: 'sem permissão pra editar lead de outro vendedor' });
      }
      if (typeof dados.vendedor !== 'undefined') {
        var novoVendedor = emailNorm(dados.vendedor);
        if (novoVendedor && novoVendedor !== emailRequisitante) {
          return responderJSON({ status: 'erro', codigo: 403, mensagem: 'vendedor só pode atribuir lead a si mesmo' });
        }
      }
    }

    // Atualiza só os campos que vieram (preserva fase via handler dedicado)
    var camposEditaveis = {
      nome: COL_LEAD.NOME,
      tipoPerfil: COL_LEAD.TIPO_PERFIL,
      nomeRelacionado: COL_LEAD.NOME_RELACIONADO,
      telefone: COL_LEAD.TELEFONE,
      email: COL_LEAD.EMAIL,
      cidade: COL_LEAD.CIDADE,
      estado: COL_LEAD.ESTADO,
      orcamento: COL_LEAD.ORCAMENTO,
      tempoPreparando: COL_LEAD.TEMPO_PREPARANDO,
      vestibulares: COL_LEAD.VESTIBULARES,
      cursoInteresse: COL_LEAD.CURSO_INTERESSE,
      origem: COL_LEAD.ORIGEM,
      indicadoPor: COL_LEAD.INDICADO_POR,
      vendedor: COL_LEAD.VENDEDOR,
      anotacoes: COL_LEAD.ANOTACOES,
      proximaAcao: COL_LEAD.PROXIMA_ACAO,
      dataProximaAcao: COL_LEAD.DATA_PROXIMA_ACAO,
      plano: COL_LEAD.PLANO,
      gcalEventId: COL_LEAD.GCAL_EVENT_ID,
      outcomeReuniao: COL_LEAD.OUTCOME_REUNIAO
    };
    Object.keys(camposEditaveis).forEach(function(k) {
      if (typeof dados[k] !== 'undefined') {
        var v = dados[k];
        if (k === 'vestibulares' && Array.isArray(v)) v = v.join(',');
        if (k === 'vendedor') v = emailNorm(v);
        else v = txt(v);
        matriz[camposEditaveis[k]] = v;
      }
    });
    matriz[COL_LEAD.DT_ULTIMA_ATUALIZACAO] = new Date();

    aba.getRange(loc.linha, 1, 1, 27).setValues([matriz]);
    registrarEventoPipeline(dados.idLead, 'editado', '', '', emailNorm(dados.porEmail) || '');

    return responderJSON({ status: 'sucesso' });
  } catch (e) {
    Logger.log('editarLead EXCEPTION: ' + e.message);
    return responderJSON({ status: 'erro', mensagem: e.message });
  } finally { lock.releaseLock(); }
}

// === Handler: mover fase (audita) ===
function handleMoverLeadFase(dados) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var loc = _acharLinhaLead(dados.idLead);
    if (loc.linha === -1) return responderJSON({ status: 'erro', mensagem: 'lead não encontrado' });

    var novaFase = txt(dados.novaFase);
    if (FASES_LEAD.indexOf(novaFase) === -1)
      return responderJSON({ status: 'erro', mensagem: 'fase inválida: ' + novaFase });

    // Permissões: vendedor não-líder só pode mover lead próprio ou sem dono.
    var emailRequisitanteMv = emailNorm(dados.porEmail);
    var ehLiderMv = (emailRequisitanteMv === 'filippe@metodointento.com.br' || emailRequisitanteMv === 'rafael@metodointento.com.br');
    if (!ehLiderMv) {
      var donoAtualMv = emailNorm(loc.aba.getRange(loc.linha, COL_LEAD.VENDEDOR + 1).getValue());
      if (donoAtualMv && donoAtualMv !== emailRequisitanteMv) {
        return responderJSON({ status: 'erro', codigo: 403, mensagem: 'sem permissão pra mover lead de outro vendedor' });
      }
    }

    var faseAtual = txt(loc.aba.getRange(loc.linha, COL_LEAD.FASE + 1).getValue());
    var agoraFase = new Date();
    loc.aba.getRange(loc.linha, COL_LEAD.FASE + 1).setValue(novaFase);
    loc.aba.getRange(loc.linha, COL_LEAD.DT_ULTIMA_ATUALIZACAO + 1).setValue(agoraFase);
    loc.aba.getRange(loc.linha, COL_LEAD.DT_ENTRADA_FASE + 1).setValue(agoraFase);

    registrarEventoPipeline(dados.idLead, 'fase', faseAtual, novaFase, emailNorm(dados.porEmail) || '');

    return responderJSON({ status: 'sucesso', faseAnterior: faseAtual, faseNova: novaFase });
  } catch (e) {
    Logger.log('moverLeadFase EXCEPTION: ' + e.message);
    return responderJSON({ status: 'erro', mensagem: e.message });
  } finally { lock.releaseLock(); }
}

// === Handler: listar leads (filtra por vendedor logado, ou todos se líder) ===
function handleListarLeads(dados) {
  try {
    var emailRequisitante = emailNorm(dados.email);
    if (!emailRequisitante) return responderJSON({ status: 'erro', mensagem: 'email obrigatório' });

    var ssMestre = SpreadsheetApp.getActiveSpreadsheet();
    var aba = ssMestre.getSheetByName(ABA.LEADS);
    if (!aba) return responderJSON({ status: 'sucesso', leads: [] });
    var lastRow = aba.getLastRow();
    if (lastRow < 2) return responderJSON({ status: 'sucesso', leads: [] });

    var matriz = aba.getRange(2, 1, lastRow - 1, 27).getValues();

    // Permissões: filippe + rafael veem tudo; vendedor vê os seus + leads sem dono
    // (fila pública pra auto-atribuição — pegar lead da fila)
    var ehLider = (emailRequisitante === 'filippe@metodointento.com.br' || emailRequisitante === 'rafael@metodointento.com.br');
    var leads = [];
    for (var i = 0; i < matriz.length; i++) {
      var row = matriz[i];
      if (!txt(row[COL_LEAD.ID])) continue;
      if (!ehLider) {
        var donoLead = emailNorm(row[COL_LEAD.VENDEDOR]);
        if (donoLead && donoLead !== emailRequisitante) continue;
      }
      leads.push(_leadToObj(row));
    }

    // Lista também os vendedores ativos (pra filtros e dropdown de atribuição)
    var vendedores = lerVendedoresAtivos();
    var listaVendedores = Object.keys(vendedores).map(function(em) {
      return { email: em, nome: vendedores[em].nome };
    }).sort(function(a, b) { return a.nome.localeCompare(b.nome); });

    return responderJSON({
      status: 'sucesso',
      leads: leads,
      vendedores: listaVendedores,
      fases: FASES_LEAD,
      ehLider: ehLider
    });
  } catch (e) {
    Logger.log('listarLeads EXCEPTION: ' + e.message);
    return responderJSON({ status: 'erro', mensagem: e.message });
  }
}

// === Handler: dashboard CRM (KPIs agregados — só pra líder) ===
function handleDashboardCrm(dados) {
  try {
    var emailRequisitante = emailNorm(dados.email);
    var ehLider = (emailRequisitante === 'filippe@metodointento.com.br' || emailRequisitante === 'rafael@metodointento.com.br');
    if (!ehLider) return responderJSON({ status: 'erro', codigo: 403, mensagem: 'apenas líderes' });

    var ssMestre = SpreadsheetApp.getActiveSpreadsheet();
    var aba = ssMestre.getSheetByName(ABA.LEADS);
    if (!aba) return responderJSON({ status: 'sucesso', total: 0 });
    var lastRow = aba.getLastRow();
    if (lastRow < 2) return responderJSON({ status: 'sucesso', total: 0 });
    var matriz = aba.getRange(2, 1, lastRow - 1, 27).getValues();

    var porFase = {};
    var porVendedor = {};
    var porOrigem = {};
    FASES_LEAD.forEach(function(f) { porFase[f] = 0; });

    for (var i = 0; i < matriz.length; i++) {
      var row = matriz[i];
      if (!txt(row[COL_LEAD.ID])) continue;
      var fase = txt(row[COL_LEAD.FASE]) || 'Lead';
      porFase[fase] = (porFase[fase] || 0) + 1;
      var vd = emailNorm(row[COL_LEAD.VENDEDOR]) || 'sem-vendedor';
      porVendedor[vd] = (porVendedor[vd] || 0) + 1;
      var og = txt(row[COL_LEAD.ORIGEM]) || 'desconhecida';
      porOrigem[og] = (porOrigem[og] || 0) + 1;
    }

    return responderJSON({
      status: 'sucesso',
      total: matriz.length,
      porFase: porFase,
      porVendedor: porVendedor,
      porOrigem: porOrigem
    });
  } catch (e) {
    Logger.log('dashboardCrm EXCEPTION: ' + e.message);
    return responderJSON({ status: 'erro', mensagem: e.message });
  }
}

// === Handler: converter lead em aluno (cria spreadsheet + linha na mestre) ===
function handleConverterLeadEmAluno(dados) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var loc = _acharLinhaLead(dados.idLead);
    if (loc.linha === -1) return responderJSON({ status: 'erro', mensagem: 'lead não encontrado' });

    var matriz = loc.aba.getRange(loc.linha, 1, 1, 27).getValues()[0];
    var lead = _leadToObj(matriz);

    if (lead.idAlunoGerado) return responderJSON({ status: 'erro', mensagem: 'lead já convertido em aluno: ' + lead.idAlunoGerado });

    // Cria entrada na BD_Alunos com dados do lead
    var ssMestre = SpreadsheetApp.getActiveSpreadsheet();
    var abaAlunos = ssMestre.getSheetByName(ABA.MESTRE);
    if (!abaAlunos) return responderJSON({ status: 'erro', mensagem: 'BD_Alunos não encontrada' });

    // Cria spreadsheet individual do aluno (mesma estrutura do handleOnboarding)
    var nomePlanilha = 'Aluno · ' + lead.nome;
    var novaPlanilha = SpreadsheetApp.create(nomePlanilha);
    var idNovaPlanilha = novaPlanilha.getId();

    // Linha na mestre (28 cols)
    var linhaMestre = new Array(28).fill('');
    linhaMestre[COL_MESTRE.TIMESTAMP]         = new Date();
    linhaMestre[COL_MESTRE.NOME]              = lead.nome;
    linhaMestre[COL_MESTRE.EMAIL]             = lead.email;
    linhaMestre[COL_MESTRE.TELEFONE]          = lead.telefone;
    linhaMestre[COL_MESTRE.CIDADE]            = lead.cidade;
    linhaMestre[COL_MESTRE.ESTADO]            = lead.estado;
    linhaMestre[COL_MESTRE.CURSO_INTERESSE]   = lead.cursoInteresse;
    linhaMestre[COL_MESTRE.PROVAS_INTERESSE]  = lead.vestibulares;
    linhaMestre[COL_MESTRE.ID_PLANILHA]       = idNovaPlanilha;
    linhaMestre[COL_MESTRE.STATUS_ONBOARDING] = 'Aguardando Diagnóstico';
    linhaMestre[COL_MESTRE.PLANO]             = lead.plano || '';
    linhaMestre[COL_MESTRE.TIPO_ALUNO]        = 'ENEM';
    abaAlunos.appendRow(linhaMestre);

    // Marca o lead como convertido
    var agoraConv = new Date();
    loc.aba.getRange(loc.linha, COL_LEAD.ID_ALUNO_GERADO + 1).setValue(idNovaPlanilha);
    loc.aba.getRange(loc.linha, COL_LEAD.FASE + 1).setValue('Em mentoria');
    loc.aba.getRange(loc.linha, COL_LEAD.DT_ULTIMA_ATUALIZACAO + 1).setValue(agoraConv);
    loc.aba.getRange(loc.linha, COL_LEAD.DT_ENTRADA_FASE + 1).setValue(agoraConv);

    registrarEventoPipeline(lead.idLead, 'convertido_em_aluno', lead.fase, 'Em mentoria', emailNorm(dados.porEmail) || lead.vendedor);

    // Notifica líder (pra designar mentor)
    try { _notificarLiderAlunoAguardando(lead.nome); } catch (e) {}

    return responderJSON({
      status: 'sucesso',
      idPlanilhaAluno: idNovaPlanilha,
      nomeAluno: lead.nome
    });
  } catch (e) {
    Logger.log('converterLeadEmAluno EXCEPTION: ' + e.message);
    return responderJSON({ status: 'erro', mensagem: e.message });
  } finally { lock.releaseLock(); }
}


// =====================================================================
// BACKUP DIÁRIO DA MESTRE
// =====================================================================

// One-shot: migra leads em fase 'No-show' pra fase 'Reuniao agendada' + outcome 'no-show'.
// Rodar manualmente no editor do Apps Script após adicionar a coluna outcome_reuniao.
function migrarFaseNoShowParaOutcome() {
  var ssMestre = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ssMestre.getSheetByName(ABA.LEADS);
  if (!aba) { Logger.log('BD_Leads não encontrada'); return; }
  var lastRow = aba.getLastRow();
  if (lastRow < 2) { Logger.log('aba vazia'); return; }
  var matriz = aba.getRange(2, 1, lastRow - 1, 27).getValues();
  var contador = 0;
  for (var i = 0; i < matriz.length; i++) {
    if (txt(matriz[i][COL_LEAD.FASE]) === 'No-show') {
      matriz[i][COL_LEAD.FASE] = 'Reuniao agendada';
      matriz[i][COL_LEAD.OUTCOME_REUNIAO] = 'no-show';
      contador++;
    }
  }
  if (contador > 0) aba.getRange(2, 1, lastRow - 1, 27).setValues(matriz);
  Logger.log('Migrados ' + contador + ' leads de fase=No-show → fase=Reuniao agendada + outcome=no-show');
}

// One-shot: migra leads em fase 'Aguardando decisao' pra 'Reuniao realizada'.
// Rodar manualmente no editor do Apps Script após atualizar FASES_LEAD.
function migrarAguardandoDecisaoParaReuniaoRealizada() {
  var ssMestre = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ssMestre.getSheetByName(ABA.LEADS);
  if (!aba) { Logger.log('BD_Leads não encontrada'); return; }
  var lastRow = aba.getLastRow();
  if (lastRow < 2) { Logger.log('aba vazia'); return; }
  var range = aba.getRange(2, COL_LEAD.FASE + 1, lastRow - 1, 1);
  var valores = range.getValues();
  var contador = 0;
  for (var i = 0; i < valores.length; i++) {
    if (txt(valores[i][0]) === 'Aguardando decisao') {
      valores[i][0] = 'Reuniao realizada';
      contador++;
    }
  }
  if (contador > 0) range.setValues(valores);
  Logger.log('Migrados ' + contador + ' leads de Aguardando decisao → Reuniao realizada');
}

// One-shot idempotente: adiciona colunas tipo_aluno/turma/escola/fase em BD_Alunos
// e backfilla tipo_aluno='ENEM' em linhas existentes onde estiver vazio.
// Rodar manualmente no editor do Apps Script após deploy do fac-símile EM.
function migrarBDAlunosFacSimile() {
  var ssMestre = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ssMestre.getSheetByName(ABA.MESTRE);
  if (!aba) { Logger.log('BD_Alunos não encontrada'); return; }

  var headersEsperados = ['tipo_aluno', 'turma', 'escola', 'fase'];
  var lastCol = aba.getLastColumn();
  var headerRange = aba.getRange(1, 1, 1, lastCol);
  var headers = headerRange.getValues()[0].map(function(h) { return String(h || '').trim().toLowerCase(); });

  // 1. Adiciona colunas faltantes
  var headersAdicionados = 0;
  for (var k = 0; k < headersEsperados.length; k++) {
    var nome = headersEsperados[k];
    if (headers.indexOf(nome) === -1) {
      lastCol++;
      aba.getRange(1, lastCol).setValue(nome);
      headers.push(nome);
      headersAdicionados++;
    }
  }
  Logger.log('Headers adicionados: ' + headersAdicionados);

  // 2. Backfill tipo_aluno='ENEM' onde vazio
  var lastRow = aba.getLastRow();
  if (lastRow < 2) { Logger.log('Sem linhas de dados; só headers atualizados.'); return; }

  var colTipo = COL_MESTRE.TIPO_ALUNO + 1; // 1-indexed pra Range
  var range = aba.getRange(2, colTipo, lastRow - 1, 1);
  var valores = range.getValues();
  var backfilled = 0;
  for (var i = 0; i < valores.length; i++) {
    if (!txt(valores[i][0])) {
      valores[i][0] = 'ENEM';
      backfilled++;
    }
  }
  if (backfilled > 0) range.setValues(valores);
  Logger.log('Backfill tipo_aluno=ENEM: ' + backfilled + ' linhas atualizadas (de ' + valores.length + ' totais)');
}

// One-shot: preenche colunas vazias da BD_Alunos a partir do BD_Onboarding de
// cada aluno. Resolve o bug histórico onde handleOnboarding só persistia 7 dos
// ~20 campos na mestre. Idempotente: nunca sobrescreve valor existente.
//
// dryRun=true (default) só loga o que faria. Passe false pra gravar.
function backfillBDMestreFromOnboarding(dryRun) {
  if (dryRun !== false) dryRun = true;
  Logger.log('===== BACKFILL BD_Alunos ← BD_Onboarding ' + (dryRun ? '(DRY-RUN)' : '(GRAVANDO)') + ' =====');

  var ssMestre = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ssMestre.getSheetByName(ABA.MESTRE);
  if (!aba) { Logger.log('BD_Alunos não encontrada'); return; }

  var lastRow = aba.getLastRow();
  if (lastRow < 2) { Logger.log('Sem linhas de dados.'); return; }

  // Mapa COL_MESTRE → COL_BD_ONB. Só campos que existem nos dois lados.
  var mapa = [
    { mestre: COL_MESTRE.DATA_NASCIMENTO,        onb: COL_BD_ONB.DATA_NASCIMENTO,        norm: 'data' },
    { mestre: COL_MESTRE.RESPONSAVEL_FINANCEIRO, onb: COL_BD_ONB.RESPONSAVEL_FINANCEIRO },
    { mestre: COL_MESTRE.CIDADE,                 onb: COL_BD_ONB.CIDADE },
    { mestre: COL_MESTRE.ESTADO,                 onb: COL_BD_ONB.ESTADO },
    { mestre: COL_MESTRE.ESCOLARIDADE,           onb: COL_BD_ONB.ESCOLARIDADE },
    { mestre: COL_MESTRE.ORIGEM_ENSINO_MEDIO,    onb: COL_BD_ONB.ORIGEM_ENSINO_MEDIO },
    { mestre: COL_MESTRE.COTA,                   onb: COL_BD_ONB.COTA },
    { mestre: COL_MESTRE.FEZ_ENEM_ANTES,         onb: COL_BD_ONB.FEZ_ENEM_ANTES },
    { mestre: COL_MESTRE.PROVAS_INTERESSE,       onb: COL_BD_ONB.PROVAS_INTERESSE },
    { mestre: COL_MESTRE.CURSO_INTERESSE,        onb: COL_BD_ONB.CURSO_INTERESSE },
    { mestre: COL_MESTRE.PLATAFORMA_ONLINE,      onb: COL_BD_ONB.PLATAFORMA_ONLINE },
    { mestre: COL_MESTRE.NOTA_LINGUAGENS,        onb: COL_BD_ONB.NOTA_LG },
    { mestre: COL_MESTRE.NOTA_HUMANAS,           onb: COL_BD_ONB.NOTA_CH },
    { mestre: COL_MESTRE.NOTA_NATUREZA,          onb: COL_BD_ONB.NOTA_CN },
    { mestre: COL_MESTRE.NOTA_MATEMATICA,        onb: COL_BD_ONB.NOTA_MAT },
    { mestre: COL_MESTRE.NOTA_REDACAO,           onb: COL_BD_ONB.NOTA_REDACAO }
  ];

  // Defesa: se algum mestre/onb estiver undefined, falha alto antes de gravar lixo.
  for (var d = 0; d < mapa.length; d++) {
    if (typeof mapa[d].mestre !== 'number' || typeof mapa[d].onb !== 'number') {
      throw new Error('Mapa inválido no índice ' + d + ': mestre=' + mapa[d].mestre + ' onb=' + mapa[d].onb);
    }
  }

  var matriz = aba.getRange(2, 1, lastRow - 1, aba.getLastColumn()).getValues();
  var totalAlunos = 0, alunosAtualizados = 0, semPlanilha = 0, semOnboarding = 0, erros = 0;
  var celulasPreenchidas = 0;
  var contadorPorCampo = {};

  for (var i = 0; i < matriz.length; i++) {
    var linhaIdx = i + 2; // 1-indexed pro Sheets
    var idPlanilha = txt(matriz[i][COL_MESTRE.ID_PLANILHA]);
    if (!idPlanilha) { semPlanilha++; continue; }
    totalAlunos++;

    // Verifica se essa linha tem ALGUM campo vazio que poderíamos preencher
    var camposVazios = mapa.filter(function(m) { return !txt(matriz[i][m.mestre]); });
    if (camposVazios.length === 0) continue;

    try {
      var ssAluno = SpreadsheetApp.openById(idPlanilha);
      var abaOnb = ssAluno.getSheetByName(ABA.ONBOARDING);
      if (!abaOnb || abaOnb.getLastRow() < 2) { semOnboarding++; continue; }
      var linhaOnb = abaOnb.getRange(2, 1, 1, abaOnb.getLastColumn()).getValues()[0];

      var atualizouAlguma = false;
      for (var k = 0; k < camposVazios.length; k++) {
        var m = camposVazios[k];
        var valorOnb = linhaOnb[m.onb];
        var valorTxt = (m.norm === 'data') ? normalizarData(valorOnb) : txt(valorOnb);
        if (!valorTxt) continue;

        if (!dryRun) {
          aba.getRange(linhaIdx, m.mestre + 1).setValue(valorTxt);
        }
        celulasPreenchidas++;
        contadorPorCampo[m.mestre] = (contadorPorCampo[m.mestre] || 0) + 1;
        atualizouAlguma = true;
      }
      if (atualizouAlguma) alunosAtualizados++;
    } catch (e) {
      erros++;
      Logger.log('  ✗ linha ' + linhaIdx + ' (id=' + idPlanilha + '): ' + e.message);
    }
  }

  Logger.log('--- Resumo ---');
  Logger.log('Total de alunos com ID_PLANILHA: ' + totalAlunos);
  Logger.log('Alunos atualizados: ' + alunosAtualizados);
  Logger.log('Células preenchidas: ' + celulasPreenchidas);
  Logger.log('Sem ID_PLANILHA (skip): ' + semPlanilha);
  Logger.log('Sem aba BD_Onboarding (skip): ' + semOnboarding);
  Logger.log('Erros: ' + erros);
  Logger.log('--- Detalhe por campo ---');
  Object.keys(contadorPorCampo).forEach(function(col) {
    Logger.log('  COL_MESTRE[' + col + ']: ' + contadorPorCampo[col]);
  });
  if (dryRun) Logger.log('>>> DRY-RUN: nada gravado. Rodar `backfillBDMestreFromOnboardingApply` pra aplicar.');
}

// Wrapper sem argumento pra rodar via botão "Run" do editor do Apps Script,
// que não permite passar parâmetros. Aplica de fato (dryRun=false).
function backfillBDMestreFromOnboardingApply() {
  backfillBDMestreFromOnboarding(false);
}

// One-shot idempotente: cria aba BD_Avaliacoes com headers se não existir;
// adiciona headers faltantes (ex: substitui_id) em deploys posteriores.
// Rodar manualmente no editor do Apps Script após cada deploy que mexa no schema.
function migrarBDAvaliacoesFacSimile() {
  var ssMestre = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ssMestre.getSheetByName(ABA.AVALIACOES);
  var headers = ['id', 'id_aluno', 'data', 'materia', 'tipo', 'observacao', 'nota', 'criado_por', 'criado_em', 'substitui_id'];

  if (!aba) {
    aba = ssMestre.insertSheet(ABA.AVALIACOES);
    aba.appendRow(headers);
    aba.setFrozenRows(1);
    Logger.log('Aba ' + ABA.AVALIACOES + ' criada com ' + headers.length + ' headers');
    return;
  }

  // Aba já existe — verifica e adiciona headers faltantes ao final
  var lastCol = aba.getLastColumn();
  if (lastCol === 0) {
    aba.appendRow(headers);
    aba.setFrozenRows(1);
    Logger.log('Aba ' + ABA.AVALIACOES + ' existia vazia; headers adicionados');
    return;
  }
  var headerAtual = aba.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function(h) { return String(h || '').trim().toLowerCase(); });
  var adicionados = 0;
  for (var k = 0; k < headers.length; k++) {
    if (headerAtual.indexOf(headers[k]) === -1) {
      lastCol++;
      aba.getRange(1, lastCol).setValue(headers[k]);
      headerAtual.push(headers[k]);
      adicionados++;
    }
  }
  if (adicionados > 0) {
    Logger.log('Aba ' + ABA.AVALIACOES + ': ' + adicionados + ' header(s) adicionado(s) ao final');
  } else {
    Logger.log('Aba ' + ABA.AVALIACOES + ' já existe com headers corretos. Nada a fazer.');
  }
}

function backupDiarioMestre() {
  Logger.log('===== BACKUP DIÁRIO MESTRE =====');
  try {
    var ssMestre = SpreadsheetApp.getActiveSpreadsheet();
    var fileMestre = DriveApp.getFileById(ssMestre.getId());
    var folder = DriveApp.getFolderById(FOLDER_BACKUPS_ID);
    var dataStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HH-mm');
    var nome = 'Backup_Mestre_' + dataStr;
    fileMestre.makeCopy(nome, folder);
    Logger.log('✓ backup criado: ' + nome);

    // Mantém só os últimos 30 backups
    var arquivos = folder.getFilesByType(MimeType.GOOGLE_SHEETS);
    var lista = [];
    while (arquivos.hasNext()) {
      var f = arquivos.next();
      if (f.getName().indexOf('Backup_Mestre_') === 0) {
        lista.push({ file: f, date: f.getDateCreated() });
      }
    }
    lista.sort(function(a, b) { return b.date - a.date; });
    var apagados = 0;
    for (var i = 30; i < lista.length; i++) {
      lista[i].file.setTrashed(true);
      apagados++;
    }
    Logger.log('total backups: ' + lista.length + ' · apagados: ' + apagados);
  } catch (e) {
    Logger.log('backupDiarioMestre EXCEPTION: ' + e.message);
  }
}

// Util: instala trigger diário pra rodar backup às 3h da manhã (rode 1×)
function instalarTriggerBackup() {
  var existentes = ScriptApp.getProjectTriggers();
  existentes.forEach(function(t) {
    if (t.getHandlerFunction() === 'backupDiarioMestre') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('backupDiarioMestre').timeBased().everyDays(1).atHour(3).create();
  Logger.log('✓ trigger backupDiarioMestre instalado — diariamente às 3h');
}


// =====================================================================
// SCRIPT ONE-SHOT — recalcula DOMINIO_TOTAL e PROGRESSO_TOTAL de
// todos os registros antigos, alinhando com a nova regra do modal:
// disciplinas com valor 0 ("sem informação") ficam fora da média.
//
// Como rodar:
//   1) recalcularTotaisDeRegistros(true)   ← DRY RUN — só loga as mudanças
//   2) Confere os logs (Ver → Logs)
//   3) Se OK, rodar de novo passando false:
//      recalcularTotaisDeRegistros(false)  ← APLICA as mudanças
//
// É idempotente: rodar 2x com false não muda nada da segunda vez.
// =====================================================================
function recalcularTotaisDeRegistros(dryRun) {
  if (dryRun === undefined) dryRun = true;
  Logger.log('==== recalcularTotaisDeRegistros (dryRun=' + dryRun + ') ====');

  const ssMestre    = SpreadsheetApp.getActiveSpreadsheet();
  const sheetMestre = ssMestre.getSheetByName(ABA.MESTRE);
  if (!sheetMestre) { Logger.log('BD_Mestre não encontrada'); return; }

  const dataMatriz = sheetMestre.getDataRange().getValues();
  let totalAlunos = 0, alunosErro = 0, totalRegistros = 0, totalAlterados = 0;

  for (let i = 1; i < dataMatriz.length; i++) {
    const idPlanilha = dataMatriz[i][COL_MESTRE.ID_PLANILHA];
    const nomeAluno  = dataMatriz[i][COL_MESTRE.NOME];
    if (!idPlanilha) continue;
    totalAlunos++;

    try {
      const ss = SpreadsheetApp.openById(idPlanilha);
      const aba = ss.getSheetByName(ABA.REGISTROS);
      if (!aba) { Logger.log('  [' + nomeAluno + '] sem aba BD_Registro'); continue; }

      const matriz = aba.getDataRange().getValues();
      const updates = [];

      for (let r = 1; r < matriz.length; r++) {
        const row = matriz[r];
        if (!row[COL_REG.SEMANA]) continue;
        totalRegistros++;

        const doms  = [num(row[COL_REG.DOM_BIO]),  num(row[COL_REG.DOM_QUI]),  num(row[COL_REG.DOM_FIS]),  num(row[COL_REG.DOM_MAT])];
        const progs = [num(row[COL_REG.PROG_BIO]), num(row[COL_REG.PROG_QUI]), num(row[COL_REG.PROG_FIS]), num(row[COL_REG.PROG_MAT])];

        const domsValidos  = doms.filter(function(v) { return v > 0; });
        const progsValidos = progs.filter(function(v) { return v > 0; });

        const novoDomTot  = domsValidos.length  > 0 ? Math.round((domsValidos.reduce(function(a,b){return a+b;},0)  / domsValidos.length)  * 100) / 100 : '';
        const novoProgTot = progsValidos.length > 0 ? Math.round((progsValidos.reduce(function(a,b){return a+b;},0) / progsValidos.length) * 100) / 100 : '';

        const atualDomTot  = num(row[COL_REG.DOMINIO_TOTAL]);
        const atualProgTot = num(row[COL_REG.PROGRESSO_TOTAL]);

        const eps = 0.01;
        const mudouDom  = (novoDomTot  === '' && row[COL_REG.DOMINIO_TOTAL]   !== '') || (novoDomTot  !== '' && Math.abs(atualDomTot  - novoDomTot)  > eps);
        const mudouProg = (novoProgTot === '' && row[COL_REG.PROGRESSO_TOTAL] !== '') || (novoProgTot !== '' && Math.abs(atualProgTot - novoProgTot) > eps);

        if (mudouDom || mudouProg) {
          totalAlterados++;
          Logger.log('  [' + nomeAluno + '] semana ' + row[COL_REG.SEMANA] +
            ' | dom: '  + atualDomTot  + ' → ' + novoDomTot  +
            ' | prog: ' + atualProgTot + ' → ' + novoProgTot);
          updates.push({ linha: r + 1, novoDomTot: novoDomTot, novoProgTot: novoProgTot });
        }
      }

      if (!dryRun && updates.length > 0) {
        for (let u = 0; u < updates.length; u++) {
          aba.getRange(updates[u].linha, COL_REG.DOMINIO_TOTAL   + 1).setValue(updates[u].novoDomTot);
          aba.getRange(updates[u].linha, COL_REG.PROGRESSO_TOTAL + 1).setValue(updates[u].novoProgTot);
        }
      }
    } catch (e) {
      alunosErro++;
      Logger.log('  [' + nomeAluno + '] ERRO: ' + e.message);
    }
  }

  Logger.log('---- RESUMO ----');
  Logger.log('Alunos varridos: ' + totalAlunos + ' (' + alunosErro + ' com erro)');
  Logger.log('Registros varridos: ' + totalRegistros);
  Logger.log('Registros com mudança: ' + totalAlterados);
  Logger.log(dryRun ? '*** DRY RUN — nenhuma escrita feita ***' : '*** ESCRITAS APLICADAS ***');
}


// =====================================================================
// SCRIPT ONE-SHOT — adiciona o cabeçalho "Notas Privadas" na coluna 18
// (R) de BD_Diario em todas as planilhas dos alunos. Não é obrigatório
// pro funcionamento (sistema lê por índice), mas deixa a planilha legível.
// Idempotente — rodar 2x não duplica.
// =====================================================================
function adicionarCabecalhoNotasPrivadas() {
  const ssMestre    = SpreadsheetApp.getActiveSpreadsheet();
  const sheetMestre = ssMestre.getSheetByName(ABA.MESTRE);
  if (!sheetMestre) { Logger.log('BD_Mestre não encontrada'); return; }

  const dataMatriz = sheetMestre.getDataRange().getValues();
  let total = 0, alterados = 0, jaTinha = 0, erro = 0;

  for (let i = 1; i < dataMatriz.length; i++) {
    const idPlanilha = dataMatriz[i][COL_MESTRE.ID_PLANILHA];
    const nome       = dataMatriz[i][COL_MESTRE.NOME];
    if (!idPlanilha) continue;
    total++;
    try {
      const aba = SpreadsheetApp.openById(idPlanilha).getSheetByName(ABA.ENCONTROS);
      if (!aba) { Logger.log('  [' + nome + '] sem aba BD_Diario'); continue; }
      const cabecalhoAtual = txt(aba.getRange(1, COL_ENC.NOTAS_PRIVADAS + 1).getValue());
      if (cabecalhoAtual === 'Notas Privadas') { jaTinha++; continue; }
      aba.getRange(1, COL_ENC.NOTAS_PRIVADAS + 1).setValue('Notas Privadas');
      alterados++;
      Logger.log('  [' + nome + '] cabeçalho adicionado');
    } catch (e) { erro++; Logger.log('  [' + nome + '] ERRO: ' + e.message); }
  }
  Logger.log('---- RESUMO ----');
  Logger.log('Planilhas varridas: ' + total + ' (' + erro + ' com erro)');
  Logger.log('Cabeçalho adicionado: ' + alterados);
  Logger.log('Já tinha: ' + jaTinha);
}
