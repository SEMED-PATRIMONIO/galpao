const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('./db'); // Reutiliza sua conexão homologada e segura do ambiente anterior

const app = express();
const PORT = process.env.PORT || 3009;
const JWT_SECRET = process.env.JWT_SECRET || 'secret_token_queimados_educacao_2026';

app.use(cors());
app.use(express.json());

// Função auxiliar para criptografia de senhas administrativas
const hashSenha = (senha) => crypto.createHash('sha256').update(senha).digest('hex');

// Função auxiliar para calcular a distância exata em metros (Fórmula de Haversine)
function calcularDistancia(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 999999;
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
}

// Middleware de Proteção de Rotas do Administrador (JWT)
const verificarToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Acesso negado. Token de autenticação não fornecido.' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: 'Sessão expirada ou token inválido. Faça login novamente.' });
        }
        req.user = decoded;
        next();
    });
};

// =========================================================================
// 1. SISTEMA DE AUTENTICAÇÃO DO ADMINISTRADOR
// =========================================================================

app.post('/api/auth/login', async (req, res) => {
    const { usuario, senha } = req.body;
    if (!usuario || !senha) {
        return res.status(400).json({ error: 'Os campos usuário e senha são obrigatórios.' });
    }
    try {
        const result = await pool.query(
            'SELECT id, nome, usuario, senha, ativo, deve_alterar_senha FROM usuarios WHERE usuario = $1',
            [usuario]
        );
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciais de acesso incorretas.' });
        }
        const user = result.rows[0];
        if (!user.ativo) {
            return res.status(403).json({ error: 'Este usuário está inativo no sistema.' });
        }

        // Suporta tanto comparação simples quanto hash sha256 do antigo
        if (senha !== user.senha && hashSenha(senha) !== user.senha) {
            return res.status(401).json({ error: 'Credenciais de acesso incorretas.' });
        }

        const token = jwt.sign(
            { id: user.id, nome: user.nome, usuario: user.usuario },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        return res.json({
            token,
            user: { id: user.id, nome: user.nome, usuario: user.usuario, deve_alterar_senha: user.deve_alterar_senha }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro interno ao processar login.' });
    }
});

app.post('/api/auth/alterar-senha', async (req, res) => {
    const { usuario, novaSenha } = req.body;
    try {
        await pool.query(
            "UPDATE usuarios SET senha = $1, deve_alterar_senha = FALSE WHERE usuario = $2",
            [hashSenha(novaSenha), usuario]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =========================================================================
// 2. LÓGICA DO APLICATIVO DO PROFESSOR (ENDPOINTS ABERTOS E INTELIGENTES)
// =========================================================================

// Rota de Identificação e Verificação de Perímetro GPS / Antifraude
app.post('/api/verificar-localizacao', async (req, res) => {
    const { device_key, lat, lng, matricula, nome_completo } = req.body;

    try {
        let profId = null;
        let profMatricula = matricula;
        let profNome = "";

        // REGRA 1: Verificar se o dispositivo já está atribuído a algum participante
        const donoAparelho = await pool.query(
            "SELECT id, matricula, nome_completo FROM participantes WHERE device_key = $1 AND ativo = TRUE", 
            [device_key]
        );

        if (donoAparelho.rows.length > 0) {
            // ANTI-FRAUDE: Se o aparelho já está vinculado a alguém, ele NÃO PODE registrar presença para outra matrícula
            if (profMatricula && donoAparelho.rows[0].matricula !== profMatricula) {
                await pool.query(
                    "INSERT INTO log_fraudes (matricula, lat_tentativa, lng_tentativa, motivo, data_tentativa) VALUES ($1, $2, $3, 'DISPOSITIVO_VINCULADO_A_OUTRO_PROFESSOR', CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')",
                    [profMatricula, lat, lng]
                );
                return res.json({ success: false, message: "Este dispositivo está estritamente vinculado a outro professor. Uso compartilhado não permitido." });
            }
            profId = donoAparelho.rows[0].id;
            profMatricula = donoAparelho.rows[0].matricula;
            profNome = donoAparelho.rows[0].nome_completo;
        } else {
            // Dispositivo não atribuído a ninguém
            if (!profMatricula) {
                return res.json({ requer_matricula: true, message: "Primeiro acesso neste dispositivo. Por favor, insira sua matrícula." });
            }
            
            // Verifica se o participante já existe por matrícula para vincular o novo dispositivo
            const participanteExistente = await pool.query("SELECT id, nome_completo FROM participantes WHERE matricula = $1 AND ativo = TRUE", [profMatricula]);
            
            if (participanteExistente.rows.length > 0) {
                profId = participanteExistente.rows[0].id;
                profNome = participanteExistente.rows[0].nome_completo;
                // Vincula este novo dispositivo ao participante (Permite mais de um dispositivo para a mesma pessoa)
                await pool.query("UPDATE participantes SET device_key = $1 WHERE id = $2", [device_key, profId]);
            } else {
                // Se não existe e foi enviado o nome_completo, faz o Cadastro Rápido automático
                if (nome_completo) {
                    const novoProf = await pool.query(
                        "INSERT INTO participantes (nome_completo, matricula, device_key, ativo) VALUES ($1, $2, $3, TRUE) RETURNING id, nome_completo",
                        [nome_completo, profMatricula, device_key]
                    );
                    profId = novoProf.rows[0].id;
                    profNome = novoProf.rows[0].nome_completo;
                } else {
                    return res.json({ requer_cadastro: true, matricula_tentada: profMatricula, message: "Matrícula não encontrada. Preencha seu nome para o Cadastro Rápido." });
                }
            }
        }

        // REGRA 2: Bloqueio de Presença Simultânea em Eventos Diferentes
        const presencaAberta = await pool.query(
            "SELECT id FROM frequencias WHERE participante_id = $1 AND data_saida IS NULL",
            [profId]
        );

        // Se já houver presença aberta, o fluxo deve ser de SAÍDA para aquele respectivo evento
        if (presencaAberta.rows.length > 0) {
            return res.json({ success: true, status: 'requer_saida', frequencia_id: presencaAberta.rows[0].id, professor: profNome });
        }

        // REGRA 3: Validação de Geofencing (Raio de 50 metros) de Formações de Hoje
        const eventosHoje = await pool.query(`
            SELECT e.*, l.latitude, l.longitude, l.nome as local_nome 
            FROM eventos e
            JOIN locais l ON e.local_id = l.id
            WHERE e.data_evento = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date AND l.ativo = TRUE
        `);

        if (eventosHoje.rows.length === 0) {
            return res.json({ success: false, message: "Não há Formações agendadas para o dia de hoje." });
        }

        let eventosProximos = [];
        for (let ev of eventosHoje.rows) {
            const dist = calcularDistancia(parseFloat(lat), parseFloat(lng), parseFloat(ev.latitude), parseFloat(ev.longitude));
            if (dist <= 50) {
                eventosProximos.push(ev);
            }
        }

        // Se não estiver dentro do raio de nenhum evento próximo
        if (eventosProximos.length === 0) {
            await pool.query(
                "INSERT INTO log_fraudes (matricula, lat_tentativa, lng_tentativa, motivo, data_tentativa) VALUES ($1, $2, $3, 'FORA_DO_RAIO', CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')",
                [profMatricula, lat, lng]
            );
            return res.json({ success: false, message: "Você não foi detectado no perímetro de nenhuma formação ativa (Limite: 50m)." });
        }

        // Se houver MAIS DE UM evento ocorrendo no mesmo local/perímetro, deixa o professor escolher
        if (eventosProximos.length > 1) {
            return res.json({ success: true, requer_selecao: true, eventos: eventosProximos, professor: profNome });
        }

        // Se houver EXATAMENTE UM evento próximo, registra a ENTRADA automaticamente
        const eventoAlvo = eventosProximos[0];
        await pool.query(
            `INSERT INTO frequencias (participante_id, evento_id, data_entrada, lat_entrada, lng_entrada, device_key, matricula) 
             VALUES ($1, $2, CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo', $3, $4, $5, $6)`,
            [profId, eventoAlvo.id, lat, lng, device_key, profMatricula]
        );

        return res.json({ 
            success: true, 
            status: 'entrada_gravada', 
            duracao_aviso: 5, 
            message: `Entrada Homologada! Bem-vindo à formação: ${eventoAlvo.titulo}.`,
            professor: profNome, 
            evento: eventoAlvo.titulo 
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Endpoint complementar para quando o professor escolhe um evento da lista de múltiplos próximos
app.post('/api/registrar-escolha-entrada', async (req, res) => {
    const { device_key, evento_id, lat, lng } = req.body;
    try {
        const prof = await pool.query("SELECT id, matricula, nome_completo FROM participantes WHERE device_key = $1 AND ativo = TRUE", [device_key]);
        if (prof.rows.length === 0) return res.status(404).json({ error: "Participante não identificado." });

        const p = prof.rows[0];
        await pool.query(
            `INSERT INTO frequencias (participante_id, evento_id, data_entrada, lat_entrada, lng_entrada, device_key, matricula) 
             VALUES ($1, $2, CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo', $3, $4, $5, $6)`,
            [p.id, evento_id, lat, lng, device_key, p.matricula]
        );
        res.json({ success: true, message: "Entrada registrada no evento selecionado!" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Rota de Cadastro Rápido Manual via celular
app.post('/api/cadastrar-participante', async (req, res) => {
    const { nome_completo, matricula, device_key } = req.body;
    if (!nome_completo || !matricula || !device_key) {
        return res.status(400).json({ error: "Campos obrigatórios ausentes." });
    }
    try {
        await pool.query(
            "INSERT INTO participantes (nome_completo, matricula, device_key, ativo) VALUES ($1, $2, $3, TRUE) ON CONFLICT (matricula) DO UPDATE SET device_key = $3, nome_completo = $1",
            [nome_completo, matricula, device_key]
        );
        res.json({ success: true, message: "Cadastro realizado com sucesso!" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Processamento e Finalização de Saída (Com travas cronológicas estruturadas)
app.post('/api/finalizar-saida', async (req, res) => {
    const { frequencia_id, avaliacao, comentarios, lat, lng, confirmacao_prematura } = req.body;

    try {
        // Busca os dados da entrada e do evento correspondente
        const freqQuery = await pool.query(`
            SELECT f.*, e.hora_fim, e.data_evento, e.titulo, e.publico_alvo_id 
            FROM frequencias f 
            JOIN eventos e ON f.evento_id = e.id 
            WHERE f.id = $1`, [frequencia_id]);

        if (freqQuery.rows.length === 0) return res.status(404).json({ error: "Registro de frequência não localizado." });
        const frequencia = freqQuery.rows[0];

        const agora = new Date();
        const dataEntrada = new Date(frequencia.data_entrada);
        const minutosPassados = Math.floor((agora - dataEntrada) / 1000 / 60);

        // Monta o horário limite ideal (Término previsto do evento + 40 minutos)
        const [horaFimH, horaFimM] = frequencia.hora_fim.split(':');
        const dataTerminoEvento = new Date(frequencia.data_evento);
        dataTerminoEvento.setHours(parseInt(horaFimH), parseInt(horaFimM) + 40, 0, 0);

        // REGRA 4: Esqueceu de registrar a saída ou passou de 40 minutos do término do evento
        if (agora > dataTerminoEvento) {
            await pool.query(
                "INSERT INTO log_fraudes (matricula, evento_id, lat_tentativa, lng_tentativa, motivo, data_tentativa) VALUES ($1, $2, $3, $4, 'SAIDA_FORA_DO_PRAZO_EXCEDEU_40MIN', CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')",
                [frequencia.matricula, frequencia.evento_id, lat, lng]
            );
            return res.json({ 
                success: false, 
                bloqueado: true,
                message: "Prazo Limite Esgotado! Sua saída excedeu 40 minutos após o término da formação. O registro foi enviado para auditoria da Semed." 
            });
        }

        // REGRA 5: Permanência Menor que 30 Minutos (Trava Cronológica de Tempo Mínimo)
        if (minutosPassados < 30) {
            if (!confirmacao_prematura) {
                return res.json({ 
                    requer_confirmacao_prematura: true, 
                    message: "Alerta: Sua permanência foi menor que 30 minutos. Esse tempo não contabilizará horas de formação. Deseja sair mesmo assim?" 
                });
            }
            // Se ele confirmou a saída precoce mesmo assim: computa 0, não salva pesquisa e gera alerta em fraudes
            await pool.query(
                `UPDATE frequencias 
                 SET data_saida = CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo', lat_saida = $1, lng_saida = $2
                 WHERE id = $3`, [lat, lng, frequencia_id]
            );
            await pool.query(
                "INSERT INTO log_fraudes (matricula, evento_id, lat_tentativa, lng_tentativa, motivo, data_tentativa) VALUES ($1, $2, $3, $4, 'PERMANENCIA_INSUFICIENTE_MENOR_30MIN', CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')",
                [frequencia.matricula, frequencia.evento_id, lat, lng]
            );
            return res.json({ success: true, message: "Saída homologada com carga horária zerada (Permanência insuficiente)." });
        }

        // REGRA 6: Saída dentro do prazo ideal (Requer Pesquisa de Satisfação)
        if (!avaliacao) {
            return res.json({ requer_pesquisa_satisfacao: true, message: "Por favor, responda a pesquisa de satisfação para validar suas horas." });
        }

        // Salva na tabela dedicada de pesquisas de satisfação
        await pool.query(
            `INSERT INTO pesquisa_satisfacao (participante_id, evento_id, publico_alvo_id, avaliacao, comentarios) 
             VALUES ($1, $2, $3, $4, $5)`,
            [frequencia.participante_id, frequencia.evento_id, frequencia.publico_alvo_id, avaliacao, comentarios || ""]
        );

        // Atualiza a frequência com o feedback também incorporado
        await pool.query(
            `UPDATE frequencias 
             SET data_saida = CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo', lat_saida = $1, lng_saida = $2, avaliacao = $3 
             WHERE id = $4`, [lat, lng, avaliacao, frequencia_id]
        );

        return res.json({ success: true, message: "Sua saída e avaliação foram consolidadas! Carga horária creditada com sucesso." });

    } catch (err) { res.status(500).json({ error: err.message }); }
});

// =========================================================================
// 3. ROTAS INTEGRADAS DO PAINEL ADMINISTRATIVO (APP-ADMIN V2)
// =========================================================================

// Opção 'Formações' -> CRUD eventos
app.get('/api/v2/eventos', verificarToken, async (req, res) => {
    try {
        const query = `SELECT e.*, l.nome as local_nome, p.nome as publico_alvo_nome FROM eventos e LEFT JOIN locais l ON e.local_id = l.id LEFT JOIN publicoalvo p ON e.publico_alvo_id = p.id ORDER BY e.data_evento DESC`;
        const r = await pool.query(query); res.json(r.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/v2/eventos', verificarToken, async (req, res) => {
    const { titulo, data_evento, carga_horaria, palestrante, token_qr, local_id, hora_inicio, hora_fim, publico_alvo_id } = req.body;
    try {
        const insertQuery = `INSERT INTO eventos (titulo, data_evento, carga_horaria, palestrante, token_qr, local_id, hora_inicio, hora_fim, publico_alvo_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`;
        const r = await pool.query(insertQuery, [titulo, data_evento, carga_horaria, palestrante, token_qr, local_id, hora_inicio, hora_fim, publico_alvo_id]);
        res.status(201).json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});
app.put('/api/v2/eventos/:id', verificarToken, async (req, res) => {
    const { titulo, data_evento, carga_horaria, palestrante, token_qr, local_id, hora_inicio, hora_fim, publico_alvo_id } = req.body;
    try {
        const r = await pool.query(`UPDATE eventos SET titulo=$1, data_evento=$2, carga_horaria=$3, palestrante=$4, token_qr=$5, local_id=$6, hora_inicio=$7, hora_fim=$8, publico_alvo_id=$9 WHERE id=$10 RETURNING *`, [titulo, data_evento, carga_horaria, palestrante, token_qr, local_id, hora_inicio, hora_fim, publico_alvo_id, req.params.id]);
        res.json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/v2/eventos/:id', verificarToken, async (req, res) => {
    try { await pool.query('DELETE FROM eventos WHERE id = $1', [req.params.id]); res.json({ success: true }); } 
    catch (err) { res.status(500).json({ error: err.message }); }
});

// Opção 'Locais' -> CRUD locais
app.get('/api/v2/locais', verificarToken, async (req, res) => {
    try { const r = await pool.query('SELECT * FROM locais ORDER BY nome ASC'); res.json(r.rows); } 
    catch (err) { res.status(500).json({ error: err.message }); }
});
app.get('/api/v2/locais/ativos', verificarToken, async (req, res) => {
    try { const r = await pool.query('SELECT id, nome FROM locais WHERE ativo = true ORDER BY nome ASC'); res.json(r.rows); } 
    catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/v2/locais', verificarToken, async (req, res) => {
    const { nome, endereco, latitude, longitude } = req.body;
    try { const r = await pool.query('INSERT INTO locais (nome, endereco, latitude, longitude, ativo) VALUES ($1, $2, $3, $4, true) RETURNING *', [nome, endereco, latitude, longitude]); res.status(201).json(r.rows[0]); } 
    catch (err) { res.status(500).json({ error: err.message }); }
});
app.put('/api/v2/locais/:id', verificarToken, async (req, res) => {
    const { nome, endereco, latitude, longitude } = req.body;
    try { const r = await pool.query('UPDATE locais SET nome=$1, endereco=$2, latitude=$3, longitude=$4 WHERE id=$5 RETURNING *', [nome, endereco, latitude, longitude, req.params.id]); res.json(r.rows[0]); } 
    catch (err) { res.status(500).json({ error: err.message }); }
});
app.patch('/api/v2/locais/:id/inativar', verificarToken, async (req, res) => {
    try { await pool.query('UPDATE locais SET ativo = false WHERE id = $1', [req.params.id]); res.json({ success: true }); } 
    catch (err) { res.status(500).json({ error: err.message }); }
});
app.patch('/api/v2/locais/:id/restaurar', verificarToken, async (req, res) => {
    try { await pool.query('UPDATE locais SET ativo = true WHERE id = $1', [req.params.id]); res.json({ success: true }); } 
    catch (err) { res.status(500).json({ error: err.message }); }
});

// Opção 'Participantes' -> CRUD participantes
app.get('/api/v2/participantes', verificarToken, async (req, res) => {
    try { const r = await pool.query('SELECT * FROM participantes ORDER BY nome_completo ASC'); res.json(r.rows); } 
    catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/v2/participantes', verificarToken, async (req, res) => {
    const { nome_completo, matricula, ativo } = req.body;
    try { await pool.query('INSERT INTO participantes (nome_completo, matricula, ativo) VALUES ($1, $2, $3) ON CONFLICT (matricula) DO UPDATE SET nome_completo=$1, ativo=$3', [nome_completo, matricula, ativo]); res.json({ success: true }); } 
    catch (err) { res.status(500).json({ error: err.message }); }
});
app.put('/api/v2/participantes/:id', verificarToken, async (req, res) => {
    const { nome_completo, matricula, ativo, device_key } = req.body;
    try { await pool.query('UPDATE participantes SET nome_completo=$1, matricula=$2, ativo=$3, device_key=$4 WHERE id=$5', [nome_completo, matricula, ativo, device_key, req.params.id]); res.json({ success: true }); } 
    catch (err) { res.status(500).json({ error: err.message }); }
});

// Opção 'Histórico' -> Tabela frequencias
app.get('/api/v2/historico-frequencia', verificarToken, async (req, res) => {
    try {
        const query = `SELECT f.*, p.nome_completo, e.titulo as evento_titulo, l.nome as local_nome FROM frequencias f JOIN participantes p ON f.participante_id = p.id JOIN eventos e ON f.evento_id = e.id LEFT JOIN locais l ON e.local_id = l.id ORDER BY f.data_entrada DESC`;
        const r = await pool.query(query); res.json(r.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Opção 'Ocorrências' -> Tabela log_fraudes
app.get('/api/v2/ocorrencias-fraudes', verificarToken, async (req, res) => {
    try {
        const query = `SELECT lf.*, e.titulo as evento_titulo FROM log_fraudes lf LEFT JOIN eventos e ON lf.evento_id = e.id ORDER BY lf.data_tentativa DESC`;
        const r = await pool.query(query); res.json(r.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Opção 'Pesquisa de Opinião' -> Tabela pesquisa_satisfacao
app.get('/api/v2/pesquisas-opiniao', verificarToken, async (req, res) => {
    try {
        const query = `SELECT ps.*, p.nome_completo, e.titulo as evento_titulo, pa.nome as publico_alvo_nome FROM pesquisa_satisfacao ps JOIN participantes p ON ps.participante_id = p.id JOIN eventos e ON ps.evento_id = e.id LEFT JOIN publicoalvo pa ON ps.publico_alvo_id = pa.id ORDER BY ps.id DESC`;
        const r = await pool.query(query); res.json(r.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Opção 'Público-Alvo' -> CRUD publicoalvo
app.get('/api/v2/publico-alvo', verificarToken, async (req, res) => {
    try { const r = await pool.query('SELECT * FROM publicoalvo ORDER BY nome ASC'); res.json(r.rows); } 
    catch (err) { res.status(500).json({ error: err.message }); }
});
app.get('/api/v2/publico-alvo/ativos', verificarToken, async (req, res) => {
    try { const r = await pool.query('SELECT id, nome FROM publicoalvo WHERE ativo = true ORDER BY nome ASC'); res.json(r.rows); } 
    catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/v2/publico-alvo', verificarToken, async (req, res) => {
    try { const r = await pool.query('INSERT INTO publicoalvo (nome, ativo) VALUES ($1, true) RETURNING *', [req.body.nome]); res.status(201).json(r.rows[0]); } 
    catch (err) { res.status(500).json({ error: err.message }); }
});
app.put('/api/v2/publico-alvo/:id', verificarToken, async (req, res) => {
    try { const r = await pool.query('UPDATE publicoalvo SET nome = $1 WHERE id = $2 RETURNING *', [req.body.nome, req.params.id]); res.json(r.rows[0]); } 
    catch (err) { res.status(500).json({ error: err.message }); }
});

// Opção 'Usuários' -> Esconde a senha por segurança e restringe edição ao próprio perfil logado
app.get('/api/v2/usuarios', verificarToken, async (req, res) => {
    try { const r = await pool.query('SELECT id, nome, email, usuario, ativo, deve_alterar_senha FROM usuarios ORDER BY id ASC'); res.json(r.rows); } 
    catch (err) { res.status(500).json({ error: err.message }); }
});
app.put('/api/v2/usuarios/:id', verificarToken, async (req, res) => {
    // PROTEÇÃO: O usuário só pode editar a senha se o ID editado for o ID dele próprio que está logado
    if (req.user.id !== parseInt(req.params.id)) {
        return res.status(403).json({ error: "Permissão negada. Você só pode alterar a sua própria senha secreta." });
    }
    const { senha } = req.body;
    try {
        await pool.query('UPDATE usuarios SET senha = $1 WHERE id = $2', [hashSenha(senha), req.params.id]);
        res.json({ success: true, message: "Sua senha pessoal foi modificada com sucesso." });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// =========================================================================
// 4. MOTOR AVANÇADO DE RELATÓRIOS DO ADMIN (COM FILTRO OBRIGATÓRIO DE PERÍODO)
// =========================================================================

// Relatório 1: Formações
app.get('/api/v2/relatorios/formacoes', verificarToken, async (req, res) => {
    const { data_inicio, data_fim } = req.query;
    if (!data_inicio || !data_fim) return res.status(400).json({ error: "Filtro de período obrigatório." });
    try {
        const query = `
            SELECT e.id, e.titulo, e.data_evento, e.carga_horaria, e.palestrante, l.nome as local_nome, COUNT(f.id) as total_presentes
            FROM eventos e
            LEFT JOIN locais l ON e.local_id = l.id
            LEFT JOIN frequencias f ON e.id = f.evento_id
            WHERE e.data_evento BETWEEN $1 AND $2
            GROUP BY e.id, l.nome ORDER BY e.data_evento DESC`;
        const r = await pool.query(query, [data_inicio, data_fim]); res.json(r.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Relatório 2: Por Participante
app.get('/api/v2/relatorios/por-participante', verificarToken, async (req, res) => {
    const { data_inicio, data_fim } = req.query;
    if (!data_inicio || !data_fim) return res.status(400).json({ error: "Filtro de período obrigatório." });
    try {
        const query = `
            SELECT p.nome_completo, p.matricula, COUNT(f.id) as total_participacoes,
                   COALESCE(SUM(EXTRACT(EPOCH FROM (f.data_saida - f.data_entrada))/3600), 0) as total_horas_validadas
            FROM participantes p
            JOIN frequencias f ON f.participante_id = p.id
            JOIN eventos e ON f.evento_id = e.id
            WHERE e.data_evento BETWEEN $1 AND $2 AND f.data_saida IS NOT NULL
            GROUP BY p.id, p.nome_completo, p.matricula ORDER BY p.nome_completo ASC`;
        const r = await pool.query(query, [data_inicio, data_fim]); res.json(r.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Relatório 3: Por Público-Alvo
app.get('/api/v2/relatorios/por-publico-alvo', verificarToken, async (req, res) => {
    const { data_inicio, data_fim } = req.query;
    if (!data_inicio || !data_fim) return res.status(400).json({ error: "Filtro de período obrigatório." });
    try {
        const query = `
            SELECT pa.nome as publico_alvo_nome, COUNT(distinct e.id) as total_eventos_ofertados, COUNT(f.id) as total_atendimentos
            FROM publicoalvo pa
            JOIN eventos e ON e.publico_alvo_id = pa.id
            LEFT JOIN frequencias f ON f.evento_id = e.id
            WHERE e.data_evento BETWEEN $1 AND $2
            GROUP BY pa.id, pa.nome ORDER BY total_atendimentos DESC`;
        const r = await pool.query(query, [data_inicio, data_fim]); res.json(r.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Relatório 4: Painel Estatístico Geral consolidado
app.get('/api/v2/relatorios/estatisticas', verificarToken, async (req, res) => {
    const { data_inicio, data_fim } = req.query;
    if (!data_inicio || !data_fim) return res.status(400).json({ error: "Filtro de período obrigatório." });
    try {
        const presencas = await pool.query("SELECT COUNT(f.id) as total FROM frequencias f JOIN eventos e ON f.evento_id = e.id WHERE e.data_evento BETWEEN $1 AND $2", [data_inicio, data_fim]);
        const ocorrencias = await pool.query("SELECT COUNT(lf.id) as total FROM log_fraudes lf WHERE lf.data_tentativa BETWEEN $1 AND $2", [data_inicio, data_fim]);
        const pesquisas = await pool.query(`
            SELECT COALESCE(AVG(ps.avaliacao), 0)::numeric(10,2) as media_satisfacao, COUNT(ps.id) as total_respostas
            FROM pesquisa_satisfacao ps 
            JOIN eventos e ON ps.evento_id = e.id 
            WHERE e.data_evento BETWEEN $1 AND $2`, [data_inicio, data_fim]);

        res.json({
            periodo: { inicio: data_inicio, fim: data_fim },
            total_participacoes: parseInt(presencas.rows[0].total),
            total_ocorrencias_fraudes: parseInt(ocorrencias.rows[0].total),
            total_pesquisas_respondidas: parseInt(pesquisas.rows[0].total_respostas),
            media_satisfacao_docente: parseFloat(pesquisas.rows[0].media_satisfacao)
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// =================================================================
// CAMADA DE COMPATIBILIDADE: ROTAS ESPELHADAS PARA O FRONT-END ATUAL
// =================================================================

// 1. Espelhamento da rota de listagem de eventos (/api/admin/eventos)
app.get('/api/admin/eventos', verificarToken, async (req, res) => {
    try {
        const query = `
            SELECT e.*, l.nome as local_nome, p.nome as publico_alvo_nome 
            FROM eventos e
            LEFT JOIN locais l ON e.local_id = l.id
            LEFT JOIN publicoalvo p ON e.publico_alvo_id = p.id
            ORDER BY e.data_evento DESC, e.hora_inicio DESC
        `;
        const result = await pool.query(query);
        // Retorna o array puro que o .map() do Front-end está esperando
        return res.json(result.rows); 
    } catch (error) {
        console.error('Erro na rota de compatibilidade /api/admin/eventos:', error);
        return res.status(500).json({ error: 'Erro interno ao recuperar eventos para o painel administrativo.' });
    }
});

// 2. Espelhamento da rota de relatório geral (/api/admin/relatorio-geral)
app.get('/api/admin/relatorio-geral', verificarToken, async (req, res) => {
    try {
        // Buscando uma estrutura analítica em formato de lista (Array) exigida pelo front
        const query = `
            SELECT e.id, e.titulo, e.data_evento, e.carga_horaria, e.palestrante,
                   l.nome as local_nome,
                   COUNT(f.id) as total_participantes
            FROM eventos e
            LEFT JOIN locais l ON e.local_id = l.id
            LEFT JOIN frequencias f ON e.id = f.evento_id
            GROUP BY e.id, l.nome
            ORDER BY e.data_evento DESC
        `;
        const result = await pool.query(query);
        return res.json(result.rows);
    } catch (error) {
        console.error('Erro na rota de compatibilidade /api/admin/relatorio-geral:', error);
        return res.status(500).json({ error: 'Erro interno ao gerar matriz do relatório geral.' });
    }
});

// =================================================================
// CAMADA DE COMPATIBILIDADE PARA O FRONT-END ANTERIOR (RESOLVE 404)
// =================================================================

// 1. Rota de compatibilidade para Professores/Participantes
app.get('/api/admin/professores', async (req, res) => {
    try {
        // Busca os participantes para abastecer a listagem do painel
        const result = await pool.query("SELECT * FROM participantes ORDER BY id ASC");
        return res.json(result.rows);
    } catch (error) {
        console.error('Erro na rota antiga /api/admin/professores:', error);
        return res.status(500).json({ error: 'Erro interno ao recuperar professores.' });
    }
});

// 2. Rota de compatibilidade para Eventos
app.get('/api/admin/eventos', async (req, res) => {
    try {
        // Retorna os eventos com o nome do local correspondente, evitando quebras
        const query = `
            SELECT e.*, l.nome as local_nome 
            FROM eventos e
            LEFT JOIN locais l ON e.local_id = l.id
            ORDER BY e.data_evento DESC, e.hora_inicio DESC
        `;
        const result = await pool.query(query);
        return res.json(result.rows);
    } catch (error) {
        console.error('Erro na rota antiga /api/admin/eventos:', error);
        return res.status(500).json({ error: 'Erro interno ao recuperar eventos.' });
    }
});

// 3. Rota de compatibilidade para o Relatório Geral
app.get('/api/admin/relatorio-geral', async (req, res) => {
    try {
        // Agrupa os dados volumétricos que o dashboard antigo renderiza na tabela
        const query = `
            SELECT e.id, e.titulo, e.data_evento, e.carga_horaria, e.palestrante,
                   l.nome as local_nome,
                   COUNT(f.id) as total_participantes
            FROM eventos e
            LEFT JOIN locais l ON e.local_id = l.id
            LEFT JOIN frequencias f ON e.id = f.evento_id
            GROUP BY e.id, l.nome
            ORDER BY e.data_evento DESC
        `;
        const result = await pool.query(query);
        return res.json(result.rows);
    } catch (error) {
        console.error('Erro na rota antiga /api/admin/relatorio-geral:', error);
        return res.status(500).json({ error: 'Erro interno ao gerar relatório geral.' });
    }
});

// Tratamento de Rotas não localizadas
app.use((req, res) => res.status(404).json({ error: 'Endpoint não localizado no servidor Formar v4.' }));

app.listen(PORT, () => {
    console.log(`Servidor Formar v4 Ativo e Estabilizado na Porta ${PORT}`);
});