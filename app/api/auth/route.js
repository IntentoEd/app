// app/api/auth/route.js
import { NextResponse } from 'next/server';
import { chamarGAS } from '@/lib/gasClient';

export async function POST(request) {
  try {
    const body = await request.json();
    const data = await chamarGAS({ acao: 'login', email: body.email });

    if (data.status === 'erro') {
      return NextResponse.json({ error: data.mensagem }, { status: 400 });
    }

    return NextResponse.json(data, { status: 200 });

  } catch (error) {
    console.error('Erro na API Auth:', error);
    return NextResponse.json({ error: 'Falha no servidor Next.js' }, { status: 500 });
  }
}