// server.js - Complete refactored version with enhanced architecture integration
require('dotenv').config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const cors = require('cors');
const orchestratorModule = require("./orchestrator.js");
const orchestrator = orchestratorModule.orchestrator || orchestratorModule;
const { createUIResponse } = orchestratorModule;

// Import WhatsApp service
const whatsappService = require("./services/whatsappService");

const session = require('express-session');

const PORT = process.env.PORT || 3001;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const DB_FILE = path.join(__dirname, process.env.DB_FILE || "data.json");

// Authentication credentials (override via env in production)
// Accept legacy env var name ADMIN_PASSWORD as an alias for ADMIN_PASS
const effectiveAdminUser = process.env.ADMIN_USER || process.env.ADMIN_USERNAME || 'admin';
const effectiveAdminPass = process.env.ADMIN_PASS || process.env.ADMIN_PASSWORD || 'admin123';

if (!process.env.ADMIN_PASS && process.env.ADMIN_PASSWORD) {
  console.warn('[Config] ADMIN_PASSWORD is set but ADMIN_PASS is not; using ADMIN_PASSWORD (alias). Prefer ADMIN_PASS in .env');
}

const ADMIN_USER = {
  username: effectiveAdminUser,
  password: effectiveAdminPass
};

const app = express();

// When behind a proxy (e.g., Render), trust X-Forwarded-* headers so secure cookies work
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Middleware for raw body (needed for webhooks)
app.use('/webhooks', express.raw({type: 'application/json'}));
app.use(express.json());

// Optional CORS for external frontend (e.g., GitHub Pages)
if (process.env.FRONTEND_ORIGIN) {
  app.use(cors({
    origin: process.env.FRONTEND_ORIGIN.split(',').map(s => s.trim()),
    credentials: true,
  }));
}

// Session middleware FIRST
// In production behind a proxy (Render), set secure cookies; express-session will honor req.secure when trust proxy is enabled
const secureCookies = typeof process.env.SESSION_COOKIE_SECURE !== 'undefined'
  ? String(process.env.SESSION_COOKIE_SECURE).toLowerCase() === 'true'
  : (process.env.NODE_ENV === 'production');

app.use(session({
  secret: process.env.SESSION_SECRET || 'change_this_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: secureCookies,
    httpOnly: true,
    sameSite: 'lax'
  }
}));

// Helper: resolve the effective base URL per request (honors proxy/https when BASE_URL not set)
function getBaseUrl(req) {
  if (process.env.BASE_URL) return process.env.BASE_URL;
  const protocol = req.protocol; // with trust proxy, reflects 'https' on Render
  const host = req.get('host');
  return `${protocol}://${host}`;
}

// Authentication middleware function
// Authentication disabled for development
function requireAuth(req, res, next) {
  // No authentication enforced
  return next();
}

// Apply authentication middleware BEFORE static files
// app.use(requireAuth); // Disabled for development

// Static file serving AFTER authentication check
app.use(express.static(path.join(__dirname, "public")));

// Public runtime config (expose BASE_URL to clients)
app.get('/api/config', (req, res) => {
  res.json({ 
    baseUrl: getBaseUrl(req)
  });
});

// Warn if running real WhatsApp without HTTPS BASE_URL (links may not open nicely)
if ((process.env.WHATSAPP_MODE || '').toLowerCase() === 'real' && !String(BASE_URL).startsWith('https://')) {
  console.warn('[Config] BASE_URL is not HTTPS. For best compatibility, use an HTTPS public URL so WhatsApp links are clickable on all devices.');
}

// --- DB Helpers ---
function readDB() {
  try {
    if (!fs.existsSync(DB_FILE)) return [];
    const raw = fs.readFileSync(DB_FILE, "utf8");
    return JSON.parse(raw || "[]");
  } catch (err) {
    console.error("Error reading DB:", err);
    return [];
  }
}

function writeDB(data) {
  try {
    // Backup before writing
    if (fs.existsSync(DB_FILE)) {
      const backupFile = DB_FILE.replace('.json', `.backup.${Date.now()}.json`);
      fs.copyFileSync(DB_FILE, backupFile);
    }
    
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error writing DB:", err);
    throw err;
  }
}

function flattenRecord(record) {
  const result = {};

  if (!record || typeof record !== 'object') {
    return result;
  }

  Object.entries(record).forEach(([key, value]) => {
    flattenValue(key, value, result);
  });

  return result;
}

function flattenValue(prefix, value, accumulator) {
  if (value === null || value === undefined) {
    accumulator[prefix] = '';
    return;
  }

  if (Array.isArray(value)) {
    if (value.every(item => item === null || item === undefined)) {
      accumulator[prefix] = '';
      return;
    }

    if (value.every(item => typeof item !== 'object')) {
      accumulator[prefix] = value.map(item => item ?? '').join(';');
      return;
    }

    value.forEach((item, index) => {
      flattenValue(`${prefix}_${index}`, item, accumulator);
    });
    return;
  }

  if (typeof value === 'object') {
    Object.entries(value).forEach(([childKey, childValue]) => {
      flattenValue(`${prefix}_${childKey}`, childValue, accumulator);
    });
    return;
  }

  accumulator[prefix] = value;
}

function formatCsvValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  let stringValue;

  if (value instanceof Date) {
    stringValue = value.toISOString();
  } else if (typeof value === 'object') {
    stringValue = JSON.stringify(value);
  } else {
    stringValue = String(value);
  }

  const escaped = stringValue.replace(/"/g, '""');
  return /[",\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
}

function makeLinks(id) {
  return {
    self: { href: `/api/contacts/${id}` },
    "send-whatsapp": { href: `/api/contacts/${id}/whatsapp`, method: "POST" },
  "complete-survey": { href: `/survey.html?id=${id}` }
  };
}

// Enhanced agent query validation middleware
function validateAgentQuery(req, res, next) {
  const { query } = req.body;
  
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ 
      error: "Query is required and must be a string" 
    });
  }
  
  if (query.trim().length === 0) {
    return res.status(400).json({ 
      error: "Query cannot be empty" 
    });
  }
  
  if (query.length > 1000) {
    return res.status(400).json({ 
      error: "Query too long. Maximum 1000 characters." 
    });
  }
  
  next();
}

// Function to update message status
function updateMessageStatus(messageId, status, provider = null) {
  try {
    const data = readDB();
    const user = data.find(u => u.whatsappMessageId === messageId);
    
    if (user) {
      user.whatsappStatus = status;
      user.whatsappStatusUpdatedAt = new Date().toISOString();
      if (provider) user.whatsappProvider = provider;
      
      console.log(`[Status] Updated ${messageId}: ${status}`);
      writeDB(data);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error updating status:', error);
    return false;
  }
}

// --- Login Route ---
app.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  console.log('[Auth] Login attempt for user:', username);
  if (username === ADMIN_USER.username && password === ADMIN_USER.password) {
    // Prevent session fixation and ensure cookie is persisted before client redirect
    return req.session.regenerate((err) => {
      if (err) {
        console.error('Session regenerate failed:', err);
        return res.status(500).json({ error: 'Session error' });
      }
      req.session.authenticated = true;
      req.session.username = username;
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('Session save failed:', saveErr);
          return res.status(500).json({ error: 'Session error' });
        }
    console.log('[Auth] Login success; session id:', req.sessionID);
        return res.json({ success: true });
      });
    });
  }
  console.warn('[Auth] Login failed for user:', username);
  res.status(401).json({ error: 'Invalid credentials' });
});

// --- Logout Route ---
app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});


// --- Enhanced AI Endpoints ---

// Original full response endpoint (for technical users and debugging)
app.post("/api/admin/agent", validateAgentQuery, async (req, res) => {
  try {
    const { query } = req.body;
    const result = await orchestrator(query);
    
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Agent orchestration failed" });
  }
});

// Enhanced streamlined UI endpoint with intelligent response formatting
app.post("/api/admin/agent-ui", validateAgentQuery, async (req, res) => {
  try {
    const { query } = req.body;
    const fullResponse = await orchestrator(query);
    
    // Prefer the orchestrator's actual response and data
    let naturalResponse = (fullResponse.response || fullResponse.llmValidation || '').toString();
    if (!naturalResponse || naturalResponse.trim().length === 0) {
      // Final fallback (should rarely trigger with new orchestrator)
      const intentCapabilities = {
        knowledge: 'Municipal data analysis completed using MunicipalAnalysisEngine. I can provide insights about community satisfaction patterns, neighborhood engagement levels, issue priorities, and participation trends based on your survey data.',
        notification: 'Communication targeting analysis completed using resident segmentation. I can identify specific groups for WhatsApp outreach based on satisfaction levels, participation interest, geographic location, and response patterns.',
        ticket: 'Administrative operation processed through system health monitoring. I can provide operational insights, data quality assessments, cleanup recommendations, and system performance analytics.'
      };
      naturalResponse = intentCapabilities[fullResponse.intent] || `Processed: ${query}`;
    }
    naturalResponse = naturalResponse.replace(/\\n/g, '\n').trim();

    // Ensure residents list accompanies the response when available (defensive rendering for UIs)
    const residentsArr = Array.isArray(fullResponse.residents) ? fullResponse.residents : [];
    if (residentsArr.length) {
      // If the response does not already contain a residents section, append a concise list
      if (!/RESIDENTES/i.test(naturalResponse)) {
        const maxList = 50; // keep response readable; full list is also returned in JSON
        const preview = residentsArr.slice(0, maxList).map((r, idx) => {
          const name = r.name || '—';
          const nbh = r.neighborhood || '—';
          const sat = r.satisfaction ? ` • ${r.satisfaction}` : '';
          return `${idx + 1}. ${name} (${nbh})${sat}`;
        }).join('\n');
        const more = residentsArr.length > maxList ? `\n... e mais ${residentsArr.length - maxList} residentes` : '';
        naturalResponse += `\n\nRESIDENTES (${residentsArr.length}):\n${preview}${more}`;
      }
    }
    
    // Return enhanced response with architecture metadata
    res.json({
      response: naturalResponse,
      intent: fullResponse.intent,
      confidence: fullResponse.confidence,
      agent: fullResponse.agent || 'Municipal Assistant',
      // Pass through LLM + provenance so frontend can render premium sections
      llmEnhanced: !!fullResponse.llmEnhanced,
      provider: fullResponse.provider || null,
      model: fullResponse.model || null,
      responseQuality: fullResponse.responseQuality || 'data-driven',
      provenance: fullResponse.provenance || null,
      // Structured statistics (for premium insights)
      statistics: fullResponse.statistics || null,
      // Real data
      residents: fullResponse.residents || [],
      report: fullResponse.report || null,
      insights: fullResponse.insights || [],
      recommendations: fullResponse.recommendations || [],
      architecture: {
        version: 'refactored_v2',
        dataLayer: 'DataAccessLayer', 
        analysisEngine: 'MunicipalAnalysisEngine'
      },
      performance: {
        provider: fullResponse.provider,
        model: fullResponse.model,
        analysisEngine: fullResponse.analysisEngine,
        llmEnhanced: fullResponse.llmEnhanced || false,
        responseQuality: fullResponse.responseQuality || 'data-driven'
      },
      success: fullResponse.success,
      timestamp: fullResponse.timestamp,
      dataSource: fullResponse.dataSource || 'municipal_database'
    });
    
  } catch (err) {
    console.error('Enhanced UI Agent error:', err);
    
    // Intelligent error categorization and response
    let errorMessage = "I'm experiencing technical difficulties processing your request.";
    let errorCategory = 'unknown';
    
    if (err.message.includes('CLAUDE_API_KEY') || err.message.includes('GROQ_API_KEY') || err.message.includes('API key')) {
      errorMessage = "AI service configuration issue detected. Please verify API credentials.";
      errorCategory = 'configuration';
    } else if (err.message.includes('data.json') || err.message.includes('DataAccessLayer')) {
      errorMessage = "Municipal database connection issue. Please verify data file accessibility.";
      errorCategory = 'database';
    } else if (err.message.includes('timeout') || err.message.includes('ECONNRESET')) {
      errorMessage = "Request timeout occurred. The analysis took longer than expected.";
      errorCategory = 'timeout';
    } else if (err.message.includes('MunicipalAnalysisEngine')) {
      errorMessage = "Analysis engine error. Please try a different query approach.";
      errorCategory = 'analysis';
    }
    
    res.status(500).json({ 
      response: errorMessage + " Please try again, or contact your system administrator if the issue persists.",
      success: false,
      error: {
        category: errorCategory,
        message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      },
      architecture: {
        version: 'refactored_v2',
        errorLayer: err.message.includes('DataAccessLayer') ? 'data' : 
                   err.message.includes('MunicipalAnalysisEngine') ? 'analysis' : 'orchestration'
      },
      timestamp: new Date().toISOString(),
      intent: 'error'
    });
  }
});

// --- Standard API Endpoints ---

app.get("/api", (req, res) => {
  res.json({ 
    message: "Bingo Research API - Refactored Architecture", 
    base: BASE_URL,
    architecture: {
      version: "refactored_v2",
      dataLayer: "DataAccessLayer",
      analysisEngine: "MunicipalAnalysisEngine",
      agents: ["Knowledge", "Notification", "Ticket"]
    },
    whatsapp: {
      provider: process.env.WHATSAPP_PROVIDER,
      mode: process.env.WHATSAPP_MODE
    }
  });
});

// Age satisfaction dedicated endpoint (demographic satisfaction distribution)
app.get('/api/age-satisfaction', async (req, res) => {
  try {
    const MunicipalAnalysisEngine = require('./services/MunicipalAnalysisEngine');
    const engine = new MunicipalAnalysisEngine();
    const overall = await engine.analyzeSatisfaction();
    const age = await engine.analyzeSatisfactionByAge();
    res.json({
      success: true,
      generatedAt: new Date().toISOString(),
      overall: {
        totalResponses: overall.total,
        averageScore: overall.averageScore,
        dissatisfiedPercent: overall.dissatisfiedPercent,
        dissatisfactionTier: overall.dissatisfactionTier
      },
      age
    });
  } catch (e) {
    console.error('[API] /api/age-satisfaction error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// Enhanced health check with architecture diagnostics
app.get("/api/health", (req, res) => {
  const data = readDB();
  const stats = whatsappService.getStats(data);
  
  // Test architecture components
  const architectureHealth = {
    dataLayer: 'unknown',
    analysisEngine: 'unknown',
    orchestrator: 'unknown'
  };
  
  try {
    // Test DataAccessLayer
    const DataAccessLayer = require('./services/DataAccessLayer');
    const dataAccess = new DataAccessLayer();
    const testData = dataAccess.loadData();
    architectureHealth.dataLayer = testData.length > 0 ? 'healthy' : 'no_data';
  } catch (error) {
    architectureHealth.dataLayer = 'error';
  }
  
  try {
    // Test MunicipalAnalysisEngine  
    const MunicipalAnalysisEngine = require('./services/MunicipalAnalysisEngine');
    const analysisEngine = new MunicipalAnalysisEngine();
    architectureHealth.analysisEngine = 'healthy';
  } catch (error) {
    architectureHealth.analysisEngine = 'error';
  }
  
  try {
    // Test orchestrator
    architectureHealth.orchestrator = typeof orchestrator === 'function' ? 'healthy' : 'error';
  } catch (error) {
    architectureHealth.orchestrator = 'error';
  }
  
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    architecture: {
      version: "refactored_v2",
      components: architectureHealth,
      dataLayer: "DataAccessLayer",
      analysisEngine: "MunicipalAnalysisEngine",
      agents: ["Knowledge", "Notification", "Ticket"]
    },
    database: {
      contacts: data.length,
      lastModified: fs.existsSync(DB_FILE) ? fs.statSync(DB_FILE).mtime : null,
      filePath: DB_FILE
    },
    whatsapp: {
      provider: process.env.WHATSAPP_PROVIDER,
      mode: process.env.WHATSAPP_MODE,
      stats
    },
    performance: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeVersion: process.version
    }
  });
});

// Create contact
app.post("/api/contacts", (req, res) => {
  const { name, age, neighborhood, whatsapp } = req.body || {};
  
  if (!name || !age || !neighborhood || !whatsapp) {
    return res.status(400).json({ 
      error: "name, age, neighborhood and whatsapp required" 
    });
  }

  // Validate and format phone
  const formattedPhone = whatsappService.formatPhoneNumber(whatsapp);
  
  if (!whatsappService.validateBrazilianPhone(formattedPhone)) {
    return res.status(400).json({ 
      error: "Invalid WhatsApp number. Use Brazilian format (11999999999)" 
    });
  }

  const data = readDB();
  
  // Check for duplicates by phone
  const existing = data.find(d => d.whatsapp === formattedPhone);
  if (existing) {
    return res.status(409).json({ 
      error: "Number already registered", 
      existingContact: existing.name,
      id: existing.id 
    });
  }

  const id = Date.now();
  const entry = {
    id,
    name: String(name).trim(),
    age: Number(age),
    neighborhood: String(neighborhood).trim(),
    whatsapp: formattedPhone,
    createdAt: new Date().toISOString(),
    whatsappSentAt: null,
    whatsappMessageId: null,
    whatsappProvider: null,
    whatsappStatus: null,
    whatsappStatusUpdatedAt: null,
    clickedAt: null,
    survey: null
  };

  data.push(entry);
  writeDB(data);

  const surveyLink = `${getBaseUrl(req)}/survey.html?id=${id}`;

  return res.json({
    ...entry,
    surveyLink,
    _links: makeLinks(id)
  });
});

// List contacts with advanced filters
app.get("/api/contacts", (req, res) => {
  const { neighborhood, answered, sent, status, provider } = req.query;
  let data = readDB();

  // Apply filters
  if (neighborhood) {
    const q = String(neighborhood).toLowerCase();
    data = data.filter(d => (d.neighborhood || "").toLowerCase().includes(q));
  }
  
  if (answered === "true") data = data.filter(d => d.survey);
  if (answered === "false") data = data.filter(d => !d.survey);
  if (sent === "true") data = data.filter(d => d.whatsappSentAt);
  if (sent === "false") data = data.filter(d => !d.whatsappSentAt);
  if (status) data = data.filter(d => d.whatsappStatus === status);
  if (provider) data = data.filter(d => d.whatsappProvider === provider);

  // For compatibility with existing admin.html, return only array
  if (req.query.legacy === "true") {
    return res.json(data);
  }

  // Include statistics in response
  const stats = whatsappService.getStats(data);

  res.json({
    data,
    stats,
    filters: req.query,
    total: data.length
  });
});

// Get contact details
app.get("/api/contacts/:id", (req, res) => {
  const id = Number(req.params.id);
  const data = readDB();
  const user = data.find(u => u.id === id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ ...user, _links: makeLinks(id) });
});

// Update contact
app.put("/api/contacts/:id", (req, res) => {
  const id = Number(req.params.id);
  const data = readDB();
  const user = data.find(u => u.id === id);
  
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const { name, age, neighborhood, whatsapp } = req.body || {};

  // Validate required fields
  if (name !== undefined && (!name || name.trim().length === 0)) {
    return res.status(400).json({ error: "Name cannot be empty" });
  }

  if (age !== undefined && (isNaN(age) || age < 0)) {
    return res.status(400).json({ error: "Age must be a valid positive number" });
  }

  // Update fields if provided
  if (name !== undefined) {
    user.name = String(name).trim();
  }

  if (age !== undefined) {
    user.age = Number(age);
  }

  if (neighborhood !== undefined) {
    user.neighborhood = String(neighborhood).trim();
  }

  if (whatsapp !== undefined) {
    // Validate and format phone
    const formattedPhone = whatsappService.formatPhoneNumber(whatsapp);
    
    if (!whatsappService.validateBrazilianPhone(formattedPhone)) {
      return res.status(400).json({ 
        error: "Invalid WhatsApp number. Use Brazilian format (11999999999)" 
      });
    }

    // Check for duplicates by phone (excluding current user)
    const existing = data.find(d => d.whatsapp === formattedPhone && d.id !== id);
    if (existing) {
      return res.status(409).json({ 
        error: "Number already registered", 
        existingContact: existing.name,
        existingId: existing.id 
      });
    }

    user.whatsapp = formattedPhone;
  }

  // Update timestamp
  user.updatedAt = new Date().toISOString();

  writeDB(data);

  return res.json({ ...user, _links: makeLinks(id) });
});

// Delete contact
app.delete("/api/contacts/:id", (req, res) => {
  const id = Number(req.params.id);
  const data = readDB();
  const userIndex = data.findIndex(u => u.id === id);
  
  if (userIndex === -1) {
    return res.status(404).json({ error: "User not found" });
  }

  // Remove user from array
  data.splice(userIndex, 1);
  writeDB(data);

  return res.status(200).json({ success: true, message: "Contact deleted successfully" });
});

// Send WhatsApp - Enhanced with better error handling
app.post("/api/contacts/:id/whatsapp", async (req, res) => {
  const id = Number(req.params.id);
  const data = readDB();
  const user = data.find(u => u.id === id);
  
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  // Check if already sent recently (basic rate limiting)
  if (user.whatsappSentAt) {
    const lastSent = new Date(user.whatsappSentAt);
    const now = new Date();
    const diffMinutes = (now - lastSent) / (1000 * 60);
    
    if (diffMinutes < 5) {
      return res.status(429).json({ 
        error: "Wait 5 minutes before resending",
        lastSent: user.whatsappSentAt,
        retryAfter: Math.ceil(5 - diffMinutes)
      });
    }
  }

  const surveyLink = `${getBaseUrl(req)}/survey.html?id=${user.id}`;
  const message = `Olá ${user.name}! 🎉

Obrigado por participar do Bingo do Bem!

Sua opinião é muito importante para nós. Por favor, responda nossa pesquisa rápida:

${surveyLink}

Leva menos de 1 minuto! ⏱️`;

  try {
    // Send via WhatsApp Service
    const templateData = (process.env.WHATSAPP_MODE || '').toLowerCase() === 'real'
      ? whatsappService.createSurveyTemplate(user.name, surveyLink)
      : null;
    const result = await whatsappService.sendMessage(user.whatsapp, message, templateData);
    
    // Save send information
    user.whatsappSentAt = new Date().toISOString();
    user.whatsappMessageId = result.messageId;
    user.whatsappProvider = result.provider;
    user.whatsappStatus = result.status;
    user.whatsappStatusUpdatedAt = new Date().toISOString();
    
    writeDB(data);

    console.log(`[WhatsApp] Sent to ${user.name} (${user.whatsapp}) - ID: ${result.messageId}`);

    return res.json({
      success: true,
      message: `Message sent via ${result.provider}`,
      to: user.whatsapp,
      messageId: result.messageId,
      status: result.status,
      provider: result.provider,
      _links: makeLinks(user.id)
    });

  } catch (error) {
    console.error(`[WhatsApp] Error sending to ${user.name}:`, error.message);
    
    // Save failed attempt
    user.whatsappLastError = error.message;
    user.whatsappLastErrorAt = new Date().toISOString();
    writeDB(data);

    return res.status(500).json({ 
      success: false,
      error: "Error sending message",
      details: error.message,
      provider: process.env.WHATSAPP_PROVIDER
    });
  }
});

// Mark as sent manually (used when opening WhatsApp in browser)
app.post("/api/contacts/:id/mark-sent", (req, res) => {
  const id = Number(req.params.id);
  const data = readDB();
  const user = data.find(u => u.id === id);
  if (!user) return res.status(404).json({ error: "User not found" });

  user.whatsappSentAt = new Date().toISOString();
  user.whatsappProvider = 'manual';
  user.whatsappStatus = 'sent';
  user.whatsappStatusUpdatedAt = new Date().toISOString();
  writeDB(data);

  return res.json({ success: true, id: user.id, provider: 'manual', status: 'sent' });
});

// Track click
app.post("/api/contacts/:id/click", (req, res) => {
  const id = Number(req.params.id);
  const data = readDB();
  const user = data.find(u => u.id === id);
  if (!user) return res.status(404).json({ error: "User not found" });

  // Only register the first click
  if (!user.clickedAt) {
    user.clickedAt = new Date().toISOString();
    writeDB(data);
    console.log(`[Click] ${user.name} opened the survey link`);
  }

  res.json({ 
    message: "Click recorded", 
    clickedAt: user.clickedAt,
    isFirstClick: user.clickedAt === new Date().toISOString()
  });
});

// Receive survey
app.post("/api/survey", (req, res) => {
  const { id, issue, satisfaction, participate, otherIssue, cep, complemento } = req.body || {};
  if (!id) return res.status(400).json({ error: "id required" });

  const data = readDB();
  const user = data.find(u => u.id === Number(id));
  if (!user) return res.status(404).json({ error: "User not found" });

  if (!cep) {
    return res.status(400).json({ error: "cep required" });
  }

  const sanitizedCep = String(cep).replace(/\D/g, "");
  if (sanitizedCep.length !== 8) {
    return res.status(400).json({ error: "Invalid CEP format" });
  }

  const formattedCep = `${sanitizedCep.slice(0, 5)}-${sanitizedCep.slice(5)}`;
  const complementoValue = typeof complemento === "string" ? complemento.trim() : "";

  // Avoid duplicate responses
  if (user.survey) {
    return res.status(409).json({ 
      error: "Survey already answered", 
      answeredAt: user.survey.answeredAt 
    });
  }

  const trimmedOtherIssue = typeof otherIssue === "string" ? otherIssue.trim() : "";
  const resolvedIssue = issue === "Outros" ? (trimmedOtherIssue || "Outros") : issue;
  const resolvedOtherIssue = issue === "Outros" ? (trimmedOtherIssue || null) : null;

  user.survey = {
    cep: formattedCep,
    complemento: complementoValue ? complementoValue : null,
    issue: resolvedIssue,
    otherIssue: resolvedOtherIssue,
    satisfaction,
    participate,
    answeredAt: new Date().toISOString()
  };

  writeDB(data);
  console.log(`[Survey] ${user.name} answered the survey`);

  res.json({ 
    message: "Survey saved", 
    survey: user.survey 
  });
});

// Short link redirect: /l/:id -> /survey.html?id=:id (records click)
app.get('/l/:id', (req, res) => {
  const id = Number(req.params.id);
  const data = readDB();
  const user = data.find(u => u.id === id);
  if (!user) return res.status(404).send('Link inválido');

  if (!user.clickedAt) {
    user.clickedAt = new Date().toISOString();
    writeDB(data);
    console.log(`[Click] ${user.name} opened the short link`);
  }

  // Redirect to the full survey URL (keeps compatibility)
  res.redirect(302, `/survey.html?id=${id}`);
});

// --- WEBHOOKS ---

// Meta WhatsApp Webhook - Verification
app.get('/webhooks/meta', (req, res) => {
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('[Meta Webhook] Verification:', { mode, token: token ? 'SET' : 'NOT_SET' });

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[Meta Webhook] Verification successful');
    res.status(200).send(challenge);
  } else {
    console.log('[Meta Webhook] Verification failed');
    res.sendStatus(403);
  }
});

// Meta WhatsApp Webhook - Receive status
app.post('/webhooks/meta', (req, res) => {
  // express.raw was used for /webhooks; req.body is a Buffer
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : JSON.parse(req.body.toString('utf8'));
  
  // Validate signature (in production)
  if (process.env.NODE_ENV === 'production') {
    const signature = req.get('X-Hub-Signature-256');
    if (!whatsappService.validateMetaWebhook(body, signature)) {
      console.log('[Meta Webhook] Invalid signature');
      return res.sendStatus(401);
    }
  }

  console.log('[Meta Webhook] Received:', JSON.stringify(body, null, 2));
  
  if (body.object === 'whatsapp_business_account') {
    body.entry?.forEach(entry => {
      entry.changes?.forEach(change => {
        if (change.field === 'messages') {
          // Process delivery status
          const statuses = change.value.statuses || [];
          statuses.forEach(status => {
            const processedStatus = whatsappService.processMetaStatus(status);
            const updated = updateMessageStatus(
              processedStatus.messageId, 
              processedStatus.status, 
              'meta'
            );
            
            if (updated) {
              console.log(`[Meta Status] ${processedStatus.messageId}: ${processedStatus.status}`);
            }
          });

          // Process received messages (optional)
          const messages = change.value.messages || [];
          messages.forEach(message => {
            console.log('[Meta] Message received:', message);
            // Here you can process user responses
          });
        }
      });
    });

    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

// Twilio Webhook
app.post('/webhooks/twilio', express.urlencoded({ extended: true }), (req, res) => {
  console.log('[Twilio Webhook] Received:', req.body);
  
  const processedStatus = whatsappService.processTwilioStatus(req.body);
  const updated = updateMessageStatus(
    processedStatus.messageId, 
    processedStatus.status, 
    'twilio'
  );

  if (updated) {
    console.log(`[Twilio Status] ${processedStatus.messageId}: ${processedStatus.status}`);
  }

  res.status(200).send('OK');
});

// Enhanced CSV export with architecture metadata
app.get("/api/export", (req, res) => {
  const data = readDB();
  const flattenedRows = data.map(flattenRecord);

  const defaultColumns = [
    "id",
    "name",
    "age",
    "neighborhood",
    "whatsapp",
    "createdAt",
    "updatedAt",
    "whatsappSentAt",
    "whatsappProvider",
    "whatsappStatus",
    "whatsappMessageId",
    "whatsappStatusUpdatedAt",
    "clickedAt",
    "survey_issue",
    "survey_otherIssue",
    "survey_satisfaction",
    "survey_participate",
    "survey_answeredAt"
  ];

  const discoveredColumns = new Map();
  flattenedRows.forEach(row => {
    Object.entries(row).forEach(([column, value]) => {
      const hasValue = value !== '' && value !== null && value !== undefined;

      if (!discoveredColumns.has(column)) {
        discoveredColumns.set(column, hasValue);
        return;
      }

      if (!discoveredColumns.get(column) && hasValue) {
        discoveredColumns.set(column, true);
      }
    });
  });

  const columns = [...defaultColumns];
  discoveredColumns.forEach((hasValue, column) => {
    if (hasValue && !columns.includes(column)) {
      columns.push(column);
    }
  });

  if (columns.length === 0) {
    columns.push(...defaultColumns);
  }

  const headerRow = columns.map(column => formatCsvValue(column)).join(",");
  const dataRows = flattenedRows.map(row => {
    return columns.map(column => formatCsvValue(row[column])).join(",");
  });

  const csvLines = [headerRow, ...dataRows];
  const csvContent = csvLines.join("\n");
  const filename = `municipal_contacts_${new Date().toISOString().split("T")[0]}_refactored.csv`;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("X-Architecture-Version", "refactored_v2");
  return res.send(`\ufeff${csvContent}`);
});

// Enhanced statistics endpoint with architecture insights
app.get("/api/stats", (req, res) => {
  const data = readDB();
  const stats = whatsappService.getStats(data);
  
  // Statistics by neighborhood
  const byNeighborhood = {};
  data.forEach(user => {
    const neighborhood = user.neighborhood || 'Not informed';
    if (!byNeighborhood[neighborhood]) {
      byNeighborhood[neighborhood] = { total: 0, sent: 0, clicked: 0, answered: 0 };
    }
    byNeighborhood[neighborhood].total++;
    if (user.whatsappSentAt) byNeighborhood[neighborhood].sent++;
    if (user.clickedAt) byNeighborhood[neighborhood].clicked++;
    if (user.survey) byNeighborhood[neighborhood].answered++;
  });

  // Statistics by provider
  const byProvider = {};
  data.filter(u => u.whatsappProvider).forEach(user => {
    const provider = user.whatsappProvider;
    if (!byProvider[provider]) byProvider[provider] = { total: 0, delivered: 0, failed: 0 };
    byProvider[provider].total++;
    if (user.whatsappStatus === 'delivered') byProvider[provider].delivered++;
    if (user.whatsappStatus === 'failed') byProvider[provider].failed++;
  });

  res.json({
    overview: stats,
    byNeighborhood,
    byProvider,
    architecture: {
      version: "refactored_v2",
      dataProcessing: "DataAccessLayer + MunicipalAnalysisEngine",
      advantages: [
        "Eliminated double processing",
        "Clean separation of concerns",
        "Municipal domain intelligence",
        "Improved error handling"
      ]
    },
    recentActivity: data
      .filter(u => u.whatsappSentAt)
      .sort((a, b) => new Date(b.whatsappSentAt) - new Date(a.whatsappSentAt))
      .slice(0, 10)
      .map(u => ({
        name: u.name,
        whatsappSentAt: u.whatsappSentAt,
        status: u.whatsappStatus,
        clicked: !!u.clickedAt,
        answered: !!u.survey
      }))
  });
});

// Enhanced bulk send endpoint
app.post("/api/bulk-send", async (req, res) => {
  const { filter = {}, dryRun = false } = req.body;
  const data = readDB();
  
  // Apply filters to select users
  let usersToSend = data.filter(user => {
    // Don't send if already sent recently (last hour)
    if (user.whatsappSentAt) {
      const lastSent = new Date(user.whatsappSentAt);
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (lastSent > hourAgo) return false;
    }

    // Apply custom filters
    if (filter.neighborhood && !user.neighborhood.toLowerCase().includes(filter.neighborhood.toLowerCase())) {
      return false;
    }
    if (filter.onlyNotSent && user.whatsappSentAt) return false;
    if (filter.onlyNotAnswered && user.survey) return false;
    
    return true;
  });

  if (dryRun) {
    return res.json({
      dryRun: true,
      usersToSend: usersToSend.length,
      users: usersToSend.map(u => ({ id: u.id, name: u.name, whatsapp: u.whatsapp })),
      architecture: "refactored_v2"
    });
  }

  // Send in batches with rate limiting
  const results = [];
  const batchSize = 5; // Send 5 at a time
  const delayBetweenBatches = 2000; // 2 seconds between batches

  for (let i = 0; i < usersToSend.length; i += batchSize) {
    const batch = usersToSend.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (user) => {
      try {
        const surveyLink = `${getBaseUrl(req)}/survey.html?id=${user.id}`;
        const message = `Olá ${user.name}! 🎉\nSua opinião é muito importante. Por favor, responda nossa pesquisa rápida:\n\n${surveyLink}\n\nLeva menos de 1 minuto! ⏱️`;
        const templateData = (process.env.WHATSAPP_MODE || '').toLowerCase() === 'real'
          ? whatsappService.createSurveyTemplate(user.name, surveyLink)
          : null;
        const result = await whatsappService.sendMessage(user.whatsapp, message, templateData);
        
        // Update user
        user.whatsappSentAt = new Date().toISOString();
        user.whatsappMessageId = result.messageId;
        user.whatsappProvider = result.provider;
        user.whatsappStatus = result.status;

        return { success: true, user: user.name, messageId: result.messageId };
      } catch (error) {
        console.error(`Error sending to ${user.name}:`, error.message);
        return { success: false, user: user.name, error: error.message };
      }
    });

    const batchResults = await Promise.allSettled(batchPromises);
    results.push(...batchResults.map(r => r.value));

    // Save progress after each batch
    writeDB(data);

    // Wait before next batch (except for the last one)
    if (i + batchSize < usersToSend.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  res.json({
    message: `Bulk send completed using refactored architecture`,
    total: results.length,
    successful,
    failed,
    results,
    architecture: {
      version: "refactored_v2",
      performance: "Enhanced batch processing with improved error handling"
    }
  });
});

// Global error handling middleware with architecture awareness
app.use((error, req, res, next) => {
  console.error('Unhandled server error:', error);
  
  // Enhanced error categorization
  let errorCategory = 'unknown';
  if (error.message.includes('DataAccessLayer')) errorCategory = 'data_layer';
  if (error.message.includes('MunicipalAnalysisEngine')) errorCategory = 'analysis_engine';
  if (error.message.includes('orchestrator')) errorCategory = 'orchestration';
  
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    architecture: {
      version: "refactored_v2",
      errorLayer: errorCategory
    },
    timestamp: new Date().toISOString()
  });
});

// Start server with enhanced logging
app.listen(PORT, () => {
  console.log(`🚀 Municipal System Server (Refactored v2) running at ${BASE_URL}`);
  console.log(`🏛️ Architecture: DataAccessLayer → MunicipalAnalysisEngine → Agents`);
  console.log(`📱 WhatsApp Provider: ${process.env.WHATSAPP_PROVIDER} (${process.env.WHATSAPP_MODE})`);
  console.log(`🤖 AI Agents: Knowledge, Notification, Ticket`);
  
  if (process.env.WHATSAPP_MODE === 'real') {
    console.log(`🔗 Webhooks available:`);
    console.log(`   Meta: ${BASE_URL}/webhooks/meta`);
    console.log(`   Twilio: ${BASE_URL}/webhooks/twilio`);
  }
  
  // Architecture health check on startup
  try {
    const DataAccessLayer = require('./services/DataAccessLayer');
    const MunicipalAnalysisEngine = require('./services/MunicipalAnalysisEngine');
    console.log(`✅ DataAccessLayer: Loaded successfully`);
    console.log(`✅ MunicipalAnalysisEngine: Loaded successfully`);
    console.log(`✅ Orchestrator: Loaded successfully`);
  } catch (error) {
    console.error(`❌ Architecture component failed to load:`, error.message);
  }
});

// Graceful shutdown with cleanup
process.on('SIGTERM', () => {
  console.log('🔄 Server received SIGTERM, shutting down gracefully...');
  // Clean up any ongoing operations
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🔄 Server received SIGINT, shutting down gracefully...');
  // Clean up any ongoing operations  
  process.exit(0);
});