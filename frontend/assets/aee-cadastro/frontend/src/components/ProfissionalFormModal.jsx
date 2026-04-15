import React, { useState, useEffect } from 'react';

const ProfissionalFormModal = ({ isOpen, onClose, onSave, profissionalInicial, listaEspecialidades = [] }) => {
  const [formData, setFormData] = useState({
    nome: '',
    login: '',
    senha: '',
    especialidades_ids: []
  });

  useEffect(() => {
    if (profissionalInicial) {
      let esps = [];
      if (Array.isArray(profissionalInicial.especialidades_ids)) {
        esps = profissionalInicial.especialidades_ids;
      } else if (profissionalInicial.especialidade_id) {
        esps = [profissionalInicial.especialidade_id];
      }
      setFormData({
        nome: profissionalInicial.nome || '',
        login: profissionalInicial.login || '',
        senha: '',
        especialidades_ids: esps
      });
    } else {
      setFormData({
        nome: '',
        login: '',
        senha: '',
        especialidades_ids: []
      });
    }
  }, [profissionalInicial, isOpen]);

  if (!isOpen) return null;

  const toggleEspecialidade = (id) => {
    setFormData((prev) => {
      const jaTemp = prev.especialidades_ids.includes(id);
      return {
        ...prev,
        especialidades_ids: jaTemp
          ? prev.especialidades_ids.filter((e) => e !== id)
          : [...prev.especialidades_ids, id]
      };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const dadosParaSalvar = {
      nome: formData.nome,
      login: formData.login,
    };

    // Envia senha em texto plano - o backend faz o hash
    if (formData.senha && formData.senha.trim() !== '') {
      dadosParaSalvar.senha = formData.senha;
    }

    // Usa o primeiro id selecionado para especialidade_id
    dadosParaSalvar.especialidade_id = formData.especialidades_ids.length > 0
      ? formData.especialidades_ids[0]
      : null;

    onSave(dadosParaSalvar);
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">

        {/* CABEÇALHO */}
        <div className="bg-teal-600 px-10 py-8 text-white relative shrink-0">
          <h2 className="text-2xl font-black uppercase tracking-tighter">
            {profissionalInicial ? '📝 Editar Profissional' : '➕ Novo Profissional de Saúde'}
          </h2>
          <p className="text-teal-100 text-xs font-bold uppercase tracking-widest mt-1">
            Profissionais de Saúde
          </p>
          <button
            onClick={onClose}
            className="absolute top-8 right-8 w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          >
            ✕
          </button>
        </div>

        {/* FORMULÁRIO */}
        <form onSubmit={handleSubmit} className="p-10 space-y-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-6">

            {/* NOME */}
            <div className="col-span-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                Nome Completo
              </label>
              <input
                type="text"
                required
                className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-teal-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Dr. Carlos Andrade"
              />
            </div>

            {/* LOGIN */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                Login de Acesso
              </label>
              <input
                type="text"
                required
                className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-teal-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700"
                value={formData.login}
                onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                placeholder="Ex: dr.carlos"
              />
            </div>

            {/* SENHA */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                {profissionalInicial ? 'Nova Senha (vazio = manter)' : 'Senha'}
              </label>
              <input
                type="password"
                required={!profissionalInicial}
                className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-teal-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700"
                value={formData.senha}
                onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                placeholder="••••••••"
              />
            </div>

            {/* ESPECIALIDADES COM CHECKBOXES */}
            <div className="col-span-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">
                Especialidade(s) de Atuação
              </label>

              {listaEspecialidades.length === 0 ? (
                <p className="text-slate-400 text-xs font-medium italic px-2">
                  Nenhuma especialidade cadastrada.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {listaEspecialidades.map((esp) => {
                    const selecionada = formData.especialidades_ids.includes(esp.id);
                    return (
                      <button
                        key={esp.id}
                        type="button"
                        onClick={() => toggleEspecialidade(esp.id)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 font-bold text-xs transition-all text-left
                          ${selecionada
                            ? 'bg-teal-600 border-teal-600 text-white shadow-md shadow-teal-200'
                            : 'bg-slate-50 border-slate-100 text-slate-600 hover:border-teal-300 hover:bg-teal-50'
                          }`}
                      >
                        <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all
                          ${selecionada
                            ? 'bg-white border-white'
                            : 'border-slate-300 bg-white'
                          }`}
                        >
                          {selecionada && (
                            <svg className="w-3 h-3 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                        {esp.nome}
                      </button>
                    );
                  })}
                </div>
              )}

              {formData.especialidades_ids.length > 0 && (
                <p className="text-[10px] font-black text-teal-500 uppercase tracking-widest mt-3 ml-1">
                  {formData.especialidades_ids.length} especialidade(s) selecionada(s)
                </p>
              )}
            </div>
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
              className="flex-[2] py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-white bg-teal-600 hover:bg-teal-700 shadow-lg shadow-teal-200 transition-all active:scale-95"
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