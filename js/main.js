/*
 * main.js — спільна логіка для всіх сторінок FitZone:
 * сховище, сповіщення (toast), адаптивне меню, модальні вікна.
 * Підключається першим; інші скрипти використовують об’єкт window.FitZone.
 */
(function () {
  'use strict';

  document.documentElement.classList.add('js');

  /* ---------- Сховище (localStorage / sessionStorage з обробкою помилок) ---------- */
  function createStore(area) {
    return {
      get(key, fallback) {
        try {
          const raw = window[area].getItem(key);
          return raw === null ? fallback : JSON.parse(raw);
        } catch (err) {
          return fallback;
        }
      },
      set(key, value) {
        try {
          window[area].setItem(key, JSON.stringify(value));
          return true;
        } catch (err) {
          return false;
        }
      },
      remove(key) {
        try { window[area].removeItem(key); } catch (err) { /* ignore */ }
      }
    };
  }
  const store = createStore('localStorage');
  const session = createStore('sessionStorage');

  /* ---------- Сповіщення ---------- */
  let toastBox = null;
  function toast(message, type) {
    if (!toastBox) {
      toastBox = document.createElement('div');
      toastBox.className = 'toast-box';
      toastBox.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastBox);
    }
    const item = document.createElement('p');
    item.className = 'toast' + (type === 'error' ? ' toast--error' : '');
    item.textContent = (type === 'error' ? '✕ ' : '✓ ') + message;
    toastBox.appendChild(item);
    setTimeout(function () { item.classList.add('toast--hide'); }, 3200);
    setTimeout(function () { item.remove(); }, 3700);
  }

  /* Повідомлення, яке треба показати після переходу на іншу сторінку */
  function flash(message, type) { session.set('fz_flash', { message: message, type: type || 'ok' }); }
  function showFlash() {
    const data = session.get('fz_flash', null);
    if (data) {
      session.remove('fz_flash');
      toast(data.message, data.type);
    }
  }

  /* ---------- Навігація ---------- */
  function initNav() {
    const nav = document.querySelector('.navbar');
    if (!nav) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'nav-toggle';
    button.setAttribute('aria-expanded', 'false');
    button.textContent = '☰ Меню';
    nav.prepend(button);

    function setOpen(open) {
      nav.classList.toggle('is-open', open);
      button.setAttribute('aria-expanded', String(open));
      button.textContent = open ? '✕ Закрити' : '☰ Меню';
    }
    button.addEventListener('click', function () { setOpen(!nav.classList.contains('is-open')); });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) { setOpen(false); button.focus(); }
    });
    window.matchMedia('(min-width: 769px)').addEventListener('change', function (e) {
      if (e.matches) setOpen(false);
    });

    /* Авторизований користувач (навбар містить «Мої бронювання») бачить пункт «Вийти» */
    const main = nav.querySelector('.nav-main');
    if (main && nav.querySelector('a[href="my-bookings.html"]')) {
      const li = document.createElement('li');
      const out = document.createElement('a');
      out.href = 'index.html';
      out.textContent = 'Вийти';
      out.addEventListener('click', function (e) {
        e.preventDefault();
        store.remove('fz_user');
        flash('Ви вийшли з акаунту');
        window.location.href = 'index.html';
      });
      li.appendChild(out);
      main.appendChild(li);
    }
  }

  /* ---------- Модальні вікна ---------- */
  let activeModal = null;
  let lastFocus = null;
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

  function openModal(id, trigger) {
    const modal = document.getElementById(id);
    if (!modal || !modal.classList.contains('modal')) return null;
    if (activeModal) closeModal();
    lastFocus = trigger || document.activeElement;
    /* Сторінкові скрипти підставляють у вікно дані перед показом */
    modal.dispatchEvent(new CustomEvent('modal:open', { bubbles: true, detail: { trigger: trigger || null } }));
    modal.classList.add('is-open');
    document.body.classList.add('modal-lock');
    activeModal = modal;
    const first = modal.querySelector(FOCUSABLE);
    if (first) first.focus();
    return modal;
  }

  function closeModal() {
    if (!activeModal) return;
    activeModal.classList.remove('is-open');
    document.body.classList.remove('modal-lock');
    activeModal = null;
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }

  function initModals() {
    document.addEventListener('click', function (e) {
      if (e.defaultPrevented) return;
      /* клік по затемненню закриває вікно */
      if (e.target.classList && e.target.classList.contains('modal')) { closeModal(); return; }
      const link = e.target.closest('a[href^="#"]');
      if (!link) return;
      const id = link.getAttribute('href').slice(1);
      if (id === '') {
        if (link.closest('.modal')) { e.preventDefault(); closeModal(); }
        return;
      }
      const target = document.getElementById(id);
      if (target && target.classList.contains('modal')) {
        e.preventDefault();
        openModal(id, link);
      }
    });

    document.addEventListener('keydown', function (e) {
      if (!activeModal) return;
      if (e.key === 'Escape') { closeModal(); return; }
      if (e.key === 'Tab') {
        const items = Array.prototype.filter.call(activeModal.querySelectorAll(FOCUSABLE), function (el) {
          return el.offsetParent !== null;
        });
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  window.FitZone = { store: store, session: session, toast: toast, flash: flash, openModal: openModal, closeModal: closeModal };

  initNav();
  initModals();

  /* DOMContentLoaded настає після виконання всіх відкладених скриптів,
     тому обробники modal:open з інших файлів уже зареєстровані. */
  document.addEventListener('DOMContentLoaded', function () {
    showFlash();
    const id = window.location.hash.slice(1);
    if (id && openModal(id, null)) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  });
})();
