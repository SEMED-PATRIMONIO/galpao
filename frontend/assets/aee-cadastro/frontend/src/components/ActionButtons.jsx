import React from 'react';

const ActionButtons = ({ selectedId, onAction }) => {
  /**
   * Função auxiliar para gerar as classes CSS dos botões.
   * Mantém o padrão visual de "pílula" com cantos arredondados (rounded-2xl) 
   * e tipografia forte (font-black).
   */
  const getBtnClass = (variant, isActive = true) => {
    const base = "flex items-center justify-center gap-3 w-full px-4 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-200 shadow-sm active:scale-95 mb-4";
    
    const styles = {
      // Estilo para o botão de inclusão (Destaque principal)
      primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200 hover:shadow-lg",
      
      // Estilo para o botão de edição (Bordas azuis, fundo branco)
      secondary: "bg-white text-blue-600 border-2 border-blue-100 hover:border-blue-300 hover:bg-blue-50",
      
      // Estilo para o botão de exclusão/inativação (Tom de alerta suave que fica forte no hover)
      danger: "bg-red-50 text-red-600 border-2 border-red-50 hover:bg-red-600 hover:text-white hover:shadow-red-200 hover:border-red-600",
      
      // Estilo para quando nenhum item está selecionado
      disabled: "bg-slate-100 text-slate-400 cursor-not-allowed border-transparent shadow-none"
    };

    return `${base} ${isActive ? styles[variant] : styles.disabled}`;
  };

  return (
    <div className="flex flex-col">
      {/* Rótulo da Seção */}
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 ml-1">
        Ações de Registro
      </p>
      
      {/* BOTÃO: INCLUIR NOVO
          Sempre habilitado. Abre o modal de criação conforme a aba ativa.
      */}
      <button 
        onClick={() => onAction('incluir')}
        className={getBtnClass('primary')}
      >
        <span className="text-xl">➕</span> Incluir Novo
      </button>

      {/* BOTÃO: EDITAR DADOS
          Habilitado apenas se houver um ID selecionado na DataTable.
      */}
      <button 
        disabled={!selectedId}
        onClick={() => onAction('editar')}
        className={getBtnClass('secondary', !!selectedId)}
        title={!selectedId ? "Selecione um registro na tabela para editar" : "Alterar dados deste registro"}
      >
        <span className="text-xl">📝</span> Editar Dados
      </button>

      {/* BOTÃO: INATIVAR
          Habilitado apenas se houver um ID selecionado.
          Não apaga do banco, apenas muda o campo 'ativo' para false.
      */}
      <button 
        disabled={!selectedId}
        onClick={() => onAction('inativar')}
        className={getBtnClass('danger', !!selectedId)}
        title={!selectedId ? "Selecione um registro para inativar" : "Arquivar este registro"}
      >
        <span className="text-xl">🗑️</span> Inativar
      </button>

      {/* Divisor Visual */}
      <div className="h-px bg-slate-100 my-4"></div>

      {/* Nota informativa para o usuário */}
      {!selectedId && (
        <div className="bg-blue-50/50 p-4 rounded-2xl border border-dashed border-blue-100">
          <p className="text-[10px] text-blue-500 font-bold text-center leading-relaxed">
            Selecione uma linha na tabela ao lado para liberar as opções de 
            <span className="text-blue-700"> Edição</span> e 
            <span className="text-red-600"> Inativação</span>.
          </p>
        </div>
      )}
    </div>
  );
};

export default ActionButtons;