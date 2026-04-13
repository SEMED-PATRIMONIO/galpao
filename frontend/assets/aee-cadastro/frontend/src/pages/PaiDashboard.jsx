import React, { useState, useEffect } from 'react';

const PaiDashboard = () => {
  const [avisos, setAvisos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAlerta, setShowAlerta] = useState(false);

  // Recupera dados do pai logado
  const pai = JSON.parse(localStorage.getItem('user_pai')) || {
    id: 0,
    aluno_id: 0,
    nome: 'Responsável'
  };

  const API_URL = 'http://localhost:3006/api/pais';

  useEffect(() => {
    fetchAvisos();
  }, []);

  const fetchAvisos = async () => {
    try {
      const res = await fetch(`${API_URL}/avisos/${pai.aluno_id}`);
      const data = await res.json();
      setAvisos(data);
      // Se houver agendamentos com status 'Agendado', abre o alerta visual
      if (data.length > 0) {
        setShowAlerta(true);
      }
    } catch (err) {
      console.error("Erro ao carregar avisos:", err);
    } finally {
      setLoading(false);
    }
  };

  const confirmarCiencia = async (agendamento) => {
    try {
      const res = await fetch(`${API_URL}/confirmar-leitura`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agendamento_id: agendamento.id,
          aluno_id: pai.aluno_id,
          especialidade_id: agendamento.especialidade_id,
          especialidade_nome: agendamento.especialidade_nome,
          data_hora: agendamento.data_hora
        })
      });

      if (res.ok) {
        // Remove da lista local e fecha o alerta se não houver mais
        const novosAvisos = avisos.filter(a => a.id !== agendamento.id);
        setAvisos(novosAvisos);
        if (novosAvisos.length === 0) setShowAlerta(false);
        alert("Sua ciência foi registrada. Obrigado!");
      }
    } catch (err) {
      alert("Erro ao confirmar leitura.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Header Minimalista */}
      <header className="bg-white border-b border-slate-100 p-6 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-black text-slate-800 uppercase tracking-tighter italic">
            AEE <span className="text-blue-600">Família</span>
          </h1>
          <p className="text-slate-400 text-xs font-bold">Olá, {pai.nome}</p>
        </div>
        <button className="text-[10px] font-black uppercase text-slate-400 border border-slate-100 px-4 py-2 rounded-lg hover:bg-red-50 hover:text-red-500 transition-all">
          Sair
        </button>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        {/* Seção de Boas-vindas */}
        <section className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2.5rem] p-8 text-white shadow-xl shadow-blue-100 mb-8">
          <h2 className="text-3xl font-black mb-2">Portal do Responsável</h2>
          <p className="text-blue-100 font-medium opacity-80">Acompanhe aqui os agendamentos e atendimentos do seu filho(a).</p>
        </section>

        {/* ALERTA VISUAL (MOSTRADO SE HOUVER AGENDAMENTOS NÃO CONFIRMADOS) */}
        {showAlerta && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[500] p-4">
            <div className="bg-white rounded-[3rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in duration-300">
              <div className="bg-amber-400 p-8 text-center">
                <span className="text-5xl">🔔</span>
                <h3 className="text-2xl font-black text-slate-900 mt-4 uppercase tracking-tighter">Novo Agendamento!</h3>
                <p className="text-amber-900 font-bold text-sm">Você precisa confirmar que visualizou esta data.</p>
              </div>
              
              <div className="p-8">
                {avisos.map(aviso => (
                  <div key={aviso.id} className="bg-slate-50 border-2 border-slate-100 rounded-3xl p-6 mb-4">
                    <div className="flex justify-between items-start mb-4">
                      <span className="bg-blue-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase">
                        {aviso.especialidade_nome}
                      </span>
                      <span className="text-slate-400 font-black text-xs uppercase tracking-widest">Aviso Importante</span>
                    </div>
                    
                    <p className="text-3xl font-black text-slate-800 mb-2">
                      {new Date(aviso.data_hora).toLocaleDateString()} às {new Date(aviso.data_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    
                    <p className="text-slate-500 font-bold mb-6 italic">
                      Profissional: <span className="text-slate-700">{aviso.profissional_nome}</span>
                    </p>

                    <button 
                      onClick={() => confirmarCiencia(aviso)}
                      className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg hover:bg-blue-600 transition-all active:scale-95"
                    >
                      Entendido, Estaremos Lá ✓
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Histórico Simples ou Mensagem de Tudo em Dia */}
        {!showAlerta && (
          <div className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-slate-200">
             <span className="text-5xl mb-4 block">👍</span>
             <h3 className="text-slate-400 font-black uppercase tracking-widest">Nenhuma pendência</h3>
             <p className="text-slate-300 text-sm">Você está em dia com todos os agendamentos.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default PaiDashboard;