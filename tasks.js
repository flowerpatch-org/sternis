// -------------------------------------------------------
// Task catalogue
// To add a new task: add an entry to the array below.
// To change a reward: update the `reward` field.
// -------------------------------------------------------

const TASKS = [
  // Health
  { id: 'full-training-week',name: 'Full training week completed', emoji: '💪', stars: 2, category: 'health' },

  // Life admin
  { id: 'weekly-chores',     name: 'All weekly chores done',       emoji: '🧹', stars: 3, category: 'admin' },
  { id: 'doctor-appointment',name: 'Scheduled & attended appointment', emoji: '🏥', stars: 1, category: 'admin' },
  { id: 'big-admin',         name: 'Big admin task (taxes, documents…)', emoji: '📄', stars: 6, category: 'admin' },

  // Personal projects
  { id: 'finished-book',     name: 'Finished a book', emoji: '📚', stars: 5, category: 'personal' },
];

module.exports = TASKS;
