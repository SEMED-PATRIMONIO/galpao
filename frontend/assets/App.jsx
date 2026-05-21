import React, { useState, useEffect } from 'react';

// O PortalProfessor corrigido passa a ser o seu componente principal (App)
export default function App() {
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
        }, 8000);
    };

    // Comunicação com a API
    const dispararChecagem = async (localCoords, idEventoSelecionado) => {
        try {
            const token = localStorage.getItem('token');
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
            {alertaMsg && <div style={estilos.alerta}>{alertaMsg}</div>}

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