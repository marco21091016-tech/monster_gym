const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || 'monster_gym_secret_2024';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

// DATOS EN MEMORIA (SIN BASE DE DATOS)
let products = [
  { 
    id: 1, 
    nombre: "Proteína Monster Whey", 
    descripcion: "Proteína de suero de leche premium", 
    precio: 59.99, 
    stock: 50, 
    categoria: "suplementos", 
    imagen_url: "https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=400" 
  },
  { 
    id: 2, 
    nombre: "Creatina Monohidrato", 
    descripcion: "Creatina pura para aumentar fuerza", 
    precio: 29.99, 
    stock: 30, 
    categoria: "suplementos", 
    imagen_url: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400" 
  },
  { 
    id: 3, 
    nombre: "Guantes de Levantamiento", 
    descripcion: "Guantes acolchados con soporte", 
    precio: 24.99, 
    stock: 20, 
    categoria: "accesorios", 
    imagen_url: "https://images.unsplash.com/photo-1571019614244-c5c476de34a1?w=400" 
  }
];

let users = [
  { 
    id: 1, 
    nombre: "Administrador", 
    email: "admin@monstergym.com", 
    password: "$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi", // password
    tipo_usuario: "admin" 
  }
];

let cart = [];
let sales = [];
let nextId = 4;

// MIDDLEWARE DE AUTENTICACIÓN
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

    if (users.find(user => user.email === email)) {
      return res.status(400).json({ error: 'El usuario ya existe' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: users.length + 1,
      nombre,
      email,
      password: hashedPassword,
      tipo_usuario: 'cliente'
    };

    users.push(newUser);

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, tipo: newUser.tipo_usuario },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Usuario registrado exitosamente',
      token,
      user: {
        id: newUser.id,
        nombre: newUser.nombre,
        email: newUser.email,
        tipo: newUser.tipo_usuario
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

    const user = users.find(u => u.email === email);

    if (!user) {
      return res.status(400).json({ error: 'Credenciales inválidas' });
    }

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
app.get('/api/productos', (req, res) => {
  res.json(products);
});

// ==================== RUTAS DEL CARRITO ====================
app.get('/api/carrito', authenticateToken, (req, res) => {
  const userCart = cart.filter(item => item.usuario_id === req.user.id);
  res.json(userCart);
});

app.post('/api/carrito', authenticateToken, (req, res) => {
  try {
    const { producto_id, cantidad } = req.body;

    if (!producto_id || !cantidad) {
      return res.status(400).json({ error: 'Producto ID y cantidad son requeridos' });
    }

    const product = products.find(p => p.id === producto_id);

    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    if (product.stock < cantidad) {
      return res.status(400).json({ error: 'Stock insuficiente' });
    }

    const existingItemIndex = cart.findIndex(
      item => item.usuario_id === req.user.id && item.producto_id === producto_id
    );

    if (existingItemIndex !== -1) {
      cart[existingItemIndex].cantidad += cantidad;
    } else {
      cart.push({
        id: cart.length + 1,
        usuario_id: req.user.id,
        producto_id,
        cantidad,
        nombre: product.nombre,
        precio: product.precio,
        imagen_url: product.imagen_url,
        stock: product.stock
      });
    }

    res.json({ message: 'Producto agregado al carrito' });
  } catch (error) {
    console.error('Error agregando al carrito:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

app.delete('/api/carrito/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const itemIndex = cart.findIndex(item => item.id === parseInt(id) && item.usuario_id === req.user.id);
    
    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Item no encontrado' });
    }

    cart.splice(itemIndex, 1);
    res.json({ message: 'Producto eliminado del carrito' });
  } catch (error) {
    console.error('Error eliminando del carrito:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ==================== RUTAS DE VENTAS ====================
app.post('/api/ventas', authenticateToken, (req, res) => {
  try {
    const userCart = cart.filter(item => item.usuario_id === req.user.id);

    if (userCart.length === 0) {
      return res.status(400).json({ error: 'El carrito está vacío' });
    }

    let total = 0;
    for (const item of userCart) {
      const product = products.find(p => p.id === item.producto_id);
      if (product.stock < item.cantidad) {
        return res.status(400).json({ error: `Stock insuficiente para ${product.nombre}` });
      }
      total += product.precio * item.cantidad;
    }

    // Actualizar stock
    for (const item of userCart) {
      const product = products.find(p => p.id === item.producto_id);
      product.stock -= item.cantidad;
    }

    // Crear venta
    const newSale = {
      id: sales.length + 1,
      usuario_id: req.user.id,
      total,
      fecha_venta: new Date(),
      items: [...userCart]
    };

    sales.push(newSale);

    // Vaciar carrito del usuario
    cart = cart.filter(item => item.usuario_id !== req.user.id);

    res.json({ 
      message: 'Venta realizada exitosamente', 
      venta_id: newSale.id,
      total: total
    });
  } catch (error) {
    console.error('Error procesando venta:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ==================== RUTAS DE ADMINISTRACIÓN ====================
app.get('/api/admin/ventas', authenticateToken, (req, res) => {
  try {
    if (req.user.tipo !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const salesWithUser = sales.map(sale => {
      const user = users.find(u => u.id === sale.usuario_id);
      return {
        ...sale,
        usuario_nombre: user ? user.nombre : 'Usuario desconocido',
        usuario_email: user ? user.email : 'Email desconocido',
        items: sale.items.length
      };
    });

    res.json(salesWithUser);
  } catch (error) {
    console.error('Error obteniendo ventas admin:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

app.get('/api/admin/inventario', authenticateToken, (req, res) => {
  try {
    if (req.user.tipo !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    res.json(products);
  } catch (error) {
    console.error('Error obteniendo inventario:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ==================== RUTAS DE VERIFICACIÓN ====================
app.get('/api/test', (req, res) => {
  res.json({ 
    message: '✅ Monster Gym API funcionando correctamente',
    environment: process.env.NODE_ENV || 'production',
    users: users.length,
    products: products.length,
    sales: sales.length
  });
});

// Ruta para servir el frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Inicializar servidor
app.listen(PORT, () => {
  console.log('🚀 ==========================================');
  console.log('🏋️  MONSTER GYM - FUNCIONANDO CORRECTAMENTE');
  console.log('🚀 ==========================================');
  console.log(`📡 Servidor corriendo en puerto: ${PORT}`);
  console.log(`🌍 Frontend: https://tu-app.render.com`);
  console.log(`📊 API: https://tu-app.render.com/api`);
  console.log('✅ ==========================================');
});
