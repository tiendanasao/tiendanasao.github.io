# Nasao — "aquí todo lo encontrarás"

Catálogo web de Nasao con pedidos por WhatsApp.
🌐 **https://tiendanasao.github.io**

## Cómo funciona
- El cliente ve el catálogo, filtra por categoría/talla, arma su pedido y lo envía a WhatsApp (322 209 1632) con referencias, tallas y total.
- **La web no guarda datos de clientes.** El carrito vive solo en el navegador del visitante. El registro de pedidos se lleva aparte, en privado.

## Administrar productos
Todo está en `index.html`, bloque `CONFIGURACIÓN`:

```js
{ref:"NS-P01", cat:"pijamas", nombre:"Gatitos lila", desc:"…", talla:"S/M", precio:25000, img:"img/p-gatitos-lila.webp"},
```

- `ref`: código único (P = pijama, T = bata, B = buzo).
- `cat`: id de una de las `CATEGORIAS` (se agregan nuevas allí mismo).
- `talla`: vacío = "Consultar".
- `img`: foto cuadrada ~560 px en `img/`.
- `temporada:true` marca productos navideños.
- `agotado:true` oculta el botón de compra (muestra "Agotado").
- `NAVIDAD` (arriba en la configuración): activa la temporada, la cuenta regresiva y el filtro 🎄. Poner `activa:false` en enero.

Cada cambio en la rama `main` se publica solo en 1–2 minutos (GitHub Pages).
