// ============================================================================
// ARQUIVO: backend/index.js — PARTE 1 DE 3 (POSTGRESQL & CRUD USUÁRIOS/LOCAIS)
// ============================================================================

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg'); // Driver nativo e real do PostgreSQL
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3009;

// Middlewares obrigatórios
app.use(cors());
app.use(express.json());

// Configuração de conexão real com o banco PostgreSQL 'postgres'
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'postgres',
  password: process.env.DB_PASSWORD || 'Gatosap2009*2',
  port: process.env.DB_PORT || 5432,
});

// Testando a conexão com o banco na inicialização do servidor
pool.connect((err, client, release) => {
  if (err) {
    return console.error('❌ Erro crítico de conexão com o PostgreSQL:', err.stack);
  }
  console.log('✅ Conectado com sucesso ao banco PostgreSQL (postgres)!');
  release();
});

// ============================================================================
// 1. CRUD DE USUÁRIOS
// ============================================================================

// Listar todos os usuários ativos e inativos
app.get('/api/usuarios', async (req, res) => {
  try {
    const query = 'SELECT id, nome, email, perfil, ativo FROM usuarios ORDER BY nome ASC';
    const { rows } = await pool.query(query);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    res.status(500).json({ mensagem: 'Erro interno ao consultar usuários.' });
  }
});

// Cadastrar novo usuário com verificação de duplicidade de email
app.post('/api/usuarios', async (req, res) => {
  try {
    const { nome, email, perfil } = req.body;
    
    if (!nome || !email || !perfil) {
      return res.status(400).json({ mensagem: 'Campos nome, email e perfil são obrigatórios.' });
    }

    const checkEmail = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (checkEmail.rows.length > 0) {
      return res.status(400).json({ mensagem: 'Este e-mail já está cadastrado.' });
    }

    const query = 'INSERT INTO usuarios (nome, email, perfil, ativo) VALUES ($1, $2, $3, true) RETURNING *';
    const { rows } = await pool.query(query, [nome, email, perfil]);
    
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    res.status(500).json({ mensagem: 'Erro interno ao salvar usuário.' });
  }
});

// Atualizar dados ou alternar status ativo/inativo do usuário
app.put('/api/usuarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, email, perfil, ativo } = req.body;

    const checkUser = await pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);
    if (checkUser.rows.length === 0) {
      return res.status(404).json({ message: 'Usuário não localizado.' });
    }

    const u = checkUser.rows[0];
    const query = `
      UPDATE usuarios 
      SET nome = $1, email = $2, perfil = $3, ativo = $4 
      WHERE id = $5 RETURNING *
    `;
    const valores = [
      nome !== undefined ? nome : u.nome,
      email !== undefined ? email : u.email,
      perfil !== undefined ? perfil : u.perfil,
      ativo !== undefined ? ativo : u.ativo,
      id
    ];

    const { rows } = await pool.query(query, valores);
    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Erro ao editar usuário:', error);
    res.status(500).json({ mensagem: 'Erro interno ao atualizar usuário.' });
  }
});

// ============================================================================
// 2. CRUD DE LOCAIS SÉDE
// ============================================================================

// Listar todos os locais cadastrados
app.get('/api/locais', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, nome, ativo FROM locais ORDER BY nome ASC');
    res.status(200).json(rows);
  } catch (error) {
    console.error('Erro ao buscar locais:', error);
    res.status(500).json({ mensagem: 'Erro interno ao consultar locais.' });
  }
});

// Cadastrar novo local
app.post('/api/locais', async (req, res) => {
  try {
    const { nome } = req.body;
    if (!nome) {
      return res.status(400).json({ mensagem: 'O campo nome do local é obrigatório.' });
    }

    const { rows } = await pool.query('INSERT INTO locais (nome, ativo) VALUES ($1, true) RETURNING *', [nome]);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Erro ao criar local:', error);
    res.status(500).json({ mensagem: 'Erro interno ao salvar local.' });
  }
});

// Editar local ou alterar status ativo/inativo
app.put('/api/locais/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, ativo } = req.body;

    const checkLocal = await pool.query('SELECT * FROM locais WHERE id = $1', [id]);
    if (checkLocal.rows.length === 0) {
      return res.status(404).json({ mensagem: 'Local não localizado.' });
    }

    const l = checkLocal.rows[0];
    const query = 'UPDATE locais SET nome = $1, ativo = $2 WHERE id = $3 RETURNING *';
    const { rows } = await pool.query(query, [
      nome !== undefined ? nome : l.nome,
      ativo !== undefined ? ativo : l.ativo,
      id
    ]);

    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Erro ao editar local:', error);
    res.status(500).json({ mensagem: 'Erro interno ao atualizar local.' });
  }
});
// ============================================================================
// ARQUIVO: backend/index.js — PARTE 2 DE 3 (CRUD PÚBLICO-ALVO & CRUD EVENTOS)
// ============================================================================

// ============================================================================
// 3. CRUD DE PÚBLICO-ALVO
// ============================================================================

// Listar todos os públicos-alvo
app.get('/api/publicos', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, nome, ativo FROM publico_alvo ORDER BY nome ASC');
    res.status(200).json(rows);
  } catch (error) {
    console.error('Erro ao buscar públicos-alvo:', error);
    res.status(500).json({ mensagem: 'Erro interno ao consultar públicos-alvo.' });
  }
});

// Cadastrar novo público-alvo
app.post('/api/publicos', async (req, res) => {
  try {
    const { nome } = req.body;
    if (!nome) {
      return res.status(400).json({ mensagem: 'O nome do público-alvo é obrigatório.' });
    }

    const query = 'INSERT INTO publico_alvo (nome, ativo) VALUES ($1, true) RETURNING *';
    const { rows } = await pool.query(query, [nome]);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Erro ao criar público-alvo:', error);
    res.status(500).json({ mensagem: 'Erro interno ao salvar público-alvo.' });
  }
});

// Editar público-alvo ou alterar status de atividade
app.put('/api/publicos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, ativo } = req.body;

    const checkPublico = await pool.query('SELECT * FROM publico_alvo WHERE id = $1', [id]);
    if (checkPublico.rows.length === 0) {
      return res.status(404).json({ mensagem: 'Público-alvo não localizado.' });
    }

    const p = checkPublico.rows[0];
    const query = 'UPDATE publico_alvo SET nome = $1, ativo = $2 WHERE id = $3 RETURNING *';
    const { rows } = await pool.query(query, [
      nome !== undefined ? nome : p.nome,
      ativo !== undefined ? ativo : p.ativo,
      id
    ]);

    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Erro ao editar público-alvo:', error);
    res.status(500).json({ mensagem: 'Erro interno ao atualizar público-alvo.' });
  }
});

// ============================================================================
// 4. CRUD DE EVENTOS (COM CONTROLE DE HORÁRIOS E CÁLCULO DE HORAS OFERTADAS)
// ============================================================================

// Listar todos os eventos trazendo os nomes reais do Local e do Público-Alvo via JOIN
app.get('/api/eventos', async (req, res) => {
  try {
    const query = `
      SELECT 
        e.id, e.titulo, e.data, e.horario_inicio, e.horario_fim, e.horas_ofertadas, e.ativo,
        e.local_id, l.nome AS local_nome,
        e.publico_alvo_id, p.nome AS publico_alvo_nome
      FROM eventos e
      LEFT JOIN locais l ON e.local_id = l.id
      LEFT JOIN publico_alvo p ON e.publico_alvo_id = p.id
      ORDER BY e.data DESC, e.horario_inicio DESC
    `;
    const { rows } = await pool.query(query);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Erro ao buscar eventos:', error);
    res.status(500).json({ mensagem: 'Erro interno ao consultar eventos.' });
  }
});

// Cadastrar novo evento (Calculando a carga horária dinamicamente no servidor)
app.post('/api/eventos', async (req, res) => {
  try {
    const { titulo, data, horario_inicio, horario_fim, local_id, publico_alvo_id } = req.body;

    if (!titulo || !data || !horario_inicio || !horario_fim || !local_id || !publico_alvo_id) {
      return res.status(400).json({ mensagem: 'Todos os campos do evento são obrigatórios.' });
    }

    // Lógica rigorosa de cálculo de horas ofertadas baseada nos horários informados
    const [hInicio, mInicio] = horario_inicio.split(':').map(Number);
    const [hFim, mFim] = horario_fim.split(':').map(Number);
    const diffHoras = (hFim + mFim / 60) - (hInicio + mInicio / 60);

    if (diffHoras <= 0) {
      return res.status(400).json({ mensagem: 'O horário de término deve ser posterior ao horário de início.' });
    }
    
    const horasOfertadas = parseFloat(diffHoras.toFixed(1));

    const query = `
      INSERT INTO eventos (titulo, data, horario_inicio, horario_fim, horas_ofertadas, local_id, publico_alvo_id, ativo)
      VALUES ($1, $2, $3, $4, $5, $6, $7, true) RETURNING *
    `;
    const { rows } = await pool.query(query, [titulo, data, horario_inicio, horario_fim, horasOfertadas, local_id, publico_alvo_id]);
    
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Erro ao criar evento:', error);
    res.status(500).json({ mensagem: 'Erro interno ao salvar evento.' });
  }
});

// Editar evento existente ou alternar status ativo/inativo
app.put('/api/eventos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, data, horario_inicio, horario_fim, local_id, publico_alvo_id, ativo } = req.body;

    const checkEvento = await pool.query('SELECT * FROM eventos WHERE id = $1', [id]);
    if (checkEvento.rows.length === 0) {
      return res.status(404).json({ mensagem: 'Evento não encontrado.' });
    }

    const ev = checkEvento.rows[0];

    // Atualiza os valores mantendo os originais caso não sejam enviados
    const rTitulo = titulo !== undefined ? titulo : ev.titulo;
    const rData = data !== undefined ? data : ev.data;
    const rInicio = horario_inicio !== undefined ? horario_inicio : ev.horario_inicio;
    const rFim = horario_fim !== undefined ? horario_fim : ev.horario_fim;
    const rLocal = local_id !== undefined ? local_id : ev.local_id;
    const rPublico = publico_alvo_id !== undefined ? publico_alvo_id : ev.publico_alvo_id;
    const rAtivo = ativo !== undefined ? ativo : ev.ativo;

    // Recalcula as horas com base nos horários atualizados
    const [hInicio, mInicio] = rInicio.split(':').map(Number);
    const [hFim, mFim] = rFim.split(':').map(Number);
    const diffHoras = (hFim + mFim / 60) - (hInicio + mInicio / 60);

    if (diffHoras <= 0) {
      return res.status(400).json({ mensagem: 'O horário de término deve ser posterior ao horário de início.' });
    }
    const rHorasOfertadas = parseFloat(diffHoras.toFixed(1));

    const query = `
      UPDATE eventos 
      SET titulo = $1, data = $2, horario_inicio = $3, horario_fim = $4, horas_ofertadas = $5, local_id = $6, publico_alvo_id = $7, ativo = $8
      WHERE id = $9 RETURNING *
    `;
    const { rows } = await pool.query(query, [rTitulo, rData, rInicio, rFim, rHorasOfertadas, rLocal, rPublico, rAtivo, id]);
    
    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Erro ao editar evento:', error);
    res.status(500).json({ mensagem: 'Erro interno ao atualizar evento.' });
  }
});

// ============================================================================
// 5. REGISTRO DE FREQUÊNCIA COM CAPTURA DE GEOLOCALIZAÇÃO REAL
// ============================================================================
// ============================================================================
// NOVO ENDPOINT DE FREQUÊNCIA: CHECK-IN, CHECK-OUT E AUTO-CADASTRO
// ============================================================================
app.post('/api/frequencias', async (req, res) => {
  try {
    const { 
      usuario_id, evento_id, latitude, longitude,
      nao_cadastrado, matricula, nome, publico_alvo_id, // Campos para auto-identificação
      nota_satisfacao, comentario // Campos para o Check-out
    } = req.body;

    if (!evento_id) {
      return res.status(400).json({ mensagem: 'O ID do evento é obrigatório.' });
    }

    if (latitude === undefined || longitude === undefined || latitude === null || longitude === null) {
      return res.status(400).json({ mensagem: 'Bloqueio de segurança: GPS do aparelho é obrigatório.' });
    }

    let idUsuarioFinal = usuario_id;

    // ESTRATÉGIA DE AUTO-IDENTIFICAÇÃO (Se o professor não estiver pré-cadastrado)
    if (nao_cadastrado || !idUsuarioFinal) {
      if (!matricula || !nome || !publico_alvo_id) {
        return res.status(400).json({ mensagem: 'Para professores não listados, Matrícula, Nome e Público-Alvo são obrigatórios.' });
      }

      const emailGerado = `${matricula.trim()}@paiva.br`;
      
      // Verifica se ele já se auto-cadastrou em algum momento anterior
      const checkUser = await pool.query('SELECT id FROM usuarios WHERE email = $1', [emailGerado]);
      
      if (checkUser.rows.length > 0) {
        idUsuarioFinal = checkUser.rows[0].id;
      } else {
        // Cria o registro do professor dinamicamente no PostgreSQL
        const newUser = await pool.query(
          "INSERT INTO usuarios (nome, email, perfil, ativo) VALUES ($1, $2, 'professor', true) RETURNING id",
          [nome.trim(), emailGerado]
        );
        idUsuarioFinal = newUser.rows[0].id;
      }
    }

    // BUSCA SE JÁ EXISTE UM REGISTRO DE FREQUÊNCIA PARA ESTE PROFESSOR NESTE EVENTO
    const checkFrequencia = await pool.query(
      'SELECT id, data_registro, data_saida FROM frequencias WHERE usuario_id = $1 AND evento_id = $2',
      [idUsuarioFinal, evento_id]
    );

    // ==========================================
    // FLUXO A: PRIMEIRO ACESSO (CHECK-IN / ENTRADA)
    // ==========================================
    if (checkFrequencia.rows.length === 0) {
      const queryIn = `
        INSERT INTO frequencias (usuario_id, evento_id, data_registro, latitude, longitude)
        VALUES ($1, $2, NOW(), $3, $4) RETURNING *
      `;
      await pool.query(queryIn, [idUsuarioFinal, evento_id, latitude, longitude]);
      
      return res.status(201).json({ 
        status: 'check-in', 
        mensagem: 'Sua chegada foi registrada com sucesso! Bom evento.' 
      });
    }

    // ==========================================
    // FLUXO B: SEGUNDO ACESSO (CHECK-OUT / SAÍDA)
    // ==========================================
    const freqExistente = checkFrequencia.rows[0];

    if (freqExistente.data_saida) {
      return res.status(400).json({ mensagem: 'Sua participação e carga horária já foram computadas e encerradas neste evento.' });
    }

    // Validação matemática do intervalo de tempo (Mínimo de 30 minutos)
    const checkTempo = await pool.query(
      `SELECT EXTRACT(EPOCH FROM (NOW() - $1))/60 AS minutos_passados`,
      [freqExistente.data_registro]
    );
    const minutosPassados = parseFloat(checkTempo.rows[0].minutos_passados);

    if (minutosPassados < 30) {
      const faltam = Math.ceil(30 - minutosPassados);
      return res.status(400).json({ 
        mensagem: `Intervalo não atingido. Você deve aguardar mais ${faltam} minuto(s) para liberar sua saída e responder a pesquisa.` 
      });
    }

    // Exige a nota da pesquisa de satisfação para fechar o check-out
    if (!nota_satisfacao) {
      return res.status(200).json({ 
        status: 'liberado_para_checkout', 
        mensagem: 'Intervalo de 30 min validado! Por favor, responda à pesquisa de satisfação para computar suas horas.' 
      });
    }

    // Realiza o Check-out definitivo gravando a nota, o comentário e a data de saída
    const queryOut = `
      UPDATE frequencias 
      SET data_saida = NOW(), latitude = $1, longitude = $2 
      WHERE id = $3
    `;
    await pool.query(queryOut, [latitude, longitude, freqExistente.id]);

    // Opcional: Se sua tabela frequencias já tiver as colunas nota e comentario, salvamos diretamente.
    // Caso não tenha alterado a tabela ainda, usamos uma query segura que aceita os campos se existirem.
    try {
      await pool.query(
        'UPDATE frequencias SET nota_satisfacao = $1, comentario = $2 WHERE id = $3',
        [nota_satisfacao, comentario || '', freqExistente.id]
      );
    } catch (e) {
      console.log("Aviso: Colunas de satisfação não encontradas na tabela frequencias, mas o check-out foi concluído.");
    }

    return res.status(200).json({ 
      status: 'check-out_concluido', 
      mensagem: 'Participação encerrada! Suas horas foram computadas no banco de dados.' 
    });

  } catch (error) {
    console.error('Erro no processamento da frequência:', error);
    res.status(500).json({ mensagem: 'Erro interno ao processar registro no PostgreSQL.' });
  }
});

// ============================================================================
// 6. ENDPOINT DO RELATÓRIO FILTRADO POR PÚBLICO-ALVO E INTERVALO DE DATAS
// ============================================================================
app.get('/api/relatorios/publico', async (req, res) => {
  try {
    const { data_inicio, data_fim, publico_alvo_id } = req.query;

    // Query base unindo os eventos, público-alvo, locais e totalizando presenças via COUNT
    let query = `
      SELECT 
        e.id, e.titulo, e.data, e.horario_inicio, e.horario_fim, e.horas_ofertadas, e.ativo,
        p.nome AS publico_alvo_nome,
        l.nome AS local_nome,
        COUNT(f.id) AS total_participantes
      FROM eventos e
      LEFT JOIN publico_alvo p ON e.publico_alvo_id = p.id
      LEFT JOIN locais l ON e.local_id = l.id
      LEFT JOIN frequencias f ON e.id = f.evento_id
      WHERE 1=1
    `;
    const params = [];
    let contador = 1;

    // Filtro condicional por Público-Alvo
    if (publico_alvo_id && publico_alvo_id !== '') {
      query += ` AND e.publico_alvo_id = $${contador}`;
      params.push(publico_alvo_id);
      contador++;
    }

    // Filtro condicional por Data Inicial (Período)
    if (data_inicio && data_inicio !== '') {
      query += ` AND e.data >= $${contador}`;
      params.push(data_inicio);
      contador++;
    }

    // Filtro condicional por Data Final (Período)
    if (data_fim && data_fim !== '') {
      query += ` AND e.data <= $${contador}`;
      params.push(data_fim);
      contador++;
    }

    // Agrupamento necessário devido ao COUNT de participantes
    query += `
      GROUP BY e.id, p.nome, l.nome
      ORDER BY e.data DESC, e.horario_inicio DESC
    `;

    const { rows } = await pool.query(query, params);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Erro ao gerar relatório por público:', error);
    res.status(500).json({ mensagem: 'Erro interno ao processar o relatório filtrado.' });
  }
});

// ============================================================================
// INICIALIZAÇÃO DO SERVIDOR
// ============================================================================
app.listen(PORT, () => {
  console.log(`🚀 Servidor backend rodando perfeitamente na porta ${PORT}`);
});
