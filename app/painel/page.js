'use client';

import { apiFetch } from '@/lib/api';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// 1. IMPORTAÇÕES DO FIREBASE E GRÁFICOS
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

import { Bar, Line } from '@/components/Charts';
import { getCache, setCache } from '@/lib/cacheClient';
import PushToggle from '@/components/PushToggle';
import ProvasAluno from '@/components/ProvasAluno';
import BoletimAluno from '@/components/BoletimAluno';

const cardClass = "bg-white rounded-xl border border-slate-200 p-6 shadow-sm transition-colors";
const inputClass = "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-intento-blue transition-all font-medium text-intento-blue";
const labelClass = "block text-xs font-medium text-slate-400 uppercase mb-2 tracking-wider";

// Hierarquia de botões
const btnPrimary = "bg-intento-blue hover:bg-blue-900 text-white font-semibold px-6 py-3 rounded-lg transition-all text-sm";
const btnCTA     = "bg-intento-yellow hover:bg-yellow-500 text-white font-semibold px-6 py-3 rounded-lg transition-all text-sm";
const btnGhost   = "bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-medium px-6 py-3 rounded-lg transition-all text-sm";

// =========================================================================
// LISTA FIXA: DISCIPLINAS DO ENEM 
// =========================================================================
const DISCIPLINAS_ENEM = {
  'Linguagens': ['Literatura', 'Língua Portuguesa', 'Língua Estrangeira'],
  'Humanas': ['História', 'Geografia', 'Filosofia', 'Sociologia'],
  'Natureza': ['Biologia', 'Física', 'Química'],
  'Matemática': ['Matemática']
};

// =========================================================================
// COMPONENTE: CARDS DE DESEMPENHO (Anterior -> Atual)
// =========================================================================
const RenderMiniCards = ({ dataArray, isFirstWeek, fullBorder }) => {
  if (!dataArray || !Array.isArray(dataArray)) return null;
  const bColFull = { 'emerald': 'border-[#10b981]', 'purple': 'border-[#a855f7]', 'blue': 'border-[#3b82f6]', 'red': 'border-[#ef4444]', 'slate': 'border-slate-300' };
  const textColFull = { 'emerald': 'text-[#065f46]', 'purple': 'text-[#581c87]', 'blue': 'text-[#1e3a8a]', 'red': 'text-[#7f1d1d]', 'slate': 'text-slate-600' };

  return dataArray.map((item, idx) => {
    const prevStr = (item.prev || '0').toString().replace('%', '').replace(',', '.');
    const currStr = (item.curr || '0').toString().replace('%', '').replace(',', '.');
    const diff = parseFloat(currStr) - parseFloat(prevStr);
    
    const invertido = (item.name || '').toLowerCase().includes('atrasad');
    let valCol = "text-intento-blue"; let arrow = ""; let positivo = null;
    if (!isFirstWeek && diff !== 0) {
      const subiu = diff > 0;
      positivo = invertido ? !subiu : subiu;
      valCol = positivo ? "text-emerald-700" : "text-red-700";
      arrow = subiu ? "▲" : "▼";
    }

    const bgTint = (!fullBorder && !isFirstWeek && diff !== 0) ? (positivo ? 'bg-emerald-50' : 'bg-red-50') : 'bg-white';
    let cardClasses = fullBorder ? `${bgTint} rounded-xl border border-l-4 ${bColFull[item.theme || 'slate']} p-5 shadow-sm flex flex-col justify-center` : `${bgTint} rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-center`;
    let titleColor = fullBorder ? textColFull[item.theme || 'slate'] : "text-slate-500";

    return (
      <div key={idx} className={cardClasses}>
        <span className={`text-xs font-medium uppercase mb-3 tracking-wide ${titleColor}`}>{item.name || ''}</span>
        {isFirstWeek ? (
          <span className={`text-3xl font-bold ${valCol}`}>{item.curr || '0'}</span>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-xl font-light text-slate-300">{item.prev || '0'}</span>
            <span className="text-slate-200 font-normal">→</span>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-bold ${valCol}`}>{item.curr || '0'}</span>
              {diff !== 0 && (
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full leading-none ${positivo ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {diff > 0 ? '+' : ''}{diff % 1 === 0 ? diff.toFixed(0) : diff.toFixed(1)}{arrow}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  });
};

export default function PainelDoAluno() {
  const router = useRouter();
  const [sessao, setSessao] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [fotoUsuario, setFotoUsuario] = useState(null);
  
  // Estados de Interface e Layout
  const [abaAtiva, setAbaAtiva] = useState(() => {
    if (typeof window === 'undefined') return 1;
    const salva = sessionStorage.getItem('_painelAba');
    if (salva) { sessionStorage.removeItem('_painelAba'); return parseInt(salva); }
    return 1;
  });
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
  const [sidebarColapsada, setSidebarColapsada] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', tipo: 'success' });
  const [showCharts, setShowCharts] = useState(false);
  const [diasEnem, setDiasEnem] = useState('--');

  const [checkboxes, setCheckboxes] = useState({});
  const [tarefas, setTarefas] = useState([]);
  const [novaTarefa, setNovaTarefa] = useState('');
  const [planoChecks, setPlanoChecks] = useState({});

  // CADERNO DE ERROS
  const [caderno, setCaderno] = useState([]);
  const [cadernoCarregando, setCadernoCarregando] = useState(false);
  const [modalCadernoAberto, setModalCadernoAberto] = useState(false);
  const [cardVirado, setCardVirado] = useState({});
  const [filtroCaderno, setFiltroCaderno] = useState('Todas');
  const [filtroStatusCaderno, setFiltroStatusCaderno] = useState('todos');
  const [formCaderno, setFormCaderno] = useState({ disciplina: '', topico: '', data: new Date().toISOString().split('T')[0], fonte: '', classificacao: '', pergunta: '', resposta: '' });

  // ESTADOS DO SIMULADO 
  const [modalRegistroAberto, setModalRegistroAberto] = useState(false);
  const [tipoModelo, setTipoModelo] = useState("ENEM"); 
  const [formRegistro, setFormRegistro] = useState({ data: '', especificacao: '', lg: '', ch: '', cn: '', mat: '', redacao: '' });
  const [topicosDicionario, setTopicosDicionario] = useState({});
  
  // A Visualização da Análise
  const [simuladoAnalise, setSimuladoAnalise] = useState(null);
  const [abaAnalise, setAbaAnalise] = useState('Objetiva'); 
  const [areaExpandida, setAreaExpandida] = useState(null); // O NOVO CONTROLE DA SANFONA
  const [formAutopsia, setFormAutopsia] = useState({ erros: [], kolb: { exp: '', ref: '', con: '', acao: '', redacao: '' } });
  const [salvandoAutopsia, setSalvandoAutopsia] = useState(false);
  const [salvandoSimulado, setSalvandoSimulado] = useState(false);
  const [salvandoCaderno, setSalvandoCaderno] = useState(false);

  const [simuladosLista, setSimuladosLista] = useState([]);

  const mostrarToast = (message, tipo = 'success') => {
    setToast({ show: true, message, tipo });
    setTimeout(() => setToast({ show: false, message: '', tipo: 'success' }), 3500);
  };

  useEffect(() => {
    document.documentElement.classList.remove('dark');
    
    const buscarTopicos = async () => {
      try {
        const res = await apiFetch('/api/mentor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'buscarTopicosGlobais' }) });
        const data = await res.json();
        if (data.status === 'sucesso') setTopicosDicionario(data.topicos || {});
      } catch (e) { console.error("Erro ao buscar tópicos"); }
    };
    buscarTopicos();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user?.photoURL) setFotoUsuario(user.photoURL);
      const emailDefinitivo = (user && user.email) ? user.email : sessionStorage.getItem('emailLogado');
      if (!emailDefinitivo) { router.push('/'); return; }

      const cacheKey = 'login_' + emailDefinitivo;

      // Aplica resposta na UI (server ou cache)
      const aplicar = (resposta) => {
        setSessao(resposta);
        const d = new Date('2026-11-01T00:00:00');
        const diff = Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24));
        setDiasEnem(diff > 0 ? diff : 0);
        if (resposta.dadosPainel?.sim?.lista) setSimuladosLista(resposta.dadosPainel.sim.lista);
        else setSimuladosLista([]);
        const savedChecks = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('Intento_')) savedChecks[key] = localStorage.getItem(key) === 'true';
        }
        setCheckboxes(savedChecks);
      };

      // 1) Cache imediato se válido (aluno completo)
      const cached = getCache(cacheKey);
      if (cached && cached.data && cached.data.status === 200 && cached.data.perfil !== 'PENDENTE') {
        aplicar(cached.data);
        setCarregando(false);
      }

      // 2) Fetch real em paralelo
      try {
        const res = await apiFetch('/api/mentor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'login', email: emailDefinitivo }) });
        const resposta = await res.json();

        if (resposta.status === 200) {
          if (resposta.perfil === 'PENDENTE') { router.push('/hub'); }
          else {
            aplicar(resposta);
            setCache(cacheKey, resposta);
          }
        } else if (!cached) { router.push('/'); }
      } catch (e) { if (!cached) router.push('/'); }
      finally { setCarregando(false); }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!sessao) return;
    const d = sessao.dadosPainel || {};
    const nome = String(d.aluno?.nome || sessao.email || "Aluno Intento");
    const base = "Intento_" + nome.replace(/\s+/g, '_') + "_";
    const savedTarefas = localStorage.getItem(base + 'tarefas');
    if (savedTarefas) setTarefas(JSON.parse(savedTarefas));
    const savedChecks = localStorage.getItem(base + 'planoChecks');
    if (savedChecks) setPlanoChecks(JSON.parse(savedChecks));

    const idPlanilha = sessao?.idPlanilha || sessao?.idPlanilhaAluno || sessao?.dadosPainel?.idPlanilha;
    if (!idPlanilha) return;
    setCadernoCarregando(true);
    apiFetch('/api/mentor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'listarCaderno', idPlanilha }),
    }).then(r => r.json()).then(data => {
      if (data.status === 'sucesso') setCaderno(data.cards || []);
    }).finally(() => setCadernoCarregando(false));
  }, [sessao]);

  // =========================================================================
  // FUNÇÕES DO SIMULADO (A ANÁLISE)
  // =========================================================================
  const iniciarAutopsia = (sim) => {
    // SE O SIMULADO JÁ TEM DADOS SALVOS, NÓS CARREGAMOS A MEMÓRIA!
    if (sim.erros && sim.erros.length > 0) {
      setFormAutopsia({ erros: sim.erros, kolb: sim.kolb });
      setSimuladoAnalise(sim);
      setAbaAnalise('Objetiva');
      setAreaExpandida(null);
      window.scrollTo(0, 0); 
      return; // Para a função aqui, não gera linhas novas.
    }

    // SE É A PRIMEIRA VEZ, GERA AS CAIXAS VAZIAS (Como já funcionava)
    let errosGerados = [];
    let idCounter = 0;
    let primeiraAreaComErro = null;

    if (sim.modelo === 'ENEM') {
      const areas = [
        { nome: 'Linguagens', acertos: parseInt(sim.lg || 0), total: 45 },
        { nome: 'Humanas', acertos: parseInt(sim.ch || 0), total: 45 },
        { nome: 'Natureza', acertos: parseInt(sim.cn || 0), total: 45 },
        { nome: 'Matemática', acertos: parseInt(sim.mat || 0), total: 45 }
      ];

      areas.forEach(a => {
        const qtdErros = a.total - a.acertos;
        if (qtdErros > 0 && !primeiraAreaComErro) primeiraAreaComErro = a.nome;
        
        for(let i = 0; i < qtdErros; i++) {
          const disciplinaPadrao = a.nome === 'Matemática' ? 'Matemática' : '';
          errosGerados.push({ id: idCounter++, area: a.nome, questao: '', disciplina: disciplinaPadrao, topico: '', tipo: '' });
        }
      });
    }

    setFormAutopsia({ erros: errosGerados, kolb: { exp: '', ref: '', con: '', acao: '', redacao: '' } });
    setSimuladoAnalise(sim);
    setAbaAnalise('Objetiva');
    setAreaExpandida(primeiraAreaComErro);
    window.scrollTo(0, 0); 
  };

  
  // A FUNÇÃO DE ESTADO CORRIGIDA (Atualização em Lote)
  const atualizarErro = (id, atualizacoes) => {
    if (atualizacoes.questao !== undefined) {
      const numQ = parseInt(atualizacoes.questao);
      if (numQ < 1) atualizacoes.questao = '1';
      const duplicado = formAutopsia.erros.some(e => e.id !== id && parseInt(e.questao) === numQ);
      if (duplicado) { mostrarToast('Este número de questão já foi usado.', 'error'); return; }
    }
    const novosErros = formAutopsia.erros.map(e => e.id === id ? { ...e, ...atualizacoes } : e);
    setFormAutopsia({ ...formAutopsia, erros: novosErros });
  };

  // Função auxiliar para capturar o ID da planilha de forma segura
  const getSpreadsheetId = () => {
    return sessao?.idPlanilha || sessao?.idPlanilhaAluno || sessao?.dadosPainel?.idPlanilha;
  };

  const salvarSimulado = async () => {
    if (salvandoSimulado) return;
    const idPlanilha = getSpreadsheetId();

    if (!idPlanilha) {
      mostrarToast("Erro: ID da planilha não encontrado na sessão.", "error");
      return;
    }
    setSalvandoSimulado(true);

    if(!formRegistro.data || !formRegistro.especificacao) {
      mostrarToast("Preencha a data e a especificação.", "error");
      return;
    }

    // TODO: validation also in backend
    if (tipoModelo === 'ENEM') {
      const invalido = ['lg', 'ch', 'cn', 'mat'].some(k => {
        const v = parseInt(formRegistro[k]);
        return isNaN(v) || v < 0 || v > 45;
      });
      if (invalido) {
        mostrarToast("Acertos por área devem estar entre 0 e 45.", "error");
        return;
      }
    }

    mostrarToast("Registrando Simulado...", "success");
    try {
      const res = await apiFetch('/api/mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          acao: 'salvarSimulado', 
          idPlanilha: idPlanilha, // Agora garantido!
          ...formRegistro 
        })
      });
      const data = await res.json();
      
      if (data.status === 'sucesso') {
        mostrarToast("Registro Salvo! A página será atualizada.", "success");
        setModalRegistroAberto(false);
        sessionStorage.setItem('_painelAba', String(abaAtiva));
        setTimeout(() => window.location.reload(), 1500);
      } else {
        mostrarToast("Erro no servidor: " + data.mensagem, "error");
      }
    } catch (e) {
      mostrarToast("Erro de conexão ao salvar.", "error");
    } finally {
      setSalvandoSimulado(false);
    }
  };

  const salvarAutopsia = async () => {
    const idPlanilha = getSpreadsheetId();

    // Verifica se o aluno tocou na análise objetiva nesta sessão
    const objetivaModificada = formAutopsia.erros.some(e => e.questao || e.disciplina || e.topico || e.tipo);

    if (objetivaModificada) {
      const faltam = formAutopsia.erros.some(e => !e.questao || !e.disciplina || !e.topico || !e.tipo);
      if (faltam) {
        mostrarToast("Existem erros não classificados na Análise Objetiva.", "error");
        setAbaAnalise('Objetiva'); return;
      }
    }

    if (!formAutopsia.kolb.exp || !formAutopsia.kolb.acao || !formAutopsia.kolb.redacao) {
      mostrarToast("Preencha os campos obrigatórios no Kolb e Redação.", "error");
      setAbaAnalise('Subjetiva'); return;
    }

    setSalvandoAutopsia(true);
    try {
      const payload = {
        acao: 'salvarAutopsia',
        idPlanilha: idPlanilha,
        idSimulado: simuladoAnalise.id,
        statusAnalise: 'Concluída',
        kolb: formAutopsia.kolb
      };
      // Só reenvia os erros se foram modificados nesta sessão, para não sobrescrever dados já salvos
      if (objetivaModificada) payload.erros = formAutopsia.erros;

      const res = await apiFetch('/api/mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.status === 'sucesso') {
        mostrarToast("Análise gravada com sucesso!", "success");
        setSimuladoAnalise(null);
        sessionStorage.setItem('_painelAba', String(abaAtiva));
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (e) {
      mostrarToast("Erro ao sincronizar análise.", "error");
    } finally {
      setSalvandoAutopsia(false);
    }
  };

  const salvarProgressoObjetiva = async () => {
    const idPlanilha = getSpreadsheetId();

    const faltam = formAutopsia.erros.some(e => !e.questao || !e.disciplina || !e.topico || !e.tipo);
    if (faltam) { 
      mostrarToast("Preencha todos os erros da parte Objetiva antes de pausar.", "error"); 
      return; 
    }
    
    mostrarToast("Salvando progresso...", "success");
    try {
      await apiFetch('/api/mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          acao: 'salvarAutopsia', 
          idPlanilha: idPlanilha,
          idSimulado: simuladoAnalise.id,
          statusAnalise: 'Pendente',
          erros: formAutopsia.erros,
          kolb: formAutopsia.kolb
        })
      });
      mostrarToast("Progresso salvo!", "success");
      setSimuladoAnalise(null);
      sessionStorage.setItem('_painelAba', String(abaAtiva));
      setTimeout(() => window.location.reload(), 1000);
    } catch (e) {
      mostrarToast("Erro ao salvar progresso.", "error");
    }
  };

  const toggleTask = (taskId) => {
    const key = alunoNameKey + taskId;
    const newVal = !checkboxes[key];
    setCheckboxes(prev => ({ ...prev, [key]: newVal }));
    if (newVal) localStorage.setItem(key, 'true'); else localStorage.removeItem(key);
  };

  const zerarRotina = () => {
    if (window.confirm("Zerar as atividades e iniciar uma nova semana?")) {
      Object.keys(checkboxes).forEach(key => localStorage.removeItem(key));
      setCheckboxes({});
    }
  };

  const getBadge = (val) => {
    if (val >= 90) return <span className="inline-flex items-center px-2.5 py-1 bg-intento-blue text-intento-yellow text-[10px] uppercase tracking-wide font-medium rounded-full mt-2">Elite</span>;
    if (val >= 80) return <span className="inline-flex items-center px-2.5 py-1 bg-blue-50 text-blue-600 text-[10px] uppercase tracking-wide font-medium rounded-full mt-2">Core</span>;
    if (val >= 70) return <span className="inline-flex items-center px-2.5 py-1 bg-emerald-50 text-emerald-600 text-[10px] uppercase tracking-wide font-medium rounded-full mt-2">Starter</span>;
    return null;
  };

  if (carregando || !sessao) {
    return (
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        <aside className="hidden md:flex flex-col w-72 bg-white border-r border-slate-200">
          <div className="p-6 border-b border-slate-100"><div className="h-8 w-40 bg-slate-200 rounded-lg animate-pulse" /></div>
          <div className="px-6 py-5 border-b border-slate-100"><div className="h-4 w-24 bg-slate-200 rounded animate-pulse mb-3" /><div className="h-10 w-full bg-slate-200 rounded-xl animate-pulse" /></div>
          <div className="px-4 py-4 space-y-2">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-11 w-full bg-slate-100 rounded-xl animate-pulse" />)}
          </div>
        </aside>
        <main className="flex-1 p-8 space-y-6">
          <div className="h-9 w-48 bg-slate-200 rounded-xl animate-pulse" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-32 bg-slate-200 rounded-xl animate-pulse" />)}
          </div>
          <div className="h-40 bg-slate-200 rounded-xl animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="h-64 bg-slate-200 rounded-xl animate-pulse" />)}
          </div>
        </main>
      </div>
    );
  }

  const dados = sessao.dadosPainel || {};
  const nomeAluno = String(dados.aluno?.nome || sessao.email || "Aluno Intento");
  const alunoNameKey = "Intento_" + nomeAluno.replace(/\s+/g, '_') + "_";
  const snapshot = dados.snapshot || { dom: [0, 0, 0, 0], prog: [0, 0, 0, 0] };
  const progressoGeral = snapshot.prog?.length ? Math.round(snapshot.prog.reduce((a, b) => a + b, 0) / snapshot.prog.length) : 0;
  const mensal = dados.mensal || { labels: [], meta: [], horas: [], domTot: [], progTot: [], estresse: [], ansiedade: [], motivacao: [], sono: [] };
  const semanal = dados.semanal || { isFirstWeek: true, streak: [], geral: [], estilo: [], desempenho: [] };
  const plano = dados.plano || { data: '--', meta: 'Nenhuma meta', acao: [] };
  const ultimoEncontro = dados.ultimoEncontro || null;
  const rotina = dados.rotina || {};
  const rotinaDias = dados.rotinaDias || ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const simKpi = dados.sim?.kpi || { realizados: 0, medAcertos: 0, medRedacao: 0, medLG: 0, medCH: 0, medCN: 0, medMAT: 0, erros: { atencao: 0, inter: 0, rec: 0, lac: 0 } };
  const histSim = dados.sim?.hist || { labels: [], lg: [], ch: [], cn: [], mat: [] };

  const historicoConsistencia = (mensal.horas || []).map((h, i) => parseFloat(h) >= parseFloat(mensal.meta[i] || 0) && parseFloat(mensal.meta[i] || 0) > 0);
  
  const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { datalabels: { display: false } }, scales: { x: { grid: { color: 'rgba(150, 150, 150, 0.1)' } }, y: { grid: { color: 'rgba(150, 150, 150, 0.1)' } } } };

  // =========================================================================
  // MENU DE NAVEGAÇÃO LATERAL
  // =========================================================================
  const MENU_ITENS = [
    { id: 1, nome: 'Visão Geral', icone: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { id: 2, nome: 'Acompanhamento Semanal', icone: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { id: 3, nome: 'Mentoria', icone: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
    { id: 4, nome: 'Semana Padrão', icone: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { id: 5, nome: 'Simulados', icone: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 7, nome: 'Caderno de Erros', icone: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
    ...(sessao?.tipoAluno === 'EM' ? [{ id: 8, nome: 'Boletim', icone: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' }] : []),
    { id: 6, nome: 'Recursos', icone: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1' }
  ];

  // ── Caderno de Erros ─────────────────────────────────────────────────────────
  const disciplinasCaderno = ['Biologia', 'Química', 'Física', 'Matemática', 'Linguagens', 'Humanas', 'Redação'];

  // Classificação segue o método: erros de conteúdo (faltou estudo) vs erros
  // de prova (sabia mas errou na execução).
  const CLASSIFICACOES_CADERNO = {
    'Erros de conteúdo': ['Erro de recordação', 'Erro de lacuna'],
    'Erros de prova':    ['Erro de atenção',   'Erro de interpretação'],
  };
  const CLASSIFICACAO_ESTILO = {
    'Erro de recordação':   'bg-blue-50 text-blue-700 border-blue-200',
    'Erro de lacuna':       'bg-blue-50 text-blue-700 border-blue-200',
    'Erro de atenção':      'bg-amber-50 text-amber-700 border-amber-200',
    'Erro de interpretação':'bg-amber-50 text-amber-700 border-amber-200',
  };

  const statusCard = (card) => {
    const hoje = new Date().toISOString().split('T')[0];
    const proxima = card.proxima_revisao;
    if (!proxima) return { tipo: 'novo', label: 'A revisar' };
    if (proxima < hoje) {
      const dias = Math.floor((new Date(hoje + 'T00:00:00') - new Date(proxima + 'T00:00:00')) / 86400000);
      return { tipo: 'atrasado', dias, label: `Atrasado ${dias}d` };
    }
    if (proxima === hoje) return { tipo: 'hoje', label: 'A fazer hoje' };
    const dias = Math.floor((new Date(proxima + 'T00:00:00') - new Date(hoje + 'T00:00:00')) / 86400000);
    return { tipo: 'em-dia', dias, label: `Em ${dias}d` };
  };

  const STATUS_STYLES = {
    atrasado: { borda: 'border-l-4 border-l-red-500',     badge: 'bg-red-50 text-red-600 border-red-200',           icon: '⚠' },
    hoje:     { borda: 'border-l-4 border-l-amber-400',   badge: 'bg-amber-50 text-amber-700 border-amber-200',     icon: '●' },
    novo:     { borda: 'border-l-4 border-l-amber-400',   badge: 'bg-amber-50 text-amber-700 border-amber-200',     icon: '★' },
    'em-dia': { borda: 'border-l-4 border-l-emerald-300', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: '✓' },
  };

  const salvarCardCaderno = async () => {
    if (salvandoCaderno) return;
    const idPlanilha = getSpreadsheetId();
    if (!idPlanilha) return;
    if (!formCaderno.disciplina || !formCaderno.fonte || !formCaderno.classificacao || !formCaderno.pergunta || !formCaderno.resposta) {
      mostrarToast('Preencha disciplina, fonte, classificação, questão e resposta.', 'error');
      return;
    }
    setSalvandoCaderno(true);
    const novoCard = { ...formCaderno, id: 'card_' + Date.now(), estagio: 0 };
    try {
      await apiFetch('/api/mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'salvarCardCaderno', idPlanilha, ...novoCard }),
      });
      setCaderno(prev => [novoCard, ...prev]);
      setModalCadernoAberto(false);
      setFormCaderno({ disciplina: '', topico: '', data: new Date().toISOString().split('T')[0], fonte: '', classificacao: '', pergunta: '', resposta: '' });
      mostrarToast('Card adicionado!');
    } catch { mostrarToast('Erro ao salvar.', 'error'); }
    finally { setSalvandoCaderno(false); }
  };

  const INTERVALOS_REVISAO = [3, 7, 14, 30, 60, 90];

  const registrarRevisao = async (id, acertou) => {
    const idPlanilha = getSpreadsheetId();
    const hoje = new Date();
    // Atualização otimista local (fallback caso o backend falhe)
    setCaderno(prev => prev.map(c => {
      if (c.id !== id) return c;
      const estagioAtual = c.estagio ?? 0;
      const novoEstagio = acertou ? Math.min(estagioAtual + 1, INTERVALOS_REVISAO.length - 1) : 0;
      const diasAte = INTERVALOS_REVISAO[novoEstagio];
      const proxima = new Date(hoje);
      proxima.setDate(proxima.getDate() + diasAte);
      return { ...c, estagio: novoEstagio, proxima_revisao: proxima.toISOString().split('T')[0] };
    }));
    setCardVirado(v => ({ ...v, [id]: false }));
    if (idPlanilha) {
      try {
        const res = await apiFetch('/api/mentor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ acao: 'registrarRevisaoCaderno', idPlanilha, id, acertou }),
        });
        const data = await res.json();
        if (data.status === 'sucesso' && data.novoEstagio !== undefined) {
          setCaderno(prev => prev.map(c =>
            c.id !== id ? c : { ...c, estagio: data.novoEstagio, proxima_revisao: data.proximaRevisao }
          ));
        }
      } catch { /* mantém atualização otimista */ }
    }
  };

  const deletarCardCaderno = async (id) => {
    const idPlanilha = getSpreadsheetId();
    setCaderno(prev => prev.filter(c => c.id !== id));
    if (idPlanilha) apiFetch('/api/mentor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'deletarCardCaderno', idPlanilha, id }),
    });
  };

  const togglePlanoCheck = (i) => {
    const atualizados = { ...planoChecks, [i]: !planoChecks[i] };
    setPlanoChecks(atualizados);
    localStorage.setItem(alunoNameKey + 'planoChecks', JSON.stringify(atualizados));
  };

  const adicionarTarefa = () => {
    if (!novaTarefa.trim()) return;
    const nova = { id: Date.now(), texto: novaTarefa.trim(), concluida: false };
    const atualizadas = [...tarefas, nova];
    setTarefas(atualizadas);
    localStorage.setItem(alunoNameKey + 'tarefas', JSON.stringify(atualizadas));
    setNovaTarefa('');
  };
  const toggleTarefa = (id) => {
    const atualizadas = tarefas.map(t => t.id === id ? { ...t, concluida: !t.concluida } : t);
    setTarefas(atualizadas);
    localStorage.setItem(alunoNameKey + 'tarefas', JSON.stringify(atualizadas));
  };
  const removerTarefa = (id) => {
    const atualizadas = tarefas.filter(t => t.id !== id);
    setTarefas(atualizadas);
    localStorage.setItem(alunoNameKey + 'tarefas', JSON.stringify(atualizadas));
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden">
      
      {/* TOAST DE NOTIFICAÇÃO */}
      {toast.show && (
        <div className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-5 py-3 rounded-lg shadow-lg animate-in slide-in-from-right-8 fade-in ${toast.tipo === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
          <div className="font-medium text-sm">{toast.message}</div>
        </div>
      )}

      {/* SIDEBAR (MENU LATERAL) */}
      {menuMobileAberto && <div className="fixed inset-0 bg-intento-blue/40 z-30 md:hidden backdrop-blur-sm" onClick={() => setMenuMobileAberto(false)}></div>}

      <aside className={`fixed inset-y-0 left-0 z-40 bg-white border-r border-slate-200 transform transition-all duration-300 flex flex-col md:translate-x-0 ${menuMobileAberto ? 'translate-x-0' : '-translate-x-full'} md:static ${sidebarColapsada ? 'md:w-16' : 'md:w-72'} w-72`}>
        {/* Header */}
        <div className={`border-b border-slate-100 flex items-center ${sidebarColapsada ? 'justify-center p-3' : 'justify-between px-5 py-4'}`}>
          <div className="flex items-center gap-3 min-w-0">
            <img src="/simbolo-azul.png" alt="Símbolo Intento" className="w-9 h-9 object-contain shrink-0" />
            {!sidebarColapsada && (
              <div className="min-w-0">
                <p className="font-bold text-intento-blue text-sm leading-tight whitespace-nowrap">Mentoria Intento</p>
                <p className="text-[10px] text-slate-400 font-medium tracking-wide whitespace-nowrap">Plataforma do Aluno</p>
              </div>
            )}
          </div>
          <button className="md:hidden text-slate-400 hover:text-slate-600 transition-colors p-1" onClick={() => setMenuMobileAberto(false)} aria-label="Fechar menu">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Perfil */}
        {!sidebarColapsada && (
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50">
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-3">Mentorado(a)</p>
            <div className="flex items-center gap-3">
              {fotoUsuario ? (
                <img src={fotoUsuario} alt="Foto do aluno" className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-intento-blue flex items-center justify-center shrink-0 border border-slate-200">
                  <span className="text-white font-semibold text-sm">{nomeAluno.charAt(0).toUpperCase()}</span>
                </div>
              )}
              <p className="font-semibold text-slate-700 text-sm truncate" title={nomeAluno}>{nomeAluno}</p>
            </div>
          </div>
        )}
        {sidebarColapsada && (
          <div className="flex justify-center py-4 border-b border-slate-100 bg-slate-50">
            {fotoUsuario ? (
              <img src={fotoUsuario} alt="Foto do aluno" className="w-8 h-8 rounded-full object-cover border border-slate-200" referrerPolicy="no-referrer" title={nomeAluno} />
            ) : (
              <div className="w-8 h-8 rounded-full bg-intento-blue flex items-center justify-center border border-slate-200" title={nomeAluno}>
                <span className="text-white font-semibold text-xs">{nomeAluno.charAt(0).toUpperCase()}</span>
              </div>
            )}
          </div>
        )}

        {/* Nav */}
        <nav className={`flex-1 overflow-y-auto custom-scrollbar py-3 ${sidebarColapsada ? 'px-2 space-y-1' : 'px-4 space-y-1'}`}>
          {MENU_ITENS.map(item => (
            <button
              key={item.id}
              onClick={() => { setAbaAtiva(item.id); setSimuladoAnalise(null); setMenuMobileAberto(false); }}
              title={sidebarColapsada ? item.nome : undefined}
              className={`w-full flex items-center rounded-lg font-medium text-sm transition-all text-left leading-tight ${sidebarColapsada ? 'justify-center p-2.5' : 'gap-3 px-4 py-2.5'} ${abaAtiva === item.id && !simuladoAnalise ? 'bg-intento-blue text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
            >
              <svg className="w-4 h-4 shrink-0" style={{ opacity: abaAtiva === item.id && !simuladoAnalise ? 1 : 0.6 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icone}></path></svg>
              {!sidebarColapsada && <span className="flex-1">{item.nome}</span>}
              {item.id === 7 && (() => {
                const hoje = new Date().toISOString().split('T')[0];
                const due = caderno.filter(c => !c.proxima_revisao || c.proxima_revisao <= hoje).length;
                return due > 0 ? <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center ${abaAtiva === item.id && !simuladoAnalise ? 'bg-white text-intento-blue' : 'bg-red-500 text-white'}`}>{due}</span> : null;
              })()}
            </button>
          ))}
        </nav>

        {/* Logout + Toggle */}
        <div className={`border-t border-slate-100 ${sidebarColapsada ? 'p-2 flex flex-col items-center gap-2' : 'p-4 space-y-2'}`}>
          {!sidebarColapsada && sessao?.email && (
            <div className="px-1 pb-1"><PushToggle email={sessao.email} /></div>
          )}
          <button
            onClick={() => { sessionStorage.removeItem('emailLogado'); auth.signOut(); router.push('/'); }}
            title={sidebarColapsada ? 'Sair do Sistema' : undefined}
            className={`flex items-center justify-center rounded-lg font-medium text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors text-xs ${sidebarColapsada ? 'w-9 h-9 p-0' : 'w-full gap-2 px-4 py-2.5'}`}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            {!sidebarColapsada && <span>Sair do Sistema</span>}
          </button>
          <button
            onClick={() => setSidebarColapsada(v => !v)}
            className="hidden md:flex w-full items-center justify-center p-2 rounded-lg text-slate-300 hover:text-slate-500 hover:bg-slate-50 transition-colors"
            title={sidebarColapsada ? 'Expandir menu' : 'Minimizar menu'}
          >
            <svg className={`w-4 h-4 transition-transform duration-300 ${sidebarColapsada ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
          </button>
        </div>
      </aside>

      {/* ÁREA PRINCIPAL */}
      <main className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
        
        {/* Topbar Mobile */}
        <div className="md:hidden bg-white border-b border-slate-200 p-4 flex justify-between items-center sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setMenuMobileAberto(true)} aria-label="Abrir menu" className="p-2 text-intento-blue bg-slate-50 rounded-lg"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg></button>
            <div className="flex items-center gap-2.5">
              <img src="/simbolo-azul.png" alt="Intento" className="w-8 h-8 object-contain shrink-0" />
              <div>
                <p className="font-bold text-intento-blue text-sm leading-tight">Mentoria Intento</p>
                <p className="text-[10px] text-slate-400 font-medium tracking-wide">Plataforma do Aluno</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-8 max-w-6xl mx-auto w-full space-y-8 flex-1">
          
          {/* TÍTULO DA ABA ATIVA — oculto nas abas com header próprio */}
          {!simuladoAnalise && abaAtiva !== 5 && abaAtiva !== 7 && (
            <div className="mb-4 animate-in fade-in">
              <h1 className="text-2xl font-semibold text-intento-blue">{MENU_ITENS.find(m => m.id === abaAtiva)?.nome}</h1>
            </div>
          )}

          {/* ========================================================== */}
          {/* MODO ANÁLISE DE SIMULADO */}
          {/* ========================================================== */}
          {simuladoAnalise ? (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="flex flex-col md:flex-row justify-between md:items-end gap-6 border-b border-slate-200 pb-6">
                <div className="flex items-center gap-4">
                  <button onClick={() => setSimuladoAnalise(null)} className="p-2 bg-white border border-slate-200 rounded-full hover:bg-slate-100 transition-colors shadow-sm">
                    <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                  </button>
                  <div>
                    <h2 className="text-xl font-semibold text-intento-blue">Análise de Simulado</h2>
                    <p className="text-slate-400 text-sm mt-0.5">{simuladoAnalise.especificacao} · {simuladoAnalise.data}</p>
                  </div>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto">
                  <button onClick={() => setAbaAnalise('Objetiva')} className={`flex-1 md:flex-none px-5 py-2.5 rounded-lg font-medium text-sm transition-all ${abaAnalise === 'Objetiva' ? 'bg-intento-blue text-white' : 'text-slate-500 hover:text-slate-700'}`}>Objetiva</button>
                  <button onClick={() => setAbaAnalise('Subjetiva')} className={`flex-1 md:flex-none px-5 py-2.5 rounded-lg font-medium text-sm transition-all ${abaAnalise === 'Subjetiva' ? 'bg-intento-blue text-white' : 'text-slate-500 hover:text-slate-700'}`}>Subjetiva</button>
                </div>
              </div>

              {/* CARD DE APROVEITAMENTO */}
              {(() => {
                const acertosTotais = parseInt(simuladoAnalise.lg) + parseInt(simuladoAnalise.ch) + parseInt(simuladoAnalise.cn) + parseInt(simuladoAnalise.mat);
                const aproveitamento = Math.round((acertosTotais / 180) * 100);
                
                let corBg = "bg-red-50 border-red-200"; let corText = "text-red-700"; let corLabel = "text-red-600";
                if (aproveitamento >= 71 && aproveitamento <= 84) { corBg = "bg-yellow-50 border-yellow-200"; corText = "text-yellow-700"; corLabel = "text-yellow-600"; }
                if (aproveitamento >= 85) { corBg = "bg-emerald-50 border-emerald-200"; corText = "text-emerald-700"; corLabel = "text-emerald-600"; }

                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className={`${corBg} border rounded-xl text-center py-6 flex flex-col justify-center`}>
                      <p className={`text-[10px] ${corLabel} font-medium uppercase tracking-wide`}>Aproveitamento</p>
                      <p className={`text-4xl font-bold ${corText} mt-1`}>{aproveitamento}%</p>
                    </div>
                    <div className={`${cardClass} text-center py-6`}><p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Total</p><p className="text-4xl font-bold text-intento-blue mt-2">180</p></div>
                    <div className={`${cardClass} text-center py-6`}><p className="text-[10px] text-emerald-500 font-medium uppercase tracking-wide">Acertos</p><p className="text-4xl font-bold text-emerald-600 mt-2">{acertosTotais}</p></div>
                    <div className={`${cardClass} text-center py-6 bg-slate-50`}><p className="text-[10px] text-red-400 font-medium uppercase tracking-wide">Erros</p><p className="text-4xl font-bold text-red-500 mt-2">{formAutopsia.erros.length}</p></div>
                  </div>
                )
              })()}

              {/* TELA DE ANÁLISE OBJETIVA COM SANFONA */}
              {abaAnalise === 'Objetiva' && (
                <div className="space-y-6 animate-in slide-in-from-bottom-4 fade-in">
                  <div className="flex justify-between items-end mb-4">
                    <h3 className="text-lg font-semibold text-intento-blue">Classificação de Erros</h3>
                    <p className="text-sm font-medium text-slate-400 bg-white px-4 py-2 rounded-lg border border-slate-200">
                      <span className="text-intento-blue font-semibold">{formAutopsia.erros.filter(e => e.questao && e.disciplina && e.topico && e.tipo).length}</span> / {formAutopsia.erros.length} classificados
                    </p>
                  </div>
                  
                  {['Linguagens', 'Humanas', 'Natureza', 'Matemática'].map(area => {
                    const errosDaArea = formAutopsia.erros.filter(e => e.area === area);
                    if (errosDaArea.length === 0) return null;

                    const isExpanded = areaExpandida === area;
                    const errosClassificadosNaArea = errosDaArea.filter(e => e.questao && e.disciplina && e.topico && e.tipo).length;
                    const tudoClassificado = errosClassificadosNaArea === errosDaArea.length;

                    // Cores do Header da Sanfona
                    let headerColor = "text-slate-600 bg-slate-50 border-slate-200";
                    if (tudoClassificado) headerColor = "text-emerald-700 bg-emerald-50 border-emerald-200";
                    else if (isExpanded) headerColor = "text-blue-800 bg-blue-50 border-blue-200";

                    return (
                      <div key={area} className="bg-white rounded-xl border border-slate-200 overflow-hidden transition-all">
                        {/* CABEÇALHO DA SANFONA */}
                        <button
                          onClick={() => setAreaExpandida(isExpanded ? null : area)}
                          className={`w-full px-5 py-4 flex justify-between items-center transition-colors border-b ${headerColor}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-semibold uppercase tracking-wide text-sm">{area}</span>
                            <span className={`text-[10px] font-medium px-2 py-1 rounded uppercase tracking-wide ${tudoClassificado ? 'bg-emerald-100 text-emerald-700' : 'bg-white border border-slate-200 text-slate-400'}`}>
                              {errosClassificadosNaArea}/{errosDaArea.length}
                            </span>
                          </div>
                          <span className="text-xl font-light text-slate-300">{isExpanded ? '−' : '+'}</span>
                        </button>

                        {/* CONTEÚDO DA SANFONA */}
                        {isExpanded && (
                          <div className="p-6 space-y-4 animate-in fade-in">
                            {errosDaArea.map((erro) => (
                              <div key={erro.id} className="flex flex-col md:flex-row gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm relative group hover:border-intento-yellow transition-colors">
                                
                                <div className="w-full md:w-20 shrink-0">
                                  <label className={labelClass} title="Número da questão na prova">Nº Quest.</label>
                                  <input type="number" placeholder="Ex: 12" min="1" className="w-full p-3 border border-slate-200 rounded-lg font-black text-slate-700 outline-none focus:border-intento-yellow text-center bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={erro.questao} onChange={e => atualizarErro(erro.id, { questao: e.target.value })} />
                                </div>

                                <div className="w-full md:w-48 shrink-0">
                                  <label className={labelClass}>Disciplina</label>
                                  <select className="w-full p-3 border border-slate-200 rounded-lg font-bold text-slate-700 outline-none focus:border-intento-yellow bg-white appearance-none" value={erro.disciplina} onChange={e => atualizarErro(erro.id, { disciplina: e.target.value, topico: '' })}>
                                    <option value="">Selecione...</option>
                                    {DISCIPLINAS_ENEM[area].map(d => <option key={d} value={d}>{d}</option>)}
                                  </select>
                                </div>

                                <div className="flex-1">
                                  <label className={labelClass}>Tópico do Currículo</label>
                                  <select className="w-full p-3 border border-slate-200 rounded-lg font-bold text-slate-700 outline-none focus:border-intento-yellow bg-white appearance-none" value={erro.topico} onChange={e => atualizarErro(erro.id, { topico: e.target.value })} disabled={!erro.disciplina}>
                                    <option value="">{erro.disciplina ? "Selecione o Tópico..." : "Escolha a disciplina primeiro"}</option>
                                    {(topicosDicionario[erro.disciplina] || []).map(t => <option key={t} value={t}>{t}</option>)}
                                  </select>
                                </div>

                                <div className="w-full md:w-48 shrink-0">
                                  <label className={labelClass}>Motivo (Causa Raiz)</label>
                                  <select className="w-full p-3 border border-slate-200 rounded-lg font-bold text-slate-700 outline-none focus:border-intento-yellow bg-white appearance-none" value={erro.tipo} onChange={e => atualizarErro(erro.id, { tipo: e.target.value })}>
                                    <option value="">Classificar Erro...</option>
                                    <option value="Lacuna">Lacuna</option>
                                    <option value="Recordação">Recordação</option>
                                    <option value="Interpretação">Interpretação</option>
                                    <option value="Atenção">Atenção</option>
                                  </select>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  <div className="flex justify-between items-center pt-6 border-t border-slate-200 mt-6">
                    <button onClick={salvarProgressoObjetiva} className={btnGhost}>
                      Gravar Análise Objetiva
                    </button>
                    <button onClick={() => setAbaAnalise('Subjetiva')} className={`${btnPrimary} flex items-center gap-2 px-8 py-4`}>
                      Análise Subjetiva <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                    </button>
                  </div>
                </div>
              )}

              {/* TELA DE ANÁLISE SUBJETIVA */}
              {abaAnalise === 'Subjetiva' && (
                <div className="space-y-8 animate-in slide-in-from-bottom-4 fade-in pb-10">
                  <div className="bg-intento-blue p-6 md:p-8 rounded-xl border border-blue-900/30 relative overflow-hidden">
                    <h3 className="text-lg font-semibold text-white mb-1">Ciclo de Kolb</h3>
                    <p className="text-blue-300/70 text-sm mb-8 max-w-2xl">Documente suas percepções emocionais e estratégicas para traçar uma rota de correção para a próxima semana.</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 relative z-10">
                      <div className="bg-white/5 p-5 rounded-xl border border-white/10">
                        <label className="block text-[10px] font-medium text-intento-yellow/80 uppercase mb-3 tracking-wider flex items-center gap-1.5">1. Experiência <span className="text-blue-300/50 normal-case font-normal">— clique para escrever</span></label>
                        <textarea className="w-full bg-transparent text-white placeholder-blue-300/40 outline-none resize-none font-normal text-sm leading-relaxed custom-scrollbar focus:placeholder-blue-300/20 transition-all" rows="4" placeholder="Como você se sentiu durante a prova? Houve cansaço, nervosismo, ansiedade ou falta de tempo?" value={formAutopsia.kolb.exp} onChange={e => setFormAutopsia({...formAutopsia, kolb: {...formAutopsia.kolb, exp: e.target.value}})}></textarea>
                      </div>
                      <div className="bg-white/5 p-5 rounded-xl border border-white/10">
                        <label className="block text-[10px] font-medium text-intento-yellow/80 uppercase mb-3 tracking-wider flex items-center gap-1.5">2. Reflexão <span className="text-blue-300/50 normal-case font-normal">— clique para escrever</span></label>
                        <textarea className="w-full bg-transparent text-white placeholder-blue-300/40 outline-none resize-none font-normal text-sm leading-relaxed custom-scrollbar focus:placeholder-blue-300/20 transition-all" rows="4" placeholder="Olhando para os seus erros, qual foi o seu maior gargalo real?" value={formAutopsia.kolb.ref} onChange={e => setFormAutopsia({...formAutopsia, kolb: {...formAutopsia.kolb, ref: e.target.value}})}></textarea>
                      </div>
                      <div className="bg-white/5 p-5 rounded-xl border border-white/10">
                        <label className="block text-[10px] font-medium text-intento-yellow/80 uppercase mb-3 tracking-wider flex items-center gap-1.5">3. Conceituação <span className="text-blue-300/50 normal-case font-normal">— clique para escrever</span></label>
                        <textarea className="w-full bg-transparent text-white placeholder-blue-300/40 outline-none resize-none font-normal text-sm leading-relaxed custom-scrollbar focus:placeholder-blue-300/20 transition-all" rows="4" placeholder="O que você aprendeu com a correção destas questões?" value={formAutopsia.kolb.con} onChange={e => setFormAutopsia({...formAutopsia, kolb: {...formAutopsia.kolb, con: e.target.value}})}></textarea>
                      </div>
                      <div className="bg-emerald-900/30 p-5 rounded-xl border border-emerald-500/30">
                        <label className="block text-[10px] font-medium text-emerald-400/80 uppercase mb-3 tracking-wider flex items-center gap-1.5">4. Ação <span className="text-emerald-300/40 normal-case font-normal">— clique para escrever</span></label>
                        <textarea className="w-full bg-transparent text-white placeholder-emerald-300/40 outline-none resize-none font-normal text-sm leading-relaxed custom-scrollbar focus:placeholder-emerald-300/20 transition-all" rows="4" placeholder="O que você vai mudar na sua rotina de estudos imediatamente?" value={formAutopsia.kolb.acao} onChange={e => setFormAutopsia({...formAutopsia, kolb: {...formAutopsia.kolb, acao: e.target.value}})}></textarea>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-6 md:p-8 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-9 h-9 bg-purple-50 text-purple-500 rounded-lg flex items-center justify-center shrink-0"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg></div>
                      <div>
                        <h3 className="text-base font-semibold text-intento-blue">Kolb de Redação</h3>
                        <p className="text-slate-400 text-sm">Nota: <span className="text-purple-500 font-medium">{simuladoAnalise.redacao}</span></p>
                      </div>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-5">
                      <label className="block text-[10px] font-medium text-slate-400 uppercase mb-3 tracking-wider">Reflexão da Produção Textual</label>
                      <textarea className="w-full bg-transparent text-slate-700 placeholder-slate-300 outline-none resize-none font-normal text-sm leading-relaxed custom-scrollbar" rows="6" placeholder="Faça os 4 passos do Kolb aqui. Em qual competência você perdeu nota? Faltou repertório? Teve problema de coesão? Como vai corrigir na próxima redação?" value={formAutopsia.kolb.redacao} onChange={e => setFormAutopsia({...formAutopsia, kolb: {...formAutopsia.kolb, redacao: e.target.value}})}></textarea>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-6">
                    <button onClick={() => setAbaAnalise('Objetiva')} className={`${btnGhost} flex items-center gap-2`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg> Voltar
                    </button>
                    <button onClick={salvarAutopsia} disabled={salvandoAutopsia} className={`${btnCTA} px-12 py-4 flex items-center gap-2 disabled:opacity-70`}>
                      {salvandoAutopsia && <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>}
                      {salvandoAutopsia ? 'Gravando...' : 'Gravar Análise Completa'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // =========================================================================
            // VISÃO NORMAL (Quando não está na tela de análise)
            // =========================================================================
            <>
              {abaAtiva === 1 && (
                <div className="space-y-6 animate-in fade-in duration-500">

                  {/* Próximas provas (só pra alunos EM, só renderiza se houver) */}
                  {sessao?.tipoAluno === 'EM' && (sessao?.idPlanilha || sessao?.idPlanilhaAluno) && (
                    <ProvasAluno idAluno={sessao.idPlanilha || sessao.idPlanilhaAluno} />
                  )}

                  {/* HERO — Lista de Tarefas + Stats */}
                  {(() => {
                    const dominioGeral = snapshot.dom?.length ? Math.round(snapshot.dom.reduce((a, b) => a + (parseFloat(b) || 0), 0) / snapshot.dom.length) : 0;
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-5">

                        {/* LISTA DE TAREFAS */}
                        <div className={`md:col-span-3 ${cardClass} flex flex-col`}>
                          <div className="flex items-center justify-between mb-4">
                            <h2 className="text-base font-semibold text-intento-blue">Minhas Tarefas</h2>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-slate-400 font-medium">{tarefas.filter(t => !t.concluida).length} pendentes</span>
                              {tarefas.length > 0 && (
                                <button
                                  onClick={() => { setTarefas([]); localStorage.removeItem(alunoNameKey + 'tarefas'); }}
                                  className="text-xs text-slate-300 hover:text-red-400 font-medium transition-colors"
                                >
                                  Zerar
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2 mb-4">
                            <input
                              type="text"
                              value={novaTarefa}
                              onChange={e => setNovaTarefa(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && adicionarTarefa()}
                              placeholder="Adicionar tarefa..."
                              className={inputClass + " text-sm py-2.5"}
                            />
                            <button onClick={adicionarTarefa} className={`${btnPrimary} px-4 py-2 shrink-0`}>+</button>
                          </div>
                          {tarefas.length === 0 ? (
                            <p className="text-sm text-slate-300 font-medium text-center py-6">Nenhuma tarefa ainda.</p>
                          ) : (
                            <ul className="space-y-2 flex-1 overflow-y-auto max-h-56">
                              {tarefas.map(t => (
                                <li key={t.id} className="flex items-center gap-3 group py-1">
                                  <input
                                    type="checkbox"
                                    checked={t.concluida}
                                    onChange={() => toggleTarefa(t.id)}
                                    className="w-4 h-4 rounded shrink-0 accent-intento-blue"
                                  />
                                  <span className={`flex-1 text-sm font-medium transition-colors ${t.concluida ? 'line-through text-slate-300' : 'text-slate-700'}`}>
                                    {t.texto}
                                  </span>
                                  <button onClick={() => removerTarefa(t.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all text-xs">✕</button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        {/* STATS + PLANO DE AÇÃO */}
                        <div className="md:col-span-2 flex flex-col gap-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-intento-yellow rounded-xl p-5 text-center shadow-sm flex flex-col items-center justify-center">
                              <p className="text-xs font-medium text-white/70 uppercase tracking-wider mb-1">Progresso Geral</p>
                              <p className="text-5xl font-bold text-white leading-none">{progressoGeral}<span className="text-2xl font-medium text-white/60">%</span></p>
                            </div>
                            <div className="bg-intento-blue rounded-xl p-5 text-center shadow-sm flex flex-col items-center justify-center">
                              <p className="text-xs font-medium text-white/50 uppercase tracking-wider mb-1">Domínio Geral</p>
                              <p className="text-5xl font-bold text-white leading-none">{dominioGeral}<span className="text-2xl font-medium text-white/40">%</span></p>
                            </div>
                          </div>
                          <div className="bg-white rounded-xl border border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm">
                            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Dias para o ENEM</p>
                            <p className="text-2xl font-bold text-slate-600">{diasEnem}</p>
                          </div>
                          <div className={`${cardClass} flex-1 overflow-y-auto max-h-64`}>
                            <p className="text-xs font-medium text-intento-yellow uppercase mb-3 tracking-wider">Plano de Ação</p>
                            {(plano.acao || []).length === 0 ? (
                              <p className="text-sm text-slate-400 font-medium">Nenhuma ação definida pelo mentor ainda.</p>
                            ) : (
                              <ol className="space-y-2.5">
                                {(plano.acao || []).map((item, i) => (
                                  <li key={i} className="flex items-start gap-2.5 cursor-pointer group" onClick={() => togglePlanoCheck(i)}>
                                    <span className={`shrink-0 w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center mt-0.5 transition-colors ${planoChecks[i] ? 'bg-emerald-500' : 'bg-intento-blue'}`}>
                                      {planoChecks[i] ? '✓' : i + 1}
                                    </span>
                                    <span className={`text-sm font-medium leading-relaxed transition-colors ${planoChecks[i] ? 'line-through text-slate-300' : 'text-slate-700'}`}>{item}</span>
                                  </li>
                                ))}
                              </ol>
                            )}
                          </div>
                        </div>

                      </div>
                    );
                  })()}

                  {/* PROGRESSIVE DISCLOSURE — Análise Completa */}
                  <div>
                    <button
                      onClick={() => setShowCharts(v => !v)}
                      className="w-full flex items-center justify-between px-5 py-3.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      <span className="font-medium text-slate-600 text-sm">Análise completa</span>
                      <span className="text-slate-300 font-light text-xl">{showCharts ? '−' : '+'}</span>
                    </button>

                    {showCharts && (
                      <div className="mt-4 space-y-6 animate-in fade-in">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {[
                            { label: 'Biologia',    color: '#10b981', dom: snapshot.dom?.[0] || 0, prog: snapshot.prog?.[0] || 0 },
                            { label: 'Química',     color: '#a855f7', dom: snapshot.dom?.[1] || 0, prog: snapshot.prog?.[1] || 0 },
                            { label: 'Física',      color: '#3b82f6', dom: snapshot.dom?.[2] || 0, prog: snapshot.prog?.[2] || 0 },
                            { label: 'Matemática',  color: '#ef4444', dom: snapshot.dom?.[3] || 0, prog: snapshot.prog?.[3] || 0 },
                          ].map(({ label, color, dom, prog }) => (
                            <div key={label} style={{ borderColor: color + '55', background: color + '0a' }} className="rounded-xl border p-5 flex flex-col gap-3 shadow-sm">
                              <div className="flex items-center justify-between">
                                <p style={{ color }} className="text-xs font-semibold uppercase tracking-wider">{label}</p>
                                {getBadge(dom)}
                              </div>
                              <div>
                                <p className="text-4xl font-bold text-intento-blue leading-none">{dom}<span className="text-lg font-medium text-slate-300 ml-0.5">%</span></p>
                                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium mt-1">Domínio</p>
                              </div>
                              <div>
                                <div className="flex justify-between items-center mb-1.5">
                                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Progresso</p>
                                  <p style={{ color }} className="text-xs font-bold">{prog}%</p>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-1.5">
                                  <div style={{ width: `${prog}%`, background: color }} className="h-1.5 rounded-full transition-all duration-700"></div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className={cardClass}>
                          <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-4">Progresso por Área</h3>
                          <div className="h-64"><Bar data={{ labels: ['Biologia', 'Química', 'Física', 'Matemática'], datasets: [{ label: 'Progresso (%)', data: snapshot.prog || [0,0,0,0], backgroundColor: ['#10b981', '#a855f7', '#3b82f6', '#ef4444'], borderRadius: 4 }] }} options={{ indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { max: 100, grid: { color: 'rgba(150, 150, 150, 0.1)' } }, y: { grid: { display: false } } } }} /></div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className={cardClass}><h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-4">Execução (Horas vs Meta)</h3><div className="h-64"><Bar data={{ labels: mensal.labels || [], datasets: [{ type: 'line', label: 'Meta', data: mensal.meta || [], borderColor: '#64748b', tension: 0.1 }, { type: 'bar', label: 'Horas', data: mensal.horas || [], backgroundColor: '#D4B726', borderRadius: 4 }] }} options={chartOptions} /></div></div>
                          <div className={cardClass}><h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-4">Domínio e Progresso</h3><div className="h-64"><Bar data={{ labels: mensal.labels || [], datasets: [{ type: 'line', label: 'Domínio', data: mensal.domTot || [], borderColor: '#3b82f6', tension: 0.3 }, { type: 'bar', label: 'Progresso', data: mensal.progTot || [], backgroundColor: 'rgba(100, 116, 139, 0.2)', borderRadius: 4 }] }} options={chartOptions} /></div></div>
                          <div className={cardClass}><h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-4">Estilo de Vida</h3><div className="h-64"><Line data={{ labels: mensal.labels || [], datasets: [{ label: 'Estresse', data: mensal.estresse || [], borderColor: '#ef4444' }, { label: 'Ansiedade', data: mensal.ansiedade || [], borderColor: '#f97316' }, { label: 'Sono', data: mensal.sono || [], borderColor: '#8b5cf6' }] }} options={{...chartOptions, scales: { y: { min: 0, max: 5 }}}} /></div></div>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              )}
              
              {abaAtiva === 2 && (
                <div className="space-y-10 animate-in fade-in duration-500">
                  {(() => {
                    const horasArr  = mensal.horas  || [];
                    const metasArr  = mensal.meta   || [];
                    const labelsArr = mensal.labels || [];
                    const semanas = labelsArr.map((label, i) => {
                      const h = parseFloat(horasArr[i]) || 0;
                      const m = parseFloat(metasArr[i]) || 0;
                      const pct = m > 0 ? Math.round((h / m) * 100) : 0;
                      return { label, horas: h, meta: m, pct };
                    });
                    const ultimas    = semanas.slice(-8);
                    const dentroMeta = semanas.filter(s => s.pct >= 100).length;
                    const atual      = semanas[semanas.length - 1];

                    const corBarra = (pct) => {
                      if (pct >= 120) return { bg: 'bg-sky-400',     border: 'bg-sky-500',     text: 'text-sky-700' };
                      if (pct >= 100) return { bg: 'bg-emerald-400', border: 'bg-emerald-500', text: 'text-emerald-700' };
                      if (pct >= 80)  return { bg: 'bg-amber-400',   border: 'bg-amber-500',   text: 'text-amber-700' };
                      return                 { bg: 'bg-red-400',     border: 'bg-red-500',     text: 'text-red-700' };
                    };
                    const MAX = 150; // teto visual

                    return (
                      <div className={cardClass}>
                        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 mb-1">
                          <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide">Consistência — Horas vs Meta</h3>
                          {semanas.length > 0 && (
                            <p className="text-[11px] font-medium text-slate-400">
                              <span className="text-slate-700 font-bold">{dentroMeta} de {semanas.length}</span> semana{semanas.length !== 1 ? 's' : ''} dentro da meta
                              {atual && (
                                <> <span className="text-slate-300 mx-1.5">·</span> Atual <span className={`font-bold ${corBarra(atual.pct).text}`}>{atual.pct}%</span></>
                              )}
                            </p>
                          )}
                        </div>

                        {semanas.length === 0 ? (
                          <p className="text-xs text-slate-400 font-medium py-10 text-center">Sem registros semanais ainda.</p>
                        ) : (
                          <>
                            <div className="mt-6 flex">
                              {/* Eixo Y */}
                              <div className="w-9 h-32 flex flex-col justify-between text-[9px] text-slate-300 font-medium text-right pr-2">
                                <span>{MAX}%</span>
                                <span className="text-slate-400 font-bold">100%</span>
                                <span>50%</span>
                                <span>0%</span>
                              </div>

                              {/* Área de plot */}
                              <div className="flex-1 relative h-32">
                                {/* Linhas de grade */}
                                <div className="absolute inset-0 pointer-events-none">
                                  <div className="absolute top-0 left-0 right-0 border-t border-slate-100" />
                                  <div className="absolute left-0 right-0 border-t-2 border-dashed border-slate-300" style={{ top: `${((MAX - 100) / MAX) * 100}%` }} />
                                  <div className="absolute left-0 right-0 border-t border-slate-100" style={{ top: `${((MAX - 50) / MAX) * 100}%` }} />
                                  <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200" />
                                </div>

                                {/* Barras */}
                                <div className="absolute inset-0 flex items-end gap-1.5 px-1">
                                  {ultimas.map((s, i) => {
                                    const display = Math.min(s.pct, MAX);
                                    const cor = corBarra(s.pct);
                                    return (
                                      <div key={i} className="flex-1 flex flex-col justify-end h-full group cursor-default" title={`${s.label} · ${s.horas}h de ${s.meta}h · ${s.pct}%`}>
                                        <div className={`w-full ${cor.bg} rounded-t-sm relative transition-all group-hover:brightness-110`} style={{ height: `${(display / MAX) * 100}%` }}>
                                          <span className={`absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-bold ${cor.text} whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity`}>
                                            {s.pct}%
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>

                            {/* Eixo X (datas) */}
                            <div className="flex pl-9 mt-2 gap-1.5 px-1">
                              {ultimas.map((s, i) => (
                                <div key={i} className="flex-1 text-center text-[9px] text-slate-400 font-medium truncate">
                                  {String(s.label).split(' a ')[0]}
                                </div>
                              ))}
                            </div>

                            {/* Legenda */}
                            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 mt-5 text-[10px] text-slate-500 font-medium">
                              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400"/>&lt;80%</div>
                              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400"/>80–99%</div>
                              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400"/>100–119%</div>
                              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-sky-400"/>120%+</div>
                              <div className="flex items-center gap-1.5"><span className="w-3 border-t-2 border-dashed border-slate-300"/>Meta</div>
                            </div>

                            {/* Mensagem factual condicional */}
                            {(() => {
                              const last3 = semanas.slice(-3);
                              if (last3.length < 3) return null;
                              if (last3.every(s => s.pct >= 100)) {
                                return <p className="mt-4 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-md">3 semanas seguidas dentro da meta.</p>;
                              }
                              if (last3.every(s => s.pct < 80)) {
                                return <p className="mt-4 text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-md">3 semanas seguidas abaixo de 80% da meta.</p>;
                              }
                              return null;
                            })()}
                          </>
                        )}
                      </div>
                    );
                  })()}
                  {(!semanal.geral || semanal.geral.length === 0) ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mb-5">
                        <svg className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                      </div>
                      <p className="text-base font-semibold text-slate-500 mb-1">Aguardando o primeiro encontro com seu mentor</p>
                      <p className="text-sm text-slate-400 max-w-xs">Os dados do seu acompanhamento semanal serão preenchidos após a sua primeira sessão.</p>
                    </div>
                  ) : (
                    <>
                      {semanal.isFirstWeek && <div className="bg-blue-50 text-blue-700 p-4 rounded-xl font-medium text-sm border border-blue-100">Esta é a sua primeira semana. Comparativos aparecerão na próxima!</div>}
                      <div><h2 className="text-base font-semibold text-slate-700 mb-5">Aspectos Gerais</h2><div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10"><RenderMiniCards dataArray={semanal.geral} isFirstWeek={semanal.isFirstWeek} fullBorder={false} /></div></div>
                      <div><h2 className="text-base font-semibold text-slate-700 mb-5">Estilo de Vida</h2><div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10"><RenderMiniCards dataArray={semanal.estilo} isFirstWeek={semanal.isFirstWeek} fullBorder={false} /></div></div>
                      <div><h2 className="text-base font-semibold text-slate-700 mb-5">Desempenho</h2><div className="grid grid-cols-1 md:grid-cols-4 gap-4"><div className="space-y-4"><RenderMiniCards dataArray={semanal.desempenho?.slice(0, 2)} isFirstWeek={semanal.isFirstWeek} fullBorder={true} /></div><div className="space-y-4"><RenderMiniCards dataArray={semanal.desempenho?.slice(2, 4)} isFirstWeek={semanal.isFirstWeek} fullBorder={true} /></div><div className="space-y-4"><RenderMiniCards dataArray={semanal.desempenho?.slice(4, 6)} isFirstWeek={semanal.isFirstWeek} fullBorder={true} /></div><div className="space-y-4"><RenderMiniCards dataArray={semanal.desempenho?.slice(6, 8)} isFirstWeek={semanal.isFirstWeek} fullBorder={true} /></div></div></div>
                    </>
                  )}
                </div>
              )}
              
              {abaAtiva === 3 && (
                <div className="space-y-6 animate-in fade-in duration-500">
                  <div className="bg-intento-yellow rounded-2xl shadow-md text-center py-14 px-6 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10 pointer-events-none">
                      <svg className="absolute top-4 right-4 w-24 h-24 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                    </div>
                    <div className="relative">
                      <div className="inline-flex items-center gap-2 mb-4">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        <p className="text-xs font-bold text-white/90 uppercase tracking-[0.2em]">Meta Principal</p>
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      </div>
                      <p className="text-3xl md:text-5xl font-bold text-white leading-tight max-w-3xl mx-auto">{plano.meta}</p>
                    </div>
                  </div>
                  {!ultimoEncontro ? (
                    <div className={cardClass + ' text-center py-16'}>
                      <p className="text-sm text-slate-400 font-medium">Nenhum encontro registrado pelo seu mentor ainda.</p>
                    </div>
                  ) : (() => {
                    const enc = ultimoEncontro;
                    const CAT = {
                      'Codificação': { bg: 'bg-blue-100',    fg: 'text-blue-800' },
                      'Revisão':     { bg: 'bg-emerald-100', fg: 'text-emerald-800' },
                      'Hábitos':     { bg: 'bg-yellow-100',  fg: 'text-yellow-800' },
                      'Simulados':   { bg: 'bg-red-100',     fg: 'text-red-800' },
                      'Prova':       { bg: 'bg-red-100',     fg: 'text-red-800' },
                    }[enc.categoria] || { bg: 'bg-slate-100', fg: 'text-slate-700' };
                    const RES = {
                      'Realizado':              'bg-emerald-100 text-emerald-800',
                      'Realizado Parcialmente': 'bg-yellow-100 text-yellow-800',
                      'Não realizado':          'bg-red-100 text-red-800',
                    };
                    const acoesValidas = (enc.acoes || []).map((a, i) => ({ acao: a, resultado: enc.resultados?.[i] || '' })).filter(x => String(x.acao || '').trim() !== '');
                    const estrelas = parseInt(enc.autoavaliacao) || 0;
                    return (
                      <div className={cardClass + ' space-y-5'}>
                        <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 pb-3">
                          <div>
                            <p className="text-xs font-medium text-intento-yellow uppercase tracking-wider">Último encontro</p>
                            <h3 className="text-base font-semibold text-intento-blue mt-0.5">Diário de Bordo · {enc.data}</h3>
                          </div>
                          <div className="flex items-center gap-1">
                            {[1,2,3,4,5].map(n => (
                              <span key={n} className={`text-base ${n <= estrelas ? 'text-intento-yellow' : 'text-slate-200'}`}>★</span>
                            ))}
                          </div>
                        </div>

                        {enc.categoria && (
                          <span className={`inline-flex text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${CAT.bg} ${CAT.fg}`}>
                            Desafio: {enc.categoria}
                          </span>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-slate-50 border border-slate-100 rounded-lg p-4">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Vitórias</p>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{enc.vitorias || '—'}</p>
                          </div>
                          <div className="bg-slate-50 border border-slate-100 rounded-lg p-4">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Maiores Desafios</p>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{enc.desafios || '—'}</p>
                          </div>
                        </div>

                        {enc.exploracao && (
                          <div className="bg-slate-50 border border-slate-100 rounded-lg p-4">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Exploração</p>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{enc.exploracao}</p>
                          </div>
                        )}

                        {enc.meta && (
                          <div className="bg-amber-50 border border-amber-100 border-l-4 border-l-intento-yellow rounded-lg p-4">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Meta para o próximo encontro</p>
                            <p className="text-sm font-semibold text-slate-700 leading-relaxed">{enc.meta}</p>
                          </div>
                        )}

                        {acoesValidas.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Plano de Ação e Resultados</p>
                            <div className="space-y-2">
                              {acoesValidas.map((it, i) => (
                                <div key={i} className="bg-white border border-slate-200 rounded-lg px-4 py-2.5 flex items-center justify-between gap-3">
                                  <span className="text-sm text-slate-700 font-medium flex-1">{i + 1}. {it.acao}</span>
                                  <span className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded ${RES[it.resultado] || 'bg-slate-100 text-slate-500'}`}>
                                    {it.resultado || 'Aguardando'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
              
              {abaAtiva === 4 && (() => {
                const HOUR_START = 5;
                const HOUR_END = 24;
                const TOTAL_HOURS = HOUR_END - HOUR_START;
                const PX_PER_HOUR = 64;

                const parseHora = (horaStr) => {
                  if (!horaStr) return { start: null, end: null };
                  const parts = String(horaStr).split('-').map(s => s.trim());
                  const toMin = (s) => {
                    const [h, m] = s.split(':').map(Number);
                    return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
                  };
                  const start = toMin(parts[0]);
                  const end = parts[1] ? toMin(parts[1]) : start + 60;
                  return { start, end };
                };

                const STYLES_CATEGORIA = {
                  'Codificação': { bg: 'bg-blue-100 border-blue-400',       text: 'text-blue-900',    dot: 'bg-blue-400'    },
                  'Revisão':     { bg: 'bg-emerald-100 border-emerald-400', text: 'text-emerald-900', dot: 'bg-emerald-400' },
                  'Hábitos':     { bg: 'bg-yellow-100 border-yellow-400',   text: 'text-yellow-900',  dot: 'bg-yellow-400'  },
                  'Simulados':   { bg: 'bg-red-100 border-red-400',         text: 'text-red-900',     dot: 'bg-red-400'     },
                  'Outros':      { bg: 'bg-slate-100 border-slate-300',     text: 'text-slate-700',   dot: 'bg-slate-400'   },
                };
                const parseAtividade = (raw) => {
                  const s = String(raw || '').trim();
                  const m = s.match(/^\[([^\]]+)\]\s*-?\s*(.*)$/);
                  if (m) {
                    const categoria = m[1].trim();
                    const label     = m[2].trim() || categoria;
                    return { categoria, label };
                  }
                  return { categoria: 'Outros', label: s };
                };
                const getEventStyle = (categoria) => STYLES_CATEGORIA[categoria] || STYLES_CATEGORIA['Outros'];

                const today = new Date().getDay();
                const dayAbbr = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

                return (
                  <div className="animate-in fade-in duration-500">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-base font-semibold text-intento-blue">Semana Padrão</h2>
                      <button onClick={zerarRotina} className={btnGhost}>Zerar Rotina</button>
                    </div>

                    {/* Mobile: card list per day */}
                    <div className="block md:hidden space-y-4">
                      {rotinaDias.map((dia, dayIdx) => {
                        const eventos = rotina[dia] || [];
                        if (eventos.length === 0) return null;
                        const abbr = dayAbbr[dayIdx] || dia.slice(0, 3);
                        const isToday = dayIdx === today;
                        return (
                          <div key={dia} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className={`px-4 py-2.5 border-b border-slate-100 ${isToday ? 'bg-intento-yellow/10' : 'bg-slate-50'}`}>
                              <p className={`text-xs font-semibold uppercase tracking-wider ${isToday ? 'text-intento-yellow' : 'text-slate-500'}`}>{abbr} — {dia}</p>
                            </div>
                            <div className="divide-y divide-slate-100">
                              {eventos.map((att, attIdx) => {
                                const tId = `t_${dayIdx}_${attIdx}`;
                                const isChecked = checkboxes[alunoNameKey + tId] || false;
                                const { categoria, label } = parseAtividade(att.atividade);
                                const style = getEventStyle(categoria);
                                return (
                                  <label key={attIdx} className={`flex items-center gap-3 px-4 py-3 cursor-pointer ${isChecked ? 'opacity-40' : ''}`}>
                                    <input type="checkbox" checked={isChecked} onChange={() => toggleTask(tId)} className="w-4 h-4 rounded shrink-0" onClick={e => e.stopPropagation()} />
                                    <div className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                                    <div className="flex-1 min-w-0">
                                      <p className={`text-sm font-medium ${isChecked ? 'line-through text-slate-400' : 'text-intento-blue'} truncate`}>{label}</p>
                                      <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                                        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />{categoria}{att.hora && <span className="ml-1">· {att.hora}</span>}
                                      </p>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Desktop: Google Calendar grid */}
                    <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      {/* Day headers */}
                      <div className="flex border-b border-slate-200">
                        <div className="w-14 shrink-0 border-r border-slate-100" />
                        {rotinaDias.map((dia, idx) => {
                          const abbr = dayAbbr[idx] || dia.slice(0, 3);
                          const isToday = idx === today;
                          return (
                            <div key={dia} className="flex-1 text-center py-3 border-r border-slate-100 last:border-r-0">
                              <p className={`text-[10px] font-medium uppercase tracking-wider ${isToday ? 'text-intento-yellow' : 'text-slate-400'}`}>{abbr}</p>
                            </div>
                          );
                        })}
                      </div>
                      {/* Time grid */}
                      <div className="flex overflow-y-auto" style={{ maxHeight: '70vh' }}>
                        {/* Hour labels */}
                        <div className="w-14 shrink-0 border-r border-slate-100 relative" style={{ height: TOTAL_HOURS * PX_PER_HOUR }}>
                          {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                            <div key={i} className="absolute w-full flex items-start justify-end pr-2" style={{ top: i * PX_PER_HOUR, height: PX_PER_HOUR }}>
                              <span className="text-[10px] text-slate-400 -mt-2">{String(HOUR_START + i).padStart(2, '0')}:00</span>
                            </div>
                          ))}
                        </div>
                        {/* Day columns */}
                        {rotinaDias.map((dia, dayIdx) => (
                          <div key={dia} className="flex-1 border-r border-slate-100 last:border-r-0 relative" style={{ height: TOTAL_HOURS * PX_PER_HOUR }}>
                            {/* Hour lines */}
                            {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                              <div key={i} className="absolute w-full border-t border-slate-100" style={{ top: i * PX_PER_HOUR }} />
                            ))}
                            {/* Events */}
                            {(rotina[dia] || []).map((att, attIdx) => {
                              const { start, end } = parseHora(att.hora);
                              if (start === null) return null;
                              const startMin = HOUR_START * 60;
                              const topPx = ((start - startMin) / 60) * PX_PER_HOUR;
                              const heightPx = Math.max(((end - start) / 60) * PX_PER_HOUR, 28);
                              const tId = `t_${dayIdx}_${attIdx}`;
                              const isChecked = checkboxes[alunoNameKey + tId] || false;
                              const { categoria, label } = parseAtividade(att.atividade);
                              const style = getEventStyle(categoria);
                              return (
                                <label
                                  key={attIdx}
                                  className={`absolute left-0.5 right-0.5 border-l-2 rounded-[4px] px-1.5 py-1 cursor-pointer overflow-hidden flex flex-col gap-0.5 ${style.bg} ${style.text} ${isChecked ? 'opacity-40' : ''}`}
                                  style={{ top: topPx, height: heightPx }}
                                  title={`${categoria} — ${label}`}
                                >
                                  <div className="flex items-center gap-1 min-w-0">
                                    <input type="checkbox" checked={isChecked} onChange={() => toggleTask(tId)} className="w-3 h-3 shrink-0 rounded" onClick={e => e.stopPropagation()} />
                                    <span className={`text-[9px] font-medium opacity-60 shrink-0`}>{att.hora}</span>
                                  </div>
                                  <p className={`text-[10px] font-semibold leading-tight truncate ${isChecked ? 'line-through' : ''}`}>{label}</p>
                                </label>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {abaAtiva === 5 && (
                <div className="space-y-8 animate-in fade-in duration-500">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                    <h1 className="text-2xl font-semibold text-intento-blue">Simulados</h1>
                    <button onClick={() => setModalRegistroAberto(true)} className={btnCTA}>
                      + Registrar Simulado
                    </button>
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider">Métricas Gerais</h3>

                    {/* Linha 1 — KPIs principais */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className={`${cardClass} text-center bg-slate-50`}>
                        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1">Simulados Realizados</p>
                        <p className="text-3xl font-bold text-intento-blue mt-1">{simKpi.realizados || 0}</p>
                        <p className="text-[10px] font-medium text-slate-400 mt-1">total</p>
                      </div>
                      <div className={`${cardClass} text-center border-b-2 border-b-intento-yellow`}>
                        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1">Média de Acertos</p>
                        <p className="text-4xl font-bold text-intento-yellow mt-1">{simKpi.medAcertos || 0}<span className="text-base text-slate-400 font-medium">/180</span></p>
                        <p className="text-[10px] font-medium text-slate-400 mt-1">últimos 3 simulados</p>
                      </div>
                      <div className={`${cardClass} text-center border-b-2 border-b-intento-blue`}>
                        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1">Média de Redação</p>
                        <p className="text-4xl font-bold text-intento-blue mt-1">{simKpi.medRedacao || 0}</p>
                        <p className="text-[10px] font-medium text-slate-400 mt-1">últimos 3 simulados</p>
                      </div>
                    </div>

                    {/* Linha 2 — Média por disciplina (últimos 3) */}
                    <div>
                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-3">Média por disciplina · últimos 3 simulados</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { label: 'Linguagens',   key: 'medLG',  color: '#0ea5e9', tw: 'text-sky-600' },
                          { label: 'Humanas',      key: 'medCH',  color: '#f97316', tw: 'text-orange-500' },
                          { label: 'Natureza',     key: 'medCN',  color: '#10b981', tw: 'text-emerald-600' },
                          { label: 'Matemática',   key: 'medMAT', color: '#ef4444', tw: 'text-red-500' },
                        ].map(d => (
                          <div key={d.key} className={`${cardClass} text-center py-4`} style={{ borderTop: `3px solid ${d.color}` }}>
                            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1">{d.label}</p>
                            <p className={`text-2xl font-bold mt-1 ${d.tw}`}>{simKpi[d.key] || 0}<span className="text-xs text-slate-400 font-medium">/45</span></p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Linha 3 — Tipos de erros + Histórico */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                      {/* Barras horizontais ranqueadas */}
                      <div className={`${cardClass} col-span-1`}>
                        <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Tipos de Erros</h3>
                        <p className="text-[10px] font-medium text-slate-400 mb-5">média dos últimos 3 simulados</p>
                        {(() => {
                          const tipos = [
                            { nome: 'Lacuna',        valor: simKpi.erros?.lac || 0,     trilho: 'bg-red-100',     barra: 'bg-red-500',     dot: 'bg-red-500' },
                            { nome: 'Recordação',    valor: simKpi.erros?.rec || 0,     trilho: 'bg-purple-100',  barra: 'bg-purple-500',  dot: 'bg-purple-500' },
                            { nome: 'Interpretação', valor: simKpi.erros?.inter || 0,   trilho: 'bg-blue-100',    barra: 'bg-blue-500',    dot: 'bg-blue-500' },
                            { nome: 'Atenção',       valor: simKpi.erros?.atencao || 0, trilho: 'bg-yellow-100',  barra: 'bg-yellow-500',  dot: 'bg-yellow-500' },
                          ].sort((a, b) => b.valor - a.valor);
                          const total = tipos.reduce((s, t) => s + t.valor, 0);
                          if (total === 0) {
                            return <p className="text-xs text-slate-400 font-medium py-8 text-center">Faça seu primeiro simulado para ver a análise.</p>;
                          }
                          return (
                            <div className="space-y-3">
                              {tipos.map(t => {
                                const pct = Math.round((t.valor / total) * 100);
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
                          );
                        })()}
                      </div>

                      {/* Histórico de Provas */}
                      <div className={`${cardClass} col-span-2`}>
                        <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-4">Histórico de Provas</h3>
                        <div className="h-64">
                          <Line
                            data={{
                              labels: histSim.labels || [],
                              datasets: [
                                { label: 'LG',   data: histSim.lg  || [], borderColor: '#0ea5e9', backgroundColor: '#0ea5e9', tension: 0.3 },
                                { label: 'CH',   data: histSim.ch  || [], borderColor: '#f97316', backgroundColor: '#f97316', tension: 0.3 },
                                { label: 'CN',   data: histSim.cn  || [], borderColor: '#10b981', backgroundColor: '#10b981', tension: 0.3 },
                                { label: 'MAT',  data: histSim.mat || [], borderColor: '#ef4444', backgroundColor: '#ef4444', tension: 0.3 },
                                {
                                  label: 'Meta',
                                  data: (histSim.labels || []).map(() => 40),
                                  borderColor: '#94a3b8',
                                  backgroundColor: 'transparent',
                                  borderDash: [6, 4],
                                  pointRadius: 0,
                                  borderWidth: 1.5,
                                },
                              ],
                            }}
                            options={{
                              ...chartOptions,
                              scales: { ...(chartOptions?.scales || {}), y: { min: 0, max: 45 } },
                            }}
                          />
                        </div>
                      </div>

                    </div>
                  </div>

                  <div className="pt-8 border-t border-slate-200">
                    <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-6">Seus Últimos Simulados</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {simuladosLista.map((sim) => (
                        <div key={sim.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col group hover:shadow-md transition-all">
                          {sim.status === 'Pendente' ? (
                            <div className="bg-amber-500 text-white text-[10px] font-semibold uppercase tracking-wide py-2 text-center">Análise Pendente</div>
                          ) : (
                            <div className="bg-emerald-500 text-white text-[10px] font-semibold uppercase tracking-wide py-2 text-center">Análise Concluída</div>
                          )}
                          <div className="p-5 flex-1">
                            <p className="text-xs text-slate-400 font-medium mb-1">{sim.modelo}</p>
                            <h4 className="text-base font-semibold text-intento-blue mb-1">{sim.especificacao}</h4>
                            <p className="text-sm text-slate-400 mb-5">Realizado em {String(sim.data || '').split(' ')[0]}</p>
                            <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                              <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Acertos</span>
                              <span className="font-bold text-intento-blue text-sm">{parseInt(sim.lg)+parseInt(sim.ch)+parseInt(sim.cn)+parseInt(sim.mat)} <span className="text-xs text-slate-400 font-normal">/ 180</span></span>
                            </div>
                          </div>
                          <div className="p-4 border-t border-slate-100">
                            {sim.status === 'Pendente' ? (
                              <button onClick={() => iniciarAutopsia(sim)} className={`w-full ${btnPrimary} text-xs py-2.5`}>🔍 Iniciar Análise</button>
                            ) : (
                              <button onClick={() => iniciarAutopsia(sim)} className={`w-full ${btnGhost} text-xs py-2.5`}>Revisar / Editar Análise</button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {abaAtiva === 6 && (
                <div className="space-y-6 animate-in fade-in duration-500">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm flex flex-col justify-between hover:border-intento-blue transition-colors group">
                      <div>
                        <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        </div>
                        <h3 className="text-xl font-semibold text-intento-blue mb-2">Método de Estudos</h3>
                        <p className="text-slate-500 text-sm font-medium mb-8">Acesse a nossa plataforma de aulas e domine a metodologia Intento de ponta a ponta.</p>
                      </div>
                      <a href="https://members.kiwify.com/?club=3044b7cc-8856-438c-bb02-5fca8a83998e" target="_blank" rel="noopener noreferrer" className="block w-full text-center bg-intento-blue text-white font-semibold py-3 rounded-lg hover:bg-blue-900 transition-colors">Acessar Plataforma</a>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm flex flex-col justify-between hover:border-intento-yellow transition-colors group">
                      <div>
                        <div className="w-14 h-14 bg-yellow-50 text-intento-yellow rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                        </div>
                        <h3 className="text-xl font-semibold text-intento-blue mb-2">Aplicativo Intento</h3>
                        <p className="text-slate-500 text-sm font-medium mb-8">Acesse o nosso web app para registrar revisões, tarefas diárias e acompanhar simulados.</p>
                      </div>
                      <a href="https://intento.ap1.com.br/" target="_blank" rel="noopener noreferrer" className="block w-full text-center bg-intento-yellow text-white font-semibold py-3 rounded-lg hover:bg-yellow-500 transition-colors">Abrir Aplicativo</a>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm flex flex-col justify-between hover:border-purple-500 transition-colors group">
                      <div>
                        <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
                        </div>
                        <h3 className="text-xl font-semibold text-intento-blue mb-2">Banco de Questões</h3>
                        <p className="text-slate-500 text-sm font-medium mb-8">Pratique com milhares de questões filtradas por matéria, tópico e nível de dificuldade.</p>
                      </div>
                      <a href="https://escolas.estuda.com/usuarios_login" target="_blank" rel="noopener noreferrer" className="block w-full text-center bg-purple-600 text-white font-semibold py-3 rounded-lg hover:bg-purple-700 transition-colors">Abrir Estuda.com</a>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm flex flex-col justify-between hover:border-emerald-500 transition-colors group">
                      <div>
                        <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"></path></svg>
                        </div>
                        <h3 className="text-xl font-semibold text-intento-blue mb-2">Suporte</h3>
                        <p className="text-slate-500 text-sm font-medium mb-8">Tem alguma dúvida técnica ou quer falar com a equipe de suporte da Intento?</p>
                      </div>
                      <a href="https://wa.me/5561981166909" target="_blank" rel="noopener noreferrer" className="block w-full text-center bg-emerald-600 text-white font-semibold py-3 rounded-lg hover:bg-emerald-700 transition-colors">Falar com o Suporte</a>
                    </div>
                  </div>
                </div>
              )}

              {abaAtiva === 7 && (() => {
                const cardsDaDisciplina = caderno.filter(c => filtroCaderno === 'Todas' || c.disciplina === filtroCaderno);
                const stats = { atrasado: 0, hoje: 0, novo: 0, 'em-dia': 0 };
                cardsDaDisciplina.forEach(c => { stats[statusCard(c).tipo]++; });
                const aFazer = stats.atrasado + stats.hoje + stats.novo;
                const cardsExibidos = cardsDaDisciplina.filter(c => {
                  if (filtroStatusCaderno === 'todos') return true;
                  const t = statusCard(c).tipo;
                  if (filtroStatusCaderno === 'a-fazer') return t === 'atrasado' || t === 'hoje' || t === 'novo';
                  return t === filtroStatusCaderno;
                });

                const statusChips = [
                  { id: 'todos',     label: 'Todos',       count: cardsDaDisciplina.length, dot: 'bg-slate-300', activeBg: 'bg-intento-blue',  activeText: 'text-white' },
                  { id: 'atrasado',  label: 'Atrasados',   count: stats.atrasado,            dot: 'bg-red-500',   activeBg: 'bg-red-500',       activeText: 'text-white' },
                  { id: 'a-fazer',   label: 'A fazer',     count: aFazer,                    dot: 'bg-amber-400', activeBg: 'bg-amber-500',     activeText: 'text-white' },
                  { id: 'em-dia',    label: 'Em dia',      count: stats['em-dia'],           dot: 'bg-emerald-400', activeBg: 'bg-emerald-500', activeText: 'text-white' },
                ];

                return (
                <div className="space-y-6 animate-in fade-in duration-500">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                    <div>
                      <h1 className="text-2xl font-semibold text-intento-blue">Caderno de Erros</h1>
                      {aFazer > 0 && (
                        <p className="text-xs text-slate-500 mt-1 font-medium">
                          <span className="text-red-500 font-bold">{stats.atrasado}</span> atrasado{stats.atrasado !== 1 ? 's' : ''}
                          {' · '}
                          <span className="text-amber-600 font-bold">{stats.hoje + stats.novo}</span> a fazer hoje
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex gap-2 flex-wrap">
                        {['Todas', ...disciplinasCaderno].map(d => (
                          <button key={d} onClick={() => setFiltroCaderno(d)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filtroCaderno === d ? 'bg-intento-blue text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-intento-blue'}`}>{d}</button>
                        ))}
                      </div>
                      <button onClick={() => { setModalCadernoAberto(true); if (filtroCaderno !== 'Todas') setFormCaderno(f => ({ ...f, disciplina: filtroCaderno })); }} className="bg-intento-yellow hover:bg-yellow-500 text-white font-bold py-2 px-4 rounded-lg text-sm shadow-sm transition-all shrink-0">+ Novo Card</button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {statusChips.map(s => {
                      const ativo = filtroStatusCaderno === s.id;
                      return (
                        <button
                          key={s.id}
                          onClick={() => setFiltroStatusCaderno(s.id)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${ativo ? `${s.activeBg} ${s.activeText} border-transparent shadow-sm` : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${ativo ? 'bg-white/80' : s.dot}`}></span>
                          {s.label}
                          <span className={`text-[10px] font-bold rounded-full px-1.5 py-px min-w-[18px] text-center ${ativo ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'}`}>{s.count}</span>
                        </button>
                      );
                    })}
                  </div>

                  {cadernoCarregando ? (
                    <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-intento-blue"></div></div>
                  ) : cardsExibidos.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
                      <p className="text-slate-400 font-medium">
                        {cardsDaDisciplina.length === 0
                          ? `Nenhum card ${filtroCaderno !== 'Todas' ? `em ${filtroCaderno}` : 'criado'} ainda.`
                          : 'Nenhum card neste status.'}
                      </p>
                      {cardsDaDisciplina.length === 0 && (
                        <button onClick={() => setModalCadernoAberto(true)} className="mt-4 text-sm text-intento-blue font-semibold underline underline-offset-2 hover:text-intento-yellow transition">Criar primeiro card →</button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {cardsExibidos.sort((a, b) => {
                        const ordem = { atrasado: 0, hoje: 1, novo: 2, 'em-dia': 3 };
                        const sa = statusCard(a);
                        const sb = statusCard(b);
                        if (ordem[sa.tipo] !== ordem[sb.tipo]) return ordem[sa.tipo] - ordem[sb.tipo];
                        return (a.proxima_revisao || '').localeCompare(b.proxima_revisao || '');
                      }).map(card => {
                        const status = statusCard(card);
                        const estilo = STATUS_STYLES[status.tipo];
                        return (
                        <div key={card.id} className={`bg-white border border-slate-200 ${estilo.borda} rounded-xl shadow-sm overflow-hidden flex flex-col hover:border-intento-blue/30 transition-all`}>
                          <div className="px-5 pt-5 pb-4 flex-1">
                            <div className="flex items-start justify-between mb-3 gap-2">
                              <div className="min-w-0">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-intento-yellow">{card.disciplina}</span>
                                <p className="text-xs text-slate-400 mt-0.5">{card.topico}</p>
                              </div>
                              <span className={`text-[10px] font-bold uppercase tracking-wider border rounded-full px-2 py-0.5 shrink-0 ${estilo.badge}`}>
                                {status.label}
                              </span>
                            </div>
                            {(card.fonte || card.classificacao) && (
                              <div className="flex flex-wrap gap-1.5 mb-3">
                                {card.fonte && (
                                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5">
                                    {card.fonte}
                                  </span>
                                )}
                                {card.classificacao && (
                                  <span className={`text-[10px] font-semibold border rounded-full px-2 py-0.5 ${CLASSIFICACAO_ESTILO[card.classificacao] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                    {card.classificacao}
                                  </span>
                                )}
                              </div>
                            )}
                            <p className="text-sm font-medium text-intento-blue leading-relaxed mb-4">{card.pergunta}</p>
                            {cardVirado[card.id] ? (
                              <div className="space-y-3">
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Resposta</p>
                                  <p className="text-sm text-slate-700 leading-relaxed">{card.resposta}</p>
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={() => registrarRevisao(card.id, true)} className="flex-1 py-2 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white transition-all">✓ Acertei</button>
                                  <button onClick={() => registrarRevisao(card.id, false)} className="flex-1 py-2 rounded-lg text-xs font-bold bg-red-400 hover:bg-red-500 text-white transition-all">✗ Errei</button>
                                </div>
                              </div>
                            ) : (
                              <button onClick={() => setCardVirado(v => ({ ...v, [card.id]: true }))} className="w-full text-center text-xs font-semibold text-slate-400 hover:text-intento-blue border border-dashed border-slate-200 rounded-lg py-2.5 transition-all hover:border-intento-blue">
                                Ver resposta →
                              </button>
                            )}
                          </div>
                          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                              Nível {card.estagio ?? 0}{card.proxima_revisao ? ` · ${card.proxima_revisao}` : ''}
                            </span>
                            <button onClick={() => deletarCardCaderno(card.id)} className="text-xs text-slate-300 hover:text-red-400 transition-colors">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            </button>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                );
              })()}

              {abaAtiva === 8 && sessao?.tipoAluno === 'EM' && (sessao?.idPlanilha || sessao?.idPlanilhaAluno) && (
                <div className="animate-in fade-in duration-500">
                  <BoletimAluno idAluno={sessao.idPlanilha || sessao.idPlanilhaAluno} />
                </div>
              )}

            </>
          )}

        </div>
      </main>

      {/* ========================================================== */}
      {/* MODAL DE REGISTRO INICIAL (PASSO 1) */}
      {/* ========================================================== */}
      {modalRegistroAberto && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-intento-blue/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-lg flex flex-col overflow-hidden">
            <div className="px-7 py-5 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-base font-semibold text-intento-blue">Novo Registro de Simulado</h2>
              <button onClick={() => setModalRegistroAberto(false)} aria-label="Fechar modal" className="text-slate-300 hover:text-slate-500 transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
            </div>

            <div className="p-7 space-y-5">
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button onClick={() => setTipoModelo("ENEM")} className={`flex-1 py-2.5 rounded-md font-medium text-sm transition-all ${tipoModelo === "ENEM" ? 'bg-intento-blue text-white' : 'text-slate-500 hover:text-slate-700'}`}>ENEM</button>
                <button onClick={() => setTipoModelo("OUTROS")} className={`flex-1 py-2.5 rounded-md font-medium text-sm transition-all ${tipoModelo === "OUTROS" ? 'bg-intento-blue text-white' : 'text-slate-500 hover:text-slate-700'}`}>Outros Vestibulares</button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelClass}>Data da Prova</label><input type="date" className={inputClass} value={formRegistro.data} onChange={e => setFormRegistro({...formRegistro, data: e.target.value})} /></div>
                <div><label className={labelClass}>Especificação</label><input type="text" placeholder="Ex: ENEM 2023 - PPL" className={inputClass} value={formRegistro.especificacao} onChange={e => setFormRegistro({...formRegistro, especificacao: e.target.value})} /></div>
              </div>

              {tipoModelo === "ENEM" ? (
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-200 pb-3">Acertos por Área (de 45)</p>
                  <div className="grid grid-cols-4 gap-3">
                    <div><label className="block text-[10px] font-medium text-blue-500 uppercase mb-1.5 tracking-wide">Linguagens</label><input type="number" min="0" max="45" placeholder="0" className="w-full p-2 border border-blue-200 rounded-lg font-semibold text-center outline-none focus:border-blue-400 bg-white text-slate-700" value={formRegistro.lg} onChange={e => setFormRegistro({...formRegistro, lg: e.target.value})} /></div>
                    <div><label className="block text-[10px] font-medium text-orange-500 uppercase mb-1.5 tracking-wide">Humanas</label><input type="number" min="0" max="45" placeholder="0" className="w-full p-2 border border-orange-200 rounded-lg font-semibold text-center outline-none focus:border-orange-400 bg-white text-slate-700" value={formRegistro.ch} onChange={e => setFormRegistro({...formRegistro, ch: e.target.value})} /></div>
                    <div><label className="block text-[10px] font-medium text-emerald-500 uppercase mb-1.5 tracking-wide">Natureza</label><input type="number" min="0" max="45" placeholder="0" className="w-full p-2 border border-emerald-200 rounded-lg font-semibold text-center outline-none focus:border-emerald-400 bg-white text-slate-700" value={formRegistro.cn} onChange={e => setFormRegistro({...formRegistro, cn: e.target.value})} /></div>
                    <div><label className="block text-[10px] font-medium text-red-400 uppercase mb-1.5 tracking-wide">Matemática</label><input type="number" min="0" max="45" placeholder="0" className="w-full p-2 border border-red-200 rounded-lg font-semibold text-center outline-none focus:border-red-400 bg-white text-slate-700" value={formRegistro.mat} onChange={e => setFormRegistro({...formRegistro, mat: e.target.value})} /></div>
                  </div>
                  <div className="mt-4"><label className="block text-[10px] font-medium text-purple-400 uppercase mb-1.5 tracking-wide">Nota Redação</label><input type="number" placeholder="Ex: 920" className="w-full p-2 border border-purple-200 rounded-lg font-semibold outline-none focus:border-purple-400 bg-white text-slate-700" value={formRegistro.redacao} onChange={e => setFormRegistro({...formRegistro, redacao: e.target.value})} /></div>
                </div>
              ) : (
                <div className="bg-orange-50 text-orange-700 p-5 rounded-xl font-medium text-sm border border-orange-100 text-center">
                  A interface para outros vestibulares será habilitada em breve.
                </div>
              )}
            </div>

            <div className="px-7 py-5 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setModalRegistroAberto(false)} className={btnGhost}>Cancelar</button>
              <button onClick={salvarSimulado} disabled={salvandoSimulado} className={btnPrimary + ' disabled:opacity-60'}>{salvandoSimulado ? 'Salvando...' : 'Salvar Registro'}</button>            </div>
          </div>
        </div>
      )}

      {/* MODAL CADERNO DE ERROS */}
      {modalCadernoAberto && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-intento-blue/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-lg flex flex-col overflow-hidden">
            <div className="px-7 py-5 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-base font-semibold text-intento-blue">Novo Card — Caderno de Erros</h2>
              <button onClick={() => setModalCadernoAberto(false)} aria-label="Fechar modal" className="text-slate-300 hover:text-slate-500 transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>
            <div className="p-7 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Disciplina</label>
                  <select className={inputClass} value={formCaderno.disciplina} onChange={e => setFormCaderno({...formCaderno, disciplina: e.target.value})}>
                    <option value="">Selecionar...</option>
                    {disciplinasCaderno.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Data do Erro</label>
                  <input type="date" className={inputClass} value={formCaderno.data} onChange={e => setFormCaderno({...formCaderno, data: e.target.value})} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Tópico</label>
                <input type="text" placeholder="Ex: Funções Orgânicas, Revolução Francesa..." className={inputClass} value={formCaderno.topico} onChange={e => setFormCaderno({...formCaderno, topico: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Fonte</label>
                  <input type="text" placeholder="Ex: Simulado ENEM 2023, prova FUVEST..." className={inputClass} value={formCaderno.fonte} onChange={e => setFormCaderno({...formCaderno, fonte: e.target.value})} />
                </div>
                <div>
                  <label className={labelClass}>Classificação do erro</label>
                  <select className={inputClass} value={formCaderno.classificacao} onChange={e => setFormCaderno({...formCaderno, classificacao: e.target.value})}>
                    <option value="">Selecionar...</option>
                    {Object.entries(CLASSIFICACOES_CADERNO).map(([grupo, opcoes]) => (
                      <optgroup key={grupo} label={grupo}>
                        {opcoes.map(o => <option key={o} value={o}>{o}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelClass}>Questão errada</label>
                <textarea rows={3} placeholder="Cole ou descreva a questão que você errou..." className={inputClass + " resize-none"} value={formCaderno.pergunta} onChange={e => setFormCaderno({...formCaderno, pergunta: e.target.value})} />
              </div>
              <div>
                <label className={labelClass}>Resposta correta <span className="text-slate-400 font-normal normal-case">(fica oculta — recordação ativa)</span></label>
                <textarea rows={3} placeholder="Resposta correta ou explicação completa..." className={inputClass + " resize-none"} value={formCaderno.resposta} onChange={e => setFormCaderno({...formCaderno, resposta: e.target.value})} />
              </div>
            </div>
            <div className="px-7 py-5 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setModalCadernoAberto(false)} className={btnGhost}>Cancelar</button>
              <button onClick={salvarCardCaderno} disabled={salvandoCaderno} className={btnPrimary + ' disabled:opacity-60'}>{salvandoCaderno ? 'Salvando...' : 'Salvar Card'}</button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; }
      `}} />
    </div>
  );
}