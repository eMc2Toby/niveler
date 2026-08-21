# Niveler — Almacenamiento e infraestructura

---

## 1. Dos cuotas distintas que conviene no mezclar

Es importante separar dos cosas, porque se cuentan por separado y tienen límites diferentes:

| | Qué guarda | Cuota en Supabase Free |
|---|---|---|
| **Base de datos (PostgreSQL)** | Nombre, código, stock, categoría, movimientos, ventas | **500 MB** |
| **Storage (archivos)** | Las imágenes de los productos | **1 GB** |

Los datos del producto ocupan poquísimo en PostgreSQL. Una fila completa de producto —con nombre, SKU, descripción y todos los campos— pesa alrededor de **1 KB**. Un movimiento con su detalle, unos 300 bytes.

Las imágenes no viven en la base: van a Supabase Storage y consumen la cuota de archivos, no la de la base de datos. En la tabla `productos` solo se guarda la ruta (`PRD-001.webp`), que son unos 15 bytes.

---

## 2. Cuánto pesa realmente tu sistema

**Base de datos, hoy:**

| Concepto | Cantidad | Tamaño |
|---|---|---|
| Productos | 80 | ~80 KB |
| Movimientos + detalle | 1.589 | ~500 KB |
| Inventario (80 × 7 ciudades) | 560 | ~50 KB |
| Catálogos y usuarios | — | ~20 KB |
| **Total** | | **≈ 0,7 MB de 500 MB** |

Estás usando el **0,14%** de la cuota de base de datos. Aun creciendo a 300 movimientos por mes, tardarías más de **veinte años** en llenar los 500 MB. La base de datos no es tu límite y probablemente nunca lo sea.

**Imágenes, según el peso de cada una:**

| Peso por imagen | 80 imágenes | % de 1 GB |
|---|---|---|
| 1 MB (foto de celular sin tocar) | 80 MB | 8% |
| 500 KB | 40 MB | 4% |
| 300 KB (WebP calidad 80) | 24 MB | 2,4% |
| 150 KB (WebP optimizado) | 12 MB | 1,2% |

Con 500 KB por imagen usarías **40 MB de 1.024 MB**. Incluso con varias fotos por producto sigues muy holgado.

---

## 3. Cuántos productos caben en el plan gratuito

Suponiendo **una imagen por producto** y dejando 200 MB de margen de seguridad (824 MB utilizables):

| Peso por imagen | Productos que caben |
|---|---|
| 1 MB | ~820 |
| 500 KB | ~1.640 |
| 300 KB | ~2.740 |
| 150 KB | ~5.400 |

Con **tres fotos por producto a 300 KB** (900 KB por producto) todavía entran unos **900 productos**. Tienes 80.

Dicho de otra forma: comprimiendo bien, el espacio te alcanza para **crecer 30 veces** el catálogo actual sin pagar un peso de almacenamiento.

---

## 4. Cómo comprimir antes de subir

Convertir a **WebP entre 200 y 500 KB** es lo que te conviene. WebP pesa entre 25% y 35% menos que un JPG de la misma calidad visual, y hoy lo soportan todos los navegadores.

Con ImageMagick, para las 77 imágenes de una sola pasada:

```bash
# Redimensiona a 1000 px de ancho y convierte a WebP calidad 82
mkdir -p optimizadas
for f in imagenes_productos/*.jpg; do
  nombre=$(basename "$f" .jpg)
  magick "$f" -resize 1000x1000\> -quality 82 "optimizadas/${nombre}.webp"
done

# Verificar el peso total resultante
du -sh optimizadas/
```

Si prefieres sin instalar nada: **squoosh.app** (arrastrar y soltar, una por una) o **tinypng.com** (hasta 20 por lote).

**Recomendación adicional:** guardar dos versiones por producto.

```
productos/
├── PRD-001.webp          ← 1000px, ~300 KB, para la ficha de detalle
└── thumbs/PRD-001.webp   ← 300px,  ~25 KB, para las listas
```

Las listas de inventario muestran decenas de productos a la vez. Cargar la miniatura de 25 KB en lugar de la de 300 KB hace que la app abra al instante en el celular del gerente y consume una fracción de la cuota de transferencia. Esto importa más que el espacio: el plan gratuito da **5 GB de transferencia al mes**, y con miniaturas es prácticamente imposible acercarse.

En el código:

```ts
const thumb = `${URL}/storage/v1/object/public/productos/thumbs/${sku}.webp`
const full  = `${URL}/storage/v1/object/public/productos/${sku}.webp`
```

---

## 5. Qué servidor usaremos

**No hay servidor propio que administrar.** El sistema se reparte en dos servicios, y los dos tienen plan gratuito:

| Pieza | Servicio | Qué hace |
|---|---|---|
| Base de datos, API, login, imágenes | **Supabase** | Todo el backend |
| La aplicación web (PWA) | **Cloudflare Pages** | Sirve los archivos al navegador |

La app compilada es HTML, CSS y JavaScript estáticos: no necesita un servidor que ejecute código. Se sube a una red de distribución y listo. No hay Linux que parchar, ni Nginx que configurar, ni backups de servidor que programar.

### Supabase — sí, tiene plan gratuito

<cite index="21-1,25-1">El plan gratuito incluye 500 MB de base de datos, 1 GB de almacenamiento de archivos, 5 GB de transferencia, 50.000 usuarios activos mensuales y hasta 2 proyectos activos.</cite> Sin tarjeta de crédito y sin fecha de vencimiento.

**Dos advertencias que importan en tu caso:**

1. <cite index="26-1">Los proyectos gratuitos se pausan automáticamente tras 7 días sin actividad</cite>. Con siete ciudades registrando movimientos a diario esto nunca se va a disparar; solo sería un riesgo si el sistema quedara abandonado.

2. <cite index="27-1">El plan gratuito no incluye backups automáticos</cite>. **Este es el motivo real para pasar a Pro**, no el espacio. Un inventario sin respaldo diario es una apuesta: si algo se corrompe, no hay a dónde volver. Mientras tanto se puede programar un respaldo semanal gratuito con GitHub Actions.

El plan **Pro cuesta 25 USD/mes** e incluye 8 GB de base, 100 GB de archivos y backups diarios. Mi sugerencia: arrancar en Free durante el desarrollo y las primeras semanas de uso real, y pasar a Pro el día que el sistema sea el único registro del inventario. Sigue costando menos que los 20 USD/mes de AppSheet, y con muchísimo más margen.

### Cloudflare Pages — gratuito y sí permite uso comercial

Aquí hay un detalle que casi nadie menciona y que te habría costado un dolor de cabeza: **Vercel no sirve para este proyecto en su plan gratuito**. <cite index="9-1">El plan Hobby de Vercel está restringido a uso personal y no comercial.</cite> Niveler es una empresa, así que estarías fuera de los términos desde el primer día y tendrías que pagar 20 USD/mes por asiento.

<cite index="18-1">Cloudflare Pages, en cambio, ofrece ancho de banda ilimitado en su plan gratuito, sin tarjeta de crédito, sin vencimiento y con uso comercial permitido.</cite> <cite index="22-1">El plan gratuito permite 500 compilaciones al mes</cite>, más que suficiente: eso es 16 despliegues diarios.

**Netlify** es la alternativa si prefieres su interfaz; también permite uso comercial en su plan gratuito, con 100 GB de transferencia mensual.

### Región del servidor

Al crear el proyecto en Supabase, elegir **South America (São Paulo)**. Es la más cercana a Bolivia y reduce la latencia notablemente frente a las regiones de Estados Unidos. Cloudflare sirve desde su nodo más cercano automáticamente, así que ahí no hay nada que elegir.

---

## 6. Costo total

| Fase | Supabase | Hosting | Dominio | Total |
|---|---|---|---|---|
| Desarrollo y prueba | Free · 0 USD | Cloudflare Free · 0 USD | — | **0 USD/mes** |
| Producción | Pro · 25 USD | Cloudflare Free · 0 USD | ~12 USD/año | **≈ 26 USD/mes** |

Comparado con los ~20 USD/mes de AppSheet, pagas unos 6 dólares más y a cambio tienes control total, sin límites de usuarios editores, con deliveries modelados de verdad y la posibilidad de conectar la web de ventas más adelante.

---

## 7. Respaldo gratuito mientras estés en el plan Free

Guardar esto como `.github/workflows/backup.yml` en el repositorio. Hace un volcado de la base cada domingo y lo archiva en GitHub durante 90 días:

```yaml
name: Respaldo semanal de la base
on:
  schedule:
    - cron: '0 6 * * 0'   # domingos 06:00 UTC (02:00 en Bolivia)
  workflow_dispatch:       # también se puede lanzar a mano

jobs:
  respaldo:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Instalar cliente de Postgres
        run: sudo apt-get update && sudo apt-get install -y postgresql-client
      - name: Generar volcado
        env:
          DB_URL: ${{ secrets.SUPABASE_DB_URL }}
        run: pg_dump "$DB_URL" --no-owner --clean > respaldo-$(date +%F).sql
      - uses: actions/upload-artifact@v4
        with:
          name: respaldo-niveler
          path: respaldo-*.sql
          retention-days: 90
```

La cadena de conexión se saca de Supabase → Project Settings → Database → Connection string, y se guarda en GitHub → Settings → Secrets → `SUPABASE_DB_URL`.

Como beneficio secundario, este workflow toca la base todas las semanas, así que también evita la pausa automática por inactividad.
