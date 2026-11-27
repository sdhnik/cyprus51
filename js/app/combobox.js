// Searchable select (ARIA combobox with a list box) for a text input.
const CODES = 'AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ CA CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW'.split(' ');

let countries;
export function countryNames(exclude = ['CY']) {
  if (!countries) {
    const dn = new Intl.DisplayNames(['en'], { type: 'region' });
    countries = CODES.filter((c) => !exclude.includes(c)).map((c) => { try { return dn.of(c); } catch { return null; } }).filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'en'));
  }
  return countries;
}

let seq = 0;
export function combobox(input, options) {
  const id = `cb-${++seq}`;
  const list = document.createElement('ul');
  list.id = id;
  list.className = 'cb-list';
  list.setAttribute('role', 'listbox');
  list.hidden = true;
  input.closest('.c51-field').classList.add('cb');
  input.closest('.c51-field__box').after(list);
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', id);
  input.autocomplete = 'off';
  let items = [], active = -1;

  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const show = () => {
    const q = norm(input.value);
    const starts = options.filter((o) => norm(o).startsWith(q));
    const has = q ? options.filter((o) => !norm(o).startsWith(q) && norm(o).includes(q)) : [];
    items = starts.concat(has).slice(0, 50);
    active = items.length && q ? 0 : -1;
    list.innerHTML = items.length
      ? items.map((o, i) => `<li role="option" id="${id}-${i}" aria-selected="${i === active}">${o.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</li>`).join('')
      : '<li class="cb-none" role="presentation">No country found</li>';
    open(true);
    mark();
  };
  const open = (v) => { list.hidden = !v; input.setAttribute('aria-expanded', String(v)); if (!v) input.removeAttribute('aria-activedescendant'); };
  const mark = () => {
    list.querySelectorAll('[role=option]').forEach((li, i) => li.setAttribute('aria-selected', String(i === active)));
    if (active >= 0) { input.setAttribute('aria-activedescendant', `${id}-${active}`); list.querySelector(`#${id}-${active}`)?.scrollIntoView({ block: 'nearest' }); }
  };
  const pick = (i) => { if (items[i]) { input.value = items[i]; input.dispatchEvent(new Event('change')); } open(false); };

  input.addEventListener('input', show);
  input.addEventListener('focus', show);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (list.hidden) show(); active = Math.min(items.length - 1, active + 1); mark(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); mark(); }
    else if (e.key === 'Enter' && !list.hidden && active >= 0) { e.preventDefault(); pick(active); }
    else if (e.key === 'Escape' && !list.hidden) { e.preventDefault(); e.stopPropagation(); open(false); }
  });
  list.addEventListener('mousedown', (e) => e.preventDefault());   // keep focus in the input
  list.addEventListener('click', (e) => { const li = e.target.closest('[role=option]'); if (li) pick([...list.children].indexOf(li)); });
  input.addEventListener('blur', () => {
    open(false);
    const exact = options.find((o) => norm(o) === norm(input.value));
    if (exact) input.value = exact;
  });
  return { valid: () => options.some((o) => o === input.value) };
}
