const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const pool = require('./db'); // Vinculado corretamente ao seu db.js

const app = express();
const PORT = process.env.PORT || 3009;
const JWT_SECRET = process.env.JWT_SECRET || 'secret_token_queimados_educacao_2026';

// Função de criptografia idêntica à versão anterior
const hashSenha = (senha) => crypto.createHash('sha256').update(senha).digest('hex');

app.use(cors());
app.use(express.json());

// Middleware para proteger as rotas administrativas da v2 usando JWT
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

// ========================================================
// --- 1. ROTAS DE AUTENTICAÇÃO E LOGIN (RETROCOMPATÍVEL) ---
// ========================================================

app.post('/api/auth/login', async (req, res) => {
    const { usuario, senha } = req.body;

    if (!usuario || !senha) {
        return res.status(400).json({ error: 'Os campos usuário e senha são estritamente obrigatórios.' });
    }

    try {
        const queryText = 'SELECT id, nome, usuario, senha, ativo, deve_alterar_senha FROM usuarios WHERE usuario = $1';
        const result = await pool.query(queryText, [usuario]);

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciais de acesso incorretas.' });
        }

        const user = result.rows[0];

        if (!user.ativo) {
            return res.status(403).json({ error: 'Este usuário está inativo no sistema administrativo.' });
        }

        // Correção de segurança: Valida tanto o hash SHA-256 quanto texto limpo (garante o login em qualquer cenário)
        const senhaHash = hashSenha(senha);
        if (user.senha !== senha && user.senha !== senhaHash) {
            return res.status(401).json({ error: 'Credenciais de acesso incorretas.' });
        }

        // Gera o token JWT demandado pela nova arquitetura do painel
        const token = jwt.sign(
            { id: user.id, nome: user.nome, usuario: user.usuario },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        // Resposta híbrida: entrega a estrutura antiga esperada pelo front e o novo token JWT simultaneamente
        return res.json({
            success: true,
            token,
            usuario: user.usuario,
            nome: user.nome,
            deve_alterar_senha: user.deve_alterar_senha,
            user: {
                id: user.id,
                nome: user.nome,
                usuario: user.usuario,
                deve_alterar_senha: user.deve_alterar_senha
            }
        });

    } catch (error) {
        console.error('Erro na rota de autenticação de login:', error);
        return res.status(500).json({ error: 'Ocorreu um erro interno no servidor ao processar o login.' });
    }
});

app.post('/api/auth/alterar-senha', async (req, res) => {
    const { usuario, novaSenha } = req.body;
    try {
        await pool.query(
            "UPDATE usuarios SET senha = $1, deve_alterar_senha = FALSE WHERE usuario = $2",
            [novaSenha, usuario]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========================================================
// --- 2. FUNÇÕES AUXILIARES DE CÁLCULO GEOGRÁFICO -------
// ========================================================

function calcularDistancia(lat1, lon1, lat2, lon2) {
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

function getDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371e3; 
    const p1 = lat1 * Math.PI/180;
    const p2 = lat2 * Math.PI/180;
    const dp = (lat2-lat1) * Math.PI/180;
    const dl = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(dp/2) * Math.sin(dp/2) +
            Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2) * Math.sin(dl/2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

// ========================================================
// --- 3. CONTROLE DE COORDENAÇÃO DE ENTRADA/SAÍDA VIA QR -
// ========================================================

app.post('/api/registrar-check', async (req, res) => {
    const { matricula, token_qr, lat, lng, device_key } = req.body;

    try {
        const ev = await pool.query("SELECT * FROM eventos WHERE token_qr = $1", [token_qr]);
        if (ev.rows.length === 0) return res.status(404).json({ error: "QR Code Inválido." });
        const evento = ev.rows[0];

        const distancia = getDistancia(lat, lng, evento.latitude, evento.longitude);
        if (distancia > 60) {
            await pool.query(
                "INSERT INTO log_fraudes (matricula, evento_id, lat_tentativa, lng_tentativa, distancia_calculada, motivo) VALUES ($1, $2, $3, $4, $5, $6)",
                [matricula, evento.id, lat, lng, distancia, 'FORA_DO_RAIO']
            );
            return res.status(403).json({ error: `Fraude Detectada: Você está a ${distancia.toFixed(0)}m do local. O limite é 60m.` });
        }

        const trava = await pool.query(
            "SELECT id FROM frequencias WHERE device_key = $1 AND (data_entrada > NOW() - INTERVAL '30 minutes' OR data_saida > NOW() - INTERVAL '30 minutes') LIMIT 1",
            [device_key]
        );
        if (trava.rows.length > 0) {
            await pool.query(
                "INSERT INTO log_fraudes (matricula, evento_id, lat_tentativa, lng_tentativa, motivo) VALUES ($1, $2, $3, $4, $5)",
                [matricula, evento.id, lat, lng, 'DISPOSITIVO_BLOQUEADO_30MIN']
            );
            return res.status(403).json({ error: "Bloqueio de segurança: Este aparelho já registrou uma presença nos últimos 30 minutos." });
        }

        const checkOpen = await pool.query(
            "SELECT id FROM frequencias WHERE matricula = $1 AND evento_id = $2 AND data_saida IS NULL",
            [matricula, evento.id]
        );

        if (checkOpen.rows.length > 0) {
            await pool.query("UPDATE frequencias SET data_saida = NOW() WHERE id = $1", [checkOpen.rows[0].id]);
            res.json({ message: "SAÍDA REGISTRADA" });
        } else {
            await pool.query(
                "INSERT INTO frequencias (matricula, evento_id, data_entrada, device_key) VALUES ($1, $2, NOW(), $3)",
                [matricula, evento.id, device_key]
            );
            res.json({ message: "ENTRADA REGISTRADA" });
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/verificar-localizacao', async (req, res) => {
    const { matricula, lat, lng, device_key } = req.body;

    try {
        let profId = null;
        let profMatricula = matricula;
        let profNome = "";

        if (device_key) {
            const donoAparelho = await pool.query("SELECT id, matricula, nome_completo FROM participantes WHERE device_key = $1 AND ativo = TRUE", [device_key]);
            if (donoAparelho.rows.length > 0) {
                if (profMatricula && donoAparelho.rows[0].matricula !== profMatricula) {
                    await pool.query("INSERT INTO log_fraudes (matricula, lat_tentativa, lng_tentativa, motivo) VALUES ($1, $2, $3, 'DISPOSITIVO_VINCULADO_A_OUTRO_PROFESSOR')", [profMatricula, lat, lng]);
                    return res.json({ success: false, message: "Este dispositivo já está vinculado a outro professor. O uso compartilhado não é permitido." });
                }
                profId = donoAparelho.rows[0].id;
                profMatricula = donoAparelho.rows[0].matricula;
                profNome = donoAparelho.rows[0].nome_completo;
            }
        }

        if (!profId && profMatricula) {
            const profRes = await pool.query("SELECT id, nome_completo FROM participantes WHERE matricula = $1 AND ativo = TRUE", [profMatricula]);
            if (profRes.rows.length > 0) {
                profId = profRes.rows[0].id;
                profNome = profRes.rows[0].nome_completo;
                await pool.query("UPDATE participantes SET device_key = $1 WHERE id = $2", [device_key, profId]);
            } else {
                return res.json({ requer_cadastro: true, matricula_tentada: profMatricula });
            }
        }

        if (!profId) {
            return res.json({ requere_matricula: true, message: "Primeiro acesso neste dispositivo. Informe sua matrícula." });
        }

        const eventosHoje = await pool.query(`
            SELECT e.*, l.latitude, l.longitude, l.nome as local_nome 
            FROM eventos e
            JOIN locais l ON e.local_id = l.id
            WHERE e.data_evento = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date AND l.ativo = TRUE
        `);

        if (eventosHoje.rows.length === 0) return res.json({ success: false, message: "Não há Formações agendadas para hoje." });

        let eventoAlvo = null;
        for (let ev of eventosHoje.rows) {
            const distancia = calcularDistancia(parseFloat(lat), parseFloat(lng), parseFloat(ev.latitude), parseFloat(ev.longitude));
            if (distancia <= 60) { eventoAlvo = ev; break; }
        }

        if (!eventoAlvo) {
            await pool.query("INSERT INTO log_fraudes (matricula, lat_tentativa, lng_tentativa, motivo) VALUES ($1, $2, $3, 'FORA_DO_RAIO')", [profMatricula, lat, lng]);
            return res.json({ success: false, message: "Você não está no local da Formação. Aproxime-se." });
        }

        const freqAberta = await pool.query("SELECT id FROM frequencias WHERE participante_id = $1 AND evento_id = $2 AND data_saida IS NULL", [profId, eventoAlvo.id]);

        if (freqAberta.rows.length === 0) {
            await pool.query(`INSERT INTO frequencias (participante_id, evento_id, data_entrada, lat_entrada, lng_entrada, device_key, matricula) VALUES ($1, $2, CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo', $3, $4, $5, $6)`, [profId, eventoAlvo.id, lat, lng, device_key, profMatricula]);
            return res.json({ success: true, status: 'entrada_gravada', professor: profNome, evento: eventoAlvo.titulo });
        } else {
            return res.json({ success: true, status: 'requer_avaliacao', frequencia_id: freqAberta.rows[0].id, professor: profNome, evento: eventoAlvo.titulo });
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/cadastrar-participante', async (req, res) => {
    const { nome_completo, matricula, device_key } = req.body;
    try {
        await pool.query("INSERT INTO participantes (nome_completo, matricula, device_key, ativo) VALUES ($1, $2, $3, TRUE)", [nome_completo, matricula, device_key]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/finalizar-saida', async (req, res) => {
    const { frequencia_id, avaliacao, lat, lng } = req.body;
    try {
        await pool.query(`
            UPDATE frequencias 
            SET data_saida = CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo', 
                lat_saida = $1, 
                lng_saida = $2, 
                avaliacao = $3 
            WHERE id = $4`,
            [lat || null, lng || null, avaliacao, frequencia_id]
        );
        res.json({ success: true, message: "Sua saída e avaliação foram homologadas com sucesso!" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ========================================================
// --- 4. ROTAS DO PAINEL ADMINISTRATIVO (VERSÃO ANTERIOR) -
// ========================================================

app.get('/api/admin/professores', async (req, res) => {
  const r = await pool.query("SELECT * FROM participantes ORDER BY nome_completo ASC");
  res.json(r.rows);
});

app.post('/api/admin/professores', async (req, res) => {
  const { nome_completo, matricula, ativo } = req.body;
  await pool.query(
    "INSERT INTO participantes (nome_completo, matricula, ativo) VALUES ($1, $2, $3) ON CONFLICT (matricula) DO UPDATE SET nome_completo = $1, ativo = $3",
    [nome_completo, matricula, ativo]
  );
  res.json({ success: true });
});

app.post('/api/admin/eventos', async (req, res) => {
    const { titulo, data_evento, carga_horaria, local_id, hora_inicio, hora_fim } = req.body;
    try {
        await pool.query(
            "INSERT INTO eventos (titulo, data_evento, carga_horaria, local_id, hora_inicio, hora_fim) VALUES ($1, $2, $3, $4, $5, $6)", 
            [titulo, data_evento, carga_horaria, local_id, hora_inicio || null, hora_fim || null]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/eventos', async (req, res) => {
    const r = await pool.query(`
        SELECT e.*, l.nome as local_nome 
        FROM eventos e 
        LEFT JOIN locais l ON e.local_id = l.id 
        ORDER BY e.data_evento DESC`);
    res.json(r.rows);
});

app.get('/api/admin/locais', async (req, res) => {
    const r = await pool.query("SELECT * FROM locais ORDER BY nome ASC");
    res.json(r.rows);
});

app.post('/api/admin/locais', async (req, res) => {
    const { id, nome, endereco, latitude, longitude, ativo } = req.body;
    if (id) {
        await pool.query("UPDATE locais SET nome=$1, endereco=$2, latitude=$3, longitude=$4, ativo=$5 WHERE id=$6", [nome, endereco, latitude, longitude, ativo, id]);
    } else {
        await pool.query("INSERT INTO locais (nome, endereco, latitude, longitude) VALUES ($1, $2, $3, $4)", [nome, endereco, latitude, longitude]);
    }
    res.json({ success: true });
});

// Relatórios Históricos / Legados
app.get('/api/admin/relatorio-geral', async (req, res) => {
  const sql = `
    SELECT f.*, p.nome_completo, p.matricula, e.titulo, e.carga_horaria,
    EXTRACT(EPOCH FROM (f.data_saida - f.data_entrada))/3600 as permanencia_horas
    FROM frequencias f
    JOIN participantes p ON f.participante_id = p.id
    JOIN eventos e ON f.evento_id = e.id
    ORDER BY f.data_entrada DESC`;
  const result = await pool.query(sql);
  res.json(result.rows);
});

app.get('/api/admin/relatorio-periodo', async (req, res) => {
    const { inicio, fim } = req.query;
    const sql = `
        SELECT e.titulo, e.data_evento, e.carga_horaria, COUNT(f.id) as total_presentes
        FROM eventos e
        LEFT JOIN frequencias f ON e.id = f.evento_id
        WHERE e.data_evento BETWEEN $1 AND $2
        GROUP BY e.id ORDER BY e.data_evento ASC`;
    const result = await pool.query(sql, [inicio, fim]);
    res.json(result.rows);
});

app.get('/api/admin/relatorio-oferta', async (req, res) => {
    const { inicio, fim } = req.query;
    const sql = `
        SELECT titulo, data_evento, carga_horaria, endereco 
        FROM eventos 
        WHERE data_evento BETWEEN $1 AND $2 
        ORDER BY data_evento ASC`;
    const r = await pool.query(sql, [inicio, fim]);
    res.json(r.rows);
});

app.get('/api/admin/dossie-professor', async (req, res) => {
    const { professor_id, inicio, fim } = req.query;
    const sql = `
        SELECT e.titulo, f.data_entrada, f.data_saida,
        EXTRACT(EPOCH FROM (f.data_saida - f.data_entrada))/3600 as permanencia
        FROM frequencias f
        JOIN eventos e ON f.evento_id = e.id
        WHERE f.participante_id = $1 AND e.data_evento BETWEEN $2 AND $3
        ORDER BY e.data_evento DESC`;
    const r = await pool.query(sql, [professor_id, inicio, fim]);
    res.json(r.rows);
});

app.get('/api/admin/relatorio-individual', async (req, res) => {
    const { inicio, fim } = req.query;
    try {
        const r = await pool.query(`
            SELECT p.nome_completo, p.matricula, count(f.id) as total_presencas,
                   coalesce(sum(extract(epoch from (f.data_saida - f.data_entrada))/3600), 0) as horas_validadas
            FROM participantes p
            JOIN frequencias f ON f.participante_id = p.id
            JOIN eventos e ON f.evento_id = e.id
            WHERE e.data_evento BETWEEN $1 AND $2 AND f.data_saida IS NOT NULL
            GROUP BY p.id, p.nome_completo, p.matricula
            ORDER BY p.nome_completo ASC`, [inicio, fim]);
        res.json(r.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/relatorio-local', async (req, res) => {
    const { inicio, fim } = req.query;
    try {
        const r = await pool.query(`
            SELECT l.nome as local_nome, l.endereco, count(distinct e.id) as total_eventos,
                   count(f.id) as total_atendimentos
            FROM locais l
            JOIN eventos e ON e.local_id = l.id
            LEFT JOIN frequencias f ON f.evento_id = e.id
            WHERE e.data_evento BETWEEN $1 AND $2
            GROUP BY l.id, l.nome, l.endereco
            ORDER BY total_atendimentos DESC`, [inicio, fim]);
        res.json(r.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Gestão de Usuários Administrativos Legada
app.get('/api/usuarios', async (req, res) => {
    const result = await pool.query("SELECT id, nome, email, ativo FROM usuarios ORDER BY id ASC");
    res.json(result.rows);
});
app.post('/api/usuarios', async (req, res) => {
    const { nome, email, senha } = req.body;
    await pool.query("INSERT INTO usuarios (nome, email, senha) VALUES ($1, $2, $3)", [nome, email, hashSenha(senha)]);
    res.json({ success: true });
});
app.put('/api/usuarios/:id/status', async (req, res) => {
    const { ativo } = req.body;
    await pool.query("UPDATE usuarios SET ativo = $1 WHERE id = $2", [ativo, req.params.id]);
    res.json({ success: true });
});

// ========================================================
// --- 5. NOVAS ROTAS DA VERSÃO 2 (PAINEL JWT PROTEGIDO) --
// ========================================================

app.get('/api/v2/locais', verificarToken, async (req, res) => {
    try {
        const queryText = 'SELECT id, nome, endereco, latitude, longitude, ativo FROM locais ORDER BY nome ASC';
        const result = await pool.query(queryText);
        return res.json(result.rows);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro interno ao recuperar os locais.' });
    }
});

app.get('/api/v2/locais/ativos', verificarToken, async (req, res) => {
    try {
        const queryText = 'SELECT id, nome FROM locais WHERE ativo = true ORDER BY nome ASC';
        const result = await pool.query(queryText);
        return res.json(result.rows);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro interno ao recuperar locais ativos.' });
    }
});

app.post('/api/v2/locais', verificarToken, async (req, res) => {
    const { nome, endereco, latitude, longitude } = req.body;
    if (!nome || !endereco || latitude === undefined || longitude === undefined) {
        return res.status(400).json({ error: 'Todos os campos precisam ser preenchidos.' });
    }
    try {
        const queryText = 'INSERT INTO locais (nome, endereco, latitude, longitude, ativo) VALUES ($1, $2, $3, $4, true) RETURNING *';
        const result = await pool.query(queryText, [nome, endereco, latitude, longitude]);
        return res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro interno ao salvar os dados do local.' });
    }
});

app.put('/api/v2/locais/:id', verificarToken, async (req, res) => {
    const { id } = req.params;
    const { nome, endereco, latitude, longitude } = req.body;
    if (!nome || !endereco || latitude === undefined || longitude === undefined) {
        return res.status(400).json({ error: 'Parâmetros incompletos.' });
    }
    try {
        const queryText = 'UPDATE locais SET nome = $1, endereco = $2, latitude = $3, longitude = $4 WHERE id = $5 RETURNING *';
        const result = await pool.query(queryText, [nome, endereco, latitude, longitude, id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Local não encontrado.' });
        return res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro interno ao atualizar local.' });
    }
});

app.patch('/api/v2/locais/:id/inativar', verificarToken, async (req, res) => {
    const { id } = req.params;
    try {
        const queryText = 'UPDATE locais SET ativo = false WHERE id = $1 RETURNING *';
        const result = await pool.query(queryText, [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Local não encontrado.' });
        return res.json({ message: 'O local foi inativado com sucesso.', local: result.rows[0] });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro interno ao inativar local.' });
    }
});

app.patch('/api/v2/locais/:id/restaurar', verificarToken, async (req, res) => {
    const { id } = req.params;
    try {
        const queryText = 'UPDATE locais SET ativo = true WHERE id = $1 RETURNING *';
        const result = await pool.query(queryText, [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Local não encontrado.' });
        return res.json({ message: 'O local foi restaurado com sucesso.', local: result.rows[0] });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro interno ao reativar local.' });
    }
});

app.get('/api/v2/publico-alvo', verificarToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, nome, ativo FROM publicoalvo ORDER BY nome ASC');
        return res.json(result.rows);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro interno ao recuperar público-alvo.' });
    }
});

app.get('/api/v2/publico-alvo/ativos', verificarToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, nome FROM publicoalvo WHERE ativo = true ORDER BY nome ASC');
        return res.json(result.rows);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro interno ao recuperar públicos-alvo ativos.' });
    }
});

app.post('/api/v2/publico-alvo', verificarToken, async (req, res) => {
    const { nome } = req.body;
    if (!nome) return res.status(400).json({ error: 'O nome é obrigatório.' });
    try {
        const result = await pool.query('INSERT INTO publicoalvo (nome, ativo) VALUES ($1, true) RETURNING *', [nome]);
        return res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro interno ao salvar público-alvo.' });
    }
});

app.put('/api/v2/publico-alvo/:id', verificarToken, async (req, res) => {
    const { id } = req.params;
    const { nome } = req.body;
    if (!nome) return res.status(400).json({ error: 'O nome é obrigatório.' });
    try {
        const result = await pool.query('UPDATE publicoalvo SET nome = $1 WHERE id = $2 RETURNING *', [nome, id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Público-alvo não encontrado.' });
        return res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro interno ao atualizar público-alvo.' });
    }
});

app.patch('/api/v2/publico-alvo/:id/inativar', verificarToken, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('UPDATE publicoalvo SET ativo = false WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Público-alvo não encontrado.' });
        return res.json({ message: 'Inativado com sucesso.', data: result.rows[0] });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro interno ao inativar público-alvo.' });
    }
});

app.patch('/api/v2/publico-alvo/:id/reativar', verificarToken, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('UPDATE publicoalvo SET ativo = true WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Público-alvo não encontrado.' });
        return res.json({ message: 'Reativado com sucesso.', data: result.rows[0] });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro interno ao reativar público-alvo.' });
    }
});

app.get('/api/v2/eventos', verificarToken, async (req, res) => {
    try {
        const query = `
            SELECT e.*, l.nome as local_nome, p.nome as publico_alvo_nome 
            FROM eventos e
            LEFT JOIN locais l ON e.local_id = l.id
            LEFT JOIN publicoalvo p ON e.publico_alvo_id = p.id
            ORDER BY e.data_evento DESC, e.hora_inicio DESC
        `;
        const result = await pool.query(query);
        return res.json(result.rows);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro interno ao buscar eventos.' });
    }
});

app.post('/api/v2/eventos', verificarToken, async (req, res) => {
    const { titulo, data_evento, carga_horaria, palestrante, local, token_qr, endereco, latitude, longitude, local_id, hora_inicio, hora_fim, publico_alvo_id } = req.body;

    if (!titulo || !data_evento || !carga_horaria || !local_id || !hora_inicio || !hora_fim || !publico_alvo_id) {
        return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
    }

    try {
        const conflitoQuery = `
            SELECT id FROM eventos 
            WHERE local_id = $1 
              AND data_evento = $2 
              AND hora_inicio < $4 
              AND hora_fim > $3
        `;
        const conflitoResult = await pool.query(conflitoQuery, [local_id, data_evento, hora_inicio, hora_fim]);

        if (conflitoResult.rows.length > 0) {
            return res.status(409).json({ error: 'Conflito de horário: Já existe um evento agendado para este local neste mesmo intervalo.' });
        }

        const insertQuery = `
            INSERT INTO eventos (titulo, data_evento, carga_horaria, palestrante, local, token_qr, endereco, latitude, longitude, local_id, hora_inicio, hora_fim, publico_alvo_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *
        `;
        const result = await pool.query(insertQuery, [titulo, data_evento, carga_horaria, palestrante, local, token_qr, endereco, latitude, longitude, local_id, hora_inicio, hora_fim, publico_alvo_id]);
        return res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro interno ao criar evento.' });
    }
});

app.put('/api/v2/eventos/:id', verificarToken, async (req, res) => {
    const { id } = req.params;
    const { titulo, data_evento, carga_horaria, palestrante, local, token_qr, endereco, latitude, longitude, local_id, hora_inicio, hora_fim, publico_alvo_id } = req.body;

    if (!titulo || !data_evento || !carga_horaria || !local_id || !hora_inicio || !hora_fim || !publico_alvo_id) {
        return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
    }

    try {
        const conflitoQuery = `
            SELECT id FROM eventos 
            WHERE local_id = $1 
              AND data_evento = $2 
              AND hora_inicio < $4 
              AND hora_fim > $3
              AND id != $5
        `;
        const conflitoResult = await pool.query(conflitoQuery, [local_id, data_evento, hora_inicio, hora_fim, id]);

        if (conflitoResult.rows.length > 0) {
            return res.status(409).json({ error: 'Conflito de horário: Já existe outro evento agendado para este local no mesmo intervalo.' });
        }

        const updateQuery = `
            UPDATE eventos 
            SET titulo = $1, data_evento = $2, carga_horaria = $3, palestrante = $4, local = $5, token_qr = $6, endereco = $7, latitude = $8, longitude = $9, local_id = $10, hora_inicio = $11, hora_fim = $12, publico_alvo_id = $13
            WHERE id = $14
            RETURNING *
        `;
        const result = await pool.query(updateQuery, [titulo, data_evento, carga_horaria, palestrante, local, token_qr, endereco, latitude, longitude, local_id, hora_inicio, hora_fim, publico_alvo_id, id]);
        
        if (result.rows.length === 0) return res.status(404).json({ error: 'Evento não encontrado.' });
        return res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro interno ao atualizar evento.' });
    }
});

app.delete('/api/v2/eventos/:id', verificarToken, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM eventos WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Evento não encontrado.' });
        return res.json({ message: 'Evento excluído com sucesso.' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro interno ao excluir evento.' });
    }
});

app.post('/api/v2/pesquisa-satisfacao', verificarToken, async (req, res) => {
    const { participante_id, evento_id, publico_alvo_id, avaliacao, comentarios } = req.body;
    if (!evento_id || !avaliacao) return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
    try {
        const result = await pool.query(
            'INSERT INTO pesquisa_satisfacao (participante_id, evento_id, publico_alvo_id, avaliacao, comentarios) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [participante_id, evento_id, publico_alvo_id, avaliacao, comentarios]
        );
        return res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro interno ao salvar pesquisa de satisfação.' });
    }
});

app.get('/api/v2/pesquisa-satisfacao/evento/:evento_id', verificarToken, async (req, res) => {
    const { evento_id } = req.params;
    try {
        const result = await pool.query(`
            SELECT p.*, part.nome_completo as participante_nome, part.matricula, pa.nome as publico_alvo_nome
            FROM pesquisa_satisfacao p
            LEFT JOIN participantes part ON p.participante_id = part.id
            LEFT JOIN publicoalvo pa ON p.publico_alvo_id = pa.id
            WHERE p.evento_id = $1
            ORDER BY p.criado_em DESC
        `, [evento_id]);
        return res.json(result.rows);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro interno ao recuperar pesquisas do evento.' });
    }
});

app.get('/api/v2/relatorios/prestacao-contas', verificarToken, async (req, res) => {
    const { data_inicio, data_fim } = req.query;
    try {
        let query = `
            SELECT e.id, e.titulo, e.data_evento, e.carga_horaria, e.palestrante, e.hora_inicio, e.hora_fim,
                   l.nome as local_nome,
                   COUNT(f.id) as total_participantes
            FROM eventos e
            LEFT JOIN locais l ON e.local_id = l.id
            LEFT JOIN frequencias f ON e.id = f.evento_id
        `;
        const params = [];
        if (data_inicio && data_fim) {
            query += ` WHERE e.data_evento BETWEEN $1 AND $2 `;
            params.push(data_inicio, data_fim);
        }
        query += ` GROUP BY e.id, l.nome ORDER BY e.data_evento DESC, e.hora_inicio DESC `;
        const result = await pool.query(query, params);
        return res.json(result.rows);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro interno ao gerar relatório de prestação de contas.' });
    }
});

app.get('/api/v2/relatorios/log-frequencia', verificarToken, async (req, res) => {
    const { data_inicio, data_fim, evento_id } = req.query;
    try {
        let query = `
            SELECT f.*, p.nome_completo as participante_nome, e.titulo as evento_titulo, l.nome as local_nome
            FROM frequencias f
            JOIN participantes p ON f.participante_id = p.id
            JOIN eventos e ON f.evento_id = e.id
            LEFT JOIN locais l ON e.local_id = l.id
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 1;
        if (data_inicio && data_fim) {
            query += ` AND e.data_evento BETWEEN $${paramCount} AND $${paramCount + 1} `;
            params.push(data_inicio, data_fim);
            paramCount += 2;
        }
        if (evento_id) {
            query += ` AND f.evento_id = $${paramCount} `;
            params.push(evento_id);
            paramCount++;
        }
        query += ` ORDER BY f.data_entrada DESC `;
        const result = await pool.query(query, params);
        return res.json(result.rows);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro interno ao recuperar log de frequências.' });
    }
});

app.get('/api/v2/relatorios/log-fraudes', verificarToken, async (req, res) => {
    const { data_inicio, data_fim } = req.query;
    try {
        let query = `
            SELECT lf.*, e.titulo as evento_titulo, e.data_evento
            FROM log_fraudes lf
            JOIN eventos e ON lf.evento_id = e.id
            WHERE 1=1
        `;
        const params = [];
        if (data_inicio && data_fim) {
            query += ` AND e.data_evento BETWEEN $1 AND $2 `;
            params.push(data_inicio, data_fim);
        }
        query += ` ORDER BY lf.data_tentativa DESC `;
        const result = await pool.query(query, params);
        return res.json(result.rows);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro interno ao recuperar log de fraudes.' });
    }
});

// ========================================================
// --- 6. GESTÃO DE ROTA 404 E CAPTURA DE ERROS CRÍTICOS --
// ========================================================

app.use((req, res) => {
    return res.status(404).json({ error: 'Rota não encontrada no servidor.' });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    return res.status(500).json({ error: 'Ocorreu um erro interno crítico no servidor.' });
});

app.listen(PORT, () => {
    console.log(`Servidor Formar v4 Ativo na porta ${PORT}`);
});