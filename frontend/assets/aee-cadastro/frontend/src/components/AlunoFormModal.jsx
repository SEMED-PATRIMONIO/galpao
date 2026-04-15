import React, { useState, useEffect } from 'react';

const AlunoFormModal = ({ isOpen, onClose, onSave, alunoInicial, listaEscolas = [], listaEspecialidades = [] }) => {
  const [formData, setFormData] = useState({
    nome_completo: '',
    ra: '',
    data_nascimento: '',
    escola: '',
    especialidades: []
  });

  useEffect(() => {
    if (alunoInicial) {
      // especialidades vem como jsonb do banco (array de ids ou nomes)
      let esps = [];
      if (Array.isArray(alunoInicial.especialidades)) {
        esps = alunoInicial.especialidades;
      } else if (typeof alunoInicial.especialidades === 'string') {
        try { esps = JSON.parse(alunoInicial.especialidades); } catch { esps = []; }
      }
      setFormData({
        nome_completo: alunoInicial.nome_completo || '',
        ra: alunoInicial.ra || '',
        data_nascimento: alunoInicial.data_nascimento
          ? alunoInicial.data_nascimento.split('T')[0]
          : '',
        escola: alunoInicial.escola || '',
        especialidades: esps
      });
    } else {
      setFormData({
        nome_completo: '',
        ra: '',
        data_nascimento: '',
        escola: '',
        especialidades: []
      });
    }
  }, [alunoInicial, isOpen]);

  if (!isOpen) return null;

  // ✅ Toggle de especialidade pelo ID
  const toggleEspecialidade = (id) => {
    setFormData((prev) => {
      const jaTemp = prev.especialidades.includes(id);
      return {
        ...prev,
        especialidades: jaTemp
          ? prev.especialidades.filter((e) => e !== id)
          : [...prev.especialidades, id]
      };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">

        {/* CABEÇALHO ✅ ALUNO → PACIENTE, sem texto da tabela */}
        <div className="bg-blue-600 px-10 py-8 text-white relative shrink-0">
          <h2 className="text-2xl font-black uppercase tracking-tighter">
            {alunoInicial ? '📝 Editar Paciente' : '➕ Novo Cadastro'}
          </h2>
          <p className="text-blue-100 text-xs font-bold uppercase tracking-widest mt-1">
            Informações do Paciente
          </p>
          <button
            onClick={onClose}
            className="absolute top-8 right-8 w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          >
            ✕
          </button>
        </div>

        {/* FORMULÁRIO COM SCROLL */}
        <form onSubmit={handleSubmit} className="p-10 space-y-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-6">

            {/* NOME COMPLETO */}
            <div className="col-span-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                Nome Completo do Paciente
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
                RA (Registro do Paciente)
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

            {/* ESTABELECIMENTO ✅ rótulo atualizado */}
            <div className="col-span-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                Local Onde Recebe Atendimento
              </label>
              <select
                required
                className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700 appearance-none"
                value={formData.escola}
                onChange={(e) => setFormData({ ...formData, escola: e.target.value })}
              >
                <option value="">Selecione o Estabelecimento</option>
                {listaEscolas.map((esc) => (
                  <option key={esc.id} value={esc.nome}>{esc.nome}</option>
                ))}
                {!listaEscolas.length && (
                  <option value={formData.escola}>{formData.escola || 'Carregando...'}</option>
                )}
              </select>
            </div>

            {/* ✅ ESPECIALIDADES COM CHECKBOXES */}
            <div className="col-span-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">
                Especialidades de Acompanhamento
              </label>

              {listaEspecialidades.length === 0 ? (
                <p className="text-slate-400 text-xs font-medium italic px-2">
                  Nenhuma especialidade cadastrada.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {listaEspecialidades.map((esp) => {
                    const selecionada = formData.especialidades.includes(esp.id);
                    return (
                      <button
                        key={esp.id}
                        type="button"
                        onClick={() => toggleEspecialidade(esp.id)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 font-bold text-xs transition-all text-left
                          ${selecionada
                            ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200'
                            : 'bg-slate-50 border-slate-100 text-slate-600 hover:border-blue-300 hover:bg-blue-50'
                          }`}
                      >
                        <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all
                          ${selecionada
                            ? 'bg-white border-white'
                            : 'border-slate-300 bg-white'
                          }`}
                        >
                          {selecionada && (
                            <svg className="w-3 h-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
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

              {formData.especialidades.length > 0 && (
                <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mt-3 ml-1">
                  {formData.especialidades.length} especialidade(s) selecionada(s)
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