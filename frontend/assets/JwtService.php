<?php

declare(strict_types=1);

namespace App\Services;

use App\Config\Env;

class JwtService
{
    private static function getSecretKey(): string
    {
        $secret = Env::getString('JWT_SECRET', '');

        if ($secret === '') {
            throw new \RuntimeException('JWT_SECRET não configurado.');
        }

        return $secret;
    }

    public static function generateToken(array $payload, int $ttlSeconds = 28800): string
    {
        $header = [
            'typ' => 'JWT',
            'alg' => 'HS256'
        ];

        $issuedAt = time();

        $payload['iat'] = $payload['iat'] ?? $issuedAt;
        $payload['exp'] = $payload['exp'] ?? ($issuedAt + $ttlSeconds);

        $base64UrlHeader = self::base64UrlEncode(
            (string)json_encode($header, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
        );

        $base64UrlPayload = self::base64UrlEncode(
            (string)json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
        );

        $signature = hash_hmac(
            'sha256',
            "{$base64UrlHeader}.{$base64UrlPayload}",
            self::getSecretKey(),
            true
        );

        $base64UrlSignature = self::base64UrlEncode($signature);

        return "{$base64UrlHeader}.{$base64UrlPayload}.{$base64UrlSignature}";
    }

    public static function decodeToken(string $token): ?array
    {
        $parts = explode('.', $token);

        if (count($parts) !== 3) {
            return null;
        }

        [$base64UrlHeader, $base64UrlPayload, $base64UrlSignature] = $parts;

        $signature = self::base64UrlDecode($base64UrlSignature);

        $expectedSignature = hash_hmac(
            'sha256',
            "{$base64UrlHeader}.{$base64UrlPayload}",
            self::getSecretKey(),
            true
        );

        if (!hash_equals($signature, $expectedSignature)) {
            return null;
        }

        $payloadJson = self::base64UrlDecode($base64UrlPayload);
        $payload = json_decode($payloadJson, true);

        if (!is_array($payload)) {
            return null;
        }

        if (!isset($payload['sub']) || (int)$payload['sub'] <= 0) {
            return null;
        }

        if (isset($payload['exp']) && (int)$payload['exp'] < time()) {
            return null;
        }

        return $payload;
    }

    public static function validateToken(string $token): bool
    {
        try {
            return self::decodeToken($token) !== null;
        } catch (\Throwable) {
            return false;
        }
    }

    private static function base64UrlEncode(string $data): string
    {
        return rtrim(
            strtr(base64_encode($data), '+/', '-_'),
            '='
        );
    }

    private static function base64UrlDecode(string $data): string
    {
        $data = strtr($data, '-_', '+/');

        $remainder = strlen($data) % 4;

        if ($remainder > 0) {
            $data .= str_repeat('=', 4 - $remainder);
        }

        $decoded = base64_decode($data, true);

        return $decoded === false ? '' : $decoded;
    }
}