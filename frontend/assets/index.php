<?php
declare(strict_types=1);
use App\Config\Env;
use App\Helpers\Input;
use App\Helpers\Response;
use App\Helpers\Request;
use App\Middleware\Auth;
use App\Controllers\AuthController;
use App\Controllers\AdminController;
use App\Controllers\DataController;
use App\Controllers\PublicController;
$base=dirname(__DIR__);
spl_autoload_register(function(string $class) use ($base): void { if(!str_starts_with($class,'App\\'))return; $file=$base.'/app/'.str_replace('\\','/',substr($class,4)).'.php';if(is_file($file))require_once $file; });
Env::load($base.'/.env');
header('X-Content-Type-Options: nosniff');header('X-Frame-Options: SAMEORIGIN');header('Referrer-Policy: strict-origin-when-cross-origin');header('Permissions-Policy: geolocation=(self)');
if(Request::method()==='OPTIONS'){header('Access-Control-Allow-Origin: *');header('Access-Control-Allow-Headers: Content-Type, Authorization');header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');http_response_code(204);exit;}
set_exception_handler(function(Throwable $e): never { error_log($e->getMessage().' '.$e->getFile().':'.$e->getLine());Response::error(Env::bool('APP_DEBUG')?$e->getMessage():'Não foi possível concluir a operação. Tente novamente.',500); });
$method=Request::method();$path=Request::path();
if($path==='/api/public/escolas'&&$method==='GET')PublicController::schools();
if($path==='/api/public/cep'&&$method==='GET')PublicController::cep();
if($path==='/api/public/cadastro/decisao'&&$method==='POST')PublicController::decide();
if($path==='/api/public/cadastro'&&$method==='POST')PublicController::submit();
if($path==='/api/auth/login'&&$method==='POST')AuthController::login();
if($path==='/api/health'&&$method==='GET')Response::send(['status'=>'ok','application'=>Env::get('APP_NAME','Gestor Transporte Escolar')]);
$user=null;if(str_starts_with($path,'/api/'))$user=Auth::require($path==='/api/auth/change-password');
if($path==='/api/auth/me'&&$method==='GET')AuthController::me($user);
if($path==='/api/auth/logout'&&$method==='POST')AuthController::logout($user);
if($path==='/api/auth/change-password'&&$method==='POST')AuthController::changePassword($user);
if($path==='/api/auth/device'&&$method==='POST')AuthController::device($user);
if(preg_match('#^/api/auth/devices/(\d+)/revoke$#',$path,$m)&&$method==='POST')AuthController::revokeDevice($user,(int)$m[1]);
if($path==='/api/dashboard'&&$method==='GET'){Auth::allow($user,['ADMINISTRADOR','OPERADOR']);AdminController::dashboard($user);}
if($path==='/api/usuarios'&&$method==='GET'){Auth::allow($user,['ADMINISTRADOR','OPERADOR']);AdminController::users($user);}
if($path==='/api/usuarios'&&$method==='POST'){Auth::allow($user,['ADMINISTRADOR','OPERADOR']);AdminController::createUser($user);}
if($path==='/api/historico'&&$method==='GET'){Auth::allow($user,['ADMINISTRADOR']);AdminController::history($user);}
if(preg_match('#^/api/avisos/(\d+)/acknowledge$#',$path,$m)&&$method==='POST')AdminController::acknowledge($user,(int)$m[1]);
if($path==='/api/alunos'&&$method==='GET'){Auth::allow($user,['ADMINISTRADOR','OPERADOR','RESPONSÁVEL','MOTORISTA','MONITOR']);DataController::students($user);}
if(preg_match('#^/api/alunos/(\d+)$#',$path,$m)&&$method==='GET'){Auth::allow($user,['ADMINISTRADOR','OPERADOR','RESPONSÁVEL','MOTORISTA','MONITOR']);DataController::student($user,(int)$m[1]);}
if(preg_match('#^/api/alunos/(\d+)$#',$path,$m)&&$method==='PUT'){Auth::allow($user,['ADMINISTRADOR','OPERADOR']);DataController::updateStudent($user,(int)$m[1]);}
if($path==='/api/escolas'&&$method==='GET'){Auth::allow($user,['ADMINISTRADOR','OPERADOR','MOTORISTA','MONITOR']);DataController::schools($user);}
if($path==='/api/escolas'&&$method==='POST'){Auth::allow($user,['ADMINISTRADOR','OPERADOR']);DataController::createSchool($user);}
if(preg_match('#^/api/escolas/(\d+)$#',$path,$m)&&$method==='PUT'){Auth::allow($user,['ADMINISTRADOR','OPERADOR']);DataController::updateSchool($user,(int)$m[1]);}
if(preg_match('#^/api/escolas/(\d+)/status$#',$path,$m)&&$method==='PATCH'){Auth::allow($user,['ADMINISTRADOR','OPERADOR']);DataController::setSchoolStatus($user,(int)$m[1]);}
if($path==='/api/rotas'&&$method==='GET'){Auth::allow($user,['ADMINISTRADOR','OPERADOR','MOTORISTA','MONITOR','RESPONSÁVEL']);DataController::routes($user);}
if($path==='/api/veiculos'&&$method==='GET'){Auth::allow($user,['ADMINISTRADOR','OPERADOR','MOTORISTA']);DataController::vehicles($user);}
if($path==='/api/viagens'&&$method==='GET'){Auth::allow($user,['ADMINISTRADOR','OPERADOR','MOTORISTA','MONITOR']);DataController::trips($user);}
if($path==='/api/viagens'&&$method==='POST'){Auth::allow($user,['ADMINISTRADOR','OPERADOR']);DataController::createTrip($user);}
if($path==='/api/avisos'&&$method==='GET')DataController::notices($user);
if($path==='/api/avisos'&&$method==='POST')DataController::createNotice($user);
if($path==='/api/rotas'&&$method==='POST')DataController::createRoute($user);
if($path==='/api/veiculos'&&$method==='POST')DataController::createVehicle($user);
foreach(['embarques','desembarques','ocorrencias'] as $kind) if($path==='/api/'.$kind&&$method==='POST')DataController::operationalAction($user,$kind);
if(preg_match('#^/api/viagens/(\d+)/checklist$#',$path,$m)&&$method==='POST')DataController::checklist($user,(int)$m[1]);
if($path==='/api/manutencoes'&&$method==='POST')DataController::maintenance($user);
if($path!=='/'&&!str_starts_with($path,'/api/')){http_response_code(404);echo 'Página não encontrada';exit;}
if($path!=='/'&&str_starts_with($path,'/api/'))Response::error('Recurso não encontrado.',404);
require $base.'/public/app.html';
