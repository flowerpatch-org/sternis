const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const SHOP_ITEMS = require('./persistence/shop');
const TASKS = require('./persistence/tasks');

const app = express();
const PORT = 3000;
const PERSISTENCE_DIR = path.join(__dirname, 'persistence');
const DATA_FILE = path.join(PERSISTENCE_DIR, 'stars.json');

// Ensure persistence directory exists
if (!fs.existsSync(PERSISTENCE_DIR)) {
  fs.mkdirSync(PERSISTENCE_DIR, { recursive: true });
}

// ── Persistence ───────────────────────────────────────────────────────────────

function readData() {
  if (!fs.existsSync(DATA_FILE)) {
    return { stars: 0, inventory: [], completions: {} };
  }
  const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  // Migrate old format that only had { stars }
  if (!raw.inventory) raw.inventory = [];
  if (!raw.completions) raw.completions = {};
  return raw;
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Initialise file if missing
if (!fs.existsSync(DATA_FILE)) {
  writeData({ stars: 0, inventory: [] });
}

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Stars ─────────────────────────────────────────────────────────────────────

app.get('/api/stars', (req, res) => {
  res.json({ stars: readData().stars });
});

app.post('/api/stars', (req, res) => {
  const { delta } = req.body;
  if (typeof delta !== 'number') {
    return res.status(400).json({ error: 'delta must be a number' });
  }
  const data = readData();
  data.stars += delta;
  writeData(data);
  res.json({ stars: data.stars });
});

// ── Shop ──────────────────────────────────────────────────────────────────────

app.get('/api/shop', (req, res) => {
  res.json(SHOP_ITEMS);
});

app.post('/api/shop/buy', (req, res) => {
  const { id } = req.body;
  const item = SHOP_ITEMS.find(i => i.id === id);
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }
  const data = readData();
  if (data.stars < item.cost) {
    return res.status(400).json({ error: 'Not enough stars' });
  }
  data.stars -= item.cost;
  // Each purchase is a separate inventory entry with a unique instance id
  const entry = {
    instanceId: crypto.randomUUID(),
    id: item.id,
    name: item.name,
    emoji: item.emoji,
    cost: item.cost,
  };
  data.inventory.push(entry);
  writeData(data);
  res.json({ stars: data.stars, item: entry });
});

// ── Cooldown helpers ──────────────────────────────────────────────────────────

// Returns the ISO timestamp key used in data.completions.
// For separateButtons tasks the key includes the slot ("max" or "julian").
function completionKey(taskId, slot) {
  return slot ? `${taskId}:${slot}` : taskId;
}

// Returns a string key representing the current cooldown period for the given date.
// Two dates in the same period return the same key.
function getPeriodKey(cooldownType, date) {
  const d = new Date(date);
  switch (cooldownType) {
    case 'daily': {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    case 'weekly': {
      const day = d.getDay();
      const monday = new Date(d);
      monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
      monday.setHours(0, 0, 0, 0);
      return `W-${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
    }
    case 'biweekly': {
      const day = d.getDay();
      const monday = new Date(d);
      monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
      monday.setHours(0, 0, 0, 0);
      const epochMonday = new Date(1969, 11, 29);
      const msPerWeek = 7 * 24 * 60 * 60 * 1000;
      const weekNum = Math.floor((monday.getTime() - epochMonday.getTime()) / msPerWeek);
      const biweekNum = Math.floor(weekNum / 2);
      return `BW-${biweekNum}`;
    }
    case 'monthly': {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    case 'seasonally': {
      const quarter = Math.floor(d.getMonth() / 3) + 1;
      return `${d.getFullYear()}-Q${quarter}`;
    }
    case 'yearly': {
      return `${d.getFullYear()}`;
    }
    default:
      return null;
  }
}

// Returns the start of the next cooldown period as a Date.
function getNextPeriodStart(cooldownType, fromDate) {
  const d = new Date(fromDate);
  d.setHours(0, 0, 0, 0);
  switch (cooldownType) {
    case 'daily': {
      d.setDate(d.getDate() + 1);
      return d;
    }
    case 'weekly': {
      const day = d.getDay();
      const daysUntilMonday = day === 0 ? 1 : 8 - day;
      d.setDate(d.getDate() + daysUntilMonday);
      return d;
    }
    case 'biweekly': {
      const day = d.getDay();
      const monday = new Date(d);
      monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
      monday.setHours(0, 0, 0, 0);
      const epochMonday = new Date(1969, 11, 29);
      const msPerWeek = 7 * 24 * 60 * 60 * 1000;
      const weekNum = Math.floor((monday.getTime() - epochMonday.getTime()) / msPerWeek);
      const biweekNum = Math.floor(weekNum / 2);
      const nextStart = new Date(epochMonday.getTime() + (biweekNum + 1) * 2 * msPerWeek);
      return nextStart;
    }
    case 'monthly': {
      d.setMonth(d.getMonth() + 1);
      d.setDate(1);
      return d;
    }
    case 'seasonally': {
      const month = d.getMonth();
      const nextQuarterMonth = (Math.floor(month / 3) + 1) * 3;
      if (nextQuarterMonth >= 12) {
        d.setFullYear(d.getFullYear() + 1);
        d.setMonth(0);
      } else {
        d.setMonth(nextQuarterMonth);
      }
      d.setDate(1);
      return d;
    }
    case 'yearly': {
      d.setFullYear(d.getFullYear() + 1);
      d.setMonth(0);
      d.setDate(1);
      return d;
    }
    default:
      return d;
  }
}

// Returns true if the task (or slot) is currently on cooldown.
function isOnCooldown(data, taskId, cooldownType, slot) {
  if (!cooldownType) return false;
  const key = completionKey(taskId, slot);
  const last = data.completions && data.completions[key];
  if (!last) return false;
  const lastPeriod = getPeriodKey(cooldownType, new Date(last));
  const currentPeriod = getPeriodKey(cooldownType, new Date());
  return lastPeriod === currentPeriod;
}

// Returns how many whole days remain on cooldown (0 if not on cooldown).
function daysRemaining(data, taskId, cooldownType, slot) {
  if (!cooldownType) return 0;
  const key = completionKey(taskId, slot);
  const last = data.completions && data.completions[key];
  if (!last) return 0;
  const lastPeriod = getPeriodKey(cooldownType, new Date(last));
  const currentPeriod = getPeriodKey(cooldownType, new Date());
  if (lastPeriod !== currentPeriod) return 0;
  const nextStart = getNextPeriodStart(cooldownType, new Date());
  const remaining = (nextStart.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return remaining > 0 ? Math.ceil(remaining) : 0;
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

app.get('/api/tasks', (req, res) => {
  const data = readData();
  const tasks = TASKS.map(task => {
    const slots = task.separateButtons ? ['max', 'julian'] : [null];
    const cooldownInfo = {};
    slots.forEach(slot => {
      const key = slot || 'default';
      cooldownInfo[key] = {
        onCooldown: isOnCooldown(data, task.id, task.cooldown, slot),
        daysRemaining: daysRemaining(data, task.id, task.cooldown, slot),
        type: task.cooldown || null,
      };
    });
    return { ...task, cooldownInfo };
  });
  res.json(tasks);
});

app.post('/api/tasks/complete', (req, res) => {
  const { id, slot } = req.body;
  const task = TASKS.find(t => t.id === id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  // Validate slot for separateButtons tasks
  if (task.separateButtons && slot !== 'max' && slot !== 'julian') {
    return res.status(400).json({ error: 'slot must be "max" or "julian" for this task' });
  }
  if (!task.separateButtons && slot) {
    return res.status(400).json({ error: 'This task does not use slots' });
  }
  const data = readData();
  if (!data.completions) data.completions = {};

  const effectiveSlot = task.separateButtons ? slot : null;
  if (isOnCooldown(data, task.id, task.cooldown, effectiveSlot)) {
    const days = daysRemaining(data, task.id, task.cooldown, effectiveSlot);
    return res.status(400).json({ error: `Task is on cooldown for ${days} more day(s)` });
  }

  data.stars += task.stars;
  data.completions[completionKey(task.id, effectiveSlot)] = new Date().toISOString();
  writeData(data);
  const remainingDays = task.cooldown ? daysRemaining(data, task.id, task.cooldown, effectiveSlot) : 0;
  res.json({ stars: data.stars, daysRemaining: remainingDays });
});

// ── Inventory ─────────────────────────────────────────────────────────────────

app.get('/api/inventory', (req, res) => {
  res.json(readData().inventory);
});

app.post('/api/inventory/use', (req, res) => {
  const { instanceId } = req.body;
  const data = readData();
  const idx = data.inventory.findIndex(e => e.instanceId === instanceId);
  if (idx === -1) {
    return res.status(404).json({ error: 'Item not found in inventory' });
  }
  const [removed] = data.inventory.splice(idx, 1);
  writeData(data);
  res.json({ used: removed });
});

app.post('/api/inventory/return', (req, res) => {
  const { instanceId } = req.body;
  const data = readData();
  const idx = data.inventory.findIndex(e => e.instanceId === instanceId);
  if (idx === -1) {
    return res.status(404).json({ error: 'Item not found in inventory' });
  }
  const [removed] = data.inventory.splice(idx, 1);
  data.stars += removed.cost;
  writeData(data);
  res.json({ stars: data.stars, returned: removed });
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Star tracker running at http://localhost:${PORT}`);
});
