import React, { useState, useEffect } from 'react';

export default function App() {
  const [aba, setAba] = useState('eventos');
  const [eventos, setEventos] = useState([]);
  const [professores, setProfessores] = useState([]);
  const [locais, setLocais] = useState([]);
  const [presencas, setPresencas] = useState([]);
  
  // Controle de Prestação de Contas
  const [subAbaRelatorio, setSubAbaRelatorio] = useState('geral'); // geral | individual | local
  const [relatorioGeral, setRelatorioGeral] = useState([]);
  const [relatorioIndividual, setRelatorioIndividual] = useState([]);
  const [relatorioLocal, setRelatorioLocal] = useState([]);
  const [datas, setDatas] = useState({ inicio: '', fim: '' });

  // Formulários
  const [formEv, setFormEv] = useState({ titulo: '', data_evento: '', hora_inicio: '', hora_fim: '', carga_horaria: '', local_id: '' });
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

  // Recálculo automático da carga horária baseado nos horários digitados
  useEffect(() => {
    if (formEv.hora_inicio && formEv.hora_fim) {
      const [hIni, mIni] = formEv.hora_inicio.split(':').map(Number);
      const [hFim, mFim] = formEv.hora_fim.split(':').map(Number);
      
      const minutosInicio = hIni * 60 + mIni;
      const minutosFim = hFim * 60 + mFim;

      if (minutosFim > minutosInicio) {
        const diffHoras = (minutosFim - minutosInicio) / 60;
        setFormEv(prev => ({ ...prev, carga_horaria: diffHoras.toFixed(1) }));
      } else {
        setFormEv(prev => ({ ...prev, carga_horaria: '' }));
      }
    }
  }, [formEv.hora_inicio, formEv.hora_fim]);

  const salvarEvento = (e) => {
    e.preventDefault();
    fetch(`${API}/admin/eventos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formEv)
    }).then(() => { 
      setFormEv({ titulo: '', data_evento: '', hora_inicio: '', hora_fim: '', carga_horaria: '', local_id: '' }); 
      carregarDados(); 
    });
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

  const puxarRelatoriosPeriodo = () => {
    if (!datas.inicio || !datas.fim) return alert("Selecione as datas de início e fim.");
    
    if (subAbaRelatorio === 'geral') {
      fetch(`${API}/admin/relatorio-periodo?inicio=${datas.inicio}&fim=${datas.fim}`)
        .then(r => r.json()).then(setRelatorioGeral);
    } else if (subAbaRelatorio === 'individual') {
      fetch(`${API}/admin/relatorio-individual?inicio=${datas.inicio}&fim=${datas.fim}`)
        .then(r => r.json()).then(setRelatorioIndividual);
    } else if (subAbaRelatorio === 'local') {
      fetch(`${API}/admin/relatorio-local?inicio=${datas.inicio}&fim=${datas.fim}`)
        .then(r => r.json()).then(setRelatorioLocal);
    }
  };

  // Executa a busca automaticamente se mudar de tipo de relatório mantendo o período
  useEffect(() => { if(datas.inicio && datas.fim) puxarRelatoriosPeriodo(); }, [subAbaRelatorio]);

  // Função Integrada de Impressão e Geração de PDF nativo
  const dispararImpressao = () => { window.print(); };

  // Sistema Dinâmico de Compartilhamento (WhatsApp / Web Share)
  const compartilharDados = () => {
    let textoComp = `*Relatório de Formação (${subAbaRelatorio.toUpperCase()})*\n`;
    textoComp += `Período: ${datas.inicio} até ${datas.fim}\n\n`;

    if (subAbaRelatorio === 'geral') {
      relatorioGeral.forEach(r => { textoComp += `• ${r.titulo}: ${r.total_presentes} presentes (${r.carga_horaria}h)\n`; });
    } else if (subAbaRelatorio === 'individual') {
      relatorioIndividual.forEach(r => { textoComp += `• ${r.nome_completo}: ${parseFloat(r.horas_validadas).toFixed(1)}h validadas\n`; });
    } else if (subAbaRelatorio === 'local') {
      relatorioLocal.forEach(r => { textoComp += `• ${r.local_nome}: ${r.total_atendimentos} check-ins\n`; });
    }

    if (navigator.share) {
      navigator.share({ title: 'Prestação de Contas Formar', text: textoComp }).catch(() => {});
    } else {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(textoComp)}`, '_blank');
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 print:bg-white">
      <aside className="w-64 bg-slate-900 text-white p-6 flex flex-col shadow-2xl print:hidden">
        <img src="/logap.png" className="w-40 mb-10 self-start" alt="Logo" />
        <nav className="space-y-4 flex-1">
          <button onClick={() => setAba('eventos')} className={`w-full text-left font-bold p-3 rounded-xl transition ${aba === 'eventos' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>📅 Eventos</button>
          <button onClick={() => setAba('locais')} className={`w-full text-left font-bold p-3 rounded-xl transition ${aba === 'locais' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>📍 Gerenciar Locais</button>
          <button onClick={() => setAba('professores')} className={`w-full text-left font-bold p-3 rounded-xl transition ${aba === 'professores' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>👨‍🏫 Professores</button>
          <button onClick={() => setAba('relatorios')} className={`w-full text-left font-bold p-3 rounded-xl transition ${aba === 'relatorios' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>📊 Prestação de Contas</button>
        </nav>
      </aside>

      <main className="flex-1 p-10 overflow-y-auto print:p-0">
        {/* ABA: EVENTOS */}
        {aba === 'eventos' && (
          <section className="print:hidden">
            <h2 className="text-3xl font-black mb-6">Lançar Formação</h2>
            <form onSubmit={salvarEvento} className="bg-white p-8 rounded-3xl shadow-sm border space-y-4 mb-10">
              <input placeholder="Título do Evento" className="w-full border-b p-2 outline-none text-lg font-bold" value={formEv.titulo} onChange={e => setFormEv({ ...formEv, titulo: e.target.value })} required />
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 items-end">
                <div className="flex flex-col"><label className="text-xs font-bold text-slate-400">Data do Evento</label><input type="date" className="border-b p-2" value={formEv.data_evento} onChange={e => setFormEv({ ...formEv, data_evento: e.target.value })} required /></div>
                <div className="flex flex-col"><label className="text-xs font-bold text-slate-400">Previsão Início</label><input type="time" className="border-b p-2" value={formEv.hora_inicio} onChange={e => setFormEv({ ...formEv, hora_inicio: e.target.value })} required /></div>
                <div className="flex flex-col"><label className="text-xs font-bold text-slate-400">Previsão Fim</label><input type="time" className="border-b p-2" value={formEv.hora_fim} onChange={e => setFormEv({ ...formEv, hora_fim: e.target.value })} required /></div>
                <div className="flex flex-col"><label className="text-xs font-bold text-blue-600">Horas Oferecidas</label><input placeholder="Autocalculado" type="number" step="0.1" className="border-b p-2 font-mono font-bold bg-slate-50 text-blue-600" value={formEv.carga_horaria} readOnly required /></div>
                <div className="flex flex-col"><label className="text-xs font-bold text-slate-400">Local Vinculado</label><select className="border-b p-2 bg-white" value={formEv.local_id} onChange={e => setFormEv({ ...formEv, local_id: e.target.value })} required><option value="">Selecione...</option>{locais.filter(l => l.ativo).map(l => (<option key={l.id} value={l.id}>{l.nome}</option>))}</select></div>
              </div>
              <button className="w-full bg-blue-600 text-white p-4 rounded-xl font-black tracking-wide">PUBLICAR EVENTO NO CIRCUITO</button>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {eventos.map(ev => (
                <div key={ev.id} className="bg-white p-5 rounded-2xl border shadow-sm">
                  <h4 className="font-bold text-base">{ev.titulo}</h4>
                  <p className="text-xs text-slate-400 mt-1">{new Date(ev.data_evento).toLocaleDateString()} • {ev.carga_horaria}hs calculadas ({ev.hora_inicio?.substring(0,5)}h às {ev.hora_fim?.substring(0,5)}h)</p>
                  <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-1 rounded mt-3 inline-block">📍 {ev.local_nome}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ABA: CRUD LOCAIS */}
        {aba === 'locais' && (
          <section className="print:hidden">
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
          <section className="print:hidden">
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

        {/* ABA: PRESTAÇÃO DE CONTAS MULTI-RELATÓRIOS */}
        {aba === 'relatorios' && (
          <section>
            <h2 className="text-3xl font-black mb-6 print:hidden">Prestação de Contas (MEC)</h2>
            
            {/* Filtros de Data Globais */}
            <div className="bg-white p-6 rounded-3xl border shadow-sm mb-6 flex flex-col sm:flex-row gap-4 items-end print:hidden">
              <div className="flex-1 w-full"><label className="text-xs font-bold text-slate-400">Data Inicial</label><input type="date" className="p-3 border rounded-xl w-full mt-1" value={datas.inicio} onChange={e => setDatas({ ...datas, inicio: e.target.value })} /></div>
              <div className="flex-1 w-full"><label className="text-xs font-bold text-slate-400">Data Final</label><input type="date" className="p-3 border rounded-xl w-full mt-1" value={datas.fim} onChange={e => setDatas({ ...datas, fim: e.target.value })} /></div>
              <button onClick={puxarRelatoriosPeriodo} className="bg-indigo-600 text-white px-8 py-3.5 rounded-xl font-black tracking-wide w-full sm:w-auto">COMPILAR FILTRO</button>
            </div>

            {/* Sub-Menu de Seleção do Tipo de Relatório */}
            <div className="flex border-b border-slate-200 mb-6 gap-2 print:hidden">
              <button onClick={() => setSubAbaRelatorio('geral')} className={`py-3 px-6 font-bold text-sm border-b-2 transition ${subAbaRelatorio === 'geral' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}>📋 Relatório Geral</button>
              <button onClick={() => setSubAbaRelatorio('individual')} className={`py-3 px-6 font-bold text-sm border-b-2 transition ${subAbaRelatorio === 'individual' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}>👨‍🏫 Relatório Individual</button>
              <button onClick={() => setSubAbaRelatorio('local')} className={`py-3 px-6 font-bold text-sm border-b-2 transition ${subAbaRelatorio === 'local' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}>📍 Relatório por Local</button>
            </div>

            {/* Painel de Ações de Exportação */}
            {(relatorioGeral.length > 0 || relatorioIndividual.length > 0 || relatorioLocal.length > 0) && (
              <div className="flex gap-3 justify-end mb-4 print:hidden">
                <button onClick={dispararImpressao} className="bg-slate-200 text-slate-800 text-xs font-black px-4 py-2 rounded-lg hover:bg-slate-300 transition">🖨️ IMPRIMIR / SALVAR PDF</button>
                <button onClick={compartilharDados} className="bg-green-600 text-white text-xs font-black px-4 py-2 rounded-lg hover:bg-green-500 transition">↗️ COMPARTILHAR EXPORTAÇÃO</button>
              </div>
            )}

            {/* Cabeçalho de Impressão Oficial */}
            <div className="hidden print:block text-center mb-8 border-b-2 border-slate-900 pb-4">
              <h1 className="text-2xl font-black uppercase">Ficha Oficial de Consolidação de Frequência</h1>
              <p className="text-sm font-mono mt-1">Período de Apuração: {new Date(datas.inicio).toLocaleDateString()} até {new Date(datas.fim).toLocaleDateString()}</p>
              <p className="text-[10px] text-slate-400 mt-2">Documento emitido digitalmente via Sistema Formar - qrcode.paiva.api.br</p>
            </div>

            {/* VISÃO: RELATÓRIO GERAL */}
            {subAbaRelatorio === 'geral' && relatorioGeral.length > 0 && (
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm border">
                <table className="w-full text-left">
                  <thead className="bg-slate-800 text-white text-[10px] uppercase font-black"><tr><th className="p-4">Formação Cadastrada</th><th className="p-4 text-center">Data</th><th className="p-4 text-center">Carga Alocada</th><th className="p-4 text-center">Presenças Homologadas</th></tr></thead>
                  <tbody className="divide-y text-sm">
                    {relatorioGeral.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-4 font-bold text-slate-800">{r.titulo}</td>
                        <td className="p-4 text-center">{new Date(r.data_evento).toLocaleDateString()}</td>
                        <td className="p-4 text-center text-indigo-600 font-mono font-black">{r.carga_horaria}h</td>
                        <td className="p-4 text-center font-bold">{r.total_presentes} docentes</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* VISÃO: RELATÓRIO INDIVIDUAL (NOVO) */}
            {subAbaRelatorio === 'individual' && relatorioIndividual.length > 0 && (
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm border">
                <table className="w-full text-left">
                  <thead className="bg-slate-800 text-white text-[10px] uppercase font-black"><tr><th className="p-4">Nome do Servidor</th><th className="p-4">Matrícula</th><th className="p-4 text-center">Eventos Atendidos</th><th className="p-4 text-center">Banco de Horas Validado</th></tr></thead>
                  <tbody className="divide-y text-sm">
                    {relatorioIndividual.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-4 font-bold text-slate-800">{r.nome_completo}</td>
                        <td className="p-4 font-mono text-xs">{r.matricula}</td>
                        <td className="p-4 text-center">{r.total_presencas} formações</td>
                        <td className="p-4 text-center text-emerald-600 font-mono font-black bg-emerald-50/40">{parseFloat(r.horas_validadas).toFixed(2)}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* VISÃO: RELATÓRIO POR LOCAL (NOVO) */}
            {subAbaRelatorio === 'local' && relatorioLocal.length > 0 && (
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm border">
                <table className="w-full text-left">
                  <thead className="bg-slate-800 text-white text-[10px] uppercase font-black"><tr><th className="p-4">Localização / Polo</th><th className="p-4">Endereço de Referência</th><th className="p-4 text-center">Formações Sedeadas</th><th className="p-4 text-center">Fluxo Total de Check-ins</th></tr></thead>
                  <tbody className="divide-y text-sm">
                    {relatorioLocal.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-4 font-bold text-slate-800">{r.local_nome}</td>
                        <td className="p-4 text-xs text-slate-500">{r.endereco}</td>
                        <td className="p-4 text-center font-bold">{r.total_eventos}</td>
                        <td className="p-4 text-center text-blue-600 font-black font-mono">{r.total_atendimentos} acessos</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}