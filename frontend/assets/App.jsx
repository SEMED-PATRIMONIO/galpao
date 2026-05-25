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
    const [modalNovoEvento, setModalNovoEvento] = useState(false);

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
        const API_URL = 'https://formar.paiva.api.br';
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
            else if (view === 'participantes') endpoint = '/api/v2/admin/listar-participantes-view';
            else if (view === 'frequencias') endpoint = '/api/v2/frequencias';
            else if (view === 'log-fraudes') endpoint = '/api/v2/log-fraudes';
            else if (view === 'pesquisa-satisfacao') endpoint = '/api/v2/admin/pesquisa-satisfacao-detalhada';
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
            // Chama a nova API exclusiva passando o período
            const dados = await apiFetch(`/api/v2/admin/relatorio-integrado?data_inicio=${dataInicio}&data_fim=${dataFim}`);
            
            // Armazena os blocos de dados recebidos
            setDadosEstatisticos(dados.totais);
            setLista(dados.registros);
            setTotaisSuperior(dados.registros.length);
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
            const prefixoAdmin = view === 'frequencias' ? 'admin/' : '';
            let url = `/api/v2/${prefixoAdmin}${view}`;
            const metodo = isEditando ? 'PUT' : 'POST';
            const endpoint = isEditando ? `${url}/${selecionado.id}` : url;
            
            let dadosParaEnviar = { ...form };

            if (view === 'eventos') {
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

            if (view === 'usuarios' && isEditando) {
                url = `/api/v2/usuarios/alterar-propria-senha`;
                await apiFetch(url, { method: 'PUT', body: JSON.stringify({ novaSenha }) });
                setNovaSenha('');
                alert('Sua senha foi alterada com sucesso!');
                setForm({});
                setIsEditando(false);
                setSelecionado(null);
                carregarDadosPainel();
                return;
            }

            await apiFetch(endpoint, { method: metodo, body: JSON.stringify(dadosParaEnviar) });
            
            setForm({});
            setIsEditando(false);
            setSelecionado(null);
            carregarDadosPainel();
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
            let endpoint = `/api/v2/${view}/${id}`;
            if (view === 'log-fraudes') {
                endpoint = `/api/v2/admin/log-fraudes/${id}`;
            }
            await apiFetch(endpoint, { method: 'DELETE' });
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
                    <img src="/logap.png" alt="Logo" style={{ height: '45px', objectFit: 'contain', marginBottom: '15px', display: 'inline-block' }} />
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
                <div style={view === 'participantes' ?estilos.menuItemAtivo : estilos.menuItem} onClick={() => { setView('participantes'); setDadosEstatisticos(null); }}>PARTICIPANTES</div>
                <div style={view === 'frequencias' ? estilos.menuItemAtivo : estilos.menuItem} onClick={() => { setView('frequencias'); setDadosEstatisticos(null); }}>HISTÓRICO DE COMPARECIMENTO</div>
                <div style={view === 'log-fraudes' ?estilos.menuItemAtivo : estilos.menuItem} onClick={() => { setView('log-fraudes'); setDadosEstatisticos(null); }}>OCORRÊNCIAS</div>
                <div style={view === 'pesquisa-satisfacao' ? estilos.menuItemAtivo : estilos.menuItem} onClick={() => { setView('pesquisa-satisfacao'); setDadosEstatisticos(null); }}>PESQUISA DE OPINIÃO</div>
                <div style={view === 'publico-alvo' ? estilos.menuItemAtivo : estilos.menuItem} onClick={() => { setView('publico-alvo'); setDadosEstatisticos(null); }}>PÚBLICO-ALVO</div>
                <div style={view === 'usuarios' ? estilos.menuItemAtivo : estilos.menuItem} onClick={() => { setView('usuarios'); setDadosEstatisticos(null); }}>USUÁRIOS</div>
                <div style={view === 'relatorios' ? estilos.menuItemAtivo : estilos.menuItem} onClick={() => { setView('relatorios'); setLista([]); setDadosEstatisticos(null); }}>RELATÓRIOS</div>
                <div style={estilos.btnLogout} onClick={lidarComLogout}>Sair</div>
            </div>

            <div style={estilos.conteudoPrincipal}>
                <div style={{backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 20, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <span style={{fontWeight: 'bold', textTransform: 'uppercase', fontSize: 13}}>LISTAGEM DOS REGISTROS DE: {view === 'log-fraudes' ? 'OCORRÊNCIAS' : view}</span>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        {view === 'eventos' && (
                            <button type="button" onClick={() => { setForm({}); setIsEditando(false); setModalNovoEvento(true); inicializarMapaQueimados(); }} style={{ backgroundColor: '#16a34a', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>NOVO</button>
                        )}
                        {view === 'usuarios' && (
                            <button type="button" onClick={() => { setIsEditando(true); setSelecionado({ id: user.id }); setForm({ usuario: user.usuario }); }} style={{ backgroundColor: '#0284c7', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>ALTERAR MINHA SENHA</button>
                        )}
                    </div>
                    <span style={{fontWeight: 'bold', color: '#1e3a8a'}}>Total Registros: {totaisSuperior}</span>
                </div>

                {erro && <div style={estilos.erroBox}>{erro}</div>}
                {view === 'eventos' && (
                    <div style={estilos.splitLayout}>
                        <div style={estilos.colunaEsquerdaSemForm}>
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
                                    {lista.map((item) => (
                                        <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                            <td style={{ padding: '10px', fontWeight: 'bold', color: '#1f2937' }}>{item.titulo}</td>
                                            <td style={estilos.td}>{new Date(item.data_evento).toLocaleDateString('pt-BR')}</td>
                                            <td style={{ padding: '10px', color: '#0284c7', fontWeight: 'bold' }}>{item.hora_inicio ? item.hora_inicio.slice(0,5) : '--:--'}</td>
                                            <td style={{ padding: '10px', color: '#ef4444', fontWeight: 'bold' }}>{item.hora_fim ? item.hora_fim.slice(0,5) : '--:--'}</td>
                                            <td style={estilos.td}>{item.palestrante || 'Não lançado'}</td>
                                            <td style={estilos.td}>{item.local}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {view !== 'eventos' && view !== 'relatorios' && (
                    <div style={estilos.splitLayout}>
                        <div style={{ flex: ['locais', 'publico-alvo', 'usuarios', 'frequencias'].includes(view) ? 2 : 1, backgroundColor: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                            <table style={estilos.tabela}>
                                <thead>
                                    <tr style={estilos.tabelaHeader}>
                                        {view === 'locais' && (
                                            <>
                                                <th style={estilos.th}>Nome</th>
                                                <th style={estilos.th}>Endereço</th>
                                                <th style={estilos.th}>Latitude</th>
                                                <th style={estilos.th}>Longitude</th>
                                                <th style={estilos.th}>Ações</th>
                                            </>
                                        )}
                                        {view === 'participantes' && (
                                            <>
                                                <th style={estilos.th}>Nome</th>
                                                <th style={estilos.th}>Matrícula</th>
                                                <th style={estilos.th}>Ações</th>
                                            </>
                                        )}
                                        {view === 'frequencias' && (
                                            <>
                                                <th style={estilos.th}>Matrícula</th>
                                                <th style={estilos.th}>Participante</th>
                                                <th style={estilos.th}>Evento</th>
                                                <th style={estilos.th}>Entrada</th>
                                                <th style={estilos.th}>Saída</th>
                                                <th style={estilos.th}>Ações</th>
                                            </>
                                        )}
                                        {view === 'log-fraudes' && (
                                            <>
                                                <th style={estilos.th}>Matrícula</th>
                                                <th style={estilos.th}>Motivo</th>
                                                <th style={estilos.th}>Data/Hora</th>
                                                <th style={estilos.th}>Ações</th>
                                            </>
                                        )}
                                        {view === 'pesquisa-satisfacao' && (
                                            <>
                                                <th style={estilos.th}>Participante</th>
                                                <th style={estilos.th}>Matrícula</th>
                                                <th style={estilos.th}>Evento</th>
                                                <th style={estilos.th}>Avaliação</th>
                                                <th style={estilos.th}>Comentários</th>
                                                <th style={estilos.th}>Data/Hora</th>
                                            </>
                                        )}
                                        {view === 'publico-alvo' && (
                                            <>
                                                <th style={estilos.th}>Nome</th>
                                                <th style={estilos.th}>Ações</th>
                                            </>
                                        )}
                                        {view === 'usuarios' && (
                                            <>
                                                <th style={estilos.th}>Usuário</th>
                                                <th style={estilos.th}>Ações</th>
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {lista.map((item) => (
                                        <tr key={item.id} style={{ borderBottom: '1px solid #cbd5e1' }}>
                                            {view === 'locais' && (
                                                <>
                                                    <td style={estilos.td}>{item.nome}</td>
                                                    <td style={estilos.td}>{item.endereco}</td>
                                                    <td style={estilos.td}>{item.latitude}</td>
                                                    <td style={estilos.td}>{item.longitude}</td>
                                                    <td style={estilos.td}>
                                                        <button onClick={() => iniciarEdicao(item)} style={estilos.btnLink}>Editar</button>
                                                        <button onClick={() => deletarRegistro(item.id)} style={estilos.btnLinkErro}>Excluir</button>
                                                    </td>
                                                </>
                                            )}
                                            {view === 'participantes' && (
                                                <>
                                                    <td style={estilos.td}>{item.nome_completo}</td>
                                                    <td style={estilos.td}>{item.matricula}</td>
                                                    <td style={estilos.td}>
                                                        <button onClick={() => iniciarEdicao(item)} style={estilos.btnLink}>Editar</button>
                                                        <button onClick={() => deletarRegistro(item.id)} style={estilos.btnLinkErro}>Excluir</button>
                                                    </td>
                                                </>
                                            )}
                                            {view === 'frequencias' && (
                                                <>
                                                    <td style={estilos.td}>{item.matricula || '--'}</td>
                                                    <td style={estilos.td}>{item.participante_nome || '--'}</td>
                                                    <td style={estilos.td}>{item.evento_titulo || '--'}</td>
                                                    <td style={estilos.td}>{item.data_entrada ? new Date(item.data_entrada).toLocaleString('pt-BR') : '--'}</td>
                                                    <td style={estilos.td}>{item.data_saida ? new Date(item.data_saida).toLocaleString('pt-BR') : 'Em andamento'}</td>
                                                    <td style={estilos.td}>
                                                        <button onClick={() => { setSelecionado(item); setIsEditando(true); setForm({ data_entrada: item.data_entrada.substring(0,16), data_saida: item.data_saida ? item.data_saida.substring(0,16) : '' }); }} style={estilos.btnLink}>Editar</button>
                                                    </td>
                                                </>
                                            )}
                                            {view === 'log-fraudes' && (
                                                <>
                                                    <td style={estilos.td}>{item.matricula}</td>
                                                    <td style={estilos.td}>{item.motivo}</td>
                                                    <td style={estilos.td}>{new Date(item.data_tentativa).toLocaleString('pt-BR')}</td>
                                                    <td style={estilos.td}>
                                                        <button onClick={() => deletarRegistro(item.id)} style={estilos.btnLinkErro}>Excluir</button>
                                                    </td>
                                                </>
                                            )}
                                            {view === 'pesquisa-satisfacao' && (
                                                <>
                                                    <td style={estilos.td}>{item.participante_nome || 'Anónimos'}</td>
                                                    <td style={estilos.td}>{item.participante_matricula || '--'}</td>
                                                    <td style={estilos.td}>{item.evento_titulo || '--'}</td>
                                                    <td style={{ ...estilos.td, color: '#f59e0b', fontSize: '15px', fontWeight: 'bold' }}>
                                                        {(() => {
                                                            switch(item.avaliacao) {
                                                                case 'Muito Bom': return '⭐⭐⭐⭐⭐';
                                                                case 'Bom':       return '⭐⭐⭐⭐';
                                                                case 'Regular':   return '⭐⭐⭐';
                                                                case 'Ruim':      return '⭐⭐';
                                                                case 'Péssimo':   return '⭐';
                                                                default:          return item.avaliacao || '--';
                                                            }
                                                        })()}
                                                    </td>
                                                    <td style={estilos.td}>{item.comentarios || '--'}</td>
                                                    <td style={estilos.td}>
                                                        {item.criado_em ? new Date(item.criado_em).toLocaleString('pt-BR') : '--'}
                                                    </td>
                                                </>
                                            )}
                                            {view === 'publico-alvo' && (
                                                <>
                                                    <td style={estilos.td}>{item.nome}</td>
                                                    <td style={estilos.td}>
                                                        <button onClick={() => { setSelecionado(item); setIsEditando(true); setForm({ nome: item.nome }); }} style={estilos.btnLink}>Editar</button>
                                                        <button onClick={() => deletarRegistro(item.id)} style={estilos.btnLinkErro}>Excluir</button>
                                                    </td>
                                                </>
                                            )}
                                            {view === 'usuarios' && (
                                                <>
                                                    <td style={estilos.td}>{item.usuario}</td>
                                                    <td style={estilos.td}>
                                                        <button onClick={() => deletarRegistro(item.id)} style={estilos.btnLinkErro} disabled={item.usuario === user.usuario}>Excluir</button>
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {['locais', 'publico-alvo', 'usuarios', 'frequencias'].includes(view) && (
                            <div style={estilos.colunaDireita}>
                                <form onSubmit={lidarComSubmissaoForm} style={estilos.formularioPainel}>
                                    <h3 style={{marginTop: 0, marginBottom: '15px'}}>{isEditando ? 'Editar Item' : 'Cadastrar Novo'}</h3>
                                    {view === 'locais' && (
                                        <>
                                            <input type="text" placeholder="Nome do Local" style={estilos.entradaForm} value={form.nome || ''} onChange={e => setForm({...form, nome: e.target.value})} required />
                                            <input type="text" placeholder="Endereço" style={estilos.entradaForm} value={form.endereco || ''} onChange={e => setForm({...form, endereco: e.target.value})} required />
                                            <input type="text" placeholder="Latitude" style={estilos.entradaForm} value={form.latitude || ''} onChange={e => setForm({...form, latitude: e.target.value})} required readOnly />
                                            <input type="text" placeholder="Longitude" style={estilos.entradaForm} value={form.longitude || ''} onChange={e => setForm({...form, longitude: e.target.value})} required readOnly />
                                            <div id="mapa-cadastro-local" style={{ height: '180px', borderRadius: '6px', marginBottom: '15px', backgroundColor: '#e2e8f0' }}></div>
                                        </>
                                    )}
                                    {view === 'publico-alvo' && (
                                        <input type="text" placeholder="Nome do Público" style={estilos.entradaForm} value={form.nome || ''} onChange={e => setForm({...form, nome: e.target.value})} required />
                                    )}
                                    {view === 'frequencias' && isEditando && (
                                        <>
                                            <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Horário de Entrada:</label>
                                            <input type="datetime-local" style={estilos.entradaForm} value={form.data_entrada || ''} onChange={e => setForm({...form, data_entrada: e.target.value})} required />
                                            <label style={{ fontSize: '12px', fontWeight: 'bold', marginTop: '5px' }}>Horário de Saída:</label>
                                            <input type="datetime-local" style={estilos.entradaForm} value={form.data_saida || ''} onChange={e => setForm({...form, data_saida: e.target.value})} />
                                        </>
                                    )}
                                    {view === 'usuarios' && !isEditando && (
                                        <>
                                            <input type="text" placeholder="Nome de Usuário" style={estilos.entradaForm} value={form.usuario || ''} onChange={e => setForm({...form, usuario: e.target.value})} required />
                                            <input type="password" placeholder="Senha" style={estilos.entradaForm} value={form.senha || ''} onChange={e => setForm({...form, senha: e.target.value})} required />
                                        </>
                                    )}
                                    {view === 'usuarios' && isEditando && (
                                        <>
                                            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#0284c7' }}>Nova Senha:</label>
                                            <input type="password" placeholder="Digite a nova senha" style={estilos.entradaForm} value={novaSenha} onChange={e => setNovaSenha(e.target.value)} required />
                                        </>
                                    )}
                                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                        <button type="submit" style={{ ...estilos.btnSucessoForm, flex: 1 }}>
                                            {isEditando ? 'Atualizar' : 'Salvar'}
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => {
                                                setIsEditando(false);
                                                setSelecionado(null);
                                                setForm({});
                                            }} 
                                            style={{
                                                ...estilos.btnSucessoForm,
                                                flex: 1,
                                                backgroundColor: '#ef4444', 
                                                color: '#fff'
                                            }}
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}
                    </div>
                )}

                {view === 'relatorios' && (
                    <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#1e3a8a' }}>Geração de Relatórios Consolidados</h3>
                        
                        {/* Filtros de Escopo */}
                        <div style={{ display: 'flex', gap: '15px', marginBottom: '25px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Início:</label>
                                <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} style={estilos.entrada} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Fim:</label>
                                <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} style={estilos.entrada} />
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={processarRelatorio} style={{ ...estilos.btnPrimario, height: '40px', padding: '0 25px' }}>GERAR RELATÓRIO</button>
                                
                                {/* BOTÃO VOLTAR SOLICITADO */}
                                <button 
                                    onClick={() => {
                                        setLista([]);
                                        setDadosEstatisticos(null);
                                        setDataInicio('');
                                        setDataFim('');
                                        setView('eventos'); // Retorna para a tela principal
                                    }} 
                                    style={{ ...estilos.btnPrimario, height: '40px', padding: '0 20px', backgroundColor: '#64748b', color: '#fff' }}
                                >
                                    VOLTAR
                                </button>
                            </div>
                        </div>

                        {/* Cartões com Indicadores de Totais (Só exibe se o relatório foi gerado) */}
                        {dadosEstatisticos && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '25px' }}>
                                <div style={{ padding: '15px', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe', textAlign: 'center' }}>
                                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e40af', display: 'block', marginBottom: '5px' }}>EVENTOS NO PERÍODO</span>
                                    <strong style={{ fontSize: '22px', color: '#1d4ed8' }}>{dadosEstatisticos.total_eventos}</strong>
                                </div>
                                <div style={{ padding: '15px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
                                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#166534', display: 'block', marginBottom: '5px' }}>TOTAL HORAS OFERTADAS</span>
                                    <strong style={{ fontSize: '22px', color: '#16a34a' }}>{dadosEstatisticos.soma_horas}h</strong>
                                </div>
                                <div style={{ padding: '15px', backgroundColor: '#fdf2f8', borderRadius: '8px', border: '1px solid #fbcfe8', textAlign: 'center' }}>
                                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#9d174d', display: 'block', marginBottom: '5px' }}>REGISTROS DE PRESENÇA</span>
                                    <strong style={{ fontSize: '22px', color: '#db2777' }}>{dadosEstatisticos.total_participacoes}</strong>
                                </div>
                                <div style={{ padding: '15px', backgroundColor: '#fffbeb', borderRadius: '8px', border: '1px solid #fef3c7', textAlign: 'center' }}>
                                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#92400e', display: 'block', marginBottom: '5px' }}>NOTA MÉDIA SATISFAÇÃO</span>
                                    <strong style={{ fontSize: '22px', color: '#d97706' }}>{dadosEstatisticos.nota_media} / 5.0</strong>
                                </div>
                            </div>
                        )}

                        {/* Listagem dos Registros do Relatório */}
                        {lista.length > 0 && (
                            <div>
                                <h4 style={{ marginBottom: '10px', color: '#334155' }}>Registros Encontrados no Escopo</h4>
                                <table style={estilos.tabela}>
                                    <thead>
                                        <tr style={estilos.tabelaHeader}>
                                            <th style={estilos.th}>Matrícula</th>
                                            <th style={estilos.th}>Participante</th>
                                            <th style={estilos.th}>Formação / Evento</th>
                                            <th style={estilos.th}>Carga Horária</th>
                                            <th style={estilos.th}>Entrada</th>
                                            <th style={estilos.th}>Saída</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lista.map((r) => (
                                            <tr key={r.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                <td style={estilos.td}>{r.matricula || '--'}</td>
                                                <td style={estilos.td}>{r.participante_name || r.participante_nome || '--'}</td>
                                                <td style={{ ...estilos.td, fontWeight: 'bold' }}>{r.evento_titulo}</td>
                                                <td style={estilos.td}>{r.carga_horaria ? `${r.carga_horaria}h` : '--'}</td>
                                                <td style={estilos.td}>{r.data_entrada ? new Date(r.data_entrada).toLocaleString('pt-BR') : '--'}</td>
                                                <td style={estilos.td}>{r.data_saida ? new Date(r.data_saida).toLocaleString('pt-BR') : 'Em aberto'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {modalNovoEvento && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
                    <div style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '12px', width: '90%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#0f172a' }}>📐 Cadastrar Nova Formação</h3>
                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            try {
                                setErro('');
                                const localReal = locaisDisponiveis.find(l => l.id === parseInt(form.local_id));
                                const dadosParaEnviar = {
                                    ...form,
                                    palestrante: form.palestrante || '',
                                    local: localReal ? localReal.nome : '',
                                    endereco: localReal ? localReal.endereco : '',
                                    latitude: localReal ? parseFloat(localReal.latitude) : null,
                                    longitude: localReal ? parseFloat(localReal.longitude) : null
                                };
                                await apiFetch('/api/v2/eventos', { method: 'POST', body: JSON.stringify(dadosParaEnviar) });
                                setForm({});
                                setModalNovoEvento(false);
                                carregarDadosPainel();
                            } catch(err) { setErro(err.message); }
                        }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <input type="text" placeholder="Título do Evento" style={estilos.entradaForm} value={form.titulo || ''} onChange={e => setForm({...form, titulo: e.target.value})} required />
                                <input type="date" style={estilos.entradaForm} value={form.data_evento || ''} onChange={e => setForm({...form, data_evento: e.target.value})} required />
                                <input type="time" style={estilos.entradaForm} value={form.hora_inicio || ''} onChange={e => lidarComMudancaHora('hora_inicio', e.target.value)} required />
                                <input type="time" style={estilos.entradaForm} value={form.hora_fim || ''} onChange={e => lidarComMudancaHora('hora_fim', e.target.value)} required />
                                <input type="number" step="0.01" placeholder="Carga Horária" style={estilos.entradaForm} value={form.carga_horaria || ''} readOnly />
                                <input type="text" placeholder="Palestrante / Formador" style={estilos.entradaForm} value={form.palestrante || ''} onChange={e => setForm({...form, palestrante: e.target.value})} />
                                <select value={form.local_id || ''} onChange={e => setForm({...form, local_id: e.target.value})} required style={estilos.entradaForm}>
                                    <option value="">Selecione o Local Oficial...</option>
                                    {locaisDisponiveis.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
                                </select>
                                <select value={form.publico_alvo_id || ''} onChange={e => setForm({...form, publico_alvo_id: e.target.value})} required style={estilos.entradaForm}>
                                    <option value="">Selecione o Público Alvo...</option>
                                    {publicosDisponiveis.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                                </select>
                            </div>
                            <div style={{ marginTop: '25px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button type="button" onClick={() => { setModalNovoEvento(false); setForm({}); }} style={{ padding: '10px 20px', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', backgroundColor: '#fff', fontWeight: 'bold' }}>VOLTAR</button>
                                <button type="submit" style={{ padding: '10px 25px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>CONFIRMAR</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

const estilos = {
    telaLogin: { display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9', fontFamily: 'system-ui' },
    caixaLogin: { backgroundColor: '#fff', padding: '35px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', width: '330px', textAlign: 'center', border: '1px solid #e2e8f0' },
    tituloLogin: { fontSize: '20px', color: '#1e3a8a', margin: '0 0 20px 0' },
    formulario: { display: 'flex', flexDirection: 'column', gap: '15px', textAlign: 'left' },
    campoGrupo: { display: 'flex', flexDirection: 'column', gap: '5px' },
    rotulo: { fontSize: '13px', fontWeight: 'bold', color: '#475569' },
    entrada: { padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' },
    btnPrimario: { padding: '12px', borderRadius: '6px', border: 'none', backgroundColor: '#1e3a8a', color: '#fff', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' },
    btnSucesso: { padding: '12px', borderRadius: '6px', border: 'none', backgroundColor: '#16a34a', color: '#fff', fontWeight: 'bold', cursor: 'pointer' },
    erroBox: { padding: '10px', borderRadius: '6px', backgroundColor: '#fee2e2', color: '#991b1b', fontSize: '13px', fontWeight: 'bold', marginBottom: '10px' },
    layoutPrincipal: { display: 'flex', height: '100vh', backgroundColor: '#f8fafc', fontFamily: 'system-ui' },
    barraLateral: { width: '250px', backgroundColor: '#0f172a', color: '#94a3b8', padding: '20px 15px', display: 'flex', flexDirection: 'column', gap: '6px' },
    usuarioStatus: { fontSize: '12px', color: '#64748b', padding: '0 10px', marginBottom: '15px', borderBottom: '1px solid #1e293b', paddingBottom: '10px' },
    menuItem: { padding: '11px 12px', borderRadius: '6px', color: '#94a3b8', cursor: 'pointer', fontSize: '13px', fontWeight: '500', transition: 'all 0.2s' },
    menuItemAtivo: { padding: '11px 12px', borderRadius: '6px', color: '#fff', backgroundColor: '#0284c7', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' },
    btnLogout: { marginTop: 'auto', padding: '10px 12px', borderRadius: '6px', color: '#fca5a5', cursor: 'pointer', textAlign: 'center', border: '1px dashed #f87171' },
    conteudoPrincipal: { flex: 1, padding: '30px', overflowY: 'auto' },
    splitLayout: { display: 'flex', gap: '20px', alignItems: 'flex-start' },
    colunaEsquerda: { backgroundColor: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #cbd5e1' },
    colunaEsquerdaSemForm: { flex: 1, backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #cbd5e1' },
    colunaDireita: { width: '320px', backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #cbd5e1' },
    formularioPainel: { display: 'flex', flexDirection: 'column', gap: '12px' },
    entradaForm: { padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', width: '100%', boxSizing: 'border-box', backgroundColor: '#fff' },
    btnSucessoForm: { padding: '12px', borderRadius: '6px', border: 'none', backgroundColor: '#16a34a', color: '#fff', fontWeight: 'bold', cursor: 'pointer' },
    btnLink: { background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', fontWeight: '600', marginRight: '10px', padding: 0 },
    btnLinkErro: { background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: '600', padding: 0 },
    tabela: { width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff' },
    tabelaHeader: { backgroundColor: '#f1f5f9' },
    th: { textAlign: 'left', padding: '10px', color: '#475569', borderBottom: '2px solid #cbd5e1', fontSize: '13px' },
    td: { padding: '10px', color: '#334155', fontSize: '13px' }
};                