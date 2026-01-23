
import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import bodyParser from 'body-parser';
import 'dotenv/config'; // Loads .env file if it exists

const app = express();
// HostGator often assigns a dynamic port, so we must use process.env.PORT
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// Database configuration using Environment Variables (Production) or default (Local)
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pedidos',
  multipleStatements: true
};

let pool;

async function initDB() {
  try {
    // In production (HostGator), the DB is usually created via cPanel.
    // We try to connect directly.
    pool = mysql.createPool(dbConfig);

    // 3. Create Tables (Sync Schema)
    const createTablesQuery = `
      CREATE TABLE IF NOT EXISTS employees (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100),
        role VARCHAR(50),
        contact VARCHAR(100),
        admittedDate VARCHAR(20),
        login VARCHAR(50),
        password VARCHAR(100),
        accessLevel VARCHAR(20)
      );

      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(50) PRIMARY KEY,
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
        currentStatus VARCHAR(50)
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
    `;

    await pool.query(createTablesQuery);

    // 4. Seed Admin User if empty
    const [rows] = await pool.query('SELECT * FROM employees WHERE login = "admin"');
    if (rows.length === 0) {
      await pool.query(`
        INSERT INTO employees (id, name, role, contact, admittedDate, login, password, accessLevel)
        VALUES ('E001', 'Administrador', 'Gerente', 'admin@sistema.com', '01/01/2023', 'admin', '123', 'admin')
      `);
      console.log('Admin user created (admin/123)');
    }

    console.log('Database and Tables synced successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

initDB();

// --- Routes ---

app.get('/', (req, res) => {
    res.send(`
        <div style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h1>API Rastreaê Online! 🚀</h1>
            <p>Backend rodando.</p>
        </div>
    `);
});

// 1. Get All Orders
app.get('/api/orders', async (req, res) => {
  try {
    const [orders] = await pool.query('SELECT * FROM orders');
    
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
    res.status(500).json({ error: err.message });
  }
});

// 2. Get Order by ID
app.get('/api/orders/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    const order = rows[0];
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
    res.status(500).json({ error: err.message });
  }
});

// 3. Create Order
app.post('/api/orders', async (req, res) => {
  if (!pool) return res.status(500).json({error: "Database not initialized"});
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const order = req.body;

    await conn.query(
      `INSERT INTO orders (id, customerName, customerPhone, orderDate, estimatedDelivery, total, downPayment, paymentMethod, shippingAddress, pressingDate, seamstress, currentStatus)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [order.id, order.customerName, order.customerPhone, order.orderDate, order.estimatedDelivery, order.total, order.downPayment, order.paymentMethod, order.shippingAddress, order.pressingDate, order.seamstress, order.currentStatus]
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
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// 4. Update Order (Full)
app.put('/api/orders/:id', async (req, res) => {
  if (!pool) return res.status(500).json({error: "Database not initialized"});
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const orderId = req.params.id;
    const order = req.body;

    // Update main info
    await conn.query(
      `UPDATE orders SET customerName=?, customerPhone=?, orderDate=?, estimatedDelivery=?, total=?, downPayment=?, paymentMethod=?, shippingAddress=?, pressingDate=?, seamstress=? WHERE id=?`,
      [order.customerName, order.customerPhone, order.orderDate, order.estimatedDelivery, order.total, order.downPayment, order.paymentMethod, order.shippingAddress, order.pressingDate, order.seamstress, orderId]
    );

    // Replace Items
    await conn.query('DELETE FROM order_items WHERE order_id = ?', [orderId]);
    if (order.items && order.items.length > 0) {
      const itemValues = order.items.map(item => [orderId, item.name, item.size, item.quantity, item.price, item.image]);
      await conn.query('INSERT INTO order_items (order_id, name, size, quantity, price, image) VALUES ?', [itemValues]);
    }

    // Replace Photos
    await conn.query('DELETE FROM order_photos WHERE order_id = ?', [orderId]);
    if (order.photos && order.photos.length > 0) {
      const photoValues = order.photos.map(p => [orderId, p]);
      await conn.query('INSERT INTO order_photos (order_id, photo_data) VALUES ?', [photoValues]);
    }
    
    await conn.commit();
    res.json({ message: 'Order updated' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// 5. Update Status & Timeline
app.patch('/api/orders/:id/status', async (req, res) => {
  if (!pool) return res.status(500).json({error: "Database not initialized"});
  const conn = await pool.getConnection();
  try {
      await conn.beginTransaction();
      const { currentStatus, timeline } = req.body;
      const orderId = req.params.id;

      await conn.query('UPDATE orders SET currentStatus = ? WHERE id = ?', [currentStatus, orderId]);
      
      // Replace timeline
      await conn.query('DELETE FROM order_timeline WHERE order_id = ?', [orderId]);
      if (timeline && timeline.length > 0) {
          const timelineValues = timeline.map(t => [orderId, t.status, t.timestamp, t.description, t.location, t.completed]);
          await conn.query('INSERT INTO order_timeline (order_id, status, timestamp, description, location, completed) VALUES ?', [timelineValues]);
      }

      await conn.commit();
      res.json({ message: 'Status updated' });
  } catch (err) {
      await conn.rollback();
      res.status(500).json({ error: err.message });
  } finally {
      conn.release();
  }
});

// 6. Delete Order
app.delete('/api/orders/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM orders WHERE id = ?', [req.params.id]);
        res.json({ message: 'Order deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 7. Register Payment
app.post('/api/orders/:id/payment', async (req, res) => {
    try {
        const { amount, method } = req.body;
        // Fetch current values
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
        res.status(500).json({ error: err.message });
    }
});

// --- Employee Routes ---

app.get('/api/employees', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM employees');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/employees', async (req, res) => {
    try {
        const emp = req.body;
        await pool.query(
            `INSERT INTO employees (id, name, role, contact, admittedDate, login, password, accessLevel)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [emp.id, emp.name, emp.role, emp.contact, emp.admittedDate, emp.login, emp.password, emp.accessLevel]
        );
        res.status(201).json(emp);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/employees/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM employees WHERE id = ?', [req.params.id]);
        res.json({ message: 'Employee deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { login, password } = req.body;
        const [rows] = await pool.query('SELECT * FROM employees WHERE login = ? AND password = ?', [login, password]);
        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
