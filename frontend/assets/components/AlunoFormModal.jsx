// /var/www/aee-cadastro/frontend/src/components/AlunoFormModal.jsx
import React, { useState, useEffect } from 'react';

const AlunoFormModal = ({ isOpen, onClose, onSave, alunoInicial, listaEspecialidades }) => {
  // Estado que armazena os dados do aluno (incluindo o JSON de especialidades)
  const [aluno, setAluno] = useState({
    nome_completo: '',
    ra: '',
    especialidades: {} // Inicia como um objeto vazio para o JSONB
  });

  // Sempre que o modal abrir com um aluno para editar, carrega os dados
  useEffect(() => {
    if (alunoInicial) setAluno(alunoInicial);
    else setAluno({ nome_completo: '', ra: '', especialidades: {} });
  }, [alunoInicial, isOpen]);

  // Lógica para marcar/desmarcar especialidades no JSON
  const toggleEspecialidade = (nome) => {
    setAluno(prev => ({
      ...prev,
      especialidades: {
        ...prev.especialidades,
        [nome]: !prev.especialidades[nome] // Inverte o valor (true/false)
      }
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        
        <header className="bg-blue-600 p-6 text-white">
          <h2 className="text-xl font-bold">Cadastro de Aluno (AEE)</h2>
        </header>

        <div className="p-6 space-y-4">
          {/* Campos Básicos */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nome Completo</label>
            <input 
              type="text" 
              className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              value={aluno.nome_completo}
              onChange={e => setAluno({...aluno, nome_completo: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">RA (Registro Acadêmico)</label>
            <input 
              type="text" 
              className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              value={aluno.ra}
              onChange={e => setAluno({...aluno, ra: e.target.value})}
            />
          </div>

          {/* O Trecho das Especialidades (JSONB) */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-blue-900 uppercase">Especialidades do Aluno</label>
            <p className="text-xs text-slate-500 mb-2">Selecione as áreas de atendimento deste aluno:</p>
            
            <div className="flex flex-wrap gap-2">
              {listaEspecialidades.map(esp => (
                <button
                  key={esp.id}
                  type="button"
                  onClick={() => toggleEspecialidade(esp.nome)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                    aluno.especialidades[esp.nome] 
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-blue-50'
                  }`}
                >
                  {aluno.especialidades[esp.nome] ? '✓ ' : '+ '}
                  {esp.nome}
                </button>
              ))}
            </div>
          </div>
        </div>

        <footer className="p-6 bg-slate-50 flex justify-end space-x-3">
          <button onClick={onClose} className="px-4 py-2 text-slate-500 font-bold">Cancelar</button>
          <button 
            onClick={() => onSave(aluno)} 
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg"
          >
            Salvar Registro
          </button>
        </footer>
      </div>
    </div>
  );
};

export default AlunoFormModal;