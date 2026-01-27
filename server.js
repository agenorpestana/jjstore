
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

      CREATE TABLE IF NOT EXISTS companies (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100),
        plan VARCHAR(50),
        status VARCHAR(20) DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
       "ALTER TABLE companies ADD COLUMN plan VARCHAR(50)" // Ensure plan exists
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

// --- API Routes (Prefix /api) ---

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', port: PORT });
});

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
        // CORREÇÃO: Usar agregação (MAX) para os campos da tabela employees
        // Isso satisfaz o modo 'only_full_group_by' do MySQL
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


// --- SAAS REGISTRATION ---
app.post('/api/register-company', async (req, res) => {
    if (!pool) return res.status(500).json({error: "DB Error"});
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const { companyName, adminName, login, password, contact, plan } = req.body;

        const companyId = `COMP-${Date.now()}`;
        // Default to 'active' on creation
        await conn.query(
            'INSERT INTO companies (id, name, plan, status) VALUES (?, ?, ?, ?)',
            [companyId, companyName, plan || 'Básico', 'active']
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
        // Busca usuário e status da empresa
        const [rows] = await pool.query(`
            SELECT e.*, c.name as companyName, c.status as companyStatus
            FROM employees e 
            LEFT JOIN companies c ON e.company_id = c.id
            WHERE e.login = ? AND e.password = ?
        `, [login, password]);

        if (rows.length > 0) {
            const user = rows[0];
            
            // Check if company is active (skip for Super Admin who has company_id = null)
            if (user.company_id && user.companyStatus === 'inactive') {
                return res.status(403).json({ error: 'Sua empresa está suspensa. Entre em contato com o suporte.' });
            }

            res.json({
                ...user,
                companyId: user.company_id,
                companyName: user.companyName
            });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (err) {
        console.error('Erro no login:', err);
        res.status(500).json({ error: err.message });
    }
});

// CORREÇÃO: Rota específica para servir o Service Worker com o Content-Type correto
app.get('/service-worker.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, 'service-worker.js'));
});

// CATCH ALL: Retorna index.html para qualquer rota que NÃO comece com /api (e não seja o SW)
app.get(/^(?!\/api).+/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
