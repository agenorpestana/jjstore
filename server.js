import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import bodyParser from 'body-parser';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(bodyParser.json({ limit: '50mb' }));

// ---------- DATABASE ----------
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  multipleStatements: true,
  ssl: process.env.DB_USE_SSL === 'true'
    ? { rejectUnauthorized: false }
    : undefined
};

let pool;

async function initDB() {
  try {
    pool = mysql.createPool(dbConfig);
    await pool.query('SELECT 1');
    console.log('MySQL conectado');
  } catch (err) {
    console.error('Erro MySQL:', err.message);
  }
}

await initDB();

// ---------- HEALTH CHECK ----------
app.get('/', (req, res) => {
  res.send('JJSTORE API ONLINE 🚀');
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', port: PORT });
});

// ---------- ORDERS ----------
app.get('/api/orders', async (req, res) => {
  try {
    const [orders] = await pool.query('SELECT * FROM orders');
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ⚠️ mantenha o restante das rotas exatamente como você já tem
// (orders/:id, post, put, patch, delete, employees, login, etc)

// ---------- START SERVER ----------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
