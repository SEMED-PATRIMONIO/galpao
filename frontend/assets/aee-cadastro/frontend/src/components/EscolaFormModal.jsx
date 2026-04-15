import React, { useState, useEffect } from 'react';

const EscolaFormModal = ({ isOpen, onClose, onSave, escolaInicial }) => {
  const [formData, setFormData] = useState({ nome: '' });

  useEffect(() => {
    setFormData({ nome: escolaInicial ? escolaInicial.nome || '' : '' });
  }, [escolaInicial, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden">

        {/* CABEÇALHO ✅ rótulos atualizados */}
        <div className="bg-cyan-600 px-10 py-8 text-white relative">
          <h2 className="text-2xl font-black uppercase tracking-tighter">
            {escolaInicial ? '📝 Editar Estabelecimento' : '➕ Novo Estabelecimento'}
          </h2>
          <p className="text-cyan-100 text-xs font-bold uppercase tracking-widest mt-1">
            Estabelecimentos de Atendimento
          </p>
          <button
            onClick={onClose}
            className="absolute top-8 right-8 w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          >
            ✕
          </button>
        </div>

        {/* FORMULÁRIO */}
        <form onSubmit={handleSubmit} className="p-10 space-y-6">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
              Nome do Estabelecimento
            </label>
            <input
              type="text"
              required
              className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-cyan-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700"
              value={formData.nome}
              onChange={(e) => setFormData({ nome: e.target.value })}
              placeholder="Ex: EMEF Professor João da Silva"
            />
          </div>

          {/* BOTÕES */}
          <div className="pt-6 flex gap-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-400 bg-slate-100 hover:bg-slate-200 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-[2] py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-white bg-cyan-600 hover:bg-cyan-700 shadow-lg shadow-cyan-200 transition-all active:scale-95"
            >
              {escolaInicial ? 'Salvar Alterações' : 'Cadastrar Estabelecimento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EscolaFormModal;