import React from 'react';

const DataTable = ({ data, columns, selectedId, onSelect }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <p>Nenhum registro ativo encontrado.</p>
      </div>
    );
  }

  return (
    <table className="w-full text-left border-collapse">
      <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 shadow-sm">
        <tr>
          {columns.map((col) => (
            <th key={col.key} className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
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
            className={`cursor-pointer transition-colors ${
              selectedId === item.id 
                ? 'bg-blue-50 border-l-4 border-blue-600' 
                : 'hover:bg-slate-50 border-l-4 border-transparent'
            }`}
          >
            {columns.map((col) => (
              <td key={col.key} className="px-6 py-4 text-sm text-slate-700 whitespace-nowrap">
                {/* Tratamento especial para JSONB ou Booleanos */}
                {typeof item[col.key] === 'object' ? JSON.stringify(item[col.key]) : String(item[col.key])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default DataTable;