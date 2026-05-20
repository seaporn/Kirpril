(() => {
  'use strict';

  /**
   * Мои смены — компактный учет графика, смен и зарплаты.
   * Все данные хранятся локально в браузере пользователя.
   */

  const APP = Object.freeze({
    name: 'Мои смены',
    storageKey: 'shiftSalaryCompactV4',
    oldKeys: ['shiftSalaryCompactV3', 'shiftSalaryManualCleanV1'],
    defaults: Object.freeze({
      rate: 350,
      employeeName: 'Кириченко Александр',
      plannedStart: '10:00',
      plannedEnd: '22:00'
    })
  });

  const DAY_MINUTES = 24 * 60;
  const TOAST_DELAY = 2400;
  const RUB = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
  const ruMonths = new Map(Object.entries({
    январь: 0, января: 0,
    февраль: 1, февраля: 1,
    март: 2, марта: 2,
    апрель: 3, апреля: 3,
    май: 4, мая: 4,
    июнь: 5, июня: 5,
    июль: 6, июля: 6,
    август: 7, августа: 7,
    сентябрь: 8, сентября: 8,
    октябрь: 9, октября: 9,
    ноябрь: 10, ноября: 10,
    декабрь: 11, декабря: 11
  }));

  const $ = id => document.getElementById(id);
  const els = Object.freeze({
    topDate: $('topDate'),
    mainActionBtn: $('mainActionBtn'),
    todayStatus: $('todayStatus'),
    todayBadge: $('todayBadge'),
    todayInfo: $('todayInfo'),
    todayEarned: $('todayEarned'),
    allTotal: $('allTotal'),
    monthTotal: $('monthTotal'),
    monthPlanTotal: $('monthPlanTotal'),
    planTotalCard: $('planTotalCard'),
    monthTitle: $('monthTitle'),
    monthSubtitle: $('monthSubtitle'),
    calendarGrid: $('calendarGrid'),
    monthList: $('monthList'),
    prevMonthBtn: $('prevMonthBtn'),
    nextMonthBtn: $('nextMonthBtn'),
    todayBtn: $('todayBtn'),
    clearMonthBtn: $('clearMonthBtn'),
    settingsBtn: $('settingsBtn'),
    workDialog: $('workDialog'),
    workForm: $('workForm'),
    closeWorkBtn: $('closeWorkBtn'),
    dialogDate: $('dialogDate'),
    plannedHint: $('plannedHint'),
    actualStart: $('actualStart'),
    actualEnd: $('actualEnd'),
    rateInput: $('rateInput'),
    salaryPreview: $('salaryPreview'),
    hoursPreview: $('hoursPreview'),
    deleteShiftBtn: $('deleteShiftBtn'),
    settingsDialog: $('settingsDialog'),
    settingsForm: $('settingsForm'),
    closeSettingsBtn: $('closeSettingsBtn'),
    defaultRate: $('defaultRate'),
    employeeName: $('employeeName'),
    plannedStart: $('plannedStart'),
    plannedEnd: $('plannedEnd'),
    scheduleInput: $('scheduleInput'),
    backupInput: $('backupInput'),
    clearPlanBtn: $('clearPlanBtn'),
    clearAllBtn: $('clearAllBtn'),
    exportBtn: $('exportBtn'),
    toast: $('toast')
  });

  const now = new Date();
  const ui = {
    viewYear: now.getFullYear(),
    viewMonth: now.getMonth(),
    selectedDate: toDateKey(now),
    toastTimer: null
  };

  let state = loadState();

  // ---------- Данные ----------

  function createEmptyState() {
    return {
      settings: { ...APP.defaults },
      shifts: {},
      planned: {}
    };
  }

  function normalizeState(input) {
    const base = createEmptyState();
    const data = input && typeof input === 'object' ? input : {};
    const settings = data.settings && typeof data.settings === 'object' ? data.settings : {};

    return {
      settings: {
        rate: normalizeRate(settings.rate, base.settings.rate),
        employeeName: normalizeName(settings.employeeName, base.settings.employeeName),
        plannedStart: normalizeTimeValue(settings.plannedStart) || base.settings.plannedStart,
        plannedEnd: normalizeTimeValue(settings.plannedEnd) || base.settings.plannedEnd
      },
      shifts: normalizeShiftMap(data.shifts, normalizeRate(settings.rate, base.settings.rate)),
      planned: normalizeShiftMap(data.planned, normalizeRate(settings.rate, base.settings.rate))
    };
  }

  function normalizeShiftMap(map, fallbackRate = APP.defaults.rate) {
    if (!map || typeof map !== 'object' || Array.isArray(map)) return {};

    return Object.entries(map).reduce((acc, [date, value]) => {
      const safeDate = normalizeDateValue(date);
      const safeShift = normalizeShift(value, fallbackRate);
      if (safeDate && safeShift) acc[safeDate] = safeShift;
      return acc;
    }, {});
  }

  function normalizeShift(value, fallbackRate = state?.settings?.rate || APP.defaults.rate) {
    if (!value || typeof value !== 'object') return null;
    const start = normalizeTimeValue(value.start);
    const end = normalizeTimeValue(value.end);
    const rate = normalizeRate(value.rate, fallbackRate);
    if (!start || !end) return null;
    return { start, end, rate };
  }

  function loadState() {
    for (const key of [APP.storageKey, ...APP.oldKeys]) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const normalized = normalizeState(parsed.data || parsed);
        localStorage.setItem(APP.storageKey, JSON.stringify(normalized));
        return normalized;
      } catch {
        // Поврежденные данные игнорируем, чтобы приложение не падало.
      }
    }
    return createEmptyState();
  }

  function saveState() {
    localStorage.setItem(APP.storageKey, JSON.stringify(state));
  }

  // ---------- Форматирование ----------

  function toDateKey(date) {
    return [date.getFullYear(), pad2(date.getMonth() + 1), pad2(date.getDate())].join('-');
  }

  function parseDateKey(key) {
    const match = String(key).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const [, y, m, d] = match.map(Number);
    const date = new Date(y, m - 1, d);
    return toDateKey(date) === key ? date : null;
  }

  function formatDate(key, withWeekday = true) {
    const date = parseDateKey(key) || new Date();
    return date.toLocaleDateString('ru-RU', {
      weekday: withWeekday ? 'long' : undefined,
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  function formatMoney(value) {
    const rounded = Math.max(0, Math.round(Number(value) || 0));
    return `${RUB.format(rounded)} ₽`;
  }

  function formatMoneyShort(value) {
    const rounded = Math.round(Number(value) || 0);
    if (rounded <= 0) return '';
    if (rounded >= 1_000_000) return `${String(Math.round(rounded / 100_000) / 10).replace('.', ',')}м`;
    if (rounded >= 10_000) return `${Math.round(rounded / 1_000)}к`;
    return `${RUB.format(rounded)}₽`;
  }

  function formatHours(value) {
    const rounded = Math.round((Number(value) || 0) * 10) / 10;
    return String(Math.max(0, rounded)).replace('.', ',');
  }

  function capitalize(value) {
    const text = String(value || '');
    return text ? text[0].toUpperCase() + text.slice(1) : '';
  }

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  // ---------- Время и расчеты ----------

  function isTime(value) {
    return typeof value === 'string' && /^\d{2}:\d{2}$/.test(value) && timeToMinutes(value) !== null;
  }

  function timeToMinutes(time) {
    const match = String(time || '').match(/^(\d{2}):(\d{2})$/);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return null;
    return hours * 60 + minutes;
  }

  function currentTime() {
    const date = new Date();
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }

  function normalizeRate(value, fallback = APP.defaults.rate) {
    const rate = Number(String(value ?? '').replace(',', '.'));
    return Number.isFinite(rate) && rate >= 0 ? Math.round(rate) : fallback;
  }

  function normalizeName(value, fallback) {
    const name = String(value || '').replace(/\s+/g, ' ').trim();
    return name || fallback;
  }

  function calcShift(shift) {
    if (!shift) return { minutes: 0, hours: 0, salary: 0 };
    const start = timeToMinutes(shift.start);
    const endRaw = timeToMinutes(shift.end);
    const rate = normalizeRate(shift.rate, state.settings.rate);
    if (start === null || endRaw === null) return { minutes: 0, hours: 0, salary: 0 };

    const end = endRaw <= start ? endRaw + DAY_MINUTES : endRaw;
    const minutes = Math.max(0, end - start);
    const hours = minutes / 60;
    return { minutes, hours, salary: hours * rate };
  }

  function isShiftActive(shift) {
    const start = timeToMinutes(shift?.start);
    let end = timeToMinutes(shift?.end);
    if (start === null || end === null) return false;

    const date = new Date();
    let current = date.getHours() * 60 + date.getMinutes();
    if (end <= start) {
      end += DAY_MINUTES;
      if (current < start) current += DAY_MINUTES;
    }
    return current >= start && current <= end;
  }

  function monthKey(year = ui.viewYear, month = ui.viewMonth) {
    return `${year}-${pad2(month + 1)}`;
  }

  function entriesForMonth(collection, year = ui.viewYear, month = ui.viewMonth) {
    const prefix = monthKey(year, month);
    return Object.entries(collection || {}).filter(([date]) => date.startsWith(prefix));
  }

  function sumEntries(entries) {
    return entries.reduce((total, [, shift]) => {
      const calc = calcShift(shift);
      total.salary += calc.salary;
      total.hours += calc.hours;
      total.count += calc.minutes > 0 ? 1 : 0;
      return total;
    }, { salary: 0, hours: 0, count: 0 });
  }

  function sumPlan(year = ui.viewYear, month = ui.viewMonth) {
    const dates = new Set([
      ...entriesForMonth(state.planned, year, month).map(([date]) => date),
      ...entriesForMonth(state.shifts, year, month).map(([date]) => date)
    ]);

    return [...dates].reduce((total, date) => {
      const calc = calcShift(state.shifts[date] || state.planned[date]);
      if (calc.minutes > 0) {
        total.salary += calc.salary;
        total.hours += calc.hours;
        total.count += 1;
      }
      return total;
    }, { salary: 0, hours: 0, count: 0 });
  }

  // ---------- Отрисовка ----------

  function render() {
    renderToday();
    renderSummary();
    renderCalendar();
  }

  function renderToday() {
    const todayKey = toDateKey(new Date());
    const shift = state.shifts[todayKey];
    const planned = state.planned[todayKey];
    const calc = calcShift(shift);

    els.topDate.textContent = capitalize(formatDate(todayKey));
    els.todayEarned.textContent = formatMoney(calc.salary);
    els.todayStatus.className = 'today-card empty';

    if (shift) {
      const active = isShiftActive(shift);
      els.todayStatus.className = `today-card ${active ? 'active' : 'done'}`;
      els.todayBadge.textContent = active ? 'идёт сейчас' : 'записано';
      els.todayInfo.textContent = `${shift.start}–${shift.end} · ${formatHours(calc.hours)} ч`;
      return;
    }

    if (planned) {
      const plan = calcShift(planned);
      els.todayStatus.className = 'today-card planned';
      els.todayBadge.textContent = 'по графику';
      els.todayInfo.textContent = `${planned.start}–${planned.end} · примерно ${formatMoney(plan.salary)}`;
      els.todayEarned.textContent = '0 ₽';
      return;
    }

    els.todayBadge.textContent = 'нет записи';
    els.todayInfo.textContent = 'Смена не записана';
    els.todayEarned.textContent = '0 ₽';
  }

  function renderSummary() {
    const monthTotals = sumEntries(entriesForMonth(state.shifts));
    const allTotals = sumEntries(Object.entries(state.shifts));
    const plan = sumPlan();
    const hasPlan = entriesForMonth(state.planned).length > 0;

    els.monthTotal.textContent = formatMoney(monthTotals.salary);
    els.allTotal.textContent = formatMoney(allTotals.salary);
    els.monthPlanTotal.textContent = formatMoney(plan.salary);
    els.planTotalCard.hidden = !hasPlan;
  }

  function renderCalendar() {
    const firstDay = new Date(ui.viewYear, ui.viewMonth, 1);
    const lastDay = new Date(ui.viewYear, ui.viewMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const markedDays = new Set([
      ...entriesForMonth(state.shifts).map(([date]) => date),
      ...entriesForMonth(state.planned).map(([date]) => date)
    ]);
    const todayKey = toDateKey(new Date());

    els.monthTitle.textContent = capitalize(firstDay.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }));
    els.monthSubtitle.textContent = `${markedDays.size} смен`;
    els.calendarGrid.replaceChildren();
    els.monthList.replaceChildren();

    const firstWeekday = (firstDay.getDay() + 6) % 7;
    for (let i = 0; i < firstWeekday; i++) {
      const empty = createEl('div', 'day empty');
      empty.setAttribute('aria-hidden', 'true');
      els.calendarGrid.append(empty);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${ui.viewYear}-${pad2(ui.viewMonth + 1)}-${pad2(day)}`;
      els.calendarGrid.append(createDayButton(dateKey, day, todayKey));
    }

    renderMonthList();
  }

  function createDayButton(dateKey, day, todayKey) {
    const shift = state.shifts[dateKey];
    const planned = state.planned[dateKey];
    const weekday = new Date(ui.viewYear, ui.viewMonth, day).getDay();
    const isWeekend = weekday === 0 || weekday === 6;
    const earned = shift ? calcShift(shift).salary : planned ? calcShift(planned).salary : 0;
    const money = shift ? formatMoneyShort(earned) : planned ? 'Р' : '';

    const btn = createEl('button', [
      'day',
      isWeekend && 'weekend',
      planned && 'planned',
      shift && 'done',
      dateKey === todayKey && 'today'
    ].filter(Boolean).join(' '));

    btn.type = 'button';
    btn.setAttribute('aria-label', `${day}: ${shift ? 'записано' : planned ? 'по графику' : 'нет смены'}`);
    btn.append(createEl('b', '', String(day)), createEl('span', `day-money${money ? '' : ' empty-money'}`, money || '0'));
    btn.addEventListener('click', () => openWorkDialog(dateKey));
    return btn;
  }

  function renderMonthList() {
    const dates = [...new Set([
      ...entriesForMonth(state.planned).map(([date]) => date),
      ...entriesForMonth(state.shifts).map(([date]) => date)
    ])].sort();

    if (!dates.length) {
      els.monthList.append(createEl('div', 'month-empty', 'Пока нет смен за этот месяц.'));
      return;
    }

    for (const dateKey of dates) {
      els.monthList.append(createShiftRow(dateKey));
    }
  }

  function createShiftRow(dateKey) {
    const shift = state.shifts[dateKey];
    const planned = state.planned[dateKey];
    const item = shift || planned;
    const calc = calcShift(item);
    const date = parseDateKey(dateKey) || new Date();
    const day = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    const weekday = date.toLocaleDateString('ru-RU', { weekday: 'short' }).replace('.', '');

    const btn = createEl('button', `shift-row ${shift ? 'done' : 'planned'}`);
    const dateBox = createEl('span', 'shift-date');
    dateBox.append(createEl('b', '', day), createEl('small', '', weekday));

    btn.type = 'button';
    btn.append(
      dateBox,
      createEl('span', 'shift-time', `${item.start}–${item.end}`),
      createEl('span', 'shift-money', formatMoney(calc.salary))
    );
    btn.addEventListener('click', () => openWorkDialog(dateKey));
    return btn;
  }

  function createEl(tag, className = '', text = '') {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== '') el.textContent = text;
    return el;
  }

  // ---------- Модальные окна ----------

  function openWorkDialog(dateKey) {
    ui.selectedDate = dateKey;
    const shift = state.shifts[dateKey];
    const planned = state.planned[dateKey];
    const isToday = dateKey === toDateKey(new Date());

    els.dialogDate.textContent = formatDate(dateKey);
    els.actualStart.value = shift?.start || planned?.start || state.settings.plannedStart || APP.defaults.plannedStart;
    els.actualEnd.value = shift?.end || (isToday ? currentTime() : planned?.end || state.settings.plannedEnd || APP.defaults.plannedEnd);
    els.rateInput.value = normalizeRate(shift?.rate ?? planned?.rate, state.settings.rate);
    els.deleteShiftBtn.hidden = !shift && !planned;

    if (planned && !shift) {
      els.plannedHint.hidden = false;
      els.plannedHint.textContent = `По графику: ${planned.start}–${planned.end}`;
    } else {
      els.plannedHint.hidden = true;
      els.plannedHint.textContent = '';
    }

    updatePreview();
    showDialog(els.workDialog);
  }

  function openSettings() {
    els.defaultRate.value = normalizeRate(state.settings.rate, APP.defaults.rate);
    els.employeeName.value = state.settings.employeeName || APP.defaults.employeeName;
    els.plannedStart.value = state.settings.plannedStart || APP.defaults.plannedStart;
    els.plannedEnd.value = state.settings.plannedEnd || APP.defaults.plannedEnd;
    showDialog(els.settingsDialog);
  }

  function showDialog(dialog) {
    document.body.classList.add('dialog-open');
    dialog.hidden = false;
    dialog.setAttribute('open', '');
    requestAnimationFrame(() => document.activeElement?.blur?.());
  }

  function closeDialog(dialog) {
    dialog.hidden = true;
    dialog.removeAttribute('open');
    if (!els.workDialog.hasAttribute('open') && !els.settingsDialog.hasAttribute('open')) {
      document.body.classList.remove('dialog-open');
    }
  }

  function closeByBackdrop(event, dialog) {
    if (event.target === dialog) closeDialog(dialog);
  }

  // ---------- Действия пользователя ----------

  function updatePreview() {
    const calc = calcShift({
      start: els.actualStart.value,
      end: els.actualEnd.value,
      rate: normalizeRate(els.rateInput.value, state.settings.rate)
    });
    els.salaryPreview.textContent = formatMoney(calc.salary);
    els.hoursPreview.textContent = calc.minutes > 0 ? `${formatHours(calc.hours)} ч` : '0 ч';
  }

  function saveWorkForm(event) {
    event.preventDefault();
    const shift = normalizeShift({
      start: els.actualStart.value,
      end: els.actualEnd.value,
      rate: els.rateInput.value
    });

    if (!shift) return showToast('Введи корректное время смены');
    const calc = calcShift(shift);
    if (calc.minutes <= 0) return showToast('Проверь время смены');

    state.shifts[ui.selectedDate] = shift;
    saveState();
    closeDialog(els.workDialog);
    render();
    showToast(`Сохранено: ${formatMoney(calc.salary)}`);
  }

  function deleteSelectedShift() {
    const hasShift = Boolean(state.shifts[ui.selectedDate]);
    const hasPlan = Boolean(state.planned[ui.selectedDate]);
    if (!hasShift && !hasPlan) return;

    delete state.shifts[ui.selectedDate];
    delete state.planned[ui.selectedDate];
    saveState();
    closeDialog(els.workDialog);
    render();
    showToast(hasShift && hasPlan ? 'Смена и график удалены' : 'Смена удалена');
  }

  function saveSettings(event) {
    event.preventDefault();
    saveSettingsFromInputs();
    closeDialog(els.settingsDialog);
    render();
    showToast('Настройки сохранены');
  }

  function saveSettingsFromInputs() {
    state.settings = {
      rate: normalizeRate(els.defaultRate.value, APP.defaults.rate),
      employeeName: normalizeName(els.employeeName.value, APP.defaults.employeeName),
      plannedStart: normalizeTimeValue(els.plannedStart.value) || APP.defaults.plannedStart,
      plannedEnd: normalizeTimeValue(els.plannedEnd.value) || APP.defaults.plannedEnd
    };
    saveState();
  }

  function clearCurrentMonth() {
    const actual = entriesForMonth(state.shifts);
    const planned = entriesForMonth(state.planned);
    if (!actual.length && !planned.length) return showToast('Этот месяц уже пустой');
    if (!confirm('Очистить график и записи за этот месяц?')) return;

    actual.forEach(([date]) => delete state.shifts[date]);
    planned.forEach(([date]) => delete state.planned[date]);
    saveState();
    render();
    showToast('Месяц очищен');
  }

  function clearPlan() {
    if (!Object.keys(state.planned).length) return showToast('График уже пустой');
    if (!confirm('Очистить только график? Записанные смены останутся.')) return;
    state.planned = {};
    saveState();
    render();
    showToast('График очищен');
  }

  function clearAll() {
    if (!Object.keys(state.shifts).length && !Object.keys(state.planned).length) return showToast('Календарь уже пустой');
    if (!confirm('Очистить всё: график и записанные смены?')) return;
    state.shifts = {};
    state.planned = {};
    saveState();
    render();
    showToast('Всё очищено');
  }

  // ---------- Импорт и экспорт ----------

  function exportBackup() {
    const payload = {
      app: APP.name,
      version: 4,
      exportedAt: new Date().toISOString(),
      data: state
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `moi-smeny-${toDateKey(new Date())}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function importBackup(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        state = normalizeState(parsed.data || parsed);
        saveState();
        render();
        showToast('Копия загружена');
      } catch {
        showToast('Не получилось загрузить копию');
      } finally {
        els.backupInput.value = '';
        els.scheduleInput.value = '';
      }
    };
    reader.readAsText(file);
  }

  function importScheduleFile(file) {
    if (!file) return;
    saveSettingsFromInputs();
    const name = file.name.toLowerCase();

    if (name.endsWith('.json')) return importBackup(file);
    if (name.endsWith('.csv')) return readTextFile(file, text => finishScheduleImport(importFromCsv(text, file.name)), 'Не получилось прочитать CSV');

    if (!window.XLSX) {
      els.scheduleInput.value = '';
      return showToast('Для Excel нужен интернет. Можно загрузить CSV или JSON.');
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const workbook = XLSX.read(reader.result, { type: 'array', cellDates: true });
        finishScheduleImport(importFromWorkbook(workbook));
      } catch {
        showToast('Не получилось прочитать Excel');
      } finally {
        els.scheduleInput.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function readTextFile(file, onSuccess, errorMessage) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        onSuccess(String(reader.result || ''));
      } catch {
        showToast(errorMessage);
      } finally {
        els.scheduleInput.value = '';
      }
    };
    reader.readAsText(file);
  }

  function finishScheduleImport(result) {
    if (!result.count) return showToast('Смены не найдены. Проверь имя в настройках.');
    saveState();
    render();
    showToast(`График загружен: ${result.count} смен`);
  }

  function importFromWorkbook(workbook) {
    let total = 0;
    const detectedRates = [];

    for (const sheetName of workbook.SheetNames || []) {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
      const result = importFromRows(rows, sheetName);
      total += result.count;
      if (result.rate) detectedRates.push(result.rate);
    }

    if (detectedRates.length && normalizeRate(state.settings.rate) === APP.defaults.rate) {
      state.settings.rate = detectedRates[0];
    }
    return { count: total };
  }

  function importFromCsv(text, fileName) {
    const rows = parseCsv(text);
    const simple = importSimpleDateCsv(rows);
    return simple.count ? simple : importFromRows(rows, fileName);
  }

  function parseCsv(text) {
    const firstLine = text.split(/\r?\n/).find(Boolean) || '';
    const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const next = text[i + 1];

      if (char === '"' && inQuotes && next === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        row.push(cell.trim());
        cell = '';
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && next === '\n') i++;
        row.push(cell.trim());
        if (row.some(Boolean)) rows.push(row);
        row = [];
        cell = '';
      } else {
        cell += char;
      }
    }

    row.push(cell.trim());
    if (row.some(Boolean)) rows.push(row);
    return rows;
  }

  function importSimpleDateCsv(rows) {
    if (!rows.length) return { count: 0 };
    const headers = rows[0].map(normalizeText);
    const dateIndex = headers.findIndex(value => ['date', 'дата'].includes(value));
    const startIndex = headers.findIndex(value => ['start', 'начало', 'начал'].includes(value));
    const endIndex = headers.findIndex(value => ['end', 'конец', 'закончил'].includes(value));
    const rateIndex = headers.findIndex(value => ['rate', 'ставка'].includes(value));
    if (dateIndex < 0 || startIndex < 0 || endIndex < 0) return { count: 0 };

    let count = 0;
    for (const row of rows.slice(1)) {
      const date = normalizeDateValue(row[dateIndex]);
      const shift = normalizeShift({
        start: row[startIndex],
        end: row[endIndex],
        rate: row[rateIndex] || state.settings.rate
      });
      if (!date || !shift) continue;
      state.shifts[date] = shift;
      count++;
    }
    return { count };
  }

  function importFromRows(rows, sourceName = '') {
    const info = detectMonthYear(rows, sourceName);
    if (!info) return { count: 0 };

    const dayRowIndex = findDayRow(rows, info.year, info.month);
    const employeeRowIndex = findEmployeeRow(rows);
    if (dayRowIndex < 0 || employeeRowIndex < 0) return { count: 0 };

    const dayRow = rows[dayRowIndex];
    const employeeRow = rows[employeeRowIndex];
    const daysInMonth = new Date(info.year, info.month + 1, 0).getDate();
    const dateColumns = dayRow
      .map((value, col) => ({ col, day: toDayNumber(value) }))
      .filter(item => item.day >= 1 && item.day <= daysInMonth);

    const firstDateCol = dateColumns[0]?.col || 0;
    const detectedRate = detectRate(employeeRow, firstDateCol) || state.settings.rate;
    let count = 0;

    for (const { col, day } of dateColumns) {
      const mark = employeeRow[col];
      if (!isPlannedMark(mark)) continue;
      const dateKey = `${info.year}-${pad2(info.month + 1)}-${pad2(day)}`;
      state.planned[dateKey] = {
        start: state.settings.plannedStart,
        end: state.settings.plannedEnd,
        rate: detectedRate
      };
      count++;
    }
    return { count, rate: detectedRate };
  }

  function detectMonthYear(rows, sourceName = '') {
    const text = [sourceName, ...rows.slice(0, 8).flat()].map(value => String(value || '').toLowerCase()).join(' ');
    const year = Number(text.match(/20\d{2}/)?.[0]);
    if (!year) return null;

    for (const [name, month] of ruMonths) {
      if (text.includes(name)) return { year, month };
    }
    return null;
  }

  function findDayRow(rows, year, month) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let best = { index: -1, count: 0 };

    rows.forEach((row, index) => {
      const seen = new Set(row.map(toDayNumber).filter(day => day >= 1 && day <= daysInMonth));
      if (seen.size > best.count) best = { index, count: seen.size };
    });

    return best.count >= Math.min(7, daysInMonth) ? best.index : -1;
  }

  function findEmployeeRow(rows) {
    const employee = normalizeText(state.settings.employeeName || APP.defaults.employeeName);
    return rows.findIndex(row => row.some(cell => normalizeText(cell).includes(employee)));
  }

  function detectRate(row, firstDateCol) {
    for (let col = 0; col < firstDateCol; col++) {
      const rate = normalizeRate(row[col], NaN);
      if (Number.isFinite(rate) && rate >= 100 && rate <= 2_000) return rate;
    }
    return null;
  }

  function isPlannedMark(value) {
    const text = normalizeText(value);
    if (!text) return false;
    return !['нет', 'есть', 'есть все', 'делает', 'продлить', '?'].includes(text);
  }

  function normalizeText(value) {
    return String(value || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
  }

  function toDayNumber(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getDate();
    if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
    const match = String(value || '').trim().match(/^\d{1,2}$/);
    return match ? Number(match[0]) : 0;
  }

  function normalizeDateValue(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return toDateKey(value);
    const text = String(value || '').trim();
    let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (match) {
      const key = `${match[1]}-${pad2(match[2])}-${pad2(match[3])}`;
      return parseDateKey(key) ? key : '';
    }
    match = text.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](20\d{2})$/);
    if (match) {
      const key = `${match[3]}-${pad2(match[2])}-${pad2(match[1])}`;
      return parseDateKey(key) ? key : '';
    }
    return '';
  }

  function normalizeTimeValue(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return `${pad2(value.getHours())}:${pad2(value.getMinutes())}`;
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 1) {
      const minutes = Math.round(value * DAY_MINUTES);
      return `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;
    }

    const text = String(value || '').trim();
    let match = text.match(/^(\d{1,2})[:.](\d{1,2})$/);
    if (match) {
      const time = `${pad2(match[1])}:${pad2(match[2])}`;
      return isTime(time) ? time : '';
    }
    match = text.match(/^(\d{1,2})$/);
    if (match) {
      const time = `${pad2(match[1])}:00`;
      return isTime(time) ? time : '';
    }
    return '';
  }

  function showToast(message) {
    clearTimeout(ui.toastTimer);
    els.toast.textContent = message;
    els.toast.hidden = false;
    ui.toastTimer = setTimeout(() => {
      els.toast.hidden = true;
    }, TOAST_DELAY);
  }

  // ---------- События ----------

  function bindEvents() {
    els.mainActionBtn.addEventListener('click', () => openWorkDialog(toDateKey(new Date())));
    els.prevMonthBtn.addEventListener('click', () => changeMonth(-1));
    els.nextMonthBtn.addEventListener('click', () => changeMonth(1));
    els.todayBtn.addEventListener('click', goToToday);
    els.clearMonthBtn.addEventListener('click', clearCurrentMonth);
    els.settingsBtn.addEventListener('click', openSettings);
    els.closeWorkBtn.addEventListener('click', () => closeDialog(els.workDialog));
    els.closeSettingsBtn.addEventListener('click', () => closeDialog(els.settingsDialog));
    els.workDialog.addEventListener('click', event => closeByBackdrop(event, els.workDialog));
    els.settingsDialog.addEventListener('click', event => closeByBackdrop(event, els.settingsDialog));
    els.workForm.addEventListener('submit', saveWorkForm);
    els.settingsForm.addEventListener('submit', saveSettings);
    els.actualStart.addEventListener('input', updatePreview);
    els.actualEnd.addEventListener('input', updatePreview);
    els.rateInput.addEventListener('input', updatePreview);
    els.deleteShiftBtn.addEventListener('click', deleteSelectedShift);
    els.clearPlanBtn.addEventListener('click', clearPlan);
    els.clearAllBtn.addEventListener('click', clearAll);
    els.exportBtn.addEventListener('click', exportBackup);
    els.backupInput.addEventListener('change', event => importBackup(event.target.files?.[0]));
    els.scheduleInput.addEventListener('change', event => importScheduleFile(event.target.files?.[0]));
    document.addEventListener('keydown', closeOnEscape);
  }

  function changeMonth(delta) {
    ui.viewMonth += delta;
    if (ui.viewMonth < 0) {
      ui.viewMonth = 11;
      ui.viewYear--;
    } else if (ui.viewMonth > 11) {
      ui.viewMonth = 0;
      ui.viewYear++;
    }
    render();
  }

  function goToToday() {
    const date = new Date();
    ui.viewYear = date.getFullYear();
    ui.viewMonth = date.getMonth();
    render();
  }

  function closeOnEscape(event) {
    if (event.key !== 'Escape') return;
    if (els.workDialog.hasAttribute('open')) closeDialog(els.workDialog);
    if (els.settingsDialog.hasAttribute('open')) closeDialog(els.settingsDialog);
  }

  bindEvents();
  render();
  setInterval(renderToday, 60_000);
})();
