/**
 * SurveyResponse - Value Object (DDD)
 * Immutable representation of a citizen's survey response
 */
import { SatisfactionLevel, CivicIssueType, ParticipationIntent } from '../../shared/constants.js';

export class SurveyResponse {
  constructor(
    civicIssue,
    satisfactionLevel,
    participationIntent,
    answeredAt,
    otherIssueDetails = null,
    cep = null,
    complemento = null
  ) {
    this._civicIssue = civicIssue;
    this._satisfactionLevel = satisfactionLevel;
    this._participationIntent = participationIntent;
    this._answeredAt = answeredAt;
    this._otherIssueDetails = otherIssueDetails;
    this._cep = cep;
    this._complemento = complemento;

    Object.freeze(this);
  }

  get civicIssue() {
    return this._civicIssue;
  }

  get satisfactionLevel() {
    return this._satisfactionLevel;
  }

  get participationIntent() {
    return this._participationIntent;
  }

  get answeredAt() {
    return this._answeredAt;
  }

  get otherIssueDetails() {
    return this._otherIssueDetails;
  }

  get cep() {
    return this._cep;
  }

  get complemento() {
    return this._complemento;
  }

  isSatisfied() {
    return this._satisfactionLevel === SatisfactionLevel.SATISFIED ||
           this._satisfactionLevel === SatisfactionLevel.VERY_SATISFIED;
  }

  isDissatisfied() {
    return this._satisfactionLevel === SatisfactionLevel.DISSATISFIED ||
           this._satisfactionLevel === SatisfactionLevel.VERY_DISSATISFIED;
  }

  isWillingToParticipate() {
    return this._participationIntent === ParticipationIntent.YES;
  }

  getSatisfactionRating() {
    const ratingMap = {
      [SatisfactionLevel.VERY_SATISFIED]: 5,
      [SatisfactionLevel.SATISFIED]: 4,
      [SatisfactionLevel.NEUTRAL]: 3,
      [SatisfactionLevel.DISSATISFIED]: 2,
      [SatisfactionLevel.VERY_DISSATISFIED]: 1
    };
    return ratingMap[this._satisfactionLevel] || 0;
  }

  equals(other) {
    if (!(other instanceof SurveyResponse)) return false;
    return this._civicIssue === other._civicIssue &&
           this._satisfactionLevel === other._satisfactionLevel &&
           this._participationIntent === other._participationIntent;
  }
}
