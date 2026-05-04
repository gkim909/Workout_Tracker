// State Management
let workouts = [];
let chartInstance = null;
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
const totalWorkoutsEl = document.getElementById('total-workouts'); // Kept if needed, but unused now
const totalVolumeEl = document.getElementById('total-volume'); // Kept if needed, but unused now
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

// Combobox Elements
const exerciseInput = document.getElementById('exercise');
const exerciseToggle = document.getElementById('exercise-toggle');
const exerciseDropdown = document.getElementById('exercise-dropdown');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initThemeSwitcher();

    // Set default date to today (Local Time)
    const today = new Date();
    // en-CA locale formats as YYYY-MM-DD which matches input type="date"
    const localDate = today.toLocaleDateString('en-CA');
    dateInput.value = localDate;

    // Initialize DB and load workouts
    loadWorkouts();
});

function initThemeSwitcher() {
    if (!themeSelect) return;

    const savedThemeRaw = localStorage.getItem('fittrack-ui-theme') || 'neumorphism';
    const savedTheme = savedThemeRaw === 'glassmorphism' ? 'glacial-flux' : savedThemeRaw;
    applyTheme(savedTheme);
    themeSelect.value = savedTheme;

    themeSelect.addEventListener('change', (e) => {
        applyTheme(e.target.value);
        localStorage.setItem('fittrack-ui-theme', e.target.value);

        if (chartFilter.value) {
            renderChart(chartFilter.value);
        }
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
});

clearHistoryBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all workout history? This cannot be undone.')) {
        workouts = [];
        db.clearStore().then(() => {
            updateUI();
            if (chartInstance) {
                chartInstance.destroy();
                chartInstance = null;
            }
            if (intensityChartInstance) {
                intensityChartInstance = null;
            }
            renderCalendar();
            updateChartOptions();
            updateSetIndicator();
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
});

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
    if (confirm(`Delete all workouts for ${dateKey}?`)) {
        // Find workouts to delete
        const toDelete = workouts.filter(w => {
            const wDateKey = new Date(w.date).toLocaleDateString(undefined, {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            });
            return wDateKey === dateKey;
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
    } else if (id === 'weight') {
        if (val < 0) val = 0;
    }

    input.value = val;
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
        sortWorkouts();
        sortWorkouts();
        updateUI();
        updateChartOptions();
        renderCalendar();

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
}

function getSupersetGroups(workoutList) {
    const groups = {};
    workoutList.forEach(w => {
        if (!w.supersetId) return;
        if (!groups[w.supersetId]) groups[w.supersetId] = [];
        groups[w.supersetId].push(w);
    });

    return Object.values(groups)
        .map(group => group.sort((a, b) => (a.supersetOrder || 0) - (b.supersetOrder || 0)))
        .sort((a, b) => Math.max(...b.map(w => w.id)) - Math.max(...a.map(w => w.id)));
}

function getSupersetGroupTitle(group) {
    const round = group[0].supersetRound || '?';
    return group[0].supersetLabel || `Superset ${round}`;
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

    const supersetGroups = getSupersetGroups(todaysWorkouts);
    const normalWorkouts = todaysWorkouts.filter(w => !w.supersetId);

    supersetGroups.forEach(groupWorkouts => {
        const supersetGroup = document.createElement('div');
        supersetGroup.className = 'superset-history-group';

        supersetGroup.innerHTML = `
            <div class="superset-history-header">
                <span><i class="fa-solid fa-link"></i> ${getSupersetGroupTitle(groupWorkouts)}</span>
                <small>Round ${groupWorkouts[0].supersetRound || '?'}</small>
            </div>
        `;

        groupWorkouts.forEach(w => {
            const item = document.createElement('div');
            item.className = 'superset-history-item';
            const wIntColor = getIntensityColor(w.intensity);

            item.innerHTML = `
                <div class="superset-set-main">
                    <span class="superset-exercise-name">${w.exercise}</span>
                    <span style="font-weight: 600; color: var(--accent-primary);">Set ${w.setNumber || '?'}</span>
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
            supersetGroup.appendChild(item);
        });

        list.appendChild(supersetGroup);
    });

    // Group regular sets by Exercise
    const grouped = {};
    normalWorkouts.forEach(w => {
        if (!grouped[w.exercise]) grouped[w.exercise] = [];
        grouped[w.exercise].push(w);
    });

    // Calculate Day's Average Intensity
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

    Object.keys(grouped).forEach(ex => {
        const group = document.createElement('div');
        group.style.marginBottom = '10px';

        // Exercise Avg
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

    let html = '<table style="width: 100%; text-align: left; border-collapse: collapse;">';
    html += '<thead><tr><th style="padding-bottom: 5px; color: var(--accent-secondary);">Date</th><th style="color: var(--accent-secondary);">Set</th><th style="color: var(--accent-secondary);">Reps</th><th style="color: var(--accent-secondary);">Lbs</th><th style="color: var(--accent-secondary);">Int.</th></tr></thead><tbody>';

    last5.forEach(w => {
        const date = new Date(w.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const intensityValue = Number(w.intensity || 0).toFixed(1);
        const intensityColor = getIntensityColor(Number(w.intensity || 0));
        html += `
            <tr style="border-top: 1px solid rgba(255,255,255,0.1);">
                <td style="padding: 4px 0;">${date}</td>
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
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

function renderHistory() {
    historyList.innerHTML = '';

    if (workouts.length === 0) {
        historyList.innerHTML = `
            <div class="empty-state">
                <p>No workouts logged yet. Start training!</p>
            </div>
        `;
        return;
    }

    // Group by Date
    const groupedByDate = {};
    workouts.forEach(workout => {
        const dateKey = new Date(workout.date).toLocaleDateString(undefined, {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
        groupedByDate[dateKey].push(workout);
    });

    Object.keys(groupedByDate).forEach(date => {
        const dateGroup = document.createElement('div');
        dateGroup.className = 'history-date-group';

        const dateHeader = document.createElement('div');
        dateHeader.className = 'history-date-header';
        dateHeader.style.display = 'flex';
        dateHeader.style.justifyContent = 'space-between';
        dateHeader.style.alignItems = 'center';

        // Calculate Average Intensity for Date
        const totalIntensity = groupedByDate[date].reduce((sum, w) => sum + (w.intensity || 0), 0);
        const avgIntensity = (totalIntensity / groupedByDate[date].length).toFixed(1);
        const avgColor = getIntensityColor(parseFloat(avgIntensity));

        dateHeader.innerHTML = `
            <span>${date}</span>
            <div style="display: flex; align-items: center; gap: 15px;">
                <span style="font-size: 0.8rem; font-weight: 600; color: ${avgColor}; display: flex; align-items: center; gap: 4px;">
                    <i class="fa-solid fa-fire"></i> ${avgIntensity}
                </span>
                <button class="delete-btn" onclick="deleteDateGroup('${date}')" title="Delete All for Date">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
        dateGroup.appendChild(dateHeader);

        const supersetGroups = getSupersetGroups(groupedByDate[date]);
        supersetGroups.forEach(groupWorkouts => {
            const supersetGroup = document.createElement('div');
            supersetGroup.className = 'history-exercise-group superset-history-group';

            const supersetHeader = document.createElement('div');
            supersetHeader.className = 'history-exercise-header superset-history-header';
            supersetHeader.innerHTML = `
                <h4><i class="fa-solid fa-link"></i> ${getSupersetGroupTitle(groupWorkouts)}</h4>
                <span style="font-size: 0.8rem; color: var(--text-secondary);">Round ${groupWorkouts[0].supersetRound || '?'}</span>
            `;
            supersetGroup.appendChild(supersetHeader);

            const setList = document.createElement('div');
            setList.className = 'history-set-list';

            groupWorkouts.forEach(workout => {
                const setItem = document.createElement('div');
                setItem.className = 'history-set-item superset-history-item';
                setItem.innerHTML = `
                    <div class="set-details">
                        <span style="min-width: 110px; font-weight: 600; color: var(--text-primary);">
                            ${workout.exercise}
                        </span>
                        <span style="font-weight: 600; color: var(--accent-primary);">Set ${workout.setNumber || 1}</span>
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
            });

            supersetGroup.appendChild(setList);
            dateGroup.appendChild(supersetGroup);
        });

        // Group regular sets by Exercise within Date
        const exercisesInDate = {};
        groupedByDate[date].filter(workout => !workout.supersetId).forEach(workout => {
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
            });

            exerciseGroup.appendChild(setList);
            dateGroup.appendChild(exerciseGroup);
        });

        historyList.appendChild(dateGroup);
    });
}


function updateSummary() {
    const streaks = calculateStreaks();
    longestStreakEl.textContent = `${streaks.longest} Days`;
    currentStreakEl.textContent = `${streaks.current} Days`;

    if (workouts.length > 0) {
        // Sort by date descending to get the latest
        const sortedByDate = [...workouts].sort((a, b) => new Date(b.date) - new Date(a.date));
        const lastDate = new Date(sortedByDate[0].date);
        lastWorkoutDateEl.textContent = lastDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } else {
        lastWorkoutDateEl.textContent = 'Never';
    }
}

function calculateStreaks() {
    if (workouts.length === 0) return { current: 0, longest: 0 };

    // Get unique dates, sorted ascending
    const uniqueDates = [...new Set(workouts.map(w => new Date(w.date).toISOString().split('T')[0]))].sort();

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

function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function toTitleCase(str) {
    return str.replace(/\w\S*/g, function (txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

function exportWorkouts() {
    const dataStr = JSON.stringify(workouts, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `workouts_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importWorkouts(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const importedWorkouts = JSON.parse(e.target.result);
            if (!Array.isArray(importedWorkouts)) throw new Error('Invalid format');

            // Merge strategy: Filter out duplicates based on ID
            const existingIds = new Set(workouts.map(w => w.id));
            let addedCount = 0;

            importedWorkouts.forEach(w => {
                if (!existingIds.has(w.id)) {
                    workouts.push(w);
                    addedCount++;
                }
            });

            if (addedCount > 0) {
                // Add new workouts to DB
                const newWorkouts = importedWorkouts.filter(w => !existingIds.has(w.id));
                db.bulkAdd(newWorkouts).then(() => {
                    sortWorkouts();
                    updateUI();
                    updateChartOptions();
                    alert(`Successfully imported ${addedCount} workouts.`);
                });
            } else {
                alert('No new workouts found to import.');
            }
        } catch (err) {
            alert('Error importing file: ' + err.message);
        }
        // Reset input
        event.target.value = '';
    };
    reader.readAsText(file);
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
