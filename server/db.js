const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'app.db');
const SCHEMA_PATH = path.join(__dirname, '..', '.tables', 'schema.json');

const SQL_TYPE_BY_FIELD_TYPE = {
  text: 'TEXT',
  number: 'REAL',
  bool: 'INTEGER',
  datetime: 'TEXT',
};

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schemaDefs = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));

// tables: table name -> field definitions (excluding "id", which is always the primary key)
const tables = {};

for (const table of schemaDefs) {
  const fields = table.fields.filter((f) => f.name !== 'id');
  tables[table.name] = fields;

  const columnDefs = fields
    .map((f) => `"${f.name}" ${SQL_TYPE_BY_FIELD_TYPE[f.type] || 'TEXT'}`)
    .join(',\n      ');

  db.exec(`
    CREATE TABLE IF NOT EXISTS "${table.name}" (
      id TEXT PRIMARY KEY,
      ${columnDefs}${columnDefs ? ',' : ''}
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Lightweight migration: if the table already existed (from an earlier
  // deployment) and schema.json has since gained new fields, add the
  // missing columns without touching existing data. Safe to run every
  // startup since it only ever adds columns that are not already present.
  const existingColumns = new Set(db.prepare(`PRAGMA table_info("${table.name}")`).all().map((c) => c.name));
  for (const f of fields) {
    if (!existingColumns.has(f.name)) {
      const sqlType = SQL_TYPE_BY_FIELD_TYPE[f.type] || 'TEXT';
      db.exec(`ALTER TABLE "${table.name}" ADD COLUMN "${f.name}" ${sqlType};`);
      console.log(`[db] Added missing column "${f.name}" to "${table.name}".`);
    }
  }
}

module.exports = { db, tables };
