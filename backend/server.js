import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { exec } from 'child_process';
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

const HOME = os.homedir();
const OPENCLAW_DIR = path.join(HOME, '.openclaw');
const SESSIONS_FILE = path.join(OPENCLAW_DIR, 'agents', 'main', 'sessions', 'sessions.json');
const SUBAGENTS_FILE = path.join(OPENCLAW_DIR, 'subagents', 'runs.json');
const SESSIONS_DIR = path.join(OPENCLAW_DIR, 'agents', 'main', 'sessions');
const CONFIG_FILE = path.join(OPENCLAW_DIR, 'mission-controller.json');

const DEFAULT_CONFIG = {
  defaultModel: 'anthropic/claude-sonnet-4-6',
  fallbackModels: [
    'anthropic/claude-haiku-4-5',
    'openai-codex/gpt-5.3-codex',
  ],
  autoRetryFallback: true,
};

function readJsonSafe(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeJsonSafe(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function loadConfig() {
  const saved = readJsonSafe(CONFIG_FILE) || {};
  const fallbackModels = Array.isArray(saved.fallbackModels)
    ? saved.fallbackModels.filter(Boolean)
    : DEFAULT_CONFIG.fallbackModels;
  return {
    ...DEFAULT_CONFIG,
    ...saved,
    fallbackModels,
  };
}

function saveConfig(next) {
  writeJsonSafe(CONFIG_FILE, next);
  return next;
}

function getSessions() {
  const data = readJsonSafe(SESSIONS_FILE);
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.sessions)) return data.sessions;
  return Object.entries(data).map(([key, val]) => ({ key, ...val, sessionId: val.sessionId }));
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
    if (run.endedReason === 'timeout' || run.outcome?.status === 'timeout') return 'failed';
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

function extractErrorReason(run) {
  if (!run) return null;
  const parts = [
    run?.outcome?.status,
    run?.outcome?.reason,
    run?.outcome?.error,
    run?.endedReason,
  ].filter(Boolean);
  const joined = parts.join(' ').toLowerCase();
  if (!joined) return null;
  if (joined.includes('rate') && joined.includes('limit')) return 'rate-limit';
  if (joined.includes('quota')) return 'quota';
  if (joined.includes('model') && (joined.includes('unavailable') || joined.includes('not found'))) return 'model-unavailable';
  if (joined.includes('timeout')) return 'timeout';
  if (joined.includes('context') || joined.includes('token')) return 'token-limit';
  return parts[0];
}

function buildAgentList() {
  const sessions = getSessions();
  const runs = getRuns();

  const sessionKeyToRun = {};
  for (const run of Object.values(runs)) {
    if (run.childSessionKey) sessionKeyToRun[run.childSessionKey] = run;
  }

  const agents = [];

  for (const run of Object.values(runs)) {
    const session = sessions.find(s => s.key === run.childSessionKey);
    const status = determineStatus(run);
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
      errorReason: extractErrorReason(run),
      endedReason: run.endedReason || null,
      frozenResult: run.frozenResultText || null,
      thinkingLevel: session?.thinkingLevel || 'off',
      requester: run.requesterSessionKey || null,
      runTimeoutSeconds: run.runTimeoutSeconds || null,
    });
  }

  for (const session of sessions) {
    if (sessionKeyToRun[session.key]) continue;
    if (session.key.includes('subagent')) continue;
    if (session.key.includes('cron')) continue;
    if (!session.key.includes('discord') && !session.key.endsWith(':main')) continue;

    const ageMs = session.ageMs || (Date.now() - (session.updatedAt || 0));
    const isActive = ageMs < 30 * 60 * 1000;

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
      errorReason: null,
      endedReason: null,
      frozenResult: null,
      thinkingLevel: session.thinkingLevel || 'off',
      requester: null,
      runTimeoutSeconds: null,
    });
  }

  agents.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return agents;
}

async function getAgentLogs(sessionId) {
  if (!sessionId) return [];
  const logFile = path.join(SESSIONS_DIR, `${sessionId}.jsonl`);
  try {
    const content = await readFile(logFile, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    return lines.map((line) => {
      try { return JSON.parse(line); } catch { return { type: 'raw', content: line }; }
    });
  } catch {
    return [];
  }
}

function extractLogMessages(rawLogs) {
  const messages = [];
  for (const entry of rawLogs) {
    try {
      if (entry.role && entry.content) {
        const content = Array.isArray(entry.content)
          ? entry.content.map(c => c.text || c.content || JSON.stringify(c)).join('')
          : (typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content));
        messages.push({ role: entry.role, content: content.slice(0, 4000), timestamp: entry.timestamp || null });
      } else if (entry.type) {
        messages.push({ role: 'system', content: JSON.stringify(entry).slice(0, 1000), type: entry.type });
      }
    } catch {}
  }
  return messages;
}

function buildSpawnCommand({ task, model, thinking, timeout }) {
  const taskEscaped = task.replace(/"/g, '\\"').replace(/\n/g, '\\n');
  const modelFlag = model ? `--model "${model}"` : '';
  const thinkingFlag = thinking && thinking !== 'off' ? `--thinking ${thinking}` : '';
  const timeoutFlag = timeout ? `--timeout ${timeout}` : '';
  return `openclaw agent -m "${taskEscaped}" ${modelFlag} ${thinkingFlag} ${timeoutFlag}`.trim();
}

function classifySpawnFailure(text = '') {
  const lower = text.toLowerCase();
  if (lower.includes('rate') && lower.includes('limit')) return 'rate-limit';
  if (lower.includes('quota')) return 'quota';
  if (lower.includes('model') && (lower.includes('unavailable') || lower.includes('not found'))) return 'model-unavailable';
  if (lower.includes('context') || lower.includes('token')) return 'token-limit';
  return null;
}

async function spawnWithModel(opts) {
  const cmd = buildSpawnCommand(opts);
  try {
    const { stdout, stderr } = await execAsync(cmd, { timeout: 30000 });
    return { ok: true, stdout, stderr, model: opts.model };
  } catch (err) {
    const stdout = err?.stdout || '';
    const stderr = err?.stderr || err?.message || '';
    return { ok: false, stdout, stderr, reason: classifySpawnFailure(`${stdout}\n${stderr}`), model: opts.model };
  }
}

app.get('/api/config', (req, res) => {
  try {
    res.json({ config: loadConfig() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/config', (req, res) => {
  try {
    const current = loadConfig();
    const next = {
      ...current,
      ...req.body,
      fallbackModels: Array.isArray(req.body?.fallbackModels)
        ? req.body.fallbackModels.filter(Boolean)
        : current.fallbackModels,
    };
    saveConfig(next);
    res.json({ ok: true, config: next });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/agents', (req, res) => {
  try {
    const agents = buildAgentList();
    res.json({ agents, count: agents.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

app.post('/api/agents', async (req, res) => {
  try {
    const { task, model, thinking, timeout } = req.body;
    const cfg = loadConfig();

    if (!task?.trim()) return res.status(400).json({ error: 'Task is required' });

    const preferredModel = model || cfg.defaultModel;
    const fallbackChain = [preferredModel, ...(cfg.fallbackModels || []).filter(m => m !== preferredModel)];
    const attempts = [];

    for (let i = 0; i < fallbackChain.length; i++) {
      const targetModel = fallbackChain[i];
      const attempt = await spawnWithModel({ task, model: targetModel, thinking, timeout });
      attempts.push({ model: targetModel, ok: attempt.ok, reason: attempt.reason || null });
      if (attempt.ok) {
        return res.json({
          ok: true,
          message: i === 0 ? 'Agent spawned' : `Agent spawned after fallback (${targetModel})`,
          modelUsed: targetModel,
          attempts,
        });
      }

      const canRetry = cfg.autoRetryFallback && i < fallbackChain.length - 1;
      const retryable = ['rate-limit', 'quota', 'model-unavailable', 'token-limit'].includes(attempt.reason);
      if (!canRetry || !retryable) {
        return res.status(400).json({
          ok: false,
          error: attempt.stderr || 'Spawn failed',
          reason: attempt.reason,
          attempts,
        });
      }
    }

    return res.status(400).json({ ok: false, error: 'No model could spawn task', attempts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/agents/:id/retry', async (req, res) => {
  try {
    const { model } = req.body || {};
    const agents = buildAgentList();
    const agent = agents.find(a => a.id === req.params.id || a.runId === req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    if (agent.status !== 'failed') return res.status(400).json({ error: 'Only failed agents can be retried' });

    const result = await spawnWithModel({
      task: agent.task,
      model: model || loadConfig().defaultModel,
      thinking: agent.thinkingLevel,
      timeout: agent.runTimeoutSeconds || 900,
    });

    if (!result.ok) {
      return res.status(400).json({ ok: false, error: result.stderr || 'Retry failed', reason: result.reason });
    }

    return res.json({ ok: true, message: 'Retry launched', modelUsed: result.model });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/agents/:id', async (req, res) => {
  try {
    const agents = buildAgentList();
    const agent = agents.find(a => a.id === req.params.id || a.runId === req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    if (agent.status !== 'running') return res.status(400).json({ error: 'Agent is not running' });
    if (!agent.sessionId) return res.status(400).json({ error: 'No session id available' });

    try {
      await execAsync(`pkill -f "${agent.sessionId}"`);
      return res.json({ ok: true, message: 'Kill signal sent', sessionId: agent.sessionId });
    } catch {
      return res.json({ ok: true, message: 'Kill requested (best effort)', sessionId: agent.sessionId });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/agents/:id/steer', async (req, res) => {
  try {
    const { message } = req.body;
    const agents = buildAgentList();
    const agent = agents.find(a => a.id === req.params.id || a.runId === req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    if (!message?.trim()) return res.status(400).json({ error: 'Message required' });

    if (!agent.sessionId) {
      return res.status(400).json({ error: 'Agent has no session id for steer' });
    }

    const logFile = path.join(SESSIONS_DIR, `${agent.sessionId}.jsonl`);
    const steerEntry = {
      role: 'system',
      type: 'steer',
      timestamp: Date.now(),
      content: `[Mission Controller steer]\n${message.trim()}`,
    };

    fs.appendFileSync(logFile, `${JSON.stringify(steerEntry)}\n`);

    return res.json({
      ok: true,
      message: 'Steer note appended to session log',
      agentId: req.params.id,
      steerMessage: message,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stats', (req, res) => {
  try {
    const agents = buildAgentList();
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

    const projectCounts = {};
    for (const a of agents) projectCounts[a.project] = (projectCounts[a.project] || 0) + 1;
    const mostActiveProject = Object.entries(projectCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';

    const modelCounts = {};
    for (const a of agents) modelCounts[a.model] = (modelCounts[a.model] || 0) + 1;

    const successRate = (completedAgents.length + failedAgents.length) > 0
      ? Math.round(completedAgents.length / (completedAgents.length + failedAgents.length) * 100)
      : 0;

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

app.get('/api/timeline', (req, res) => {
  try {
    const agents = buildAgentList();
    const now = Date.now();

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

    res.json({ items: timedAgents, range: { start: earliest, end: Math.max(latest, now) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/logs/:sessionId', async (req, res) => {
  try {
    const rawLogs = await getAgentLogs(req.params.sessionId);
    const logs = extractLogMessages(rawLogs);
    res.json({ logs, count: logs.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const clients = new Set();
wss.on('connection', (ws) => {
  clients.add(ws);
  const agents = buildAgentList();
  ws.send(JSON.stringify({ type: 'agents', data: agents }));
  ws.send(JSON.stringify({ type: 'config', data: loadConfig() }));
  ws.on('close', () => clients.delete(ws));
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
        broadcast({ type: 'agents', data: buildAgentList() });
      }
    }
  } catch {}
}, 2000);

const PORT = 3334;
server.listen(PORT, () => {
  console.log(`🚀 Mission Controller Backend running on http://localhost:${PORT}`);
  console.log(`📊 Reading sessions from: ${SESSIONS_FILE}`);
  console.log(`🤖 Reading runs from: ${SUBAGENTS_FILE}`);
});
