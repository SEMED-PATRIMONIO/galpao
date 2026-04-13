import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';

const ReativarModal = ({ isOpen, onClose, tabela, onReativado }) => {
  const [inativos, setInativos] = useState([]);
  const [loading, setLoading] = useState(false);

  // Nomes amigáveis para o cabeçalho
  const nomesTabelas = {
    'aee_alunos': 'Alunos',
    'aee_escolas': 'Unidades Escolares',
    'aee_especialidades': 'Especialidades',
    'aee_usuarios_equipe': 'Equipe do Sistema',
    'aee_usuarios_pais': 'Contas de Responsáveis'
  };

  const carregarInativos = async () => {
    setLoading(true);
    try {
      const nomeLimpo = tabela.replace('aee_', '');
      const res = await fetch(`/api/crud/inativos/${nomeLimpo}`);
      const dados = await res.json();
      setInativos(Array.isArray(dados) ? dados : []);
    } catch (err) {
      console.error("Erro ao buscar inativos", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) carregarInativos();
  }, [isOpen, tabela]);

  const handleReativar = async (id) => {
    try {
      const nomeLimpo = tabela.replace('aee_', '');
      const res = await fetch(`/api/crud/${nomeLimpo}/${id}/reativar`, { method: 'PATCH' });
      
      if (res.ok) {
        Swal.fire({
          title: "Restaurado!",
          text: "O registro voltou para a lista ativa! 🔄",
          icon: "success",
          confirmButtonColor: "#2563eb"
        });
        carregarInativos();
        onReativado(); // Atualiza a lista principal no Dashboard
      }
    } catch (err) {
      Swal.fire("Erro", "Não foi possível reativar o item.", "error");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden border-4 border-amber-100 animate-in zoom-in duration-200">
        
        <header className="bg-gradient-to-r from-amber-500 to-orange-600 p-6 text-white text-center">
          <h2 className="text-xl font-black uppercase tracking-widest">
            Arquivo de Inativos: {nomesTabelas[tabela] || 'Registros'}
          </h2>
          <p className="text-amber-100 text-xs mt-1 font-bold">Selecione os dados que deseja restaurar ao sistema</p>
        </header>

        <div className="p-6 max-h-[60vh] overflow-y-auto bg-amber-50/30">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
              <p className="text-amber-600 font-bold animate-pulse">Sincronizando com o banco de dados...</p>
            </div>
          ) : inativos.length === 0 ? (
            <div className="text-center py-12">
              <span className="text-6xl block mb-4 opacity-50">🏜️</span>
              <p className="text-slate-400 font-bold uppercase text-sm tracking-tighter">Tudo limpo! Nenhum registro inativo encontrado.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {inativos.map(item => (
                <div key={item.id} className="bg-white p-4 rounded-2xl flex justify-between items-center shadow-sm border border-amber-100 hover:border-amber-300 transition-all group">
                  <div>
                    <p className="font-bold text-slate-800 group-hover:text-amber-700 transition-colors">
                      {item.nome_completo || item.nome || item.usuario}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono italic">ID: #{item.id} • Status: Arquivado</p>
                  </div>
                  <button 
                    onClick={() => handleReativar(item.id)}
                    className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2 rounded-xl font-black text-[10px] shadow-md active:scale-95 transition-all uppercase tracking-widest"
                  >
                    Reativar 🔄
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <footer className="p-6 bg-white border-t flex justify-center">
          <button 
            onClick={onClose} 
            className="bg-slate-800 text-white px-12 py-3 rounded-2xl font-black text-xs hover:bg-slate-900 transition-all uppercase tracking-widest shadow-lg"
          >
            Fechar Arquivo 📁
          </button>
        </footer>
      </div>
    </div>
  );
};

export default ReativarModal;