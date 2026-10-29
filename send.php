<?php
/*
 * Обработчик форм сайта «Ростовская эмаль».
 * Принимает заявки из формы обратной связи и оформления заказа
 * и отправляет их письмом на e-mail из data/site.json.
 *
 * Нужен хостинг с PHP и настроенной функцией mail() (Beget, Timeweb, REG.RU и др.).
 * Если письма не доходят — уточните у хостинга настройки отправки почты.
 */

// Ошибки PHP — только в журнал сервера: на странице они могут раскрыть пути к файлам
ini_set('display_errors', '0');

// Время в письме и номер заказа — по часовому поясу мастерской
date_default_timezone_set('Europe/Moscow');

// Не больше RATE_LIMIT заявок за RATE_WINDOW секунд с одного IP — защита почты от спама
const RATE_LIMIT = 5;
const RATE_WINDOW = 600;

// Форма отправлена скриптом сайта — отвечаем JSON, иначе (JavaScript отключён) — простой страницей
$isAjax = strpos($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json') !== false;

function respond($ok, $error = '', $extra = [])
{
    global $isAjax;

    if ($isAjax) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => $ok, 'error' => $error] + $extra, JSON_UNESCAPED_UNICODE);
        exit;
    }

    header('Content-Type: text/html; charset=utf-8');
    $title = $ok ? 'Спасибо! Заявка отправлена' : 'Не удалось отправить заявку';
    $text = $ok
        ? 'Мы свяжемся с вами в течение рабочего дня.'
        : 'Проверьте, что заполнены имя, телефон и отмечено согласие, или позвоните нам.';
    echo '<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">'
        . '<title>' . $title . '</title><link rel="stylesheet" href="/fonts/fonts.css"><link rel="stylesheet" href="/common.css"></head>'
        . '<body><main class="info-page" style="padding:80px 20px;text-align:center"><h1>' . $title . '</h1>'
        . '<p style="margin:20px 0 30px">' . $text . '</p><a class="btn btn-red" href="/index.html">Вернуться на сайт</a></main></body></html>';
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    respond(false, 'method');
}

// Скрытое поле-ловушка: заполняют только спам-боты
if (!empty($_POST['website'])) {
    respond(true);
}

$site = json_decode(file_get_contents(__DIR__ . '/data/site.json'), true);
$to = $site['email'] ?? '';
if (!$to) {
    respond(false, 'config');
}

function field($name, $max = 2000)
{
    // name[]=… и прочие массивы вместо строки — просто пустое значение
    $value = $_POST[$name] ?? '';
    if (!is_string($value)) {
        return '';
    }
    $value = trim($value);
    $value = str_replace(["\r", "\0"], '', $value);
    return mb_substr($value, 0, $max);
}

$name = field('name', 200);
$phone = field('phone', 50);
$email = field('email', 200);
$consent = field('consent', 10);

if ($name === '' || $phone === '' || $consent !== 'yes') {
    respond(false, 'required');
}

if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(false, 'email');
}

function formatPrice($amount)
{
    return number_format($amount, 0, '', "\u{00A0}") . "\u{00A0}₽";
}

// Заказ: от браузера берём только id и количество, а названия и цены — из каталога,
// чтобы состав и сумму в письме нельзя было подменить. Номер заказа тоже даёт сервер.
$order = null;
if (isset($_POST['items'])) {
    $catalog = json_decode(file_get_contents(__DIR__ . '/data/products.json'), true);
    $products = array_column($catalog['products'] ?? [], null, 'id');

    $items = is_string($_POST['items']) ? json_decode($_POST['items'], true) : null;
    if (!is_array($items) || !$items || count($items) > 50) {
        respond(false, 'order');
    }

    $orderLines = [];
    $total = 0;
    foreach ($items as $item) {
        $id = is_array($item) && is_string($item['id'] ?? null) ? $item['id'] : '';
        $qty = is_array($item) && is_int($item['qty'] ?? null) ? $item['qty'] : 0;
        if (!isset($products[$id]) || $qty < 1 || $qty > 99) {
            respond(false, 'order');
        }

        $sum = $products[$id]['price'] * $qty;
        $total += $sum;
        $orderLines[] = '— ' . $products[$id]['title'] . ' × ' . $qty . ' = ' . formatPrice($sum);
    }

    $order = [
        'number' => date('ymd-His') . '-' . random_int(10, 99),
        'text' => implode("\n", $orderLines) . "\nИтого: " . formatPrice($total),
    ];
}

$labels = [
    'topic' => 'Тема',
    'name' => 'Имя',
    'phone' => 'Телефон',
    'email' => 'E-mail',
    'delivery' => 'Доставка',
    'address' => 'Адрес',
    'payment' => 'Оплата',
    'comment' => 'Комментарий',
    'message' => 'Сообщение',
    'page' => 'Страница',
];

$lines = [];
if ($order) {
    $lines[] = 'Заказ № ' . $order['number'];
    $lines[] = $order['text'];
    $lines[] = '';
}
foreach ($labels as $key => $label) {
    $value = field($key, 5000);
    if ($value !== '') {
        $lines[] = $label . ': ' . $value;
    }
}
$lines[] = 'Согласие на обработку персональных данных: получено ' . date('d.m.Y H:i');

$subject = $order ? 'Новый заказ № ' . $order['number'] : (field('subject', 150) ?: 'Сообщение с сайта');
$encodedSubject = '=?UTF-8?B?' . base64_encode($subject . ' — Ростовская эмаль') . '?=';

// Домен отправителя — из настроек сайта, а не из заголовка Host, который присылает браузер
$host = preg_replace('/[^a-z0-9.\-]/i', '', parse_url($site['siteUrl'] ?? '', PHP_URL_HOST) ?: ($_SERVER['HTTP_HOST'] ?? 'localhost'));
$headers = [
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'From: =?UTF-8?B?' . base64_encode('Сайт «Ростовская эмаль»') . '?= <noreply@' . $host . '>',
];
if ($email !== '') {
    $headers[] = 'Reply-To: ' . $email;
}

// Считаем только заявки, прошедшие проверку: опечатка в форме лимит не тратит.
// Отметки времени лежат во временной папке сервера, IP хранится только в виде хэша.
function rateLimited()
{
    $dir = sys_get_temp_dir() . '/rostov-emal-send';
    if (!is_dir($dir) && !@mkdir($dir, 0700, true)) {
        return false; // нет доступа к временной папке — не мешаем отправке
    }

    $file = $dir . '/' . hash('sha256', $_SERVER['REMOTE_ADDR'] ?? '') . '.json';
    $handle = @fopen($file, 'c+');
    if (!$handle) {
        return false;
    }

    flock($handle, LOCK_EX);
    $now = time();
    $stamps = json_decode(stream_get_contents($handle), true);
    $stamps = array_values(array_filter(is_array($stamps) ? $stamps : [], function ($time) use ($now) {
        return is_int($time) && $time > $now - RATE_WINDOW;
    }));

    $limited = count($stamps) >= RATE_LIMIT;
    if (!$limited) {
        $stamps[] = $now;
        ftruncate($handle, 0);
        rewind($handle);
        fwrite($handle, json_encode($stamps));
    }
    flock($handle, LOCK_UN);
    fclose($handle);

    return $limited;
}

if (rateLimited()) {
    http_response_code(429);
    respond(false, 'rate');
}

$sent = mail($to, $encodedSubject, implode("\n", $lines), implode("\r\n", $headers));

respond($sent, $sent ? '' : 'mail', $order ? ['number' => $order['number']] : []);
