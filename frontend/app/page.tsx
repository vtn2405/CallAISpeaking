// @ts-nocheck
'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';

export default function LandingPage() {
  useEffect(() => {
    // @ts-nocheck
    // reveal
    const els = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
      }, { threshold: 0.12 });
      els.forEach(el => io.observe(el));
      setTimeout(() => els.forEach(el => el.classList.add('in')), 2600);
    } else { els.forEach(el => el.classList.add('in')); }

    /* ================= INTERACTIVE DEMO ================= */
    const stage = document.getElementById('demoStage');
    if(!stage) return;
    const scenes = Array.from(stage.querySelectorAll('.scene'));
    const steps  = Array.from(document.querySelectorAll('#stepList .step'));
    const segs   = Array.from(document.querySelectorAll('#segs .seg'));
    const cursor = document.getElementById('fcursor');
    const demoAudio = new Audio('/audio/demo_ai_line.mp3');
    let idx = 0, playing = false, soundOn = false;
    let mainTimer = null, timers = [];

    const LINE = "Hey! I just finished scanning the video about a summer weekend in Cornwall. It's a great topic! Should we dive right in, or do you want the main idea first?";
    const WORDS = LINE.split(' ');

    function sceneDur(i) {
        if(i === 0) return 4200;
        if(i === 1) return 4000;
        if(i === 2) {
            return (demoAudio.duration && demoAudio.duration > 0) ? (demoAudio.duration * 1000 + 4000) : 7000;
        }
        return 4000;
    }

    function clearTimers(){ timers.forEach(t=>{ if(t.t) clearTimeout(t.t); if(t.i) clearInterval(t.i); }); timers = []; try{ demoAudio.pause(); }catch(e){} demoAudio.ontimeupdate = null; demoAudio.onended = null; }
    function after(ms, fn){ const o={}; o.t=setTimeout(fn, ms); timers.push(o); return o; }

    function moveCursor(el){ if(!el||!cursor) return; cursor.classList.remove('hide'); const s=stage.getBoundingClientRect(), r=el.getBoundingClientRect(); const x=r.left-s.left+r.width*0.5, y=r.top-s.top+r.height*0.5; cursor.style.setProperty('--tx', x+'px'); cursor.style.setProperty('--ty', y+'px'); cursor.style.transform='translate('+x+'px,'+y+'px)'; }
    function tap(){ if(cursor){ cursor.classList.remove('tap'); void cursor.offsetWidth; cursor.classList.add('tap'); } }

    function setActive(i){
      scenes.forEach((s,j)=>s.classList.toggle('active', j===i));
      steps.forEach((s,j)=>{
        const on=j===i; s.classList.toggle('ring-2', on); s.classList.toggle('ring-primary-600', on); s.classList.toggle('bg-primary-50/40', on);
        s.style.borderColor = on ? '#315D9A' : '';
        const num=s.querySelector('.stepnum');
        if(num) {
          num.classList.toggle('bg-primary-600', on); num.classList.toggle('text-white', on);
          num.classList.toggle('bg-slate-100', !on); num.classList.toggle('text-slatey', !on);
        }
      });
      segs.forEach((sg,j)=>{
        const fill=sg.querySelector('.seg-fill');
        if(fill) {
            fill.style.transition='none';
            if(j<i) fill.style.width='100%';
            else if(j>i) fill.style.width='0%';
            else { fill.style.width='0%'; void fill.offsetWidth; fill.style.transition='width '+sceneDur(i)+'ms linear'; fill.style.width='100%'; }
        }
      });
    }

    function lookup() {
       const el = document.getElementById('demoType');
       if(el) {
           el.innerHTML = LINE.replace('Cornwall.', '<span id="callWordTarget" class="relative rounded bg-white/20 px-1 py-0.5 text-white transition">Cornwall</span>.');
           
           const tip = document.getElementById('callVocabTip');
           const w = document.getElementById('callWordTarget');
           if(tip && w && cursor) {
               const c = tip.parentElement.getBoundingClientRect();
               const r = w.getBoundingClientRect();
               
               tip.style.left = (r.left - c.left + r.width/2) + 'px';
               tip.style.top = (r.top - c.top - tip.offsetHeight - 12) + 'px';
               
               moveCursor(w);
               after(1000, () => {
                   tap();
                   w.style.background = 'rgba(255,255,255,0.25)';
                   tip.classList.remove('opacity-0', 'pointer-events-none', 'scale-95');
                   tip.classList.add('opacity-100', 'scale-100');
               });
           }
       }
    }

    function runScene(i){
      clearTimers();
      if(cursor) cursor.classList.add('hide');
      if(i===0){
        const input=document.getElementById('demoInput'); const card=document.getElementById('scanCard');
        const line=document.getElementById('scanLine'); const status=document.getElementById('scanStatus');
        if(input) { input.textContent='Dán link YouTube có phụ đề vào đây…'; input.className='min-w-0 flex-1 truncate text-sm text-slate-400'; }
        if(card) card.classList.remove('show'); 
        if(line) line.classList.remove('scan-run'); 
        if(status) { status.textContent='Đang quét transcript…'; status.className='truncate text-[11px] text-primary-600'; }
        moveCursor(document.getElementById('pasteBtn'));
        after(1100, ()=>{ tap(); if(input) { input.textContent='https://youtube.com/watch?v=english-thinking'; input.className='min-w-0 flex-1 truncate text-sm text-ink'; } });
        after(1700, ()=>{ if(card) card.classList.add('show'); if(line) line.classList.add('scan-run'); });
        after(3500, ()=>{ if(line) line.classList.remove('scan-run'); if(status) { status.textContent='Đã nạp transcript làm ngữ cảnh'; status.className='truncate text-[11px] text-emerald-600'; } });
      }
      else if(i===1){
        const nat=document.getElementById('modeNaturalCard'); 
        const beg=document.getElementById('modeBeginnerCard'); 
        const note=document.getElementById('modeBeginnerNote');
        
        if(nat) { nat.classList.remove('border-primary-500', 'bg-primary-50/30'); const t=nat.querySelector('.tick-icon'); if(t) t.classList.add('opacity-0'); }
        if(beg) { beg.classList.remove('border-indigo-500', 'bg-indigo-50/50'); const t=beg.querySelector('.tick-icon'); if(t) t.classList.add('opacity-0'); }
        if(note) note.classList.add('hidden');
        
        after(800, ()=>{ moveCursor(beg); });
        after(1600, ()=>{ 
            tap(); 
            if(beg) { 
                beg.classList.add('border-indigo-500', 'bg-indigo-50/50'); 
                const t=beg.querySelector('.tick-icon'); if(t) t.classList.remove('opacity-0'); 
            } 
        });
        after(1900, ()=>{ if(note) note.classList.remove('hidden'); });
      }
      else if(i===2){
        const el=document.getElementById('demoType'); if(el) el.innerHTML='';
        const tip=document.getElementById('callVocabTip');
        if(tip) { tip.classList.remove('opacity-100', 'scale-100'); tip.classList.add('opacity-0', 'scale-95', 'pointer-events-none'); }

        if(soundOn){
          try{ 
              demoAudio.currentTime=0; 
              const p=demoAudio.play(); 
              if(p&&p.catch) p.catch(()=>fallbackType(el, lookup)); 
          }catch(e){ fallbackType(el, lookup); }
          
          demoAudio.ontimeupdate=()=>{ 
              const d=demoAudio.duration||8; 
              const pr=Math.min(1,demoAudio.currentTime/d); 
              const n=Math.max(1,Math.round(pr*WORDS.length)); 
              if(el) el.innerHTML=WORDS.slice(0,n).join(' '); 
          };
          demoAudio.onended = () => { lookup(); };
        } else { 
            fallbackType(el, lookup); 
        }
      }
    }
    function fallbackType(el, done){ let n=0; const o={}; o.i=setInterval(()=>{ n++; if(el) el.innerHTML=WORDS.slice(0,n).join(' '); if(n>=WORDS.length) { clearInterval(o.i); if(done) done(); } }, 3600/WORDS.length); timers.push(o); }

    function show(i){ idx=i; setActive(i); runScene(i); }
    function schedule(){ clearTimeout(mainTimer); mainTimer=setTimeout(()=>{ show((idx+1)%3); schedule(); }, sceneDur(idx)); }
    function start(){ if(playing) return; playing=true; show(0); schedule(); }
    function goTo(i){ show(i); schedule(); }

    steps.forEach((s,i)=>{ s.onclick = ()=>goTo(i); });
    segs.forEach((s,i)=>{ s.onclick = ()=>goTo(i); });

    const soundBtn=document.getElementById('soundBtn'), soundLabel=document.getElementById('soundLabel');
    if(soundBtn) {
        soundBtn.onclick = ()=>{
          soundOn=!soundOn;
          if(soundLabel) soundLabel.textContent = soundOn ? 'Đang phát âm thanh' : 'Bật âm thanh demo';
          soundBtn.classList.toggle('bg-primary-600', soundOn); soundBtn.classList.toggle('text-white', soundOn);
          if(soundOn){ 
              if (idx === 2) { runScene(2); } else { goTo(0); }
              setTimeout(() => {
                  const stage = document.getElementById('demoStage');
                  if(stage) stage.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 100);
          } else { 
              try{ demoAudio.pause(); }catch(e){} 
          }
        };
    }

    if('IntersectionObserver' in window){
      const io=new IntersectionObserver((es)=>{ es.forEach(e=>{ if(e.isIntersecting){ start(); io.disconnect(); } }); }, {threshold:0.35});
      io.observe(stage);
    } else { start(); }

    return clearTimers;
  }, []);

  return (
    <main className="w-full block">
      


<header id="nav" className="sticky top-0 z-50 transition-all duration-300">
  <div className="mx-auto max-w-7xl px-6 md:px-8">
    <nav className="mt-3 flex items-center justify-between rounded-2xl border border-white/60 bg-white/80 px-4 py-3 backdrop-blur-md shadow-card md:px-6">
      <Link href="/login" className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-[#365D98] text-white font-display font-bold text-sm shadow-glow tracking-wide">AI</span>
        <span className="font-display text-[17.5px] font-extrabold text-[#222]">Speaking Coach</span>
      </Link>
      <div className="hidden items-center gap-8 md:flex">
        <a href="#how" className="text-sm font-medium text-slatey transition hover:text-navy">Cách hoạt động</a>
        <a href="#features" className="text-sm font-medium text-slatey transition hover:text-navy">Tính năng</a>
        <a href="#showcase" className="text-sm font-medium text-slatey transition hover:text-navy">Sản phẩm</a>
        <a href="#roadmap" className="text-sm font-medium text-slatey transition hover:text-navy">Sắp ra mắt</a>
      </div>
      <div className="flex items-center gap-2">
        <Link href="/login" className="hidden rounded-xl px-4 py-2 text-sm font-semibold text-navy transition hover:bg-navy-50 sm:inline-block">Đăng nhập</Link>
        <Link href="/register" className="group inline-flex items-center gap-1.5 rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:bg-navy-700">
          Bắt đầu miễn phí
          <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </Link>
        <button type="button" id="burger" aria-label="Menu" className="grid h-10 w-10 place-items-center rounded-xl text-ink md:hidden">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        </button>
      </div>
    </nav>
    <div id="mobileMenu" className="hidden mt-2 rounded-2xl border border-white/60 bg-white p-3 shadow-soft md:hidden">
      <a href="#how" className="block rounded-xl px-4 py-3 text-sm font-medium text-ink hover:bg-navy-50">Cách hoạt động</a>
      <a href="#features" className="block rounded-xl px-4 py-3 text-sm font-medium text-ink hover:bg-navy-50">Tính năng</a>
      <a href="#showcase" className="block rounded-xl px-4 py-3 text-sm font-medium text-ink hover:bg-navy-50">Sản phẩm</a>
      <a href="#roadmap" className="block rounded-xl px-4 py-3 text-sm font-medium text-ink hover:bg-navy-50">Sắp ra mắt</a>
      <Link href="/login" className="mt-1 block rounded-xl px-4 py-3 text-sm font-semibold text-navy hover:bg-navy-50">Đăng nhập</Link>
    </div>
  </div>
</header>


<section className="relative overflow-hidden grain">
  <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 pb-20 pt-14 md:px-8 lg:grid-cols-2 lg:gap-10 lg:pb-28 lg:pt-20">
    
    <div className="reveal">
      <span className="inline-flex items-center gap-2 rounded-full border border-navy-100 bg-white px-3.5 py-1.5 text-xs font-semibold text-navy shadow-card">
        <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-navy opacity-60"></span><span className="relative inline-flex h-2 w-2 rounded-full bg-navy"></span></span>
        Luyện nói với AI · từ video YouTube
      </span>
      <h1 className="mt-5 font-display text-[2.6rem] font-bold leading-[1.06] text-ink sm:text-6xl">
        Biến mọi video <span className="text-[#FF0000]">YouTube</span> thành cuộc trò chuyện tiếng Anh.
      </h1>
      <p className="mt-6 max-w-xl text-lg leading-relaxed text-slatey">
        Chỉ cần dán link, AI sẽ nắm nội dung video và đóng vai người đối thoại cùng bạn. Bí từ thì có gợi ý, gặp từ lạ tra nghĩa ngay tại chỗ.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/register" className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-navy px-6 py-4 text-base font-semibold text-white shadow-glow transition hover:bg-navy-700">
          Bắt đầu trò chuyện miễn phí
          <svg className="h-5 w-5 transition-transform group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </Link>
        <a href="#how" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-navy-100 bg-white px-6 py-4 text-base font-semibold text-navy transition hover:border-navy-200 hover:bg-navy-50">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          Xem cách hoạt động
        </a>
      </div>
      <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slatey">
        <div className="flex items-center gap-2"><svg className="h-4 w-4 text-navy" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg> Miễn phí để bắt đầu</div>
        
        <div className="flex items-center gap-2"><svg className="h-4 w-4 text-navy" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg> Chỉ cần một link YouTube</div>
      </div>
    </div>

    
    <div className="reveal relative lg:pl-6">
      
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[125%] w-[115%] -translate-x-1/2 -translate-y-1/2 rounded-[48px]" style={{ background: "radial-gradient(closest-side, rgba(99,102,241,0.16), rgba(99,102,241,0.06) 55%, rgba(99,102,241,0) 78%)" }}></div>

      <div className="floaty relative mx-auto max-w-md rounded-[26px] border border-black/[0.06] bg-white p-4 shadow-soft">
        
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-navy text-white font-display text-sm font-bold">AI</span>
            <div>
              <p className="text-sm font-semibold text-ink">AI Speaking Coach</p>
              <p className="flex items-center gap-1 text-xs text-emerald-600"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> Sẵn sàng · Realtime</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slatey">0.8x</span>
            <span className="rounded-lg bg-navy-50 px-2 py-1 text-[11px] font-semibold text-navy">Phụ đề: Bật</span>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-navy-100 bg-navy-50 p-2.5">
          <div className="relative grid h-11 w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-navy text-white">
            <img src="/images/landing/youtube-thumb.png" alt="Thumbnail" className="absolute inset-0 h-full w-full object-cover opacity-80" />
            <svg className="relative z-10 h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-ink">How to Train Your Brain to Think in English</p>
            <p className="truncate text-[11px] text-slatey">youtube.com · Đã nạp transcript làm ngữ cảnh</p>
          </div>
        </div>
        <div className="mt-3">
          <div className="max-w-[90%] rounded-2xl rounded-tl-md bg-slate-100 px-3.5 py-2.5 text-sm text-ink">
            Hi! This video is about <span className="font-semibold">"How to Train Your Brain to Think in English (Stop Translating!) | Podcast for Easy Conversation"</span>. What do you think about it?
          </div>
          <div className="mt-1 flex items-center gap-1.5 pl-1 text-[11px] text-slatey">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></svg>
            Nghe lại
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-ink">💡 Tôi nên nói gì?</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-ink">❓ Câu đó nghĩa là gì?</span>
        </div>
        <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl bg-slate-50 py-4">
          <button className="pulsering grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-navy to-[#6d5ef0] text-white shadow-glow">
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4"/></svg>
          </button>
          <span className="text-xs font-medium text-slatey">Nhấn để nói</span>
        </div>
      </div>

      
      <div className="card-lift absolute -left-3 bottom-24 hidden w-56 rounded-2xl bg-white p-3.5 lg:block">
        <div className="flex items-center gap-2">
          <p className="font-display text-sm font-bold text-navy">quiet</p>
          <span className="rounded-md bg-navy-50 px-1.5 py-0.5 text-[10px] font-semibold text-navy">TỪ</span>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-slatey">Trong ngữ cảnh này: <span className="text-ink">yên tĩnh, không ồn ào</span> — mô tả một hòn đảo thanh bình.</p>
        <p className="mt-2 border-t border-slate-100 pt-2 text-[11px] italic text-slatey">"I want to see a <span className="rounded bg-navy-100 px-1 not-italic text-navy">quiet</span> island…"</p>
      </div>
      
      <div className="card-lift absolute -right-2 top-8 hidden rounded-2xl bg-white px-3 py-2 lg:block">
        <p className="text-xs font-semibold text-ink">🔖 Đã lưu từ vựng</p><p className="text-[11px] text-navy">quiet · market …</p>
      </div>
    </div>
  </div>

  
  <div className="mx-auto max-w-7xl px-6 pb-14 md:px-8">
    <p className="mb-5 text-center text-xs font-semibold uppercase tracking-widest text-slatey">Trò chuyện từ nội dung bạn yêu thích</p>
    <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
      <div className="marquee flex w-max items-center gap-12 text-slatey/70">
        <span className="font-display text-lg font-semibold">TED Talks</span><span className="font-display text-lg font-semibold">Podcasts</span><span className="font-display text-lg font-semibold">Vlogs</span><span className="font-display text-lg font-semibold">Movie Clips</span><span className="font-display text-lg font-semibold">News</span><span className="font-display text-lg font-semibold">Interviews</span><span className="font-display text-lg font-semibold">Lectures</span>
        <span className="font-display text-lg font-semibold">TED Talks</span><span className="font-display text-lg font-semibold">Podcasts</span><span className="font-display text-lg font-semibold">Vlogs</span><span className="font-display text-lg font-semibold">Movie Clips</span><span className="font-display text-lg font-semibold">News</span><span className="font-display text-lg font-semibold">Interviews</span><span className="font-display text-lg font-semibold">Lectures</span>
      </div>
    </div>
  </div>
</section>


<section id="how" className="mx-auto max-w-7xl px-6 py-20 md:px-8 lg:py-28">
  <div className="reveal mx-auto max-w-2xl text-center">
    <span className="text-sm font-semibold uppercase tracking-widest text-navy">Cách hoạt động</span>
    <h2 className="mt-3 font-display text-3xl font-bold text-ink sm:text-4xl">Xem thử một cuộc trò chuyện<br className="hidden sm:block" /> diễn ra thế nào.</h2>
    <p className="mt-4 text-lg text-slatey">Bản demo tự chạy dưới đây mô phỏng đúng thao tác thật — từ dán link đến khi trò chuyện.</p>
  </div>

  <div className="mt-14 grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14">
    
    <div className="lg:sticky lg:top-28 lg:self-start">
      <ol id="stepList" className="space-y-3">
        <li data-step="0" className="step group cursor-pointer rounded-2xl border border-slate-100 bg-white p-5 shadow-card transition">
          <div className="flex items-start gap-4">
            <span className="stepnum grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 font-display text-sm font-bold text-slatey transition">1</span>
            <div>
              <h3 className="font-display text-lg font-bold text-ink">Dán link YouTube — AI lo phần ngữ cảnh</h3>
              <p className="steptext mt-1 text-sm text-slatey">AI tự động quét transcript video, phân tích từ vựng và chuẩn bị kịch bản trò chuyện chỉ trong vài giây.</p>
            </div>
          </div>
        </li>
        <li data-step="1" className="step group cursor-pointer rounded-2xl border border-slate-100 bg-white p-5 shadow-card transition">
          <div className="flex items-start gap-4">
            <span className="stepnum grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 font-display text-sm font-bold text-slatey transition">2</span>
            <div>
              <h3 className="font-display text-lg font-bold text-ink">Chọn chế độ phù hợp với bạn</h3>
              <p className="steptext mt-1 text-sm text-slatey">Chọn chế độ trò chuyện phù hợp để không bao giờ bị "khựng" khi nói.</p>
            </div>
          </div>
        </li>
        <li data-step="2" className="step group cursor-pointer rounded-2xl border border-slate-100 bg-white p-5 shadow-card transition">
          <div className="flex items-start gap-4">
            <span className="stepnum grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 font-display text-sm font-bold text-slatey transition">3</span>
            <div>
              <h3 className="font-display text-lg font-bold text-ink">Trò chuyện 1:1 — bí từ tra ngay trong cuộc gọi</h3>
              <p className="steptext mt-1 text-sm text-slatey">Ngay trong cuộc gọi, chạm vào từ lạ trên phụ đề để xem giải nghĩa ngay lập tức.</p>
            </div>
          </div>
        </li>
      </ol>
    </div>

    
    <div>
      <div className="frame">
        <div className="frame-bar">
          <span className="frame-dot bg-[#ff5f57]"></span><span className="frame-dot bg-[#febc2e]"></span><span className="frame-dot bg-[#28c840]"></span>
          <span className="ml-2 flex items-center gap-1 text-[11px] font-medium text-slatey"><svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> AI Speaking Coach · Demo</span>
          <button type="button" id="soundBtn" className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-navy transition hover:bg-navy-50">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14"/></svg>
            <span id="soundLabel">Bật âm thanh demo</span>
          </button>
        </div>

        <div id="demoStage" className="demo-stage h-[430px] sm:h-[470px]">
          
          <div className="scene active" data-scene="0">
            <div className="flex h-full flex-col justify-center bg-cream px-6 py-6 sm:px-10">
              <h4 className="font-display text-xl font-bold text-ink">Trò chuyện với AI</h4>
              <p className="mt-1 text-sm text-slatey">Dán link YouTube có phụ đề để AI chuẩn bị ngữ cảnh và bắt đầu nói chuyện cùng bạn.</p>
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1.5 pl-3 shadow-sm">
                <svg className="h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                <span id="demoInput" className="min-w-0 flex-1 truncate text-sm text-slate-400">Dán link YouTube có phụ đề vào đây…</span>
                <span id="pasteBtn" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink">📋 Dán</span>
              </div>
              <div id="scanCard" className="pop mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="relative flex items-center gap-3 p-2.5">
                  <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-navy">
                    <img src="/images/landing/youtube-thumb.png" alt="Thumbnail" className="absolute inset-0 h-full w-full object-cover opacity-80" />
                    <span className="absolute inset-0 z-10 grid place-items-center text-white drop-shadow-md"><svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>
                    <span id="scanLine" className="absolute inset-x-0 z-20 h-1/3 bg-gradient-to-b from-white/70 to-transparent"></span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-ink">How to Train Your Brain to Think in English</p>
                    <p id="scanStatus" className="truncate text-[11px] text-primary-600">Đang quét transcript…</p>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-center text-[11px] text-slatey">Thoải mái trò chuyện như với bạn bè · AI sẽ dựa vào video để mở lời</p>
            </div>
          </div>

          
          <div className="scene" data-scene="1">
            <div className="flex h-full flex-col justify-center bg-cream px-6 py-6 sm:px-10">
              <h4 className="font-display text-xl font-bold text-ink">Chọn chế độ phù hợp với bạn</h4>
              <p className="mt-1 text-sm text-slatey">Tuỳ chỉnh trải nghiệm luyện nói theo cấp độ của bạn.</p>
              
              <div className="mt-6 space-y-3">
                <div id="modeNaturalCard" className="relative cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-xl">🎬</span>
                      <div>
                        <h5 className="font-semibold text-ink">Tự nhiên</h5>
                        <p className="text-[11px] text-slatey">1.0x · không gợi ý · nói như bản xứ</p>
                      </div>
                    </div>
                    <div className="tick-icon opacity-0 transition">
                      <svg className="h-5 w-5 text-primary-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                    </div>
                  </div>
                </div>

                <div id="modeBeginnerCard" className="relative cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-xl">🧑‍🎓</span>
                      <div>
                        <h5 className="font-semibold text-ink">Người mới</h5>
                        <p className="text-[11px] text-slatey">0.8x-1.0x · có gợi ý · giải thích lại</p>
                      </div>
                    </div>
                    <div className="tick-icon opacity-0 transition">
                      <svg className="h-5 w-5 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                    </div>
                  </div>
                </div>
              </div>

              <div id="modeBeginnerNote" className="mt-4 hidden rounded-xl bg-indigo-50 p-3 text-[11px] text-indigo-700">
                <div className="flex gap-2">
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                  <span>AI sẽ nói chậm 0.8x (bật theo chế độ) và hiện nút gợi ý ngay trong cuộc gọi.</span>
                </div>
              </div>
            </div>
          </div>

          <div className="scene" data-scene="2">
            <div className="flex h-full flex-col items-center justify-center gap-6 bg-[#0b1020] px-6 py-6 text-center relative overflow-hidden">
              <div className="relative grid h-24 w-24 place-items-center mb-2">
                <span className="ring" style={{ borderColor: 'rgba(250, 204, 21, 0.4)' }}></span>
                <span className="ring" style={{ borderColor: 'rgba(250, 204, 21, 0.4)', animationDelay: ".7s" }}></span>
                <span className="ring" style={{ borderColor: 'rgba(250, 204, 21, 0.4)', animationDelay: "1.4s" }}></span>
                <span className="relative grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-[#facc15] to-[#eab308] text-white shadow-[0_0_40px_rgba(250,204,21,.6)]">
                  <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4"/></svg>
                </span>
              </div>
              
              <div className="flex h-6 items-end gap-1 text-[#f59e0b]">
                <span className="eqbar h-6" style={{ animationDelay: "0s" }}></span><span className="eqbar h-6" style={{ animationDelay: ".15s" }}></span><span className="eqbar h-6" style={{ animationDelay: ".3s" }}></span><span className="eqbar h-6" style={{ animationDelay: ".1s" }}></span><span className="eqbar h-6" style={{ animationDelay: ".25s" }}></span><span className="eqbar h-6" style={{ animationDelay: ".4s" }}></span><span className="eqbar h-6" style={{ animationDelay: ".05s" }}></span>
              </div>
              
              <div className="relative w-full max-w-md mx-auto h-20 flex flex-col justify-end items-center">
                <p id="demoTypeSubtitle" className="text-[16px] font-medium leading-relaxed text-white/90 drop-shadow-sm min-h-[3rem] transition-all">
                  <span id="demoType" className="caret"></span>
                </p>
                
                <span id="callVocabTip" className="pop absolute left-1/2 -top-16 z-30 w-64 -translate-x-1/2 rounded-2xl p-3.5 text-left transition-all duration-300 opacity-0 pointer-events-none scale-95" style={{ backdropFilter: "blur(12px)", background: "rgba(30,30,46,0.85)", border: "1px solid rgba(255,255,255,0.15)", boxShadow: "0 20px 40px rgba(0,0,0,0.4)" }}>
                  <span className="flex justify-between items-start">
                    <span className="flex items-center gap-2">
                      <span className="font-display text-[15px] font-bold text-white">Cornwall</span>
                      <span className="text-[12px] font-medium text-white/50">/ˈkɔːnwɔːl/</span>
                    </span>
                  </span>
                  <span className="mt-1.5 block text-[13px] leading-relaxed text-white/80">Vùng ven biển ở tây nam nước Anh.</span>
                  <span className="mt-2.5 flex items-center gap-1.5 border-t border-white/10 pt-2 text-[10px] font-medium text-emerald-400">
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    Đã lưu vào từ vựng buổi này
                  </span>
                </span>
              </div>

              <div id="callControlChips" className="flex items-center gap-3 mt-2 transition-all duration-300">
                <span className="rounded-full bg-indigo-500/20 border border-indigo-500/30 px-3 py-1 text-[11px] font-medium text-indigo-300">🧑‍🎓 Người mới · 0.8x</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/10 px-3 py-1 text-[11px] font-medium text-white/80 transition hover:bg-white/15">💡 Gợi ý</span>
                <span className="grid h-9 w-9 place-items-center rounded-full bg-red-500 text-white shadow-lg"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.7 13.3a10 10 0 0 1-3-3l1.4-1.9a1 1 0 0 0 .1-1L8 4.3a1 1 0 0 0-1.1-.6C5 4 3.5 5.7 3.8 7.6A15 15 0 0 0 16.4 20c1.9.3 3.6-1.2 3.9-3.1a1 1 0 0 0-.6-1.1l-3.1-1.2a1 1 0 0 0-1 .1z"/></svg></span>
              </div>
            </div>
          </div>

          
          <div id="fcursor" className="fcursor hide">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="white" stroke="rgba(0,0,0,.35)" strokeWidth="1.2"><path d="M4 2l7 18 2.5-7L20 10.5 4 2z"/></svg>
          </div>
        </div>
      </div>

      
      <div id="segs" className="mt-5 grid grid-cols-3 gap-2">
        <div className="seg" data-seg="0"><div className="seg-fill"></div></div>
        <div className="seg" data-seg="1"><div className="seg-fill"></div></div>
        <div className="seg" data-seg="2"><div className="seg-fill"></div></div>
      </div>
      <p className="mt-3 text-center text-xs text-slatey">Bấm vào từng nấc để xem lại · nhấn "Bật âm thanh demo" để nghe AI nói</p>
    </div>
  </div>
</section>


<section id="features" className="bg-white">
  <div className="mx-auto max-w-7xl px-6 py-20 md:px-8 lg:py-28">
    <div className="reveal mx-auto max-w-2xl text-center">
      <span className="text-sm font-semibold uppercase tracking-widest text-navy">Tính năng</span>
      <h2 className="mt-3 font-display text-3xl font-bold text-ink sm:text-4xl">Mọi thứ để nói tự tin.<br className="hidden sm:block" /> Trong một web.</h2>
    </div>

    <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      <div className="reveal group relative overflow-hidden rounded-3xl bg-navy p-8 text-white shadow-soft md:col-span-2 lg:row-span-2 lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl"></div>
        <div>
          <span className="inline-grid h-12 w-12 place-items-center rounded-2xl bg-white/15"><svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>
          <h3 className="mt-5 font-display text-2xl font-bold">Ngữ cảnh từ video YouTube thật</h3>
          <p className="mt-2 max-w-md text-navy-100">AI xem transcript video bạn chọn để tạo cuộc hội thoại đúng chủ đề. Luyện nói quanh chính nội dung bạn quan tâm — từ TED Talk tới vlog du lịch — nên từ vựng và ý tưởng luôn đáng nhớ.</p>
        </div>
        <div className="mt-8 flex items-center gap-4 rounded-2xl bg-white/10 p-3 backdrop-blur">
          <div className="relative w-28 shrink-0 overflow-hidden rounded-xl bg-white/20 aspect-video sm:w-32">
            <img src="/images/landing/youtube-thumb.png" alt="Thumbnail" className="absolute inset-0 h-full w-full object-cover opacity-90" />
            <div className="absolute inset-0 grid place-items-center">
              <span className="flex h-6 w-9 items-center justify-center rounded-md bg-[#FF0000] text-white">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              </span>
            </div>
            <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 text-[9px] font-medium text-white">30:39</span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">How to Train Your Brain to Think in English</p>
            <p className="truncate text-xs text-navy-200">Transcript → chủ đề hội thoại tự động, chỉ trong vài giây</p>
          </div>
        </div>
      </div>
      <div className="reveal rounded-3xl border border-slate-100 bg-cream p-7 shadow-card">
        <span className="inline-grid h-12 w-12 place-items-center rounded-2xl bg-navy-50 text-navy"><svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4"/></svg></span>
        <h3 className="mt-5 font-display text-lg font-bold text-ink">Hội thoại bằng giọng nói</h3>
        <p className="mt-2 text-slatey">Nói chuyện thật với AI qua cuộc gọi — "Nhấn để nói", phản hồi theo thời gian thực.</p>
      </div>
      <div className="reveal rounded-3xl border border-slate-100 bg-cream p-7 shadow-card">
        <span className="inline-grid h-12 w-12 place-items-center rounded-2xl bg-navy-50 text-navy"><svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/></svg></span>
        <h3 className="mt-5 font-display text-lg font-bold text-ink">Hai chế độ luyện</h3>
        <p className="mt-2 text-slatey"><span className="font-semibold text-ink">Tự nhiên</span> cho người đã có nền tảng; <span className="font-semibold text-ink">Người mới</span> có gợi ý & chỉnh tốc độ để vượt rào cản sợ nói.</p>
      </div>
      <div className="reveal rounded-3xl border border-slate-100 bg-cream p-7 shadow-card">
        <span className="inline-grid h-12 w-12 place-items-center rounded-2xl bg-navy-50 text-navy"><svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h7v14H4zM13 5h7v14h-7z"/><path d="M16 8h1M16 11h1"/></svg></span>
        <h3 className="mt-5 font-display text-lg font-bold text-ink">Tra nghĩa trong ngữ cảnh</h3>
        <p className="mt-2 text-slatey">Ngay trong cuộc gọi, chạm vào từ lạ trên phụ đề, AI giải thích nghĩa tiếng Việt đúng theo câu đang nói — kèm phiên âm.</p>
      </div>
      <div className="reveal rounded-3xl border border-slate-100 bg-cream p-7 shadow-card">
        <span className="inline-grid h-12 w-12 place-items-center rounded-2xl bg-navy-50 text-navy"><svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/></svg></span>
        <h3 className="mt-5 font-display text-lg font-bold text-ink">Lưu từ vựng mỗi buổi</h3>
        <p className="mt-2 text-slatey">Mọi từ bạn tra được lưu lại kèm câu ngữ cảnh trong "Từ vựng trong buổi này" để ôn về sau.</p>
      </div>
      <div className="reveal rounded-3xl border border-slate-100 bg-cream p-7 shadow-card">
        <span className="inline-grid h-12 w-12 place-items-center rounded-2xl bg-navy-50 text-navy"><svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l3 2"/></svg></span>
        <h3 className="mt-5 font-display text-lg font-bold text-ink">Lịch sử & Nghe lại</h3>
        <p className="mt-2 text-slatey">Xem lại toàn bộ cuộc trò chuyện gắn với từng video và nghe lại câu trả lời của AI bất cứ lúc nào.</p>
      </div>
    </div>
  </div>
</section>


<section id="why" className="mx-auto max-w-7xl px-6 py-20 md:px-8 lg:py-28">
  <div className="reveal mx-auto max-w-2xl text-center">
    <span className="text-sm font-semibold uppercase tracking-widest text-navy">Khác biệt</span>
    <h2 className="mt-3 font-display text-3xl font-bold text-ink sm:text-4xl">Không chỉ là web trò chuyện.<br className="hidden sm:block" /> Một cách luyện nói khác.</h2>
  </div>
  <div className="reveal mt-12 grid grid-cols-2 gap-4 lg:grid-cols-4">
    <div className="rounded-3xl border border-slate-100 bg-white p-6 text-center shadow-card"><p className="font-display text-4xl font-bold text-navy">∞</p><p className="mt-1 text-sm text-slatey">video YouTube để luyện</p></div>
    <div className="rounded-3xl border border-slate-100 bg-white p-6 text-center shadow-card"><p className="font-display text-4xl font-bold text-navy">24/7</p><p className="mt-1 text-sm text-slatey">luôn sẵn sàng cùng bạn</p></div>
    <div className="rounded-3xl border border-slate-100 bg-white p-6 text-center shadow-card"><p className="font-display text-4xl font-bold text-navy">🇻🇳</p><p className="mt-1 text-sm text-slatey">giải thích bằng tiếng Việt</p></div>
    <div className="rounded-3xl border border-slate-100 bg-white p-6 text-center shadow-card"><p className="font-display text-4xl font-bold text-navy">0đ</p><p className="mt-1 text-sm text-slatey">miễn phí để bắt đầu</p></div>
  </div>
  <div className="reveal mt-8 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-card">
    <div className="grid grid-cols-3 border-b border-slate-100 bg-cream text-sm font-semibold">
      <div className="p-5 text-slatey"></div>
      <div className="p-5 text-center text-slatey">Luyện nói truyền thống</div>
      <div className="p-5 text-center text-navy">Với AI Speaking Coach</div>
    </div>
    <div className="divide-y divide-slate-100 text-sm">
      <div className="grid grid-cols-3 items-center">
        <div className="p-5 font-semibold text-ink">Chủ đề luyện</div>
        <div className="p-5 text-center text-slatey">Lặp lại, có sẵn</div>
        <div className="flex items-center justify-center gap-2 p-5 text-center font-medium text-ink"><svg className="h-4 w-4 shrink-0 text-navy" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg> Bất kỳ video YouTube bạn thích</div>
      </div>
      <div className="grid grid-cols-3 items-center">
        <div className="p-5 font-semibold text-ink">Khi bí từ / bí ý</div>
        <div className="p-5 text-center text-slatey">Tự xoay xở</div>
        <div className="flex items-center justify-center gap-2 p-5 text-center font-medium text-ink"><svg className="h-4 w-4 shrink-0 text-navy" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg> Gợi ý & tra nghĩa ngay (mode Người mới)</div>
      </div>
      <div className="grid grid-cols-3 items-center">
        <div className="p-5 font-semibold text-ink">Từ vựng</div>
        <div className="p-5 text-center text-slatey">Ghi tay, dễ quên</div>
        <div className="flex items-center justify-center gap-2 p-5 text-center font-medium text-ink"><svg className="h-4 w-4 shrink-0 text-navy" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg> Tự lưu kèm ngữ cảnh mỗi buổi</div>
      </div>
      <div className="grid grid-cols-3 items-center">
        <div className="p-5 font-semibold text-ink">Thời gian được nói</div>
        <div className="p-5 text-center text-slatey">Vài phút mỗi buổi</div>
        <div className="flex items-center justify-center gap-2 p-5 text-center font-medium text-ink"><svg className="h-4 w-4 shrink-0 text-navy" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg> Nói thoải mái, trò chuyện lúc nào cũng được</div>
      </div>
      <div className="grid grid-cols-3 items-center">
        <div className="p-5 font-semibold text-ink">Ôn lại</div>
        <div className="p-5 text-center text-slatey">Khó xem lại</div>
        <div className="flex items-center justify-center gap-2 p-5 text-center font-medium text-ink"><svg className="h-4 w-4 shrink-0 text-navy" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg> Lịch sử đầy đủ + Nghe lại</div>
      </div>
    </div>
  </div>
</section>


<section id="showcase" className="bg-white">
  <div className="mx-auto max-w-7xl px-6 py-20 md:px-8 lg:py-28">
    <div className="reveal mx-auto max-w-2xl text-center">
      <span className="text-sm font-semibold uppercase tracking-widest text-navy">Sản phẩm</span>
      <h2 className="mt-3 font-display text-3xl font-bold text-ink sm:text-4xl">Bên trong AI Speaking Coach</h2>
      <p className="mt-4 text-lg text-slatey">Ảnh chụp từ chính sản phẩm đang chạy.</p>
    </div>

    <div className="mt-16 space-y-20 lg:space-y-28">
      <div className="reveal grid items-center gap-10 lg:grid-cols-2">
        <div className="order-2 lg:order-1">
          <span className="inline-flex items-center gap-2 rounded-full bg-navy-50 px-3 py-1 text-xs font-semibold text-navy">Cuộc gọi luyện nói</span>
          <h3 className="mt-4 font-display text-2xl font-bold text-ink">Gọi và nói chuyện với AI về video</h3>
          <p className="mt-3 text-slatey">Nhấn để nói và trò chuyện tự nhiên về video bạn chọn. AI mở đầu bằng chính nội dung video, có phụ đề và (ở mode Người mới) chỉnh được tốc độ.</p>
          <ul className="mt-5 space-y-2.5 text-sm text-ink">
            <li className="flex items-center gap-2"><svg className="h-4 w-4 text-navy" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg> Nhấn để nói, hội thoại thời gian thực</li>
            <li className="flex items-center gap-2"><svg className="h-4 w-4 text-navy" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg> Bật/tắt phụ đề, chỉnh tốc độ phát</li>
            <li className="flex items-center gap-2"><svg className="h-4 w-4 text-navy" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg> Gợi ý "Tôi nên nói gì?" khi bí</li>
          </ul>
        </div>
        <div className="relative order-1 lg:order-2">
          <div className="frame">
            <div className="frame-bar"><span className="frame-dot bg-[#ff5f57]"></span><span className="frame-dot bg-[#febc2e]"></span><span className="frame-dot bg-[#28c840]"></span><span className="ml-2 flex items-center gap-1 text-[11px] font-medium text-slatey"><svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> AI Speaking Coach · Luyện nói</span></div>
            <img src="/images/landing/media__1785244054586.png" alt="Màn hình cuộc gọi luyện nói: nút Nhấn để nói và AI mở đầu về video" />
          </div>
          <div className="card-lift absolute -bottom-6 -left-6 hidden w-64 overflow-hidden rounded-2xl lg:block">
            <img src="/images/landing/media__1785243840802.png" alt="Popup tra nghĩa từ quiet trong ngữ cảnh" className="block w-full" />
          </div>
          <div className="card-lift absolute -top-8 -right-8 hidden w-64 overflow-hidden rounded-2xl lg:block">
            <img src="/images/landing/media__1785244083201.png" alt="Popup gợi ý trả lời" className="block w-full" />
          </div>
        </div>
      </div>

      <div className="reveal grid items-center gap-10 lg:grid-cols-2">
        <div className="frame">
          <div className="frame-bar"><span className="frame-dot bg-[#ff5f57]"></span><span className="frame-dot bg-[#febc2e]"></span><span className="frame-dot bg-[#28c840]"></span><span className="ml-2 flex items-center gap-1 text-[11px] font-medium text-slatey"><svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> AI Speaking Coach · Lịch sử</span></div>
          <img src="/images/landing/media__1785244146966.png" alt="Lịch sử hội thoại gắn với video YouTube và nút Nghe lại" />
        </div>
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-navy-50 px-3 py-1 text-xs font-semibold text-navy">Lịch sử hội thoại</span>
          <h3 className="mt-4 font-display text-2xl font-bold text-ink">Xem lại cả cuộc hội thoại</h3>
          <p className="mt-3 text-slatey">Mỗi cuộc gọi được lưu kèm video gốc (tiêu đề, kênh, thời lượng) và toàn bộ transcript hội thoại giữa bạn và AI. Bấm "Nghe lại" để nghe lại câu trả lời của AI.</p>
          <ul className="mt-5 space-y-2.5 text-sm text-ink">
            <li className="flex items-center gap-2"><svg className="h-4 w-4 text-navy" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg> Gắn với video gốc & trạng thái hoàn thành</li>
            <li className="flex items-center gap-2"><svg className="h-4 w-4 text-navy" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg> Đọc lại toàn bộ transcript</li>
            <li className="flex items-center gap-2"><svg className="h-4 w-4 text-navy" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg> Nghe lại câu trả lời của AI</li>
          </ul>
        </div>
      </div>

      <div className="reveal grid items-center gap-10 lg:grid-cols-2">
        <div className="order-2 lg:order-1">
          <span className="inline-flex items-center gap-2 rounded-full bg-navy-50 px-3 py-1 text-xs font-semibold text-navy">Từ vựng</span>
          <h3 className="mt-4 font-display text-2xl font-bold text-ink">Từ vựng tự lưu mỗi buổi</h3>
          <p className="mt-3 text-slatey">Kết thúc cuộc trò chuyện, những từ bạn đã tra được gom lại trong "Từ vựng trong buổi này" — kèm nghĩa tiếng Việt và câu ngữ cảnh gốc để bạn ôn lại hiệu quả.</p>
          <ul className="mt-5 space-y-2.5 text-sm text-ink">
            <li className="flex items-center gap-2"><svg className="h-4 w-4 text-navy" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg> Danh sách từ đã tra trong cuộc gọi</li>
            <li className="flex items-center gap-2"><svg className="h-4 w-4 text-navy" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg> Nghĩa tiếng Việt + câu ngữ cảnh</li>
            <li className="flex items-center gap-2"><svg className="h-4 w-4 text-navy" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg> Dễ dàng ôn lại về sau</li>
          </ul>
        </div>
        <div className="order-1 frame lg:order-2">
          <div className="frame-bar"><span className="frame-dot bg-[#ff5f57]"></span><span className="frame-dot bg-[#febc2e]"></span><span className="frame-dot bg-[#28c840]"></span><span className="ml-2 flex items-center gap-1 text-[11px] font-medium text-slatey"><svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> AI Speaking Coach · Từ vựng</span></div>
          <img src="/images/landing/history-vocab.png" alt="Thẻ Từ vựng trong buổi này với từ market và câu ngữ cảnh" />
        </div>
      </div>
    </div>
  </div>
</section>


<section id="roadmap" className="mx-auto max-w-7xl px-6 py-20 md:px-8 lg:py-28">
  <div className="reveal mx-auto max-w-2xl text-center">
    <span className="text-sm font-semibold uppercase tracking-widest text-navy">Sắp ra mắt</span>
    <h2 className="mt-3 font-display text-3xl font-bold text-ink sm:text-4xl">Lộ trình phát triển</h2>
    <p className="mt-4 text-lg text-slatey">Sản phẩm tập trung vào hội thoại từ video YouTube. Tiếp theo trên lộ trình:</p>
  </div>
  <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
    <div className="reveal relative rounded-3xl border border-dashed border-navy-200 bg-navy-50/40 p-7">
      <div className="flex items-center justify-between">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-navy shadow-card"><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></span>
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">Sắp ra mắt</span>
      </div>
      <h3 className="mt-5 font-display text-lg font-bold text-ink">Thi thử</h3>
      <p className="mt-2 text-sm text-slatey">Bài thi thử để đo trình độ nói hiện tại của bạn.</p>
    </div>
    <div className="reveal relative rounded-3xl border border-dashed border-navy-200 bg-navy-50/40 p-7">
      <div className="flex items-center justify-between">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-navy shadow-card"><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4"/></svg></span>
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">Sắp ra mắt</span>
      </div>
      <h3 className="mt-5 font-display text-lg font-bold text-ink">IELTS Part 1</h3>
      <p className="mt-2 text-sm text-slatey">Luyện trả lời câu hỏi cá nhân theo chủ đề IELTS.</p>
    </div>
    <div className="reveal relative rounded-3xl border border-dashed border-navy-200 bg-navy-50/40 p-7">
      <div className="flex items-center justify-between">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-navy shadow-card"><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/></svg></span>
        <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slatey">Chưa mở khóa</span>
      </div>
      <h3 className="mt-5 font-display text-lg font-bold text-ink">IELTS Part 2</h3>
      <p className="mt-2 text-sm text-slatey">Nói liên tục 2 phút về một chủ đề cho sẵn (Cue Card).</p>
    </div>
    <div className="reveal relative rounded-3xl border border-dashed border-navy-200 bg-navy-50/40 p-7">
      <div className="flex items-center justify-between">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-navy shadow-card"><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 10h8M8 14h5M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z"/></svg></span>
        <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slatey">Chưa mở khóa</span>
      </div>
      <h3 className="mt-5 font-display text-lg font-bold text-ink">IELTS Part 3</h3>
      <p className="mt-2 text-sm text-slatey">Tranh luận và trình bày quan điểm sâu hơn.</p>
    </div>
  </div>
</section>


<section id="cta" className="mx-auto max-w-7xl px-6 py-20 md:px-8 lg:py-24">
  <div className="reveal relative overflow-hidden rounded-[32px] bg-navy px-8 py-16 text-center shadow-soft md:px-16">
    <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl"></div>
    <div className="pointer-events-none absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-[#6366f1]/30 blur-3xl"></div>
    <div className="relative">
      <h2 className="mx-auto max-w-2xl font-display text-3xl font-bold text-white sm:text-5xl">Bắt đầu cuộc trò chuyện chỉ trong 1 cú nhấp.</h2>
      <p className="mx-auto mt-4 max-w-xl text-lg text-navy-100">Dán link YouTube đầu tiên và nói câu tiếng Anh đầu tiên ngay hôm nay. Miễn phí, không cần thẻ.</p>
      <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link href="/login" className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-7 py-4 text-base font-semibold text-navy shadow-lg transition hover:bg-navy-50">
          Dùng thử miễn phí
          <svg className="h-5 w-5 transition-transform group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </Link>
        <a href="#how" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/30 px-7 py-4 text-base font-semibold text-white transition hover:bg-white/10">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          Xem cách hoạt động
        </a>
      </div>
    </div>
  </div>
</section>


<footer className="border-t border-slate-100 bg-white">
  <div className="mx-auto max-w-7xl px-6 py-14 md:px-8">
    <div className="grid gap-10 md:grid-cols-5">
      <div className="md:col-span-2">
        <Link href="/login" className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-navy text-white font-display font-bold text-sm">AI</span>
          <span className="font-display text-[17px] font-bold text-ink">Speaking Coach</span>
        </Link>
        <p className="mt-4 max-w-xs text-sm text-slatey">Luyện nói tiếng Anh với AI, từ chính những video YouTube bạn yêu thích.</p>
        <div className="mt-5 flex gap-2">
          <Link href="/login" className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slatey transition hover:border-navy-200 hover:text-navy"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"/></svg></Link>
          <Link href="/login" className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slatey transition hover:border-navy-200 hover:text-navy"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.6 15.6V8.4l6.2 3.6z"/></svg></Link>
          <Link href="/login" className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slatey transition hover:border-navy-200 hover:text-navy"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.2c-5.4 0-9.8 4.4-9.8 9.8 0 4.3 2.8 8 6.7 9.3.5.1.7-.2.7-.5v-1.7c-2.7.6-3.3-1.3-3.3-1.3-.5-1.1-1.1-1.4-1.1-1.4-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.3-1.1.6-1.3-2.2-.2-4.5-1.1-4.5-4.9 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.6 0 0 .8-.3 2.7 1a9.4 9.4 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .5 1.3.2 2.3.1 2.6.6.7 1 1.6 1 2.7 0 3.8-2.3 4.7-4.5 4.9.3.3.7.9.7 1.9v2.8c0 .3.2.6.7.5 3.9-1.3 6.7-5 6.7-9.3 0-5.4-4.4-9.8-9.8-9.8z"/></svg></Link>
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold text-ink">Sản phẩm</p>
        <ul className="mt-4 space-y-3 text-sm text-slatey">
          <li><a href="#features" className="hover:text-navy">Tính năng</a></li>
          <li><a href="#how" className="hover:text-navy">Cách hoạt động</a></li>
          <li><a href="#showcase" className="hover:text-navy">Sản phẩm</a></li>
          <li><a href="#roadmap" className="hover:text-navy">Sắp ra mắt</a></li>
        </ul>
      </div>
      <div>
        <p className="text-sm font-semibold text-ink">Người học</p>
        <ul className="mt-4 space-y-3 text-sm text-slatey">
          <li><a href="#how" className="hover:text-navy">Luyện qua YouTube</a></li>
          <li><a href="#features" className="hover:text-navy">Tra & lưu từ vựng</a></li>
          <li><a href="#showcase" className="hover:text-navy">Lịch sử buổi học</a></li>
          <li><a href="#roadmap" className="hover:text-navy">IELTS (sắp ra mắt)</a></li>
        </ul>
      </div>
      <div>
        <p className="text-sm font-semibold text-ink">Công ty</p>
        <ul className="mt-4 space-y-3 text-sm text-slatey">
          <li><Link href="/login" className="hover:text-navy">Về chúng tôi</Link></li>
          <li><Link href="/login" className="hover:text-navy">Liên hệ</Link></li>
          <li><Link href="/login" className="hover:text-navy">Chính sách bảo mật</Link></li>
          <li><Link href="/login" className="hover:text-navy">Điều khoản</Link></li>
        </ul>
      </div>
    </div>
    <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-100 pt-6 text-sm text-slatey sm:flex-row">
      <p>© 2026 AI Speaking Coach.</p>
      <p>Vibed & coded with 💙 by vtn2405 for Vietnamese learners</p>
    </div>
  </div>
</footer>



    </main>
  );
}
