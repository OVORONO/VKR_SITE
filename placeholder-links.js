(function () {
    const DEFAULT_MESSAGE = 'Раздел временно недоступен.';

    const MESSAGE_BY_CLASS = {
        'certificate-banner': 'В данный момент подарочных сертификатов нет.',
        'sale-banner': 'В данный момент акций нет.'
    };

    const MESSAGE_BY_TEXT = {
        'доставка': 'Информация о доставке скоро появится на сайте.',
        'возврат': 'Информация о возврате скоро появится на сайте.',
        'cookies': 'Раздел о cookies скоро будет доступен.',
        'политика конфиденциальности': 'Политика конфиденциальности скоро будет опубликована.',
        'отзывы об услуге': 'Отзывы об услуге скоро будут доступны.',
        'записаться на мастер-класс': 'Запись на мастер-классы временно недоступна.',
        'оформить заказ': 'Оформление заказа временно недоступно.',
        'зарегистрироваться': 'Регистрация временно недоступна.',
        'забыли пароль?': 'Восстановление пароля временно недоступно.'
    };

    function normalizeText(value) {
        return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
    }

    function getMessage(link) {
        for (const className of link.classList) {
            if (MESSAGE_BY_CLASS[className]) {
                return MESSAGE_BY_CLASS[className];
            }
        }

        const text = normalizeText(link.textContent);
        if (MESSAGE_BY_TEXT[text]) {
            return MESSAGE_BY_TEXT[text];
        }

        if (text.includes('подароч')) {
            return MESSAGE_BY_CLASS['certificate-banner'];
        }

        if (text.includes('акци')) {
            return MESSAGE_BY_CLASS['sale-banner'];
        }

        return DEFAULT_MESSAGE;
    }

    function shouldSkipLink(link) {
        if (!link || link.tagName !== 'A') {
            return true;
        }

        const href = (link.getAttribute('href') || '').trim();
        if (href !== '#') {
            return true;
        }

        if (link.closest('.modal-close') || link.classList.contains('modal-close')) {
            return true;
        }

        if (link.hasAttribute('for')) {
            return true;
        }

        return false;
    }

    function ensureModal() {
        let modal = document.getElementById('placeholder-modal');

        if (modal) {
            return modal;
        }

        modal = document.createElement('dialog');
        modal.id = 'placeholder-modal';
        modal.className = 'site-modal placeholder-modal';
        modal.innerHTML = [
            '<div class="modal-inner">',
            '  <button class="modal-close" type="button" aria-label="Закрыть">×</button>',
            '  <h2>Сообщение</h2>',
            '  <p class="placeholder-modal-text"></p>',
            '  <button class="modal-main-btn placeholder-modal-ok" type="button">Понятно</button>',
            '</div>'
        ].join('');

        document.body.appendChild(modal);

        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.close();
            }
        });

        modal.addEventListener('close', () => {
            document.body.classList.remove('modal-is-open');
        });

        modal.querySelector('.modal-close').addEventListener('click', () => modal.close());
        modal.querySelector('.placeholder-modal-ok').addEventListener('click', () => modal.close());

        return modal;
    }

    function openPlaceholderModal(message) {
        const modal = ensureModal();
        modal.querySelector('.placeholder-modal-text').textContent = message;
        modal.showModal();
        document.body.classList.add('modal-is-open');
    }

    document.querySelectorAll('a[href="#"]').forEach((link) => {
        if (shouldSkipLink(link)) {
            return;
        }

        link.addEventListener('click', (event) => {
            event.preventDefault();
            openPlaceholderModal(getMessage(link));
        });
    });

    document.querySelectorAll('form[action="#"]').forEach((form) => {
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            openPlaceholderModal('Отправка формы временно недоступна.');
        });
    });
})();
