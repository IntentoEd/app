'use client';

import { apiFetch } from '@/lib/api';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMentor } from '@/lib/MentorContext';
import { LoadingInline } from '@/components/Loading';

// ─── Paleta de cores por tema ────────────────────────────────────────────────
const borderColorMap = {
  emerald: '#10b981', purple: '#a855f7', blue: '#3b82f6',
  red: '#ef4444', slate: '#94a3b8',
};
const textColorMap = {
  emerald: '#065f46', purple: '#581c87', blue: '#1e3a8a',
  red: '#7f1d1d', slate: '#475569',
};

// Converte decimal (0–1) para % se o campo for de porcentagem
function formatarValor(nome, val) {
  const n = parseFloat(String(val ?? '').replace(',', '.'));
  if (isNaN(n)) return String(val ?? '');
  const isPercent = /domínio|progresso/i.test(String(nome));
  if (isPercent && n <= 1) return Math.round(n * 100) + '%';
  return String(val ?? '');
}

// ─── Mini Card estático (sem animações — html2canvas captura bem) ─────────────
function MiniCardExport({ item, isFirstWeek, fullBorder }) {
  if (!item) return null;
  const currFmt = formatarValor(item.name, item.curr);
  const prevFmt = formatarValor(item.name, item.prev);
  const currNum = parseFloat(String(currFmt).replace('%', '').replace(',', '.')) || 0;
  const prevNum = parseFloat(String(prevFmt).replace('%', '').replace(',', '.')) || 0;
  const diff = currNum - prevNum;
  const inverted = String(item.name ?? '').toLowerCase().includes('atrasad');
  const positivo = inverted ? diff < 0 : diff > 0;
  const theme = item.theme || 'slate';
  const borderColor = borderColorMap[theme];
  const textColor = textColorMap[theme];

  const cardStyle = fullBorder
    ? { borderLeft: `4px solid ${borderColor}`, background: '#fff', borderRadius: 12, border: `1px solid #e2e8f0`, borderLeftColor: borderColor, padding: 16 }
    : { background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 16 };

  return (
    <div style={cardStyle}>
      <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: fullBorder ? textColor : '#94a3b8', marginBottom: 6 }}>
        {item.name}
      </p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 28, fontWeight: 700, color: '#060242' }}>{currFmt}</span>
        {!isFirstWeek && diff !== 0 && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 9999,
            background: positivo ? '#d1fae5' : '#fee2e2',
            color: positivo ? '#065f46' : '#7f1d1d',
          }}>
            {diff > 0 ? '+' : ''}{diff % 1 === 0 ? diff.toFixed(0) : diff.toFixed(1)}
          </span>
        )}
      </div>
      {!isFirstWeek && (
        <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>anterior: {prevFmt || '—'}</p>
      )}
    </div>
  );
}

// ─── Utilitário: semana de referência ────────────────────────────────────────
function getSemanaRef() {
  const hoje = new Date();
  const domingo = new Date(hoje);
  domingo.setDate(hoje.getDate() - hoje.getDay() - 7);
  const sabado = new Date(domingo);
  sabado.setDate(domingo.getDate() + 6);
  const fmt = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return `${fmt(domingo)} – ${fmt(sabado)}`;
}

// ─── Página principal ─────────────────────────────────────────────────────────
function ExportarAcompanhamento() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const cardRef = useRef(null);
  const { alunos, marcarAcompanhamentoExportado } = useMentor();

  const [alunoId, setAlunoId] = useState(searchParams.get('id') || '');
  const [nomeAluno, setNomeAluno] = useState(decodeURIComponent(searchParams.get('nome') || ''));
  const [emailAluno, setEmailAluno] = useState('');
  const [dadosPainel, setDadosPainel] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [erro, setErro] = useState('');

  // Quando a lista de alunos chega via Context, resolve o email se houver ?id= na URL
  useEffect(() => {
    if (!alunos.length) return;
    const idParam = searchParams.get('id');
    if (idParam && !emailAluno) {
      const aluno = alunos.find(a => String(a.id) === String(idParam));
      if (aluno) setEmailAluno(aluno.email);
    }
  }, [alunos, searchParams, emailAluno]);

  // Carrega dados do aluno quando o email estiver disponível
  useEffect(() => {
    if (!emailAluno) return;
    setCarregando(true);
    setErro('');
    apiFetch('/api/mentor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'login', email: emailAluno }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.dadosPainel) setDadosPainel(d.dadosPainel);
        else setErro('Não foi possível carregar os dados deste aluno.');
      })
      .catch(() => setErro('Erro de conexão.'))
      .finally(() => setCarregando(false));
  }, [emailAluno]);

  const selecionarAluno = (id) => {
    const aluno = alunos.find(a => String(a.id) === String(id));
    if (!aluno) return;
    setAlunoId(id);
    setNomeAluno(aluno.nome);
    setEmailAluno(aluno.email);
  };

  const exportar = async () => {
    if (!cardRef.current) return;
    setExportando(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      const link = document.createElement('a');
      link.download = `intento-${nomeAluno.replace(/\s+/g, '-')}-semana.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      // Registra que o mentor exportou — sinal de "acompanhamento enviado"
      // (não-bloqueante: erro aqui não atrapalha o download).
      if (alunoId) {
        marcarAcompanhamentoExportado(alunoId); // otimista: badge atualiza no /mentor sem F5
        apiFetch('/api/mentor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ acao: 'registrarExportacao', idAluno: alunoId }),
        }).catch((e) => console.warn('[painel] registrarExportacao falhou:', e?.message));
      }
    } finally {
      setExportando(false);
    }
  };

  // Deriva os dados
  const semanal = dadosPainel?.semanal || { isFirstWeek: true, geral: [], estilo: [], desempenho: [] };
  const mensal = dadosPainel?.mensal || {};
  const historicoConsistencia = (mensal.horas || []).map((h, i) =>
    parseFloat(h) >= parseFloat(mensal.meta?.[i] || 0) && parseFloat(mensal.meta?.[i] || 0) > 0
  );
  const semanaRef = getSemanaRef();

  const secaoLabel = (texto) => (
    <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', marginBottom: 10 }}>
      {texto}
    </p>
  );

  return (
    <div className="min-h-screen bg-slate-100 font-sans">

      {/* ── Barra de controle ──────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center gap-4 justify-between">
        <div className="flex items-center gap-4">
          <Link href="/mentor" className="text-sm text-slate-400 hover:text-[#060242] font-medium transition">← Voltar</Link>
          <h1 className="text-base font-semibold text-[#060242]">Exportar Acompanhamento Semanal</h1>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={alunoId}
            onChange={e => selecionarAluno(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#060242] font-medium text-[#060242]"
          >
            <option value="">Selecionar aluno...</option>
            {alunos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
          <button
            onClick={exportar}
            disabled={!dadosPainel || exportando}
            className="bg-[#060242] text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-blue-900 transition disabled:opacity-40"
          >
            {exportando ? 'Gerando...' : 'Baixar PNG'}
          </button>
        </div>
      </div>

      {/* ── Estado vazio / loading ─────────────────────────────────── */}
      {!alunoId && (
        <div className="flex items-center justify-center h-64 text-slate-400 font-medium text-sm">
          Selecione um aluno para visualizar o card.
        </div>
      )}
      {alunoId && carregando && <LoadingInline mensagem="Carregando dados do aluno..." className="h-64" />}
      {erro && <div className="text-center text-red-500 font-medium text-sm mt-12">{erro}</div>}

      {/* ── Card exportável ────────────────────────────────────────── */}
      {dadosPainel && !carregando && (
        <div className="py-10 flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-full shadow-sm">
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span className="text-xs font-semibold text-slate-500">Preview em escala reduzida · exportado em <b className="text-slate-700">1360 × proporcional px</b> (2×)</span>
          </div>
          <div
            ref={cardRef}
            style={{
              width: 680,
              background: '#ffffff',
              borderRadius: 16,
              overflow: 'hidden',
              fontFamily: 'ui-sans-serif, system-ui, sans-serif',
              boxShadow: '0 4px 24px rgba(6,2,66,0.10)',
            }}
          >
            {/* Header */}
            <div style={{ background: '#060242', padding: '24px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{ width: 4, height: 20, background: '#D4B726', borderRadius: 2 }}></div>
                  <span style={{ color: '#ffffff', fontWeight: 700, fontSize: 16, letterSpacing: '0.04em' }}>INTENTO</span>
                </div>
                <p style={{ color: '#94a3b8', fontSize: 11, fontWeight: 500, marginTop: 2 }}>
                  Acompanhamento Semanal · {semanaRef}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ color: '#ffffff', fontWeight: 700, fontSize: 15 }}>{nomeAluno}</p>
                <p style={{ color: '#D4B726', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>Mentorado</p>
              </div>
            </div>

            {/* Corpo */}
            <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* Consistência */}
              <div>
                {secaoLabel('Consistência — Horas vs Meta')}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {historicoConsistencia.map((bateu, i) => (
                    <div key={i} style={{
                      width: 26, height: 26, borderRadius: 6,
                      background: bateu ? '#34d399' : '#fca5a5',
                    }} title={`Semana ${i + 1}`} />
                  ))}
                  {[...Array(Math.max(0, 4 - historicoConsistencia.length))].map((_, i) => (
                    <div key={`ph${i}`} style={{ width: 26, height: 26, borderRadius: 6, background: '#f1f5f9', border: '1px solid #e2e8f0' }} />
                  ))}
                </div>
              </div>

              {/* Aspectos Gerais */}
              {semanal.geral?.length > 0 && (
                <div>
                  {secaoLabel('Aspectos Gerais')}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                    {semanal.geral.map((item, i) => (
                      <MiniCardExport key={i} item={item} isFirstWeek={semanal.isFirstWeek} fullBorder={false} />
                    ))}
                  </div>
                </div>
              )}

              {/* Estilo de Vida */}
              {semanal.estilo?.length > 0 && (
                <div>
                  {secaoLabel('Estilo de Vida')}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                    {semanal.estilo.map((item, i) => (
                      <MiniCardExport key={i} item={item} isFirstWeek={semanal.isFirstWeek} fullBorder={false} />
                    ))}
                  </div>
                </div>
              )}

              {/* Desempenho */}
              {semanal.desempenho?.length > 0 && (
                <div>
                  {secaoLabel('Desempenho')}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                    {[0, 1, 2, 3].map(col => (
                      <div key={col} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {semanal.desempenho.slice(col * 2, col * 2 + 2).map((item, i) => (
                          <MiniCardExport key={i} item={item} isFirstWeek={semanal.isFirstWeek} fullBorder={true} />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Rodapé */}
            <div style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '14px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>metodointento.com.br</p>
              <p style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>@metodointento</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ExportarAcompanhamento />
    </Suspense>
  );
}
