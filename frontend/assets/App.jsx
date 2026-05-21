import React, { useState, useEffect } from 'react';

export default function PortalProfessor() {
    const [statusFluxo, setStatusFluxo] = useState('carregando'); // carregando | erro | multiplos | entrada | pesquisa | concluido
    const [eventoAtual, setEventoAtual] = useState(null);
    const [listaEventos, setListaEventos] = useState([]);
    const [alertaMsg, setAlertaMsg] = useState('');
    const [coords, setCoords] = useState({ lat: null, lng: null });

    // Estado do formulário de avaliação
    const [avaliacao, setAvaliacao] = useState('Ótimo');
    const [comentarios, setComentarios] = useState('');

    // Captura coordenadas iniciais ao carregar a tela
    useEffect(() => {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const localCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setCoords(localCoords);
                dispararChecagem(localCoords, null);
            },
            () => {
                exibirAlertaTemporizado('Por favor, ative a localização no seu dispositivo para registrar presença.');
                setStatusFluxo('erro');
            }
        );
    }, []);

    // Helper para exibir alertas por 8 segundos e resetar/encerrar a sessão
    const exibirAlertaTemporizado = (msg, fluxoFinal = 'erro') => {
        setAlertaMsg(msg);
        setStatusFluxo('alerta_ativo');
        setTimeout(() => {
            setAlertaMsg('');
            setStatusFluxo(fluxoFinal);
            // Se for erro ou concluído, você pode redirecionar ou limpar o estado aqui
        }, 8000);
    };

    // Comunicação com a API
    const dispararChecagem = async (localCoords, idEventoSelecionado) => {
        try {
            const token = localStorage.getItem('token'); // Ajuste conforme seu armazenamento de auth
            const res = await fetch('/api/portal-professor/validar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    action: 'checar',
                    lat: localCoords.lat,
                    lng: localCoords.lng,
                    evento_id: idEventoSelecionado
                })
            });

            const dados = await res.json();

            if (dados.status === 'erro') {
                exibirAlertaTemporizado(dados.mensagem, 'erro');
            } else if (dados.status === 'ja_registrado') {
                exibirAlertaTemporizado(dados.mensagem, 'concluido');
            } else if (dados.status === 'multiplos_eventos') {
                setListaEventos(dados.eventos);
                setStatusFluxo('multiplos');
            } else if (dados.status === 'confirmar_entrada') {
                setEventoAtual(dados.evento);
                setStatusFluxo('entrada');
            } else if (dados.status === 'necessita_saida') {
                setEventoAtual(dados.evento);
                setStatusFluxo('pesquisa');
            }
        } catch (err) {
            exibirAlertaTemporizado('Falha ao conectar com o servidor do portal.', 'erro');
        }
    };

    const confirmarEntrada = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/portal-professor/validar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    action: 'confirmar_entrada',
                    evento_id: eventoAtual.id,
                    lat: coords.lat,
                    lng: coords.lng
                })
            });
            const dados = await res.json();
            if (dados.status === 'sucesso') {
                exibirAlertaTemporizado('REGISTRO EFETUADO!', 'concluido');
            }
        } catch (err) {
            exibirAlertaTemporizado('Erro ao salvar sua entrada.', 'erro');
        }
    };

    const enviarPesquisaSaida = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/portal-professor/validar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    action: 'registrar_saida',
                    evento_id: eventoAtual.id,
                    lat: coords.lat,
                    lng: coords.lng,
                    avaliacao,
                    comentarios
                })
            });
            const dados = await res.json();
            exibirAlertaTemporizado('REGISTRO EFETUADO!', 'concluido');
        } catch (err) {
            exibirAlertaTemporizado('Erro ao salvar sua saída e avaliação.', 'erro');
        }
    };

    // Estilização Intuitiva em Objetos de Configuração
    const estilos = {
        container: { padding: '20px', maxWidth: '500px', margin: '0 auto', fontFamily: 'Arial, sans-serif', color: '#334155' },
        card: { border: '1px solid #e2e8f0', padding: '20px', borderRadius: '12px', backgroundColor: '#ffffff', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', textAlign: 'center' },
        titulo: { fontSize: '18px', fontWeight: 'bold', marginBottom: '10px', color: '#1e293b' },
        subtitulo: { fontSize: '14px', color: '#64748b', marginBottom: '20px' },
        btnSucesso: { backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', width: '100%', marginTop: '15px' },
        btnItem: { backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', padding: '12px', margin: '8px 0', borderRadius: '8px', cursor: 'pointer', width: '100%', textAlign: 'left', display: 'block' },
        alerta: { position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#1e293b', color: '#fff', padding: '15px 30px', borderRadius: '30px', fontWeight: 'bold', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)', zIndex: 9999, width: '80%', maxWidth: '400px', textAlign: 'center' },
        select: { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '15px' },
        textarea: { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', height: '80px', marginBottom: '15px' }
    };

    return (
        <div style={estilos.container}>
            {/* Overlay de Alerta Flutuante Durando 8 Segundos */}
            {alertaMsg && (
                <div style={estilos.alerta}>
                    {alertaMsg}
                </div>
            )}

            {statusFluxo === 'carregando' && (
                <div style={estilos.card}>
                    <p style={estilos.titulo}>Buscando eventos presenciais...</p>
                    <p style={estilos.subtitulo}>Aguarde enquanto validamos suas credenciais e localização.</p>
                </div>
            )}

            {statusFluxo === 'alerta_ativo' && (
                <div style={estilos.card}>
                    <p style={estilos.subtitulo}>Aguardando confirmação do sistema...</p>
                </div>
            )}

            {statusFluxo === 'multiplos' && (
                <div style={estilos.card}>
                    <p style={estilos.titulo}>Selecione o Evento</p>
                    <p style={estilos.subtitulo}>Identificamos mais de uma atividade ocorrendo simultaneamente neste espaço:</p>
                    {listaEventos.map(evt => (
                        <button key={evt.id} style={estilos.btnItem} onClick={() => dispararChecagem(coords, evt.id)}>
                            <strong>{evt.titulo}</strong><br/>
                            <span style={{ fontSize: '12px', color: '#64748b' }}>Palestrante: {evt.palestrante}</span>
                        </button>
                    ))}
                </div>
            )}

            {statusFluxo === 'entrada' && eventoAtual && (
                <div style={estilos.card}>
                    <p style={{ ...estilos.titulo, color: '#2563eb' }}>Confirmar Entrada</p>
                    <p style={estilos.subtitulo}>Toque no botão abaixo para registrar seu início de presença na atividade elegível.</p>
                    <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '8px', textAlign: 'left', marginBottom: '15px' }}>
                        <h4 style={{ margin: '0 0 5px 0' }}>{eventoAtual.titulo}</h4>
                        <p style={{ margin: '0 0 5px 0', fontSize: '13px' }}><strong>Local:</strong> {eventoAtual.local}</p>
                        <p style={{ margin: '0', fontSize: '13px' }}><strong>Endereço:</strong> {eventoAtual.endereco}</p>
                    </div>
                    <button style={estilos.btnSucesso} onClick={confirmarEntrada}>
                        CONFIRMAR ENTRADA
                    </button>
                </div>
            )}

            {statusFluxo === 'pesquisa' && eventoAtual && (
                <div style={estilos.card}>
                    <p style={{ ...estilos.titulo, color: '#0d9488' }}>Pesquisa de Satisfação</p>
                    <p style={estilos.subtitulo}>Sua opinião é fundamental. Avalie o evento para validar o seu registro de saída.</p>
                    <form onSubmit={enviarPesquisaSaida} style={{ textAlign: 'left' }}>
                        <label style={{ fontWeight: 'bold', fontSize: '13px' }}>Como você avalia esta atividade?</label>
                        <select style={estilos.select} value={avaliacao} onChange={(e) => setAvaliacao(e.target.value)}>
                            <option value="Ótimo">Ótimo</option>
                            <option value="Muito Bom">Muito Bom</option>
                            <option value="Bom">Bom</option>
                            <option value="Regular">Regular</option>
                            <option value="Ruim">Ruim</option>
                        </select>

                        <label style={{ fontWeight: 'bold', fontSize: '13px' }}>Comentários adicionais (opcional):</label>
                        <textarea style={estilos.textarea} value={comentarios} onChange={(e) => setComentarios(e.target.value)} placeholder="Deixe sua sugestão ou elogio..." />

                        <button type="submit" style={estilos.btnSucesso}>
                            SALVAR AVALIAÇÃO E CONFIRMAR SAÍDA
                        </button>
                    </form>
                </div>
            )}

            {(statusFluxo === 'erro' || statusFluxo === 'concluido') && (
                <div style={estilos.card}>
                    <p style={estilos.titulo}>Portal do Professor</p>
                    <p style={estilos.subtitulo}>Acesso estabelecido com sucesso.</p>
                </div>
            )}
        </div>
    );
}

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

    useEffect(() => {
        navigator.geolocation.getCurrentPosition(
            (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => setMsgErro('Acesso à geolocalização negado ou indisponível.')
        );
        verificarStatusAparelho();
    }, []);

// Definição da URL oficial do seu backend para sincronização remota
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

    const dispararRegistroPresenca = () => {
        if (!coords.lat || !coords.lng) {
            setMsgErro('Aguardando capturar sua localização exata. Tente novamente.');
            return;
        }
        setMsgErro('');
        navigator.geolocation.getCurrentPosition(async (pos) => {
            try {
                const res = await fetch(`${API_URL}/api/v2/presenca/registrar`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ device_token: deviceToken, latitude: pos.coords.latitude, longitude: pos.coords.longitude })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);

                if (data.multiplos_eventos) {
                    setMultiplosEventos(data.eventos);
                    return;
                }
                if (data.requere_confirmacao_30min) {
                    setFluxoSaida({ tipo: 'precoce', frequencia_id: data.frequencia_id, titulo: data.evento_titulo });
                    return;
                }
                if (data.requere_pesquisa) {
                    setFluxoSaida({ tipo: 'pesquisa', frequencia_id: data.frequencia_id, evento_id: data.evento_id, titulo: data.evento_titulo, publico_alvo_id: data.publico_alvo_id });
                    return;
                }
                
                setMsgSucesso(data.mensagem);
                setTimeout(() => setMsgSucesso(''), 5000);
            } catch (err) {
                setMsgErro(err.message);
            }
        });
    };

    const registrarEventoEspecifico = async (eventoId) => {
        try {
            const res = await fetch(`${API_URL}/api/v2/presenca/registrar-especifico`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ device_token: deviceToken, evento_id: eventoId })
            });
            const data = await res.json();
            setMultiplosEventos([]);
            setMsgSucesso(data.mensagem);
            setTimeout(() => setMsgSucesso(''), 5000);
        } catch (err) {
            setMsgErro('Erro ao registrar no evento.');
        }
    };

    const processarSaidaPrecoce = async () => {
        try {
            const res = await fetch(`${API_URL}/api/v2/presenca/confirmar-saida-precoce`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ frequencia_id: fluxoSaida.frequencia_id, device_token: deviceToken })
            });
            const data = await res.json();
            setMsgSucesso(data.mensagem);
            setFluxoSaida(null);
            setTimeout(() => setMsgSucesso(''), 5000);
        } catch (err) {
            setMsgErro(err.message);
        }
    };

    const processarSaidaDefinitiva = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_URL}/api/v2/presenca/concluir-saida`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ frequencia_id: fluxoSaida.frequencia_id, evento_id: fluxoSaida.evento_id, estrelas: estrelasPesquisa, comentario: comentarioPesquisa, device_token: deviceToken, publico_alvo_id: fluxoSaida.publico_alvo_id })
            });
            const data = await res.json();
            setMsgSucesso(data.mensagem);
            setFluxoSaida(null);
            setComentarioPesquisa('');
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

                        {multiplosEventos.length > 0 && (
                            <div style={estilos.caixaDilemaEventos}>
                                <h4 style={{ margin: '0 0 10px 0', color: '#b45309' }}>Mais de um evento próximo encontrado!</h4>
                                <p style={{ fontSize: 12, color: '#64748b' }}>Selecione abaixo em qual formação deseja registrar presença:</p>
                                {multiplosEventos.map(ev => (
                                    <button key={ev.id} onClick={() => registrarEventoEspecifico(ev.id)} style={estilos.btnOpcaoEvento}>
                                        {ev.titulo}
                                    </button>
                                ))}
                            </div>
                        )}

                        {!fluxoSaida ? (
                            <div style={{ marginTop: 30 }}>
                                <div style={estilos.circuloRadar} onClick={dispararRegistroPresenca}>
                                    <span style={{ fontSize: 26 }}>📷</span>
                                    <span style={{ fontSize: 11, fontWeight: 'bold', marginTop: 4 }}>BATER PRESENÇA</span>
                                </div>
                                <p style={{ fontSize: 12, color: '#64748b', marginTop: 15 }}>Clique no botão acima para registrar Entrada ou Saída do evento local.</p>
                                <button onClick={lidarComLimpezaGeral} style={estilos.btnLinkDesvincular}>Desvincular Dispositivo</button>
                            </div>
                        ) : fluxoSaida.tipo === 'precoce' ? (
                            <div style={estilos.modalRetencao}>
                                <h3 style={{ color: '#b91c1c', margin: '0 0 10px 0' }}>Alerta de Permanência Mínima</h3>
                                <p style={{ fontSize: 14, color: '#7f1d1d' }}>Você possui menos de 30 minutos registrados na atividade "{fluxoSaida.titulo}". Se sair agora, sua presença neste evento será anulada. Confirma?</p>
                                <div style={{ display: 'flex', gap: 10, marginTop: 15 }}>
                                    <button onClick={processarSaidaPrecoce} style={estilos.btnConfirmarSaidaPrecoce}>CONFIRMAR SAÍDA</button>
                                    <button onClick={() => setFluxoSaida(null)} style={estilos.btnDesistirSaida}>VOLTAR AO EVENTO</button>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={processarSaidaDefinitiva} style={estilos.formMobile}>
                                <h3 style={{ color: '#1e3a8a', margin: '0 0 10px 0' }}>Pesquisa de Opinião</h3>
                                <p style={{ fontSize: 13, color: '#475569' }}>Avalie o evento "{fluxoSaida.titulo}" antes de concluir sua saída:</p>
                                <select style={estilos.inputMobile} value={estrelasPesquisa} onChange={e => setEstrelasPesquisa(Number(e.target.value))}>
                                    <option value="5">⭐⭐⭐⭐⭐ (Excelente)</option>
                                    <option value="4">⭐⭐⭐⭐ (Muito Bom)</option>
                                    <option value="3">⭐⭐⭐ (Regular)</option>
                                    <option value="2">⭐⭐ (Ruim)</option>
                                    <option value="1">⭐ (Péssimo)</option>
                                </select>
                                <textarea placeholder="Deixe um comentário adicional (Opcional)" rows="3" style={estilos.inputMobile} value={comentarioPesquisa} onChange={e => setComentarioPesquisa(e.target.value)}></textarea>
                                <button type="submit" style={estilos.btnAcaoMobile}>GRAVAR SAÍDA</button>
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
    modalRetencao: { border: '1px solid #fca5a5', backgroundColor: '#fff5f5', borderRadius: '12px', padding: '15px', textAlign: 'center', marginTop: '15px' },
    btnConfirmarSaPrecoce: { flex: 1, backgroundColor: '#dc2626', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' },
    btnDesistirSaida: { flex: 1, backgroundColor: '#64748b', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' },
    caixaDilemaEventos: { border: '1px solid #fef08a', backgroundColor: '#fefce8', padding: '15px', borderRadius: '12px', marginBottom: '20px', textAlign: 'left' },
    btnOpcaoEvento: { width: '100%', padding: '10px', border: '1px solid #cbd5e1', backgroundColor: '#fff', borderRadius: '6px', fontSize: '13px', fontWeight: '600', color: '#1e293b', marginBottom: '6px', textAlign: 'left', cursor: 'pointer' }
};