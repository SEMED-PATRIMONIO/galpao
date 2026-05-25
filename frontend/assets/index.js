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

// ==========================================
// FUNÇÕES AUXILIARES DE DATA, HORA E FUSO
// ==========================================
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

// ==========================================
// ROTAS DE AUTENTICAÇÃO ADMINISTRATIVA
// ==========================================
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

// ==========================================
// ROTAS DE GERENCIAMENTO DE DISPOSITIVOS
// ==========================================
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
        return res.json({ 
            device_token: tokenDispositivo, 
            token: tokenDispositivo, 
            participante: partFinal.rows[0] 
        });
    } catch (error) {
        console.error("Erro crítico na rota /dispositivo/associar:", error.message);
        return res.status(500).json({ error: 'Erro interno ao associar dispositivo.' });
    }
});

// ==========================================
// 1. INICIALIZAR: LISTA APENAS O QUE IMPORTA
// ==========================================
app.post('/api/v2/presenca/inicializar', async (req, res) => {
    const { device_token } = req.body;
    try {
        if (!device_token) return res.status(400).json({ error: 'Identificação ausente.' });

        const resDisp = await pool.query('SELECT * FROM dispositivos WHERE device_token = $1 AND ativo = true', [device_token]);
        if (resDisp.rows.length === 0) return res.status(401).json({ error: 'Aparelho não associado ou desativado.' });
        const disp = resDisp.rows[0];

        // Regra 1: Traz apenas eventos de HOJE cuja hora de FIM ainda não passou (ignora os já encerrados)
        const resEventos = await pool.query(`
            SELECT e.id, e.titulo, e.local, e.palestrante, e.hora_inicio, e.hora_fim,
                   l.nome as local_nome, l.endereco as local_endereco,
                   COALESCE(l.latitude, e.latitude) as latitude, 
                   COALESCE(l.longitude, e.longitude) as longitude
            FROM eventos e
            LEFT JOIN locais l ON e.local_id = l.id
            WHERE e.data_evento = CURRENT_DATE::date 
              AND e.hora_fim >= CURRENT_TIME
            ORDER BY e.hora_inicio ASC
        `);

        // Regra 2 e 3: Verifica se este participante já tem alguma entrada ativa hoje sem saída lançada
        const freqAtiva = await pool.query(`
            SELECT * FROM frequencias 
            WHERE participante_id = $1 AND data_entrada::date = CURRENT_DATE::date AND data_saida IS NULL
            LIMIT 1
        `, [disp.participante_id]);

        return res.json({
            status: 'sucesso',
            tem_evento_ativo: freqAtiva.rows.length > 0,
            evento_ativo_id: freqAtiva.rows.length > 0 ? freqAtiva.rows[0].evento_id : null,
            eventos: resEventos.rows.map(e => ({
                id: e.id,
                titulo: e.titulo,
                palestrante: e.palestrante || '',
                local: e.local_nome || e.local || 'Auditório',
                endereco: e.local_endereco || e.endereco || '',
                latitude: e.latitude,
                longitude: e.longitude,
                hora_inicio: e.hora_inicio,
                hora_fim: e.hora_fim
            }))
        });
    } catch (error) {
        console.error("Erro no inicializar:", error.message);
        return res.status(500).json({ error: 'Erro interno ao inicializar o Portal.' });
    }
});

// ==========================================
// 2. CHECAR STATUS: VALIDA REGRAS DE TEMPO
// ==========================================
app.post('/api/v2/presenca/checar-status', async (req, res) => {
    const { device_token, evento_id, latitude, longitude } = req.body;
    try {
        const resDisp = await pool.query('SELECT * FROM dispositivos WHERE device_token = $1 AND ativo = true', [device_token]);
        if (resDisp.rows.length === 0) return res.status(401).json({ error: 'Dispositivo inválido.' });
        const disp = resDisp.rows[0];

        const resEv = await pool.query(`
            SELECT e.*, COALESCE(l.latitude, e.latitude) as lat_real, COALESCE(l.longitude, e.longitude) as lng_real
            FROM eventos e LEFT JOIN locais l ON e.local_id = l.id WHERE e.id = $1
        `, [evento_id]);
        if (resEv.rows.length === 0) return res.status(404).json({ error: 'Formação não localizada.' });
        const ev = resEv.rows[0];

        const dist = calcularDistancia(latitude, longitude, parseFloat(ev.lat_real), parseFloat(ev.lng_real));
        if (dist > 1000) {
            await pool.query(`INSERT INTO log_fraudes (matricula, evento_id, motivo, lat_tentativa, lng_tentativa) VALUES ($1, $2, 'FORA_DO_RAIO_PERMITIDO', $3, $4)`, [disp.participante_matricula, evento_id, latitude, longitude]);
            return res.status(400).json({ error: 'Bloqueio de Segurança: Você está fora do raio permitido do local.' });
        }

        // Verifica o histórico deste par (participante, evento) hoje
        const resFreq = await pool.query(`
            SELECT *, EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - data_entrada))/60 as minutos_decorridos
            FROM frequencias WHERE participante_id = $1 AND evento_id = $2 AND data_entrada::date = CURRENT_DATE::date
        `, [disp.participante_id, evento_id]);

        if (resFreq.rows.length > 0) {
            const freq = resFreq.rows[0];
            if (freq.data_saida !== null) {
                return res.json({ status: 'completo' });
            } else {
                // Regra 5: Bloqueia saída se tiver menos de 30 minutos de participação
                if (freq.minutos_decorridos < 30) {
                    return res.status(400).json({ error: `Acesso Retido: Você só poderá registrar sua saída após 30 minutos da sua entrada (Faltam ${Math.ceil(30 - freq.minutos_decorridos)} min).` });
                }
                return res.json({ status: 'somente_entrada' });
            }
        }

        // Regra 2: Bloqueia entrada se já houver OUTRO evento ativo pendente de saída
        const outroAtivo = await pool.query(`SELECT id FROM frequencias WHERE participante_id = $1 AND data_entrada::date = CURRENT_DATE::date AND data_saida IS NULL`, [disp.participante_id]);
        if (outroAtivo.rows.length > 0) {
            return res.status(400).json({ error: 'Você já possui uma frequência em andamento. Encerre-a antes de iniciar outra.' });
        }

        return res.json({ status: 'nenhum' });
    } catch (error) {
        return res.status(500).json({ error: 'Erro ao analisar status de presença.' });
    }
});

// ==========================================
// 3. CONFIRMAR ENTRADA: GRAVAÇÃO COMPLETA
// ==========================================
app.post('/api/v2/presenca/confirmar-entrada', async (req, res) => {
    const { device_token, evento_id, latitude, longitude } = req.body;
    try {
        const resDisp = await pool.query('SELECT * FROM dispositivos WHERE device_token = $1 AND ativo = true', [device_token]);
        if (resDisp.rows.length === 0) return res.status(401).json({ error: 'Dispositivo inválido.' });
        const disp = resDisp.rows[0];

        // Regra 6: Preenche os campos lat_entrada, lng_entrada, device_key e matricula corretamente
        await pool.query(`
            INSERT INTO frequencias (participante_id, evento_id, lat_entrada, lng_entrada, device_key, matricula, funcao, data_entrada)
            VALUES ($1, $2, $3, $4, $5, $6, 'Ouvinte', CURRENT_TIMESTAMP)
        `, [disp.participante_id, evento_id, String(latitude), String(longitude), device_token, disp.participante_matricula]);

        return res.json({ status: 'sucesso' });
    } catch (error) {
        console.error("Erro ao gravar entrada:", error.message);
        return res.status(500).json({ error: 'Erro interno ao salvar frequência.' });
    }
});

// ==========================================
// 4. CONFIRMAR SAÍDA: TRATA FRAUDE DE HORÁRIO
// ==========================================
app.post('/api/v2/presenca/confirmar-saida', async (req, res) => {
    const { device_token, evento_id, estrelas, comentario, latitude, longitude } = req.body;
    try {
        const resDisp = await pool.query('SELECT * FROM dispositivos WHERE device_token = $1 AND ativo = true', [device_token]);
        if (resDisp.rows.length === 0) return res.status(401).json({ error: 'Dispositivo inválido.' });
        const disp = resDisp.rows[0];

        const resEv = await pool.query('SELECT data_evento, hora_fim, publico_alvo_id FROM eventos WHERE id = $1', [evento_id]);
        const ev = resEv.rows[0];

        // CORREÇÃO DA AVALIAÇÃO: Alinhando estritamente com os dados reais do seu banco
        let avaliacaoTexto = 'Muito Bom'; // 5 estrelas
        if (estrelas === 4) avaliacaoTexto = 'Bom';
        if (estrelas === 3) avaliacaoTexto = 'Regular';
        if (estrelas === 2) avaliacaoTexto = 'Ruim';
        if (estrelas === 1) avaliacaoTexto = 'Péssimo';

        // OBTENÇÃO DO HORÁRIO REAL (Fuso Horário de São Paulo)
        const agoraTexto = new Date().toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo" });
        const dataHoraReal = new Date(agoraTexto);

        // OBTENÇÃO DO HORÁRIO DE TÉRMINO OFICIAL DO EVENTO
        // ev.data_evento vem no formato YYYY-MM-DD. Juntamos com a hora_fim (HH:MM:SS)
        const dataEventoFormatada = new Date(ev.data_evento).toISOString().split('T')[0];
        const dataHoraTerminoOficial = new Date(`${dataEventoFormatada}T${ev.hora_fim}`);

        // Diferença em minutos entre a batida de saída real e o término oficial
        const minutosAtraso = (dataHoraReal - dataHoraTerminoOficial) / (1000 * 60);

        let dataSaidaGravar;

        // REGRA 1: Se a pessoa está saindo ANTES do horário previsto para o término
        if (minutosAtraso < 0) {
            dataSaidaGravar = dataHoraReal; // Grava o horário real exato
        } 
        // REGRA 2 e 3: Se já passou do horário de término
        else {
            // Em ambos os casos (até 40 min ou mais de 40 min), grava o horário oficial de término
            dataSaidaGravar = dataHoraTerminoOficial;

            // REGRA 3: Se já tiver se passado MAIS de 40 minutos do término previsto
            if (minutosAtraso > 40) {
                // Grava a ocorrência de fraude
                await pool.query(`
                    INSERT INTO log_fraudes (matricula, evento_id, motivo, lat_tentativa, lng_tentativa, data_tentativa)
                    VALUES ($1, $2, 'SAIDA_APOS_40_MIN_DO_FIM', $3, $4, $5)
                `, [disp.participante_matricula, evento_id, String(latitude), String(longitude), dataHoraReal]);
            }
        }

        // Executa a transação garantindo integridade
        await pool.query('BEGIN');

        // Atualiza a tabela frequencias com a data de saída definida pelas regras
        await pool.query(`
            UPDATE frequencias 
            SET data_saida = $1, avaliacao = $2, lat_saida = $3, lng_saida = $4
            WHERE participante_id = $5 AND evento_id = $6 AND data_saida IS NULL
        `, [dataSaidaGravar, avaliacaoTexto, String(latitude), String(longitude), disp.participante_id, evento_id]);

        // Insere a avaliação na tabela pesquisa_satisfacao (evitando duplicidade)
        const jaAvaliou = await pool.query(`SELECT id FROM pesquisa_satisfacao WHERE participante_id = $1 AND evento_id = $2`, [disp.participante_id, evento_id]);
        if (jaAvaliou.rows.length === 0) {
            await pool.query(`
                INSERT INTO pesquisa_satisfacao (participante_id, evento_id, publico_alvo_id, avaliacao, comentarios, criado_em)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [disp.participante_id, evento_id, ev.publico_alvo_id, avaliacaoTexto, comentario || '', dataHoraReal]);
        }

        await pool.query('COMMIT');
        return res.json({ status: 'sucesso' });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error("Erro ao fechar saída:", error.message);
        return res.status(500).json({ error: 'Erro interno ao processar saída.' });
    }
});

app.get('/api/v2/eventos', async (req, res) => {
    try {
        // Traz de forma limpa todas as formações agendadas para a data de hoje (CURRENT_DATE)
        const result = await pool.query(`
            SELECT id, titulo, local, palestrante, latitude, longitude, hora_inicio, hora_fim, data_evento 
            FROM eventos 
            WHERE data_evento = CURRENT_DATE
            ORDER BY hora_inicio ASC
        `);
        return res.json(result.rows);
    } catch (error) {
        console.error("Erro ao listar eventos do dia:", error.message);
        return res.status(500).json({ error: 'Erro ao carregar formações disponíveis.' });
    }
});

// ==========================================
// ROTA POST: CADASTRO DE EVENTOS (CORRIGIDA)
// ==========================================
app.post('/api/v2/eventos', verificarToken, async (req, res) => {
    const { titulo, data_evento, carga_horaria, local_id, publico_alvo_id, hora_inicio, hora_fim, palestrante } = req.body;
    try {
        if (!local_id || !data_evento || !hora_inicio || !hora_fim) {
            return res.status(400).json({ error: 'Dados obrigatórios ausentes para agendamento.' });
        }

        // Garante formatação em HH:MI
        const limparHora = (h) => {
            if (!h) return '00:00';
            const partes = h.split(':');
            return `${partes[0].padStart(2, '0')}:${partes[1].padStart(2, '0')}`;
        };

        const h_ini_limpa = limparHora(hora_inicio);
        const h_fim_limpa = limparHora(hora_fim);

        // VALIDAÇÃO: Bloqueia conflito de horários no mesmo local e dia (Removido o campo 'ativo' inexistente)
        const conflito = await pool.query(`
            SELECT id, titulo FROM eventos 
            WHERE local_id = $1::integer AND data_evento = $2::date
              AND (
                ($3::time < hora_fim AND $4::time > hora_inicio)
              )
        `, [parseInt(local_id), data_evento, h_ini_limpa, h_fim_limpa]);

        if (conflito.rows.length > 0) {
            return res.status(400).json({ error: `Conflito de Horário! O evento "${conflito.rows[0].titulo}" já está agendado neste espaço neste período.` });
        }

        // Busca os dados geográficos e endereço oficiais na tabela 'locais'
        const resLocal = await pool.query('SELECT nome, endereco, latitude, longitude FROM locais WHERE id = $1::integer', [parseInt(local_id)]);
        const dadosLocal = resLocal.rows[0];

        if (!dadosLocal) {
            return res.status(400).json({ error: 'O local selecionado não foi encontrado no sistema.' });
        }

        // Inserção estrita com as colunas reais fornecidas pelo seu \d eventos
        const result = await pool.query(`
            INSERT INTO eventos 
            (titulo, data_evento, carga_horaria, local_id, publico_alvo_id, hora_inicio, hora_fim, palestrante, local, endereco, latitude, longitude) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
            RETURNING *
        `, [
            titulo, 
            data_evento, 
            parseFloat(carga_horaria || 0), 
            parseInt(local_id), 
            parseInt(publico_alvo_id), 
            h_ini_limpa, 
            h_fim_limpa,
            palestrante || '', 
            dadosLocal.nome || '', 
            dadosLocal.endereco || '', 
            dadosLocal.latitude ? parseFloat(dadosLocal.latitude) : null, 
            dadosLocal.longitude ? parseFloat(dadosLocal.longitude) : null
        ]);

        return res.json(result.rows[0]);
    } catch (error) {
        console.error("Erro crítico ao cadastrar evento no Postgres:", error.message);
        return res.status(500).json({ error: `Erro interno no banco: ${error.message}` });
    }
});

// ==========================================
// ROTA PUT: EDIÇÃO DE EVENTOS (CORRIGIDA)
// ==========================================
app.put('/api/v2/eventos/:id', verificarToken, async (req, res) => {
    const { id } = req.params;
    const { titulo, data_evento, carga_horaria, local_id, publico_alvo_id, hora_inicio, hora_fim, palestrante } = req.body;
    try {
        const limparHora = (h) => {
            if (!h) return '00:00';
            const partes = h.split(':');
            return `${partes[0].padStart(2, '0')}:${partes[1].padStart(2, '0')}`;
        };

        const h_ini_limpa = limparHora(hora_inicio);
        const h_fim_limpa = limparHora(hora_fim);

        // VALIDAÇÃO: Bloqueia conflitos ignorando o próprio ID que está sendo editado (Removido o campo 'ativo')
        const conflito = await pool.query(`
            SELECT id, titulo FROM eventos 
            WHERE local_id = $1::integer AND data_evento = $2::date AND id <> $3::integer
              AND (
                ($4::time < hora_fim AND $5::time > hora_inicio)
              )
        `, [parseInt(local_id), data_evento, parseInt(id), h_ini_limpa, h_fim_limpa]);

        if (conflito.rows.length > 0) {
            return res.status(400).json({ error: `Conflito de Horário! O evento "${conflito.rows[0].titulo}" já ocupa este espaço neste período.` });
        }

        const resLocal = await pool.query('SELECT nome, endereco, latitude, longitude FROM locais WHERE id = $1::integer', [parseInt(local_id)]);
        const dadosLocal = resLocal.rows[0] || {};

        const result = await pool.query(`
            UPDATE eventos 
            SET titulo=$1, data_evento=$2, carga_horaria=$3, local_id=$4, publico_alvo_id=$5, 
                hora_inicio=$6, hora_fim=$7, palestrante=$8, local=$9, endereco=$10, latitude=$11, longitude=$12
            WHERE id=$13::integer RETURNING *
        `, [
            titulo, 
            data_evento, 
            parseFloat(carga_horaria || 0), 
            parseInt(local_id), 
            parseInt(publico_alvo_id), 
            h_ini_limpa, 
            h_fim_limpa,
            palestrante || '', 
            dadosLocal.nome || '', 
            dadosLocal.endereco || '', 
            dadosLocal.latitude ? parseFloat(dadosLocal.latitude) : null, 
            dadosLocal.longitude ? parseFloat(dadosLocal.longitude) : null,
            parseInt(id)
        ]);
        return res.json(result.rows[0]);
    } catch (error) {
        console.error("Erro crítico ao atualizar evento no Banco de Dados:", error.message);
        return res.status(500).json({ error: `Erro ao atualizar o evento: ${error.message}` });
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
        const result = await pool.query(`
            SELECT f.*, p.nome_completo as participante_nome, p.matricula, e.titulo as evento_titulo 
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
            query = `SELECT p.nome_completo, p.matricula, e.titulo as evento_titulo, f.data_entrada, f.data_saida, f.permanencia FROM frequencias f JOIN participantes p ON f.participante_id = p.id JOIN eventos e ON f.evento_id = e.id WHERE e.data_evento BETWEEN $1 AND $2 ORDER BY p.nome_completo ASC`;
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

app.get('/api/v2/admin/eventos', async (req, res) => {
    try {
        // Traz o histórico de todas as formações (passadas e futuras) 
        // Ordenado do mais atual para o mais antigo (DESC)
        const result = await pool.query(`
            SELECT id, titulo, data_evento, hora_inicio, hora_fim, palestrante, local 
            FROM eventos 
            ORDER BY data_evento DESC, hora_inicio DESC
        `);
        return res.json(result.rows);
    } catch (error) {
        console.error("Erro crítico na rota exclusiva do Admin:", error.message);
        return res.status(500).json({ error: 'Erro interno ao carregar listagem global de eventos.' });
    }
});

// ==========================================
// ROTAS EXCLUSIVAS PARA O APP-ADMIN (EVITA CONFLITOS)
// ==========================================

// Deletar Ocorrência (Fraude)
app.delete('/api/v2/admin/log-fraudes/:id', verificarToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM log_fraudes WHERE id = $1', [req.params.id]);
        return res.json({ status: 'sucesso' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

// Atualizar Histórico (Frequência)
app.put('/api/v2/admin/frequencias/:id', verificarToken, async (req, res) => {
    const { data_entrada, data_saida } = req.body;
    try {
        await pool.query(`
            UPDATE frequencias 
            SET data_entrada = $1, data_saida = $2
            WHERE id = $3
        `, [data_entrada, data_saida || null, req.params.id]);
        return res.json({ status: 'sucesso' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

// Rota corrigida para a Pesquisa de Opinião trazer nomes dos Participantes
app.get('/api/v2/admin/pesquisa-satisfacao', verificarToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT ps.id, ps.avaliacao, ps.comentarios, ps.criado_em,
                   e.titulo as evento_titulo, p.nome_completo as participante_nome
            FROM pesquisa_satisfacao ps
            LEFT JOIN eventos e ON ps.evento_id = e.id
            LEFT JOIN participantes p ON ps.participante_id = p.id
            ORDER BY ps.criado_em DESC
        `);
        return res.json(result.rows);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

// NOVA ROTA: Exclusiva para a View do Admin (não interfere no app-professor)
app.get('/api/v2/admin/listar-participantes-view', verificarToken, async (req, res) => {
    try {
        const queryText = `
            SELECT 
                p.id, 
                p.nome_completo, 
                p.matricula, 
                p.device_key, 
                p.ativo,
                COUNT(f.id) AS total_presencas
            FROM participantes p
            LEFT JOIN frequencias f ON p.id = f.participante_id
            GROUP BY p.id, p.nome_completo, p.matricula, p.device_key, p.ativo
            ORDER BY p.id ASC;
        `;
        const { rows } = await pool.query(queryText);
        return res.json(rows);
    } catch (error) {
        console.error('Erro ao listar participantes:', error);
        return res.status(500).json({ error: error.message });
    }
});

// =====================================================================
// ROTA NOVA E EXCLUSIVA PARA O ADMIN - EXIBIÇÃO DA PESQUISA DE OPINIÃO
// =====================================================================
app.get('/api/v2/admin/pesquisa-satisfacao-detalhada', verificarToken, async (req, res) => {
    try {
        const queryText = `
            SELECT 
                ps.id,
                ps.avaliacao,
                ps.comentarios,
                ps.criado_em,
                p.nome_completo AS participante_nome,
                p.matricula AS participante_matricula,
                e.titulo AS evento_titulo
            FROM pesquisa_satisfacao ps
            LEFT JOIN participantes p ON ps.participante_id = p.id
            LEFT JOIN eventos e ON ps.evento_id = e.id
            ORDER BY ps.criado_em DESC;
        `;
        const { rows } = await pool.query(queryText);
        return res.json(rows);
    } catch (error) {
        console.error('Erro na nova rota de pesquisa detalhada:', error);
        return res.status(500).json({ error: error.message });
    }
});

app.get('/api/v2/admin/relatorio-integrado', verificarToken, async (req, res) => {
    const { data_inicio, data_fim } = req.query;
    
    if (!data_inicio || !data_fim) {
        return res.status(400).json({ error: 'Período inicial e final são obrigatórios.' });
    }

    try {
        // 1. Totais do Período
        const totalEventosQuery = await pool.query(
            "SELECT COUNT(id) as qtd, COALESCE(SUM(carga_horaria), 0) as horas FROM eventos WHERE data_evento BETWEEN $1 AND $2",
            [data_inicio, data_fim]
        );

        const totalParticipacoesQuery = await pool.query(
            "SELECT COUNT(id) as qtd FROM frequencias WHERE DATE(data_entrada) BETWEEN $1 AND $2",
            [data_inicio, data_fim]
        );

        const mediaSatisfacaoQuery = await pool.query(
            `SELECT 
                AVG(CASE 
                    WHEN avaliacao = 'Ótimo' THEN 5
                    WHEN avaliacao = 'Muito Bom' THEN 4
                    WHEN avaliacao = 'Bom' THEN 3
                    WHEN avaliacao = 'Regular' THEN 2
                    WHEN avaliacao = 'Ruim' THEN 1
                    ELSE 0 
                END) as media 
             FROM pesquisa_satisfacao 
             WHERE DATE(criado_em) BETWEEN $1 AND $2 AND avaliacao IS NOT NULL`,
            [data_inicio, data_fim]
        );

        // 2. Listagem Unificada / Detalhada do Relatório (Exemplo unindo frequências, eventos e participantes)
        const registrosQuery = await pool.query(
            `SELECT 
                f.id,
                f.matricula,
                p.nome_completo as participante_nome,
                e.titulo as evento_titulo,
                e.carga_horaria,
                f.data_entrada,
                f.data_saida,
                f.funcao
             FROM frequencias f
             LEFT JOIN participantes p ON f.participante_id = p.id
             LEFT JOIN eventos e ON f.evento_id = e.id
             WHERE DATE(f.data_entrada) BETWEEN $1 AND $2
             ORDER BY f.data_entrada DESC`,
            [data_inicio, data_fim]
        );

        return res.json({
            totais: {
                total_eventos: parseInt(totalEventosQuery.rows[0].qtd),
                soma_horas: parseFloat(totalEventosQuery.rows[0].horas).toFixed(2),
                total_participacoes: parseInt(totalParticipacoesQuery.rows[0].qtd),
                nota_media: parseFloat(mediaSatisfacaoQuery.rows[0].media || 0).toFixed(1)
            },
            registros: registrosQuery.rows
        });

    } catch (error) {
        console.error('Erro ao gerar relatório integrado:', error);
        return res.status(500).json({ error: error.message });
    }
});

app.use((req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));
app.use((err, req, res, next) => res.status(500).json({ error: 'Erro crítico interno.' }));

app.listen(PORT, () => {});