(() => {
  const COORDS = {
    'Catcher': [50, 91],
    'Pitcher': [50, 70],
    'First Base': [77, 62],
    'Second Base': [62, 50],
    'Third Base': [23, 62],
    'Shortstop': [38, 50],
    'Left Field': [14, 29],
    'Left Center Field': [32, 20],
    'Center Field': [50, 14],
    'Right Center Field': [68, 20],
    'Right Field': [86, 29]
  };

  function ensureStyles() {
    if (document.getElementById('captainFieldStyles')) return;
    const style = document.createElement('style');
    style.id = 'captainFieldStyles';
    style.textContent = `
      .captain-field-wrap{display:grid;gap:10px}
      .captain-field{position:relative;width:100%;aspect-ratio:1/1;max-width:720px;margin:0 auto;border:1px solid var(--l);border-radius:24px;overflow:hidden;background:linear-gradient(#dff4df 0 44%,#95cb75 44% 100%)}
      .captain-field:before{content:'';position:absolute;left:50%;top:64%;width:43%;height:43%;transform:translate(-50%,-50%) rotate(45deg);background:#e8c997;border:3px solid #fff7;border-radius:4px}
      .captain-field:after{content:'';position:absolute;left:50%;top:65%;width:14%;height:14%;transform:translate(-50%,-50%) rotate(45deg);border:2px solid #fff9}
      .field-player{position:absolute;transform:translate(-50%,-50%);z-index:2;width:28%;min-width:92px;max-width:155px;text-align:center;background:#fff;border:2px solid var(--a);border-radius:14px;padding:6px 7px;box-shadow:0 3px 10px #0002;cursor:pointer}
      .field-player:focus{outline:4px solid #16653444;outline-offset:2px}
      .field-player .field-position-name{display:block;font-size:.72rem;color:var(--m);line-height:1.1;margin-bottom:2px}
      .field-player .field-person-name{display:block;font-size:.88rem;font-weight:800;line-height:1.15;overflow-wrap:anywhere}
      .field-player.unassigned{border-style:dashed;border-color:#9ca3af;background:#ffffffdd}
      .field-player.unassigned .field-person-name{color:#6b7280}
      .field-status{display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:space-between}
      .field-status .pill{background:#fff}
      @media(max-width:540px){.field-player{width:31%;min-width:76px;padding:5px 4px}.field-player .field-position-name{font-size:.63rem}.field-player .field-person-name{font-size:.74rem}.captain-field{border-radius:18px}}
    `;
    document.head.appendChild(style);
  }

  function ensureField() {
    ensureStyles();
    const lineup = document.getElementById('lineup');
    const positions = document.getElementById('positions');
    if (!lineup || !positions) return;
    let wrapper = document.getElementById('captainFieldPanel');
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.id = 'captainFieldPanel';
      wrapper.className = 'captain-field-wrap';
      wrapper.innerHTML = `
        <div class="card field-status">
          <div><strong>Live Field Layout</strong><div class="muted">Captain only • tap any field position to change it manually</div></div>
          <span id="fieldInningBadge" class="pill">Inning 1</span>
        </div>
        <div id="captainField" class="captain-field" aria-label="Live defensive field layout"></div>
      `;
      positions.parentNode.insertBefore(wrapper, positions);
    }
  }

  function currentLineup() {
    if (typeof state === 'undefined' || !state) return {};
    const inning = Number(state.fieldInning || state.gameInning || 1);
    return state.innings?.[inning] || {};
  }

  function findPositionSelect(position) {
    const positions = document.getElementById('positions');
    if (!positions) return null;
    for (const label of positions.querySelectorAll('label')) {
      const select = label.querySelector('select');
      if (!select) continue;
      const labelText = String(label.firstChild?.textContent || '').trim();
      if (labelText === position) return select;
    }
    return null;
  }

  function openPositionEditor(position) {
    const select = findPositionSelect(position);
    if (!select) return;
    try {
      select.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (_) {}
    try {
      select.focus({ preventScroll: true });
    } catch (_) {
      select.focus();
    }
    if (typeof select.showPicker === 'function') {
      try {
        select.showPicker();
      } catch (_) {}
    }
  }

  function renderCaptainField() {
    ensureField();
    const field = document.getElementById('captainField');
    const badge = document.getElementById('fieldInningBadge');
    if (!field || typeof state === 'undefined' || !state) return;
    const inning = Number(state.fieldInning || state.gameInning || 1);
    const lineup = currentLineup();
    if (badge) badge.textContent = `Inning ${inning}`;
    field.textContent = '';
    Object.entries(COORDS).forEach(([position, [left, top]]) => {
      const player = lineup[position] || '';
      const node = document.createElement('div');
      node.className = `field-player${player ? '' : ' unassigned'}`;
      node.style.left = `${left}%`;
      node.style.top = `${top}%`;
      node.tabIndex = 0;
      node.setAttribute('role', 'button');
      node.setAttribute('aria-label', `Change ${position}, currently ${player || 'Unassigned'}`);
      const positionSpan = document.createElement('span');
      positionSpan.className = 'field-position-name';
      positionSpan.textContent = position;
      const personSpan = document.createElement('span');
      personSpan.className = 'field-person-name';
      personSpan.textContent = player || 'Unassigned';
      node.appendChild(positionSpan);
      node.appendChild(personSpan);
      const activate = () => openPositionEditor(position);
      node.addEventListener('click', activate);
      node.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        activate();
      });
      field.appendChild(node);
    });
  }

  function bindPositionChanges() {
    const positions = document.getElementById('positions');
    if (!positions) return;
    positions.querySelectorAll('select').forEach(select => {
      if (select.dataset.fieldBound === '1') return;
      select.dataset.fieldBound = '1';
      select.addEventListener('change', () => requestAnimationFrame(renderCaptainField));
    });
  }

  function install() {
    if (typeof renderLineup !== 'function') {
      setTimeout(install, 50);
      return;
    }
    if (window.__captainFieldInstalled) return;
    window.__captainFieldInstalled = true;
    const originalRenderLineup = renderLineup;
    renderLineup = function(...args) {
      const result = originalRenderLineup.apply(this, args);
      ensureField();
      bindPositionChanges();
      renderCaptainField();
      return result;
    };
    ensureField();
    bindPositionChanges();
    renderCaptainField();
  }

  install();
})();