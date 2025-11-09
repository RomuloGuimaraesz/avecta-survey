// services/ResponseProcessor.js - Process and validate LLM responses for municipal intelligence
class ResponseProcessor {
  constructor() {
    this.name = 'Response Processor';
    this.version = '2.0.intelligent';
  }

  /**
   * Process raw LLM response into structured municipal intelligence
   */
  processResponse(rawResponse, queryAnalysis, intelligentContext, metadata = {}) {
    try {
      // Validate response quality first
      const qualityAssessment = this.assessResponseQuality(rawResponse, intelligentContext);
      
      if (qualityAssessment.level === 'poor') {
        console.warn('[ResponseProcessor] Poor quality response detected, enhancing...');
        return this.enhanceResponse(rawResponse, queryAnalysis, intelligentContext, qualityAssessment);
      }

      // Process high-quality response
      const processedResponse = this.formatResponse(rawResponse, queryAnalysis);
      const extractedInsights = this.extractActionableInsights(processedResponse);
      const validatedRecommendations = this.validateRecommendations(extractedInsights, intelligentContext);

      return {
        response: processedResponse,
        insights: extractedInsights,
        recommendations: validatedRecommendations,
        quality: qualityAssessment,
        metadata: {
          ...metadata,
          processed: true,
          confidence: this.calculateConfidence(qualityAssessment, intelligentContext),
          actionable: validatedRecommendations.length > 0
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('[ResponseProcessor] Error processing response:', error);
      return this.createFallbackResponse(queryAnalysis, intelligentContext, error);
    }
  }

  /**
   * Assess the quality of LLM response
   */
  assessResponseQuality(response, intelligentContext) {
    const assessment = {
      score: 0,
      issues: [],
      strengths: [],
      level: 'poor'
    };

    // Check for specific data usage (30 points)
    if (this.usesSpecificData(response, intelligentContext)) {
      assessment.score += 30;
      assessment.strengths.push('Uses specific municipal data');
    } else {
      assessment.issues.push('Generic response without specific data');
    }

    // Check for actionable recommendations (25 points)
    if (this.hasActionableRecommendations(response)) {
      assessment.score += 25;
      assessment.strengths.push('Contains actionable recommendations');
    } else {
      assessment.issues.push('Lacks specific actionable recommendations');
    }

    // Check for statistical context (20 points)
    if (this.hasStatisticalContext(response)) {
      assessment.score += 20;
      assessment.strengths.push('Includes statistical context');
    } else {
      assessment.issues.push('Missing statistical confidence information');
    }

    // Check for municipal expertise (15 points)
    if (this.showsMunicipalExpertise(response)) {
      assessment.score += 15;
      assessment.strengths.push('Demonstrates municipal domain knowledge');
    } else {
      assessment.issues.push('Generic advice lacking municipal expertise');
    }

    // Check response length and depth (10 points)
    if (response.length > 200 && response.length < 2000) {
      assessment.score += 10;
      assessment.strengths.push('Appropriate response length');
    } else {
      assessment.issues.push('Response too short or excessively long');
    }

    // Determine overall quality level
    if (assessment.score >= 80) assessment.level = 'excellent';
    else if (assessment.score >= 60) assessment.level = 'good';
    else if (assessment.score >= 40) assessment.level = 'fair';
    else assessment.level = 'poor';

    return assessment;
  }

  usesSpecificData(response, intelligentContext) {
    if (!intelligentContext || !intelligentContext.statisticalProfile) return false;
    
    const keyMetrics = [
      intelligentContext.statisticalProfile.population.total.toString(),
      intelligentContext.statisticalProfile.population.responseRate,
      intelligentContext.statisticalProfile.satisfaction.averageScore,
      intelligentContext.statisticalProfile.geographic.totalNeighborhoods.toString()
    ];

    return keyMetrics.some(metric => response.includes(metric));
  }

  hasActionableRecommendations(response) {
    const actionPatterns = [
      /implement|establish|create|develop|schedule|organize/i,
      /within \d+|immediate|short-term|long-term/i,
      /contact|reach out|follow up|engage/i
    ];

    return actionPatterns.some(pattern => pattern.test(response));
  }

  hasStatisticalContext(response) {
    const statPatterns = [
      /\d+%|\d+\.\d+%/g,
      /confidence|significance|sample|reliability/i,
      /above|below|higher|lower.*benchmark/i
    ];

    return statPatterns.some(pattern => pattern.test(response));
  }

  showsMunicipalExpertise(response) {
    const municipalTerms = [
      'municipal', 'civic', 'citizen', 'community', 'service delivery',
      'governance', 'public service', 'municipal management', 'urban',
      'neighborhood', 'satisfaction', 'engagement', 'equity'
    ];

    const termCount = municipalTerms.filter(term => 
      response.toLowerCase().includes(term)
    ).length;

    return termCount >= 3;
  }

  /**
   * Enhance poor quality responses
   */
  enhanceResponse(rawResponse, queryAnalysis, intelligentContext, qualityAssessment) {
    console.log('[ResponseProcessor] Enhancing response quality...');
    
    let enhancedResponse = rawResponse;

    // Add missing data context
    if (qualityAssessment.issues.includes('Generic response without specific data')) {
      const dataContext = this.generateDataContext(intelligentContext);
      enhancedResponse = `${dataContext}\n\n${enhancedResponse}`;
    }

    // Add missing actionable recommendations
    if (qualityAssessment.issues.includes('Lacks specific actionable recommendations')) {
      const recommendations = this.generateContextualRecommendations(queryAnalysis, intelligentContext);
      enhancedResponse += `\n\nSpecific Recommendations:\n${recommendations}`;
    }

    // Add statistical context if missing
    if (qualityAssessment.issues.includes('Missing statistical confidence information')) {
      const statContext = this.generateStatisticalContext(intelligentContext);
      enhancedResponse += `\n\nStatistical Context:\n${statContext}`;
    }

    return {
      response: enhancedResponse,
      insights: this.extractActionableInsights(enhancedResponse),
      recommendations: this.generateContextualRecommendations(queryAnalysis, intelligentContext).split('\n'),
      quality: { ...qualityAssessment, enhanced: true },
      metadata: {
        processed: true,
        enhanced: true,
        originalQuality: qualityAssessment.level,
        confidence: 0.7 // Enhanced responses have moderate confidence
      },
      timestamp: new Date().toISOString()
    };
  }

  generateDataContext(intelligentContext) {
    if (!intelligentContext || !intelligentContext.statisticalProfile) {
      return 'Based on available municipal data:';
    }

    const stats = intelligentContext.statisticalProfile;
    return `Based on analysis of ${stats.population.total} municipal contacts with ${stats.population.responseRate}% response rate and ${stats.satisfaction.averageScore}/5 average satisfaction:`;
  }

  generateContextualRecommendations(queryAnalysis, intelligentContext) {
    const recommendations = [];

    if (!intelligentContext || !intelligentContext.statisticalProfile) {
      return '• Increase data collection to enable more specific recommendations\n• Implement systematic citizen feedback mechanisms';
    }

    const stats = intelligentContext.statisticalProfile;
    const responseRate = parseFloat(stats.population.responseRate);
    const satisfaction = parseFloat(stats.satisfaction.averageScore);
    const engagement = parseFloat(stats.population.engagementRate);

    // Response rate recommendations
    if (responseRate < 50) {
      recommendations.push('• Implement multi-channel outreach to improve response rates');
      recommendations.push('• Schedule follow-up contacts within 48-72 hours');
    }

    // Satisfaction recommendations
    if (satisfaction < 3.5) {
      recommendations.push('• Address top-priority service issues within 30 days');
      recommendations.push('• Establish direct communication channels with dissatisfied residents');
    }

    // Engagement recommendations
    if (engagement < 60) {
      recommendations.push('• Optimize message timing and content for better engagement');
      recommendations.push('• Test alternative communication channels');
    }

    // Geographic equity recommendations
    if (stats.geographic && parseFloat(stats.geographic.equityGap) > 25) {
      recommendations.push('• Implement targeted outreach for underperforming neighborhoods');
      recommendations.push('• Investigate service delivery disparities');
    }

    return recommendations.length > 0 ? recommendations.join('\n') : '• Continue current engagement strategies and monitor performance';
  }

  generateStatisticalContext(intelligentContext) {
    if (!intelligentContext || !intelligentContext.statisticalProfile) {
      return 'É necessário coletar mais respostas para ter conclusões mais confiáveis.';
    }

    const stats = intelligentContext.statisticalProfile;
    const context = [];

    if (stats.satisfaction && stats.satisfaction.reliability) {
      const reliabilityText = {
        'high': 'alta confiabilidade',
        'moderate': 'confiabilidade moderada',
        'low': 'baixa confiabilidade'
      };
      context.push(`• Qualidade dos dados: ${reliabilityText[stats.satisfaction.reliability] || stats.satisfaction.reliability} (${stats.satisfaction.sampleSize} respostas coletadas)`);
    }

    if (stats.satisfaction && stats.satisfaction.confidenceInterval) {
      context.push(`• Margem de erro: ±${stats.satisfaction.confidenceInterval.marginOfError} pontos`);
    }

    if (intelligentContext.benchmarkComparison) {
      const benchmark = intelligentContext.benchmarkComparison;
      const performanceText = {
        'excellent': 'acima do esperado',
        'good': 'dentro do esperado',
        'fair': 'abaixo do esperado',
        'poor': 'muito abaixo do esperado'
      };
      context.push(`• Desempenho: ${performanceText[benchmark.satisfaction.performance] || benchmark.satisfaction.performance}`);
    }

    return context.length > 0 ? context.join('\n') : 'Informações sobre a qualidade dos dados disponíveis mediante solicitação.';
  }

  /**
   * Extract actionable insights from response
   */
  extractActionableInsights(response) {
    const insights = [];
    
    // Extract bullet points and numbered lists
    const bulletPattern = /[•\-\*]\s*([^\n]+)/g;
    const numberedPattern = /\d+\.\s*([^\n]+)/g;
    
    let match;
    while ((match = bulletPattern.exec(response)) !== null) {
      insights.push({
        type: 'insight',
        content: match[1].trim(),
        actionable: this.isActionable(match[1])
      });
    }
    
    while ((match = numberedPattern.exec(response)) !== null) {
      insights.push({
        type: 'recommendation',
        content: match[1].trim(),
        actionable: this.isActionable(match[1])
      });
    }

    return insights;
  }

  isActionable(text) {
    const actionWords = ['implement', 'establish', 'create', 'contact', 'schedule', 'develop', 'organize', 'address', 'improve'];
    return actionWords.some(word => text.toLowerCase().includes(word));
  }

  /**
   * Validate recommendations against data reality
   */
  validateRecommendations(insights, intelligentContext) {
    if (!intelligentContext || !intelligentContext.statisticalProfile) {
      return insights.filter(insight => insight.actionable);
    }

    const validatedRecommendations = [];
    const stats = intelligentContext.statisticalProfile;

    insights.filter(insight => insight.actionable).forEach(insight => {
      const validation = this.validateSingleRecommendation(insight.content, stats);
      validatedRecommendations.push({
        ...insight,
        validation,
        feasible: validation.score >= 70
      });
    });

    return validatedRecommendations;
  }

  validateSingleRecommendation(recommendation, stats) {
    const validation = { score: 50, issues: [], strengths: [] };

    // Check if recommendation is data-supported
    if (this.isDataSupported(recommendation, stats)) {
      validation.score += 30;
      validation.strengths.push('Supported by data');
    } else {
      validation.issues.push('Not clearly supported by available data');
    }

    // Check if recommendation is specific
    if (this.isSpecific(recommendation)) {
      validation.score += 20;
      validation.strengths.push('Specific and measurable');
    } else {
      validation.issues.push('Too vague or general');
    }

    return validation;
  }

  isDataSupported(recommendation, stats) {
    const rec = recommendation.toLowerCase();
    
    // Response rate recommendations
    if (rec.includes('response') && parseFloat(stats.population.responseRate) < 60) return true;
    
    // Satisfaction recommendations
    if (rec.includes('satisfaction') && parseFloat(stats.satisfaction.averageScore) < 3.5) return true;
    
    // Engagement recommendations
    if (rec.includes('engagement') && parseFloat(stats.population.engagementRate) < 60) return true;
    
    return false;
  }

  isSpecific(recommendation) {
    const specificityIndicators = [
      /\d+\s*(days?|weeks?|months?)/i,  // Time references
      /within|by|before/i,              // Timeline indicators
      /\d+%|\d+\.\d+/i,                 // Specific numbers
      /contact|call|email|meet/i        // Specific actions
    ];

    return specificityIndicators.some(pattern => pattern.test(recommendation));
  }

  /**
   * Format response for better readability
   */
  formatResponse(response, queryAnalysis) {
    let formatted = response;

    // Ensure proper line breaks for readability
    formatted = formatted.replace(/\. ([A-Z])/g, '.\n\n$1');
    
    // Format bullet points consistently
    formatted = formatted.replace(/[•\-\*]/g, '•');
    
    // Ensure numbers in lists are properly formatted
    formatted = formatted.replace(/(\d+)\.\s*/g, '$1. ');

    // Add emphasis to key metrics
    formatted = formatted.replace(/(\d+(?:\.\d+)?%)/g, '**$1**');
    formatted = formatted.replace(/(\d+(?:\.\d+)?\/5)/g, '**$1**');

    return formatted;
  }

  /**
   * Calculate response confidence based on quality and data availability
   */
  calculateConfidence(qualityAssessment, intelligentContext) {
    let confidence = 0.5; // Base confidence

    // Quality contribution (40% of confidence)
    const qualityContribution = (qualityAssessment.score / 100) * 0.4;
    confidence += qualityContribution;

    // Data availability contribution (30% of confidence)
    if (intelligentContext && intelligentContext.statisticalProfile) {
      const sampleSize = intelligentContext.statisticalProfile.satisfaction.sampleSize || 0;
      const dataQuality = Math.min(sampleSize / 50, 1) * 0.3; // Max contribution at 50+ responses
      confidence += dataQuality;
    }

    // Statistical reliability contribution (30% of confidence)
    if (intelligentContext && intelligentContext.statisticalProfile && intelligentContext.statisticalProfile.satisfaction.reliability) {
      const reliabilityMap = { high: 0.3, moderate: 0.2, low: 0.1 };
      confidence += reliabilityMap[intelligentContext.statisticalProfile.satisfaction.reliability] || 0.1;
    }

    return Math.min(Math.max(confidence, 0.3), 0.95); // Keep between 30% and 95%
  }

  /**
   * Create fallback response for errors
   */
  createFallbackResponse(queryAnalysis, intelligentContext, error) {
    const fallbackContent = this.generateIntelligentFallback(queryAnalysis, intelligentContext);
    
    return {
      response: fallbackContent,
      insights: [],
      recommendations: [],
      quality: { level: 'fallback', score: 40, issues: ['LLM processing error'], strengths: ['Data-driven fallback'] },
      metadata: {
        processed: true,
        fallback: true,
        error: error.message,
        confidence: 0.4
      },
      timestamp: new Date().toISOString()
    };
  }

  generateIntelligentFallback(queryAnalysis, intelligentContext) {
    if (!intelligentContext || !intelligentContext.statisticalProfile) {
      return `Municipal data analysis available. Query "${queryAnalysis.primaryIntent}" requires additional data processing. Please ensure adequate sample size and try again.`;
    }

    const stats = intelligentContext.statisticalProfile;
    const summary = intelligentContext.executiveSummary;
    
    return `Municipal Intelligence Summary:

${summary}

Key Metrics:
• Total Citizens: ${stats.population.total}
• Response Rate: ${stats.population.responseRate}%
• Satisfaction Score: ${stats.satisfaction.averageScore}/5
• Engagement Rate: ${stats.population.engagementRate}%

Esta análise é baseada em ${stats.satisfaction.sampleSize} respostas com ${stats.satisfaction.reliability === 'high' ? 'alta' : stats.satisfaction.reliability === 'moderate' ? 'moderada' : 'baixa'} confiabilidade. Para insights mais detalhados, refina sua consulta ou entre em contato com o analista de dados municipal.`;
  }
}

module.exports = ResponseProcessor;
