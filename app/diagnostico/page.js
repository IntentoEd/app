'use client';

import { apiFetch } from '@/lib/api';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import questoesData from '../dados/questoes.json';


const CORES_DISCIPLINA = {
  Biologia:   { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', barra: 'bg-emerald-500', icone: 'text-emerald-600' },
  Química:    { bg: 'bg-blue-50',    border: 'border-blue-200',    badge: 'bg-blue-100 text-blue-700',       barra: 'bg-blue-500',    icone: 'text-blue-600' },
  Física:     { bg: 'bg-orange-50',  border: 'border-orange-200',  badge: 'bg-orange-100 text-orange-700',   barra: 'bg-orange-500',  icone: 'text-orange-600' },
  Matemática: { bg: 'bg-purple-50',  border: 'border-purple-200',  badge: 'bg-purple-100 text-purple-700',   barra: 'bg-purple-500',  icone: 'text-purple-600' },
};

export default function DiagnosticoTeorico() {
  const [etapa, setEtapa] = useState('introducao');
  const [respostas, setRespostas] = useState({});
  const [disciplinaAtual, setDisciplinaAtual] = useState('');
  const [indiceQuestao, setIndiceQuestao] = useState(0);
  const [concluidas, setConcluidas] = useState([]);
  const [resultadoFinal, setResultadoFinal] = useState(null);
  const [emailBlindado, setEmailBlindado] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviadoComSucesso, setEnviadoComSucesso] = useState(false);

  const disciplinas = ['Biologia', 'Química', 'Física', 'Matemática'];
  const questoesDaVez = questoesData.filter(q => q.disciplina === disciplinaAtual);

  useEffect(() => {
    const emailLogado = sessionStorage.getItem('emailLogado');
    if (emailLogado) setEmailBlindado(emailLogado);
    const respostasSalvas = localStorage.getItem('intento_diagnostico_respostas');
    if (respostasSalvas) setRespostas(JSON.parse(respostasSalvas));
    const concluidasSalvas = localStorage.getItem('intento_diagnostico_concluidas');
    if (concluidasSalvas) setConcluidas(JSON.parse(concluidasSalvas));
  }, []);

  const selecionarOpcao = (id, opcao) => {
    const novasRespostas = { ...respostas, [id]: opcao };
    setRespostas(novasRespostas);
    localStorage.setItem('intento_diagnostico_respostas', JSON.stringify(novasRespostas));
  };

  const marcarComoConcluida = () => {
    if (!concluidas.includes(disciplinaAtual)) {
      const novasConcluidas = [...concluidas, disciplinaAtual];
      setConcluidas(novasConcluidas);
      localStorage.setItem('intento_diagnostico_concluidas', JSON.stringify(novasConcluidas));
    }
    setEtapa('selecao');
    setIndiceQuestao(0);
    window.scrollTo(0, 0);
  };

  const finalizarTesteGeral = () => {
    const acertos = { Biologia: 0, Química: 0, Física: 0, Matemática: 0 };
    questoesData.forEach(q => {
      if (respostas[q.id] && respostas[q.id] === q.gabarito) acertos[q.disciplina]++;
    });
    const porcentagens = {
      Biologia:   Math.round((acertos.Biologia / 45) * 100),
      Química:    Math.round((acertos.Química / 45) * 100),
      Física:     Math.round((acertos.Física / 45) * 100),
      Matemática: Math.round((acertos.Matemática / 45) * 100),
    };
    const totalAcertos = Object.values(acertos).reduce((a, b) => a + b, 0);
    const totalQuestoes = concluidas.length * 45 || 1;
    const porcentagemGeral = Math.round((totalAcertos / (disciplinas.length * 45)) * 100);
    setResultadoFinal({ detalhe: acertos, porcentagens, porcentagemGeral });
    setEtapa('resultado');
    window.scrollTo(0, 0);
  };

  const enviarParaGoogle = async () => {
    setEnviando(true);
    try {
      await apiFetch('/api/mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'diagnostico',
          email: emailBlindado,
          acertosBiologia:   resultadoFinal.detalhe.Biologia,
          acertosQuimica:    resultadoFinal.detalhe.Química,
          acertosFisica:     resultadoFinal.detalhe.Física,
          acertosMatematica: resultadoFinal.detalhe.Matemática,
        }),
      });
      setEnviadoComSucesso(true);
      localStorage.removeItem('intento_diagnostico_respostas');
      localStorage.removeItem('intento_diagnostico_concluidas');
      const email = sessionStorage.getItem('emailLogado') || 'anonimo';
      const chave = `intento_checklist_${email}`;
      const checklist = JSON.parse(localStorage.getItem(chave) || '{}');
      localStorage.setItem(chave, JSON.stringify({ ...checklist, diagnostico: true }));
    } catch {
      alert('Erro na comunicação.');
    } finally {
      setEnviando(false);
    }
  };

  // ── TELA 1: INTRODUÇÃO ────────────────────────────────────────────────────
  if (etapa === 'introducao') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 py-12 font-sans">
        <div className="bg-white p-8 md:p-12 rounded-2xl shadow-sm max-w-5xl w-full border border-slate-200">

          <div className="text-center mb-10 border-b border-slate-100 pb-8">
            <div className="inline-flex items-center gap-2 bg-intento-blue/5 border border-intento-blue/10 px-4 py-1.5 rounded-full mb-4">
              <span className="text-xs font-bold text-intento-blue uppercase tracking-widest">Diagnóstico Teórico</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-intento-blue mb-3 tracking-tight">
              Antes de começar, leia isto.
            </h1>
            <p className="text-slate-400 font-medium text-base max-w-2xl mx-auto">
              Entender o propósito e o método fará toda a diferença na precisão do seu plano de estudos.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">

            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
              <h2 className="text-sm font-bold text-intento-blue mb-5 uppercase tracking-wider">Por que fazer este diagnóstico?</h2>
              <ul className="space-y-5 text-sm text-slate-600 leading-relaxed">
                <li>
                  <b className="text-intento-blue block mb-1">Para criar seu Raio-X</b>
                  Este teste não vale nota. O objetivo é ser uma ferramenta precisa para mapear onde estão suas forças e fraquezas na base teórica.
                </li>
                <li>
                  <b className="text-intento-blue block mb-1">Para otimizar seu tempo</b>
                  Ao identificarmos suas dificuldades conceituais, montamos um plano cirúrgico. Você estudará menos, mas estudará melhor.
                </li>
                <li>
                  <b className="text-intento-blue block mb-1">Para fortalecer a base</b>
                  Antes de resolver problemas complexos do ENEM, precisamos garantir que cada fundamento teórico esteja sólido.
                </li>
              </ul>
            </div>

            <div className="p-6">
              <h2 className="text-sm font-bold text-intento-blue mb-5 uppercase tracking-wider">Como fazer</h2>
              <div className="space-y-4">
                {[
                  { n: '1', titulo: 'Sem consultas', desc: 'Sem livros, cadernos ou internet. O objetivo é mapear o que já está consolidado na sua mente.' },
                  { n: '2', titulo: 'Não "roube" de si mesmo', desc: 'Olhar gabaritos sabota seu plano. Um diagnóstico impreciso gera um planejamento ineficaz.' },
                  { n: '3', titulo: 'Foco total', desc: 'Reserve tempo num ambiente sem distrações. Sugerimos 2 blocos de 90 questões.' },
                  { n: '4', titulo: 'Faça do início ao fim', desc: 'Responda um bloco de uma vez. Sua primeira intuição é valiosa.' },
                  { n: '5', titulo: 'Abrace o erro', desc: 'O erro é um GPS que aponta onde direcionar sua energia. Não tenha medo.' },
                ].map(item => (
                  <div key={item.n} className="flex gap-4 items-start">
                    <div className="w-6 h-6 shrink-0 rounded-full border-2 border-intento-yellow text-intento-blue font-bold flex items-center justify-center text-xs mt-0.5">{item.n}</div>
                    <div>
                      <p className="font-semibold text-intento-blue text-sm">{item.titulo}</p>
                      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          <div className="text-center">
            <button onClick={() => setEtapa('selecao')}
              className="bg-intento-yellow hover:bg-yellow-500 text-white px-12 py-3 rounded-lg font-bold text-sm transition-all w-full md:w-auto shadow-sm">
              Começar o Diagnóstico →
            </button>
          </div>

        </div>
      </div>
    );
  }

  // ── TELA 2: SELEÇÃO DE DISCIPLINA ────────────────────────────────────────
  if (etapa === 'selecao') {
    const todosConcluidos = concluidas.length === disciplinas.length;
    const faltam = disciplinas.length - concluidas.length;

    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4 font-sans">
        <div className="max-w-3xl mx-auto">

          {/* Cabeçalho */}
          <div className="text-center mb-8">
            <h2 className="text-xl font-bold text-intento-blue mb-1">Escolha uma disciplina</h2>
            <p className="text-slate-400 font-medium text-sm">Você pode realizar os diagnósticos na ordem que preferir.</p>
          </div>

          {/* Progresso geral */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 flex items-center gap-4 shadow-sm">
            <div className="flex-1">
              <div className="flex justify-between text-xs font-medium mb-1.5">
                <span className="text-slate-500">{concluidas.length} de {disciplinas.length} disciplinas concluídas</span>
                <span className="text-intento-blue font-bold">{Math.round((concluidas.length / 4) * 100)}%</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-intento-yellow h-full rounded-full transition-all duration-700"
                  style={{ width: `${(concluidas.length / 4) * 100}%` }} />
              </div>
            </div>
          </div>

          {/* Cards de disciplina */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
            {disciplinas.map((disc) => {
              const estaConcluida = concluidas.includes(disc);
              const foiIniciada = !estaConcluida && questoesData.some(q => q.disciplina === disc && respostas[q.id]);
              const cores = CORES_DISCIPLINA[disc];
              const respondidas = questoesData.filter(q => q.disciplina === disc && respostas[q.id]).length;

              return (
                <button
                  key={disc}
                  onClick={() => { setDisciplinaAtual(disc); setEtapa('teste'); setIndiceQuestao(0); }}
                  className={`p-5 rounded-xl border-2 transition-all text-left shadow-sm group
                    ${estaConcluida
                      ? `${cores.bg} ${cores.border} opacity-80`
                      : foiIniciada
                        ? 'border-intento-yellow/60 bg-amber-50/50 hover:border-intento-yellow'
                        : 'border-slate-200 bg-white hover:border-intento-blue/30'
                    }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5
                        ${estaConcluida ? cores.icone : foiIniciada ? 'text-amber-600' : 'text-slate-400'}`}>
                        {estaConcluida ? '✓ Concluído' : foiIniciada ? `Em andamento — ${respondidas}/45` : 'Disponível'}
                      </p>
                      <h3 className="text-base font-bold text-intento-blue">{disc}</h3>
                      <p className="text-xs text-slate-400 mt-0.5 font-medium">45 questões</p>
                    </div>

                    {/* Mini barra de progresso da disciplina */}
                    {foiIniciada && (
                      <div className="shrink-0 w-12 text-right">
                        <p className="text-lg font-black text-intento-yellow">{Math.round((respondidas / 45) * 100)}%</p>
                      </div>
                    )}
                    {estaConcluida && (
                      <div className={`w-9 h-9 rounded-full ${cores.badge} flex items-center justify-center text-sm font-bold shrink-0`}>
                        ✓
                      </div>
                    )}
                    {!estaConcluida && !foiIniciada && (
                      <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-intento-blue group-hover:text-white transition-all shrink-0">
                        →
                      </div>
                    )}
                  </div>

                  {foiIniciada && (
                    <div className="mt-3">
                      <div className="w-full bg-white/60 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-intento-yellow h-full rounded-full transition-all"
                          style={{ width: `${(respondidas / 45) * 100}%` }} />
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Ação de finalização */}
          {todosConcluidos ? (
            <div className="text-center">
              <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-full mb-4">
                <span className="text-emerald-600 font-bold text-sm">Todas as disciplinas concluídas!</span>
              </div>
              <br />
              <button onClick={finalizarTesteGeral}
                className="bg-emerald-500 text-white px-12 py-3 rounded-lg font-bold text-sm hover:bg-emerald-600 transition-all shadow-sm">
                Ver meus Resultados →
              </button>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-5 text-center shadow-sm">
              <p className="text-sm font-medium text-intento-blue mb-1">
                {faltam === 1 ? 'Falta 1 disciplina para concluir o diagnóstico.' : `Faltam ${faltam} disciplinas para concluir o diagnóstico.`}
              </p>
              <p className="text-xs text-slate-400 font-medium">
                Conclua todas as disciplinas para ver seus resultados.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── TELA 3: RESULTADOS ───────────────────────────────────────────────────
  if (etapa === 'resultado') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 py-12 font-sans">
        <div className="bg-white p-8 md:p-10 rounded-2xl shadow-sm max-w-lg w-full border border-slate-200">

          <div className="w-14 h-14 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-intento-blue text-center mb-1">Diagnóstico Concluído!</h2>
          <p className="text-slate-400 text-center mb-8 text-sm font-medium">Veja o detalhamento da sua pontuação abaixo.</p>

          {/* Cards de disciplina */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            {Object.entries(resultadoFinal.porcentagens).map(([disc, pct]) => {
              const cores = CORES_DISCIPLINA[disc];
              return (
                <div key={disc} className={`${cores.bg} border ${cores.border} p-4 rounded-xl`}>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{disc}</p>
                  <p className="text-2xl font-black text-intento-blue">{pct}%</p>
                  <div className="w-full bg-white/60 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div className={`${cores.barra} h-full rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Aproveitamento geral */}
          <div className="bg-intento-blue/5 border border-intento-blue/10 rounded-xl p-4 text-center mb-6">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Aproveitamento Geral</p>
            <p className="text-4xl font-black text-intento-yellow">{resultadoFinal.porcentagemGeral}%</p>
          </div>

          {!enviadoComSucesso ? (
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
              <p className="text-sm font-semibold text-intento-blue mb-1">Confirme seu e-mail para enviar ao seu mentor.</p>
              <p className="text-xs text-slate-400 mb-4">Use o mesmo e-mail do Questionário de Onboarding.</p>
              <input type="email" value={emailBlindado} disabled
                className="w-full p-3 bg-slate-100 border border-slate-200 rounded-lg text-slate-400 font-medium text-sm mb-3" />
              <button onClick={enviarParaGoogle} disabled={enviando}
                className="w-full py-3 bg-intento-yellow hover:bg-yellow-500 text-white rounded-lg font-bold transition-all text-sm disabled:opacity-50">
                {enviando ? 'Enviando...' : 'Enviar Resultados'}
              </button>
            </div>
          ) : (
            <div className="text-center">
              <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-full mb-5">
                <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-emerald-700 font-semibold text-sm">Notas enviadas com sucesso!</span>
              </div>
              <Link href="/painel"
                className="block w-full bg-intento-blue text-white py-3 rounded-lg font-bold hover:bg-blue-900 transition text-sm">
                Ir para o Painel →
              </Link>
            </div>
          )}

        </div>
      </div>
    );
  }

  // ── TELA 4: QUESTÕES ─────────────────────────────────────────────────────
  const questaoAtual = questoesDaVez[indiceQuestao];
  const respondidas = questoesDaVez.filter(q => respostas[q.id]).length;
  const cores = CORES_DISCIPLINA[disciplinaAtual] || {};

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">

      {/* Header fixo */}
      <header className="sticky top-0 z-50 bg-intento-blue text-white shadow-sm border-b-2 border-intento-yellow">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold tracking-tight">Diagnóstico</span>
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${cores.badge || 'bg-white/10 text-white'}`}>
              {disciplinaAtual}
            </span>
          </div>
          <button onClick={() => { setEtapa('selecao'); setIndiceQuestao(0); }}
            className="text-xs font-semibold text-slate-400 hover:text-red-400 transition flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Sair
          </button>
        </div>
      </header>

      {/* Barra de progresso */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex justify-between text-xs font-semibold mb-1.5">
            <span className="text-slate-400 uppercase tracking-wider">Questão {indiceQuestao + 1} de {questoesDaVez.length}</span>
            <span className="text-intento-blue">{respondidas} respondidas</span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div className={`${cores.barra || 'bg-intento-yellow'} h-full transition-all duration-500`}
              style={{ width: `${((indiceQuestao + 1) / questoesDaVez.length) * 100}%` }} />
          </div>
        </div>
      </div>

      {/* Corpo da questão */}
      <main className="flex-1 overflow-y-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          {questaoAtual && (
            <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm">

              <div className="flex items-center gap-2 mb-5">
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${cores.badge || 'bg-slate-100 text-slate-500'}`}>
                  Questão {indiceQuestao + 1}
                </span>
                {respostas[questaoAtual.id] && (
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                    ✓ Respondida
                  </span>
                )}
              </div>

              <p className="text-base md:text-lg font-medium text-intento-blue mb-6 leading-snug">
                {questaoAtual.enunciado}
              </p>

              <div className="grid grid-cols-1 gap-2.5">
                {['A', 'B', 'C', 'D'].map(L => {
                  const isSelecionada = respostas[questaoAtual.id] === L;
                  return (
                    <label key={L}
                      className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer
                        ${isSelecionada
                          ? `${cores.bg || 'bg-blue-50'} ${cores.border || 'border-intento-blue'} shadow-sm`
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 transition-all
                        ${isSelecionada ? `${cores.barra || 'bg-intento-blue'} text-white` : 'bg-slate-100 text-slate-500'}`}>
                        {L}
                      </div>
                      <input type="radio" checked={isSelecionada}
                        onChange={() => selecionarOpcao(questaoAtual.id, L)} className="sr-only" />
                      <span className={`text-sm leading-snug ${isSelecionada ? 'text-intento-blue font-semibold' : 'text-slate-600 font-medium'}`}>
                        {questaoAtual.opcoes[L]}
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="mt-8 flex justify-between items-center border-t border-slate-100 pt-6">
                <button onClick={() => { if (indiceQuestao > 0) setIndiceQuestao(prev => prev - 1); }}
                  className={`text-sm font-semibold transition ${indiceQuestao === 0 ? 'opacity-0 pointer-events-none' : 'text-slate-400 hover:text-intento-blue'}`}>
                  ← Anterior
                </button>

                {indiceQuestao < questoesDaVez.length - 1 ? (
                  <button onClick={() => setIndiceQuestao(prev => prev + 1)}
                    className="bg-intento-blue text-white px-8 py-2.5 rounded-lg text-sm font-bold hover:bg-blue-900 transition">
                    Próxima →
                  </button>
                ) : (
                  <button onClick={marcarComoConcluida}
                    className="bg-emerald-500 text-white px-8 py-2.5 rounded-lg text-sm font-bold hover:bg-emerald-600 transition">
                    Concluir {disciplinaAtual} ✓
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
