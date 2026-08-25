// ============================================================
// Nebro Admin — wired to Supabase (see supabase-config.js for
// project URL/anon key, and supabase/migrations/0001_init.sql
// for the schema these queries assume).
// ============================================================

let currentUser = null;   // { id, email }
let currentProfile = null; // { full_name, role }
let products = [];
let inquiries = [];
let users = [];
let activeProductFilter = 'all';
let pendingImageFile = null;

const categoryLabels = {
  'diagnostic': 'Diagnostic',
  'laboratory': 'Laboratory',
  'hospital_furniture': 'Hospital Furniture',
  'surgical_sterilization': 'Surgical & Sterilization Equipment',
  'biomedical_accessories': 'Biomedical Accessories',
  'imaging': 'Imaging Equipment',
  'dental': 'Dental',
  'orthopaedic_rehabilitation': 'Orthopaedic & Rehabilitation',
  'consumables': 'Consumables',
  'miscellaneous': 'Miscellaneous'
};
const roleLabels = { developer: 'Developer', super_admin: 'Super Admin', staff: 'Staff' };

// ============================================================
// Auth guard — runs before anything else renders
// ============================================================
async function requireAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }
  return session;
}

async function loadCurrentProfile(userId) {
  const { data, error } = await supabaseClient.from('profiles').select('*').eq('id', userId).single();
  if (error) { console.error(error); return null; }
  return data;
}

// ============================================================
// Data fetchers (Supabase)
// ============================================================
async function fetchProducts() {
  const { data, error } = await supabaseClient.from('products').select('*').order('created_at', { ascending: false });
  if (error) { console.error(error); return []; }
  return data;
}

async function fetchInquiries() {
  const { data, error } = await supabaseClient.from('inquiries').select('*').order('created_at', { ascending: false });
  if (error) { console.error(error); return []; }
  return data;
}

async function fetchProfiles() {
  const { data, error } = await supabaseClient.from('profiles').select('*').order('created_at', { ascending: true });
  if (error) { console.error(error); return []; }
  return data;
}

async function refreshAll() {
  [products, inquiries, users] = await Promise.all([fetchProducts(), fetchInquiries(), fetchProfiles()]);
  renderProductsTable();
  renderCategoryBreakdown();
  renderInquiriesTable();
  renderRolesTable();
}

// ============================================================
// Rendering
// ============================================================
function renderProductsTable() {
  const body = document.getElementById('products-table-body');
  if (!body) return;
  const rows = products.filter(p => activeProductFilter === 'all' || p.category === activeProductFilter);
  body.innerHTML = rows.map(p => `
    <tr data-id="${p.id}">
      <td class="font-medium" style="color:var(--navy)">
        <div class="flex items-center gap-3">
          ${p.photo_url ? `<img src="${p.photo_url}" class="admin-thumb" alt="" />` : `<span class="admin-thumb"></span>`}
          <span>${escapeHtml(p.name)}</span>
        </div>
      </td>
      <td style="color:var(--grey)">${categoryLabels[p.category] || p.category}</td>
      <td>
        <span class="status-dot" style="background:${p.status === 'published' ? 'var(--lime-deep)' : '#D1D5DB'}"></span>
        <span class="ml-1 text-xs" style="color:var(--grey)">${p.status === 'published' ? 'Published' : 'Draft'}</span>
      </td>
      <td class="text-right">
        <button class="font-mono text-xs underline mr-3" style="color:var(--navy)" data-toggle-status="${p.id}">
          ${p.status === 'published' ? 'Unpublish' : 'Publish'}
        </button>
        <button class="font-mono text-xs underline" style="color:#B91C1C" data-delete-product="${p.id}">Delete</button>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="4" class="text-center text-sm py-8" style="color:var(--grey)">No products in this category yet.</td></tr>`;

  document.getElementById('stat-products') && (document.getElementById('stat-products').textContent = products.length);
}

function renderCategoryBreakdown() {
  const el = document.getElementById('category-breakdown');
  if (!el) return;
  const counts = {
    diagnostic: 0,
    laboratory: 0,
    hospital_furniture: 0,
    surgical_sterilization: 0,
    biomedical_accessories: 0,
    imaging: 0,
    dental: 0,
    orthopaedic_rehabilitation: 0,
    consumables: 0,
    miscellaneous: 0
  };
  products.forEach(p => { counts[p.category] = (counts[p.category] || 0) + 1; });
  const max = Math.max(...Object.values(counts), 1);
  el.innerHTML = Object.entries(counts).map(([cat, count]) => `
    <div>
      <div class="flex items-center justify-between text-sm mb-1.5">
        <span style="color:var(--navy)" class="font-medium">${categoryLabels[cat]}</span>
        <span class="font-mono text-xs" style="color:var(--grey)">${count}</span>
      </div>
      <div class="h-2 rounded-full bg-[var(--paper)] overflow-hidden">
        <div class="h-full rounded-full" style="width:${(count / max) * 100}%; background:var(--lime)"></div>
      </div>
    </div>
  `).join('');
}

function renderInquiriesTable() {
  const full = document.getElementById('inquiries-table-body');
  const dash = document.getElementById('dashboard-inquiries-body');

  const rowHtml = (i, withMessage) => `
    <tr data-id="${i.id}">
      <td class="font-medium" style="color:var(--navy)">${escapeHtml(i.name)}</td>
      <td style="color:var(--grey)">${escapeHtml(i.facility || '—')}</td>
      <td style="color:var(--grey)">${escapeHtml(i.category || '—')}</td>
      ${withMessage ? `<td style="color:var(--grey)" class="max-w-xs truncate">${escapeHtml(i.message || '')}</td>` : ''}
      <td>
        <button data-toggle-inquiry="${i.id}" class="inline-flex items-center gap-1.5">
          <span class="status-dot" style="background:${i.status === 'new' ? 'var(--lime-deep)' : '#D1D5DB'}"></span>
          <span class="text-xs" style="color:var(--grey)">${i.status === 'new' ? 'New' : 'Responded'}</span>
        </button>
      </td>
      ${withMessage ? `<td class="text-right"><button data-reply-inquiry="${i.id}" class="font-mono text-xs underline" style="color:var(--navy)">Reply</button></td>` : ''}
    </tr>
  `;

  if (full) full.innerHTML = inquiries.map(i => rowHtml(i, true)).join('') || `<tr><td colspan="5" class="text-center text-sm py-8" style="color:var(--grey)">No inquiries yet.</td></tr>`;
  if (dash) dash.innerHTML = inquiries.slice(0, 4).map(i => rowHtml(i, false)).join('') || `<tr><td colspan="4" class="text-center text-sm py-8" style="color:var(--grey)">No inquiries yet.</td></tr>`;

  const badge = document.getElementById('inquiry-count-badge');
  if (badge) badge.textContent = inquiries.filter(i => i.status === 'new').length;
}

function renderRolesTable() {
  const body = document.getElementById('roles-table-body');
  if (!body) return;
  const canManage = currentProfile && ['developer', 'super_admin'].includes(currentProfile.role);
  body.innerHTML = users.map(u => `
    <tr data-id="${u.id}">
      <td class="font-medium" style="color:var(--navy)">${escapeHtml(u.full_name)}</td>
      <td style="color:var(--grey)">${escapeHtml(u.email)}</td>
      <td>
        <select data-role-select="${u.id}" ${canManage ? '' : 'disabled'} class="font-mono text-xs px-3 py-1.5 rounded-full border hairline bg-white">
          <option value="developer" ${u.role === 'developer' ? 'selected' : ''}>Developer</option>
          <option value="super_admin" ${u.role === 'super_admin' ? 'selected' : ''}>Super Admin</option>
          <option value="staff" ${u.role === 'staff' ? 'selected' : ''}>Staff</option>
        </select>
      </td>
      <td class="text-right">
        ${canManage && u.id !== currentUser?.id ? `<button class="font-mono text-xs underline" style="color:#B91C1C" data-remove-user="${u.id}">Remove</button>` : ''}
      </td>
    </tr>
  `).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

// ============================================================
// Reports & Analytics — real data from Supabase
// ============================================================
let chartLine, chartPie, chartBar;

async function renderReportsCharts(days) {
  if (typeof Chart === 'undefined') return;
  const navy = getComputedStyle(document.documentElement).getPropertyValue('--navy').trim() || '#1D304E';
  const lime = getComputedStyle(document.documentElement).getPropertyValue('--lime').trim() || '#A3C239';
  const mint = getComputedStyle(document.documentElement).getPropertyValue('--mint').trim() || '#4FBFA3';

  const since = new Date();
  since.setDate(since.getDate() - days);

  // ---- Inquiries over time ----
  const labels = [];
  const counts = [];
  const byDay = {};
  inquiries
    .filter(i => new Date(i.created_at) >= since)
    .forEach(i => {
      const key = new Date(i.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      byDay[key] = (byDay[key] || 0) + 1;
    });
  for (let d = new Date(since); d <= new Date(); d.setDate(d.getDate() + 1)) {
    const key = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    labels.push(key);
    counts.push(byDay[key] || 0);
  }

  const lineCtx = document.getElementById('chart-line');
  if (lineCtx) {
    chartLine?.destroy();
    chartLine = new Chart(lineCtx, {
      type: 'line',
      data: { labels, datasets: [{ label: 'Inquiries', data: counts, borderColor: navy, backgroundColor: navy + '22', tension: 0.35, fill: true, pointRadius: 2 }] },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } },
    });
  }

// ---- Products by category ----
const pieCtx = document.getElementById('chart-pie');
if (pieCtx) {
  // Count products by category dynamically
  const catCounts = {};
  products.forEach(p => {
    catCounts[p.category] = (catCounts[p.category] || 0) + 1;
  });
  
  // Get labels and data arrays
  const labels = Object.keys(catCounts).map(cat => categoryLabels[cat] || cat);
  const data = Object.values(catCounts);
  
  // Generate colors for all categories
  const colorPalette = [
    lime,           // diagnostic
    navy,           // laboratory
    mint,           // hospital_furniture
    '#EF4444',      // surgical_sterilization
    '#F59E0B',      // biomedical_accessories
    '#06B6D4',      // imaging
    '#EC4899',      // dental
    '#14B8A6',      // orthopaedic_rehabilitation
    '#F97316',      // consumables
    '#6B7280'       // miscellaneous
  ];
  
  const backgroundColor = labels.map((_, i) => colorPalette[i % colorPalette.length]);
  
  chartPie?.destroy();
  chartPie = new Chart(pieCtx, {
    type: 'pie',
    data: { 
      labels: labels, 
      datasets: [{ 
        data: data, 
        backgroundColor: backgroundColor 
      }] 
    },
    options: { 
      responsive: true, 
      plugins: { 
        legend: { 
          position: 'bottom',
          labels: {
            font: {
              size: 11
            }
          }
        } 
      } 
    },
  });
}

  // ---- Inquiries by category ----
  const barCtx = document.getElementById('chart-bar');
  if (barCtx) {
    const inqByCat = {};
    inquiries.filter(i => new Date(i.created_at) >= since).forEach(i => {
      const cat = i.category || 'Uncategorized';
      inqByCat[cat] = (inqByCat[cat] || 0) + 1;
    });
    chartBar?.destroy();
    chartBar = new Chart(barCtx, {
      type: 'bar',
      data: { labels: Object.keys(inqByCat), datasets: [{ label: 'Inquiries', data: Object.values(inqByCat), backgroundColor: lime, borderRadius: 6 }] },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } },
    });
  }
}

function exportReportPDF() {
  if (typeof window.jspdf === 'undefined') { alert('PDF library did not load.'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text('Nebro — Reports Summary', 14, 18);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 25);

  doc.setFontSize(12);
  doc.text('Products by Category', 14, 38);
  let y = 45;
  const counts = { diagnostic: 0, laboratory: 0, surgical: 0 };
  products.forEach(p => { counts[p.category] = (counts[p.category] || 0) + 1; });
  Object.entries(counts).forEach(([cat, count]) => {
    doc.setFontSize(10);
    doc.text(`${categoryLabels[cat]}: ${count}`, 14, y);
    y += 6;
  });

  y += 6;
  doc.setFontSize(12);
  doc.text('Recent Inquiries', 14, y);
  y += 7;
  inquiries.slice(0, 25).forEach(i => {
    doc.setFontSize(9);
    doc.text(`${i.name} — ${i.facility || 'N/A'} — ${i.category || 'N/A'} — ${i.status}`, 14, y);
    y += 6;
  });

  doc.save('nebro-report.pdf');
}

function exportReportExcel() {
  if (typeof XLSX === 'undefined') { alert('Excel library did not load.'); return; }
  const wb = XLSX.utils.book_new();
  const productSheet = XLSX.utils.json_to_sheet(products.map(p => ({ Name: p.name, Category: categoryLabels[p.category] || p.category, Status: p.status })));
  XLSX.utils.book_append_sheet(wb, productSheet, 'Products');
  const inquirySheet = XLSX.utils.json_to_sheet(inquiries.map(i => ({ Name: i.name, Email: i.email, Facility: i.facility, Category: i.category, Message: i.message, Status: i.status, Date: i.created_at })));
  XLSX.utils.book_append_sheet(wb, inquirySheet, 'Inquiries');
  XLSX.writeFile(wb, 'nebro-report.xlsx');
}

// ============================================================
// View switching
// ============================================================
function showView(view) {
  document.querySelectorAll('[data-panel]').forEach(p => p.classList.toggle('hidden', p.dataset.panel !== view));
  document.querySelectorAll('[data-view]').forEach(link => link.classList.toggle('is-active', link.dataset.view === view));
  const titles = { dashboard: 'Dashboard', products: 'Products', 'case-studies': 'Case Studies', inquiries: 'Inquiries', reports: 'Reports & Analytics', settings: 'Settings' };
  const titleEl = document.getElementById('view-title');
  if (titleEl) titleEl.textContent = titles[view] || view;
  if (view === 'reports') {
    const activeRangeBtn = document.querySelector('.report-range-btn[aria-pressed="true"]');
    renderReportsCharts(activeRangeBtn ? parseInt(activeRangeBtn.dataset.range, 10) : 30);
  }
  if (view === 'content') {
    loadContentIntoForms();
  }
}

// ---- Site Content editor (Hero per page + About blocks + Footer) ----
let siteContentCache = {};

async function loadContentIntoForms() {
  const { data } = await supabaseClient.from('site_content').select('key, value');
  siteContentCache = Object.fromEntries((data || []).map(row => [row.key, row.value]));

  populateHeroForm(document.getElementById('hero-page-select').value);

  const mission = siteContentCache.about_mission;
  if (mission) {
    document.getElementById('mission-heading').value = mission.heading || '';
    document.getElementById('mission-body').value = mission.body || '';
  }
  const story = siteContentCache.about_story;
  if (story) {
    document.getElementById('story-heading').value = story.heading || '';
    document.getElementById('story-para1').value = story.paragraph1 || '';
    document.getElementById('story-para2').value = story.paragraph2 || '';
  }
  const footer = siteContentCache.footer;
  if (footer) {
    document.getElementById('footer-blurb').value = footer.blurb || '';
    document.getElementById('footer-address').value = footer.address || '';
    document.getElementById('footer-phone').value = footer.phone || '';
  }

  const images = siteContentCache.site_images || {};
  document.querySelectorAll('.site-image-slot').forEach(slot => {
    const key = slot.dataset.imageKey;
    const url = images[key];
    const preview = slot.querySelector('.slot-preview');
    const icon = slot.querySelector('.slot-icon');
    const label = slot.querySelector('.slot-label');
    if (url) {
      preview.src = url;
      preview.classList.remove('hidden');
      icon.classList.add('hidden');
      label.textContent = 'Uploaded — click to replace';
    } else {
      preview.classList.add('hidden');
      icon.classList.remove('hidden');
    }
  });
}

function populateHeroForm(key) {
  const hero = siteContentCache[key] || {};
  document.getElementById('hero-eyebrow').value = hero.eyebrow || '';
  document.getElementById('hero-heading-field').value = hero.heading || '';
  document.getElementById('hero-subtext-field').value = hero.subtext || '';
  document.getElementById('hero-accent-words').value = hero.accent_words ?? 3;
}

// ============================================================
// Boot
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  const session = await requireAuth();
  if (!session) return; // redirected to login

  currentUser = session.user;
  currentProfile = await loadCurrentProfile(currentUser.id);

  const avatarEl = document.getElementById('current-user-avatar');
  if (avatarEl && currentProfile) {
    avatarEl.textContent = currentProfile.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    avatarEl.title = `${currentProfile.full_name} (${roleLabels[currentProfile.role]})`;
  }

  await refreshAll();

  // Sidebar nav
  document.querySelectorAll('[data-view]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      showView(link.dataset.view);
      document.getElementById('admin-mobile-nav')?.classList.add('hidden');
    });
  });
  document.querySelectorAll('[data-view-link]').forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.viewLink)));

  // Mobile admin nav
  const mobileToggle = document.getElementById('admin-mobile-toggle');
  const mobileNav = document.getElementById('admin-mobile-nav');
  mobileToggle?.addEventListener('click', () => mobileNav.classList.remove('hidden'));
  mobileNav?.querySelectorAll('[data-close-mobile-nav]').forEach(el => el.addEventListener('click', () => mobileNav.classList.add('hidden')));

  // Sign out
  document.getElementById('sign-out-btn')?.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
  });

  // Product category filter
  document.querySelectorAll('.admin-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-filter-btn').forEach(b => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      activeProductFilter = btn.dataset.cat;
      renderProductsTable();
    });
  });

  // Publish/unpublish + delete
  document.getElementById('products-table-body')?.addEventListener('click', async (e) => {
    const toggleId = e.target.closest('[data-toggle-status]')?.dataset.toggleStatus;
    const deleteId = e.target.closest('[data-delete-product]')?.dataset.deleteProduct;
    if (toggleId) {
      const p = products.find(p => p.id == toggleId);
      const newStatus = p.status === 'published' ? 'draft' : 'published';
      const { error } = await supabaseClient.from('products').update({ status: newStatus }).eq('id', toggleId);
      if (!error) { p.status = newStatus; renderProductsTable(); renderCategoryBreakdown(); }
    }
    if (deleteId) {
      const { error } = await supabaseClient.from('products').delete().eq('id', deleteId);
      if (!error) { products = products.filter(p => p.id != deleteId); renderProductsTable(); renderCategoryBreakdown(); }
      else alert('Only Developer/Super Admin can delete products.');
    }
  });

  // Inquiry status toggle
  document.getElementById('inquiries-table-body')?.addEventListener('click', async (e) => {
    const toggleId = e.target.closest('[data-toggle-inquiry]')?.dataset.toggleInquiry;
    const replyId = e.target.closest('[data-reply-inquiry]')?.dataset.replyInquiry;

    if (toggleId) {
      const i = inquiries.find(i => i.id == toggleId);
      const newStatus = i.status === 'new' ? 'responded' : 'new';
      const { error } = await supabaseClient.from('inquiries')
        .update({ status: newStatus, responded_at: newStatus === 'responded' ? new Date().toISOString() : null })
        .eq('id', toggleId);
      if (!error) { i.status = newStatus; renderInquiriesTable(); }
    }

    if (replyId) {
      const i = inquiries.find(i => i.id == replyId);
      document.getElementById('reply-to-label').textContent = `To: ${i.name} <${i.email}>`;
      document.getElementById('reply-original-message').textContent = i.message || '(no message provided)';
      document.getElementById('reply-form').dataset.inquiryId = replyId;
      document.getElementById('reply-modal').classList.add('is-open');
    }
  });

  // Reply modal
  const replyModal = document.getElementById('reply-modal');
  replyModal?.querySelectorAll('[data-close-modal]').forEach(el => el.addEventListener('click', () => replyModal.classList.remove('is-open')));
  replyModal?.addEventListener('click', (e) => { if (e.target === replyModal) replyModal.classList.remove('is-open'); });

  document.getElementById('reply-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const inquiryId = e.target.dataset.inquiryId;
    const message = document.getElementById('reply-message').value.trim();
    if (!message) return;

    const { data: { session } } = await supabaseClient.auth.getSession();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ inquiryId, message }),
    });
    const result = await res.json();
    if (!res.ok) { alert('Could not send reply: ' + result.error); return; }

    const i = inquiries.find(i => i.id == inquiryId);
    if (i) i.status = 'responded';
    renderInquiriesTable();
    e.target.reset();
    replyModal.classList.remove('is-open');
  });

  document.getElementById('hero-page-select')?.addEventListener('change', (e) => {
    populateHeroForm(e.target.value);
  });

  document.getElementById('content-hero-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const key = document.getElementById('hero-page-select').value;
    const value = {
      eyebrow: document.getElementById('hero-eyebrow').value.trim(),
      heading: document.getElementById('hero-heading-field').value.trim(),
      subtext: document.getElementById('hero-subtext-field').value.trim(),
      accent_words: parseInt(document.getElementById('hero-accent-words').value, 10) || 3,
    };
    const { error } = await supabaseClient.from('site_content').upsert({ key, value, updated_by: currentUser.id });
    siteContentCache[key] = value;
    const statusEl = document.getElementById('content-hero-status');
    statusEl.textContent = error ? 'Could not save' : 'Published ✓ — live now';
    setTimeout(() => (statusEl.textContent = ''), 3000);
  });

  document.getElementById('content-mission-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const value = {
      heading: document.getElementById('mission-heading').value.trim(),
      body: document.getElementById('mission-body').value.trim(),
    };
    await supabaseClient.from('site_content').upsert({ key: 'about_mission', value, updated_by: currentUser.id });
  });

  document.getElementById('content-story-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const value = {
      heading: document.getElementById('story-heading').value.trim(),
      paragraph1: document.getElementById('story-para1').value.trim(),
      paragraph2: document.getElementById('story-para2').value.trim(),
    };
    await supabaseClient.from('site_content').upsert({ key: 'about_story', value, updated_by: currentUser.id });
  });

  document.getElementById('content-footer-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const value = {
      blurb: document.getElementById('footer-blurb').value.trim(),
      address: document.getElementById('footer-address').value.trim(),
      phone: document.getElementById('footer-phone').value.trim(),
    };
    await supabaseClient.from('site_content').upsert({ key: 'footer', value, updated_by: currentUser.id });
  });

  // Site Images upload slots
  document.querySelectorAll('.site-image-slot').forEach(slot => {
    const key = slot.dataset.imageKey;
    const input = slot.querySelector('.slot-input');
    input?.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      const statusEl = document.getElementById('site-images-status');
      statusEl.textContent = 'Uploading...';

      const ext = file.name.split('.').pop();
      const path = `${key}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabaseClient.storage.from('site-images').upload(path, file, { upsert: true });
      if (uploadError) { statusEl.textContent = 'Upload failed: ' + uploadError.message; return; }

      const publicUrl = supabaseClient.storage.from('site-images').getPublicUrl(path).data.publicUrl;
      const currentImages = siteContentCache.site_images || {};
      currentImages[key] = publicUrl;
      const { error: saveError } = await supabaseClient.from('site_content')
        .upsert({ key: 'site_images', value: currentImages, updated_by: currentUser.id });

      if (saveError) { statusEl.textContent = 'Saved image but failed to publish: ' + saveError.message; return; }

      siteContentCache.site_images = currentImages;
      const preview = slot.querySelector('.slot-preview');
      const icon = slot.querySelector('.slot-icon');
      const label = slot.querySelector('.slot-label');
      preview.src = publicUrl;
      preview.classList.remove('hidden');
      icon.classList.add('hidden');
      label.textContent = 'Uploaded — click to replace';
      statusEl.textContent = 'Published ✓ — live on the site now';
      setTimeout(() => (statusEl.textContent = ''), 3000);
    });
  });

  // Add product modal
  const modal = document.getElementById('add-product-modal');
  document.getElementById('open-add-product')?.addEventListener('click', () => modal.classList.add('is-open'));
  modal?.querySelectorAll('[data-close-modal]').forEach(el => el.addEventListener('click', () => modal.classList.remove('is-open')));
  modal?.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('is-open'); });

  const imageInput = document.getElementById('new-product-image');
  const uploadPreview = document.getElementById('upload-preview');
  const uploadIcon = document.getElementById('upload-icon');
  const uploadLabel = document.getElementById('upload-label');
  imageInput?.addEventListener('change', () => {
    const file = imageInput.files?.[0];
    if (!file) return;
    pendingImageFile = file;
    const reader = new FileReader();
    reader.onload = () => {
      uploadPreview.src = reader.result;
      uploadPreview.classList.remove('hidden');
      uploadIcon.classList.add('hidden');
      uploadLabel.textContent = file.name;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('add-product-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('new-product-name').value.trim();
    const category = document.getElementById('new-product-category').value;
    const description = document.getElementById('new-product-desc').value.trim();
    if (!name) return;

    let photo_url = null;
    if (pendingImageFile) {
      const ext = pendingImageFile.name.split('.').pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabaseClient.storage.from('product-photos').upload(path, pendingImageFile);
      if (!uploadError) {
        photo_url = supabaseClient.storage.from('product-photos').getPublicUrl(path).data.publicUrl;
      } else {
        console.error(uploadError);
      }
    }

    const { data, error } = await supabaseClient
      .from('products')
      .insert({ name, category, description, photo_url, status: 'draft', created_by: currentUser.id })
      .select()
      .single();

    if (error) { alert('Could not add product: ' + error.message); return; }

    products.unshift(data);
    renderProductsTable();
    renderCategoryBreakdown();
    e.target.reset();
    pendingImageFile = null;
    uploadPreview.classList.add('hidden');
    uploadIcon.classList.remove('hidden');
    uploadLabel.textContent = 'Click to upload a photo';
    modal.classList.remove('is-open');
    showView('products');
  });

  // Invite user modal
  const inviteModal = document.getElementById('invite-user-modal');
  document.getElementById('open-invite-user')?.addEventListener('click', () => inviteModal.classList.add('is-open'));
  inviteModal?.querySelectorAll('[data-close-modal]').forEach(el => el.addEventListener('click', () => inviteModal.classList.remove('is-open')));
  inviteModal?.addEventListener('click', (e) => { if (e.target === inviteModal) inviteModal.classList.remove('is-open'); });

  document.getElementById('invite-user-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const full_name = document.getElementById('new-user-name').value.trim();
    const email = document.getElementById('new-user-email').value.trim();
    const role = document.getElementById('new-user-role').value;
    if (!full_name || !email) return;

    const { data: { session } } = await supabaseClient.auth.getSession();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/invite-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ email, full_name, role }),
    });
    const result = await res.json();
    if (!res.ok) { alert('Could not invite user: ' + result.error); return; }

    users = await fetchProfiles();
    renderRolesTable();
    e.target.reset();
    inviteModal.classList.remove('is-open');
  });

  document.getElementById('roles-table-body')?.addEventListener('change', async (e) => {
    const sel = e.target.closest('[data-role-select]');
    if (!sel) return;
    const { error } = await supabaseClient.from('profiles').update({ role: sel.value }).eq('id', sel.dataset.roleSelect);
    if (error) alert('Could not update role: ' + error.message);
  });

  // Reports: date-range presets + custom range + exports
  document.querySelectorAll('.report-range-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.report-range-btn').forEach(b => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      renderReportsCharts(parseInt(btn.dataset.range, 10));
    });
  });
  document.getElementById('report-custom-apply')?.addEventListener('click', () => {
    const from = document.getElementById('report-from').value;
    const to = document.getElementById('report-to').value;
    if (!from || !to) return;
    const days = Math.max(1, Math.round((new Date(to) - new Date(from)) / 86400000) + 1);
    document.querySelectorAll('.report-range-btn').forEach(b => b.setAttribute('aria-pressed', 'false'));
    renderReportsCharts(days);
  });
  document.getElementById('export-pdf')?.addEventListener('click', exportReportPDF);
  document.getElementById('export-excel')?.addEventListener('click', exportReportExcel);
});
