const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const SHOP_ITEMS = require('./shop');
const TASKS = require('./tasks');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'stars.json');

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

// Returns true if the task (or slot) is currently on cooldown.
function isOnCooldown(data, taskId, cooldownDays, slot) {
  if (!cooldownDays) return false;
  const key = completionKey(taskId, slot);
  const last = data.completions && data.completions[key];
  if (!last) return false;
  const elapsed = (Date.now() - new Date(last).getTime()) / (1000 * 60 * 60 * 24);
  return elapsed < cooldownDays;
}

// Returns how many whole days remain on cooldown (0 if not on cooldown).
function daysRemaining(data, taskId, cooldownDays, slot) {
  if (!cooldownDays) return 0;
  const key = completionKey(taskId, slot);
  const last = data.completions && data.completions[key];
  if (!last) return 0;
  const elapsed = (Date.now() - new Date(last).getTime()) / (1000 * 60 * 60 * 24);
  const remaining = cooldownDays - elapsed;
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
  res.json({ stars: data.stars });
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
