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

// Função auxiliar para converter string de horário "HH:MM" ou "HH:MM:SS" em um objeto de data comparável
const obterDataComHorarioString = (horarioStr) => {
    if (!horarioStr) return new Date();
    const agora = new Date();
    const [horas, minutos] = horarioStr.split(':').map(Number);
    return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), horas, minutos, 0);
};

export default function App() {
    const [deviceToken, setDeviceToken] = useState(localStorage.getItem('device_token') || ''); 
    const [statusTela, setStatusTela] = useState('carregando'); 
    const [eventos, setEventos] = useState([]);
    const [temEventoAtivo, setTemEventoAtivo] = useState(false);
    const [eventoAtivoId, setEventoAtivoId] = useState(null);
    const [eventoSelecionado, setEventoSelecionado] = useState(null);
    const [coords, setCoords] = useState({ lat: null, lng: null });
    
    const [matriculaInput, setMatriculaInput] = useState('');
    const [nomeInput, setNomeInput] = useState('');
    const [alerta, setAlerta] = useState({ visivel: false, msg: '', tipo: 'sucesso' });
    const [conteudoModal, setConteudoModal] = useState(null);

    const [estrelas, setEstrelas] = useState(5);
    const [comentario, setComentario] = useState('');

    const dispararAlerta8Segundos = (mensagem, tipo = 'erro', acaoPosterior = null) => {
        setAlerta({ visivel: true, msg: mensaje || mensagem, tipo });
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
            if (data.status === 'sucesso') {
                setEventos(data.eventos);
                setTemEventoAtivo(data.tem_evento_ativo);
                setEventoAtivoId(data.evento_ativo_id);
                setStatusTela('listagem');
                obterLocalizacaoGPS();
            } else {
                dispararAlerta8Segundos(data.error || 'Erro de conexão.', 'erro');
            }
        } catch (err) {
            dispararAlerta8Segundos('Não foi possível se comunicar com o servidor.', 'erro');
        }
    };

    const lidarComVinculoAparelho = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_URL}/api/v2/dispositivo/associar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ matricula: matriculaInput, nome: nomeInput })
            });
            const data = await res.json();
            if (!res.ok) {
                dispararAlerta8Segundos(data.error || 'Erro ao vincular dispositivo.', 'erro');
                return;
            }
            localStorage.setItem('device_token', data.device_token);
            setDeviceToken(data.device_token);
            dispararAlerta8Segundos('DISPOSITIVO VINCULADO COM SUCESSO!', 'sucesso');
        } catch (err) {
            dispararAlerta8Segundos('Erro ao tentar associar dispositivo.', 'erro');
        }
    };

    const obterLocalizacaoGPS = () => {
        const sucesso = (pos) => {
            setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        };
        navigator.geolocation.getCurrentPosition(sucesso, () => {
            navigator.geolocation.getCurrentPosition(sucesso, () => {
                dispararAlerta8Segundos('Por favor, ative o GPS e dê as permissões de localização.', 'erro');
            }, { enableHighAccuracy: false, timeout: 10000 });
        }, { enableHighAccuracy: true, timeout: 6000 });
    };

    const selecionarEvento = async (ev) => {
        if (!coords.lat || !coords.lng) {
            dispararAlerta8Segundos('Aguardando sinal do GPS para validar proximidade.', 'erro');
            return;
        }

        // --- REGRA 1 COMPLETA: VALIDAÇÃO CRÍTICA DE PERÍODO E JANELAS DE HORÁRIO ---
        const agora = new Date();
        const dataInicioOficial = obterDataComHorarioString(ev.hora_inicio);
        const dataTerminoOficial = obterDataComHorarioString(ev.hora_fim);

        // Limites para Entrada: 30 minutos antes do início até 30 minutos antes do fim
        const limiteEntradaInicio = new Date(dataInicioOficial.getTime() - 30 * 60000);
        const limiteEntradaFim = new Date(dataTerminoOficial.getTime() - 30 * 60000);

        // Limites para Saída: 30 minutos antes do término até 30 minutos após o término
        const limiteSaidaInicio = new Date(dataTerminoOficial.getTime() - 30 * 60000);
        const limiteSaidaFim = new Date(dataTerminoOficial.getTime() + 30 * 60000);

        try {
            const res = await fetch(`${API_URL}/api/v2/presenca/checar-status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    device_token: deviceToken,
                    evento_id: ev.id,
                    latitude: coords.lat,
                    longitude: coords.lng
                })
            });
            const data = await res.json();

            if (!res.ok) {
                dispararAlerta8Segundos(data.error || 'Operação bloqueada.', 'erro');
                return;
            }

            setEventoSelecionado(ev);

            if (data.status === 'somente_entrada') {
                // Valida se o horário de saída está na janela correta de liberação
                if (agora < limiteSaidaInicio || agora > limiteSaidaFim) {
                    dispararAlerta8Segundos('Acesso bloqueado: O botão de registro de saída só ficará ativo no período compreendido entre 30 minutos antes e 30 minutos após o término previsto da formação.', 'erro');
                    return;
                }
                setConteudoModal({
                    tipo: 'pergunta_saida',
                    texto: `Sua entrada está ativa. Confirma o preenchimento da avaliação e encerramento da sua frequência agora?`
                });
                setStatusTela('modal_pergunta');
            } else if (data.status === 'nenhum') {
                // Valida se o horário de entrada está na janela correta de liberação
                if (agora < limiteEntradaInicio || agora > limiteEntradaFim) {
                    dispararAlerta8Segundos('Acesso bloqueado: O botão de entrada para esta formação só fica ativo no período de 30 minutos antes do início previsto até 30 minutos antes do seu encerramento.', 'erro');
                    return;
                }
                setConteudoModal({
                    tipo: 'confirmar_entrada',
                    texto: `Deseja registrar sua presença oficial na formação: "${ev.titulo}"?`
                });
                setStatusTela('modal_pergunta');
            }
        } catch (err) {
            dispararAlerta8Segundos('Falha de conexão com a central.', 'erro');
        }
    };

    const processarAceiteModal = async () => {
        if (conteudoModal.tipo === 'confirmar_entrada') {
            // REGRA 2: CONGELA A TELA IMEDIATAMENTE E MOSTRA MENSAGEM ANTI-DUPLO CLIQUE NO SERVIDOR
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
                    // EXIBE MENSAGEM GAMIFICADA POR EXATAMENTE 8 SEGUNDOS
                    setStatusTela('presenca_confirmada_sucesso');
                    
                    // REGRA 2 EXCLUSIVA: LIMPA O DISPOSITIVO DA REDE APÓS 8 SEGUNDOS PARA DESCONECTAR DO CLOUDFLARE TUNNEL
                    setTimeout(() => {
                        localStorage.removeItem('device_token');
                        setDeviceToken('');
                        window.location.reload();
                    }, 8000);
                } else {
                    const d = await res.json();
                    setStatusTela('listagem');
                    dispararAlerta8Segundos(d.error || 'Erro ao salvar entrada.', 'erro');
                }
            } catch (e) {
                setStatusTela('listagem');
                dispararAlerta8Segundos('Falha ao registrar presença.', 'erro');
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
            if (res.ok) {
                setEstrelas(5);
                setComentario('');
                setStatusTela('sucesso_final');
                
                setTimeout(() => {
                    localStorage.removeItem('device_token');
                    setDeviceToken('');
                    window.location.reload();
                }, 8000);
            } else {
                const d = await res.json();
                dispararAlerta8Segundos(d.error || 'Erro ao registrar saída.', 'erro');
            }
        } catch (err) {
            dispararAlerta8Segundos('Erro de comunicação ao encerrar frequência.', 'erro');
        }
    };

    return (
        <div style={{ fontFamily: 'system-ui, sans-serif', padding: '15px 20px', maxWidth: '450px', margin: '0 auto', textAlign: 'center', color: '#333', minHeight: '100vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', position: 'relative' }}>
            
            {/* LOGOTIPO PEQUENA E CENTRALIZADA NO TOPO DO CELULAR */}
            <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>
                <img src="/logap.png" alt="Logap" style={{ height: '32px', objectFit: 'contain' }} />
            </div>

            {alerta.visivel && (
                <div style={{
                    backgroundColor: alerta.tipo === 'sucesso' ? '#dcfce7' : '#fee2e2',
                    color: alerta.tipo === 'sucesso' ? '#166534' : '#991b1b',
                    padding: '12px 15px', borderRadius: '12px', marginBottom: '15px',
                    fontWeight: 'bold', border: `1px solid ${alerta.tipo === 'sucesso' ? '#bbf7d0' : '#fca5a5'}`,
                    fontSize: '13px', lineHeight: '1.4'
                }}>
                    {alerta.msg}
                </div>
            )}

            {/* ZONA DE CONTEÚDO DINÂMICO PRINCIPAL */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', width: '100%', marginBottom: '40px' }}>
                
                {statusTela === 'carregando' && <h3 style={{ color: '#0284c7', padding: '20px' }}>Sincronizando dados com o servidor...</h3>}

                {statusTela === 'vincular' && (
                    <form onSubmit={lidarComVinculoAparelho} style={{ border: '1px solid #cbd5e1', padding: '25px', borderRadius: '12px', textAlign: 'left', backgroundColor: '#fff', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                        <h2 style={{ color: '#1e3a8a', marginTop: 0, textAlign: 'center', fontSize: '20px' }}>Portal Formar</h2>
                        <input type="text" placeholder="Matrícula" value={matriculaInput} onChange={e => setMatriculaInput(e.target.value)} required style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', marginBottom: '15px' }} />
                        <input type="text" placeholder="Nome Completo" value={nomeInput} onChange={e => setNomeInput(e.target.value)} required style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', marginBottom: '20px' }} />
                        <button type="submit" style={{ width: '100%', padding: '14px', borderRadius: '6px', border: 'none', backgroundColor: '#1e3a8a', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>VINCULAR DISPOSITIVO</button>
                    </form>
                )}

                {statusTela === 'listagem' && (
                    <div style={{ width: '100%' }}>
                        <h2 style={{ color: '#0f172a', marginBottom: '4px', fontWeight: '800', fontSize: '22px' }}>Portal Formar</h2>
                        <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px' }}>Formações e frequências agendadas para hoje.</p>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            {eventos
                                .filter(ev => !temEventoAtivo || ev.id === eventoAtivoId)
                                .map(ev => {
                                    const distancia = coords.lat && coords.lng ? calcularDistanciaCliente(coords.lat, coords.lng, parseFloat(ev.latitude), parseFloat(ev.longitude)) : 9999;
                                    const estaNoRaio = distancia <= 1000;
                                    const souOAtivo = temEventoAtivo && ev.id === eventoAtivoId;

                                    return (
                                        <button
                                            key={ev.id} onClick={() => selecionarEvento(ev)} disabled={!estaNoRaio}
                                            style={{
                                                display: 'flex', flexDirection: 'column', gap: '8px', padding: '18px', borderRadius: '16px',
                                                border: estaNoRaio ? 'none' : '1px solid #e5e7eb', cursor: estaNoRaio ? 'pointer' : 'not-allowed',
                                                background: souOAtivo ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : (estaNoRaio ? 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)' : '#f8fafc'),
                                                color: estaNoRaio ? '#ffffff' : '#9ca3af', width: '100%', transition: 'all 0.3s ease', textAlign: 'left',
                                                boxShadow: estaNoRaio ? `0 10px 20px -5px ${souOAtivo ? 'rgba(217, 119, 6, 0.3)' : 'rgba(2, 132, 199, 0.3)'}` : 'none'
                                            }}
                                        >
                                            <div style={{ fontSize: '16px', fontWeight: '800', marginBottom: '2px', lineHeight: '1.2' }}>
                                                {souOAtivo ? `⏳ EM ANDAMENTO: ${ev.titulo}` : ev.titulo}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', opacity: 0.95 }}>📍 {ev.local}</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', opacity: 0.90, fontWeight: '500' }}>⏰ Horário: {ev.hora_inicio ? ev.hora_inicio.slice(0,5) : '--'} às {ev.hora_fim ? ev.hora_fim.slice(0,5) : '--'}</div>
                                            {ev.palestrante && <div style={{ fontSize: '12px', opacity: 0.95, padding: '4px 8px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.2)', width: 'fit-content', fontWeight: 'bold' }}>🎤 {ev.palestrante}</div>}
                                            
                                            {souOAtivo && (
                                                <div style={{ marginTop: '5px', fontSize: '12px', fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.15)', padding: '6px', borderRadius: '6px', textAlign: 'center', width: '100%', boxSizing: 'border-box' }}>
                                                    Clique aqui para registrar sua Saída.
                                                </div>
                                            )}
                                            {!estaNoRaio && coords.lat && <div style={{ marginTop: '10px', padding: '8px', borderRadius: '8px', backgroundColor: '#fee2e2', color: '#b91c1c', fontSize: '12px', fontWeight: 'bold', textAlign: 'center', width: '100%', boxSizing: 'border-box' }}>🔒 Dirija-se ao local da formação.</div>}
                                        </button>
                                    );
                                })}
                        </div>
                    </div>
                )}

                {statusTela === 'modal_pergunta' && conteudoModal && (
                    <div style={{ border: '1px solid #e2e8f0', padding: '25px', borderRadius: '12px', backgroundColor: '#f8fafc', width: '100%', boxSizing: 'border-box', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                        <div style={{ fontSize: '40px', marginBottom: '10px' }}>⚡</div>
                        <p style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: '25px', lineHeight: '1.6', color: '#1e293b' }}>{conteudoModal.texto}</p>
                        <div style={{ display: 'flex', gap: '15px' }}>
                            <button onClick={() => setStatusTela('listagem')} style={{ flex: 1, padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#64748b', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>VOLTAR</button>
                            <button onClick={processarAceiteModal} style={{ flex: 1, padding: '14px', borderRadius: '8px', border: 'none', backgroundColor: '#16a34a', color: '#fff', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>CONFIRMAR</button>
                        </div>
                    </div>
                )}

                {/* NOVO STATUS DE TELA: TRAVA ANTI-DUPLO CLIQUE MENSAGEM GAMIFICADA DE AGUARDO */}
                {statusTela === 'gravando_presenca' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px' }}>
                        <div style={{ fontSize: '45px', animation: 'spin 2s linear infinite', marginBottom: '20px' }}>🔄</div>
                        <h3 style={{ color: '#1e3a8a', fontSize: '18px', fontWeight: '800', margin: 0, lineHeight: '1.4' }}>
                            Aguarde enquanto registramos sua presença...
                        </h3>
                        <p style={{ fontSize: '13px', color: '#64748b', marginTop: '10px' }}>A transação de segurança está sendo processada no servidor.</p>
                    </div>
                )}

                {/* NOVO STATUS DE TELA: CELEBRAÇÃO DE SUCESSO DE ENTRADA POR 8 SEGUNDOS */}
                {statusTela === 'presenca_confirmada_sucesso' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '35px', borderRadius: '16px', backgroundColor: '#f0fdf4', border: '2px dashed #22c55e' }}>
                        <div style={{ fontSize: '65px', marginBottom: '15px' }}>🏆</div>
                        <h2 style={{ color: '#15803d', fontSize: '24px', fontWeight: '900', margin: '0 0 10px 0' }}>PRESENÇA REGISTRADA!</h2>
                        <p style={{ color: '#166534', fontSize: '14px', lineHeight: '1.5', margin: 0 }}>Parabéns! Sua frequência foi salva na base pública. O terminal Cloudflare está desconectando seu dispositivo em segurança...</p>
                    </div>
                )}

                {statusTela === 'pesquisa' && (
                    <form onSubmit={submeterPesquisaSaida} style={{ border: '1px solid #e2e8f0', padding: '25px', borderRadius: '12px', textAlign: 'left', backgroundColor: '#fff', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                        <h3 style={{ marginTop: 0, color: '#0f172a', fontWeight: '800' }}>Avaliação da Formação</h3>
                        <select value={estrelas} onChange={(e) => setEstrelas(Number(e.target.value))} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '15px', backgroundColor: '#fff', fontSize: '14px' }}>
                            <option value="5">⭐⭐⭐⭐⭐ Excelência total</option>
                            <option value="4">⭐⭐⭐⭐ Muito Bom</option>
                            <option value="3">⭐⭐⭐ Atendeu às expectativas</option>
                            <option value="2">⭐⭐ Regular</option>
                            <option value="1">⭐ Precisa melhorar bastante</option>
                        </select>
                        <textarea rows="3" value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Comentários adicionais (Opcional)..." style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', marginBottom: '15px', fontSize: '14px' }} />
                        <button type="submit" style={{ width: '100%', padding: '14px', borderRadius: '8px', border: 'none', backgroundColor: '#0284c7', color: '#fff', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>Enviar Avaliação & Concluir Saída</button>
                    </form>
                )}

                {statusTela === 'sucesso_final' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '20px' }}>
                        <div style={{ fontSize: '70px', marginBottom: '15px' }}>✅</div>
                        <h2 style={{ color: '#166534', marginBottom: '12px', fontSize: '24px', fontWeight: '800' }}>Frequência Concluída!</h2>
                        <p style={{ color: '#4b5563', fontSize: '15px', lineHeight: '1.6' }}>Sua presença e avaliação final foram consolidadas com sucesso no sistema.</p>
                        <div style={{ marginTop: '30px', padding: '12px 20px', backgroundColor: '#f1f5f9', borderRadius: '12px', fontSize: '12px', color: '#64748b' }}>Desconectando sessão de forma segura...</div>
                    </div>
                )}
            </div>

            {/* ASSINATURA INSTITUCIONAL EXIGIDA CENTRALIZADA E PEQUENA NO RODAPÉ */}
            <div style={{ width: '100%', fontSize: '10px', color: '#94a3b8', textAlign: 'center', padding: '10px 0', borderTop: '1px solid #f1f5f9', position: 'absolute', bottom: 0, left: 0, right: 0 }}>
                Desenvolvido pela Subsecretaria Adjunta de Inovação e Tecnologia
            </div>
            
            {/* CSS inline para animação nativa do spin de carregamento */}
            <style>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}