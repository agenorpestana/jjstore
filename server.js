
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
      CREATE TABLE IF NOT EXISTS companies (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100),
        plan VARCHAR(50),
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

    // --- MIGRATION CHECK (For existing installations) ---
    // Adiciona company_id se não existir para suportar migração de single-tenant
    const migrationQueries = [
       "ALTER TABLE orders ADD COLUMN pressingDate VARCHAR(20)",
       "ALTER TABLE orders ADD COLUMN seamstress VARCHAR(100)",
       "ALTER TABLE order_items ADD COLUMN size VARCHAR(20)",
       // SaaS Migrations
       "ALTER TABLE orders ADD COLUMN company_id VARCHAR(50)",
       "ALTER TABLE employees ADD COLUMN company_id VARCHAR(50)",
       "ALTER TABLE app_settings ADD COLUMN company_id VARCHAR(50)",
       // Drop primary key on app_settings to allow composite key if needed (complex migration omitted for brevity, assuming fresh or simple update)
    ];

    for (const query of migrationQueries) {
        try {
            await pool.query(query);
        } catch (e) {
            // Ignora erros de coluna duplicada
        }
    }

    // --- SAAS SUPER ADMIN (suporte / 200616) ---
    const [saasRows] = await pool.query('SELECT * FROM employees WHERE login = "suporte"');
    if (saasRows.length === 0) {
      // Cria um usuário sem company_id (Global Admin)
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
    // Retorna o ID da empresa vindo do Header (enviado pelo frontend logado)
    return req.headers['x-company-id'] || null;
}

// --- API Routes (Prefix /api) ---

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', port: PORT });
});

// --- SAAS REGISTRATION ---
app.post('/api/register-company', async (req, res) => {
    if (!pool) return res.status(500).json({error: "DB Error"});
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const { companyName, adminName, login, password, contact } = req.body;

        // 1. Create Company
        const companyId = `COMP-${Date.now()}`;
        await conn.query(
            'INSERT INTO companies (id, name, plan) VALUES (?, ?, ?)',
            [companyId, companyName, 'basic']
        );

        // 2. Create Admin Employee for Company
        const empId = `EMP-${Date.now()}`;
        await conn.query(
            `INSERT INTO employees (id, company_id, name, role, contact, admittedDate, login, password, accessLevel)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [empId, companyId, adminName, 'Administrador', contact, new Date().toLocaleDateString('pt-BR'), login, password, 'admin']
        );

        // 3. Create Default Settings for Company
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

        // Se não tiver companyId (tela de login ou pública), tenta pegar genérico ou precisa de lógica extra.
        // Para simplificar: Retorna configurações padrão se não logado, ou do usuário se logado.
        if (companyId && companyId !== 'null') {
            query += ' WHERE company_id = ?';
            params.push(companyId);
        } else {
            // Fallback: Retorna Rastreaê padrão
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
        
        // Upsert logic for specific company
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
    // Se for SAAS_ADMIN, vê tudo? Por enquanto vamos restringir:
    // Se não tem companyId (public view), não deve listar ALL orders.
    // Esta rota é usada pelo Dashboard Admin.
    
    if (!companyId) return res.status(403).json({ error: 'Access denied' });

    let query = 'SELECT * FROM orders';
    let params = [];

    // Se tiver companyId, filtra. Se for SaaS admin (sem companyId no token mas logado), talvez ver tudo?
    // Vamos assumir que o frontend manda o companyId do user logado.
    if (companyId !== 'null') {
        query += ' WHERE company_id = ?';
        params.push(companyId);
    }

    const [orders] = await pool.query(query, params);
    
    // Otimização: Em produção, evitar N+1 queries. Aqui mantemos estrutura existente.
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
    // Busca o pedido independente da empresa (Cliente final rastreando)
    const [rows] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    const order = rows[0];

    // Se o usuário do admin estiver logado e tentando ver um pedido de OUTRA empresa:
    // (Omitido para simplificação, assumindo que ID aleatório é "segurança" suficiente por ora)

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

// Updates and Deletes should conceptually check company_id too for security
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
        // Busca usuário e faz join (opcional, mas bom saber o nome da empresa)
        const [rows] = await pool.query(`
            SELECT e.*, c.name as companyName 
            FROM employees e 
            LEFT JOIN companies c ON e.company_id = c.id
            WHERE e.login = ? AND e.password = ?
        `, [login, password]);

        if (rows.length > 0) {
            const user = rows[0];
            // Rename for frontend consistency
            res.json({
                ...user,
                companyId: user.company_id, // ensure camelCase
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

app.get(/^(?!\/api).+/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
