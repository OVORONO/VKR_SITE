(function () {
    const grid = document.getElementById('catalog-grid');
    if (!grid) return;

    const PAGE_SIZE = 12;
    const FILTER_NAMES = ['category', 'price', 'material', 'author', 'collection'];

    const emptyMessage = document.getElementById('catalog-empty');
    const resetButtons = document.querySelectorAll('#reset-filters, [data-reset-filters]');
    const sortSelect = document.getElementById('sort-select');
    const sortSummary = document.getElementById('sort-summary');
    const sortOptions = document.querySelectorAll('.sort-option');
    const filterInputs = document.querySelectorAll('.catalog-sidebar input[type="checkbox"]');
    const countLabel = document.getElementById('catalog-count');
    const moreButton = document.getElementById('catalog-more');
    const sidebar = document.querySelector('.catalog-sidebar');
    const filtersToggle = document.querySelector('.filters-toggle');
    const activeCount = document.getElementById('filters-active-count');

    const banners = [...grid.querySelectorAll('.catalog-banners')];

    let currentSort = 'popular';
    let visibleLimit = PAGE_SIZE;

    const sortLabels = {
        popular: 'По популярности',
        'price-up': 'Сначала дешевле',
        'price-down': 'Сначала дороже',
        new: 'Новинки',
    };

    function getProductCards() {
        return [...grid.querySelectorAll('.product-card')];
    }

    function parsePrice(card) {
        return parseInt(card.dataset.price, 10) || 0;
    }

    function getPriceRange(price) {
        if (price <= 5000) return 'to-5000';
        if (price <= 10000) return '5000-10000';
        if (price <= 20000) return '10000-20000';
        return 'from-20000';
    }

    function plural(count, one, few, many) {
        const mod10 = count % 10;
        const mod100 = count % 100;
        if (mod10 === 1 && mod100 !== 11) return one;
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
        return many;
    }

    function getCheckedValues(name) {
        return [...document.querySelectorAll('input[name="' + name + '"]:checked')].map(function (input) {
            return input.value;
        });
    }

    function matchesFilters(card) {
        const categories = getCheckedValues('category');
        const prices = getCheckedValues('price');
        const materials = getCheckedValues('material');
        const authors = getCheckedValues('author');
        const collections = getCheckedValues('collection');

        if (categories.length && categories.indexOf(card.dataset.category) === -1) return false;
        if (prices.length && prices.indexOf(getPriceRange(parsePrice(card))) === -1) return false;
        if (materials.length && materials.indexOf(card.dataset.material) === -1) return false;
        if (authors.length && authors.indexOf(card.dataset.author) === -1) return false;
        if (collections.length && collections.indexOf(card.dataset.collection) === -1) return false;

        return true;
    }

    function compareCards(a, b) {
        switch (currentSort) {
            case 'price-up':
                return parsePrice(a) - parsePrice(b);
            case 'price-down':
                return parsePrice(b) - parsePrice(a);
            case 'new':
                return (parseInt(b.dataset.new, 10) || 0) - (parseInt(a.dataset.new, 10) || 0);
            default:
                return (parseInt(a.dataset.popularity, 10) || 0) - (parseInt(b.dataset.popularity, 10) || 0);
        }
    }

    function getColumnCount() {
        return getComputedStyle(grid).gridTemplateColumns.split(' ').length || 1;
    }

    // Баннеры ставим после первых рядов так, чтобы в сетке не оставалось пустых ячеек
    function getBannerPosition(cards) {
        const columns = getColumnCount();
        let cells = 0;

        for (let i = 0; i < cards.length; i++) {
            const big = cards[i].classList.contains('big-card') && columns > 1;
            cells += big ? 4 : 1;
            if (i >= 3 && cells % columns === 0) return i + 1;
        }

        return cards.length;
    }

    function rebuildGrid(sortedProducts) {
        const visible = sortedProducts.filter(function (card) {
            return !card.classList.contains('is-filtered-out');
        });
        const hidden = sortedProducts.filter(function (card) {
            return card.classList.contains('is-filtered-out');
        });

        visible.forEach(function (card, index) {
            card.classList.toggle('is-paged-out', index >= visibleLimit);
        });

        const shown = visible.slice(0, visibleLimit);
        const splitAt = getBannerPosition(shown);

        shown.slice(0, splitAt).forEach(function (card) {
            grid.appendChild(card);
        });

        banners.forEach(function (banner) {
            banner.hidden = shown.length === 0;
            grid.appendChild(banner);
        });

        shown.slice(splitAt).concat(visible.slice(visibleLimit), hidden).forEach(function (card) {
            grid.appendChild(card);
        });

        if (emptyMessage) {
            grid.appendChild(emptyMessage);
            emptyMessage.hidden = visible.length > 0;
        }

        if (countLabel) {
            countLabel.textContent = 'Найдено: ' + visible.length + ' ' + plural(visible.length, 'товар', 'товара', 'товаров');
        }

        if (moreButton) {
            const rest = visible.length - shown.length;
            moreButton.hidden = rest <= 0;
            moreButton.textContent = 'Показать ещё ' + Math.min(rest, PAGE_SIZE) + ' из ' + rest;
        }
    }

    function updateActiveCount() {
        const total = document.querySelectorAll('.catalog-sidebar input[type="checkbox"]:checked').length;

        if (activeCount) {
            activeCount.textContent = total;
            activeCount.hidden = total === 0;
        }
    }

    // Состояние фильтров хранится в адресе страницы, чтобы ссылкой можно было поделиться
    function saveStateToUrl() {
        const params = new URLSearchParams();

        FILTER_NAMES.forEach(function (name) {
            const values = getCheckedValues(name);
            if (values.length) params.set(name, values.join(','));
        });

        if (currentSort !== 'popular') params.set('sort', currentSort);

        const query = params.toString();
        history.replaceState(null, '', location.pathname + (query ? '?' + query : ''));
    }

    function readStateFromUrl() {
        const params = new URLSearchParams(location.search);

        FILTER_NAMES.forEach(function (name) {
            const values = (params.get(name) || '').split(',').filter(Boolean);

            values.forEach(function (value) {
                const input = document.querySelector('input[name="' + name + '"][value="' + CSS.escape(value) + '"]');
                if (!input) return;

                input.checked = true;
                const details = input.closest('details');
                if (details) details.open = true;
            });
        });

        const sort = params.get('sort');
        if (sort && sortLabels[sort]) {
            currentSort = sort;
            if (sortSummary) sortSummary.textContent = sortLabels[sort];
            sortOptions.forEach(function (option) {
                option.classList.toggle('is-active', option.dataset.sort === sort);
            });
        }
    }

    function applyCatalogState() {
        const cards = getProductCards();

        cards.forEach(function (card) {
            card.classList.toggle('is-filtered-out', !matchesFilters(card));
        });

        const sorted = cards.slice().sort(compareCards);
        rebuildGrid(sorted);
        updateActiveCount();
    }

    function onFiltersChanged() {
        visibleLimit = PAGE_SIZE;
        applyCatalogState();
        saveStateToUrl();
    }

    function setSort(sortValue, label) {
        currentSort = sortValue;

        if (sortSummary && label) {
            sortSummary.textContent = label;
        }

        sortOptions.forEach(function (option) {
            option.classList.toggle('is-active', option.dataset.sort === sortValue);
        });

        if (sortSelect) {
            sortSelect.open = false;
        }

        applyCatalogState();
        saveStateToUrl();
    }

    filterInputs.forEach(function (input) {
        input.addEventListener('change', onFiltersChanged);
    });

    sortOptions.forEach(function (option) {
        option.addEventListener('click', function () {
            setSort(option.dataset.sort, option.textContent.trim());
        });
    });

    resetButtons.forEach(function (button) {
        button.addEventListener('click', function () {
            filterInputs.forEach(function (input) {
                input.checked = false;
            });
            visibleLimit = PAGE_SIZE;
            setSort('popular', sortLabels.popular);
        });
    });

    if (moreButton) {
        moreButton.addEventListener('click', function () {
            visibleLimit += PAGE_SIZE;
            applyCatalogState();
        });
    }

    if (filtersToggle && sidebar) {
        filtersToggle.addEventListener('click', function () {
            const open = sidebar.classList.toggle('filters-are-open');
            filtersToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
    }

    document.addEventListener('click', function (event) {
        if (sortSelect && sortSelect.open && !sortSelect.contains(event.target)) {
            sortSelect.open = false;
        }
    });

    let resizeTimer = null;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(applyCatalogState, 200);
    });

    readStateFromUrl();
    applyCatalogState();
})();
