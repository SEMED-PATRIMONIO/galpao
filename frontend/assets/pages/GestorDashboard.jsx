import React, { useState, useEffect } from 'react';

const CardKPI = ({ titulo, valor, subtitulo, icon, onClick }) => (
  <div 
    onClick={onClick}
    className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-xl hover:border-blue-300 transition-all cursor-pointer group"
  >
    <div className="flex justify-between items-start mb-4">
      <span className="text-3xl group-hover:scale-110 transition-transform">{icon}</span>
      <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider">Ver Detalhes</span>
    </div>
    <h3 className="text-slate-500 text-sm font-medium uppercase tracking-tight">{titulo}</h3>
    <p className="text-4xl font-black text-slate-800 my-1">{valor}</p>
    {subtitulo && <p className="text-xs text-blue-500 font-semibold">{subtitulo}</p>}
  </div>
);

const GestorDashboard = () => {
  const [datas, setDatas] = useState({ inicio: '2023-10-01', fim: '2023-10-31' });
  const [stats, setStats] = useState(null);
  const [modalData, setModalData] = useState(null);

  // Carrega estatísticas sempre que as datas mudarem
  useEffect(() => {
    fetch(`/api/gestor/stats?inicio=${datas.inicio}&fim=${datas.fim}`)
      .then(res => res.json()).then(setStats);
  }, [datas]);

  return (
    <div className="min-h-screen bg-[#F1F5F9]">
      {/* Topo Estilizado */}
      <nav className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-50">
        <img src="/assets/logap.png" alt="Logo" className="h-8" />
        
        <div className="flex items-center space-x-4 bg-slate-50 p-2 rounded-xl border border-slate-200">
          <label className="text-xs font-bold text-slate-400 px-2">FILTRO POR PERÍODO</label>
          <input type="date" value={datas.inicio} onChange={e => setDatas({...datas, inicio: e.target.value})} className="bg-transparent text-sm font-bold text-blue-900 outline-none" />
          <span className="text-slate-300">|</span>
          <input type="date" value={datas.fim} onChange={e => setDatas({...datas, fim: e.target.value})} className="bg-transparent text-sm font-bold text-blue-900 outline-none" />
        </div>

        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">G</div>
      </nav>

      {/* Grid de Cards */}
      <main className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats && (
          <>
            <CardKPI titulo="Alunos Matriculados" valor={stats.alunos} icon="🎓" onClick={() => fetchDetalhes('aee_alunos')} />
            <CardKPI titulo="Total de Agendamentos" valor={stats.agendamentos} icon="📅" onClick={() => fetchDetalhes('aee_agendamentos')} />
            <CardKPI titulo="Atendimentos Realizados" valor={stats.atendimentos} icon="🩺" onClick={() => fetchDetalhes('aee_atendimentos')} />
            <CardKPI titulo="Especialidades" valor={stats.especialidades} icon="🎗️" />
            <CardKPI titulo="Profissionais Ativos" valor={stats.profissionais} icon="👥" />
            <CardKPI 
              titulo="Destaque do Período" 
              valor={stats.top_profissional.nome} 
              subtitulo={`${stats.top_profissional.total} atendimentos realizados`} 
              icon="🏆" 
            />
          </>
        )}
      </main>

      {/* Modal de Listagem Detalhada */}
      {modalData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-10">
          <div className="bg-white w-full h-full max-w-5xl rounded-3xl overflow-hidden flex flex-col shadow-2xl">
            <header className="p-6 bg-slate-50 border-b flex justify-between items-center">
                <h2 className="text-xl font-black text-slate-800">Relatório Detalhado - {datas.inicio} à {datas.fim}</h2>
                <button onClick={() => setModalData(null)} className="text-slate-400 hover:text-red-500 font-bold">FECHAR (ESC)</button>
            </header>
            <div className="flex-1 overflow-auto p-6">
                {/* Tabela dinâmica com os dados de modalData */}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};