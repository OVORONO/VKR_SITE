(function () {
    const ROOT = document.body.dataset.root || '';
    const DATA = window.SITE_DATA || { config: {}, products: [] };
    const COOKIE_KEY = 'rostov-cookie-consent';

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

        if (consent === 'all') loadMetrika();
        if (!banner || consent) return;

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

    // Отправка на send.php. Если сервер недоступен (например, сайт открыт с диска),
    // предлагаем отправить ту же заявку письмом.
    function sendForm(form, subject, extraText) {
        const formData = new FormData(form);
        formData.append('subject', subject);
        formData.append('page', location.href);
        if (extraText) formData.append('details', extraText);

        const button = form.querySelector('[type="submit"]');
        if (button) {
            button.disabled = true;
            button.dataset.text = button.textContent;
            button.textContent = 'Отправляем…';
        }

        return fetch(ROOT + 'send.php', { method: 'POST', body: formData, headers: { Accept: 'application/json' } })
            .then((response) => (response.ok ? response.json() : Promise.reject(new Error('http'))))
            .then((json) => {
                if (!json || !json.ok) throw new Error('send');
                return true;
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
                    showMessage('Спасибо!', 'Сообщение отправлено. Мы ответим в течение рабочего дня.');
                });
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
})();
