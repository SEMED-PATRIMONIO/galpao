--
-- PostgreSQL database dump
--

\restrict lBb4YLnen98DVBLVrva9OgpkpC87jtqXfAd1plkiUCLKwY1oV42fFlIIcDU8F6i

-- Dumped from database version 16.11 (Ubuntu 16.11-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.11 (Ubuntu 16.11-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: perfil_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.perfil_enum AS ENUM (
    'super',
    'admin',
    'escola',
    'estoque',
    'logistica'
);


ALTER TYPE public.perfil_enum OWNER TO postgres;

--
-- Name: status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.status_enum AS ENUM (
    'ativo',
    'inativo'
);


ALTER TYPE public.status_enum OWNER TO postgres;

--
-- Name: status_patrimonio_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.status_patrimonio_enum AS ENUM (
    'ESTOQUE',
    'ALOCADO'
);


ALTER TYPE public.status_patrimonio_enum OWNER TO postgres;

--
-- Name: status_pedido; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.status_pedido AS ENUM (
    'AGUARDANDO_AUTORIZACAO',
    'APROVADO',
    'SEPARACAO_INICIADA',
    'AGUARDANDO_COLETA',
    'EM_TRANSPORTE',
    'ENTREGUE',
    'RECUSADO',
    'DEVOLUCAO_PENDENTE',
    'DEVOLUCAO_AUTORIZADA',
    'DEVOLUCAO_EM_TRANSITO',
    'DEVOLVIDO'
);


ALTER TYPE public.status_pedido OWNER TO postgres;

--
-- Name: status_pedido_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.status_pedido_enum AS ENUM (
    'AGUARDANDO APROVACAO',
    'PEDIDO AUTORIZADO',
    'EM SEPARACAO',
    'RETIRADA AUTORIZADA',
    'EM TRANSPORTE',
    'ENTREGUE',
    'RECUSADO'
);


ALTER TYPE public.status_pedido_enum OWNER TO postgres;

--
-- Name: tipo_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.tipo_enum AS ENUM (
    'UNIFORMES',
    'PATRIMONIO',
    'MATERIAL'
);


ALTER TYPE public.tipo_enum OWNER TO postgres;

--
-- Name: tipo_historico_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.tipo_historico_enum AS ENUM (
    'PRINCIPAL',
    'LOGISTICA'
);


ALTER TYPE public.tipo_historico_enum OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: categorias; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categorias (
    id integer NOT NULL,
    nome character varying(100) NOT NULL
);


ALTER TABLE public.categorias OWNER TO postgres;

--
-- Name: categorias_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.categorias_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.categorias_id_seq OWNER TO postgres;

--
-- Name: categorias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.categorias_id_seq OWNED BY public.categorias.id;


--
-- Name: estoque_grades; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.estoque_grades (
    id integer NOT NULL,
    produto_id integer NOT NULL,
    tamanho character varying(10) NOT NULL,
    quantidade integer DEFAULT 0
);


ALTER TABLE public.estoque_grades OWNER TO postgres;

--
-- Name: estoque_grades_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.estoque_grades_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.estoque_grades_id_seq OWNER TO postgres;

--
-- Name: estoque_grades_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.estoque_grades_id_seq OWNED BY public.estoque_grades.id;


--
-- Name: estoque_tamanhos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.estoque_tamanhos (
    id integer NOT NULL,
    produto_id integer,
    tamanho character varying(10),
    quantidade integer DEFAULT 0
);


ALTER TABLE public.estoque_tamanhos OWNER TO postgres;

--
-- Name: estoque_tamanhos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.estoque_tamanhos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.estoque_tamanhos_id_seq OWNER TO postgres;

--
-- Name: estoque_tamanhos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.estoque_tamanhos_id_seq OWNED BY public.estoque_tamanhos.id;


--
-- Name: historico; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.historico (
    id integer NOT NULL,
    data timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    usuario_id integer,
    acao text NOT NULL,
    tipo_historico public.tipo_historico_enum DEFAULT 'PRINCIPAL'::public.tipo_historico_enum,
    quantidade_total integer DEFAULT 0,
    observacoes text,
    local_id integer,
    tipo character varying(10)
);


ALTER TABLE public.historico OWNER TO postgres;

--
-- Name: historico_detalhes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.historico_detalhes (
    id integer NOT NULL,
    historico_id integer,
    produto_id integer,
    tamanho character varying(10),
    quantidade integer,
    tipo_produto character varying(20)
);


ALTER TABLE public.historico_detalhes OWNER TO postgres;

--
-- Name: historico_detalhes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.historico_detalhes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.historico_detalhes_id_seq OWNER TO postgres;

--
-- Name: historico_detalhes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.historico_detalhes_id_seq OWNED BY public.historico_detalhes.id;


--
-- Name: historico_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.historico_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.historico_id_seq OWNER TO postgres;

--
-- Name: historico_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.historico_id_seq OWNED BY public.historico.id;


--
-- Name: historico_log_pedidos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.historico_log_pedidos (
    id integer NOT NULL,
    data timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    pedido_id integer,
    usuario_id integer,
    status_anterior character varying(50),
    status_novo character varying(50),
    volumes integer,
    observacao text
);


ALTER TABLE public.historico_log_pedidos OWNER TO postgres;

--
-- Name: historico_log_pedidos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.historico_log_pedidos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.historico_log_pedidos_id_seq OWNER TO postgres;

--
-- Name: historico_log_pedidos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.historico_log_pedidos_id_seq OWNED BY public.historico_log_pedidos.id;


--
-- Name: historico_movimentacoes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.historico_movimentacoes (
    id integer NOT NULL,
    data timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    usuario_id integer,
    produto_id integer,
    quantidade integer NOT NULL,
    tipo_movimentacao character varying(20),
    origem_destino text
);


ALTER TABLE public.historico_movimentacoes OWNER TO postgres;

--
-- Name: historico_movimentacoes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.historico_movimentacoes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.historico_movimentacoes_id_seq OWNER TO postgres;

--
-- Name: historico_movimentacoes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.historico_movimentacoes_id_seq OWNED BY public.historico_movimentacoes.id;


--
-- Name: locais; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.locais (
    id integer NOT NULL,
    nome character varying(100) NOT NULL
);


ALTER TABLE public.locais OWNER TO postgres;

--
-- Name: locais_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.locais_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.locais_id_seq OWNER TO postgres;

--
-- Name: locais_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.locais_id_seq OWNED BY public.locais.id;


--
-- Name: log_status_pedidos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.log_status_pedidos (
    id integer NOT NULL,
    pedido_id integer,
    usuario_id integer,
    status_anterior character varying(50),
    status_novo character varying(50),
    data_hora timestamp without time zone DEFAULT now(),
    observacao text
);


ALTER TABLE public.log_status_pedidos OWNER TO postgres;

--
-- Name: log_status_pedidos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.log_status_pedidos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.log_status_pedidos_id_seq OWNER TO postgres;

--
-- Name: log_status_pedidos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.log_status_pedidos_id_seq OWNED BY public.log_status_pedidos.id;


--
-- Name: patrimonios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.patrimonios (
    id integer NOT NULL,
    produto_id integer,
    numero_serie character varying(100) NOT NULL,
    local_id integer,
    setor_id integer,
    status public.status_patrimonio_enum DEFAULT 'ESTOQUE'::public.status_patrimonio_enum,
    nota_fiscal character varying(50),
    pedido_id integer,
    data_atualizacao timestamp without time zone DEFAULT now()
);


ALTER TABLE public.patrimonios OWNER TO postgres;

--
-- Name: patrimonios_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.patrimonios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.patrimonios_id_seq OWNER TO postgres;

--
-- Name: patrimonios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.patrimonios_id_seq OWNED BY public.patrimonios.id;


--
-- Name: pedido_itens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pedido_itens (
    id integer NOT NULL,
    pedido_id integer,
    produto_id integer,
    quantidade_solicitada integer,
    quantidade_atendida integer DEFAULT 0,
    tamanho character varying(10),
    patrimonio_id integer,
    quantidade_total_enviada integer DEFAULT 0,
    quantidade integer,
    quantidade_entregue_total integer DEFAULT 0,
    quantidade_enviada_agora integer DEFAULT 0,
    quantidade_enviada integer DEFAULT 0
);


ALTER TABLE public.pedido_itens OWNER TO postgres;

--
-- Name: pedido_itens_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pedido_itens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pedido_itens_id_seq OWNER TO postgres;

--
-- Name: pedido_itens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pedido_itens_id_seq OWNED BY public.pedido_itens.id;


--
-- Name: pedido_remessa_itens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pedido_remessa_itens (
    id integer NOT NULL,
    remessa_id integer,
    produto_id integer,
    tamanho character varying(10),
    quantidade_enviada integer
);


ALTER TABLE public.pedido_remessa_itens OWNER TO postgres;

--
-- Name: pedido_remessa_itens_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pedido_remessa_itens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pedido_remessa_itens_id_seq OWNER TO postgres;

--
-- Name: pedido_remessa_itens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pedido_remessa_itens_id_seq OWNED BY public.pedido_remessa_itens.id;


--
-- Name: pedido_remessas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pedido_remessas (
    id integer NOT NULL,
    pedido_id integer,
    data_criacao timestamp without time zone DEFAULT now(),
    status character varying(50) DEFAULT 'EM SEPARAÇÃO'::character varying
);


ALTER TABLE public.pedido_remessas OWNER TO postgres;

--
-- Name: pedido_remessas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pedido_remessas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pedido_remessas_id_seq OWNER TO postgres;

--
-- Name: pedido_remessas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pedido_remessas_id_seq OWNED BY public.pedido_remessas.id;


--
-- Name: pedidos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pedidos (
    id integer NOT NULL,
    usuario_origem_id integer,
    local_destino_id integer,
    data_criacao timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    status public.status_pedido DEFAULT 'AGUARDANDO_AUTORIZACAO'::public.status_pedido,
    motivo_recusa text,
    volumes integer DEFAULT 0,
    data_autorizacao timestamp without time zone,
    autorizado_por integer,
    usuario_separacao_id integer,
    data_separacao timestamp without time zone,
    data_saida timestamp without time zone,
    data_recebimento timestamp without time zone
);


ALTER TABLE public.pedidos OWNER TO postgres;

--
-- Name: pedidos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pedidos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pedidos_id_seq OWNER TO postgres;

--
-- Name: pedidos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pedidos_id_seq OWNED BY public.pedidos.id;


--
-- Name: produtos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.produtos (
    id integer NOT NULL,
    nome character varying(100) NOT NULL,
    tipo public.tipo_enum NOT NULL,
    categoria_id integer,
    quantidade_estoque integer DEFAULT 0,
    alerta_minimo integer DEFAULT 0
);


ALTER TABLE public.produtos OWNER TO postgres;

--
-- Name: produtos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.produtos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.produtos_id_seq OWNER TO postgres;

--
-- Name: produtos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.produtos_id_seq OWNED BY public.produtos.id;


--
-- Name: setores; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.setores (
    id integer NOT NULL,
    nome character varying(100) NOT NULL
);


ALTER TABLE public.setores OWNER TO postgres;

--
-- Name: setores_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.setores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.setores_id_seq OWNER TO postgres;

--
-- Name: setores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.setores_id_seq OWNED BY public.setores.id;


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.usuarios (
    id integer NOT NULL,
    nome character varying(100) NOT NULL,
    senha character varying(255) NOT NULL,
    perfil public.perfil_enum NOT NULL,
    local_id integer,
    status public.status_enum DEFAULT 'ativo'::public.status_enum
);


ALTER TABLE public.usuarios OWNER TO postgres;

--
-- Name: usuarios_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.usuarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.usuarios_id_seq OWNER TO postgres;

--
-- Name: usuarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.usuarios_id_seq OWNED BY public.usuarios.id;


--
-- Name: categorias id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categorias ALTER COLUMN id SET DEFAULT nextval('public.categorias_id_seq'::regclass);


--
-- Name: estoque_grades id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.estoque_grades ALTER COLUMN id SET DEFAULT nextval('public.estoque_grades_id_seq'::regclass);


--
-- Name: estoque_tamanhos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.estoque_tamanhos ALTER COLUMN id SET DEFAULT nextval('public.estoque_tamanhos_id_seq'::regclass);


--
-- Name: historico id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.historico ALTER COLUMN id SET DEFAULT nextval('public.historico_id_seq'::regclass);


--
-- Name: historico_detalhes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.historico_detalhes ALTER COLUMN id SET DEFAULT nextval('public.historico_detalhes_id_seq'::regclass);


--
-- Name: historico_log_pedidos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.historico_log_pedidos ALTER COLUMN id SET DEFAULT nextval('public.historico_log_pedidos_id_seq'::regclass);


--
-- Name: historico_movimentacoes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.historico_movimentacoes ALTER COLUMN id SET DEFAULT nextval('public.historico_movimentacoes_id_seq'::regclass);


--
-- Name: locais id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.locais ALTER COLUMN id SET DEFAULT nextval('public.locais_id_seq'::regclass);


--
-- Name: log_status_pedidos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.log_status_pedidos ALTER COLUMN id SET DEFAULT nextval('public.log_status_pedidos_id_seq'::regclass);


--
-- Name: patrimonios id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patrimonios ALTER COLUMN id SET DEFAULT nextval('public.patrimonios_id_seq'::regclass);


--
-- Name: pedido_itens id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pedido_itens ALTER COLUMN id SET DEFAULT nextval('public.pedido_itens_id_seq'::regclass);


--
-- Name: pedido_remessa_itens id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pedido_remessa_itens ALTER COLUMN id SET DEFAULT nextval('public.pedido_remessa_itens_id_seq'::regclass);


--
-- Name: pedido_remessas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pedido_remessas ALTER COLUMN id SET DEFAULT nextval('public.pedido_remessas_id_seq'::regclass);


--
-- Name: pedidos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pedidos ALTER COLUMN id SET DEFAULT nextval('public.pedidos_id_seq'::regclass);


--
-- Name: produtos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.produtos ALTER COLUMN id SET DEFAULT nextval('public.produtos_id_seq'::regclass);


--
-- Name: setores id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.setores ALTER COLUMN id SET DEFAULT nextval('public.setores_id_seq'::regclass);


--
-- Name: usuarios id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios ALTER COLUMN id SET DEFAULT nextval('public.usuarios_id_seq'::regclass);


--
-- Name: categorias categorias_nome_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_nome_key UNIQUE (nome);


--
-- Name: categorias categorias_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_pkey PRIMARY KEY (id);


--
-- Name: estoque_grades estoque_grades_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.estoque_grades
    ADD CONSTRAINT estoque_grades_pkey PRIMARY KEY (id);


--
-- Name: estoque_grades estoque_grades_produto_id_tamanho_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.estoque_grades
    ADD CONSTRAINT estoque_grades_produto_id_tamanho_key UNIQUE (produto_id, tamanho);


--
-- Name: estoque_tamanhos estoque_tamanhos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.estoque_tamanhos
    ADD CONSTRAINT estoque_tamanhos_pkey PRIMARY KEY (id);


--
-- Name: estoque_tamanhos estoque_tamanhos_produto_id_tamanho_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.estoque_tamanhos
    ADD CONSTRAINT estoque_tamanhos_produto_id_tamanho_key UNIQUE (produto_id, tamanho);


--
-- Name: historico_detalhes historico_detalhes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.historico_detalhes
    ADD CONSTRAINT historico_detalhes_pkey PRIMARY KEY (id);


--
-- Name: historico_log_pedidos historico_log_pedidos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.historico_log_pedidos
    ADD CONSTRAINT historico_log_pedidos_pkey PRIMARY KEY (id);


--
-- Name: historico_movimentacoes historico_movimentacoes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.historico_movimentacoes
    ADD CONSTRAINT historico_movimentacoes_pkey PRIMARY KEY (id);


--
-- Name: historico historico_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.historico
    ADD CONSTRAINT historico_pkey PRIMARY KEY (id);


--
-- Name: locais locais_nome_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.locais
    ADD CONSTRAINT locais_nome_key UNIQUE (nome);


--
-- Name: locais locais_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.locais
    ADD CONSTRAINT locais_pkey PRIMARY KEY (id);


--
-- Name: log_status_pedidos log_status_pedidos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.log_status_pedidos
    ADD CONSTRAINT log_status_pedidos_pkey PRIMARY KEY (id);


--
-- Name: patrimonios patrimonios_numero_serie_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patrimonios
    ADD CONSTRAINT patrimonios_numero_serie_key UNIQUE (numero_serie);


--
-- Name: patrimonios patrimonios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patrimonios
    ADD CONSTRAINT patrimonios_pkey PRIMARY KEY (id);


--
-- Name: pedido_itens pedido_itens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pedido_itens
    ADD CONSTRAINT pedido_itens_pkey PRIMARY KEY (id);


--
-- Name: pedido_remessa_itens pedido_remessa_itens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pedido_remessa_itens
    ADD CONSTRAINT pedido_remessa_itens_pkey PRIMARY KEY (id);


--
-- Name: pedido_remessas pedido_remessas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pedido_remessas
    ADD CONSTRAINT pedido_remessas_pkey PRIMARY KEY (id);


--
-- Name: pedidos pedidos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pedidos
    ADD CONSTRAINT pedidos_pkey PRIMARY KEY (id);


--
-- Name: produtos produtos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.produtos
    ADD CONSTRAINT produtos_pkey PRIMARY KEY (id);


--
-- Name: setores setores_nome_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.setores
    ADD CONSTRAINT setores_nome_key UNIQUE (nome);


--
-- Name: setores setores_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.setores
    ADD CONSTRAINT setores_pkey PRIMARY KEY (id);


--
-- Name: usuarios usuarios_nome_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_nome_key UNIQUE (nome);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: idx_patrimonio_serie; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patrimonio_serie ON public.patrimonios USING btree (numero_serie);


--
-- Name: estoque_grades estoque_grades_produto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.estoque_grades
    ADD CONSTRAINT estoque_grades_produto_id_fkey FOREIGN KEY (produto_id) REFERENCES public.produtos(id);


--
-- Name: estoque_tamanhos estoque_tamanhos_produto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.estoque_tamanhos
    ADD CONSTRAINT estoque_tamanhos_produto_id_fkey FOREIGN KEY (produto_id) REFERENCES public.produtos(id);


--
-- Name: historico fk_historico_local; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.historico
    ADD CONSTRAINT fk_historico_local FOREIGN KEY (local_id) REFERENCES public.locais(id);


--
-- Name: historico_detalhes historico_detalhes_historico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.historico_detalhes
    ADD CONSTRAINT historico_detalhes_historico_id_fkey FOREIGN KEY (historico_id) REFERENCES public.historico(id) ON DELETE CASCADE;


--
-- Name: historico_detalhes historico_detalhes_produto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.historico_detalhes
    ADD CONSTRAINT historico_detalhes_produto_id_fkey FOREIGN KEY (produto_id) REFERENCES public.produtos(id);


--
-- Name: historico historico_local_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.historico
    ADD CONSTRAINT historico_local_id_fkey FOREIGN KEY (local_id) REFERENCES public.locais(id);


--
-- Name: historico_log_pedidos historico_log_pedidos_pedido_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.historico_log_pedidos
    ADD CONSTRAINT historico_log_pedidos_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES public.pedidos(id);


--
-- Name: historico_log_pedidos historico_log_pedidos_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.historico_log_pedidos
    ADD CONSTRAINT historico_log_pedidos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: historico_movimentacoes historico_movimentacoes_produto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.historico_movimentacoes
    ADD CONSTRAINT historico_movimentacoes_produto_id_fkey FOREIGN KEY (produto_id) REFERENCES public.produtos(id);


--
-- Name: historico_movimentacoes historico_movimentacoes_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.historico_movimentacoes
    ADD CONSTRAINT historico_movimentacoes_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: historico historico_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.historico
    ADD CONSTRAINT historico_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: log_status_pedidos log_status_pedidos_pedido_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.log_status_pedidos
    ADD CONSTRAINT log_status_pedidos_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES public.pedidos(id) ON DELETE CASCADE;


--
-- Name: log_status_pedidos log_status_pedidos_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.log_status_pedidos
    ADD CONSTRAINT log_status_pedidos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: patrimonios patrimonios_local_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patrimonios
    ADD CONSTRAINT patrimonios_local_id_fkey FOREIGN KEY (local_id) REFERENCES public.locais(id);


--
-- Name: patrimonios patrimonios_pedido_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patrimonios
    ADD CONSTRAINT patrimonios_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES public.pedidos(id);


--
-- Name: patrimonios patrimonios_produto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patrimonios
    ADD CONSTRAINT patrimonios_produto_id_fkey FOREIGN KEY (produto_id) REFERENCES public.produtos(id);


--
-- Name: patrimonios patrimonios_setor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patrimonios
    ADD CONSTRAINT patrimonios_setor_id_fkey FOREIGN KEY (setor_id) REFERENCES public.setores(id);


--
-- Name: pedido_itens pedido_itens_patrimonio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pedido_itens
    ADD CONSTRAINT pedido_itens_patrimonio_id_fkey FOREIGN KEY (patrimonio_id) REFERENCES public.patrimonios(id);


--
-- Name: pedido_itens pedido_itens_pedido_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pedido_itens
    ADD CONSTRAINT pedido_itens_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES public.pedidos(id);


--
-- Name: pedido_itens pedido_itens_produto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pedido_itens
    ADD CONSTRAINT pedido_itens_produto_id_fkey FOREIGN KEY (produto_id) REFERENCES public.produtos(id);


--
-- Name: pedido_remessa_itens pedido_remessa_itens_produto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pedido_remessa_itens
    ADD CONSTRAINT pedido_remessa_itens_produto_id_fkey FOREIGN KEY (produto_id) REFERENCES public.produtos(id);


--
-- Name: pedido_remessa_itens pedido_remessa_itens_remessa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pedido_remessa_itens
    ADD CONSTRAINT pedido_remessa_itens_remessa_id_fkey FOREIGN KEY (remessa_id) REFERENCES public.pedido_remessas(id) ON DELETE CASCADE;


--
-- Name: pedido_remessas pedido_remessas_pedido_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pedido_remessas
    ADD CONSTRAINT pedido_remessas_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES public.pedidos(id) ON DELETE CASCADE;


--
-- Name: pedidos pedidos_autorizado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pedidos
    ADD CONSTRAINT pedidos_autorizado_por_fkey FOREIGN KEY (autorizado_por) REFERENCES public.usuarios(id);


--
-- Name: pedidos pedidos_local_destino_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pedidos
    ADD CONSTRAINT pedidos_local_destino_id_fkey FOREIGN KEY (local_destino_id) REFERENCES public.locais(id);


--
-- Name: pedidos pedidos_usuario_origem_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pedidos
    ADD CONSTRAINT pedidos_usuario_origem_id_fkey FOREIGN KEY (usuario_origem_id) REFERENCES public.usuarios(id);


--
-- Name: pedidos pedidos_usuario_separacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pedidos
    ADD CONSTRAINT pedidos_usuario_separacao_id_fkey FOREIGN KEY (usuario_separacao_id) REFERENCES public.usuarios(id);


--
-- Name: produtos produtos_categoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.produtos
    ADD CONSTRAINT produtos_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias(id);


--
-- Name: usuarios usuarios_local_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_local_id_fkey FOREIGN KEY (local_id) REFERENCES public.locais(id);


--
-- PostgreSQL database dump complete
--

\unrestrict lBb4YLnen98DVBLVrva9OgpkpC87jtqXfAd1plkiUCLKwY1oV42fFlIIcDU8F6i

