
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const $ = (s, el = document) => el.querySelector(s);
const create = (tag, attrs = {}, kids = []) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k === 'style') el.setAttribute('style', v);
    else if (k === 'innerHTML') el.innerHTML = v;
    else el[k] = v;
  }
  kids.forEach(k => el.appendChild(typeof k === 'string' ? document.createTextNode(k) : k));
  return el;
};
function throttle(fn, ms = 100) { let t = 0; return (...a) => { const n = Date.now(); if (n - t >= ms) { t = n; fn(...a); } }; }

const CLEAN_PHRASE = /with\s+rctc\s+trigger\s+codes/ig;

window.addEventListener('load', () => {
  document.body.classList.add('clean-ui-v8_1');

  // Hide title + tagline near the top
  $$('h1, h2, h3, p').forEach(el => {
    const t = (el.textContent || '').toLowerCase();
    if (el.offsetTop < 400 && (t.includes('eicr generator') || t.includes('electronic initial case report'))) {
      el.style.display = 'none';
    }
  });

  // Force main wrapper wide
  const firstH2 = $('h2');
  if (firstH2) {
    let wrapper = firstH2.parentElement, chosen = null, viewport = innerWidth;
    while (wrapper && wrapper !== document.body) {
      const rect = wrapper.getBoundingClientRect();
      const cs = getComputedStyle(wrapper);
      const maxw = parseFloat(cs.maxWidth) || rect.width;
      if (maxw && maxw < viewport * 0.9) chosen = wrapper;
      wrapper = wrapper.parentElement;
    }
    if (chosen) chosen.classList.add('ui81-force-wide');
  }


  // Sidenav
  const headings = $$('h2');
  if (headings.length) {
    const nav = create('nav', { class: 'ui81-sidenav' });
    nav.appendChild(create('h4', { innerHTML: 'Sections' }));
    const list = create('ul', { class: 'nav-list' });
    headings.forEach((h, i) => {
      if (!h.id) h.id = 'sec-' + (i + 1);

      // Extract icon and text separately
      const iconEl = h.querySelector('i');
      const icon = iconEl ? iconEl.outerHTML + ' ' : '';
      const textOnly = (h.textContent || '').replace(CLEAN_PHRASE, '').replace(/\s{2,}/g, ' ').trim();
      const label = icon + textOnly;

      const a = create('a', { href: '#' + h.id, title: textOnly }, []);
      a.innerHTML = label; // Use innerHTML to preserve icon
      a.addEventListener('click', e => {
        e.preventDefault();
        document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Close drawer on mobile after selection
        if (window.innerWidth <= 980) {
          nav.classList.remove('drawer-open');
          const brand = $('.ui81-brand');
          if (brand) brand.classList.remove('drawer-open');
          const overlay = $('.ui81-drawer-overlay');
          if (overlay) overlay.classList.remove('active');
        }
      });
      list.appendChild(create('li', {}, [a]));
    });
    nav.appendChild(list);
    document.body.appendChild(nav);
    document.body.classList.add('has-sidenav');

    // Mobile drawer: FAB + overlay
    const fab = create('button', { class: 'ui81-toc-fab', innerHTML: '<i class="fas fa-bars"></i>' });
    const overlay = create('div', { class: 'ui81-drawer-overlay' });

    fab.addEventListener('click', () => {
      const isOpen = nav.classList.contains('drawer-open');
      nav.classList.toggle('drawer-open', !isOpen);
      overlay.classList.toggle('active', !isOpen);
      fab.innerHTML = isOpen ? '<i class="fas fa-bars"></i>' : '<i class="fas fa-times"></i>';
      const brand = $('.ui81-brand');
      if (brand) brand.classList.toggle('drawer-open', !isOpen);
    });

    overlay.addEventListener('click', () => {
      nav.classList.remove('drawer-open');
      overlay.classList.remove('active');
      fab.innerHTML = '<i class="fas fa-bars"></i>';
      const brand = $('.ui81-brand');
      if (brand) brand.classList.remove('drawer-open');
    });

    document.body.appendChild(fab);
    document.body.appendChild(overlay);


    // Scrollspy + fit nav
    const links = $$('a', nav);
    const map = new Map(headings.map((h, i) => [h.id, links[i]]));
    const io = new IntersectionObserver(entries => {
      entries.forEach(ent => {
        if (ent.isIntersecting) {
          const id = ent.target.id;
          links.forEach(l => l.classList.remove('active'));
          const ln = map.get(id); if (ln) ln.classList.add('active');
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px', threshold: [0, 1] });
    headings.forEach(h => io.observe(h));

    const root = document.documentElement;
    const fitNav = throttle(() => {
      const avail = innerHeight - nav.getBoundingClientRect().top - 16;
      if (nav.scrollHeight <= avail) return;
      let font = parseFloat(getComputedStyle(nav).getPropertyValue('--nav-font')) || 11;
      let pad = parseFloat(getComputedStyle(nav).getPropertyValue('--nav-pad-v')) || 5;
      let guard = 0;
      while (nav.scrollHeight > avail && guard < 24) {
        if (font > 9.5) font -= 0.5;
        if (pad > 2) pad -= 0.5;
        root.style.setProperty('--nav-font', font + 'px');
        root.style.setProperty('--nav-pad-v', pad + 'px');
        guard++;
      }
    }, 60);
    fitNav(); addEventListener('resize', fitNav);
  }

  // Cards; hide H2 only when card applied
  headings.forEach((h) => {
    let sib = h.nextElementSibling;
    while (sib && sib.tagName && sib.tagName.toLowerCase() === 'hr') sib = sib.nextElementSibling;
    if (sib && !sib.classList.contains('ui81-card')) {
      sib.classList.add('ui81-card');
      const label = (h.textContent || '').replace(CLEAN_PHRASE, '').replace(/\s{2,}/g, ' ').trim();
      const hasTitle = sib.querySelector('h3, header, legend, .title, .section-title');
      if (!hasTitle) sib.prepend(create('div', { class: 'ui81-card-title' }, [create('span', { class: 'pill', innerHTML: 'Section' }), document.createTextNode(' ' + label)]));
      h.classList.add('ui81-visually-hidden');
    }
  });

  // Floating dock — always visible; wire to originals; don't hide our own buttons
  const dock = create('div', { class: 'ui81-dock' });
  const mk = (t, extra = '') => create('button', { class: 'ui81-btn ' + extra, innerHTML: t });

  // Create a dropdown for templates
  const templateSelect = create('select', {
    class: 'ui81-template-select'
  });
  templateSelect.innerHTML = `
  <option value="">📋 Load Template...</option>
  <option value="AnimalBites.json">Animal Bites</option>
  <option value="Spina Bifida (Disorders) (ICD10CM).json">Spina Bifida</option>
  <option value="NAS.json">Neonatal Abstinence Syndrome</option>
  <option value="SB.json">Cervical Spina Bifida</option>
  <option value="TF.json">Tetralogy of Fallot</option>
  <option value="hepatitis_b_medication_test.json">Medication</option>
`;

  const bLoad = mk('<i class="fas fa-folder-open"></i> Load Form', 'ghost');
  const bSave = mk('<i class="fas fa-save"></i> Save Form', 'secondary');
  const bCDA = mk('<i class="fas fa-file-code"></i> Generate eICR');
  const bRR = mk('<i class="fas fa-file-medical"></i> Generate RR', 'secondary');
  const bZIP = mk('<i class="fas fa-file-archive"></i> Package ZIP', 'ghost');

  // Add template functionality
  templateSelect.addEventListener('change', async function () {
    if (this.value) {
      // Call the function you'll add to the main HTML
      if (typeof window.loadFormDataFromAssets === 'function') {
        await window.loadFormDataFromAssets(this.value);
        this.value = ''; // Reset dropdown
      }
    }
  });

  dock.append(templateSelect, bLoad, bSave, bCDA, bRR, bZIP);
  document.body.appendChild(dock);

  const actionsQuery = () => $$('button, a, [role="button"], input[type="button"], input[type="submit"]');
  const byText = (rx) => actionsQuery().find(el => rx.test((el.textContent || el.value || '').trim()));

  const targets = {
    load: () => (byText(/load\s*form\s*data/i)),
    save: () => (byText(/save\s*form\s*data/i)),
    cda: () => (document.getElementById('generate-cda-btn') || byText(/generate\s*cda(?!.*post)/i)),
    rr: () => (document.getElementById('generate-rr-btn') || byText(/generate\s*rr/i)),
    zip: () => (document.getElementById('zip-btn') || byText(/download\s*zip.*eicr.*rr/i) || byText(/\bzip\b/i)),
    s3: () => (byText(/generate\s*&?\s*post.*s3/i))
  };

  const wire = (btn, getter) => {
    let target = getter();
    const tryBind = () => { target = getter(); return !!target; };
    btn.addEventListener('click', () => {
      if (!target && !tryBind()) return console.warn('Action target not found for', btn.textContent);
      if (typeof target.click === 'function') target.click();
      else if (target.dispatchEvent) target.dispatchEvent(new Event('click', { bubbles: true }));
    });
    const mo = new MutationObserver(() => { if (!target) tryBind(); });
    mo.observe(document.body, { childList: true, subtree: true });
  };
  wire(bLoad, targets.load);
  wire(bSave, targets.save);
  wire(bCDA, targets.cda);
  wire(bRR, targets.rr);
  wire(bZIP, targets.zip);

  // Hide original toolbar buttons by label, but NEVER hide anything inside our dock
  const hideLabels = [
    /generate\s*cda(?!.*post)/i,
    /generate\s*rr/i,
    /download\s*zip.*eicr.*rr/i,
    /\bload\s*form\s*data\b/i,
    /\bsave\s*form\s*data\b/i
    // Don't hide template-related elements
  ];
  actionsQuery().forEach(el => {
    if (el.closest('.ui81-dock')) return; // don't hide our dock
    if (el.classList.contains('ui81-template-select')) return; // don't hide template dropdown
    const txt = (el.textContent || el.value || '').trim();
    if (hideLabels.some(rx => rx.test(txt))) el.style.display = 'none';
  });
});
