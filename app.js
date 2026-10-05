(() => {
  'use strict';
  const config = window.COOMEET_CONFIG || { videos: {}, paywallUrl: '' };
  const icons = {
    back: '<path d="m14 5-7 7 7 7"/>', next: '<path d="m10 5 7 7-7 7"/>',
    moon: '<path d="M20 13a8 8 0 0 1-9-9 8 8 0 1 0 9 9Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5"/>',
    camera: '<rect x="3" y="5" width="13" height="14" rx="3"/><path d="m16 10 5-3v10l-5-3"/>',
    cameraOff: '<path d="M3 3l18 18M9 5h4a3 3 0 0 1 3 3v6m0-4 5-3v10l-3-2M3 8v8a3 3 0 0 0 3 3h7M3 5l13 14"/>',
    mic: '<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2m-7 9v3m-3 0h6"/>',
    micOff: '<path d="m3 3 18 18M9 9v3a3 3 0 0 0 5 2m1-7V5a3 3 0 0 0-5.4-1.8M5 10v2a7 7 0 0 0 11 5.7M19 10v2m-7 7v3m-3 0h6"/>',
    chat: '<path d="M20 11.5a8 8 0 0 1-8 8H4l1.5-4a8 8 0 1 1 14.5-4Z"/><path d="M8 11h.01M12 11h.01M16 11h.01"/>',
    users: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m2-17a3 3 0 0 1 0 6m1 5a5 5 0 0 1 3 4v2"/>',
    shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m9 12 2 2 4-4"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>',
    check: '<path d="m5 12 4 4 10-10"/>', close: '<path d="m6 6 12 12M6 18 18 6"/>',
    women: '<circle cx="12" cy="8" r="5"/><path d="M12 13v9m-4-4h8"/>',
    men: '<circle cx="9" cy="15" r="5"/><path d="m12.5 11.5 7-7M14 4h6v6"/>'
  };
  const svg = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.chat}</svg>`;
  const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const people = [
    { id: 'karolina', name: 'Karolina', age: 25, image: 'assets/karolina.webp' },
    { id: 'hanna', name: 'Hanna', age: 29, image: 'assets/hanna.webp' },
    { id: 'helen', name: 'Helen', age: 35, image: 'assets/helen.webp' },
    { id: 'laura', name: 'Laura', age: 28, image: 'assets/laura.webp' }
  ];
  const state = { step: 1, preference: 'Women', person: 'karolina', carousel: 0, email: '', muted: false };
  const phone = document.querySelector('.phone');
  const screen = document.getElementById('screen');
  const footer = document.getElementById('footer');
  const progress = document.querySelector('.progress');
  const back = document.getElementById('back');
  const dialog = document.getElementById('dialog');
  let carouselTimer = null;
  let resizeFrame;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const portrait = person => `<img src="${person.image}" alt="${person.name}, ${person.age}, smiling in a casual room" draggable="false">`;
  const media = (person, key = person.id) => `<video ${config.videos?.[key] ? `src="${escape(config.videos[key])}"` : ''} poster="${person.image}" autoplay muted loop playsinline preload="metadata" aria-label="${person.name} video preview"></video>`;
  const intro = (title, subtitle = '', label = '') => `<div class="intro">${label ? `<span class="eyebrow">${label}</span>` : ''}<h1 tabindex="-1">${title}</h1>${subtitle ? `<p>${subtitle}</p>` : ''}</div>`;
  const radio = '<span class="radio" aria-hidden="true">' + svg('check') + '</span>';
  const trust = final => `<div class="trust">${(final ? [['lock','Private chat'],['shield','Secure connection'],['users','Data protected']] : [['camera','Live video chat'],['users','Real people'],['shield','Safe & private']]).map(([icon,text]) => `<span>${svg(icon)}${text}</span>`).join('')}</div>`;
  const note = text => `<p class="privacy-note">${svg('shield')}${text}</p>`;
  const ctaLabels = ['Let’s go','Show me','Keep going','Show me more','Let me in'];
  function updateTheme() {
    const dark = document.documentElement.dataset.theme === 'dark';
    document.getElementById('theme').innerHTML = svg(dark ? 'sun' : 'moon');
    document.getElementById('theme').setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} theme`);
    document.querySelector('meta[name="theme-color"]').content = dark ? '#121e3c' : '#f3f7ff';
  }
  function setTheme(value) {
    document.documentElement.dataset.theme = value;
    try { localStorage.setItem('coomeet-theme', value); } catch { /* Offline private browsing may disable storage. */ }
    updateTheme();
  }
  function render(focus = true) {
    clearInterval(carouselTimer);
    screen.querySelectorAll('video').forEach(video => video.pause());
    back.hidden = state.step === 1;
    phone.className = `phone ${state.step === 1 ? 'hook' : state.step === 5 ? 'final' : ''}`;
    screen.className = `screen ${state.step === 3 ? 'carousel-screen' : state.step === 4 ? 'type-screen' : state.step === 5 ? 'final-screen' : ''}`;
    progress.hidden = state.step === 1;
    progress.innerHTML = [1,2,3,4].map(n => `<span class="${n < state.step ? 'active' : ''}" aria-label="Step ${n}${n < state.step ? ', completed' : ''}"${n === state.step-1 ? ' aria-current="step"' : ''}></span>`).join('');
    if (state.step === 1) {
      screen.innerHTML = `<div class="hero-media">${media(people[0], 'hook')}</div><span class="media-tag">${svg('camera')}Video preview</span><div class="bubbles" aria-label="Chat messages"><span class="bubble">Hey <em>;)</em></span><span class="bubble">Want to chat?</span></div><div class="hero-content">${intro('Someone interesting<br>might be <em>waiting<br>for you</em>','See who’s online and where the conversation goes')}</div>`;
    } else if (state.step === 2) {
      screen.innerHTML = intro('Who do you want<br><em>to meet?</em>','Choose who you’d like to see in your roulette') + `<div class="options" role="radiogroup" aria-label="Who do you want to meet">${[['Women','women','assets/karolina.webp'],['Men','men','assets/man.webp'],['Both','users','assets/couple.webp']].map(([name,icon,image]) => `<button class="choice ${state.preference === name ? 'selected' : ''}" role="radio" aria-checked="${state.preference === name}" tabindex="${state.preference === name ? '0' : '-1'}" data-preference="${name}"><span class="choice-photo"><img src="${image}" alt="" draggable="false"></span><span class="choice-label">${svg(icon)}${name}</span>${radio}</button>`).join('')}</div>` + note('You can change this later');
    } else if (state.step === 3) {
      screen.innerHTML = intro('You never know<br><em>who’s next</em>','Every next chat is a surprise') + `<div class="carousel" role="region" aria-roledescription="carousel" aria-label="People to meet" tabindex="0"><div class="carousel-track">${people.slice(0,3).map((person,i) => `<article class="video-card ${state.carousel === i ? 'active' : ''}" aria-label="${person.name}, ${i+1} of 3">${media(person)}<span class="live" title="Illustrative live status"><i></i>LIVE</span><span class="card-chat">${svg('chat')}</span><div class="card-person"><strong>${person.name}, ${person.age}</strong><p><i class="online-dot"></i>Online now</p></div></article>`).join('')}</div></div><div class="carousel-nav"><button class="icon-button" id="carousel-prev" aria-label="Previous person">${svg('back')}</button><div class="dots">${people.slice(0,3).map((person,i) => `<button class="dot ${i === state.carousel ? 'active' : ''}" data-slide="${i}" aria-label="Show ${person.name}" aria-pressed="${i === state.carousel}"></button>`).join('')}</div><button class="icon-button" id="carousel-next" aria-label="Next person">${svg('next')}</button></div>` + note('Swipe to meet someone new');
    } else if (state.step === 4) {
      screen.innerHTML = intro('Which one is more<br><em>your type?</em>','Pick the one you’d want to meet') + `<div class="type-grid" role="radiogroup" aria-label="Choose your type">${people.map(person => `<button class="type ${state.person === person.id ? 'selected' : ''}" role="radio" aria-checked="${state.person === person.id}" tabindex="${state.person === person.id ? '0' : '-1'}" data-person="${person.id}">${portrait(person)}${radio}<span class="type-name">${person.name}<small>${person.age} years old</small></span></button>`).join('')}</div>`;
    } else {
      const person = people.find(p => p.id === state.person);
      screen.innerHTML = intro('She and <em>126 similar girls</em><br>are online right now') + `<div class="call">${media(person)}<span class="live" title="Illustrative live status"><i></i>LIVE</span><div class="call-bubble"><b>Hii,</b> I’m already waiting for you. Are you joining?</div><div class="call-controls"><button class="call-control" id="camera" aria-label="Camera preview information">${svg('cameraOff')}</button><button class="call-control" id="microphone" aria-label="${state.muted ? 'Unmute preview' : 'Mute preview'}" aria-pressed="${state.muted}">${svg(state.muted ? 'micOff' : 'mic')}</button><button class="call-control" id="chat" aria-label="Open chat preview">${svg('chat')}</button></div><div class="camera-preview">${svg('cameraOff')}<p>Your camera<br>is off</p></div></div><form class="email-form" id="email-form" novalidate><label class="sr-only" for="email">Your email</label><div class="input-wrap">${svg('mail')}<input id="email" name="email" type="email" placeholder="Your email" autocomplete="email" inputmode="email" maxlength="254" value="${escape(state.email)}" aria-describedby="email-error" required></div><p id="email-error" class="error" role="alert" hidden></p></form>`;
    }
    footer.innerHTML = `<button class="cta" id="next" ${state.step === 5 ? 'type="submit" form="email-form"' : ''}>${ctaLabels[state.step-1]}</button>${state.step === 1 || state.step === 5 ? trust(state.step === 5) : `<p class="step-note"><b>${state.step-1}</b> of 4 · Find your connection</p>`}${state.step === 5 ? '<p class="legal">By continuing, you agree to our<br><button id="terms">Terms</button> and <button id="privacy">Privacy Policy</button>.</p><p class="preview-note">Design preview · Illustrative profiles and online counts</p>' : ''}`;
    if (state.step !== 5) document.getElementById('next').addEventListener('click', () => go(state.step+1));
    bindScreen();
    if (focus) screen.querySelector('h1')?.focus({preventScroll:true});
  }
  function go(step) {
    if (!Number.isInteger(step) || step < 1 || step > 5) throw new Error('Screen must be between 1 and 5.');
    if (state.step === 5) state.email = document.getElementById('email')?.value || state.email;
    state.step = step;
    if (location.hash !== `#${step}`) location.hash = String(step);
    render();
    window.scrollTo({top:0,behavior:'instant'});
  }
  function select(group, key, value) {
    state[key] = value;
    group.querySelectorAll('[role="radio"]').forEach(button => {
      const selected = button.dataset[key] === value;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-checked', String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
  }
  function bindRadio(key) {
    const group = screen.querySelector('[role="radiogroup"]');
    group.querySelectorAll('[role="radio"]').forEach(button => button.addEventListener('click', () => select(group,key,button.dataset[key])));
    group.addEventListener('keydown', event => {
      if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
      event.preventDefault();
      const buttons = [...group.querySelectorAll('[role="radio"]')];
      const current = buttons.indexOf(document.activeElement);
      const delta = ['ArrowLeft','ArrowUp'].includes(event.key) ? -1 : 1;
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length-1 : (current+delta+buttons.length)%buttons.length;
      buttons[index].click();buttons[index].focus();
    });
  }
  function resetAuto() {
    clearInterval(carouselTimer);
    if (state.step === 3 && !document.hidden && !reducedMotion.matches) carouselTimer = setInterval(() => changeSlide(1),4000);
  }
  function slideTo(index, announce = false) {
    state.carousel = ((index%3)+3)%3;
    const container = screen.querySelector('.carousel');
    if (!container) return;
    const cards = [...container.querySelectorAll('.video-card')];
    const width = cards[0].getBoundingClientRect().width / (cards[0].classList.contains('active') ? 1 : .94);
    const left = (container.clientWidth-width)/2;
    container.querySelector('.carousel-track').style.transform = `translateX(${left-state.carousel*(width+14)}px)`;
    cards.forEach((card,i) => {card.classList.toggle('active',i === state.carousel);card.setAttribute('aria-hidden',String(i !== state.carousel));const video = card.querySelector('video');if(i === state.carousel && video.getAttribute('src')) video.play().catch(()=>{}); else video.pause();});
    screen.querySelectorAll('.dot').forEach((dot,i) => {dot.classList.toggle('active',i === state.carousel);dot.setAttribute('aria-pressed',String(i === state.carousel));});
    if (announce) document.getElementById('announcement').textContent = `${people[state.carousel].name}, ${state.carousel+1} of 3`;
  }
  function changeSlide(delta, manual = false) {slideTo(state.carousel+delta,manual);if(manual)resetAuto();}
  function validEmail(value) {return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);}
  function submitEmail(event) {
    event?.preventDefault();
    const input = document.getElementById('email');
    const error = document.getElementById('email-error');
    state.email = input.value.trim();
    if (!validEmail(state.email) || !input.validity.valid) {
      error.hidden = false;error.textContent = 'Please enter a valid email address.';input.setAttribute('aria-invalid','true');input.focus();return {valid:false};
    }
    input.removeAttribute('aria-invalid');error.hidden = true;
    if (config.paywallUrl) {
      const url = new URL(config.paywallUrl,location.href);
      if (!['https:','http:'].includes(url.protocol)) throw new Error('Paywall URL must use HTTP or HTTPS.');
      // The host page can handle the event and transfer email safely without URL query parameters.
      const detail = {email:state.email,preference:state.preference,person:state.person,paywallUrl:url.href};
      const transition = new CustomEvent('coomeet:signup',{detail,cancelable:true});
      if (window.dispatchEvent(transition)) location.assign(url.href);
      return {valid:true,configured:true};
    }
    openDialog(`${svgSymbol('check')}<h2 id="dialog-title">You’re ready to connect</h2><p>You’ve reached the end of the design preview.</p><p class="fine">The existing paywall hasn’t been connected. No account was created, no email was sent, and no payment will be taken.</p><button class="cta" id="restart">Back to the beginning</button>`);
    document.getElementById('restart').onclick = () => {dialog.close();state.email='';go(1);};
    return {valid:true,configured:false};
  }
  function svgSymbol(icon) {return `<div class="dialog-symbol">${svg(icon)}</div>`;}
  function openDialog(content) {document.getElementById('dialog-body').innerHTML = content;dialog.showModal();}
  function bindScreen() {
    if (state.step === 2) bindRadio('preference');
    if (state.step === 4) bindRadio('person');
    if (state.step === 3) {
      requestAnimationFrame(() => slideTo(state.carousel));
      document.getElementById('carousel-prev').onclick = () => changeSlide(-1,true);
      document.getElementById('carousel-next').onclick = () => changeSlide(1,true);
      screen.querySelectorAll('[data-slide]').forEach(button => button.onclick = () => {slideTo(Number(button.dataset.slide),true);resetAuto();});
      const carousel = screen.querySelector('.carousel');
      let startX = 0, startY = 0;
      carousel.addEventListener('pointerdown', event => {startX=event.clientX;startY=event.clientY;clearInterval(carouselTimer);carousel.setPointerCapture(event.pointerId);});
      carousel.addEventListener('pointerup', event => {const dx=event.clientX-startX,dy=event.clientY-startY;if(Math.abs(dx)>35 && Math.abs(dx)>Math.abs(dy))changeSlide(dx<0?1:-1,true);resetAuto();});
      carousel.addEventListener('pointercancel',resetAuto);
      carousel.addEventListener('keydown', event => {if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();changeSlide(event.key === 'ArrowLeft' ? -1 : 1,true);}});
      carousel.addEventListener('mouseenter',()=>clearInterval(carouselTimer));
      carousel.addEventListener('mouseleave',resetAuto);
      carousel.addEventListener('focusin',()=>clearInterval(carouselTimer));
      carousel.addEventListener('focusout',resetAuto);
      resetAuto();
    }
    if (state.step === 5) {
      document.getElementById('email-form').addEventListener('submit',submitEmail);
      document.getElementById('email').addEventListener('input', event => {state.email=event.target.value;event.target.removeAttribute('aria-invalid');document.getElementById('email-error').hidden=true;});
      document.getElementById('microphone').onclick = event => {state.muted=!state.muted;const button=event.currentTarget;button.innerHTML=svg(state.muted?'micOff':'mic');button.setAttribute('aria-pressed',String(state.muted));button.setAttribute('aria-label',state.muted?'Unmute preview':'Mute preview');};
      document.getElementById('camera').onclick = () => openDialog(`${svgSymbol('cameraOff')}<h2 id="dialog-title">Your camera stays off</h2><p>This is a video chat preview. Your camera and microphone are never accessed.</p>`);
      document.getElementById('chat').onclick = () => {
        openDialog(`${svgSymbol('chat')}<h2 id="dialog-title">Say hello</h2><p>Try a message in the preview. It won’t be sent.</p><form class="chat-compose" id="chat-form"><label class="sr-only" for="chat-input">Your message</label><input id="chat-input" placeholder="Your message" maxlength="280" required><button type="submit">Try</button></form><div id="chat-draft" hidden class="draft-message"></div>`);
        document.getElementById('chat-form').onsubmit = event => {event.preventDefault();const value=document.getElementById('chat-input').value.trim();if(!value)return;const output=document.getElementById('chat-draft');output.hidden=false;output.textContent=value;};
      };
      document.getElementById('terms').onclick = () => openDialog(`${svgSymbol('shield')}<h2 id="dialog-title">Terms · Preview</h2><p>This local prototype demonstrates a mobile interface. Profiles, messages and online counts are illustrative. It doesn’t provide a live chat or paid service.</p><p class="fine">Production terms must be connected before this interface is used for registration.</p>`);
      document.getElementById('privacy').onclick = () => openDialog(`${svgSymbol('lock')}<h2 id="dialog-title">Privacy · Preview</h2><p>Your email and choices stay in this page’s memory. They are not sent to a server. Your theme preference is saved only in this browser.</p><p class="fine">There are no trackers, external fonts or camera access in this prototype.</p>`);
    }
  }
  back.innerHTML = svg('back');
  back.onclick = () => go(state.step-1);
  document.getElementById('close-dialog').innerHTML=svg('close');
  document.getElementById('close-dialog').onclick=()=>dialog.close();
  dialog.addEventListener('click',event => {if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});
  document.getElementById('theme').onclick=()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
  window.addEventListener('hashchange',()=>{const step=Number(location.hash.slice(1));if(Number.isInteger(step)&&step>=1&&step<=5&&step!==state.step)go(step);});
  window.addEventListener('resize',()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>slideTo(state.carousel));});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInterval(carouselTimer);else resetAuto();});
  reducedMotion.addEventListener('change',resetAuto);
  let count=1200;
  setInterval(()=>{if(document.hidden||reducedMotion.matches)return;count=Math.max(1200,Math.min(1300,count+(Math.random()>.5?20:-10)));document.getElementById('online').textContent=`${(count/1000).toFixed(1)}K`;},9500);
  try { const theme=localStorage.getItem('coomeet-theme');if(['light','dark'].includes(theme))document.documentElement.dataset.theme=theme; } catch { /* Theme defaults to light. */ }
  updateTheme();
  const initial=Number(location.hash.slice(1));if(Number.isInteger(initial)&&initial>=1&&initial<=5)state.step=initial;
  render(false);
  if (document.modelContext?.registerTool) {
    const lifecycle=new AbortController();
    const definitions=[
      {name:'read_funnel_state',description:'Read the current screen and selected preferences.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({step:state.step,preference:state.preference,person:state.person,theme:document.documentElement.dataset.theme})},
      {name:'navigate_funnel_screen',description:'Navigate to one of the five design preview screens.',inputSchema:{type:'object',properties:{step:{type:'integer',minimum:1,maximum:5}},required:['step'],additionalProperties:false},execute:input=>{go(input.step);return {step:state.step};}},
      {name:'configure_meeting_preferences',description:'Select who to meet and a profile type in the design preview.',inputSchema:{type:'object',properties:{preference:{type:'string',enum:['Women','Men','Both']},person:{type:'string',enum:people.map(p=>p.id)}},additionalProperties:false},execute:input=>{if(input.preference!==undefined&&!['Women','Men','Both'].includes(input.preference))throw new Error('Invalid preference.');if(input.person!==undefined&&!people.some(p=>p.id===input.person))throw new Error('Invalid person.');if(input.preference)state.preference=input.preference;if(input.person)state.person=input.person;render(false);return {preference:state.preference,person:state.person};}}
    ];
    definitions.forEach(tool=>{try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{ /* Unsupported draft API. */ }});
    window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  }
})();
