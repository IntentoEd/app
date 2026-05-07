export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { gerarSlotsLivres, formatarHorarioBR } from '@/lib/googleCalendar';
import { chamarGAS } from '@/lib/gasClient';

const DUR_DEFAULT = 30;
const ANTECEDENCIA_MIN_HORAS = 4;
const DIAS_DEFAULT = 7;
const MAX_SUGESTOES = 30;

const gas = chamarGAS;

export async function GET(request) {
  const token = request.headers.get('x-agent-token');
  if (!token || token !== process.env.AGENT_API_TOKEN) {
    return NextResponse.json({ status: 'erro', mensagem: 'Não autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dias = Math.min(parseInt(searchParams.get('dias') || DIAS_DEFAULT, 10), 14);
  const dur = parseInt(searchParams.get('durMin') || DUR_DEFAULT, 10);

  try {
    const vendResp = await gas({ acao: 'listarVendedoresAtendimento' });
    if (vendResp.status !== 'sucesso') {
      return NextResponse.json({ status: 'erro', mensagem: vendResp.mensagem || 'falha ao listar vendedores' }, { status: 500 });
    }
    const vendedores = (vendResp.vendedores || []).filter((v) => v.horariosPadrao);
    if (vendedores.length === 0) {
      return NextResponse.json({ status: 'sucesso', sugestoes: [], total: 0, motivo: 'nenhum vendedor com horarios_padrao definido' });
    }

    const agora = new Date();
    const dtInicio = agora.toISOString();
    const dtFim = new Date(agora.getTime() + dias * 24 * 60 * 60 * 1000).toISOString();
    const excResp = await gas({ acao: 'listarExcecoesDisponibilidade', dtInicio, dtFim });
    const excecoes = (excResp.status === 'sucesso' ? excResp.excecoes : []) || [];
    const excecoesPorVendedor = {};
    for (const e of excecoes) {
      if (!excecoesPorVendedor[e.vendedorEmail]) excecoesPorVendedor[e.vendedorEmail] = [];
      excecoesPorVendedor[e.vendedorEmail].push(e);
    }

    const slotsPorIso = {};
    for (const v of vendedores) {
      const minhasExc = excecoesPorVendedor[v.email] || [];
      const slots = gerarSlotsLivres(v.horariosPadrao, minhasExc, dias, dur, ANTECEDENCIA_MIN_HORAS);
      for (const s of slots) {
        slotsPorIso[s] = (slotsPorIso[s] || 0) + 1;
      }
    }
    const ordenados = Object.keys(slotsPorIso).sort();
    const sugestoes = ordenados.slice(0, MAX_SUGESTOES).map((iso) => ({
      horarioISO: iso,
      horarioBR: formatarHorarioBR(iso),
      vendedoresLivres: slotsPorIso[iso],
    }));

    return NextResponse.json({ status: 'sucesso', sugestoes, total: sugestoes.length, dias, durMin: dur });
  } catch (e) {
    console.error('[/api/agenda/sugestoes]', e);
    return NextResponse.json({ status: 'erro', mensagem: e.message }, { status: 500 });
  }
}
