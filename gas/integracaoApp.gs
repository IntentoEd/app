// =====================================================================
// INTEGRAÇÃO APP (BigQuery) — conector read-only
// =====================================================================
// Lê dados de uso do Aplicativo (projeto BigQuery intento-edu) pra
// alimentar o registro semanal do mentor. Autentica via Service Account
// (JWT RS256 → OAuth token), sem depender de acesso pessoal de ninguém.
//
// SETUP MANUAL (1×, no editor — Project Settings → Script Properties):
//   BQ_SA_KEY = <conteúdo integral do JSON da service account>
//   (SA: intento-platform-bq-reader@intento-edu.iam.gserviceaccount.com,
//    roles read-only: BigQuery Data Viewer em app+analise, Job User no projeto)
//
// A lógica de cálculo dos 18 campos replica o app Flutter — ver
// gas/sql/registro_semanal_app.sql pro detalhe e histórico de validação.
//
// Domínio: escolar (Filippe).

var BQ_PROJECT_ID = 'intento-edu';
var BQ_SCOPE = 'https://www.googleapis.com/auth/bigquery.readonly';


// =====================================================================
// AUTENTICAÇÃO — Service Account → access token (JWT bearer flow)
// =====================================================================
function _bqGetAccessToken() {
  var raw = PropertiesService.getScriptProperties().getProperty('BQ_SA_KEY');
  if (!raw) throw new Error('BQ_SA_KEY ausente em Script Properties');

  var sa;
  try {
    sa = JSON.parse(raw);
  } catch (e) {
    throw new Error('BQ_SA_KEY não é JSON válido: ' + e.message);
  }
  if (!sa.client_email || !sa.private_key) {
    throw new Error('BQ_SA_KEY incompleto (faltam client_email/private_key)');
  }

  var now = Math.floor(Date.now() / 1000);
  var b64url = function (bytesOrStr) {
    return Utilities.base64EncodeWebSafe(bytesOrStr).replace(/=+$/, '');
  };

  var header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  var claims = b64url(JSON.stringify({
    iss:   sa.client_email,
    scope: BQ_SCOPE,
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  }));
  var signatureInput = header + '.' + claims;
  var signature = Utilities.computeRsaSha256Signature(signatureInput, sa.private_key);
  var jwt = signatureInput + '.' + b64url(signature);

  var resp = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    },
    muteHttpExceptions: true,
  });

  var body;
  try {
    body = JSON.parse(resp.getContentText());
  } catch (e) {
    throw new Error('Resposta OAuth não-JSON: ' + resp.getContentText());
  }
  if (!body.access_token) {
    throw new Error('Falha ao obter access token BQ: ' + resp.getContentText());
  }
  return body.access_token;
}


// =====================================================================
// QUERY — roda SQL no BigQuery, devolve linhas como array de objetos
// =====================================================================
// parameters: array no formato da BigQuery REST API (queryParameters).
function _bqQuery(sql, parameters) {
  var token = _bqGetAccessToken();
  var payload = {
    query: sql,
    useLegacySql: false,
    timeoutMs: 60000,
  };
  if (parameters && parameters.length) {
    payload.parameterMode = 'NAMED';
    payload.queryParameters = parameters;
  }

  var resp = UrlFetchApp.fetch(
    'https://bigquery.googleapis.com/bigquery/v2/projects/' + BQ_PROJECT_ID + '/queries',
    {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    }
  );

  var body;
  try {
    body = JSON.parse(resp.getContentText());
  } catch (e) {
    throw new Error('Resposta BQ não-JSON: ' + resp.getContentText());
  }
  if (body.error) throw new Error('BQ erro: ' + JSON.stringify(body.error));
  if (!body.jobComplete) throw new Error('BQ job não completou em 60s');

  var fields = (body.schema && body.schema.fields) || [];
  var rows = body.rows || [];
  return rows.map(function (r) {
    var obj = {};
    for (var i = 0; i < fields.length; i++) {
      obj[fields[i].name] = r.f[i].v;
    }
    return obj;
  });
}


// =====================================================================
// _lerRegistrosApp — 1 linha por aluno com os 18 campos do registro
// =====================================================================
// semanaAlvo: 'YYYY-MM-DD' (sábado da semana — fim da semana Dom-Sáb).
// emailsAlvo: array de emails pra filtrar; vazio/ausente = todos os alunos.
// Retorna: { email: { dom_BIO, ..., prog_TOTAL, horas, estresse, ... } }.
function _lerRegistrosApp(semanaAlvo, emailsAlvo) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(semanaAlvo))) {
    throw new Error('semanaAlvo inválida (esperado YYYY-MM-DD): ' + semanaAlvo);
  }
  var alvos = Array.isArray(emailsAlvo) ? emailsAlvo : [];

  var parameters = [
    {
      name: 'semana_alvo',
      parameterType: { type: 'DATE' },
      parameterValue: { value: semanaAlvo },
    },
    {
      name: 'alvos',
      parameterType: { type: 'ARRAY', arrayType: { type: 'STRING' } },
      parameterValue: { arrayValues: alvos.map(function (e) { return { value: e }; }) },
    },
  ];

  var linhas = _bqQuery(_SQL_REGISTRO_APP, parameters);
  var porEmail = {};
  linhas.forEach(function (l) { porEmail[l.email] = l; });
  return porEmail;
}


// =====================================================================
// SMOKE — roda 1× no editor pra validar o conector
// =====================================================================
function smokeIntegracaoApp() {
  Logger.log('===== SMOKE Integração App =====');

  var token = _bqGetAccessToken();
  Logger.log('✓ access token obtido (' + token.length + ' chars)');

  var registros = _lerRegistrosApp('2026-05-17', [
    'gabriel.limamoreira@gmail.com',
    'silvaclaudialuisa@gmail.com',
  ]);
  var emails = Object.keys(registros);
  Logger.log('✓ _lerRegistrosApp retornou ' + emails.length + ' aluno(s)');

  emails.forEach(function (em) {
    var r = registros[em];
    Logger.log('  ' + em +
      ' | horas=' + r.horas +
      ' | domTotal=' + r.dom_TOTAL + ' progTotal=' + r.prog_TOTAL +
      ' | domBIO=' + r.dom_BIO + ' progBIO=' + r.prog_BIO +
      ' | estresse=' + r.estresse + ' sono=' + r.sono);
  });

  // Esperado (validado mai/2026 contra o app):
  //   gabriel  → domTotal≈0.89 progTotal≈0.75
  //   claudia  → domTotal≈0.85 progTotal≈0.41
  Logger.log('===== FIM SMOKE =====');
}


// =====================================================================
// SQL — query master. Replica a lógica do app Flutter.
// Mantida em sincronia com gas/sql/registro_semanal_app.sql.
// Parâmetros: @semana_alvo (DATE), @alvos (ARRAY<STRING>, vazio = todos).
// =====================================================================
var _SQL_REGISTRO_APP = [
  'WITH',
  // alunos: filtra por @alvos, ou todos se @alvos vier vazio
  'alunos AS (',
  '  SELECT uid, email FROM `intento-edu.app.usuario`',
  '  WHERE ARRAY_LENGTH(@alvos) = 0 OR email IN UNNEST(@alvos)',
  '),',
  // disciplinas ativas (objetivo.subjectIds) — exclui as que o aluno removeu
  'disc_ativas AS (',
  '  SELECT REGEXP_EXTRACT(__key__.path, r\'"u",\\s*"([^"]+)"\') AS usuarioId, sid AS disciplinaId',
  '  FROM `intento-edu.app.objetivo`, UNNEST(subjectIds) sid',
  '  WHERE REGEXP_EXTRACT(__key__.path, r\'"u",\\s*"([^"]+)"\') IN (SELECT uid FROM alunos)',
  '),',
  // nós não-raiz
  'nodes AS (',
  '  SELECT topicoId, paiId, usuarioId, nivel, finalizada AS forced',
  '  FROM `intento-edu.app.topicoPrep`',
  '  WHERE usuarioId IN (SELECT uid FROM alunos) AND paiId IS NOT NULL',
  '),',
  // última atividade por (aluno, nó) até semana_alvo + contagem de finished
  'ativ AS (',
  '  SELECT',
  '    REGEXP_EXTRACT(__key__.path, r\'"u",\\s*"([^"]+)"\') AS usuarioId,',
  '    subjectId AS topicoId,',
  '    ARRAY_AGG(STRUCT(rightAnswers, wrongAnswers) ORDER BY TIMESTAMP_SECONDS(date) DESC LIMIT 1)[OFFSET(0)] AS ultima,',
  '    COUNTIF(finished) AS n_finished',
  '  FROM `intento-edu.app.atividade`',
  '  WHERE REGEXP_EXTRACT(__key__.path, r\'"u",\\s*"([^"]+)"\') IN (SELECT uid FROM alunos)',
  '    AND DATE(TIMESTAMP_SECONDS(date)) <= @semana_alvo',
  '  GROUP BY usuarioId, topicoId',
  '),',
  // folhas: total=1, finished=n_finished, right/wrong da última atividade
  'folhas AS (',
  '  SELECT n.topicoId, n.paiId, n.usuarioId, n.nivel, n.forced,',
  '         1 AS total,',
  '         COALESCE(a.n_finished, 0) AS finished,',
  '         COALESCE(a.ultima.rightAnswers, 0) AS right_a,',
  '         COALESCE(a.ultima.wrongAnswers, 0) AS wrong_a',
  '  FROM nodes n',
  '  LEFT JOIN nodes c ON c.paiId = n.topicoId AND c.usuarioId = n.usuarioId',
  '  LEFT JOIN ativ a ON a.topicoId = n.topicoId AND a.usuarioId = n.usuarioId',
  '  WHERE c.topicoId IS NULL',
  '),',
  // tópicos nível 1: folha direta OU soma dos subtópicos
  'mains AS (',
  '  SELECT topicoId, paiId AS disciplinaId, usuarioId, forced, total, finished, right_a, wrong_a',
  '  FROM folhas WHERE nivel = 1',
  '  UNION ALL',
  '  SELECT p.topicoId, p.paiId AS disciplinaId, p.usuarioId, p.forced,',
  '         COUNT(f.topicoId) AS total,',
  '         SUM(f.finished) AS finished,',
  '         SUM(f.right_a) AS right_a,',
  '         SUM(f.wrong_a) AS wrong_a',
  '  FROM nodes p',
  '  JOIN folhas f ON f.paiId = p.topicoId AND f.usuarioId = p.usuarioId',
  '  WHERE p.nivel = 1',
  '  GROUP BY p.topicoId, p.paiId, p.usuarioId, p.forced',
  '),',
  // métricas por disciplina (só disciplinas ativas)
  'disc_metrica AS (',
  '  SELECT',
  '    m.usuarioId, m.disciplinaId, tp.nome AS Disciplina,',
  '    SAFE_DIVIDE(COUNTIF(m.forced OR m.finished >= m.total), COUNT(*)) AS progresso,',
  '    SAFE_DIVIDE(SUM(m.right_a), SUM(m.right_a + m.wrong_a)) AS dominio,',
  '    SUM(m.right_a) AS right_total, SUM(m.right_a + m.wrong_a) AS resp_total',
  '  FROM mains m',
  '  JOIN disc_ativas da ON da.usuarioId = m.usuarioId AND da.disciplinaId = m.disciplinaId',
  '  JOIN `intento-edu.app.topicoPrep` tp ON tp.topicoId = m.disciplinaId AND tp.usuarioId = m.usuarioId',
  '  GROUP BY m.usuarioId, m.disciplinaId, tp.nome',
  '),',
  // horas + check-in da semana
  'semana AS (',
  '  SELECT usuarioId,',
  '    ROUND(SUM(minutos)/60.0, 1) AS horas,',
  '    ROUND(AVG(estresse), 2) AS estresse, ROUND(AVG(ansiedade), 2) AS ansiedade,',
  '    ROUND(AVG(motivacao), 2) AS motivacao, ROUND(AVG(descanso), 2) AS sono',
  '  FROM `intento-edu.analise.atividadesSemanais`',
  '  WHERE dataExecucao = @semana_alvo GROUP BY usuarioId',
  ')',
  'SELECT',
  '  a.email,',
  '  ROUND(MAX(IF(dm.Disciplina=\'Biologia\',   dm.dominio, NULL)), 2) AS dom_BIO,',
  '  ROUND(MAX(IF(dm.Disciplina=\'Química\',    dm.dominio, NULL)), 2) AS dom_QUI,',
  '  ROUND(MAX(IF(dm.Disciplina=\'Física\',     dm.dominio, NULL)), 2) AS dom_FIS,',
  '  ROUND(MAX(IF(dm.Disciplina=\'Matemática\', dm.dominio, NULL)), 2) AS dom_MAT,',
  '  ROUND(SAFE_DIVIDE(SUM(dm.right_total), SUM(dm.resp_total)), 2) AS dom_TOTAL,',
  '  ROUND(MAX(IF(dm.Disciplina=\'Biologia\',   dm.progresso, NULL)), 2) AS prog_BIO,',
  '  ROUND(MAX(IF(dm.Disciplina=\'Química\',    dm.progresso, NULL)), 2) AS prog_QUI,',
  '  ROUND(MAX(IF(dm.Disciplina=\'Física\',     dm.progresso, NULL)), 2) AS prog_FIS,',
  '  ROUND(MAX(IF(dm.Disciplina=\'Matemática\', dm.progresso, NULL)), 2) AS prog_MAT,',
  '  ROUND(AVG(dm.progresso), 2) AS prog_TOTAL,',
  '  s.horas, s.estresse, s.ansiedade, s.motivacao, s.sono',
  'FROM alunos a',
  'LEFT JOIN disc_metrica dm ON dm.usuarioId = a.uid',
  'LEFT JOIN semana s ON s.usuarioId = a.uid',
  'GROUP BY a.email, s.horas, s.estresse, s.ansiedade, s.motivacao, s.sono',
  'ORDER BY a.email',
].join('\n');
