# pasaDatos ⚡ por prolijo.ar

> **Herramienta gratuita de cobro rápido por transferencia en mostrador y WhatsApp.**
> Diseñada como producto Trojan Horse / Lead Magnet para potenciar el ecosistema tecnológico de **[prolijo.ar](https://prolijo.ar)**.

---

## 🎯 1. Objetivo del Sistema

En Argentina, el cobro por transferencia bancaria o billetera virtual (Mercado Pago, Cuenta DNI, BNA+, Galicia, etc.) en comercios físicos presenta tres grandes fricciones operativas:
1. **Errores de tipeo:** Dictar el Alias en voz alta provoca demoras y transferencias erróneas.
2. **Fricción de agenda:** Para mandar el comprobante por WhatsApp, el cliente se ve obligado a agendar el número del local en su libreta de contactos.
3. **Cartelería precaria:** Carteles improvisados en hojas borroneadas que transmiten poca seriedad.

**pasaDatos** elimina estos tres problemas en 10 segundos:
- Genera un **Cartel QR profesional de mostrador** listo para imprimir en A4/A5 o descargar como imagen HD.
- Permite a los clientes escanear el QR, copiar el Alias con un solo toque y abrir WhatsApp para mandar el comprobante **sin tener que agendar el contacto**.
- Ofrece a **prolijo.ar** un canal orgánico y de alta conversión para captar comerciantes con necesidades de Punto de Venta (POS), automatización y software a medida.

---

## 🏗️ 2. Arquitectura Zero-Database (Sin Base de Datos)

- **Cero Base de Datos:** No requiere MySQL, PostgreSQL ni Redis. Toda la configuración del comercio viaja codificada en los parámetros de la URL (`window.location.search`).
- **Códigos QR de Ultra Baja Densidad:** Usamos parámetros de 1 o 2 letras para generar URLs extremadamente cortas, lo que produce patrones QR de módulos grandes y lectura instantánea incluso con cámaras de gama baja o poca luz.
- **Agnóstica al Dominio:** Utiliza `window.location.origin + window.location.pathname`, funcionando inmediatamente en cualquier dominio, subdominio o IP donde se aloje.
- **Persistencia Local del Comerciante:** En el Modo Creador, los cambios se respaldan en tiempo real en el `localStorage` del navegador (`pasadatos_config`), evitando pérdidas accidentales al recargar la página.

---

## 📜 3. Contrato Oficial de Parámetros URL (Retrocompatibilidad Perpetua)

> ⚠️ **REGLA CRÍTICA:** Estas claves están impresas físicamente en códigos QR pegados en mostradores y vidrieras. **NUNCA DEBEN RENOMBRARSE NI ELIMINARSE** en futuros commits. Si algún parámetro falta, la interfaz se degrada con elegancia.

| Parámetro | Tipo | Descripción | Ejemplo |
| :--- | :--- | :--- | :--- |
| `n` | Requerido | Nombre del Comercio o Profesional | `Ferretería El Tornillo` |
| `r` | Opcional | Rubro o Subtítulo corto | `Materiales Eléctricos` |
| `a` | Requerido | Alias de CBU / CVU (normalizado mayúsculas) | `FERRE.TORNILLO.MP` |
| `c` | Opcional | CBU o CVU de 22 dígitos | `0000003100085492348571` |
| `t` | Requerido | Nombre del Titular de la cuenta | `Juan Carlos Pérez` |
| `u` | Opcional | CUIT / CUIL (formato `XX-XXXXXXXX-X`) | `20-38495821-3` |
| `b` | Requerido | Banco o Billetera de destino | `Mercado Pago` |
| `w` | Opcional | WhatsApp normalizado (`549...`) | `5491134859201` |
| `p` | Opcional | Mensaje o Promo destacada | `10% OFF abonando por transferencia` |
| `th` | Opcional | Tema visual (`blue`, `emerald`, `violet`, `slate`, `orange`) | `emerald` |
| `edit` | Opcional | Bandera para forzar Modo Creador | `1` |

---

## 🚀 4. Lógica de Enrutamiento (2 Vistas en 1 SPA)

1. **Modo Creador (Estudio + Generador):**
   - Se activa cuando la URL **no** contiene los parámetros `n` ni `a`, o cuando se incluye el flag `&edit=1`.
   - Permite al comerciante cargar sus datos con actualización en vivo.
   - Cuenta con pestañas de vista previa: Cartel para Mostrador y Maqueta de Celular del Cliente.
   - Herramientas de exportación: Imprimir A4/A5, Descargar PNG HD, Copiar link y Compartir en WhatsApp.
   - Sección comercial B2B con servicios de **prolijo.ar**.

2. **Modo Cliente (Pantalla de Cobro Rápido):**
   - Se activa cuando la URL contiene `?n=...&a=...` (al escanear el QR o abrir el link).
   - Vista *Mobile-First* ultra limpia, sin distracciones.
   - **Botón Gigante:** Copia el alias con vibración háptica y feedback visual verde durante 2.5 segundos.
   - **Cero Agenda:** Botón directo a `wa.me/549...` con texto prearmado para adjuntar el comprobante sin agendar el número.
   - **Calculadora Rápida:** Permite anotar el monto y calcula descuentos promocionales con 1 toque.
   - **Footer Viral:** Enlaces para crear un cartel gratis o conocer los servicios de **prolijo.ar**.

---

## 🛠️ 5. Stack Tecnológico

- **Frontend:** HTML5 semántico + Vanilla JavaScript moderno (ES6+).
- **Estilos:** Tailwind CSS (vía CDN) + variables CSS personalizadas para temas visuales dinámicos.
- **Iconos:** Lucide Icons (vía CDN).
- **Generación QR:** QRious (vía CDN) renderizado a DataURL rasterizado en etiqueta `<img>` para compatibilidad total con impresión e imágenes.
- **Exportación PNG:** html2canvas (vía CDN) con `scale: 3` para descargas nítidas de alta resolución.
- **Servidor:** Nginx Alpine (`nginx:alpine`) con compresión Gzip y cabeceras de no-caché para despliegues instantáneos.

---

## 📦 6. Despliegue en Coolify

Este proyecto está optimizado para desplegarse mediante Docker en Coolify con auto-deploy desde Git:

1. Creá una nueva aplicación en Coolify seleccionando tu repositorio de Git.
2. En tipo de Build seleccioná **Dockerfile**.
3. El puerto expuesto es el **80**.
4. ¡Listo! Cada `git push` a la rama principal actualizará la aplicación de inmediato sin problemas de caché viejo gracias a la configuración en `nginx.conf`.

### Ejecución Local con Docker:
```bash
# Construir la imagen
docker build -t pasadatos .

# Ejecutar el contenedor en el puerto 8080
docker run -d -p 8080:80 --name pasadatos-app pasadatos
```
Abrí tu navegador en `http://localhost:8080`.

### Ejecución Local sin Docker:
Podés servir la carpeta con cualquier servidor estático:
```bash
# Con Python 3
python3 -m http.server 8080

# Con Node.js (npx)
npx serve .
```

---

## 🤝 7. Sobre prolijo.ar

**prolijo.ar** desarrolla soluciones digitales y operativas para el ecosistema comercial y pyme de Argentina:
- Sistemas de Punto de Venta (POS) y Gestión de Stock.
- Automatizaciones de WhatsApp, atención y validación de cobros.
- Desarrollo de software y microsistemas ágiles a medida.

🌐 [Visitar prolijo.ar](https://prolijo.ar)
