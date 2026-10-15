'use strict';

// Демонстрация без backend. Состояние хранится локально в браузере.
const CAPACITY = 12;
const STORAGE_KEY = 'smart-parking-demo-v1';
const $ = (selector) => document.querySelector(selector);
const formatTime = () => new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const formatClock = () => new Date().toLocaleString('ru-RU', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' });
const emptyState = () => ({ spots: Array(CAPACITY).fill(null), logs: [] });

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || !Array.isArray(saved.spots) || saved.spots.length !== CAPACITY ||
      !saved.spots.every(s => s === null || (typeof s === 'string' && s.length <= 12)) ||
      !Array.isArray(saved.logs)) return emptyState();
    return { spots: saved.spots, logs: saved.logs.slice(0, 30) };
  } catch { return emptyState(); }
}
let state = loadState();
let busy = false;

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { showNotice('Не удалось сохранить данные в браузере.', 'error'); }
}
function normalizePlate(value) {
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
}
function showNotice(message, type = '') {
  const el = $('#notice');
  el.textContent = message;
  el.className = 'notice' + (type ? ` ${type}` : '');
}
function addLog(event, plate, spot, result, error = false) {
  state.logs.unshift({ time: formatTime(), event, plate, spot: spot == null ? '—' : `P${String(spot + 1).padStart(2, '0')}`, result, error });
  state.logs = state.logs.slice(0, 30);
  save(); render();
}
function render() {
  const occupied = state.spots.filter(Boolean).length;
  const free = CAPACITY - occupied;
  $('#totalCount').textContent = CAPACITY;
  $('#freeCount').textContent = free;
  $('#occupiedCount').textContent = occupied;
  $('#occupancyPercent').textContent = `${Math.round(occupied / CAPACITY * 100)}%`;
  $('#occupancyBar').style.width = `${occupied / CAPACITY * 100}%`;
  $('#parkingGrid').replaceChildren();
  state.spots.forEach((plate, idx) => {
    const spot = document.createElement('button');
    spot.type = 'button';
    spot.className = `spot${plate ? ' occupied' : ''}`;
    spot.title = plate ? `Место ${idx + 1}: ${plate}. Нажмите для выбора` : `Место ${idx + 1}: свободно`;
    spot.setAttribute('aria-label', spot.title);
    const number = document.createElement('span'); number.className = 'spot-num'; number.textContent = `P${String(idx + 1).padStart(2, '0')}`;
    const icon = document.createElement('span'); icon.className = 'spot-icon'; icon.textContent = plate ? '🚗' : '+';
    const description = document.createElement('span'); description.className = 'spot-plate'; description.textContent = plate || 'СВОБОДНО';
    spot.append(number, icon, description);
    if (plate) spot.addEventListener('click', () => { $('#plateInput').value = plate; showNotice(`Выбран автомобиль ${plate} на месте P${String(idx + 1).padStart(2, '0')}.`); $('#plateInput').focus(); });
    $('#parkingGrid').append(spot);
  });
  $('#logBody').replaceChildren();
  if (!state.logs.length) {
    const tr = document.createElement('tr'); const td = document.createElement('td');
    td.colSpan = 5; td.className = 'empty'; td.textContent = 'Событий пока нет. Добавьте первый автомобиль.';
    tr.append(td); $('#logBody').append(tr);
  }
  state.logs.forEach(item => {
    const row = document.createElement('tr');
    [item.time, item.event, item.plate, item.spot, item.result].forEach((v, i) => {
      const td = document.createElement('td'); td.textContent = v;
      if (i === 4 && item.error) td.className = 'event-error';
      row.append(td);
    });
    $('#logBody').append(row);
  });
}
function gate(open) {
  $('#gateArm').classList.toggle('open', open);
  $('#gateStatus').classList.toggle('open', open);
  $('#gateStatus').textContent = open ? '● ОТКРЫТ' : '● ЗАКРЫТ';
  $('#carShape').classList.toggle('move', open);
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function operate(direction) {
  if (busy) return;
  const plate = normalizePlate($('#plateInput').value);
  const event = direction === 'in' ? 'Въезд' : 'Выезд';
  if (!plate || plate.length < 3 || !/^[A-ZА-ЯЁ0-9 -]+$/u.test(plate)) {
    showNotice('Введите корректный номер: 3–12 символов, буквы и цифры.', 'error');
    return;
  }
  const current = state.spots.indexOf(plate);
  let spot;
  if (direction === 'in') {
    if (current !== -1) { showNotice(`Автомобиль ${plate} уже на парковке.`, 'error'); addLog(event, plate, current, 'Отказ: дубликат', true); return; }
    spot = state.spots.indexOf(null);
    if (spot === -1) { showNotice('Парковка заполнена. Шлагбаум закрыт. Въезд запрещён.', 'error'); addLog(event, plate, null, 'Отказ: нет мест', true); return; }
  } else {
    if (current === -1) { showNotice(`Автомобиль ${plate} не найден на парковке.`, 'error'); addLog(event, plate, null, 'Отказ: не найден', true); return; }
    spot = current;
  }
  busy = true;
  $('#entryBtn').disabled = $('#exitBtn').disabled = true;
  gate(true);
  if (direction === 'in') state.spots[spot] = plate;
  else state.spots[spot] = null;
  addLog(event, plate, spot, 'Успешно');
  showNotice(`${event}: ${plate}. Место P${String(spot + 1).padStart(2, '0')}. Шлагбаум открыт.`, 'success');
  await delay(1400);
  gate(false);
  busy = false;
  $('#entryBtn').disabled = $('#exitBtn').disabled = false;
  $('#plateInput').value = '';
}
$('#entryBtn').addEventListener('click', () => operate('in'));
$('#exitBtn').addEventListener('click', () => operate('out'));
$('#plateInput').addEventListener('keydown', event => { if (event.key === 'Enter') operate('in'); });
$('#resetBtn').addEventListener('click', () => {
  if (busy) return;
  if (!window.confirm('Очистить все места и историю событий?')) return;
  state = emptyState(); save(); render(); gate(false);
  $('#plateInput').value = ''; showNotice('Демонстрация сброшена. Все места свободны.', 'success');
});
$('#clock').textContent = formatClock();
setInterval(() => { $('#clock').textContent = formatClock(); }, 30000);
render();
