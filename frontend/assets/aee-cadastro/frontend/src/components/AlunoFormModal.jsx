import React, { useState, useEffect } from 'react';

const AlunoFormModal = ({ isOpen, onClose, onSave, alunoInicial, listaEspecialidades = [], listaEscolas = [] }) => {
  const initialState = {
    nome_completo: '',
    ra: '',
    escola: '', 
    especialidades: {}
  };

  const [aluno, setAluno] = useState(initialState);

  useEffect(() => {
    if (isOpen) {
      if (alunoInicial) {
        setAluno({
          ...alunoInicial,
          especialidades: alunoInicial.especialidades || {}
        });
      } else {
        setAluno(initialState);
      }
    }
  }, [alunoInicial, isOpen]);

  const toggleEspecialidade = (nome) => {
    setAluno(prev => ({
      ...prev,
      especialidades: {
        ...(prev.especialidades || {}),
        [nome]: !prev.especialidades?.[nome]
      }
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 border-4 border-blue-50">
        
        <header className="bg-blue-600 p-6 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold italic tracking-tight">
              {alunoInicial ? '🛠️ Editar Registro de Aluno' : '🆕 Novo Cadastro (AEE)'}
            </h2>
            <p className="text-blue-100 text-xs mt-1 font-medium">Sincronize os dados com a rede municipal</p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white text-2xl transition-transform hover:scale-110">✕</button>
        </header>

        <div className="p-6 space-y-5 bg-blue-50/20">
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase mb-1 tracking-widest">Nome Completo</label>
            <input 
              type="text" 
              className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white font-semibold"
              value={aluno.nome_completo}
              onChange={e => setAluno({...aluno, nome_completo: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase mb-1 tracking-widest">RA (Identificação)</label>
              <input 
                type="text" 
                className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white font-mono"
                value={aluno.ra}
                onChange={e => setAluno({...aluno, ra: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-400 uppercase mb-1 tracking-widest">Unidade Escolar</label>
              <select 
                className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white font-bold text-slate-700"
                value={aluno.escola}
                onChange={e => setAluno({...aluno, escola: e.target.value})}
              >
                <option value="">Selecione...</option>
                {listaEscolas.map(esc => (
                  <option key={esc.id} value={esc.nome}>{esc.nome}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-2">
            <label className="text-xs font-black text-slate-400 uppercase flex items-center gap-2 mb-3">
              <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>
              Especialidades Necessárias
            </label>
            
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 bg-white rounded-2xl border border-blue-50 shadow-inner">
              {listaEspecialidades.map(esp => (
                <button
                  key={esp.id}
                  type="button"
                  onClick={() => toggleEspecialidade(esp.nome)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border-2 ${
                    aluno.especialidades?.[esp.nome] 
                    ? 'bg-blue-600 text-white border-blue-400 shadow-md scale-105' 
                    : 'bg-slate-50 text-slate-400 border-slate-100 hover:border-blue-200'
                  }`}
                >
                  {aluno.especialidades?.[esp.nome] ? '✅ ' : '+ '}
                  {esp.nome}
                </button>
              ))}
            </div>
          </div>
        </div>

        <footer className="p-6 bg-white border-t border-slate-100 flex justify-end items-center gap-4">
          <button onClick={onClose} className="text-slate-400 font-bold hover:text-slate-600 uppercase text-xs">Desistir</button>
          <button 
            onClick={() => onSave(aluno)} 
            disabled={!aluno.nome_completo || !aluno.escola}
            className="px-10 py-3 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-200 hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all"
          >
            {alunoInicial ? 'SALVAR ALTERAÇÕES 💾' : 'FINALIZAR CADASTRO 🚀'}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default AlunoFormModal;