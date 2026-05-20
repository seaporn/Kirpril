const STORAGE_KEY = 'shiftSalaryCompactV3';
const OLD_STORAGE_KEY = 'shiftSalaryManualCleanV1';
const DEFAULT_RATE = 350;
const DEFAULT_EMPLOYEE = 'Кириченко Александр';
const DEFAULT_START = '10:00';
const DEFAULT_END = '22:00';

const els = {
  topDate: document.getElementById('topDate'),
  mainActionBtn: document.getElementById('mainActionBtn'),
  todayStatus: document.getElementById('todayStatus'),
  todayBadge: document.getElementById('todayBadge'),
  todayInfo: document.getElementById('todayInfo'),
  todayEarned: document.getElementById('todayEarned'),
  allTotal: document.getElementById('allTotal'),
  monthTotal: document.getElementById('monthTotal'),
  monthPlanTotal: document.getElementById('monthPlanTotal'),
  planTotalCard: document.getElementById('planTotalCard'),
  monthTitle: document.getElementById('monthTitle'),
  monthSubtitle: document.getElementById('monthSubtitle'),
  calendarGrid: document.getElementById('calendarGrid'),
  monthList: document.getElementById('monthList'),
  prevMonthBtn: document.getElementById('prevMonthBtn'),
  nextMonthBtn: document.getElementById('nextMonthBtn'),
  todayBtn: document.getElementById('todayBtn'),
  clearMonthBtn: document.getElementById('clearMonthBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
  workDialog: document.getElementById('workDialog'),
  workForm: document.getElementById('workForm'),
  closeWorkBtn: document.getElementById('closeWorkBtn'),
  dialogDate: document.getElementById('dialogDate'),
  plannedHint: document.getElementById('plannedHint'),
  actualStart: document.getElementById('actualStart'),
  actualEnd: document.getElementById('actualEnd'),
  rateInput: document.getElementById('rateInput'),
  salaryPreview: document.getElementById('salaryPreview'),
  hoursPreview: document.getElementById('hoursPreview'),
  deleteShiftBtn: document.getElementById('deleteShiftBtn'),
  settingsDialog: document.getElementById('settingsDialog'),
  settingsForm: document.getElementById('settingsForm'),
  closeSettingsBtn: document.getElementById('closeSettingsBtn'),
  defaultRate: document.getElementById('defaultRate'),
  employeeName: document.getElementById('employeeName'),
  plannedStart: document.getElementById('plannedStart'),
  plannedEnd: document.getElementById('plannedEnd'),
  scheduleInput: document.getElementById('scheduleInput'),
  backupInput: document.getElementById('backupInput'),
  clearPlanBtn: document.getElementById('clearPlanBtn'),
  clearAllBtn: document.getElementById('clearAllBtn'),
  exportBtn: document.getElementById('exportBtn'),
  toast: document.getElementById('toast')
};

const monthNames = {
  'январь': 0, 'января': 0,
  'февраль': 1, 'февраля': 1,
  'март': 2, 'марта': 2,
  'апрель': 3, 'апреля': 3,
  'май': 4, 'мая': 4,
  'июнь': 5, 'июня': 5,
  'июль': 6, 'июля': 6,
  'август': 7, 'августа': 7,
  'сентябрь': 8, 'сентября': 8,
  'октябрь': 9, 'октября': 9,
  'ноябрь': 10, 'ноября': 10,
  'декабрь': 11, 'декабря': 11
};

const today = new Date();
let viewYear = today.getFullYear();
let viewMonth = today.getMonth();
let selectedDate = toDateKey(today);
let toastTimer = null;
let state = loadState();

function emptyState() {
  return {
    settings: {
      rate: DEFAULT_RATE,
      employeeName: DEFAULT_EMPLOYEE,
      plannedStart: DEFAULT_START,
      plannedEnd: DEFAULT_END
    },
    shifts: {},
    planned: {}
  };
}

function normalizeState(data) {
  const base = emptyState();
  return {
    settings: {
      rate: Number(data?.settings?.rate || base.settings.rate),
      employeeName: String(data?.settings?.employeeName || base.settings.employeeName),
      plannedStart: isTime(data?.settings?.plannedStart) ? data.settings.plannedStart : base.settings.plannedStart,
      plannedEnd: isTime(data?.settings?.plannedEnd) ? data.settings.plannedEnd : base.settings.plannedEnd
    },
    shifts: data?.shifts && typeof data.shifts === 'object' ? data.shifts : {},
    planned: data?.planned && typeof data.planned === 'object' ? data.planned : {}
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeState(JSON.parse(raw));

    const oldRaw = localStorage.getItem(OLD_STORAGE_KEY);
    if (oldRaw) {
      const old = JSON.parse(oldRaw);
      return normalizeState({ settings: old.settings, shifts: old.shifts, planned: {} });
    }
    return emptyState();
  } catch {
    return emptyState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(key, withWeekday = true) {
  const date = parseDateKey(key);
  return date.toLocaleDateString('ru-RU', {
    weekday: withWeekday ? 'long' : undefined,
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function formatMoney(value) {
  return `${Math.round(value).toLocaleString('ru-RU')} ₽`;
}

function formatMoneyShort(value) {
  const rounded = Math.round(value);
  if (!Number.isFinite(rounded) || rounded <= 0) return '';
  if (rounded >= 1000000) return `${String(Math.round(rounded / 100000) / 10).replace('.', ',')}м`;
  if (rounded >= 10000) return `${Math.round(rounded / 1000)}к`;
  return `${rounded.toLocaleString('ru-RU')}₽`;
}

function formatHours(value) {
  if (!Number.isFinite(value) || value <= 0) return '0';
  const rounded = Math.round(value * 10) / 10;
  return String(rounded).replace('.', ',');
}

function isTime(value) {
  return typeof value === 'string' && /^\d{2}:\d{2}$/.test(value);
}

function timeToMinutes(time) {
  if (!isTime(time)) return null;
  const [h, m] = time.split(':').map(Number);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function calcShift(shift) {
  if (!shift) return { minutes: 0, hours: 0, salary: 0 };
  const start = timeToMinutes(shift.start);
  const endRaw = timeToMinutes(shift.end);
  const rate = Number(shift.rate || state.settings.rate || DEFAULT_RATE);
  if (start === null || endRaw === null) return { minutes: 0, hours: 0, salary: 0 };
  let end = endRaw;
  if (end <= start) end += 1440;
  const minutes = Math.max(0, end - start);
  const hours = minutes / 60;
  return { minutes, hours, salary: hours * rate };
}

function monthKey(year = viewYear, month = viewMonth) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function entriesForMonth(collection, year = viewYear, month = viewMonth) {
  const prefix = monthKey(year, month);
  return Object.entries(collection).filter(([date]) => date.startsWith(prefix));
}

function actualTotals(entries) {
  return entries.reduce((acc, [, shift]) => {
    const calc = calcShift(shift);
    acc.salary += calc.salary;
    acc.hours += calc.hours;
    acc.count += calc.minutes > 0 ? 1 : 0;
    return acc;
  }, { salary: 0, hours: 0, count: 0 });
}

function planTotals(year = viewYear, month = viewMonth) {
  const keys = new Set([
    ...entriesForMonth(state.planned, year, month).map(([date]) => date),
    ...entriesForMonth(state.shifts, year, month).map(([date]) => date)
  ]);
  let salary = 0;
  let hours = 0;
  let count = 0;

  for (const date of keys) {
    const shift = state.shifts[date] || state.planned[date];
    const calc = calcShift(shift);
    if (calc.minutes > 0) {
      salary += calc.salary;
      hours += calc.hours;
      count += 1;
    }
  }
  return { salary, hours, count };
}

function render() {
  renderToday();
  renderSummary();
  renderCalendar(const actual = sumEntries(entriesForMonth(state.shifts));
const plannedCount = entriesForMonth(state.planned).length;
const todayKey = toDateKey(new Date());

els.monthTitle.textContent = capitalize(firstDay.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }));
els.monthSubtitle.textContent = plannedCount ? `${actual.count} записано · ${plannedCount} по графику` : `${actual.count} записано`;);
}

function renderToday() {
  const todayKey = toDateKey(new Date());
  const shift = state.shifts[todayKey];
  const planned = state.planned[todayKey];
  const calc = calcShift(shift);
  const dateText = formatDate(todayKey);
  els.topDate.textContent = dateText[0].toUpperCase() + dateText.slice(1);
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
    const planCalc = calcShift(planned);
    els.todayStatus.className = 'today-card planned';
    els.todayBadge.textContent = 'по графику';
    els.todayInfo.textContent = `${planned.start}–${planned.end} · примерно ${formatMoney(planCalc.salary)}`;
    els.todayEarned.textContent = '0 ₽';
    return;
  }

  els.todayBadge.textContent = 'нет записи';
  els.todayInfo.textContent = 'Смена не записана';
  els.todayEarned.textContent = '0 ₽';
}

function isShiftActive(shift) {
  const start = timeToMinutes(shift.start);
  let end = timeToMinutes(shift.end);
  if (start === null || end === null) return false;
  const now = new Date();
  let current = now.getHours() * 60 + now.getMinutes();
  if (end <= start) {
    end += 1440;
    if (current < start) current += 1440;
  }
  return current >= start && current <= end;
}

function renderSummary() {
  const monthTotals = actualTotals(entriesForMonth(state.shifts));
  const allTotals = actualTotals(Object.entries(state.shifts));
  const monthPlan = planTotals();

  els.allTotal.textContent = formatMoney(allTotals.salary);
  els.monthTotal.textContent = formatMoney(monthTotals.salary);
  els.monthPlanTotal.textContent = formatMoney(monthPlan.salary);

  const hasPlanned = entriesForMonth(state.planned).length > 0;
  els.planTotalCard.hidden = !hasPlanned;
}

function renderCalendar() {
  const firstDay = new Date(viewYear, viewMonth, 1);
  const lastDay = new Date(viewYear, viewMonth + 1, 0);
  const daysInMonth = lastDay.getDate();
  const monthName = firstDay.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  const todayKey = toDateKey(new Date());
  const actual = actualTotals(entriesForMonth(state.shifts));
  const plannedCount = entriesForMonth(state.planned).length;

  els.monthTitle.textContent = monthName[0].toUpperCase() + monthName.slice(1);
  els.monthSubtitle.textContent = plannedCount ? `${actual.count} записано · ${plannedCount} по графику` : `${actual.count} записано`;
  els.calendarGrid.innerHTML = '';
  els.monthList.innerHTML = '';

  const firstWeekday = (firstDay.getDay() + 6) % 7;
  for (let i = 0; i < firstWeekday; i++) {
    const empty = document.createElement('div');
    empty.className = 'day empty';
    empty.setAttribute('aria-hidden', 'true');
    els.calendarGrid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const shift = state.shifts[key];
    const planned = state.planned[key];
    const btn = document.createElement('button');
    btn.type = 'button';
    const weekday = new Date(viewYear, viewMonth, day).getDay();
    const isWeekend = weekday === 0 || weekday === 6;
    btn.className = `day${isWeekend ? ' weekend' : ''}${planned ? ' planned' : ''}${shift ? ' done' : ''}${key === todayKey ? ' today' : ''}`;
    btn.setAttribute('aria-label', `${day} ${shift ? 'записано' : planned ? 'по графику' : 'нет смены'}`);
    const earned = shift ? calcShift(shift).salary : planned ? calcShift(planned).salary : 0;
    const moneyText = shift ? formatMoneyShort(earned) : planned ? 'план' : '';
    btn.innerHTML = `
      <b>${day}</b>
      <span class="day-money${moneyText ? '' : ' empty-money'}">${moneyText || '0'}</span>
    `;
    btn.addEventListener('click', () => openWorkDialog(key));
    els.calendarGrid.appendChild(btn);
  }

  renderMonthList();
}

function renderMonthList() {
  const dates = new Set([
    ...entriesForMonth(state.planned).map(([date]) => date),
    ...entriesForMonth(state.shifts).map(([date]) => date)
  ]);
  const sorted = [...dates].sort();

  if (!sorted.length) {
    const empty = document.createElement('div');
    empty.className = 'month-empty';
    empty.textContent = 'Пока нет смен за этот месяц.';
    els.monthList.appendChild(empty);
    return;
  }

  for (const date of sorted) {
    const shift = state.shifts[date];
    const planned = state.planned[date];
    const itemShift = shift || planned;
    const calc = calcShift(itemShift);
    const dateObj = parseDateKey(date);
    const day = dateObj.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    const weekday = dateObj.toLocaleDateString('ru-RU', { weekday: 'short' }).replace('.', '');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `shift-row ${shift ? 'done' : 'planned'}`;
    btn.innerHTML = `
      <span class="shift-date"><b>${day}</b><small>${weekday}</small></span>
      <span class="shift-time">${itemShift.start}–${itemShift.end}</span>
      <span class="shift-money">${formatMoney(calc.salary)}</span>
    `;
    btn.addEventListener('click', () => openWorkDialog(date));
    els.monthList.appendChild(btn);
  }
}

function openWorkDialog(dateKey) {
  selectedDate = dateKey;
  const shift = state.shifts[dateKey];
  const planned = state.planned[dateKey];
  const todayKey = toDateKey(new Date());
  const defaultEnd = dateKey === todayKey ? nowTime() : (planned?.end || nowTime());

  els.dialogDate.textContent = formatDate(dateKey);
  els.actualStart.value = shift?.start || DEFAULT_START;
  els.actualEnd.value = shift?.end || defaultEnd;
  els.rateInput.value = Number(shift?.rate || planned?.rate || state.settings.rate || DEFAULT_RATE);
  els.deleteShiftBtn.hidden = !shift;

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

function showDialog(dialog) {
  document.body.classList.add('dialog-open');
  dialog.hidden = false;
  dialog.setAttribute('open', '');
  requestAnimationFrame(() => {
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
  });
}

function closeDialog(dialog) {
  dialog.hidden = true;
  dialog.removeAttribute('open');
  if (!els.workDialog.hasAttribute('open') && !els.settingsDialog.hasAttribute('open')) {
    document.body.classList.remove('dialog-open');
  }
}

function closeDialogOnBackdrop(event, dialog) {
  if (event.target === dialog) closeDialog(dialog);
}

function updatePreview() {
  const temp = {
    start: els.actualStart.value,
    end: els.actualEnd.value,
    rate: Number(els.rateInput.value || state.settings.rate || DEFAULT_RATE)
  };
  const calc = calcShift(temp);
  els.salaryPreview.textContent = formatMoney(calc.salary);
  els.hoursPreview.textContent = calc.minutes > 0 ? `${formatHours(calc.hours)} ч` : '0 ч';
}

function saveWorkForm(event) {
  event.preventDefault();
  const start = els.actualStart.value;
  const end = els.actualEnd.value;
  const rate = Number(els.rateInput.value || state.settings.rate || DEFAULT_RATE);

  if (!start || !end) {
    showToast('Введи начало и конец смены');
    return;
  }

  const temp = { start, end, rate };
  const calc = calcShift(temp);
  if (calc.minutes <= 0) {
    showToast('Проверь время смены');
    return;
  }

  state.shifts[selectedDate] = temp;
  saveState();
  closeDialog(els.workDialog);
  render();
  showToast(`Сохранено: ${formatMoney(calc.salary)}`);
}

function deleteSelectedShift() {
  if (!state.shifts[selectedDate]) return;
  delete state.shifts[selectedDate];
  saveState();
  closeDialog(els.workDialog);
  render();
  showToast('Запись удалена');
}

function clearCurrentMonth() {
  const actual = entriesForMonth(state.shifts);
  const planned = entriesForMonth(state.planned);
  if (!actual.length && !planned.length) {
    showToast('Этот месяц уже пустой');
    return;
  }
  if (!confirm('Очистить график и записи за этот месяц?')) return;
  for (const [date] of actual) delete state.shifts[date];
  for (const [date] of planned) delete state.planned[date];
  saveState();
  render();
  showToast('Месяц очищен');
}

function clearPlan() {
  if (!Object.keys(state.planned).length) {
    showToast('График уже пустой');
    return;
  }
  if (!confirm('Очистить только график? Записанные смены останутся.')) return;
  state.planned = {};
  saveState();
  render();
  showToast('График очищен');
}

function clearAll() {
  if (!Object.keys(state.shifts).length && !Object.keys(state.planned).length) {
    showToast('Календарь уже пустой');
    return;
  }
  if (!confirm('Очистить всё: график и записанные смены?')) return;
  state.shifts = {};
  state.planned = {};
  saveState();
  render();
  showToast('Всё очищено');
}

function openSettings() {
  els.defaultRate.value = Number(state.settings.rate || DEFAULT_RATE);
  els.employeeName.value = state.settings.employeeName || DEFAULT_EMPLOYEE;
  els.plannedStart.value = state.settings.plannedStart || DEFAULT_START;
  els.plannedEnd.value = state.settings.plannedEnd || DEFAULT_END;
  showDialog(els.settingsDialog);
}

function saveSettings(event) {
  event.preventDefault();
  state.settings.rate = Number(els.defaultRate.value || DEFAULT_RATE);
  state.settings.employeeName = (els.employeeName.value || DEFAULT_EMPLOYEE).trim();
  state.settings.plannedStart = els.plannedStart.value || DEFAULT_START;
  state.settings.plannedEnd = els.plannedEnd.value || DEFAULT_END;
  saveState();
  closeDialog(els.settingsDialog);
  render();
  showToast('Настройки сохранены');
}

function exportBackup() {
  const payload = {
    app: 'Мои смены',
    version: 2,
    exportedAt: new Date().toISOString(),
    data: state
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `moi-smeny-${toDateKey(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importBackup(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const data = parsed.data || parsed;
      state = normalizeState(data);
      saveState();
      render();
      showToast('Копия загружена');
    } catch {
      showToast('Не получилось загрузить копию');
    } finally {
      els.backupInput.value = '';
    }
  };
  reader.readAsText(file);
}

function importScheduleFile(file) {
  if (!file) return;
  saveSettingsFromInputsWithoutClosing();
  const name = file.name.toLowerCase();

  if (name.endsWith('.json')) {
    importBackup(file);
    els.scheduleInput.value = '';
    return;
  }

  if (name.endsWith('.csv')) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = importFromCsv(String(reader.result), file.name);
        finishScheduleImport(imported);
      } catch {
        showToast('Не получилось прочитать CSV');
      } finally {
        els.scheduleInput.value = '';
      }
    };
    reader.readAsText(file);
    return;
  }

  if (!window.XLSX) {
    showToast('Для Excel нужен интернет. Открой приложение с GitHub Pages или загрузи CSV.');
    els.scheduleInput.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const workbook = XLSX.read(reader.result, { type: 'array', cellDates: true });
      const imported = importFromWorkbook(workbook);
      finishScheduleImport(imported);
    } catch {
      showToast('Не получилось прочитать Excel');
    } finally {
      els.scheduleInput.value = '';
    }
  };
  reader.readAsArrayBuffer(file);
}

function saveSettingsFromInputsWithoutClosing() {
  state.settings.rate = Number(els.defaultRate.value || state.settings.rate || DEFAULT_RATE);
  state.settings.employeeName = (els.employeeName.value || state.settings.employeeName || DEFAULT_EMPLOYEE).trim();
  state.settings.plannedStart = els.plannedStart.value || state.settings.plannedStart || DEFAULT_START;
  state.settings.plannedEnd = els.plannedEnd.value || state.settings.plannedEnd || DEFAULT_END;
  saveState();
}

function finishScheduleImport(result) {
  if (!result.count) {
    showToast('Смены не найдены. Проверь имя в настройках.');
    return;
  }
  saveState();
  render();
  showToast(`График загружен: ${result.count} смен`);
}

function importFromWorkbook(workbook) {
  let total = 0;
  const detectedRates = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
    const result = importFromRows(rows, sheetName);
    total += result.count;
    if (result.rate) detectedRates.push(result.rate);
  }

  if (detectedRates.length && Number(state.settings.rate || DEFAULT_RATE) === DEFAULT_RATE) {
    state.settings.rate = detectedRates[0];
  }

  return { count: total };
}

function importFromCsv(text, fileName) {
  const rows = parseCsv(text);
  const result = importSimpleDateCsv(rows);
  if (result.count) return result;
  return importFromRows(rows, fileName);
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
  const headers = rows[0].map(value => normalizeText(value));
  const dateIndex = headers.findIndex(value => ['date', 'дата'].includes(value));
  const startIndex = headers.findIndex(value => ['start', 'начало', 'начал'].includes(value));
  const endIndex = headers.findIndex(value => ['end', 'конец', 'закончил'].includes(value));
  const rateIndex = headers.findIndex(value => ['rate', 'ставка'].includes(value));
  if (dateIndex < 0 || startIndex < 0 || endIndex < 0) return { count: 0 };

  let count = 0;
  for (const row of rows.slice(1)) {
    const date = normalizeDateValue(row[dateIndex]);
    const start = normalizeTimeValue(row[startIndex]);
    const end = normalizeTimeValue(row[endIndex]);
    const rate = Number(row[rateIndex]) || Number(state.settings.rate || DEFAULT_RATE);
    if (!date || !start || !end) continue;
    state.shifts[date] = { start, end, rate };
    count++;
  }
  return { count };
}

function importFromRows(rows, sourceName) {
  const info = detectMonthYear(rows, sourceName);
  if (!info) return { count: 0 };

  const dayRowIndex = findDayRow(rows, info.year, info.month);
  if (dayRowIndex < 0) return { count: 0 };

  const employeeRowIndex = findEmployeeRow(rows);
  if (employeeRowIndex < 0) return { count: 0 };

  const dayRow = rows[dayRowIndex];
  const employeeRow = rows[employeeRowIndex];
  const daysInMonth = new Date(info.year, info.month + 1, 0).getDate();
  const dateColumns = [];

  for (let col = 0; col < dayRow.length; col++) {
    const day = toDayNumber(dayRow[col]);
    if (day >= 1 && day <= daysInMonth) {
      dateColumns.push({ col, day });
    }
  }

  const firstDateCol = dateColumns.length ? dateColumns[0].col : 0;
  const detectedRate = detectRate(employeeRow, firstDateCol) || Number(state.settings.rate || DEFAULT_RATE);
  let count = 0;

  for (const item of dateColumns) {
    const mark = employeeRow[item.col];
    if (!isPlannedMark(mark)) continue;
    const dateKey = `${info.year}-${String(info.month + 1).padStart(2, '0')}-${String(item.day).padStart(2, '0')}`;
    state.planned[dateKey] = {
      start: state.settings.plannedStart || DEFAULT_START,
      end: state.settings.plannedEnd || DEFAULT_END,
      rate: detectedRate,
      mark: String(mark).trim()
    };
    count++;
  }

  return { count, rate: detectedRate };
}

function detectMonthYear(rows, sourceName = '') {
  const text = [sourceName, ...rows.slice(0, 8).flat()].map(value => String(value || '').toLowerCase()).join(' ');
  const yearMatch = text.match(/20\d{2}/);
  if (!yearMatch) return null;
  const year = Number(yearMatch[0]);

  for (const [name, index] of Object.entries(monthNames)) {
    if (text.includes(name)) return { year, month: index };
  }
  return null;
}

function findDayRow(rows, year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let bestIndex = -1;
  let bestCount = 0;

  rows.forEach((row, index) => {
    const seen = new Set();
    for (const value of row) {
      const day = toDayNumber(value);
      if (day >= 1 && day <= daysInMonth) seen.add(day);
    }
    if (seen.size > bestCount) {
      bestCount = seen.size;
      bestIndex = index;
    }
  });

  return bestCount >= Math.min(7, daysInMonth) ? bestIndex : -1;
}

function findEmployeeRow(rows) {
  const employee = normalizeText(state.settings.employeeName || DEFAULT_EMPLOYEE);
  return rows.findIndex(row => row.some(cell => normalizeText(cell).includes(employee)));
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .trim();
}

function toDayNumber(value) {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'number' && Number.isInteger(Math.round(value))) return Math.round(value);
  const match = String(value || '').trim().match(/^\d{1,2}$/);
  return match ? Number(match[0]) : 0;
}

function detectRate(row, firstDateCol) {
  for (let col = 0; col < firstDateCol; col++) {
    const value = Number(row[col]);
    if (Number.isFinite(value) && value >= 100 && value <= 2000) return value;
  }
  return null;
}

function isPlannedMark(value) {
  if (value === null || value === undefined) return false;
  const text = String(value).trim();
  if (!text) return false;
  const normalized = normalizeText(text);
  if (['нет', 'есть', 'есть все', 'делает', 'продлить', '?'].includes(normalized)) return false;
  return true;
}

function normalizeDateValue(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return toDateKey(value);
  const text = String(value || '').trim();
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  match = text.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](20\d{2})$/);
  if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  return '';
}

function normalizeTimeValue(value) {
  if (isTime(value)) return value;
  const text = String(value || '').trim();
  let match = text.match(/^(\d{1,2})[:.](\d{2})$/);
  if (match) return `${match[1].padStart(2, '0')}:${match[2]}`;
  match = text.match(/^(\d{1,2})$/);
  if (match) return `${match[1].padStart(2, '0')}:00`;
  return '';
}

function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.hidden = false;
  toastTimer = setTimeout(() => {
    els.toast.hidden = true;
  }, 2400);
}

els.mainActionBtn.addEventListener('click', () => openWorkDialog(toDateKey(new Date())));
els.prevMonthBtn.addEventListener('click', () => {
  viewMonth--;
  if (viewMonth < 0) { viewMonth = 11; viewYear--; }
  render();
});
els.nextMonthBtn.addEventListener('click', () => {
  viewMonth++;
  if (viewMonth > 11) { viewMonth = 0; viewYear++; }
  render();
});
els.todayBtn.addEventListener('click', () => {
  const d = new Date();
  viewYear = d.getFullYear();
  viewMonth = d.getMonth();
  render();
});
els.clearMonthBtn.addEventListener('click', clearCurrentMonth);
els.settingsBtn.addEventListener('click', openSettings);
els.closeWorkBtn.addEventListener('click', () => closeDialog(els.workDialog));
els.closeSettingsBtn.addEventListener('click', () => closeDialog(els.settingsDialog));
els.workDialog.addEventListener('click', event => closeDialogOnBackdrop(event, els.workDialog));
els.settingsDialog.addEventListener('click', event => closeDialogOnBackdrop(event, els.settingsDialog));
els.workForm.addEventListener('submit', saveWorkForm);
els.actualStart.addEventListener('input', updatePreview);
els.actualEnd.addEventListener('input', updatePreview);
els.rateInput.addEventListener('input', updatePreview);
els.deleteShiftBtn.addEventListener('click', deleteSelectedShift);
els.settingsForm.addEventListener('submit', saveSettings);
els.clearPlanBtn.addEventListener('click', clearPlan);
els.clearAllBtn.addEventListener('click', clearAll);
els.exportBtn.addEventListener('click', exportBackup);
els.backupInput.addEventListener('change', event => importBackup(event.target.files?.[0]));
els.scheduleInput.addEventListener('change', event => importScheduleFile(event.target.files?.[0]));
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (els.workDialog.hasAttribute('open')) closeDialog(els.workDialog);
  if (els.settingsDialog.hasAttribute('open')) closeDialog(els.settingsDialog);
});

setInterval(renderToday, 60 * 1000);
render();
