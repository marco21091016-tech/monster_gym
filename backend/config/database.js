const { Pool } = require('pg');
require('dotenv').config();

// Configuración optimizada para Neon.tech
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  // Configuraciones para mejor rendimiento
  max: 20, // máximo de clientes en el pool
  idleTimeoutMillis: 30000, // cierra clientes después de 30s de inactividad
  connectionTimeoutMillis: 2000, // timeout de conexión de 2 segundos
});

// Verificar conexión
pool.on('connect', () => {
  console.log('✅ Conectado a Neon.tech PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ Error en Neon PostgreSQL:', err);
});

// Función para probar la conexión
const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time');
    console.log('✅ Conexión a Neon exitosa. Hora del servidor:', result.rows[0].current_time);
    client.release();
    return true;
  } catch (error) {
    console.error('❌ Error conectando a Neon:', error.message);
    return false;
  }
};

module.exports = { pool, testConnection };