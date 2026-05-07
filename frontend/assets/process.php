set_time_limit(0);
ini_set('memory_limit', '1024M');

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');
header('X-Accel-Buffering: no');

@ini_set('output_buffering', 'off');
@ini_set('zlib.output_compression', 0);
@ini_set('implicit_flush', 1);

while (ob_get_level()) {
    @ob_end_flush();
}

ob_implicit_flush(true);

$action = $_POST['action'] ?? '';

$uploadDir = __DIR__ . '/uploads/';

if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0777, true);
}

verificarDependencias();

if ($action === 'preview') {

    try {

        if (!isset($_FILES['file'])) {
            throw new Exception('Arquivo PDF não recebido.');
        }

        $temp = $_FILES['file']['tmp_name'];

        if (!file_exists($temp)) {
            throw new Exception('Arquivo temporário não encontrado.');
        }

        $prefix = $uploadDir . 'prev_' . uniqid();

        $cmd = "pdftoppm -f 1 -l 1 -jpeg -r 120 " . escapeshellarg($temp) . " " . escapeshellarg($prefix);

        shell_exec($cmd . ' 2>&1');

        $files = glob($prefix . '-*.jpg');

        if (!$files || !isset($files[0])) {
            throw new Exception('Falha ao gerar preview do PDF.');
        }

        echo json_encode([
            'success' => true,
            'image' => 'uploads/' . basename($files[0])
        ]);

    } catch (Exception $e) {

        http_response_code(500);

        echo json_encode([
            'success' => false,
}