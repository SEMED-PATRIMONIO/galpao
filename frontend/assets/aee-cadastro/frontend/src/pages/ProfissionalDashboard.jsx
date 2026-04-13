import React, { useState, useEffect } from 'react';
import DataTable from '../components/DataTable';
import AtendimentoModal from '../components/AtendimentoModal';
import AgendamentoModal from '../components/AgendamentoModal';

const ProfissionalDashboard = () => {
  // Estados de Dados
  const [alunos, setAlunos] = useState([]);
  const [agenda, setAgenda] = useState({ hoje: [], pendentes: [] });
  const [loading, setLoading] = useState(true);

  // Estados dos Modais
  const [isAtendimentoOpen, setIsAtendimentoOpen] = useState(false);
  const [isAgendamentoOpen, setIsAgendamentoOpen] = useState(false);
  const [selectedAgendamento, setSelectedAgendamento] = useState(null);

  // Recupera dados do profissional (Simulado ou via LocalStorage após login)
  const profissional = JSON.parse(localStorage.getItem('user_profissional')) || {
    id: 1,
    nome: 'Profissional logado',
    esp_id: 1,
    esp_nome: 'Especialidade'
  };

  const API_URL = 'http://localhost:3005/api';

  useEffect(() => {
    fetchDados();
  }, []);

  const fetchDados = async () => {
    try {
      setLoading(true);
      // Busca Alunos e Agenda simultaneamente
      const [resAlunos, resAgenda] = await Promise.all([
        fetch(`${API_URL}/alunos/por-especialidade/${profissional.esp_id}`),
        fetch(`${API_URL}/agenda/${profissional.id}`)
      ]);

      const dataAlunos = await resAlunos.json();
      const dataAgenda = await resAgenda.json();

      setAlunos(dataAlunos);
      setAgenda(dataAgenda);
    } catch (err) {
      console.error("Erro ao carregar dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  // --- AÇÃO: SALVAR ATENDIMENTO OU FALTA ---
  const handleSaveAtendimento = async (dadosAtendimento) => {
    try {
      const response = await fetch(`${API_URL}/atendimentos/registrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...dadosAtendimento,
          profissional_id: profissional.id,
          especialidade_id: profissional.esp_id,
          especialidade_nome: profissional.esp_nome
        })
      });

      if (response.ok) {
        setIsAtendimentoOpen(false);
        fetchDados(); // Atualiza a agenda e pendências
        alert(dadosAtendimento.status === 'Atendido' ? "Atendimento registado!" : "Falta registada na auditoria.");
      }
    } catch (err) {
      alert("Erro ao salvar: " + err.message);
    }
  };

  // --- AÇÃO: SALVAR NOVO AGENDAMENTO ---
  const handleSaveAgendamento = async (dadosAgendamento) => {
    try {
      const response = await fetch(`${API_URL}/agendamentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...dadosAgendamento,
          profissional_id: profissional.id
        })
      });

      if (response.ok) {
        setIsAgendamentoOpen(false);
        fetchDados();
        alert("Novo agendamento realizado com sucesso!");
      }
    } catch (err) {
      alert("Erro ao agendar: " + err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token_profissional');
    localStorage.removeItem('user_profissional');
    window.location.href = '/login';
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      
      {/* PAINEL PRINCIPAL (ESQUERDA) */}
      <main className="flex-1 flex flex-col p-8 overflow-hidden">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tighter uppercase italic">
              AEE <span className="text-blue-600">Saúde</span>
            </h1>
            <p className="text-slate-400 font-bold text-sm">Painel de {profissional.esp_nome} | Dr(a). {profissional.nome}</p>
          </div>
          <button 
            onClick={handleLogout}
            className="px-6 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500 hover:border-red-100 transition-all"
          >
            Sair
          </button>
        </header>

        <div className="flex-1 bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden flex flex-col">
          <div className="p-8 border-b border-slate-50 flex justify-between items-center">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Meus Alunos Cadastrados</h2>
          </div>
          
          <div className="flex-1 overflow-auto p-4">
             <DataTable 
               data={alunos} 
               columns={[
                 { key: 'id', label: 'ID' },
                 { key: 'nome_completo', label: 'Nome' },
                 { key: 'escola', label: 'Escola' },
                 { key: 'ra', label: 'RA' }
               ]} 
             />
          </div>
        </div>
      </main>

      {/* BARRA LATERAL (DIREITA) */}
      <aside className="w-[400px] bg-white border-l border-slate-100 flex flex-col p-8 shadow-2xl z-10 overflow-y-auto">
        
        {/* ALERTAS DE PENDÊNCIA (RETROATIVOS) */}
        {agenda.pendentes.length > 0 && (
          <div className="mb-10 animate-pulse">
            <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-amber-500 rounded-full"></span> Pendências de Registro
            </h3>
            <div className="space-y-3">
              {agenda.pendentes.map(p => (
                <div key={p.id} className="p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                  <p className="text-[9px] font-bold text-amber-600 mb-1">{new Date(p.data_hora).toLocaleDateString()}</p>
                  <p className="text-sm font-black text-slate-700 mb-3">{p.aluno_nome}</p>
                  <button 
                    onClick={() => { setSelectedAgendamento(p); setIsAtendimentoOpen(true); }}
                    className="w-full py-2 bg-white text-amber-600 text-[10px] font-black uppercase rounded-lg border border-amber-200 hover:bg-amber-600 hover:text-white transition-all"
                  >
                    Resolver Agora
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AGENDA DE HOJE */}
        <div className="flex-1">
          <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-6">Agenda de Hoje</h3>
          {agenda.hoje.length > 0 ? (
            <div className="space-y-4">
              {agenda.hoje.map(ag => (
                <div key={ag.id} className="p-5 bg-slate-50 border border-slate-100 rounded-[2rem] hover:scale-[1.02] transition-transform cursor-pointer group">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xl font-black text-slate-800">
                      {new Date(ag.data_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="px-2 py-1 bg-green-100 text-green-600 text-[9px] font-black rounded-md uppercase tracking-tighter">Confirmado</span>
                  </div>
                  <p className="text-sm font-bold text-slate-500 mb-4">{ag.aluno_nome}</p>
                  <button 
                    onClick={() => { setSelectedAgendamento(ag); setIsAtendimentoOpen(true); }}
                    className="w-full py-4 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-blue-100 group-hover:bg-slate-900 transition-colors"
                  >
                    Atender
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-40 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-3xl text-slate-300">
              <span className="text-3xl mb-2">☕</span>
              <p className="text-[10px] font-black uppercase">Fila vazia</p>
            </div>
          )}
        </div>

        {/* BOTÃO AGENDAR NOVO */}
        <button 
          onClick={() => setIsAgendamentoOpen(true)}
          className="mt-8 w-full py-5 border-2 border-slate-800 text-slate-800 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] hover:bg-slate-800 hover:text-white transition-all"
        >
          + Novo Agendamento
        </button>
      </aside>

      {/* MODAIS INTEGRADOS */}
      <AtendimentoModal 
        isOpen={isAtendimentoOpen} 
        onClose={() => setIsAtendimentoOpen(false)} 
        agendamento={selectedAgendamento}
        onSave={handleSaveAtendimento}
      />

      <AgendamentoModal 
        isOpen={isAgendamentoOpen} 
        onClose={() => setIsAgendamentoOpen(false)} 
        alunos={alunos}
        onSave={handleSaveAgendamento}
      />

    </div>
  );
};

export default ProfissionalDashboard;