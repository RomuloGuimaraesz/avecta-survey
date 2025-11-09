/**
 * ICitizenRepository - Repository Interface (DDD)
 * Defines the contract for citizen data access
 * Following Dependency Inversion Principle (SOLID)
 */
export class ICitizenRepository {
  /**
   * Find all citizens
   * @returns {Promise<Citizen[]>}
   */
  async findAll() {
    throw new Error('Method not implemented: findAll');
  }

  /**
   * Find citizen by ID
   * @param {number} id
   * @returns {Promise<Citizen|null>}
   */
  async findById(id) {
    throw new Error('Method not implemented: findById');
  }

  /**
   * Save a citizen (create or update)
   * @param {Citizen} citizen
   * @returns {Promise<Citizen>}
   */
  async save(citizen) {
    throw new Error('Method not implemented: save');
  }

  /**
   * Mark citizen as contacted
   * @param {number} id
   * @returns {Promise<boolean>}
   */
  async markAsSent(id) {
    throw new Error('Method not implemented: markAsSent');
  }

  /**
   * Export all citizens to CSV
   * @returns {Promise<Blob>}
   */
  async exportToCSV() {
    throw new Error('Method not implemented: exportToCSV');
  }

  /**
   * Delete a citizen by ID
   * @param {number} id
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    throw new Error('Method not implemented: delete');
  }
}
