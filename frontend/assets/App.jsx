import React, { useState, useEffect, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

export default function App() {
  const [aba, setAba] = useState('eventos');
  const [eventos, setEventos] = useState([]);
  const [professores, setProfessores] = useState([]);
  const [presencas, setPresencas] = useState([]);
  const [formEv, setFormEv] = useState({ titulo: '', data_evento: '', carga_horaria: '' });
  const [formProf, setFormProf] = useState({ nome_completo: '', matricula: '', ativo: true });

  const API = "https://api.paiva.api.br/api";

  const carregarDados = () => {
    fetch(`${API}/admin/eventos`).then(r => r.json()).then(setEventos);
    fetch(`${API}/admin/professores`).then(r => r.json()).then(setProfessores);
    fetch(`${API}/admin/relatorio-geral`).then(r => r.json()).then(setPresencas);
  };

  useEffect(() => carregarDados(), [aba]);

  const imprimirQR = (token, titulo) => {
    const win = window.open('', 'PRINT');
    win.document.write(`<html><body style="text-align:center;font-family:sans-serif;padding:50px;">
      <h1>${titulo}</h1>
      <div id="qr"></div>
      <p>Aponte a câmera para registrar Entrada/Saída</p>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
      <script>new QRCode(document.getElementById("qr"), "${token}"); window.print();</script>
    </body></html>`);
    win.document.close();
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      <aside className="w-64 bg-slate-900 text-white p-6 flex flex-col shadow-2xl">
        <div className="mb-10">
          <img src="/logap.png" className="w-32 mb-4" alt="Logo" />
          <p className="text-xs font-bold text-blue-400 uppercase tracking-widest">Painel Gestor</p>
        </div>
        
        <nav className="flex-1 space-y-2">
          <button onClick={() => setAba('eventos')} className={`w-full text-left p-3 rounded-xl transition ${aba==='eventos'?'bg-blue-600 font-bold':'hover:bg-slate-800'}`}>📅 Eventos</button>
          <button onClick={() => setAba('professores')} className={`w-full text-left p-3 rounded-xl transition ${aba==='professores'?'bg-blue-600 font-bold':'hover:bg-slate-800'}`}>👨‍🏫 Professores</button>
          <button onClick={() => setAba('relatorios')} className={`w-full text-left p-3 rounded-xl transition ${aba==='relatorios'?'bg-blue-600 font-bold':'hover:bg-slate-800'}`}>📊 Relatórios</button>
        </nav>
      </aside>

      <main className="flex-1 p-10 overflow-y-auto">
        {aba === 'eventos' && (
          <section>
            <h2 className="text-3xl font-black mb-6">Eventos Flexíveis</h2>
            <form onSubmit={(e) => { e.preventDefault(); fetch(`${API}/admin/eventos`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(formEv)}).then(()=>carregarDados()) }} className="bg-white p-6 rounded-2xl shadow-sm border flex gap-4 items-end mb-10">
              <div className="flex-1">
                <label className="text-[10px] font-bold text-slate-400">TÍTULO</label>
                <input className="w-full border-b p-2 outline-none" value={formEv.titulo} onChange={e=>setFormEv({...formEv, titulo: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">DATA</label>
                <input type="date" className="w-full border-b p-2 outline-none" value={formEv.data_evento} onChange={e=>setFormEv({...formEv, data_evento: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">CARGA (EX: 3.5)</label>
                <input type="number" step="0.1" className="w-24 border-b p-2 outline-none" value={formEv.carga_horaria} onChange={e=>setFormEv({...formEv, carga_horaria: e.target.value})} />
              </div>
              <button className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold">CRIAR</button>
            </form>

            <div className="grid grid-cols-2 gap-4">
              {eventos.map(ev => (
                <div key={ev.id} className="bg-white p-4 rounded-2xl border flex justify-between items-center shadow-sm">
                  <div>
                    <h4 className="font-bold">{ev.titulo}</h4>
                    <p className="text-xs text-slate-400">{new Date(ev.data_evento).toLocaleDateString()} • {ev.carga_horaria}h</p>
                  </div>
                  <button onClick={() => imprimirQR(ev.token_qr, ev.titulo)} className="bg-slate-100 p-3 rounded-xl hover:bg-blue-50 text-blue-600 font-bold">🖨️ PDF QR</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {aba === 'professores' && (
          <section>
            <h2 className="text-3xl font-black mb-6">Cadastro de Docentes</h2>
            <form onSubmit={(e) => { e.preventDefault(); fetch(`${API}/admin/professores`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(formProf)}).then(()=>carregarDados()) }} className="bg-white p-6 rounded-2xl shadow-sm border flex gap-4 items-end mb-10">
              <input placeholder="Nome Completo" className="flex-1 border-b p-2 outline-none" value={formProf.nome_completo} onChange={e=>setFormProf({...formProf, nome_completo: e.target.value})} />
              <input placeholder="Matrícula" className="border-b p-2 outline-none" value={formProf.matricula} onChange={e=>setFormProf({...formProf, matricula: e.target.value})} />
              <select className="border-b p-2 outline-none" value={formProf.ativo} onChange={e=>setFormProf({...formProf, ativo: e.target.value === 'true'})}>
                <option value="true">Ativo</option>
                <option value="false">Inativo</option>
              </select>
              <button className="bg-green-600 text-white px-6 py-3 rounded-xl font-bold">SALVAR</button>
            </form>

            <table className="w-full bg-white rounded-2xl overflow-hidden shadow-sm">
              <thead className="bg-slate-100 text-xs text-slate-500 uppercase font-black"><tr className="text-left"><th className="p-4">Nome</th><th className="p-4">Matrícula</th><th className="p-4">Status</th><th className="p-4 text-center">Ações</th></tr></thead>
              <tbody className="divide-y">
                {professores.map(p => (
                  <tr key={p.id}>
                    <td className="p-4 font-bold">{p.nome_completo}</td>
                    <td className="p-4">{p.matricula}</td>
                    <td className="p-4 text-xs font-bold text-center">
                      <span className={p.ativo ? 'text-green-600 bg-green-50 px-2 py-1 rounded' : 'text-red-600 bg-red-50 px-2 py-1 rounded'}>{p.ativo ? 'ATIVO' : 'INATIVO'}</span>
                    </td>
                    <td className="p-4 text-center"><button onClick={() => setFormProf(p)} className="text-blue-600 underline">Editar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {aba === 'relatorios' && (
          <section>
            <h2 className="text-3xl font-black mb-6">Histórico de Permanência</h2>
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-900 text-white text-[10px] uppercase font-black">
                  <tr><th className="p-4">Professor</th><th className="p-4">Evento</th><th className="p-4">Entrada</th><th className="p-4">Saída</th><th className="p-4">Duração</th></tr>
                </thead>
                <tbody className="text-sm divide-y">
                  {presencas.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="p-4 font-bold">{p.nome_completo}</td>
                      <td className="p-4">{p.titulo}</td>
                      <td className="p-4 text-xs">{new Date(p.data_entrada).toLocaleString()}</td>
                      <td className="p-4 text-xs">{p.data_saida ? new Date(p.data_saida).toLocaleString() : '---'}</td>
                      <td className="p-4 font-mono font-bold text-blue-600">
                        {p.permanencia_horas ? parseFloat(p.permanencia_horas).toFixed(2) + 'h' : 'Em andamento'}
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