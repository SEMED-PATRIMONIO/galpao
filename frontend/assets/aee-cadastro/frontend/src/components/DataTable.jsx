import React from 'react';

const DataTable = ({ data, columns = [], selectedId, onSelect }) => {
  // --- SEGURANÇA: GARANTE QUE 'DATA' SEJA SEMPRE UM ARRAY ---
  const safeData = Array.isArray(data) ? data : [];

  // Estado de lista vazia ou erro de carregamento
  if (safeData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center bg-white rounded-3xl border-2 border-dashed border-blue-100">
        <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center text-5xl mb-6 animate-pulse">
          📁
        </div>
        <h3 className="text-xl font-black text-slate-700 uppercase tracking-tighter">
          Nenhum registro encontrado
        </h3>
        <p className="text-slate-400 text-sm max-w-xs mx-auto font-medium mt-2">
          Não existem dados ativos para esta categoria ou houve um erro na conexão. 
          Tente incluir um novo ou verifique os inativos.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-blue-50">
              {columns.map((col) => (
                <th 
                  key={col.key} 
                  className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {safeData.map((item) => (
              <tr 
                key={item.id}
                onClick={() => onSelect(selectedId === item.id ? null : item.id)}
                className={`group cursor-pointer transition-all duration-150 ${
                  selectedId === item.id 
                    ? 'bg-blue-600' 
                    : 'hover:bg-blue-50/50'
                }`}
              >
                {columns.map((col) => {
                  const value = item[col.key];
                  const isSelected = selectedId === item.id;

                  return (
                    <td key={col.key} className="px-6 py-4">
                      {(() => {
                        // 1. TRATAMENTO PARA ARRAYS (Ex: Especialidades múltiplas)
                        if (Array.isArray(value)) {
                          return (
                            <div className="flex flex-wrap gap-1">
                              {value.length > 0 ? value.map((val, idx) => (
                                <span 
                                  key={idx} 
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                    isSelected 
                                      ? 'bg-white/20 text-white' 
                                      : 'bg-blue-100 text-blue-700'
                                  }`}
                                >
                                  {val}
                                </span>
                              )) : (
                                <span className={isSelected ? 'text-white/50' : 'text-slate-300 italic text-xs'}>
                                  Nenhum
                                </span>
                              )}
                            </div>
                          );
                        }

                        // 2. TRATAMENTO PARA BOOLEANOS (Ativo/Inativo)
                        if (typeof value === 'boolean') {
                          return (
                            <span className={`text-xs font-black uppercase tracking-widest ${
                              isSelected ? 'text-white' : value ? 'text-emerald-500' : 'text-red-400'
                            }`}>
                              {value ? '● Ativo' : '○ Inativo'}
                            </span>
                          );
                        }

                        // 3. TRATAMENTO PARA TEXTO PADRÃO
                        const isPrimaryField = col.key.includes('nome') || col.key === 'id';
                        
                        return (
                          <span className={`text-sm truncate block transition-colors ${
                            isSelected 
                              ? 'text-white' 
                              : isPrimaryField ? 'font-black text-slate-800' : 'font-medium text-slate-500'
                          }`}>
                            {value !== null && value !== undefined ? String(value) : '---'}
                          </span>
                        );
                      })()}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* RODAPÉ DA TABELA */}
      <div className="bg-slate-50 px-6 py-3 border-t border-blue-50 flex justify-between items-center">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          Total de {safeData.length} registros
        </p>
        {selectedId && (
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest animate-pulse">
            Item ID #{selectedId} selecionado
          </p>
        )}
      </div>
    </div>
  );
};

export default DataTable;