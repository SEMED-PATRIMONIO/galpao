CREATE DATABASE IF NOT EXISTS estoque_central;
USE estoque_central;

-- Tabela de Categorias (para Patrimônio e Material)
CREATE TABLE categorias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL UNIQUE
);

-- Tabela de Locais (Escolas e Sede)
CREATE TABLE locais (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL UNIQUE
);

-- Tabela de Setores (para movimentação de Patrimônio)
CREATE TABLE setores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL UNIQUE
);

-- Tabela de Usuários
CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    perfil ENUM('super', 'admin', 'escola', 'estoque', 'logistica') NOT NULL,
    local_id INT,
    status ENUM('ativo', 'inativo') DEFAULT 'ativo',
    FOREIGN KEY (local_id) REFERENCES locais(id)
);

-- Tabela de Produtos
CREATE TABLE produtos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    tipo ENUM('UNIFORMES', 'PATRIMONIO', 'MATERIAL') NOT NULL,
    categoria_id INT,
    quantidade_estoque INT DEFAULT 0,
    alerta_minimo INT DEFAULT 0, -- Apenas para MATERIAL
    FOREIGN KEY (categoria_id) REFERENCES categorias(id)
);

-- Tabela de Itens de Patrimônio (Únicos por Série/Plaqueta)
CREATE TABLE patrimonios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    produto_id INT,
    numero_serie VARCHAR(100) NOT NULL UNIQUE,
    local_id INT,
    setor_id INT,
    status ENUM('ESTOQUE', 'ALOCADO') DEFAULT 'ESTOQUE',
    FOREIGN KEY (produto_id) REFERENCES produtos(id),
    FOREIGN KEY (local_id) REFERENCES locais(id),
    FOREIGN KEY (setor_id) REFERENCES setores(id)
);

-- Tabela de Pedidos
CREATE TABLE pedidos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_origem_id INT,
    local_destino_id INT,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('AGUARDANDO APROVACAO', 'PEDIDO AUTORIZADO', 'EM SEPARACAO', 'RETIRADA AUTORIZADA', 'EM TRANSPORTE', 'ENTREGUE', 'RECUSADO') DEFAULT 'AGUARDANDO APROVACAO',
    motivo_recusa TEXT,
    volumes INT DEFAULT 0,
    FOREIGN KEY (usuario_origem_id) REFERENCES usuarios(id),
    FOREIGN KEY (local_destino_id) REFERENCES locais(id)
);

-- Itens do Pedido
CREATE TABLE pedido_itens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pedido_id INT,
    produto_id INT,
    quantidade_solicitada INT,
    quantidade_atendida INT DEFAULT 0,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
    FOREIGN KEY (produto_id) REFERENCES produtos(id)
);

-- Histórico Geral
CREATE TABLE historico (
    id INT AUTO_INCREMENT PRIMARY KEY,
    data TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usuario_id INT,
    acao TEXT NOT NULL,
    tipo_historico ENUM('PRINCIPAL', 'LOGISTICA') DEFAULT 'PRINCIPAL',
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- Inserção de Usuário Super inicial (Senha: 1234)
INSERT INTO usuarios (nome, senha, perfil, status) VALUES ('SUPERVISOR', '1234', 'super', 'ativo');