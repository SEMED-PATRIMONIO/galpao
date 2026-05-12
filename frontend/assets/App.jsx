import React, { useState, useEffect } from 'react';

export default function App() {
  const [aba, setAba] = useState('eventos'); // eventos, presencas
  const [eventos, setEventos] = useState([]);
  const [presencas, setPresencas] = useState([]);
  const [filtroBusca, setFiltroBusca] = useState('');
  const [novoEvento, setNovoEvento] = useState({ titulo: '', data_evento: '', carga_horaria: '' });

  const API = "https://api.paiva.api.br/api";

  useEffect(() => {
    carregarEventos();
    carregarPresencas();
  }, []);

  const carregarEventos = () => {
    fetch(`${API}/admin/eventos`).then(r => r.json()).then(setEventos);
  };

  const carregarPresencas = () => {
    fetch(`${API}/admin/relatorio-geral`).then(r => r.json()).then(setPresencas);
  };

  const addEvento = (e) => {
    e.preventDefault();
    fetch(`${API}/admin/eventos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(novoEvento)
    }).then(() => {
      setNovoEvento({ titulo: '', data_evento: '', carga_horaria: '' });
      carregarEventos();
    });
  };

  // Filtro de presenças
  const presencasFiltradas = presencas.filter(p => 
    p.nome_completo.toLowerCase().includes(filtroBusca.toLowerCase()) ||
    p.titulo.toLowerCase().includes(filtroBusca.toLowerCase())
  );

  return (
    <div className="flex min-h-screen bg-slate-100 font-sans">
      {/* Sidebar Lateral */}
      <aside className="w-64 bg-slate-900 text-white p-6 shadow-xl">
        <div className="mb-10 text-center">
          <img src="/logap.png" className="h-12 mx-auto mb-2" alt="Logo" />
          <h1 className="text-xl font-black tracking-tighter text-blue-400">FORMAR ADMIN</h1>
        </div>
        <nav className="space-y-2">
          <button onClick={() => setAba('eventos')} className={`w-full text-left p-3 rounded-lg font-bold transition ${aba === 'eventos' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>📅 Gestão de Eventos</button>
          <button onClick={() => setAba('presencas')} className={`w-full text-left p-3 rounded-lg font-bold transition ${aba === 'presencas' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>📝 Lista de Presenças</button>
        </nav>
      </aside>

      {/* Área Principal */}
      <main className="flex-1 p-8">
        {aba === 'eventos' ? (
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-black mb-6 text-slate-800">Novo Evento</h2>
            <form onSubmit={addEvento} className="bg-white p-6 rounded-2xl shadow-sm mb-10 flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Título do Evento</label>
                <input required className="w-full border-b-2 border-slate-100 focus:border-blue-500 outline-none py-2" value={novoEvento.titulo} onChange={e => setNovoEvento({...novoEvento, titulo: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Data</label>
                <input type="date" required className="w-full border-b-2 border-slate-100 focus:border-blue-500 outline-none py-2" value={novoEvento.data_evento} onChange={e => setNovoEvento({...novoEvento, data_evento: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Carga (h)</label>
                <input type="number" required className="w-20 border-b-2 border-slate-100 focus:border-blue-500 outline-none py-2" value={novoEvento.carga_horaria} onChange={e => setNovoEvento({...novoEvento, carga_horaria: e.target.value})} />
              </div>
              <button type="submit" className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-100">CRIAR</button>
            </form>

            <h2 className="text-xl font-bold mb-4 text-slate-600">Eventos Cadastrados</h2>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {eventos.map(ev => (
                <div key={ev.id} className="p-4 border-b border-slate-50 flex justify-between items-center hover:bg-slate-50">
                  <div>
                    <h4 className="font-bold text-slate-800">{ev.titulo}</h4>
                    <p className="text-sm text-slate-400">{new Date(ev.data_evento).toLocaleDateString('pt-BR')} • {ev.carga_horaria} horas</p>
                  </div>
                  <div className="text-xs font-mono bg-slate-100 p-2 rounded">Token: {ev.token_qr || 'automático'}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-black text-slate-800">Frequência Geral</h2>
              <input className="bg-white border border-slate-200 rounded-xl px-4 py-2 outline-none focus:ring-2 ring-blue-500 w-80" placeholder="Filtrar por professor ou evento..." onChange={e => setFiltroBusca(e.target.value)} />
            </div>

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 text-xs uppercase font-black">
                    <th className="p-4">Professor / Matrícula</th>
                    <th className="p-4">Evento</th>
                    <th className="p-4">Data Registro</th>
                    <th className="p-4 text-center">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {presencasFiltradas.map(p => (
                    <tr key={p.id} className="hover:bg-blue-50/30">
                      <td className="p-4">
                        <div className="font-bold text-slate-700">{p.nome_completo}</div>
                        <div className="text-xs text-slate-400">{p.matricula}</div>
                      </td>
                      <td className="p-4 font-medium">{p.titulo}</td>
                      <td className="p-4 text-slate-500">{new Date(p.data_assinatura).toLocaleString('pt-BR')}</td>
                      <td className="p-4 text-center">
                        <button className="text-blue-600 font-bold hover:underline">Certificado</button>
                      </td>
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