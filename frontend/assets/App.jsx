import React, { useState, useEffect } from 'react';

const API_URL = window.location.origin.includes('localhost') ? 'http://localhost:3009' : '';

const obterAgoraSaoPaulo = () => {
    try {
        const dataTexto = new Date().toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo" }).replace(' ', 'T');
        const data = new Date(dataTexto);
        return isNaN(data.getTime()) ? new Date() : data;
    } catch (e) {
        return new Date();
    }
};

export default function App() {
    // Estados de Controle do Fluxo
    // Estados possíveis: 'carregando', 'sem_evento', 'nao_vinculado', 'pendente_admin', 'multiplos', 'entrada', 'logado', 'pesquisa', 'concluido'
    const [statusFluxo, setStatusFluxo] = useState('carregando');
    const [eventoAtual, setEventoAtual] = useState(null);
    const [listaEventos, setListaEventos] = useState([]);
    const [alertaMsg, setAlertaMsg] = useState('');
    const [coords, setCoords] = useState({ lat: null, lng: null });
    const [carregandoAcao, setCarregandoAcao] = useState(false);

    // Formulário de Vínculo de Aparelho
    const [formVinculo, setFormVinculo] = useState({ nome: '', matricula: '' });

    // Formulário de Avaliação de Saída
    const [avaliacao, setAvaliacao] = useState('Ótimo');
    const [comentarios, setComentarios] = useState('');

    // Efeito Inicial: Roda assim que o app abre
    useEffect(() => {
        verificarFaseInicial();
    }, []);

    // PASSO 1 e 2: Verificar evento no dia e checar vínculo do dispositivo (Sem forçar GPS ainda)
    const verificarFaseInicial = async () => {
        const dKey = localStorage.getItem('device_token') || localStorage.getItem('device_key');
        
        try {
            const res = await fetch(`${API_URL}/api/v2/presenca/inicializar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ device_key: dKey || null })
            });

            const data = await res.json();

            // 1. Se não houver eventos agendados para hoje, barra imediatamente (sem pedir GPS)
            if (res.status === 404 || (data.eventos && data.eventos.length === 0)) {
                setStatusFluxo('sem_evento');
                return;
            }

            // 2. Se o aparelho não for reconhecido ou não tiver chave, vai para a tela de vínculo imediato
            if (res.status === 401 || !dKey) {
                setListaEventos(data.eventos || []);
                setStatusFluxo('nao_vinculado');
                return;
            }

            if (data.status === 'sucesso') {
                setListaEventos(data.eventos);

                // 3. Verificar pendências de saídas antigas ou travas do Admin
                if (data.situacao === 'bloqueado_saida_estourada') {
                    setStatusFluxo('pendente_admin');
                    exibirAlertaTemporizado('Você possui uma entrada sem registro de saída e o prazo expirou. Solicite liberação ao administrador.');
                    return;
                }

                // Se o usuário já está ativamente logado em algum evento
                if (data.tem_evento_ativo && data.evento_ativo_id) {
                    const evAtivo = data.eventos.find(e => e.id === data.evento_ativo_id);
                    if (evAtivo) {
                        setEventoAtual(evAtivo);
                        setStatusFluxo('logado'); // Vai direto para a tela de espera da saída
                        capturarGeolocalizacaoSilenciosa();
                        return;
                    }
                }

                // Direcionamento de fluxo padrão para novos registros
                if (data.eventos.length === 1) {
                    setEventoAtual(data.eventos[0]);
                    setStatusFluxo('entrada');
                } else {
                    setStatusFluxo('multiplos');
                }
                
                // Captura o GPS em background agora que sabe que tem evento e está vinculado
                capturarGeolocalizacaoSilenciosa();
            }
        } catch (err) {
            setStatusFluxo('sem_evento');
            exibirAlertaTemporizado('Sem comunicação com o servidor. Verifique sua internet.');
        }
    };

    const capturarGeolocalizacaoSilenciosa = () => {
        navigator.geolocation.getCurrentPosition(
            (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => exibirAlertaTemporizado('Aviso: Ative o GPS do aparelho para conseguir marcar presença.')
        );
    };

    const exibirAlertaTemporizado = (msg) => {
        setAlertaMsg(msg);
        setTimeout(() => setAlertaMsg(''), 8000);
    };

    // AÇÃO: Realizar o Auto-Vínculo do aparelho na hora
    const dispararAutoVinculo = async (e) => {
        e.preventDefault();
        if (!formVinculo.nome || !formVinculo.matricula) {
            exibirAlertaTemporizado('Preencha seu Nome e Matrícula para vincular.');
            return;
        }

        setCarregandoAcao(true);
        try {
            // Gera um token UUID temporário/aleatório no lado do cliente caso queira, 
            // ou deixa sua API gerar e devolver no response.
            const novoToken = 'dev_' + Math.random().toString(36).substr(2, 9) + Date.now();

            const res = await fetch(`${API_URL}/api/v2/dispositivos/vincular`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    device_key: novoToken,
                    nome: formVinculo.nome,
                    matricula: formVinculo.matricula
                })
            });

            const data = await res.json();
            if (res.ok && data.status === 'sucesso') {
                localStorage.setItem('device_key', novoToken);
                localStorage.setItem('device_token', novoToken);
                exibirAlertaTemporizado('Aparelho vinculado com sucesso!');
                // Reinicializa o fluxo agora com o aparelho devidamente registrado
                setStatusFluxo('carregando');
                verificarFaseInicial();
            } else {
                exibirAlertaTemporizado(data.error || 'Não foi possível efetuar o vínculo.');
            }
        } catch (err) {
            exibirAlertaTemporizado('Erro de rede ao tentar vincular aparelho.');
        } finally {
            setCarregandoAcao(false);
        }
    };

    const selecionarAtividadeManual = (ev) => {
        setEventoAtual(ev);
        setStatusFluxo('entrada');
    };

    // PASSO 4, 5 e 6: Disparar Registro de Entrada
    const dispararRegistroPresenca = async () => {
        setCarregandoAcao(true);
        // Garante a captura atualizada do GPS antes do envio
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const latAtual = pos.coords.latitude;
                const lngAtual = pos.coords.longitude;
                setCoords({ lat: latAtual, lng: lngAtual });

                const dKey = localStorage.getItem('device_token') || localStorage.getItem('device_key');

                try {
                    const res = await fetch(`${API_URL}/api/v2/presencas`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            device_key: dKey,
                            evento_id: eventoAtual.id,
                            lat_entrada: latAtual,
                            lng_entrada: lngAtual
                        })
                    });

                    const data = await res.json();
                    if (res.ok && data.status === 'sucesso') {
                        setStatusFluxo('logado');
                    } else {
                        // Se falhar (por distância ou horário), o backend já salvou no log_fraudes
                        exibirAlertaTemporizado(data.error || 'Registro rejeitado pelos critérios de validação.');
                    }
                } catch (err) {
                    exibirAlertaTemporizado('Erro ao enviar dados de presença.');
                } finally {
                    setCarregandoAcao(false);
                }
            },
            () => {
                setCarregandoAcao(false);
                exibirAlertaTemporizado('Erro de GPS: Não foi possível obter sua localização exata.');
            }
        );
    };

    // PASSO 4, 5 e 6: Disparar Registro de Saída
    const salvarAvaliacaoEConfirmarSaida = async (e) => {
        e.preventDefault();
        setCarregandoAcao(true);

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const latAtual = pos.coords.latitude;
                const lngAtual = pos.coords.longitude;
                const dKey = localStorage.getItem('device_token') || localStorage.getItem('device_key');

                try {
                    const res = await fetch(`${API_URL}/api/v2/presenca/confirmar-saida`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            device_key: dKey,
                            evento_id: eventoAtual.id,
                            avaliacao,
                            comentarios,
                            lat: latAtual,
                            lng: lngAtual
                        })
                    });

                    const data = await res.json();
                    if (res.ok && data.status === 'sucesso') {
                        setStatusFluxo('concluido');
                    } else {
                        exibirAlertaTemporizado(data.error || 'Erro ao registrar sua saída.');
                    }
                } catch (err) {
                    exibirAlertaTemporizado('Erro de comunicação ao encerrar presença.');
                } finally {
                    setCarregandoAcao(false);
                }
            },
            () => {
                setCarregandoAcao(false);
                exibirAlertaTemporizado('Geolocalização obrigatória para validar a saída.');
            }
        );
    };

    const estilos = {
        container: { fontFamily: 'Arial, sans-serif', backgroundColor: '#f4f6f9', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', boxSizing: 'border-box' },
        card: { backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', padding: '30px', width: '100%', maxWidth: '440px', boxSizing: 'border-box', textAlign: 'center' },
        titulo: { fontSize: '22px', fontWeight: 'bold', color: '#1e3a8a', margin: '0 0 8px 0' },
        subtitulo: { fontSize: '14px', color: '#64748b', margin: '0 0 24px 0' },
        input: { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '15px', boxSizing: 'border-box' },
        btnPrimario: { width: '100%', padding: '14px', backgroundColor: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' },
        btnSucesso: { width: '100%', padding: '14px', backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer', marginTop: '15px' },
        btnItem: { width: '100%', padding: '12px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', textAlign: 'left', cursor: 'pointer', marginBottom: '10px' },
        select: { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', marginBottom: '15px', marginTop: '5px' },
        textarea: { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', minHeight: '80px', boxSizing: 'border-box', marginBottom: '15px' },
        alerta: { backgroundColor: '#fef2f2', border: '1px solid #fee2e2', color: '#991b1b', padding: '12px', borderRadius: '8px', fontSize: '13px', marginBottom: '20px', textAlign: 'left', fontWeight: 'bold' }
    };

    return (
        <div style={estilos.container}>
            {statusFluxo === 'carregando' && (
                <div style={estilos.card}>
                    <p style={estilos.titulo}>Buscando Atividades...</p>
                    <p style={estilos.subtitulo}>Verificando cronograma e calendário oficial do dia.</p>
                </div>
            )}

            {statusFluxo === 'sem_evento' && (
                <div style={estilos.card}>
                    <div style={{ fontSize: '50px', marginBottom: '10px' }}>📆</div>
                    <p style={estilos.titulo}>Nenhuma Atividade</p>
                    <p style={estilos.subtitulo}>Não existem reuniões ou formações agendadas para o dia de hoje.</p>
                    {alertaMsg && <div style={estilos.alerta}>{alertaMsg}</div>}
                </div>
            )}

            {statusFluxo === 'nao_vinculado' && (
                <div style={estilos.card}>
                    <p style={estilos.titulo}>Vincular Dispositivo</p>
                    <p style={estilos.subtitulo}>Este aparelho ainda não possui identificação no portal. Cadastre-se abaixo:</p>
                    {alertaMsg && <div style={estilos.alerta}>{alertaMsg}</div>}
                    <form onSubmit={dispararAutoVinculo}>
                        <input style={estilos.input} type="text" placeholder="Seu Nome Completo" value={formVinculo.nome} onChange={e => setFormVinculo({...formVinculo, nome: e.target.value})} required />
                        <input style={estilos.input} type="text" placeholder="Sua Matrícula/CPF" value={formVinculo.matricula} onChange={e => setFormVinculo({...formVinculo, matricula: e.target.value})} required />
                        <button type="submit" disabled={carregandoAcao} style={estilos.btnPrimario}>
                            {carregandoAcao ? 'VINCULANDO APARELHO...' : 'EFETUAR VÍNCULO IMEDIATO'}
                        </button>
                    </form>
                </div>
            )}

            {statusFluxo === 'pendente_admin' && (
                <div style={estilos.card}>
                    <div style={{ fontSize: '50px', marginBottom: '10px' }}>🔒</div>
                    <p style={estilos.titulo}>Acesso Bloqueado</p>
                    <p style={estilos.subtitulo}>Você esqueceu de registrar a saída em uma atividade anterior.</p>
                    <div style={{ ...estilos.alerta, backgroundColor: '#fffbeb', borderColor: '#fef3c7', color: '#b45309' }}>
                        Por motivos de segurança, você não pode entrar em uma nova atividade até que um Administrador finalize sua pendência passada manualmente.
                    </div>
                    <button onClick={verificarFaseInicial} style={estilos.btnPrimario}>CONFERIR NOVAMENTE</button>
                </div>
            )}

            {statusFluxo === 'multiplos' && (
                <div style={estilos.card}>
                    <p style={estilos.titulo}>Selecione a Formação</p>
                    <p style={estilos.subtitulo}>Mais de uma atividade foi encontrada para hoje:</p>
                    {alertaMsg && <div style={estilos.alerta}>{alertaMsg}</div>}
                    {listaEventos.map(ev => (
                        <button key={ev.id} onClick={() => selecionarAtividadeManual(ev)} style={estilos.btnItem}>
                            <div style={{ fontWeight: 'bold', color: '#1e293b' }}>{ev.titulo}</div>
                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>⏰ {ev.hora_inicio.slice(0,5)} às {ev.hora_fim.slice(0,5)}</div>
                        </button>
                    ))}
                </div>
            )}

            {statusFluxo === 'entrada' && eventoAtual && (
                <div style={estilos.card}>
                    <p style={estilos.titulo}>{eventoAtual.titulo}</p>
                    <p style={estilos.subtitulo}>📍 Local: {eventoAtual.local}<br />⏰ Horário: {eventoAtual.hora_inicio.slice(0,5)} às {eventoAtual.hora_fim.slice(0,5)}</p>
                    {alertaMsg && <div style={estilos.alerta}>{alertaMsg}</div>}
                    <button onClick={dispararRegistroPresenca} disabled={carregandoAcao} style={estilos.btnPrimario}>
                        {carregandoAcao ? 'AVALIANDO CRITÉRIOS...' : 'REGISTRAR MINHA CHEGADA'}
                    </button>
                </div>
            )}

            {statusFluxo === 'logado' && eventoAtual && (
                <div style={estilos.card}>
                    <div style={{ fontSize: '50px', marginBottom: '10px' }}>⏳</div>
                    <p style={estilos.titulo}>Dentro da Atividade</p>
                    <p style={estilos.subtitulo}>Sua presença foi confirmada em <strong>{eventoAtual.titulo}</strong>.</p>
                    <p style={{ fontSize: '13px', color: '#475569', backgroundColor: '#f1f5f9', padding: '12px', borderRadius: '6px', margin: '15px 0' }}>
                        Mantenha o aplicativo aberto ou retorne aqui ao final do evento para preencher a pesquisa de satisfação e validar sua saída.
                    </p>
                    <button onClick={() => setStatusFluxo('pesquisa')} style={{ ...estilos.btnPrimario, backgroundColor: '#0f172a' }}>
                        AVALIAR & REGISTRAR SAÍDA
                    </button>
                    {alertaMsg && <div style={{ ...estilos.alerta, marginTop: '15px' }}>{alertaMsg}</div>}
                </div>
            )}

            {statusFluxo === 'pesquisa' && eventoAtual && (
                <div style={estilos.card}>
                    <p style={estilos.titulo}>Pesquisa de Satisfação</p>
                    <p style={estilos.subtitulo}>Avalie a atividade "{eventoAtual.titulo}" para computar suas horas:</p>
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
                            <label style={{ fontWeight: 'bold', fontSize: '13px' }}>Críticas ou Sugestões:</label>
                            <textarea style={estilos.textarea} value={comentarios} onChange={(e) => setComentarios(e.target.value)} placeholder="Opcional..." />
                        </div>
                        <button type="submit" disabled={carregandoAcao} style={estilos.btnSucesso}>
                            {carregandoAcao ? 'VALIDANDO GEOLOCALIZAÇÃO...' : 'FINALIZAR PARTICIPAÇÃO'}
                        </button>
                    </form>
                </div>
            )}

            {statusFluxo === 'concluido' && (
                <div style={estilos.card}>
                    <div style={{ fontSize: '50px', marginBottom: '10px' }}>✅</div>
                    <p style={estilos.titulo}>Frequência Concluída!</p>
                    <p style={estilos.subtitulo}>Sua presença e avaliação foram consolidadas com sucesso neste evento.</p>
                    <button onClick={() => { setStatusFluxo('carregando'); verificarFaseInicial(); }} style={{ ...estilos.btnPrimario, backgroundColor: '#64748b', marginTop: '10px' }}>
                        VOLTAR AO INÍCIO
                    </button>
                </div>
            )}
        </div>
    );
}