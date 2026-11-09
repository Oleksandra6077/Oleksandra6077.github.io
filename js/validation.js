/*
 * validation.js — клієнтська перевірка форм (вхід, реєстрація, оплата, відгук).
 * Повідомлення про помилки виводяться під полем, поле отримує aria-invalid.
 */
(function () {
  'use strict';
  const FZ = window.FitZone;
  if (!FZ) return;

  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const NAME_WORD = /^[\p{L}][\p{L}'’-]*$/u;

  /* Алгоритм Луна для перевірки номера банківської картки */
  function luhn(digits) {
    let sum = 0;
    let double = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let d = Number(digits[i]);
      if (double) { d *= 2; if (d > 9) d -= 9; }
      sum += d;
      double = !double;
    }
    return sum % 10 === 0;
  }

  /* Кожне правило повертає текст помилки або порожній рядок */
  const rules = {
    email: function (v) {
      if (!v) return 'Введіть email';
      if (!EMAIL.test(v)) return 'Email має бути у форматі name@email.com';
      return '';
    },
    password: function (v, form) {
      if (!v) return 'Введіть пароль';
      if (form.querySelector('#name')) { // форма реєстрації
        if (v.length < 8 || !/\p{L}/u.test(v) || !/\d/.test(v)) {
          return 'Пароль має містити щонайменше 8 символів, літеру та цифру';
        }
      }
      return '';
    },
    name: function (v) {
      if (!v) return 'Введіть ім’я';
      if (v.length < 2 || !v.split(/\s+/).every(function (w) { return NAME_WORD.test(w); })) {
        return 'Ім’я має містити лише літери, пробіли та дефіси (мінімум 2 символи)';
      }
      return '';
    },
    num: function (v) {
      const digits = v.replace(/\s/g, '');
      if (!digits) return 'Введіть номер картки';
      if (!/^\d{16}$/.test(digits)) return 'Номер картки має містити 16 цифр';
      if (!luhn(digits)) return 'Номер картки введено неправильно';
      return '';
    },
    exp: function (v) {
      if (!v) return 'Введіть термін дії картки';
      const m = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(v);
      if (!m) return 'Термін дії вкажіть у форматі ММ/РР, наприклад 08/28';
      const now = new Date();
      const year = 2000 + Number(m[2]);
      const month = Number(m[1]);
      if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) {
        return 'Термін дії картки минув';
      }
      return '';
    },
    cvv: function (v) {
      if (!v) return 'Введіть CVV';
      if (!/^\d{3}$/.test(v)) return 'CVV складається з 3 цифр';
      return '';
    },
    owner: function (v) {
      if (!v) return 'Введіть ім’я власника картки';
      const words = v.split(/\s+/);
      if (words.length < 2 || !words.every(function (w) { return NAME_WORD.test(w); })) {
        return 'Вкажіть ім’я та прізвище літерами, наприклад Іван Петренко';
      }
      return '';
    },
    comment: function (v, form) {
      if (v.length > 500) return 'Коментар не повинен перевищувати 500 символів';
      const checked = form.querySelector('input[name="score"]:checked');
      if (checked && Number(checked.value) <= 2 && v.length < 10) {
        return 'Для низької оцінки опишіть, що не сподобалося (щонайменше 10 символів)';
      }
      return '';
    }
  };

  function valueOf(input) {
    return input.id === 'password' ? input.value : input.value.trim();
  }

  function errorBox(input) {
    const field = input.closest('.field');
    let box = field.querySelector('.field__error');
    if (!box) {
      box = document.createElement('p');
      box.className = 'field__error';
      box.id = input.id + '-error';
      box.setAttribute('role', 'alert');
      field.appendChild(box);
    }
    return box;
  }

  function setError(input, message) {
    const box = errorBox(input);
    if (message) {
      box.textContent = '✕ ' + message;
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', box.id);
    } else {
      box.remove();
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
    }
    return !message;
  }

  function validateField(input, form) {
    const rule = rules[input.id];
    return rule ? setError(input, rule(valueOf(input), form)) : true;
  }

  /* Маски введення для полів картки */
  function formatInput(input) {
    if (input.id === 'num') {
      const digits = input.value.replace(/\D/g, '').slice(0, 16);
      input.value = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
    } else if (input.id === 'exp') {
      let digits = input.value.replace(/\D/g, '').slice(0, 4);
      if (digits.length > 2) digits = digits.slice(0, 2) + '/' + digits.slice(2);
      input.value = digits;
    } else if (input.id === 'cvv') {
      input.value = input.value.replace(/\D/g, '').slice(0, 3);
    }
  }

  function initForm(form) {
    form.noValidate = true; // власні повідомлення замість браузерних
    const fields = Array.prototype.filter.call(form.querySelectorAll('input, textarea'), function (el) {
      return rules[el.id] && el.closest('.field');
    });

    form.addEventListener('input', function (e) {
      const input = e.target;
      if (!fields.includes(input)) return;
      formatInput(input);
      if (input.hasAttribute('aria-invalid')) validateField(input, form);
    });
    form.addEventListener('focusout', function (e) {
      if (fields.includes(e.target) && e.target.value !== '') validateField(e.target, form);
    });
    /* оцінка впливає на правило для коментаря */
    form.addEventListener('change', function (e) {
      const comment = form.querySelector('#comment');
      if (e.target.name === 'score' && comment && comment.hasAttribute('aria-invalid')) validateField(comment, form);
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      let firstInvalid = null;
      fields.forEach(function (input) {
        if (!validateField(input, form) && !firstInvalid) firstInvalid = input;
      });
      if (firstInvalid) {
        firstInvalid.focus();
        FZ.toast('Виправте помилки у формі', 'error');
        return;
      }
      /* Дані не передаються в адресному рядку: зберігаємо локально й переходимо за action */
      form.dispatchEvent(new CustomEvent('fz:valid', { bubbles: true }));
      window.location.href = form.getAttribute('action') || 'index.html';
    });
  }

  /* Вхід і реєстрація: запам’ятовуємо ім’я та email (пароль не зберігається) */
  document.addEventListener('fz:valid', function (e) {
    const form = e.target;
    const email = form.querySelector('#email');
    if (!email || !form.closest('.auth-card')) return;
    const nameInput = form.querySelector('#name');
    const prev = FZ.store.get('fz_user', null);
    let name;
    if (nameInput) {
      name = nameInput.value.trim();
    } else if (prev && prev.email === email.value.trim().toLowerCase()) {
      name = prev.name;
    } else {
      const local = email.value.trim().split('@')[0];
      name = local.charAt(0).toUpperCase() + local.slice(1);
    }
    FZ.store.set('fz_user', { name: name, email: email.value.trim().toLowerCase() });
    FZ.flash(nameInput ? 'Акаунт створено, ласкаво просимо, ' + name + '!' : 'Ви увійшли як ' + name);
  });

  Array.prototype.forEach.call(document.querySelectorAll('form'), function (form) {
    if (form.querySelector('input[id], textarea[id]') && !form.classList.contains('filters')) initForm(form);
  });
})();
