(function () {
    const photo = document.querySelector('[data-zoom]');
    if (!photo) return;

    // Окно с увеличенным фото: покупатель может рассмотреть роспись
    function ensureModal() {
        let modal = document.getElementById('image-modal');
        if (modal) return modal;

        modal = document.createElement('dialog');
        modal.id = 'image-modal';
        modal.className = 'site-modal image-modal';
        modal.setAttribute('aria-label', 'Фото изделия');
        modal.innerHTML = [
            '<section class="modal-window">',
            '<button class="modal-close" type="button" data-close-modal aria-label="Закрыть">×</button>',
            '<img alt="">',
            '</section>'
        ].join('');

        modal.addEventListener('click', (event) => {
            if (event.target === modal) modal.close();
        });
        modal.addEventListener('close', () => document.body.classList.remove('modal-is-open'));

        document.body.appendChild(modal);
        return modal;
    }

    photo.addEventListener('click', () => {
        const modal = ensureModal();
        const img = modal.querySelector('img');
        const source = photo.querySelector('img');

        img.src = photo.dataset.zoom;
        img.alt = source ? source.alt : '';
        modal.showModal();
        document.body.classList.add('modal-is-open');
    });
})();
