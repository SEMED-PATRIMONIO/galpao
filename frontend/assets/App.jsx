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
    return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), horas, minutos, 0);
};

export default function App() {
    const [statusFluxo, setStatusFluxo] = useState('carregando');
    const [eventoAtual, setEventoAtual] = useState(null);
    const [listaEventos, setListaEventos] = useState([]);
    const [alertaMsg, setAlertaMsg] = useState('');
    const [coords, setCoords] = useState({ lat: null, lng: null });
    const [msgErro, setMsgErro] = useState('');
    const [msgSucesso, setMsgSucesso] = useState('');
    const [carregandoAcao, setCarregandoAcao] = useState(false);

    const [avaliacao, setAvaliacao] = useState('Ótimo');
    const [comentarios, setComentarios] = useState('');

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

    const exibirAlertaTemporizado = (msg) => {
        setAlertaMsg(msg);
        setTimeout(() => setAlertaMsg(''), 7000);
    };

    const dispararChecagem = async (localCoords, evIdForçado) => {
        const dKey = localStorage.getItem('device_token') || localStorage.getItem('device_key');
        if (!dKey) {
            setStatusFluxo('erro');
            exibirAlertaTemporizado('Aparelho sem vínculo ativo. Por favor, vincule este dispositivo primeiro.');
            return;
        }

        try {
            const res = await fetch(`${API_URL}/api/v2/presenca/inicializar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ device_key: dKey })
            });

            if (res.status === 401) {
                setStatusFluxo('erro');
                exibirAlertaTemporizado('Vínculo inválido ou revogado.');
                return;
            }

            const data = await res.json();
            if (data.status === 'sucesso') {
                setListaEventos(data.eventos);
                
                let idAlvo = evIdForçado || data.evento_ativo_id;
                if (idAlvo) {
                    const evAtivo = data.eventos.find(e => e.id === idAlvo);
                    if (evAtivo) {
                        setEventoAtual(evAtivo);
                        setStatusFluxo(data.tem_evento_ativo ? 'pesquisa' : 'entrada');
                        return;
                    }
                }

                if (data.eventos.length === 1) {
                    setEventoAtual(data.eventos[0]);
                    setStatusFluxo(data.tem_evento_ativo ? 'pesquisa' : 'entrada');
                } else if (data.eventos.length > 1) {
                    setStatusFluxo('multiplos');
                } else {
                    setStatusFluxo('erro');
                    exibirAlertaTemporizado('Nenhuma atividade agendada ou disponível para o dia de hoje.');
                }
            } else {
                setStatusFluxo('erro');
                exibirAlertaTemporizado(data.error || 'Falha na resposta da inicialização.');
            }
        } catch (err) {
            setStatusFluxo('erro');
            exibirAlertaTemporizado('Sem comunicação com o servidor de validação.');
        }
    };

    const selecionarAtividadeManual = (ev) => {
        setEventoAtual(ev);
        setStatusFluxo('entrada');
    };
    const dispararRegistroPresenca = async () => {
        if (!coords.lat || !coords.lng) {
            exibirAlertaTemporizado('Aguardando capturar sua localização exata. Tente novamente.');
            return;
        }

        const dKey = localStorage.getItem('device_token') || localStorage.getItem('device_key');
        const agora = obterAgoraSaoPaulo();
        const dataInicioOficial = obterDataComHorarioString(eventoAtual.hora_inicio);
        const dataTerminoOficial = obterDataComHorarioString(eventoAtual.hora_fim);

        const limiteEntradaInicio = new Date(dataInicioOficial.getTime() - 30 * 60000);
        const limiteEntradaFim = new Date(dataTerminoOficial.getTime() - 30 * 60000);

        if (agora < limiteEntradaInicio || agora > limiteEntradaFim) {
            exibirAlertaTemporizado(`Entrada não permitida neste horário. Janela elegível: ${limiteEntradaInicio.toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})} até ${limiteEntradaFim.toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})}`);
            return;
        }

        const distancia = calcularDistanciaCliente(coords.lat, coords.lng, parseFloat(eventoAtual.latitude), parseFloat(eventoAtual.longitude));
        if (distancia > 1000) {
            exibirAlertaTemporizado(`Bloqueio de Perímetro: Você está fora do raio permitido da formação (Distância: ${(distancia/1000).toFixed(1)}km).`);
            return;
        }

        setCarregandoAcao(true);
        try {
            const res = await fetch(`${API_URL}/api/v2/presencas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    device_key: dKey,
                    evento_id: eventoAtual.id,
                    lat_entrada: coords.lat,
                    lng_entrada: coords.lng
                })
            });

            const data = await res.json();
            if (res.ok && data.status === 'sucesso') {
                setStatusFluxo('pesquisa');
            } else {
                exibirAlertaTemporizado(data.error || 'Erro ao validar entrada.');
            }
        } catch (err) {
            exibirAlertaTemporizado('Falha na comunicação com o servidor de presença.');
        } finally {
            setCarregandoAcao(false);
        }
    };

    const salvarAvaliacaoEConfirmarSaida = async (e) => {
        e.preventDefault();
        const dKey = localStorage.getItem('device_token') || localStorage.getItem('device_key');
        const agora = obterAgoraSaoPaulo();
        const dataTerminoOficial = obterDataComHorarioString(eventoAtual.hora_fim);

        const limiteSaidaInicio = new Date(dataTerminoOficial.getTime() - 30 * 60000);
        const limiteSaidaFim = new Date(dataTerminoOficial.getTime() + 30 * 60000);

        if (agora < limiteSaidaInicio || agora > limiteSaidaFim) {
            exibirAlertaTemporizado(`Saída não permitida neste horário. Janela elegível: ${limiteSaidaInicio.toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})} até ${limiteSaidaFim.toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})}`);
            return;
        }

        setCarregandoAcao(true);
        try {
            const res = await fetch(`${API_URL}/api/v2/presenca/confirmar-saida`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    device_key: dKey,
                    evento_id: eventoAtual.id,
                    avaliacao,
                    comentarios,
                    lat: coords.lat,
                    lng: coords.lng
                })
            });

            const data = await res.json();
            if (res.ok && data.status === 'sucesso') {
                setStatusFluxo('concluido');
            } else {
                exibirAlertaTemporizado(data.error || 'Erro ao registrar saída.');
            }
        } catch (err) {
            exibirAlertaTemporizado('Falha na comunicação ao encerrar presença.');
        } finally {
            setCarregandoAcao(false);
        }
    };

    const estilos = {
        container: { fontFamily: 'Arial, sans-serif', backgroundColor: '#f4f6f9', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', boxSizing: 'border-box' },
        card: { backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', padding: '30px', width: '100%', maxWidth: '440px', boxSizing: 'border-box', textAlign: 'center' },
        titulo: { fontSize: '22px', fontWeight: 'bold', color: '#1e3a8a', margin: '0 0 8px 0' },
        subtitulo: { fontSize: '14px', color: '#64748b', margin: '0 0 24px 0' },
        btnPrimario: { width: '100%', padding: '14px', backgroundColor: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer', transition: 'background-color 0.2s' },
        btnSucesso: { width: '100%', padding: '14px', backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer', transition: 'background-color 0.2s', marginTop: '15px' },
        btnItem: { width: '100%', padding: '12px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', textAlign: 'left', cursor: 'pointer', marginBottom: '10px' },
        select: { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', marginBottom: '15px', marginTop: '5px', fontSize: '14px' },
        textarea: { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', minHeight: '80px', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: '15px', marginTop: '5px', fontSize: '14px' },
        alerta: { backgroundColor: '#fef2f2', border: '1px solid #fee2e2', color: '#991b1b', padding: '12px', borderRadius: '8px', fontSize: '13px', marginBottom: '20px', textAlign: 'left', fontWeight: 'bold' }
    };

    return (
        <div style={estilos.container}>
            {statusFluxo === 'carregando' && (
                <div style={estilos.card}>
                    <p style={estilos.titulo}>Sincronizando GPS...</p>
                    <p style={estilos.subtitulo}>Aguarde a validação das coordenadas físicas do aparelho.</p>
                </div>
            )}

            {statusFluxo === 'multiplos' && (
                <div style={estilos.card}>
                    <p style={estilos.titulo}>Atividades Disponíveis</p>
                    <p style={estilos.subtitulo}>Selecione qual formação deseja acessar no momento:</p>
                    {alertaMsg && <div style={estilos.alerta}>{alertaMsg}</div>}
                    {listaEventos.map(ev => (
                        <button key={ev.id} onClick={() => selecionarAtividadeManual(ev)} style={estilos.btnItem}>
                            <div style={{ fontWeight: 'bold', color: '#1e293b' }}>{ev.titulo}</div>
                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>⏰ {ev.hora_inicio.slice(0,5)} às {ev.hora_fim.slice(0,5)} | 📍 {ev.local}</div>
                        </button>
                    ))}
                </div>
            )}

            {statusFluxo === 'entrada' && eventoAtual && (
                <div style={estilos.card}>
                    <p style={estilos.titulo}>{eventoAtual.titulo}</p>
                    <p style={estilos.subtitulo}>📍 Local: {eventoAtual.local}<br />⏰ Agenda: {eventoAtual.hora_inicio.slice(0,5)} às {eventoAtual.hora_fim.slice(0,5)}</p>
                    {alertaMsg && <div style={estilos.alerta}>{alertaMsg}</div>}
                    <button onClick={dispararRegistroPresenca} disabled={carregandoAcao} style={estilos.btnPrimario}>
                        {carregandoAcao ? 'GRAVANDO PRESENÇA...' : 'REGISTRAR CHEGADA'}
                    </button>
                </div>
            )}

            {statusFluxo === 'pesquisa' && eventoAtual && (
                <div style={estilos.card}>
                    <p style={estilos.titulo}>Pesquisa de Satisfação</p>
                    <p style={estilos.subtitulo}>Sua opinião é fundamental. Avalie a atividade "{eventoAtual.titulo}":</p>
                    {alertaMsg && <div style={estilos.alerta}>{alertaMsg}</div>}
                    <form onSubmit={salvarAvaliacaoEConfirmarSaida}>
                        <div style={{ textAlign: 'left' }}>
                            <label style={{ fontWeight: 'bold', fontSize: '13px' }}>Classificação:</label>
                            <select style={estilos.select} value={avaliacao} onChange={(e) => setAvaliacao(e.target.value)}>
                                <option value="Ótimo">⭐⭐⭐⭐⭐ Ótimo</option>
                                <option value="Muito Bom">⭐⭐⭐⭐ Muito Bom</option>
                                <option value="Bom">⭐⭐⭐ Bom</option>
                                <option value="Regular">⭐⭐ Regular</option>
                                <option value="Ruim">⭐ Ruim</option>
                            </select>

                            <label style={{ fontWeight: 'bold', fontSize: '13px' }}>Observações / Sugestões:</label>
                            <textarea style={estilos.textarea} value={comentarios} onChange={(e) => setComentarios(e.target.value)} placeholder="Deixe sua mensagem..." />
                        </div>
                        <button type="submit" disabled={carregandoAcao} style={estilos.btnSucesso}>
                            {carregandoAcao ? 'PROCESSANDO SAÍDA...' : 'CONFIRMAR ENCERRAMENTO'}
                        </button>
                    </form>
                </div>
            )}

            {(statusFluxo === 'erro' || statusFluxo === 'concluido') && (
                <div style={estilos.card}>
                    <p style={estilos.titulo}>{statusFluxo === 'concluido' ? 'Frequência Concluída!' : 'Portal de Presença'}</p>
                    <p style={estilos.subtitulo}>{statusFluxo === 'concluido' ? 'Sua participação e avaliação foram consolidadas com sucesso.' : 'Status de operação atualizado.'}</p>
                    {alertaMsg && <div style={estilos.alerta}>{alertaMsg}</div>}
                    <button onClick={() => { setStatusFluxo('carregando'); dispararChecagem(coords, eventoAtual?.id); }} style={{ ...estilos.btnPrimario, backgroundColor: '#64748b', marginTop: '10px' }}>
                        ATUALIZAR PAINEL
                    </button>
                </div>
            )}
        </div>
    );
}