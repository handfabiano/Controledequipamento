const { getAsync, allAsync, runAsync, gerarTombamento, gerarCodigo } = require('../database/init');
const QRCode = require('qrcode');
const cache = require('../cache');
const { recalcularStatus, temProblemaGrave } = require('../services/equipamentoStatus');

// Status que o usuário pode definir manualmente; os demais são derivados pelo sistema
// (problemas, transferências e eventos) — ver services/equipamentoStatus.js
const STATUS_MANUAIS = ['disponivel', 'manutencao'];

const escapeHtml = (valor) =>
  String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const erroDeUnicidade = (error) =>
  error && (error.code === '23505' || error.code === 'SQLITE_CONSTRAINT' ||
    /UNIQUE constraint failed/i.test(error.message || ''));

const equipamentosController = {
  // Listar todos os equipamentos com filtros
  async listar(req, res) {
    try {
      const {
        status,
        categoria_id,
        deposito_id,
        search,
        page = 1,
        limit = 50
      } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);

      let query = `
        SELECT e.*, c.nome as categoria_nome, c.tipo as categoria_tipo,
               d.nome as deposito_nome
        FROM equipamentos e
        LEFT JOIN categorias_equipamentos c ON e.categoria_id = c.id
        LEFT JOIN depositos d ON e.deposito_id = d.id
        WHERE 1=1
      `;

      let countQuery = `SELECT COUNT(*) as total FROM equipamentos e WHERE 1=1`;

      const params = [];
      const countParams = [];

      if (status) {
        query += ' AND e.status = ?';
        countQuery += ' AND e.status = ?';
        params.push(status);
        countParams.push(status);
      }

      if (categoria_id) {
        query += ' AND e.categoria_id = ?';
        countQuery += ' AND e.categoria_id = ?';
        params.push(categoria_id);
        countParams.push(categoria_id);
      }

      if (deposito_id) {
        query += ' AND e.deposito_id = ?';
        countQuery += ' AND e.deposito_id = ?';
        params.push(deposito_id);
        countParams.push(deposito_id);
      }

      if (search) {
        const searchClause = ' AND (UPPER(e.codigo) LIKE UPPER(?) OR UPPER(e.tombamento) LIKE UPPER(?) OR UPPER(e.nome) LIKE UPPER(?) OR UPPER(e.marca) LIKE UPPER(?) OR UPPER(e.modelo) LIKE UPPER(?))';
        query += searchClause;
        countQuery += searchClause;
        const searchParam = `%${search}%`;
        params.push(searchParam, searchParam, searchParam, searchParam, searchParam);
        countParams.push(searchParam, searchParam, searchParam, searchParam, searchParam);
      }

      query += ' ORDER BY e.codigo LIMIT ? OFFSET ?';
      params.push(parseInt(limit), offset);

      const [equipamentos, totalResult] = await Promise.all([
        allAsync(query, params),
        getAsync(countQuery, countParams)
      ]);

      // Buscar problemas não resolvidos para cada equipamento
      if (equipamentos.length > 0) {
        const ids = equipamentos.map(e => e.id);
        const placeholders = ids.map(() => '?').join(',');

        const problemas = await allAsync(
          `SELECT * FROM problemas_equipamentos
           WHERE equipamento_id IN (${placeholders}) AND resolvido = 0
           ORDER BY data_relato DESC`,
          ids
        );

        // Agrupar problemas por equipamento_id
        const problemasMap = {};
        problemas.forEach(p => {
          if (!problemasMap[p.equipamento_id]) {
            problemasMap[p.equipamento_id] = [];
          }
          problemasMap[p.equipamento_id].push(p);
        });

        // Adicionar aos equipamentos
        equipamentos.forEach(eq => {
          eq.problemas_ativos = problemasMap[eq.id] || [];
        });
      }

      res.json({
        data: equipamentos,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalResult.total,
          totalPages: Math.ceil(totalResult.total / parseInt(limit)),
          hasNext: offset + equipamentos.length < totalResult.total,
          hasPrev: parseInt(page) > 1
        }
      });
    } catch (error) {
      console.error('Erro ao listar equipamentos:', error);
      res.status(500).json({ error: 'Erro ao listar equipamentos' });
    }
  },

  // Buscar equipamento por ID
  async buscarPorId(req, res) {
    try {
      const { id } = req.params;

      const equipamento = await getAsync(`
        SELECT e.*, c.nome as categoria_nome, c.tipo as categoria_tipo,
               d.nome as deposito_nome
        FROM equipamentos e
        LEFT JOIN categorias_equipamentos c ON e.categoria_id = c.id
        LEFT JOIN depositos d ON e.deposito_id = d.id
        WHERE e.id = ?
      `, [id]);

      if (!equipamento) {
        return res.status(404).json({ error: 'Equipamento não encontrado' });
      }

      // Buscar problemas
      const problemas = await allAsync(
        'SELECT p.*, u.nome as reportado_por_nome FROM problemas_equipamentos p LEFT JOIN usuarios u ON p.reportado_por = u.id WHERE p.equipamento_id = ? ORDER BY p.data_relato DESC',
        [id]
      );

      // Buscar histórico
      const historico = await allAsync(
        'SELECT h.*, u.nome as usuario_nome FROM historico_movimentacoes h LEFT JOIN usuarios u ON h.usuario_id = u.id WHERE h.equipamento_id = ? ORDER BY h.data_movimentacao DESC LIMIT 20',
        [id]
      );

      equipamento.problemas = problemas;
      equipamento.historico = historico;

      res.json(equipamento);
    } catch (error) {
      console.error('Erro ao buscar equipamento:', error);
      res.status(500).json({ error: 'Erro ao buscar equipamento' });
    }
  },

  // Criar equipamento
  async criar(req, res) {
    try {
      let { codigo, prefixo, nome, categoria_id, marca, modelo, numero_serie, deposito_id, condicao, observacoes } = req.body;

      if (!nome || !categoria_id) {
        return res.status(400).json({ error: 'Nome e categoria são obrigatórios' });
      }

      const categoria = await getAsync('SELECT id FROM categorias_equipamentos WHERE id = ?', [categoria_id]);
      if (!categoria) {
        return res.status(400).json({ error: 'Categoria não encontrada' });
      }

      if (deposito_id) {
        const deposito = await getAsync('SELECT id FROM depositos WHERE id = ?', [deposito_id]);
        if (!deposito) {
          return res.status(400).json({ error: 'Depósito não encontrado' });
        }
      }

      // Gerar ou validar código
      if (!codigo && !prefixo) {
        return res.status(400).json({
          error: 'Código ou prefixo é obrigatório',
          exemplo: 'Código completo: MIC0001 ou Prefixo: MIC (sistema gera automaticamente MIC0001, MIC0002, etc)'
        });
      }

      // Se foi fornecido apenas o prefixo (3 letras), gerar código automaticamente
      const usouPrefixo = Boolean(prefixo && !codigo);
      if (prefixo && !codigo) {
        if (prefixo.length !== 3 || !/^[A-Z]{3}$/.test(prefixo)) {
          return res.status(400).json({ error: 'Prefixo deve conter exatamente 3 letras maiúsculas (ex: MIC, CAI, MES)' });
        }
        codigo = await gerarCodigo(prefixo);
      }

      // Validar formato do código (XXX0000)
      if (!/^[A-Z]{3}\d{4}$/.test(codigo)) {
        return res.status(400).json({
          error: 'Código deve estar no formato XXX0000 (3 letras maiúsculas + 4 números)',
          exemplo: 'MIC0001, CAI0025, MES0003'
        });
      }

      // Verificar se código já existe
      const existe = await getAsync('SELECT id FROM equipamentos WHERE codigo = ?', [codigo]);
      if (existe) {
        return res.status(400).json({ error: `Código ${codigo} já existe` });
      }

      // Gerar tombamento único (uso interno apenas)
      let tombamento = gerarTombamento();
      let tombamentoExiste = await getAsync('SELECT id FROM equipamentos WHERE tombamento = ?', [tombamento]);

      // Garantir que o tombamento é único
      while (tombamentoExiste) {
        tombamento = gerarTombamento();
        tombamentoExiste = await getAsync('SELECT id FROM equipamentos WHERE tombamento = ?', [tombamento]);
      }

      const inserir = () => runAsync(
        `INSERT INTO equipamentos (codigo, tombamento, nome, categoria_id, marca, modelo, numero_serie, deposito_id, condicao, observacoes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [codigo, tombamento, nome, categoria_id, marca, modelo, numero_serie, deposito_id, condicao || 'bom', observacoes]
      );

      let result;
      try {
        result = await inserir();
      } catch (error) {
        // Duas criações simultâneas com o mesmo prefixo geram o mesmo código: o banco
        // recusa a segunda (UNIQUE). Para código automático, tenta de novo com o próximo.
        if (!erroDeUnicidade(error) || !usouPrefixo) throw error;
        codigo = await gerarCodigo(prefixo);
        result = await inserir();
      }

      // Registrar no histórico
      await runAsync(
        'INSERT INTO historico_movimentacoes (equipamento_id, tipo_movimentacao, destino, usuario_id, observacoes) VALUES (?, ?, ?, ?, ?)',
        [result.lastID, 'criacao', deposito_id ? `Depósito ID: ${deposito_id}` : 'Sem depósito', req.user.id, 'Equipamento criado']
      );

      res.status(201).json({
        message: 'Equipamento criado com sucesso',
        id: result.lastID,
        codigo: codigo
      });
    } catch (error) {
      console.error('Erro ao criar equipamento:', error);
      res.status(500).json({ error: 'Erro ao criar equipamento' });
    }
  },

  // Atualizar equipamento
  async atualizar(req, res) {
    try {
      const { id } = req.params;
      const { nome, categoria_id, marca, modelo, numero_serie, deposito_id, status, condicao, observacoes } = req.body;

      const equipamento = await getAsync('SELECT * FROM equipamentos WHERE id = ?', [id]);

      if (!equipamento) {
        return res.status(404).json({ error: 'Equipamento não encontrado' });
      }

      // em_uso, transferencia e com_problema são derivados de eventos, transferências e
      // problemas; aceitar manualmente deixaria o status em desacordo com a realidade.
      if (status && status !== equipamento.status && !STATUS_MANUAIS.includes(status)) {
        return res.status(400).json({
          error: `O status "${status}" é controlado pelo sistema (eventos, transferências e problemas). Defina apenas: ${STATUS_MANUAIS.join(', ')}`
        });
      }

      if (categoria_id) {
        const categoria = await getAsync('SELECT id FROM categorias_equipamentos WHERE id = ?', [categoria_id]);
        if (!categoria) {
          return res.status(400).json({ error: 'Categoria não encontrada' });
        }
      }

      if (deposito_id) {
        const deposito = await getAsync('SELECT id FROM depositos WHERE id = ?', [deposito_id]);
        if (!deposito) {
          return res.status(400).json({ error: 'Depósito não encontrado' });
        }
      }

      // Campos opcionais podem ser limpos enviando string vazia
      const textoOpcional = (novo, atual) => (novo !== undefined ? (novo === '' ? null : novo) : atual);

      await runAsync(
        `UPDATE equipamentos
         SET nome = ?, categoria_id = ?, marca = ?, modelo = ?, numero_serie = ?,
             deposito_id = ?, status = ?, condicao = ?, observacoes = ?,
             atualizado_em = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [nome || equipamento.nome,
         categoria_id || equipamento.categoria_id,
         textoOpcional(marca, equipamento.marca),
         textoOpcional(modelo, equipamento.modelo),
         textoOpcional(numero_serie, equipamento.numero_serie),
         deposito_id !== undefined ? deposito_id : equipamento.deposito_id,
         status || equipamento.status,
         condicao || equipamento.condicao,
         textoOpcional(observacoes, equipamento.observacoes),
         id]
      );

      // "disponivel" manual significa "liberar": o status passa a refletir a situação real
      // (ex.: continua em_uso se estiver alocado em evento)
      if (status === 'disponivel') {
        await recalcularStatus(id);
      }

      // Registrar alteração no histórico
      await runAsync(
        'INSERT INTO historico_movimentacoes (equipamento_id, tipo_movimentacao, usuario_id, observacoes) VALUES (?, ?, ?, ?)',
        [id, 'atualizacao', req.user.id, 'Dados do equipamento atualizados']
      );

      res.json({ message: 'Equipamento atualizado com sucesso' });
    } catch (error) {
      console.error('Erro ao atualizar equipamento:', error);
      res.status(500).json({ error: 'Erro ao atualizar equipamento' });
    }
  },

  // Reportar problema
  async reportarProblema(req, res) {
    try {
      const { id } = req.params;
      const { descricao, gravidade } = req.body;

      if (!descricao || !gravidade) {
        return res.status(400).json({ error: 'Descrição e gravidade são obrigatórios' });
      }

      const equipamento = await getAsync('SELECT * FROM equipamentos WHERE id = ?', [id]);

      if (!equipamento) {
        return res.status(404).json({ error: 'Equipamento não encontrado' });
      }

      const result = await runAsync(
        'INSERT INTO problemas_equipamentos (equipamento_id, descricao, gravidade, reportado_por) VALUES (?, ?, ?, ?)',
        [id, descricao, gravidade, req.user.id]
      );

      // Problema alta/crítica degrada a condição ("quebrado" nunca é rebaixado para "ruim")
      // e o status passa a ser com_problema (derivado, ver services/equipamentoStatus.js)
      if (gravidade === 'alta' || gravidade === 'critica') {
        const condicaoNova = gravidade === 'critica' || equipamento.condicao === 'quebrado' ? 'quebrado' : 'ruim';
        await runAsync('UPDATE equipamentos SET condicao = ? WHERE id = ?', [condicaoNova, id]);
      }
      await recalcularStatus(id);

      res.status(201).json({
        message: 'Problema reportado com sucesso',
        id: result.lastID
      });
    } catch (error) {
      console.error('Erro ao reportar problema:', error);
      res.status(500).json({ error: 'Erro ao reportar problema' });
    }
  },

  // Resolver problema
  async resolverProblema(req, res) {
    try {
      const { id, problemaId } = req.params;

      const problema = await getAsync(
        'SELECT * FROM problemas_equipamentos WHERE id = ? AND equipamento_id = ?',
        [problemaId, id]
      );

      if (!problema) {
        return res.status(404).json({ error: 'Problema não encontrado' });
      }

      if (problema.resolvido) {
        return res.status(400).json({ error: 'Este problema já foi resolvido' });
      }

      await runAsync(
        'UPDATE problemas_equipamentos SET resolvido = 1, resolvido_por = ?, data_resolucao = CURRENT_TIMESTAMP WHERE id = ?',
        [req.user.id, problemaId]
      );

      // Sem problemas graves restantes, a condição degradada pelo relato volta a "bom".
      // O status é recalculado: um equipamento alocado em evento ou em transferência
      // NÃO volta a "disponível" só porque um problema foi resolvido.
      if (!(await temProblemaGrave(id))) {
        await runAsync(
          "UPDATE equipamentos SET condicao = 'bom' WHERE id = ? AND condicao IN ('ruim', 'quebrado')",
          [id]
        );
      }
      await recalcularStatus(id);

      res.json({ message: 'Problema resolvido com sucesso' });
    } catch (error) {
      console.error('Erro ao resolver problema:', error);
      res.status(500).json({ error: 'Erro ao resolver problema' });
    }
  },

  // Listar categorias
  async listarCategorias(req, res) {
    try {
      const cacheKey = 'categorias:all';

      // Tentar buscar do cache
      let categorias = cache.get(cacheKey);

      if (!categorias) {
        // Buscar do banco
        categorias = await allAsync('SELECT * FROM categorias_equipamentos ORDER BY tipo, nome');

        // Salvar no cache por 24 horas (86400 segundos)
        cache.set(cacheKey, categorias, 86400);
      }

      res.json(categorias);
    } catch (error) {
      console.error('Erro ao listar categorias:', error);
      res.status(500).json({ error: 'Erro ao listar categorias' });
    }
  },

  // Buscar equipamento por tombamento
  async buscarPorTombamento(req, res) {
    try {
      const { tombamento } = req.params;

      const equipamento = await getAsync(`
        SELECT e.*, c.nome as categoria_nome, c.tipo as categoria_tipo,
               d.nome as deposito_nome
        FROM equipamentos e
        LEFT JOIN categorias_equipamentos c ON e.categoria_id = c.id
        LEFT JOIN depositos d ON e.deposito_id = d.id
        WHERE e.tombamento = ?
      `, [tombamento]);

      if (!equipamento) {
        return res.status(404).json({ error: 'Equipamento não encontrado' });
      }

      // Buscar problemas ativos
      const problemas = await allAsync(
        'SELECT * FROM problemas_equipamentos WHERE equipamento_id = ? AND resolvido = 0 ORDER BY data_relato DESC',
        [equipamento.id]
      );

      equipamento.problemas_ativos = problemas;

      res.json(equipamento);
    } catch (error) {
      console.error('Erro ao buscar equipamento por tombamento:', error);
      res.status(500).json({ error: 'Erro ao buscar equipamento' });
    }
  },

  // Gerar QR Code para equipamento
  async gerarQRCode(req, res) {
    try {
      const { id } = req.params;

      const equipamento = await getAsync('SELECT * FROM equipamentos WHERE id = ?', [id]);

      if (!equipamento) {
        return res.status(404).json({ error: 'Equipamento não encontrado' });
      }

      // Dados para o QR Code (tombamento)
      const qrData = equipamento.tombamento;

      // Gerar QR Code em base64
      const qrCodeDataURL = await QRCode.toDataURL(qrData, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        width: 300,
        margin: 2
      });

      // Atualizar flag de QR Code gerado
      await runAsync('UPDATE equipamentos SET qrcode_gerado = 1 WHERE id = ?', [id]);

      res.json({
        qrcode: qrCodeDataURL,
        equipamento: {
          id: equipamento.id,
          codigo: equipamento.codigo,
          nome: equipamento.nome
        }
      });
    } catch (error) {
      console.error('Erro ao gerar QR Code:', error);
      res.status(500).json({ error: 'Erro ao gerar QR Code' });
    }
  },

  // Gerar etiqueta completa (HTML para impressão)
  async gerarEtiqueta(req, res) {
    try {
      const { id } = req.params;

      const equipamento = await getAsync(`
        SELECT e.*, c.nome as categoria_nome
        FROM equipamentos e
        LEFT JOIN categorias_equipamentos c ON e.categoria_id = c.id
        WHERE e.id = ?
      `, [id]);

      if (!equipamento) {
        return res.status(404).json({ error: 'Equipamento não encontrado' });
      }

      // Gerar QR Code
      const qrCodeDataURL = await QRCode.toDataURL(equipamento.tombamento, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        width: 200,
        margin: 1
      });

      // HTML da etiqueta
      const etiquetaHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Etiqueta - ${escapeHtml(equipamento.codigo)}</title>
          <style>
            @page { size: 10cm 5cm; margin: 0; }
            body {
              margin: 0;
              padding: 10px;
              font-family: Arial, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 5cm;
              width: 10cm;
            }
            .etiqueta {
              border: 2px solid #000;
              padding: 10px;
              text-align: center;
              width: 100%;
              height: 100%;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
            }
            .header {
              font-size: 12px;
              font-weight: bold;
              margin-bottom: 3px;
              color: #666;
            }
            .codigo {
              font-size: 24px;
              font-weight: bold;
              margin: 5px 0;
              letter-spacing: 2px;
              color: #000;
            }
            .info {
              font-size: 11px;
              margin: 2px 0;
            }
            .qrcode {
              margin: 8px auto;
            }
            .qrcode img {
              width: 140px;
              height: 140px;
            }
            .footer {
              font-size: 8px;
              color: #999;
              margin-top: 3px;
            }
          </style>
        </head>
        <body>
          <div class="etiqueta">
            <div>
              <div class="header">EQUIPAMENTO</div>
              <div class="codigo">${escapeHtml(equipamento.codigo)}</div>
              <div class="info">${escapeHtml(equipamento.nome)}</div>
              <div class="info">${escapeHtml(equipamento.marca)} ${escapeHtml(equipamento.modelo)}</div>
            </div>
            <div class="qrcode">
              <img src="${qrCodeDataURL}" alt="QR Code" />
            </div>
            <div class="footer">
              Escaneie o QR Code para mais informações
            </div>
          </div>
        </body>
        </html>
      `;

      // Defesa em profundidade: a etiqueta não precisa de scripts nem de recursos externos
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Security-Policy', "default-src 'none'; img-src data:; style-src 'unsafe-inline'");
      res.send(etiquetaHTML);
    } catch (error) {
      console.error('Erro ao gerar etiqueta:', error);
      res.status(500).json({ error: 'Erro ao gerar etiqueta' });
    }
  }
};

module.exports = equipamentosController;
