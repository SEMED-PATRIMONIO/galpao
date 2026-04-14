import React, { useState, useEffect } from 'react';

const EspecialidadeFormModal = ({ isOpen, onClose, onSave, dadosIniciais }) => {
  // Estado local para o campo 'nome' (conforme a tabela aee_especialidades)
  const [formData, setFormData] = useState({
    nome: ''
  });

  // Sincroniza o formulário quando o modal abre ou quando mudamos o item para editar
  useEffect(() => {
    if (dadosIniciais) {
      setFormData({
        nome: dadosIniciais.nome || ''
      });
    } else {
      setFormData({
        nome: ''
      });
    }
  }, [dadosIniciais, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    // Envia os dados para a função handleSave do Dashboard
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* CABEÇALHO - Estilo Roxo/Indigo para diferenciar de Alunos */}
        <div className="bg-indigo-600 px-10 py-8 text-white relative">
          <h2 className="text-2xl font-black uppercase tracking-tighter">
            {dadosIniciais ? '📝 Editar Especialidade' : '➕ Nova Especialidade'}
          </h2>
          <p className="text-indigo-100 text-[10px] font-bold uppercase tracking-widest mt-1">
            Configuração de Áreas de Atendimento
          </p>
          <button 
            onClick={onClose}
            className="absolute top-8 right-8 w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          >
            ✕
          </button>
        </div>

        {/* FORMULÁRIO */}
        <form onSubmit={handleSubmit} className="p-10 space-y-8">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">
              Nome da Especialidade / Disciplina
            </label>
            <input
              type="text"
              required
              autoFocus
              className="w-full px-6 py-5 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300 shadow-inner"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Ex: Fonoaudiologia, Psicopedagogia..."
            />
          </div>

          <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
            <p className="text-[10px] text-indigo-700 font-bold leading-relaxed">
              <span className="mr-2">💡</span>
              Ao salvar, esta especialidade ficará disponível imediatamente para ser vinculada aos profissionais e agendamentos.
            </p>
          </div>

          {/* BOTÕES DE AÇÃO */}
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-400 bg-slate-100 hover:bg-slate-200 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-[2] py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95"
            >
              {dadosIniciais ? 'Atualizar Dados' : 'Criar Especialidade'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EspecialidadeFormModal;