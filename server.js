require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const productosRoutes          = require('./routes/productos');
const clientesRoutes           = require('./routes/clientes');
const proveedoresRoutes        = require('./routes/proveedores');
const ventasRoutes             = require('./routes/ventas');
const pedidosRoutes            = require('./routes/pedidos');
const presupuestosRoutes       = require('./routes/presupuestos');
const empleadosRoutes          = require('./routes/empleados');
const asistenciasRoutes        = require('./routes/asistencias');
const remuneracionesRoutes     = require('./routes/remuneraciones');
const vehiculosRoutes          = require('./routes/vehiculos');
const cuentaCorrienteRoutes    = require('./routes/cuentaCorriente');
const categoriasEmpleadoRoutes = require('./routes/categoriasEmpleado');
const mantenimientoRoutes      = require('./routes/mantenimiento');
const reportesRoutes           = require('./routes/reportes');
const authRoutes               = require('./routes/auth');
const egresosRoutes            = require('./routes/egresos');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/productos',           productosRoutes);
app.use('/api/clientes',            clientesRoutes);
app.use('/api/proveedores',         proveedoresRoutes);
app.use('/api/ventas',              ventasRoutes);
app.use('/api/pedidos',             pedidosRoutes);
app.use('/api/presupuestos',        presupuestosRoutes);
app.use('/api/empleados',           empleadosRoutes);
app.use('/api/asistencias',         asistenciasRoutes);
app.use('/api/remuneraciones',      remuneracionesRoutes);
app.use('/api/vehiculos',           vehiculosRoutes);
app.use('/api/cuenta-corriente',    cuentaCorrienteRoutes);
app.use('/api/categorias-empleado', categoriasEmpleadoRoutes);
app.use('/api/mantenimiento',       mantenimientoRoutes);
app.use('/api/reportes',            reportesRoutes);
app.use('/api/auth',               authRoutes);
app.use('/api/egresos',            egresosRoutes);

app.get('/', (req, res) => res.json({ mensaje: 'API Corralón Virgen de Punta Corral' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
