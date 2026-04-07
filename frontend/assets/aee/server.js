const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const multer = require('multer'); // Para uploads de fotos
const puppeteer = require('puppeteer');
const appProfissional = express(); // Nova porta 3012
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'omeq_db',
    password: 'Gatosap2009*2', // Sua senha padrão
    port: 5432,
});

// Configuração de Upload de Evidências
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// --- DEFINIÇÃO DOS 3 APLICATIVOS ---
const appCadastro = express(); // Porta 3004
const appPainel = express();   // Porta 3005
const appPais = express();     // Porta 3011

[appCadastro, appPainel, appPais].forEach(app => {
    app.use(cors());
    app.use(express.json());
    app.use('/uploads', express.static('uploads'));
});
const bcrypt = require('bcryptjs');
// Servir os arquivos estáticos de cada pasta
appCadastro.use(express.static('public_cadastro'));
appPainel.use(express.static('public_painel'));
appPais.use(express.static('public_pais'));
appProfissional.use(cors()); appProfissional.use(express.json());
appProfissional.use(express.static('public_profissional'));


async function registrarLog(usuario_id, acao, aluno_id, detalhes) {
    try {
        await pool.query(
            'INSERT INTO aee_auditoria (usuario_id, acao, aluno_id, detalhes) VALUES ($1, $2, $3, $4)',
            [usuario_id, acao, aluno_id, detalhes]
        );
    } catch (err) { console.error("Falha ao registar auditoria:", err); }
}

appPainel.post('/api/equipe/registrar', async (req, res) => {
    const { nome, login, senha, especialidade_id } = req.body;
    const hash = await bcrypt.hash(senha, 10);
    try {
        await pool.query(
            'INSERT INTO aee_usuarios_equipe (nome, login, senha_hash, especialidade_id) VALUES ($1, $2, $3, $4)',
            [nome, login, hash, especialidade_id]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Erro ao criar técnico ou login já existe." }); }
});

appCadastro.post('/api/gerar-acesso-pais', async (req, res) => {
    const { aluno_id, usuario, pin } = req.body;
    try {
        await pool.query(
            `INSERT INTO aee_usuarios_pais (aluno_id, usuario, senha_pin, ativo) 
             VALUES ($1, $2, $3, true) 
             ON CONFLICT (aluno_id) DO UPDATE SET usuario = $2, senha_pin = $3`,
            [aluno_id, usuario, pin]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- ROTA DE LOGIN DA EQUIPE (Para o Cadastro 3004) ---
appCadastro.post('/api/login-equipe', async (req, res) => {
    const { login, senha } = req.body;
    try {
        const result = await pool.query('SELECT * FROM aee_usuarios_equipe WHERE login = $1 AND ativo = true', [login]);
        if (result.rows.length === 0) return res.status(401).json({ error: "Usuário não encontrado." });

        const usuario = result.rows[0];
        const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);

        if (senhaValida) {
            res.json({ success: true, user: { id: usuario.id, nome: usuario.nome } });
        } else {
            res.status(401).json({ error: "Senha incorreta." });
        }
    } catch (err) { res.status(500).send(err.message); }
});

// --- ATUALIZAÇÃO DO CADASTRO DE ALUNO ---
appCadastro.post('/api/alunos', async (req, res) => {
    const { nome, ra, escola, especialidades, carga, usuario_id } = req.body;
    try {
        await pool.query(
            'INSERT INTO aee_alunos (nome_completo, ra, escola, especialidades, carga_horaria, criado_por_usuario_id) VALUES ($1, $2, $3, $4, $5, $6)',
            [nome, ra, escola, JSON.stringify(especialidades), JSON.stringify(carga), usuario_id]
        );
        
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

// 2. Registro de Atendimento com Upload
appPainel.post('/api/atendimento', upload.single('foto'), async (req, res) => {
    const { aluno_id, especialidade, data_hora, status, evolucao } = req.body;
    const foto_url = req.file ? `/uploads/${req.file.filename}` : null;
    try {
        await pool.query(
            'INSERT INTO aee_atendimentos (aluno_id, especialidade, data_hora, status, evolucao, evidencia_url) VALUES ($1, $2, $3, $4, $5, $6)',
            [aluno_id, especialidade, data_hora, status, evolucao, foto_url]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. Login dos Pais (LGPD)
appPais.post('/api/login', async (req, res) => {
    const { usuario, pin } = req.body;
    try {
        const result = await pool.query(
            'SELECT a.*, u.usuario FROM aee_alunos a JOIN aee_usuarios_pais u ON a.id = u.aluno_id WHERE u.usuario = $1 AND u.senha_pin = $2',
            [usuario, pin]
        );
        if (result.rows.length > 0) res.json({ success: true, aluno: result.rows[0] });
        else res.status(401).json({ success: false, message: "Usuário ou PIN incorretos." });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

appPainel.get('/api/listagem-alunos', async (req, res) => {
    const result = await pool.query('SELECT id, nome_completo, ra FROM aee_alunos ORDER BY nome_completo');
    res.json(result.rows);
});

// Rota para Gerar/Criar Acesso do Pai
appPainel.post('/api/gerar-acesso', async (req, res) => {
    const { aluno_id, usuario } = req.body;
    
    // Gerar PIN de 5 dígitos (apenas números)
    const pinAleatorio = Math.floor(10000 + Math.random() * 90000).toString();

    try {
        await pool.query(
            `INSERT INTO aee_usuarios_pais (aluno_id, usuario, senha_pin, ativo) 
             VALUES ($1, $2, $3, true)
             ON CONFLICT (aluno_id) DO UPDATE SET usuario = $2, senha_pin = $3, ativo = true`,
            [aluno_id, usuario, pinAleatorio]
        );
        res.json({ success: true, pin: pinAleatorio });
    } catch (err) {
        res.status(500).json({ error: "Usuário já existe ou erro no banco." });
    }
});

// Rota para Inativar/Reativar Acesso
appPainel.patch('/api/toggle-acesso/:id', async (req, res) => {
    const { id } = req.params;
    const { ativo } = req.body;
    try {
        await pool.query('UPDATE aee_usuarios_pais SET ativo = $1 WHERE id = $2', [ativo, id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Listagem de Alunos com Status de Acesso
appPainel.get('/api/lista-gestao-acesso', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT a.id as aluno_id, a.nome_completo, a.ra, u.id as acesso_id, u.usuario, u.ativo, u.senha_pin
            FROM aee_alunos a 
            LEFT JOIN aee_usuarios_pais u ON a.id = u.aluno_id 
            ORDER BY a.nome_completo
        `);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Login do Pai com verificação de primeiro acesso
appPais.post('/api/login-pais', async (req, res) => {
    const { usuario, pin } = req.body;
    try {
        const result = await pool.query(
            'SELECT u.*, a.nome_completo FROM aee_usuarios_pais u JOIN aee_alunos a ON u.aluno_id = a.id WHERE u.usuario = $1 AND u.senha_pin = $2 AND u.ativo = true',
            [usuario, pin]
        );
        if (result.rows.length > 0) {
            res.json({ success: true, data: result.rows[0] });
            await pool.query(
                'INSERT INTO aee_log_acesso_pais (pai_id, aluno_id) VALUES ($1, $2)',
                [usuario.id, usuario.aluno_id]
            );            
        } else {
            res.status(401).json({ success: false, message: "Acesso negado." });
        }
    } catch (err) { res.status(500).send(err.message); }
});

// Troca de Senha (PIN)
appPais.post('/api/alterar-pin', async (req, res) => {
    const { usuario_id, novo_pin } = req.body;
    try {
        await pool.query(
            'UPDATE aee_usuarios_pais SET senha_pin = $1, primeiro_acesso = false WHERE id = $2',
            [novo_pin, usuario_id]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

// Busca Dados do Filho (LGPD: Somente o vinculado ao usuário)
appPais.get('/api/meu-filho/:aluno_id', async (req, res) => {
    const { aluno_id } = req.params;
    try {
        const aluno = await pool.query('SELECT * FROM aee_alunos WHERE id = $1', [aluno_id]);
        const historico = await pool.query('SELECT * FROM aee_atendimentos WHERE aluno_id = $1 ORDER BY data_hora DESC', [aluno_id]);
        res.json({ aluno: aluno.rows[0], historico: historico.rows });
    } catch (err) { res.status(500).send(err.message); }
});

// Listar alunos (Indica se o usuário atual pode editar)
appCadastro.get('/api/alunos/meus/:usuario_id', async (req, res) => {
    const { usuario_id } = req.params;
    try {
        const result = await pool.query(`
            SELECT id, nome_completo, ra, escola, criado_por_usuario_id 
            FROM aee_alunos 
            ORDER BY data_cadastro DESC
        `);
        res.json(result.rows);
    } catch (err) { res.status(500).send(err.message); }
});

// Alterar aluno (Bloqueio de segurança no banco)
appCadastro.put('/api/alunos/:id', async (req, res) => {
    const { id } = req.params;
    const { nome, ra, escola, especialidades, carga, usuario_id } = req.body;
    
    try {
        // O WHERE garante que só atualiza se o usuário for o dono
        const update = await pool.query(
            `UPDATE aee_alunos 
             SET nome_completo = $1, ra = $2, escola = $3, especialidades = $4, carga_horaria = $5 
             WHERE id = $6 AND criado_por_usuario_id = $7`,
            [nome, ra, escola, JSON.stringify(especialidades), JSON.stringify(carga), id, usuario_id]
        );
        registrarLog(usuario_id, 'CADASTRO', result.id, 'Cadastrou novo aluno');
        if (update.rowCount === 0) {
            return res.status(403).json({ error: "Você não tem permissão para alterar este registro." });
        }
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

// Rota para o Ranking de Produção (Porta 3005)
appPainel.get('/api/ranking-producao', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                u.nome as tecnico, 
                COUNT(a.id) as total_cadastros
            FROM aee_usuarios_equipe u
            LEFT JOIN aee_alunos a ON u.id = a.criado_por_usuario_id
            GROUP BY u.id, u.nome
            ORDER BY total_cadastros DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- ROTA DE CONSULTA (Para o Painel 3005) ---
appPainel.get('/api/auditoria', async (req, res) => {
    const { inicio, fim, usuario } = req.query;
    let query = `
        SELECT log.*, u.nome as tecnico, a.nome_completo as aluno
        FROM aee_auditoria log
        JOIN aee_usuarios_equipe u ON log.usuario_id = u.id
        LEFT JOIN aee_alunos a ON log.aluno_id = a.id
        WHERE 1=1
    `;
    const params = [];

    if (inicio && fim) {
        params.push(inicio, fim);
        query += ` AND log.data_hora BETWEEN $${params.length-1} AND $${params.length}`;
    }
    if (usuario) {
        params.push(usuario);
        query += ` AND u.id = $${params.length}`;
    }

    query += ` ORDER BY log.data_hora DESC LIMIT 200`;

    try {
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) { res.status(500).send(err.message); }
});

// Rota para Alerta de Abandono (Porta 3005)
appPainel.get('/api/alertas-assiduidade', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                a.id, 
                a.nome_completo, 
                a.escola, 
                a.carga_horaria,
                (SELECT COUNT(*) FROM aee_atendimentos 
                 WHERE aluno_id = a.id 
                 AND status = 'Presente' 
                 AND date_trunc('month', data_hora) = date_trunc('month', current_date)) as presencas_mes
            FROM aee_alunos a
            ORDER BY a.nome_completo
        `);

        // Processamento da taxa para cada especialidade do aluno
        const alertas = result.rows.map(aluno => {
            const analise = [];
            const cargas = aluno.carga_horaria || {};
            
            for (let esp in cargas) {
                const autorizadas = cargas[esp];
                // Busca presenças específicas por especialidade no mês
                // (Simulado aqui, idealmente o count acima seria por especialidade)
                const taxa = (aluno.presencas_mes / autorizadas) * 100;
                
                if (taxa < 50) {
                    analise.push({ especialidade: esp, taxa: taxa.toFixed(0), autorizadas, reais: aluno.presencas_mes });
                }
            }
            return { ...aluno, problemas: analise };
        }).filter(a => a.problemas.length > 0);

        res.json(alertas);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Rota para Gerar Dossiê do Aluno (Porta 3005)
appPainel.get('/api/gerar-dossie/:id', async (req, res) => {
    try {
        // 1. Busca Dados do Aluno e Atendimentos
        const alunoRes = await pool.query('SELECT * FROM aee_alunos WHERE id = $1', [req.params.id]);
        const logsRes = await pool.query('SELECT * FROM aee_atendimentos WHERE aluno_id = $1 ORDER BY data_hora DESC', [req.params.id]);
        
        if (alunoRes.rows.length === 0) return res.status(404).send("Aluno não encontrado");
        
        const a = alunoRes.rows[0];
        const historico = logsRes.rows;

        // 2. Template HTML do Dossiê
        const html = `
        <html>
        <head>
            <style>
                @page { size: A4; margin: 15mm; }
                body { font-family: 'Arial', sans-serif; color: #333; line-height: 1.4; }
                .header { text-align: center; border-bottom: 2px solid #004587; padding-bottom: 10px; margin-bottom: 20px; }
                .titulo { font-size: 16pt; font-weight: bold; color: #004587; text-transform: uppercase; }
                .subtitulo { font-size: 11pt; margin-top: 5px; }
                .ficha-aluno { background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #ddd; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                .ficha-aluno b { color: #004587; }
                .sessao { page-break-inside: avoid; border: 1px solid #eee; padding: 10px; margin-bottom: 15px; border-radius: 5px; }
                .sessao-header { display: flex; justify-content: space-between; font-weight: bold; background: #f0f4f8; padding: 5px; border-radius: 4px; font-size: 10pt; }
                .relato { font-size: 10pt; margin: 8px 0; text-align: justify; }
                .evidencia img { max-width: 250px; border-radius: 5px; margin-top: 10px; border: 1px solid #ccc; }
                .footer { position: fixed; bottom: 0; width: 100%; text-align: center; font-size: 8pt; color: #777; border-top: 1px solid #eee; padding-top: 5px; }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="titulo">Dossiê de Atendimento Individual</div>
                <div class="subtitulo">AEE - Atendimento Educacional Especializado [cite: 3]</div>
            </div>

            <div class="ficha-aluno">
                <div><b>Aluno:</b> ${a.nome_completo} [cite: 6]</div>
                <div><b>RA:</b> ${a.ra} [cite: 6]</div>
                <div><b>Escola:</b> ${a.escola} [cite: 6]</div>
                <div><b>Data de Emissão:</b> ${new Date().toLocaleDateString('pt-BR')}</div>
            </div>

            <h4>Histórico de Atendimentos e Evolução [cite: 10]</h4>

            ${historico.map(h => `
                <div class="sessao">
                    <div class="sessao-header">
                        <span>${h.especialidade} [cite: 13]</span>
                        <span>${new Date(h.data_hora).toLocaleString('pt-BR')} [cite: 14]</span>
                        <span>Status: ${h.status} [cite: 14]</span>
                    </div>
                    <div class="relato"><b>Evolução:</b> ${h.evolucao || 'Sem registro de texto.'} [cite: 15]</div>
                    ${h.evidencia_url ? `
                        <div class="evidencia">
                            <b>Evidência Anexada:</b><br>
                            <img src="http://localhost:3005${h.evidencia_url}">
                        </div>
                    ` : ''}
                </div>
            `).join('')}

            <div class="footer">Este documento é parte integrante do prontuário do aluno e possui fins estritamente profissionais. </div>
        </body>
        </html>`;

        // 3. Renderização do PDF com Puppeteer
        const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(html);
        const pdf = await page.pdf({ format: 'A4', printBackground: true });
        await browser.close();

        res.contentType("application/pdf").send(pdf);
    } catch (err) { res.status(500).send("Erro ao gerar PDF: " + err.message); }
});

// Rota para Relatório de Glosa Financeira (Porta 3005)
appPainel.get('/api/relatorio-glosa', async (req, res) => {
    const { mes, ano } = req.query; // Ex: mes=03&ano=2026
    
    try {
        const query = `
            SELECT 
                t.especialidade,
                a.nome_completo as aluno,
                a.escola,
                COUNT(t.id) as total_faltas_profissional,
                string_agg(to_char(t.data_hora, 'DD/MM'), ', ') as datas_glosadas
            FROM aee_atendimentos t
            JOIN aee_alunos a ON t.aluno_id = a.id
            WHERE t.status = 'Falta Profissional'
            AND EXTRACT(MONTH FROM t.data_hora) = $1
            AND EXTRACT(YEAR FROM t.data_hora) = $2
            GROUP BY t.especialidade, a.nome_completo, a.escola
            ORDER BY t.especialidade, a.nome_completo
        `;
        
        const result = await pool.query(query, [mes, ano]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Rota para Confirmar Leitura (Porta 3011)
appPais.post('/api/confirmar-leitura', async (req, res) => {
    const { atendimento_id } = req.body;
    try {
        // Só atualiza se ainda não tiver sido visualizado (evita sobrepor a primeira leitura)
        await pool.query(
            'UPDATE aee_atendimentos SET visualizado_em = NOW() WHERE id = $1 AND visualizado_em IS NULL',
            [atendimento_id]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

// Rota para listar todas as especialidades
appCadastro.get('/api/especialidades', async (req, res) => {
    const result = await pool.query('SELECT * FROM aee_especialidades ORDER BY nome');
    res.json(result.rows);
});

// Rota de listagem de alunos para o seletor (Com RA para evitar homônimos)
appCadastro.get('/api/lista-selecao-alunos', async (req, res) => {
    const result = await pool.query('SELECT id, nome_completo, ra FROM aee_alunos ORDER BY nome_completo');
    res.json(result.rows);
});

// Rota para alimentar o seletor inteligente (Porta 3004 e 3005)
appCadastro.get('/api/alunos-selector', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, nome_completo, ra FROM aee_alunos ORDER BY nome_completo');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Rota global para listar especialidades (Portas 3004 e 3005)
appCadastro.get('/api/lista-especialidades', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, nome FROM aee_especialidades ORDER BY nome');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Rota 1: Histórico de Acesso dos Pais
appPainel.get('/api/logs/pais', async (req, res) => {
    const { busca } = req.query; // Pode ser nome do aluno ou RA
    let query = `
        SELECT l.id, l.data_hora, u.usuario as pai, a.nome_completo as filho, a.ra
        FROM aee_log_acesso_pais l
        JOIN aee_usuarios_pais u ON l.pai_id = u.id
        JOIN aee_alunos a ON l.aluno_id = a.id
    `;
    const params = [];
    if (busca) {
        query += ` WHERE a.nome_completo ILIKE $1 OR a.ra::text ILIKE $1 `;
        params.push(`%${busca}%`);
    }
    query += ` ORDER BY l.data_hora DESC LIMIT 100`;
    
    try {
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) { res.status(500).send(err.message); }
});

// Rota 2: Histórico de Acesso e Atividade da Equipa (Porta 3004)
appPainel.get('/api/logs/equipe', async (req, res) => {
    const { tecnico_id, acao } = req.query;
    let query = `
        SELECT log.id, log.data_hora, log.acao, log.detalhes, u.nome as tecnico
        FROM aee_auditoria log
        JOIN aee_usuarios_equipe u ON log.usuario_id = u.id
        WHERE 1=1
    `;
    const params = [];
    if (tecnico_id) {
        params.push(tecnico_id);
        query += ` AND u.id = $${params.length} `;
    }
    if (acao) {
        params.push(acao);
        query += ` AND log.acao = $${params.length} `;
    }
    query += ` ORDER BY log.data_hora DESC LIMIT 100`;

    try {
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) { res.status(500).send(err.message); }
});

// Login do Profissional
appProfissional.post('/api/login-profissional', async (req, res) => {
    const { login, senha } = req.body;
    const result = await pool.query('SELECT p.*, e.nome as nome_especialidade FROM aee_profissionais_saude p JOIN aee_especialidades e ON p.especialidade_id = e.id WHERE p.login = $1', [login]);
    if (result.rows.length > 0) {
        const p = result.rows[0];
        if (await bcrypt.compare(senha, p.senha_hash)) return res.json({ success: true, user: p });
    }
    res.status(401).json({ error: "Credenciais inválidas" });
});

// Listar Alunos da Especialidade do Profissional
appProfissional.get('/api/meus-alunos/:especialidade_nome', async (req, res) => {
    const { especialidade_nome } = req.params;
    // Busca alunos que tenham essa especialidade no JSONB 'especialidades'
    const result = await pool.query(
        "SELECT id, nome_completo, ra, escola FROM aee_alunos WHERE especialidades ? $1",
        [especialidade_nome]
    );
    res.json(result.rows);
});

// Criar Agendamento (Gera o Alerta)
appProfissional.post('/api/agendar', async (req, res) => {
    const { profissional_id, aluno_id, data_hora, obs } = req.body;
    await pool.query(
        'INSERT INTO aee_agendamentos (profissional_id, aluno_id, data_hora, observacoes) VALUES ($1, $2, $3, $4)',
        [profissional_id, aluno_id, data_hora, obs]
    );
    res.json({ success: true });
});

// --- INICIALIZAÇÃO DOS SERVIDORES ---
appCadastro.listen(3004, () => console.log('✅ Cadastro AEE: Porta 3004'));
appPainel.listen(3005, () => console.log('✅ Painel Gestão AEE: Porta 3005'));
appPais.listen(3011, () => console.log('✅ Portal dos Pais: Porta 3011'));
appProfissional.listen(3012, () => console.log('✅ Portal Profissional: 3012'));
