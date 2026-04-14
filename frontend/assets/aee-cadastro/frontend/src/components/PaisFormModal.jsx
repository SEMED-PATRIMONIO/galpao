import React, { useState, useEffect } from 'react';

const PaisFormModal = ({ isOpen, onClose, onSave, paisInicial, listaAlunos = [] }) => {
  const [formData, setFormData] = useState({
    usuario: '',
    senha_pin: '',
    aluno_id: ''
  });

  useEffect(() => {
    if (paisInicial) {
      setFormData({
        usuario: paisInicial.usuario || '',
        senha_pin: '',
        aluno_id: paisInicial.aluno_id || ''
      });
    } else {
      setFormData({
        usuario: '',
        senha_pin: '',
        aluno_id: ''
      });
    }
  }, [paisInicial, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();

    const dadosParaSalvar = { ...formData };

    // Converte aluno_id para inteiro
    if (dadosParaSalvar.aluno_id) {
      dadosParaSalvar.aluno_id = parseInt(dadosParaSalvar.aluno_id);
    } else {
      dadosParaSalvar.aluno_id = null;
    }

    // Se é edição e não digitou pin, não envia (mantém o atual)
    if (paisInicial && !dadosParaSalvar.senha_pin) {
      delete dadosParaSalvar.senha_pin;
    }

    onSave(dadosParaSalvar);
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden">

        {/* CABEÇALHO */}
        <div className="bg-emerald-600 px-10 py-8 text-white relative">
          <h2 className="text-2xl font-black uppercase tracking-tighter">
            {paisInicial ? '📝 Editar Pai/Responsável' : '➕ Novo Pai/Responsável'}
          </h2>
          <p className="text-emerald-100 text-xs font-bold uppercase tracking-widest mt-1">
            Acesso ao portal dos pais (aee_usuarios_pais)
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

            {/* USUÁRIO */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                Nome de Usuário
              </label>
              <input
                type="text"
                required
                className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700"
                value={formData.usuario}
                onChange={(e) => setFormData({ ...formData, usuario: e.target.value })}
                placeholder="Ex: pai.joao"
              />
            </div>

            {/* SENHA PIN (5 dígitos) */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                {paisInicial ? 'Novo PIN (deixe vazio para manter)' : 'PIN de Acesso (5 dígitos)'}
              </label>
              <input
                type="text"
                maxLength={5}
                required={!paisInicial}
                className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700 text-center tracking-[0.5em] text-2xl"
                value={formData.senha_pin}
                onChange={(e) => setFormData({ ...formData, senha_pin: e.target.value.replace(/\D/g, '').slice(0, 5) })}
                placeholder="• • • • •"
              />
            </div>

            {/* ALUNO VINCULADO */}
            <div className="col-span-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                Aluno Vinculado
              </label>
              <select
                required
                className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700 appearance-none"
                value={formData.aluno_id}
                onChange={(e) => setFormData({ ...formData, aluno_id: e.target.value })}
              >
                <option value="">Selecione o Aluno</option>
                {listaAlunos.map((aluno) => (
                  <option key={aluno.id} value={aluno.id}>
                    {aluno.nome_completo} (RA: {aluno.ra})
                  </option>
                ))}
              </select>
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
              className="flex-[2] py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all active:scale-95"
            >
              {paisInicial ? 'Salvar Alterações' : 'Cadastrar Responsável'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaisFormModal;