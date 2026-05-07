export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { chamarGAS } from '@/lib/gasClient';

// Aceita 2 formatos de payload do Typebot/Make:
// (A) já mapeado: { nome, tipoPerfil, nomeRelacionado, telefone, ... }
// (B) cru do Typebot do Rafael: { name, nome_acr, nome_asr, nome_pais, nome_filho,
//      nome_responsavel, phone_formatted, medicina_ou_outros, editais_interesse, etc. }
// Em (B) o webhook decide tipoPerfil/nome/nomeRelacionado e concatena os extras
// (modalidade, motivo, histórico WPP) em `anotacoes`. Tudo o que vem cru é
// preservado em dados_typebot_raw na BD_Leads.

// Normaliza chaves: lowercase + remove acentos + colapsa espaços/hífens em underscore
// + aplica aliases conhecidos. Tolerante a "Name", "nome filho", "e-mail - pais", etc.
function normalizarChaves(obj) {
  const out = {};
  Object.keys(obj || {}).forEach((k) => {
    const limpa = String(k)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (limpa) out[limpa] = obj[k];
  });
  const aliases = {
    e_mail: 'email',
    e_mail_pais: 'email',
    email_pais: 'email',
    telefone_pais: 'telefone',
    phone_formatted: 'telefone',
    phone: 'telefone',
    motivo_da_busca: 'motivo_busca',
    esta_no: 'esta_em',
    nome_pai: 'nome_pais',
    nome_filho_pais: 'nome_filho',
    nome_aluno: 'nome_filho',
  };
  Object.keys(aliases).forEach((from) => {
    if (out[from] !== undefined && out[aliases[from]] === undefined) {
      out[aliases[from]] = out[from];
    }
  });
  return out;
}

function normalizarPayload(corpoOriginal) {
  const corpo = normalizarChaves(corpoOriginal);

  let nome = corpo.nome || '';
  let tipoPerfil = corpo.tipoperfil || corpo.tipo_perfil || '';
  let nomeRelacionado = corpo.nomerelacionado || corpo.nome_relacionado || '';

  if (!nome) {
    if (corpo.nome_pais || corpo.nome_filho) {
      tipoPerfil = 'pai';
      nome = corpo.nome_pais || corpo.name || '';
      nomeRelacionado = corpo.nome_filho || '';
    } else if (corpo.nome_acr) {
      tipoPerfil = 'self';
      nome = corpo.nome_acr;
      nomeRelacionado = corpo.nome_responsavel || '';
    } else if (corpo.nome_asr) {
      tipoPerfil = 'self';
      nome = corpo.nome_asr;
      nomeRelacionado = '';
    } else if (corpo.name) {
      tipoPerfil = tipoPerfil || 'self';
      nome = corpo.name;
    }
  }

  if (!tipoPerfil) tipoPerfil = 'self';

  const telefone = corpo.telefone || '';

  // Extras do Typebot que não cabem em colunas dedicadas vão pra anotações.
  // Preservados também em dados_typebot_raw (JSON cru).
  const linhasAnotacao = [
    corpo.anotacoes,
    corpo.esta_em ? `Modalidade: ${corpo.esta_em}` : null,
    corpo.motivo_busca ? `Motivo da busca: ${corpo.motivo_busca}` : null,
    corpo.deseja_comecar_em ? `Quer começar em: ${corpo.deseja_comecar_em}` : null,
    corpo.autoavaliacao_progresso ? `Autoavaliação progresso: ${corpo.autoavaliacao_progresso}` : null,
    corpo.finalizou_aplicacao ? `Finalizou typebot: ${corpo.finalizou_aplicacao}` : null,
    corpo.compromisso ? `Compromisso: ${corpo.compromisso}` : null,
    corpo.nome_asr ? '⚠ Aluno SEM responsável financeiro' : null,
    corpo.utm_campaign ? `UTM Campaign: ${corpo.utm_campaign}` : null,
    corpo.utm_adset ? `UTM Adset: ${corpo.utm_adset}` : null,
    corpo.utm_ad ? `UTM Ad: ${corpo.utm_ad}` : null,
    corpo.historico_conversa ? `\nHistórico WPP:\n${corpo.historico_conversa}` : null,
  ].filter(Boolean);

  return {
    nome,
    tipoPerfil,
    nomeRelacionado,
    telefone,
    email: corpo.email || '',
    cidade: corpo.cidade || '',
    estado: corpo.estado || '',
    orcamento: corpo.orcamento || corpo.orcamento_referido || '',
    tempoPreparando: corpo.tempopreparando || corpo.tempo_preparando || corpo.estuda_ha || '',
    vestibulares: corpo.vestibulares || corpo.editais_interesse || '',
    cursoInteresse: corpo.cursointeresse || corpo.curso_interesse || corpo.medicina_ou_outros || '',
    origem: corpo.origem || '',
    indicadoPor: corpo.indicadopor || corpo.indicado_por || corpo.mentor_indicacao || corpo.aluno_indicacao || '',
    anotacoes: linhasAnotacao.join('\n'),
    dadosTypebotRaw: corpoOriginal,
  };
}

// Tenta dar JSON.parse no body. Se falhar, conserta padrões comuns de
// Typebot/Make onde valores vêm embrulhados como array-string malformado:
//   "campo": "["valor"]"  →  "campo": "valor"
//   "campo": "[valor]"    →  "campo": "valor"
async function lerCorpoTolerante(request) {
  const texto = await request.text();
  try {
    return JSON.parse(texto);
  } catch (e1) {
    const consertado = texto
      .replace(/:\s*"\["([^"]*)"\]"/g, ': "$1"')
      .replace(/:\s*"\[([^"\]]*)\]"/g, ': "$1"');
    return JSON.parse(consertado);
  }
}

export async function POST(request) {
  const segredo = request.headers.get('x-webhook-secret');
  const esperado = process.env.LEADS_WEBHOOK_SECRET;
  if (!esperado || segredo !== esperado) {
    return NextResponse.json({ status: 'erro', mensagem: 'Não autorizado' }, { status: 401 });
  }

  try {
    const corpo = await lerCorpoTolerante(request);
    const norm = normalizarPayload(corpo);

    if (!norm.nome || !norm.telefone) {
      return NextResponse.json(
        { status: 'erro', mensagem: 'nome e telefone são obrigatórios (envie nome OU nome_acr/nome_asr/nome_pais/name + telefone OU phone_formatted)' },
        { status: 400 }
      );
    }

    const payload = {
      acao: 'criarLead',
      porEmail: 'webhook@sistema',
      vendedor: '',
      fase: 'Lead',
      ...norm,
    };

    const data = await chamarGAS(payload);

    if (data.status === 'erro') return NextResponse.json(data, { status: 500 });
    return NextResponse.json(data);

  } catch (error) {
    console.error('[webhook leads] erro:', error);
    return NextResponse.json(
      { status: 'erro', mensagem: error.message },
      { status: 500 }
    );
  }
}
