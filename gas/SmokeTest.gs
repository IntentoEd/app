/**
 * Smoke test manual — rodar no editor GAS (Run → smokeTest)
 * após cada `clasp push`. Valida apenas LEITURAS — writes são
 * testadas manualmente na UI pra não sujar dados.
 */

const SMOKE_EMAIL_LIDER = 'filippe@metodointento.com.br';
const SMOKE_EMAIL_NAO_AUTH = 'teste.nao.autorizado@example.com';

function smokeTest() {
  Logger.log('===== SMOKE TEST =====');
  var ok = 0, ko = 0, sk = 0;

  function check(nome, fn) {
    try {
      var r = fn();
      if (r === true) { Logger.log('✓ ' + nome); ok++; return; }
      if (typeof r === 'string' && r.indexOf('SKIP') >= 0) {
        Logger.log('⏭ ' + nome + ' — ' + r);
        sk++; return;
      }
      Logger.log('✗ ' + nome + ' — ' + r); ko++;
    } catch (e) {
      Logger.log('✗ ' + nome + ' — EXCEPTION: ' + e.message);
      ko++;
    }
  }

  // 1) handleLoginGlobal com email do líder
  check('handleLoginGlobal(filippe) retorna rota', function() {
    var data = JSON.parse(handleLoginGlobal({ email: SMOKE_EMAIL_LIDER }).getContent());
    if (!data.rota) return 'rota ausente: ' + JSON.stringify(data);
    Logger.log('  → rota=' + data.rota + ' perfil=' + data.perfil);
    return true;
  });

  // 2) handleListaAlunosMentor retorna array
  check('handleListaAlunosMentor retorna { alunos: [...] }', function() {
    var data = JSON.parse(handleListaAlunosMentor({ email: SMOKE_EMAIL_LIDER }).getContent());
    if (!Array.isArray(data.alunos)) return 'alunos não é array: ' + JSON.stringify(data);
    Logger.log('  → ' + data.alunos.length + ' alunos');
    return true;
  });

  // 3) handleDashboardLider autoriza líder — modo rápido (skipAgregado)
  check('handleDashboardLider autoriza filippe (rápido)', function() {
    if (typeof handleDashboardLider !== 'function') return 'ainda não implementado — SKIP';
    var data = JSON.parse(handleDashboardLider({ email: SMOKE_EMAIL_LIDER, skipAgregado: true }).getContent());
    if (data.status !== 'sucesso') return JSON.stringify(data);
    if (!Array.isArray(data.alunos)) return 'estrutura incorreta';
    Logger.log('  → ' + data.alunos.length + ' alunos · semana=' + data.semanaAtual);
    return true;
  });

  // 4) handleDashboardLider nega email não autorizado
  check('handleDashboardLider nega email não autorizado', function() {
    if (typeof handleDashboardLider !== 'function') return 'pré Tarefa 5 — SKIP';
    var data = JSON.parse(handleDashboardLider({ email: SMOKE_EMAIL_NAO_AUTH }).getContent());
    if (data.status !== 'erro' && data.codigo !== 403) return 'esperado erro: ' + JSON.stringify(data);
    return true;
  });

  // 5) doPost rejeita ação desconhecida
  check('doPost rejeita ação desconhecida', function() {
    var raw = doPost({ postData: { contents: JSON.stringify({ acao: 'acao_inexistente_xyz' }) } });
    var data = JSON.parse(raw.getContent());
    if (data.status !== 'erro') return 'esperado erro: ' + JSON.stringify(data);
    return true;
  });

  // 6) BD_Mentores tem ao menos o líder cadastrado como Ativo
  check('BD_Mentores tem ao menos 1 mentor ativo (filippe)', function() {
    var map = lerMentoresAtivos();
    if (Object.keys(map).length === 0) return 'aba BD_Mentores vazia ou inexistente';
    if (!map[SMOKE_EMAIL_LIDER]) return 'filippe não cadastrado em BD_Mentores como Ativo';
    Logger.log('  → ' + Object.keys(map).length + ' mentores ativos · filippe.nome=' + map[SMOKE_EMAIL_LIDER].nome);
    return true;
  });

  // 7) Token validado: API_TOKEN está configurado em Script Properties
  check('API_TOKEN configurado em Script Properties', function() {
    if (!VALIDAR_TOKEN) return 'VALIDAR_TOKEN está false — produção precisa true';
    var tk = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
    if (!tk) return 'API_TOKEN ausente — Project Settings → Script Properties → API_TOKEN';
    if (tk.length < 24) return 'API_TOKEN muito curto (esperado >= 24 chars). Use openssl rand -hex 32';
    Logger.log('  → API_TOKEN ok (len=' + tk.length + ')');
    return true;
  });

  // 8) doPost com token errado retorna 401
  check('doPost rejeita payload sem token quando VALIDAR_TOKEN=true', function() {
    if (!VALIDAR_TOKEN) return 'VALIDAR_TOKEN=false — SKIP';
    var raw = doPost({ postData: { contents: JSON.stringify({ acao: 'login', email: SMOKE_EMAIL_LIDER }) } });
    var data = JSON.parse(raw.getContent());
    if (data.status !== 'erro') return 'esperado erro de auth: ' + JSON.stringify(data);
    return true;
  });

  // 9) AGENT_API_TOKEN existe (necessário pros crons de push)
  check('AGENT_API_TOKEN configurado em Script Properties', function() {
    var tk = PropertiesService.getScriptProperties().getProperty('AGENT_API_TOKEN');
    if (!tk) return 'AGENT_API_TOKEN ausente — push notifications via cron vão falhar silenciosamente';
    Logger.log('  → AGENT_API_TOKEN ok (len=' + tk.length + ')');
    return true;
  });

  // 10) IDOR fechado: _exigirAcessoAluno bloqueia email não autorizado
  check('_exigirAcessoAluno bloqueia email não autorizado', function() {
    if (typeof _exigirAcessoAluno !== 'function') return 'helper ausente';
    // Pega um aluno qualquer pra ter um id válido
    var lista = JSON.parse(handleListaAlunosMentor({ email: SMOKE_EMAIL_LIDER }).getContent());
    if (!lista.alunos || lista.alunos.length === 0) return 'sem alunos pra testar — SKIP';
    var idAlvo = lista.alunos[0].id;
    try {
      _exigirAcessoAluno(SMOKE_EMAIL_NAO_AUTH, idAlvo);
      return 'permitiu acesso indevido — IDOR aberto';
    } catch (e) {
      // esperado: erro de acesso negado
      Logger.log('  → bloqueio ok: ' + e.message);
      return true;
    }
  });

  // 11) _exigirAcessoAluno permite líder
  check('_exigirAcessoAluno permite líder', function() {
    if (typeof _exigirAcessoAluno !== 'function') return 'helper ausente';
    var lista = JSON.parse(handleListaAlunosMentor({ email: SMOKE_EMAIL_LIDER }).getContent());
    if (!lista.alunos || lista.alunos.length === 0) return 'sem alunos — SKIP';
    var idAlvo = lista.alunos[0].id;
    try {
      var r = _exigirAcessoAluno(SMOKE_EMAIL_LIDER, idAlvo);
      if (r.papel !== 'lider') return 'esperado papel=lider, veio ' + r.papel;
      return true;
    } catch (e) {
      return 'líder bloqueado indevidamente: ' + e.message;
    }
  });

  Logger.log('===== ' + ok + ' OK · ' + sk + ' SKIP · ' + ko + ' FALHAS =====');
}

/**
 * Diagnóstico manual: testa atualizarCacheMestre isoladamente com o
 * primeiro aluno do filippe. Rode no editor → Run → testCacheMestre
 * e cole os logs aqui. NÃO PREENCHE DADOS REAIS — usa 'TESTE_DIAGNOSTICO'.
 */
function testCacheMestre() {
  Logger.log('===== TEST CACHE MESTRE =====');
  var data = JSON.parse(handleListaAlunosMentor({ email: SMOKE_EMAIL_LIDER }).getContent());
  if (!Array.isArray(data.alunos) || data.alunos.length === 0) {
    Logger.log('FAIL: sem alunos do filippe'); return;
  }
  var alunoTeste = data.alunos[0];
  Logger.log('aluno alvo: ' + alunoTeste.nome + ' · id=' + alunoTeste.id);

  atualizarCacheMestre(alunoTeste.id, {
    ULTIMA_DATA_REGISTRO:   'TESTE_DIAGNOSTICO',
    ULTIMA_SEMANA_REGISTRO: 'TESTE_DIAGNOSTICO'
  });
  Logger.log('===== FIM — verifique a aba Cache_Alunos · linha do ' + alunoTeste.nome + ' =====');
}

/**
 * Smoke test COMPLETO — inclui agregação real do dashboardLider (caro: ~80s
 * com 39 alunos). Use este antes de releases ou quando suspeitar de
 * regressão de performance.
 */
function smokeTestCompleto() {
  smokeTest();
  Logger.log('===== SMOKE COMPLETO (com agregado pesado) =====');
  var t0 = new Date().getTime();
  try {
    var data = JSON.parse(handleDashboardLider({ email: SMOKE_EMAIL_LIDER }).getContent());
    var dt = ((new Date().getTime() - t0) / 1000).toFixed(1);
    if (data.status === 'sucesso' && data.agregado) {
      Logger.log('✓ dashboardLider completo (' + dt + 's) · ' + data.alunos.length + ' alunos');
    } else {
      Logger.log('✗ dashboardLider completo: ' + JSON.stringify(data).slice(0, 200));
    }
  } catch (e) {
    Logger.log('✗ dashboardLider completo EXCEPTION: ' + e.message);
  }
}

/**
 * Util de migração — cria aba 'BD_Alunos_Slim' com layout enxuto (23 cols
 * snake_case) copiando dados da BD_Alunos atual. Idempotente: recria a
 * aba slim a cada execução.
 *
 * Após rodar, fazer manualmente o switch:
 *   1. Renomear BD_Alunos → BD_Alunos_Old_<data>
 *   2. Renomear BD_Alunos_Slim → BD_Alunos
 */
function migrarBDAlunosParaSlim() {
  Logger.log('===== MIGRAR BD_Alunos PARA SLIM =====');
  var ssMestre = SpreadsheetApp.getActiveSpreadsheet();
  var abaAntiga = ssMestre.getSheetByName(ABA.MESTRE);
  if (!abaAntiga) { Logger.log('FAIL: ' + ABA.MESTRE + ' não encontrada'); return; }

  // Recria a aba slim do zero
  var abaNova = ssMestre.getSheetByName('BD_Alunos_Slim');
  if (abaNova) ssMestre.deleteSheet(abaNova);
  abaNova = ssMestre.insertSheet('BD_Alunos_Slim');

  var HEADERS = [
    'timestamp', 'nome_aluno', 'data_nascimento', 'telefone',
    'responsavel_financeiro', 'email', 'cidade', 'estado',
    'escolaridade', 'origem_ensino_medio', 'cota', 'fez_enem_antes',
    'provas_interesse', 'curso_interesse', 'plataforma_online',
    'nota_linguagens', 'nota_humanas', 'nota_natureza', 'nota_matematica',
    'nota_redacao', 'id_planilha', 'mentor_responsavel', 'status_onboarding'
  ];
  abaNova.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  abaNova.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  abaNova.setFrozenRows(1);

  var matrizAntiga = abaAntiga.getDataRange().getValues();
  if (matrizAntiga.length < 2) { Logger.log('Nenhum aluno pra migrar'); return; }

  // Mapping: índices da matriz antiga (60 cols) → posição na nova (23 cols)
  // Ordem corresponde a HEADERS acima.
  var mapeamento = [
    0,   // timestamp (A → A)
    1,   // nome_aluno (B → B)
    2,   // data_nascimento (C → C)
    3,   // telefone (D → D)
    4,   // responsavel_financeiro (E → E)
    5,   // email (F → F)
    6,   // cidade (G → G)
    7,   // estado (H → H)
    8,   // escolaridade (I → I)
    9,   // origem_ensino_medio (J → J)
    10,  // cota (K → K)
    11,  // fez_enem_antes (L → L)
    12,  // provas_interesse (M → M)
    13,  // curso_interesse (N → N)
    14,  // plataforma_online (O → O)
    18,  // nota_linguagens (S → P)
    19,  // nota_humanas (T → Q)
    20,  // nota_natureza (U → R)
    21,  // nota_matematica (V → S)
    57,  // nota_redacao (BF → T)
    52,  // id_planilha (BA → U)
    58,  // mentor_responsavel (BG → V)
    59   // status_onboarding (BH → W)
  ];

  var linhasNovas = [];
  for (var i = 1; i < matrizAntiga.length; i++) {
    var linha = mapeamento.map(function(idx) { return matrizAntiga[i][idx] || ''; });
    linhasNovas.push(linha);
  }

  if (linhasNovas.length > 0) {
    abaNova.getRange(2, 1, linhasNovas.length, HEADERS.length).setValues(linhasNovas);
  }

  // Validação de dados (dropdown): mentor_responsavel = col V = posição 22
  var abaMentores = ssMestre.getSheetByName(ABA.MENTORES);
  if (abaMentores && abaMentores.getLastRow() >= 2) {
    var rangeEmails = abaMentores.getRange(2, 1, abaMentores.getLastRow() - 1, 1);
    var ruleMentor = SpreadsheetApp.newDataValidation()
      .requireValueInRange(rangeEmails, true)
      .setAllowInvalid(false)
      .setHelpText('Selecione um email da aba BD_Mentores')
      .build();
    abaNova.getRange(2, 22, Math.max(linhasNovas.length, 1), 1).setDataValidation(ruleMentor);
  }

  // Validação: status_onboarding = col W = posição 23
  var ruleStatus = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Aguardando Diagnóstico', 'Onboarding Completo'], true)
    .setAllowInvalid(false)
    .setHelpText('Aguardando Diagnóstico | Onboarding Completo')
    .build();
  abaNova.getRange(2, 23, Math.max(linhasNovas.length, 1), 1).setDataValidation(ruleStatus);

  Logger.log('===== OK · ' + linhasNovas.length + ' alunos copiados pra BD_Alunos_Slim · ' + HEADERS.length + ' cols =====');
}

/**
 * Lista emails de mentor presentes em BD_Alunos_Slim mas ausentes (ou
 * inativos) em BD_Mentores. Útil pra você completar a aba Mentores
 * antes de fazer o switch BD_Alunos_Slim → BD_Alunos.
 */
function listarMentoresFaltantes() {
  Logger.log('===== MENTORES FALTANTES EM BD_Mentores =====');
  var ssMestre = SpreadsheetApp.getActiveSpreadsheet();

  var abaSlim = ssMestre.getSheetByName('BD_Alunos_Slim');
  if (!abaSlim) { Logger.log('FAIL: BD_Alunos_Slim não existe — rode migrarBDAlunosParaSlim antes'); return; }
  var matriz = abaSlim.getDataRange().getValues();
  if (matriz.length < 2) { Logger.log('Sem dados em BD_Alunos_Slim'); return; }

  // mentor_responsavel = coluna V = índice 21
  var emailsAlunos = {};
  for (var i = 1; i < matriz.length; i++) {
    var em = emailNorm(matriz[i][21]);
    if (em) emailsAlunos[em] = (emailsAlunos[em] || 0) + 1;
  }

  var ativos = lerMentoresAtivos();
  var faltantes = [];
  Object.keys(emailsAlunos).forEach(function(em) {
    if (!ativos[em]) faltantes.push({ email: em, count: emailsAlunos[em] });
  });

  faltantes.sort(function(a, b) { return b.count - a.count; });

  if (faltantes.length === 0) {
    Logger.log('✓ Todos os mentores referenciados estão cadastrados como Ativos em BD_Mentores');
    return;
  }

  Logger.log(faltantes.length + ' email(s) usados em BD_Alunos_Slim mas faltando/inativos em BD_Mentores:');
  faltantes.forEach(function(f) {
    Logger.log('  · ' + f.email + ' (' + f.count + ' aluno' + (f.count > 1 ? 's' : '') + ')');
  });
  Logger.log('===== FIM · adicione-os em BD_Mentores antes do switch =====');
}

/**
 * Util de migração — roda 1× pra renomear abas legacy nas planilhas
 * individuais (lowercase → TitleCase). Idempotente: pode rodar 2×.
 * Não mexe nas constantes ABA do código — produção continua funcionando
 * com os nomes antigos até o próximo push.
 */
function renomearAbasAlunos() {
  Logger.log('===== RENAME ABAS DAS PLANILHAS INDIVIDUAIS =====');
  var renomes = {
    'BD_onboarding':  'BD_Onboarding',
    'BD_diagnostico': 'BD_Diagnostico',
    'BD_semana':      'BD_Semana',
    'BD_caderno':     'BD_Caderno'
  };

  var abaMestre = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA.MESTRE);
  if (!abaMestre) { Logger.log('FAIL: aba mestre não encontrada'); return; }
  var matriz = abaMestre.getDataRange().getValues();
  var totalAlunos = 0, totalRenomes = 0, totalErros = 0;

  for (var i = 1; i < matriz.length; i++) {
    var idPlanilha = txt(matriz[i][COL_MESTRE.ID_PLANILHA]);
    if (!idPlanilha) continue;
    var nomeAluno = txt(matriz[i][COL_MESTRE.NOME]) || '<sem nome>';
    totalAlunos++;

    try {
      var ss = SpreadsheetApp.openById(idPlanilha);
      var renomesDesteAluno = 0;
      Object.keys(renomes).forEach(function(antigo) {
        var aba = ss.getSheetByName(antigo);
        if (aba) { aba.setName(renomes[antigo]); renomesDesteAluno++; totalRenomes++; }
      });
      if (renomesDesteAluno > 0) Logger.log('✓ ' + nomeAluno + ' (' + renomesDesteAluno + ' abas)');
    } catch (e) {
      Logger.log('✗ ' + nomeAluno + ' — ' + e.message);
      totalErros++;
    }
  }

  Logger.log('===== TOTAL: ' + totalAlunos + ' alunos · ' + totalRenomes + ' abas renomeadas · ' + totalErros + ' erros =====');
}

/**
 * Diagnóstico manual: testa atualizarCacheMestre pra coluna ULTIMO_ENCONTRO (BK).
 * Rode no editor → Run → testCacheEncontro.
 */
function testCacheEncontro() {
  Logger.log('===== TEST CACHE ENCONTRO =====');
  var data = JSON.parse(handleListaAlunosMentor({ email: SMOKE_EMAIL_LIDER }).getContent());
  if (!Array.isArray(data.alunos) || data.alunos.length === 0) {
    Logger.log('FAIL: sem alunos do filippe'); return;
  }
  var alunoTeste = data.alunos[0];
  Logger.log('aluno alvo: ' + alunoTeste.nome + ' · id=' + alunoTeste.id);

  atualizarCacheMestre(alunoTeste.id, {
    ULTIMO_ENCONTRO: 'TESTE_ENCONTRO'
  });
  Logger.log('===== FIM — verifique a aba Cache_Alunos · ultimo_encontro do ' + alunoTeste.nome + ' =====');
}
