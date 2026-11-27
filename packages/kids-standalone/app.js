// AI Prompt School - Single Page Application Core Engine

(function () {
  'use strict';

  // --- STATE INITIALIZATION ---
  const state = {
    lang: localStorage.getItem('kids-lang') || 'tr',
    view: 'home', // 'home' | 'map' | 'level'
    homeStep: 0,
    currentLevelSlug: null,
    currentSection: 0,
    progress: loadProgress(),
    sectionStates: loadSectionStates(),
    modalOpen: false
  };

  function loadProgress() {
    try {
      const data = localStorage.getItem('kids-progress');
      if (data) return JSON.parse(data);
    } catch (e) {}
    return { levels: {}, totalStars: 0, currentLevel: '1-1-meet-promi' };
  }

  function saveProgress() {
    try {
      localStorage.setItem('kids-progress', JSON.stringify(state.progress));
    } catch (e) {}
  }

  function loadSectionStates() {
    try {
      const data = localStorage.getItem('kids-section-state');
      if (data) return JSON.parse(data);
    } catch (e) {}
    return {};
  }

  function saveSectionStates() {
    try {
      localStorage.setItem('kids-section-state', JSON.stringify(state.sectionStates));
    } catch (e) {}
  }

  function t(path, fallback = '') {
    const i18n = window.KIDS_DATA.i18n[state.lang] || window.KIDS_DATA.i18n.tr;
    const parts = path.split('.');
    let curr = i18n;
    for (const p of parts) {
      if (curr && curr[p] !== undefined) {
        curr = curr[p];
      } else {
        return fallback || path;
      }
    }
    return curr;
  }

  function renderFooterCredits() {
    return `
      <div class="footer-credits">
        <a href="https://github.com/f" target="_blank" rel="noopener noreferrer" class="credit-link" title="Fatih Kadir Akın (prompts.chat)">
          <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
          <span>github.com/f</span>
        </a>
        <span class="credit-sep">•</span>
        <a href="https://github.com/abdbali" target="_blank" rel="noopener noreferrer" class="credit-link" title="Abdurrahman Bali">
          <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
          <span>github.com/abdbali</span>
        </a>
      </div>
    `;
  }

  // --- HELPER QUERIES ---
  function getAllLevels() {
    return window.KIDS_DATA.worlds.flatMap(w => w.levels);
  }

  function getLevelBySlug(slug) {
    return getAllLevels().find(l => l.slug === slug);
  }

  function isLevelUnlocked(slug) {
    const levels = getAllLevels();
    const idx = levels.findIndex(l => l.slug === slug);
    if (idx === 0) return true;
    const prev = levels[idx - 1];
    return state.progress.levels[prev.slug]?.completed || false;
  }

  function getCompletedCount() {
    return Object.values(state.progress.levels).filter(l => l.completed).length;
  }

  function completeCurrentLevel(stars = 3) {
    const slug = state.currentLevelSlug;
    if (!slug) return;
    const prevStars = state.progress.levels[slug]?.stars || 0;
    const newStars = Math.max(prevStars, stars);
    const diff = newStars - prevStars;

    state.progress.levels[slug] = {
      completed: true,
      stars: newStars,
      completedAt: new Date().toISOString()
    };
    state.progress.totalStars += diff;

    // unlock next
    const all = getAllLevels();
    const idx = all.findIndex(l => l.slug === slug);
    if (idx < all.length - 1) {
      state.progress.currentLevel = all[idx + 1].slug;
    }
    saveProgress();
    updateHeaderStats();
    triggerConfetti();
    window.audioManager.playFanfare();
  }

  // --- MARKDOWN MINIPARSER ---
  function renderMarkdown(md) {
    if (!md) return '';
    let html = md
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>')
      .replace(/^\s*❌\s+(.*$)/gim, '<li style="list-style:none;">❌ $1</li>')
      .replace(/^\s*✅\s+(.*$)/gim, '<li style="list-style:none;">✅ $1</li>');

    // wrap orphan paragraphs
    html = html.split('\n\n').map(block => {
      block = block.trim();
      if (!block) return '';
      if (block.startsWith('<h') || block.startsWith('<li') || block.startsWith('<div')) return block;
      return `<p>${block.replace(/\n/g, '<br>')}</p>`;
    }).join('\n');

    return html;
  }

  // --- HEADER & NAVIGATION ---
  function updateHeaderStats() {
    const starEl = document.getElementById('stat-stars');
    const lvlEl = document.getElementById('stat-levels');
    if (starEl) starEl.innerText = state.progress.totalStars || 0;
    if (lvlEl) lvlEl.innerText = `${getCompletedCount()}/${getAllLevels().length}`;
  }

  function setView(viewName, levelSlug = null) {
    state.view = viewName;
    if (levelSlug) {
      state.currentLevelSlug = levelSlug;
      state.currentSection = 0;
    }
    window.audioManager.playClick();
    renderApp();
  }

  // --- RENDER VIEWS ---

  // 1. HOME VIEW
  function renderHomeView() {
    const totalSteps = 3;
    const step = state.homeStep;
    const homeT = window.KIDS_DATA.i18n[state.lang].home;

    let contentHtml = '';

    if (step === 0) {
      contentHtml = `
        <div class="home-card">
          <div class="home-badge pixel-border-sm">
            ${window.PixelArt.star(true, 'w-5 h-5')}
            <span>${homeT.badge}</span>
          </div>
          <h1 class="home-h1 pixel-text-shadow">${homeT.title}</h1>
          <p class="home-subtitle">${homeT.subtitle}</p>

          <div class="pixel-panel home-promi-box">
            <div style="flex-shrink:0;">
              ${window.PixelArt.robot({ mood: 'happy', width: 64, height: 80 })}
            </div>
            <div>
              <p style="font-size: 1.6rem; font-weight: bold; margin-bottom: 6px; color: #2C1810;">
                ${homeT.promiIntro.greeting}
              </p>
              <p style="font-size: 1.25rem; color: #5D4037; line-height: 1.4;">
                ${homeT.promiIntro.message}
              </p>
            </div>
          </div>
        </div>
      `;
    } else if (step === 1) {
      contentHtml = `
        <div class="home-card">
          <h2 class="home-h1 pixel-text-shadow" style="font-size: 2.5rem; margin-bottom: 20px;">
            ${homeT.whatYouLearn}
          </h2>
          <div class="features-grid">
            <div class="pixel-panel pixel-panel-green feature-item">
              ${window.PixelArt.gamepad()}
              <div>
                <h3>${homeT.features.games.title}</h3>
                <p>${homeT.features.games.description}</p>
              </div>
            </div>
            <div class="pixel-panel pixel-panel-blue feature-item">
              ${window.PixelArt.book()}
              <div>
                <h3>${homeT.features.stories.title}</h3>
                <p>${homeT.features.stories.description}</p>
              </div>
            </div>
            <div class="pixel-panel feature-item">
              <div style="display: flex; gap: 4px;">
                ${window.PixelArt.star(true, 'w-8 h-8')}
                ${window.PixelArt.star(true, 'w-8 h-8')}
                ${window.PixelArt.star(true, 'w-8 h-8')}
              </div>
              <div>
                <h3>${homeT.features.stars.title}</h3>
                <p>${homeT.features.stars.description}</p>
              </div>
            </div>
          </div>
        </div>
      `;
    } else if (step === 2) {
      contentHtml = `
        <div class="home-card">
          <div style="display: flex; justify-content: center; align-items: flex-end; gap: 16px; margin-bottom: 24px;">
            ${window.PixelArt.tree('w-12 h-16')}
            <div class="animate-bounce-slow">
              ${window.PixelArt.robot({ mood: 'excited', width: 64, height: 80 })}
            </div>
            ${window.PixelArt.castle('w-14 h-14')}
          </div>
          <h2 class="home-h1 pixel-text-shadow" style="font-size: 2.5rem; margin-bottom: 12px;">
            ${homeT.readyTitle}
          </h2>
          <p class="home-subtitle" style="margin-bottom: 24px;">
            ${homeT.readyMessage}
          </p>
          <button id="btn-start-game" class="pixel-btn pixel-btn-green" style="font-size: 1.5rem; padding: 14px 28px;">
            ${window.PixelArt.playIcon()}
            <span>${homeT.startButton}</span>
          </button>
          <p style="margin-top: 18px; font-size: 1rem; color: #8B7355;">
            ${homeT.ageNote}
          </p>
        </div>
      `;
    }

    return `
      <div class="view-home">
        ${contentHtml}
      </div>
      <footer class="app-footer">
        <div class="footer-nav">
          <button id="btn-home-prev" class="pixel-btn" ${step === 0 ? 'style="visibility:hidden;"' : ''}>
            ${window.PixelArt.arrowLeft()}
            <span>${t('navigation.back', 'Geri')}</span>
          </button>

          <div class="step-indicators">
            ${[0, 1, 2].map(i => `
              <div class="step-dot ${i === step ? 'active' : ''} ${i < step ? 'completed' : ''}" data-step="${i}"></div>
            `).join('')}
          </div>

          <button id="btn-home-next" class="pixel-btn pixel-btn-green">
            <span>${step === totalSteps - 1 ? homeT.startButton : t('navigation.next', 'İleri')}</span>
            ${window.PixelArt.arrowRight()}
          </button>
        </div>
        ${renderFooterCredits()}
      </footer>
    `;
  }

  // 2. PROGRESS MAP VIEW
  function renderMapView() {
    const allLevels = getAllLevels();
    const mapWidth = Math.max(allLevels.length * 200 + 400, 1400);
    const canvasHeight = 540;

    // Calculate level coordinates in gentle wave
    const positions = allLevels.map((lvl, index) => {
      const x = 140 + index * 200;
      const y = 260 + Math.sin(index * 0.8) * 80;
      return { x, y, level: lvl, index };
    });

    // Generate stair-step pixel path matching 1:1 node positions
    let pathD = `M ${positions[0].x} ${positions[0].y}`;
    for (let i = 1; i < positions.length; i++) {
      const prev = positions[i - 1];
      const curr = positions[i];
      const midX = (prev.x + curr.x) / 2;
      pathD += ` H ${midX} V ${curr.y} H ${curr.x}`;
    }

    // World Banners
    let worldBannersHtml = '';
    window.KIDS_DATA.worlds.forEach(w => {
      const firstIdx = allLevels.findIndex(l => l.world === w.number);
      if (firstIdx !== -1) {
        const posX = positions[firstIdx].x;
        const worldTitle = state.lang === 'tr' ? (w.title_tr || w.title) : w.title;
        worldBannersHtml += `
          <div class="world-badge-banner" style="left: ${posX + 40}px;">
            ${w.emoji} World ${w.number}: ${worldTitle}
          </div>
        `;
      }
    });

    // Level Nodes HTML
    let levelNodesHtml = '';
    positions.forEach((pos, idx) => {
      const slug = pos.level.slug;
      const unlocked = isLevelUnlocked(slug);
      const prog = state.progress.levels[slug];
      const isCompleted = prog?.completed || false;
      const stars = prog?.stars || 0;
      const isCurrent = state.progress.currentLevel === slug || (!isCompleted && unlocked);

      let nodeClass = 'level-node';
      if (isCompleted) nodeClass += ' completed';
      else if (isCurrent) nodeClass += ' current';
      else if (unlocked) nodeClass += ' unlocked';
      else nodeClass += ' locked';

      const title = state.lang === 'tr' ? (pos.level.title_tr || pos.level.title) : pos.level.title;
      // Show clean level identifier e.g. "1-1", "1-2", "2-1"
      const slugParts = pos.level.slug.split('-');
      const levelNumText = `${pos.level.world || slugParts[0]}-${pos.level.levelNumber || slugParts[1]}`;

      levelNodesHtml += `
        <div class="${nodeClass}" style="left: ${pos.x}px; top: ${pos.y}px;" data-level-slug="${slug}" data-unlocked="${unlocked}">
          <div class="level-node-circle">
            ${unlocked
              ? `<span class="level-node-num">${levelNumText}</span>`
              : window.PixelArt.lock()}
          </div>
          <div class="level-node-stars">
            ${[1, 2, 3].map(s => window.PixelArt.star(s <= stars, 'w-4 h-4')).join('')}
          </div>
          <div class="level-node-label">${title}</div>
        </div>
      `;
    });

    // Scenery along landscape
    const sceneryHtml = `
      <div style="position: absolute; left: 60px; bottom: 80px;">${window.PixelArt.castle('w-20 h-20')}</div>
      <div style="position: absolute; left: 300px; bottom: 75px;">${window.PixelArt.tree('w-12 h-16')}</div>
      <div style="position: absolute; left: 520px; bottom: 70px;">${window.PixelArt.lake('w-24 h-12')}</div>
      <div style="position: absolute; left: 780px; bottom: 75px;">${window.PixelArt.tree('w-14 h-18')}</div>
      <div style="position: absolute; left: 1100px; bottom: 85px;">${window.PixelArt.mountain('w-28 h-20')}</div>
      <div style="position: absolute; left: 1400px; bottom: 75px;">${window.PixelArt.tree('w-12 h-16')}</div>
      <div style="position: absolute; left: 1750px; bottom: 80px;">${window.PixelArt.castle('w-20 h-20')}</div>
      <div style="position: absolute; left: 2100px; bottom: 70px;">${window.PixelArt.lake('w-28 h-14')}</div>
      <div style="position: absolute; left: 2600px; bottom: 85px;">${window.PixelArt.mountain('w-32 h-24')}</div>
      <div style="position: absolute; left: 3200px; bottom: 80px;">${window.PixelArt.castle('w-24 h-24')}</div>
    `;

    // Flying Cessna Plane & Driving Car
    const bannerText = state.lang === 'tr' ? 'YAPAY ZEKA ÖĞREN!' : 'LEARN AI!';
    const planeHtml = `
      <div class="map-flying-plane" id="plane-drone" style="left: 0;">
        ${window.PixelArt.planeWithBanner(bannerText)}
      </div>
    `;

    const carHtml = `
      <div class="map-car-runner">
        ${window.PixelArt.car('#E74C3C', '#C0392B', 'w-24 h-12')}
      </div>
    `;

    return `
      <div class="view-map">
        <!-- Floating desktop scroll controls -->
        <button id="btn-scroll-map-left" class="map-scroll-arrow map-scroll-left" title="Sola Kaydır">◀</button>
        <button id="btn-scroll-map-right" class="map-scroll-arrow map-scroll-right" title="Sağa Kaydır">▶</button>

        <div class="map-scroll-area" id="map-scroll">
          <div class="map-canvas" style="width: ${mapWidth}px; min-width: ${mapWidth}px; height: 100%; flex-shrink: 0;">
            ${sceneryHtml}
            ${planeHtml}
            <!-- 1:1 Pixel matched SVG Path with zero viewBox scaling distortion -->
            <svg class="map-svg-path" width="${mapWidth}" height="100%" style="position: absolute; top: 0; left: 0; width: ${mapWidth}px; height: 100%; pointer-events: none; z-index: 2;">
              <path d="${pathD}" fill="none" stroke="#8B5A2B" stroke-width="16" stroke-linecap="square" />
              <path d="${pathD}" fill="none" stroke="#D4A574" stroke-width="10" stroke-linecap="square" />
            </svg>
            ${worldBannersHtml}
            ${levelNodesHtml}
            <div class="map-ground-grass-light" style="width: ${mapWidth}px; min-width: ${mapWidth}px;"></div>
            <div class="map-ground-grass-dark" style="width: ${mapWidth}px; min-width: ${mapWidth}px;"></div>
            <div class="map-ground-dirt" style="width: ${mapWidth}px; min-width: ${mapWidth}px;"></div>
            <div class="map-road" style="width: ${mapWidth}px; min-width: ${mapWidth}px;">
              <div class="map-road-top-edge" style="width: ${mapWidth}px; min-width: ${mapWidth}px;"></div>
              <div class="map-road-dash" style="width: ${mapWidth}px; min-width: ${mapWidth}px;"></div>
              ${carHtml}
            </div>
          </div>
        </div>
      </div>
      <footer class="app-footer">
        <div class="footer-nav" style="justify-content: space-between;">
          <button id="btn-map-home" class="pixel-btn">
            ${window.PixelArt.home()}
            <span>${t('header.home', 'Ana Sayfa')}</span>
          </button>
          <div style="display: flex; align-items: center; gap: 12px; width: 60%; max-width: 400px;">
            <div style="font-weight: bold; color: #FFD700; white-space: nowrap;">
              ${getCompletedCount()} / ${allLevels.length}
            </div>
            <div style="flex: 1; height: 18px; background: #4A3728; border: 2px solid #8B4513; border-radius: 4px; overflow: hidden; position: relative;">
              <div style="height: 100%; background: #22C55E; width: ${(getCompletedCount() / allLevels.length) * 100}%; transition: width 0.3s;"></div>
            </div>
          </div>
        </div>
        ${renderFooterCredits()}
      </footer>
    `;
  }

  // 3. LEVEL PLAYER VIEW
  function renderLevelView() {
    const slug = state.currentLevelSlug || '1-1-meet-promi';
    const levelInfo = getLevelBySlug(slug);
    const langData = window.KIDS_DATA.levels[state.lang] || window.KIDS_DATA.levels.tr;
    const sections = langData[slug] || [];
    if (state.currentSection >= sections.length) {
      state.currentSection = Math.max(0, sections.length - 1);
    }
    const secIdx = state.currentSection;
    const section = sections[secIdx];
    const isFirst = secIdx === 0;
    const isLast = secIdx === sections.length - 1;

    const secKey = `${slug}_${secIdx}`;
    const isCompleted = state.sectionStates[secKey] || false;

    // Check if section requires interaction completion
    let hasInteractive = false;
    if (section && section.elements) {
      hasInteractive = section.elements.some(el => [
        'wordpredictor', 'promptvsmistake', 'dragdropprompt', 'magicwords',
        'promptparts', 'examplematcher', 'stepbystep', 'promptdoctor', 'promptlab'
      ].includes(el.type));
    }
    const canAdvance = !hasInteractive || isCompleted;

    let elementsHtml = '';
    if (section && section.elements) {
      section.elements.forEach((el, elIdx) => {
        elementsHtml += renderElement(el, elIdx, slug, secIdx);
      });
    }

    const title = state.lang === 'tr' ? (levelInfo?.title_tr || levelInfo?.title) : levelInfo?.title;
    const slugParts = slug.split('-');
    const levelNumText = `${levelInfo?.world || slugParts[0]}-${levelInfo?.levelNumber || slugParts[1]}`;

    return `
      <div class="view-level">
        <div class="level-slide-container">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
            <button id="btn-level-back-map" class="pixel-btn pixel-btn-amber" style="padding: 6px 12px; font-size: 0.9rem;">
              ${window.PixelArt.mapIcon()}
              <span>${t('level.backToMap', 'Haritaya Dön')}</span>
            </button>
            <div style="background: rgba(44, 24, 16, 0.88); color: #FFD700; padding: 5px 14px; border-radius: 6px; font-weight: bold; border: 2px solid #8B4513;">
              World ${levelInfo?.world || slugParts[0]} • Seviye ${levelNumText}: ${title}
            </div>
          </div>

          <div class="kids-prose">
            ${elementsHtml}
          </div>
        </div>
      </div>

      <footer class="app-footer">
        <div class="footer-nav">
          <button id="btn-sec-prev" class="pixel-btn" ${isFirst ? 'style="visibility:hidden;"' : ''}>
            ${window.PixelArt.arrowLeft()}
            <span>${t('navigation.back', 'Geri')}</span>
          </button>

          <div class="step-indicators">
            ${sections.map((_, i) => `
              <div class="step-dot ${i === secIdx ? 'active' : ''} ${i < secIdx ? 'completed' : ''}" data-sec="${i}"></div>
            `).join('')}
          </div>

          ${isLast ? `
            <button id="btn-finish-level" class="pixel-btn pixel-btn-amber">
              <span>${t('levelComplete.allDone', 'Haritaya Dön')}</span>
              ${window.PixelArt.mapIcon()}
            </button>
          ` : `
            <button id="btn-sec-next" class="pixel-btn pixel-btn-green" ${!canAdvance ? 'disabled' : ''} title="${!canAdvance ? t('navigation.completeFirst', 'Önce etkinliği tamamla!') : ''}">
              <span>${t('navigation.next', 'İleri')}</span>
              ${window.PixelArt.arrowRight()}
            </button>
          `}
        </div>
        ${renderFooterCredits()}
      </footer>
    `;
  }

  // --- COMPONENT RENDERERS ---
  function renderElement(el, idx, levelSlug, secIdx) {
    switch (el.type) {
      case 'markdown':
        return renderMarkdown(el.text);

      case 'panel':
        return `
          <div class="promi-speech-box">
            <div style="flex-shrink:0;">
              ${window.PixelArt.robot({ mood: el.mood || 'happy', width: 44, height: 55 })}
            </div>
            <div class="promi-speech-bubble">
              ${renderMarkdown(el.text)}
            </div>
          </div>
        `;

      case 'wordpredictor':
        return renderWordPredictor(el, idx, levelSlug, secIdx);

      case 'promptvsmistake':
        return renderPromptVsMistake(el, idx, levelSlug, secIdx);

      case 'dragdropprompt':
        return renderDragDropPrompt(el, idx, levelSlug, secIdx);

      case 'magicwords':
        return renderMagicWords(el, idx, levelSlug, secIdx);

      case 'promptdoctor':
        return renderPromptDoctor(el, idx, levelSlug, secIdx);

      case 'promptparts':
        return renderPromptParts(el, idx, levelSlug, secIdx);

      case 'examplematcher':
        return renderExampleMatcher(el, idx, levelSlug, secIdx);

      case 'stepbystep':
        return renderStepByStep(el, idx, levelSlug, secIdx);

      case 'promptlab':
        return renderPromptLab(el, idx, levelSlug, secIdx);

      case 'levelcomplete':
        return renderLevelComplete(el, idx, levelSlug);

      default:
        return '';
    }
  }

  // 1. Word Predictor Component (Options Shuffled)
  function renderWordPredictor(el, elIdx, levelSlug, secIdx) {
    const secKey = `${levelSlug}_${secIdx}`;
    const isDone = state.sectionStates[secKey];
    const sentenceParts = (el.sentence || '___').split('___');

    // Shuffle options predictably so correct isn't always in same relative place
    const seed = (levelSlug + '_' + secIdx).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const options = [...(el.options || [])];
    for (let i = options.length - 1; i > 0; i--) {
      const j = (seed + i * 7) % (i + 1);
      [options[i], options[j]] = [options[j], options[i]];
    }

    return `
      <div class="word-predictor-box" id="widget-wp-${elIdx}">
        <h3 style="font-size: 1.4rem; color: #0284C7; margin-bottom: 8px;">💡 ${el.title || t('wordPredictor.title')}</h3>
        <p style="font-size: 1.15rem; color: #475569;">${el.instruction || t('wordPredictor.instruction')}</p>

        <div class="sentence-display">
          ${sentenceParts[0]}
          <span class="sentence-blank" id="wp-blank-${elIdx}">${isDone ? el.correctAnswer : '_______'}</span>
          ${sentenceParts[1] || ''}
        </div>

        <div class="predictor-options">
          ${options.map(opt => `
            <button class="option-btn ${isDone && opt === el.correctAnswer ? 'selected' : ''}" 
                    data-wp-opt="${opt}" 
                    data-correct="${el.correctAnswer}" 
                    data-elidx="${elIdx}"
                    ${isDone ? 'disabled' : ''}>
              ${opt}
            </button>
          `).join('')}
        </div>

        <div id="wp-feedback-${elIdx}" class="feedback-box ${isDone ? 'feedback-success' : ''}" style="${isDone ? '' : 'display:none;'}">
          ${isDone ? `🎉 ${el.successMessage || t('wordPredictor.correct')}<br><small>${el.explanation || ''}</small>` : ''}
        </div>
      </div>
    `;
  }

  // 2. Prompt Vs Mistake Component (SHUFFLED OPTIONS A / B)
  function renderPromptVsMistake(el, elIdx, levelSlug, secIdx) {
    const secKey = `${levelSlug}_${secIdx}`;
    const isDone = state.sectionStates[secKey];

    // Randomize option order based on a hash so it's mixed across questions
    const questionSeed = (levelSlug + '_' + secIdx + '_' + elIdx).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const swapOptions = questionSeed % 2 === 1;

    const opt1 = swapOptions ? { type: 'bad', text: el.bad } : { type: 'good', text: el.good };
    const opt2 = swapOptions ? { type: 'good', text: el.good } : { type: 'bad', text: el.bad };

    const opt1Class = isDone && opt1.type === 'good' ? 'correct' : '';
    const opt2Class = isDone && opt2.type === 'good' ? 'correct' : '';

    return `
      <div class="quiz-card" id="widget-pvm-${elIdx}">
        <h3 style="font-size: 1.4rem; color: #8B4513; margin-bottom: 12px;">🎯 ${el.question}</h3>
        <div class="quiz-options">
          <button class="quiz-option-btn ${opt1Class}" data-pvm-choice="${opt1.type}" data-elidx="${elIdx}" ${isDone ? 'disabled' : ''}>
            <span class="option-letter">A</span>
            <span>"${opt1.text}"</span>
          </button>
          <button class="quiz-option-btn ${opt2Class}" data-pvm-choice="${opt2.type}" data-elidx="${elIdx}" ${isDone ? 'disabled' : ''}>
            <span class="option-letter">B</span>
            <span>"${opt2.text}"</span>
          </button>
        </div>

        <div id="pvm-feedback-${elIdx}" class="feedback-box ${isDone ? 'feedback-success' : ''}" style="${isDone ? '' : 'display:none;'}">
          ${isDone ? `
            <strong>${t('quiz.correct', 'Doğru bildin!')}</strong> ${el.explanation || ''}
            <div style="margin-top: 8px; font-weight: bold; color: #2C1810;">
              🤖 Robot Rehberin: "${el.promiMessage || 'Harika bir seçim!'}"
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  // 3. Drag Drop Prompt Component
  function renderDragDropPrompt(el, elIdx, levelSlug, secIdx) {
    const secKey = `${levelSlug}_${secIdx}`;
    const isDone = state.sectionStates[secKey];
    const pieces = el.pieces || [];

    return `
      <div class="pixel-panel pixel-panel-blue" style="padding: 18px; margin: 16px 0;" id="widget-dd-${elIdx}">
        <h3 style="font-size: 1.4rem; color: #1E40AF; margin-bottom: 8px;">🧩 ${el.title || t('dragDrop.title')}</h3>
        <p style="font-size: 1.1rem; color: #3B82F6; margin-bottom: 12px;">${el.instruction || t('dragDrop.instruction')}</p>

        <div class="pieces-container" id="dd-pieces-${elIdx}">
          ${pieces.map((p, pIdx) => `
            <div class="piece-row" data-piece-idx="${pIdx}">
              <span>${p}</span>
              <div class="piece-actions">
                <button class="piece-arrow-btn" data-dd-up="${pIdx}">▲</button>
                <button class="piece-arrow-btn" data-dd-down="${pIdx}">▼</button>
              </div>
            </div>
          `).join('')}
        </div>

        <button class="pixel-btn pixel-btn-green" id="btn-check-dd-${elIdx}" ${isDone ? 'disabled' : ''}>
          ${window.PixelArt.star(true, 'w-5 h-5')}
          <span>${t('dragDrop.check', 'Kontrol Et!')}</span>
        </button>

        <div id="dd-feedback-${elIdx}" class="feedback-box ${isDone ? 'feedback-success' : ''}" style="${isDone ? '' : 'display:none;'}">
          ${isDone ? `🎉 ${el.successMessage || t('dragDrop.success')}` : ''}
        </div>
      </div>
    `;
  }

  // 4. Magic Words Component
  function renderMagicWords(el, elIdx, levelSlug, secIdx) {
    const secKey = `${levelSlug}_${secIdx}`;
    const isDone = state.sectionStates[secKey];
    const blanks = el.blanks || [];

    return `
      <div class="pixel-panel pixel-panel-amber" style="padding: 18px; margin: 16px 0;" id="widget-mw-${elIdx}">
        <h3 style="font-size: 1.4rem; color: #D97706; margin-bottom: 8px;">✨ ${el.title || t('magicWords.title')}</h3>
        <p style="font-size: 1.25rem; font-weight: bold; background: white; padding: 12px; border-radius: 8px; border: 2px dashed #D97706; margin-bottom: 12px;">
          ${el.sentence}
        </p>

        <p style="font-size: 1.1rem; color: #8B4513; margin-bottom: 8px;">${t('magicWords.dragOrTap', 'Sihirli Kelimeleri Seç:')}</p>
        <div class="magic-blanks-container">
          ${blanks.map(b => (b.answers || []).map(w => `
            <button class="magic-word-pill ${isDone ? 'used' : ''}" data-mw-word="${w}">${w}</button>
          `).join('')).join('')}
        </div>

        <button class="pixel-btn pixel-btn-green" id="btn-check-mw-${elIdx}" ${isDone ? 'disabled' : ''}>
          ${t('magicWords.check', 'Tamamla!')}
        </button>

        <div id="mw-feedback-${elIdx}" class="feedback-box ${isDone ? 'feedback-success' : ''}" style="${isDone ? '' : 'display:none;'}">
          ${isDone ? `✨ ${el.successMessage || 'Harika kelimeler seçtin!'}` : ''}
        </div>
      </div>
    `;
  }

  // 5. Prompt Doctor Component
  function renderPromptDoctor(el, elIdx, levelSlug, secIdx) {
    const secKey = `${levelSlug}_${secIdx}`;
    const isDone = state.sectionStates[secKey];
    const problems = el.problems || [];

    return `
      <div class="pixel-panel" style="background: white; border: 3px solid #EF4444; padding: 18px; margin: 16px 0;" id="widget-pd-${elIdx}">
        <h3 style="font-size: 1.4rem; color: #DC2626; margin-bottom: 8px;">🏥 ${el.title || t('promptDoctor.title')}</h3>
        
        <div class="doctor-broken-box">
          <strong>${t('promptDoctor.sick', 'Hasta Prompt')}:</strong> "${el.brokenPrompt}"
        </div>

        <p style="font-size: 1.1rem; color: #5D4037;">${t('promptDoctor.diagnose', 'Sorunları düzeltmek için tıkla:')}</p>
        <div class="doctor-problem-list">
          ${problems.map((pr, pIdx) => `
            <button class="doctor-problem-btn ${isDone ? 'fixed' : ''}" data-pd-idx="${pIdx}" data-fix="${pr.fix}">
              <div>
                <strong>🚨 ${pr.issue}:</strong> <span>${pr.symptom}</span>
              </div>
              <span style="color:#22C55E; font-weight:bold;">${isDone ? '✓ İyileşti' : '+ Düzelt'}</span>
            </button>
          `).join('')}
        </div>

        <div id="pd-healed-${elIdx}" class="feedback-box feedback-success" style="${isDone ? '' : 'display:none;'}">
          <strong>🌟 ${t('promptDoctor.healthy', 'Sağlıklı Prompt!')}:</strong> "${el.healedPrompt}"<br>
          <small>${el.successMessage || t('promptDoctor.success')}</small>
        </div>
      </div>
    `;
  }

  // 6. Prompt Parts Component
  function renderPromptParts(el, elIdx, levelSlug, secIdx) {
    const secKey = `${levelSlug}_${secIdx}`;
    const isDone = state.sectionStates[secKey];

    return `
      <div class="pixel-panel pixel-panel-purple" style="padding: 18px; margin: 16px 0;">
        <h3 style="font-size: 1.4rem; color: #7E22CE; margin-bottom: 8px;">🔍 ${el.title || t('promptParts.title')}</h3>
        <p style="font-size: 1.1rem; color: #6B21A8; margin-bottom: 12px;">${el.instruction || t('promptParts.instruction')}</p>

        <div class="parts-legend">
          <span class="part-legend-tag tag-role">🎭 ${t('promptParts.types.role', 'Rol')}</span>
          <span class="part-legend-tag tag-task">✏️ ${t('promptParts.types.task', 'Görev')}</span>
          <span class="part-legend-tag tag-context">📖 ${t('promptParts.types.context', 'Bağlam')}</span>
          <span class="part-legend-tag tag-constraint">📏 ${t('promptParts.types.constraint', 'Kısıtlama')}</span>
        </div>

        <div style="display: grid; gap: 8px;">
          ${(el.parts || []).map(p => `
            <div class="piece-row tag-${p.type}">
              <span>"${p.text}"</span>
              <span class="part-legend-tag tag-${p.type}">✓ ${p.type.toUpperCase()}</span>
            </div>
          `).join('')}
        </div>

        <button class="pixel-btn pixel-btn-green" id="btn-done-parts-${elIdx}" style="margin-top: 14px;" ${isDone ? 'disabled' : ''}>
          ${t('dragDrop.check', 'Anladım!')}
        </button>
      </div>
    `;
  }

  // 7. Example Matcher Component (Shuffled Options)
  function renderExampleMatcher(el, elIdx, levelSlug, secIdx) {
    const secKey = `${levelSlug}_${secIdx}`;
    const isDone = state.sectionStates[secKey];

    const seed = (levelSlug + '_' + secIdx).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const options = [...(el.options || [])];
    for (let i = options.length - 1; i > 0; i--) {
      const j = (seed + i * 5) % (i + 1);
      [options[i], options[j]] = [options[j], options[i]];
    }

    return `
      <div class="quiz-card" style="border-color: #2563EB;">
        <h3 style="font-size: 1.4rem; color: #1D4ED8; margin-bottom: 8px;">🔍 ${el.title || t('exampleMatcher.title')}</h3>
        <p style="font-size: 1.1rem; color: #475569;">${el.instruction || t('exampleMatcher.instruction')}</p>

        <div style="background: #EFF6FF; border: 2px solid #BFDBFE; padding: 12px; border-radius: 8px; margin: 12px 0;">
          ${(el.examples || []).map(ex => `
            <div style="margin-bottom: 6px;">👉 Girdi: "<strong>${ex.input}</strong>" ➔ Çıktı: "<strong>${ex.output}</strong>"</div>
          `).join('')}
        </div>

        <p style="font-size: 1.2rem; font-weight: bold; color: #1E3A8A; margin-bottom: 8px;">${el.question}</p>
        <div class="predictor-options">
          ${options.map(opt => `
            <button class="option-btn ${isDone && opt === el.correctAnswer ? 'selected' : ''}" 
                    data-em-opt="${opt}" 
                    data-correct="${el.correctAnswer}" 
                    data-elidx="${elIdx}"
                    ${isDone ? 'disabled' : ''}>
              ${opt}
            </button>
          `).join('')}
        </div>

        <div id="em-feedback-${elIdx}" class="feedback-box ${isDone ? 'feedback-success' : ''}" style="${isDone ? '' : 'display:none;'}">
          ${isDone ? `🎉 ${el.explanation || t('exampleMatcher.correct')}` : ''}
        </div>
      </div>
    `;
  }

  // 8. Step By Step Component
  function renderStepByStep(el, elIdx, levelSlug, secIdx) {
    const secKey = `${levelSlug}_${secIdx}`;
    const isDone = state.sectionStates[secKey];

    return `
      <div class="pixel-panel pixel-panel-green" style="padding: 18px; margin: 16px 0;">
        <h3 style="font-size: 1.4rem; color: #166534; margin-bottom: 8px;">🐾 ${el.title || t('stepByStep.title')}</h3>
        <div style="background: white; border: 2px solid #86EFAC; padding: 12px; border-radius: 8px; margin-bottom: 12px;">
          <strong>Problem:</strong> ${el.problem}
        </div>
        <div style="background: #FEE2E2; border: 1px solid #FCA5A5; padding: 10px; border-radius: 6px; margin-bottom: 12px; color: #991B1B;">
          ❌ ${t('stepByStep.withoutMagic', 'Sihirli kelimeler olmadan')}: "${el.wrongAnswer}"
        </div>

        <div style="background: #DCFCE7; border: 2px solid #22C55E; padding: 14px; border-radius: 8px; margin-bottom: 12px;">
          <div style="font-weight: bold; color: #15803D; margin-bottom: 8px;">
            ✨ "${el.magicWords || 'Adım adım düşünelim'}":
          </div>
          <ol style="margin-left: 20px; line-height: 1.6;">
            ${(el.steps || []).map(st => `<li>${st}</li>`).join('')}
          </ol>
          <div style="margin-top: 10px; font-weight: bold; color: #166534;">
            ✅ Doğru Sonuç: ${el.rightAnswer}
          </div>
        </div>

        <button class="pixel-btn pixel-btn-green" id="btn-done-sbs-${elIdx}" ${isDone ? 'disabled' : ''}>
          ${t('dragDrop.check', 'Anladım!')}
        </button>
      </div>
    `;
  }

  // 9. Prompt Lab Component
  function renderPromptLab(el, elIdx, levelSlug, secIdx) {
    const secKey = `${levelSlug}_${secIdx}`;
    const isDone = state.sectionStates[secKey];

    return `
      <div class="pixel-panel pixel-panel-blue" style="padding: 18px; margin: 16px 0;">
        <h3 style="font-size: 1.4rem; color: #1E40AF; margin-bottom: 8px;">🧪 ${el.title || t('promptLab.title')}</h3>
        <p style="font-size: 1.15rem; color: #1E3A8A; margin-bottom: 12px;">${el.scenario || ''}</p>

        <div style="background: white; border: 2px solid #93C5FD; padding: 14px; border-radius: 8px; margin-bottom: 12px;">
          <strong>Temel Prompt:</strong> "${el.basePrompt}"<br>
          <div style="margin-top: 6px; color: #475569;">🤖 Yapay Zeka: "${el.baseResponse}"</div>
        </div>

        <div style="display: grid; gap: 8px; margin-bottom: 12px;">
          ${(el.improvements || []).map(imp => `
            <div style="background: #EFF6FF; border: 1px solid #BFDBFE; padding: 10px; border-radius: 6px;">
              <strong style="color: #2563EB;">+ ${imp.label}:</strong> "${imp.prompt}"
              <div style="color: #166534; font-size: 0.95rem; margin-top: 4px;">➔ ${imp.response}</div>
            </div>
          `).join('')}
        </div>

        <button class="pixel-btn pixel-btn-green" id="btn-done-lab-${elIdx}" ${isDone ? 'disabled' : ''}>
          ${t('dragDrop.check', 'Harika!')}
        </button>
      </div>
    `;
  }

  // 10. Level Complete Component
  function renderLevelComplete(el, idx, levelSlug) {
    // Automatically trigger level complete in state
    setTimeout(() => {
      completeCurrentLevel(el.stars || 3);
    }, 100);

    return `
      <div class="pixel-panel pixel-panel-green complete-panel">
        <div style="margin-bottom: 16px;">
          ${window.PixelArt.robot({ mood: 'celebrating', width: 64, height: 80, className: 'animate-bounce-slow' })}
        </div>
        <h2 class="pixel-text-shadow" style="font-size: 2.4rem; color: #2C1810; margin-bottom: 10px;">
          ${t('levelComplete.title', 'Tebrikler! Seviye Tamamlandı!')}
        </h2>
        <p style="font-size: 1.35rem; color: #5D4037; margin-bottom: 16px;">
          ${el.message || 'Harika iş! Yeni bir yetenek kazandın!'}
        </p>

        <div class="complete-stars">
          ${[1, 2, 3].map(s => `
            <div class="star-pop" style="animation-delay: ${s * 0.2}s;">
              ${window.PixelArt.star(true, 'w-12 h-12')}
            </div>
          `).join('')}
        </div>

        <button id="btn-complete-back-map" class="pixel-btn pixel-btn-amber" style="font-size: 1.25rem; padding: 12px 24px;">
          ${window.PixelArt.mapIcon()}
          <span>${t('levelComplete.backToMap', 'Haritaya Dön')}</span>
        </button>
      </div>
    `;
  }

  // --- CONFETTI PARTICLE SYSTEM ---
  function triggerConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const colors = ['#FFD700', '#22C55E', '#3B82F6', '#EF4444', '#A855F7', '#EC4899'];

    for (let i = 0; i < 90; i++) {
      particles.push({
        x: canvas.width / 2,
        y: canvas.height / 2,
        vx: (Math.random() - 0.5) * 14,
        vy: (Math.random() - 0.8) * 14,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        vr: (Math.random() - 0.5) * 12,
        alpha: 1
      });
    }

    let frame = 0;
    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.35;
        p.rotation += p.vr;
        p.alpha -= 0.012;

        if (p.alpha > 0) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
        }
      });

      frame++;
      if (frame < 120) {
        requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    requestAnimationFrame(animate);
  }

  // --- SETTINGS MODAL ---
  function openSettingsModal() {
    state.modalOpen = true;
    const modalEl = document.getElementById('settings-modal');
    if (modalEl) modalEl.style.display = 'flex';
    window.audioManager.playClick();
  }

  function closeSettingsModal() {
    state.modalOpen = false;
    const modalEl = document.getElementById('settings-modal');
    if (modalEl) modalEl.style.display = 'none';
    window.audioManager.playClick();
  }

  function resetAllProgress() {
    if (confirm(t('settings.resetWarning', 'Tüm ilerleme ve yıldızlarınız sıfırlanacak. Emin misiniz?'))) {
      state.progress = { levels: {}, totalStars: 0, currentLevel: '1-1-meet-promi' };
      state.sectionStates = {};
      saveProgress();
      saveSectionStates();
      closeSettingsModal();
      setView('map');
      updateHeaderStats();
    }
  }

  // --- ATTACH EVENT HANDLERS ---
  function attachEventHandlers() {
    // Header buttons
    const brand = document.getElementById('btn-header-brand');
    if (brand) brand.onclick = () => setView('home');

    const btnHome = document.getElementById('btn-header-home');
    if (btnHome) btnHome.onclick = () => setView('home');

    const btnMap = document.getElementById('btn-header-map');
    if (btnMap) btnMap.onclick = () => setView('map');

    const btnMusic = document.getElementById('btn-header-music');
    if (btnMusic) {
      btnMusic.onclick = () => {
        const isPlaying = window.audioManager.toggleMusic();
        btnMusic.innerHTML = isPlaying ? window.PixelArt.speakerOn() : window.PixelArt.speakerOff();
      };
    }

    const btnSettings = document.getElementById('btn-header-settings');
    if (btnSettings) btnSettings.onclick = openSettingsModal;

    // Home view buttons
    const btnHomeNext = document.getElementById('btn-home-next');
    if (btnHomeNext) {
      btnHomeNext.onclick = () => {
        window.audioManager.playClick();
        if (state.homeStep < 2) {
          state.homeStep++;
          renderApp();
        } else {
          setView('map');
        }
      };
    }

    const btnHomePrev = document.getElementById('btn-home-prev');
    if (btnHomePrev) {
      btnHomePrev.onclick = () => {
        window.audioManager.playClick();
        if (state.homeStep > 0) {
          state.homeStep--;
          renderApp();
        }
      };
    }

    const btnStartGame = document.getElementById('btn-start-game');
    if (btnStartGame) {
      btnStartGame.onclick = () => {
        window.audioManager.playClick();
        setView('map');
      };
    }

    // Step dots in Home
    document.querySelectorAll('.step-dot[data-step]').forEach(dot => {
      dot.onclick = () => {
        state.homeStep = parseInt(dot.getAttribute('data-step'), 10);
        window.audioManager.playClick();
        renderApp();
      };
    });

    // Map view: level node clicks
    document.querySelectorAll('.level-node').forEach(node => {
      node.onclick = () => {
        const slug = node.getAttribute('data-level-slug');
        const unlocked = node.getAttribute('data-unlocked') === 'true';
        if (unlocked) {
          setView('level', slug);
        } else {
          window.audioManager.playError();
        }
      };
    });

    const btnMapHome = document.getElementById('btn-map-home');
    if (btnMapHome) btnMapHome.onclick = () => setView('home');

    const btnScrollLeft = document.getElementById('btn-scroll-map-left');
    if (btnScrollLeft) {
      btnScrollLeft.onclick = () => {
        window.audioManager.playClick();
        const scrollArea = document.getElementById('map-scroll');
        if (scrollArea) scrollArea.scrollBy({ left: -360, behavior: 'smooth' });
      };
    }

    const btnScrollRight = document.getElementById('btn-scroll-map-right');
    if (btnScrollRight) {
      btnScrollRight.onclick = () => {
        window.audioManager.playClick();
        const scrollArea = document.getElementById('map-scroll');
        if (scrollArea) scrollArea.scrollBy({ left: 360, behavior: 'smooth' });
      };
    }

    // Level view navigation
    const btnLevelBackMap = document.getElementById('btn-level-back-map');
    if (btnLevelBackMap) btnLevelBackMap.onclick = () => setView('map');

    const btnSecPrev = document.getElementById('btn-sec-prev');
    if (btnSecPrev) {
      btnSecPrev.onclick = () => {
        if (state.currentSection > 0) {
          window.audioManager.playClick();
          state.currentSection--;
          renderApp();
          const viewEl = document.querySelector('.view-level');
          if (viewEl) viewEl.scrollTop = 0;
        }
      };
    }

    const btnSecNext = document.getElementById('btn-sec-next');
    if (btnSecNext) {
      btnSecNext.onclick = () => {
        const langData = window.KIDS_DATA.levels[state.lang] || window.KIDS_DATA.levels.tr;
        const total = (langData[state.currentLevelSlug] || []).length;
        if (state.currentSection < total - 1) {
          window.audioManager.playClick();
          state.currentSection++;
          renderApp();
          const viewEl = document.querySelector('.view-level');
          if (viewEl) viewEl.scrollTop = 0;
        }
      };
    }

    const btnFinishLevel = document.getElementById('btn-finish-level');
    if (btnFinishLevel) {
      btnFinishLevel.onclick = () => {
        setView('map');
      };
    }

    const btnCompBackMap = document.getElementById('btn-complete-back-map');
    if (btnCompBackMap) {
      btnCompBackMap.onclick = () => {
        setView('map');
      };
    }

    // Section dots in Level
    document.querySelectorAll('.step-dot[data-sec]').forEach(dot => {
      dot.onclick = () => {
        state.currentSection = parseInt(dot.getAttribute('data-sec'), 10);
        window.audioManager.playClick();
        renderApp();
      };
    });

    // --- INTERACTIVE PUZZLE LISTENERS ---

    // 1. Word Predictor Option Click
    document.querySelectorAll('[data-wp-opt]').forEach(btn => {
      btn.onclick = () => {
        const chosen = btn.getAttribute('data-wp-opt');
        const correct = btn.getAttribute('data-correct');
        const elIdx = btn.getAttribute('data-elidx');
        const fbEl = document.getElementById(`wp-feedback-${elIdx}`);
        const blankEl = document.getElementById(`wp-blank-${elIdx}`);

        if (blankEl) blankEl.innerText = chosen;

        if (chosen === correct) {
          window.audioManager.playSuccess();
          const secKey = `${state.currentLevelSlug}_${state.currentSection}`;
          state.sectionStates[secKey] = true;
          saveSectionStates();

          if (fbEl) {
            fbEl.className = 'feedback-box feedback-success';
            fbEl.innerHTML = `🎉 ${t('wordPredictor.correct', 'Yapay zeka gibi düşünüyorsun!')}`;
            fbEl.style.display = 'block';
          }
          const nextBtn = document.getElementById('btn-sec-next');
          if (nextBtn) nextBtn.removeAttribute('disabled');
        } else {
          window.audioManager.playError();
          if (fbEl) {
            fbEl.className = 'feedback-box feedback-error';
            fbEl.innerHTML = `❌ ${t('wordPredictor.tryAgain', 'Tam değil! Tekrar dene.')}`;
            fbEl.style.display = 'block';
          }
        }
      };
    });

    // 2. Prompt Vs Mistake Choice Click (Option A / B)
    document.querySelectorAll('[data-pvm-choice]').forEach(btn => {
      btn.onclick = () => {
        const choice = btn.getAttribute('data-pvm-choice');
        const elIdx = btn.getAttribute('data-elidx');
        const fbEl = document.getElementById(`pvm-feedback-${elIdx}`);
        const cardEl = btn.closest('.quiz-card');

        if (choice === 'good') {
          window.audioManager.playSuccess();
          btn.classList.add('correct');
          // Disable other buttons
          cardEl.querySelectorAll('.quiz-option-btn').forEach(b => b.setAttribute('disabled', 'true'));

          const secKey = `${state.currentLevelSlug}_${state.currentSection}`;
          state.sectionStates[secKey] = true;
          saveSectionStates();

          if (fbEl) {
            fbEl.className = 'feedback-box feedback-success';
            fbEl.innerHTML = `<strong>${t('quiz.correct', 'Doğru bildin!')}</strong> Harika bir prompt seçtin!`;
            fbEl.style.display = 'block';
          }
          const nextBtn = document.getElementById('btn-sec-next');
          if (nextBtn) nextBtn.removeAttribute('disabled');
        } else {
          window.audioManager.playError();
          btn.classList.add('wrong');
          if (fbEl) {
            fbEl.className = 'feedback-box feedback-error';
            fbEl.innerHTML = `❌ ${t('quiz.incorrect', 'İyi deneme!')} Daha detaylı olanı seçmeye çalış.`;
            fbEl.style.display = 'block';
          }
        }
      };
    });

    // 3. Drag Drop Prompt Arrows & Check
    document.querySelectorAll('[data-dd-up]').forEach(btn => {
      btn.onclick = () => {
        const idx = parseInt(btn.getAttribute('data-dd-up'), 10);
        const container = btn.closest('.pieces-container');
        if (container && idx > 0) {
          const rows = Array.from(container.children);
          container.insertBefore(rows[idx], rows[idx - 1]);
          window.audioManager.playClick();
        }
      };
    });

    document.querySelectorAll('[data-dd-down]').forEach(btn => {
      btn.onclick = () => {
        const idx = parseInt(btn.getAttribute('data-dd-down'), 10);
        const container = btn.closest('.pieces-container');
        if (container && idx < container.children.length - 1) {
          const rows = Array.from(container.children);
          container.insertBefore(rows[idx + 1], rows[idx]);
          window.audioManager.playClick();
        }
      };
    });

    document.querySelectorAll('[id^="btn-check-dd-"]').forEach(btn => {
      btn.onclick = () => {
        window.audioManager.playSuccess();
        const secKey = `${state.currentLevelSlug}_${state.currentSection}`;
        state.sectionStates[secKey] = true;
        saveSectionStates();

        const elIdx = btn.id.replace('btn-check-dd-', '');
        const fbEl = document.getElementById(`dd-feedback-${elIdx}`);
        if (fbEl) {
          fbEl.className = 'feedback-box feedback-success';
          fbEl.innerHTML = `🎉 ${t('dragDrop.success', 'Mükemmel! Harika bir prompt oluşturdun!')}`;
          fbEl.style.display = 'block';
        }
        btn.setAttribute('disabled', 'true');
        const nextBtn = document.getElementById('btn-sec-next');
        if (nextBtn) nextBtn.removeAttribute('disabled');
      };
    });

    // 4. Magic Words Check & Pill Toggle
    document.querySelectorAll('.magic-word-pill').forEach(pill => {
      pill.onclick = () => {
        window.audioManager.playClick();
        pill.classList.toggle('selected');
      };
    });

    document.querySelectorAll('[id^="btn-check-mw-"]').forEach(btn => {
      btn.onclick = () => {
        window.audioManager.playSuccess();
        const secKey = `${state.currentLevelSlug}_${state.currentSection}`;
        state.sectionStates[secKey] = true;
        saveSectionStates();

        const elIdx = btn.id.replace('btn-check-mw-', '');
        const fbEl = document.getElementById(`mw-feedback-${elIdx}`);
        if (fbEl) {
          fbEl.className = 'feedback-box feedback-success';
          fbEl.style.display = 'block';
        }
        btn.setAttribute('disabled', 'true');
        const nextBtn = document.getElementById('btn-sec-next');
        if (nextBtn) nextBtn.removeAttribute('disabled');
      };
    });

    // 5. Example Matcher Option Click
    document.querySelectorAll('[data-em-opt]').forEach(btn => {
      btn.onclick = () => {
        const chosen = btn.getAttribute('data-em-opt');
        const correct = btn.getAttribute('data-correct');
        const elIdx = btn.getAttribute('data-elidx');
        const fbEl = document.getElementById(`em-feedback-${elIdx}`);
        const parentCard = btn.closest('.quiz-card');

        if (chosen === correct) {
          window.audioManager.playSuccess();
          btn.classList.add('selected');
          if (parentCard) {
            parentCard.querySelectorAll('.option-btn').forEach(b => b.setAttribute('disabled', 'true'));
          }

          const secKey = `${state.currentLevelSlug}_${state.currentSection}`;
          state.sectionStates[secKey] = true;
          saveSectionStates();

          if (fbEl) {
            fbEl.className = 'feedback-box feedback-success';
            fbEl.style.display = 'block';
          }
          const nextBtn = document.getElementById('btn-sec-next');
          if (nextBtn) nextBtn.removeAttribute('disabled');
        } else {
          window.audioManager.playError();
          btn.classList.add('wrong');
        }
      };
    });

    // 5. Prompt Doctor Problem Fix Click
    document.querySelectorAll('[data-pd-idx]').forEach(btn => {
      btn.onclick = () => {
        window.audioManager.playCoin();
        btn.classList.add('fixed');
        btn.querySelector('span:last-child').innerText = '✓ İyileşti';

        const parent = btn.closest('.pixel-panel');
        const allFixed = Array.from(parent.querySelectorAll('.doctor-problem-btn')).every(b => b.classList.contains('fixed'));
        if (allFixed) {
          window.audioManager.playSuccess();
          const secKey = `${state.currentLevelSlug}_${state.currentSection}`;
          state.sectionStates[secKey] = true;
          saveSectionStates();

          const healedBox = parent.querySelector('[id^="pd-healed-"]');
          if (healedBox) healedBox.style.display = 'block';

          const nextBtn = document.getElementById('btn-sec-next');
          if (nextBtn) nextBtn.removeAttribute('disabled');
        }
      };
    });

    // 6. Generic Done Buttons (PromptParts, StepByStep, PromptLab)
    document.querySelectorAll('[id^="btn-done-parts-"], [id^="btn-done-sbs-"], [id^="btn-done-lab-"]').forEach(btn => {
      btn.onclick = () => {
        window.audioManager.playSuccess();
        const secKey = `${state.currentLevelSlug}_${state.currentSection}`;
        state.sectionStates[secKey] = true;
        saveSectionStates();
        btn.setAttribute('disabled', 'true');
        btn.innerText = '✓ Tamamlandı!';
        const nextBtn = document.getElementById('btn-sec-next');
        if (nextBtn) nextBtn.removeAttribute('disabled');
      };
    });

    // Settings Modal Handlers
    const closeSettings = document.getElementById('btn-modal-close');
    if (closeSettings) closeSettings.onclick = closeSettingsModal;

    const btnLangTr = document.getElementById('btn-lang-tr');
    if (btnLangTr) {
      btnLangTr.onclick = () => {
        state.lang = 'tr';
        localStorage.setItem('kids-lang', 'tr');
        window.audioManager.playClick();
        updateHeaderTitles();
        renderApp();
      };
    }

    const btnLangEn = document.getElementById('btn-lang-en');
    if (btnLangEn) {
      btnLangEn.onclick = () => {
        state.lang = 'en';
        localStorage.setItem('kids-lang', 'en');
        window.audioManager.playClick();
        updateHeaderTitles();
        renderApp();
      };
    }

    const volSlider = document.getElementById('music-volume-slider');
    if (volSlider) {
      volSlider.oninput = (e) => {
        window.audioManager.setMusicVolume(parseFloat(e.target.value));
      };
    }

    const btnResetProg = document.getElementById('btn-reset-prog');
    if (btnResetProg) btnResetProg.onclick = resetAllProgress;
  }

  function updateHeaderTitles() {
    const headerTitle = document.getElementById('header-title-text');
    if (headerTitle) {
      headerTitle.innerText = t('header.title', "Yapay Zeka Okulu");
    }
  }

  // --- MAIN RENDER LOOP ---
  function renderApp() {
    const mainEl = document.getElementById('app-main');
    if (!mainEl) return;

    if (state.view === 'home') {
      mainEl.innerHTML = renderHomeView();
    } else if (state.view === 'map') {
      mainEl.innerHTML = renderMapView();
      // Scroll to current active level on map
      setTimeout(() => {
        const scrollArea = document.getElementById('map-scroll');
        const activeNode = document.querySelector('.level-node.current') || document.querySelector('.level-node.unlocked');
        if (scrollArea && activeNode) {
          const offset = activeNode.offsetLeft - window.innerWidth / 2 + 50;
          scrollArea.scrollTo({ left: Math.max(0, offset), behavior: 'smooth' });
        }
      }, 50);
    } else if (state.view === 'level') {
      mainEl.innerHTML = renderLevelView();
    }

    updateHeaderStats();
    attachEventHandlers();
  }

  // Auto-init on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    // Populate header logos and initial controls
    const headerBrand = document.getElementById('btn-header-brand');
    if (headerBrand) {
      headerBrand.innerHTML = `
        ${window.PixelArt.robot({ mood: 'happy', width: 28, height: 35, className: 'header-robot-icon' })}
        <span class="header-title pixel-gold-shadow" id="header-title-text">${t('header.title', "Yapay Zeka Okulu")}</span>
      `;
    }

    const btnMusic = document.getElementById('btn-header-music');
    if (btnMusic) {
      btnMusic.innerHTML = window.audioManager.musicEnabled ? window.PixelArt.speakerOn() : window.PixelArt.speakerOff();
    }

    const btnSettings = document.getElementById('btn-header-settings');
    if (btnSettings) btnSettings.innerHTML = window.PixelArt.gear();

    const btnHome = document.getElementById('btn-header-home');
    if (btnHome) btnHome.innerHTML = window.PixelArt.home();

    const btnMap = document.getElementById('btn-header-map');
    if (btnMap) btnMap.innerHTML = window.PixelArt.mapIcon();

    renderApp();

    // Keyboard navigation (ArrowRight / ArrowLeft / Enter)
    window.addEventListener('keydown', (e) => {
      if (state.view !== 'level') return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        const nextBtn = document.getElementById('btn-sec-next');
        if (nextBtn && !nextBtn.hasAttribute('disabled')) {
          nextBtn.click();
        } else {
          const finishBtn = document.getElementById('btn-finish-level');
          if (finishBtn) finishBtn.click();
        }
      } else if (e.key === 'ArrowLeft') {
        const prevBtn = document.getElementById('btn-sec-prev');
        if (prevBtn && prevBtn.style.visibility !== 'hidden') {
          prevBtn.click();
        }
      }
    });

    // Start background music on first user click anywhere in the window
    const enableAudioOnUserGesture = () => {
      window.audioManager.initContext();
      if (window.audioManager.musicEnabled && !window.audioManager.isMusicPlaying) {
        window.audioManager.playMusic();
      }
      window.removeEventListener('click', enableAudioOnUserGesture);
      window.removeEventListener('keydown', enableAudioOnUserGesture);
    };
    window.addEventListener('click', enableAudioOnUserGesture, { once: true });
    window.addEventListener('keydown', enableAudioOnUserGesture, { once: true });
  });

})();
