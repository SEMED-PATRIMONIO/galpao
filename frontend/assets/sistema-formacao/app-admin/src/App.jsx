import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Users, FileCheck, PlusCircle, X, Search, ArrowLeft, Calendar, Info } from 'lucide-react';

export default function AppAdmin() {
  // Estados de Navegação
  const [telaAtiva, setTelaAtiva] = useState('principal'); // 'principal' ou 'consultas'
  const [showModalNovo, setShowModalNovo] = useState(false);
  const [detalheEvento, setDetalheEvento] = useState(null);

  // Estados de Dados
  const [eventos, setEventos] = useState([]);
  const [participantesEvento, setParticipantesEvento] = useState([]);
  const [filtros, setFiltros] = useState({ inicio: '', fim: '' });

  // 1. Busca eventos (com ou sem filtro de data)
  const carregarEventos = () => {
    let url = 'https://api.paiva.api.br/api/admin/eventos';
    if (filtros.inicio && filtros.fim) {
      url += `?inicio=${filtros.inicio}&fim=${filtros.fim}`;
    }
    fetch(url).then(r => r.json()).then(setEventos);
  };

  useEffect(() => { carregarEventos(); }, [filtros, telaAtiva]);

  // 2. Busca detalhes e presenças de um evento específico
  const abrirDetalhes = (evento) => {
    setDetalheEvento(evento);
    fetch(`https://api.paiva.api.br/api/admin/relatorio/${evento.id}`)
      .then(r => r.json())
      .then(setParticipantesEvento);
  };

  // --- COMPONENTE: TELA DE CONSULTAS ---
  const TelaConsultas = () => (
    <div className="animate-in slide-in-from-right duration-300">
      <header className="flex justify-between items-center mb-8">
        <button 
          onClick={() => setTelaAtiva('principal')}
          className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-bold transition-colors"
        >
          <ArrowLeft size={20} /> VOLTAR
        </button>
        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border">
          <div className="flex items-center gap-2 px-3">
            <span className="text-[10px] font-black text-slate-400 uppercase">Início</span>
            <input type="date" className="outline-none text-sm font-bold" onChange={e => setFiltros({...filtros, inicio: e.target.value})} />
          </div>
          <div className="h-8 w-[1px] bg-slate-200"></div>
          <div className="flex items-center gap-2 px-3">
            <span className="text-[10px] font-black text-slate-400 uppercase">Fim</span>
            <input type="date" className="outline-none text-sm font-bold" onChange={e => setFiltros({...filtros, fim: e.target.value})} />
          </div>
        </div>
      </header>

      <div className="grid gap-4">
        {eventos.map(ev => (
          <div 
            key={ev.id} 
            onClick={() => abrirDetalhes(ev)}
            className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-md cursor-pointer transition-all flex justify-between items-center group"
          >
            <div>
              <h3 className="font-bold text-slate-800 group-hover:text-blue-600">{ev.titulo}</h3>
              <p className="text-sm text-slate-500 flex items-center gap-2 mt-1">
                <Calendar size={14} /> {new Date(ev.data_evento).toLocaleDateString('pt-BR')} | {ev.carga_horaria}h
              </p>
            </div>
            <Info className="text-slate-300 group-hover:text-blue-400" />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      
      {/* SIDEBAR FIXA */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <img src="/logap.png" className="h-10" />
          <h2 className="font-black text-blue-900 leading-none text-lg">FORMAR</h2>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => setTelaAtiva('principal')} className={`w-full flex items-center gap-3 p-3 rounded-xl font-bold ${telaAtiva === 'principal' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-slate-500 hover:bg-slate-50'}`}>
            <LayoutDashboard size={20} /> Início
          </button>
          <button onClick={() => setTelaAtiva('consultas')} className={`w-full flex items-center gap-3 p-3 rounded-xl font-bold ${telaAtiva === 'consultas' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Search size={20} /> Consultar Período
          </button>
        </nav>
      </aside>

      {/* ÁREA DE CONTEÚDO */}
      <main className="flex-1 overflow-y-auto p-10">
        
        {telaAtiva === 'principal' ? (
          <div>
            <header className="flex justify-between items-end mb-10">
              <div>
                <h1 className="text-3xl font-black text-slate-800 tracking-tight">Painel Principal</h1>
                <p className="text-slate-500">Bem-vindo ao Sistema de Formação Continuada.</p>
              </div>
              <button onClick={() => setShowModalNovo(true)} className="bg-blue-600 text-white px-6 py-3 rounded-2xl flex items-center gap-2 font-bold shadow-lg">
                <PlusCircle size={20} /> NOVO EVENTO
              </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {/* Atalho rápido para Consultas */}
               <div onClick={() => setTelaAtiva('consultas')} className="bg-gradient-to-br from-blue-500 to-blue-700 p-8 rounded-[2.5rem] text-white cursor-pointer hover:scale-[1.02] transition-transform">
                  <Search size={40} className="mb-4 opacity-50" />
                  <h2 className="text-2xl font-bold">Consultar Histórico</h2>
                  <p className="opacity-80">Busque eventos por data e veja quem participou.</p>
               </div>
               {/* Outro Card */}
               <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200">
                  <Users size={40} className="mb-4 text-blue-600" />
                  <h2 className="text-2xl font-bold">Participantes</h2>
                  <p className="text-slate-500">Gerenciar base de dados de professores.</p>
               </div>
            </div>
          </div>
        ) : (
          <TelaConsultas />
        )}

        {/* MODAL DE DETALHES DO EVENTO + LISTA DE PRESENÇA */}
        {detalheEvento && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-end z-50">
            <div className="bg-white h-screen w-full max-w-2xl shadow-2xl p-10 overflow-y-auto animate-in slide-in-from-right duration-300">
              <div className="flex justify-between items-start mb-10">
                <div>
                  <h2 className="text-3xl font-black text-slate-800">{detalheEvento.titulo}</h2>
                  <p className="text-blue-600 font-bold uppercase tracking-widest text-xs mt-1">Detalhes do Evento</p>
                </div>
                <button onClick={() => setDetalheEvento(null)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X /></button>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-10">
                <div className="bg-slate-50 p-4 rounded-2xl">
                  <span className="text-[10px] font-black text-slate-400 uppercase">Carga Horária</span>
                  <p className="text-xl font-bold">{detalheEvento.carga_horaria} Horas</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl">
                  <span className="text-[10px] font-black text-slate-400 uppercase">Data Realizada</span>
                  <p className="text-xl font-bold">{new Date(detalheEvento.data_evento).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>

              <h3 className="font-black text-lg mb-4 border-b pb-2 flex justify-between items-center">
                Lista de Presença
                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs">{participantesEvento.length} Presentes</span>
              </h3>

              <div className="space-y-3">
                {participantesEvento.map((p, i) => (
                  <div key={i} className="flex justify-between items-center p-4 bg-white border border-slate-100 rounded-xl">
                    <div>
                      <p className="font-bold text-slate-700 uppercase text-sm">{p.nome_completo}</p>
                      <p className="text-xs text-slate-400">Matrícula: {p.matricula}</p>
                    </div>
                    <div className="text-right italic text-slate-400 text-[10px]">
                      Assinado em:<br/>{new Date(p.data_assinatura).toLocaleString('pt-BR')}
                    </div>
                  </div>
                ))}
                {participantesEvento.length === 0 && <p className="text-center py-10 text-slate-400">Nenhuma presença registrada ainda.</p>}
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}