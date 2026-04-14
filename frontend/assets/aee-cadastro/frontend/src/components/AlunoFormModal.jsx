import React, { useState, useEffect } from 'react';

const AlunoFormModal = ({ isOpen, onClose, onSave, alunoInicial, listaEscolas = [] }) => {
  // Estado inicial do formulário seguindo a estrutura do seu Postgres
  const [formData, setFormData] = useState({
    nome_completo: '',
    ra: '',
    data_nascimento: '',
    escola: ''
  });

  // Sempre que o modal abrir ou o aluno selecionado mudar, atualizamos os campos
  useEffect(() => {
    if (alunoInicial) {
      // Se for edição, preenchemos com os dados vindos do banco
      setFormData({
        nome_completo: alunoInicial.nome_completo || '',
        ra: alunoInicial.ra || '',
        data_nascimento: alunoInicial.data_nascimento ? alunoInicial.data_nascimento.split('T')[0] : '',
        escola: alunoInicial.escola || ''
      });
    } else {
      // Se for inclusão, limpamos o formulário
      setFormData({
        nome_completo: '',
        ra: '',
        data_nascimento: '',
        escola: ''
      });
    }
  }, [alunoInicial, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* CABEÇALHO */}
        <div className="bg-blue-600 px-10 py-8 text-white relative">
          <h2 className="text-2xl font-black uppercase tracking-tighter">
            {alunoInicial ? '📝 Editar Aluno' : '➕ Novo Cadastro'}
          </h2>
          <p className="text-blue-100 text-xs font-bold uppercase tracking-widest mt-1">
            Informações do Aluno (Tabela aee_alunos)
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
                Nome Completo do Aluno
              </label>
              <input
                type="text"
                required
                className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700"
                value={formData.nome_completo}
                onChange={(e) => setFormData({ ...formData, nome_completo: e.target.value })}
                placeholder="Ex: João Silva de Oliveira"
              />
            </div>

            {/* RA */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                RA (Registro do Aluno)
              </label>
              <input
                type="text"
                required
                className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700"
                value={formData.ra}
                onChange={(e) => setFormData({ ...formData, ra: e.target.value })}
                placeholder="000.000.000-0"
              />
            </div>

            {/* DATA DE NASCIMENTO */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                Data de Nascimento
              </label>
              <input
                type="date"
                required
                className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700"
                value={formData.data_nascimento}
                onChange={(e) => setFormData({ ...formData, data_nascimento: e.target.value })}
              />
            </div>

            {/* UNIDADE ESCOLAR */}
            <div className="col-span-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                Unidade Escolar Atual
              </label>
              <select
                required
                className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700 appearance-none"
                value={formData.escola}
                onChange={(e) => setFormData({ ...formData, escola: e.target.value })}
              >
                <option value="">Selecione a Escola</option>
                {listaEscolas.map((esc) => (
                  <option key={esc.id} value={esc.nome}>{esc.nome}</option>
                ))}
                {/* Fallback caso a lista de escolas falhe */}
                {!listaEscolas.length && <option value={formData.escola}>{formData.escola || 'Carregando...'}</option>}
              </select>
            </div>
          </div>

          {/* RODAPÉ E BOTÕES */}
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
              className="flex-[2] py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95"
            >
              {alunoInicial ? 'Salvar Alterações' : 'Confirmar Cadastro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AlunoFormModal;