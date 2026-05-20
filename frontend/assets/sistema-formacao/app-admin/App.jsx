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

    // Estados adicionais para suportar as melhorias implantadas
    const [locaisDisponiveis, setLocaisDisponiveis] = useState([]);
    const [publicosDisponiveis, setPublicosDisponiveis] = useState([]);
    const [totalFrequencias, setTotalFrequencias] = useState(0);
    const [mapaCarregado, setMapaCarregado] = useState(false);

    useEffect(() => {
        if (token) {
            carregarDados();
            if (view === 'eventos') {
                carregarAuxiliaresEventos();
            }
            if (view === 'locais') {
                inicializarMapaQueimados();
            }
        }
    }, [view, token]);

    const apiFetch = async (endpoint, options = {}) => {
        const headers = {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        };
        const response = await fetch(`http://localhost:3009${endpoint}`, { ...options, headers });
        if (response.status === 401 || response.status === 403) {
            lidarComLogout();
            throw new Error('Sessão expirada. Faça login novamente.');
        }
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Erro na requisição.');
        }
        return response.json();
    };

    const carregarDados = async () => {
        try {
            setErro('');
            if (view === 'eventos') {
                const dados = await apiFetch('/api/v2/eventos');
                setLista(dados);
            } else if (view === 'professores') {
                const dados = await apiFetch('/api/v2/participantes');
                setLista(dados);
            } else if (view === 'usuarios') {
                const dados = await apiFetch('/api/v2/usuarios');
                setLista(dados);
            } else if (view === 'locais') {
                const dados = await apiFetch('/api/v2/locais');
                setLista(dados);
            } else if (view === 'publico-alvo') {
                const dados = await apiFetch('/api/v2/publico-alvo');
                setLista(dados);
            } else if (view === 'relatorios' && dataInicio && dataFim) {
                const dados = await apiFetch(`/api/v2/relatorios/${tipoRelatorio}?data_inicio=${dataInicio}&data_fim=${dataFim}`);
                setLista(dados);
            } else if (view === 'participacao' && dataInicio && dataFim) {
                const dados = await apiFetch(`/api/v2/relatorios/log-frequencia?data_inicio=${dataInicio}&data_fim=${dataFim}`);
                setLista(dados);
                setTotalFrequencias(dados.length);
            } else if (view === 'auditoria' && dataInicio && dataFim) {
                const dados = await apiFetch(`/api/v2/relatorios/log-fraudes?data_inicio=${dataInicio}&data_fim=${dataFim}`);
                setLista(dados);
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
        } catch (err) {
            console.error("Erro ao carregar listas auxiliares:", err);
        }
    };

    const inicializarMapaQueimados = () => {
        // Aguarda renderização do elemento e injeta o Leaflet caso não exista
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
        if (window.mapaInstancia) {
            window.mapaInstancia.remove();
        }
        // Centro geográfico de Queimados - RJ
        const mapa = L.map('mapa-cadastro-local').setView([-22.7144, -43.5539], 13);
        window.mapaInstancia = mapa;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(mapa);

        let marcador;
        mapa.on('click', (e) => {
            if (marcador) mapa.removeLayer(marcador);
            marcador = L.marker([e.latlng.lat, e.latlng.lng]).addTo(mapa);
            setForm(prev => ({
                ...prev,
                latitude: e.latlng.lat.toFixed(6),
                longitude: e.latlng.lng.toFixed(6)
            }));
        });
        setMapaCarregado(true);
    };

    // Monitoramento inteligente de mudanças nas horas do evento para auto-calcular a carga horária
    const lidarComMudancaHora = (campo, valor) => {
        setForm(prev => {
            const novoForm = { ...prev, [campo]: valor };
            if (novoForm.hora_inicio && novoForm.hora_fim) {
                const [hIni, mIni] = novoForm.hora_inicio.split(':').map(Number);
                const [hFim, mFim] = novoForm.hora_fim.split(':').map(Number);
                const minutosIniciais = hIni * 60 + mIni;
                const minutosFinais = hFim * 60 + mFim;
                const diferencaMinutos = minutosFinais - minutosIniciais;
                if (diferencaMinutos > 0) {
                    novoForm.carga_horaria = Math.ceil(diferencaMinutos / 60);
                } else {
                    novoForm.carga_horaria = '';
                }
            }
            return novoForm;
        });
    };

    const lidarComLogin = async (e) => {
        if (e) e.preventDefault();
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
            alert('Senha alterada com sucesso! Faça login novamente.');
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
        setSelecionado(null);
        setForm({});
        setIsEditando(false);
        setMapaCarregado(false);
        if (window.mapaInstancia) window.mapaInstancia.remove();
    };

    const lidarComSubmissaoForm = async (e) => {
        e.preventDefault();
        try {
            setErro('');
            let url = '';
            if (view === 'eventos') url = '/api/v2/eventos';
            else if (view === 'professores') url = '/api/v2/participantes';
            else if (view === 'usuarios') url = '/api/v2/usuarios';
            else if (view === 'locais') url = '/api/v2/locais';
            else if (view === 'publico-alvo') url = '/api/v2/publico-alvo';

            const metodo = isEditando ? 'PUT' : 'POST';
            const endpoint = isEditando ? `${url}/${selecionado.id}` : url;

            await apiFetch(endpoint, {
                method: metodo,
                body: JSON.stringify(form)
            });

            alert(isEditando ? 'Registro atualizado com sucesso!' : 'Registro salvo com sucesso!');
            setForm({});
            setIsEditando(false);
            setSelecionado(null);
            carregarDados();
        } catch (err) {
            setErro(err.message);
        }
    };

    const iniciarEdicao = (item) => {
        setSelecionado(item);
        setIsEditando(true);
        if (view === 'eventos') {
            setForm({
                titulo: item.titulo,
                data_evento: item.data_evento ? item.data_evento.substring(0, 10) : '',
                carga_horaria: item.carga_horaria,
                local_id: item.local_id,
                publico_alvo_id: item.publico_alvo_id,
                hora_inicio: item.hora_inicio || '',
                hora_fim: item.hora_fim || ''
            });
        } else if (view === 'professores') {
            setForm({ nome_completo: item.nome_completo, matricula: item.matricula, ativo: item.ativo });
        } else if (view === 'usuarios') {
            setForm({ nome: item.nome, email: item.email, usuario: item.usuario, ativo: item.ativo });
        } else if (view === 'locais') {
            setForm({ nome: item.nome, endereco: item.endereco, latitude: item.latitude, longitude: item.longitude });
        } else if (view === 'publico-alvo') {
            setForm({ nome: item.nome });
        }
    };

    const deletarRegistro = async (id) => {
        if (!confirm('Deseja realmente remover este registro?')) return;
        try {
            let url = '';
            if (view === 'eventos') url = `/api/v2/eventos/${id}`;
            else if (view === 'professores') url = `/api/v2/participantes/${id}`;
            else if (view === 'usuarios') url = `/api/v2/usuarios/${id}`;
            else if (view === 'locais') url = `/api/v2/locais/${id}`;
            else if (view === 'publico-alvo') url = `/api/v2/publico-alvo/${id}`;

            await apiFetch(url, { method: 'DELETE' });
            alert('Registro removido com sucesso!');
            carregarDados();
        } catch (err) {
            setErro(err.message);
        }
    };

    const exportarPDF = () => {
        alert('Gerando PDF de exportação dos dados...');
    };

    // --- RENDERIZAÇÃO DA TELA DE AUTENTICAÇÃO ---
    if (!token) {
        if (user && user.deve_alterar_senha) {
            return (
                <div style={estilos.telaLogin}>
                    <div style={estilos.caixaLogin}>
                        <h2 style={estilos.tituloLogin}>Nova Senha Obrigatória</h2>
                        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20, textAlign: 'center' }}>
                            Por medidas de segurança corporativa, altere sua senha inicial.
                        </p>
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
                    <div style={estilos.logoInstitucional}>QUEIMADOS EDUCAÇÃO</div>
                    <h2 style={estilos.tituloLogin}>Painel Operacional Administrativo</h2>
                    {erro && <div style={estilos.erroBox}>{erro}</div>}
                    <form onSubmit={lidarComLogin} style={estilos.formulario}>
                        <div style={estilos.campoGrupo}>
                            <label style={estilos.rotulo}>Usuário Administrativo</label>
                            <input type="text" style={estilos.entrada} placeholder="Ex: admin_semed" value={usuarioInput} onChange={e => setUsuarioInput(e.target.value)} required />
                        </div>
                        <div style={estilos.campoGrupo}>
                            <label style={estilos.rotulo}>Senha de Acesso</label>
                            <input type="password" style={estilos.entrada} placeholder="••••••••" value={senhaInput} onChange={e => setSenhaInput(e.target.value)} required />
                        </div>
                        <button type="submit" style={estilos.btnPrimario}>ENTRAR NO SISTEMA</button>
                    </form>
                </div>
            </div>
        );
    }

    // --- RENDERIZAÇÃO DO PAINEL PRINCIPAL COM MENU LATERAL EXPANDIDO ---
    return (
        <div style={estilos.layoutPrincipal}>
            
            {/* MENU LATERAL EXPANDIDO (Itens 4, 5, 6 e 7 adicionados) */}
            <div style={estilos.barraLateral}>
                <div style={estilos.sidebarLogo}>SEMED QUEIMADOS</div>
                <div style={estilos.usuarioStatus}>Olá, {user?.nome || 'Administrador'}</div>
                
                <div style={view === 'eventos' ? estilos.menuItemAtivo : estilos.menuItem} onClick={() => { setView('eventos'); setForm({}); setIsEditando(false); }}>📅 Gestão de Eventos</div>
                <div style={view === 'professores' ? estilos.menuItemAtivo : estilos.menuItem} onClick={() => { setView('professores'); setForm({}); setIsEditando(false); }}>👨‍🏫 Professores</div>
                <div style={view === 'locais' ? estilos.menuItemAtivo : estilos.menuItem} onClick={() => { setView('locais'); setForm({}); setIsEditando(false); setMapaCarregado(false); }}>📍 Locais</div>
                <div style={view === 'publico-alvo' ? estilos.menuItemAtivo : estilos.menuItem} onClick={() => { setView('publico-alvo'); setForm({}); setIsEditando(false); }}>👥 Público-Alvo</div>
                <div style={view === 'participacao' ? AppEstilosAdicionais.menuItemAtivo(view === 'participacao') : estilos.menuItem} onClick={() => { setView('participacao'); setLista([]); }}>📊 Participação</div>
                <div style={view === 'auditoria' ? AppEstilosAdicionais.menuItemAtivo(view === 'auditoria') : estilos.menuItem} onClick={() => { setView('auditoria'); setLista([]); }}>🛡️ Auditoria</div>
                <div style={view === 'usuarios' ? estilos.menuItemAtivo : estilos.menuItem} onClick={() => { setView('usuarios'); setForm({}); setIsEditando(false); }}>👥 Usuários Administrativos</div>
                <div style={view === 'relatorios' ? estilos.menuItemAtivo : estilos.menuItem} onClick={() => { setView('relatorios'); setLista([]); }}>📈 Relatórios Finais</div>
                
                <div style={estilos.btnLogout} onClick={lidarComLogout}>🚪 Sair da Sessão</div>
            </div>

            <div style={estilos.conteudoPrincipal}>
                <div style={estilos.topoPainel}>
                    <h1 style={estilos.tituloPagina}>
                        {view === 'eventos' && 'Módulo Dinâmico de Eventos'}
                        {view === 'professores' && 'Cadastro Unificado de Professores'}
                        {view === 'locais' && 'Gerenciamento de Locais (Geofencing)'}
                        {view === 'publico-alvo' && 'Definição de Público-Alvo'}
                        {view === 'participacao' && 'Frequência e Comparecimento Geral'}
                        {view === 'auditoria' && 'Painel de Auditoria e Prevenção de Fraudes'}
                        {view === 'usuarios' && 'Controle de Credenciais Administrativas'}
                        {view === 'relatorios' && 'Inteligência e Extração Estatística'}
                    </h1>
                </div>

                {erro && <div style={estilos.erroBox}>{erro}</div>}

                {/* VISÃO: GESTÃO DE EVENTOS CORRIGIDA (Itens 1, 2 e 3) */}
                {view === 'eventos' && (
                    <div style={estilos.splitLayout}>
                        <div style={estilos.colunaEsquerda}>
                            <div style={estilos.card}>
                                <h3 style={estilos.cardTitulo}>Lista de Eventos Registrados</h3>
                                <table style={estilos.tabela}>
                                    <thead>
                                        <tr style={estilos.tabelaHeader}>
                                            <th style={estilos.th}>Título</th>
                                            <th style={estilos.th}>Data</th>
                                            <th style={estilos.th}>Horário</th>
                                            <th style={estilos.th}>Carga H.</th>
                                            <th style={estilos.th}>Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lista.map(item => (
                                            <tr key={item.id} style={estilos.tabelaLinha}>
                                                <td style={estilos.td}>{item.titulo}</td>
                                                <td style={estilos.td}>{item.data_evento ? new Date(item.data_evento).toLocaleDateString('pt-BR') : '-'}</td>
                                                <td style={estilos.td}>{item.hora_inicio || '--:--'} às {item.hora_fim || '--:--'}</td>
                                                <td style={estilos.td}>{item.carga_horaria}h</td>
                                                <td style={estilos.td}>
                                                    <button style={estilos.btnLink} onClick={() => iniciarEdicao(item)}>Editar</button>
                                                    <button style={estilos.btnLinkErro} onClick={() => deletarRegistro(item.id)}>Excluir</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div style={estilos.colunaDireita}>
                            <div style={estilos.card}>
                                <h3 style={estilos.cardTitulo}>{isEditando ? 'Modificar Evento' : 'Criar Novo Evento'}</h3>
                                <form onSubmit={lidarComSubmissaoForm} style={estilos.formulario}>
                                    <div style={estilos.campoGrupo}>
                                        <label style={estilos.rotulo}>Título do Evento</label>
                                        <input type="text" style={estilos.entrada} value={form.titulo || ''} onChange={e => setForm({...form, titulo: e.target.value})} required />
                                    </div>
                                    <div style={estilos.campoGrupo}>
                                        <label style={estilos.rotulo}>Data Realização</label>
                                        <input type="date" style={estilos.entrada} value={form.data_evento || ''} onChange={e => setForm({...form, data_evento: e.target.value})} required />
                                    </div>
                                    
                                    {/* Item 1: Entrada de Horários */}
                                    <div style={{ display: 'flex', gap: 10 }}>
                                        <div style={{ ...estilos.campoGrupo, flex: 1 }}>
                                            <label style={estilos.rotulo}>Hora de Início</label>
                                            <input type="time" style={estilos.entrada} value={form.hora_inicio || ''} onChange={e => lidarComMudancaHora('hora_inicio', e.target.value)} required />
                                        </div>
                                        <div style={{ ...estilos.campoGrupo, flex: 1 }}>
                                            <label style={estilos.rotulo}>Término Previsto</label>
                                            <input type="time" style={estilos.entrada} value={form.hora_fim || ''} onChange={e => lidarComMudancaHora('hora_fim', e.target.value)} required />
                                        </div>
                                    </div>

                                    <div style={estilos.campoGrupo}>
                                        <label style={estilos.rotulo}>Carga Horária Oferecida (Calculada Automático)</label>
                                        <input type="number" style={estilos.entrada} readOnly placeholder="Preenchimento automático" value={form.carga_horaria || ''} />
                                    </div>

                                    {/* Item 2: Select Dinâmico de Locais */}
                                    <div style={estilos.campoGrupo}>
                                        <label style={estilos.rotulo}>Local do Evento (Tabela 'locais')</label>
                                        <select style={estilos.entrada} value={form.local_id || ''} onChange={e => setForm({...form, local_id: e.target.value})} required>
                                            <option value="">-- Selecione um Local Cadastrado --</option>
                                            {locaisDisponiveis.map(l => (
                                                <option key={l.id} value={l.id}>{l.nome}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Item 3: Select Dinâmico de Público-Alvo */}
                                    <div style={estilos.campoGrupo}>
                                        <label style={estilos.rotulo}>Público Alvo Alocado</label>
                                        <select style={estilos.entrada} value={form.publico_alvo_id || ''} onChange={e => setForm({...form, publico_alvo_id: e.target.value})} required>
                                            <option value="">-- Selecione o Público Requisitado --</option>
                                            {publicosDisponiveis.map(p => (
                                                <option key={p.id} value={p.id}>{p.nome}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <button type="submit" style={estilos.btnPrimario}>{isEditando ? 'SALVAR ALTERAÇÕES' : 'CONFIRMAR E GERAR EVENTO'}</button>
                                    {isEditando && <button type="button" style={estilos.btnGeral} onClick={() => { setForm({}); setIsEditando(false); }}>Cancelar</button>}
                                </form>
                            </div>
                        </div>
                    </div>
                )}

                {/* VISÃO: GESTÃO DE PROFESSORES */}
                {view === 'professores' && (
                    <div style={estilos.splitLayout}>
                        <div style={estilos.colunaEsquerda}>
                            <div style={estilos.card}>
                                <h3 style={estilos.cardTitulo}>Professores na Base de Dados</h3>
                                <table style={estilos.tabela}>
                                    <thead>
                                        <tr style={estilos.tabelaHeader}>
                                            <th style={estilos.th}>Nome Completo</th>
                                            <th style={estilos.th}>Matrícula</th>
                                            <th style={estilos.th}>Status</th>
                                            <th style={estilos.th}>Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lista.map(item => (
                                            <tr key={item.id} style={estilos.tabelaLinha}>
                                                <td style={estilos.td}>{item.nome_completo}</td>
                                                <td style={estilos.td}>{item.matricula}</td>
                                                <td style={estilos.td}>{item.ativo ? '✅ Ativo' : '❌ Inativo'}</td>
                                                <td style={estilos.td}>
                                                    <button style={estilos.btnLink} onClick={() => iniciarEdicao(item)}>Editar</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div style={estilos.colunaDireita}>
                            <div style={estilos.card}>
                                <h3 style={estilos.cardTitulo}>{isEditando ? 'Editar Professor' : 'Registrar Novo Professor'}</h3>
                                <form onSubmit={lidarComSubmissaoForm} style={estilos.formulario}>
                                    <div style={estilos.campoGrupo}>
                                        <label style={estilos.rotulo}>Nome do Profissional</label>
                                        <input type="text" style={estilos.entrada} value={form.nome_completo || ''} onChange={e => setForm({...form, nome_completo: e.target.value})} required />
                                    </div>
                                    <div style={estilos.campoGrupo}>
                                        <label style={estilos.rotulo}>Número de Matrícula</label>
                                        <input type="text" style={estilos.entrada} value={form.matricula || ''} onChange={e => setForm({...form, matricula: e.target.value})} required disabled={isEditando} />
                                    </div>
                                    <div style={estilos.campoGrupo}>
                                        <label style={estilos.rotulo}>Status Cadastral</label>
                                        <select style={estilos.entrada} value={form.ativo === undefined ? 'true' : String(form.ativo)} onChange={e => setForm({...form, ativo: e.target.value === 'true'})}>
                                            <option value="true">Permitido (Ativo)</option>
                                            <option value="false">Bloqueado (Inativo)</option>
                                        </select>
                                    </div>
                                    <button type="submit" style={estilos.btnPrimario}>SALVAR DOCENTE</button>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

                {/* Item 4: TELA COMPLETA DE LOCAIS COM MAPA INTEGRADO */}
                {view === 'locais' && (
                    <div style={estilos.splitLayout}>
                        <div style={estilos.colunaEsquerda}>
                            <div style={estilos.card}>
                                <h3 style={estilos.cardTitulo}>Prédios e Espaços Cadastrados</h3>
                                <table style={estilos.tabela}>
                                    <thead>
                                        <tr style={estilos.tabelaHeader}>
                                            <th style={estilos.th}>Nome do Espaço</th>
                                            <th style={estilos.th}>Endereço</th>
                                            <th style={estilos.th}>Coordenadas (Lat/Lng)</th>
                                            <th style={estilos.th}>Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lista.map(item => (
                                            <tr key={item.id} style={estilos.tabelaLinha}>
                                                <td style={estilos.td}>{item.nome}</td>
                                                <td style={estilos.td}>{item.endereco}</td>
                                                <td style={estilos.td}>{item.latitude}, {item.longitude}</td>
                                                <td style={estilos.td}>
                                                    <button style={estilos.btnLink} onClick={() => iniciarEdicao(item)}>Editar</button>
                                                    <button style={estilos.btnLinkErro} onClick={() => deletarRegistro(item.id)}>Remover</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div style={estilos.colunaDireita}>
                            <div style={estilos.card}>
                                <h3 style={estilos.cardTitulo}>{isEditando ? 'Modificar Endereço/Geofence' : 'Cadastrar Espaço Público'}</h3>
                                <form onSubmit={lidarComSubmissaoForm} style={estilos.formulario}>
                                    <div style={estilos.campoGrupo}>
                                        <label style={estilos.rotulo}>Nome da Escola ou Núcleo</label>
                                        <input type="text" style={estilos.entrada} value={form.nome || ''} onChange={e => setForm({...form, nome: e.target.value})} required />
                                    </div>
                                    <div style={estilos.campoGrupo}>
                                        <label style={estilos.rotulo}>Endereço Completo</label>
                                        <input type="text" style={estilos.entrada} value={form.endereco || ''} onChange={e => setForm({...form, endereco: e.target.value})} required />
                                    </div>
                                    <div style={{ display: 'flex', gap: 10 }}>
                                        <div style={{ ...estilos.campoGrupo, flex: 1 }}>
                                            <label style={estilos.rotulo}>Latitude</label>
                                            <input type="text" style={estilos.entrada} readOnly value={form.latitude || ''} required placeholder="Clique no mapa" />
                                        </div>
                                        <div style={{ ...estilos.campoGrupo, flex: 1 }}>
                                            <label style={estilos.rotulo}>Longitude</label>
                                            <input type="text" style={estilos.entrada} readOnly value={form.longitude || ''} required placeholder="Clique no mapa" />
                                        </div>
                                    </div>
                                    <label style={estilos.rotulo}>Demarque no Mapa de Queimados:</label>
                                    <div id="mapa-cadastro-local" style={{ height: 220, borderRadius: 8, border: '1px solid #cbd5e1', backgroundColor: '#f8fafc' }}></div>
                                    <button type="submit" style={estilos.btnPrimario} >SALVAR LOCALIZAÇÃO GEOGRÁFICA</button>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

                {/* Item 5: TELA DE PÚBLICO-ALVO */}
                {view === 'publico-alvo' && (
                    <div style={estilos.splitLayout}>
                        <div style={estilos.colunaEsquerda}>
                            <div style={estilos.card}>
                                <h3 style={estilos.cardTitulo}>Segmentos de Públicos Ativos</h3>
                                <table style={estilos.tabela}>
                                    <thead>
                                        <tr style={estilos.tabelaHeader}>
                                            <th style={estilos.th}>Código</th>
                                            <th style={estilos.th}>Descrição do Público Alvo</th>
                                            <th style={estilos.th}>Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lista.map(item => (
                                            <tr key={item.id} style={estilos.tabelaLinha}>
                                                <td style={estilos.td}>#{item.id}</td>
                                                <td style={estilos.td}>{item.nome}</td>
                                                <td style={estilos.td}>
                                                    <button style={estilos.btnLinkErro} onClick={() => deletarRegistro(item.id)}>Excluir</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div style={estilos.colunaDireita}>
                            <div style={estilos.card}>
                                <h3 style={estilos.cardTitulo}>Definir Novo Segmento</h3>
                                <form onSubmit={lidarComSubmissaoForm} style={estilos.formulario}>
                                    <div style={estilos.campoGrupo}>
                                        <label style={estilos.rotulo}>Nome Técnico do Público</label>
                                        <input type="text" style={estilos.entrada} placeholder="Ex: Gestores Escolares ou Educação Infantil" value={form.nome || ''} onChange={e => setForm({...form, nome: e.target.value})} required />
                                    </div>
                                    <button type="submit" style={estilos.btnPrimario}>SALVAR CATEGORIA</button>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

                {/* Item 6: TELA DE PARTICIPAÇÃO COMPLETA */}
                {view === 'participacao' && (
                    <div style={estilos.card}>
                        <h3 style={estilos.cardTitulo}>Filtro de Log de Frequência Continuada</h3>
                        <div style={{ display: 'flex', gap: 15, alignItems: 'flex-end', marginBottom: 20 }}>
                            <div style={estilos.campoGrupo}>
                                <label style={estilos.rotulo}>Data Inicial</label>
                                <input type="date" style={estilos.entrada} value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
                            </div>
                            <div style={estilos.campoGrupo}>
                                <label style={estilos.rotulo}>Data Final</label>
                                <input type="date" style={estilos.entrada} value={dataFim} onChange={e => setDataFim(e.target.value)} />
                            </div>
                            <button style={estilos.btnPrimario} onClick={carregarDados}>FILTRAR REGISTROS</button>
                        </div>
                        
                        <div style={AppEstilosAdicionais.totalizadorBadge}>
                            Total de Comparecimentos Computados no Período: {totalFrequencias}
                        </div>

                        <div style={{ overflowY: 'auto', maxHeight: '420px', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                            <table style={estilos.tabela}>
                                <thead>
                                    <tr style={estilos.tabelaHeader}>
                                        <th style={estilos.th}>Participante</th>
                                        <th style={estilos.th}>Matrícula</th>
                                        <th style={estilos.th}>Evento Vinculado</th>
                                        <th style={estilos.th}>Registro de Entrada</th>
                                        <th style={estilos.th}>Registro de Saída</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lista.length === 0 ? (
                                        <tr><td colSpan="5" style={{ ...estilos.td, textAlign: 'center', color: '#94a3b8' }}>Nenhum dado retornado para o período selecionado.</td></tr>
                                    ) : (
                                        lista.map((f, i) => (
                                            <tr key={i} style={estilos.tabelaLinha}>
                                                <td style={estilos.td}>{f.participante_name || 'Nome não associado'}</td>
                                                <td style={estilos.td}>{f.matricula || 'N/A'}</td>
                                                <td style={estilos.td}>{f.evento_titulo}</td>
                                                <td style={estilos.td}>{f.data_entrada ? new Date(f.data_entrada).toLocaleString('pt-BR') : '-'}</td>
                                                <td style={estilos.td}>{f.data_saida ? new Date(f.data_saida).toLocaleString('pt-BR') : <span style={{color: '#eab308'}}>Em andamento</span>}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Item 7: TELA DE AUDITORIA COMPLETA */}
                {view === 'auditoria' && (
                    <div style={estilos.card}>
                        <h3 style={estilos.cardTitulo}>Módulo Supervisor de Fraudes e Bloqueios</h3>
                        <div style={{ display: 'flex', gap: 15, alignItems: 'flex-end', marginBottom: 20 }}>
                            <div style={estilos.campoGrupo}>
                                <label style={estilos.rotulo}>Data Inicial</label>
                                <input type="date" style={estilos.entrada} value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
                            </div>
                            <div style={estilos.campoGrupo}>
                                <label style={estilos.rotulo}>Data Final</label>
                                <input type="date" style={estilos.entrada} value={dataFim} onChange={e => setDataFim(e.target.value)} />
                            </div>
                            <button style={estilos.btnPrimario} onClick={carregarDados}>BUSCAR INFRAÇÕES</button>
                        </div>

                        <div style={{ overflowY: 'auto', maxHeight: '420px', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                            <table style={estilos.tabela}>
                                <thead>
                                    <tr style={estilos.tabelaHeader}>
                                        <th style={estilos.th}>Matrícula Solicitante</th>
                                        <th style={estilos.th}>Evento Destino</th>
                                        <th style={estilos.th}>Data/Hora Tentativa</th>
                                        <th style={estilos.th}>Motivo do Bloqueio ou Recusa</th>
                                        <th style={estilos.th}>Distância Detectada</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lista.length === 0 ? (
                                        <tr><td colSpan="5" style={{ ...estilos.td, textAlign: 'center', color: '#94a3b8' }}>Nenhuma atividade suspeita registrada no intervalo.</td></tr>
                                    ) : (
                                        lista.map((lf, i) => (
                                            <tr key={i} style={estilos.tabelaLinha}>
                                                <td style={estilos.td}>{lf.matricula}</td>
                                                <td style={estilos.td}>{lf.evento_titulo}</td>
                                                <td style={estilos.td}>{lf.data_tentativa ? new Date(lf.data_tentativa).toLocaleString('pt-BR') : '-'}</td>
                                                <td style={{ ...estilos.td, color: '#ef4444', fontWeight: 'bold' }}>{lf.motivo}</td>
                                                <td style={estilos.td}>{lf.distancia_calculada ? `${Math.round(lf.distancia_calculada)} metros` : 'N/A'}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* VISÃO: USUÁRIOS ADMINISTRATIVOS */}
                {view === 'usuarios' && (
                    <div style={estilos.splitLayout}>
                        <div style={estilos.colunaEsquerda}>
                            <div style={estilos.card}>
                                <h3 style={estilos.cardTitulo}>Operadores com Permissão no Sistema</h3>
                                <table style={estilos.tabela}>
                                    <thead>
                                        <tr style={estilos.tabelaHeader}>
                                            <th style={estilos.th}>Nome</th>
                                            <th style={estilos.th}>Email</th>
                                            <th style={estilos.th}>Login</th>
                                            <th style={estilos.th}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lista.map(item => (
                                            <tr key={item.id} style={estilos.tabelaLinha}>
                                                <td style={estilos.td}>{item.nome}</td>
                                                <td style={estilos.td}>{item.email}</td>
                                                <td style={estilos.td}>{item.usuario}</td>
                                                <td style={estilos.td}>{item.ativo ? '🟢 Ativo' : '🔴 Bloqueado'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div style={estilos.colunaDireita}>
                            <div style={estilos.card}>
                                <h3 style={estilos.cardTitulo}>Novo Gestor Admin</h3>
                                <form onSubmit={lidarComSubmissaoForm} style={estilos.formulario}>
                                    <div style={estilos.campoGrupo}>
                                        <label style={estilos.rotulo}>Nome do Operador</label>
                                        <input type="text" style={estilos.entrada} value={form.nome || ''} onChange={e => setForm({...form, nome: e.target.value})} required />
                                    </div>
                                    <div style={estilos.campoGrupo}>
                                        <label style={estilos.rotulo}>Email Corporativo</label>
                                        <input type="email" style={estilos.entrada} value={form.email || ''} onChange={e => setForm({...form, email: e.target.value})} required />
                                    </div>
                                    <div style={estilos.campoGrupo}>
                                        <label style={estilos.rotulo}>Usuário de Acesso (Login)</label>
                                        <input type="text" style={estilos.entrada} value={form.usuario || ''} onChange={e => setForm({...form, usuario: e.target.value})} required />
                                    </div>
                                    <div style={estilos.campoGrupo}>
                                        <label style={estilos.rotulo}>Senha Provisória</label>
                                        <input type="password" style={estilos.entrada} placeholder="Alteração obrigatória no 1º acesso" value={form.senha || ''} onChange={e => setForm({...form, senha: e.target.value})} required={!isEditando} />
                                    </div>
                                    <button type="submit" style={estilos.btnPrimario}>CRIAR CREDENCIAL</button>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

                {/* VISÃO: RELATÓRIOS FINAIS */}
                {view === 'relatorios' && (
                    <div style={estilos.card}>
                        <h3 style={estilos.cardTitulo}>Relatórios Oficiais e Consolidados</h3>
                        <div style={{ display: 'flex', gap: 15, alignItems: 'flex-end', marginBottom: 25 }}>
                            <div style={estilos.campoGrupo}>
                                <label style={estilos.rotulo}>Modelo Informativo</label>
                                <select style={estilos.entrada} value={tipoRelatorio} onChange={e => setTipoRelatorio(e.target.value)}>
                                    <option value="prestacao-contas">Prestação de Contas Semed (Carga Horária Unificada)</option>
                                    <option value="log-frequencia">Lista Espelho de Chamadas (Presenças Absolutas)</option>
                                </select>
                            </div>
                            <div style={estilos.campoGrupo}>
                                <label style={estilos.rotulo}>Data de Início</label>
                                <input type="date" style={estilos.entrada} value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
                            </div>
                            <div style={estilos.campoGrupo}>
                                <label style={estilos.rotulo}>Data Limite</label>
                                <input type="date" style={estilos.entrada} value={dataFim} onChange={e => setDataFim(e.target.value)} />
                            </div>
                            <button style={estilos.btnPrimario} onClick={carregarDados}>PROCESSAR RELATÓRIO</button>
                            {lista.length > 0 && <button style={estilos.btnPdf} onClick={exportarPDF}>📄 EXPORTAR PDF</button>}
                        </div>

                        <table style={estilos.tabela}>
                            <thead>
                                <tr style={estilos.tabelaHeader}>
                                    {tipoRelatorio === 'prestacao-contas' ? (
                                        <>
                                            <th style={estilos.th}>Nome do Servidor</th>
                                            <th style={estilos.th}>Matrícula</th>
                                            <th style={estilos.th}>Total Horas Acumuladas</th>
                                            <th style={estilos.th}>Eventos Assistidos</th>
                                        </>
                                    ) : (
                                        <>
                                            <th style={estilos.th}>Participante</th>
                                            <th style={estilos.th}>Evento</th>
                                            <th style={estilos.th}>Data/Hora Presença</th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {lista.length === 0 ? (
                                    <tr><td colSpan="4" style={{ ...estilos.td, textAlign: 'center', color: '#94a3b8' }}>Defina o período para a compilação cruzada dos dados.</td></tr>
                                ) : (
                                    lista.map((item, index) => (
                                        <tr key={index} style={estilos.tabelaLinha}>
                                            {tipoRelatorio === 'prestacao-contas' ? (
                                                <>
                                                    <td style={estilos.td}>{item.nome_completo}</td>
                                                    <td style={estilos.td}>{item.matricula}</td>
                                                    <td style={{ ...estilos.td, fontWeight: 'bold', color: '#10b981' }}>{item.total_horas} horas</td>
                                                    <td style={estilos.td}>{item.total_eventos} formações</td>
                                                </>
                                            ) : (
                                                <>
                                                    <td style={estilos.td}>{item.participante_name}</td>
                                                    <td style={estilos.td}>{item.evento_titulo}</td>
                                                    <td style={estilos.td}>{item.data_entrada ? new Date(item.data_entrada).toLocaleString('pt-BR') : '-'}</td>
                                                </>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

            </div>
        </div>
    );
}

// --- ESTILOS COMPATÍVEIS COM O PADRÃO ORIGINAL DO PROJETO ---
const estilos = {
    telaLogin: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f8fafc' },
    caixaLogin: { backgroundColor: '#fff', padding: 40, borderRadius: 16, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)', width: '100%', maxWidth: 420, border: '1px solid #e2e8f0' },
    logoInstitucional: { fontSize: 22, fontWeight: '800', color: '#1e3a8a', textAlign: 'center', letterSpacing: '-0.5px', marginBottom: 8 },
    tituloLogin: { fontSize: 15, color: '#475569', textAlign: 'center', fontWeight: '500', marginBottom: 30 },
    formulario: { display: 'flex', flexDirection: 'column', gap: 16 },
    campoGrupo: { display: 'flex', flexDirection: 'column', gap: 6 },
    rotulo: { fontSize: 12, fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' },
    entrada: { padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: 14, color: '#1e293b', transition: 'border-color 0.2s' },
    btnPrimario: { backgroundColor: '#1e3a8a', color: '#fff', border: 'none', padding: '12px', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', fontSize: 14, textAlign: 'center' },
    btnSucesso: { backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '12px', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', fontSize: 14, textAlign: 'center' },
    btnGeral: { backgroundColor: '#94a3b8', color: '#fff', border: 'none', padding: '10px', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', fontSize: 13, textAlign: 'center' },
    erroBox: { backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', padding: 12, borderRadius: 8, fontSize: 13, fontWeight: '500', marginBottom: 15, textAlign: 'center' },
    layoutPrincipal: { display: 'flex', minHeight: '100vh', backgroundColor: '#f1f5f9' },
    barraLateral: { width: 280, backgroundColor: '#1e3a8a', padding: '25px 20px', display: 'flex', flexDirection: 'column', gap: 5, color: '#fff' },
    sidebarLogo: { fontSize: 20, fontWeight: '900', letterSpacing: '-0.5px', marginBottom: 5, color: '#fff', paddingLeft: 10 },
    usuarioStatus: { fontSize: 12, color: '#93c5fd', marginBottom: 25, paddingLeft: 10, fontWeight: '500' },
    menuItem: { padding: '12px 14px', borderRadius: 8, color: '#bfdbfe', cursor: 'pointer', fontWeight: '500', fontSize: 14, transition: 'all 0.2s' },
    menuItemAtivo: { padding: '12px 14px', borderRadius: 8, color: '#fff', backgroundColor: '#1d4ed8', cursor: 'pointer', fontWeight: 'bold', fontSize: 14 },
    btnLogout: { marginTop: 'auto', padding: '12px 14px', borderRadius: 8, color: '#fca5a5', cursor: 'pointer', fontWeight: '600', fontSize: 13, border: '1px dashed #f87171' },
    conteudoPrincipal: { flex: 1, padding: '40px 50px', overflowY: 'auto' },
    topoPainel: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 35, borderBottom: '1px solid #e2e8f0', paddingBottom: 20 },
    tituloPagina: { fontSize: 24, fontWeight: '800', color: '#0f172a', letterSpacing: '-0.5px' },
    card: { backgroundColor: '#fff', padding: 30, borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', marginBottom: 25 },
    cardTitulo: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 20 },
    btnLink: { background: 'none', border: 'none', color: '#1e40af', cursor: 'pointer', fontWeight: '600', fontSize: 13, marginRight: 12 },
    btnLinkErro: { background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: '600', fontSize: 13 },
    btnPdf: { backgroundColor: '#475569', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', fontSize: 13 },
    tabela: { width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: 8, overflow: 'hidden' },
    tabelaHeader: { backgroundColor: '#f1f5f9', borderBottom: '2px solid #e2e8f0' },
    th: { textAlign: 'left', padding: '12px 16px', color: '#64748b', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
    tabelaLinha: { borderBottom: '1px solid #edf2f7', cursor: 'pointer' },
    td: { padding: '14px 16px', color: '#334155', fontSize: 14 },
    splitLayout: { display: 'flex', gap: 30, height: '100%' },
    colunaEsquerda: { flex: 1.2, display: 'flex', flexDirection: 'column', gap: 15 },
    colunaDireita: { flex: 0.8, backgroundColor: '#fff', padding: 25, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }
};

// --- CLASSES AUXILIARES DE ESTILO DINÂMICO PARA AS NOVAS TELAS IMPLANTADAS ---
const AppEstilosAdicionais = {
    menuItemAtivo: (condicao) => condicao ? {
        padding: '12px 14px', borderRadius: 8, color: '#fff', backgroundColor: '#1d4ed8', cursor: 'pointer', fontWeight: 'bold', fontSize: 14
    } : estilos.menuItem,
    totalizadorBadge: {
        backgroundColor: '#eff6ff', color: '#1e40af', padding: '16px 20px', borderRadius: 8, fontSize: 16, fontWeight: '700', border: '1px solid #bfdbfe', marginBottom: 20, display: 'inline-block'
    }
};