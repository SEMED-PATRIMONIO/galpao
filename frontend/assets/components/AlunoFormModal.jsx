import React, { useState, useEffect } from 'react';

const AlunoFormModal = ({ isOpen, onClose, onSave, alunoInicial, listaEspecialidades = [] }) => {
  // Estado inicial padrão
  const initialState = {
    nome_completo: '',
    ra: '',
    especialidades: {}
  };

  const [aluno, setAluno] = useState(initialState);

  // Sincroniza o formulário quando abre para edição ou novo cadastro
  useEffect(() => {
    if (isOpen) {
      if (alunoInicial) {
        setAluno({
          ...alunoInicial,
          // Garante que especialidades seja ao menos um objeto vazio
          especialidades: alunoInicial.especialidades || {}
        });
      } else {
        setAluno(initialState);
      }
    }
  }, [alunoInicial, isOpen]);

  // Lógica para marcar/desmarcar especialidades no JSONB
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
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Cabeçalho */}
        <header className="bg-blue-600 p-6 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">
              {alunoInicial ? 'Editar Aluno' : 'Novo Cadastro (AEE)'}
            </h2>
            <p className="text-blue-100 text-xs mt-1">Preencha os dados acadêmicos e clínicos</p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white text-2xl">✕</button>
        </header>

        <div className="p-6 space-y-5">
          {/* Campo: Nome */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-wider">
              Nome Completo
            </label>
            <input 
              type="text" 
              placeholder="Ex: João Silva Santos"
              className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              value={aluno.nome_completo}
              onChange={e => setAluno({...aluno, nome_completo: e.target.value})}
            />
          </div>

          {/* Campo: RA */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-wider">
              RA (Registro Acadêmico)
            </label>
            <input 
              type="text" 
              placeholder="00000000-0"
              className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              value={aluno.ra}
              onChange={e => setAluno({...aluno, ra: e.target.value})}
            />
          </div>

          {/* Trecho das Especialidades (JSONB) */}
          <div className="pt-2">
            <label className="text-sm font-bold text-slate-800 uppercase flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
              Especialidades Necessárias
            </label>
            <p className="text-xs text-slate-500 mb-3 mt-1">
              Marque as áreas que compõem o atendimento deste aluno:
            </p>
            
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-1">
              {listaEspecialidades.length > 0 ? (
                listaEspecialidades.map(esp => (
                  <button
                    key={esp.id}
                    type="button"
                    onClick={() => toggleEspecialidade(esp.nome)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                      aluno.especialidades?.[esp.nome] 
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md scale-105' 
                      : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    {aluno.especialidades?.[esp.nome] ? '✓ ' : '+ '}
                    {esp.nome}
                  </button>
                ))
              ) : (
                <p className="text-xs text-amber-600 italic">Nenhuma especialidade cadastrada no sistema.</p>
              )}
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <footer className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end items-center gap-4">
          <button 
            onClick={onClose} 
            className="text-slate-500 font-bold hover:text-slate-700 transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={() => onSave(aluno)} 
            disabled={!aluno.nome_completo}
            className={`px-8 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg transition-all active:scale-95 ${
              !aluno.nome_completo ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'
            }`}
          >
            {alunoInicial ? 'Atualizar Aluno' : 'Salvar Registro'}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default AlunoFormModal;