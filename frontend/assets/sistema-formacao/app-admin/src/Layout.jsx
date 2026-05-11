import { LayoutDashboard, Users, FileCheck, Settings, LogOut } from 'lucide-react';

export default function AdminLayout({ children }) {
  return (
    <div className="flex h-screen bg-slate-100">
      {/* Sidebar - Inspirada na imagem GCR */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-b">
          <img src="/logo-prefeitura.png" alt="Logo" className="h-10" />
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <NavItem icon={<LayoutDashboard size={20}/>} label="Início" active />
          <NavItem icon={<Users size={20}/>} label="Participantes" />
          <NavItem icon={<FileCheck size={20}/>} label="Certificados" />
          <NavItem icon={<Settings size={20}/>} label="Configurações" />
        </nav>
        <div className="p-4 border-t text-slate-400 text-xs">Sistema Formar v1.0</div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-slate-800">Dashboard Administrativo</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Admin Queimados</span>
            <div className="w-10 h-10 bg-blue-600 rounded-full"></div>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

function NavItem({ icon, label, active = false }) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${active ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}>
      {icon}
      <span className="font-medium">{label}</span>
    </div>
  );
}