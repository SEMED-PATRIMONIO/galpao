import React from 'react';

const DataTable = ({ data, columns = [], selectedId, onSelect }) => {
  // Estado de lista vazia com design moderno
  const safeData = Array.isArray(data) ? data : [];
  if (safeData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-white rounded-3xl border-2 border-dashed border-blue-100">
        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center text-4xl mb-4 animate-bounce">📁</div>
        <h3 className="text-lg font-black text-slate-700 uppercase tracking-tighter">Nenhum registo encontrado</h3>
        <p className="text-slate-400 text-sm max-w-xs mx-auto font-medium">Não existem dados ativos para esta categoria no momento. Tente incluir um novo ou verificar os inativos.</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-white rounded-3xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b border-blue-50">
              {columns.map((col) => (
                <th 
                  key={col.key} 
                  className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-blue-50">
            {safeData.map((item) => (
              <tr 
                key={item.id}
                onClick={() => onSelect(item.id === selectedId ? null : item.id)}
                className={`group cursor-pointer transition-all duration-200 ${
                  selectedId === item.id 
                    ? 'bg-blue-600 shadow-xl scale-[1.01] z-10 relative' 
                    : 'hover:bg-blue-50/50'
                }`}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-6 py-4 whitespace-nowrap">
                    {(() => {
                      const value = item[col.key];
                      
                      // Estilização especial para o texto quando a linha está selecionada
                      const textClass = selectedId === item.id ? 'text-white' : 'text-slate-600';
                      const labelClass = selectedId === item.id ? 'text-blue-100' : 'text-slate-400';

                      // 1. Tratamento de IDs (Estilo de Código)
                      if (col.key === 'id') {
                        return <span className={`font-mono text-xs ${labelClass}`}>#{value}</span>;
                      }

                      // 2. Tratamento de Especialidades (JSONB)
                      if (col.key === 'especialidades' || (typeof value === 'object' && value !== null)) {
                        const activeList = value ? Object.keys(value).filter(k => value[k]) : [];
                        return (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {activeList.length > 0 ? activeList.map(esp => (
                              <span key={esp} className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                selectedId === item.id ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600'
                              }`}>
                                {esp}
                              </span>
                            )) : <span className={`text-[10px] italic ${labelClass}`}>Nenhuma</span>}
                          </div>
                        );
                      }

                      // 3. Tratamento de Booleanos
                      if (typeof value === 'boolean') {
                        return (
                          <span className={`text-xs font-bold ${textClass}`}>
                            {value ? '✅ Ativo' : '❌ Inativo'}
                          </span>
                        );
                      }
                      
                      // 4. Texto Padrão (com destaque para o nome)
                      const isNameField = col.key.includes('nome');
                      return (
                        <span className={`${textClass} ${isNameField ? 'font-bold' : 'font-medium'} text-sm`}>
                          {value !== undefined && value !== null ? String(value) : '-'}
                        </span>
                      );
                    })()}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataTable;