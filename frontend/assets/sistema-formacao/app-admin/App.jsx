import React, { useState, useEffect } from 'react';

export default function App() {
    const [token, setToken] = useState(localStorage.getItem('admin_token') || null);
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('admin_user')) || null);
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
    
    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');
    const [tipoRelatorio, setTipoRelatorio] = useState('prestacao-contas');

    useEffect(() => {
        if (token) {
            carregarDados();
        }
    }, [view, token]);

    const apiFetch = async (endpoint, options = {}) => {
        const headers = {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        };
        const response = await fetch(`http://localhost:3009${endpoint}`, { ...options, headers });
        if (response.status === 401 || response.status === 403) {
            handleLogout();
            throw new Error('Sessão expirada.');
        }
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Erro na requisição.');
        }
        return response.json();
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setErro('');
        try {
            const data = await apiFetch('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ usuario: usuarioInput, senha: senhaInput })
            });
            localStorage.setItem('admin_token', data.token);
            localStorage.setItem('admin_user', JSON.stringify(data.user));
            setToken(data.token);
            setUser(data.user);
            if (data.user.deve_alterar_senha) {
                setView('alterar-senha');
            } else {
                setView('eventos');
            }
        } catch (err) {
            setErro(err.message);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        setToken(null);
        setUser(null);
        setView('eventos');
    };

    const handleAlterarSenha = async (e) => {
        e.preventDefault();
        setErro('');
        if (novaSenha !== confirmarNovaSenha) {
            setErro('As senhas não coincidem.');
            return;
        }
        try {
            await apiFetch(`/api/v2/usuarios/${user.id}/senha`, {
                method: 'PATCH',
                body: JSON.stringify({ novaSenha })
            });
            const updatedUser = { ...user, deve_alterar_senha: false };
            localStorage.setItem('admin_user', JSON.stringify(updatedUser));
            setUser(updatedUser);
            setView('eventos');
            alert('Senha alterada com sucesso!');
        } catch (err) {
            setErro(err.message);
        }
    };

    const carregarDados = async () => {
        try {
            let endpoint = `/api/v2/${view}`;
            if (view === 'relatorios') {
                endpoint = `/api/v2/relatorios/${tipoRelatorio}?data_inicio=${dataInicio}&data_fim=${dataFim}`;
            }
            const data = await apiFetch(endpoint);
            setLista(data);
            setSelecionado(null);
            setForm({});
            setIsEditando(false);
        } catch (err) {
            console.error(err.message);
        }
    };

    const handleSalvar = async (e) => {
        e.preventDefault();
        try {
            const method = isEditando ? 'PUT' : 'POST';
            const endpoint = isEditando ? `/api/v2/${view}/${selecionado.id}` : `/api/v2/${view}`;
            await apiFetch(endpoint, { method, body: JSON.stringify(form) });
            carregarDados();
        } catch (err) {
            alert(err.message);
        }
    };

    const handleInativarReativar = async (id, ativo) => {
        try {
            const acao = ativo ? 'inativar' : 'reativar';
            await apiFetch(`/api/v2/${view}/${id}/${acao}`, { method: 'PATCH' });
            carregarDados();
        } catch (err) {
            alert(err.message);
        }
    };

    const handleGerarPDF = () => {
        const conteudo = document.getElementById('area-tabela').innerHTML;
        const janelaJanela = window.open('', '_blank');
        janelaJanela.document.write(`
            <html>
            <head><title>Relatório - Prefeitura de Queimados</title></head>
            <body onload="window.print()">
                <h2>Relatório: ${tipoRelatorio.toUpperCase()}</h2>
                <p>Período: ${dataInicio || 'Início'} até ${dataFim || 'Fim'}</p>
                ${conteudo}
            </body>
            </html>
        `);
        janelaJanela.document.close();
    };

    if (!token) {
        return (
            <div style={styles.loginContainer}>
                <form onSubmit={handleLogin} style={styles.loginForm}>
                    <h2 style={{ textAlign: 'center', marginBottom: 20 }}>SGO - Queimados Admin</h2>
                    {erro && <div style={styles.errorAlert}>{erro}</div>}
                    <input type="text" placeholder="Usuário" value={usuarioInput} onChange={e => setUsuarioInput(e.target.value)} style={styles.input} required />
                    <input type="password" placeholder="Senha" value={senhaInput} onChange={e => setSenhaInput(e.target.value)} style={styles.input} required />
                    <button type="submit" style={styles.btnPrimario}>Entrar no Sistema</button>
                </form>
            </div>
        );
    }

    if (view === 'alterar-senha' || user?.deve_alterar_senha) {
        return (
            <div style={styles.loginContainer}>
                <form onSubmit={handleAlterarSenha} style={styles.loginForm}>
                    <h2 style={{ textAlign: 'center', marginBottom: 20 }}>Alteração Obrigatória de Senha</h2>
                    {erro && <div style={styles.errorAlert}>{erro}</div>}
                    <input type="password" placeholder="Nova Senha" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} style={styles.input} required />
                    <input type="password" placeholder="Confirme a Nova Senha" value={confirmarNovaSenha} onChange={e => setConfirmarNovaSenha(e.target.value)} style={styles.input} required />
                    <button type="submit" style={styles.btnPrimario}>Atualizar Senha</button>
                </form>
            </div>
        );
    }

    return (
        <div style={styles.dashboardContainer}>
            <div style={styles.sidebar}>
                <div style={styles.logoArea}>
                    <span style={{ fontWeight: 'bold', color: '#fff' }}>QUEIMADOS</span>
                    <span style={{ fontSize: 11, color: '#1E5EE6' }}> EDUCAÇÃO</span>
                </div>
                <button onClick={() => setView('eventos')} style={view === 'eventos' ? styles.sidebarBtnAtivo : styles.sidebarBtn}>Gestão de Eventos</button>
                <button onClick={() => setView('professores')} style={view === 'professores' ? styles.sidebarBtnAtivo : styles.sidebarBtn}>Professores</button>
                <button onClick={() => setView('locais')} style={view === 'locais' ? styles.sidebarBtnAtivo : styles.sidebarBtn}>Locais</button>
                <button onClick={() => setView('usuarios')} style={view === 'usuarios' ? styles.sidebarBtnAtivo : styles.sidebarBtn}>Usuários</button>
                <button onClick={() => setView('publico-alvo')} style={view === 'publico-alvo' ? styles.sidebarBtnAtivo : styles.sidebarBtn}>Público Alvo</button>
                <button onClick={() => setView('relatorios')} style={view === 'relatorios' ? styles.sidebarBtnAtivo : styles.sidebarBtn}>Relatórios</button>
                <div style={{ marginTop: 'auto', padding: 10 }}>
                    <p style={{ color: '#aaa', fontSize: 12, marginBottom: 5 }}>Olá, {user?.nome}</p>
                    <button onClick={() => setView('alterar-senha')} style={styles.btnSenha}>Alterar Senha</button>
                    <button onClick={handleLogout} style={styles.btnSair}>Sair</button>
                </div>
            </div>

            <div style={styles.conteudoPrincipal}>
                {view === 'relatorios' ? (
                    <div>
                        <h2>Prestação de Contas (MEC) / Logs</h2>
                        <div style={styles.filtroContainer}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                <label style={{ fontSize: 11, color: '#aaa', fontWeight: 'bold' }}>TIPO DE RELATÓRIO</label>
                                <select value={tipoRelatorio} onChange={e => setTipoRelatorio(e.target.value)} style={styles.inputFiltro}>
                                    <option value="prestacao-contas">Prestação de Contas</option>
                                    <option value="log-frequencia">Log de Frequência Individual</option>
                                    <option value="log-fraudes">Log de Fraudes</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                <label style={{ fontSize: 11, color: '#aaa', fontWeight: 'bold' }}>FILTRAR POR PERÍODO</label>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} style={styles.inputFiltro} />
                                    <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} style={styles.inputFiltro} />
                                </div>
                            </div>
                            <button onClick={carregarDados} style={styles.btnGerar}>GERAR LISTAGEM</button>
                            <button onClick={handleGerarPDF} style={styles.btnPdf}>EXPORTAR PDF</button>
                        </div>

                        <div id="area-tabela" style={{ marginTop: 25 }}>
                            <table style={styles.tabela}>
                                <thead>
                                    <tr style={styles.tabelaHeader}>
                                        {tipoRelatorio === 'prestacao-contas' && (
                                            <>
                                                <th style={styles.th}>EVENTO</th>
                                                <th style={styles.th}>DATA</th>
                                                <th style={styles.th}>CH</th>
                                                <th style={styles.th}>LOCAL</th>
                                                <th style={styles.th}>PARTICIPANTES</th>
                                            </>
                                        )}
                                        {tipoRelatorio === 'log-frequencia' && (
                                            <>
                                                <th style={styles.th}>PROFESSOR</th>
                                                <th style={styles.th}>EVENTO</th>
                                                <th style={styles.th}>ENTRADA</th>
                                                <th style={styles.th}>SAÍDA</th>
                                            </>
                                        )}
                                        {tipoRelatorio === 'log-fraudes' && (
                                            <>
                                                <th style={styles.th}>EVENTO</th>
                                                <th style={styles.th}>DISPOSITIVO</th>
                                                <th style={styles.th}>MOTIVO</th>
                                                <th style={styles.th}>DATA HORA</th>
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {lista.map((item, idx) => (
                                        <tr key={idx} style={styles.tabelaLinha}>
                                            {tipoRelatorio === 'prestacao-contas' && (
                                                <>
                                                    <td style={styles.td}>{item.titulo}</td>
                                                    <td style={styles.td}>{new Date(item.data_evento).toLocaleDateString('pt-BR')}</td>
                                                    <td style={styles.td}>{item.carga_horaria}h</td>
                                                    <td style={styles.td}>{item.local_nome}</td>
                                                    <td style={styles.td}>{item.total_participantes}</td>
                                                </>
                                            )}
                                            {tipoRelatorio === 'log-frequencia' && (
                                                <>
                                                    <td style={styles.td}>{item.participante_nome}</td>
                                                    <td style={styles.td}>{item.evento_titulo}</td>
                                                    <td style={styles.td}>{item.data_entrada ? new Date(item.data_entrada).toLocaleString('pt-BR') : '-'}</td>
                                                    <td style={styles.td}>{item.data_saida ? new Date(item.data_saida).toLocaleString('pt-BR') : '-'}</td>
                                                </>
                                            )}
                                            {tipoRelatorio === 'log-fraudes' && (
                                                <>
                                                    <td style={styles.td}>{item.evento_titulo}</td>
                                                    <td style={styles.td}>{item.device_fingerprint || 'Desconhecido'}</td>
                                                    <td style={styles.td}>{item.motivo}</td>
                                                    <td style={styles.td}>{new Date(item.data_tentativa).toLocaleString('pt-BR')}</td>
                                                </>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div style={styles.splitLayout}>
                        <div style={styles.colunaEsquerda}>
                            <h2>Listagem de {view.toUpperCase()}</h2>
                            <div style={styles.acoesTop}>
                                <button onClick={() => { setIsEditando(false); setForm({}); setSelecionado(null); }} style={styles.btnPrimario}>Novo Registro</button>
                            </div>
                            <div style={{ overflowY: 'auto', maxHeight: '70vh' }}>
                                <table style={styles.tabela}>
                                    <thead>
                                        <tr style={styles.tabelaHeader}>
                                            <th style={styles.th}>ID</th>
                                            <th style={styles.th}>NOME / TÍTULO</th>
                                            <th style={styles.th}>STATUS</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lista.map(item => (
                                            <tr key={item.id} onClick={() => { setSelecionado(item); setForm(item); setIsEditando(true); }} style={{ ...styles.tabelaLinha, backgroundColor: selecionado?.id === item.id ? '#e9ecef' : 'transparent' }}>
                                                <td style={styles.td}>{item.id}</td>
                                                <td style={styles.td}>{item.nome || item.titulo}</td>
                                                <td style={styles.td}>{item.ativo ?? true ? 'Ativo' : 'Inativo'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div style={styles.colunaDireita}>
                            <h2>{isEditando ? 'Editar Registro' : 'Incluir Registro'}</h2>
                            <form onSubmit={handleSalvar} style={styles.formulario}>
                                {view === 'eventos' && (
                                    <>
                                        <input type="text" placeholder="Título do Evento" value={form.titulo || ''} onChange={e => setForm({...form, titulo: e.target.value})} style={styles.input} required />
                                        <input type="date" value={form.data_evento || ''} onChange={e => setForm({...form, data_evento: e.target.value})} style={styles.input} required />
                                        <input type="number" placeholder="Carga Horária" value={form.carga_horaria || ''} onChange={e => setForm({...form, carga_horaria: e.target.value})} style={styles.input} required />
                                        <input type="text" placeholder="Palestrante" value={form.palestrante || ''} onChange={e => setForm({...form, palestrante: e.target.value})} style={styles.input} />
                                        <input type="number" placeholder="ID Local" value={form.local_id || ''} onChange={e => setForm({...form, local_id: e.target.value})} style={styles.input} required />
                                        <input type="text" placeholder="Hora Início (HH:MM)" value={form.hora_inicio || ''} onChange={e => setForm({...form, hora_inicio: e.target.value})} style={styles.input} required />
                                        <input type="text" placeholder="Hora Fim (HH:MM)" value={form.hora_fim || ''} onChange={e => setForm({...form, hora_fim: e.target.value})} style={styles.input} required />
                                        <input type="number" placeholder="ID Público Alvo" value={form.publico_alvo_id || ''} onChange={e => setForm({...form, publico_alvo_id: e.target.value})} style={styles.input} required />
                                        <input type="text" placeholder="Token QR Code" value={form.token_qr || ''} onChange={e => setForm({...form, token_qr: e.target.value})} style={styles.input} />
                                    </>
                                )}
                                {view === 'professores' && (
                                    <>
                                        <input type="text" placeholder="Nome Completo" value={form.nome_completo || ''} onChange={e => setForm({...form, nome_completo: e.target.value})} style={styles.input} required />
                                        <input type="text" placeholder="Matrícula" value={form.matricula || ''} onChange={e => setForm({...form, matricula: e.target.value})} style={styles.input} required />
                                        <input type="text" placeholder="CPF" value={form.cpf || ''} onChange={e => setForm({...form, cpf: e.target.value})} style={styles.input} required />
                                    </>
                                )}
                                {(view === 'locais' || view === 'publico-alvo' || view === 'usuarios') && (
                                    <>
                                        <input type="text" placeholder="Nome" value={form.nome || ''} onChange={e => setForm({...form, nome: e.target.value})} style={styles.input} required />
                                        {view === 'locais' && (
                                            <>
                                                <input type="text" placeholder="Endereço" value={form.endereco || ''} onChange={e => setForm({...form, endereco: e.target.value})} style={styles.input} required />
                                                <input type="number" step="any" placeholder="Latitude" value={form.latitude || ''} onChange={e => setForm({...form, latitude: e.target.value})} style={styles.input} required />
                                                <input type="number" step="any" placeholder="Longitude" value={form.longitude || ''} onChange={e => setForm({...form, longitude: e.target.value})} style={styles.input} required />
                                            </>
                                        )}
                                        {view === 'usuarios' && (
                                            <>
                                                <input type="text" placeholder="Usuário login" value={form.usuario || ''} onChange={e => setForm({...form, usuario: e.target.value})} style={styles.input} required />
                                                <input type="password" placeholder="Senha" value={form.senha || ''} onChange={e => setForm({...form, senha: e.target.value})} style={styles.input} required />
                                            </>
                                        )}
                                    </>
                                )}
                                <div style={{ display: 'flex', gap: 10, marginTop: 15 }}>
                                    <button type="submit" style={styles.btnPrimario}>Salvar Alterações</button>
                                    {isEditando && (
                                        <button type="button" onClick={() => handleInativarReativar(selecionado.id, selecionado.ativo ?? true)} style={styles.btnPerigo}>
                                            {selecionado.ativo ?? true ? 'Inativar Registro' : 'Reativar Registro'}
                                        </button>
                                    )}
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

const styles = {
    loginContainer: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f4f6f9' },
    loginForm: { padding: 30, backgroundColor: '#fff', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', width: 350, display: 'flex', flexDirection: 'column', gap: 12 },
    input: { padding: 12, border: '1px solid #ced4da', borderRadius: 6, fontSize: 14, outline: 'none' },
    btnPrimario: { backgroundColor: '#5442E6', color: '#fff', border: 'none', padding: 12, borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' },
    errorAlert: { padding: 10, backgroundColor: '#f8d7da', color: '#721c24', borderRadius: 4, fontSize: 13 },
    dashboardContainer: { display: 'flex', height: '100vh', backgroundColor: '#f8f9fa' },
    sidebar: { width: 240, backgroundColor: '#0d1527', display: 'flex', flexDirection: 'column', padding: '20px 10px', gap: 6 },
    logoArea: { padding: '10px 15px', marginBottom: 20, borderBottom: '1px solid #1e293b' },
    sidebarBtn: { backgroundColor: 'transparent', color: '#94a3b8', border: 'none', textAlign: 'left', padding: '12px 15px', borderRadius: 6, cursor: 'pointer', fontWeight: '500', fontSize: 14 },
    sidebarBtnAtivo: { backgroundColor: '#1E5EE6', color: '#fff', border: 'none', textAlign: 'left', padding: '12px 15px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', fontSize: 14 },
    conteudoPrincipal: { flex: 1, padding: 30, overflowY: 'auto' },
    filtroContainer: { display: 'flex', backgroundColor: '#fff', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0', alignItems: 'flex-end', gap: 20, marginTop: 15 },
    inputFiltro: { padding: '10px 15px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14, minWidth: 180, outline: 'none' },
    btnGerar: { backgroundColor: '#5442E6', color: '#fff', border: 'none', padding: '12px 25px', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', fontSize: 13 },
    btnPdf: { backgroundColor: '#475569', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', fontSize: 13 },
    tabela: { width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: 8, overflow: 'hidden' },
    tabelaHeader: { backgroundColor: '#f1f5f9', borderBottom: '2px solid #e2e8f0' },
    th: { textAlign: 'left', padding: '12px 16px', color: '#64748b', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
    tabelaLinha: { borderBottom: '1px solid #edf2f7', cursor: 'pointer' },
    td: { padding: '14px 16px', color: '#334155', fontSize: 14 },
    splitLayout: { display: 'flex', gap: 30, height: '100%' },
    colunaEsquerda: { flex: 1.2, display: 'flex', flexDirection: 'column', gap: 15 },
    colunaDireita: { flex: 0.8, backgroundColor: '#fff', padding: 25, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' },
    formulario: { display: 'flex', flexDirection: 'column', gap: 12 },
    btnPerigo: { backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: 12, borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' },
    btnSenha: { backgroundColor: '#334155', color: '#fff', border: 'none', padding: 8, borderRadius: 6, cursor: 'pointer', width: '100%', fontSize: 12, marginBottom: 5 },
    btnSair: { backgroundColor: '#b91c1c', color: '#fff', border: 'none', padding: 8, borderRadius: 6, cursor: 'pointer', width: '100%', fontSize: 12 }
};