/**
 * SendWhatsAppMessageUseCase - Application Use Case
 * Handles sending WhatsApp messages to citizens
 * Single Responsibility: Orchestrate WhatsApp messaging workflow
 */
export class SendWhatsAppMessageUseCase {
  constructor(citizenRepository) {
    this.repository = citizenRepository;
  }

  async execute(citizenId) {
    try {
      // Get citizen
      const citizen = await this.repository.findById(citizenId);

      if (!citizen) {
        return {
          success: false,
          error: 'Cidadão não encontrado'
        };
      }

      if (!citizen.contactInfo.hasWhatsApp()) {
        return {
          success: false,
          error: 'Cidadão não possui WhatsApp cadastrado'
        };
      }

      // Generate WhatsApp link
      const phone = citizen.contactInfo.getCleanedPhone();
      const name = citizen.personalInfo.name;
      const neighborhood = citizen.personalInfo.neighborhood || 'seu bairro';

      const message = this.generateOutreachMessage(name, neighborhood);
      const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

      // Mark as sent in repository
      await this.repository.markAsSent(citizenId);

      return {
        success: true,
        whatsappUrl,
        citizen: {
          id: citizen.id,
          name: citizen.personalInfo.name,
          phone: citizen.contactInfo.getFormattedPhone()
        }
      };
    } catch (error) {
      console.error('[SendWhatsAppMessageUseCase] Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  generateOutreachMessage(name, neighborhood) {
    const base = typeof window !== 'undefined' && window.APP_BASE_URL
      ? window.APP_BASE_URL
      : (typeof window !== 'undefined' ? window.location.origin : '');

    return `Olá, ${name}! Agradecemos a sua participação em nosso evento!\n
    Essa é uma pesquisa rápida para sabermos mais sobre o seu bairro (${neighborhood}), leva apenas 1 minuto!.\n
    Atenciosamente, Luana e Marion.`;
  }
}
