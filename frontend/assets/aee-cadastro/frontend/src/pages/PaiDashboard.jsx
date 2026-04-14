import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';

const PaiDashboard = () => {
  const [aluno, setAluno] = useState(null);
  const [agendamentos, setAgendamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  
  // Recupera os dados do pai logado
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    if (!user.aluno_id) {
      Swal.fire('Erro', 'Vínculo com aluno não encontrado.', 'error');
      navigate('/login-pais');
      return;
    }
    fetchDadosFilho();
  }, []);

  const fetchDadosFilho = async () => {
    try {
      // Busca dados do aluno e agendamentos vinculados ao aluno_id do pai
      const [resAluno, resAgenda] = await Promise.all([
        fetch(`/api/crud/alunos/${user.aluno_id}`),
        fetch(`/api/agendamentos/aluno/${user.aluno_id}`)
      ]);

      if (resAluno.ok && resAgenda.ok) {
        setAluno(await resAluno.json());
        setAgendamentos(await resAgenda.json());
      }
    } catch (error) {
      console.error("Erro ao carregar dados do portal da família:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login-pais');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="font-black text-blue-600 uppercase tracking-widest text-xs">Carregando Portal da Família...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* NAVBAR SUPERIOR */}
      <nav className="bg-white border-b border-blue-100 px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black">
            AE
          </div>
          <div>
            <h1 className="text-slate-800 font-black text-sm uppercase tracking-tighter">Portal da Família</h1>
            <p className="text-blue-500 text-[9px] font-bold uppercase tracking-widest">Acompanhamento Escolar</p>
          </div>
        </div>
        <button 
          onClick={handleLogout}
          className="px-4 py-2 bg-slate-100 text-slate-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-50 hover:text-red-500 transition-all"
        >
          Sair do Portal
        </button>
      </nav>

      <main className="max-w-5xl mx-auto p-6 md:p-10">
        
        {/* CABEÇALHO DE BOAS-VINDAS */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-[2.5rem] p-10 text-white mb-8 shadow-xl shadow-blue-200">
          <h2 className="text-3xl font-black uppercase tracking-tighter mb-2">
            Olá, {user.usuario}!
          </h2>
          <p className="text-blue-100 font-medium text-lg">
            Aqui você acompanha o progresso e os atendimentos de <strong>{aluno?.nome_completo}</strong>.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          
          {/* CARTÃO DO ALUNO */}
          <div className="md:col-span-1 space-y-6">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-blue-50">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Ficha do Aluno</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-[9px] font-bold text-blue-500 uppercase">RA (Registro)</label>
                  <p className="font-black text-slate-700">{aluno?.ra || '---'}</p>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-blue-500 uppercase">Unidade Escolar</label>
                  <p className="font-black text-slate-700 leading-tight">{aluno?.escola || '---'}</p>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-blue-500 uppercase">Status do Vínculo</label>
                  <span className="inline-block mt-1 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase">
                    Ativo no AEE
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 p-6 rounded-[2rem] border border-amber-100">
              <p className="text-[10px] text-amber-700 font-bold leading-relaxed uppercase">
                ⚠️ Caso haja alguma divergência nos dados do seu filho, entre em contato com a secretaria da escola.
              </p>
            </div>
          </div>

          {/* LISTA DE AGENDAMENTOS */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-blue-50 overflow-hidden">
              <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                <h3 className="font-black text-slate-800 uppercase tracking-tighter">Próximos Atendimentos</h3>
                <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black">
                  {agendamentos.length} AGENDADOS
                </span>
              </div>

              <div className="divide-y divide-slate-50">
                {agendamentos.length > 0 ? agendamentos.map((ag) => (
                  <div key={ag.id} className="p-6 hover:bg-slate-50 transition-colors flex items-center justify-between">
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 bg-blue-50 rounded-2xl flex flex-col items-center justify-center text-blue-600 border border-blue-100">
                        <span className="text-[10px] font-black uppercase">{new Date(ag.data_hora).toLocaleDateString('pt-BR', { month: 'short' })}</span>
                        <span className="text-lg font-black leading-none">{new Date(ag.data_hora).getDate()}</span>
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-800 uppercase">{ag.especialidade || 'Atendimento Geral'}</p>
                        <p className="text-xs font-bold text-slate-400">Prof: {ag.nome_profissional || 'A definir'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-slate-700">
                        {new Date(ag.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${
                        ag.status === 'Agendado' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'
                      }`}>
                        {ag.status}
                      </span>
                    </div>
                  </div>
                )) : (
                  <div className="p-20 text-center">
                    <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Nenhum atendimento agendado para as próximas semanas.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default PaiDashboard;