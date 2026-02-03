/* ============================================================
   Splitly App
   ============================================================ */

import { escapeHtml, downloadJson, storage, generateId, formatRelativeDate, formatCurrency } from '../shared/js/utils.js';
import { openModal, closeModal, initModals } from '../shared/js/modal.js';

// =====================
// DATA
// =====================
const STORAGE_KEY_ENTRIES = 'splitly_entries';
const STORAGE_KEY_PEOPLE = 'splitly_people';

let entries = [];
let people = [];
let selectedPerson = null;
let currentPeriod = 'all';
let deleteTargetId = null;

function loadData() {
    entries = storage.get(STORAGE_KEY_ENTRIES, []);
    people = storage.get(STORAGE_KEY_PEOPLE, []);
}

function saveEntries() {
    storage.set(STORAGE_KEY_ENTRIES, entries);
}

function savePeople() {
    storage.set(STORAGE_KEY_PEOPLE, people);
}

// =====================
// DATE HELPERS
// =====================
function now() {
    return new Date();
}

function startOfDay(d) {
    const c = new Date(d);
    c.setHours(0, 0, 0, 0);
    return c;
}

function startOfWeek(d) {
    const c = new Date(d);
    const day = c.getDay();
    const diff = day === 0 ? 6 : day - 1; // Monday start
    c.setDate(c.getDate() - diff);
    c.setHours(0, 0, 0, 0);
    return c;
}

function startOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfYear(d) {
    return new Date(d.getFullYear(), 0, 1);
}

function filterByPeriod(list, period) {
    if (period === 'all') return list;

    const n = now();
    let cutoff;
    switch (period) {
        case 'today': cutoff = startOfDay(n); break;
        case 'week': cutoff = startOfWeek(n); break;
        case 'month': cutoff = startOfMonth(n); break;
        case 'ytd': cutoff = startOfYear(n); break;
        default: return list;
    }

    return list.filter(e => new Date(e.datetime) >= cutoff);
}

// =====================
// PEOPLE
// =====================
function addPerson() {
    const input = document.getElementById('new-person-name');
    const name = input.value.trim();
    if (!name) return;
    if (people.includes(name)) {
        input.value = '';
        return;
    }

    people.push(name);
    savePeople();
    input.value = '';
    renderPeopleTags();
    renderPersonQuickBtns();
    renderSummary();
}

function removePerson(name) {
    people = people.filter(p => p !== name);
    if (selectedPerson === name) selectedPerson = null;
    savePeople();
    renderPeopleTags();
    renderPersonQuickBtns();
    renderSummary();
}

function selectPerson(name) {
    selectedPerson = selectedPerson === name ? null : name;
    renderPersonQuickBtns();
}

function renderPeopleTags() {
    const container = document.getElementById('people-tags');
    if (people.length === 0) {
        container.innerHTML = '<span style="color: var(--text-muted); font-size: 0.82rem;">No people added yet.</span>';
        return;
    }
    container.innerHTML = people.map(p => `
        <span class="people-tag">
            ${escapeHtml(p)}
            <button class="remove-person" onclick="window.Splitly.removePerson('${escapeHtml(p)}')">&times;</button>
        </span>
    `).join('');
}

function renderPersonQuickBtns() {
    const container = document.getElementById('person-quick-btns');
    if (people.length === 0) {
        container.innerHTML = '<span style="color: var(--text-muted); font-size: 0.82rem;">Add people via "Manage People" to quick-select here</span>';
        return;
    }
    container.innerHTML = people.map(p => `
        <button class="btn btn-pill ${selectedPerson === p ? 'active' : ''}"
                onclick="window.Splitly.selectPerson('${escapeHtml(p)}')">${escapeHtml(p)}</button>
    `).join('');
}

// =====================
// ENTRIES
// =====================
function addEntry() {
    if (!selectedPerson) {
        alert('Please select who paid.');
        return;
    }

    const amountInput = document.getElementById('entry-amount');
    const amount = parseFloat(amountInput.value);
    if (!amount || amount <= 0) {
        alert('Please enter a valid amount.');
        return;
    }

    const note = document.getElementById('entry-note').value.trim();
    const dateVal = document.getElementById('entry-date').value;
    const timeVal = document.getElementById('entry-time').value;

    let datetime;
    if (dateVal && timeVal) {
        datetime = new Date(`${dateVal}T${timeVal}`).toISOString();
    } else if (dateVal) {
        const n = now();
        datetime = new Date(`${dateVal}T${n.getHours().toString().padStart(2, '0')}:${n.getMinutes().toString().padStart(2, '0')}`).toISOString();
    } else {
        datetime = now().toISOString();
    }

    const entry = {
        id: generateId('e'),
        person: selectedPerson,
        amount: amount,
        note: note,
        datetime: datetime
    };

    entries.unshift(entry);
    saveEntries();

    // Reset form
    amountInput.value = '';
    document.getElementById('entry-note').value = '';
    prefillDateTime();

    renderAll();
    amountInput.focus();
}

function deleteEntry(id) {
    deleteTargetId = id;
    openModal('delete-modal');
}

function confirmDelete() {
    if (!deleteTargetId) return;
    entries = entries.filter(e => e.id !== deleteTargetId);
    saveEntries();
    deleteTargetId = null;
    closeModal('delete-modal');
    renderAll();
}

function closeDeleteModal() {
    closeModal('delete-modal');
    deleteTargetId = null;
}

// =====================
// RENDERING
// =====================
function getFilteredEntries() {
    let filtered = filterByPeriod(entries, currentPeriod);

    const search = document.getElementById('search-input').value.toLowerCase().trim();
    if (search) {
        filtered = filtered.filter(e =>
            e.person.toLowerCase().includes(search) ||
            (e.note && e.note.toLowerCase().includes(search))
        );
    }

    // Sort newest first
    filtered.sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
    return filtered;
}

function renderSummary() {
    const container = document.getElementById('summary-grid');
    const filtered = filterByPeriod(entries, currentPeriod);

    // Compute totals per person
    const totals = {};
    people.forEach(p => {
        totals[p] = { amount: 0, count: 0 };
    });

    filtered.forEach(e => {
        if (!totals[e.person]) totals[e.person] = { amount: 0, count: 0 };
        totals[e.person].amount += e.amount;
        totals[e.person].count++;
    });

    const personNames = Object.keys(totals);
    if (personNames.length === 0) {
        container.innerHTML = '';
        return;
    }

    const amounts = personNames.map(p => totals[p].amount);
    const maxAmount = Math.max(...amounts);
    const minAmount = Math.min(...amounts);
    const totalDiff = maxAmount - minAmount;

    container.innerHTML = personNames.map(name => {
        const t = totals[name];
        const isAhead = t.amount === maxAmount && totalDiff > 0.01;
        const isBehind = t.amount === minAmount && totalDiff > 0.01;
        let badgeClass = 'even';
        let badgeText = 'Even';

        if (totalDiff > 0.01) {
            if (isAhead) {
                badgeClass = 'ahead';
                badgeText = `Owed ${formatCurrency(totalDiff)}`;
            } else if (isBehind) {
                badgeClass = 'behind';
                badgeText = `Owes ${formatCurrency(totalDiff)}`;
            }
        }

        const cardClass = isAhead ? 'is-ahead' : '';

        return `
            <div class="person-summary ${cardClass}">
                <div class="name">${escapeHtml(name)}</div>
                <div class="amount">${formatCurrency(t.amount)}</div>
                <div class="entry-count">${t.count} entr${t.count === 1 ? 'y' : 'ies'}</div>
                <span class="balance-badge ${badgeClass}">${badgeText}</span>
            </div>
        `;
    }).join('');
}

function renderEntries() {
    const filtered = getFilteredEntries();
    const container = document.getElementById('entries-list');
    const countLabel = document.getElementById('entry-count-label');

    const total = filtered.reduce((s, e) => s + e.amount, 0);
    countLabel.textContent = `${filtered.length} entr${filtered.length === 1 ? 'y' : 'ies'} \u2022 ${formatCurrency(total)}`;

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>No entries yet</h3>
                <p>Add your first grocery payment above.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(e => `
        <div class="entry-card">
            <div class="entry-left">
                <div class="entry-who">${escapeHtml(e.person)}</div>
                ${e.note ? `<div class="entry-note">${escapeHtml(e.note)}</div>` : ''}
                <div class="entry-date">${formatRelativeDate(e.datetime)}</div>
            </div>
            <div class="entry-right">
                <span class="entry-amount">${formatCurrency(e.amount)}</span>
                <button class="entry-delete" onclick="event.stopPropagation(); window.Splitly.deleteEntry('${e.id}')" title="Delete">&times;</button>
            </div>
        </div>
    `).join('');
}

function renderAll() {
    renderSummary();
    renderEntries();
}

// =====================
// PERIOD FILTER
// =====================
function setPeriod(period) {
    currentPeriod = period;
    document.querySelectorAll('[data-period]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.period === period);
    });
    renderAll();
}

// =====================
// MODALS
// =====================
function openManagePeople() {
    renderPeopleTags();
    openModal('people-modal');
    document.getElementById('new-person-name').focus();
}

function closePeopleModal() {
    closeModal('people-modal');
}

function openDataModal() {
    openModal('data-modal');
}

function closeDataModal() {
    closeModal('data-modal');
}

// =====================
// DATA MANAGEMENT
// =====================
function exportData() {
    downloadJson(`splitly_backup_${new Date().toISOString().slice(0, 10)}.json`, { entries, people });
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data.entries && Array.isArray(data.entries)) {
                if (confirm(`Import ${data.entries.length} entries and ${(data.people || []).length} people? This will replace your current data.`)) {
                    entries = data.entries;
                    people = data.people || [];
                    saveEntries();
                    savePeople();
                    selectedPerson = null;
                    renderAll();
                    renderPersonQuickBtns();
                    alert('Import successful!');
                }
            } else {
                alert('Invalid backup file.');
            }
        } catch (err) {
            alert('Error reading file.');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function clearAllData() {
    if (confirm('Delete ALL entries and people? This cannot be undone.')) {
        entries = [];
        people = [];
        selectedPerson = null;
        saveEntries();
        savePeople();
        renderAll();
        renderPersonQuickBtns();
        closeDataModal();
    }
}

// =====================
// UTILITIES
// =====================
function prefillDateTime() {
    const n = now();
    document.getElementById('entry-date').value = n.toISOString().slice(0, 10);
    document.getElementById('entry-time').value = n.toTimeString().slice(0, 5);
}

// =====================
// INIT
// =====================
function init() {
    loadData();
    prefillDateTime();
    renderPersonQuickBtns();
    renderAll();
    initModals();
}

// Export public API
window.Splitly = {
    addPerson,
    removePerson,
    selectPerson,
    addEntry,
    deleteEntry,
    confirmDelete,
    closeDeleteModal,
    setPeriod,
    openManagePeople,
    closePeopleModal,
    openDataModal,
    closeDataModal,
    exportData,
    importData,
    clearAllData,
    renderEntries
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);

// Register service worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('../sw.js')
        .then(reg => console.log('SW registered'))
        .catch(err => console.log('SW registration failed:', err));
}
