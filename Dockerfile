# Imagen base ultraligera Nginx Alpine
FROM nginx:alpine

# Copiar configuración optimizada de Nginx con Gzip y Cache-Control
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar archivos estáticos de la aplicación pasaDatos
COPY . /usr/share/nginx/html

# Exponer puerto 80 estándar
EXPOSE 80

# Salud del contenedor (Healthcheck)
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Iniciar servidor Nginx en primer plano
CMD ["nginx", "-g", "daemon off;"]
