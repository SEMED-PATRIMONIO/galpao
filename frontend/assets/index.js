const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3009;
const JWT_SECRET = process.env.JWT_SECRET || 'secret_token_queimados_educacao_2026';

const hashSenha = (senha) => crypto.createHash('sha256').update(senha).digest('hex');

app.use(cors());
app.use(express.json());

const verificarToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Acesso negado.' });
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ error: 'Sessão expirada.' });
        req.user = decoded;
        next();
    });
};

const calcularDistancia = (lat1, lon1, lat2, lon2) => {
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

const obterAgoraBrasilia = () => {
    const d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const dataBrasilia = new Date(utc + (3600000 * -3)); // Fuso -03:00
    
    const ano = dataBrasilia.getFullYear();
    const mes = String(dataBrasilia.getMonth() + 1).padStart(2, '0');
    const dia = String(dataBrasilia.getDate()).padStart(2, '0');
    
    return {
        dataStr: `${ano}-${mes}-${dia}`,
        minutosAbsolutos: (dataBrasilia.getHours() * 60) + dataBrasilia.getMinutes()
    };
};

const paraMinutos = (timeStr) => {
    if (!timeStr) return 0;
    const partes = timeStr.split(':');
    return (parseInt(partes[0], 10) * 60) + parseInt(partes[1], 10);
};

app.post('/api/auth/login', async (req, res) => {
    const { usuario, senha } = req.body;
    try {
        const result = await pool.query('SELECT * FROM usuarios WHERE usuario = $1', [usuario]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciais inválidas.' });
        }
        const user = result.rows[0];
        if (!user.ativo) {
            return res.status(403).json({ error: 'Usuário inativo.' });
        }
        if (user.senha !== senha) {
            return res.status(401).json({ error: 'Credenciais inválidas.' });
        }
        const token = jwt.sign(
            { id: user.id, usuario: user.usuario }, 
            JWT_SECRET, 
            { expiresIn: '8h' }
        );
        delete user.senha;
        return res.json({ token, user });
    } catch (error) {
        console.error("Erro interno no login:", error);
        return res.status(500).json({ error: 'Erro interno no servidor.' });
    }
});

app.post('/api/auth/alterar-senha', async (req, res) => {
    const { usuario, novaSenha } = req.body;
    try {
        const hash = hashSenha(novaSenha);
        await pool.query('UPDATE usuarios SET senha = $1, deve_alterar_senha = false WHERE usuario = $2', [hash, usuario]);
        return res.json({ success: true });
    } catch (error) {
        return res.status(500).json({ error: 'Erro interno.' });
    }
});

app.get('/api/v2/dispositivo/status', async (req, res) => {
    const { device_token } = req.query;
    try {
        if (!device_token) return res.json({ atribuido: false });
        const resDisp = await pool.query('SELECT * FROM dispositivos WHERE device_token = $1 AND ativo = true', [device_token]);
        if (resDisp.rows.length === 0) return res.json({ atribuido: false });
        const disp = resDisp.rows[0];
        const resPart = await pool.query('SELECT * FROM participantes WHERE id = $1', [disp.participante_id]);
        return res.json({ atribuido: true, participante: resPart.rows[0] });
    } catch (error) {
        console.error("Erro na rota /dispositivo/status:", error.message);
        return res.status(500).json({ error: 'Erro interno.' });
    }
});

app.post('/api/v2/dispositivo/associar', async (req, res) => {
    const { matricula, nome, device_token, token } = req.body;
    try {
        const tokenDispositivo = device_token || token || uuidv4();
        const resVerif = await pool.query('SELECT * FROM dispositivos WHERE device_token = $1 AND ativo = true', [tokenDispositivo]);
        if (resVerif.rows.length > 0) {
            const vinculo = resVerif.rows[0];
            const partDono = await pool.query('SELECT * FROM participantes WHERE id = $1', [vinculo.participante_id]);
            if (partDono.rows.length > 0 && partDono.rows[0].matricula !== matricula) {
                return res.status(400).json({ error: 'Este dispositivo já está associado a outro participante.' });
            }
        }

        let resPart = await pool.query('SELECT * FROM participantes WHERE matricula = $1', [matricula]);
        let participanteId;
        if (resPart.rows.length === 0) {
            const novoPart = await pool.query(
                'INSERT INTO participantes (nome_completo, matricula, ativo) VALUES ($1, $2, true) RETURNING id', 
                [nome, matricula]
            );
            participanteId = novoPart.rows[0].id;
        } else {
            participanteId = resPart.rows[0].id;
        }

        await pool.query(`
            INSERT INTO dispositivos (device_token, participante_id, participante_matricula, ativo) 
            VALUES ($1, $2, $3, true) 
            ON CONFLICT (device_token) 
            DO UPDATE SET participante_id = $2, participante_matricula = $3, ativo = true
        `, [tokenDispositivo, participanteId, matricula]);

        const partFinal = await pool.query('SELECT * FROM participantes WHERE id = $1', [participanteId]);
        return res.json({ device_token: tokenDispositivo, token: tokenDispositivo, participante: partFinal.rows[0] });
    } catch (error) {
        console.error("Erro crítico na rota /dispositivo/associar:", error.message);
        return res.status(500).json({ error: 'Erro interno ao associar dispositivo.' });
    }
});

app.post('/api/v2/presenca/inicializar', async (req, res) => {
    const { device_token } = req.body;
    try {
        if (!device_token) return res.status(400).json({ error: 'Identificação do dispositivo ausente.' });

        const resDisp = await pool.query('SELECT * FROM dispositivos WHERE device_token = $1 AND ativo = true', [device_token]);
        if (resDisp.rows.length === 0) return res.status(401).json({ error: 'Aparelho não associado.' });
        const disp = resDisp.rows[0];

        const { dataStr, minutosAbsolutos } = obterAgoraBrasilia();

        // Busca todos os eventos ativos para a data de hoje
        const resEventos = await pool.query(`
            SELECT id, titulo, local_exibicao as local, endereco, latitude, longitude,
                   horario_inicio::text as h_ini, horario_fim::text as h_fim 
            FROM eventos 
            WHERE ativo = true AND data_evento = $1
        `, [dataStr]);

        if (resEventos.rows.length === 0) {
            return res.json({ status: 'sem_eventos', mensagem: 'NÃO HÁ FORMAÇÃO AGENDADA PARA HOJE' });
        }

        // Filtra os eventos elegíveis por horário (20 min antes do início até 30 min antes do fim)
        const elegiveisHorario = resEventos.rows.filter(ev => {
            const minInicio = paraMinutos(ev.h_ini);
            const minFim = paraMinutos(ev.h_fim);
            return minutosAbsolutos >= (minInicio - 20) && minutosAbsolutos <= (minFim - 30);
        });

        if (elegiveisHorario.length === 0) {
            // Registra silenciosamente no log de fraudes o horário inadequado
            await pool.query(`
                INSERT INTO log_fraudes (matricula, evento_id, motivo, distancia_calculada)
                VALUES ($1, $2, 'FORA_DA_FAIXA_DE_HORARIO_PERMITIDA', 0)
            `, [disp.participante_matricula, resEventos.rows[0].id]);

            return res.json({ status: 'fora_horario', mensagem: 'FORA DA FAIXA DE HORÁRIO PERMITIDA' });
        }

        // Retorna a lista de formações elegíveis (ficarão cinzas no front até validar o raio)
        return res.json({
            status: 'sucesso',
            eventos: elegiveisHorario.map(e => ({
                id: e.id,
                titulo: e.titulo,
                local: e.local,
                endereco: e.endereco,
                latitude: e.latitude,
                longitude: e.longitude
            }))
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro interno ao inicializar verificação.' });
    }
});

app.post('/api/v2/presenca/checar-status', async (req, res) => {
    const { device_token, evento_id, latitude, longitude } = req.body;
    try {
        const resDisp = await pool.query('SELECT * FROM dispositivos WHERE device_token = $1 AND ativo = true', [device_token]);
        if (resDisp.rows.length === 0) return res.status(401).json({ error: 'Aparelho desvinculado.' });
        const disp = resDisp.rows[0];

        const resEv = await pool.query('SELECT * FROM eventos WHERE id = $1', [evento_id]);
        if (resEv.rows.length === 0) return res.status(404).json({ error: 'Formação não localizada.' });
        const ev = resEv.rows[0];

        // Validação estrita do raio de 60 metros
        const dist = calcularDistancia(latitude, longitude, parseFloat(ev.latitude), parseFloat(ev.longitude));
        if (dist > 60) {
            await pool.query(`
                INSERT INTO log_fraudes (matricula, evento_id, motivo, distancia_calculada)
                VALUES ($1, $2, 'FORA_DO_RAIO_PERMITIDO', $3)
            `, [disp.participante_matricula, evento_id, dist]);

            return res.status(400).json({ error: 'Não existe evento elegível neste local nesta faixa de horário.' });
        }

        const { dataStr } = obterAgoraBrasilia();

        // Consulta registros de frequência para o participante neste evento hoje
        const resFreq = await pool.query(`
            SELECT *, EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - data_entrada))/60 as minutos_decorridos
            FROM frequencias
            WHERE participante_id = $1 AND evento_id = $2 AND data_entrada::date = $3::date
        `, [disp.participante_id, evento_id, dataStr]);

        if (resFreq.rows.length > 0) {
            const freq = resFreq.rows[0];
            if (freq.data_saida !== null) {
                // Caso 1: Entrada e saída já registradas
                return res.json({ status: 'completo', titulo: ev.titulo, local: ev.local_exibicao });
            } else {
                // Caso 2: Somente entrada registrada (retorna os minutos decorridos)
                return res.json({ 
                    status: 'somente_entrada', 
                    titulo: ev.titulo, 
                    minutos: Math.floor(freq.minutos_decorridos || 0)
                });
            }
        }

        // Caso 3: Sem nenhuma marcação prévia
        return res.json({ status: 'nenhum', titulo: ev.titulo });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro ao checar status de presença.' });
    }
});

app.post('/api/v2/presenca/confirmar-entrada', async (req, res) => {
    const { device_token, evento_id } = req.body;
    try {
        const resDisp = await pool.query('SELECT * FROM dispositivos WHERE device_token = $1 AND ativo = true', [device_token]);
        const disp = resDisp.rows[0];

        await pool.query(`
            INSERT INTO frequencias (participante_id, evento_id, data_entrada)
            VALUES ($1, $2, CURRENT_TIMESTAMP)
        `, [disp.participante_id, evento_id]);

        return res.json({ status: 'sucesso', mensagem: 'REGISTRO EFETUADO!' });
    } catch (error) {
        return res.status(500).json({ error: 'Erro ao registrar entrada.' });
    }
});

app.post('/api/v2/presenca/confirmar-saida', async (req, res) => {
    const { device_token, evento_id, estrelas, comentario } = req.body;
    try {
        const resDisp = await pool.query('SELECT * FROM dispositivos WHERE device_token = $1 AND ativo = true', [device_token]);
        const disp = resDisp.rows[0];
        const { dataStr } = obterAgoraBrasilia();

        // 1. Grava a pesquisa de satisfação
        await pool.query(`
            INSERT INTO pesquisa_satisfacao (evento_id, participante_id, estrelas, comentario, criado_em)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        `, [evento_id, disp.participante_id, estrelas || 5, comentario || '']);

        // 2. Atualiza a saída na tabela frequencias
        await pool.query(`
            UPDATE frequencias 
            SET data_saida = CURRENT_TIMESTAMP,
                permanencia = to_char(CURRENT_TIMESTAMP - data_entrada, 'HH24:MI:SS')
            WHERE participante_id = $1 AND evento_id = $2 AND data_saida IS NULL AND data_entrada::date = $3::date
        `, [disp.participante_id, evento_id, dataStr]);

        return res.json({ status: 'sucesso', joke: false, mensagem: 'REGISTRO EFETUADO!' });
    } catch (error) {
        return res.status(500).json({ error: 'Erro ao registrar saída.' });
    }
});

app.post('/api/portal-professor/validar', verificarToken, async (req, res) => {
    const { action, lat, lng, evento_id, avaliacao, comentarios } = req.body;
    const { id: participante_id, matricula, device_key } = req.user; // Obtidos via JWT decodificado

    const { dataBr, horaBr } = obterDataHoraBrasilia();
    const minutosAtual = paraMinutos(horaBr);

    try {
        // --- AÇÃO 1: CHECAGEM INICIAL ---
        if (action === 'checar') {
            // 1. Busca todos os eventos agendados para a data de hoje
            const queryEventos = `SELECT * FROM eventos WHERE data_evento = $1`;
            const { rows: eventosHoje } = await pool.query(queryEventos, [dataBr]);

            if (eventosHoje.length === 0) {
                // Grava no log de fraudes silenciosamente
                await pool.query(
                    `INSERT INTO log_fraudes (matricula, lat_tentativa, lng_tentativa, motivo) VALUES ($1, $2, $3, $4)`,
                    [matricula, lat, lng, 'Sem evento agendado para o dia']
                );
                return res.json({ status: 'erro', mensagem: 'Não há evento ocorrendo neste local' });
            }

            // 2. Filtra eventos pela janela de horário permitida (-20min do início até -30min do fim)
            const eventosNaJanela = eventosHoje.filter(evt => {
                const minInicio = paraMinutos(evt.hora_inicio) - 20;
                const minFim = paraMinutos(evt.hora_fim) - 30;
                return minutosAtual >= minInicio && minutosAtual <= minFim;
            });

            if (eventosNaJanela.length === 0) {
                // Fora do horário permitido
                await pool.query(
                    `INSERT INTO log_fraudes (matricula, evento_id, lat_tentativa, lng_tentativa, motivo) VALUES ($1, $2, $3, $4, $5)`,
                    [matricula, eventosHoje[0].id, lat, lng, 'FORA DA FAIXA DE HORÁRIO PERMITIDA']
                );
                return res.json({ status: 'erro', mensagem: 'FORA DA FAIXA DE HORÁRIO PERMITIDA' });
            }

            // 3. Filtra eventos pelo raio de distância (máximo 60 metros)
            const eventosElegiveis = eventosNaJanela.filter(evt => {
                const dist = calcularDistancia(Number(lat), Number(lng), Number(evt.latitude), Number(evt.longitude));
                return dist <= 60;
            });

            if (eventosElegiveis.length === 0) {
                // Fora do raio permitido
                await pool.query(
                    `INSERT INTO log_fraudes (matricula, evento_id, lat_tentativa, lng_tentativa, motivo) VALUES ($1, $2, $3, $4, $5)`,
                    [matricula, eventosNaJanela[0].id, lat, lng, 'Fora do raio de 60 metros']
                );
                return res.json({ status: 'erro', mensagem: 'Não existe evento elegível neste local nesta faixa de horário' });
            }

            // 4. Se houver múltiplos eventos elegíveis no mesmo raio/horário
            if (eventosElegiveis.length > 1 && !evento_id) {
                return res.json({ status: 'multiplos_eventos', eventos: eventosElegiveis });
            }

            // Determina o evento alvo (o único elegível ou o selecionado)
            const eventoAlvo = evento_id ? eventosElegiveis.find(e => e.id === Number(evento_id)) : eventosElegiveis[0];

            if (!eventoAlvo) {
                return res.json({ status: 'erro', mensagem: 'Evento selecionado inválido ou distante.' });
            }

            // 5. Verifica o histórico de frequência do professor neste evento
            const { rows: freq } = await pool.query(
                `SELECT * FROM frequencias WHERE participante_id = $1 AND evento_id = $2`,
                [participante_id, eventoAlvo.id]
            );

            if (freq.length > 0) {
                const registro = freq[0];
                if (registro.data_entrada && registro.data_saida) {
                    return res.json({ status: 'ja_registrado', mensagem: 'Já consta registro de presença (entrada e saída) para este evento.', evento: eventoAlvo });
                } else if (registro.data_entrada && !registro.data_saida) {
                    return res.json({ status: 'necessita_saida', evento: eventoAlvo });
                }
            }

            return res.json({ status: 'confirmar_entrada', evento: eventoAlvo });
        }

        // --- AÇÃO 2: REGISTRAR ENTRADA ---
        if (action === 'confirmar_entrada') {
            if (!evento_id) return res.status(400).json({ error: 'ID do evento ausente.' });

            await pool.query(
                `INSERT INTO frequencias (participante_id, evento_id, lat_entrada, lng_entrada, device_key, matricula, funcao) 
                 VALUES ($1, $2, $3, $4, $5, $6, 'Ouvinte')`,
                [participante_id, evento_id, lat.toString(), lng.toString(), device_key || 'WEB', matricula]
            );

            return res.json({ status: 'sucesso', mensagem: 'REGISTRO EFETUADO!' });
        }

        // --- AÇÃO 3: REGISTRAR SAÍDA + PESQUISA ---
        if (action === 'registrar_saida') {
            if (!evento_id || !avaliacao) return res.status(400).json({ error: 'Dados insuficientes.' });

            // Busca o publico_alvo_id do evento correspondente
            const { rows: evt } = await pool.query(`SELECT publico_alvo_id FROM eventos WHERE id = $1`, [evento_id]);
            const publico_alvo_id = evt[0]?.publico_alvo_id || null;

            // Insere na tabela de pesquisas de satisfação
            await pool.query(
                `INSERT INTO pesquisa_satisfacao (participante_id, evento_id, publico_alvo_id, avaliacao, comentarios) 
                 VALUES ($1, $2, $3, $4, $5)`,
                [participante_id, evento_id, publico_alvo_id, avaliacao, comentarios || '']
            );

            // Atualiza a tabela frequencias aplicando o timestamp de saída
            await pool.query(
                `UPDATE frequencias 
                 SET data_saida = CURRENT_TIMESTAMP, lat_saida = $1, lng_saida = $2, avaliacao = $3 
                 WHERE participante_id = $4 AND evento_id = $5 AND data_saida IS NULL`,
                [lat.toString(), lng.toString(), avaliacao, participante_id, evento_id]
            );

            return res.json({ status: 'sucesso', message: 'REGISTRO EFETUADO!' });
        }

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro interno no servidor do portal.' });
    }
});

// ROTA UNIFICADA E CORRIGIDA SEGUNDO A REGRA DE NEGÓCIO
app.post('/api/v2/presenca/registrar', async (req, res) => {
    // Aceita tanto os formatos de campos do fluxo do Portal quanto do App geral
    const device_token = req.body.device_token || req.body.token;
    const latitude = req.body.latitude !== undefined ? req.body.latitude : req.body.lat;
    const longitude = req.body.longitude !== undefined ? req.body.longitude : req.body.lng;
    
    const { evento_id, action, avaliacao, estrelas, comentario, comentarios } = req.body;

    try {
        if (!device_token || latitude === undefined || longitude === undefined) {
            return res.status(400).json({ error: 'Dados de localização ou identificação ausentes.' });
        }

        // 1. Identifica o participante através do token do dispositivo
        const resDisp = await pool.query('SELECT * FROM dispositivos WHERE device_token = $1 AND ativo = true', [device_token]);
        if (resDisp.rows.length === 0) {
            return res.status(401).json({ error: 'Aparelho não associado ou vínculo inválido.' });
        }
        const disp = resDisp.rows[0];
        const participanteId = disp.participante_id;
        const matricula = disp.participante_matricula;

        // HELPER: Garante o cálculo exato do fuso horário de Brasília (-03:00)
        const obterAgoraBrasilia = () => {
            const d = new Date();
            const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
            const dataBrasilia = new Date(utc + (3600000 * -3));
            
            const ano = dataBrasilia.getFullYear();
            const mes = String(dataBrasilia.getMonth() + 1).padStart(2, '0');
            const dia = String(dataBrasilia.getDate()).padStart(2, '0');
            
            return {
                dataStr: `${ano}-${mes}-${dia}`,
                minutosAbsolutos: (dataBrasilia.getHours() * 60) + dataBrasilia.getMinutes()
            };
        };

        const paraMinutos = (timeStr) => {
            if (!timeStr) return 0;
            const partes = timeStr.split(':');
            return (parseInt(partes[0], 10) * 60) + parseInt(partes[1], 10);
        };

        const { dataStr, minutosAbsolutos } = obterAgoraBrasilia();

        // 2. VERIFICAÇÃO DE EVENTO JÁ EM ANDAMENTO (Entrada registrada sem saída na data de hoje)
        const resAberto = await pool.query(`
            SELECT f.*, e.titulo, e.local_exibicao as local, e.endereco
            FROM frequencias f
            JOIN eventos e ON f.evento_id = e.id
            WHERE f.participante_id = $1 AND f.data_saida IS NULL AND f.data_entrada::date = $2::date
        `, [participanteId, dataStr]);

        if (resAberto.rows.length > 0) {
            const freqAtiva = resAberto.rows[0];

            // Se o usuário estiver submetendo a pesquisa de satisfação para registrar a saída
            if (action === 'registrar_saida' || estrelas || avaliacao) {
                const notaEstrelas = estrelas || (avaliacao === 'Ótimo' ? 5 : avaliacao === 'Muito Bom' ? 4 : avaliacao === 'Bom' ? 3 : avaliacao === 'Regular' ? 2 : 1);
                const txtComentario = comentario || comentarios || '';

                // Salva na tabela 'pesquisa_satisfacao'
                await pool.query(`
                    INSERT INTO pesquisa_satisfacao (evento_id, participante_id, estrelas, comentario, criado_em)
                    VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                `, [freqAtiva.evento_id, participanteId, notaEstrelas, txtComentario]);

                // Atualiza a tabela 'frequencias' com a saída
                await pool.query(`
                    UPDATE frequencias 
                    SET data_saida = CURRENT_TIMESTAMP,
                        permanencia = to_char(CURRENT_TIMESTAMP - data_entrada, 'HH24:MI:SS')
                    WHERE id = $1
                `, [freqAtiva.id]);

                return res.json({ status: 'sucesso', mensagem: 'REGISTRO EFETUADO!' });
            } else {
                // Caso seja apenas a checagem inicial, joga ele direto na tela da pesquisa
                return res.json({
                    status: 'necessita_saida',
                    evento: { id: freqAtiva.evento_id, titulo: freqAtiva.titulo }
                });
            }
        }

        // 3. SE NÃO HÁ EVENTO EM ABERTO, BUSCA OS AGENDADOS PARA HOJE NO BANCO
        const resEventos = await pool.query(`
            SELECT id, titulo, local_exibicao, endereco, latitude, longitude,
                   horario_inicio::text as h_ini, horario_fim::text as h_fim 
            FROM eventos 
            WHERE ativo = true AND data_evento = $1
        `, [dataStr]);

        // Situação A: Nenhum evento agendado para hoje no sistema inteiro
        if (resEventos.rows.length === 0) {
            await pool.query(`
                INSERT INTO log_fraudes (matricula, evento_id, motivo, distancia_calculada)
                VALUES ($1, NULL, 'NENHUM EVENTO AGENDADO NA DATA DE HOJE', 0)
            `, [matricula]);

            return res.status(400).json({ error: 'Não há evento ocorrendo neste local.' });
        }

        // Mapeia e calcula a distância de todos os eventos de hoje
        const eventosComDistancia = resEventos.rows.map(ev => {
            const dist = calcularDistancia(latitude, longitude, parseFloat(ev.latitude), parseFloat(ev.longitude));
            return { ...ev, distancia: dist };
        });

        // Filtra os que respeitam o raio máximo de 60 metros
        const dentroDoRaio = eventosComDistancia.filter(ev => ev.distancia <= 60);

        // Situação B: Há eventos hoje, mas nenhum está no raio de 60 metros
        if (dentroDoRaio.length === 0) {
            const maisProximo = eventosComDistancia.reduce((prev, curr) => prev.distancia < curr.distancia ? prev : curr);
            
            await pool.query(`
                INSERT INTO log_fraudes (matricula, evento_id, motivo, distancia_calculada)
                VALUES ($1, $2, 'FORA_DO_RAIO_PERMITIDO', $3)
            `, [matricula, maisProximo.id, maisProximo.distancia]);

            return res.status(400).json({ error: 'Não existe evento elegível neste local nesta faixa de horário.' });
        }

        // Filtra os eventos dentro do raio que estão na janela de tempo permitida (20 min antes até 30 min antes do fim)
        const elegiveisHorario = dentroDoRaio.filter(ev => {
            const minInicio = paraMinutos(ev.h_ini);
            const minFim = paraMinutos(ev.h_fim);
            return minutosAbsolutos >= (minInicio - 20) && minutosAbsolutos <= (minFim - 30);
        });

        // Situação C: Está no local correto (raio ok), mas fora do horário permitido
        if (elegiveisHorario.length === 0) {
            await pool.query(`
                INSERT INTO log_fraudes (matricula, evento_id, motivo, distancia_calculada)
                VALUES ($1, $2, 'FORA_DA_FAIXA_DE_HORARIO_PERMITIDA', $3)
            `, [matricula, dentroDoRaio[0].id, dentroDoRaio[0].distancia]);

            return res.status(400).json({ error: 'FORA DA FAIXA DE HORÁRIO PERMITIDA' });
        }

        // Situação D: Mais de um evento elegível no mesmo espaço e horário (Exibe listagem de escolha)
        if (!evento_id && elegiveisHorario.length > 1) {
            return res.json({
                status: 'multiplos_eventos',
                multiplos_eventos: true,
                eventos: elegiveisHorario.map(e => ({
                    id: e.id,
                    titulo: e.titulo,
                    local: e.local_exibicao || 'Auditório'
                }))
            });
        }

        // Define o evento final (o único existente ou o que foi escolhido na lista)
        const eventoAlvo = evento_id 
            ? elegiveisHorario.find(e => e.id === parseInt(evento_id)) 
            : elegiveisHorario[0];

        if (!eventoAlvo) {
            return res.status(400).json({ error: 'Não existe evento elegível neste local nesta faixa de horário.' });
        }

        // 4. VERIFICA SE JÁ EXISTE ENTRADA E SAÍDA COMPLETA DO PROFESSOR NESTE EVENTO
        const resHistorico = await pool.query(`
            SELECT * FROM frequencias 
            WHERE participante_id = $1 AND evento_id = $2 AND data_entrada::date = $3::date
        `, [participanteId, eventoAlvo.id, dataStr]);

        if (resHistorico.rows.length > 0 && resHistorico.rows[0].data_saida !== null) {
            return res.status(400).json({ error: 'Já consta entrada e saída registrada desta pessoa para este evento.' });
        }

        // 5. EFETUA O REGISTRO DE ENTRADA OU APENAS SOLICITA CONFIRMAÇÃO EM TELA
        if (action === 'confirmar_entrada') {
            await pool.query(`
                INSERT INTO frequencias (participante_id, evento_id, data_entrada)
                VALUES ($1, $2, CURRENT_TIMESTAMP)
            `, [participanteId, eventoAlvo.id]);

            return res.json({ status: 'sucesso', mensagem: 'REGISTRO EFETUADO!' });
        } else {
            // Retorna os dados limpos para renderizar a tela de confirmação intuitiva
            return res.json({
                status: 'confirmar_entrada',
                evento: {
                    id: eventoAlvo.id,
                    titulo: eventoAlvo.titulo,
                    local: eventoAlvo.local_exibicao || 'Auditório',
                    endereco: eventoAlvo.endereco || ''
                }
            });
        }

    } catch (error) {
        console.error("Erro crítico no processamento de presença:", error.message);
        return res.status(500).json({ error: 'Erro interno ao processar o registro de presença.' });
    }
});

app.post('/api/v2/presenca/registrar-especifico', async (req, res) => {
    const { device_token, evento_id } = req.body;
    try {
        const resDisp = await pool.query('SELECT * FROM dispositivos WHERE device_token = $1 AND ativo = true', [device_token]);
        if (resDisp.rows.length === 0) return res.status(401).json({ error: 'Não autorizado.' });
        
        const disp = resDisp.rows[0];
        await pool.query("INSERT INTO frequencias (participante_id, evento_id, data_entrada, matricula) VALUES ($1, $2, NOW(), $3)", [disp.participante_id, evento_id, disp.participante_matricula]);
        return res.json({ sucesso: true, mensagem: 'Chegada registrada no evento selecionado!' });
    } catch (error) {
        return res.status(500).json({ error: 'Erro interno.' });
    }
});

app.post('/api/v2/presenca/confirmar-saida-precoce', async (req, res) => {
    const { frequencia_id, device_token } = req.body;
    try {
        const resDisp = await pool.query('SELECT * FROM dispositivos WHERE device_token = $1 AND ativo = true', [device_token]);
        if (resDisp.rows.length === 0) return res.status(401).json({ error: 'Não autorizado.' });
        const disp = resDisp.rows[0];
        const resPart = await pool.query('SELECT * FROM participantes WHERE id = $1', [disp.participante_id]);
        const part = resPart.rows[0];
        const resFreq = await pool.query('SELECT * FROM frequencias WHERE id = $1', [frequencia_id]);
        const freq = resFreq.rows[0];
        
        await pool.query("INSERT INTO log_fraudes (matricula, evento_id, motivo, distancia_calculada) VALUES ($1, $2, $3, $4)", [part.matricula, freq.evento_id, 'Saída precoce confirmada pelo usuário (Menos de 20 minutos de permanência)', 0]);
        
        // CORRIGIDO: Removida a tentativa de update na coluna inexistente 'permanencia'
        await pool.query("UPDATE frequencias SET data_saida = NOW() WHERE id = $1", [frequencia_id]);
        return res.json({ sucesso: true, mensagem: 'Saída registrada. Permanência concluída antes do tempo mínimo.' });
    } catch (error) {
        return res.status(500).json({ error: 'Erro interno.' });
    }
});

app.post('/api/v2/presenca/concluir-saida', async (req, res) => {
    const { frequencia_id, estrelas, comentario, device_token, evento_id, publico_alvo_id } = req.body;
    
    try {
        const resDisp = await pool.query('SELECT * FROM dispositivos WHERE device_token = $1 AND ativo = true', [device_token]);
        if (resDisp.rows.length === 0) {
            return res.status(401).json({ error: 'Não autorizado ou dispositivo inativo.' });
        }

        let avaliacaoTexto = 'Ótimo';
        if (estrelas == 1) avaliacaoTexto = 'Ruim';
        else if (estrelas == 2) avaliacaoTexto = 'Regular';
        else if (estrelas == 3) avaliacaoTexto = 'Bom';
        else if (estrelas == 4) avaliacaoTexto = 'Muito Bom';

        // 1. SUCESSO EXIGIDO: Primeiro registra obrigatoriamente a pesquisa de satisfação
        await pool.query(`
            INSERT INTO pesquisa_satisfacao (participante_id, evento_id, publico_alvo_id, avaliacao, comentarios, criado_em) 
            VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        `, [resDisp.rows[0].participante_id, evento_id, publico_alvo_id || null, avaliacaoTexto, comentario || '']);

        // 2. AFROUXAMENTO DA REGRA DOS 40 MINUTOS: Verifica se extrapolou o tempo previsto do evento
        const resEv = await pool.query('SELECT horario_fim FROM eventos WHERE id = $1', [evento_id]);
        let registrarHorarioPrevisto = false;

        if (resEv.rows.length > 0 && resEv.rows[0].horario_fim) {
            const paraMinutos = (timeStr) => {
                const [h, m] = timeStr.split(':').map(Number);
                return (h * 60) + m;
            };
            const agoraData = new Date();
            const agoraMinutos = (agoraData.getHours() * 60) + agoraData.getMinutes();
            const minutosFimPrevisto = paraMinutos(resEv.rows[0].horario_fim);

            // Se o prazo limite de 40 min expirou, a hora de saída será forçada para o horário previsto do fim
            if (agoraMinutos > (minutosFimPrevisto + 40)) {
                registrarHorarioPrevisto = true;
            }
        }

        // 3. Efetua a gravação da data_saida (CORRIGIDO: Removida coluna inexistente 'permanencia')
        if (registrarHorarioPrevisto && resEv.rows[0].horario_fim) {
            await pool.query(`
                UPDATE frequencias 
                SET data_saida = (CURRENT_DATE + $1::time) 
                WHERE id = $2
            `, [resEv.rows[0].horario_fim, frequencia_id]);
        } else {
            await pool.query(`
                UPDATE frequencias 
                SET data_saida = CURRENT_TIMESTAMP 
                WHERE id = $1
            `, [frequencia_id]);
        }

        return res.json({ sucesso: true, mensagem: 'Saída registrada e pesquisa enviada com sucesso! Obrigado.' });

    } catch (error) {
        console.error("Erro crítico ao concluir saída:", error.message);
        return res.status(500).json({ error: 'Erro interno ao processar encerramento da presença.' });
    }
});

app.get('/api/v2/eventos', verificarToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM eventos ORDER BY data_evento DESC');
        return res.json(result.rows);
    } catch (error) {
        return res.status(500).json({ error: 'Erro.' });
    }
});

app.post('/api/v2/eventos', verificarToken, async (req, res) => {
    const { titulo, data_evento, carga_horaria, local_id, publico_alvo_id, hora_inicio, hora_fim } = req.body;
    try {
        const result = await pool.query('INSERT INTO eventos (titulo, data_evento, carga_horaria, local_id, publico_alvo_id, hora_inicio, hora_fim) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *', [titulo, data_evento, carga_horaria, local_id, publico_alvo_id, hora_inicio, hora_fim]);
        return res.json(result.rows[0]);
    } catch (error) {
        return res.status(500).json({ error: 'Erro.' });
    }
});

app.put('/api/v2/eventos/:id', verificarToken, async (req, res) => {
    const { titulo, data_evento, carga_horaria, local_id, publico_alvo_id, hora_inicio, hora_fim } = req.body;
    try {
        const result = await pool.query('UPDATE eventos SET titulo=$1, data_evento=$2, carga_horaria=$3, local_id=$4, publico_alvo_id=$5, hora_inicio=$6, hora_fim=$7 WHERE id=$8 RETURNING *', [titulo, data_evento, carga_horaria, local_id, publico_alvo_id, hora_inicio, hora_fim, req.params.id]);
        return res.json(result.rows[0]);
    } catch (error) {
        return res.status(500).json({ error: 'Erro.' });
    }
});

app.delete('/api/v2/eventos/:id', verificarToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM eventos WHERE id = $1', [req.params.id]);
        return res.json({ success: true });
    } catch (error) {
        return res.status(500).json({ error: 'Erro.' });
    }
});

app.get('/api/v2/locais', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM locais ORDER BY nome ASC');
        return res.json(result.rows);
    } catch (error) {
        return res.status(500).json({ error: 'Erro.' });
    }
});

app.post('/api/v2/locais', verificarToken, async (req, res) => {
    const { nome, endereco, latitude, longitude } = req.body;
    try {
        const result = await pool.query('INSERT INTO locais (nome, endereco, latitude, longitude) VALUES ($1, $2, $3, $4) RETURNING *', [nome, endereco, latitude, longitude]);
        return res.json(result.rows[0]);
    } catch (error) {
        return res.status(500).json({ error: 'Erro.' });
    }
});

app.put('/api/v2/locais/:id', verificarToken, async (req, res) => {
    const { nome, endereco, latitude, longitude } = req.body;
    try {
        const result = await pool.query('UPDATE locais SET nome=$1, endereco=$2, latitude=$3, longitude=$4 WHERE id=$5 RETURNING *', [nome, endereco, latitude, longitude, req.params.id]);
        return res.json(result.rows[0]);
    } catch (error) {
        return res.status(500).json({ error: 'Erro.' });
    }
});

app.delete('/api/v2/locais/:id', verificarToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM locais WHERE id = $1', [req.params.id]);
        return res.json({ success: true });
    } catch (error) {
        return res.status(500).json({ error: 'Erro.' });
    }
});

app.get('/api/v2/participantes', verificarToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM participantes ORDER BY nome_completo ASC');
        return res.json(result.rows);
    } catch (error) {
        return res.status(500).json({ error: 'Erro.' });
    }
});

app.put('/api/v2/participantes/:id', verificarToken, async (req, res) => {
    const { nome_completo, ativo } = req.body;
    try {
        const result = await pool.query('UPDATE participantes SET nome_completo=$1, ativo=$2 WHERE id=$3 RETURNING *', [nome_completo, ativo, req.params.id]);
        return res.json(result.rows[0]);
    } catch (error) {
        return res.status(500).json({ error: 'Erro.' });
    }
});

app.get('/api/v2/frequencias', verificarToken, async (req, res) => {
    try {
        // CORRIGIDO: Calculando a permanência dinamicamente no SELECT (já que a coluna não existe física no banco)
        const result = await pool.query(`
            SELECT f.*, p.nome_completo as participante_nome, p.matricula, e.titulo as evento_titulo,
                   to_char(f.data_saida - f.data_entrada, 'HH24:MI:SS') as permanencia
            FROM frequencias f
            JOIN participantes p ON f.participante_id = p.id
            JOIN eventos e ON f.evento_id = e.id
            ORDER BY f.data_entrada DESC
        `);
        return res.json(result.rows);
    } catch (error) {
        return res.status(500).json({ error: 'Erro.' });
    }
});

app.get('/api/v2/log-fraudes', verificarToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT lf.*, e.titulo as evento_titulo 
            FROM log_fraudes lf
            LEFT JOIN eventos e ON lf.evento_id = e.id
            ORDER BY lf.data_tentativa DESC
        `);
        return res.json(result.rows);
    } catch (error) {
        return res.status(500).json({ error: 'Erro.' });
    }
});

app.get('/api/v2/pesquisa-satisfacao', verificarToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                ps.id,
                ps.avaliacao as estrelas,       
                ps.comentarios as comentario,   
                ps.criado_em as data_resposta,  
                p.nome_completo as participante_nome,
                e.titulo as evento_titulo
            FROM pesquisa_satisfacao ps
            LEFT JOIN participantes p ON ps.participante_id = p.id
            LEFT JOIN eventos e ON ps.evento_id = e.id
            ORDER BY ps.criado_em DESC
        `);
        return res.json(result.rows);
    } catch (error) {
        console.error("Erro detalhado no Postgres (Pesquisa):", error.message);
        return res.status(500).json({ error: 'Erro interno ao recuperar pesquisas de satisfação.' });
    }
});

app.get('/api/v2/publico-alvo', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM publicoalvo ORDER BY nome ASC');
        return res.json(result.rows);
    } catch (error) {
        return res.status(500).json({ error: 'Erro.' });
    }
});

app.post('/api/v2/publico-alvo', verificarToken, async (req, res) => {
    const { nome } = req.body;
    try {
        const result = await pool.query('INSERT INTO publicoalvo (nome, ativo) VALUES ($1, true) RETURNING *', [nome]);
        return res.json(result.rows[0]);
    } catch (error) {
        return res.status(500).json({ error: 'Erro.' });
    }
});

app.delete('/api/v2/publico-alvo/:id', verificarToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM publicoalvo WHERE id = $1', [req.params.id]);
        return res.json({ success: true });
    } catch (error) {
        return res.status(500).json({ error: 'Erro.' });
    }
});

app.get('/api/v2/usuarios', verificarToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, nome, usuario, ativo, deve_alterar_senha FROM usuarios ORDER BY nome ASC');
        return res.json(result.rows);
    } catch (error) {
        return res.status(500).json({ error: 'Erro.' });
    }
});

app.post('/api/v2/usuarios', verificarToken, async (req, res) => {
    const { nome, usuario, senha } = req.body;
    try {
        const hash = hashSenha(senha);
        const result = await pool.query('INSERT INTO usuarios (nome, usuario, senha, ativo, deve_alterar_senha) VALUES ($1, $2, $3, true, true) RETURNING id, nome, usuario, ativo', [nome, usuario, hash]);
        return res.json(result.rows[0]);
    } catch (error) {
        return res.status(500).json({ error: 'Erro.' });
    }
});

app.put('/api/v2/usuarios/alterar-propria-senha', verificarToken, async (req, res) => {
    const { novaSenha } = req.body;
    try {
        const hash = hashSenha(novaSenha);
        await pool.query('UPDATE usuarios SET senha = $1 WHERE id = $2', [hash, req.user.id]);
        return res.json({ success: true });
    } catch (error) {
        return res.status(500).json({ error: 'Erro.' });
    }
});

app.get('/api/v2/relatorios/:tipo', verificarToken, async (req, res) => {
    const { tipo } = req.params;
    const { data_inicio, data_fim } = req.query;
    try {
        let query = '';
        if (tipo === 'formacoes') {
            query = `SELECT e.*, l.nome as local_nome, pa.nome as publico_nome FROM eventos e LEFT JOIN locais l ON e.local_id = l.id LEFT JOIN publicoalvo pa ON e.publico_alvo_id = pa.id WHERE e.data_evento BETWEEN $1 AND $2 ORDER BY e.data_evento DESC`;
        } else if (tipo === 'participante') {
            // CORRIGIDO: Calculando permanência dinamicamente no SELECT do relatório
            query = `SELECT p.nome_completo, p.matricula, e.titulo as evento_titulo, f.data_entrada, f.data_saida, to_char(f.data_saida - f.data_entrada, 'HH24:MI:SS') as permanencia FROM frequencias f JOIN participantes p ON f.participante_id = p.id JOIN eventos e ON f.evento_id = e.id WHERE e.data_evento BETWEEN $1 AND $2 ORDER BY p.nome_completo ASC`;
        } else if (tipo === 'publico-alvo') {
            query = `SELECT pa.nome as publico_nome, e.titulo as evento_titulo, COUNT(f.id) as total_participacoes FROM eventos e JOIN publicoalvo pa ON e.publico_alvo_id = pa.id LEFT JOIN frequencias f ON f.evento_id = e.id WHERE e.data_evento BETWEEN $1 AND $2 GROUP BY pa.nome, e.titulo ORDER BY pa.nome ASC`;
        } else if (tipo === 'estatisticas') {
            const tPart = await pool.query(`SELECT e.titulo, COUNT(f.id) as total FROM eventos e LEFT JOIN frequencias f ON f.evento_id = e.id WHERE e.data_evento BETWEEN $1 AND $2 GROUP BY e.titulo`);
            const tPesq = await pool.query(`SELECT e.titulo, AVG(ps.estrelas)::numeric(10,2) as media_estrelas, COUNT(ps.id) as total_respostas FROM eventos e LEFT JOIN pesquisa_satisfacao ps ON ps.evento_id = e.id WHERE e.data_evento BETWEEN $1 AND $2 GROUP BY e.titulo`);
            const tOcor = await pool.query(`SELECT motivo, COUNT(id) as total FROM log_fraudes WHERE data_tentativa BETWEEN $1::date AND ($2::date + integer '1') GROUP BY motivo`);
            return res.json({ participacoes: tPart.rows, opiniao: tPesq.rows, ocorrencias: tOcor.rows });
        }
        const result = await pool.query(query, [data_inicio, data_fim]);
        return res.json(result.rows);
    } catch (error) {
        return res.status(500).json({ error: 'Erro.' });
    }
});

app.use((req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));
app.use((err, req, res, next) => res.status(500).json({ error: 'Erro crítico interno.' }));

app.listen(PORT, () => {});