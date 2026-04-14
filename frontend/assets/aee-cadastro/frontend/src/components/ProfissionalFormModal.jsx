import React, { useState, useEffect } from 'react';

const ProfissionalFormModal = ({ isOpen, onClose, onSave, profissionalInicial, listaEspecialidades = [] }) => {
  // Estado inicial baseado na tabela aee_profissionais_saude
  const [formData, setFormData] = useState({
    nome_completo: '',
    especialidade: '',
    registro_profissional: ''
  });

  // Sincronização para Edição ou Novo Cadastro
  useEffect(() => {
    if (profissionalInicial) {
      setFormData({
        nome_completo: profissionalInicial.nome_completo || '',
        especialidade: profissionalInicial.especialidade || '',
        registro_profissional: profissionalInicial.registro_profissional || ''
      });
    } else {
      setFormData({
        nome_completo: '',
        especialidade: '',
        registro_profissional: ''
      });
    }
  }, [profissionalInicial, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* CABEÇALHO - Tema Ciano/Médico */}
        <div className="bg-cyan-600 px-10 py-8 text-white relative">
          <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
            <span className="text-3xl">🩺</span> 
            {profissionalInicial ? 'Editar Profissional' : 'Novo Profissional'}
          </h2>
          <p className="text-cyan-100 text-[10px] font-bold uppercase tracking-widest mt-1">
            Gestão de Especialistas de Saúde e Apoio
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
          <div className="grid grid-cols-2 gap-6">
            
            {/* NOME COMPLETO */}
            <div className="col-span-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                Nome do Profissional
              </label>
              <input
                type="text"
                required
                className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-cyan-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700"
                value={formData.nome_completo}
                onChange={(e) => setFormData({ ...formData, nome_completo: e.target.value })}
                placeholder="Ex: Dra. Ana Paula Silveira"
              />
            </div>

            {/* ESPECIALIDADE */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                Especialidade Principal
              </label>
              <select
                required
                className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-cyan-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700 appearance-none"
                value={formData.especialidade}
                onChange={(e) => setFormData({ ...formData, especialidade: e.target.value })}
              >
                <option value="">Selecione a Área</option>
                {listaEspecialidades.map((esp) => (
                  <option key={esp.id} value={esp.nome}>{esp.nome}</option>
                ))}
                {/* Fallback para carregar valor existente caso a lista demore */}
                {!listaEspecialidades.find(e => e.nome === formData.especialidade) && formData.especialidade && (
                    <option value={formData.especialidade}>{formData.especialidade}</option>
                )}
              </select>
            </div>

            {/* REGISTRO PROFISSIONAL */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                Registro (CRM, CRP, etc)
              </label>
              <input
                type="text"
                required
                className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-cyan-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700"
                value={formData.registro_profissional}
                onChange={(e) => setFormData({ ...formData, registro_profissional: e.target.value })}
                placeholder="Ex: CRP 06/123456"
              />
            </div>
          </div>

          <div className="bg-cyan-50 p-4 rounded-2xl border border-cyan-100 flex items-start gap-3">
             <span className="text-lg">🛡️</span>
             <p className="text-[10px] text-cyan-700 font-bold leading-tight uppercase tracking-wider">
               Certifique-se de que o registro profissional esteja correto para a validade dos laudos e relatórios emitidos.
             </p>
          </div>

          {/* BOTÕES */}
          <div className="pt-4 flex gap-4">
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
              {profissionalInicial ? 'Salvar Alterações' : 'Cadastrar Profissional'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfissionalFormModal;