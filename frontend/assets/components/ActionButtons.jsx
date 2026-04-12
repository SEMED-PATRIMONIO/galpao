// /var/www/aee-cadastro/frontend/src/components/ActionButtons.jsx

// Botões estilizados com tons de azul e estados desativados
const ActionButtons = ({ selectedId, onAction }) => {
  // Função auxiliar para gerar classes dinâmicas (Tailwind)
  const btnClass = (isActive) => `
    flex items-center justify-center w-full px-4 py-3 rounded-lg font-bold text-sm transition-all
    ${isActive 
      ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md transform hover:-translate-y-0.5' 
      : 'bg-slate-200 text-slate-400 cursor-not-allowed'}
  `;

  return (
    <div className="flex flex-col space-y-3 w-48">
      {/* Incluir Novo: Sempre Ativo (tom azul claro) */}
      <button 
        onClick={() => onAction('incluir')}
        className="flex items-center justify-center w-full px-4 py-3 rounded-lg font-bold text-sm bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-200 transition-all shadow-sm"
      >
        ➕ Incluir Novo
      </button>

      {/* Editar: Ativo apenas se selectedId existir (!!selectedId converte para booleano) */}
      <button 
        disabled={!selectedId}
        onClick={() => onAction('editar')}
        className={btnClass(!!selectedId)}
      >
        📝 Editar
      </button>

      {/* Inativar: Ativo se selectedId existir, muda cor para Vermelho */}
      <button 
        disabled={!selectedId}
        onClick={() => onAction('inativar')}
        className={btnClass(!!selectedId).replace('bg-blue-600', 'bg-red-500 hover:bg-red-600')}
        title="Inativar (Não remove do banco)"
      >
        🗑️ Inativar
      </button>

      {/* Relatório: Ativo se selectedId existir, muda cor para Cinza Escuro */}
      <button 
        disabled={!selectedId}
        onClick={() => onAction('relatorio')}
        className={btnClass(!!selectedId).replace('bg-blue-600', 'bg-slate-700 hover:bg-slate-800')}
      >
        📊 Relatório
      </button>
    </div>
  );
};

export default ActionButtons;