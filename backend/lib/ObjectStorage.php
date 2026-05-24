<?php
// backend/lib/ObjectStorage.php
// Product image storage — local disk (dev) or Railway S3 bucket (production).

declare(strict_types=1);

namespace App;

use Aws\S3\S3Client;

final class ObjectStorage
{
    private static ?self $instance = null;

    private ?S3Client $client = null;
    private ?string $bucket = null;
    private bool $useS3 = false;

    private function __construct()
    {
        $key    = $this->env('AWS_ACCESS_KEY_ID', 'ACCESS_KEY_ID');
        $secret = $this->env('AWS_SECRET_ACCESS_KEY', 'SECRET_ACCESS_KEY');
        $bucket = $this->env('AWS_S3_BUCKET_NAME', 'BUCKET');
        $region = $this->env('AWS_DEFAULT_REGION', 'REGION') ?: 'auto';
        $endpoint = $this->env('AWS_ENDPOINT_URL', 'ENDPOINT', 'AWS_ENDPOINT');

        if ($key === '' || $secret === '' || $bucket === '' || $endpoint === '') {
            return;
        }

        $autoload = __DIR__ . '/../vendor/autoload.php';
        if (!is_file($autoload)) {
            return;
        }
        require_once $autoload;

        $pathStyle = filter_var(
            $this->env('S3_USE_PATH_STYLE') ?: 'false',
            FILTER_VALIDATE_BOOLEAN
        );

        $this->client = new S3Client([
            'version'                 => 'latest',
            'region'                  => $region,
            'endpoint'                => $endpoint,
            'use_path_style_endpoint' => $pathStyle,
            'credentials'             => [
                'key'    => $key,
                'secret' => $secret,
            ],
        ]);
        $this->bucket = $bucket;
        $this->useS3  = true;
    }

    public static function get(): self
    {
        return self::$instance ??= new self();
    }

    public function isS3Enabled(): bool
    {
        return $this->useS3;
    }

    /**
     * Store an uploaded image. Returns DB path like uploads/products/abc.jpg
     *
     * @param bool $isUpload When true, uses move_uploaded_file for local storage.
     */
    public function storeUploadedImage(string $tmpPath, string $mime, string $ext, bool $isUpload = true): string
    {
        $filename = bin2hex(random_bytes(16)) . '.' . $ext;
        $dbPath   = 'uploads/products/' . $filename;
        $s3Key    = 'products/' . $filename;

        if ($this->useS3) {
            $body = file_get_contents($tmpPath);
            if ($body === false) {
                throw new \RuntimeException('Failed to read uploaded file');
            }
            $this->client->putObject([
                'Bucket'      => $this->bucket,
                'Key'         => $s3Key,
                'Body'        => $body,
                'ContentType' => $mime,
                'CacheControl'=> 'public, max-age=31536000',
            ]);
            return $dbPath;
        }

        $uploadDir = __DIR__ . '/../uploads/products/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }
        $dest = $uploadDir . $filename;
        $saved = $isUpload
            ? move_uploaded_file($tmpPath, $dest)
            : copy($tmpPath, $dest);
        if (!$saved) {
            throw new \RuntimeException('Failed to save image locally');
        }
        @chmod($dest, 0644);
        return $dbPath;
    }

    /**
     * Copy a committed catalog file into uploads (and S3 when enabled).
     * Used for shared product images like lomi.jpg, pancit.jpg.
     */
    public function publishCatalogFile(string $filename): string
    {
        if (!preg_match('/^[a-z][a-z0-9_-]{0,48}\.(jpg|jpeg|png|webp|gif)$/i', $filename)) {
            throw new \InvalidArgumentException('Invalid catalog filename');
        }

        $src = __DIR__ . '/../catalog/' . $filename;
        if (!is_file($src)) {
            throw new \RuntimeException("Catalog file missing: {$filename}");
        }

        $dbPath = 'uploads/products/' . $filename;
        $uploadDir = __DIR__ . '/../uploads/products/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }
        $dest = $uploadDir . $filename;
        if (!is_file($dest)) {
            if (!copy($src, $dest)) {
                throw new \RuntimeException("Failed to copy catalog file: {$filename}");
            }
            @chmod($dest, 0644);
        }

        if ($this->useS3) {
            $body = file_get_contents($dest);
            if ($body === false) {
                throw new \RuntimeException("Failed to read catalog file: {$filename}");
            }
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $mime  = finfo_file($finfo, $dest) ?: 'image/jpeg';
            finfo_close($finfo);
            $this->client->putObject([
                'Bucket'       => $this->bucket,
                'Key'          => 'products/' . $filename,
                'Body'         => $body,
                'ContentType'  => $mime,
                'CacheControl' => 'public, max-age=31536000',
            ]);
        }

        return $dbPath;
    }
    {
        if ($dbPath === null || $dbPath === '') {
            return;
        }

        if ($this->useS3 && str_starts_with($dbPath, 'uploads/products/')) {
            $key = 'products/' . basename($dbPath);
            try {
                $this->client->deleteObject([
                    'Bucket' => $this->bucket,
                    'Key'    => $key,
                ]);
            } catch (\Throwable) {
                // Non-fatal — object may already be gone.
            }
            return;
        }

        $full = __DIR__ . '/../' . ltrim($dbPath, '/');
        if (is_file($full)) {
            @unlink($full);
        }
    }

    /**
     * Stream image to browser. Returns false if not found.
     */
    public function stream(string $dbPath): bool
    {
        if (!str_starts_with($dbPath, 'uploads/products/')) {
            return false;
        }

        $filename = basename($dbPath);
        $local    = __DIR__ . '/../uploads/products/' . $filename;

        if (is_file($local)) {
            $this->sendLocalFile($local);
            return true;
        }

        if (!$this->useS3) {
            return false;
        }

        $key = 'products/' . $filename;
        try {
            $result = $this->client->getObject([
                'Bucket' => $this->bucket,
                'Key'    => $key,
            ]);
        } catch (\Throwable) {
            return false;
        }

        $type = (string)($result['ContentType'] ?? 'application/octet-stream');
        $len  = (int)($result['ContentLength'] ?? 0);
        header('Content-Type: ' . $type);
        if ($len > 0) {
            header('Content-Length: ' . $len);
        }
        header('Cache-Control: public, max-age=31536000');
        echo (string)$result['Body'];
        return true;
    }

    private function sendLocalFile(string $path): void
    {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $type  = finfo_file($finfo, $path) ?: 'application/octet-stream';
        finfo_close($finfo);

        header('Content-Type: ' . $type);
        header('Content-Length: ' . filesize($path));
        header('Cache-Control: public, max-age=31536000');
        readfile($path);
    }

    /** @param string ...$keys */
    private function env(string ...$keys): string
    {
        foreach ($keys as $key) {
            $val = getenv($key);
            if ($val !== false && $val !== '') {
                return (string)$val;
            }
            if (!empty($_ENV[$key])) {
                return (string)$_ENV[$key];
            }
        }
        return '';
    }
}
