import React, { useState, useEffect } from 'react';

const API_URL = window.location.origin.includes('localhost') ? 'http://localhost:3009' : '';

const calcularDistanciaCliente = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

// REFORÇO DE ALTA ENTROPIA: Posicionado fora do componente principal para não quebrar a compilação
const obterImpressaoDigitalHardware = () => {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('Fingerprint Logap', 2, 15);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('Fingerprint Logap', 4, 17);
        const dataURL = canvas.toDataURL();
        let hash = 0;
        for (let i = 0; i < dataURL.length; i++) {
            hash = ((hash << 5) - hash) + dataURL.charCodeAt(i);
            hash = hash & hash; 
        }
        
        // ADIÇÃO CRÍTICA: Mescla com dados do navegador e hardware secundário
        const userAgentHash = navigator.userAgent ? navigator.userAgent.length : 0;
        const memory = navigator.deviceMemory || 0;
        const cores = navigator.hardwareConcurrency || 0;
        
        return `HW-${Math.abs(hash)}-${window.screen.width}x${window.screen.height}-${userAgentHash}-${memory}-${cores}`;
    } catch (e) {
        return `HW-GENERIC-${Math.random()}`; 
    }
};

// CORREÇÃO CRÍTICA: Formatação blindada para não gerar "Invalid Date" em iPhones/Safari
const obterAgoraSaoPaulo = () => {
    try {
        const dataTexto = new Date().toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo" }).replace(' ', 'T');
        const data = new Date(dataTexto);
        return isNaN(data.getTime()) ? new Date() : data;
    } catch (e) {
        return new Date();
    }
};

const obterDataComHorarioString = (horarioStr) => {
    const agora = obterAgoraSaoPaulo();
    if (!horarioStr) return agora;
    const [horas, minutos] = horarioStr.split(':').map(Number);
    return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), hours, minutos, 0);
};

export default function App() {
    const [deviceToken, setDeviceToken] = useState(localStorage.getItem('device_token') || ''); 
    const [statusTela, setStatusTela] = useState('carregando'); 
    const [eventos, setEventos] = useState([]);
    const [eventoSelecionado, setEventoSelecionado] = useState(null);
    const [coords, setCoords] = useState({ lat: null, lng: null });
    
    const [temEventoAtivo, setTemEventoAtivo] = useState(false);
    const [eventoAtivoId, setEventoAtivoId] = useState(null);
    
    const [matriculaInput, setMatriculaInput] = useState('');
    const [nomeInput, setNomeInput] = useState('');

    const [alerta, setAlerta] = useState({ visivel: false, msg: '', tipo: 'sucesso' });
    const [conteudoModal, setConteudoModal] = useState(null);

    const [estrelas, setEstrelas] = useState(5);
    const [comentario, setComentario] = useState('');
    const [auditoriaEventos, setAuditoriaEventos] = useState({});

    const dispararAlerta8Segundos = (mensagem, tipo = 'erro', acaoPosterior = null) => {
        setAlerta({ visivel: true, msg: mensagem, tipo });
        setTimeout(() => {
            setAlerta({ visivel: false, msg: '', tipo: 'sucesso' });
            if (acaoPosterior) acaoPosterior();
        }, 8000);
    };

    useEffect(() => {
        if (!deviceToken) {
            setStatusTela('vincular');
            return;
        }
        executarInicializacao(deviceToken);
    }, [deviceToken]);

    useEffect(() => {
        if (eventos.length > 0 && coords.lat && coords.lng) {
            processarAuditoriaPreventiva();
        }
    }, [coords, eventos, temEventoAtivo, eventoAtivoId]);

    const ejecutarInicializacao = async (tokenParaValidar) => {
        try {
            const res = await fetch(`${API_URL}/api/v2/presenca/inicializar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ device_token: tokenParaValidar })
            });

            if (res.status === 401) {
                localStorage.removeItem('device_token');
                setDeviceToken('');
                setStatusTela('vincular');
                return;
            }

            const data = await res.json();

            if (data.status === 'sem_eventos' || data.status === 'fora_horario') {
                dispararAlerta8Segundos(data.mensagem, 'erro', () => setStatusTela('encerrado'));
                return;
            }

            if (data.status === 'sucesso') {
                setEventos(data.eventos);
                setTemEventoAtivo(data.tem_evento_ativo || false);
                setEventoAtivoId(data.evento_ativo_id || null);
                setStatusTela('listagem');
                obterLocalizacaoGPS();
            } else {
                dispararAlerta8Segundos(data.error || 'Erro de conexão.', 'erro');
            }
        } catch (err) {
            dispararAlerta8Segundos('Não foi possível contatar o servidor.', 'erro');
        }
    };

    const processarAuditoriaPreventiva = async () => {
        const novoEstadoAuditoria = { ...auditoriaEventos };
        const agora = obterAgoraSaoPaulo();

        for (let ev of eventos) {
            if (!novoEstadoAuditoria[ev.id]) {
                novoEstadoAuditoria[ev.id] = { carregando: true, liberado: false, motivo: 'Analisando regras...', acao: 'entrada' };
            }

            const dataInicioOficial = obterDataComHorarioString(ev.hora_inicio);
            const dataTerminoOficial = obterDataComHorarioString(ev.hora_fim);

            const limiteEntradaInicio = new Date(dataInicioOficial.getTime() - 30 * 60000);
            const limiteEntradaFim = new Date(dataTerminoOficial.getTime() - 30 * 60000);

            const limiteSaidaInicio = new Date(dataTerminoOficial.getTime() - 30 * 60000);
            const limiteSaidaFim = new Date(dataTerminoOficial.getTime() + 30 * 60000);

            const distancia = calcularDistanciaCliente(coords.lat, coords.lng, parseFloat(ev.latitude), parseFloat(ev.longitude));
            const estaNoRaio = distancia <= 1000;

            if (temEventoAtivo && ev.id !== eventoAtivoId) {
                novoEstadoAuditoria[ev.id] = { carregando: false, liberado: false, motivo: `Bloqueio: Você já possui uma frequência activa no evento de ID ${eventoAtivoId}.`, acao: 'bloqueado' };
                continue;
            }

            if (!estaNoRaio) {
                novoEstadoAuditoria[ev.id] = { carregando: false, liberado: false, motivo: `Bloqueio: Precisa estar no local. Distância atual: ${(distancia/1000).toFixed(1)}km.`, acao: 'bloqueado' };
                continue;
            }

            if (temEventoAtivo && ev.id === eventoAtivoId) {
                if (agora < limiteSaidaInicio || agora > limiteSaidaFim) {
                    novoEstadoAuditoria[ev.id] = { carregando: false, liberado: false, motivo: `Bloqueio: Saída permitida apenas entre ${limiteSaidaInicio.toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})} e ${limiteSaidaFim.toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})}.`, acao: 'saida_travada' };
                } else {
                    novoEstadoAuditoria[ev.id] = { carregando: false, liberado: true, motivo: '', acao: 'saida' };
                }
            } else {
                if (agora < limiteEntradaInicio || agora > limiteEntradaFim) {
                    novoEstadoAuditoria[ev.id] = { carregando: false, liberado: false, motivo: `Bloqueio: Entrada permitida apenas entre ${limiteEntradaInicio.toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})} e ${limiteEntradaFim.toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})}.`, acao: 'entrada_travada' };
                } else {
                    novoEstadoAuditoria[ev.id] = { carregando: false, liberado: true, motivo: '', acao: 'entrada' };
                }
            }
        }
        setAuditoriaEventos(novoEstadoAuditoria);
    };

    const lidarComVinculoAparelho = async (e) => {
        e.preventDefault();
        try {
            // CAPTURA ESTÁVEL DA IMPRESSÃO DIGITAL NO MOMENTO DA ASSOCIAÇÃO
            const hardware_id = obterImpressaoDigitalHardware();

            const res = await fetch(`${API_URL}/api/v2/dispositivo/associar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ matricula: matriculaInput, nome: nomeInput, hardware_id })
            });
            const data = await res.json();

            if (!res.ok) {
                dispararAlerta8Segundos(data.error || 'Erro ao vincular.', 'erro');
                return;
            }

            localStorage.setItem('device_token', data.device_token);
            setDeviceToken(data.device_token);
            dispararAlerta8Segundos('APARELHO VINCULADO COM SUCESSO!', 'sucesso');
        } catch (err) {
            dispararAlerta8Segundos('Erro ao tentar associar dispositivo.', 'erro');
        }
    };

    const obterLocalizacaoGPS = () => {
        if (!navigator.geolocation) {
            dispararAlerta8Segundos('O seu navegador não suporta GPS.', 'erro');
            return;
        }
        const sucesso = (pos) => {
            setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        };
        const erroAltaPrecisao = (err) => {
            navigator.geolocation.getCurrentPosition(
                sucesso, 
                (erroFatal) => {
                    dispararAlerta8Segundos('Erro ao buscar localização. Ative seu GPS físico.', 'erro');
                }, 
                { enableHighAccuracy: false, timeout: 15000, maximumAge: 10000 }
            );
        };
        navigator.geolocation.getCurrentPosition(sucesso, erroAltaPrecisao, {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 0
        });
    };

    const acionarBotaoFormacao = (ev, statusAuditoria) => {
        try {
            if (!statusAuditoria || !statusAuditoria.liberado) {
                dispararAlerta8Segundos(statusAuditoria?.motivo || "Ação bloqueada pelas regras de validação.", "erro");
                
                fetch(`${API_URL}/api/v2/presenca/checar-status`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ device_token: deviceToken, evento_id: ev.id, latitude: coords.lat, longitude: coords.lng })
                }).catch(() => {});
                return;
            }

            setEventoSelecionado(ev);
            
            if (statusAuditoria.acao === 'saida') {
                setConteudoModal({ tipo: 'pergunta_saida', texto: `Confirma a realização da avaliação e encerramento da sua presença no evento "${ev.titulo}"?` });
                setStatusTela('modal_pergunta');
            } else {
                setConteudoModal({ tipo: 'confirmar_entrada', texto: `Confirmar presença na formação: "${ev.titulo}"?` });
                setStatusTela('modal_pergunta');
            }
        } catch (error) {
            dispararAlerta8Segundos("Ocorreu um erro interno ao processar o botão.", "erro");
        }
    };

    const processarAceiteModal = async () => {
        if (conteudoModal.tipo === 'confirmar_entrada') {
            setStatusTela('gravando_presenca');
            try {
                const res = await fetch(`${API_URL}/api/v2/presenca/confirmar-entrada`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        device_token: deviceToken, 
                        evento_id: eventoSelecionado.id,
                        latitude: coords.lat,
                        longitude: coords.lng
                    })
                });
                if (res.ok) {
                    setStatusTela('presenca_confirmada_sucesso');
                    setTimeout(() => {
                        setTemEventoAtivo(true);
                        setEventoAtivoId(eventoSelecionado.id);
                        ejecutarInicializacao(deviceToken);
                    }, 8000);
                } else {
                    setStatusTela('listagem');
                    const d = await res.json();
                    dispararAlerta8Segundos(d.error || 'Erro ao registrar frequência.', 'erro');
                }
            } catch (e) {
                setStatusTela('listagem');
                dispararAlerta8Segundos('Erro de comunicação com o servidor.', 'erro');
            }
        } else if (conteudoModal.tipo === 'pergunta_saida') {
            setStatusTela('pesquisa');
        }
    };

    const submeterPesquisaSaida = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_URL}/api/v2/presenca/confirmar-saida`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    device_token: deviceToken,
                    evento_id: eventoSelecionado.id,
                    estrelas,
                    comentario,
                    latitude: coords.lat,
                    longitude: coords.lng
                })
            });
            
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Erro ao processar sua saída.');
            }

            setEstrelas(5);
            setComentario('');
            setStatusTela('sucesso_final');

            setTimeout(() => {
                setTemEventoAtivo(false);
                setEventoAtivoId(null);
                ejecutarInicializacao(deviceToken);
            }, 8000);

        } catch (err) {
            dispararAlerta8Segundos(err.message, 'erro');
        }
    };

    return (
        <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px', maxWidth: '450px', margin: '0 auto', textAlign: 'center', color: '#333', minHeight: '100vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', position: 'relative' }}>
            
            <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>
                <img src="/logap.png" alt="Logap" style={{ height: '32px', objectFit: 'contain' }} />
            </div>

            {alerta.visivel && (
                <div style={{
                    backgroundColor: alerta.tipo === 'sucesso' ? '#d4edda' : '#f8d7da',
                    color: alerta.tipo === 'sucesso' ? '#155724' : '#721c24',
                    padding: '15px', borderRadius: '8px', marginBottom: '20px',
                    fontWeight: 'bold', border: `1px solid ${alerta.tipo === 'sucesso' ? '#c3e6cb' : '#f5c6cb'}`,
                    fontSize: '13px', textAlign: 'left', lineHeight: '1.4'
                }}>
                    {alerta.msg.split('\n').map((str, i) => <div key={i}>{str}</div>)}
                </div>
            )}

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', width: '100%', marginBottom: '50px' }}>
                
                {statusTela === 'carregando' && (
                    <div style={{ padding: '30px' }}>
                        <h3 style={{ color: '#0284c7' }}>Buscando formações agendadas...</h3>
                    </div>
                )}

                {statusTela === 'vincular' && (
                    <form onSubmit={lidarComVinculoAparelho} style={{ border: '1px solid #cbd5e1', padding: '25px', borderRadius: '12px', textAlign: 'left', backgroundColor: '#fff' }}>
                        <h2 style={{ color: '#1e3a8a', marginTop: 0, textAlign: 'center' }}>Vincular Aparelho</h2>
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Matrícula:</label>
                            <input type="text" value={matriculaInput} onChange={e => setMatriculaInput(e.target.value)} required style={{ width: '100%', padding: '11px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Nome Completo:</label>
                            <input type="text" value={nomeInput} onChange={e => setNomeInput(e.target.value)} required style={{ width: '100%', padding: '11px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                        </div>
                        <button type="submit" style={{ width: '100%', padding: '14px', borderRadius: '6px', border: 'none', backgroundColor: '#1e3a8a', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>VINCULAR DISPOSITIVO</button>
                    </form>
                )}

                {statusTela === 'listagem' && (
                    <div>
                        <h2 style={{ color: '#1e3a8a', marginBottom: '5px' }}>Portal de Presença</h2>
                        <p style={{ color: '#666', fontSize: '13px', marginBottom: '25px' }}>Frequências e eventos monitorados em tempo real.</p>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                            {eventos.map(ev => {
                                const aud = auditoriaEventos[ev.id] || { carregando: true, liberado: false, motivo: 'Aguardando GPS...', acao: 'entrada' };
                                
                                let corBotao = '#e2e8f0'; 
                                let textoBotao = 'Aguarde...';
                                let corTextoBotao = '#64748b';

                                if (!aud.carregando) {
                                    if (aud.liberado) {
                                        if (aud.acao === 'saida') {
                                            corBotao = 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)'; 
                                            textoBotao = 'AVALIAR E REGISTRAR SAÍDA';
                                            corTextoBotao = '#ffffff';
                                        } else {
                                            corBotao = 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)'; 
                                            textoBotao = 'MARCAR ENTRADA';
                                            corTextoBotao = '#ffffff';
                                        }
                                    } else {
                                        corBotao = '#ffffff'; 
                                        textoBotao = aud.acao === 'saida_travada' ? 'SAÍDA BLOQUEADA' : 'ENTRADA BLOQUEADA';
                                        corTextoBotao = '#94a3b8';
                                    }
                                }

                                return (
                                    <div key={ev.id} style={{ border: '1px solid #cbd5e1', padding: '18px', borderRadius: '16px', backgroundColor: '#fff', textAlign: 'left', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                                        <div style={{ fontSize: '17px', fontWeight: '800', marginBottom: '6px', color: '#1e293b', lineHeight: '1.2' }}>{ev.titulo}</div>
                                        <div style={{ fontSize: '13px', color: '#475569', marginBottom: '4px' }}>📍 Local: <strong>{ev.local}</strong></div>
                                        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>⏰ Agenda: {ev.hora_inicio ? ev.hora_inicio.slice(0,5) : '--'} às {ev.hora_fim ? ev.hora_fim.slice(0,5) : '--'}</div>
                                        
                                        <button
                                            onClick={() => acionarBotaoFormacao(ev, aud)}
                                            style={{
                                                width: '100%', padding: '12px', borderRadius: '8px', border: aud.liberado ? 'none' : '1px solid #cbd5e1',
                                                background: corBotao, color: corTextoBotao, fontWeight: 'bold', fontSize: '13px', cursor: 'pointer',
                                                transition: 'all 0.2s ease', boxShadow: aud.liberado ? '0 4px 12px rgba(2, 132, 199, 0.2)' : 'none'
                                            }}
                                        >
                                            {textoBotao}
                                        </button>

                                        {!aud.liberado && (
                                            <div style={{ marginTop: '8px', fontSize: '11px', color: '#ef4444', fontWeight: '600', lineHeight: '1.3' }}>
                                                ⚠️ {aud.motivo}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {eventos.length === 0 && (
                                <p style={{ color: '#94a3b8', fontStyle: 'italic', padding: '20px' }}>Nenhuma formação agendada para este horário.</p>
                            )}
                        </div>
                    </div>
                )}

                {statusTela === 'aguardando_janela_saida' && (
                    <div style={{ padding: '30px', borderRadius: '16px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '50px', marginBottom: '15px' }}>✍️</div>
                        <h3 style={{ color: '#1e3a8a', fontSize: '18px', fontWeight: '800', margin: '0 0 10px 0' }}>Sua presença foi salva!</h3>
                        <p style={{ fontSize: '14px', color: '#475569', lineHeight: '1.5', margin: 0 }}>
                            Você está confirmado neste evento. Permaneça na formação. O aplicativo entrou em modo de repouso ecológico e encerrou o consumo de dados da rede local para poupar o servidor.
                        </p>
                        <div style={{ marginTop: '20px', fontSize: '12px', color: '#0284c7', fontWeight: 'bold' }}>
                            🔒 Este aparelho está vinculado à sua matrícula.
                        </div>
                        <button onClick={() => setStatusTela('listagem')} style={{ marginTop: '25px', padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#0284c7', color: '#fff', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>👁️ VER STATUS DOS BOTÕES</button>
                    </div>
                )}

                {statusTela === 'modal_pergunta' && conteudoModal && (
                    <div style={{ border: '1px solid #cbd5e1', padding: '25px', borderRadius: '16px', backgroundColor: '#f8fafc', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
                        <div style={{ fontSize: '40px', marginBottom: '10px' }}>⚡</div>
                        <p style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '25px', color: '#1e293b', lineHeight: '1.5' }}>{conteudoModal.texto}</p>
                        <div style={{ display: 'flex', gap: '15px' }}>
                            <button onClick={() => setStatusTela('listagem')} style={{ flex: 1, padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#64748b', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>VOLTAR</button>
                            <button onClick={processarAceiteModal} style={{ flex: 1, padding: '14px', borderRadius: '8px', border: 'none', backgroundColor: '#16a34a', color: '#fff', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>CONFIRMAR</button>
                        </div>
                    </div>
                )}

                {statusTela === 'gravando_presenca' && (
                    <div style={{ padding: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ fontSize: '45px', marginBottom: '20px', animation: 'spin 2s linear infinite' }}>🔄</div>
                        <h3 style={{ color: '#1e3a8a', fontSize: '18px', fontWeight: '800', margin: 0 }}>
                            Aguarde enquanto registramos sua presença...
                        </h3>
                        <p style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>Salvando transação criptografada na base de dados.</p>
                    </div>
                )}

                {statusTela === 'presenca_confirmada_sucesso' && (
                    <div style={{ padding: '35px', borderRadius: '16px', backgroundColor: '#f0fdf4', border: '2px dashed #22c55e' }}>
                        <div style={{ fontSize: '60px', marginBottom: '15px' }}>🏆</div>
                        <h2 style={{ color: '#15803d', fontSize: '24px', fontWeight: '900', margin: '0 0 10px 0' }}>PRESENÇA REGISTRADA!</h2>
                        <p style={{ color: '#166534', fontSize: '14px', margin: 0, lineHeight: '1.4' }}>Frequência salva. Entrando em modo estático de economia de banda...</p>
                    </div>
                )}

                {statusTela === 'pesquisa' && (
                    <form onSubmit={submeterPesquisaSaida} style={{ border: '1px solid #e2e8f0', padding: '25px', borderRadius: '12px', textAlign: 'left', backgroundColor: '#fff' }}>
                        <h3 style={{ marginTop: 0, color: '#1e3a8a', fontSize: '15px' }}>Pesquisa de Satisfação em anonimato (seus dados não serão solicitados)</h3>
                        <p style={{ fontSize: '13px', color: '#666' }}>Sua opinião é essencial! Escolha uma opção:</p>
                        <select value={estrelas} onChange={(e) => setEstrelas(Number(e.target.value))} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '15px' }}>
                            <option value="5">⭐⭐⭐⭐⭐ Excelência total</option>
                            <option value="4">⭐⭐⭐⭐ Muito Bom</option>
                            <option value="3">⭐⭐⭐ Atendeu às expectativas</option>
                            <option value="2">⭐⭐ Regular</option>
                            <option value="1">⭐ Precisa melhorar bastante</option>
                        </select>
                        <textarea rows="3" value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Comentários adicionais (Opcional)..." style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', marginBottom: '15px' }} />
                        <button type="submit" style={{ width: '100%', padding: '14px', borderRadius: '6px', border: 'none', backgroundColor: '#ea580c', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>Enviar Avaliação & Concluir Saída</button>
                    </form>
                )}

                {statusTela === 'encerrado' && (
                    <div style={{ marginTop: '40px' }}>
                        <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>Nenhuma operação activa disponível no momento.</p>
                    </div>
                )}
                
                {statusTela === 'sucesso_final' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '20px' }}>
                        <div style={{ fontSize: '70px', marginBottom: '20px' }}>✅</div>
                        <h2 style={{ color: '#166534', marginBottom: '15px', fontSize: '26px', fontWeight: '800' }}>Saída Registrada!</h2>
                        <p style={{ color: '#4b5563', fontSize: '16px' }}>Sua participação e avaliação foram salvas com sucesso no sistema.</p>
                    </div>
                )}                  
            </div>

            <div style={{ width: '100%', fontSize: '10px', color: '#94a3b8', textAlign: 'center', padding: '10px 0', borderTop: '1px solid #f1f5f9', position: 'absolute', bottom: 0, left: 0, right: 0 }}>
                Desenvolvido pela Subsecretaria Adjunta de Inovação e Tecnologia
            </div>

            <style>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}