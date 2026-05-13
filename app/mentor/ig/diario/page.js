'use client';

import { apiFetch } from '@/lib/api';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMentor } from '@/lib/MentorContext';
import { LoadingInline } from '@/components/Loading';

const CATEGORIA_COR = {
  'Codificação': { bg: '#dbeafe', fg: '#1e3a8a' },
  'Revisão':     { bg: '#d1fae5', fg: '#065f46' },
  'Hábitos':     { bg: '#fef3c7', fg: '#78350f' },
  'Prova':       { bg: '#fee2e2', fg: '#7f1d1d' },
};

const RESULTADO_COR = {
  'Realizado':              { bg: '#d1fae5', fg: '#065f46' },
  'Realizado Parcialmente': { bg: '#fef3c7', fg: '#78350f' },
  'Não realizado':          { bg: '#fee2e2', fg: '#7f1d1d' },
};

function formatarData(d) {
  if (!d) return '';
  if (d instanceof Date) return d.toLocaleDateString('pt-BR');
  const s = String(d);
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) return s.split(' ')[0];
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) return dt.toLocaleDateString('pt-BR');
  return s;
}

function ExportarDiario() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const idPlanilha = searchParams.get('id') || '';
  const linhaParam = parseInt(searchParams.get('linha') || '0', 10);
  const nomeFromQuery = searchParams.get('nome') || '';

  const cardRef = useRef(null);
  const { emailMentor } = useMentor();
  const [encontro, setEncontro] = useState(null);
  const [nomeAluno, setNomeAluno] = useState(nomeFromQuery);
  const [carregando, setCarregando] = useState(true);
  const [exportando, setExportando] = useState(false);
  const [erro, setErro] = useState('');

  // Carrega o encontro específico
  useEffect(() => {
    if (!emailMentor || !idPlanilha) return;
    if (!linhaParam || linhaParam < 2) { setErro('Encontro inválido.'); setCarregando(false); return; }
    setCarregando(true);
    apiFetch('/api/mentor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'buscarDadosAluno', idPlanilhaAluno: idPlanilha }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.status !== 'sucesso') { setErro(d.mensagem || 'Erro ao carregar.'); return; }
        const enc = (d.diarios || []).find(e => e.linha === linhaParam);
        if (!enc) { setErro('Encontro não encontrado.'); return; }
        setEncontro(enc);
      })
      .catch(() => setErro('Erro de conexão.'))
      .finally(() => setCarregando(false));
  }, [emailMentor, idPlanilha, linhaParam]);

  const exportar = async () => {
    if (!cardRef.current || !encontro) return;
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
      const slug = (nomeAluno || 'aluno').replace(/\s+/g, '-').toLowerCase();
      const dataSlug = formatarData(encontro.data).replace(/\//g, '-');
      link.download = `intento-${slug}-diario-${dataSlug}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setExportando(false);
    }
  };

  const acoesRender = encontro
    ? encontro.acoes.map((a, i) => ({ acao: a, resultado: encontro.resultados?.[i] || '' })).filter(x => String(x.acao || '').trim() !== '')
    : [];

  const estrelas = parseInt(encontro?.autoavaliacao) || 0;
  const dataFmt = formatarData(encontro?.data);
  const catCor = CATEGORIA_COR[encontro?.categoria] || { bg: '#e2e8f0', fg: '#475569' };

  const secaoLabel = (texto) => (
    <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', marginBottom: 10 }}>
      {texto}
    </p>
  );

  return (
    <div className="min-h-screen bg-slate-100 font-sans">

      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center gap-4 justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/mentor/${idPlanilha}?nome=${encodeURIComponent(nomeAluno)}`} className="text-sm text-slate-400 hover:text-[#060242] font-medium transition">← Voltar</Link>
          <h1 className="text-base font-semibold text-[#060242]">Exportar Diário de Bordo</h1>
        </div>
        <button
          onClick={exportar}
          disabled={!encontro || exportando}
          className="bg-[#060242] text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-blue-900 transition disabled:opacity-40"
        >
          {exportando ? 'Gerando...' : 'Exportar PNG'}
        </button>
      </div>

      {carregando && <LoadingInline mensagem="Carregando encontro..." className="h-64" />}
      {erro && <div className="text-center text-red-500 font-medium text-sm mt-12">{erro}</div>}

      {encontro && !carregando && (
        <div className="py-10 flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-full shadow-sm">
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span className="text-xs font-semibold text-slate-500">Preview · exportado em <b className="text-slate-700">1360 × proporcional px</b> (2×)</span>
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
                  Diário de Bordo · {dataFmt}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ color: '#ffffff', fontWeight: 700, fontSize: 15 }}>{nomeAluno}</p>
                <p style={{ color: '#D4B726', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>Mentorado</p>
              </div>
            </div>

            {/* Corpo */}
            <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 22 }}>

              {/* Topo: categoria + autoavaliação */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                {encontro.categoria && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                    background: catCor.bg, color: catCor.fg, padding: '6px 12px', borderRadius: 999,
                  }}>
                    Desafio: {encontro.categoria}
                  </span>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Autoavaliação</span>
                  <div style={{ display: 'flex', gap: 2 }}>
                    {[1,2,3,4,5].map(n => (
                      <span key={n} style={{ fontSize: 16, color: n <= estrelas ? '#D4B726' : '#e2e8f0', lineHeight: 1 }}>★</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Vitórias e Desafios */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
                  {secaoLabel('Vitórias')}
                  <p style={{ fontSize: 12, color: '#1e293b', fontWeight: 500, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {encontro.vitorias || '—'}
                  </p>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
                  {secaoLabel('Maiores Desafios')}
                  <p style={{ fontSize: 12, color: '#1e293b', fontWeight: 500, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {encontro.desafios || '—'}
                  </p>
                </div>
              </div>

              {/* Exploração */}
              {encontro.exploracao && String(encontro.exploracao).trim() !== '' && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
                  {secaoLabel('Exploração e Ferramentas')}
                  <p style={{ fontSize: 12, color: '#1e293b', fontWeight: 500, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {encontro.exploracao}
                  </p>
                </div>
              )}

              {/* Metas */}
              {(() => {
                const metasArr = String(encontro.meta || '').split('\n').map(s => s.trim()).filter(Boolean);
                if (metasArr.length === 0) return null;
                return (
                  <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderLeft: '4px solid #D4B726', borderRadius: 12, padding: 14 }}>
                    {secaoLabel(metasArr.length === 1 ? 'Meta para o Próximo Encontro' : 'Metas para o Próximo Encontro')}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {metasArr.map((m, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          {metasArr.length > 1 && (
                            <span style={{
                              fontSize: 10, fontWeight: 700,
                              background: '#fde68a', color: '#78350f',
                              borderRadius: 4, padding: '2px 6px', minWidth: 18, textAlign: 'center', flexShrink: 0,
                            }}>{i + 1}</span>
                          )}
                          <p style={{ fontSize: 13, color: '#1e293b', fontWeight: 600, lineHeight: 1.4, margin: 0 }}>
                            {m}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Plano de Ação */}
              {acoesRender.length > 0 && (
                <div>
                  {secaoLabel('Plano de Ação e Resultados')}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {acoesRender.map((it, i) => {
                      const cor = RESULTADO_COR[it.resultado] || { bg: '#f1f5f9', fg: '#64748b' };
                      return (
                        <div key={i} style={{
                          background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10,
                          padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                        }}>
                          <span style={{ fontSize: 12, color: '#1e293b', fontWeight: 600, flex: 1 }}>
                            {i + 1}. {it.acao}
                          </span>
                          <span style={{
                            fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                            background: cor.bg, color: cor.fg, padding: '4px 10px', borderRadius: 6, whiteSpace: 'nowrap',
                          }}>
                            {it.resultado || 'Aguardando'}
                          </span>
                        </div>
                      );
                    })}
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
      <ExportarDiario />
    </Suspense>
  );
}
