# Nasao — "aquí todo lo encontrarás"

Catálogo web de Nasao con pedidos por WhatsApp.
🌐 **https://tiendanasao.github.io**

## Cómo funciona
- El cliente ve el catálogo, filtra por categoría/talla, arma su pedido y lo envía a WhatsApp (322 209 1632) con referencias, tallas y total.
- **La web no guarda datos de clientes.** El carrito vive solo en el navegador del visitante. El registro de pedidos se lleva aparte, en privado.

## Cómo funciona el inventario (catálogo rotativo)
- Cada pedido al proveedor trae diseños distintos o surtidos: **las fotos no son fijas**.
- **Llega mercancía nueva:** Daniel envía fotos + talla + precio → se agregan con referencias nuevas (la numeración sigue, nunca se reutiliza una ref).
- **Se vende una prenda:** se retira del catálogo y se borra su foto del repositorio. El historial queda solo en la hoja privada de pedidos.
- **Llega un diseño igual a uno publicado:** Daniel lo indica → se conserva la misma ref y foto, y solo se suma stock en la hoja.
- Nada se retira sin que Daniel confirme que se vendió o que ya no está.

## Administrar productos
Todo está en `index.html`, bloque `CONFIGURACIÓN`:

```js
{ref:"NS-P01", cat:"pijamas", nombre:"Gatitos lila", desc:"…", talla:"S/M", precio:25000, img:"img/p-gatitos-lila.webp"},
```

- `ref`: código único (P = pijama, T = bata, B = buzo). Última usada: P10, T03, B06.
- `cat`: id de una de las `CATEGORIAS` (se agregan nuevas allí mismo).
- `talla`: vacío = "Consultar".
- `img`: foto cuadrada ~560 px en `img/`.
- `temporada:"navidad"` marca un diseño de esa temporada (insignia y filtro solo mientras la temporada está activa).
- `agotado:true` muestra "VENDIDO" temporalmente (normalmente se retira la prenda).
- `TEMPORADAS`: la web es general; cada temporada (Navidad, Día de la Madre, Amor y Amistad…) se activa sola por fecha y pone su frase, cuenta regresiva, filtro y ambiente (nieve solo en Navidad). Fuera de temporada la web queda neutra.

Cada cambio en la rama `main` se publica solo en 1–2 minutos (GitHub Pages).

## Motor (Google Sheets + Apps Script)
- Hoja "Nasao · Motor del catálogo" (Drive de Daniel): pestañas **Productos** (catálogo en vivo) y **Pedidos** (privada).
- Código del motor: `motor/Codigo.gs` (pegado en Extensiones → Apps Script de la hoja, implementado como aplicación web "Cualquier persona").
- La URL de la implementación va en `var MOTOR = "..."` de `index.html`. Vacío = la web usa la lista `PRODUCTOS` como respaldo.
- Estados de prenda: Disponible · Apartada (24 h, vuelve sola) · Vendida (sale de la web) · Oculta.
- Pedidos: Pagado/Entregado → prenda Vendida; Cancelado → Disponible.
- Fotos nuevas: subir a la carpeta de Drive "Nasao · Fotos nuevas" → aparece fila nueva en Productos como "Oculta".
