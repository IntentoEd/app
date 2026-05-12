// =====================================================================
// CRM — Leads, Pipeline, Conversão em Aluno
// =====================================================================
// Domínio: Rafa (CRM/comercial). Tudo de Lead/Pipeline/Eventos_Pipeline
// + conversão Lead → Aluno mora aqui. Apps Script junta todos os .gs em
// namespace global, então funções daqui podem chamar helpers/constantes
// definidas em Code.gs (txt, emailNorm, COL_LEAD, FASES_LEAD, ABA, etc.)
// e vice-versa.
//
// Constantes globais (COL_LEAD, COL_EVENTO, FASES_LEAD, OUTCOMES_REUNIAO)
// permanecem em Code.gs por design — são vocabulário compartilhado entre
// CRM e o resto do sistema (ex: handleConverterLeadEmAluno escreve em
// BD_Alunos via COL_MESTRE).


// =====================================================================
// HELPERS INTERNOS DE LEAD
// =====================================================================

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


// =====================================================================
// HANDLERS DE LEITURA
// =====================================================================

// === Handler: lista leads (filtra por vendedor logado, ou todos se líder) ===
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


// =====================================================================
// HANDLERS DE ESCRITA
// =====================================================================

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


// =====================================================================
// MIGRATIONS ONE-SHOT (legacy, mantidas pra audit)
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
