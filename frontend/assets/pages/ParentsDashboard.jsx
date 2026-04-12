// /var/www/aee-cadastro/frontend/src/pages/ParentsDashboard.jsx
import React, { useState, useEffect } from 'react';

const ParentsDashboard = ({ user }) => {
  const [alertas, setAlertas] = useState([]);
  const [view, setView] = useState('home'); // home, atendimentos, agendamentos

  // Efeito para buscar alertas assim que logar
  useEffect(() => {
    const checkAlerts = async () => {
      const res = await fetch(`/api/pais/alertas/${user.aluno_id}`);
      const data = await res.json();
      setAlertas(data);
    };
    checkAlerts();
  }, [user.aluno_id]);

  // Função para dar "Ciente" e fechar o alerta
  const confirmarCiencia = async (agendamento) => {
    await fetch('/api/pais/confirmar-ciencia', {
      method: 'POST',
      body: JSON.stringify({
        paiId: user.id,
        alunoId: user.aluno_id,
        agendamentoId: agendamento.id,
        detalhes: `Data: ${agendamento.data_hora}`
      })
    });
    setAlertas(alertas.filter(a => a.id !== agendamento.id));
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Alerta Centralizado (Bloqueante) */}
      {alertas.length > 0 && (
        <div className="fixed inset-0 bg-blue-900/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center border-t-8 border-blue-600">
            <h2 className="text-2xl font-bold text-slate-800 mb-4">Novo Agendamento! 📅</h2>
            <p className="text-slate-600 mb-6">
              Existe um novo agendamento para seu filho em: <br/>
              <strong>{new Date(alertas[0].data_hora).toLocaleString()}</strong>
            </p>
            <button 
              onClick={() => confirmarCiencia(alertas[0])}
              className="w-full py-4 bg-blue-600 text-white rounded-xl font-black text-lg hover:bg-blue-700 transition-all"
            >
              ESTOU CIENTE E VOU COMPARECER
            </button>
          </div>
        </div>
      )}

      {/* Cabeçalho com Logo */}
      <header className="bg-white p-4 shadow-sm flex justify-between items-center border-b border-blue-100">
        <img src="/assets/logap.png" alt="Logo" className="h-10" />
        <span className="text-blue-900 font-bold">Olá, {user.nome_pai}</span>
      </header>

      {/* Menu Principal (Botões Grandes) */}
      <main className="flex-1 p-6 space-y-4 max-w-2xl mx-auto w-full">
        <button 
          onClick={() => setView('atendimentos')}
          className="w-full bg-white p-6 rounded-2xl shadow-md flex items-center border border-blue-50 hover:bg-blue-50 transition-colors"
        >
          <span className="text-3xl mr-4">👨‍⚕️</span>
          <div className="text-left">
            <h3 className="font-bold text-blue-900">Evolução e Observações Médicas</h3>
            <p className="text-xs text-slate-500">Veja o que os especialistas registraram sobre seu filho</p>
          </div>
        </button>

        <button 
          onClick={() => setView('agendamentos')}
          className="w-full bg-white p-6 rounded-2xl shadow-md flex items-center border border-blue-50 hover:bg-blue-50 transition-colors"
        >
          <span className="text-3xl mr-4">📅</span>
          <div className="text-left">
            <h3 className="font-bold text-blue-900">Histórico de Agendamentos</h3>
            <p className="text-xs text-slate-500">Consulte datas passadas e futuras</p>
          </div>
        </button>

        {/* Listagens Dinâmicas baseadas no botão clicado */}
        <section className="mt-8">
           {/* Aqui entram as tabelas de aee_atendimentos ou aee_agendamentos */}
        </section>
      </main>
    </div>
  );
};