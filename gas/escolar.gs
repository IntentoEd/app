// =====================================================================
// ESCOLAR — Acompanhamento Escolar (AE) / fac-símile EM
// =====================================================================
// Domínio: Filippe (mentoria/escolar). Tudo de BD_Avaliacoes (provas
// escolares de alunos EM) + enriquecimento da listaAlunosMentor com
// próxima prova mora aqui.
//
// Constantes globais (COL_AV, TIPOS_AVAL, MATERIAS_EM) permanecem em
// Code.gs por design.


// =====================================================================
// HELPERS DE AVALIAÇÃO
// =====================================================================

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


// =====================================================================
// ENRIQUECIMENTO CROSS-DOMAIN
// =====================================================================

// Anexa { proximaProva: { data, materia, dias } | null } a cada aluno EM da lista.
// Lê BD_Avaliacoes 1x e cruza in-memory.
// Chamado por handleListaAlunosMentor (em Code.gs) via namespace global.
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
// HANDLERS DE AVALIAÇÃO
// =====================================================================

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
// MIGRATION ONE-SHOT (idempotente)
// =====================================================================

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
