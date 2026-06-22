(function () {
    const PRODUCTS = [
        { title: 'Панно «Зимний Ростов»', image: 'images/products-1.png' },
        { title: 'Шкатулка «Цветочный узор»', image: 'images/products-2.png' },
        { title: 'Колокольчик «Ростовский сувенир»', image: 'images/products-3.png' },
        { title: 'Брошь «Золотая птица»', image: 'images/products-4.png' },
        { title: 'Зажим для платка «Цветочная миниатюра»', image: 'images/products-5.png' },
        { title: 'Колье «Изумрудная финифть»', image: 'images/products-6.png' },
        { title: 'Браслет «Ростовские цвета»', image: 'images/products-7.png' },
        { title: 'Шкатулка «Синяя гладь»', image: 'images/products-8.png' },
        { title: 'Икона-триптих «Святые покровители»', image: 'images/products-9.png' },
        { title: 'Икона «Богородица»', image: 'images/products-10.png' },
        { title: 'Подвеска-закладка «Синий цветок»', image: 'images/products-11.png' },
        { title: 'Картина «Сова»', image: 'images/products-12.png' },
        { title: 'Подстаканник «Ромашки»', image: 'images/products-13.png' },
        { title: 'Брелок «Ростовский герб»', image: 'images/products-14.png' },
        { title: 'Подвеска «Яркая капля»', image: 'images/products-15.png' },
        { title: 'Закладка «Серебряный узор»', image: 'images/products-16.png' },
        { title: 'Зеркальце «Цветочная эмаль»', image: 'images/products-17.png' }
    ];

    function normalizeText(value) {
        return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function findProducts(query) {
        const normalized = normalizeText(query);
        if (normalized.length < 2) {
            return [];
        }

        return PRODUCTS.filter((product) => normalizeText(product.title).includes(normalized)).slice(0, 6);
    }

    function scrollToProduct(title) {
        const cards = document.querySelectorAll('.product-card');
        const normalizedTitle = normalizeText(title);

        for (const card of cards) {
            const cardTitle = normalizeText(card.querySelector('.product-info h3')?.textContent || '');
            if (cardTitle === normalizedTitle) {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                card.classList.add('search-highlight');
                window.setTimeout(() => card.classList.remove('search-highlight'), 1800);
                return true;
            }
        }

        return false;
    }

    function buildDropdown(searchBox) {
        let dropdown = searchBox.querySelector('.search-dropdown');

        if (!dropdown) {
            dropdown = document.createElement('div');
            dropdown.className = 'search-dropdown';
            searchBox.appendChild(dropdown);
        }

        return dropdown;
    }

    function renderDropdown(dropdown, matches) {
        if (!matches.length) {
            dropdown.innerHTML = '';
            return;
        }

        dropdown.innerHTML = matches.map((product) => {
            const href = `catalog.html?search=${encodeURIComponent(product.title)}`;
            return [
                `<a class="search-dropdown-item" href="${href}">`,
                `<img src="${escapeHtml(product.image)}" alt="">`,
                `<span>${escapeHtml(product.title)}</span>`,
                '</a>'
            ].join('');
        }).join('');
    }

    function initSearchInput(input) {
        const searchBox = input.closest('.search-box');
        if (!searchBox) {
            return;
        }

        const dropdown = buildDropdown(searchBox);

        input.setAttribute('autocomplete', 'off');

        input.addEventListener('input', () => {
            renderDropdown(dropdown, findProducts(input.value));
        });

        input.addEventListener('focus', () => {
            renderDropdown(dropdown, findProducts(input.value));
        });

        document.addEventListener('click', (event) => {
            if (!searchBox.contains(event.target)) {
                dropdown.innerHTML = '';
            }
        });
    }

    document.querySelectorAll('.search-box input[type="text"]').forEach(initSearchInput);

    const params = new URLSearchParams(window.location.search);
    const searchQuery = params.get('search');

    if (searchQuery && document.getElementById('catalog-grid')) {
        window.setTimeout(() => scrollToProduct(searchQuery), 300);
    }
})();
