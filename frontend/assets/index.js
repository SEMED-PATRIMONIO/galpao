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

app.post('/api/auth/login', async (req, res) => {
    const { usuario, senha } = req.body;
    try {
        // 1. Busca o usuário no banco de dados pelo nome de usuário
        const result = await pool.query('SELECT * FROM usuarios WHERE usuario = $1', [usuario]);
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciais inválidas.' });
        }
        
        const user = result.rows[0];
        
        // 2. Verifica se o usuário está ativo no sistema
        if (!user.ativo) {
            return res.status(403).json({ error: 'Usuário inativo.' });
        }
        
        // 3. COMPARAÇÃO EM TEXTO LIMPO (Sem hash/criptografia, conforme sua preferência)
        if (user.senha !== senha) {
            return res.status(401).json({ error: 'Credenciais inválidas.' });
        }
        
        // 4. ATENÇÃO: No seu banco Postgres, a coluna 'deve_alterar_senha' vem como TRUE por padrão.
        // Se deixarmos a linha abaixo ativa e o seu painel em React não tiver a tela de troca de senha pronta, 
        // o sistema vai travar o login e não vai gerar o Token. 
        // Deixei comentada abaixo para permitir o login direto imediato:
        // if (user.deve_alterar_senha) return res.json({ deve_alterar_senha: true, usuario: user.usuario });
        
        // 5. Gera o token JWT de acesso administrativo (Válido por 8 horas)
        const token = jwt.sign(
            { id: user.id, usuario: user.usuario }, 
            JWT_SECRET, 
            { expiresIn: '8h' }
        );
        
        // Remove a senha do objeto antes de enviar para o navegador por segurança
        delete user.senha;
        
        // 6. Retorna a combinação exata esperada pelo frontend React (App.jsx)
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
        const resDisp = await pool.query('SELECT * FROM dispositivos WHERE token = $1 AND ativo = true', [device_token]);
        if (resDisp.rows.length === 0) return res.json({ atribuido: false });
        const disp = resDisp.rows[0];
        const resPart = await pool.query('SELECT * FROM participantes WHERE id = $1', [disp.participante_id]);
        return res.json({ atribuido: true, participante: resPart.rows[0] });
    } catch (error) {
        return res.status(500).json({ error: 'Erro interno.' });
    }
});

app.post('/api/v2/dispositivo/associar', async (req, res) => {
    const { matricula, nome, device_token } = req.body;
    try {
        const tokenDispositivo = device_token || uuidv4();
        const resVerif = await pool.query('SELECT * FROM dispositivos WHERE token = $1 AND ativo = true', [tokenDispositivo]);
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
            const novoPart = await pool.query('INSERT INTO participantes (nome_completo, matricula, ativo) VALUES ($1, $2, true) RETURNING id', [nome, matricula]);
            participanteId = novoPart.rows[0].id;
        } else {
            participanteId = resPart.rows[0].id;
        }
        await pool.query('INSERT INTO dispositivos (token, participante_id, ativo) VALUES ($1, $2, true) ON CONFLICT (token) DO UPDATE SET participante_id = $2, ativo = true', [tokenDispositivo, participanteId]);
        const partFinal = await pool.query('SELECT * FROM participantes WHERE id = $1', [participanteId]);
        return res.json({ device_token: tokenDispositivo, participante: partFinal.rows[0] });
    } catch (error) {
        return res.status(500).json({ error: 'Erro interno.' });
    }
});

app.post('/api/v2/presenca/registrar', async (req, res) => {
    const { device_token, latitude, longitude } = req.body;
    try {
        const resDisp = await pool.query('SELECT * FROM dispositivos WHERE token = $1 AND ativo = true', [device_token]);
        if (resDisp.rows.length === 0) return res.status(401).json({ error: 'Dispositivo inválido ou desvinculado.' });
        const disp = resDisp.rows[0];
        const participanteId = disp.participante_id;
        const resPart = await pool.query('SELECT * FROM participantes WHERE id = $1', [participanteId]);
        const participante = resPart.rows[0];
        
        const resAtivo = await pool.query("SELECT * FROM frequencias WHERE participante_id = $1 AND data_saida IS NULL", [participanteId]);
        if (resAtivo.rows.length > 0) {
            const freqAtiva = resAtivo.rows[0];
            const resEv = await pool.query("SELECT * FROM eventos WHERE id = $1", [freqAtiva.evento_id]);
            const ev = resEv.rows[0];
            const agora = new Date();
            const entrada = new Date(freqAtiva.data_entrada);
            const diffMinutos = Math.floor((agora - entrada) / 60000);
            const terminoPrevisto = new Date(ev.data_evento.toISOString().substring(0,10) + 'T' + ev.hora_fim);
            const limiteSaida = new Date(terminoPrevisto.getTime() + 40 * 60000);
            
            if (agora > limiteSaida) {
                await pool.query("INSERT INTO log_fraudes (matricula, evento_id, motivo, distancia_calculada) VALUES ($1, $2, $3, $4)", [participante.matricula, ev.id, 'Esqueceu de registrar saída (Passou 40min do término prev.)', 0]);
                await pool.query("DELETE FROM frequencias WHERE id = $1", [freqAtiva.id]);
                return res.status(400).json({ error: 'Tempo limite expirado. Sua saída foi enviada para auditoria.' });
            }
            if (diffMinutos < 30) {
                return res.json({ requere_confirmacao_30min: true, frequencia_id: freqAtiva.id, evento_titulo: ev.titulo });
            }
            return res.json({ requere_pesquisa: true, frequencia_id: freqAtiva.id, evento_id: ev.id, evento_titulo: ev.titulo, publico_alvo_id: ev.publico_alvo_id });
        }
        
        const resEventos = await pool.query("SELECT * FROM eventos WHERE data_evento = CURRENT_DATE");
        const eventosProximos = [];
        for (const ev of resEventos.rows) {
            const resLoc = await pool.query("SELECT * FROM locais WHERE id = $1", [ev.local_id]);
            if (resLoc.rows.length > 0) {
                const loc = resLoc.rows[0];
                const dist = calcularDistancia(parseFloat(latitude), parseFloat(longitude), parseFloat(loc.latitude), parseFloat(loc.longitude));
                if (dist <= 50) {
                    eventosProximos.push({ ...ev, distancia: dist });
                }
            }
        }
        if (eventosProximos.length === 0) {
            await pool.query("INSERT INTO log_fraudes (matricula, evento_id, motivo, distancia_calculada) VALUES ($1, null, $2, $3)", [participante.matricula, 'Tentativa fora do raio de 50 metros', 0]);
            return res.status(400).json({ error: 'Nenhum evento ativo encontrado no seu raio de localização.' });
        }
        if (eventosProximos.length > 1) {
            return res.json({ multiplos_eventos: true, eventos: eventosProximos });
        }
        const evSelecionado = eventosProximos[0];
        await pool.query("INSERT INTO frequencias (participante_id, evento_id, data_entrada) VALUES ($1, $2, NOW())", [participanteId, evSelecionado.id]);
        return res.json({ sucesso: true, mensagem: `Chegada registrada com sucesso no evento: ${evSelecionado.titulo}` });
    } catch (error) {
        return res.status(500).json({ error: 'Erro interno.' });
    }
});

app.post('/api/v2/presenca/registrar-especifico', async (req, res) => {
    const { device_token, evento_id } = req.body;
    try {
        const resDisp = await pool.query('SELECT * FROM dispositivos WHERE token = $1 AND ativo = true', [device_token]);
        if (resDisp.rows.length === 0) return res.status(41).json({ error: 'Não autorizado.' });
        await pool.query("INSERT INTO frequencias (participante_id, evento_id, data_entrada) VALUES ($1, $2, NOW())", [resDisp.rows[0].participante_id, evento_id]);
        return res.json({ sucesso: true, mensagem: 'Chegada registrada no evento selecionado!' });
    } catch (error) {
        return res.status(500).json({ error: 'Erro interno.' });
    }
});

app.post('/api/v2/presenca/confirmar-saida-precoce', async (req, res) => {
    const { frequencia_id, device_token } = req.body;
    try {
        const resDisp = await pool.query('SELECT * FROM dispositivos WHERE token = $1 AND ativo = true', [device_token]);
        if (resDisp.rows.length === 0) return res.status(401).json({ error: 'Não autorizado.' });
        const disp = resDisp.rows[0];
        const resPart = await pool.query('SELECT * FROM participantes WHERE id = $1', [disp.participante_id]);
        const part = resPart.rows[0];
        const resFreq = await pool.query('SELECT * FROM frequencias WHERE id = $1', [frequencia_id]);
        const freq = resFreq.rows[0];
        await pool.query("INSERT INTO log_fraudes (matricula, evento_id, motivo, distancia_calculada) VALUES ($1, $2, $3, $4)", [part.matricula, freq.evento_id, 'Saída precoce confirmada pelo usuário (Menos de 30 minutos de permanência)', 0]);
        await pool.query("UPDATE frequencias SET data_saida = NOW(), permanencia = '00:00:00' WHERE id = $1", [frequencia_id]);
        return res.json({ sucesso: true, mensagem: 'Saída registrada. Permanência zerada por não cumprir tempo mínimo.' });
    } catch (error) {
        return res.status(500).json({ error: 'Erro interno.' });
    }
});

app.post('/api/v2/presenca/concluir-saida', async (req, res) => {
    const { frequencia_id, estrelas, comentario, device_token, evento_id, publico_alvo_id } = req.body;
    
    try {
        // 1. Valida o dispositivo usando o nome correto da coluna no seu Postgres (device_token)
        const resDisp = await pool.query('SELECT * FROM dispositivos WHERE device_token = $1 AND ativo = true', [device_token]);
        if (resDisp.rows.length === 0) {
            return res.status(401).json({ error: 'Não autorizado ou dispositivo inativo.' });
        }
        const disp = resDisp.rows[0];

        // 2. Converte as estrelas numéricas (1 a 5) no formato de texto exigido pelo CHECK constraint do Postgres
        let avaliacaoTexto = 'Ótimo';
        if (estrelas == 1) avaliacaoTexto = 'Ruim';
        else if (estrelas == 2) avaliacaoTexto = 'Regular';
        else if (estrelas == 3) avaliacaoTexto = 'Bom';
        else if (estrelas == 4) avaliacaoTexto = 'Muito Bom';

        // 3. Salva a pesquisa de satisfação usando os nomes exatos das colunas do Postgres
        await pool.query(`
            INSERT INTO pesquisa_satisfacao (participante_id, evento_id, publico_alvo_id, avaliacao, comentarios, criado_em) 
            VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        `, [
            disp.participante_id, 
            evento_id, 
            publico_alvo_id || null, 
            avaliacaoTexto, 
            comentario
        ]);

        // 4. Registra a saída e calcula a permanência de forma nativa e ultra segura no Postgres
        await pool.query(`
            UPDATE frequencias 
            SET 
                data_saida = CURRENT_TIMESTAMP, 
                permanencia = to_char(CURRENT_TIMESTAMP - data_entrada, 'HH24:MI:SS') 
            WHERE id = $1
        `, [frequencia_id]);

        // Retorna o formato exato esperado pelo frontend do Professor (data.mensagem)
        return res.json({ sucesso: true, mensagem: 'Saída registrada e pesquisa enviada com sucesso! Obrigado.' });

    } catch (error) {
        // Exibe o erro real do Postgres no terminal do servidor para fins de diagnóstico rápido
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
                ps.avaliacao as estrelas,       -- Apelida para 'estrelas' pro React ler sem quebrar
                ps.comentarios as comentario,   -- Apelida para 'comentario' pro React ler sem quebrar
                ps.criado_em as data_resposta,  -- Apelida para 'data_resposta' pro React ler sem quebrar
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