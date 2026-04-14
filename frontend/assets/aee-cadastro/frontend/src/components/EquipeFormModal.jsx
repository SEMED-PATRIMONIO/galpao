import React, { useState, useEffect } from 'react';
import bcryptjs from 'bcryptjs';

const EquipeFormModal = ({ isOpen, onClose, onSave, usuarioInicial, listaEspecialidades = [] }) => {
  const [formData, setFormData] = useState({
    nome: '',
    login: '',
    senha: '',
    especialidade_id: ''
  });

  useEffect(() => {
    if (usuarioInicial) {
      setFormData({
        nome: usuarioInicial.nome || '',
        login: usuarioInicial.login || '',
        senha: '',
        especialidade_id: usuarioInicial.especialidade_id || ''
      });
    } else {
      setFormData({
        nome: '',
        login: '',
        senha: '',
        especialidade_id: ''
      });
    }
  }, [usuarioInicial, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    const dadosParaSalvar = { ...formData };

    // Se senha foi preenchida, faz hash antes de enviar
    if (dadosParaSalvar.senha && dadosParaSalvar.senha.trim() !== '') {
      const salt = await bcryptjs.genSalt(10);
      dadosParaSalvar.senha_hash = await bcryptjs.hash(dadosParaSalvar.senha, salt);
    }
    // Remove o campo 'senha' (o banco usa 'senha_hash')
    delete dadosParaSalvar.senha;

    // Se é edição e não digitou senha, não envia senha_hash (mantém a atual)
    if (usuarioInicial && !dadosParaSalvar.senha_hash) {
      delete dadosParaSalvar.senha_hash;
    }

    // Converte especialidade_id para inteiro ou null
    if (dadosParaSalvar.especialidade_id === '' || dadosParaSalvar.especialidade_id === null) {
      dadosParaSalvar.especialidade_id = null;
    } else {
      dadosParaSalvar.especialidade_id = parseInt(dadosParaSalvar.especialidade_id);
    }

    onSave(dadosParaSalvar);
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden">
        
        {/* CABEÇALHO */}
        <div className="bg-indigo-600 px-10 py-8 text-white relative">
          <h2 className="text-2xl font-black uppercase tracking-tighter">
            {usuarioInicial ? '📝 Editar Membro da Equipe' : '➕ Novo Membro da Equipe'}
          </h2>
          <p className="text-indigo-100 text-xs font-bold uppercase tracking-widest mt-1">
            Usuários com acesso ao sistema (aee_usuarios_equipe)
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
                Nome Completo
              </label>
              <input
                type="text"
                required
                className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Maria da Silva"
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
                className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700"
                value={formData.login}
                onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                placeholder="Ex: maria.silva"
              />
            </div>

            {/* SENHA */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                {usuarioInicial ? 'Nova Senha (deixe vazio para manter)' : 'Senha'}
              </label>
              <input
                type="password"
                required={!usuarioInicial}
                className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700"
                value={formData.senha}
                onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                placeholder={usuarioInicial ? '••••••••' : 'Mínimo 5 caracteres'}
              />
            </div>

            {/* ESPECIALIDADE (OPCIONAL) */}
            <div className="col-span-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                Especialidade (Opcional)
              </label>
              <select
                className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700 appearance-none"
                value={formData.especialidade_id}
                onChange={(e) => setFormData({ ...formData, especialidade_id: e.target.value })}
              >
                <option value="">Nenhuma</option>
                {listaEspecialidades.map((esp) => (
                  <option key={esp.id} value={esp.id}>{esp.nome}</option>
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
              className="flex-[2] py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95"
            >
              {usuarioInicial ? 'Salvar Alterações' : 'Cadastrar Membro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EquipeFormModal;