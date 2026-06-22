const express = require('express');
const session = require('express-session');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = 3036;

// 1. CONEXÃO COM O BANCO DE DADOS
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'ti',
  password: 'Gatosap2009*2',
  port: 5432,
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. GERENCIADOR DE SESSÃO
app.use(session({
    secret: 'semed_ti_secret_key_2026',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 1000 * 60 * 60 * 4 }
}));

// 3. MIDDLEWARE DE PROTEÇÃO DE ROTAS (Bloqueia quem não está logado)
const verificarAutenticacao = (req, res, next) => {
    if (!req.session.usuario) {
        return res.redirect('/login');
    }
    req.usuarioLogado = req.session.usuario;
    res.locals.usuarioLogado = req.session.usuario;
    next();
};

// ====================================================================
// 4. ROTAS DE AUTENTICAÇÃO (SESSÃO REAL)
// ====================================================================
app.get('/login', (req, res) => {
    if (req.session.usuario) return res.redirect('/');
    res.render('login', { erro: null }); // Criaremos essa view simples já já
});

app.post('/api/v2/auth/login', async (req, res) => {
    const { nome, senha } = req.body; // Agora recebe 'nome' em vez de 'email'
    try {
        // Busca estritamente pelo nome do usuário (ignorando maiúsculas/minúsculas)
        const busca = await pool.query('SELECT * FROM usuarios WHERE LOWER(nome) = LOWER($1)', [nome.trim()]);
        
        if (busca.rows.length === 0 || busca.rows[0].senha !== senha) {
            return res.render('login', { erro: "Nome de usuário ou senha incorretos." });
        }
        
        const user = busca.rows[0];
        req.session.usuario = {
            id: user.id,
            nome: user.nome,
            perfil: user.perfil, 
            setor_id: user.setor_id
        };
        res.redirect('/');
    } catch (e) {
        console.error(e);
        res.render('login', { erro: "Falha interna no servidor." });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => { res.redirect('/login'); });
});

// ====================================================================
// 5. ROTAS PROTEGIDAS (DASHBOARD PRINCIPAL)
// ====================================================================
app.get('/', verificarAutenticacao, async (req, res) => {
    const { perfil, setor_id } = req.usuarioLogado;
    try {
        let filtroSetorContrato = '';
        let filtroSetorParcela = '';
        let params = [];

        // Garante que se o ADMIN tiver setor_id nulo ou inválido, a query não quebre
        const idBuscaConfig = (perfil === 'ADMIN' && !setor_id) ? 1 : setor_id;

        const configSetorBusca = await pool.query(
            'SELECT * FROM configuracoes_setores WHERE setor_id = $1', 
            [idBuscaConfig]
        );

        const configSetor = configSetorBusca.rows[0] || {
            dias_alerta_parcela: 30,
            dias_alerta_contrato: 45,
            alerta_apostilamento_ativo: true
        };

        if (perfil !== 'ADMIN') {
            filtroSetorContrato = 'WHERE c.setor_id = $1';
            filtroSetorParcela = 'AND c.setor_id = $1';
            params.push(setor_id);
        }

        const queryContratos = `
            SELECT c.*, f.razao_social as fornecedor, cat.nome as categoria
            FROM contratos c
            JOIN fornecedores f ON c.fornecedor_id = f.id
            JOIN categorias cat ON c.categoria_id = cat.id
            ${filtroSetorContrato} ORDER BY c.data_inicio DESC;
        `;
        const listaContratos = await pool.query(queryContratos, params);

        // CORREÇÃO CIRÚRGICA: Uso de ($1 * INTERVAL '1 day') evita o erro de conversão de string no PostgreSQL
        const parcelasCriticas = await pool.query(`
            SELECT p.*, c.numero_contrato, f.razao_social as fornecedor 
            FROM parcelas p
            JOIN contratos c ON p.contrato_id = c.id
            JOIN fornecedores f ON c.fornecedor_id = f.id
            WHERE p.status = 'Em aberto' 
            AND p.data_vencimento <= CURRENT_DATE + ($1 * INTERVAL '1 day') ${filtroSetorParcela}
            AND p.id NOT IN (SELECT contrato_id FROM contratos_cienca_alertas WHERE setor_id = ${perfil === 'ADMIN' ? 0 : (setor_id || 0)})
            ORDER BY p.data_vencimento ASC;
        `, [parseInt(configSetor.dias_alerta_parcela), ...(perfil !== 'ADMIN' ? [setor_id] : [])]);

        const fornecedores = await pool.query('SELECT id, razao_social FROM fornecedores WHERE ativo = true ORDER BY razao_social');
        const categorias = await pool.query('SELECT id, nome FROM categorias ORDER BY nome');
        const setores = await pool.query('SELECT id, nome, sigla FROM setores WHERE ativo = true ORDER BY nome');
        
        let listaUsuarios = [];
        if (perfil === 'ADMIN') {
            listaUsuarios = await pool.query('SELECT u.*, s.sigla as setor_sigla FROM usuarios u JOIN setores s ON u.setor_id = s.id');
        } else {
            listaUsuarios = await pool.query('SELECT u.*, s.sigla as setor_sigla FROM usuarios u JOIN setores s ON u.setor_id = s.id WHERE u.setor_id = $1', [setor_id]);
        }

        let queryAuditoria = '';
        let paramsAuditoria = [];
        if (perfil === 'ADMIN') {
            queryAuditoria = `
                SELECT id, usuario_nome, criado_em, tabela_alterada as tabela_afetada, registro_id, campo_alterado as acao, 
                       ('Campo: ' || campo_alterado || ' | Antigo: ' || valor_antigo || ' | Novo: ' || valor_novo) as detalhes
                FROM historico_auditoria
                ORDER BY criado_em DESC
            `;
        } else {
            queryAuditoria = `
                SELECT h.id, h.usuario_nome, h.criado_em, h.tabela_alterada as text, h.registro_id, h.campo_alterado as acao, 
                       ('Campo: ' || h.campo_alterado || ' | Antigo: ' || h.valor_antigo || ' | Novo: ' || h.valor_novo) as detalhes
                FROM historico_auditoria h
                JOIN usuarios u ON h.usuario_id = u.id
                WHERE u.setor_id = $1
                ORDER BY h.criado_em DESC
            `;
            paramsAuditoria.push(setor_id);
        }
        const listaAuditoria = await pool.query(queryAuditoria, paramsAuditoria);

        res.render('contratos_dashboard', {
            configSetor: configSetor,
            contratos: listaContratos.rows,
            alertasFinanceiros: parcelasCriticas.rows,
            fornecedores: fornecedores.rows,
            categorias: categorias.rows,
            setores: setores.rows,
            usuariosCadastrados: listaUsuarios.rows,
            historicoAuditoria: listaAuditoria.rows
        });
    } catch (err) {
        console.error("FALHA CRÍTICA NA ROTA DASHBOARD:", err);
        res.status(500).send("Erro operacional.");
    }
});

// ====================================================================
// 6. CRUD DE USUÁRIOS E SETORES (COM REGRAS DE PERFIL RIGOROSAS)
// ====================================================================

// CADASTRO DE USUÁRIOS
app.post('/usuarios/salvar', verificarAutenticacao, async (req, res) => {
    const { perfil: criadorPerfil, setor_id: criadorSetorId } = req.usuarioLogado;
    const { nome, email, senha, perfilNovo, setorNovoId } = req.body;

    if (criadorPerfil === 'VISUALIZADOR') return res.status(403).send("Permissão negada.");

    // Trava de Regra: ADMIN não cria outro ADMIN
    if (criadorPerfil === 'ADMIN' && perfilNovo === 'ADMIN') {
        return res.status(400).send("Administradores não podem criar outros Administradores.");
    }

    // Trava de Regra: OPERADOR só cria Operador/Visualizador para o PRÓPRIO setor
    let setorFinal = setorNovoId;
    if (criadorPerfil === 'OPERADOR') {
        if (perfilNovo === 'ADMIN') return res.status(403).send("Operadores não criam administradores.");
        setorFinal = criadorSetorId; // Força o setor dele
    }

    try {
        await pool.query('INSERT INTO usuarios (nome, email, senha, perfil, setor_id) VALUES ($1, $2, $3, $4, $5)',
            [nome, email, senha, perfilNovo, setorFinal]);
        res.redirect('/');
    } catch (e) { res.status(500).send(e.message); }
});

// CADASTRO DE SETORES (EXCLUSIVO ADMIN)
app.post('/setores/salvar', verificarAutenticacao, async (req, res) => {
    if (req.usuarioLogado.perfil !== 'ADMIN') return res.status(403).send("Acesso restrito ao Administrador Geral.");
    const { nome, sigla } = req.body;
    try {
        await pool.query('INSERT INTO setores (nome, sigla) VALUES ($1, $2)', [nome, sigla]);
        res.redirect('/');
    } catch (e) { res.status(500).send(e.message); }
});

// CADASTRO DE CATEGORIAS (Acessível por OPERADOR e ADMIN)
app.post('/categorias/salvar', verificarAutenticacao, async (req, res) => {
    if (req.usuarioLogado.perfil === 'VISUALIZADOR') return res.status(403).send("Acesso negado.");
    const { nome } = req.body;
    try {
        await pool.query('INSERT INTO categorias (nome) VALUES ($1)', [nome]);
        res.redirect('/');
    } catch (e) { 
        res.status(500).send("Erro ao salvar categoria: " + e.message); 
    }
});

// CADASTRO DE FORNECEDORES (Acessível por OPERADOR e ADMIN)
app.post('/fornecedores/salvar', verificarAutenticacao, async (req, res) => {
    if (req.usuarioLogado.perfil === 'VISUALIZADOR') return res.status(403).send("Acesso negado.");
    const { razao_social, cnpj, contato_nome, telefone, email } = req.body;
    try {
        await pool.query(`
            INSERT INTO fornecedores (razao_social, cnpj, contato_nome, telefone, email, ativo) 
            VALUES ($1, $2, $3, $4, $5, true)
        `, [razao_social, cnpj, contato_nome, telefone, email]);
        res.redirect('/');
    } catch (e) { 
        res.status(500).send("Erro ao salvar fornecedor: " + e.message); 
    }
});

// ROTA AUXILIAR: BUSCAR DADOS DE UM FORNECEDOR ESPECÍFICO
app.get('/fornecedores/:id', verificarAutenticacao, async (req, res) => {
    try {
        const busca = await pool.query('SELECT * FROM fornecedores WHERE id = $1', [req.params.id]);
        if (busca.rows.length === 0) return res.status(404).json({ erro: "Não encontrado" });
        res.json(busca.rows[0]);
    } catch (e) { res.status(500).json({ erro: e.message }); }
});

// ROTA AUXILIAR: BUSCAR DADOS DE UMA CATEGORIA ESPECÍFICA
app.get('/categorias/:id', verificarAutenticacao, async (req, res) => {
    try {
        const busca = await pool.query('SELECT * FROM categorias WHERE id = $1', [req.params.id]);
        if (busca.rows.length === 0) return res.status(404).json({ erro: "Não encontrado" });
        res.json(busca.rows[0]);
    } catch (e) { res.status(500).json({ erro: e.message }); }
});

// ROTA: ATUALIZAR FORNECEDOR COM COMPARAÇÃO E AUDITORIA MATRIZ (AJAX)
app.post('/fornecedores/atualizar', verificarAutenticacao, async (req, res) => {
    // Bloqueia se o perfil for apenas de visualização
    if (req.usuarioLogado.perfil === 'VISUALIZADOR') {
        return res.status(403).json({ erro: "Acesso negado." });
    }

    const { idEditar, razao_social, contato_nome, telefone, email } = req.body;
    
    if (!idEditar) return res.status(400).json({ erro: "ID do registro não informado." });

    // Inicia um cliente de transação do PostgreSQL para integridade dos dados
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Busca o estado atual (antigo) do registro antes da modificação
        const estadoAntigoBusca = await client.query('SELECT * FROM fornecedores WHERE id = $1', [idEditar]);
        if (estadoAntigoBusca.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ erro: "Fornecedor não encontrado." });
        }
        const antigo = estadoAntigoBusca.rows[0];

        // 2. Coleta os dados do operador logado para carimbar na auditoria
        // Buscamos a sigla do setor do usuário para o log ficar perfeito
        const setorBusca = await client.query('SELECT sigla FROM setores WHERE id = $1', [req.usuarioLogado.setor_id]);
        const setorSigla = setorBusca.rows.length > 0 ? setorBusca.rows[0].sigla : 'N/A';

        // 3. Mapeamento de campos que serão monitorados para a auditoria
        const camposParaVerificar = [
            { campo: 'razao_social', antigoValor: antigo.razao_social, novoValor: razao_social },
            { campo: 'contato_nome', antigoValor: antigo.contato_nome || '', novoValor: contato_nome || '' },
            { campo: 'telefone', antigoValor: antigo.telefone || '', novoValor: telefone || '' },
            { campo: 'email', antigoValor: antigo.email || '', novoValor: email || '' }
        ];

        // 4. Varre os campos comparando-os e inserindo na tabela de auditoria se houver divergência
        for (const item of camposParaVerificar) {
            if (String(item.antigoValor).trim() !== String(item.novoValor).trim()) {
                await client.query(`
                    INSERT INTO historico_auditoria 
                    (usuario_id, usuario_nome, setor_sigla, tabela_alterada, registro_id, campo_alterado, valor_antigo, valor_novo)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `, [
                    req.usuarioLogado.id,
                    req.usuarioLogado.nome,
                    setorSigla,
                    'fornecedores',
                    idEditar,
                    item.campo,
                    item.antigoValor,
                    item.novoValor
                ]);
            }
        }

        // 5. Aplica a atualização de fato na tabela principal de fornecedores
        await client.query(`
            UPDATE fornecedores 
            SET razao_social = $1, contato_nome = $2, telefone = $3, email = $4
            WHERE id = $5
        `, [razao_social, contato_nome, telefone, email, idEditar]);

        // Finaliza e consolida a transação com segurança
        await client.query('COMMIT');
        res.json({ sucesso: true });

    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Erro na auditoria/atualização:", e);
        res.status(500).json({ erro: "Erro interno: " + e.message });
    } finally {
        client.release(); // Libera o cliente de volta para o pool de conexões
    }
});

// ROTA: ATUALIZAR CATEGORIA COM COMPARAÇÃO E AUDITORIA MATRIZ (AJAX)
app.post('/categorias/atualizar', verificarAutenticacao, async (req, res) => {
    if (req.usuarioLogado.perfil === 'VISUALIZADOR') {
        return res.status(403).json({ erro: "Acesso negado." });
    }

    const { idEditar, nome } = req.body;
    
    if (!idEditar) return res.status(400).json({ erro: "ID da categoria não informado." });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Busca o estado antigo da categoria
        const estadoAntigoBusca = await client.query('SELECT * FROM categorias WHERE id = $1', [idEditar]);
        if (estadoAntigoBusca.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ erro: "Categoria não encontrada." });
        }
        const antigo = estadoAntigoBusca.rows[0];

        // 2. Coleta os dados do setor do operador logado
        const setorBusca = await client.query('SELECT sigla FROM setores WHERE id = $1', [req.usuarioLogado.setor_id]);
        const setorSigla = setorBusca.rows.length > 0 ? setorBusca.rows[0].sigla : 'N/A';

        // 3. Compara o campo 'nome' para verificar se houve alteração real
        if (String(antigo.nome).trim() !== String(nome).trim()) {
            await client.query(`
                INSERT INTO historico_auditoria 
                (usuario_id, usuario_nome, setor_sigla, tabela_alterada, registro_id, campo_alterado, valor_antigo, valor_novo)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                req.usuarioLogado.id,
                req.usuarioLogado.nome,
                setorSigla,
                'categorias',
                idEditar,
                'nome',
                antigo.nome,
                nome
            ]);
        }

        // 4. Aplica a atualização definitiva na tabela original
        await client.query('UPDATE categorias SET nome = $1 WHERE id = $2', [nome, idEditar]);

        await client.query('COMMIT');
        res.json({ sucesso: true });

    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Erro na auditoria de categorias:", e);
        res.status(500).json({ erro: "Erro interno: " + e.message });
    } finally {
        client.release();
    }
});

// ====================================================================
// PARTE 5: ENDPOINTS DE LEITURA E AUDITORIA PARA USUÁRIOS E SETORES
// ====================================================================

// A) LEITURA RÁPIDA DE USUÁRIO
app.get('/usuarios/:id', verificarAutenticacao, async (req, res) => {
    try {
        const busca = await pool.query('SELECT id, nome, email, senha, perfil, setor_id FROM usuarios WHERE id = $1', [req.params.id]);
        if (busca.rows.length === 0) return res.status(404).json({ erro: "Não encontrado" });
        res.json(busca.rows[0]);
    } catch (e) { res.status(500).json({ erro: e.message }); }
});

// B) LEITURA RÁPIDA DE SETOR
app.get('/setores/:id', verificarAutenticacao, async (req, res) => {
    try {
        const busca = await pool.query('SELECT id, nome, sigla FROM setores WHERE id = $1', [req.params.id]);
        if (busca.rows.length === 0) return res.status(404).json({ erro: "Não encontrado" });
        res.json(busca.rows[0]);
    } catch (e) { res.status(500).json({ erro: e.message }); }
});

// C) ATUALIZAR USUÁRIO COM AUDITORIA MATRIZ
app.post('/usuarios/atualizar', verificarAutenticacao, async (req, res) => {
    if (req.usuarioLogado.perfil === 'VISUALIZADOR') return res.status(403).json({ erro: "Acesso negado." });

    const { idEditar, nome, email, senha, perfilNovo, setorNovoId } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const estadoAntigo = await client.query('SELECT * FROM usuarios WHERE id = $1', [idEditar]);
        if (estadoAntigo.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ erro: "Usuário não encontrado." });
        }
        const antigo = estadoAntigo.rows[0];

        const setorOperador = await client.query('SELECT sigla FROM setores WHERE id = $1', [req.usuarioLogado.setor_id]);
        const setorSigla = setorOperador.rows.length > 0 ? setorOperador.rows[0].sigla : 'N/A';

        // Mapeamento de auditoria
        const campos = [
            { campo: 'nome', antigo: antigo.nome, novo: nome },
            { campo: 'email', antigo: antigo.email, novo: email },
            { campo: 'perfil', antigo: antigo.perfil, novo: perfilNovo },
            { campo: 'setor_id', antigo: antigo.setor_id, novo: parseInt(setorNovoId) }
        ];

        for (const item of campos) {
            if (String(item.antigo).trim() !== String(item.novo).trim()) {
                await client.query(`
                    INSERT INTO historico_auditoria (usuario_id, usuario_nome, setor_sigla, tabela_alterada, registro_id, campo_alterado, valor_antigo, valor_novo)
                    VALUES ($1, $2, $3, 'usuarios', $4, $5, $6, $7)
                `, [req.usuarioLogado.id, req.usuarioLogado.nome, setorSigla, idEditar, item.campo, item.antigo, item.novo]);
            }
        }

        // Caso a senha tenha sido alterada, gera um log protegido por segurança
        if (antigo.senha !== senha) {
            await client.query(`
                INSERT INTO historico_auditoria (usuario_id, usuario_nome, setor_sigla, tabela_alterada, registro_id, campo_alterado, valor_antigo, valor_novo)
                VALUES ($1, $2, $3, 'usuarios', $4, 'senha', '[ALTERADA]', '[ALTERADA]')
            `, [req.usuarioLogado.id, req.usuarioLogado.nome, setorSigla, idEditar]);
        }

        await client.query(`
            UPDATE usuarios SET nome = $1, email = $2, senha = $3, perfil = $4, setor_id = $5 WHERE id = $6
        `, [nome, email, senha, perfilNovo, parseInt(setorNovoId), idEditar]);

        await client.query('COMMIT');
        res.json({ sucesso: true });
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ erro: e.message });
    } finally { client.release(); }
});

// D) ATUALIZAR SETOR COM AUDITORIA MATRIZ
app.post('/setores/atualizar', verificarAutenticacao, async (req, res) => {
    if (req.usuarioLogado.perfil !== 'ADMIN') return res.status(403).json({ erro: "Acesso restrito ao Administrador Geral." });

    const { idEditar, nome, sigla } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const estadoAntigo = await client.query('SELECT * FROM setores WHERE id = $1', [idEditar]);
        if (estadoAntigo.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ erro: "Setor não encontrado." });
        }
        const antigo = estadoAntigo.rows[0];

        const campos = [
            { campo: 'nome', antigo: antigo.nome, novo: nome },
            { campo: 'sigla', antigo: antigo.sigla, novo: sigla }
        ];

        for (const item of campos) {
            if (String(item.antigo).trim() !== String(item.novo).trim()) {
                await client.query(`
                    INSERT INTO historico_auditoria (usuario_id, usuario_nome, setor_sigla, tabela_alterada, registro_id, campo_alterado, valor_antigo, valor_novo)
                    VALUES ($1, $2, 'ADMIN', 'setores', $4, $5, $6, $7)
                `, [req.usuarioLogado.id, req.usuarioLogado.nome, idEditar, item.campo, item.antigo, item.novo]);
            }
        }

        await client.query(`
            UPDATE setores SET nome = $1, sigla = $2 WHERE id = $3
        `, [nome, sigla, idEditar]);

        await client.query('COMMIT');
        res.json({ sucesso: true });
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ erro: e.message });
    } finally { client.release(); }
});

// ====================================================================
// ETAPA FINAL: ENDPOINTS DE LEITURA E AUDITORIA PARA CONTRATOS
// ====================================================================

// A) LEITURA RÁPIDA DE CONTRATO (FORMATANDO A DATA PARA O INPUT DATE)
app.get('/contratos/buscar/:id', verificarAutenticacao, async (req, res) => {
    try {
        const busca = await pool.query(`
            SELECT id, numero_contrato, categoria_id, fornecedor_id, objeto_resumido, 
                   valor_total, to_char(data_inicio, 'YYYY-MM-DD') as data_inicio, 
                   vigencia_meses, periodicidade_pagamento, setor_id,
                   necessita_apostilamento, to_char(data_apostilamento, 'YYYY-MM-DD') as data_apostilamento
            FROM contratos WHERE id = $1
        `, [req.params.id]);
        
        if (busca.rows.length === 0) return res.status(404).json({ erro: "Contrato não encontrado" });
        res.json(busca.rows[0]);
    } catch (e) { res.status(500).json({ erro: e.message }); }
});

// B) ATUALIZAR CONTRATO COM COMPARADOR E AUDITORIA MATRIZ
app.post('/contratos/atualizar', verificarAutenticacao, async (req, res) => {
    if (req.usuarioLogado.perfil === 'VISUALIZADOR') return res.status(403).json({ erro: "Acesso negado." });

    const { idEditar, numero_contrato, categoria_id, fornecedor_id, objeto_resumido, valor_total, data_inicio, vigencia_meses, periodicidade_pagamento, setor_id, necessita_apostilamento, data_apostilamento } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Busca o estado antigo antes de salvar
        const estadoAntigo = await client.query('SELECT * FROM contratos WHERE id = $1', [idEditar]);
        if (estadoAntigo.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ erro: "Contrato inexistente." });
        }
        const antigo = estadoAntigo.rows[0];

        // 2. Busca a sigla do setor do operador para o log
        const setorOperador = await client.query('SELECT sigla FROM setores WHERE id = $1', [req.usuarioLogado.setor_id]);
        const setorSigla = setorOperador.rows.length > 0 ? setorOperador.rows[0].sigla : 'N/A';

        // Formata a data antiga para comparação textual idêntica ('YYYY-MM-DD')
        const dataAntigaFormatada = new Date(antigo.data_inicio).toISOString().split('T')[0];

        // 3. Mapeamento de todos os campos críticos do contrato
        const campos = [
            { campo: 'numero_contrato', antigo: antigo.numero_contrato, novo: numero_contrato },
            { campo: 'categoria_id', antigo: antigo.categoria_id, novo: parseInt(categoria_id) },
            { campo: 'fornecedor_id', antigo: antigo.fornecedor_id, novo: parseInt(fornecedor_id) },
            { campo: 'objeto_resumido', antigo: antigo.objeto_resumido, novo: objeto_resumido },
            { campo: 'valor_total', antigo: parseFloat(antigo.valor_total).toFixed(2), novo: parseFloat(valor_total).toFixed(2) },
            { campo: 'data_inicio', antigo: dataAntigaFormatada, novo: data_inicio },
            { campo: 'vigencia_meses', antigo: antigo.vigencia_meses, novo: parseInt(vigencia_meses) },
            { campo: 'periodicidade_pagamento', antigo: antigo.periodicidade_pagamento, novo: periodicidade_pagamento },
            { campo: 'setor_id', antigo: antigo.setor_id, novo: parseInt(setor_id) },
            { campo: 'necessita_apostilamento', antigo: antigo.necessita_apostilamento, novo: necessita_apostilamento === true },
            { campo: 'data_apostilamento', antigo: antigo.data_apostilamento ? new Date(antigo.data_apostilamento).toISOString().split('T')[0] : '', novo: data_apostilamento || '' }
        ];

        // 4. Varredura e gravação individual de cada campo modificado
        for (const item of campos) {
            if (String(item.antigo).trim() !== String(item.novo).trim()) {
                await client.query(`
                    INSERT INTO historico_auditoria (usuario_id, usuario_nome, setor_sigla, tabela_alterada, registro_id, campo_alterado, valor_antigo, valor_novo)
                    VALUES ($1, $2, $3, 'contratos', $4, $5, $6, $7)
                `, [req.usuarioLogado.id, req.usuarioLogado.nome, setorSigla, idEditar, item.campo, String(item.antigo), String(item.novo)]);
            }
        }

        // 5. Executa a atualização definitiva dos dados
        await client.query(`
            UPDATE contratos 
            SET numero_contrato = $1, categoria_id = $2, fornecedor_id = $3, objeto_resumido = $4, 
                valor_total = $5, data_inicio = $6, vigencia_meses = $7, periodicidade_pagamento = $8, 
                setor_id = $9, necessita_apostilamento = $10, data_apostilamento = $11
            WHERE id = $12
        `, [
            numero_contrato, parseInt(categoria_id), parseInt(fornecedor_id), objeto_resumido, 
            parseFloat(valor_total), data_inicio, parseInt(vigencia_meses), periodicidade_pagamento, 
            parseInt(setor_id), necessita_apostilamento === true, data_apostilamento || null, idEditar
        ]);
        await client.query('COMMIT');
        res.json({ sucesso: true });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Erro na auditoria de contrato:", e);
        res.status(500).json({ erro: e.message });
    } finally { client.release(); }
});

// ROTA: USUÁRIO LOGADO ALTERAR A PRÓPRIA SENHA (AJAX)
app.post('/api/v2/usuario/alterar-senha', verificarAutenticacao, async (req, res) => {
    const { senhaNova } = req.body;
    const usuarioId = req.usuarioLogado.id;

    if (!senhaNova || senhaNova.trim().length < 4) {
        return res.status(400).json({ erro: "A senha deve conter pelo menos 4 caracteres." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Busca a sigla do setor para a auditoria
        const setorBusca = await client.query('SELECT sigla FROM setores WHERE id = $1', [req.usuarioLogado.setor_id]);
        const setorSigla = setorBusca.rows.length > 0 ? setorBusca.rows[0].sigla : 'N/A';

        // Registra a alteração na auditoria (protegido, sem expor a senha em texto plano)
        await client.query(`
            INSERT INTO historico_auditoria (usuario_id, usuario_nome, setor_sigla, tabela_alterada, registro_id, campo_alterado, valor_antigo, valor_novo)
            VALUES ($1, $2, $3, 'usuarios', $4, 'senha', '[AUTOPROTECÃO]', '[ALTERADA PELO USUÁRIO]')
        `, [usuarioId, req.usuarioLogado.nome, setorSigla, usuarioId]);

        // Atualiza a senha no banco
        await client.query('UPDATE usuarios SET senha = $1 WHERE id = $2', [senhaNova, usuarioId]);

        await client.query('COMMIT');
        res.json({ sucesso: true });
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ erro: e.message });
    } finally {
        client.release();
    }
});

app.post('/api/v1/setor/configuracoes', verificarAutenticacao, async (req, res) => {
    const { dias_alerta_parcela, dias_alerta_contrato, alerta_apostilamento_ativo } = req.body;
    const { setor_id } = req.usuarioLogado;

    try {
        await pool.query(`
            INSERT INTO configuracoes_setores (setor_id, dias_alerta_parcela, dias_alerta_contrato, alerta_apostilamento_ativo, atualizado_em)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
            ON CONFLICT (setor_id) 
            DO UPDATE SET 
                dias_alerta_parcela = EXCLUDED.dias_alerta_parcela,
                dias_alerta_contrato = EXCLUDED.dias_alerta_contrato,
                alerta_apostilamento_ativo = EXCLUDED.alerta_apostilamento_ativo,
                atualizado_em = CURRENT_TIMESTAMP
        `, [setor_id, parseInt(dias_alerta_parcela), parseInt(dias_alerta_contrato), alerta_apostilamento_ativo === true]);

        res.json({ sucesso: true });
    } catch (e) {
        res.status(500).json({ erro: e.message });
    }
});

app.listen(PORT, () => { console.log(`🚀 Sistema SEMED rodando na porta ${PORT}`); });