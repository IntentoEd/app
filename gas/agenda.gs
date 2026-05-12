// =====================================================================
// AGENDA — Disponibilidade do vendedor + integração com Google Calendar
// =====================================================================
// Domínio: Rafa (CRM/comercial). Tudo de horários padrão, exceções de
// disponibilidade, listagem de vendedores ativos pra atendimento, e
// cálculo de carga (round-robin). A camada de Google Calendar mora no
// Next em /api/agenda/* (lib/googleCalendar.js); aqui é só o estado
// armazenado em BD_Vendedores e BD_Disponibilidade_Excecoes.
//
// Constantes globais (COL_VENDEDOR, COL_EXCECAO) permanecem em Code.gs.


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
