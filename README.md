# Gigetto Ultra + Gemini Flash (Vercel Ready)

“Un milione di minigiochi e un miliardo di quiz” — tradotto in KPI reali:
- **Varietà infinita-ish** perché Gemini genera livelli nuovi ad ogni chiamata.
- Supporta **8 tipi** (MCQ, vero/falso, fill, ordine, reflex, avoid bomb, tap sprint, memory pair) + freddure.

## Locale
```bash
npm install
cp .env.example .env.local
# incolla la chiave:
# GEMINI_API_KEY=...
npm run dev
```

## Vercel
- Import repo GitHub
- Environment Variables: `GEMINI_API_KEY`
- Deploy

## Sicurezza
Non committare mai la chiave. Usa `.env.local` e le env di Vercel.


## Persona Gigetto
- Simpatico, cinico, provocatorio (sarcasmo leggero)
- Sempre pronto a sfidare l'utente
- Family-friendly: niente odio, niente volgarità esplicita


## Miglioramenti v3
- Rate limit soft (evita costi fuori controllo)
- Cache breve + anti-ripetizione tipi
- Nuovo tipo: quiz_math (calcolo mentale)
- Toggle IT/EN in UI


## v4
- Mood (SOFT/MEDIUM/SAVAGE) + Topic (MIXED/TECH/GENERAL/KIDS)
- KPI persistenti in localStorage (wins/losses/streak/score)
- Reset KPI


## v5
- Speaker duale: Gigetto + Gigetta
- Toggle speakerMode: AUTO / GIGETTO / GIGETTA
- Backend richiede campo `speaker` e normalizza se mancante


## v6
- Modalità DUEL: banter a 2 battute (Gigetto + Gigetta)
- Backend valida `banter` quando speakerMode=duel
