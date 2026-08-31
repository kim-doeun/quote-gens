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
}

module.exports = { db, tables };
