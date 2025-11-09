/**
 * Citizen - Aggregate Root (DDD)
 * Core domain entity representing a citizen in the municipal engagement system
 */
import { PersonalInfo } from './PersonalInfo.js';
import { ContactInfo } from './ContactInfo.js';
import { SurveyResponse } from './SurveyResponse.js';
import { EngagementHistory } from './EngagementHistory.js';

export class Citizen {
  constructor(id, personalInfo, contactInfo, engagementHistory, surveyResponse = null, metadata = {}) {
    if (!id) throw new Error('Citizen ID is required');
    if (!(personalInfo instanceof PersonalInfo)) {
      throw new Error('personalInfo must be an instance of PersonalInfo');
    }
    if (!(contactInfo instanceof ContactInfo)) {
      throw new Error('contactInfo must be an instance of ContactInfo');
    }
    if (!(engagementHistory instanceof EngagementHistory)) {
      throw new Error('engagementHistory must be an instance of EngagementHistory');
    }
    if (surveyResponse !== null && !(surveyResponse instanceof SurveyResponse)) {
      throw new Error('surveyResponse must be an instance of SurveyResponse or null');
    }

    this._id = id;
    this._personalInfo = personalInfo;
    this._contactInfo = contactInfo;
    this._engagementHistory = engagementHistory;
    this._surveyResponse = surveyResponse;
    this._metadata = {
      createdAt: metadata.createdAt || null,
      updatedAt: metadata.updatedAt || null
    };
  }

  get id() {
    return this._id;
  }

  get personalInfo() {
    return this._personalInfo;
  }

  get contactInfo() {
    return this._contactInfo;
  }

  get engagementHistory() {
    return this._engagementHistory;
  }

  get surveyResponse() {
    return this._surveyResponse;
  }

  get metadata() {
    return this._metadata;
  }

  // Business Logic Methods

  hasResponded() {
    return this._surveyResponse !== null;
  }

  isEngaged() {
    return this._engagementHistory.hasClicked();
  }

  wasContacted() {
    return this._engagementHistory.wasMessageSent();
  }

  getSatisfactionLevel() {
    return this._surveyResponse?.satisfactionLevel || null;
  }

  getCivicIssue() {
    return this._surveyResponse?.civicIssue || null;
  }

  isWillingToParticipate() {
    return this._surveyResponse?.isWillingToParticipate() || false;
  }

  getEngagementStatus() {
    if (this.hasResponded()) return 'responded';
    if (this.isEngaged()) return 'clicked';
    if (this._engagementHistory.isDelivered()) return 'delivered';
    if (this.wasContacted()) return 'sent';
    return 'not_sent';
  }

  isPending() {
    return !this.hasResponded();
  }

  // Factory method to create from raw data
  static fromRawData(data) {
    const personalInfo = new PersonalInfo(
      data.name,
      data.age,
      data.neighborhood
    );

    const contactInfo = new ContactInfo(
      data.whatsapp,
      data.whatsappProvider
    );

    const engagementHistory = new EngagementHistory(
      data.whatsappSentAt,
      data.whatsappMessageId,
      data.whatsappStatus,
      data.whatsappStatusUpdatedAt,
      data.clickedAt
    );

    let surveyResponse = null;
    if (data.survey) {
      surveyResponse = new SurveyResponse(
        data.survey.issue,
        data.survey.satisfaction,
        data.survey.participate,
        data.survey.answeredAt,
        data.survey.otherIssue,
        data.survey.cep,
        data.survey.complemento
      );
    }

    const metadata = {
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    };

    return new Citizen(
      data.id,
      personalInfo,
      contactInfo,
      engagementHistory,
      surveyResponse,
      metadata
    );
  }

  // Convert back to raw data format (for API compatibility)
  toRawData() {
    return {
      id: this._id,
      name: this._personalInfo.name,
      age: this._personalInfo.age,
      neighborhood: this._personalInfo.neighborhood,
      whatsapp: this._contactInfo.whatsapp,
      whatsappProvider: this._contactInfo.provider,
      whatsappSentAt: this._engagementHistory.whatsappSentAt,
      whatsappMessageId: this._engagementHistory.whatsappMessageId,
      whatsappStatus: this._engagementHistory.whatsappStatus,
      whatsappStatusUpdatedAt: this._engagementHistory.whatsappStatusUpdatedAt,
      clickedAt: this._engagementHistory.clickedAt,
      survey: this._surveyResponse ? {
        issue: this._surveyResponse.civicIssue,
        satisfaction: this._surveyResponse.satisfactionLevel,
        participate: this._surveyResponse.participationIntent,
        answeredAt: this._surveyResponse.answeredAt,
        otherIssue: this._surveyResponse.otherIssueDetails,
        cep: this._surveyResponse.cep,
        complemento: this._surveyResponse.complemento
      } : null,
      createdAt: this._metadata.createdAt,
      updatedAt: this._metadata.updatedAt
    };
  }
}
