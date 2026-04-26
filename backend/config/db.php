<?php
// backend/config/db.php
// Returns a PDO singleton for the order_tracking_db database.

declare(strict_types=1);

function getDB(): PDO
{
    static $pdo = null;

    if ($pdo === null) {
        $host    = $_ENV['DB_HOST']       ?? $_ENV['MYSQLHOST']     ?? 'localhost';
        $port    = $_ENV['DB_PORT']       ?? $_ENV['MYSQLPORT']     ?? '3306';
        $dbname  = $_ENV['DB_NAME']       ?? $_ENV['MYSQLDATABASE'] ?? 'order_tracking_db';
        $user    = $_ENV['DB_USER']       ?? $_ENV['MYSQLUSER']     ?? 'root';
        $pass    = $_ENV['DB_PASS']       ?? $_ENV['MYSQLPASSWORD'] ?? '';

        $dsn = "mysql:host={$host};port={$port};dbname={$dbname};charset=utf8mb4";

        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    }

    return $pdo;
}
