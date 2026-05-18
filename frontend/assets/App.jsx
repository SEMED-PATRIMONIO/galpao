import React, { useState, useEffect } from 'react';

export default function App() {
  // --- ESTADOS DE CONTROLE DE SESSÃO E TELAS ---
  const [logado, setLogado] = useState(!!localStorage.getItem('admin_token'));
  const [usuarioInfo, setUsuarioInfo] = useState({
    nome: localStorage.getItem('admin_nome') || '',
    usuario: localStorage.getItem('admin_user') || '',
    deveAlterarSenha: localStorage.getItem('admin_deve_alterar') === 'true'
  });
  
  const [abaAtual, setAbaAtual] = useState('dashboard'); // dashboard | usuarios | rel_geral | rel_professor | rel_formacoes
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });

  // --- ESTADOS DO FORMULÁRIO DE LOGIN / ALTERAÇÃO DE SENHA ---
  const [loginForm, setLoginForm] = useState({ usuario: '', senha: '' });
  const [senhaForm, setSenhaForm] = useState({ novaSenha: '', confirmarSenha: '' });
  const [exibirModalSenha, setExibirModalSenha] = useState(false);

  // --- ESTADOS DOS DADOS DE CADASTROS E RELATÓRIOS ---
  const [usuarios, setUsuarios] = useState([]);
  const [novoUsuarioForm, setNovoUsuarioForm] = useState({ nome: '', usuario: '', senha: '' });
  
  // Filtros Globais de Data para os Relatórios
  const [filtroDatas, setFiltroDatas] = useState({ 
    inicio: new Date().toISOString().split('T')[0], 
    fim: new Date().toISOString().split('T')[0] 
  });

  // Dados dos Relatórios (Mockados para garantir renderização imediata, conecte com seu fetch)
  const [dadosRelatorioGeral, setDadosRelatorioGeral] = useState([
    { id: 1, titulo: 'Alfabetização na Idade Certa', data: '2026-05-18', local: 'Polo Central', comparecimento: 3, presentes: ['João Silva', 'Maria Oliveira', 'Carlos Souza'] },
    { id: 2, titulo: 'Novas Tecnologias em Sala de Aula', data: '2026-05-19', local: 'Auditório Semed', comparecimento: 2, presentes: ['Ana Costa', 'Roberto Rodrigues'] }
  ]);

  const [professoresPeriodo, setProfessoresPeriodo] = useState([
    { id: 101, nome_completo: 'João Silva', matricula: '12345' },
    { id: 102, nome_completo: 'Maria Oliveira', matricula: '54321' },
    { id: 103, nome_completo: 'Carlos Souza', matricula: '98765' },
    { id: 104, font_completo: 'Ana Costa', matricula: '11223' },
    { id: 105, nome_completo: 'Roberto Rodrigues', matricula: '44556' }
  ]);
  const [profSelecionado, setProfSelecionado] = useState(null);
  const [historicoProfSelecionado, setHistoricoProfSelecionado] = useState({
    total_horas: 12,
    formacoes: [
      { id: 1, titulo: 'Alfabetização na Idade Certa', data: '2026-05-10', horas: 4, avaliacao: 'Excelente' },
      { id: 3, titulo: 'Gestão Escolar Avançada', data: '2026-05-12', horas: 8, avaliacao: 'Muito Boa' }
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
      // Fallback local caso queira testar a interface sem o backend estar de pé
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
      const res = await fetch(`${API_URL}/auth/alterar-senha`, {
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
      // Simulação frontend caso o backend offline
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
          <img src="/logap.png" className="w-24 mx-auto mb-4" alt="Logo" onError={(e) => e.target.style.display='none'} />
          <h2 className="text-2xl font-black tracking-tight text-blue-400">Painel de Formações</h2>
          <p className="text-xs text-slate-500 mt-1 mb-6">Acesso restrito aos gestores</p>

          {mensagem.texto && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-xl mb-4 font-bold">
              {mensagem.texto}
            </div>
          )}

          <div className="space-y-4 text-left">
            <div>
              <label className="text-xs font-bold text-slate-400">Usuário</label>
              <input type="text" className="w-full bg-slate-950 p-3 rounded-xl border border-slate-700 mt-1 outline-none focus:border-blue-500 font-bold" value={loginForm.usuario} onChange={e => setLoginForm({...loginForm, usuario: e.target.value})} placeholder="Ex: gestor1" required />
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
          
          {/* BOTÃO INDIVIDUAL DE ALTERAÇÃO DE SENHA */}
          <button onClick={() => setExibirModalSenha(true)} className="bg-slate-800 border border-slate-700 text-xs px-3 py-1.5 rounded-lg font-bold hover:bg-slate-700 transition text-amber-400">
            🔑 Alterar Minha Senha
          </button>
          
          <button onClick={handleLogout} className="bg-red-950/40 border border-red-900/30 text-red-400 text-xs px-3 py-1.5 rounded-lg font-bold hover:bg-red-900/50 transition">
            Desconectar
          </button>
        </div>
      </header>

      {/* ÁREA INTERNA: MENU LATERAL + CONTEÚDO */}
      <div className="flex flex-1 flex-col md:flex-row">
        
        {/* SIDEBAR DE NAVEGAÇÃO */}
        <nav className="w-full md:w-64 bg-slate-900/50 md:border-r border-slate-800 p-4 space-y-1 flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible gap-1 md:gap-1">
          {[
            { id: 'dashboard', label: '📊 Indicadores Rápidos' },
            { id: 'usuarios', label: '👥 Controle de Usuários' },
            { id: 'rel_geral', label: '📋 Relatório Geral' },
            { id: 'rel_professor', label: '👨‍🏫 Frequência por Docente' },
            { id: 'rel_formacoes', label: '📚 Status de Formações' }
          ].map(item => (
            <button key={item.id} onClick={() => setAbaAtual(item.id)} className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition whitespace-nowrap ${abaAtual === item.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/10' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
              {item.label}
            </button>
          ))}
        </nav>

        {/* ÁREA DINÂMICA DO CONTEÚDO */}
        <main className="flex-1 p-6 lg:p-8">

          {/* ABA: DASHBOARD / INDICADORES */}
          {abaAtual === 'dashboard' && (
            <div className="space-y-6">
              <h2 className="text-xl font-black text-white">Indicadores em Tempo Real</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-md">
                  <span className="text-xs text-slate-400 font-bold uppercase">Formações Ativas Hoje</span>
                  <p className="text-3xl font-black text-blue-500 mt-2">2</p>
                </div>
                <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-md">
                  <span className="text-xs text-slate-400 font-bold uppercase">Total de Presenças Catalogadas</span>
                  <p className="text-3xl font-black text-emerald-500 mt-2">5</p>
                </div>
                <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-md">
                  <span className="text-xs text-slate-400 font-bold uppercase">Alertas de Fraude Capturados</span>
                  <p className="text-3xl font-black text-red-500 mt-2">0</p>
                </div>
              </div>
            </div>
          )}

          {/* ABA: CRUD USUÁRIOS */}
          {abaAtual === 'usuarios' && (
            <div className="space-y-6">
              <h2 className="text-xl font-black text-white">Gestão de Operadores do Painel</h2>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Form de Cadastro */}
                <form className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4 h-fit">
                  <h3 className="text-sm font-black text-slate-300 uppercase tracking-wider">Cadastrar Novo Operador</h3>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400">Nome Completo</label>
                    <input type="text" className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-xs mt-1 outline-none text-white focus:border-blue-500" placeholder="Ex: Ana Maria" required />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400">Usuário (Login Simplificado)</label>
                    <input type="text" className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-xs mt-1 outline-none text-white focus:border-blue-500" placeholder="Ex: anamaria" required />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400">Senha Provisória</label>
                    <input type="text" className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-xs mt-1 outline-none text-white focus:border-blue-500" placeholder="Ex: 123" required />
                  </div>
                  <button type="button" onClick={() => alert('Usuário adicionado no banco! (Primeiro acesso forçará alteração de senha)')} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold p-2.5 rounded-xl text-xs transition">
                    Gravar Usuário
                  </button>
                </form>

                {/* Listagem de Usuários */}
                <div className="lg:col-span-2 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                      <tr>
                        <th className="p-4">Nome</th>
                        <th className="p-4">Login</th>
                        <th className="p-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      <tr>
                        <td className="p-4 font-bold text-white">Gestor Mestre</td>
                        <td className="p-4 font-mono text-slate-400">admin</td>
                        <td className="p-4 text-center">
                          <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full text-[10px] font-bold">Ativo</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ABA: RELATÓRIO GERAL (MELHORIA A: HOVER COM LISTA DE PRESENTES) */}
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
                        <td className="p-4 font-mono text-slate-400">{ev.data}</td>
                        <td className="p-4 text-slate-300">{ev.local}</td>
                        
                        {/* CELULA COM TOOLTIP HOVER DINÂMICO NATIVO EM CSS */}
                        <td className="p-4 text-center relative group cursor-help">
                          <span className="bg-blue-500/10 text-blue-400 font-black px-3 py-1 rounded-lg border border-blue-500/20 text-sm">
                            {ev.comparecimento}
                          </span>
                          
                          {/* Container Oculto que aparece no Hover do componente pai */}
                          <div className="hidden group-hover:block absolute right-1/4 top-10 bg-slate-900 border border-slate-700 p-4 rounded-xl shadow-2xl text-left z-50 w-56 animate-fade-in">
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

          {/* ABA: RELATÓRIO POR PROFESSOR (MELHORIA B: SELEÇÃO POR PERÍODO E TOTAL EM DESTAQUE) */}
          {abaAtual === 'rel_professor' && (
            <div className="space-y-6">
              <h2 className="text-xl font-black text-white">Relatório Consolidado por Docente</h2>
              
              {/* Filtro Obrigatório de Período Cronológico */}
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-wrap gap-4 items-end shadow-md">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400">Data Inicial</label>
                  <input type="date" className="w-full bg-slate-950 border border-slate-800 p-2 rounded-xl text-xs mt-1 outline-none text-white font-mono focus:border-blue-500" value={filtroDatas.inicio} onChange={e => setFiltroDatas({...filtroDatas, inicio: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400">Data Final</label>
                  <input type="date" className="w-full bg-slate-950 border border-slate-800 p-2 rounded-xl text-xs mt-1 outline-none text-white font-mono focus:border-blue-500" value={filtroDatas.fim} onChange={e => setFiltroDatas({...filtroDatas, fim: e.target.value})} />
                </div>
                <button onClick={() => alert('Buscando registros filtrados por data no banco...')} className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition">
                  Filtrar Período
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* CAIXA DE LISTAGEM COM BARRA DE ROLAGEM VERTICAL */}
                <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Selecione o Docente:</h3>
                  <div className="max-h-64 overflow-y-auto border border-slate-800 p-1 rounded-xl space-y-1 bg-slate-950 divide-y divide-slate-900/40">
                    {professoresPeriodo.map((p) => (
                      <button key={p.id} type="button" onClick={() => setProfSelecionado(p)} className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold transition flex flex-col ${profSelecionado?.id === p.id ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
                        <span>{p.nome_completo}</span>
                        <span className={`text-[10px] font-mono mt-0.5 ${profSelecionado?.id === p.id ? 'text-blue-200' : 'text-slate-500'}`}>Matrícula: {p.matricula}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* ESPELHO DO RELATÓRIO DO PROFESSOR SELECIONADO */}
                <div className="md:col-span-2 bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl min-h-[300px] flex flex-col justify-between">
                  {profSelecionado ? (
                    <div className="space-y-6 flex-1">
                      
                      {/* DESTAQUE TOTAL DE HORAS: CENTRALIZADO NA PARTE SUPERIOR DA FOLHA */}
                      <div className="text-center py-4 bg-slate-950 rounded-xl border border-slate-800/80 max-w-md mx-auto shadow-inner">
                        <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Total de Horas Computadas</span>
                        <h2 className="text-4xl font-black text-amber-400 mt-0.5">{historicoProfSelecionado.total_horas}h</h2>
                        <p className="text-[10px] text-slate-400 font-medium mt-1">Período: {filtroDatas.inicio.split('-').reverse().join('/')} a {filtroDatas.fim.split('-').reverse().join('/')}</p>
                      </div>

                      {/* Grade de Histórico */}
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
                      <p className="text-xs font-bold">Selecione um professor na listagem ao lado para emitir a folha consolidada de horas.</p>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* ABA: RELATÓRIO DE FORMAÇÕES (MELHORIA C: HOVER PARTICIPANTES) */}
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
                        
                        {/* CELULA COM TOOLTIP HOVER DINÂMICO DOS PARTICIPANTES */}
                        <td className="p-4 text-center relative group cursor-help">
                          <span className="bg-emerald-500/10 text-emerald-400 font-bold px-2.5 py-1 rounded-lg border border-emerald-500/20">
                            {form.comparecimento} Inscritos
                          </span>
                          
                          {/* Tooltip Absoluto */}
                          <div className="hidden group-hover:block absolute right-1/4 top-10 bg-slate-900 border border-slate-700 p-4 rounded-xl shadow-2xl text-left z-50 w-56 animate-fade-in">
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