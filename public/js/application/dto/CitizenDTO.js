/**
 * CitizenDTO - Data Transfer Object
 * Simplified representation for UI consumption
 */
export class CitizenDTO {
  constructor(citizen) {
    this.id = citizen.id;
    this.name = citizen.personalInfo.name;
    this.age = citizen.personalInfo.age;
    this.neighborhood = citizen.personalInfo.neighborhood;
    this.whatsapp = citizen.contactInfo.whatsapp;
    this.formattedPhone = citizen.contactInfo.getFormattedPhone();
    this.cleanedPhone = citizen.contactInfo.getCleanedPhone();

    this.whatsappSentAt = citizen.engagementHistory.whatsappSentAt;
    this.whatsappStatus = citizen.engagementHistory.whatsappStatus;
    this.clickedAt = citizen.engagementHistory.clickedAt;

    this.hasResponded = citizen.hasResponded();
    this.isEngaged = citizen.isEngaged();
    this.wasContacted = citizen.wasContacted();
    this.engagementStatus = citizen.getEngagementStatus();

    if (citizen.surveyResponse) {
      this.survey = {
        issue: citizen.surveyResponse.civicIssue,
        satisfaction: citizen.surveyResponse.satisfactionLevel,
        participate: citizen.surveyResponse.participationIntent,
        answeredAt: citizen.surveyResponse.answeredAt,
        otherIssueDetails: citizen.surveyResponse.otherIssueDetails,
        cep: citizen.surveyResponse.cep,
        complemento: citizen.surveyResponse.complemento
      };
    } else {
      this.survey = null;
    }

    this.createdAt = citizen.metadata.createdAt;
    this.updatedAt = citizen.metadata.updatedAt;
  }

  static fromCitizenList(citizens) {
    return citizens.map(citizen => new CitizenDTO(citizen));
  }
}
