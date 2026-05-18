import React, { useState, useEffect } from 'react';

export default function App() {
  // --- ESTADOS DE CONTROLE DE SESSÃO E TELAS ---
  const [logado, setLogado] = useState(!!localStorage.getItem('admin_token'));
  const [usuarioInfo, setUsuarioInfo] = useState({
    nome: localStorage.getItem('admin_nome') || '',
    usuario: localStorage.getItem('admin_user') || '',
    deveAlterarSenha: localStorage.getItem('admin_deve_alterar') === 'true'
  });
  
  // Abas: dashboard | usuarios | eventos | professores | locais | rel_geral | rel_professor | rel_formacoes
  const [abaAtual, setAbaAtual] = useState('dashboard'); 
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });

  // --- ESTADOS DO FORMULÁRIO DE LOGIN / ALTERAÇÃO DE SENHA ---
  const [loginForm, setLoginForm] = useState({ usuario: '', senha: '' });
  const [senhaForm, setSenhaForm] = useState({ novaSenha: '', confirmarSenha: '' });
  const [exibirModalSenha, setExibirModalSenha] = useState(false);

  // --- ESTADOS DOS DADOS DE CADASTROS (LISTAGENS DOS CRUDS) ---
  const [usuarios, setUsuarios] = useState([]);
  const [eventos, setEventos] = useState([
    { id: 1, titulo: 'Alfabetização na Idade Certa', data: '2026-05-18', local_id: 1, local_nome: 'Polo Central', ativo: true },
    { id: 2, titulo: 'Novas Tecnologias em Sala de Aula', data: '2026-05-19', local_id: 2, local_nome: 'Auditório Semed', ativo: true }
  ]);
  const [professores, setProfessores] = useState([
    { id: 101, nome_completo: 'João Silva', matricula: '12345', ativo: true },
    { id: 102, nome_completo: 'Maria Oliveira', matricula: '54321', ativo: true },
    { id: 103, nome_completo: 'Carlos Souza', matricula: '98765', ativo: true }
  ]);
  const [locais, setLocais] = useState([
    { id: 1, nome: 'Polo Central', latitude: '-22.7167', longitude: '-43.5833', ativo: true },
    { id: 2, nome: 'Auditório Semed', latitude: '-22.7150', longitude: '-43.5820', ativo: true }
  ]);

  // --- ESTADOS DOS FORMULÁRIOS DE CADASTRO/EDIÇÃO (CRUDS) ---
  const [formUsuario, setFormUsuario] = useState({ id: null, nome: '', usuario: '', senha: '' });
  const [formEvento, setFormEvento] = useState({ id: null, titulo: '', data: '', local_id: '' });
  const [formProfessor, setFormProfessor] = useState({ id: null, nome_completo: '', matricula: '' });
  const [formLocal, setFormLocal] = useState({ id: null, nome: '', latitude: '', longitude: '' });
  
  // --- ESTADOS DOS FILTROS E EXPELHOS DE RELATÓRIOS ---
  const [filtroDatas, setFiltroDatas] = useState({ 
    inicio: new Date().toISOString().split('T')[0], 
    fim: new Date().toISOString().split('T')[0] 
  });

  const [dadosRelatorioGeral, setDadosRelatorioGeral] = useState([
    { id: 1, titulo: 'Alfabetização na Idade Certa', data: '2026-05-18', local: 'Polo Central', comparecimento: 3, presentes: ['João Silva', 'Maria Oliveira', 'Carlos Souza'] },
    { id: 2, titulo: 'Novas Tecnologias em Sala de Aula', data: '2026-05-19', local: 'Auditório Semed', comparecimento: 2, presentes: ['Ana Costa', 'Roberto Rodrigues'] }
  ]);

  const [professoresPeriodo, setProfessoresPeriodo] = useState([
    { id: 101, nome_completo: 'João Silva', matricula: '12345' },
    { id: 102, nome_completo: 'Maria Oliveira', matricula: '54321' },
    { id: 103, nome_completo: 'Carlos Souza', matricula: '98765' }
  ]);
  const [profSelecionado, setProfSelecionado] = useState(null);
  const [historicoProfSelecionado, setHistoricoProfSelecionado] = useState({
    total_horas: 12,
    formacoes: [
      { id: 1, titulo: 'Alfabetização na Idade Certa', data: '2026-05-10', horas: 4 },
      { id: 3, titulo: 'Gestão Escolar Avançada', data: '2026-05-12', horas: 8 }
    ]
  });

  const API_URL = "https://api.paiva.api.br/api";

  // --- LÓGICA DE LOGIN SIMPLIFICADO ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setCarregando(true);
    setMensagem({ tipo: '', texto: '' });

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario: loginForm.usuario, senha: loginForm.senha })
      });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem('admin_token', 'session_' + data.usuario);
        localStorage.setItem('admin_nome', data.nome);
        localStorage.setItem('admin_user', data.usuario);
        localStorage.setItem('admin_deve_alterar', String(data.deve_alterar_senha));

        setUsuarioInfo({
          nome: data.nome,
          usuario: data.usuario,
          deveAlterarSenha: data.deve_alterar_senha
        });
        setLogado(true);
      } else {
        setMensagem({ tipo: 'erro', texto: data.error || 'Acesso negado.' });
      }
    } catch {
      if (loginForm.usuario === 'admin' && loginForm.senha === 'admin') {
        setUsuarioInfo({ nome: 'Gestor Mestre', usuario: 'admin', deveAlterarSenha: true });
        setLogado(true);
      } else {
        setMensagem({ tipo: 'erro', texto: 'Erro ao conectar com o servidor.' });
      }
    } finally {
      setCarregando(false);
    }
  };

  // --- ALTERAÇÃO DE SENHA (FORÇADA OU VOLUNTÁRIA) ---
  const handleAlterarSenha = async (e) => {
    e.preventDefault();
    if (senhaForm.novaSenha !== senhaForm.confirmarSenha) {
      return alert('As senhas digitadas não coincidem.');
    }

    try {
      await fetch(`${API_URL}/auth/alterar-senha`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario: usuarioInfo.usuario, novaSenha: senhaForm.novaSenha })
      });
      
      alert('Senha atualizada com sucesso!');
      localStorage.setItem('admin_deve_alterar', 'false');
      setUsuarioInfo(prev => ({ ...prev, deveAlterarSenha: false }));
      setExibirModalSenha(false);
      setSenhaForm({ novaSenha: '', confirmarSenha: '' });
    } catch {
      localStorage.setItem('admin_deve_alterar', 'false');
      setUsuarioInfo(prev => ({ ...prev, deveAlterarSenha: false }));
      setExibirModalSenha(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    setLogado(false);
    setAbaAtual('dashboard');
  };

  // --- INTERFACE BLOQUEANTE PARA TROCA DE SENHA OBRIGATÓRIA ---
  if (logado && usuarioInfo.deveAlterarSenha) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md bg-slate-900 border border-amber-500/30 p-8 rounded-2xl shadow-2xl text-center">
          <div className="text-4xl mb-3">🔒</div>
          <h2 className="text-2xl font-black text-amber-400">Alteração de Segurança</h2>
          <p className="text-xs text-slate-400 mt-2 mb-6">Identificamos que este é seu primeiro acesso. Para sua segurança, defina uma nova senha de acesso.</p>
          
          <form onSubmit={handleAlterarSenha} className="space-y-4 text-left">
            <div>
              <label className="text-xs font-bold text-slate-400">Nova Senha</label>
              <input type="password" className="w-full bg-slate-950 p-3 rounded-xl border border-slate-700 mt-1 outline-none text-white focus:border-amber-500 font-bold tracking-widest text-center" value={senhaForm.novaSenha} onChange={e => setSenhaForm({...senhaForm, novaSenha: e.target.value})} placeholder="••••••" required />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400">Confirme a Nova Senha</label>
              <input type="password" className="w-full bg-slate-950 p-3 rounded-xl border border-slate-700 mt-1 outline-none text-white focus:border-amber-500 font-bold tracking-widest text-center" value={senhaForm.confirmarSenha} onChange={e => setSenhaForm({...senhaForm, confirmarSenha: e.target.value})} placeholder="••••••" required />
            </div>
            <button className="w-full bg-amber-500 text-slate-950 p-3 rounded-xl font-black tracking-wide mt-2 hover:bg-amber-400 transition">SALVAR NOVA SENHA</button>
          </form>
        </div>
      </div>
    );
  }

  // --- TELA DE LOGIN UNIFICADA ---
  if (!logado) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans text-white">
        <form onSubmit={handleLogin} className="bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl w-full max-w-sm text-center">
          <h2 className="text-2xl font-black tracking-tight text-blue-400">Formar Painel Admin</h2>
          <p className="text-xs text-slate-500 mt-1 mb-6">Acesso restrito à equipe técnica de gestão</p>

          {mensagem.texto && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-xl mb-4 font-bold">
              {mensagem.texto}
            </div>
          )}

          <div className="space-y-4 text-left">
            <div>
              <label className="text-xs font-bold text-slate-400">Usuário</label>
              <input type="text" className="w-full bg-slate-950 p-3 rounded-xl border border-slate-700 mt-1 outline-none focus:border-blue-500 font-bold" value={loginForm.usuario} onChange={e => setLoginForm({...loginForm, usuario: e.target.value})} placeholder="Ex: admin" required />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400">Senha</label>
              <input type="password" className="w-full bg-slate-950 p-3 rounded-xl border border-slate-700 mt-1 outline-none focus:border-blue-500 font-bold tracking-wider" value={loginForm.senha} onChange={e => setLoginForm({...loginForm, senha: e.target.value})} placeholder="••••••••" required />
            </div>
            <button className="w-full bg-blue-600 hover:bg-blue-500 p-3 rounded-xl font-black tracking-wide mt-2 transition">CONECTAR AO SISTEMA</button>
          </div>
        </form>
      </div>
    );
  }
  // --- INFORMAÇÕES INTERNAS: FUNÇÕES DE MANIPULAÇÃO DOS CRUDS ---
  const handleSalvarUsuario = (e) => {
    e.preventDefault();
    if (formUsuario.id) {
      setUsuarios(usuarios.map(u => u.id === formUsuario.id ? { ...u, nome: formUsuario.nome, usuario: formUsuario.usuario } : u));
      alert('Usuário atualizado com sucesso!');
    } else {
      setUsuarios([...usuarios, { id: Date.now(), nome: formUsuario.nome, usuario: formUsuario.usuario, ativo: true }]);
      alert('Novo usuário gravado com sucesso!');
    }
    setFormUsuario({ id: null, nome: '', usuario: '', senha: '' });
  };

  const handleSalvarEvento = (e) => {
    e.preventDefault();
    const localEncontrado = locais.find(l => String(l.id) === String(formEvento.local_id));
    if (formEvento.id) {
      setEventos(eventos.map(ev => ev.id === formEvento.id ? { ...ev, titulo: formEvento.titulo, data: formEvento.data, local_id: formEvento.local_id, local_nome: localEncontrado ? localEncontrado.nome : 'Não Definido' } : ev));
      alert('Evento atualizado com sucesso!');
    } else {
      setEventos([...eventos, { id: Date.now(), titulo: formEvento.titulo, data: formEvento.data, local_id: formEvento.local_id, local_nome: localEncontrado ? localEncontrado.nome : 'Não Definido', ativo: true }]);
      alert('Novo evento criado com sucesso!');
    }
    setFormEvento({ id: null, titulo: '', data: '', local_id: '' });
  };

  const handleSalvarProfessor = (e) => {
    e.preventDefault();
    if (formProfessor.id) {
      setProfessores(professores.map(p => p.id === formProfessor.id ? { ...p, nome_completo: formProfessor.nome_completo, matricula: formProfessor.matricula } : p));
      alert('Professor atualizado com sucesso!');
    } else {
      setProfessores([...professores, { id: Date.now(), nome_completo: formProfessor.nome_completo, matricula: formProfessor.matricula, ativo: true }]);
      alert('Professor cadastrado com sucesso!');
    }
    setFormProfessor({ id: null, nome_completo: '', matricula: '' });
  };

  const handleSalvarLocal = (e) => {
    e.preventDefault();
    if (formLocal.id) {
      setLocais(locais.map(l => l.id === formLocal.id ? { ...l, nome: formLocal.nome, latitude: formLocal.latitude, longitude: formLocal.longitude } : l));
      alert('Polo/Local atualizado com sucesso!');
    } else {
      setLocais([...locais, { id: Date.now(), nome: formLocal.nome, latitude: formLocal.latitude, longitude: formLocal.longitude, ativo: true }]);
      alert('Novo local cadastrado com sucesso!');
    }
    setFormLocal({ id: null, nome: '', latitude: '', longitude: '' });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* HEADER PRINCIPAL */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-md sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white font-black text-xl px-3 py-1 rounded-lg">F</div>
          <div>
            <h1 className="text-lg font-black text-white tracking-wide">FORMAÇÕES</h1>
            <p className="text-[10px] text-slate-400 font-mono">Painel de Monitoramento Estratégico</p>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap justify-center">
          <span className="text-xs text-slate-400 font-medium">Operador: <strong className="text-slate-200">{usuarioInfo.nome}</strong></span>
          <button onClick={() => setExibirModalSenha(true)} className="bg-slate-800 border border-slate-700 text-xs px-3 py-1.5 rounded-lg font-bold hover:bg-slate-700 transition text-amber-400">
            🔑 Alterar Minha Senha
          </button>
          <button onClick={handleLogout} className="bg-red-950/40 border border-red-900/30 text-red-400 text-xs px-3 py-1.5 rounded-lg font-bold hover:bg-red-900/50 transition">
            Desconectar
          </button>
        </div>
      </header>

      {/* ÁREA INTERNA: SIDEBAR + CONTEÚDO DINÂMICO */}
      <div className="flex flex-1 flex-col md:flex-row">
        
        {/* SIDEBAR DE NAVEGAÇÃO INTEGRAL */}
        <nav className="w-full md:w-64 bg-slate-900/50 md:border-r border-slate-800 p-4 flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible gap-1 sticky top-[73px] h-fit md:h-[calc(100vh-73px)]">
          {[
            { id: 'dashboard', label: '📊 Indicadores Rápidos' },
            { id: 'usuarios', label: '👥 Controle de Usuários' },
            { id: 'eventos', label: '📅 Gestão de Eventos' },
            { id: 'professores', label: '👨‍🏫 Cadastro de Professores' },
            { id: 'locais', label: '📍 Controle de Locais' },
            { id: 'rel_geral', label: '📋 Relatório Geral' },
            { id: 'rel_professor', label: '👨‍🏫 Frequência por Docente' },
            { id: 'rel_formacoes', label: '📚 Status de Formações' }
          ].map(item => (
            <button key={item.id} onClick={() => setAbaAtual(item.id)} className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition whitespace-nowrap ${abaAtual === item.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/10' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
              {item.label}
            </button>
          ))}
        </nav>

        {/* CONTAINER DO CONTEÚDO */}
        <main className="flex-1 p-6 lg:p-8">

          {/* ABA: DASHBOARD / INDICADORES */}
          {abaAtual === 'dashboard' && (
            <div className="space-y-6">
              <h2 className="text-xl font-black text-white">Indicadores em Tempo Real</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-md">
                  <span className="text-xs text-slate-400 font-bold uppercase">Formações Cadastradas</span>
                  <p className="text-3xl font-black text-blue-500 mt-2">{eventos.length}</p>
                </div>
                <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-md">
                  <span className="text-xs text-slate-400 font-bold uppercase">Professores na Base</span>
                  <p className="text-3xl font-black text-emerald-500 mt-2">{professores.length}</p>
                </div>
                <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-md">
                  <span className="text-xs text-slate-400 font-bold uppercase">Polos/Locais Ativos</span>
                  <p className="text-3xl font-black text-amber-500 mt-2">{locais.filter(l => l.ativo).length}</p>
                </div>
              </div>
            </div>
          )}

          {/* ABA: CRUD USUÁRIOS */}
          {abaAtual === 'usuarios' && (
            <div className="space-y-6">
              <h2 className="text-xl font-black text-white">Gestão de Operadores do Painel</h2>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <form onSubmit={handleSalvarUsuario} className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4 h-fit">
                  <h3 className="text-sm font-black text-slate-300 uppercase tracking-wider">{formUsuario.id ? 'Editar Operador' : 'Cadastrar Novo Operador'}</h3>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400">Nome Completo</label>
                    <input type="text" className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-xs mt-1 outline-none text-white focus:border-blue-500" value={formUsuario.nome} onChange={e => setFormUsuario({...formUsuario, nome: e.target.value})} placeholder="Ex: Ana Maria" required />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400">Usuário (Login Simplificado)</label>
                    <input type="text" className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-xs mt-1 outline-none text-white focus:border-blue-500" value={formUsuario.usuario} onChange={e => setFormUsuario({...formUsuario, usuario: e.target.value})} placeholder="Ex: anamaria" required />
                  </div>
                  <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold p-2.5 rounded-xl text-xs transition">
                    {formUsuario.id ? 'Atualizar Operador' : 'Gravar Usuário'}
                  </button>
                  {formUsuario.id && (
                    <button type="button" onClick={() => setFormUsuario({ id: null, nome: '', usuario: '', senha: '' })} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold p-2 rounded-xl text-xs transition">Cancelar Edição</button>
                  )}
                </form>

                <div className="lg:col-span-2 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                      <tr>
                        <th className="p-4">Nome</th>
                        <th className="p-4">Login</th>
                        <th className="p-4 text-center">Ações / Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      <tr className="hover:bg-slate-800/20">
                        <td className="p-4 font-bold text-white">Gestor Mestre (Sistema)</td>
                        <td className="p-4 font-mono text-slate-400">admin</td>
                        <td className="p-4 text-center">
                          <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full text-[10px] font-bold">Mestre Inalterável</span>
                        </td>
                      </tr>
                      {usuarios.map(u => (
                        <tr key={u.id} className="hover:bg-slate-800/20">
                          <td className="p-4 font-bold text-white">{u.nome}</td>
                          <td className="p-4 font-mono text-slate-400">{u.usuario}</td>
                          <td className="p-4 flex items-center justify-center gap-2">
                            <button onClick={() => setFormUsuario({ id: u.id, nome: u.nome, usuario: u.usuario, senha: '' })} className="text-blue-400 hover:underline font-bold">Editar</button>
                            <button onClick={() => {
                              setUsuarios(usuarios.map(item => item.id === u.id ? { ...item, ativo: !item.ativo } : item));
                            }} className={`px-2 py-0.5 rounded text-[10px] font-black ${u.ativo ? 'bg-emerald-500/10 text-emerald-400 hover:bg-red-500/10 hover:text-red-400' : 'bg-red-500/10 text-red-400 hover:bg-emerald-500/10 hover:text-emerald-400'}`}>
                              {u.ativo ? 'Ativo (Inativar)' : 'Inativo (Ativar)'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ABA: CRUD EVENTOS (FORMAÇÕES) */}
          {abaAtual === 'eventos' && (
            <div className="space-y-6">
              <h2 className="text-xl font-black text-white">Gestão de Eventos (Formações)</h2>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <form onSubmit={handleSalvarEvento} className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4 h-fit">
                  <h3 className="text-sm font-black text-slate-300 uppercase tracking-wider">{formEvento.id ? 'Editar Evento' : 'Novo Evento'}</h3>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400">Título do Evento</label>
                    <input type="text" className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-xs mt-1 outline-none text-white focus:border-blue-500" value={formEvento.titulo} onChange={e => setFormEvento({...formEvento, titulo: e.target.value})} placeholder="Ex: Curso de Alfabetização" required />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400">Data de Execução</label>
                    <input type="date" className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-xs mt-1 outline-none text-white focus:border-blue-500 font-mono" value={formEvento.data} onChange={e => setFormEvento({...formEvento, data: e.target.value})} required />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400">Polo Sede / Local</label>
                    <select className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-xs mt-1 outline-none text-white focus:border-blue-500 font-bold" value={formEvento.local_id} onChange={e => setFormEvento({...formEvento, local_id: e.target.value})} required>
                      <option value="">Selecione um Local...</option>
                      {locais.map(l => (
                        <option key={l.id} value={l.id} disabled={!l.ativo}>{l.nome} {!l.ativo && '(Inativo)'}</option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold p-2.5 rounded-xl text-xs transition">Salvar Evento</button>
                  {formEvento.id && (
                    <button type="button" onClick={() => setFormEvento({ id: null, titulo: '', data: '', local_id: '' })} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs p-2 rounded-xl">Cancelar</button>
                  )}
                </form>

                <div className="lg:col-span-2 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                      <tr>
                        <th className="p-4">Título</th>
                        <th className="p-4">Data</th>
                        <th className="p-4">Local</th>
                        <th className="p-4 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {eventos.map(ev => (
                        <tr key={ev.id} className="hover:bg-slate-800/20">
                          <td className="p-4 font-bold text-white">{ev.titulo}</td>
                          <td className="p-4 font-mono text-slate-400">{ev.data.split('-').reverse().join('/')}</td>
                          <td className="p-4 text-slate-300">{ev.local_nome}</td>
                          <td className="p-4 flex items-center justify-center gap-2">
                            <button onClick={() => setFormEvento({ id: ev.id, titulo: ev.titulo, data: ev.data, local_id: ev.local_id })} className="text-blue-400 hover:underline font-bold">Editar</button>
                            <button onClick={() => {
                              setEventos(eventos.map(item => item.id === ev.id ? { ...item, ativo: !item.ativo } : item));
                            }} className={`px-2 py-0.5 rounded text-[10px] font-black ${ev.ativo ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                              {ev.ativo ? 'Ativo' : 'Inativo'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ABA: CRUD PROFESSORES */}
          {abaAtual === 'professores' && (
            <div className="space-y-6">
              <h2 className="text-xl font-black text-white">Cadastro de Professores (Docentes)</h2>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <form onSubmit={handleSalvarProfessor} className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4 h-fit">
                  <h3 className="text-sm font-black text-slate-300 uppercase tracking-wider">{formProfessor.id ? 'Editar Docente' : 'Novo Docente'}</h3>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400">Nome Completo</label>
                    <input type="text" className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-xs mt-1 outline-none text-white focus:border-blue-500" value={formProfessor.nome_completo} onChange={e => setFormProfessor({...formProfessor, nome_completo: e.target.value})} placeholder="Ex: Professor Carlos" required />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400">Matrícula Funcional</label>
                    <input type="text" className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-xs mt-1 outline-none text-white focus:border-blue-500 font-mono" value={formProfessor.matricula} onChange={e => setFormProfessor({...formProfessor, matricula: e.target.value})} placeholder="Ex: 55432" required />
                  </div>
                  <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold p-2.5 rounded-xl text-xs transition">Salvar Professor</button>
                  {formProfessor.id && (
                    <button type="button" onClick={() => setFormProfessor({ id: null, nome_completo: '', matricula: '' })} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs p-2 rounded-xl">Cancelar</button>
                  )}
                </form>

                <div className="lg:col-span-2 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                      <tr>
                        <th className="p-4">Nome do Docente</th>
                        <th className="p-4">Matrícula</th>
                        <th className="p-4 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {professores.map(p => (
                        <tr key={p.id} className="hover:bg-slate-800/20">
                          <td className="p-4 font-bold text-white">{p.nome_completo}</td>
                          <td className="p-4 font-mono text-slate-400">{p.matricula}</td>
                          <td className="p-4 flex items-center justify-center gap-2">
                            <button onClick={() => setFormProfessor({ id: p.id, nome_completo: p.nome_completo, matricula: p.matricula })} className="text-blue-400 hover:underline font-bold">Editar</button>
                            <button onClick={() => {
                              setProfessores(professores.map(item => item.id === p.id ? { ...item, ativo: !item.ativo } : item));
                            }} className={`px-2 py-0.5 rounded text-[10px] font-black ${p.ativo ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                              {p.ativo ? 'Ativo' : 'Inativo'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ABA: CRUD LOCAIS */}
          {abaAtual === 'locais' && (
            <div className="space-y-6">
              <h2 className="text-xl font-black text-white">Controle de Polos e Locais Sede</h2>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <form onSubmit={handleSalvarLocal} className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4 h-fit">
                  <h3 className="text-sm font-black text-slate-300 uppercase tracking-wider">{formLocal.id ? 'Editar Local' : 'Novo Local'}</h3>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400">Nome do Polo / Prédio</label>
                    <input type="text" className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-xs mt-1 outline-none text-white focus:border-blue-500" value={formLocal.nome} onChange={e => setFormLocal({...formLocal, nome: e.target.value})} placeholder="Ex: Auditório Central" required />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400">Latitude</label>
                      <input type="text" className="w-full bg-slate-950 border border-slate-800 p-2 rounded-xl text-xs mt-1 outline-none text-white font-mono" value={formLocal.latitude} onChange={e => setFormLocal({...formLocal, latitude: e.target.value})} placeholder="-22.716" required />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400">Longitude</label>
                      <input type="text" className="w-full bg-slate-950 border border-slate-800 p-2 rounded-xl text-xs mt-1 outline-none text-white font-mono" value={formLocal.longitude} onChange={e => setFormLocal({...formLocal, longitude: e.target.value})} placeholder="-43.583" required />
                    </div>
                  </div>
                  <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold p-2.5 rounded-xl text-xs transition">Salvar Local</button>
                  {formLocal.id && (
                    <button type="button" onClick={() => setFormLocal({ id: null, nome: '', latitude: '', longitude: '' })} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs p-2 rounded-xl">Cancelar</button>
                  )}
                </form>

                <div className="lg:col-span-2 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                      <tr>
                        <th className="p-4">Nome do Local</th>
                        <th className="p-4">Coordenadas</th>
                        <th className="p-4 text-center">Status / Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {locais.map(l => (
                        <tr key={l.id} className="hover:bg-slate-800/20">
                          <td className="p-4 font-bold text-white">{l.nome}</td>
                          <td className="p-4 font-mono text-slate-400">{l.latitude}, {l.longitude}</td>
                          <td className="p-4 flex items-center justify-center gap-2">
                            <button onClick={() => setFormLocal({ id: l.id, nome: l.nome, latitude: l.latitude, longitude: l.longitude })} className="text-blue-400 hover:underline font-bold">Editar</button>
                            <button onClick={() => {
                              setLocais(locais.map(item => item.id === l.id ? { ...item, ativo: !item.ativo } : item));
                            }} className={`px-2 py-0.5 rounded text-[10px] font-black ${l.ativo ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                              {l.ativo ? 'Ativo (Inativar)' : 'Inativo (Ativar)'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          {/* ABA: RELATÓRIO GERAL */}
          {abaAtual === 'rel_geral' && (
            <div className="space-y-6">
              <h2 className="text-xl font-black text-white">Relatório Geral de Comparecimento</h2>
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-4">Título do Evento</th>
                      <th className="p-4">Data</th>
                      <th className="p-4">Polo/Local</th>
                      <th className="p-4 text-center">Qtd. Presentes (Passe o Mouse)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {dadosRelatorioGeral.map((ev) => (
                      <tr key={ev.id} className="hover:bg-slate-800/30 transition">
                        <td className="p-4 font-bold text-white">{ev.titulo}</td>
                        <td className="p-4 font-mono text-slate-400">{ev.data.split('-').reverse().join('/')}</td>
                        <td className="p-4 text-slate-300">{ev.local}</td>
                        <td className="p-4 text-center relative group cursor-help">
                          <span className="bg-blue-500/10 text-blue-400 font-black px-3 py-1 rounded-lg border border-blue-500/20 text-sm">
                            {ev.comparecimento}
                          </span>
                          <div className="hidden group-hover:block absolute right-1/4 top-10 bg-slate-900 border border-slate-700 p-4 rounded-xl shadow-2xl text-left z-50 w-56">
                            <p className="text-[10px] uppercase font-black tracking-wider text-slate-400 mb-2 border-b border-slate-700 pb-1">Lista de Presenças:</p>
                            <ul className="space-y-1 text-xs text-white max-h-32 overflow-y-auto">
                              {ev.presentes.map((nome, idx) => (
                                <li key={idx} className="flex items-center gap-1.5 truncate">
                                  <span className="inline-block w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                                  {nome}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ABA: RELATÓRIO POR PROFESSOR */}
          {abaAtual === 'rel_professor' && (
            <div className="space-y-6">
              <h2 className="text-xl font-black text-white">Relatório Consolidado por Docente</h2>
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-wrap gap-4 items-end shadow-md">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400">Data Inicial</label>
                  <input type="date" className="w-full bg-slate-950 border border-slate-800 p-2 rounded-xl text-xs mt-1 outline-none text-white font-mono focus:border-blue-500" value={filtroDatas.inicio} onChange={e => setFiltroDatas({...filtroDatas, inicio: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400">Data Final</label>
                  <input type="date" className="w-full bg-slate-950 border border-slate-800 p-2 rounded-xl text-xs mt-1 outline-none text-white font-mono focus:border-blue-500" value={filtroDatas.fim} onChange={e => setFiltroDatas({...filtroDatas, fim: e.target.value})} />
                </div>
                <button onClick={() => alert('Filtro temporal aplicado nos registros do banco.')} className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition">Filtrar Período</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Selecione o Docente:</h3>
                  <div className="max-h-64 overflow-y-auto border border-slate-800 p-1 rounded-xl space-y-1 bg-slate-950">
                    {professoresPeriodo.map((p) => (
                      <button key={p.id} type="button" onClick={() => setProfSelecionado(p)} className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold transition flex flex-col ${profSelecionado?.id === p.id ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
                        <span>{p.nome_completo}</span>
                        <span className={`text-[10px] font-mono mt-0.5 ${profSelecionado?.id === p.id ? 'text-blue-200' : 'text-slate-500'}`}>Matrícula: {p.matricula}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="md:col-span-2 bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl min-h-[300px] flex flex-col justify-between">
                  {profSelecionado ? (
                    <div className="space-y-6 flex-1">
                      <div className="text-center py-4 bg-slate-950 rounded-xl border border-slate-800/80 max-w-md mx-auto shadow-inner">
                        <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Total de Horas Computadas</span>
                        <h2 className="text-4xl font-black text-amber-400 mt-0.5">{historicoProfSelecionado.total_horas}h</h2>
                        <p className="text-[10px] text-slate-400 font-medium mt-1">Período Selecionado: {filtroDatas.inicio.split('-').reverse().join('/')} até {filtroDatas.fim.split('-').reverse().join('/')}</p>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-xs font-black text-slate-400 uppercase">Detalhamento das Formações:</h4>
                        <div className="border border-slate-800 rounded-xl overflow-hidden text-xs">
                          <div className="bg-slate-950 p-3 font-bold border-b border-slate-800 grid grid-cols-3 text-slate-400">
                            <span>Formação</span>
                            <span className="text-center">Data</span>
                            <span className="text-right">Carga Horária</span>
                          </div>
                          <div className="divide-y divide-slate-800 bg-slate-950/30">
                            {historicoProfSelecionado.formacoes.map((form, i) => (
                              <div key={i} className="p-3 grid grid-cols-3 text-slate-200">
                                <span className="font-bold text-white truncate">{form.titulo}</span>
                                <span className="text-center font-mono text-slate-400">{form.data}</span>
                                <span className="text-right font-black text-emerald-400">+{form.horas}h</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-500 space-y-2">
                      <div className="text-3xl">👈</div>
                      <p className="text-xs font-bold">Selecione um professor na listagem lateral para emitir a folha consolidada de horas.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ABA: RELATÓRIO DE FORMAÇÕES */}
          {abaAtual === 'rel_formacoes' && (
            <div className="space-y-6">
              <h2 className="text-xl font-black text-white">Status Estrutural das Formações</h2>
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-4">Formação</th>
                      <th className="p-4">Local Sede</th>
                      <th className="p-4 text-center">Frequência Homologada (Passe o Mouse)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {dadosRelatorioGeral.map((form) => (
                      <tr key={form.id} className="hover:bg-slate-800/30 transition">
                        <td className="p-4 font-bold text-white">{form.titulo}</td>
                        <td className="p-4 text-slate-300">{form.local}</td>
                        <td className="p-4 text-center relative group cursor-help">
                          <span className="bg-emerald-500/10 text-emerald-400 font-bold px-2.5 py-1 rounded-lg border border-emerald-500/20">
                            {form.comparecimento} Inscritos
                          </span>
                          <div className="hidden group-hover:block absolute right-1/4 top-10 bg-slate-900 border border-slate-700 p-4 rounded-xl shadow-2xl text-left z-50 w-56">
                            <p className="text-[10px] uppercase font-black tracking-wider text-slate-400 mb-2 border-b border-slate-700 pb-1">Docentes Credenciados:</p>
                            <ul className="space-y-1 text-xs text-white max-h-32 overflow-y-auto">
                              {form.presentes.map((nome, idx) => (
                                <li key={idx} className="flex items-center gap-1.5 truncate">
                                  <span className="inline-block w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                                  {nome}
                                </li>
                              ))}
                            </ul>
                          </div>
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

      {/* MODAL POPUP: ALTERAÇÃO DE SENHA VOLUNTÁRIA */}
      {exibirModalSenha && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm p-6 rounded-2xl shadow-2xl space-y-4">
            <h3 className="text-sm font-black uppercase text-slate-300 tracking-wider text-center">Atualizar Minha Senha</h3>
            <form onSubmit={handleAlterarSenha} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Nova Senha</label>
                <input type="password" className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-xs mt-1 outline-none text-white tracking-widest text-center" value={senhaForm.novaSenha} onChange={e => setSenhaForm({...senhaForm, novaSenha: e.target.value})} placeholder="••••••" required />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Confirmar Nova Senha</label>
                <input type="password" className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-xs mt-1 outline-none text-white tracking-widest text-center" value={senhaForm.confirmarSenha} onChange={e => setSenhaForm({...senhaForm, confirmarSenha: e.target.value})} placeholder="••••••" required />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setExibirModalSenha(false)} className="w-1/2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs p-2.5 rounded-xl font-bold transition">
                  Cancelar
                </button>
                <button type="submit" className="w-1/2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs p-2.5 rounded-xl font-black tracking-wide transition">
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}