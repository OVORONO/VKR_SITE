/*
 * Тесты send.php на PHP 8.3, собранном в WebAssembly: ставить PHP не нужно.
 * mail() в тестовой копии заменён на запись письма в файл, остальной код — как в проекте.
 *
 * Запуск — в отдельной папке, чтобы не добавлять зависимости в сайт:
 *   npm install @php-wasm/node@3.1.57 @php-wasm/universal@3.1.57
 *   скопируйте туда этот файл и выполните: node send-test.mjs путь/к/сайту
 */
import fs from 'node:fs';
import { loadNodeRuntime } from '@php-wasm/node';
import { PHP } from '@php-wasm/universal';

const SITE = process.argv[2] || '.';
const php = new PHP(await loadNodeRuntime('8.3', { emscriptenOptions: { processId: 1 } }));

php.mkdir('/site/data');
php.writeFile('/site/data/products.json', fs.readFileSync(SITE + '/data/products.json'));
php.writeFile('/site/data/site.json', fs.readFileSync(SITE + '/data/site.json'));
const stub = `<?php
function test_mail($to, $subject, $body, $headers) {
    $n = count(glob('/tmp/mail-*.txt') ?: []) + 1;
    file_put_contents("/tmp/mail-$n.txt", "TO: $to\\nSUBJECT: $subject\\nHEADERS:\\n$headers\\n\\n$body");
    return true;
}
?>`;
php.writeFile('/site/send.php', stub + fs.readFileSync(SITE + '/send.php', 'utf8').replace(/\bmail\(\$to/, 'test_mail($to'));
php.mkdir('/tmp');

const form = (fields) => Object.entries(fields).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
const base = { name: 'Анна', phone: '+7 (900) 000-00-00', consent: 'yes' };
let ip = 1;

async function send(fields, { method = 'POST', addr, host = 'evil.example', raw } = {}) {
    const res = await php.run({
        scriptPath: '/site/send.php',
        method,
        headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json', host },
        body: method === 'POST' ? (raw ?? form(fields)) : undefined,
        $_SERVER: { REMOTE_ADDR: addr || '10.0.0.' + ip++, HTTP_HOST: host },
    });
    let json = null;
    try { json = JSON.parse(res.text); } catch {}
    return { status: res.httpStatusCode, json, text: res.text.slice(0, 200) };
}
const lastMail = () => {
    const files = php.listFiles('/tmp').filter((f) => f.startsWith('mail-')).sort((a, b) => parseInt(a.slice(5)) - parseInt(b.slice(5)));
    return files.length ? php.readFileAsText('/tmp/' + files.at(-1)) : '';
};
const mailCount = () => php.listFiles('/tmp').filter((f) => f.startsWith('mail-')).length;

const results = [];
const check = (name, ok, detail = '') => results.push((ok ? 'OK   ' : 'FAIL ') + name + (detail ? ' — ' + detail : ''));

// 1. обычная заявка
let r = await send({ ...base, message: 'Здравствуйте', subject: 'Сообщение с сайта' });
check('заявка с формы', r.json?.ok === true && /Сообщение: Здравствуйте/.test(lastMail()), JSON.stringify(r.json));

// 2. заказ: цены и названия из каталога, номер от сервера
r = await send({ ...base, items: JSON.stringify([{ id: 'kartina-sova', qty: 2 }, { id: 'brosh-pero-pavlina', qty: 1 }]) });
let mail = lastMail();
check('заказ: номер от сервера', r.json?.ok === true && /^\d{6}-\d{6}-\d{2}$/.test(r.json.number || ''), r.json?.number);
check('заказ: сумма по каталогу', /Картина «Сова» × 2 = 29 998 ₽/.test(mail) && /Итого: 36 497 ₽/.test(mail), mail.split('\n').filter((l) => /×|Итого/.test(l)).join(' | '));
check('заказ: тема с номером сервера', mail.includes(Buffer.from('Новый заказ № ' + r.json.number).toString('base64').slice(0, 20)));

// 3. подмена заказа
r = await send({ ...base, items: JSON.stringify([{ id: 'kartina-sova', qty: 1, price: 1 }]) });
check('лишнее поле price игнорируется', r.json?.ok === true && /× 1 = 14 999 ₽/.test(lastMail()));
for (const [label, items] of [['неизвестный товар', [{ id: 'nope', qty: 1 }]], ['qty = 0', [{ id: 'kartina-sova', qty: 0 }]], ['qty = 100', [{ id: 'kartina-sova', qty: 100 }]], ['qty строкой', [{ id: 'kartina-sova', qty: '2' }]], ['пустой заказ', []], ['не JSON', 'abc']]) {
    const before = mailCount();
    r = await send({ ...base, items: typeof items === 'string' ? items : JSON.stringify(items) });
    check('отказ: ' + label, r.json?.error === 'order' && mailCount() === before, JSON.stringify(r.json));
}
r = await send(null, { raw: form(base) + '&items[]=1' });
check('отказ: items массивом', r.json?.error === 'order', r.text);

// 4. поля-массивы и обязательные поля — ответ остаётся чистым JSON, без предупреждений PHP
r = await send(null, { raw: 'name[]=x&phone=1&consent=yes' });
check('name[] массивом → required', r.json?.error === 'required' && !/Warning|Notice|Array to string/.test(r.text), r.text);
r = await send({ ...base, consent: '' });
check('без согласия → required', r.json?.error === 'required');
r = await send({ ...base, email: 'bad@' });
check('плохой e-mail → email', r.json?.error === 'email');

// 5. внедрение заголовков письма
r = await send({ ...base, email: 'a@b.cd\r\nBcc: victim@example.com' });
check('перевод строки в e-mail отклонён', r.json?.error === 'email');
r = await send({ ...base, subject: 'Тема\r\nBcc: victim@example.com' });
mail = lastMail();
const headers = mail.split('\n\n')[0];
check('перевод строки в теме не создаёт заголовок', r.json?.ok === true && !/^Bcc:/m.test(headers), headers.replace(/\n/g, ' | '));
check('домен отправителя из siteUrl, не из Host', /noreply@ovorono\.github\.io/.test(headers) && !/evil\.example/.test(headers));

// 6. поле-ловушка и метод
let before = mailCount();
r = await send({ ...base, website: 'http://spam' });
check('ловушка: ответ ok, письма нет', r.json?.ok === true && mailCount() === before);
r = await send(null, { method: 'GET' });
check('GET → 405', r.status === 405 && r.json?.error === 'method');

// 7. ограничение частоты: 5 заявок за 10 минут с одного IP
const codes = [];
for (let i = 0; i < 6; i++) codes.push((await send({ ...base, message: 'спам ' + i }, { addr: '203.0.113.7' })).json?.error || 'ok');
check('6-я заявка с одного IP → rate', codes.slice(0, 5).every((c) => c === 'ok') && codes[5] === 'rate', codes.join(','));
r = await send({ ...base, message: 'другой адрес' }, { addr: '203.0.113.8' });
check('другой IP не ограничен', r.json?.ok === true);
before = mailCount();
r = await send({ ...base, email: 'bad@' }, { addr: '203.0.113.9' });
for (let i = 0; i < 6; i++) await send({ ...base, email: 'bad@' }, { addr: '203.0.113.9' });
r = await send({ ...base }, { addr: '203.0.113.9' });
check('ошибочные заявки лимит не тратят', r.json?.ok === true);
r = await send({ ...base }, { addr: '203.0.113.7' });
check('ответ при лимите — код 429', r.status === 429);

console.log(results.join('\n'));
console.log(results.filter((l) => l.startsWith('FAIL')).length ? 'ЕСТЬ ОШИБКИ' : 'Все проверки пройдены: ' + results.length);
process.exit(0);
