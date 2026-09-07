<?php
declare(strict_types=1);
namespace App\Controllers;
use App\Database\Connection;
use App\Helpers\Input;
use App\Helpers\Response;
use App\Helpers\Request;
use App\Services\AuditService;
use App\Services\CpfService;
use App\Services\GeocodingService;
use App\Services\MailService;
use App\Services\ViaCepService;
use App\Validators\AlunoValidator;
final class PublicController {
    public static function schools(): never {
        $rows=Connection::get()->query('SELECT id,nome,logradouro,numero,bairro,cep,latitude,longitude FROM escolas WHERE ativo=true ORDER BY nome')->fetchAll();
        Response::send($rows);
    }
    public static function cep(): never {
        $cep=preg_replace('/\D+/','',(string)($_GET['cep']??''))??'';
        $data=ViaCepService::lookup($cep);
        if(!$data)Response::error('CEP não localizado. Preencha o endereço manualmente.',404);
        Response::send($data);
    }
    public static function decide(): never {
        $input=Input::json();
        $cpf=CpfService::clean((string)($input['cpf']??''));
        if(!CpfService::valid($cpf))Response::error('CPF inválido.',422);
        $year=self::year();
        $db=Connection::get();
        $duplicate=$db->prepare('SELECT 1 FROM protocolos p INNER JOIN alunos a ON a.id=p.aluno_id WHERE a.cpf=:cpf AND p.ano_exercicio=:year LIMIT 1');
        $duplicate->execute(['cpf'=>$cpf,'year'=>$year]);
        if($duplicate->fetchColumn())Response::send(['tipo'=>'JA_CADASTRADO','ano_letivo'=>$year]);
        $stmt=$db->prepare("SELECT a.id,a.nome,a.data_nascimento,a.pne,a.tipo_pne_cid,a.endereco_id,ae.escola_id,ae.turno,ae.autorizacao_desembarque,r.nome AS responsavel_nome,r.telefone,e.cep FROM alunos a LEFT JOIN LATERAL (SELECT x.escola_id,x.turno,x.autorizacao_desembarque,x.ano_letivo FROM aluno_escola x WHERE x.aluno_id=a.id ORDER BY x.ano_letivo DESC,x.id DESC LIMIT 1) ae ON true LEFT JOIN LATERAL (SELECT ar.responsavel_id FROM aluno_responsavel ar WHERE ar.aluno_id=a.id AND ar.principal=true ORDER BY ar.id DESC LIMIT 1) ar ON true LEFT JOIN responsaveis r ON r.id=ar.responsavel_id LEFT JOIN enderecos e ON e.id=a.endereco_id WHERE a.cpf=:cpf LIMIT 1");
        $stmt->execute(['cpf'=>$cpf]);
        $row=$stmt->fetch();
        if(!$row)Response::send(['tipo'=>'NOVO_CADASTRO','ano_letivo'=>$year]);
        Response::send([
            'tipo'=>'RECADASTRAMENTO',
            'ano_letivo'=>$year,
            'data'=>[
                'nomeAluno'=>$row['nome']??'',
                'escola_id'=>$row['escola_id']??'',
                'turno'=>self::turno((string)($row['turno']??'')),
                'telefone'=>$row['telefone']??'',
                'descerOnibus'=>$row['autorizacao_desembarque']??'',
                'pcd'=>self::boolValue($row['pne']??false)?'SIM':'NÃO',
                'deficiencia'=>$row['tipo_pne_cid']??'',
                'nascimento'=>$row['data_nascimento']??'',
                'nomeResp'=>$row['responsavel_nome']??'',
                'cep'=>$row['cep']??''
            ]
        ]);
    }
    public static function submit(): never {
        $data=AlunoValidator::validate(Input::json());
        $year=self::year();
        $db=Connection::get();
        $db->beginTransaction();
        try {
            $duplicate=$db->prepare('SELECT p.id FROM protocolos p INNER JOIN alunos a ON a.id=p.aluno_id WHERE a.cpf=:cpf AND p.ano_exercicio=:year FOR UPDATE');
            $duplicate->execute(['cpf'=>$data['cpf'],'year'=>$year]);
            if($duplicate->fetchColumn()){
                $db->rollBack();
                Response::error('CPF JÁ CADASTRADO!',409);
            }
            $old=$db->prepare('SELECT id FROM alunos WHERE cpf=:cpf FOR UPDATE');
            $old->execute(['cpf'=>$data['cpf']]);
            $oldId=$old->fetchColumn();
            $type=$oldId?'RECADASTRAMENTO':'NOVO_CADASTRO';
            $alunoId=$oldId?(int)$oldId:null;
            $geo=GeocodingService::address($data['logradouro'],$data['numero'],$data['cidade'],$data['uf'],$data['cep']);
            if($alunoId){
                $u=$db->prepare("UPDATE alunos SET nome=:nome,data_nascimento=:data,pne=:pne,tipo_pne_cid=:def,atualizado_em=NOW(),status='EM_ANALISE' WHERE id=:id");
                $u->execute(['nome'=>$data['nome'],'data'=>$data['data_nascimento'],'pne'=>$data['pne'],'def'=>$data['deficiencia'],'id'=>$alunoId]);
            }else{
                $u=$db->prepare("INSERT INTO alunos (nome,cpf,data_nascimento,pne,tipo_pne_cid,status) VALUES (:nome,:cpf,:data,:pne,:def,'EM_ANALISE') RETURNING id");
                $u->execute(['nome'=>$data['nome'],'cpf'=>$data['cpf'],'data'=>$data['data_nascimento'],'pne'=>$data['pne'],'def'=>$data['deficiencia']]);
                $alunoId=(int)$u->fetchColumn();
            }
            $address=$db->prepare('INSERT INTO enderecos (logradouro,numero,bairro,cidade,uf,cep,latitude,longitude) VALUES (:logradouro,:numero,:bairro,:cidade,:uf,:cep,:lat,:lon) RETURNING id');
            $address->execute(['logradouro'=>$data['logradouro'],'numero'=>$data['numero'],'bairro'=>$data['bairro'],'cidade'=>$data['cidade'],'uf'=>$data['uf'],'cep'=>$data['cep'],'lat'=>$geo['latitude']??null,'lon'=>$geo['longitude']??null]);
            $addressId=(int)$address->fetchColumn();
            $db->prepare('UPDATE alunos SET endereco_id=:eid WHERE id=:id')->execute(['eid'=>$addressId,'id'=>$alunoId]);
            $responsavelId=null;
            if($oldId){
                $r=$db->prepare('SELECT responsavel_id FROM aluno_responsavel WHERE aluno_id=:id AND principal=true ORDER BY id DESC LIMIT 1');
                $r->execute(['id'=>$alunoId]);
                $responsavelId=$r->fetchColumn()?:null;
            }
            if(!$responsavelId){
                $r=$db->prepare('INSERT INTO responsaveis (nome,cpf,email,telefone) VALUES (:nome,NULL,:email,:telefone) RETURNING id');
                $r->execute(['nome'=>$data['responsavel_nome'],'email'=>$data['email'],'telefone'=>$data['telefone']]);
                $responsavelId=(int)$r->fetchColumn();
            }else{
                $responsavelId=(int)$responsavelId;
                $db->prepare('UPDATE responsaveis SET nome=:nome,email=:email,telefone=:telefone,atualizado_em=NOW() WHERE id=:id')->execute(['nome'=>$data['responsavel_nome'],'email'=>$data['email'],'telefone'=>$data['telefone'],'id'=>$responsavelId]);
            }
            $db->prepare('DELETE FROM aluno_responsavel WHERE aluno_id=:id AND principal=true')->execute(['id'=>$alunoId]);
            $db->prepare("INSERT INTO aluno_responsavel (aluno_id,responsavel_id,grau_parentesco,principal) VALUES (:aid,:rid,'RESPONSÁVEL',true)")->execute(['aid'=>$alunoId,'rid'=>$responsavelId]);
            $school=$db->prepare('SELECT id,nome,latitude,longitude FROM escolas WHERE id=:id AND ativo=true');
            $school->execute(['id'=>(int)$data['escola_id']]);
            $schoolRow=$school->fetch();
            if(!$schoolRow)throw new \RuntimeException('Escola não encontrada.');
            $distance=null;
            if($geo&&$schoolRow['latitude']!==null&&$schoolRow['longitude']!==null)$distance=GeocodingService::distance((float)$geo['latitude'],(float)$geo['longitude'],(float)$schoolRow['latitude'],(float)$schoolRow['longitude']);
            $ae=$db->prepare('INSERT INTO aluno_escola (aluno_id,escola_id,ano_letivo,serie_ano,turno,autorizacao_desembarque,distancia_calculada_m) VALUES (:aid,:eid,:year,NULL,:turno,:autorizacao,:dist) ON CONFLICT (aluno_id,ano_letivo) DO UPDATE SET escola_id=EXCLUDED.escola_id,turno=EXCLUDED.turno,autorizacao_desembarque=EXCLUDED.autorizacao_desembarque,distancia_calculada_m=EXCLUDED.distancia_calculada_m');
            $ae->execute(['aid'=>$alunoId,'eid'=>(int)$data['escola_id'],'year'=>$year,'turno'=>$data['turno'],'autorizacao'=>$data['autorizacao_desembarque'],'dist'=>$distance]);
            $code='TE'.$year.'-'.str_pad((string)$alunoId,6,'0',STR_PAD_LEFT);
            $p=$db->prepare("INSERT INTO protocolos (codigo_protocolo,aluno_id,tipo_solicitacao,status,ano_exercicio,observacoes) VALUES (:code,:aid,:type,'EM_ANALISE',:year,:obs) RETURNING id");
            $p->execute(['code'=>$code,'aid'=>$alunoId,'type'=>$type,'year'=>$year,'obs'=>'Solicitação recebida pelo formulário público.']);
            $protocolId=(int)$p->fetchColumn();
            $db->prepare('INSERT INTO acessos_publicos (protocolo_id,cpf,ip_endereco,user_agent) VALUES (:pid,:cpf,:ip,:ua)')->execute(['pid'=>$protocolId,'cpf'=>$data['cpf'],'ip'=>Request::ip(),'ua'=>Request::userAgent()]);
            $db->commit();
            $data['escola_nome']=$schoolRow['nome'];
            $data['latitude']=$geo['latitude']??null;
            $data['longitude']=$geo['longitude']??null;
            $data['distancia_km']=$distance!==null?number_format($distance/1000,2,'.',''):'';
            $data['endereco_completo']=$data['logradouro'].', '.$data['numero'].', '.$data['cidade'].', '.$data['uf'].', '.$data['cep'];
            $label=$type==='RECADASTRAMENTO'?'Recadastramento':'Inclusão';
            $mail=MailService::send($data['email'],'Cópia: Ficha de '.$label.' - CPF '.CpfService::format($data['cpf']),self::emailBody($data,$label));
            $db->prepare('INSERT INTO tentativas_email (protocolo_id,email,data_hora_envio,resultado,erro) VALUES (:pid,:email,:sent,:result,:error)')->execute(['pid'=>$protocolId,'email'=>$data['email'],'sent'=>$mail['success']?date('Y-m-d H:i:s'):null,'result'=>$mail['success']?'ENVIADO':'FALHOU','error'=>$mail['error']]);
            AuditService::record(null,null,'ENVIO_FORMULARIO','CADASTRO_PUBLICO','protocolos',$protocolId,'Formulário público recebido.',null,['tipo'=>$type,'cpf'=>CpfService::format($data['cpf']),'protocolo'=>$code]);
            Response::send(['protocolo'=>$code,'tipo'=>$type,'email_enviado'=>$mail['success']],201);
        }catch(\Throwable $e){
            if($db->inTransaction())$db->rollBack();
            throw $e;
        }
    }
    private static function year(): int {
        $stmt=Connection::get()->query('SELECT ano FROM anos_letivos WHERE ativo=true ORDER BY ano DESC LIMIT 1');
        $year=$stmt->fetchColumn();
        if(!$year)throw new \RuntimeException('Não existe ano letivo ativo configurado.');
        return (int)$year;
    }
    private static function boolValue(mixed $value): bool {
        if(is_bool($value))return $value;
        return in_array(strtolower((string)$value),['t','true','1','sim'],true);
    }
    private static function turno(string $value): string {
        $normalized=mb_strtoupper(trim($value),'UTF-8');
        if($normalized==='MANHA')return 'MANHÃ';
        return in_array($normalized,['MANHÃ','TARDE'],true)?$normalized:'';
    }
    private static function emailBody(array $d,string $label): string {
        $lines=[];
        $lines[]='Cópia das respostas do formulário de Inclusão / Recadastramento';
        $lines[]='';
        $lines[]='Data/hora do envio: '.date('d/m/Y H:i:s');
        $lines[]='';
        $lines[]='--- DADOS PRINCIPAIS ---';
        $lines[]='CPF: '.CpfService::format($d['cpf']);
        $lines[]='Nome do aluno: '.$d['nome'];
        $lines[]='Escola: '.($d['escola_nome']??'');
        $lines[]='Turno: '.$d['turno'];
        $lines[]='Telefone: '.$d['telefone'];
        $lines[]='Autorização ao descer do ônibus: '.$d['autorizacao_desembarque'];
        $lines[]='PCD: '.($d['pne']?'SIM':'NÃO');
        $lines[]='Deficiência: '.($d['deficiencia']??'');
        $lines[]='Nascimento: '.$d['data_nascimento'];
        $lines[]='Responsável: '.$d['responsavel_nome'];
        $lines[]='';
        $lines[]='--- ENDEREÇO ---';
        $lines[]='CEP: '.$d['cep'];
        $lines[]='Endereço: '.$d['logradouro'];
        $lines[]='Número: '.$d['numero'];
        $lines[]='Bairro: '.$d['bairro'];
        $lines[]='Cidade: '.$d['cidade'];
        $lines[]='Estado: '.$d['uf'];
        $lines[]='Endereço completo: '.($d['endereco_completo']??'');
        $lines[]='';
        $lines[]='--- GEO / DISTÂNCIAS ---';
        $lines[]='Latitude: '.($d['latitude']??'');
        $lines[]='Longitude: '.($d['longitude']??'');
        $lines[]='Distância (reta): '.($d['distancia_km']??'');
        $lines[]='Distância a pé (rota): ';
        $lines[]='';
        $lines[]='E-mail informado: '.$d['email'];
        $lines[]='';
        $lines[]='Se precisar de suporte, responda ao remetente ou entre em contato com o Departamento de Transporte Escolar.';
        return implode("\n",$lines);
    }
}
