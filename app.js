(() => {
  'use strict';
  const config = window.COOMEET_CONFIG || { videos: {}, paywallUrl: '' };
  const icons = {
    back: '<path d="m15 5-7 7 7 7"/>', next: '<path d="m9 5 7 7-7 7"/>',
    camera: '<rect x="3" y="5" width="13" height="14" rx="3"/><path d="m16 10 5-3v10l-5-3"/>',
    cameraOff: '<path d="M3 3l18 18M9 5h4a3 3 0 0 1 3 3v6m0-4 5-3v10l-3-2M3 8v8a3 3 0 0 0 3 3h7M3 5l13 14"/>',
    mic: '<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2m-7 9v3m-3 0h6"/>',
    micOff: '<path d="m3 3 18 18M9 9v3a3 3 0 0 0 5 2m1-7V5a3 3 0 0 0-5.4-1.8M5 10v2a7 7 0 0 0 11 5.7M19 10v2m-7 7v3m-3 0h6"/>',
    chat: '<path d="M20 11.5a8 8 0 0 1-8 8H4l1.5-4a8 8 0 1 1 14.5-4Z"/>',
    users: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m2-17a3 3 0 0 1 0 6m1 5a5 5 0 0 1 3 4v2"/>',
    shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    check: '<path d="m5 12 4 4 10-10"/>', close: '<path d="m6 6 12 12M6 18 18 6"/>',
    women: '<circle cx="12" cy="8" r="5"/><path d="M12 13v9m-4-4h8"/>',
    men: '<circle cx="9" cy="15" r="5"/><path d="m12.5 11.5 7-7M14 4h6v6"/>',
    both: '<circle cx="8" cy="8" r="3.4"/><path d="M8 11.4v7.2m-3.2-3.2h6.4M15.2 16.2a3.6 3.6 0 1 1 .2-5.2l4.2-4.2M17.2 4h4.2v4.2"/>'
  };
  const svg = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.chat}</svg>`;
  const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const people = [
    { id: 'karolina', name: 'Karolina', image: config.posters?.karolina || 'assets/karolina.webp' },
    { id: 'hanna', name: 'Hanna', image: config.posters?.hanna || 'assets/hanna.webp' },
    { id: 'helen', name: 'Helen', image: config.posters?.helen || 'assets/helen.webp' },
    { id: 'laura', name: 'Laura', image: config.posters?.laura || 'assets/laura.webp' }
  ];
  const state = { step: 1, preference: 'Women', person: 'karolina', carousel: 2, email: '', muted: false };
  const phone = document.querySelector('.phone');
  const screen = document.getElementById('screen');
  const footer = document.getElementById('footer');
  const progress = document.querySelector('.progress');
  const back = document.getElementById('back');
  const dialog = document.getElementById('dialog');
  let carouselTimer = null;
  let carouselFinishTimer = null;
  let carouselPosition = 5;
  let carouselAnimating = false;
  let resizeFrame;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const portrait = person => `<span class="type-photo"><img src="${escape(config.photos?.[person.id] || person.image)}" alt="${person.name}" draggable="false"><span class="ring"></span></span>`;
  const media = (person, key = person.id) => {
    const poster = escape(config.posters?.[key] || person.image);
    const label = escape(key === 'final' ? 'Video chat preview' : `${person.name} video preview`);
    return config.videos?.[key]
      ? `<video class="preview-media" data-src="${escape(config.videos[key])}" poster="${poster}" muted loop playsinline preload="none" aria-label="${label}"></video>`
      : `<img class="preview-media" src="${poster}" alt="${escape(person.name)}" draggable="false">`;
  };
  const intro = (title, subtitle = '') => `<div class="intro"><h1 tabindex="-1">${title}</h1>${subtitle ? `<p>${subtitle}</p>` : ''}</div>`;
  const radio = '<span class="radio" aria-hidden="true"></span>';
  const arrow = svg('next');
  const trust = final => `<div class="trust">${(final ? [['lock','Private chat'],['shield','Secure connection'],['users','Data protected']] : [['camera','Live video chat'],['users','Real people'],['lock','Safe & private']]).map(([icon,text]) => `<span>${svg(icon)}${text}</span>`).join('')}</div>`;
  const ctaLabels = ['Let’s go','Show me','Keep going','Show me more','Let me in'];
  const validEmail = value => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
  function render(focus = true) {
    clearInterval(carouselTimer);
    clearTimeout(carouselFinishTimer);
    cancelAnimationFrame(resizeFrame);
    carouselAnimating = false;
    screen.querySelectorAll('video').forEach(video => video.pause());
    back.hidden = state.step === 1;
    phone.className = `phone ${state.step === 1 ? 'hook' : state.step === 5 ? 'final' : ''}`;
    screen.className = `screen ${state.step === 3 ? 'carousel-screen' : state.step === 4 ? 'type-screen' : state.step === 5 ? 'final-screen' : ''}`;
    progress.hidden = state.step === 1;
    progress.innerHTML = [1,2,3,4].map(n => `<span class="${n < state.step ? 'active' : ''}"></span>`).join('');
    if (state.step === 1) {
      screen.innerHTML = `<div class="hero-media">${media(people[2], 'hook')}</div><div class="bubbles" aria-label="Chat messages"><span class="bubble">Hey ;)</span><span class="bubble">Want to chat? 😘</span></div><div class="hero-content">${intro('Someone interesting might be<br><em>waiting for you</em>','See who’s online and where the conversation goes')}</div>`;
    } else if (state.step === 2) {
      screen.innerHTML = intro('Who do you want<br><em>to meet?</em>','Choose who you’d like to see in your roulette') + `<div class="options" role="radiogroup" aria-label="Who do you want to meet">${[['Women','women','assets/choices/women.webp'],['Men','men','assets/choices/men.webp'],['Both','both','assets/choices/both.webp']].map(([name,icon,image]) => `<button class="choice ${state.preference === name ? 'selected' : ''}" role="radio" aria-checked="${state.preference === name}" tabindex="${state.preference === name ? '0' : '-1'}" data-preference="${name}"><span class="choice-photo"><img src="${image}" alt="" draggable="false"></span><span class="ring"></span><span class="choice-label">${svg(icon)}${name}</span>${radio}</button>`).join('')}</div>`;
    } else if (state.step === 3) {
      const carouselPeople = [...people.slice(0,3), ...people.slice(0,3), ...people.slice(0,3)];
      screen.innerHTML = intro('You never know<br><em>who’s next</em>','Every next chat is a surprise') + `<div class="carousel" role="region" aria-roledescription="carousel" aria-label="People to meet" tabindex="0"><div class="carousel-track">${carouselPeople.map((person,i) => `<article class="video-card ${i === state.carousel+3 ? 'active' : ''}" aria-hidden="${i !== state.carousel+3}" aria-label="${person.name}, ${i%3+1} of 3">${media(person)}<span class="ring"></span><span class="live"><i></i>LIVE</span><span class="card-chat">${svg('chat')}</span><div class="card-person"><strong>${person.name}</strong><p><i class="online-dot"></i>Online now</p></div></article>`).join('')}</div></div>`;
    } else if (state.step === 4) {
      screen.innerHTML = intro('Which one is more<br><em>your type?</em>','Pick the one you’d want to meet') + `<div class="type-grid" role="radiogroup" aria-label="Choose your type">${people.map(person => `<button class="type ${state.person === person.id ? 'selected' : ''}" role="radio" aria-checked="${state.person === person.id}" tabindex="${state.person === person.id ? '0' : '-1'}" data-person="${person.id}">${portrait(person)}<span class="type-name">${person.name}</span></button>`).join('')}</div>`;
    } else {
      const person = people.find(p => p.id === state.person);
      screen.innerHTML = intro('She & <em>126 similar girls</em><br>are online right now') + `<div class="call">${media(person, 'final')}<span class="ring"></span><span class="live"><i></i>LIVE</span><div class="call-bubble">Hii, I’m already waiting for you. Are you joining? 😘</div><div class="call-controls"><button class="call-control" id="camera" aria-label="Camera preview information">${svg('cameraOff')}</button><button class="call-control" id="microphone" aria-label="${state.muted ? 'Unmute preview' : 'Mute preview'}" aria-pressed="${state.muted}">${svg(state.muted ? 'micOff' : 'mic')}</button><button class="call-control" id="chat" aria-label="Open chat preview">${svg('chat')}</button></div><div class="camera-preview">${svg('cameraOff')}<p>Your camera<br>is off</p></div></div><form class="email-form" id="email-form" novalidate><label class="sr-only" for="email">Your email</label><div class="input-wrap"><input id="email" name="email" type="email" placeholder="Enter your e-mail" autocomplete="email" inputmode="email" maxlength="254" value="${escape(state.email)}" aria-describedby="email-error" required></div><p id="email-error" class="error" role="alert" hidden></p><p class="legal">By continuing, you agree to our <button type="button" id="terms">Terms</button> and <button type="button" id="privacy">Privacy Policy</button>.</p></form>`;
    }
    const ready = state.step !== 5 || validEmail(state.email);
    footer.innerHTML = `<button class="cta${ready ? '' : ' is-disabled'}" id="next" ${state.step === 5 ? 'type="submit" form="email-form"' : ''} ${ready ? '' : 'disabled'}>${ctaLabels[state.step-1]} ${arrow}</button><div class="footer-notes"${state.step > 1 && state.step < 5 ? ' aria-hidden="true"' : ''}>${state.step === 1 || state.step === 5 ? trust(state.step === 5) : ''}</div>`;
    if (state.step !== 5) document.getElementById('next').addEventListener('click', () => go(state.step+1));
    bindScreen();
    syncVideos();
    screen.scrollTop = 0;
    if (focus) screen.querySelector('h1')?.focus({preventScroll:true});
  }
  function go(step) {
    if (!Number.isInteger(step) || step < 1 || step > 5) throw new Error('Screen must be between 1 and 5.');
    if (state.step === 5) state.email = document.getElementById('email')?.value || state.email;
    if (step === 3) state.carousel = 2;
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
    const carousel = screen.querySelector('.carousel');
    if (state.step === 3 && carousel && !document.hidden && !reducedMotion.matches) {
      carouselTimer = setInterval(() => {
        if (state.step === 3 && screen.querySelector('.carousel') === carousel && !document.hidden && !reducedMotion.matches) changeSlide(-1);
      },4000);
    }
  }
  function syncVideos() {
    screen.querySelectorAll('video').forEach(video => {
      const card = video.closest('.video-card');
      const active = !document.hidden && (!card || card.classList.contains('active'));
      if (active && video.dataset.src) {
        if (!video.getAttribute('src')) video.src = video.dataset.src;
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }
  function placeCarousel(container, position, instant = false) {
    const track = container.querySelector('.carousel-track');
    const cards = [...container.querySelectorAll('.video-card')];
    const width = parseFloat(getComputedStyle(cards[0]).width);
    const left = (container.clientWidth-width)/2;
    if (instant) {
      container.classList.add('is-rebasing');
      track.style.transition = 'none';
    }
    track.style.transform = `translateX(${left-position*(width+12)}px)`;
    cards.forEach((card,i) => {card.classList.toggle('active',i === position);card.setAttribute('aria-hidden',String(i !== position));});
    syncVideos();
    if (instant) {
      track.getBoundingClientRect();
      container.classList.remove('is-rebasing');
      track.style.removeProperty('transition');
    }
  }
  function finishSlide(container) {
    if (state.step !== 3 || screen.querySelector('.carousel') !== container) return;
    clearTimeout(carouselFinishTimer);
    carouselAnimating = false;
    const position = state.carousel+3;
    if (carouselPosition !== position) {
      const cards = [...container.querySelectorAll('.video-card')];
      const activeMedia = cards[carouselPosition].querySelector('.preview-media');
      const replacementMedia = cards[position].querySelector('.preview-media');
      // Keep the playing media when returning from a repeated card to its middle copy.
      if (activeMedia && replacementMedia) {
        replacementMedia.replaceWith(activeMedia);
        cards[carouselPosition].prepend(replacementMedia);
      }
      carouselPosition = position;
      placeCarousel(container,position,true);
    }
  }
  function slideTo(index, announce = false, animate = true) {
    const container = screen.querySelector('.carousel');
    if (state.step !== 3 || !container || carouselAnimating) return;
    const next = ((index%3)+3)%3;
    animate = animate && !reducedMotion.matches;
    carouselPosition = animate ? carouselPosition+index-state.carousel : next+3;
    state.carousel = next;
    carouselAnimating = animate;
    placeCarousel(container,carouselPosition,!animate);
    if (animate) carouselFinishTimer = setTimeout(() => finishSlide(container),650);
    if (announce) document.getElementById('announcement').textContent = `${people[state.carousel].name}, ${state.carousel+1} of 3`;
  }
  function changeSlide(delta, manual = false) {slideTo(state.carousel+delta,manual);if(manual)resetAuto();}
  function syncCta() {
    const next = document.getElementById('next');
    if (!next || state.step !== 5) return;
    const ok = validEmail(state.email);
    next.disabled = !ok;
    next.classList.toggle('is-disabled', !ok);
  }
  function submitEmail(event) {
    event?.preventDefault();
    const input = document.getElementById('email');
    const error = document.getElementById('email-error');
    state.email = input.value.trim();
    if (!validEmail(state.email) || !input.validity.valid) {
      error.hidden = false;error.textContent = 'Please enter a valid email address.';input.setAttribute('aria-invalid','true');input.focus();syncCta();return {valid:false};
    }
    input.removeAttribute('aria-invalid');error.hidden = true;
    if (config.paywallUrl) {
      const url = new URL(config.paywallUrl,location.href);
      if (!['https:','http:'].includes(url.protocol)) throw new Error('Paywall URL must use HTTP or HTTPS.');
      const detail = {email:state.email,preference:state.preference,person:state.person,paywallUrl:url.href};
      const transition = new CustomEvent('coomeet:signup',{detail,cancelable:true});
      if (window.dispatchEvent(transition)) location.assign(url.href);
      return {valid:true,configured:true};
    }
    openDialog(`${svgSymbol('check')}<h2 id="dialog-title">You’re ready to connect</h2><p>You’ve reached the end of the design preview.</p><p class="fine">The existing paywall hasn’t been connected. No account was created, no email was sent, and no payment will be taken.</p><button class="cta" id="restart">Back to the beginning ${arrow}</button>`);
    document.getElementById('restart').onclick = () => {dialog.close();state.email='';go(1);};
    return {valid:true,configured:false};
  }
  function svgSymbol(icon) {return `<div class="dialog-symbol">${svg(icon)}</div>`;}
  function openDialog(content) {document.getElementById('dialog-body').innerHTML = content;dialog.showModal();}
  function bindScreen() {
    screen.querySelectorAll('video').forEach(video => {
      video.addEventListener('error', () => {
        const poster = document.createElement('img');
        poster.className = 'preview-media';
        poster.src = video.poster;
        poster.alt = video.getAttribute('aria-label');
        poster.draggable = false;
        video.replaceWith(poster);
      }, { once: true });
    });
    if (state.step === 2) bindRadio('preference');
    if (state.step === 4) bindRadio('person');
    if (state.step === 3) {
      const carousel = screen.querySelector('.carousel');
      const track = carousel.querySelector('.carousel-track');
      slideTo(state.carousel,false,false);
      track.addEventListener('transitionend', event => {
        if (event.target === track && event.propertyName === 'transform') finishSlide(carousel);
      });
      let startX = 0, startY = 0;
      carousel.addEventListener('pointerdown', event => {startX=event.clientX;startY=event.clientY;clearInterval(carouselTimer);carousel.setPointerCapture(event.pointerId);});
      carousel.addEventListener('pointerup', event => {if(state.step !== 3 || screen.querySelector('.carousel') !== carousel)return;const dx=event.clientX-startX,dy=event.clientY-startY;if(Math.abs(dx)>35 && Math.abs(dx)>Math.abs(dy))changeSlide(dx<0?1:-1,true);resetAuto();});
      carousel.addEventListener('pointercancel',()=>{if(screen.querySelector('.carousel') === carousel)resetAuto();});
      carousel.addEventListener('keydown', event => {if(screen.querySelector('.carousel') === carousel && ['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();changeSlide(event.key === 'ArrowLeft' ? -1 : 1,true);}});
      resetAuto();
    }
    if (state.step === 5) {
      document.getElementById('email-form').addEventListener('submit',submitEmail);
      document.getElementById('email').addEventListener('input', event => {state.email=event.target.value.trim();event.target.removeAttribute('aria-invalid');document.getElementById('email-error').hidden=true;syncCta();});
      document.getElementById('microphone').onclick = event => {state.muted=!state.muted;const button=event.currentTarget;button.innerHTML=svg(state.muted?'micOff':'mic');button.setAttribute('aria-pressed',String(state.muted));button.setAttribute('aria-label',state.muted?'Unmute preview':'Mute preview');};
      document.getElementById('camera').onclick = () => openDialog(`${svgSymbol('cameraOff')}<h2 id="dialog-title">Your camera stays off</h2><p>This is a video chat preview. Your camera and microphone are never accessed.</p>`);
      document.getElementById('chat').onclick = () => {
        openDialog(`${svgSymbol('chat')}<h2 id="dialog-title">Say hello</h2><p>Try a message in the preview. It won’t be sent.</p><form class="chat-compose" id="chat-form"><label class="sr-only" for="chat-input">Your message</label><input id="chat-input" placeholder="Your message" maxlength="280" required><button type="submit">Try</button></form><div id="chat-draft" hidden class="draft-message"></div>`);
        document.getElementById('chat-form').onsubmit = event => {event.preventDefault();const value=document.getElementById('chat-input').value.trim();if(!value)return;const output=document.getElementById('chat-draft');output.hidden=false;output.textContent=value;};
      };
      document.getElementById('terms').onclick = () => openDialog(`${svgSymbol('shield')}<h2 id="dialog-title">Terms · Preview</h2><p>This prototype demonstrates a mobile interface. Profiles, messages and online counts are illustrative.</p>`);
      document.getElementById('privacy').onclick = () => openDialog(`${svgSymbol('lock')}<h2 id="dialog-title">Privacy · Preview</h2><p>Your email and choices stay in this page’s memory. They are not sent to a server.</p>`);
    }
  }
  back.innerHTML = svg('back');
  back.onclick = () => go(state.step-1);
  document.getElementById('close-dialog').innerHTML=svg('close');
  document.getElementById('close-dialog').onclick=()=>dialog.close();
  dialog.addEventListener('click',event => {if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});
  window.addEventListener('hashchange',()=>{const step=Number(location.hash.slice(1));if(Number.isInteger(step)&&step>=1&&step<=5&&step!==state.step)go(step);});
  window.addEventListener('resize',()=>{
    cancelAnimationFrame(resizeFrame);
    const carousel = screen.querySelector('.carousel');
    if (state.step !== 3 || !carousel) return;
    resizeFrame = requestAnimationFrame(()=>{
      if (state.step !== 3 || screen.querySelector('.carousel') !== carousel) return;
      finishSlide(carousel);
      slideTo(state.carousel,false,false);
    });
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInterval(carouselTimer);const carousel=screen.querySelector('.carousel');if(carousel)finishSlide(carousel);}else resetAuto();syncVideos();});
  reducedMotion.addEventListener('change',()=>{const carousel=screen.querySelector('.carousel');if(carousel)finishSlide(carousel);resetAuto();});
  let count=1200;
  setInterval(()=>{if(document.hidden||reducedMotion.matches)return;count=Math.max(1200,Math.min(1300,count+(Math.random()>.5?20:-10)));document.getElementById('online').textContent=`${(count/1000).toFixed(1)}K`;},9500);
  const initial=Number(location.hash.slice(1));if(Number.isInteger(initial)&&initial>=1&&initial<=5)state.step=initial;
  render(false);
})();
