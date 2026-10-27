(function () {
    const form = document.getElementById('checkout-form');
    if (!form || !window.SiteCart) return;

    const UI = window.SiteUI;
    const Cart = window.SiteCart;

    const layout = document.getElementById('checkout-layout');
    const emptyBlock = document.getElementById('checkout-empty');
    const doneBlock = document.getElementById('checkout-done');
    const itemsBox = document.getElementById('checkout-items');
    const totalEl = document.getElementById('checkout-total');
    const addressField = document.getElementById('address-field');
    const addressInput = addressField.querySelector('textarea');

    function renderSummary() {
        const cart = Cart.loadCart();

        if (!cart.length) {
            layout.hidden = true;
            emptyBlock.hidden = false;
            return;
        }

        itemsBox.innerHTML = cart.map((item) => {
            const product = Cart.findProduct(item.id);
            return [
                '<div class="checkout-item">',
                '<img src="' + UI.escapeHtml(product.image) + '" alt="">',
                '<span>' + UI.escapeHtml(product.title) + ' × ' + item.qty + '</span>',
                '<strong>' + UI.formatPrice(product.price * item.qty) + '</strong>',
                '</div>'
            ].join('');
        }).join('');

        totalEl.textContent = UI.formatPrice(Cart.getCartTotal(cart));
    }

    // Адрес нужен только при доставке
    function updateAddressField() {
        const delivery = form.querySelector('input[name="delivery"]:checked');
        const needAddress = delivery && delivery.value !== 'Самовывоз из мастерской в Ростове';
        addressField.hidden = !needAddress;
        addressInput.required = needAddress;
    }

    function makeOrderNumber() {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        return String(now.getFullYear()).slice(2) + pad(now.getMonth() + 1) + pad(now.getDate()) + '-' +
            String(Math.floor(Math.random() * 900) + 100);
    }

    function buildOrderText(number, cart) {
        const lines = cart.map((item) => {
            const product = Cart.findProduct(item.id);
            return '— ' + product.title + ' × ' + item.qty + ' = ' + UI.formatPrice(product.price * item.qty);
        });

        return 'Заказ № ' + number + '\n' + lines.join('\n') + '\nИтого: ' + UI.formatPrice(Cart.getCartTotal(cart));
    }

    form.querySelectorAll('input[name="delivery"]').forEach((input) => {
        input.addEventListener('change', updateAddressField);
    });

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        if (!UI.validateForm(form)) return;

        const cart = Cart.loadCart();
        if (!cart.length) {
            renderSummary();
            return;
        }

        const number = makeOrderNumber();
        const orderText = buildOrderText(number, cart);

        UI.sendForm(form, 'Новый заказ № ' + number, orderText).then((sent) => {
            if (!sent) return;

            Cart.addOrder({
                number: number,
                date: new Date().toLocaleDateString('ru-RU'),
                items: cart.map((item) => Cart.findProduct(item.id).title + ' × ' + item.qty),
                total: Cart.getCartTotal(cart)
            });
            Cart.clearCart();

            layout.hidden = true;
            doneBlock.hidden = false;
            if (UI.data.config.demoMode) {
                document.getElementById('checkout-done-title').textContent = 'Заказ оформлен (демо-режим)';
            }
            document.getElementById('checkout-done-text').textContent = 'Номер заказа: ' + number + '. ' +
                (UI.data.config.demoMode
                    ? 'Это демо-версия сайта, поэтому заказ никуда не отправлен. '
                    : 'Мы свяжемся с вами в течение рабочего дня, чтобы подтвердить заказ и согласовать доставку. ') +
                'Заказ сохранён в разделе «Заказы на этом устройстве» (иконка с чеком в шапке).';
            doneBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    });

    updateAddressField();
    renderSummary();
})();
