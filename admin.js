// ============================================================
// Nebro Company Admin — wired to Supabase (see supabase-config.js for
// project URL/anon key, and supabase/migrations/0001_init.sql
// for the schema these queries assume).
// ============================================================

let currentUser = null;   // { id, email }
let currentProfile = null; // { full_name, role }
let products = [];
let inquiries = [];
let users = [];
let teamMembers = [];
let caseStudies = [];
let industries = [];
let activeProductFilter = 'all';
let pendingImageFile = null;
let pendingTeamPhotoFile = null;
let pendingCaseStudyPhotoFile = null;
let pendingIndustryPhotoFile = null;

const categoryLabels = { diagnostic: 'Diagnostic', laboratory: 'Laboratory', surgical: 'Surgical & ICU' };
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

async function fetchTeamMembers() {
  const { data, error } = await supabaseClient.from('team_members').select('*').order('display_order', { ascending: true });
  if (error) { console.error(error); return []; }
  return data;
}

async function fetchCaseStudies() {
  const { data, error } = await supabaseClient.from('case_studies').select('*').order('created_at', { ascending: false });
  if (error) { console.error(error); return []; }
  return data;
}

async function fetchIndustries() {
  const { data, error } = await supabaseClient.from('industries').select('*').order('display_order', { ascending: true });
  if (error) { console.error(error); return []; }
  return data;
}

async function refreshAll() {
  [products, inquiries, users, teamMembers, caseStudies, industries] = await Promise.all([
    fetchProducts(), fetchInquiries(), fetchProfiles(), fetchTeamMembers(), fetchCaseStudies(), fetchIndustries(),
  ]);
  renderProductsTable();
  renderCategoryBreakdown();
  renderInquiriesTable();
  renderRolesTable();
  renderTeamTable();
  renderCaseStudiesTable();
  renderIndustriesTable();
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
  const counts = { diagnostic: 0, laboratory: 0, surgical: 0 };
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

function renderTeamTable() {
  const body = document.getElementById('team-table-body');
  if (!body) return;
  body.innerHTML = teamMembers.map(m => `
    <tr data-id="${m.id}">
      <td>${m.photo_url ? `<img src="${m.photo_url}" class="admin-thumb" alt="" />` : `<span class="admin-thumb"></span>`}</td>
      <td class="font-medium" style="color:var(--navy)">${escapeHtml(m.name)}</td>
      <td style="color:var(--grey)">${escapeHtml(m.title)}</td>
      <td style="color:var(--grey)">${m.display_order}</td>
      <td class="text-right">
        <button class="font-mono text-xs underline mr-3" style="color:var(--navy)" data-edit-team="${m.id}">Edit</button>
        <button class="font-mono text-xs underline" style="color:#B91C1C" data-delete-team="${m.id}">Delete</button>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="5" class="text-center text-sm py-8" style="color:var(--grey)">No team members yet.</td></tr>`;
}

function renderCaseStudiesTable() {
  const body = document.getElementById('case-studies-table-body');
  if (!body) return;
  body.innerHTML = caseStudies.map(c => `
    <tr data-id="${c.id}">
      <td>${c.photo_url ? `<img src="${c.photo_url}" class="admin-thumb" alt="" />` : `<span class="admin-thumb"></span>`}</td>
      <td class="font-medium" style="color:var(--navy)">${escapeHtml(c.title)}</td>
      <td style="color:var(--grey)">${escapeHtml(c.facility)}</td>
      <td>
        <button data-toggle-case-study="${c.id}" class="inline-flex items-center gap-1.5">
          <span class="status-dot" style="background:${c.published ? 'var(--lime-deep)' : '#D1D5DB'}"></span>
          <span class="text-xs" style="color:var(--grey)">${c.published ? 'Published' : 'Draft'}</span>
        </button>
      </td>
      <td class="text-right">
        <button class="font-mono text-xs underline mr-3" style="color:var(--navy)" data-edit-case-study="${c.id}">Edit</button>
        <button class="font-mono text-xs underline" style="color:#B91C1C" data-delete-case-study="${c.id}">Delete</button>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="5" class="text-center text-sm py-8" style="color:var(--grey)">No case studies yet.</td></tr>`;
}

function renderIndustriesTable() {
  const body = document.getElementById('industries-table-body');
  if (!body) return;
  body.innerHTML = industries.map(i => `
    <tr data-id="${i.id}">
      <td>${i.photo_url ? `<img src="${i.photo_url}" class="admin-thumb" alt="" />` : `<span class="admin-thumb"></span>`}</td>
      <td class="font-medium" style="color:var(--navy)">${escapeHtml(i.title)}</td>
      <td>
        <button data-toggle-industry="${i.id}" class="inline-flex items-center gap-1.5">
          <span class="status-dot" style="background:${i.published ? 'var(--lime-deep)' : '#D1D5DB'}"></span>
          <span class="text-xs" style="color:var(--grey)">${i.published ? 'Published' : 'Draft'}</span>
        </button>
      </td>
      <td style="color:var(--grey)">${i.display_order}</td>
      <td class="text-right">
        <button class="font-mono text-xs underline mr-3" style="color:var(--navy)" data-edit-industry="${i.id}">Edit</button>
        <button class="font-mono text-xs underline" style="color:#B91C1C" data-delete-industry="${i.id}">Delete</button>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="5" class="text-center text-sm py-8" style="color:var(--grey)">No industries yet.</td></tr>`;
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
    const catCounts = { diagnostic: 0, laboratory: 0, surgical: 0 };
    products.forEach(p => { catCounts[p.category] = (catCounts[p.category] || 0) + 1; });
    chartPie?.destroy();
    chartPie = new Chart(pieCtx, {
      type: 'pie',
      data: { labels: ['Diagnostic', 'Laboratory', 'Surgical & ICU'], datasets: [{ data: [catCounts.diagnostic, catCounts.laboratory, catCounts.surgical], backgroundColor: [lime, navy, mint] }] },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } },
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
  doc.text('Nebro Company — Reports Summary', 14, 18);
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
  if (view === 'settings') {
    loadNotificationPreferences();
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

async function loadNotificationPreferences() {
  const { data } = await supabaseClient
    .from('notification_preferences')
    .select('*')
    .eq('user_id', currentUser.id)
    .maybeSingle();
  if (data) {
    document.getElementById('notif-email-enabled').checked = data.email_enabled;
    document.getElementById('notif-frequency').value = data.new_inquiry_frequency;
    document.getElementById('notif-stale-days').value = data.stale_reminder_days;
  }
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

  // Notification Preferences (per signed-in user)
  document.getElementById('notification-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const statusEl = document.getElementById('notif-status');
    const value = {
      user_id: currentUser.id,
      email_enabled: document.getElementById('notif-email-enabled').checked,
      new_inquiry_frequency: document.getElementById('notif-frequency').value,
      stale_reminder_days: parseInt(document.getElementById('notif-stale-days').value, 10) || 1,
    };
    const { error } = await supabaseClient.from('notification_preferences').upsert(value);
    statusEl.textContent = error ? 'Could not save: ' + error.message : 'Saved ✓';
    setTimeout(() => (statusEl.textContent = ''), 3000);
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

  // Team member modal (add/edit) + photo upload
  const teamModal = document.getElementById('team-member-modal');
  const teamForm = document.getElementById('team-member-form');
  const teamPreview = document.getElementById('team-upload-preview');
  const teamIcon = document.getElementById('team-upload-icon');
  const teamLabel = document.getElementById('team-upload-label');
  const teamRemoveBtn = document.getElementById('team-remove-photo');
  let teamExistingPhotoUrl = null;

  function resetTeamModal() {
    teamForm.reset();
    document.getElementById('team-member-id').value = '';
    document.getElementById('team-modal-title').textContent = 'Add Team Member';
    document.getElementById('team-member-submit').textContent = 'Add Team Member';
    pendingTeamPhotoFile = null;
    teamExistingPhotoUrl = null;
    teamPreview.classList.add('hidden');
    teamIcon.classList.remove('hidden');
    teamLabel.textContent = 'Click to upload a photo';
    teamRemoveBtn.classList.add('hidden');
  }

  document.getElementById('open-add-team-member')?.addEventListener('click', () => {
    resetTeamModal();
    teamModal.classList.add('is-open');
  });
  teamModal?.querySelectorAll('[data-close-modal]').forEach(el => el.addEventListener('click', () => teamModal.classList.remove('is-open')));
  teamModal?.addEventListener('click', (e) => { if (e.target === teamModal) teamModal.classList.remove('is-open'); });

  document.getElementById('team-member-photo')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    pendingTeamPhotoFile = file;
    const reader = new FileReader();
    reader.onload = () => {
      teamPreview.src = reader.result;
      teamPreview.classList.remove('hidden');
      teamIcon.classList.add('hidden');
      teamLabel.textContent = file.name;
      teamRemoveBtn.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  });

  teamRemoveBtn?.addEventListener('click', () => {
    pendingTeamPhotoFile = null;
    teamExistingPhotoUrl = null;
    teamPreview.classList.add('hidden');
    teamIcon.classList.remove('hidden');
    teamLabel.textContent = 'Click to upload a photo';
    teamRemoveBtn.classList.add('hidden');
    document.getElementById('team-member-photo').value = '';
  });

  document.getElementById('team-table-body')?.addEventListener('click', (e) => {
    const editId = e.target.closest('[data-edit-team]')?.dataset.editTeam;
    const deleteId = e.target.closest('[data-delete-team]')?.dataset.deleteTeam;

    if (editId) {
      const m = teamMembers.find(m => m.id == editId);
      if (!m) return;
      resetTeamModal();
      document.getElementById('team-member-id').value = m.id;
      document.getElementById('team-member-name').value = m.name;
      document.getElementById('team-member-title').value = m.title;
      document.getElementById('team-member-order').value = m.display_order;
      document.getElementById('team-modal-title').textContent = 'Edit Team Member';
      document.getElementById('team-member-submit').textContent = 'Save Changes';
      if (m.photo_url) {
        teamExistingPhotoUrl = m.photo_url;
        teamPreview.src = m.photo_url;
        teamPreview.classList.remove('hidden');
        teamIcon.classList.add('hidden');
        teamLabel.textContent = 'Click to replace photo';
        teamRemoveBtn.classList.remove('hidden');
      }
      teamModal.classList.add('is-open');
    }

    if (deleteId) {
      if (!confirm('Remove this team member from the About page?')) return;
      supabaseClient.from('team_members').delete().eq('id', deleteId).then(({ error }) => {
        if (!error) { teamMembers = teamMembers.filter(m => m.id != deleteId); renderTeamTable(); }
        else alert('Could not delete: ' + error.message);
      });
    }
  });

  teamForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('team-member-id').value;
    const name = document.getElementById('team-member-name').value.trim();
    const title = document.getElementById('team-member-title').value.trim();
    const display_order = parseInt(document.getElementById('team-member-order').value, 10) || 0;
    if (!name || !title) return;

    let photo_url = teamExistingPhotoUrl;
    if (pendingTeamPhotoFile) {
      const ext = pendingTeamPhotoFile.name.split('.').pop();
      const path = `team-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabaseClient.storage.from('site-images').upload(path, pendingTeamPhotoFile, { upsert: true });
      if (!uploadError) {
        photo_url = supabaseClient.storage.from('site-images').getPublicUrl(path).data.publicUrl;
      } else {
        alert('Photo upload failed: ' + uploadError.message);
      }
    } else if (pendingTeamPhotoFile === null && teamExistingPhotoUrl === null && id) {
      photo_url = null; // photo was explicitly removed on an existing member
    }

    if (id) {
      const { error } = await supabaseClient.from('team_members').update({ name, title, display_order, photo_url }).eq('id', id);
      if (error) { alert('Could not save: ' + error.message); return; }
      const m = teamMembers.find(m => m.id == id);
      if (m) Object.assign(m, { name, title, display_order, photo_url });
    } else {
      const { data, error } = await supabaseClient.from('team_members')
        .insert({ name, title, display_order, photo_url, created_by: currentUser.id })
        .select().single();
      if (error) { alert('Could not add: ' + error.message); return; }
      teamMembers.push(data);
    }

    teamMembers.sort((a, b) => a.display_order - b.display_order);
    renderTeamTable();
    teamModal.classList.remove('is-open');
  });

  // Case Study modal (add/edit) + photo upload
  const csModal = document.getElementById('case-study-modal');
  const csForm = document.getElementById('case-study-form');
  const csPreview = document.getElementById('case-study-upload-preview');
  const csIcon = document.getElementById('case-study-upload-icon');
  const csLabel = document.getElementById('case-study-upload-label');
  const csRemoveBtn = document.getElementById('case-study-remove-photo');
  let csExistingPhotoUrl = null;

  function resetCaseStudyModal() {
    csForm.reset();
    document.getElementById('case-study-id').value = '';
    document.getElementById('case-study-modal-title').textContent = 'Add Case Study';
    document.getElementById('case-study-submit').textContent = 'Add Case Study';
    pendingCaseStudyPhotoFile = null;
    csExistingPhotoUrl = null;
    csPreview.classList.add('hidden');
    csIcon.classList.remove('hidden');
    csLabel.textContent = 'Click to upload a photo';
    csRemoveBtn.classList.add('hidden');
  }

  document.getElementById('open-add-case-study')?.addEventListener('click', () => {
    resetCaseStudyModal();
    csModal.classList.add('is-open');
  });
  csModal?.querySelectorAll('[data-close-modal]').forEach(el => el.addEventListener('click', () => csModal.classList.remove('is-open')));
  csModal?.addEventListener('click', (e) => { if (e.target === csModal) csModal.classList.remove('is-open'); });

  document.getElementById('case-study-photo')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    pendingCaseStudyPhotoFile = file;
    const reader = new FileReader();
    reader.onload = () => {
      csPreview.src = reader.result;
      csPreview.classList.remove('hidden');
      csIcon.classList.add('hidden');
      csLabel.textContent = file.name;
      csRemoveBtn.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  });

  csRemoveBtn?.addEventListener('click', () => {
    pendingCaseStudyPhotoFile = null;
    csExistingPhotoUrl = null;
    csPreview.classList.add('hidden');
    csIcon.classList.remove('hidden');
    csLabel.textContent = 'Click to upload a photo';
    csRemoveBtn.classList.add('hidden');
    document.getElementById('case-study-photo').value = '';
  });

  document.getElementById('case-studies-table-body')?.addEventListener('click', async (e) => {
    const editId = e.target.closest('[data-edit-case-study]')?.dataset.editCaseStudy;
    const deleteId = e.target.closest('[data-delete-case-study]')?.dataset.deleteCaseStudy;
    const toggleId = e.target.closest('[data-toggle-case-study]')?.dataset.toggleCaseStudy;

    if (editId) {
      const c = caseStudies.find(c => c.id == editId);
      if (!c) return;
      resetCaseStudyModal();
      document.getElementById('case-study-id').value = c.id;
      document.getElementById('case-study-title').value = c.title;
      document.getElementById('case-study-facility').value = c.facility;
      document.getElementById('case-study-summary').value = c.summary || '';
      document.getElementById('case-study-published').checked = c.published;
      document.getElementById('case-study-modal-title').textContent = 'Edit Case Study';
      document.getElementById('case-study-submit').textContent = 'Save Changes';
      if (c.photo_url) {
        csExistingPhotoUrl = c.photo_url;
        csPreview.src = c.photo_url;
        csPreview.classList.remove('hidden');
        csIcon.classList.add('hidden');
        csLabel.textContent = 'Click to replace photo';
        csRemoveBtn.classList.remove('hidden');
      }
      csModal.classList.add('is-open');
    }

    if (deleteId) {
      if (!confirm('Delete this case study?')) return;
      const { error } = await supabaseClient.from('case_studies').delete().eq('id', deleteId);
      if (!error) { caseStudies = caseStudies.filter(c => c.id != deleteId); renderCaseStudiesTable(); }
      else alert('Could not delete: ' + error.message);
    }

    if (toggleId) {
      const c = caseStudies.find(c => c.id == toggleId);
      const { error } = await supabaseClient.from('case_studies').update({ published: !c.published }).eq('id', toggleId);
      if (!error) { c.published = !c.published; renderCaseStudiesTable(); }
    }
  });

  csForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('case-study-id').value;
    const title = document.getElementById('case-study-title').value.trim();
    const facility = document.getElementById('case-study-facility').value.trim();
    const summary = document.getElementById('case-study-summary').value.trim();
    const published = document.getElementById('case-study-published').checked;
    if (!title || !facility) return;

    let photo_url = csExistingPhotoUrl;
    if (pendingCaseStudyPhotoFile) {
      const ext = pendingCaseStudyPhotoFile.name.split('.').pop();
      const path = `case-study-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabaseClient.storage.from('site-images').upload(path, pendingCaseStudyPhotoFile, { upsert: true });
      if (!uploadError) photo_url = supabaseClient.storage.from('site-images').getPublicUrl(path).data.publicUrl;
      else alert('Photo upload failed: ' + uploadError.message);
    }

    if (id) {
      const { error } = await supabaseClient.from('case_studies').update({ title, facility, summary, published, photo_url }).eq('id', id);
      if (error) { alert('Could not save: ' + error.message); return; }
      const c = caseStudies.find(c => c.id == id);
      if (c) Object.assign(c, { title, facility, summary, published, photo_url });
    } else {
      const { data, error } = await supabaseClient.from('case_studies')
        .insert({ title, facility, summary, published, photo_url, created_by: currentUser.id })
        .select().single();
      if (error) { alert('Could not add: ' + error.message); return; }
      caseStudies.unshift(data);
    }
    renderCaseStudiesTable();
    csModal.classList.remove('is-open');
  });

  // Industry modal (add/edit) + photo upload
  const indModal = document.getElementById('industry-modal');
  const indForm = document.getElementById('industry-form');
  const indPreview = document.getElementById('industry-upload-preview');
  const indIcon = document.getElementById('industry-upload-icon');
  const indLabel = document.getElementById('industry-upload-label');
  const indRemoveBtn = document.getElementById('industry-remove-photo');
  let indExistingPhotoUrl = null;

  function resetIndustryModal() {
    indForm.reset();
    document.getElementById('industry-id').value = '';
    document.getElementById('industry-published').checked = true;
    document.getElementById('industry-modal-title').textContent = 'Add Industry';
    document.getElementById('industry-submit').textContent = 'Add Industry';
    pendingIndustryPhotoFile = null;
    indExistingPhotoUrl = null;
    indPreview.classList.add('hidden');
    indIcon.classList.remove('hidden');
    indLabel.textContent = 'Click to upload a photo';
    indRemoveBtn.classList.add('hidden');
  }

  document.getElementById('open-add-industry')?.addEventListener('click', () => {
    resetIndustryModal();
    indModal.classList.add('is-open');
  });
  indModal?.querySelectorAll('[data-close-modal]').forEach(el => el.addEventListener('click', () => indModal.classList.remove('is-open')));
  indModal?.addEventListener('click', (e) => { if (e.target === indModal) indModal.classList.remove('is-open'); });

  document.getElementById('industry-photo')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    pendingIndustryPhotoFile = file;
    const reader = new FileReader();
    reader.onload = () => {
      indPreview.src = reader.result;
      indPreview.classList.remove('hidden');
      indIcon.classList.add('hidden');
      indLabel.textContent = file.name;
      indRemoveBtn.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  });

  indRemoveBtn?.addEventListener('click', () => {
    pendingIndustryPhotoFile = null;
    indExistingPhotoUrl = null;
    indPreview.classList.add('hidden');
    indIcon.classList.remove('hidden');
    indLabel.textContent = 'Click to upload a photo';
    indRemoveBtn.classList.add('hidden');
    document.getElementById('industry-photo').value = '';
  });

  document.getElementById('industries-table-body')?.addEventListener('click', async (e) => {
    const editId = e.target.closest('[data-edit-industry]')?.dataset.editIndustry;
    const deleteId = e.target.closest('[data-delete-industry]')?.dataset.deleteIndustry;
    const toggleId = e.target.closest('[data-toggle-industry]')?.dataset.toggleIndustry;

    if (editId) {
      const i = industries.find(i => i.id == editId);
      if (!i) return;
      resetIndustryModal();
      document.getElementById('industry-id').value = i.id;
      document.getElementById('industry-title').value = i.title;
      document.getElementById('industry-description').value = i.description || '';
      document.getElementById('industry-order').value = i.display_order;
      document.getElementById('industry-published').checked = i.published;
      document.getElementById('industry-modal-title').textContent = 'Edit Industry';
      document.getElementById('industry-submit').textContent = 'Save Changes';
      if (i.photo_url) {
        indExistingPhotoUrl = i.photo_url;
        indPreview.src = i.photo_url;
        indPreview.classList.remove('hidden');
        indIcon.classList.add('hidden');
        indLabel.textContent = 'Click to replace photo';
        indRemoveBtn.classList.remove('hidden');
      }
      indModal.classList.add('is-open');
    }

    if (deleteId) {
      if (!confirm('Delete this industry?')) return;
      const { error } = await supabaseClient.from('industries').delete().eq('id', deleteId);
      if (!error) { industries = industries.filter(i => i.id != deleteId); renderIndustriesTable(); }
      else alert('Could not delete: ' + error.message);
    }

    if (toggleId) {
      const i = industries.find(i => i.id == toggleId);
      const { error } = await supabaseClient.from('industries').update({ published: !i.published }).eq('id', toggleId);
      if (!error) { i.published = !i.published; renderIndustriesTable(); }
    }
  });

  indForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('industry-id').value;
    const title = document.getElementById('industry-title').value.trim();
    const description = document.getElementById('industry-description').value.trim();
    const display_order = parseInt(document.getElementById('industry-order').value, 10) || 0;
    const published = document.getElementById('industry-published').checked;
    if (!title) return;

    let photo_url = indExistingPhotoUrl;
    if (pendingIndustryPhotoFile) {
      const ext = pendingIndustryPhotoFile.name.split('.').pop();
      const path = `industry-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabaseClient.storage.from('site-images').upload(path, pendingIndustryPhotoFile, { upsert: true });
      if (!uploadError) photo_url = supabaseClient.storage.from('site-images').getPublicUrl(path).data.publicUrl;
      else alert('Photo upload failed: ' + uploadError.message);
    }

    if (id) {
      const { error } = await supabaseClient.from('industries').update({ title, description, display_order, published, photo_url }).eq('id', id);
      if (error) { alert('Could not save: ' + error.message); return; }
      const i = industries.find(i => i.id == id);
      if (i) Object.assign(i, { title, description, display_order, published, photo_url });
    } else {
      const { data, error } = await supabaseClient.from('industries')
        .insert({ title, description, display_order, published, photo_url, created_by: currentUser.id })
        .select().single();
      if (error) { alert('Could not add: ' + error.message); return; }
      industries.push(data);
    }
    industries.sort((a, b) => a.display_order - b.display_order);
    renderIndustriesTable();
    indModal.classList.remove('is-open');
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
