/*
 * widgets.js — інтерактивні компоненти: перемикач нагадувань і профіль (кабінет),
 * інтерактивна оцінка з лічильником символів (відгук).
 */
(function () {
  'use strict';
  const FZ = window.FitZone;
  if (!FZ) return;

  /* ---------- Особистий кабінет ---------- */
  const remind = document.getElementById('remind');
  if (remind) {
    remind.checked = FZ.store.get('fz_remind', true);
    remind.addEventListener('change', function () {
      FZ.store.set('fz_remind', remind.checked);
      FZ.toast(remind.checked ? 'Нагадування про заняття увімкнено' : 'Нагадування про заняття вимкнено');
    });
  }

  const profile = document.querySelector('.profile');
  const user = FZ.store.get('fz_user', null);
  if (profile && user) {
    const lines = profile.querySelectorAll('p');
    lines[0].textContent = user.name;
    lines[1].textContent = user.email;
    profile.querySelector('.avatar').textContent = user.name.charAt(0).toUpperCase();
  }

  /* ---------- Відгук ---------- */
  const rating = document.querySelector('.rating');
  if (rating) {
    const form = rating.closest('form');
    const comment = document.getElementById('comment');
    const MAX = 500;

    const text = document.createElement('p');
    text.className = 'caption center';
    text.setAttribute('aria-live', 'polite');
    rating.after(text);
    function showScore() {
      const checked = rating.querySelector('input:checked');
      text.textContent = checked ? 'Ваша оцінка: ' + checked.value + ' з 5' : 'Оберіть оцінку';
    }
    rating.addEventListener('change', showScore);
    showScore();

    comment.maxLength = MAX + 50; // жорстке обмеження більше за правило, щоб показати повідомлення
    const counter = document.createElement('p');
    counter.className = 'caption char-count';
    comment.after(counter);
    function count() { counter.textContent = comment.value.length + ' / ' + MAX; }
    comment.addEventListener('input', count);
    count();

    form.addEventListener('fz:valid', function () {
      const list = FZ.store.get('fz_reviews', []);
      list.push({
        score: Number(rating.querySelector('input:checked').value),
        comment: comment.value.trim(),
        date: new Date().toISOString().slice(0, 10)
      });
      FZ.store.set('fz_reviews', list);
      FZ.store.set('fz_reviewed', true);
      FZ.flash('Дякуємо за відгук!');
    });
  }
})();
