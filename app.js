// State Management
let workouts = [];
let chartInstance = null;

// DOM Elements
const workoutForm = document.getElementById('workout-form');
const historyList = document.getElementById('history-list');
const clearHistoryBtn = document.getElementById('clear-history');
const chartFilter = document.getElementById('chart-filter');
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

// Combobox Elements
const exerciseInput = document.getElementById('exercise');
const exerciseToggle = document.getElementById('exercise-toggle');
const exerciseDropdown = document.getElementById('exercise-dropdown');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    // Set default date to today (Local Time)
    const today = new Date();
    // en-CA locale formats as YYYY-MM-DD which matches input type="date"
    const localDate = today.toLocaleDateString('en-CA');
    dateInput.value = localDate;

    // Initialize DB and load workouts
    loadWorkouts();
});

// Event Listeners
workoutForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const exerciseRaw = document.getElementById('exercise').value.trim();
    const exercise = toTitleCase(exerciseRaw);
    const dateStr = document.getElementById('workout-date').value;

    const newWorkout = {
        id: Date.now(),
        exercise: exercise,
        setNumber: getNextSetNumber(exercise, dateStr),
        reps: parseInt(document.getElementById('reps').value),
        weight: parseFloat(document.getElementById('weight').value),
        intensity: parseInt(document.getElementById('intensity').value),
        date: new Date(dateStr + 'T12:00:00').toISOString()
    };

    workouts.push(newWorkout);
    db.addWorkout(newWorkout).then(() => {
        console.log('Workout added to DB');
    }).catch(err => console.error(err));

    sortWorkouts();
    updateUI();

    // Update chart if currently viewing this exercise or if it's the first one
    if (chartFilter.value === newWorkout.exercise || chartFilter.value === "") {
        chartFilter.value = newWorkout.exercise;
        renderChart(newWorkout.exercise);
    }
    updateChartOptions();

    updateSetIndicator(); // Update for next set
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
            updateChartOptions();
            updateSetIndicator();
        });
    }
});

chartFilter.addEventListener('change', (e) => {
    renderChart(e.target.value);
});

// Import/Export Handlers
exportBtn.addEventListener('click', exportWorkouts);
importBtn.addEventListener('click', () => importFile.click());
importFile.addEventListener('change', importWorkouts);

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
    filterExercises(e.target.value);
    showDropdown();
});

exerciseInput.addEventListener('focus', () => {
    filterExercises(exerciseInput.value);
    showDropdown();
});

exerciseToggle.addEventListener('click', (e) => {
    e.preventDefault(); // Prevent form submission if inside form
    if (exerciseDropdown.classList.contains('show')) {
        hideDropdown();
    } else {
        filterExercises(''); // Show all
        showDropdown();
        exerciseInput.focus();
    }
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.combobox-wrapper')) {
        hideDropdown();
    }
});

document.getElementById('workout-date').addEventListener('change', () => {
    updateSetIndicator();
    renderTodaysHistory();
});

// Delete Workout
window.deleteWorkout = function (id) {
    if (confirm('Delete this set?')) {
        workouts = workouts.filter(w => w.id !== id);
        db.deleteWorkout(id).then(() => {
            updateUI();
            updateSetIndicator();

            // Update chart if needed
            if (chartFilter.value) {
                renderChart(chartFilter.value);
            }
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
        updateUI();
        updateChartOptions();

        // Default chart view if data exists
        if (workouts.length > 0 && !chartFilter.value) {
            const lastExercise = workouts[0].exercise;
            chartFilter.value = lastExercise;
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

function getNextSetNumber(exercise, dateStr) {
    // Find existing sets for this exercise on this date
    // Note: dateStr is YYYY-MM-DD from input
    const existingSets = workouts.filter(w => {
        const wDate = new Date(w.date).toISOString().split('T')[0];
        return w.exercise === exercise && wDate === dateStr;
    });
    return existingSets.length + 1;
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

function updateUI() {
    renderHistory();
    updateSummary();
    renderTodaysHistory();
    renderExerciseHistory();
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
        // Sort by time added (id) or set number
        return a.id - b.id;
    });

    if (todaysWorkouts.length === 0) {
        list.innerHTML = '<p style="color: var(--text-secondary); font-style: italic;">No workouts logged for this date.</p>';
        return;
    }

    // Group by Exercise
    const grouped = {};
    todaysWorkouts.forEach(w => {
        if (!grouped[w.exercise]) grouped[w.exercise] = [];
        grouped[w.exercise].push(w);
    });

    Object.keys(grouped).forEach(ex => {
        const group = document.createElement('div');
        group.style.marginBottom = '10px';
        group.innerHTML = `<h4 style="color: var(--accent-primary); font-size: 0.9rem; margin-bottom: 5px;">${ex}</h4>`;

        grouped[ex].forEach(w => {
            const item = document.createElement('div');
            item.style.display = 'flex';
            item.style.justifyContent = 'space-between';
            item.style.padding = '5px 10px';
            item.style.background = 'rgba(255,255,255,0.05)';
            item.style.marginBottom = '2px';
            item.style.borderRadius = '4px';
            item.style.fontSize = '0.85rem';
            item.innerHTML = `
                <span>Set ${w.setNumber || '?'}</span>
                <span>${w.reps} x ${w.weight} lbs</span>
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

    if (!container) return;

    if (!exercise) {
        container.style.display = 'none';
        return;
    }

    // Filter workouts for this exercise
    const history = workouts
        .filter(w => w.exercise === exercise)
        .sort((a, b) => new Date(b.date) - new Date(a.date)); // Descending date

    if (history.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    const last5 = history.slice(0, 5);

    let html = '<table style="width: 100%; text-align: left; border-collapse: collapse;">';
    html += '<thead><tr><th style="padding-bottom: 5px; color: var(--accent-secondary);">Date</th><th style="color: var(--accent-secondary);">Set</th><th style="color: var(--accent-secondary);">Reps</th><th style="color: var(--accent-secondary);">Lbs</th></tr></thead><tbody>';

    last5.forEach(w => {
        const date = new Date(w.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        html += `
            <tr style="border-top: 1px solid rgba(255,255,255,0.1);">
                <td style="padding: 4px 0;">${date}</td>
                <td>${w.setNumber || 1}</td>
                <td>${w.reps}</td>
                <td>${w.weight}</td>
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
        dateHeader.textContent = date;
        dateGroup.appendChild(dateHeader);

        // Group by Exercise within Date
        const exercisesInDate = {};
        groupedByDate[date].forEach(workout => {
            if (!exercisesInDate[workout.exercise]) exercisesInDate[workout.exercise] = [];
            exercisesInDate[workout.exercise].push(workout);
        });

        Object.keys(exercisesInDate).forEach(exercise => {
            const exerciseGroup = document.createElement('div');
            exerciseGroup.className = 'history-exercise-group';

            const exHeader = document.createElement('div');
            exHeader.className = 'history-exercise-header';
            exHeader.innerHTML = `<h4>${exercise}</h4>`;
            exerciseGroup.appendChild(exHeader);

            const setList = document.createElement('div');
            setList.className = 'history-set-list';

            exercisesInDate[exercise].forEach(workout => {
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
                        <span class="intensity-dot" style="background: ${getIntensityColor(workout.intensity)}" title="Intensity: ${workout.intensity}"></span>
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

    chartFilter.innerHTML = '<option value="" disabled selected>Select Exercise</option>';

    exercises.sort().forEach(ex => {
        const option = document.createElement('option');
        option.value = ex;
        option.textContent = ex;
        chartFilter.appendChild(option);
    });

    if (currentValue && exercises.includes(currentValue)) {
        chartFilter.value = currentValue;
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

    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.5)');
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Daily Max (lbs)',
                    data: maxDataPoints,
                    borderColor: '#6366f1',
                    backgroundColor: gradient,
                    borderWidth: 2,
                    pointBackgroundColor: '#6366f1',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: '#6366f1',
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
                    backgroundColor: 'rgba(139, 92, 246, 0.5)', // Lighter/Different shade
                    borderColor: 'rgba(139, 92, 246, 0.5)',
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
                    labels: { color: '#94a3b8' }
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
                    grid: { color: 'rgba(148, 163, 184, 0.1)' },
                    ticks: { color: '#94a3b8' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                }
            }
        }
    });
}

// Helpers
function getIntensityColor(level) {
    if (level >= 8) return 'rgba(239, 68, 68, 0.4)'; // Red
    if (level >= 5) return 'rgba(245, 158, 11, 0.4)'; // Orange
    return 'rgba(16, 185, 129, 0.4)'; // Green
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
function showDropdown() {
    exerciseDropdown.classList.add('show');
}

function hideDropdown() {
    exerciseDropdown.classList.remove('show');
}

function filterExercises(query) {
    const exercises = [...new Set(workouts.map(w => w.exercise))].sort();
    const filtered = exercises.filter(ex => ex.toLowerCase().includes(query.toLowerCase()));

    exerciseDropdown.innerHTML = '';

    if (filtered.length === 0) {
        if (query) {
            const item = document.createElement('li');
            item.className = 'combobox-item no-results';
            item.textContent = 'No matching exercises';
            exerciseDropdown.appendChild(item);
        } else {
            // Show all if empty query
            exercises.forEach(ex => createDropdownItem(ex));
        }
    } else {
        filtered.forEach(ex => createDropdownItem(ex));
    }
}

function createDropdownItem(text) {
    const item = document.createElement('li');
    item.className = 'combobox-item';
    item.textContent = text;
    item.addEventListener('click', () => {
        exerciseInput.value = text;
        hideDropdown();
        updateSetIndicator();
        renderExerciseHistory();
    });
    exerciseDropdown.appendChild(item);
}
