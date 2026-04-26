FROM php:8.2-apache

# Install PDO MySQL extension
RUN docker-php-ext-install pdo pdo_mysql

# Enable Apache modules required for .htaccess rewrites and CORS headers
RUN a2enmod rewrite headers

# Replace default Apache vhost with our config (enables AllowOverride + PassEnv)
COPY backend/apache.conf /etc/apache2/sites-available/000-default.conf

# Copy all backend files into the web root
COPY backend/ /var/www/html/

# Ensure uploads directory exists with correct ownership
RUN mkdir -p /var/www/html/uploads/products \
    && chown -R www-data:www-data /var/www/html/uploads \
    && chmod -R 755 /var/www/html/uploads

EXPOSE 80
