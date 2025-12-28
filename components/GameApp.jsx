"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Play, Zap, Skull, Smile } from "lucide-react";

function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
function shuffle(arr){ return [...arr].sort(()=>Math.random()-0.5); }

function Pill({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full border-2 border-black text-xs font-black ${active ? "bg-black text-white" : "bg-white"}`}
    >
      {children}
    </button>
  );
}

function Card({ children }) {
  return (
    <div className="bg-white border-4 border-black rounded-2xl shadow-[6px_6px_0px_black] p-4">
      {children}
    </div>
  );
}

function Loading() {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
      <div className="w-16 h-16 border-8 border-black border-t-yellow-400 rounded-full animate-spin"></div>
      <h2 className="font-black text-2xl">Caricamento in corso...</h2>
      <p className="text-sm">Gemini Flash sta facendo brainstorming con se stesso.</p>
    </div>
  );
}

function QuizMCQ({ level, onWin, onLose }) {
  return (
    <div className="space-y-3">
      <Card><div className="font-black text-lg text-center">{level.q}</div></Card>
      <div className="grid gap-2">
        {level.options.map((opt, i) => (
          <button key={i}
            className="px-3 py-4 border-4 border-black rounded-2xl font-black bg-blue-200 active:scale-[0.99]"
            onClick={() => (i === level.correct ? onWin() : onLose())}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function QuizTF({ level, onWin, onLose }) {
  return (
    <div className="space-y-3">
      <Card><div className="font-black text-lg text-center">{level.q}</div></Card>
      <div className="grid grid-cols-2 gap-2">
        <button className="px-3 py-4 border-4 border-black rounded-2xl font-black bg-green-200"
          onClick={() => (level.answer === true ? onWin() : onLose())}>
          VERO
        </button>
        <button className="px-3 py-4 border-4 border-black rounded-2xl font-black bg-red-200"
          onClick={() => (level.answer === false ? onWin() : onLose())}>
          FALSO
        </button>
      </div>
    </div>
  );
}

function QuizFill({ level, onWin, onLose }) {
  const [value, setValue] = useState("");
  const answer = (level.answer || "").trim().toLowerCase();
  const ok = value.trim().toLowerCase() === answer;

  return (
    <div className="space-y-3">
      <Card><div className="font-black text-lg text-center">{level.q}</div></Card>
      <input
        value={value}
        onChange={(e)=>setValue(e.target.value)}
        placeholder="Scrivi la parola…"
        className="w-full border-4 border-black rounded-2xl px-4 py-3 font-bold"
      />
      <button
        className="w-full px-4 py-4 bg-black text-white font-black rounded-2xl border-4 border-black"
        onClick={() => (ok ? onWin() : onLose())}
      >
        CONFERMA
      </button>
      <p className="text-xs text-center opacity-70">Suggerimento: una sola parola.</p>
    </div>
  );
}

function QuizOrder({ level, onWin, onLose }) {
  const items = Array.isArray(level.items) ? level.items : [];
  const correct = Array.isArray(level.correctOrder) ? level.correctOrder : [];
  const [order, setOrder] = useState(() => shuffle(items.map((_,i)=>i)));

  const swap = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  };

  const isCorrect = order.length === correct.length && order.every((v,i)=>v===correct[i]);

  return (
    <div className="space-y-3">
      <Card><div className="font-black text-lg text-center">{level.q}</div></Card>
      <div className="space-y-2">
        {order.map((idx, i) => (
          <div key={idx} className="flex gap-2 items-center border-4 border-black rounded-2xl p-2">
            <div className="flex-grow font-bold">{items[idx]}</div>
            <button className="px-3 py-2 border-2 border-black rounded-xl font-black" onClick={()=>swap(i,-1)}>↑</button>
            <button className="px-3 py-2 border-2 border-black rounded-xl font-black" onClick={()=>swap(i, 1)}>↓</button>
          </div>
        ))}
      </div>
      <button
        className="w-full px-4 py-4 bg-black text-white font-black rounded-2xl border-4 border-black"
        onClick={() => (isCorrect ? onWin() : onLose())}
      >
        CONFERMA ORDINE
      </button>
    </div>
  );
}

function ReflexMove({ level, onWin, onLose, difficulty }) {
  const base = clamp(Number(level.duration || 3000), 2000, 5000);
  const duration = difficulty === "hard" ? Math.max(1800, base - 700) : difficulty === "easy" ? base + 700 : base;
  const [pos, setPos] = useState({ top: 50, left: 50 });

  useEffect(() => {
    const speed = difficulty === "hard" ? 420 : difficulty === "easy" ? 700 : 550;
    const move = setInterval(() => {
      setPos({ top: Math.random()*80 + 10, left: Math.random()*80 + 10 });
    }, speed);
    const lose = setTimeout(() => onLose(), duration);
    return () => { clearInterval(move); clearTimeout(lose); };
  }, [duration, onLose, difficulty]);

  return (
    <div className="space-y-3">
      <Card>
        <div className="font-black text-lg text-center">
          {level.q} <span className="text-xs font-mono">({Math.round(duration/1000)}s)</span>
        </div>
      </Card>

      <div className="h-72 bg-slate-200 border-4 border-dashed border-black rounded-2xl relative overflow-hidden cursor-crosshair">
        <button
          onClick={onWin}
          style={{ top: `${pos.top}%`, left: `${pos.left}%` }}
          className="absolute -translate-x-1/2 -translate-y-1/2 text-4xl hover:scale-125 transition-transform"
          aria-label="target"
        >
          {level.targetIcon || "🎯"}
        </button>
      </div>

      <p className="text-xs text-center">Target mobile. KPI immobili: mai.</p>
    </div>
  );
}

function AvoidBomb({ level, onWin, onLose, difficulty }) {
  const buttons = clamp(Number(level.buttons || 6), 4, 9);
  const durationBase = clamp(Number(level.duration || 3500), 2000, 5000);
  const duration = difficulty === "hard" ? Math.max(1800, durationBase - 700) : difficulty === "easy" ? durationBase + 700 : durationBase;
  const bombIndex = clamp(Number(level.bombIndex ?? 0), 0, buttons-1);

  useEffect(() => {
    const lose = setTimeout(() => onLose(), duration);
    return () => clearTimeout(lose);
  }, [duration, onLose]);

  const cols = buttons <= 6 ? 3 : 3;

  return (
    <div className="space-y-3">
      <Card>
        <div className="font-black text-lg text-center">
          {level.q} <span className="text-xs font-mono">({Math.round(duration/1000)}s)</span>
        </div>
      </Card>

      <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: buttons }).map((_, i) => (
          <button
            key={i}
            className="px-3 py-6 border-4 border-black rounded-2xl font-black bg-yellow-200 active:scale-[0.99]"
            onClick={() => (i === bombIndex ? onLose() : onWin())}
          >
            ?
          </button>
        ))}
      </div>

      <p className="text-xs text-center">Uno è 💣. Gli altri sono “roadmap”.</p>
    </div>
  );
}

function TapSprint({ level, onWin, onLose, difficulty }) {
  const baseRequired = clamp(Number(level.tapsRequired || 12), 6, 25);
  const required = difficulty === "hard" ? Math.min(25, baseRequired + 4) : difficulty === "easy" ? Math.max(6, baseRequired - 3) : baseRequired;

  const base = clamp(Number(level.duration || 3500), 2000, 6000);
  const duration = difficulty === "hard" ? Math.max(1800, base - 800) : difficulty === "easy" ? base + 700 : base;

  const [taps, setTaps] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => onLose(), duration);
    return () => clearTimeout(t);
  }, [duration, onLose]);

  useEffect(() => {
    if (taps >= required) onWin();
  }, [taps, required, onWin]);

  return (
    <div className="space-y-3 text-center">
      <Card>
        <div className="font-black text-lg">{level.q}</div>
        <div className="text-xs font-mono opacity-70">Obiettivo: {required} tap • Tempo: {Math.round(duration/1000)}s</div>
      </Card>

      <button
        className="w-full px-4 py-10 bg-pink-500 text-white font-black rounded-2xl border-4 border-black text-3xl active:scale-[0.99]"
        onClick={() => setTaps(t => t + 1)}
      >
        TAP {taps}/{required}
      </button>

      <p className="text-xs opacity-70">Questo è agility… ma del pollice.</p>
    </div>
  );
}

function MemoryPair({ level, onWin, onLose, difficulty }) {
  const cards = Array.isArray(level.cards) ? level.cards : ["🍋","🍋","🐱","🐱","🎯","🎯"];
  const durationBase = 7000;
  const duration = difficulty === "hard" ? 5200 : difficulty === "easy" ? 8500 : durationBase;

  const [deck, setDeck] = useState(() => shuffle(cards.map((v, i) => ({ id:i, v, flipped:false, matched:false }))));
  const [open, setOpen] = useState([]); // indices
  const matchedCount = useMemo(() => deck.filter(d=>d.matched).length, [deck]);

  useEffect(() => {
    const t = setTimeout(() => onLose(), duration);
    return () => clearTimeout(t);
  }, [duration, onLose]);

  useEffect(() => {
    if (matchedCount === deck.length && deck.length > 0) onWin();
  }, [matchedCount, deck.length, onWin]);

  const flip = (idx) => {
    if (open.length === 2) return;
    const d = deck[idx];
    if (!d || d.matched || d.flipped) return;

    const next = deck.map((c, i) => i === idx ? { ...c, flipped:true } : c);
    const nextOpen = [...open, idx];
    setDeck(next);
    setOpen(nextOpen);

    if (nextOpen.length === 2) {
      const [a,b] = nextOpen;
      const va = next[a].v, vb = next[b].v;
      if (va === vb) {
        // match
        setTimeout(() => {
          setDeck(cur => cur.map((c,i)=> (i===a||i===b) ? { ...c, matched:true } : c));
          setOpen([]);
        }, 220);
      } else {
        // flip back
        setTimeout(() => {
          setDeck(cur => cur.map((c,i)=> (i===a||i===b) ? { ...c, flipped:false } : c));
          setOpen([]);
        }, 520);
      }
    }
  };

  const cols = deck.length <= 8 ? 4 : 4;

  return (
    <div className="space-y-3">
      <Card>
        <div className="font-black text-lg text-center">{level.q || "Trova le coppie!"}</div>
        <div className="text-xs font-mono text-center opacity-70">Tempo: {Math.round(duration/1000)}s</div>
      </Card>

      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
        {deck.map((c, idx) => (
          <button
            key={c.id}
            className={`h-16 border-4 border-black rounded-2xl font-black text-2xl active:scale-[0.99] ${
              c.matched ? "bg-green-200" : c.flipped ? "bg-white" : "bg-slate-200"
            }`}
            onClick={() => flip(idx)}
          >
            {c.flipped || c.matched ? c.v : "?"}
          </button>
        ))}
      </div>

      <p className="text-xs text-center opacity-70">Memoria: l’unico asset che non puoi comprare.</p>
    </div>
  );
}

function JokeBreak({ level, onWin }) {
  return (
    <div className="space-y-3 text-center">
      <div className="mx-auto w-fit bg-yellow-200 p-4 rounded-full border-4 border-black">
        <Smile size={56} className="text-black" />
      </div>
      <Card><div className="font-black text-lg">“{level.text}”</div></Card>
      <button className="w-full px-4 py-4 bg-green-500 text-white font-black rounded-2xl border-4 border-black" onClick={onWin}>
        HAHAHA (Avanti)
      </button>
    </div>
  );
}

export default function GameApp() {
  const [lang, setLang] = useState("it");
  const [difficulty, setDifficulty] = useState("normal"); // easy | normal | hard
  const [mood, setMood] = useState("medium"); // soft | medium | savage
  const [topic, setTopic] = useState("mixed"); // mixed | tech | general | kids
  const [speakerMode, setSpeakerMode] = useState("auto"); // auto | gigetto | gigetta
  const [streak, setStreak] = useState(0);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [state, setState] = useState("home"); // home | loading | playing | gameover
  const [level, setLevel] = useState(null);

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [gigetto, setGigetto] = useState("Più livelli, più caos, più KPI. E sì, ti stiamo giudicando.");

  useEffect(() => {
    if (typeof navigator !== "undefined") setLang(navigator.language?.startsWith("it") ? "it" : "en");
  }, []);

// Persistenza leggera (localStorage): KPI personali
useEffect(() => {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem("gigetto_ultra_stats_v4");
    if (!raw) return;
    const s = JSON.parse(raw);
    if (typeof s.score === "number") setScore(s.score);
    if (typeof s.wins === "number") setWins(s.wins);
    if (typeof s.losses === "number") setLosses(s.losses);
    if (typeof s.streak === "number") setStreak(s.streak);
    if (typeof s.difficulty === "string") setDifficulty(s.difficulty);
    if (typeof s.mood === "string") setMood(s.mood);
    if (typeof s.topic === "string") setTopic(s.topic);
    if (typeof s.lang === "string") setLang(s.lang);
  } catch {}
}, []);

useEffect(() => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("gigetto_ultra_stats_v4", JSON.stringify({
      score, wins, losses, streak, difficulty, mood, topic, lang
    }));
  } catch {}
}, [score, wins, losses, streak, difficulty, mood, topic, speakerMode, lang]);


  const load = useCallback(async () => {
    setState("loading");
    setGigetto(difficulty === "hard" ? "Modalità HARD: niente pietà. Sorridi: è una demo, non una terapia." : "Sto generando un livello con Gemini Flash… Preparati a fallire con stile.");
    try {
      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lang, difficulty, mood, topic, speakerMode })
      });
      const data = await r.json();
      setLevel(data);
      setGigetto(data.joke || "Vediamo se reggi la pressione.");
      setState("playing");
    } catch {
      setGigetto("Errore. Ma io non sbaglio mai: quindi è colpa della rete.");
      setState("home");
    }
  }, [lang, difficulty, mood, topic, speakerMode]);

  const win = useCallback(() => {
    setScore(s => s + 100);
    setWins(w => w + 1);
    setStreak(st => st + 1);
    load();
  }, [load]);

  const lose = useCallback(() => {
    setLosses(l => l + 1);
    setStreak(0);
    setLives(prev => {
      const next = prev - 1;
      if (next <= 0) setState("gameover");
      return next;
    });
    setTimeout(() => {
      setLives(prev => {
        if (prev > 0) load();
        return prev;
      });
    }, 120);
  }, [load]);

  const reset = () => {
    setLives(3); setLevel(null); setState("home");
    setGigetto("Gigetto dice: riparti. E non piangere sul backlog. Piangi in produzione, come tutti.");
  };

  const resetKPI = () => {
    setScore(0); setWins(0); setLosses(0); setStreak(0);
    setGigetto("KPI azzerati. Ora ricostruisci la tua reputazione. Con dignità, possibilmente.");
  };

  return (
    <div className="min-h-[100dvh] bg-indigo-600 grid place-items-center p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-[2rem] border-[6px] border-black shadow-2xl overflow-hidden h-[92dvh] flex flex-col">
        {/* Top bar */}
        <div className="bg-black text-white p-3 flex justify-between items-center border-b-4 border-gray-800 shrink-0">
          <div className="flex gap-1">
            {[...Array(3)].map((_, i) => (
              <Zap key={i} size={18} className={i < lives ? "text-yellow-300 fill-yellow-300" : "text-gray-700"} />
            ))}
          </div>
          <div className="font-mono font-bold text-yellow-300">SCORE: {score}</div>
        </div>

        {/* Header / controls */}
        <div className="bg-slate-100 p-4 text-center border-b-4 border-black shrink-0 space-y-2">
          <div className={`inline-block border-2 border-black px-4 py-2 rounded-full text-sm font-black max-w-[92%] ${level?.banter?.length===2 ? "bg-transparent border-transparent px-0 py-0" : (level?.speaker==="gigetta" ? "bg-purple-100" : "bg-white")}`}>
            {level?.banter?.length === 2 ? (
                <div className="flex flex-col gap-2 items-center">
                  <div className="inline-block bg-white border-2 border-black px-4 py-2 rounded-full text-sm font-black max-w-[92%]">
                    {"Gigetto: " + level.banter[0].text}
                  </div>
                  <div className="inline-block bg-purple-100 border-2 border-black px-4 py-2 rounded-full text-sm font-black max-w-[92%]">
                    {"Gigetta: " + level.banter[1].text}
                  </div>
                </div>
              ) : (
                (level?.speaker === "gigetta" ? "Gigetta" : "Gigetto") + ": " + gigetto
              )}
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            <Pill active={difficulty==="easy"} onClick={()=>setDifficulty("easy")}>EASY</Pill>
            <Pill active={difficulty==="normal"} onClick={()=>setDifficulty("normal")}>NORMAL</Pill>
            <Pill active={difficulty==="hard"} onClick={()=>setDifficulty("hard")}>HARD</Pill>
            <span className="mx-1 opacity-40 font-black">|</span>
            <Pill active={lang==="it"} onClick={()=>setLang("it")}>IT</Pill>
            <Pill active={lang==="en"} onClick={()=>setLang("en")}>EN</Pill>
            <span className="mx-1 opacity-40 font-black">|</span>
            <Pill active={mood==="soft"} onClick={()=>setMood("soft")}>SOFT</Pill>
            <Pill active={mood==="medium"} onClick={()=>setMood("medium")}>MEDIUM</Pill>
            <Pill active={mood==="savage"} onClick={()=>setMood("savage")}>SAVAGE</Pill>
            <span className="mx-1 opacity-40 font-black">|</span>
            <Pill active={topic==="mixed"} onClick={()=>setTopic("mixed")}>MIXED</Pill>
            <Pill active={topic==="tech"} onClick={()=>setTopic("tech")}>TECH</Pill>
            <Pill active={topic==="general"} onClick={()=>setTopic("general")}>GENERAL</Pill>
            <Pill active={topic==="kids"} onClick={()=>setTopic("kids")}>KIDS</Pill>
            <span className="mx-1 opacity-40 font-black">|</span>
            <Pill active={speakerMode==="auto"} onClick={()=>setSpeakerMode("auto")}>AUTO</Pill>
            <Pill active={speakerMode==="gigetto"} onClick={()=>setSpeakerMode("gigetto")}>GIGETTO</Pill>
            <Pill active={speakerMode==="gigetta"} onClick={()=>setSpeakerMode("gigetta")}>GIGETTA</Pill>
            <Pill active={speakerMode==="duel"} onClick={()=>setSpeakerMode("duel")}>DUEL</Pill>
          </div>
        </div>

        <div className="flex-grow bg-white p-4 overflow-y-auto">
          {state === "home" && (
            <div className="space-y-4">
<div className="mb-4 grid grid-cols-4 gap-2 text-[10px]">
  <div className="border-2 border-black rounded-xl p-2 font-black text-center">
    W<br/><span className="text-base">{wins}</span>
  </div>
  <div className="border-2 border-black rounded-xl p-2 font-black text-center">
    L<br/><span className="text-base">{losses}</span>
  </div>
  <div className="border-2 border-black rounded-xl p-2 font-black text-center">
    STREAK<br/><span className="text-base">{streak}</span>
  </div>
  <div className="border-2 border-black rounded-xl p-2 font-black text-center">
    MODE<br/><span className="text-base">{difficulty.toUpperCase()}</span>
  </div>
</div>
              <div className="text-center">
                <h1 className="text-4xl font-black italic">GIGETTO ULTRA</h1>
                <p className="text-xs font-bold bg-black text-white inline-block px-2 py-1 rounded">
                  “Un milione di minigiochi” (quasi) • Gemini Flash
                </p>
              </div>

              <button
                onClick={load}
                className="w-full px-4 py-4 bg-pink-500 text-white font-black rounded-2xl border-4 border-black flex items-center justify-center gap-2"
              >
                GIOCA ORA <Play size={18} />
              </button>

              <button
                onClick={resetKPI}
                className="w-full px-4 py-3 bg-white text-black font-black rounded-2xl border-4 border-black"
              >
                RESET KPI
              </button>

              <div className="text-xs text-center opacity-70">
                Nota: la varietà è “infinita” perché Gemini genera contenuti nuovi ogni volta. Back-end con cache + anti-ripetizione + rate limit soft. Niente chiavi nel repo: usa ENV su Vercel.
              </div>
            </div>
          )}

          {state === "loading" && <Loading />}

          {state === "playing" && level && (
            <div>
              {(level.type === "quiz_mcq" || level.type === "quiz_math") && <QuizMCQ level={level} onWin={win} onLose={lose} />}
              {level.type === "quiz_tf" && <QuizTF level={level} onWin={win} onLose={lose} />}
              {level.type === "quiz_fill" && <QuizFill level={level} onWin={win} onLose={lose} />}
              {level.type === "quiz_order" && <QuizOrder level={level} onWin={win} onLose={lose} />}
              {level.type === "reflex_move" && <ReflexMove level={level} onWin={win} onLose={lose} difficulty={difficulty} />}
              {level.type === "avoid_bomb" && <AvoidBomb level={level} onWin={win} onLose={lose} difficulty={difficulty} />}
              {level.type === "tap_sprint" && <TapSprint level={level} onWin={win} onLose={lose} difficulty={difficulty} />}
              {level.type === "memory_pair" && <MemoryPair level={level} onWin={win} onLose={lose} difficulty={difficulty} />}
              {level.type === "joke_break" && <JokeBreak level={level} onWin={win} />}

              <details className="mt-4 text-xs">
                <summary className="cursor-pointer font-bold">Debug JSON</summary>
                <pre className="whitespace-pre-wrap">{JSON.stringify(level, null, 2)}</pre>
              </details>
            </div>
          )}

          {state === "gameover" && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
              <Skull size={72} className="text-red-500 animate-bounce" />
              <h2 className="text-5xl font-black text-red-600">GAME OVER</h2>
              <p className="font-bold">Score: {score}</p>
              <button
                onClick={reset}
                className="bg-black text-white font-black py-3 px-8 rounded-2xl border-4 border-transparent hover:border-yellow-300"
              >
                RICOMINCIA
              </button>
            </div>
          )}
        </div>

        <div className="bg-yellow-400 h-7 border-t-4 border-black overflow-hidden flex items-center shrink-0">
          <div className="whitespace-nowrap animate-marquee text-[10px] font-mono font-black uppercase px-2">
            +++ più quiz +++ più minigiochi +++ più caos +++ Gigetto approva +++
          </div>
        </div>

        <style>{`
          @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-100%); } }
          .animate-marquee { animation: marquee 10s linear infinite; }
        `}</style>
      </div>
    </div>
  );
}
