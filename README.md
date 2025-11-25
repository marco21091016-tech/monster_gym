[index.php](https://github.com/user-attachments/files/23734985/index.php)
<?php
/* ===============================
   CONFIGURACIÓN DE LA BD POSTGRES
   =============================== */
$host = "localhost";
$port = "5432";           // Puerto por defecto de PostgreSQL
$user = "postgres";       // Usuario por defecto de PostgreSQL
$pass = "preposicion";    // Cambia por tu contraseña de PostgreSQL
$db   = "monstergym";

// Cadena de conexión para PostgreSQL
$conn_string = "host=$host port=$port dbname=$db user=$user password=$pass";
$conn = pg_connect($conn_string);

if (!$conn) {
    die("Error de conexión: " . pg_last_error());
}

/* ===============================
   MANEJO DE CREAR / ACTUALIZAR
   =============================== */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $id          = isset($_POST['id']) && $_POST['id'] !== '' ? (int)$_POST['id'] : null;
    $nombre      = trim($_POST['nombre'] ?? '');
    $descripcion = trim($_POST['descripcion'] ?? '');
    $precio      = $_POST['precio'] ?? 0;
    $stock       = $_POST['stock'] ?? 0;
    $categoria   = trim($_POST['categoria'] ?? '');
    $imagen_url  = trim($_POST['imagen_url'] ?? '');

    if ($id) {
        // UPDATE
        $query = "UPDATE productos 
                  SET nombre = $1, descripcion = $2, precio = $3, stock = $4, categoria = $5, imagen_url = $6
                  WHERE id = $7";
        $result = pg_query_params($conn, $query, [
            $nombre, $descripcion, $precio, $stock, $categoria, $imagen_url, $id
        ]);
    } else {
        // INSERT
        $query = "INSERT INTO productos (nombre, descripcion, precio, stock, categoria, imagen_url)
                  VALUES ($1, $2, $3, $4, $5, $6)";
        $result = pg_query_params($conn, $query, [
            $nombre, $descripcion, $precio, $stock, $categoria, $imagen_url
        ]);
    }

    if ($result) {
        header("Location: " . $_SERVER['PHP_SELF'] . "?msg=ok");
        exit;
    } else {
        die("Error al guardar: " . pg_last_error($conn));
    }
}

/* ===============================
   MANEJO DE ELIMINAR
   =============================== */
if (isset($_GET['delete'])) {
    $deleteId = (int) $_GET['delete'];

    $query = "DELETE FROM productos WHERE id = $1";
    $result = pg_query_params($conn, $query, [$deleteId]);

    if ($result) {
        header("Location: " . $_SERVER['PHP_SELF'] . "?msg=deleted");
        exit;
    } else {
        die("Error al eliminar: " . pg_last_error($conn));
    }
}

/* ===============================
   CARGAR PRODUCTO PARA EDITAR
   =============================== */
$editing      = false;
$editProduct  = [
    'id'          => '',
    'nombre'      => '',
    'descripcion' => '',
    'precio'      => '',
    'stock'       => '',
    'categoria'   => '',
    'imagen_url'  => ''
];

if (isset($_GET['edit'])) {
    $editId = (int) $_GET['edit'];

    $query = "SELECT * FROM productos WHERE id = $1";
    $result = pg_query_params($conn, $query, [$editId]);
    
    if ($result && pg_num_rows($result) > 0) {
        $editing     = true;
        $editProduct = pg_fetch_assoc($result);
    }
}

/* ===============================
   LISTADO DE PRODUCTOS
   =============================== */
$result = pg_query($conn, "SELECT * FROM productos ORDER BY id DESC");
$productos = $result ? $result : false;
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>MonsterGym - CRUD de Productos</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    :root {
      --bg-dark: #0b0c10;
      --bg-card: #151720;
      --primary: #1f8ef1;
      --primary-soft: rgba(31, 142, 241, 0.15);
      --accent: #f5a623;
      --text-main: #f5f5f5;
      --text-muted: #a0a4b8;
      --border: #2a2d3a;
      --danger: #ff4d4f;
      --success: #2ecc71;
      --radius-lg: 14px;
      --radius-md: 10px;
      --shadow-soft: 0 18px 45px rgba(0, 0, 0, 0.45);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
        sans-serif;
    }

    body {
      background: radial-gradient(circle at top, #20263c 0, #05060a 50%, #000 100%);
      color: var(--text-main);
      min-height: 100vh;
      padding: 24px;
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }

    .page {
      width: 100%;
      max-width: 1200px;
    }

    header {
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .logo-circle {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: radial-gradient(circle at 30% 30%, #ffffff, #1f8ef1);
      box-shadow: 0 0 25px rgba(31, 142, 241, 0.7);
      display: flex;
      justify-content: center;
      align-items: center;
      font-weight: 800;
      color: #05060a;
      letter-spacing: 1px;
    }

    .logo-text h1 {
      font-size: 1.3rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .logo-text span {
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    .badge {
      padding: 6px 12px;
      border-radius: 999px;
      background: var(--primary-soft);
      border: 1px solid var(--primary);
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--primary);
    }

    main {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(0, 1.4fr);
      gap: 20px;
    }

    @media (max-width: 900px) {
      main {
        grid-template-columns: 1fr;
      }
    }

    .card {
      background: linear-gradient(135deg, #151720, #11131c);
      border-radius: var(--radius-lg);
      border: 1px solid var(--border);
      box-shadow: var(--shadow-soft);
      padding: 18px 20px 20px;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .card-header h2 {
      font-size: 1rem;
      text-transform: uppercase;
      letter-spacing: 0.16em;
      color: var(--text-muted);
    }

    .card-header small {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    form {
      display: grid;
      gap: 12px;
    }

    .two-columns {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    @media (max-width: 600px) {
      .two-columns {
        grid-template-columns: 1fr;
      }
    }

    label {
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-bottom: 4px;
      display: block;
    }

    input[type="text"],
    input[type="number"],
    input[type="url"],
    textarea,
    select {
      width: 100%;
      border-radius: var(--radius-md);
      border: 1px solid var(--border);
      background: #0f1119;
      padding: 8px 10px;
      color: var(--text-main);
      font-size: 0.85rem;
      outline: none;
      transition: border 0.15s ease, box-shadow 0.15s ease,
        background 0.15s ease;
    }

    input::placeholder,
    textarea::placeholder {
      color: #5b5f73;
    }

    input:focus,
    textarea:focus,
    select:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 1px rgba(31, 142, 241, 0.4);
      background: #10121c;
    }

    textarea {
      resize: vertical;
      min-height: 70px;
      max-height: 120px;
    }

    .helpers-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      margin-top: 4px;
    }

    .helpers-row small {
      font-size: 0.7rem;
      color: var(--text-muted);
    }

    .btn-row {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 6px;
    }

    .btn {
      border-radius: 999px;
      padding: 8px 16px;
      font-size: 0.8rem;
      border: none;
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      font-weight: 600;
      transition: transform 0.12s ease, box-shadow 0.12s ease,
        background 0.12s ease, color 0.12s ease;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .btn-primary {
      background: linear-gradient(135deg, #1f8ef1, #005bea);
      color: #ffffff;
      box-shadow: 0 12px 25px rgba(0, 91, 234, 0.5);
    }

    .btn-outline {
      background: transparent;
      color: var(--text-muted);
      border: 1px solid var(--border);
    }

    .btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 14px 32px rgba(0, 0, 0, 0.55);
    }

    .btn:active {
      transform: translateY(0);
      box-shadow: none;
    }

    .btn span.icon {
      font-size: 1rem;
    }

    .table-wrapper {
      border-radius: var(--radius-lg);
      border: 1px solid var(--border);
      background: #10121a;
      overflow: hidden;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8rem;
    }

    thead {
      background: linear-gradient(90deg, #141827, #191d30);
    }

    th,
    td {
      padding: 10px 12px;
      text-align: left;
      border-bottom: 1px solid #1f2233;
      vertical-align: middle;
    }

    th {
      text-transform: uppercase;
      letter-spacing: 0.1em;
      font-size: 0.7rem;
      color: var(--text-muted);
    }

    tbody tr:hover {
      background: rgba(31, 142, 241, 0.07);
    }

    .tag {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      background: rgba(245, 166, 35, 0.15);
      color: var(--accent);
    }

    .tag-soft {
      background: rgba(31, 142, 241, 0.15);
      color: var(--primary);
    }

    .price {
      font-weight: 600;
      color: var(--success);
    }

    .stock-low {
      color: var(--danger);
      font-weight: 600;
    }

    .stock-ok {
      color: var(--success);
      font-weight: 600;
    }

    .img-thumb {
      width: 42px;
      height: 42px;
      border-radius: 8px;
      object-fit: cover;
      border: 1px solid #262a3b;
    }

    .table-actions {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .link-btn {
      border-radius: 999px;
      padding: 4px 10px;
      border: 1px solid var(--border);
      background: #131625;
      color: var(--text-muted);
      font-size: 0.7rem;
      text-decoration: none;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      transition: background 0.12s ease, color 0.12s ease, border 0.12s ease;
    }

    .link-btn.edit {
      border-color: var(--primary);
      color: var(--primary);
    }

    .link-btn.delete {
      border-color: var(--danger);
      color: var(--danger);
    }

    .link-btn:hover {
      background: #1a1e30;
    }

    .footer-hint {
      margin-top: 10px;
      font-size: 0.7rem;
      color: var(--text-muted);
      text-align: right;
    }

    .alert {
      margin-bottom: 16px;
      padding: 8px 12px;
      border-radius: 999px;
      font-size: 0.8rem;
      display: inline-block;
    }
    .alert-ok {
      background: rgba(46, 204, 113, 0.15);
      color: var(--success);
      border: 1px solid var(--success);
    }
    .alert-del {
      background: rgba(255, 77, 79, 0.15);
      color: var(--danger);
      border: 1px solid var(--danger);
    }
  </style>
</head>
<body>
  <div class="page">
    <header>
      <div class="logo">
        <div class="logo-circle">MG</div>
        <div class="logo-text">
          <h1>MonsterGym Store</h1>
          <span>Panel de administración de productos</span>
        </div>
      </div>
      <div class="badge">CRUD Productos</div>
    </header>

    <?php if (isset($_GET['msg']) && $_GET['msg'] === 'ok'): ?>
      <div class="alert alert-ok">Producto guardado correctamente.</div>
    <?php elseif (isset($_GET['msg']) && $_GET['msg'] === 'deleted'): ?>
      <div class="alert alert-del">Producto eliminado correctamente.</div>
    <?php endif; ?>

    <main>
      <!-- FORMULARIO CREAR / EDITAR -->
      <section class="card">
        <div class="card-header">
          <h2><?php echo $editing ? 'Editar producto' : 'Nuevo producto'; ?></h2>
          <small>
            <?php echo $editing ? 'Actualiza los datos del producto seleccionado.' : 'Completa los campos para registrar un nuevo producto.'; ?>
          </small>
        </div>

        <form action="<?php echo htmlspecialchars($_SERVER['PHP_SELF']); ?>" method="post">
          <input type="hidden" name="id" value="<?php echo htmlspecialchars($editProduct['id']); ?>" />

          <div class="two-columns">
            <div>
              <label for="nombre">Nombre del producto</label>
              <input
                type="text"
                id="nombre"
                name="nombre"
                placeholder="Proteína Monster Whey"
                required
                value="<?php echo htmlspecialchars($editProduct['nombre']); ?>"
              />
            </div>

            <div>
              <label for="categoria">Categoría</label>
              <select id="categoria" name="categoria">
                <option value="">Selecciona una categoría</option>
                <?php
                $cats = ['suplementos', 'accesorios', 'ropa', 'equipamiento'];
                foreach ($cats as $cat):
                ?>
                  <option value="<?php echo $cat; ?>"
                    <?php echo ($editProduct['categoria'] === $cat ? 'selected' : ''); ?>>
                    <?php echo ucfirst($cat); ?>
                  </option>
                <?php endforeach; ?>
              </select>
            </div>
          </div>

          <div>
            <label for="descripcion">Descripción</label>
            <textarea
              id="descripcion"
              name="descripcion"
              placeholder="Descripción breve del producto..."
            ><?php echo htmlspecialchars($editProduct['descripcion']); ?></textarea>
          </div>

          <div class="two-columns">
            <div>
              <label for="precio">Precio (USD)</label>
              <input
                type="number"
                id="precio"
                name="precio"
                step="0.01"
                min="0"
                placeholder="59.99"
                required
                value="<?php echo htmlspecialchars($editProduct['precio']); ?>"
              />
            </div>

            <div>
              <label for="stock">Stock</label>
              <input
                type="number"
                id="stock"
                name="stock"
                min="0"
                placeholder="50"
                required
                value="<?php echo htmlspecialchars($editProduct['stock']); ?>"
              />
            </div>
          </div>

          <div>
            <label for="imagen_url">URL de imagen</label>
            <input
              type="url"
              id="imagen_url"
              name="imagen_url"
              placeholder="https://images.unsplash.com/..."
              value="<?php echo htmlspecialchars($editProduct['imagen_url']); ?>"
            />
            <div class="helpers-row">
              <small>Usa URLs de imágenes (por ejemplo, Unsplash).</small>
              <small>Campo: <strong>imagen_url</strong></small>
            </div>
          </div>

          <div class="btn-row">
            <button type="reset" class="btn btn-outline" onclick="window.location='<?php echo $_SERVER['PHP_SELF']; ?>'">
              <span class="icon">↺</span> Limpiar
            </button>

            <button type="submit" class="btn btn-primary">
              <span class="icon">💾</span>
              <?php echo $editing ? 'Actualizar producto' : 'Guardar producto'; ?>
            </button>
          </div>
        </form>
      </section>

      <!-- LISTADO DE PRODUCTOS -->
      <section class="card">
        <div class="card-header">
          <h2>Inventario</h2>
          <small>Basado en la tabla <strong>productos</strong></small>
        </div>

        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Precio</th>
                <th>Stock</th>
                <th>Imagen</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <?php if ($productos && pg_num_rows($productos) > 0): ?>
                <?php while ($row = pg_fetch_assoc($productos)): ?>
                  <tr>
                    <td><?php echo htmlspecialchars($row['id']); ?></td>
                    <td><?php echo htmlspecialchars($row['nombre']); ?></td>
                    <td>
                      <span class="tag <?php echo $row['categoria'] === 'suplementos' ? 'tag-soft' : ''; ?>">
                        <?php echo htmlspecialchars($row['categoria']); ?>
                      </span>
                    </td>
                    <td><span class="price">$<?php echo htmlspecialchars($row['precio']); ?></span></td>
                    <td>
                      <?php
                        $stockClass = ($row['stock'] <= 5) ? 'stock-low' : 'stock-ok';
                      ?>
                      <span class="<?php echo $stockClass; ?>">
                        <?php echo htmlspecialchars($row['stock']); ?>
                      </span>
                    </td>
                    <td>
                      <?php if (!empty($row['imagen_url'])): ?>
                        <img
                          src="<?php echo htmlspecialchars($row['imagen_url']); ?>"
                          alt="<?php echo htmlspecialchars($row['nombre']); ?>"
                          class="img-thumb"
                        />
                      <?php else: ?>
                        <span class="text-muted">Sin imagen</span>
                      <?php endif; ?>
                    </td>
                    <td>
                      <div class="table-actions">
                        <a href="?edit=<?php echo $row['id']; ?>" class="link-btn edit">Editar</a>
                        <a href="?delete=<?php echo $row['id']; ?>" class="link-btn delete"
                           onclick="return confirm('¿Seguro que deseas eliminar este producto?');">
                          Eliminar
                        </a>
                      </div>
                    </td>
                  </tr>
                <?php endwhile; ?>
              <?php else: ?>
                <tr>
                  <td colspan="7">No hay productos registrados.</td>
                </tr>
              <?php endif; ?>
            </tbody>
          </table>
        </div>

        <div class="footer-hint">
          Los datos se cargan directamente desde la base de datos <code>monstergym</code>.
        </div>
      </section>
    </main>
  </div>
</body>
</html>
