'use client';

import { apiFetch } from '@/lib/api';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Bar, Line } from '@/components/Charts';
import { LoadingScreen } from '@/components/Loading';
import { getCache, setCache, tempoRelativo } from '@/lib/cacheClient';
import PushToggle from '@/components/PushToggle';
import PainelLiderPipeline from '@/components/PainelLiderPipeline';

const EMAILS_LIDER = ['filippe@metodointento.com.br', 'rafael@metodointento.com.br'];

const cardClass = "bg-white rounded-xl border border-slate-200 p-5 shadow-sm";

function SeccaoColapsavel({ titulo, subtitulo, resumo, aberto, onToggle, children }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={onToggle}
        aria-expanded={aberto}
        className="w-full px-5 py-4 flex items-center justify-between gap-4 hover:bg-slate-50 transition text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h2 className="text-base font-semibold text-intento-blue">{titulo}</h2>
            {subtitulo && <span className="text-[11px] text-slate-400 font-medium">{subtitulo}</span>}
          </div>
          {resumo && <div className="text-[11px] text-slate-500 font-medium mt-1 flex flex-wrap gap-x-3 gap-y-0.5">{resumo}</div>}
        </div>
        <svg className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${aberto ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      {aberto && <div className="border-t border-slate-100 p-5 space-y-5">{children}</div>}
    </div>
  );
}

const FAIXAS_HORAS = [
  { faixa: '0–5h',   color: '#ef4444' },
  { faixa: '5–10h',  color: '#f97316' },
  { faixa: '10–15h', color: '#eab308' },
  { faixa: '15–20h', color: '#10b981' },
  { faixa: '20h+',   color: '#3b82f6' },
];

export default function PainelLider() {
  const router = useRouter();
  const [autorizado, setAutorizado] = useState(false);
  const [emailLogado, setEmailLogado] = useState('');
  const [aba, setAba] = useState('mentoria');
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState('');
  const [dados, setDados] = useState(null);
  const [cacheTs, setCacheTs] = useState(null);

  // Filtros
  const [mentoresSelecionados, setMentoresSelecionados] = useState([]);
  const [filtroDesempenho, setFiltroDesempenho] = useState('');
  const [busca, setBusca] = useState('');
  const [tipoAlunoFiltro, setTipoAlunoFiltro] = useState('');
  const [mentoresExpandidos, setMentoresExpandidos] = useState({});

  // Edição dos campos do fac-símile EM (tipo_aluno/escola — turma/fase deprecated MVP)
  const [alunoEditando, setAlunoEditando] = useState(null);
  const [editTipo, setEditTipo] = useState('ENEM');
  const [editEscola, setEditEscola] = useState('');
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [mensagemEdicao, setMensagemEdicao] = useState('');

  // Sanfonas das seções principais — só "Encontros" aberto por padrão
  const [seccoesAbertas, setSeccoesAbertas] = useState({ encontros: true, analitica: false, mentores: false });
  const toggleSeccao = (key) => setSeccoesAbertas(prev => ({ ...prev, [key]: !prev[key] }));

  // Designação de mentor
  const [alunoDesignar, setAlunoDesignar] = useState(null);
  const [mentorEscolhido, setMentorEscolhido] = useState('');
  const [planoEscolhido, setPlanoEscolhido] = useState('');
  const [designando, setDesignando] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState('');

  const PLANOS_DISPONIVEIS = ['Mensal', 'Quinzenal', 'Semanal', 'Padrão', 'Custom'];

  // Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      const email = user?.email?.toLowerCase() || (typeof window !== 'undefined' ? sessionStorage.getItem('emailLogado') : null);
      if (!email) { router.push('/'); return; }
      if (!EMAILS_LIDER.includes(email)) {
        if (email.endsWith('@metodointento.com.br')) router.push('/mentor');
        else router.push('/painel');
        return;
      }
      setEmailLogado(email);
      setAutorizado(true);
    });
    return () => unsub();
  }, [router]);

  // Fetch (com cache client-side: exibe último estado conhecido enquanto rede carrega)
  useEffect(() => {
    if (!autorizado) return;

    // 1) Tenta servir do cache imediatamente
    const cached = getCache('dashboardLider');
    if (cached) {
      setDados(cached.data);
      setCacheTs(cached.ts);
      setCarregando(false);
      setAtualizando(true); // mostra "atualizando..." em background
    } else {
      setCarregando(true);
    }
    setErro('');

    // 2) Em paralelo dispara fetch real
    apiFetch('/api/mentor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'dashboardLider', email: emailLogado }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.status !== 'sucesso') {
          if (!cached) setErro(d.mensagem || 'Erro ao carregar dashboard.');
          return;
        }
        setDados(d);
        setCache('dashboardLider', d);
        setCacheTs(Date.now());
      })
      .catch(() => { if (!cached) setErro('Erro de conexão.'); })
      .finally(() => { setCarregando(false); setAtualizando(false); });
  }, [autorizado, emailLogado]);

  // Lista de mentores únicos (do agregado)
  const listaMentoresUnicos = useMemo(() => {
    if (!dados?.alunos) return [];
    const mapa = {};
    dados.alunos.forEach(a => {
      if (!a.mentor) return;
      if (!mapa[a.mentor]) mapa[a.mentor] = { email: a.mentor, nome: a.mentorNome || a.mentor, count: 0, ativo: a.mentorAtivo };
      mapa[a.mentor].count++;
    });
    return Object.values(mapa).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [dados]);

  // Aplica filtros
  const alunosFiltrados = useMemo(() => {
    if (!dados?.alunos) return [];
    return dados.alunos.filter(a => {
      if (mentoresSelecionados.length > 0 && !mentoresSelecionados.includes(a.mentor)) return false;
      if (tipoAlunoFiltro && (a.tipoAluno || 'ENEM') !== tipoAlunoFiltro) return false;
      if (busca) {
        const q = busca.toLowerCase();
        if (!a.nome?.toLowerCase().includes(q) && !a.email?.toLowerCase().includes(q)) return false;
      }
      // Filtro desempenho ainda não tem dado per-aluno (precisaria de mais campos no agregado)
      // Mantém por compatibilidade futura
      return true;
    });
  }, [dados, mentoresSelecionados, busca, tipoAlunoFiltro]);

  // Agrupa filtrados por mentor
  const alunosAgrupados = useMemo(() => {
    const grupos = {};
    alunosFiltrados.forEach(a => {
      const key = a.mentor || 'sem-mentor';
      if (!grupos[key]) grupos[key] = { mentor: a.mentor, mentorNome: a.mentorNome || a.mentor, mentorAtivo: a.mentorAtivo, alunos: [] };
      grupos[key].alunos.push(a);
    });
    return Object.values(grupos).sort((x, y) => x.mentorNome.localeCompare(y.mentorNome));
  }, [alunosFiltrados]);

  // KPIs derivados
  const totalAlunos = alunosFiltrados.length;
  const registrados = alunosFiltrados.filter(a => a.registrouSemanaAtual).length;
  const taxaRegistro = totalAlunos > 0 ? Math.round((registrados / totalAlunos) * 100) : 0;

  const sair = async () => {
    await auth.signOut();
    sessionStorage.removeItem('emailLogado');
    router.push('/');
  };

  // Lista de alunos sem mentor ativo (mentor vazio ou inativo)
  const alunosAguardando = useMemo(() => {
    return (dados?.alunos || []).filter(a => !a.mentor || !a.mentorAtivo);
  }, [dados]);

  // Pendências de diagnóstico — alunos em "Aguardando Diagnóstico" (não estão em alunos[]
  // porque o handleDashboardLider só lista quem já tem onboarding completo).
  // Líder vê aqui pra designar mentor (se não tem) ou cobrar diagnóstico do aluno.
  const pendenciasDiagnostico = useMemo(() => dados?.pendencias || [], [dados]);

  // Inativar aluno (líder marca como saiu da mentoria)
  const [inativando, setInativando] = useState(null); // idAluno em loading
  const inativarAluno = async (aluno) => {
    if (!confirm(`Marcar ${aluno.nome} como INATIVO? Ele some do painel do líder e da lista do mentor. Reversível pelo Sheets (limpar célula dt_saida).`)) return;
    setInativando(aluno.idAluno);
    try {
      const r = await apiFetch('/api/mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'inativarAluno', idAluno: aluno.idAluno }),
      });
      const data = await r.json();
      if (data.status === 'sucesso') {
        // Remove localmente das duas listas pra UX imediata; refetch confirma no próximo load
        setDados(prev => prev ? {
          ...prev,
          alunos: (prev.alunos || []).filter(a => a.idAluno !== aluno.idAluno),
          pendencias: (prev.pendencias || []).filter(a => a.idAluno !== aluno.idAluno),
        } : prev);
      } else {
        alert('Erro: ' + (data.mensagem || 'falha ao inativar'));
      }
    } catch (e) {
      alert('Erro de conexão ao inativar.');
    } finally {
      setInativando(null);
    }
  };

  const haFiltroAtivo = mentoresSelecionados.length > 0 || busca.trim().length > 0 || !!tipoAlunoFiltro;

  // Quando há filtro, recalcula o agregado da Visão Analítica a partir das
  // métricas brutas que cada aluno traz em `a.metricas`. Sem filtro, usa o
  // agregado já calculado pelo backend (mais barato).
  const agregadoVisivel = useMemo(() => {
    if (!haFiltroAtivo) return dados?.agregado || {};
    // Se backend ainda não foi redeployado, alunos vêm sem `metricas`. Fallback
    // pro agregado da base evita zerar a visão analítica silenciosamente.
    if (!alunosFiltrados.some(a => a.metricas)) return dados?.agregado || {};

    const FAIXAS_LABELS = ['0-5h', '5-10h', '10-15h', '15-20h', '20h+'];
    const distribuicao = FAIXAS_LABELS.map(faixa => ({ faixa, count: 0 }));
    const histPorSemana = {};
    const somas = { domBio:0, cDomBio:0, domQui:0, cDomQui:0, domFis:0, cDomFis:0, domMat:0, cDomMat:0,
                    progBio:0, cProgBio:0, progQui:0, cProgQui:0, progFis:0, cProgFis:0, progMat:0, cProgMat:0 };
    const bem = { est:0, cEst:0, ans:0, cAns:0, mot:0, cMot:0, son:0, cSon:0 };
    let simulados4w = 0;

    alunosFiltrados.forEach(a => {
      const mx = a.metricas;
      if (!mx) return;
      if (mx.faixaHoras >= 0 && mx.faixaHoras < distribuicao.length) distribuicao[mx.faixaHoras].count++;
      ['est','cEst','ans','cAns','mot','cMot','son','cSon'].forEach(k => { bem[k] += mx.bem?.[k] || 0; });
      Object.keys(somas).forEach(k => { somas[k] += mx.materias?.[k] || 0; });
      Object.entries(mx.historico || {}).forEach(([lbl, h]) => {
        if (!histPorSemana[lbl]) histPorSemana[lbl] = { horas: 0, meta: 0, count: 0 };
        histPorSemana[lbl].horas += h.horas || 0;
        histPorSemana[lbl].meta  += h.meta  || 0;
        histPorSemana[lbl].count += h.count || 0;
      });
      simulados4w += mx.simulados4w || 0;
    });

    const avg = (s, c) => c > 0 ? +(s / c).toFixed(1) : 0;

    const labels = Object.keys(histPorSemana).sort((x, y) => {
      const pl = (l) => { const p = l.split(' a ')[0].split('/'); return new Date(+p[2], +p[1]-1, +p[0]).getTime(); };
      return pl(x) - pl(y);
    }).slice(-8);

    return {
      horasEstudadas: {
        distribuicao,
        historico8Semanas: labels.map(l => ({
          semana: l,
          mediaHoras: avg(histPorSemana[l].horas, histPorSemana[l].count),
          mediaMeta:  avg(histPorSemana[l].meta,  histPorSemana[l].count),
        })),
      },
      dominioPorMateria:   { bio: avg(somas.domBio,  somas.cDomBio),  qui: avg(somas.domQui,  somas.cDomQui),  fis: avg(somas.domFis,  somas.cDomFis),  mat: avg(somas.domMat,  somas.cDomMat) },
      progressoPorMateria: { bio: avg(somas.progBio, somas.cProgBio), qui: avg(somas.progQui, somas.cProgQui), fis: avg(somas.progFis, somas.cProgFis), mat: avg(somas.progMat, somas.cProgMat) },
      bemEstar:            { estresse: avg(bem.est, bem.cEst), ansiedade: avg(bem.ans, bem.cAns), motivacao: avg(bem.mot, bem.cMot), sono: avg(bem.son, bem.cSon) },
      simuladosUltimas4Semanas: simulados4w,
    };
  }, [haFiltroAtivo, alunosFiltrados, dados]);

  // Resumo dos encontros (alimenta o header da sanfona)
  const resumoEncontros = useMemo(() => {
    const comPlano = alunosFiltrados.filter(a => a.encontrosEsperados !== null && a.encontrosEsperados > 0);
    if (comPlano.length === 0) return null;
    let atrasados = 0, emDia = 0;
    comPlano.forEach(a => {
      const r = (a.encontrosMesCorrente || 0) / a.encontrosEsperados;
      if (r < 0.5) atrasados++;
      else if (r >= 1) emDia++;
    });
    return { total: comPlano.length, atrasados, emDia };
  }, [alunosFiltrados]);

  const abrirDesignacao = (aluno) => {
    setAlunoDesignar(aluno);
    setMentorEscolhido(aluno.mentor || '');
    const planoAtual = (aluno.plano || '').replace('Padrao', 'Padrão');
    setPlanoEscolhido(PLANOS_DISPONIVEIS.includes(planoAtual) ? planoAtual : '');
  };

  const designarMentor = async () => {
    if (!alunoDesignar || !mentorEscolhido || !planoEscolhido || designando) return;
    setDesignando(true);
    setMensagemSucesso('');
    try {
      const res = await apiFetch('/api/mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'designarMentor',
          email: emailLogado,
          idAluno: alunoDesignar.idAluno,
          emailMentor: mentorEscolhido,
          plano: planoEscolhido,
        }),
      });
      const data = await res.json();
      if (data.status !== 'sucesso') {
        alert('Erro: ' + (data.mensagem || 'falha na designação'));
        return;
      }
      const partsEnviados = [];
      if (data.emailsEnviados?.aluno)  partsEnviados.push('aluno');
      if (data.emailsEnviados?.mentor) partsEnviados.push('mentor');
      const msg = data.aluno?.nome + ' → ' + data.mentorNome +
        (partsEnviados.length ? ' · email enviado a ' + partsEnviados.join(' e ') : ' · sem emails');
      setMensagemSucesso(msg);
      setAlunoDesignar(null);
      // Refetch dashboard pra refletir mudança
      const refetched = await apiFetch('/api/mentor', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'dashboardLider', email: emailLogado }),
      });
      const novosDados = await refetched.json();
      if (novosDados.status === 'sucesso') setDados(novosDados);
      setTimeout(() => setMensagemSucesso(''), 6000);
    } catch (e) {
      alert('Erro de conexão.');
    } finally {
      setDesignando(false);
    }
  };

  const abrirEdicao = (aluno) => {
    setAlunoEditando(aluno);
    setEditTipo(aluno.tipoAluno || 'ENEM');
    setEditEscola(aluno.escola || '');
    setMensagemEdicao('');
  };

  const salvarEdicao = async () => {
    if (!alunoEditando || salvandoEdicao) return;
    setSalvandoEdicao(true);
    setMensagemEdicao('');
    try {
      const res = await apiFetch('/api/mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'atualizarDadosAluno',
          email: emailLogado,
          idAluno: alunoEditando.idAluno,
          tipoAluno: editTipo,
          escola: editEscola,
        }),
      });
      const data = await res.json();
      if (data.status !== 'sucesso') {
        alert('Erro: ' + (data.mensagem || 'falha ao salvar'));
        return;
      }
      // Atualiza estado local sem refetch (otimista)
      setDados(prev => prev ? {
        ...prev,
        alunos: prev.alunos.map(a => a.idAluno === alunoEditando.idAluno
          ? { ...a, tipoAluno: editTipo, escola: editEscola }
          : a),
      } : prev);
      setMensagemEdicao(`${alunoEditando.nome} atualizado.`);
      setAlunoEditando(null);
      setTimeout(() => setMensagemEdicao(''), 5000);
    } catch (e) {
      alert('Erro de conexão.');
    } finally {
      setSalvandoEdicao(false);
    }
  };

  if (!autorizado) return <LoadingScreen mensagem="Carregando..." />;
  if (carregando) return <LoadingScreen mensagem="Sincronizando painel — pode levar até 1 minuto na primeira carga..." />;

  if (erro) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
        <p className="text-sm text-red-600 font-medium mb-4">Erro: {erro}</p>
        <button onClick={() => window.location.reload()} className="text-sm font-semibold text-intento-blue hover:underline">Tentar novamente</button>
      </div>
    );
  }

  const ag = agregadoVisivel || {};
  const distribuicao = ag.horasEstudadas?.distribuicao || [];
  const historico = ag.horasEstudadas?.historico8Semanas || [];
  const dominio = ag.dominioPorMateria || {};
  const progresso = ag.progressoPorMateria || {};
  const bemEstar = ag.bemEstar || {};
  const simulados = ag.simuladosUltimas4Semanas || 0;

  const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, font: { size: 10 } } } },
    scales: { y: { beginAtZero: true, grid: { color: 'rgba(150,150,150,0.1)' } }, x: { grid: { display: false } } },
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">

      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center gap-4 justify-between sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/selecionar-modo')} className="text-sm font-medium text-slate-400 hover:text-intento-blue transition">← Voltar</button>
          <div>
            <h1 className="text-base font-semibold text-intento-blue">Painel do Líder</h1>
            <p className="text-[11px] text-slate-400 font-medium">
              Semana de referência: {dados?.semanaAtual || '—'}
              {cacheTs && (
                <span className="ml-2">
                  ·{' '}
                  {atualizando ? (
                    <span className="text-amber-600 inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      atualizando…
                    </span>
                  ) : (
                    <span className="text-emerald-600">atualizado {tempoRelativo(cacheTs)}</span>
                  )}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <PushToggle email={emailLogado} />
          <button onClick={sair} className="text-sm font-semibold text-slate-400 hover:text-red-500 transition">Sair</button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 lg:p-6 space-y-6">

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200 -mt-2">
          <button
            onClick={() => setAba('mentoria')}
            className={`px-4 py-2.5 text-sm font-semibold transition border-b-2 ${aba === 'mentoria' ? 'text-intento-blue border-intento-blue' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
          >
            Mentoria
          </button>
          <button
            onClick={() => setAba('pipeline')}
            className={`px-4 py-2.5 text-sm font-semibold transition border-b-2 ${aba === 'pipeline' ? 'text-intento-blue border-intento-blue' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
          >
            Pipeline (CRM)
          </button>
        </div>

        {aba === 'pipeline' && <PainelLiderPipeline email={emailLogado} />}

        {aba === 'mentoria' && (<>

        {/* KPIs no topo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={cardClass + ' text-center'}>
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1">Alunos Ativos</p>
            <p className="text-3xl font-bold text-intento-blue">{totalAlunos}</p>
          </div>
          <div className={cardClass + ' text-center'}>
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1">Registrados na semana</p>
            <p className={`text-3xl font-bold ${taxaRegistro >= 80 ? 'text-emerald-600' : taxaRegistro >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{registrados}<span className="text-base text-slate-400 font-medium">/{totalAlunos}</span></p>
            <p className="text-[10px] font-medium text-slate-400 mt-1">{taxaRegistro}%</p>
          </div>
          <div className={cardClass + ' text-center'}>
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1">Mentores Ativos</p>
            <p className="text-3xl font-bold text-intento-blue">{listaMentoresUnicos.filter(m => m.ativo).length}</p>
          </div>
          <div className={cardClass + ' text-center border-b-2 border-b-intento-yellow'}>
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1">Simulados (últ. 4 sem.)</p>
            <p className="text-3xl font-bold text-intento-yellow">{simulados}</p>
          </div>
        </div>

        {/* Filtros */}
        <div className={cardClass}>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Filtros</p>
          <div className="flex flex-wrap gap-3 items-center">

            {/* Filtro Mentor */}
            <details className="relative">
              <summary className="cursor-pointer list-none text-xs font-semibold text-intento-blue bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-2 rounded-lg transition">
                Mentor {mentoresSelecionados.length > 0 && <span className="bg-intento-blue text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">{mentoresSelecionados.length}</span>}
              </summary>
              <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-3 min-w-[260px] z-10 max-h-[300px] overflow-y-auto">
                {listaMentoresUnicos.map(m => (
                  <label key={m.email} className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-slate-50 px-2 rounded">
                    <input
                      type="checkbox"
                      checked={mentoresSelecionados.includes(m.email)}
                      onChange={(e) => {
                        if (e.target.checked) setMentoresSelecionados(prev => [...prev, m.email]);
                        else setMentoresSelecionados(prev => prev.filter(x => x !== m.email));
                      }}
                      className="w-3.5 h-3.5"
                    />
                    <span className="text-xs font-medium text-slate-700 flex-1 truncate">{m.nome}</span>
                    <span className="text-[10px] text-slate-400 font-medium">{m.count}</span>
                  </label>
                ))}
                {mentoresSelecionados.length > 0 && (
                  <button onClick={() => setMentoresSelecionados([])} className="text-[10px] text-intento-blue font-bold hover:underline mt-2">Limpar</button>
                )}
              </div>
            </details>

            {/* Filtro tipo_aluno */}
            <select
              value={tipoAlunoFiltro}
              onChange={e => setTipoAlunoFiltro(e.target.value)}
              className="text-xs font-semibold text-intento-blue bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-2 focus:ring-intento-blue cursor-pointer"
            >
              <option value="">Todos os tipos</option>
              <option value="ENEM">ENEM</option>
              <option value="EM">Ensino Médio</option>
            </select>

            {/* Filtro busca */}
            <div className="relative flex-1 min-w-[200px]">
              <input
                type="text"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar aluno por nome ou email..."
                className="w-full text-xs font-medium text-intento-blue px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-intento-blue placeholder:text-slate-400"
              />
            </div>

            {/* Limpar todos */}
            {(mentoresSelecionados.length > 0 || busca || tipoAlunoFiltro) && (
              <button
                onClick={() => { setMentoresSelecionados([]); setBusca(''); setTipoAlunoFiltro(''); }}
                className="text-xs font-semibold text-slate-400 hover:text-red-500 px-3 py-2 transition"
              >
                Limpar tudo
              </button>
            )}
          </div>
        </div>

        {/* Pendências de diagnóstico — alunos em "Aguardando Diagnóstico" */}
        {pendenciasDiagnostico.length > 0 && (
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3 gap-3">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                <h2 className="text-sm font-bold text-blue-800">Pendências de diagnóstico</h2>
                <span className="bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{pendenciasDiagnostico.length}</span>
              </div>
            </div>
            <p className="text-xs text-blue-700/80 font-medium mb-4">Alunos que fizeram onboarding mas ainda não fizeram o diagnóstico teórico. Designe mentor (se faltar) e/ou cobre o diagnóstico.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {pendenciasDiagnostico.map(a => (
                <div key={a.idAluno} className="bg-white border border-blue-200 rounded-lg p-3 flex flex-col gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-700 truncate">{a.nome}</p>
                    <p className="text-[11px] text-slate-400 font-medium truncate">{a.email}</p>
                    {a.mentor && a.mentorAtivo && (
                      <p className="text-[10px] text-slate-500 font-medium mt-0.5 truncate">mentor: {a.mentorNome || a.mentor}</p>
                    )}
                    {a.mentor && !a.mentorAtivo && (
                      <p className="text-[10px] text-amber-600 font-medium mt-0.5 truncate">mentor inativo: {a.mentor}</p>
                    )}
                    {!a.mentor && (
                      <p className="text-[10px] text-blue-700 font-medium mt-0.5">sem mentor designado</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    {(!a.mentor || !a.mentorAtivo) && (
                      <button
                        onClick={() => abrirDesignacao(a)}
                        className="text-[11px] font-semibold bg-intento-yellow text-white px-3 py-1.5 rounded-lg hover:bg-yellow-500 transition shrink-0"
                      >
                        Designar
                      </button>
                    )}
                    <button
                      onClick={() => inativarAluno(a)}
                      disabled={inativando === a.idAluno}
                      className="text-[11px] font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1.5 rounded transition disabled:opacity-50"
                      title="Marcar como inativo"
                    >
                      {inativando === a.idAluno ? '...' : 'Inativar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Aguardando Designação — destaque pra alunos sem mentor */}
        {alunosAguardando.length > 0 && (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3 gap-3">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z"/></svg>
                <h2 className="text-sm font-bold text-amber-800">Aguardando designação</h2>
                <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{alunosAguardando.length}</span>
              </div>
            </div>
            <p className="text-xs text-amber-700/80 font-medium mb-4">Alunos sem mentor ativo cadastrado. Designe um mentor para que ele entre em contato.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {alunosAguardando.map(a => (
                <div key={a.idAluno} className="bg-white border border-amber-200 rounded-lg p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-700 truncate">{a.nome}</p>
                    <p className="text-[11px] text-slate-400 font-medium truncate">{a.email}</p>
                    {a.mentor && !a.mentorAtivo && (
                      <p className="text-[10px] text-amber-600 font-medium mt-0.5 truncate">mentor inativo: {a.mentor}</p>
                    )}
                  </div>
                  <button
                    onClick={() => abrirDesignacao(a)}
                    className="text-xs font-semibold bg-intento-yellow text-white px-3 py-1.5 rounded-lg hover:bg-yellow-500 transition shrink-0"
                  >
                    Designar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Toast de sucesso da designação */}
        {mensagemSucesso && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 flex items-center gap-3">
            <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/></svg>
            <span className="text-xs font-semibold text-emerald-800">Designado: {mensagemSucesso}</span>
          </div>
        )}

        {/* Toast de sucesso da edição */}
        {mensagemEdicao && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 flex items-center gap-3">
            <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/></svg>
            <span className="text-xs font-semibold text-emerald-800">{mensagemEdicao}</span>
          </div>
        )}

        {/* Modal de designação */}
        {alunoDesignar && (
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-intento-blue/40 backdrop-blur-sm p-4 animate-in fade-in"
               onClick={(e) => { if (e.target === e.currentTarget) setAlunoDesignar(null); }}>
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Designar mentor</p>
                <h2 className="text-base font-semibold text-intento-blue mt-0.5">{alunoDesignar.nome}</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">{alunoDesignar.email}</p>
                {alunoDesignar.mentor && (
                  <p className="text-[11px] text-slate-500 mt-2">
                    Mentor atual: <span className="font-semibold">{alunoDesignar.mentorNome || alunoDesignar.mentor}</span>
                    {!alunoDesignar.mentorAtivo && <span className="ml-1 text-amber-600">(inativo)</span>}
                  </p>
                )}
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Selecione o mentor</label>
                  <select
                    value={mentorEscolhido}
                    onChange={(e) => setMentorEscolhido(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-intento-blue text-sm font-medium text-intento-blue"
                  >
                    <option value="">— Escolha um mentor ativo —</option>
                    {(dados?.mentoresAtivos || []).map(m => (
                      <option key={m.email} value={m.email}>{m.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Plano contratado
                    {alunoDesignar.plano && (
                      <span className="ml-2 normal-case text-slate-400 font-medium">
                        (atual: {alunoDesignar.plano})
                      </span>
                    )}
                  </label>
                  <select
                    value={planoEscolhido}
                    onChange={(e) => setPlanoEscolhido(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-intento-blue text-sm font-medium text-intento-blue"
                  >
                    <option value="">— Escolha o plano —</option>
                    {PLANOS_DISPONIVEIS.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Ao confirmar, o sistema atualiza o mentor e o plano na planilha e <b>envia email automático</b> para o aluno e para o mentor com os dados de contato.
                </p>
              </div>

              <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  onClick={() => setAlunoDesignar(null)}
                  className="text-sm font-semibold text-slate-500 hover:text-intento-blue px-4 py-2 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={designarMentor}
                  disabled={!mentorEscolhido || !planoEscolhido || designando}
                  className="text-sm font-semibold bg-intento-blue hover:bg-blue-900 text-white px-5 py-2 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {designando ? 'Enviando...' : 'Designar e notificar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de edição de dados do aluno (tipo_aluno/turma/escola/fase) */}
        {alunoEditando && (
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-intento-blue/40 backdrop-blur-sm p-4 animate-in fade-in"
               onClick={(e) => { if (e.target === e.currentTarget) setAlunoEditando(null); }}>
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Editar dados do aluno</p>
                <h2 className="text-base font-semibold text-intento-blue mt-0.5">{alunoEditando.nome}</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">{alunoEditando.email}</p>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Tipo de aluno</label>
                  <select
                    value={editTipo}
                    onChange={(e) => setEditTipo(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-intento-blue text-sm font-medium text-intento-blue"
                  >
                    <option value="ENEM">ENEM</option>
                    <option value="EM">Ensino Médio</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Escola</label>
                  <input
                    type="text"
                    value={editEscola}
                    onChange={(e) => setEditEscola(e.target.value)}
                    placeholder="Nome da escola"
                    className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-intento-blue text-sm font-medium text-intento-blue placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  onClick={() => setAlunoEditando(null)}
                  className="text-sm font-semibold text-slate-500 hover:text-intento-blue px-4 py-2 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={salvarEdicao}
                  disabled={salvandoEdicao}
                  className="text-sm font-semibold bg-intento-blue hover:bg-blue-900 text-white px-5 py-2 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {salvandoEdicao ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Encontros do mês corrente */}
        <SeccaoColapsavel
          titulo="Encontros do mês corrente"
          subtitulo="realizados / esperados · respeita filtros · ordenado pelos mais atrasados"
          aberto={seccoesAbertas.encontros}
          onToggle={() => toggleSeccao('encontros')}
          resumo={resumoEncontros ? (
            <>
              <span><b className="text-intento-blue">{resumoEncontros.total}</b> aluno{resumoEncontros.total !== 1 ? 's' : ''}</span>
              <span><b className="text-red-600">{resumoEncontros.atrasados}</b> atrasado{resumoEncontros.atrasados !== 1 ? 's' : ''}</span>
              <span><b className="text-emerald-600">{resumoEncontros.emDia}</b> em dia</span>
            </>
          ) : <span className="text-slate-400 italic">sem alunos com plano nos filtros</span>}
        >
          {(() => {
            const comPlano = alunosFiltrados.filter(a => a.encontrosEsperados !== null && a.encontrosEsperados > 0);
            const semPlano = alunosFiltrados.filter(a => a.encontrosEsperados === null);
            if (comPlano.length === 0 && semPlano.length === 0) {
              return <p className="text-xs text-slate-400 italic text-center py-6">Nenhum aluno encontrado nos filtros.</p>;
            }
            const ordenados = [...comPlano].sort((a, b) => {
              const pa = (a.encontrosMesCorrente || 0) / a.encontrosEsperados;
              const pb = (b.encontrosMesCorrente || 0) / b.encontrosEsperados;
              return pa - pb;
            });
            return (
              <>
                {ordenados.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {ordenados.map(a => {
                      const realizados = a.encontrosMesCorrente || 0;
                      const ratio = realizados / a.encontrosEsperados;
                      const cor = ratio >= 1
                        ? 'bg-emerald-50 border-emerald-200'
                        : ratio >= 0.5
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-red-50 border-red-200';
                      const corText = ratio >= 1 ? 'text-emerald-700' : ratio >= 0.5 ? 'text-amber-700' : 'text-red-700';
                      return (
                        <div key={a.idAluno} className={`flex items-center justify-between gap-2 p-2.5 rounded-lg border ${cor}`}>
                          <span className="text-xs font-semibold text-slate-700 truncate flex-1">{a.nome}</span>
                          <span className={`text-xs font-bold whitespace-nowrap ${corText}`}>
                            {realizados}/{a.encontrosEsperados}
                          </span>
                          <span className="text-[10px] text-slate-400 whitespace-nowrap">{a.plano}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {semPlano.length > 0 && (
                  <details className="mt-4">
                    <summary className="text-xs font-semibold text-slate-400 cursor-pointer hover:text-slate-600">
                      {semPlano.length} aluno{semPlano.length !== 1 ? 's' : ''} sem cálculo (Custom ou sem plano)
                    </summary>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {semPlano.map(a => (
                        <div key={a.idAluno} className="flex items-center justify-between gap-2 p-2 rounded-lg border bg-slate-50 border-slate-200">
                          <span className="text-xs font-medium text-slate-600 truncate flex-1">{a.nome}</span>
                          <span className="text-xs text-slate-400">{a.plano || '—'}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </>
            );
          })()}
        </SeccaoColapsavel>

        {/* Visão analítica — recalculada a partir das métricas brutas quando há filtro */}
        <SeccaoColapsavel
          titulo="Visão analítica"
          subtitulo={haFiltroAtivo ? 'recalculado com base nos filtros ativos' : 'visão geral da base'}
          aberto={seccoesAbertas.analitica}
          onToggle={() => toggleSeccao('analitica')}
          resumo={
            <>
              <span><b className="text-intento-blue">{haFiltroAtivo ? alunosFiltrados.length : (dados?.alunos || []).length}</b> aluno{(haFiltroAtivo ? alunosFiltrados.length : (dados?.alunos || []).length) !== 1 ? 's' : ''} {haFiltroAtivo ? 'no filtro' : 'na base'}</span>
              <span>distribuição de horas · domínio · progresso · bem-estar</span>
            </>
          }
        >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Histograma de horas */}
          <div className={cardClass}>
            <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Distribuição de horas estudadas</h3>
            <p className="text-[10px] font-medium text-slate-400 mb-4">semana de referência · todos os alunos</p>
            <div className="h-56">
              <Bar
                data={{
                  labels: distribuicao.map(d => d.faixa),
                  datasets: [{
                    data: distribuicao.map(d => d.count),
                    backgroundColor: distribuicao.map((_, i) => FAIXAS_HORAS[i]?.color || '#94a3b8'),
                    borderRadius: 4,
                  }],
                }}
                options={{ ...chartOptions, indexAxis: 'y', plugins: { legend: { display: false } } }}
              />
            </div>
          </div>

          {/* Domínio por matéria */}
          <div className={cardClass}>
            <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Domínio médio por matéria</h3>
            <p className="text-[10px] font-medium text-slate-400 mb-4">média da base · últimas 4 semanas</p>
            <div className="h-56">
              <Bar
                data={{
                  labels: ['Biologia', 'Química', 'Física', 'Matemática'],
                  datasets: [{
                    data: [dominio.bio || 0, dominio.qui || 0, dominio.fis || 0, dominio.mat || 0],
                    backgroundColor: ['#10b981', '#3b82f6', '#f97316', '#ef4444'],
                    borderRadius: 4,
                  }],
                }}
                options={{ ...chartOptions, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100, grid: { color: 'rgba(150,150,150,0.1)' } } } }}
              />
            </div>
          </div>

          {/* Progresso por matéria */}
          <div className={cardClass}>
            <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Progresso médio por matéria</h3>
            <p className="text-[10px] font-medium text-slate-400 mb-4">média da base · últimas 4 semanas</p>
            <div className="h-56">
              <Bar
                data={{
                  labels: ['Biologia', 'Química', 'Física', 'Matemática'],
                  datasets: [{
                    data: [progresso.bio || 0, progresso.qui || 0, progresso.fis || 0, progresso.mat || 0],
                    backgroundColor: ['#10b981', '#3b82f6', '#f97316', '#ef4444'],
                    borderRadius: 4,
                  }],
                }}
                options={{ ...chartOptions, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100, grid: { color: 'rgba(150,150,150,0.1)' } } } }}
              />
            </div>
          </div>

          {/* Bem-estar */}
          <div className={cardClass}>
            <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Bem-estar — média da base</h3>
            <p className="text-[10px] font-medium text-slate-400 mb-4">semana de referência · escala 0–5</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Sono',      valor: bemEstar.sono,      cor: '#a855f7' },
                { label: 'Motivação', valor: bemEstar.motivacao, cor: '#10b981' },
                { label: 'Ansiedade', valor: bemEstar.ansiedade, cor: '#f97316', invertido: true },
                { label: 'Estresse',  valor: bemEstar.estresse,  cor: '#ef4444', invertido: true },
              ].map(b => (
                <div key={b.label} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1">{b.label}</p>
                  <p className="text-2xl font-bold" style={{ color: b.cor }}>{b.valor || 0}<span className="text-xs text-slate-400 font-medium">/6</span></p>
                  <p className="text-[10px] text-slate-400 font-medium mt-1">{b.invertido ? 'menor é melhor' : 'maior é melhor'}</p>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Histórico horas vs meta */}
        <div className={cardClass}>
          <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Horas estudadas vs Meta — média da base</h3>
          <p className="text-[10px] font-medium text-slate-400 mb-4">últimas 8 semanas</p>
          <div className="h-64">
            <Line
              data={{
                labels: historico.map(h => String(h.semana || '').split(' a ')[0] || ''),
                datasets: [
                  { label: 'Horas (média da base)', data: historico.map(h => h.mediaHoras), borderColor: '#3b82f6', backgroundColor: '#3b82f6', tension: 0.3 },
                  { label: 'Meta (média da base)',  data: historico.map(h => h.mediaMeta),  borderColor: '#94a3b8', backgroundColor: 'transparent', borderDash: [6,4], tension: 0.3 },
                ],
              }}
              options={chartOptions}
            />
          </div>
        </div>
        </SeccaoColapsavel>

        {/* Lista hierárquica — respeita filtros */}
        <SeccaoColapsavel
          titulo="Mentores e mentorados"
          subtitulo="respeita os filtros acima"
          aberto={seccoesAbertas.mentores}
          onToggle={() => toggleSeccao('mentores')}
          resumo={
            <>
              <span><b className="text-intento-blue">{alunosAgrupados.length}</b> mentor{alunosAgrupados.length !== 1 ? 'es' : ''}</span>
              <span><b className="text-intento-blue">{alunosFiltrados.length}</b> aluno{alunosFiltrados.length !== 1 ? 's' : ''}</span>
              <span><b className={taxaRegistro >= 80 ? 'text-emerald-600' : taxaRegistro >= 50 ? 'text-amber-600' : 'text-red-500'}>{registrados}</b> registrado{registrados !== 1 ? 's' : ''} na semana</span>
            </>
          }
        >
          {alunosAgrupados.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm text-slate-400 font-medium">Nenhum aluno encontrado com os filtros atuais.</p>
            </div>
          ) : alunosAgrupados.map(grupo => {
            const expandido = mentoresExpandidos[grupo.mentor] !== false; // default expandido
            const registradosGrupo = grupo.alunos.filter(a => a.registrouSemanaAtual).length;
            return (
              <div key={grupo.mentor} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <button
                  onClick={() => setMentoresExpandidos(prev => ({ ...prev, [grupo.mentor]: !expandido }))}
                  className="w-full px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-intento-blue/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-intento-blue">{(grupo.mentorNome || '?').charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="text-left min-w-0">
                      <p className="text-sm font-semibold text-intento-blue truncate">
                        {grupo.mentorNome}
                        {!grupo.mentorAtivo && <span className="ml-2 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded uppercase">não cadastrado</span>}
                      </p>
                      <p className="text-[11px] text-slate-400 font-medium">{grupo.alunos.length} mentorado{grupo.alunos.length !== 1 ? 's' : ''} · {registradosGrupo} registrado{registradosGrupo !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <svg className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${expandido ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
                </button>
                {expandido && (
                  <div className="border-t border-slate-100 divide-y divide-slate-100">
                    {grupo.alunos.map(a => (
                      <div key={a.idAluno} className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-slate-50 transition">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${a.registrouSemanaAtual ? 'bg-emerald-500' : 'bg-red-400'}`} title={a.registrouSemanaAtual ? 'Registrado' : 'Pendente'}/>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-xs font-semibold text-slate-700 truncate">{a.nome}</p>
                              {a.tipoAluno === 'EM' && (
                                <span className="text-[9px] font-bold bg-intento-yellow/15 text-intento-yellow border border-intento-yellow/30 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">EM</span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 font-medium truncate">
                              {a.ultimoEncontro ? `Último encontro: ${a.ultimoEncontro}` : 'Sem encontros registrados'}
                              {a.escola && <span className="ml-2">· {a.escola}</span>}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <button
                            onClick={() => abrirEdicao(a)}
                            className="text-[11px] font-semibold text-slate-400 hover:text-intento-blue transition"
                            title="Editar tipo, fase, escola, turma"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => inativarAluno(a)}
                            disabled={inativando === a.idAluno}
                            className="text-[11px] font-semibold text-red-500 hover:text-red-700 transition disabled:opacity-50"
                            title="Marcar como inativo (saiu da mentoria)"
                          >
                            {inativando === a.idAluno ? '...' : 'Inativar'}
                          </button>
                          <button
                            onClick={() => window.open(`/mentor/${a.idAluno}?nome=${encodeURIComponent(a.nome)}`, '_blank')}
                            className="text-[11px] font-semibold text-intento-blue hover:underline"
                          >
                            Ver detalhes ↗
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </SeccaoColapsavel>

        </>)}

      </div>
    </div>
  );
}
