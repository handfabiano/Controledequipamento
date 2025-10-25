const { db, getAsync, allAsync, runAsync, gerarTombamento, gerarCodigo } = require('../database/init');
const QRCode = require('qrcode');
const cache = require('../cache');

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
        const searchClause = ' AND (e.codigo LIKE ? OR e.tombamento LIKE ? OR e.nome LIKE ? OR e.marca LIKE ? OR e.modelo LIKE ?)';
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

      // Gerar ou validar código
      if (!codigo && !prefixo) {
        return res.status(400).json({
          error: 'Código ou prefixo é obrigatório',
          exemplo: 'Código completo: MIC0001 ou Prefixo: MIC (sistema gera automaticamente MIC0001, MIC0002, etc)'
        });
      }

      // Se foi fornecido apenas o prefixo (3 letras), gerar código automaticamente
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

      db.run(
        `INSERT INTO equipamentos (codigo, tombamento, nome, categoria_id, marca, modelo, numero_serie, deposito_id, condicao, observacoes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [codigo, tombamento, nome, categoria_id, marca, modelo, numero_serie, deposito_id, condicao || 'bom', observacoes],
        async function(err) {
          if (err) {
            console.error('Erro ao criar equipamento:', err);
            return res.status(500).json({ error: 'Erro ao criar equipamento' });
          }

          // Registrar no histórico
          await runAsync(
            'INSERT INTO historico_movimentacoes (equipamento_id, tipo_movimentacao, destino, usuario_id, observacoes) VALUES (?, ?, ?, ?, ?)',
            [this.lastID, 'criacao', deposito_id ? `Depósito ID: ${deposito_id}` : 'Sem depósito', req.user.id, 'Equipamento criado']
          );

          res.status(201).json({
            message: 'Equipamento criado com sucesso',
            id: this.lastID,
            codigo: codigo
          });
        }
      );
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

      db.run(
        `UPDATE equipamentos
         SET nome = ?, categoria_id = ?, marca = ?, modelo = ?, numero_serie = ?,
             deposito_id = ?, status = ?, condicao = ?, observacoes = ?,
             atualizado_em = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [nome || equipamento.nome,
         categoria_id || equipamento.categoria_id,
         marca || equipamento.marca,
         modelo || equipamento.modelo,
         numero_serie || equipamento.numero_serie,
         deposito_id !== undefined ? deposito_id : equipamento.deposito_id,
         status || equipamento.status,
         condicao || equipamento.condicao,
         observacoes !== undefined ? observacoes : equipamento.observacoes,
         id],
        async function(err) {
          if (err) {
            console.error('Erro ao atualizar equipamento:', err);
            return res.status(500).json({ error: 'Erro ao atualizar equipamento' });
          }

          // Registrar alteração no histórico
          await runAsync(
            'INSERT INTO historico_movimentacoes (equipamento_id, tipo_movimentacao, usuario_id, observacoes) VALUES (?, ?, ?, ?)',
            [id, 'atualizacao', req.user.id, 'Dados do equipamento atualizados']
          );

          res.json({ message: 'Equipamento atualizado com sucesso' });
        }
      );
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

      db.run(
        'INSERT INTO problemas_equipamentos (equipamento_id, descricao, gravidade, reportado_por) VALUES (?, ?, ?, ?)',
        [id, descricao, gravidade, req.user.id],
        async function(err) {
          if (err) {
            console.error('Erro ao reportar problema:', err);
            return res.status(500).json({ error: 'Erro ao reportar problema' });
          }

          // Atualizar status do equipamento se gravidade for alta ou crítica
          if (gravidade === 'alta' || gravidade === 'critica') {
            await runAsync(
              'UPDATE equipamentos SET status = ?, condicao = ? WHERE id = ?',
              ['com_problema', gravidade === 'critica' ? 'quebrado' : 'ruim', id]
            );
          }

          res.status(201).json({
            message: 'Problema reportado com sucesso',
            id: this.lastID
          });
        }
      );
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

      await runAsync(
        'UPDATE problemas_equipamentos SET resolvido = 1, resolvido_por = ?, data_resolucao = CURRENT_TIMESTAMP WHERE id = ?',
        [req.user.id, problemaId]
      );

      // Verificar se há outros problemas não resolvidos
      const outrosProblemas = await allAsync(
        'SELECT * FROM problemas_equipamentos WHERE equipamento_id = ? AND resolvido = 0 AND id != ?',
        [id, problemaId]
      );

      // Se não houver mais problemas, atualizar status do equipamento
      if (outrosProblemas.length === 0) {
        await runAsync(
          'UPDATE equipamentos SET status = ?, condicao = ? WHERE id = ?',
          ['disponivel', 'bom', id]
        );
      }

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
          <title>Etiqueta - ${equipamento.codigo}</title>
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
              <div class="codigo">${equipamento.codigo}</div>
              <div class="info">${equipamento.nome}</div>
              <div class="info">${equipamento.marca || ''} ${equipamento.modelo || ''}</div>
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

      res.setHeader('Content-Type', 'text/html');
      res.send(etiquetaHTML);
    } catch (error) {
      console.error('Erro ao gerar etiqueta:', error);
      res.status(500).json({ error: 'Erro ao gerar etiqueta' });
    }
  }
};

module.exports = equipamentosController;
