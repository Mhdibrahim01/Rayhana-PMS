/**
 * نظام ريحانة لإدارة الفنادق (Rayhana Suites ERP)
 * Smart Command Palette (Ctrl + K) & Needs-Attention Inbox Engine
 */

(function initSmartCommandPalette(window, document, App) {
  'use strict';

  if (!App) return;

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. DATA CACHING & DATABASE HYDRATION
  // ─────────────────────────────────────────────────────────────────────────────

  let localRoomsCache = null;
  let localReservationsCache = null;
  let localGuestsCache = null;
  let localTodayCheckouts = null;
  let syncPromise = null;
  let paletteAttentionCache = null;

  function getCurrentBizDate() {
    if (App?.State?.businessDate) {
      return String(App.State.businessDate);
    }
    if (typeof App?.Helpers?.getLocalDateString === 'function') {
      return String(App.Helpers.getLocalDateString());
    }
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getRooms() {
    const appRooms = Array.isArray(App?.State?.roomsCache) ? App.State.roomsCache : [];
    if (appRooms.length > 0) {
      return appRooms;
    }
    return Array.isArray(localRoomsCache) ? localRoomsCache : [];
  }

  function getReservations() {
    const appCache = Array.isArray(App?.State?.reservationsCache) ? App.State.reservationsCache : [];
    if (appCache.length > 0) {
      return appCache;
    }
    return Array.isArray(localReservationsCache) ? localReservationsCache : [];
  }

  function getGuests() {
    const appGuests = Array.isArray(App?.State?.guestsCache) ? App.State.guestsCache : [];
    if (appGuests.length > 0) {
      return appGuests;
    }
    return Array.isArray(localGuestsCache) ? localGuestsCache : [];
  }

  function syncDataFromDb(options = {}) {
    if (typeof window === 'undefined' || !window.api) return Promise.resolve();
    if (syncPromise) {
      if (options.force) {
        return syncPromise.then(() => syncDataFromDb({ force: false }));
      }
      return syncPromise;
    }

    syncPromise = (async () => {
      try {
        const currentBizDate = getCurrentBizDate();
        const promises = [
          typeof window.api.getAllRooms === 'function' ? window.api.getAllRooms().catch(() => null) : Promise.resolve(null),
          typeof window.api.getAllReservations === 'function' ? window.api.getAllReservations().catch(() => null) : Promise.resolve(null),
          typeof window.api.getAllGuests === 'function' ? window.api.getAllGuests().catch(() => null) : Promise.resolve(null),
          typeof window.api.getTodayCheckouts === 'function' ? window.api.getTodayCheckouts(currentBizDate).catch(() => null) : Promise.resolve(null)
        ];

        const [roomsRes, resRes, guestsRes, checkoutsRes] = await Promise.all(promises);

        if (roomsRes?.success && Array.isArray(roomsRes.data)) {
          localRoomsCache = roomsRes.data;
          if (App?.State) App.State.roomsCache = roomsRes.data;
        }
        if (resRes?.success && Array.isArray(resRes.data)) {
          localReservationsCache = resRes.data;
          if (App?.State) App.State.reservationsCache = resRes.data;
        }
        if (guestsRes?.success && Array.isArray(guestsRes.data)) {
          localGuestsCache = guestsRes.data;
          if (App?.State) App.State.guestsCache = guestsRes.data;
        }
        if (checkoutsRes?.success && Array.isArray(checkoutsRes.data)) {
          localTodayCheckouts = checkoutsRes.data;
          if (App?.State) App.State.todayCheckoutsRows = checkoutsRes.data;
        }

        paletteAttentionCache = null;
        if (typeof updateAttentionInbox === 'function') {
          updateAttentionInbox();
        }
        if (typeof buildSearchIndex === 'function') {
          buildSearchIndex();
        }
        if (paletteModal && paletteModal.style.display !== 'none' && paletteInput) {
          handlePaletteSearch(paletteInput.value);
        }
        if (attentionModal && attentionModal.style.display && attentionModal.style.display !== 'none') {
          renderAttentionModalList();
        }
      } catch (err) {
        console.warn('Failed to sync command palette data:', err);
      } finally {
        syncPromise = null;
      }
    })();

    return syncPromise;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. ARABIC TEXT & KEYBOARD NORMALIZATION
  // ─────────────────────────────────────────────────────────────────────────────

  const ARABIC_INDIC_AND_PERSIAN_DIGITS = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
    '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
  };

  const EN_TO_AR_KEYMAP = {
    'q': 'ض', 'w': 'ص', 'e': 'ث', 'r': 'ق', 't': 'ف', 'y': 'غ', 'u': 'ع', 'i': 'ه', 'o': 'خ', 'p': 'ح', '[': 'ج', ']': 'د',
    'a': 'ش', 's': 'س', 'd': 'ي', 'f': 'ب', 'g': 'ل', 'h': 'ا', 'j': 'ت', 'k': 'ن', 'l': 'م', ';': 'ك', '\'': 'ط',
    'z': 'ئ', 'x': 'ء', 'c': 'ؤ', 'v': 'ر', 'b': 'لا', 'n': 'ى', 'm': 'ة', ',': 'و', '.': 'ز', '/': 'ظ',
    '`': 'ذ',
    'Q': 'ض', 'W': 'ص', 'E': 'ث', 'R': 'ق', 'T': 'ف', 'Y': 'غ', 'U': 'ع', 'I': 'ه', 'O': 'خ', 'P': 'ح', '{': 'ج', '}': 'د',
    'A': 'ش', 'S': 'س', 'D': 'ي', 'F': 'ب', 'G': 'ل', 'H': 'ا', 'J': 'ت', 'K': 'ن', 'L': 'م', ':': 'ك', '"': 'ط',
    'Z': 'ئ', 'X': 'ء', 'C': 'ؤ', 'V': 'ر', 'B': 'لا', 'N': 'ى', 'M': 'ة', '<': 'و', '>': 'ز', '?': 'ظ',
    '~': 'ذ'
  };

  function normalizeDigits(str) {
    if (!str && str !== 0) return '';
    return String(str).replace(/[٠-٩۰-۹]/g, d => ARABIC_INDIC_AND_PERSIAN_DIGITS[d] || d);
  }

  function stripDiacritics(str) {
    if (!str && str !== 0) return '';
    return String(str)
      .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
      .replace(/\u0640/g, '');
  }

  function canonicalizeTypoWords(str) {
    // Note: Common typos are now handled dynamically by the Typo Resilience layer
    // with Did-You-Mean banner feedback in parseCommandIntent.
    return str || '';
  }

  function normalize(str) {
    if (!str && str !== 0) return '';
    let res = normalizeDigits(String(str));
    res = stripDiacritics(res);
    res = res
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/[ىئ]/g, 'ي')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
    res = canonicalizeTypoWords(res);
    return res;
  }

  const normalizeArabic = normalize;

  function transliterateEnToAr(str) {
    if (!str && str !== 0) return '';
    return String(str)
      .split('')
      .map(ch => EN_TO_AR_KEYMAP[ch] || ch)
      .join('');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2.1 TYPO RESILIENCE & QUERY REORDERING ENGINE
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Damerau-Levenshtein distance with early exit threshold
   * Supports insertion, deletion, substitution, and transposition of adjacent characters
   */
  function editDistance(a, b, maxLimit = 2) {
    if (a === b) return 0;
    const lenA = a.length;
    const lenB = b.length;
    if (Math.abs(lenA - lenB) > maxLimit) return maxLimit + 1;
    if (lenA === 0) return lenB <= maxLimit ? lenB : maxLimit + 1;
    if (lenB === 0) return lenA <= maxLimit ? lenA : maxLimit + 1;

    const d = [];
    for (let i = 0; i <= lenA; i++) {
      d[i] = new Array(lenB + 1);
      d[i][0] = i;
    }
    for (let j = 0; j <= lenB; j++) {
      d[0][j] = j;
    }

    for (let i = 1; i <= lenA; i++) {
      let rowMin = d[i][0];
      const charA = a.charCodeAt(i - 1);
      for (let j = 1; j <= lenB; j++) {
        const charB = b.charCodeAt(j - 1);
        const cost = charA === charB ? 0 : 1;
        let val = Math.min(
          d[i - 1][j] + 1,       // deletion
          d[i][j - 1] + 1,       // insertion
          d[i - 1][j - 1] + cost // substitution
        );

        // Transposition check (Damerau)
        if (i > 1 && j > 1 && charA === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === charB) {
          val = Math.min(val, d[i - 2][j - 2] + 1);
        }

        d[i][j] = val;
        if (val < rowMin) rowMin = val;
      }

      if (rowMin > maxLimit) {
        return maxLimit + 1;
      }
    }

    return d[lenA][lenB];
  }

  /**
   * Phonetic grouping for Arabic letters with close phonetic/keyboard proximity
   * Used strictly as a second-pass fallback when direct edit distance exceeds threshold
   */
  function phoneticKey(word) {
    if (!word) return '';
    return String(word)
      .replace(/[سصث]/g, 'س')
      .replace(/[ذزظض]/g, 'ز')
      .replace(/[تط]/g, 'ت')
      .replace(/[قكغ]/g, 'ك')
      .replace(/[حخه]/g, 'ح')
      .replace(/[عءؤئ]/g, 'ع')
      .replace(/(.)\1+/g, '$1');
  }

  let cachedKeywordVocab = null;

  /**
   * Builds and caches the command vocabulary lookup map from COMMAND_REGISTRY keywords
   */
  function getKeywordVocab() {
    if (cachedKeywordVocab) return cachedKeywordVocab;
    const vocab = new Map();

    if (Array.isArray(COMMAND_REGISTRY)) {
      COMMAND_REGISTRY.forEach(cmd => {
        if (!cmd || !cmd.id || !Array.isArray(cmd.keywords)) return;
        cmd.keywords.forEach(kw => {
          const normKw = normalize(String(kw || '').trim());
          if (!normKw) return;
          if (!vocab.has(normKw)) {
            vocab.set(normKw, []);
          }
          const list = vocab.get(normKw);
          if (!list.some(item => item.commandId === cmd.id)) {
            list.push({ commandId: cmd.id, canonical: normKw });
          }
        });
      });
    }

    cachedKeywordVocab = vocab;
    return cachedKeywordVocab;
  }

  let cachedEntityWordSet = null;

  /**
   * Set of normalized words found in active database entities (guest names, room types)
   * Prevents accidental typo correction when the user types actual guest names or room types
   */
  function getEntityWordSet() {
    if (cachedEntityWordSet) return cachedEntityWordSet;
    const set = new Set();

    try {
      const guests = getGuests();
      guests.forEach(g => {
        if (g && g.name) {
          normalize(String(g.name)).split(' ').forEach(w => {
            if (w && w.length >= 2) set.add(w);
          });
        }
      });

      const rooms = getRooms();
      rooms.forEach(r => {
        if (r && r.type) {
          normalize(String(r.type)).split(' ').forEach(w => {
            if (w && w.length >= 2) set.add(w);
          });
        }
      });
    } catch {}

    cachedEntityWordSet = set;
    return cachedEntityWordSet;
  }

  function invalidateEntityWordSet() {
    cachedEntityWordSet = null;
  }

  /**
   * Corrects a single token against keyword vocabulary with strict guardrails
   */
  function correctToken(token, entityWordSet) {
    if (!token || token.length <= 3) return null;
    if (/^\d+$/.test(token) || /^[@#!]/.test(token)) return null;
    if (entityWordSet && entityWordSet.has(token)) return null;

    const vocab = getKeywordVocab();
    // Exact match is already handled cleanly by normal intent matching
    if (vocab.has(token)) return null;

    // Prefix guard: if token is a strict prefix of any keyword, treat as incomplete input for suggestions, not a typo
    for (const [kw] of vocab) {
      if (kw.startsWith(token) && token.length < kw.length) {
        return null;
      }
    }

    const maxAllowedDist = token.length <= 6 ? 1 : 2;
    let minDist = maxAllowedDist + 1;
    let candidates = [];

    // 1. Damerau-Levenshtein direct pass
    for (const [kw] of vocab) {
      if (Math.abs(token.length - kw.length) > maxAllowedDist) continue;
      const dist = editDistance(token, kw, maxAllowedDist);
      if (dist <= maxAllowedDist) {
        if (dist < minDist) {
          minDist = dist;
          candidates = [{ kw, dist }];
        } else if (dist === minDist) {
          candidates.push({ kw, dist });
        }
      }
    }

    // 2. Phonetic fallback if no direct candidate was found
    if (candidates.length === 0) {
      const tokenPhonetic = phoneticKey(token);
      let minPhoneticDist = maxAllowedDist + 2;

      for (const [kw] of vocab) {
        if (tokenPhonetic === phoneticKey(kw)) {
          const dist = editDistance(token, kw, maxAllowedDist + 1);
          if (dist <= maxAllowedDist + 1) {
            if (dist < minPhoneticDist) {
              minPhoneticDist = dist;
              candidates = [{ kw, dist }];
            } else if (dist === minPhoneticDist) {
              candidates.push({ kw, dist });
            }
          }
        }
      }
    }

    if (candidates.length === 0) return null;

    // Check for ties across different commands
    const tiedCommandIds = new Set();
    candidates.forEach(c => {
      const entries = vocab.get(c.kw) || [];
      entries.forEach(e => tiedCommandIds.add(e.commandId));
    });

    // Tie-break guard: if equidistant to keywords from different commands, do not correct
    if (tiedCommandIds.size > 1) {
      return null;
    }

    return candidates[0].kw;
  }

  /**
   * Reorders a standalone 1-5 digit number to the end of the query
   * Example: "205 فاتورة" -> "فاتورة 205"
   */
  function reorderNumberLast(text) {
    if (!text) return null;
    const trimmed = String(text).trim();
    // Standalone 1-5 digits preceded by start/space, not part of larger digits, followed by space and non-whitespace
    const match = trimmed.match(/(?:^|\s)(\d{1,5})(?!\d)(?=\s+\S)/);
    if (!match) return null;

    const num = match[1];
    const matchOffset = match[0].indexOf(num);
    const numStart = match.index + matchOffset;
    const numEnd = numStart + num.length;

    const before = trimmed.slice(0, numStart).trim();
    const after = trimmed.slice(numEnd).trim();
    const remaining = [before, after].filter(Boolean).join(' ');
    if (!remaining) return null;

    return `${remaining} ${num}`;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2.2 PREFIX COMMAND SUGGESTIONS (COMMAND AUTOCOMPLETION)
  // ─────────────────────────────────────────────────────────────────────────────

  const COMMAND_METADATA = {
    'invoice': { icon: '🧾', label: 'فاتورة', subtitle: 'إصدار ومعاينة الفاتورة الضريبية', requiresArg: true, canonical: 'فاتورة' },
    'voucher': { icon: '💳', label: 'سند قبض', subtitle: 'تسجيل سند قبض وتحصيل مالي', requiresArg: true, canonical: 'سند' },
    'extend': { icon: '📅', label: 'تمديد إقامة', subtitle: 'تمديد حجز وإقامة نزيل', requiresArg: true, canonical: 'تمديد' },
    'transfer': { icon: '🔄', label: 'نقل الغرفة', subtitle: 'نقل نزيل إلى غرفة بديلة', requiresArg: true, canonical: 'نقل' },
    'whatsapp': { icon: '💬', label: 'واتساب', subtitle: 'إرسال رسالة واتساب للنزيل', requiresArg: true, canonical: 'واتساب' },
    'booking': { icon: '➕', label: 'تسكين وحجز', subtitle: 'تسجيل حجز أو تسكين جديد', requiresArg: true, canonical: 'تسكين' },
    'room-inquiry': { icon: '🚪', label: 'استعلام الغرفة', subtitle: 'استعراض بيانات وحالة الغرفة', requiresArg: true, canonical: 'غرفة' },
    'shift': { icon: '💵', label: 'تقرير الوردية', subtitle: 'عرض تقرير إقفال الوردية والخزينة', requiresArg: false },
    'unpaid': { icon: '💳', label: 'ديون ومستحقات', subtitle: 'استعراض الحجوزات والديون غير المسددة', requiresArg: false },
    'departures': { icon: '🚪', label: 'مغادرات اليوم', subtitle: 'استعراض المغادرات المقررة لتاريخ اليوم', requiresArg: false },
    'late': { icon: '⏰', label: 'متأخرون عن المغادرة', subtitle: 'استعراض النزلاء المتأخرين عن المغادرة', requiresArg: false },
    'available': { icon: '🟢', label: 'غرف متاحة', subtitle: 'استعراض الغرف الشاغرة الجاهزة للتسكين', requiresArg: false },
    'occupied': { icon: '🔴', label: 'غرف مشغولة', subtitle: 'استعراض الغرف المسكونة والمحجوزة', requiresArg: false },
    'cleaning': { icon: '🧹', label: 'غرف تحت التنظيف', subtitle: 'استعراض الغرف التي تنتظر النظافة والصيانة', requiresArg: false },
    'floor': { icon: '🏢', label: 'تصفية بالطابق', subtitle: 'تصفية واستعراض الغرف حسب الطابق', requiresArg: false },
    'blacklist': { icon: '⛔', label: 'قائمة الحظر', subtitle: 'استعراض النزلاء المحظورين أمنياً', requiresArg: false },
    'backup': { icon: '💾', label: 'نسخ احتياطي', subtitle: 'إنشاء نسخة احتياطية فورية لقاعدة البيانات', requiresArg: false }
  };

  /**
   * Generates up to 3 prefix command suggestions when full command intent match fails
   */
  function getPrefixCommandSuggestions(rawQuery, intent, context) {
    const norm = (intent && intent.query) ? intent.query : normalize(rawQuery);
    if (!norm) return [];

    const tokens = norm.split(' ').filter(Boolean);
    const prefixToken = tokens.find(t => !/^\d+$/.test(t));
    if (!prefixToken || prefixToken.length < 2 || /^[@#!]/.test(prefixToken)) {
      return [];
    }

    const prefixLen = prefixToken.length;
    const vocab = getKeywordVocab();
    const candidateMap = new Map(); // commandId -> { cmd, kw, canonical }

    for (const [kw, entries] of vocab) {
      if (prefixLen === 2 && kw.length < 4) continue;
      if (kw.startsWith(prefixToken)) {
        entries.forEach(entry => {
          const cmd = COMMAND_REGISTRY.find(c => c.id === entry.commandId);
          if (!cmd) return;
          if (!candidateMap.has(cmd.id) || candidateMap.get(cmd.id).kw.length > kw.length) {
            candidateMap.set(cmd.id, { cmd, kw, canonical: entry.canonical });
          }
        });
      }
    }

    if (candidateMap.size === 0) return [];

    const recentItems = getRecentItems();
    const candidates = Array.from(candidateMap.values());

    candidates.sort((a, b) => {
      const recentIndexA = recentItems.findIndex(r =>
        r.title?.includes(a.cmd.name) || r.title?.includes(a.canonical) || (a.cmd.id && r.id?.includes(a.cmd.id))
      );
      const recentIndexB = recentItems.findIndex(r =>
        r.title?.includes(b.cmd.name) || r.title?.includes(b.canonical) || (b.cmd.id && r.id?.includes(b.cmd.id))
      );
      const rankA = recentIndexA >= 0 ? recentIndexA : 999;
      const rankB = recentIndexB >= 0 ? recentIndexB : 999;
      if (rankA !== rankB) return rankA - rankB;
      return a.kw.length - b.kw.length;
    });

    const topCandidates = candidates.slice(0, 3);
    const results = [];

    topCandidates.forEach(({ cmd, canonical }) => {
      const meta = COMMAND_METADATA[cmd.id] || {
        icon: '⚡',
        label: cmd.name,
        subtitle: '',
        requiresArg: false,
        canonical
      };

      const titleText = meta.label || canonical;
      const subtitleText = meta.subtitle || cmd.name;

      results.push({
        category: '🎯 أوامر مقترحة',
        icon: meta.icon || '⚡',
        title: titleText,
        subtitle: subtitleText,
        badge: meta.requiresArg ? 'إكمال ⇥' : 'تشغيل ↵',
        isSuggestion: true,
        preventClose: meta.requiresArg,
        actionFn: () => {
          if (meta.requiresArg) {
            const canonicalWord = meta.canonical || canonical;
            let autocompletedText = '';
            if (rawQuery && rawQuery.includes(prefixToken)) {
              autocompletedText = rawQuery.replace(new RegExp(prefixToken, 'i'), canonicalWord).trim() + ' ';
            } else {
              autocompletedText = canonicalWord + ' ';
            }

            if (paletteInput) {
              paletteInput.value = autocompletedText;
              paletteInput.focus();
              handlePaletteSearch(autocompletedText);
            }
          } else {
            closeCommandPalette();
            const subContext = { ...context, results: [] };
            cmd.handle(subContext, {});
            if (subContext.results.length > 0 && typeof subContext.results[0].actionFn === 'function') {
              subContext.results[0].actionFn();
            }
          }
        }
      });
    });

    return results;
  }

  // Pre-normalized search cache (WeakMap) to eliminate redundant per-keystroke normalizations
  const entitySearchCache = new WeakMap();

  function getEntityNormalizedField(entity, fieldKey) {
    if (!entity || typeof entity !== 'object') return '';
    let cached = entitySearchCache.get(entity);
    if (!cached) {
      cached = {};
      entitySearchCache.set(entity, cached);
    }
    if (cached[fieldKey] !== undefined) {
      return cached[fieldKey];
    }
    const val = entity[fieldKey];
    const normalizedVal = (val || val === 0) ? normalize(String(val)) : '';
    cached[fieldKey] = normalizedVal;
    return normalizedVal;
  }

  function buildSearchIndex() {
    invalidateEntityWordSet();
    const rooms = getRooms();
    const reservations = getReservations();
    const guests = getGuests();

    rooms.forEach(r => {
      if (r && typeof r === 'object') {
        entitySearchCache.set(r, {
          room_number: normalize(String(r.room_number || '')),
          type: normalize(String(r.type || '')),
          status: normalize(String(r.status || ''))
        });
      }
    });

    reservations.forEach(res => {
      if (res && typeof res === 'object') {
        entitySearchCache.set(res, {
          id: normalize(String(res.id || '')),
          guest_name: normalize(String(res.guest_name || '')),
          guest_phone: normalize(String(res.guest_phone || '')),
          room_number: normalize(String(res.room_number || ''))
        });
      }
    });

    guests.forEach(g => {
      if (g && typeof g === 'object') {
        entitySearchCache.set(g, {
          name: normalize(String(g.name || '')),
          phone: normalize(String(g.phone || '')),
          id_number: normalize(String(g.id_number || '')),
          national_id: normalize(String(g.national_id || ''))
        });
      }
    });
  }

  const RECENT_ITEMS_STORAGE_KEY = 'rayhana_palette_recent_mru';
  const recentActionsRegistry = new Map();

  function deduceActionFromRecord(rec, reservations = getReservations(), rooms = getRooms()) {
    if (!rec || !rec.title) return null;
    const title = String(rec.title).trim();
    const resIdMatch = title.match(/#\s*(\d+)/);
    const roomMatch = title.match(/(?:غرفة|غ)\s*(\d{1,5})/);
    const roomNum = roomMatch ? normalizeDigits(roomMatch[1]) : null;
    const resId = resIdMatch ? resIdMatch[1] : null;

    let res = null;
    if (resId) {
      res = reservations.find(r => String(r.id) === String(resId));
    }
    if (!res && roomNum) {
      res = reservations.find(r => String(r.room_number) === String(roomNum) && r.status === 'مؤكد') ||
            reservations.find(r => String(r.room_number) === String(roomNum));
    }
    const room = roomNum ? rooms.find(r => String(r.room_number) === String(roomNum)) : null;

    if (/مستحق|سداد|سند|قبض|دفعة/i.test(title)) {
      return { actionType: 'payment', actionPayload: { reservationId: res?.id || resId, reservation: res, roomNumber: roomNum } };
    }
    if (/فاتورة/i.test(title)) {
      return { actionType: 'invoice', actionPayload: { reservationId: res?.id || resId, reservation: res, roomNumber: roomNum } };
    }
    if (/تمديد/i.test(title)) {
      return { actionType: 'extend', actionPayload: { reservationId: res?.id || resId, reservation: res, roomNumber: roomNum } };
    }
    if (/مغادرة|خروج|تسوية/i.test(title)) {
      return { actionType: 'checkout', actionPayload: { reservationId: res?.id || resId, reservation: res, roomNumber: roomNum } };
    }
    if (/نقل/i.test(title)) {
      return { actionType: 'transfer', actionPayload: { reservationId: res?.id || resId, reservation: res, roomNumber: roomNum } };
    }
    if (/واتساب|whatsapp/i.test(title)) {
      return { actionType: 'whatsapp', actionPayload: { reservationId: res?.id || resId, roomNumber: roomNum } };
    }
    if (/تنظيف/i.test(title)) {
      return { actionType: 'mark-clean', actionPayload: { roomId: room?.id, roomNumber: roomNum } };
    }
    if (/تسكين/i.test(title)) {
      return { actionType: 'booking', actionPayload: { roomId: room?.id, roomNumber: roomNum } };
    }
    if (res || resId || /مشغولة|النزيل|تفاصيل الحجز/i.test(title)) {
      return { actionType: 'preview', actionPayload: { reservationId: res?.id || resId, reservation: res, roomNumber: roomNum } };
    }
    if (room) {
      if (room.status === 'متاحة') return { actionType: 'booking', actionPayload: { roomId: room.id, roomNumber: roomNum } };
      if (room.status === 'تنظيف') return { actionType: 'mark-clean', actionPayload: { roomId: room.id, roomNumber: roomNum } };
      return { actionType: 'view-section', actionPayload: { section: 'rooms', roomNumber: roomNum } };
    }
    if (/النزيل/i.test(title)) {
      return { actionType: 'view-section', actionPayload: { section: 'guests' } };
    }
    if (/تقرير الوردية|فلوس الدرج|الخزينة/i.test(title)) {
      return { actionType: 'command', actionPayload: { command: 'shift' } };
    }
    if (/صندوق المهام|تنبيهات/i.test(title)) {
      return { actionType: 'attention-tab', actionPayload: { tab: 'all' } };
    }
    if (/متأخرون/i.test(title)) {
      return { actionType: 'attention-tab', actionPayload: { tab: 'late-checkout' } };
    }
    if (/مغادرات اليوم/i.test(title)) {
      return { actionType: 'attention-tab', actionPayload: { tab: 'departures-today' } };
    }
    if (/الديون|مستحقات/i.test(title)) {
      return { actionType: 'attention-tab', actionPayload: { tab: 'unpaid-balance' } };
    }
    if (/غرف متاحة|غرف مشغولة|غرف التنظيف|شاشة الغرف/i.test(title)) {
      return { actionType: 'view-section', actionPayload: { section: 'rooms' } };
    }
    if (/الحجوزات|سجل الحجوزات/i.test(title)) {
      return { actionType: 'view-section', actionPayload: { section: 'reservations' } };
    }
    if (/دليل النزلاء/i.test(title)) {
      return { actionType: 'view-section', actionPayload: { section: 'guests' } };
    }
    return null;
  }

  function getRecentItems() {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(RECENT_ITEMS_STORAGE_KEY);
      const items = raw ? JSON.parse(raw) : [];
      let updated = false;
      const res = getReservations();
      const rms = getRooms();
      items.forEach(item => {
        if (!item.actionType) {
          const deduced = deduceActionFromRecord(item, res, rms);
          if (deduced) {
            item.actionType = deduced.actionType;
            item.actionPayload = item.actionPayload || deduced.actionPayload;
            updated = true;
          }
        }
      });
      if (updated) {
        try {
          localStorage.setItem(RECENT_ITEMS_STORAGE_KEY, JSON.stringify(items));
        } catch {}
      }
      return items;
    } catch {
      return [];
    }
  }

  function recordRecentItem(item) {
    if (!item || !item.title || typeof localStorage === 'undefined') return;
    try {
      let list = getRecentItems();
      const existing = list.find(i => i.title === item.title);
      list = list.filter(i => i.title !== item.title);

      let actionType = item.actionType || (existing && existing.actionType) || null;
      let actionPayload = item.actionPayload || (existing && existing.actionPayload) || null;
      const query = item.query || (existing && existing.query) || null;

      if (!actionType) {
        const deduced = deduceActionFromRecord(item, getReservations(), getRooms());
        if (deduced) {
          actionType = deduced.actionType;
          actionPayload = actionPayload || deduced.actionPayload;
        }
      }

      list.unshift({
        id: item.id || (existing && existing.id) || `rec-${Date.now()}`,
        title: item.title,
        subtitle: item.subtitle || (existing && existing.subtitle) || '',
        icon: typeof item.icon === 'string' ? item.icon.slice(0, 10) : '🕒',
        badge: item.badge || 'سابق',
        actionType,
        actionPayload,
        query
      });
      list = list.slice(0, 5);
      localStorage.setItem(RECENT_ITEMS_STORAGE_KEY, JSON.stringify(list));

      if (typeof item.actionFn === 'function' && !item.isRecentWrapper) {
        recentActionsRegistry.set(item.title, item.actionFn);
      }
    } catch {}
  }

  function canReplayAction(actionType) {
    if (!actionType) return false;
    return ['payment', 'checkout', 'extend', 'transfer', 'invoice', 'room-inquiry', 'booking', 'whatsapp', 'mark-clean', 'preview', 'attention-tab', 'view-section', 'backup', 'command'].includes(actionType);
  }

  function replayAction(actionType, payload, context) {
    if (!actionType) return;
    const p = payload || {};
    const resId = p.reservationId || p.resId;
    const roomId = p.roomId;
    const roomNumber = p.roomNumber;
    const reservations = context?.reservations || getReservations();
    const rooms = context?.rooms || getRooms();

    switch (actionType) {
      case 'payment': {
        const id = resId || (roomNumber ? reservations.find(r => String(r.room_number) === String(roomNumber) && r.status === 'مؤكد')?.id : null);
        if (id && window.openAddPaymentModal) {
          window.openAddPaymentModal(id);
        } else if (id && App?.Helpers?.openReservationPreview) {
          App.Helpers.openReservationPreview(id);
        } else {
          showMissingHelperToast();
        }
        break;
      }
      case 'checkout': {
        let res = p.reservation;
        if (!res) {
          res = reservations.find(r => (resId && String(r.id) === String(resId)) || (roomNumber && String(r.room_number) === String(roomNumber) && r.status === 'مؤكد'));
        }
        if (res && App?.Helpers?.openContractSettleModal) {
          App.Helpers.openContractSettleModal(res);
        } else if (res && App?.Helpers?.openReservationPreview) {
          App.Helpers.openReservationPreview(res.id);
        } else {
          showMissingHelperToast();
        }
        break;
      }
      case 'extend': {
        const id = resId || (roomNumber ? reservations.find(r => String(r.room_number) === String(roomNumber) && r.status === 'مؤكد')?.id : null);
        if (id && window.openExtendStayModal) {
          window.openExtendStayModal(id);
        } else if (id && App?.Helpers?.openReservationPreview) {
          App.Helpers.openReservationPreview(id);
        } else {
          showMissingHelperToast();
        }
        break;
      }
      case 'transfer': {
        const id = resId || (roomNumber ? reservations.find(r => String(r.room_number) === String(roomNumber) && r.status === 'مؤكد')?.id : null);
        if (id && window.openTransferRoomModal) {
          window.openTransferRoomModal(id);
        } else if (id && App?.Helpers?.openTransferRoomModal) {
          App.Helpers.openTransferRoomModal(id);
        } else {
          showMissingHelperToast();
        }
        break;
      }
      case 'invoice': {
        const id = resId || (roomNumber ? reservations.find(r => String(r.room_number) === String(roomNumber) && r.status === 'مؤكد')?.id : null);
        if (id && window.openInvoiceModal) {
          window.openInvoiceModal(id);
        } else if (id && App?.Helpers?.openReservationPreview) {
          App.Helpers.openReservationPreview(id);
        } else {
          showMissingHelperToast();
        }
        break;
      }
      case 'room-inquiry': {
        let rm = p.room;
        if (!rm) {
          rm = rooms.find(r => (roomId && r.id === roomId) || (roomNumber && String(r.room_number) === String(roomNumber)));
        }
        const activeRes = p.reservation || reservations.find(r => (roomId && r.room_id === roomId) || (roomNumber && String(r.room_number) === String(roomNumber) && r.status === 'مؤكد'));
        if (activeRes && App?.Helpers?.openReservationPreview) {
          App.Helpers.openReservationPreview(activeRes.id);
        } else if (rm) {
          switchViewSection('rooms');
          const searchInput = document.getElementById('search-rooms');
          if (searchInput) {
            searchInput.value = rm.room_number || roomNumber;
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
        } else {
          showMissingHelperToast();
        }
        break;
      }
      case 'booking': {
        let rm = p.room;
        if (!rm && (roomId || roomNumber)) {
          rm = rooms.find(r => (roomId && r.id === roomId) || (roomNumber && String(r.room_number) === String(roomNumber)));
        }
        const targetId = rm?.id || roomId;
        if (targetId && App?.Helpers?.initiateRoomBooking) {
          App.Helpers.initiateRoomBooking(targetId);
        } else {
          const btn = document.getElementById('btn-open-new-reservation-modal');
          if (btn) btn.click();
          else switchViewSection('rooms');
        }
        break;
      }
      case 'whatsapp': {
        const id = resId || (roomNumber ? reservations.find(r => String(r.room_number) === String(roomNumber) && r.status === 'مؤكد')?.id : null);
        if (id && window.sendReservationWhatsApp) {
          window.sendReservationWhatsApp(id);
        } else {
          showMissingHelperToast();
        }
        break;
      }
      case 'mark-clean': {
        let rm = p.room;
        if (!rm && (roomId || roomNumber)) {
          rm = rooms.find(r => (roomId && r.id === roomId) || (roomNumber && String(r.room_number) === String(roomNumber)));
        }
        if (rm) {
          requestRoomCleaningCompletion(rm);
        } else {
          showMissingHelperToast();
        }
        break;
      }
      case 'preview': {
        const id = resId || (roomNumber ? reservations.find(r => String(r.room_number) === String(roomNumber) && r.status === 'مؤكد')?.id : null);
        if (id && App?.Helpers?.openReservationPreview) {
          App.Helpers.openReservationPreview(id);
        } else if (id && window.openInvoiceModal) {
          window.openInvoiceModal(id);
        } else {
          showMissingHelperToast();
        }
        break;
      }
      case 'attention-tab':
        openAttentionInboxModal(p.tab || 'all');
        break;
      case 'command': {
        if (p.command === 'shift') {
          const currentUserRole = App?.State?.currentUser?.role || (typeof localStorage !== 'undefined' ? localStorage.getItem('currentUserRole') : null);
          const isAdmin = currentUserRole === 'Admin';
          if (!isAdmin) {
            if (App?.Helpers?.showToast) App.Helpers.showToast('تقرير الوردية التفصيلي متاح لمدير النظام فقط (Admin).', 'warning');
            return;
          }
          if (typeof window.openShiftAuditModal === 'function') window.openShiftAuditModal();
          else showMissingHelperToast();
        }
        break;
      }
      case 'view-section':
        if (p.section) switchViewSection(p.section);
        if (p.guestName) {
          const searchInput = document.getElementById('search-guests');
          if (searchInput) {
            searchInput.value = p.guestName;
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
        if (p.roomNumber) {
          const searchInput = document.getElementById('search-rooms');
          if (searchInput) {
            searchInput.value = p.roomNumber;
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
        break;
      case 'backup':
        if (typeof window.openDailyBackupModal === 'function') {
          window.openDailyBackupModal();
        }
        break;
      default:
        break;
    }
  }

  function tryHeuristicAction(rec, context) {
    if (!rec || !rec.title) return null;
    const title = String(rec.title).trim();
    const reservations = context?.reservations || getReservations();
    const rooms = context?.rooms || getRooms();

    if (/^غرف\s*متاحة/i.test(title)) {
      return () => switchViewSection('rooms');
    }
    if (/^غرف\s*مشغولة/i.test(title)) {
      return () => switchViewSection('rooms');
    }
    if (/^غرف\s*(تحت\s*)?التنظيف/i.test(title)) {
      return () => switchViewSection('rooms');
    }
    if (/متأخرون\s*عن\s*المغادرة|النزلاء\s*المتأخرون/i.test(title)) {
      return () => openAttentionInboxModal('late-checkout');
    }
    if (/مغادرات\s*اليوم/i.test(title)) {
      return () => openAttentionInboxModal('departures-today');
    }
    if (/الديون|مستحقات\s*غير\s*مدفوعة/i.test(title)) {
      return () => openAttentionInboxModal('unpaid-balance');
    }
    if (/تقرير\s*الوردية|فلوس\s*الدرج|الوردية\s*والدرج/i.test(title)) {
      return () => {
        const currentUserRole = App?.State?.currentUser?.role || (typeof localStorage !== 'undefined' ? localStorage.getItem('currentUserRole') : null);
        const isAdmin = currentUserRole === 'Admin';
        if (!isAdmin) {
          if (App?.Helpers?.showToast) App.Helpers.showToast('تقرير الوردية التفصيلي متاح لمدير النظام فقط (Admin).', 'warning');
          return;
        }
        if (typeof window.openShiftAuditModal === 'function') window.openShiftAuditModal();
        else showMissingHelperToast();
      };
    }

    // 1. Check reservation ID in title: e.g. #67, تفاصيل الحجز #67, حجز #104
    const resIdMatch = title.match(/#\s*(\d+)/);
    if (resIdMatch) {
      const resId = resIdMatch[1];
      const res = reservations.find(r => String(r.id) === String(resId));

      if (/فاتورة/i.test(title)) {
        return () => {
          if (window.openInvoiceModal) window.openInvoiceModal(resId);
          else if (App?.Helpers?.openReservationPreview) App.Helpers.openReservationPreview(resId);
          else showMissingHelperToast();
        };
      }
      if (/مستحق|سداد|سند|قبض|دفعة/i.test(title)) {
        return () => {
          if (window.openAddPaymentModal) window.openAddPaymentModal(resId);
          else if (App?.Helpers?.openReservationPreview) App.Helpers.openReservationPreview(resId);
          else showMissingHelperToast();
        };
      }
      if (/تمديد/i.test(title)) {
        return () => {
          if (window.openExtendStayModal) window.openExtendStayModal(resId);
          else if (App?.Helpers?.openReservationPreview) App.Helpers.openReservationPreview(resId);
          else showMissingHelperToast();
        };
      }
      if (/مغادرة|خروج|تسوية/i.test(title)) {
        return () => {
          if (res && App?.Helpers?.openContractSettleModal) App.Helpers.openContractSettleModal(res);
          else if (App?.Helpers?.openReservationPreview) App.Helpers.openReservationPreview(resId);
          else showMissingHelperToast();
        };
      }
      if (/نقل/i.test(title)) {
        return () => {
          if (window.openTransferRoomModal) window.openTransferRoomModal(resId);
          else if (App?.Helpers?.openTransferRoomModal) App.Helpers.openTransferRoomModal(resId);
          else showMissingHelperToast();
        };
      }
      if (/واتساب|whatsapp/i.test(title)) {
        return () => {
          if (window.sendReservationWhatsApp) window.sendReservationWhatsApp(resId);
          else showMissingHelperToast();
        };
      }
      return () => {
        if (App?.Helpers?.openReservationPreview) {
          App.Helpers.openReservationPreview(resId);
        } else if (window.openInvoiceModal) {
          window.openInvoiceModal(resId);
        } else {
          showMissingHelperToast();
        }
      };
    }

    // 2. Check room number in title: e.g. غرفة 202, غ 202
    const roomMatch = title.match(/(?:غرفة|غ)\s*(\d{1,5})/);
    if (roomMatch) {
      const roomNum = normalizeDigits(roomMatch[1]);
      const res = reservations.find(r => String(r.room_number) === String(roomNum) && r.status === 'مؤكد') ||
                  reservations.find(r => String(r.room_number) === String(roomNum));
      const room = rooms.find(r => String(r.room_number) === String(roomNum));

      if (/مستحق|سداد|سند|قبض|دفعة/i.test(title)) {
        if (res) {
          return () => {
            if (window.openAddPaymentModal) window.openAddPaymentModal(res.id);
            else if (App?.Helpers?.openReservationPreview) App.Helpers.openReservationPreview(res.id);
            else showMissingHelperToast();
          };
        }
      }
      if (/فاتورة/i.test(title)) {
        if (res) {
          return () => {
            if (window.openInvoiceModal) window.openInvoiceModal(res.id);
            else if (App?.Helpers?.openReservationPreview) App.Helpers.openReservationPreview(res.id);
            else showMissingHelperToast();
          };
        }
      }
      if (/تمديد/i.test(title)) {
        if (res) {
          return () => {
            if (window.openExtendStayModal) window.openExtendStayModal(res.id);
            else if (App?.Helpers?.openReservationPreview) App.Helpers.openReservationPreview(res.id);
            else showMissingHelperToast();
          };
        }
      }
      if (/مغادرة|خروج|تسوية/i.test(title)) {
        if (res) {
          return () => {
            if (App?.Helpers?.openContractSettleModal) App.Helpers.openContractSettleModal(res);
            else if (App?.Helpers?.openReservationPreview) App.Helpers.openReservationPreview(res.id);
            else showMissingHelperToast();
          };
        }
      }
      if (/نقل/i.test(title)) {
        if (res) {
          return () => {
            if (window.openTransferRoomModal) window.openTransferRoomModal(res.id);
            else if (App?.Helpers?.openTransferRoomModal) App.Helpers.openTransferRoomModal(res.id);
            else showMissingHelperToast();
          };
        }
      }
      if (/واتساب|whatsapp/i.test(title)) {
        if (res) {
          return () => {
            if (window.sendReservationWhatsApp) window.sendReservationWhatsApp(res.id);
            else showMissingHelperToast();
          };
        }
      }
      if (/تنظيف/i.test(title)) {
        if (room) {
          return () => requestRoomCleaningCompletion(room);
        }
      }
      if (/تسكين/i.test(title)) {
        if (room) {
          return () => {
            if (App?.Helpers?.initiateRoomBooking) App.Helpers.initiateRoomBooking(room.id);
            else switchViewSection('rooms');
          };
        }
      }
      // If room is occupied, mentions guest, or reservation exists:
      if (res) {
        return () => {
          if (App?.Helpers?.openReservationPreview) {
            App.Helpers.openReservationPreview(res.id);
          } else {
            showMissingHelperToast();
          }
        };
      }
      if (room) {
        if (room.status === 'متاحة') {
          return () => {
            if (App?.Helpers?.initiateRoomBooking) App.Helpers.initiateRoomBooking(room.id);
            else switchViewSection('rooms');
          };
        }
        if (room.status === 'تنظيف') {
          return () => requestRoomCleaningCompletion(room);
        }
        return () => {
          switchViewSection('rooms');
          const searchInput = document.getElementById('search-rooms');
          if (searchInput) {
            searchInput.value = roomNum;
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
        };
      }
    }

    const matchedCmd = COMMAND_REGISTRY.find(c => c.name === title || c.id === title);
    if (matchedCmd && typeof matchedCmd.handle === 'function') {
      return () => matchedCmd.handle(context);
    }

    return null;
  }

  function resolveRecentActionItem(rec, context) {
    const reservations = context?.reservations || getReservations();
    const rooms = context?.rooms || getRooms();

    // Auto-heal missing actionType/payload from title if absent
    if (!rec.actionType) {
      const deduced = deduceActionFromRecord(rec, reservations, rooms);
      if (deduced) {
        rec.actionType = deduced.actionType;
        rec.actionPayload = rec.actionPayload || deduced.actionPayload;
      }
    }

    const cachedFn = recentActionsRegistry.get(rec.title);
    if (typeof cachedFn === 'function') {
      return {
        category: '🕒 تم الوصول إليها مؤخراً',
        icon: rec.icon || '🕒',
        title: rec.title,
        subtitle: rec.subtitle || 'سجل العمليات السابقة',
        badge: rec.badge || 'أخير',
        isRecentWrapper: true,
        actionType: rec.actionType,
        actionPayload: rec.actionPayload,
        actionFn: cachedFn
      };
    }

    if (rec.actionType && canReplayAction(rec.actionType)) {
      return {
        category: '🕒 تم الوصول إليها مؤخراً',
        icon: rec.icon || '🕒',
        title: rec.title,
        subtitle: rec.subtitle || 'سجل العمليات السابقة',
        badge: rec.badge || 'أخير',
        isRecentWrapper: true,
        actionType: rec.actionType,
        actionPayload: rec.actionPayload,
        actionFn: () => replayAction(rec.actionType, rec.actionPayload, context)
      };
    }

    const heuristicFn = tryHeuristicAction(rec, context);
    if (typeof heuristicFn === 'function') {
      recentActionsRegistry.set(rec.title, heuristicFn);
      return {
        category: '🕒 تم الوصول إليها مؤخراً',
        icon: rec.icon || '🕒',
        title: rec.title,
        subtitle: rec.subtitle || 'سجل العمليات السابقة',
        badge: rec.badge || 'أخير',
        isRecentWrapper: true,
        actionType: rec.actionType,
        actionPayload: rec.actionPayload,
        actionFn: heuristicFn
      };
    }

    return {
      category: '🕒 تم الوصول إليها مؤخراً',
      icon: rec.icon || '🕒',
      title: rec.title,
      subtitle: rec.subtitle || 'سجل العمليات السابقة',
      badge: rec.badge || 'أخير',
      isRecentWrapper: true,
      preventClose: true,
      actionFn: () => {
        if (paletteInput) {
          paletteInput.value = rec.query || rec.title;
          handlePaletteSearch(rec.query || rec.title);
        }
      }
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. SHARED FINANCIAL HELPER ADAPTER
  // ─────────────────────────────────────────────────────────────────────────────

  function getResFin(res, bizDate) {
    if (App?.Helpers?.getReservationFinancials) {
      return App.Helpers.getReservationFinancials(res, bizDate);
    }
    const total = parseFloat(res?.total_price || 0);
    const paid = parseFloat((res?.ledger_paid_amount ?? res?.paid_amount) || 0);
    const deposit = parseFloat(res?.deposit_ledger_balance || 0);
    const legacyDeposit = Number(res?.deposit_legacy_unreconciled || 0) === 1 ? parseFloat(res?.deposit_amount || 0) : 0;
    const remaining = Math.max(0, total - paid);
    return {
      total,
      effectiveTotal: total,
      paid,
      deposit,
      legacyDeposit,
      rawRemaining: total - paid,
      remaining,
      isCredit: (total - paid) < -0.005,
      hasUnpaidBalance: remaining > 0.005,
      paymentStatus: res?.payment_status || 'غير مدفوع',
      isOverdue: false,
      overdueDays: 0,
      elapsedStayNights: 0
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. NEEDS-ATTENTION INBOX DATA ENGINE
  // ─────────────────────────────────────────────────────────────────────────────

  function computeAttentionInbox() {
    const resMap = new Map();
    getReservations().forEach(r => {
      if (r && r.id != null) resMap.set(Number(r.id), r);
    });

    const checkoutsSources = Array.isArray(App?.State?.todayCheckoutsRows)
      ? App.State.todayCheckoutsRows
      : (Array.isArray(localTodayCheckouts) ? localTodayCheckouts : []);

    checkoutsSources.forEach(r => {
      const id = Number(r.reservation_id ?? r.id);
      if (id) {
        const existing = resMap.get(id);
        if (existing) {
          if (existing.status === 'مكتمل' || existing.status === 'ملغي') {
            return;
          }
          resMap.set(id, { ...existing, ...r });
        } else if (r.status !== 'مكتمل' && r.status !== 'ملغي') {
          resMap.set(id, r);
        }
      }
    });

    const reservations = [...resMap.values()];
    const rooms = getRooms();
    const currentBizDate = getCurrentBizDate();

    const ARABIC_MONTH_NAMES = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];

    function formatPaletteArabicDate(dateStr) {
      if (!dateStr) return '-';
      const cleanStr = String(dateStr).trim().slice(0, 10);
      const parts = cleanStr.split('-').map(Number);
      if (parts.length !== 3 || isNaN(parts[0])) return dateStr;
      const [year, month, day] = parts;
      const monthName = ARABIC_MONTH_NAMES[month - 1] || '';
      const dayPadded = String(day).padStart(2, '0');
      return `${dayPadded} ${monthName} ${year}`;
    }

    function formatPalette12HourTime(timeStr) {
      if (!timeStr) return '';
      const match = String(timeStr).match(/^(\d{1,2}):(\d{2})/);
      if (!match) return timeStr;
      let hours = parseInt(match[1], 10);
      const minutes = match[2];
      const period = hours >= 12 ? 'م' : 'ص';
      if (hours === 0) hours = 12;
      else if (hours > 12) hours -= 12;
      const hoursPadded = String(hours).padStart(2, '0');
      return `${hoursPadded}:${minutes} ${period}`;
    }

    const lateCheckouts = [];
    const departuresToday = [];
    const completedDeparturesToday = [];
    const unpaidBalances = [];
    const dirtyRooms = [];
    const monthlyDue = [];
    const legacyDeposits = [];

    // Track per-reservation attention reasons for deduplication in "All" tab
    const resAttentionMap = new Map();

    function addReservationReason(res, reasonObj) {
      const resId = Number(res.id);
      if (!resAttentionMap.has(resId)) {
        resAttentionMap.set(resId, {
          id: resId,
          reservation: res,
          reasons: [],
          primaryAction: reasonObj.action,
          primaryActionText: reasonObj.primaryActionText
        });
      }
      const record = resAttentionMap.get(resId);
      record.reasons.push(reasonObj);

      // Priority ordering for primary action: checkout > payment > extend > preview
      const priorities = { 'checkout': 4, 'payment': 3, 'extend': 2, 'preview': 1 };
      const currentPriority = priorities[record.primaryAction] || 0;
      const newPriority = priorities[reasonObj.action] || 0;
      if (newPriority > currentPriority) {
        record.primaryAction = reasonObj.action;
        record.primaryActionText = reasonObj.primaryActionText;
      }
    }

    // Evaluate Reservations
    reservations.forEach(res => {
      const checkOutDate = String(res.check_out_date || '').slice(0, 10);
      const isContract = res.booking_type === 'عقد مفتوح';
      const isMonthly = res.booking_type === 'حجز شهري';

      // Track completed departures today (fixes "two leaving today" disparity)
      if (res.status === 'مكتمل' && checkOutDate === currentBizDate) {
        completedDeparturesToday.push({
          id: res.id,
          reservation: res,
          type: 'completed-departure',
          title: `غرفة ${res.room_number || '-'} • ${res.guest_name || 'نزيل'} (تمت المغادرة ✓)`,
          subtitle: `تاريخ المغادرة: ${formatPaletteArabicDate(checkOutDate)} • الحالة: مكتمل وسدد الحساب`,
          badge: 'تمت المغادرة ✓',
          badgeClass: 'info',
          primaryActionText: 'معاينة الفاتورة',
          action: 'preview'
        });
      }

      if (res.status !== 'مؤكد') return;

      const isOverdueByDate = Boolean(checkOutDate && checkOutDate < currentBizDate);
      const isLateByHelper = Boolean(App?.Helpers?.isLateCheckout && App.Helpers.isLateCheckout(res));
      const isLate = !isContract && (isOverdueByDate || isLateByHelper);

      const fin = getResFin(res, currentBizDate);
      const balance = fin.remaining;
      const paid = fin.paid;
      const total = fin.effectiveTotal;

      // 1. Late checkouts
      if (isLate) {
        const expectedTime = App?.Helpers?.getExpectedCheckoutTime ? App.Helpers.getExpectedCheckoutTime(res) : '14:00';
        const formattedDate = formatPaletteArabicDate(checkOutDate);
        const formattedTime = expectedTime ? ` (${formatPalette12HourTime(expectedTime)})` : '';
        const balanceTxt = balance <= 0.005
          ? 'الحساب: مسدد بالكامل ✓'
          : `المتبقي للسداد: ${balance.toLocaleString('en-US')} ر.س`;

        const item = {
          id: res.id,
          reservation: res,
          type: 'late-checkout',
          title: `متأخر عن المغادرة • غرفة ${res.room_number || '-'}`,
          subtitle: `النزيل: ${res.guest_name || 'نزيل'} • موعد المغادرة المحدد: ${formattedDate}${formattedTime} • ${balanceTxt}`,
          badge: 'متأخر ⚠️',
          badgeClass: 'danger',
          primaryActionText: 'تسجيل مغادرة',
          action: 'checkout'
        };
        lateCheckouts.push(item);
        addReservationReason(res, item);
      }
      // 2. Departures due today (not yet late)
      else if (!isContract && checkOutDate === currentBizDate) {
        const expectedTime = App?.Helpers?.getExpectedCheckoutTime ? App.Helpers.getExpectedCheckoutTime(res) : '14:00';
        const formattedTime = expectedTime ? formatPalette12HourTime(expectedTime) : '02:00 م';
        const balanceTxt = balance <= 0.005
          ? 'الحساب: مسدد بالكامل ✓'
          : `المتبقي للسداد: ${balance.toLocaleString('en-US')} ر.س`;

        const item = {
          id: res.id,
          reservation: res,
          type: 'departures-today',
          title: `مغادرة مقررة اليوم • غرفة ${res.room_number || '-'}`,
          subtitle: `النزيل: ${res.guest_name || 'نزيل'} • موعد الإخلاء: الساعة ${formattedTime} • ${balanceTxt}`,
          badge: 'مغادرة اليوم 🚪',
          badgeClass: 'info',
          primaryActionText: 'تسجيل مغادرة',
          action: 'checkout'
        };
        departuresToday.push(item);
        addReservationReason(res, item);
      }

      // 3. Unpaid balances (exclude those already flagged as late checkout from the tab list)
      if (balance > 0.005) {
        const unpaidItem = {
          id: res.id,
          reservation: res,
          type: 'unpaid-balance',
          title: `مستحقات معلقة • غرفة ${res.room_number || '-'} (${balance.toLocaleString('en-US')} ر.س)`,
          subtitle: `النزيل: ${res.guest_name || 'نزيل'} • المستحق: ${balance.toLocaleString('en-US')} ر.س (المسدد: ${paid.toLocaleString('en-US')} ر.س من إجمالي ${total.toLocaleString('en-US')} ر.س)`,
          badge: 'مستحق سداد 💳',
          badgeClass: 'warning',
          primaryActionText: 'تحصيل دفعة',
          action: 'payment'
        };
        if (!isLate) {
          unpaidBalances.push(unpaidItem);
        }
        addReservationReason(res, unpaidItem);
      }

      // 4. Monthly contracts due soon (within 3 days of expiration or expired)
      if (isMonthly && checkOutDate) {
        const d1 = Date.parse(`${currentBizDate}T00:00:00Z`);
        const d2 = Date.parse(`${checkOutDate}T00:00:00Z`);
        const daysLeft = Math.round((d2 - d1) / 86400000);
        if (daysLeft <= 3) {
          let badgeText;
          let subtitleDesc;
          if (daysLeft === 0) {
            badgeText = 'مستحق التجديد اليوم 📅';
            subtitleDesc = 'مستحق التجديد اليوم';
          } else if (daysLeft < 0) {
            badgeText = `منتهي منذ ${Math.abs(daysLeft)} يوم ⚠️`;
            subtitleDesc = `منتهي منذ ${Math.abs(daysLeft)} يوم`;
          } else {
            badgeText = `يستحق بعد ${daysLeft} يوم 📅`;
            subtitleDesc = `متبقي ${daysLeft} يوم`;
          }

          const formattedRenewalDate = formatPaletteArabicDate(checkOutDate);
          const monthlyItem = {
            id: res.id,
            reservation: res,
            type: 'monthly-due',
            title: `إيجار شهري يقترب من التجديد • غرفة ${res.room_number || '-'}`,
            subtitle: `المستأجر: ${res.guest_name || 'مستأجر'} • تاريخ التجديد: ${formattedRenewalDate} (${subtitleDesc})`,
            badge: badgeText,
            badgeClass: daysLeft <= 0 ? 'danger' : 'purple',
            primaryActionText: 'تمديد العقد',
            action: 'extend'
          };
          monthlyDue.push(monthlyItem);
          addReservationReason(res, monthlyItem);
        }
      }

      // 5. Unreconciled legacy deposits (strictly deposit_legacy_unreconciled === 1)
      const hasLegacyDeposit = Number(res.deposit_legacy_unreconciled || 0) === 1;
      if (hasLegacyDeposit) {
        const depositItem = {
          id: res.id,
          reservation: res,
          type: 'legacy-deposit',
          title: `تأمين سابق بحاجة لمطابقة • غرفة ${res.room_number || '-'}`,
          subtitle: `النزيل: ${res.guest_name || 'نزيل'} • مبلغ التأمين: ${Number(res.deposit_amount || 0).toLocaleString('en-US')} ر.س`,
          badge: 'تأمين معلق 💰',
          badgeClass: 'warning',
          primaryActionText: 'معاينة الحساب',
          action: 'preview'
        };
        legacyDeposits.push(depositItem);
        addReservationReason(res, depositItem);
      }
    });

    // 6. Rooms waiting for cleaning
    rooms.forEach(room => {
      if (room.status === 'تنظيف') {
        dirtyRooms.push({
          id: room.id,
          room,
          type: 'dirty-rooms',
          title: `غرفة بانتظار النظافة • غرفة ${room.room_number || '-'}`,
          subtitle: `النوع: ${room.type || 'عادية'} • الطابق: ${room.floor || '1'} • السعر: ${Number(room.price_per_night || 0).toLocaleString('en-US')} ر.س`,
          badge: 'تحت التنظيف 🧹',
          badgeClass: 'purple',
          primaryActionText: 'تأكيد جاهزية الغرفة',
          action: 'mark-clean'
        });
      }
    });

    // Build deduplicated items for "All" tab
    const deduplicatedAllItems = [];

    // Add consolidated reservations
    resAttentionMap.forEach(record => {
      const firstReason = record.reasons[0];
      const badges = record.reasons.map(r => r.badge);
      const isUrgent = record.reasons.some(r => r.badgeClass === 'danger');
      const badgeClass = isUrgent ? 'danger' : (record.reasons.some(r => r.badgeClass === 'warning') ? 'warning' : 'info');

      let consolidatedSubtitle = '';
      if (record.reasons.length > 1) {
        // Build a concise, clean summary for multi-requirement cards
        const parts = [];
        const hasLate = record.reasons.some(r => r.type === 'late-checkout');
        const hasDept = record.reasons.some(r => r.type === 'departures-today');
        const hasUnpaid = record.reasons.some(r => r.type === 'unpaid-balance');
        const hasMonthly = record.reasons.some(r => r.type === 'monthly-due');

        const res = record.reservation;
        const fin = getResFin(res, currentBizDate);
        const checkOutDate = String(res.check_out_date || '').slice(0, 10);
        const expectedTime = App?.Helpers?.getExpectedCheckoutTime ? App.Helpers.getExpectedCheckoutTime(res) : '14:00';

        if (hasLate) {
          const formattedDate = formatPaletteArabicDate(checkOutDate);
          const formattedTime = expectedTime ? ` (${formatPalette12HourTime(expectedTime)})` : '';
          parts.push(`موعد المغادرة المحدد: ${formattedDate}${formattedTime}`);
        } else if (hasDept) {
          const formattedTime = expectedTime ? formatPalette12HourTime(expectedTime) : '02:00 م';
          parts.push(`موعد الإخلاء اليوم: الساعة ${formattedTime}`);
        } else if (hasMonthly) {
          parts.push(`تاريخ التجديد: ${formatPaletteArabicDate(checkOutDate)}`);
        }

        if (hasUnpaid && fin.remaining > 0.005) {
          parts.push(`مستحق سداد: ${fin.remaining.toLocaleString('en-US')} ر.س (المسدد: ${fin.paid.toLocaleString('en-US')} من إجمالي ${fin.effectiveTotal.toLocaleString('en-US')} ر.س)`);
        } else if (fin.remaining <= 0.005) {
          parts.push('الحساب: مسدد بالكامل ✓');
        }

        consolidatedSubtitle = parts.join(' • ');
      } else {
        consolidatedSubtitle = firstReason.subtitle;
      }

      deduplicatedAllItems.push({
        id: record.id,
        reservation: record.reservation,
        type: firstReason.type,
        title: record.reasons.length > 1
          ? `غرفة ${record.reservation.room_number || '-'} • ${record.reservation.guest_name || 'نزيل'} (${record.reasons.length} متطلبات)`
          : firstReason.title,
        subtitle: consolidatedSubtitle,
        badge: badges.join(' • '),
        badgeClass,
        primaryActionText: record.primaryActionText,
        action: record.primaryAction
      });
    });

    // Add dirty rooms
    dirtyRooms.forEach(item => {
      deduplicatedAllItems.push(item);
    });

    const totalCount = deduplicatedAllItems.length;

    return {
      lateCheckouts,
      departuresToday,
      completedDeparturesToday,
      unpaidBalances,
      dirtyRooms,
      monthlyDue,
      legacyDeposits,
      deduplicatedAllItems,
      totalCount
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. COMMAND REGISTRY & PARSER
  // ─────────────────────────────────────────────────────────────────────────────

  // Shared helper to build room actions across room-inquiry and prefix-room commands
  function buildRoomActions(ctx, roomNum, options = {}) {
    const room = ctx.rooms.find(r => String(r.room_number) === String(roomNum) || String(r.id) === String(roomNum));
    const activeRes = ctx.reservations.find(r =>
      ((room && r.room_id === room.id) || String(r.room_number) === String(roomNum)) &&
      r.status === 'مؤكد'
    ) || (room && room.active_reservations ? room.active_reservations[0] : null);

    const resById = options.checkReservationId ? ctx.reservations.find(r => String(r.id) === String(roomNum)) : null;

    if (room || activeRes) {
      const displayRoomNum = room ? room.room_number : (activeRes ? activeRes.room_number : roomNum);
      const statusText = room ? room.status : (activeRes ? 'مشغولة' : 'غير محددة');

      if (activeRes) {
        const fin = getResFin(activeRes, ctx.currentBizDate);
        const balance = fin.remaining;

        ctx.results.push({
          category: `🚪 تفاصيل الغرفة ${displayRoomNum}`,
          icon: '🔴',
          title: `غرفة ${displayRoomNum} (${statusText}) • النزيل: ${activeRes.guest_name || 'نزيل مقيم'}`,
          subtitle: `الجوال: ${activeRes.guest_phone || '-'} • المغادرة: ${activeRes.check_out_date || 'مفتوح'} • المتبقي: ${balance.toLocaleString('en-US')} ر.س ${balance > 0 ? '⚠️' : '✓'}`,
          badge: statusText,
          actionType: 'preview',
          actionPayload: { reservationId: activeRes.id, reservation: activeRes, roomNumber: activeRes.room_number },
          actionFn: () => {
            if (App?.Helpers?.openReservationPreview) {
              App.Helpers.openReservationPreview(activeRes.id);
            } else {
              showMissingHelperToast();
            }
          }
        });

        ctx.results.push({
          category: `⚡ إجراءات سريعة للغرفة ${displayRoomNum}`,
          icon: '🧾',
          title: `تسجيل مغادرة وتصفية الحساب • غرفة ${displayRoomNum}`,
          subtitle: `إنهاء إقامة النزيل (${activeRes.guest_name}) وتسليم الغرفة`,
          badge: 'مغادرة',
          actionType: 'checkout',
          actionPayload: { reservationId: activeRes.id, reservation: activeRes, roomNumber: activeRes.room_number },
          actionFn: () => {
            if (App?.Helpers?.openContractSettleModal) {
              App.Helpers.openContractSettleModal(activeRes);
            } else if (App?.Helpers?.openReservationPreview) {
              App.Helpers.openReservationPreview(activeRes.id);
            } else {
              showMissingHelperToast();
            }
          }
        });

        if (activeRes.guest_phone) {
          ctx.results.push({
            category: `⚡ إجراءات سريعة للغرفة ${displayRoomNum}`,
            icon: '💬',
            title: `مراسلة النزيل (${activeRes.guest_name}) عبر واتساب`,
            subtitle: `إرسال رسالة سريعة إلى ${activeRes.guest_phone}`,
            badge: 'WhatsApp',
            actionType: 'whatsapp',
            actionPayload: { reservationId: activeRes.id, reservation: activeRes, roomNumber: activeRes.room_number },
            actionFn: () => {
              if (window.sendReservationWhatsApp) window.sendReservationWhatsApp(activeRes.id);
              else showMissingHelperToast();
            }
          });
        }

        if (balance > 0) {
          ctx.results.push({
            category: `⚡ إجراءات سريعة للغرفة ${displayRoomNum}`,
            icon: '💳',
            title: `تسجيل دفعة سداد جديدة • متبقي ${balance.toLocaleString('en-US')} ر.س`,
            subtitle: `تحصيل مبلغ مالي للنزيل (${activeRes.guest_name})`,
            badge: 'سداد دفعة',
            actionType: 'payment',
            actionPayload: { reservationId: activeRes.id, reservation: activeRes, roomNumber: activeRes.room_number },
            actionFn: () => {
              if (window.openAddPaymentModal) {
                window.openAddPaymentModal(activeRes.id);
              } else if (App?.Helpers?.openReservationPreview) {
                App.Helpers.openReservationPreview(activeRes.id);
              } else {
                showMissingHelperToast();
              }
            }
          });
        }

        if (activeRes.booking_type !== 'استخدام يومي') {
          ctx.results.push({
            category: `⚡ إجراءات سريعة للغرفة ${displayRoomNum}`,
            icon: '🔄',
            title: `نقل النزيل إلى غرفة أخرى • غرفة ${displayRoomNum}`,
            subtitle: `نقل النزيل (${activeRes.guest_name || 'نزيل'}) إلى غرفة بديلة مع الاحتفاظ بالسعر`,
            badge: 'نقل الغرفة',
            actionType: 'transfer',
            actionPayload: { reservationId: activeRes.id, reservation: activeRes, roomNumber: activeRes.room_number },
            actionFn: () => {
              if (window.openTransferRoomModal) {
                window.openTransferRoomModal(activeRes.id);
              } else if (App?.Helpers?.openTransferRoomModal) {
                App.Helpers.openTransferRoomModal(activeRes.id);
              } else {
                showMissingHelperToast();
              }
            }
          });
        }
      } else if (room && room.status === 'متاحة') {
        ctx.results.push({
          category: `🚪 تفاصيل الغرفة ${displayRoomNum}`,
          icon: '🟢',
          title: `غرفة ${displayRoomNum} (متاحة للتشغيل)`,
          subtitle: `النوع: ${room.type || 'عادية'} • السعر: ${Number(room.price_per_night || 0).toLocaleString('en-US')} ر.س/ليلة • الطابق: ${room.floor || '1'}`,
          badge: 'متاحة ✓',
          actionType: 'booking',
          actionPayload: { roomId: room.id, roomNumber: room.room_number },
          actionFn: () => {
            if (App?.Helpers?.initiateRoomBooking) App.Helpers.initiateRoomBooking(room.id);
            else switchViewSection('rooms');
          }
        });

        ctx.results.push({
          category: `⚡ إجراءات سريعة للغرفة ${displayRoomNum}`,
          icon: '➕',
          title: `تسكين فوري للغرفة ${displayRoomNum}`,
          subtitle: 'فتح نموذج حجز جديد واختيار هذه الغرفة تلقائياً',
          badge: 'تسكين',
          actionType: 'booking',
          actionPayload: { roomId: room.id, roomNumber: room.room_number },
          actionFn: () => {
            if (App?.Helpers?.initiateRoomBooking) App.Helpers.initiateRoomBooking(room.id);
            else switchViewSection('rooms');
          }
        });
      } else if (room && room.status === 'تنظيف') {
        ctx.results.push({
          category: `🚪 تفاصيل الغرفة ${displayRoomNum}`,
          icon: '🧹',
          title: `غرفة ${displayRoomNum} (تحت التنظيف)`,
          subtitle: 'الغرفة بانتظار إشعار عمال النظافة قبل إتاحتها للحجز',
          badge: 'تنظيف',
          actionType: 'mark-clean',
          actionPayload: { roomId: room.id, roomNumber: room.room_number },
          actionFn: () => requestRoomCleaningCompletion(room)
        });
      } else if (room) {
        ctx.results.push({
          category: `🚪 تفاصيل الغرفة ${displayRoomNum}`,
          icon: '🛠️',
          title: `غرفة ${displayRoomNum} (حالة: ${room.status})`,
          subtitle: `النوع: ${room.type || 'عادية'} • الطابق: ${room.floor || '1'}`,
          badge: room.status,
          actionType: 'view-section',
          actionPayload: { section: 'rooms', roomNumber: room.room_number },
          actionFn: () => switchViewSection('rooms')
        });
      }
    }

    if (resById && (!activeRes || resById.id !== activeRes.id)) {
      ctx.results.push({
        category: '📋 نتيجة رقم الحجز',
        icon: '📋',
        title: `حجز رقم #${resById.id} • ${resById.guest_name || 'نزيل'} (غرفة ${resById.room_number || '-'})`,
        subtitle: `الحالة: ${resById.status} • الوصول: ${resById.check_in_date || '-'} • المغادرة: ${resById.check_out_date || '-'}`,
        badge: resById.status,
        actionType: 'preview',
        actionPayload: { reservationId: resById.id, reservation: resById, roomNumber: resById.room_number },
        actionFn: () => {
          if (App?.Helpers?.openReservationPreview) {
            App.Helpers.openReservationPreview(resById.id);
          } else {
            showMissingHelperToast();
          }
        }
      });
    }

    if (!room && !activeRes && !resById) {
      if (options.checkReservationId) {
        ctx.results.push({
          category: 'بحث الغرف والحجوزات',
          icon: '❓',
          title: `لم يتم العثور على غرفة أو حجز بالرقم "${roomNum}"`,
          subtitle: 'تأكد من الرقم المدخل أو استعرض قائمة الغرف والحجوزات',
          badge: 'غير موجود',
          actionFn: () => switchViewSection('rooms')
        });
      } else {
        ctx.results.push({
          category: '🚪 تفاصيل الغرفة',
          icon: '❓',
          title: `الغرفة غير موجودة بالرقم "${roomNum}"`,
          subtitle: 'تأكد من رقم الغرفة المدخل أو استعرض خريطة الغرف',
          badge: 'غير موجودة',
          actionFn: () => switchViewSection('rooms')
        });
      }
    }
  }

  // Prefix commands are placed at the very start of COMMAND_REGISTRY intentionally
  // to prioritize deterministic symbol shortcuts (#, @, !, r, ق) over natural language commands
  const COMMAND_REGISTRY = [
    {
      id: 'prefix-reservation',
      name: 'البحث السريع برقم الحجز',
      keywords: [],
      match: (norm) => {
        const m = norm.match(/^#\s*(.*)$/);
        if (m) {
          return { rawReservationQuery: (m[1] || '').trim() };
        }
        return null;
      },
      handle: (ctx, match) => {
        const raw = match?.rawReservationQuery;
        if (!raw) {
          ctx.results.push({
            category: '📋 البحث السريع برقم الحجز',
            icon: '📋',
            title: 'اكتب رقم الحجز بعد #',
            subtitle: 'مثال: #12 أو #105 لعرض ملف الحجز وفاتورته وسندات القبض والتمديد',
            badge: 'إرشاد'
          });
          return;
        }

        if (!/^\d+$/.test(raw)) {
          ctx.results.push({
            category: '📋 البحث السريع برقم الحجز',
            icon: '⚠️',
            title: 'رقم الحجز يجب أن يكون أرقاماً فقط',
            subtitle: 'أدخل رقم الحجز الصحيح (مثال: #12 أو #105)',
            badge: 'تنبيه'
          });
          return;
        }

        const resId = raw;
        const res = ctx.reservations.find(r => String(r.id) === resId);
        if (!res) {
          ctx.results.push({
            category: '📋 البحث السريع برقم الحجز',
            icon: '❓',
            title: `لا يوجد حجز برقم #${resId}`,
            subtitle: 'تأكد من رقم الحجز المدخل أو استعرض جدول الحجوزات',
            badge: 'غير موجود'
          });
          return;
        }

        const fin = getResFin(res, ctx.currentBizDate);

        // 1. Details item
        ctx.results.push({
          category: `📋 حجز #${res.id} • غرفة ${res.room_number || '-'}`,
          icon: '📋',
          title: `تفاصيل الحجز #${res.id} • ${res.guest_name || 'نزيل'} (غرفة ${res.room_number || '-'})`,
          subtitle: `الحالة: ${res.status} • الوصول: ${res.check_in_date || '-'} • المغادرة: ${res.check_out_date || '-'} • المتبقي: ${fin.remaining.toLocaleString('en-US')} ر.س`,
          badge: res.status,
          actionType: 'preview',
          actionPayload: { reservationId: res.id, reservation: res, roomNumber: res.room_number },
          actionFn: () => {
            if (App?.Helpers?.openReservationPreview) {
              App.Helpers.openReservationPreview(res.id);
            } else {
              showMissingHelperToast();
            }
          }
        });

        // 2. Invoice item
        ctx.results.push({
          category: `📋 حجز #${res.id} • غرفة ${res.room_number || '-'}`,
          icon: '🧾',
          title: `فاتورة الحجز #${res.id}`,
          subtitle: `استعراض الفاتورة الضريبية والبنود المحسوبة (الإجمالي: ${fin.effectiveTotal.toLocaleString('en-US')} ر.س)`,
          badge: 'فاتورة ضريبية',
          actionType: 'invoice',
          actionPayload: { reservationId: res.id, reservation: res, roomNumber: res.room_number },
          actionFn: () => {
            if (window.openInvoiceModal) {
              window.openInvoiceModal(res.id);
            } else if (App?.Helpers?.openReservationPreview) {
              App.Helpers.openReservationPreview(res.id);
            } else {
              showMissingHelperToast();
            }
          }
        });

        // 3. Payment collection item (if remaining > 0)
        if (fin.remaining > 0.005) {
          ctx.results.push({
            category: `📋 حجز #${res.id} • غرفة ${res.room_number || '-'}`,
            icon: '💳',
            title: `تحصيل دفعة مالية • متبقي ${fin.remaining.toLocaleString('en-US')} ر.س`,
            subtitle: `تسجيل سند قبض لحساب النزيل (${res.guest_name || 'نزيل'})`,
            badge: 'سند قبض 💳',
            actionType: 'payment',
            actionPayload: { reservationId: res.id, reservation: res, roomNumber: res.room_number },
            actionFn: () => {
              if (window.openAddPaymentModal) {
                window.openAddPaymentModal(res.id);
              } else if (App?.Helpers?.openReservationPreview) {
                App.Helpers.openReservationPreview(res.id);
              } else {
                showMissingHelperToast();
              }
            }
          });
        }

        // 4. Departure settlement (if confirmed)
        if (res.status === 'مؤكد') {
          ctx.results.push({
            category: `📋 حجز #${res.id} • غرفة ${res.room_number || '-'}`,
            icon: '🚪',
            title: `تسجيل مغادرة وتصفية الحساب • غرفة ${res.room_number || '-'}`,
            subtitle: `إنهاء إقامة النزيل وتسليم الغرفة`,
            badge: 'مغادرة',
            actionType: 'checkout',
            actionPayload: { reservationId: res.id, reservation: res, roomNumber: res.room_number },
            actionFn: () => {
              if (App?.Helpers?.openContractSettleModal) {
                App.Helpers.openContractSettleModal(res);
              } else if (App?.Helpers?.openReservationPreview) {
                App.Helpers.openReservationPreview(res.id);
              } else {
                showMissingHelperToast();
              }
            }
          });
        }

        // 5. Extend stay (if confirmed or monthly)
        if (res.status === 'مؤكد' || res.pricing_type === 'شهري') {
          ctx.results.push({
            category: `📋 حجز #${res.id} • غرفة ${res.room_number || '-'}`,
            icon: '📅',
            title: 'تمديد الإقامة وتحديث المغادرة',
            subtitle: `إضافة ليالٍ إضافية لحجز الغرفة ${res.room_number || '-'}`,
            badge: 'تمديد الإقامة',
            actionType: 'extend',
            actionPayload: { reservationId: res.id, reservation: res, roomNumber: res.room_number },
            actionFn: () => {
              if (window.openExtendStayModal) {
                window.openExtendStayModal(res.id);
              } else {
                showMissingHelperToast();
              }
            }
          });
        }

        // 6. Transfer room (if confirmed and not day-use)
        if (res.status === 'مؤكد' && res.booking_type !== 'استخدام يومي') {
          ctx.results.push({
            category: `📋 حجز #${res.id} • غرفة ${res.room_number || '-'}`,
            icon: '🔄',
            title: 'نقل النزيل إلى غرفة أخرى',
            subtitle: `نقل النزيل (${res.guest_name || 'نزيل'}) إلى غرفة بديلة مع الاحتفاظ بالسعر`,
            badge: 'نقل الغرفة',
            actionType: 'transfer',
            actionPayload: { reservationId: res.id, reservation: res, roomNumber: res.room_number },
            actionFn: () => {
              if (window.openTransferRoomModal) {
                window.openTransferRoomModal(res.id);
              } else if (App?.Helpers?.openTransferRoomModal) {
                App.Helpers.openTransferRoomModal(res.id);
              } else {
                showMissingHelperToast();
              }
            }
          });
        }
      }
    },
    {
      id: 'prefix-guest',
      name: 'البحث السريع عن النزلاء',
      keywords: [],
      match: (norm) => {
        const m = norm.match(/^@\s*(.*)$/);
        if (m) {
          return { rawGuestQuery: (m[1] || '').trim() };
        }
        return null;
      },
      handle: (ctx, match) => {
        const query = match?.rawGuestQuery;
        if (!query) {
          ctx.results.push({
            category: '👤 البحث السريع عن النزلاء',
            icon: '👤',
            title: 'اكتب اسم أو جوال أو هوية النزيل بعد @',
            subtitle: 'مثال: @محمد أو @0500 للبحث المباشر في سجل النزلاء وإنشاء حجز فوري',
            badge: 'إرشاد'
          });
          return;
        }

        function computeScore(normTarget) {
          if (!normTarget) return 0;
          if (normTarget === query) return 100;
          if (normTarget.startsWith(query)) return 80;
          if (normTarget.split(' ').some(w => w.startsWith(query))) return 60;
          if (normTarget.includes(query)) return 40;
          return 0;
        }

        const guestMatches = [];
        ctx.guests.forEach(g => {
          const nameScore = computeScore(getEntityNormalizedField(g, 'name'));
          const phoneScore = computeScore(getEntityNormalizedField(g, 'phone'));
          const idScore = Math.max(
            computeScore(getEntityNormalizedField(g, 'id_number')),
            computeScore(getEntityNormalizedField(g, 'national_id'))
          );
          const maxScore = Math.max(nameScore, phoneScore, idScore);
          if (maxScore > 0) {
            guestMatches.push({ guest: g, score: maxScore });
          }
        });

        if (!guestMatches.length) {
          ctx.results.push({
            category: '👤 البحث السريع عن النزلاء',
            icon: '❓',
            title: `لم يتم العثور على نزيل يطابق "${query}"`,
            subtitle: 'تأكد من الاسم أو رقم الجوال أو الهوية المدخلة',
            badge: 'غير موجود'
          });
          return;
        }

        guestMatches.sort((a, b) => b.score - a.score).slice(0, 5).forEach(({ guest: g }) => {
          const isBanned = Boolean(g.is_banned || g.banned === 1 || g.status === 'محظور');

          // Item 1: Open guest file
          ctx.results.push({
            category: `👤 النزيل: ${g.name}`,
            icon: '👤',
            title: `فتح سجل النزيل • ${g.name}`,
            subtitle: `الجوال: ${g.phone || '-'} • الهوية: ${g.id_number || g.national_id || '-'} ${isBanned ? '• (محظور ⛔)' : ''}`,
            badge: isBanned ? 'محظور ⛔' : 'سجل النزيل',
            actionFn: () => {
              switchViewSection('guests');
              const searchInput = document.getElementById('search-guests');
              if (searchInput) {
                searchInput.value = g.name;
                searchInput.dispatchEvent(new Event('input', { bubbles: true }));
              }
            }
          });

          // Item 2: Create new reservation for this guest
          ctx.results.push({
            category: `👤 النزيل: ${g.name}`,
            icon: isBanned ? '⛔' : '➕',
            title: `إنشاء حجز جديد للنزيل • ${g.name}`,
            subtitle: isBanned ? 'تنبيه: النزيل مدرج في القائمة السوداء (يتطلب تأكيداً)' : 'فتح نموذج الحجز المباشر وتعبئة بيانات النزيل تلقائياً',
            badge: isBanned ? 'محظور ⚠️' : 'حجز جديد',
            actionFn: async () => {
              if (isBanned) {
                const showConfirm = App?.Helpers?.showConfirmDialog || window.showConfirmDialog;
                if (typeof showConfirm === 'function') {
                  const confirmed = await showConfirm({
                    title: 'تنبيه: نزيل في قائمة الحظر ⛔',
                    message: `النزيل (${g.name}) مدرج في القائمة السوداء للمحظورين. هل تريد المتابعة وفتح نموذج الحجز له على أي حال؟`,
                    confirmText: 'متابعة الحجز',
                    cancelText: 'إلغاء',
                    isDanger: true
                  });
                  if (!confirmed) return;
                }
              }

              const btnOpen = document.getElementById('btn-open-new-reservation-modal');
              if (btnOpen) btnOpen.click();

              setTimeout(() => {
                const phoneInput = document.getElementById('guest-phone');
                const nameInput = document.getElementById('guest-name');
                const idInput = document.getElementById('guest-id-number');

                if (phoneInput && g.phone) {
                  phoneInput.value = g.phone;
                  phoneInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
                if (nameInput && g.name) {
                  nameInput.value = g.name;
                  nameInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
                if (idInput && (g.id_number || g.national_id)) {
                  idInput.value = g.id_number || g.national_id;
                  idInput.dispatchEvent(new Event('input', { bubbles: true }));
                }

                if (App?.Helpers?.showToast) {
                  App.Helpers.showToast(`تم فتح نموذج الحجز وتعبئة بيانات النزيل: ${g.name}`, 'info');
                }
              }, 50);
            }
          });
        });
      }
    },
    {
      id: 'prefix-room',
      name: 'البحث السريع برقم الغرفة',
      keywords: [],
      match: (norm) => {
        // Match ! followed by anything (allowing validation inside handle)
        const mExcl = norm.match(/^!\s*(.*)$/);
        if (mExcl) return { rawRoomQuery: (mExcl[1] || '').trim() };

        // Match r or ق followed by digits or empty (prevent matching receipt, etc.)
        const mRQ = norm.match(/^(?:r|ق)\s*(\d*)$/);
        if (mRQ) return { rawRoomQuery: (mRQ[1] || '').trim() };

        return null;
      },
      handle: (ctx, match) => {
        const raw = match?.rawRoomQuery;
        if (!raw) {
          ctx.results.push({
            category: '🚪 الاستعلام السريع عن الغرفة',
            icon: '🚪',
            title: 'اكتب رقم الغرفة بعد ! أو r أو ق',
            subtitle: 'مثال: !206 أو r206 أو ق206 للاستعلام المباشر عن حالة الغرفة والنزيل والتسكين',
            badge: 'إرشاد'
          });
          return;
        }

        if (!/^\d{1,5}$/.test(raw)) {
          ctx.results.push({
            category: '🚪 الاستعلام السريع عن الغرفة',
            icon: '⚠️',
            title: 'رقم الغرفة يجب أن يتكون من أرقام فقط',
            subtitle: 'أدخل رقم الغرفة المطلوب (مثال: !206 أو r206)',
            badge: 'تنبيه'
          });
          return;
        }

        buildRoomActions(ctx, raw, { checkReservationId: false });
      }
    },
    {
      id: 'unpaid',
      name: 'المستحقات والديون المعلقة',
      keywords: ['مستحق', 'ديون', 'مديونيه', 'مديون', 'باقي', 'unpaid', 'debts'],
      match: (norm) => {
        return /^(?:مستحق|المستحق|ديون|الديون|مديوني|المديوني|غير\s+مدفوع|غير\s+مسدد|unpaid|debts|balances|outstanding)/i.test(norm) ||
          norm.includes('عليه فلوس') || norm.includes('عليه مبالغ') || norm.includes('ما دفع') ||
          norm.includes('مستحق') || norm.includes('مبالغ معلقه') || norm.includes('مبالغ معلقة') || norm.includes('باقي فلوس') ||
          norm.includes('مديون') || norm.includes('ديون');
      },
      handle: (ctx) => {
        const reservations = ctx.reservations;
        const unpaidItems = reservations
          .filter(r => r.status === 'مؤكد')
          .map(r => {
            const fin = getResFin(r, ctx.currentBizDate);
            return { res: r, balance: fin.remaining, total: fin.effectiveTotal, paid: fin.paid };
          })
          .filter(item => item.balance > 0.005)
          .sort((a, b) => b.balance - a.balance);

        if (unpaidItems.length > 0) {
          const totalDebt = unpaidItems.reduce((acc, cur) => acc + cur.balance, 0);
          ctx.results.push({
            category: `💳 المستحقات والمديونيات المعلقة (${unpaidItems.length} نزلاء)`,
            icon: '📊',
            title: `إجمالي المستحقات غير المسددة: ${totalDebt.toLocaleString('en-US')} ر.س`,
            subtitle: `يوجد ${unpaidItems.length} حجز نشط بمبالغ معلقة بحاجة للتحصيل`,
            badge: `${totalDebt.toLocaleString('en-US')} ر.س`,
            actionFn: () => openAttentionInboxModal('unpaid-balance')
          });

          unpaidItems.forEach(({ res: r, balance, total, paid }) => {
            ctx.results.push({
              category: '💳 نزلاء عليهم مبالغ معلقة',
              icon: '⚠️',
              title: `غرفة ${r.room_number || '-'} • ${r.guest_name || 'نزيل'} (متبقي: ${balance.toLocaleString('en-US')} ر.س)`,
              subtitle: `الجوال: ${r.guest_phone || '-'} • المسدد: ${paid.toLocaleString('en-US')} من ${total.toLocaleString('en-US')} ر.س • المغادرة: ${r.check_out_date || '-'}`,
              badge: `${balance.toLocaleString('en-US')} ر.س ⚠️`,
              actionFn: () => {
                if (window.openAddPaymentModal) {
                  window.openAddPaymentModal(r.id);
                } else if (App?.Helpers?.openReservationPreview) {
                  App.Helpers.openReservationPreview(r.id);
                } else {
                  showMissingHelperToast();
                }
              }
            });
          });
        } else {
          ctx.results.push({
            category: '💳 المستحقات والمديونيات',
            icon: '✓',
            title: 'لا توجد أي مبالغ معلقة أو غير مسددة!',
            subtitle: 'جميع الحجوزات النشطة تم سداد قيمتها بالكامل',
            badge: 'مسدد بالكامل ✓',
            actionFn: () => switchViewSection('reservations')
          });
        }
      }
    },
    {
      id: 'departures',
      name: 'مغادرات اليوم',
      keywords: ['مغادر', 'مغادره', 'مغادرات', 'خروج', 'departure', 'departures', 'checkout'],
      match: (norm) => {
        return /^(?:مغادر|المغادر|خروج|الخروج|departures?|checkouts?)/i.test(norm) ||
          norm.includes('خارج اليوم') || norm.includes('بيخرج اليوم') || norm.includes('يخرج اليوم') ||
          norm.includes('مغادرات') || norm.includes('مغادره اليوم') || norm.includes('مغادرة اليوم') || norm.includes('خروج اليوم') ||
          norm.includes('leaving today');
      },
      handle: (ctx) => {
        const currentBizDate = ctx.currentBizDate;
        const departingStays = ctx.reservations.filter(r =>
          r.status === 'مؤكد' &&
          r.booking_type !== 'عقد مفتوح' &&
          String(r.check_out_date || '').slice(0, 10) === currentBizDate
        );
        const completedToday = ctx.attention.completedDeparturesToday || [];

        if (departingStays.length > 0 || completedToday.length > 0) {
          ctx.results.push({
            category: `🚪 مغادرات اليوم (${departingStays.length} بانتظار الإخلاء • ${completedToday.length} غادرت)`,
            icon: '🚪',
            title: `مغادرات تاريخ اليوم (${currentBizDate})`,
            subtitle: `متبقي ${departingStays.length} مغادرة مطلوبة • تم إنجاز ${completedToday.length} مغادرة بنجاح`,
            badge: `${departingStays.length} مطلوبة`,
            actionFn: () => openAttentionInboxModal('departures-today')
          });

          // Pending departures
          departingStays.forEach(r => {
            const fin = getResFin(r, currentBizDate);
            const balance = fin.remaining;
            const expectedTime = App?.Helpers?.getExpectedCheckoutTime ? App.Helpers.getExpectedCheckoutTime(r) : '14:00';
            ctx.results.push({
              category: '🚪 مغادرة مقررة اليوم (بانتظار الإخلاء)',
              icon: '🚪',
              title: `غرفة ${r.room_number || '-'} • النزيل: ${r.guest_name || 'نزيل'}`,
              subtitle: `موعد الإخلاء: ${expectedTime || '14:00'} • الجوال: ${r.guest_phone || '-'} • المتبقي: ${balance.toLocaleString('en-US')} ر.س ${balance > 0 ? '⚠️' : '✓'}`,
              badge: balance > 0 ? 'متبقي مالي' : 'جاهز للإخلاء',
              actionFn: () => {
                if (App?.Helpers?.openContractSettleModal) {
                  App.Helpers.openContractSettleModal(r);
                } else if (App?.Helpers?.openReservationPreview) {
                  App.Helpers.openReservationPreview(r.id);
                } else {
                  showMissingHelperToast();
                }
              }
            });
          });

          // Completed departures today
          completedToday.forEach(item => {
            const r = item.reservation;
            ctx.results.push({
              category: '🚪 تمت المغادرة اليوم بنجاح ✓',
              icon: '✓',
              title: `غرفة ${r.room_number || '-'} • النزيل: ${r.guest_name || 'نزيل'} (تمت المغادرة)`,
              subtitle: `تاريخ المغادرة: ${currentBizDate} • الحساب مصفى ومكتمل`,
              badge: 'مغادر ✓',
              actionFn: () => {
                if (App?.Helpers?.openReservationPreview) {
                  App.Helpers.openReservationPreview(r.id);
                } else if (window.openInvoiceModal) {
                  window.openInvoiceModal(r.id);
                } else {
                  showMissingHelperToast();
                }
              }
            });
          });
        } else {
          ctx.results.push({
            category: '🚪 مغادرات اليوم',
            icon: '✓',
            title: 'لا توجد مغادرات مقررة لليوم الحالي',
            subtitle: `تاريخ العمل الفندقي: ${currentBizDate}`,
            badge: 'لا توجد مغادرات',
            actionFn: () => switchViewSection('reservations')
          });
        }
      }
    },
    {
      id: 'late',
      name: 'النزلاء المتأخرون عن المغادرة',
      keywords: ['متاخر', 'متاخره', 'متاخرين', 'تاخير', 'overdue', 'late'],
      match: (norm) => {
        return /^(?:متاخر|المتاخر|متأخر|المتأخر|تاخير|التاخير|تأخير|التأخير|late|overdue)/i.test(norm) ||
          norm.includes('متاخر') || norm.includes('متأخر') || norm.includes('تاخير') || norm.includes('تأخير') || norm.includes('overdue');
      },
      handle: (ctx) => {
        const lateStays = ctx.reservations.filter(r =>
          r.status === 'مؤكد' &&
          r.booking_type !== 'عقد مفتوح' &&
          Boolean(App?.Helpers?.isLateCheckout && App.Helpers.isLateCheckout(r))
        );

        if (lateStays.length > 0) {
          ctx.results.push({
            category: `⚠️ النزلاء المتأخرون عن المغادرة (${lateStays.length})`,
            icon: '⚠️',
            title: `يوجد ${lateStays.length} نزيل تجاوزوا موعد الخروج المحدد`,
            subtitle: 'يجب التواصل معهم للتمديد أو تسليم الغرفة فوراً (فتح صندوق المهام)',
            badge: 'متأخرون ⚠️',
            actionType: 'attention-tab',
            actionPayload: { tab: 'late-checkout' },
            actionFn: () => openAttentionInboxModal('late-checkout')
          });

          lateStays.forEach(r => {
            const fin = getResFin(r, ctx.currentBizDate);
            const balance = fin.remaining;

            // 1. تسجيل مغادرة وتسوية
            ctx.results.push({
              category: `⚠️ متأخر عن المغادرة • غرفة ${r.room_number || '-'}`,
              icon: '🚪',
              title: `تسجيل مغادرة وتسوية • غرفة ${r.room_number || '-'} (${r.guest_name || 'نزيل'})`,
              subtitle: `تاريخ المغادرة السابق: ${r.check_out_date || '-'} • المتبقي: ${balance.toLocaleString('en-US')} ر.س`,
              badge: 'تسجيل خروج 🚪',
              actionType: 'checkout',
              actionPayload: { reservationId: r.id, reservation: r, roomNumber: r.room_number },
              actionFn: () => {
                if (App?.Helpers?.openContractSettleModal) {
                  App.Helpers.openContractSettleModal(r);
                } else if (App?.Helpers?.openReservationPreview) {
                  App.Helpers.openReservationPreview(r.id);
                } else {
                  showMissingHelperToast();
                }
              }
            });

            // 2. تمديد الحجز (إجراء سريع مطلوب)
            ctx.results.push({
              category: `⚠️ متأخر عن المغادرة • غرفة ${r.room_number || '-'}`,
              icon: '⏱️',
              title: `تمديد الحجز • غرفة ${r.room_number || '-'} (${r.guest_name || 'نزيل'})`,
              subtitle: `تمديد مدة الإقامة وتحديث تاريخ المغادرة للنزيل المتأخر`,
              badge: 'تمديد الحجز ⏱️',
              actionType: 'extend',
              actionPayload: { reservationId: r.id, reservation: r, roomNumber: r.room_number },
              actionFn: () => {
                if (window.openExtendStayModal) {
                  window.openExtendStayModal(r.id);
                } else if (App?.Helpers?.openReservationPreview) {
                  App.Helpers.openReservationPreview(r.id);
                } else {
                  showMissingHelperToast();
                }
              }
            });

            // 3. مراسلة واتساب
            if (r.guest_phone) {
              ctx.results.push({
                category: `⚠️ متأخر عن المغادرة • غرفة ${r.room_number || '-'}`,
                icon: '💬',
                title: `مراسلة واتساب • غرفة ${r.room_number || '-'} (${r.guest_name || 'نزيل'})`,
                subtitle: `إرسال رسالة تذكير أو متابعة للنزيل على رقم ${r.guest_phone}`,
                badge: 'واتساب 💬',
                actionType: 'whatsapp',
                actionPayload: { reservationId: r.id, roomNumber: r.room_number, phone: r.guest_phone },
                actionFn: () => {
                  if (window.sendReservationWhatsApp) {
                    window.sendReservationWhatsApp(r.id);
                  } else {
                    showMissingHelperToast();
                  }
                }
              });
            }
          });
        } else {
          ctx.results.push({
            category: '⚠️ النزلاء المتأخرون',
            icon: '✓',
            title: 'لا يوجد أي نزلاء متأخرين عن المغادرة حالياً',
            subtitle: 'جميع الإقامات منتظمة وفق جداول المغادرة',
            badge: 'منضبط ✓',
            actionType: 'view-section',
            actionPayload: { section: 'reservations' },
            actionFn: () => switchViewSection('reservations')
          });
        }
      }
    },
    {
      id: 'available',
      name: 'الغرف المتاحة',
      keywords: ['متاح', 'متاحه', 'شاغر', 'شاغره', 'فاضي', 'فاضيه', 'available', 'vacant'],
      match: (norm) => {
        const hasDigits = /\d+/.test(norm);
        return !hasDigits && (
          /^(?:فاضي|الفاضي|فاضيه|الفاضيه|فاضية|الفاضية|متاح|المتاح|متاحه|المتاحه|متاحة|المتاحة|شاغر|الشاغر|شاغره|الشاغره|شاغرة|الشاغرة|available|vacant)/i.test(norm) ||
          norm.includes('فاضي') || norm.includes('فاضيه') || norm.includes('فاضية') || norm.includes('متاح') || norm.includes('شاغر') || norm.includes('vacant')
        );
      },
      handle: (ctx) => {
        const availRooms = ctx.rooms.filter(r => r.status === 'متاحة');
        if (availRooms.length > 0) {
          ctx.results.push({
            category: `🟢 الغرف المتاحة للتشغيل (${availRooms.length} غرف)`,
            icon: '🟢',
            title: `عدد الغرف الشاغرة الجاهزة: ${availRooms.length} غرفة`,
            subtitle: 'انقر على أي غرفة لبدء تسكين فوري',
            badge: `${availRooms.length} شاغرة`,
            actionFn: () => switchViewSection('rooms')
          });

          availRooms.forEach(r => {
            ctx.results.push({
              category: '🟢 غرفة متاحة للتسكين',
              icon: '🟢',
              title: `غرفة ${r.room_number} (${r.type || 'عادية'}) • الطابق ${r.floor || '1'}`,
              subtitle: `السعر: ${Number(r.price_per_night || 0).toLocaleString('en-US')} ر.س/ليلة • جاهزة للتسكين الفوري`,
              badge: 'تسكين ➕',
              actionFn: () => {
                if (App?.Helpers?.initiateRoomBooking) {
                  App.Helpers.initiateRoomBooking(r.id);
                } else {
                  switchViewSection('rooms');
                }
              }
            });
          });
        } else {
          ctx.results.push({
            category: '🟢 الغرف المتاحة',
            icon: 'ℹ️',
            title: 'لا توجد غرف شاغرة متاحة حالياً!',
            subtitle: 'نسبة الإشغال 100% أو الغرف تحت التنظيف والصيانة',
            badge: 'ممتلئ',
            actionFn: () => switchViewSection('rooms')
          });
        }
      }
    },
    {
      id: 'occupied',
      name: 'الغرف المشغولة',
      keywords: ['مشغول', 'مشغوله', 'ساكن', 'ساكنين', 'occupied'],
      match: (norm) => {
        const hasDigits = /\d+/.test(norm);
        return !hasDigits && (
          /^(?:مشغول|المشغول|مشغوله|المشغوله|مشغولة|المشغولة|ساكن|الساكن|ساكنين|الساكنين|occupied|in-house)/i.test(norm) ||
          norm.includes('مشغول') || norm.includes('ساكنين') || (norm.includes('ساكن') && !norm.includes('تسكين')) || norm.includes('occupied')
        );
      },
      handle: (ctx) => {
        const occRooms = ctx.rooms.filter(r => r.status === 'مشغولة' || r.status === 'محجوزة');
        if (occRooms.length > 0) {
          ctx.results.push({
            category: `🔴 الغرف المشغولة والمحجوزة (${occRooms.length} غرف)`,
            icon: '🔴',
            title: `إجمالي الغرف المسكونة والمحجوزة: ${occRooms.length} غرفة`,
            subtitle: 'استعراض النزلاء المقيمين وتفاصيل الإقامة',
            badge: `${occRooms.length} مسكونة`,
            actionFn: () => switchViewSection('rooms')
          });

          occRooms.forEach(room => {
            const activeRes = ctx.reservations.find(r => (r.room_id === room.id || String(r.room_number) === String(room.room_number)) && r.status === 'مؤكد');
            ctx.results.push({
              category: '🔴 غرفة مشغولة',
              icon: '🔴',
              title: `غرفة ${room.room_number} • النزيل: ${activeRes ? activeRes.guest_name : 'نزيل مقيم'}`,
              subtitle: activeRes ? `الجوال: ${activeRes.guest_phone || '-'} • المغادرة: ${activeRes.check_out_date || 'مفتوح'}` : `حالة الغرفة: ${room.status}`,
              badge: room.status,
              actionType: activeRes ? 'preview' : 'view-section',
              actionPayload: activeRes ? { reservationId: activeRes.id, reservation: activeRes, roomNumber: room.room_number } : { section: 'rooms', roomNumber: room.room_number },
              actionFn: () => {
                if (activeRes && App?.Helpers?.openReservationPreview) {
                  App.Helpers.openReservationPreview(activeRes.id);
                } else {
                  switchViewSection('rooms');
                }
              }
            });
          });
        } else {
          ctx.results.push({
            category: '🔴 الغرف المشغولة',
            icon: 'ℹ️',
            title: 'لا توجد غرف مشغولة حالياً',
            subtitle: 'الفندق خالٍ من النزلاء حالياً',
            badge: 'فارغ',
            actionFn: () => switchViewSection('rooms')
          });
        }
      }
    },
    {
      id: 'cleaning',
      name: 'غرف النظافة',
      keywords: ['نظافه', 'تنظيف', 'وسخ', 'cleaning', 'dirty'],
      match: (norm) => {
        return /^(?:نظافه|النظافه|نظافة|النظافة|تنظيف|التنظيف|cleaning|dirty)(?:\s|$)/i.test(norm) ||
          norm.includes('نظافه') || norm.includes('نظافة') || norm.includes('تنظيف') || norm.includes('cleaning');
      },
      handle: (ctx) => {
        if (ctx.attention.dirtyRooms.length > 0) {
          ctx.attention.dirtyRooms.forEach(item => {
            ctx.results.push({
              category: '🧹 غرف بانتظار النظافة',
              icon: '🧹',
              title: `غرفة ${item.room.room_number} (${item.room.type || 'عادية'})`,
              subtitle: `الطابق: ${item.room.floor || '1'} • انقر لتأكيد انتهاء التنظيف واكتمال الجاهزية`,
              badge: 'تنظيف',
              actionFn: () => requestRoomCleaningCompletion(item.room)
            });
          });
        } else {
          ctx.results.push({
            category: '🧹 حالة النظافة',
            icon: '✓',
            title: 'جميع الغرف نظيفة ومتاحة!',
            subtitle: 'لا توجد أي غرف بحالة "تنظيف" حالياً',
            badge: 'ممتاز ✓',
            actionFn: () => switchViewSection('rooms')
          });
        }
      }
    },
    {
      id: 'booking',
      name: 'حجز وتسكين',
      keywords: ['تسكين', 'حجز', 'booking', 'checkin'],
      match: (norm) => {
        const m = norm.match(/^(?:تسكين|حجز|booking|checkin)\s*(?:(?:غرف[هة]|الغرف[هة])\s+)?(\d{1,5})?/i);
        if (m) {
          return { roomNumber: m[1] ? normalizeDigits(m[1]) : null };
        }
        return null;
      },
      handle: (ctx, match) => {
        const roomNum = match?.roomNumber;
        if (roomNum) {
          const room = ctx.rooms.find(r => String(r.room_number) === roomNum || String(r.id) === roomNum);
          const activeRes = ctx.reservations.find(r =>
            ((room && r.room_id === room.id) || String(r.room_number) === roomNum) &&
            r.status === 'مؤكد'
          );

          if (!room && !activeRes) {
            ctx.results.push({
              category: '🎯 إجراء تسكين وحجز',
              icon: '❓',
              title: `الغرفة رقم ${roomNum} غير موجودة في النظام`,
              subtitle: 'لا يمكن تسكين غرفة غير معرفة. يرجى التأكد من رقم الغرفة أو مراجعة قائمة الغرف.',
              badge: 'غير موجودة',
              actionFn: () => switchViewSection('rooms')
            });
            return;
          }

          if (activeRes || (room && (room.status === 'مشغولة' || room.status === 'محجوزة'))) {
            const guestName = activeRes ? activeRes.guest_name : 'نزيل مقيم';
            ctx.results.push({
              category: '🎯 حالة الغرفة وتسكينها',
              icon: '🔴',
              title: `الغرفة ${roomNum} مشغولة حالياً بالنزيل (${guestName})`,
              subtitle: 'لا يمكن إنشاء تسكين جديد على غرفة مشغولة. انقر لاستعراض تفاصيل الإقامة والحساب.',
              badge: 'مشغولة',
              actionFn: () => {
                if (activeRes && App?.Helpers?.openReservationPreview) {
                  App.Helpers.openReservationPreview(activeRes.id);
                } else {
                  switchViewSection('rooms');
                }
              }
            });
            return;
          }

          if (room && room.status === 'تنظيف') {
            ctx.results.push({
              category: '🎯 حالة الغرفة وتسكينها',
              icon: '🧹',
              title: `الغرفة ${roomNum} تحت التنظيف حالياً`,
              subtitle: 'الغرفة بانتظار إشعار عمال النظافة. انقر لتأكيد الجاهزية أو الانتقال لخريطة الغرف.',
              badge: 'تنظيف',
              actionFn: () => requestRoomCleaningCompletion(room)
            });
            return;
          }

          if (room && room.status === 'صيانة') {
            ctx.results.push({
              category: '🎯 حالة الغرفة وتسكينها',
              icon: '🛠️',
              title: `الغرفة ${roomNum} خارج الخدمة (تحت الصيانة)`,
              subtitle: 'لا يمكن تسكين الغرفة حتى انتهاء أعمال الصيانة.',
              badge: 'صيانة',
              actionFn: () => switchViewSection('rooms')
            });
            return;
          }

          // Vacant room -> immediate booking
          ctx.results.push({
            category: '🎯 إجراء تسكين وحجز',
            icon: '➕',
            title: `تسكين غرفة ${roomNum} مباشرة`,
            subtitle: `الغرفة متاحة للتشغيل (${room?.type || 'عادية'} • السعر: ${Number(room?.price_per_night || 0).toLocaleString('en-US')} ر.س)`,
            badge: 'تسكين فوري',
            actionFn: () => {
              if (room && App?.Helpers?.initiateRoomBooking) {
                App.Helpers.initiateRoomBooking(room.id);
              } else {
                const btn = document.getElementById('btn-open-new-reservation-modal');
                if (btn) btn.click();
              }
            }
          });
        } else {
          ctx.results.push({
            category: '🎯 إجراء تسكين وحجز',
            icon: '➕',
            title: 'تسجيل حجز أو تسكين جديد',
            subtitle: 'فتح نموذج التسكين واختيار الغرفة والنزيل (F2)',
            badge: 'حجز جديد',
            actionFn: () => {
              const btn = document.getElementById('btn-open-new-reservation-modal');
              if (btn) btn.click();
            }
          });
        }
      }
    },
    {
      id: 'shift',
      name: 'تقرير الوردية والخزينة',
      keywords: ['ورديه', 'شفت', 'صندوق', 'درج', 'كاش', 'خزينه', 'فلوس', 'shift', 'audit'],
      match: (norm) => {
        return /^(?:فلوس|كاش|نقديه|نقدية|درج|الدرج|ورديه|وردية|الورديه|الوردية|خزينه|خزينة|الخزينه|الخزينة|audit|shift|cash|drawer)(?:\s|$)/i.test(norm) ||
          norm.includes('درج') || norm.includes('ورديه') || norm.includes('وردية') || norm.includes('خزينه') || norm.includes('خزينة') || norm.includes('كاش');
      },
      handle: (ctx) => {
        const currentUserRole = App?.State?.currentUser?.role || (typeof localStorage !== 'undefined' ? localStorage.getItem('currentUserRole') : null);
        const isAdmin = currentUserRole === 'Admin';

        ctx.results.push({
          category: '💵 الخزينة والسيولة',
          icon: '💵',
          title: 'عرض تقرير إقفال الوردية والموازنة المالية (Shift Audit)',
          subtitle: isAdmin
            ? 'حساب النقدية المقبوضة، الشبكة، رصيد الدرج، والمصروفات'
            : 'يتطلب صلاحية مدير النظام (Admin) للاطلاع على التقرير التفصيلي',
          badge: isAdmin ? 'تقرير الوردية' : 'مدير النظام فقط 🔒',
          actionFn: () => {
            if (!isAdmin) {
              if (App?.Helpers?.showToast) {
                App.Helpers.showToast('تقرير الوردية التفصيلي متاح لمدير النظام فقط (Admin).', 'warning');
              }
              return;
            }
            if (typeof window.openShiftAuditModal === 'function') {
              window.openShiftAuditModal();
            } else {
              showMissingHelperToast();
            }
          }
        });

        ctx.results.push({
          category: '💵 الخزينة والسيولة',
          icon: '📊',
          title: 'لوحة التحكم والتحليلات المالية',
          subtitle: 'إجمالي إيرادات الشهر والوردية الحالية',
          badge: 'المؤشرات',
          actionFn: () => switchViewSection('overview')
        });
      }
    },
    {
      id: 'whatsapp',
      name: 'مراسلة واتساب',
      keywords: ['واتساب', 'واتس', 'whatsapp', 'رساله'],
      match: (norm) => {
        const m = norm.match(/^(?:واتساب|واتس|whatsapp|رسال[هة])\s*(?:(?:غرف[هة]|الغرف[هة])\s+)?(.+)?/i);
        if (m) {
          const target = m[1]?.trim() ? normalizeDigits(m[1].trim()) : null;
          return { target };
        }
        return null;
      },
      handle: (ctx, match) => {
        const target = match?.target;
        let matchedReservations = [];

        if (target) {
          matchedReservations = ctx.reservations.filter(r =>
            r.status === 'مؤكد' && (
              String(r.room_number) === target ||
              normalize(r.guest_name || '').includes(normalize(target))
            )
          );
        } else {
          matchedReservations = ctx.reservations.filter(r => r.status === 'مؤكد' && r.guest_phone).slice(0, 5);
        }

        if (matchedReservations.length > 0) {
          const isWelcome = ctx.rawQuery && /ترحيب|welcome/i.test(ctx.rawQuery);
          const isInvoice = ctx.rawQuery && /فاتور|invoice/i.test(ctx.rawQuery);
          const templateName = isWelcome ? 'رسالة ترحيبية' : (isInvoice ? 'بيانات الفاتورة' : 'محادثة سريعة');

          matchedReservations.forEach(r => {
            ctx.results.push({
              category: '💬 مراسلة واتساب فورية',
              icon: '💬',
              title: `واتساب (${templateName}) • ${r.guest_name || 'نزيل'} (غرفة ${r.room_number || '-'})`,
              subtitle: `رقم الجوال: ${r.guest_phone || 'غير مسجل'} • تاريخ المغادرة: ${r.check_out_date || '-'}`,
              badge: isWelcome ? 'ترحيب 👋' : (isInvoice ? 'فاتورة 🧾' : 'WhatsApp'),
              actionFn: () => {
                if (window.sendReservationWhatsApp) {
                  window.sendReservationWhatsApp(r.id);
                } else {
                  showMissingHelperToast();
                }
              }
            });
          });
        } else {
          ctx.results.push({
            category: '💬 مراسلة واتساب',
            icon: '❓',
            title: `لا يوجد نزيل مطابق للبحث "${target || ''}" مع رقم جوال نشط`,
            subtitle: 'تأكد من رقم الغرفة أو اسم النزيل المدخل',
            badge: 'غير متوفر'
          });
        }
      }
    },
    {
      id: 'extend',
      name: 'تمديد إقامة النزيل',
      keywords: ['تمديد', 'مدد', 'extend'],
      match: (norm) => {
        const m = norm.match(/^(?:تمديد|extend)(?:\s+(?:حجز|اقام[هة]))?\s*(?:(?:غرف[هة]|الغرف[هة]|حجز)\s+)*(\d{1,5})?/i);
        if (m) {
          return { roomNumber: m[1] ? normalizeDigits(m[1]) : null };
        }
        return null;
      },
      handle: (ctx, match) => {
        const roomNum = match?.roomNumber;
        if (roomNum) {
          const activeRes = ctx.reservations.find(r =>
            (String(r.room_number) === roomNum || String(r.id) === roomNum) &&
            r.status === 'مؤكد'
          );
          if (activeRes) {
            ctx.results.push({
              category: '📅 تمديد الإقامة',
              icon: '📅',
              title: `تمديد إقامة النزيل: ${activeRes.guest_name || 'نزيل'} • غرفة ${activeRes.room_number || '-'}`,
              subtitle: `المغادرة المقررة: ${activeRes.check_out_date || '-'} • فتح نافذة التمديد واحتساب الليالي`,
              badge: 'تمديد فوري 📅',
              actionFn: () => {
                if (window.openExtendStayModal) {
                  window.openExtendStayModal(activeRes.id);
                } else if (App?.Helpers?.openReservationPreview) {
                  App.Helpers.openReservationPreview(activeRes.id);
                } else {
                  showMissingHelperToast();
                }
              }
            });
          } else {
            ctx.results.push({
              category: '📅 تمديد الإقامة',
              icon: '❓',
              title: `لا يوجد حجز مؤكد للغرفة ${roomNum} لتمديد إقامته`,
              subtitle: 'تأكد من رقم الغرفة أو وجود حجز نشط في النظام',
              badge: 'غير متاح',
              actionFn: () => switchViewSection('reservations')
            });
          }
        } else {
          ctx.results.push({
            category: '📅 تمديد الإقامة',
            icon: '📅',
            title: 'تمديد إقامة حجز نشط',
            subtitle: 'حدد رقم الغرفة لتمديد الحجز فوراً (مثال: "تمديد 104")',
            badge: 'تمديد',
            actionFn: () => switchViewSection('reservations')
          });
        }
      }
    },
    {
      id: 'transfer',
      name: 'نقل الغرفة للنزيل',
      keywords: ['نقل', 'تحويل', 'transfer', 'move'],
      match: (norm) => {
        const mPrefix = norm.match(/^(?:نقل|تحويل|transfer|move)(?:\s+(?:نزيل|حجز|غرف[هة]|الغرف[هة]))?\s*(?:(?:غرف[هة]|الغرف[هة]|حجز)\s+)*(\d{1,5})?/i);
        if (mPrefix) {
          return { roomNumber: mPrefix[1] ? normalizeDigits(mPrefix[1]) : null };
        }
        const mSuffix = norm.match(/^(\d{1,5})\s+(?:نقل|تحويل|transfer|move)(?:\s+(?:غرف[هة]|الغرف[هة]))?$/i);
        if (mSuffix) {
          return { roomNumber: normalizeDigits(mSuffix[1]) };
        }
        return null;
      },
      handle: (ctx, match) => {
        const roomNum = match?.roomNumber;
        if (roomNum) {
          const activeRes = ctx.reservations.find(r =>
            (String(r.room_number) === roomNum || String(r.id) === roomNum) &&
            r.status === 'مؤكد'
          );
          if (activeRes) {
            ctx.results.push({
              category: '🔄 نقل الغرفة',
              icon: '🔄',
              title: `نقل نزيل الغرفة ${activeRes.room_number || roomNum}: ${activeRes.guest_name || 'نزيل'}`,
              subtitle: `المغادرة المقررة: ${activeRes.check_out_date || 'مفتوح'} • فتح نافذة نقل الغرفة`,
              badge: 'نقل فوري 🔄',
              actionType: 'transfer',
              actionPayload: { reservationId: activeRes.id, reservation: activeRes, roomNumber: activeRes.room_number },
              actionFn: () => {
                if (window.openTransferRoomModal) {
                  window.openTransferRoomModal(activeRes.id);
                } else if (App?.Helpers?.openTransferRoomModal) {
                  App.Helpers.openTransferRoomModal(activeRes.id);
                } else {
                  showMissingHelperToast();
                }
              }
            });
          } else {
            ctx.results.push({
              category: '🔄 نقل الغرفة',
              icon: '❓',
              title: `لا يوجد حجز مؤكد للغرفة ${roomNum} لنقله`,
              subtitle: 'تأكد من رقم الغرفة أو وجود حجز نشط في النظام',
              badge: 'غير متاح',
              actionFn: () => switchViewSection('reservations')
            });
          }
        } else {
          ctx.results.push({
            category: '🔄 نقل الغرفة',
            icon: '🔄',
            title: 'نقل نزيل إلى غرفة بديلة',
            subtitle: 'حدد رقم الغرفة لنقل النزيل فوراً (مثال: "نقل 204" أو "204 نقل")',
            badge: 'نقل',
            actionFn: () => switchViewSection('reservations')
          });
        }
      }
    },
    {
      id: 'invoice',
      name: 'معاينة وطباعة الفاتورة',
      keywords: ['فاتوره', 'حساب', 'طباعه', 'invoice'],
      match: (norm) => {
        const m = norm.match(/^(?:فاتور[هة]|الفاتور[هة]|طباع[هة]\s+فاتور[هة]|invoice)\s*(?:(?:غرف[هة]|الغرف[هة]|حجز)\s+)*(\d{1,5})?/i);
        if (m) {
          return { targetNumber: m[1] ? normalizeDigits(m[1]) : null };
        }
        return null;
      },
      handle: (ctx, match) => {
        const target = match?.targetNumber;
        if (target) {
          const res = ctx.reservations.find(r =>
            String(r.id) === target || String(r.room_number) === target
          );
          if (res) {
            ctx.results.push({
              category: '🧾 الفواتير والمستندات',
              icon: '🧾',
              title: `معاينة الفاتورة الضريبية • غرفة ${res.room_number || '-'}`,
              subtitle: `النزيل: ${res.guest_name || 'نزيل'} • حجز #${res.id} • الإجمالي: ${Number(res.total_price || 0).toLocaleString('en-US')} ر.س`,
              badge: 'فاتورة ضريبية 🧾',
              actionFn: () => {
                if (window.openInvoiceModal) {
                  window.openInvoiceModal(res.id);
                } else if (App?.Helpers?.openReservationPreview) {
                  App.Helpers.openReservationPreview(res.id);
                } else {
                  showMissingHelperToast();
                }
              }
            });
          } else {
            ctx.results.push({
              category: '🧾 الفواتير والمستندات',
              icon: '❓',
              title: `لم يتم العثور على حجز أو غرفة بالرقم "${target}" لإصدار الفاتورة`,
              subtitle: 'تأكد من رقم الحجز أو رقم الغرفة المدخل',
              badge: 'غير موجود'
            });
          }
        } else {
          ctx.results.push({
            category: '🧾 الفواتير والمستندات',
            icon: '🧾',
            title: 'إصدار ومعاينة الفاتورة الضريبية',
            subtitle: 'حدد رقم الغرفة أو الحجز (مثال: "فاتورة 202" أو "فاتورة 58")',
            badge: 'الفواتير',
            actionFn: () => switchViewSection('reservations')
          });
        }
      }
    },
    {
      id: 'voucher',
      name: 'سند قبض وتحصيل دفعة',
      keywords: ['سند', 'قبض', 'تحصيل', 'دفعه', 'دفع', 'سداد', 'ايصال', 'receipt', 'payment', 'pay', 'voucher'],
      match: (norm) => {
        const m = norm.match(/^(?:سند(?:\s+قبض)?|قبض|تحصيل|دفع[هة]?|سداد|receipt|payment|pay)(?=\s|\d|$)\s*(?:(?:غرف[هة]|الغرف[هة]|حجز)\s*)*(\d{1,5})?$/i);
        if (m) {
          return { targetNumber: m[1] ? normalizeDigits(m[1]) : null };
        }
        return null;
      },
      handle: (ctx, match) => {
        const target = match?.targetNumber;
        if (target) {
          const res = ctx.reservations.find(r =>
            (String(r.id) === target || String(r.room_number) === target) && r.status === 'مؤكد'
          );
          if (res) {
            const fin = getResFin(res, ctx.currentBizDate);
            ctx.results.push({
              category: '💳 سندات القبض والتحصيل',
              icon: '💳',
              title: `تحصيل دفعة وتسجيل سند قبض • غرفة ${res.room_number || '-'}`,
              subtitle: `النزيل: ${res.guest_name || 'نزيل'} • المتبقي: ${fin.remaining.toLocaleString('en-US')} ر.س من ${fin.effectiveTotal.toLocaleString('en-US')} ر.س`,
              badge: 'سند قبض 💳',
              actionFn: () => {
                if (window.openAddPaymentModal) {
                  window.openAddPaymentModal(res.id);
                } else if (App?.Helpers?.openReservationPreview) {
                  App.Helpers.openReservationPreview(res.id);
                } else {
                  showMissingHelperToast();
                }
              }
            });
          } else {
            ctx.results.push({
              category: '💳 سندات القبض والتحصيل',
              icon: '❓',
              title: `لا يوجد حجز مؤكد للغرفة أو الرقم "${target}" لتسجيل سند قبض`,
              subtitle: 'تأكد من رقم الغرفة أو حالة الحجز',
              badge: 'غير متاح'
            });
          }
        } else {
          // Identify late checkouts using ctx.attention.lateCheckouts without recalculating
          const lateCheckoutIds = new Set(
            (ctx.attention?.lateCheckouts || []).map(item => String(item.id || item.reservation?.id))
          );

          // Find active confirmed reservations with outstanding balances
          const unpaidList = ctx.reservations
            .filter(r => r.status === 'مؤكد')
            .map(r => {
              const fin = getResFin(r, ctx.currentBizDate);
              const isOverdue = lateCheckoutIds.has(String(r.id));
              return { res: r, fin, isOverdue };
            })
            .filter(item => item.fin.remaining > 0.005);

          if (unpaidList.length === 0) {
            ctx.results.push({
              category: '💳 سندات القبض والتحصيل المباشر',
              icon: '✓',
              title: 'لا توجد مبالغ معلقة ✓',
              subtitle: 'جميع الحجوزات المؤكدة مسددة بالكامل ولا توجد ديون حالية',
              badge: 'مسدد بالكامل'
            });
            return;
          }

          // Sort: late checkouts first, then descending by remaining amount
          unpaidList.sort((a, b) => {
            if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
            return b.fin.remaining - a.fin.remaining;
          });

          const topUnpaid = unpaidList.slice(0, 8);

          topUnpaid.forEach(({ res, fin, isOverdue }) => {
            const displayRoom = res.room_number || '-';
            const guestName = res.guest_name || 'نزيل';
            const remainingFormatted = fin.remaining.toLocaleString('en-US');
            const paidFormatted = fin.paid.toLocaleString('en-US');
            const totalFormatted = fin.effectiveTotal.toLocaleString('en-US');

            ctx.results.push({
              category: '💳 سندات القبض والتحصيل المباشر',
              icon: isOverdue ? '⚠️' : '💳',
              title: `تحصيل دفعة • غرفة ${displayRoom} • ${guestName}`,
              subtitle: `${isOverdue ? '⚠️ متأخر عن المغادرة • ' : ''}المدفوع: ${paidFormatted} ر.س • المتبقي: ${remainingFormatted} ر.س • الإجمالي: ${totalFormatted} ر.س`,
              badge: `${remainingFormatted} ر.س`,
              isUrgent: isOverdue,
              actionFn: () => {
                if (window.openAddPaymentModal) {
                  window.openAddPaymentModal(res.id);
                } else if (App?.Helpers?.openReservationPreview) {
                  App.Helpers.openReservationPreview(res.id);
                } else {
                  showMissingHelperToast();
                }
              }
            });
          });

          // Last item: open attention inbox for all unpaid balances
          ctx.results.push({
            category: '💳 سندات القبض والتحصيل المباشر',
            icon: '📋',
            title: 'عرض كل المستحقات',
            subtitle: `فتح صندوق المهام لاستعراض كافة الحجوزات المطلوبة (${unpaidList.length} حجز)`,
            badge: `${unpaidList.length} حجز`,
            actionFn: () => openAttentionInboxModal('unpaid-balance')
          });
        }
      }
    },
    {
      id: 'floor',
      name: 'تصفية الغرف حسب الطابق',
      keywords: ['دور', 'طابق', 'floor'],
      match: (norm) => {
        const m = norm.match(/^(?:الدور|طابق|الطابق|floor)\s*(\d{1,2}|الاول|الأول|الثاني|الثالث|الرابع|الخامس)?/i);
        if (m) {
          let fl = m[1];
          if (fl === 'الاول' || fl === 'الأول') fl = '1';
          else if (fl === 'الثاني') fl = '2';
          else if (fl === 'الثالث') fl = '3';
          else if (fl === 'الرابع') fl = '4';
          else if (fl === 'الخامس') fl = '5';
          return { floor: fl ? normalizeDigits(fl) : null };
        }
        return null;
      },
      handle: (ctx, match) => {
        const floor = match?.floor;
        if (floor) {
          const floorRooms = ctx.rooms.filter(r => String(r.floor) === String(floor));
          const availableCount = floorRooms.filter(r => r.status === 'متاحة').length;
          const occupiedCount = floorRooms.filter(r => r.status === 'مشغولة' || r.status === 'محجوزة').length;

          ctx.results.push({
            category: '🏢 تصفية الغرف بالطابق',
            icon: '🏢',
            title: `استعراض غرف الطابق ${floor} (${floorRooms.length} غرف)`,
            subtitle: `${availableCount} غرف متاحة • ${occupiedCount} غرف مسكونة ومحجوزة`,
            badge: `الطابق ${floor}`,
            actionFn: () => {
              switchViewSection('rooms');
              const filterSelect = document.getElementById('filter-floor') || document.getElementById('search-rooms');
              if (filterSelect) {
                if (filterSelect.tagName === 'SELECT') {
                  filterSelect.value = floor;
                  filterSelect.dispatchEvent(new Event('change'));
                } else {
                  filterSelect.value = `طابق ${floor}`;
                  filterSelect.dispatchEvent(new Event('input'));
                }
              }
            }
          });
        } else {
          ctx.results.push({
            category: '🏢 تصفية الغرف بالطابق',
            icon: '🏢',
            title: 'استعراض خريطة الغرف حسب الطوابق',
            subtitle: 'اكتب "طابق 1" أو "الدور الثاني" لفرز الغرف فوراً',
            badge: 'خريطة الأدوار',
            actionFn: () => switchViewSection('rooms')
          });
        }
      }
    },
    {
      id: 'blacklist',
      name: 'قائمة النزلاء المحظورين',
      keywords: ['حظر', 'محظور', 'بلاك', 'سوداء', 'blacklist'],
      match: (norm) => {
        return /^(?:محظور|المحظور|المحظورين|بلاك\s*ليست|قا[يئ]م[هة]\s+الحظر|blacklist|banned)/i.test(norm) ||
          norm.includes('محظور') || norm.includes('بلاك ليست') || norm.includes('الحظر') || norm.includes('حظر');
      },
      handle: (ctx) => {
        const bannedGuests = ctx.guests.filter(g => g.is_banned);
        ctx.results.push({
          category: '⛔ النزلاء المحظورون أمنياً',
          icon: '⛔',
          title: `قائمة النزلاء المحظورين (${bannedGuests.length} مسجلين)`,
          subtitle: `استعراض ملفات وأرقام هويات النزلاء الممنوعين من التسكين`,
          badge: `${bannedGuests.length} محظور ⛔`,
          actionFn: () => {
            switchViewSection('guests');
            const searchInput = document.getElementById('search-guests');
            if (searchInput) {
              searchInput.value = 'محظور';
              searchInput.dispatchEvent(new Event('input'));
            }
          }
        });
      }
    },
    {
      id: 'backup',
      name: 'النسخ الاحتياطي الفوري',
      keywords: ['نسخه', 'احتياطيه', 'باك', 'backup'],
      match: (norm) => {
        return /^(?:نسخ[هة]\s+احتياطي[هة]|النسخ[هة]\s+الاحتياطي[هة]|باك\s*اب|باكاب|backup)/i.test(norm) ||
          norm.includes('احتياطيه') || norm.includes('احتياطية') || norm.includes('باك اب');
      },
      handle: (ctx) => {
        ctx.results.push({
          category: '💾 النسخ الاحتياطي والأمان',
          icon: '💾',
          title: 'إنشاء وحفظ نسخة احتياطية فورية (Daily Backup)',
          subtitle: 'تصدير نسخة كاملة لقاعدة بيانات الفندق وحفظها بأمان',
          badge: 'نسخ احتياطي 💾',
          actionFn: () => {
            if (typeof window.openDailyBackupModal === 'function') {
              window.openDailyBackupModal();
            } else {
              showMissingHelperToast();
            }
          }
        });
      }
    },
    {
      id: 'room-inquiry',
      name: 'استعلام الغرفة',
      keywords: ['غرفه', 'مين', 'ساكن'],
      match: (norm) => {
        const m = norm.match(/^(?:(?:مين\s+(?:في\s+|ساكن\s+(?:في\s+)?)?|من\s+في\s+)?(?:غرف[هة]\s*|الغرف[هة]\s*|رقم\s*)?|رقم\s*)?(\d{1,5})(?:\s*؟|\s*\?|\s*$)/i);
        if (m && m[1]) {
          return { roomNumber: normalizeDigits(m[1]) };
        }
        return null;
      },
      handle: (ctx, match) => {
        const roomNum = match?.roomNumber;
        buildRoomActions(ctx, roomNum, { checkReservationId: true });
      }
    }
  ];

  function matchIntentFromNormalizedText(norm, rawQuery) {
    if (!norm) return { type: 'empty' };

    for (const cmd of COMMAND_REGISTRY) {
      const matchResult = cmd.match(norm);
      if (matchResult) {
        const intentType = cmd.id === 'room-inquiry' ? 'room-inquiry' : `${cmd.id}-intent`;
        return {
          type: intentType,
          commandId: cmd.id,
          matchResult: typeof matchResult === 'object' ? matchResult : {},
          originalQuery: rawQuery,
          ...(typeof matchResult === 'object' ? matchResult : {})
        };
      }
    }

    return {
      type: 'search',
      query: norm,
      originalQuery: rawQuery
    };
  }

  function parseCommandIntent(rawQuery, options = {}) {
    const query = String(rawQuery || '').trim();
    if (!query) {
      return { type: 'empty' };
    }

    const skipCorrection = Boolean(options && options.skipCorrection);

    // Step 1: Direct normalized match
    const norm = normalize(query);
    const parsed = matchIntentFromNormalizedText(norm, query);
    if (parsed.type !== 'search') {
      return parsed;
    }

    // Step 2: Keyboard transliteration (English -> Arabic)
    let transliteratedNorm = '';
    if (/[a-zA-Z]/.test(query)) {
      const transliterated = transliterateEnToAr(query);
      transliteratedNorm = normalize(transliterated);
      const transliteratedParsed = matchIntentFromNormalizedText(transliteratedNorm, query);
      if (transliteratedParsed.type !== 'search') {
        return transliteratedParsed;
      }
    }

    // Step 3: Reorder standalone 1-5 digit number to the end of the query (reorderNumberLast)
    // Accept only if it produces a recognized command (type !== 'search'); otherwise keep original query
    const reordered = reorderNumberLast(norm);
    if (reordered) {
      const reorderedNorm = normalize(reordered);
      const reorderedParsed = matchIntentFromNormalizedText(reorderedNorm, query);
      if (reorderedParsed.type !== 'search') {
        return {
          ...reorderedParsed,
          reorderedFrom: norm,
          originalQuery: query
        };
      }
    }

    // Step 4: Typo resilience (correct first token only)
    if (!skipCorrection) {
      const tokens = norm.split(' ').filter(Boolean);
      if (tokens.length > 0) {
        const firstToken = tokens[0];
        const entityWordSet = getEntityWordSet();
        const correctedToken = correctToken(firstToken, entityWordSet);
        if (correctedToken && correctedToken !== firstToken) {
          const candidateQuery = [correctedToken, ...tokens.slice(1)].join(' ');
          const candidateNorm = normalize(candidateQuery);
          const candidateParsed = matchIntentFromNormalizedText(candidateNorm, query);
          if (candidateParsed.type !== 'search') {
            return {
              ...candidateParsed,
              didYouMean: {
                from: firstToken,
                to: correctedToken
              },
              typedAs: query,
              originalQuery: query
            };
          }
        }
      }
    }

    return {
      type: 'search',
      query: norm,
      transliterated: transliteratedNorm || undefined,
      originalQuery: query
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. RANKED MULTI-ENTITY SEARCH
  // ─────────────────────────────────────────────────────────────────────────────

  function searchMultiEntity(normQuery, transliterated, ctx) {
    const q = normQuery || '';
    const trans = transliterated || '';

    function computeMatchScore(normTarget) {
      if (!normTarget || (!q && !trans)) return 0;

      let score = 0;
      const queries = [q, trans].filter(Boolean);

      for (const curQ of queries) {
        if (normTarget === curQ) {
          score = Math.max(score, 100);
        } else if (normTarget.startsWith(curQ)) {
          score = Math.max(score, 80);
        } else if (normTarget.split(' ').some(w => w.startsWith(curQ))) {
          score = Math.max(score, 60);
        } else if (normTarget.includes(curQ)) {
          score = Math.max(score, 40);
        }
      }
      return score;
    }

    // 1. Rooms
    const roomMatches = [];
    ctx.rooms.forEach(r => {
      const numScore = computeMatchScore(getEntityNormalizedField(r, 'room_number'));
      const typeScore = computeMatchScore(getEntityNormalizedField(r, 'type'));
      const statusScore = computeMatchScore(getEntityNormalizedField(r, 'status'));
      const maxScore = Math.max(numScore * 1.2, typeScore, statusScore);
      if (maxScore > 0) {
        roomMatches.push({ room: r, score: maxScore });
      }
    });

    roomMatches.sort((a, b) => b.score - a.score).slice(0, 5).forEach(({ room: r }) => {
      ctx.results.push({
        category: '🚪 الغرف والوحدات',
        icon: r.status === 'متاحة' ? '🟢' : (r.status === 'مشغولة' ? '🔴' : '🧹'),
        title: `غرفة ${r.room_number} • ${r.type || 'عادية'}`,
        subtitle: `الحالة: ${r.status} • السعر: ${Number(r.price_per_night || 0).toLocaleString('en-US')} ر.س/ليلة`,
        badge: r.status,
        actionType: 'view-section',
        actionPayload: { section: 'rooms', roomNumber: r.room_number },
        actionFn: () => {
          switchViewSection('rooms');
          const searchInput = document.getElementById('search-rooms');
          if (searchInput) {
            searchInput.value = r.room_number;
            searchInput.dispatchEvent(new Event('input'));
          }
        }
      });
    });

    // 2. Reservations
    const resMatches = [];
    ctx.reservations.forEach(r => {
      const idScore = computeMatchScore(getEntityNormalizedField(r, 'id'));
      const roomScore = computeMatchScore(getEntityNormalizedField(r, 'room_number'));
      const nameScore = computeMatchScore(getEntityNormalizedField(r, 'guest_name'));
      const phoneScore = computeMatchScore(getEntityNormalizedField(r, 'guest_phone'));
      const maxScore = Math.max(idScore * 1.5, roomScore, nameScore, phoneScore);
      if (maxScore > 0) {
        resMatches.push({ res: r, score: maxScore });
      }
    });

    resMatches.sort((a, b) => b.score - a.score).slice(0, 5).forEach(({ res: r }) => {
      ctx.results.push({
        category: '📋 الحجوزات',
        icon: '📋',
        title: `حجز #${r.id} • ${r.guest_name || 'نزيل'} (غرفة ${r.room_number || '-'})`,
        subtitle: `الحالة: ${r.status} • الوصول: ${r.check_in_date || '-'} • المغادرة: ${r.check_out_date || '-'}`,
        badge: r.status,
        actionType: 'preview',
        actionPayload: { reservationId: r.id, reservation: r, roomNumber: r.room_number },
        actionFn: () => {
          if (App?.Helpers?.openReservationPreview) {
            App.Helpers.openReservationPreview(r.id);
          } else {
            showMissingHelperToast();
          }
        }
      });
    });

    // 3. Guests
    const guestMatches = [];
    ctx.guests.forEach(g => {
      const nameScore = computeMatchScore(getEntityNormalizedField(g, 'name'));
      const phoneScore = computeMatchScore(getEntityNormalizedField(g, 'phone'));
      const idScore = Math.max(
        computeMatchScore(getEntityNormalizedField(g, 'id_number')),
        computeMatchScore(getEntityNormalizedField(g, 'national_id'))
      );
      const maxScore = Math.max(nameScore, phoneScore, idScore);
      if (maxScore > 0) {
        guestMatches.push({ guest: g, score: maxScore });
      }
    });

    guestMatches.sort((a, b) => b.score - a.score).slice(0, 5).forEach(({ guest: g }) => {
      ctx.results.push({
        category: '👤 قائمة النزلاء',
        icon: '👤',
        title: `النزيل: ${g.name}`,
        subtitle: `الجوال: ${g.phone || '-'} • الهوية: ${g.id_number || '-'} ${g.is_banned ? '• (محظور ⛔)' : ''}`,
        badge: g.is_banned ? 'محظور' : 'نشط',
        actionType: 'view-section',
        actionPayload: { section: 'guests', guestName: g.name },
        actionFn: () => {
          switchViewSection('guests');
          const searchInput = document.getElementById('search-guests');
          if (searchInput) {
            searchInput.value = g.name;
            searchInput.dispatchEvent(new Event('input'));
          }
        }
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. COMMAND PALETTE UI CONTROLLER
  // ─────────────────────────────────────────────────────────────────────────────

  let paletteModal = null;
  let paletteInput = null;
  let paletteResults = null;
  let paletteCountLabel = null;
  let paletteCorrectionBanner = null;
  let currentSelectedIndex = -1;
  let currentItemsList = [];
  let previouslyFocusedElement = null;
  let searchDebounceTimer = null;

  function ensurePaletteElements() {
    if (paletteModal) return;
    paletteModal = document.getElementById('command-palette-modal');
    paletteInput = document.getElementById('command-palette-input');
    paletteResults = document.getElementById('command-palette-results');
    paletteCountLabel = document.getElementById('command-palette-results-count');

    if (!paletteModal) return;

    paletteCorrectionBanner = document.getElementById('command-palette-correction-banner');
    if (!paletteCorrectionBanner && paletteResults && paletteResults.parentNode) {
      paletteCorrectionBanner = document.createElement('div');
      paletteCorrectionBanner.id = 'command-palette-correction-banner';
      paletteCorrectionBanner.className = 'command-palette-correction-banner';
      paletteCorrectionBanner.style.display = 'none';
      paletteResults.parentNode.insertBefore(paletteCorrectionBanner, paletteResults);
    }

    // Close on backdrop click
    paletteModal.addEventListener('click', event => {
      if (event.target === paletteModal) closeCommandPalette();
    });

    // Trap focus inside modal & close on Escape
    paletteModal.addEventListener('keydown', event => {
      if (event.key === 'Tab') {
        trapModalFocus(event, paletteModal);
      } else if (event.key === 'Escape' || event.code === 'Escape' || event.keyCode === 27) {
        event.preventDefault();
        closeCommandPalette();
      }
    });

    // Close on hint close buttons
    const closeBtn = paletteModal.querySelector('[data-command-palette-close]');
    if (closeBtn) closeBtn.addEventListener('click', closeCommandPalette);

    // Click on suggestion chips
    paletteModal.querySelectorAll('.command-palette-hint-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const query = chip.dataset.query || chip.textContent.trim();
        if (paletteInput) {
          paletteInput.value = query;
          paletteInput.focus();
          handlePaletteSearch(query);
        }
      });
    });

    // Input listening with 100ms debounce
    paletteInput.addEventListener('input', e => {
      if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        handlePaletteSearch(e.target.value);
      }, 100);
    });

    // Keyboard navigation
    paletteInput.addEventListener('keydown', handlePaletteKeydown);
  }

  function trapModalFocus(event, modalContainer) {
    const focusableSelectors = 'input, button:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusables = Array.from(modalContainer.querySelectorAll(focusableSelectors));
    if (!focusables.length) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (event.shiftKey) {
      if (document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  function openCommandPalette(initialQuery = '') {
    ensurePaletteElements();
    if (!paletteModal) return;

    previouslyFocusedElement = document.activeElement;

    // Refresh database cache in background
    syncDataFromDb();

    // Refresh session attention cache and rebuild search index
    paletteAttentionCache = computeAttentionInbox();
    buildSearchIndex();

    paletteModal.style.display = 'flex';
    paletteInput.value = initialQuery;
    paletteInput.focus();
    paletteInput.select();
    handlePaletteSearch(initialQuery);
  }

  function closeCommandPalette() {
    if (!paletteModal) return;
    paletteModal.style.display = 'none';

    if (paletteCorrectionBanner) {
      paletteCorrectionBanner.innerHTML = '';
      paletteCorrectionBanner.style.display = 'none';
    }

    if (previouslyFocusedElement && typeof previouslyFocusedElement.focus === 'function') {
      try {
        previouslyFocusedElement.focus();
      } catch {}
      previouslyFocusedElement = null;
    }
  }

  function handlePaletteKeydown(e) {
    if (e.key === 'Escape' || e.code === 'Escape' || e.keyCode === 27) {
      e.preventDefault();
      closeCommandPalette();
      return;
    }

    if (e.key === 'Tab') {
      const firstSuggestion = currentItemsList.find(item => item.isSuggestion);
      if (firstSuggestion) {
        e.preventDefault();
        executePaletteItem(firstSuggestion);
        return;
      }
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveSelection(1);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveSelection(-1);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (currentSelectedIndex >= 0 && currentSelectedIndex < currentItemsList.length) {
        executePaletteItem(currentItemsList[currentSelectedIndex]);
      }
      return;
    }

    const normalizedDigit = normalizeDigits(e.key);
    if ((e.ctrlKey || e.metaKey) && normalizedDigit >= '1' && normalizedDigit <= '9') {
      const targetIdx = parseInt(normalizedDigit, 10) - 1;
      if (targetIdx >= 0 && targetIdx < currentItemsList.length) {
        e.preventDefault();
        executePaletteItem(currentItemsList[targetIdx]);
        return;
      }
    }
  }

  function moveSelection(direction) {
    if (!currentItemsList.length) return;
    currentSelectedIndex += direction;
    if (currentSelectedIndex < 0) currentSelectedIndex = currentItemsList.length - 1;
    if (currentSelectedIndex >= currentItemsList.length) currentSelectedIndex = 0;

    updateSelectionUi();
  }

  function updateSelectionUi() {
    const items = paletteResults.querySelectorAll('.command-palette-item');
    items.forEach((el, index) => {
      const isSelected = index === currentSelectedIndex;
      el.classList.toggle('is-selected', isSelected);
      el.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      if (isSelected) {
        el.scrollIntoView({ block: 'nearest' });
        if (paletteInput) {
          paletteInput.setAttribute('aria-activedescendant', `palette-item-${index}`);
        }
      }
    });
  }

  function renderCorrectionBanner(intent) {
    if (!paletteCorrectionBanner) return;
    if (intent && intent.didYouMean && intent.didYouMean.from && intent.didYouMean.to) {
      const from = escapePaletteText(intent.didYouMean.from);
      const to = escapePaletteText(intent.didYouMean.to);
      const originalTyped = intent.typedAs || intent.originalQuery || intent.didYouMean.from;

      paletteCorrectionBanner.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; padding: 8px 16px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 0.85rem; color: #334155; box-sizing: border-box;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 1rem;">💡</span>
            <span>تم تصحيح <strong>«${from}»</strong> إلى <strong>«${to}»</strong></span>
          </div>
          <button type="button" class="palette-banner-undo-btn" style="background: none; border: none; color: #2563eb; font-size: 0.82rem; font-weight: 600; cursor: pointer; text-decoration: underline; padding: 2px 6px; font-family: inherit;">
            ابحث عن «${from}» كما كتبت
          </button>
        </div>
      `;
      paletteCorrectionBanner.style.display = 'block';

      const undoBtn = paletteCorrectionBanner.querySelector('.palette-banner-undo-btn');
      if (undoBtn) {
        undoBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          handlePaletteSearch(originalTyped, { skipCorrection: true });
        });
      }
    } else {
      paletteCorrectionBanner.innerHTML = '';
      paletteCorrectionBanner.style.display = 'none';
    }
  }

  // Generate Results according to Intent via Command Registry
  function handlePaletteSearch(rawQuery, options = {}) {
    if (!paletteResults) return;
    const intent = parseCommandIntent(rawQuery, options);
    renderCorrectionBanner(intent);
    const rooms = getRooms();
    const reservations = getReservations();
    const guests = getGuests();
    const attention = paletteAttentionCache || computeAttentionInbox();
    paletteAttentionCache = attention;
    const currentBizDate = getCurrentBizDate();

    const context = {
      rawQuery,
      rooms,
      reservations,
      guests,
      attention,
      currentBizDate,
      results: []
    };

    if (intent.type === 'empty') {
      // 0. Recent Items (if any recorded in localStorage)
      const recent = getRecentItems();
      if (recent.length > 0) {
        recent.forEach(rec => {
          const resolved = resolveRecentActionItem(rec, context);
          if (resolved) {
            context.results.push(resolved);
          }
        });
      }

      // 1. High-priority attention items (if any exist)
      if (attention.totalCount > 0) {
        const topAttention = attention.deduplicatedAllItems.slice(0, 4);
        topAttention.forEach(item => {
          context.results.push({
            category: '⚡ تنبيهات عاجلة تتطلب متابعة',
            icon: item.badgeClass === 'danger' ? '⚠️' : (item.badgeClass === 'warning' ? '💳' : '🚪'),
            title: item.title,
            subtitle: item.subtitle,
            badge: item.badge,
            isUrgent: true,
            actionType: item.action,
            actionPayload: { reservationId: item.reservation?.id, reservation: item.reservation, roomId: item.room?.id, room: item.room },
            actionFn: () => executeAttentionAction(item)
          });
        });
      }

      // 2. Quick Suggested Actions
      context.results.push({
        category: '🎯 إجراءات فندقية سريعة',
        icon: '➕',
        title: 'تسجيل حجز أو تسكين جديد',
        subtitle: 'فتح نموذج التسكين والحجز الفوري (اختصار F2)',
        badge: 'F2',
        actionFn: () => {
          const btn = document.getElementById('btn-open-new-reservation-modal');
          if (btn) btn.click();
        }
      });

      const currentUserRole = App?.State?.currentUser?.role || (typeof localStorage !== 'undefined' ? localStorage.getItem('currentUserRole') : null);
      const isAdmin = currentUserRole === 'Admin';

      context.results.push({
        category: '🎯 إجراءات فندقية سريعة',
        icon: '💵',
        title: 'تقرير إقفال الوردية والدرج النقدي (Shift Audit)',
        subtitle: isAdmin ? 'استعراض النقدية المتحصلة ورصيد الصندوق والمدفوعات' : 'يتطلب صلاحية مدير النظام (Admin)',
        badge: isAdmin ? 'الخزينة' : 'مدير النظام 🔒',
        actionFn: () => {
          if (!isAdmin) {
            if (App?.Helpers?.showToast) App.Helpers.showToast('تقرير الوردية التفصيلي متاح لمدير النظام فقط (Admin).', 'warning');
            return;
          }
          if (typeof window.openShiftAuditModal === 'function') window.openShiftAuditModal();
          else showMissingHelperToast();
        }
      });

      context.results.push({
        category: '🎯 إجراءات فندقية سريعة',
        icon: '⚡',
        title: 'صندوق المهام والتنبيهات العاجلة (Attention Inbox)',
        subtitle: `استعراض ${attention.totalCount} مهام وتنبيهات تحتاج متابعة الآن`,
        badge: `${attention.totalCount} مهام`,
        actionFn: () => openAttentionInboxModal()
      });

      // 3. Navigation shortcuts
      context.results.push({
        category: '🧭 التنقل السريع في النظام',
        icon: '🛏️',
        title: 'شاشة الغرف والوحدات',
        subtitle: 'استعراض خريطة الغرف وحالات الإشغال والنظافة',
        badge: 'الغرف',
        actionFn: () => switchViewSection('rooms')
      });
      context.results.push({
        category: '🧭 التنقل السريع في النظام',
        icon: '📋',
        title: 'سجل الحجوزات والعمليات',
        subtitle: 'جدول الحجوزات الكامل وسندات القبض',
        badge: 'الحجوزات',
        actionFn: () => switchViewSection('reservations')
      });
      context.results.push({
        category: '🧭 التنقل السريع في النظام',
        icon: '👥',
        title: 'دليل النزلاء والعملاء',
        subtitle: 'البحث في ملفات النزلاء، أرقام الهوية، وقوائم الحظر',
        badge: 'النزلاء',
        actionFn: () => switchViewSection('guests')
      });
    } else {
      // Find matching command in registry
      const matchingCmd = COMMAND_REGISTRY.find(cmd => intent.commandId === cmd.id || intent.type === `${cmd.id}-intent`);
      if (matchingCmd) {
        matchingCmd.handle(context, intent.matchResult || intent);
      } else {
        // Prefix command suggestions (autocompletion)
        const suggestions = getPrefixCommandSuggestions(rawQuery, intent, context);
        if (suggestions.length > 0) {
          suggestions.forEach(s => context.results.push(s));
        }

        // Fallback: Ranked multi-entity search
        searchMultiEntity(intent.query, intent.transliterated, context);
      }
    }

    renderPaletteResults(context.results);
  }

  function renderPaletteResults(results) {
    currentItemsList = results;
    currentSelectedIndex = results.length > 0 ? 0 : -1;

    if (paletteCountLabel) {
      paletteCountLabel.textContent = `${results.length} خيار`;
    }

    if (!results.length) {
      paletteResults.innerHTML = `
        <div style="padding: 32px 20px; text-align: center; color: #94a3b8;">
          <div style="font-size: 2rem; margin-bottom: 8px;">🔍</div>
          <div style="font-weight: 700; font-size: 0.95rem; color: #64748b;">لم يتم العثور على نتائج مطابقة</div>
          <div style="font-size: 0.82rem; margin-top: 4px;">جرب كتابة رقم غرفة، اسم نزيل، أو أمراً مثل: "تسكين 101" أو "فلوس الدرج"</div>
        </div>
      `;
      return;
    }

    let lastCategory = '';
    let html = '';

    results.forEach((item, index) => {
      if (item.category && item.category !== lastCategory) {
        lastCategory = item.category;
        html += `<div class="command-palette-category">${escapePaletteText(lastCategory)}</div>`;
      }

      const isSelected = index === currentSelectedIndex;
      html += `
        <div class="command-palette-item ${isSelected ? 'is-selected' : ''} ${item.isUrgent ? 'is-urgent' : ''}"
             id="palette-item-${index}"
             data-index="${index}"
             role="option"
             aria-selected="${isSelected}">
          <div class="command-palette-item-main">
            <div class="command-palette-item-icon">${escapePaletteText(item.icon || '⚡')}</div>
            <div class="command-palette-item-texts">
              <div class="command-palette-item-title">${escapePaletteText(item.title)}</div>
              <div class="command-palette-item-subtitle">${escapePaletteText(item.subtitle || '')}</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
            ${item.badge ? `<span class="command-palette-item-badge">${escapePaletteText(item.badge)}</span>` : ''}
            ${index < 5 ? `<kbd class="command-palette-keyhint" title="اضغط Ctrl+${index + 1}">Ctrl+${index + 1}</kbd>` : ''}
          </div>
        </div>
      `;
    });

    paletteResults.innerHTML = html;

    // Attach click and mouseenter handlers
    paletteResults.querySelectorAll('.command-palette-item').forEach(el => {
      el.addEventListener('mouseenter', () => {
        const idx = Number(el.dataset.index);
        if (idx >= 0 && idx < currentItemsList.length) {
          currentSelectedIndex = idx;
          updateSelectionUi();
        }
      });

      el.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const idx = Number(el.dataset.index);
        if (idx >= 0 && idx < currentItemsList.length) {
          executePaletteItem(currentItemsList[idx]);
        }
      });
    });
  }

  function executePaletteItem(item) {
    if (!item) return;
    if (item.preventClose) {
      safeExecute(item.actionFn);
      return;
    }
    recordRecentItem(item);
    closeCommandPalette();
    safeExecute(item.actionFn);
  }

  function safeExecute(fn, missingMessage = 'الخدمة المطلوبة غير متوفرة حالياً.') {
    if (typeof fn === 'function') {
      try {
        fn();
      } catch (err) {
        console.error('Error executing palette action:', err);
        if (App?.Helpers?.showToast) {
          App.Helpers.showToast(`حدث خطأ أثناء تنفيذ الإجراء: ${err.message}`, 'error');
        }
      }
    } else if (missingMessage) {
      if (App?.Helpers?.showToast) {
        App.Helpers.showToast(missingMessage, 'warning');
      }
    }
  }

  function showMissingHelperToast(msg) {
    if (App?.Helpers?.showToast) {
      App.Helpers.showToast(msg || 'الخدمة المطلوبة غير متوفرة حالياً.', 'warning');
    }
  }

  function switchViewSection(sectionName) {
    const navLink = document.querySelector(`.nav-link[data-section="${sectionName}"]`);
    if (navLink) {
      navLink.click();
      if (typeof updateAttentionInbox === 'function') {
        setTimeout(updateAttentionInbox, 100);
      }
    }
  }

  // Safe Confirmation Flow for Room Cleaning (replaces direct writes)
  async function requestRoomCleaningCompletion(room) {
    if (!room) return;

    const showConfirm = window.DashboardApp?.Helpers?.showConfirmDialog || window.showConfirmDialog;
    if (showConfirm) {
      const confirmed = await showConfirm({
        title: 'تأكيد جاهزية الغرفة للنظافة',
        message: `هل تم الانتهاء من تنظيف الغرفة (${room.room_number}) وتجهيزها للتسكين الفوري لتصبح "متاحة"؟`,
        confirmText: 'نعم، أصبحت متاحة',
        cancelText: 'إلغاء',
        isDanger: false
      });
      if (!confirmed) return;
    }

    if (window.api && typeof window.api.updateRoomStatus === 'function') {
      try {
        const res = await window.api.updateRoomStatus(room.id, 'متاحة');
        if (res && res.success) {
          if (App?.Helpers?.showToast) {
            App.Helpers.showToast(`تم تحديث غرفة ${room.room_number} إلى "متاحة" بنجاح ✓`, 'success');
          }
          room.status = 'متاحة';
          if (typeof window.DashboardApp?.Helpers?.renderRoomsGrid === 'function') {
            window.DashboardApp.Helpers.renderRoomsGrid();
          }
          if (typeof window.DashboardApp?.Helpers?.loadOverviewData === 'function') {
            window.DashboardApp.Helpers.loadOverviewData();
          }
          updateAttentionInbox();
        } else {
          if (App?.Helpers?.showToast) {
            App.Helpers.showToast(res?.error || 'تعذر تحديث حالة الغرفة.', 'error');
          }
        }
      } catch (err) {
        if (App?.Helpers?.showToast) {
          App.Helpers.showToast(`خطأ: ${err.message}`, 'error');
        }
      }
    } else {
      switchViewSection('rooms');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. ATTENTION INBOX MODAL & OVERVIEW WIDGET
  // ─────────────────────────────────────────────────────────────────────────────

  let attentionModal = null;
  let currentAttentionFilter = 'all';

  function ensureAttentionModal() {
    if (attentionModal) return;
    attentionModal = document.getElementById('attention-inbox-modal');
    if (!attentionModal) return;

    attentionModal.addEventListener('click', event => {
      if (event.target === attentionModal) closeAttentionInboxModal();
    });

    // Trap focus inside attention modal & close on Escape
    attentionModal.addEventListener('keydown', event => {
      if (event.key === 'Tab') {
        trapModalFocus(event, attentionModal);
      } else if (event.key === 'Escape' || event.code === 'Escape' || event.keyCode === 27) {
        event.preventDefault();
        closeAttentionInboxModal();
      }
    });

    const closeBtn = document.getElementById('btn-close-attention-inbox');
    if (closeBtn) closeBtn.addEventListener('click', closeAttentionInboxModal);

    const footerCloseBtn = document.getElementById('btn-footer-close-attention');
    if (footerCloseBtn) footerCloseBtn.addEventListener('click', closeAttentionInboxModal);

    const tabsContainer = document.getElementById('attention-inbox-tabs');
    if (tabsContainer) {
      tabsContainer.querySelectorAll('.attention-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          tabsContainer.querySelectorAll('.attention-tab').forEach(t => t.classList.remove('is-active', 'btn-primary'));
          tab.classList.add('is-active', 'btn-primary');
          currentAttentionFilter = tab.dataset.tab || 'all';
          renderAttentionModalList();
        });
      });
    }
  }

  function openAttentionInboxModal(filterTab = 'all') {
    ensureAttentionModal();
    if (!attentionModal) return;

    currentAttentionFilter = filterTab;
    const tabsContainer = document.getElementById('attention-inbox-tabs');
    if (tabsContainer) {
      tabsContainer.querySelectorAll('.attention-tab').forEach(t => {
        const isMatch = t.dataset.tab === filterTab;
        t.classList.toggle('is-active', isMatch);
        t.classList.toggle('btn-primary', isMatch);
      });
    }

    paletteAttentionCache = null;
    renderAttentionModalList();
    attentionModal.style.display = 'flex';

    syncDataFromDb({ force: true }).then(() => {
      if (attentionModal && attentionModal.style.display && attentionModal.style.display !== 'none') {
        renderAttentionModalList();
      }
    }).catch(() => {});
  }

  function closeAttentionInboxModal() {
    if (!attentionModal) return;
    attentionModal.style.display = 'none';
  }

  function renderAttentionSubtitle(text) {
    if (!text) return '';
    const escaped = escapePaletteText(text);
    const parts = escaped.split(' • ');
    return parts.map(part => `<span style="display: inline-block;"><bdi>${part}</bdi></span>`).join('<span style="color: #cbd5e1; margin: 0 6px; user-select: none;">•</span>');
  }

  function renderAttentionModalList() {
    const listEl = document.getElementById('attention-inbox-list');
    if (!listEl) return;

    const data = computeAttentionInbox();

    // Update tab counts
    setTabCount('tab-cnt-all', data.totalCount);
    setTabCount('tab-cnt-late', data.lateCheckouts.length);
    setTabCount('tab-cnt-dept', data.departuresToday.length);
    setTabCount('tab-cnt-unpaid', data.unpaidBalances.length);
    setTabCount('tab-cnt-dirty', data.dirtyRooms.length);
    setTabCount('tab-cnt-monthly', data.monthlyDue.length);
    setTabCount('tab-cnt-deposit', data.legacyDeposits.length);

    let items = [];
    let completedNoticeHtml = '';

    if (currentAttentionFilter === 'all') {
      items = data.deduplicatedAllItems;
    } else if (currentAttentionFilter === 'late-checkout') {
      items = data.lateCheckouts;
    } else if (currentAttentionFilter === 'departures-today') {
      items = data.departuresToday;
      // If there are completed checkouts today, display them as well to resolve receptionist questions
      if (data.completedDeparturesToday.length > 0) {
        completedNoticeHtml = `
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 12px 16px; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
            <div style="font-size: 0.88rem; color: #166534; font-weight: 700;">
              ✓ تم إنجاز وتصفية ${data.completedDeparturesToday.length} مغادرة لليوم بنجاح (${data.completedDeparturesToday.map(c => `غرفة ${c.reservation?.room_number}`).join('، ')})
            </div>
          </div>
        `;
        if (!items.length) {
          items = data.completedDeparturesToday;
        }
      }
    } else if (currentAttentionFilter === 'unpaid-balance') {
      items = data.unpaidBalances;
    } else if (currentAttentionFilter === 'dirty-rooms') {
      items = data.dirtyRooms;
    } else if (currentAttentionFilter === 'monthly-due') {
      items = data.monthlyDue;
    } else if (currentAttentionFilter === 'legacy-deposit') {
      items = data.legacyDeposits;
    }

    if (!items.length) {
      listEl.innerHTML = `
        ${completedNoticeHtml}
        <div style="padding: 40px 20px; text-align: center; color: #16a34a; background: #f0fdf4; border-radius: 12px; border: 1px dashed #bbf7d0;">
          <div style="font-size: 2.2rem; margin-bottom: 8px;">✓</div>
          <div style="font-weight: 800; font-size: 1.05rem; color: #15803d;">لا توجد أي مهام أو تنبيهات معلقة في هذا القسم!</div>
          <div style="font-size: 0.85rem; color: #166534; margin-top: 4px;">جميع الإجراءات منتظمة ومحدثة بالكامل.</div>
        </div>
      `;
      return;
    }

    const badgeStyles = {
      danger: 'background: #fef2f2; color: #dc2626; border: 1px solid #fecaca;',
      warning: 'background: #fffbeb; color: #d97706; border: 1px solid #fde68a;',
      info: 'background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe;',
      purple: 'background: #f5f3ff; color: #7c3aed; border: 1px solid #ddd6fe;'
    };

    listEl.innerHTML = completedNoticeHtml + items.map((item, idx) => {
      const bStyle = badgeStyles[item.badgeClass] || badgeStyles.info;
      let actionClass = 'attention-btn-default';
      let actionIcon = '⚡';
      if (item.action === 'checkout') {
        actionClass = 'attention-btn-checkout';
        actionIcon = '🚪';
      } else if (item.action === 'payment') {
        actionClass = 'attention-btn-payment';
        actionIcon = '💳';
      } else if (item.action === 'mark-clean') {
        actionClass = 'attention-btn-clean';
        actionIcon = '✨';
      } else if (item.action === 'extend') {
        actionClass = 'attention-btn-default';
        actionIcon = '⏱️';
      } else if (item.action === 'preview') {
        actionClass = 'attention-btn-default';
        actionIcon = '👁️';
      }

      return `
        <div class="attention-card">
          <div style="min-width: 0;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <span style="font-weight: 800; font-size: 0.95rem; color: #1e293b;">${escapePaletteText(item.title)}</span>
              <span style="font-size: 0.74rem; font-weight: 800; padding: 2px 8px; border-radius: 6px; ${bStyle}">${escapePaletteText(item.badge)}</span>
            </div>
            <div style="font-size: 0.82rem; color: #64748b; line-height: 1.6; margin-top: 2px;">
              ${renderAttentionSubtitle(item.subtitle)}
            </div>
          </div>
          <div class="attention-action-group">
            <button type="button" class="attention-action-btn ${actionClass}" data-item-idx="${idx}">
              <span>${actionIcon}</span>
              <span>${escapePaletteText(item.primaryActionText || 'اتخاذ إجراء')}</span>
            </button>
            ${item.reservation && (item.type === 'late-checkout' || item.type === 'departures-today') ? `
              <button type="button" class="attention-extend-btn" data-res-id="${item.reservation.id}" title="تمديد مدة الإقامة للنزيل">
                <span>⏱️</span>
                <span>تمديد الحجز</span>
              </button>
            ` : ''}
            ${item.reservation && item.reservation.guest_phone ? `
              <button type="button" class="attention-whatsapp-btn" data-res-id="${item.reservation.id}" title="مراسلة النزيل عبر واتساب (${escapePaletteText(item.reservation.guest_phone)})">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.888 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.456 5.711 1.457h.004c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                <span>واتساب</span>
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Attach actions
    listEl.querySelectorAll('.attention-action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.itemIdx);
        if (idx >= 0 && idx < items.length) {
          closeAttentionInboxModal();
          executeAttentionAction(items[idx]);
        }
      });
    });

    listEl.querySelectorAll('.attention-extend-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const resId = btn.dataset.resId;
        if (resId && window.openExtendStayModal) {
          closeAttentionInboxModal();
          window.openExtendStayModal(resId);
        } else if (resId && App?.Helpers?.openReservationPreview) {
          closeAttentionInboxModal();
          App.Helpers.openReservationPreview(resId);
        } else {
          showMissingHelperToast();
        }
      });
    });

    listEl.querySelectorAll('.attention-whatsapp-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const resId = btn.dataset.resId;
        if (resId && window.sendReservationWhatsApp) {
          window.sendReservationWhatsApp(resId);
        } else {
          showMissingHelperToast();
        }
      });
    });
  }

  function setTabCount(id, count) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(count || 0);
  }

  function executeAttentionAction(item) {
    if (!item) return;

    if (item.action === 'checkout' && item.reservation) {
      if (App?.Helpers?.openContractSettleModal) {
        App.Helpers.openContractSettleModal(item.reservation);
      } else if (App?.Helpers?.openReservationPreview) {
        App.Helpers.openReservationPreview(item.reservation.id);
      } else {
        showMissingHelperToast();
      }
    } else if (item.action === 'payment' && item.reservation) {
      if (window.openAddPaymentModal) {
        window.openAddPaymentModal(item.reservation.id);
      } else if (App?.Helpers?.openReservationPreview) {
        App.Helpers.openReservationPreview(item.reservation.id);
      } else {
        showMissingHelperToast();
      }
    } else if (item.action === 'extend' && item.reservation) {
      if (window.openExtendStayModal) {
        window.openExtendStayModal(item.reservation.id);
      } else if (App?.Helpers?.openReservationPreview) {
        App.Helpers.openReservationPreview(item.reservation.id);
      } else {
        showMissingHelperToast();
      }
    } else if (item.action === 'preview' && item.reservation) {
      if (App?.Helpers?.openReservationPreview) {
        App.Helpers.openReservationPreview(item.reservation.id);
      } else if (window.openInvoiceModal) {
        window.openInvoiceModal(item.reservation.id);
      } else {
        showMissingHelperToast();
      }
    } else if (item.action === 'mark-clean' && item.room) {
      requestRoomCleaningCompletion(item.room);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 9. OVERVIEW WIDGET & TOPBAR UPDATE
  // ─────────────────────────────────────────────────────────────────────────────

  function updateAttentionInbox() {
    const data = computeAttentionInbox();
    paletteAttentionCache = data;

    // 1. Topbar Badge & Button
    const badgeCount = document.getElementById('attention-badge-count');
    const topbarBtn = document.getElementById('btn-open-attention-inbox');
    if (badgeCount) badgeCount.textContent = String(data.totalCount);
    if (topbarBtn) {
      topbarBtn.classList.toggle('has-urgent', data.lateCheckouts.length > 0);
      topbarBtn.title = `صندوق المهام: ${data.totalCount} مهام تتطلب متابعة (${data.lateCheckouts.length} متأخرين)`;
    }

    // 2. Overview Widget
    const overviewWidget = document.getElementById('overview-attention-widget');
    if (overviewWidget) {
      if (data.totalCount === 0) {
        overviewWidget.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 8px; color: #15803d; font-weight: 800; font-size: 0.95rem;">
              <span>✓</span>
              <span>جميع العمليات الفندقية منتظمة (لا توجد متأخرات)</span>
            </div>
            <button type="button" class="btn btn-sm btn-secondary" data-open-attention-tab="all" style="font-weight: 700; font-size: 0.78rem;">
              سجل المهام
            </button>
          </div>
        `;
        overviewWidget.style.borderColor = '#bbf7d0';
        overviewWidget.style.background = '#f0fdf4';
      } else {
        overviewWidget.style.borderColor = data.lateCheckouts.length > 0 ? '#fecaca' : '#fed7aa';
        overviewWidget.style.background = data.lateCheckouts.length > 0 ? '#fff5f5' : '#fffaf5';

        overviewWidget.innerHTML = `
          <div class="overview-attention-header">
            <div class="overview-attention-title" style="color: ${data.lateCheckouts.length > 0 ? '#b91c1c' : '#9a3412'};">
              <span>⚡</span>
              <span>مركز المتابعة والمهام العاجلة (Needs Attention)</span>
              <span class="badge-attention-count" style="background: ${data.lateCheckouts.length > 0 ? '#dc2626' : '#ea580c'};">${data.totalCount}</span>
            </div>
            <button type="button" class="btn btn-sm btn-secondary" data-open-attention-tab="all" style="font-weight: 800; font-size: 0.8rem;">
              عرض التفاصيل الكاملة ←
            </button>
          </div>
          <div class="overview-attention-pills">
            ${data.lateCheckouts.length ? `
              <button type="button" class="attention-pill attention-pill-late" data-open-attention-tab="late-checkout">
                <span>⚠️</span> <span>متأخرون عن المغادرة (${data.lateCheckouts.length})</span>
              </button>
            ` : ''}
            ${data.departuresToday.length ? `
              <button type="button" class="attention-pill attention-pill-departures" data-open-attention-tab="departures-today">
                <span>🚪</span> <span>مغادرات مطلوبة اليوم (${data.departuresToday.length})</span>
              </button>
            ` : ''}
            ${data.unpaidBalances.length ? `
              <button type="button" class="attention-pill attention-pill-unpaid" data-open-attention-tab="unpaid-balance">
                <span>💳</span> <span>مبالغ معلقة بحاجة لسداد (${data.unpaidBalances.length})</span>
              </button>
            ` : ''}
            ${data.dirtyRooms.length ? `
              <button type="button" class="attention-pill attention-pill-dirty" data-open-attention-tab="dirty-rooms">
                <span>🧹</span> <span>غرف بانتظار النظافة (${data.dirtyRooms.length})</span>
              </button>
            ` : ''}
            ${data.monthlyDue.length ? `
              <button type="button" class="attention-pill attention-pill-monthly" data-open-attention-tab="monthly-due">
                <span>📅</span> <span>إيجارات شهرية تقترب من التجديد (${data.monthlyDue.length})</span>
              </button>
            ` : ''}
            ${data.legacyDeposits.length ? `
              <button type="button" class="attention-pill attention-pill-deposits" data-open-attention-tab="legacy-deposit">
                <span>💰</span> <span>تأمينات سابقة بحاجة لمطابقة (${data.legacyDeposits.length})</span>
              </button>
            ` : ''}
          </div>
        `;
      }

      overviewWidget.querySelectorAll('[data-open-attention-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
          openAttentionInboxModal(btn.dataset.openAttentionTab || 'all');
        });
      });
    }

    // 3. Live Attention Inbox Modal list (if modal is currently open in DOM)
    if (attentionModal && attentionModal.style.display && attentionModal.style.display !== 'none') {
      renderAttentionModalList();
    }
  }

  function escapePaletteText(str) {
    if (App?.Helpers?.escapeHtml) return App.Helpers.escapeHtml(str);
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 10. INITIALIZATION & EXPORTS
  // ─────────────────────────────────────────────────────────────────────────────

  function initCommandPalette() {
    ensurePaletteElements();
    ensureAttentionModal();

    // Sync database data right away so cache is ready before user interactions
    syncDataFromDb();

    // Wire Topbar Buttons
    const btnPalette = document.getElementById('btn-open-command-palette');
    if (btnPalette) {
      btnPalette.addEventListener('click', () => openCommandPalette());
    }

    const btnAttention = document.getElementById('btn-open-attention-inbox');
    if (btnAttention) {
      btnAttention.addEventListener('click', () => openAttentionInboxModal());
    }

    // Global Escape Key Listener (capture phase) to guarantee dismissal
    window.addEventListener('keydown', event => {
      if (event.key === 'Escape' || event.code === 'Escape' || event.keyCode === 27) {
        if (attentionModal && attentionModal.style.display && attentionModal.style.display !== 'none') {
          event.preventDefault();
          event.stopImmediatePropagation();
          closeAttentionInboxModal();
          return;
        }
        if (paletteModal && paletteModal.style.display && paletteModal.style.display !== 'none') {
          event.preventDefault();
          event.stopImmediatePropagation();
          closeCommandPalette();
          return;
        }
      }
    }, true);

    // Initial Attention Computation (after small delay to allow caches to load)
    setTimeout(updateAttentionInbox, 600);

    // Listen to tab / navigation changes to refresh attention state on demand without polling
    document.querySelectorAll('.nav-link').forEach(nav => {
      nav.addEventListener('click', () => {
        setTimeout(updateAttentionInbox, 250);
      });
    });

    // Listen to custom system-wide reservation / room events
    window.addEventListener('reservation:updated', () => syncDataFromDb({ force: true }));
    window.addEventListener('reservation:checkout', () => syncDataFromDb({ force: true }));
    window.addEventListener('reservation:extend', () => syncDataFromDb({ force: true }));
    window.addEventListener('rooms:updated', () => syncDataFromDb({ force: true }));
  }

  // Public APIs
  window.openCommandPalette = openCommandPalette;
  window.closeCommandPalette = closeCommandPalette;
  window.openAttentionInboxModal = openAttentionInboxModal;
  window.closeAttentionInboxModal = closeAttentionInboxModal;
  window.updateAttentionInbox = updateAttentionInbox;
  window.syncAttentionData = syncDataFromDb;
  window.syncAttentionTodayCheckouts = function(checkouts) {
    if (Array.isArray(checkouts)) {
      localTodayCheckouts = checkouts;
      if (App?.State) App.State.todayCheckoutsRows = checkouts;
      paletteAttentionCache = null;
      updateAttentionInbox();
    }
  };
  if (App?.Helpers) {
    App.Helpers.updateAttentionInbox = updateAttentionInbox;
    App.Helpers.syncAttentionData = syncDataFromDb;
  }

  // Helpers for testing / modular usage
  App.CommandPalette = {
    open: openCommandPalette,
    close: closeCommandPalette,
    parseCommandIntent,
    reorderNumberLast,
    editDistance,
    phoneticKey,
    correctToken,
    getKeywordVocab,
    getEntityWordSet,
    getPrefixCommandSuggestions,
    computeAttentionInbox,
    updateAttentionInbox,
    syncDataFromDb,
    normalize,
    normalizeArabic,
    normalizeDigits,
    stripDiacritics,
    transliterateEnToAr,
    getRooms,
    getReservations,
    getGuests,
    COMMAND_REGISTRY,
    getRecentItems,
    recordRecentItem,
    resolveRecentActionItem,
    deduceActionFromRecord,
    executePaletteItem,
    handlePaletteKeydown
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCommandPalette, { once: true });
  } else {
    initCommandPalette();
  }

})(window, document, window.DashboardApp);
