import React, { useState, useEffect } from 'react';

const API_URL = window.location.origin.includes('localhost') ? 'http://localhost:3009' : '';

const calcularDistanciaCliente = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Raio da Terra em metros
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
    const [debugMsg, setDebugMsg] = useState('Iniciando rastreamento de telemetria...');
    
    const [matriculaInput, setMatriculaInput] = useState('');
    const [funcaoSelecionada, setFuncaoSelecionada] = useState('Ouvinte');
    const [alerta, setAlerta] = useState({ texto: '', tipo: '' });
    
    const [estrelas, setEstrelas] = useState(5);
    const [comentario, setComentario] = useState('');
    const [conteudoModal, setConteudoModal] = useState({ tipo: '', texto: '' });

    const dispararAlerta8Segundos = (texto, tipo = 'erro') => {
        setAlerta({ texto, tipo });
        setTimeout(() => setAlerta({ texto: '', tipo: '' }), 8000);
    };

    // Função de Captura de GPS com Plano B Inteligente Integrado
    const obterLocalizacaoGPS = () => {
        if (!navigator.geolocation) {
            setDebugMsg('❌ Erro: Navegador não suporta geolocalização.');
            dispararAlerta8Segundos('Seu navegador não possui suporte a GPS.', 'erro');
            return;
        }

        setDebugMsg('📡 Solicitando alta precisão ao satélite...');
        
        const sucesso = (pos) => {
            setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            setDebugMsg(`✅ GPS Conectado: Lat ${pos.coords.latitude.toFixed(4)}, Lng ${pos.coords.longitude.toFixed(4)}`);
        };

        const erroAltaPrecisao = (err) => {
            setDebugMsg(`⚠️ Satélite falhou (${err.message}). Tentando Antenas de Celular/Wi-Fi...`);
            navigator.geolocation.getCurrentPosition(
                sucesso,
                (erroFatal) => {
                    setDebugMsg(`❌ Falha total no GPS: Código ${erroFatal.code} - ${erroFatal.message}`);
                    dispararAlerta8Segundos('Ative o GPS, o Wi-Fi e garanta permissão de localização no navegador.', 'erro');
                },
                { enableHighAccuracy: false, timeout: 12000, maximumAge: 5000 }
            );
        };

        navigator.geolocation.getCurrentPosition(sucesso, erroAltaPrecisao, {
            enableHighAccuracy: true,
            timeout: 7000,
            maximumAge: 0
        });
    };

    useEffect(() => {
        obterLocalizacaoGPS();
        const intervaloGPS = setInterval(obterLocalizacaoGPS, 20000); // Atualiza a cada 20s
        
        if (deviceToken) {
            carregarEventosDisponiveis();
        } else {
            setStatusTela('associar_aparelho');
        }

        return () => clearInterval(intervaloGPS);
    }, [deviceToken]);

    const carregarEventosDisponiveis = async () => {
        try {
            setDebugMsg('📦 Buscando eventos cadastrados na API...');
            const res = await fetch(`${API_URL}/api/v2/eventos/disponiveis`);
            if (!res.ok) throw new Error('Não foi possível carregar a lista de formações.');
            const dados = await res.json();
            setEventos(dados);
            setStatusTela('listagem');
            setDebugMsg(`✅ ${dados.length} eventos carregados da API.`);
        } catch (err) {
            setDebugMsg(`❌ Erro de carregamento: ${err.message}`);
            dispararAlerta8Segundos(err.message, 'erro');
        }
    };

    const associarEsteAparelho = async (e) => {
        e.preventDefault();
        if (!matriculaInput.trim()) return;
        try {
            setDebugMsg('🔗 Enviando solicitação de associação de dispositivo...');
            const res = await fetch(`${API_URL}/api/v2/dispositivos/associar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ matricula: matriculaInput, funcao: funcaoSelecionada })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro na associação');
            
            localStorage.setItem('device_token', data.device_token);
            setDeviceToken(data.device_token);
            setDebugMsg('✅ Aparelho associado e token guardado em cache.');
        } catch (err) {
            dispararAlerta8Segundos(err.message, 'erro');
        }
    };

    const selecionarEvento = async (ev) => {
        if (!coords.lat || !coords.lng) {
            dispararAlerta8Segundos('Aguardando sinal de localização estável para liberar o acesso.', 'erro');
            return;
        }

        try {
            setDebugMsg(`🔍 Checando status na API para o Evento ID: ${ev.id}...`);
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
            setDebugMsg(`📥 Resposta da API status: ${JSON.stringify(data)}`);

            if (!res.ok) {
                dispararAlerta8Segundos(data.error || 'Acesso negado para esta faixa de horário.', 'erro');
                return;
            }

            setEventoSelecionado(ev);

            if (data.status === 'completo') {
                dispararAlerta8Segundos('Sua frequência já foi totalmente concluída nesta formação.', 'sucesso');
                return;
            }

            if (data.status === 'somente_entrada' || data.status === 'saida_pendente') {
                setConteudoModal({
                    tipo: 'pergunta_saida',
                    texto: `Identificamos sua entrada. Deseja responder à pesquisa e confirmar sua saída da formação "${ev.titulo}"?`
                });
                setStatusTela('modal_pergunta');
                return;
            }

            // Padrão limpo: Não tem frequência ativa, abre modal de confirmação de entrada
            setConteudoModal({
                tipo: 'confirmar_entrada',
                texto: `Deseja registrar sua presença na formação: "${ev.titulo}"?`
            });
            setStatusTela('modal_pergunta');

        } catch (err) {
            setDebugMsg(`❌ Erro no clique do evento: ${err.message}`);
            dispararAlerta8Segundos('Conexão instável. Tente clicar novamente.', 'erro');
        }
    };

    const processarConfirmacaoPresenca = async () => {
        try {
            setDebugMsg('📝 Registrando entrada na tabela frequencias...');
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
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro ao salvar presença');

            dispararAlerta8Segundos('Presença registrada! Bom evento.', 'sucesso');
            carregarEventosDisponiveis();
        } catch (err) {
            dispararAlerta8Segundos(err.message, 'erro');
        }
    };

    const submeterPesquisaSaida = async (e) => {
        e.preventDefault();
        try {
            setDebugMsg('📝 Enviando avaliação e registrando saída no banco...');
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
            
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Erro ao processar sua saída.');
            }

            setEstrelas(5);
            setComentario('');
            setStatusTela('sucesso_final');
            setDebugMsg('🚀 Sucesso total! Iniciando contagem regressiva de 8 segundos para desconectar...');

            setTimeout(() => {
                localStorage.removeItem('device_token'); 
                setDeviceToken('');
                window.location.reload(); 
            }, 8000);

        } catch (err) {
            dispararAlerta8Segundos(err.message, 'erro');
        }
    };

    return (
        <div style={{ maxWidth: '440px', margin: '0 auto', padding: '20px', fontFamily: 'system-ui, sans-serif', backgroundColor: '#fff', minHeight: '100vh', boxSizing: 'border-box' }}>
            
            {/* ALERTAS GLOBAIS DE 8 SEGUNDOS */}
            {alerta.texto && (
                <div style={{
                    position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
                    width: '90%', maxWidth: '400px', padding: '16px', borderRadius: '12px',
                    backgroundColor: alerta.tipo === 'erro' ? '#fee2e2' : '#dcfce7',
                    color: alerta.tipo === 'erro' ? '#991b1b' : '#166534',
                    border: `1px solid ${alerta.tipo === 'erro' ? '#fca5a5' : '#bbf7d0'}`,
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 9999, fontWeight: 'bold', textAlign: 'center'
                }}>
                    {alerta.texto}
                </div>
            )}

            <div style={{ textAlign: 'center', marginBottom: '30px', marginTop: '10px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#0f172a', margin: 0 }}>Portal Formar</h1>
                <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Subsecretaria de Formação Continuada</p>
            </div>

            {statusTela === 'carregando' && <p style={{ textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>Estabelecendo conexão segura...</p>}

            {statusTela === 'associar_aparelho' && (
                <form onSubmit={associarEsteAparelho} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
                    <p style={{ color: '#475569', fontSize: '14px', lineHeight: '1.5', textAlign: 'center' }}>Antes de assinar a chamada, vincule o seu dispositivo informando seus dados cadastrais.</p>
                    <input type="text" placeholder="Digite sua Matrícula" value={matriculaInput} onChange={e => setMatriculaInput(e.target.value)} required style={{ padding: '14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '15px' }} />
                    <select value={funcaoSelecionada} onChange={e => setFuncaoSelecionada(e.target.value)} style={{ padding: '14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '15px', backgroundColor: '#fff' }}>
                        <option value="Ouvinte">Ouvinte / Participante</option>
                        <option value="Palestrante">Palestrante / Formador</option>
                        <option value="Organizador">Equipe de Organização</option>
                    </select>
                    <button type="submit" style={{ padding: '14px', borderRadius: '10px', border: 'none', backgroundColor: '#0f172a', color: '#fff', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' }}>VINCULAR ESTE DISPOSITIVO</button>
                </form>
            )}

            {statusTela === 'listagem' && (
                <div>
                    <h3 style={{ fontSize: '15px', color: '#475569', marginBottom: '15px', fontWeight: '700' }}>Formações em Andamento Hoje:</h3>
                    {eventos.length === 0 ? (
                        <p style={{ color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', marginTop: '30px' }}>Nenhuma formação disponível para assinatura no momento.</p>
                    ) : (
                        eventos.map((ev) => {
                            const distancia = coords.lat && coords.lng ? calcularDistanciaCliente(coords.lat, coords.lng, parseFloat(ev.latitude), parseFloat(ev.longitude)) : 9999;
                            const estaNoRaio = distancia <= 1000;

                            return (
                                <button
                                    key={ev.id} onClick={() => selecionarEvento(ev)} disabled={!estaNoRaio}
                                    style={{
                                        display: 'flex', flexDirection: 'column', gap: '8px', padding: '20px', borderRadius: '16px',
                                        border: estaNoRaio ? 'none' : '1px solid #e5e7eb', cursor: estaNoRaio ? 'pointer' : 'not-allowed',
                                        background: estaNoRaio ? 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)' : '#f8fafc',
                                        color: estaNoRaio ? '#ffffff' : '#9ca3af', width: '100%', marginBottom: '16px', transition: 'all 0.3s ease', textAlign: 'left',
                                        boxShadow: estaNoRaio ? '0 10px 25px -5px rgba(2, 132, 199, 0.4)' : 'none'
                                    }}
                                >
                                    <div style={{ fontSize: '18px', fontWeight: '800', marginBottom: '4px', lineHeight: '1.2' }}>{ev.titulo}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', opacity: 0.95 }}>📍 {ev.local}</div>
                                    {ev.palestrante && (
                                        <div style={{ fontSize: '13px', opacity: 0.95, marginTop: '4px', backgroundColor: estaNoRaio ? 'rgba(255,255,255,0.2)' : '#e2e8f0', padding: '4px 8px', borderRadius: '6px', fontWeight: '600' }}>
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
                        })
                    )}
                </div>
            )}

            {statusTela === 'modal_pergunta' && (
                <div style={{ padding: '20px', borderRadius: '16px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', textAlign: 'center', marginTop: '20px' }}>
                    <h3 style={{ fontSize: '18px', color: '#0f172a', marginBottom: '15px', fontWeight: '800' }}>Confirmação Requerida</h3>
                    <p style={{ color: '#475569', fontSize: '15px', lineHeight: '1.6', marginBottom: '25px' }}>{conteudoModal.texto}</p>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={() => carregarEventosDisponiveis()} style={{ flex: 1, padding: '14px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontWeight: 'bold', cursor: 'pointer', color: '#475569' }}>Voltar</button>
                        <button 
                            onClick={() => {
                                if (conteudoModal.tipo === 'confirmar_entrada') {
                                    processarConfirmacaoPresenca();
                                } else {
                                    setStatusTela('pesquisa');
                                }
                            }} 
                            style={{ flex: 1, padding: '14px', borderRadius: '10px', border: 'none', backgroundColor: '#0284c7', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                            Sim, Confirmar
                        </button>
                    </div>
                </div>
            )}

            {statusTela === 'pesquisa' && (
                <form onSubmit={submeterPesquisaSaida} style={{ marginTop: '20px', padding: '20px', borderRadius: '16px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginBottom: '10px', textAlign: 'center' }}>Pesquisa de Satisfação</h3>
                    <p style={{ color: '#475569', fontSize: '14px', textAlign: 'center', marginBottom: '20px' }}>Como você avalia a qualidade desta formação?</p>
                    <select value={estrelas} onChange={e => setEstrelas(Number(e.target.value))} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', marginBottom: '15px', backgroundColor: '#fff', fontSize: '14px' }}>
                        <option value="5">⭐⭐⭐⭐⭐ Excelente</option>
                        <option value="4">⭐⭐⭐⭐ Muito Bom</option>
                        <option value="3">⭐⭐⭐ Bom</option>
                        <option value="2">⭐⭐ Regular</option>
                        <option value="1">⭐ Ruim</option>
                    </select>
                    <textarea rows="3" value={comentario} onChange={e => setComentario(e.target.value)} placeholder="Deixe um comentário ou sugestão (Opcional)..." style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box', marginBottom: '20px', fontSize: '14px' }} />
                    <button type="submit" style={{ width: '100%', padding: '14px', borderRadius: '10px', border: 'none', backgroundColor: '#0284c7', color: '#fff', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' }}>Enviar Avaliação & Concluir Saída</button>
                </form>
            )}

            {statusTela === 'sucesso_final' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', padding: '20px' }}>
                    <div style={{ fontSize: '70px', marginBottom: '15px' }}>✅</div>
                    <h2 style={{ color: '#166534', marginBottom: '12px', fontSize: '26px', fontWeight: '800' }}>Frequência Registrada!</h2>
                    <p style={{ color: '#4b5563', fontSize: '#16px', lineHeight: '1.6', maxWidth: '320px', margin: '0 auto' }}>Sua participação e avaliação foram salvas com sucesso no sistema da Subsecretaria.</p>
                    <p style={{ color: '#0284c7', fontSize: '15px', marginTop: '15px', fontWeight: 'bold' }}>Agradecemos a sua colaboração!</p>
                    <div style={{ marginTop: '40px', padding: '12px 20px', backgroundColor: '#f1f5f9', borderRadius: '12px', fontSize: '12px', color: '#64748b' }}>Desconectando com segurança para liberar recursos do servidor...</div>
                </div>
            )}

            {/* CONSOLE DE DEPURAÇÃO VISUAL (EXCLUSIVO PARA VOCÊ MONITORAR NO CELULAR) */}
            <div style={{ marginTop: '50px', padding: '12px', backgroundColor: '#0f172a', borderRadius: '10px', border: '1px solid #1e293b' }}>
                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#38bdf8', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>🖥️ Telemetria de Depuração (Console Ativo)</div>
                <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#94a3b8', lineHeight: '1.4', wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>{debugMsg}</div>
            </div>

        </div>
    );
}