export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import {
  criarEvento,
  cabeEmJanelas,
  colideComBloqueio,
  formatarHorarioBR,
  gerarSlotsLivres,
  diaDaSemana,
  vendedorLivreNoCalendar,
} from '@/lib/googleCalendar';
import { chamarGAS } from '@/lib/gasClient';

const SUPORTE_EMAIL = 'suporte@metodointento.com.br';
const DUR_DEFAULT = 30;
const ANTECEDENCIA_MIN_HORAS = 4;
const DIAS_FRENTE = 7;
const TTL_IDEMPOTENCY_MS = 60 * 60 * 1000;

const idempotencyCache = new Map();

function checkIdempotency(key) {
  const v = idempotencyCache.get(key);
  if (!v) return null;
  if (Date.now() - v.ts > TTL_IDEMPOTENCY_MS) { idempotencyCache.delete(key); return null; }
  return v.response;
}
function saveIdempotency(key, response) {
  idempotencyCache.set(key, { ts: Date.now(), response });
}

const gas = chamarGAS;

export async function POST(request) {
  const token = request.headers.get('x-agent-token');
  if (!token || token !== process.env.AGENT_API_TOKEN) {
    return NextResponse.json({ status: 'erro', mensagem: 'Não autorizado' }, { status: 401 });
  }

  let corpo;
  try { corpo = await request.json(); }
  catch { return NextResponse.json({ status: 'erro', mensagem: 'JSON inválido' }, { status: 400 }); }

  const { horarioISO, idLead, idempotencyKey, durMin } = corpo;
  if (!horarioISO || !idLead || !idempotencyKey) {
    return NextResponse.json({
      status: 'erro',
      mensagem: 'horarioISO, idLead e idempotencyKey são obrigatórios',
    }, { status: 400 });
  }

  const cached = checkIdempotency(idempotencyKey);
  if (cached) return NextResponse.json(cached);

  const inicio = new Date(horarioISO);
  if (isNaN(inicio.getTime())) {
    return NextResponse.json({ status: 'erro', mensagem: 'horarioISO inválido' }, { status: 400 });
  }
  const dur = durMin || DUR_DEFAULT;
  const fim = new Date(inicio.getTime() + dur * 60 * 1000);

  const minimo = new Date(Date.now() + ANTECEDENCIA_MIN_HORAS * 60 * 60 * 1000);
  if (inicio < minimo) {
    return NextResponse.json({
      status: 'sem_vaga',
      motivo: `Horário precisa ser pelo menos ${ANTECEDENCIA_MIN_HORAS}h à frente`,
      sugestoes: [],
    });
  }

  try {
    const leadResp = await gas({ acao: 'buscarLead', idLead });
    if (leadResp.status !== 'sucesso') {
      return NextResponse.json({ status: 'erro', mensagem: 'lead não encontrado: ' + idLead }, { status: 404 });
    }
    const lead = leadResp.lead;

    const vendResp = await gas({ acao: 'listarVendedoresAtendimento' });
    if (vendResp.status !== 'sucesso') {
      return NextResponse.json({ status: 'erro', mensagem: vendResp.mensagem || 'falha ao listar vendedores' }, { status: 500 });
    }
    const vendedores = (vendResp.vendedores || []).filter((v) => v.horariosPadrao);
    if (vendedores.length === 0) {
      return NextResponse.json({ status: 'sem_vaga', motivo: 'Nenhum vendedor com horarios_padrao definido', sugestoes: [] });
    }

    const dia = diaDaSemana(inicio);
    const candidatosPorJanela = vendedores.filter((v) => cabeEmJanelas(inicio, fim, v.horariosPadrao[dia] || []));
    if (candidatosPorJanela.length === 0) {
      const sugestoes = await gerarSugestoesProximas(vendedores, dur);
      const response = {
        status: 'sem_vaga',
        motivo: 'Nenhum vendedor tem janela padrão cobrindo esse horário',
        sugestoes,
      };
      saveIdempotency(idempotencyKey, response);
      return NextResponse.json(response);
    }

    // Filtra os que NÃO têm exceção de bloqueio neste horário
    const dtIni = inicio.toISOString();
    const dtFim = fim.toISOString();
    const excPorVendedor = {};
    for (const v of candidatosPorJanela) {
      const r = await gas({ acao: 'listarExcecoesDisponibilidade', email: v.email, dtInicio: dtIni, dtFim });
      excPorVendedor[v.email] = (r.status === 'sucesso' ? r.excecoes : []) || [];
    }
    const livres = candidatosPorJanela.filter((v) => !colideComBloqueio(inicio, fim, excPorVendedor[v.email] || []));

    if (livres.length === 0) {
      const sugestoes = await gerarSugestoesProximas(vendedores, dur);
      const response = {
        status: 'sem_vaga',
        motivo: 'Vendedores com janela padrão estão bloqueados nesse horário',
        sugestoes,
      };
      saveIdempotency(idempotencyKey, response);
      return NextResponse.json(response);
    }

    // Anti double-booking: descarta vendedores cujo Calendar já tem evento conflitando
    const checksLivre = await Promise.all(
      livres.map(async (v) => {
        try {
          const free = await vendedorLivreNoCalendar(v.email, inicio.toISOString(), fim.toISOString());
          return free ? v : null;
        } catch (e) {
          console.warn('[agendar] freebusy falhou', v.email, e.message);
          return v; // se freebusy falhar, considera livre (não bloqueia agendamento)
        }
      })
    );
    const realmentelivres = checksLivre.filter(Boolean);

    if (realmentelivres.length === 0) {
      const sugestoes = await gerarSugestoesProximas(vendedores, dur);
      const response = {
        status: 'sem_vaga',
        motivo: 'Vendedores estão ocupados nesse horário (conflito no Calendar)',
        sugestoes,
      };
      saveIdempotency(idempotencyKey, response);
      return NextResponse.json(response);
    }

    // Round-robin: menor carga (qtd de "Reuniao agendada" no mês corrente)
    let escolhido = realmentelivres[0];
    if (realmentelivres.length > 1) {
      const cargaResp = await gas({ acao: 'cargaPorVendedorNoMes' });
      const cargas = (cargaResp.status === 'sucesso' ? cargaResp.cargas : null) || {};
      escolhido = realmentelivres
        .map((v) => ({ v, n: cargas[v.email] || 0 }))
        .sort((a, b) => a.n - b.n)[0].v;
    }

    const evento = await criarEvento({
      vendedorEmail: escolhido.email,
      inicioISO: inicio.toISOString(),
      fimISO: fim.toISOString(),
      titulo: `Reunião — ${lead.nome}`,
      descricao: [
        `Lead: ${lead.nome}`,
        `Telefone: ${lead.telefone || '—'}`,
        `Email: ${lead.email || '—'}`,
        `Origem: ${lead.origem || '—'}`,
        lead.anotacoes ? `\nAnotações:\n${lead.anotacoes}` : '',
      ].filter(Boolean).join('\n'),
      convidados: [lead.email, escolhido.email, SUPORTE_EMAIL].filter(Boolean),
    });

    await gas({
      acao: 'editarLead',
      idLead,
      vendedor: escolhido.email,
      dataProximaAcao: inicio.toISOString().slice(0, 10),
      gcalEventId: evento.eventId,
      porEmail: 'agente@sistema',
    });
    await gas({
      acao: 'moverLeadFase',
      idLead,
      novaFase: 'Reuniao agendada',
      porEmail: 'agente@sistema',
    });

    const response = {
      status: 'agendado',
      eventId: evento.eventId,
      vendedor: { email: escolhido.email, nome: escolhido.nome },
      horario: inicio.toISOString(),
      horarioBR: formatarHorarioBR(inicio.toISOString()),
      meetLink: evento.meetLink,
      calendarLink: evento.htmlLink,
    };
    saveIdempotency(idempotencyKey, response);
    return NextResponse.json(response);

  } catch (e) {
    console.error('[/api/agenda/agendar]', e);
    return NextResponse.json({ status: 'erro', mensagem: e.message }, { status: 500 });
  }
}

async function gerarSugestoesProximas(vendedores, dur) {
  const dtIni = new Date().toISOString();
  const dtFim = new Date(Date.now() + DIAS_FRENTE * 24 * 60 * 60 * 1000).toISOString();
  const r = await gas({ acao: 'listarExcecoesDisponibilidade', dtInicio: dtIni, dtFim });
  const excecoesAll = (r.status === 'sucesso' ? r.excecoes : []) || [];
  const excPorVendedor = {};
  for (const e of excecoesAll) {
    if (!excPorVendedor[e.vendedorEmail]) excPorVendedor[e.vendedorEmail] = [];
    excPorVendedor[e.vendedorEmail].push(e);
  }
  const conjunto = new Set();
  for (const v of vendedores) {
    const slots = gerarSlotsLivres(v.horariosPadrao, excPorVendedor[v.email] || [], DIAS_FRENTE, dur, ANTECEDENCIA_MIN_HORAS);
    for (const s of slots) conjunto.add(s);
  }
  return [...conjunto].sort().slice(0, 3).map((iso) => ({ horarioISO: iso, horarioBR: formatarHorarioBR(iso) }));
}
