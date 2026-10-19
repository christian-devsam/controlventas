-- ============================================================================
--  Plantas de Camila — Catálogo y promociones iniciales
--  Ejecutar DESPUÉS de 0002_vistas.sql
-- ============================================================================
--  Datos de arranque para que la app no aparezca vacía. Camila puede editar,
--  desactivar o agregar lo que quiera desde la pantalla "Plantas".
--  Precios de referencia en pesos chilenos — ajustalos a los reales.
-- ============================================================================

insert into public.plantas (nombre, categoria, precio_base, stock, stock_minimo, emoji) values
  -- Interior
  ('Potus',                  'Interior',   4500,  12, 4, '🌿'),
  ('Monstera deliciosa',     'Interior',  14900,   5, 2, '🌱'),
  ('Sansevieria',            'Interior',   6900,   8, 3, '🪴'),
  ('Zamioculca',             'Interior',  11900,   4, 2, '🪴'),
  ('Cinta',                  'Interior',   3500,  15, 5, '🌿'),
  ('Calathea',               'Interior',   9900,   3, 2, '🍃'),
  ('Peperomia',              'Interior',   5500,   7, 3, '🌱'),
  ('Palo de agua',           'Interior',   8900,   4, 2, '🎍'),

  -- Suculentas y cactus
  ('Suculenta chica',        'Suculentas', 1990,  40, 10, '🌵'),
  ('Suculenta mediana',      'Suculentas', 3490,  20, 6,  '🌵'),
  ('Echeveria',              'Suculentas', 2990,  18, 6,  '🌵'),
  ('Cactus surtido',         'Suculentas', 2490,  25, 8,  '🌵'),
  ('Planta de jade',         'Suculentas', 4990,  10, 3,  '🪴'),
  ('Aloe vera',              'Suculentas', 5490,   9, 3,  '🌿'),

  -- Exterior y jardín
  ('Lavanda',                'Exterior',   4990,  12, 4, '💜'),
  ('Romero',                 'Exterior',   3490,  14, 5, '🌿'),
  ('Hortensia',              'Exterior',   8990,   5, 2, '💐'),
  ('Helecho',                'Exterior',   5990,   8, 3, '🌾'),

  -- Aromáticas y comestibles (buena rotación, ticket bajo)
  ('Albahaca',               'Aromáticas', 2490,  20, 8, '🌿'),
  ('Menta',                  'Aromáticas', 2490,  18, 8, '🌿'),
  ('Cilantro',               'Aromáticas', 1990,  22, 8, '🌿'),

  -- Macetas y complementos: suben el ticket promedio sin ocupar más espacio
  ('Macetero cerámica chico','Maceteros',  3990,  16, 5, '🏺'),
  ('Macetero cerámica grande','Maceteros', 7990,   8, 3, '🏺'),
  ('Tierra de hojas 5L',     'Insumos',    2990,  25, 8, '🪣'),
  ('Fertilizante líquido',   'Insumos',    4490,  12, 4, '💧')
on conflict (nombre) do nothing;


insert into public.promociones (nombre, tipo, valor) values
  ('10% descuento',        'porcentaje',  10),
  ('15% descuento',        'porcentaje',  15),
  ('20% descuento',        'porcentaje',  20),
  ('Cliente frecuente',    'porcentaje',  10),
  ('$1.000 menos',         'monto_fijo',  1000),
  ('3 suculentas x $5.000','pack',        5000),
  ('Planta + macetero',    'pack',        0)
on conflict (nombre) do nothing;


-- Registrar el stock inicial como movimiento, para que el inventario tenga
-- historial desde el día uno.
insert into public.movimientos_stock (planta_id, tipo, cantidad, nota)
select p.id, 'ingreso', p.stock, 'Carga inicial del catálogo'
  from public.plantas p
 where p.stock > 0
   and not exists (
     select 1 from public.movimientos_stock m
      where m.planta_id = p.id and m.nota = 'Carga inicial del catálogo'
   );

-- El INSERT de arriba disparó el trigger, que sumó las cantidades ENCIMA del
-- stock que ya traían las filas. Reconciliamos dejando el stock cacheado igual
-- a la suma de los movimientos, que es la fuente de verdad.
-- (Esta misma consulta sirve si algún día el número no cuadra.)
update public.plantas p
   set stock = coalesce((
         select sum(m.cantidad)::int
           from public.movimientos_stock m
          where m.planta_id = p.id
       ), 0);
