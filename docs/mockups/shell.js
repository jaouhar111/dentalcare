/* DentalCare mockups — shared shell (sidebar + topbar) */

const NAV = [
  {
    section: 'Pilotage',
    items: [
      { id: 'dashboard', label: 'Tableau de bord', href: 'dashboard.html', icon: 'M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3' },
    ],
  },
  {
    section: 'Patientèle',
    items: [
      { id: 'patients', label: 'Patients', href: 'patients.html', icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z', badge: '342', badgeColor: 'slate' },
      { id: 'appointments', label: 'Rendez-vous', href: 'appointments.html', icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25', badge: '16', badgeColor: 'amber' },
      { id: 'waitlist', label: "Liste d'attente", href: '#', icon: 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292' },
      { id: 'records', label: 'Dossiers médicaux', href: 'patient-detail.html', icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12L12 18m0 0l-3-2.625M12 18V9' },
      { id: 'odontogram', label: 'Odontogramme', href: 'odontogram.html', icon: 'tooth' },
    ],
  },
  {
    section: 'Finance',
    items: [
      { id: 'invoices', label: 'Factures', href: 'invoice.html', icon: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664', badge: '2', badgeColor: 'rose' },
      { id: 'plans', label: 'Plans paiement', href: '#', icon: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z' },
    ],
  },
  {
    section: 'Cabinet',
    items: [
      { id: 'stock', label: 'Stock', href: '#', icon: 'M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z', badge: '3', badgeColor: 'amber' },
      { id: 'recalls', label: 'Recalls', href: '#', icon: 'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0' },
      { id: 'users', label: 'Utilisateurs', href: '#', icon: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z' },
      { id: 'settings', label: 'Paramètres', href: '#', icon: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
    ],
  },
];

const TOOTH_SVG = '<svg viewBox="0 0 64 64" class="w-4 h-4" fill="currentColor"><path d="M32 5C22 5 14 10 12 21C10 32 13 42 17 51L19 56C20 58 23 58 24 56L26 49C27 46 29 44 32 44C35 44 37 46 38 49L40 56C41 58 44 58 45 56L47 51C51 42 54 32 52 21C50 10 42 5 32 5Z"/></svg>';

const BADGE_COLORS = {
  slate: 'text-slate-400',
  amber: 'bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full',
  rose: 'bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded-full',
};

function renderSidebar(active) {
  const groups = NAV.map(g => `
    <div class="text-[10px] uppercase tracking-wider text-slate-400 px-3 mt-4 mb-1 font-semibold">${g.section}</div>
    ${g.items.map(it => {
      const isActive = it.id === active;
      const iconHtml = it.icon === 'tooth' ? TOOTH_SVG : `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="${it.icon}"/></svg>`;
      const badge = it.badge ? `<span class="text-xs num ${BADGE_COLORS[it.badgeColor]}">${it.badge}</span>` : '';
      const cls = isActive ? 'bg-brand-50 text-brand-700 font-medium' : 'text-slate-700 hover:bg-slate-100';
      return `<a href="${it.href}" class="flex items-center justify-between gap-3 px-3 py-2 rounded-lg ${cls}"><span class="flex items-center gap-3">${iconHtml}${it.label}</span>${badge}</a>`;
    }).join('')}
  `).join('');

  return `
    <aside class="hidden md:flex w-60 shrink-0 flex-col bg-white border-r border-slate-200">
      <a href="index.html" class="h-14 px-4 flex items-center gap-2 border-b border-slate-200 hover:bg-slate-50">
        <svg viewBox="0 0 64 64" class="w-7 h-7 text-brand-600" fill="currentColor"><path d="M32 5C22 5 14 10 12 21C10 32 13 42 17 51L19 56C20 58 23 58 24 56L26 49C27 46 29 44 32 44C35 44 37 46 38 49L40 56C41 58 44 58 45 56L47 51C51 42 54 32 52 21C50 10 42 5 32 5Z"/></svg>
        <span class="font-bold tracking-tight">Dental<span class="text-brand-600">Care</span></span>
      </a>
      <nav class="flex-1 overflow-y-auto p-3 text-sm">${groups}</nav>
      <div class="p-3 border-t border-slate-200">
        <div class="flex items-center gap-3 px-2 py-2">
          <div class="w-8 h-8 rounded-full bg-brand-100 text-brand-700 grid place-items-center text-sm font-semibold">KB</div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium truncate">Dr Karim Benali</div>
            <div class="text-xs text-slate-500">Dentiste · Admin</div>
          </div>
        </div>
      </div>
    </aside>
  `;
}

function renderTopbar() {
  return `
    <header class="h-14 bg-white border-b border-slate-200 flex items-center gap-3 px-4 lg:px-6 shrink-0">
      <button class="md:hidden p-1.5 rounded hover:bg-slate-100" aria-label="Menu"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"/></svg></button>
      <div class="flex-1 max-w-xl relative">
        <svg class="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/></svg>
        <input type="text" placeholder="Rechercher patient, RDV, facture..." class="w-full pl-9 pr-16 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500" />
        <kbd class="absolute right-2 top-2 text-[10px] px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-500 font-mono">⌘K</kbd>
      </div>
      <button class="relative p-1.5 rounded hover:bg-slate-100" aria-label="Notifications">
        <svg class="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/></svg>
        <span class="absolute top-0.5 right-1 w-2 h-2 rounded-full bg-rose-500"></span>
      </button>
      <div class="flex items-center gap-1 text-xs">
        <button class="px-2 py-1 rounded text-brand-700 font-semibold bg-brand-50">FR</button>
        <button class="px-2 py-1 rounded text-slate-400 hover:bg-slate-100">EN</button>
        <button class="px-2 py-1 rounded text-slate-400 hover:bg-slate-100">ع</button>
      </div>
      <div class="w-8 h-8 rounded-full bg-brand-100 text-brand-700 grid place-items-center text-sm font-semibold">KB</div>
    </header>
  `;
}

window.initShell = function ({ active }) {
  document.body.classList.add('bg-slate-50', 'text-slate-900');
  const root = document.getElementById('app');
  const main = root.innerHTML;
  root.outerHTML = `
    <div class="flex h-screen overflow-hidden">
      ${renderSidebar(active)}
      <div class="flex-1 flex flex-col overflow-hidden">
        ${renderTopbar()}
        <main class="flex-1 overflow-y-auto">${main}</main>
      </div>
    </div>
  `;
};
