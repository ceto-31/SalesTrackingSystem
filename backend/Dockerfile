FROM php:8.2-apache

# Install PDO MySQL extension
RUN docker-php-ext-install pdo pdo_mysql

# Bulletproof MPM fix: remove ALL MPM symlinks then re-add ONLY mpm_prefork.
# a2dismod is unreliable at build time because Apache is not running.
RUN cd /etc/apache2/mods-enabled \
    && rm -f mpm_event.load mpm_event.conf \
             mpm_worker.load mpm_worker.conf \
             mpm_prefork.load mpm_prefork.conf \
    && ln -s ../mods-available/mpm_prefork.load mpm_prefork.load \
    && ln -s ../mods-available/mpm_prefork.conf mpm_prefork.conf \
    && a2enmod rewrite headers

# Build context is always repo root in Railway — paths must start with backend/
COPY backend/apache.conf /etc/apache2/sites-available/000-default.conf
COPY backend/ /var/www/html/

# Ensure uploads directory exists with correct ownership
RUN mkdir -p /var/www/html/uploads/products \
    && chown -R www-data:www-data /var/www/html/uploads \
    && chmod -R 755 /var/www/html/uploads

EXPOSE 80

# Railway injects $PORT — patch Apache's port config at container start
CMD sed -i "s/Listen 80/Listen ${PORT:-80}/" /etc/apache2/ports.conf \
    && sed -i "s/*:80/*:${PORT:-80}/" /etc/apache2/sites-available/000-default.conf \
    && apache2-foreground
