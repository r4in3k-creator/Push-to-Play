/* Browser tests. They live in the repo because the earlier suites lived only in
   a scratch directory and were lost when that machine was recycled.

   Run:   python3 -m http.server 8099      (from the repo root, in one terminal)
          node tests/app.test.js           (in another; needs `npm i playwright`)
   Pass a different address as the first argument if 8099 is taken.           */
const { chromium } = require("playwright");
const B = process.argv[2] || "http://127.0.0.1:8099/";
const PHONE = { viewport:{width:390,height:844}, isMobile:true, hasTouch:true,
  userAgent:"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" };
const DESK = { viewport:{width:1280,height:950} };
const VIEWS = ["train","splits","cardio","calendar","records","account","settings"];
const day = d => { const x=new Date(); x.setDate(x.getDate()+d);
  return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0"); };

function contrast(a, b){
  const px = s => s.match(/\d+(\.\d+)?/g).slice(0,3).map(Number);
  const lum = c => { const [r,g,bl] = px(c).map(v=>{ v/=255; return v<=0.04045 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4); });
    return 0.2126*r + 0.7152*g + 0.0722*bl; };
  const l1 = lum(a), l2 = lum(b);
  return Math.round(((Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05))*100)/100;
}

(async()=>{
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath:process.env.PW_CHROMIUM } : {});
  const errors = []; let pass = 0, fail = 0;
  const ok = (name, cond, detail) => { if(cond) pass++; else { fail++; console.log("FAIL " + name + (detail !== undefined ? "  -> " + JSON.stringify(detail) : "")); } };

  const open = async (opts, scheme, seed, extra) => {
    const ctx = await browser.newContext(Object.assign({ colorScheme:scheme || "light" }, opts, extra || {}));
    const p = await ctx.newPage();
    p.on("pageerror", e => errors.push("PAGEERROR " + e.message));
    p.on("console", m => { if(m.type()==="error" && !/ERR_|Failed to load|fonts\.g/.test(m.text())) errors.push(m.text()); });
    p.on("dialog", d => d.accept(""));
    await p.goto(B); await p.waitForTimeout(700);
    if(seed){
      await p.evaluate(d => { for(const k in d) localStorage.setItem(k, d[k]); }, seed);
      await p.reload(); await p.waitForTimeout(700);
    }
    return { ctx, p };
  };
  const add = async (p, name) => {
    await p.fill("#search", name); await p.waitForTimeout(380);
    await p.click("#groups .card .add-btn"); await p.waitForTimeout(220);
    await p.fill("#search", ""); await p.waitForTimeout(220);
  };
  const workout = async p => { await p.click('#modeSwitch button[data-mode="workout"]').catch(()=>{}); await p.waitForTimeout(350); };
  const tray = p => p.evaluate(() => JSON.parse(localStorage.getItem("ptp-tray") || "[]"));
  /* Sets are logged on each exercise's own page. */
  const focus = async (p, n) => { await p.locator(".tray-item .open-btn").nth(n || 0).click(); await p.waitForTimeout(380); };
  const F = "#focusPage ";

  /* ---------- 1. every view, both themes, both widths ---------- */
  for(const [label, opts] of [["phone",PHONE],["desk",DESK]]){
    for(const scheme of ["light","dark"]){
      const { ctx, p } = await open(opts, scheme);
      const bad = [];
      for(const v of VIEWS){
        await p.click(`.viewtab[data-view="${v}"]`).catch(async()=>{
          await p.click("#avatarBtn"); await p.waitForTimeout(200);
          await p.click(`#acctMenu [data-go="${v}"]`).catch(()=>{});
        });
        await p.waitForTimeout(330);
        const o = await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
        const painted = await p.evaluate(()=>{ const e=document.querySelector(".view.active"); return !!e && e.getBoundingClientRect().height>50; });
        if(o>0 || !painted) bad.push(v);
      }
      ok(`views render without overflow (${label}/${scheme})`, bad.length===0, bad);
      await ctx.close();
    }
  }

  /* The tab bar is a fixed child of the header. A filter or transform on the
     header silently re-anchors it there — this pins it to the screen. */
  {
    const { ctx, p } = await open(PHONE);
    const g = await p.evaluate(()=>{ const r=document.getElementById("viewtabs").getBoundingClientRect();
      return { bottom:Math.round(r.bottom), vh:window.innerHeight, top:Math.round(r.top) }; });
    ok("phone tab bar sits at the bottom of the screen", g.bottom===g.vh && g.top > g.vh/2, g);
    const hit = await p.evaluate(()=>{ const b=document.getElementById("avatarBtn").getBoundingClientRect();
      const e=document.elementFromPoint(b.left+b.width/2, b.top+b.height/2); return !!e && !!e.closest("#avatarBtn"); });
    ok("nothing covers the profile button", hit);
    await ctx.close();
  }

  /* ---------- 2. contrast and tap targets ---------- */
  for(const scheme of ["light","dark"]){
    const { ctx, p } = await open(PHONE, scheme);
    await add(p, "Barbell Bench Press"); await workout(p);
    const c = await p.evaluate(()=>{
      const col = sel => { const e=document.querySelector(sel); return e ? getComputedStyle(e).color : null; };
      const bg = sel => { let e=document.querySelector(sel);
        while(e){ const b=getComputedStyle(e).backgroundColor;
          if(b && b!=="rgba(0, 0, 0, 0)" && b!=="transparent" && !/rgba\(.*, 0\.\d+\)/.test(b)) return b; e=e.parentElement; }
        return getComputedStyle(document.body).backgroundColor; };
      return { exName:[col(".ex-name"),bg(".ex-name")], badge:[col(".badge"),bg(".badge")],
               logBtn:[col(".tray-actions .log"),bg(".tray-actions .log")] };
    });
    for(const k in c) ok(`contrast ${k} >= 4.5 (${scheme})`, contrast(c[k][0], c[k][1]) >= 4.5, contrast(c[k][0], c[k][1]));
    await ctx.close();
  }
  {
    const { ctx, p } = await open(PHONE);
    await add(p, "Barbell Bench Press");
    const small1 = await p.$$eval("#groups .add-btn, #groups .ex-menu-btn",
      els => els.map(e=>{ const r=e.getBoundingClientRect(); return Math.round(Math.min(r.width,r.height)); }).filter(v=>v<40));
    ok("directory targets >= 40px", small1.length===0, small1.slice(0,3));
    await workout(p);
    const small2 = await p.$$eval(".tray-item .icon-btn, .tray-actions button",
      els => els.map(e=>{ const r=e.getBoundingClientRect(); return Math.round(Math.min(r.width,r.height)); }).filter(v=>v>0&&v<40));
    ok("workout targets >= 40px", small2.length===0, small2);
    await focus(p);
    const small3 = await p.$$eval("#focusPage button, #focusPage .check-wrap, #focusPage .set-input",
      els => els.map(e=>{ const r=e.getBoundingClientRect(); return Math.round(Math.min(r.width,r.height)); }).filter(v=>v>0&&v<44));
    ok("exercise page targets >= 44px", small3.length===0, small3);
    const ov = await p.evaluate(()=>{ const f=document.getElementById("focusPage"); return f.scrollWidth - f.clientWidth; });
    ok("exercise page does not scroll sideways", ov===0, ov);
    await ctx.close();
  }

  /* ---------- 3. the core loop ---------- */
  {
    const { ctx, p } = await open(PHONE);
    await add(p, "Barbell Bench Press"); await workout(p);
    await focus(p);
    await p.fill(F+".set-row .weight-input", "100"); await p.fill(F+".set-row .reps-input", "5");
    await p.click(F+".set-row .check-wrap"); await p.waitForTimeout(350);
    await p.click("#focusBack"); await p.waitForTimeout(350);
    await p.click("#logBtn"); await p.waitForTimeout(500);
    const h = await p.evaluate(()=>JSON.parse(localStorage.getItem("ptp-history")||"[]"));
    ok("a session logs", h.length===1 && h[0].items[0].setLog[0].weight==="100", h);
    await p.click('.viewtab[data-view="calendar"]'); await p.waitForTimeout(450);
    ok("the calendar shows it", (await p.$$(".sess-ex")).length===1);
    const dot = await p.$$eval(".cal-cell .cal-dots span", els => els.length ? getComputedStyle(els[0]).backgroundColor : null);
    ok("category hue is still the validated push red", dot==="rgb(192, 69, 41)", dot);
    ok("catalogue is intact", await (async()=>{ await p.click('.viewtab[data-view="train"]'); await p.waitForTimeout(350);
      await p.click('#modeSwitch button[data-mode="browse"]').catch(()=>{}); await p.waitForTimeout(350);
      return (await p.$$("#groups .card")).length; })() === 417);
    await ctx.close();
  }

  /* ---------- 4. progression ---------- */
  const HIST = sets => JSON.stringify([{ date:day(-3), loggedAt:new Date().toISOString(), items:[
    { id:"push-0", n:"Barbell Bench Press", cat:"push", eq:"Barbell", sets:sets.length,
      setLog:sets.map(([w,r])=>({ weight:String(w), reps:String(r), done:true })) }]}]);
  let plainHeight = 0;
  {
    // no rule set: nothing new on screen
    const { ctx, p } = await open(PHONE, "light", { "ptp-history":HIST([[100,5],[100,5],[100,5]]) });
    await add(p, "Barbell Bench Press"); await workout(p);
    ok("no rule, no pill", (await p.$$(".next-pill")).length===0);
    plainHeight = await p.$eval(".tray-item", e=>Math.round(e.getBoundingClientRect().height));
    await ctx.close();
  }
  {
    const { ctx, p } = await open(PHONE, "light", { "ptp-history":HIST([[100,5],[100,5],[100,5]]),
      "ptp-ex-prefs":JSON.stringify({ "push-0":{ prog:"linear" } }) });
    await add(p, "Barbell Bench Press"); await workout(p);
    const pill = await p.$eval(".next-pill", e=>e.textContent.trim()).catch(()=>null);
    ok("linear: pill shows the next step", pill==="102.5 × 5", pill);
    const rowsBefore = await p.$eval(".tray-item", e=>e.getBoundingClientRect().height);
    ok("pill lives in the existing badge row", await p.$eval(".next-pill", e=>e.parentElement.classList.contains("head-meta")));
    const withRule = await p.$eval(".tray-item", e=>Math.round(e.getBoundingClientRect().height));
    ok("the suggestion costs no extra height on a phone", withRule <= plainHeight + 2, { plainHeight, withRule });
    const hit = await p.$eval(".next-pill", e=>{ const r=e.getBoundingClientRect(), a=getComputedStyle(e,"::after");
      const m=(a.inset||"").match(/-?\d+/g)||[0]; return Math.round(r.height + Math.abs(+m[0])*2); });
    ok("pill hit area >= 40px", hit >= 40, hit);
    await p.click(".next-pill"); await p.waitForTimeout(400);
    const t = await tray(p);
    ok("one tap fills every blank set", t[0].setLog.every(s=>s.weight==="102.5" && s.reps==="5"), t[0].setLog);
    ok("filling does not tick anything", t[0].setLog.every(s=>!s.done));
    ok("the pill opens the exercise page", await p.isVisible("#focusPage"));
    // a typed number is a decision the suggestion must not overrule
    await p.fill(F+".set-row .weight-input", "95"); await p.keyboard.press("Tab"); await p.waitForTimeout(250);
    await p.click(F+".next-pill"); await p.waitForTimeout(350);
    ok("a typed value survives a second tap", (await tray(p))[0].setLog[0].weight==="95");
    void rowsBefore;
    await ctx.close();
  }
  {
    const { ctx, p } = await open(PHONE, "light", { "ptp-history":HIST([[40,12],[40,12],[40,12]]),
      "ptp-ex-prefs":JSON.stringify({ "push-0":{ prog:"double", progLo:"8", progHi:"12" } }) });
    await add(p, "Barbell Bench Press"); await workout(p);
    ok("double: top of range adds weight", (await p.$eval(".next-pill", e=>e.textContent.trim()))==="42.5 × 8");
    await ctx.close();
  }
  {
    const { ctx, p } = await open(PHONE, "light", { "ptp-history":HIST([[100,5],[100,5],[100,10]]),
      "ptp-ex-prefs":JSON.stringify({ "push-0":{ prog:"gslp" } }) });
    await add(p, "Barbell Bench Press"); await workout(p);
    ok("greyskull: doubled last set earns a double jump", (await p.$eval(".next-pill", e=>e.textContent.trim()))==="105 × 5+");
    await focus(p);
    const ph = await p.$$eval(F+".set-row .reps-input", els=>els.map(e=>e.placeholder));
    ok("only the last set is open-ended", ph.join(",")==="5,5,5+", ph);
    await ctx.close();
  }
  {
    // choosing a rule from the item menu mid-workout
    const { ctx, p } = await open(PHONE, "light", { "ptp-history":HIST([[100,5],[100,5],[100,5]]) });
    await add(p, "Barbell Bench Press"); await workout(p);
    await p.click(".tray-item .ellipsis"); await p.waitForTimeout(350);
    await p.click('[data-prog="linear"]'); await p.waitForTimeout(400);
    ok("menu chip turns the rule on", (await p.$$(".next-pill")).length===1);
    const prefs = await p.evaluate(()=>JSON.parse(localStorage.getItem("ptp-ex-prefs")));
    ok("the rule is stored per exercise", prefs["push-0"].prog==="linear", prefs);
    await p.click('[data-prog=""]'); await p.waitForTimeout(400);
    ok("Off removes it again", (await p.$$(".next-pill")).length===0);
    await ctx.close();
  }
  {
    // the exercise editor saves increment and a rep range
    const { ctx, p } = await open(DESK);
    await p.fill("#search", "Barbell Bench Press"); await p.waitForTimeout(400);
    await p.click("#groups .card .ex-menu-btn"); await p.waitForTimeout(400);
    await p.selectOption("#edProg", "double");
    await p.fill("#edProgInc", "1.25"); await p.fill("#edProgReps", "6-10");
    await p.click("#edSave"); await p.waitForTimeout(450);
    const pr = (await p.evaluate(()=>JSON.parse(localStorage.getItem("ptp-ex-prefs"))))["push-0"];
    ok("editor saves rule, increment and range", pr.prog==="double" && pr.progInc==="1.25" && pr.progLo==="6" && pr.progHi==="10", pr);
    await ctx.close();
  }

  /* ---------- 5. motion: only what changed moves ---------- */
  {
    const { ctx, p } = await open(PHONE);
    await add(p, "Barbell Bench Press");
    await add(p, "Barbell Bent-Over Row");
    await workout(p); await p.waitForTimeout(450);
    ok("an entrance class is removed once it has played", (await p.$$(".tray-item.enter")).length===0);
    await p.click('.viewtab[data-view="calendar"]'); await p.waitForTimeout(300);
    await p.click('.viewtab[data-view="train"]'); await p.waitForTimeout(120);
    ok("leaving the tab and returning does not replay it", (await p.$$(".tray-item.enter")).length===0);
    await workout(p);
    await p.locator(".tray-item .open-btn").first().click(); await p.waitForTimeout(60);
    ok("opening the exercise page slides it in", (await p.$$("#focusPage.opening")).length===1);
    await p.waitForTimeout(400);
    await p.click(F+".set-row .check-wrap"); await p.waitForTimeout(80);
    ok("ticking pops exactly one tick", (await p.$$(".checkmark.pop")).length===1);
    ok("...and does not replay the page entrance", (await p.$$("#focusPage.opening, .focus-body.slide-l")).length===0);
    await p.waitForTimeout(350);
    await p.locator(F+".set-row .check-wrap").nth(1).click(); await p.waitForTimeout(80);
    ok("the earlier tick does not pop again", (await p.$$(".checkmark.pop")).length===1);
    await p.waitForTimeout(350);
    await p.click(F+"[data-fnextex]"); await p.waitForTimeout(60);
    ok("next exercise slides in from the right", (await p.$$(".focus-body.slide-l")).length===1);
    await ctx.close();
  }
  {
    const { ctx, p } = await open(DESK);
    await p.click(".split-btn"); await p.waitForTimeout(60);
    const delays = await p.$$eval(".tray-item.enter", els=>els.map(e=>e.style.animationDelay));
    ok("a loaded split staggers its rows in", delays.length===6 && delays[0]==="0ms" && delays[5]==="175ms", delays);
    await p.click('.viewtab[data-view="calendar"]'); await p.waitForTimeout(60);
    const an = await p.$eval(".view.active", e=>getComputedStyle(e).animationName);
    ok("switching view animates in", an==="viewIn", an);
    await ctx.close();
  }
  {
    const { ctx, p } = await open(PHONE, "light", null, { reducedMotion:"reduce" });
    await add(p, "Barbell Bench Press"); await workout(p);
    await p.locator(".tray-item .open-btn").first().click(); await p.waitForTimeout(60);
    const d = await p.$eval("#focusPage", e=>getComputedStyle(e).animationDuration);
    ok("reduced motion turns it off", parseFloat(d) < 0.01, d);
    await ctx.close();
  }


  /* ---------- 6. the exercise page ---------- */
  {
    const { ctx, p } = await open(PHONE);
    await add(p, "Barbell Bench Press");
    await add(p, "Barbell Bent-Over Row");
    await workout(p);
    ok("the workout list holds no set rows", (await p.$$(".tray-item .set-row")).length===0);
    await focus(p);
    ok("tapping an exercise opens its page", await p.isVisible("#focusPage"));
    ok("the page is only that exercise", (await p.textContent("#focusTitle")).trim()==="Barbell Bench Press");
    ok("it says where you are", (await p.textContent("#focusPos")).trim()==="1 of 2");
    const covered = await p.evaluate(()=>{ const t=document.getElementById("viewtabs").getBoundingClientRect();
      const e=document.elementFromPoint(t.left+t.width/2, t.top+t.height/2); return !!e && !!e.closest("#focusPage"); });
    ok("the page covers the tab bar", covered);
    await p.click(F+"[data-faddset]"); await p.waitForTimeout(250);
    ok("Add a set adds one", (await tray(p))[0].sets===4 && (await p.$$(F+".set-row")).length===4);
    await p.click(F+"[data-fdropset]"); await p.waitForTimeout(250);
    ok("Remove last set removes one", (await tray(p))[0].sets===3);
    for(let i=0;i<3;i++){ await p.locator(F+".set-row .check-wrap").nth(i).click(); await p.waitForTimeout(150); }
    ok("finishing every set says so", /All 3 sets done/.test(await p.textContent(F+".fx-progress")));
    ok("...and lights up the next exercise", (await p.$$(F+".fx-next.ready")).length===1);
    ok("a tick starts the rest countdown on the page", (await p.$$(F+".fx-rest.on [data-tleft]")).length===1);
    await p.click(F+"[data-fskip]"); await p.waitForTimeout(250);
    ok("Skip rest stops it", (await p.$$(F+".fx-rest.on")).length===0);
    await p.click(F+"[data-fnextex]"); await p.waitForTimeout(350);
    ok("Next walks to the next exercise", (await p.textContent("#focusTitle")).trim()==="Barbell Bent-Over Row"
      && (await p.textContent("#focusPos")).trim()==="2 of 2");
    ok("the last exercise offers the way back", (await p.$$(F+"[data-fdone]")).length===1);
    await p.click(F+"[data-fprev]"); await p.waitForTimeout(350);
    ok("Previous walks back", (await p.textContent("#focusTitle")).trim()==="Barbell Bench Press");
    await p.goBack(); await p.waitForTimeout(350);
    ok("the phone's back gesture closes the page", !(await p.isVisible("#focusPage")));
    ok("...and stays on the app", p.url().startsWith(B));
    ok("the list shows the progress", /All 3 sets done/.test(await p.textContent(".tray-item .row-progress")));
    await p.locator(".tray-item .head-left .ex-name").nth(1).click(); await p.waitForTimeout(350);
    ok("tapping the name opens it too", (await p.textContent("#focusTitle")).trim()==="Barbell Bent-Over Row");
    await p.click("#focusBack"); await p.waitForTimeout(350);
    ok("Back closes it", !(await p.isVisible("#focusPage")));
    await ctx.close();
  }
  {
    const { ctx, p } = await open(DESK, "dark");
    await add(p, "Barbell Bench Press");
    await focus(p);
    const ov = await p.evaluate(()=>document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok("exercise page fits on desktop too", ov===0 && await p.isVisible("#focusPage"), ov);
    await p.keyboard.press("Escape"); await p.waitForTimeout(300);
    ok("Escape closes it", !(await p.isVisible("#focusPage")));
    await ctx.close();
  }

  /* ---------- 7. rest timers: music and refreshes ---------- */
  // Record what the page asks of the audio system: every play() and the iOS audio session type.
  const AUDIO_SPY = () => {
    window.__plays = [];
    const orig = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function(){ window.__plays.push({ loop:this.loop, at:Date.now() });
      try{ return orig.call(this).catch(()=>{}); }catch(e){ return Promise.resolve(); } };
    try{ Object.defineProperty(navigator, "audioSession", { value:{ type:"auto" }, configurable:true }); }catch(e){}
  };
  const shortRest = async (p, sec) => {
    await p.evaluate(s=>{ const t=JSON.parse(localStorage.getItem("ptp-tray")); t.forEach(i=>i.restSeconds=s);
      localStorage.setItem("ptp-tray", JSON.stringify(t)); }, sec);
    await p.reload(); await p.waitForTimeout(700);
  };
  {
    const { ctx, p } = await open(PHONE);
    await ctx.addInitScript(AUDIO_SPY);
    await add(p, "Barbell Bench Press"); await shortRest(p, 2); await workout(p);
    ok("the app starts with a session that mixes with music",
      await p.evaluate(()=>navigator.audioSession && navigator.audioSession.type)==="ambient");
    await focus(p);
    await p.click(F+".set-row .check-wrap"); await p.waitForTimeout(400);
    ok("a rest does not hold the audio session (no looping track)",
      (await p.evaluate(()=>window.__plays.filter(x=>x.loop).length))===0, await p.evaluate(()=>window.__plays));
    await p.waitForTimeout(4200);
    ok("after the beep the session is handed back to the music",
      await p.evaluate(()=>navigator.audioSession.type)==="ambient", await p.evaluate(()=>navigator.audioSession.type));
    ok("the finished rest is cleared from storage",
      Object.keys(await p.evaluate(()=>JSON.parse(localStorage.getItem("ptp-timers")||"{}"))).length===0);
    await ctx.close();
  }
  {
    const { ctx, p } = await open(PHONE);
    await add(p, "Barbell Bench Press"); await shortRest(p, 90); await workout(p);
    await focus(p);
    await p.click(F+".set-row .check-wrap"); await p.waitForTimeout(300);
    const saved = await p.evaluate(()=>JSON.parse(localStorage.getItem("ptp-timers")||"{}"));
    ok("a running rest is saved", Object.keys(saved).length===1, saved);
    await p.reload(); await p.waitForTimeout(900); await workout(p);
    const badge = await p.$eval(".tray-item .timer-badge.running .t", e=>e.textContent.trim()).catch(()=>null);
    ok("...and survives a refresh", !!badge && /^1:2\d$|^1:[01]\d$/.test(badge), badge);
    await ctx.close();
  }
  {
    // background mode is the one that is allowed to hold the session
    const { ctx, p } = await open(PHONE, "light", { "ptp-settings":JSON.stringify({ restAlert:"background" }) });
    await ctx.addInitScript(AUDIO_SPY);
    await add(p, "Barbell Bench Press"); await shortRest(p, 60); await workout(p);
    await focus(p);
    await p.click(F+".set-row .check-wrap"); await p.waitForTimeout(400);
    ok("background mode keeps a silent track playing", (await p.evaluate(()=>window.__plays.filter(x=>x.loop).length))>=1);
    await p.click(F+"[data-fskip]"); await p.waitForTimeout(300);
    ok("...and lets go of it when the rest is skipped",
      await p.evaluate(()=>navigator.audioSession.type)==="ambient", await p.evaluate(()=>navigator.audioSession.type));
    await ctx.close();
  }

  /* ---------- 8. clearing a workout ---------- */
  {
    const { ctx, p } = await open(PHONE);
    await add(p, "Barbell Bench Press"); await add(p, "Barbell Bent-Over Row"); await workout(p);
    ok("nothing destructive sits at the foot of the workout", (await p.$$(".tray-actions button")).length===1
      && (await p.$$(".tray-actions #clearBtn")).length===0);
    const g = await p.evaluate(()=>{ const l=document.getElementById("logBtn").getBoundingClientRect(),
      m=document.getElementById("sessMore").getBoundingClientRect(); return Math.round(l.top - m.bottom); });
    ok("the clear menu is far from Log", g > 150, g);
    const ab = await p.$eval("#trayBack", e=>{ const r=e.getBoundingClientRect(); return { w:Math.round(r.width), h:Math.round(r.height), f:getComputedStyle(e).fontSize }; });
    ok("the Add button is thumb-sized", ab.h>=44 && ab.w>=90 && parseFloat(ab.f)>=15, ab);
    ok("Clear is hidden until the menu opens", !(await p.isVisible("#clearBtn")));
    await p.click("#sessMore"); await p.waitForTimeout(200);
    const small = await p.$$eval("#sessMenu button", els=>els.map(e=>Math.round(e.getBoundingClientRect().height)).filter(h=>h<44));
    ok("menu items >= 44px", small.length===0, small);
    const ov = await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    ok("the menu stays on screen", ov===0, ov);
    await p.click("#clearBtn"); await p.waitForTimeout(300);
    ok("Clear workout empties it", (await tray(p)).length===0);
    ok("an Undo is offered", await p.isVisible("#toast .toast-act"));
    await p.click("#toast .toast-act"); await p.waitForTimeout(300);
    ok("Undo brings it all back", (await tray(p)).length===2 && (await p.$$(".tray-item")).length===2);
    // ticked sets still get a question first
    await focus(p); await p.click(F+".set-row .check-wrap"); await p.waitForTimeout(200);
    await p.click("#focusBack"); await p.waitForTimeout(300);
    let asked = null; p.removeAllListeners("dialog"); p.on("dialog", d=>{ asked=d.message(); d.dismiss(); });
    await p.click("#sessMore"); await p.waitForTimeout(150); await p.click("#clearBtn"); await p.waitForTimeout(250);
    ok("unlogged ticked sets ask before clearing", !!asked && /1 completed set/.test(asked), asked);
    ok("...and No keeps the workout", (await tray(p)).length===2);
    await ctx.close();
  }
  {
    const { ctx, p } = await open(DESK);
    await add(p, "Barbell Bench Press");
    await p.click("#sessMore"); await p.waitForTimeout(200);
    ok("the menu works on desktop too", await p.isVisible("#clearBtn"));
    await p.keyboard.press("Escape"); await p.waitForTimeout(150);
    ok("Escape closes it", !(await p.isVisible("#clearBtn")));
    await ctx.close();
  }

  /* ---------- 9. credits behind the (i) ---------- */
  {
    const { ctx, p } = await open(PHONE);
    const ft = (await p.textContent("footer")).trim();
    ok("the front has no disclaimer text", ft==="", ft);
    const hit = await p.$eval("#aboutLink", e=>{ const r=e.getBoundingClientRect(); return Math.round(r.height + 16); });
    ok("the (i) is still a 44px target", hit>=44, hit);
    await p.click("#aboutLink"); await p.waitForTimeout(700);
    ok("(i) opens About & credits in Settings", await p.isVisible("#view-settings #about")
      && await p.evaluate(()=>document.activeElement && document.activeElement.id==="about"));
    const txt = await p.textContent("#about");
    ok("the credits are all there", /ExRx\.net Exercise Directory/.test(txt) && /StrengthLog/.test(txt) && /not affiliated/.test(txt));
    ok("it shows the version", /Version \d+/.test(await p.textContent("#aboutVer")));
    await ctx.close();
  }

  /* ---------- 10. logging depth: set kinds, effort, timed, per side ---------- */
  const SEED = require("./seed-history.js");
  {
    const { ctx, p } = await open(PHONE, "light", { "ptp-settings":JSON.stringify({ effort:"rir" }) });
    await add(p, "Barbell Bench Press"); await workout(p); await focus(p);
    ok("effort column appears when switched on", (await p.$$(F+".effort-input")).length===3);
    await p.fill(F+".effort-input", "2"); await p.waitForTimeout(100);
    ok("effort is explained in plain words", /Two more reps in the tank/.test(await p.textContent("#effortHint")));
    await p.fill(F+".effort-input", "7.6"); await p.keyboard.press("Tab"); await p.waitForTimeout(150);
    ok("RIR is kept to a whole number", (await tray(p))[0].setLog[0].e==="8", (await tray(p))[0].setLog[0]);
    await p.click(F+'[data-setmenu="0"]'); await p.waitForTimeout(200);
    ok("the set number opens that set's options", await p.isVisible(F+".set-sheet"));
    await p.click(F+'[data-setkind="w"]'); await p.waitForTimeout(200);
    ok("a set can be marked warm-up", (await tray(p))[0].setLog[0].k==="w");
    ok("...and says so on the row", /warm-up/i.test(await p.textContent(F+'[data-setmenu="0"]')));
    await p.click(F+"[data-setcopy]"); await p.waitForTimeout(250);
    const t1 = await tray(p);
    ok("Copy set inserts a copy after it, not ticked", t1[0].setLog.length===4 && t1[0].setLog[1].k==="w" && !t1[0].setLog[1].done, t1[0].setLog);
    await p.click(F+'[data-setmenu="1"]'); await p.waitForTimeout(200);
    await p.click(F+"[data-setdel]"); await p.waitForTimeout(250);
    ok("Delete set removes it", (await tray(p))[0].setLog.length===3);
    await p.click("#toast .toast-act"); await p.waitForTimeout(250);
    ok("...and Undo puts it back", (await tray(p))[0].setLog.length===4);
    // log it: the details travel into history, and warm-ups stay out of the target
    await p.fill(F+'.weight-input >> nth=0', "40"); await p.fill(F+'.reps-input >> nth=0', "10");
    await p.click("#focusBack"); await p.waitForTimeout(300);
    await p.click("#logBtn"); await p.waitForTimeout(400);
    const h = await p.evaluate(()=>JSON.parse(localStorage.getItem("ptp-history")));
    ok("set kind and effort are saved with the session", h[0].items[0].setLog[0].k==="w" && h[0].items[0].setLog[0].e==="8", h[0].items[0].setLog[0]);
    await ctx.close();
  }
  {
    const { ctx, p } = await open(PHONE);
    await add(p, "Weighted Plank"); await add(p, "Plank to Push-Up"); await add(p, "Walking Lunge"); await workout(p);
    await focus(p, 0);
    ok("a plank is logged in seconds", /Seconds/.test(await p.textContent(F+".set-head")));
    await p.click(F+"[data-fnextex]"); await p.waitForTimeout(300);
    ok("a plank to push-up is still reps", /^\s*Reps\s*$/.test(await p.locator(F+".set-head .col-lbl").nth(1).textContent()));
    await p.click(F+"[data-fnextex]"); await p.waitForTimeout(300);
    ok("lunges count reps per side", /Reps \/ side/.test(await p.textContent(F+".set-head")));
    await ctx.close();
  }
  {
    // warm-ups do not move the progression target
    const hist = JSON.stringify([{ date:day(-3), loggedAt:new Date().toISOString(), items:[
      { id:"push-0", n:"Barbell Bench Press", cat:"push", eq:"Barbell", sets:4, setLog:[
        { weight:"140", reps:"1", done:true, k:"w" }, { weight:"100", reps:"5", done:true },
        { weight:"100", reps:"5", done:true }, { weight:"100", reps:"5", done:true }] }]}]);
    const { ctx, p } = await open(PHONE, "light", { "ptp-history":hist, "ptp-ex-prefs":JSON.stringify({ "push-0":{ prog:"linear" } }) });
    await add(p, "Barbell Bench Press"); await workout(p);
    ok("a heavy warm-up single is ignored by the target", (await p.$eval(".next-pill", e=>e.textContent.trim()))==="102.5 × 5");
    await ctx.close();
  }

  /* ---------- 11. gym floor: swipe, flash, screen awake ---------- */
  {
    const { ctx, p } = await open(PHONE, "light", { "ptp-settings":JSON.stringify({ restFlash:true }) });
    await add(p, "Barbell Bench Press"); await workout(p); await focus(p);
    const cdp = await ctx.newCDPSession(p);
    const swipe = async (idx, dx)=>{
      const r = await p.locator(`#focusPage .sw[data-sw="${idx}"]`).boundingBox();
      const y = r.y + r.height/2, x0 = r.x + r.width/2;
      await cdp.send("Input.dispatchTouchEvent", { type:"touchStart", touchPoints:[{ x:x0, y }] });
      for(let i=1;i<=10;i++){ await cdp.send("Input.dispatchTouchEvent", { type:"touchMove", touchPoints:[{ x:x0 + dx*i/10, y }] }); }
      await cdp.send("Input.dispatchTouchEvent", { type:"touchEnd", touchPoints:[] });
      await p.waitForTimeout(300);
    };
    await p.fill(F+'.weight-input >> nth=0', "60"); await p.keyboard.press("Tab");
    await swipe(0, 120);
    const a = await tray(p);
    ok("swiping a set right copies it", a[0].setLog.length===4 && a[0].setLog[1].weight==="60", a[0].setLog);
    await swipe(1, -120);
    ok("swiping a set left deletes it", (await tray(p))[0].setLog.length===3);
    ok("...with an Undo", await p.isVisible("#toast .toast-act"));
    await swipe(0, 40);
    ok("a short swipe does nothing", (await tray(p))[0].setLog.length===3);
    await swipe(0, -120); await swipe(0, -120); await swipe(0, -120);
    ok("the last set cannot be swiped away", (await tray(p))[0].setLog.length===1);
    await ctx.close();
  }
  {
    const { ctx, p } = await open(PHONE, "light", { "ptp-settings":JSON.stringify({ restFlash:true }) });
    await add(p, "Barbell Bench Press");
    await p.evaluate(()=>{ const t=JSON.parse(localStorage.getItem("ptp-tray")); t[0].restSeconds=1; localStorage.setItem("ptp-tray", JSON.stringify(t)); });
    await p.reload(); await p.waitForTimeout(700); await workout(p); await focus(p);
    await p.click(F+".set-row .check-wrap"); await p.waitForTimeout(1500);
    ok("the screen flashes when a rest ends (if switched on)", await p.evaluate(()=>!!document.getElementById("flashVeil")
      && document.getElementById("flashVeil").getAnimations().length > 0));
    await ctx.close();
  }
  {
    const { ctx, p } = await open(PHONE);
    await add(p, "Barbell Bench Press"); await focus(p).catch(()=>{});
    await p.click('.viewtab[data-view="train"]').catch(()=>{});
    await p.click("#avatarBtn"); await p.waitForTimeout(150); await p.click('#acctMenu [data-go="settings"]'); await p.waitForTimeout(300);
    ok("settings offer flash, screen-on and effort", await p.isVisible("#stRestFlash") && await p.isVisible("#stKeepAwake") && await p.isVisible("#stEffort"));
    ok("screen-on is on by default", (await p.inputValue("#stKeepAwake"))==="on");
    await p.selectOption("#stEffort", "rpe"); await p.click("#stSave"); await p.waitForTimeout(250);
    ok("effort mode saves", (await p.evaluate(()=>JSON.parse(localStorage.getItem("ptp-settings")).effort))==="rpe");
    await ctx.close();
  }

  /* ---------- 12. progress charts ---------- */
  for(const scheme of ["light","dark"]){
    const { ctx, p } = await open(PHONE, scheme, { "ptp-history":SEED() });
    await p.click('.viewtab[data-view="records"]'); await p.waitForTimeout(600);
    const ov = await p.evaluate(()=>document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(`records with charts fits the phone (${scheme})`, ov===0, ov);
    ok(`1RM chart draws a line (${scheme})`, (await p.$$("#e1rmBody .e-line")).length===1);
    const opts = await p.$$eval("#e1rmPick option", o=>o.map(x=>x.textContent));
    ok("lifts are offered most-logged first", /Barbell Bench Press|Barbell Back Squat/.test(opts[0]) && opts.length===4, opts);
    const big = await p.textContent("#e1rmBody .big");
    ok("the hero is the latest estimate", parseFloat(big) > 0, big);
    await p.click('#e1rmRange [data-range="0"]'); await p.waitForTimeout(200);
    const rows = await p.$$eval("#e1rmBody tbody tr", r=>r.length);
    ok("All shows every session in the table", rows===12, rows);
    // muscle map: squat 3 days ago → quads lit; nothing for calves
    const fills = await p.evaluate(()=>{ const g=k=>{ const e=document.querySelector(`#muscleBody .bm-m[data-m="${k}"]`); return e && getComputedStyle(e).fill; };
      return { quads:g("quadriceps"), calves:g("calves"), chest:g("chest") }; });
    ok(`muscle map shades trained muscles and not the rest (${scheme})`, fills.quads && fills.quads!==fills.calves, fills);
    await p.locator('#muscleBody .bm-m[data-m="quadriceps"]').first().dispatchEvent("click"); await p.waitForTimeout(150);
    ok("tapping a muscle says its sets", /Quads: \d/.test(await p.textContent("#bmCaption")));
    // ramp: steps get steadily further from the surface
    const ramp = await p.$$eval("#heatBody .ink-legend i", els=>els.map(e=>getComputedStyle(e).backgroundColor));
    /* OKLab lightness, whichever form the browser reports the colour in */
    const lum = c=>{ const m=c.match(/[\d.]+/g).map(Number); if(/^oklab/.test(c)) return m[0];
      const f=v=>{ v/=255; return v<=0.04045? v/12.92 : Math.pow((v+0.055)/1.055,2.4); };
      const [r,g,b]=m.slice(0,3).map(f);
      const l=Math.cbrt(0.4122214708*r+0.5363325363*g+0.0514459929*b), mm=Math.cbrt(0.2119034982*r+0.6806995451*g+0.1073969566*b), sx=Math.cbrt(0.0883024619*r+0.2817188376*g+0.6299787005*b);
      return 0.2104542553*l+0.7936177850*mm-0.0040720468*sx; };
    const L = ramp.map(lum).filter(v=>v!==null);
    /* each step at least 0.1 L from the last, so neighbours are told apart */
    const mono = L.length===5 && L.slice(1).every((v,i)=> scheme==="light" ? L[i] - v >= 0.1 : v - L[i] >= 0.1);
    ok(`the ink ramp is monotonic (${scheme})`, mono, ramp);
    const cells = await p.$$eval("#heatBody rect", r=>r.length);
    ok("heatmap fills the width it has", cells >= 7*18, cells);
    await ctx.close();
  }
  {
    const { ctx, p } = await open(PHONE);
    await p.click('.viewtab[data-view="records"]'); await p.waitForTimeout(400);
    ok("no history: the charts explain themselves instead of drawing nothing",
      (await p.$$("#progressGrid .prog-empty")).length===2);
    await ctx.close();
  }

  /* ---------- 13. favorites ---------- */
  {
    const { ctx, p } = await open(PHONE);
    ok("there is a Favorites tab beside Workout and Browse", (await p.$$('#modeSwitch [data-mode="favorites"]')).length===1);
    ok("the desktop switch stays out of the phone's way", !(await p.isVisible("#libSwitch")));
    await p.click('#modeSwitch [data-mode="favorites"]'); await p.waitForTimeout(300);
    ok("no favorites yet: it says how to get some", await p.isVisible(".fav-empty"));
    await p.click("[data-gobrowse]"); await p.waitForTimeout(300);
    ok("...and Go to Browse goes there", (await p.getAttribute('#modeSwitch [data-mode="browse"]', "aria-pressed"))==="true");
    for(const n of ["Barbell Bench Press", "Barbell Back Squat", "Lat Pulldown"]){
      await p.fill("#search", n); await p.waitForTimeout(350);
      await p.click("#groups .card .fav-btn"); await p.waitForTimeout(150);
    }
    await p.fill("#search", ""); await p.waitForTimeout(250);
    const small = await p.$$eval("#groups .fav-btn", els=>els.slice(0,5).map(e=>Math.round(e.getBoundingClientRect().height)).filter(h=>h<40));
    ok("stars are 40px targets", small.length===0, small);
    ok("the tab counts them", (await p.textContent("#msFav")).trim()==="3");
    await p.click('#modeSwitch [data-mode="favorites"]'); await p.waitForTimeout(300);
    ok("Favorites lists only starred exercises", (await p.$$("#groups .card")).length===3);
    const counts = await p.$$eval("#tiles .tile .sub", els=>els.map(e=>e.textContent.trim()));
    ok("the same Push / Pull / Legs / Abs tiles, counting favorites", counts.length===4 && /1$/.test(counts[0]) && /0$/.test(counts[3]), counts);
    await p.click('#tiles .tile[data-cat="legs"]'); await p.waitForTimeout(250);
    ok("a category narrows the favorites", (await p.$$("#groups .card")).length===1);
    ok("the split loader stays out of Favorites", !(await p.isVisible(".splits")));
    await p.click("#groups .card .add-btn"); await p.waitForTimeout(300);
    ok("adding from Favorites puts it in the workout", (await tray(p)).length===1);
    await p.click('#tiles .tile[data-cat="legs"]'); await p.waitForTimeout(200);
    await p.locator("#groups .card .fav-btn").first().click(); await p.waitForTimeout(250);
    ok("unstarring in Favorites removes it, with Undo", (await p.$$("#groups .card")).length===2 && await p.isVisible("#toast .toast-act"));
    await p.click("#toast .toast-act"); await p.waitForTimeout(250);
    ok("...and Undo brings it back", (await p.$$("#groups .card")).length===3);
    // + Add returns to the library you were using
    await workout(p);
    await p.click("#trayBack"); await p.waitForTimeout(300);
    ok("+ Add goes back to Favorites", (await p.getAttribute('#modeSwitch [data-mode="favorites"]', "aria-pressed"))==="true");
    // star from the exercise page too
    await workout(p); await focus(p);
    ok("the exercise page shows it is a favorite", (await p.getAttribute("#focusFav", "aria-pressed"))==="true");
    await p.click("#focusFav"); await p.waitForTimeout(200);
    ok("...and can unstar it", !(await p.evaluate(()=>JSON.parse(localStorage.getItem("ptp-ex-prefs"))["legs-51"]||{})).fav);
    await p.click("#focusBack"); await p.waitForTimeout(200);
    await p.reload(); await p.waitForTimeout(700);
    ok("favorites survive a reload", (await p.textContent("#msFav")).trim()==="2");
    await ctx.close();
  }
  {
    const { ctx, p } = await open(DESK, "dark", { "ptp-ex-prefs":JSON.stringify({ "push-0":{ fav:"1" } }) });
    ok("desktop has the All / Favorites switch", await p.isVisible("#libSwitch"));
    await p.click('#libSwitch [data-lib="favorites"]'); await p.waitForTimeout(300);
    ok("...and it filters", (await p.$$("#groups .card")).length===1);
    const ov = await p.evaluate(()=>document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok("no sideways scroll", ov===0, ov);
    await ctx.close();
  }

  /* ---------- 14. animated train tabs ---------- */
  {
    const { ctx, p } = await open(PHONE, "light", { "ptp-ex-prefs":JSON.stringify({ "push-0":{ fav:"1" } }) });
    const under = async ()=> p.evaluate(()=>{ const t=document.querySelector("#modeSwitch .ms-thumb").getBoundingClientRect(),
      b=document.querySelector("#modeSwitch button.on").getBoundingClientRect(); return Math.abs(t.left-b.left) < 2 && Math.abs(t.width-b.width) < 2; });
    ok("the tab pill starts under the open tab", await under());
    await p.click('#modeSwitch [data-mode="favorites"]'); await p.waitForTimeout(60);
    ok("the new pane slides in from the right", (await p.$$("#browsePane.pane-in-r")).length===1);
    ok("the star twirls", (await p.$$('#modeSwitch [data-mode="favorites"] .ms-ico.twirl')).length===1);
    ok("the first cards come in one after another", (await p.$$("#groups .card.card-in")).length>=1);
    await p.waitForTimeout(600);
    ok("...and the pill glides to Favorites", await under());
    ok("one-shot classes are cleaned up", (await p.$$(".pane-in-r, .twirl, .card-in")).length===0);
    await p.click('#modeSwitch [data-mode="workout"]'); await p.waitForTimeout(60);
    ok("going left slides in from the left", (await p.$$("#trayPanel.pane-in-l")).length===1);
    await p.waitForTimeout(500);
    ok("pill under Workout", await under());
    await ctx.close();
  }
  {
    const { ctx, p } = await open(PHONE, "light", null, { reducedMotion:"reduce" });
    await p.click('#modeSwitch [data-mode="favorites"]'); await p.waitForTimeout(60);
    ok("reduced motion: panes just appear", (await p.$$(".pane-in-r, .pane-in-l, .twirl, .card-in")).length===0);
    await ctx.close();
  }
  {
    const { ctx, p } = await open(DESK, "dark", { "ptp-ex-prefs":JSON.stringify({ "push-0":{ fav:"1" } }) });
    await p.click('#libSwitch [data-lib="favorites"]'); await p.waitForTimeout(500);
    const g = await p.evaluate(()=>{ const t=document.querySelector("#libSwitch .seg-thumb").getBoundingClientRect(),
      b=document.querySelector('#libSwitch [aria-checked="true"]').getBoundingClientRect(); return Math.abs(t.left-b.left) < 2; });
    ok("desktop switch pill follows too", g);
    await ctx.close();
  }

  ok("no console or page errors", errors.length===0, [...new Set(errors)].slice(0,4));
  console.log(`${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
