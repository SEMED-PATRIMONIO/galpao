<?php

declare(strict_types=1);

namespace App\Routes;

use App\Helpers\ResponseHelper;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

class Router
{
    private array $routes = [];

    public function add(
        string $method,
        string $path,
        callable|array $handler,
        array $middlewares = []
    ): void {
        $this->routes[] = [
            'method' => strtoupper($method),
            'path' => $path,
            'handler' => $handler,
            'middlewares' => $middlewares,
        ];
    }

    public function dispatch(string $requestMethod, string $requestUri): void
    {
        $parsedUrl = parse_url($requestUri, PHP_URL_PATH);
        $path = rtrim((string)$parsedUrl, '/') ?: '/';
        $method = strtoupper($requestMethod);

        foreach ($this->routes as $route) {
            $pattern = preg_replace(
                '/\{([a-zA-Z0-9_]+)\}/',
                '(?P<$1>[a-zA-Z0-9_-]+)',
                $route['path']
            );

            if ($pattern === null) {
                continue;
            }

            $pattern = '#^' . $pattern . '$#';

            if (
                $route['method'] === $method &&
                preg_match($pattern, $path, $matches)
            ) {
                $params = array_filter(
                    $matches,
                    'is_string',
                    ARRAY_FILTER_USE_KEY
                );

                foreach ($route['middlewares'] as $middleware) {
                    if (is_callable($middleware)) {
                        $middleware();
                    }
                }

                $handler = $route['handler'];

                if (is_array($handler)) {
                    [$class, $action] = $handler;
                    $controller = new $class();

                    call_user_func_array(
                        [$controller, $action],
                        $params
                    );
                } else {
                    call_user_func_array($handler, $params);
                }

                return;
            }
        }

        ResponseHelper::notFound(
            'Rota não encontrada ou método HTTP não suportado.'
        );
    }
}

$router = new Router();

$router->add(
    'POST',
    '/api/auth/login',
    [\App\Controllers\AuthController::class, 'login']
);

$router->add(
    'POST',
    '/api/auth/first-access',
    [\App\Controllers\AuthController::class, 'firstAccess']
);

$router->add(
    'POST',
    '/api/auth/change-password',
    [\App\Controllers\AuthController::class, 'changePassword']
);

$router->add(
    'POST',
    '/api/auth/refresh',
    [\App\Controllers\AuthController::class, 'refresh'],
    [
        [AuthMiddleware::class, 'handle']
    ]
);

$router->add(
    'GET',
    '/api/auth/me',
    [\App\Controllers\AuthController::class, 'me'],
    [
        [AuthMiddleware::class, 'handle']
    ]
);

$router->add(
    'POST',
    '/api/auth/logout',
    [\App\Controllers\AuthController::class, 'logout'],
    [
        [AuthMiddleware::class, 'handle']
    ]
);

$router->add(
    'POST',
    '/api/auth/revoke-device',
    [\App\Controllers\AuthController::class, 'revokeDevice'],
    [
        [AuthMiddleware::class, 'handle'],
        fn() => PermissionMiddleware::authorize(['ADMINISTRADOR'])
    ]
);

$router->add(
    'POST',
    '/api/alunos',
    [\App\Controllers\AlunoController::class, 'store'],
    [
        [AuthMiddleware::class, 'handle'],
        fn() => PermissionMiddleware::authorize([
            'ADMINISTRADOR',
            'OPERADOR',
            'RESPONSÁVEL',
            'RESPONSAVEL'
        ])
    ]
);

$router->add(
    'GET',
    '/api/alunos',
    [\App\Controllers\AlunoController::class, 'index'],
    [
        [AuthMiddleware::class, 'handle'],
        fn() => PermissionMiddleware::authorize([
            'ADMINISTRADOR',
            'OPERADOR',
            'RESPONSÁVEL',
            'RESPONSAVEL'
        ])
    ]
);

$router->add(
    'GET',
    '/api/alunos/{id}',
    [\App\Controllers\AlunoController::class, 'show'],
    [
        [AuthMiddleware::class, 'handle'],
        fn() => PermissionMiddleware::authorize([
            'ADMINISTRADOR',
            'OPERADOR',
            'RESPONSÁVEL',
            'RESPONSAVEL'
        ])
    ]
);

$router->add(
    'PUT',
    '/api/alunos/{id}',
    [\App\Controllers\AlunoController::class, 'update'],
    [
        [AuthMiddleware::class, 'handle'],
        fn() => PermissionMiddleware::authorize([
            'ADMINISTRADOR',
            'OPERADOR'
        ])
    ]
);

$router->add(
    'POST',
    '/api/alunos/{id}/recadastro',
    [\App\Controllers\AlunoController::class, 'recadastro'],
    [
        [AuthMiddleware::class, 'handle'],
        fn() => PermissionMiddleware::authorize([
            'ADMINISTRADOR',
            'OPERADOR',
            'RESPONSÁVEL',
            'RESPONSAVEL'
        ])
    ]
);

$router->add(
    'POST',
    '/api/geocoding/geocode',
    [\App\Controllers\GeocodingController::class, 'geocode'],
    [
        [AuthMiddleware::class, 'handle']
    ]
);

$router->add(
    'POST',
    '/api/geocoding/distance',
    [\App\Controllers\GeocodingController::class, 'calculateDistance'],
    [
        [AuthMiddleware::class, 'handle']
    ]
);

$router->add(
    'GET',
    '/api/historico',
    [\App\Controllers\HistoricoController::class, 'index'],
    [
        [AuthMiddleware::class, 'handle'],
        fn() => PermissionMiddleware::authorize(['ADMINISTRADOR'])
    ]
);

return $router;