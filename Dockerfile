FROM php:8.5-fpm-alpine

# Install system dependencies & PHP extensions for PostgreSQL & Laravel
RUN apk add --no-cache nginx libpq-dev zip unzip git icu-dev \
    && docker-php-ext-install pdo pdo_pgsql intl

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Copy project files
COPY . .

# Install PHP dependencies
RUN composer install --no-dev --optimize-autoloader

# Set directory permissions for Laravel
RUN chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache

# Expose container port
EXPOSE 80

# Run migrations and launch server
CMD ["sh", "-c", "php artisan migrate --force && php artisan serve --host=0.0.0.0 --port=80"]