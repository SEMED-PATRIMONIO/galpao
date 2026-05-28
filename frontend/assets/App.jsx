import React, { useState, useEffect } from 'react';

const estilos = {
    layout: { display: 'flex', fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh' },
    sidebar: { width: '240px', backgroundColor: '#0f172a', padding: '20px', display: 'flex', flexDirection: 'column', color: '#cbd5e1' },
    brand: { fontSize: '18px', fontWeight: 'bold', color: '#fff', marginBottom: '25px', textAlign: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '15px' },
    menu: { listStyle: 'none', padding: 0, margin: 0, flex: 1 },
    main: { flex: 1, padding: '30px', boxSizing: 'border-box' },
    topo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', backgroundColor: '#fff', padding: '15px 20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', position: 'relative' },
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
    entradaForm: { padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px', width: '100%', boxSizing: 'border-box' },
    btnAdicionar: { position: 'absolute', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#16a34a', color: '#fff', padding: '8px 16px', borderRadius: '6px', border: 'none', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(22,163,74,0.2)' },
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.3)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000, padding: '20px' },
    modalGlass: { backgroundColor: 'rgba(255, 255, 255, 0.8)', border: '1px solid rgba(255, 255, 255, 0.4)', borderRadius: '16px', boxShadow: '0 8px 32px 0 rgba(15, 23, 42, 0.15)', width: '100%', maxWidth: '600px', maxHeight: '95vh', overflowY: 'auto', padding: '25px', boxSizing: 'border-box' }
};

// Movido para fora do componente para evitar TDZ no build de produção
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

export default function App() {
    const tokenSalvo = localStorage.getItem('admin_token');
    const [token, setToken] = useState(tokenSalvo && tokenSalvo !== 'undefined' && tokenSalvo !== 'null' ? tokenSalvo : null);
    const [user, setUser] = useState(obterUsuarioSeguro());
    const [view, setView] = useState('eventos');
    const [usuarioInput, setUsuarioInput] = useState('');
    const [senhaInput, setSenhaInput] = useState('');
    const [novaSenha, setNovaSenha] = useState('');
    const [confirmarNovaSenha, setConfirmarNovaSenha] = useState('');
    const [erro, setErro] = useState('');
    const [isEditando, setIsEditando] = useState(false);
    
    const [lista, setLista] = useState([]);
    const [selecionado, setSelecionado] = useState(null);
    const [form, setForm] = useState({});
    const [modalEventoAberto, setModalEventoAberto] = useState(false);
    const [modalLocalAberto, setModalLocalAberto] = useState(false);
    const [pesquisaCidade, setPesquisaCidade] = useState('');
    const [mapaLeaflet, setMapaLeaflet] = useState(null);
    const [marcadorMapa, setMarcadorMapa] = useState(null);    
    const [publicosSelecionados, setPublicosSelecionados] = useState([]);
    const [totaisSuperior, setTotaisSuperior] = useState(0);
    
    const [dataInicio, setDataInicio] = useState(new Date().toISOString().split('T')[0]);
    const [dataFim, setDataFim] = useState(new Date().toISOString().split('T')[0]);
    const [areaFiltro, setAreaFiltro] = useState('');
    const [setorFiltro, setSetorFiltro] = useState('');
    const [publicoFiltro, setPublicoFiltro] = useState('');

    const [combos, setCombos] = useState({ areas: [], setores: [], locais: [], publicos: [] });
    const [dadosEstatisticos, setDadosEstatisticos] = useState({ total_eventos: 0, total_frequencias: 0 });
    const [horaSaidaManualInput, setHoraSaidaManualInput] = useState('');
    const [hoveredRowId, setHoveredRowId] = useState(null);

    const API_URL = window.location.origin.includes('localhost') ? 'http://localhost:3009' : '';

    useEffect(() => {
        if (token) {
            carregarCombosAuxiliares();
            if (view !== 'frequencias') {
                executarListagem();
            }
        }
    }, [token, view]);

    // Inicialização segura do Mapa Leaflet dinamicamente
    useEffect(() => {
        if (!modalLocalAberto) {
            if (mapaLeaflet) {
                mapaLeaflet.remove();
                setMapaLeaflet(null);
                setMarcadorMapa(null);
            }
            return;
        }

        const iniciarInstanciaMapa = () => {
            setTimeout(() => {
                const el = document.getElementById('mapa-leaflet');
                if (!el) return;

                // Coordenadas padrão de Queimados, RJ
                const defaultLat = -22.7161;
                const defaultLng = -43.5556;

                const centroLat = isEditando && form.latitude ? parseFloat(form.latitude) : defaultLat;
                const centroLng = isEditando && form.longitude ? parseFloat(form.longitude) : defaultLng;

                const map = window.L.map('mapa-leaflet').setView([centroLat, centroLng], 14);
                window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap'
                }).addTo(map);

                let marker = null;
                if (isEditando && form.latitude && form.longitude) {
                    marker = window.L.marker([centroLat, centroLng]).addTo(map);
                }

                map.on('click', async (e) => {
                    const { lat, lng } = e.latlng;
                    if (marker) {
                        marker.setLatLng([lat, lng]);
                    } else {
                        marker = window.L.marker([lat, lng]).addTo(map);
                        setMarcadorMapa(marker);
                    }

                    setForm(prev => ({ ...prev, latitude: lat.toFixed(8), longitude: lng.toFixed(8) }));

                    // Geolocalização Reversa Automática (Nominatim OpenStreetMap)
                    try {
                        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
                        if (r.ok) {
                            const d = await r.json();
                            setForm(prev => ({ ...prev, endereco: d.display_name || '' }));
                        }
                    } catch (err) {
                        console.error(err);
                    }
                });

                setMapaLeaflet(map);
                setMarcadorMapa(marker);
            }, 350);
        };

        if (!window.L) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(link);

            const script = document.createElement('script');
            script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            script.onload = iniciarInstanciaMapa;
            document.body.appendChild(script);
        } else {
            iniciarInstanciaMapa();
        }
    }, [modalLocalAberto]);

    const buscarCidadeNoMapa = async () => {
        if (!pesquisaCidade.trim()) return;
        try {
            const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(pesquisaCidade)}`);
            if (r.ok) {
                const dados = await r.json();
                if (dados && dados.length > 0) {
                    const { lat, lon, display_name } = dados[0];
                    const latNum = parseFloat(lat);
                    const lngNum = parseFloat(lon);

                    if (mapaLeaflet) {
                        mapaLeaflet.flyTo([latNum, lngNum], 15);
                        let m = marcadorMapa;
                        if (m) {
                            m.setLatLng([latNum, lngNum]);
                        } else {
                            m = window.L.marker([latNum, lngNum]).addTo(mapaLeaflet);
                            setMarcadorMapa(m);
                        }
                        setForm(prev => ({
                            ...prev,
                            latitude: latNum.toFixed(8),
                            longitude: lngNum.toFixed(8),
                            endereco: display_name || ''
                        }));
                    }
                } else {
                    alert('Nenhum local localizado com este nome.');
                }
            }
        } catch (e) {
            console.error(e);
        }
    };

    const mudarAbaNavegacao = (novaAba) => {
        setView(novaAba);
        setSelecionado(null);
        setForm({});
        setErro('');
    };

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
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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
            let url = `${API_URL}/api/v2/admin-exclusivo/relatorio-integrated?data_inicio=${dataInicio}&data_fim=${dataFim}`;
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

    const lidarComPublicoCheckbox = (id) => {
        if (publicosSelecionados.includes(id)) {
            setPublicosSelecionados(publicosSelecionados.filter(pId => pId !== id));
        } else {
            setPublicosSelecionados([...publicosSelecionados, id]);
        }
    };

    const submeterNovoEvento = async (e) => {
        e.preventDefault();
        try {
            if (publicosSelecionados.length === 0) {
                alert('Selecione pelo menos um Público-Alvo.');
                return;
            }
            const s1 = form.setor_id_1;
            const s2 = form.setor_id_2;
            const s3 = form.setor_id_3;
            if ((s1 && (s1 === s2 || s1 === s3)) || (s2 && s2 === s3)) {
                alert('Não selecione setores duplicados.');
                return;
            }
            const res = await fetch(`${API_URL}/api/v2/admin-exclusivo/eventos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ ...form, publicos: publicosSelecionados })
            });
            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error || 'Erro ao salvar.');
            }
            setModalEventoAberto(false);
            setForm({});
            setPublicosSelecionados([]);
            executarListagem();
        } catch (err) {
            alert(err.message);
        }
    };

    const submeterLocalExclusivo = async (e) => {
        e.preventDefault();
        if (!form.nome || !form.endereco || !form.latitude || !form.longitude) {
            return alert('Por favor, defina o nome do espaço e marque a localização no mapa.');
        }
        try {
            const urlFinal = isEditando ? `${API_URL}/api/v2/admin-exclusivo/locais/${selecionado.id}` : `${API_URL}/api/v2/admin-exclusivo/locais`;
            const metodo = isEditando ? 'PUT' : 'POST';

            const res = await fetch(urlFinal, {
                method: metodo,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(form)
            });
            if (!res.ok) throw new Error('Não foi possível gravar o local.');
            setModalLocalAberto(false);
            setForm({});
            setSelecionado(null);
            setPesquisaCidade('');
            executarListagem();
        } catch (err) {
            alert(err.message);
        }
    };

    const processarSaidaManualAdmin = async () => {
        if (!horaSaidaManualInput) return alert('Por favor, informe o horário de saída.');
        try {
            const res = await fetch(`${API_URL}/api/v2/admin-exclusivo/frequencias/saida-manual`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ frequencia_id: selecionado.id, hora_saida: horaSaidaManualInput })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro operational.');
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
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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
                alert('Sua senha de operador foi updated.');
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
        if (view === 'participantes') {
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
                    <p style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', marginBottom: '20px' }}>Por medidas de segurança, deve atualizar a sua senha de primeiro acesso.</p>
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
                    <li><button onClick={() => mudarAbaNavegacao('eventos')} style={view === 'eventos' ? estilos.btnMenuAtivo : estilos.btnMenu}>📅 Formações</button></li>
                    <li><button onClick={() => mudarAbaNavegacao('locais')} style={view === 'locais' ? estilos.btnMenuAtivo : estilos.btnMenu}>📍 Locais</button></li>
                    <li><button onClick={() => mudarAbaNavegacao('participantes')} style={view === 'participantes' ? estilos.btnMenuAtivo : estilos.btnMenu}>👥 Participantes</button></li>
                    <li><button onClick={() => mudarAbaNavegacao('frequencias')} style={view === 'frequencias' ? estilos.btnMenuAtivo : estilos.btnMenu}>📝 Histórico</button></li>
                    <li><button onClick={() => mudarAbaNavegacao('pesquisa-satisfacao')} style={view === 'pesquisa-satisfacao' ? estilos.btnMenuAtivo : estilos.btnMenu}>⭐ Pesquisa de Opinião</button></li>
                    <li><button onClick={() => mudarAbaNavegacao('publico-alvo')} style={view === 'publico-alvo' ? estilos.btnMenuAtivo : estilos.btnMenu}>🎯 Público-Alvo</button></li>
                    <li><button onClick={() => mudarAbaNavegacao('setores')} style={view === 'setores' ? estilos.btnMenuAtivo : estilos.btnMenu}>🏢 Setores</button></li>
                    <li><button onClick={() => mudarAbaNavegacao('areas')} style={view === 'areas' ? estilos.btnMenuAtivo : estilos.btnMenu}>📖 Áreas</button></li>
                    <li><button onClick={() => mudarAbaNavegacao('usuarios')} style={view === 'usuarios' ? estilos.btnMenuAtivo : estilos.btnMenu}>🔒 Operadores</button></li>
                    <li><button onClick={() => mudarAbaNavegacao('log-fraudes')} style={view === 'log-fraudes' ? estilos.btnMenuAtivo : estilos.btnMenu}>⚠️ Log de Fraudes</button></li>
                </ul>
                <button onClick={efetuarLogout} style={{ ...estilos.btnMenu, color: '#ef4444', marginTop: 'auto', fontWeight: 'bold' }}>🚪 Encerrar Sessão</button>
            </div>

            <div style={estilos.main}>
                <div style={estilos.topo}>
                    <h1 style={{ margin: 0, fontSize: '20px', color: '#1e293b', fontWeight: 'bold', textTransform: 'uppercase' }}>Visualizando: {view}</h1>
                    
                    {view === 'eventos' && (
                        <button onClick={() => { setForm({}); setPublicosSelecionados([]); setModalEventoAberto(true); }} style={estilos.btnAdicionar}>
                            ADICIONAR NOVO EVENTO
                        </button>
                    )}

                    {view === 'locais' && (
                        <div style={{ display: 'flex', gap: '10px', position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
                            <button 
                                onClick={() => { setForm({}); setIsEditando(false); setPesquisaCidade(''); setModalLocalAberto(true); }} 
                                style={{ ...estilos.btnAcao, backgroundColor: '#16a34a', color: '#fff', padding: '8px 16px', fontWeight: 'bold', borderRadius: '6px' }}
                            >
                                ➕ ADICIONAR LOCAL
                            </button>
                            <button 
                                onClick={() => {
                                    if(!selecionado) return;
                                    setForm({ nome: selecionado.nome, endereco: selecionado.endereco, latitude: selecionado.latitude, longitude: selecionado.longitude });
                                    setIsEditando(true);
                                    setPesquisaCidade('');
                                    setModalLocalAberto(true);
                                }} 
                                disabled={!selecionado}
                                style={{ 
                                    ...estilos.btnAcao, 
                                    backgroundColor: selecionado ? '#0284c7' : '#cbd5e1', 
                                    color: '#fff', 
                                    padding: '8px 16px', 
                                    fontWeight: 'bold', 
                                    borderRadius: '6px',
                                    cursor: selecionado ? 'pointer' : 'not-allowed'
                                }}
                            >
                                ✏️ EDITAR LOCAL
                            </button>
                        </div>
                    )}

                    <div style={{ fontSize: '13px', color: '#64748b' }}>Registros carregados: <strong>{totaisSuperior}</strong></div>
                </div>

                {modalEventoAberto && (
                    <div style={estilos.modalOverlay}>
                        <div style={estilos.modalGlass}>
                            <h2 style={{ margin: '0 0 20px 0', color: '#0f172a', fontSize: '18px', fontWeight: 'bold' }}>Cadastrar Nova Formação</h2>
                            <form onSubmit={submeterNovoEvento}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px' }}>Título do Evento</label>
                                        <input type="text" style={estilos.entradaForm} value={form.titulo || ''} onChange={e => setForm({...form, titulo: e.target.value})} required />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px' }}>Palestrante / Facilitador</label>
                                        <input type="text" style={estilos.entradaForm} value={form.palestrante || ''} onChange={e => setForm({...form, palestrante: e.target.value})} required />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '15px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px' }}>Data do Evento</label>
                                        <input type="date" style={estilos.entradaForm} value={form.data_evento || ''} onChange={e => setForm({...form, data_evento: e.target.value})} required />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px' }}>Hora de Início</label>
                                        <input type="time" style={estilos.entradaForm} value={form.hora_inicio || ''} onChange={e => setForm({...form, hora_inicio: e.target.value})} required />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px' }}>Hora de Término</label>
                                        <input type="time" style={estilos.entradaForm} value={form.hora_fim || ''} onChange={e => setForm({...form, hora_fim: e.target.value})} required />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px' }}>Carga Horária (Ex: 2.50)</label>
                                        <input type="number" step="0.01" style={estilos.entradaForm} value={form.carga_horaria || ''} onChange={e => setForm({...form, carga_horaria: e.target.value})} required />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px' }}>Local da Formação</label>
                                        <select style={estilos.entradaForm} value={form.local_id || ''} onChange={e => {
                                            const localEscolhido = combos.locais.find(l => l.id === parseInt(e.target.value));
                                            setForm({
                                                ...form,
                                                local_id: e.target.value,
                                                local: localEscolhido ? localEscolhido.nome : '',
                                                endereco: localEscolhido ? localEscolhido.endereco : '',
                                                latitude: localEscolhido ? localEscolhido.latitude : '',
                                                longitude: localEscolhido ? localEscolhido.longitude : ''
                                            });
                                        }} required>
                                            <option value="">Selecione um local...</option>
                                            {combos.locais.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '5px' }}>Setor Obrigatório 1</label>
                                        <select style={estilos.entradaForm} value={form.setor_id_1 || ''} onChange={e => setForm({...form, setor_id_1: e.target.value})} required>
                                            <option value="">Selecione...</option>
                                            {combos.setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '5px' }}>Setor Opcional 2</label>
                                        <select style={estilos.entradaForm} value={form.setor_id_2 || ''} onChange={e => setForm({...form, setor_id_2: e.target.value})}>
                                            <option value="">Nenhum</option>
                                            {combos.setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '5px' }}>Setor Opcional 3</label>
                                        <select style={estilos.entradaForm} value={form.setor_id_3 || ''} onChange={e => setForm({...form, setor_id_3: e.target.value})}>
                                            <option value="">Nenhum</option>
                                            {combos.setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div style={{ marginBottom: '15px' }}>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px' }}>Área do Conhecimento</label>
                                    <select style={estilos.entradaForm} value={form.area_id || ''} onChange={e => setForm({...form, area_id: e.target.value})} required>
                                        <option value="">Selecione uma área...</option>
                                        {combos.areas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                                    </select>
                                </div>

                                <div style={{ marginBottom: '20px', backgroundColor: 'rgba(255,255,255,0.4)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.05)' }}>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: '#1e293b' }}>Selecione os Públicos-Alvo Elegíveis:</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', maxHeight: '120px', overflowY: 'auto', paddingRight: '5px' }}>
                                        {combos.publicos.map(p => (
                                            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                                                <input type="checkbox" checked={Array.isArray(publicosSelecionados) && publicosSelecionados.includes(p.id)} onChange={() => lidarComPublicoCheckbox(p.id)} />
                                                {p.nome}
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                    <button type="button" onClick={() => setModalEventoAberto(false)} style={{ ...estilos.btnAcao, backgroundColor: '#64748b', color: '#fff' }}>CANCELAR</button>
                                    <button type="submit" style={{ ...estilos.btnAcao, backgroundColor: '#16a34a', color: '#fff' }}>SALVAR EVENTO</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {modalLocalAberto && (
                    <div style={estilos.modalOverlay}>
                        <div style={estilos.modalGlass}>
                            <h2 style={{ margin: '0 0 20px 0', color: '#0f172a', fontSize: '18px', fontWeight: 'bold' }}>
                                {isEditando ? '✏️ Modificar Dados do Local' : '➕ Adicionar Novo Local no Mapa'}
                            </h2>
                            <form onSubmit={submeterLocalExclusivo}>
                                <div style={{ marginBottom: '15px' }}>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px' }}>Nome do Espaço / Local</label>
                                    <input type="text" style={estilos.entradaForm} value={form.nome || ''} onChange={e => setForm({...form, nome: e.target.value})} required />
                                </div>

                                {!isEditando && (
                                    <div style={{ marginBottom: '15px', backgroundColor: 'rgba(2, 132, 199, 0.05)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(2, 132, 199, 0.1)' }}>
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px', color: '#0284c7' }}>🔍 Buscar Endereço ou Referência:</label>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <input 
                                                type="text" 
                                                placeholder="Ex: Praça Nossa Senhora da Conceição, Queimados" 
                                                style={estilos.entradaForm} 
                                                value={pesquisaCidade} 
                                                onChange={e => setPesquisaCidade(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), buscarCidadeNoMapa())}
                                            />
                                            <button type="button" onClick={buscarCidadeNoMapa} style={{ ...estilos.btnAcao, backgroundColor: '#0284c7', color: '#fff', fontWeight: 'bold', padding: '0 15px' }}>BUSCAR</button>
                                        </div>
                                    </div>
                                )}

                                <div style={{ marginBottom: '15px' }}>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px' }}>📍 Clique no Mapa para marcar o ponto:</label>
                                    <div id="mapa-leaflet" style={{ width: '100%', height: '260px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '10px', zIndex: 1 }}></div>
                                </div>

                                <div style={{ marginBottom: '15px' }}>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px' }}>Endereço Completo (Preenchido pelo Mapa ou Manual)</label>
                                    <textarea style={{ ...estilos.entradaForm, height: '55px', resize: 'none' }} value={form.endereco || ''} onChange={e => setForm({...form, endereco: e.target.value})} required />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px' }}>Latitude</label>
                                        <input type="text" style={estilos.entradaForm} value={form.latitude || ''} onChange={e => setForm({...form, latitude: e.target.value})} placeholder="Clique no mapa..." required />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px' }}>Longitude</label>
                                        <input type="text" style={estilos.entradaForm} value={form.longitude || ''} onChange={e => setForm({...form, longitude: e.target.value})} placeholder="Clique no mapa..." required />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                    <button type="button" onClick={() => { setModalLocalAberto(false); setForm({}); setPesquisaCidade(''); }} style={{ ...estilos.btnAcao, backgroundColor: '#64748b', color: '#fff' }}>CANCELAR</button>
                                    <button type="submit" style={{ ...estilos.btnAcao, backgroundColor: '#16a34a', color: '#fff', fontWeight: 'bold' }}>SALVAR REGISTRO</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

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
                                        onClick={() => (view === 'frequencias' || view === 'locais') && setSelecionado(item)}
                                        onMouseEnter={() => possuiComentario && setHoveredRowId(item.id)}
                                        onMouseLeave={() => possuiComentario && setHoveredRowId(null)}
                                        style={{ 
                                            cursor: (view === 'frequencias' || view === 'locais') ? 'pointer' : 'default',
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
                                                    <button onClick={(e) => { e.stopPropagation(); iniciarEdicaoItem(item); setModalEventoAberto(false); }} style={{ ...estilos.btnAcao, backgroundColor: '#0284c7', color: '#fff' }}>Editar</button>
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