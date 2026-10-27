(function () {
    const UI = window.SiteUI;
    const ROOT = UI.root;
    const DATA = UI.data;
    const PRODUCTS = DATA.products || [];
    const escapeHtml = UI.escapeHtml;

    // Окончания для простого «стемминга»: серьги → серьг, броши → брош, шкатулки → шкатулк
    const ENDINGS = ['ями', 'ами', 'ого', 'его', 'ому', 'ему', 'ыми', 'ими', 'ая', 'яя', 'ое', 'ее', 'ые', 'ие', 'ый', 'ий', 'ой',
        'ов', 'ев', 'ей', 'ам', 'ям', 'ах', 'ях', 'ом', 'ем', 'ой', 'ую', 'юю', 'а', 'я', 'о', 'е', 'ы', 'и', 'у', 'ю', 'ь', 'й'];

    function findName(list, id) {
        const item = (list || []).find((entry) => entry.id === id);
        return item ? item.name : '';
    }

    function normalizeText(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/ё/g, 'е')
            .replace(/[«»"'.,:;!?()\-—–/]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function stem(word) {
        for (const ending of ENDINGS) {
            if (word.length - ending.length >= 3 && word.endsWith(ending)) {
                return word.slice(0, -ending.length);
            }
        }
        return word;
    }

    function toStems(text) {
        return normalizeText(text).split(' ').filter(Boolean).map(stem);
    }

    const INDEX = PRODUCTS.map((product) => ({
        product,
        categoryName: findName(DATA.categories, product.category),
        titleStems: toStems(product.title),
        allStems: toStems([
            product.title,
            findName(DATA.categories, product.category),
            findName(DATA.collections, product.collection),
            findName(DATA.materials, product.material),
            product.keywords
        ].join(' '))
    }));

    function stemMatches(queryStem, stems) {
        return stems.some((s) => s.startsWith(queryStem) || (s.length >= 4 && queryStem.startsWith(s)));
    }

    function findProducts(query) {
        const queryStems = toStems(query);
        if (!queryStems.length || normalizeText(query).length < 2) {
            return [];
        }

        return INDEX
            .filter((entry) => queryStems.every((q) => stemMatches(q, entry.allStems)))
            .map((entry) => ({
                entry,
                score: queryStems.filter((q) => stemMatches(q, entry.titleStems)).length
            }))
            .sort((a, b) => b.score - a.score || a.entry.product.popularity - b.entry.product.popularity)
            .map((item) => item.entry);
    }

    function plural(count, one, few, many) {
        const mod10 = count % 10;
        const mod100 = count % 100;
        if (mod10 === 1 && mod100 !== 11) return one;
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
        return many;
    }

    /* ---------- Выпадающие подсказки в шапке ---------- */

    function buildDropdown(searchBox) {
        let dropdown = searchBox.querySelector('.search-dropdown');

        if (!dropdown) {
            dropdown = document.createElement('div');
            dropdown.className = 'search-dropdown';
            dropdown.setAttribute('role', 'listbox');
            searchBox.appendChild(dropdown);
        }

        return dropdown;
    }

    function renderDropdown(dropdown, query) {
        if (normalizeText(query).length < 2) {
            dropdown.innerHTML = '';
            return;
        }

        const matches = findProducts(query);

        if (!matches.length) {
            dropdown.innerHTML = '<p class="search-dropdown-empty">Ничего не найдено. Попробуйте «брошь», «икона» или «шкатулка».</p>';
            return;
        }

        const items = matches.slice(0, 6).map((entry) => {
            const product = entry.product;
            return [
                '<a class="search-dropdown-item" role="option" href="' + ROOT + escapeHtml(product.url) + '">',
                '<img src="' + ROOT + escapeHtml(product.image) + '" alt="">',
                '<span>' + escapeHtml(product.title) + '<small>' + escapeHtml(entry.categoryName) + ' · ' + UI.formatPrice(product.price) + '</small></span>',
                '</a>'
            ].join('');
        });

        const allHref = ROOT + 'search.html?q=' + encodeURIComponent(query.trim());
        items.push('<a class="search-dropdown-all" href="' + allHref + '">Все результаты: ' + matches.length + ' ' +
            plural(matches.length, 'товар', 'товара', 'товаров') + ' →</a>');

        dropdown.innerHTML = items.join('');
    }

    function moveSelection(dropdown, step) {
        const links = [...dropdown.querySelectorAll('a')];
        if (!links.length) return;

        const current = links.indexOf(document.activeElement);
        const next = current === -1 ? (step > 0 ? 0 : links.length - 1) : (current + step + links.length) % links.length;
        links[next].focus();
    }

    function initSearchInput(input) {
        const searchBox = input.closest('.search-box');
        const form = input.closest('form');
        if (!searchBox) {
            return;
        }

        const dropdown = buildDropdown(searchBox);

        input.setAttribute('autocomplete', 'off');

        input.addEventListener('input', () => {
            renderDropdown(dropdown, input.value);
        });

        input.addEventListener('focus', () => {
            renderDropdown(dropdown, input.value);
        });

        searchBox.addEventListener('keydown', (event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                moveSelection(dropdown, event.key === 'ArrowDown' ? 1 : -1);
            } else if (event.key === 'Escape') {
                dropdown.innerHTML = '';
                input.focus();
            }
        });

        // пустой запрос не отправляем
        if (form) {
            form.addEventListener('submit', (event) => {
                if (!input.value.trim()) {
                    event.preventDefault();
                    input.focus();
                }
            });
        }

        document.addEventListener('click', (event) => {
            if (!searchBox.contains(event.target)) {
                dropdown.innerHTML = '';
            }
        });
    }

    document.querySelectorAll('.search-box input[type="search"]').forEach(initSearchInput);

    /* ---------- Страница результатов search.html ---------- */

    function buildCardHtml(product) {
        const url = ROOT + escapeHtml(product.url);
        return [
            '<article class="product-card" data-id="' + escapeHtml(product.id) + '">',
            '<button class="heart" type="button" aria-label="Добавить в избранное" aria-pressed="false">♡</button>',
            '<a class="product-image" href="' + url + '" tabindex="-1" aria-hidden="true">',
            '<img src="' + ROOT + escapeHtml(product.image) + '" alt="' + escapeHtml(product.title) + '" loading="lazy">',
            '</a>',
            '<div class="product-info">',
            '<div>',
            '<h3><a href="' + url + '">' + escapeHtml(product.title) + '</a></h3>',
            '<p>' + UI.formatPrice(product.price) + '</p>',
            '</div>',
            '<button class="cart-btn" type="button" aria-label="Добавить в корзину: ' + escapeHtml(product.title) + '">',
            '<svg class="cart-btn-icon" viewBox="0 0 24 24" aria-hidden="true">',
            '<path d="M6 7H20L18.5 16H8L6 7Z"></path><path d="M6 7L5.3 4H3"></path>',
            '<circle cx="9" cy="20" r="1.2"></circle><circle cx="17" cy="20" r="1.2"></circle>',
            '</svg>',
            '</button>',
            '</div>',
            '</article>'
        ].join('');
    }

    function renderSearchPage() {
        const results = document.getElementById('search-results');
        if (!results) return;

        const query = (new URLSearchParams(location.search).get('q') || '').trim();
        const title = document.getElementById('search-title');
        const summary = document.getElementById('search-summary');

        document.querySelectorAll('.search-box input[type="search"], #search-page-input').forEach((input) => {
            input.value = query;
        });

        if (!query) {
            title.textContent = 'Поиск по каталогу';
            summary.textContent = 'Введите название изделия, категорию или коллекцию.';
            return;
        }

        const matches = findProducts(query);
        title.textContent = 'Результаты поиска: «' + query + '»';
        document.title = 'Поиск: ' + query + ' — Ростовская эмаль';

        if (!matches.length) {
            summary.textContent = 'По вашему запросу ничего не найдено. Проверьте написание или посмотрите весь каталог.';
            results.innerHTML = '';
            return;
        }

        summary.textContent = 'Найдено ' + matches.length + ' ' + plural(matches.length, 'товар', 'товара', 'товаров') + '.';
        results.innerHTML = matches.map((entry) => buildCardHtml(entry.product)).join('');

        if (window.SiteCart) window.SiteCart.syncProductHearts();
    }

    window.SiteSearch = { findProducts };

    renderSearchPage();
})();
