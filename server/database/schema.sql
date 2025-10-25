-- Tabela de Usuários
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK(tipo IN ('coordenador', 'responsavel_entrega', 'responsavel_recebimento', 'tecnico')),
    ativo INTEGER DEFAULT 1,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Depósitos
CREATE TABLE IF NOT EXISTS depositos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    endereco TEXT,
    responsavel_id INTEGER,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (responsavel_id) REFERENCES usuarios(id)
);

-- Tabela de Categorias de Equipamentos
CREATE TABLE IF NOT EXISTS categorias_equipamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK(tipo IN ('som', 'iluminacao', 'palco', 'outro')),
    descricao TEXT
);

-- Tabela de Equipamentos
CREATE TABLE IF NOT EXISTS equipamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT UNIQUE NOT NULL,
    nome TEXT NOT NULL,
    categoria_id INTEGER NOT NULL,
    marca TEXT,
    modelo TEXT,
    numero_serie TEXT,
    deposito_id INTEGER,
    status TEXT NOT NULL DEFAULT 'disponivel' CHECK(status IN ('disponivel', 'em_uso', 'manutencao', 'com_problema', 'transferencia')),
    condicao TEXT DEFAULT 'bom' CHECK(condicao IN ('excelente', 'bom', 'regular', 'ruim', 'quebrado')),
    observacoes TEXT,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (categoria_id) REFERENCES categorias_equipamentos(id),
    FOREIGN KEY (deposito_id) REFERENCES depositos(id)
);

-- Tabela de Histórico de Problemas dos Equipamentos
CREATE TABLE IF NOT EXISTS problemas_equipamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    equipamento_id INTEGER NOT NULL,
    descricao TEXT NOT NULL,
    gravidade TEXT CHECK(gravidade IN ('baixa', 'media', 'alta', 'critica')),
    reportado_por INTEGER NOT NULL,
    resolvido INTEGER DEFAULT 0,
    resolvido_por INTEGER,
    data_relato DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_resolucao DATETIME,
    FOREIGN KEY (equipamento_id) REFERENCES equipamentos(id),
    FOREIGN KEY (reportado_por) REFERENCES usuarios(id),
    FOREIGN KEY (resolvido_por) REFERENCES usuarios(id)
);

-- Tabela de Templates de Eventos
CREATE TABLE IF NOT EXISTS templates_eventos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    tamanho TEXT NOT NULL CHECK(tamanho IN ('pequeno', 'medio', 'grande', 'extra_grande')),
    descricao TEXT,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Itens do Checklist por Template
CREATE TABLE IF NOT EXISTS checklist_template (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL,
    categoria_id INTEGER NOT NULL,
    quantidade_minima INTEGER NOT NULL,
    obrigatorio INTEGER DEFAULT 1,
    FOREIGN KEY (template_id) REFERENCES templates_eventos(id),
    FOREIGN KEY (categoria_id) REFERENCES categorias_equipamentos(id)
);

-- Tabela de Eventos
CREATE TABLE IF NOT EXISTS eventos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    local TEXT NOT NULL,
    template_id INTEGER,
    data_inicio DATETIME NOT NULL,
    data_fim DATETIME NOT NULL,
    status TEXT DEFAULT 'planejamento' CHECK(status IN ('planejamento', 'aprovado', 'em_andamento', 'concluido', 'cancelado')),
    observacoes TEXT,
    criado_por INTEGER NOT NULL,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES templates_eventos(id),
    FOREIGN KEY (criado_por) REFERENCES usuarios(id)
);

-- Tabela de Responsáveis por Evento
CREATE TABLE IF NOT EXISTS responsaveis_evento (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evento_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    area TEXT NOT NULL CHECK(area IN ('som', 'iluminacao', 'palco', 'geral', 'coordenacao')),
    tipo TEXT NOT NULL CHECK(tipo IN ('entrega', 'recebimento', 'coordenador')),
    FOREIGN KEY (evento_id) REFERENCES eventos(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- Tabela de Equipamentos Alocados em Eventos
CREATE TABLE IF NOT EXISTS equipamentos_evento (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evento_id INTEGER NOT NULL,
    equipamento_id INTEGER NOT NULL,
    responsavel_id INTEGER,
    area TEXT CHECK(area IN ('som', 'iluminacao', 'palco', 'geral')),
    quantidade INTEGER DEFAULT 1,
    status TEXT DEFAULT 'planejado' CHECK(status IN ('planejado', 'confirmado', 'em_transito', 'entregue', 'devolvido')),
    observacoes TEXT,
    FOREIGN KEY (evento_id) REFERENCES eventos(id),
    FOREIGN KEY (equipamento_id) REFERENCES equipamentos(id),
    FOREIGN KEY (responsavel_id) REFERENCES usuarios(id)
);

-- Tabela de Transferências de Equipamentos
CREATE TABLE IF NOT EXISTS transferencias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    equipamento_id INTEGER NOT NULL,
    origem_tipo TEXT NOT NULL CHECK(origem_tipo IN ('deposito', 'evento', 'usuario')),
    origem_id INTEGER NOT NULL,
    destino_tipo TEXT NOT NULL CHECK(destino_tipo IN ('deposito', 'evento', 'usuario')),
    destino_id INTEGER NOT NULL,
    solicitante_id INTEGER NOT NULL,
    responsavel_entrega_id INTEGER,
    responsavel_recebimento_id INTEGER,
    coordenador_id INTEGER,
    status TEXT DEFAULT 'pendente' CHECK(status IN ('pendente', 'aprovada_coordenador', 'em_transito', 'concluida', 'cancelada')),
    aprovacao_coordenador INTEGER DEFAULT 0,
    aprovacao_entrega INTEGER DEFAULT 0,
    aprovacao_recebimento INTEGER DEFAULT 0,
    data_solicitacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_aprovacao DATETIME,
    data_conclusao DATETIME,
    motivo TEXT,
    observacoes TEXT,
    FOREIGN KEY (equipamento_id) REFERENCES equipamentos(id),
    FOREIGN KEY (solicitante_id) REFERENCES usuarios(id),
    FOREIGN KEY (responsavel_entrega_id) REFERENCES usuarios(id),
    FOREIGN KEY (responsavel_recebimento_id) REFERENCES usuarios(id),
    FOREIGN KEY (coordenador_id) REFERENCES usuarios(id)
);

-- Tabela de Histórico de Movimentações
CREATE TABLE IF NOT EXISTS historico_movimentacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    equipamento_id INTEGER NOT NULL,
    tipo_movimentacao TEXT NOT NULL,
    origem TEXT,
    destino TEXT,
    usuario_id INTEGER NOT NULL,
    data_movimentacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    observacoes TEXT,
    FOREIGN KEY (equipamento_id) REFERENCES equipamentos(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- Índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_equipamentos_status ON equipamentos(status);
CREATE INDEX IF NOT EXISTS idx_equipamentos_deposito ON equipamentos(deposito_id);
CREATE INDEX IF NOT EXISTS idx_transferencias_status ON transferencias(status);
CREATE INDEX IF NOT EXISTS idx_eventos_status ON eventos(status);
CREATE INDEX IF NOT EXISTS idx_eventos_data ON eventos(data_inicio, data_fim);
