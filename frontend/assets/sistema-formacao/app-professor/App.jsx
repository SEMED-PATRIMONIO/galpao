import React, { useState, useEffect } from 'react';

export default function App() {
    const [view, setView] = useState('identificacao');
    const [professor, setProfessor] = useState(JSON.parse(localStorage.getItem('prof_dados')) || null);
    const [deviceOwner, setDeviceOwner] = useState(localStorage.getItem('device_owner') || null);
    
    const [matriculaInput, setMatriculaInput] = useState('');
    const [cpfInput, setCpfInput] = useState('');
    const [nomeInput, setNomeInput] = useState('');
    
    const [eventos, setEventos] = useState([]);
    const [eventoSelecionado, setEventoSelecionado] = useState(null);
    const [eventoAtivo, setEventoAtivo] = useState(JSON.parse(localStorage.getItem('evento_ativo')) || null);
    const [horaCheckIn, setHoraCheckIn] = useState(localStorage.getItem('hora_checkin') || null);
    
    const [coords, setCoords] = useState({ lat: null, lng: null });
    const [nota, setNota] = useState(5);
    const [comentarios, setComentarios] = useState('');
    const [msgErro, setMsgErro] = useState('');

    useEffect(() => {
        navigator.geolocation.getCurrentPosition(
            (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => console.error('Acesso à localização negado.')
        );

        if (professor) {
            if (deviceOwner && deviceOwner !== professor.cpf) {
                setMsgErro('Este aparelho está vinculado a outro professor e não pode ser utilizado.');
                setView('bloqueado');
            } else {
                if (!deviceOwner) {
                    localStorage.setItem('device_owner', professor.cpf);
                    setDeviceOwner(professor.cpf);
                }
                carregarEventos();
                setView('home');
            }
        }
    }, [professor]);

    const carregarEventos = async () => {
        try {
            const res = await fetch('http://localhost:3009/api/v2/eventos', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token') || ''}` }
            });
            if (res.ok) {
                const data = await res.json();
                setEventos(data);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleIdentificar = (e) => {
        e.preventDefault();
        if (!nomeInput || !matriculaInput || !cpfInput) {
            alert('Preencha todos os campos.');
            return;
        }

        if (deviceOwner && deviceOwner !== cpfInput) {
            alert('Este dispositivo já pertence a outra conta e não pode ser compartilhado.');
            return;
        }

        const dados = { nome: nomeInput, matricula: matriculaInput, cpf: cpfInput };
        localStorage.setItem('prof_dados', JSON.stringify(dados));
        setProfessor(dados);
    };

    const calcularDistancia = (lat1, lon1, lat2, lon2) => {
        if (!lat1 || !lon1 || !lat2 || !lon2) return 99999;
        const R = 6371e3;
        const phi1 = lat1 * Math.PI / 180;
        const phi2 = lat2 * Math.PI / 180;
        const deltaPhi = (lat2 - lat1) * Math.PI / 180;
        const deltaLambda = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
                  Math.cos(phi1) * Math.cos(phi2) *
                  Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    };

    const registrarFraude = async (eventoId, motivo) => {
        try {
            await fetch('http://localhost:3009/api/v2/fraudes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    evento_id: eventoId,
                    device_fingerprint: navigator.userAgent,
                    motivo: motivo,
                    participante_cpf: professor?.cpf
                })
            });
        } catch (err) {
            console.error(err);
        }
    };

    const handleCheckIn = async (evento) => {
        if (eventoAtivo) {
            alert('Você já possui um check-in ativo em outro evento simultâneo.');
            return;
        }

        const dist = calcularDistancia(coords.lat, coords.lng, evento.latitude, evento.longitude);
        const raioTolerancia = 200;

        if (dist > raioTolerancia) {
            await registrarFraude(evento.id, `Tentativa de check-in fora do raio permitido. Distância: ${Math.round(dist)} metros.`);
            alert('Check-in bloqueado! Você não está nas dependências físicas deste evento.');
            return;
        }

        const agora = new Date().toISOString();
        localStorage.setItem('evento_ativo', JSON.stringify(evento));
        localStorage.setItem('hora_checkin', agora);
        setEventoAtivo(evento);
        setHoraCheckIn(agora);
        setView('status-frequencia');
    };

    const handleCheckOutAcao = () => {
        const tempoDecorridoMinutos = (new Date() - new Date(horaCheckIn)) / 1000 / 60;

        if (tempoDecorridoMinutos < 30) {
            const confirma = window.confirm('ATENÇÃO: Você permaneceu menos de 30 minutos neste evento. Se sair agora, NÃO receberá os créditos de carga horária para a Formação. Deseja registrar saída mesmo assim?');
            if (confirma) {
                finalizarCheckOut(false);
            }
        } else {
            setView('pesquisa-satisfacao');
        }
    };

    const finalizarCheckOut = async (creditarHoras) => {
        try {
            if (creditarHoras) {
                await fetch('http://localhost:3009/api/v2/pesquisa-satisfacao', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        evento_id: eventoAtivo.id,
                        avaliacao: nota,
                        comentarios: comentarios,
                        participante_cpf: professor.cpf
                    })
                });
            }

            localStorage.removeItem('evento_ativo');
            localStorage.removeItem('hora_checkin');
            setEventoAtivo(null);
            setHoraCheckIn(null);
            setNota(5);
            setComentarios('');
            setView('home');
            alert('Saída registrada com sucesso!');
        } catch (err) {
            alert('Erro ao finalizar check-out.');
        }
    };

    const handleDesconectarDispositivo = () => {
        localStorage.clear();
        setProfessor(null);
        setDeviceOwner(null);
        setEventoAtivo(null);
        setHoraCheckIn(null);
        setView('identificacao');
    };

    return (
        <div style={styles.appWrapper}>
            <div style={styles.phoneContainer}>
                
                {view === 'bloqueado' && (
                    <div style={styles.screenCentrada}>
                        <div style={styles.alertaCard}>
                            <h3 style={{ color: '#ef4444' }}>Aparelho Bloqueado</h3>
                            <p style={{ fontSize: 14, color: '#475569', margin: '15px 0' }}>{msgErro}</p>
                            <button onClick={handleDesconectarDispositivo} style={styles.btnDesconectar}>Limpar Credenciais</button>
                        </div>
                    </div>
                )}

                {view === 'identificacao' && (
                    <div style={styles.screenScroll}>
                        <div style={{ textAlign: 'center', marginBottom: 30 }}>
                            <h2 style={{ color: '#5442E6', margin: 0 }}>Frequência Digital</h2>
                            <p style={{ color: '#64748b', fontSize: 13, marginTop: 5 }}>Prefeitura de Queimados - Educação</p>
                        </div>
                        <form onSubmit={handleIdentificar} style={styles.formIdentidade}>
                            <div style={styles.campoForm}>
                                <label style={styles.labelForm}>NOME COMPLETO</label>
                                <input type="text" value={nomeInput} onChange={e => setNomeInput(e.target.value)} style={styles.inputMobile} required />
                            </div>
                            <div style={styles.campoForm}>
                                <label style={styles.labelForm}>MATRÍCULA INSTITUCIONAL</label>
                                <input type="text" value={matriculaInput} onChange={e => setMatriculaInput(e.target.value)} style={styles.inputMobile} required />
                            </div>
                            <div style={styles.campoForm}>
                                <label style={styles.labelForm}>CPF</label>
                                <input type="text" value={cpfInput} onChange={e => setCpfInput(e.target.value)} style={styles.inputMobile} required />
                            </div>
                            <button type="submit" style={styles.btnAcaoMobile}>Vincular Meu Aparelho</button>
                        </form>
                    </div>
                )}

                {view === 'home' && (
                    <div style={styles.screenFlex}>
                        <div style={styles.topoHeader}>
                            <div>
                                <h4 style={{ margin: 0, color: '#fff' }}>{professor?.nome}</h4>
                                <span style={{ fontSize: 11, color: '#94a3b8' }}>Matrícula: {professor?.matricula}</span>
                            </div>
                            {eventoAtivo && (
                                <button onClick={() => setView('status-frequencia')} style={styles.badgeAtivo}>Em Andamento</button>
                            )}
                        </div>

                        <div style={styles.blocoMeio}>
                            <h3 style={{ color: '#0d1527', marginBottom: 15 }}>Eventos Disponíveis</h3>
                            <div style={styles.listaEventosMobile}>
                                {eventos.map(ev => (
                                    <div key={ev.id} onClick={() => { setEventoSelecionado(ev); setView('detalhe-evento'); }} style={styles.cardEventoMobile}>
                                        <div style={{ fontWeight: 'bold', fontSize: 15, color: '#1e293b' }}>{ev.titulo}</div>
                                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Palestrante: {ev.palestrante || 'Não informado'}</div>
                                        <div style={{ fontSize: 12, color: '#5442E6', fontWeight: 'bold', marginTop: 4 }}>CH: {ev.carga_horaria}h | {new Date(ev.data_evento).toLocaleDateString('pt-BR')}</div>
                                    </div>
                                ))}
                                {eventos.length === 0 && (
                                    <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: 14, marginTop: 40 }}>Nenhum evento agendado para hoje.</p>
                                )}
                            </div>
                        </div>

                        <div style={styles.rodapeMobile}>
                            <button onClick={handleDesconectarDispositivo} style={styles.btnDesconectar}>Sair desta Conta</button>
                        </div>
                    </div>
                )}

                {view === 'detalhe-evento' && eventoSelecionado && (
                    <div style={styles.screenFlex}>
                        <div style={styles.topoHeader}>
                            <h4 style={{ margin: 0, color: '#fff' }}>Detalhes do Evento</h4>
                            <button onClick={() => setView('home')} style={styles.btnVoltar}>Voltar</button>
                        </div>
                        <div style={{ ...styles.blocoMeio, padding: 20 }}>
                            <h2 style={{ color: '#5442E6', margin: '0 0 10px 0' }}>{eventoSelecionado.titulo}</h2>
                            <p style={styles.txtDetalhe}><strong>Palestrante:</strong> {eventoSelecionado.palestrante}</p>
                            <p style={styles.txtDetalhe}><strong>Carga Horária:</strong> {eventoSelecionado.carga_horaria} horas</p>
                            <p style={styles.txtDetalhe}><strong>Horário:</strong> {eventoSelecionado.hora_inicio} às {eventoSelecionado.hora_fim}</p>
                            <p style={styles.txtDetalhe}><strong>Local:</strong> {eventoSelecionado.local_nome}</p>

                            <div style={{ marginTop: 30 }}>
                                <button onClick={() => handleCheckIn(eventoSelecionado)} style={styles.btnAcaoMobile}>Realizar Entrada (Check-In)</button>
                            </div>
                        </div>
                    </div>
                )}

                {view === 'status-frequencia' && eventoAtivo && (
                    <div style={styles.screenFlex}>
                        <div style={styles.topoHeader}>
                            <h4 style={{ margin: 0, color: '#fff' }}>Frequência Ativa</h4>
                        </div>
                        <div style={{ ...styles.blocoMeio, padding: 20, textAlign: 'center' }}>
                            <div style={styles.radarIcon}>✓</div>
                            <h2 style={{ color: '#0d1527', margin: '20px 0 10px 0' }}>Presença Confirmada</h2>
                            <p style={{ fontSize: 15, color: '#475569' }}>Você está conectado ao evento:</p>
                            <h3 style={{ color: '#5442E6', margin: '10px 0' }}>{eventoAtivo.titulo}</h3>
                            <p style={{ fontSize: 13, color: '#64748b', marginTop: 15 }}>Entrada registrada em: {new Date(horaCheckIn).toLocaleTimeString('pt-BR')}</p>
                            
                            <div style={{ marginTop: 40 }}>
                                <button onClick={handleCheckOutAcao} style={styles.btnPerigoMobile}>Registrar Saída (Check-Out)</button>
                                <button onClick={() => setView('home')} style={{ ...styles.btnVoltar, color: '#5442E6', marginTop: 15, width: '100%' }}>Voltar ao Menu</button>
                            </div>
                        </div>
                    </div>
                )}

                {view === 'pesquisa-satisfacao' && (
                    <div style={styles.screenFlex}>
                        <div style={styles.topoHeader}>
                            <h4 style={{ margin: 0, color: '#fff' }}>Pesquisa de Satisfação</h4>
                        </div>
                        <div style={{ ...styles.blocoMeio, padding: 20 }}>
                            <p style={{ fontSize: 14, color: '#475569', fontWeight: 'bold', marginBottom: 10 }}>Como você avalia este evento/formação?</p>
                            <div style={styles.grupoEstrelas}>
                                {[1, 2, 3, 4, 5].map(num => (
                                    <button key={num} type="button" onClick={() => setNota(num)} style={{ ...styles.btnEstrela, color: num <= nota ? '#eab308' : '#cbd5e1' }}>★</button>
                                ))}
                            </div>

                            <label style={{ ...styles.labelForm, marginTop: 20, display: 'block' }}>COMENTÁRIOS E SUGESTÕES</label>
                            <textarea rows={4} value={comentarios} onChange={e => setComentarios(e.target.value)} placeholder="Deixe sua opinião sobre o evento..." style={styles.textareaMobile} />

                            <div style={{ marginTop: 30 }}>
                                <button onClick={() => finalizarCheckOut(true)} style={styles.btnAcaoMobile}>Enviar e Concluir Saída</button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}

const styles = {
    appWrapper: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f1f5f9' },
    phoneContainer: { width: '100%', maxWidth: 430, height: '100%', maxHeight: 932, backgroundColor: '#f8fafc', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' },
    screenCentrada: { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', padding: 20 },
    screenScroll: { flex: 1, padding: 25, overflowY: 'auto' },
    screenFlex: { flex: 1, display: 'flex', flexDirection: 'column', height: '100%' },
    topoHeader: { backgroundColor: '#0d1527', padding: '20px 25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    blocoMeio: { flex: 1, padding: 15, overflowY: 'auto' },
    rodapeMobile: { padding: 15, borderTop: '1px solid #e2e8f0', backgroundColor: '#fff', display: 'flex', justifyContent: 'center' },
    formIdentidade: { display: 'flex', flexDirection: 'column', gap: 18, marginTop: 10 },
    campoForm: { display: 'flex', flexDirection: 'column', gap: 6 },
    labelForm: { fontSize: 11, color: '#64748b', fontWeight: 'bold' },
    inputMobile: { padding: 14, borderRadius: 10, border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: 15, outline: 'none' },
    textareaMobile: { padding: 14, borderRadius: 10, border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: 15, outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'none' },
    btnAcaoMobile: { backgroundColor: '#5442E6', color: '#fff', border: 'none', padding: 15, borderRadius: 10, width: '100%', fontSize: 15, fontWeight: 'bold', cursor: 'pointer' },
    btnPerigoMobile: { backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: 15, borderRadius: 10, width: '100%', fontSize: 15, fontWeight: 'bold', cursor: 'pointer' },
    btnDesconectar: { backgroundColor: 'transparent', color: '#64748b', border: 'none', fontSize: 13, textDecoration: 'underline', cursor: 'pointer' },
    btnVoltar: { backgroundColor: 'transparent', color: '#fff', border: 'none', fontSize: 14, cursor: 'pointer' },
    badgeAtivo: { backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 20, fontSize: 11, fontWeight: 'bold' },
    listaEventosMobile: { display: 'flex', flexDirection: 'column', gap: 12 },
    cardEventoMobile: { backgroundColor: '#fff', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0', cursor: 'pointer' },
    txtDetalhe: { fontSize: 14, color: '#334155', margin: '8px 0', lineHeight: '1.4' },
    radarIcon: { width: 80, height: 80, borderRadius: '50%', backgroundColor: '#dcfce7', color: '#22c55e', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: 40, margin: '30px auto 0 auto' },
    grupoEstrelas: { display: 'flex', gap: 10, justifyContent: 'center', margin: '15px 0' },
    btnEstrela: { background: 'none', border: 'none', fontSize: 36, cursor: 'pointer' },
    alertaCard: { backgroundColor: '#fff', padding: 25, borderRadius: 16, border: '1px solid #fecaca', textAlign: 'center', maxWidth: '85%' }
};