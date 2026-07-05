// State Management
let workouts = [];
let runs = []; // { id, date, distanceMiles, durationSeconds }
let dayNotes = {}; // { 'YYYY-MM-DD': 'session note text' }
let historyRangeDays = 7; // Recent History window on the Dashboard (7 or 30)
let chartInstance = null;
let paceChartInstance = null;
let currentCalendarDate = new Date(); // For Calendar View

// DOM Elements
const workoutForm = document.getElementById('workout-form');
const historyList = document.getElementById('history-list');
const clearHistoryBtn = document.getElementById('clear-history');
const chartFilter = document.getElementById('chart-filter');
const chartFilterToggle = document.getElementById('chart-filter-toggle');
const chartFilterDropdown = document.getElementById('chart-filter-dropdown');
const exportBtn = document.getElementById('export-history');
const importBtn = document.getElementById('import-history-btn');
const importFile = document.getElementById('import-file');
const longestStreakEl = document.getElementById('longest-streak');
const currentStreakEl = document.getElementById('current-streak');
const lastWorkoutDateEl = document.getElementById('last-workout-date');
const dateInput = document.getElementById('workout-date');
const setIndicator = document.getElementById('current-set-indicator');
const exerciseResetBtn = document.getElementById('exercise-reset');
const themeSelect = document.getElementById('theme-select');
const supersetEnabled = document.getElementById('superset-enabled');
const supersetFields = document.getElementById('superset-fields');
const supersetExerciseInput = document.getElementById('superset-exercise');
const supersetSetIndicator = document.getElementById('superset-set-indicator');
const supersetExerciseToggle = document.getElementById('superset-exercise-toggle');
const supersetExerciseDropdown = document.getElementById('superset-exercise-dropdown');

// Notes Elements
const setNoteToggle = document.getElementById('set-note-toggle');
const setNoteWrapper = document.getElementById('set-note-wrapper');
const setNoteInput = document.getElementById('set-note');
const sessionNoteToggle = document.getElementById('session-note-toggle');
const sessionNoteWrapper = document.getElementById('session-note-wrapper');
const sessionNoteInput = document.getElementById('session-note');

// Combobox Elements
const exerciseInput = document.getElementById('exercise');
const exerciseToggle = document.getElementById('exercise-toggle');
const exerciseDropdown = document.getElementById('exercise-dropdown');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initThemeSwitcher();
    initBackup();
    initNativeBackup();
    initExerciseManagement();
    initRunTracker();
    requestPersistentStorage();

    // Set default date to today (Local Time)
    const today = new Date();
    // en-CA locale formats as YYYY-MM-DD which matches input type="date"
    const localDate = today.toLocaleDateString('en-CA');
    dateInput.value = localDate;
    const runDateInput = document.getElementById('run-date');
    if (runDateInput) runDateInput.value = localDate;

    // Initialize DB and load workouts
    loadWorkouts();
});

function initThemeSwitcher() {
    if (!themeSelect) return;

    // Only Glacial Flux and Ballerina remain; migrate any retired theme
    // (glassmorphism / neumorphism / pixel) to the default.
    const VALID_THEMES = ['glacial-flux', 'ballerina'];
    const savedThemeRaw = localStorage.getItem('fittrack-ui-theme') || 'glacial-flux';
    const savedTheme = VALID_THEMES.includes(savedThemeRaw) ? savedThemeRaw : 'glacial-flux';
    applyTheme(savedTheme);
    themeSelect.value = savedTheme;
    if (savedTheme !== savedThemeRaw) {
        localStorage.setItem('fittrack-ui-theme', savedTheme);
    }

    themeSelect.addEventListener('change', (e) => {
        applyTheme(e.target.value);
        localStorage.setItem('fittrack-ui-theme', e.target.value);

        if (chartFilter.value) {
            renderChart(chartFilter.value);
        }
        renderPaceChart(); // re-pick theme colors
    });
}

function applyTheme(theme) {
    document.body.dataset.theme = theme;
}

function getThemeChartColors() {
    const styles = getComputedStyle(document.body);
    return {
        primary: styles.getPropertyValue('--accent-primary').trim() || '#6366f1',
        secondary: styles.getPropertyValue('--accent-secondary').trim() || '#8b5cf6',
        text: styles.getPropertyValue('--text-secondary').trim() || '#94a3b8',
        grid: styles.getPropertyValue('--chart-grid').trim() || 'rgba(148, 163, 184, 0.1)',
        fill: styles.getPropertyValue('--chart-fill').trim() || 'rgba(99, 102, 241, 0.2)'
    };
}

// Event Listeners
workoutForm.addEventListener('submit', (e) => {
    e.preventDefault();

    saveSessionNote(); // Persist any unsaved session-note text for this date

    const exerciseRaw = document.getElementById('exercise').value.trim();
    const exercise = toTitleCase(exerciseRaw);
    const dateStr = document.getElementById('workout-date').value;
    const isSuperset = supersetEnabled && supersetEnabled.checked;
    const createdAt = Date.now();
    const pendingWorkouts = [];

    const newWorkout = {
        id: createdAt,
        exercise: exercise,
        setNumber: getNextSetNumberWithPending(exercise, dateStr, pendingWorkouts),
        reps: parseInt(document.getElementById('reps').value),
        weight: parseFloat(document.getElementById('weight').value),
        intensity: parseInt(document.getElementById('intensity').value),
        date: new Date(dateStr + 'T12:00:00').toISOString()
    };

    const setNoteValue = setNoteInput ? setNoteInput.value.trim() : '';
    if (setNoteValue) {
        newWorkout.note = setNoteValue;
    }

    pendingWorkouts.push(newWorkout);

    if (isSuperset) {
        const supersetExercise = toTitleCase(supersetExerciseInput.value.trim());
        const supersetId = `ss-${createdAt}`;
        const supersetRound = getNextSupersetRound(dateStr);
        const supersetLabel = `${exercise} Superset ${supersetRound}`;

        if (!supersetExercise) {
            alert('Please enter the second superset exercise.');
            return;
        }

        newWorkout.supersetId = supersetId;
        newWorkout.supersetRound = supersetRound;
        newWorkout.supersetOrder = 1;
        newWorkout.supersetLabel = supersetLabel;

        pendingWorkouts.push({
            id: createdAt + 1,
            exercise: supersetExercise,
            setNumber: getNextSetNumberWithPending(supersetExercise, dateStr, pendingWorkouts),
            reps: parseInt(document.getElementById('superset-reps').value),
            weight: parseFloat(document.getElementById('superset-weight').value),
            intensity: parseInt(document.getElementById('superset-intensity').value),
            date: newWorkout.date,
            supersetId: supersetId,
            supersetRound: supersetRound,
            supersetOrder: 2,
            supersetLabel: supersetLabel
        });
    }

    workouts.push(...pendingWorkouts);
    const savePromise = pendingWorkouts.length > 1 ? db.bulkAdd(pendingWorkouts) : db.addWorkout(newWorkout);
    savePromise.then(() => {
        console.log('Workout added to DB');
    }).catch(err => console.error(err));

    sortWorkouts();
    updateUI();

    // Update chart if currently viewing this exercise or if it's the first one
    if (chartFilter.value === newWorkout.exercise || chartFilter.value === "") {
        chartFilter.value = newWorkout.exercise;
        renderChart(newWorkout.exercise);
    }
    renderCalendar();
    updateChartOptions();

    updateSetIndicator(); // Update for next set
    updateSupersetSetIndicator();
    resetSetNote(); // Clear the per-set note for the next set
});

clearHistoryBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all workout and running history? This cannot be undone.')) {
        await writeNativeSafetyBackup('before-clear'); // no-op in the browser
        workouts = [];
        runs = [];
        dayNotes = {};
        Promise.all([db.clearStore(), db.clearRuns(), db.clearDayNotes()]).then(() => {
            updateUI();
            updateRunUI();
            if (chartInstance) {
                chartInstance.destroy();
                chartInstance = null;
            }
            renderCalendar();
            updateChartOptions();
            updateSetIndicator();
            loadSessionNoteForDate();
        });
    }
});

if (chartFilter) {
    chartFilter.addEventListener('input', (e) => {
        filterExercises(e.target.value, chartFilter, chartFilterDropdown, () => {
            if (chartFilter.value) {
                renderChart(chartFilter.value);
            }
        });
        showDropdown(chartFilterDropdown);
        hideDropdown(exerciseDropdown);
        hideDropdown(supersetExerciseDropdown);
    });

    chartFilter.addEventListener('focus', () => {
        filterExercises(chartFilter.value, chartFilter, chartFilterDropdown, () => {
            if (chartFilter.value) {
                renderChart(chartFilter.value);
            }
        });
        showDropdown(chartFilterDropdown);
        hideDropdown(exerciseDropdown);
        hideDropdown(supersetExerciseDropdown);
    });
}

if (chartFilterToggle) {
    chartFilterToggle.addEventListener('click', (e) => {
        e.preventDefault();
        if (chartFilterDropdown.classList.contains('show')) {
            hideDropdown(chartFilterDropdown);
        } else {
            filterExercises('', chartFilter, chartFilterDropdown, () => {
                if (chartFilter.value) {
                    renderChart(chartFilter.value);
                }
            });
            showDropdown(chartFilterDropdown);
            hideDropdown(exerciseDropdown);
            hideDropdown(supersetExerciseDropdown);
            chartFilter.focus();
        }
    });
}

// Import/Export Handlers
exportBtn.addEventListener('click', exportWorkouts);
importBtn.addEventListener('click', () => importFile.click());
importFile.addEventListener('change', importWorkouts);

// Exercise Reset
if (exerciseResetBtn) {
    exerciseResetBtn.addEventListener('click', () => {
        const repsInput = document.getElementById('reps');
        const weightInput = document.getElementById('weight');
        const intensityInput = document.getElementById('intensity');
        const supersetRepsInput = document.getElementById('superset-reps');
        const supersetWeightInput = document.getElementById('superset-weight');
        const supersetIntensityInput = document.getElementById('superset-intensity');

        exerciseInput.value = '';
        repsInput.value = '';
        weightInput.value = '';
        intensityInput.value = 5;
        if (intensityInput.nextElementSibling) {
            intensityInput.nextElementSibling.value = 5;
        }
        if (supersetEnabled) supersetEnabled.checked = false;
        if (supersetExerciseInput) supersetExerciseInput.value = '';
        if (supersetRepsInput) supersetRepsInput.value = '';
        if (supersetWeightInput) supersetWeightInput.value = '';
        if (supersetIntensityInput) {
            supersetIntensityInput.value = 5;
            if (supersetIntensityInput.nextElementSibling) {
                supersetIntensityInput.nextElementSibling.value = 5;
            }
        }
        toggleSupersetFields();

        hideAllDropdowns();
        resetSetNote();
        renderExerciseHistory();
        updateSetIndicator();
        updateSupersetSetIndicator();
        exerciseInput.focus();
    });
}

if (supersetEnabled) {
    supersetEnabled.addEventListener('change', () => {
        toggleSupersetFields();
        updateSupersetSetIndicator();
    });
}

if (supersetExerciseInput) {
    supersetExerciseInput.addEventListener('input', (e) => {
        updateSupersetSetIndicator();
        filterExercises(e.target.value, supersetExerciseInput, supersetExerciseDropdown, () => {
            updateSupersetSetIndicator();
        });
        showDropdown(supersetExerciseDropdown);
        hideDropdown(exerciseDropdown);
    });

    supersetExerciseInput.addEventListener('focus', () => {
        filterExercises(supersetExerciseInput.value, supersetExerciseInput, supersetExerciseDropdown, () => {
            updateSupersetSetIndicator();
        });
        showDropdown(supersetExerciseDropdown);
        hideDropdown(exerciseDropdown);
    });
}

if (supersetExerciseToggle) {
    supersetExerciseToggle.addEventListener('click', (e) => {
        e.preventDefault();
        if (supersetExerciseDropdown.classList.contains('show')) {
            hideDropdown(supersetExerciseDropdown);
        } else {
            filterExercises('', supersetExerciseInput, supersetExerciseDropdown, () => {
                updateSupersetSetIndicator();
            });
            showDropdown(supersetExerciseDropdown);
            hideDropdown(exerciseDropdown);
            supersetExerciseInput.focus();
        }
    });
}

// --- Notes: Set & Session ---
if (setNoteToggle) {
    setNoteToggle.addEventListener('click', () => {
        const willShow = setNoteWrapper.hidden;
        setNoteWrapper.hidden = !willShow;
        if (willShow) setNoteInput.focus();
    });
}

if (sessionNoteToggle) {
    sessionNoteToggle.addEventListener('click', () => {
        const willShow = sessionNoteWrapper.hidden;
        sessionNoteWrapper.hidden = !willShow;
        if (willShow) sessionNoteInput.focus();
    });
}

if (sessionNoteInput) {
    sessionNoteInput.addEventListener('change', saveSessionNote);
    sessionNoteInput.addEventListener('blur', saveSessionNote);
}

function resetSetNote() {
    if (!setNoteInput) return;
    setNoteInput.value = '';
    if (setNoteWrapper) setNoteWrapper.hidden = true;
    updateNoteToggleLabel(setNoteToggle, false);
}

function updateNoteToggleLabel(toggleBtn, hasContent) {
    if (!toggleBtn) return;
    toggleBtn.innerHTML = hasContent
        ? '<i class="fa-solid fa-pen"></i> Edit'
        : '<i class="fa-solid fa-plus"></i> Add';
    toggleBtn.classList.toggle('has-note', !!hasContent);
}

function loadSessionNoteForDate() {
    if (!sessionNoteInput) return;
    const dateStr = document.getElementById('workout-date').value;
    const existing = (dateStr && dayNotes[dateStr]) ? dayNotes[dateStr] : '';
    sessionNoteInput.value = existing;
    updateNoteToggleLabel(sessionNoteToggle, !!existing);
    // Keep the box collapsed by default; the "Edit" label signals a note exists.
    if (sessionNoteWrapper) sessionNoteWrapper.hidden = true;
}

function saveSessionNote() {
    if (!sessionNoteInput) return;
    const dateStr = document.getElementById('workout-date').value;
    if (!dateStr) return;
    const value = sessionNoteInput.value.trim();

    const previous = dayNotes[dateStr] || '';
    if (value === previous) return; // No change

    if (value) {
        dayNotes[dateStr] = value;
        db.putDayNote({ date: dateStr, note: value }).catch(err => console.error(err));
    } else {
        delete dayNotes[dateStr];
        db.deleteDayNote(dateStr).catch(err => console.error(err));
    }

    updateNoteToggleLabel(sessionNoteToggle, !!value);
    renderHistory();
    renderTodaysHistory();
    renderExerciseHistory();
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function localDateKey(dateLike) {
    return new Date(dateLike).toLocaleDateString('en-CA'); // YYYY-MM-DD local
}

function setNoteLineHTML(note) {
    if (!note) return '';
    return `<div class="set-note"><i class="fa-solid fa-pen-to-square"></i><span>${escapeHtml(note)}</span></div>`;
}

function sessionNoteLineHTML(note) {
    if (!note) return '';
    return `<div class="session-note-line"><i class="fa-solid fa-note-sticky"></i><span>${escapeHtml(note)}</span></div>`;
}

// Tab Switching
const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Remove active class from all
        tabBtns.forEach(b => b.classList.remove('active'));
        tabPanes.forEach(p => p.classList.remove('active'));

        // Add active class to clicked btn
        btn.classList.add('active');

        // Show corresponding pane
        const tabId = btn.getAttribute('data-tab');
        document.getElementById(`tab-${tabId}`).classList.add('active');
    });
});

// Combobox Event Listeners
exerciseInput.addEventListener('input', (e) => {
    updateSetIndicator();
    renderExerciseHistory();
    filterExercises(e.target.value, exerciseInput, exerciseDropdown, () => {
        updateSetIndicator();
        renderExerciseHistory();
    });
    showDropdown(exerciseDropdown);
    hideDropdown(supersetExerciseDropdown);
});

exerciseInput.addEventListener('focus', () => {
    filterExercises(exerciseInput.value, exerciseInput, exerciseDropdown, () => {
        updateSetIndicator();
        renderExerciseHistory();
    });
    showDropdown(exerciseDropdown);
    hideDropdown(supersetExerciseDropdown);
});

exerciseToggle.addEventListener('click', (e) => {
    e.preventDefault(); // Prevent form submission if inside form
    if (exerciseDropdown.classList.contains('show')) {
        hideDropdown(exerciseDropdown);
    } else {
        filterExercises('', exerciseInput, exerciseDropdown, () => {
            updateSetIndicator();
            renderExerciseHistory();
        }); // Show all
        showDropdown(exerciseDropdown);
        hideDropdown(supersetExerciseDropdown);
        exerciseInput.focus();
    }
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.combobox-wrapper')) {
        hideAllDropdowns();
    }
});

document.getElementById('workout-date').addEventListener('change', () => {
    updateSetIndicator();
    updateSupersetSetIndicator();
    renderTodaysHistory();
    loadSessionNoteForDate();
});

// Recent History range selector (Dashboard)
const historyRangeSelect = document.getElementById('history-range');
if (historyRangeSelect) {
    historyRangeSelect.addEventListener('change', (e) => {
        historyRangeDays = parseInt(e.target.value, 10) || 7;
        renderHistory();
    });
}

// Calendar Navigation
document.getElementById('prev-month').addEventListener('click', () => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
    renderCalendar();
});

document.getElementById('next-month').addEventListener('click', () => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
    renderCalendar();
});

document.getElementById('today-btn').addEventListener('click', () => {
    currentCalendarDate = new Date();
    renderCalendar();
});

document.getElementById('calendar-month-picker').addEventListener('change', (e) => {
    const [year, month] = e.target.value.split('-');
    if (year && month) {
        currentCalendarDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        renderCalendar();
    }
});

// Delete Workout
window.deleteWorkout = function (id) {
    if (confirm('Delete this set?')) {
        const deletedWorkout = workouts.find(w => w.id === id) || null;
        workouts = workouts.filter(w => w.id !== id);
        db.deleteWorkout(id).then(async () => {
            if (deletedWorkout) {
                const dateStr = getWorkoutDateKey(deletedWorkout);
                await normalizeSetNumbers(deletedWorkout.exercise, dateStr);
            }

            updateUI();
            updateSetIndicator();

            // Update chart if needed
            if (chartFilter.value) {
                renderChart(chartFilter.value);
            }
            renderCalendar();
            updateChartOptions();
        });
    }
};

window.deleteDateGroup = function (dateKey) {
    if (confirm(`Delete everything logged for ${dateKey}?`)) {
        // Find workouts and runs to delete
        const toDelete = workouts.filter(w => historyDateKey(w.date) === dateKey);
        const runsToDelete = runs.filter(r => historyDateKey(r.date) === dateKey);

        const ids = toDelete.map(w => w.id);
        const runIds = runsToDelete.map(r => r.id);

        // Update local state
        workouts = workouts.filter(w => !ids.includes(w.id));
        runs = runs.filter(r => !runIds.includes(r.id));

        // Update DB
        const tasks = [];
        if (ids.length) tasks.push(db.bulkDelete(ids));
        if (runIds.length) tasks.push(db.bulkDeleteRuns(runIds));
        Promise.all(tasks).then(() => {
            updateUI();
            updateRunUI();
            updateSetIndicator();
            if (chartFilter.value) renderChart(chartFilter.value);
            renderCalendar();
            updateChartOptions();
        });
    }
};

window.deleteExerciseGroup = function (dateKey, exerciseName) {
    if (confirm(`Delete all ${exerciseName} sets for ${dateKey}?`)) {
        // Find workouts to delete
        const toDelete = workouts.filter(w => {
            const wDateKey = new Date(w.date).toLocaleDateString(undefined, {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            });
            return wDateKey === dateKey && w.exercise === exerciseName;
        });

        const ids = toDelete.map(w => w.id);

        // Update local state
        workouts = workouts.filter(w => !ids.includes(w.id));

        // Update DB
        db.bulkDelete(ids).then(() => {
            updateUI();
            updateSetIndicator();
            if (chartFilter.value) renderChart(chartFilter.value);
            renderCalendar();
            updateChartOptions();
        });
    }
};

// Stepper Logic
window.adjustValue = function (id, amount) {
    const input = document.getElementById(id);
    let val = parseFloat(input.value) || 0;
    val += amount;

    // Validation
    if (id === 'reps') {
        if (val < 1) val = 1;
    } else if (val < 0) {
        val = 0;
    }

    input.value = Math.round(val * 100) / 100; // avoid float drift on fractional steps
};

// Core Functions
async function loadWorkouts() {
    try {
        // Migration Logic
        const localData = localStorage.getItem('workouts');
        if (localData) {
            const parsed = JSON.parse(localData);
            if (Array.isArray(parsed) && parsed.length > 0) {
                console.log('Migrating data from localStorage to IndexedDB...');
                await db.bulkAdd(parsed);
                localStorage.removeItem('workouts');
                console.log('Migration complete.');
            }
        }

        workouts = await db.getAllWorkouts();
        runs = await db.getAllRuns();

        const storedNotes = await db.getAllDayNotes();
        dayNotes = {};
        storedNotes.forEach(n => { dayNotes[n.date] = n.note; });

        sortWorkouts();
        sortRuns();
        updateUI();
        updateRunUI();
        updateChartOptions();
        renderCalendar();
        loadSessionNoteForDate();

        // Keep the on-device snapshot fresh (only when we actually have data, so an
        // accidental "Clear all" can't overwrite a good snapshot with an empty one)
        if (workouts.length > 0 || runs.length > 0) {
            saveLocalSnapshot();
        }
        updateBackupStatusUI();
        maybeShowBackupBanner();

        // Default chart view if data exists
    if (workouts.length > 0 && !chartFilter.value) {
        const lastExercise = workouts[0].exercise;
        chartFilter.value = lastExercise;
        chartFilter.placeholder = lastExercise;
        renderChart(lastExercise);
    }
    } catch (err) {
        console.error('Error loading workouts:', err);
    }
}

// saveWorkouts function removed as we now use db operations directly

function sortWorkouts() {
    workouts.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        if (dateA.getTime() !== dateB.getTime()) return dateB - dateA;
        return (a.setNumber || 0) - (b.setNumber || 0); // Sort by set number ASC within date
    });
}

function getWorkoutDateKey(workout) {
    return new Date(workout.date).toISOString().split('T')[0];
}

function getNextSetNumber(exercise, dateStr) {
    // Find existing sets for this exercise on this date
    // Note: dateStr is YYYY-MM-DD from input
    const existingSets = workouts.filter(w => {
        const wDate = getWorkoutDateKey(w);
        return w.exercise === exercise && wDate === dateStr;
    });
    return existingSets.length + 1;
}

function getNextSetNumberWithPending(exercise, dateStr, pendingWorkouts) {
    const pendingCount = pendingWorkouts.filter(w => w.exercise === exercise && getWorkoutDateKey(w) === dateStr).length;
    return getNextSetNumber(exercise, dateStr) + pendingCount;
}

function getNextSupersetRound(dateStr) {
    const supersetIds = new Set(workouts
        .filter(w => w.supersetId && getWorkoutDateKey(w) === dateStr)
        .map(w => w.supersetId));
    return supersetIds.size + 1;
}

async function normalizeSetNumbers(exercise, dateStr) {
    const sets = workouts
        .filter(w => w.exercise === exercise && getWorkoutDateKey(w) === dateStr)
        .sort((a, b) => a.id - b.id);

    let changed = false;
    sets.forEach((w, index) => {
        const nextSetNumber = index + 1;
        if (w.setNumber !== nextSetNumber) {
            w.setNumber = nextSetNumber;
            changed = true;
        }
    });

    if (changed) {
        await db.bulkAdd(sets);
    }
}

function updateSetIndicator() {
    const exerciseRaw = document.getElementById('exercise').value.trim();
    const exercise = toTitleCase(exerciseRaw);
    const dateStr = document.getElementById('workout-date').value;

    if (exercise && dateStr) {
        const nextSet = getNextSetNumber(exercise, dateStr);
        setIndicator.textContent = `Set ${nextSet}`;
    } else {
        setIndicator.textContent = 'Set 1';
    }
}

function updateSupersetSetIndicator() {
    if (!supersetSetIndicator) return;

    const exercise = toTitleCase((supersetExerciseInput && supersetExerciseInput.value.trim()) || '');
    const dateStr = document.getElementById('workout-date').value;

    if (exercise && dateStr) {
        supersetSetIndicator.textContent = `Set ${getNextSetNumber(exercise, dateStr)}`;
    } else {
        supersetSetIndicator.textContent = 'Set 1';
    }
}

function toggleSupersetFields() {
    if (!supersetFields || !supersetEnabled) return;

    const enabled = supersetEnabled.checked;
    supersetFields.hidden = !enabled;

    ['superset-exercise', 'superset-reps', 'superset-weight'].forEach(id => {
        const input = document.getElementById(id);
        if (input) input.required = enabled;
    });
}

function updateUI() {
    renderHistory();
    updateSummary();
    renderTodaysHistory();
    renderExerciseHistory();
    updateExerciseManagementUI();
}

// Map each superset set's id -> the partner exercise name(s) in its superset group.
// Lets us render superset sets as regular sets with a small "Superset with X" tag.
function buildSupersetPartners(workoutList) {
    const groups = {};
    workoutList.forEach(w => {
        if (!w.supersetId) return;
        if (!groups[w.supersetId]) groups[w.supersetId] = [];
        groups[w.supersetId].push(w);
    });

    const partners = {};
    Object.values(groups).forEach(group => {
        group.forEach(w => {
            // Keep the full partner set objects so we can show their reps/weight/intensity
            partners[w.id] = group.filter(x => x.id !== w.id);
        });
    });
    return partners;
}

function supersetLineHTML(partners) {
    if (!partners || !partners.length) {
        return `<div class="superset-note"><i class="fa-solid fa-link"></i><span>Superset</span></div>`;
    }

    const parts = partners.map(p => {
        const intColor = getIntensityColor(p.intensity);
        return `<span class="superset-partner">` +
            `<strong>${escapeHtml(p.exercise)}</strong> · ${p.reps} × ${p.weight} lbs · ` +
            `<span style="color: ${intColor};"><i class="fa-solid fa-fire"></i> ${(p.intensity || 0).toFixed(1)}</span>` +
            `</span>`;
    }).join('<span class="superset-sep">,</span> ');

    return `<div class="superset-note"><i class="fa-solid fa-link"></i><span class="superset-note-body">Superset with ${parts}</span></div>`;
}

function renderTodaysHistory() {
    const list = document.getElementById('todays-history-list');
    const dateStr = document.getElementById('workout-date').value;
    if (!list || !dateStr) return;

    list.innerHTML = '';

    // Filter workouts for this date
    const todaysWorkouts = workouts.filter(w => {
        const wDate = new Date(w.date).toISOString().split('T')[0];
        return wDate === dateStr;
    }).sort((a, b) => {
        // Sort by time added (id) or set number DESCENDING logic for "oldest at bottom" (aka newest at top)
        // Actually, user said: "I would like the sets to be showing the oldest on the bottom of the workout box rather than new sets being added to the bottom of the box."
        // This means Newest on Top.
        return b.id - a.id;
    });

    if (todaysWorkouts.length === 0) {
        list.innerHTML = '<p style="color: var(--text-secondary); font-style: italic;">No workouts logged for this date.</p>';
        return;
    }

    // Session note sits at the very top so the day's context is read first
    list.insertAdjacentHTML('beforeend', sessionNoteLineHTML(dayNotes[dateStr]));

    // Day's overview average — over ALL of the day's sets (supersets included)
    const totalDayIntensity = todaysWorkouts.reduce((sum, w) => sum + (w.intensity || 0), 0);
    const avgDayIntensity = (totalDayIntensity / todaysWorkouts.length).toFixed(1);
    const dayColor = getIntensityColor(parseFloat(avgDayIntensity));

    const dayHeader = document.createElement('div');
    dayHeader.style.display = 'flex';
    dayHeader.style.justifyContent = 'space-between';
    dayHeader.style.alignItems = 'center';
    dayHeader.style.marginBottom = '15px';
    dayHeader.style.paddingBottom = '10px';
    dayHeader.style.borderBottom = '1px solid var(--border-color)';
    dayHeader.innerHTML = `
        <span style="font-weight: 600; color: var(--text-primary);">Today's Overview</span>
        <span style="font-size: 0.9rem; font-weight: 600; color: ${dayColor}; display: flex; align-items: center; gap: 5px;">
            <i class="fa-solid fa-fire"></i> ${avgDayIntensity}
        </span>
    `;
    list.appendChild(dayHeader);

    // Group ALL sets by exercise — supersets are treated as regular sets
    const supersetPartners = buildSupersetPartners(todaysWorkouts);
    const grouped = {};
    todaysWorkouts.forEach(w => {
        if (!grouped[w.exercise]) grouped[w.exercise] = [];
        grouped[w.exercise].push(w);
    });

    Object.keys(grouped).forEach(ex => {
        const group = document.createElement('div');
        group.style.marginBottom = '10px';

        // Exercise average (now includes any superset sets for this exercise)
        const exTotalInt = grouped[ex].reduce((sum, w) => sum + (w.intensity || 0), 0);
        const exAvgInt = (exTotalInt / grouped[ex].length).toFixed(1);
        const intensityColor = getIntensityColor(parseFloat(exAvgInt));

        group.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                <h4 style="color: var(--accent-primary); font-size: 0.9rem;">${ex}</h4>
                <span style="font-size: 0.8rem; font-weight: 600; color: ${intensityColor}; display: flex; align-items: center; gap: 4px;">
                    <i class="fa-solid fa-fire"></i> ${exAvgInt}
                </span>
            </div>
        `;

        grouped[ex].forEach(w => {
            const item = document.createElement('div');
            item.style.display = 'flex';
            item.style.justifyContent = 'space-between';
            item.style.alignItems = 'center'; // Align items vertically
            item.style.padding = '5px 10px';
            item.style.background = 'rgba(255,255,255,0.05)';
            item.style.marginBottom = '2px';
            item.style.borderRadius = '4px';
            item.style.fontSize = '0.85rem';

            // Consistent UI: Set info on left, details + delete on right
            const wIntColor = getIntensityColor(w.intensity);

            item.innerHTML = `
                <div style="display: flex; gap: 10px; align-items: center;">
                    <span style="font-weight: 600; min-width: 45px; color: var(--accent-primary);">Set ${w.setNumber || '?'}</span>
                    <span>${w.reps} x ${w.weight} lbs</span>
                </div>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <span style="font-size: 0.8rem; font-weight: 600; color: ${wIntColor}; display: flex; align-items: center; gap: 4px;">
                        <i class="fa-solid fa-fire"></i> ${(w.intensity || 0).toFixed(1)}
                    </span>
                    <button class="delete-btn" onclick="deleteWorkout(${w.id})" title="Delete Set" style="padding: 0;">
                         <i class="fa-solid fa-trash" style="font-size: 0.8rem;"></i>
                    </button>
                </div>
            `;
            group.appendChild(item);
            if (w.supersetId) {
                group.insertAdjacentHTML('beforeend', supersetLineHTML(supersetPartners[w.id]));
            }
            group.insertAdjacentHTML('beforeend', setNoteLineHTML(w.note));
        });
        list.appendChild(group);
    });
}

function renderExerciseHistory() {
    const container = document.getElementById('exercise-history');
    const exerciseRaw = document.getElementById('exercise').value.trim();
    const exercise = toTitleCase(exerciseRaw);

    const dateStr = document.getElementById('workout-date').value;

    if (!container) return;

    if (!exercise) {
        container.style.display = 'none';
        return;
    }

    // Filter workouts for this exercise and BEFORE the selected date
    const history = workouts
        .filter(w => {
            const wDate = new Date(w.date).toISOString().split('T')[0];
            return w.exercise === exercise && wDate < dateStr;
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date)); // Descending date

    if (history.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    const last5 = history.slice(0, 5);

    // Group the displayed sets by date (most-recent-first) so notes attach to their date
    const byDate = [];
    const dateIndex = {};
    last5.forEach(w => {
        const key = localDateKey(w.date);
        if (!(key in dateIndex)) {
            dateIndex[key] = byDate.length;
            byDate.push({ key, date: new Date(w.date), sets: [] });
        }
        byDate[dateIndex[key]].sets.push(w);
    });

    let html = '<table style="width: 100%; text-align: left; border-collapse: collapse;">';
    html += '<thead><tr><th style="padding-bottom: 5px; color: var(--accent-secondary);">Date</th><th style="color: var(--accent-secondary);">Set</th><th style="color: var(--accent-secondary);">Reps</th><th style="color: var(--accent-secondary);">Lbs</th><th style="color: var(--accent-secondary);">Int.</th></tr></thead><tbody>';

    byDate.forEach(group => {
        const dateLabel = group.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

        // Session note sits on top of each date
        const sessionNote = dayNotes[group.key];
        if (sessionNote) {
            html += `
                <tr class="note-inline-row session-row">
                    <td colspan="5">
                        <div class="exhist-note">
                            <i class="fa-solid fa-note-sticky"></i>
                            <span class="note-view-tag session">session</span>
                            <span class="exhist-note-text">${escapeHtml(sessionNote)}</span>
                        </div>
                    </td>
                </tr>
            `;
        }

        group.sets.forEach((w, idx) => {
            const intensityValue = Number(w.intensity || 0).toFixed(1);
            const intensityColor = getIntensityColor(Number(w.intensity || 0));
            html += `
                <tr style="border-top: 1px solid rgba(255,255,255,0.1);">
                    <td style="padding: 4px 0;">${idx === 0 ? dateLabel : ''}</td>
                    <td>${w.setNumber || 1}</td>
                    <td>${w.reps}</td>
                    <td>${w.weight}</td>
                    <td>
                        <span style="color: ${intensityColor}; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                            <i class="fa-solid fa-fire" style="font-size: 0.7rem;"></i> ${intensityValue}
                        </span>
                    </td>
                </tr>
            `;

            // Set note aligned under the Set column (empty Date cell; note spans Set..Int)
            if (w.note) {
                html += `
                    <tr class="note-inline-row">
                        <td></td>
                        <td colspan="4">
                            <div class="exhist-note">
                                <i class="fa-solid fa-note-sticky"></i>
                                <span class="note-view-tag">Set ${w.setNumber || 1}</span>
                                <span class="exhist-note-text">${escapeHtml(w.note)}</span>
                            </div>
                        </td>
                    </tr>
                `;
            }
        });
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

function historyDateKey(dateLike) {
    return new Date(dateLike).toLocaleDateString(undefined, {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
}

function renderHistory() {
    historyList.innerHTML = '';

    if (workouts.length === 0 && runs.length === 0) {
        historyList.innerHTML = `
            <div class="empty-state">
                <p>No workouts logged yet. Start training!</p>
            </div>
        `;
        return;
    }

    // Only render entries within the selected window so the DOM stays light as data grows
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - (historyRangeDays - 1));
    const inRange = workouts.filter(w => new Date(w.date) >= cutoff);
    const runsInRange = runs.filter(r => new Date(r.date) >= cutoff);

    if (inRange.length === 0 && runsInRange.length === 0) {
        historyList.innerHTML = `
            <div class="empty-state">
                <p>No workouts in the last ${historyRangeDays} days.</p>
            </div>
        `;
        return;
    }

    // Group lifts and runs by date, keeping the dates in newest-first order
    const groupedByDate = {};
    const dateOrder = [];
    [...inRange, ...runsInRange]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .forEach(item => {
            const dateKey = historyDateKey(item.date);
            if (!groupedByDate[dateKey]) {
                groupedByDate[dateKey] = { workouts: [], runs: [], sample: item };
                dateOrder.push(dateKey);
            }
        });
    inRange.forEach(w => groupedByDate[historyDateKey(w.date)].workouts.push(w));
    runsInRange.forEach(r => groupedByDate[historyDateKey(r.date)].runs.push(r));

    dateOrder.forEach(date => {
        const dayWorkouts = groupedByDate[date].workouts;
        const dayRuns = groupedByDate[date].runs;

        const dateGroup = document.createElement('div');
        dateGroup.className = 'history-date-group';

        const dateHeader = document.createElement('div');
        dateHeader.className = 'history-date-header';
        dateHeader.style.display = 'flex';
        dateHeader.style.justifyContent = 'space-between';
        dateHeader.style.alignItems = 'center';

        // Average Intensity for the date (lifting sets only — runs carry no intensity)
        let intensityBadge = '';
        if (dayWorkouts.length > 0) {
            const totalIntensity = dayWorkouts.reduce((sum, w) => sum + (w.intensity || 0), 0);
            const avgIntensity = (totalIntensity / dayWorkouts.length).toFixed(1);
            const avgColor = getIntensityColor(parseFloat(avgIntensity));
            intensityBadge = `
                <span style="font-size: 0.8rem; font-weight: 600; color: ${avgColor}; display: flex; align-items: center; gap: 4px;">
                    <i class="fa-solid fa-fire"></i> ${avgIntensity}
                </span>`;
        }

        dateHeader.innerHTML = `
            <span>${date}</span>
            <div style="display: flex; align-items: center; gap: 15px;">
                ${intensityBadge}
                <button class="delete-btn" onclick="deleteDateGroup('${date}')" title="Delete All for Date">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
        dateGroup.appendChild(dateHeader);
        dateGroup.insertAdjacentHTML('beforeend', sessionNoteLineHTML(dayNotes[localDateKey(groupedByDate[date].sample.date)]));

        // Group ALL sets by Exercise within the date — supersets are treated as regular sets
        const supersetPartners = buildSupersetPartners(dayWorkouts);
        const exercisesInDate = {};
        dayWorkouts.forEach(workout => {
            if (!exercisesInDate[workout.exercise]) exercisesInDate[workout.exercise] = [];
            exercisesInDate[workout.exercise].push(workout);
        });

        Object.keys(exercisesInDate).forEach(exercise => {
            const exerciseGroup = document.createElement('div');
            exerciseGroup.className = 'history-exercise-group';

            const exHeader = document.createElement('div');
            exHeader.className = 'history-exercise-header';
            exHeader.style.display = 'flex';
            exHeader.style.justifyContent = 'space-between';
            exHeader.style.alignItems = 'center';

            // Calculate Average Intensity for Exercise
            const exTotalInt = exercisesInDate[exercise].reduce((sum, w) => sum + (w.intensity || 0), 0);
            const exAvgInt = (exTotalInt / exercisesInDate[exercise].length).toFixed(1);
            const exIntColor = getIntensityColor(parseFloat(exAvgInt));

            exHeader.innerHTML = `
                <h4>${exercise}</h4>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 0.8rem; font-weight: 600; color: ${exIntColor}; display: flex; align-items: center; gap: 4px;">
                        <i class="fa-solid fa-fire"></i> ${exAvgInt}
                    </span>
                    <button class="delete-btn" onclick="deleteExerciseGroup('${date}', '${exercise.replace(/'/g, "\\'")}')" title="Delete All ${exercise}" style="font-size: 0.8rem;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;
            exerciseGroup.appendChild(exHeader);

            const setList = document.createElement('div');
            setList.className = 'history-set-list';

            // Sort newest on top (descending ID)
            exercisesInDate[exercise].sort((a, b) => b.id - a.id).forEach(workout => {
                const setNum = workout.setNumber || 1;
                const setItem = document.createElement('div');
                setItem.className = 'history-set-item';
                setItem.innerHTML = `
                    <div class="set-details">
                        <span style="min-width: 60px; font-weight: 600; color: var(--accent-primary);">
                            Set ${setNum}
                        </span>
                        <span><i class="fa-solid fa-rotate-right"></i> ${workout.reps} Reps</span>
                        <span><i class="fa-solid fa-weight-hanging"></i> ${workout.weight} lbs</span>
                    </div>
                    <div class="set-meta">
                        <span style="font-size: 0.85rem; font-weight: 600; color: ${getIntensityColor(workout.intensity)}; margin-right: 5px; display: flex; align-items: center; gap: 4px;">
                            <i class="fa-solid fa-fire"></i> ${(workout.intensity || 0).toFixed(1)}
                        </span>
                        <button class="delete-btn" onclick="deleteWorkout(${workout.id})" title="Delete Set">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                `;
                setList.appendChild(setItem);
                if (workout.supersetId) {
                    setList.insertAdjacentHTML('beforeend', supersetLineHTML(supersetPartners[workout.id]));
                }
                setList.insertAdjacentHTML('beforeend', setNoteLineHTML(workout.note));
            });

            exerciseGroup.appendChild(setList);
            dateGroup.appendChild(exerciseGroup);
        });

        // Runs for the date, styled like an exercise group
        if (dayRuns.length > 0) {
            const runGroup = document.createElement('div');
            runGroup.className = 'history-exercise-group';
            runGroup.innerHTML = `
                <div class="history-exercise-header">
                    <h4><i class="fa-solid fa-person-running"></i> Running</h4>
                </div>
            `;

            const runList = document.createElement('div');
            runList.className = 'history-set-list';

            dayRuns.sort((a, b) => b.id - a.id).forEach(run => {
                const runItem = document.createElement('div');
                runItem.className = 'history-set-item';
                runItem.innerHTML = `
                    <div class="set-details">
                        <span><i class="fa-solid fa-route"></i> ${run.distanceMiles} mi</span>
                        <span><i class="fa-solid fa-stopwatch"></i> ${formatDuration(run.durationSeconds)}</span>
                    </div>
                    <div class="set-meta">
                        <span class="run-pace" style="margin-right: 5px;">${formatPace(runPaceSeconds(run))} /mi</span>
                        <button class="delete-btn" onclick="deleteRun(${run.id})" title="Delete Run">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                `;
                runList.appendChild(runItem);
            });

            runGroup.appendChild(runList);
            dateGroup.appendChild(runGroup);
        }

        historyList.appendChild(dateGroup);
    });
}


function updateSummary() {
    const streaks = calculateStreaks();
    longestStreakEl.textContent = `${streaks.longest} Days`;
    currentStreakEl.textContent = `${streaks.current} Days`;

    // Runs count as workouts for "Last Workout"
    const allActivity = [...workouts, ...runs];
    if (allActivity.length > 0) {
        // Sort by date descending to get the latest
        const sortedByDate = allActivity.sort((a, b) => new Date(b.date) - new Date(a.date));
        const lastDate = new Date(sortedByDate[0].date);
        lastWorkoutDateEl.textContent = lastDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } else {
        lastWorkoutDateEl.textContent = 'Never';
    }
}

function calculateStreaks() {
    // A day counts toward the streak if anything was logged — lifting or running
    if (workouts.length === 0 && runs.length === 0) return { current: 0, longest: 0 };

    // Get unique dates, sorted ascending
    const uniqueDates = [...new Set([...workouts, ...runs].map(w => new Date(w.date).toISOString().split('T')[0]))].sort();

    if (uniqueDates.length === 0) return { current: 0, longest: 0 };

    let longestStreak = 0;
    let currentStreak = 0;
    let tempStreak = 0;
    let prevDate = null;

    // Calculate Longest Streak
    for (const dateStr of uniqueDates) {
        const currentDate = new Date(dateStr);

        if (prevDate) {
            const diffTime = Math.abs(currentDate - prevDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                tempStreak++;
            } else {
                tempStreak = 1;
            }
        } else {
            tempStreak = 1;
        }

        if (tempStreak > longestStreak) {
            longestStreak = tempStreak;
        }

        prevDate = currentDate;
    }

    // Calculate Current Streak
    // Check backwards from today or the last workout date
    // If the last workout was today or yesterday, the streak is active.
    // Otherwise, it's broken (0), unless we want to show the streak up to the last workout?
    // User requirement: "Workout Streaks counts the consecutive days of logging. Restart the count if the days are cut."
    // Usually "Current Streak" implies an active streak. If I worked out 5 days in a row but stopped a month ago, is my current streak 5 or 0?
    // Standard app behavior: 0 if broken. However, to be encouraging, sometimes it shows the streak ending on the last workout.
    // Let's stick to: Active streak ending today or yesterday.

    const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
    const lastWorkoutDateStr = uniqueDates[uniqueDates.length - 1];

    const today = new Date(todayStr);
    const lastWorkoutDate = new Date(lastWorkoutDateStr);

    const diffToLast = Math.floor((today - lastWorkoutDate) / (1000 * 60 * 60 * 24));

    if (diffToLast <= 1) {
        // Streak is active (logged today or yesterday)
        // Count backwards from last workout
        currentStreak = 1;
        for (let i = uniqueDates.length - 1; i > 0; i--) {
            const curr = new Date(uniqueDates[i]);
            const prev = new Date(uniqueDates[i - 1]);
            const diff = Math.floor((curr - prev) / (1000 * 60 * 60 * 24));

            if (diff === 1) {
                currentStreak++;
            } else {
                break;
            }
        }
    } else {
        currentStreak = 0;
    }

    return { current: currentStreak, longest: longestStreak };
}

function updateChartOptions() {
    const exercises = [...new Set(workouts.map(w => w.exercise))];
    const currentValue = chartFilter.value;

    if (currentValue && exercises.includes(currentValue)) {
        chartFilter.value = currentValue;
        chartFilter.placeholder = currentValue;
    } else {
        chartFilter.value = '';
        chartFilter.placeholder = exercises.length ? 'Select Exercise' : 'No exercises yet';
    }
}

function renderChart(exerciseName) {
    const ctx = document.getElementById('progressChart').getContext('2d');

    // Filter workouts for this exercise and sort by date then set number
    const exerciseData = workouts
        .filter(w => w.exercise === exerciseName)
        .sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            if (dateA.getTime() !== dateB.getTime()) return dateA - dateB;
            return (a.setNumber || 0) - (b.setNumber || 0);
        });

    // Prepare data points
    // Group by Date and find Max Weight per day
    const maxWeightByDate = {};
    exerciseData.forEach(w => {
        const dateKey = new Date(w.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        if (!maxWeightByDate[dateKey] || w.weight > maxWeightByDate[dateKey].weight) {
            maxWeightByDate[dateKey] = {
                weight: w.weight,
                set: w.setNumber || 1,
                reps: w.reps,
                dateObj: new Date(w.date) // Keep date object for sorting if needed, though input is already sorted
            };
        }
    });

    // Dataset 1: Max Weight per Day (Line)
    const maxDataPoints = Object.entries(maxWeightByDate).map(([date, data]) => ({
        x: date,
        y: data.weight,
        set: data.set,
        reps: data.reps
    }));

    // Dataset 2: All Sets (Scatter)
    const allSetsPoints = exerciseData.map(w => ({
        x: new Date(w.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        y: w.weight,
        set: w.setNumber || 1,
        reps: w.reps
    }));

    // Extract unique labels for X-axis to maintain order
    const labels = [...new Set(allSetsPoints.map(dp => dp.x))];

    if (chartInstance) {
        chartInstance.destroy();
    }

    const themeColors = getThemeChartColors();

    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, themeColors.fill);
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Daily Max (lbs)',
                    data: maxDataPoints,
                    borderColor: themeColors.primary,
                    backgroundColor: gradient,
                    borderWidth: 2,
                    pointBackgroundColor: themeColors.primary,
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: themeColors.primary,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    order: 1
                },
                {
                    label: 'All Sets',
                    data: allSetsPoints,
                    type: 'scatter',
                    backgroundColor: themeColors.secondary,
                    borderColor: themeColors.secondary,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    order: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: themeColors.text }
                },
                tooltip: {
                    callbacks: {
                        afterLabel: function (context) {
                            const point = context.raw;
                            return `Set ${point.set} | ${point.reps} Reps`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    grid: { color: themeColors.grid },
                    ticks: { color: themeColors.text }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: themeColors.text }
                }
            }
        }
    });
}

// Old chart logic replaced by renderCalendar below

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    const picker = document.getElementById('calendar-month-picker');
    if (!grid || !picker) return;

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    // Update Picker Value (YYYY-MM)
    const monthStr = (month + 1).toString().padStart(2, '0');
    picker.value = `${year}-${monthStr}`;

    grid.innerHTML = '';

    // First day of month
    const firstDay = new Date(year, month, 1);
    // Last day of month
    const lastDay = new Date(year, month + 1, 0);

    // Days in previous month to pad (Start Sunday)
    const paddingDays = firstDay.getDay();

    // Group intensity by date string (local)
    const intensityMap = {};
    workouts.forEach(w => {
        const d = new Date(w.date);
        // We need local date string YYYY-MM-DD to match
        // Note: w.date is ISO. 
        // Let's rely on standard YYYY-M-D comparison
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        if (!intensityMap[key]) intensityMap[key] = { sum: 0, count: 0 };
        intensityMap[key].sum += (w.intensity || 0);
        intensityMap[key].count++;
    });

    // Padding
    for (let i = 0; i < paddingDays; i++) {
        const div = document.createElement('div');
        div.className = 'calendar-day empty';
        grid.appendChild(div);
    }

    // Days
    for (let i = 1; i <= lastDay.getDate(); i++) {
        const div = document.createElement('div');
        div.className = 'calendar-day';

        const dateKey = `${year}-${month}-${i}`;
        const data = intensityMap[dateKey];

        div.innerHTML = `<span class="day-num">${i}</span>`;

        if (data) {
            const avg = (data.sum / data.count).toFixed(1);
            const color = getIntensityColor(parseFloat(avg));
            div.style.background = color + '40'; // 40 hex is ~25% opacity
            div.style.borderColor = color;
            div.style.color = '#fff';
            div.classList.add('has-data');
            // Added fire icon
            div.innerHTML += `
                <div class="intensity-val" style="display: flex; align-items: center; gap: 2px;">
                    <i class="fa-solid fa-fire" style="font-size: 0.6rem;"></i> ${avg}
                </div>`;
            div.title = `Average Intensity: ${avg}`;
        }

        grid.appendChild(div);
    }
}

// Helpers
function getIntensityColor(level) {
    if (level >= 8) return '#ef4444'; // Red
    if (level >= 5) return '#f59e0b'; // Orange
    return '#10b981'; // Green
}

function toTitleCase(str) {
    return str.replace(/\w\S*/g, function (txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

function exportWorkouts() {
    const dataStr = JSON.stringify(buildExportPayload(), null, 2);
    const filename = `workouts_${new Date().toISOString().split('T')[0]}.json`;
    if (NATIVE) {
        writeNativeFile(filename, dataStr)
            .then(() => alert(`Exported to Files → On My iPhone → FitTrack → ${filename}`))
            .catch((err) => alert('Export failed: ' + err));
        return;
    }
    downloadJson(dataStr, filename);
}

function importWorkouts(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const parsed = JSON.parse(e.target.result);

            // Support both the legacy array format and the new { workouts, runs, dayNotes } object
            const importedWorkouts = Array.isArray(parsed) ? parsed : parsed.workouts;
            const importedDayNotes = (!Array.isArray(parsed) && Array.isArray(parsed.dayNotes)) ? parsed.dayNotes : [];
            const importedRuns = (!Array.isArray(parsed) && Array.isArray(parsed.runs)) ? parsed.runs : [];

            if (!Array.isArray(importedWorkouts)) throw new Error('Invalid format');

            // Merge workouts: filter out duplicates based on ID
            const existingIds = new Set(workouts.map(w => w.id));
            const newWorkouts = importedWorkouts.filter(w => !existingIds.has(w.id));

            // Merge runs the same way
            const existingRunIds = new Set(runs.map(r => r.id));
            const newRuns = importedRuns.filter(r => !existingRunIds.has(r.id));

            // Merge day notes: imported notes overwrite by date
            const newDayNotes = importedDayNotes.filter(n => n && n.date && n.note);
            newDayNotes.forEach(n => { dayNotes[n.date] = n.note; });

            if (newWorkouts.length === 0 && newRuns.length === 0 && newDayNotes.length === 0) {
                alert('No new data found to import.');
                event.target.value = '';
                return;
            }

            newWorkouts.forEach(w => workouts.push(w));
            newRuns.forEach(r => runs.push(r));

            const tasks = [];
            if (newWorkouts.length) tasks.push(db.bulkAdd(newWorkouts));
            if (newRuns.length) tasks.push(db.bulkAddRuns(newRuns));
            if (newDayNotes.length) tasks.push(db.bulkAddDayNotes(newDayNotes));

            Promise.all(tasks).then(() => {
                sortWorkouts();
                sortRuns();
                updateUI();
                updateRunUI();
                updateChartOptions();
                renderCalendar();
                loadSessionNoteForDate();

                const parts = [];
                if (newWorkouts.length) parts.push(`${newWorkouts.length} workouts`);
                if (newRuns.length) parts.push(`${newRuns.length} runs`);
                if (newDayNotes.length) parts.push(`${newDayNotes.length} session notes`);
                alert(`Successfully imported ${parts.join(', ')}.`);
            });
        } catch (err) {
            alert('Error importing file: ' + err.message);
        }
        // Reset input
        event.target.value = '';
    };
    reader.readAsText(file);
}

// ===== Backup & On-Device Snapshot =====

const BACKUP_KEYS = {
    reminder: 'fittrack-backup-reminder',
    filename: 'fittrack-backup-filename',
    lastBackup: 'fittrack-last-backup-iso',
    dismissedDate: 'fittrack-backup-banner-dismissed-date'
};

const backupBanner = document.getElementById('backup-banner');

function buildExportPayload() {
    return {
        workouts,
        runs,
        dayNotes: Object.entries(dayNotes).map(([date, note]) => ({ date, note }))
    };
}

function downloadJson(json, filename) {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function getBackupBaseName() {
    let name = (localStorage.getItem(BACKUP_KEYS.filename) || '').trim();
    name = name.replace(/\.json$/i, '').trim();
    return name || 'fittrack-backup';
}

// Date-stamped: iOS can't let a web app overwrite files in the Files app, so a
// fixed name just piles up "name 2.json" copies. With the date appended there is
// at most one file per day and older backups are easy to spot and delete.
function getBackupFilename() {
    return `${getBackupBaseName()}-${new Date().toLocaleDateString('en-CA')}.json`;
}

function updateBackupFilenamePreview() {
    const preview = document.getElementById('backup-filename-preview');
    if (preview) preview.textContent = getBackupFilename();
}

function isBackupReminderEnabled() {
    const stored = localStorage.getItem(BACKUP_KEYS.reminder);
    return stored === null ? true : stored === 'true';
}

function getLastBackupDateKey() {
    const iso = localStorage.getItem(BACKUP_KEYS.lastBackup);
    return iso ? new Date(iso).toLocaleDateString('en-CA') : null;
}

function markBackedUpToday() {
    localStorage.setItem(BACKUP_KEYS.lastBackup, new Date().toISOString());
}

async function saveLocalSnapshot() {
    try {
        await db.putSnapshot({ id: 'latest', timestamp: Date.now(), data: buildExportPayload() });
    } catch (err) {
        console.error('Snapshot failed:', err);
    }
}

async function runBackup() {
    // Native app: backups land straight in the Files app, no share sheet —
    // the button just forces one immediately.
    if (NATIVE) {
        const ok = await runNativeBackup();
        alert(ok
            ? `Backed up to Files → On My iPhone → FitTrack → ${getBackupFilename()}`
            : 'Backup failed — please try again.');
        return ok;
    }

    const json = JSON.stringify(buildExportPayload(), null, 2);
    const filename = getBackupFilename();

    // Keep the on-device snapshot in sync with each backup
    await saveLocalSnapshot();

    const file = new File([json], filename, { type: 'application/json' });

    let handled = false;
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({ files: [file], title: 'FitTrack Backup', text: 'FitTrack workout backup' });
            handled = true;
        } catch (err) {
            if (err && err.name === 'AbortError') {
                return false; // user cancelled the share — don't mark as backed up
            }
            // otherwise fall through to a normal download
        }
    }

    if (!handled) {
        downloadJson(json, filename);
    }

    markBackedUpToday();
    hideBackupBanner();
    updateBackupStatusUI();
    return true;
}

async function restoreLocalSnapshot() {
    let snap = null;
    try {
        snap = await db.getSnapshot('latest');
    } catch (err) {
        console.error(err);
    }
    if (!snap || !snap.data) {
        alert('No on-device snapshot found yet. Make a backup first.');
        return;
    }

    const when = new Date(snap.timestamp).toLocaleString();
    if (!confirm(`Restore your on-device snapshot from ${when}? Missing workouts and session notes will be added back.`)) {
        return;
    }

    const data = snap.data;
    const importedWorkouts = Array.isArray(data.workouts) ? data.workouts : [];
    const importedRuns = Array.isArray(data.runs) ? data.runs : [];
    const importedDayNotes = Array.isArray(data.dayNotes) ? data.dayNotes : [];

    const existingIds = new Set(workouts.map(w => w.id));
    const newWorkouts = importedWorkouts.filter(w => !existingIds.has(w.id));
    newWorkouts.forEach(w => workouts.push(w));

    const existingRunIds = new Set(runs.map(r => r.id));
    const newRuns = importedRuns.filter(r => !existingRunIds.has(r.id));
    newRuns.forEach(r => runs.push(r));

    const newDayNotes = importedDayNotes.filter(n => n && n.date && n.note);
    newDayNotes.forEach(n => { dayNotes[n.date] = n.note; });

    const tasks = [];
    if (newWorkouts.length) tasks.push(db.bulkAdd(newWorkouts));
    if (newRuns.length) tasks.push(db.bulkAddRuns(newRuns));
    if (newDayNotes.length) tasks.push(db.bulkAddDayNotes(newDayNotes));
    await Promise.all(tasks);

    sortWorkouts();
    sortRuns();
    updateUI();
    updateRunUI();
    updateChartOptions();
    renderCalendar();
    loadSessionNoteForDate();
    updateBackupStatusUI();
    alert(`Restored ${newWorkouts.length} workouts, ${newRuns.length} runs, and ${newDayNotes.length} session notes.`);
}

// --- Smart daily backup banner ---
// Shown every time the app opens (or returns to the foreground) on a day with
// no backup yet. Only the X button silences it, and only until the next day.
function showBackupBanner() {
    if (backupBanner) backupBanner.hidden = false;
}

function hideBackupBanner() {
    if (backupBanner) backupBanner.hidden = true;
}

function maybeShowBackupBanner() {
    if (NATIVE) return; // native app backs up automatically — nothing to nag about
    if (!isBackupReminderEnabled()) return;
    if (workouts.length === 0 && runs.length === 0) return; // nothing to back up yet
    const today = new Date().toLocaleDateString('en-CA');
    if (getLastBackupDateKey() === today) return;      // already backed up today
    if (localStorage.getItem(BACKUP_KEYS.dismissedDate) === today) return; // X'd out today
    showBackupBanner();
}

function dismissBackupBannerForToday() {
    localStorage.setItem(BACKUP_KEYS.dismissedDate, new Date().toLocaleDateString('en-CA'));
    hideBackupBanner();
}

function updateBackupStatusUI() {
    const statusEl = document.getElementById('backup-status');
    if (!statusEl) return;
    const iso = localStorage.getItem(BACKUP_KEYS.lastBackup);
    const when = iso ? new Date(iso).toLocaleString() : 'never';
    statusEl.textContent = NATIVE
        ? `Backs up automatically — last: ${when} → Files › FitTrack`
        : `Last backup: ${when}`;
}

// ===== Native app (Capacitor) auto-backup =====
// The same code base also ships inside a native iOS shell (see PRD.md and
// ~/Desktop/Claudious/fittrack-native). There the Filesystem bridge can write
// files silently, so backups need zero taps: every data change is followed by
// a date-stamped JSON written to the app's Documents folder, which shows up
// in the Files app under On My iPhone → FitTrack. In the browser/PWA, NATIVE
// is false and all of this is inert.

const NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform
    && window.Capacitor.isNativePlatform());
const NATIVE_BACKUPS_KEPT = 30; // dated files kept before pruning the oldest
let nativeBackupTimer = null;
let nativeBackupDirty = false;

function writeNativeFile(path, data) {
    return window.Capacitor.Plugins.Filesystem.writeFile({
        path,
        data,
        directory: 'DOCUMENTS',
        encoding: 'utf8'
    });
}

function initNativeBackup() {
    if (!NATIVE) return;

    // Wrapping db's mutating methods catches every write path — saves,
    // deletes, imports, renames, restores — now and in future features.
    // The clear* methods are deliberately excluded: after Clear All Data the
    // 'before-clear' safety file must remain the freshest copy of the data.
    [
        'addWorkout', 'deleteWorkout', 'bulkAdd', 'bulkDelete',
        'putDayNote', 'deleteDayNote', 'bulkAddDayNotes',
        'addRun', 'deleteRun', 'bulkAddRuns', 'bulkDeleteRuns'
    ].forEach((name) => {
        const original = db[name].bind(db);
        db[name] = async (...args) => {
            const result = await original(...args);
            scheduleNativeBackup();
            return result;
        };
    });

    // Flush a pending backup when the app is backgrounded, and catch up on a
    // new day's file when it returns to the foreground.
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && nativeBackupDirty) {
            runNativeBackup();
        } else if (document.visibilityState === 'visible') {
            nativeDailyCatchUp();
        }
    });
    // Give loadWorkouts a moment to populate state, then do the daily check.
    setTimeout(nativeDailyCatchUp, 3000);

    // Settings copy: reminders don't exist natively and the destination is
    // fixed, so hide the reminder toggle and retarget the hint text.
    const reminderLabel = document.querySelector('label[for="backup-reminder-toggle"]');
    if (reminderLabel) reminderLabel.hidden = true;
    const destinationHint = document.getElementById('backup-destination-hint');
    if (destinationHint) {
        destinationHint.textContent = 'Backups happen automatically after every change and land in '
            + 'the Files app under On My iPhone → FitTrack. The newest '
            + NATIVE_BACKUPS_KEPT + ' days are kept.';
    }
    updateBackupStatusUI();
}

function scheduleNativeBackup() {
    if (!NATIVE) return;
    nativeBackupDirty = true;
    clearTimeout(nativeBackupTimer);
    nativeBackupTimer = setTimeout(runNativeBackup, 4000);
}

// A backup only matters when data changed, and data only changes while the
// app is open — so "daily" means: the first use of the app each day writes
// that day's file, even if the last change happened just before midnight.
function nativeDailyCatchUp() {
    if (!NATIVE) return;
    if (workouts.length === 0 && runs.length === 0) return; // nothing to back up
    const today = new Date().toLocaleDateString('en-CA');
    if (getLastBackupDateKey() !== today) runNativeBackup();
}

async function runNativeBackup() {
    if (!NATIVE) return false;
    clearTimeout(nativeBackupTimer);
    nativeBackupDirty = false;
    try {
        const json = JSON.stringify(buildExportPayload(), null, 2);
        await writeNativeFile(getBackupFilename(), json);
        await saveLocalSnapshot(); // keep the fast in-app restore point in sync
        markBackedUpToday();
        updateBackupStatusUI();
        pruneNativeBackups().catch(() => {});
        return true;
    } catch (err) {
        console.error('Auto-backup failed:', err);
        nativeBackupDirty = true; // retry on the next change/foreground
        return false;
    }
}

// Written right before destructive actions, with a full timestamp so the
// daily backup never overwrites it and the pruner (which only touches
// date-suffixed files) never deletes it.
async function writeNativeSafetyBackup(reason) {
    if (!NATIVE) return;
    if (workouts.length === 0 && runs.length === 0) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    try {
        await writeNativeFile(
            `${getBackupBaseName()}-${reason}-${stamp}.json`,
            JSON.stringify(buildExportPayload(), null, 2)
        );
    } catch (err) {
        console.error('Safety backup failed:', err);
    }
}

async function pruneNativeBackups() {
    const result = await window.Capacitor.Plugins.Filesystem.readdir({
        path: '',
        directory: 'DOCUMENTS'
    });
    const names = (result.files || []).map((f) => (typeof f === 'string' ? f : f.name));
    // Only daily date-suffixed files are pruned (the YYYY-MM-DD suffix sorts
    // chronologically); safety backups and exports are left alone.
    const dated = names.filter((n) => /-\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort();
    const excess = dated.slice(0, Math.max(0, dated.length - NATIVE_BACKUPS_KEPT));
    for (const name of excess) {
        await window.Capacitor.Plugins.Filesystem.deleteFile({ path: name, directory: 'DOCUMENTS' });
    }
}

function requestPersistentStorage() {
    if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persist().catch(() => {});
    }
}

// Emergency recovery for a stuck/stale PWA: clears Cache Storage and unregisters
// service workers, then reloads. Deliberately does NOT touch localStorage or
// IndexedDB, so workouts, notes, and settings are preserved.
async function resetPwaCacheOnly() {
    if (!confirm('Reload the app and clear its cached files?\n\nThis fixes stuck updates / refresh-crash issues. Your workouts, notes, and settings are kept.')) {
        return;
    }
    try {
        if (window.caches) {
            const keys = await caches.keys();
            await Promise.all(keys.map((key) => caches.delete(key)));
        }
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map((reg) => reg.unregister()));
        }
    } catch (err) {
        console.error('Cache reset failed:', err);
    }
    window.location.reload();
}

function initBackup() {
    const reminderToggle = document.getElementById('backup-reminder-toggle');
    const filenameInput = document.getElementById('backup-filename');
    const backupNowBtn = document.getElementById('backup-now');
    const restoreBtn = document.getElementById('restore-snapshot');
    const bannerSave = document.getElementById('backup-banner-save');
    const bannerDismiss = document.getElementById('backup-banner-dismiss');

    if (reminderToggle) {
        reminderToggle.checked = isBackupReminderEnabled();
        reminderToggle.addEventListener('change', () => {
            localStorage.setItem(BACKUP_KEYS.reminder, reminderToggle.checked ? 'true' : 'false');
            if (!reminderToggle.checked) hideBackupBanner();
        });
    }

    if (filenameInput) {
        filenameInput.value = getBackupBaseName();
        filenameInput.addEventListener('change', () => {
            localStorage.setItem(BACKUP_KEYS.filename, filenameInput.value.trim());
            filenameInput.value = getBackupBaseName(); // normalize (default, no .json)
            updateBackupFilenamePreview();
        });
    }

    const resetCacheBtn = document.getElementById('reset-cache');

    if (backupNowBtn) backupNowBtn.addEventListener('click', runBackup);
    if (restoreBtn) restoreBtn.addEventListener('click', restoreLocalSnapshot);
    if (bannerSave) bannerSave.addEventListener('click', runBackup);
    if (bannerDismiss) bannerDismiss.addEventListener('click', dismissBackupBannerForToday);
    if (resetCacheBtn) resetCacheBtn.addEventListener('click', resetPwaCacheOnly);

    // iOS home-screen apps usually resume from memory instead of reloading, so
    // re-check when the app returns to the foreground (also catches the day
    // rolling over while the app stays open)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') maybeShowBackupBanner();
    });

    updateBackupStatusUI();
    updateBackupFilenamePreview();
}

// ===== Exercise Management: rename + statistics (Settings) =====

function initExerciseManagement() {
    const renameBtn = document.getElementById('rename-exercise-btn');
    if (renameBtn) renameBtn.addEventListener('click', renameExercise);
    updateExerciseManagementUI();
}

function updateExerciseManagementUI() {
    renderStats();
    updateRenameOptions();
}

function updateRenameOptions() {
    const select = document.getElementById('rename-exercise-select');
    if (!select) return;

    const current = select.value;
    const names = [...new Set(workouts.map(w => w.exercise))].sort();

    select.innerHTML = '';
    if (names.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'No exercises yet';
        select.appendChild(opt);
        return;
    }
    names.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        select.appendChild(opt);
    });
    if (names.includes(current)) select.value = current;
}

function renderStats() {
    const summary = document.getElementById('stats-summary');
    const breakdown = document.getElementById('stats-breakdown');
    if (!summary || !breakdown) return;

    const totalSets = workouts.length;
    const byExercise = {};
    workouts.forEach(w => {
        if (!byExercise[w.exercise]) byExercise[w.exercise] = { sets: 0, dates: new Set() };
        byExercise[w.exercise].sets++;
        byExercise[w.exercise].dates.add(localDateKey(w.date));
    });
    const names = Object.keys(byExercise);

    const totalMiles = Math.round(runs.reduce((sum, r) => sum + (r.distanceMiles || 0), 0) * 10) / 10;

    summary.innerHTML = `
        <div class="stat-pill"><span class="stat-num">${totalSets}</span><span class="stat-label">Total sets</span></div>
        <div class="stat-pill"><span class="stat-num">${names.length}</span><span class="stat-label">Exercises</span></div>
        <div class="stat-pill"><span class="stat-num">${runs.length}</span><span class="stat-label">Runs</span></div>
        <div class="stat-pill"><span class="stat-num">${totalMiles}</span><span class="stat-label">Miles run</span></div>
    `;

    if (totalSets === 0) {
        breakdown.innerHTML = '<p class="backup-status">No workouts logged yet.</p>';
        return;
    }

    breakdown.innerHTML = names
        .sort((a, b) => byExercise[b].sets - byExercise[a].sets || a.localeCompare(b))
        .map(name => `
            <div class="stat-row">
                <span class="stat-row-name">${escapeHtml(name)}</span>
                <span class="stat-row-meta">${byExercise[name].sets} sets &middot; ${byExercise[name].dates.size} sessions</span>
            </div>
        `).join('');
}

async function renameExercise() {
    const select = document.getElementById('rename-exercise-select');
    const newInput = document.getElementById('rename-exercise-new');
    if (!select || !newInput) return;

    const oldName = select.value;
    const newName = toTitleCase(newInput.value.trim());

    if (!oldName) { alert('No exercise selected.'); return; }
    if (!newName) { alert('Please enter a new name.'); return; }
    if (newName === oldName) { alert('That is already the name.'); return; }

    const affected = workouts.filter(w => w.exercise === oldName);
    if (affected.length === 0) { alert('No records found for that exercise.'); return; }

    const willMerge = workouts.some(w => w.exercise === newName);
    const message = willMerge
        ? `Rename ${affected.length} set(s) from "${oldName}" to "${newName}"?\n\n"${newName}" already exists, so these will be merged into it.`
        : `Rename ${affected.length} set(s) from "${oldName}" to "${newName}"?`;
    if (!confirm(message)) return;

    affected.forEach(w => { w.exercise = newName; });
    await db.bulkAdd(affected);

    // Renumber sets per affected date under the new name (fixes any merge collisions)
    const dateKeys = [...new Set(affected.map(w => getWorkoutDateKey(w)))];
    for (const dateKey of dateKeys) {
        await normalizeSetNumbers(newName, dateKey);
    }

    if (chartFilter.value === oldName) {
        chartFilter.value = newName;
    }

    sortWorkouts();
    updateUI();
    updateChartOptions();
    if (chartFilter.value) renderChart(chartFilter.value);
    renderCalendar();

    newInput.value = '';
    alert(`Renamed "${oldName}" to "${newName}".`);
}

// ===== Running Tracker =====

function sortRuns() {
    runs.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        if (dateA.getTime() !== dateB.getTime()) return dateB - dateA;
        return b.id - a.id; // newest first within a date
    });
}

function runPaceSeconds(run) {
    return run.durationSeconds / run.distanceMiles;
}

// Seconds-per-mile -> "9:32"
function formatPace(secPerMile) {
    if (!isFinite(secPerMile) || secPerMile <= 0) return '—';
    let minutes = Math.floor(secPerMile / 60);
    let seconds = Math.round(secPerMile % 60);
    if (seconds === 60) { minutes += 1; seconds = 0; }
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// Total seconds -> "28:45", or "1:15:30" once it crosses an hour
function formatDuration(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.round(totalSeconds % 60);
    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function readRunTimeSeconds() {
    const hours = parseInt(document.getElementById('run-hours').value) || 0;
    const minutes = parseInt(document.getElementById('run-minutes').value) || 0;
    const seconds = parseInt(document.getElementById('run-seconds').value) || 0;
    return hours * 3600 + minutes * 60 + seconds;
}

function updatePacePreview() {
    const preview = document.getElementById('run-pace-preview');
    if (!preview) return;
    const distance = parseFloat(document.getElementById('run-distance').value);
    const total = readRunTimeSeconds();

    preview.textContent = (distance > 0 && total > 0)
        ? `${formatPace(total / distance)} /mi`
        : '— /mi';
}

function updateRunUI() {
    renderRecentRuns();
    renderPaceChart();
    renderStats();
}

function initRunTracker() {
    const runForm = document.getElementById('run-form');
    if (!runForm) return;

    ['run-distance', 'run-hours', 'run-minutes', 'run-seconds'].forEach(id => {
        const input = document.getElementById(id);
        if (input) input.addEventListener('input', updatePacePreview);
    });

    runForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const dateStr = document.getElementById('run-date').value;
        const distance = parseFloat(document.getElementById('run-distance').value);
        const durationSeconds = readRunTimeSeconds();

        if (!dateStr || !(distance > 0) || durationSeconds <= 0) {
            alert('Please enter the distance and how long the run took.');
            return;
        }

        const run = {
            id: Date.now(),
            distanceMiles: distance,
            durationSeconds: durationSeconds,
            date: new Date(dateStr + 'T12:00:00').toISOString()
        };

        runs.push(run);
        db.addRun(run).catch(err => console.error(err));

        sortRuns();
        updateRunUI();
        updateSummary();
        renderHistory();

        // Clear for the next entry (date stays put)
        document.getElementById('run-distance').value = '';
        document.getElementById('run-hours').value = '';
        document.getElementById('run-minutes').value = '';
        document.getElementById('run-seconds').value = '';
        updatePacePreview();
    });
}

window.deleteRun = function (id) {
    if (!confirm('Delete this run?')) return;
    runs = runs.filter(r => r.id !== id);
    db.deleteRun(id).then(() => {
        updateRunUI();
        updateSummary();
        renderHistory();
    });
};

function renderRecentRuns() {
    const list = document.getElementById('recent-runs-list');
    if (!list) return;

    if (runs.length === 0) {
        list.innerHTML = '<p style="color: var(--text-secondary); font-style: italic;">No runs logged yet.</p>';
        return;
    }

    list.innerHTML = runs.slice(0, 5).map(run => `
        <div class="run-item">
            <div class="run-item-main">
                <span class="run-item-date">${new Date(run.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                <span><i class="fa-solid fa-route"></i> ${run.distanceMiles} mi</span>
                <span><i class="fa-solid fa-stopwatch"></i> ${formatDuration(run.durationSeconds)}</span>
            </div>
            <div class="run-item-meta">
                <span class="run-pace">${formatPace(runPaceSeconds(run))} /mi</span>
                <button class="delete-btn" onclick="deleteRun(${run.id})" title="Delete Run">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function renderPaceChart() {
    const section = document.getElementById('running-analytics');
    const canvas = document.getElementById('paceChart');
    if (!section || !canvas) return;

    section.hidden = runs.length === 0;
    if (runs.length === 0) {
        if (paceChartInstance) {
            paceChartInstance.destroy();
            paceChartInstance = null;
        }
        return;
    }

    // One point per day (oldest -> newest): average pace across that day's runs
    const byDay = {};
    const dayOrder = [];
    [...runs].sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(run => {
        const key = localDateKey(run.date);
        if (!byDay[key]) {
            byDay[key] = { miles: 0, seconds: 0, date: new Date(run.date) };
            dayOrder.push(key);
        }
        byDay[key].miles += run.distanceMiles;
        byDay[key].seconds += run.durationSeconds;
    });

    const labels = [];
    const points = [];
    dayOrder.forEach(key => {
        const day = byDay[key];
        const label = day.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        labels.push(label);
        points.push({
            x: label,
            y: day.seconds / day.miles,
            miles: Math.round(day.miles * 100) / 100,
            seconds: day.seconds
        });
    });

    const latest = points[points.length - 1];
    const summaryEl = document.getElementById('pace-summary');
    if (summaryEl) summaryEl.innerHTML = `Latest: <strong>${formatPace(latest.y)} /mi</strong>`;

    if (paceChartInstance) {
        paceChartInstance.destroy();
    }

    const themeColors = getThemeChartColors();
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, themeColors.fill);
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

    paceChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Avg Pace (min/mi) — lower is faster',
                data: points,
                borderColor: themeColors.primary,
                backgroundColor: gradient,
                borderWidth: 2,
                pointBackgroundColor: themeColors.primary,
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: themeColors.primary,
                fill: true,
                tension: 0.3,
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: themeColors.text }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => ` ${formatPace(context.raw.y)} /mi`,
                        afterLabel: (context) => `${context.raw.miles} mi in ${formatDuration(context.raw.seconds)}`
                    }
                }
            },
            scales: {
                y: {
                    grid: { color: themeColors.grid },
                    ticks: {
                        color: themeColors.text,
                        callback: (value) => formatPace(value)
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: themeColors.text }
                }
            }
        }
    });
}

// Combobox Functions
function showDropdown(dropdown) {
    if (dropdown) dropdown.classList.add('show');
}

function hideDropdown(dropdown) {
    if (dropdown) dropdown.classList.remove('show');
}

function hideAllDropdowns() {
    hideDropdown(exerciseDropdown);
    hideDropdown(supersetExerciseDropdown);
    hideDropdown(chartFilterDropdown);
}

function filterExercises(query, input, dropdown, onSelect) {
    if (!input || !dropdown) return;

    const exercises = [...new Set(workouts.map(w => w.exercise))].sort();
    if (input === chartFilter && chartFilter.value === '') {
        input.placeholder = 'Select Exercise';
    }

    const filtered = exercises.filter(ex => ex.toLowerCase().includes(query.toLowerCase()));

    dropdown.innerHTML = '';

    if (filtered.length === 0) {
        if (query) {
            const item = document.createElement('li');
            item.className = 'combobox-item no-results';
            item.textContent = 'No matching exercises';
            dropdown.appendChild(item);
        } else if (input === chartFilter) {
            const item = document.createElement('li');
            item.className = 'combobox-item no-results';
            item.textContent = 'No exercises yet';
            dropdown.appendChild(item);
        } else {
            // Show all if empty query
            exercises.forEach(ex => createDropdownItem(ex, input, dropdown, onSelect));
        }
    } else {
        filtered.forEach(ex => createDropdownItem(ex, input, dropdown, onSelect));
    }
}

function createDropdownItem(text, input, dropdown, onSelect) {
    const item = document.createElement('li');
    item.className = 'combobox-item';
    item.textContent = text;
    item.addEventListener('click', () => {
        input.value = text;
        hideDropdown(dropdown);
        if (onSelect) onSelect();
        if (input === chartFilter) {
            chartFilter.placeholder = text;
        }
    });
    dropdown.appendChild(item);
}
