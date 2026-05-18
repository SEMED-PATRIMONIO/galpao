import React, { useState, useEffect } from 'react';

export default function App() {
  const [aba, setAba] = useState('eventos');
  const [eventos, setEventos] = useState([]);
  const [professores, setProfessores] = useState([]);
  const [locais, setLocais] = useState([]);
  const [presencas, setPresencas] = useState([]);
  const [relatorioPeriodo, setRelatorioPeriodo] = useState([]);
  const [datas, setDatas] = useState({ inicio: '', fim: '' });

  // Formulários
  const [formEv, setFormEv] = useState({ titulo: '', data_evento: '', carga_horaria: '', local_id: '' });
  const [formProf, setFormProf] = useState({ nome_completo: '', matricula: '', ativo: true });
  const [formLocal, setFormLocal] = useState({ id: null, nome: '', endereco: '', latitude: '', longitude: '', ativo: true });

  const API = "https://api.paiva.api.br/api";

  const carregarDados = () => {
    fetch(`${API}/admin/eventos`).then(r => r.json()).then(setEventos);
    fetch(`${API}/admin/professores`).then(r => r.json()).then(setProfessores);
    fetch(`${API}/admin/locais`).then(r => r.json()).then(setLocais);
    fetch(`${API}/admin/relatorio-geral`).then(r => r.json()).then(setPresencas);
  };

  useEffect(() => { carregarDados(); }, [aba]);

  const salvarEvento = (e) => {
    e.preventDefault();
    fetch(`${API}/admin/eventos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formEv)
    }).then(() => { setFormEv({ titulo: '', data_evento: '', carga_horaria: '', local_id: '' }); carregarDados(); });
  };

  const salvarLocal = (e) => {
    e.preventDefault();
    fetch(`${API}/admin/locais`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formLocal)
    }).then(() => { setFormLocal({ id: null, nome: '', endereco: '', latitude: '', longitude: '', ativo: true }); carregarDados(); });
  };

  const capturarLocalizacaoAdmin = () => {
    navigator.geolocation.getCurrentPosition(p => {
      setFormLocal({ ...formLocal, latitude: p.coords.latitude, longitude: p.coords.longitude });
    });
  };

  const gerarRelatorioMEC = () => {
    fetch(`${API}/admin/relatorio-periodo?inicio=${datas.inicio}&fim=${datas.fim}`)
      .then(r => r.json()).then(setRelatorioPeriodo);
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900">
      <aside className="w-64 bg-slate-900 text-white p-6 flex flex-col shadow-2xl">
        <img src="/logap.png" className="w-40 mb-10 self-start" alt="Logo" />
        <nav className="space-y-4 flex-1">
          <button onClick={() => setAba('eventos')} className={`w-full text-left font-bold p-3 rounded-xl transition ${aba === 'eventos' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>📅 Eventos</button>
          <button onClick={() => setAba('locais')} className={`w-full text-left font-bold p-3 rounded-xl transition ${aba === 'locais' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>📍 Gerenciar Locais</button>
          <button onClick={() => setAba('professores')} className={`w-full text-left font-bold p-3 rounded-xl transition ${aba === 'professores' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>👨‍🏫 Professores</button>
          <button onClick={() => setAba('relatorios')} className={`w-full text-left font-bold p-3 rounded-xl transition ${aba === 'relatorios' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>📊 Prestação de Contas</button>
        </nav>
      </aside>

      <main className="flex-1 p-10 overflow-y-auto">
        {/* ABA: EVENTOS */}
        {aba === 'eventos' && (
          <section>
            <h2 className="text-3xl font-black mb-6">Lançar Formação</h2>
            <form onSubmit={salvarEvento} className="bg-white p-8 rounded-3xl shadow-sm border space-y-4 mb-10">
              <input placeholder="Título do Evento" className="w-full border-b p-2 outline-none" value={formEv.titulo} onChange={e => setFormEv({ ...formEv, titulo: e.target.value })} required />
              <div className="grid grid-cols-3 gap-4">
                <input type="date" className="border-b p-2" value={formEv.data_evento} onChange={e => setFormEv({ ...formEv, data_evento: e.target.value })} required />
                <input placeholder="Horas (Ex: 3.5)" type="number" step="0.1" className="border-b p-2" value={formEv.carga_horaria} onChange={e => setFormEv({ ...formEv, carga_horaria: e.target.value })} required />
                <select className="border-b p-2 bg-white" value={formEv.local_id} onChange={e => setFormEv({ ...formEv, local_id: e.target.value })} required>
                  <option value="">Selecione o Local...</option>
                  {locais.filter(l => l.ativo).map(l => (<option key={l.id} value={l.id}>{l.nome}</option>))}
                </select>
              </div>
              <button className="w-full bg-blue-600 text-white p-4 rounded-xl font-black">PUBLICAR EVENTO</button>
            </form>

            <div className="grid grid-cols-2 gap-4">
              {eventos.map(ev => (
                <div key={ev.id} className="bg-white p-5 rounded-2xl border shadow-sm">
                  <h4 className="font-bold">{ev.titulo}</h4>
                  <p className="text-xs text-slate-400">{new Date(ev.data_evento).toLocaleDateString()} • {ev.carga_horaria}hs</p>
                  <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-1 rounded mt-2 inline-block">📍 {ev.local_nome}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ABA: CRUD LOCAIS */}
        {aba === 'locais' && (
          <section>
            <h2 className="text-3xl font-black mb-6">Hub de Localidades</h2>
            <form onSubmit={salvarLocal} className="bg-white p-6 rounded-2xl shadow-sm border space-y-4 mb-10">
              <div className="grid grid-cols-2 gap-4">
                <input placeholder="Nome do Prédio/Espaço" className="border-b p-2" value={formLocal.nome} onChange={e => setFormLocal({ ...formLocal, nome: e.target.value })} required />
                <input placeholder="Endereço Completo" className="border-b p-2" value={formLocal.endereco} onChange={e => setFormLocal({ ...formLocal, endereco: e.target.value })} required />
              </div>
              <div className="flex gap-4 items-center">
                <input placeholder="Latitude" className="border-b p-2 flex-1" value={formLocal.latitude} readOnly required />
                <input placeholder="Longitude" className="border-b p-2 flex-1" value={formLocal.longitude} readOnly required />
                <button type="button" onClick={capturarLocalizacaoAdmin} className="bg-slate-200 p-2 rounded-xl text-xs font-bold">📍 Obter GPS Atual</button>
              </div>
              <div className="flex gap-4">
                <select className="border-b p-2" value={formLocal.ativo} onChange={e => setFormLocal({ ...formLocal, ativo: e.target.value === 'true' })}>
                  <option value="true">Ativo para Eventos</option>
                  <option value="false">Inativo / Bloqueado</option>
                </select>
                <button className="bg-slate-900 text-white px-6 py-2 rounded-xl font-bold">Salvar Local</button>
              </div>
            </form>

            <table className="w-full bg-white rounded-2xl shadow-sm overflow-hidden">
              <thead className="bg-slate-100 text-xs font-black text-slate-500"><tr className="text-left"><th className="p-4">Local</th><th className="p-4">Endereço</th><th className="p-4 text-center">Status</th><th className="p-4 text-center">Ações</th></tr></thead>
              <tbody className="divide-y">
                {locais.map(l => (
                  <tr key={l.id}>
                    <td className="p-4 font-bold">{l.nome}</td>
                    <td className="p-4 text-slate-500 text-xs">{l.endereco}</td>
                    <td className="p-4 text-center"><span className={`px-2 py-1 rounded text-[10px] font-bold ${l.ativo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{l.ativo ? 'ATIVO' : 'INATIVO'}</span></td>
                    <td className="p-4 text-center"><button onClick={() => setFormLocal(l)} className="text-blue-600 font-bold text-xs underline">Editar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* ABA: PROFESSORES */}
        {aba === 'professores' && (
          <section>
            <h2 className="text-3xl font-black mb-6">Docentes</h2>
            <form onSubmit={(e) => { e.preventDefault(); fetch(`${API}/admin/professores`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formProf) }).then(() => carregarDados()); }} className="bg-white p-6 rounded-2xl shadow-sm border flex gap-4 items-end mb-10">
              <input placeholder="Nome Completo" className="flex-1 border-b p-2 outline-none" value={formProf.nome_completo} onChange={e => setFormProf({ ...formProf, nome_completo: e.target.value })} required />
              <input placeholder="Matrícula" className="border-b p-2 outline-none" value={formProf.matricula} onChange={e => setFormProf({ ...formProf, matricula: e.target.value })} required />
              <select className="border-b p-2 outline-none" value={formProf.ativo} onChange={e => setFormProf({ ...formProf, ativo: e.target.value === 'true' })}>
                <option value="true">Ativo</option>
                <option value="false">Inativo</option>
              </select>
              <button className="bg-green-600 text-white px-6 py-3 rounded-xl font-bold">SALVAR</button>
            </form>
            <table className="w-full bg-white rounded-2xl overflow-hidden border shadow-sm">
              <thead className="bg-slate-100 text-xs text-slate-500 uppercase font-black"><tr className="text-left"><th className="p-4">Nome</th><th className="p-4">Matrícula</th><th className="p-4 text-center">Status</th><th className="p-4 text-center">Ações</th></tr></thead>
              <tbody className="divide-y">
                {professores.map(p => (
                  <tr key={p.id}>
                    <td className="p-4 font-bold">{p.nome_completo}</td>
                    <td className="p-4">{p.matricula}</td>
                    <td className="p-4 text-center"><span className={`px-2 py-1 rounded text-[10px] font-bold ${p.ativo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{p.ativo ? 'ATIVO' : 'INATIVO'}</span></td>
                    <td className="p-4 text-center"><button onClick={() => setFormProf(p)} className="text-blue-600 underline text-xs font-bold">Editar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* ABA: RELATÓRIOS */}
        {aba === 'relatorios' && (
          <section>
            <h2 className="text-3xl font-black mb-6">Prestação de Contas (MEC)</h2>
            <div className="bg-white p-6 rounded-3xl border shadow-sm mb-10 flex gap-4">
              <input type="date" className="p-3 border rounded-xl flex-1" onChange={e => setDatas({ ...datas, inicio: e.target.value })} />
              <input type="date" className="p-3 border rounded-xl flex-1" onChange={e => setDatas({ ...datas, fim: e.target.value })} />
              <button onClick={gerarRelatorioMEC} className="bg-indigo-600 text-white px-8 rounded-xl font-black">GERAR LISTAGEM</button>
            </div>

            {relatorioPeriodo.length > 0 && (
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm border mb-10">
                <table className="w-full text-left">
                  <thead className="bg-slate-800 text-white text-[10px] uppercase font-black"><tr><th className="p-4">Evento</th><th className="p-4 text-center">Data</th><th className="p-4 text-center">Horas</th><th className="p-4 text-center">Inscritos</th></tr></thead>
                  <tbody className="divide-y">
                    {relatorioPeriodo.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50 italic">
                        <td className="p-4 font-bold text-slate-800">{r.titulo}</td>
                        <td className="p-4 text-center">{new Date(r.data_evento).toLocaleDateString()}</td>
                        <td className="p-4 text-center text-indigo-600 font-black">{r.carga_horaria}h</td>
                        <td className="p-4 text-center">{r.total_presentes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h3 className="text-xl font-black mb-4">Log Geral de Frequências</h3>
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-slate-500 text-[10px] uppercase font-black"><tr><th className="p-4">Professor</th><th className="p-4">Evento</th><th className="p-4">Entrada</th><th className="p-4">Saída</th><th className="p-4">Duração</th></tr></thead>
                <tbody className="text-sm divide-y">
                  {presencas.map(p => (
                    <tr key={p.id}>
                      <td className="p-4 font-bold">{p.nome_completo}</td>
                      <td className="p-4 text-slate-500">{p.titulo}</td>
                      <td className="p-4 text-xs font-mono">{new Date(p.data_entrada).toLocaleString()}</td>
                      <td className="p-4 text-xs font-mono">{p.data_saida ? new Date(p.data_saida).toLocaleString() : '---'}</td>
                      <td className="p-4 font-mono font-black text-blue-600">{p.permanencia_horas ? parseFloat(p.permanencia_horas).toFixed(2) + 'h' : 'Em andamento'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}