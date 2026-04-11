// /var/www/aee-cadastro/frontend/src/pages/Dashboard.jsx
import React, { useState, useEffect } from 'react';
// ... imports de componentes ...

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('aee_alunos');
  const [data, setData] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const fetchData = async () => {
    const response = await fetch(`/api/data/${activeTab}`);
    const result = await response.json();
    setData(result);
  };

  const handleInativar = async () => {
    if (!selectedId) return;
    
    // 1. Encontrar o índice atual para o "Ponteiro Inteligente"
    const currentIndex = data.findIndex(item => item.id === selectedId);
    
    await fetch(`/api/data/${activeTab}/${selectedId}/inativar`, { method: 'PATCH' });
    
    // 2. Atualizar lista
    const newData = data.filter(item => item.id !== selectedId);
    setData(newData);

    // 3. Lógica do Ponteiro: Seleciona o próximo ou o anterior se for o último
    if (newData.length > 0) {
      const nextItem = newData[currentIndex] || newData[currentIndex - 1];
      setSelectedId(nextItem.id);
    } else {
      setSelectedId(null);
    }
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC]">
      {/* Sidebar com tons de azul marinho e ícones intuitivos [cite: 1] */}
      {/* ... Renderização do Layout ... */}
      
      {/* Botões de Ação na Direita com Tooltips */}
      <div className="flex flex-col gap-4 p-4 bg-white border-l border-slate-200">
        <button className="btn-incluir" title="Cadastrar novo registro">➕ Novo</button>
        <button 
          disabled={!selectedId} 
          className={`btn-acao ${!selectedId && 'opacity-30'}`}
          onClick={handleInativar}
          title="Inativar registro (permanece no banco)"
        >
          🗑️ Inativar
        </button>
      </div>
    </div>
  );
};