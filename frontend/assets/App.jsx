import React, { useState, useEffect } from 'react';

export default function App() {
  const [aba, setAba] = useState('eventos');
  const [eventos, setEventos] = useState([]);
  const [presencas, setPresencas] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [form, setForm] = useState({ titulo: '', data_evento: '', carga_horaria: '' });

  const API = "https://api.paiva.api.br/api";

  // Funções de carregamento isoladas
  const carregarEventos = () => fetch(`${API}/admin/eventos`).then(r => r.json()).then(setEventos);
  const carregarPresencas = () => fetch(`${API}/admin/relatorio-geral`).then(r => r.json()).then(setPresencas);

  useEffect(() => {
    carregarEventos();
    carregarPresencas();
  }, [aba]);

  const criarEvento = (e) => {
    e.preventDefault();
    fetch(`${API}/admin/eventos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    }).then(r => {
      if(r.ok) {
        alert("Evento criado com sucesso!");
        setForm({ titulo: '', data_evento: '', carga_horaria: '' });
        carregarEventos(); // <--- AQUI ESTÁ A MÁGICA: Atualiza a lista na hora!
      }
    });
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900">
      <aside className="w-64 bg-indigo-950 text-white p-6 shadow-2xl">
        <h1 className="text-2xl font-black mb-8 text-indigo-400 tracking-tighter">FORMAR.ADMIN</h1>
        <nav className="space-y-3">
          <button onClick={() => setAba('eventos')} className={`w-full text-left p-3 rounded-xl font-bold ${aba==='eventos'?'bg-indigo-600':'hover:bg-indigo-900'}`}>📅 Eventos</button>
          <button onClick={() => setAba('presencas')} className={`w-full text-left p-3 rounded-xl font-bold ${aba==='presencas'?'bg-indigo-600':'hover:bg-indigo-900'}`}>📝 Presenças</button>
        </nav>
      </aside>

      <main className="flex-1 p-10">
        {aba === 'eventos' ? (
          <div>
            <h2 className="text-3xl font-black mb-8">Gestão de Eventos</h2>
            <form onSubmit={criarEvento} className="grid grid-cols-4 gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-10">
              <input placeholder="Nome do Evento" className="col-span-2 border-b-2 p-2 outline-none focus:border-indigo-500" value={form.titulo} onChange={e=>setForm({...form, titulo: e.target.value})} required />
              <input type="date" className="border-b-2 p-2 outline-none" value={form.data_evento} onChange={e=>setForm({...form, data_evento: e.target.value})} required />
              <input type="number" placeholder="Horas" className="border-b-2 p-2 outline-none" value={form.carga_horaria} onChange={e=>setForm({...form, carga_horaria: e.target.value})} required />
              <button className="col-span-4 bg-indigo-600 text-white font-bold py-3 rounded-xl mt-4 hover:bg-indigo-700 transition">SALVAR NOVO EVENTO</button>
            </form>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-xs font-black uppercase text-slate-500">
                  <tr><th className="p-4">Título</th><th className="p-4">Data</th><th className="p-4">Carga</th><th className="p-4 text-right">Token</th></tr>
                </thead>
                <tbody className="divide-y">
                  {eventos.map(ev => (
                    <tr key={ev.id} className="hover:bg-slate-50 text-sm transition">
                      <td className="p-4 font-bold text-indigo-900">{ev.titulo}</td>
                      <td className="p-4">{new Date(ev.data_evento).toLocaleDateString('pt-BR')}</td>
                      <td className="p-4 font-medium">{ev.carga_horaria}h</td>
                      <td className="p-4 text-right font-mono text-xs text-slate-400">{ev.token_qr}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div>
             <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-black">Frequência Geral</h2>
              <input placeholder="Buscar por professor ou evento..." className="p-3 rounded-xl border border-slate-200 w-80 outline-none focus:ring-2 ring-indigo-500" onChange={e => setFiltro(e.target.value)} />
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100 text-xs font-black uppercase text-slate-500">
                  <tr><th className="p-4">Professor</th><th className="p-4">Evento</th><th className="p-4">Assinatura</th><th className="p-4 text-center">Ações</th></tr>
                </thead>
                <tbody className="divide-y text-sm">
                  {presencas.filter(p => p.nome_completo.toLowerCase().includes(filtro.toLowerCase())).map(p => (
                    <tr key={p.id} className="hover:bg-indigo-50/50 transition">
                      <td className="p-4"><div className="font-bold text-slate-800">{p.nome_completo}</div><div className="text-xs text-slate-400">{p.matricula}</div></td>
                      <td className="p-4 font-medium text-slate-700">{p.titulo} <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 rounded-full">{p.carga_horaria}h</span></td>
                      <td className="p-4 text-slate-500 italic">{new Date(p.data_assinatura).toLocaleString('pt-BR')}</td>
                      <td className="p-4 text-center"><button className="text-indigo-600 font-bold hover:underline">Ver Recibo</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}