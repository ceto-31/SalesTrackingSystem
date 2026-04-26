<?php
// backend/config/db.php
// Returns a PDO singleton for the order_tracking_db database.

declare(strict_types=1);

function getDB(): PDO
{
    static $pdo = null;

    if ($pdo === null) {
        $env = static fn(string $k): string =>
            (string)(getenv($k) ?: ($_ENV[$k] ?? $_SERVER[$k] ?? ''));

        $host    = $env('DB_HOST')   ?: $env('MYSQLHOST')     ?: $env('MYSQL_HOST')     ?: 'localhost';
        $port    = $env('DB_PORT')   ?: $env('MYSQLPORT')     ?: $env('MYSQL_PORT')     ?: '3306';
        $dbname  = $env('DB_NAME')   ?: $env('MYSQLDATABASE') ?: $env('MYSQL_DATABASE') ?: 'railway';
        $user    = $env('DB_USER')   ?: $env('MYSQLUSER')     ?: $env('MYSQL_USER')     ?: 'root';
        $pass    = $env('DB_PASS')   ?: $env('MYSQLPASSWORD') ?: $env('MYSQL_PASSWORD') ?: '';

        $dsn = "mysql:host={$host};port={$port};dbname={$dbname};charset=utf8mb4";

        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    }

    return $pdo;
}
