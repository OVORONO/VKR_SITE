(function () {
    const CART_KEY = 'rostov-cart';
    const FAV_KEY = 'rostov-favorites';
    const ORDERS_KEY = 'rostov-orders';

    const UI = window.SiteUI;
    const ROOT = UI.root;
    const PRODUCTS = UI.data.products || [];

    const formatPrice = UI.formatPrice;
    const escapeHtml = UI.escapeHtml;

    function findProduct(id) {
        return PRODUCTS.find((product) => product.id === id) || null;
    }

    function readList(key) {
        try {
            const data = JSON.parse(UI.storageGet(key));
            return Array.isArray(data) ? data : [];
        } catch {
            return [];
        }
    }

    function writeList(key, list) {
        UI.storageSet(key, JSON.stringify(list));
    }

    // В хранилище держим только id и количество, а название, цену и фото
    // всегда берём из каталога — так цены в корзине не устаревают.
    function loadCart() {
        return readList(CART_KEY)
            .filter((item) => item && findProduct(item.id))
            .map((item) => ({ id: item.id, qty: Math.max(1, parseInt(item.qty, 10) || 1) }));
    }

    function saveCart(cart) {
        writeList(CART_KEY, cart);
    }

    function loadFavorites() {
        return readList(FAV_KEY)
            .map((item) => (typeof item === 'string' ? item : item && item.id))
            .filter((id) => findProduct(id));
    }

    function saveFavorites(favorites) {
        writeList(FAV_KEY, favorites);
    }

    function loadOrders() {
        return readList(ORDERS_KEY);
    }

    function getProductFromCard(card) {
        return card ? findProduct(card.dataset.id) : null;
    }

    function findCartItem(cart, id) {
        return cart.find((item) => item.id === id);
    }

    function getCartTotal(cart) {
        return cart.reduce((sum, item) => sum + findProduct(item.id).price * item.qty, 0);
    }

    function addToCart(product) {
        const cart = loadCart();
        const existing = findCartItem(cart, product.id);

        if (existing) {
            existing.qty += 1;
        } else {
            cart.push({ id: product.id, qty: 1 });
        }

        saveCart(cart);
        renderCart();
        bumpBadge('[data-cart-count]');
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

    function clearCart() {
        saveCart([]);
        renderCart();
    }

    function isFavorite(id) {
        return loadFavorites().indexOf(id) !== -1;
    }

    function addToFavorites(product) {
        const favorites = loadFavorites();
        if (favorites.indexOf(product.id) !== -1) return;
        favorites.push(product.id);
        saveFavorites(favorites);
        renderFavorites();
        syncProductHearts();
        bumpBadge('[data-fav-count]');
    }

    function removeFromFavorites(id) {
        saveFavorites(loadFavorites().filter((item) => item !== id));
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
        document.querySelectorAll('[data-id] .heart').forEach((heart) => {
            const product = getProductFromCard(heart.closest('[data-id]'));
            if (!product) return;

            const active = isFavorite(product.id);
            heart.classList.toggle('is-active', active);
            heart.textContent = active ? '♥' : '♡';
            heart.setAttribute('aria-pressed', active ? 'true' : 'false');
            heart.setAttribute('aria-label', active ? 'Убрать из избранного' : 'Добавить в избранное');
        });
    }

    function setBadge(selector, count) {
        document.querySelectorAll(selector).forEach((badge) => {
            badge.textContent = count;
            badge.hidden = count === 0;
        });
    }

    function bumpBadge(selector) {
        document.querySelectorAll(selector).forEach((badge) => {
            badge.classList.remove('is-bumped');
            void badge.offsetWidth;
            badge.classList.add('is-bumped');
        });
    }

    function buildCartItemHtml(item) {
        const product = findProduct(item.id);

        return [
            '<article class="modal-product" data-product-id="' + escapeHtml(item.id) + '">',
            '<a class="modal-product-img" href="' + ROOT + escapeHtml(product.url) + '">',
            '<img src="' + ROOT + escapeHtml(product.image) + '" alt="' + escapeHtml(product.title) + '">',
            '</a>',
            '<div class="modal-product-info">',
            '<h3><a href="' + ROOT + escapeHtml(product.url) + '">' + escapeHtml(product.title) + '</a></h3>',
            '<p>' + formatPrice(product.price) + '</p>',
            '</div>',
            '<div class="modal-count">',
            '<button type="button" data-cart-action="decrease" aria-label="Уменьшить количество">−</button>',
            '<span aria-label="Количество">' + item.qty + '</span>',
            '<button type="button" data-cart-action="increase" aria-label="Увеличить количество">+</button>',
            '</div>',
            '</article>'
        ].join('');
    }

    function renderCart() {
        const cart = loadCart();
        const count = cart.reduce((sum, item) => sum + item.qty, 0);
        setBadge('[data-cart-count]', count);

        const list = document.getElementById('cart-items-list');
        const totalEl = document.getElementById('cart-total-amount');
        const checkoutBtn = document.getElementById('cart-checkout-btn');
        if (!list || !totalEl) return;

        if (checkoutBtn) {
            checkoutBtn.classList.toggle('is-disabled', !cart.length);
            checkoutBtn.setAttribute('aria-disabled', cart.length ? 'false' : 'true');
        }

        if (!cart.length) {
            list.innerHTML = '<p class="modal-empty">Корзина пуста. Выберите изделие в <a href="' + ROOT + 'catalog.html">каталоге</a>.</p>';
            totalEl.textContent = formatPrice(0);
            return;
        }

        list.innerHTML = cart.map(buildCartItemHtml).join('');
        totalEl.textContent = formatPrice(getCartTotal(cart));
    }

    function buildFavoriteCardHtml(id) {
        const product = findProduct(id);

        return [
            '<article class="favorite-card" data-product-id="' + escapeHtml(id) + '">',
            '<button type="button" class="favorite-heart" aria-label="Убрать из избранного">♥</button>',
            '<a class="favorite-img" href="' + ROOT + escapeHtml(product.url) + '">',
            '<img src="' + ROOT + escapeHtml(product.image) + '" alt="' + escapeHtml(product.title) + '">',
            '</a>',
            '<h3>' + escapeHtml(product.title) + '</h3>',
            '<p>' + formatPrice(product.price) + '</p>',
            '<button type="button" class="favorite-btn" data-fav-action="to-cart">В корзину</button>',
            '</article>'
        ].join('');
    }

    function renderFavorites() {
        const favorites = loadFavorites();
        setBadge('[data-fav-count]', favorites.length);

        const grid = document.getElementById('favorites-items-list');
        if (!grid) return;

        if (!favorites.length) {
            grid.innerHTML = '<p class="modal-empty modal-empty--favorites">Избранное пусто. Нажмите ♡ на карточке товара.</p>';
            return;
        }

        grid.innerHTML = favorites.map(buildFavoriteCardHtml).join('');
    }

    function renderOrders() {
        const list = document.getElementById('orders-list');
        if (!list) return;

        const orders = loadOrders();

        if (!orders.length) {
            list.innerHTML = '<p class="modal-empty">Заказов пока нет. Добавьте изделия в корзину и оформите заказ — он появится здесь.</p>';
            return;
        }

        list.innerHTML = orders.slice().reverse().map((order) => [
            '<div class="order-item">',
            '<strong>Заказ № ' + escapeHtml(order.number) + ' от ' + escapeHtml(order.date) + '</strong>',
            escapeHtml(order.items.join(', ')),
            '<br>Сумма: ' + formatPrice(order.total),
            '</div>'
        ].join('')).join('');
    }

    function addOrder(order) {
        const orders = loadOrders();
        orders.push(order);
        writeList(ORDERS_KEY, orders.slice(-20));
        renderOrders();
    }

    function markButtonAdded(button) {
        if (!button || !button.classList.contains('cart-btn')) return;

        button.classList.add('is-added');
        setTimeout(() => button.classList.remove('is-added'), 1500);
    }

    function bindProductCards() {
        // делегирование: работает и для карточек, которые появляются позже (поиск)
        document.addEventListener('click', (event) => {
            const heart = event.target.closest('[data-id] .heart');
            const cartBtn = event.target.closest('[data-id] .cart-btn, [data-id] [data-add-to-cart]');
            const buyNow = event.target.closest('[data-id] [data-buy-now]');
            const button = heart || cartBtn || buyNow;
            if (!button) return;

            const product = getProductFromCard(button.closest('[data-id]'));
            if (!product) return;

            event.preventDefault();

            if (heart) {
                toggleFavorite(product);
                return;
            }

            if (buyNow) {
                if (!findCartItem(loadCart(), product.id)) addToCart(product);
                window.location.href = ROOT + 'checkout.html';
                return;
            }

            addToCart(product);
            markButtonAdded(cartBtn);
            UI.showToast('«' + product.title.replace(/^[^«]*«|»$/g, '') + '» добавлено в корзину');
        });
    }

    function bindModalLists() {
        const cartList = document.getElementById('cart-items-list');
        if (cartList) {
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
        if (favGrid) {
            favGrid.addEventListener('click', (event) => {
                const card = event.target.closest('[data-product-id]');
                if (!card) return;

                const id = card.getAttribute('data-product-id');

                if (event.target.closest('.favorite-heart')) {
                    removeFromFavorites(id);
                    return;
                }

                if (event.target.closest('[data-fav-action="to-cart"]')) {
                    const product = findProduct(id);
                    if (product) {
                        addToCart(product);
                        UI.showToast('Добавлено в корзину');
                    }
                }
            });
        }

        const profile = document.getElementById('profile-modal');
        if (profile) profile.addEventListener('modal:open', renderOrders);
    }

    // Корзина и избранное меняются в другой вкладке — обновляем и здесь
    window.addEventListener('storage', (event) => {
        if (event.key === CART_KEY) renderCart();
        if (event.key === FAV_KEY) {
            renderFavorites();
            syncProductHearts();
        }
    });

    window.SiteCart = {
        loadCart,
        clearCart,
        getCartTotal,
        findProduct,
        addOrder,
        renderCart,
        syncProductHearts
    };

    function init() {
        renderCart();
        renderFavorites();
        renderOrders();
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
