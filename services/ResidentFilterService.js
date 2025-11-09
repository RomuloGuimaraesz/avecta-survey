// services/ResidentFilterService.js - Centralized resident filtering logic
// Single source of truth for filtering contacts by various criteria

class ResidentFilterService {
  constructor() {
    this.name = 'Resident Filter Service';
  }

  /**
   * Filter residents based on query criteria
   * @param {Array} contacts - Raw contact data
   * @param {Object} criteria - Filter criteria (type, query normalization)
   * @returns {Array} Filtered and formatted residents
   */
  filterResidents(contacts, criteria) {
    if (!Array.isArray(contacts) || contacts.length === 0) {
      return [];
    }

    const { type, queryNormalized, query } = criteria;

    switch (type) {
      case 'name_search':
        return this.filterByName(contacts, query || '');
      
      case 'dissatisfied':
        return this.filterDissatisfied(contacts);
      
      case 'satisfied':
        return this.filterSatisfied(contacts);
      
      case 'participation_interested':
        return this.filterParticipationInterested(contacts);
      
      case 'participation_not_interested':
        return this.filterParticipationNotInterested(contacts);
      
      case 'all_with_survey':
        return this.filterAllWithSurvey(contacts);
      
      default:
        return [];
    }
  }

  /**
   * Filter residents by name (fuzzy search)
   * @param {Array} contacts - Raw contact data
   * @param {string} query - Original query
   * @returns {Array} Matching residents
   */
  filterByName(contacts, query) {
    const normalize = (s) => (s || '').toString().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    const extractedName = this.extractNameFromQuery(query);
    
    if (!extractedName) {
      return [];
    }
    
    const searchName = normalize(extractedName);
    const searchWords = searchName.split(/\s+/).filter(w => w.length > 0);
    
    if (searchWords.length === 0) {
      return [];
    }
    
    // Fuzzy match: find contacts where name contains any of the search words
    const matches = contacts.filter(contact => {
      if (!contact.name) return false;
      
      const contactName = normalize(contact.name);
      
      // Exact match or all words match
      if (contactName.includes(searchName)) {
        return true;
      }
      
      // Check if all search words are present in the contact name
      return searchWords.every(word => contactName.includes(word));
    });
    
    // Format results
    return matches.map(contact => ({
      name: contact.name,
      age: contact.age,
      neighborhood: contact.neighborhood,
      whatsapp: contact.whatsapp,
      satisfaction: contact.survey?.satisfaction || null,
      issue: contact.survey?.issue || null,
      participate: contact.survey?.participate || null,
      answeredAt: contact.survey?.answeredAt || null,
      whatsappSentAt: contact.whatsappSentAt || null,
      clickedAt: contact.clickedAt || null,
      id: contact.id,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt
    }));
  }

  /**
   * Determine filter type from query
   * @param {string} query - User query
   * @returns {string} Filter type or null
   */
  determineFilterType(query) {
    const normalize = (s) => (s || '').toString().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    const qn = normalize(query);

    // CRITICAL: Check for participation filter queries BEFORE name search
    // to prevent "Mostrar moradores que não querem participar" from being treated as name search
    if (
      qn.includes('particip') &&
      (qn.includes('nao') || qn.includes('não') || qn.includes('not') || qn.includes('sem interesse') || 
       qn.includes('nao interessados') || qn.includes('nao querem participar') || 
       qn.includes('nao participaria') || qn.includes('não querem participar') ||
       qn.includes('não quer participar') || qn.includes('não participaria'))
    ) {
      return 'participation_not_interested';
    }
    
    if (
      (qn.includes('particip') || qn.includes('interested') || qn.includes('interessad') || qn.includes('event')) &&
      !(qn.includes('nao') || qn.includes('não') || qn.includes('not') || qn.includes('sem interesse') || qn.includes('nao interessados'))
    ) {
      return 'participation_interested';
    }

    // Check for name search queries (after filter queries)
    if (this.isNameSearchQuery(query)) {
      return 'name_search';
    }

    if (
      qn.includes('dissatisfied') ||
      qn.includes('unsatisfied') ||
      qn.includes('insatisfied') ||
      qn.includes('unhappy') ||
      qn.includes('insatisf') ||
      qn.includes('insatisfeito') ||
      qn.includes('insatisfeitos')
    ) {
      return 'dissatisfied';
    }

    if (
      (qn.includes('satisfied') || qn.includes('satisfeito') || qn.includes('satisfeitos')) &&
      !(
        qn.includes('dissatisfied') ||
        qn.includes('unsatisfied') ||
        qn.includes('insatisfied') ||
        qn.includes('unhappy') ||
        qn.includes('insatisfeito') ||
        qn.includes('insatisfeitos')
      )
    ) {
      return 'satisfied';
    }


    if (
      qn.includes('list') || qn.includes('show') || qn.includes('names') || 
      qn.includes('listar') || qn.includes('mostre') || qn.includes('mostrar') || 
      qn.includes('exibir')
    ) {
      return 'all_with_survey';
    }

    return null;
  }

  /**
   * Check if query is a name search query
   * @param {string} query - User query
   * @returns {boolean}
   */
  isNameSearchQuery(query) {
    const normalize = (s) => (s || '').toString().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    const qn = normalize(query);
    
    // CRITICAL: Exclude analysis/report queries from name search detection
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
    
    // If query contains analysis keywords, it's NOT a name search
    if (analysisKeywords.some(kw => qn.includes(kw))) {
      return false;
    }
    
    const searchVerbs = [
      'encontre', 'encontrar', 'encontra', 'busque', 'buscar', 'busca',
      'find', 'search', 'procure', 'procurar', 'procura',
      'mostre', 'mostrar', 'mostra', 'show', 'exiba', 'exibir',
      'traga', 'trazer', 'quem e', 'quem eh', 'quem e o', 'quem eh o'
    ];
    
    // Check if query contains search verbs
    const hasSearchVerb = searchVerbs.some(verb => qn.includes(verb));
    
    // Extract potential name from query (remove common words AND analysis terms)
    const commonWords = [
      'o', 'a', 'os', 'as', 'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 
      'the', 'a', 'an', 'me', 'meu', 'minha', 'meus', 'minhas',
      'um', 'uma', 'uns', 'umas', 'que', 'qual', 'quais'
    ];
    const words = query.split(/\s+/).filter(w => {
      const normalized = normalize(w);
      return !commonWords.includes(normalized) && 
             !searchVerbs.includes(normalized) &&
             !analysisKeywords.some(kw => normalized.includes(kw) || kw.includes(normalized));
    });
    
    // If we have a search verb and at least 1-2 words that look like a name (capitalized or not)
    if (hasSearchVerb && words.length >= 1) {
      // Check if remaining words look like names (at least 2 characters, contains letters)
      const nameLikeWords = words.filter(w => w.length >= 2 && /[a-záàâãéèêíìîóòôõúùûç]/i.test(w));
      return nameLikeWords.length >= 1;
    }
    
    return false;
  }

  /**
   * Extract name from query for searching
   * @param {string} query - User query
   * @returns {string|null} Extracted name or null
   */
  extractNameFromQuery(query) {
    const normalize = (s) => (s || '').toString().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    const qn = normalize(query);
    
    // CRITICAL: Exclude analysis/report queries - don't extract names from analysis queries
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
    
    if (analysisKeywords.some(kw => qn.includes(kw))) {
      return null; // This is an analysis query, not a name search
    }
    
    const searchVerbs = [
      'encontre', 'encontrar', 'encontra', 'busque', 'buscar', 'busca',
      'find', 'search', 'procure', 'procurar', 'procura',
      'mostre', 'mostrar', 'mostra', 'show', 'exiba', 'exibir',
      'traga', 'trazer', 'quem e', 'quem eh', 'quem e o', 'quem eh o'
    ];
    
    const commonWords = [
      'o', 'a', 'os', 'as', 'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 
      'the', 'a', 'an', 'me', 'meu', 'minha', 'meus', 'minhas',
      'um', 'uma', 'uns', 'umas', 'que', 'qual', 'quais'
    ];
    
    // Remove search verbs and common words
    let cleaned = query;
    searchVerbs.forEach(verb => {
      const regex = new RegExp(verb, 'gi');
      cleaned = cleaned.replace(regex, '');
    });
    
    const words = cleaned.split(/\s+/)
      .map(w => w.trim())
      .filter(w => {
        const normalized = normalize(w);
        return w.length > 0 && 
               !commonWords.includes(normalized) && 
               !analysisKeywords.some(kw => normalized.includes(kw) || kw.includes(normalized)) &&
               w.length >= 2 && 
               /[a-záàâãéèêíìîóòôõúùûç]/i.test(w);
      });
    
    if (words.length > 0) {
      // Join words to form potential name
      return words.join(' ').trim();
    }
    
    return null;
  }

  /**
   * Filter dissatisfied residents
   */
  filterDissatisfied(contacts) {
    return contacts
      .filter(contact => 
        contact.survey && 
        ['Muito insatisfeito', 'Insatisfeito'].includes(contact.survey.satisfaction)
      )
      .map(contact => ({
        name: contact.name,
        neighborhood: contact.neighborhood,
        whatsapp: contact.whatsapp,
        satisfaction: contact.survey.satisfaction,
        issue: contact.survey.issue,
        priority: contact.survey.satisfaction === 'Muito insatisfeito' ? 'HIGH' : 'MEDIUM',
        participateInterest: contact.survey.participate
      }));
  }

  /**
   * Filter satisfied residents
   */
  filterSatisfied(contacts) {
    return contacts
      .filter(contact => 
        contact.survey && 
        ['Muito satisfeito', 'Satisfeito'].includes(contact.survey.satisfaction)
      )
      .map(contact => ({
        name: contact.name,
        neighborhood: contact.neighborhood,
        whatsapp: contact.whatsapp,
        satisfaction: contact.survey.satisfaction,
        issue: contact.survey.issue,
        priority: contact.survey.satisfaction === 'Muito satisfeito' ? 'ADVOCATE' : 'POSITIVE',
        participateInterest: contact.survey.participate
      }));
  }

  /**
   * Filter residents interested in participation
   */
  filterParticipationInterested(contacts) {
    return contacts
      .filter(contact => contact.survey && contact.survey.participate === 'Sim')
      .map(contact => ({
        name: contact.name,
        neighborhood: contact.neighborhood,
        whatsapp: contact.whatsapp,
        satisfaction: contact.survey.satisfaction,
        issue: contact.survey.issue,
        participateInterest: contact.survey.participate,
        priority: 'ENGAGED'
      }));
  }

  /**
   * Filter residents not interested in participation
   */
  filterParticipationNotInterested(contacts) {
    return contacts
      .filter(contact => {
        const p = contact?.survey?.participate;
        if (!p) return false;
        const normalized = p.toString().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
        return contact.survey && (normalized === 'nao' || normalized === 'no');
      })
      .map(contact => ({
        name: contact.name,
        neighborhood: contact.neighborhood,
        whatsapp: contact.whatsapp,
        satisfaction: contact.survey.satisfaction,
        issue: contact.survey.issue,
        participateInterest: contact.survey.participate,
        priority: 'NOT_WILLING'
      }));
  }

  /**
   * Filter all residents with survey responses
   */
  filterAllWithSurvey(contacts) {
    return contacts
      .filter(contact => contact.survey)
      .map(contact => ({
        name: contact.name,
        neighborhood: contact.neighborhood,
        whatsapp: contact.whatsapp,
        satisfaction: contact.survey.satisfaction,
        issue: contact.survey.issue,
        participateInterest: contact.survey.participate,
        responded: true
      }));
  }
}

module.exports = ResidentFilterService;

