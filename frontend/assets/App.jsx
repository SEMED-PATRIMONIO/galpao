import React, { useState, useEffect } from 'react';

const API_URL = window.location.origin.includes('localhost') ? 'http://localhost:3009' : '';

// Helper para calcular a distância direto no cliente
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
    // Inicializa pegando o token existente ou vazio para novos dispositivos
    const [deviceToken, setDeviceToken] = useState(localStorage.getItem('device_token') || ''); 
    const [statusTela, setStatusTela] = useState('carregando'); // carregando | vincular | listagem | modal_pergunta | pesquisa | encerrado
    const [eventos, setEventos] = useState([]);
    const [eventoSelecionado, setEventoSelecionado] = useState(null);
    const [coords, setCoords] = useState({ lat: null, lng: null });
    
    // Formulário de Vínculo de Novo Aparelho
    const [matriculaInput, setMatriculaInput] = useState('');
    const [nomeInput, setNomeInput] = useState('');

    // Estados de Alerta e Modais
    const [alerta, setAlerta] = useState({ visivel: false, msg: '', tipo: 'sucesso' });
    const [conteudoModal, setConteudoModal] = useState(null);

    // Formulário da pesquisa
    const [estrelas, setEstrelas] = useState(5);
    const [comentario, setComentario] = useState('');

    // Alerta temporizado estrito de 8 segundos
    const dispararAlerta8Segundos = (mensagem, tipo = 'erro', acaoPosterior = null) => {
        setAlerta({ visivel: true, msg: mensagem, tipo });
        setTimeout(() => {
            setAlerta({ visivel: false, msg: '', tipo: 'sucesso' });
            if (acaoPosterior) acaoPosterior();
        }, 8000);
    };

    // Executado ao abrir o App para verificar se o aparelho já é conhecido ou novo
    useEffect(() => {
        if (!deviceToken) {
            setStatusTela('vincular'); // Se não tem token, é um novo aparelho. Vai pro cadastro.
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

            // CORREÇÃO CRÍTICA: Se retornar 401, limpa o token corrompido e abre a tela de cadastro
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

    // Ação para associar novos aparelhos em tempo real
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

            // Salva o novo token gerado
            localStorage.setItem('device_token', data.device_token);
            setDeviceToken(data.device_token);
            dispararAlerta8Segundos('APARELHO VINCULADO COM SUCESSO!', 'sucesso');
        } catch (err) {
            dispararAlerta8Segundos('Erro de rede ao tentar associar dispositivo.', 'erro');
        }
    };

    const obterLocalizacaoGPS = () => {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            },
            () => {
                dispararAlerta8Segundos('Ative o GPS do seu dispositivo para validar a distância do local.', 'erro');
            },
            { enableHighAccuracy: true }
        );
    };

    const selecionarEvento = async (ev) => {
        if (!coords.lat || !coords.lng) {
            dispararAlerta8Segundos('Aguardando capturar sua localização geográfica...', 'erro');
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
                dispararAlerta8Segundos(`Já consta entrada e saída registrada para este evento:\n${data.titulo}\nLocal: ${data.local}`, 'sucesso');
                return;
            }

            if (data.status === 'somente_entrada') {
                if (data.minutos >= 30) {
                    setConteudoModal({
                        tipo: 'pergunta_saida',
                        texto: `Identificamos sua entrada há ${data.minutos} minutos. Você está realmente indo embora da formação?`
                    });
                    setStatusTela('modal_pergunta');
                } else {
                    dispararAlerta8Segundos('Sua entrada já está registrada. Para assinar a saída, aguarde o tempo mínimo de permanência.', 'erro');
                }
                return;
            }

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
            setStatusTela('pesquisa');
        }
    };

    return (
        <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px', maxWidth: '450px', margin: '0 auto', textAlign: 'center', color: '#333' }}>
            
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

            {statusTela === 'carregando' && (
                <div style={{ padding: '30px' }}>
                    <h3 style={{ color: '#0284c7' }}>Verificando conexão física...</h3>
                    <p style={{ color: '#666', fontSize: '13px' }}>Aguarde enquanto estruturamos o painel de frequências.</p>
                </div>
            )}

            {/* NOVA TELA AUTOMÁTICA PARA NOVOS DISPOSITIVOS */}
            {statusTela === 'vincular' && (
                <form onSubmit={lidarComVinculoAparelho} style={{ border: '1px solid #cbd5e1', padding: '25px', borderRadius: '12px', backgroundColor: '#ffffff', textAlign: 'left' }}>
                    <h2 style={{ color: '#1e3a8a', marginTop: 0, textAlign: 'center' }}>Vincular Aparelho</h2>
                    <p style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', marginBottom: '20px' }}>Identificamos que este dispositivo é novo. Cadastre-o para liberar a assinatura automática.</p>
                    
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '13px' }}>Matrícula do Professor:</label>
                        <input type="text" value={matriculaInput} onChange={e => setMatriculaInput(e.target.value)} placeholder="Ex: 15013/2" required style={{ width: '100%', padding: '11px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '13px' }}>Nome Completo:</label>
                        <input type="text" value={nomeInput} onChange={e => setNomeInput(e.target.value)} placeholder="Digite seu nome" required style={{ width: '100%', padding: '11px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                    </div>

                    <button type="submit" style={{ width: '100%', padding: '14px', borderRadius: '6px', border: 'none', backgroundColor: '#1e3a8a', color: '#fff', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' }}>
                        VINCULAR MEU DISPOSITIVO
                    </button>
                </form>
            )}

            {statusTela === 'listagem' && (
                <div>
                    <h2 style={{ color: '#1e3a8a', marginBottom: '5px' }}>Portal de Presença</h2>
                    <p style={{ color: '#666', fontSize: '13px', marginBottom: '25px' }}>Selecione abaixo a formação que você está participando para assinar a frequência.</p>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        {eventos.map(ev => {
                            const distancia = coords.lat && coords.lng ? calcularDistanciaCliente(coords.lat, coords.lng, parseFloat(ev.latitude), parseFloat(ev.longitude)) : 999;
                            const estaNoRaio = distancia <= 60;

                            return (
                                <button
                                    key={ev.id}
                                    onClick={() => selecionarEvento(ev)}
                                    disabled={!estaNoRaio}
                                    style={{
                                        padding: '16px', borderRadius: '10px', border: 'none', fontWeight: 'bold', fontSize: '15px',
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

            {statusTela === 'modal_pergunta' && conteudoModal && (
                <div style={{ border: '1px solid #e2e8f0', padding: '25px', borderRadius: '12px', backgroundColor: '#f8fafc', marginTop: '20px' }}>
                    <p style={{ fontSize: '16px', fontWeight: '500', lineHeight: '1.5', marginBottom: '25px' }}>{conteudoModal.texto}</p>
                    <div style={{ display: 'flex', gap: '15px' }}>
                        <button onClick={processarAceiteModal} style={{ flex: 1, padding: '12px', borderRadius: '6px', border: 'none', backgroundColor: '#16a34a', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>Sim, confirmar</button>
                        <button onClick={() => setStatusTela('listagem')} style={{ flex: 1, padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#64748b', fontWeight: 'bold', cursor: 'pointer' }}>Não, retornar</button>
                    </div>
                </div>
            )}

            {statusTela === 'pesquisa' && (
                <form onSubmit={submeterPesquisaSaida} style={{ border: '1px solid #e2e8f0', padding: '25px', borderRadius: '12px', textAlign: 'left', marginTop: '20px' }}>
                    <h3 style={{ marginTop: 0, color: '#1e3a8a' }}>Pesquisa de Satisfação</h3>
                    <select value={estrelas} onChange={(e) => setEstrelas(Number(e.target.value))} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '15px' }}>
                        <option value="5">⭐⭐⭐⭐⭐ Excelência total</option>
                        <option value="4">⭐⭐⭐⭐ Muito Bom</option>
                        <option value="3">⭐⭐⭐ Atendeu às expectativas</option>
                        <option value="2">⭐⭐ Regular</option>
                        <option value="1">⭐ Precisa melhorar bastante</option>
                    </select>
                    <textarea rows="3" value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Deixe aqui sugestões ou observações..." style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', marginBottom: '15px' }} />
                    <button type="submit" style={{ width: '100%', padding: '14px', borderRadius: '6px', border: 'none', backgroundColor: '#0284c7', color: '#fff', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' }}>Enviar Avaliação & Concluir Saída</button>
                </form>
            )}

            {statusTela === 'encerrado' && (
                <div style={{ marginTop: '40px' }}>
                    <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>Nenhuma operação ativa disponível no momento.</p>
                </div>
            )}
        </div>
    );
}