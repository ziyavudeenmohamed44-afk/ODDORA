import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight, Sparkles, Zap, WandSparkles, Dice5, Menu,
  X, Search, Share2, ChevronRight, RotateCcw, Sun, Moon, Bot, Users, Send
} from "lucide-react";
import { database, signInPlayer } from "./firebase";
import { get, onValue, push, ref, runTransaction, set } from "firebase/database";

const experiences = [
  { id:"hacker", title:"Fake Hacker", category:"OD PRANKS", icon:"🖥️", tag:"Cinematic prank", description:"A dramatic fake terminal scan with a ridiculous reveal.", color:"purple", type:"prank" },
  { id:"update", title:"Fake Software Update", category:"OD PRANKS", icon:"📲", tag:"99% suspense", description:"A suspiciously dramatic update with a silly ending.", color:"blue", type:"prank" },
  { id:"virus", title:"Virus Scanner", category:"OD PRANKS", icon:"🦠", tag:"Harmless scan", description:"Scan your digital habits. Discover your scrolling virus.", color:"green", type:"prank" },
  { id:"button", title:"Don't Touch the Button", category:"OD PRANKS", icon:"🔴", tag:"Tap at your own risk", description:"Every tap triggers a new ridiculous reaction.", color:"pink", type:"prank" },
  { id:"iq", title:"Fake IQ Test", category:"OD PRANKS", icon:"🧠", tag:"Unofficial score", description:"Answer a few silly questions and get a very unofficial IQ result.", color:"gold", type:"prank" },
  { id:"mind", title:"Mind Reader", category:"OD MIND", icon:"🔮", tag:"A little magic", description:"Think of a number. Follow the steps. Prepare to be amazed.", color:"orange", type:"game" },
  { id:"xo", title:"XO Multiplayer & AI", category:"OD GAMES", icon:"❎", tag:"Solo AI or Friend", description:"Challenge the witty ODDORA Bot solo or invite a friend live.", color:"blue", type:"game" },
  { id:"catch-heart", title:"Catch My Heart", category:"OD GAMES", icon:"💘", tag:"Solo AI or Friend", description:"Match hearts against ODDORA AI or play live with a friend.", color:"pink", type:"game" },
  { id:"personality", title:"Your Secret Superpower", category:"OD MIND", icon:"🦸", tag:"Quick personality quiz", description:"Discover the completely unofficial power you possess.", color:"green", type:"game" },
  { id:"whatif", title:"What If You Had ₹100 Crore?", category:"OD FUN", icon:"💸", tag:"3-choice simulator", description:"Make three choices and see what kind of billionaire you become.", color:"gold", type:"whatif" },
  { id:"award", title:"Ridiculous Award", category:"OD FUN", icon:"🏆", tag:"Instant certificate", description:"Receive an award you absolutely did not ask for.", color:"pink", type:"random" },
  { id:"surprise", title:"Surprise Me", category:"OD FUN", icon:"🎲", tag:"Random experience", description:"No plan. No warning. Just a little chaos.", color:"purple", type:"random" }
];

const categories = ["All", "OD GAMES", "OD CREATE", "OD PRANKS", "OD MIND", "OD FUN"];

const randomResults = [
  "You have been promoted to Chief Nap Officer. Your first assignment: do absolutely nothing.",
  "Breaking news: Local human successfully opened 14 browser tabs and forgot why.",
  "Your hidden talent is making plans and then enthusiastically cancelling them.",
  "A committee of penguins has reviewed your vibe. They have concerns. And respect.",
  "Achievement unlocked: Professional Overthinker — 12,000 imaginary scenarios completed."
];

const mindPuzzles = [
  {
    id: "number-trap", title: "The Number Trap", icon: "🔢",
    intro: "Think of any number. Keep it secret.",
    instructions: ["Double your original number.", "Add 10 to your result.", "Divide the result by 2.", "Finally, subtract your original number."],
    answer: "5", reveal: "No matter which number you started with, your answer is 5!",
    explanation: "Let your number be X. (2X + 10) / 2 - X simplifies to 5. That's the mathematical secret!",
    type: "steps"
  },
  {
    id: "magic-9", title: "The Magic 9", icon: "9️⃣",
    intro: "Think of any positive whole number.",
    instructions: ["Multiply your number by 9.", "Add all the digits of your answer.", "If you get a two-digit number, add those digits again.", "Keep going until you get a single digit."],
    answer: "9", reveal: "Your final answer is 9!",
    explanation: "Every positive multiple of 9 has digits that eventually add up to 9.",
    type: "steps"
  },
  {
    id: "age-predictor", title: "The Age Predictor", icon: "🎯",
    intro: "Think of your current age between 1 and 99.",
    instructions: ["Double your age.", "Add 5 to the result.", "Multiply everything by 50.", "Now subtract 250."],
    answer: "Your age", reveal: "ODDORA decoded your age from your final number!",
    explanation: "The calculation simplifies to your original age multiplied by 100. Enter that final number and ODDORA divides it by 100 to reveal your age.",
    type: "agecode"
  },
  {
    id: "birthday-mystery", title: "The Birthday Mystery", icon: "🎂",
    intro: "Think of your birth month as a number (January = 1) and your birthday date.",
    instructions: ["Multiply your birth month by 5.", "Add 6.", "Multiply the result by 4.", "Add 9.", "Multiply everything by 5.", "Now add your birthday date and subtract 165."],
    answer: "Your birthday", reveal: "ODDORA decoded your birthday from your final number!",
    explanation: "The result is a code in MMDD format. For example, 1107 means November 7. For January 7, the result is 107.",
    type: "birthdaycode"
  },
  {
    id: "1089-mystery", title: "The 1089 Mystery", icon: "🔮",
    intro: "Think of a three-digit number. Its first and last digits must differ by at least 2.",
    instructions: ["Reverse the digits of your number.", "Subtract the smaller number from the larger number.", "Reverse the answer. If it has two digits, put a zero in front.", "Add the reversed answer to your subtraction result."],
    answer: "1089", reveal: "Your answer is 1089!",
    explanation: "Under the stated conditions, this classic number trick always produces 1089.",
    type: "steps"
  },
  {
    id: "birth-year", title: "Birth Year Decoder", icon: "🎂",
    intro: "Let's discover your birth year.",
    answer: "Your birth year",
    explanation: "ODDORA uses your age and whether your birthday has happened this year to calculate your likely birth year.",
    type: "birthyear"
  },
  {
    id: "weekday", title: "Birthday Weekday Finder", icon: "📅",
    intro: "Discover which day of the week you were born.",
    answer: "Your birthday weekday",
    explanation: "ODDORA calculates the weekday from the birth date you enter.",
    type: "weekday"
  }
];

const whatIfQuestions = [
  {
    step: "CHOICE 01 / FIRST PURCHASE",
    question: "₹100 Crore just landed in your bank account. What is your first move?",
    options: [
      { label: "Buy a private island with zero Wi-Fi 🏝️", score: "chill" },
      { label: "Launch a chaotic startup on Mars 🚀", score: "visionary" },
      { label: "Order every item in my online cart 🛍️", score: "chaotic" },
      { label: "Keep it secret and still ask for extra ketchup 🤫", score: "stealth" }
    ]
  },
  {
    step: "CHOICE 02 / DAILY ROUTINE",
    question: "How does your average Tuesday look now?",
    options: [
      { label: "Waking up at 2 PM with zero alarms 🛌", score: "chill" },
      { label: "Hiring a personal chef just for midnight snacks 🍕", score: "chaotic" },
      { label: "Buying my old school and cancelling Mondays 📅", score: "visionary" },
      { label: "Taking public transport just for the plot 🚌", score: "stealth" }
    ]
  },
  {
    step: "CHOICE 03 / SIGNATURE FLEX",
    question: "What becomes your legendary billionaire habit?",
    options: [
      { label: "Tipping delivery riders the price of a scooter 🛵", score: "visionary" },
      { label: "Building a secret underground gaming bunker 🎮", score: "chaotic" },
      { label: "Disappearing to the mountains for 6 months 🏔️", score: "chill" },
      { label: "Still splitting a ₹200 bill down to the rupee 🧾", score: "stealth" }
    ]
  }
];

const whatIfOutcomes = {
  chill: "The Zen Couch Emperor 🛌 — You turned ₹100 Crore into a lifetime subscription to peace, naps, and never answering 'Are you free this weekend?'",
  visionary: "The Chaotic Philanthropist 🚀 — You banned Mondays, funded weird inventions, and accidentally became a folklore legend.",
  chaotic: "The Midnight Impulse Mogul 🍕 — Your mansion has a slide instead of stairs, 400 unopened gadgets, and zero regrets.",
  stealth: "The Undercover Billionaire 🤫 — Nobody knows you're rich because you still argue over ₹10 delivery fees while owning the building."
};

const defaultVibes = [
  { id: "seed-1", name: "Aarav", mood: "😂", text: "Sent the Fake Hacker link to my roommate and watched him unplug the Wi-Fi router!", createdAt: Date.now() - 3600000 },
  { id: "seed-2", name: "Maya", mood: "🔮", text: "The 1089 Mind Reader genuinely broke my brain at 1 AM.", createdAt: Date.now() - 7200000 },
  { id: "seed-3", name: "Dev", mood: "💘", text: "Beat the ODDORA AI in Catch My Heart in 3 picks. Certified telepathy.", createdAt: Date.now() - 10800000 }
];

function enterDeviceFullscreen() {
  try {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    } else if (!document.webkitFullscreenElement && el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    }
  } catch {}
}

function exitDeviceFullscreen() {
  try {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    } else if (document.webkitFullscreenElement && document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  } catch {}
}

function triggerHaptic(pattern = 15) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch {}
}

async function shareODDORAResultCard({ game, headline, subtitle, detail, quote, url }) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable");

  const bg = ctx.createLinearGradient(0, 0, 1080, 1350);
  bg.addColorStop(0, "#211936");
  bg.addColorStop(1, "#090812");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1080, 1350);

  const glow = ctx.createRadialGradient(540, 360, 30, 540, 360, 560);
  glow.addColorStop(0, "rgba(145, 86, 255, .34)");
  glow.addColorStop(1, "rgba(145, 86, 255, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1080, 900);

  ctx.strokeStyle = "rgba(190, 145, 255, .48)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(48, 48, 984, 1254, 42);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = "#c5a4ff";
  ctx.font = "700 30px Arial";
  ctx.fillText("ODDORA", 540, 145);
  ctx.fillStyle = "#9d91b5";
  ctx.font = "700 20px Arial";
  ctx.fillText(game.toUpperCase(), 540, 215);

  ctx.fillStyle = "#ffffff";
  ctx.font = "800 66px Arial";
  const headlineWords = String(headline || "").split(" ");
  let lines = [""];
  for (const word of headlineWords) {
    const candidate = `${lines[lines.length - 1]} ${word}`.trim();
    if (ctx.measureText(candidate).width > 850) lines.push(word);
    else lines[lines.length - 1] = candidate;
  }
  let y = 390 - (lines.length - 1) * 42;
  for (const line of lines) {
    ctx.fillText(line, 540, y);
    y += 88;
  }

  ctx.fillStyle = "#d5cce6";
  const drawWrapped = (text, startY, maxWidth, lineHeight, font) => {
    ctx.font = font;
    const words = String(text || "").split(" ");
    let line = "";
    let yy = startY;
    for (const word of words) {
      const test = `${line} ${word}`.trim();
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, 540, yy);
        line = word;
        yy += lineHeight;
      } else line = test;
    }
    if (line) ctx.fillText(line, 540, yy);
    return yy;
  };
  let textY = drawWrapped(subtitle, y + 30, 850, 52, "500 34px Arial");

  if (detail) {
    const cardY = Math.max(textY + 80, 690);
    const cardGrad = ctx.createLinearGradient(120, cardY, 960, cardY + 210);
    cardGrad.addColorStop(0, "rgba(151, 83, 221, .30)");
    cardGrad.addColorStop(1, "rgba(225, 95, 182, .16)");
    ctx.fillStyle = cardGrad;
    ctx.strokeStyle = "rgba(218, 135, 226, .45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(120, cardY, 840, 210, 28);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#f3a7db";
    ctx.font = "800 54px Arial";
    ctx.fillText(detail, 540, cardY + 115);
    textY = cardY + 210;
  }

  if (quote) {
    ctx.fillStyle = "#ead7f0";
    drawWrapped(`“${quote}”`, Math.max(textY + 105, 1010), 820, 48, "600 30px Arial");
  }

  ctx.fillStyle = "#b7a8d0";
  ctx.font = "600 24px Arial";
  ctx.fillText("PLAY. CREATE. DISCOVER.", 540, 1210);
  ctx.fillStyle = "#8f82a8";
  ctx.font = "500 22px Arial";
  ctx.fillText("Play your own challenge:", 540, 1255);
  ctx.fillStyle = "#c6a5ff";
  ctx.font = "700 25px Arial";
  ctx.fillText(new URL(url).host, 540, 1290);

  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Could not create the result image");
  return new File([blob], "oddora-result.png", { type: "image/png" });
}

function App() {
  const [active, setActive] = useState("All");
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("oddora-theme") === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });
  const [copied, setCopied] = useState(false);
  const [sharedPrank, setSharedPrank] = useState(null);
  const [xoInviteCode, setXoInviteCode] = useState("");
  const [heartInviteCode, setHeartInviteCode] = useState("");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("oddora-theme", theme);
    } catch {}
  }, [theme]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const prankId = params.get("prank");
    const xoCode = (params.get("xo") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    const heartCode = (params.get("heart") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

    if (xoCode.length === 6) {
      const xoGame = experiences.find(item => item.id === "xo");
      if (xoGame) {
        setSelected(xoGame);
        setXoInviteCode(xoCode);
        if (params.has("heart")) {
          params.delete("heart");
          const cleanUrl = new URL(window.location.href);
          cleanUrl.search = params.toString();
          window.history.replaceState({}, "", cleanUrl.toString());
        }
      }
    } else if (heartCode.length === 6) {
      const heartGame = experiences.find(item => item.id === "catch-heart");
      if (heartGame) {
        setSelected(heartGame);
        setHeartInviteCode(heartCode);
      }
    }

    const mode = params.get("mode");
    const sender = params.get("from");
    if (mode !== "friend" || !prankId) return;

    const prank = experiences.find(
      item => item.id === prankId && item.category === "OD PRANKS"
    );
    if (!prank) return;

    setSelected(prank);
    setSharedPrank({
      mode: "friend",
      sender: (sender || "Your friend").slice(0, 30),
      autoStart: true
    });
  }, []);

  const filtered = useMemo(() => experiences.filter(item =>
    (active === "All" || item.category === active) &&
    (item.title + item.description + item.category).toLowerCase().includes(search.toLowerCase())
  ), [active, search]);

  function openExperience(item) {
    triggerHaptic(12);
    setSelected(item);
    setSharedPrank(null);
    setCopied(false);
  }

  function surpriseMe() {
    const item = experiences[Math.floor(Math.random() * experiences.length)];
    openExperience(item);
  }

  function goToCategory(category) {
    setActive(category);
    setSearch("");
    setMenuOpen(false);
    setSelected(null);
    document.getElementById("explore")?.scrollIntoView({ behavior: "smooth" });
  }

  async function shareResult(text) {
    const shareText = `${text}\nTry ODDORA — Your Playground. Your Challenges!`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "ODDORA",
          text: shareText,
          url: window.location.href
        });
      } catch {}
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" onClick={() => setSelected(null)} aria-label="ODDORA home">
          <span className="brand-mark">O</span>
          <span>ODDORA<span className="brand-dot">.</span></span>
        </a>

        <nav className={menuOpen ? "nav-links open" : "nav-links"} aria-label="Main navigation">
          <a href="#home" onClick={() => { setMenuOpen(false); setActive("All"); setSelected(null); }}>Home</a>
          <button type="button" onClick={() => goToCategory("OD GAMES")}>OD Games</button>
          <button type="button" onClick={() => goToCategory("OD CREATE")}>OD Create</button>
          <button type="button" onClick={() => goToCategory("OD PRANKS")}>OD Pranks</button>
          <button type="button" onClick={() => goToCategory("OD MIND")}>OD Mind</button>
          <button type="button" onClick={() => goToCategory("OD FUN")}>OD Fun</button>
        </nav>

        <div className="top-actions">
          <button
            className="language-btn"
            onClick={() => {
              triggerHaptic(10);
              setTheme(prev => (prev === "dark" ? "light" : "dark"));
            }}
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label="Toggle color theme"
          >
            {theme === "dark" ? <Sun size={15}/> : <Moon size={15}/>}
            <span>{theme === "dark" ? "LIGHT" : "DARK"}</span>
          </button>
          <button className="menu-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
            {menuOpen ? <X/> : <Menu/>}
          </button>
        </div>
      </header>

      <main id="home">
        <section className="hero">
          <div className="hero-content">
            <div className="eyebrow"><span className="pulse"></span> PLAY. CREATE. DISCOVER.</div>
            <h1>The internet's<br/><span className="gradient-text">playground.</span></h1>
            <p className="hero-copy">
              Play games. Create challenges. Discover harmless chaos.<br className="desktop-break"/>
              Your playground. Your challenges.
            </p>

            <div className="hero-actions">
              <a className="primary-btn" href="#explore">Explore the weird <ArrowUpRight size={18}/></a>
              <button className="secondary-btn" onClick={surpriseMe}><Dice5 size={17}/> Surprise me</button>
            </div>

            <div className="hero-note"><Sparkles size={14}/> Free to explore · Solo or with friends · No sign-up</div>
          </div>

          <div className="hero-art" aria-label="Abstract glowing ODDORA portal illustration">
            <div className="orbit orbit-a"></div>
            <div className="orbit orbit-b"></div>
            <div className="portal"><div className="portal-inner"><span>O</span></div></div>
            <div className="float-card card-top"><span>✨</span> Reality optional</div>
            <div className="float-card card-bottom"><span>🎲</span> Expect the unexpected</div>
            <div className="spark spark-a">✦</div>
            <div className="spark spark-b">✧</div>
          </div>
        </section>

        <section className="ticker" aria-label="ODDORA highlights">
          <div className="ticker-track" aria-hidden="true">
            <span>NO BORING MOMENTS <b>✳</b> IMPOSSIBLE IS A STARTING POINT <b>✳</b> PLAY NICE, PLAY WEIRD <b>✳</b> </span>
            <span>NO BORING MOMENTS <b>✳</b> IMPOSSIBLE IS A STARTING POINT <b>✳</b> PLAY NICE, PLAY WEIRD <b>✳</b> </span>
            <span>NO BORING MOMENTS <b>✳</b> IMPOSSIBLE IS A STARTING POINT <b>✳</b> PLAY NICE, PLAY WEIRD <b>✳</b> </span>
            <span>NO BORING MOMENTS <b>✳</b> IMPOSSIBLE IS A STARTING POINT <b>✳</b> PLAY NICE, PLAY WEIRD <b>✳</b> </span>
          </div>
        </section>

        <section className="section zones-section" id="zones">
          <div className="section-heading">
            <div>
              <div className="eyebrow muted">PICK YOUR KIND OF CHAOS</div>
              <h2>Enter a <span className="gradient-text">play zone.</span></h2>
            </div>
            <p>Different doors. Different kinds of fun.<br/>Which one are you opening?</p>
          </div>

          <div className="zone-grid">
            <button className="zone-card zone-blue" onClick={() => goToCategory("OD GAMES")}>
              <span className="zone-icon">🎮</span>
              <span className="zone-number">01 / PLAY</span>
              <strong>OD GAMES</strong>
              <span className="zone-desc">Play solo against AI or challenge friends live.</span>
              <ArrowUpRight className="zone-arrow"/>
            </button>
            <button className="zone-card zone-purple" onClick={() => goToCategory("OD CREATE")}>
              <span className="zone-icon">✨</span>
              <span className="zone-number">02 / CREATE</span>
              <strong>OD CREATE</strong>
              <span className="zone-desc">Build your own invites, proposals and challenges.</span>
              <ArrowUpRight className="zone-arrow"/>
            </button>
            <button className="zone-card zone-pink" onClick={() => goToCategory("OD PRANKS")}>
              <span className="zone-icon">🃏</span>
              <span className="zone-number">03 / SURPRISE</span>
              <strong>OD PRANKS</strong>
              <span className="zone-desc">Harmless chaos. Unexpected reveals.</span>
              <ArrowUpRight className="zone-arrow"/>
            </button>
            <button className="zone-card zone-orange" onClick={() => goToCategory("OD MIND")}>
              <span className="zone-icon">🧠</span>
              <span className="zone-number">04 / THINK</span>
              <strong>OD MIND</strong>
              <span className="zone-desc">Mind tricks, puzzles and brain teasers.</span>
              <ArrowUpRight className="zone-arrow"/>
            </button>
            <button className="zone-card zone-purple" onClick={() => goToCategory("OD FUN")}>
              <span className="zone-icon">🎲</span>
              <span className="zone-number">05 / EXPLORE</span>
              <strong>OD FUN</strong>
              <span className="zone-desc">What ifs, random chaos and silly surprises.</span>
              <ArrowUpRight className="zone-arrow"/>
            </button>
          </div>
        </section>

        <section className="section explore-section" id="explore">
          <div className="section-heading explore-heading">
            <div>
              <div className="eyebrow muted">THE FUN STARTS HERE</div>
              <h2>Find your <span className="gradient-text">next obsession.</span></h2>
            </div>
            <div className="search-wrap">
              <Search size={17}/>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search experiences..." aria-label="Search experiences"/>
            </div>
          </div>

          <div className="filter-row">
            {categories.map(category => (
              <button key={category} className={active === category ? "filter-chip active" : "filter-chip"} onClick={() => setActive(category)}>
                {category}
              </button>
            ))}
          </div>

          <div className="experience-grid">
            {filtered.map((item, index) => (
              <ExperienceCard key={item.id} item={item} index={index} onClick={() => openExperience(item)}/>
            ))}
            {filtered.length === 0 && (
              <div className="empty-state">
                {active === "OD CREATE"
                  ? "OD CREATE is coming next. Soon, you will be able to build and share your own invitations, proposals and challenges. ✨"
                  : "No weirdness found. Try another search. 👀"}
              </div>
            )}
          </div>
        </section>

        <VibeWall />

        <section className="surprise-banner">
          <div className="banner-orb">?</div>
          <div>
            <div className="eyebrow">CAN'T DECIDE?</div>
            <h2>Let chaos <span className="gradient-text">choose.</span></h2>
            <p>One click. One random experience. Zero expectations.</p>
          </div>
          <button className="primary-btn" onClick={surpriseMe}>Surprise me <Dice5 size={18}/></button>
        </section>

        <section className="section about-section" id="about">
          <div className="about-icon"><WandSparkles size={26}/></div>
          <div>
            <div className="eyebrow muted">A LITTLE DIFFERENT BY DESIGN</div>
            <h2>Ordinary is <span className="gradient-text">overrated.</span></h2>
            <p>ODDORA is a playful corner of the internet for harmless pranks, curious minds and impossible ideas. No pressure. No sign-up. Just explore.</p>
          </div>
        </section>
      </main>

      <footer className="footer">
        <a className="brand" href="#"><span className="brand-mark">O</span><span>ODDORA<span className="brand-dot">.</span></span></a>
        <span>Enter ordinary. Leave extraordinary.</span>
        <span>© {new Date().getFullYear()} ODDORA · Made for fun.</span>
      </footer>

      {selected && (
        <ExperienceModal
          item={selected}
          onClose={() => {
            setSelected(null);
            setSharedPrank(null);
            setXoInviteCode("");
            setHeartInviteCode("");
            window.history.replaceState({}, "", window.location.pathname);
          }}
          onShare={shareResult}
          copied={copied}
          sharedPrank={sharedPrank}
          xoInviteCode={xoInviteCode}
          heartInviteCode={heartInviteCode}
          onExplore={() => {
            setSelected(null);
            setXoInviteCode("");
            setHeartInviteCode("");
            setSharedPrank(null);
            setActive("All");
            window.history.replaceState({}, "", window.location.pathname);
            window.setTimeout(() => {
              document.getElementById("explore")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 180);
          }}
          onCreateChallenge={() => {
            setSelected(null);
            setXoInviteCode("");
            setHeartInviteCode("");
            setSharedPrank(null);
            setActive("OD CREATE");
            window.history.replaceState({}, "", window.location.pathname);
            window.setTimeout(() => {
              document.getElementById("explore")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 180);
          }}
          onBackToGames={() => {
            setSelected(null);
            setActive("OD GAMES");
            setTimeout(() => document.getElementById("explore")?.scrollIntoView({ behavior: "smooth" }), 80);
          }}
        />
      )}
    </div>
  );
}

function VibeWall() {
  const [vibes, setVibes] = useState(defaultVibes);
  const [name, setName] = useState("");
  const [mood, setMood] = useState("😂");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    const vibesRef = ref(database, "vibes");
    const unsubscribe = onValue(
      vibesRef,
      snapshot => {
        if (!snapshot.exists()) return;
        const raw = snapshot.val();
        const list = Object.entries(raw)
          .map(([id, item]) => ({ id, ...item }))
          .filter(item => item && item.text && item.name)
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
          .slice(0, 6);
        if (list.length > 0) setVibes(list);
      },
      () => {}
    );
    return () => unsubscribe();
  }, []);

  async function submitVibe(e) {
    e.preventDefault();
    const cleanText = text.trim().replace(/\s+/g, " ").slice(0, 140);
    const cleanName = (name.trim().replace(/\s+/g, " ") || "Anonymous Explorer").slice(0, 20);
    if (!cleanText || sending) return;

    setSending(true);
    setStatusMsg("");
    triggerHaptic(15);

    const entry = {
      name: cleanName,
      mood,
      text: cleanText,
      createdAt: Date.now()
    };

    try {
      await signInPlayer();
      await push(ref(database, "vibes"), entry);
      setText("");
      setStatusMsg("Vibe posted to the wall! ✨");
    } catch {
      setVibes(prev => [{ id: `local-${Date.now()}`, ...entry }, ...prev].slice(0, 6));
      setText("");
      setStatusMsg("Added to your session wall! ✨");
    } finally {
      setSending(false);
      setTimeout(() => setStatusMsg(""), 2500);
    }
  }

  return (
    <section className="section vibe-section" id="vibes">
      <div className="section-heading">
        <div>
          <div className="eyebrow muted">LIVE CHAOS WALL</div>
          <h2>Visitor <span className="gradient-text">vibe check.</span></h2>
        </div>
        <p>Drop a quick reaction after pranking a friend<br/>or beating the ODDORA AI.</p>
      </div>

      <form className="vibe-form" onSubmit={submitVibe}>
        <div className="vibe-moods" role="group" aria-label="Choose mood">
          {["😂", "🤯", "💘", "😈", "🔥"].map(m => (
            <button
              type="button"
              key={m}
              className={mood === m ? "vibe-mood active" : "vibe-mood"}
              onClick={() => setMood(m)}
            >
              {m}
            </button>
          ))}
        </div>
        <input
          className="vibe-name-input"
          value={name}
          onChange={e => setName(e.target.value.slice(0, 20))}
          placeholder="Your name (optional)"
          maxLength={20}
        />
        <input
          className="vibe-text-input"
          value={text}
          onChange={e => setText(e.target.value.slice(0, 140))}
          placeholder="How did your prank or game go? (140 chars)"
          maxLength={140}
        />
        <button className="primary-btn" type="submit" disabled={!text.trim() || sending}>
          <Send size={15}/> {sending ? "Posting..." : "Post vibe"}
        </button>
      </form>
      {statusMsg && <p className="vibe-status">{statusMsg}</p>}

      <div className="vibe-grid">
        {vibes.map(item => (
          <div className="vibe-card" key={item.id}>
            <div className="vibe-card-top">
              <span className="vibe-emoji">{item.mood || "✨"}</span>
              <strong>{item.name}</strong>
              <span className="vibe-badge">VERIFIED CHAOS</span>
            </div>
            <p>“{item.text}”</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ExperienceCard({ item, index, onClick }) {
  return (
    <button className={`experience-card ${item.color}`} onClick={onClick} style={{"--delay": `${index * 55}ms`}}>
      <div className="experience-card-top">
        <span className="experience-emoji">{item.icon}</span>
        <span className="card-open"><ArrowUpRight size={17}/></span>
      </div>
      <span className="card-category">{item.category}</span>
      <strong>{item.title}</strong>
      <p>{item.description}</p>
      <span className="card-tag"><span></span>{item.tag}</span>
    </button>
  );
}

function ExperienceModal({ item, onClose, onShare, copied, sharedPrank, xoInviteCode, heartInviteCode, onExplore, onCreateChallenge, onBackToGames }) {
  const [step, setStep] = useState(item.id === "xo" && xoInviteCode ? 13 : item.id === "catch-heart" && heartInviteCode ? 14 : 0);
  const [prankMode, setPrankMode] = useState(sharedPrank?.mode === "friend" ? "friend" : "self");
  const [senderName, setSenderName] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [choice, setChoice] = useState("");
  const [whatIfStep, setWhatIfStep] = useState(0);
  const [whatIfScores, setWhatIfScores] = useState([]);
  const [mindPuzzleIndex, setMindPuzzleIndex] = useState(0);
  const [mindInstructionIndex, setMindInstructionIndex] = useState(0);
  const [result, setResult] = useState("");
  const [showMagicPopup, setShowMagicPopup] = useState(false);
  const [birthAge, setBirthAge] = useState("");
  const [birthdayPassed, setBirthdayPassed] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [puzzleCode, setPuzzleCode] = useState("");
  const [error, setError] = useState("");
  const [buttonClicks, setButtonClicks] = useState(0);
  const [iqQuestion, setIqQuestion] = useState(0);
  const [iqAnswers, setIqAnswers] = useState([]);
  const [hackerElapsed, setHackerElapsed] = useState(0);
  const [hackerRunId, setHackerRunId] = useState(0);
  const [updateElapsed, setUpdateElapsed] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioContextRef = useRef(null);
  const soundEnabledRef = useRef(true);
  const lastHackerToneRef = useRef(-1);
  const autoStartedRef = useRef(false);

  async function playSound(kind = "tap") {
    if (!soundEnabledRef.current) return;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      if (!audioContextRef.current) audioContextRef.current = new AudioContextClass();
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") await ctx.resume();

      const patterns = {
        tap: [
          { f: 680, d: 0.06, v: 0.09, w: "triangle" },
          { f: 1020, d: 0.05, v: 0.05, w: "sine", delay: 0.02 }
        ],
        step: [
          { f: 440, d: 0.11, v: 0.11, w: "triangle" },
          { f: 659, d: 0.14, v: 0.10, w: "sine", delay: 0.08 }
        ],
        magic: [
          { f: 523.25, d: 0.18, v: 0.12, w: "sine" },
          { f: 659.25, d: 0.18, v: 0.11, w: "triangle", delay: 0.11 },
          { f: 783.99, d: 0.24, v: 0.12, w: "sine", delay: 0.22 },
          { f: 1046.5, d: 0.34, v: 0.10, w: "sine", delay: 0.33 }
        ],
        reveal: [
          { f: 261.63, d: 0.38, v: 0.12, w: "triangle" },
          { f: 523.25, d: 0.22, v: 0.15, w: "triangle" },
          { f: 659.25, d: 0.24, v: 0.15, w: "triangle", delay: 0.13 },
          { f: 783.99, d: 0.45, v: 0.18, w: "sine", delay: 0.26, slideTo: 1046.5 }
        ],
        wrong: [
          { f: 185, d: 0.24, v: 0.16, w: "sawtooth", slideTo: 130 },
          { f: 146.83, d: 0.32, v: 0.15, w: "sawtooth", delay: 0.18, slideTo: 98 }
        ],
        boot: [
          { f: 65.41, d: 0.85, v: 0.24, w: "sawtooth", slideTo: 130.81 },
          { f: 130.81, d: 0.75, v: 0.18, w: "triangle", delay: 0.15, slideTo: 261.63 },
          { f: 523.25, d: 0.35, v: 0.12, w: "sine", delay: 0.55 }
        ],
        key: [
          { f: 920, d: 0.04, v: 0.07, w: "square" },
          { f: 1380, d: 0.03, v: 0.05, w: "triangle", delay: 0.02 }
        ],
        alert: [
          { f: 440, d: 0.22, v: 0.20, w: "sawtooth", slideTo: 220 },
          { f: 440, d: 0.24, v: 0.20, w: "sawtooth", delay: 0.24, slideTo: 195 },
          { f: 110, d: 0.45, v: 0.18, w: "square", delay: 0.1 }
        ],
        suspense: [
          { f: 98, d: 0.75, v: 0.16, w: "sawtooth" },
          { f: 103.83, d: 0.75, v: 0.14, w: "sine", delay: 0.25 },
          { f: 196, d: 0.55, v: 0.10, w: "triangle", delay: 0.5 }
        ],
      };
      const notes = patterns[kind] || patterns.tap;
      const startAt = ctx.currentTime + 0.015;

      notes.forEach(note => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const at = startAt + (note.delay || 0);
        osc.type = note.w;
        osc.frequency.setValueAtTime(note.f, at);
        if (note.slideTo) {
          osc.frequency.exponentialRampToValueAtTime(note.slideTo, at + note.d);
        }
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.linearRampToValueAtTime(note.v, at + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + note.d);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(at);
        osc.stop(at + note.d + 0.03);
      });
    } catch {}
  }

  function toggleSound() {
    setSoundEnabled(current => {
      const next = !current;
      soundEnabledRef.current = next;
      if (next) playSound("reveal");
      return next;
    });
  }

  useEffect(() => () => {
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (item.id !== "hacker" || step !== 1) return;

    const startedAt = Date.now();
    const timer = setInterval(() => {
      const seconds = Math.min((Date.now() - startedAt) / 1000, 18);
      setHackerElapsed(seconds);

      const wholeSecond = Math.floor(seconds);
      if ([3, 5, 7, 9, 11, 13, 15].includes(wholeSecond) &&
          lastHackerToneRef.current !== wholeSecond) {
        lastHackerToneRef.current = wholeSecond;
        playSound(wholeSecond === 9 || wholeSecond === 13 ? "alert" : "key");
      }

      if (seconds >= 18) {
        clearInterval(timer);
        setResult("SYSTEM BREACHED! 😂 Just kidding. Your biggest vulnerability is opening one more tab when you already have 47 tabs open.");
        setStep(2);
        playSound("reveal");
        triggerHaptic([30, 40, 30]);
      }
    }, 100);

    return () => clearInterval(timer);
  }, [item.id, step, hackerRunId]);

  useEffect(() => {
    if (item.id !== "update" || step !== 9) return;

    const startedAt = Date.now();
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      setUpdateElapsed(elapsed);

      if (elapsed >= 23) {
        clearInterval(timer);
        setResult("Update complete! 😂 Your device is completely safe. This was just an ODDORA prank!");
        setStep(2);
        playSound("reveal");
        triggerHaptic([25, 35, 25]);
      }
    }, 250);

    return () => clearInterval(timer);
  }, [item.id, step]);

  const currentPuzzle = mindPuzzles[mindPuzzleIndex];
  const isCodePuzzle = ["agecode", "birthdaycode"].includes(currentPuzzle.type);
  const prediction = currentPuzzle.type === "steps" ? currentPuzzle.answer : result;

  function resetMind() {
    setMindInstructionIndex(0);
    setBirthAge("");
    setBirthdayPassed("");
    setBirthDate("");
    setPuzzleCode("");
    setResult("");
    setError("");
    setShowMagicPopup(false);
  }

  function choosePuzzle(index) {
    playSound("magic");
    triggerHaptic(12);
    setMindPuzzleIndex(index);
    resetMind();
    setStep(5);
  }

  function chooseRandomPuzzle() {
    let index = Math.floor(Math.random() * mindPuzzles.length);
    if (mindPuzzles.length > 1 && index === mindPuzzleIndex) {
      index = (index + 1) % mindPuzzles.length;
    }
    choosePuzzle(index);
  }

  function runHacker() {
    setHackerElapsed(0);
    lastHackerToneRef.current = -1;
    setResult("");
    setHackerRunId(r => r + 1);
    setStep(1);
    playSound("boot");
    triggerHaptic([20, 30, 40]);
  }

  function getRandomAward() {
    const awards = [
      "World's Most Talented Tab Opener 🏅",
      "Supreme Commander of Snooze Buttons 🏆",
      "International Procrastination Champion 🥇",
      "Certified Professional Daydreamer 🌟",
      "CEO of 'I'll Do It Tomorrow' 👑"
    ];
    playSound("reveal");
    triggerHaptic(20);
    setResult(awards[Math.floor(Math.random() * awards.length)]);
    setStep(2);
  }

  async function createFriendLink() {
    const cleanName = senderName.trim().slice(0, 30);

    if (!cleanName) {
      setLinkError("Enter your name first so your friend knows who pranked them.");
      triggerHaptic([20, 30, 20]);
      return;
    }
    setLinkError("");

    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("prank", item.id);
    url.searchParams.set("mode", "friend");
    url.searchParams.set("from", cleanName);

    const shareUrl = url.toString();

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${cleanName} sent you something`,
          text: `${cleanName} wants you to see this 👀`,
          url: shareUrl
        });
      } else {
        await navigator.clipboard.writeText(`${cleanName} wants you to see this 👀\n${shareUrl}`);
        setLinkCopied(true);
        playSound("reveal");
        setTimeout(() => setLinkCopied(false), 2500);
      }
    } catch (err) {
      if (err?.name !== "AbortError") {
        try {
          await navigator.clipboard.writeText(shareUrl);
          setLinkCopied(true);
          setTimeout(() => setLinkCopied(false), 2500);
        } catch {
          setLinkError("Unable to copy automatically. Please copy the link manually.");
        }
      }
    }
  }

  function startExperience() {
    triggerHaptic(15);
    if (item.category === "OD PRANKS") {
      enterDeviceFullscreen();
    }
    if (item.id === "hacker") return runHacker();
    if (item.id === "update") {
      setUpdateElapsed(0);
      playSound("suspense");
      setStep(9);
      return;
    }
    if (item.id === "virus") {
      playSound("alert");
      return setStep(10);
    }
    if (item.id === "button") {
      setButtonClicks(0);
      playSound("tap");
      return setStep(11);
    }
    if (item.id === "iq") {
      setIqQuestion(0);
      setIqAnswers([]);
      playSound("step");
      return setStep(12);
    }
    if (item.id === "mind") return setStep(0);
    if (item.id === "xo") return setStep(13);
    if (item.id === "catch-heart") return setStep(14);
    if (item.id === "award") return getRandomAward();
    if (item.id === "whatif") {
      setWhatIfStep(0);
      setWhatIfScores([]);
      playSound("step");
      return setStep(15);
    }

    if (item.id === "surprise") {
      playSound("reveal");
      setResult(randomResults[Math.floor(Math.random() * randomResults.length)]);
      return setStep(2);
    }

    if (item.id === "personality") {
      playSound("step");
      return setStep(4);
    }
  }


  useEffect(() => {
    if (sharedPrank?.autoStart && !autoStartedRef.current && item.category === "OD PRANKS") {
      autoStartedRef.current = true;
      startExperience();
    }
  }, [sharedPrank, item.id]);

  useEffect(() => {
    if (item.category !== "OD PRANKS" || step === 0) return undefined;
    const unlockImmersive = () => {
      enterDeviceFullscreen();
      if (audioContextRef.current && audioContextRef.current.state === "suspended") {
        audioContextRef.current.resume().catch(() => {});
      }
    };
    window.addEventListener("pointerdown", unlockImmersive, { once: true });
    return () => window.removeEventListener("pointerdown", unlockImmersive);
  }, [item.category, step]);

  function revealBirthYear() {
    const age = Number(birthAge);
    if (!Number.isInteger(age) || age < 1 || age > 120 || !birthdayPassed) return;

    const today = new Date();
    const year = today.getFullYear() - age - (birthdayPassed === "no" ? 1 : 0);
    setResult(`Your likely birth year is ${year}!`);
    playSound("reveal");
    setStep(6);
  }

  function revealWeekday() {
    if (!birthDate) return;
    const [year, month, day] = birthDate.split("-").map(Number);
    const date = new Date(year, month - 1, day);

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) return;

    const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(date);
    setResult(`You were born on a ${weekday}!`);
    playSound("reveal");
    setStep(6);
  }

  function decodePuzzleCode() {
    const value = Number(puzzleCode);
    if (!Number.isInteger(value) || value <= 0) {
      setError("Please enter a valid number.");
      playSound("wrong");
      return;
    }

    if (currentPuzzle.type === "agecode") {
      if (value % 100 !== 0 || value / 100 < 1 || value / 100 > 120) {
        setError("That number doesn't match the trick. Check your calculation!");
        playSound("wrong");
        return;
      }
      setResult(`Your age is ${value / 100}!`);
      setError("");
      playSound("reveal");
      setStep(6);
      return;
    }

    if (currentPuzzle.type === "birthdaycode") {
      const month = Math.floor(value / 100);
      const day = value % 100;
      const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

      if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) {
        setError("That doesn't look like a valid birthday. Check your calculation!");
        playSound("wrong");
        return;
      }
      setResult(`Your birthday is ${months[month - 1]} ${day}!`);
      setError("");
      playSound("reveal");
      setStep(6);
    }
  }

  function revealMagic() {
    setShowMagicPopup(false);
    playSound("magic");
    setStep(7);
  }

  const fieldStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "13px 14px",
    marginTop: "8px",
    borderRadius: "12px",
    border: "1px solid rgba(190,160,255,.25)",
    background: "var(--input-bg, #100d1b)",
    color: "inherit",
    font: "inherit"
  };

  function sharePrediction() {
    onShare(`${currentPuzzle.title}: ${prediction}\nTry ODDORA!`);
  }

  if (item.id === "hacker" && step >= 1) {
    const phase = hackerElapsed < 3
      ? "boot"
      : hackerElapsed < 8
        ? "connect"
        : hackerElapsed < 13
          ? "intrusion"
          : hackerElapsed < 18
            ? "final"
            : "reveal";

    const terminalMessages = [
      { time: 3, text: "INITIALIZING VIRTUAL ENVIRONMENT...", type: "normal" },
      { time: 4, text: "Establishing encrypted tunnel [SIMULATED]", type: "normal" },
      { time: 5, text: "Connecting to ODDORA mainframe...", type: "normal" },
      { time: 6, text: "Handshake protocol: VERIFIED", type: "success" },
      { time: 7, text: "Loading virtual access modules...", type: "normal" },
      { time: 8, text: "UNUSUAL ACTIVITY DETECTED", type: "warning" },
      { time: 9, text: "Running fictional security diagnostics...", type: "normal" },
      { time: 10, text: "Decrypting imaginary data blocks...", type: "normal" },
      { time: 11, text: "ACCESS LEVEL: MAXIMUM (SIMULATION)", type: "success" },
      { time: 12, text: "Preparing final system report...", type: "normal" }
    ];

    const visibleMessages = terminalMessages.filter(message => hackerElapsed >= message.time);
    const progress = hackerElapsed < 13 ? 0 : Math.min(99, Math.round(((hackerElapsed - 13) / 5) * 99));

    return (
      <div className="hacker-fullscreen">
        <div className="hacker-topbar">
          <div className="hacker-brand"><span>◈</span> ODDORA <small>CYBER LAB</small></div>
          <div className="hacker-top-actions">
            <button onClick={toggleSound}>{soundEnabled ? "🔊 SOUND ON" : "🔇 SOUND OFF"}</button>
            <button onClick={() => { exitDeviceFullscreen(); onClose(); }}>EXIT ✕</button>
          </div>
        </div>

        {step === 2 ? (
          <div className="hacker-main">
            <div className="hacker-reveal-screen">
              <div className="hacker-reveal-icon">😂</div>
              <div className="hacker-kicker">SYSTEM REPORT · ODDORA CLASSIFIED</div>
              {sharedPrank?.mode === "friend" && (
                <p className="hacker-reveal-message">
                  Don't worry! Your friend <strong>{sharedPrank.sender}</strong> pranked you! 😂
                </p>
              )}
              <h1>YOU GOT <span>HACKED.</span></h1>
              <p className="hacker-reveal-message">{result}</p>
              <div className="hacker-stamp">100% HARMLESS PRANK</div>
              <div className="hacker-reveal-actions">
                <button className="hacker-launch-again" onClick={runHacker}>↻ RUN IT AGAIN</button>
                <button className="hacker-exit" onClick={() => { exitDeviceFullscreen(); onClose(); }}>BACK TO ODDORA</button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="hacker-status-row">
              <span><i className="hacker-live-dot"></i> LIVE SIMULATION</span>
              <span>SESSION: OD-{Math.floor(Date.now() / 1000).toString().slice(-6)}</span>
              <span>SECURE MODE: ON</span>
            </div>

            <div className="hacker-main">
              {phase === "boot" && (
                <div className="hacker-boot">
                  <div className="hacker-emblem">◈</div>
                  <div className="hacker-kicker">ODDORA CYBER SYSTEMS</div>
                  <h1>INITIALIZING<span className="hacker-cursor">_</span></h1>
                  <p>Preparing secure virtual environment</p>
                  <div className="hacker-boot-line"><span /></div>
                </div>
              )}

              {(phase === "connect" || phase === "intrusion") && (
                <div className="hacker-console-layout">
                  <div className="hacker-console-main">
                    <div className="hacker-panel-heading">
                      <span>TERMINAL / ROOT SESSION</span>
                      <span className="hacker-live-label">● ACTIVE</span>
                    </div>
                    <div className="hacker-terminal-body">
                      <div className="hacker-terminal-intro">ODDORA VIRTUAL TERMINAL v4.09</div>
                      <div className="hacker-terminal-intro">Copyright © ODDORA Cyber Lab</div>
                      <div className="hacker-terminal-gap" />
                      {visibleMessages.map(message => (
                        <div className={`hacker-line ${message.type}`} key={message.time}>
                          <span className="hacker-prompt">root@oddora:~$</span> {message.text}
                        </div>
                      ))}
                      <div className="hacker-typing-line"><span>root@oddora:~$</span> <i /></div>
                    </div>
                  </div>

                  <div className="hacker-side-panels">
                    <div className="hacker-info-panel">
                      <span>NETWORK STATUS</span><strong className="green-text">● ENCRYPTED</strong>
                      <small>Virtual connection only</small>
                    </div>
                    <div className="hacker-info-panel">
                      <span>FIREWALL</span><strong className="green-text">ACTIVE</strong>
                      <small>Simulation shield enabled</small>
                    </div>
                    <div className="hacker-info-panel">
                      <span>ACCESS ATTEMPTS</span><strong>{Math.min(12, visibleMessages.length + 2).toString().padStart(2, "0")}</strong>
                      <small>Fictional operations</small>
                    </div>
                    <div className="hacker-radar"><div className="hacker-radar-sweep" /><span>SCANNING</span></div>
                  </div>
                </div>
              )}

              {phase === "final" && (
                <div className="hacker-final-loading">
                  <div className="hacker-warning-symbol">!</div>
                  <div className="hacker-kicker">FINAL OPERATION</div>
                  <h1>FINALIZING <span>ACCESS</span></h1>
                  <p>Do not interrupt the simulation...</p>
                  <div className="hacker-big-progress">
                    <div style={{ width: `${progress}%` }} />
                  </div>
                  <div className="hacker-progress-meta">
                    <strong>{progress}%</strong><span>VIRTUAL ACCESS VERIFICATION</span>
                  </div>
                  <div className="hacker-glitch-note">PLEASE WAIT — SYSTEM RESPONSE PENDING</div>
                </div>
              )}
            </div>

            <div className="hacker-bottom-note">
              ODDORA SIMULATION ENVIRONMENT · NO REAL DEVICE OR ACCOUNT ACCESS
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onMouseDown={e => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className="experience-modal" role="dialog" aria-modal="true"
        aria-labelledby="modal-title" style={{ position: "relative" }}>
        <button className="modal-close" onClick={() => { exitDeviceFullscreen(); onClose(); }} aria-label="Close">
          <X size={20}/>
        </button>

        <div className="modal-topline">
          <span className="modal-icon">{item.icon}</span>
          <span className="card-category">{item.category}</span>
          <button className="modal-sound-toggle" onClick={toggleSound} type="button">
            {soundEnabled ? "🔊 SOUND ON" : "🔇 SOUND OFF"}
          </button>
        </div>

        <h2 id="modal-title">{item.id === "mind" ? "Mind Lab" : item.title}</h2>
        <p className="modal-description">
          {item.id === "mind" ? "Choose a mystery, or let ODDORA surprise you." : item.description}
        </p>

        {/* MIND LAB SELECTION */}
        {step === 0 && item.id === "mind" && (
          <div className="result-stage" style={{ gap: 14 }}>
            <button className="primary-btn" style={{ width: "100%", justifyContent: "center" }}
              onClick={chooseRandomPuzzle}>
              🎲 Surprise me with a random puzzle
            </button>
            <div className="eyebrow muted" style={{ marginTop: 8 }}>OR PICK YOUR MYSTERY</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, width: "100%" }}>
              {mindPuzzles.map((puzzle, index) => (
                <button key={puzzle.id} className="choice" onClick={() => choosePuzzle(index)}
                  style={{
                    minHeight: 88, padding: 12, display: "flex", flexDirection: "column",
                    alignItems: "flex-start", justifyContent: "center", gap: 7,
                    textAlign: "left"
                  }}>
                  <span style={{ fontSize: 22 }}>{puzzle.icon}</span>
                  <strong style={{ fontSize: 13 }}>{puzzle.title}</strong>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* INTRO FOR OTHER EXPERIENCES */}
        {step === 0 && item.id !== "mind" && (
          <div className="modal-stage intro-stage">
            <div className="stage-orb">{item.icon}</div>

            {item.category === "OD PRANKS" ? (
              <>
                {sharedPrank?.mode === "friend" ? (
                  <>
                    <div className="eyebrow muted">A PRANK FROM YOUR FRIEND</div>
                    <h3>{sharedPrank.sender} has a surprise for you!</h3>
                    <p>Ready to see what they sent you?</p>
                    <button className="primary-btn" onClick={startExperience}>
                      Start the prank <Zap size={17}/>
                    </button>
                  </>
                ) : (
                  <>
                    <p>How do you want to enjoy this prank?</p>

                    <div className="prank-mode-options">
                      <button
                        type="button"
                        className={prankMode === "self" ? "prank-mode-card active" : "prank-mode-card"}
                        onClick={() => { setPrankMode("self"); setLinkError(""); }}
                      >
                        <span>😈</span>
                        <strong>Prank Myself</strong>
                        <small>Experience the prank yourself</small>
                      </button>

                      <button
                        type="button"
                        className={prankMode === "friend" ? "prank-mode-card active" : "prank-mode-card"}
                        onClick={() => { setPrankMode("friend"); setLinkError(""); }}
                      >
                        <span>🫣</span>
                        <strong>Prank a Friend</strong>
                        <small>Send a surprise link to someone</small>
                      </button>
                    </div>

                    {prankMode === "self" ? (
                      <button className="primary-btn" onClick={startExperience}>
                        Let's do this <Zap size={17}/>
                      </button>
                    ) : (
                      <div className="friend-link-form">
                        <input
                          type="text"
                          maxLength={30}
                          value={senderName}
                          onChange={e => { setSenderName(e.target.value); setLinkError(""); }}
                          placeholder="Enter your name"
                          aria-label="Your name"
                        />
                        {linkError && <small style={{ color: "#ff8585" }}>{linkError}</small>}
                        <button
                          className="primary-btn"
                          onClick={createFriendLink}
                          disabled={!senderName.trim()}
                        >
                          <Share2 size={17}/>
                          {linkCopied ? "Link copied!" : "Create prank link"}
                        </button>
                        <small>Share the link with your friend. The prank starts when they open it.</small>
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                <p>{item.id === "hacker"
                  ? "A suspicious terminal is waiting. Ready to see what it finds?"
                  : "Ready? This is a harmless visual experience."}</p>
                <button className="primary-btn" onClick={startExperience}>
                  Let's do this <Zap size={17}/>
                </button>
              </>
            )}
          </div>
        )}

        {/* FAKE SOFTWARE UPDATE */}
        {step === 9 && item.id === "update" && (() => {
          const progress = updateElapsed < 4
            ? 12
            : updateElapsed < 9
              ? 38
              : updateElapsed < 15
                ? 67
                : updateElapsed < 20
                  ? 99
                  : 100;

          const restarting = updateElapsed >= 20;

          return (
            <div className="software-update-screen">
              {!restarting ? (
                <>
                  <div className="windows-update-logo">◈</div>
                  <h2>Working on updates</h2>
                  <p className="update-subtitle">Your device is installing important updates</p>
                  <div className="software-update-percent">{progress}%</div>
                  <div className="software-update-track">
                    <span style={{ width: `${progress}%` }} />
                  </div>
                  <p className="software-update-message">
                    {progress === 99
                      ? "Almost there. Please don't turn off your device."
                      : "Please keep your device turned on."}
                  </p>
                  <p className="software-update-warning">Do not turn off your device</p>
                </>
              ) : (
                <div className="fake-restart">
                  <div className="restart-spinner"></div>
                  <h2>Restarting...</h2>
                  <p>Preparing your device</p>
                </div>
              )}
            </div>
          );
        })()}

        {/* HARMLESS VIRUS SCANNER */}
        {step === 10 && item.id === "virus" && (
          <div className="prank-stage scanner-stage prank-fullscreen-takeover">
            <div className="scanner-orb"><span>⌁</span></div>
            <div className="eyebrow muted">ODDORA SECURITY SIMULATOR</div>
            <h3>Scanning your digital habits...</h3>
            <div className="scan-lines"><span /></div>
            <div className="scan-checks">
              <span>✓ Checking scroll history</span>
              <span>✓ Analysing snack searches</span>
              <span>✓ Detecting procrastination</span>
            </div>
            <button className="primary-btn" onClick={() => {
              setResult("THREAT DETECTED: Excessive scrolling. Recommended action: touch grass for 5 minutes. 🌱");
              playSound("alert");
              triggerHaptic([20, 40, 20]);
              setStep(2);
            }}>Reveal scan result</button>
            <p className="prank-disclaimer">This is a fictional scan. It does not access your phone or files.</p>
          </div>
        )}

        {/* DON'T TOUCH THE BUTTON */}
        {step === 11 && item.id === "button" && (
          <div className="prank-stage forbidden-stage prank-fullscreen-takeover">
            <div className="eyebrow muted">THE FORBIDDEN BUTTON</div>
            <h3>{buttonClicks === 0 ? "Whatever you do..." : "You really did it?!"}</h3>
            <p className="result-text">{buttonClicks === 0 ? "Don't press the button. Seriously." : [
              "The button has noticed you.",
              "A tiny committee is discussing your decision.",
              "Button status: emotionally unavailable.",
              "Achievement unlocked: Professional button presser.",
              "The button requests a day off."
            ][(buttonClicks - 1) % 5]}</p>
            <button className="forbidden-button" onClick={() => {
              playSound("tap");
              triggerHaptic(18);
              setButtonClicks(c => c + 1);
            }}>
              {buttonClicks === 0 ? "DO NOT PRESS" : "PRESS AGAIN"}
            </button>
            <span className="tap-counter">Button presses: {buttonClicks}</span>
            <button className="secondary-btn dark" onClick={() => {
              playSound("reveal");
              setResult(`You pressed the forbidden button ${buttonClicks} times. The button will remember. 🔴`);
              setStep(2);
            }}>I'm done causing trouble</button>
          </div>
        )}

        {/* FAKE IQ TEST */}
        {step === 12 && item.id === "iq" && (
          <div className={item.id === "iq" ? "prank-stage iq-stage prank-fullscreen-takeover" : "prank-stage iq-stage"}>
            <div className="eyebrow muted">TOTALLY UNOFFICIAL IQ TEST</div>
            <div className="iq-count">QUESTION {Math.min(iqQuestion + 1, 3)} / 3</div>
            <>
              <h3>{[
                "What has many keys but can't open a door?",
                "What gets wetter the more it dries?",
                "Which month has 28 days?"
              ][iqQuestion]}</h3>
              <div className="iq-options">
                {[
                  ["A piano","A secret agent","Your keyboard"],
                  ["A towel","A cloud","Your phone"],
                  ["February","All of them","None"]
                ][iqQuestion].map((answer, index) => (
                  <button key={answer} className="choice" onClick={() => {
                    playSound("tap");
                    triggerHaptic(12);
                    const nextAnswers = [...iqAnswers, index];
                    setIqAnswers(nextAnswers);
                    if (iqQuestion === 2) {
                      const score = nextAnswers.reduce((total, value, qIndex) =>
                        total + (value === [0, 0, 1][qIndex] ? 1 : 0), 0);
                      playSound("reveal");
                      setResult(`Your completely unofficial ODDORA IQ score: ${82 + score * 17}. ${score === 3 ? "Genius energy detected!" : "The test is confused. You are probably too powerful."} 😂`);
                      setStep(2);
                    } else {
                      setIqQuestion(q => q + 1);
                    }
                  }}>{answer}</button>
                ))}
              </div>
            </>
            <p className="prank-disclaimer">Just a silly quiz, not a real IQ assessment.</p>
          </div>
        )}

        {/* WHAT IF 3-CHOICE SIMULATOR */}
        {step === 15 && item.id === "whatif" && (
          <div className={item.id === "iq" ? "prank-stage iq-stage prank-fullscreen-takeover" : "prank-stage iq-stage"}>
            <div className="eyebrow muted">{whatIfQuestions[whatIfStep].step}</div>
            <h3>{whatIfQuestions[whatIfStep].question}</h3>
            <div className="iq-options">
              {whatIfQuestions[whatIfStep].options.map(opt => (
                <button
                  key={opt.label}
                  className="choice"
                  onClick={() => {
                    playSound("tap");
                    triggerHaptic(12);
                    const updated = [...whatIfScores, opt.score];
                    setWhatIfScores(updated);
                    if (whatIfStep < whatIfQuestions.length - 1) {
                      setWhatIfStep(s => s + 1);
                    } else {
                      const counts = updated.reduce((acc, k) => ({ ...acc, [k]: (acc[k] || 0) + 1 }), {});
                      const topKey = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || "chaotic";
                      playSound("reveal");
                      setResult(whatIfOutcomes[topKey]);
                      setStep(2);
                    }
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* XO MULTIPLAYER + SOLO AI */}
        {step === 13 && item.id === "xo" && (
          <XOMultiplayer
            onBack={onBackToGames}
            onExplore={onExplore}
            onCreateChallenge={onCreateChallenge}
            initialRoomCode={xoInviteCode}
            playSound={playSound}
          />
        )}

        {/* CATCH MY HEART MULTIPLAYER + SOLO AI */}
        {step === 14 && item.id === "catch-heart" && (
          <CatchMyHeart
            onBack={onBackToGames}
            onExplore={onExplore}
            onCreateChallenge={onCreateChallenge}
            initialRoomCode={heartInviteCode}
            playSound={playSound}
          />
        )}

        {/* GENERAL RESULT */}
        {step === 2 && (
          <div className="result-stage">
            <div className="result-spark">✨</div>
            <div className="eyebrow muted">YOUR OFFICIAL RESULT</div>
            {item.category === "OD PRANKS" && (
              <div className="prank-final-reveal">
                {sharedPrank?.mode === "friend" ? (
                  <>
                    <span>😂</span>
                    <h3>YOU GOT PRANKED!</h3>
                    <p>Don't worry! Your friend <strong>{sharedPrank.sender}</strong> pranked you!</p>
                  </>
                ) : (
                  <>
                    <span>😄</span>
                    <h3>JUST A PRANK!</h3>
                    <p>Your device is safe. Nothing was accessed or changed.</p>
                  </>
                )}
              </div>
            )}
            <p className="result-text">{result}</p>
            <div className="result-actions">
              <button className="primary-btn" onClick={() => { playSound("tap"); onShare(result); }}>
                <Share2 size={17}/>{copied ? "Copied!" : "Share result"}
              </button>
              <button className="secondary-btn dark" onClick={() => { playSound("tap"); setStep(0); setResult(""); }}>
                <RotateCcw size={16}/> Play again
              </button>
            </div>
          </div>
        )}

        {/* PERSONALITY QUIZ */}
        {step === 4 && (
          <div className="result-stage">
            <div className="eyebrow muted">CHOOSE YOUR VIBE</div>
            <div className="choice-grid">
              {["Curious 🧐", "Fearless 🦁", "Creative 🎨", "Chill 😎"].map(v => (
                <button className={choice === v ? "choice active" : "choice"} key={v}
                  onClick={() => { playSound("tap"); setChoice(v); }}>{v}</button>
              ))}
            </div>
            <button className="primary-btn" disabled={!choice} onClick={() => {
              setResult(`Your secret superpower is ${choice.split(" ")[0]} energy. Use it wisely. Or don't. 😄`);
              playSound("reveal");
              setStep(2);
            }}>Reveal my power</button>
          </div>
        )}

        {/* STEP-BY-STEP NUMBER PUZZLES */}
        {step === 5 && item.id === "mind" &&
          ["steps", "agecode", "birthdaycode"].includes(currentPuzzle.type) && (
          <div className="result-stage">
            <div className="eyebrow muted">
              STEP {String(mindInstructionIndex + 1).padStart(2, "0")} / {String(currentPuzzle.instructions.length).padStart(2, "0")}
            </div>
            <div className="result-spark">{currentPuzzle.icon}</div>
            <h3>{currentPuzzle.title}</h3>
            <p className="result-text">
              {mindInstructionIndex === 0
                ? currentPuzzle.intro
                : currentPuzzle.instructions[mindInstructionIndex - 1]}
            </p>
            <div className="result-actions">
              {mindInstructionIndex > 0 && (
                <button className="secondary-btn dark" onClick={() => { playSound("step"); setMindInstructionIndex(i => i - 1); }}>Back</button>
              )}
              <button className="primary-btn" onClick={() => {
                playSound(mindInstructionIndex < currentPuzzle.instructions.length ? "step" : "reveal");
                if (mindInstructionIndex < currentPuzzle.instructions.length) {
                  setMindInstructionIndex(i => i + 1);
                } else if (isCodePuzzle) {
                  setStep(8);
                } else {
                  setStep(6);
                }
              }}>
                {mindInstructionIndex < currentPuzzle.instructions.length ? "Next Step" : "I'm ready!"}
                <ChevronRight size={17}/>
              </button>
            </div>
          </div>
        )}

        {/* BIRTH YEAR DECODER */}
        {step === 5 && item.id === "mind" && currentPuzzle.type === "birthyear" && (
          <div className="result-stage" style={{ textAlign: "left" }}>
            <div className="result-spark" style={{ textAlign: "center" }}>🎂</div>
            <h3 style={{ textAlign: "center" }}>Let's decode your birth year</h3>
            <label style={{ display: "block", marginTop: 14, width: "100%" }}>
              How old are you today?
              <input type="number" min="1" max="120" value={birthAge}
                onChange={e => setBirthAge(e.target.value)} placeholder="Enter your age" style={fieldStyle}/>
            </label>
            <label style={{ display: "block", marginTop: 14, width: "100%" }}>
              Has your birthday happened already this year?
              <select value={birthdayPassed} onChange={e => setBirthdayPassed(e.target.value)} style={fieldStyle}>
                <option value="">Choose one</option>
                <option value="yes">Yes, it has</option>
                <option value="no">No, not yet</option>
              </select>
            </label>
            <button className="primary-btn" style={{ width: "100%", justifyContent: "center", marginTop: 18 }}
              disabled={!birthAge || !birthdayPassed || Number(birthAge) < 1 || Number(birthAge) > 120}
              onClick={revealBirthYear}>Reveal my birth year ✨</button>
            <p className="modal-description" style={{ textAlign: "center", marginTop: 10 }}>
              Calculated in your browser. Nothing is saved.
            </p>
          </div>
        )}

        {/* BIRTHDAY WEEKDAY FINDER */}
        {step === 5 && item.id === "mind" && currentPuzzle.type === "weekday" && (
          <div className="result-stage" style={{ textAlign: "left" }}>
            <div className="result-spark" style={{ textAlign: "center" }}>📅</div>
            <h3 style={{ textAlign: "center" }}>When were you born?</h3>
            <label style={{ display: "block", marginTop: 14, width: "100%" }}>
              Your date of birth
              <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} style={fieldStyle}/>
            </label>
            <button className="primary-btn" style={{ width: "100%", justifyContent: "center", marginTop: 18 }}
              disabled={!birthDate} onClick={revealWeekday}>Find my birthday weekday ✨</button>
            <p className="modal-description" style={{ textAlign: "center", marginTop: 10 }}>
              Your date is processed in this browser and is not saved.
            </p>
          </div>
        )}

        {/* ENTER THE FINAL NUMBER */}
        {step === 8 && item.id === "mind" && (
          <div className="result-stage" style={{ textAlign: "left" }}>
            <div className="result-spark" style={{ textAlign: "center" }}>
              {currentPuzzle.type === "agecode" ? "🎯" : "🎂"}
            </div>
            <h3 style={{ textAlign: "center" }}>
              {currentPuzzle.type === "agecode" ? "What final number did you get?" : "Enter your final birthday code"}
            </h3>
            <p className="modal-description" style={{ textAlign: "center" }}>
              Enter only the final number from your calculation.
            </p>
            <label style={{ display: "block", marginTop: 14, width: "100%" }}>
              Your final number
              <input type="number" inputMode="numeric" value={puzzleCode}
                onChange={e => { setPuzzleCode(e.target.value); setError(""); }}
                placeholder={currentPuzzle.type === "agecode" ? "Example: 2500" : "Example: 1107"}
                style={fieldStyle}/>
            </label>
            {error && <p style={{ color: "#ff8585", marginTop: 10 }}>{error}</p>}
            <button className="primary-btn" style={{ width: "100%", justifyContent: "center", marginTop: 18 }}
              disabled={!puzzleCode.trim()} onClick={decodePuzzleCode}>Decode my answer 🔮</button>
            <p className="modal-description" style={{ textAlign: "center", marginTop: 10 }}>
              Your entry is processed locally and is not saved.
            </p>
          </div>
        )}

        {/* PREDICTION RESULT */}
        {step === 6 && item.id === "mind" && (
          <div className="result-stage">
            <div className="result-spark">🔮</div>
            <div className="eyebrow muted">ODDORA'S PREDICTION</div>
            <h3>I've got your answer...</h3>
            <h2 className="gradient-text" style={{ fontSize: "clamp(30px, 8vw, 48px)", margin: "12px 0" }}>
              {prediction}
            </h2>
            <p className="result-text">
              {currentPuzzle.type === "steps" ? currentPuzzle.reveal : "That's what the mystery reveals. Did ODDORA get it right?"}
            </p>
            <div className="result-actions" style={{ flexWrap: "wrap" }}>
              <button className="primary-btn" onClick={sharePrediction}>
                <Share2 size={17}/>{copied ? "Copied!" : "Share my result"}
              </button>
              <button className="secondary-btn dark" onClick={() => setShowMagicPopup(true)}>
                💡 How did I know?
              </button>
            </div>
            <p className="modal-description" style={{ marginTop: 14 }}>
              Share your prediction first. The secret is waiting if you're curious.
            </p>
          </div>
        )}

        {/* SECRET EXPLANATION */}
        {step === 7 && item.id === "mind" && (
          <div className="result-stage">
            <div className="result-spark">✨</div>
            <div className="eyebrow muted">THE MAGIC EXPLAINED</div>
            <h2 className="gradient-text">{prediction}</h2>
            <p className="result-text">
              {currentPuzzle.type === "steps" ? currentPuzzle.reveal : result}
            </p>
            <div className="mind-explain-box">
              <div className="eyebrow muted">WHY IT WORKS</div>
              <p className="modal-description" style={{ marginTop: 8 }}>{currentPuzzle.explanation}</p>
            </div>
            <div className="result-actions" style={{ flexWrap: "wrap" }}>
              <button className="primary-btn" onClick={sharePrediction}>
                <Share2 size={17}/>{copied ? "Copied!" : "Share result"}
              </button>
              <button className="secondary-btn dark" onClick={() => { resetMind(); setStep(0); }}>
                <RotateCcw size={16}/> Back to Mind Lab
              </button>
            </div>
          </div>
        )}

        {/* MAGIC REVEAL POPUP */}
        {showMagicPopup && step === 6 && (
          <div onMouseDown={e => {
            if (e.target === e.currentTarget) setShowMagicPopup(false);
          }} style={{
            position: "absolute", inset: 0, zIndex: 20, display: "grid",
            placeItems: "center", padding: 20, borderRadius: "inherit",
            background: "rgba(5,3,14,.88)", backdropFilter: "blur(9px)"
          }}>
            <div style={{
              width: "100%", maxWidth: 340, padding: 24, borderRadius: 20,
              textAlign: "center", background: "#191528", color: "#fff",
              border: "1px solid rgba(190,160,255,.3)",
              boxShadow: "0 20px 70px rgba(0,0,0,.5)"
            }}>
              <div style={{ fontSize: 42, marginBottom: 12 }}>💡</div>
              <div className="eyebrow muted">THE MAGIC BEHIND THE MYSTERY</div>
              <h3>Want to know the magic trick?</h3>
              <p className="result-text">
                Your prediction is ready. Want ODDORA to show you exactly how it works?
              </p>
              <button className="primary-btn" style={{ width: "100%", justifyContent: "center" }}
                onClick={revealMagic}>Show me the magic ✨</button>
              <button className="secondary-btn dark" style={{ marginTop: 10 }}
                onClick={() => setShowMagicPopup(false)}>Not yet</button>
            </div>
          </div>
        )}

        <div className="modal-foot">
          <span><Sparkles size={13}/> Harmless fun. Nothing is really hacked.</span>
          <span>ODDORA</span>
        </div>
      </div>
    </div>
  );
}

const XO_WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

function getSmartAIMove(board) {
  const empty = board.map((v, i) => (v === "" ? i : null)).filter(v => v !== null);
  if (empty.length === 0) return -1;

  for (const idx of empty) {
    const test = [...board];
    test[idx] = "O";
    if (XO_WIN_LINES.some(line => line.every(c => test[c] === "O"))) return idx;
  }
  for (const idx of empty) {
    const test = [...board];
    test[idx] = "X";
    if (XO_WIN_LINES.some(line => line.every(c => test[c] === "X"))) return idx;
  }
  if (board[4] === "" && Math.random() > 0.25) return 4;
  return empty[Math.floor(Math.random() * empty.length)];
}

function XOMultiplayer({ onBack, onExplore, onCreateChallenge, initialRoomCode = "", playSound }) {
  const [mode, setMode] = useState(initialRoomCode ? "multi" : "select");
  const [soloBoard, setSoloBoard] = useState(["", "", "", "", "", "", "", "", ""]);
  const [soloWinner, setSoloWinner] = useState("");
  const [soloThinking, setSoloThinking] = useState(false);
  const [botBanter, setBotBanter] = useState("Your move, human. Don't overthink it.");

  const [uid, setUid] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState(initialRoomCode);
  const [room, setRoom] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("Enter your display name to create or join a game.");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (initialRoomCode) {
      setJoinCode(initialRoomCode);
      setMode("multi");
    }
  }, [initialRoomCode]);

  useEffect(() => {
    if (mode !== "multi") return undefined;
    let alive = true;
    signInPlayer()
      .then(credential => {
        if (!alive) return;
        setUid(credential.user.uid);
        setNotice("You're connected. Choose your name and start playing.");
      })
      .catch(() => {
        if (alive) setNotice("Could not connect to Firebase. Check your internet or play Solo AI mode.");
      });
    return () => { alive = false; };
  }, [mode]);

  useEffect(() => {
    if (!roomCode || mode !== "multi") return undefined;
    const roomRef = ref(database, `rooms/${roomCode}`);
    const unsubscribe = onValue(roomRef, snapshot => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        if (val.status === "finished" && room?.status === "playing") {
          playSound?.("reveal");
        }
        setRoom(val);
      } else {
        setRoom(null);
        setNotice("This room no longer exists.");
      }
    }, () => {
      setNotice("Unable to read this room. Check your Realtime Database rules.");
    });
    return () => unsubscribe();
  }, [roomCode, mode]);

  function handleSoloCell(index) {
    if (soloBoard[index] || soloWinner || soloThinking) return;
    playSound?.("tap");
    triggerHaptic(12);

    const nextBoard = [...soloBoard];
    nextBoard[index] = "X";
    setSoloBoard(nextBoard);

    const playerWon = XO_WIN_LINES.some(line => line.every(c => nextBoard[c] === "X"));
    if (playerWon) {
      setSoloWinner("X");
      setBotBanter("Okay fine, you got lucky. Rematch? 🙄");
      playSound?.("reveal");
      triggerHaptic([20, 30, 20]);
      return;
    }
    if (nextBoard.every(Boolean)) {
      setSoloWinner("draw");
      setBotBanter("A tie! Great minds think alike.");
      playSound?.("step");
      return;
    }

    setSoloThinking(true);
    setBotBanter("Calculating 14,000,605 outcomes...");
    window.setTimeout(() => {
      const aiIdx = getSmartAIMove(nextBoard);
      if (aiIdx >= 0) nextBoard[aiIdx] = "O";
      setSoloBoard([...nextBoard]);
      setSoloThinking(false);
      playSound?.("step");

      const aiWon = XO_WIN_LINES.some(line => line.every(c => nextBoard[c] === "O"));
      if (aiWon) {
        setSoloWinner("O");
        setBotBanter("Too easy! Want another shot? 😎");
        playSound?.("wrong");
      } else if (nextBoard.every(Boolean)) {
        setSoloWinner("draw");
        setBotBanter("Stalemate! Nobody wins.");
      } else {
        const quips = ["Interesting choice...", "Are you sure about that?", "Your turn!", "I saw that coming."];
        setBotBanter(quips[Math.floor(Math.random() * quips.length)]);
      }
    }, 450);
  }

  function resetSolo() {
    playSound?.("tap");
    setSoloBoard(["", "", "", "", "", "", "", "", ""]);
    setSoloWinner("");
    setSoloThinking(false);
    setBotBanter("Fresh board. Your move!");
  }

  const cleanName = value => value.trim().replace(/\s+/g, " ").slice(0, 18);

  async function createRoom() {
    const name = cleanName(playerName);
    if (!uid || busy || !name) { setNotice("Enter your name first."); return; }
    setBusy(true); setNotice("Creating your challenge...");
    try {
      let code = "";
      let exists = true;
      for (let attempt = 0; attempt < 8 && exists; attempt += 1) {
        code = Math.random().toString(36).slice(2, 8).toUpperCase();
        const snapshot = await get(ref(database, `rooms/${code}`));
        exists = snapshot.exists();
      }
      if (exists) throw new Error("Could not generate a room code. Please try again.");
      const newRoom = {
        board: ["", "", "", "", "", "", "", "", ""],
        turn: "X", players: { X: uid, O: "" },
        playerNames: { X: name, O: "" },
        status: "waiting", winner: "", gamesPlayed: 0,
        createdAt: Date.now()
      };
      await set(ref(database, `rooms/${code}`), newRoom);
      setRoomCode(code);
      playSound?.("magic");
      setNotice("Challenge created! Share the invitation link with your friend.");
      const url = new URL(window.location.href);
      url.search = "";
      url.searchParams.set("xo", code);
      window.history.replaceState({}, "", url.toString());
    } catch (error) {
      setNotice(error.message || "Could not create the room.");
    } finally { setBusy(false); }
  }

  async function joinRoom() {
    const code = joinCode.trim().toUpperCase();
    const name = cleanName(playerName);

    if (!uid || busy) return;
    if (!name) { setNotice("Enter your display name before joining."); return; }
    if (code.length !== 6) { setNotice("Enter a valid 6-character room code."); return; }

    setBusy(true);
    setNotice("Joining your friend's challenge...");

    try {
      const roomRef = ref(database, `rooms/${code}`);
      const existingSnapshot = await get(roomRef);

      if (!existingSnapshot.exists()) {
        throw new Error("Room not found. Ask your friend to create a new challenge.");
      }

      const existingRoom = existingSnapshot.val();
      if (!Array.isArray(existingRoom.board) || existingRoom.gameType === "catch-heart") {
        throw new Error("That code belongs to a different game. Use an XO invitation link.");
      }

      if (existingRoom.players?.X === uid) {
        setRoomCode(code);
        setNotice("Welcome back! You're Player X.");
        return;
      }

      if (existingRoom.players?.O && existingRoom.players.O !== uid) {
        throw new Error("This room is already full.");
      }

      let usedPreflightFallback = false;
      const result = await runTransaction(roomRef, current => {
        if (!current) {
          if (usedPreflightFallback) return;
          usedPreflightFallback = true;
          current = existingRoom;
        }
        if (!Array.isArray(current.board) || current.gameType === "catch-heart") return;
        if (current.players?.X === uid) return current;
        if (current.players?.O === uid) {
          return { ...current, playerNames: { ...(current.playerNames || {}), O: name } };
        }
        if (current.status !== "waiting" || current.players?.O) return;

        return {
          ...current,
          players: { ...current.players, O: uid },
          playerNames: { ...(current.playerNames || {}), O: name },
          status: "playing"
        };
      });

      if (!result.committed || !result.snapshot.exists()) {
        throw new Error("Could not join this room. It may have just been filled.");
      }

      setRoomCode(code);
      playSound?.("magic");
      setNotice("Joined! You're Player O. Your friend starts as X.");
      const url = new URL(window.location.href);
      url.search = "";
      url.searchParams.set("xo", code);
      window.history.replaceState({}, "", url.toString());
    } catch (error) {
      setNotice(error.message || "Could not join the room.");
    } finally {
      setBusy(false);
    }
  }

  function mySymbol() {
    if (room?.players?.X === uid) return "X";
    if (room?.players?.O === uid) return "O";
    return "";
  }

  async function playCell(index) {
    const symbol = mySymbol();
    if (!roomCode || !uid || !room || !symbol || room.status !== "playing" || room.turn !== symbol || room.board?.[index]) return;
    playSound?.("tap");
    triggerHaptic(12);
    try {
      await runTransaction(ref(database, `rooms/${roomCode}`), current => {
        if (!current || current.status !== "playing" || current.turn !== symbol || current.board?.[index]) return;
        const board = [...current.board];
        board[index] = symbol;
        const winningLine = XO_WIN_LINES.find(line => line.every(cell => board[cell] === symbol));
        const draw = !winningLine && board.every(Boolean);
        return {
          ...current,
          board,
          turn: symbol === "X" ? "O" : "X",
          status: winningLine || draw ? "finished" : "playing",
          winner: winningLine ? symbol : draw ? "draw" : ""
        };
      });
    } catch {
      setNotice("Move could not be saved. Check your connection.");
    }
  }

  async function restartGame(swapSides = false) {
    if (!roomCode || !room || room.status !== "finished" || !mySymbol()) return;
    setBusy(true);
    try {
      await runTransaction(ref(database, `rooms/${roomCode}`), current => {
        if (!current || current.status !== "finished" || !current.players?.X || !current.players?.O) return;
        const players = swapSides ? { X: current.players.O, O: current.players.X } : current.players;
        const playerNames = swapSides
          ? { X: current.playerNames?.O || "Player O", O: current.playerNames?.X || "Player X" }
          : (current.playerNames || {});
        return {
          ...current,
          players,
          playerNames,
          board: ["", "", "", "", "", "", "", "", ""],
          turn: "X",
          status: "playing",
          winner: "",
          gamesPlayed: (current.gamesPlayed || 0) + 1
        };
      });
    } finally { setBusy(false); }
  }

  async function shareInvitation() {
    if (!roomCode) return;
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("xo", roomCode);
    const shareUrl = url.toString();
    const text = `${room?.playerNames?.X || playerName || "Your friend"} challenged you to XO on ODDORA! Join the game:`;
    try {
      if (navigator.share) await navigator.share({ title: "XO Challenge – ODDORA", text, url: shareUrl });
      else { await navigator.clipboard.writeText(`${text}\n${shareUrl}`); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    } catch {}
  }

  async function shareXOResult() {
    if (!room || room.status !== "finished") return;
    const winnerName = room.winner === "draw"
      ? "It's a draw"
      : room.playerNames?.[room.winner] || (room.winner === "X" ? "Player X" : "Player O");
    const loserName = room.playerNames?.[room.winner === "X" ? "O" : "X"] || "their friend";
    const resultText = `❎⭕ ODDORA XO: ${winnerName === "It's a draw" ? winnerName : `${winnerName} won against ${loserName}`}! Play your own game:`;
    const playUrl = `${window.location.origin}/`;
    try {
      const file = await shareODDORAResultCard({
        game: "XO Multiplayer",
        headline: winnerName === "It's a draw" ? "IT'S A DRAW!" : `${winnerName.toUpperCase()} WINS!`,
        subtitle: winnerName === "It's a draw" ? "A close match. Time for a rematch." : `${winnerName} won the game against ${loserName}.`,
        detail: "XO · ODDORA",
        quote: "One game down. The fun isn't.",
        url: playUrl
      });
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({ title: "ODDORA XO Result", text: resultText, url: playUrl, files: [file] });
      } else {
        const imageUrl = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = imageUrl;
        a.download = "oddora-xo-result.png";
        a.click();
        URL.revokeObjectURL(imageUrl);
        await navigator.clipboard?.writeText(`${resultText}\n${playUrl}`);
        setNotice("Result image downloaded and game link copied.");
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {}
  }

  if (mode === "select") {
    return (
      <div className="xo-game-wrap">
        <div className="xo-welcome">
          <div className="xo-mark">❎⭕</div>
          <h3>Choose how you want to play</h3>
          <p className="modal-description">Play solo right now against ODDORA AI or invite a friend.</p>
        </div>
        <div className="prank-mode-options">
          <button type="button" className="prank-mode-card active" onClick={() => { playSound?.("tap"); setMode("solo"); }}>
            <span><Bot size={28}/></span>
            <strong>Solo vs ODDORA AI</strong>
            <small>Instant match · Zero wait</small>
          </button>
          <button type="button" className="prank-mode-card" onClick={() => { playSound?.("tap"); setMode("multi"); }}>
            <span><Users size={28}/></span>
            <strong>Challenge a Friend</strong>
            <small>Live room · Share link</small>
          </button>
        </div>
        <button className="secondary-btn dark xo-wide" onClick={onBack}>Back to OD Games</button>
      </div>
    );
  }

  if (mode === "solo") {
    return (
      <div className="xo-game-wrap">
        <div className="xo-players">
          <div className={!soloThinking && !soloWinner ? "xo-player active" : "xo-player"}>
            <b className="xo-player-symbol">X</b><span>You</span>
          </div>
          <div className={soloThinking ? "xo-player active" : "xo-player"}>
            <b className="xo-player-symbol xo-o">O</b><span>ODDORA AI</span>
          </div>
        </div>
        <div className="xo-status">
          <span className="eyebrow muted">SOLO ARENA</span>
          <strong>{soloWinner === "X" ? "You beat ODDORA AI! 🎉" : soloWinner === "O" ? "ODDORA AI wins! 🤖" : soloWinner === "draw" ? "It's a draw! 🤝" : botBanter}</strong>
        </div>
        <div className="xo-board">
          {soloBoard.map((cell, index) => (
            <button
              key={index}
              className={`xo-cell ${cell ? `played ${cell.toLowerCase()}` : ""}`}
              onClick={() => handleSoloCell(index)}
              disabled={Boolean(cell) || Boolean(soloWinner) || soloThinking}
            >
              {cell}
            </button>
          ))}
        </div>
        {soloWinner && (
          <button className="primary-btn xo-wide" onClick={resetSolo}>
            <RotateCcw size={16}/> Play again vs AI
          </button>
        )}
        <button className="secondary-btn dark xo-wide" onClick={() => setMode("multi")}>
          <Users size={15}/> Switch to Friend Multiplayer
        </button>
        <button className="secondary-btn dark xo-wide" onClick={onBack}>Back to OD Games</button>
      </div>
    );
  }

  const symbol = mySymbol();
  const myName = symbol ? (room?.playerNames?.[symbol] || (symbol === "X" ? "Player X" : "Player O")) : "";
  const opponentSymbol = symbol === "X" ? "O" : "X";
  const opponentName = room?.playerNames?.[opponentSymbol] || (opponentSymbol === "X" ? "Player X" : "Player O");
  const statusText = !room
    ? "Create a challenge or join your friend's invitation."
    : room.status === "waiting"
      ? "Waiting for your friend to join..."
      : room.status === "finished"
        ? (room.winner === "draw" ? "It's a draw! Great game." : room.winner === symbol ? `${myName} wins! 🎉` : `${opponentName} wins this round!`)
        : room.turn === symbol
          ? `${myName}, it's your turn!`
          : `Waiting for ${opponentName}...`;

  return (
    <div className="xo-game-wrap">
      {!roomCode ? (
        <>
          <div className="xo-welcome"><div className="xo-mark">❎⭕</div><h3>Play Tic-Tac-Toe live</h3><p className="modal-description">Challenge a friend to a live XO match.</p></div>
          <label className="xo-label" htmlFor="xo-player-name">YOUR DISPLAY NAME</label>
          <input id="xo-player-name" className="xo-input" value={playerName} onChange={e => setPlayerName(e.target.value.slice(0, 18))} placeholder="Enter the name you like" maxLength={18} />
          {initialRoomCode ? (
            <>
              <button className="primary-btn xo-wide" disabled={!uid || busy || !cleanName(playerName)} onClick={joinRoom}>
                {busy ? "Joining..." : "Join friend's game"}
              </button>
              <p className="xo-invite-note">Your friend invited you! Enter your name and join the game.</p>
            </>
          ) : (
            <>
              <button className="primary-btn xo-wide" disabled={!uid || busy || !cleanName(playerName)} onClick={createRoom}>{busy ? "Please wait..." : "＋ Create challenge as X"}</button>
              <div className="xo-or"><span/> OR JOIN A FRIEND <span/></div>
              <input className="xo-input xo-code-input" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} placeholder="6-character invite code" maxLength={6} />
              <button className="secondary-btn dark xo-wide" disabled={!uid || busy || joinCode.length !== 6 || !cleanName(playerName)} onClick={joinRoom}>{busy ? "Joining..." : "Join friend's challenge"}</button>
              <button className="secondary-btn dark xo-wide" onClick={() => setMode("solo")}><Bot size={15}/> Play Solo vs ODDORA AI instead</button>
            </>
          )}
        </>
      ) : (
        <>
          <div className="xo-room-head">
            <div>
              <div className="eyebrow muted">ROOM CODE · {room?.gamesPlayed ? `GAME ${room.gamesPlayed + 1}` : "GAME 1"}</div>
              <strong className="xo-room-code">{roomCode}</strong>
            </div>
          </div>
          <div className="xo-players">
            <div className={symbol === "X" ? "xo-player active" : "xo-player"}><b className="xo-player-symbol">X</b><span>{room?.playerNames?.X || "Waiting..."}</span></div>
            <div className={symbol === "O" ? "xo-player active" : "xo-player"}><b className="xo-player-symbol xo-o">O</b><span>{room?.playerNames?.O || "Waiting for friend"}</span></div>
          </div>
          <div className="xo-status"><span className="eyebrow muted">YOU ARE {symbol || "CONNECTING"}</span><strong>{statusText}</strong></div>
          <div className="xo-board">
            {(room?.board || ["", "", "", "", "", "", "", "", ""]).map((cell, index) => (
              <button
                key={index}
                className={`xo-cell ${cell ? `played ${cell.toLowerCase()}` : ""}`}
                onClick={() => playCell(index)}
                disabled={!symbol || room?.status !== "playing" || room?.turn !== symbol || Boolean(cell)}
              >
                {cell}
              </button>
            ))}
          </div>
          {room?.status === "finished" && (
            <div role="dialog" aria-modal="true" aria-labelledby="xo-result-title" style={{
              position: "fixed", inset: 0, zIndex: 9999, display: "grid", placeItems: "center",
              padding: "22px", background: "rgba(5, 4, 12, .86)", backdropFilter: "blur(12px)"
            }}>
              <div style={{ width: "100%", maxWidth: 390, padding: "28px 22px", borderRadius: 24,
                textAlign: "center", color: "#fff", background: "linear-gradient(145deg, #211936, #12101f)",
                border: "1px solid rgba(177, 139, 255, .38)", boxShadow: "0 24px 90px rgba(0,0,0,.6)" }}>
                <div style={{ fontSize: 48, lineHeight: 1.2, marginBottom: 10 }}>
                  {room.winner === "draw" ? "🤝" : room.winner === symbol ? "🏆" : "😅"}
                </div>
                <div className="eyebrow muted" style={{ marginBottom: 8 }}>ODDORA · XO MULTIPLAYER</div>
                <h2 id="xo-result-title" style={{ fontSize: 29, lineHeight: 1.15, margin: "0 0 10px", color: "#fff" }}>
                  {room.winner === "draw" ? "IT'S A DRAW!" : room.winner === symbol ? "YOU WIN!" : "YOU LOST!"}
                </h2>
                <p style={{ color: "#c8bfdc", fontSize: 14, lineHeight: 1.6, margin: "0 0 20px" }}>
                  {room.winner === "draw" ? "Perfectly matched. Nobody is leaving without a rematch!" : room.winner === symbol ? "You conquered the board! Enjoy your victory." : "Revenge starts in the next round!"}
                </p>
                <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
                  <button className="primary-btn xo-wide" disabled={busy} onClick={() => restartGame(false)}>↻ Rematch – Same sides</button>
                  <button className="secondary-btn dark xo-wide" disabled={busy} onClick={() => restartGame(true)}>⇄ Rematch – Swap sides</button>
                  <button className="secondary-btn dark xo-wide" onClick={shareXOResult}>
                    <Share2 size={15}/> {copied ? "Result copied" : "Share your result"}
                  </button>
                </div>
                <div style={{ borderTop: "1px solid rgba(255,255,255,.12)", paddingTop: 18, marginTop: 4 }}>
                  <div style={{ fontSize: 11, letterSpacing: 2, color: "#b9a0ff", fontWeight: 800, marginBottom: 7 }}>GAME OVER. THE FUN ISN'T.</div>
                  <button className="secondary-btn dark xo-wide" onClick={onCreateChallenge}>✨ Create Your Own Challenge</button>
                  <button className="secondary-btn dark xo-wide" style={{ marginTop: 9 }} onClick={onExplore}>🎮 Explore ODDORA</button>
                </div>
              </div>
            </div>
          )}
          {room?.status === "waiting" && <button className="secondary-btn dark xo-wide" onClick={shareInvitation}><Share2 size={15}/> {copied ? "Link copied" : "Share invitation link"}</button>}
          <button className="secondary-btn dark xo-wide" onClick={() => { setRoomCode(""); setRoom(null); setJoinCode(""); const url = new URL(window.location.href); url.searchParams.delete("xo"); window.history.replaceState({}, "", url.toString()); }}>Leave room</button>
        </>
      )}
      <p className="modal-description xo-notice">{notice}</p>
      <button className="secondary-btn dark xo-wide" onClick={onBack}>Back to OD Games</button>
    </div>
  );
}

const HEART_CHOICES = ["❤️", "💖", "💜", "💙", "💚", "💛", "🧡", "🩷", "🤍"];

function heartAttemptScore(attempts) {
  const extraPicks = Math.max(0, Number(attempts || 2) - 2);
  return Math.max(10, 100 - extraPicks * 5);
}

function CatchMyHeart({ onBack, onExplore, onCreateChallenge, initialRoomCode = "", playSound }) {
  const [mode, setMode] = useState(initialRoomCode ? "multi" : "select");
  const [soloPick, setSoloPick] = useState(null);
  const [aiPick, setAiPick] = useState(null);
  const [soloAttempts, setSoloAttempts] = useState(0);
  const [soloMatched, setSoloMatched] = useState(false);

  const [uid, setUid] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState(initialRoomCode);
  const [room, setRoom] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("Enter your name to create a heart challenge or join a friend.");
  const [copied, setCopied] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);

  useEffect(() => {
    if (initialRoomCode) {
      setJoinCode(initialRoomCode);
      setMode("multi");
    }
  }, [initialRoomCode]);

  useEffect(() => {
    if (mode !== "multi") return undefined;
    let alive = true;
    signInPlayer().then(credential => {
      if (!alive) return;
      setUid(credential.user.uid);
      setNotice("You're connected. Create a heart challenge or join your friend's link.");
    }).catch(() => {
      if (alive) setNotice("Could not connect. Check your internet or play Solo AI mode.");
    });
    return () => { alive = false; };
  }, [mode]);

  useEffect(() => {
    if (!roomCode || mode !== "multi") return undefined;
    const roomRef = ref(database, `rooms/${roomCode}`);
    const unsubscribe = onValue(roomRef, snapshot => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        if (val.status === "finished" && room?.status === "playing") {
          playSound?.("reveal");
        }
        setRoom(val);
      } else {
        setRoom(null);
        setNotice("This heart room no longer exists.");
      }
    }, () => {
      setNotice("Unable to read this room. Check your Realtime Database rules.");
    });
    return () => unsubscribe();
  }, [roomCode, mode]);

  useEffect(() => {
    if (!roomCode || room?.status !== "playing" || !room?.endsAt || mode !== "multi") return undefined;

    const updateClock = () => {
      const remaining = Math.max(0, Math.ceil((Number(room.endsAt) - Date.now()) / 1000));
      setSecondsLeft(remaining);

      if (remaining === 0) {
        runTransaction(ref(database, `rooms/${roomCode}`), current => {
          if (!current || current.gameType !== "catch-heart" || current.status !== "playing") return;
          if (Number(current.endsAt || 0) > Date.now()) return;
          return { ...current, status: "finished", finishReason: "timeout" };
        }).catch(() => {});
      }
    };

    updateClock();
    const timerId = window.setInterval(updateClock, 250);
    return () => window.clearInterval(timerId);
  }, [roomCode, room?.status, room?.endsAt, mode]);

  function handleSoloHeart(index) {
    if (soloMatched) return;
    playSound?.("tap");
    triggerHaptic(14);
    const botIndex = Math.floor(Math.random() * HEART_CHOICES.length);
    const attempts = soloAttempts + 1;
    setSoloPick(index);
    setAiPick(botIndex);
    setSoloAttempts(attempts);

    if (index === botIndex) {
      setSoloMatched(true);
      playSound?.("reveal");
      triggerHaptic([25, 40, 25]);
    }
  }

  function resetSoloHeart() {
    playSound?.("tap");
    setSoloPick(null);
    setAiPick(null);
    setSoloAttempts(0);
    setSoloMatched(false);
  }

  const cleanName = value => value.trim().replace(/\s+/g, " ").slice(0, 18);
  const mySide = room?.players?.X === uid ? "X" : room?.players?.O === uid ? "O" : "";
  const myChoice = mySide ? room?.choices?.[mySide] : "";
  const hasHeartChoice = value => value !== "" && value !== null && value !== undefined;
  const bothPicked = hasHeartChoice(room?.choices?.X) && hasHeartChoice(room?.choices?.O);

  async function createRoom() {
    const name = cleanName(playerName);
    if (!uid || busy || !name) { setNotice("Enter your name first."); return; }
    setBusy(true); setNotice("Creating your heart challenge...");
    try {
      let code = ""; let exists = true;
      for (let attempt = 0; attempt < 8 && exists; attempt += 1) {
        code = Math.random().toString(36).slice(2, 8).toUpperCase();
        const snapshot = await get(ref(database, `rooms/${code}`));
        exists = snapshot.exists();
      }
      if (exists) throw new Error("Could not generate a room code. Please try again.");
      const newRoom = {
        gameType: "catch-heart", players: { X: uid, O: "" },
        playerNames: { X: name, O: "" }, choices: { X: null, O: null },
        attempts: 0, status: "waiting", round: 1, createdAt: Date.now()
      };
      await set(ref(database, `rooms/${code}`), newRoom);
      setRoomCode(code);
      playSound?.("magic");
      setNotice("Your heart challenge is ready. Invite your friend!");
      const url = new URL(window.location.href); url.search = ""; url.searchParams.set("heart", code);
      window.history.replaceState({}, "", url.toString());
    } catch (error) {
      setNotice(error.message || "Could not create the challenge.");
    } finally { setBusy(false); }
  }

  async function joinRoom() {
    const name = cleanName(playerName);
    const code = joinCode.trim().toUpperCase();

    if (!uid || busy || !name || code.length !== 6) {
      setNotice("Enter your name and the 6-character invite code.");
      return;
    }

    setBusy(true);
    setNotice("Joining your friend's heart challenge...");

    try {
      const roomRef = ref(database, `rooms/${code}`);
      const existingSnapshot = await get(roomRef);

      if (!existingSnapshot.exists()) {
        throw new Error("This heart room does not exist. Check the invite code.");
      }

      const existingRoom = existingSnapshot.val();
      if (existingRoom.gameType !== "catch-heart") {
        throw new Error("That code belongs to a different game.");
      }

      if (existingRoom.players?.X === uid) {
        throw new Error("You created this room. Open the invitation on another browser to join as Player 2.");
      }

      let usedPreflightFallback = false;
      const result = await runTransaction(roomRef, current => {
        if (!current) {
          if (usedPreflightFallback) return;
          usedPreflightFallback = true;
          current = existingRoom;
        }
        if (current.gameType !== "catch-heart") return;
        if (current.players?.X === uid) return current;
        if (current.players?.O === uid) {
          return { ...current, playerNames: { ...(current.playerNames || {}), O: name } };
        }
        if (current.status !== "waiting" || current.players?.O) return;

        return {
          ...current,
          players: { ...current.players, O: uid },
          playerNames: { ...(current.playerNames || {}), O: name },
          choices: { X: null, O: null },
          attempts: 0,
          startedAt: Date.now(),
          endsAt: Date.now() + 60000,
          status: "playing"
        };
      });

      if (!result.committed || !result.snapshot.exists()) {
        throw new Error("Could not join. The room may already be full.");
      }

      setRoomCode(code);
      playSound?.("magic");
      setNotice("You're in! Choose a heart when you're ready.");
      const url = new URL(window.location.href);
      url.search = "";
      url.searchParams.set("heart", code);
      window.history.replaceState({}, "", url.toString());
    } catch (error) {
      setNotice(error.message || "Could not join this room.");
    } finally {
      setBusy(false);
    }
  }

  async function chooseHeart(index) {
    if (!roomCode || !mySide || room?.status !== "playing" || busy) return;
    playSound?.("tap");
    triggerHaptic(12);
    setBusy(true);

    try {
      await runTransaction(ref(database, `rooms/${roomCode}`), current => {
        if (!current || current.gameType !== "catch-heart" || current.status !== "playing") return;
        if (Number(current.endsAt || 0) <= Date.now()) {
          return { ...current, status: "finished", finishReason: "timeout" };
        }

        const previousChoice = current.choices?.[mySide];
        if (previousChoice === index) return current;

        const choices = { ...(current.choices || {}), [mySide]: index };
        const attempts = Number(current.attempts || 0) + 1;
        const matched = choices.X !== null && choices.X !== undefined &&
          choices.O !== null && choices.O !== undefined &&
          choices.X === choices.O;

        return {
          ...current,
          choices,
          attempts,
          status: matched ? "finished" : "playing",
          finishReason: matched ? "match" : null
        };
      });
    } finally {
      setBusy(false);
    }
  }

  async function playAgain(swapSides = false) {
    if (!roomCode || !room || room.status !== "finished" || !mySide || busy) return;
    setBusy(true);
    try {
      await runTransaction(ref(database, `rooms/${roomCode}`), current => {
        if (!current || current.gameType !== "catch-heart" || current.status !== "finished" || !current.players?.X || !current.players?.O) return;
        const players = swapSides ? { X: current.players.O, O: current.players.X } : current.players;
        const playerNames = swapSides
          ? { X: current.playerNames?.O || "Player 2", O: current.playerNames?.X || "Player 1" }
          : (current.playerNames || {});
        return {
          ...current, players, playerNames,
          choices: { X: null, O: null }, attempts: 0, status: "playing",
          revealed: false, finishReason: null, startedAt: Date.now(),
          endsAt: Date.now() + 60000, round: (current.round || 1) + 1
        };
      });
    } finally { setBusy(false); }
  }

  async function shareInvitation() {
    if (!roomCode) return;
    const url = new URL(window.location.href); url.search = ""; url.searchParams.set("heart", roomCode);
    const shareUrl = url.toString();
    const shareText = `${room?.playerNames?.X || playerName || "Your friend"} sent you a Catch My Heart challenge on ODDORA!`;
    try {
      if (navigator.share) await navigator.share({ title: "Catch My Heart · ODDORA", text: shareText, url: shareUrl });
      else { await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    } catch {}
  }

  async function shareHeartResult() {
    const attempts = Number(room?.attempts || 0);
    const score = heartAttemptScore(attempts);
    const quote = sameHeart
      ? "Some hearts just know where to meet."
      : "Different choices, same lovely chaos.";
    const resultText = sameHeart
      ? `💘 ${room?.playerNames?.X || "Player 1"} & ${room?.playerNames?.O || "Player 2"} found their match in ${attempts} picks! ODDORA match score: ${score}%.`
      : `⏰ Our Catch My Heart round ran out of time. Play another round on ODDORA!`;
    const playUrl = `${window.location.origin}/`;
    try {
      const file = await shareODDORAResultCard({
        game: "Catch My Heart",
        headline: sameHeart ? "HEARTS IN SYNC!" : "TIME'S UP!",
        subtitle: sameHeart
          ? `${room?.playerNames?.X || "Player 1"} & ${room?.playerNames?.O || "Player 2"} found their match.`
          : "The clock ran out. Ready for another round?",
        detail: sameHeart ? `${score}% ODDORA MATCH SCORE · ${attempts} PICKS` : "TRY AGAIN TOGETHER",
        quote,
        url: playUrl
      });
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({ title: "Catch My Heart · ODDORA", text: resultText, url: playUrl, files: [file] });
      } else {
        const imageUrl = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = imageUrl;
        a.download = "oddora-catch-my-heart-result.png";
        a.click();
        URL.revokeObjectURL(imageUrl);
        await navigator.clipboard?.writeText(`${resultText}\n${playUrl}`);
        setNotice("Result image downloaded and game link copied.");
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {}
  }

  if (mode === "select") {
    return (
      <div className="heart-game-wrap">
        <div className="heart-welcome">
          <div className="heart-welcome-icon">💘</div>
          <h3>Choose your heart mode</h3>
          <p className="modal-description">Test your intuition against ODDORA AI solo or sync up with a friend.</p>
        </div>
        <div className="prank-mode-options">
          <button type="button" className="prank-mode-card active" onClick={() => { playSound?.("tap"); setMode("solo"); }}>
            <span><Bot size={28}/></span>
            <strong>Solo vs ODDORA AI</strong>
            <small>Mind-sync intuition test</small>
          </button>
          <button type="button" className="prank-mode-card" onClick={() => { playSound?.("tap"); setMode("multi"); }}>
            <span><Users size={28}/></span>
            <strong>Play with a Friend</strong>
            <small>60s live heart sync</small>
          </button>
        </div>
        <button className="secondary-btn dark xo-wide" onClick={onBack}>Back to OD Games</button>
      </div>
    );
  }

  if (mode === "solo") {
    const score = heartAttemptScore(soloAttempts + 1);
    return (
      <div className="heart-game-wrap">
        <div className="heart-pick-status">
          <strong>{soloMatched ? "💞 HEARTS IN SYNC!" : "Pick the same heart as ODDORA AI 💗"}</strong>
          <span>
            {soloPick !== null
              ? `You picked ${HEART_CHOICES[soloPick]} · AI picked ${HEART_CHOICES[aiPick]} (Picks: ${soloAttempts})`
              : "Tap any heart below to test your intuition"}
          </span>
        </div>

        {soloMatched ? (
          <div className="heart-result">
            <div className="heart-burst">💞</div>
            <h3>MATCHED IN {soloAttempts} {soloAttempts === 1 ? "PICK" : "PICKS"}!</h3>
            <div className="heart-score-card">
              <strong>{score}%</strong>
              <span>INTUITION SYNC SCORE</span>
              <small>You and ODDORA AI chose {HEART_CHOICES[soloPick]}</small>
            </div>
            <button className="primary-btn xo-wide" onClick={resetSoloHeart}>
              <RotateCcw size={16}/> Play again vs AI
            </button>
          </div>
        ) : (
          <div className="heart-grid">
            {HEART_CHOICES.map((heart, index) => (
              <button
                key={heart}
                type="button"
                className={`heart-choice ${soloPick === index ? "selected" : ""}`}
                onClick={() => handleSoloHeart(index)}
              >
                {heart}
              </button>
            ))}
          </div>
        )}

        <button className="secondary-btn dark xo-wide" onClick={() => setMode("multi")}>
          <Users size={15}/> Challenge a Friend Live
        </button>
        <button className="secondary-btn dark xo-wide" onClick={onBack}>Back to OD Games</button>
      </div>
    );
  }

  const sameHeart = bothPicked && room.choices.X === room.choices.O;
  const totalAttempts = Number(room?.attempts || 0);
  const matchScore = heartAttemptScore(totalAttempts);

  return (
    <div className="heart-game-wrap">
      {!roomCode ? (
        <>
          <div className="heart-welcome"><div className="heart-welcome-icon">💘</div><h3>Catch My Heart</h3><p className="modal-description">Two players. One secret heart each. Let's see if your choices match.</p></div>
          <label className="xo-label" htmlFor="heart-player-name">YOUR DISPLAY NAME</label>
          <input id="heart-player-name" className="xo-input" value={playerName} onChange={e => setPlayerName(e.target.value.slice(0, 18))} placeholder="Enter your name" maxLength={18} />
          {initialRoomCode ? (
            <>
              <button className="primary-btn xo-wide" disabled={!uid || busy || !cleanName(playerName)} onClick={joinRoom}>
                {busy ? "Joining..." : "Join friend's game"}
              </button>
              <p className="xo-invite-note">Your friend invited you! Enter your name and join the heart game.</p>
            </>
          ) : (
            <>
              <button className="primary-btn xo-wide" disabled={!uid || busy || !cleanName(playerName)} onClick={createRoom}>
                {busy ? "Please wait..." : "💘 Create heart challenge"}
              </button>
              <div className="xo-or"><span/> OR JOIN A FRIEND <span/></div>
              <input className="xo-input xo-code-input" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} placeholder="6-character invite code" maxLength={6} />
              <button className="secondary-btn dark xo-wide" disabled={!uid || busy || joinCode.length !== 6 || !cleanName(playerName)} onClick={joinRoom}>
                {busy ? "Joining..." : "Join friend's challenge"}
              </button>
              <button className="secondary-btn dark xo-wide" onClick={() => setMode("solo")}><Bot size={15}/> Play Solo vs ODDORA AI instead</button>
            </>
          )}
        </>
      ) : !room ? (
        <div className="heart-waiting"><div className="heart-welcome-icon">💗</div><h3>Loading your heart room...</h3></div>
      ) : (
        <>
          <div className="xo-room-head"><div><div className="eyebrow muted">HEART ROOM · ROUND {room.round || 1}</div><strong className="xo-room-code">{roomCode}</strong></div></div>
          <div className="xo-players">
            <div className={mySide === "X" ? "xo-player active" : "xo-player"}><b className="xo-player-symbol">♥</b><span>{room.playerNames?.X || "Player 1"}</span></div>
            <div className={mySide === "O" ? "xo-player active" : "xo-player"}><b className="xo-player-symbol xo-o">♥</b><span>{room.playerNames?.O || "Waiting for friend"}</span></div>
          </div>
          {room.status === "waiting" ? (
            <div className="heart-waiting"><div className="heart-welcome-icon">💌</div><h3>Waiting for your person...</h3><p>Share the invite link. Your friend joins as Player 2.</p></div>
          ) : room.status === "finished" ? (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="heart-result-title"
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 10000,
                display: "grid",
                placeItems: "center",
                padding: "22px",
                background: "rgba(5, 4, 12, .86)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                overflowY: "auto"
              }}
            >
              <div
                className="heart-result"
                role="status"
                aria-live="polite"
                style={{
                  width: "100%",
                  maxWidth: 390,
                  maxHeight: "min(88vh, 820px)",
                  overflowY: "auto",
                  padding: "28px 22px",
                  borderRadius: 24,
                  textAlign: "center",
                  color: "#fff",
                  background: "linear-gradient(145deg, #211936, #12101f)",
                  border: "1px solid rgba(231, 117, 207, .38)",
                  boxShadow: "0 24px 90px rgba(0,0,0,.6)"
                }}
              >
                <div className="heart-burst">{sameHeart ? "💞" : "⏰"}</div>
                <div className="eyebrow muted">ODDORA · CATCH MY HEART</div>
                <h3 id="heart-result-title">{sameHeart ? "HEARTS IN SYNC!" : "TIME'S UP!"}</h3>
                <p className="heart-result-copy">
                  {sameHeart
                    ? "You both found the same heart. Now that's a lovely coincidence!"
                    : "The clock ran out! Different picks, same team — try another round."}
                </p>
                {sameHeart && (
                  <div className="heart-score-card">
                    <strong>{matchScore}%</strong>
                    <span>ODDORA MATCH SCORE</span>
                    <small>Matched in {totalAttempts} heart {totalAttempts === 1 ? "pick" : "picks"}</small>
                  </div>
                )}
                <p className="heart-result-quote">
                  {sameHeart
                    ? "“Some hearts just know where to meet.” 💗"
                    : "“Different choices, same lovely chaos.” 💞"}
                </p>
                <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
                  <button className="primary-btn xo-wide" disabled={busy} onClick={() => playAgain(false)}>↻ Rematch – Same sides</button>
                  <button className="secondary-btn dark xo-wide" disabled={busy} onClick={() => playAgain(true)}>⇄ Rematch – Swap sides</button>
                  <button className="secondary-btn dark xo-wide" onClick={shareHeartResult}>
                    <Share2 size={15}/> {copied ? "Result copied" : "Share your result"}
                  </button>
                </div>
                <div style={{ borderTop: "1px solid rgba(255,255,255,.12)", paddingTop: 18, marginTop: 4 }}>
                  <div style={{ fontSize: 11, letterSpacing: 2, color: "#b9a0ff", fontWeight: 800, marginBottom: 7 }}>GAME OVER. THE FUN ISN'T.</div>
                  <button className="secondary-btn dark xo-wide" onClick={onCreateChallenge}>✨ Create Your Own Challenge</button>
                  <button className="secondary-btn dark xo-wide" style={{ marginTop: 9 }} onClick={onExplore}>🎮 Explore ODDORA</button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="heart-pick-status">
                <strong>Tap hearts until you both find the same one 💗</strong>
                <span>
                  Your pick: {myChoice !== null && myChoice !== undefined ? HEART_CHOICES[myChoice] : "Not picked yet"}
                </span>
                <strong className="heart-timer">⏱ 00:{String(secondsLeft).padStart(2, "0")}</strong>
              </div>
              <div className="heart-grid" aria-label="Choose a heart">
                {HEART_CHOICES.map((heart, index) => (
                  <button
                    key={heart}
                    type="button"
                    className={`heart-choice ${myChoice === index ? "selected" : ""}`}
                    onClick={() => chooseHeart(index)}
                    disabled={busy || room.status !== "playing"}
                    aria-label={`Choose heart ${index + 1}`}
                    aria-pressed={myChoice === index}
                  >
                    {heart}
                  </button>
                ))}
              </div>
              <p className="heart-private-note">Keep changing your pick. Match the same heart before the 60-second timer ends!</p>
            </>
          )}
          {room.status === "waiting" && <button className="secondary-btn dark xo-wide" onClick={shareInvitation}><Share2 size={15}/> {copied ? "Link copied" : "Share invitation link"}</button>}
          <button className="secondary-btn dark xo-wide" style={{ marginTop: 10 }} onClick={() => { setRoomCode(""); setRoom(null); setJoinCode(""); const url = new URL(window.location.href); url.searchParams.delete("heart"); window.history.replaceState({}, "", url.toString()); }}>Leave room</button>
        </>
      )}
      <p className="modal-description xo-notice">{notice}</p>
      <button className="secondary-btn dark xo-wide" onClick={onBack}>Back to OD Games</button>
    </div>
  );
}

export default App;
