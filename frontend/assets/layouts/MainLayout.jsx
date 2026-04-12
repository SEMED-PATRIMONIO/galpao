// Exemplo conceitual do Componente MainLayout.jsx
import React, { useState } from 'react';
import { Users, GraduationCap, HeartPulse, UserCheck, ShieldCheck, Key } from 'lucide-react';

const MainLayout = ({ user, children }) => {
  const [activeMenu, setActiveMenu] = useState('Alunos');

  const menuItems = [
    { name: 'Alunos', icon: <GraduationCap size={20} />, table: 'aee_alunos' },
    { name: 'Pais/Responsável', icon: <Users size={20} />, table: 'aee_usuarios_pais' },
    { name: 'Profissionais de Saúde', icon: <HeartPulse size={20} />, table: 'aee_profissionais_saude' },
    { name: 'Especialidades Médicas', icon: <ShieldCheck size={20} />, table: 'aee_especialidades' },
    { name: 'Usuários', icon: <UserCheck size={20} />, table: 'aee_usuarios_equipe' },
  ];

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      {/* Sidebar Esquerda */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shadow-xl">
        <div className="p-6 border-b border-slate-800">
          <img src="/assets/logap.png" alt="Logo" className="h-10 object-contain mb-4" />
          <p className="text-xs text-blue-400 font-bold tracking-widest uppercase">Sistema AEE</p>
        </div>
        
        <nav className="flex-1 mt-4 px-2">
          {menuItems.map((item) => (
            <button
              key={item.name}
              onClick={() => setActiveMenu(item.name)}
              className={`w-full flex items-center p-3 mb-1 rounded-lg transition-all duration-200 group ${
                activeMenu === item.name 
                ? 'bg-blue-600 text-white shadow-lg' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
              title={`Gerenciar ${item.name}`}
            >
              <span className="mr-3">{item.icon}</span>
              <span className="font-medium">{item.name}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Área Principal */}
      <main className="flex-1 flex flex-col">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm">
          <div className="flex items-center space-x-2">
            <span className="text-slate-500 italic">Bem-vindo,</span>
            <span className="font-bold text-slate-800">{user.nome}</span>
            <button className="ml-4 p-1 rounded-full hover:bg-slate-100 text-blue-600 transition-colors" title="Alterar Senha">
              <Key size={18} />
            </button>
          </div>
          <div className="text-sm text-slate-400">
            {new Date().toLocaleDateString('pt-BR')}
          </div>
        </header>

        {/* Content & Actions Container */}
        <div className="flex-1 flex p-6 overflow-hidden">
          {/* Listagem Central */}
          <section className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-auto">
             {/* Componente de Tabela virá aqui na Parte 2 */}
          </section>

          {/* Sidebar de Ações Direita */}
          <aside className="w-48 ml-6 flex flex-col space-y-3">
             {/* Botões de Ação Dinâmicos */}
          </aside>
        </div>
      </main>
    </div>
  );
};