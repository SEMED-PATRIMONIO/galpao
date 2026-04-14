import React, { useState, useEffect, useCallback } from 'react';
import MainLayout from '../layouts/MainLayout';
import DataTable from '../components/DataTable';
import ActionButtons from '../components/ActionButtons';
import AlunoFormModal from '../components/AlunoFormModal';
import EspecialidadeFormModal from '../components/EspecialidadeFormModal';
import ProfissionalFormModal from '../components/ProfissionalFormModal';
import AgendamentoFormModal from '../components/AgendamentoFormModal';
import EquipeFormModal from '../components/EquipeFormModal';
import PaisFormModal from '../components/PaisFormModal';
import EscolaFormModal from '../components/EscolaFormModal';
import ReativarModal from '../components/ReativarModal';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('aee_alunos');
  const [data, setData] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);

  // ✅ Modais existentes
  const [isAlunoModalOpen, setIsAlunoModalOpen] = useState(false);
  const [isEspecialidadeModalOpen, setIsEspecialidadeModalOpen] = useState(false);
  const [isProfissionalModalOpen, setIsProfissionalModalOpen] = useState(false);
  const [isAgendamentoModalOpen, setIsAgendamentoModalOpen] = useState(false);
  const [isReativarOpen, setIsReativarOpen] = useState(false);

  // ✅ Novos modais
  const [isEquipeModalOpen, setIsEquipeModalOpen] = useState(false);
  const [isPaisModalOpen, setIsPaisModalOpen] = useState(false);
  const [isEscolaModalOpen, setIsEscolaModalOpen] = useState(false);

  const [itemParaEditar, setItemParaEditar] = useState(null);
  const [especialidades, setEspecialidades] = useState([]);
  const [escolas, setEscolas] = useState([]);
  const [alunos, setAlunos] = useState([]);
  const [profissionais, setProfissionais] = useState([]);

  // ✅ Validação do token ao carregar
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      localStorage.clear();
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  // ✅ Colunas alinhadas ao banco real
  const columnConfig = {
    aee_alunos: [
      { key: 'id', label: 'ID' },
      { key: 'nome_completo', label: 'Nome do Aluno' },
      { key: 'ra', label: 'RA' },
      { key: 'escola', label: 'Unidade Escolar' }
    ],
    aee_usuarios_equipe: [
      { key: 'id', label: 'ID' },
      { key: 'login', label: 'Usuário' },
      { key: 'nome', label: 'Nome Completo' }
    ],
    aee_profissionais_saude: [
      { key: 'id', label: 'ID' },
      { key: 'nome', label: 'Profissional' },
      { key: 'login', label: 'Login' }
    ],
    aee_especialidades: [
      { key: 'id', label: 'ID' },
      { key: 'nome', label: 'Especialidade' }
    ],
    aee_escolas: [
      { key: 'id', label: 'ID' },
      { key: 'nome', label: 'Nome da Escola' }
    ],
    aee_usuarios_pais: [
      { key: 'id', label: 'ID' },
      { key: 'usuario', label: 'Usuário' },
      { key: 'aluno_id', label: 'ID do Aluno' }
    ],
    aee_agendamentos: [
      { key: 'id', label: 'Nº' },
      { key: 'aluno_nome', label: 'Aluno' },
      { key: 'profissional_nome', label: 'Profissional' },
      { key: 'data_hora', label: 'Data/Hora' },
      { key: 'status', label: 'Status' }
    ]
  };

  // ✅ Busca dados da aba ativa
  const fetchData = useCallback(async () => {
    setLoading(true);
    const tableParam = activeTab.replace('aee_', '');
    try {
      const response = await fetch(`/api/crud/${tableParam}`);
      const result = await response.json();
      setData(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  // ✅ Busca listas auxiliares
  const fetchAuxiliares = async () => {
    try {
      const [resEsp, resEsc, resAlu, resProf] = await Promise.all([
        fetch('/api/crud/especialidades'),
        fetch('/api/crud/escolas'),
        fetch('/api/crud/alunos'),
        fetch('/api/crud/profissionais')
      ]);
      setEspecialidades(await resEsp.json());
      setEscolas(await resEsc.json());
      setAlunos(await resAlu.json());
      setProfissionais(await resProf.json());
    } catch (e) {
      console.error('Erro ao carregar listas auxiliares:', e);
    }
  };

  useEffect(() => {
    fetchData();
    fetchAuxiliares();
    setSelectedId(null);
  }, [fetchData]);

  const handleAction = (action) => {
    if (action === 'incluir') {
      setItemParaEditar(null);
      abrirModalCorreto();
    } else if (action === 'editar' && selectedId) {
      const item = data.find((d) => d.id === selectedId);
      setItemParaEditar(item);
      abrirModalCorreto();
    } else if (action === 'inativar' && selectedId) {
      confirmarInativacao();
    }
  };

  // ✅ Abre o modal correto para TODAS as abas
  const abrirModalCorreto = () => {
    if (activeTab === 'aee_alunos') setIsAlunoModalOpen(true);
    if (activeTab === 'aee_especialidades') setIsEspecialidadeModalOpen(true);
    if (activeTab === 'aee_profissionais_saude') setIsProfissionalModalOpen(true);
    if (activeTab === 'aee_agendamentos') setIsAgendamentoModalOpen(true);
    if (activeTab === 'aee_usuarios_equipe') setIsEquipeModalOpen(true);
    if (activeTab === 'aee_usuarios_pais') setIsPaisModalOpen(true);
    if (activeTab === 'aee_escolas') setIsEscolaModalOpen(true);
  };

  // ✅ PATCH para inativar
  const confirmarInativacao = () => {
    Swal.fire({
      title: 'Inativar Registro?',
      text: 'O item será movido para o arquivo de inativos.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Sim, inativar',
      cancelButtonText: 'Cancelar'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const tableParam = activeTab.replace('aee_', '');
          const response = await fetch(
            `/api/crud/${tableParam}/${selectedId}/inativar`,
            { method: 'PATCH' }
          );
          if (!response.ok) throw new Error();
          fetchData();
          setSelectedId(null);
          Swal.fire('Inativado!', 'Registro movido para o arquivo.', 'success');
        } catch {
          Swal.fire('Erro', 'Não foi possível inativar o registro.', 'error');
        }
      }
    });
  };

  // ✅ Salvar (POST = incluir, PUT = editar)
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
        fetchAuxiliares();
      } else {
        const err = await response.json();
        throw new Error(err.error || 'Erro ao salvar');
      }
    } catch (error) {
      Swal.fire('Erro', error.message || 'Não foi possível salvar os dados.', 'error');
    }
  };

  const fecharTodosModais = () => {
    setIsAlunoModalOpen(false);
    setIsEspecialidadeModalOpen(false);
    setIsProfissionalModalOpen(false);
    setIsAgendamentoModalOpen(false);
    setIsEquipeModalOpen(false);
    setIsPaisModalOpen(false);
    setIsEscolaModalOpen(false);
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

      {/* ✅ TODOS OS MODAIS */}
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

      <EquipeFormModal
        isOpen={isEquipeModalOpen}
        onClose={fecharTodosModais}
        onSave={handleSave}
        usuarioInicial={itemParaEditar}
        listaEspecialidades={especialidades}
      />

      <PaisFormModal
        isOpen={isPaisModalOpen}
        onClose={fecharTodosModais}
        onSave={handleSave}
        paisInicial={itemParaEditar}
        listaAlunos={alunos}
      />

      <EscolaFormModal
        isOpen={isEscolaModalOpen}
        onClose={fecharTodosModais}
        onSave={handleSave}
        escolaInicial={itemParaEditar}
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