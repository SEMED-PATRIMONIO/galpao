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

export default function App() {
    const [deviceToken, setDeviceToken] = useState(localStorage.getItem('device_token') || ''); 
    const [statusTela, setStatusTela] = useState('carregando'); 
    const [eventos, setEventos] = useState([]);
    const [eventoSelecionado, setEventoSelecionado] = useState(null);
    const [coords, setCoords] = useState({ lat: null, lng: null });
    
    const [matriculaInput, setMatriculaInput] = useState('');
    const [nomeInput, setNomeInput] = useState('');

    const [alerta, setAlerta] = useState({ visivel: false, msg: '', tipo: 'sucesso' });
    const [conteudoModal, setConteudoModal] = useState(null);

    const [estrelas, setEstrelas] = useState(5);
    const [comentario, setComentario] = useState('');

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

    const executarInicializacao = async (tokenParaValidar) => {
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
                setStatusTela('listagem');
                obterLocalizacaoGPS();
            } else {
                dispararAlerta8Segundos(data.error || 'Erro de conexão.', 'erro');
            }
        } catch (err) {
            dispararAlerta8Segundos('Não foi possível contatar o servidor.', 'erro');
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

    // Inteligência GPS (Plano A: Satélite / Plano B: Celular/Wi-Fi)
    const obterLocalizacaoGPS = () => {
        const sucesso = (pos) => {
            setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        };
        const erroAltaPrecisao = () => {
            navigator.geolocation.getCurrentPosition(
                sucesso,
                () => { dispararAlerta8Segundos('Ative o GPS para liberar o acesso.', 'erro'); },
                { enableHighAccuracy: false, timeout: 15000, maximumAge: 10000 }
            );
        };
        navigator.geolocation.getCurrentPosition(sucesso, erroAltaPrecisao, {
            enableHighAccuracy: true, timeout: 8000, maximumAge: 0
        });
    };

    const selecionarEvento = async (ev) => {
        if (!coords.lat || !coords.lng) {
            dispararAlerta8Segundos('Aguardando localização do GPS...', 'erro');
            return;
        }

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
                dispararAlerta8Segundos(data.error || 'Erro na validação.', 'erro');
                return;
            }

            setEventoSelecionado(ev);

            if (data.status === 'completo') {
                dispararAlerta8Segundos(`Já consta entrada e saída para este evento.`, 'sucesso');
                return;
            }

            if (data.status === 'somente_entrada') {
                setConteudoModal({
                    tipo: 'pergunta_saida',
                    texto: `Identificamos sua entrada. Confirma que deseja registrar a saída agora?`
                });
                setStatusTela('modal_pergunta');
                return;
            }

            if (data.status === 'nenhum') {
                setConteudoModal({
                    tipo: 'confirmar_entrada',
                    texto: `Deseja registrar sua entrada na formação: "${ev.titulo}"?`
                });
                setStatusTela('modal_pergunta');
            }
        } catch (err) {
            dispararAlerta8Segundos('Erro de comunicação.', 'erro');
        }
    };

    const processarAceiteModal = async () => {
        if (conteudoModal.tipo === 'confirmar_entrada') {
            try {
                const res = await fetch(`${API_URL}/api/v2/presenca/confirmar-entrada`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ device_token: deviceToken, evento_id: eventoSelecionado.id })
                });
                if (res.ok) {
                    dispararAlerta8Segundos('REGISTRO EFETUADO COM SUCESSO!', 'sucesso', () => setStatusTela('listagem'));
                }
            } catch (e) {
                dispararAlerta8Segundos('Falha ao registrar entrada.', 'erro');
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
                    comentario
                })
            });
            if (res.ok) {
                setEstrelas(5);
                setComentario('');
                setStatusTela('sucesso_final'); // Aciona a tela final
                
                // Temporizador de 8 segundos para limpeza e desconexão
                setTimeout(() => {
                    localStorage.removeItem('device_token');
                    setDeviceToken('');
                    window.location.reload();
                }, 8000);
            } else {
                dispararAlerta8Segundos('Erro ao concluir saída.', 'erro');
            }
        } catch (err) {
            dispararAlerta8Segundos('Erro ao processar sua saída.', 'erro');
        }
    };

    return (
        <div style={{ fontFamily: 'system-ui, sans-serif', padding: '20px', maxWidth: '450px', margin: '0 auto', textAlign: 'center', color: '#333' }}>
            
            {alerta.visivel && (
                <div style={{
                    backgroundColor: alerta.tipo === 'sucesso' ? '#dcfce7' : '#fee2e2',
                    color: alerta.tipo === 'sucesso' ? '#166534' : '#991b1b',
                    padding: '15px', borderRadius: '8px', marginBottom: '20px',
                    fontWeight: 'bold', border: `1px solid ${alerta.tipo === 'sucesso' ? '#bbf7d0' : '#fca5a5'}`
                }}>
                    {alerta.msg.split('\n').map((str, i) => <div key={i}>{str}</div>)}
                </div>
            )}

            {statusTela === 'carregando' && (
                <div style={{ padding: '30px' }}>
                    <h3 style={{ color: '#0284c7' }}>Buscando formações agendadas...</h3>
                </div>
            )}

            {statusTela === 'vincular' && (
                <form onSubmit={lidarComVinculoAparelho} style={{ border: '1px solid #cbd5e1', padding: '25px', borderRadius: '12px', textAlign: 'left' }}>
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
                    <h2 style={{ color: '#0f172a', marginBottom: '5px', fontWeight: '800' }}>Portal Formar</h2>
                    <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '25px' }}>Selecione a formação para assinar a frequência.</p>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        {eventos.map(ev => {
                            const distancia = coords.lat && coords.lng ? calcularDistanciaCliente(coords.lat, coords.lng, parseFloat(ev.latitude), parseFloat(ev.longitude)) : 9999;
                            const estaNoRaio = distancia <= 1000;

                            return (
                                <button
                                    key={ev.id} onClick={() => selecionarEvento(ev)} disabled={!estaNoRaio}
                                    style={{
                                        display: 'flex', flexDirection: 'column', gap: '8px', padding: '20px', borderRadius: '16px',
                                        border: estaNoRaio ? 'none' : '1px solid #e5e7eb', cursor: estaNoRaio ? 'pointer' : 'not-allowed',
                                        background: estaNoRaio ? 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)' : '#f8fafc',
                                        color: estaNoRaio ? '#ffffff' : '#9ca3af', width: '100%', transition: 'all 0.3s ease', textAlign: 'left',
                                        boxShadow: estaNoRaio ? '0 10px 25px -5px rgba(2, 132, 199, 0.4)' : 'none'
                                    }}
                                >
                                    <div style={{ fontSize: '18px', fontWeight: '800', marginBottom: '4px', lineHeight: '1.2' }}>{ev.titulo}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', opacity: 0.95 }}>📍 {ev.local}</div>
                                    
                                    {ev.palestrante && (
                                        <div style={{ fontSize: '13px', opacity: 0.95, marginTop: '4px', backgroundColor: estaNoRaio ? 'rgba(255,255,255,0.2)' : '#e2e8f0', padding: '4px 8px', borderRadius: '6px', fontWeight: '600', color: estaNoRaio ? '#fff' : '#64748b' }}>
                                            🎤 Palestrante: {ev.palestrante}
                                        </div>
                                    )}
                                    
                                    {!estaNoRaio && coords.lat && (
                                        <div style={{ marginTop: '12px', padding: '10px', borderRadius: '8px', backgroundColor: '#fee2e2', color: '#b91c1c', fontSize: '13px', fontWeight: 'bold', textAlign: 'center', width: '100%', boxSizing: 'border-box' }}>
                                            🔒 Dirija-se ao local para liberar o acesso.
                                        </div>
                                    )}
                                    {!coords.lat && (
                                        <div style={{ marginTop: '12px', fontSize: '13px', fontStyle: 'italic', opacity: 0.8, textAlign: 'center', width: '100%' }}>
                                            📡 Buscando sinal para liberar acesso...
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {statusTela === 'modal_pergunta' && conteudoModal && (
                <div style={{ border: '1px solid #e2e8f0', padding: '25px', borderRadius: '12px', backgroundColor: '#f8fafc', marginTop: '20px' }}>
                    <p style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '25px' }}>{conteudoModal.texto}</p>
                    <div style={{ display: 'flex', gap: '15px' }}>
                        <button onClick={() => setStatusTela('listagem')} style={{ flex: 1, padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#64748b', fontWeight: 'bold', cursor: 'pointer' }}>Voltar</button>
                        <button onClick={processarAceiteModal} style={{ flex: 1, padding: '14px', borderRadius: '8px', border: 'none', backgroundColor: '#16a34a', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>Sim, confirmar</button>
                    </div>
                </div>
            )}

            {statusTela === 'pesquisa' && (
                <form onSubmit={submeterPesquisaSaida} style={{ border: '1px solid #e2e8f0', padding: '25px', borderRadius: '12px', textAlign: 'left', marginTop: '20px', backgroundColor: '#fff' }}>
                    <h3 style={{ marginTop: 0, color: '#0f172a', fontWeight: '800' }}>Pesquisa de Satisfação</h3>
                    <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>Sua avaliação é essencial para nós.</p>
                    <select value={estrelas} onChange={(e) => setEstrelas(Number(e.target.value))} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '15px', fontSize: '14px' }}>
                        <option value="5">⭐⭐⭐⭐⭐ Excelência total</option>
                        <option value="4">⭐⭐⭐⭐ Muito Bom</option>
                        <option value="3">⭐⭐⭐ Atendeu às expectativas</option>
                        <option value="2">⭐⭐ Regular</option>
                        <option value="1">⭐ Precisa melhorar bastante</option>
                    </select>
                    <textarea rows="3" value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Deixe um comentário (Opcional)..." style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', marginBottom: '15px', fontSize: '14px' }} />
                    <button type="submit" style={{ width: '100%', padding: '14px', borderRadius: '8px', border: 'none', backgroundColor: '#0284c7', color: '#fff', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' }}>Enviar Avaliação & Concluir Saída</button>
                </form>
            )}

            {statusTela === 'sucesso_final' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', padding: '10px' }}>
                    <div style={{ fontSize: '70px', marginBottom: '15px' }}>✅</div>
                    <h2 style={{ color: '#166534', marginBottom: '12px', fontSize: '26px', fontWeight: '800' }}>Frequência Registrada!</h2>
                    <p style={{ color: '#4b5563', fontSize: '16px', lineHeight: '1.6' }}>Sua presença foi salva com sucesso no sistema da Subsecretaria.</p>
                    <div style={{ marginTop: '30px', padding: '12px 20px', backgroundColor: '#f1f5f9', borderRadius: '12px', fontSize: '13px', color: '#64748b' }}>Desconectando por segurança em instantes...</div>
                </div>
            )}

            {statusTela === 'encerrado' && (
                <div style={{ marginTop: '40px' }}>
                    <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>Nenhuma operação ativa disponível no momento.</p>
                </div>
            )}
        </div>
    );
}