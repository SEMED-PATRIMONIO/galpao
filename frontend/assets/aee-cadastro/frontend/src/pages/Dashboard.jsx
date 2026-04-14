import React, { useState, useEffect, useCallback } from 'react';
import MainLayout from '../layouts/MainLayout';
import DataTable from '../components/DataTable';
import ActionButtons from '../components/ActionButtons';
import AlunoFormModal from '../components/AlunoFormModal';
import EspecialidadeFormModal from '../components/EspecialidadeFormModal';
import ProfissionalFormModal from '../components/ProfissionalFormModal';
import AgendamentoFormModal from '../components/AgendamentoFormModal';
import ReativarModal from '../components/ReativarModal';
import Swal from 'sweetalert2';

const Dashboard = () => {
  // --- ESTADOS DE NAVEGAÇÃO E DADOS ---
  const [activeTab, setActiveTab] = useState('aee_alunos');
  const [data, setData] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);

  // --- ESTADOS DOS MODAIS ---
  const [isAlunoModalOpen, setIsAlunoModalOpen] = useState(false);
  const [isEspecialidadeModalOpen, setIsEspecialidadeModalOpen] = useState(false);
  const [isProfissionalModalOpen, setIsProfissionalModalOpen] = useState(false);
  const [isAgendamentoModalOpen, setIsAgendamentoModalOpen] = useState(false);
  const [isReativarOpen, setIsReativarOpen] = useState(false);

  // --- ESTADOS DE EDIÇÃO E LISTAS AUXILIARES ---
  const [itemParaEditar, setItemParaEditar] = useState(null);
  const [especialidades, setEspecialidades] = useState([]);
  const [escolas, setEscolas] = useState([]);
  const [alunos, setAlunos] = useState([]);
  const [profissionais, setProfissionais] = useState([]);

  // Configuração das colunas conforme a aba ativa
  const columnConfig = {
    aee_alunos: [
      { key: 'id', label: 'ID' },
      { key: 'nome_completo', label: 'Nome do Aluno' },
      { key: 'ra', label: 'RA' },
      { key: 'escola', label: 'Unidade Escolar' }
    ],
    aee_usuarios_equipe: [
      { key: 'id', label: 'ID' },
      { key: 'usuario', label: 'Usuário' },
      { key: 'nome', label: 'Nome Completo' },
      { key: 'cargo', label: 'Cargo/Função' }
    ],
    aee_profissionais_saude: [
      { key: 'id', label: 'ID' },
      { key: 'nome_completo', label: 'Profissional' },
      { key: 'especialidade', label: 'Área' },
      { key: 'registro_profissional', label: 'Registro/Conselho' }
    ],
    aee_especialidades: [
      { key: 'id', label: 'ID' },
      { key: 'nome', label: 'Especialidade' }
    ],
    aee_agendamentos: [
      { key: 'id', label: 'Nº' },
      { key: 'aluno_nome', label: 'Aluno' },
      { key: 'profissional_nome', label: 'Profissional' },
      { key: 'data_hora', label: 'Data/Hora' },
      { key: 'status', label: 'Status' }
    ]
  };

  // --- BUSCA DE DADOS ---

  const fetchData = useCallback(async () => {
    setLoading(true);
    const tableParam = activeTab.replace('aee_', '');
    try {
      const response = await fetch(`/api/crud/${tableParam}`);
      const result = await response.json();
      setData(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  // Carrega listas para os campos de SELECT (dropdowns)
  const fetchAuxiliares = async () => {
    try {
      const [resEsp, resEsc, resAlu, resProf] = await Promise.all([
        fetch('/api/crud/especialidades'),
        fetch('/api/crud/escolas'),
        fetch('/api/crud/alunos'),
        fetch('/api/crud/profissionais_saude')
      ]);
      setEspecialidades(await resEsp.json());
      setEscolas(await resEsc.json());
      setAlunos(await resAlu.json());
      setProfissionais(await resProf.json());
    } catch (e) {
      console.error("Erro ao carregar listas auxiliares");
    }
  };

  useEffect(() => {
    fetchData();
    fetchAuxiliares();
    setSelectedId(null);
  }, [fetchData]);

  // --- LÓGICA DE AÇÕES ---

  const handleAction = (action) => {
    if (action === 'incluir') {
      setItemParaEditar(null);
      abrirModalCorreto();
    } else if (action === 'editar' && selectedId) {
      const item = data.find(d => d.id === selectedId);
      setItemParaEditar(item);
      abrirModalCorreto();
    } else if (action === 'inativar' && selectedId) {
      confirmarInativacao();
    }
  };

  const abrirModalCorreto = () => {
    if (activeTab === 'aee_alunos') setIsAlunoModalOpen(true);
    if (activeTab === 'aee_especialidades') setIsEspecialidadeModalOpen(true);
    if (activeTab === 'aee_profissionais_saude') setIsProfissionalModalOpen(true);
    if (activeTab === 'aee_agendamentos') setIsAgendamentoModalOpen(true);
  };

  const confirmarInativacao = () => {
    Swal.fire({
      title: 'Inativar Registro?',
      text: "O item será movido para o arquivo de inativos.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Sim, inativar',
      cancelButtonText: 'Cancelar'
    }).then(async (result) => {
      if (result.isConfirmed) {
        const tableParam = activeTab.replace('aee_', '');
        await fetch(`/api/crud/${tableParam}/${selectedId}`, { method: 'DELETE' });
        fetchData();
        setSelectedId(null);
        Swal.fire('Inativado!', '', 'success');
      }
    });
  };

  const handleSave = async (formData) => {
    const tableParam = activeTab.replace('aee_', '');
    const method = itemParaEditar ? 'PUT' : 'POST';
    const url = itemParaEditar 
      ? `/api/crud/${tableParam}/${itemParaEditar.id}` 
      : `/api/crud/${tableParam}`;

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        Swal.fire('Sucesso!', 'Operação realizada com êxito.', 'success');
        fecharTodosModais();
        fetchData();
      }
    } catch (error) {
      Swal.fire('Erro', 'Não foi possível salvar os dados.', 'error');
    }
  };

  const fecharTodosModais = () => {
    setIsAlunoModalOpen(false);
    setIsEspecialidadeModalOpen(false);
    setIsProfissionalModalOpen(false);
    setIsAgendamentoModalOpen(false);
    setItemParaEditar(null);
  };

  return (
    <MainLayout activeTab={activeTab} setActiveTab={setActiveTab}>
      <div className="flex h-full">
        
        {/* TABELA PRINCIPAL */}
        <div className="flex-1 p-8 overflow-auto">
          <header className="mb-8">
            <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">
              {activeTab.replace('aee_', '').replace(/_/g, ' ')}
            </h2>
            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">
              Base de Dados • {data.length} registros encontrados
            </p>
          </header>

          <div className="bg-white rounded-[2.5rem] shadow-xl shadow-blue-100/50 border border-blue-50 overflow-hidden">
            {loading ? (
              <div className="py-20 text-center font-black text-blue-600 animate-pulse uppercase tracking-widest">
                Sincronizando Banco de Dados...
              </div>
            ) : (
              <DataTable 
                data={data} 
                columns={columnConfig[activeTab] || []} 
                selectedId={selectedId} 
                onSelect={setSelectedId} 
              />
            )}
          </div>
        </div>

        {/* PAINEL DE AÇÕES LATERAL */}
        <aside className="w-80 bg-white/60 backdrop-blur-md border-l border-slate-100 p-8 flex flex-col shadow-2xl">
          <ActionButtons selectedId={selectedId} onAction={handleAction} />
          
          <div className="mt-auto space-y-3">
            <button 
              onClick={() => setIsReativarOpen(true)}
              className="w-full py-4 bg-amber-50 text-amber-700 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] border-2 border-amber-100 hover:bg-amber-500 hover:text-white transition-all flex items-center justify-center gap-3"
            >
              🔄 Arquivo de Inativos
            </button>
          </div>
        </aside>
      </div>

      {/* MODAIS DE FORMULÁRIO */}
      
      <AlunoFormModal 
        isOpen={isAlunoModalOpen} 
        onClose={fecharTodosModais}
        onSave={handleSave}
        alunoInicial={itemParaEditar}
        listaEscolas={escolas}
      />

      <EspecialidadeFormModal 
        isOpen={isEspecialidadeModalOpen}
        onClose={fecharTodosModais}
        onSave={handleSave}
        dadosIniciais={itemParaEditar}
      />

      <ProfissionalFormModal 
        isOpen={isProfissionalModalOpen}
        onClose={fecharTodosModais}
        onSave={handleSave}
        profissionalInicial={itemParaEditar}
        listaEspecialidades={especialidades}
      />

      <AgendamentoFormModal 
        isOpen={isAgendamentoModalOpen}
        onClose={fecharTodosModais}
        onSave={handleSave}
        agendamentoInicial={itemParaEditar}
        listaAlunos={alunos}
        listaProfissionais={profissionais}
      />

      <ReativarModal 
        isOpen={isReativarOpen}
        onClose={() => setIsReativarOpen(false)}
        tabela={activeTab}
        onReativar={fetchData}
      />

    </MainLayout>
  );
};

export default Dashboard;