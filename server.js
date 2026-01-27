
import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config'; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

app.use(express.static(path.join(__dirname, 'dist')));

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pedidos',
  multipleStatements: true,
  ssl: process.env.DB_USE_SSL === 'true' ? { rejectUnauthorized: false } : undefined
};

let pool;

async function initDB() {
  try {
    pool = mysql.createPool(dbConfig);

    const createTablesQuery = `
      CREATE TABLE IF NOT EXISTS plans (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50),
        price DECIMAL(10, 2),
        description TEXT,
        features TEXT
      );

      CREATE TABLE IF NOT EXISTS saas_settings (
        setting_key VARCHAR(50) PRIMARY KEY,
        setting_value LONGTEXT
      );

      CREATE TABLE IF NOT EXISTS companies (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100),
        plan VARCHAR(50),
        status VARCHAR(20) DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        trial_ends_at DATETIME,
        next_payment_due DATETIME,
        last_payment_date DATETIME
      );

      CREATE TABLE IF NOT EXISTS employees (
        id VARCHAR(50) PRIMARY KEY,
        company_id VARCHAR(50),
        name VARCHAR(100),
        role VARCHAR(50),
        contact VARCHAR(100),
        admittedDate VARCHAR(20),
        login VARCHAR(50),
        password VARCHAR(100),
        accessLevel VARCHAR(20),
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(50) PRIMARY KEY,
        company_id VARCHAR(50),
        customerName VARCHAR(100),
        customerPhone VARCHAR(50),
        orderDate VARCHAR(20),
        estimatedDelivery VARCHAR(20),
        total DECIMAL(10, 2),
        downPayment DECIMAL(10, 2),
        paymentMethod VARCHAR(100),
        shippingAddress TEXT,
        pressingDate VARCHAR(20),
        seamstress VARCHAR(100),
        currentStatus VARCHAR(50),
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id VARCHAR(50),
        name VARCHAR(100),
        size VARCHAR(20),
        quantity INT,
        price DECIMAL(10, 2),
        image TEXT,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS order_timeline (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id VARCHAR(50),
        status VARCHAR(50),
        timestamp VARCHAR(50),
        description TEXT,
        location VARCHAR(100),
        completed BOOLEAN,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS order_photos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id VARCHAR(50),
        photo_data LONGTEXT,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        setting_key VARCHAR(50),
        company_id VARCHAR(50),
        setting_value LONGTEXT,
        PRIMARY KEY (setting_key, company_id),
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
      );
    `;

    await pool.query(createTablesQuery);

    // --- MIGRATION CHECK ---
    const migrationQueries = [
       "ALTER TABLE orders ADD COLUMN pressingDate VARCHAR(20)",
       "ALTER TABLE orders ADD COLUMN seamstress VARCHAR(100)",
       "ALTER TABLE order_items ADD COLUMN size VARCHAR(20)",
       "ALTER TABLE orders ADD COLUMN company_id VARCHAR(50)",
       "ALTER TABLE employees ADD COLUMN company_id VARCHAR(50)",
       "ALTER TABLE app_settings ADD COLUMN company_id VARCHAR(50)",
       // New SaaS migrations
       "ALTER TABLE companies ADD COLUMN status VARCHAR(20) DEFAULT 'active'",
       "ALTER TABLE companies ADD COLUMN plan VARCHAR(50)",
       "ALTER TABLE companies ADD COLUMN trial_ends_at DATETIME",
       "ALTER TABLE companies ADD COLUMN next_payment_due DATETIME",
       "ALTER TABLE companies ADD COLUMN last_payment_date DATETIME"
    ];

    for (const query of migrationQueries) {
        try {
            await pool.query(query);
        } catch (e) {
            // Ignora erros
        }
    }

    // Seed Plans if empty
    const [plans] = await pool.query('SELECT * FROM plans');
    if (plans.length === 0) {
        await pool.query(`INSERT INTO plans (name, price, description, features) VALUES 
            ('Básico', 49.90, 'Para pequenas empresas', 'Até 50 pedidos/mês, 1 Usuário'),
            ('Pro', 99.90, 'Para empresas em crescimento', 'Pedidos Ilimitados, 5 Usuários, IA Inclusa'),
            ('Enterprise', 199.90, 'Para grandes operações', 'Tudo ilimitado, Suporte Prioritário')
        `);
    }

    // --- SAAS SUPER ADMIN (suporte / 200616) ---
    const [saasRows] = await pool.query('SELECT * FROM employees WHERE login = "suporte"');
    if (saasRows.length === 0) {
      await pool.query(`
        INSERT INTO employees (id, company_id, name, role, contact, admittedDate, login, password, accessLevel)
        VALUES ('SAAS_ADMIN', NULL, 'Suporte SaaS', 'Super Admin', 'suporte@rastreae.com', '01/01/2024', 'suporte', '200616', 'saas_admin')
      `);
      console.log('SaaS Super Admin created (suporte/200616)');
    }

    console.log('Database synced successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

initDB();

// --- MIDDLEWARE HELPERS ---
const getCompanyId = (req) => {
    return req.headers['x-company-id'] || null;
}

// --- CALCULATION HELPER ---
function calculateNextDueDate(currentNextDue, trialEndsAt) {
    const now = new Date();
    let baseDate = now;

    // Se já tem uma data de vencimento futura, usa ela como base
    if (currentNextDue && new Date(currentNextDue) > now) {
        baseDate = new Date(currentNextDue);
    } 
    // Se não tem vencimento, mas tem um trial futuro, usa o fim do trial como base
    else if (trialEndsAt && new Date(trialEndsAt) > now) {
        baseDate = new Date(trialEndsAt);
    }
    // Se tudo estiver no passado, a base continua sendo NOW

    // Adiciona 30 dias
    baseDate.setDate(baseDate.getDate() + 30);
    return baseDate;
}

// --- API Routes (Prefix /api) ---

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', port: PORT });
});

// --- SAAS SETTINGS (MP KEYS) ---
app.get('/api/saas/settings', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM saas_settings');
        const settings = { mpAccessToken: '', mpPublicKey: '' };
        rows.forEach(r => {
            if (r.setting_key === 'mpAccessToken') settings.mpAccessToken = r.setting_value;
            if (r.setting_key === 'mpPublicKey') settings.mpPublicKey = r.setting_value;
        });
        res.json(settings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/saas/settings', async (req, res) => {
    try {
        const { mpAccessToken, mpPublicKey } = req.body;
        await pool.query('INSERT INTO saas_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?', ['mpAccessToken', mpAccessToken, mpAccessToken]);
        await pool.query('INSERT INTO saas_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?', ['mpPublicKey', mpPublicKey, mpPublicKey]);
        res.json({ message: 'Settings saved' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- MERCADO PAGO INTEGRATION ---
// Helper to get MP Token
async function getMPAccessToken() {
    const [rows] = await pool.query("SELECT setting_value FROM saas_settings WHERE setting_key = 'mpAccessToken'");
    if (rows.length === 0) return null;
    return rows[0].setting_value;
}

app.post('/api/saas/checkout/:companyId', async (req, res) => {
    try {
        const { companyId } = req.params;
        const accessToken = await getMPAccessToken();
        
        if (!accessToken) return res.status(500).json({ error: "Configuração de pagamento não encontrada. Contate o suporte." });

        // Get Company Plan Info
        const [compRows] = await pool.query("SELECT name, plan FROM companies WHERE id = ?", [companyId]);
        if (compRows.length === 0) return res.status(404).json({ error: "Empresa não encontrada" });
        const company = compRows[0];

        // Get Plan Price
        const [planRows] = await pool.query("SELECT price FROM plans WHERE name = ?", [company.plan]);
        const price = planRows.length > 0 ? parseFloat(planRows[0].price) : 49.90;

        // Construção segura da URL Base
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.get('host');
        // Fallback para origin se host não estiver disponível ou para evitar problemas de CORS/Redirecionamento
        const baseUrl = req.headers.origin || `${protocol}://${host}`;

        const preferenceData = {
            items: [
                {
                    title: `Assinatura Rastreaê - Plano ${company.plan}`,
                    quantity: 1,
                    currency_id: 'BRL',
                    unit_price: Number(price)
                }
            ],
            external_reference: companyId,
            back_urls: {
                success: `${baseUrl}/api/saas/payment-success?company_id=${companyId}`,
                failure: `${baseUrl}/`,
                pending: `${baseUrl}/`
            },
            auto_return: "approved"
        };

        // Call Mercado Pago API manually to avoid SDK dependency issues in this setup
        const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(preferenceData)
        });

        const data = await response.json();
        
        if (data.init_point) {
            res.json({ checkoutUrl: data.init_point });
        } else {
            console.error("MP Error Data:", data);
            const msg = data.message || "Erro desconhecido do Mercado Pago";
            res.status(500).json({ error: `Erro MP: ${msg}`, details: data });
        }

    } catch (err) {
        console.error("Checkout Exception:", err);
        res.status(500).json({ error: err.message });
    }
});

// Callback route (Retorno simples do navegador)
app.get('/api/saas/payment-success', async (req, res) => {
    try {
        const { company_id } = req.query;
        if (!company_id) return res.redirect('/');

        // Recupera dados atuais para calcular corretamente a soma
        const [rows] = await pool.query("SELECT next_payment_due, trial_ends_at FROM companies WHERE id = ?", [company_id]);
        
        if (rows.length > 0) {
            const newDueDate = calculateNextDueDate(rows[0].next_payment_due, rows[0].trial_ends_at);
            
            await pool.query(
                "UPDATE companies SET status = 'active', last_payment_date = NOW(), next_payment_due = ? WHERE id = ?", 
                [newDueDate, company_id]
            );
        }

        // Redirect back to app home
        res.redirect('/');
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao processar pagamento." });
    }
});

// --- WEBHOOK MERCADO PAGO ---
// Processa notificações de pagamento
const handleWebhook = async (req, res) => {
    // 1. IMPORTANTE: Responder IMEDIATAMENTE ao Mercado Pago com 200 OK.
    res.status(200).json({ status: 'received' });

    // 2. Processamento Assíncrono (Background)
    try {
        const { type, data, action } = req.body;
        const isPayment = type === 'payment' || action === 'payment.created';
        
        console.log(`Webhook MP recebido (Async): Type=${type}, Action=${action}, DataID=${data?.id}`);

        if (isPayment && data?.id) {
            const accessToken = await getMPAccessToken();
            if (!accessToken) {
                console.error("Webhook Error: Access Token não configurado.");
                return;
            }

            // Consultar o pagamento na API do MP
            const response = await fetch(`https://api.mercadopago.com/v1/payments/${data.id}`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (response.ok) {
                const payment = await response.json();
                console.log(`Webhook Pagamento ${data.id}: Status=${payment.status}`);

                if (payment.status === 'approved') {
                    const companyId = payment.external_reference;
                    
                    if (companyId) {
                         // Lógica de Renovação Corrigida (Cumulativa)
                        const [rows] = await pool.query("SELECT next_payment_due, trial_ends_at FROM companies WHERE id = ?", [companyId]);
                        
                        if (rows.length > 0) {
                            const newDueDate = calculateNextDueDate(rows[0].next_payment_due, rows[0].trial_ends_at);

                            await pool.query(
                                "UPDATE companies SET status = 'active', last_payment_date = NOW(), next_payment_due = ? WHERE id = ?", 
                                [newDueDate, companyId]
                            );
                            console.log(`Empresa ${companyId} renovada via Webhook até ${newDueDate}`);
                        }
                    }
                }
            } else {
                console.error("Erro ao consultar pagamento no MP:", await response.text());
            }
        }
    } catch (err) {
        console.error("Webhook Background Error:", err);
    }
};

// Mapeia nas duas rotas possíveis para garantir que funcione com sua configuração atual
app.post('/api/webhook/mercadopago', handleWebhook);
app.post('/subscription/webhook', handleWebhook);


// --- PLANS ROUTES (Public GET, Admin CRUD) ---
app.get('/api/plans', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM plans');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/plans', async (req, res) => {
    try {
        const { name, price, description, features } = req.body;
        await pool.query('INSERT INTO plans (name, price, description, features) VALUES (?, ?, ?, ?)', [name, price, description, features]);
        res.status(201).json({ message: 'Plano criado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/plans/:id', async (req, res) => {
    try {
        const { name, price, description, features } = req.body;
        await pool.query('UPDATE plans SET name=?, price=?, description=?, features=? WHERE id=?', [name, price, description, features, req.params.id]);
        res.json({ message: 'Plano atualizado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/plans/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM plans WHERE id=?', [req.params.id]);
        res.json({ message: 'Plano removido' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- SAAS ADMIN: COMPANIES MANAGEMENT ---
app.get('/api/saas/companies', async (req, res) => {
    try {
        const query = `
            SELECT c.*, 
                   MAX(e.name) as adminName, 
                   MAX(e.contact) as contact, 
                   MAX(e.login) as login 
            FROM companies c 
            LEFT JOIN employees e ON c.id = e.company_id AND e.accessLevel = 'admin'
            GROUP BY c.id
        `;
        const [rows] = await pool.query(query);
        res.json(rows);
    } catch (err) {
        console.error("SQL Error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/saas/companies/:id/status', async (req, res) => {
    try {
        const { status } = req.body; // 'active' or 'inactive'
        await pool.query('UPDATE companies SET status = ? WHERE id = ?', [status, req.params.id]);
        res.json({ message: 'Status updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// NOVO: Renovar manualmente (dinheiro em mãos)
app.post('/api/saas/companies/:id/renew', async (req, res) => {
    try {
        const { id } = req.params;
        // Pega data atual de vencimento e trial
        const [rows] = await pool.query("SELECT next_payment_due, trial_ends_at FROM companies WHERE id = ?", [id]);
        if (rows.length === 0) return res.status(404).json({ error: "Empresa não encontrada" });

        const newDueDate = calculateNextDueDate(rows[0].next_payment_due, rows[0].trial_ends_at);

        await pool.query(
            "UPDATE companies SET status = 'active', last_payment_date = NOW(), next_payment_due = ? WHERE id = ?",
            [newDueDate, id]
        );

        res.json({ message: 'Assinatura renovada manualmente com sucesso' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// NOVO: Excluir empresa com validação de pedidos
app.delete('/api/saas/companies/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verifica se tem pedidos
        const [orderCount] = await pool.query("SELECT COUNT(*) as count FROM orders WHERE company_id = ?", [id]);
        
        if (orderCount[0].count > 0) {
            return res.status(400).json({ error: "Não é possível excluir: Esta empresa possui pedidos cadastrados." });
        }

        // Se não tiver pedidos, pode excluir (Cascade cuidará de employees e settings)
        await pool.query("DELETE FROM companies WHERE id = ?", [id]);
        
        res.json({ message: 'Empresa excluída com sucesso' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// --- SAAS REGISTRATION ---
app.post('/api/register-company', async (req, res) => {
    if (!pool) return res.status(500).json({error: "DB Error"});
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const { companyName, adminName, login, password, contact, plan } = req.body;

        const companyId = `COMP-${Date.now()}`;
        
        // Trial logic: 7 days free
        const now = new Date();
        const trialEnd = new Date(now);
        trialEnd.setDate(now.getDate() + 7);

        await conn.query(
            'INSERT INTO companies (id, name, plan, status, trial_ends_at) VALUES (?, ?, ?, ?, ?)',
            [companyId, companyName, plan || 'Básico', 'trial', trialEnd]
        );

        const empId = `EMP-${Date.now()}`;
        await conn.query(
            `INSERT INTO employees (id, company_id, name, role, contact, admittedDate, login, password, accessLevel)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [empId, companyId, adminName, 'Administrador', contact, new Date().toLocaleDateString('pt-BR'), login, password, 'admin']
        );

        await conn.query('INSERT INTO app_settings (setting_key, setting_value, company_id) VALUES (?, ?, ?)', ['appName', companyName, companyId]);
        await conn.query('INSERT INTO app_settings (setting_key, setting_value, company_id) VALUES (?, ?, ?)', ['logoUrl', '', companyId]);

        await conn.commit();
        res.status(201).json({ message: 'Company registered successfully', companyId });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).json({ error: 'Erro ao registrar empresa. Verifique se o login já existe.' });
    } finally {
        conn.release();
    }
});

// --- Settings Routes (Scoped by Company) ---
app.get('/api/settings', async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        let query = 'SELECT * FROM app_settings';
        let params = [];

        if (companyId && companyId !== 'null') {
            query += ' WHERE company_id = ?';
            params.push(companyId);
        } else {
            return res.json({ appName: 'Rastreaê', logoUrl: '' });
        }

        const [rows] = await pool.query(query, params);
        const settings = { appName: 'Rastreaê', logoUrl: '' };
        rows.forEach(row => {
            if (row.setting_key === 'appName') settings.appName = row.setting_value;
            if (row.setting_key === 'logoUrl') settings.logoUrl = row.setting_value;
        });
        res.json(settings);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/settings', async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        if (!companyId) return res.status(401).json({ error: 'Company ID required' });

        const { appName, logoUrl } = req.body;
        
        await pool.query('INSERT INTO app_settings (setting_key, setting_value, company_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = ?', ['appName', appName, companyId, appName]);
        await pool.query('INSERT INTO app_settings (setting_key, setting_value, company_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = ?', ['logoUrl', logoUrl, companyId, logoUrl]);
        
        res.json({ message: 'Settings updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// --- Order Routes ---
app.get('/api/orders', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    // Permite verificar orders se estiver ativo OU se for SuperAdmin. 
    // Usuários com pending_payment serão barrados no login, mas API deve proteger também.
    // Simplificação: Deixamos o bloqueio no Login por enquanto, ou validamos aqui.
    if (!companyId) return res.status(403).json({ error: 'Access denied' });

    let query = 'SELECT * FROM orders';
    let params = [];

    if (companyId !== 'null') {
        query += ' WHERE company_id = ?';
        params.push(companyId);
    }

    const [orders] = await pool.query(query, params);
    
    const fullOrders = await Promise.all(orders.map(async (order) => {
      const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
      const [timeline] = await pool.query('SELECT * FROM order_timeline WHERE order_id = ?', [order.id]);
      const [photos] = await pool.query('SELECT photo_data FROM order_photos WHERE order_id = ?', [order.id]);

      return {
        ...order,
        total: parseFloat(order.total),
        downPayment: parseFloat(order.downPayment),
        items: items.map(i => ({...i, price: parseFloat(i.price)})),
        timeline: timeline.map(t => ({...t, completed: !!t.completed})),
        photos: photos.map(p => p.photo_data)
      };
    }));
    res.json(fullOrders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Public OR Private route
app.get('/api/orders/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    const order = rows[0];

    // Check if company is active for public view
    if (order.company_id) {
        const [compRows] = await pool.query('SELECT status FROM companies WHERE id = ?', [order.company_id]);
        if (compRows.length > 0 && compRows[0].status === 'inactive') {
            return res.status(403).json({ error: 'A empresa responsável por este pedido está temporariamente suspensa.' });
        }
        // pending_payment or trial expired usually doesn't block public tracking, just admin access.
    }

    const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    const [timeline] = await pool.query('SELECT * FROM order_timeline WHERE order_id = ?', [order.id]);
    const [photos] = await pool.query('SELECT photo_data FROM order_photos WHERE order_id = ?', [order.id]);

    const fullOrder = {
      ...order,
      total: parseFloat(order.total),
      downPayment: parseFloat(order.downPayment),
      items: items.map(i => ({...i, price: parseFloat(i.price)})),
      timeline: timeline.map(t => ({...t, completed: !!t.completed})),
      photos: photos.map(p => p.photo_data)
    };

    res.json(fullOrder);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/orders', async (req, res) => {
  if (!pool) return res.status(500).json({error: "DB Not Init"});
  const companyId = getCompanyId(req);
  if (!companyId) return res.status(403).json({ error: 'Company ID required' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const order = req.body;

    await conn.query(
      `INSERT INTO orders (id, company_id, customerName, customerPhone, orderDate, estimatedDelivery, total, downPayment, paymentMethod, shippingAddress, pressingDate, seamstress, currentStatus)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [order.id, companyId, order.customerName, order.customerPhone, order.orderDate, order.estimatedDelivery, order.total, order.downPayment, order.paymentMethod, order.shippingAddress, order.pressingDate, order.seamstress, order.currentStatus]
    );

    if (order.items && order.items.length > 0) {
      const itemValues = order.items.map(item => [order.id, item.name, item.size, item.quantity, item.price, item.image]);
      await conn.query('INSERT INTO order_items (order_id, name, size, quantity, price, image) VALUES ?', [itemValues]);
    }

    if (order.timeline && order.timeline.length > 0) {
      const timelineValues = order.timeline.map(t => [order.id, t.status, t.timestamp, t.description, t.location, t.completed]);
      await conn.query('INSERT INTO order_timeline (order_id, status, timestamp, description, location, completed) VALUES ?', [timelineValues]);
    }

    if (order.photos && order.photos.length > 0) {
      const photoValues = order.photos.map(p => [order.id, p]);
      await conn.query('INSERT INTO order_photos (order_id, photo_data) VALUES ?', [photoValues]);
    }

    await conn.commit();
    res.status(201).json(order);
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

app.put('/api/orders/:id', async (req, res) => {
  if (!pool) return res.status(500).json({error: "DB Not Init"});
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const orderId = req.params.id;
    const order = req.body;

    await conn.query(
      `UPDATE orders SET customerName=?, customerPhone=?, orderDate=?, estimatedDelivery=?, total=?, downPayment=?, paymentMethod=?, shippingAddress=?, pressingDate=?, seamstress=? WHERE id=?`,
      [order.customerName, order.customerPhone, order.orderDate, order.estimatedDelivery, order.total, order.downPayment, order.paymentMethod, order.shippingAddress, order.pressingDate, order.seamstress, orderId]
    );

    await conn.query('DELETE FROM order_items WHERE order_id = ?', [orderId]);
    if (order.items && order.items.length > 0) {
      const itemValues = order.items.map(item => [orderId, item.name, item.size, item.quantity, item.price, item.image]);
      await conn.query('INSERT INTO order_items (order_id, name, size, quantity, price, image) VALUES ?', [itemValues]);
    }

    await conn.query('DELETE FROM order_photos WHERE order_id = ?', [orderId]);
    if (order.photos && order.photos.length > 0) {
      const photoValues = order.photos.map(p => [orderId, p]);
      await conn.query('INSERT INTO order_photos (order_id, photo_data) VALUES ?', [photoValues]);
    }
    
    await conn.commit();
    res.json({ message: 'Order updated' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

app.patch('/api/orders/:id/status', async (req, res) => {
  if (!pool) return res.status(500).json({error: "DB Not Init"});
  const conn = await pool.getConnection();
  try {
      await conn.beginTransaction();
      const { currentStatus, timeline } = req.body;
      const orderId = req.params.id;

      await conn.query('UPDATE orders SET currentStatus = ? WHERE id = ?', [currentStatus, orderId]);
      
      await conn.query('DELETE FROM order_timeline WHERE order_id = ?', [orderId]);
      if (timeline && timeline.length > 0) {
          const timelineValues = timeline.map(t => [orderId, t.status, t.timestamp, t.description, t.location, t.completed]);
          await conn.query('INSERT INTO order_timeline (order_id, status, timestamp, description, location, completed) VALUES ?', [timelineValues]);
      }

      await conn.commit();
      res.json({ message: 'Status updated' });
  } catch (err) {
      await conn.rollback();
      console.error(err);
      res.status(500).json({ error: err.message });
  } finally {
      conn.release();
  }
});

app.delete('/api/orders/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM orders WHERE id = ?', [req.params.id]);
        res.json({ message: 'Order deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/orders/:id/payment', async (req, res) => {
    try {
        const { amount, method } = req.body;
        const [rows] = await pool.query('SELECT downPayment, paymentMethod FROM orders WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Order not found' });

        const current = rows[0];
        const newDownPayment = parseFloat(current.downPayment) + amount;
        const currentMethods = current.paymentMethod || '';
        const newPaymentMethod = currentMethods ? `${currentMethods} + ${method}` : method;

        await pool.query('UPDATE orders SET downPayment = ?, paymentMethod = ? WHERE id = ?', 
            [newDownPayment, newPaymentMethod, req.params.id]);
        
        res.json({ message: 'Payment registered' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/employees', async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        if (!companyId) return res.status(403).json({ error: 'Access denied' });

        const [rows] = await pool.query('SELECT * FROM employees WHERE company_id = ?', [companyId]);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/employees', async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        if (!companyId) return res.status(403).json({ error: 'Access denied' });
        
        const emp = req.body;
        await pool.query(
            `INSERT INTO employees (id, company_id, name, role, contact, admittedDate, login, password, accessLevel)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [emp.id, companyId, emp.name, emp.role, emp.contact, emp.admittedDate, emp.login, emp.password, emp.accessLevel]
        );
        res.status(201).json(emp);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/employees/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM employees WHERE id = ?', [req.params.id]);
        res.json({ message: 'Employee deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { login, password } = req.body;
        // Busca usuário e dados da empresa. AQUI FOI ADICIONADO 'c.plan'
        const [rows] = await pool.query(`
            SELECT e.*, c.name as companyName, c.status as companyStatus, c.trial_ends_at, c.next_payment_due, c.plan
            FROM employees e 
            LEFT JOIN companies c ON e.company_id = c.id
            WHERE e.login = ? AND e.password = ?
        `, [login, password]);

        if (rows.length > 0) {
            const user = rows[0];
            
            // AUTOMATED CHECK: Update status if trial expired or payment overdue
            if (user.company_id && user.accessLevel !== 'saas_admin') {
                const now = new Date();
                let newStatus = null;

                if (user.companyStatus === 'trial' && user.trial_ends_at && new Date(user.trial_ends_at) < now) {
                    newStatus = 'pending_payment';
                }
                if (user.companyStatus === 'active' && user.next_payment_due && new Date(user.next_payment_due) < now) {
                    newStatus = 'pending_payment';
                }

                if (newStatus) {
                    await pool.query('UPDATE companies SET status = ? WHERE id = ?', [newStatus, user.company_id]);
                    user.companyStatus = newStatus;
                }
            }

            // Block inactive (banned) users, but allow pending_payment to login (to pay)
            if (user.company_id && user.companyStatus === 'inactive') {
                return res.status(403).json({ error: 'Sua empresa está suspensa. Entre em contato com o suporte.' });
            }

            res.json({
                ...user,
                companyId: user.company_id,
                companyName: user.companyName,
                companyStatus: user.companyStatus, // Frontend needs this to show Pay Wall
                plan: user.plan,
                trial_ends_at: user.trial_ends_at,
                next_payment_due: user.next_payment_due
            });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (err) {
        console.error('Erro no login:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/service-worker.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, 'service-worker.js'));
});

app.get(/^(?!\/api).+/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
