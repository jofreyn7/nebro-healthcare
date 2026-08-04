// ============ Scroll reveal ============
function escapeHtmlPublic(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {

  // ============ Dynamic site content (Hero, Footer, About — admin-editable) ============
  // Falls back silently to the static HTML already on the page if no backend
  // is connected yet, or if the site_content table/rows don't exist.
  (async function loadDynamicContent() {
    if (typeof supabaseClient === 'undefined') return;
    try {
      const { data, error } = await supabaseClient.from('site_content').select('key, value');
      if (error || !data) return;
      const content = Object.fromEntries(data.map(row => [row.key, row.value]));

      const heroKeyByPage = {
        'index.html': 'hero', '': 'hero',
        'about.html': 'about_hero',
        'industries.html': 'industries_hero',
        'products.html': 'products_hero',
        'case-studies.html': 'case_studies_hero',
        'resources.html': 'resources_hero',
        'contact.html': 'contact_hero',
      };
      const currentPage = location.pathname.split('/').pop();
      const heroKey = heroKeyByPage[currentPage] || 'hero';
      const hero = content[heroKey];

      if (hero) {
        const eyebrowEl = document.getElementById('hero-eyebrow-text');
        const headingEl = document.getElementById('hero-heading');
        const subtextEl = document.getElementById('hero-subtext');
        if (eyebrowEl && hero.eyebrow) eyebrowEl.textContent = hero.eyebrow;
        if (subtextEl && hero.subtext) subtextEl.textContent = hero.subtext;
        if (headingEl && hero.heading) {
          const words = hero.heading.split(' ');
          const accentCount = hero.accent_words || 3;
          headingEl.innerHTML = words.map((w, i) => {
            const isAccent = i >= words.length - accentCount;
            return `<span class="word${isAccent ? ' text-gradient' : ''}" style="transition-delay:${i * 70}ms">${w}</span>`;
          }).join(' ');
          headingEl.classList.add('is-visible'); // already-loaded hero shouldn't wait for scroll
        }
      }

      if (content.footer) {
        const { blurb, address, phone } = content.footer;
        const blurbEl = document.getElementById('footer-blurb-text');
        const addressEl = document.getElementById('footer-address-text');
        const phoneEl = document.getElementById('footer-phone-text');
        if (blurbEl && blurb) blurbEl.textContent = blurb;
        if (addressEl && address) addressEl.textContent = address;
        if (phoneEl && phone) phoneEl.textContent = phone;
      }

      // About page: Mission & Vision + Story blocks (only present on about.html)
      if (content.about_mission) {
        const headingEl = document.getElementById('about-mission-heading');
        const bodyEl = document.getElementById('about-mission-body');
        if (headingEl && content.about_mission.heading) headingEl.textContent = content.about_mission.heading;
        if (bodyEl && content.about_mission.body) bodyEl.textContent = content.about_mission.body;
      }
      if (content.about_story) {
        const headingEl = document.getElementById('about-story-heading');
        const p1El = document.getElementById('about-story-para1');
        const p2El = document.getElementById('about-story-para2');
        if (headingEl && content.about_story.heading) headingEl.textContent = content.about_story.heading;
        if (p1El && content.about_story.paragraph1) p1El.textContent = content.about_story.paragraph1;
        if (p2El && content.about_story.paragraph2) p2El.textContent = content.about_story.paragraph2;
      }
      // Site images — hero photos, specialization photos, About/Commitment photos.
      // Generic: any container id in this map gets its <img> shown + fallback
      // hidden if a URL is set; otherwise the icon placeholder stays as-is.
      if (content.site_images) {
        const imgKeyToContainerId = {
          hero_photo_1: 'hero-photo-1', hero_photo_2: 'hero-photo-2', hero_photo_3: 'hero-photo-3',
          about_mission_photo: 'about-mission-photo', commitment_photo: 'commitment-photo',
          spec_diagnostic_1: 'spec-diagnostic-1', spec_diagnostic_2: 'spec-diagnostic-2',
          spec_diagnostic_3: 'spec-diagnostic-3', spec_diagnostic_4: 'spec-diagnostic-4',
          spec_laboratory_1: 'spec-laboratory-1', spec_laboratory_2: 'spec-laboratory-2',
          spec_laboratory_3: 'spec-laboratory-3', spec_laboratory_4: 'spec-laboratory-4',
          spec_surgical_1: 'spec-surgical-1', spec_surgical_2: 'spec-surgical-2',
          spec_surgical_3: 'spec-surgical-3', spec_surgical_4: 'spec-surgical-4',
          trusted_tools: 'trusted-photo-tools', trusted_analyzers: 'trusted-photo-analyzers', trusted_icu: 'trusted-photo-icu',
        };
        Object.entries(imgKeyToContainerId).forEach(([key, containerId]) => {
          const url = content.site_images[key];
          if (!url) return;
          const container = document.getElementById(containerId);
          if (!container) return;
          const img = container.querySelector('.site-photo-img');
          if (img) {
            img.src = url;
            img.classList.remove('hidden');
          }
          container.querySelectorAll('.site-photo-fallback').forEach(el => el.classList.add('hidden'));
        });
      }
    } catch (e) {
      // No backend connected yet — static content stays as-is.
    }
  })();

  // ============ Theme toggle (light/dark) ============
  const themeToggle = document.getElementById('theme-toggle');
  const savedTheme = localStorage.getItem('nebro-theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  themeToggle?.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('nebro-theme', next);
  });

  // ============ Animated counters (re-trigger every time in view) ============
  document.querySelectorAll('[data-count-to]').forEach(el => {
    const target = parseFloat(el.dataset.countTo);
    const suffix = el.dataset.countSuffix || '';
    const duration = 1200;
    let animating = false;
    const counterIO = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !animating) {
          animating = true;
          const start = performance.now();
          function tick(now) {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const raw = Math.round(target * eased);
            const value = el.dataset.countPlain ? raw : raw.toLocaleString();
            el.textContent = value + suffix;
            if (progress < 1) requestAnimationFrame(tick);
            else animating = false;
          }
          requestAnimationFrame(tick);
        }
      });
    }, { threshold: 0.5 });
    counterIO.observe(el);
  });

  // ============ Animated word-by-word headings ============
  // Wrap each word in a span BEFORE observing, so the stagger animates in.
  document.querySelectorAll('[data-animate-text]').forEach(el => {
    const text = el.textContent;
    el.innerHTML = text.split(' ').map((word, i) =>
      `<span class="word" style="transition-delay:${i * 55}ms">${word}</span>`
    ).join(' ');
    el.classList.add('animate-words');
  });

  const els = document.querySelectorAll('.reveal, .animate-words');
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
    });
  }, { threshold: 0.15 });
  els.forEach(el => io.observe(el));

  // ============ Contact page: Quote vs Appointment tab toggle ============
  const tabQuote = document.getElementById('tab-quote');
  const tabAppointment = document.getElementById('tab-appointment');
  if (tabQuote && tabAppointment) {
    const formHeading = document.getElementById('form-heading');
    const formSubheading = document.getElementById('form-subheading');
    const detailsLabel = document.getElementById('details-label');
    const urgencyField = document.getElementById('urgency-field');
    const submitBtn = document.getElementById('form-submit-btn');

    const copy = {
      quote: {
        heading: 'Request a Quote',
        sub: "Fill out the form below and we'll get back to you within 24 hours with a detailed quote.",
        details: 'Detailed Requirements *',
        submit: 'Send Quote Request',
      },
      appointment: {
        heading: 'Request an Appointment',
        sub: "Tell us when works for you and we'll confirm a time to visit or call.",
        details: 'What would you like to discuss? *',
        submit: 'Request Appointment',
      },
    };

    function setTab(tab) {
      tabQuote.setAttribute('aria-pressed', tab === 'quote' ? 'true' : 'false');
      tabAppointment.setAttribute('aria-pressed', tab === 'appointment' ? 'true' : 'false');
      formHeading.textContent = copy[tab].heading;
      formSubheading.textContent = copy[tab].sub;
      detailsLabel.textContent = copy[tab].details;
      submitBtn.querySelector('#form-submit-label').textContent = copy[tab].submit;
      if (urgencyField) urgencyField.style.display = tab === 'quote' ? '' : 'none';
    }
    tabQuote.addEventListener('click', () => setTab('quote'));
    tabAppointment.addEventListener('click', () => setTab('appointment'));
  }

  // ============ Dynamic case studies (case-studies.html only, newest first) ============
  (async function loadCaseStudies() {
    const grid = document.getElementById('case-studies-grid');
    if (!grid || typeof supabaseClient === 'undefined') return;
    try {
      const { data, error } = await supabaseClient
        .from('case_studies')
        .select('*')
        .eq('published', true)
        .order('created_at', { ascending: false });
      if (error || !data || data.length === 0) return; // keep static fallback

      grid.innerHTML = data.map((c, i) => `
        <div class="reveal is-visible card-hover rounded-2xl border hairline overflow-hidden bg-[var(--paper)]" style="transition-delay:${i * 50}ms">
          <div class="h-48 ${c.photo_url ? '' : 'bg-gradient-brand flex items-center justify-center'}">
            ${c.photo_url
              ? `<img src="${c.photo_url}" class="w-full h-full object-cover" alt="${c.title}" />`
              : `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--lime)" stroke-width="1.4"><path d="M3 21h18M5 21V7l7-4 7 4v14"/></svg>`
            }
          </div>
          <div class="p-8">
            <p class="font-mono text-[11px] uppercase tracking-widest" style="color:var(--lime-deep)">${escapeHtmlPublic(c.facility)}</p>
            <h3 class="font-display font-semibold text-xl mt-2">${escapeHtmlPublic(c.title)}</h3>
            <p class="text-sm mt-3" style="color:var(--grey)">${escapeHtmlPublic(c.summary || '')}</p>
          </div>
        </div>
      `).join('');
    } catch (e) {
      // No backend connected yet — static fallback cards stay as-is.
    }
  })();

  // ============ Dynamic industries (industries.html only) ============
  (async function loadIndustries() {
    const grid = document.getElementById('industries-grid');
    if (!grid || typeof supabaseClient === 'undefined') return;
    try {
      const { data, error } = await supabaseClient
        .from('industries')
        .select('*')
        .eq('published', true)
        .order('display_order', { ascending: true });
      if (error || !data || data.length === 0) return; // keep static fallback

      grid.innerHTML = data.map((ind, i) => `
        <div class="reveal is-visible card-hover rounded-2xl border hairline p-8 bg-[var(--paper)]" style="transition-delay:${i * 40}ms">
          <div class="w-12 h-12 rounded-full flex items-center justify-center mb-6 overflow-hidden" style="background:var(--navy)">
            ${ind.photo_url
              ? `<img src="${ind.photo_url}" class="w-full h-full object-cover" alt="" />`
              : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--lime)" stroke-width="2"><path d="M3 21h18M5 21V7l7-4 7 4v14"/></svg>`
            }
          </div>
          <h3 class="font-display font-semibold text-lg">${escapeHtmlPublic(ind.title)}</h3>
          <p class="mt-2 text-sm" style="color:var(--grey)">${escapeHtmlPublic(ind.description || '')}</p>
        </div>
      `).join('');
    } catch (e) {
      // No backend connected yet — static fallback cards stay as-is.
    }
  })();

  // ============ Dynamic team members (about.html only) ============
  (async function loadTeamMembers() {
    const grid = document.getElementById('team-grid');
    if (!grid || typeof supabaseClient === 'undefined') return;
    try {
      const { data, error } = await supabaseClient
        .from('team_members')
        .select('*')
        .order('display_order', { ascending: true });
      if (error || !data || data.length === 0) return; // keep static fallback

      grid.innerHTML = data.map((m, i) => {
        const initials = m.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
        return `
          <div class="reveal is-visible rounded-2xl border hairline bg-white p-7 text-center card-hover" style="transition-delay:${i * 50}ms">
            <div class="w-16 h-16 rounded-full mx-auto flex items-center justify-center font-display font-semibold text-lg overflow-hidden" style="background:var(--navy); color:var(--lime)">
              ${m.photo_url
                ? `<img src="${m.photo_url}" class="w-full h-full object-cover" alt="${m.name}" />`
                : `<span>${initials}</span>`
              }
            </div>
            <p class="font-display font-semibold mt-4" style="color:var(--navy)">${m.name}</p>
            <p class="text-xs mt-1" style="color:var(--lime-deep)">${m.title}</p>
          </div>
        `;
      }).join('');
    } catch (e) {
      // No backend connected yet — static fallback cards stay as-is.
    }
  })();

  // ============ Dynamic product catalog (products.html only) ============
  (async function loadDynamicProducts() {
    const grid = document.getElementById('grid');
    if (!grid || typeof supabaseClient === 'undefined') return;
    try {
      const { data, error } = await supabaseClient
        .from('products')
        .select('*')
        .eq('status', 'published')
        .order('created_at', { ascending: false });
      if (error || !data || data.length === 0) return; // keep static fallback cards

      const categoryLabels = { diagnostic: 'Diagnostic', laboratory: 'Laboratory', surgical: 'Surgical & ICU' };
      const categoryIcons = {
        diagnostic: '<path d="M6 3v6a4 4 0 0 0 4 4h0a4 4 0 0 0 4-4V3M14 13v3a5 5 0 0 1-10 0v-1M18 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/>',
        laboratory: '<path d="M9 2v6.5L4 20a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2l-5-11.5V2M9 2h6"/>',
        surgical: '<path d="M3 12h4l2-7 4 14 2-7h6"/>',
      };
      const gradients = {
        diagnostic: 'linear-gradient(135deg,#A3C23955,#A3C23911)',
        laboratory: 'linear-gradient(135deg,#1D304E22,#1D304E08)',
        surgical: 'linear-gradient(135deg,#A3C23933,#1D304E11)',
      };

      grid.innerHTML = data.map(p => `
        <div class="product-card reveal is-visible card-hover rounded-2xl border hairline overflow-hidden bg-white" data-category="${p.category}">
          <div class="product-quote-overlay">
            <a href="contact.html" class="font-mono text-xs font-medium px-5 py-2.5 rounded-full text-white flex items-center gap-2 btn-glow" style="background:var(--lime); color:var(--navy)!important">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--navy)" stroke-width="2.2"><path d="m22 2-7 20-4-9-9-4Z"/></svg>
              Request a Quote
            </a>
          </div>
          <div class="h-40 flex items-center justify-center" style="${p.photo_url ? '' : `background:${gradients[p.category] || gradients.diagnostic}`}">
            ${p.photo_url
              ? `<img src="${p.photo_url}" class="w-full h-full object-cover" alt="${p.name}" />`
              : `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--navy)" stroke-width="1.5">${categoryIcons[p.category] || categoryIcons.diagnostic}</svg>`
            }
          </div>
          <div class="p-6">
            <p class="font-mono text-[11px] uppercase tracking-widest" style="color:var(--lime-deep)">${categoryLabels[p.category] || p.category}</p>
            <h3 class="font-display font-semibold mt-2">${p.name}</h3>
            <p class="text-sm mt-2" style="color:var(--grey)">${p.description || ''}</p>
          </div>
        </div>
      `).join('');

      // Re-wire the category filter against the freshly-rendered cards.
      const filterButtons = document.querySelectorAll('.filter-btn');
      const cards = document.querySelectorAll('.product-card');
      const emptyState = document.getElementById('empty-state');
      filterButtons.forEach(btn => {
        btn.onclick = () => {
          filterButtons.forEach(b => b.setAttribute('aria-pressed', 'false'));
          btn.setAttribute('aria-pressed', 'true');
          const filter = btn.dataset.filter;
          let visibleCount = 0;
          cards.forEach(card => {
            const match = filter === 'all' || card.dataset.category === filter;
            card.classList.toggle('hidden-card', !match);
            if (match) visibleCount++;
          });
          if (emptyState) emptyState.classList.toggle('hidden', visibleCount !== 0);
        };
      });
    } catch (e) {
      // No backend connected yet, or fetch failed — static fallback cards stay as-is.
    }
  })();

  // ============ Mobile nav toggle ============
  const toggle = document.getElementById('mobile-menu-toggle');
  const mobileNav = document.getElementById('mobile-nav');
  if (toggle && mobileNav) {
    toggle.addEventListener('click', () => {
      const isOpen = mobileNav.classList.toggle('flex');
      mobileNav.classList.toggle('hidden');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      document.getElementById('icon-open')?.classList.toggle('hidden');
      document.getElementById('icon-close')?.classList.toggle('hidden');
    });
    mobileNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mobileNav.classList.add('hidden');
        mobileNav.classList.remove('flex');
        toggle.setAttribute('aria-expanded', 'false');
        document.getElementById('icon-open')?.classList.remove('hidden');
        document.getElementById('icon-close')?.classList.add('hidden');
      });
    });
  }

  // ============ Header shadow on scroll ============
  const header = document.getElementById('site-header');
  if (header) {
    const onScroll = () => {
      header.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // ============ Product / specialization hover switcher ============
  document.querySelectorAll('[data-switcher]').forEach(switcher => {
    const triggers = switcher.querySelectorAll('[data-switch-trigger]');
    const panels = switcher.querySelectorAll('[data-switch-panel]');
    triggers.forEach(trigger => {
      const activate = () => {
        const key = trigger.dataset.switchTrigger;
        triggers.forEach(t => t.classList.toggle('is-active', t === trigger));
        panels.forEach(p => p.classList.toggle('is-active', p.dataset.switchPanel === key));
      };
      trigger.addEventListener('mouseenter', activate);
      trigger.addEventListener('focus', activate);
      trigger.addEventListener('click', activate);
    });
  });

  // ============ "Our Commitment" click-to-expand accordion ============
  document.querySelectorAll('[data-commitment-accordion]').forEach(accordion => {
    const triggers = accordion.querySelectorAll('[data-commitment-trigger]');
    triggers.forEach(trigger => {
      trigger.addEventListener('click', () => {
        triggers.forEach(t => {
          const isThis = t === trigger;
          t.classList.toggle('is-active', isThis);
          t.style.background = isThis ? 'var(--lime)' : '';
          t.classList.toggle('hairline', !isThis);
          t.classList.toggle('border', !isThis);
          t.querySelector('.commitment-detail')?.classList.toggle('hidden', !isThis);
        });
      });
    });
  });

  // ============ Hero / page slideshow ============
  document.querySelectorAll('[data-slideshow]').forEach(show => {
    const slides = Array.from(show.querySelectorAll('.slide'));
    const dotsWrap = show.querySelector('.slide-dots');
    if (!slides.length) return;
    let dots = [];
    if (dotsWrap) {
      dots = slides.map((_, i) => {
        const d = document.createElement('button');
        d.type = 'button';
        d.className = 'slide-dot' + (i === 0 ? ' is-active' : '');
        d.setAttribute('aria-label', `Show slide ${i + 1}`);
        d.addEventListener('click', () => goTo(i));
        dotsWrap.appendChild(d);
        return d;
      });
    }
    let current = 0;
    let timer;
    function goTo(i) {
      slides[current].classList.remove('is-active');
      dots[current]?.classList.remove('is-active');
      current = i;
      slides[current].classList.add('is-active');
      dots[current]?.classList.add('is-active');
    }
    function next() { goTo((current + 1) % slides.length); }
    function start() {
      if (slides.length > 1 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        timer = setInterval(next, 4500);
      }
    }
    show.addEventListener('mouseenter', () => clearInterval(timer));
    show.addEventListener('mouseleave', start);
    start();
  });

  // ============ Product category filter (products.html) ============
  const filterButtons = document.querySelectorAll('.filter-btn');
  const cards = document.querySelectorAll('.product-card');
  const emptyState = document.getElementById('empty-state');
  if (filterButtons.length && cards.length) {
    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        filterButtons.forEach(b => b.setAttribute('aria-pressed', 'false'));
        btn.setAttribute('aria-pressed', 'true');
        const filter = btn.dataset.filter;
        let visibleCount = 0;
        cards.forEach(card => {
          const match = filter === 'all' || card.dataset.category === filter;
          card.classList.toggle('hidden-card', !match);
          if (match) visibleCount++;
        });
        if (emptyState) emptyState.classList.toggle('hidden', visibleCount !== 0);
      });
    });
  }

  // ============ Contact / quote form — inserts into Supabase `inquiries` ============
  const quoteForm = document.getElementById('quote-form');
  if (quoteForm) {
    quoteForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const feedback = document.getElementById('form-feedback');
      const submitBtn = document.getElementById('form-submit-btn');
      const originalLabel = document.getElementById('form-submit-label')?.textContent;

      const payload = {
        name: document.getElementById('quote-name')?.value.trim(),
        email: document.getElementById('quote-email')?.value.trim(),
        facility: document.getElementById('quote-facility')?.value.trim() || null,
        category: (() => {
          const c = document.getElementById('quote-category')?.value;
          return c && c !== 'Select a category' ? c : null;
        })(),
        message: document.getElementById('quote-message')?.value.trim() || null,
      };

      if (typeof supabaseClient === 'undefined') {
        if (feedback) {
          feedback.textContent = 'This form needs a backend connection to submit — see the README for Supabase setup.';
          feedback.classList.remove('hidden');
        }
        return;
      }

      submitBtn.disabled = true;
      if (document.getElementById('form-submit-label')) document.getElementById('form-submit-label').textContent = 'Sending...';

      const { error } = await supabaseClient.from('inquiries').insert(payload);

      submitBtn.disabled = false;
      if (document.getElementById('form-submit-label')) document.getElementById('form-submit-label').textContent = originalLabel;

      if (feedback) {
        feedback.textContent = error
          ? "Something went wrong sending your request — please try again, or call/WhatsApp us directly."
          : "Thanks — we've received your request and will follow up within 24 hours.";
        feedback.classList.remove('hidden');
      }
      if (!error) quoteForm.reset();
    });
  }

  // ============ AI assistant widget — real Claude-backed replies ============
  const aiButton = document.getElementById('ai-widget-button');
  const aiPanel = document.getElementById('ai-widget-panel');
  const aiForm = document.getElementById('ai-widget-form');
  const aiMessages = document.getElementById('ai-widget-messages');
  const aiInput = document.getElementById('ai-widget-input');
  let aiHistory = [];

  if (aiButton && aiPanel) {
    aiButton.addEventListener('click', () => aiPanel.classList.toggle('is-open'));
    document.getElementById('ai-widget-close')?.addEventListener('click', () => aiPanel.classList.remove('is-open'));
  }

  if (aiForm && aiInput && aiMessages) {
    aiForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = aiInput.value.trim();
      if (!text) return;

      const userMsg = document.createElement('div');
      userMsg.className = 'ai-msg user';
      userMsg.textContent = text;
      aiMessages.appendChild(userMsg);
      aiInput.value = '';
      aiMessages.scrollTop = aiMessages.scrollHeight;

      const typingMsg = document.createElement('div');
      typingMsg.className = 'ai-msg bot';
      typingMsg.textContent = '...';
      aiMessages.appendChild(typingMsg);
      aiMessages.scrollTop = aiMessages.scrollHeight;

      let reply;
      try {
        if (typeof SUPABASE_URL === 'undefined') throw new Error('not configured');
        const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-assistant`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, history: aiHistory }),
        });
        const result = await res.json();
        if (!res.ok || !result.reply) throw new Error(result.error || 'no reply');
        reply = result.reply;
        aiHistory.push({ role: 'user', content: text }, { role: 'assistant', content: reply });
      } catch (err) {
        reply = "I'm having trouble reaching our assistant right now — for an immediate answer, reach us at info@nebro.co.tz, call +255 621 132 663, or use the Contact form.";
      }

      typingMsg.textContent = reply;
      aiMessages.scrollTop = aiMessages.scrollHeight;
    });
  }
});
