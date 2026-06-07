// -------------------------------------------------------
// Task catalogue
// To add a new task: add an entry to the array below.
// To change a reward: update the `stars` field.
//
// cooldown         – minimum days before the task can be completed again (0 = no limit).
// separateButtons  – if true, show two independent Complete buttons with separate cooldowns,
//                    labelled "max" and "julian".
// -------------------------------------------------------

const TASKS = [
  // Health
  { id: 'full-training-week', name: 'Full training week completed', emoji: '💪', stars: 1, category: 'health', cooldown: 6, separateButtons: true },

  // Life admin
  { id: 'weekly-chores',      name: 'All weekly chores done',              emoji: '🧹', stars: 3, category: 'admin',    cooldown: 5, separateButtons: false },
  { id: 'doctor-appointment', name: 'Scheduled & attended appointment',    emoji: '🏥', stars: 1, category: 'admin',    cooldown: 0, separateButtons: false },
  { id: 'big-admin',          name: 'Big admin task (taxes, documents…)',  emoji: '📄', stars: 6, category: 'admin',    cooldown: 0, separateButtons: false },

  // Personal projects
  { id: 'finished-book',      name: 'Finished a book', emoji: '📚', stars: 3, category: 'personal', cooldown: 0, separateButtons: false },
];

module.exports = TASKS;
