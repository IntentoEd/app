export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { verificarUsuario } from '@/lib/auth';
import { chamarGAS } from '@/lib/gasClient';

// Cache em memória: chave -> { ts, data }
const cache = new Map();

// Ações que exigem Firebase ID token verificado.
// Pra essas, o `email` no body é IGNORADO e substituído pelo email do token.
// Isso impede que um usuário autenticado finja ser outro (anti-spoofing).
// Públicas (intencionalmente fora dessa lista): onboarding, diagnostico, login,
// loginGlobal, buscarTopicosGlobais — fluxos abertos ou catálogo sem identidade.
const ACOES_AUTENTICADAS = new Set([
  // CRM (líder/vendedor)
  'listarLeads', 'criarLead', 'editarLead', 'moverLeadFase',
  'dashboardCrm', 'converterLeadEmAluno', 'deletarLead',
  'buscarLead', 'buscarLeadPorEmail', 'buscarLeadPorGcalEventId',
  'listarVendedoresAtendimento', 'cargaPorVendedorNoMes',
  // Disponibilidade (vendedor)
  'salvarHorariosPadrao', 'lerHorariosPadrao',
  'criarExcecaoDisponibilidade', 'removerExcecaoDisponibilidade',
  'listarExcecoesDisponibilidade',
  // Líder
  'dashboardLider', 'designarMentor', 'atualizarDadosAluno', 'inativarAluno',
  // Avaliações escolares (fac-símile EM)
  'cadastrarAvaliacoes', 'listarAvaliacoesAluno', 'atualizarAvaliacao', 'deletarAvaliacao',
  // Mentor — listagem e leitura de alunos
  'listaAlunosMentor', 'buscarDadosAluno', 'buscarOnboarding', 'buscarMetaAnterior',
  // Mentor — escrita de registros/encontros/simulados
  'salvarDiario', 'salvarSemanaLote', 'salvarRegistroGlobal', 'deletarRegistro',
  'verificarRegistroSemana', 'editarRegistro', 'salvarStatusApp',
  'salvarNovoEncontro', 'avaliarEncontroPassado', 'editarEncontro',
  'salvarSimulado', 'salvarAutopsia',
  // Caderno (aluno/mentor)
  'listarCaderno', 'salvarCardCaderno', 'incrementarRepeticao',
  'deletarCardCaderno', 'registrarRevisaoCaderno',
  // Push notifications (email DEVE vir do token, não do body)
  'subscribePush', 'unsubscribePush',
  // Admin: listar subscriptions (chamado por /api/push/send — protegido por GAS_API_TOKEN)
  'listarPushSubscriptions',
]);

const TTL_MS = {
  buscarTopicosGlobais: 24 * 60 * 60 * 1000, // 24h
  listaAlunosMentor:    5  * 60 * 1000,      // 5min
  buscarOnboarding:     60 * 60 * 1000,      // 1h
  buscarDadosAluno:     60 * 1000,           // 60s
  buscarMetaAnterior:   60 * 1000,           // 60s — meta da última semana registrada
  dashboardLider:       2  * 60 * 1000,      // 2min — dashboard do líder, dados mudam a cada write
  listarLeads:          60 * 1000,           // 60s — pipeline de vendas, alta frequência
  dashboardCrm:         2  * 60 * 1000,      // 2min
  // listarAvaliacoesAluno: NÃO cacheia — chave seria por idAluno (compartilhada entre
  // usuários) e o gateway só valida identidade, não autorização (que é feita no GAS).
  // Cachear permitiria leak: usuário A autenticado bateria no cache de B sem passar
  // pelo check do GAS. GAS é a fonte da verdade de auth nessa rota.
};

// Quais ações de escrita invalidam quais ações de leitura.
// Padrões suportam '|*' como wildcard de qualquer segmento (email ou id).
// Chave do cache é `${acao}|${email|*}|${id|*}`.
function chavesParaInvalidar(acaoEscrita, dados) {
  const ids = [dados.idPlanilha, dados.idPlanilhaAluno, dados.idAluno].filter(Boolean);
  switch (acaoEscrita) {
    case 'salvarRegistroGlobal':
    case 'editarRegistro':
    case 'deletarRegistro':
    case 'salvarNovoEncontro':
    case 'avaliarEncontroPassado':
    case 'editarEncontro':
    case 'salvarSemanaLote':
    case 'salvarSimulado':
    case 'salvarAutopsia':
    case 'salvarCardCaderno':
    case 'incrementarRepeticao':
    case 'deletarCardCaderno':
    case 'registrarRevisaoCaderno':
      return [
        ...ids.flatMap(id => [`buscarDadosAluno|*|${id}`, `buscarOnboarding|*|${id}`, `buscarMetaAnterior|*|${id}`]),
        'dashboardLider|*',
      ];
    case 'onboarding':
    case 'diagnostico':
    case 'designarMentor':
    case 'atualizarDadosAluno':
    case 'inativarAluno':
      return ['listaAlunosMentor|*', 'dashboardLider|*'];
    case 'cadastrarAvaliacoes':
    case 'atualizarAvaliacao':
    case 'deletarAvaliacao':
      return [
        ...ids.map(id => `listarAvaliacoesAluno|*|${id}`),
        'listaAlunosMentor|*',
      ];
    case 'criarLead':
    case 'editarLead':
    case 'moverLeadFase':
    case 'deletarLead':
      return ['listarLeads|*', 'dashboardCrm|*'];
    case 'converterLeadEmAluno':
      return ['listarLeads|*', 'dashboardCrm|*', 'listaAlunosMentor|*', 'dashboardLider|*'];
    default:
      return [];
  }
}

// Match de chave contra padrão com '*' como wildcard de segmento.
// Ex: 'buscarDadosAluno|*|abc' bate 'buscarDadosAluno|alice@x|abc' e 'buscarDadosAluno|bob@x|abc'.
function chaveCasaPadrao(chave, padrao) {
  const ck = chave.split('|');
  const pk = padrao.split('|');
  if (pk.length > ck.length) return false;
  for (let i = 0; i < pk.length; i++) {
    if (pk[i] === '*') continue;
    if (pk[i] !== ck[i]) return false;
  }
  return true;
}

// Inclui o email do caller na chave pra que o cache seja por-usuário (evita
// que mentor A leia cache do mentor B). Pra ações sem identidade (token-only),
// emailCaller é '*' e o cache é compartilhado intencionalmente.
function chaveCache(acao, dados, emailCaller) {
  const id = dados.idPlanilhaAluno || dados.idAluno || dados.idPlanilha || '*';
  return `${acao}|${emailCaller || '*'}|${id}`;
}

export async function POST(request) {
  try {
    const dados = await request.json();
    const acao = dados.acao || dados.tipo || '';
    let emailCaller = null;

    // Auth: ações sensíveis exigem Firebase ID token e ignoram o email do body.
    if (ACOES_AUTENTICADAS.has(acao)) {
      const usuario = await verificarUsuario(request);
      if (!usuario) {
        return NextResponse.json(
          { status: 'erro', mensagem: 'Não autorizado: token inválido ou ausente' },
          { status: 401 }
        );
      }
      emailCaller = usuario.email;
      // Sobrescreve email + porEmail (criadoPor) com o email do token verificado.
      dados.email = emailCaller;
      // porEmail e criadoPor são sempre preenchidos com o email verificado quando ação autenticada,
      // independente do client ter mandado ou não. Confiar no client aqui é IDOR.
      dados.porEmail = emailCaller;
      dados.criadoPor = emailCaller;
    }

    const ttl = TTL_MS[acao];

    // Leitura cacheável
    if (ttl) {
      const chave = chaveCache(acao, dados, emailCaller);
      const hit = cache.get(chave);
      if (hit && Date.now() - hit.ts < ttl) {
        return NextResponse.json(hit.data);
      }
      const data = await chamarGAS(dados);
      if (data && data.status !== 'erro') cache.set(chave, { ts: Date.now(), data });
      return NextResponse.json(data);
    }

    // Escrita: invalida cache relacionado, depois chama GAS
    const padroes = chavesParaInvalidar(acao, dados);
    for (const padrao of padroes) {
      for (const k of cache.keys()) {
        if (chaveCasaPadrao(k, padrao)) cache.delete(k);
      }
    }

    const data = await chamarGAS(dados);
    return NextResponse.json(data);

  } catch (error) {
    console.error('❌ [API] Erro Crítico na Rota:', error);
    return NextResponse.json(
      { status: 'erro', mensagem: 'Falha na comunicação com o Google', detalhes: error.message },
      { status: 500 }
    );
  }
}
