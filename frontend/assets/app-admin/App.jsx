import React, { useState, useEffect } from 'react';

export default function App() {
  // Estados de Navegação e Dados
  const [aba, setAba] = useState('eventos');
  const [eventos, setEventos] = useState([]);
  const [professores, setProfessores] = useState([]);
  const [presencas, setPresencas] = useState([]);
  const [relatorioPeriodo, setRelatorioPeriodo] = useState([]);
  
  // Estados de Formulário
  const [datas, setDatas] = useState({ inicio: '', fim: '' });
  const [formEv, setFormEv] = useState({ 
    titulo: '', data_evento: '', carga_horaria: '', endereco: '', latitude: '', longitude: '' 
  });
  const [formProf, setFormProf] = useState({ 
    nome_completo: '', matricula: '', ativo: true 
  });

  const API = "https://api.paiva.api.br/api";

  // Carregamento de Dados Centralizado
  const carregarDados = () => {
    fetch(`${API}/admin/eventos`).then(r => r.json()).then(setEventos);
    fetch(`${API}/admin/professores`).then(r => r.json()).then(setProfessores);
    fetch(`${API}/admin/relatorio-geral`).then(r => r.json()).then(setPresencas);
  };

  useEffect(() => {
    carregarDados();
  }, [aba]);

  // Função para Imprimir QR Code Individual
  const imprimirQR = (token, titulo) => {
    const win = window.open('', 'PRINT');
    win.document.write(`
      <html>
        <body style="text-align:center;font-family:sans-serif;padding:50px;">
          <h1 style="font-size: 24pt;">${titulo}</h1>
          <div id="qr" style="display: flex; justify-content: center; margin: 40px 0;"></div>
          <p style="font-size: 14pt;">Aponte a câmera para registrar Entrada ou Saída</p>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
          <script>
            new QRCode(document.getElementById("qr"), {
              text: "${token}",
              width: 300,
              height: 300
            });
            setTimeout(() => { window.print(); window.close(); }, 500);
          </script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const gerarRelatorioMEC = () => {
    fetch(`${API}/admin/relatorio-periodo?inicio=${datas.inicio}&fim=${datas.fim}`)
      .then(r => r.json()).then(setRelatorioPeriodo);
  };

  const capturarLocalizacaoAdmin = () => {
    navigator.geolocation.getCurrentPosition(p => {
      setFormEv({ ...formEv, latitude: p.coords.latitude, longitude: p.coords.longitude });
    }, () => alert("Erro ao capturar localização. Verifique as permissões."));
  };

  const salvarEvento = (e) => {
    e.preventDefault();
    fetch(`${API}/admin/eventos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formEv)
    }).then(() => {
      alert("Evento criado com sucesso!");
      setFormEv({ titulo: '', data_evento: '', carga_horaria: '', endereco: '', latitude: '', longitude: '' });
      carregarDados();
    });
  };

  const salvarProfessor = (e) => {
    e.preventDefault();
    fetch(`${API}/admin/professores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formProf)
    }).then(() => {
      alert("Cadastro de professor atualizado!");
      setFormProf({ nome_completo: '', matricula: '', ativo: true });
      carregarDados();
    });
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Sidebar Fica Fixa */}
      <aside className="w-64 bg-slate-900 text-white p-6 flex flex-col shadow-2xl">
        <img src="/logap.png" className="w-40 mb-10 self-start" alt="Logo" />
        <nav className="space-y-4 flex-1">
          <button onClick={() => setAba('eventos')} className={`w-full text-left font-bold p-3 rounded-xl transition ${aba === 'eventos' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>📅 Gestão de Eventos</button>
          <button onClick={() => setAba('professores')} className={`w-full text-left font-bold p-3 rounded-xl transition ${aba === 'professores' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>👨‍🏫 Professores</button>
          <button onClick={() => setAba('relatorios')} className={`w-full text-left font-bold p-3 rounded-xl transition ${aba === 'relatorios' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>📊 Prestação de Contas</button>
        </nav>
      </aside>

      <main className="flex-1 p-10 overflow-y-auto">
        {/* ABA 1: EVENTOS */}
        {aba === 'eventos' && (
          <section>
            <h2 className="text-3xl font-black mb-6">Configurar Novo Evento</h2>
            <form onSubmit={salvarEvento} className="bg-white p-8 rounded-3xl shadow-sm border space-y-6 mb-10">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col"><label className="text-[10px] font-bold text-slate-400">TÍTULO</label><input className="border-b p-2 outline-none focus:border-blue-500" value={formEv.titulo} onChange={e => setFormEv({ ...formEv, titulo: e.target.value })} required /></div>
                <div className="flex flex-col"><label className="text-[10px] font-bold text-slate-400">DATA</label><input type="date" className="border-b p-2 outline-none" value={formEv.data_evento} onChange={e => setFormEv({ ...formEv, data_evento: e.target.value })} required /></div>
              </div>
              <div className="grid grid-cols-3 gap-4 items-end">
                <div className="flex flex-col"><label className="text-[10px] font-bold text-slate-400">CARGA (HS)</label><input type="number" step="0.1" className="border-b p-2 outline-none" value={formEv.carga_horaria} onChange={e => setFormEv({ ...formEv, carga_horaria: e.target.value })} required /></div>
                <div className="flex flex-col col-span-2"><label className="text-[10px] font-bold text-slate-400">ENDEREÇO</label><input className="border-b p-2 outline-none" value={formEv.endereco} onChange={e => setFormEv({ ...formEv, endereco: e.target.value })} required /></div>
              </div>
              <div className="flex gap-4 items-center bg-slate-50 p-4 rounded-xl">
                <div className="flex-1 text-xs font-mono text-slate-500">Coordenadas: {formEv.latitude || '0.00'}, {formEv.longitude || '0.00'}</div>
                <button type="button" onClick={capturarLocalizacaoAdmin} className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg font-bold text-sm">📍 Capturar Local do Evento</button>
              </div>
              <button className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-blue-200">CRIAR EVENTO COM GEOFENCING</button>
            </form>

            <h3 className="font-black text-xl mb-4">Eventos Ativos</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {eventos.map(ev => (
                <div key={ev.id} className="bg-white p-5 rounded-2xl border flex justify-between items-center shadow-sm">
                  <div>
                    <h4 className="font-bold text-slate-800">{ev.titulo}</h4>
                    <p className="text-xs text-slate-400">{new Date(ev.data_evento).toLocaleDateString()} • {ev.carga_horaria}h</p>
                    <p className="text-[10px] text-blue-500 font-mono mt-1">{ev.endereco}</p>
                  </div>
                  <button onClick={() => imprimirQR(ev.token_qr, ev.titulo)} className="bg-slate-900 text-white p-3 rounded-xl font-bold text-xs">🖨️ QR CODE</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ABA 2: PROFESSORES */}
        {aba === 'professores' && (
          <section>
            <h2 className="text-3xl font-black mb-6">Cadastro de Docentes</h2>
            <form onSubmit={salvarProfessor} className="bg-white p-6 rounded-2xl shadow-sm border flex gap-4 items-end mb-10">
              <input placeholder="Nome Completo" className="flex-1 border-b p-2 outline-none" value={formProf.nome_completo} onChange={e => setFormProf({ ...formProf, nome_completo: e.target.value })} required />
              <input placeholder="Matrícula" className="border-b p-2 outline-none" value={formProf.matricula} onChange={e => setFormProf({ ...formProf, matricula: e.target.value })} required />
              <select className="border-b p-2 outline-none" value={formProf.ativo} onChange={e => setFormProf({ ...formProf, ativo: e.target.value === 'true' })}>
                <option value="true">Ativo</option>
                <option value="false">Inativo</option>
              </select>
              <button className="bg-green-600 text-white px-6 py-3 rounded-xl font-bold">SALVAR</button>
            </form>

            <table className="w-full bg-white rounded-2xl overflow-hidden shadow-sm border">
              <thead className="bg-slate-100 text-xs text-slate-500 uppercase font-black">
                <tr className="text-left">
                  <th className="p-4">Nome</th><th className="p-4">Matrícula</th><th className="p-4 text-center">Status</th><th className="p-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {professores.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="p-4 font-bold">{p.nome_completo}</td>
                    <td className="p-4 text-slate-500">{p.matricula}</td>
                    <td className="p-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${p.ativo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {p.ativo ? 'ATIVO' : 'INATIVO'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <button onClick={() => setFormProf(p)} className="text-blue-600 font-bold hover:underline">Editar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* ABA 3: RELATÓRIOS */}
        {aba === 'relatorios' && (
          <section>
            <h2 className="text-3xl font-black mb-6">Prestação de Contas (MEC)</h2>
            
            {/* Filtros Período */}
            <div className="bg-white p-6 rounded-3xl border shadow-sm mb-10">
              <h4 className="font-bold text-slate-400 text-xs mb-4 uppercase">Filtrar por Período</h4>
              <div className="flex gap-4">
                <input type="date" className="p-3 border rounded-xl flex-1" onChange={e => setDatas({ ...datas, inicio: e.target.value })} />
                <input type="date" className="p-3 border rounded-xl flex-1" onChange={e => setDatas({ ...datas, fim: e.target.value })} />
                <button onClick={gerarRelatorioMEC} className="bg-indigo-600 text-white px-8 rounded-xl font-black">GERAR LISTAGEM</button>
              </div>
            </div>

            {/* Listagem do Período */}
            {relatorioPeriodo.length > 0 && (
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm border mb-10">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-800 text-white text-[10px] uppercase font-black">
                    <tr><th className="p-4">Evento</th><th className="p-4 text-center">Data</th><th className="p-4 text-center">Horas</th><th className="p-4 text-center">Total Presentes</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {relatorioPeriodo.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50 italic">
                        <td className="p-4 font-bold text-slate-800">{r.titulo}</td>
                        <td className="p-4 text-center text-slate-500">{new Date(r.data_evento).toLocaleDateString()}</td>
                        <td className="p-4 text-center text-indigo-600 font-black">{r.carga_horaria}h</td>
                        <td className="p-4 text-center text-slate-600 font-bold">{r.total_presentes} docentes</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h2 className="text-3xl font-black mb-6">Log de Frequência Individual</h2>
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-slate-500 text-[10px] uppercase font-black">
                  <tr><th className="p-4">Professor</th><th className="p-4">Evento</th><th className="p-4">Entrada</th><th className="p-4">Saída</th><th className="p-4">Duração</th></tr>
                </thead>
                <tbody className="text-sm divide-y">
                  {presencas.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="p-4 font-bold">{p.nome_completo}</td>
                      <td className="p-4 text-slate-500">{p.titulo}</td>
                      <td className="p-4 text-xs font-mono">{new Date(p.data_entrada).toLocaleString()}</td>
                      <td className="p-4 text-xs font-mono">{p.data_saida ? new Date(p.data_saida).toLocaleString() : '---'}</td>
                      <td className="p-4 font-mono font-black text-blue-600">
                        {p.permanencia_horas ? parseFloat(p.permanencia_horas).toFixed(2) + 'h' : 'Em curso'}
                      </td>
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