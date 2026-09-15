const path = require('path');
const express = require('express');
const { db, tables } = require('./db');
const buildTablesRouter = require('./routes/tables');
const buildSlackRouter = require('./routes/slack');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());

app.use('/tables', buildTablesRouter(db, tables));
app.use('/api/slack', buildSlackRouter());

// Only the front-end assets are served statically (not server/, .git/,
// .tables/, or the sqlite data directory), so nothing beyond the app's
// html/css/js/images is ever reachable over HTTP.
app.use('/css', express.static(path.join(ROOT, 'css')));
app.use('/js', express.static(path.join(ROOT, 'js')));
app.use('/images', express.static(path.join(ROOT, 'images')));

const PAGES = [
  'index.html',
  'customers.html',
  'labor-rates.html',
  'products.html',
  'quote-detail.html',
  'quote-new.html',
  'quotes.html',
  'sales-reps.html',
];

for (const page of PAGES) {
  app.get(`/${page}`, (req, res) => res.sendFile(path.join(ROOT, page)));
}
app.get('/', (req, res) => res.sendFile(path.join(ROOT, 'index.html')));

app.listen(PORT, () => {
  console.log(`Lomin quote-gens server listening on port ${PORT}`);
});
