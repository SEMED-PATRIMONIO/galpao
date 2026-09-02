<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Database\Connection;
use App\Helpers\ResponseHelper;
use App\Services\JwtService;
use PDO;
use Throwable;

class AuthMiddleware
{
    private static ?array $currentUser = null;

    public static function handle(): array
    {
        if (self::$currentUser !== null) {
            return self::$currentUser;
        }

        $token = self::getBearerToken();

        if (empty($token)) {
            ResponseHelper::error('Token de autenticação não fornecido no cabeçalho Authorization.', 401);
            exit;
        }

        $payload = JwtService::decodeToken($token);

        if (!$payload || empty($payload['sub'])) {
            ResponseHelper::error('Token de acesso inválido ou expirado. Faça login novamente.', 401);
            exit;
        }

        $userId = (int)$payload['sub'];

        try {
            $db = Connection::getConnection();

            $stmt = $db->prepare("
                SELECT
                    u.id,
                    u.nome,
                    u.email,
                    u.cpf,
                    u.status,
                    u.perfil_id,
                    p.nome AS perfil_nome,
                    p.slug AS perfil_slug,
                    p.nivel_acesso
                FROM usuarios u
                INNER JOIN perfis p ON u.perfil_id = p.id
                WHERE u.id = :id
                AND u.status = 'ATIVO'
                LIMIT 1
            ");

            $stmt->execute([
                ':id' => $userId
            ]);

            $user = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$user) {
                ResponseHelper::error('Usuário associado a este token está inativo ou foi removido.', 401);
                exit;
            }

            self::$currentUser = $user;

            return self::$currentUser;

        } catch (Throwable $e) {
            error_log("AuthMiddleware Error: " . $e->getMessage());
            ResponseHelper::error('Erro ao processar autenticação.', 500);
            exit;
        }
    }

    public static function authenticate(): array
    {
        return self::handle();
    }

    public static function getAuthenticatedUser(): ?array
    {
        if (self::$currentUser === null) {
            $token = self::getBearerToken();

            if ($token) {
                $payload = JwtService::decodeToken($token);

                if ($payload && !empty($payload['sub'])) {
                    try {
                        return self::handle();
                    } catch (Throwable) {
                        return null;
                    }
                }
            }
        }

        return self::$currentUser;
    }

    public static function getBearerToken(): ?string
    {
        $headers = null;

        if (isset($_SERVER['Authorization'])) {
            $headers = trim((string)$_SERVER['Authorization']);
        } elseif (isset($_SERVER['HTTP_AUTHORIZATION'])) {
            $headers = trim((string)$_SERVER['HTTP_AUTHORIZATION']);
        } elseif (function_exists('apache_request_headers')) {
            $requestHeaders = apache_request_headers();

            if (is_array($requestHeaders)) {
                $normalizedHeaders = [];

                foreach ($requestHeaders as $key => $value) {
                    $normalizedHeaders[strtolower((string)$key)] = $value;
                }

                if (isset($normalizedHeaders['authorization'])) {
                    $headers = trim((string)$normalizedHeaders['authorization']);
                }
            }
        }

        if (!empty($headers) && preg_match('/Bearer\s+(\S+)/i', $headers, $matches)) {
            return $matches[1];
        }

        return null;
    }

    public static function checkStudentOwnership(int $alunoId): bool
    {
        $user = self::getAuthenticatedUser();

        if (!$user) {
            return false;
        }

        $role = mb_strtoupper((string)($user['perfil_slug'] ?? ''), 'UTF-8');

        if (in_array($role, ['ADMIN', 'ADMINISTRADOR', 'GESTOR', 'OPERADOR'], true)) {
            return true;
        }

        try {
            $db = Connection::getConnection();

            $stmt = $db->prepare("
                SELECT id
                FROM alunos
                WHERE id = :aluno_id
                AND (
                    responsavel_cpf = :cpf
                    OR responsavel_email = :email
                )
                LIMIT 1
            ");

            $stmt->execute([
                ':aluno_id' => $alunoId,
                ':cpf' => $user['cpf'],
                ':email' => $user['email']
            ]);

            return (bool)$stmt->fetchColumn();

        } catch (Throwable) {
            return false;
        }
    }
}