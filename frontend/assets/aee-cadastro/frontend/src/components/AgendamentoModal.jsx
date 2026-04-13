import React, { useState } from 'react';

const AgendamentoModal = ({ isOpen, onClose, alunos, onSave }) => {
  const [agendamento, setAgendamento] = useState({
    aluno_id: '',
    data: '',
    hora: '',
    observacoes: ''
  });

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!agendamento.aluno_id || !agendamento.data || !agendamento.hora) {
      alert("Por favor, preencha o aluno, a data e o horário.");
      return;
    }

    // Combina data e hora para o formato ISO do Postgres
    const dataHora = `${agendamento.data}T${agendamento.hora}:00`;
    
    onSave({
      aluno_id: agendamento.aluno_id,
      data_hora: dataHora,
      observacoes: agendamento.observacoes
    });
    
    // Reseta o form
    setAgendamento({ aluno_id: '', data: '', hora: '', observacoes: '' });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        
        <header className="bg-slate-800 p-6 text-white">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Planeamento</p>
              <h2 className="text-xl font-black tracking-tight">Novo Agendamento</h2>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors text-2xl">✕</button>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          {/* Seleção de Aluno */}
          <div>
            <label className="block text-[11px] font-black text-slate-400 uppercase mb-2">Selecionar Aluno</label>
            <select 
              className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-500 outline-none font-bold text-slate-700"
              value={agendamento.aluno_id}
              onChange={(e) => setAgendamento({...agendamento, aluno_id: e.target.value})}
            >
              <option value="">Escolha um aluno da lista...</option>
              {alunos.map(aluno => (
                <option key={aluno.id} value={aluno.id}>{aluno.nome_completo}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Data */}
            <div>
              <label className="block text-[11px] font-black text-slate-400 uppercase mb-2">Data</label>
              <input 
                type="date" 
                className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-500 outline-none font-bold text-slate-700"
                value={agendamento.data}
                onChange={(e) => setAgendamento({...agendamento, data: e.target.value})}
              />
            </div>
            {/* Hora */}
            <div>
              <label className="block text-[11px] font-black text-slate-400 uppercase mb-2">Horário</label>
              <input 
                type="time" 
                className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-500 outline-none font-bold text-slate-700"
                value={agendamento.hora}
                onChange={(e) => setAgendamento({...agendamento, hora: e.target.value})}
              />
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-[11px] font-black text-slate-400 uppercase mb-2">Notas do Agendamento (Opcional)</label>
            <textarea 
              className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-500 outline-none font-medium text-slate-700 h-24 resize-none"
              placeholder="Ex: Primeira consulta de avaliação..."
              value={agendamento.observacoes}
              onChange={(e) => setAgendamento({...agendamento, observacoes: e.target.value})}
            />
          </div>

          <button 
            type="submit"
            className="w-full py-4 bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-blue-600 transition-all active:scale-95"
          >
            Confirmar Agendamento 📅
          </button>
        </form>
      </div>
    </div>
  );
};

export default AgendamentoModal;