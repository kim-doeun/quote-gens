const express = require('express');
const crypto = require('crypto');

/**
 * Generic RESTful Table API, matching the shape the front-end already
 * speaks (js/common.js apiList/apiGet/apiCreate/apiUpdate/apiDelete):
 *   GET    /tables/:table        -> { data: [...] }
 *   GET    /tables/:table/:id    -> {...record}
 *   POST   /tables/:table        -> {...record} (created)
 *   PATCH  /tables/:table/:id    -> {...record} (updated)
 *   DELETE /tables/:table/:id    -> 204
 *
 * `tables` is a map of table name -> field definitions loaded from
 * .tables/schema.json, so this stays in sync with the schema without
 * needing hand-written routes per table.
 */
function buildTablesRouter(db, tables) {
  const router = express.Router();

  function getFields(req, res) {
    const fields = tables[req.params.table];
    if (!fields) {
      res.status(404).json({ error: `Unknown table: ${req.params.table}` });
      return null;
    }
    return fields;
  }

  function coerceValue(type, value) {
    if (value === undefined || value === null) return null;
    if (type === 'number') return value === '' ? null : Number(value);
    if (type === 'bool') return value ? 1 : 0;
    return String(value);
  }

  function rowToRecord(fields, row) {
    const record = { id: row.id };
    for (const f of fields) {
      record[f.name] = f.type === 'bool' ? !!row[f.name] : row[f.name];
    }
    record.created_at = row.created_at;
    record.updated_at = row.updated_at;
    return record;
  }

  router.get('/:table', (req, res) => {
    const fields = getFields(req, res);
    if (!fields) return;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 1000, 1), 5000);
    const rows = db
      .prepare(`SELECT * FROM "${req.params.table}" ORDER BY created_at DESC LIMIT ?`)
      .all(limit);
    res.json({ data: rows.map((r) => rowToRecord(fields, r)), total: rows.length });
  });

  router.get('/:table/:id', (req, res) => {
    const fields = getFields(req, res);
    if (!fields) return;
    const row = db.prepare(`SELECT * FROM "${req.params.table}" WHERE id = ?`).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(rowToRecord(fields, row));
  });

  router.post('/:table', (req, res) => {
    const fields = getFields(req, res);
    if (!fields) return;
    const body = req.body || {};
    const id = body.id || crypto.randomUUID();
    const now = new Date().toISOString();

    const columns = ['id', ...fields.map((f) => f.name), 'created_at', 'updated_at'];
    const values = [id, ...fields.map((f) => coerceValue(f.type, body[f.name])), now, now];
    const placeholders = columns.map(() => '?').join(', ');

    db.prepare(
      `INSERT INTO "${req.params.table}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders})`
    ).run(...values);

    const row = db.prepare(`SELECT * FROM "${req.params.table}" WHERE id = ?`).get(id);
    res.status(201).json(rowToRecord(fields, row));
  });

  router.patch('/:table/:id', (req, res) => {
    const fields = getFields(req, res);
    if (!fields) return;
    const { table, id } = req.params;
    const body = req.body || {};

    const existing = db.prepare(`SELECT * FROM "${table}" WHERE id = ?`).get(id);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const updatable = fields.filter((f) => Object.prototype.hasOwnProperty.call(body, f.name));
    if (updatable.length) {
      const setClause = updatable.map((f) => `"${f.name}" = ?`).join(', ');
      const values = updatable.map((f) => coerceValue(f.type, body[f.name]));
      db.prepare(`UPDATE "${table}" SET ${setClause}, updated_at = ? WHERE id = ?`).run(
        ...values,
        new Date().toISOString(),
        id
      );
    }

    const row = db.prepare(`SELECT * FROM "${table}" WHERE id = ?`).get(id);
    res.json(rowToRecord(fields, row));
  });

  router.delete('/:table/:id', (req, res) => {
    const fields = getFields(req, res);
    if (!fields) return;
    const result = db.prepare(`DELETE FROM "${req.params.table}" WHERE id = ?`).run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).end();
  });

  return router;
}

module.exports = buildTablesRouter;
