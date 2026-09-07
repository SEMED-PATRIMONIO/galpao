<?php
declare(strict_types=1);
namespace App\Validators;
use App\Helpers\Response;
use App\Services\CpfService;
final class AlunoValidator {
    public static function validate(array $d): array {
        $required=['cpf','nome','responsavel_nome','escola_id','turno','telefone','autorizacao_desembarque','pne','data_nascimento','cep','logradouro','numero','bairro','cidade','uf','email'];
        foreach($required as $key) if(!array_key_exists($key,$d) || trim((string)$d[$key])==='') Response::error('Preencha todos os campos obrigatórios.',422,['campo'=>$key]);
        $cpf=CpfService::clean((string)$d['cpf']);
        if(!CpfService::valid($cpf))Response::error('CPF inválido.',422);
        foreach(['nome','responsavel_nome'] as $field){
            $value=self::normalizeName((string)$d[$field]);
            if($value===''||!preg_match('/^[A-Z]+(?:\s[A-Z]+)*$/',$value))Response::error($field==='nome'?'Nome do aluno inválido.':'Nome do responsável inválido.',422);
            $d[$field]=$value;
        }
        $turno=mb_strtoupper(trim((string)$d['turno']),'UTF-8');
        if(!in_array($turno,['MANHÃ','TARDE'],true))Response::error('Turno é obrigatório.',422);
        $phone=preg_replace('/\D+/','',(string)$d['telefone'])??'';
        if(strlen($phone)===9)$phone='21'.$phone;
        if(!preg_match('/^219\d{8}$/',$phone))Response::error('Telefone deve começar com 9.',422);
        $autorizacao=trim((string)$d['autorizacao_desembarque']);
        if(!in_array($autorizacao,['Autorizo ir sozinho','Ir somente com Responsável'],true))Response::error('Selecione uma opção para o desembarque.',422);
        $pneRaw=mb_strtoupper(trim((string)$d['pne']),'UTF-8');
        if(!in_array($pneRaw,['SIM','NÃO'],true))Response::error('PCD é obrigatório.',422);
        $pne=$pneRaw==='SIM';
        $deficiencia=trim((string)($d['deficiencia']??''));
        if($pne&&$deficiencia==='')Response::error('Informe a condição que o caracteriza como portador de necessidade especial.',422);
        $cep=preg_replace('/\D+/','',(string)$d['cep'])??'';
        if(strlen($cep)!==8)Response::error('Informe um CEP válido (8 dígitos).',422);
        $numero=preg_replace('/\D+/','',(string)$d['numero'])??'';
        if($numero==='')Response::error('O número do endereço deve conter somente números.',422);
        if(!filter_var((string)$d['email'],FILTER_VALIDATE_EMAIL))Response::error('E-mail com formato inválido.',422);
        $date=\DateTimeImmutable::createFromFormat('Y-m-d',(string)$d['data_nascimento']);
        if(!$date||$date->format('Y-m-d')!==(string)$d['data_nascimento'])Response::error('Informe uma data de nascimento válida.',422);
        $min=new \DateTimeImmutable('2016-01-01');
        $max=new \DateTimeImmutable('2022-12-31');
        if($date<$min)Response::error('Procure a Secretaria da Escola para cadastrar RioCard',422);
        if($date>$max)Response::error('Somente nascidos entre 2016 e 2022 inclusive.',422);
        $d['cpf']=$cpf;
        $d['telefone']=$phone;
        $d['cep']=$cep;
        $d['numero']=$numero;
        $d['pne']=$pne;
        $d['deficiencia']=$pne?self::normalizeText($deficiencia):null;
        $d['turno']=$turno;
        $d['autorizacao_desembarque']=$autorizacao;
        $d['logradouro']=self::normalizeText((string)$d['logradouro']);
        $d['bairro']=self::normalizeText((string)$d['bairro']);
        $d['cidade']=self::normalizeText((string)$d['cidade']);
        $d['uf']=mb_strtoupper(trim((string)$d['uf']),'UTF-8');
        $d['email']=mb_strtolower(trim((string)$d['email']),'UTF-8');
        return $d;
    }
    private static function normalizeName(string $value): string {
        $value=trim($value);
        $converted=iconv('UTF-8','ASCII//TRANSLIT//IGNORE',$value);
        $value=$converted!==false?$converted:$value;
        $value=strtoupper($value);
        $value=preg_replace('/[^A-Z\s]/','',$value)??'';
        return trim(preg_replace('/\s+/',' ',$value)??'');
    }
    private static function normalizeText(string $value): string {
        $value=ltrim($value);
        $converted=iconv('UTF-8','ASCII//TRANSLIT//IGNORE',$value);
        $value=$converted!==false?$converted:$value;
        return strtoupper($value);
    }
}
