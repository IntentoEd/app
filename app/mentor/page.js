'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ModalRegistro from '../../components/ModalRegistro';
import { auth } from '@/lib/firebase';
import { useMentor } from '@/lib/MentorContext';
import { LoadingScreen } from '@/components/Loading';
import PushToggle from '@/components/PushToggle';
import StatusAppSelect from '@/components/StatusAppSelect';

// Semana de trabalho do mentor (Dom-Sáb que ACABOU de fechar; o mentor
// entra na segunda pra revisar/exportar). Usado pra display.
function getSemanaKey() {
  const hoje = new Date();
  const domingo = new Date(hoje);
  domingo.setDate(hoje.getDate() - hoje.getDay() - 7);
  const sabado = new Date(domingo);
  sabado.setDate(domingo.getDate() + 6);
  const fmt = (d) => d.toLocaleDateString('pt-BR');
  return `${fmt(domingo)} a ${fmt(sabado)}`;
}

// ISO 'YYYY-MM-DD' do domingo da semana corrente (início da janela em que
// uma exportação ainda conta como "feita esta semana").
function inicioSemanaAtualISO() {
  const hoje = new Date();
  const domingo = new Date(hoje);
  domingo.setDate(hoje.getDate() - hoje.getDay());
  domingo.setHours(0, 0, 0, 0);
  return domingo.toISOString().slice(0, 10);
}

// True se o mentor exportou o .png desse aluno desde o último domingo.
function exportouNessaSemana(aluno) {
  const ult = aluno?.ultimaExportacao;
  if (!ult) return false;
  return String(ult) >= inicioSemanaAtualISO(); // comparação ISO YYYY-MM-DD = cronológica
}

// Roteia o botão "Exportar Acompanhamento" baseado no status_app:
// quem não usa o app (Não se adaptou / Nunca vai usar) vai pra /diario;
// resto vai pro /painel (template completo).
function rotaExportacao(aluno) {
  const semApp = aluno?.statusApp === 'Não se adaptou' || aluno?.statusApp === 'Nunca vai usar';
  const base = semApp ? '/mentor/ig/diario' : '/mentor/ig/painel';
  return `${base}?id=${aluno.id}&nome=${encodeURIComponent(aluno.nome || '')}`;
}

export default function PainelGlobalMentor() {
  const router = useRouter();
  const { emailMentor, primeiroNome: mentorLogado, alunos, carregandoAlunos: carregando, prefetchAluno, atualizarStatusApp } = useMentor();
  const ehLider = emailMentor === 'filippe@metodointento.com.br';

  const [busca, setBusca] = useState('');
  const [salvandoStatus, setSalvandoStatus] = useState({});

  const handleStatusAppChange = useCallback(async (idAluno, novoStatus) => {
    setSalvandoStatus(prev => ({ ...prev, [idAluno]: true }));
    await atualizarStatusApp(idAluno, novoStatus);
    setSalvandoStatus(prev => ({ ...prev, [idAluno]: false }));
  }, [atualizarStatusApp]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [alunoPreSelecionado, setAlunoPreSelecionado] = useState(null);

  const abrirModal = (aluno = null) => {
    setAlunoPreSelecionado(aluno);
    setIsModalOpen(true);
  };

  const fecharModal = () => {
    setIsModalOpen(false);
    setAlunoPreSelecionado(null);
  };

  // Sem-op — modal ainda chama esse callback ao salvar registro, mas o sinal
  // de "feito" agora é exportação, não preenchimento. Mantemos pra compat.
  const handleRegistroSalvo = useCallback(() => {}, []);

  const alunosOrdenados = [...alunos].sort((a, b) =>
    (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' })
  );

  const alunosFiltrados = alunosOrdenados.filter(a =>
    a.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    a.email?.toLowerCase().includes(busca.toLowerCase())
  );

  const totalEnviados = alunos.filter(exportouNessaSemana).length;
  const semanaRef = getSemanaKey();

  if (carregando) return <LoadingScreen mensagem="Sincronizando Painel..." />;

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Cabeçalho */}
        <div className="flex justify-between items-center border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-2xl font-bold text-intento-blue">Painel do Mentor</h1>
            <p className="text-slate-400 text-sm font-medium mt-0.5">Bem-vindo(a), {mentorLogado}</p>
          </div>
          <div className="flex items-center gap-3">
            <PushToggle email={emailMentor} />
            {ehLider && (
              <button
                onClick={() => router.push('/selecionar-modo')}
                className="text-xs font-semibold text-intento-yellow border border-intento-yellow hover:bg-intento-yellow hover:text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                Painel do Líder ↔
              </button>
            )}
            <button
              onClick={() => { auth.signOut(); sessionStorage.removeItem('emailLogado'); router.push('/'); }}
              className="text-sm font-semibold text-slate-400 hover:text-red-500 transition-colors"
            >
              Sair
            </button>
          </div>
        </div>

        {/* Painel de acompanhamentos enviados (sinal: mentor exportou .png pra mandar pro aluno) */}
        {alunos.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Acompanhamentos Enviados</p>
                <p className="text-xs text-slate-400 font-medium">Semana de trabalho · {semanaRef}</p>
              </div>
              <div className="flex items-center gap-4">
                {/* Barra de progresso */}
                <div className="flex-1 min-w-[140px]">
                  <div className="flex justify-between text-xs font-semibold mb-1.5">
                    <span className="text-slate-500">{totalEnviados} de {alunos.length}</span>
                    <span className="text-intento-blue">{alunos.length > 0 ? Math.round((totalEnviados / alunos.length) * 100) : 0}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${totalEnviados === alunos.length ? 'bg-emerald-500' : 'bg-intento-yellow'}`}
                      style={{ width: `${alunos.length > 0 ? (totalEnviados / alunos.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                {/* Badge de status geral */}
                {totalEnviados === alunos.length && alunos.length > 0 ? (
                  <span className="shrink-0 bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-full border border-emerald-200">
                    ✓ Todos enviados
                  </span>
                ) : (
                  <span className="shrink-0 bg-amber-50 text-amber-700 text-xs font-bold px-3 py-1.5 rounded-full border border-amber-200">
                    {alunos.length - totalEnviados} pendente{alunos.length - totalEnviados !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>

            {/* Avatares rápidos dos pendentes — clica e vai pra exportação */}
            {totalEnviados < alunos.length && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Pendentes:</p>
                <div className="flex flex-wrap gap-2">
                  {alunosOrdenados.filter(a => !exportouNessaSemana(a)).map(a => (
                    <Link
                      key={a.id}
                      href={rotaExportacao(a)}
                      title={`Exportar acompanhamento de ${a.nome}`}
                      className="flex items-center gap-2 bg-slate-50 border border-slate-200 hover:border-intento-yellow hover:bg-amber-50 px-3 py-1.5 rounded-full transition-all group"
                    >
                      <div className="w-5 h-5 rounded-full bg-slate-200 group-hover:bg-intento-yellow flex items-center justify-center shrink-0 transition-colors">
                        <span className="text-[9px] font-black text-slate-600 group-hover:text-white">{a.nome?.charAt(0)}</span>
                      </div>
                      <span className="text-xs font-semibold text-slate-600 group-hover:text-amber-700">{a.nome?.split(' ')[0]}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Barra de busca + botão novo registro */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <h2 className="text-sm font-bold text-intento-blue">Todos os Mentorados ({alunos.length})</h2>
          <div className="flex gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
              </svg>
              <input
                type="text"
                placeholder="Buscar aluno..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-intento-blue text-sm font-medium text-intento-blue placeholder:text-slate-400 bg-white transition-all"
              />
            </div>
            <button
              onClick={() => abrirModal(null)}
              className="shrink-0 bg-intento-yellow hover:bg-yellow-500 text-white font-bold py-2.5 px-5 rounded-lg shadow-sm transition-all text-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
              </svg>
              Novo Registro
            </button>
          </div>
        </div>

        {busca && (
          <p className="text-xs font-medium text-slate-400 -mt-3">
            {alunosFiltrados.length} resultado{alunosFiltrados.length !== 1 ? 's' : ''} para &quot;{busca}&quot;
          </p>
        )}

        {/* Cards de alunos */}
        {alunos.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center shadow-sm">
            <p className="text-slate-400 font-medium text-sm">Nenhum aluno sob a sua responsabilidade no momento.</p>
          </div>
        ) : alunosFiltrados.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center shadow-sm">
            <p className="text-slate-400 font-medium text-sm">Nenhum aluno encontrado para &quot;{busca}&quot;.</p>
            <button onClick={() => setBusca('')} className="text-xs text-intento-blue font-bold mt-2 hover:underline">
              Limpar busca
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {alunosFiltrados.map(aluno => {
              const jaEnviou = exportouNessaSemana(aluno);
              return (
                <div key={aluno.id}
                  onMouseEnter={() => prefetchAluno(aluno.id)}
                  onFocus={() => prefetchAluno(aluno.id)}
                  className={`bg-white rounded-xl border-2 p-5 shadow-sm flex flex-col justify-between transition-all group
                    ${jaEnviou
                      ? 'border-emerald-200 hover:border-emerald-300'
                      : 'border-slate-200 hover:border-intento-blue/25 hover:shadow-sm'
                    }`}
                >
                  <div className="mb-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="w-10 h-10 rounded-full bg-intento-blue/10 flex items-center justify-center shrink-0">
                        <span className="text-intento-blue font-black text-sm">{aluno.nome?.charAt(0)?.toUpperCase() || '?'}</span>
                      </div>
                      {/* Badge de acompanhamento da semana (sinal: exportou .png) */}
                      {jaEnviou ? (
                        <span title="Acompanhamento exportado nesta semana"
                          className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1 shrink-0">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                          </svg>
                          Enviado
                        </span>
                      ) : (
                        <span title="Acompanhamento ainda não exportado nesta semana"
                          className="text-[10px] font-bold bg-amber-50 text-amber-600 px-2.5 py-1 rounded-full border border-amber-200 shrink-0">
                          Pendente
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="text-sm font-bold text-intento-blue leading-tight">{aluno.nome}</h3>
                      {aluno.tipoAluno === 'EM' && (
                        <span className="text-[9px] font-bold bg-intento-yellow/15 text-intento-yellow border border-intento-yellow/30 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">EM</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 font-medium truncate">{aluno.email}</p>
                    {aluno.proximaProva && aluno.proximaProva.dias <= 10 && (
                      <p className={`text-[11px] font-bold mt-1.5 ${aluno.proximaProva.dias <= 3 ? 'text-red-600' : aluno.proximaProva.dias <= 7 ? 'text-amber-700' : 'text-slate-500'}`}>
                        📅 {aluno.proximaProva.materia} {aluno.proximaProva.dias === 0 ? 'hoje' : aluno.proximaProva.dias === 1 ? 'amanhã' : `em ${aluno.proximaProva.dias}d`}
                      </p>
                    )}
                    <div className="mt-2.5">
                      <StatusAppSelect
                        valor={aluno.statusApp}
                        salvando={!!salvandoStatus[aluno.id]}
                        onChange={(v) => handleStatusAppChange(aluno.id, v)}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => router.push(`/mentor/${aluno.id}?nome=${encodeURIComponent(aluno.nome)}`)}
                      className="w-full bg-white border-2 border-intento-blue text-intento-blue font-bold py-2 rounded-lg hover:bg-intento-blue hover:text-white transition-all text-xs"
                    >
                      Abrir Dados
                    </button>
                    <Link
                      href={rotaExportacao(aluno)}
                      className={`w-full font-bold py-2 rounded-lg transition-all text-xs text-center
                        ${jaEnviou
                          ? 'bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100'
                          : 'bg-white border-2 border-intento-yellow text-intento-yellow hover:bg-intento-yellow hover:text-white'
                        }`}
                    >
                      {jaEnviou ? 'Exportar de novo' : 'Exportar Acompanhamento →'}
                    </Link>
                    <button
                      onClick={() => abrirModal(aluno)}
                      className="w-full text-center text-xs text-slate-400 hover:text-intento-blue font-semibold py-1.5 transition"
                    >
                      + Novo Registro Manual
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isModalOpen && (
        <ModalRegistro
          alunos={alunos}
          alunoPreSelecionado={alunoPreSelecionado}
          onClose={fecharModal}
          onRegistroSalvo={handleRegistroSalvo}
        />
      )}
    </div>
  );
}
