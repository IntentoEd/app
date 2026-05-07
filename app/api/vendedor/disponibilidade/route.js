export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { verificarUsuario } from '@/lib/auth';
import { chamarGAS } from '@/lib/gasClient';

const gas = chamarGAS;

export async function POST(request) {
  // Auth obrigatória — Firebase ID token verificado.
  const usuario = await verificarUsuario(request);
  if (!usuario) {
    return NextResponse.json(
      { status: 'erro', mensagem: 'Não autorizado: token inválido ou ausente' },
      { status: 401 }
    );
  }
  const email = usuario.email;

  let corpo;
  try { corpo = await request.json(); }
  catch { return NextResponse.json({ status: 'erro', mensagem: 'JSON inválido' }, { status: 400 }); }

  const { acao } = corpo;

  try {
    if (acao === 'ler') {
      const [horariosResp, excResp] = await Promise.all([
        gas({ acao: 'lerHorariosPadrao', email }),
        gas({ acao: 'listarExcecoesDisponibilidade', email }),
      ]);
      if (horariosResp.status !== 'sucesso') {
        return NextResponse.json(horariosResp, { status: 400 });
      }
      return NextResponse.json({
        status: 'sucesso',
        email: horariosResp.email,
        nome: horariosResp.nome,
        horariosPadrao: horariosResp.horariosPadrao,
        excecoes: excResp.status === 'sucesso' ? excResp.excecoes : [],
      });
    }

    if (acao === 'salvarHorarios') {
      const { horarios } = corpo;
      const r = await gas({ acao: 'salvarHorariosPadrao', email, horarios });
      return NextResponse.json(r, { status: r.status === 'sucesso' ? 200 : 400 });
    }

    if (acao === 'criarExcecao') {
      const { tipo, dtInicio, dtFim, motivo } = corpo;
      const r = await gas({
        acao: 'criarExcecaoDisponibilidade',
        email, tipo, dtInicio, dtFim, motivo, criadoPor: email,
      });
      return NextResponse.json(r, { status: r.status === 'sucesso' ? 200 : 400 });
    }

    if (acao === 'removerExcecao') {
      const { id } = corpo;
      const r = await gas({ acao: 'removerExcecaoDisponibilidade', id, criadoPor: email });
      return NextResponse.json(r, { status: r.status === 'sucesso' ? 200 : 400 });
    }

    return NextResponse.json({ status: 'erro', mensagem: 'ação inválida: ' + acao }, { status: 400 });

  } catch (e) {
    console.error('[/api/vendedor/disponibilidade]', e);
    return NextResponse.json({ status: 'erro', mensagem: 'Erro interno' }, { status: 500 });
  }
}
