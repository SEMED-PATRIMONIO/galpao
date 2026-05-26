import React, { useState, useEffect, useRef } from 'react';

export default function App() {
    const obterUsuarioSeguro = () => {
        try {
            const dadosSalvos = localStorage.getItem('admin_user');
            if (!dadosSalvos) return null;
            return JSON.parse(dadosSalvos);
        } catch (e) {
            localStorage.removeItem('admin_user'); localStorage.removeItem('admin_token'); return null;
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
    const [dadosEstatisticos, setDadosEstatisticos] = useState(null);

    const [locaisDisponiveis, setLocaisDisponiveis] = useState([]);
    const [publicosDisponiveis, setPublicosDisponiveis] = useState([]);
    const [setoresDisponiveis, setSetoresDisponiveis] = useState([]);
    const [areasDisponiveis, setAreasDisponiveis] = useState([]);
    const [modalNovoEvento, setModalNovoEvento] = useState(false);

    const [filtroArea, setFiltroArea] = useState('');
    const [filtroSetor, setFiltroSetor] = useState('');
    const [filtroPublico, setFiltroPublico] = useState('');    
    
    const [modalNovoLocal, setModalNovoLocal] = useState(false);
    const nomeLocalRef = useRef(null);

    useEffect(() => {
        if (token) {
            carregarDadosPainel();
            carregarAuxiliaresGlobais();
        }
    }, [view, token]);

    useEffect(() => {
        if (modalNovoLocal) inicializarMapaModal();
    }, [modalNovoLocal]);

    const apiFetch = async (endpoint, options = {}) => {
        const headers = {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        };
        const API_URL = 'https://formar.paiva.api.br';
        const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
        if (response.status === 401 || response.status === 403) { lidarComLogout(); throw new Error('Sessão expirada.'); }
        if (!response.ok) { const errorData = await response.json().catch(() => ({})); throw new Error(errorData.error || 'Erro.'); }
        return response.json();
    };

    const carregarAuxiliaresGlobais = async () => {
        try {
            const locais = await apiFetch('/api/v2/locais');
            const publicos = await apiFetch('/api/v2/publico-alvo');
            const setores = await apiFetch('/api/v2/setores');
            const areas = await apiFetch('/api/v2/areas');
            setLocaisDisponiveis(locais || []);
            setPublicosDisponiveis(publicos || []);
            setSetoresDisponiveis(setores || []);
            setAreasDisponiveis(areas || []);
        } catch (e) {}
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
            else if (view === 'setores') endpoint = '/api/v2/setores';
            else if (view === 'areas') endpoint = '/api/v2/areas';
            else if (view === 'usuarios') endpoint = '/api/v2/usuarios';

            if (endpoint) {
                const dados = await apiFetch(endpoint);
                setLista(dados); setTotaisSuperior(dados.length);
            }
        } catch (err) { setErro(err.message); }
    };

    const processarRelatorio = async () => {
        if (!dataInicio || !dataFim) { setErro('Selecione o período de abrangência (Data Inicial e Final).'); return; }
        try {
            setErro('');
            let url = `/api/v2/admin/relatorio-integrado?data_inicio=${dataInicio}&data_fim=${dataFim}`;
            if (filtroArea) url += `&area_id=${filtroArea}`;
            if (filtroSetor) url += `&setor_id=${filtroSetor}`;
            if (filtroPublico) url += `&publico_alvo_id=${filtroPublico}`;
            
            const dados = await apiFetch(url);
            setDadosEstatisticos(dados.totais); 
            setLista(dados.registros); 
            setTotaisSuperior(dados.registros.length);
        } catch (err) { setErro(err.message); }
    };

    const inicializarMapaModal = () => {
        setTimeout(() => {
            const container = document.getElementById('mapa-modal-vitrificado');
            if (!container) return;
            if (window.L) { renderizarMapaModal(window.L); } 
            else {
                const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(link);
                const script = document.createElement('script'); script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; script.onload = () => renderizarMapaModal(window.L); document.body.appendChild(script);
            }
        }, 200);
    };

    const renderizarMapaModal = (L) => {
        if (window.mapaModalInstancia) window.mapaModalInstancia.remove();
        const centroQueimados = [-22.7144, -43.5539];
        const mapa = L.map('mapa-modal-vitrificado').setView(centroQueimados, 14);
        window.mapaModalInstancia = mapa; L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapa);
        let marcador;

        if (isEditando && form.latitude && form.longitude) {
            const coordSalva = [parseFloat(form.latitude), parseFloat(form.longitude)];
            marcador = L.marker(coordSalva).addTo(mapa); mapa.setView(coordSalva, 16);
        }

        mapa.on('click', async (e) => {
            const { lat, lng } = e.latlng;
            if (marcador) mapa.removeLayer(marcador);
            marcador = L.marker([lat, lng]).addTo(mapa);
            let enderecoDetectado = "Carregando endereço...";
            setForm(prev => ({ ...prev, latitude: lat.toFixed(6), longitude: lng.toFixed(6), endereco: enderecoDetectado }));

            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
                const dadosGeo = await res.json();
                enderecoDetectado = dadosGeo && dadosGeo.display_name ? dadosGeo.display_name.split(', Brasil')[0] : `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
            } catch (err) { enderecoDetectado = `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`; }

            setForm(prev => ({ ...prev, endereco: enderecoDetectado }));
            if (nomeLocalRef.current) nomeLocalRef.current.focus();
        });
    };

    const lidarComMudancaHora = (campo, valor) => {
        setForm(prev => {
            const novoForm = { ...prev, [campo]: valor };
            if (novoForm.hora_inicio && novoForm.hora_fim) {
                const [hIni, mIni] = novoForm.hora_inicio.split(':').map(Number);
                const [hFim, mFim] = novoForm.hora_fim.split(':').map(Number);
                const dMin = (hFim * 60 + mFim) - (hIni * 60 + mIni);
                novoForm.carga_horaria = dMin > 0 ? (dMin / 60).toFixed(2) : '';
            }
            return novoForm;
        });
    };

    const lidarComLogin = async (e) => {
        e.preventDefault();
        try {
            setErro('');
            const data = await apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ usuario: usuarioInput, senha: senhaInput }) });
            if (data.deve_alterar_senha) { setUser({ usuario: usuarioInput, deve_alterar_senha: true }); return; }
            localStorage.setItem('admin_token', data.token); localStorage.setItem('admin_user', JSON.stringify(data.user));
            setToken(data.token); setUser(data.user); setView('eventos');
        } catch (err) { setErro(err.message); }
    };

    const lidarComAlteracaoSenha = async (e) => {
        e.preventDefault();
        if (novaSenha !== confirmarNovaSenha) { setErro('As senhas não coincidem.'); return; }
        try {
            setErro(''); await apiFetch('/api/auth/alterar-senha', { method: 'POST', body: JSON.stringify({ usuario: user.usuario, novaSenha }) });
            alert('Senha alterada!'); lidarComLogout();
        } catch (err) { setErro(err.message); }
    };

    const lidarComLogout = () => {
        localStorage.removeItem('admin_token'); localStorage.removeItem('admin_user');
        setToken(null); setUser(null); setView('eventos'); setLista([]); setForm({}); setIsEditando(false);
    };

    const lidarComSubmissaoForm = async (e) => {
        e.preventDefault();
        try {
            setErro('');
            
            // 1. Desvio para redefinição de senha própria
            if (view === 'usuarios' && isEditando && selecionado && selecionado.id === null) {
                if (!novaSenha) throw new Error("A senha não pode estar em branco.");
                await apiFetch('/api/v2/usuarios/alterar-propria-senha', { method: 'PUT', body: JSON.stringify({ novaSenha }) });
                alert('Sua senha foi redefinida no formato SHA-256 com sucesso!');
                fecharModalLocal();
                return;
            }

            // 2. CORREÇÃO CIRÚRGICA: Desvio isolado para cadastros simples (Público-alvo, Setores e Áreas)
            if (['publico-alvo', 'setores', 'areas'].includes(view)) {
                let urlSimples = `/api/v2/${view}`;
                await apiFetch(isEditando ? `${urlSimples}/${selecionado.id}` : urlSimples, { 
                    method: isEditando ? 'PUT' : 'POST', 
                    body: JSON.stringify({ nome: form.nome }) // Envia estritamente o nome esperado
                });
                fecharModalLocal();
                carregarDadosPainel();
                return;
            }

            // 3. Fluxo regular para as demais tabelas complexas do sistema
            const prefixoAdmin = view === 'frequencias' ? 'admin/' : '';
            await apiFetch(isEditando ? `/api/v2/${prefixoAdmin}${view}/${selecionado.id}` : `/api/v2/${prefixoAdmin}${view}`, { 
                method: isEditando ? 'PUT' : 'POST', 
                body: JSON.stringify(form) 
            });
            
            fecharModalLocal();
            carregarDadosPainel();
        } catch (err) { setErro(err.message); }
    };

    const fecharModalLocal = () => {
        setForm({}); setIsEditando(false); setSelecionado(null); setModalNovoLocal(false); setNovaSenha(''); setConfirmarNovaSenha('');
        if (window.mapaModalInstancia) { window.mapaModalInstancia.remove(); window.mapaModalInstancia = null; }
    };

    const iniciarEdicao = async (item) => {
        setSelecionado(item); setIsEditando(true);
        if (view === 'eventos') {
            const detalhe = await apiFetch(`/api/v2/admin/eventos-detalhes/${item.id}`);
            const sIds = [detalhe.setor_id_1, detalhe.setor_id_2, detalhe.setor_id_3].filter(Boolean);
            setForm({ titulo: detalhe.titulo, area_id: detalhe.area_id || '', data_evento: detalhe.data_evento.substring(0, 10), carga_horaria: detalhe.carga_horaria, local_id: detalhe.local_id, hora_inicio: detalhe.hora_inicio, hora_fim: detalhe.hora_fim, palestrante: detalhe.palestrante, setores_ids: sIds, publicos_alvo_ids: detalhe.publicos_alvo_ids || [] });
            setModalNovoEvento(true);
        } else if (view === 'locais') {
            setForm({ nome: item.nome, endereco: item.endereco, latitude: item.latitude, longitude: item.longitude });
            setModalNovoLocal(true);
        } else if (view === 'participantes') {
            setForm({ nome_completo: item.nome_completo, ativo: item.ativo });
        } else if (['publico-alvo', 'setores', 'areas'].includes(view)) {
            setForm({ nome: item.nome });
        } else if (view === 'usuarios') {
            setForm({ nome: item.nome, usuario: item.usuario });
        }
    };

    const deletarRegistro = async (id) => {
        if (!confirm('Tem certeza que deseja remover este registro permanentemente?')) return;
        try {
            setErro('');
            let urlDestino = `/api/v2/${view}/${id}`;
            if (view === 'log-fraudes') urlDestino = `/api/v2/admin/log-fraudes/${id}`;
            
            await apiFetch(urlDestino, { method: 'DELETE' });
            carregarDadosPainel();
        } catch (err) { setErro(err.message); }
    };

    const alternarSelecaoSetor = (id) => {
        const atuais = form.setores_ids || [];
        if (atuais.includes(id)) { setForm({ ...form, setores_ids: atuais.filter(x => x !== id) }); } 
        else {
            if (atuais.length >= 3) { alert('Selecione no máximo 3 setores.'); return; }
            setForm({ ...form, setores_ids: [...atuais, id] });
        }
    };

    const alternarSelecaoPublico = (id) => {
        const atuais = form.publicos_alvo_ids || [];
        setForm({ ...form, publicos_alvo_ids: atuais.includes(id) ? atuais.filter(x => x !== id) : [...atuais, id] });
    };

    if (!token) {
        if (user && user.deve_alterar_senha) {
            return (
                <div style={estilos.telaLogin}><div style={estilos.caixaLogin}><h2 style={estilos.tituloLogin}>Nova Senha Obrigatória</h2>{erro && <div style={estilos.erroBox}>{erro}</div>}<form onSubmit={lidarComAlteracaoSenha} style={estilos.formulario}><div style={estilos.campoGrupo}><label style={estilos.rotulo}>Nova Senha</label><input type="password" style={estilos.entrada} value={novaSenha} onChange={e => setNovaSenha(e.target.value)} required /></div><div style={estilos.campoGrupo}><label style={estilos.rotulo}>Confirmar Nova Senha</label><input type="password" style={estilos.entrada} value={confirmarNovaSenha} onChange={e => setConfirmarNovaSenha(e.target.value)} required /></div><button type="submit" style={estilos.btnSucesso}>SALVAR NOVA SENHA</button></form></div></div>
            );
        }
        return (
            <div style={estilos.telaLogin}><div style={estilos.caixaLogin}><img src="/logap.png" alt="Logo" style={{ height: '45px', marginBottom: '15px' }} /><h2 style={estilos.tituloLogin}>FORMAÇÕES</h2>{erro && <div style={estilos.erroBox}>{erro}</div>}<form onSubmit={lidarComLogin} style={estilos.formulario}><div style={estilos.campoGrupo}><label style={estilos.rotulo}>Usuário</label><input type="text" style={estilos.entrada} value={usuarioInput} onChange={e => setUsuarioInput(e.target.value)} required /></div><div style={estilos.campoGrupo}><label style={estilos.rotulo}>Senha</label><input type="password" style={estilos.entrada} value={senhaInput} onChange={e => setSenhaInput(e.target.value)} required /></div><button type="submit" style={estilos.btnPrimario}>ENTRAR</button></form></div></div>
        );
    }

    return (
        <div style={estilos.layoutPrincipal}>
            <div style={estilos.barraLateral}>
                <div style={{ marginBottom: '20px', textAlign: 'center', paddingBottom: '10px', borderBottom: '1px solid #1e293b' }}>
                    <img src="/logap.png" alt="Logo" style={{ height: '34px' }} />
                </div>
                <div style={view === 'eventos' ? estilos.menuItemAtivo : estilos.menuItem} onClick={() => { setView('eventos'); setDadosEstatisticos(null); setIsEditando(false); }}>FORMAÇÕES</div>
                <div style={view === 'locais' ? estilos.menuItemAtivo : estilos.menuItem} onClick={() => { setView('locais'); setDadosEstatisticos(null); setIsEditando(false); }}>LOCAIS</div>
                <div style={view === 'participantes' ? estilos.menuItemAtivo : estilos.menuItem} onClick={() => { setView('participantes'); setDadosEstatisticos(null); setIsEditando(false); }}>PARTICIPANTES</div>
                <div style={view === 'frequencias' ? estilos.menuItemAtivo : estilos.menuItem} onClick={() => { setView('frequencias'); setDadosEstatisticos(null); setIsEditando(false); }}>HISTÓRICO</div>
                <div style={view === 'log-fraudes' ? estilos.menuItemAtivo : estilos.menuItem} onClick={() => { setView('log-fraudes'); setDadosEstatisticos(null); setIsEditando(false); }}>OCORRÊNCIAS</div>
                <div style={view === 'pesquisa-satisfacao' ? estilos.menuItemAtivo : estilos.menuItem} onClick={() => { setView('pesquisa-satisfacao'); setDadosEstatisticos(null); setIsEditando(false); }}>PESQUISA DE OPINIÃO</div>
                <div style={view === 'setores' ? estilos.menuItemAtivo : estilos.menuItem} onClick={() => { setView('setores'); setDadosEstatisticos(null); setIsEditando(false); }}>SETORES (CRUD)</div>
                <div style={view === 'areas' ? estilos.menuItemAtivo : estilos.menuItem} onClick={() => { setView('areas'); setDadosEstatisticos(null); setIsEditando(false); }}>ÁREAS / MODALIDADES</div>
                <div style={view === 'publico-alvo' ? estilos.menuItemAtivo : estilos.menuItem} onClick={() => { setView('publico-alvo'); setDadosEstatisticos(null); setIsEditando(false); }}>PÚBLICO-ALVO</div>
                <div style={view === 'usuarios' ? estilos.menuItemAtivo : estilos.menuItem} onClick={() => { setView('usuarios'); setDadosEstatisticos(null); setIsEditando(false); }}>USUÁRIOS</div>
                <div style={view === 'relatorios' ? estilos.menuItemAtivo : estilos.menuItem} onClick={() => { setView('relatorios'); setLista([]); setDadosEstatisticos(null); setIsEditando(false); }}>RELATÓRIOS</div>
            </div>

            <div style={estilos.containerCentralizado}>
                <div style={estilos.barraSuperiorTopo}>
                    <div style={estilos.blocoStatusUsuario}>
                        <button title="Alterar Minha Própria Senha" onClick={() => { setView('usuarios'); setIsEditando(true); setSelecionado({ id: null }); setForm({}); }} style={estilos.btnChaveSenhaTopo}>🔑</button>
                        <span>Logado: <strong>{user?.usuario}</strong></span>
                        <button onClick={lidarComLogout} style={estilos.btnLogoffTopo}>Sair / Logoff</button>
                    </div>
                </div>

                <div style={estilos.conteudoPrincipal}>
                    <div style={{ backgroundColor: '#fff', padding: '12px 15px', borderRadius: 8, marginBottom: 15, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: 13, color: '#334155' }}>LISTAGEM: {view === 'areas' ? 'ÁREAS / MODALIDADES' : view}</span>
                        <div>
                            {view === 'eventos' && <button onClick={() => { setForm({ setores_ids: [], publicos_alvo_ids: [], area_id: '' }); setIsEditando(false); setModalNovoEvento(true); }} style={{ backgroundColor: '#16a34a', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>NOVO EVENTO</button>}
                            {view === 'locais' && <button onClick={() => { setForm({}); setIsEditando(false); setModalNovoLocal(true); }} style={{ backgroundColor: '#1e3a8a', color: '#fff', border: 'none', padding: '10px 22px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(30,58,138,0.3)' }}>ADICIONAR NOVO LOCAL</button>}
                        </div>
                        <span style={{ fontWeight: 'bold', color: '#1e3a8a', fontSize: 13 }}>Registros: {totaisSuperior}</span>
                    </div>

                    {erro && <div style={estilos.erroBox}>{erro}</div>}

                    {/* INTERFACE DE EVENTOS */}
                    {view === 'eventos' && (
                        <div style={estilos.wrapperRolagemTabela}>
                            <table style={estilos.tabela}>
                                <thead>
                                    <tr style={estilos.tabelaHeader}>
                                        <th style={estilos.th}>Título</th><th style={estilos.th}>Data</th><th style={estilos.th}>Início</th><th style={estilos.th}>Término</th><th style={estilos.th}>Palestrante</th><th style={estilos.th}>Local</th><th style={estilos.th}>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lista.map((item) => (
                                        <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                            <td style={{ padding: '10px', fontWeight: 'bold' }}>{item.titulo}</td>
                                            <td style={estilos.td}>{new Date(item.data_evento).toLocaleDateString('pt-BR')}</td>
                                            <td style={estilos.td}>{item.hora_inicio ? item.hora_inicio.slice(0, 5) : '--'}</td>
                                            <td style={estilos.td}>{item.hora_fim ? item.hora_fim.slice(0, 5) : '--'}</td>
                                            <td style={estilos.td}>{item.palestrante || '--'}</td>
                                            <td style={estilos.td}>{item.local}</td>
                                            <td style={estilos.td}>
                                                <button onClick={() => iniciarEdicao(item)} style={estilos.btnLink}>Editar</button>
                                                <button onClick={() => deletarRegistro(item.id)} style={estilos.btnLinkErro}>Excluir</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* MODIFICAÇÃO SOLICITADA: EXCEÇÃO DO HISTÓRICO SEM FORMULÁRIO LATERAL (100% LARGURA) */}
                    {view === 'frequencias' && (
                        <div style={estilos.wrapperRolagemTabela}>
                            <table style={estilos.tabela}>
                                <thead>
                                    <tr style={estilos.tabelaHeader}>
                                        <th style={estilos.th}>Matrícula</th>
                                        <th style={estilos.th}>Participante / Professor</th>
                                        <th style={estilos.th}>Formação / Evento</th>
                                        <th style={estilos.th}>Carga Oficial</th>
                                        <th style={estilos.th}>Horário Entrada</th>
                                        <th style={estilos.th}>Horário Saída</th>
                                        <th style={estilos.th}>Tempo Efetivo</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lista.map((item) => (
                                        <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                            <td style={{ ...estilos.td, fontWeight: 'bold' }}>{item.matricula || '--'}</td>
                                            <td style={estilos.td}>{item.participante_nome || '--'}</td>
                                            <td style={estilos.td}>{item.evento_titulo || '--'}</td>
                                            <td style={estilos.td}>{item.carga_horaria ? `${item.carga_horaria}h` : '--'}</td>
                                            <td style={estilos.td}>{item.data_entrada ? new Date(item.data_entrada).toLocaleString('pt-BR') : '--'}</td>
                                            <td style={estilos.td}>{item.data_saida ? new Date(item.data_saida).toLocaleString('pt-BR') : 'Em andamento'}</td>
                                            <td style={{ ...estilos.td, fontWeight: 'bold', color: '#16a34a' }}>{item.tempo_participacao || '--:--'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* DEMAIS INTERFACES COM SPLIT LAYOUT SELETIVO */}
                    {view !== 'eventos' && view !== 'frequencias' && view !== 'relatorios' && (
                        <div style={estilos.splitLayout}>
                            <div style={{ flex: view === 'locais' ? 'none' : 2, width: view === 'locais' ? '100%' : 'auto', height: '100%', display: 'flex', flexDirection: 'column' }}>
                                <div style={estilos.wrapperRolagemTabela}>
                                    <table style={estilos.tabela}>
                                        <thead>
                                            <tr style={estilos.tabelaHeader}>
                                                {view === 'locais' && <><th style={estilos.th}>Nome do Espaço</th><th style={estilos.th}>Endereço Completo</th><th style={estilos.th}>Coordenadas (Lat / Lng)</th><th style={estilos.th}>Ações</th></>}
                                                {view === 'participantes' && <><th style={estilos.th}>Nome</th><th style={estilos.th}>Matrícula</th><th style={estilos.th}>Ações</th></>}
                                                {view === 'log-fraudes' && <><th style={estilos.th}>Matrícula</th><th style={estilos.th}>Motivo</th><th style={estilos.th}>Data</th><th style={estilos.th}>Ações</th></>}
                                                {view === 'pesquisa-satisfacao' && <><th style={estilos.th}>Participante</th><th style={estilos.th}>Evento</th><th style={estilos.th}>Avaliação</th></>}
                                                {['publico-alvo', 'setores', 'areas'].includes(view) && <><th style={estilos.th}>Nome</th><th style={estilos.th}>Ações</th></>}
                                                {view === 'usuarios' && <><th style={estilos.th}>Nome do Operador</th><th style={estilos.th}>Login / Usuário</th><th style={estilos.th}>Ações</th></>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {lista.map((item) => (
                                                <tr key={item.id} style={{ borderBottom: '1px solid #cbd5e1' }}>
                                                    {view === 'locais' && <><td style={{...estilos.td, fontWeight: 'bold'}}>{item.nome}</td><td style={estilos.td}>{item.endereco}</td><td style={{...estilos.td, color: '#64748b', fontSize: '12px'}}>{item.latitude} , {item.longitude}</td><td style={estilos.td}><button onClick={() => iniciarEdicao(item)} style={estilos.btnLink}>Editar</button><button onClick={() => deletarRegistro(item.id)} style={estilos.btnLinkErro}>Excluir</button></td></>}
                                                    {view === 'participantes' && <><td style={estilos.td}>{item.nome_completo}</td><td style={estilos.td}>{item.matricula}</td><td style={estilos.td}><button onClick={() => iniciarEdicao(item)} style={estilos.btnLink}>Editar</button></td></>}
                                                    {view === 'log-fraudes' && <><td style={estilos.td}>{item.matricula}</td><td style={estilos.td}>{item.motivo}</td><td style={estilos.td}>{new Date(item.data_tentativa).toLocaleString('pt-BR')}</td><td style={estilos.td}><button onClick={() => deletarRegistro(item.id)} style={estilos.btnLinkErro}>Excluir</button></td></>}
                                                    {view === 'pesquisa-satisfacao' && <><td style={estilos.td}>{item.participante_nome}</td><td style={estilos.td}>{item.evento_titulo}</td><td style={{...estilos.td, color: '#f59e0b'}}>{item.avaliacao}</td></>}
                                                    {['publico-alvo', 'setores', 'areas'].includes(view) && <><td style={estilos.td}>{item.nome}</td><td style={estilos.td}><button onClick={() => iniciarEdicao(item)} style={estilos.btnLink}>Editar</button><button onClick={() => deletarRegistro(item.id)} style={estilos.btnLinkErro}>Excluir</button></td></>}
                                                    {/* BOTÃO EXCLUIR VINCULADO AO ENDPOINT DO BACKEND COM SUCESSO */}
                                                    {view === 'usuarios' && <><td style={{...estilos.td, fontWeight: 'bold'}}>{item.nome || 'Não Informado'}</td><td style={estilos.td}>{item.usuario}</td><td style={estilos.td}><button onClick={() => iniciarEdicao(item)} style={estilos.btnLink}>Editar</button><button onClick={() => deletarRegistro(item.id)} style={estilos.btnLinkErro} disabled={item.usuario === user.usuario}>Excluir</button></td></>}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {['publico-alvo', 'setores', 'areas', 'usuarios'].includes(view) && (
                                <div style={estilos.colunaDireita}>
                                    <form onSubmit={lidarComSubmissaoForm} style={estilos.formularioPainel}>
                                        <h3 style={{margin: 0, fontSize: '15px', color: '#1e3a8a'}}>
                                            {view === 'usuarios' && isEditando && !selecionado?.id ? '🔑 Redefinir Minha Senha' : isEditando ? '✏️ Editar Registro' : '➕ Cadastrar Registro'}
                                        </h3>
                                        
                                        {['publico-alvo', 'setores', 'areas'].includes(view) && <input type="text" placeholder="Nome" style={estilos.entradaForm} value={form.nome || ''} onChange={e => setForm({ ...form, nome: e.target.value })} required />}
                                        
                                        {view === 'usuarios' && !selecionado?.id && isEditando && (
                                            <>
                                                <label style={estilos.labelFixo}>Nova Senha:</label>
                                                <input type="password" placeholder="Digite a nova senha de acesso" style={estilos.entradaForm} value={novaSenha} onChange={e => setNovaSenha(e.target.value)} required />
                                            </>
                                        )}

                                        {view === 'usuarios' && selecionado?.id && (
                                            <>
                                                <input type="text" placeholder="Nome Completo do Operador" style={estilos.entradaForm} value={form.nome || ''} onChange={e => setForm({ ...form, nome: e.target.value })} required />
                                                <input type="text" placeholder="Login / Usuário de Acesso" style={estilos.entradaForm} value={form.usuario || ''} onChange={e => setForm({ ...form, usuario: e.target.value })} required disabled />
                                                <div style={{border: '1px solid #bfdbfe', backgroundColor: '#eff6ff', padding: '10px', borderRadius: '6px', fontSize: '12px', color: '#1e40af'}}>
                                                    As senhas são encriptadas de forma estrita em SHA-256 no momento do cadastro inicial por segurança.
                                                </div>
                                            </>
                                        )}

                                        {view === 'usuarios' && !isEditando && (
                                            <>
                                                <input type="text" placeholder="Nome Completo do Operador" style={estilos.entradaForm} value={form.nome || ''} onChange={e => setForm({ ...form, nome: e.target.value })} required />
                                                <input type="text" placeholder="Login / Usuário de Acesso" style={estilos.entradaForm} value={form.usuario || ''} onChange={e => setForm({ ...form, usuario: e.target.value })} required />
                                                <input type="password" placeholder="Senha Inicial" style={estilos.entradaForm} value={form.senha || ''} onChange={e => setForm({ ...form, senha: e.target.value })} required />
                                            </>
                                        )}

                                        <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                                            <button type="submit" style={{ ...estilos.btnSucessoForm, flex: 1 }}>Salvar</button>
                                            <button type="button" onClick={fecharModalLocal} style={{ ...estilos.btnSucessoForm, flex: 1, backgroundColor: '#ef4444' }}>Cancelar</button>
                                        </div>
                                    </form>
                                </div>
                            )}
                        </div>
                    )}

                    {view === 'relatorios' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', overflow: 'hidden' }}>
                            
                            {/* PAINEL DE FILTROS AVANÇADOS */}
                            <div style={{ backgroundColor: '#fff', padding: '18px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                                <h3 style={{ margin: '0 0 15px 0', fontSize: '15px', color: '#1e3a8a' }}>🔍 Parâmetros e Filtros do Relatório</h3>
                                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                    <div style={{ flex: 1, minWidth: '140px' }}>
                                        <label style={estilos.labelFixo}>Data Inicial:</label>
                                        <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} style={estilos.entradaForm} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: '140px' }}>
                                        <label style={estilos.labelFixo}>Data Final:</label>
                                        <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} style={estilos.entradaForm} />
                                    </div>
                                    <div style={{ flex: 1.2, minWidth: '180px' }}>
                                        <label style={estilos.labelFixo}>Filtrar por Área/Modalidade:</label>
                                        <select value={filtroArea} onChange={e => setFiltroArea(e.target.value)} style={estilos.entradaForm}>
                                            <option value="">Todas as Áreas</option>
                                            {areasDisponiveis.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                                        </select>
                                    </div>
                                    <div style={{ flex: 1.2, minWidth: '180px' }}>
                                        <label style={estilos.labelFixo}>Filtrar por Setor Organizador:</label>
                                        <select value={filtroSetor} onChange={e => setFiltroSetor(e.target.value)} style={estilos.entradaForm}>
                                            <option value="">Todos os Setores</option>
                                            {setoresDisponiveis.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                                        </select>
                                    </div>
                                    <div style={{ flex: 1.2, minWidth: '180px' }}>
                                        <label style={estilos.labelFixo}>Filtrar por Público-Alvo:</label>
                                        <select value={filtroPublico} onChange={e => setFiltroPublico(e.target.value)} style={estilos.entradaForm}>
                                            <option value="">Todos os Públicos</option>
                                            {publicosDisponiveis.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                                        </select>
                                    </div>
                                    <button onClick={processarRelatorio} style={{ ...estilos.btnPrimario, height: '38px', padding: '0 25px' }}>GERAR RELATÓRIO</button>
                                </div>
                            </div>

                            {/* SEÇÃO DE LINKS INDICADORES (SÓ EXIBE SE HOUVER DADOS ESTATÍSTICOS) */}
                            {dadosEstatisticos && (
                                <div style={{ display: 'flex', gap: '20px' }}>
                                    <div style={{ flex: 1, backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', padding: '15px 20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#1e40af', textTransform: 'uppercase' }}>Formações / Eventos no Período</span>
                                        <h2 style={{ margin: '5px 0 0 0', fontSize: '28px', color: '#1d4ed8' }}>{dadosEstatisticos.total_eventos}</h2>
                                    </div>
                                    <div style={{ flex: 1, backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '15px 20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#166534', textTransform: 'uppercase' }}>Total de Frequências Computadas</span>
                                        <h2 style={{ margin: '5px 0 0 0', fontSize: '28px', color: '#15803d' }}>{dadosEstatisticos.total_frequencias}</h2>
                                    </div>
                                </div>
                            )}

                            {/* TABELA DE DADOS RESULTANTES EM ROLAGEM ISOLADA */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                <div style={estilos.wrapperRolagemTabela}>
                                    <table style={estilos.tabela}>
                                        <thead>
                                            <tr style={estilos.tabelaHeader}>
                                                <th style={estilos.th}>Data Evento</th>
                                                <th style={estilos.th}>Matrícula</th>
                                                <th style={estilos.th}>Participante / Professor</th>
                                                <th style={estilos.th}>Formação / Evento</th>
                                                <th style={estilos.th}>Carga</th>
                                                <th style={estilos.th}>Entrada Real</th>
                                                <th style={estilos.th}>Saída Real</th>
                                                <th style={estilos.th}>Tempo Efetivo</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {lista.map((item) => (
                                                <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                    <td style={{ ...estilos.td, fontWeight: 'bold' }}>{item.data_evento ? new Date(item.data_evento).toLocaleDateString('pt-BR') : '--'}</td>
                                                    <td style={estilos.td}>{item.matricula}</td>
                                                    <td style={estilos.td}>{item.participante_nome}</td>
                                                    <td style={estilos.td}>{item.evento_titulo}</td>
                                                    <td style={estilos.td}>{item.carga_horaria ? `${item.carga_horaria}h` : '--'}</td>
                                                    <td style={estilos.td}>{item.data_entrada ? new Date(item.data_entrada).toLocaleTimeString('pt-BR') : '--'}</td>
                                                    <td style={estilos.td}>{item.data_saida ? new Date(item.data_saida).toLocaleTimeString('pt-BR') : 'Em aberto'}</td>
                                                    <td style={{ ...estilos.td, fontWeight: 'bold', color: '#16a34a' }}>{item.tempo_participacao || '--:--'}</td>
                                                </tr>
                                            ))}
                                            {dadosEstatisticos && lista.length === 0 && (
                                                <tr>
                                                    <td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: '#64748b', fontWeight: '500' }}>
                                                        Nenhum registro de frequência encontrado para os filtros selecionados.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                        </div>
                    )}
                </div>
            </div>

            {/* MODAL VITRIFICADO DE CADASTRO DE LOCAL */}
            {modalNovoLocal && (
                <div style={estilos.backdropVitrificado}>
                    <div style={estilos.containerGlass}>
                        <div style={estilos.blocoMapaModal}>
                            <div id="mapa-modal-vitrificado" style={{ width: '100%', height: '100%', borderRadius: '16px 0 0 16px' }}></div>
                        </div>
                        <div style={estilos.blocoFormModal}>
                            <h3 style={{ marginTop: 0, color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', fontSize: '16px' }}>
                                {isEditando ? '✏️ Ajustar Local Existente' : '📍 Mapear Novo Espaço'}
                            </h3>
                            <p style={{ fontSize: '12px', color: '#64748b', marginTop: '-5px', marginBottom: '15px' }}>
                                Clique em qualquer ponto do mapa à esquerda para ler as coordenadas e o endereço automaticamente.
                            </p>
                            <form onSubmit={lidarComSubmissaoForm} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div>
                                    <label style={estilos.labelFixo}>Nome do Espaço / Prédio:</label>
                                    <input type="text" ref={nomeLocalRef} placeholder="Ex: Auditório Central, Escola Polo..." style={estilos.entradaForm} value={form.nome || ''} onChange={e => setForm({ ...form, nome: e.target.value })} required />
                                </div>
                                <div>
                                    <label style={estilos.labelFixo}>Diretriz de Endereço:</label>
                                    <input type="text" placeholder="Selecione no mapa ou digite aqui..." style={estilos.entradaForm} value={form.endereco || ''} onChange={e => setForm({ ...form, endereco: e.target.value })} required />
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <div style={{ flex: 1 }}><label style={estilos.labelFixo}>Latitude:</label><input type="text" style={{...estilos.entradaForm, backgroundColor: '#f8fafc'}} value={form.latitude || ''} onChange={e => setForm({ ...form, latitude: e.target.value })} required /></div>
                                    <div style={{ flex: 1 }}><label style={estilos.labelFixo}>Longitude:</label><input type="text" style={{...estilos.entradaForm, backgroundColor: '#f8fafc'}} value={form.longitude || ''} onChange={e => setForm({ ...form, longitude: e.target.value })} required /></div>
                                </div>
                                <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
                                    <button type="button" onClick={fecharModalLocal} style={{ ...estilos.btnFormModal, backgroundColor: '#64748b' }}>Cancelar</button>
                                    <button type="submit" style={{ ...estilos.btnFormModal, backgroundColor: '#16a34a' }}>Salvar</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE EVENTOS / FORMAÇÕES */}
            {modalNovoEvento && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
                    <div style={{ backgroundColor: '#fff', padding: '25px', borderRadius: '12px', width: '90%', maxWidth: '520px', maxHeight: '85vh', overflowY: 'auto' }}>
                        <h3>📐 Formação / Evento</h3>
                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            try {
                                await apiFetch(isEditando ? `/api/v2/eventos/${selecionado.id}` : '/api/v2/eventos', { method: isEditando ? 'PUT' : 'POST', body: JSON.stringify(form) });
                                setModalNovoEvento(false); setForm({}); setIsEditando(false); carregarDadosPainel();
                            } catch (err) { alert(err.message); }
                        }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <input type="text" placeholder="Título" style={estilos.entradaForm} value={form.titulo || ''} onChange={e => setForm({ ...form, titulo: e.target.value })} required />
                                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Modalidade / Área:</label>
                                <select value={form.area_id || ''} onChange={e => setForm({ ...form, area_id: e.target.value })} required style={estilos.entradaForm}>
                                    <option value="">Selecione a Modalidade / Área...</option>
                                    {areasDisponiveis.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                                </select>
                                <input type="date" style={estilos.entradaForm} value={form.data_evento || ''} onChange={e => setForm({ ...form, data_evento: e.target.value })} required />
                                <input type="time" style={estilos.entradaForm} value={form.hora_inicio || ''} onChange={e => lidarComMudancaHora('hora_inicio', e.target.value)} required />
                                <input type="time" style={estilos.entradaForm} value={form.hora_fim || ''} onChange={e => lidarComMudancaHora('hora_fim', e.target.value)} required />
                                <input type="text" placeholder="Palestrante / Formador" style={estilos.entradaForm} value={form.palestrante || ''} onChange={e => setForm({ ...form, palestrante: e.target.value })} />
                                <select value={form.local_id || ''} onChange={e => setForm({ ...form, local_id: e.target.value })} required style={estilos.entradaForm}>
                                    <option value="">Selecione o Local...</option>
                                    {locaisDisponiveis.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
                                </select>
                                <label style={{ fontSize: '12px', fontWeight: 'bold', marginTop: '5px' }}>Setores Responsáveis Organizadores (Até 3):</label>
                                <div style={{ border: '1px solid #cbd5e1', padding: '10px', borderRadius: '6px', maxHeight: '110px', overflowY: 'auto' }}>
                                    {setoresDisponiveis.map(s => (
                                        <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '4px', cursor: 'pointer' }}>
                                            <input type="checkbox" checked={(form.setores_ids || []).includes(s.id)} onChange={() => autumnarSelecaoSetor(s.id)} />
                                            {s.nome}
                                        </label>
                                    ))}
                                </div>
                                <label style={{ fontSize: '12px', fontWeight: 'bold', marginTop: '5px' }}>Públicos-Alvo Destinados (Ilimitado):</label>
                                <div style={{ border: '1px solid #cbd5e1', padding: '10px', borderRadius: '6px', maxHeight: '110px', overflowY: 'auto' }}>
                                    {publicosDisponiveis.map(p => (
                                        <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '4px', cursor: 'pointer' }}>
                                            <input type="checkbox" checked={(form.publicos_alvo_ids || []).includes(p.id)} onChange={() => alternarSelecaoPublico(p.id)} />
                                            {p.nome}
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button type="button" onClick={() => { setModalNovoEvento(false); setForm({}); setIsEditando(false); }} style={{ padding: '10px 20px', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer' }}>VOLTAR</button>
                                <button type="submit" style={{ padding: '10px 25px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>CONFIRMAR</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

const estilos = {
    layoutPrincipal: { display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#f8fafc', fontFamily: 'system-ui', overflow: 'hidden' },
    barraLateral: { width: '240px', minWidth: '240px', backgroundColor: '#0f172a', color: '#94a3b8', padding: '15px 12px', display: 'flex', flexDirection: 'column', gap: '5px', height: '100vh', boxSizing: 'border-box' },
    containerCentralizado: { flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', width: 'calc(100vw - 240px)', overflow: 'hidden' },
    
    barraSuperiorTopo: { height: '45px', width: '100%', backgroundColor: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 25px', boxSizing: 'border-box' },
    blocoStatusUsuario: { display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: '#475569' },
    btnLogoffTopo: { padding: '5px 12px', borderRadius: '4px', border: '1px solid #f87171', backgroundColor: '#fef2f2', color: '#ef4444', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px', transition: 'all 0.2s' },
    btnChaveSenhaTopo: { background: 'none', border: 'none', fontSize: '15px', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' },

    conteudoPrincipal: { flex: 1, padding: '20px 25px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box' },
    wrapperRolagemTabela: { flex: 1, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#fff' },

    splitLayout: { display: 'flex', gap: '20px', alignItems: 'flex-start', flex: 1, overflow: 'hidden', height: '100%' },
    colunaEsquerdaSemForm: { flex: 1, backgroundColor: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    colunaDireita: { width: '310px', backgroundColor: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' },
    formularioPainel: { display: 'flex', flexDirection: 'column', gap: '10px' },

    backdropVitrificado: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.35)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999 },
    containerGlass: { backgroundColor: 'rgba(255, 255, 255, 0.88)', backdropFilter: 'blur(20px)', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.5)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.22)', width: '92%', maxWidth: '920px', height: '78vh', display: 'flex', overflow: 'hidden' },
    blocoMapaModal: { flex: 1.2, height: '100%', backgroundColor: '#e2e8f0' },
    blocoFormModal: { flex: 1, padding: '25px', display: 'flex', flexDirection: 'column', overflowY: 'auto' },
    labelFixo: { display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#475569', marginBottom: '3px' },
    btnFormModal: { flex: 1, padding: '11px', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' },

    telaLogin: { display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9', fontFamily: 'system-ui' },
    caixaLogin: { backgroundColor: '#fff', padding: '35px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', width: '330px', textAlign: 'center', border: '1px solid #e2e8f0' },
    tituloLogin: { fontSize: '20px', color: '#1e3a8a', margin: '0 0 20px 0' },
    formulario: { display: 'flex', flexDirection: 'column', gap: '15px', textAlign: 'left' },
    campoGrupo: { display: 'flex', flexDirection: 'column', gap: '5px' },
    rotulo: { fontSize: '13px', fontWeight: 'bold', color: '#475569' },
    entrada: { padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' },
    btnPrimario: { padding: '10px 18px', borderRadius: '6px', border: 'none', backgroundColor: '#1e3a8a', color: '#fff', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' },
    btnSucesso: { padding: '12px', borderRadius: '6px', border: 'none', backgroundColor: '#16a34a', color: '#fff', fontWeight: 'bold', cursor: 'pointer' },
    erroBox: { padding: '8px', borderRadius: '6px', backgroundColor: '#fee2e2', color: '#991b1b', fontSize: '12px', fontWeight: 'bold', marginBottom: '10px' },
    menuItem: { padding: '9px 12px', borderRadius: '6px', color: '#94a3b8', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
    menuItemAtivo: { padding: '9px 12px', borderRadius: '6px', color: '#fff', backgroundColor: '#0284c7', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' },
    entradaForm: { padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', width: '100%', boxSizing: 'border-box', backgroundColor: '#fff' },
    btnSucessoForm: { padding: '10px', borderRadius: '6px', border: 'none', backgroundColor: '#16a34a', color: '#fff', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' },
    btnLink: { background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', fontWeight: '600', marginRight: '10px', padding: 0, fontSize: '12px' },
    btnLinkErro: { background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: '600', padding: 0, fontSize: '12px' },
    tabela: { width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff' },
    tabelaHeader: { backgroundColor: '#f1f5f9', position: 'sticky', top: 0, zIndex: 10 },
    th: { textAlign: 'left', padding: '10px', color: '#475569', borderBottom: '2px solid #cbd5e1', fontSize: '12px', fontWeight: 'bold' },
    td: { padding: '10px', color: '#334155', fontSize: '12px' }
};