// orchestrator.js - Simplified Municipal Orchestrator (3 phases)
const axios = require('axios');
const IntelligentDataProcessor = require('./services/IntelligentDataProcessor');
const MunicipalPromptEngine = require('./services/MunicipalPromptEngine');
const ResponseProcessor = require('./services/ResponseProcessor');
const QueryAnalyzer = require('./services/QueryAnalyzer');

class IntelligentOrchestrator {
  constructor() {
    this.dataProcessor = new IntelligentDataProcessor();
    this.promptEngine = new MunicipalPromptEngine();
    this.responseProcessor = new ResponseProcessor();
    this.queryAnalyzer = new QueryAnalyzer();
    this.name = 'Intelligent Municipal Orchestrator';
    this.version = '3.0-simplified';
    
    // Validate API key on initialization and log status
    this.hasValidApiKey = this.validateApiKey();
    if (!this.hasValidApiKey) {
      console.warn('[Orchestrator] CLAUDE_API_KEY not configured. LLM enhancement features will be disabled.');
    } else {
      console.log('[Orchestrator] CLAUDE_API_KEY detected. LLM enhancement features enabled.');
    }
  }

  /**
   * Validate that CLAUDE_API_KEY is set and non-empty
   * @returns {boolean} True if API key is valid
   */
  validateApiKey() {
    const apiKey = process.env.CLAUDE_API_KEY;
    return !!(apiKey && typeof apiKey === 'string' && apiKey.trim().length > 0);
  }

  async orchestrate(query) {
    const startTime = Date.now();
    console.log(`[${this.name}] Processing: "${query}"`);

    try {
      // Phase 1: Analyze & Classify (scope + intent + data needs)
      const queryAnalysis = await this.queryAnalyzer.analyzeQuery(query);
      console.log(`[Orchestrator] Intent: ${queryAnalysis.intent}, Type: ${queryAnalysis.queryType}`);

      // Handle out-of-scope queries
      if (queryAnalysis.blocked) {
        return {
          query,
          intent: 'out_of_scope',
          response: 'Consulta fora do escopo da Inteligência Municipal. Reformule dentro de: satisfação cidadã, engajamento, equidade geográfica, desempenho operacional, benchmarking ou análise de pesquisa.',
          success: true,
          scope: queryAnalysis.scope,
          residents: [],
          processingTime: Date.now() - startTime,
          timestamp: new Date().toISOString()
        };
      }

      // Phase 2: Generate Context & Route
      const intelligentContext = await this.dataProcessor.generateIntelligentContext(queryAnalysis);
      console.log(`[Orchestrator] Context generated with ${intelligentContext.rawData?.length || 0} contacts`);

      const agentResult = await this.routeToAgent(query, queryAnalysis, intelligentContext);
      console.log(`[Orchestrator] Agent processed, residents found: ${agentResult.analysis?.residents?.length || 0}`);
      console.log(`[Orchestrator] Agent insights: ${agentResult.analysis?.insights?.length || 0}, recommendations: ${agentResult.analysis?.recommendations?.length || 0}`);

      // Phase 3: Enhance & Format (always use LLM enhancement when API key is available)
      // This ensures agentic responses for all queries, especially name searches
      let llmResult = null;
      if (this.hasValidApiKey && queryAnalysis.intent !== 'ticket') {
        try {
          // Always enhance with LLM when API key is available to provide agentic features
          llmResult = await this.enhanceWithLLM(query, queryAnalysis, intelligentContext, agentResult);
          console.log(`[Orchestrator] LLM enhancement: ${llmResult?.quality?.level || 'failed'}`);
          
          // Log if residents were found and passed to LLM
          if (agentResult.analysis?.residents?.length > 0) {
            console.log(`[Orchestrator] Passed ${agentResult.analysis.residents.length} residents to LLM for agentic response`);
          }
        } catch (error) {
          // Enhanced error logging for API key issues
          if (error.response?.status === 401 || error.response?.status === 403) {
            console.error('[Orchestrator] LLM API authentication failed. Please verify CLAUDE_API_KEY is valid.');
          } else if (error.message?.includes('API key') || error.message?.includes('authentication')) {
            console.error('[Orchestrator] LLM API key error:', error.message);
          } else {
            console.warn('[Orchestrator] LLM enhancement failed, using data-driven response:', error.message);
          }
        }
      } else if (queryAnalysis.intent !== 'ticket') {
        // Log when LLM enhancement is skipped due to missing API key
        console.log('[Orchestrator] LLM enhancement skipped: CLAUDE_API_KEY not configured');
      }

      // Construct final response
      const finalResponse = this.constructFinalResponse(
        query, queryAnalysis, intelligentContext, agentResult, llmResult, startTime
      );

      return finalResponse;

    } catch (error) {
      console.error('[Orchestrator] Critical error:', error);
      return this.createErrorResponse(query, error, startTime);
    }
  }

  async routeToAgent(query, queryAnalysis, intelligentContext) {
    console.log(`[Orchestrator] Routing to ${queryAnalysis.intent} agent`);
    
    const enhancedContext = {
      queryAnalysis: {
        primaryIntent: queryAnalysis.intent,
        queryType: queryAnalysis.queryType,
        dataNeeds: queryAnalysis.dataNeeds
      },
      intelligentContext,
      processingLevel: 'intelligent'
    };

    try {
      switch (queryAnalysis.intent) {
        case 'notification':
          const { notificationAgent } = require('./agents/notificationAgent');
          return await notificationAgent(query, null, enhancedContext);
          
        case 'knowledge':
          const { knowledgeAgent } = require('./agents/knowledgeAgent');
          return await knowledgeAgent(query, null, enhancedContext);
          
        case 'ticket':
          const { ticketAgent } = require('./agents/ticketAgent');
          return await ticketAgent(query, null, enhancedContext);
          
        default:
          const { knowledgeAgent: defaultAgent } = require('./agents/knowledgeAgent');
          return await defaultAgent(query, null, enhancedContext);
      }
    } catch (error) {
      console.error(`[Orchestrator] Agent ${queryAnalysis.intent} failed:`, error.message);
      throw error;
    }
  }

  async enhanceWithLLM(query, queryAnalysis, intelligentContext, agentResult) {
    // Validate API key before making the request
    if (!this.hasValidApiKey) {
      throw new Error('CLAUDE_API_KEY is not configured or invalid');
    }
    
    const claudeApiKey = process.env.CLAUDE_API_KEY.trim();
    const claudeModel = 'claude-3-5-sonnet-20241022';
    const claudeUrl = 'https://api.anthropic.com/v1/messages';

    // Use MunicipalPromptEngine for consistent prompt building
    const queryAnalysisForPrompt = {
      primaryIntent: queryAnalysis.intent,
      queryType: queryAnalysis.queryType
    };

    const systemPrompt = this.promptEngine.buildSystemPrompt(
      queryAnalysis.intent,
      queryAnalysisForPrompt,
      intelligentContext
    );

    // Build user prompt with actual data - enhanced with richer context
    const stats = intelligentContext.statisticalProfile;
    const totalRecords = intelligentContext.rawData?.length || 0;
    
    // Calculate record validity for statistical queries
    const validRecords = intelligentContext.rawData ? intelligentContext.rawData.filter(r => {
      return r && (r.name || r.id || r.whatsapp);
    }).length : totalRecords;
    
    // Check if this is a statistical query
    const isStatisticalQuery = this.isStatisticalQuery(query);
    
    // Check if this is a name search query
    const isNameSearch = queryAnalysis.dataNeeds?.includes('name_search') || false;
    
    let dataSection = `\n=== DADOS DISPONÍVEIS DO BANCO DE DADOS (data.json) ===\n`;
    
    if (isStatisticalQuery) {
      dataSection += `⚠️ PERGUNTA ESTATÍSTICA DETECTADA - USE ESTES NÚMEROS EXATOS:\n`;
      dataSection += `Total de registros no banco: ${totalRecords}\n`;
      dataSection += `Registros válidos (com nome, ID ou WhatsApp): ${validRecords}\n`;
      dataSection += `Registros que responderam à pesquisa: ${stats?.population?.total ? intelligentContext.rawData?.filter(r => r.survey).length || 0 : 0}\n`;
      dataSection += `Registros que receberam mensagem: ${stats?.population?.total ? intelligentContext.rawData?.filter(r => r.whatsappSentAt).length || 0 : 0}\n`;
      dataSection += `Registros que clicaram no link: ${stats?.population?.total ? intelligentContext.rawData?.filter(r => r.clickedAt).length || 0 : 0}\n\n`;
      dataSection += `IMPORTANTE: Para perguntas sobre "registros válidos", use o número: ${validRecords}\n\n`;
    } else {
      dataSection += `Total de registros no banco: ${totalRecords} cidadãos\n\n`;
    }
    
    // For name searches, provide focused instructions
    if (isNameSearch) {
      dataSection += `⚠️ BUSCA POR NOME DETECTADA - INSTRUÇÕES ESPECIAIS:\n`;
      dataSection += `Esta é uma busca específica por um residente/cidadão. Você deve:\n`;
      dataSection += `1. Responder de forma CONCISA e DIRETA sobre o(s) residente(s) encontrado(s)\n`;
      dataSection += `2. NÃO incluir análise municipal genérica, insights genéricos ou recomendações genéricas\n`;
      dataSection += `3. Focar APENAS nas informações relevantes sobre o(s) residente(s) específico(s)\n`;
      dataSection += `4. Se encontrar múltiplos resultados, liste-os de forma clara e organizada\n`;
      dataSection += `5. Se não encontrar resultados, informe claramente que não foram encontrados registros\n\n`;
    }
    
    // Add data structure information
    dataSection += `ESTRUTURA DOS DADOS:\n`;
    dataSection += `Cada registro contém: nome, idade, bairro, WhatsApp, datas de criação/atualização, `;
    dataSection += `status de envio de mensagem, dados da pesquisa (issue, satisfaction, participate, answeredAt)\n\n`;
    
    // Add sample data with more details
    if (agentResult.analysis?.residents && agentResult.analysis.residents.length > 0) {
      dataSection += `DADOS RELEVANTES PARA ESTA CONSULTA (${agentResult.analysis.residents.length} registros encontrados):\n\n`;
      
      // Show first 10 with more detail
      agentResult.analysis.residents.slice(0, 10).forEach((resident, index) => {
        dataSection += `${index + 1}. ${resident.name || 'Nome não disponível'}`;
        if (resident.neighborhood) dataSection += ` - Bairro: ${resident.neighborhood}`;
        if (resident.age) dataSection += ` - Idade: ${resident.age}`;
        if (resident.satisfaction) dataSection += ` - Satisfação: ${resident.satisfaction}`;
        if (resident.issue) dataSection += ` - Questão: ${resident.issue}`;
        if (resident.participate) dataSection += ` - Participação: ${resident.participate}`;
        dataSection += `\n`;
      });
      
      if (agentResult.analysis.residents.length > 10) {
        dataSection += `\n... e mais ${agentResult.analysis.residents.length - 10} registros disponíveis no banco de dados\n`;
      }
      
      // Add summary statistics
      const neighborhoods = [...new Set(agentResult.analysis.residents.map(r => r.neighborhood).filter(Boolean))];
      const satisfactions = agentResult.analysis.residents.map(r => r.satisfaction).filter(Boolean);
      const issues = [...new Set(agentResult.analysis.residents.map(r => r.issue).filter(Boolean))];
      
      dataSection += `\nRESUMO ESTATÍSTICO DOS DADOS ENCONTRADOS:\n`;
      if (neighborhoods.length > 0) {
        dataSection += `- Bairros únicos: ${neighborhoods.length} (${neighborhoods.slice(0, 5).join(', ')}${neighborhoods.length > 5 ? '...' : ''})\n`;
      }
      if (satisfactions.length > 0) {
        const satisfactionCounts = satisfactions.reduce((acc, s) => {
          acc[s] = (acc[s] || 0) + 1;
          return acc;
        }, {});
        dataSection += `- Distribuição de satisfação: ${Object.entries(satisfactionCounts).map(([k, v]) => `${k}: ${v}`).join(', ')}\n`;
      }
      if (issues.length > 0) {
        dataSection += `- Questões principais: ${issues.slice(0, 5).join(', ')}${issues.length > 5 ? '...' : ''}\n`;
      }
    } else {
      dataSection += `NOTA: Nenhum registro específico foi encontrado para esta consulta, mas você tem acesso a todos os ${totalRecords} registros do banco.\n`;
    }
    
    dataSection += `\n=== FIM DOS DADOS ===\n`;

    const userPrompt = this.promptEngine.buildUserPrompt(query, queryAnalysisForPrompt, intelligentContext) +
      `\n\n${dataSection}\n\nAGENT ANALYSIS RESULTS:\n${agentResult.analysis?.summary || 'Analysis completed'}`;

    console.log(`[LLM] Sending enhancement request (${systemPrompt.length + userPrompt.length} chars)`);

    // Claude API uses different format - system message is a separate parameter
    const requestData = {
      model: claudeModel,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        { role: "user", content: userPrompt }
      ],
      temperature: 0.3
    };

    const response = await axios.post(claudeUrl, requestData, {
      headers: {
        'x-api-key': claudeApiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    // Claude API response format: content is an array with text content
    const rawContent = response.data.content?.[0]?.text;
    
    if (!rawContent) {
      throw new Error('Empty LLM response');
    }

    // Process and validate response
    const processedResponse = this.responseProcessor.processResponse(
      rawContent, queryAnalysisForPrompt, intelligentContext, {
        provider: 'claude',
        model: claudeModel
      }
    );

    return {
      ...processedResponse,
      provider: 'claude',
      model: claudeModel,
      intelligenceLevel: 'high'
    };
  }

  constructFinalResponse(query, queryAnalysis, intelligentContext, agentResult, llmResult, startTime) {
    const processingTime = Date.now() - startTime;
    
    // Check if this is a name search
    const isNameSearch = queryAnalysis.dataNeeds?.includes('name_search') || false;
    
    // Determine primary response source
    let primaryResponse = agentResult.analysis?.summary || 'Analysis completed';
    let responseQuality = 'data-driven';
    
    // For name searches, prefer agent result (which is already focused) unless LLM provides better focused response
    if (isNameSearch && agentResult.analysis?.type === 'name_search_result') {
      // Use agent result for name searches - it's already focused and concise
      primaryResponse = agentResult.analysis.summary;
      responseQuality = 'focused_search';
      console.log('[Orchestrator] Using focused name search response from agent');
    } else if (llmResult?.quality?.level === 'excellent' || llmResult?.quality?.level === 'good') {
      // Verify LLM used actual data (simple check for resident names)
      const hasRealData = agentResult.analysis?.residents?.some(r => 
        llmResult.response.includes(r.name)
      );
      
      // For name searches, check if LLM response is concise and focused
      if (isNameSearch) {
        // Prefer concise LLM response if it's focused on the specific resident
        if (hasRealData && llmResult.response.length < 500) {
          primaryResponse = llmResult.response;
          responseQuality = 'llm-enhanced';
          console.log('[Orchestrator] Using concise LLM-enhanced name search response');
        } else {
          // Use agent response if LLM is too verbose
          primaryResponse = agentResult.analysis?.summary || primaryResponse;
          responseQuality = 'focused_search';
          console.log('[Orchestrator] LLM response too verbose for name search, using agent response');
        }
      } else {
        // For non-name searches, use standard logic
        if (hasRealData || llmResult.response.length > primaryResponse.length * 1.5) {
          primaryResponse = llmResult.response;
          responseQuality = 'llm-enhanced';
          console.log('[Orchestrator] Using LLM-enhanced response');
        } else {
          console.log('[Orchestrator] LLM response lacks real data, using agent response');
        }
      }
    } else if (llmResult && isNameSearch) {
      // For name searches, use LLM response only if it's concise
      if (llmResult.response && llmResult.response.trim().length > 0 && llmResult.response.length < 500) {
        primaryResponse = llmResult.response;
        responseQuality = 'llm-enhanced';
        console.log('[Orchestrator] Using concise LLM response for name search');
      }
    }

    return {
      // Core response fields
      query,
      intent: queryAnalysis.intent,
      response: primaryResponse,
      
      // CRITICAL: Always include real resident data
      residents: agentResult.analysis?.residents || [],
      // Surface structured report from agent analysis when available
      report: agentResult.analysis?.report || null,
      
      // Additional insights - exclude generic insights for name searches only
      // For analysis queries, always include insights and recommendations
      insights: isNameSearch ? [] : (agentResult.analysis?.insights || []),
      recommendations: isNameSearch ? [] : (agentResult.analysis?.recommendations || []),
      
      // Metadata
      success: true,
      confidence: this.calculateConfidence(agentResult, llmResult),
      processingTime,
      dataSource: 'municipal_database',
      responseQuality,
      llmEnhanced: responseQuality === 'llm-enhanced',
      provider: llmResult?.provider || undefined,
      model: llmResult?.model || undefined,
      
      // Statistics summary
      statistics: {
        totalContacts: intelligentContext.statisticalProfile?.population?.total || 0,
        responseRate: intelligentContext.statisticalProfile?.population?.responseRate || 0,
        satisfactionScore: intelligentContext.statisticalProfile?.satisfaction?.averageScore || 0
      },
      
      // Architecture info
      architecture: {
        version: this.version,
        components: ['IntelligentDataProcessor', 'AgentRouter', llmResult ? 'LLM-Enhancement' : null].filter(Boolean)
      },

      // Provenance & traceability
      provenance: {
        agent: agentResult.agent || 'unknown',
        agentType: queryAnalysis.intent,
        source: responseQuality === 'llm-enhanced' ? 'knowledge_agent+claude_llm' : 'knowledge_agent',
        llm: {
          used: !!llmResult && responseQuality === 'llm-enhanced',
          provider: llmResult?.provider || null,
          model: llmResult?.model || null,
          quality: llmResult?.quality || null
        },
        dataVersions: {
          satisfaction: agentResult.analysis?.data?.satisfaction?.meta?.computationVersion || agentResult.analysis?.satisfaction?.meta?.computationVersion || null,
          neighborhoods: agentResult.analysis?.data?.neighborhoods?.meta?.computationVersion || agentResult.analysis?.neighborhoods?.meta?.computationVersion || null
        },
        pipelineVersion: this.version,
        assertedBy: 'IntelligentOrchestrator'
      },
      
      timestamp: new Date().toISOString()
    };
  }

  calculateConfidence(agentResult, llmResult) {
    // Base confidence from data availability
    let confidence = 0.7;
    
    // Boost for having real residents
    if (agentResult.analysis?.residents?.length > 0) {
      confidence += 0.15;
    }
    
    // Boost for LLM enhancement
    if (llmResult?.quality?.level === 'excellent') {
      confidence += 0.1;
    } else if (llmResult?.quality?.level === 'good') {
      confidence += 0.05;
    }
    
    return Math.min(confidence, 0.95);
  }

  createErrorResponse(query, error, startTime) {
    return {
      query,
      error: error.message,
      response: `Error processing query: ${error.message}. Please try again.`,
      residents: [],
      success: false,
      processingTime: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Check if query is asking for statistics/counts/numbers
   */
  isStatisticalQuery(query) {
    const normalize = (s) => (s || '').toString().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    const qn = normalize(query);
    
    const statisticalPatterns = [
      /quantos?/i,
      /quantas?/i,
      /how many/i,
      /how much/i,
      /total (de|dos|das)/i,
      /numero (de|dos|das)/i,
      /número (de|dos|das)/i,
      /contagem/i,
      /count/i,
      /registros? (validos?|existem?)/i,
      /cadastros? (validos?|existem?)/i,
      /records? (valid|exist)/i
    ];
    
    return statisticalPatterns.some(pattern => pattern.test(query));
  }
}

// Create singleton instance
const orchestratorInstance = new IntelligentOrchestrator();

async function orchestrator(query) {
  return await orchestratorInstance.orchestrate(query);
}

// Export for UI endpoint compatibility
function createUIResponse(result) {
  return {
    response: result.response,
    intent: result.intent,
    confidence: result.confidence,
    agent: `${result.intent?.charAt(0).toUpperCase()}${result.intent?.slice(1)} Agent`,
    residents: result.residents,
    success: result.success,
    timestamp: result.timestamp
  };
}

module.exports = orchestrator;
module.exports.orchestrator = orchestrator;
module.exports.createUIResponse = createUIResponse;