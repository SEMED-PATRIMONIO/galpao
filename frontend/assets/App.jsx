import React, { useState, useEffect } from 'react';

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
    
    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');
    const [tipoRelatorio, setTipoRelatorio] = useState('formacoes');
    const [dadosEstatisticos, setDadosEstatisticos] = useState(null);

    const [locaisDisponiveis, setLocaisDisponiveis] = useState([]);
    const [publicosDisponiveis, setPublicosDisponiveis] = useState([]);
    const [mapaCarregado, setMapaCarregado] = useState(false);

    useEffect(() => {
        if (token) {
            carregarDadosPainel();
            if (view === 'eventos') carregarAuxiliaresEventos();
            if (view === 'locais') inicializarMapaQueimados();
        }
    }, [view, token]);

    const apiFetch = async (endpoint, options = {}) => {
        const headers = {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        };
        const API_URL = 'https://formar.paiva.api.br'; // Sua URL do backend
        const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
        if (response.status === 401 || response.status === 403) {
            lidarComLogout();
            throw new Error('Sessão expirada.');
        }
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Erro na requisição.');
        }
        return response.json();
    };

    const carregarDadosPainel = async () => {
        try {
            setErro('');
            let endpoint = '';
            if (view === 'eventos') endpoint = '/api/v2/admin/eventos';
            else if (view === 'locais') endpoint = '/api/v2/locais';
            else if (view === 'participantes') endpoint = '/api/v2/participantes';
            else if (view === 'frequencias') endpoint = '/api/v2/frequencias';
            else if (view === 'log-fraudes') endpoint = '/api/v2/log-fraudes';
            else if (view === 'pesquisa-satisfacao') endpoint = '/api/v2/pesquisa-satisfacao';
            else if (view === 'publico-alvo') endpoint = '/api/v2/publico-alvo';
            else if (view === 'usuarios') endpoint = '/api/v2/usuarios';

            if (endpoint) {
                const dados = await apiFetch(endpoint);
                setLista(dados);
                setTotaisSuperior(dados.length);
            }
        } catch (err) {
            setErro(err.message);
        }
    };

    const processarRelatorio = async () => {
        if (!dataInicio || !dataFim) {
            setErro('Selecione o período.');
            return;
        }
        try {
            setErro('');
            const dados = await apiFetch(`/api/v2/relatorios/${tipoRelatorio}?data_inicio=${dataInicio}&data_fim=${dataFim}`);
            if (tipoRelatorio === 'estatisticas') {
                setDadosEstatisticos(dados);
                setLista([]);
            } else {
                setLista(dados);
                setDadosEstatisticos(null);
            }
        } catch (err) {
            setErro(err.message);
        }
    };

    const carregarAuxiliaresEventos = async () => {
        try {
            const locais = await apiFetch('/api/v2/locais');
            const publicos = await apiFetch('/api/v2/publico-alvo');
            setLocaisDisponiveis(locais || []);
            setPublicosDisponiveis(publicos || []);
        } catch (err) {}
    };

    const inicializarMapaQueimados = () => {
        setTimeout(() => {
            const container = document.getElementById('mapa-cadastro-local');
            if (!container || mapaCarregado) return;
            if (window.L) {
                 renderizarMapa(window.L);
            } else {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
                document.head.appendChild(link);
                const script = document.createElement('script');
                script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
                script.onload = () => renderizarMapa(window.L);
                document.body.appendChild(script);
            }
        }, 100);
    };

    const renderizarMapa = (L) => {
        if (window.mapaInstancia) window.mapaInstancia.remove();
        const mapa = L.map('mapa-cadastro-local').setView([-22.7144, -43.5539], 13);
        window.mapaInstancia = mapa;
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapa);
        let marcador;
        mapa.on('click', (e) => {
            if (marcador) mapa.removeLayer(marcador);
            marcador = L.marker([e.latlng.lat, e.latlng.lng]).addTo(mapa);
            setForm(prev => ({ ...prev, latitude: e.latlng.lat.toFixed(6), longitude: e.latlng.lng.toFixed(6) }));
        });
        setMapaCarregado(true);
    };

    const lidarComMudancaHora = (campo, valor) => {
        setForm(prev => {
            const novoForm = { ...prev, [campo]: valor };
            if (novoForm.hora_inicio && novoForm.hora_fim) {
                const [hIni, mIni] = novoForm.hora_inicio.split(':').map(Number);
                const [hFim, mFim] = novoForm.hora_fim.split(':').map(Number);
                const diferencaMinutos = (hFim * 60 + mFim) - (hIni * 60 + mIni);
                novoForm.carga_horaria = diferencaMinutos > 0 ? (diferencaMinutos / 60).toFixed(2) : '';
            }
            return novoForm;
        });
    };

    const lidarComLogin = async (e) => {
        e.preventDefault();
        try {
            setErro('');
            const data = await apiFetch('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ usuario: usuarioInput, senha: senhaInput })
            });
            if (data.deve_alterar_senha) {
                setUser({ usuario: usuarioInput, deve_alterar_senha: true });
                return;
            }
            localStorage.setItem('admin_token', data.token);
            localStorage.setItem('admin_user', JSON.stringify(data.user));
            setToken(data.token);
            setUser(data.user);
            setView('eventos');
        } catch (err) {
            setErro(err.message);
        }
    };

    const lidarComAlteracaoSenha = async (e) => {
        e.preventDefault();
        if (novaSenha !== confirmarNovaSenha) {
            setErro('As senhas não coincidem.');
            return;
        }
        try {
            setErro('');
            await apiFetch('/api/auth/alterar-senha', {
                method: 'POST',
                body: JSON.stringify({ usuario: user.usuario, novaSenha })
            });
            alert('Senha alterada!');
            lidarComLogout();
        } catch (err) {
            setErro(err.message);
        }
    };

    const lidarComLogout = () => {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        setToken(null);
        setUser(null);
        setView('eventos');
        setLista([]);
        setForm({});
        setIsEditando(false);
        setMapaCarregado(false);
        if (window.mapaInstancia) window.mapaInstancia.remove();
    };

    const lidarComSubmissaoForm = async (e) => {
        e.preventDefault();
        try {
            setErro('');
            let url = `/api/v2/${view}`;
            const metodo = isEditando ? 'PUT' : 'POST';
            const endpoint = isEditando ? `${url}/${selecionado.id}` : url;
            
            // CORREÇÃO DEFINITIVA: Cria um objeto limpo para envio
            let dadosParaEnviar = { ...form };

            // Se for a tela de eventos, intercepta e injeta os dados reais do local_id guardados em memória
            if (view === 'eventos') {
                // Procura o local correspondente na lista de locais carregados no painel
                const localReal = locaisDisponiveis.find(l => l.id === parseInt(form.local_id));
                
                dadosParaEnviar = {
                    ...form,
                    palestrante: form.palestrante || '',
                    local: localReal ? localReal.nome : '',
                    endereco: localReal ? localReal.endereco : '',
                    latitude: localReal ? parseFloat(localReal.latitude) : null,
                    longitude: localReal ? parseFloat(localReal.longitude) : null
                };
            }

            // Transmite os dados perfeitamente preenchidos para o backend
            await apiFetch(endpoint, { method: metodo, body: JSON.stringify(dadosParaEnviar) });
            
            setForm({});
            setIsEditando(false);
            setSelecionado(null);
            carregarDadosPainel();
        } catch (err) {
            setErro(err.message);
        }
    };

    const alterarSenhaLogado = async (e) => {
        e.preventDefault();
        try {
            setErro('');
            await apiFetch('/api/v2/usuarios/alterar-propria-senha', { method: 'PUT', body: JSON.stringify({ novaSenha }) });
            setNovaSenha('');
            alert('Sua senha foi atualizada!');
        } catch (err) {
            setErro(err.message);
        }
    };

    const iniciarEdicao = (item) => {
        setSelecionado(item);
        setIsEditando(true);
        if (view === 'eventos') {
            setForm({ titulo: item.titulo, data_evento: item.data_evento.substring(0,10), carga_horaria: item.carga_horaria, local_id: item.local_id, publico_alvo_id: item.publico_alvo_id, hora_inicio: item.hora_inicio, hora_fim: item.hora_fim });
        } else if (view === 'locais') {
            setForm({ nome: item.nome, endereco: item.endereco, latitude: item.latitude, longitude: item.longitude });
        } else if (view === 'participantes') {
            setForm({ nome_completo: item.nome_completo, ativo: item.ativo });
        }
    };

    const deletarRegistro = async (id) => {
        if (!confirm('Remover registro?')) return;
        try {
            await apiFetch(`/api/v2/${view}/${id}`, { method: 'DELETE' });
            carregarDadosPainel();
        } catch (err) {
            setErro(err.message);
        }
    };

    if (!token) {
        if (user && user.deve_alterar_senha) {
            return (
                <div style={estilos.telaLogin}>
                    <div style={estilos.caixaLogin}>
                        <h2 style={estilos.tituloLogin}>Nova Senha Obrigatória</h2>
                        {erro && <div style={estilos.erroBox}>{erro}</div>}
                        <form onSubmit={lidarComAlteracaoSenha} style={estilos.formulario}>
                            <div style={estilos.campoGrupo}>
                                <label style={estilos.rotulo}>Nova Senha</label>
                                <input type="password" style={estilos.entrada} value={novaSenha} onChange={e => setNovaSenha(e.target.value)} required />
                            </div>
                            <div style={estilos.campoGrupo}>
                                <label style={estilos.rotulo}>Confirmar Nova Senha</label>
                                <input type="password" style={estilos.entrada} value={confirmarNovaSenha} onChange={e => setConfirmarNovaSenha(e.target.value)} required />
                            </div>
                            <button type="submit" style={estilos.btnSucesso}>SALVAR NOVA SENHA</button>
                        </form>
                    </div>
                </div>
            );
        }
        return (
            <div style={estilos.telaLogin}>
                <div style={estilos.caixaLogin}>
                    
                    {/* Logotipo pequena centralizada acima do título */}
                    <img 
                        src="/logap.png" 
                        alt="Logo" 
                        style={{ height: '45px', objectFit: 'contain', marginBottom: '15px', display: 'inline-block' }} />
                    {/* Título alterado para FORMAÇÕES em maiúsculo e negrito */}
                    <h2 style={{ ...estilos.tituloLogin, fontWeight: '900', letterSpacing: '0.5px' }}>FORMAÇÕES</h2>
                    
                    {erro && <div style={estilos.erroBox}>{erro}</div>}
                    
                    <form onSubmit={lidarComLogin} style={estilos.formulario}>
                        <div style={estilos.campoGrupo}>
                            <label style={estilos.rotulo}>Usuário</label>
                            <input type="text" style={estilos.entrada} value={usuarioInput} onChange={e => setUsuarioInput(e.target.value)} required />
                        </div>
                        <div style={estilos.campoGrupo}>
                            <label style={estilos.rotulo}>Senha</label>
                            <input type="password" style={estilos.entrada} value={senhaInput} onChange={e => setSenhaInput(e.target.value)} required />
                        </div>
                        <button type="submit" style={estilos.btnPrimario}>ENTRAR</button>
                    </form>
                </div>
                {/* Rodapé institucional disfarçado e centralizado */}
                <div style={{ position: 'absolute', bottom: '15px', left: 0, right: 0, textAlign: 'center', color: '#64748b', fontSize: '11px', opacity: 0.7, padding: '0 10px', pointerEvents: 'none' }}>
                    Desenvolvido pela Subsecretaria Adjunta de Inovação e Tecnologia - SEMED - Queimados/RJ
                </div>
            </div>
        );
    }

    return (
        <div style={estilos.layoutPrincipal}>
            <div style={estilos.barraLateral}>
                <div style={{ marginBottom: '30px', textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '5px 0' }}>
                    <img src="/logap.png" alt="Logo Painel" style={{ height: '38px', objectFit: 'contain' }} />
                </div>
                <div style={estilos.usuarioStatus}>Logado como: {user?.usuario}</div>
                <div style={view === 'eventos' ? estilos.menuItemAtivo : estilos.menuItem} onClick={() => { setView('eventos'); setDadosEstatisticos(null); }}>FORMAÇÕES</div>
                <div style={view === 'locais' ? estilos.menuItemAtivo : estilos.menuItem} onClick={() => { setView('locais'); setDadosEstatisticos(null); setMapaCarregado(false); }}>LOCAIS</div>
                <div style={view === 'participantes' ? estilos.menuItemAtivo : estilos.menuItem} onClick={() => { setView('participantes'); setDadosEstatisticos(null); }}>PARTICIPANTES</div>
                <div style={view === 'frequencias' ? estilos.menuItemAtivo : estilos.menuItem} onClick={() => { setView('frequencias'); setDadosEstatisticos(null); }}>HISTÓRICO DE COMPARECIMENTO</div>
                <div style={view === 'log-fraudes' ? estilos.menuItemAtivo : estilos.menuItem} onClick={() => { setView('log-fraudes'); setDadosEstatisticos(null); }}>OCORRÊNCIAS</div>
                <div style={view === 'pesquisa-satisfacao' ? estilos.menuItemAtivo : estilos.menuItem} onClick={() => { setView('pesquisa-satisfacao'); setDadosEstatisticos(null); }}>PESQUISA DE OPINIÃO'</div>
                <div style={view === 'publico-alvo' ? estilos.menuItemAtivo : estilos.menuItem} onClick={() => { setView('publico-alvo'); setDadosEstatisticos(null); }}>PÚBLICO-ALVO</div>
                <div style={view === 'usuarios' ? estilos.menuItemAtivo : estilos.menuItem} onClick={() => { setView('usuarios'); setDadosEstatisticos(null); }}>USUÁRIOS</div>
                <div style={view === 'relatorios' ? estilos.menuItemAtivo : estilos.menuItem} onClick={() => { setView('relatorios'); setLista([]); setDadosEstatisticos(null); }}>RELATÓRIOS</div>
                <div style={estilos.btnLogout} onClick={lidarComLogout}>Sair</div>
            </div>

            <div style={estilos.conteudoPrincipal}>
                <div style={{backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 20, border: '1px solid #e2e8f0'}}>
                    <span style={{fontWeight: 'bold', textTransform: 'uppercase', fontSize: 13}}>LISTAGEM DOS REGISTROS DE: {view}</span>
                    <span style={{float: 'right', fontWeight: 'bold', color: '#1e3a8a'}}>Total Registros: {totaisSuperior}</span>
                </div>

                {erro && <div style={estilos.erroBox}>{erro}</div>}

                {view === 'eventos' && (
                    <div style={estilos.splitLayout}>
                        <div style={estilos.colunaEsquerda}>
                            <table style={estilos.tabela}>
                                <thead>
                                    <tr style={estilos.tabelaHeader}>
                                        <th style={estilos.th}>Título</th>
                                        <th style={estilos.th}>Data</th>
                                        <th style={estilos.th}>Início</th>
                                        <th style={estilos.th}>Término</th>
                                        <th style={estilos.th}>Palestrante</th>
                                        <th style={estilos.th}>Local</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lista.map(item => (
                                        <tr key={item.id} style={estilos.tabelaLinha}>
                                            <td style={estilos.td}>{item.titulo}</td>
                                            <td style={estilos.td}>{new Date(ev.data_evento).toLocaleDateString('pt-BR')}</td>
                                            <td style={estilos.td}>{ev.hora_inicio ? ev.hora_inicio.slice(0, 5) : '--:--'}</td>
                                            <td style={estilos.td}>{ev.hora_fim ? ev.hora_fim.slice(0, 5) : '--:--'}</td>
                                            <td style={estilos.td}>{ev.palestrante || 'Nenhum lançado'}</td>
                                            <td style={estilos.td}>{ev.local}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div style={estilos.colunaDireita}>
                            {erro && <div style={{ ...estilos.erroBox, marginBottom: '15px', padding: '10px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '6px' }}>{erro}</div>}
                            <form onSubmit={lidarComSubmissaoForm} style={estilos.formulario}>
                                <div style={estilos.campoGrupo}>
                                    <label style={estilos.rotulo}>Título da Formação</label>
                                    <input type="text" style={estilos.entrada} value={form.titulo || ''} onChange={e => setForm({...form, titulo: e.target.value})} required />
                                </div>
                                
                                <div style={estilos.campoGrupo}>
                                    <label style={estilos.rotulo}>Palestrante (Opcional)</label>
                                    <input type="text" style={estilos.entrada} value={form.palestrante || ''} onChange={e => setForm({...form, palestrante: e.target.value})} placeholder="Nome do palestrante" />
                                </div>

                                <div style={estilos.campoGrupo}>
                                    <label style={estilos.rotulo}>Data</label>
                                    <input type="date" style={estilos.entrada} value={form.data_evento || ''} onChange={e => setForm({...form, data_evento: e.target.value})} required />
                                </div>

                                <div style={{ display: 'flex', gap: 10, marginBottom: 15 }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={estilos.rotulo}>Início</label>
                                        <input type="time" style={estilos.entrada} value={form.hora_inicio || ''} onChange={e => lidarComMudancaHora('hora_inicio', e.target.value)} required />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={estilos.rotulo}>Término</label>
                                        <input type="time" style={estilos.entrada} value={form.hora_fim || ''} onChange={e => lidarComMudancaHora('hora_fim', e.target.value)} required />
                                    </div>
                                </div>

                                <div style={estilos.campoGrupo}>
                                    <label style={estilos.rotulo}>Carga Horária</label>
                                    <input type="number" step="0.01" style={estilos.entrada} readOnly value={form.carga_horaria || ''} />
                                </div>

                                <div style={estilos.campoGrupo}>
                                    <label style={estilos.rotulo}>Local da Formação</label>
                                    <select 
                                        style={estilos.entrada} 
                                        value={form.local_id || ''} 
                                        onChange={e => {
                                            const idSel = parseInt(e.target.value);
                                            const localAchei = locaisDisponiveis.find(l => l.id === idSel);
                                            if (localAchei) {
                                                setForm({
                                                    ...form,
                                                    local_id: idSel,
                                                    latitude: localAchei.latitude,
                                                    longitude: localAchei.longitude
                                                });
                                            } else {
                                                setForm({ ...form, local_id: '', latitude: null, longitude: null });
                                            }
                                        }} 
                                        required
                                    >
                                        <option value="">-- Selecione o Local --</option>
                                        {locaisDisponiveis.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
                                    </select>
                                </div>

                                <div style={estilos.campoGrupo}>
                                    <label style={estilos.rotulo}>Público-Alvo</label>
                                    <select style={estilos.entrada} value={form.publico_alvo_id || ''} onChange={e => setForm({...form, publico_alvo_id: parseInt(e.target.value)})} required>
                                        <option value="">-- Selecione o Público --</option>
                                        {publicosDisponiveis.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                                    </select>
                                </div>

                                <button type="submit" style={estilos.btnPrimario}>SALVAR FORMAÇÃO</button>
                            </form>

                            {/* EXIBIÇÃO DO MAPA INTERATIVO AMPLIADO COM FORMATO DE INCORPORAÇÃO CORRETO */}
                            {form.latitude && form.longitude && (
                                <div style={{ marginTop: '20px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #cbd5e1' }}>
                                    <div style={{ backgroundColor: '#f8fafc', padding: '10px', fontSize: '12px', fontWeight: 'bold', color: '#0f172a', textAlign: 'left', borderBottom: '1px solid #cbd5e1' }}>
                                        📍 Localização Geográfica do Espaço Sincronizada
                                    </div>
                                    <iframe
                                        title="Mapa do Local Selecionado"
                                        width="100%"
                                        height="360"
                                        frameBorder="0"
                                        style={{ border: 0 }}
                                        src={`https://maps.google.com/maps?q=${form.latitude},${form.longitude}&z=16&output=embed`}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {view === 'locais' && (
                    <div style={estilos.splitLayout}>
                        <div style={estilos.colunaEsquerda}>
                            <table style={estilos.tabela}>
                                <thead>
                                    <tr style={estilos.tabelaHeader}><th style={estilos.th}>Nome</th><th style={estilos.th}>Ações</th></tr>
                                </thead>
                                <tbody>
                                    {lista.map(item => (
                                        <tr key={item.id} style={estilos.tabelaLinha}>
                                            <td style={estilos.td}>{item.nome}</td>
                                            <td style={estilos.td}>
                                                <button style={estilos.btnLink} onClick={() => iniciarEdicao(item)}>Editar</button>
                                                <button style={estilos.btnLinkErro} onClick={() => deletarRegistro(item.id)}>Excluir</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div style={estilos.colunaDireita}>
                            <form onSubmit={lidarComSubmissaoForm} style={estilos.formulario}>
                                <input type="text" placeholder="Nome" style={estilos.entrada} value={form.nome || ''} onChange={e => setForm({...form, nome: e.target.value})} required />
                                <input type="text" placeholder="Endereço" style={estilos.entrada} value={form.endereco || ''} onChange={e => setForm({...form, endereco: e.target.value})} required />
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <input type="text" readOnly placeholder="Lat" style={estilos.entrada} value={form.latitude || ''} required />
                                    <input type="text" readOnly placeholder="Lng" style={estilos.entrada} value={form.longitude || ''} required />
                                </div>
                                <div id="mapa-cadastro-local" style={{ height: 180, borderRadius: 8, border: '1px solid #cbd5e1' }}></div>
                                <button type="submit" style={estilos.btnPrimario}>SALVAR ESPAÇO</button>
                            </form>
                        </div>
                    </div>
                )}

                {view === 'participantes' && (
                    <div style={estilos.splitLayout}>
                        <div style={estilos.colunaEsquerda}>
                            <table style={estilos.tabela}>
                                <thead>
                                    <tr style={estilos.tabelaHeader}><th style={estilos.th}>Nome</th><th style={estilos.th}>Matrícula</th><th style={estilos.th}>Status</th><th style={estilos.th}>Ações</th></tr>
                                </thead>
                                <tbody>
                                    {lista.map(item => (
                                        <tr key={item.id} style={estilos.tabelaLinha}>
                                            <td style={estilos.td}>{item.nome_completo}</td>
                                            <td style={estilos.td}>{item.matricula}</td>
                                            <td style={estilos.td}>{item.ativo ? 'Ativo' : 'Inativo'}</td>
                                            <td style={estilos.td}>
                                                <button style={estilos.btnLink} onClick={() => iniciarEdicao(item)}>Editar</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div style={estilos.colunaDireita}>
                            {isEditando && (
                                <form onSubmit={lidarComSubmissaoForm} style={estilos.formulario}>
                                    <input type="text" style={estilos.entrada} value={form.nome_completo || ''} onChange={e => setForm({...form, nome_completo: e.target.value})} required />
                                    <select style={estilos.entrada} value={String(form.ativo)} onChange={e => setForm({...form, ativo: e.target.value === 'true'})}>
                                        <option value="true">Reativar (Ativo)</option>
                                        <option value="false">Inativar (Inativo)</option>
                                    </select>
                                    <button type="submit" style={estilos.btnPrimario}>ATUALIZAR STATUS</button>
                                </form>
                            )}
                        </div>
                    </div>
                )}

                {view === 'frequencias' && (
                    <table style={estilos.tabela}>
                        <thead>
                            <tr style={estilos.tabelaHeader}><th style={estilos.th}>Participante</th><th style={estilos.th}>Formação</th><th style={estilos.th}>Entrada</th><th style={estilos.th}>Saída</th><th style={estilos.th}>Duração</th></tr>
                        </thead>
                        <tbody>
                            {lista.map((f, i) => (
                                <tr key={i} style={estilos.tabelaLinha}>
                                    <td style={estilos.td}>{f.participante_nome} ({f.matricula})</td>
                                    <td style={estilos.td}>{f.evento_titulo}</td>
                                    <td style={estilos.td}>{new Date(f.data_entrada).toLocaleString('pt-BR')}</td>
                                    <td style={estilos.td}>{f.data_saida ? new Date(f.data_saida).toLocaleString('pt-BR') : 'Em Aberto'}</td>
                                    <td style={estilos.td}>{f.permanencia || '--:--'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {view === 'log-fraudes' && (
                    <table style={estilos.tabela}>
                        <thead>
                            <tr style={estilos.tabelaHeader}><th style={estilos.th}>Matrícula</th><th style={estilos.th}>Formação Vinculada</th><th style={estilos.th}>Motivo / Ocorrência</th><th style={estilos.th}>Data Evento</th></tr>
                        </thead>
                        <tbody>
                            {lista.map((lf, i) => (
                                <tr key={i} style={estilos.tabelaLinha}>
                                    <td style={estilos.td}>{lf.matricula}</td>
                                    <td style={estilos.td}>{lf.evento_titulo || 'Nenhum próximo'}</td>
                                    <td style={{...estilos.td, color: '#ef4444', fontWeight: 'bold'}}>{lf.motivo}</td>
                                    <td style={estilos.td}>{new Date(lf.data_tentativa).toLocaleString('pt-BR')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {view === 'pesquisa-satisfacao' && (
                    <table style={estilos.tabela}>
                        <thead>
                            <tr style={estilos.tabelaHeader}><th style={estilos.th}>Participante</th><th style={estilos.th}>Formação</th><th style={estilos.th}>Avaliação</th><th style={estilos.th}>Comentário</th></tr>
                        </thead>
                        <tbody>
                            {lista.map((ps, i) => (
                                <tr key={i} style={estilos.tabelaLinha}>
                                    <td style={estilos.td}>{ps.participante_nome}</td>
                                    <td style={estilos.td}>{ps.evento_titulo}</td>
                                    <td style={estilos.td}>{'⭐'.repeat(ps.estrelas)}</td>
                                    <td style={estilos.td}>{ps.comentario || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {view === 'publico-alvo' && (
                    <div style={estilos.splitLayout}>
                        <div style={estilos.colunaEsquerda}>
                            <table style={estilos.tabela}>
                                <thead>
                                    <tr style={estilos.tabelaHeader}><th style={estilos.th}>Nome Técnico</th><th style={estilos.th}>Ações</th></tr>
                                </thead>
                                <tbody>
                                    {lista.map(item => (
                                        <tr key={item.id} style={estilos.tabelaLinha}>
                                            <td style={estilos.td}>{item.nome}</td>
                                            <td style={estilos.td}>
                                                <button style={estilos.btnLinkErro} onClick={() => deletarRegistro(item.id)}>Remover</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div style={estilos.colunaDireita}>
                            <form onSubmit={lidarComSubmissaoForm} style={estilos.formulario}>
                                <input type="text" placeholder="Nome do Público" style={estilos.entrada} value={form.nome || ''} onChange={e => setForm({...form, nome: e.target.value})} required />
                                <button type="submit" style={estilos.btnPrimario}>SALVAR PÚBLICO</button>
                            </form>
                        </div>
                    </div>
                )}

                {view === 'usuarios' && (
                    <div style={estilos.splitLayout}>
                        <div style={estilos.colunaEsquerda}>
                            <table style={estilos.tabela}>
                                <thead>
                                    <tr style={estilos.tabelaHeader}><th style={estilos.th}>Nome</th><th style={estilos.th}>Login</th></tr>
                                </thead>
                                <tbody>
                                    {lista.map(item => (
                                        <tr key={item.id} style={estilos.tabelaLinha}><td style={estilos.td}>{item.nome}</td><td style={estilos.td}>{item.usuario}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div style={estilos.colunaDireita}>
                            <form onSubmit={alterarSenhaLogado} style={{...estilos.formulario, marginBottom: 20, padding: 10, border: '1px dashed #cbd5e1', borderRadius: 8}}>
                                <label style={estilos.rotulo}>Alterar Minha Própria Senha</label>
                                <input type="password" placeholder="Nova Senha" style={estilos.entrada} value={novaSenha} onChange={e => setNovaSenha(e.target.value)} required />
                                <button type="submit" style={estilos.btnSucesso}>ATUALIZAR MINHA SENHA</button>
                            </form>
                            <form onSubmit={lidarComSubmissaoForm} style={estilos.formulario}>
                                <label style={estilos.rotulo}>Cadastrar Novo Usuário</label>
                                <input type="text" placeholder="Nome" style={estilos.entrada} value={form.nome || ''} onChange={e => setForm({...form, nome: e.target.value})} required />
                                <input type="text" placeholder="Login" style={estilos.entrada} value={form.usuario || ''} onChange={e => setForm({...form, usuario: e.target.value})} required />
                                <input type="password" placeholder="Senha Inicial" style={estilos.entrada} value={form.senha || ''} onChange={e => setForm({...form, senha: e.target.value})} required />
                                <button type="submit" style={estilos.btnPrimario}>CRIAR OPERADOR</button>
                            </form>
                        </div>
                    </div>
                )}

                {view === 'relatorios' && (
                    <div>
                        <div style={{ display: 'flex', gap: 15, alignItems: 'flex-end', marginBottom: 20, backgroundColor: '#fff', padding: 20, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                            <select style={estilos.entrada} value={tipoRelatorio} onChange={e => setTipoRelatorio(e.target.value)}>
                                <option value="formacoes">Relatório de Formações</option>
                                <option value="participante">Relatório por Participante</option>
                                <option value="publico-alvo">Relatório por Público-Alvo</option>
                                <option value="estatisticas">Estatísticas Gerais</option>
                            </select>
                            <input type="date" style={estilos.entrada} value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
                            <input type="date" style={estilos.entrada} value={dataFim} onChange={e => setDataFim(e.target.value)} />
                            <button style={estilos.btnPrimario} onClick={processarRelatorio}>GERAR EM TELA</button>
                            <button style={estilos.btnPdf} onClick={() => window.print()}>IMPRIMIR / PDF</button>
                        </div>

                        {dadosEstatisticos ? (
                            <div>
                                <h3 style={estilos.cardTitulo}>Sumário Estatístico Consolidado</h3>
                                <div style={{display: 'flex', gap: 10, marginBottom: 20}}>
                                    <div style={{flex: 1, padding: 15, backgroundColor: '#fff', borderRadius: 8, border: '1px solid #cbd5e1'}}>
                                        <h4>Participações por Evento</h4>
                                        {dadosEstatisticos.participacoes.map((p,i) => <p key={i} style={{fontSize: 13}}>{p.titulo}: <strong>{p.total}</strong></p>)}
                                    </div>
                                    <div style={{flex: 1, padding: 15, backgroundColor: '#fff', borderRadius: 8, border: '1px solid #cbd5e1'}}>
                                        <h4>Média Pesquisa de Opinião</h4>
                                        {dadosEstatisticos.opiniao.map((o,i) => <p key={i} style={{fontSize: 13}}>{o.titulo}: <strong>{o.media_estrelas || 0} ⭐ ({o.total_respostas} respostas)</strong></p>)}
                                    </div>
                                    <div style={{flex: 1, padding: 15, backgroundColor: '#fff', borderRadius: 8, border: '1px solid #cbd5e1'}}>
                                        <h4>Ocorrências / Fraudes</h4>
                                        {dadosEstatisticos.ocorrencias.map((oc,i) => <p key={i} style={{fontSize: 13, color: '#ef4444'}}>{oc.motivo}: <strong>{oc.total}</strong></p>)}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <table style={estilos.tabela}>
                                <thead>
                                    <tr style={estilos.tabelaHeader}>
                                        {tipoRelatorio === 'formacoes' && (
                                            <>
                                                <th style={estilos.th}>Título</th>
                                                <th style={estilos.th}>Data</th>
                                                <th style={estilos.th}>Local</th>
                                            </>
                                        )}
                                        {tipoRelatorio === 'participante' && (
                                            <>
                                                <th style={estilos.th}>Nome</th>
                                                <th style={estilos.th}>Formação</th>
                                                <th style={estilos.th}>Tempo</th>
                                            </>
                                        )}
                                        {tipoRelatorio === 'publico-alvo' && (
                                            <>
                                                <th style={estilos.th}>Público Alvo</th>
                                                <th style={estilos.th}>Formação Vinculada</th>
                                                <th style={estilos.th}>Total Presenças</th>
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {lista.map((item, idx) => (
                                        <tr key={idx} style={estilos.tabelaLinha}>
                                            {tipoRelatorio === 'formacoes' && (
                                                <>
                                                    <td style={estilos.td}>{item.titulo}</td>
                                                    <td style={estilos.td}>{new Date(item.data_evento).toLocaleDateString('pt-BR')}</td>
                                                    <td style={estilos.td}>{item.local_nome}</td>
                                                </>
                                            )}
                                            {tipoRelatorio === 'participante' && (
                                                <>
                                                    <td style={estilos.td}>{item.nome_completo} ({item.matricula})</td>
                                                    <td style={estilos.td}>{item.evento_titulo}</td>
                                                    <td style={estilos.td}>{item.permanencia || 'Em aberto'}</td>
                                                </>
                                            )}
                                            {tipoRelatorio === 'publico-alvo' && (
                                                <>
                                                    <td style={estilos.td}>{item.publico_nome}</td>
                                                    <td style={estilos.td}>{item.evento_titulo}</td>
                                                    <td style={estilos.td}>{item.total_participacoes}</td>
                                                </>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

const estilos = {
    telaLogin: { 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh', 
        backgroundColor: '#0f172a', // Alterado para o azul escuro conforme solicitado
        padding: '20px',
        position: 'relative' // Necessário para fixar o rodapé disfarçado
    },
    caixaLogin: { 
        backgroundColor: '#fff', 
        padding: '30px', 
        borderRadius: 12, 
        width: '100%', 
        maxWidth: 360, 
        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)', 
        textAlign: 'center' 
    },
    logoInstitucional: { fontSize: 20, fontWeight: '800', color: '#1e3a8a', textAlign: 'center', marginBottom: 5 },
    tituloLogin: { 
        fontSize: 22, 
        color: '#0f172a', // Alterado para combinar com o fundo escuro da tela
        marginBottom: 20, 
        textAlign: 'center' 
    },
    formulario: { display: 'flex', flexDirection: 'column', gap: 12 },
    campoGrupo: { display: 'flex', flexDirection: 'column', gap: 4 },
    rotulo: { fontSize: 11, fontWeight: '700', color: '#475569', textTransform: 'uppercase' },
    entrada: { padding: '10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14, width: '100%', boxSizing: 'border-box' },
    btnPrimario: { backgroundColor: '#1e3a8a', color: '#fff', border: 'none', padding: '12px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', width: '100%' },
    btnSucesso: { backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '12px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', width: '100%' },
    erroBox: { backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', padding: 10, borderRadius: 6, fontSize: 13, marginBottom: 15, textAlign: 'center' },
    layoutPrincipal: { display: 'flex', minHeight: '100vh', backgroundColor: '#f1f5f9' },
    barraLateral: { width: 250, backgroundColor: '#fff', padding: '20px', display: 'flex', flexDirection: 'column', gap: 4, color: '#fff' },
    sidebarLogo: { fontSize: 18, fontWeight: '900', marginBottom: 4, textAlign: 'center' },
    usuarioStatus: { fontSize: 11, color: '#93c5fd', marginBottom: 20, textAlign: 'center' },
    menuItem: { padding: '10px 12px', borderRadius: 6, color: '#bfdbfe', cursor: 'pointer', fontSize: 13 },
    menuItemAtivo: { padding: '10px 12px', borderRadius: 6, color: '#fff', backgroundColor: '#1d4ed8', cursor: 'pointer', fontWeight: 'bold', fontSize: 13 },
    btnLogout: { marginTop: 'auto', padding: '10px 12px', borderRadius: 6, color: '#fca5a5', cursor: 'pointer', textAlign: 'center', border: '1px dashed #f87171' },
    conteudoPrincipal: { flex: 1, padding: '30px' },
    cardTitulo: { fontSize: 15, fontWeight: '700', marginBottom: 15 },
    btnLink: { background: 'none', border: 'none', color: '#1e40af', cursor: 'pointer', fontWeight: '600', marginRight: 10 },
    btnLinkErro: { background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: '600' },
    btnPdf: { backgroundColor: '#475569', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' },
    tabela: { width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: 6, overflow: 'hidden' },
    tabelaHeader: { backgroundColor: '#f1f5f9' },
    th: { textAlign: 'left', padding: '10px', color: '#64748b', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' },
    tabelaLinha: { borderBottom: '1px solid #edf2f7' },
    td: { padding: '12px 10px', color: '#334155', fontSize: 13 },
    splitLayout: { display: 'flex', gap: 20 },
    colunaEsquerda: { flex: 1.3 },
    colunaDireita: { flex: 0.7, backgroundColor: '#fff', padding: 20, borderRadius: 8, border: '1px solid #e2e8f0' }
};