/*
 * Проверка декоративных линий (svg.wave) на разной ширине экрана.
 *
 * Как запустить: откройте страницу сайта с линиями (about.html, contacts.html, catalog.html)
 * через локальный сервер, вставьте этот файл в консоль браузера и дождитесь таблицы.
 * Страница загружается в невидимые iframe нужной ширины, поэтому окно менять не нужно.
 *
 * Для каждой из трёх линий узора проверяется:
 *  - линия не задевает видимый текст;
 *  - видимая часть выходит из рисунка только через край секции или экрана (не обрывается в воздухе);
 *  - радиус изгиба больше расстояния между линиями (иначе внутренняя линия ломается).
 */
(async () => {
    const WIDTHS = [2560, 1920, 1600, 1440, 1366, 1280, 1200, 1100, 1024, 950, 900, 850, 801, 800, 600, 400, 360];

    function collectText(doc) {
        const rects = [];
        const walker = doc.createTreeWalker(doc.querySelector('main') || doc.body, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
            const node = walker.currentNode;
            if (!node.textContent.trim()) continue;
            const el = node.parentElement;
            if (el.closest('svg, header, footer, dialog') || el.offsetParent === null) continue;
            // содержимое свёрнутого <details> не видно, хотя координаты у него есть
            const details = el.closest('details');
            if (details && !details.open && !el.closest('summary')) continue;
            const range = doc.createRange();
            range.selectNodeContents(node);
            for (const r of range.getClientRects()) rects.push({ r, el });
        }
        return rects;
    }

    function checkWave(svg, doc, textRects) {
        const win = doc.defaultView;
        const path = svg.querySelector('defs path');
        const name = path ? path.id : svg.getAttribute('class');
        const cs = win.getComputedStyle(svg);
        if (cs.display === 'none') return { name, result: 'скрыт' };

        const gap = parseFloat(cs.getPropertyValue('--gap'));
        const line = parseFloat(cs.getPropertyValue('--line'));
        const matrix = svg.querySelector('use').getScreenCTM();
        const length = path.getTotalLength();
        const points = [];
        for (let l = 0; l <= length; l += 2) {
            const q = path.getPointAtLength(l);
            points.push(new DOMPoint(q.x, q.y).matrixTransform(matrix));
        }

        const box = svg.getBoundingClientRect();
        const section = svg.closest('section, main').getBoundingClientRect();
        const viewportWidth = doc.documentElement.clientWidth;
        const inside = (p) => p.x > box.left + 0.5 && p.x < box.right - 0.5 && p.y > box.top + 0.5 && p.y < box.bottom - 0.5;

        // три линии в экранных координатах: средняя кривая, сдвинутая по нормали на -gap, 0 и +gap
        const lines = [-gap, 0, gap].map((offset) => points.map((p, i) => {
            const a = points[Math.max(0, i - 1)];
            const b = points[Math.min(points.length - 1, i + 1)];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const n = Math.hypot(dx, dy) || 1;
            return { x: p.x - dy / n * offset, y: p.y + dx / n * offset };
        }));

        const problems = [];
        const touched = new Set();
        lines.forEach((pts) => {
            pts.filter(inside).forEach((p) => {
                const pad = line / 2 + 2;
                const hit = textRects.find(({ r }) => p.x >= r.left - pad && p.x <= r.right + pad && p.y >= r.top - pad && p.y <= r.bottom + pad);
                if (hit) touched.add('«' + hit.el.textContent.trim().slice(0, 20) + '»');
            });

            [pts, [...pts].reverse()].forEach((seq) => {
                if (inside(seq[0])) {
                    problems.push('конец линии внутри рисунка');
                    return;
                }
                const exit = seq.find(inside);
                if (!exit) return;
                const distance = { left: exit.x - box.left, right: box.right - exit.x, top: exit.y - box.top, bottom: box.bottom - exit.y };
                const edge = Object.keys(distance).sort((a, b) => distance[a] - distance[b])[0];
                const atEdge = {
                    left: box.left <= Math.max(section.left, 0) + 2,
                    right: box.right >= Math.min(section.right, viewportWidth) - 2,
                    top: box.top <= section.top + 2,
                    bottom: box.bottom >= section.bottom - 2
                }[edge];
                if (!atEdge) problems.push('обрыв у края рисунка: ' + edge);
            });
        });
        if (touched.size) problems.push('задевает текст ' + [...touched].slice(0, 3).join(', '));

        let minRadius = Infinity;
        for (let i = 3; i < points.length - 3; i++) {
            if (!inside(points[i])) continue;
            const a = points[i - 3];
            const b = points[i];
            const c = points[i + 3];
            const area = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2;
            if (area < 1e-6) continue;
            const radius = Math.hypot(b.x - a.x, b.y - a.y) * Math.hypot(c.x - b.x, c.y - b.y) * Math.hypot(a.x - c.x, a.y - c.y) / (4 * area);
            minRadius = Math.min(minRadius, radius);
        }
        if (minRadius < gap + line) problems.push('слишком крутой изгиб: r = ' + Math.round(minRadius) + ' px');

        return { name, result: problems.length ? [...new Set(problems)].join('; ') : 'ok' };
    }

    async function checkAt(url, width) {
        const frame = document.createElement('iframe');
        frame.style.cssText = 'position:fixed;left:0;top:0;width:' + width + 'px;height:1000px;opacity:0;pointer-events:none';
        frame.src = url;
        document.body.appendChild(frame);
        await new Promise((resolve) => { frame.onload = resolve; });
        await new Promise((resolve) => setTimeout(resolve, 400));
        const doc = frame.contentDocument;
        const textRects = collectText(doc);
        const results = [...doc.querySelectorAll('svg.wave')].map((svg) => checkWave(svg, doc, textRects));
        frame.remove();
        return results;
    }

    const rows = [];
    for (const width of WIDTHS) {
        (await checkAt(location.pathname, width)).forEach(({ name, result }) => rows.push({ ширина: width, узор: name, результат: result }));
    }
    console.table(rows);
    const failed = rows.filter((row) => row.результат !== 'ok' && row.результат !== 'скрыт');
    console.log(failed.length ? 'Проблем: ' + failed.length : 'Все линии в порядке');
})();
