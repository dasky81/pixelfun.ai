import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";

/**
 * In-memory guards (Vercel serverless): best-effort.
 * - Rate limit: per IP, sliding window
 * - Anti-repeat: avoid same level type too often
 * - Cache: reuse last good response briefly to reduce cost spikes
 */
const RATE = { windowMs: 60_000, max: 25 }; // 25 req/min per IP
const ipBuckets = new Map(); // ip -> { resetAt, count }

const lastByKey = new Map(); // key -> { at, type, payload }
const recentTypesByKey = new Map(); // key -> array of last N types
const CACHE_TTL_MS = 8_000;
const RECENT_N = 6;

function getIP(req) {
  const xf = req.headers.get("x-forwarded-for");
  if (!xf) return "unknown";
  return xf.split(",")[0].trim() || "unknown";
}

function rateLimitOK(ip) {
  const now = Date.now();
  const cur = ipBuckets.get(ip);
  if (!cur || now > cur.resetAt) {
    ipBuckets.set(ip, { resetAt: now + RATE.windowMs, count: 1 });
    return true;
  }
  if (cur.count >= RATE.max) return false;
  cur.count += 1;
  return true;
}

function safeJsonParse(text) {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1) return null;
  try { return JSON.parse(text.slice(first, last + 1)); } catch { return null; }
}

function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
function shuffle(arr){ return [...arr].sort(()=>Math.random()-0.5); }


function ensureSpeaker(obj, speakerMode) {

  const s = obj.speaker;
  if (s === "gigetto" || s === "gigetta") return obj;

  // default: follow mode
  if (speakerMode === "gigetto") obj.speaker = "gigetto";
  else if (speakerMode === "gigetta") obj.speaker = "gigetta";
  else if (speakerMode === "duel") obj.speaker = "gigetta"; else obj.speaker = "gigetto";
  return obj;
}


const FALLBACK = {
  it: {
    jokes: [
      "Il bug non è un insetto: è una feature con autostima.",
      "Questo non è un errore: è un KPI che si ribella.",
      "Se fallisci, non è grave. È solo… documentato."
    ],
    quiz: [
      { q:"Cosa beve un computer?", options:["Acqua","Screenshots","Caffè Java"], correct:1, joke:"Speriamo non si bagni." },
      { q:"Qual è il colmo per un fantasma?", options:["Avere i bollenti spiriti","Essere trasparente","Non avere lenzuola"], correct:0, joke:"Buh!" },
      { q:"Gigetto è intelligente?", options:["Sì, molto","No, è stupido","È solo codice"], correct:0, joke:"Ottima risposta umano." }
    ]
  },
  en: {
    jokes: [
      "A bug is just a feature with confidence issues.",
      "My code works—on alternate Tuesdays.",
      "If you fail, it's not bad. It's… logged."
    ],
    quiz: [
      { q:"What does a computer drink?", options:["Water","Screenshots","Java Coffee"], correct:1, joke:"Hope it doesn't spill." }
    ]
  }
};

function fallbackLevel(lang="it"){
  const it = lang === "it";
  const roll = Math.random();

  if (roll < 0.30) {
    const q = pick((FALLBACK[lang]||FALLBACK.en).quiz);
    return { id: Date.now(), speaker:"gigetto", type:"quiz_mcq", ...q };
  }
  if (roll < 0.44) {
    return { id: Date.now(), speaker:"gigetto", type:"quiz_tf",
      q: it ? "Il JavaScript è Java." : "JavaScript is Java.",
      answer: false,
      joke: it ? "No. È marketing anni '90." : "No. It's 90s marketing."
    };
  }
  if (roll < 0.58) {
    const a = Math.floor(Math.random()*9)+1;
    const b = Math.floor(Math.random()*9)+1;
    const op = pick(["+","-"]);
    const ans = op === "+" ? a+b : a-b;
    return { id: Date.now(), speaker:"gigetto", type:"quiz_math",
      q: it ? `Quanto fa ${a} ${op} ${b}?` : `What is ${a} ${op} ${b}?`,
      options: shuffle([ans, ans+1, ans-1]).map(String),
      correct: 0, // we'll fix after shuffle below
      joke: it ? "Calcolo mentale. Niente Excel." : "Mental math. No Excel."
    };
  }
  if (roll < 0.70) {
    return { id: Date.now(), speaker:"gigetto", type:"reflex_move",
      q: it ? "PRENDI IL BERSAGLIO!" : "CATCH THE TARGET!",
      targetIcon: pick(["🐱","🎯","⚡"]),
      duration: 3000,
      joke: it ? "I tuoi riflessi hanno bisogno di funding." : "Your reflexes need funding."
    };
  }
  if (roll < 0.80) {
    const buttons = 6;
    return { id: Date.now(), speaker:"gigetto", type:"avoid_bomb",
      q: it ? "CLICCA… MA NON LA BOMBA 💣" : "CLICK… BUT NOT THE BOMB 💣",
      buttons,
      bombIndex: Math.floor(Math.random()*buttons),
      duration: 3500,
      joke: it ? "Boom = report mensile." : "Boom = monthly report."
    };
  }
  if (roll < 0.90) {
    return { id: Date.now(), speaker:"gigetto", type:"tap_sprint",
      q: it ? "TAPPA 12 VOLTE!" : "TAP 12 TIMES!",
      tapsRequired: 12,
      duration: 3500,
      joke: it ? "Questo è cardio da pollice." : "Thumb cardio."
    };
  }
  return { id: Date.now(), speaker:"gigetto", type:"joke_break",
    text: pick((FALLBACK[lang]||FALLBACK.en).jokes),
    joke: it ? "Ridi o ti metto in backlog." : "Laugh or I put you in the backlog."
  };
}



function validateBanter(obj, speakerMode){
  if (speakerMode !== "duel") return true;
  const b = obj.banter;
  if (!Array.isArray(b) || b.length !== 2) return false;
  for (const line of b){
    if (!line || (line.speaker !== "gigetto" && line.speaker !== "gigetta")) return false;
    if (typeof line.text !== "string" || !line.text.trim()) return false;
    if (line.text.length > 120) return false;
  }
  // enforce order: gigetto then gigetta (best effort)
  if (b[0].speaker !== "gigetto" || b[1].speaker !== "gigetta") return false;
  return true;
}


function normalizeQuizMath(obj){
  // ensure correct index aligns with shuffled options
  if (!obj || obj.type !== "quiz_math") return obj;
  const q = obj.q || "";
  const m = q.match(/(-?\d+)\s*([+\-])\s*(-?\d+)/);
  if (!m) return obj;
  const a = Number(m[1]); const op = m[2]; const b = Number(m[3]);
  const ans = op === "+" ? a + b : a - b;
  const idx = (obj.options || []).findIndex(x => Number(x) === ans);
  obj.correct = idx >= 0 ? idx : 0;
  return obj;
}

// Minimal validation/sanitization
function validate(obj, lang="it", speakerMode="auto"){
  if (!obj || typeof obj !== "object") return null;
  if (!obj.type || !obj.id) return null;
  const t = obj.type;
  // speaker normalization
  obj = ensureSpeaker(obj, speakerMode || "auto");
  if (!validateBanter(obj, speakerMode || "auto")) return null;

  if (t === "quiz_mcq") {
    if (!obj.q || !Array.isArray(obj.options) || obj.options.length !== 3) return null;
    if (![0,1,2].includes(obj.correct)) return null;
    return obj;
  }
  if (t === "quiz_tf") {
    if (!obj.q || typeof obj.answer !== "boolean") return null;
    return obj;
  }
  if (t === "quiz_order") {
    if (!obj.q || !Array.isArray(obj.items) || obj.items.length < 3 || obj.items.length > 6) return null;
    if (!Array.isArray(obj.correctOrder) || obj.correctOrder.length !== obj.items.length) return null;
    return obj;
  }
  if (t === "quiz_fill") {
    if (!obj.q || !obj.answer) return null;
    return obj;
  }
  if (t === "quiz_math") {
    if (!obj.q || !Array.isArray(obj.options) || obj.options.length !== 3) return null;
    // correct computed later
    return normalizeQuizMath(obj);
  }
  if (t === "reflex_move") {
    obj.duration = clamp(Number(obj.duration||3000), 2000, 5000);
    if (!obj.targetIcon) obj.targetIcon = "🎯";
    if (!obj.q) obj.q = lang==="it" ? "PRENDI IL BERSAGLIO!" : "CATCH THE TARGET!";
    return obj;
  }
  if (t === "avoid_bomb") {
    obj.buttons = clamp(Number(obj.buttons||6), 4, 9);
    obj.bombIndex = clamp(Number(obj.bombIndex??0), 0, obj.buttons-1);
    obj.duration = clamp(Number(obj.duration||3500), 2000, 5000);
    return obj;
  }
  if (t === "tap_sprint") {
    obj.tapsRequired = clamp(Number(obj.tapsRequired||10), 6, 25);
    obj.duration = clamp(Number(obj.duration||3500), 2000, 6000);
    return obj;
  }
  if (t === "memory_pair") {
    if (!Array.isArray(obj.cards) || obj.cards.length % 2 !== 0 || obj.cards.length < 6 || obj.cards.length > 16) return null;
    return obj;
  }
  if (t === "joke_break") {
    if (!obj.text) return null;
    return obj;
  }
  return null;
}

function pushRecentType(key, type){
  const arr = recentTypesByKey.get(key) || [];
  arr.push(type);
  while (arr.length > RECENT_N) arr.shift();
  recentTypesByKey.set(key, arr);
}

function isTypeTooRecent(key, type){
  const arr = recentTypesByKey.get(key) || [];
  return arr.includes(type);
}

export async function POST(req){
  const ip = getIP(req);

  if (!rateLimitOK(ip)) {
    // soft-fail: return a joke_break instead of 429 (keeps UX smooth)
    const it = true;
    return Response.json({
      id: Date.now(),
      type: "joke_break",
      text: "Rate limit. Respira. Poi riprova. (Io intanto fatturo.)",
      joke: "Troppa foga. Troppo poco budget."
    }, { status: 200 });
  }

  try {
    const body = await req.json().catch(()=>({}));
    const lang = body.lang === "en" ? "en" : "it";
    const difficulty = body.difficulty || "normal"; // easy | normal | hard
    const mood = body.mood || "medium"; // soft | medium | savage
    const topic = body.topic || "mixed"; // mixed | tech | general | kids
    const speakerMode = body.speakerMode || "auto"; // auto | gigetto | gigetta | duel
    const key = process.env.GEMINI_API_KEY;

    const cacheKey = `${lang}:${difficulty}:${mood}:${topic}:${speakerMode}`;
    const now = Date.now();
    const cached = lastByKey.get(cacheKey);
    if (cached && (now - cached.at) < CACHE_TTL_MS) {
      return Response.json(cached.payload, { status: 200 });
    }

    if (!key) {
      const fb = fallbackLevel(lang);
      lastByKey.set(cacheKey, { at: now, type: fb.type, payload: fb });
      pushRecentType(cacheKey, fb.type);
      return Response.json({ ...fb, _note:"Missing GEMINI_API_KEY, fallback used." }, {status:200});
    }

    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const it = lang === "it";

    const gameTypes = [
      "quiz_mcq (3 opzioni)",
      "quiz_tf (vero/falso)",
      "quiz_order (metti in ordine)",
      "quiz_fill (completa la frase con una parola)",
      "quiz_math (calcolo mentale con 3 opzioni)",
      "reflex_move (clicca bersaglio che si muove)",
      "avoid_bomb (scegli un pulsante, evita bomba)",
      "tap_sprint (tappa N volte entro tempo)",
      "memory_pair (trova coppie: 6..16 carte, emoji)",
      "joke_break (freddura)"
    ];

    // anti-repeat hint: avoid recent types
    const recent = recentTypesByKey.get(cacheKey) || [];
    const avoidList = recent.length ? `Evita questi tipi perché appena usati: ${recent.join(", ")}.` : "";

    const schema = `
OUTPUT: un SOLO oggetto JSON, senza markdown, senza testo extra.
Nota: puoi includere opzionalmente "banter": [{"speaker":"gigetto"|"gigetta","text":string},{"speaker":"gigetto"|"gigetta","text":string}] per la modalità DUEL.
Lingua: ${it ? "Italiano" : "English"}.
Difficulty: ${difficulty} (easy=più semplice, hard=più cattivo/veloce).
Topic: ${topic}.
Mood: ${mood} (soft=più gentile, savage=più cinico/sfidante ma sempre family-friendly).
SpeakerMode: ${speakerMode} (auto=dinamico; gigetto=solo gigetto; gigetta=solo gigetta; duel=duetto).

PERSONA DUAL:
- Devi scegliere lo speaker in base a SpeakerMode.
- Aggiungi sempre il campo "speaker": "gigetto" | "gigetta".

PERSONA GIGETTO:
- voce simpatica e pronta, con cinismo calibrato da Mood
- soft: ironia gentile; medium: sarcasmo leggero; savage: cinico/sfidante (mai offensivo)
- MAI odio, MAI volgarità esplicita, MAI attacchi a gruppi protetti
- il campo "joke" deve essere breve, tagliente e motivante (coach cattivo)

PERSONA GIGETTA:
- voce brillante, empatica ma pungente
- sfida con eleganza, incoraggia e rilancia
- ironia intelligente, mai offensiva
- il campo "joke" deve essere breve, spiritoso, e far venire voglia di riprovare

Scegli UNO dei seguenti tipi (includi SEMPRE il campo speaker):
- quiz_mcq: { "id": number, "speaker":"gigetto"|"gigetta", "type":"quiz_mcq", "q": string, "options":[s,s,s], "correct":0|1|2, "joke": string }
- quiz_tf: { "id": number, "speaker":"gigetto"|"gigetta", "type":"quiz_tf",  "q": string, "answer": true|false, "joke": string }
- quiz_order: { "id": number, "speaker":"gigetto"|"gigetta", "type":"quiz_order","q": string, "items":[...3..6 strings], "correctOrder":[...indici], "joke": string }
- quiz_fill: { "id": number, "speaker":"gigetto"|"gigetta", "type":"quiz_fill", "q": string, "answer": string, "joke": string } // q contiene __ come spazio vuoto
- quiz_math: { "id": number, "speaker":"gigetto"|"gigetta", "type":"quiz_math", "q": string, "options":[s,s,s], "joke": string } // correct verrà calcolato server-side
- reflex_move: { "id": number, "speaker":"gigetto"|"gigetta", "type":"reflex_move", "q": string, "targetIcon":"🐱"|"🎯"|"⚡", "duration":2000..5000, "joke": string }
- avoid_bomb: { "id": number, "speaker":"gigetto"|"gigetta", "type":"avoid_bomb", "q": string, "buttons":4..9, "bombIndex":0..buttons-1, "duration":2000..5000, "joke": string }
- tap_sprint: { "id": number, "speaker":"gigetto"|"gigetta", "type":"tap_sprint", "q": string, "tapsRequired":6..25, "duration":2000..6000, "joke": string }
- memory_pair: { "id": number, "speaker":"gigetto"|"gigetta", "type":"memory_pair", "q": string, "cards":[...even number 6..16 of emoji], "joke": string }
- joke_break: { "id": number, "speaker":"gigetto"|"gigetta", "type":"joke_break", "text": string, "joke": string }

Regole:
- Se speakerMode='duel': includi SEMPRE "banter" con 2 battute: prima Gigetto (cinico), poi Gigetta (rilancio).
- Regola SpeakerMode: se speakerMode='gigetto' usa speaker='gigetto' sempre; se speakerMode='gigetta' usa speaker='gigetta' sempre; se speakerMode='auto' scegli speaker='gigetta' per livelli facili/positivi e speaker='gigetto' per livelli cattivi/provocatori.
- Family-friendly.
- Se topic='kids': contenuti super-safe e semplici.
- Se topic='tech': preferisci riferimenti a coding/tech/business.
- Se topic='general': umorismo quotidiano.
- Se topic='mixed': mix bilanciato.

- Breve, punchy, divertente.
- id = timestamp (numero simile a Date.now()).
- Varia spesso i tipi (non ripetere troppo). ${avoidList}
`;

    const prompt = it
      ? `Genera un livello nuovo e originale per Gigetto. Scegli un tipo tra: ${gameTypes.join(", ")}. Tono: Gigetto simpatico, cinico, sfidante (in base al mood), niente offese. RISPOSTA SOLO JSON.`
      : `Generate a new original level for Gigetto. Choose a type among: ${gameTypes.join(", ")}. Tone: witty, cynical, challenger vibe (based on mood), no hate, no profanity. JSON only.`;

    const result = await model.generateContent(`${schema}\n\n${prompt}`);
    const text = result.response.text();
    const parsed = safeJsonParse(text);
    const valid = validate(parsed, lang, speakerMode);

    let out = valid || fallbackLevel(lang);

    if (speakerMode === "duel") {
      out.speaker = "gigetta";
      out.banter = [
        { speaker: "gigetto", text: it ? "Ok. Vediamo se oggi impari." : "Alright. Let's see if you learn today." },
        { speaker: "gigetta", text: it ? "Respira. Adesso vinci con stile." : "Breathe. Now win with style." }
      ];
    }

    // if type repeats too much, override with fallback of different roll (best effort)
    if (isTypeTooRecent(cacheKey, out.type)) {
      let alt = null;
      for (let i=0; i<4; i++){
        const tryFb = fallbackLevel(lang);
        if (!isTypeTooRecent(cacheKey, tryFb.type)) { alt = tryFb; break; }
      }
      if (alt) {
        lastByKey.set(cacheKey, { at: now, type: alt.type, payload: alt });
        pushRecentType(cacheKey, alt.type);
        return Response.json(alt, {status:200});
      }
    }

    lastByKey.set(cacheKey, { at: now, type: out.type, payload: out });
    pushRecentType(cacheKey, out.type);

    return Response.json(out, {status:200});
  } catch(e){
    return Response.json({ ...fallbackLevel("it"), _error: String(e?.message || e) }, {status:200});
  }
}
