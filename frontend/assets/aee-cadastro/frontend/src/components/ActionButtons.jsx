import React from 'react';

const ActionButtons = ({ selectedId, onAction }) => {
  // Função para padronizar o estilo dos botões
  const getBtnClass = (variant, isActive = true) => {
    const base = "flex items-center justify-center gap-3 w-full px-4 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-200 active:scale-95 shadow-sm";
    
    const styles = {
      primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200 hover:shadow-lg",
      secondary: "bg-white text-blue-600 border-2 border-blue-100 hover:border-blue-300 hover:bg-blue-50",
      danger: "bg-red-50 text-red-600 border-2 border-red-50 hover:bg-red-600 hover:text-white hover:shadow-red-200",
      warning: "bg-amber-50 text-amber-700 border-2 border-amber-100 hover:bg-amber-500 hover:text-white",
      disabled: "bg-slate-100 text-slate-400 cursor-not-allowed border-transparent"
    };

    return `${base} ${isActive ? styles[variant] : styles.disabled}`;
  };

  return (
    <div className="flex flex-col space-y-3 w-56 p-2">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Ações de Registo</p>
      
      {/* Incluir: Sempre disponível */}
      <button 
        onClick={() => onAction('incluir')}
        className={getBtnClass('primary')}
      >
        <span className="text-lg">➕</span> Incluir Novo
      </button>

      {/* Editar: Apenas se houver seleção */}
      <button 
        disabled={!selectedId}
        onClick={() => onAction('editar')}
        className={getBtnClass('secondary', !!selectedId)}
      >
        <span className="text-lg">📝</span> Editar Dados
      </button>

      {/* Inativar: Apenas se houver seleção */}
      <button 
        disabled={!selectedId}
        onClick={() => onAction('inativar')}
        className={getBtnClass('danger', !!selectedId)}
        title="Arquivar registo (não apaga do banco)"
      >
        <span className="text-lg">🗑️</span> Inativar
      </button>

      <div className="h-px bg-slate-100 my-4"></div>

      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Utilitários</p>

      {/* Reativar: Abre o baú de itens arquivados */}
      <button 
        onClick={() => onAction('reativar')}
        className={getBtnClass('warning')}
      >
        <span className="text-lg">🔄</span> Recuperar
      </button>

      {/* Relatório: Apenas se houver seleção */}
      <button 
        disabled={!selectedId}
        onClick={() => onAction('relatorio')}
        className={getBtnClass('secondary', !!selectedId)}
      >
        <span className="text-lg">📊</span> Relatório
      </button>
    </div>
  );
};

export default ActionButtons;