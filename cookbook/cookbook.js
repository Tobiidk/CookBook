/* ============================================================
   CookBook App
   ============================================================ */

import { escapeHtml, downloadText, downloadJson, storage, generateId } from '../shared/js/utils.js';
import { openModal, closeModal, initModals, switchTab } from '../shared/js/modal.js';

// =====================
// DATA & STATE
// =====================
const STORAGE_KEY = 'cookbook_recipes';
let recipes = [];
let currentRecipeId = null;
let currentServings = 1;
let baseServings = 1;
let deleteTargetId = null;
let editTargetId = null;
let cookingMode = false;
let checkedIngredients = new Set();
let checkedInstructions = new Set();
let wakeLock = null;
let favoritesFilterActive = false;
let filterBarOpen = false;

// Default recipe
const defaultRecipe = {
    id: 'default-buldak',
    title: 'The Ultimate Creamy Buldak Ramen',
    description: 'This recipe transforms the classic fiery Samyang Buldak Ramen into a rich, carbonara-style dish. By creating an emulsified sauce with Kewpie mayonnaise and an egg yolk, you can tame the intense heat while enhancing the flavor, resulting in a luxuriously silky and addictive meal.',
    tags: ['quick', 'dinner', 'korean', 'spicy', 'comfort-food'],
    prep_time: '5 minutes',
    cook_time: '5 minutes',
    total_time: '10 minutes',
    servings: 1,
    favorite: false,
    created: Date.now(),
    ingredients: [
        { group: null, items: [
            { qty: '1 packet', raw: { value: 1, unit: 'packet' }, name: 'Samyang Buldak Ramen (any flavor)' },
            { qty: '1 large', raw: { value: 1, unit: 'large' }, name: 'egg yolk' },
            { qty: '15g', raw: { value: 15, unit: 'g' }, name: 'Kewpie mayonnaise (about 1 tbsp)' },
            { qty: '5g', raw: { value: 5, unit: 'g' }, name: 'toasted sesame oil (about 1 tsp)' },
            { qty: '30-45g', raw: { value: 37.5, unit: 'g', isRange: true, original: '30-45g' }, name: 'boiling noodle water (about 2-3 tbsp)' }
        ]},
        { group: 'Optional Garnishes', items: [
            { qty: '-', raw: null, name: 'Toasted seaweed snacks (Nori)' },
            { qty: '-', raw: null, name: 'Furikake seasoning' },
            { qty: '-', raw: null, name: 'A soft-boiled or fried egg' },
            { qty: '-', raw: null, name: 'Sliced green onions' },
            { qty: '-', raw: null, name: 'Steamed vegetables (like bok choy or mushrooms)' }
        ]}
    ],
    instructions: [
        { title: 'Prepare the Sauce Base', text: 'In a medium, heat-proof serving bowl, combine the egg yolk, Kewpie mayonnaise, toasted sesame oil, and the entire contents of the Buldak liquid sauce and powder/flake packets. Whisk everything together until smooth and well combined.' },
        { title: 'Cook the Noodles', text: 'Bring a small pot of water to a rolling boil. Add the block of noodles and cook for 5 minutes, or until they reach your desired tenderness.' },
        { title: 'Temper the Sauce', text: 'Just before draining the noodles, carefully scoop out approximately 45g (3 tbsp) of the starchy, boiling noodle water. While whisking the sauce mixture constantly, slowly drizzle the hot water into the bowl. This is the most crucial step: adding the hot water slowly while stirring prevents the egg yolk from scrambling and creates a silky, creamy emulsion.' },
        { title: 'Combine and Serve', text: 'Immediately drain the cooked noodles thoroughly. Add the hot noodles directly into the bowl with the prepared sauce. Mix vigorously until the noodles are evenly coated in the creamy sauce.' },
        { title: 'Garnish and Enjoy', text: 'Top with your favorite garnishes like crumbled seaweed snacks, a sprinkle of furikake, or a perfectly cooked egg. Serve immediately and enjoy the incredible flavor.' }
    ]
};

// =====================
// STORAGE
// =====================
function loadRecipes() {
    const stored = storage.get(STORAGE_KEY);
    if (stored && stored.length > 0) {
        recipes = stored;
        recipes.forEach(r => {
            if (!r.tags) r.tags = [];
            if (r.favorite === undefined) r.favorite = false;
            if (!r.created) r.created = Date.now();
        });
        saveRecipes();
    } else {
        recipes = [defaultRecipe];
        saveRecipes();
    }
}

function saveRecipes() {
    if (!storage.set(STORAGE_KEY, recipes)) {
        alert('Error saving recipes. Storage may be full.');
    }
}

// =====================
// PARSING
// =====================
function parseRecipeFormat(text) {
    const recipe = {
        id: generateId('recipe'),
        title: '',
        description: '',
        tags: [],
        prep_time: '',
        cook_time: '',
        total_time: '',
        servings: 1,
        favorite: false,
        created: Date.now(),
        ingredients: [],
        instructions: []
    };

    const recipeMatch = text.match(/===RECIPE===([\s\S]*?)(?====|$)/);
    if (recipeMatch) {
        const recipeSection = recipeMatch[1];
        recipe.title = extractField(recipeSection, 'title') || 'Untitled Recipe';
        recipe.description = extractField(recipeSection, 'description') || '';
        const tagsStr = extractField(recipeSection, 'tags');
        recipe.tags = tagsStr ? tagsStr.split(',').map(t => t.trim().toLowerCase()).filter(t => t) : [];
        recipe.prep_time = extractField(recipeSection, 'prep_time') || '';
        recipe.cook_time = extractField(recipeSection, 'cook_time') || '';
        recipe.total_time = extractField(recipeSection, 'total_time') || '';
        const servingsStr = extractField(recipeSection, 'servings');
        recipe.servings = parseInt(servingsStr) || 1;
    }

    const ingredientMatches = text.matchAll(/===INGREDIENTS(?::([^=]*?))?===([\s\S]*?)(?====|$)/g);
    for (const match of ingredientMatches) {
        const groupName = match[1]?.trim() || null;
        const ingredientLines = match[2].trim().split('\n').filter(line => line.includes('|'));
        const items = ingredientLines.map(line => parseIngredientLine(line));
        recipe.ingredients.push({ group: groupName, items });
    }

    const instructionsMatch = text.match(/===INSTRUCTIONS===([\s\S]*?)(?====END===|$)/);
    if (instructionsMatch) {
        const instructionLines = instructionsMatch[1].trim().split('\n').filter(line => line.match(/^\d+\./));
        recipe.instructions = instructionLines.map(line => {
            const cleaned = line.replace(/^\d+\.\s*/, '');
            const colonIdx = cleaned.indexOf(':');
            if (colonIdx > 0 && colonIdx < 50) {
                return {
                    title: cleaned.substring(0, colonIdx).trim(),
                    text: cleaned.substring(colonIdx + 1).trim()
                };
            }
            return { title: '', text: cleaned };
        });
    }

    return recipe;
}

function extractField(text, field) {
    const regex = new RegExp(`^${field}:\\s*(.*)$`, 'mi');
    const match = text.match(regex);
    return match ? match[1].trim() : '';
}

function parseIngredientLine(line) {
    const parts = line.split('|').map(p => p.trim());
    const qtyStr = parts[0] || '-';
    const name = parts[1] || '';

    let raw = null;
    if (qtyStr !== '-') {
        raw = parseQuantity(qtyStr);
    }

    return { qty: qtyStr, raw, name };
}

function parseQuantity(qtyStr) {
    const rangeMatch = qtyStr.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*(\w*)$/);
    if (rangeMatch) {
        const avg = (parseFloat(rangeMatch[1]) + parseFloat(rangeMatch[2])) / 2;
        return { value: avg, unit: rangeMatch[3] || '', isRange: true, original: qtyStr };
    }

    const match = qtyStr.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
    if (match) {
        return { value: parseFloat(match[1]), unit: match[2].trim() };
    }

    return null;
}

function formatQuantity(raw, multiplier) {
    if (!raw) return '-';

    const scaled = raw.value * multiplier;
    const rounded = Math.round(scaled * 10) / 10;

    if (raw.isRange) {
        const originalParts = raw.original.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*(\w*)$/);
        if (originalParts) {
            const low = Math.round(parseFloat(originalParts[1]) * multiplier * 10) / 10;
            const high = Math.round(parseFloat(originalParts[2]) * multiplier * 10) / 10;
            return `${low}-${high}${originalParts[3]}`;
        }
    }

    const displayVal = rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(1);
    return raw.unit ? `${displayVal}${raw.unit.startsWith(' ') ? '' : raw.unit.match(/^[a-z]/i) ? '' : ''}${raw.unit}` : displayVal;
}

// =====================
// FILTER BAR TOGGLE
// =====================
function toggleFilterBar() {
    filterBarOpen = !filterBarOpen;
    const content = document.getElementById('filter-content');
    const btn = document.querySelector('.filter-toggle-btn');

    if (filterBarOpen) {
        content.classList.add('open');
        btn.classList.add('open');
    } else {
        content.classList.remove('open');
        btn.classList.remove('open');
    }
}

function updateFilterStatus() {
    const searchTerm = document.getElementById('search-input').value.trim();
    const tagFilter = document.getElementById('tag-filter').value;

    const parts = [];
    if (searchTerm) parts.push(`"${searchTerm}"`);
    if (tagFilter) parts.push(`#${tagFilter}`);
    if (favoritesFilterActive) parts.push('\u2665');

    const status = document.getElementById('filter-status');
    status.textContent = parts.length > 0 ? `Filtering: ${parts.join(', ')}` : '';
}

// =====================
// FILTERING & SORTING
// =====================
function getAllTags() {
    const tagSet = new Set();
    recipes.forEach(r => {
        if (r.tags && Array.isArray(r.tags)) {
            r.tags.forEach(t => {
                if (t && typeof t === 'string') {
                    tagSet.add(t.toLowerCase());
                }
            });
        }
    });
    return Array.from(tagSet).sort();
}

function updateTagFilter() {
    const select = document.getElementById('tag-filter');
    const currentValue = select.value;
    const tags = getAllTags();

    select.innerHTML = '<option value="">All Tags</option>' +
        tags.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');

    if (tags.includes(currentValue)) {
        select.value = currentValue;
    }
}

function getFilteredRecipes() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase().trim();
    const tagFilter = document.getElementById('tag-filter').value;
    const sortBy = document.getElementById('sort-select').value;

    let filtered = recipes.filter(recipe => {
        if (searchTerm) {
            const searchableText = [
                recipe.title,
                recipe.description,
                ...(recipe.tags || []),
                ...recipe.ingredients.flatMap(g => g.items.map(i => i.name)),
                ...recipe.instructions.map(i => i.title + ' ' + i.text)
            ].join(' ').toLowerCase();

            if (!searchableText.includes(searchTerm)) return false;
        }

        if (tagFilter && !(recipe.tags || []).includes(tagFilter)) return false;
        if (favoritesFilterActive && !recipe.favorite) return false;

        return true;
    });

    filtered.sort((a, b) => {
        switch (sortBy) {
            case 'name-asc': return a.title.localeCompare(b.title);
            case 'name-desc': return b.title.localeCompare(a.title);
            case 'date-desc': return (b.created || 0) - (a.created || 0);
            case 'date-asc': return (a.created || 0) - (b.created || 0);
            case 'time-asc': return parseTime(a.total_time) - parseTime(b.total_time);
            default: return 0;
        }
    });

    return filtered;
}

function parseTime(timeStr) {
    if (!timeStr) return Infinity;
    const match = timeStr.match(/(\d+)/);
    return match ? parseInt(match[1]) : Infinity;
}

function applyFilters() {
    renderRecipeList();
    updateFilterStatus();
}

function toggleNavFavorites() {
    favoritesFilterActive = !favoritesFilterActive;
    const btn = document.getElementById('nav-favorites-btn');

    if (favoritesFilterActive) {
        btn.classList.add('active');
        btn.textContent = '\u2665';
    } else {
        btn.classList.remove('active');
        btn.textContent = '\u2661';
    }

    applyFilters();
}

// =====================
// VIEWS
// =====================
function showView(view) {
    document.getElementById('list-view').classList.toggle('hidden', view !== 'list');
    document.getElementById('detail-view').classList.toggle('hidden', view !== 'detail');
    document.getElementById('filter-bar').classList.toggle('hidden', view !== 'list');

    if (view === 'list') {
        updateTagFilter();
        renderRecipeList();
        updateFilterStatus();
        if (cookingMode) {
            toggleCookingMode(false);
        }
    }
}

function renderRecipeList() {
    const grid = document.getElementById('recipe-grid');
    const empty = document.getElementById('empty-state');
    const filtered = getFilteredRecipes();

    if (filtered.length === 0) {
        grid.classList.add('hidden');
        empty.classList.remove('hidden');
        return;
    }

    grid.classList.remove('hidden');
    empty.classList.add('hidden');

    grid.innerHTML = filtered.map(recipe => `
        <div class="recipe-card" onclick="window.CookBook.viewRecipe('${recipe.id}')">
            ${recipe.favorite ? '<span class="favorite-badge">\u2665</span>' : ''}
            <h3>${escapeHtml(recipe.title)}</h3>
            <p>${escapeHtml(recipe.description)}</p>
            <div class="recipe-meta">
                ${recipe.total_time ? `<span>\u23F1 ${escapeHtml(recipe.total_time)}</span>` : ''}
                ${recipe.servings ? `<span>\uD83D\uDC64 ${recipe.servings} serving${recipe.servings > 1 ? 's' : ''}</span>` : ''}
            </div>
            ${(recipe.tags || []).length > 0 ? `
                <div class="tags">
                    ${recipe.tags.slice(0, 4).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
                    ${recipe.tags.length > 4 ? `<span class="tag">+${recipe.tags.length - 4}</span>` : ''}
                </div>
            ` : ''}
        </div>
    `).join('');
}

function viewRecipe(id) {
    const recipe = recipes.find(r => r.id === id);
    if (!recipe) return;

    currentRecipeId = id;
    baseServings = recipe.servings || 1;
    currentServings = baseServings;
    checkedIngredients.clear();
    checkedInstructions.clear();
    cookingMode = false;

    renderRecipeDetail(recipe);
    showView('detail');
}

function renderRecipeDetail(recipe) {
    const multiplier = currentServings / baseServings;
    const container = document.getElementById('recipe-detail');

    container.innerHTML = `
        <div class="recipe-header">
            <button class="favorite-btn ${recipe.favorite ? 'active' : ''}" onclick="window.CookBook.toggleFavorite('${recipe.id}')" title="Toggle favorite">
                ${recipe.favorite ? '\u2665' : '\u2661'}
            </button>
            <h1>${escapeHtml(recipe.title)}</h1>
            ${recipe.description ? `<p class="description">${escapeHtml(recipe.description)}</p>` : ''}
            ${(recipe.tags || []).length > 0 ? `
                <div class="tags">
                    ${recipe.tags.map(tag => `<span class="tag clickable" onclick="window.CookBook.filterByTag('${escapeHtml(tag)}')">${escapeHtml(tag)}</span>`).join('')}
                </div>
            ` : ''}
            <div class="recipe-stats">
                ${recipe.prep_time ? `<div class="stat"><span class="stat-label">Prep</span><span class="stat-value">${escapeHtml(recipe.prep_time)}</span></div>` : ''}
                ${recipe.cook_time ? `<div class="stat"><span class="stat-label">Cook</span><span class="stat-value">${escapeHtml(recipe.cook_time)}</span></div>` : ''}
                ${recipe.total_time ? `<div class="stat"><span class="stat-label">Total</span><span class="stat-value">${escapeHtml(recipe.total_time)}</span></div>` : ''}
            </div>
        </div>

        <div class="servings-control">
            <label>Servings:</label>
            <div class="servings-buttons">
                <button class="btn btn-circle" onclick="window.CookBook.adjustServings(-1)">\u2212</button>
                <span class="servings-display">${currentServings}</span>
                <button class="btn btn-circle" onclick="window.CookBook.adjustServings(1)">+</button>
            </div>
            ${multiplier !== 1 ? `<span class="multiplier-badge">${multiplier.toFixed(2)}\u00D7</span>` : ''}
            <div class="quick-scale">
                <button class="btn ${currentServings === baseServings ? 'active' : ''}" onclick="window.CookBook.setServings(${baseServings})">1\u00D7</button>
                <button class="btn ${currentServings === baseServings * 2 ? 'active' : ''}" onclick="window.CookBook.setServings(${baseServings * 2})">2\u00D7</button>
                <button class="btn ${currentServings === baseServings * 4 ? 'active' : ''}" onclick="window.CookBook.setServings(${baseServings * 4})">4\u00D7</button>
            </div>
        </div>

        <div class="cooking-mode-bar">
            <label class="toggle-switch-container">
                <input type="checkbox" ${cookingMode ? 'checked' : ''} onchange="window.CookBook.toggleCookingMode(this.checked)">
                <span class="toggle-switch"></span>
                <span class="toggle-label">Cooking Mode</span>
            </label>
            <span class="cooking-mode-status">${cookingMode ? 'Screen stays on \u2022 Tap to check off' : ''}</span>
        </div>

        <div class="recipe-content ${cookingMode ? 'cooking-mode' : ''}">
            <section class="recipe-section">
                <h2>Ingredients</h2>
                ${recipe.ingredients.map((group, gi) => `
                    <div class="ingredient-group">
                        ${group.group ? `<h3>${escapeHtml(group.group)}</h3>` : ''}
                        <ul class="ingredient-list">
                            ${group.items.map((item, ii) => {
                                const key = `${gi}-${ii}`;
                                const checked = checkedIngredients.has(key);
                                return `
                                    <li class="${checked ? 'checked' : ''}" data-key="${key}">
                                        <span class="ingredient-checkbox ${checked ? 'checked' : ''}" onclick="window.CookBook.toggleIngredient('${key}')"></span>
                                        <span class="ingredient-qty">${formatQuantity(item.raw, multiplier)}</span>
                                        <span class="ingredient-name">${escapeHtml(item.name)}</span>
                                    </li>
                                `;
                            }).join('')}
                        </ul>
                    </div>
                `).join('')}
            </section>

            <section class="recipe-section">
                <h2>Instructions</h2>
                <ol class="instruction-list">
                    ${recipe.instructions.map((step, i) => {
                        const checked = checkedInstructions.has(i);
                        return `
                            <li class="${checked ? 'checked' : ''}" data-index="${i}" onclick="window.CookBook.toggleInstruction(${i})">
                                ${step.title ? `<span class="instruction-title">${escapeHtml(step.title)}</span>` : ''}
                                <span class="instruction-text">${escapeHtml(step.text)}</span>
                            </li>
                        `;
                    }).join('')}
                </ol>
            </section>
        </div>

        <div class="recipe-actions">
            <button class="btn btn-secondary" onclick="window.CookBook.openEditModal('${recipe.id}')">Edit</button>
            <button class="btn btn-secondary" onclick="window.CookBook.exportRecipe('${recipe.id}')">Export</button>
            <button class="btn btn-danger" onclick="window.CookBook.openDeleteModal('${recipe.id}')">Delete</button>
        </div>
    `;
}

function adjustServings(delta) {
    const newServings = currentServings + delta;
    if (newServings >= 1 && newServings <= 100) {
        currentServings = newServings;
        const recipe = recipes.find(r => r.id === currentRecipeId);
        if (recipe) renderRecipeDetail(recipe);
    }
}

function setServings(value) {
    if (value >= 1 && value <= 100) {
        currentServings = value;
        const recipe = recipes.find(r => r.id === currentRecipeId);
        if (recipe) renderRecipeDetail(recipe);
    }
}

// =====================
// COOKING MODE
// =====================
async function toggleCookingMode(enabled) {
    cookingMode = enabled;

    if (enabled && 'wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
        } catch (e) {
            console.log('Wake lock not available:', e);
        }
    } else if (!enabled && wakeLock) {
        wakeLock.release();
        wakeLock = null;
    }

    const recipe = recipes.find(r => r.id === currentRecipeId);
    if (recipe) renderRecipeDetail(recipe);
}

function toggleIngredient(key) {
    if (!cookingMode) return;
    if (checkedIngredients.has(key)) {
        checkedIngredients.delete(key);
    } else {
        checkedIngredients.add(key);
    }
    const recipe = recipes.find(r => r.id === currentRecipeId);
    if (recipe) renderRecipeDetail(recipe);
}

function toggleInstruction(index) {
    if (!cookingMode) return;
    if (checkedInstructions.has(index)) {
        checkedInstructions.delete(index);
    } else {
        checkedInstructions.add(index);
    }
    const recipe = recipes.find(r => r.id === currentRecipeId);
    if (recipe) renderRecipeDetail(recipe);
}

// =====================
// FAVORITES
// =====================
function toggleFavorite(id) {
    const recipe = recipes.find(r => r.id === id);
    if (recipe) {
        recipe.favorite = !recipe.favorite;
        saveRecipes();
        renderRecipeDetail(recipe);
    }
}

function filterByTag(tag) {
    document.getElementById('tag-filter').value = tag;
    showView('list');
}

// =====================
// IMPORT/EXPORT
// =====================
function openImportModal() {
    openModal('import-modal');
    document.getElementById('recipe-input').value = '';
}

function closeImportModal() {
    closeModal('import-modal');
}

function importRecipe() {
    const input = document.getElementById('recipe-input').value.trim();
    if (!input) {
        alert('Please paste a recipe in the import format.');
        return;
    }

    try {
        const recipe = parseRecipeFormat(input);
        if (!recipe.title || recipe.ingredients.length === 0) {
            alert('Could not parse recipe. Please check the format.');
            return;
        }

        recipes.push(recipe);
        saveRecipes();
        closeImportModal();
        viewRecipe(recipe.id);
    } catch (e) {
        console.error('Import error:', e);
        alert('Error parsing recipe. Please check the format.');
    }
}

function exportRecipe(id) {
    const recipe = recipes.find(r => r.id === id);
    if (!recipe) return;

    let output = `===RECIPE===
title: ${recipe.title}
description: ${recipe.description}
tags: ${(recipe.tags || []).join(', ')}
prep_time: ${recipe.prep_time}
cook_time: ${recipe.cook_time}
total_time: ${recipe.total_time}
servings: ${recipe.servings}

`;
    recipe.ingredients.forEach(group => {
        if (group.group) {
            output += `===INGREDIENTS:${group.group}===\n`;
        } else {
            output += `===INGREDIENTS===\n`;
        }
        group.items.forEach(item => {
            output += `${item.qty} | ${item.name}\n`;
        });
        output += '\n';
    });

    output += '===INSTRUCTIONS===\n';
    recipe.instructions.forEach((step, i) => {
        if (step.title) {
            output += `${i + 1}. ${step.title}: ${step.text}\n`;
        } else {
            output += `${i + 1}. ${step.text}\n`;
        }
    });
    output += '===END===';

    downloadText(`${recipe.title.replace(/[^a-z0-9]/gi, '_')}.txt`, output);
}

function exportAllRecipes() {
    downloadJson('cookbook_backup.json', recipes);
}

function importBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (Array.isArray(imported)) {
                if (confirm(`Import ${imported.length} recipes? This will add to your existing recipes.`)) {
                    recipes = recipes.concat(imported);
                    saveRecipes();
                    updateTagFilter();
                    renderRecipeList();
                    alert('Import successful!');
                }
            } else {
                alert('Invalid backup file format.');
            }
        } catch (err) {
            alert('Error reading backup file.');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// =====================
// EDIT
// =====================
function openEditModal(id) {
    const recipe = recipes.find(r => r.id === id);
    if (!recipe) return;

    editTargetId = id;

    document.getElementById('edit-title').value = recipe.title;
    document.getElementById('edit-description').value = recipe.description;
    document.getElementById('edit-tags').value = (recipe.tags || []).join(', ');
    document.getElementById('edit-prep').value = recipe.prep_time;
    document.getElementById('edit-cook').value = recipe.cook_time;
    document.getElementById('edit-total').value = recipe.total_time;
    document.getElementById('edit-servings').value = recipe.servings;

    let ingredientsText = '';
    recipe.ingredients.forEach(group => {
        if (group.group) {
            ingredientsText += `===${group.group}===\n`;
        }
        group.items.forEach(item => {
            ingredientsText += `${item.qty} | ${item.name}\n`;
        });
        ingredientsText += '\n';
    });
    document.getElementById('edit-ingredients').value = ingredientsText.trim();

    const instructionsText = recipe.instructions.map(step => {
        return step.title ? `${step.title}: ${step.text}` : step.text;
    }).join('\n');
    document.getElementById('edit-instructions').value = instructionsText;

    openModal('edit-modal');
}

function closeEditModal() {
    closeModal('edit-modal');
    editTargetId = null;
}

function saveEdit() {
    if (!editTargetId) return;

    const recipe = recipes.find(r => r.id === editTargetId);
    if (!recipe) return;

    recipe.title = document.getElementById('edit-title').value.trim() || 'Untitled Recipe';
    recipe.description = document.getElementById('edit-description').value.trim();
    recipe.tags = document.getElementById('edit-tags').value
        .split(',')
        .map(t => t.trim().toLowerCase())
        .filter(t => t);
    recipe.prep_time = document.getElementById('edit-prep').value.trim();
    recipe.cook_time = document.getElementById('edit-cook').value.trim();
    recipe.total_time = document.getElementById('edit-total').value.trim();
    recipe.servings = parseInt(document.getElementById('edit-servings').value) || 1;

    const ingredientsText = document.getElementById('edit-ingredients').value.trim();
    const ingredientGroups = [];
    let currentGroup = { group: null, items: [] };

    ingredientsText.split('\n').forEach(line => {
        line = line.trim();
        if (!line) return;

        const groupMatch = line.match(/^===(.+?)===$/);
        if (groupMatch) {
            if (currentGroup.items.length > 0) {
                ingredientGroups.push(currentGroup);
            }
            currentGroup = { group: groupMatch[1].trim(), items: [] };
        } else if (line.includes('|')) {
            currentGroup.items.push(parseIngredientLine(line));
        }
    });
    if (currentGroup.items.length > 0) {
        ingredientGroups.push(currentGroup);
    }
    recipe.ingredients = ingredientGroups;

    const instructionsText = document.getElementById('edit-instructions').value.trim();
    recipe.instructions = instructionsText.split('\n')
        .map(line => line.trim())
        .filter(line => line)
        .map(line => {
            const colonIdx = line.indexOf(':');
            if (colonIdx > 0 && colonIdx < 50) {
                return {
                    title: line.substring(0, colonIdx).trim(),
                    text: line.substring(colonIdx + 1).trim()
                };
            }
            return { title: '', text: line };
        });

    saveRecipes();
    closeEditModal();
    baseServings = recipe.servings;
    currentServings = baseServings;
    renderRecipeDetail(recipe);
}

// =====================
// DELETE
// =====================
function openDeleteModal(id) {
    const recipe = recipes.find(r => r.id === id);
    if (!recipe) return;
    deleteTargetId = id;
    document.getElementById('delete-recipe-name').textContent = recipe.title;
    openModal('delete-modal');
}

function closeDeleteModal() {
    closeModal('delete-modal');
    deleteTargetId = null;
}

function confirmDelete() {
    if (!deleteTargetId) return;
    recipes = recipes.filter(r => r.id !== deleteTargetId);
    saveRecipes();
    closeDeleteModal();
    showView('list');
}

// =====================
// HELP MODAL
// =====================
function openHelpModal() {
    openModal('help-modal');
}

function closeHelpModal() {
    closeModal('help-modal');
}

function handleTabClick(tabId, event) {
    switchTab(tabId, event.target);
}

function copyPrompt() {
    const prompt = document.getElementById('claude-prompt').textContent;
    navigator.clipboard.writeText(prompt).then(() => {
        alert('Prompt copied to clipboard!');
    }).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = prompt;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert('Prompt copied!');
    });
}

// =====================
// INIT
// =====================
function init() {
    loadRecipes();
    updateTagFilter();
    renderRecipeList();
    updateFilterStatus();
    initModals();

    // Re-acquire wake lock on visibility change
    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible' && cookingMode && 'wakeLock' in navigator) {
            try {
                wakeLock = await navigator.wakeLock.request('screen');
            } catch (e) {
                console.log('Wake lock re-acquisition failed:', e);
            }
        }
    });

    // Register service worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('SW registered'))
            .catch(err => console.log('SW registration failed:', err));
    }
}

// Export public API
window.CookBook = {
    showView,
    viewRecipe,
    toggleFavorite,
    filterByTag,
    adjustServings,
    setServings,
    toggleCookingMode,
    toggleIngredient,
    toggleInstruction,
    openImportModal,
    closeImportModal,
    importRecipe,
    exportRecipe,
    exportAllRecipes,
    importBackup,
    openEditModal,
    closeEditModal,
    saveEdit,
    openDeleteModal,
    closeDeleteModal,
    confirmDelete,
    openHelpModal,
    closeHelpModal,
    handleTabClick,
    copyPrompt,
    toggleFilterBar,
    applyFilters,
    toggleNavFavorites
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);
