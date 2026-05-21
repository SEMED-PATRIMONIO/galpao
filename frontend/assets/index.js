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

// ====================================================
// FLUXO DE PRESENÇA REESTRUTURADO (NOVA ESTRATÉGIA V2)
// ====================================================

// 1. Inicialização: Verifica eventos no dia e horários permitidos (Sem exigir GPS imediato)
app.post('/api/v2/presenca/inicializar', async (req, res) => {
    const { device_token } = req.body;
    try {
        if (!device_token) return res.status(400).json({ error: 'Identificação do dispositivo ausente.' });

        const resDisp = await pool.query('SELECT * FROM dispositivos WHERE device_token = $1 AND ativo = true', [device_token]);
        if (resDisp.rows.length === 0) return res.status(401).json({ error: 'Aparelho não associado.' });
        const disp = resDisp.rows[0];

        const { dataStr, minutosAbsolutos } = obterAgoraBrasilia();

        // AJUSTADO: Utilizando as colunas reais 'local', 'hora_inicio' e 'hora_fim'
        const resEventos = await pool.query(`
            SELECT id, titulo, local, endereco, latitude, longitude,
                   hora_inicio::text as h_ini, hora_fim::text as h_fim 
            FROM eventos 
            WHERE data_evento = $1
        `, [dataStr]);

        if (resEventos.rows.length === 0) {
            return res.json({ status: 'sem_eventos', mensagem: 'NÃO HÁ FORMAÇÃO AGENDADA PARA HOJE' });
        }

        // Janela de entrada permitida: 20 minutos antes do início até 30 minutos antes do fim
        const elegiveisHorario = resEventos.rows.filter(ev => {
            const minInicio = paraMinutos(ev.h_ini);
            const minFim = paraMinutos(ev.h_fim);
            return minutosAbsolutos >= (minInicio - 20) && minutosAbsolutos <= (minFim - 30);
        });

        if (elegiveisHorario.length === 0) {
            // AJUSTADO: Removida a coluna fictícia 'distancia_calculada' para respeitar seu esquema
            await pool.query(`
                INSERT INTO log_fraudes (matricula, evento_id, motivo)
                VALUES ($1, $2, 'FORA_DA_FAIXA_DE_HORARIO_PERMITIDA')
            `, [disp.participante_matricula, resEventos.rows[0].id]);

            return res.json({ status: 'fora_horario', mensagem: 'FORA DA FAIXA DE HORÁRIO PERMITIDA' });
        }

        return res.json({
            status: 'sucesso',
            eventos: elegiveisHorario.map(e => ({
                id: e.id,
                titulo: e.titulo,
                local: e.local || 'Auditório',
                endereco: e.endereco || '',
                latitude: e.latitude,
                longitude: e.longitude
            }))
        });
    } catch (error) {
        console.error("Erro crítico em /presenca/inicializar:", error.message);
        return res.status(500).json({ error: 'Erro interno ao inicializar verificação.' });
    }
});

// 2. Checagem de Status: Valida o raio de 60 metros e busca histórico de frequências do dia
app.post('/api/v2/presenca/checar-status', async (req, res) => {
    const { device_token, evento_id, latitude, longitude } = req.body;
    try {
        const resDisp = await pool.query('SELECT * FROM dispositivos WHERE device_token = $1 AND ativo = true', [device_token]);
        if (resDisp.rows.length === 0) return res.status(401).json({ error: 'Aparelho desvinculado.' });
        const disp = resDisp.rows[0];

        const resEv = await pool.query('SELECT * FROM eventos WHERE id = $1', [evento_id]);
        if (resEv.rows.length === 0) return res.status(404).json({ error: 'Formação não localizada.' });
        const ev = resEv.rows[0];

        const dist = calcularDistancia(latitude, longitude, parseFloat(ev.latitude), parseFloat(ev.longitude));
        if (dist > 60) {
            // AJUSTADO: Usando lat_tentativa, lng_tentativa e removendo distancia_calculada
            await pool.query(`
                INSERT INTO log_fraudes (matricula, evento_id, motivo, lat_tentativa, lng_tentativa)
                VALUES ($1, $2, 'FORA_DO_RAIO_PERMITIDO', $3, $4)
            `, [disp.participante_matricula, evento_id, latitude, longitude]);

            return res.status(400).json({ error: 'Não existe evento elegível neste local nesta faixa de horário.' });
        }

        const { dataStr } = obterAgoraBrasilia();

        const resFreq = await pool.query(`
            SELECT *, EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - data_entrada))/60 as minutos_decorridos
            FROM frequencias
            WHERE participante_id = $1 AND evento_id = $2 AND data_entrada::date = $3::date
        `, [disp.participante_id, evento_id, dataStr]);

        if (resFreq.rows.length > 0) {
            const freq = resFreq.rows[0];
            if (freq.data_saida !== null) {
                return res.json({ status: 'completo', titulo: ev.titulo, local: ev.local });
            } else {
                return res.json({ 
                    status: 'somente_entrada', 
                    titulo: ev.titulo, 
                    minutos: Math.floor(freq.minutos_decorridos || 0)
                });
            }
        }

        return res.json({ status: 'nenhum', titulo: ev.titulo });
    } catch (error) {
        console.error("Erro crítico em /presenca/checar-status:", error.message);
        return res.status(500).json({ error: 'Erro ao checar status de presença.' });
    }
});

// 3. Confirmar Entrada Limpa
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
        console.error("Erro crítico em /presenca/confirmar-entrada:", error.message);
        return res.status(500).json({ error: 'Erro ao registrar entrada.' });
    }
});

// 4. Confirmar Saída + Pesquisa de Satisfação (Mapeada para os campos reais do banco)
app.post('/api/v2/presenca/confirmar-saida', async (req, res) => {
    const { device_token, evento_id, estrelas, comentario } = req.body;
    try {
        const resDisp = await pool.query('SELECT * FROM dispositivos WHERE device_token = $1 AND ativo = true', [device_token]);
        const disp = resDisp.rows[0];
        const { dataStr } = obterAgoraBrasilia();

        const resEv = await pool.query('SELECT * FROM eventos WHERE id = $1', [evento_id]);
        const publicoAlvoId = resEv.rows.length > 0 ? resEv.rows[0].publico_alvo_id : null;

        // Converte as estrelas numéricas no formato de texto exigido pelo CHECK constraint da sua tabela
        let avaliacaoTexto = 'Ótimo';
        if (estrelas == 1) avaliacaoTexto = 'Ruim';
        else if (estrelas == 2) avaliacaoTexto = 'Regular';
        else if (estrelas == 3) avaliacaoTexto = 'Bom';
        else if (estrelas == 4) avaliacaoTexto = 'Muito Bom';

        // Salva a pesquisa de satisfação usando as colunas reais: avaliacao e comentarios
        await pool.query(`
            INSERT INTO pesquisa_satisfacao (participante_id, evento_id, publico_alvo_id, avaliacao, comentarios, criado_em)
            VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        `, [disp.participante_id, evento_id, publicoAlvoId, avaliacaoTexto, comentario || '']);

        // Atualiza a saída e calcula a permanência nativamente
        await pool.query(`
            UPDATE frequencias 
            SET data_saida = CURRENT_TIMESTAMP,
                permanencia = to_char(CURRENT_TIMESTAMP - data_entrada, 'HH24:MI:SS')
            WHERE participante_id = $1 AND evento_id = $2 AND data_saida IS NULL AND data_entrada::date = $3::date
        `, [disp.participante_id, evento_id, dataStr]);

        return res.json({ status: 'sucesso', mensagem: 'REGISTRO EFETUADO!' });
    } catch (error) {
        console.error("Erro crítico em /presenca/confirmar-saida:", error.message);
        return res.status(500).json({ error: 'Erro ao registrar saída.' });
    }
});

// ==========================================
// OUTRAS ROTAS DO SISTEMA (DASHBOARD / RELATÓRIOS)
// ==========================================
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

app.use((req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));
app.use((err, req, res, next) => res.status(500).json({ error: 'Erro crítico interno.' }));

app.listen(PORT, () => {});