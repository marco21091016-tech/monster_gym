const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { pool, testConnection } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || 'monster_gym_neon_secret_2024';

// Middleware para producción
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(express.json());

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Middleware de autenticación
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de acceso requerido' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido' });
    }
    req.user = user;
    next();
  });
};

// ==================== RUTAS DE AUTENTICACIÓN ====================
app.post('/api/register', async (req, res) => {
  try {
    const { nombre, email, password } = req.body;
    
    if (!nombre || !email || !password) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }

    const userExists = await pool.query(
      'SELECT * FROM usuarios WHERE email = $1',
      [email]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'El usuario ya existe' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO usuarios (nombre, email, password) VALUES ($1, $2, $3) RETURNING id, nombre, email, tipo_usuario',
      [nombre, email, hashedPassword]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email, tipo: user.tipo_usuario },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Usuario registrado exitosamente',
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        tipo: user.tipo_usuario
      }
    });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }

    const result = await pool.query(
      'SELECT * FROM usuarios WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Credenciales inválidas' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(400).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, tipo: user.tipo_usuario },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login exitoso',
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        tipo: user.tipo_usuario
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ==================== RUTAS DE PRODUCTOS ====================
app.get('/api/productos', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM productos ORDER BY id');
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo productos:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ==================== RUTAS DEL CARRITO ====================
app.get('/api/carrito', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.cantidad, p.id as producto_id, p.nombre, p.precio, p.imagen_url, p.stock 
       FROM carrito c 
       JOIN productos p ON c.producto_id = p.id 
       WHERE c.usuario_id = $1`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo carrito:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

app.post('/api/carrito', authenticateToken, async (req, res) => {
  try {
    const { producto_id, cantidad } = req.body;

    if (!producto_id || !cantidad) {
      return res.status(400).json({ error: 'Producto ID y cantidad son requeridos' });
    }

    const producto = await pool.query(
      'SELECT * FROM productos WHERE id = $1',
      [producto_id]
    );

    if (producto.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    if (producto.rows[0].stock < cantidad) {
      return res.status(400).json({ error: 'Stock insuficiente' });
    }

    const existingItem = await pool.query(
      'SELECT * FROM carrito WHERE usuario_id = $1 AND producto_id = $2',
      [req.user.id, producto_id]
    );

    if (existingItem.rows.length > 0) {
      await pool.query(
        'UPDATE carrito SET cantidad = cantidad + $1 WHERE usuario_id = $2 AND producto_id = $3',
        [cantidad, req.user.id, producto_id]
      );
    } else {
      await pool.query(
        'INSERT INTO carrito (usuario_id, producto_id, cantidad) VALUES ($1, $2, $3)',
        [req.user.id, producto_id, cantidad]
      );
    }

    res.json({ message: 'Producto agregado al carrito' });
  } catch (error) {
    console.error('Error agregando al carrito:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ==================== RUTAS DE VENTAS ====================
app.post('/api/ventas', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const carritoItems = await client.query(
      `SELECT c.id, c.producto_id, c.cantidad, p.precio, p.stock, p.nombre 
       FROM carrito c 
       JOIN productos p ON c.producto_id = p.id 
       WHERE c.usuario_id = $1`,
      [req.user.id]
    );

    if (carritoItems.rows.length === 0) {
      throw new Error('El carrito está vacío');
    }

    for (const item of carritoItems.rows) {
      if (item.stock < item.cantidad) {
        throw new Error(`Stock insuficiente para ${item.nombre}`);
      }
    }

    let total = 0;
    for (const item of carritoItems.rows) {
      total += item.precio * item.cantidad;
    }

    const ventaResult = await client.query(
      'INSERT INTO ventas (usuario_id, total) VALUES ($1, $2) RETURNING id',
      [req.user.id, total]
    );

    const ventaId = ventaResult.rows[0].id;

    for (const item of carritoItems.rows) {
      await client.query(
        'INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, precio_unitario) VALUES ($1, $2, $3, $4)',
        [ventaId, item.producto_id, item.cantidad, item.precio]
      );

      await client.query(
        'UPDATE productos SET stock = stock - $1 WHERE id = $2',
        [item.cantidad, item.producto_id]
      );
    }

    await client.query('DELETE FROM carrito WHERE usuario_id = $1', [req.user.id]);
    await client.query('COMMIT');
    
    res.json({ 
      message: 'Venta realizada exitosamente', 
      venta_id: ventaId,
      total: total
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error procesando venta:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// ==================== RUTAS DE ADMINISTRACIÓN ====================
app.get('/api/admin/ventas', authenticateToken, async (req, res) => {
  try {
    if (req.user.tipo !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const result = await pool.query(
      `SELECT v.*, u.nombre as usuario_nombre, u.email as usuario_email,
              (SELECT COUNT(*) FROM detalle_ventas dv WHERE dv.venta_id = v.id) as items
       FROM ventas v 
       JOIN usuarios u ON v.usuario_id = u.id 
       ORDER BY v.fecha_venta DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo ventas admin:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

app.get('/api/admin/inventario', authenticateToken, async (req, res) => {
  try {
    if (req.user.tipo !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const result = await pool.query('SELECT * FROM productos ORDER BY id');
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo inventario:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ==================== RUTAS DE VERIFICACIÓN ====================
app.get('/api/test', async (req, res) => {
  try {
    const dbTest = await pool.query('SELECT NOW() as time, version() as version');
    const userCount = await pool.query('SELECT COUNT(*) as users FROM usuarios');
    const productCount = await pool.query('SELECT COUNT(*) as products FROM productos');
    
    res.json({ 
      message: '✅ Monster Gym API funcionando con Neon.tech',
      database: {
        time: dbTest.rows[0].time,
        version: dbTest.rows[0].version,
        users: parseInt(userCount.rows[0].users),
        products: parseInt(productCount.rows[0].products)
      },
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    console.error('Error en test:', error);
    res.status(500).json({ error: 'Error conectando a la base de datos' });
  }
});

// Ruta para servir el frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Inicializar servidor
const startServer = async () => {
  try {
    // Probar conexión a Neon
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('❌ No se pudo conectar a Neon.tech');
      process.exit(1);
    }

    app.listen(PORT, () => {
      console.log('🚀 ==========================================');
      console.log('🏋️  MONSTER GYM - DESPLIEGUE EN PRODUCCIÓN');
      console.log('🚀 ==========================================');
      console.log(`📡 Servidor corriendo en puerto: ${PORT}`);
      console.log(`🗄️  Base de datos: Neon.tech PostgreSQL`);
      console.log(`🌍 Frontend: https://tu-app.railway.app`);
      console.log(`📊 API: https://tu-app.railway.app/api`);
      console.log('✅ ==========================================');
    });
  } catch (error) {
    console.error('❌ Error iniciando servidor:', error);
    process.exit(1);
  }
};

startServer();