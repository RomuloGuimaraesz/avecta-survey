/**
 * Query Templates - Shared
 * Centralized definition of available query templates for the AI assistant
 * Single source of truth for quick suggestions and query handling
 */

/**
 * Query template definition
 * @typedef {Object} QueryTemplate
 * @property {string} key - Unique identifier for the template
 * @property {string} label - Display label for the button
 * @property {string} query - The actual query text to send
 * @property {string} [handler] - Optional special handler type (e.g., 'age_report')
 * @property {string} [category] - Optional category for grouping
 */

/**
 * Available query templates
 * @type {QueryTemplate[]}
 */
export const QUERY_TEMPLATES = [
  {
    key: 'satisfaction-analysis',
    label: 'Análise de Satisfação',
    query: 'Mostrar análise de satisfação',
    category: 'knowledge'
  },
  {
    key: 'dissatisfied-residents',
    label: 'Análise de Insatisfação',
    query: 'Encontrar moradores insatisfeitos',
    category: 'knowledge'
  },
  {
    key: 'neighborhoods-followup',
    label: 'Análise de Bairros',
    query: 'Quais bairros precisam de acompanhamento',
    category: 'knowledge'
  },
  {
    key: 'interested-participation',
    label: 'Participação: interessados',
    query: 'Listar moradores interessados em participar',
    category: 'notification'
  },
  {
    key: 'not-interested-participation',
    label: 'Participação: não interessados',
    query: 'Mostrar moradores que não querem participar',
    category: 'notification'
  },
  {
    key: 'age-satisfaction-report',
    label: 'Relatório: Satisfação por idade',
    query: 'Relatório: Satisfação por idade',
    handler: 'age_report',
    category: 'knowledge'
  }
];

/**
 * Get query template by key
 * @param {string} key - Template key
 * @returns {QueryTemplate|undefined}
 */
export function getQueryTemplate(key) {
  return QUERY_TEMPLATES.find(template => template.key === key);
}

/**
 * Get query template by query text
 * @param {string} query - Query text
 * @returns {QueryTemplate|undefined}
 */
export function getQueryTemplateByQuery(query) {
  return QUERY_TEMPLATES.find(template => template.query === query);
}

/**
 * Get all templates for a category
 * @param {string} category - Category name
 * @returns {QueryTemplate[]}
 */
export function getTemplatesByCategory(category) {
  return QUERY_TEMPLATES.filter(template => template.category === category);
}

/**
 * Get all template keys (for quick suggestions)
 * @returns {string[]}
 */
export function getAllTemplateKeys() {
  return QUERY_TEMPLATES.map(template => template.key);
}

/**
 * Check if a query has a special handler
 * @param {string} query - Query text
 * @returns {boolean}
 */
export function hasSpecialHandler(query) {
  const template = getQueryTemplateByQuery(query);
  return template && !!template.handler;
}

/**
 * Get special handler type for a query
 * @param {string} query - Query text
 * @returns {string|undefined}
 */
export function getSpecialHandler(query) {
  const template = getQueryTemplateByQuery(query);
  return template?.handler;
}


