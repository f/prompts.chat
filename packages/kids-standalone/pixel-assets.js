// Pixel Art SVG Components for AI Prompt School

window.PixelArt = {
  // Robot Character with mood variations
  robot: function(options = {}) {
    const mood = options.mood || 'happy';
    let width = options.width;
    let height = options.height;
    if (!width) {
      if (options.className && options.className.includes('w-8')) width = 32;
      else if (options.className && options.className.includes('w-10')) width = 40;
      else if (options.className && options.className.includes('w-12')) width = 48;
      else if (options.className && options.className.includes('w-14')) width = 56;
      else if (options.className && options.className.includes('w-16')) width = 64;
      else if (options.className && options.className.includes('w-20')) width = 80;
      else width = 48;
    }
    if (!height) height = Math.round(width * 1.25);

    const className = options.className || '';
    const size = options.size || '';
    
    // Eyes and mouth variation by mood
    let eyeColor = "#333";
    let mouthSvg = '<rect x="6" y="10" width="4" height="1" fill="#333" />';
    let moodBadge = '';

    if (mood === 'thinking') {
      mouthSvg = '<rect x="5" y="10" width="3" height="1" fill="#333" />';
      moodBadge = '<circle cx="13" cy="3" r="2.5" fill="#A855F7" /><text x="13" y="4.2" font-size="3" text-anchor="middle" fill="white">?</text>';
    } else if (mood === 'excited') {
      mouthSvg = '<rect x="6" y="9" width="4" height="2" fill="#333" /><rect x="7" y="10" width="2" height="1" fill="#DC2626" />';
      moodBadge = '<polygon points="12,1 14,4 12,3 10,4" fill="#EAB308" />';
    } else if (mood === 'confused') {
      mouthSvg = '<rect x="6" y="10" width="2" height="1" fill="#333" /><rect x="8" y="9" width="2" height="1" fill="#333" />';
      moodBadge = '<text x="13" y="4" font-size="3.5" text-anchor="middle" fill="#DC2626">~</text>';
    } else if (mood === 'celebrating') {
      mouthSvg = '<rect x="5" y="9" width="6" height="2" fill="#333" /><rect x="6" y="10" width="4" height="1" fill="#EF4444" />';
      moodBadge = '<circle cx="13" cy="2" r="2" fill="#EC4899" /><circle cx="3" cy="2" r="1.5" fill="#3B82F6" />';
    }

    return `
      <svg viewBox="0 0 16 20" width="${width}" height="${height}" class="${className}" style="width: ${width}px; height: ${height}px; image-rendering: pixelated; display: inline-block; vertical-align: middle; flex-shrink: 0; ${size}">
        <!-- Antenna -->
        <rect x="7" y="0" width="2" height="2" fill="#FFD700" />
        <rect x="6" y="2" width="4" height="2" fill="#C0C0C0" />
        <!-- Head -->
        <rect x="2" y="4" width="12" height="8" fill="#4A90D9" />
        <!-- Eye screens (white) -->
        <rect x="4" y="6" width="3" height="3" fill="white" />
        <rect x="9" y="6" width="3" height="3" fill="white" />
        <!-- Eye pupils -->
        <rect x="5" y="7" width="2" height="2" fill="${eyeColor}" />
        <rect x="10" y="7" width="2" height="2" fill="${eyeColor}" />
        <!-- Blushing cheeks -->
        <rect x="3" y="9" width="1" height="1" fill="#FF8A80" />
        <rect x="12" y="9" width="1" height="1" fill="#FF8A80" />
        <!-- Mouth -->
        ${mouthSvg}
        <!-- Body -->
        <rect x="4" y="12" width="8" height="6" fill="#4A90D9" />
        <!-- Chest badge / button -->
        <rect x="6" y="14" width="4" height="2" fill="#FFD700" />
        <!-- Left Arm -->
        <rect x="0" y="12" width="4" height="2" fill="#4A90D9" />
        <!-- Right Arm -->
        <rect x="12" y="12" width="4" height="2" fill="#4A90D9" />
        <!-- Feet -->
        <rect x="4" y="18" width="3" height="2" fill="#333" />
        <rect x="9" y="18" width="3" height="2" fill="#333" />
        <!-- Mood sparkle/badge -->
        ${moodBadge}
      </svg>
    `;
  },

  // 8-bit Star
  star: function(filled = true, className = 'w-6 h-6', style = '') {
    const color = filled ? '#FFD700' : '#8B7355';
    let width = 24;
    let height = 24;
    if (className.includes('w-4')) { width = 16; height = 16; }
    else if (className.includes('w-5')) { width = 20; height = 20; }
    else if (className.includes('w-6')) { width = 24; height = 24; }
    else if (className.includes('w-8')) { width = 32; height = 32; }
    else if (className.includes('w-10')) { width = 40; height = 40; }
    else if (className.includes('w-12')) { width = 48; height = 48; }

    return `
      <svg viewBox="0 0 12 12" width="${width}" height="${height}" class="${className}" style="width: ${width}px; height: ${height}px; image-rendering: pixelated; display: inline-block; vertical-align: middle; flex-shrink: 0; ${style}">
        <rect x="5" y="0" width="2" height="2" fill="${color}" />
        <rect x="4" y="2" width="4" height="2" fill="${color}" />
        <rect x="0" y="4" width="12" height="2" fill="${color}" />
        <rect x="2" y="6" width="8" height="2" fill="${color}" />
        <rect x="2" y="8" width="2" height="2" fill="${color}" />
        <rect x="8" y="8" width="2" height="2" fill="${color}" />
        <rect x="0" y="10" width="2" height="2" fill="${color}" />
        <rect x="10" y="10" width="2" height="2" fill="${color}" />
      </svg>
    `;
  },

  // 8-bit Tree
  tree: function(className = 'w-10 h-14') {
    let width = 40;
    let height = 56;
    if (className.includes('w-12')) { width = 48; height = 64; }
    if (className.includes('w-14')) { width = 56; height = 72; }

    return `
      <svg viewBox="0 0 16 20" width="${width}" height="${height}" class="${className}" style="width: ${width}px; height: ${height}px; image-rendering: pixelated; display: inline-block; flex-shrink: 0;">
        <rect x="6" y="0" width="4" height="2" fill="#2E7D32" />
        <rect x="4" y="2" width="8" height="3" fill="#388E3C" />
        <rect x="2" y="5" width="12" height="3" fill="#2E7D32" />
        <rect x="1" y="8" width="14" height="4" fill="#388E3C" />
        <rect x="0" y="12" width="16" height="3" fill="#2E7D32" />
        <rect x="6" y="15" width="4" height="5" fill="#6D4C41" />
      </svg>
    `;
  },

  // 8-bit Castle
  castle: function(className = 'w-12 h-12') {
    let width = 48;
    let height = 48;
    if (className.includes('w-14')) { width = 56; height = 56; }
    if (className.includes('w-20')) { width = 80; height = 80; }
    if (className.includes('w-24')) { width = 96; height = 96; }

    return `
      <svg viewBox="0 0 20 20" width="${width}" height="${height}" class="${className}" style="width: ${width}px; height: ${height}px; image-rendering: pixelated; display: inline-block; flex-shrink: 0;">
        <rect x="9" y="0" width="1" height="4" fill="#333" />
        <rect x="10" y="0" width="4" height="2" fill="#DC2626" />
        <rect x="2" y="4" width="3" height="3" fill="#9E9E9E" />
        <rect x="15" y="4" width="3" height="3" fill="#9E9E9E" />
        <rect x="1" y="7" width="5" height="10" fill="#BDBDBD" />
        <rect x="14" y="7" width="5" height="10" fill="#BDBDBD" />
        <rect x="6" y="8" width="8" height="9" fill="#9E9E9E" />
        <rect x="6" y="6" width="2" height="2" fill="#9E9E9E" />
        <rect x="9" y="6" width="2" height="2" fill="#9E9E9E" />
        <rect x="12" y="6" width="2" height="2" fill="#9E9E9E" />
        <rect x="8" y="12" width="4" height="5" fill="#4A3728" />
        <rect x="0" y="17" width="20" height="3" fill="#4CAF50" />
      </svg>
    `;
  },

  // 8-bit Mountain
  mountain: function(className = 'w-16 h-14') {
    let width = 80;
    let height = 56;
    if (className.includes('w-28')) { width = 112; height = 80; }
    if (className.includes('w-32')) { width = 128; height = 96; }

    return `
      <svg viewBox="0 0 24 16" width="${width}" height="${height}" class="${className}" style="width: ${width}px; height: ${height}px; image-rendering: pixelated; display: inline-block; flex-shrink: 0;">
        <rect x="11" y="0" width="2" height="2" fill="white" />
        <rect x="10" y="2" width="4" height="2" fill="white" />
        <rect x="9" y="4" width="6" height="2" fill="white" />
        <rect x="8" y="6" width="8" height="2" fill="#78909C" />
        <rect x="6" y="8" width="12" height="2" fill="#607D8B" />
        <rect x="4" y="10" width="16" height="2" fill="#546E7A" />
        <rect x="2" y="12" width="20" height="2" fill="#455A64" />
        <rect x="0" y="14" width="24" height="2" fill="#37474F" />
      </svg>
    `;
  },

  // 8-bit Lake with Water Sparkles
  lake: function(className = 'w-20 h-10') {
    let width = 96;
    let height = 48;
    if (className.includes('w-24')) { width = 110; height = 54; }
    if (className.includes('w-28')) { width = 128; height = 64; }

    return `
      <svg viewBox="0 0 32 16" width="${width}" height="${height}" class="${className}" style="width: ${width}px; height: ${height}px; image-rendering: pixelated; display: inline-block; flex-shrink: 0;">
        <rect x="4" y="4" width="24" height="2" fill="#5DADE2" />
        <rect x="2" y="6" width="28" height="2" fill="#3498DB" />
        <rect x="0" y="8" width="32" height="4" fill="#2980B9" />
        <rect x="2" y="12" width="28" height="2" fill="#3498DB" />
        <rect x="6" y="14" width="20" height="2" fill="#5DADE2" />
        <rect x="8" y="8" width="2" height="2" fill="#AED6F1" />
        <rect x="18" y="10" width="2" height="2" fill="#AED6F1" />
        <rect x="24" y="8" width="2" height="2" fill="#D4E6F1" />
      </svg>
    `;
  },

  // 8-bit Car
  car: function(color = "#E74C3C", darkColor = "#C0392B", className = "w-20 h-10") {
    let width = 84;
    let height = 42;
    if (className.includes('w-24')) { width = 96; height = 48; }

    return `
      <svg viewBox="0 0 28 14" width="${width}" height="${height}" class="${className}" style="width: ${width}px; height: ${height}px; image-rendering: pixelated; display: inline-block; flex-shrink: 0;">
        <rect x="4" y="12" width="20" height="2" fill="#00000033" />
        <rect x="2" y="6" width="24" height="6" fill="${color}" />
        <rect x="6" y="2" width="16" height="6" fill="${color}" />
        <rect x="8" y="1" width="12" height="2" fill="${color}" />
        <rect x="2" y="10" width="24" height="2" fill="${darkColor}" />
        <rect x="16" y="3" width="4" height="3" fill="#87CEEB" />
        <rect x="8" y="3" width="4" height="3" fill="#87CEEB" />
        <rect x="4" y="10" width="5" height="4" fill="#222" />
        <rect x="5" y="11" width="3" height="2" fill="#555" />
        <rect x="19" y="10" width="5" height="4" fill="#222" />
        <rect x="20" y="11" width="3" height="2" fill="#555" />
        <rect x="24" y="7" width="2" height="2" fill="#FFD700" />
      </svg>
    `;
  },

  // Cessna Airplane with Wavy Banner
  planeWithBanner: function(bannerText = "YAPAY ZEKA ÖĞREN!") {
    return `
      <div style="display: flex; align-items: center;">
        <div style="background: #FFD700; border: 2px solid #DAA520; padding: 4px 12px; margin-right: -4px; clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%, 4px 50%); animation: flagWave 0.4s steps(2) infinite; box-shadow: 0 2px 4px rgba(0,0,0,0.15);">
          <span style="color: #8B4513; font-weight: bold; font-size: 0.85rem; white-space: nowrap;">${bannerText}</span>
        </div>
        <svg viewBox="0 0 24 8" width="20" height="6" style="width: 20px; height: 6px; margin-right: -4px; image-rendering: pixelated; flex-shrink: 0;">
          <rect x="0" y="3" width="24" height="2" fill="#8B4513" />
        </svg>
        <svg viewBox="0 0 48 28" width="72" height="42" style="width: 72px; height: 42px; image-rendering: pixelated; flex-shrink: 0;">
          <rect x="8" y="12" width="28" height="8" fill="#F5F5F5" />
          <rect x="6" y="14" width="4" height="4" fill="#E8E8E8" />
          <rect x="34" y="12" width="6" height="6" fill="#F5F5F5" />
          <rect x="38" y="14" width="4" height="4" fill="#E8E8E8" />
          <rect x="30" y="13" width="6" height="3" fill="#87CEEB" />
          <rect x="16" y="8" width="20" height="4" fill="#F5F5F5" />
          <rect x="10" y="16" width="26" height="2" fill="#E74C3C" />
          <rect x="2" y="8" width="4" height="4" fill="#F5F5F5" />
          <rect x="0" y="6" width="4" height="4" fill="#E8E8E8" />
          <rect x="42" y="14" width="3" height="4" fill="#444" />
          <g style="transform-origin: 43px 16px; animation: spin 0.15s linear infinite;">
            <rect x="43" y="9" width="2" height="6" fill="#666" />
            <rect x="43" y="17" width="2" height="6" fill="#666" />
          </g>
          <rect x="18" y="20" width="2" height="4" fill="#555" />
          <rect x="16" y="23" width="6" height="2" fill="#333" />
        </svg>
      </div>
    `;
  },

  speakerOn: function() {
    return `
      <svg viewBox="0 0 16 16" width="18" height="18" style="width: 18px; height: 18px; image-rendering: pixelated; fill: currentColor; display: inline-block; vertical-align: middle;">
        <rect x="2" y="5" width="3" height="6" />
        <rect x="5" y="4" width="2" height="8" />
        <rect x="7" y="3" width="2" height="10" />
        <rect x="11" y="4" width="2" height="2" />
        <rect x="13" y="6" width="2" height="4" />
        <rect x="11" y="10" width="2" height="2" />
      </svg>
    `;
  },

  speakerOff: function() {
    return `
      <svg viewBox="0 0 16 16" width="18" height="18" style="width: 18px; height: 18px; image-rendering: pixelated; fill: currentColor; display: inline-block; vertical-align: middle;">
        <rect x="2" y="5" width="3" height="6" />
        <rect x="5" y="4" width="2" height="8" />
        <rect x="7" y="3" width="2" height="10" />
        <rect x="11" y="5" width="2" height="2" />
        <rect x="13" y="7" width="2" height="2" />
        <rect x="11" y="9" width="2" height="2" />
        <rect x="13" y="5" width="2" height="2" fill="#DC2626" />
        <rect x="11" y="7" width="2" height="2" fill="#DC2626" />
      </svg>
    `;
  },

  gamepad: function() {
    return `
      <svg viewBox="0 0 16 16" width="32" height="32" style="width: 32px; height: 32px; image-rendering: pixelated; fill: #16A34A; display: inline-block;">
        <rect x="1" y="4" width="14" height="8" rx="2" />
        <rect x="3" y="7" width="4" height="2" fill="white" />
        <rect x="4" y="6" width="2" height="4" fill="white" />
        <rect x="10" y="6" width="2" height="2" fill="#FFD700" />
        <rect x="12" y="8" width="2" height="2" fill="#EF4444" />
      </svg>
    `;
  },

  book: function() {
    return `
      <svg viewBox="0 0 16 16" width="32" height="32" style="width: 32px; height: 32px; image-rendering: pixelated; fill: #2563EB; display: inline-block;">
        <rect x="2" y="2" width="12" height="12" />
        <rect x="3" y="3" width="10" height="10" fill="white" />
        <rect x="7" y="3" width="2" height="10" fill="#2563EB" />
        <rect x="4" y="5" width="2" height="1" fill="#93C5FD" />
        <rect x="4" y="7" width="2" height="1" fill="#93C5FD" />
        <rect x="10" y="5" width="2" height="1" fill="#93C5FD" />
        <rect x="10" y="7" width="2" height="1" fill="#93C5FD" />
      </svg>
    `;
  },

  playIcon: function() {
    return `
      <svg viewBox="0 0 12 12" width="16" height="16" style="width: 16px; height: 16px; image-rendering: pixelated; fill: currentColor; display: inline-block;">
        <rect x="2" y="2" width="2" height="8" />
        <rect x="4" y="3" width="2" height="6" />
        <rect x="6" y="4" width="2" height="4" />
        <rect x="8" y="5" width="2" height="2" />
      </svg>
    `;
  },

  arrowLeft: function() {
    return `
      <svg viewBox="0 0 12 12" width="14" height="14" style="width: 14px; height: 14px; image-rendering: pixelated; fill: currentColor; display: inline-block;">
        <rect x="4" y="5" width="6" height="2" />
        <rect x="2" y="5" width="2" height="2" />
        <rect x="4" y="3" width="2" height="2" />
        <rect x="4" y="7" width="2" height="2" />
      </svg>
    `;
  },

  arrowRight: function() {
    return `
      <svg viewBox="0 0 12 12" width="14" height="14" style="width: 14px; height: 14px; image-rendering: pixelated; fill: currentColor; display: inline-block;">
        <rect x="2" y="5" width="6" height="2" />
        <rect x="8" y="5" width="2" height="2" />
        <rect x="6" y="3" width="2" height="2" />
        <rect x="6" y="7" width="2" height="2" />
      </svg>
    `;
  },

  gear: function() {
    return `
      <svg viewBox="0 0 16 16" width="18" height="18" style="width: 18px; height: 18px; image-rendering: pixelated; fill: currentColor; display: inline-block;">
        <rect x="6" y="0" width="4" height="2" />
        <rect x="6" y="14" width="4" height="2" />
        <rect x="0" y="6" width="2" height="4" />
        <rect x="14" y="6" width="2" height="4" />
        <rect x="4" y="4" width="8" height="8" />
        <rect x="6" y="6" width="4" height="4" fill="#2C1810" />
      </svg>
    `;
  },

  home: function() {
    return `
      <svg viewBox="0 0 16 16" width="18" height="18" style="width: 18px; height: 18px; image-rendering: pixelated; fill: currentColor; display: inline-block;">
        <rect x="7" y="1" width="2" height="2" />
        <rect x="5" y="3" width="6" height="2" />
        <rect x="3" y="5" width="10" height="2" />
        <rect x="2" y="7" width="12" height="2" />
        <rect x="3" y="9" width="10" height="6" />
        <rect x="6" y="11" width="4" height="4" fill="#2C1810" />
      </svg>
    `;
  },

  mapIcon: function() {
    return `
      <svg viewBox="0 0 16 16" width="18" height="18" style="width: 18px; height: 18px; image-rendering: pixelated; fill: currentColor; display: inline-block;">
        <rect x="5" y="1" width="6" height="2" />
        <rect x="4" y="2" width="8" height="2" />
        <rect x="3" y="3" width="10" height="4" />
        <rect x="4" y="7" width="8" height="2" />
        <rect x="5" y="9" width="6" height="2" />
        <rect x="6" y="11" width="4" height="2" />
        <rect x="7" y="13" width="2" height="2" />
        <rect x="5" y="4" width="2" height="2" fill="rgba(255,255,255,0.4)" />
      </svg>
    `;
  },

  lock: function() {
    return `
      <svg viewBox="0 0 16 16" width="18" height="18" style="width: 18px; height: 18px; image-rendering: pixelated; fill: #9CA3AF; display: inline-block;">
        <rect x="4" y="2" width="8" height="6" fill="none" stroke="#9CA3AF" stroke-width="2" />
        <rect x="3" y="7" width="10" height="8" fill="#6B7280" />
        <rect x="7" y="10" width="2" height="3" fill="#D1D5DB" />
      </svg>
    `;
  }
};
