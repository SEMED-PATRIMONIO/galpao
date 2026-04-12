import React from 'react';

const DataTable = ({ data, columns = [], selectedId, onSelect }) => {
  // Se não houver dados ou colunas definidas, mostra estado vazio
  if (!data || data.length === 0 || !columns || columns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
        <span className="text-4xl mb-2">📁</span>
        <p className="font-medium">Nenhum registro encontrado para esta categoria.</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {columns.map((col) => (
                <th 
                  key={col.key} 
                  className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((item) => (
              <tr 
                key={item.id}
                onClick={() => onSelect(item.id === selectedId ? null : item.id)}
                className={`cursor-pointer transition-all duration-150 ${
                  selectedId === item.id 
                    ? 'bg-blue-50/80 border-l-4 border-blue-600' 
                    : 'hover:bg-slate-50 border-l-4 border-transparent'
                }`}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-6 py-4 text-sm text-slate-700 whitespace-nowrap">
                    {/* Lógica inteligente para exibição de dados */}
                    {(() => {
                      const value = item[col.key];
                      
                      // 1. Se for Booleano (true/false)
                      if (typeof value === 'boolean') {
                        return value ? '✅ Sim' : '❌ Não';
                      }
                      
                      // 2. Se for Objeto ou Array (JSONB do banco)
                      if (typeof value === 'object' && value !== null) {
                        return (
                          <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500">
                            {JSON.stringify(value)}
                          </span>
                        );
                      }
                      
                      // 3. Texto ou Número padrão
                      return value !== undefined && value !== null ? String(value) : '-';
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