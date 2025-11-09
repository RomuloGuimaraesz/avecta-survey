/**
 * UpdateCitizenUseCase - Application Use Case
 * Handles updating citizen information
 * Single Responsibility: Orchestrate citizen update workflow
 */
import { Citizen } from '../../domain/entities/Citizen.js';

export class UpdateCitizenUseCase {
  constructor(citizenRepository) {
    this.repository = citizenRepository;
  }

  async execute(citizenId, updateData) {
    try {
      // Get existing citizen
      const citizen = await this.repository.findById(citizenId);

      if (!citizen) {
        return {
          success: false,
          error: 'Cidadão não encontrado'
        };
      }

      // Validate update data
      const validationError = this.validateUpdateData(updateData);
      if (validationError) {
        return {
          success: false,
          error: validationError
        };
      }

      // Convert to raw data for easier manipulation
      const rawData = citizen.toRawData();

      // Update fields if provided
      if (updateData.name !== undefined) {
        rawData.name = updateData.name;
      }

      if (updateData.age !== undefined) {
        rawData.age = updateData.age;
      }

      if (updateData.neighborhood !== undefined) {
        rawData.neighborhood = updateData.neighborhood;
      }

      if (updateData.whatsapp !== undefined) {
        rawData.whatsapp = updateData.whatsapp;
      }

      // Update timestamp
      rawData.updatedAt = new Date().toISOString();

      // Create updated citizen from raw data
      const updatedCitizen = Citizen.fromRawData(rawData);

      // Save to repository
      const savedCitizen = await this.repository.save(updatedCitizen);

      return {
        success: true,
        citizen: savedCitizen
      };
    } catch (error) {
      console.error('[UpdateCitizenUseCase] Error:', error);
      return {
        success: false,
        error: error.message || 'Falha ao atualizar cidadão'
      };
    }
  }

  validateUpdateData(updateData) {
    if (updateData.name !== undefined && (!updateData.name || updateData.name.trim().length === 0)) {
      return 'Nome não pode estar vazio';
    }

    if (updateData.age !== undefined && (isNaN(updateData.age) || updateData.age < 0)) {
      return 'Idade deve ser um número positivo válido';
    }

    return null;
  }
}

