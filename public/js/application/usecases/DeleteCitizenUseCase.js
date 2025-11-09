/**
 * DeleteCitizenUseCase - Application Use Case
 * Handles deleting a citizen
 * Single Responsibility: Orchestrate citizen deletion workflow
 */
export class DeleteCitizenUseCase {
  constructor(citizenRepository) {
    this.repository = citizenRepository;
  }

  async execute(citizenId) {
    try {
      // Verify citizen exists
      const citizen = await this.repository.findById(citizenId);

      if (!citizen) {
        return {
          success: false,
          error: 'Cidadão não encontrado'
        };
      }

      // Delete from repository
      await this.repository.delete(citizenId);

      return {
        success: true
      };
    } catch (error) {
      console.error('[DeleteCitizenUseCase] Error:', error);
      return {
        success: false,
        error: error.message || 'Falha ao deletar cidadão'
      };
    }
  }
}



