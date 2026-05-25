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
    const [mapaCarregado, setMapaCarregado] = useState(false);
    const [modalNovoEvento, setModalNovoEvento] = useState(false);
    
    // NOVO: Estados para o Modal Vitrificado de Local
    const [modalNovoLocal, setModalNovoLocal] = useState(false);
    const nomeLocalRef = useRef(null);

    useEffect(() => {
        if (token) {
            carregarDadosPainel();
            carregarAuxiliaresGlobais();
        }
    }, [view, token]);

    // Inicializa o mapa do local apenas quando o modal vitrificado abrir
    useEffect(() => {
        if (modalNovoLocal) {
            inicializarMapaModal();
        }
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
            const setores = await apiFetch('/api/v2/setor');
            const areas = await apiFetch('/api/v2/area');
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
        if (!dataInicio || !dataFim) { setErro('Selecione o período.'); return; }
        try {
            setErro('');
            const dados = await apiFetch(`/api/v2/admin/relatorio-integrado?data_inicio=${dataInicio}&data_fim=${dataFim}`);
            setDadosEstatisticos(dados.totais); setLista(dados.registros); setTotaisSuperior(dados.registros.length);
        } catch (err) { setErro(err.message); }
    };

    // =====================================================================
    // MOTOR DE MAPAS: LEAFLET COM BUSCA REVERSA AUTOMÁTICA DE ENDEREÇO
    // =====================================================================
    const inicializarMapaModal = () => {
        setTimeout(() => {
            const container = document.getElementById('mapa-modal-vitrificado');
            if (!container) return;
            
            if (window.L) { 
                renderizarMapaModal(window.L); 
            } else {
                const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(link);
                const script = document.createElement('script'); script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; 
                script.onload = () => renderizarMapaModal(window.L); document.body.appendChild(script);
            }
        }, 200);
    };

    const renderizarMapaModal = (L) => {
        if (window.mapaModalInstancia) window.mapaModalInstancia.remove();
        
        // Coordenadas Centrais Fiel de Queimados/RJ
        const centroQueimados = [-22.7144, -43.5539];
        const mapa = L.map('mapa-modal-vitrificado').setView(centroQueimados, 14);
        window.mapaModalInstancia = mapa;
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapa);
        
        let marcador;

        // Se estiver editando, já coloca o marcador no local salvo
        if (isEditando && form.latitude && form.longitude) {
            const coordSalva = [parseFloat(form.latitude), parseFloat(form.longitude)];
            marcador = L.marker(coordSalva).addTo(mapa);
            mapa.setView(coordSalva, 16);
        }

        mapa.on('click', async (e) => {
            const { lat, lng } = e.latlng;
            if (marcador) mapa.removeLayer(marcador);
            marcador = L.marker([lat, lng]).addTo(mapa);
            
            let enderecoDetectado = "Carregando endereço...";
            setForm(prev => ({ ...prev, latitude: lat.toFixed(6), longitude: lng.toFixed(6), endereco: enderecoDetectado }));

            // Requisição inteligente ao OpenStreetMap (Nominatim API) para preenchimento automático
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
                const dadosGeo = await res.json();
                if (dadosGeo && dadosGeo.display_name) {
                    // Limpa a string removendo o excesso de informações como o país
                    enderecoDetectado = dadosGeo.display_name.split(', Brasil')[0];
                } else {
                    enderecoDetectado = `Marcado na Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
                }
            } catch (err) {
                enderecoDetectado = `Diretriz na Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
            }

            setForm(prev => ({ ...prev, endereco: enderecoDetectado }));
            
            // Joga o cursor do teclado automaticamente no campo nome
            if (nomeLocalRef.current) {
                nomeLocalRef.current.focus();
            }
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
            const prefixoAdmin = view === 'frequencias' ? 'admin/' : '';
            await apiFetch(isEditando ? `/api/v2/${prefixoAdmin}${view}/${selecionado.id}` : `/api/v2/${prefixoAdmin}${view}`, { method: isEditando ? 'PUT' : 'POST', body: JSON.stringify(form) });
            fecharModalLocal();
            carregarDadosPainel();
        } catch (err) { setErro(err.message); }
    };

    const fecharModalLocal = () => {
        setForm({});
        setIsEditando(false);
        setSelecionado(null);
        setModalNovoLocal(false);
        if (window.mapaModalInstancia) {
            window.mapaModalInstancia.remove();
            window.mapaModalInstancia = null;
        }
    };

    const iniciarEdicao = async (item) => {
        setSelecionado(item); setIsEditando(true);
        if (view === 'eventos') {
            const detalhe = await apiFetch(`/api/v2/admin/eventos-detalhes/${item.id}`);
            const sIds = [detalhe.setor_id_1, detalhe.setor_id_2, detalhe.setor_id_3].filter(Boolean);
            setForm({
                titulo: detalhe.titulo, area_id: detalhe.area_id || '', data_evento: detalhe.data_evento.substring(0, 10), carga_horaria: detalhe.carga_horaria,
                local_id: detalhe.local_id, hora_inicio: detalhe.hora_inicio, hora_fim: detalhe.hora_fim, palestrante: detalhe.palestrante,
                setores_ids: sIds, publicos_alvo_ids: detalhe.publicos_alvo_ids || []
            });
            setModalNovoEvento(true);
        } else if (view === 'locais') {
            setForm({ nome: item.nome, endereco: item.endereco, latitude: item.latitude, longitude: item.longitude });
            setModalNovoLocal(true); // Abre o modal vitrificado para edição
        } else if (view === 'participantes') {
            setForm({ nome_completo: item.nome_completo, ativo: item.ativo });
        } else if (['publico-alvo', 'setores', 'areas'].includes(view)) {
            setForm({ nome: item.nome });
        }
    };

    const deletarRegistro = async (id) => {
        if (!confirm('Remover registro?')) return;
        try {
            await apiFetch(view === 'log-fraudes' ? `/api/v2/admin/log-fraudes/${id}` : `/api/v2/${view}/${id}`, { method: 'DELETE' });
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
                <div style={{ marginBottom: '30px', textAlign: 'center' }}><img src="/logap.png" alt="Logo" style={{ height: '38px' }} /></div>
                <div style={estilos.usuarioStatus}>Logado: {user?.usuario}</div>
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
                <div style={estilos.btnLogout} onClick={lidarComLogout}>Sair</div>
            </div>

            <div style={estilos.conteudoPrincipal}>
                <div style={{ backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 20, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: 13 }}>LISTAGEM: {view}</span>
                    <div>
                        {view === 'eventos' && <button onClick={() => { setForm({ setores_ids: [], publicos_alvo_ids: [], area_id: '' }); setIsEditando(false); setModalNovoEvento(true); }} style={{ backgroundColor: '#16a34a', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>NOVO EVENTO</button>}
                        {/* NOVO: EXCEÇÃO EXIGIDA PARA CADASTRO DE LOCAIS */}
                        {view === 'locais' && <button onClick={() => { setForm({}); setIsEditando(false); setModalNovoLocal(true); }} style={{ backgroundColor: '#1e3a8a', color: '#fff', border: 'none', padding: '10px 22px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(30,58,138,0.3)' }}>ADICIONAR NOVO LOCAL</button>}
                    </div>
                    <span style={{ fontWeight: 'bold', color: '#1e3a8a' }}>Registros: {totaisSuperior}</span>
                </div>

                {erro && <div style={estilos.erroBox}>{erro}</div>}

                {view === 'eventos' && (
                    <div style={estilos.colunaEsquerdaSemForm}>
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

                {view !== 'eventos' && view !== 'relatorios' && (
                    <div style={estilos.splitLayout}>
                        {/* Se for a view de locais, a tabela agora ocupa 100% da largura, pois o form foi pro Modal Glass */}
                        <div style={{ flex: view === 'locais' ? 'none' : 2, width: view === 'locais' ? '100%' : 'auto', backgroundColor: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                            <table style={estilos.tabela}>
                                <thead>
                                    <tr style={estilos.tabelaHeader}>
                                        {view === 'locais' && <><th style={estilos.th}>Nome do Espaço</th><th style={estilos.th}>Endereço Completo</th><th style={estilos.th}>Coordenadas (Lat / Lng)</th><th style={estilos.th}>Ações</th></>}
                                        {view === 'participantes' && <><th style={estilos.th}>Nome</th><th style={estilos.th}>Matrícula</th><th style={estilos.th}>Ações</th></>}
                                        {view === 'frequencias' && <><th style={estilos.th}>Matrícula</th><th style={estilos.th}>Participante</th><th style={estilos.th}>Evento</th><th style={estilos.th}>Tempo</th><th style={estilos.th}>Ações</th></>}
                                        {view === 'log-fraudes' && <><th style={estilos.th}>Matrícula</th><th style={estilos.th}>Motivo</th><th style={estilos.th}>Data</th><th style={estilos.th}>Ações</th></>}
                                        {view === 'pesquisa-satisfacao' && <><th style={estilos.th}>Participante</th><th style={estilos.th}>Evento</th><th style={estilos.th}>Avaliação</th></>}
                                        {['publico-alvo', 'setores', 'areas'].includes(view) && <><th style={estilos.th}>Nome</th><th style={estilos.th}>Ações</th></>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {lista.map((item) => (
                                        <tr key={item.id} style={{ borderBottom: '1px solid #cbd5e1' }}>
                                            {view === 'locais' && <><td style={{...estilos.td, fontWeight: 'bold'}}>{item.nome}</td><td style={estilos.td}>{item.endereco}</td><td style={{...estilos.td, color: '#64748b', fontSize: '12px'}}>{item.latitude} , {item.longitude}</td><td style={estilos.td}><button onClick={() => iniciarEdicao(item)} style={estilos.btnLink}>Editar</button><button onClick={() => deletarRegistro(item.id)} style={estilos.btnLinkErro}>Excluir</button></td></>}
                                            {view === 'participantes' && <><td style={estilos.td}>{item.nome_completo}</td><td style={estilos.td}>{item.matricula}</td><td style={estilos.td}><button onClick={() => iniciarEdicao(item)} style={estilos.btnLink}>Editar</button></td></>}
                                            {view === 'frequencias' && <><td style={estilos.td}>{item.matricula}</td><td style={estilos.td}>{item.participante_nome}</td><td style={estilos.td}>{item.evento_titulo}</td><td style={{...estilos.td, fontWeight: 'bold', color: '#16a34a'}}>{item.tempo_participacao || '--:--'}</td><td style={estilos.td}><button onClick={() => { setSelecionado(item); setIsEditando(true); setForm({ data_entrada: item.data_entrada.substring(0, 16), data_saida: item.data_saida ? item.data_saida.substring(0, 16) : '' }); }} style={estilos.btnLink}>Editar</button></td></>}
                                            {view === 'log-fraudes' && <><td style={estilos.td}>{item.matricula}</td><td style={estilos.td}>{item.motivo}</td><td style={estilos.td}>{new Date(item.data_tentativa).toLocaleString('pt-BR')}</td><td style={estilos.td}><button onClick={() => deletarRegistro(item.id)} style={estilos.btnLinkErro}>Excluir</button></td></>}
                                            {view === 'pesquisa-satisfacao' && <><td style={estilos.td}>{item.participante_nome}</td><td style={estilos.td}>{item.evento_titulo}</td><td style={{...estilos.td, color: '#f59e0b'}}>{item.avaliacao}</td></>}
                                            {['publico-alvo', 'setores', 'areas'].includes(view) && <><td style={estilos.td}>{item.nome}</td><td style={estilos.td}><button onClick={() => iniciarEdicao(item)} style={estilos.btnLink}>Editar</button><button onClick={() => deletarRegistro(item.id)} style={estilos.btnLinkErro}>Excluir</button></td></>}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* O formulário de locais não entra mais aqui, apenas as outras tabelas normais */}
                        {['publico-alvo', 'setores', 'areas', 'usuarios', 'frequencias'].includes(view) && (
                            <div style={estilos.colunaDireita}>
                                <form onSubmit={lidarComSubmissaoForm} style={estilos.formularioPainel}>
                                    <h3>{isEditando ? 'Editar Registro' : 'Cadastrar Registro'}</h3>
                                    {['publico-alvo', 'setores', 'areas'].includes(view) && <input type="text" placeholder="Nome" style={estilos.entradaForm} value={form.nome || ''} onChange={e => setForm({ ...form, nome: e.target.value })} required />}
                                    {view === 'frequencias' && isEditando && <><label>Entrada:</label><input type="datetime-local" style={estilos.entradaForm} value={form.data_entrada || ''} onChange={e => setForm({ ...form, data_entrada: e.target.value })} required /><label>Saída:</label><input type="datetime-local" style={estilos.entradaForm} value={form.data_saida || ''} onChange={e => setForm({ ...form, data_saida: e.target.value })} /></>}
                                    
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button type="submit" style={{ ...estilos.btnSucessoForm, flex: 1 }}>Salvar</button>
                                        <button type="button" onClick={() => { setIsEditando(false); setForm({}); setSelecionado(null); }} style={{ ...estilos.btnSucessoForm, flex: 1, backgroundColor: '#ef4444' }}>Cancelar</button>
                                    </div>
                                </form>
                            </div>
                        )}
                    </div>
                )}

                {view === 'relatorios' && (
                    <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                        <h3>Relatórios Consolidados</h3>
                        <div style={{ display: 'flex', gap: '15px', marginBottom: '25px', alignItems: 'flex-end' }}>
                            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} style={estilos.entrada} />
                            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} style={estilos.entrada} />
                            <button onClick={processarRelatorio} style={estilos.btnPrimario}>GERAR</button>
                            <button onClick={() => setView('eventos')} style={{ ...estilos.btnPrimario, backgroundColor: '#64748b' }}>VOLTAR</button>
                        </div>
                    </div>
                )}
            </div>

            {/* =====================================================================
                NOVO: MODAL TOTALMENTE VITRIFICADO (GLASSMORPHISM) PARA CADASTRO DE LOCAL
                ===================================================================== */}
            {modalNovoLocal && (
                <div style={estilos.backdropVitrificado}>
                    <div style={estilos.containerGlass}>
                        
                        {/* Lado Esquerdo: O Mapa Ampliado */}
                        <div style={estilos.blocoMapaModal}>
                            <div id="mapa-modal-vitrificado" style={{ width: '100%', height: '100%', borderRadius: '12px 0 0 12px' }}></div>
                        </div>

                        {/* Lado Direito: O Formulário de Dados com Foco Inteligente */}
                        <div style={estilos.blocoFormModal}>
                            <h3 style={{ marginTop: 0, color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                                {isEditando ? '✏️ Ajustar Local Existente' : '📍 Mapear Novo Espaço'}
                            </h3>
                            <p style={{ fontSize: '12px', color: '#64748b', marginTop: '-5px', marginBottom: '15px' }}>
                                Clique em qualquer ponto do mapa à esquerda para ler as coordenadas e o endereço automaticamente.
                            </p>

                            <form onSubmit={lidarComSubmissaoForm} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div>
                                    <label style={estilos.labelFixo}>Nome do Espaço / Prédio:</label>
                                    <input 
                                        type="text" 
                                        ref={nomeLocalRef}
                                        placeholder="Ex: Auditório Central, Escola Polo..." 
                                        style={estilos.entradaForm} 
                                        value={form.nome || ''} 
                                        onChange={e => setForm({ ...form, nome: e.target.value })} 
                                        required 
                                    />
                                </div>

                                <div>
                                    <label style={estilos.labelFixo}>Diretriz de Endereço:</label>
                                    <input 
                                        type="text" 
                                        placeholder="Selecione no mapa ou digite aqui..." 
                                        style={estilos.entradaForm} 
                                        value={form.endereco || ''} 
                                        onChange={e => setForm({ ...form, endereco: e.target.value })} 
                                        required 
                                    />
                                </div>

                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={estilos.labelFixo}>Latitude:</label>
                                        <input type="text" style={{...estilos.entradaForm, backgroundColor: '#f8fafc'}} value={form.latitude || ''} onChange={e => setForm({ ...form, latitude: e.target.value })} required />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={estilos.labelFixo}>Longitude:</label>
                                        <input type="text" style={{...estilos.entradaForm, backgroundColor: '#f8fafc'}} value={form.longitude || ''} onChange={e => setForm({ ...form, longitude: e.target.value })} required />
                                    </div>
                                </div>

                                {/* Botões de Ação idênticos à solicitação */}
                                <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
                                    <button 
                                        type="button" 
                                        onClick={fecharModalLocal} 
                                        style={{ ...estilos.btnFormModal, backgroundColor: '#64748b' }}
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        type="submit" 
                                        style={{ ...estilos.btnFormModal, backgroundColor: '#16a34a' }}
                                    >
                                        Salvar
                                    </button>
                                </div>
                            </form>
                        </div>

                    </div>
                </div>
            )}

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
                                            <input type="checkbox" checked={(form.setores_ids || []).includes(s.id)} onChange={() => alternarSelecaoSetor(s.id)} />
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
    // ESTILOS AVANÇADOS DE VITRIFICAÇÃO (GLASSMORPHISM) SOLICITADOS
    backdropVitrificado: {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999
    },
    containerGlass: {
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(20px)',
        borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.6)',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        width: '94%', maxWidth: '950px', height: '80vh',
        display: 'flex', overflow: 'hidden'
    },
    blocoMapaModal: { flex: 1.3, height: '100%', backgroundColor: '#e2e8f0' },
    blocoFormModal: { flex: 1, padding: '30px', display: 'flex', flexDirection: 'column', overflowY: 'auto' },
    labelFixo: { display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '4px' },
    btnFormModal: { flex: 1, padding: '12px', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' },
    
    // Estilos padrão do sistema preservados
    telaLogin: { display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9', fontFamily: 'system-ui' },
    caixaLogin: { backgroundColor: '#fff', padding: '35px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', width: '330px', textAlign: 'center', border: '1px solid #e2e8f0' },
    tituloLogin: { fontSize: '20px', color: '#1e3a8a', margin: '0 0 20px 0' },
    formulario: { display: 'flex', flexDirection: 'column', gap: '15px', textAlign: 'left' },
    campoGrupo: { display: 'flex', flexDirection: 'column', gap: '5px' },
    rotulo: { fontSize: '13px', fontWeight: 'bold', color: '#475569' },
    entrada: { padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' },
    btnPrimario: { padding: '12px', borderRadius: '6px', border: 'none', backgroundColor: '#1e3a8a', color: '#fff', fontWeight: 'bold', cursor: 'pointer' },
    btnSucesso: { padding: '12px', borderRadius: '6px', border: 'none', backgroundColor: '#16a34a', color: '#fff', fontWeight: 'bold', cursor: 'pointer' },
    erroBox: { padding: '10px', borderRadius: '6px', backgroundColor: '#fee2e2', color: '#991b1b', fontSize: '13px', fontWeight: 'bold', marginBottom: '10px' },
    layoutPrincipal: { display: 'flex', height: '100vh', backgroundColor: '#f8fafc', fontFamily: 'system-ui' },
    barraLateral: { width: '250px', backgroundColor: '#0f172a', color: '#94a3b8', padding: '20px 15px', display: 'flex', flexDirection: 'column', gap: '6px' },
    usuarioStatus: { fontSize: '12px', color: '#64748b', padding: '0 10px', marginBottom: '15px', borderBottom: '1px solid #1e293b', paddingBottom: '10px' },
    menuItem: { padding: '11px 12px', borderRadius: '6px', color: '#94a3b8', cursor: 'pointer', fontSize: '13px', fontWeight: '500' },
    menuItemAtivo: { padding: '11px 12px', borderRadius: '6px', color: '#fff', backgroundColor: '#0284c7', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' },
    btnLogout: { marginTop: 'auto', padding: '10px 12px', borderRadius: '6px', color: '#fca5a5', cursor: 'pointer', textAlign: 'center', border: '1px dashed #f87171' },
    conteudoPrincipal: { flex: 1, padding: '30px', overflowY: 'auto' },
    splitLayout: { display: 'flex', gap: '20px', alignItems: 'flex-start' },
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