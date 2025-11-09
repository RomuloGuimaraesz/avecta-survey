// agents/knowledgeAgent.js - Refactored to use intelligent LLM responses properly
const MunicipalAnalysisEngine = require('../services/MunicipalAnalysisEngine');
const ResidentFilterService = require('../services/ResidentFilterService');

class IntelligentKnowledgeAgent {
  constructor() {
    this.name = 'Knowledge Agent';
    this.analysisEngine = new MunicipalAnalysisEngine();
    this.residentFilter = new ResidentFilterService();
  }

  async processQuery(query, llmResult, preloadedContext = null) {
    try {
      console.log(`[${this.name}] Processing: ${query}`);
      
      // Extract residents for name searches or other queries that need resident data
      const residents = this.extractResidentData(query, preloadedContext);
      
      // PRIORITY 1: Use intelligent LLM response from new orchestrator
      if (preloadedContext?.llmResult?.response && 
          (preloadedContext.llmResult.quality?.level === 'excellent' || 
           preloadedContext.llmResult.quality?.level === 'good')) {
        console.log(`[${this.name}] Using intelligent LLM response from new orchestrator (quality: ${preloadedContext.llmResult.quality.level})`);
        
        // Check if this is an analysis query and generate report if needed
        const isAnalysisQuery = preloadedContext.queryAnalysis?.queryType === 'analysis' || 
                                preloadedContext.queryAnalysis?.dataNeeds?.includes('satisfaction_analysis');
        let report = null;
        
        if (isAnalysisQuery && preloadedContext.intelligentContext) {
          // Generate report from intelligent context data
          const analysisType = this.determineAnalysisType(query);
          const stats = preloadedContext.intelligentContext.statisticalProfile;
          
          if (stats && stats.satisfaction) {
            const avgScore = parseFloat(stats.satisfaction.averageScore);
            const responseRate = parseFloat(stats.population?.responseRate || 0);
            const equityGap = parseFloat(stats.geographic?.equityGap || 0);
            
            report = {
              text: `📊 RELATÓRIO DE ANÁLISE DE SATISFAÇÃO\n` +
                    `${'='.repeat(60)}\n\n` +
                    `📈 MÉTRICAS PRINCIPAIS:\n` +
                    `• Total de Respostas: ${stats.population?.total || 0} cidadãos\n` +
                    `• Satisfação Média: ${stats.satisfaction.averageScore}/5.0` +
                    (avgScore < 3.0 ? ` ⚠️  Baixa` : avgScore < 4.0 ? ` ✓ Moderada` : ` ✓ Excelente`) + `\n` +
                    `• Taxa de Resposta: ${responseRate}%` +
                    (responseRate < 50 ? ` ⚠️  Pode melhorar` : responseRate >= 70 ? ` ✓ Excelente` : ` ✓ Boa`) + `\n` +
                    `• Cobertura Geográfica: ${stats.geographic?.totalNeighborhoods || 0} bairros\n` +
                    `• Equidade entre Bairros: ${equityGap.toFixed(1)} pontos de diferença` +
                    (equityGap > 25 ? ` ⚠️  Alta desigualdade` : equityGap > 15 ? ` ⚠️  Moderada` : ` ✓ Boa equidade`) + `\n\n` +
                    `💡 INTERPRETAÇÃO:\n` +
                    (avgScore < 3.0 ? `A satisfação está abaixo do esperado. Ação imediata recomendada para identificar e resolver problemas.\n` : 
                     avgScore < 4.0 ? `Satisfação em nível moderado. Há espaço para melhorias para alcançar excelência.\n` :
                     `Satisfação em bom nível. Manter qualidade e identificar oportunidades de inovação.\n`) +
                    (responseRate < 50 ? `A taxa de resposta pode ser melhorada expandindo canais de comunicação.\n` :
                     responseRate >= 70 ? `Excelente engajamento da comunidade. Aproveitar para co-criação de políticas.\n` :
                     `Boa participação. Continuar engajando a comunidade.\n`),
              metrics: {
                total: stats.population?.total || 0,
                averageScore: stats.satisfaction.averageScore,
                responseRate: stats.population?.responseRate || 0,
                neighborhoods: stats.geographic?.totalNeighborhoods || 0,
                equityGap: equityGap,
                satisfactionLevel: avgScore < 3.0 ? 'low' : avgScore < 4.0 ? 'moderate' : 'high',
                responseLevel: responseRate < 50 ? 'low' : responseRate >= 70 ? 'excellent' : 'good'
              },
              type: 'satisfaction'
            };
          }
        }
        
        return {
          agent: this.name,
          query,
          analysis: {
            summary: preloadedContext.llmResult.response,
            residents: residents.length > 0 ? residents : (preloadedContext.llmResult.residents || []),
            insights: this.extractInsightsFromLLM(preloadedContext.llmResult),
            recommendations: this.extractRecommendationsFromLLM(preloadedContext.llmResult),
            type: preloadedContext.queryAnalysis?.queryType || 'intelligent_analysis',
            confidence: preloadedContext.llmResult.metadata?.confidence || 0.85,
            dataPoints: this.extractDataPoints(preloadedContext.intelligentContext),
            report: report
          },
          dataSource: 'municipal_intelligence_system',
          intelligenceLevel: preloadedContext.llmResult.intelligenceLevel,
          quality: preloadedContext.llmResult.quality,
          realData: true,
          provenance: {
            source: 'knowledge_agent+claude_llm',
            llm: {
              provider: preloadedContext.llmResult.provider || 'claude',
              model: preloadedContext.llmResult.model || null,
              quality: preloadedContext.llmResult.quality || null
            },
            pipelineVersion: preloadedContext.llmResult.pipelineVersion || null
          },
          timestamp: new Date().toISOString(),
          success: true
        };
      }

      // PRIORITY 2: Check for legacy LLM synthesis (old orchestrator compatibility)
      if (preloadedContext?.llmSynthesis?.intelligenceLevel === 'high' && preloadedContext.llmSynthesis.synthesis) {
        console.log(`[${this.name}] Using legacy LLM synthesis`);
        
        return {
          agent: this.name,
          query,
          analysis: {
            summary: preloadedContext.llmSynthesis.synthesis,
            insights: [`Processados ${preloadedContext.dataContext?.raw?.totalContacts || 'desconhecido'} contatos`],
            recommendations: ['Insights baseados em dados fornecidos acima'],
            type: preloadedContext.queryAnalysis?.queryType || 'legacy_synthesis'
          },
          dataSource: 'municipal_intelligence_system',
          intelligenceLevel: preloadedContext.llmSynthesis.intelligenceLevel,
          realData: true,
          provenance: {
            source: 'knowledge_agent+legacy_llm',
            llm: { provider: preloadedContext.llmSynthesis.provider || 'unknown', model: preloadedContext.llmSynthesis.model || null },
            pipelineVersion: preloadedContext.llmSynthesis.pipelineVersion || null
          },
          timestamp: new Date().toISOString(),
          success: true
        };
      }

      // PRIORITY 3: Enhanced fallback with intelligent context
      if (preloadedContext?.intelligentContext) {
        console.log(`[${this.name}] No LLM response available, using intelligent fallback with context`);
        const fallbackResult = this.generateIntelligentFallback(query, preloadedContext);
        // Add residents if found
        if (residents.length > 0) {
          fallbackResult.analysis.residents = residents;
        }
        return fallbackResult;
      }

      // PRIORITY 4: Standard analysis engine fallback
      console.log(`[${this.name}] Using standard analysis engine fallback`);
      return await this.executeStandardAnalysis(query, preloadedContext);

    } catch (error) {
      console.error(`[${this.name}] Error:`, error);
      return this.createErrorResponse(query, error);
    }
  }

  extractResidentData(query, preloadedContext) {
    // Get raw contact data from intelligent context
    const rawContacts = preloadedContext?.intelligentContext?.rawData || 
                       preloadedContext?.intelligentContext?.statisticalProfile?.rawContacts || [];

    if (rawContacts.length === 0) {
      return [];
    }

    // Determine filter type from query
    const filterType = this.residentFilter.determineFilterType(query);
    
    if (!filterType) {
      return [];
    }

    // Use filter service to extract residents
    const normalize = (s) => (s || '').toString().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    const residents = this.residentFilter.filterResidents(rawContacts, {
      type: filterType,
      queryNormalized: normalize(query),
      query: query
    });

    return residents;
  }

  extractInsightsFromLLM(llmResult) {
    const insights = [];
    
    // Extract insights from LLM response
    if (llmResult.insights && Array.isArray(llmResult.insights)) {
      insights.push(...llmResult.insights.map(insight => 
        typeof insight === 'object' ? insight.content : insight
      ));
    }
    
    // Extract bullet points from response text
    const bulletMatches = llmResult.response.match(/[•\-\*]\s*([^\n]+)/g);
    if (bulletMatches) {
      insights.push(...bulletMatches.slice(0, 3).map(match => 
        match.replace(/[•\-\*]\s*/, '').trim()
      ));
    }
    
    // Extract numbered points
    const numberedMatches = llmResult.response.match(/\d+\.\s*([^\n]+)/g);
    if (numberedMatches) {
      insights.push(...numberedMatches.slice(0, 2).map(match => 
        match.replace(/\d+\.\s*/, '').trim()
      ));
    }
    
    return insights.slice(0, 5); // Limit to 5 key insights
  }

  extractRecommendationsFromLLM(llmResult) {
    const recommendations = [];
    
    // Extract recommendations from structured response
    if (llmResult.recommendations && Array.isArray(llmResult.recommendations)) {
      recommendations.push(...llmResult.recommendations.map(rec => 
        typeof rec === 'object' ? rec.content : rec
      ));
    }
    
    // Look for action-oriented phrases in the response
    const actionPatterns = [
      /(?:implement|establish|create|develop|schedule|contact|address)\s+[^.]+/gi,
      /(?:should|recommend|suggest)\s+[^.]+/gi,
      /(?:within|by|before)\s+\d+\s+(?:days?|weeks?|months?)[^.]+/gi
    ];
    
    actionPatterns.forEach(pattern => {
      const matches = llmResult.response.match(pattern);
      if (matches) {
        recommendations.push(...matches.slice(0, 2).map(match => match.trim()));
      }
    });
    
    return recommendations.slice(0, 4); // Limit to 4 key recommendations
  }

  extractDataPoints(intelligentContext) {
    if (!intelligentContext || !intelligentContext.statisticalProfile) return {};
    
    const stats = intelligentContext.statisticalProfile;
    return {
      totalContacts: stats.population?.total || 0,
      responseRate: stats.population?.responseRate || 0,
      satisfactionScore: stats.satisfaction?.averageScore || 0,
      neighborhoods: stats.geographic?.totalNeighborhoods || 0,
      reliability: stats.satisfaction?.reliability || 'unknown'
    };
  }

  generateIntelligentFallback(query, preloadedContext) {
    const context = preloadedContext.intelligentContext;
    const stats = context.statisticalProfile;
    
    // CRITICAL: Check queryAnalysis first - if it's an analysis query, don't treat as name search
    const isAnalysisQuery = preloadedContext.queryAnalysis?.queryType === 'analysis' ||
                           preloadedContext.queryAnalysis?.dataNeeds?.includes('satisfaction_analysis') ||
                           preloadedContext.queryAnalysis?.dataNeeds?.includes('age_analysis');
    
    // Check if this is a name search query (only if not an analysis query)
    const isNameSearch = !isAnalysisQuery && (
      preloadedContext.queryAnalysis?.dataNeeds?.includes('name_search') || 
      this.isNameSearchQuery(query)
    );
    
    // For name searches, return only relevant resident information
    if (isNameSearch) {
      const residents = this.extractResidentData(query, preloadedContext);
      
      if (residents.length > 0) {
        // Return concise, focused response for name searches
        const resident = residents[0];
        let summary = `Encontrei ${residents.length} ${residents.length === 1 ? 'registro' : 'registros'} para "${this.extractNameFromQuery(query)}":\n\n`;
        summary += `**${resident.name}**\n`;
        if (resident.neighborhood) summary += `Bairro: ${resident.neighborhood}\n`;
        if (resident.age) summary += `Idade: ${resident.age} anos\n`;
        if (resident.satisfaction) summary += `Satisfação: ${resident.satisfaction}\n`;
        if (resident.issue) summary += `Questão principal: ${resident.issue}\n`;
        if (resident.participate) summary += `Interesse em participar: ${resident.participate}\n`;
        if (resident.whatsapp) summary += `WhatsApp: ${resident.whatsapp}\n`;
        
        return {
          agent: this.name,
          query,
          analysis: {
            summary,
            residents: residents,
            insights: [], // No generic insights for name searches
            recommendations: [], // No generic recommendations for name searches
            type: 'name_search_result',
            dataPoints: this.extractDataPoints(context)
          },
          dataSource: 'municipal_intelligence_system',
          intelligenceLevel: 'focused_search',
          realData: true,
          provenance: {
            source: 'knowledge_agent+name_search',
            llm: { used: false },
            pipelineVersion: null
          },
          timestamp: new Date().toISOString(),
          success: true
        };
      } else {
        // Name not found
        return {
          agent: this.name,
          query,
          analysis: {
            summary: `Não encontrei registros para "${this.extractNameFromQuery(query)}" no banco de dados municipal.`,
            residents: [],
            insights: [],
            recommendations: [],
            type: 'name_search_not_found',
            dataPoints: this.extractDataPoints(context)
          },
          dataSource: 'municipal_intelligence_system',
          intelligenceLevel: 'focused_search',
          realData: true,
          provenance: {
            source: 'knowledge_agent+name_search',
            llm: { used: false },
            pipelineVersion: null
          },
          timestamp: new Date().toISOString(),
          success: true
        };
      }
    }
    
    // For non-name-search queries, use the standard fallback
    let summary = '';
    const insights = [];
    const recommendations = [];
    let report = null;
    
    // isAnalysisQuery is already defined above, reuse it
    
    if (stats) {
      summary = `Análise municipal de ${stats.population.total} cidadãos com ${stats.population.responseRate}% de taxa de resposta. `;
      summary += `Satisfação média: ${stats.satisfaction.averageScore}/5. `;
      summary += `Cobertura: ${stats.geographic.totalNeighborhoods} bairros.`;
      // If query requests age analysis explicitly, try to enrich with age distribution placeholder
      const ql = query.toLowerCase();
      if ((ql.includes('idade') || ql.includes('faixa et') || ql.includes('faixa-et')) && context.ageSatisfaction) {
        const ageSat = context.ageSatisfaction;
        if (ageSat.totalResponses > 0) {
          const topBracket = [...ageSat.brackets].sort((a,b)=>b.count-a.count)[0];
          summary += ` Satisfação por idade disponível (${ageSat.totalResponses} respostas com idade); faixa mais representada: ${topBracket.label}.`;
        } else {
          summary += ' Não há informações suficientes sobre a idade dos respondentes para fazer uma análise por faixa etária.';
        }
      }

      // Generate contextual insights - ALWAYS provide insights for analysis queries
      const satisfactionScore = parseFloat(stats.satisfaction.averageScore);
      const responseRate = parseFloat(stats.population.responseRate);
      const equityGap = parseFloat(stats.geographic.equityGap);
      
      // Satisfaction insights
      if (satisfactionScore < 3.0) {
        insights.push('Satisfação baixa: nota média abaixo de 3,0/5 indica necessidade de ação imediata.');
        recommendations.push('Ação prioritária: Contatar diretamente os cidadãos insatisfeitos para entender suas preocupações e resolver os problemas.');
      } else if (satisfactionScore >= 3.0 && satisfactionScore < 4.0) {
        insights.push(`Satisfação moderada (${satisfactionScore.toFixed(1)}/5): Há espaço para melhorias para alcançar níveis de excelência.`);
        recommendations.push('Implementar melhorias incrementais nos serviços municipais com base no feedback recebido.');
      } else {
        insights.push(`Satisfação alta (${satisfactionScore.toFixed(1)}/5): Os cidadãos estão satisfeitos com os serviços municipais.`);
        recommendations.push('Manter os padrões de qualidade e identificar oportunidades de inovação para continuar melhorando.');
      }
      
      // Response rate insights
      if (responseRate < 50) {
        insights.push(`Taxa de resposta abaixo de 50% (${responseRate}%) - há espaço para melhorar o engajamento da comunidade.`);
        recommendations.push('Melhorar a comunicação usando múltiplos canais (WhatsApp, reuniões, etc.) para aumentar a participação.');
      } else if (responseRate >= 50 && responseRate < 70) {
        insights.push(`Taxa de resposta moderada (${responseRate}%): Boa participação, mas ainda há potencial para aumentar o engajamento.`);
        recommendations.push('Expandir canais de comunicação e criar campanhas de engajamento para alcançar mais cidadãos.');
      } else {
        insights.push(`Taxa de resposta excelente (${responseRate}%): Alto nível de engajamento da comunidade.`);
        recommendations.push('Aproveitar o alto engajamento para criar grupos de trabalho e comitês cidadãos para co-criação de políticas.');
      }
      
      // Geographic equity insights
      if (equityGap > 25) {
        insights.push(`Há diferenças grandes entre bairros (${equityGap.toFixed(1)} pontos) - alguns bairros estão sendo menos atendidos.`);
        recommendations.push('Ação prioritária: Visitar e contatar diretamente os bairros com baixo desempenho para entender e resolver os problemas.');
      } else if (equityGap > 15) {
        insights.push(`Diferenças moderadas entre bairros (${equityGap.toFixed(1)} pontos): Alguns bairros precisam de atenção adicional.`);
        recommendations.push('Implementar programas específicos para bairros com menor desempenho e replicar boas práticas dos bairros com melhor desempenho.');
      } else {
        insights.push(`Equidade geográfica boa (diferença de ${equityGap.toFixed(1)} pontos): Serviços municipais estão sendo distribuídos de forma relativamente equitativa.`);
        recommendations.push('Manter o foco em equidade e continuar monitorando para garantir que todos os bairros recebam serviços de qualidade.');
      }
      
      // Additional insights for analysis queries
      if (isAnalysisQuery) {
        const totalContacts = stats.population.total;
        if (totalContacts > 0) {
          insights.push(`Análise baseada em ${totalContacts} ${totalContacts === 1 ? 'cidadão' : 'cidadãos'} - ${responseRate >= 50 ? 'amostra representativa' : 'amostra pode ser expandida para maior confiabilidade'}.`);
        }
        
        if (stats.geographic.totalNeighborhoods > 0) {
          insights.push(`Cobertura geográfica: ${stats.geographic.totalNeighborhoods} ${stats.geographic.totalNeighborhoods === 1 ? 'bairro' : 'bairros'} ${stats.geographic.totalNeighborhoods >= 5 ? 'representados na análise' : 'analisados - considere expandir para mais bairros'}.`);
        }
      }
      
      // Generate report for analysis queries
      if (isAnalysisQuery && stats.satisfaction) {
        const avgScore = parseFloat(stats.satisfaction.averageScore);
        const responseRate = parseFloat(stats.population?.responseRate || 0);
        const equityGap = parseFloat(stats.geographic?.equityGap || 0);
        
        report = {
          text: `📊 RELATÓRIO DE ANÁLISE DE SATISFAÇÃO\n` +
                `${'='.repeat(60)}\n\n` +
                `📈 MÉTRICAS PRINCIPAIS:\n` +
                `• Total de Respostas: ${stats.population?.total || 0} cidadãos\n` +
                `• Satisfação Média: ${stats.satisfaction.averageScore}/5.0` +
                (avgScore < 3.0 ? ` ⚠️  Baixa` : avgScore < 4.0 ? ` ✓ Moderada` : ` ✓ Excelente`) + `\n` +
                `• Taxa de Resposta: ${responseRate}%` +
                (responseRate < 50 ? ` ⚠️  Pode melhorar` : responseRate >= 70 ? ` ✓ Excelente` : ` ✓ Boa`) + `\n` +
                `• Cobertura Geográfica: ${stats.geographic?.totalNeighborhoods || 0} bairros\n` +
                `• Equidade entre Bairros: ${equityGap.toFixed(1)} pontos de diferença` +
                (equityGap > 25 ? ` ⚠️  Alta desigualdade` : equityGap > 15 ? ` ⚠️  Moderada` : ` ✓ Boa equidade`) + `\n\n` +
                `💡 INTERPRETAÇÃO:\n` +
                (avgScore < 3.0 ? `A satisfação está abaixo do esperado. Ação imediata recomendada para identificar e resolver problemas.\n` : 
                 avgScore < 4.0 ? `Satisfação em nível moderado. Há espaço para melhorias para alcançar excelência.\n` :
                 `Satisfação em bom nível. Manter qualidade e identificar oportunidades de inovação.\n`) +
                (responseRate < 50 ? `A taxa de resposta pode ser melhorada expandindo canais de comunicação.\n` :
                 responseRate >= 70 ? `Excelente engajamento da comunidade. Aproveitar para co-criação de políticas.\n` :
                 `Boa participação. Continuar engajando a comunidade.\n`),
          metrics: {
            total: stats.population?.total || 0,
            averageScore: stats.satisfaction.averageScore,
            responseRate: stats.population?.responseRate || 0,
            neighborhoods: stats.geographic?.totalNeighborhoods || 0,
            equityGap: equityGap,
            satisfactionLevel: avgScore < 3.0 ? 'low' : avgScore < 4.0 ? 'moderate' : 'high',
            responseLevel: responseRate < 50 ? 'low' : responseRate >= 70 ? 'excellent' : 'good'
          },
          type: 'satisfaction'
        };
      }
    } else {
      summary = `Análise municipal pronta para: "${query}". Dados de feedback dos cidadãos disponíveis para análise.`;
      insights.push('É necessário coletar mais dados para fazer uma análise mais detalhada.');
      recommendations.push('Implementar formas sistemáticas de coletar feedback dos cidadãos nas pesquisas.');
    }
    
    return {
      agent: this.name,
      query,
      analysis: {
        summary,
        insights,
        recommendations,
        type: 'intelligent_fallback',
        dataPoints: this.extractDataPoints(context),
        report: report
      },
      dataSource: 'municipal_intelligence_system',
      intelligenceLevel: 'fallback_intelligent',
      realData: true,
      provenance: {
        source: 'knowledge_agent+fallback',
        llm: { used: false },
        pipelineVersion: null
      },
      timestamp: new Date().toISOString(),
      success: true
    };
  }

  async executeStandardAnalysis(query, preloadedContext) {
    const analysisType = this.determineAnalysisType(query);
    let analysis;
    
    if (preloadedContext?.analysisResults) {
      analysis = preloadedContext.analysisResults;
    } else {
      analysis = await this.executeAnalysis(analysisType, query);
    }
    
    const response = this.generateResponse(query, analysis, analysisType);
    
    return {
      agent: this.name,
      query,
      analysis: {
        ...response,
        // Ensure report is included in the analysis object for UI access
        report: response.report || null
      },
      analysisType,
      dataSource: 'data.json',
      realData: true,
      provenance: {
        source: 'knowledge_agent+direct_analysis',
        llm: { used: false },
        pipelineVersion: null
      },
      timestamp: new Date().toISOString(),
      success: true
    };
  }

  createErrorResponse(query, error) {
    return {
      agent: this.name,
      error: error.message,
      analysis: {
        summary: this.getFallbackResponse(query),
        insights: ['Erro do sistema ocorreu durante o processamento'],
        recommendations: ['Tente novamente ou contate o administrador do sistema'],
        type: 'error_fallback'
      },
      provenance: { source: 'knowledge_agent+error', llm: { used: false } },
      timestamp: new Date().toISOString(),
      success: false
    };
  }

  // === EXISTING METHODS (preserved for compatibility) ===
  
  determineAnalysisType(query) {
    const queryLower = query.toLowerCase();
    // NEW: age satisfaction detection (faixa etária, idade)
    if ((queryLower.includes('idade') || queryLower.includes('faixa et') || queryLower.includes('faixa-et')) && (queryLower.includes('satisf'))) {
      return 'age_satisfaction';
    }
    
    if (queryLower.includes('summary') || queryLower.includes('overview') || 
        queryLower.includes('analysis') || queryLower.includes('report')) {
      return 'comprehensive';
    }
    
    if (queryLower.includes('satisfaction') || queryLower.includes('satisf')) {
      return 'satisfaction';
    }
    
    if (queryLower.includes('issue') || queryLower.includes('problem') || 
        queryLower.includes('concern') || queryLower.includes('complaint')) {
      return 'issues';
    }
    
    if (queryLower.includes('neighborhood') || queryLower.includes('bairro') || 
        queryLower.includes('area') || queryLower.includes('district')) {
      return 'neighborhoods';
    }
    
    if (queryLower.includes('participat') || queryLower.includes('event') || 
        queryLower.includes('meeting') || queryLower.includes('community')) {
      return 'participation';
    }
    
    if (queryLower.includes('engagement') || queryLower.includes('response') || 
        queryLower.includes('rate') || queryLower.includes('click')) {
      return 'engagement';
    }
    
    return 'comprehensive';
  }

  async executeAnalysis(analysisType, query) {
    const analysis = {};
    
    switch (analysisType) {
      case 'satisfaction':
        analysis.satisfaction = await this.analysisEngine.analyzeSatisfaction();
        if (query.toLowerCase().includes('neighborhood') || query.toLowerCase().includes('bairro')) {
          analysis.neighborhoods = await this.analysisEngine.analyzeNeighborhoods();
        }
        break;
      case 'age_satisfaction':
        analysis.satisfaction = await this.analysisEngine.analyzeSatisfaction();
        analysis.ageSatisfaction = await this.analysisEngine.analyzeSatisfactionByAge();
        break;
        
      case 'issues':
        analysis.issues = await this.analysisEngine.analyzeIssues();
        analysis.neighborhoods = await this.analysisEngine.analyzeNeighborhoods();
        break;
        
      case 'neighborhoods':
        analysis.neighborhoods = await this.analysisEngine.analyzeNeighborhoods();
        analysis.satisfaction = await this.analysisEngine.analyzeSatisfaction();
        break;
        
      case 'participation':
        analysis.participation = await this.analysisEngine.analyzeParticipation();
        analysis.neighborhoods = await this.analysisEngine.analyzeNeighborhoods();
        break;
        
      case 'engagement':
        analysis.engagement = await this.analysisEngine.analyzeEngagement();
        analysis.neighborhoods = await this.analysisEngine.analyzeNeighborhoods();
        break;
        
      case 'comprehensive':
      default:
        analysis.satisfaction = await this.analysisEngine.analyzeSatisfaction();
        analysis.issues = await this.analysisEngine.analyzeIssues();
        analysis.neighborhoods = await this.analysisEngine.analyzeNeighborhoods();
        analysis.engagement = await this.analysisEngine.analyzeEngagement();
        analysis.participation = await this.analysisEngine.analyzeParticipation();
        break;
    }
    
    return analysis;
  }

  generateResponse(query, analysis, analysisType) {
    const response = {
      type: analysisType,
      summary: '',
      insights: [],
      recommendations: [],
      data: analysis
    };

    response.summary = this.generateSummary(analysisType, analysis, query);
    response.insights = this.aggregateInsights(analysis);
    response.recommendations = this.aggregateRecommendations(analysis);
    
    if (Object.keys(analysis).length > 1) {
      const crossInsights = this.generateCrossAnalysisInsights(analysis, query);
      response.insights.push(...crossInsights.insights);
      response.recommendations.push(...crossInsights.recommendations);
    }

    // Generate structured report for analysis queries
    response.report = this.buildAnalysisReport(analysisType, analysis, query);

    return response;
  }

  /**
   * Build structured report for analysis queries
   * @param {string} analysisType - Type of analysis
   * @param {Object} analysis - Analysis data
   * @param {string} query - Original query
   * @returns {Object|null} Structured report or null
   */
  buildAnalysisReport(analysisType, analysis, query) {
    const report = {
      text: '',
      metrics: {},
      type: analysisType
    };

    switch (analysisType) {
      case 'satisfaction':
        if (analysis.satisfaction && analysis.satisfaction.total > 0) {
          const sat = analysis.satisfaction;
          const avgScore = parseFloat(sat.averageScore);
          
          report.text = `📊 RELATÓRIO DE ANÁLISE DE SATISFAÇÃO\n`;
          report.text += `${'='.repeat(60)}\n\n`;
          
          report.text += `📈 MÉTRICAS PRINCIPAIS:\n`;
          report.text += `• Total de Respostas: ${sat.total} cidadãos\n`;
          report.text += `• Satisfação Média: ${sat.averageScore}/5.0\n`;
          
          // Add interpretation
          if (avgScore < 2.0) {
            report.text += `  ⚠️  Crítico: Satisfação muito baixa, ação imediata necessária\n`;
          } else if (avgScore < 3.0) {
            report.text += `  ⚠️  Baixa: Necessita atenção e melhorias\n`;
          } else if (avgScore < 4.0) {
            report.text += `  ✓ Moderada: Boa base, com espaço para melhorias\n`;
          } else {
            report.text += `  ✓ Excelente: Alto nível de satisfação\n`;
          }
          
          report.text += `\n📊 DISTRIBUIÇÃO DE SATISFAÇÃO:\n`;
          if (sat.breakdown && Array.isArray(sat.breakdown)) {
            // Sort by count descending
            const sortedBreakdown = [...sat.breakdown].sort((a, b) => b.count - a.count);
            sortedBreakdown.forEach(item => {
              const bar = '█'.repeat(Math.round(item.percentage / 2));
              report.text += `  ${item.level.padEnd(20)} ${item.count.toString().padStart(3)} (${item.percentage}%) ${bar}\n`;
            });
          }
          
          if (sat.dissatisfaction) {
            report.text += `\n⚠️  INSATISFAÇÃO:\n`;
            report.text += `• ${sat.dissatisfaction.percentage}% dos cidadãos estão insatisfeitos (${sat.dissatisfaction.count} pessoas)\n`;
            report.text += `• Ação recomendada: Contato direto e resolução de problemas\n`;
          }
          
          // Add trend if available
          if (sat.satisfactionTrend) {
            report.text += `\n📈 TENDÊNCIA: ${sat.satisfactionTrend}\n`;
          }
          
          // Add quality indicator
          if (sat.analysisQuality) {
            const qualityLabels = {
              'high': '✓ Alta confiabilidade',
              'medium': '⚠️ Confiabilidade moderada',
              'low': '⚠️ Baixa confiabilidade',
              'insufficient_data': '⚠️ Dados insuficientes'
            };
            report.text += `\n🔍 QUALIDADE DOS DADOS: ${qualityLabels[sat.analysisQuality] || sat.analysisQuality}\n`;
          }
          
          report.metrics = {
            total: sat.total,
            averageScore: sat.averageScore,
            breakdown: sat.breakdown || [],
            dissatisfaction: sat.dissatisfaction || null,
            trend: sat.satisfactionTrend || null,
            quality: sat.analysisQuality || 'unknown'
          };
        }
        break;

      case 'age_satisfaction':
        if (analysis.ageSatisfaction && analysis.ageSatisfaction.totalResponses > 0) {
          const ageSat = analysis.ageSatisfaction;
          report.text = `📊 RELATÓRIO DE SATISFAÇÃO POR IDADE\n`;
          report.text += `${'='.repeat(60)}\n\n`;
          
          report.text += `📈 VISÃO GERAL:\n`;
          report.text += `• Total de Respostas com Idade: ${ageSat.totalResponses}\n`;
          report.text += `• Faixas Etárias Analisadas: ${ageSat.brackets.length}\n\n`;
          
          report.text += `📊 DISTRIBUIÇÃO POR FAIXA ETÁRIA:\n`;
          // Sort by average score to show patterns
          const sortedBrackets = [...ageSat.brackets].sort((a, b) => b.averageScore - a.averageScore);
          sortedBrackets.forEach((bracket, index) => {
            const score = parseFloat(bracket.averageScore);
            const indicator = score >= 4.0 ? '✓' : score >= 3.0 ? '⚠️' : '❌';
            report.text += `  ${indicator} ${bracket.label.padEnd(10)}: ${bracket.count.toString().padStart(3)} respostas | Média: ${bracket.averageScore}/5.0\n`;
          });
          
          // Find highest and lowest satisfaction age groups
          const highest = sortedBrackets[0];
          const lowest = sortedBrackets[sortedBrackets.length - 1];
          if (highest && lowest && highest !== lowest) {
            report.text += `\n💡 INSIGHTS:\n`;
            report.text += `• Faixa com maior satisfação: ${highest.label} (${highest.averageScore}/5)\n`;
            report.text += `• Faixa que precisa atenção: ${lowest.label} (${lowest.averageScore}/5)\n`;
            const gap = (parseFloat(highest.averageScore) - parseFloat(lowest.averageScore)).toFixed(1);
            report.text += `• Diferença entre faixas: ${gap} pontos\n`;
          }
          
          report.metrics = {
            totalResponses: ageSat.totalResponses,
            brackets: ageSat.brackets || [],
            highestSatisfaction: highest || null,
            lowestSatisfaction: lowest || null
          };
        }
        break;

      case 'comprehensive':
        report.text = `📊 RELATÓRIO DE ANÁLISE MUNICIPAL COMPLETA\n`;
        report.text += `${'='.repeat(60)}\n\n`;
        
        report.text += `📈 RESUMO EXECUTIVO:\n`;
        if (analysis.satisfaction) {
          const sat = analysis.satisfaction;
          report.text += `• Satisfação: ${sat.averageScore}/5.0 (${sat.total} respostas)\n`;
          if (sat.dissatisfaction) {
            report.text += `  ⚠️  ${sat.dissatisfaction.percentage}% insatisfeitos\n`;
          }
        }
        if (analysis.neighborhoods) {
          const neigh = analysis.neighborhoods;
          report.text += `• Cobertura Geográfica: ${neigh.totalNeighborhoods} bairros analisados\n`;
          if (neigh.needsAttention && neigh.needsAttention.length > 0) {
            report.text += `  ⚠️  ${neigh.needsAttention.length} bairro(s) precisam de atenção\n`;
          }
        }
        if (analysis.issues) {
          const issues = analysis.issues;
          report.text += `• Questões Identificadas: ${issues.total} questões reportadas\n`;
          if (issues.breakdown && issues.breakdown.length > 0) {
            const topIssue = issues.breakdown[0];
            report.text += `  🔴 Principal: ${topIssue.issue} (${topIssue.count} relatos)\n`;
          }
        }
        if (analysis.engagement) {
          const eng = analysis.engagement;
          report.text += `• Engajamento: ${eng.answered}/${eng.total} respostas (${((eng.answered/eng.total)*100).toFixed(1)}%)\n`;
        }
        if (analysis.participation) {
          const part = analysis.participation;
          report.text += `• Participação: ${part.interested}/${part.total} interessados (${((part.interested/part.total)*100).toFixed(1)}%)\n`;
        }
        
        report.metrics = {
          satisfaction: analysis.satisfaction || null,
          neighborhoods: analysis.neighborhoods || null,
          issues: analysis.issues || null,
          engagement: analysis.engagement || null,
          participation: analysis.participation || null
        };
        break;

      default:
        // For other analysis types, create a basic report
        if (analysis[analysisType]) {
          const data = analysis[analysisType];
          report.text = `Relatório de ${analysisType}\n\n`;
          report.metrics = data;
        }
        break;
    }

    return report.text ? report : null;
  }

  generateSummary(analysisType, analysis, query) {
    switch (analysisType) {
      case 'age_satisfaction':
        const ageSat = analysis.ageSatisfaction;
        if (!ageSat || ageSat.totalResponses === 0) {
          return 'Sem dados suficientes de idade para análise de satisfação por faixa etária.';
        }
        return `Análise de satisfação por idade: ${ageSat.totalResponses} respostas com idade; ${ageSat.brackets.length} faixas com dados.`;
      case 'satisfaction':
        const sat = analysis.satisfaction;
        if (!sat || sat.total === 0) {
          return 'No satisfaction data available for analysis.';
        }
        return `Satisfaction analysis from ${sat.total} residents shows average score of ${sat.averageScore}/5.`;

      case 'issues':
        const issues = analysis.issues;
        if (!issues || issues.total === 0) {
          return 'No issue data available for analysis.';
        }
        const topIssue = issues.breakdown[0];
        return `Issue analysis from ${issues.total} responses identifies ${topIssue.issue} as the primary concern.`;

      case 'neighborhoods':
        const neighborhoods = analysis.neighborhoods;
        if (!neighborhoods || neighborhoods.totalNeighborhoods === 0) {
          return 'No neighborhood data available.';
        }
        return `Geographic analysis covers ${neighborhoods.totalNeighborhoods} neighborhoods.`;

      case 'participation':
        const participation = analysis.participation;
        if (!participation || participation.total === 0) {
          return 'No participation data available.';
        }
        return `Community participation analysis: ${participation.interested} out of ${participation.total} residents interested.`;

      case 'engagement':
        const engagement = analysis.engagement;
        if (!engagement) {
          return 'No engagement data available.';
        }
        return `Engagement analysis: ${engagement.answered}/${engagement.total} responses.`;

      default:
        return `Municipal analysis completed.`;
    }
  }

  aggregateInsights(analysis) {
    const allInsights = [];
    
    Object.values(analysis).forEach(component => {
      if (component && component.insights) {
        allInsights.push(...component.insights.slice(0, 3));
      }
    });
    
    return allInsights.slice(0, 8);
  }

  aggregateRecommendations(analysis) {
    const allRecommendations = [];
    
    Object.values(analysis).forEach(component => {
      if (component && component.recommendations) {
        allRecommendations.push(...component.recommendations.slice(0, 2));
      }
    });
    
    return allRecommendations.slice(0, 6);
  }

  generateCrossAnalysisInsights(analysis, query) {
    const insights = [];
    const recommendations = [];

    if (analysis.satisfaction && analysis.neighborhoods) {
      const avgSatisfaction = parseFloat(analysis.satisfaction.averageScore);
      const lowResponseAreas = analysis.neighborhoods.needsAttention?.length || 0;
      
      if (avgSatisfaction < 3.0 && lowResponseAreas > 0) {
        insights.push('Low satisfaction correlates with poor response rates in some areas');
        recommendations.push('Address satisfaction issues to improve engagement');
      }
    }

    return { insights, recommendations };
  }

  getFallbackResponse(query) {
    return `Municipal knowledge analysis ready for: "${query}". Please specify what aspect you'd like to explore.`;
  }

  /**
   * Check if query is a name search
   */
  isNameSearchQuery(query) {
    const normalize = (s) => (s || '').toString().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    const qn = normalize(query);
    
    // CRITICAL: Exclude analysis/report queries from name search detection
    const analysisKeywords = [
      'analise', 'analysis', 'relatorio', 'report', 'estatistica', 'statistics',
      'satisfacao', 'satisfaction', 'engajamento', 'engagement', 
      'bairro', 'neighborhood', 'bairros', 'neighborhoods',
      'resumo', 'summary', 'overview', 'visao', 'view',
      'problema', 'problem', 'problemas', 'problems',
      'questao', 'question', 'questoes', 'questions',
      'participacao', 'participation',
      'idade', 'age', 'faixa etaria', 'age bracket'
    ];
    
    // If query contains analysis keywords, it's NOT a name search
    if (analysisKeywords.some(kw => qn.includes(kw))) {
      return false;
    }
    
    const nameSearchVerbs = [
      'encontre', 'encontrar', 'encontra', 'busque', 'buscar', 'busca', 
      'find', 'search', 'procure', 'procurar', 'procura', 
      'mostre', 'mostrar', 'mostra', 'show', 'exiba', 'exibir', 
      'traga', 'trazer', 'quem e', 'quem eh', 'quem é', 'localize', 'localizar'
    ];
    
    return nameSearchVerbs.some(verb => qn.includes(verb));
  }

  /**
   * Extract name from query for display purposes
   */
  extractNameFromQuery(query) {
    const normalize = (s) => (s || '').toString().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    const qn = normalize(query);
    
    const nameSearchVerbs = [
      'encontre', 'encontrar', 'encontra', 'busque', 'buscar', 'busca', 
      'find', 'search', 'procure', 'procurar', 'procura', 
      'mostre', 'mostrar', 'mostra', 'show', 'exiba', 'exibir', 
      'traga', 'trazer', 'quem e', 'quem eh', 'quem é', 'localize', 'localizar'
    ];
    
    const commonWords = [
      'o', 'a', 'os', 'as', 'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na',
      'the', 'a', 'an', 'me', 'meu', 'minha', 'meus', 'minhas',
      'um', 'uma', 'uns', 'umas', 'que', 'qual', 'quais'
    ];
    
    const words = query.split(/\s+/).filter(w => {
      const normalized = normalize(w);
      return !commonWords.includes(normalized) && !nameSearchVerbs.includes(normalized);
    });
    
    const nameLikeWords = words.filter(w => 
      w.length >= 2 && /[a-záàâãéèêíìîóòôõúùûçA-ZÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ]/.test(w)
    );
    
    return nameLikeWords.join(' ') || query;
  }
}

const knowledgeAgentInstance = new IntelligentKnowledgeAgent();

async function knowledgeAgent(query, llmResult, preloadedContext = null) {
  return await knowledgeAgentInstance.processQuery(query, llmResult, preloadedContext);
}

module.exports = { knowledgeAgent };