INSERT INTO usuarios (nombre, usuario, password, rol)
VALUES ('Encargado Logística', 'logistica', 'logis123', 'logistica')
ON CONFLICT DO NOTHING;
