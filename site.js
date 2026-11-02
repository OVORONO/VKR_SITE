(function () {
    const ROOT = document.body.dataset.root || '';
    const DATA = window.SITE_DATA || { config: {}, products: [] };
    const COOKIE_KEY = 'rostov-cookie-consent';
    // Ключи корзины, избранного и заказов — те же, что в cart-favorites.js
    const CART_STORAGE_KEY = 'rostov-cart';
    const FAV_STORAGE_KEY = 'rostov-favorites';
    const ORDERS_STORAGE_KEY = 'rostov-orders';

    function formatPrice(amount) {
        return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽';
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function storageGet(key) {
        try {
            return localStorage.getItem(key);
        } catch {
            return null;
        }
    }

    function storageSet(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch {
            // хранилище недоступно (приватный режим) — работаем без него
        }
    }

    function storageRemove(key) {
        try {
            localStorage.removeItem(key);
        } catch {
            // хранилище недоступно
        }
    }

    /* ---------- Модальные окна ---------- */

    function openModal(id) {
        const modal = document.getElementById(id);
        if (!modal || typeof modal.showModal !== 'function') return;

        document.querySelectorAll('dialog.site-modal[open]').forEach((opened) => {
            if (opened !== modal) opened.close();
        });

        if (!modal.open) modal.showModal();
        document.body.classList.add('modal-is-open');
        modal.dispatchEvent(new CustomEvent('modal:open'));
    }

    function closeModal(modal) {
        if (modal && modal.open) modal.close();
    }

    function bindModals() {
        document.addEventListener('click', (event) => {
            const opener = event.target.closest('[data-open-modal]');
            if (opener) {
                event.preventDefault();
                openModal(opener.dataset.openModal);
                hideToast();
                return;
            }

            const closer = event.target.closest('[data-close-modal]');
            if (closer) {
                closeModal(closer.closest('dialog'));
            }
        });

        document.querySelectorAll('dialog.site-modal').forEach((modal) => {
            // клик по затемнённому фону закрывает окно
            modal.addEventListener('click', (event) => {
                if (event.target === modal) modal.close();
            });

            modal.addEventListener('close', () => {
                if (!document.querySelector('dialog.site-modal[open]')) {
                    document.body.classList.remove('modal-is-open');
                }
            });
        });
    }

    // actions: [{ text, href, primary }]
    function showMessage(title, text, actions) {
        const modal = document.getElementById('message-modal');
        if (!modal) {
            alert(title + '\n\n' + text);
            return;
        }

        modal.querySelector('#message-modal-title').textContent = title;
        modal.querySelector('#message-modal-text').textContent = text;

        const box = modal.querySelector('#message-modal-actions');
        const list = actions && actions.length ? actions : [{ text: 'Понятно', primary: true }];

        box.innerHTML = list.map((action) => {
            const cls = action.primary ? 'modal-main-btn' : 'modal-light-btn';
            if (action.href) {
                return '<a class="' + cls + '" href="' + escapeHtml(action.href) + '"' +
                    (action.external ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + escapeHtml(action.text) + '</a>';
            }
            return '<button type="button" class="' + cls + '" data-close-modal>' + escapeHtml(action.text) + '</button>';
        }).join('');

        openModal('message-modal');
    }

    /* ---------- Уведомление «Добавлено» ---------- */

    let toastTimer = null;

    function showToast(text) {
        const toast = document.getElementById('toast');
        if (!toast) return;

        toast.querySelector('#toast-text').textContent = text;
        toast.classList.add('is-visible');

        clearTimeout(toastTimer);
        toastTimer = setTimeout(hideToast, 3500);
    }

    function hideToast() {
        const toast = document.getElementById('toast');
        if (toast) toast.classList.remove('is-visible');
    }

    /* ---------- Мобильное меню и поиск ---------- */

    function bindHeader() {
        const header = document.querySelector('.header');
        if (!header) return;

        const burger = header.querySelector('.burger');
        const searchToggle = header.querySelector('.search-toggle');

        // Esc закрывает мобильное меню и строку поиска и возвращает фокус на кнопку, которая их открыла
        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape' || document.querySelector('dialog.site-modal[open]')) return;

            if (header.classList.contains('menu-is-open') && burger) {
                burger.click();
                burger.focus();
            } else if (header.classList.contains('search-is-open') && searchToggle) {
                searchToggle.click();
                searchToggle.focus();
            }
        });

        if (burger) {
            burger.addEventListener('click', () => {
                const open = header.classList.toggle('menu-is-open');
                header.classList.remove('search-is-open');
                burger.setAttribute('aria-expanded', open ? 'true' : 'false');
                burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
                burger.textContent = open ? '✕' : '☰';
            });
        }

        if (searchToggle) {
            searchToggle.addEventListener('click', () => {
                const open = header.classList.toggle('search-is-open');
                header.classList.remove('menu-is-open');
                searchToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
                if (burger) {
                    burger.setAttribute('aria-expanded', 'false');
                    burger.textContent = '☰';
                }

                if (open) {
                    const input = header.querySelector('.mobile-search input');
                    if (input) input.focus();
                }
            });
        }
    }

    /* ---------- Cookies и Яндекс.Метрика ---------- */

    function loadMetrika() {
        const id = DATA.config.yandexMetrikaId;
        if (!id || window.ym) return;

        /* eslint-disable */
        (function (m, e, t, r, i, k, a) {
            m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
            m[i].l = 1 * new Date();
            k = e.createElement(t); a = e.getElementsByTagName(t)[0];
            k.async = 1; k.src = r; a.parentNode.insertBefore(k, a);
        })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym');
        /* eslint-enable */

        window.ym(Number(id), 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: false });
    }

    function bindCookieBanner() {
        const banner = document.getElementById('cookie-banner');
        const consent = storageGet(COOKIE_KEY);

        // cookies.html: «Сбросить мой выбор» — плашка с выбором появится снова
        const reset = document.getElementById('reset-cookie-choice');
        if (reset) {
            reset.addEventListener('click', () => {
                storageRemove(COOKIE_KEY);
                location.reload();
            });
        }

        if (consent === 'all') loadMetrika();
        // Без аналитики сайт хранит только то, без чего не работают корзина и избранное, —
        // спрашивать согласие не о чем, поэтому плашку показываем, только если подключена Метрика
        if (!banner || consent || !DATA.config.yandexMetrikaId) return;

        banner.hidden = false;
        banner.addEventListener('click', (event) => {
            const button = event.target.closest('[data-cookie]');
            if (!button) return;

            storageSet(COOKIE_KEY, button.dataset.cookie);
            banner.hidden = true;
            if (button.dataset.cookie === 'all') loadMetrika();
        });
    }

    /* ---------- Формы ---------- */

    function normalizePhone(value) {
        let digits = String(value).replace(/\D/g, '');
        if (digits.length === 11 && (digits[0] === '8' || digits[0] === '7')) digits = digits.slice(1);
        if (digits.length !== 10) return null;
        return '+7 (' + digits.slice(0, 3) + ') ' + digits.slice(3, 6) + '-' + digits.slice(6, 8) + '-' + digits.slice(8, 10);
    }

    function setFieldError(field, message) {
        const wrap = field.closest('.form-field, .form-consent') || field.parentElement;
        let error = wrap.querySelector('.form-error');

        field.classList.toggle('is-invalid', Boolean(message));
        field.setAttribute('aria-invalid', message ? 'true' : 'false');

        if (!message) {
            if (error) error.remove();
            return;
        }

        if (!error) {
            error = document.createElement('span');
            error.className = 'form-error';
            wrap.appendChild(error);
        }
        error.textContent = message;
    }

    function validateForm(form) {
        let firstInvalid = null;

        form.querySelectorAll('input, textarea, select').forEach((field) => {
            if (field.type === 'hidden' || field.closest('.form-hp')) return;

            let message = '';
            const value = field.type === 'checkbox' ? field.checked : field.value.trim();

            if (field.required && !value) {
                message = field.type === 'checkbox' ? 'Нужно ваше согласие' : 'Заполните это поле';
            } else if (field.type === 'tel' && value) {
                const phone = normalizePhone(value);
                if (phone) {
                    field.value = phone;
                } else {
                    message = 'Введите номер в формате +7 (900) 000-00-00';
                }
            } else if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                message = 'Проверьте адрес почты';
            }

            setFieldError(field, message);
            if (message && !firstInvalid) firstInvalid = field;
        });

        // data-one-of="contact": телефон или e-mail — достаточно заполнить одно из полей группы
        const groups = {};
        form.querySelectorAll('[data-one-of]').forEach((field) => {
            (groups[field.dataset.oneOf] = groups[field.dataset.oneOf] || []).push(field);
        });
        Object.values(groups).forEach((fields) => {
            if (fields.some((field) => field.value.trim())) return;
            setFieldError(fields[0], 'Укажите телефон или e-mail');
            if (!firstInvalid) firstInvalid = fields[0];
        });

        if (firstInvalid) firstInvalid.focus();
        return !firstInvalid;
    }

    function formToText(form) {
        const lines = [];

        form.querySelectorAll('[name]').forEach((field) => {
            if (field.closest('.form-hp') || field.type === 'checkbox' || !field.value.trim()) return;
            if (field.type === 'radio' && !field.checked) return;
            if (field.closest('[hidden]')) return;
            const label = field.dataset.label || field.name;
            const value = field.tagName === 'SELECT' ? field.options[field.selectedIndex].text : field.value.trim();
            lines.push(label + ': ' + value);
        });

        return lines.join('\n');
    }

    // Ошибки, которые нашёл send.php: подсвечиваем поля так же, как при проверке в браузере
    function showServerFieldErrors(form, error) {
        const checks = error === 'email'
            ? [['email', (field) => field.value.trim(), 'Проверьте адрес почты']]
            : [
                ['name', (field) => !field.value.trim(), 'Заполните это поле'],
                // в форме вопроса хватает телефона или e-mail, в заказе телефон обязателен
                ['phone', (field) => !field.value.trim() && (field.required || !(form.querySelector('[name="email"]') || field).value.trim()),
                    (field) => (field.required ? 'Заполните это поле' : 'Укажите телефон или e-mail')],
                ['consent', (field) => !field.checked, 'Нужно ваше согласие']
            ];
        let firstInvalid = null;

        checks.forEach(([name, isInvalid, message]) => {
            const field = form.querySelector('[name="' + name + '"]');
            if (!field || !isInvalid(field)) return;
            setFieldError(field, typeof message === 'function' ? message(field) : message);
            if (!firstInvalid) firstInvalid = field;
        });

        if (firstInvalid) {
            firstInvalid.focus();
        } else {
            showMessage('Проверьте форму', 'Заполните имя и телефон или e-mail, отметьте согласие на обработку данных и отправьте заявку ещё раз.');
        }
    }

    // Отправка на send.php. Если сервер недоступен (например, сайт открыт с диска),
    // предлагаем отправить ту же заявку письмом.
    // extraText попадает только в такое письмо, extraFields уходят на сервер.
    // Результат — ответ сервера ({ ok: true, ... }) или false, если отправить не удалось.
    function sendForm(form, subject, extraText, extraFields) {
        // Демо для портфолио: ничего не отправляем, сразу показываем успешный сценарий
        if (DATA.config.demoMode) return Promise.resolve({ ok: true });

        const formData = new FormData(form);
        formData.append('subject', subject);
        formData.append('page', location.href);
        Object.keys(extraFields || {}).forEach((key) => formData.append(key, extraFields[key]));

        const button = form.querySelector('[type="submit"]');
        if (button) {
            button.disabled = true;
            button.dataset.text = button.textContent;
            button.textContent = 'Отправляем…';
        }

        return fetch(ROOT + 'send.php', { method: 'POST', body: formData, headers: { Accept: 'application/json' } })
            .then((response) => (response.ok || response.status === 429 ? response.json() : Promise.reject(new Error('http'))))
            .then((json) => {
                if (json && json.ok) return json;
                // Сервер отклонил данные — письмом это не исправить, просим поправить форму
                if (json && (json.error === 'required' || json.error === 'email')) {
                    showServerFieldErrors(form, json.error);
                    return false;
                }
                if (json && json.error === 'order') {
                    showMessage('Проверьте корзину', 'Каталог мог обновиться: в корзине есть изделие, которого больше нет. Обновите страницу и оформите заказ ещё раз.');
                    return false;
                }
                // send.php ограничивает число заявок с одного адреса
                if (json && json.error === 'rate') {
                    showMessage('Слишком много заявок', 'С вашего адреса уже отправлено несколько заявок подряд. Попробуйте через 10 минут или позвоните нам: ' + DATA.config.phone + '.');
                    return false;
                }
                throw new Error('send');
            })
            .catch(() => {
                const body = formToText(form) + (extraText ? '\n\n' + extraText : '');
                const mailto = 'mailto:' + DATA.config.email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);

                showMessage(
                    'Отправьте заявку письмом',
                    'Не получилось отправить заявку автоматически. Нажмите «Отправить письмо» — откроется почта с уже заполненным текстом. Или позвоните нам: ' + DATA.config.phone + '.',
                    [
                        { text: 'Отправить письмо', href: mailto, primary: true },
                        { text: 'Позвонить', href: 'tel:' + DATA.config.phoneHref }
                    ]
                );
                return false;
            })
            .finally(() => {
                if (button) {
                    button.disabled = false;
                    button.textContent = button.dataset.text;
                }
            });
    }

    function bindForms() {
        // contacts.html?topic=repair — сразу выбираем нужную тему обращения
        const topic = new URLSearchParams(location.search).get('topic');

        document.querySelectorAll('form[data-form]').forEach((form) => {
            form.setAttribute('novalidate', '');

            const topicSelect = form.querySelector('select[name="topic"]');
            if (topic && topicSelect && topicSelect.querySelector('option[value="' + CSS.escape(topic) + '"]')) {
                topicSelect.value = topic;
            }

            form.querySelectorAll('input[type="tel"]').forEach((input) => {
                input.addEventListener('blur', () => {
                    const phone = normalizePhone(input.value);
                    if (phone) input.value = phone;
                });
            });

            // формы заказа обрабатывает checkout.js
            if (form.dataset.form === 'order') return;

            form.addEventListener('submit', (event) => {
                event.preventDefault();
                if (!validateForm(form)) return;

                const subject = form.dataset.subject || 'Сообщение с сайта';
                sendForm(form, subject).then((sent) => {
                    if (!sent) return;
                    form.reset();
                    showMessage('Спасибо!', DATA.config.demoMode
                        ? 'Это демо-версия сайта: сообщение никуда не отправлено. В настоящем магазине его получила бы мастерская.'
                        : 'Сообщение отправлено. Мы ответим в течение рабочего дня.');
                });
            });
        });
    }

    /* ---------- Удаление данных и карта ---------- */

    // «Удалить мои данные с этого устройства»: корзина, избранное, заказы и выбор о cookies
    function bindDataRemoval() {
        document.querySelectorAll('[data-clear-site-data]').forEach((button) => {
            button.addEventListener('click', () => {
                [CART_STORAGE_KEY, FAV_STORAGE_KEY, ORDERS_STORAGE_KEY, COOKIE_KEY].forEach(storageRemove);
                showMessage('Данные удалены', 'Корзина, избранное, список заказов и ваш выбор о cookies удалены из этого браузера.');
                document.dispatchEvent(new CustomEvent('site:data-cleared'));
            });
        });
    }

    // Карта Яндекса появляется только после нажатия «Показать карту»
    function bindMap() {
        document.querySelectorAll('[data-map-src]').forEach((box) => {
            const button = box.querySelector('[data-show-map]');
            if (!button) return;

            button.addEventListener('click', () => {
                const frame = document.createElement('iframe');
                frame.src = box.dataset.mapSrc;
                frame.title = box.dataset.mapTitle;
                frame.allowFullscreen = true;
                box.innerHTML = '';
                box.appendChild(frame);
            });
        });
    }

    window.SiteUI = {
        root: ROOT,
        data: DATA,
        formatPrice,
        escapeHtml,
        storageGet,
        storageSet,
        openModal,
        showMessage,
        showToast,
        validateForm,
        sendForm,
        formToText
    };

    bindModals();
    bindHeader();
    bindCookieBanner();
    bindForms();
    bindDataRemoval();
    bindMap();
})();
