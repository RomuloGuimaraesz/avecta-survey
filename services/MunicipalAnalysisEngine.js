// services/MunicipalAnalysisEngine.js - Domain-specific municipal analysis without data access
const DataAccessLayer = require('./DataAccessLayer');

class MunicipalAnalysisEngine {
  constructor() {
    this.dataAccess = new DataAccessLayer();
    this.name = 'Municipal Analysis Engine';
  }

  // ==================== SATISFACTION ANALYSIS ====================
  
  async analyzeSatisfaction(filters = {}) {
    const rawData = this.dataAccess.getSatisfactionRawData();
    
    if (rawData.total === 0) {
      return {
        total: 0,
        averageScore: 0,
        maxScore: 5,
        breakdown: [],
        insights: ['Não há respostas de pesquisa disponíveis para análise.'],
        recommendations: ['Aumentar a participação na pesquisa para coletar dados de satisfação dos cidadãos.'],
        analysisQuality: 'insufficient_data'
      };
    }

    // Calculate weighted score
    const weights = {
      'Muito satisfeito': 5,
      'Satisfeito': 4,
      'Neutro': 3,
      'Insatisfeito': 2,
      'Muito insatisfeito': 1
    };

    let totalScore = 0;
    let totalResponses = 0;

    Object.entries(rawData.breakdown).forEach(([level, count]) => {
      const weight = weights[level] || 3;
      totalScore += weight * count;
      totalResponses += count;
    });

    const averageScoreNumeric = totalResponses > 0 ? (totalScore / totalResponses) : 0;

    // Create breakdown with percentages
    const breakdown = Object.entries(rawData.breakdown).map(([level, count]) => ({
      level,
      count,
      percentage: ((count / rawData.total) * 100).toFixed(1)
    }));
    // Generate insights
    const analysis = this.generateSatisfactionInsights(rawData, averageScoreNumeric, breakdown);

    const dissatisfaction = this.calculateDissatisfactionStats(breakdown);

    // Integrity check
    const sumCounts = breakdown.reduce((s, b) => s + parseInt(b.count), 0);
    if (sumCounts !== rawData.total) {
      console.warn('[MunicipalAnalysisEngine] Satisfaction breakdown total mismatch', { reported: rawData.total, sumCounts });
    }

    return {
      total: rawData.total,
      averageScore: Number(averageScoreNumeric.toFixed(2)),
      maxScore: 5,
      breakdown,
      insights: analysis.insights,
      recommendations: analysis.recommendations,
      analysisQuality: analysis.quality,
      ...dissatisfaction,
      satisfactionTrend: this.assessSatisfactionTrend(averageScoreNumeric),
      meta: { computationVersion: 'sat_v0.2' }
    };
  }

  // ==================== AGE SATISFACTION ANALYSIS (NEW) ====================
  async analyzeSatisfactionByAge() {
    const responses = this.dataAccess.getSurveyResponses();
    const withAge = responses.filter(r => r.age && r.survey && r.survey.satisfaction);
    if (withAge.length === 0) {
      return {
        totalResponses: 0,
        brackets: [],
        insightSummary: 'Não há informações suficientes sobre a idade dos respondentes para fazer uma análise por faixa etária.',
        recommendations: ['Solicitar a idade dos cidadãos nas próximas pesquisas para poder identificar se há problemas específicos em diferentes grupos de idade.', 'Entre em contato com os cidadãos que já responderam para coletar informações de idade quando possível.'],
        analysisQuality: 'insufficient_data',
        meta: { computationVersion: 'age_sat_v0.1' }
      };
    }

    const weights = {
      'Muito satisfeito': 5,
      'Satisfeito': 4,
      'Neutro': 3,
      'Insatisfeito': 2,
      'Muito insatisfeito': 1
    };

    const bracketsDef = [
      { key: '15-24', min: 15, max: 24 },
      { key: '25-34', min: 25, max: 34 },
      { key: '35-44', min: 35, max: 44 },
      { key: '45-54', min: 45, max: 54 },
      { key: '55-64', min: 55, max: 64 },
      { key: '65+',  min: 65, max: 150 }
    ];

    const buckets = bracketsDef.map(b => ({ ...b, count: 0, totalScore: 0 }));

    withAge.forEach(r => {
      const ageNum = parseInt(r.age, 10);
      if (isNaN(ageNum)) return;
      const bracket = buckets.find(b => ageNum >= b.min && ageNum <= b.max);
      if (!bracket) return;
      const score = weights[r.survey.satisfaction] ?? 3;
      bracket.count++;
      bracket.totalScore += score;
    });

    const brackets = buckets
      .filter(b => b.count > 0)
      .map(b => ({
        key: b.key,
        label: b.key,
        count: b.count,
        averageScore: parseFloat((b.totalScore / b.count).toFixed(2))
      }));

    let insightSummary = 'A satisfação está distribuída de forma similar entre as diferentes faixas etárias.';
    if (brackets.length > 1) {
      const sorted = [...brackets].sort((a, b) => a.averageScore - b.averageScore);
      const lowest = sorted[0];
      const highest = sorted[sorted.length - 1];
      if (highest.averageScore - lowest.averageScore >= 0.5) {
        const ageGroupNames = {
          '15-24': 'jovens (15-24 anos)',
          '25-34': 'jovens adultos (25-34 anos)',
          '35-44': 'adultos (35-44 anos)',
          '45-54': 'adultos maduros (45-54 anos)',
          '55-64': 'pré-aposentadoria (55-64 anos)',
          '65+': 'idosos (65+ anos)'
        };
        const lowestName = ageGroupNames[lowest.label] || lowest.label;
        const highestName = ageGroupNames[highest.label] || highest.label;
        insightSummary = `Há uma diferença importante: ${highestName} estão mais satisfeitos (${highest.averageScore.toFixed(1)}/5) do que ${lowestName} (${lowest.averageScore.toFixed(1)}/5). Isso indica que ${lowestName} podem estar enfrentando problemas específicos que precisam de atenção.`;
      }
    }

    const recommendations = [];
    const lowBracket = brackets.find(b => b.averageScore < 3.0);
    if (lowBracket) {
      const ageGroupNames = {
        '15-24': 'jovens de 15-24 anos',
        '25-34': 'jovens adultos de 25-34 anos',
        '35-44': 'adultos de 35-44 anos',
        '45-54': 'adultos de 45-54 anos',
        '55-64': 'pessoas de 55-64 anos',
        '65+': 'idosos de 65+ anos'
      };
      const bracketName = ageGroupNames[lowBracket.label] || `faixa ${lowBracket.label}`;
      recommendations.push(`Ação prioritária: Contatar diretamente os ${bracketName} que estão insatisfeitos para entender suas preocupações específicas. Agendar reuniões ou visitas para ouvir suas necessidades.`);
      recommendations.push(`Investigar quais serviços municipais estão falhando para esta faixa etária. Pode ser transporte público, saúde, segurança ou outros serviços que afetam mais esta população.`);
      recommendations.push(`Desenvolver um plano de ação específico para melhorar os serviços que afetam os ${bracketName}, com prazos claros e acompanhamento mensal.`);
    }
    if (brackets.every(b => b.averageScore >= 3.0)) {
      recommendations.push('A satisfação está em níveis aceitáveis em todas as faixas etárias. Continue monitorando e mantendo os serviços de qualidade.');
      recommendations.push('Mantenha o diálogo aberto com todas as faixas etárias para identificar problemas antes que se tornem críticos.');
    }

    return {
      totalResponses: withAge.length,
      brackets,
      insightSummary,
      recommendations,
      analysisQuality: withAge.length < 30 ? 'limited' : 'good',
      meta: { computationVersion: 'age_sat_v0.1' }
    };
  }

  generateSatisfactionInsights(rawData, averageScoreNumeric, breakdown) {
    const insights = [];
    const recommendations = [];
    let quality = 'good';

    const avgScore = parseFloat(averageScoreNumeric);
    const { dissatisfiedPercent, dissatisfactionTier } = this.calculateDissatisfactionStats(breakdown);
    
    // Sample size assessment
    if (rawData.total < 30) {
      quality = 'limited';
      insights.push(`Poucos respondentes (${rawData.total} pessoas) - os resultados podem não representar toda a população. É recomendável coletar mais respostas.`);
      recommendations.push('Aumentar a participação na pesquisa para ter uma visão mais confiável da satisfação dos cidadãos.');
    } else if (rawData.total >= 100) {
      quality = 'excellent';
      insights.push(`Boa quantidade de respostas (${rawData.total} pessoas) - os dados são confiáveis para tomada de decisão.`);
    }

    // Satisfaction level analysis
    if (dissatisfactionTier === 'critical') {
      insights.push(`Situação crítica: ${dissatisfiedPercent.toFixed(1)}% dos cidadãos estão insatisfeitos. Isso requer ação imediata.`);
      recommendations.push('Ação prioritária: identificar e resolver os principais problemas que estão causando insatisfação.');
      recommendations.push('Agendar reuniões urgentes com os cidadãos afetados para ouvir suas preocupações e buscar soluções.');
    } else if (dissatisfactionTier === 'elevated') {
      insights.push(`Alerta: ${dissatisfiedPercent.toFixed(1)}% dos cidadãos estão insatisfeitos. É necessário agir para evitar que a situação piore.`);
      recommendations.push('Investigar as causas da insatisfação através de contatos diretos e conversas com os cidadãos afetados.');
    }

    if (avgScore < 3.0) {
      insights.push(`Satisfação baixa: nota média de ${avgScore.toFixed(2)}/5 indica problemas estruturais que precisam ser corrigidos.`);
      recommendations.push('Implementar ações direcionadas para melhorar a satisfação, focando nos problemas mais relatados.');
    } else if (avgScore >= 4.0) {
      insights.push(`Satisfação positiva: nota média de ${avgScore.toFixed(2)}/5 mostra que os cidadãos estão satisfeitos com os serviços.`);
      recommendations.push('Documentar o que está funcionando bem para manter esses níveis de satisfação.');
    } else if (avgScore >= 3.0 && dissatisfactionTier === 'low') {
      insights.push(`Satisfação moderada: nota média de ${avgScore.toFixed(2)}/5 com pouca insatisfação. Há espaço para melhorar.`);
      recommendations.push('Focar em converter os cidadãos neutros em satisfeitos através de melhorias nos serviços.');
    }

    // Distribution analysis
    const neutralCount = breakdown.find(b => b.level === 'Neutro')?.count || 0;
    if (neutralCount > rawData.total * 0.3) {
      insights.push(`Muitos cidadãos neutros (${neutralCount} pessoas, ${((neutralCount / rawData.total) * 100).toFixed(1)}%) - isso pode indicar que eles não estão nem satisfeitos nem insatisfeitos, ou que não têm opinião formada.`);
      recommendations.push('Entrar em contato com os cidadãos neutros para entender suas necessidades específicas e identificar oportunidades de melhoria.');
    }

    return { insights, recommendations, quality };
  }

  // ==================== NEIGHBORHOOD ANALYSIS ====================
  
  async analyzeNeighborhoods() {
    const rawData = this.dataAccess.getNeighborhoodRawData();

    const neighborhoodsRaw = Object.entries(rawData).map(([name, stats]) => {
      const responseRate = stats.total > 0 ? (stats.answered / stats.total) * 100 : 0;
      const engagementRate = stats.sent > 0 ? (stats.clicked / stats.sent) * 100 : 0;
      return {
        neighborhood: name,
        total: stats.total,
        sent: stats.sent,
        clicked: stats.clicked,
        answered: stats.answered,
        responseRate, // numeric
        engagementRate // numeric
      };
    });

    // Sort copy by response for ranking
    const byResponse = [...neighborhoodsRaw].sort((a, b) => b.responseRate - a.responseRate);
    const avgResponse = byResponse.length ? byResponse.reduce((s, n) => s + n.responseRate, 0) / byResponse.length : 0;
    const attentionCutoff = Math.max(0, avgResponse - 10); // relative threshold

    const analysis = this.generateNeighborhoodInsights(byResponse);

    // Integrity check: ensure no rate > 100
    byResponse.forEach(n => {
      if (n.responseRate > 100 || n.engagementRate > 100) {
        console.warn('[MunicipalAnalysisEngine] Rate exceeded 100%', n);
      }
    });

    return {
      neighborhoods: neighborhoodsRaw
        .map(n => ({
          ...n,
          responseRate: n.responseRate.toFixed(1),
            engagementRate: n.engagementRate.toFixed(1)
        }))
        .sort((a, b) => b.total - a.total),
      insights: analysis.insights,
      recommendations: analysis.recommendations,
      equityAssessment: analysis.equityAssessment,
      totalNeighborhoods: neighborhoodsRaw.length,
      bestPerforming: byResponse[0] ? { neighborhood: byResponse[0].neighborhood, responseRate: byResponse[0].responseRate.toFixed(1) } : null,
      needsAttention: neighborhoodsRaw
        .filter(n => n.responseRate < attentionCutoff)
        .map(n => ({ neighborhood: n.neighborhood, responseRate: n.responseRate.toFixed(1) })),
      meta: {
        avgResponseRate: avgResponse.toFixed(1),
        attentionCutoff: attentionCutoff.toFixed(1),
        computationVersion: 'neigh_v0.2'
      }
    };
  }

  generateNeighborhoodInsights(neighborhoodsSortedByResponse) {
    const insights = [];
    const recommendations = [];
    let equityAssessment = 'good';

    if (neighborhoodsSortedByResponse.length === 0) {
      return {
        insights: ['Não há dados de bairros disponíveis para análise.'],
        recommendations: ['Certifique-se de coletar informações de bairro durante o cadastro dos cidadãos.'],
        equityAssessment: 'unknown'
      };
    }
    const responseRates = neighborhoodsSortedByResponse.map(n => n.responseRate);
    const avgResponseRate = responseRates.reduce((a, b) => a + b, 0) / responseRates.length;
    const lowPerforming = neighborhoodsSortedByResponse.filter(n => n.responseRate < (avgResponseRate - 10));
    const highPerforming = neighborhoodsSortedByResponse.filter(n => n.responseRate >= 80);

    // Overall performance
    insights.push(`Cobertura geográfica: ${neighborhoodsSortedByResponse.length} bairros, com taxa média de resposta de ${avgResponseRate.toFixed(1)}%.`);

    // Highest response rate (top of sorted list)
    const top = neighborhoodsSortedByResponse[0];
    insights.push(`Melhor desempenho: ${top.neighborhood} com ${top.responseRate.toFixed(1)}% de resposta.`);

    if (highPerforming.length > 0) {
      const neighborhoods = highPerforming.slice(0,3).map(n => n.neighborhood).join(', ');
      recommendations.push(`Copiar as práticas que funcionam bem nos bairros: ${neighborhoods}. Identifique o que está funcionando e aplique em outros bairros.`);
    }

    if (lowPerforming.length > 0) {
      const list = lowPerforming.slice(0,5).map(n => `${n.neighborhood} (${n.responseRate.toFixed(1)}%)`).join(', ');
      insights.push(`Bairros que precisam de atenção: ${list}. Estes bairros têm participação abaixo da média.`);
      equityAssessment = lowPerforming.length > responseRates.length * 0.4 ? 'concern' : 'moderate';
      recommendations.push(`Ação prioritária: Contatar diretamente os cidadãos nos bairros com baixa participação para entender por que não estão respondendo. Visitar estes bairros e fazer reuniões presenciais pode aumentar o engajamento.`);
    } else {
      equityAssessment = 'excellent';
      insights.push('A participação está consistente entre os bairros, o que é um bom sinal de engajamento equilibrado.');
    }

    const totalContacts = neighborhoodsSortedByResponse.reduce((s, n) => s + n.total, 0);
    if (totalContacts > 0) {
      const topShare = (top.total / totalContacts) * 100;
      if (topShare > 40) {
        insights.push(`Atenção: ${top.neighborhood} concentra ${topShare.toFixed(1)}% dos contatos. Isso pode indicar que outros bairros não estão sendo bem representados.`);
        recommendations.push('Expandir o cadastro de cidadãos em outros bairros para ter uma representação mais equilibrada da população.');
      }
    }

    return { insights, recommendations, equityAssessment };
  }

  // ==================== ISSUES ANALYSIS ====================
  
  async analyzeIssues() {
    const rawData = this.dataAccess.getIssuesRawData();
    
    if (rawData.total === 0) {
      return {
        total: 0,
        breakdown: [],
        insights: ['Não há dados de problemas relatados pelos cidadãos para análise.'],
        recommendations: ['Aumentar a participação na pesquisa para identificar as principais preocupações da comunidade.']
      };
    }

    // Sort by count and calculate percentages
    const breakdown = Object.entries(rawData.breakdown)
      .sort(([,a], [,b]) => b - a)
      .map(([issue, count]) => ({
        issue,
        count,
        percentage: ((count / rawData.total) * 100).toFixed(1)
      }));

    const analysis = this.generateIssuesInsights(rawData, breakdown);

    return {
      total: rawData.total,
      breakdown,
      insights: analysis.insights,
      recommendations: analysis.recommendations,
      priorityIssues: breakdown.slice(0, 3),
      diversityIndex: this.calculateIssueDiversity(breakdown)
    };
  }

  generateIssuesInsights(rawData, breakdown) {
    const insights = [];
    const recommendations = [];

    if (breakdown.length === 0) {
      return { insights: ['Nenhum problema foi relatado pelos cidadãos.'], recommendations: [] };
    }

    const topIssue = breakdown[0];
    const topThreePercentage = breakdown.slice(0, 3).reduce((sum, issue) => sum + parseFloat(issue.percentage), 0);

    insights.push(`Principal preocupação da comunidade: ${topIssue.issue} (${topIssue.percentage}% de ${rawData.total} respostas).`);
    insights.push(`As 3 principais questões representam ${topThreePercentage.toFixed(1)}% de todas as preocupações relatadas.`);

    // Issue concentration analysis
    if (parseFloat(topIssue.percentage) > 50) {
      insights.push(`Há uma questão dominante que precisa de atenção prioritária: ${topIssue.issue}.`);
      recommendations.push(`Ação imediata: Focar recursos e esforços para resolver o problema de ${topIssue.issue}. Este é claramente a prioridade número 1 da comunidade.`);
    } else if (topThreePercentage > 70) {
      insights.push('As preocupações estão concentradas em poucas áreas principais, o que facilita o trabalho de intervenção.');
      recommendations.push('Desenvolver um plano integrado que aborde as 3 principais questões simultaneamente, de forma coordenada.');
    } else {
      insights.push('Há uma ampla gama de preocupações diferentes, indicando que a comunidade tem necessidades diversas.');
      recommendations.push('Considerar um plano abrangente de melhorias municipais que aborde múltiplas prioridades de forma organizada.');
    }

    // Specific issue recommendations
    breakdown.slice(0, 3).forEach(issue => {
      const specificRec = this.getIssueSpecificRecommendation(issue.issue);
      if (specificRec) recommendations.push(specificRec);
    });

    return { insights, recommendations };
  }

  // ==================== ENGAGEMENT ANALYSIS ====================
  
  async analyzeEngagement() {
    const rawData = this.dataAccess.getEngagementRawData();
    
    const rates = {
      response: rawData.total > 0 ? ((rawData.answered / rawData.total) * 100).toFixed(1) : '0',
      engagement: rawData.sent > 0 ? ((rawData.clicked / rawData.sent) * 100).toFixed(1) : '0',
      completion: rawData.clicked > 0 ? ((rawData.answered / rawData.clicked) * 100).toFixed(1) : '0'
    };

    const analysis = this.generateEngagementInsights(rawData, rates);

    return {
      total: rawData.total,
      sent: rawData.sent,
      clicked: rawData.clicked,
      answered: rawData.answered,
      rates,
      insights: analysis.insights,
      recommendations: analysis.recommendations,
      performanceLevel: analysis.performanceLevel,
      engagementFunnel: this.analyzeEngagementFunnel(rawData)
    };
  }

  generateEngagementInsights(rawData, rates) {
    const insights = [];
    const recommendations = [];
    let performanceLevel = 'fair';

    const responseRate = parseFloat(rates.response);
    const engagementRate = parseFloat(rates.engagement);
    const completionRate = parseFloat(rates.completion);

    // Overall performance assessment
    if (responseRate >= 70) {
      performanceLevel = 'excellent';
      insights.push(`Taxa de resposta excelente (${responseRate}%) - a estratégia de comunicação está funcionando muito bem.`);
    } else if (responseRate >= 50) {
      performanceLevel = 'good';
      insights.push(`Taxa de resposta boa (${responseRate}%) - há um bom engajamento da comunidade.`);
    } else if (responseRate >= 30) {
      performanceLevel = 'fair';
      insights.push(`Taxa de resposta moderada (${responseRate}%) - há espaço para melhorar o engajamento.`);
      recommendations.push('Melhorar as estratégias de comunicação para aumentar as taxas de resposta. Testar diferentes horários de envio e formatos de mensagem.');
    } else {
      performanceLevel = 'poor';
      insights.push(`Taxa de resposta baixa (${responseRate}%) - há desafios significativos de engajamento que precisam ser resolvidos.`);
      recommendations.push('Revisão completa da abordagem de comunicação necessária. Considerar mudanças no conteúdo das mensagens, horários de envio e canais de comunicação.');
    }

    // Engagement funnel analysis
    insights.push(`Resumo do engajamento: ${rawData.answered} de ${rawData.total} cidadãos responderam (${responseRate}% de taxa de resposta).`);
    insights.push(`Eficácia da comunicação: ${engagementRate}% dos cidadãos clicaram no link da pesquisa após receber a mensagem.`);

    if (engagementRate < 60) {
      recommendations.push(`Melhorar o conteúdo e o horário das mensagens para aumentar o número de pessoas que clicam no link. A taxa atual de ${engagementRate}% pode ser melhorada.`);
    } else if (engagementRate >= 80) {
      insights.push('Taxa de cliques excelente - as mensagens estão interessantes e motivando os cidadãos a participar.');
    }

    if (completionRate < 70 && rawData.clicked > 0) {
      insights.push(`Atenção: apenas ${completionRate}% completaram a pesquisa após clicar. Muitos cidadãos começam mas não terminam.`);
      recommendations.push('Revisar o design da pesquisa - pode estar muito longa ou difícil de completar. Simplificar e tornar mais rápida pode aumentar a conclusão.');
    }

    return { insights, recommendations, performanceLevel };
  }

  // ==================== PARTICIPATION ANALYSIS ====================
  
  async analyzeParticipation() {
    const rawData = this.dataAccess.getParticipationRawData();
    
    if (rawData.total === 0) {
      return {
        total: 0,
        interested: 0,
        notInterested: 0,
        rate: '0',
        insights: ['Não há dados de participação disponíveis.'],
        recommendations: ['Incluir perguntas sobre interesse em participar em eventos comunitários nas próximas pesquisas.']
      };
    }

    const interested = rawData.breakdown['Sim'] || 0;
    const notInterested = rawData.breakdown['Não'] || 0;
    const rate = ((interested / rawData.total) * 100).toFixed(1);

    const analysis = this.generateParticipationInsights(rawData, interested, rate);

    return {
      total: rawData.total,
      interested,
      notInterested,
      rate,
      insights: analysis.insights,
      recommendations: analysis.recommendations,
      engagementPotential: analysis.engagementPotential
    };
  }

  generateParticipationInsights(rawData, interested, rate) {
    const insights = [];
    const recommendations = [];
    let engagementPotential = 'medium';

    const participationRate = parseFloat(rate);

    if (participationRate >= 70) {
      engagementPotential = 'high';
      insights.push(`Excelente: ${participationRate}% dos cidadãos demonstram interesse ativo em participar de eventos comunitários.`);
      insights.push('Este alto engajamento cívico é um valioso capital social para iniciativas municipais.');
      recommendations.push('Aproveitar este interesse forte organizando eventos comunitários regulares e estruturados.');
      recommendations.push('Considerar formar comitês consultivos de cidadãos com os residentes mais engajados.');
    } else if (participationRate >= 40) {
      engagementPotential = 'medium';
      insights.push(`Bom potencial: ${participationRate}% dos cidadãos mostram interesse em participar de eventos comunitários.`);
      insights.push('Base sólida para construir um engajamento comunitário mais forte.');
      recommendations.push(`Organizar eventos comunitários piloto com os ${interested} cidadãos interessados para começar a construir participação.`);
      recommendations.push('Usar o feedback dos primeiros eventos para melhorar e expandir a programação.');
    } else {
      engagementPotential = 'low';
      insights.push(`Engajamento limitado: apenas ${participationRate}% expressam interesse em participar.`);
      insights.push('O baixo interesse pode indicar barreiras (falta de tempo, transporte), desconfiança ou falhas na comunicação.');
      recommendations.push('Pesquisar barreiras à participação: perguntar sobre preferências de horário, local e formato de eventos.');
      recommendations.push('Começar com pequenos encontros comunitários informais para construir confiança.');
      recommendations.push('Considerar oferecer incentivos ou formatos de eventos mais acessíveis (on-line, próximos ao bairro, etc.).');
    }

    if (interested > 0) {
      insights.push(`Interesse comunitário: ${interested} cidadãos interessados em participar de ${rawData.total} respostas.`);
      recommendations.push(`Manter uma lista dos ${interested} cidadãos engajados para convites direcionados para eventos futuros.`);
    }

    return { insights, recommendations, engagementPotential };
  }

  // ==================== NOTIFICATION TARGETING ====================
  
  async getDissatisfiedResidents() {
    const dissatisfiedContacts = this.dataAccess.getDissatisfiedContactsRaw();
    
    if (dissatisfiedContacts.length === 0) {
      return {
        total: 0,
        residents: [],
        insights: ['Não há cidadãos insatisfeitos identificados nos dados atuais.'],
        recommendations: ['Continuar monitorando os níveis de satisfação em pesquisas futuras.'],
        urgencyLevel: 'low'
      };
    }

    // Analyze dissatisfaction levels and create priority scoring
    const residents = dissatisfiedContacts.map(contact => ({
      name: contact.name,
      whatsapp: contact.whatsapp,
      neighborhood: contact.neighborhood,
      satisfaction: contact.survey.satisfaction,
      mainIssue: contact.survey.issue,
      priority: contact.survey.satisfaction === 'Muito insatisfeito' ? 'HIGH' : 'MEDIUM',
      participationInterest: contact.survey.participate === 'Sim'
    }));

    const analysis = this.analyzeDissatisfactionPatterns(residents);

    return {
      total: dissatisfiedContacts.length,
      residents,
      breakdown: this.getDissatisfactionBreakdown(residents),
      insights: analysis.insights,
      recommendations: analysis.recommendations,
      urgencyLevel: analysis.urgencyLevel
    };
  }

  async getParticipationWilling() {
    const interestedContacts = this.dataAccess.getParticipationInterestedRaw();
    
    if (interestedContacts.length === 0) {
      return {
        total: 0,
        residents: [],
        insights: ['Nenhum cidadão expressou interesse em participar de eventos comunitários.'],
        recommendations: ['Incluir perguntas sobre participação em eventos futuros para identificar cidadãos interessados.']
      };
    }

    const residents = interestedContacts.map(contact => ({
      name: contact.name,
      whatsapp: contact.whatsapp,
      neighborhood: contact.neighborhood,
      satisfaction: contact.survey.satisfaction,
      mainIssue: contact.survey.issue
    }));

    const totalSurveyResponses = this.dataAccess.getSurveyResponses().length;
    const percentage = ((interestedContacts.length / totalSurveyResponses) * 100).toFixed(1);

    return {
      total: interestedContacts.length,
      residents,
      percentage,
      insights: this.generateParticipationTargetingInsights(residents, percentage),
      recommendations: this.generateParticipationTargetingRecommendations(residents)
    };
  }

  async getParticipationNotWilling() {
    const notInterestedContacts = this.dataAccess.getParticipationNotInterestedRaw();
    
    if (notInterestedContacts.length === 0) {
      return {
        total: 0,
        residents: [],
        insights: ['Todos os cidadãos pesquisados estão interessados ou indecisos sobre participação.'],
        recommendations: ['Continuar promovendo o engajamento e monitorar os sentimentos ao longo do tempo.']
      };
    }

    const residents = notInterestedContacts.map(contact => ({
      name: contact.name,
      whatsapp: contact.whatsapp,
      neighborhood: contact.neighborhood,
      satisfaction: contact.survey.satisfaction,
      mainIssue: contact.survey.issue
    }));

    const totalSurveyResponses = this.dataAccess.getSurveyResponses().length;
    const percentage = ((notInterestedContacts.length / totalSurveyResponses) * 100).toFixed(1);

    // Reuse insights generation with cautionary framing
    const insights = [
      `Hesitação na participação: ${percentage}% dos respondentes indicaram que não têm interesse no momento.`,
      'Possíveis barreiras: falta de tempo, relevância percebida, desconfiança ou falhas na comunicação.'
    ];

    const recommendations = [
      'Oferecer formatos de participação com baixo compromisso e flexíveis (eventos curtos, on-line, etc.).',
      'Esclarecer o valor e o benefício dos eventos, além do tempo de investimento esperado.',
      'Engajar através de canais do bairro para construir confiança.',
      'Reconvidar após resolver os principais problemas relatados pelos cidadãos.'
    ];

    return {
      total: notInterestedContacts.length,
      residents,
      percentage,
      insights,
      recommendations
    };
  }

      async getNonRespondents() {
    const rawData = this.dataAccess.getNonRespondentsRaw();
    
    const clickedButNotResponded = rawData.clickedButNotResponded;
    const contacted = rawData.contacted;
    const notContacted = rawData.notContacted;
    
    const total = clickedButNotResponded.length + contacted.length + notContacted.length;
    
    if (total === 0) {
      return {
        total: 0,
        residents: [],
        insights: ['Todos os contatos foram processados com sucesso.'],
        recommendations: ['Continuar com as estratégias atuais de engajamento.']
      };
    }

    const residents = [
      ...clickedButNotResponded.map(c => ({ ...c, status: 'Clicked but not responded' })),
      ...contacted.map(c => ({ ...c, status: 'Contacted but no click' })),
      ...notContacted.map(c => ({ ...c, status: 'Not contacted' }))
    ];

    return {
      total,
      residents,
      clickedButNotResponded: clickedButNotResponded.length,
      contacted: contacted.length,
      notContacted: notContacted.length,
      insights: this.generateNonRespondentInsights(rawData),
      recommendations: this.generateFollowUpRecommendations(rawData)
    };
  }

  // ==================== SYSTEM HEALTH ANALYSIS ====================
  
  async analyzeSystemHealth() {
    const rawData = this.dataAccess.getSystemHealthRawData();
    
    const health = this.assessOverallHealth(rawData);
    const analysis = this.generateSystemHealthInsights(rawData, health);

    return {
      totalContacts: rawData.totalContacts,
      duplicates: rawData.duplicateIssues.length,
      incompleteProfiles: rawData.incompleteProfiles.length,
      oldPending: rawData.oldPendingContacts.length,
      health: health.level,
      insights: analysis.insights,
      recommendations: analysis.recommendations,
      actionPriority: health.priority,
      issues: rawData.allIssues
    };
  }

  // ==================== HELPER METHODS ====================
  
  calculateDissatisfiedPercent(breakdown) {
    const dissatisfiedLevels = ['Muito insatisfeito', 'Insatisfeito'];
    const dissatisfiedCount = breakdown
      .filter(b => dissatisfiedLevels.includes(b.level))
      .reduce((sum, b) => sum + parseInt(b.count), 0);
    
    const total = breakdown.reduce((sum, b) => sum + parseInt(b.count), 0);
    return total > 0 ? Math.round((dissatisfiedCount / total) * 100) : 0;
  }

  calculateDissatisfiedCount(breakdown) {
    return breakdown
      .filter(b => ['Muito insatisfeito', 'Insatisfeito'].includes(b.level))
      .reduce((sum, b) => sum + parseInt(b.count), 0);
  }

  // Unified dissatisfaction stats (superset; keeps existing helpers for backward compatibility)
  calculateDissatisfactionStats(breakdown) {
    const dissLevels = new Set(['Muito insatisfeito', 'Insatisfeito']);
    let dissCount = 0;
    let total = 0;
    breakdown.forEach(b => {
      const c = typeof b.count === 'number' ? b.count : parseInt(b.count, 10);
      total += c;
      if (dissLevels.has(b.level)) dissCount += c;
    });
    const percent = total > 0 ? (dissCount / total) * 100 : 0;
    let tier = 'low';
    if (percent >= 40) tier = 'critical';
    else if (percent >= 25) tier = 'elevated';
    return { dissatisfiedCount: dissCount, dissatisfiedPercent: percent, dissatisfactionTier: tier };
  }

  assessSatisfactionTrend(averageScore) {
    const score = parseFloat(averageScore);
    if (score >= 4.0) return 'positive';
    if (score >= 3.0) return 'neutral';
    return 'concerning';
  }

  calculateIssueDiversity(breakdown) {
    // Shannon diversity index for issue distribution
    const total = breakdown.reduce((sum, issue) => sum + issue.count, 0);
    if (total === 0) return 0;
    
    const diversity = breakdown.reduce((sum, issue) => {
      const proportion = issue.count / total;
      return sum - (proportion * Math.log2(proportion));
    }, 0);
    
    return diversity.toFixed(2);
  }

  analyzeEngagementFunnel(rawData) {
    return {
      registered: rawData.total,
      contacted: rawData.sent,
      engaged: rawData.clicked,
      responded: rawData.answered,
      conversionRates: {
        contactToEngage: rawData.sent > 0 ? ((rawData.clicked / rawData.sent) * 100).toFixed(1) : '0',
        engageToRespond: rawData.clicked > 0 ? ((rawData.answered / rawData.clicked) * 100).toFixed(1) : '0'
      }
    };
  }

  getDissatisfactionBreakdown(residents) {
    const breakdown = {};
    residents.forEach(r => {
      breakdown[r.satisfaction] = (breakdown[r.satisfaction] || 0) + 1;
    });
    return breakdown;
  }

  analyzeDissatisfactionPatterns(residents) {
    const insights = [];
    const recommendations = [];
    let urgencyLevel = 'medium';

    const highPriority = residents.filter(r => r.priority === 'HIGH').length;
    const totalDissatisfied = residents.length;

    if (highPriority > totalDissatisfied * 0.6) {
      urgencyLevel = 'high';
      insights.push(`Situação crítica: ${highPriority} cidadãos estão muito insatisfeitos. Isso requer ação imediata.`);
      insights.push('A alta concentração de respostas "muito insatisfeito" indica problemas sistêmicos que afetam muitos cidadãos.');
      recommendations.push(`Ação urgente: Contatar diretamente os ${highPriority} casos de alta prioridade para entender e resolver seus problemas.`);
      recommendations.push('Considerar um plano de resposta municipal de emergência para resolver problemas críticos rapidamente.');
    } else if (highPriority > 0) {
      insights.push(`Preocupação prioritária: ${highPriority} casos precisam de atenção imediata.`);
      insights.push(`Além disso, ${totalDissatisfied - highPriority} casos precisam de acompanhamento agendado.`);
      recommendations.push(`Resposta prioritária para os ${highPriority} casos mais críticos. Contatar pessoalmente ou por telefone.`);
    }

    // Issue pattern analysis
    const issueFrequency = {};
    residents.forEach(resident => {
      const issue = resident.mainIssue;
      issueFrequency[issue] = (issueFrequency[issue] || 0) + 1;
    });

    if (Object.keys(issueFrequency).length > 0) {
      const topIssue = Object.keys(issueFrequency).reduce((a, b) => 
        issueFrequency[a] > issueFrequency[b] ? a : b
      );
      insights.push(`Principal preocupação entre os cidadãos insatisfeitos: ${topIssue} (${issueFrequency[topIssue]} casos).`);
      recommendations.push(`Resolver o problema sistêmico de ${topIssue} que afeta múltiplos cidadãos insatisfeitos. Este é um problema comum que precisa de uma solução ampla.`);
    }

    return { insights, recommendations, urgencyLevel };
  }

  generateParticipationTargetingInsights(residents, percentage) {
    const insights = [];
    const rate = parseFloat(percentage);

    if (rate >= 60) {
      insights.push(`Forte engajamento cívico: ${rate}% de interesse em participar indica uma comunidade ativa.`);
      insights.push('Este alto engajamento é um valioso capital social para iniciativas municipais.');
    } else if (rate >= 30) {
      insights.push(`Engajamento moderado: ${rate}% de interesse em participar fornece uma base sólida.`);
      insights.push('Bom potencial para construção comunitária com o cultivo adequado.');
    } else {
      insights.push(`Engajamento limitado: ${rate}% de interesse sugere barreiras ou falhas na comunicação.`);
      insights.push('O baixo interesse pode indicar necessidade de diferentes abordagens de engajamento.');
    }

    // Neighborhood distribution
    const neighborhoods = {};
    residents.forEach(r => {
      neighborhoods[r.neighborhood] = (neighborhoods[r.neighborhood] || 0) + 1;
    });

    if (Object.keys(neighborhoods).length > 1) {
      const topNeighborhood = Object.keys(neighborhoods).reduce((a, b) => 
        neighborhoods[a] > neighborhoods[b] ? a : b
      );
      insights.push(`Concentração geográfica: ${topNeighborhood} lidera com ${neighborhoods[topNeighborhood]} cidadãos interessados.`);
    }

    return insights;
  }

  generateParticipationTargetingRecommendations(residents) {
    const recommendations = [];
    
    if (residents.length > 20) {
      recommendations.push(`Base forte: ${residents.length} cidadãos interessados podem sustentar eventos comunitários regulares.`);
      recommendations.push('Considerar formar um comitê consultivo de cidadãos com os residentes mais engajados.');
    } else if (residents.length > 5) {
      recommendations.push(`Começar com eventos piloto direcionados aos ${residents.length} cidadãos interessados.`);
      recommendations.push('Usar o feedback para refinar a abordagem antes de expandir para toda a comunidade.');
    } else {
      recommendations.push('Grupo pequeno mas valioso - focar em engajamento individual e construção de relacionamentos.');
    }

    recommendations.push('Manter uma lista de contatos dedicada para convites de eventos comunitários.');
    recommendations.push('Pesquisar este grupo sobre tipos de eventos preferidos, horários e locais.');

    return recommendations;
  }

  generateNonRespondentInsights(rawData) {
    const insights = [];
    const total = rawData.clickedButNotResponded.length + rawData.contacted.length + rawData.notContacted.length;

    if (rawData.clickedButNotResponded.length > 0) {
      const abandonmentRate = (rawData.clickedButNotResponded.length / total * 100).toFixed(1);
      insights.push(`Abandono da pesquisa: ${rawData.clickedButNotResponded.length} cidadãos clicaram mas não completaram (${abandonmentRate}%).`);
      if (rawData.clickedButNotResponded.length > total * 0.3) {
        insights.push('Taxa alta de abandono sugere problemas de usabilidade ou pesquisa muito longa.');
      }
    }

    if (rawData.contacted.length > 0) {
      insights.push(`Engajamento inicial baixo: ${rawData.contacted.length} cidadãos foram contatados mas não clicaram no link da pesquisa.`);
    }

    if (rawData.notContacted.length > 0) {
      insights.push(`Oportunidade de alcance: ${rawData.notContacted.length} cidadãos ainda não foram contatados.`);
    }

    return insights;
  }

  generateFollowUpRecommendations(rawData) {
    const recommendations = [];

    if (rawData.clickedButNotResponded.length > 0) {
      recommendations.push(`Acompanhamento prioritário: ${rawData.clickedButNotResponded.length} cidadãos que mostraram interesse inicial (clicaram mas não completaram).`);
      recommendations.push('Considerar contato telefônico para cidadãos que clicaram mas não completaram a pesquisa.');
      if (rawData.clickedButNotResponded.length > 10) {
        recommendations.push('Revisar o design da pesquisa para melhorias potenciais de usabilidade - pode estar muito longa ou complicada.');
      }
    }

    if (rawData.contacted.length > 0) {
      recommendations.push(`Estratégia de re-engajamento: ${rawData.contacted.length} cidadãos precisam de uma abordagem de comunicação diferente.`);
      recommendations.push('Tentar mensagens alternativas ou horários diferentes para quem não clicou no link.');
    }

    if (rawData.notContacted.length > 0) {
      recommendations.push(`Expandir o alcance: ${rawData.notContacted.length} cidadãos aguardam contato inicial.`);
      recommendations.push('Criar um plano sistemático de contato para os cidadãos restantes.');
    }

    return recommendations;
  }

  assessOverallHealth(rawData) {
    const totalIssues = rawData.duplicateIssues.length + rawData.incompleteProfiles.length;
    const issueRate = totalIssues / rawData.totalContacts;

    if (issueRate < 0.05) {
      return { level: 'excellent', priority: 'low' };
    } else if (issueRate < 0.15) {
      return { level: 'good', priority: 'medium' };
    } else {
      return { level: 'needs_attention', priority: 'high' };
    }
  }

  generateSystemHealthInsights(rawData, health) {
    const insights = [];
    const recommendations = [];

    const healthText = {
      'excellent': 'excelente',
      'good': 'boa',
      'needs_attention': 'precisa de atenção'
    };
    insights.push(`Avaliação da qualidade dos dados: condição ${healthText[health.level] || health.level} com ${rawData.totalContacts} contatos no total.`);

    if (rawData.duplicateIssues.length > 0) {
      const duplicateRate = (rawData.duplicateIssues.length / rawData.totalContacts * 100).toFixed(1);
      insights.push(`Problema de qualidade dos dados: ${rawData.duplicateIssues.length} contatos duplicados (${duplicateRate}%).`);
      recommendations.push('Implementar procedimentos de detecção e limpeza de duplicatas para melhorar a qualidade dos dados.');
    }

    if (rawData.incompleteProfiles.length > 0) {
      const incompleteRate = (rawData.incompleteProfiles.length / rawData.totalContacts * 100).toFixed(1);
      insights.push(`Perfis incompletos: ${rawData.incompleteProfiles.length} perfis com informações faltando (${incompleteRate}%).`);
      recommendations.push('Fazer uma campanha de contato para completar as informações faltantes nos perfis dos cidadãos.');
    }

    if (rawData.oldPendingContacts.length > 0) {
      insights.push(`Acompanhamento necessário: ${rawData.oldPendingContacts.length} contatos com respostas pendentes há mais de 7 dias.`);
      recommendations.push('Fazer acompanhamento sistemático para contatos com respostas pendentes há muito tempo.');
    }

    if (health.level === 'excellent') {
      insights.push('O sistema está operando com qualidade de dados ideal.');
      recommendations.push('Continuar com as práticas atuais de gestão de dados.');
    }

    return { insights, recommendations };
  }

  getIssueSpecificRecommendation(issue) {
    const recommendations = {
      'Segurança': 'Coordenação urgente com a segurança pública para implementar medidas de segurança aprimoradas. Organizar reuniões com comandantes locais e propor ações específicas.',
      'Saúde': 'Revisar a capacidade e acessibilidade dos serviços de saúde. Verificar se há falta de médicos, medicamentos ou equipamentos nos postos de saúde.',
      'Transporte': 'Analisar as rotas e frequência do transporte público. Verificar se os horários atendem às necessidades dos cidadãos e se há pontos de ônibus em áreas necessitadas.',
      'Educação': 'Avaliar a capacidade e qualidade das escolas municipais. Verificar se há falta de vagas, professores ou materiais escolares.',
      'Emprego': 'Desenvolver programas de geração de emprego e desenvolvimento econômico. Criar oportunidades de capacitação e parcerias com empresas locais.',
      'Outros': 'Analisar detalhadamente as respostas personalizadas dos cidadãos para identificar problemas específicos que precisam de atenção.'
    };
    
    return recommendations[issue] || null;
  }
}

module.exports = MunicipalAnalysisEngine;