import React, { useState, useEffect } from 'react';
import MainLayout from '../layouts/MainLayout';
import DataTable from '../components/DataTable';
import ActionButtons from '../components/ActionButtons';
import AlunoFormModal from '../components/AlunoFormModal';
import ChangePasswordModal from '../components/ChangePasswordModal';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('aee_alunos');
  const [data, setData] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [isAlunoModalOpen, setIsAlunoModalOpen] = useState(false);
  const [isPassModalOpen, setIsPassModalOpen] = useState(false);
  const [especialidades, setEspecialidades] = useState([]);

  // Configuração de colunas por tabela
  const columnConfig = {
    aee_alunos: [
      { key: 'id', label: 'ID' },
      { key: 'nome_completo', label: 'Nome do Aluno' },
      { key: 'ra', label: 'RA' }
    ],
    aee_usuarios_pais: [
      { key: 'id', label: 'ID' },
      { key: 'nome_pai', label: 'Responsável' },
      { key: 'email', label: 'E-mail' }
    ],
    aee_profissionais_saude: [
      { key: 'id', label: 'ID' },
      { key: 'nome', label: 'Profissional' },
      { key: 'conselho', label: 'Conselho/Registro' }
    ],
    aee_especialidades: [
      { key: 'id', label: 'ID' },
      { key: 'nome', label: 'Especialidade' }
    ],
    aee_usuarios_equipe: [
      { key: 'id', label: 'ID' },
      { key: 'nome', label: 'Nome' },
      { key: 'username', label: 'Usuário' }
    ]
  };

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/data/${activeTab}`);
      const result = await res.json();
      setData(result);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchData();
    setSelectedId(null);
    // Carrega especialidades para o modal de aluno
    fetch('/api/data/aee_especialidades').then(res => res.json()).then(setEspecialidades);
  }, [activeTab]);

  const handleAction = (type) => {
    if (type === 'incluir') setIsAlunoModalOpen(true);
    if (type === 'inativar') handleInativar();
    if (type === 'editar') alert('Funcionalidade de edição em desenvolvimento');
  };

  const handleInativar = async () => {
    if (!window.confirm("Deseja realmente inativar este registro?")) return;
    await fetch(`/api/data/${activeTab}/${selectedId}/inativar`, { method: 'PATCH' });
    fetchData();
  };

  const saveAluno = async (alunoData) => {
    await fetch('/api/data/aee_alunos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alunoData)
    });
    setIsAlunoModalOpen(false);
    fetchData();
  };

  return (
    <MainLayout 
      user={{ nome: 'Administrador' }} 
      activeTab={activeTab} 
      setActiveTab={setActiveTab}
      onOpenPass={() => setIsPassModalOpen(true)}
    >
      <div className="flex h-full">
        <div className="flex-1 overflow-auto p-4">
          <DataTable 
            data={data} 
            columns={columnConfig[activeTab] || []} 
            selectedId={selectedId} 
            onSelect={setSelectedId} 
          />
        </div>
        <div className="p-4 border-l bg-white">
          <ActionButtons selectedId={selectedId} onAction={handleAction} />
        </div>
      </div>

      <AlunoFormModal 
        isOpen={isAlunoModalOpen} 
        onClose={() => setIsAlunoModalOpen(false)} 
        onSave={saveAluno}
        listaEspecialidades={especialidades}
      />

      <ChangePasswordModal 
        isOpen={isPassModalOpen} 
        onClose={() => setIsPassModalOpen(false)} 
        userId={1} 
      />
    </MainLayout>
  );
};

export default Dashboard;