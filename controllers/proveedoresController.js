const pool = require('../db/connection');

const listar = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM proveedores ORDER BY nombre'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const obtener = async (req, res) => {
  try {
    const { cuit } = req.params;
    const result = await pool.query(
      'SELECT * FROM proveedores WHERE cuit = $1',
      [cuit]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const crear = async (req, res) => {
  try {
    const {
      cuit, nombre, telefono, email, direccion,
      provincia, contacto, cbu, observaciones, estado,
    } = req.body;

    const existe = await pool.query(
      'SELECT cuit FROM proveedores WHERE cuit = $1',
      [cuit]
    );
    if (existe.rows.length > 0)
      return res.status(409).json({ error: 'Ya existe un proveedor con ese CUIT' });

    const result = await pool.query(
      `INSERT INTO proveedores
        (cuit, nombre, telefono, email, direccion, provincia, contacto, cbu, observaciones, estado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        cuit, nombre,
        telefono ?? null, email ?? null, direccion ?? null,
        provincia ?? null, contacto ?? null, cbu ?? null,
        observaciones ?? null, estado ?? 'Activo',
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const modificar = async (req, res) => {
  try {
    const { cuit } = req.params;
    const {
      nombre, telefono, email, direccion,
      provincia, contacto, cbu, observaciones, estado,
    } = req.body;

    const result = await pool.query(
      `UPDATE proveedores SET
        nombre       = COALESCE($1, nombre),
        telefono     = COALESCE($2, telefono),
        email        = COALESCE($3, email),
        direccion    = COALESCE($4, direccion),
        provincia    = COALESCE($5, provincia),
        contacto     = COALESCE($6, contacto),
        cbu          = COALESCE($7, cbu),
        observaciones= COALESCE($8, observaciones),
        estado       = COALESCE($9, estado)
       WHERE cuit = $10
       RETURNING *`,
      [nombre, telefono, email, direccion, provincia, contacto, cbu, observaciones, estado, cuit]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { listar, obtener, crear, modificar };
