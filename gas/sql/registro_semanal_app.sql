-- ============================================================
-- REGISTRO SEMANAL — query master. Replica a lógica do app Flutter
-- (intento-fe: subject_performance.dart, topic_metrics.dart, performance.dart).
-- 1 linha por (aluno, semana). Domínio/Progresso = "foto" até semana_alvo.
--
-- LÓGICA (validada contra o app, mai/2026):
-- · DOMÍNIO por matéria  = SUM(rightAnswers) / SUM(right+wrong) dos tópicos
--   nível 1. rightAnswers/wrongAnswers de cada folha vêm da ÚLTIMA atividade
--   (por activity.date). Tópico nível 1 com subtópicos = soma dos descendentes.
-- · DOMÍNIO total        = SUM(right)/SUM(total) global das disciplinas ativas.
-- · PROGRESSO por matéria= count(tópicos nível 1 isFinished) / count(tópicos nível 1).
--   isFinished = forced(topicoPrep.finalizada) OR (finished >= total), onde
--   p/ folha: total=1, finished=nº atividades com finished=true;
--   p/ tópico nível 1 com subtópicos: total=nº subtópicos, finished=SOMA
--   das contagens de finished dos subtópicos (soma, NÃO distinct).
-- · PROGRESSO total      = MÉDIA SIMPLES do progresso das disciplinas ativas.
-- · Disciplinas ativas   = objetivo.subjectIds (exclui as que o aluno removeu).
-- · HORAS / CHECK-IN     = analise.atividadesSemanais da semana_alvo.
--
-- Diferença conhecida: Domínio pode divergir 1-2pp do app (detalhe de quais
-- atividades entram). Progresso bate exato.
-- ============================================================
DECLARE semana_alvo DATE DEFAULT DATE("2026-05-17");
-- Para rodar pra todos os alunos, troque o filtro em `alunos` por toda a tabela usuario.
DECLARE alvos ARRAY<STRING> DEFAULT ["gabriel.limamoreira@gmail.com","silvaclaudialuisa@gmail.com"];

WITH
alunos AS (SELECT uid, email FROM `intento-edu.app.usuario` WHERE email IN UNNEST(alvos)),

-- disciplinas ativas (objetivo.subjectIds) — exclui as que o aluno removeu
disc_ativas AS (
  SELECT REGEXP_EXTRACT(__key__.path, r'"u",\s*"([^"]+)"') AS usuarioId, sid AS disciplinaId
  FROM `intento-edu.app.objetivo`, UNNEST(subjectIds) sid
  WHERE REGEXP_EXTRACT(__key__.path, r'"u",\s*"([^"]+)"') IN (SELECT uid FROM alunos)
),

-- nós não-raiz
nodes AS (
  SELECT topicoId, paiId, usuarioId, nivel, finalizada AS forced
  FROM `intento-edu.app.topicoPrep`
  WHERE usuarioId IN (SELECT uid FROM alunos) AND paiId IS NOT NULL
),

-- última atividade por (aluno, nó) até semana_alvo + contagem de finished
ativ AS (
  SELECT
    REGEXP_EXTRACT(__key__.path, r'"u",\s*"([^"]+)"') AS usuarioId,
    subjectId AS topicoId,
    ARRAY_AGG(STRUCT(rightAnswers, wrongAnswers) ORDER BY TIMESTAMP_SECONDS(date) DESC LIMIT 1)[OFFSET(0)] AS ultima,
    COUNTIF(finished) AS n_finished
  FROM `intento-edu.app.atividade`
  WHERE REGEXP_EXTRACT(__key__.path, r'"u",\s*"([^"]+)"') IN (SELECT uid FROM alunos)
    AND DATE(TIMESTAMP_SECONDS(date)) <= semana_alvo
  GROUP BY usuarioId, topicoId
),

-- FOLHAS: total=1, finished=n_finished, right/wrong da última atividade
folhas AS (
  SELECT n.topicoId, n.paiId, n.usuarioId, n.nivel, n.forced,
         1 AS total,
         COALESCE(a.n_finished, 0) AS finished,
         COALESCE(a.ultima.rightAnswers, 0) AS right_a,
         COALESCE(a.ultima.wrongAnswers, 0) AS wrong_a
  FROM nodes n
  LEFT JOIN nodes c ON c.paiId = n.topicoId AND c.usuarioId = n.usuarioId
  LEFT JOIN ativ a ON a.topicoId = n.topicoId AND a.usuarioId = n.usuarioId
  WHERE c.topicoId IS NULL
),

-- TÓPICOS NÍVEL 1: métricas (folha direta OU soma dos subtópicos)
mains AS (
  -- nível 1 SEM subtópicos (é folha)
  SELECT topicoId, paiId AS disciplinaId, usuarioId, forced, total, finished, right_a, wrong_a
  FROM folhas WHERE nivel = 1
  UNION ALL
  -- nível 1 COM subtópicos: soma dos filhos folha
  SELECT p.topicoId, p.paiId AS disciplinaId, p.usuarioId, p.forced,
         COUNT(f.topicoId) AS total,
         SUM(f.finished) AS finished,
         SUM(f.right_a) AS right_a,
         SUM(f.wrong_a) AS wrong_a
  FROM nodes p
  JOIN folhas f ON f.paiId = p.topicoId AND f.usuarioId = p.usuarioId
  WHERE p.nivel = 1
  GROUP BY p.topicoId, p.paiId, p.usuarioId, p.forced
),

-- métricas por disciplina (só disciplinas ativas)
disc_metrica AS (
  SELECT
    m.usuarioId, m.disciplinaId, tp.nome AS Disciplina,
    -- progresso = tópicos n1 finished / total tópicos n1
    SAFE_DIVIDE(COUNTIF(m.forced OR m.finished >= m.total), COUNT(*)) AS progresso,
    -- domínio = SUM(right)/SUM(right+wrong)
    SAFE_DIVIDE(SUM(m.right_a), SUM(m.right_a + m.wrong_a)) AS dominio,
    SUM(m.right_a) AS right_total, SUM(m.right_a + m.wrong_a) AS resp_total
  FROM mains m
  JOIN disc_ativas da ON da.usuarioId = m.usuarioId AND da.disciplinaId = m.disciplinaId
  JOIN `intento-edu.app.topicoPrep` tp ON tp.topicoId = m.disciplinaId AND tp.usuarioId = m.usuarioId
  GROUP BY m.usuarioId, m.disciplinaId, tp.nome
),

-- horas + check-in da semana
semana AS (
  SELECT usuarioId,
    ROUND(SUM(minutos)/60.0, 1) AS horas,
    ROUND(AVG(estresse), 2) AS estresse, ROUND(AVG(ansiedade), 2) AS ansiedade,
    ROUND(AVG(motivacao), 2) AS motivacao, ROUND(AVG(descanso), 2) AS sono
  FROM `intento-edu.analise.atividadesSemanais`
  WHERE dataExecucao = semana_alvo GROUP BY usuarioId
)

SELECT
  a.email,
  -- Domínio por matéria
  ROUND(MAX(IF(dm.Disciplina='Biologia',   dm.dominio, NULL)), 2) AS dom_BIO,
  ROUND(MAX(IF(dm.Disciplina='Química',    dm.dominio, NULL)), 2) AS dom_QUI,
  ROUND(MAX(IF(dm.Disciplina='Física',     dm.dominio, NULL)), 2) AS dom_FIS,
  ROUND(MAX(IF(dm.Disciplina='Matemática', dm.dominio, NULL)), 2) AS dom_MAT,
  ROUND(SAFE_DIVIDE(SUM(dm.right_total), SUM(dm.resp_total)), 2) AS dom_TOTAL,
  -- Progresso por matéria
  ROUND(MAX(IF(dm.Disciplina='Biologia',   dm.progresso, NULL)), 2) AS prog_BIO,
  ROUND(MAX(IF(dm.Disciplina='Química',    dm.progresso, NULL)), 2) AS prog_QUI,
  ROUND(MAX(IF(dm.Disciplina='Física',     dm.progresso, NULL)), 2) AS prog_FIS,
  ROUND(MAX(IF(dm.Disciplina='Matemática', dm.progresso, NULL)), 2) AS prog_MAT,
  ROUND(AVG(dm.progresso), 2) AS prog_TOTAL,
  s.horas, s.estresse, s.ansiedade, s.motivacao, s.sono
FROM alunos a
LEFT JOIN disc_metrica dm ON dm.usuarioId = a.uid
LEFT JOIN semana s ON s.usuarioId = a.uid
GROUP BY a.email, s.horas, s.estresse, s.ansiedade, s.motivacao, s.sono
ORDER BY a.email
