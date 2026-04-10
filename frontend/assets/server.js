const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');

const SECRET_KEY = "Onwcems1*Gatosap2009*2WaGaSadti*1";
const pool = new Pool({
    user: 'postgres', host: 'localhost', database: 'omeq_db',
    password: 'Gatosap2009*2', port: 5432,
});

const appCadastro = express();     // 3004
const appPainel = express();       // 3005
const appPais = express();         // 3011
const appProfissional = express(); // 3012

[appCadastro, appPainel, appPais, appProfissional].forEach(app => {
    app.use(cors());
    app.use(express.json());
    app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
});

appCadastro.use(express.static('public_cadastro'));
appPainel.use(express.static('public_painel'));
appPais.use(express.static('public_pais'));
appProfissional.use(express.static('public_profissional'));

// Middleware de Autenticação
const verificarToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).json({ error: "Acesso negado." });
    try {
        const tokenLimpo = token.startsWith('Bearer ') ? token.slice(7) : token;
        req.usuarioLogado = jwt.verify(tokenLimpo, SECRET_KEY);
        next();
    } catch (err) { return res.status(401).json({ error: "Sessão expirada." }); }
};

// Login Unificado para Equipe (Cadastro e Painel)
const loginEquipe = async (req, res) => {
    const { login, senha } = req.body;
    try {
        // LOWER(login) para ignorar maiúsculas/minúsculas no nome de usuário
        const result = await pool.query(
            'SELECT * FROM aee_usuarios_equipe WHERE LOWER(login) = LOWER($1) AND ativo = true', 
            [login]
        );

        if (result.rows.length === 0) return res.status(401).json({ error: "Usuário não encontrado." });

        const usuario = result.rows[0];
        const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);

        if (!senhaValida) return res.status(401).json({ error: "Senha incorreta." });

        const token = jwt.sign(
            { id: usuario.id, nome: usuario.nome, tipo: 'equipe' }, 
            SECRET_KEY, { expiresIn: '8h' }
        );
        res.json({ success: true, token, user: { nome: usuario.nome } });
    } catch (err) {
        res.status(500).json({ error: "Erro interno no servidor" });
    }
};

appCadastro.post('/api/login', loginEquipe);
appPainel.post('/api/login', loginEquipe);

// --- Outras rotas do appCadastro ---
appCadastro.post('/api/alunos/cadastrar', verificarToken, async (req, res) => {
    const { nome, ra, escola } = req.body;
    const usuario_id = req.usuarioLogado.id; // Corrigido de req.user para req.usuarioLogado
    try {
        const novo = await pool.query(
            `INSERT INTO aee_alunos (nome_completo, ra, escola, criado_por_usuario_id) VALUES ($1, $2, $3, $4) RETURNING id`, 
            [nome, ra, escola, usuario_id]
        );
        res.json({ success: true, id: novo.rows[0].id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- ROTAS EXCLUSIVAS DO PAINEL (Porta 3005) ---

// 1. Rota de Contagem para os Cards
appPainel.get('/api/v2/painel/contagem-total', verificarToken, async (req, res) => {
    try {
        const alunos = await pool.query('SELECT count(*) FROM aee_alunos');
        const agendamentos = await pool.query("SELECT count(*) FROM aee_agendamentos WHERE status = 'Agendado'");
        const familias = await pool.query('SELECT count(*) FROM aee_usuarios_pais');
        const alertas = await pool.query("SELECT count(*) FROM aee_agendamentos WHERE data_hora < NOW() AND status = 'Agendado'");

        res.json({
            totalAlunos: alunos.rows[0].count,
            totalAgendamentos: agendamentos.rows[0].count,
            totalFamilias: familias.rows[0].count,
            totalAlertas: alertas.rows[0].count
        });
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar totais" });
    }
});

// 2. Rota de Detalhes de Alunos para o Modal
appPainel.get('/api/v2/painel/detalhes/alunos', verificarToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT ra, nome_completo, escola, data_cadastro as criado_em FROM aee_alunos ORDER BY nome_completo ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar lista de alunos" });
    }
});

// 3. Rota de Detalhes de Famílias para o Modal
appPainel.get('/api/v2/painel/detalhes/familias', verificarToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.usuario, a.nome_completo as aluno, p.ativo 
            FROM aee_usuarios_pais p 
            JOIN aee_alunos a ON p.aluno_id = a.id 
            ORDER BY a.nome_completo ASC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar lista de famílias" });
    }
});

// Listar logs de auditoria
appPainel.get('/api/v2/painel/auditoria', verificarToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT au.*, u.nome as usuario_nome, a.nome_completo as aluno_nome 
            FROM aee_auditoria au
            LEFT JOIN aee_usuarios_equipe u ON au.usuario_id = u.id
            LEFT JOIN aee_alunos a ON au.aluno_id = a.id
            ORDER BY au.data_hora DESC LIMIT 100
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar auditoria" });
    }
});

// Login para Pais (Usa PIN de 5 dígitos)
appPais.post('/api/login', async (req, res) => {
    const { login, senha } = req.body; // login = usuário, senha = pin
    try {
        const result = await pool.query(
            'SELECT * FROM aee_usuarios_pais WHERE LOWER(usuario) = LOWER($1) AND ativo = true',
            [login]
        );

        if (result.rows.length === 0 || result.rows[0].senha_pin !== senha) {
            return res.status(401).json({ error: "Usuário ou PIN incorretos." });
        }

        const usuario = result.rows[0];
        const token = jwt.sign(
            { id: usuario.id, aluno_id: usuario.aluno_id, tipo: 'pai' },
            SECRET_KEY, { expiresIn: '24h' }
        );
        res.json({ success: true, token });
    } catch (err) { res.status(500).json({ error: "Erro no servidor" }); }
});

// Buscar dados do aluno para os pais
appPais.get('/api/v2/familia/dados', verificarToken, async (req, res) => {
    const aluno_id = req.usuarioLogado.aluno_id;
    try {
        const aluno = await pool.query("SELECT nome_completo, escola, ra FROM aee_alunos WHERE id = $1", [aluno_id]);
        
        // Busca atendimentos realizados
        const atendimentos = await pool.query(`
            SELECT at.data_hora, e.nome as especialidade, at.evolucao, at.status
            FROM aee_atendimentos at
            JOIN aee_especialidades e ON at.especialidade_id = e.id
            WHERE at.aluno_id = $1 AND at.status = 'Concluído'
            ORDER BY at.data_hora DESC
        `, [aluno_id]);

        res.json({ 
            aluno: aluno.rows[0], 
            atendimentos: atendimentos.rows 
        });
    } catch (err) { res.status(500).json({ error: "Erro ao carregar dados da família" }); }
});

// Login Profissional
appProfissional.post('/api/login', async (req, res) => {
    const { login, senha } = req.body;
    try {
        const result = await pool.query(
            'SELECT * FROM aee_profissionais_saude WHERE LOWER(login) = LOWER($1) AND ativo = true',
            [login]
        );

        if (result.rows.length === 0) return res.status(401).json({ error: "Profissional não encontrado." });

        const profissional = result.rows[0];
        const senhaValida = await bcrypt.compare(senha, profissional.senha_hash);
        
        if (!senhaValida) return res.status(401).json({ error: "Senha incorreta." });

        const token = jwt.sign(
            { id: profissional.id, especialidade_id: profissional.especialidade_id, tipo: 'profissional' },
            SECRET_KEY, { expiresIn: '12h' }
        );
        res.json({ success: true, token, nome: profissional.nome });
    } catch (err) { res.status(500).json({ error: "Erro no servidor" }); }
});

// Registrar Atendimento (Evolução)
appProfissional.post('/api/atendimento/registrar', verificarToken, async (req, res) => {
    const { aluno_id, evolucao, status } = req.body;
    const profissional_id = req.usuarioLogado.id;
    const especialidade_id = req.usuarioLogado.especialidade_id;

    try {
        await pool.query(
            `INSERT INTO aee_atendimentos (aluno_id, especialidade_id, evolucao, status, data_hora) 
             VALUES ($1, $2, $3, $4, NOW())`,
            [aluno_id, especialidade_id, evolucao, status]
        );
        
        // Registrar na auditoria
        await pool.query(
            "INSERT INTO aee_auditoria (usuario_id, acao, aluno_id, detalhes) VALUES ($1, $2, $3, $4)",
            [null, 'EVOLUÇÃO REGISTRADA', aluno_id, `Profissional ID ${profissional_id} registrou atendimento.`]
        );

        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Erro ao registrar atendimento" }); }
});

// --- ROTAS DO PORTAL PROFISSIONAL (Porta 3012) ---

// 1. Listar Alunos da Especialidade do Profissional Logado
appProfissional.get('/api/v2/profissional/meus-alunos', verificarToken, async (req, res) => {
    const { especialidade_id } = req.usuarioLogado;
    try {
        // Busca alunos que já tiveram atendimento ou agendamento nessa especialidade
        // ou você pode listar todos para que o profissional escolha quem iniciar
        const result = await pool.query(`
            SELECT DISTINCT a.id, a.nome_completo, a.ra, a.escola 
            FROM aee_alunos a
            ORDER BY a.nome_completo ASC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar alunos" });
    }
});

// 2. Criar Novo Agendamento (Gera alerta para os pais)
appProfissional.post('/api/v2/profissional/agendar', verificarToken, async (req, res) => {
    const { aluno_id, data_hora, observacoes } = req.body;
    const profissional_id = req.usuarioLogado.id;

    try {
        const novoAgendamento = await pool.query(
            `INSERT INTO aee_agendamentos (profissional_id, aluno_id, data_hora, observacoes, status) 
             VALUES ($1, $2, $3, $4, 'Agendado') RETURNING id`,
            [profissional_id, aluno_id, data_hora, observacoes]
        );

        // Registro automático na auditoria para a equipe (Porta 3005) ver
        await pool.query(
            `INSERT INTO aee_auditoria (usuario_id, acao, aluno_id, detalhes) 
             VALUES (NULL, 'NOVO AGENDAMENTO', $1, $2)`,
            [aluno_id, `Agendado para ${data_hora} pelo Profissional ID ${profissional_id}`]
        );

        res.json({ success: true, id: novoAgendamento.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: "Erro ao criar agendamento" });
    }
});

// --- ROTA COMPLEMENTAR PARA OS PAIS (Porta 3011) ---
// Esta rota deve ser usada no index.html da pasta public_pais para mostrar o alerta
appPais.get('/api/v2/familia/alertas-pendentes', verificarToken, async (req, res) => {
    const aluno_id = req.usuarioLogado.aluno_id;
    try {
        const result = await pool.query(`
            SELECT ag.id, ag.data_hora, p.nome as profissional, e.nome as especialidade
            FROM aee_agendamentos ag
            JOIN aee_profissionais_saude p ON ag.profissional_id = p.id
            JOIN aee_especialidades e ON p.especialidade_id = e.id
            WHERE ag.aluno_id = $1 AND ag.status = 'Agendado'
            AND NOT EXISTS (
                SELECT 1 FROM aee_log_acesso_pais lap 
                WHERE lap.evento_id = ag.id AND lap.acao = 'CIENCIA_AGENDAMENTO'
            )
        `, [aluno_id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar alertas" });
    }
});

// --- ROTA DE FREQUÊNCIA (Porta 3012) ---
appProfissional.post('/api/v2/profissional/registrar-frequencia', verificarToken, async (req, res) => {
    const { agendamento_id, status, aluno_id } = req.body; // status: 'Compareceu' ou 'Falta'
    
    try {
        // Atualiza o status do agendamento
        await pool.query(
            'UPDATE aee_agendamentos SET status = $1 WHERE id = $2',
            [status, agendamento_id]
        );

        // Registra na Auditoria para o Painel de Gestão (3005)
        await pool.query(
            `INSERT INTO aee_auditoria (usuario_id, acao, aluno_id, detalhes) 
             VALUES (NULL, $1, $2, $3)`,
            [status === 'Compareceu' ? 'PRESENÇA REGISTRADA' : 'FALTA REGISTRADA', 
             aluno_id, 
             `O aluno ${status} ao agendamento ID ${agendamento_id}`]
        );

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Erro ao registrar frequência" });
    }
});

// Rota de Listagem Geral (Para ser usada no public_cadastro)
appCadastro.get('/api/v2/listagens/geral', verificarToken, async (req, res) => {
    try {
        const alunos = await pool.query('SELECT id, nome_completo, ra FROM aee_alunos ORDER BY nome_completo');
        const profs = await pool.query('SELECT id, nome, login FROM aee_profissionais_saude');
        const equipe = await pool.query('SELECT id, nome, login FROM aee_usuarios_equipe');
        
        res.json({ alunos: alunos.rows, profissionais: profs.rows, equipe: equipe.rows });
    } catch (err) { res.status(500).json({ error: "Erro na listagem" }); }
});

// --- ROTAS DE CADASTRO E LISTAGEM (Porta 3004) ---

// Cadastrar Aluno
appCadastro.post('/api/v2/alunos/cadastrar', verificarToken, async (req, res) => {
    const { nome, ra, escola } = req.body;
    try {
        const novo = await pool.query(
            "INSERT INTO aee_alunos (nome_completo, ra, escola, criado_por_usuario_id) VALUES ($1, $2, $3, $4) RETURNING id",
            [nome, ra, escola, req.usuarioLogado.id]
        );
        // Auditoria
        await pool.query("INSERT INTO aee_auditoria (usuario_id, acao, aluno_id, detalhes) VALUES ($1, $2, $3, $4)",
            [req.usuarioLogado.id, 'CADASTRO ALUNO', novo.rows[0].id, `Aluno ${nome} cadastrado.`]);
        
        res.json({ success: true, id: novo.rows[0].id });
    } catch (err) { res.status(500).json({ error: "Erro ao cadastrar aluno. Verifique se o RA já existe." }); }
});

// Cadastrar Profissional de Saúde (Com Hash de Senha)
appCadastro.post('/api/v2/profissionais/cadastrar', verificarToken, async (req, res) => {
    const { nome, login, senha, especialidade_id } = req.body;
    try {
        const hash = await bcrypt.hash(senha, 10);
        await pool.query(
            "INSERT INTO aee_profissionais_saude (nome, login, senha_hash, especialidade_id) VALUES ($1, $2, $3, $4)",
            [nome, login, hash, especialidade_id]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Erro ao cadastrar profissional." }); }
});

// Vincular Pai ao Aluno (Gera o PIN de acesso)
appCadastro.post('/api/v2/pais/cadastrar', verificarToken, async (req, res) => {
    const { aluno_id, usuario, senha_pin } = req.body;
    try {
        await pool.query(
            "INSERT INTO aee_usuarios_pais (aluno_id, usuario, senha_pin) VALUES ($1, $2, $3)",
            [aluno_id, usuario, senha_pin]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Erro ao criar acesso para família." }); }
});

// Listagem Geral para o Portal de Cadastro
appCadastro.get('/api/v2/listagem/completa', verificarToken, async (req, res) => {
    try {
        const alunos = await pool.query("SELECT id, nome_completo, ra, escola FROM aee_alunos ORDER BY nome_completo");
        const profissionais = await pool.query("SELECT p.id, p.nome, e.nome as especialidade FROM aee_profissionais_saude p JOIN aee_especialidades e ON p.especialidade_id = e.id");
        res.json({ alunos: alunos.rows, profissionais: profissionais.rows });
    } catch (err) { res.status(500).json({ error: "Erro ao buscar listagens." }); }
});

// Rota para Gerar Relatório PDF (A4)
appCadastro.post('/api/v2/relatorio/gerar', verificarToken, async (req, res) => {
    const { tabela } = req.body;
    
    // Mapeamento de títulos e colunas para ordenação
    const config = {
        alunos: { titulo: 'Relatório Geral de Alunos (AEE)', tabelaDB: 'aee_alunos', ordem: 'nome_completo' },
        pais: { titulo: 'Relatório de Acessos: Pais e Responsáveis', tabelaDB: 'aee_usuarios_pais', ordem: 'usuario' },
        profissionais: { titulo: 'Relatório de Profissionais de Saúde', tabelaDB: 'aee_profissionais_saude', ordem: 'nome' },
        especialidades: { titulo: 'Relatório de Especialidades Médicas', tabelaDB: 'aee_especialidades', ordem: 'nome' },
        usuarios: { titulo: 'Relatório de Usuários da Equipe', tabelaDB: 'aee_usuarios_equipe', ordem: 'nome' }
    };

    const sel = config[tabela];

    try {
        const result = await pool.query(`SELECT * FROM ${sel.tabelaDB} WHERE ativo = true ORDER BY ${sel.ordem} ASC`);
        const registros = result.rows;

        const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
        const page = await browser.newPage();

        // Conteúdo HTML do PDF
        const dataEmissao = new Date().toLocaleString('pt-BR');
        let htmlContent = `
            <html>
            <head>
                <style>
                    body { font-family: sans-serif; margin: 0; padding: 0; }
                    .header { display: flex; align-items: flex-start; margin-bottom: 20px; }
                    .logo { width: 80px; height: auto; }
                    .title { text-align: center; width: 100%; font-size: 18px; font-weight: bold; color: #004587; margin-top: 10px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
                    th { background-color: #f2f2f2; border: 1px solid #ddd; padding: 8px; text-align: left; }
                    td { border: 1px solid #ddd; padding: 8px; }
                    .footer { text-align: center; margin-top: 30px; font-size: 10px; color: #666; }
                </style>
            </head>
            <body>
                <div class="header">
                    <img src="http://localhost:3004/logap.png" class="logo">
                </div>
                <div class="title">${sel.titulo}</div>
                <table>
                    <thead>
                        <tr>
                            <th>Registro / Nome</th>
                            <th>Detalhes / Vínculo</th>
                            <th>Data Cadastro</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${registros.map(r => `
                            <tr>
                                <td>${r.nome_completo || r.nome || r.usuario}</td>
                                <td>${r.ra || r.especialidade || r.escola || '-'}</td>
                                <td>${new Date(r.criado_em).toLocaleDateString('pt-BR')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="footer">
                    Queimados/RJ, ${dataEmissao}
                </div>
            </body>
            </html>
        `;

        await page.setContent(htmlContent);
        const pdfBuffer = await page.pdf({
            format: 'A4',
            margin: { top: '1cm', bottom: '1cm', left: '1cm', right: '1cm' },
            printBackground: true
        });

        await browser.close();

        res.contentType("application/pdf");
        res.send(pdfBuffer);

    } catch (err) {
        console.error(err);
        res.status(500).send("Erro ao gerar PDF");
    }
});

// Inicialização dos Servidores
appCadastro.listen(3004, () => console.log("Cadastro rodando na 3004"));
appPainel.listen(3005, () => console.log("Painel rodando na 3005"));
appPais.listen(3011, () => console.log("Portal Pais rodando na 3011"));
appProfissional.listen(3012, () => console.log("Profissional rodando na 3012"));
