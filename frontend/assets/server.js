const express = require('express');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const cors = require('cors');

const appQuiz = express();
const appDash = express();

appQuiz.use(cors());
appQuiz.use(express.json());
appDash.use(cors());
appDash.use(express.json());

const CSV_FILE = './cadastros_alunos.csv';

// Cabeçalhos do CSV
const csvWriter = createCsvWriter({
    path: CSV_FILE,
    header: [
        {id: 'data', title: 'Data'},
        {id: 'escola', title: 'Escola'},
        {id: 'ano', title: 'Ano'},
        {id: 'email', title: 'Email'},
        {id: 'turma', title: 'Turma'},
        {id: 'turno', title: 'Turno'},
        ...Array.from({length: 15}, (_, i) => ({id: `aluno${i+1}`, title: `Aluno ${i+1}`}))
    ],
    append: true
});

// --- API QUIZ (Porta 3020) ---

// Buscar se já existe Escola + Ano
appQuiz.get('/buscar', (req, res) => {
    const { escola, ano } = req.query;
    const resultados = [];
    if (!fs.existsSync(CSV_FILE)) return res.json({ encontrado: false });

    fs.createReadStream(CSV_FILE)
        .pipe(csv())
        .on('data', (data) => resultados.push(data))
        .on('end', () => {
            const registro = resultados.find(r => r.Escola === escola && r.Ano === ano);
            res.json(registro ? { encontrado: true, dados: registro } : { encontrado: false });
        });
});

// Salvar ou Atualizar
appQuiz.post('/salvar', async (req, res) => {
    const novoData = req.body;
    let todosDados = [];
    
    if (fs.existsSync(CSV_FILE)) {
        const stream = fs.createReadStream(CSV_FILE).pipe(csv());
        for await (const row of stream) { todosDados.push(row); }
    }

    const index = todosDados.findIndex(r => r.Escola === novoData.escola && r.Ano === novoData.ano);
    
    const row = {
        data: new Date().toLocaleString('pt-BR'),
        escola: novoData.escola,
        ano: novoData.ano,
        email: novoData.email,
        turma: novoData.turma,
        turno: novoData.turno,
    };
    novoData.alunos.forEach((nome, i) => row[`aluno${i+1}`] = nome);

    if (index !== -1) {
        todosDados[index] = row; // Atualiza
        const writerFull = createCsvWriter({ path: CSV_FILE, header: csvWriter.header });
        await writerFull.writeRecords(todosDados);
    } else {
        await csvWriter.writeRecords([row]); // Adiciona novo
    }
    res.json({ success: true });
});

// Serve o index.html do Quiz
appQuiz.use(express.static('public_quiz'));

// --- API DASHBOARD (Porta 3021) ---

appDash.get('/dados', (req, res) => {
    const resultados = [];
    if (!fs.existsSync(CSV_FILE)) return res.json([]);
    fs.createReadStream(CSV_FILE)
        .pipe(csv())
        .on('data', (data) => resultados.push(data))
        .on('end', () => res.json(resultados));
});

appDash.use(express.static('public_dash'));

appQuiz.listen(3020, () => console.log('Quiz rodando na porta 3020'));
appDash.listen(3021, () => console.log('Dashboard rodando na porta 3021'));