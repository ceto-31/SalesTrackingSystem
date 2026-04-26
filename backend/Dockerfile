FROM php:8.2-apache

# Install PDO MySQL extension and enable required Apache modules
RUN docker-php-ext-install pdo pdo_mysql \
    && a2enmod rewrite headers

# Build context is always repo root in Railway — paths must start with backend/
COPY backend/apache.conf /etc/apache2/sites-available/000-default.conf
COPY backend/entrypoint.sh /entrypoint.sh
COPY backend/ /var/www/html/

# Ensure uploads directory exists with correct ownership
RUN chmod +x /entrypoint.sh \
    && mkdir -p /var/www/html/uploads/products \
    && chown -R www-data:www-data /var/www/html/uploads \
    && chmod -R 755 /var/www/html/uploads

EXPOSE 80

# entrypoint.sh fixes MPM conflict and patches PORT at container start
ENTRYPOINT ["/entrypoint.sh"]
