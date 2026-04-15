import React from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';

const MainLayout = ({ children, activeTab, setActiveTab }) => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  // ✅ Rótulos visuais alterados (ids internos mantidos para o banco)
  const menuItems = [
    { id: 'aee_alunos', label: 'Pacientes', icon: '🎓' },
    { id: 'aee_usuarios_equipe', label: 'Equipe', icon: '👥' },
    { id: 'aee_profissionais_saude', label: 'Profissionais', icon: '🩺' },
    { id: 'aee_especialidades', label: 'Especialidades', icon: '📑' },
    { id: 'aee_escolas', label: 'Estabelecimentos', icon: '🏫' },
    { id: 'aee_usuarios_pais', label: 'Pais / Responsáveis', icon: '🏠' },
  ];

  const handleLogout = () => {
    Swal.fire({
      title: 'Sair do Sistema?',
      text: 'Sua sessão será encerrada.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3b82f6',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Sim, sair',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        localStorage.clear();
        navigate('/login');
      }
    });
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">

      {/* SIDEBAR ESQUERDA */}
      <aside className="w-72 bg-slate-900 flex flex-col shadow-2xl z-50">

        {/* LOGO AREA */}
        <div className="p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center text-white font-black shadow-lg shadow-blue-500/20">
              AE
            </div>
            <div>
              {/* ✅ ALTERADO */}
              <h1 className="text-white font-black text-sm uppercase tracking-tighter leading-none">
                Atendimento Especializado
              </h1>
              <span className="text-blue-400 text-[10px] font-bold uppercase tracking-widest">
                Cadastro Azul
              </span>
            </div>
          </div>

          {/* NAVEGAÇÃO */}
          <nav className="space-y-2">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 ml-2">
              Menu Principal
            </p>

            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-200 
                  ${activeTab === item.id
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 translate-x-2'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
              >
                <span className="text-xl opacity-80">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* RODAPÉ SIDEBAR */}
        <div className="mt-auto p-6 border-t border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3 mb-6 px-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center text-white font-black border-2 border-slate-700">
              {user.login ? user.login.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-white text-xs font-black truncate uppercase">
                {user.nome || user.login || 'Usuário'}
              </p>
              <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest">
                Administrador
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-slate-800 text-red-400 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-red-500/10 hover:text-red-500 transition-all border border-slate-700"
          >
            🔌 Encerrar Sessão
          </button>
        </div>
      </aside>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Sistema Online • Base de Dados Ativa
            </span>
          </div>

          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </div>
        </header>

        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default MainLayout;