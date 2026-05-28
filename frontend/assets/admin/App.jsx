import React, { useState, useEffect, useRef } from 'react';

export default function App() {
    const obterUsuarioSeguro = () => {
        try {
            const dadosSalvos = localStorage.getItem('admin_user');
            if (!dadosSalvos) return null;
            return JSON.parse(dadosSalvos);
        } catch (e) {
            localStorage.removeItem('admin_user'); 
            localStorage.removeItem('admin_token'); 
            return null;
        }
    };

    const tokenSalvo = localStorage.getItem('admin_token');
    const [token, setToken] = useState(tokenSalvo && tokenSalvo !== 'undefined' && tokenSalvo !== 'null' ? tokenSalvo : null);
    const [user, setUser] = useState(obterUsuarioSeguro());
    const [view, setView] = useState('eventos');
    const [usuarioInput, setUsuarioInput] = useState('');
    const [senhaInput, setSenhaInput] = useState('');
    const [novaSenha, setNovaSenha] = useState('');
    const [confirmarNovaSenha, setConfirmarNovaSenha] = useState('');
    const [erro, setErro] = useState('');
    
    const [lista, setLista] = useState([]);
    const [selecionado, setSelecionado] = useState(null);
    const [form, setForm] = useState({});
    const [isEditando, setIsEditando] = useState(false);
    const [totaisSuperior, setTotaisSuperior] = useState(0);
    
    const [dataInicio, setDataInicio] = useState(new Date().toISOString().split('T')[0]);
    const [dataFim, setDataFim] = useState(new Date().toISOString().split('T')[0]);
    const [areaFiltro, setAreaFiltro] = useState('');
    const [setorFiltro, setSetorFiltro] = useState('');
    const [publicoFiltro, setPublicoFiltro] = useState('');

    const [combos, setCombos] = useState({ areas: [], setores: [], locais: [], publicos: [] });
    const [horaSaidaManualInput, setHoraSaidaManualInput] = useState('');
    const [hoveredRowId, setHoveredRowId] = useState(null);

    const API_URL = window.location.origin.includes('localhost') ? 'http://localhost:3009' : '';

    useEffect(() => {
        if (token) {
            carregarCombosAuxiliares();
            executarListagem();
        }
    }, [token, view]);

    const carregarCombosAuxiliares = async () => {
        try {
            const headers = { 'Authorization': `Bearer ${token}` };
            const [rA, rS, rL, rP] = await Promise.all([
                fetch(`${API_URL}/api/v2/admin-exclusivo/combos/areas`, { headers }),
                fetch(`${API_URL}/api/v2/admin-exclusivo/combos/setores`, { headers }),
                fetch(`${API_URL}/api/v2/admin-exclusivo/combos/locais`, { headers }),
                fetch(`${API_URL}/api/v2/admin-exclusivo/combos/publicos`, { headers })
            ]);
            setCombos({
                areas: rA.ok ? await rA.json() : [],
                setores: rS.ok ? await rS.json() : [],
                locais: rL.ok ? await rL.json() : [],
                publicos: rP.ok ? await rP.json() : []
            });
        } catch (e) {}
    };

    const lidarComLogin = async (e) => {
        e.preventDefault();
        setErro('');
        try {
            const res = await fetch(`${API_URL}/api/v2/admin-exclusivo/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usuario: usuarioInput, senha: senhaInput })
            });
            const data = await res.json();
            if (!res.ok) {
                setErro(data.error || 'Erro ao efetuar login.');
                return;
            }
            localStorage.setItem('admin_token', data.token);
            localStorage.setItem('admin_user', JSON.stringify(data.user));
            setToken(data.token);
            setUser(data.user);
        } catch (err) {
            setErro('Falha de comunicação.');
        }
    };

    const lidarComAlteracaoSenhaObrigatoria = async (e) => {
        e.preventDefault();
        setErro('');
        if (novaSenha !== confirmarNovaSenha) {
            setErro('As senhas digitadas não conferem.');
            return;
        }
        try {
            const res = await fetch(`${API_URL}/api/v2/admin-exclusivo/auth/alterar-senha-obrigatoria`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ usuario: user.usuario, novaSenha })
            });
            if (res.ok) {
                const usuarioAtualizado = { ...user, deve_alterar_senha: false };
                localStorage.setItem('admin_user', JSON.stringify(usuarioAtualizado));
                setUser(usuarioAtualizado);
            } else {
                const d = await res.json();
                setErro(d.error || 'Erro ao alterar.');
            }
        } catch (err) {
            setErro('Erro na conexão.');
        }
    };

    const efetuarLogout = () => {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        setToken(null);
        setUser(null);
    };

    const estilos = {
        layout: { display: 'flex', fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh' },
        sidebar: { width: '240px', backgroundColor: '#0f172a', padding: '20px', display: 'flex', flexDirection: 'column', color: '#cbd5e1' },
        brand: { fontSize: '18px', fontWeight: 'bold', color: '#fff', marginBottom: '25px', textAlign: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '15px' },
        menu: { listStyle: 'none', padding: 0, margin: 0, flex: 1 },
        main: { flex: 1, padding: '30px', boxSizing: 'border-box' },
        topo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', backgroundColor: '#fff', padding: '15px 20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
        card: { backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '20px' },
        gridFiltros: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '15px' },
        tabela: { width: '100%', borderCollapse: 'collapse', marginTop: '10px', fontSize: '13px' },
        th: { backgroundColor: '#f1f5f9', color: '#475569', fontWeight: '600', padding: '10px', textAlign: 'left', borderBottom: '2px solid #e2e8f0' },
        td: { padding: '10px', borderBottom: '1px solid #e2e8f0', color: '#334155', position: 'relative' },
        btnMenu: { display: 'block', width: '100%', padding: '10px 12px', borderRadius: '6px', border: 'none', background: 'none', color: '#94a3b8', textAlign: 'left', cursor: 'pointer', fontWeight: '500', marginBottom: '5px', fontSize: '13px' },
        btnMenuAtivo: { display: 'block', width: '100%', padding: '10px 12px', borderRadius: '6px', border: 'none', backgroundColor: '#0284c7', color: '#fff', textAlign: 'left', cursor: 'pointer', fontWeight: '600', marginBottom: '5px', fontSize: '13px' },
        btnAcao: { padding: '6px 12px', borderRadius: '4px', border: 'none', fontWeight: '600', cursor: 'pointer', fontSize: '12px' },
        tooltip: { position: 'absolute', backgroundColor: '#1e293b', color: '#fff', padding: '8px 12px', borderRadius: '4px', fontSize: '12px', zIndex: 999, top: '100%', left: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', maxWidth: '280px', whiteSpace: 'normal', lineHeight: '1.4' },
        alertaErro: { padding: '10px', borderRadius: '6px', backgroundColor: '#fee2e2', color: '#991b1b', fontSize: '13px', fontWeight: 'bold', marginBottom: '15px' },
        entradaForm: { padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px', width: '100%', boxSizing: 'border-box' }
    };
    const executarListagem = async () => {
        try {
            setErro('');
            setLista([]);
            const res = await fetch(`${API_URL}/api/v2/admin-exclusivo/listagens/${view}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Erro ao buscar dados do painel.');
            const dados = await res.json();
            setLista(dados);
            setTotaisSuperior(dados.length);
        } catch (err) {
            setErro(err.message);
        }
    };

    const processarRelatorioIntegrado = async () => {
        try {
            setErro('');
            let url = `${API_URL}/api/v2/admin-exclusivo/relatorio-integrado?data_inicio=${dataInicio}&data_fim=${dataFim}`;
            if (areaFiltro) url += `&area_id=${areaFiltro}`;
            if (setorFiltro) url += `&setor_id=${setorFiltro}`;
            if (publicoFiltro) url += `&publico_alvo_id=${publicoFiltro}`;

            const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!res.ok) throw new Error('Erro ao processar relatório filtrado.');
            const dados = await res.json();
            setDadosEstatisticos(dados.totais);
            setLista(dados.registros);
            setTotaisSuperior(dados.registros.length);
        } catch (err) {
            setErro(err.message);
        }
    };

    const processarSaidaManualAdmin = async () => {
        if (!horaSaidaManualInput) return alert('Por favor, informe o horário de saída.');
        try {
            const res = await fetch(`${API_URL}/api/v2/admin-exclusivo/frequencias/saida-manual`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    frequencia_id: selecionado.id,
                    hora_saida: horaSaidaManualInput
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro operacional.');
            alert(data.message || 'Saída registrada com sucesso!');
            setHoraSaidaManualInput('');
            setSelecionado(null);
            executarListagem();
        } catch (err) {
            alert(err.message);
        }
    };

    const processarAtualizacaoTempoParticipacao = async () => {
        if (!selecionado) return;
        try {
            const res = await fetch(`${API_URL}/api/v2/admin-exclusivo/frequencias/atualizar-tempo-esquecimento`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ frequencia_id: selecionado.id })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro ao processar atualização.');
            alert('Tempo de participação recalculado com base nas regras horárias oficiais e ocorrência registrada no Log de Fraudes!');
            setSelecionado(null);
            executarListagem();
        } catch (err) {
            alert(err.message);
        }
    };

    const submeterFormularioAdministrativo = async (e) => {
        e.preventDefault();
        try {
            setErro('');
            if (view === 'usuarios' && isEditando && selecionado && selecionado.id === null) {
                if (!novaSenha) throw new Error("A senha de redefinição não pode estar em branco.");
                const res = await fetch(`${API_URL}/api/v2/admin-exclusivo/usuarios/alterar-propria-senha`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ novaSenha })
                });
                if (!res.ok) throw new Error('Erro ao redefinir.');
                alert('Sua senha de operador foi atualizada.');
                fecharFormularioEModais();
                return;
            }

            let url = `/api/v2/admin-exclusivo/${view}`;
            const metodo = isEditando ? 'PUT' : 'POST';
            const endpointFinal = isEditando ? `${url}/${selecionado.id}` : url;

            const res = await fetch(endpointFinal, {
                method: metodo,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(form)
            });
            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error || 'Erro na operação.');
            }
            fecharFormularioEModais();
            executarListagem();
        } catch (err) {
            setErro(err.message);
        }
    };

    const iniciarEdicaoItem = (item) => {
        setSelecionado(item);
        setIsEditando(true);
        if (view === 'locais') {
            setForm({ nome: item.nome, endereco: item.endereco, latitude: item.latitude, longitude: item.longitude });
        } else if (view === 'participantes') {
            setForm({ nome_completo: item.nome_completo, ativo: item.ativo });
        } else if (['publico-alvo', 'setores', 'areas'].includes(view)) {
            setForm({ nome: item.nome });
        } else if (view === 'usuarios') {
            setForm({ nome: item.nome, usuario: item.usuario });
        }
    };

    const fecharFormularioEModais = () => {
        setForm({});
        setIsEditando(false);
        setSelecionado(null);
        setNovaSenha('');
        setConfirmarNovaSenha('');
        setHoraSaidaManualInput('');
    };

    const condicaoBotaoTempo = selecionado && selecionado.tempo_participacao === null && selecionado.data_saida !== null;
if (!token) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#0f172a' }}>
                <form onSubmit={lidarComLogin} style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '100%', maxWidth: '360px' }}>
                    <h2 style={{ textAlign: 'center', color: '#1e293b', marginBottom: '20px', fontSize: '20px', fontWeight: 'bold' }}>Painel Administrativo</h2>
                    {erro && <div style={estilos.alertaErro}>{erro}</div>}
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>Usuário</label>
                        <input type="text" style={estilos.entradaForm} value={usuarioInput} onChange={e => setUsuarioInput(e.target.value)} required />
                    </div>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>Senha</label>
                        <input type="password" style={estilos.entradaForm} value={senhaInput} onChange={e => setSenhaInput(e.target.value)} required />
                    </div>
                    <button type="submit" style={{ ...estilos.btnAcao, backgroundColor: '#0284c7', color: '#fff', width: '100%', padding: '10px' }}>ACESSAR PAINEL</button>
                </form>
            </div>
        );
    }

    if (user && user.deve_alterar_senha) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#0f172a' }}>
                <form onSubmit={lidarComAlteracaoSenhaObrigatoria} style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '100%', maxWidth: '360px' }}>
                    <h2 style={{ textAlign: 'center', color: '#991b1b', marginBottom: '10px', fontSize: '18px', fontWeight: 'bold' }}>Alteração de Senha</h2>
                    <p style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', marginBottom: '20px' }}>Por medidas de segurança, você deve atualizar sua senha de primeiro acesso.</p>
                    {erro && <div style={estilos.alertaErro}>{erro}</div>}
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>Nova Senha</label>
                        <input type="password" style={estilos.entradaForm} value={novaSenha} onChange={e => setNovaSenha(e.target.value)} required />
                    </div>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>Confirmar Nova Senha</label>
                        <input type="password" style={estilos.entradaForm} value={confirmarNovaSenha} onChange={e => setConfirmarNovaSenha(e.target.value)} required />
                    </div>
                    <button type="submit" style={{ ...estilos.btnAcao, backgroundColor: '#16a34a', color: '#fff', width: '100%', padding: '10px' }}>SALVAR NOVA SENHA</button>
                </form>
            </div>
        );
    }

    return (
        <div style={estilos.layout}>
            <div style={estilos.sidebar}>
                <div style={estilos.brand}>SEMED - Formações</div>
                <ul style={estilos.menu}>
                    <li><button onClick={() => setView('eventos')} style={view === 'eventos' ? estilos.btnMenuAtivo : estilos.btnMenu}>📅 Formações</button></li>
                    <li><button onClick={() => setView('locais')} style={view === 'locais' ? estilos.btnMenuAtivo : estilos.btnMenu}>📍 Locais</button></li>
                    <li><button onClick={() => setView('participantes')} style={view === 'participantes' ? estilos.btnMenuAtivo : estilos.btnMenu}>👥 Participantes</button></li>
                    <li><button onClick={() => setView('frequencias')} style={view === 'frequencias' ? estilos.btnMenuAtivo : indicesfrequencias => setView('frequencias') || estilos.btnMenu}>📝 Histórico</button></li>
                    <li><button onClick={() => setView('pesquisa-satisfacao')} style={view === 'pesquisa-satisfacao' ? estilos.btnMenuAtivo : estilos.btnMenu}>⭐ Pesquisa de Opinião</button></li>
                    <li><button onClick={() => setView('publico-alvo')} style={view === 'publico-alvo' ? estilos.btnMenuAtivo : estilos.btnMenu}>🎯 Público-Alvo</button></li>
                    <li><button onClick={() => setView('setores')} style={view === 'setores' ? estilos.btnMenuAtivo : estilos.btnMenu}>🏢 Setores</button></li>
                    <li><button onClick={() => setView('areas')} style={view === 'areas' ? estilos.btnMenuAtivo : estilos.btnMenu}>📖 Áreas</button></li>
                    <li><button onClick={() => setView('usuarios')} style={view === 'usuarios' ? estilos.btnMenuAtivo : estilos.btnMenu}>🔒 Operadores</button></li>
                    <li><button onClick={() => setView('log-fraudes')} style={view === 'log-fraudes' ? estilos.btnMenuAtivo : estilos.btnMenu}>⚠️ Log de Fraudes</button></li>
                </ul>
                <button onClick={efetuarLogout} style={{ ...estilos.btnMenu, color: '#ef4444', marginTop: 'auto', fontWeight: 'bold' }}>🚪 Encerrar Sessão</button>
            </div>

            <div style={estilos.main}>
                <div style={estilos.topo}>
                    <h1 style={{ margin: 0, fontSize: '20px', color: '#1e293b', fontWeight: 'bold', textTransform: 'uppercase' }}>Visualizando: {view}</h1>
                    <div style={{ fontSize: '13px', color: '#64748b' }}>Registros carregados nesta lista: <strong>{totaisSuperior}</strong></div>
                </div>

                {erro && <div style={estilos.alertaErro}>{erro}</div>}

                {view === 'frequencias' && (
                    <div style={{ ...estilos.card, display: 'flex', gap: '15px', alignItems: 'flex-end', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Data de Início:</label>
                            <input type="date" style={estilos.entradaForm} value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Data de Término:</label>
                            <input type="date" style={estilos.entradaForm} value={dataFim} onChange={e => setDataFim(e.target.value)} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Filtrar Área:</label>
                            <select style={estilos.entradaForm} value={areaFiltro} onChange={e => setAreaFiltro(e.target.value)}>
                                <option value="">Todas</option>
                                {combos.areas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                            </select>
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Filtrar Setor:</label>
                            <select style={estilos.entradaForm} value={setorFiltro} onChange={e => setSetorFiltro(e.target.value)}>
                                <option value="">Todos</option>
                                {combos.setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                            </select>
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Público-Alvo:</label>
                            <select style={estilos.entradaForm} value={publicoFiltro} onChange={e => setPublicoFiltro(e.target.value)}>
                                <option value="">Todos</option>
                                {combos.publicos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                            </select>
                        </div>
                        <button onClick={processarRelatorioIntegrado} style={{ ...estilos.btnAcao, backgroundColor: '#0284c7', color: '#fff', padding: '10px 15px' }}>FILTRAR BASE</button>
                    </div>
                )}

                {view === 'frequencias' && selecionado && (
                    <div style={{ ...estilos.card, backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '13px', color: '#1e40af' }}>
                            Professor Selecionado: <strong>{selecionado.participante_nome || selecionado.matricula}</strong> | Entrada: {new Date(selecionado.data_entrada).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})}
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <input type="time" style={{ ...estilos.entradaForm, width: '110px' }} value={horaSaidaManualInput} onChange={e => setHoraSaidaManualInput(e.target.value)} disabled={selecionado.data_saida !== null} />
                            <button onClick={processarSaidaManualAdmin} disabled={selecionado.data_saida !== null} style={{ ...estilos.btnAcao, backgroundColor: selecionado.data_saida !== null ? '#cbd5e1' : '#ea580c', color: '#fff' }}>REGISTRAR SAÍDA MANUAL</button>
                            <button onClick={processarAtualizacaoTempoParticipacao} disabled={!condicaoBotaoTempo} style={{ ...estilos.btnAcao, backgroundColor: condicaoBotaoTempo ? '#16a34a' : '#cbd5e1', color: '#fff' }}>ATUALIZAR TEMPO DE PARTICIPAÇÃO</button>
                            <button onClick={fecharFormularioEModais} style={{ ...estilos.btnAcao, backgroundColor: '#64748b', color: '#fff' }}>CANCELAR</button>
                        </div>
                    </div>
                )}

                <div style={estilos.card}>
                    <table style={estilos.tabela}>
                        <thead>
                            <tr>
                                {view === 'eventos' && (
                                    <>
                                        <th style={estilos.th}>Título da Formação</th>
                                        <th style={estilos.th}>Localização</th>
                                        <th style={estilos.th}>Palestrante / Facilitador</th>
                                        <th style={estilos.th}>Data Evento</th>
                                        <th style={estilos.th}>Horário Oficial</th>
                                    </>
                                )}
                                {view === 'locais' && (
                                    <>
                                        <th style={estilos.th}>Nome do Espaço</th>
                                        <th style={estilos.th}>Endereço Completo</th>
                                        <th style={estilos.th}>Ações</th>
                                    </>
                                )}
                                {view === 'frequencias' && (
                                    <>
                                        <th style={estilos.th}>Matrícula</th>
                                        <th style={estilos.th}>Professor</th>
                                        <th style={estilos.th}>Atividade / Formação</th>
                                        <th style={estilos.th}>Entrada Real</th>
                                        <th style={estilos.th}>Saída Real</th>
                                        <th style={estilos.th}>Carga Horária</th>
                                        <th style={estilos.th}>Tempo Efetivo</th>
                                    </>
                                )}
                                {view === 'pesquisa-satisfacao' && (
                                    <>
                                        <th style={estilos.th}>Atividade / Formação</th>
                                        <th style={estilos.th}>Professor</th>
                                        <th style={estilos.th}>Avaliação</th>
                                        <th style={estilos.th}>Data de Envio</th>
                                    </>
                                )}
                                {['publico-alvo', 'setores', 'areas', 'participantes', 'usuarios', 'log-fraudes'].includes(view) && (
                                    <>
                                        <th style={estilos.th}>Mapeamento de Conteúdo</th>
                                        {view !== 'log-fraudes' && <th style={estilos.th}>Ações</th>}
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {lista.map((item) => {
                                const possuiComentario = view === 'pesquisa-satisfacao' && item.comentarios && item.comentarios.trim() !== '';
                                return (
                                    <tr 
                                        key={item.id} 
                                        onClick={() => view === 'frequencias' && setSelecionado(item)}
                                        onMouseEnter={() => possuiComentario && setHoveredRowId(item.id)}
                                        onMouseLeave={() => possuiComentario && setHoveredRowId(null)}
                                        style={{ 
                                            cursor: view === 'frequencias' ? 'pointer' : 'default',
                                            backgroundColor: selecionado && selecionado.id === item.id ? '#f0fdf4' : (possuiComentario && hoveredRowId === item.id ? '#f8fafc' : 'transparent'),
                                            transition: 'background-color 0.15s ease'
                                        }}
                                    >
                                        {view === 'eventos' && (
                                            <>
                                                <td style={estilos.td}>{item.titulo}</td>
                                                <td style={estilos.td}>{item.local}</td>
                                                <td style={estilos.td}>{item.palestrante}</td>
                                                <td style={estilos.td}>{item.data_evento ? new Date(item.data_evento).toLocaleDateString('pt-BR') : ''}</td>
                                                <td style={estilos.td}>{item.hora_inicio ? item.hora_inicio.slice(0,5) : ''} às {item.hora_fim ? item.hora_fim.slice(0,5) : ''}</td>
                                            </>
                                        )}
                                        {view === 'locais' && (
                                            <>
                                                <td style={estilos.td}>{item.nome}</td>
                                                <td style={estilos.td}>{item.endereco}</td>
                                                <td style={estilos.td}>
                                                    <button onClick={(e) => { e.stopPropagation(); iniciarEdicaoItem(item); }} style={{ ...estilos.btnAcao, backgroundColor: '#0284c7', color: '#fff' }}>Editar</button>
                                                </td>
                                            </>
                                        )}
                                        {view === 'frequencias' && (
                                            <>
                                                <td style={estilos.td}>{item.matricula}</td>
                                                <td style={estilos.td}>{item.participante_nome || 'Não Identificado'}</td>
                                                <td style={estilos.td}>{item.evento_titulo}</td>
                                                <td style={estilos.td}>{item.data_entrada ? new Date(item.data_entrada).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'}) : '--:--'}</td>
                                                <td style={estilos.td}>{item.data_saida ? new Date(item.data_saida).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'}) : '--:--'}</td>
                                                <td style={estilos.td}>{item.carga_horaria ? `${item.carga_horaria}h` : ''}</td>
                                                <td style={estilos.td}><strong style={{ color: item.tempo_participacao ? '#0f172a' : '#ef4444' }}>{item.tempo_participacao || 'Pendente'}</strong></td>
                                            </>
                                        )}
                                        {view === 'pesquisa-satisfacao' && (
                                            <>
                                                <td style={estilos.td}>{item.evento_titulo}</td>
                                                <td style={estilos.td}>{item.participante_nome || item.participante_matricula}</td>
                                                <td style={{ ...estilos.td, fontWeight: possuiComentario ? 'bold' : 'normal' }}>
                                                    {item.avaliacao}
                                                    {possuiComentario && hoveredRowId === item.id && (
                                                        <div style={estilos.tooltip}>
                                                            <strong>Comentário do Professor:</strong><br />
                                                            {item.comentarios}
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={estilos.td}>{item.criado_em ? new Date(item.criado_em).toLocaleDateString('pt-BR') : ''}</td>
                                            </>
                                        )}
                                        {['publico-alvo', 'setores', 'areas', 'participantes', 'usuarios'].includes(view) && (
                                            <>
                                                <td style={estilos.td}>{item.nome || item.nome_completo || item.usuario}</td>
                                                <td style={estilos.td}>
                                                    <button onClick={(e) => { e.stopPropagation(); iniciarEdicaoItem(item); }} style={{ ...estilos.btnAcao, backgroundColor: '#0284c7', color: '#fff' }}>Editar</button>
                                                </td>
                                            </>
                                        )}
                                        {view === 'log-fraudes' && (
                                            <td style={estilos.td}>
                                                Matrícula: <strong>{item.matricula}</strong> | Motivo: <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{item.motivo}</span> | Registro: {item.data_tentativa ? new Date(item.data_tentativa).toLocaleString('pt-BR') : ''}
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}    