<?php
    ini_set('display_errors', 1);
    ini_set('display_startup_errors', 1);
    error_reporting(E_ALL);
    $crop->cropImage(
        $c['w'] * $scaleX,
        $c['h'] * $scaleY,
        $c['x'] * $scaleX,
        $c['y'] * $scaleY
    );

    $crop->normalizeImage();

    $crop->contrastStretchImage(0.1, 0.1);

    $tmp = __DIR__ . '/uploads/n_' . uniqid() . '.jpg';

    $crop->writeImage($tmp);

    $cmd = 'tesseract ' .
        escapeshellarg($tmp) .
        ' stdout -l por --psm 7 2>/dev/null';

    $txt = shell_exec($cmd);

    @unlink($tmp);

    $crop->destroy();

    $txt = trim($txt);

    $txt = preg_replace('/[^\p{L}\p{N}\s]/u', '', $txt);

    return $txt ?: 'Não identificado';
}

function compararResultados($gab, $alu)
{
    $ac = 0;
    $br = 0;
    $rs = 0;
    $det = [];

    foreach ($gab as $q => $correta) {

        $r = $alu[$q] ?? 'BRANCO';

        if ($r === $correta) {
            $ac++;
        }
        elseif ($r === 'BRANCO') {
            $br++;
        }
        elseif (strpos($r, 'RASURA') !== false) {
            $rs++;
            $det[] = 'Q' . $q . ':' . $r;
        }
    }

    return [
        'acertos' => $ac,
        'brancos' => $br,
        'rasuras' => $rs,
        'detalhes' => implode('|', $det)
    ];
}

function enviarStatus($at, $to, $al, $co = false, $re = [])
{
    echo json_encode([
        'atual' => $at,
        'total' => $to,
        'aluno' => $al,
        'concluido' => $co,
        'resultados' => $re
    ]) . "\n";

    @ob_flush();
    @flush();
}