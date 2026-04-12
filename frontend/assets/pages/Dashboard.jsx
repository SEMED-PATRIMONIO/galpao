import React, { useState, useEffect } from 'react';
import MainLayout from '../layouts/MainLayout';
import DataTable from '../components/DataTable';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('aee_alunos');
  const [data, setData] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);

  // Função para buscar dados do backend
  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/data/${activeTab}`);
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  // Carrega os dados sempre que mudar de aba
  useEffect(() => {
    fetchData();
    setSelectedId(null); // Limpa seleção ao mudar de aba
  }, [activeTab]);

  const handleInativar = async () => {
    if (!selectedId) return;
    
    const currentIndex = data.findIndex(item => item.id === selectedId);
    
    try {
      await fetch(`/api/data/${activeTab}/${selectedId}/inativar`, { method: 'PATCH' });
      
      const newData = data.filter(item => item.id !== selectedId);
      setData(newData);

      if (newData.length > 0) {
        const nextItem = newData[currentIndex] || newData[currentIndex - 1];
        setSelectedId(nextItem.id);
      } else {
        setSelectedId(null);
      }
    } catch (error) {
      alert("Erro ao inativar registro.");
    }
  };

  return (
    <MainLayout activeTab={activeTab} setActiveTab={setActiveTab}>
      <div className="flex h-full bg-[#F8FAFC]">
        {/* Área Central: Tabela */}
        <div className="flex-1 p-6 overflow-auto">
          <header className="mb-6">
            <h1 className="text-2xl font-bold text-slate-800 capitalize">
              {activeTab.replace('aee_', '').replace('_', ' ')}
            </h1>
            <p className="text-slate-500 text-sm">Gerenciamento de registros do sistema AEE</p>
          </header>

          {loading ? (
            <div className="flex justify-center p-10">Carregando...</div>
          ) : (
            <DataTable 
              data={data} 
              selectedId={selectedId} 
              onSelect={setSelectedId} 
              type={activeTab}
            />
          )}
        </div>
        
        {/* Botões de Ação na Direita */}
        <div className="flex flex-col gap-4 p-4 bg-white border-l border-slate-200 w-48">
          <button 
            className="bg-blue-600 text-white py-2 px-4 rounded-lg font-bold hover:bg-blue-700 transition-all"
            onClick={() => alert('Abrir modal de cadastro')}
          >
            ➕ Novo
          </button>
          
          <button 
            disabled={!selectedId} 
            className={`flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-bold border transition-all ${
              selectedId 
                ? 'border-red-200 text-red-600 hover:bg-red-50' 
                : 'border-slate-100 text-slate-300 cursor-not-allowed'
            }`}
            onClick={handleInativar}
          >
            🗑️ Inativar
          </button>

          <div className="mt-auto border-t pt-4 text-[10px] text-slate-400 text-center uppercase tracking-widest">
            AEE Cadastro v1.0
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Dashboard;