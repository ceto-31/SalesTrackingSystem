#!/bin/sh
set -e

# Fix MPM at container start — remove any non-prefork MPM modules
rm -f /etc/apache2/mods-enabled/mpm_event.load \
      /etc/apache2/mods-enabled/mpm_event.conf \
      /etc/apache2/mods-enabled/mpm_worker.load \
      /etc/apache2/mods-enabled/mpm_worker.conf

# Ensure mpm_prefork is enabled
[ -f /etc/apache2/mods-enabled/mpm_prefork.load ] || \
    ln -s /etc/apache2/mods-available/mpm_prefork.load /etc/apache2/mods-enabled/mpm_prefork.load
[ -f /etc/apache2/mods-enabled/mpm_prefork.conf ] || \
    ln -s /etc/apache2/mods-available/mpm_prefork.conf /etc/apache2/mods-enabled/mpm_prefork.conf

# Railway injects $PORT — patch Apache to listen on it
PORT=${PORT:-80}
sed -i "s/Listen 80/Listen $PORT/" /etc/apache2/ports.conf
sed -i "s/:80>/:$PORT>/" /etc/apache2/sites-available/000-default.conf

exec apache2-foreground
