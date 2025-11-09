/**
 * QueryProcessor - Infrastructure Service
 * Centralized query normalization and preprocessing
 * Single Responsibility: Query processing and validation
 */
import { getQueryTemplateByQuery, hasSpecialHandler, getSpecialHandler } from '../../shared/queryTemplates.js';

export class QueryProcessor {
  /**
   * Normalize a query string
   * @param {string} query - Raw query input
   * @returns {string} - Normalized query
   */
  normalize(query) {
    if (!query || typeof query !== 'string') {
      return '';
    }

    // Trim whitespace
    let normalized = query.trim();

    // Remove extra whitespace
    normalized = normalized.replace(/\s+/g, ' ');

    return normalized;
  }

  /**
   * Validate a query before processing
   * @param {string} query - Query to validate
   * @returns {{valid: boolean, error?: string}}
   */
  validate(query) {
    const normalized = this.normalize(query);

    if (!normalized || normalized.length === 0) {
      return {
        valid: false,
        error: 'Query cannot be empty'
      };
    }

    if (normalized.length > 500) {
      return {
        valid: false,
        error: 'Query is too long (max 500 characters)'
      };
    }

    return {
      valid: true
    };
  }

  /**
   * Process a query (normalize and validate)
   * @param {string} query - Raw query input
   * @returns {{query: string, normalized: string, hasSpecialHandler: boolean, handlerType?: string, error?: string}}
   */
  process(query) {
    const normalized = this.normalize(query);
    const validation = this.validate(normalized);

    if (!validation.valid) {
      return {
        query: query,
        normalized: normalized,
        hasSpecialHandler: false,
        error: validation.error
      };
    }

    // Check for special handlers
    const hasHandler = hasSpecialHandler(normalized);
    const handlerType = hasHandler ? getSpecialHandler(normalized) : undefined;

    return {
      query: query,
      normalized: normalized,
      hasSpecialHandler: hasHandler,
      handlerType: handlerType,
      error: undefined
    };
  }

  /**
   * Check if query should be processed as-is or needs special handling
   * @param {string} query - Query to check
   * @returns {boolean}
   */
  requiresSpecialHandling(query) {
    const processed = this.process(query);
    return processed.hasSpecialHandler;
  }

  /**
   * Get the handler type if query requires special handling
   * @param {string} query - Query to check
   * @returns {string|undefined}
   */
  getHandlerType(query) {
    const processed = this.process(query);
    return processed.handlerType;
  }
}


