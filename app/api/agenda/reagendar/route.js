export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cancelarEvento } from '@/lib/googleCalendar';
import { chamarGAS } from '@/lib/gasClient';

const gas = chamarGAS;

// Reagenda = cancela existente + agenda novo. Faz internamente chamando
// /api/agenda/agendar pra reaproveitar toda a lógica de validação/escolha.
export async function POST(request) {
  const token = request.headers.get('x-agent-token');
  if (!token || token !== process.env.AGENT_API_TOKEN) {
    return NextResponse.json({ status: 'erro', mensagem: 'Não autorizado' }, { status: 401 });
  }

  let corpo;
  try { corpo = await request.json(); }
  catch { return NextResponse.json({ status: 'erro', mensagem: 'JSON inválido' }, { status: 400 }); }

  const { idLead, novoHorarioISO, idempotencyKey } = corpo;
  if (!idLead || !novoHorarioISO || !idempotencyKey) {
    return NextResponse.json({
      status: 'erro',
      mensagem: 'idLead, novoHorarioISO e idempotencyKey obrigatórios',
    }, { status: 400 });
  }

  try {
    // Cancela evento atual (se houver) — não falha se já apagado
    const leadResp = await gas({ acao: 'buscarLead', idLead });
    if (leadResp.status !== 'sucesso') {
      return NextResponse.json({ status: 'erro', mensagem: 'lead não encontrado' }, { status: 404 });
    }
    const lead = leadResp.lead;
    if (lead.gcalEventId && lead.vendedor) {
      try {
        await cancelarEvento({ vendedorEmail: lead.vendedor, eventId: lead.gcalEventId });
      } catch (e) {
        console.warn('reagendar: falha cancel antigo (ignorando):', e.message);
      }
      // Limpa o eventId antes de re-agendar
      await gas({
        acao: 'editarLead',
        idLead,
        gcalEventId: '',
        porEmail: 'agente@sistema',
      });
    }

    // Reuso /agendar internamente
    const origin = new URL(request.url).origin;
    const res = await fetch(`${origin}/api/agenda/agendar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-token': process.env.AGENT_API_TOKEN,
      },
      body: JSON.stringify({
        horarioISO: novoHorarioISO,
        idLead,
        idempotencyKey,
      }),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });

  } catch (e) {
    console.error('[/api/agenda/reagendar]', e);
    return NextResponse.json({ status: 'erro', mensagem: e.message }, { status: 500 });
  }
}
