/**
 * Shared Constants - Ubiquitous Language
 * Defines core domain terminology for the Municipal Civic Engagement system
 */

export const EngagementStatus = Object.freeze({
  NOT_SENT: 'not_sent',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  CLICKED: 'clicked',
  RESPONDED: 'responded'
});

export const SatisfactionLevel = Object.freeze({
  VERY_SATISFIED: 'Muito satisfeito',
  SATISFIED: 'Satisfeito',
  NEUTRAL: 'Neutro',
  DISSATISFIED: 'Insatisfeito',
  VERY_DISSATISFIED: 'Muito insatisfeito'
});

export const ParticipationIntent = Object.freeze({
  YES: 'Sim',
  NO: 'Não',
  MAYBE: 'Talvez'
});

export const WhatsAppProvider = Object.freeze({
  META: 'meta',
  TWILIO: 'twilio',
  MOCK: 'mock'
});

export const CivicIssueType = Object.freeze({
  SECURITY: 'Segurança',
  TRANSPORT: 'Transporte',
  HEALTH: 'Saúde',
  EDUCATION: 'Educação',
  INFRASTRUCTURE: 'Infraestrutura',
  ENVIRONMENT: 'Meio Ambiente',
  OTHER: 'Outro'
});

export const TableColumns = Object.freeze({
  AGE: 'age',
  NEIGHBORHOOD: 'neighborhood',
  WHATSAPP: 'whatsapp',
  SENT_AT: 'whatsappSentAt',
  STATUS: 'whatsappStatus',
  CLICKED_AT: 'clickedAt',
  SURVEY: 'survey'
});

export const ApiEndpoints = Object.freeze({
  CONTACTS: '/api/contacts',
  EXPORT: '/api/export',
  HEALTH: '/api/health',
  CONFIG: '/api/config',
  AGENT_UI: '/api/admin/agent-ui',
  MARK_SENT: (id) => `/api/contacts/${id}/mark-sent`
});

export const DateFormat = Object.freeze({
  LOCALE: 'pt-BR',
  SHORT_DATE: { dateStyle: 'short' },
  LONG_DATE: { dateStyle: 'long' },
  FULL_DATETIME: { dateStyle: 'long', timeStyle: 'short' }
});
