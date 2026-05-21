import React, { useState, useEffect } from 'react';

const API_URL = window.location.origin.includes('localhost') ? 'http://localhost:3009' : '';

// Helper para calcular a distância direto no cliente e ativar os botões dinamicamente
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
    const [deviceToken] = useState(localStorage.getItem('device_token') || 'token_teste_prof'); 
    const [statusTela, setStatusTela] = useState('carregando'); // carregando | listagem | modal_pergunta | pesquisa | encerrado
    const [eventos, setEventos] = useState([]);
    const [eventoSelecionado, setEventoSelecionado] = useState(null);
    const [coords, setCoords] = useState({ lat: null, lng: null });
    
    // Estados de Alerta e Mensagens
    const [alerta, setAlerta] = useState({ visivel: false, msg: '', tipo: 'sucesso' });
    const [conteudoModal, setConteudoModal] = useState(null);

    // Formulário da pesquisa
    const [estrelas, setEstrelas] = useState(5);
    const [comentario, setComentario] = useState('');

    // Disparador de Alerta de Exatos 8 Segundos
    const dispararAlerta8Segundos = (mensagem, tipo = 'erro', acaoPosterior = null) => {
        setAlerta({ visivel: true, msg: mensagem, tipo });
        setTimeout(() => {
            setAlerta({ visivel: false, msg: '', tipo: 'sucesso' });
            if (acaoPosterior) acaoPosterior();
        }, 8000);
    };

    // 1. Passo Inicial: Executado ao abrir o App
    useEffect(() => {
        const inicializarApp = async () => {
            try {
                const res = await fetch(`${API_URL}/api/v2/presenca/inicializar`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ device_token: deviceToken })
                });
                const data = await res.json();

                if (data.status === 'sem_eventos' || data.status === 'fora_horario') {
                    dispararAlerta8Segundos(data.mensagem, 'erro', () => setStatusTela('encerrado'));
                    return;
                }

                if (data.status === 'sucesso') {
                    setEventos(data.eventos);
                    setStatusTela('listagem');
                    obterLocalizacaoEAtivarBotoes(data.eventos);
                } else {
                    dispararAlerta8Segundos(data.error || 'Erro de conexão.', 'erro');
                }
            } catch (err) {
                dispararAlerta8Segundos('Não foi possível contatar o servidor.', 'erro');
            }
        };

        inicializarApp();
    }, [deviceToken]);

    // 2. Passo de Localização: Ativa botões caso esteja dentro do raio de 60 metros
    const obterLocalizacaoEAtivarBotoes = (listaEventosAtuais) => {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            },
            () => {
                dispararAlerta8Segundos('Por favor, conceda permissão de localização para ativar os eventos.', 'erro');
            },
            { enableHighAccuracy: true }
        );
    };

    // 3. Ao Clicar em um Evento Elegível/Ativo
    const selecionarEvento = async (ev) => {
        if (!coords.lat || !coords.lng) {
            dispararAlerta8Segundos('Aguardando coordenadas de localização...', 'erro');
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
                dispararAlerta8Segundos(data.error || 'Erro na validação do local.', 'erro');
                return;
            }

            setEventoSelecionado(ev);

            // Cenário 1: Entrada e Saída Concluídas
            if (data.status === 'completo') {
                dispararAlerta8Segundos(`Já consta entrada e saída registrada para este evento:\n${data.titulo}\nLocal: ${data.local}`, 'sucesso');
                return;
            }

            // Cenário 2: Apenas Entrada feita previamente
            if (data.status === 'somente_entrada') {
                if (data.minutos >= 30) {
                    setConteudoModal({
                        tipo: 'pergunta_saida',
                        texto: `Identificamos sua entrada há ${data.minutos} minutos. Você está realmente indo embora da formação?`
                    });
                    setStatusTela('modal_pergunta');
                } else {
                    // Se tiver menos de 30 minutos, fecha sem alarde conforme a regra
                    dispararAlerta8Segundos('Sua entrada já está registrada. Para registrar a saída, aguarde o tempo mínimo de permanência.', 'erro');
                }
                return;
            }

            // Cenário 3: Sem nenhum registro técnico prévio
            if (data.status === 'nenhum') {
                setConteudoModal({
                    tipo: 'confirmar_entrada',
                    texto: `Deseja mesmo registrar sua participação na formação: "${ev.titulo}"?`
                });
                setStatusTela('modal_pergunta');
            }

        } catch (err) {
            dispararAlerta8Segundos('Erro de comunicação com o servidor.', 'erro');
        }
    };

    // Ações de Confirmação dos Modals
    const processarAceiteModal = async () => {
        if (conteudoModal.tipo === 'confirmar_entrada') {
            try {
                const res = await fetch(`${API_URL}/api/v2/presenca/confirmar-entrada`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ device_token: deviceToken, evento_id: eventoSelecionado.id })
                });
                if (res.ok) {
                    dispararAlerta8Segundos('REGISTRO EFETUADO!', 'sucesso', () => setStatusTela('listagem'));
                }
            } catch (e) {
                dispararAlerta8Segundos('Falha ao registrar entrada.', 'erro');
            }
        } else if (conteudoModal.tipo === 'pergunta_saida') {
            // Avança para o formulário de satisfação
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
                dispararAlerta8Segundos('REGISTRO EFETUADO!', 'sucesso', () => {
                    setEstrelas(5);
                    setComentario('');
                    setStatusTela('listagem');
                });
            }
        } catch (err) {
            dispararAlerta8Segundos('Erro ao processar sua saída.', 'erro');
        }
    };

    // Renderizadores de Interface Dinâmica
    return (
        <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px', maxWidth: '500px', margin: '0 auto', textAlign: 'center', color: '#333' }}>
            
            {/* ALERTAS FLUTUANTES DE 8 SEGUNDOS */}
            {alerta.visivel && (
                <div style={{
                    backgroundColor: alerta.tipo === 'sucesso' ? '#d4edda' : '#f8d7da',
                    color: alerta.tipo === 'sucesso' ? '#155724' : '#721c24',
                    padding: '15px', borderRadius: '8px', marginBottom: '20px',
                    fontWeight: 'bold', border: `1px solid ${alerta.tipo === 'sucesso' ? '#c3e6cb' : '#f5c6cb'}`
                }}>
                    {alerta.msg.split('\n').map((str, i) => <div key={i}>{str}</div>)}
                </div>
            )}

            {/* STATUS 1: CARREGANDO INICIAL */}
            {statusTela === 'carregando' && (
                <div>
                    <h3 style={{ color: '#0284c7' }}>Buscando eventos presenciais...</h3>
                    <p style={{ color: '#666', fontSize: '14px' }}>Aguarde enquanto validamos as credenciais e listamos os agendamentos de hoje.</p>
                </div>
            )}

            {/* STATUS 2: LISTAGEM DE BOTÕES INTUITIVOS */}
            {statusTela === 'listagem' && (
                <div>
                    <h2 style={{ color: '#1e3a8a', marginBottom: '5px' }}>Portal de Presença</h2>
                    <p style={{ color: '#666', fontSize: '13px', marginBottom: '25px' }}>Selecione abaixo a formação que você está participando para assinar a frequência.</p>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        {eventos.map(ev => {
                            // Calcula se está dentro do raio no dispositivo do cliente
                            const distancia = coords.lat && coords.lng ? calcularDistanciaCliente(coords.lat, coords.lng, parseFloat(ev.latitude), parseFloat(ev.longitude)) : 999;
                            const estaNoRaio = distancia <= 60;

                            return (
                                <button
                                    key={ev.id}
                                    onClick={() => selecionarEvento(ev)}
                                    disabled={!estaNoRaio}
                                    style={{
                                        padding: '16px',
                                        borderRadius: '10px',
                                        border: 'none',
                                        fontWeight: 'bold',
                                        fontSize: '15px',
                                        cursor: estaNoRaio ? 'pointer' : 'not-allowed',
                                        backgroundColor: estaNoRaio ? '#0284c7' : '#e5e7eb',
                                        color: estaNoRaio ? '#ffffff' : '#9ca3af',
                                        boxShadow: estaNoRaio ? '0 4px 6px -1px rgba(2,132,199,0.3)' : 'none',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <div style={{ textAlign: 'left' }}>
                                        <div style={{ fontSize: '16px', marginBottom: '4px' }}>{ev.titulo}</div>
                                        <div style={{ fontSize: '12px', opacity: 0.9, fontWeight: 'normal' }}>📍 {ev.local}</div>
                                        {!estaNoRaio && <div style={{ fontSize: '11px', marginTop: '6px', fontStyle: 'italic' }}>Dispositivo fora do raio de alcance deste local</div>}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* STATUS 3: MODAL DE PERGUNTA AMIGÁVEL (ENTRADA OU SAÍDA) */}
            {statusTela === 'modal_pergunta' && conteudoModal && (
                <div style={{ border: '1px solid #e2e8f0', padding: '25px', borderRadius: '12px', backgroundColor: '#f8fafc', marginTop: '20px' }}>
                    <p style={{ fontSize: '16px', fontWeight: '500', lineHeight: '1.5', marginBottom: '25px' }}>{conteudoModal.texto}</p>
                    <div style={{ display: 'flex', gap: '15px' }}>
                        <button 
                            onClick={processarAceiteModal}
                            style={{ flex: 1, padding: '12px', borderRadius: '6px', border: 'none', backgroundColor: '#16a34a', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                            Sim, confirmar
                        </button>
                        <button 
                            onClick={() => setStatusTela('listagem')}
                            style={{ flex: 1, padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#64748b', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                            Não, retornar
                        </button>
                    </div>
                </div>
            )}

            {/* STATUS 4: FORMULÁRIO COMPACTO DE SATISFAÇÃO */}
            {statusTela === 'pesquisa' && (
                <form onSubmit={submeterPesquisaSaida} style={{ border: '1px solid #e2e8f0', padding: '25px', borderRadius: '12px', textAlign: 'left', marginTop: '20px' }}>
                    <h3 style={{ marginTop: 0, color: '#1e3a8a' }}>Pesquisa de Satisfação</h3>
                    <p style={{ fontSize: '13px', color: '#666' }}>Sua opinião é fundamental para avaliarmos a qualidade desta formação técnica.</p>
                    
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '14px' }}>Como você avalia o evento?</label>
                        <select 
                            value={estrelas} 
                            onChange={(e) => setEstrelas(Number(e.target.value))}
                            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                        >
                            <option value="5">⭐⭐⭐⭐⭐ Excelência total</option>
                            <option value="4">⭐⭐⭐⭐ Muito Bom</option>
                            <option value="3">⭐⭐⭐ Atendeu às expectativas</option>
                            <option value="2">⭐⭐ Regular</option>
                            <option value="1">⭐ Precisa melhorar bastante</option>
                        </select>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '14px' }}>Comentários adicionais (Opcional):</label>
                        <textarea 
                            rows="3"
                            value={comentario}
                            onChange={(e) => setComentario(e.target.value)}
                            placeholder="Deixe aqui sugestões ou observações..."
                            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                        />
                    </div>

                    <button 
                        type="submit"
                        style={{ width: '100%', padding: '14px', borderRadius: '6px', border: 'none', backgroundColor: '#0284c7', color: '#fff', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' }}
                    >
                        Enviar Avaliação & Concluir Saída
                    </button>
                </form>
            )}

            {/* STATUS 5: SESSÃO ENCERRADA AMIGAVELMENTE */}
            {statusTela === 'encerrado' && (
                <div style={{ marginTop: '40px' }}>
                    <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>Nenhuma operação ativa disponível no momento.</p>
                </div>
            )}
        </div>
    );
}