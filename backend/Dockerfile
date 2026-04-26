FROM php:8.2-apache

# Install PDO MySQL extension
RUN docker-php-ext-install pdo pdo_mysql

# Remove mpm_event/mpm_worker symlinks directly — a2dismod is unreliable during
# Docker build because Apache is not running. php:8.2-apache already includes
# mpm_prefork for mod_php; we only need the conflicting MPM links gone.
RUN rm -f /etc/apache2/mods-enabled/mpm_event.conf \
          /etc/apache2/mods-enabled/mpm_event.load \
          /etc/apache2/mods-enabled/mpm_worker.conf \
          /etc/apache2/mods-enabled/mpm_worker.load \
    && a2enmod rewrite headers

# Replace default Apache vhost with our config (enables AllowOverride + PassEnv)
COPY backend/apache.conf /etc/apache2/sites-available/000-default.conf

# Copy all backend files into the web root
COPY backend/ /var/www/html/

# Ensure uploads directory exists with correct ownership
RUN mkdir -p /var/www/html/uploads/products \
    && chown -R www-data:www-data /var/www/html/uploads \
    && chmod -R 755 /var/www/html/uploads

EXPOSE 80

# Railway injects a $PORT env var — rewrite Apache's port config at container start
CMD sed -i "s/Listen 80/Listen ${PORT:-80}/" /etc/apache2/ports.conf \
    && sed -i "s/*:80/*:${PORT:-80}/" /etc/apache2/sites-available/000-default.conf \
    && apache2-foreground
