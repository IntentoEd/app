'use client';

import { apiFetch } from '@/lib/api';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Line } from '@/components/Charts';
import { LoadingScreen, LoadingInline } from '@/components/Loading';
import AbaProvas from '@/components/AbaProvas';

// ── Colunas do histórico (índices da array retornada pelo backend) ──────────
// [0]Semana [1]Mês [2]Data [3]Meta [4]Horas [5]Domínio [6]Progresso [7]Revisões
// [8]Estresse [9]Ansiedade [10]Motivação [11]Sono
// [12]D.BIO [13]P.BIO [14]D.QUI [15]P.QUI [16]D.FIS [17]P.FIS [18]D.MAT [19]P.MAT

// Colunas que chegam como decimal (0–1) e devem ser exibidas como %
const COLUNAS_PERCENT = new Set([5, 6, 12, 13, 14, 15, 16, 17, 18, 19]);

const toPercent = (val) => {
  const n = parseFloat(String(val ?? '').replace(',', '.'));
  if (isNaN(n)) return null;
  // Se já for maior que 1, assume que veio formatado (ex: 68 = 68%)
  return n <= 1 ? Math.round(n * 100) : Math.round(n);
};

const VISOES = [
  { id: 'geral',      label: 'Geral',       cols: [0, 3, 4, 5, 6, 7] },
  { id: 'emocional',  label: 'Emocional',   cols: [0, 8, 9, 10, 11] },
  { id: 'disciplinas',label: 'Disciplinas', cols: [0, 12, 13, 14, 15, 16, 17, 18, 19] },
];

const COL_LABELS = [
  'Semana','Mês','Data','Meta','Horas','Domínio (%)','Progresso (%)','Revisões Atras.',
  'Estresse','Ansiedade','Motivação','Sono',
  'D. BIO','P. BIO','D. QUI','P. QUI','D. FIS','P. FIS','D. MAT','P. MAT',
];

const COL_COLORS = [
  '','','','','','','','',
  '','','','',
  'text-emerald-600','text-emerald-600','text-blue-500','text-blue-500',
  'text-orange-500','text-orange-500','text-purple-500','text-purple-500',
];

function valorColor() {
  return '';
}

// Configurações por visão para o gráfico temporal
// Para a visão "geral", yAxisID separa escalas: yPercent (0-100%) e yRaw (valores brutos)
const GERAL_CONFIG = [
  { key: 'dominio',   label: 'Domínio (%)',     col: 5, color: '#D4B726', yAxisID: 'yPercent' },
  { key: 'progresso', label: 'Progresso (%)',   col: 6, color: '#10b981', yAxisID: 'yPercent' },
  { key: 'horas',     label: 'Horas Estudadas', col: 4, color: '#060242', yAxisID: 'yRaw' },
  { key: 'meta',      label: 'Meta Semanal',    col: 3, color: '#94a3b8', yAxisID: 'yRaw' },
  { key: 'revisoes',  label: 'Revisões Atras.', col: 7, color: '#f87171', yAxisID: 'yRaw' },
];

const EMOCIONAL_CONFIG = [
  { label: 'Estresse',   col: 8,  color: '#f87171' },
  { label: 'Ansiedade',  col: 9,  color: '#fb923c' },
  { label: 'Motivação',  col: 10, color: '#10b981' },
  { label: 'Sono',       col: 11, color: '#a855f7' },
];

const DISCIPLINAS_CONFIG = [
  { key: 'BIO', label: 'Biologia',   color: '#10b981', dCol: 12, pCol: 13 },
  { key: 'QUI', label: 'Química',    color: '#3b82f6', dCol: 14, pCol: 15 },
  { key: 'FIS', label: 'Física',     color: '#fb923c', dCol: 16, pCol: 17 },
  { key: 'MAT', label: 'Matemática', color: '#a855f7', dCol: 18, pCol: 19 },
];

function GraficoTemporal({ registros, series, isGeral }) {
  const labels = registros.map(r => r[0] || '');

  const data = {
    labels,
    datasets: series.map(s => ({
      label: s.label,
      data: registros.map(r => {
        if (COLUNAS_PERCENT.has(s.col)) return toPercent(r[s.col]);
        const v = parseFloat(String(r[s.col] ?? '').replace(',', '.'));
        return isNaN(v) ? null : v;
      }),
      borderColor: s.color,
      backgroundColor: s.color + '18',
      pointBackgroundColor: s.color,
      pointRadius: registros.length <= 8 ? 4 : 2,
      pointHoverRadius: 6,
      borderWidth: 2,
      tension: 0.35,
      fill: false,
      spanGaps: true,
      ...(s.borderDash ? { borderDash: s.borderDash } : {}),
      ...(isGeral && s.yAxisID ? { yAxisID: s.yAxisID } : {}),
    })),
  };

  const hasPercent = isGeral && series.some(s => s.yAxisID === 'yPercent');
  const hasRaw     = isGeral && series.some(s => s.yAxisID === 'yRaw');

  const axisBase = {
    grid: { color: '#f1f5f9' },
    ticks: {
      font: { size: 10, family: 'ui-sans-serif, system-ui, sans-serif' },
      color: '#94a3b8',
      padding: 8,
    },
    border: { display: false, dash: [4, 4] },
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: {
          boxWidth: 8,
          boxHeight: 8,
          borderRadius: 4,
          useBorderRadius: true,
          font: { size: 11, family: 'ui-sans-serif, system-ui, sans-serif', weight: '600' },
          color: '#64748b',
          padding: 16,
        },
      },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#94a3b8',
        bodyColor: '#f1f5f9',
        padding: 12,
        cornerRadius: 8,
        titleFont: { size: 11 },
        bodyFont: { size: 12, weight: '600' },
        callbacks: {
          label: (ctx) => {
            const s = series[ctx.datasetIndex];
            const suffix = COLUNAS_PERCENT.has(s.col) ? '%' : '';
            return ` ${ctx.dataset.label}: ${ctx.parsed.y ?? '—'}${suffix}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          font: { size: 10, family: 'ui-sans-serif, system-ui, sans-serif' },
          color: '#94a3b8',
          maxRotation: 35,
          maxTicksLimit: 12,
        },
        border: { display: false },
      },
      ...(isGeral ? {
        ...(hasPercent ? {
          yPercent: {
            ...axisBase,
            type: 'linear',
            position: 'left',
            min: 0,
            max: 100,
            ticks: {
              ...axisBase.ticks,
              callback: (v) => v + '%',
            },
            title: {
              display: true,
              text: 'Domínio / Progresso',
              font: { size: 9, weight: '600' },
              color: '#94a3b8',
            },
          },
        } : {}),
        ...(hasRaw ? {
          yRaw: {
            ...axisBase,
            type: 'linear',
            position: hasPercent ? 'right' : 'left',
            grid: hasPercent ? { display: false } : { color: '#f1f5f9' },
            ticks: {
              ...axisBase.ticks,
              color: hasPercent ? '#cbd5e1' : '#94a3b8',
            },
            title: {
              display: true,
              text: 'Horas / Revisões',
              font: { size: 9, weight: '600' },
              color: hasPercent ? '#cbd5e1' : '#94a3b8',
            },
          },
        } : {}),
      } : {
        y: {
          ...axisBase,
        },
      }),
    },
  };

  return (
    <div style={{ height: 220 }}>
      <Line data={data} options={options} />
    </div>
  );
}

const EDIT_FIELDS = [
  { idx: 0,  label: 'Semana',        type: 'text' },
  { idx: 1,  label: 'Mês',           type: 'text' },
  { idx: 2,  label: 'Data',          type: 'date' },
  { idx: 3,  label: 'Meta (h)',       type: 'number' },
  { idx: 4,  label: 'Horas Estudadas', type: 'number' },
  { idx: 5,  label: 'Domínio (0–1)',  type: 'number', step: '0.01' },
  { idx: 6,  label: 'Progresso (0–1)', type: 'number', step: '0.01' },
  { idx: 7,  label: 'Revisões Atras.', type: 'number' },
  { idx: 8,  label: 'Estresse (1–10)', type: 'number' },
  { idx: 9,  label: 'Ansiedade (1–10)', type: 'number' },
  { idx: 10, label: 'Motivação (1–10)', type: 'number' },
  { idx: 11, label: 'Sono (h)',       type: 'number' },
  { idx: 12, label: 'Domínio BIO',   type: 'number', step: '0.01' },
  { idx: 13, label: 'Prog. BIO',     type: 'number', step: '0.01' },
  { idx: 14, label: 'Domínio QUI',   type: 'number', step: '0.01' },
  { idx: 15, label: 'Prog. QUI',     type: 'number', step: '0.01' },
  { idx: 16, label: 'Domínio FIS',   type: 'number', step: '0.01' },
  { idx: 17, label: 'Prog. FIS',     type: 'number', step: '0.01' },
  { idx: 18, label: 'Domínio MAT',   type: 'number', step: '0.01' },
  { idx: 19, label: 'Prog. MAT',     type: 'number', step: '0.01' },
];

function HistoricoAnalitico({ registros, cardClass, idPlanilha, onUpdate }) {
  const [visao, setVisao] = useState('geral');
  const [editIdx, setEditIdx] = useState(null);
  const [formEdit, setFormEdit] = useState({});
  const [salvando, setSalvando] = useState(false);

  // Filtros do gráfico Geral (quais variáveis exibir)
  const [geralFiltro, setGeralFiltro] = useState(() => new Set(GERAL_CONFIG.map(c => c.key)));
  // Filtros do gráfico Disciplinas (métricas e disciplinas exibidas)
  const [discMetricas, setDiscMetricas] = useState(() => new Set(['dominio']));
  const [discFiltro,   setDiscFiltro]   = useState(() => new Set(DISCIPLINAS_CONFIG.map(d => d.key)));

  const toggleSet = (setter, value, { allowEmpty = false } = {}) => {
    setter(prev => {
      const next = new Set(prev);
      if (next.has(value)) {
        if (!allowEmpty && next.size === 1) return next;
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  };

  const chartSeries = (() => {
    if (visao === 'emocional') return EMOCIONAL_CONFIG;
    if (visao === 'geral') return GERAL_CONFIG.filter(c => geralFiltro.has(c.key));
    const out = [];
    DISCIPLINAS_CONFIG.forEach(d => {
      if (!discFiltro.has(d.key)) return;
      if (discMetricas.has('dominio')) {
        out.push({ label: `${d.label} · Dom.`, col: d.dCol, color: d.color });
      }
      if (discMetricas.has('progresso')) {
        out.push({ label: `${d.label} · Prog.`, col: d.pCol, color: d.color, borderDash: [6, 4] });
      }
    });
    return out;
  })();

  const cols = VISOES.find(v => v.id === visao)?.cols || VISOES[0].cols;

  const abrirEdit = (i) => {
    const row = registros[i];
    const form = {};
    EDIT_FIELDS.forEach(f => { form[f.idx] = row[f.idx] ?? ''; });
    setFormEdit(form);
    setEditIdx(i);
  };

  const salvarEdit = async () => {
    if (salvando) return;
    setSalvando(true);
    const novaRow = registros[editIdx].map((_, ci) => formEdit[ci] !== undefined ? formEdit[ci] : registros[editIdx][ci]);
    try {
      await apiFetch('/api/mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'editarRegistro', idPlanilha, semana: registros[editIdx][0], dataRegistro: registros[editIdx][2], valores: novaRow }),
      });
      onUpdate?.(editIdx, novaRow);
      setEditIdx(null);
    } catch { /* silencia */ }
    finally { setSalvando(false); }
  };

  if (!registros || registros.length === 0) {
    return (
      <div className={cardClass + ' text-center py-12 text-slate-400 text-sm font-medium'}>
        Nenhum registro encontrado.
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in">

      {/* ── Gráfico temporal ── */}
      <div className={cardClass}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-sm font-bold text-intento-blue">Evolução Temporal</h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              {registros.length} semana{registros.length !== 1 ? 's' : ''} registrada{registros.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
            {VISOES.map(v => (
              <button key={v.id} onClick={() => setVisao(v.id)}
                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${visao === v.id ? 'bg-white text-intento-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {visao === 'geral' && (
          <div className="flex flex-wrap items-center gap-1.5 mb-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">Variáveis:</span>
            {GERAL_CONFIG.map(c => {
              const active = geralFiltro.has(c.key);
              return (
                <button
                  key={c.key}
                  onClick={() => toggleSet(setGeralFiltro, c.key)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all ${active ? 'text-white shadow-sm' : 'text-slate-400 bg-white border-slate-200 hover:border-slate-300'}`}
                  style={active ? { backgroundColor: c.color, borderColor: c.color } : {}}
                  title={active ? 'Ocultar' : 'Mostrar'}
                >
                  <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle" style={{ backgroundColor: active ? '#fff' : c.color }}></span>
                  {c.label}
                </button>
              );
            })}
          </div>
        )}

        {visao === 'disciplinas' && (
          <div className="flex flex-col sm:flex-row sm:items-center flex-wrap gap-3 mb-4">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">Métrica:</span>
              <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
                {[{ key: 'dominio', label: 'Domínio' }, { key: 'progresso', label: 'Progresso' }].map(m => {
                  const active = discMetricas.has(m.key);
                  return (
                    <button
                      key={m.key}
                      onClick={() => toggleSet(setDiscMetricas, m.key)}
                      className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${active ? 'bg-white text-intento-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">Disciplinas:</span>
              {DISCIPLINAS_CONFIG.map(d => {
                const active = discFiltro.has(d.key);
                return (
                  <button
                    key={d.key}
                    onClick={() => toggleSet(setDiscFiltro, d.key)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all ${active ? 'text-white shadow-sm' : 'text-slate-400 bg-white border-slate-200 hover:border-slate-300'}`}
                    style={active ? { backgroundColor: d.color, borderColor: d.color } : {}}
                  >
                    <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle" style={{ backgroundColor: active ? '#fff' : d.color }}></span>
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {chartSeries.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs font-medium">
            Selecione ao menos uma variável para visualizar o gráfico.
          </div>
        ) : (
          <GraficoTemporal registros={registros} series={chartSeries} isGeral={visao === 'geral'} />
        )}
      </div>

      {/* ── Tabela de dados brutos ── */}
      <div className={cardClass + ' overflow-hidden'}>
        <h2 className="text-sm font-bold text-intento-blue mb-4">Dados Brutos</h2>
        <div className="overflow-x-auto scroll-fade-right">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {cols.map(ci => (
                  <th key={ci} className={`p-3 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${ci === 0 ? 'sticky left-0 bg-slate-50' : ''} ${COL_COLORS[ci] || 'text-slate-400'}`}>
                    {COL_LABELS[ci]}
                  </th>
                ))}
                <th className="p-3 text-[10px] font-bold uppercase tracking-wider text-slate-300"></th>
              </tr>
            </thead>
            <tbody>
              {registros.map((reg, i) => (
                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors group">
                  {cols.map((ci) => (
                    <td key={ci} className={`p-3 whitespace-nowrap ${ci === 0 ? 'sticky left-0 bg-white font-bold text-intento-blue text-xs' : `font-medium ${valorColor(ci, reg[ci]) || 'text-slate-600'}`}`}>
                      {COLUNAS_PERCENT.has(ci)
                        ? (toPercent(reg[ci]) !== null ? `${toPercent(reg[ci])}%` : '—')
                        : (reg[ci] ?? '—')}
                    </td>
                  ))}
                  <td className="p-3">
                    <button onClick={() => abrirEdit(i)} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-intento-blue" title="Editar registro">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal de edição ── */}
      {editIdx !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-intento-blue/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-lg flex flex-col overflow-hidden max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h2 className="text-sm font-semibold text-intento-blue">Editar Registro — {registros[editIdx][0]}</h2>
              <button onClick={() => setEditIdx(null)} className="text-slate-300 hover:text-slate-500 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="overflow-y-auto p-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {EDIT_FIELDS.map(f => (
                  <div key={f.idx}>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{f.label}</label>
                    <input
                      type={f.type}
                      step={f.step || undefined}
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-sm font-medium text-intento-blue outline-none focus:ring-2 focus:ring-intento-blue"
                      value={formEdit[f.idx] ?? ''}
                      onChange={e => setFormEdit(prev => ({ ...prev, [f.idx]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 shrink-0">
              <button onClick={() => setEditIdx(null)} className="px-5 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-all">Cancelar</button>
              <button onClick={salvarEdit} disabled={salvando} className="px-5 py-2 rounded-lg bg-intento-blue text-white text-sm font-semibold hover:bg-blue-900 transition-all disabled:opacity-60">
                {salvando ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- ESTÉTICA INTENTO ---
const cardClass = "bg-white rounded-xl border border-slate-200 p-6 shadow-sm transition-colors";
const inputClass = "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-intento-blue transition-all font-medium text-intento-blue";
const labelClass = "block text-xs font-medium text-slate-400 uppercase mb-2 tracking-wider";

// --- CONSTANTES ---
const DIAS = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];
const HORARIOS = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00'];
const CATEGORIAS = {
  'Codificação': { cor: 'bg-blue-100 text-blue-800 border-blue-200',    btn: 'bg-blue-500 hover:bg-blue-600 text-white',    dot: 'bg-blue-500'    },
  'Revisão':     { cor: 'bg-emerald-100 text-emerald-800 border-emerald-200', btn: 'bg-emerald-500 hover:bg-emerald-600 text-white', dot: 'bg-emerald-500' },
  'Hábitos':     { cor: 'bg-yellow-100 text-yellow-800 border-yellow-200',  btn: 'bg-yellow-500 hover:bg-yellow-600 text-white',  dot: 'bg-yellow-500'  },
  'Aula':        { cor: 'bg-violet-100 text-violet-800 border-violet-200',  btn: 'bg-violet-500 hover:bg-violet-600 text-white',  dot: 'bg-violet-500'  },
  'Simulados':   { cor: 'bg-red-100 text-red-800 border-red-200',          btn: 'bg-red-500 hover:bg-red-600 text-white',          dot: 'bg-red-500'    },
  'Outros':      { cor: 'bg-slate-100 text-slate-800 border-slate-200',    btn: 'bg-slate-400 hover:bg-slate-500 text-white',    dot: 'bg-slate-400'   },
};

const TEMPLATE_BASE = (() => {
  const dias = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const exercicio = new Set(['Segunda-feira', 'Quarta-feira', 'Sexta-feira']);
  const tpl = {};
  dias.forEach(dia => {
    tpl[`${dia}_08:00`] = { categoria: 'Revisão',     label: '[Revisão] - Revisão' };
    tpl[`${dia}_09:00`] = { categoria: 'Codificação', label: '[Codificação] - Matéria principal' };
    tpl[`${dia}_10:00`] = { categoria: 'Codificação', label: '[Codificação] - Matéria principal' };
    tpl[`${dia}_11:00`] = { categoria: 'Codificação', label: '[Codificação] - Matéria principal' };
    tpl[`${dia}_14:00`] = { categoria: 'Revisão',     label: '[Revisão] - Revisão' };
    tpl[`${dia}_15:00`] = { categoria: 'Codificação', label: '[Codificação] - Matéria principal' };
    tpl[`${dia}_16:00`] = { categoria: 'Codificação', label: '[Codificação] - Matéria principal' };
    if (exercicio.has(dia)) {
      tpl[`${dia}_17:00`] = { categoria: 'Hábitos',   label: '[Hábitos] - Exercício Físico' };
    }
  });
  return tpl;
})();

// Aluno EM: aulas de Seg-Sex das 07h às 13h (6 slots: 07, 08, 09, 10, 11, 12).
// Tardes ficam vazias por design — mentor + aluno preenchem na sessão.
const TEMPLATE_EM_ESCOLAR = (() => {
  const dias = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'];
  const horas = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00'];
  const tpl = {};
  dias.forEach(dia => {
    horas.forEach(hora => {
      tpl[`${dia}_${hora}`] = { categoria: 'Aula', label: '[Aula] - Escola' };
    });
  });
  return tpl;
})();

const TEMPLATES = [
  { id: 'vestibulando', nome: 'Vestibulando (manhã + tarde)', grade: TEMPLATE_BASE },
  { id: 'em',           nome: 'EM (escola 07-13h)',           grade: TEMPLATE_EM_ESCOLAR },
];

// As opções restritas para o Diário
const CATEGORIAS_DESAFIO = ['Codificação', 'Revisão', 'Hábitos', 'Prova'];

const MAX_METAS = 3;
const parseMetas = (raw) => {
  const arr = String(raw || '').split('\n').map(s => s.trim());
  return Array.from({ length: MAX_METAS }, (_, i) => arr[i] || '');
};
const serializeMetas = (metasArr) =>
  (metasArr || []).map(m => String(m || '').trim()).filter(Boolean).join('\n');

const STATUS_META_OPCOES = ['Batida', 'Parcial', 'Não batida'];
const COR_STATUS_META = {
  'Batida':     'bg-emerald-100 text-emerald-800',
  'Parcial':    'bg-yellow-100 text-yellow-800',
  'Não batida': 'bg-red-100 text-red-800',
};
const parseStatusMetas = (raw) => {
  // serializado com \n mantendo posição (vazios preservados)
  const arr = String(raw || '').split('\n');
  return Array.from({ length: MAX_METAS }, (_, i) => arr[i] || '');
};
const serializeStatusMetas = (statusArr) =>
  (statusArr || []).slice(0, MAX_METAS).map(s => String(s || '').trim()).join('\n');

// COMPONENTE: Estrelas de Avaliação
const StarRating = ({ rating, setRating, readOnly = false, small = false }) => {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onClick={() => !readOnly && setRating(star)}
          className={`${small ? 'text-sm' : 'text-3xl'} transition-transform ${star <= rating ? 'text-intento-yellow' : 'text-slate-200'} ${readOnly ? 'cursor-default' : 'cursor-pointer hover:scale-110'}`}
        >
          ★
        </button>
      ))}
    </div>
  );
};

export default function GestaoIndividualAluno() {
  const params = useParams();
  const searchParams = useSearchParams();
  const nomeAluno = searchParams.get('nome');
  const router = useRouter();

  const [carregando, setCarregando] = useState(true);
  const [historicoDiarios, setHistoricoDiarios] = useState([]);
  const [historicoRegistros, setHistoricoRegistros] = useState([]);
  const [dadosSimulados, setDadosSimulados] = useState({ kpi: null, hist: null, lista: [] });
  const [simuladoAberto, setSimuladoAberto] = useState(null);
  const [abaInterna, setAbaInterna] = useState('diario');
  const [statusMsg, setStatusMsg] = useState("");
  const [salvandoEncontro, setSalvandoEncontro] = useState(false);
  const [gradeModificada, setGradeModificada] = useState(false);
  const [salvandoRotina, setSalvandoRotina] = useState(false);
  const [dadosOnboarding, setDadosOnboarding] = useState(null);
  const [dadosDiagnostico, setDadosDiagnostico] = useState(null);
  const [carregandoOnboarding, setCarregandoOnboarding] = useState(false);
  const [erroOnboarding, setErroOnboarding] = useState('');

  // Fac-símile EM: tipoAluno e escola vêm do BD_Alunos via buscarDadosAluno.
  // Aba "Provas" só renderiza se tipoAluno === 'EM'.
  const [tipoAluno, setTipoAluno] = useState('ENEM');
  const [escolaAluno, setEscolaAluno] = useState('');

  // ESTADOS DO DIÁRIO
  const [avaliacaoPendente, setAvaliacaoPendente] = useState(false);
  const [encontroPendente, setEncontroPendente] = useState(null);
  const [formAvaliacao, setFormAvaliacao] = useState(["", "", "", "", ""]);
  const [expandidoId, setExpandidoId] = useState(null); 
  
  // O Estado do Modal
  const [modalAberto, setModalAberto] = useState(false);
  const [metasPassadas, setMetasPassadas] = useState(["", "", ""]);

  // Edição de encontro do diário
  const [encontroEdit, setEncontroEdit] = useState(null);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  const [formDiario, setFormDiario] = useState({
    autoavaliacao: 0, vitorias: "", desafios: "", categoriaDesafio: "Codificação",
    metas: ["", "", ""], exploracao: "", planosAcao: ["", "", "", "", ""], notasPrivadas: "",
    statusMetasAnteriores: ["", "", ""]
  });

  const [grade, setGrade] = useState({});
  const [gradeHistorico, setGradeHistorico] = useState([]); // stack de undo
  const [selecaoAtual, setSelecaoAtual] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [configSemana, setConfigSemana] = useState({ categoria: 'Codificação', detalhe: '', foco: false });

  const iniciarSelecao = (id) => { setIsDragging(true); setSelecaoAtual([id]); };
  const passarMouse = (id) => { if (isDragging && !selecaoAtual.includes(id)) setSelecaoAtual(prev => [...prev, id]); };
  const finalizarSelecao = () => setIsDragging(false);

  // Undo: salva estado anterior e reverte
  const pushHistorico = (g) => setGradeHistorico(prev => [...prev.slice(-19), g]);
  const desfazer = () => {
    if (gradeHistorico.length === 0) return;
    const anterior = gradeHistorico[gradeHistorico.length - 1];
    setGrade(anterior);
    setGradeHistorico(prev => prev.slice(0, -1));
  };

  // Resumo de horas por categoria
  const resumoHoras = Object.values(grade).reduce((acc, item) => {
    if (!item) return acc;
    acc[item.categoria] = (acc[item.categoria] || 0) + 1;
    return acc;
  }, {});

  // =========================================================================
  // CARREGAR DADOS DO GOOGLE
  // =========================================================================
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key !== 'Escape') return;
      if (simuladoAberto) { setSimuladoAberto(null); return; }
      if (encontroEdit)   { setEncontroEdit(null);   return; }
      if (modalAberto)    { setModalAberto(false);   return; }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [modalAberto, encontroEdit, simuladoAberto]);

  useEffect(() => {
    const carregarDados = async () => {
      setCarregando(true);
      try {
        const res = await apiFetch('/api/mentor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ acao: 'buscarDadosAluno', idPlanilhaAluno: params.id })
        });
        const data = await res.json();
        
        if (data.status === 'sucesso') {
          setTipoAluno(data.tipoAluno || 'ENEM');
          setEscolaAluno(data.escola || '');

          // GRADE DA SEMANA
          const novaGrade = {};
          if (data.semana && data.semana.length > 0) {
            data.semana.forEach((linha, i) => {
              linha.forEach((celula, j) => {
                if (celula && celula.trim() !== "") {
                  const match = celula.match(/\[(.*?)\]/);
                  novaGrade[`${DIAS[j]}_${HORARIOS[i]}`] = { categoria: match ? match[1] : 'Outros', label: celula };
                }
              });
            });
          }
          setGrade(novaGrade);
          setHistoricoRegistros(data.registros || []);
          setDadosSimulados(data.simulados || { kpi: null, hist: null, lista: [] });

          // DIÁRIOS
          const diariosCarregados = (data.diarios || []).map(d => ({
            ...d,
            metas: parseMetas(d.meta),
            statusMetasAnteriores: parseStatusMetas(d.statusMetasAnteriores),
          }));
          setHistoricoDiarios(diariosCarregados);

          if (diariosCarregados.length > 0) {
            const ultimo = diariosCarregados[0];
            setMetasPassadas(parseMetas(ultimo.meta)); // Puxa as metas antigas para os Placeholders
            
            let precisaAvaliar = false;
            for (let i = 0; i < 5; i++) {
              if (String(ultimo.acoes[i] || "").trim() !== "" && String(ultimo.resultados[i] || "").trim() === "") {
                precisaAvaliar = true; break;
              }
            }
            if (precisaAvaliar) {
              setAvaliacaoPendente(true);
              setEncontroPendente(ultimo);
            }
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setCarregando(false);
      }
    };
    carregarDados();
  }, [params.id]);

  // =========================================================================
  // SALVAR AVALIAÇÃO OBRIGATÓRIA
  // =========================================================================
  const enviarAvaliacao = async () => {
    const temFuro = encontroPendente.acoes.some((acao, i) => String(acao || "").trim() !== "" && formAvaliacao[i] === "");
    if (temFuro) { alert("Preencha o resultado de todas as tarefas."); return; }

    setStatusMsg("Salvando Avaliação...");
    try {
      const res = await apiFetch('/api/mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'avaliarEncontroPassado', idPlanilha: params.id, linha: encontroPendente.linha, resultados: formAvaliacao })
      });
      if (res.ok) {
        setStatusMsg("Avaliação Salva!");
        setAvaliacaoPendente(false);
        const novoHist = [...historicoDiarios];
        novoHist[0].resultados = formAvaliacao;
        setHistoricoDiarios(novoHist);
        setTimeout(() => setStatusMsg(""), 4000);
      }
    } catch (e) { setStatusMsg("Erro ao salvar."); }
  };

  // =========================================================================
  // SALVAR NOVO DIÁRIO
  // =========================================================================
  const salvarNovoEncontro = async () => {
    if (salvandoEncontro) return;
    setSalvandoEncontro(true);
    setStatusMsg("Salvando Encontro...");
    try {
      const res = await apiFetch('/api/mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'salvarNovoEncontro', idPlanilha: params.id, ...formDiario,
          meta: serializeMetas(formDiario.metas),
          statusMetasAnteriores: serializeStatusMetas(formDiario.statusMetasAnteriores),
          autoavaliacao: formDiario.autoavaliacao, acoes: formDiario.planosAcao
        })
      });
      if (res.ok) {
        setStatusMsg("Encontro Salvo!");
        setModalAberto(false);
        window.location.reload();
      } else { setStatusMsg("Erro ao salvar."); }
    } catch (e) { setStatusMsg("Erro."); }
    finally { setSalvandoEncontro(false); }
  };

  const abrirEdicaoEncontro = (enc) => {
    const dataFmt = enc.data instanceof Date
      ? enc.data.toLocaleDateString('pt-BR')
      : (typeof enc.data === 'string' ? new Date(enc.data).toLocaleDateString('pt-BR') : String(enc.data ?? ''));
    setEncontroEdit({
      linha: enc.linha,
      data: dataFmt,
      autoavaliacao: parseInt(enc.autoavaliacao) || 0,
      vitorias: enc.vitorias || '',
      desafios: enc.desafios || '',
      categoria: enc.categoria || 'Codificação',
      metas: parseMetas(enc.meta),
      exploracao: enc.exploracao || '',
      acoes: [0,1,2,3,4].map(i => enc.acoes?.[i] || ''),
      resultados: [0,1,2,3,4].map(i => enc.resultados?.[i] || ''),
      notasPrivadas: enc.notasPrivadas || '',
      statusMetasAnteriores: Array.isArray(enc.statusMetasAnteriores)
        ? [0,1,2].map(i => enc.statusMetasAnteriores[i] || '')
        : parseStatusMetas(enc.statusMetasAnteriores),
    });
  };

  const salvarEdicaoEncontro = async () => {
    if (salvandoEdicao || !encontroEdit) return;
    setSalvandoEdicao(true);
    try {
      const metaSerializada = serializeMetas(encontroEdit.metas);
      const statusSerializado = serializeStatusMetas(encontroEdit.statusMetasAnteriores);
      const res = await apiFetch('/api/mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'editarEncontro', idPlanilha: params.id, ...encontroEdit,
          meta: metaSerializada,
          statusMetasAnteriores: statusSerializado,
        }),
      });
      const data = await res.json();
      if (data.status === 'sucesso') {
        setHistoricoDiarios(prev => prev.map(e => e.linha === encontroEdit.linha ? {
          ...e,
          data: encontroEdit.data,
          autoavaliacao: encontroEdit.autoavaliacao,
          vitorias: encontroEdit.vitorias,
          desafios: encontroEdit.desafios,
          categoria: encontroEdit.categoria,
          meta: metaSerializada,
          metas: [...encontroEdit.metas],
          exploracao: encontroEdit.exploracao,
          acoes: [...encontroEdit.acoes],
          resultados: [...encontroEdit.resultados],
          notasPrivadas: encontroEdit.notasPrivadas,
          statusMetasAnteriores: [...encontroEdit.statusMetasAnteriores],
        } : e));
        setEncontroEdit(null);
      } else {
        alert('Erro ao salvar: ' + (data.mensagem || 'desconhecido'));
      }
    } catch (e) {
      alert('Erro de conexão.');
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const carregarOnboarding = async () => {
    if (dadosOnboarding !== null) return;
    setCarregandoOnboarding(true);
    setErroOnboarding('');
    try {
      const res = await apiFetch('/api/mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'buscarOnboarding', idPlanilhaAluno: params.id })
      });
      const data = await res.json();
      if (data.status === 'sucesso') {
        setDadosOnboarding(data.onboarding || {});
        setDadosDiagnostico(data.diagnostico || null);
      } else {
        setErroOnboarding(data.mensagem || 'Erro desconhecido retornado pelo servidor.');
      }
    } catch (e) {
      setErroOnboarding('Falha na comunicação com a API: ' + e.message);
    }
    finally { setCarregandoOnboarding(false); }
  };

  const aplicarCarimbo = () => {
    pushHistorico({ ...grade });
    const label = `[${configSemana.categoria}]${configSemana.detalhe ? ' - ' + configSemana.detalhe : ''}`;
    const novaGrade = { ...grade };
    selecaoAtual.forEach(id => { novaGrade[id] = { categoria: configSemana.categoria, label }; });
    setGrade(novaGrade);
    setSelecaoAtual([]);
    setConfigSemana(prev => ({ ...prev, detalhe: '' }));
    setGradeModificada(true);
  };

  const limparHorarios = () => {
    pushHistorico({ ...grade });
    const novaGrade = { ...grade };
    selecaoAtual.forEach(id => { novaGrade[id] = null; });
    setGrade(novaGrade);
    setSelecaoAtual([]);
    setGradeModificada(true);
  };

  const carregarTemplate = (templateId) => {
    const tpl = TEMPLATES.find(t => t.id === templateId);
    if (!tpl) return;
    pushHistorico({ ...grade });
    setGrade(tpl.grade);
    setSelecaoAtual([]);
  };

  // Atalho Ctrl+Z global (só ativo na aba semana)
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && abaInterna === 'semana') {
        e.preventDefault();
        desfazer();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [abaInterna, gradeHistorico]);

  // Aviso ao tentar sair com alterações não salvas na Semana Padrão
  useEffect(() => {
    const handler = (e) => {
      if (abaInterna === 'semana' && gradeModificada) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [abaInterna, gradeModificada]);

  const salvarSemana = async () => {
    setSalvandoRotina(true);
    const rotina = Object.entries(grade).map(([chave, item]) => {
      const [dia, hora] = chave.split('_');
      return { dia, hora, atividade: item ? item.label : '' };
    });
    try {
      await apiFetch('/api/mentor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'salvarSemanaLote', idPlanilhaAluno: params.id, rotina }) });
      setStatusMsg("Rotina salva com sucesso!");
      setGradeModificada(false);
      setTimeout(() => setStatusMsg(""), 3000);
    } catch (e) { setStatusMsg("Erro ao salvar."); }
    finally { setSalvandoRotina(false); }
  };

  if (carregando) return <LoadingScreen mensagem="Carregando dados do aluno..." />;

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-8 font-sans" onMouseUp={finalizarSelecao}>
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER GERAL */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <button onClick={() => router.push('/mentor')} className="text-sm font-medium text-slate-400 hover:text-intento-blue transition-colors self-start shrink-0">← Voltar</button>
          <div className="flex gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 sm:pb-0">
            <button onClick={() => setAbaInterna('diario')} className={`px-4 sm:px-5 py-2 font-semibold rounded-lg transition-all text-sm whitespace-nowrap shrink-0 ${abaInterna === 'diario' ? 'bg-intento-blue text-white' : 'bg-slate-50 text-slate-600 border border-slate-300 hover:border-intento-blue hover:text-intento-blue hover:bg-white'}`}>Diário de Bordo</button>
            <button onClick={() => setAbaInterna('semana')} className={`px-4 sm:px-5 py-2 font-semibold rounded-lg transition-all text-sm whitespace-nowrap shrink-0 ${abaInterna === 'semana' ? 'bg-intento-blue text-white' : 'bg-slate-50 text-slate-600 border border-slate-300 hover:border-intento-blue hover:text-intento-blue hover:bg-white'}`}>Semana Padrão</button>
            {tipoAluno === 'EM' && (
              <button onClick={() => setAbaInterna('provas')} className={`px-4 sm:px-5 py-2 font-semibold rounded-lg transition-all text-sm whitespace-nowrap shrink-0 ${abaInterna === 'provas' ? 'bg-intento-blue text-white' : 'bg-slate-50 text-slate-600 border border-slate-300 hover:border-intento-blue hover:text-intento-blue hover:bg-white'}`}>Provas</button>
            )}
            <button onClick={() => setAbaInterna('registros')} className={`px-4 sm:px-5 py-2 font-semibold rounded-lg transition-all text-sm whitespace-nowrap shrink-0 ${abaInterna === 'registros' ? 'bg-intento-blue text-white' : 'bg-slate-50 text-slate-600 border border-slate-300 hover:border-intento-blue hover:text-intento-blue hover:bg-white'}`}>Histórico Analítico</button>
            <button onClick={() => setAbaInterna('simulados')} className={`px-4 sm:px-5 py-2 font-semibold rounded-lg transition-all text-sm whitespace-nowrap shrink-0 ${abaInterna === 'simulados' ? 'bg-intento-blue text-white' : 'bg-slate-50 text-slate-600 border border-slate-300 hover:border-intento-blue hover:text-intento-blue hover:bg-white'}`}>Simulados</button>
            <button onClick={() => { setAbaInterna('onboarding'); carregarOnboarding(); }} className={`px-4 sm:px-5 py-2 font-semibold rounded-lg transition-all text-sm whitespace-nowrap shrink-0 ${abaInterna === 'onboarding' ? 'bg-intento-blue text-white' : 'bg-slate-50 text-slate-600 border border-slate-300 hover:border-intento-blue hover:text-intento-blue hover:bg-white'}`}>Onboarding</button>
          </div>
        </div>

        <div className="bg-intento-blue text-white p-6 rounded-xl flex justify-between items-center shadow-sm">
          <h1 className="text-2xl font-semibold">{nomeAluno || "Gestão Individual"}</h1>
        </div>

        {/* Toast de status global */}
        {statusMsg && (
          <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold animate-in fade-in slide-in-from-bottom-2 ${statusMsg.toLowerCase().includes('erro') ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
            {statusMsg}
          </div>
        )}

        {/* ================================================================== */}
        {/* ABA DIÁRIO DE BORDO */}
        {/* ================================================================== */}
        {abaInterna === 'diario' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            
            {/* AVALIAÇÃO PENDENTE — alerta não bloqueante */}
            {avaliacaoPendente && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-5 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-8 h-8 bg-amber-500 text-white rounded-full flex items-center justify-center shrink-0 mt-0.5 text-sm font-bold">!</div>
                    <div>
                      <h2 className="text-sm font-bold text-amber-800">Revisão pendente — encontro de {new Date(encontroPendente.data).toLocaleDateString('pt-BR')}</h2>
                      <p className="text-xs text-amber-700 font-medium mt-0.5">Avalie as tarefas do encontro anterior antes de registrar um novo.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setModalAberto(true)}
                    className="shrink-0 bg-intento-yellow hover:bg-yellow-500 text-white font-bold py-2 px-4 rounded-lg shadow-sm transition-all text-xs"
                  >
                    + Novo Diário
                  </button>
                </div>

                <div className="border-t border-amber-200 p-5 space-y-3">
                  {encontroPendente.acoes.map((acao, idx) => {
                    if (!acao || String(acao).trim() === '') return null;
                    return (
                      <div key={idx} className="bg-white p-4 rounded-xl border border-amber-100 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
                        <span className="font-semibold text-slate-700 flex-1 text-sm">{idx + 1}. {acao}</span>
                        <select
                          className="p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-amber-400 bg-slate-50 font-semibold text-slate-600 text-sm md:min-w-[220px]"
                          value={formAvaliacao[idx]}
                          onChange={(e) => { const novo = [...formAvaliacao]; novo[idx] = e.target.value; setFormAvaliacao(novo); }}
                        >
                          <option value="">Selecione o resultado...</option>
                          <option value="Não realizado">Não realizado</option>
                          <option value="Realizado Parcialmente">Realizado Parcialmente</option>
                          <option value="Realizado">Realizado</option>
                        </select>
                      </div>
                    );
                  })}
                  <button onClick={enviarAvaliacao}
                    className="w-full mt-2 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-lg shadow-sm transition-all text-sm">
                    Salvar Revisão
                  </button>
                </div>
              </div>
            )}

            {/* BOTÃO NOVO DIÁRIO — visível sempre */}
            {!avaliacaoPendente && (
              <div className="flex justify-between items-center bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div>
                  <h2 className="text-sm font-bold text-intento-blue">Diário de Bordo</h2>
                  <p className="text-slate-400 text-xs font-medium mt-0.5">Último encontro avaliado.</p>
                </div>
                <button onClick={() => setModalAberto(true)}
                  className="bg-intento-yellow hover:bg-yellow-500 text-white font-bold py-2.5 px-6 rounded-lg shadow-sm transition-all text-sm">
                  + Novo Diário
                </button>
              </div>
            )}

            {/* O ACORDÃO (SANFONA) DO HISTÓRICO - AGORA COM TUDO! */}
            <div className="pt-4">
              <h3 className="text-base font-semibold text-intento-blue mb-5">Histórico Completo de Encontros</h3>
              
              {historicoDiarios.length === 0 ? (
                <div className="p-8 border-2 border-dashed rounded-xl text-center text-slate-400 font-bold">Nenhum encontro registrado.</div>
              ) : (
                <div className="space-y-4">
                  {historicoDiarios.map((enc, i) => {
                    const expandido = expandidoId === i;
                    const toggleExpand = () => setExpandidoId(expandido ? null : i);
                    // Encontro N+1 cronológico (mais novo). No array em ordem reverse, é o de índice i-1.
                    const proximoEnc = i > 0 ? historicoDiarios[i - 1] : null;
                    const statusDasMetas = proximoEnc?.statusMetasAnteriores || ['', '', ''];
                    const metasComStatus = (enc.metas || []).map((m, idx) => ({
                      meta: m, status: statusDasMetas[idx] || ''
                    })).filter(x => String(x.meta || '').trim() !== '');
                    const totalMetas = metasComStatus.length;
                    const totalAvaliadas = metasComStatus.filter(x => x.status !== '').length;
                    const totalBatidas = metasComStatus.filter(x => x.status === 'Batida').length;
                    const temAvaliacao = totalAvaliadas > 0;
                    const corBadgeStatus = (() => {
                      if (totalAvaliadas < totalMetas) return 'bg-slate-100 text-slate-600 border-slate-200';
                      if (totalBatidas === totalMetas) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
                      if (totalBatidas === 0)          return 'bg-red-100 text-red-800 border-red-200';
                      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
                    })();
                    return (
                    <div key={i} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden transition-all">
                      {/* CABEÇALHO DA SANFONA */}
                      <div
                        role="button"
                        tabIndex={0}
                        aria-expanded={expandido}
                        onClick={toggleExpand}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(); } }}
                        className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors cursor-pointer focus:outline-none focus:bg-slate-50"
                      >
                        {/* Data */}
                        <span className="shrink-0 bg-intento-blue text-white px-3 py-1.5 rounded-lg text-xs font-semibold min-w-[100px] text-center">
                          {new Date(enc.data).toLocaleDateString('pt-BR')}
                        </span>

                        {/* Badges (categoria + autoavaliação) */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center flex-wrap gap-2">
                            {/* Tipo de desafio */}
                            {enc.categoria && (() => {
                              const cat = {
                                'Codificação': 'bg-blue-50 text-blue-700 border-blue-100',
                                'Revisão':     'bg-emerald-50 text-emerald-700 border-emerald-100',
                                'Hábitos':     'bg-yellow-50 text-yellow-700 border-yellow-200',
                                'Prova':       'bg-red-50 text-red-700 border-red-100',
                              }[enc.categoria] || 'bg-slate-50 text-slate-600 border-slate-200';
                              return (
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${cat}`}>
                                  {enc.categoria}
                                </span>
                              );
                            })()}
                            {/* Avaliação */}
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-400 font-medium">Autoav.:</span>
                              <StarRating rating={parseInt(enc.autoavaliacao) || 0} readOnly={true} small={true} />
                            </div>
                            {/* Status / quantidade de metas */}
                            {totalMetas > 0 && (
                              temAvaliacao ? (
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${corBadgeStatus}`}>
                                  {totalBatidas}/{totalMetas} {totalBatidas === 1 ? 'batida' : 'batidas'}
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                                  {totalMetas} {totalMetas === 1 ? 'meta' : 'metas'}
                                </span>
                              )
                            )}
                          </div>
                        </div>

                        {/* Ações discretas (icon-only) */}
                        <div className="flex items-center gap-0.5 shrink-0">
                          <Link
                            href={`/mentor/ig/diario?id=${params.id}&linha=${enc.linha}&nome=${encodeURIComponent(nomeAluno || '')}`}
                            onClick={(e) => e.stopPropagation()}
                            title="Exportar encontro"
                            aria-label="Exportar encontro"
                            className="p-2 rounded-lg text-slate-400 hover:text-intento-blue hover:bg-white transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                          </Link>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); abrirEdicaoEncontro(enc); }}
                            title="Editar encontro"
                            aria-label="Editar encontro"
                            className="p-2 rounded-lg text-slate-400 hover:text-intento-blue hover:bg-white transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                          </button>
                          <span className="w-px h-5 bg-slate-200 mx-1" aria-hidden="true" />
                          {/* Chevron */}
                          <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${expandido ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                          </svg>
                        </div>
                      </div>

                      {/* CONTEÚDO EXPANDIDO (TODOS OS CAMPOS) */}
                      {expandido && (
                        <div className="p-6 border-t border-slate-100 bg-slate-50 space-y-6 animate-in fade-in">

                          {/* Topo: Categoria */}
                          <div>
                            <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                              Desafio: {enc.categoria || 'Não Categorizado'}
                            </span>
                          </div>

                          {/* Metas para o Próximo Encontro */}
                          <div className="bg-white p-5 rounded-xl border border-slate-100">
                            <div className="flex items-center gap-2 mb-3">
                              <svg className="w-4 h-4 text-intento-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>
                              <h4 className={labelClass + " mb-0"}>Metas para o Próximo Encontro</h4>
                            </div>
                            {totalMetas === 0 ? (
                              <p className="text-sm text-slate-400 font-medium italic">Nenhuma meta registrada.</p>
                            ) : (
                              <ul className="space-y-2">
                                {(enc.metas || []).map((m, idx) => {
                                  if (!m || String(m).trim() === '') return null;
                                  const status = statusDasMetas[idx] || '';
                                  return (
                                    <li key={idx} className="flex gap-3 items-start">
                                      <span className="w-6 h-6 shrink-0 bg-intento-blue/10 text-intento-blue rounded-md flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                                      <span className="text-sm font-semibold text-slate-800 whitespace-pre-wrap leading-relaxed flex-1">{m}</span>
                                      {proximoEnc && (
                                        <span className={`text-[10px] font-medium px-3 py-1.5 rounded-md uppercase tracking-wide whitespace-nowrap ${
                                          status ? COR_STATUS_META[status] : 'bg-slate-100 text-slate-500'
                                        }`}>
                                          {status || 'Sem avaliação'}
                                        </span>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>

                          {/* Grid de Vitórias e Desafios */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-5 rounded-xl border border-slate-100">
                            <div><h4 className={labelClass}>Vitórias da Semana</h4><p className="text-sm font-medium text-slate-700 whitespace-pre-wrap">{enc.vitorias || '-'}</p></div>
                            <div><h4 className={labelClass}>Maiores Desafios</h4><p className="text-sm font-medium text-slate-700 whitespace-pre-wrap">{enc.desafios || '-'}</p></div>
                          </div>
                          
                          {/* Exploração Longa com Scroll */}
                          <div className="bg-white p-5 rounded-xl border border-slate-100">
                            <h4 className={labelClass}>Exploração e Ferramentas</h4>
                            <div className="max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                              <p className="text-sm font-medium text-slate-700 whitespace-pre-wrap leading-relaxed">
                                {enc.exploracao || 'Nenhuma nota de exploração registrada.'}
                              </p>
                            </div>
                          </div>

                          {/* Plano de Ação */}
                          <div>
                            <h4 className={labelClass}>Plano de Ação e Execução</h4>
                            <ul className="space-y-3 mt-3">
                              {enc.acoes.map((acao, idx) => acao && String(acao).trim() !== "" ? (
                                <li key={idx} className="bg-white p-4 border border-slate-200 rounded-xl flex flex-col md:flex-row justify-between md:items-center gap-3 shadow-sm">
                                  <span className="text-sm font-bold text-slate-800 flex-1">{idx + 1}. {acao}</span>
                                  <span className={`text-[10px] font-medium px-3 py-1.5 rounded-md uppercase tracking-wide text-center ${
                                    enc.resultados[idx] === 'Realizado' ? 'bg-emerald-100 text-emerald-800' :
                                    enc.resultados[idx] === 'Realizado Parcialmente' ? 'bg-yellow-100 text-yellow-800' :
                                    enc.resultados[idx] === 'Não realizado' ? 'bg-red-100 text-red-800' : 'bg-slate-200 text-slate-500'
                                  }`}>
                                    {enc.resultados[idx] || 'Aguardando Revisão'}
                                  </span>
                                </li>
                              ) : null)}
                            </ul>
                          </div>

                          {/* Anotação Privada — só aparece se tiver conteúdo */}
                          {enc.notasPrivadas && String(enc.notasPrivadas).trim() !== '' && (
                            <div className="bg-amber-50 border-2 border-dashed border-amber-300 p-5 rounded-xl">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className={labelClass + " text-amber-800"}>Anotação Privada</h4>
                                <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded uppercase tracking-wider">Só você vê</span>
                              </div>
                              <p className="text-sm font-medium text-slate-700 whitespace-pre-wrap leading-relaxed">
                                {enc.notasPrivadas}
                              </p>
                            </div>
                          )}

                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODAL: NOVO DIÁRIO (PERSISTENTE) */}
        {modalAberto && (
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-intento-blue/40 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-slate-50 w-full max-w-6xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
              
              {/* Header do Modal */}
              <div className="bg-white px-8 py-5 border-b border-slate-200 flex justify-between items-center">
                <h2 className="text-base font-semibold text-intento-blue">Novo Encontro</h2>
                <button onClick={() => setModalAberto(false)} className="text-slate-400 hover:text-red-500 transition-colors">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>

              {/* Corpo do Modal com Scroll */}
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">

                {/* RETROSPECTIVA: status das metas do último encontro */}
                {(() => {
                  const ultimo = historicoDiarios[0];
                  if (!ultimo) return null;
                  const metasAnteriores = (ultimo.metas || [])
                    .map((m, idx) => ({ idx, meta: m }))
                    .filter(x => String(x.meta || '').trim() !== '');
                  if (metasAnteriores.length === 0) return null;
                  return (
                    <div className="bg-intento-blue/5 border-2 border-intento-blue/20 rounded-xl p-6 mb-8">
                      <h3 className="text-sm font-bold text-intento-blue uppercase tracking-wider mb-1">Retrospectiva — Metas do último encontro</h3>
                      <p className="text-xs text-slate-500 mb-4">
                        {ultimo.data ? new Date(ultimo.data).toLocaleDateString('pt-BR') : ''} · marque o status de cada meta
                      </p>
                      <div className="space-y-3">
                        {metasAnteriores.map(({ idx, meta }) => (
                          <div key={idx} className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col md:flex-row gap-3 md:items-center">
                            <div className="flex gap-2 items-start flex-1">
                              <span className="w-6 h-6 shrink-0 bg-intento-blue/10 text-intento-blue rounded-md flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                              <span className="text-sm font-semibold text-slate-800 leading-relaxed">{meta}</span>
                            </div>
                            <div className="flex gap-1 flex-wrap">
                              {STATUS_META_OPCOES.map(opt => {
                                const ativo = formDiario.statusMetasAnteriores[idx] === opt;
                                return (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => {
                                      const novo = [...formDiario.statusMetasAnteriores];
                                      novo[idx] = ativo ? '' : opt;
                                      setFormDiario({ ...formDiario, statusMetasAnteriores: novo });
                                    }}
                                    className={`text-[10px] font-bold px-3 py-1.5 rounded-md uppercase tracking-wide transition-all ${
                                      ativo
                                        ? COR_STATUS_META[opt] + ' ring-2 ring-offset-1 ring-intento-blue/40'
                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                    }`}
                                  >
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                  {/* COLUNA ESQUERDA: Análise e Exploração */}
                  <div className="space-y-6">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                      <label className={labelClass}>Autoavaliação</label>
                      <div className="mt-2"><StarRating rating={formDiario.autoavaliacao} setRating={(val) => setFormDiario({...formDiario, autoavaliacao: val})} /></div>
                    </div>
                    
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                      <div><label className={labelClass}>Vitórias da Semana</label><textarea className={inputClass} rows="2" placeholder="O que correu bem?" value={formDiario.vitorias} onChange={e => setFormDiario({...formDiario, vitorias: e.target.value})} /></div>
                      <div><label className={labelClass}>Maiores Desafios</label><textarea className={inputClass} rows="2" placeholder="Onde o aluno travou?" value={formDiario.desafios} onChange={e => setFormDiario({...formDiario, desafios: e.target.value})} /></div>
                    </div>

                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                      <label className={labelClass}>Exploração</label>
                      <textarea className={inputClass} rows="8" placeholder="Espaço livre para notas, resumos, descobertas durante o encontro..." value={formDiario.exploracao} onChange={e => setFormDiario({...formDiario, exploracao: e.target.value})} />
                    </div>

                    <div className="bg-amber-50 p-6 rounded-xl border-2 border-dashed border-amber-300 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <label className={labelClass + " text-amber-800"}>Anotação Privada</label>
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded uppercase tracking-wider">Só você vê</span>
                      </div>
                      <textarea
                        className={inputClass + " bg-white border-amber-200 focus:ring-amber-400"}
                        rows="5"
                        placeholder="Observações pessoais sobre o aluno — não aparecem no painel dele."
                        value={formDiario.notasPrivadas}
                        onChange={e => setFormDiario({...formDiario, notasPrivadas: e.target.value})}
                      />
                    </div>
                  </div>

                  {/* COLUNA DIREITA: Metas e Ações */}
                  <div className="space-y-6">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                      <div>
                        <label className={labelClass}>Categoria do Desafio Atual</label>
                        <select className={inputClass + " bg-slate-50 font-bold text-intento-blue"} value={formDiario.categoriaDesafio} onChange={e => setFormDiario({...formDiario, categoriaDesafio: e.target.value})}>
                          {CATEGORIAS_DESAFIO.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Metas para o Próximo Encontro</label>
                        <p className="text-[10px] text-slate-400 font-medium mb-2 -mt-1">Até 3 metas. Deixe em branco o que não usar.</p>
                        <div className="space-y-2">
                          {[0,1,2].map(idx => (
                            <div key={idx} className="flex gap-2 items-center">
                              <div className="w-7 h-7 shrink-0 bg-intento-blue/10 text-intento-blue rounded-md flex items-center justify-center text-xs font-bold">{idx + 1}</div>
                              <input
                                type="text"
                                className={inputClass}
                                placeholder={metasPassadas[idx] ? `Ex: ${metasPassadas[idx]}` : (idx === 0 ? "Qual a grande meta da semana?" : "Meta opcional")}
                                value={formDiario.metas[idx]}
                                onChange={e => {
                                  const novas = [...formDiario.metas];
                                  novas[idx] = e.target.value;
                                  setFormDiario({...formDiario, metas: novas});
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="bg-intento-blue p-6 rounded-xl shadow-lg border-4 border-blue-900/20">
                      <label className="block text-xs font-medium text-blue-200 uppercase mb-4 tracking-wider">O Plano de Ação</label>
                      <div className="space-y-3">
                        {formDiario.planosAcao.map((p, i) => (
                          <div key={i} className="flex gap-3">
                            <div className="w-9 h-9 shrink-0 bg-blue-900 rounded-lg flex items-center justify-center font-semibold text-white text-sm">{i+1}</div>
                            <input type="text" placeholder={`Descreva o ${i+1}º passo prático...`} className={inputClass + " bg-white/10 border-blue-800 text-white placeholder-blue-300 focus:ring-yellow-400"} value={p} onChange={e => { const novo = [...formDiario.planosAcao]; novo[i] = e.target.value; setFormDiario({...formDiario, planosAcao: novo}); }}/>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Footer do Modal */}
              <div className="bg-white p-6 border-t border-slate-200 flex justify-end gap-4">
                <button onClick={() => setModalAberto(false)} className="px-6 py-2.5 font-medium text-slate-400 hover:text-slate-700 transition-colors text-sm">
                  Minimizar
                </button>
                <button onClick={salvarNovoEncontro} disabled={salvandoEncontro} className="bg-intento-yellow hover:bg-yellow-500 text-white font-semibold px-8 py-2.5 rounded-lg shadow-sm transition-all text-sm disabled:opacity-60">
                  {salvandoEncontro ? 'Salvando...' : 'Salvar Encontro'}
                </button>
              </div>

            </div>
          </div>
        )}

        {/* MODAL: EDITAR ENCONTRO */}
        {encontroEdit && (
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-intento-blue/40 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-slate-50 w-full max-w-6xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">

              <div className="bg-white px-8 py-5 border-b border-slate-200 flex justify-between items-center">
                <h2 className="text-base font-semibold text-intento-blue">Editar Encontro — {encontroEdit.data}</h2>
                <button onClick={() => setEncontroEdit(null)} className="text-slate-400 hover:text-red-500 transition-colors">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">

                {/* RETROSPECTIVA: status das metas do encontro anterior */}
                {(() => {
                  const idxAtual = historicoDiarios.findIndex(d => d.linha === encontroEdit.linha);
                  const anteriorCronologico = idxAtual >= 0 ? historicoDiarios[idxAtual + 1] : null;
                  if (!anteriorCronologico) return null;
                  const metasAnteriores = (anteriorCronologico.metas || [])
                    .map((m, idx) => ({ idx, meta: m }))
                    .filter(x => String(x.meta || '').trim() !== '');
                  if (metasAnteriores.length === 0) return null;
                  return (
                    <div className="bg-intento-blue/5 border-2 border-intento-blue/20 rounded-xl p-6 mb-8">
                      <h3 className="text-sm font-bold text-intento-blue uppercase tracking-wider mb-1">Retrospectiva — Metas do encontro anterior</h3>
                      <p className="text-xs text-slate-500 mb-4">
                        {anteriorCronologico.data ? new Date(anteriorCronologico.data).toLocaleDateString('pt-BR') : ''} · status gravado neste encontro
                      </p>
                      <div className="space-y-3">
                        {metasAnteriores.map(({ idx, meta }) => (
                          <div key={idx} className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col md:flex-row gap-3 md:items-center">
                            <div className="flex gap-2 items-start flex-1">
                              <span className="w-6 h-6 shrink-0 bg-intento-blue/10 text-intento-blue rounded-md flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                              <span className="text-sm font-semibold text-slate-800 leading-relaxed">{meta}</span>
                            </div>
                            <div className="flex gap-1 flex-wrap">
                              {STATUS_META_OPCOES.map(opt => {
                                const ativo = encontroEdit.statusMetasAnteriores[idx] === opt;
                                return (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => {
                                      const novo = [...encontroEdit.statusMetasAnteriores];
                                      novo[idx] = ativo ? '' : opt;
                                      setEncontroEdit({ ...encontroEdit, statusMetasAnteriores: novo });
                                    }}
                                    className={`text-[10px] font-bold px-3 py-1.5 rounded-md uppercase tracking-wide transition-all ${
                                      ativo
                                        ? COR_STATUS_META[opt] + ' ring-2 ring-offset-1 ring-intento-blue/40'
                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                    }`}
                                  >
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                  <div className="space-y-6">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                      <label className={labelClass}>Data do Encontro</label>
                      <input type="text" className={inputClass} value={encontroEdit.data} onChange={e => setEncontroEdit({...encontroEdit, data: e.target.value})} />
                    </div>

                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                      <label className={labelClass}>Autoavaliação</label>
                      <div className="mt-2"><StarRating rating={encontroEdit.autoavaliacao} setRating={(val) => setEncontroEdit({...encontroEdit, autoavaliacao: val})} /></div>
                    </div>

                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                      <div><label className={labelClass}>Vitórias da Semana</label><textarea className={inputClass} rows="2" value={encontroEdit.vitorias} onChange={e => setEncontroEdit({...encontroEdit, vitorias: e.target.value})} /></div>
                      <div><label className={labelClass}>Maiores Desafios</label><textarea className={inputClass} rows="2" value={encontroEdit.desafios} onChange={e => setEncontroEdit({...encontroEdit, desafios: e.target.value})} /></div>
                    </div>

                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                      <label className={labelClass}>Exploração</label>
                      <textarea className={inputClass} rows="6" value={encontroEdit.exploracao} onChange={e => setEncontroEdit({...encontroEdit, exploracao: e.target.value})} />
                    </div>

                    <div className="bg-amber-50 p-6 rounded-xl border-2 border-dashed border-amber-300 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <label className={labelClass + " text-amber-800"}>Anotação Privada</label>
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded uppercase tracking-wider">Só você vê</span>
                      </div>
                      <textarea
                        className={inputClass + " bg-white border-amber-200 focus:ring-amber-400"}
                        rows="5"
                        placeholder="Observações pessoais sobre o aluno — não aparecem no painel dele."
                        value={encontroEdit.notasPrivadas}
                        onChange={e => setEncontroEdit({...encontroEdit, notasPrivadas: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                      <div>
                        <label className={labelClass}>Categoria do Desafio</label>
                        <select className={inputClass + " bg-slate-50 font-bold text-intento-blue"} value={encontroEdit.categoria} onChange={e => setEncontroEdit({...encontroEdit, categoria: e.target.value})}>
                          <option>Codificação</option><option>Revisão</option><option>Hábitos</option><option>Prova</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Metas para o Próximo Encontro</label>
                        <p className="text-[10px] text-slate-400 font-medium mb-2 -mt-1">Até 3 metas.</p>
                        <div className="space-y-2">
                          {[0,1,2].map(idx => (
                            <div key={idx} className="flex gap-2 items-center">
                              <div className="w-7 h-7 shrink-0 bg-intento-blue/10 text-intento-blue rounded-md flex items-center justify-center text-xs font-bold">{idx + 1}</div>
                              <input
                                type="text"
                                className={inputClass}
                                placeholder={idx === 0 ? "Meta principal" : "Meta opcional"}
                                value={encontroEdit.metas[idx]}
                                onChange={e => {
                                  const novas = [...encontroEdit.metas];
                                  novas[idx] = e.target.value;
                                  setEncontroEdit({...encontroEdit, metas: novas});
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                      <label className={labelClass}>Plano de Ação e Resultados</label>
                      <div className="space-y-3 mt-2">
                        {[0,1,2,3,4].map(idx => (
                          <div key={idx} className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center">
                            <input
                              type="text"
                              placeholder={`Ação ${idx + 1}`}
                              className={inputClass + " md:col-span-3"}
                              value={encontroEdit.acoes[idx]}
                              onChange={e => {
                                const novas = [...encontroEdit.acoes];
                                novas[idx] = e.target.value;
                                setEncontroEdit({...encontroEdit, acoes: novas});
                              }}
                            />
                            <select
                              className={inputClass + " md:col-span-2 bg-slate-50"}
                              value={encontroEdit.resultados[idx]}
                              onChange={e => {
                                const novos = [...encontroEdit.resultados];
                                novos[idx] = e.target.value;
                                setEncontroEdit({...encontroEdit, resultados: novos});
                              }}
                            >
                              <option value="">— Sem avaliação —</option>
                              <option>Realizado</option>
                              <option>Realizado Parcialmente</option>
                              <option>Não realizado</option>
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              <div className="bg-white p-6 border-t border-slate-200 flex justify-end gap-4">
                <button onClick={() => setEncontroEdit(null)} className="px-6 py-2.5 font-medium text-slate-400 hover:text-slate-700 transition-colors text-sm">
                  Cancelar
                </button>
                <button onClick={salvarEdicaoEncontro} disabled={salvandoEdicao} className="bg-intento-blue hover:bg-blue-900 text-white font-semibold px-8 py-2.5 rounded-lg shadow-sm transition-all text-sm disabled:opacity-60">
                  {salvandoEdicao ? 'Salvando...' : 'Salvar Edição'}
                </button>
              </div>

            </div>
          </div>
        )}

        {/* ... ABAS SEMANA E REGISTROS AQUI (MANTIDAS INTACTAS) ... */}

        {abaInterna === 'provas' && tipoAluno === 'EM' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm animate-in fade-in duration-500">
            <AbaProvas idAluno={params.id} alunoNome={nomeAluno} escola={escolaAluno} />
          </div>
        )}

        {abaInterna === 'semana' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-in fade-in duration-500">

            {/* ── Painel lateral ── */}
            <div className="space-y-4 lg:sticky lg:top-8 self-start">

              {/* Paleta de categorias — sempre visível */}
              <div className={cardClass}>
                <p className={labelClass}>Categoria ativa</p>
                <div className="grid grid-cols-1 gap-2 mt-1">
                  {Object.entries(CATEGORIAS).map(([cat, cfg]) => (
                    <button key={cat} onClick={() => setConfigSemana(prev => ({ ...prev, categoria: cat }))}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all border-2 ${
                        configSemana.categoria === cat
                          ? `${cfg.btn} border-transparent shadow-md scale-[1.02]`
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}>
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Detalhe / descrição da atividade */}
                <div className="mt-4">
                  <label className={labelClass}>Detalhe <span className="text-slate-300 normal-case font-normal">(opcional)</span></label>
                  <input type="text" placeholder="Ex: Funções, Redação, Pomodoro..."
                    className={inputClass + ' text-sm mt-1'}
                    value={configSemana.detalhe}
                    onChange={e => setConfigSemana(prev => ({ ...prev, detalhe: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter' && selecaoAtual.length > 0) aplicarCarimbo(); }}
                  />
                </div>

                {/* Botões de ação */}
                {selecaoAtual.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-semibold text-intento-blue">{selecaoAtual.length} célula{selecaoAtual.length !== 1 ? 's' : ''} selecionada{selecaoAtual.length !== 1 ? 's' : ''}</p>
                    <button onClick={aplicarCarimbo}
                      className="w-full bg-intento-blue text-white font-bold py-2.5 rounded-lg hover:bg-blue-900 transition-all text-sm">
                      Aplicar ({selecaoAtual.length}h)
                    </button>
                    <button onClick={limparHorarios}
                      className="w-full border border-red-300 text-red-500 font-semibold py-2 rounded-lg hover:bg-red-50 transition-all text-sm">
                      Limpar seleção
                    </button>
                  </div>
                ) : (
                  <p className="mt-4 text-xs text-slate-400 font-medium text-center py-2 bg-slate-50 rounded-lg">
                    Arraste na grade para selecionar →
                  </p>
                )}
              </div>

              {/* Resumo de horas */}
              {Object.keys(resumoHoras).length > 0 && (
                <div className={cardClass}>
                  <p className={labelClass}>Distribuição da semana</p>
                  <div className="space-y-2 mt-2">
                    {Object.entries(CATEGORIAS).map(([cat, cfg]) => {
                      const horas = resumoHoras[cat] || 0;
                      if (!horas) return null;
                      const total = Object.values(resumoHoras).reduce((a, b) => a + b, 0);
                      return (
                        <div key={cat}>
                          <div className="flex justify-between text-xs font-medium mb-1">
                            <span className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                              <span className="text-slate-600">{cat}</span>
                            </span>
                            <span className="text-slate-500 font-bold">{horas}h</span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${cfg.dot}`}
                              style={{ width: `${(horas / total) * 100}%` }} />
                          </div>
                        </div>
                      );
                    })}
                    <p className="text-xs text-slate-400 font-medium text-right pt-1">
                      Total: {Object.values(resumoHoras).reduce((a, b) => a + b, 0)}h
                    </p>
                  </div>
                </div>
              )}

              {/* Ações globais */}
              <div className="space-y-2">
                <button onClick={salvarSemana} disabled={salvandoRotina}
                  className="w-full bg-intento-yellow text-white font-semibold py-2.5 rounded-lg shadow-sm hover:bg-yellow-500 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-70">
                  {salvandoRotina && <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>}
                  {salvandoRotina ? 'Sincronizando...' : 'Salvar Rotina'}
                </button>
                <div className="flex gap-2">
                  <button onClick={desfazer} disabled={gradeHistorico.length === 0}
                    title="Desfazer (Ctrl+Z)"
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700 rounded-lg text-xs font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
                    Desfazer
                  </button>
                  <details className="flex-1 relative">
                    <summary
                      title="Carregar template de semana padrão"
                      className="cursor-pointer list-none flex items-center justify-center gap-1.5 py-2 border border-slate-200 text-slate-500 hover:border-intento-blue hover:text-intento-blue rounded-lg text-xs font-semibold transition-all">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5h16M4 10h10M4 15h16M4 20h10"/></svg>
                      Template
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
                    </summary>
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 overflow-hidden">
                      {TEMPLATES.map(t => (
                        <button
                          key={t.id}
                          onClick={(e) => {
                            carregarTemplate(t.id);
                            e.currentTarget.closest('details').open = false;
                          }}
                          className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-intento-blue transition border-b border-slate-100 last:border-0"
                        >
                          {t.nome}
                        </button>
                      ))}
                    </div>
                  </details>
                </div>
              </div>
            </div>

            {/* ── Grade semanal ── */}
            <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl overflow-x-auto scroll-fade-right shadow-sm select-none">
              <table className="w-full text-xs border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="p-3 w-14 text-slate-400 font-medium border-r text-center">Hora</th>
                    {DIAS.map(dia => (
                      <th key={dia} className="p-2 font-semibold text-intento-blue border-r last:border-0 text-center">
                        <span className="hidden sm:inline">{dia.split('-')[0]}</span>
                        <span className="sm:hidden">{dia.slice(0, 3)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {HORARIOS.map(hora => (
                    <tr key={hora} className="border-b border-slate-100 last:border-0">
                      <td className="p-2 text-center text-[10px] font-bold text-slate-400 border-r bg-slate-50 whitespace-nowrap">{hora}</td>
                      {DIAS.map(dia => {
                        const id = `${dia}_${hora}`;
                        const isSelected = selecaoAtual.includes(id);
                        const item = grade[id];
                        return (
                          <td key={id}
                            onMouseDown={() => iniciarSelecao(id)}
                            onMouseEnter={() => passarMouse(id)}
                            className={`border-r last:border-0 cursor-crosshair transition-all duration-75 h-10 p-0.5 ${
                              isSelected ? 'bg-blue-50 ring-2 ring-inset ring-blue-400' : 'hover:bg-slate-50'
                            }`}
                          >
                            {item && (
                              <div className={`h-full w-full px-1.5 rounded-md font-semibold flex flex-col justify-center leading-tight border ${CATEGORIAS[item.categoria]?.cor || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                <span className="text-[9px] font-bold uppercase tracking-wide opacity-70 leading-none">{item.categoria.slice(0, 3)}</span>
                                {item.label.replace(/\[.*?\]\s*-?\s*/, '').trim() && (
                                  <span className="text-[9px] mt-0.5 leading-tight truncate">{item.label.replace(/\[.*?\]\s*-?\s*/, '').trim()}</span>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* ABA SIMULADOS */}
        {/* ================================================================== */}
        {abaInterna === 'simulados' && (() => {
          const simKpi  = dadosSimulados?.kpi  || { realizados: 0, medAcertos: 0, medRedacao: 0, medLG: 0, medCH: 0, medCN: 0, medMAT: 0, erros: { atencao: 0, inter: 0, rec: 0, lac: 0 } };
          const histSim = dadosSimulados?.hist || { labels: [], lg: [], ch: [], cn: [], mat: [] };
          const lista   = dadosSimulados?.lista || [];

          const tipos = [
            { nome: 'Lacuna',        valor: simKpi.erros?.lac || 0,     trilho: 'bg-red-100',     barra: 'bg-red-500',     dot: 'bg-red-500' },
            { nome: 'Recordação',    valor: simKpi.erros?.rec || 0,     trilho: 'bg-purple-100',  barra: 'bg-purple-500',  dot: 'bg-purple-500' },
            { nome: 'Interpretação', valor: simKpi.erros?.inter || 0,   trilho: 'bg-blue-100',    barra: 'bg-blue-500',    dot: 'bg-blue-500' },
            { nome: 'Atenção',       valor: simKpi.erros?.atencao || 0, trilho: 'bg-yellow-100',  barra: 'bg-yellow-500',  dot: 'bg-yellow-500' },
          ].sort((a, b) => b.valor - a.valor);
          const totalErros = tipos.reduce((s, t) => s + t.valor, 0);

          return (
            <div className="space-y-6 animate-in fade-in duration-500">
              <h2 className="text-base font-semibold text-intento-blue border-b pb-3">Simulados</h2>

              {/* KPIs principais */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={cardClass + ' text-center bg-slate-50'}>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1">Simulados Realizados</p>
                  <p className="text-3xl font-bold text-intento-blue mt-1">{simKpi.realizados || 0}</p>
                  <p className="text-[10px] font-medium text-slate-400 mt-1">total</p>
                </div>
                <div className={cardClass + ' text-center border-b-2 border-b-intento-yellow'}>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1">Média de Acertos</p>
                  <p className="text-4xl font-bold text-intento-yellow mt-1">{simKpi.medAcertos || 0}<span className="text-base text-slate-400 font-medium">/180</span></p>
                  <p className="text-[10px] font-medium text-slate-400 mt-1">últimos 3 simulados</p>
                </div>
                <div className={cardClass + ' text-center border-b-2 border-b-intento-blue'}>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1">Média de Redação</p>
                  <p className="text-4xl font-bold text-intento-blue mt-1">{simKpi.medRedacao || 0}</p>
                  <p className="text-[10px] font-medium text-slate-400 mt-1">últimos 3 simulados</p>
                </div>
              </div>

              {/* Disciplinas */}
              <div>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-3">Média por disciplina · últimos 3 simulados</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Linguagens',   key: 'medLG',  color: '#0ea5e9', tw: 'text-sky-600' },
                    { label: 'Humanas',      key: 'medCH',  color: '#f97316', tw: 'text-orange-500' },
                    { label: 'Natureza',     key: 'medCN',  color: '#10b981', tw: 'text-emerald-600' },
                    { label: 'Matemática',   key: 'medMAT', color: '#ef4444', tw: 'text-red-500' },
                  ].map(d => (
                    <div key={d.key} className={cardClass + ' text-center py-4'} style={{ borderTop: `3px solid ${d.color}` }}>
                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1">{d.label}</p>
                      <p className={`text-2xl font-bold mt-1 ${d.tw}`}>{simKpi[d.key] || 0}<span className="text-xs text-slate-400 font-medium">/45</span></p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tipos de erros + Histórico */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className={cardClass + ' col-span-1'}>
                  <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Tipos de Erros</h3>
                  <p className="text-[10px] font-medium text-slate-400 mb-5">média dos últimos 3 simulados</p>
                  {totalErros === 0 ? (
                    <p className="text-xs text-slate-400 font-medium py-8 text-center">Sem simulados analisados.</p>
                  ) : (
                    <div className="space-y-3">
                      {tipos.map(t => {
                        const pct = Math.round((t.valor / totalErros) * 100);
                        return (
                          <div key={t.nome}>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${t.dot}`} />
                                <span className="text-xs font-semibold text-slate-700">{t.nome}</span>
                              </div>
                              <span className="text-[11px] font-medium text-slate-400">{t.valor} <span className="text-slate-300">·</span> {pct}%</span>
                            </div>
                            <div className={`w-full h-2 rounded-full ${t.trilho} overflow-hidden`}>
                              <div className={`h-full rounded-full ${t.barra} transition-all duration-500`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className={cardClass + ' col-span-2'}>
                  <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-4">Histórico de Provas</h3>
                  <div className="h-64">
                    <Line
                      data={{
                        labels: histSim.labels || [],
                        datasets: [
                          { label: 'LG',  data: histSim.lg  || [], borderColor: '#0ea5e9', backgroundColor: '#0ea5e9', tension: 0.3 },
                          { label: 'CH',  data: histSim.ch  || [], borderColor: '#f97316', backgroundColor: '#f97316', tension: 0.3 },
                          { label: 'CN',  data: histSim.cn  || [], borderColor: '#10b981', backgroundColor: '#10b981', tension: 0.3 },
                          { label: 'MAT', data: histSim.mat || [], borderColor: '#ef4444', backgroundColor: '#ef4444', tension: 0.3 },
                          { label: 'Meta', data: (histSim.labels || []).map(() => 40), borderColor: '#94a3b8', backgroundColor: 'transparent', borderDash: [6, 4], pointRadius: 0, borderWidth: 1.5 },
                        ],
                      }}
                      options={{
                        responsive: true, maintainAspectRatio: false,
                        scales: { y: { min: 0, max: 45, grid: { color: 'rgba(150,150,150,0.1)' } }, x: { grid: { display: false } } },
                        plugins: { legend: { position: 'bottom', labels: { usePointStyle: true } } },
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Lista de simulados — mais recentes primeiro */}
              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-4">Simulados realizados</h3>
                {lista.length === 0 ? (
                  <p className="text-xs text-slate-400 font-medium py-8 text-center">Nenhum simulado registrado.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {lista.slice().sort((a, b) => String(b.data || '').localeCompare(String(a.data || ''))).map(sim => {
                      const total = (sim.lg || 0) + (sim.ch || 0) + (sim.cn || 0) + (sim.mat || 0);
                      const concluido = sim.status === 'Concluída';
                      const temAnalise = concluido && (
                        (sim.errosLista && sim.errosLista.length > 0) ||
                        sim.kolb?.exp || sim.kolb?.ref || sim.kolb?.con || sim.kolb?.acao || sim.kolb?.redacao
                      );
                      return (
                        <div key={sim.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                          <div className={`text-white text-[10px] font-semibold uppercase tracking-wide py-2 text-center ${concluido ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                            {concluido ? 'Análise Concluída' : 'Análise Pendente'}
                          </div>
                          <div className="p-4 flex-1 space-y-3">
                            <div>
                              <p className="text-xs text-slate-400 font-medium">{sim.modelo || 'ENEM'}</p>
                              <h4 className="text-sm font-semibold text-intento-blue mt-0.5">{sim.especificacao || '—'}</h4>
                              <p className="text-[11px] text-slate-400 mt-0.5">{sim.data || '—'}</p>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 flex justify-between items-center">
                              <span className="text-xs font-medium text-slate-500">Acertos</span>
                              <span className="font-bold text-intento-blue text-sm">{total}<span className="text-xs text-slate-400 font-normal">/180</span></span>
                            </div>
                            <div className="grid grid-cols-4 gap-1.5 text-center">
                              {[['LG', sim.lg, 'text-sky-600'], ['CH', sim.ch, 'text-orange-500'], ['CN', sim.cn, 'text-emerald-600'], ['MAT', sim.mat, 'text-red-500']].map(([l, v, tw]) => (
                                <div key={l} className="bg-slate-50 rounded p-1.5 border border-slate-100">
                                  <p className="text-[9px] text-slate-400 font-medium uppercase">{l}</p>
                                  <p className={`text-sm font-bold ${tw}`}>{v || 0}</p>
                                </div>
                              ))}
                            </div>
                            {sim.redacao > 0 && (
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-500 font-medium">Redação</span>
                                <span className="font-bold text-intento-blue">{sim.redacao}</span>
                              </div>
                            )}
                          </div>
                          {temAnalise && (
                            <button
                              onClick={() => setSimuladoAberto(sim)}
                              className="w-full text-xs font-semibold text-intento-blue bg-slate-50 hover:bg-intento-blue hover:text-white border-t border-slate-100 py-2.5 transition-colors flex items-center justify-center gap-1.5"
                            >
                              Ver análise completa
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* MODAL: Análise completa do simulado */}
        {simuladoAberto && (() => {
          const sim = simuladoAberto;
          const ESTILO_TIPO = {
            'Lacuna':        { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',    dot: 'bg-red-500' },
            'Recordação':    { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500' },
            'Interpretação': { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   dot: 'bg-blue-500' },
            'Atenção':       { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', dot: 'bg-yellow-500' },
          };
          const ESTILO_AREA = {
            'Linguagens':  '#0ea5e9',
            'Humanas':     '#f97316',
            'Natureza':    '#10b981',
            'Matemática':  '#ef4444',
          };
          const errosPorArea = (sim.errosLista || []).reduce((acc, e) => {
            const a = e.area || 'Outros';
            if (!acc[a]) acc[a] = [];
            acc[a].push(e);
            return acc;
          }, {});
          const totalAcertos = (sim.lg || 0) + (sim.ch || 0) + (sim.cn || 0) + (sim.mat || 0);

          return (
            <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-intento-blue/40 backdrop-blur-sm p-4 animate-in fade-in"
                 onClick={(e) => { if (e.target === e.currentTarget) setSimuladoAberto(null); }}>
              <div className="bg-slate-50 w-full max-w-5xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">

                {/* Header */}
                <div className="bg-white px-8 py-5 border-b border-slate-200 flex justify-between items-start gap-4">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{sim.modelo || 'ENEM'} · {sim.data}</p>
                    <h2 className="text-base font-semibold text-intento-blue mt-0.5">{sim.especificacao || 'Análise do Simulado'}</h2>
                    <div className="flex items-center gap-4 mt-2 text-xs">
                      <span className="text-slate-500">Acertos: <span className="font-bold text-intento-blue">{totalAcertos}/180</span></span>
                      {sim.redacao > 0 && <span className="text-slate-500">Redação: <span className="font-bold text-intento-blue">{sim.redacao}</span></span>}
                    </div>
                  </div>
                  <button onClick={() => setSimuladoAberto(null)} className="text-slate-400 hover:text-red-500 transition-colors shrink-0">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>

                {/* Corpo */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-6">

                  {/* ANÁLISE OBJETIVA */}
                  <section>
                    <div className="flex items-baseline justify-between mb-4">
                      <h3 className="text-sm font-semibold text-intento-blue">Análise Objetiva</h3>
                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{(sim.errosLista || []).length} erros classificados</p>
                    </div>
                    {(!sim.errosLista || sim.errosLista.length === 0) ? (
                      <p className="text-xs text-slate-400 font-medium py-4 text-center bg-white rounded-xl border border-slate-200">Nenhum erro registrado.</p>
                    ) : (
                      <div className="space-y-4">
                        {Object.entries(errosPorArea).map(([area, erros]) => (
                          <div key={area} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                            <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2" style={{ borderLeft: `3px solid ${ESTILO_AREA[area] || '#94a3b8'}` }}>
                              <p className="text-xs font-bold text-intento-blue">{area}</p>
                              <span className="text-[10px] text-slate-400 font-medium">· {erros.length} {erros.length === 1 ? 'erro' : 'erros'}</span>
                            </div>
                            <div className="divide-y divide-slate-100">
                              {erros.map(e => {
                                const t = ESTILO_TIPO[e.tipo] || { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-400' };
                                return (
                                  <div key={e.id || `${area}-${e.questao}`} className="px-4 py-3 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                                    <div className="md:col-span-1">
                                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">{e.questao || '—'}</span>
                                    </div>
                                    <div className="md:col-span-4">
                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Disciplina</p>
                                      <p className="text-xs font-semibold text-slate-700 mt-0.5">{e.disciplina || '—'}</p>
                                    </div>
                                    <div className="md:col-span-5">
                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tópico</p>
                                      <p className="text-xs font-medium text-slate-600 mt-0.5">{e.topico || '—'}</p>
                                    </div>
                                    <div className="md:col-span-2 flex md:justify-end">
                                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border ${t.bg} ${t.text} ${t.border}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />
                                        {e.tipo || '—'}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* ANÁLISE SUBJETIVA */}
                  {(sim.kolb?.exp || sim.kolb?.ref || sim.kolb?.con || sim.kolb?.acao || sim.kolb?.redacao) && (
                    <section>
                      <div className="flex items-baseline justify-between mb-4">
                        <h3 className="text-sm font-semibold text-intento-blue">Análise Subjetiva (Kolb)</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                          { titulo: 'Experiência',   texto: sim.kolb?.exp,     accent: 'border-l-blue-400' },
                          { titulo: 'Reflexão',      texto: sim.kolb?.ref,     accent: 'border-l-purple-400' },
                          { titulo: 'Conceituação',  texto: sim.kolb?.con,     accent: 'border-l-amber-400' },
                          { titulo: 'Ação',          texto: sim.kolb?.acao,    accent: 'border-l-emerald-400' },
                        ].filter(b => b.texto).map(b => (
                          <div key={b.titulo} className={`bg-white rounded-xl border border-slate-200 border-l-4 ${b.accent} p-4`}>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">{b.titulo}</p>
                            <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{b.texto}</p>
                          </div>
                        ))}
                        {sim.kolb?.redacao && (
                          <div className="bg-white rounded-xl border border-slate-200 border-l-4 border-l-rose-400 p-4 md:col-span-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Análise da Redação</p>
                            <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{sim.kolb.redacao}</p>
                          </div>
                        )}
                      </div>
                    </section>
                  )}

                </div>

                <div className="bg-white p-5 border-t border-slate-200 flex justify-end">
                  <button onClick={() => setSimuladoAberto(null)} className="text-sm font-semibold text-slate-500 hover:text-intento-blue transition-colors px-4 py-2">
                    Fechar
                  </button>
                </div>

              </div>
            </div>
          );
        })()}

        {/* ================================================================== */}
        {/* ABA ONBOARDING */}
        {/* ================================================================== */}
        {abaInterna === 'onboarding' && (
          <div className="space-y-5 animate-in fade-in duration-500">
            {carregandoOnboarding && <LoadingInline mensagem="Carregando dados de onboarding..." />}
            {!carregandoOnboarding && erroOnboarding && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-5 text-sm text-red-600 font-medium">
                Erro ao carregar: <span className="font-normal">{erroOnboarding}</span>
              </div>
            )}
            {!carregandoOnboarding && !erroOnboarding && !dadosOnboarding && (
              <div className="text-center py-12 text-slate-400 text-sm">Nenhum dado de onboarding encontrado.</div>
            )}
            {!carregandoOnboarding && dadosOnboarding && (() => {
              const ob = dadosOnboarding;
              const campo = (label, valor) => valor ? (
                <div key={label}>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
                  <p className="text-sm font-medium text-intento-blue">{String(valor)}</p>
                </div>
              ) : null;

              const escala = (label, valor) => {
                const n = parseInt(valor) || 0;
                return (
                  <div key={label} className="flex items-center justify-between gap-3">
                    <p className="text-xs text-slate-600 flex-1">{label}</p>
                    <div className="flex gap-1 shrink-0">
                      {[1,2,3,4,5].map(i => (
                        <div key={i} className={`w-4 h-4 rounded-full ${i <= n ? 'bg-intento-blue' : 'bg-slate-200'}`} />
                      ))}
                    </div>
                  </div>
                );
              };

              const media = (valores) => {
                const nums = valores.map(v => parseInt(v) || 0).filter(v => v > 0);
                if (!nums.length) return null;
                return (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1).replace('.', ',');
              };

              const badgeMedia = (valor) => {
                if (!valor) return null;
                const n = parseFloat(valor.replace(',', '.'));
                const cor = n >= 4 ? 'bg-emerald-100 text-emerald-700' : n >= 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600';
                return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cor}`}>{valor}</span>;
              };

              const mediaCodificacao = media([ob.Leitura_Previa, ob.Estrutura_Mental, ob.Interacao_Aula, ob.Atencao_Conceitos, ob.Escreve_Perguntas, ob.Escreve_Minimo, ob.Poucas_Palavras, ob.Setas_Figuras, ob.Logica_Propria, ob.Revisa_Anotacoes, ob.Procura_Material, ob.Ferramentas_Memorizacao, ob.Passa_Varias_Vezes]);
              const mediaRevisao = media([ob.Cronograma_Revisoes, ob.Revisao_Espacada, ob.Padrao_Revisao, ob.Revisao_Ativa, ob.Diferentes_Metodos, ob.Cria_Flashcards, ob.Procura_Fraquezas]);
              const mediaVida = media([ob.Durmo_8_Horas, ob.Horario_Regular, ob.Sono_Reparador, ob.Exercicio_Fisico, ob.Treino_Atencao, ob.Estuda_Lugares_Diferentes, ob.Objetivos_Claros, ob.Gestao_Atencao, ob.Pausas_Descanso, ob.Pausas_Sem_Telas]);

              return (
                <>
                  {/* Dados Pessoais */}
                  <div className={cardClass}>
                    <h2 className="text-base font-semibold text-intento-blue mb-4 border-b pb-3">Dados Pessoais</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
                      {campo('Nome Completo', ob.Nome_Completo)}
                      {campo('Data de Nascimento', ob.Data_Nascimento)}
                      {campo('Telefone', ob.Telefone)}
                      {campo('E-mail', ob.Email)}
                      {campo('Responsável Financeiro', ob.Responsavel_Financeiro)}
                      {campo('Cidade', ob.Cidade)}
                      {campo('Estado', ob.Estado)}
                      {campo('Data de Registro', ob.Data_Registro)}
                    </div>
                  </div>

                  {/* Perfil Acadêmico */}
                  <div className={cardClass}>
                    <h2 className="text-base font-semibold text-intento-blue mb-4 border-b pb-3">Perfil Acadêmico</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4 mb-5">
                      {campo('Escolaridade', ob.Escolaridade)}
                      {campo('Origem do Ensino Médio', ob.Origem_Ensino_Medio)}
                      {campo('Cota', ob.Cota)}
                      {campo('Fez ENEM Antes', ob.Fez_ENEM_Antes)}
                      {campo('Provas de Interesse', ob.Provas_Interesse)}
                      {campo('Curso de Interesse', ob.Curso_Interesse)}
                      {campo('Plataforma Online', ob.Plataforma_Online)}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                      {campo('Histórico de Estudos', ob.Historico_Estudos)}
                      {campo('3 Maiores Obstáculos', ob.Tres_Maiores_Obstaculos)}
                      {campo('Expectativas com a Mentoria', ob.Expectativas_Mentoria)}
                    </div>
                  </div>

                  {/* Notas Anteriores */}
                  <div className={cardClass}>
                    <h2 className="text-base font-semibold text-intento-blue mb-4 border-b pb-3">Notas Anteriores (ENEM)</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                      {[
                        ['Linguagens', ob.Nota_Linguagens],
                        ['Humanas', ob.Nota_Humanas],
                        ['Natureza', ob.Nota_Natureza],
                        ['Matemática', ob.Nota_Matematica],
                        ['Redação', ob.Nota_Redacao],
                      ].map(([label, val]) => (
                        <div key={label} className="bg-slate-50 rounded-xl p-4 text-center border border-slate-100">
                          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1">{label}</p>
                          <p className="text-2xl font-bold text-intento-blue">{val || '—'}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Diagnóstico Teórico */}
                  <div className={cardClass}>
                    <div className="flex items-baseline justify-between mb-4 border-b pb-3">
                      <h2 className="text-base font-semibold text-intento-blue">Diagnóstico Teórico</h2>
                      {dadosDiagnostico?.data && (
                        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Realizado em {dadosDiagnostico.data}</p>
                      )}
                    </div>
                    {!dadosDiagnostico ? (
                      <p className="text-sm text-slate-400 font-medium py-4 text-center">O aluno ainda não realizou o diagnóstico.</p>
                    ) : (() => {
                      const disc = [
                        { label: 'Biologia',   key: 'biologia',   color: '#10b981', tw: 'text-emerald-600' },
                        { label: 'Química',    key: 'quimica',    color: '#3b82f6', tw: 'text-blue-600' },
                        { label: 'Física',     key: 'fisica',     color: '#f97316', tw: 'text-orange-500' },
                        { label: 'Matemática', key: 'matematica', color: '#a855f7', tw: 'text-purple-500' },
                      ];
                      const total = disc.reduce((s, d) => s + (dadosDiagnostico[d.key] || 0), 0);
                      const pct = (n) => Math.round((n / 45) * 100);
                      return (
                        <>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                            {disc.map(d => {
                              const acertos = dadosDiagnostico[d.key] || 0;
                              return (
                                <div key={d.key} className="bg-slate-50 rounded-xl p-4 text-center border border-slate-100" style={{ borderTop: `3px solid ${d.color}` }}>
                                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1">{d.label}</p>
                                  <p className={`text-2xl font-bold mt-1 ${d.tw}`}>{acertos}<span className="text-xs text-slate-400 font-medium">/45</span></p>
                                  <p className="text-[10px] text-slate-400 mt-1">{pct(acertos)}%</p>
                                </div>
                              );
                            })}
                          </div>
                          <div className="space-y-3">
                            {disc.map(d => {
                              const acertos = dadosDiagnostico[d.key] || 0;
                              const p = pct(acertos);
                              return (
                                <div key={d.key}>
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                      <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                                      <span className="text-xs font-semibold text-slate-700">{d.label}</span>
                                    </div>
                                    <span className="text-[11px] font-medium text-slate-400">{acertos}/45 <span className="text-slate-300">·</span> {p}%</span>
                                  </div>
                                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${p}%`, background: d.color }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="mt-5 pt-4 border-t border-slate-100 flex items-baseline justify-between">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</span>
                            <span className="text-sm font-bold text-intento-blue">{total}<span className="text-xs text-slate-400 font-medium">/180 · {Math.round((total/180)*100)}%</span></span>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* Hábitos */}
                  <div className={cardClass}>
                    <h2 className="text-base font-semibold text-intento-blue mb-5 border-b pb-3">Hábitos de Estudo</h2>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                      {/* Codificação */}
                      <div>
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                          <p className="text-xs font-bold text-intento-blue uppercase tracking-wider">Codificação</p>
                          {badgeMedia(mediaCodificacao)}
                        </div>
                        <div className="space-y-3">
                          {escala('Leitura prévia do material', ob.Leitura_Previa)}
                          {escala('Estrutura mental antes da aula', ob.Estrutura_Mental)}
                          {escala('Interação durante a aula', ob.Interacao_Aula)}
                          {escala('Atenção a conceitos-chave', ob.Atencao_Conceitos)}
                          {escala('Escreve perguntas durante a aula', ob.Escreve_Perguntas)}
                          {escala('Escreve o mínimo possível', ob.Escreve_Minimo)}
                          {escala('Usa poucas palavras nas anotações', ob.Poucas_Palavras)}
                          {escala('Setas e figuras nas anotações', ob.Setas_Figuras)}
                          {escala('Anota com lógica própria', ob.Logica_Propria)}
                          {escala('Revisa anotações após a aula', ob.Revisa_Anotacoes)}
                          {escala('Busca sanar dúvidas após a aula', ob.Procura_Material)}
                          {escala('Usa ferramentas de memorização', ob.Ferramentas_Memorizacao)}
                          {escala('Passa várias vezes no conteúdo', ob.Passa_Varias_Vezes)}
                        </div>
                      </div>

                      {/* Revisão */}
                      <div>
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                          <p className="text-xs font-bold text-intento-blue uppercase tracking-wider">Revisão</p>
                          {badgeMedia(mediaRevisao)}
                        </div>
                        <div className="space-y-3">
                          {escala('Tem cronograma de revisões', ob.Cronograma_Revisoes)}
                          {escala('Usa revisão espaçada', ob.Revisao_Espacada)}
                          {escala('Segue padrão D1/D7/D15', ob.Padrao_Revisao)}
                          {escala('Revisão ativa (lembrar de cabeça)', ob.Revisao_Ativa)}
                          {escala('Usa diferentes métodos de revisão', ob.Diferentes_Metodos)}
                          {escala('Cria próprios flashcards', ob.Cria_Flashcards)}
                          {escala('Busca ativamente suas fraquezas', ob.Procura_Fraquezas)}
                        </div>
                      </div>

                      {/* Hábitos de Vida */}
                      <div>
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                          <p className="text-xs font-bold text-intento-blue uppercase tracking-wider">Hábitos de Vida</p>
                          {badgeMedia(mediaVida)}
                        </div>
                        <div className="space-y-3">
                          {escala('Dorme 8 horas', ob.Durmo_8_Horas)}
                          {escala('Horário regular de sono', ob.Horario_Regular)}
                          {escala('Sono reparador', ob.Sono_Reparador)}
                          {escala('Pratica exercício físico', ob.Exercicio_Fisico)}
                          {escala('Treino de atenção', ob.Treino_Atencao)}
                          {escala('Estuda em lugares diferentes', ob.Estuda_Lugares_Diferentes)}
                          {escala('Objetivos claros ao estudar', ob.Objetivos_Claros)}
                          {escala('Gestão da atenção', ob.Gestao_Atencao)}
                          {escala('Faz pausas de descanso', ob.Pausas_Descanso)}
                          {escala('Pausas sem telas', ob.Pausas_Sem_Telas)}
                        </div>
                      </div>

                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {abaInterna === 'registros' && (
          <HistoricoAnalitico
            registros={historicoRegistros}
            cardClass={cardClass}
            idPlanilha={params.id}
            onUpdate={(idx, novaRow) => setHistoricoRegistros(prev => prev.map((r, i) => i === idx ? novaRow : r))}
          />
        )}
      </div>

      {/* Estilo embutido para scrollbar bonita dentro do Modal e do Histórico */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; }
      `}} />
    </div>
  );
}