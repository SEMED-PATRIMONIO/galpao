import React, { useState, useEffect } from 'react';

const EspecialidadeFormModal = ({ isOpen, onClose, onSave, especialidadeInicial }) => {
  const [nome, setNome] = useState('');

  // Sincroniza o estado interno com o registro selecionado para edição
  useEffect(() => {
    if (isOpen) {
      setNome(especialidadeInicial ? especialidadeInicial.nome : '');
    }
  }, [especialidadeInicial, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in duration-200 border-4 border-purple-50">
        
        <header className="bg-purple-600 p-6 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold italic tracking-tight">
              {especialidadeInicial ? '🛠️ Editar Especialidade' : '🧬 Nova Especialidade'}
            </h2>
            <p className="text-purple-100 text-xs mt-1 font-medium">Gestão de áreas de atendimento clínico</p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white text-2xl transition-transform hover:scale-110">✕</button>
        </header>

        <div className="p-8 bg-purple-50/20">
          <label className="block text-xs font-black text-slate-400 uppercase mb-2 tracking-widest ml-1">
            Nome da Especialidade
          </label>
          <input 
            type="text" 
            className="w-full p-4 border-2 border-purple-100 rounded-2xl outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 transition-all font-bold text-slate-700 bg-white"
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder="Ex: Fonoaudiologia, Psicologia..."
          />
          <p className="text-[10px] text-slate-400 mt-3 px-1 italic">
            * Este nome aparecerá como opção no cadastro de alunos e profissionais.
          </p>
        </div>

        <footer className="p-6 bg-white border-t border-slate-100 flex justify-end gap-4">
          <button 
            onClick={onClose} 
            className="text-slate-400 font-bold hover:text-slate-600 uppercase text-xs tracking-widest"
          >
            Cancelar
          </button>
          <button 
            onClick={() => onSave({ ...especialidadeInicial, nome })}
            disabled={!nome.trim()}
            className="bg-purple-600 text-white px-8 py-3 rounded-xl font-black shadow-lg shadow-purple-200 hover:bg-purple-700 active:scale-95 disabled:opacity-50 transition-all uppercase text-sm"
          >
            {especialidadeInicial ? 'Salvar Alterações 💾' : 'Gravar Especialidade 🚀'}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default EspecialidadeFormModal;