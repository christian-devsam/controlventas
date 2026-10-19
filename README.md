# Plantas de Camila — control de ventas

App de registro de ventas pensada para usarse **con una mano, desde el celular,
mientras hay una clienta esperando**. Puente Alto.

Stack: Next.js 16 (App Router) · Supabase (Postgres + Auth) · Tailwind 4 ·
Recharts · deploy en Vercel.

---

## 1. Puesta en marcha

### a) Crear las tablas

Entrá a **Supabase → SQL Editor → New query** y pegá los archivos de
`supabase/migrations/` **en orden**, uno por uno:

| Archivo | Qué hace |
|---|---|
| `0001_esquema.sql` | Tablas, triggers, RLS |
| `0002_vistas.sql` | Vistas para explorar con SQL |
| `0003_datos_iniciales.sql` | ~25 plantas y 7 promociones de arranque |
| `0004_funciones.sql` | Guardar venta, anular, mover stock |
| `0005_panel.sql` | Agregados del dashboard por período |

> No uso el connection string directo (`db.<proyecto>.supabase.co:5432`) a
> propósito. Desde Vercel cada función serverless abriría su propia conexión y
> el pool de Postgres se agota rápido. La app habla con Supabase por su API
> HTTP, y el esquema se aplica una sola vez a mano. Como efecto secundario, la
> contraseña de la base nunca tiene que salir de Supabase.

### b) Variables de entorno

```bash
cp .env.local.example .env.local
```

Completá `NEXT_PUBLIC_SUPABASE_ANON_KEY` con la llave **anon public** de
*Supabase → Project Settings → API*.

Esa llave es pública y está bien que lo sea: todas las tablas tienen RLS
activo, así que sin una sesión válida no devuelve ni una fila. La llave
`service_role` **no** se usa en este proyecto y no debe ponerse acá.

### c) Correr

```bash
npm install
npm run dev
```

La primera vez pedí un código a tu correo en `/login`. Supabase te deja entrar
sin que haya que crear usuario antes.

### d) Deploy en Vercel

1. Conectá el repo en Vercel (detecta Next.js solo, no hace falta configurar nada).
2. Agregá las tres variables de `.env.local` en *Settings → Environment Variables*.
   `NEXT_PUBLIC_SITE_URL` tiene que ser el dominio de Vercel.
3. En *Supabase → Authentication → URL Configuration*, agregá
   `https://tu-dominio.vercel.app/auth/callback` a **Redirect URLs**. Sin esto
   el enlace del correo rebota.

Después, desde el celular: abrir el sitio → "Agregar a pantalla de inicio".
Queda como una app, sin barra de direcciones.

---

## 2. El modelo de datos

```
plantas ──┐
          ├─< venta_items >── ventas ──> clientes
promociones┘        │
                    └──> movimientos_stock
```

Cuatro decisiones que explican casi todo el diseño:

**Una venta tiene cabecera y líneas.** Si una clienta compra 3 plantas, eso es
*una* venta con 3 líneas, no 3 ventas. Suena obvio pero es lo que permite medir
el **ticket promedio**, que es la métrica que más mueve un negocio chico:
subirlo de $6.000 a $8.000 es más fácil y más rentable que conseguir 30% más
clientas.

**El precio se congela en cada línea.** `venta_items` guarda dos precios:
`precio_unitario` (lo que se cobró de verdad) y `precio_lista` (lo que decía el
catálogo en ese momento). Los precios variables no son una excepción a manejar:
son el caso normal. Y guardar los dos es lo que después permite responder
*"¿cuánto descuento estoy regalando, y en qué plantas?"* — que casi nunca se
mide.

**Las promociones son una etiqueta, no una fórmula.** La app calcula un precio
sugerido, se puede escribir encima, y lo que se guarda es el número final. Si
mañana el 10% pasa a 15%, las ventas viejas siguen diciendo lo que realmente se
cobró. Si guardáramos la fórmula, el historial se reescribiría solo.

**El stock real está en `movimientos_stock`.** `plantas.stock` es una copia que
mantienen los triggers para poder leerla rápido. Cada entrada, venta, merma y
ajuste queda registrado, así que si un número no cuadra se reconstruye con
`select recalcular_stock()`.

**Montos en `integer`.** El peso chileno no tiene centavos; usar enteros elimina
de raíz los errores de redondeo.

### Por qué las escrituras pasan por funciones de Postgres

Guardar una venta son dos escrituras (cabecera + líneas). Desde el navegador
serían dos llamadas HTTP, y si la segunda falla —se cortó el datos justo ahí,
cosa normal en un local— quedaría una venta de $0 sin productos y sin descontar
stock, y nada lo desharía.

`registrar_venta()` hace las dos dentro de una transacción: o queda todo, o no
queda nada. Además **los totales no se reciben del cliente**, los derivan los
triggers desde las líneas — así no hay forma de guardar una venta descuadrada.

---

## 3. Las pantallas

| Ruta | Para qué |
|---|---|
| `/vender` | Registrar la venta. Es la pantalla de arranque. |
| `/ventas` | Historial por día, con detalle y anulación. |
| `/plantas` | Catálogo, precios, stock, reposición. |
| `/dashboard` | Los números. |

Decisiones de uso móvil que no se ven pero se notan:

- **La navegación va abajo.** En un celular, la parte de arriba de la pantalla
  queda lejos del pulgar.
- **Tres toques para una venta típica:** tocar la planta → "Cobrar" →
  "Confirmar". Tocar la misma planta otra vez sube la cantidad.
- **El precio siempre está editable y a la vista** en la hoja de cobro. Sin
  menús ni confirmaciones: es el caso normal, no una excepción.
- **Todos los inputs son de 16px.** Con menos, iOS hace zoom al enfocarlos y
  descuadra la pantalla entera.
- **Vender más de lo que marca el stock avisa pero no bloquea.** Perder una
  venta real es peor que un número de inventario desactualizado.
- **El tema sigue al del teléfono.** No hay botón de tema: en el celular, el
  celular manda.

---

## 4. Los gráficos

Cada uno existe para responder una pregunta concreta. El selector de período
(7/30/90 días) está **arriba y gobierna todo lo de abajo**, así que nunca hay
dos tarjetas mostrando rangos distintos.

| Gráfico | Pregunta que responde |
|---|---|
| Ingresos del período (cifra grande + % vs. período anterior) | ¿Estoy creciendo? |
| Línea de ingresos por día | ¿Qué días se cayó y por qué? |
| Barras de top plantas | ¿Qué vender más y qué dejar de traer? |
| Barra apilada por categoría | ¿En qué rubro está la plata? |
| Mapa de calor día × momento del día | ¿Cuándo conviene estar en el local o publicar? |
| Tabla de promociones | ¿Esta promo trae más de lo que cuesta? |
| Reponer / clientas que vuelven | Qué hacer esta semana |

Dos de esos tienen una vuelta de tuerca que vale la pena señalar:

**El ranking de plantas muestra el descuento promedio.** Una planta puede ser la
más vendida y a la vez la que más margen regala. Sin esa columna, el gráfico te
felicita por tu peor negocio.

**La tabla de promociones tiene una columna "Costó".** Es lo que casi nunca se
mide: una promo que vendió mucho pero resignó más de lo que trajo no está
funcionando, está regalando. Si resigna más del 25% de lo que genera, aparece un
aviso.

### Sobre los colores

La paleta no se eligió a ojo. El orden de los ocho colores categóricos se
obtuvo corriendo un validador sobre las 5.040 permutaciones posibles y
quedándose con la que **maximiza la separación mínima entre colores adyacentes
bajo daltonismo** (protan, deutan, tritan):

```
verde · azul · aqua · amarillo · magenta · naranja · violeta · rojo
peor par adyacente → ΔE 47.2 en claro, 41.3 en oscuro   (el mínimo aceptable es 12)
```

El verde va primero porque es una tienda de plantas, pero no a costa de la
accesibilidad: este orden resultó ser **mejor** que el de referencia (24.2 /
10.3). Los valores de modo oscuro no son un volteo automático: son los mismos
ocho tonos re-escalonados y validados contra la superficie oscura.

Otras reglas que sigue el panel, por si hay que agregar gráficos:

- **Un solo eje Y, nunca dos.** Dos escalas en un plot inventan una correlación
  que no está en los datos.
- **Una serie = un color.** Las barras del ranking son todas del mismo verde, no
  una rampa más-oscuro-donde-es-mayor: teñir por valor gasta el único canal libre
  repitiendo lo que el largo de la barra ya dice.
- **El color sigue a la entidad, no al ranking.** "Suculentas" es siempre el
  mismo color; cambiar el período reordena las barras pero no repinta nada.
- **Escala de magnitud = un solo tono, claro→oscuro.** El heatmap usa azul y no
  verde porque en esta app el verde ya significa "serie de datos".
- **El texto nunca lleva el color de la serie.** La identidad la carga el
  cuadradito de al lado.
- **Todo gráfico con colores de bajo contraste tiene botón "Ver tabla".** Un
  tooltip no sirve con teclado ni con lector de pantalla.

---

## 5. Ideas para que esto sirva más

Ordenadas por relación entre lo que cuestan y lo que devuelven.

### Vale la pena pronto

**1. Que las ventas se guarden sin señal.** El riesgo más concreto de la app hoy:
si en el local no hay datos, el botón "Confirmar" falla y la venta se registra a
mano o no se registra. Guardando el carrito en IndexedDB y sincronizando después,
el problema desaparece. Es la mejora de mayor impacto real.

**2. Cierre de caja.** Al final del día: "deberías tener $X en efectivo y $Y por
transferencia". Cuadrar la caja es lo que hace que los números del dashboard sean
confiables — y si no cuadran, avisa temprano.

**3. Avisos por WhatsApp a clientas que no vuelven.** La vista
`v_clientes_top` ya calcula `dias_sin_comprar`. Un botón que arme un link
`wa.me` con un mensaje listo convierte ese dato en una venta. Costo cero, y
recuperar una clienta cuesta mucho menos que conseguir una nueva.

**4. Registrar gastos.** Hoy la app mide ingresos, no utilidad. Con los gastos
(compra de plantas, maceteros, arriendo, locomoción) el dashboard puede decir
cuánta plata quedó de verdad, que es la pregunta que importa.

### Cuando haya unos meses de datos

**5. Margen real por planta.** La columna `costo` ya existe en la base y el
formulario ya la pide; falta la pantalla que cruce ingresos con costo. Casi
siempre aparece una sorpresa: la planta estrella no es la más rentable.

**6. Qué traer la próxima temporada.** Con un año de ventas se puede ver la
estacionalidad real (interior en invierno, exterior en primavera) y anticipar la
compra en vez de reaccionar.

**7. Fotos en el catálogo.** Con Supabase Storage. Sirve para dos cosas:
encontrar la planta más rápido en la grilla de venta, y tener el material para
el sitio web sin sesión de fotos aparte.

### Más adelante

**8. Catálogo público para mandar por WhatsApp.** Una página de solo lectura con
stock y precios actuales, generada de la misma base. "Mirá lo que tengo" en un
link, sin mantener dos inventarios.

**9. Ficha de cuidados.** Qué riego y qué luz necesita cada planta, para mandar o
imprimir con la compra. Diferencia frente a quien vende plantas sin más, y
reduce la planta que se muere en dos semanas y la clienta que no vuelve.

**10. Agenda de encargos.** El campo de notas ya recoge cosas como "pasa el
viernes". Convertirlas en recordatorios cierra el círculo.

**11. Exportar a Excel.** Para el contador y para el SII.

---

## 6. Estado de lo verificado

Honestidad sobre qué está probado y qué no:

| | |
|---|---|
| ✅ `tsc --noEmit` | sin errores |
| ✅ `npm run build` | compila, 10 rutas generadas |
| ✅ Render en móvil (375×812) | `/login` renderiza, 0 errores de consola |
| ✅ Guardia de sesión | `/` sin sesión redirige a `/login` |
| ✅ Tokens de color | medidos en el navegador en claro y oscuro |
| ✅ Contraste del botón | 5.02:1 medido en vivo (AA necesita 4.5:1) |
| ✅ Paleta categórica | validada con script en ambos modos |
| ⚠️ **El SQL no se ejecutó nunca** | revisado a mano, no corrido contra Postgres |
| ⚠️ **El flujo de venta no se probó end-to-end** | falta la anon key para conectar |

Los dos puntos amarillos se cierran igual: aplicá las migraciones y registrá una
venta de prueba. Si algo falla, va a ser en el SQL.
