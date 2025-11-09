// services/ScopeClassifier.js - LLM-based domain scope classification (municipal intelligence)
// Provides an early guard to prevent off-domain / out-of-scope queries from generating fabricated reports.
// Relies on the existing CLAUDE_API_KEY; gracefully degrades if unavailable or on failure.

const axios = require('axios');

class ScopeClassifier {
  constructor(options = {}) {
    this.provider = 'claude';
    const rawApiKey = process.env.CLAUDE_API_KEY || null;
    // Validate API key is non-empty string
    this.apiKey = (rawApiKey && typeof rawApiKey === 'string' && rawApiKey.trim().length > 0) 
      ? rawApiKey.trim() 
      : null;
    this.model = options.model || process.env.SCOPE_CLASSIFIER_MODEL || 'claude-3-5-sonnet-20241022';
    this.endpoint = 'https://api.anthropic.com/v1/messages';
    this.enabled = !!this.apiKey; // auto-disable if no key
    
    if (!this.enabled) {
      console.warn('[ScopeClassifier] CLAUDE_API_KEY not configured. Scope classification will use fallback mode.');
    }
  }

  /**
   * Classify a user query as in-scope or out-of-scope for the municipal intelligence domain.
   * @param {string} query
   * @returns {Promise<{inScope:boolean, confidence:number, categories:string[], reason:string, raw?:string, error?:string}>}
   */
  async classify(query) {
    if (!query || !query.trim()) {
      return { inScope: false, confidence: 0, categories: [], reason: 'Empty query' };
    }

    if (!this.enabled) {
      // If disabled, optimistically mark in-scope so existing logic proceeds.
      return { inScope: true, confidence: 0.5, categories: ['unknown'], reason: 'LLM scope classifier disabled (no API key)' };
    }

    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = `QUERY:\n${query}\n\nReturn ONLY strict JSON.`;

    try {
      // Claude API uses different format - system message is a separate parameter
      const response = await axios.post(this.endpoint, {
        model: this.model,
        max_tokens: 300,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ],
        temperature: 0
      }, {
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        },
        timeout: 8000
      });

      // Claude API response format: content is an array with text content
      const raw = response.data.content?.[0]?.text || '';
      const parsed = this.safeParseJson(raw);
      if (!parsed) {
        return { inScope: true, confidence: 0.4, categories: ['unparsed'], reason: 'Could not parse classifier JSON', raw };
      }

      // Normalize output structure
      const inScope = parsed.in_scope === true || parsed.inScope === true || /in[-_]?scope/i.test(parsed.status || '');
      const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : (typeof parsed.score === 'number' ? parsed.score : 0.5);
      const categories = Array.isArray(parsed.categories) ? parsed.categories : [];
      const reason = parsed.reason || parsed.explanation || 'No reason provided';
      let finalInScope = inScope;
      let finalReason = reason;

      // Heuristic safeguard: if model was uncertain (confidence <0.65) AND query clearly lacks municipal tokens, flip to out_of_scope.
      if (finalInScope) {
        const ql = query.toLowerCase();
        const municipalTokens = [
          'satisfacao','satisfação','engajamento','participacao','participação','bairro','equidade','municip','cidada','cidadã','cidadão','governanca','governança','resposta','taxa','survey','residente','morador'
        ];
        const matches = municipalTokens.filter(t => ql.includes(t)).length;
        if (confidence < 0.65 && matches === 0) {
          finalInScope = false;
          finalReason = 'Low confidence and no municipal domain tokens detected';
        }
      }

      return { inScope: finalInScope, confidence: Math.max(0, Math.min(1, confidence)), categories, reason: finalReason, raw };
    } catch (error) {
      // Enhanced error logging for API key issues
      if (error.response?.status === 401 || error.response?.status === 403) {
        console.error('[ScopeClassifier] API authentication failed. Please verify CLAUDE_API_KEY is valid.');
      } else if (error.message?.includes('API key') || error.message?.includes('authentication')) {
        console.error('[ScopeClassifier] API key error:', error.message);
      } else {
        console.warn('[ScopeClassifier] Classification call failed, using fallback:', error.message);
      }
      
      return { inScope: true, confidence: 0.5, categories: ['error-fallback'], reason: 'Classifier call failed', error: error.message };
    }
  }

  buildSystemPrompt() {
    return `You are a strict domain scope classifier for a Municipal Citizen Engagement & Urban Governance intelligence system.\n\nALLOWED DOMAIN CATEGORIES (IN-SCOPE):\n1. Citizen Satisfaction & Feedback (scores, response rates, dissatisfaction, improvement)\n2. Citizen Engagement & Participation (participation rates, outreach, messaging strategies)\n3. Geographic Equity & Neighborhood Performance (neighborhood disparities, equity gaps)\n4. Operational Performance & Service Delivery (system health, response efficiency, resource allocation)\n5. Municipal Benchmarking & Comparative Analysis (benchmarks, trends, statistical confidence)\n6. Survey Data Insights (survey completion, abandonment, segmentation, targeting)\n7. Resident/Citizen Lookup (searching for specific residents or citizens by name - this is IN-SCOPE as it's core municipal intelligence for citizen engagement)\n\nIMPORTANT: Queries that search for residents or citizens by name (e.g., "Encontre o João Silva", "Busque Maria Santos", "Find John Smith") are IN-SCOPE as they relate to citizen engagement and municipal database queries.\n\nOUT-OF-SCOPE EXAMPLES: food orders (pizza, restaurant), weather forecasts, entertainment (movies, Netflix), sports scores, astrology, generic chit-chat, jokes, gaming, personal finance unrelated to municipal services, medical advice, ecommerce, travel, coding help.\n\nTASK: Classify the user query. DO NOT answer the query. Output STRICT JSON with keys: inScope (boolean), confidence (0-1 float), categories (array of zero or more of the allowed categories EXACTLY as listed above), reason (short explanation), canonical_intent (string: one of satisfaction|engagement|geographic|operational|benchmarking|survey|out_of_scope). If out of scope set inScope false and categories [].\n\nCRITICAL: Output ONLY JSON, no markdown.`;
  }

  safeParseJson(text) {
    if (!text) return null;
    // Attempt direct parse
    try { return JSON.parse(text); } catch (_) {}
    // Extract first JSON object heuristically
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const candidate = text.slice(firstBrace, lastBrace + 1);
      try { return JSON.parse(candidate); } catch (_) { return null; }
    }
    return null;
  }
}

module.exports = ScopeClassifier;
