// services/QueryAnalyzer.js - Unified query analysis combining heuristic and LLM-based classification
// Single source of truth for query understanding: scope, intent, and data needs

const ScopeClassifier = require('./ScopeClassifier');

class QueryAnalyzer {
  constructor() {
    this.scopeClassifier = new ScopeClassifier();
    this.name = 'Query Analyzer';
  }

  /**
   * Analyze query to determine scope, intent, and data needs
   * @param {string} query - User query
   * @returns {Promise<{scope: Object, intent: string, queryType: string, dataNeeds: string[], urgency: string}>}
   */
  async analyzeQuery(query) {
    if (!query || !query.trim()) {
      return this.createDefaultAnalysis('Empty query');
    }

    // Step 0: Pre-check for statistical/operational queries about the database
    // These should always be in-scope as they're asking about system data
    const isStatisticalQuery = this.isStatisticalOrOperationalQuery(query);
    if (isStatisticalQuery) {
      // Skip scope classification for statistical queries and proceed directly
      const heuristicAnalysis = this.analyzeQueryHeuristically(query);
      // Statistical queries asking for data/information are knowledge queries
      if (!heuristicAnalysis.primaryIntent) {
        heuristicAnalysis.primaryIntent = 'knowledge';
        heuristicAnalysis.queryType = 'analysis';
      }
      
      return {
        scope: {
          inScope: true,
          confidence: 0.9,
          categories: ['operational'],
          canonicalIntent: 'operational',
          reason: 'Statistical/operational query about municipal database'
        },
        intent: heuristicAnalysis.primaryIntent,
        queryType: heuristicAnalysis.queryType,
        dataNeeds: heuristicAnalysis.dataNeeds,
        urgency: heuristicAnalysis.urgency,
        blocked: false
      };
    }

    // Step 0.25: Pre-check for analysis/report queries (CRITICAL: before name search detection)
    // This prevents queries like "Mostrar análise de satisfação" from being misclassified as name searches
    const normalize = (s) => (s || '').toString().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    const qn = normalize(query);
    
    const analysisKeywords = [
      'análise', 'analysis', 'relatório', 'report', 'estatística', 'statistics',
      'satisfação', 'satisfaction', 'engajamento', 'engagement', 
      'bairro', 'neighborhood', 'bairros', 'neighborhoods',
      'resumo', 'summary', 'overview', 'visão', 'view', 'visao',
      'problema', 'problem', 'problemas', 'problems',
      'questão', 'questao', 'question', 'questões', 'questoes', 'questions',
      'participação', 'participacao', 'participation',
      'idade', 'age', 'faixa etária', 'faixa etaria', 'age bracket'
    ];
    
    const displayVerbs = [
      'mostrar', 'mostre', 'exibir', 'exiba', 'show', 'display',
      'listar', 'lista', 'list', 'trazer', 'traga', 'bring',
      'apresentar', 'apresente', 'present'
    ];
    
    // CRITICAL: Normalize keywords before comparison to handle accents
    const normalizedKeywords = analysisKeywords.map(kw => normalize(kw));
    const normalizedVerbs = displayVerbs.map(v => normalize(v));
    
    const hasAnalysisKeyword = normalizedKeywords.some(kw => qn.includes(kw));
    const hasDisplayVerb = normalizedVerbs.some(v => qn.includes(v));
    
    // If query contains both analysis keyword and display verb, it's an analysis query
    if (hasAnalysisKeyword && hasDisplayVerb) {
      const heuristicAnalysis = this.analyzeQueryHeuristically(query);
      heuristicAnalysis.primaryIntent = 'knowledge';
      heuristicAnalysis.queryType = 'analysis';
      
      // CRITICAL: Remove name_search if it was incorrectly added by analyzeQueryHeuristically
      const nameSearchIndex = heuristicAnalysis.dataNeeds.indexOf('name_search');
      if (nameSearchIndex > -1) {
        heuristicAnalysis.dataNeeds.splice(nameSearchIndex, 1);
      }
      
      // Add specific data needs based on keywords
      if (qn.includes('satisf') || qn.includes('satisfação') || qn.includes('satisfaction')) {
        if (!heuristicAnalysis.dataNeeds.includes('satisfaction_analysis')) {
          heuristicAnalysis.dataNeeds.push('satisfaction_analysis');
        }
      }
      if (qn.includes('bairro') || qn.includes('neighborhood')) {
        if (!heuristicAnalysis.dataNeeds.includes('geographic')) {
          heuristicAnalysis.dataNeeds.push('geographic');
        }
      }
      if (qn.includes('idade') || qn.includes('age') || qn.includes('faixa')) {
        if (!heuristicAnalysis.dataNeeds.includes('age_analysis')) {
          heuristicAnalysis.dataNeeds.push('age_analysis');
        }
      }
      
      return {
        scope: {
          inScope: true,
          confidence: 0.95,
          categories: ['survey', 'analysis'],
          canonicalIntent: 'satisfaction',
          reason: 'Analysis/report query detected - requesting data analysis, not name search'
        },
        intent: 'knowledge',
        queryType: 'analysis',
        dataNeeds: heuristicAnalysis.dataNeeds,
        urgency: 'normal',
        blocked: false
      };
    }
    
    // Also check for analysis queries without explicit display verbs (e.g., "análise de satisfação")
    if (hasAnalysisKeyword && (qn.includes('de') || qn.includes('do') || qn.includes('da'))) {
      // Pattern like "análise de satisfação" or "relatório de bairros"
      const heuristicAnalysis = this.analyzeQueryHeuristically(query);
      heuristicAnalysis.primaryIntent = 'knowledge';
      heuristicAnalysis.queryType = 'analysis';
      
      return {
        scope: {
          inScope: true,
          confidence: 0.9,
          categories: ['survey', 'analysis'],
          canonicalIntent: 'satisfaction',
          reason: 'Analysis query pattern detected (analysis keyword + preposition)'
        },
        intent: 'knowledge',
        queryType: 'analysis',
        dataNeeds: heuristicAnalysis.dataNeeds,
        urgency: 'normal',
        blocked: false
      };
    }

    // Step 0.4: Pre-check for resident filter queries (dissatisfied, not interested, etc.)
    // These should be treated as notification/knowledge queries, not name searches
    // Reuse qn from Step 0.25 (already normalized)
    
    const residentFilterKeywords = [
      'insatisfeito', 'insatisfeitos', 'dissatisfied', 'unsatisfied',
      'nao querem participar', 'nao quer participar', 'not interested',
      'nao interessados', 'nao interessado', 'sem interesse',
      'satisfeito', 'satisfeitos', 'satisfied',
      'interessado', 'interessados', 'interested', 'querem participar'
    ];
    
    const filterVerbs = [
      'encontrar', 'encontre', 'encontra', 'find', 'buscar', 'busque',
      'listar', 'lista', 'list', 'mostrar', 'mostre', 'show',
      'exibir', 'exiba', 'display', 'trazer', 'traga'
    ];
    
    const hasFilterKeyword = residentFilterKeywords.some(kw => qn.includes(kw));
    const hasFilterVerb = filterVerbs.some(v => qn.includes(v));
    const hasResidentNoun = qn.includes('morador') || qn.includes('moradores') || 
                           qn.includes('resident') || qn.includes('residents') ||
                           qn.includes('cidadao') || qn.includes('cidadaos') ||
                           qn.includes('cidadas');
    
    // If query has filter keyword + verb + resident noun, it's a filter query, not name search
    if (hasFilterKeyword && (hasFilterVerb || hasResidentNoun)) {
      const heuristicAnalysis = this.analyzeQueryHeuristically(query);
      
      // CRITICAL: Remove name_search from dataNeeds if it was incorrectly added
      const nameSearchIndex = heuristicAnalysis.dataNeeds.indexOf('name_search');
      if (nameSearchIndex > -1) {
        heuristicAnalysis.dataNeeds.splice(nameSearchIndex, 1);
      }
      
      // Determine intent based on keywords
      if (qn.includes('insatisf') || qn.includes('dissatisfied')) {
        // Dissatisfied residents - can be knowledge (analysis) or notification (listing)
        if (hasFilterVerb && (qn.includes('listar') || qn.includes('mostrar') || qn.includes('list') || qn.includes('show'))) {
          heuristicAnalysis.primaryIntent = 'notification';
          heuristicAnalysis.queryType = 'listing';
          if (!heuristicAnalysis.dataNeeds.includes('dissatisfied')) {
            heuristicAnalysis.dataNeeds.push('dissatisfied');
          }
        } else {
          heuristicAnalysis.primaryIntent = 'knowledge';
          heuristicAnalysis.queryType = 'analysis';
          if (!heuristicAnalysis.dataNeeds.includes('dissatisfied')) {
            heuristicAnalysis.dataNeeds.push('dissatisfied');
          }
        }
      } else if (qn.includes('particip') || qn.includes('interessad')) {
        // Participation queries - usually notification
        heuristicAnalysis.primaryIntent = 'notification';
        heuristicAnalysis.queryType = 'listing';
        if (qn.includes('nao') || qn.includes('not') || qn.includes('sem interesse')) {
          if (!heuristicAnalysis.dataNeeds.includes('participation_not_interested')) {
            heuristicAnalysis.dataNeeds.push('participation_not_interested');
          }
        } else {
          if (!heuristicAnalysis.dataNeeds.includes('participation_interested')) {
            heuristicAnalysis.dataNeeds.push('participation_interested');
          }
        }
      }
      
      return {
        scope: {
          inScope: true,
          confidence: 0.95,
          categories: ['survey', 'engagement'],
          canonicalIntent: 'survey',
          reason: 'Resident filter query detected - requesting filtered resident list, not name search'
        },
        intent: heuristicAnalysis.primaryIntent,
        queryType: heuristicAnalysis.queryType,
        dataNeeds: heuristicAnalysis.dataNeeds,
        urgency: heuristicAnalysis.urgency,
        blocked: false
      };
    }

    // Step 0.5: Pre-check for name/resident searches
    // These should always be in-scope as searching for citizens/residents is core municipal intelligence
    const nameSearchResult = this.detectNameSearch(query);
    if (nameSearchResult.isNameSearch) {
      const heuristicAnalysis = this.analyzeQueryHeuristically(query);
      // Ensure name search intent is set
      if (!heuristicAnalysis.primaryIntent || heuristicAnalysis.primaryIntent !== 'knowledge') {
        heuristicAnalysis.primaryIntent = 'knowledge';
      }
      if (!heuristicAnalysis.dataNeeds.includes('name_search')) {
        heuristicAnalysis.dataNeeds.push('name_search');
      }
      
      return {
        scope: {
          inScope: true,
          confidence: 0.95,
          categories: ['survey', 'engagement'],
          canonicalIntent: 'survey',
          reason: 'Name/resident search query - core municipal intelligence capability'
        },
        intent: heuristicAnalysis.primaryIntent,
        queryType: heuristicAnalysis.queryType || 'listing',
        dataNeeds: heuristicAnalysis.dataNeeds,
        urgency: heuristicAnalysis.urgency,
        blocked: false
      };
    }

    // Step 1: LLM-based scope classification
    const scope = await this.scopeClassifier.classify(query);
    
    // Step 2: Heuristic-based intent detection
    const heuristicAnalysis = this.analyzeQueryHeuristically(query);
    
    // Step 3: Map canonical intent from scope classifier if available
    if (scope.inScope && scope.canonical_intent) {
      const mappedIntent = this.mapCanonicalIntent(scope.canonical_intent);
      if (mappedIntent) {
        heuristicAnalysis.primaryIntent = mappedIntent;
      }
    }

    // Step 4: Check if query should be blocked (out of scope)
    // But allow override if it's a valid statistical query or name search that was missed
    if (scope.inScope === false) {
      // Double-check: if it looks like a statistical query, override the classification
      if (this.isStatisticalOrOperationalQuery(query)) {
        const heuristicAnalysis = this.analyzeQueryHeuristically(query);
        return {
          scope: {
            inScope: true,
            confidence: 0.85,
            categories: ['operational', 'survey'],
            canonicalIntent: 'operational',
            reason: 'Statistical query about municipal database (heuristic override)'
          },
          intent: heuristicAnalysis.primaryIntent || 'knowledge',
          queryType: heuristicAnalysis.queryType || 'analysis',
          dataNeeds: heuristicAnalysis.dataNeeds,
          urgency: heuristicAnalysis.urgency,
          blocked: false
        };
      }
      
      // Double-check: if it looks like a name search, override the classification
      const nameSearchResult = this.detectNameSearch(query);
      if (nameSearchResult.isNameSearch) {
        const heuristicAnalysis = this.analyzeQueryHeuristically(query);
        if (!heuristicAnalysis.dataNeeds.includes('name_search')) {
          heuristicAnalysis.dataNeeds.push('name_search');
        }
        return {
          scope: {
            inScope: true,
            confidence: 0.9,
            categories: ['survey', 'engagement'],
            canonicalIntent: 'survey',
            reason: 'Name/resident search query (heuristic override)'
          },
          intent: 'knowledge',
          queryType: heuristicAnalysis.queryType || 'listing',
          dataNeeds: heuristicAnalysis.dataNeeds,
          urgency: heuristicAnalysis.urgency,
          blocked: false
        };
      }
      
      return {
        scope: {
          inScope: false,
          reason: scope.reason,
          confidence: scope.confidence
        },
        intent: 'out_of_scope',
        queryType: 'blocked',
        dataNeeds: [],
        urgency: 'normal',
        blocked: true
      };
    }

    // Step 5: Secondary heuristic check for low-confidence classifications
    if (scope.inScope === true && scope.confidence < 0.65) {
      const hasMunicipalTokens = this.hasMunicipalDomainTokens(query);
      if (!hasMunicipalTokens) {
        return {
          scope: {
            inScope: false,
            reason: 'Low-confidence classification and no municipal domain tokens detected',
            confidence: scope.confidence
          },
          intent: 'out_of_scope',
          queryType: 'blocked',
          dataNeeds: [],
          urgency: 'normal',
          blocked: true
        };
      }
    }

    return {
      scope: {
        inScope: true,
        confidence: scope.confidence,
        categories: scope.categories || [],
        canonicalIntent: scope.canonical_intent || null,
        reason: scope.reason
      },
      intent: heuristicAnalysis.primaryIntent,
      queryType: heuristicAnalysis.queryType,
      dataNeeds: heuristicAnalysis.dataNeeds,
      urgency: heuristicAnalysis.urgency,
      blocked: false
    };
  }

  /**
   * Heuristic-based query analysis (fast, rule-based)
   */
  analyzeQueryHeuristically(query) {
    const normalize = (s) => (s || '').toString().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    const qn = normalize(query);
    
    const analysis = {
      primaryIntent: 'knowledge',
      queryType: 'analysis',
      dataNeeds: [],
      urgency: 'normal'
    };

    // CRITICAL: Name search detection (highest priority)
    const nameSearchVerbs = ['encontre', 'encontrar', 'encontra', 'busque', 'buscar', 'busca', 'find', 'search', 'procure', 'procurar', 'procura', 'mostre', 'mostrar', 'mostra', 'show', 'exiba', 'exibir', 'traga', 'trazer', 'quem e', 'quem eh'];
    const hasNameSearchVerb = nameSearchVerbs.some(t => qn.includes(t));
    
    if (hasNameSearchVerb) {
      // Check if there are words that look like names (not just common words)
      const commonWords = ['o', 'a', 'os', 'as', 'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'the', 'a', 'an'];
      const words = query.split(/\s+/).filter(w => {
        const normalized = normalize(w);
        return !commonWords.includes(normalized) && !nameSearchVerbs.includes(normalized);
      });
      const nameLikeWords = words.filter(w => w.length >= 2 && /[a-záàâãéèêíìîóòôõúùûç]/i.test(w));
      
      if (nameLikeWords.length >= 1) {
        analysis.primaryIntent = 'knowledge';
        analysis.queryType = 'listing';
        analysis.dataNeeds.push('name_search');
        return analysis;
      }
    }

    // CRITICAL: Resident listing detection - extended for PT-BR (accent-insensitive)
    const listVerbs = ['list', 'show', 'names', 'display', 'listar', 'lista', 'mostre', 'mostrar', 'exibir', 'exiba', 'traga', 'me mostre', 'me traga'];
    const residentNouns = ['resident', 'citizen', 'residente', 'morador', 'moradores', 'cidadao', 'cidadaos', 'cidadas'];
    const satisfiedTokens = [
      'dissatisfied', 'unsatisfied', 'insatisfied', 'unhappy',
      'satisfied',
      'insatisfeito', 'insatisfeitos', 'insatisfacao',
      'satisfeito', 'satisfeitos'
    ];
    const participationTokens = ['interested', 'interessado', 'interessados', 'participated', 'participar', 'participantes', 'participacao', 'participaria'];

    const hasListVerb = listVerbs.some(t => qn.includes(t));
    const hasResidentNoun = residentNouns.some(t => qn.includes(t));
    const hasSatisfiedToken = satisfiedTokens.some(t => qn.includes(t));
    const hasParticipationToken = participationTokens.some(t => qn.includes(t));

    if (hasListVerb && (hasResidentNoun || hasSatisfiedToken || hasParticipationToken)) {
      analysis.primaryIntent = 'notification';
      analysis.queryType = 'listing';
      return analysis;
    }

    // Who clicked but didn't complete
    if ((qn.includes('clicked') || qn.includes('abandoned')) && 
        (qn.includes('didn') || qn.includes('not') || qn.includes('survey'))) {
      analysis.primaryIntent = 'notification';
      analysis.queryType = 'abandonment';
      analysis.dataNeeds.push('abandonment');
      return analysis;
    }

    // Statistical/operational queries about totals, counts, records
    // These are knowledge queries asking for information about the database
    if (qn.includes('total') || qn.includes('quantos') || qn.includes('quantas') || 
        qn.includes('cadastros') || qn.includes('registros') || 
        qn.includes('how many') || qn.includes('count')) {
      analysis.primaryIntent = 'knowledge';
      analysis.queryType = 'analysis';
      analysis.dataNeeds.push('total_count');
    }

    // Other intents
    if (qn.includes('send') || qn.includes('message') || 
        qn.includes('notify') || qn.includes('contact')) {
      analysis.primaryIntent = 'notification';
    } else if (qn.includes('system') || qn.includes('health') || 
               qn.includes('status') || qn.includes('export')) {
      analysis.primaryIntent = 'ticket';
    }

    // Data needs
    if (qn.includes('dissatisfied') || qn.includes('insatisf') || qn.includes('insatisfeito')) {
      analysis.dataNeeds.push('dissatisfied');
    }
    if ((qn.includes('satisfied') || qn.includes('satisfeito')) && 
        !(qn.includes('dissatisfied') || qn.includes('insatisfeito'))) {
      analysis.dataNeeds.push('satisfied');
    }
    if (qn.includes('particip') || qn.includes('interested') || qn.includes('interessad')) {
      analysis.dataNeeds.push('participation');
    }
    if (qn.includes('neighborhood') || qn.includes('equity') || qn.includes('bairro')) {
      analysis.dataNeeds.push('geographic');
    }

    return analysis;
  }

  /**
   * Map canonical intent from scope classifier to agent intent
   */
  mapCanonicalIntent(canonicalIntent) {
    const intentMap = {
      satisfaction: 'knowledge',
      engagement: 'notification',
      geographic: 'knowledge',
      operational: 'ticket',
      benchmarking: 'knowledge',
      survey: 'knowledge'
    };
    return intentMap[canonicalIntent] || null;
  }

  /**
   * Detect if query is a name/resident search
   * @param {string} query - User query
   * @returns {{isNameSearch: boolean, extractedName: string|null}}
   */
  detectNameSearch(query) {
    const normalize = (s) => (s || '').toString().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    const qn = normalize(query);
    
    // Name search verbs
    const nameSearchVerbs = [
      'encontre', 'encontrar', 'encontra', 'busque', 'buscar', 'busca', 
      'find', 'search', 'procure', 'procurar', 'procura', 
      'mostre', 'mostrar', 'mostra', 'show', 'exiba', 'exibir', 
      'traga', 'trazer', 'quem e', 'quem eh', 'quem é', 'localize', 'localizar'
    ];
    
    const hasNameSearchVerb = nameSearchVerbs.some(t => qn.includes(t));
    
    if (!hasNameSearchVerb) {
      return { isNameSearch: false, extractedName: null };
    }
    
    // Check if there are words that look like names (not just common words)
    const commonWords = [
      'o', 'a', 'os', 'as', 'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na',
      'the', 'a', 'an', 'me', 'meu', 'minha', 'meus', 'minhas',
      'um', 'uma', 'uns', 'umas', 'que', 'qual', 'quais'
    ];
    
    const words = query.split(/\s+/).filter(w => {
      const normalized = normalize(w);
      return !commonWords.includes(normalized) && !nameSearchVerbs.includes(normalized);
    });
    
    // Filter for name-like words (at least 2 chars, contains letters)
    const nameLikeWords = words.filter(w => 
      w.length >= 2 && /[a-záàâãéèêíìîóòôõúùûçA-ZÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ]/.test(w)
    );
    
    if (nameLikeWords.length >= 1) {
      // Extract the most likely name (usually the longest or most specific word)
      const extractedName = nameLikeWords.sort((a, b) => b.length - a.length)[0] || nameLikeWords[0];
      return { isNameSearch: true, extractedName };
    }
    
    return { isNameSearch: false, extractedName: null };
  }

  /**
   * Check if query is a statistical or operational query about the database
   * These queries ask about totals, counts, records, etc. and should always be in-scope
   */
  isStatisticalOrOperationalQuery(query) {
    const normalize = (s) => (s || '').toString().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    const qn = normalize(query);
    
    // Statistical/operational terms
    const statisticalTerms = [
      'total', 'quantos', 'quantas', 'how many', 'how much', 'count',
      'numero', 'número', 'registros', 'registro', 'cadastros', 'cadastro',
      'contagem', 'estatistica', 'estatística', 'dados', 'database',
      'atualmente', 'atual', 'currently', 'hoje', 'today'
    ];
    
    // Database/record terms
    const databaseTerms = [
      'cadastro', 'cadastros', 'registro', 'registros', 'contato', 'contatos',
      'contact', 'contacts', 'pessoa', 'pessoas', 'cidad', 'citizen',
      'resident', 'residente', 'morador', 'moradores'
    ];
    
    // Check if query contains statistical terms combined with database terms
    const hasStatisticalTerm = statisticalTerms.some(t => qn.includes(t));
    const hasDatabaseTerm = databaseTerms.some(t => qn.includes(t));
    
    // Also check for queries that are clearly asking about totals/counts
    const hasTotalQuery = qn.match(/total\s+(de|dos|das)?/i) || 
                         qn.match(/quantos?\s+(cadastros?|registros?|contatos?|pessoas?)/i) ||
                         qn.match(/how\s+many/i);
    
    return (hasStatisticalTerm && hasDatabaseTerm) || hasTotalQuery || 
           (hasStatisticalTerm && (qn.includes('cadastr') || qn.includes('registr')));
  }

  /**
   * Check if query contains municipal domain tokens
   */
  hasMunicipalDomainTokens(query) {
    const ql = query.toLowerCase();
    const municipalTokens = [
      'satisfacao', 'satisfação', 'engajamento', 'participacao', 'participação',
      'bairro', 'equidade', 'municip', 'cidada', 'cidadã', 'cidadão',
      'governanca', 'governança', 'resposta', 'taxa', 'survey',
      'residente', 'morador', 'cadastro', 'cadastros', 'registro', 'registros',
      'total', 'quantos', 'quantas', 'contagem', 'estatistica', 'estatística'
    ];
    return municipalTokens.some(t => ql.includes(t));
  }

  /**
   * Create default analysis for edge cases
   */
  createDefaultAnalysis(reason) {
    return {
      scope: {
        inScope: false,
        reason,
        confidence: 0
      },
      intent: 'knowledge',
      queryType: 'analysis',
      dataNeeds: [],
      urgency: 'normal',
      blocked: reason === 'Empty query'
    };
  }
}

module.exports = QueryAnalyzer;

