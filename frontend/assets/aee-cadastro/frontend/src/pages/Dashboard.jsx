import React, { useState, useEffect } from 'react';
import MainLayout from '../layouts/MainLayout';
import DataTable from '../components/DataTable';
import ActionButtons from '../components/ActionButtons';
import AlunoFormModal from '../components/AlunoFormModal';
import ChangePasswordModal from '../components/ChangePasswordModal';
import ReativarModal from '../components/ReativarModal'; // Certifique-se de que o arquivo existe
import Swal from 'sweetalert2';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('aee_alunos');
  const [data, setData] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [isAlunoModalOpen, setIsAlunoModalOpen] = useState(false);
  const [isPassModalOpen, setIsPassModalOpen] = useState(false);
  const [isReativarOpen, setIsReativarOpen] = useState(false);
  
  const [especialidades, setEspecialidades] = useState([]);
  const [escolas, setEscolas] = useState([]);
  const [alunoParaEditar, setAlunoParaEditar] = useState(null);
  const [isEspecialidadeModalOpen, setIsEspecialidadeModalOpen] = useState(false);
  const [isEquipeModalOpen, setIsEquipeModalOpen] = useState(false);

  const columnConfig = {
    aee_alunos: [
      { key: 'id', label: 'ID' },
      { key: 'nome_completo', label: 'Nome do Aluno' },
      { key: 'ra', label: 'RA' },
      { key: 'escola', label: 'Unidade Escolar' }
    ],
    aee_usuarios_pais: [
      { key: 'id', label: 'ID' },
      { key: 'nome_completo', label: 'Responsável' },
      { key: 'telefone', label: 'Contato' }
    ],
    aee_profissionais_saude: [
      { key: 'id', label: 'ID' },
      { key: 'nome_completo', label: 'Profissional' },
      { key: 'especialidade', label: 'Área' }
    ],
    aee_especialidades: [
      { key: 'id', label: 'ID' },
      { key: 'nome', label: 'Nome da Especialidade' }
    ],
    aee_usuarios_equipe: [
      { key: 'id', label: 'ID' },
      { key: 'nome_completo', label: 'Nome' },
      { key: 'cargo', label: 'Função' }
    ]
  };

  const fetchData = async () => {
    try {
      // Usando /api/crud conforme o padrão de rotas que criamos
      const res = await fetch(`/api/crud/${activeTab.replace('aee_', '')}`);
      const result = await res.json();
      setData(result);
    } catch (e) { console.error(e); }
  };

  const fetchAuxiliares = async () => {
    try {
      const resEsp = await fetch('/api/crud/especialidades');
      setEspecialidades(await resEsp.json());
      const resEsc = await fetch('/api/crud/escolas');
      setEscolas(await resEsc.json());
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchData();
    fetchAuxiliares();
    setSelectedId(null);
  }, [activeTab]);

  const handleAction = (action) => {
    if (action === 'incluir') {
      setElementoParaEditar(null); // Limpa para novo cadastro
      if (activeTab === 'aee_alunos') setIsAlunoModalOpen(true);
      if (activeTab === 'aee_especialidades') setIsEspecialidadeModalOpen(true);
      if (activeTab === 'aee_usuarios_equipe') setIsEquipeModalOpen(true);
      // Adicione aqui os outros conforme precisar
    }

    if (action === 'editar' && selectedId) {
      const item = data.find(i => i.id === selectedId);
      setElementoParaEditar(item); // Preenche o formulário com os dados atuais
      
      if (activeTab === 'aee_alunos') setIsAlunoModalOpen(true);
      if (activeTab === 'aee_especialidades') setIsEspecialidadeModalOpen(true);
      if (activeTab === 'aee_usuarios_equipe') setIsEquipeModalOpen(true);
    }

    if (action === 'inativar' && selectedId) {
      inativarRegistro(selectedId);
    }
  };

  const handleInativar = async () => {
    const result = await Swal.fire({
      title: 'Deseja inativar?',
      text: "O registro será movido para o arquivo inativo.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sim, inativar!',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      await fetch(`/api/crud/${activeTab.replace('aee_', '')}/${selectedId}/inativar`, { method: 'PATCH' });
      fetchData();
      Swal.fire("Sucesso", "Registro arquivado!", "success");
    }
  };

  const handleSave = async (formData) => {
    try {
      const method = elementoParaEditar ? 'PUT' : 'POST';
      const url = elementoParaEditar 
        ? `/api/crud/${activeTab}/${elementoParaEditar.id}` 
        : `/api/crud/${activeTab}`;

      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        Swal.fire('Sucesso!', 'Dados salvos no banco.', 'success');
        fetchData(); // Recarrega a tabela na hora
        setIsAlunoModalOpen(false);
        setIsEspecialidadeModalOpen(false);
        setIsEquipeModalOpen(false);
      }
    } catch (error) {
      Swal.fire('Erro', 'Não foi possível salvar.', 'error');
    }
  };

  const saveAluno = async (alunoData) => {
    const user = JSON.parse(localStorage.getItem('user'));
    const modoEdicao = !!alunoData.id;
    
    const payload = {
      ...alunoData,
      criado_por_usuario_id: modoEdicao ? alunoData.criado_por_usuario_id : user?.id
    };

    const url = modoEdicao ? `/api/crud/alunos/${alunoData.id}` : '/api/crud/alunos';
    const method = modoEdicao ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      setIsAlunoModalOpen(false);
      fetchData();
      Swal.fire("🌟 Missão Cumprida!", "Dados sincronizados com sucesso!", "success");
    }
  };

  return (
    <MainLayout 
      user={{ nome: 'Administrador' }} 
      activeTab={activeTab} 
      setActiveTab={setActiveTab}
      onOpenPass={() => setIsPassModalOpen(true)}
    >
      <div className="flex h-full bg-[#f0f7ff]">
        <div className="flex-1 overflow-auto p-6">
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-blue-50">
            <DataTable 
              data={data} 
              columns={columnConfig[activeTab] || []} 
              selectedId={selectedId} 
              onSelect={setSelectedId} 
            />
          </div>
        </div>
        <div className="p-6 border-l bg-white/80 backdrop-blur-md shadow-2xl">
          <ActionButtons selectedId={selectedId} onAction={handleAction} />
          
          <button 
            onClick={() => setIsReativarOpen(true)}
            className="w-full mt-4 p-3 bg-amber-50 text-amber-700 rounded-xl font-bold border border-amber-200 hover:bg-amber-100 transition-all flex items-center justify-center gap-2"
          >
            🔄 REATIVAR ITENS
          </button>
        </div>
      </div>

      <AlunoFormModal 
        isOpen={isAlunoModalOpen} 
        onClose={() => setIsAlunoModalOpen(false)} 
        onSave={saveAluno}
        alunoInicial={alunoParaEditar}
        listaEspecialidades={especialidades}
        listaEscolas={escolas}
      />

      <ReativarModal 
        isOpen={isReativarOpen}
        onClose={() => setIsReativarOpen(false)}
        tabela={activeTab}
        onReativado={fetchData}
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