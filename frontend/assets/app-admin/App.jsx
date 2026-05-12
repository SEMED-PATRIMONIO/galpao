import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Users, FileText, Plus, Search, Download } from 'lucide-react';

export default function AppAdmin() {
  const [aba, setAba] = useState('dash');
  const [dados, setDados] = useState([]);
  const [filtro, setFiltro] = useState({ busca: '', evento: '' });
  const [eventos, setEventos] = useState([]);

  useEffect(() => {
    fetch('https://api.paiva.api.br/api/admin/eventos').then(r => r.json()).then(setEventos);
    carregarRelatorio();
  }, [filtro, aba]);

  const carregarRelatorio = () => {
    const params = new URLSearchParams(filtro).toString();
    fetch(`https://api.paiva.api.br/api/admin/relatorio-geral?${params}`)
      .then(r => r.json()).then(setDados);
  };

  return (
    <div className="flex h-screen bg-slate-100 text-slate-800 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 p-6 flex flex-col shadow-sm">
        <div className="flex items-center gap-3 mb-10 px-2">
          <img src="/logap.png" className="h-8" />
          <span className="font-black text-xl tracking-tighter text-blue-900">FORMAR</span>
        </div>
        <nav className="space-y-1">
          <button onClick={() => setAba('dash')} className={`w-full flex items-center gap-3 p-3 rounded-xl font-bold transition-all ${aba === 'dash' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-slate-400 hover:bg-slate-50'}`}><LayoutDashboard size={20}/> Dashboard</button>
          <button onClick={() => setAba('relatorio')} className={`w-full flex items-center gap-3 p-3 rounded-xl font-bold transition-all ${aba === 'relatorio' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-slate-400 hover:bg-slate-50'}`}><FileText size={20}/> Relatórios MEC</button>
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 p-10 overflow-y-auto">
        <header className="flex justify-between items-center mb-10">
          <h1 className="text-3xl font-black tracking-tight">{aba === 'dash' ? 'Visão Geral' : 'Relatório de Participações'}</h1>
          <div className="flex gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-slate-400" size={18} />
              <input className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 ring-blue-500 w-64" placeholder="Buscar professor ou matrícula..." onChange={e => setFiltro({...filtro, busca: e.target.value})} />
            </div>
            <button className="bg-slate-900 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2"><Download size={18}/> Exportar PDF</button>
          </div>
        </header>

        {/* Tabela de Relatório */}
        <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/40 border border-slate-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="p-6 text-xs font-black uppercase text-slate-400 tracking-widest">Professor</th>
                <th className="p-6 text-xs font-black uppercase text-slate-400 tracking-widest">Evento</th>
                <th className="p-6 text-xs font-black uppercase text-slate-400 tracking-widest text-center">Data</th>
                <th className="p-6 text-xs font-black uppercase text-slate-400 tracking-widest text-center">Carga</th>
                <th className="p-6 text-xs font-black uppercase text-slate-400 tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {dados.map(row => (
                <tr key={row.id} className="hover:bg-blue-50/50 transition-colors">
                  <td className="p-6">
                    <div className="font-bold text-slate-700">{row.nome_completo}</div>
                    <div className="text-xs text-slate-400">Matrícula: {row.matricula}</div>
                  </td>
                  <td className="p-6 font-medium text-slate-600">{row.titulo}</td>
                  <td className="p-6 text-center text-slate-500">{new Date(row.data_evento).toLocaleDateString('pt-BR')}</td>
                  <td className="p-6 text-center">
                    <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[10px] font-black">{row.carga_horaria}H</span>
                  </td>
                  <td className="p-6 text-right">
                    <button className="text-blue-600 font-bold text-sm hover:underline">Certificado</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}