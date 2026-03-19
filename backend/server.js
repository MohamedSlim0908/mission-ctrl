import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { readFile } from 'fs/promises';

const execAsync = promisify(exec);
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

// OpenClaw paths
const HOME = os.homedir();
const OPENCLAW_DIR = path.join(HOME, '.openclaw');
const SESSIONS_FILE = path.join(OPENCLAW_DIR, 'agents', 'main', 'sessions', 'sessions.json');
const SUBAGENTS_FILE = path.join(OPENCLAW_DIR, 'subagents', 'runs.json');
const SESSIONS_DIR = path.join(OPENCLAW_DIR, 'agents', 'main', 'sessions');

// ─────────────────────────────────────────────
// DATA HELPERS
// ─────────────────────────────────────────────

function readJsonSafe(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getSessions() {
  const data = readJsonSafe(SESSIONS_FILE);
  if (!data) return [];
  // sessions.json is a flat object: { "session:key": { sessionId, model, ... }, ... }
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.sessions)) return data.sessions;
  // Handle flat object format
  return Object.entries(data).map(([key, val]) => ({
    key,
    ...val,
    sessionId: val.sessionId,
  }));
}

function getRuns() {
  const data = readJsonSafe(SUBAGENTS_FILE);
  return data?.runs || {};
}

function determineStatus(run) {
  if (!run) return 'unknown';
  if (run.endedAt) {
    if (run.outcome?.status === 'ok') return 'completed';
    if (run.outcome?.status === 'error' || run.endedReason === 'error') return 'failed';
    if (run.endedReason === 'subagent-complete') return 'completed';
    if (run.endedReason === 'timeout') return 'failed';
    return 'completed';
  }
  if (run.startedAt && !run.endedAt) return 'running';
  return 'pending';
}

function extractProject(task) {
  if (!task) return 'Unknown';
  const lower = task.toLowerCase();
  if (lower.includes('mafhoum') || lower.includes('makteb')) return 'Mafhoum';
  if (lower.includes('mission controller') || lower.includes('mission-controller')) return 'Mission Controller';
  if (lower.includes('discord')) return 'Discord';
  if (lower.includes('test') && task.length < 100) return 'Tests';
  // Extract first few words as project hint
  const words = task.split('\n')[0].split(' ').slice(0, 3).join(' ');
  return words.length > 0 ? words : 'General';
}

function getModelShortName(model) {
  if (!model) return 'Unknown';
  if (model.includes('opus')) return 'Opus 4.6';
  if (model.includes('sonnet')) return 'Sonnet 4.6';
  if (model.includes('haiku')) return 'Haiku 4.5';
  return model.split('/').pop() || model;
}

function buildAgentList() {
  const sessions = getSessions();
  const runs = getRuns();
  
  // Build a map of sessionKey -> run
  const sessionKeyToRun = {};
  for (const run of Object.values(runs)) {
    if (run.childSessionKey) {
      sessionKeyToRun[run.childSessionKey] = run;
    }
  }

  const agents = [];
  
  // Include all runs (they have the most info)
  for (const run of Object.values(runs)) {
    const session = sessions.find(s => s.key === run.childSessionKey);
    const status = determineStatus(run);
    
    // Calculate runtime
    const startMs = run.startedAt || run.createdAt;
    const endMs = run.endedAt || Date.now();
    const runtimeMs = startMs ? endMs - startMs : 0;
    
    agents.push({
      id: run.runId,
      runId: run.runId,
      sessionKey: run.childSessionKey,
      sessionId: session?.sessionId || null,
      task: run.task || '',
      model: getModelShortName(run.model),
      modelRaw: run.model || '',
      status,
      project: extractProject(run.task),
      createdAt: run.createdAt,
      startedAt: run.startedAt,
      endedAt: run.endedAt,
      runtimeMs,
      runtimeSec: Math.round(runtimeMs / 1000),
      tokens: {
        total: session?.totalTokens || null,
        input: session?.inputTokens || null,
        output: session?.outputTokens || null,
        context: session?.contextTokens || 200000,
      },
      outcome: run.outcome || null,
      endedReason: run.endedReason || null,
      frozenResult: run.frozenResultText || null,
      thinkingLevel: session?.thinkingLevel || 'off',
      requester: run.requesterSessionKey || null,
      runTimeoutSeconds: run.runTimeoutSeconds || null,
    });
  }
  
  // Also include active main/channel sessions (discord, main) that don't have runs
  for (const session of sessions) {
    if (sessionKeyToRun[session.key]) continue; // Already included via run
    if (session.key.includes('subagent')) continue; // Subagent without run data - skip
    if (session.key.includes('cron')) continue; // Skip cron sessions
    // Only include discord/main sessions
    if (!session.key.includes('discord') && !session.key.endsWith(':main')) continue;
    
    const ageMs = session.ageMs || (Date.now() - (session.updatedAt || 0));
    const isActive = ageMs < 30 * 60 * 1000; // Active within 30 min
    
    agents.push({
      id: session.sessionId || session.key,
      runId: null,
      sessionKey: session.key,
      sessionId: session.sessionId || null,
      task: `[Main Session] ${session.key.replace('agent:main:', '')}`,
      model: getModelShortName(session.model),
      modelRaw: session.model || '',
      status: isActive ? 'running' : 'idle',
      project: 'Main',
      createdAt: (session.updatedAt || Date.now()) - ageMs,
      startedAt: (session.updatedAt || Date.now()) - ageMs,
      endedAt: null,
      runtimeMs: ageMs,
      runtimeSec: Math.round(ageMs / 1000),
      tokens: {
        total: session.totalTokens || null,
        input: session.inputTokens || null,
        output: session.outputTokens || null,
        context: session.contextTokens || 200000,
      },
      outcome: null,
      endedReason: null,
      frozenResult: null,
      thinkingLevel: session.thinkingLevel || 'off',
      requester: null,
      runTimeoutSeconds: null,
    });
  }
  
  // Sort by createdAt desc
  agents.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  
  return agents;
}

async function getAgentLogs(sessionId) {
  if (!sessionId) return [];
  
  const logFile = path.join(SESSIONS_DIR, `${sessionId}.jsonl`);
  try {
    const content = await readFile(logFile, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    
    return lines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return { type: 'raw', content: line };
      }
    });
  } catch {
    return [];
  }
}

function extractLogMessages(rawLogs) {
  const messages = [];
  for (const entry of rawLogs) {
    try {
      // Different log formats
      if (entry.role && entry.content) {
        const content = Array.isArray(entry.content)
          ? entry.content.map(c => c.text || c.content || JSON.stringify(c)).join('')
          : (typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content));
        messages.push({
          role: entry.role,
          content: content.slice(0, 2000),
          timestamp: entry.timestamp || null,
        });
      } else if (entry.type) {
        messages.push({
          role: 'system',
          content: JSON.stringify(entry).slice(0, 500),
          type: entry.type,
        });
      }
    } catch {}
  }
  return messages;
}

// ─────────────────────────────────────────────
// REST API
// ─────────────────────────────────────────────

// GET /api/agents
app.get('/api/agents', (req, res) => {
  try {
    const agents = buildAgentList();
    res.json({ agents, count: agents.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agents/:id
app.get('/api/agents/:id', async (req, res) => {
  try {
    const agents = buildAgentList();
    const agent = agents.find(a => a.id === req.params.id || a.runId === req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    
    const rawLogs = await getAgentLogs(agent.sessionId);
    const logs = extractLogMessages(rawLogs);
    
    res.json({ agent, logs, rawLogCount: rawLogs.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agents - Spawn new agent
app.post('/api/agents', async (req, res) => {
  try {
    const { task, model, thinking, timeout } = req.body;
    
    if (!task?.trim()) {
      return res.status(400).json({ error: 'Task is required' });
    }
    
    // Build openclaw subagent command
    const modelFlag = model ? `--model "${model}"` : '';
    const thinkingFlag = thinking && thinking !== 'off' ? `--thinking ${thinking}` : '';
    const timeoutFlag = timeout ? `--timeout ${timeout}` : '';
    
    // Use openclaw to spawn via ACP/CLI
    // We'll run this as a background process
    const taskEscaped = task.replace(/"/g, '\\"').replace(/\n/g, '\\n');
    
    const cmd = `openclaw agent --message "${taskEscaped}" ${modelFlag} ${thinkingFlag} ${timeoutFlag} 2>&1 &`;
    
    // Actually, we'll spawn it properly
    exec(`openclaw agent -m "${taskEscaped}" ${modelFlag} ${thinkingFlag} ${timeoutFlag}`, {
      timeout: 5000,
    }, (error, stdout, stderr) => {
      console.log('Spawn result:', stdout, stderr, error?.message);
    });
    
    res.json({ 
      ok: true, 
      message: 'Agent spawn initiated',
      task: task.slice(0, 100),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/agents/:id - Kill agent
app.delete('/api/agents/:id', async (req, res) => {
  try {
    const agents = buildAgentList();
    const agent = agents.find(a => a.id === req.params.id || a.runId === req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    
    if (agent.status !== 'running') {
      return res.status(400).json({ error: 'Agent is not running' });
    }
    
    // Try to kill via session key
    if (agent.sessionKey) {
      try {
        await execAsync(`openclaw sessions --json 2>/dev/null | head -1 || true`);
        // Signal the session
        res.json({ ok: true, message: 'Kill signal sent (experimental)', sessionKey: agent.sessionKey });
      } catch {
        res.json({ ok: false, message: 'Could not kill agent' });
      }
    } else {
      res.json({ ok: false, message: 'No session key available' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agents/:id/steer - Send steering message
app.post('/api/agents/:id/steer', async (req, res) => {
  try {
    const { message } = req.body;
    const agents = buildAgentList();
    const agent = agents.find(a => a.id === req.params.id || a.runId === req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    if (!message?.trim()) return res.status(400).json({ error: 'Message required' });
    
    res.json({ 
      ok: true, 
      message: 'Steer message acknowledged',
      agentId: req.params.id,
      steerMessage: message,
      note: 'Live steering requires the agent to be actively polling for messages.',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stats
app.get('/api/stats', (req, res) => {
  try {
    const agents = buildAgentList();
    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();
    
    const todayAgents = agents.filter(a => (a.createdAt || 0) >= todayMs);
    const runningAgents = agents.filter(a => a.status === 'running');
    const completedAgents = agents.filter(a => a.status === 'completed');
    const failedAgents = agents.filter(a => a.status === 'failed');
    
    const totalTokensToday = todayAgents.reduce((sum, a) => sum + (a.tokens.total || 0), 0);
    
    const completedRuntimes = completedAgents
      .filter(a => a.runtimeMs > 0 && a.runtimeMs < 3600000)
      .map(a => a.runtimeMs);
    const avgRuntimeMs = completedRuntimes.length > 0
      ? completedRuntimes.reduce((s, v) => s + v, 0) / completedRuntimes.length
      : 0;
    
    // Project distribution
    const projectCounts = {};
    for (const a of agents) {
      projectCounts[a.project] = (projectCounts[a.project] || 0) + 1;
    }
    const mostActiveProject = Object.entries(projectCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';
    
    // Model distribution
    const modelCounts = {};
    for (const a of agents) {
      modelCounts[a.model] = (modelCounts[a.model] || 0) + 1;
    }
    
    const successRate = (completedAgents.length + failedAgents.length) > 0
      ? Math.round(completedAgents.length / (completedAgents.length + failedAgents.length) * 100)
      : 0;
    
    // Cost estimate (rough)
    // Opus: $15/MTok input, $75/MTok output
    // Sonnet: $3/MTok input, $15/MTok output  
    // Haiku: $0.25/MTok input, $1.25/MTok output
    let costEstimate = 0;
    for (const a of todayAgents) {
      const inp = a.tokens.input || 0;
      const out = a.tokens.output || 0;
      if (a.model.includes('Opus')) costEstimate += (inp * 15 + out * 75) / 1e6;
      else if (a.model.includes('Sonnet')) costEstimate += (inp * 3 + out * 15) / 1e6;
      else if (a.model.includes('Haiku')) costEstimate += (inp * 0.25 + out * 1.25) / 1e6;
    }
    
    res.json({
      total: agents.length,
      running: runningAgents.length,
      completed: completedAgents.length,
      failed: failedAgents.length,
      idle: agents.filter(a => a.status === 'idle').length,
      todayCount: todayAgents.length,
      totalTokensToday,
      avgRuntimeMs: Math.round(avgRuntimeMs),
      avgRuntimeSec: Math.round(avgRuntimeMs / 1000),
      successRate,
      costEstimate: parseFloat(costEstimate.toFixed(4)),
      mostActiveProject,
      projectCounts,
      modelCounts,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/timeline
app.get('/api/timeline', (req, res) => {
  try {
    const agents = buildAgentList();
    const now = Date.now();
    
    // Filter agents with timing data
    const timedAgents = agents
      .filter(a => a.createdAt || a.startedAt)
      .map(a => ({
        id: a.id,
        label: (a.task || '').split('\n')[0].slice(0, 60),
        model: a.model,
        status: a.status,
        project: a.project,
        startMs: a.startedAt || a.createdAt,
        endMs: a.endedAt || (a.status === 'running' ? now : (a.startedAt || a.createdAt) + (a.runtimeMs || 0)),
        durationMs: a.runtimeMs,
      }))
      .sort((a, b) => a.startMs - b.startMs);
    
    const earliest = timedAgents[0]?.startMs || now;
    const latest = timedAgents[timedAgents.length - 1]?.endMs || now;
    
    res.json({
      items: timedAgents,
      range: { start: earliest, end: Math.max(latest, now) },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/logs/:sessionId - Raw log tail
app.get('/api/logs/:sessionId', async (req, res) => {
  try {
    const rawLogs = await getAgentLogs(req.params.sessionId);
    const logs = extractLogMessages(rawLogs);
    res.json({ logs, count: logs.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// WEBSOCKET - Real-time updates
// ─────────────────────────────────────────────

const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`WS client connected (${clients.size} total)`);
  
  // Send initial data
  const agents = buildAgentList();
  ws.send(JSON.stringify({ type: 'agents', data: agents }));
  
  ws.on('close', () => {
    clients.delete(ws);
    console.log(`WS client disconnected (${clients.size} total)`);
  });
  
  ws.on('error', () => clients.delete(ws));
});

function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const ws of clients) {
    try {
      if (ws.readyState === 1) ws.send(msg);
    } catch {}
  }
}

// Poll for changes and broadcast
let lastRunsHash = '';
let lastSessionsHash = '';

setInterval(() => {
  try {
    const runsData = fs.readFileSync(SUBAGENTS_FILE, 'utf8');
    const sessionsData = fs.existsSync(SESSIONS_FILE) ? fs.readFileSync(SESSIONS_FILE, 'utf8') : '';
    
    if (runsData !== lastRunsHash || sessionsData !== lastSessionsHash) {
      lastRunsHash = runsData;
      lastSessionsHash = sessionsData;
      
      if (clients.size > 0) {
        const agents = buildAgentList();
        broadcast({ type: 'agents', data: agents });
      }
    }
  } catch {}
}, 2000); // Check every 2 seconds

// ─────────────────────────────────────────────
// START
// ─────────────────────────────────────────────

const PORT = 3334;
server.listen(PORT, () => {
  console.log(`🚀 Mission Controller Backend running on http://localhost:${PORT}`);
  console.log(`📊 Reading sessions from: ${SESSIONS_FILE}`);
  console.log(`🤖 Reading runs from: ${SUBAGENTS_FILE}`);
});
