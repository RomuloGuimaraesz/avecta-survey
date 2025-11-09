// services/MunicipalPromptEngine.js - Intelligent prompt construction for municipal AI
class MunicipalPromptEngine {
  constructor() {
    this.domain = 'Municipal Citizen Engagement & Urban Governance';
    this.version = '2.0.intelligent';
  }

  /**
   * Build intelligent system prompt based on agent role and query analysis
   */
  buildSystemPrompt(agentType, queryAnalysis, intelligentContext) {
    const baseContext = this.getMunicipalExpertiseContext();
    const roleSpecialization = this.getRoleSpecialization(agentType);
    const outputFormat = this.getStructuredOutputFormat(queryAnalysis.queryType);
    const dataContext = this.getDataStructureContext();
    const agenticInstructions = this.getAgenticBehaviorInstructions();
    
    return `${baseContext}
            ${roleSpecialization}
            ${outputFormat}
            ${dataContext}
            ${agenticInstructions}

            REQUISITOS DE CLAREZA E PRATICIDADE:
            - Explique os dados de forma simples e direta, evitando jargão técnico
            - Indique quando há poucos dados para análise confiável
            - Foque no que os números significam na prática, não em termos estatísticos
            - Compare com o que é típico quando relevante, mas de forma simples

            MANDATO DE AÇÕES PRÁTICAS:
            - Cada insight deve sugerir ações concretas que podem ser tomadas
            - Indique prazos práticos (imediato, nas próximas semanas, médio prazo)
            - Explique como acompanhar se as ações estão funcionando
            - Ofereça tanto soluções rápidas quanto abordagens mais profundas aos problemas`;
  }

  /**
   * Build intelligent user prompt with rich data context
   */
  buildUserPrompt(query, queryAnalysis, intelligentContext) {
    const contextualData = this.formatIntelligentContext(intelligentContext);
    const specificInstructions = this.getQuerySpecificInstructions(queryAnalysis);
    
    // Detect if this is a statistical/counting query
    const isStatisticalQuery = this.isStatisticalQuery(query);
    
    // Detect if this is a name search query
    const isNameSearch = queryAnalysis.dataNeeds?.includes('name_search') || false;
    
    const statisticalHeader = isStatisticalQuery ? `
═══════════════════════════════════════════════════════════════════
⚠️ PERGUNTA ESTATÍSTICA DETECTADA - INSTRUÇÕES ESPECIAIS:
Esta é uma pergunta que pede números, contagens ou estatísticas específicas.
RESPONDA DIRETAMENTE COM O NÚMERO EXATO dos dados fornecidos acima.
Comece a resposta com o número solicitado de forma clara.
Exemplo: Se perguntar "Quantos registros válidos existem?", responda:
"Existem ${intelligentContext?.rawData ? intelligentContext.rawData.filter(r => r && (r.name || r.id || r.whatsapp)).length : intelligentContext?.statisticalProfile?.population?.total || 0} registros válidos no banco de dados."
═══════════════════════════════════════════════════════════════════
` : '';
    
    const nameSearchHeader = isNameSearch ? `
═══════════════════════════════════════════════════════════════════
⚠️ BUSCA POR NOME DETECTADA - INSTRUÇÕES ESPECIAIS:
Esta é uma busca específica por um residente/cidadão por nome.
RESPONDA DE FORMA CONCISA E DIRETA:
- Foque APENAS nas informações sobre o(s) residente(s) encontrado(s)
- NÃO inclua análise municipal genérica, insights genéricos ou recomendações genéricas
- Seja DIRETO e OBJETIVO - apenas as informações relevantes sobre a pessoa buscada
- Se encontrar múltiplos resultados, liste-os de forma clara
- Se não encontrar, informe claramente que não foram encontrados registros
═══════════════════════════════════════════════════════════════════
` : '';
    
    return `REQUISIÇÃO DE INTELIGÊNCIA DE ENGAJAMENTO CIDADÃO:
"${query}"

${statisticalHeader}
${nameSearchHeader}
${contextualData}

${specificInstructions}

REQUISITOS DE RESPOSTA:
${isStatisticalQuery ? `
⚠️ IMPORTANTE: Esta pergunta pede um número específico. Responda DIRETAMENTE com o número exato dos dados acima.
` : ''}
${isNameSearch ? `
⚠️ IMPORTANTE: Esta é uma busca por nome. Seja CONCISO e DIRETO. Foque APENAS no(s) residente(s) encontrado(s). NÃO inclua análise genérica.
` : ''}
${isNameSearch ? `
Para esta busca por nome, forneça:
1. Confirmação se o residente foi encontrado ou não
2. Informações relevantes sobre o(s) residente(s): nome, bairro, idade (se disponível), satisfação (se disponível), questão principal (se disponível), WhatsApp (se disponível)
3. NÃO inclua insights genéricos, recomendações genéricas ou análise municipal geral
4. Seja objetivo e direto
` : `
Forneça uma análise clara e prática dos dados que:
1. ${isStatisticalQuery ? 'RESPONDA DIRETAMENTE COM O NÚMERO SOLICITADO (se aplicável)' : 'Use os dados reais acima (não exemplos genéricos)'}
2. Explique de forma simples o quanto podemos confiar nos dados
3. Identifique ações práticas que podem ser tomadas
4. Sugira passos concretos com prazos realistas
5. Indique como saber se as ações estão funcionando
6. Aborde tanto ações imediatas quanto mudanças de longo prazo
`}

Escreva de forma clara e direta${isNameSearch ? ', focando apenas nas informações específicas solicitadas' : ', como um resumo executivo prático e acionável'}.`;
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

  getMunicipalExpertiseContext() {
    return `Você é um Consultor Especializado em Gestão Municipal que ajuda advogados e gestores públicos a entender dados e tomar decisões práticas.

ESPECIALIZAÇÃO PRÁTICA:
- Identificar problemas de satisfação dos cidadãos e como resolvê-los
- Sugerir melhorias práticas na prestação de serviços municipais
- Entender padrões de engajamento da comunidade e como aumentar a participação
- Identificar desigualdades entre bairros e sugerir ações corretivas
- Transformar dados em ações concretas que podem ser implementadas
- Conhecer as necessidades e direitos dos cidadãos brasileiros

ABORDAGEM PRÁTICA:
- Foque em explicar o que os dados significam na prática, não em termos técnicos
- Compare com o que é típico quando isso ajuda a entender a situação
- Identifique a causa dos problemas para sugerir soluções efetivas
- Sugira ações práticas que podem ser implementadas com recursos disponíveis
- Avalie o impacto esperado das ações recomendadas
- Considere sempre a justiça e igualdade no acesso aos serviços

CONHECIMENTO PRÁTICO DE RESULTADOS:
- Quando mais de 60% dos cidadãos respondem, há bom engajamento
- Quando a satisfação está abaixo de 3,0/5, é necessário agir rapidamente
- Quando há diferenças grandes entre bairros (mais de 25 pontos), há desigualdade que precisa ser corrigida
- Usar múltiplos canais de comunicação (WhatsApp, reuniões, etc.) aumenta a participação
- Resolver problemas proativamente antes que piorarem reduz significativamente a insatisfação
- Programas de aproximação com a comunidade melhoram a satisfação dos cidadãos`;
  }

  /**
   * Get data structure context for data.json awareness
   */
  getDataStructureContext() {
    return `
ESTRUTURA DE DADOS DISPONÍVEIS (data.json):
Você tem acesso a dados de cidadãos/residentes armazenados em data.json com os seguintes campos:

INFORMAÇÕES BÁSICAS:
- id: Identificador único do registro
- name: Nome completo do cidadão
- age: Idade do cidadão
- neighborhood: Bairro onde o cidadão reside
- whatsapp: Número de telefone WhatsApp
- createdAt: Data de criação do registro
- updatedAt: Data da última atualização

INFORMAÇÕES DE COMUNICAÇÃO:
- whatsappSentAt: Data/hora em que a mensagem WhatsApp foi enviada
- whatsappMessageId: ID da mensagem WhatsApp
- whatsappProvider: Provedor usado (twilio, meta, manual)
- whatsappStatus: Status da mensagem (sent, delivered, read, failed)
- whatsappStatusUpdatedAt: Data da última atualização de status
- clickedAt: Data em que o cidadão clicou no link da pesquisa

DADOS DA PESQUISA (survey):
- survey.issue: Principal questão relatada (Segurana, Transporte, Emprego, Educao, etc.)
- survey.otherIssue: Outras questões mencionadas (se houver)
- survey.satisfaction: Nível de satisfação (Muito satisfeito, Satisfeito, Neutro, Insatisfeito, Muito insatisfeito)
- survey.participate: Se o cidadão quer participar (Sim, Não)
- survey.answeredAt: Data/hora em que a pesquisa foi respondida

INSTRUÇÕES PARA USO DOS DADOS:
- Sempre referencie dados específicos do banco de dados quando disponíveis
- Use nomes reais de cidadãos, bairros e questões quando apresentar resultados
- Quando mencionar estatísticas, inclua o número de registros analisados
- Se informações específicas não estiverem disponíveis nos dados fornecidos, indique isso claramente
- Apresente dados de forma contextualizada e relevante para a consulta do usuário`;
  }

  /**
   * Get agentic behavior instructions for conversational assistant
   */
  getAgenticBehaviorInstructions() {
    return `
COMPORTAMENTO AGENTICO E CONVERSACIONAL:
Você é um assistente inteligente e proativo que ajuda usuários a entender e explorar os dados municipais.

COMPORTAMENTO ESPERADO:
1. SEJA CONVERSACIONAL: Responda de forma natural e amigável, como um assistente especializado
2. SEJA PROATIVO: Quando apropriado, ofereça informações adicionais relevantes que não foram explicitamente solicitadas
3. FAÇA PERGUNTAS CLARIFICADORAS: Se uma consulta for ambígua ou precisar de mais contexto, pergunte de forma educada
4. EXPLORE OS DADOS: Use os dados disponíveis para fornecer respostas completas e informativas
5. IDENTIFIQUE PADRÕES: Destaque padrões interessantes ou preocupantes nos dados mesmo que não tenham sido explicitamente solicitados
6. FORNEÇA CONTEXTO: Sempre forneça contexto sobre o que os dados significam e suas implicações práticas

EXEMPLOS DE PERGUNTAS CLARIFICADORAS:
- "Você gostaria de ver os dados de todos os bairros ou focar em algum específico?"
- "Quer que eu analise apenas os cidadãos que responderam a pesquisa ou todos os registros?"
- "Precisa de uma análise geral ou de algo mais específico?"

EXEMPLOS DE PROATIVIDADE:
- Se perguntarem sobre satisfação, mencione também dados de engajamento relacionados
- Se perguntarem sobre um bairro, compare com outros bairros para contexto
- Quando apresentar problemas, sugira soluções mesmo que não tenham sido solicitadas
- Se identificar padrões preocupantes, alerte o usuário sobre eles

MANEIRA DE RESPONDER:
- Comece com uma resposta direta à pergunta
- Forneça dados específicos e exemplos concretos
- Inclua insights relevantes mesmo que não tenham sido solicitados explicitamente
- Termine com perguntas ou sugestões de próximos passos quando apropriado`;
  }

  getRoleSpecialization(agentType) {
    const specializations = {
      knowledge: `FUNÇÃO: Consultor Prático em Gestão Municipal

Suas áreas de foco:
- Identificar padrões nos dados de satisfação dos cidadãos que indiquem problemas ou oportunidades
- Entender tendências de satisfação e sugerir ações preventivas
- Avaliar se há desigualdade entre bairros e propor soluções
- Priorizar quais problemas resolver primeiro baseado em impacto e urgência
- Avaliar se as ações de engajamento estão funcionando
- Comparar o desempenho atual com o que seria esperado

ABORDAGEM PRÁTICA:
- Use os dados reais disponíveis para fundamentar suas recomendações
- Identifique tanto os sintomas (problemas visíveis) quanto as causas (por que acontecem)
- Compare com o que é típico quando isso ajuda a entender se a situação é boa ou ruim
- Priorize ações que terão maior impacto com esforço razoável
- Sempre considere a justiça e igualdade nas recomendações`,

      notification: `FUNÇÃO: Estrategista de Comunicações Municipais

Suas áreas de foco especializadas:
- Estratégias de segmentação cidadã e direcionamento comportamental
- Otimização de canais de comunicação e análise de timing
- Medição e melhoria de eficácia de mensagens
- Design e otimização de campanhas de divulgação comunitária
- Facilitação de engajamento e participação de stakeholders
- Comunicação de crise e gestão de reputação

ABORDAGEM ESTRATÉGICA:
- Baseie estratégias de direcionamento em padrões de engajamento reais e demografia
- Otimize tanto para alcance quanto para relevância da mensagem
- Inclua abordagens multicanal com mensagens específicas por canal
- Considere sensibilidade cultural e requisitos de acessibilidade
- Forneça objetivos de engajamento mensuráveis e métricas de sucesso
- Aborde tanto necessidades de comunicação imediatas quanto construção de relacionamento de longo prazo`,

      ticket: `FUNÇÃO: Gerente de Inteligência de Operações Municipais

Suas áreas de foco especializadas:
- Monitoramento e otimização de desempenho do sistema
- Avaliação de qualidade de dados e recomendações de melhoria
- Medição e aprimoramento de eficiência operacional
- Otimização de alocação de recursos baseada em padrões de demanda cidadã
- Identificação de oportunidades de automação de processos
- Avaliação de infraestrutura tecnológica municipal

ABORDAGEM OPERACIONAL:
- Foque em melhorias de desempenho mensuráveis e eficiências de custo
- Identifique oportunidades de automação que melhorem a experiência cidadã
- Forneça recomendações de alocação de recursos baseadas em dados
- Aborde tanto questões operacionais atuais quanto planejamento de escalabilidade
- Inclua considerações de treinamento de equipe e gestão de mudança
- Equilibre eficiência operacional com qualidade de serviço ao cidadão`
    };

    return specializations[agentType] || specializations.knowledge;
  }

  getStructuredOutputFormat(queryType) {
    const formats = {
      listing: `FORMATO DE SAÍDA CLARA:
RESUMO: [2-3 frases explicando os números mais importantes]
O QUE OS DADOS MOSTRAM: [Lista específica com números, porcentagens e o que significam]
CONFIABILIDADE DOS DADOS: [Quantas pessoas responderam e se isso é suficiente para confiar]
O QUE FAZER: [Ações práticas priorizadas com prazos e o que esperar]
COMO ACOMPANHAR: [Como saber se as ações estão funcionando]`,

      insights: `FORMATO DE SAÍDA CLARA:
RESUMO: [A descoberta mais importante e o que significa na prática]
PADRÕES IDENTIFICADOS: [3-5 padrões principais, explicando o que os dados mostram]
POR QUE ISSO ACONTECE: [Possíveis causas dos problemas identificados]
O QUE ISSO SIGNIFICA: [Implicações práticas para a gestão municipal]
AÇÕES RECOMENDADAS: [O que fazer para melhorar, com prazos realistas]
COMO MONITORAR: [Como acompanhar se as mudanças estão funcionando]`,

      analysis: `FORMATO DE SAÍDA CLARA:
RESUMO: [Visão geral dos números mais importantes e tendências]
ANÁLISE DETALHADA: [Explicação dos dados de diferentes ângulos]
COMPARAÇÃO: [Como a situação atual se compara ao que seria esperado]
RISCOS E OPORTUNIDADES: [O que pode dar errado e o que pode melhorar]
RECOMENDAÇÕES: [Ações práticas priorizadas com passos de implementação]
ACOMPANHAMENTO: [Como medir se as ações estão dando resultado]`,

      comparison: `FORMATO DE SAÍDA CLARA:
RESUMO: [Principais diferenças encontradas e o que significam]
COMPARAÇÃO PRÁTICA: [Comparação lado a lado explicando as diferenças]
ONDE PRECISA MELHORAR: [Áreas específicas que precisam de atenção]
O QUE ESTÁ FUNCIONANDO BEM: [Boas práticas que podem ser replicadas]
COMO RESOLVER: [Estratégias práticas para melhorar e replicar sucessos]
ACOMPANHAMENTO: [Como medir se as melhorias estão acontecendo]`,

      action: `FORMATO DE SAÍDA CLARA:
RESUMO: [A ação recomendada, impacto esperado e urgência]
QUEM DEVE SER CONTATADO: [Pessoas específicas que devem ser envolvidas e por quê]
COMO FAZER: [Passos práticos para implementar, com prazos e recursos necessários]
POSSÍVEIS DIFICULDADES: [O que pode dar errado e como evitar]
COMO SABER SE FUNCIONOU: [Como medir se a ação foi eficaz]
PRÓXIMOS PASSOS: [O que fazer depois e como manter a melhoria]`
    };

    return formats[queryType] || formats.analysis;
  }

  formatIntelligentContext(intelligentContext) {
    if (!intelligentContext) return "Nenhum dado contextual disponível.";

    const { executiveSummary, statisticalProfile, trendAnalysis, keyInsights, benchmarkComparison, rawData } = intelligentContext;

    // Calculate record validity metrics
    const totalRecords = rawData?.length || statisticalProfile?.population?.total || 0;
    const validRecords = rawData ? rawData.filter(r => {
      // A record is considered valid if it has at least name or basic identifying info
      return r && (r.name || r.id || r.whatsapp);
    }).length : totalRecords;
    const recordsWithSurvey = rawData ? rawData.filter(r => r.survey).length : 0;
    const recordsWithContact = rawData ? rawData.filter(r => r.whatsappSentAt).length : 0;
    const recordsWithClick = rawData ? rawData.filter(r => r.clickedAt).length : 0;

    let contextString = `CONTEXTO DE INTELIGÊNCIA DE DADOS MUNICIPAIS:

VISÃO GERAL EXECUTIVA:
${executiveSummary}

CONTAGENS DE REGISTROS (IMPORTANTE PARA PERGUNTAS ESTATÍSTICAS):
• Total de Registros no Banco: ${totalRecords}
• Registros Válidos (com nome, ID ou WhatsApp): ${validRecords}
• Registros que Responderam à Pesquisa: ${recordsWithSurvey}
• Registros que Receberam Mensagem WhatsApp: ${recordsWithContact}
• Registros que Clicaram no Link: ${recordsWithClick}
• Registros Pendentes (sem resposta): ${totalRecords - recordsWithSurvey}

DADOS PRINCIPAIS:
• População: ${statisticalProfile.population.total} cidadãos no total
• Taxa de Resposta: ${statisticalProfile.population.responseRate}% (qualidade dos dados: ${statisticalProfile.satisfaction.reliability})
• Engajamento: ${statisticalProfile.population.engagementRate}% dos cidadãos (comparado com ${benchmarkComparison.engagement.benchmark}% que seria típico)
• Satisfação Média: ${statisticalProfile.satisfaction.averageScore}/5 (margem de erro: ±${statisticalProfile.satisfaction.confidenceInterval.marginOfError})

COMPARAÇÃO COM O ESPERADO:
• Satisfação: ${benchmarkComparison.satisfaction.current}/5 vs ${benchmarkComparison.satisfaction.benchmark}/5 esperado (${benchmarkComparison.satisfaction.performance})
• Taxa de Resposta: ${benchmarkComparison.responseRate.current}% vs ${benchmarkComparison.responseRate.benchmark}% esperado (${benchmarkComparison.responseRate.performance})
• Engajamento: ${benchmarkComparison.engagement.current}% vs ${benchmarkComparison.engagement.benchmark}% esperado (${benchmarkComparison.engagement.performance})

SITUAÇÃO DOS BAIRROS:
• Total de Bairros: ${statisticalProfile.geographic.totalNeighborhoods}
• Diferença entre Bairros: ${statisticalProfile.geographic.equityGap} pontos (nível de preocupação: ${trendAnalysis.geographic.riskLevel})
• Melhores Resultados: ${statisticalProfile.geographic.topPerformers.map(([name, data]) => `${name} (${data.performanceScore}%)`).join(', ')}
• Precisam de Atenção: ${statisticalProfile.geographic.needsAttention.map(([name, data]) => `${name} (${data.performanceScore}%)`).join(', ')}

INSIGHTS CRÍTICOS:
${keyInsights.filter(insight => insight.urgency === 'immediate' || insight.urgency === 'high').map(insight =>
  `• ${insight.insight} (prioridade ${insight.urgency})`
).join('\n')}

MATRIZ DE PRIORIDADE DE QUESTÕES:
${statisticalProfile.issues.breakdown.slice(0, 3).map(issue =>
  `• ${issue.issue}: ${issue.count} relatórios, severidade ${issue.avgSeverity}/5, pontuação de prioridade ${issue.priorityScore}`
).join('\n')}`;

    return contextString;
  }

  getQuerySpecificInstructions(queryAnalysis) {
    const instructions = {
      listing: `REQUISITOS DE ANÁLISE ESPECÍFICOS:
- Forneça nomes reais e pontos de dados específicos do banco de dados municipal
- Inclua status de resposta, níveis de satisfação e métricas de engajamento para cada item
- Agrupe/categorize itens por critérios relevantes (bairro, nível de satisfação, status de resposta)
- Destaque itens que requerem atenção imediata ou acompanhamento
- Sugira estratégias de divulgação específicas para cada categoria`,

      insights: `REQUISITOS DE ANÁLISE ESPECÍFICOS:
- Identifique padrões nos dados que podem não ser óbvios
- Explique o que cada padrão significa na prática para a gestão
- Conecte os insights a ações concretas que podem ser tomadas
- Indique se os dados são suficientes para confiar nas conclusões
- Compare com o que é típico quando isso ajuda a entender a situação`,

      analysis: `REQUISITOS DE ANÁLISE ESPECÍFICOS:
- Realize análise multidimensional conectando dados de satisfação, engajamento e geográficos
- Inclua análise de tendências e elementos preditivos onde estatisticamente válido
- Identifique tanto oportunidades de intervenção imediatas quanto áreas de melhoria estratégica
- Avalie requisitos de recursos e viabilidade de implementação para recomendações
- Forneça framework abrangente de medição de sucesso

INSTRUÇÕES ESPECIAIS PARA PERGUNTAS ESTATÍSTICAS/DIRETAS:
- Se a pergunta pede números, contagens, totais ou estatísticas específicas, RESPONDA DIRETAMENTE COM O NÚMERO
- Use os dados exatos fornecidos acima, não faça estimativas ou aproximações
- Comece a resposta com o número solicitado de forma clara e direta
- Depois, forneça contexto adicional se relevante
- Exemplos de perguntas que precisam resposta direta:
  * "Quantos registros válidos existem?" → Responda: "Existem X registros válidos no banco de dados."
  * "Quantos cidadãos responderam?" → Responda: "Y cidadãos responderam à pesquisa."
  * "Qual o total de cadastros?" → Responda: "O total de cadastros é Z."
- Seja preciso e direto: primeiro o número, depois o contexto`,

      comparison: `REQUISITOS DE ANÁLISE ESPECÍFICOS:
- Destaque diferenças importantes encontradas nos dados
- Explique o que essas diferenças significam na prática
- Identifique o que está funcionando bem e pode ser replicado
- Avalie por que há essas diferenças de desempenho
- Sugira ações práticas para melhorar e reduzir desigualdades`,

      action: `REQUISITOS DE ANÁLISE ESPECÍFICOS:
- Identifique grupos-alvo específicos com informações de contato e justificativa
- Projete estratégia de mensagem com seleção de canal e otimização de timing
- Inclua previsão de engajamento e taxas de resposta esperadas
- Forneça cronograma de implementação com requisitos de recursos
- Projete framework de medição para rastrear eficácia da ação`
    };

    return instructions[queryAnalysis.queryType] || instructions.analysis;
  }

  /**
   * Build follow-up prompts for multi-turn reasoning
   */
  buildFollowUpPrompt(originalQuery, initialResponse, specificFocus) {
    return `REQUISIÇÃO DE INTELIGÊNCIA DE ACOMPANHAMENTO:

Consulta Original: "${originalQuery}"
Análise Inicial Concluída: ${new Date().toISOString()}

FOCO DE APROFUNDAMENTO: ${specificFocus}

Com base na análise inicial, forneça inteligência adicional sobre:

1. ANÁLISE DE CAUSA RAIZ: Quais fatores subjacentes estão impulsionando os padrões identificados?
2. DETALHES DE IMPLEMENTAÇÃO: Passos específicos, cronogramas e requisitos de recursos para as principais recomendações
3. AVALIAÇÃO DE RISCOS: O que pode dar errado com as intervenções propostas e como mitigar riscos?
4. PREVISÃO DE SUCESSO: Projeções estatísticas para melhoria sob diferentes cenários
5. INTEGRAÇÃO DE SISTEMA: Como as mudanças recomendadas interagem com processos municipais existentes?

Forneça inteligência mais profunda que se baseie nas descobertas iniciais com profundidade analítica aprimorada.`;
  }

  /**
   * Validate LLM response quality
   */
  validateResponseQuality(response, intelligentContext) {
    const quality = {
      score: 0,
      issues: [],
      strengths: []
    };

    // Check for data grounding
    if (this.containsSpecificNumbers(response, intelligentContext)) {
      quality.score += 25;
      quality.strengths.push('Contains specific data points');
    } else {
      quality.issues.push('Missing specific data references');
    }

    // Check for actionable recommendations
    if (this.containsActionableRecommendations(response)) {
      quality.score += 25;
      quality.strengths.push('Includes actionable recommendations');
    } else {
      quality.issues.push('Lacks specific actionable recommendations');
    }

    // Check for statistical confidence
    if (this.containsStatisticalContext(response)) {
      quality.score += 20;
      quality.strengths.push('Includes statistical context');
    } else {
      quality.issues.push('Missing statistical confidence information');
    }

    // Check for structured format
    if (this.followsStructuredFormat(response)) {
      quality.score += 20;
      quality.strengths.push('Follows structured format');
    } else {
      quality.issues.push('Does not follow requested structure');
    }

    // Check for municipal expertise
    if (this.demonstratesMunicipalExpertise(response)) {
      quality.score += 10;
      quality.strengths.push('Demonstrates municipal domain knowledge');
    } else {
      quality.issues.push('Generic response lacking municipal expertise');
    }

    quality.level = quality.score >= 80 ? 'excellent' : 
                   quality.score >= 60 ? 'good' : 
                   quality.score >= 40 ? 'fair' : 'poor';

    return quality;
  }

  containsSpecificNumbers(response, context) {
    if (!context || !context.statisticalProfile) return false;
    
    const keyNumbers = [
      context.statisticalProfile.population.total,
      context.statisticalProfile.population.responseRate,
      context.statisticalProfile.satisfaction.averageScore
    ];

    return keyNumbers.some(num => response.includes(String(num)));
  }

  containsActionableRecommendations(response) {
    const actionWords = ['implement', 'establish', 'contact', 'develop', 'create', 'schedule', 'organize'];
    const timeWords = ['immediate', 'within', 'days', 'weeks', 'months', 'timeline'];
    
    return actionWords.some(word => response.toLowerCase().includes(word)) &&
           timeWords.some(word => response.toLowerCase().includes(word));
  }

  containsStatisticalContext(response) {
    const statWords = ['confidence', 'significance', 'sample', 'reliability', 'margin', '%', 'interval'];
    return statWords.some(word => response.toLowerCase().includes(word));
  }

  followsStructuredFormat(response) {
    const structureWords = ['summary', 'analysis', 'recommendations', 'metrics', 'findings'];
    return structureWords.filter(word => response.toLowerCase().includes(word)).length >= 3;
  }

  demonstratesMunicipalExpertise(response) {
    const municipalTerms = ['municipal', 'citizen', 'civic', 'community', 'service delivery', 'governance'];
    return municipalTerms.filter(term => response.toLowerCase().includes(term)).length >= 2;
  }
}

module.exports = MunicipalPromptEngine;