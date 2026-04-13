import React, { useState, useEffect } from 'react';

const AtendimentoModal = ({ isOpen, onClose, agendamento, onSave }) => {
  const [evolucao, setEvolucao] = useState('');
  const [obsClinica, setObsClinica] = useState('');
  const [loading, setLoading] = useState(false);

  // Limpa os campos ao abrir para um novo agendamento
  useEffect(() => {
    if (isOpen) {
      setEvolucao('');
      setObsClinica('');
    }
  }, [isOpen, agendamento]);

  if (!isOpen || !agendamento) return null;

  const handleConfirmarAtendimento = async () => {
    if (!evolucao.trim()) {
      alert("Por favor, descreva a evolução do atendimento.");
      return;
    }
    
    setLoading(true);
    await onSave({
      agendamento_id: agendamento.id,
      aluno_id: agendamento.aluno_id,
      status: 'Atendido',
      evolucao: evolucao,
      obs_clinica: obsClinica
    });
    setLoading(false);
  };

  const handleRegistrarFalta = async () => {
    if (window.confirm(`Confirmar que o aluno ${agendamento.aluno_nome} não compareceu? Esta ação será registada na auditoria.`)) {
      setLoading(true);
      await onSave({
        agendamento_id: agendamento.id,
        aluno_id: agendamento.aluno_id,
        status: 'Não Compareceu',
        evolucao: 'ALUNO AUSENTE',
        obs_clinica: 'Registado via painel de não comparecimento.'
      });
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header com Identificação do Aluno */}
        <header className="bg-blue-600 p-6 text-white">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-blue-100 text-[10px] font-black uppercase tracking-widest mb-1">Atendimento em Curso</p>
              <h2 className="text-2xl font-black tracking-tight">{agendamento.aluno_nome}</h2>
            </div>
            <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
              <span className="text-2xl">✕</span>
            </button>
          </div>
        </header>

        <div className="p-8 space-y-6">
          {/* Campo de Evolução (Obrigatório para Atendimento) */}
          <div>
            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">
              Evolução do Atendimento / Relatório 📝
            </label>
            <textarea
              className="w-full h-40 p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white transition-all outline-none text-slate-700 font-medium resize-none"
              placeholder="Descreva aqui o desenvolvimento da sessão, avanços observados e atividades realizadas..."
              value={evolucao}
              onChange={(e) => setEvolucao(e.target.value)}
            ></textarea>
          </div>

          {/* Campo de Observação Clínica (Opcional) */}
          <div>
            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">
              Observações Internas / Próximos Passos 🔍
            </label>
            <input
              type="text"
              className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white transition-all outline-none text-slate-700 font-medium"
              placeholder="Ex: Necessário conversar com os pais sobre o medicamento..."
              value={obsClinica}
              onChange={(e) => setObsClinica(e.target.value)}
            />
          </div>
        </div>

        {/* Footer com Ações Distintas */}
        <footer className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
          <button
            type="button"
            onClick={handleRegistrarFalta}
            disabled={loading}
            className="text-red-500 font-black text-[11px] uppercase tracking-widest hover:bg-red-50 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            ❌ Aluno Não Compareceu
          </button>

          <div className="flex gap-4 w-full sm:w-auto">
            <button 
              onClick={onClose}
              className="flex-1 sm:flex-none px-6 py-3 text-slate-400 font-bold text-xs uppercase hover:text-slate-600 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmarAtendimento}
              disabled={loading}
              className="flex-1 sm:flex-none px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-100 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? 'A Gravar...' : 'Finalizar Atendimento ✓'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default AtendimentoModal;