import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';

const ReativarModal = ({ isOpen, onClose, tabela, onReativar }) => {
  const [inativos, setInativos] = useState([]);
  const [loading, setLoading] = useState(false);

  // Remove o prefixo 'aee_' para enviar a URL correta ao backend
  const tableParam = tabela ? tabela.replace('aee_', '') : '';

  useEffect(() => {
    if (isOpen && tableParam) {
      fetchInativos();
    }
  }, [isOpen, tableParam]);

  const fetchInativos = async () => {
    setLoading(true);
    try {
      // Chama a rota específica para buscar apenas os inativos (ativo = false)
      const response = await fetch(`/api/crud/${tableParam}/inativos`);
      const data = await response.json();
      setInativos(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erro ao buscar registros inativos:", error);
      setInativos([]);
    } finally {
      setLoading(false);
    }
  };

  const handleReativar = async (id) => {
    try {
      const response = await fetch(`/api/crud/${tableParam}/${id}/reativar`, {
        method: 'PATCH',
      });

      if (response.ok) {
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: 'Restaurado com sucesso!',
          showConfirmButton: false,
          timer: 1500
        });
        
        // Remove o item reativado da lista do modal na mesma hora
        setInativos(prev => prev.filter(item => item.id !== id));
        
        // Avisa o Dashboard para atualizar a tabela principal
        if (onReativar) onReativar();
        
        // Se a lista de inativos ficar vazia após restaurar, fecha o modal
        if (inativos.length === 1) onClose();
      } else {
        throw new Error();
      }
    } catch (error) {
      Swal.fire('Erro', 'Falha ao reativar o registro no banco.', 'error');
    }
  };

  // Função para descobrir qual campo de nome exibir (depende da tabela)
  const getNomeExibicao = (item) => {
    return item.nome_completo || item.nome || item.usuario || `Registro #${item.id}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[85vh]">
        
        {/* CABEÇALHO - Tema Amarelo/Laranja para "Atenção/Arquivo" */}
        <div className="bg-amber-500 px-10 py-8 text-white relative shrink-0">
          <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
            <span className="text-3xl">🔄</span> Arquivo de Inativos
          </h2>
          <p className="text-amber-100 text-[10px] font-bold uppercase tracking-widest mt-1">
            Tabela atual: {tabela}
          </p>
          <button 
            onClick={onClose}
            className="absolute top-8 right-8 w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          >
            ✕
          </button>
        </div>

        {/* CORPO DO MODAL (Com rolagem) */}
        <div className="p-8 overflow-y-auto bg-slate-50 flex-1">
          {loading ? (
            <div className="text-center py-10 font-bold text-amber-500 animate-pulse">
              Buscando no arquivo...
            </div>
          ) : inativos.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-4 opacity-50">📭</div>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">
                Nenhum registro inativo encontrado.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {inativos.map((item) => (
                <div 
                  key={item.id} 
                  className="flex items-center justify-between p-5 bg-white rounded-2xl border border-amber-100 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 font-mono text-xs font-bold">
                      #{item.id}
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-800">
                        {getNomeExibicao(item)}
                      </p>
                      {item.ra && (
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          RA: {item.ra}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleReativar(item.id)}
                    className="px-4 py-2 bg-amber-100 text-amber-700 hover:bg-amber-500 hover:text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-colors active:scale-95"
                  >
                    Reativar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RODAPÉ */}
        <div className="p-6 bg-white border-t border-slate-100 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all"
          >
            Fechar Arquivo
          </button>
        </div>

      </div>
    </div>
  );
};

export default ReativarModal;