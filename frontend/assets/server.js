const jwt = require('jsonwebtoken');
const SECRET_KEY = "Onwcems1*Gatosap2009*2WaGaSadti*1";

// --- O PORTEIRO DIGITAL (Middleware) ---
const verificarToken = (req, res, next) => {
    const token = req.headers['authorization'];

    if (!token) {
        return res.status(403).json({ error: "Acesso negado. Token não fornecido." });
    }

    try {
        // Remove o prefixo "Bearer " se existir
        const tokenLimpo = token.startsWith('Bearer ') ? token.slice(7, token.length) : token;
        const decoded = jwt.verify(tokenLimpo, SECRET_KEY);
        req.usuarioLogado = decoded; // Salva os dados do usuário na requisição para uso posterior
        next(); // Autorizado! Pode seguir para a rota.
    } catch (err) {
        return res.status(401).json({ error: "Sessão expirada ou token inválido. Faça login novamente." });
    }
};
// Middleware: O Pai só vê o próprio filho
const autorizarPai = (req, res, next) => {
    const alunoIdRequisitado = req.params.aluno_id || req.body.aluno_id;
    const alunoIdNoToken = req.usuarioLogado.aluno_id;

    if (parseInt(alunoIdRequisitado) !== parseInt(alunoIdNoToken)) {
        console.error(`⚠️ Tentativa de acesso indevido: Pai ${req.usuarioLogado.id} tentou acessar aluno ${alunoIdRequisitado}`);
        return res.status(403).json({ error: "Acesso negado. Você não tem permissão para ver este aluno." });
    }
    next();
};
const autorizarProfissionalSaude = async (req, res, next) => {
    const { aluno_id } = req.body;
    const especialidadeDoProfissional = req.usuarioLogado.especialidade_id;

    try {
        const aluno = await pool.query('SELECT especialidades FROM aee_alunos WHERE id = $1', [aluno_id]);
        
        if (aluno.rows.length === 0) return res.status(404).json({ error: "Aluno não encontrado." });

        // Verifica se o ID da especialidade do profissional está na lista do aluno
        // (Considerando que salvamos as especialidades como IDs no banco)
        const temPermissao = aluno.rows[0].especialidades.includes(especialidadeDoProfissional);

        if (!temPermissao) {
            return res.status(403).json({ error: "Este aluno não está vinculado à sua especialidade." });
        }
        next();
    } catch (err) { res.status(500).send("Erro na autorização."); }
};

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
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
    destination: function (req, file, cb) {
        cb(null, 'uploads/evidencias/');
    },
    filename: function (req, file, cb) {
        // Formato: DATA-RA-NOMEOURIGINAL.ext
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Limite de 5MB por arquivo
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        if (extname) return cb(null, true);
        cb(new Error("Apenas imagens (JPG/PNG) ou PDFs são permitidos."));
    }
});

// --- DEFINIÇÃO DOS 3 APLICATIVOS ---
const appCadastro = express(); // Porta 3004
const appPainel = express();   // Porta 3005
const appPais = express();     // Porta 3011

[appCadastro, appPainel, appPais].forEach(app => {
    app.use(cors());
    app.use(express.json());
    app.use('/uploads', express.static('uploads'));
});
const agenda = await pool.query(
    "SELECT g.*, p.nome as profissional, e.nome as especialidade FROM aee_agendamentos g JOIN aee_profissionais_saude p ON g.profissional_id = p.id JOIN aee_especialidades e ON p.especialidade_id = e.id WHERE g.aluno_id = $1 AND g.data_hora >= NOW()", 
    [aluno_id]
);
const bcrypt = require('bcryptjs');
// Servir os arquivos estáticos de cada pasta
appCadastro.use(express.static('public_cadastro'));
appPainel.use(express.static('public_painel'));
appPais.use(express.static('public_pais'));
appProfissional.use(cors()); appProfissional.use(express.json());
appProfissional.use(express.static('public_profissional'));
appCadastro.use('/uploads', express.static('/var/www/aee/uploads'));
appPainel.use('/uploads', express.static('/var/www/aee/uploads'));
appPais.use('/uploads', express.static('/var/www/aee/uploads'));
appProfissional.use('/uploads', express.static('/var/www/aee/uploads'));

// ROTA DE UPLOAD (Usada pelas portas 3004 e 3012)
appCadastro.post('/api/upload-evidencia', upload.single('arquivo'), (req, res) => {
    if (!req.file) return res.status(400).send("Nenhum arquivo enviado.");
    // Retorna o caminho para ser salvo na tabela aee_atendimentos
    res.json({ url: `/uploads/evidencias/${req.file.filename}` });
});

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
        // 1. Busca o usuário no banco
        const result = await pool.query('SELECT * FROM aee_usuarios_equipe WHERE login = $1', [login]);
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: "Usuário não encontrado" });
        }

        const user = result.rows[0];

        // 2. Compara a senha digitada com o Hash do banco
        const senhaValida = await bcrypt.compare(senha, user.senha_hash);

        if (!senhaValida) {
            return res.status(401).json({ error: "Senha incorreta" });
        }

        // 3. EMISSÃO DO TOKEN (Aqui acontece a mágica)
        // Guardamos o ID, o NOME e o NÍVEL dentro do token
        const token = jwt.sign(
            { 
                id: user.id, 
                nome: user.nome, 
                nivel: 'tecnico',
                especialidade_id: user.especialidade_id 
            }, 
            SECRET_KEY, 
            { expiresIn: '8h' } // O técnico fica logado por 8 horas (um turno)
        );

        // 4. Resposta enviada ao navegador
        res.json({
            success: true,
            token: token, // O navegador vai guardar isso para as próximas requisições
            user: { id: user.id, nome: user.nome }
        });

    } catch (err) {
        res.status(500).json({ error: "Erro interno no servidor" });
    }
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
        const result = await pool.query('SELECT * FROM aee_usuarios_pais WHERE usuario = $1', [usuario]);
        
        if (result.rows.length === 0) return res.status(401).json({ error: "Acesso não encontrado" });

        const pai = result.rows[0];

        // Pais usam PIN simples, mas aqui comparamos com segurança
        if (pin !== pai.senha_pin) return res.status(401).json({ error: "PIN incorreto" });

        // EMISSÃO DO TOKEN PARA OS PAIS
        const token = jwt.sign(
            { id: pai.id, aluno_id: pai.aluno_id, nivel: 'pai' }, 
            SECRET_KEY, 
            { expiresIn: '5m' } // Pais ficam logados por 24h para facilitar o uso no celular
        );

        res.json({ success: true, token, aluno_id: pai.aluno_id });
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
appPais.get('/api/meu-filho/detalhes/:aluno_id', verificarToken, autorizarPai, async (req, res) => {
    // Se chegou aqui, é porque o token é válido E o aluno é o filho dele
    const result = await pool.query('SELECT * FROM aee_alunos WHERE id = $1', [req.params.aluno_id]);
    res.json(result.rows[0]);
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
    try {
        const result = await pool.query(
            `SELECT p.*, e.nome as especialidade_nome 
             FROM aee_profissionais_saude p 
             JOIN aee_especialidades e ON p.especialidade_id = e.id 
             WHERE p.login = $1`, [login]
        );

        if (result.rows.length === 0) return res.status(401).json({ error: "Utilizador não encontrado" });

        const user = result.rows[0];
        const senhaValida = await bcrypt.compare(senha, user.senha_hash);

        if (!senhaValida) return res.status(401).json({ error: "Palavra-passe incorreta" });

        // Retorna se é o primeiro acesso para o Front-end forçar a troca
        res.json({
            success: true,
            user: {
                id: user.id,
                nome: user.nome,
                especialidade: user.especialidade_nome,
                especialidade_id: user.especialidade_id,
                primeiro_acesso: user.primeiro_acesso
            }
        });
    } catch (err) { res.status(500).send(err.message); }
});

appProfissional.post('/api/profissional/forcar-troca', async (req, res) => {
    const { id, novaSenha } = req.body;
    try {
        const hash = await bcrypt.hash(novaSenha, 10);
        await pool.query(
            'UPDATE aee_profissionais_saude SET senha_hash = $1, primeiro_acesso = false WHERE id = $2',
            [hash, id]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
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

// Rota para Troca de Senha Obrigatória - Profissional (Porta 3012)
appProfissional.post('/api/profissional/alterar-senha', async (req, res) => {
    const { id, nova_senha } = req.body;

    try {
        // 1. Criptografa a nova senha
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(nova_senha, salt);

        // 2. Atualiza a senha e desativa a flag de primeiro acesso
        await pool.query(
            'UPDATE aee_profissionais_saude SET senha_hash = $1, primeiro_acesso = false WHERE id = $2',
            [hash, id]
        );

        res.json({ success: true, message: "Senha atualizada com sucesso!" });
    } catch (err) {
        res.status(500).json({ error: "Erro ao processar a troca de senha." });
    }
});

// Lançar atendimento com nota privada
appProfissional.post('/api/lancar-atendimento-saude', async (req, res) => {
    const { aluno_id, profissional_id, especialidade_id, status, evolucao_publica, observacao_clinica } = req.body;
    try {
        await pool.query(
            `INSERT INTO aee_atendimentos 
            (aluno_id, profissional_id, especialidade_id, status, evolucao, observacao_clinica, data_hora) 
            VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
            [aluno_id, profissional_id, especialidade_id, status, evolucao_publica, observacao_clinica]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

// Lançar atendimento com Observação Clínica (Sigilo Profissional)
appProfissional.post('/api/atendimento-clinico', verificarToken, autorizarProfissionalSaude, async (req, res) => {
    const { aluno_id, profissional_id, especialidade_id, status, evolucao_geral, observacao_privada } = req.body;
    try {
        await pool.query(
            `INSERT INTO aee_atendimentos 
            (aluno_id, profissional_id, especialidade_id, status, evolucao, observacao_clinica, data_hora) 
            VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
            [aluno_id, profissional_id, especialidade_id, status, evolucao_geral, observacao_privada]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

// Rota de Relatório de Frequência por Aluno
appPainel.get('/api/relatorio-frequencia/:aluno_id', async (req, res) => {
    const { aluno_id } = req.params;
    
    try {
        const query = `
            SELECT 
                a.nome_completo,
                a.ra,
                COUNT(at.id) as total_sessoes,
                COUNT(at.id) FILTER (WHERE at.status = 'Presente') as presencas,
                COUNT(at.id) FILTER (WHERE at.status = 'Falta Aluno') as faltas_aluno,
                CASE 
                    WHEN COUNT(at.id) > 0 THEN 
                        ROUND((COUNT(at.id) FILTER (WHERE at.status = 'Presente')::numeric / COUNT(at.id)) * 100, 1)
                    ELSE 0 
                END as percentual
            FROM aee_alunos a
            LEFT JOIN aee_atendimentos at ON a.id = at.aluno_id
            WHERE a.id = $1
            GROUP BY a.id, a.nome_completo, a.ra
        `;
        
        const result = await pool.query(query, [aluno_id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Aluno não encontrado ou sem registros." });
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Erro ao gerar relatório." });
    }
});
// Rota para Relatório por Profissional e Período (Porta 3005)
appPainel.get('/api/relatorio-produtividade', async (req, res) => {
    const { profissional_id, data_ini, data_fim } = req.query;

    try {
        const query = `
            SELECT 
                at.id, 
                at.data_hora, 
                at.status, 
                at.evolucao,
                al.nome_completo as aluno_nome,
                al.ra as aluno_ra
            FROM aee_atendimentos at
            JOIN aee_alunos al ON at.aluno_id = al.id
            WHERE at.profissional_id = $1 
              AND at.data_hora::date BETWEEN $2 AND $3
            ORDER BY at.data_hora DESC
        `;
        
        const result = await pool.query(query, [profissional_id, data_ini, data_fim]);
        
        // Calculando totalizadores no servidor para aliviar o front-end
        const total = result.rows.length;
        const presencas = result.rows.filter(r => r.status === 'Presente').length;
        const faltas = total - presencas;

        res.json({
            atendimentos: result.rows,
            resumo: { total, presencas, faltas }
        });
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar produtividade." });
    }
});
// Rota de Conformidade para Órgãos de Controle (Porta 3005)
appPainel.get('/api/relatorio-conformidade-mp', async (req, res) => {
    try {
        const query = `
            SELECT 
                (SELECT COUNT(*) FROM aee_alunos) as total_alunos_atendidos,
                (SELECT COUNT(*) FROM aee_atendimentos WHERE status = 'Presente') as total_sessoes_realizadas,
                (SELECT COUNT(DISTINCT especialidade_id) FROM aee_atendimentos) as especialidades_ativas,
                (SELECT COUNT(*) FROM aee_usuarios_pais WHERE ativo = true) as familias_conectadas,
                -- Métrica de Impacto: Evoluções positivas registradas
                (SELECT COUNT(*) FROM aee_atendimentos WHERE evolucao IS NOT NULL AND status = 'Presente') as evidencias_pedagogicas
            FROM aee_alunos LIMIT 1;
        `;
        
        const stats = await pool.query(query);
        const distribuicao = await pool.query(`
            SELECT e.nome as especialidade, COUNT(at.id) as total 
            FROM aee_atendimentos at 
            JOIN aee_especialidades e ON at.especialidade_id = e.id 
            WHERE at.status = 'Presente'
            GROUP BY e.nome
        `);

        res.json({
            indices: stats.rows[0],
            distribuicao: distribuicao.rows,
            data_geracao: new Date().toLocaleString('pt-BR'),
            instituicao: "SEMED - Gestão de Atendimento Especializado"
        });
    } catch (err) {
        res.status(500).json({ error: "Erro ao consolidar dados jurídicos." });
    }
});
// Rota para Gerar PDF Oficial para o MP (Porta 3005)
appPainel.get('/api/exportar-pdf-mp', async (req, res) => {
    try {
        // 1. Coleta os dados (Reutilizando a lógica de indicadores)
        const stats = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM aee_alunos) as total_alunos,
                (SELECT COUNT(*) FROM aee_atendimentos WHERE status = 'Presente') as total_sessoes,
                (SELECT COUNT(*) FROM aee_usuarios_pais WHERE ativo = true) as familias
        `);
        const s = stats.rows[0];
        const dataEmissao = new Date().toLocaleString('pt-BR');

        // 2. Inicia o Puppeteer
        const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
        const page = await browser.newPage();

        // 3. Define o conteúdo HTML (Formatado para A4 Oficial)
        const htmlContent = `
        <html>
        <head>
            <style>
                body { font-family: 'Arial', sans-serif; padding: 50px; color: #333; }
                .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
                .brasao { height: 80px; margin-bottom: 10px; }
                .titulo { text-transform: uppercase; font-size: 18px; font-weight: bold; }
                .subtitulo { font-size: 14px; color: #666; }
                table { width: 100%; border-collapse: collapse; margin: 25px 0; }
                th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                th { background-color: #f2f2f2; font-weight: bold; }
                .footer { margin-top: 100px; text-align: center; font-size: 12px; }
                .assinatura { width: 300px; border-top: 1px solid #000; margin: 0 auto; padding-top: 5px; }
            </style>
        </head>
        <body>
            <div class="header">
                <img src="file:///var/www/aee/public/brasao_prefeitura.png" class="brasao">
                <div class="titulo">Relatório de Conformidade AEE - SEMED</div>
                <div class="subtitulo">Documento de Transparência Institucional</div>
            </div>
            
            <p><strong>Data de Emissão:</strong> ${dataEmissao}</p>
            <p><strong>Assunto:</strong> Prestação de contas de atendimentos multidisciplinares.</p>

            <table>
                <thead><tr><th>Indicador de Impacto Social</th><th>Quantidade Consolidada</th></tr></thead>
                <tbody>
                    <tr><td>Alunos Ativos na Rede</td><td>${s.total_alunos}</td></tr>
                    <tr><td>Sessões Realizadas e Comprovadas</td><td>${s.total_sessoes}</td></tr>
                    <tr><td>Responsáveis com Acesso ao Portal</td><td>${s.familias}</td></tr>
                </tbody>
            </table>

            <p style="font-size: 13px; line-height: 1.6;">
                Certificamos para os devidos fins que os dados acima representam a totalidade dos registros 
                biométricos e pedagógicos realizados no sistema AEE Digital até a presente data, 
                estando em total conformidade com as diretrizes de transparência pública.
            </p>

            <div class="footer">
                <div class="assinatura">Gestor Responsável - SEMED</div>
                <p>Documento gerado eletronicamente. Autenticidade verificável via sistema.</p>
            </div>
        </body>
        </html>`;

        await page.setContent(htmlContent);

        // 4. Gera o PDF em formato A4
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
        });

        await browser.close();

        // 5. Envia o PDF para o navegador baixar
        res.set({
            'Content-Type': 'application/json',
            'Content-Disposition': 'attachment; filename=relatorio_mp.pdf',
            'Content-Length': pdfBuffer.length
        });
        res.send(pdfBuffer);

    } catch (err) {
        console.error(err);
        res.status(500).send("Erro ao gerar PDF.");
    }
});
// --- INICIALIZAÇÃO DOS SERVIDORES ---
appCadastro.listen(3004, () => console.log('✅ Cadastro AEE: Porta 3004'));
appPainel.listen(3005, () => console.log('✅ Painel Gestão AEE: Porta 3005'));
appPais.listen(3011, () => console.log('✅ Portal dos Pais: Porta 3011'));
appProfissional.listen(3012, () => console.log('✅ Portal Profissional: 3012'));
