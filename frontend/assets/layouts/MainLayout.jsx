import React from 'react';
import { Users, GraduationCap, HeartPulse, UserCheck, ShieldCheck, Key } from 'lucide-react';

const MainLayout = ({ user, children, activeTab, setActiveTab, onOpenPass }) => {
  const menuItems = [
    { name: 'Alunos', icon: <GraduationCap size={20} />, id: 'aee_alunos' },
    { name: 'Pais/Responsável', icon: <Users size={20} />, id: 'aee_usuarios_pais' },
    { name: 'Profissionais de Saúde', icon: <HeartPulse size={20} />, id: 'aee_profissionais_saude' },
    { name: 'Especialidades Médicas', icon: <ShieldCheck size={20} />, id: 'aee_especialidades' },
    { name: 'Usuários', icon: <UserCheck size={20} />, id: 'aee_usuarios_equipe' },
  ];

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      <aside className="w-64 bg-slate-900 text-white flex flex-col shadow-xl">
        <div className="p-6 border-b border-slate-800">
          <img src="/assets/logap.png" alt="Logo" className="h-10 object-contain mb-2" />
          <p className="text-[10px] text-blue-400 font-bold tracking-widest uppercase">Portal de Gestão AEE</p>
        </div>
        
        <nav className="flex-1 mt-4 px-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center p-3 mb-1 rounded-lg transition-all ${
                activeTab === item.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <span className="mr-3">{item.icon}</span>
              <span className="font-medium text-sm">{item.name}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b flex items-center justify-between px-8 shadow-sm">
          <div className="flex items-center space-x-2">
            <span className="text-slate-500 italic">Bem-vindo,</span>
            <span className="font-bold text-slate-800">{user?.nome}</span>
            <button 
              onClick={onOpenPass}
              className="ml-4 p-2 rounded-full hover:bg-blue-50 text-blue-600 transition-colors"
            >
              <Key size={18} />
            </button>
          </div>
          <div className="text-sm text-slate-400 font-medium">
            {new Date().toLocaleDateString('pt-BR')}
          </div>
        </header>

        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </main>
    </div>
  );
};

export default MainLayout;