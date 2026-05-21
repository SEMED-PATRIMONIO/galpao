import React, { useState, useEffect } from 'react';

export default function App() {
    const obterParticipanteSeguro = () => {
        try {
            const dadosSalvos = localStorage.getItem('prof_dados');
            if (!dadosSalvos) return null;
            return JSON.parse(dadosSalvos);
        } catch (e) {
            localStorage.removeItem('prof_dados');
            return null;
        }
    };

    const [view, setView] = useState('identificacao');
    const [professor, setProfessor] = useState(obterParticipanteSeguro());
    const [deviceToken, setDeviceToken] = useState(localStorage.getItem('device_token') || null);
    
    const [matriculaInput, setMatriculaInput] = useState('');
    const [nomeInput, setNomeInput] = useState('');
    
    const [multiplosEventos, setMultiplosEventos] = useState([]);
    const [fluxoSaida, setFluxoSaida] = useState(null);
    const [estrelasPesquisa, setEstrelasPesquisa] = useState(5);
    const [comentarioPesquisa, setComentarioPesquisa] = useState('');
    
    const [coords, setCoords] = useState({ lat: null, lng: null });
    const [msgErro, setMsgErro] = useState('');
    const [msgSucesso, setMsgSucesso] = useState('');

    // Novos estados para a mecânica de câmera fake e painel de confirmação
    const [confirmarEntradaDados, setConfirmarEntradaDados] = useState(null);
    const [cameraAtiva, setCameraAtiva] = useState(false);
    const [carregandoLente, setCarregandoLente] = useState(false);

    useEffect(() => {
        navigator.geolocation.getCurrentPosition(
            (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => setMsgErro('Acesso à geolocalização negado ou indisponível.')
        );
        verificarStatusAparelho();
    }, []);

    const API_URL = 'https://qrcode.paiva.api.br';

    const verificarStatusAparelho = async () => {
        if (!deviceToken) return;
        try {
            const res = await fetch(`${API_URL}/api/v2/dispositivo/status?device_token=${deviceToken}`);
            const data = await res.json();
            if (data.atribuido) {
                setProfessor(data.participante);
                localStorage.setItem('prof_dados', JSON.stringify(data.participante));
                setView('painel-presenca');
            } else {
                lidarComLimpezaGeral();
            }
        } catch (err) {
            setMsgErro('Erro ao validar status do aparelho.');
        }
    };

    const vincularAparelho = async (e) => {
        e.preventDefault();
        try {
            setMsgErro('');
            const res = await fetch(`${API_URL}/api/v2/dispositivo/associar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ matricula: matriculaInput, nome: nomeInput, device_token: deviceToken })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            
            localStorage.setItem('device_token', data.device_token);
            localStorage.setItem('prof_dados', JSON.stringify(data.participante));
            setDeviceToken(data.device_token);
            setProfessor(data.participante);
            setView('painel-presenca');
            setMsgSucesso('Aparelho associado com sucesso!');
            setTimeout(() => setMsgSucesso(''), 5000);
        } catch (err) {
            setMsgErro(err.message);
        }
    };

    // FUNÇÃO REESTRUTURADA PARA A NOVA TRIAGEM INTELIGENTE
    const dispararRegistroPresenca = () => {
        if (!coords.lat || !coords.lng) {
            setMsgErro('Aguardando capturar sua localização exata. Ative o GPS e tente de novo.');
            return;
        }
        setMsgErro('');
        setMsgSucesso('');

        navigator.geolocation.getCurrentPosition(async (pos) => {
            try {
                const res = await fetch(`${API_URL}/api/v2/presenca/registrar`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ device_token: deviceToken, latitude: pos.coords.latitude, longitude: pos.coords.longitude })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);

                // Caso 1: Há mais de 1 evento próximo
                if (data.multiplos_eventos) {
                    setMultiplosEventos(data.eventos);
                    return;
                }

                // Caso 2: Fluxo de Saída com Pesquisa obrigatória
                if (data.requere_pesquisa) {
                    setFluxoSaida({ tipo: 'pesquisa', frequencia_id: data.frequencia_id, evento_id: data.evento_id, titulo: data.evento_titulo });
                    return;
                }

                // Caso 3: Apenas 1 evento elegível - Direciona para a tela de confirmação e Câmera Fake
                if (data.confirmar_entrada) {
                    setConfirmarEntradaDados(data.evento);
                    return;
                }
                
            } catch (err) {
                setMsgErro(err.message);
            }
        });
    };

    // EXECUÇÃO DA CÂMERA FAKE POR 4 SEGUNDOS ANTES DE INSERIR NO BANCO
    const executarEfeitoCameraEConfirmar = (eventoId) => {
        setCarregandoLente(true);
        setCameraAtiva(true);

        setTimeout(async () => {
            let localStream = null;
            try {
                // Abre o stream real da webcam nativa do celular para causar impacto visual real
                localStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
                const videoComponent = document.getElementById('visorCameraWeb');
                if (videoComponent) videoComponent.srcObject = localStream;
                setCarregandoLente(false);
            } catch (err) {
                // Fallback caso a permissão seja negada
                setCarregandoLente(false);
            }

            // Cronômetro psicológico de 4 segundos cravados
            setTimeout(async () => {
                if (localStream) {
                    localStream.getTracks().forEach(track => track.stop()); // Desliga o hardware da câmera fisicamente
                }
                setCameraAtiva(false);
                setConfirmarEntradaDados(null);
                setMultiplosEventos([]);

                // Registra de fato no banco de dados após a conferência visual
                try {
                    const res = await fetch(`${API_URL}/api/v2/presenca/registrar-especifico`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ device_token: deviceToken, evento_id: eventoId })
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error);
                    setMsgSucesso(data.mensagem);
                    setTimeout(() => setMsgSucesso(''), 5000);
                } catch (err) {
                    setMsgErro(err.message);
                }
            }, 4000);

        }, 500);
    };

    // GRAVAÇÃO DA SAÍDA COM AVALIAÇÃO DE ESTRELAS
    const processarSaidaDefinitiva = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_URL}/api/v2/presenca/concluir-saida`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    frequencia_id: fluxoSaida.frequencia_id,
                    evento_id: fluxoSaida.evento_id,
                    estrelas: estrelasPesquisa,
                    comentario: comentarioPesquisa,
                    device_token: deviceToken
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            
            setMsgSucesso(data.mensagem);
            setFluxoSaida(null);
            setComentarioPesquisa('');
            setEstrelasPesquisa(5);
            setTimeout(() => setMsgSucesso(''), 5000);
        } catch (err) {
            setMsgErro(err.message);
        }
    };

    const lidarComLimpezaGeral = () => {
        localStorage.removeItem('prof_dados');
        localStorage.removeItem('device_token');
        setProfessor(null);
        setDeviceToken(null);
        setView('identificacao');
        setMultiplosEventos([]);
        setFluxoSaida(null);
        setConfirmarEntradaDados(null);
        setCameraAtiva(false);
    };

    return (
        <div style={estilos.containerMobile}>
            <div style={estilos.wrapperMobile}>
                <div style={estilos.marcaTopMobile}>qrcode.paiva.api.br</div>
                
                {msgErro && <div style={estilos.alertaErroMobile}>{msgErro}</div>}
                {msgSucesso && <div style={estilos.alertaSucessoMobile}>{msgSucesso}</div>}

                {view === 'identificacao' && (
                    <form onSubmit={vincularAparelho} style={estilos.formMobile}>
                        <h2 style={estilos.tituloSessaoMobile}>Vincular Dispositivo</h2>
                        <p style={estilos.subtituloMobile}>Cadastre seu dispositivo para liberação de registros automáticos.</p>
                        <input type="text" placeholder="Digite sua matrícula" style={estilos.inputMobile} value={matriculaInput} onChange={e => setMatriculaInput(e.target.value)} required />
                        <input type="text" placeholder="Nome Completo" style={estilos.inputMobile} value={nomeInput} onChange={e => setNomeInput(e.target.value)} required />
                        <button type="submit" style={estilos.btnAcaoMobile}>VINCULAR MEU DISPOSITIVO</button>
                    </form>
                )}

                {view === 'painel-presenca' && (
                    <div style={{ textAlign: 'center' }}>
                        <div style={estilos.caixaInfoProfessor}>
                            <h3 style={{ margin: 0, color: '#1e3a8a' }}>{professor?.nome_completo}</h3>
                            <span style={{ fontSize: 13, color: '#64748b' }}>Matrícula vinculada: {professor?.matricula}</span>
                        </div>

                        {/* TELA DE ANIMAÇÃO DA CÂMERA FAKE */}
                        {cameraAtiva && (
                            <div style={{ backgroundColor: '#000', borderRadius: '12px', padding: '15px', margin: '20px 0', position: 'relative' }}>
                                <div style={{ color: '#00ff00', fontSize: '11px', fontWeight: 'bold', marginBottom: '10px', letterSpacing: '0.5px' }}>
                                    {carregandoLente ? '🔍 PROCESSANDO LENTE BIOMÉTRICA...' : '⚡ ESCANEANDO GEOMETRIA FACIAL...'}
                                </div>
                                <div style={{ width: '100%', height: '200px', backgroundColor: '#111', borderRadius: '8px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {carregandoLente ? (
                                        <span style={{ color: '#fff', fontSize: '12px' }}>Ajustando foco...</span>
                                    ) : (
                                        <video id="visorCameraWeb" autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    )}
                                </div>
                                <div style={{ position: 'absolute', top: '25px', right: '25px', width: '10px', height: '10px', backgroundColor: '#ff0000', borderRadius: '50%' }} />
                            </div>
                        )}

                        {/* INTERFACE DE CONFIRMAÇÃO DO PRODUTO DO EVENTO ÚNICO ENCONTRADO */}
                        {!cameraAtiva && confirmarEntradaDados && (
                            <div style={{ border: '1px solid #bae6fd', backgroundColor: '#f0f9ff', padding: '20px', borderRadius: '12px', marginTop: '15px', textAlign: 'left' }}>
                                <h4 style={{ margin: '0 0 5px 0', color: '#0369a1' }}>Confirmar Entrada</h4>
                                <p style={{ fontSize: '14px', margin: '5px 0', color: '#1e293b' }}>Formação: <strong>{confirmarEntradaDados.titulo}</strong></p>
                                <p style={{ fontSize: '12px', margin: '0 0 15px 0', color: '#64748b' }}>Local: {confirmarEntradaDados.local}</p>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button onClick={() => setConfirmarEntradaDados(null)} style={{ flex: 1, padding: '10px', backgroundColor: '#94a3b8', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>Cancelar</button>
                                    <button onClick={() => executarEfeitoCameraEConfirmar(confirmarEntradaDados.id)} style={{ flex: 2, padding: '10px', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>Confirmar e Entrar</button>
                                </div>
                            </div>
                        )}

                        {/* SELEÇÃO SE HOUVER VÁRIOS EVENTOS NO RAIO */}
                        {!cameraAtiva && !confirmarEntradaDados && multiplosEventos.length > 0 && (
                            <div style={estilos.caixaDilemaEventos}>
                                <h4 style={{ margin: '0 0 10px 0', color: '#b45309' }}>Mais de um evento próximo encontrado!</h4>
                                <p style={{ fontSize: 12, color: '#64748b' }}>Selecione em qual formação deseja registrar presença:</p>
                                {multiplosEventos.map(ev => (
                                    <button key={ev.id} onClick={() => setConfirmarEntradaDados(ev)} style={estilos.btnOpcaoEvento}>
                                        📍 {ev.titulo} <span style={{ display: 'block', fontSize: '10px', fontWeight: 'normal', color: '#64748b' }}>Local: {ev.local}</span>
                                    </button>
                                ))}
                                <button onClick={() => setMultiplosEventos([])} style={{ width: '100%', background: 'none', border: 'none', color: '#475569', fontSize: '12px', marginTop: '10px', cursor: 'pointer', textDecoration: 'underline' }}>Voltar</button>
                            </div>
                        )}

                        {/* FLUXO PRINCIPAL DO BOTÃO RADAR (Escondido se estiver avaliando ou confirmando) */}
                        {!cameraAtiva && !confirmarEntradaDados && multiplosEventos.length === 0 && !fluxoSaida && (
                            <div style={{ marginTop: 30 }}>
                                <div style={estilos.circuloRadar} onClick={dispararRegistroPresenca}>
                                    <span style={{ fontSize: 26 }}>📡</span>
                                    <span style={{ fontSize: 11, fontWeight: 'bold', marginTop: 4 }}>BATER PRESENÇA</span>
                                </div>
                                <p style={{ fontSize: 12, color: '#64748b', marginTop: 15 }}>O sistema validará o raio de 60 metros da sua localização.</p>
                                <button onClick={lidarComLimpezaGeral} style={estilos.btnLinkDesvincular}>Desvincular Dispositivo</button>
                            </div>
                        )}

                        {/* PAINEL DE PESQUISA DE SATISFAÇÃO (FLUXO DE SAÍDA) */}
                        {!cameraAtiva && fluxoSaida && (
                            <form onSubmit={processarSaidaDefinitiva} style={estilos.formMobile}>
                                <h3 style={{ color: '#1e3a8a', margin: '0 0 5px 0' }}>Pesquisa de Opinião</h3>
                                <p style={{ fontSize: 13, color: '#475569', marginBottom: '10px' }}>Avalie a formação "{fluxoSaida.titulo}" antes de concluir sua saída:</p>
                                
                                <select style={estilos.inputMobile} value={estrelasPesquisa} onChange={e => setEstrelasPesquisa(Number(e.target.value))}>
                                    <option value="5">⭐⭐⭐⭐⭐ (Excelente)</option>
                                    <option value="4">⭐⭐⭐⭐ (Muito Bom)</option>
                                    <option value="3">⭐⭐⭐ (Regular)</option>
                                    <option value="2">⭐⭐ (Ruim)</option>
                                    <option value="1">⭐ (Péssimo)</option>
                                </select>
                                
                                <textarea placeholder="Deixe um comentário, crítica ou sugestão (Opcional)" rows="3" style={estilos.inputMobile} value={comentarioPesquisa} onChange={e => setComentarioPesquisa(e.target.value)}></textarea>
                                
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button type="button" onClick={() => setFluxoSaida(null)} style={{ flex: 1, padding: '12px', backgroundColor: '#94a3b8', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>Voltar</button>
                                    <button type="submit" style={{ flex: 2, ...estilos.btnAcaoMobile, margin: 0 }}>GRAVAR MINHA SAÍDA</button>
                                </div>
                            </form>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

const estilos = {
    containerMobile: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f1f5f9', padding: '15px' },
    wrapperMobile: { backgroundColor: '#fff', width: '100%', maxWidth: '420px', borderRadius: '16px', padding: '25px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', boxSizing: 'border-box' },
    marcaTopMobile: { fontSize: '18px', fontWeight: '800', color: '#1e3a8a', textAlign: 'center', marginBottom: '25px', letterSpacing: '-0.5px' },
    tituloSessaoMobile: { fontSize: '18px', color: '#1e293b', margin: '0 0 5px 0', textAlign: 'center' },
    subtituloMobile: { fontSize: '13px', color: '#64748b', textAlign: 'center', margin: '0 0 20px 0' },
    formMobile: { display: 'flex', flexDirection: 'column', gap: '12px' },
    inputMobile: { padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', width: '100%', boxSizing: 'border-box' },
    btnAcaoMobile: { backgroundColor: '#1e3a8a', color: '#fff', border: 'none', padding: '14px', borderRadius: '8px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', transition: 'background 0.2s' },
    alertaErroMobile: { backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '12px', borderRadius: '8px', fontSize: '13px', marginBottom: '15px', textAlign: 'center' },
    alertaSucessoMobile: { backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '12px', borderRadius: '8px', fontSize: '13px', marginBottom: '15px', textAlign: 'center' },
    caixaInfoProfessor: { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '15px', marginBottom: '20px' },
    circuloRadar: { width: '140px', height: '140px', borderRadius: '50%', backgroundColor: '#e0f2fe', border: '4px solid #bae6fd', color: '#0369a1', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', margin: '30px auto 0 auto', cursor: 'pointer', boxShadow: '0 10px 15px -3px rgba(3,105,161,0.2)' },
    btnLinkDesvincular: { background: 'none', border: 'none', color: '#94a3b8', textDecoration: 'underline', fontSize: '12px', marginTop: '30px', cursor: 'pointer' },
    caixaDilemaEventos: { border: '1px solid #fef08a', backgroundColor: '#fefce8', padding: '15px', borderRadius: '12px', marginBottom: '20px', textAlign: 'left' },
    btnOpcaoEvento: { width: '100%', padding: '12px', border: '1px solid #cbd5e1', backgroundColor: '#fff', borderRadius: '6px', fontSize: '13px', fontWeight: '600', color: '#1e293b', marginBottom: '6px', textAlign: 'left', cursor: 'pointer' }
};