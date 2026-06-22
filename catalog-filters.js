(function () {
    const grid = document.getElementById('catalog-grid');
    if (!grid) return;

    const emptyMessage = document.getElementById('catalog-empty');
    const resetButton = document.getElementById('reset-filters');
    const sortSelect = document.getElementById('sort-select');
    const sortSummary = document.getElementById('sort-summary');
    const sortOptions = document.querySelectorAll('.sort-option');
    const filterInputs = document.querySelectorAll('.catalog-sidebar input[type="checkbox"]');

    const certificateBanner = grid.querySelector('.certificate-banner');
    const saleBanner = grid.querySelector('.sale-banner');
    const banners = [certificateBanner, saleBanner].filter(Boolean);

    let currentSort = 'popular';

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

    function rebuildGrid(sortedProducts) {
        const visible = sortedProducts.filter(function (card) {
            return !card.hidden;
        });
        const hidden = sortedProducts.filter(function (card) {
            return card.hidden;
        });

        [...visible, ...hidden, ...banners].forEach(function (node) {
            if (node && node.parentNode === grid) {
                grid.removeChild(node);
            }
        });

        const splitAt = Math.min(5, visible.length);

        visible.slice(0, splitAt).forEach(function (card) {
            grid.appendChild(card);
        });

        banners.forEach(function (banner) {
            grid.appendChild(banner);
        });

        visible.slice(splitAt).forEach(function (card) {
            grid.appendChild(card);
        });

        hidden.forEach(function (card) {
            grid.appendChild(card);
        });

        if (emptyMessage && emptyMessage.parentNode === grid) {
            grid.appendChild(emptyMessage);
        }

        if (emptyMessage) {
            emptyMessage.hidden = visible.length > 0;
        }
    }

    function applyCatalogState() {
        const cards = getProductCards();

        cards.forEach(function (card) {
            const visible = matchesFilters(card);
            card.hidden = !visible;
            card.classList.toggle('is-filtered-out', !visible);
        });

        const sorted = cards.slice().sort(compareCards);
        rebuildGrid(sorted);
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
    }

    filterInputs.forEach(function (input) {
        input.addEventListener('change', applyCatalogState);
    });

    sortOptions.forEach(function (option) {
        option.addEventListener('click', function () {
            setSort(option.dataset.sort, option.textContent.trim());
        });
    });

    if (resetButton) {
        resetButton.addEventListener('click', function () {
            filterInputs.forEach(function (input) {
                input.checked = false;
            });
            setSort('popular', sortLabels.popular);
        });
    }

    applyCatalogState();
})();
