
import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import 'dotenv/config'; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
// Aumentando limite para 200mb para permitir múltiplas fotos em alta resolução
app.use(bodyParser.json({ limit: '200mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '200mb' }));

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pedidos',
  multipleStatements: true,
  ssl: process.env.DB_USE_SSL === 'true' ? { rejectUnauthorized: false } : undefined
};

let pool = mysql.createPool(dbConfig);

async function initDatabase() {
  try {
    // Test connection
    await pool.getConnection();
    console.log('Database pool created');

    const createTablesQuery = `
      CREATE TABLE IF NOT EXISTS plans (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50),
        price DECIMAL(10, 2),
        description TEXT,
        features TEXT,
        visible BOOLEAN DEFAULT TRUE
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
        paymentMethod TEXT,
        shippingAddress TEXT,
        pressingDate VARCHAR(20),
        printingDate VARCHAR(20),
        seamstress VARCHAR(100),
        currentStatus VARCHAR(50),
        quote_validity VARCHAR(20),
        notes TEXT,
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

      CREATE TABLE IF NOT EXISTS finance_transactions (
        id VARCHAR(50) PRIMARY KEY,
        company_id VARCHAR(50),
        type VARCHAR(20), -- 'revenue' or 'expense'
        description TEXT,
        amount DECIMAL(10, 2),
        date VARCHAR(20),
        paymentMethod VARCHAR(255),
        order_id VARCHAR(50),
        account_id VARCHAR(50),
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS financial_accounts (
        id VARCHAR(50) PRIMARY KEY,
        company_id VARCHAR(50),
        name VARCHAR(100),
        balance DECIMAL(10, 2) DEFAULT 0,
        is_default BOOLEAN DEFAULT FALSE,
        active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
      );
    `;

    await pool.query(createTablesQuery);

    // --- MIGRATION CHECK ---
    const migrationQueries = [
       "ALTER TABLE orders ADD COLUMN pressingDate VARCHAR(20)",
       "ALTER TABLE orders ADD COLUMN printingDate VARCHAR(20)",
       "ALTER TABLE orders ADD COLUMN seamstress VARCHAR(100)",
       "ALTER TABLE orders ADD COLUMN quote_validity VARCHAR(20)",
       "ALTER TABLE orders ADD COLUMN notes TEXT",
       "ALTER TABLE finance_transactions ADD COLUMN account_id VARCHAR(50)",
       "ALTER TABLE financial_accounts ADD COLUMN is_default BOOLEAN DEFAULT FALSE",
       "ALTER TABLE order_items ADD COLUMN size VARCHAR(20)",
       "ALTER TABLE orders ADD COLUMN company_id VARCHAR(50)",
       "ALTER TABLE employees ADD COLUMN company_id VARCHAR(50)",
       "ALTER TABLE app_settings ADD COLUMN company_id VARCHAR(50)",
       "ALTER TABLE companies ADD COLUMN status VARCHAR(20) DEFAULT 'active'",
       "ALTER TABLE companies ADD COLUMN plan VARCHAR(50)",
       "ALTER TABLE companies ADD COLUMN trial_ends_at DATETIME",
       "ALTER TABLE companies ADD COLUMN next_payment_due DATETIME",
       "ALTER TABLE companies ADD COLUMN last_payment_date DATETIME",
       "ALTER TABLE orders ADD COLUMN currentStatus VARCHAR(50)",
       "ALTER TABLE plans ADD COLUMN visible BOOLEAN DEFAULT TRUE",
       "ALTER TABLE finance_transactions ADD COLUMN paymentMethod VARCHAR(255)",
       "ALTER TABLE orders MODIFY COLUMN paymentMethod TEXT",
       "ALTER TABLE finance_transactions MODIFY COLUMN paymentMethod VARCHAR(255)",
       "ALTER TABLE financial_accounts ADD COLUMN active BOOLEAN DEFAULT TRUE",
       "ALTER TABLE financial_accounts ADD COLUMN initial_balance DECIMAL(10, 2) DEFAULT 0",
       "ALTER TABLE financial_accounts ADD COLUMN initial_balance_date VARCHAR(20)"
    ];

    for (const query of migrationQueries) {
        try {
            await pool.query(query);
        } catch (e) {
            // Ignora erros se coluna já existe
        }
    }

    // Ensure every company has a default CAIXA ADMINISTRATIVO account
    const [companies] = await pool.query('SELECT id FROM companies');
    for (const company of companies) {
        const [accounts] = await pool.query('SELECT id FROM financial_accounts WHERE company_id = ? AND is_default = TRUE', [company.id]);
        if (accounts.length === 0) {
            const accountId = `acc_default_${company.id}`;
            await pool.query(
                'INSERT INTO financial_accounts (id, company_id, name, balance, is_default) VALUES (?, ?, ?, ?, ?)',
                [accountId, company.id, 'CAIXA ADMINISTRATIVO', 0, true]
            );
        }
    }

    // Seed Plans if empty
    const [plans] = await pool.query('SELECT * FROM plans');
    if (plans.length === 0) {
        await pool.query(`INSERT INTO plans (name, price, description, features, visible) VALUES 
            ('Básico', 49.90, 'Para pequenas empresas', 'Até 50 pedidos/mês, 1 Usuário', TRUE),
            ('Pro', 99.90, 'Para empresas em crescimento', 'Pedidos Ilimitados, 5 Usuários, IA Inclusa', TRUE),
            ('Enterprise', 199.90, 'Para grandes operações', 'Tudo ilimitado, Suporte Prioritário', TRUE)
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

// --- MIDDLEWARE HELPERS ---
const getCompanyId = (req) => {
    return req.headers['x-company-id'] || null;
}

// --- ACCOUNTS HELPER ---
async function ensureDefaultAccount(companyId) {
    if (!companyId || companyId === 'null') return;
    const [rows] = await pool.query('SELECT * FROM financial_accounts WHERE company_id = ? AND is_default = TRUE', [companyId]);
    if (rows.length === 0) {
        const id = 'acc_' + Math.random().toString(36).substr(2, 9);
        await pool.query(
            'INSERT INTO financial_accounts (id, company_id, name, balance, is_default) VALUES (?, ?, ?, ?, ?)',
            [id, companyId, 'CAIXA ADMINISTRATIVO', 0, true]
        );
    }
}


const calculateNextDueDate = (currentNextDue, trialEndsAt) => {
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

// --- WEBHOOK MERCADO PAGO (CORRIGIDO) ---
const handleWebhook = async (req, res) => {
    // 1. RESPOSTA IMEDIATA: Evita 502/Timeout
    // O Mercado Pago espera um 200 OK em menos de 3 segundos.
    res.status(200).send('OK');

    // 2. Processamento em Background
    // Usar um bloco try/catch separado para garantir que erros aqui não afetem a resposta acima
    try {
        console.log('--- WEBHOOK HIT ---');
        // Log para debug
        // console.log(JSON.stringify(req.body, null, 2));

        const { type, data, action } = req.body;
        
        // Verifica se é evento de pagamento (criado ou atualizado)
        // action pode ser 'payment.created' ou 'payment.updated'
        // type pode ser 'payment'
        const isPayment = type === 'payment' || (action && action.startsWith('payment.'));
        
        if (isPayment && data?.id) {
            console.log(`Processando pagamento ID: ${data.id}`);

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
                console.log(`Status do Pagamento ${data.id}: ${payment.status}`);

                // Se APROVADO, renova a assinatura
                if (payment.status === 'approved') {
                    const companyId = payment.external_reference;
                    
                    if (companyId) {
                         // Lógica de Renovação Corrigida (Cumulativa)
                        const [rows] = await pool.query("SELECT next_payment_due, trial_ends_at FROM companies WHERE id = ?", [companyId]);
                        
                        // Garante que a renovação só aconteça se a data de último pagamento for diferente
                        // ou se for um pagamento novo (evita loops se o webhook enviar 2x)
                        // Para simplificar, assumimos que 'approved' é sinal verde.
                        
                        if (rows.length > 0) {
                            const newDueDate = calculateNextDueDate(rows[0].next_payment_due, rows[0].trial_ends_at);

                            await pool.query(
                                "UPDATE companies SET status = 'active', last_payment_date = NOW(), next_payment_due = ? WHERE id = ?", 
                                [newDueDate, companyId]
                            );
                            console.log(`SUCESSO: Empresa ${companyId} renovada até ${newDueDate}`);
                        } else {
                            console.warn(`Empresa não encontrada para ID: ${companyId}`);
                        }
                    } else {
                        console.warn('Pagamento sem external_reference (company_id)');
                    }
                }
            } else {
                console.error("Erro ao consultar MP:", await response.text());
            }
        } else {
            // Ignora eventos que não sejam de pagamento
            console.log("Evento ignorado (não é pagamento ou sem ID)");
        }
    } catch (err) {
        // Erro silencioso no console para não crashar o server
        console.error("ERRO FATAL NO WEBHOOK:", err);
    }
};

// Mapeia nas duas rotas para garantir
app.post('/api/webhook/mercadopago', handleWebhook);
app.post('/subscription/webhook', handleWebhook);


// --- PLANS ROUTES (Public GET, Admin CRUD) ---
app.get('/api/plans', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM plans');
        // Converte 1/0 para boolean
        const plans = rows.map(p => ({ ...p, visible: !!p.visible }));
        res.json(plans);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/plans', async (req, res) => {
    try {
        const { name, price, description, features } = req.body;
        await pool.query('INSERT INTO plans (name, price, description, features, visible) VALUES (?, ?, ?, ?, TRUE)', [name, price, description, features]);
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

// Rota para alternar visibilidade
app.patch('/api/plans/:id/visibility', async (req, res) => {
    try {
        const { visible } = req.body;
        await pool.query('UPDATE plans SET visible=? WHERE id=?', [visible, req.params.id]);
        res.json({ message: 'Visibilidade atualizada' });
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

// NOVO: Revogar 1 mês (diminuir)
app.post('/api/saas/companies/:id/revoke-month', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query("SELECT next_payment_due FROM companies WHERE id = ?", [id]);
        if (rows.length === 0) return res.status(404).json({ error: "Empresa não encontrada" });

        // Se next_payment_due for null, usa NOW como base, senão usa a data existente
        const currentDue = rows[0].next_payment_due ? new Date(rows[0].next_payment_due) : new Date();
        
        // Subtrai 30 dias
        currentDue.setDate(currentDue.getDate() - 30);

        await pool.query(
            "UPDATE companies SET next_payment_due = ? WHERE id = ?",
            [currentDue, id]
        );

        res.json({ message: '1 mês removido com sucesso' });
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

        // 4. Create Default Financial Account
        const accountId = `acc_default_${companyId}`;
        await conn.query(
            'INSERT INTO financial_accounts (id, company_id, name, balance, is_default) VALUES (?, ?, ?, ?, ?)',
            [accountId, companyId, 'CAIXA ADMINISTRATIVO', 0, true]
        );

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
            return res.json({ appName: 'Rastreaê', logoUrl: '', businessName: '', cnpj: '', city: '', address: '' });
        }

        const [rows] = await pool.query(query, params);
        const settings = { appName: 'Rastreaê', logoUrl: '', businessName: '', cnpj: '', city: '', address: '' };
        rows.forEach(row => {
            if (row.setting_key === 'appName') settings.appName = row.setting_value;
            if (row.setting_key === 'logoUrl') settings.logoUrl = row.setting_value;
            if (row.setting_key === 'businessName') settings.businessName = row.setting_value;
            if (row.setting_key === 'cnpj') settings.cnpj = row.setting_value;
            if (row.setting_key === 'city') settings.city = row.setting_value;
            if (row.setting_key === 'address') settings.address = row.setting_value;
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

        const { appName, logoUrl, businessName, cnpj, city, address } = req.body;
        
        const upsert = async (key, val) => {
             await pool.query('INSERT INTO app_settings (setting_key, setting_value, company_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = ?', [key, val, companyId, val]);
        }

        await upsert('appName', appName);
        await upsert('logoUrl', logoUrl);
        await upsert('businessName', businessName || '');
        await upsert('cnpj', cnpj || '');
        await upsert('city', city || '');
        await upsert('address', address || '');
        
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
      // NÃO buscar fotos na listagem para performance
      // const [photos] = await pool.query('SELECT photo_data FROM order_photos WHERE order_id = ?', [order.id]);

      return {
        ...order,
        total: parseFloat(order.total),
        downPayment: parseFloat(order.downPayment),
        items: items.map(i => ({...i, price: parseFloat(i.price)})),
        timeline: timeline.map(t => ({...t, completed: !!t.completed})),
        photos: [], // Lista vazia na listagem
        // Mapeamento correto para o Frontend
        quoteValidity: order.quote_validity,
        notes: order.notes
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
      photos: photos.map(p => p.photo_data),
      // Mapeamento correto para o Frontend
      quoteValidity: order.quote_validity,
      notes: order.notes
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
      `INSERT INTO orders (id, company_id, customerName, customerPhone, orderDate, estimatedDelivery, total, downPayment, paymentMethod, shippingAddress, pressingDate, printingDate, seamstress, currentStatus, quote_validity, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [order.id, companyId, order.customerName, order.customerPhone, order.orderDate, order.estimatedDelivery, order.total, order.downPayment, order.paymentMethod, order.shippingAddress, order.pressingDate, order.printingDate, order.seamstress, order.currentStatus, order.quoteValidity, order.notes]
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

    // NEW: Handle downPayment as a transaction
    if (order.downPayment > 0) {
        let targetAccountId = order.downPaymentAccountId;
        if (!targetAccountId) {
            const [accs] = await conn.query('SELECT id FROM financial_accounts WHERE company_id = ? AND is_default = 1', [companyId]);
            if (accs.length > 0) targetAccountId = accs[0].id;
            else {
                const [allAccs] = await conn.query('SELECT id FROM financial_accounts WHERE company_id = ? LIMIT 1', [companyId]);
                if (allAccs.length > 0) targetAccountId = allAccs[0].id;
            }
        }

        if (targetAccountId) {
            const amount = parseFloat(order.downPayment);
            await conn.query('UPDATE financial_accounts SET balance = balance + ? WHERE id = ?', [amount, targetAccountId]);
            
            const transId = 'trans_' + Math.random().toString(36).substr(2, 9);
            const formattedDate = new Date().toLocaleDateString('pt-BR');
            await conn.query(
                'INSERT INTO finance_transactions (id, company_id, type, description, amount, date, paymentMethod, order_id, account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [transId, companyId, 'revenue', `Entrada Pedido #${order.id}`, amount, formattedDate, order.paymentMethod || 'Não informado', order.id, targetAccountId]
            );
        }
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
      `UPDATE orders SET customerName=?, customerPhone=?, orderDate=?, estimatedDelivery=?, total=?, downPayment=?, paymentMethod=?, shippingAddress=?, pressingDate=?, printingDate=?, seamstress=?, quote_validity=?, notes=? WHERE id=?`,
      [order.customerName, order.customerPhone, order.orderDate, order.estimatedDelivery, order.total, order.downPayment, order.paymentMethod, order.shippingAddress, order.pressingDate, order.printingDate, order.seamstress, order.quoteValidity, order.notes, orderId]
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

// NOVO: Converter orçamento em pedido
app.patch('/api/orders/:id/convert', async (req, res) => {
    if (!pool) return res.status(500).json({error: "DB Not Init"});
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const orderId = req.params.id;
        
        // Atualiza status para PEDIDO_FEITO e adiciona na timeline
        const timestamp = new Date().toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit' });
        
        await conn.query("UPDATE orders SET currentStatus = 'PEDIDO_FEITO' WHERE id = ?", [orderId]);
        
        // Adiciona evento na timeline
        await conn.query(
            "INSERT INTO order_timeline (order_id, status, timestamp, description, completed) VALUES (?, ?, ?, ?, ?)",
            [orderId, 'PEDIDO_FEITO', timestamp, 'Orçamento aprovado e convertido em pedido.', true]
        );

        // Adiciona os próximos passos na timeline (vazios)
        await conn.query("INSERT INTO order_timeline (order_id, status, timestamp, description, completed) VALUES (?, ?, ?, ?, ?)", [orderId, 'EM_PRODUCAO', '-', 'Aguardando início da produção.', false]);
        await conn.query("INSERT INTO order_timeline (order_id, status, timestamp, description, completed) VALUES (?, ?, ?, ?, ?)", [orderId, 'CONCLUIDO', '-', 'Aguardando conclusão.', false]);

        await conn.commit();
        res.json({ message: 'Orçamento convertido em pedido' });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// ... (Rest of the file remains unchanged) ...
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
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const { amount, method, date, accountId } = req.body;
        const companyId = getCompanyId(req);
        
        const [rows] = await conn.query('SELECT downPayment, paymentMethod FROM orders WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Order not found' });

        const current = rows[0];
        const newDownPayment = parseFloat(current.downPayment || 0) + amount;
        const currentMethods = current.paymentMethod || '';
        
        const formattedDate = date ? date.split('-').reverse().join('/') : new Date().toLocaleDateString('pt-BR');
        const methodWithAmount = `${method} (R$ ${amount.toFixed(2).replace('.', ',')})`;
        const methodWithDate = `${methodWithAmount} - ${formattedDate}`;
        
        const newPaymentMethod = currentMethods ? `${currentMethods} + ${methodWithDate}` : methodWithDate;

        await conn.query('UPDATE orders SET downPayment = ?, paymentMethod = ? WHERE id = ?', 
            [newDownPayment, newPaymentMethod, req.params.id]);
        
        // Use provided account or default
        let targetAccountId = accountId;
        if (!targetAccountId) {
            const [accs] = await conn.query('SELECT id FROM financial_accounts WHERE company_id = ? AND is_default = 1', [companyId]);
            if (accs.length > 0) targetAccountId = accs[0].id;
            else {
                const [allAccs] = await conn.query('SELECT id FROM financial_accounts WHERE company_id = ? LIMIT 1', [companyId]);
                if (allAccs.length > 0) targetAccountId = allAccs[0].id;
            }
        }

        if (targetAccountId) {
            await conn.query('UPDATE financial_accounts SET balance = balance + ? WHERE id = ?', [amount, targetAccountId]);
            
            const transId = 'trans_' + Math.random().toString(36).substr(2, 9);
            await conn.query(
                'INSERT INTO finance_transactions (id, company_id, type, description, amount, date, paymentMethod, order_id, account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [transId, companyId, 'revenue', `Pagamento Pedido #${req.params.id} (${method})`, amount, formattedDate, method, req.params.id, targetAccountId]
            );
        }
        
        await conn.commit();
        res.json({ message: 'Payment registered' });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// NOVO: Endpoint para excluir um pagamento específico vinculado a um pedido
app.delete('/api/orders/:orderId/payments/:transactionId', async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const { orderId, transactionId } = req.params;
        const companyId = getCompanyId(req);

        // Handle Virtual Transaction Deletion (Legacy order payments not yet in DB)
        if (transactionId.startsWith('VIRTUAL_PY_ORD:') || transactionId.startsWith('ORDER-PY-')) {
            const [orderRows] = await conn.query('SELECT downPayment, paymentMethod FROM orders WHERE id = ? AND company_id = ?', [orderId, companyId]);
            if (orderRows.length === 0) return res.status(404).json({ error: 'Order not found' });
            
            const order = orderRows[0];
            let methods = order.paymentMethod ? order.paymentMethod.split(' + ') : [];
            
            let indexToRemove = -1;
            let amountToRemove = 0;

            if (transactionId.startsWith('VIRTUAL_PY_ORD:')) {
                // Format: VIRTUAL_PY_ORD:orderId:IX:index:methodName
                const parts = transactionId.split(':');
                indexToRemove = parseInt(parts[3]);
            } else {
                // Fallback for old format: ORDER-PY-orderId-index-methodName
                const parts = transactionId.split('-');
                indexToRemove = parseInt(parts[3]);
            }

            if (indexToRemove >= 0 && indexToRemove < methods.length) {
                const methodStr = methods[indexToRemove];
                const amountMatch = methodStr.match(/R\$\s?([\d.,]+)/);
                if (amountMatch) {
                    amountToRemove = parseFloat(amountMatch[1].replace(/\./g, '').replace(',', '.'));
                }
                methods.splice(indexToRemove, 1);
            }

            const newDownPayment = Math.max(0, parseFloat(order.downPayment || 0) - amountToRemove);
            const newPaymentMethod = methods.join(' + ');

            await conn.query('UPDATE orders SET downPayment = ?, paymentMethod = ? WHERE id = ?', [newDownPayment, newPaymentMethod, orderId]);
            
            await conn.commit();
            return res.json({ message: 'Virtual payment removed' });
        }

        // 1. Get transaction details (Real transaction)
        const [transRows] = await conn.query('SELECT * FROM finance_transactions WHERE id = ? AND company_id = ?', [transactionId, companyId]);
        if (transRows.length === 0) return res.status(404).json({ error: 'Transaction not found' });
        const trans = transRows[0];

        // 2. Revert account balance
        if (trans.account_id) {
            await conn.query('UPDATE financial_accounts SET balance = balance - ? WHERE id = ?', [trans.amount, trans.account_id]);
        }

        // 3. Delete transaction
        await conn.query('DELETE FROM finance_transactions WHERE id = ?', [transactionId]);

        // 4. Update order downPayment and paymentMethod string
        const [orderRows] = await conn.query('SELECT downPayment, paymentMethod FROM orders WHERE id = ?', [orderId]);
        if (orderRows.length > 0) {
            const order = orderRows[0];
            const newDownPayment = Math.max(0, parseFloat(order.downPayment || 0) - parseFloat(trans.amount));
            
            // This is tricky because the string is formatted. 
            // We'll try to remove the part that matches the amount and method.
            let methods = order.paymentMethod ? order.paymentMethod.split(' + ') : [];
            const amountStr = trans.amount.toFixed(2).replace('.', ',');
            
            // Find the index of the method that contains the amount
            const index = methods.findIndex(m => m.includes(`R$ ${amountStr}`) && m.includes(trans.paymentMethod));
            if (index !== -1) {
                methods.splice(index, 1);
            }
            const newPaymentMethod = methods.join(' + ');

            await conn.query('UPDATE orders SET downPayment = ?, paymentMethod = ? WHERE id = ?', [newDownPayment, newPaymentMethod, orderId]);
        }

        await conn.commit();
        res.json({ message: 'Payment removed and balance updated' });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// --- Finance Routes ---
app.get('/api/finance/transactions', async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        if (!companyId) return res.status(403).json({ error: 'Access denied' });

        const { startDate, endDate, accountId, orderId } = req.query;

        // Get transactions
        let manualQuery = `
            SELECT t.*, a.name as accountName, t.account_id as accountId, t.order_id as orderId
            FROM finance_transactions t 
            LEFT JOIN financial_accounts a ON t.account_id = a.id 
            WHERE t.company_id = ?
        `;
        const manualParams = [companyId];
        
        if (accountId && accountId !== 'all') {
            manualQuery += " AND t.account_id = ?";
            manualParams.push(accountId);
        }

        if (orderId) {
            manualQuery += " AND t.order_id = ?";
            manualParams.push(orderId);
        }

        if (startDate && endDate) {
            manualQuery += " AND STR_TO_DATE(t.date, '%d/%m/%Y') BETWEEN STR_TO_DATE(?, '%Y-%m-%d') AND STR_TO_DATE(?, '%Y-%m-%d')";
            manualParams.push(startDate, endDate);
        }

        const [manualRows] = await pool.query(manualQuery, manualParams);
        
        // Se estiver filtrando por conta específica, não buscamos pagamentos de pedidos antigos que não tinham conta
        // A menos que a conta seja a padrão e o usuário queira ver tudo (mas o usuário pediu para filtrar)
        // Para manter compatibilidade, se accountId for 'all', buscamos tudo.
        
        let orderTransactions = [];
        if (!accountId || accountId === 'all') {
            // Get order payments (legacy logic for orders without account_id in transactions)
            // We only fetch orders where the transaction wasn't already recorded in finance_transactions
            let orderQuery = 'SELECT id, customerName, orderDate, paymentMethod, downPayment FROM orders WHERE company_id = ? AND downPayment > 0';
            const orderParams = [companyId];

            if (orderId) {
                orderQuery += " AND id = ?";
                orderParams.push(orderId);
            }

            if (startDate && endDate) {
                orderQuery += " AND STR_TO_DATE(orderDate, '%d/%m/%Y') BETWEEN STR_TO_DATE(?, '%Y-%m-%d') AND STR_TO_DATE(?, '%Y-%m-%d')";
                orderParams.push(startDate, endDate);
            }

            const [orderRows] = await pool.query(orderQuery, orderParams);
            
            orderRows.forEach(order => {
                const parts = (order.paymentMethod || '').split('+');
                parts.forEach((p, index) => {
                    const trimmedPart = p.trim();
                    if (!trimmedPart) return;

                    const methodName = trimmedPart.split('(')[0].trim();
                    const amountMatch = trimmedPart.match(/R\$\s?([\d.,]+)/);
                    const dateMatch = trimmedPart.match(/(\d{2}\/\d{2}\/\d{4})/);
                    const transactionDate = dateMatch ? dateMatch[1] : order.orderDate;

                    let amount = 0;
                    if (amountMatch) {
                        amount = parseFloat(amountMatch[1].replace(/\./g, '').replace(',', '.'));
                    } else if (parts.length === 1) {
                        amount = parseFloat(order.downPayment);
                    }
                    
                    if (amount > 0) {
                        // Check if this specific payment part is already in manualRows (to avoid duplicates)
                        // Use a more robust check for amount and order_id
                        const isDuplicate = manualRows.some(m => {
                            const mOrderId = String(m.orderId || '').trim();
                            const oId = String(order.id || '').trim();
                            const mAmount = parseFloat(m.amount || 0);
                            const mDate = String(m.date || '').trim();
                            const tDate = String(transactionDate || '').trim();
                            
                            const idMatch = mOrderId === oId;
                            const amountMatch = Math.abs(mAmount - amount) < 0.01;
                            const dateMatch = mDate === tDate;
                            
                            return idMatch && amountMatch && dateMatch;
                        });
                        
                        if (!isDuplicate) {
                            orderTransactions.push({
                                // Use a more robust separator to avoid issues with hyphens in order IDs
                                id: `VIRTUAL_PY_ORD:${order.id}:IX:${index}:${methodName.replace(/[:\s]+/g, '-')}`,
                                companyId: companyId,
                                type: 'revenue',
                                description: `Pagamento Pedido #${order.id} - ${order.customerName} (${methodName})`,
                                amount: amount,
                                date: transactionDate,
                                paymentMethod: methodName,
                                orderId: order.id,
                                accountName: 'Não vinculada'
                            });
                        }
                    }
                });
            });
        }

        const allTransactions = [...manualRows, ...orderTransactions].sort((a, b) => {
            const parseDate = (d) => {
                const [day, month, year] = d.split('/');
                return new Date(year, month - 1, day).getTime();
            };
            return parseDate(b.date) - parseDate(a.date);
        });

        res.json(allTransactions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/finance/transactions', async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const companyId = getCompanyId(req);
        if (!companyId) return res.status(403).json({ error: 'Access denied' });

        const { type, description, amount, date, paymentMethod, orderId, accountId } = req.body;
        const id = `TX-${Date.now()}`;

        await conn.query(
            'INSERT INTO finance_transactions (id, company_id, type, description, amount, date, paymentMethod, order_id, account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [id, companyId, type, description, amount, date, paymentMethod || null, orderId || null, accountId || null]
        );

        // Update account balance
        if (accountId) {
            const balanceChange = type === 'revenue' ? amount : -amount;
            await conn.query('UPDATE financial_accounts SET balance = balance + ? WHERE id = ?', [balanceChange, accountId]);
        }

        await conn.commit();
        res.status(201).json({ id, companyId, type, description, amount, date, paymentMethod, orderId, accountId });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

app.put('/api/finance/transactions/:id', async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const companyId = getCompanyId(req);
        if (!companyId) return res.status(403).json({ error: 'Access denied' });

        const { type, description, amount, date, paymentMethod, accountId } = req.body;
        const transactionId = req.params.id;

        // Handle Virtual Transaction Promotion (Legacy order payments not yet in DB)
        if (transactionId.startsWith('VIRTUAL_PY_ORD:') || transactionId.startsWith('ORDER-PY-')) {
            let orderId;
            if (transactionId.startsWith('VIRTUAL_PY_ORD:')) {
                orderId = transactionId.split(':')[1];
            } else {
                // Fallback for old virtual IDs if they still exist in client state
                orderId = transactionId.split('-')[2];
            }

            const newId = `TX-PROM-${Date.now()}`;
            await conn.query(
                'INSERT INTO finance_transactions (id, company_id, type, description, amount, date, paymentMethod, order_id, account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [newId, companyId, type, description, amount, date, paymentMethod || null, orderId || null, accountId || null]
            );

            if (accountId) {
                const balanceChange = type === 'revenue' ? amount : -amount;
                await conn.query('UPDATE financial_accounts SET balance = balance + ? WHERE id = ?', [balanceChange, accountId]);
            }

            await conn.commit();
            const [updatedRows] = await conn.query('SELECT * FROM finance_transactions WHERE id = ?', [newId]);
            return res.json(updatedRows[0]);
        }

        // Get old transaction
        const [oldRows] = await conn.query('SELECT * FROM finance_transactions WHERE id = ? AND company_id = ?', [transactionId, companyId]);
        if (oldRows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ error: 'Transaction not found' });
        }
        
        const old = oldRows[0];

        // RESTRICTION: If linked to an order, only accountId can be changed
        if (old.order_id) {
            // Only update account_id
            // Revert old balance if account changed
            if (old.account_id !== accountId) {
                if (old.account_id) {
                    const oldBalanceChange = old.type === 'revenue' ? -old.amount : old.amount;
                    await conn.query('UPDATE financial_accounts SET balance = balance + ? WHERE id = ?', [oldBalanceChange, old.account_id]);
                }
                if (accountId) {
                    const newBalanceChange = old.type === 'revenue' ? old.amount : -old.amount;
                    await conn.query('UPDATE financial_accounts SET balance = balance + ? WHERE id = ?', [newBalanceChange, accountId]);
                }
            }
            // Always update the account_id in the transaction record if it changed
            await conn.query('UPDATE finance_transactions SET account_id = ? WHERE id = ?', [accountId || null, transactionId]);
        } else {
            // Manual transaction: full edit allowed
            // Revert old balance
            if (old.account_id) {
                const oldBalanceChange = old.type === 'revenue' ? -old.amount : old.amount;
                await conn.query('UPDATE financial_accounts SET balance = balance + ? WHERE id = ?', [oldBalanceChange, old.account_id]);
            }

            await conn.query(
                'UPDATE finance_transactions SET type = ?, description = ?, amount = ?, date = ?, paymentMethod = ?, account_id = ? WHERE id = ? AND company_id = ?',
                [type, description, amount, date, paymentMethod, accountId || null, transactionId, companyId]
            );

            // Apply new balance
            if (accountId) {
                const newBalanceChange = type === 'revenue' ? amount : -amount;
                await conn.query('UPDATE financial_accounts SET balance = balance + ? WHERE id = ?', [newBalanceChange, accountId]);
            }
        }

        await conn.commit();
        // Return the actual state from DB for consistency
        const [updatedRows] = await conn.query('SELECT * FROM finance_transactions WHERE id = ?', [transactionId]);
        res.json(updatedRows[0]);
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

app.delete('/api/finance/transactions/:id', async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const companyId = getCompanyId(req);
        if (!companyId) return res.status(403).json({ error: 'Access denied' });

        const transactionId = req.params.id;

        // Get transaction to adjust balance
        const [rows] = await conn.query('SELECT * FROM finance_transactions WHERE id = ? AND company_id = ?', [transactionId, companyId]);
        if (rows.length > 0) {
            const trans = rows[0];
            
            // RESTRICTION: Cannot delete order-linked transactions
            if (trans.order_id) {
                await conn.rollback();
                return res.status(400).json({ error: 'Não é permitido excluir pagamentos vinculados a pedidos por aqui. Use o histórico do pedido.' });
            }

            if (trans.account_id) {
                const balanceChange = trans.type === 'revenue' ? -trans.amount : trans.amount;
                await conn.query('UPDATE financial_accounts SET balance = balance + ? WHERE id = ?', [balanceChange, trans.account_id]);
            }
        }

        await conn.query('DELETE FROM finance_transactions WHERE id = ? AND company_id = ?', [transactionId, companyId]);
        
        await conn.commit();
        res.json({ message: 'Transaction deleted' });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// --- Financial Accounts Routes ---
app.get('/api/finance/accounts', async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        if (!companyId) return res.status(403).json({ error: 'Access denied' });

        const [rows] = await pool.query(`
            SELECT a.*, 
            (SELECT COUNT(*) FROM finance_transactions t WHERE t.account_id = a.id AND t.company_id = a.company_id) as transactionCount
            FROM financial_accounts a 
            WHERE a.company_id = ?
        `, [companyId]);
        
        res.json(rows.map(r => ({ 
            ...r, 
            balance: parseFloat(r.balance), 
            initialBalance: parseFloat(r.initial_balance || 0),
            initialBalanceDate: r.initial_balance_date,
            isDefault: !!r.is_default, 
            active: !!r.active,
            hasMovements: r.transactionCount > 0
        })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/finance/accounts', async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        if (!companyId) return res.status(403).json({ error: 'Access denied' });

        const { name, balance, initialBalance, initialBalanceDate } = req.body;
        const id = `acc_${Date.now()}`;
        
        const startBalance = initialBalance !== undefined ? parseFloat(initialBalance) : parseFloat(balance || 0);
        const startDate = initialBalanceDate || new Date().toISOString().split('T')[0];

        await pool.query(
            'INSERT INTO financial_accounts (id, company_id, name, balance, initial_balance, initial_balance_date, is_default, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [id, companyId, name, startBalance, startBalance, startDate, false, true]
        );

        res.status(201).json({ id, companyId, name, balance: startBalance, initialBalance: startBalance, initialBalanceDate: startDate, isDefault: false, active: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/finance/accounts/:id', async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        if (!companyId) return res.status(403).json({ error: 'Access denied' });

        const { name, initialBalance, initialBalanceDate, active } = req.body;
        
        const [currentAcc] = await pool.query('SELECT * FROM financial_accounts WHERE id = ? AND company_id = ?', [req.params.id, companyId]);
        if (currentAcc.length === 0) return res.status(404).json({ error: 'Account not found' });
        
        const updates = [];
        const params = [];
        
        if (name !== undefined) {
            updates.push('name = ?');
            params.push(name);
        }
        
        if (initialBalance !== undefined) {
            const newInitial = parseFloat(initialBalance);
            const oldInitial = parseFloat(currentAcc[0].initial_balance || 0);
            const diff = newInitial - oldInitial;
            
            updates.push('initial_balance = ?');
            params.push(newInitial);
            
            // Adjust current balance based on initial balance change
            updates.push('balance = balance + ?');
            params.push(diff);
        }
        
        if (initialBalanceDate !== undefined) {
            updates.push('initial_balance_date = ?');
            params.push(initialBalanceDate);
        }

        if (active !== undefined) {
            // Prevent inactivation of default account
            if (currentAcc[0].is_default && !active) {
                return res.status(400).json({ error: 'A conta padrão não pode ser inativada.' });
            }
            updates.push('active = ?');
            params.push(active);
        }
        
        if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
        
        const query = 'UPDATE financial_accounts SET ' + updates.join(', ') + ' WHERE id = ? AND company_id = ?';
        params.push(req.params.id, companyId);
        
        await pool.query(query, params);
        res.json({ message: 'Account updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/finance/accounts/:id', async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        if (!companyId) return res.status(403).json({ error: 'Access denied' });

        // Check if account has transactions
        const [transactions] = await pool.query('SELECT id FROM finance_transactions WHERE account_id = ? AND company_id = ? LIMIT 1', [req.params.id, companyId]);
        
        if (transactions.length > 0) {
            return res.status(400).json({ error: 'Esta conta possui movimentações e não pode ser excluída. Você pode apenas inativá-la.' });
        }

        const [rows] = await pool.query('SELECT is_default FROM financial_accounts WHERE id = ? AND company_id = ?', [req.params.id, companyId]);
        if (rows.length === 0) return res.status(404).json({ error: 'Account not found' });
        if (rows[0].is_default) return res.status(400).json({ error: 'Cannot delete default account' });

        await pool.query('DELETE FROM financial_accounts WHERE id = ? AND company_id = ?', [req.params.id, companyId]);
        res.json({ message: 'Account deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/finance/transfers', async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const companyId = getCompanyId(req);
        if (!companyId) return res.status(403).json({ error: 'Access denied' });

        const { fromAccountId, toAccountId, amount, date, description } = req.body;

        // 1. Record Expense in source account
        const expenseId = `TX-TRF-EXP-${Date.now()}`;
        await conn.query(
            'INSERT INTO finance_transactions (id, company_id, type, description, amount, date, account_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [expenseId, companyId, 'expense', `Transferência para: ${description}`, amount, date, fromAccountId]
        );
        await conn.query('UPDATE financial_accounts SET balance = balance - ? WHERE id = ?', [amount, fromAccountId]);

        // 2. Record Revenue in destination account
        const revenueId = `TX-TRF-REV-${Date.now()}`;
        await conn.query(
            'INSERT INTO finance_transactions (id, company_id, type, description, amount, date, account_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [revenueId, companyId, 'revenue', `Transferência de: ${description}`, amount, date, toAccountId]
        );
        await conn.query('UPDATE financial_accounts SET balance = balance + ? WHERE id = ?', [amount, toAccountId]);

        await conn.commit();
        res.status(201).json({ message: 'Transfer completed' });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// --- Dashboard Routes ---
app.get('/api/dashboard', async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        if (!companyId) return res.status(403).json({ error: 'Access denied' });

        const now = new Date();
        const todayStr = now.toLocaleDateString('pt-BR');
        const monthStr = (now.getMonth() + 1).toString().padStart(2, '0') + '/' + now.getFullYear();

        // Orders per month (simple check for month string in orderDate)
        const [monthOrders] = await pool.query('SELECT COUNT(*) as count FROM orders WHERE company_id = ? AND orderDate LIKE ?', [companyId, `%/${monthStr}`]);
        
        // Orders per day
        const [dayOrders] = await pool.query('SELECT COUNT(*) as count FROM orders WHERE company_id = ? AND orderDate = ?', [companyId, todayStr]);

        // Status counts
        const [statusRows] = await pool.query('SELECT currentStatus, COUNT(*) as count FROM orders WHERE company_id = ? GROUP BY currentStatus', [companyId]);
        const statusCounts = {
            'ORCAMENTO': 0,
            'PEDIDO_FEITO': 0,
            'EM_PRODUCAO': 0,
            'AGUARDANDO_RETIRADA': 0,
            'CONCLUIDO': 0,
            'CANCELADO': 0
        };
        statusRows.forEach(row => {
            if (row.currentStatus) statusCounts[row.currentStatus] = row.count;
        });

        // Finance stats
        // 1. Revenue from transactions + Revenue from orders (downPayment)
        // Note: Automatic revenue from orders is handled by summing downPayment from orders
        const [transRevenue] = await pool.query('SELECT SUM(amount) as total FROM finance_transactions WHERE company_id = ? AND type = "revenue"', [companyId]);
        const [orderRevenue] = await pool.query('SELECT SUM(downPayment) as total FROM orders WHERE company_id = ?', [companyId]);
        
        const totalRevenue = (parseFloat(transRevenue[0].total) || 0) + (parseFloat(orderRevenue[0].total) || 0);

        // 2. Expenses from transactions
        const [transExpenses] = await pool.query('SELECT SUM(amount) as total FROM finance_transactions WHERE company_id = ? AND type = "expense"', [companyId]);
        const totalExpenses = parseFloat(transExpenses[0].total) || 0;

        // 3. Receivable (Total orders - downPayment)
        const [receivableRows] = await pool.query('SELECT SUM(total - downPayment) as total FROM orders WHERE company_id = ? AND currentStatus != "CANCELADO" AND currentStatus != "ORCAMENTO"', [companyId]);
        const totalReceivable = parseFloat(receivableRows[0].total) || 0;

        // 4. Payment methods distribution (from transactions) - Current Month
        const [paymentRows] = await pool.query(
            'SELECT paymentMethod, amount FROM finance_transactions WHERE company_id = ? AND type = "revenue" AND (date LIKE ? OR date LIKE ?)', 
            [companyId, `%/${monthStr}`, `%${monthStr}`]
        );
        const methodMap = {};
        paymentRows.forEach(row => {
            let methodName = row.paymentMethod || 'Outros';
            // Clean up method name if it has date or extra info
            methodName = methodName.split('(')[0].split('-')[0].trim();
            methodMap[methodName] = (methodMap[methodName] || 0) + parseFloat(row.amount);
        });

        const paymentMethods = Object.entries(methodMap).map(([name, value]) => ({ name, value }));

        res.json({
            ordersPerMonth: monthOrders[0].count,
            ordersPerDay: dayOrders[0].count,
            statusCounts,
            finance: {
                totalRevenue,
                totalExpenses,
                totalReceivable,
                paymentMethods
            }
        });
    } catch (err) {
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

// NOVO: Rota de Edição de Funcionário
app.put('/api/employees/:id', async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        if (!companyId) return res.status(403).json({ error: 'Access denied' });
        
        const emp = req.body;
        const empId = req.params.id;

        // Atualiza nome, cargo, contato, login, senha e nível de acesso
        // A senha será atualizada diretamente (texto plano conforme implementação atual)
        await pool.query(
            `UPDATE employees SET name=?, role=?, contact=?, login=?, password=?, accessLevel=? WHERE id=? AND company_id=?`,
            [emp.name, emp.role, emp.contact, emp.login, emp.password, emp.accessLevel, empId, companyId]
        );
        res.json({ message: 'Employee updated' });
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

async function startServer() {
    try {
        // Vite middleware for development
        if (process.env.NODE_ENV !== 'production') {
            const vite = await createViteServer({
                server: { middlewareMode: true },
                appType: 'spa',
            });
            app.use(vite.middlewares);
        } else {
            app.use(express.static(path.join(__dirname, 'dist')));
            app.get(/^(?!\/api).+/, (req, res) => {
                res.sendFile(path.join(__dirname, 'dist', 'index.html'));
            });
        }

        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });

        // Initialize database in background
        initDatabase();
    } catch (err) {
        console.error('Failed to start server:', err);
    }
}

startServer();
