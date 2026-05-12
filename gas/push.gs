// =====================================================================
// PUSH NOTIFICATIONS — subscriptions + crons + helpers
// =====================================================================
// Domínio: compartilhado (afeta aluno + mentor + líder).
// Cobre 3 handlers (subscribe/unsubscribe/listar), helper _enviarPush
// (chama /api/push/send no Next via UrlFetchApp), 3 crons semanais e
// 1 disparo imediato (_notificarLiderAlunoAguardando).
//
// Triggers do GAS apontam por NOME — manter exatamente os mesmos nomes
// em cronLembreteAluno, cronLembreteMentor, cronAlertaLiderMentoresFaltantes.
//
// Constante COL_PUSH permanece em Code.gs.


// =====================================================================
// HANDLERS — subscriptions
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
// CRON JOBS E DISPAROS AUTOMÁTICOS
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
