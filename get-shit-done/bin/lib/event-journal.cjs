'use strict';
// event-journal.cjs — Central workflow event emitter and reader.
// Writes structured events to .planning/observations/workflow.jsonl.
// Synchronous writes; never throws on I/O failure.

const fs = require('fs');
const path = require('path');
const { output } = require('./core.cjs');

// ─── Internal helpers ─────────────────────────────────────────────────────────

function getJournalPath(cwd) {
  return path.join(cwd, '.planning', 'observations', 'workflow.jsonl');
}

function getObservationsDir(cwd) {
  return path.join(cwd, '.planning', 'observations');
}

function getMaxEntries(cwd) {
  try {
    const configPath = path.join(cwd, '.planning', 'config.json');
    const raw = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw);
    if (config && config.journal && typeof config.journal.max_entries === 'number') {
      return config.journal.max_entries;
    }
  } catch {
    // Config read failure is silent
  }
  return 10000;
}

function countLines(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.split('\n').filter(l => l.trim() !== '').length;
  } catch {
    return 0;
  }
}

// ─── rotateJournal ────────────────────────────────────────────────────────────

function rotateJournal(journalPath) {
  try {
    const dir = path.dirname(journalPath);
    const dateStr = new Date().toISOString().slice(0, 10);
    let archiveName = `workflow-${dateStr}.jsonl`;
    let archivePath = path.join(dir, archiveName);
    let seq = 1;
    while (fs.existsSync(archivePath)) {
      archiveName = `workflow-${dateStr}-${seq}.jsonl`;
      archivePath = path.join(dir, archiveName);
      seq++;
    }
    fs.renameSync(journalPath, archivePath);
  } catch {
    // Rotation failure is silent
  }
}

// ─── emitEvent ───────────────────────────────────────────────────────────────

function emitEvent(type, context, data, cwd) {
  try {
    const obsDir = getObservationsDir(cwd);
    fs.mkdirSync(obsDir, { recursive: true });

    const journalPath = getJournalPath(cwd);
    const maxEntries = getMaxEntries(cwd);

    if (fs.existsSync(journalPath)) {
      const lineCount = countLines(journalPath);
      if (lineCount >= maxEntries) {
        rotateJournal(journalPath);
      }
    }

    const event = {
      type,
      timestamp: new Date().toISOString(),
      phase: (context && context.phase != null) ? context.phase : null,
      plan: (context && context.plan != null) ? context.plan : null,
      task: (context && context.task != null) ? context.task : null,
      session_id: (context && context.session_id != null) ? context.session_id : 'unknown',
      data: data != null ? data : null,
    };

    fs.appendFileSync(journalPath, JSON.stringify(event) + '\n', 'utf-8');
  } catch {
    // Write failure is silent
  }
}

// ─── readEvents ──────────────────────────────────────────────────────────────

function readEvents(filter, cwd) {
  const journalPath = getJournalPath(cwd);

  let events = [];
  try {
    if (!fs.existsSync(journalPath)) return [];
    const content = fs.readFileSync(journalPath, 'utf-8');
    events = content
      .split('\n')
      .filter(l => l.trim() !== '')
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);
  } catch {
    return [];
  }

  if (filter) {
    if (filter.phase != null) {
      events = events.filter(e => String(e.phase) === String(filter.phase));
    }
    if (filter.plan != null) {
      events = events.filter(e => String(e.plan) === String(filter.plan));
    }
    if (filter.type != null) {
      events = events.filter(e => e.type === filter.type);
    }
    if (filter.session_id != null) {
      events = events.filter(e => e.session_id === filter.session_id);
    }
    if (filter.from != null) {
      events = events.filter(e => e.timestamp >= filter.from);
    }
    if (filter.to != null) {
      events = events.filter(e => e.timestamp <= filter.to);
    }
  }

  // Sort ascending by timestamp (already in order, but sort for safety)
  events.sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0));

  return events;
}

// ─── CLI wrappers ─────────────────────────────────────────────────────────────

function cmdJournalEmit(cwd, opts, raw) {
  let parsedData = null;
  if (opts.data != null) {
    try {
      parsedData = JSON.parse(opts.data);
    } catch {
      parsedData = opts.data;
    }
  }

  emitEvent(
    opts.type || '',
    {
      phase: opts.phase,
      plan: opts.plan,
      task: opts.task,
      session_id: opts.session_id,
    },
    parsedData,
    cwd
  );

  output({ emitted: true }, raw);
}

function cmdJournalQuery(cwd, opts, raw) {
  const filter = {};
  if (opts.phase != null) filter.phase = opts.phase;
  if (opts.plan != null) filter.plan = opts.plan;
  if (opts.type != null) filter.type = opts.type;
  if (opts.session_id != null) filter.session_id = opts.session_id;
  if (opts.from != null) filter.from = opts.from;
  if (opts.to != null) filter.to = opts.to;

  let events = readEvents(filter, cwd);

  if (opts.count != null && Number.isFinite(opts.count)) {
    events = events.slice(-opts.count);
  }

  output({ events, total: events.length }, raw);
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = { emitEvent, readEvents, cmdJournalEmit, cmdJournalQuery };
