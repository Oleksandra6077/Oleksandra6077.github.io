/*
 * booking.js — сценарій бронювання: розклад із фільтрами, вікно бронювання,
 * оплата з таймером резервування, підтвердження, скасування у «Моїх бронюваннях».
 */
(function () {
  'use strict';
  const FZ = window.FitZone;
  if (!FZ) return;

  const DEFAULT_DATE = '05.10.2026'; // дата занять із прототипу
  const RESERVE_MINUTES = 15;

  const norm = function (s) { return s.replace(/^0/, '').trim(); };

  /* Дані заняття з картки: «09:00 · Йога», «Тренер: Олена К.» */
  function readCard(card) {
    const parts = card.querySelector('.card-title').textContent.split(' · ');
    const trainer = card.querySelector('.trainer').textContent.replace(/^Тренер:\s*/, '').trim();
    return {
      time: parts[0].trim(),
      kind: (parts[1] || '').trim(),
      trainer: trainer,
      date: DEFAULT_DATE,
      seats: Number(card.dataset.seats) || null
    };
  }

  function period(time) {
    const hour = Number(time.split(':')[0]);
    return hour < 12 ? 'Ранок' : hour < 18 ? 'День' : 'Вечір';
  }

  /* ---------- Розклад: фільтри та вікно бронювання ---------- */
  const filters = document.querySelector('.filters');
  const grid = document.querySelector('.class-grid[aria-label="Заняття"]');

  if (filters && grid) {
    const selects = filters.querySelectorAll('select');
    const cards = Array.prototype.slice.call(grid.querySelectorAll('.class-card'));
    const empty = document.createElement('p');
    empty.className = 'empty-message';
    empty.setAttribute('role', 'status');
    empty.hidden = true;
    empty.textContent = 'За вибраними фільтрами занять не знайдено. Змініть параметри пошуку.';
    grid.after(empty);

    function applyFilters() {
      const want = Array.prototype.map.call(selects, function (s) { return s.selectedIndex === 0 ? '' : s.value; });
      let visible = 0;
      cards.forEach(function (card) {
        const c = readCard(card);
        const ok = (!want[0] || c.kind === want[0]) && (!want[1] || c.trainer === want[1]) && (!want[2] || period(c.time) === want[2]);
        card.hidden = !ok;
        if (ok) visible++;
      });
      empty.hidden = visible > 0;
    }
    filters.addEventListener('change', applyFilters);
    filters.addEventListener('submit', function (e) { e.preventDefault(); });
  }

  /* Картка зі сторінки (розклад або головна) запам’ятовується як вибране заняття */
  document.addEventListener('click', function (e) {
    const link = e.target.closest('.class-card a.btn[href$="#booking"]');
    if (!link) return;
    FZ.session.set('fz_selected', readCard(link.closest('.class-card')));
  });

  /* Заповнення вікна бронювання вибраним заняттям */
  document.addEventListener('modal:open', function (e) {
    if (e.target.id !== 'booking') return;
    const sel = FZ.session.get('fz_selected', null);
    if (!sel) return;
    document.getElementById('booking-class').textContent = sel.kind + ' · ' + sel.date + ' · ' + sel.time;
    document.getElementById('booking-trainer').textContent = 'Тренер: ' + sel.trainer;
    document.getElementById('booking-seats').textContent = sel.seats ? '● Вільно ' + sel.seats + ' місць' : '● Вільно';
  });

  const toPayment = document.querySelector('#booking a[href="payment.html"]');
  if (toPayment) {
    toPayment.addEventListener('click', function () {
      FZ.session.set('fz_reserve_until', Date.now() + RESERVE_MINUTES * 60 * 1000);
    });
  }

  /* ---------- Оплата ---------- */
  const checkout = document.querySelector('.checkout');
  if (checkout) {
    const sel = FZ.session.get('fz_selected', null);

    function setSelect(select, value) {
      let option = Array.prototype.find.call(select.options, function (o) { return norm(o.textContent) === norm(value); });
      if (!option) {
        option = new Option(value, value);
        select.add(option);
      }
      select.value = option.value;
    }
    if (sel) {
      setSelect(document.getElementById('kind'), sel.kind);
      setSelect(document.getElementById('date'), sel.date);
      setSelect(document.getElementById('time'), sel.time);
      setSelect(document.getElementById('coach'), sel.trainer);
    }

    /* Таймер резервування місця */
    let until = FZ.session.get('fz_reserve_until', null);
    if (!until) {
      until = Date.now() + RESERVE_MINUTES * 60 * 1000;
      FZ.session.set('fz_reserve_until', until);
    }
    const notice = document.createElement('p');
    notice.className = 'notice countdown';
    notice.innerHTML = 'Місце зарезервовано ще на <strong id="countdown" aria-live="off"></strong>';
    checkout.querySelector('fieldset').after(notice);
    const out = notice.querySelector('strong');
    const submit = checkout.querySelector('button[type="submit"]');
    let expired = false;

    function tick() {
      const left = Math.max(0, Math.round((until - Date.now()) / 1000));
      out.textContent = String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0');
      if (left === 0 && !expired) {
        expired = true;
        clearInterval(timer);
        submit.disabled = true;
        notice.classList.add('notice--muted');
        notice.textContent = '✕ Час резервування минув. Поверніться до розкладу й оберіть заняття знову.';
        FZ.toast('Час резервування минув', 'error');
      }
    }
    const timer = setInterval(tick, 1000);
    tick();

    checkout.addEventListener('fz:valid', function () {
      const booking = {
        id: 'u' + Date.now(),
        kind: document.getElementById('kind').value,
        date: document.getElementById('date').value.replace(/^(\d)\./, '0$1.'),
        time: document.getElementById('time').value.replace(/^(\d):/, '0$1:'),
        trainer: document.getElementById('coach').value
      };
      const list = FZ.store.get('fz_bookings', []);
      list.push(booking);
      FZ.store.set('fz_bookings', list);
      FZ.session.set('fz_last', booking);
      FZ.session.remove('fz_reserve_until');
    });
  }

  /* ---------- Підтвердження ---------- */
  const confirmBox = document.querySelector('.confirm');
  if (confirmBox) {
    const last = FZ.session.get('fz_last', null);
    const user = FZ.store.get('fz_user', null);
    const lines = confirmBox.querySelectorAll('p.caption');
    if (last && lines.length >= 2) {
      lines[0].textContent = last.kind + ' · ' + last.date + ' · ' + last.time + ' · Тренер ' + last.trainer;
      if (user) lines[1].textContent = 'Чек підтвердження надіслано на ' + user.email;
    }
  }

  /* ---------- Мої бронювання: скасування ---------- */
  const active = document.querySelector('section[aria-labelledby="active-title"] .list');
  if (active) {
    const cancelled = FZ.store.get('fz_cancelled', []);
    const HOURS_LIMIT = 3; // скасувати можна не пізніше ніж за 3 години до початку

    function addRow(b) {
      const li = document.createElement('li');
      li.className = 'row';
      li.dataset.id = b.id;
      li.dataset.hours = '48';
      const text = document.createElement('span');
      text.textContent = b.kind + ' · ' + b.date + ' · ' + b.time + ' · Тренер ' + b.trainer;
      const a = document.createElement('a');
      a.className = 'btn btn--secondary';
      a.href = '#cancel-ok';
      a.textContent = 'Скасувати';
      li.append(text, a);
      active.appendChild(li);
    }

    Array.prototype.forEach.call(active.querySelectorAll('li[data-id]'), function (li) {
      if (cancelled.includes(li.dataset.id)) li.remove();
    });
    FZ.store.get('fz_bookings', []).forEach(addRow);

    const emptyRow = document.createElement('li');
    emptyRow.className = 'row empty-message';
    emptyRow.textContent = 'Активних бронювань немає';
    function refreshEmpty() {
      const has = active.querySelector('li[data-id]');
      if (!has && !emptyRow.isConnected) active.appendChild(emptyRow);
      if (has && emptyRow.isConnected) emptyRow.remove();
    }
    refreshEmpty();

    let currentRow = null;

    function fillCancel(prefix, row) {
      const parts = row.querySelector('span').textContent.split(' · ');
      document.getElementById(prefix + '-class').textContent = parts.slice(0, 3).join(' · ');
      document.getElementById(prefix + '-trainer').textContent = 'Тренер: ' + (parts[3] || '').replace(/^Тренер\s*/, '');
    }

    /* Яке вікно показати, залежить від часу до початку заняття */
    document.addEventListener('click', function (e) {
      const link = e.target.closest('li[data-id] a[href^="#cancel"]');
      if (!link) return;
      e.preventDefault();
      e.stopPropagation(); // перехоплюємо раніше за загальний обробник модальних вікон
      currentRow = link.closest('li');
      const blocked = Number(currentRow.dataset.hours) < HOURS_LIMIT;
      const id = blocked ? 'cancel-blocked' : 'cancel-ok';
      fillCancel(blocked ? 'blocked' : 'cancel', currentRow);
      FZ.openModal(id, link);
    }, true);

    const confirmBtn = document.querySelector('#cancel-ok [data-action="confirm-cancel"]');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', function () {
        if (!currentRow) return;
        const id = currentRow.dataset.id;
        if (id.charAt(0) === 'u') {
          FZ.store.set('fz_bookings', FZ.store.get('fz_bookings', []).filter(function (b) { return b.id !== id; }));
        } else {
          const list = FZ.store.get('fz_cancelled', []);
          list.push(id);
          FZ.store.set('fz_cancelled', list);
        }
        currentRow.remove();
        currentRow = null;
        refreshEmpty();
        FZ.toast('Бронювання скасовано, кошти повернуто на баланс');
      });
    }

    /* Після залишеного відгуку кнопка в історії стає неактивною */
    if (FZ.store.get('fz_reviewed', false)) {
      const btn = document.querySelector('section[aria-labelledby="hist-title"] a[href="review.html"]');
      if (btn) {
        const done = document.createElement('span');
        done.className = 'btn btn--disabled';
        done.setAttribute('aria-disabled', 'true');
        done.textContent = 'Відгук залишено';
        btn.replaceWith(done);
      }
    }
  }
})();
