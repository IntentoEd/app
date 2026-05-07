export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cancelarEvento } from '@/lib/googleCalendar';
import { chamarGAS } from '@/lib/gasClient';

const gas = chamarGAS;

export async function POST(request) {
  const token = request.headers.get('x-agent-token');
  if (!token || token !== process.env.AGENT_API_TOKEN) {
    return NextResponse.json({ status: 'erro', mensagem: 'Não autorizado' }, { status: 401 });
  }

  let corpo;
  try { corpo = await request.json(); }
  catch { return NextResponse.json({ status: 'erro', mensagem: 'JSON inválido' }, { status: 400 }); }

  const { idLead } = corpo;
  if (!idLead) {
    return NextResponse.json({ status: 'erro', mensagem: 'idLead obrigatório' }, { status: 400 });
  }

  try {
    const leadResp = await gas({ acao: 'buscarLead', idLead });
    if (leadResp.status !== 'sucesso') {
      return NextResponse.json({ status: 'erro', mensagem: 'lead não encontrado' }, { status: 404 });
    }
    const lead = leadResp.lead;
    if (!lead.gcalEventId) {
      return NextResponse.json({ status: 'erro', mensagem: 'lead não tem reunião agendada' }, { status: 400 });
    }
    if (!lead.vendedor) {
      return NextResponse.json({ status: 'erro', mensagem: 'lead sem vendedor — inconsistente' }, { status: 500 });
    }

    await cancelarEvento({ vendedorEmail: lead.vendedor, eventId: lead.gcalEventId });

    // Limpa marcação no lead + volta fase pra Ativo WPP
    await gas({
      acao: 'editarLead',
      idLead,
      gcalEventId: '',
      dataProximaAcao: '',
      porEmail: 'agente@sistema',
    });
    await gas({
      acao: 'moverLeadFase',
      idLead,
      novaFase: 'Ativo WPP',
      porEmail: 'agente@sistema',
    });

    return NextResponse.json({ status: 'cancelado', idLead });

  } catch (e) {
    console.error('[/api/agenda/cancelar]', e);
    return NextResponse.json({ status: 'erro', mensagem: e.message }, { status: 500 });
  }
}
