(function () {
    const CART_KEY = 'rostov-cart';
    const FAV_KEY = 'rostov-favorites';

    function parsePrice(text) {
        if (!text) return 0;
        return parseInt(String(text).replace(/[^\d]/g, ''), 10) || 0;
    }

    function formatPrice(amount) {
        return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' руб';
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function loadCart() {
        try {
            const data = JSON.parse(localStorage.getItem(CART_KEY));
            return Array.isArray(data) ? data : [];
        } catch {
            return [];
        }
    }

    function saveCart(cart) {
        localStorage.setItem(CART_KEY, JSON.stringify(cart));
    }

    function loadFavorites() {
        try {
            const data = JSON.parse(localStorage.getItem(FAV_KEY));
            return Array.isArray(data) ? data : [];
        } catch {
            return [];
        }
    }

    function saveFavorites(favorites) {
        localStorage.setItem(FAV_KEY, JSON.stringify(favorites));
    }

    function getProductFromCard(card) {
        const img = card.querySelector('.product-image img');
        if (!img) return null;

        const id = (img.getAttribute('src') || '').split('/').pop();
        const title = card.querySelector('.product-info h3')?.textContent.trim() || 'Товар';
        const priceText = card.querySelector('.product-info p')?.textContent.trim() || '0 руб';
        const price = parsePrice(priceText);
        const image = img.getAttribute('src') || '';

        return { id, title, priceText, price, image };
    }

    function findCartItem(cart, id) {
        return cart.find((item) => item.id === id);
    }

    function addToCart(product) {
        const cart = loadCart();
        const existing = findCartItem(cart, product.id);

        if (existing) {
            existing.qty += 1;
        } else {
            cart.push({ ...product, qty: 1 });
        }

        saveCart(cart);
        renderCart();
    }

    function changeCartQty(id, delta) {
        const cart = loadCart();
        const item = findCartItem(cart, id);
        if (!item) return;

        item.qty += delta;

        if (item.qty <= 0) {
            saveCart(cart.filter((entry) => entry.id !== id));
        } else {
            saveCart(cart);
        }

        renderCart();
    }

    function isFavorite(id) {
        return loadFavorites().some((item) => item.id === id);
    }

    function addToFavorites(product) {
        const favorites = loadFavorites();
        if (favorites.some((item) => item.id === product.id)) return;
        favorites.push(product);
        saveFavorites(favorites);
        renderFavorites();
        syncProductHearts();
    }

    function removeFromFavorites(id) {
        saveFavorites(loadFavorites().filter((item) => item.id !== id));
        renderFavorites();
        syncProductHearts();
    }

    function toggleFavorite(product) {
        if (isFavorite(product.id)) {
            removeFromFavorites(product.id);
        } else {
            addToFavorites(product);
        }
    }

    function syncProductHearts() {
        document.querySelectorAll('.product-card').forEach((card) => {
            const product = getProductFromCard(card);
            const heart = card.querySelector('.heart');
            if (!product || !heart) return;

            const active = isFavorite(product.id);
            heart.classList.toggle('is-active', active);
            heart.textContent = active ? '♥' : '♡';
            heart.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
    }

    function buildCartItemHtml(item) {
        const article = document.createElement('article');
        article.className = 'modal-product';
        article.dataset.productId = item.id;

        article.innerHTML = [
            '<div class="modal-product-img">',
            '<img src="' + escapeHtml(item.image) + '" alt="' + escapeHtml(item.title) + '">',
            '</div>',
            '<div class="modal-product-info">',
            '<h3>' + escapeHtml(item.title) + '</h3>',
            '<p>' + escapeHtml(item.priceText) + '</p>',
            '</div>',
            '<div class="modal-count">',
            '<button type="button" data-cart-action="decrease" aria-label="Уменьшить количество">−</button>',
            '<span>' + item.qty + '</span>',
            '<button type="button" data-cart-action="increase" aria-label="Увеличить количество">+</button>',
            '</div>'
        ].join('');

        return article.outerHTML;
    }

    function renderCart() {
        const list = document.getElementById('cart-items-list');
        const totalEl = document.getElementById('cart-total-amount');
        if (!list || !totalEl) return;

        const cart = loadCart();

        if (!cart.length) {
            list.innerHTML = '<p class="modal-empty">Корзина пуста. Добавьте товары с карточки.</p>';
            totalEl.textContent = '0 руб';
            return;
        }

        let total = 0;
        const html = cart.map((item) => {
            total += item.price * item.qty;
            return buildCartItemHtml(item);
        });

        list.innerHTML = html.join('');
        totalEl.textContent = formatPrice(total);
    }

    function buildFavoriteCardHtml(item) {
        const article = document.createElement('article');
        article.className = 'favorite-card';
        article.dataset.productId = item.id;

        article.innerHTML = [
            '<button type="button" class="favorite-heart" aria-label="Убрать из избранного">♥</button>',
            '<div class="favorite-img">',
            '<img src="' + escapeHtml(item.image) + '" alt="' + escapeHtml(item.title) + '">',
            '</div>',
            '<h3>' + escapeHtml(item.title) + '</h3>',
            '<p>' + escapeHtml(item.priceText) + '</p>',
            '<button type="button" class="favorite-btn" data-fav-action="to-cart">В корзину</button>'
        ].join('');

        return article.outerHTML;
    }

    function renderFavorites() {
        const grid = document.getElementById('favorites-items-list');
        if (!grid) return;

        const favorites = loadFavorites();

        if (!favorites.length) {
            grid.innerHTML = '<p class="modal-empty modal-empty--favorites">Избранное пусто. Нажмите ♡ на карточке товара.</p>';
            return;
        }

        grid.innerHTML = favorites.map(buildFavoriteCardHtml).join('');
    }

    function bindProductCards() {
        document.querySelectorAll('.product-card').forEach((card) => {
            const heart = card.querySelector('.heart');
            const cartBtn = card.querySelector('.cart-btn');
            const product = getProductFromCard(card);
            if (!product) return;

            if (heart && !heart.dataset.bound) {
                heart.dataset.bound = 'true';
                heart.setAttribute('type', 'button');
                heart.setAttribute('aria-label', 'Добавить в избранное');

                heart.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    toggleFavorite(product);
                });
            }

            if (cartBtn && !cartBtn.dataset.bound) {
                cartBtn.dataset.bound = 'true';

                cartBtn.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    addToCart(product);
                });
            }
        });
    }

    function bindModalLists() {
        const cartList = document.getElementById('cart-items-list');
        if (cartList && !cartList.dataset.bound) {
            cartList.dataset.bound = 'true';
            cartList.addEventListener('click', (event) => {
                const btn = event.target.closest('[data-cart-action]');
                if (!btn) return;

                const row = btn.closest('[data-product-id]');
                if (!row) return;

                const id = row.getAttribute('data-product-id');
                const action = btn.getAttribute('data-cart-action');
                changeCartQty(id, action === 'increase' ? 1 : -1);
            });
        }

        const favGrid = document.getElementById('favorites-items-list');
        if (favGrid && !favGrid.dataset.bound) {
            favGrid.dataset.bound = 'true';
            favGrid.addEventListener('click', (event) => {
                const card = event.target.closest('[data-product-id]');
                if (!card) return;

                const id = card.getAttribute('data-product-id');

                if (event.target.closest('.favorite-heart')) {
                    removeFromFavorites(id);
                    return;
                }

                if (event.target.closest('[data-fav-action="to-cart"]')) {
                    const item = loadFavorites().find((entry) => entry.id === id);
                    if (item) addToCart(item);
                }
            });
        }
    }

    function init() {
        renderCart();
        renderFavorites();
        syncProductHearts();
        bindProductCards();
        bindModalLists();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
