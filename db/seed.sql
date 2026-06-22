INSERT INTO categorias_producto (nombre, porcentaje_ganancia) VALUES
('Cementos', 15), ('Áridos', 20), ('Ladrillos', 18), ('Pinturas', 25)
ON CONFLICT DO NOTHING;

INSERT INTO proveedores (cuit, nombre, telefono, estado) VALUES
('20-11111111-1', 'Distribuidora Norte', '388-4001111', 'Activo'),
('20-22222222-2', 'Materiales del Sur', '388-4002222', 'Activo')
ON CONFLICT DO NOTHING;

INSERT INTO productos (codigo, nombre, categoria_id, stock_actual, stock_minimo, precio_costo, porcentaje_ganancia) VALUES
('COD-001', 'Cemento Portland', 1, 150, 50, 8500, 15),
('COD-002', 'Arena fina', 2, 8, 15, 3200, 20),
('COD-003', 'Ladrillo común', 3, 2000, 500, 120, 18),
('COD-004', 'Cal hidráulica', 1, 3, 20, 4100, 15)
ON CONFLICT DO NOTHING;

INSERT INTO clientes (dni, nombre_apellido, telefono, tipo, limite_credito) VALUES
('30111222', 'Juan Pérez', '388-5001111', 'Normal', 0),
('30333444', 'María González', '388-5002222', 'Cuenta corriente', 50000),
('30555666', 'Carlos Rodríguez', '388-5003333', 'Normal', 0),
('32000001', 'Roberto Medina', '388-5004444', 'Cuenta corriente', 100000)
ON CONFLICT DO NOTHING;
