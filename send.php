<?php
/*
 * Обработчик форм сайта «Ростовская эмаль».
 * Принимает заявки из формы обратной связи и оформления заказа
 * и отправляет их письмом на e-mail из data/site.json.
 *
 * Нужен хостинг с PHP и настроенной функцией mail() (Beget, Timeweb, REG.RU и др.).
 * Если письма не доходят — уточните у хостинга настройки отправки почты.
 */

// Форма отправлена скриптом сайта — отвечаем JSON, иначе (JavaScript отключён) — простой страницей
$isAjax = strpos($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json') !== false;

function respond($ok, $error = '')
{
    global $isAjax;

    if ($isAjax) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => $ok, 'error' => $error], JSON_UNESCAPED_UNICODE);
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
    $value = trim((string)($_POST[$name] ?? ''));
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
    'details' => 'Состав заказа',
    'page' => 'Страница',
];

$lines = [];
foreach ($labels as $key => $label) {
    $value = field($key, 5000);
    if ($value !== '') {
        $lines[] = $label . ': ' . $value;
    }
}
$lines[] = 'Согласие на обработку персональных данных: получено ' . date('d.m.Y H:i');

$subject = field('subject', 150) ?: 'Сообщение с сайта';
$encodedSubject = '=?UTF-8?B?' . base64_encode($subject . ' — Ростовская эмаль') . '?=';

$host = preg_replace('/[^a-z0-9.\-]/i', '', $_SERVER['HTTP_HOST'] ?? 'localhost');
$headers = [
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'From: =?UTF-8?B?' . base64_encode('Сайт «Ростовская эмаль»') . '?= <noreply@' . $host . '>',
];
if ($email !== '') {
    $headers[] = 'Reply-To: ' . $email;
}

$sent = mail($to, $encodedSubject, implode("\n", $lines), implode("\r\n", $headers));

respond($sent, $sent ? '' : 'mail');
