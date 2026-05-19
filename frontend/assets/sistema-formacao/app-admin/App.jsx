// ============================================================================
// ARQUIVO: app-admin/src/App.jsx — PARTE 1 DE 2 (ESTADOS, API E HANDLERS)
// ============================================================================

import React, { useState, useEffect } from 'react';

const API_URL = 'https://qrcode.paiva.api.br/api';

export default function App() {
  // Controle de Navegação e Carregamento
  const [abaAtual, setAbaAtual] = useState('dashboard');
  const [carregando, setCarregando] = useState(false);

  // Estados dos Dados do Banco de Dados
  const [usuarios, setUsuarios] = useState([]);
  const [locais, setLocais] = useState([]);
  const [publicosAlvo, setPublicosAlvo] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [eventosFiltradosRel, setEventosFiltradosRel] = useState([]);

  // Estados dos Formulários de Cadastro/Edição
  const [formUsuario, setFormUsuario] = useState({ id: null, nome: '', email: '', perfil: 'professor' });
  const [formLocal, setFormLocal] = useState({ id: null, nome: '' });
  const [formPublicoAlvo, setFormPublicoAlvo] = useState({ id: null, nome: '' });
  const [formEvento, setFormEvento] = useState({
    id: null, titulo: '', data: '', horario_inicio: '', horario_fim: '', local_id: '', publico_alvo_id: ''
  });

  // Estado dos Filtros do Relatório
  const [filtroRelPublico, setFiltroRelPublico] = useState({ inicio: '', fim: '', publico_alvo_id: '' });

  // Funções Utilitárias
  const calcularCargaHoraria = (inicio, fim) => {
    if (!inicio || !fim) return 0;
    const [hInicio, mInicio] = inicio.split(':').map(Number);
    const [hFim, mFim] = fim.split(':').map(Number);
    const diff = (hFim + mFim / 60) - (hInicio + mInicio / 60);
    return diff > 0 ? diff.toFixed(1) : 0;
  };

  // ============================================================================
  // INTEGRAÇÃO COM AS ROTAS DO BACKEND (FETCH ASSÍNCRONO REAL)
  // ============================================================================
  
  const buscarUsuarios = async () => {
    setCarregando(true);
    try {
      const res = await fetch(`${API_URL}/usuarios`);
      if (!res.ok) throw new Error('Erro ao obter usuários');
      const dados = await res.json();
      setUsuarios(dados);
    } catch (err) {
      console.error(err);
      alert('Não foi possível carregar os usuários do banco de dados.');
    } finally {
      setCarregando(false);
    }
  };

  const buscarLocais = async () => {
    setCarregando(true);
    try {
      const res = await fetch(`${API_URL}/locais`);
      if (!res.ok) throw new Error('Erro ao obter locais');
      const dados = await res.json();
      setLocais(dados);
    } catch (err) {
      console.error(err);
      alert('Não foi possível carregar os locais do banco de dados.');
    } finally {
      setCarregando(false);
    }
  };

  const buscarPublicos = async () => {
    setCarregando(true);
    try {
      const res = await fetch(`${API_URL}/publicos`);
      if (!res.ok) throw new Error('Erro ao obter públicos-alvo');
      const dados = await res.json();
      setPublicosAlvo(dados);
    } catch (err) {
      console.error(err);
      alert('Não foi possível carregar os públicos-alvo do banco de dados.');
    } finally {
      setCarregando(false);
    }
  };

  const buscarEventos = async () => {
    setCarregando(true);
    try {
      const res = await fetch(`${API_URL}/eventos`);
      if (!res.ok) throw new Error('Erro ao obter eventos');
      const dados = await res.json();
      setEventos(dados);
    } catch (err) {
      console.error(err);
      alert('Não foi possível carregar os eventos do banco de dados.');
    } finally {
      setCarregando(false);
    }
  };

  const filtrarRelatorioPublico = async (e) => {
    if (e) e.preventDefault();
    setCarregando(true);
    try {
      const params = new URLSearchParams({
        data_inicio: filtroRelPublico.inicio,
        data_fim: filtroRelPublico.fim,
        publico_alvo_id: filtroRelPublico.publico_alvo_id
      });
      const res = await fetch(`${API_URL}/relatorios/publico?${params.toString()}`);
      if (!res.ok) throw new Error('Erro ao filtrar relatório');
      const dados = await res.json();
      setEventosFiltradosRel(dados);
    } catch (err) {
      console.error(err);
      alert('Erro ao processar filtros do relatório.');
    } finally {
      setCarregando(false);
    }
  };

  // Efeito colateral para recarregar dados dinamicamente conforme aba ativa
  useEffect(() => {
    if (abaAtual === 'dashboard') {
      buscarUsuarios(); buscarLocais(); buscarPublicos(); buscarEventos();
    } else if (abaAtual === 'usuarios') {
      buscarUsuarios();
    } else if (abaAtual === 'locais') {
      buscarLocais();
    } else if (abaAtual === 'publicos') {
      buscarPublicos();
    } else if (abaAtual === 'eventos') {
      buscarEventos(); buscarLocais(); buscarPublicos();
    } else if (abaAtual === 'rel_publico') {
      buscarPublicos();
      filtrarRelatorioPublico();
    }
  }, [abaAtual]);

  // ============================================================================
  // PROCESSAMENTO DAS OPERAÇÕES DO BANCO DE DADOS (SUBMIT HANDLERS)
  // ============================================================================

  const handleSalvarUsuario = async (e) => {
    e.preventDefault();
    const metodo = formUsuario.id ? 'PUT' : 'POST';
    const endpoint = formUsuario.id ? `${API_URL}/usuarios/${formUsuario.id}` : `${API_URL}/usuarios`;

    try {
      const res = await fetch(endpoint, {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formUsuario)
      });
      const respostaApi = await res.json();

      if (!res.ok) throw new Error(respostaApi.mensagem || 'Erro na operação');

      alert(formUsuario.id ? 'Usuário atualizado com sucesso!' : 'Usuário cadastrado com sucesso!');
      setFormUsuario({ id: null, nome: '', email: '', perfil: 'professor' });
      buscarUsuarios();
    } catch (err) {
      alert(err.message);
    }
  };

  const toggleStatusUsuario = async (usuario) => {
    try {
      const res = await fetch(`${API_URL}/usuarios/${usuario.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !usuario.ativo })
      });
      if (!res.ok) throw new Error('Erro ao alterar status');
      buscarUsuarios();
    } catch (err) {
      alert('Erro ao alterar o status do usuário.');
    }
  };

  const handleSalvarLocal = async (e) => {
    e.preventDefault();
    const metodo = formLocal.id ? 'PUT' : 'POST';
    const endpoint = formLocal.id ? `${API_URL}/locais/${formLocal.id}` : `${API_URL}/locais`;

    try {
      const res = await fetch(endpoint, {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formLocal)
      });
      if (!res.ok) throw new Error('Erro na operação de local');
      
      alert(formLocal.id ? 'Sede atualizada com sucesso!' : 'Local cadastrado com sucesso!');
      setFormLocal({ id: null, nome: '' });
      buscarLocais();
    } catch (err) {
      alert(err.message);
    }
  };

  const toggleStatusLocal = async (local) => {
    try {
      const res = await fetch(`${API_URL}/locais/${local.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !local.ativo })
      });
      if (!res.ok) throw new Error('Erro ao alterar status');
      buscarLocais();
    } catch (err) {
      alert('Erro ao alterar status do local.');
    }
  };

  const handleSalvarPublico = async (e) => {
    e.preventDefault();
    const metodo = formPublicoAlvo.id ? 'PUT' : 'POST';
    const endpoint = formPublicoAlvo.id ? `${API_URL}/publicos/${formPublicoAlvo.id}` : `${API_URL}/publicos`;

    try {
      const res = await fetch(endpoint, {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formPublicoAlvo)
      });
      if (!res.ok) throw new Error('Erro na operação de público');

      alert(formPublicoAlvo.id ? 'Alvo atualizado com sucesso!' : 'Público-Alvo cadastrado com sucesso!');
      setFormPublicoAlvo({ id: null, nome: '' });
      buscarPublicos();
    } catch (err) {
      alert(err.message);
    }
  };

  const toggleStatusPublico = async (pub) => {
    try {
      const res = await fetch(`${API_URL}/publicos/${pub.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !pub.ativo })
      });
      if (!res.ok) throw new Error('Erro ao alterar status');
      buscarPublicos();
    } catch (err) {
      alert('Erro ao alterar status do público.');
    }
  };

  const handleSalvarEvento = async (e) => {
    e.preventDefault();
    const cargaCalculada = calcularCargaHoraria(formEvento.horario_inicio, formEvento.horario_fim);
    if (cargaCalculada <= 0) {
      alert('Inconsistência de horário: O término previsto deve ser maior que o início do evento.');
      return;
    }

    const metodo = formEvento.id ? 'PUT' : 'POST';
    const endpoint = formEvento.id ? `${API_URL}/eventos/${formEvento.id}` : `${API_URL}/eventos`;

    try {
      const res = await fetch(endpoint, {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formEvento)
      });
      const respostaApi = await res.json();
      if (!res.ok) throw new Error(respostaApi.mensagem || 'Erro na operação de evento');

      alert(formEvento.id ? 'Evento modificado com sucesso!' : 'Novo evento agendado e salvo no banco!');
      setFormEvento({ id: null, titulo: '', data: '', horario_inicio: '', horario_fim: '', local_id: '', publico_alvo_id: '' });
      buscarEventos();
    } catch (err) {
      alert(err.message);
    }
  };

  const toggleStatusEvento = async (ev) => {
    try {
      const res = await fetch(`${API_URL}/eventos/${ev.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !ev.ativo })
      });
      if (!res.ok) throw new Error('Erro ao alterar status');
      buscarEventos();
    } catch (err) {
      alert('Erro ao alterar status do evento.');
    }
  };

  // Itens fixos do menu lateral
  const itensMenu = [
    { id: 'dashboard', label: '📊 Painel Consolidado' },
    { id: 'usuarios', label: '👥 Controle de Usuários' },
    { id: 'publicos', label: '🎯 Público-Alvo' },
    { id: 'eventos', label: '📅 Gestão de Eventos' },
    { id: 'locais', label: '📍 Controle de Locais' },
    { id: 'rel_publico', label: '🎯 Filtro por Público' }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col md:flex-row">
      {/* SIDEBAR LATERAL — LAYOUT DA INTERFACE VISUAL */}
      <aside className="w-full md:w-64 bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 p-6 flex flex-col justify-between shrink-0">
        <div className="space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h1 className="text-md font-black tracking-widest text-blue-500 uppercase">QR Code Paiva</h1>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">MÓDULO ADMINISTRATIVO v2.5</p>
          </div>
          <nav className="space-y-1">
            {itensMenu.map((item) => (
              <button
                key={item.id}
                onClick={() => setAbaAtual(item.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                  abaAtual === item.id 
                    ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' 
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="pt-6 border-t border-slate-800 mt-6 hidden md:block">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <p className="text-[10px] text-slate-400 font-bold">Banco PostgreSQL Conectado</p>
          </div>
        </div>
      </aside>


      <main className="flex-1 p-4 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full"></main>

        {carregando && (
          <div className="fixed bottom-6 right-6 bg-blue-600 text-white font-black px-4 py-2.5 rounded-xl text-xs tracking-wider uppercase shadow-2xl animate-pulse z-50 border border-blue-400/30 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
            Comunicando com PostgreSQL...
          </div>
        )}

        {abaAtual === 'dashboard' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black text-white">Painel Consolidado</h2>
              <p className="text-xs text-slate-400 mt-1">Indicadores e volumetria geral extraídos do banco de dados.</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-sm">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Docentes Cadastrados</p>
                <p className="text-2xl font-black text-white mt-2 font-mono">{usuarios.filter(u => u.perfil === 'professor').length}</p>
              </div>
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-sm">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Locais Sedes Ativos</p>
                <p className="text-2xl font-black text-emerald-400 mt-2 font-mono">{locais.filter(l => l.ativo).length}</p>
              </div>
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-sm">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Públicos-Alvo Mapeados</p>
                <p className="text-2xl font-black text-blue-400 mt-2 font-mono">{publicosAlvo.length}</p>
              </div>
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-sm">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Eventos Oferecidos</p>
                <p className="text-2xl font-black text-amber-400 mt-2 font-mono">{eventos.length}</p>
              </div>
            </div>

            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
              <h3 className="text-xs font-black uppercase text-slate-300 tracking-wider mb-4">Próximos Eventos na Agenda</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-bold font-mono text-[11px]"><th className="pb-3">Evento</th><th className="pb-3">Data/Hora</th><th className="pb-3">Sede</th><th className="pb-3 text-center">Status</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {eventos.slice(0, 5).map(ev => (
                      <tr key={ev.id} className="hover:bg-slate-800/10">
                        <td className="py-3 font-bold text-white max-w-[220px] truncate">{ev.titulo}</td>
                        <td className="py-3 font-mono text-slate-300">{ev.data} <span className="text-[10px] text-slate-500 ml-1">({ev.horario_inicio} - {ev.horario_fim})</span></td>
                        <td className="py-3 text-slate-400">{ev.local_nome || 'Não Definido'}</td>
                        <td className="py-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ev.ativo ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                            {ev.ativo ? 'Agendado' : 'Cancelado'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {abaAtual === 'usuarios' && (
          <div className="space-y-6">
            <h2 className="text-xl font-black text-white">Controle de Usuários</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <form onSubmit={handleSalvarUsuario} className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4 h-fit">
                <h3 className="text-xs font-black text-slate-300 uppercase tracking-wider">{formUsuario.id ? 'Editar Usuário' : 'Novo Usuário'}</h3>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400">Nome Completo</label>
                  <input type="text" className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-xs mt-1 outline-none text-white focus:border-blue-500" value={formUsuario.nome} onChange={e => setFormUsuario({...formUsuario, nome: e.target.value})} placeholder="Ex: Professor da Silva" required />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400">E-mail Institucional</label>
                  <input type="email" className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-xs mt-1 outline-none text-white focus:border-blue-500 font-mono" value={formUsuario.email} onChange={e => setFormUsuario({...formUsuario, email: e.target.value})} placeholder="nome@paiva.br" required />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400">Perfil de Acesso</label>
                  <select className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-xs mt-1 outline-none text-white focus:border-blue-500 font-bold" value={formUsuario.perfil} onChange={e => setFormUsuario({...formUsuario, perfil: e.target.value})}>
                    <option value="professor">Professor / Docente</option>
                    <option value="admin">Administrador Geral</option>
                  </select>
                </div>
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold p-2.5 rounded-xl text-xs transition">Salvar Usuário</button>
              </form>
              <div className="lg:col-span-2 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 font-mono text-[11px]">
                    <tr><th className="p-4">Nome / Email</th><th className="p-4">Perfil</th><th className="p-4 text-center">Ações</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {usuarios.map(u => (
                      <tr key={u.id} className="hover:bg-slate-800/20">
                        <td className="p-4"><p className="font-bold text-white">{u.nome}</p><p className="text-[10px] text-slate-500 font-mono">{u.email}</p></td>
                        <td className="p-4 uppercase text-[10px] font-bold"><span className={u.perfil === 'admin' ? 'text-blue-400' : 'text-slate-400'}>{u.perfil}</span></td>
                        <td className="p-4 flex items-center justify-center gap-4">
                          <button onClick={() => setFormUsuario({ id: u.id, nome: u.nome, email: u.email, perfil: u.perfil })} className="text-blue-400 hover:underline font-bold">Editar</button>
                          <button onClick={() => toggleStatusUsuario(u)} className={`px-2 py-0.5 rounded text-[10px] font-black ${u.ativo ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>{u.ativo ? 'Ativo' : 'Inativo'}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {abaAtual === 'publicos' && (
          <div className="space-y-6">
            <h2 className="text-xl font-black text-white">Gestão de Público-Alvo</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <form onSubmit={handleSalvarPublico} className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4 h-fit">
                <h3 className="text-xs font-black text-slate-300 uppercase tracking-wider">{formPublicoAlvo.id ? 'Editar Público' : 'Novo Público'}</h3>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400">Descrição do Público</label>
                  <input type="text" className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-xs mt-1 outline-none text-white focus:border-blue-500" value={formPublicoAlvo.nome} onChange={e => setFormPublicoAlvo({...formPublicoAlvo, nome: e.target.value})} placeholder="Ex: Professores do Ensino Fundamental" required />
                </div>
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold p-2.5 rounded-xl text-xs transition">Salvar Público</button>
              </form>
              <div className="lg:col-span-2 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 font-mono text-[11px]">
                    <tr><th className="p-4">Público-Alvo</th><th className="p-4 text-center">Ações</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {publicosAlvo.map(p => (
                      <tr key={p.id} className="hover:bg-slate-800/20">
                        <td className="p-4 font-bold text-white">{p.nome}</td>
                        <td className="p-4 flex items-center justify-center gap-4">
                          <button onClick={() => setFormPublicoAlvo({ id: p.id, nome: p.nome })} className="text-blue-400 hover:underline font-bold">Editar</button>
                          <button onClick={() => toggleStatusPublico(p)} className={`px-2 py-0.5 rounded text-[10px] font-black ${p.ativo ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>{p.ativo ? 'Ativo' : 'Inativo'}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {abaAtual === 'eventos' && (
          <div className="space-y-6">
            <h2 className="text-xl font-black text-white">Gestão de Eventos</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <form onSubmit={handleSalvarEvento} className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4 h-fit">
                <h3 className="text-xs font-black text-slate-300 uppercase tracking-wider">{formEvento.id ? 'Editar Evento' : 'Novo Evento'}</h3>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400">Título do Evento</label>
                  <input type="text" className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-xs mt-1 outline-none text-white focus:border-blue-500" value={formEvento.titulo} onChange={e => setFormEvento({...formEvento, titulo: e.target.value})} required />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400">Público-Alvo Direcionado</label>
                  <select className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-xs mt-1 outline-none text-white focus:border-blue-500 font-bold" value={formEvento.publico_alvo_id} onChange={e => setFormEvento({...formEvento, publico_alvo_id: e.target.value})} required>
                    <option value="">Selecione na listagem...</option>
                    {publicosAlvo.map(p => <option key={p.id} value={p.id} disabled={!p.ativo}>{p.nome}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400">Data</label>
                    <input type="date" className="w-full bg-slate-950 border border-slate-800 p-2 rounded-xl text-xs mt-1 outline-none text-white font-mono" value={formEvento.data} onChange={e => setFormEvento({...formEvento, data: e.target.value})} required />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400">Início</label>
                    <input type="time" className="w-full bg-slate-950 border border-slate-800 p-2 rounded-xl text-xs mt-1 outline-none text-white font-mono" value={formEvento.horario_inicio} onChange={e => setFormEvento({...formEvento, horario_inicio: e.target.value})} required />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400">Término</label>
                    <input type="time" className="w-full bg-slate-950 border border-slate-800 p-2 rounded-xl text-xs mt-1 outline-none text-white font-mono" value={formEvento.horario_fim} onChange={e => setFormEvento({...formEvento, horario_fim: e.target.value})} required />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400">Local Sede Executora</label>
                  <select className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-xs mt-1 outline-none text-white focus:border-blue-500 font-bold" value={formEvento.local_id} onChange={e => setFormEvento({...formEvento, local_id: e.target.value})} required>
                    <option value="">Selecione o local...</option>
                    {locais.map(l => <option key={l.id} value={l.id} disabled={!l.ativo}>{l.nome}</option>)}
                  </select>
                </div>
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold p-2.5 rounded-xl text-xs transition">Salvar Evento</button>
              </form>
              <div className="lg:col-span-2 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 font-mono text-[11px]">
                      <tr><th className="p-4">Evento / Público</th><th className="p-4">Horários / Sede</th><th className="p-4 text-center">Horas</th><th className="p-4 text-center">Ações</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {eventos.map(ev => (
                        <tr key={ev.id} className="hover:bg-slate-800/20">
                          <td className="p-4">
                            <p className="font-bold text-white max-w-[180px] truncate">{ev.titulo}</p>
                            <p className="text-[10px] text-amber-400 mt-0.5">{ev.publico_alvo_nome || 'Geral'}</p>
                          </td>
                          <td className="p-4">
                            <p className="font-mono text-slate-300">{ev.data} <span className="text-[10px] text-slate-500">({ev.horario_inicio}-{ev.horario_fim})</span></p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{ev.local_nome}</p>
                          </td>
                          <td className="p-4 text-center"><span className="bg-blue-500/10 text-blue-400 font-mono font-black px-2 py-0.5 rounded-md">{ev.horas_ofertadas}h</span></td>
                          <td className="p-4 flex items-center justify-center gap-3 mt-1.5">
                            <button onClick={() => setFormEvento({ id: ev.id, titulo: ev.titulo, data: ev.data, horario_inicio: ev.horario_inicio, horario_fim: ev.horario_fim, local_id: ev.local_id, publico_alvo_id: ev.publico_alvo_id })} className="text-blue-400 hover:underline font-bold">Editar</button>
                            <button onClick={() => toggleStatusEvento(ev)} className={`px-2 py-0.5 rounded text-[10px] font-black ${ev.ativo ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>{ev.ativo ? 'Ativo' : 'Inativo'}</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {abaAtual === 'locais' && (
          <div className="space-y-6">
            <h2 className="text-xl font-black text-white">Controle de Locais Sede</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <form onSubmit={handleSalvarLocal} className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4 h-fit">
                <h3 className="text-xs font-black text-slate-300 uppercase tracking-wider">{formLocal.id ? 'Editar Local' : 'Novo Local'}</h3>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400">Identificação do Espaço</label>
                  <input type="text" className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-xs mt-1 outline-none text-white focus:border-blue-500" value={formLocal.nome} onChange={e => setFormLocal({...formLocal, nome: e.target.value})} placeholder="Ex: Auditório Master Bloco B" required />
                </div>
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold p-2.5 rounded-xl text-xs transition">Salvar Local</button>
              </form>
              <div className="lg:col-span-2 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 font-mono text-[11px]">
                    <tr><th className="p-4">Local Sede</th><th className="p-4 text-center">Ações</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {locais.map(l => (
                      <tr key={l.id} className="hover:bg-slate-800/20">
                        <td className="p-4 font-bold text-white">{l.nome}</td>
                        <td className="p-4 flex items-center justify-center gap-4">
                          <button onClick={() => setFormLocal({ id: l.id, nome: l.nome })} className="text-blue-400 hover:underline font-bold">Editar</button>
                          <button onClick={() => toggleStatusLocal(l)} className={`px-2 py-0.5 rounded text-[10px] font-black ${l.ativo ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>{l.ativo ? 'Ativo' : 'Inativo'}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {abaAtual === 'rel_publico' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black text-white">Eventos por Público-Alvo</h2>
              <p className="text-xs text-slate-400 mt-1">Filtre formações, cargas horárias e participações coletadas do PostgreSQL.</p>
            </div>

            <form onSubmit={filtrarRelatorioPublico} className="bg-slate-900 p-4 rounded-2xl border border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end shadow-md">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400">Data Inicial</label>
                <input type="date" className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-xs mt-1 outline-none text-white font-mono focus:border-blue-500" value={filtroRelPublico.inicio} onChange={e => setFiltroRelPublico({...filtroRelPublico, inicio: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400">Data Final</label>
                <input type="date" className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-xs mt-1 outline-none text-white font-mono focus:border-blue-500" value={filtroRelPublico.fim} onChange={e => setFiltroRelPublico({...filtroRelPublico, fim: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400">Selecione o Público-Alvo</label>
                <select className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-xs mt-1 outline-none text-white font-bold focus:border-blue-500" value={filtroRelPublico.publico_alvo_id} onChange={e => setFiltroRelPublico({...filtroRelPublico, publico_alvo_id: e.target.value})}>
                  <option value="">Mostrar Todos os Públicos</option>
                  {publicosAlvo.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-xs transition uppercase tracking-wider font-mono">Filtrar Base</button>
            </form>

            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 font-mono text-[11px]">
                    <tr>
                      <th className="p-4">Evento / Público-Alvo</th>
                      <th className="p-4">Cronograma e Sede</th>
                      <th className="p-4 text-center">Participantes</th>
                      <th className="p-4 text-center">Horas Registradas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {eventosFiltradosRel.map(ev => (
                      <tr key={ev.id} className="hover:bg-slate-800/20">
                        <td className="p-4">
                          <p className="font-bold text-white">{ev.titulo}</p>
                          <p className="text-[10px] text-blue-400 mt-0.5">{ev.publico_alvo_nome || 'Todos os Públicos'}</p>
                        </td>
                        <td className="p-4">
                          <p className="font-mono text-slate-300">{ev.data} <span className="text-[10px] text-slate-500">({ev.horario_inicio} às {ev.horario_fim})</span></p>
                          <p className="text-[10px] text-slate-500 mt-0.5 font-bold">{ev.local_nome}</p>
                        </td>
                        <td className="p-4 text-center">
                          <span className="bg-slate-950 font-mono text-slate-300 font-bold px-2.5 py-1 rounded-lg border border-slate-800">
                            {ev.total_participantes || 0}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <span className="bg-blue-500/10 text-blue-400 font-black font-mono px-2 py-1 rounded-lg">
                            {ev.horas_ofertadas}h
                          </span>
                        </td>
                      </tr>
                    ))}
                    {eventosFiltradosRel.length === 0 && (
                      <tr><td colSpan="4" className="p-8 text-center text-slate-500 font-medium">Nenhum evento localizado para os filtros informados.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}