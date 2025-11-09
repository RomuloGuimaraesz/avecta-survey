/**
 * CitizenDetailsPanel - Presentation Component
 * Slide-up panel showing detailed citizen information
 * Single Responsibility: Render citizen details panel
 */
import { DateFormatter } from '../formatters/DateFormatter.js';

export class CitizenDetailsPanel {
  constructor(panelSelector, overlaySelector, toastManager) {
    this.panel = document.getElementById(panelSelector);
    this.overlay = document.getElementById(overlaySelector);
    this.toastManager = toastManager;
    this.currentCitizen = null;
    this.isEditing = false;
    this.updateCitizenUseCase = null;
    this.deleteCitizenUseCase = null;
    this.copyLinkMessage = '';
    this.copyLinkMessageType = null;
    this.pendingDeleteCitizenId = null;
    this.deleteConfirmOverlay = null;
    this.confirmDeleteButton = null;
    this.cancelDeleteButton = null;
    this.deleteConfirmMessageElement = null;

    this.initializeElements();
    this.attachEventListeners();
  }

  setUpdateCitizenUseCase(updateCitizenUseCase) {
    this.updateCitizenUseCase = updateCitizenUseCase;
  }

  setDeleteCitizenUseCase(deleteCitizenUseCase) {
    this.deleteCitizenUseCase = deleteCitizenUseCase;
  }

  initializeElements() {
    this.nameElement = document.getElementById('citizenName');
    this.detailsElement = document.getElementById('citizenDetails');
    this.deleteConfirmOverlay = document.getElementById('deleteConfirmOverlay');
    this.confirmDeleteButton = document.getElementById('confirmDeleteButton');
    this.cancelDeleteButton = document.getElementById('cancelDeleteButton');
    this.deleteConfirmMessageElement = document.getElementById('deleteConfirmMessage');

    if (this.confirmDeleteButton && !this.confirmDeleteButton.dataset.defaultText) {
      this.confirmDeleteButton.dataset.defaultText = this.confirmDeleteButton.textContent.trim();
    }

    if (this.cancelDeleteButton && !this.cancelDeleteButton.dataset.defaultText) {
      this.cancelDeleteButton.dataset.defaultText = this.cancelDeleteButton.textContent.trim();
    }
  }

  attachEventListeners() {
    if (this.overlay) {
      this.overlay.addEventListener('click', () => this.close());
    }

    if (this.deleteConfirmOverlay) {
      this.deleteConfirmOverlay.addEventListener('click', (event) => {
        if (event.target === this.deleteConfirmOverlay) {
          this.closeDeleteConfirmation();
        }
      });
    }

    if (this.cancelDeleteButton) {
      this.cancelDeleteButton.addEventListener('click', () => this.closeDeleteConfirmation());
    }

    if (this.confirmDeleteButton) {
      this.confirmDeleteButton.addEventListener('click', () => this.handleDeleteConfirmation());
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.isDeleteConfirmationOpen()) {
          this.closeDeleteConfirmation();
          return;
        }
        this.close();
      }
    });
  }

  open(citizen) {
    this.currentCitizen = citizen;
    this.copyLinkMessage = '';
    this.copyLinkMessageType = null;

    if (this.nameElement) {
      this.nameElement.textContent = citizen.name || 'Cidadão';
    }

    if (this.detailsElement) {
      this.detailsElement.innerHTML = this.generateDetailsHTML(citizen);
      this.updateCopyFeedback();
    }

    if (this.overlay) {
      this.overlay.classList.add('active');
    }
    if (this.panel) {
      this.panel.classList.add('active');
    }

    document.body.style.overflow = 'hidden';
  }

  close() {
    if (this.overlay) {
      this.overlay.classList.remove('active');
    }
    if (this.panel) {
      this.panel.classList.remove('active');
    }

    this.closeDeleteConfirmation();
    document.body.style.overflow = '';
    this.currentCitizen = null;
  }

  isDeleteConfirmationOpen() {
    if (!this.deleteConfirmOverlay) {
      return false;
    }
    return !this.deleteConfirmOverlay.hasAttribute('hidden');
  }

  openDeleteConfirmation(citizenId) {
    this.pendingDeleteCitizenId = citizenId;

    if (!this.deleteConfirmOverlay) {
      this.performCitizenDeletion(citizenId);
      return;
    }

    if (this.deleteConfirmMessageElement) {
      const citizenName = this.currentCitizen?.name;
      if (citizenName) {
        this.deleteConfirmMessageElement.textContent = `Tem certeza que deseja excluir o contato "${citizenName}"? Esta ação não pode ser desfeita.`;
      } else {
        this.deleteConfirmMessageElement.textContent = 'Tem certeza que deseja excluir este contato? Esta ação não pode ser desfeita.';
      }
    }

    this.deleteConfirmOverlay.removeAttribute('hidden');

    window.requestAnimationFrame(() => {
      if (this.confirmDeleteButton) {
        this.confirmDeleteButton.focus({ preventScroll: true });
      }
    });
  }

  closeDeleteConfirmation() {
    if (!this.deleteConfirmOverlay || this.deleteConfirmOverlay.hasAttribute('hidden')) {
      this.pendingDeleteCitizenId = null;
      this.setDeleteConfirmationLoading(false);
      return;
    }

    this.deleteConfirmOverlay.setAttribute('hidden', '');
    this.setDeleteConfirmationLoading(false);
    this.pendingDeleteCitizenId = null;
  }

  setDeleteConfirmationLoading(isLoading) {
    if (this.confirmDeleteButton) {
      const defaultText = this.confirmDeleteButton.dataset.defaultText || this.confirmDeleteButton.textContent.trim();

      if (isLoading) {
        this.confirmDeleteButton.textContent = 'Excluindo...';
        this.confirmDeleteButton.classList.add('is-loading');
      } else {
        this.confirmDeleteButton.textContent = defaultText;
        this.confirmDeleteButton.classList.remove('is-loading');
      }

      this.confirmDeleteButton.disabled = isLoading;
    }

    if (this.cancelDeleteButton) {
      this.cancelDeleteButton.disabled = isLoading;
    }
  }

  async handleDeleteConfirmation() {
    const citizenId = this.pendingDeleteCitizenId;

    if (!citizenId) {
      this.closeDeleteConfirmation();
      return;
    }

    this.setDeleteConfirmationLoading(true);

    try {
      await this.performCitizenDeletion(citizenId);
    } finally {
      this.setDeleteConfirmationLoading(false);
      this.closeDeleteConfirmation();
    }
  }

  generateDetailsHTML(citizen) {
    return `
      <div class="citizen-detail-grid">
        ${this.renderPersonalInfo(citizen)}
        ${this.renderContactInfo(citizen)}
        ${this.renderEngagementHistory(citizen)}
        ${this.renderSystemData(citizen)}
      </div>

      ${citizen.survey ? this.renderSurveyResponse(citizen.survey) : this.renderNoSurvey()}

      ${this.renderActionButtons(citizen)}
    `;
  }

  renderPersonalInfo(citizen) {
    if (this.isEditing) {
      return `
        <div class="detail-card">
          <h3>Informações Pessoais</h3>
          <div class="detail-field detail-field-editing">
            <span class="detail-label">Nome Completo</span>
            <input type="text" 
                   id="edit-name" 
                   class="detail-input" 
                   value="${citizen.name || ''}" 
                   placeholder="Nome completo">
          </div>
          <div class="detail-field detail-field-editing">
            <span class="detail-label">Idade</span>
            <input type="number" 
                   id="edit-age" 
                   class="detail-input" 
                   value="${citizen.age || ''}" 
                   placeholder="Idade" 
                   min="0">
          </div>
          <div class="detail-field detail-field-editing">
            <span class="detail-label">Bairro</span>
            <input type="text" 
                   id="edit-neighborhood" 
                   class="detail-input" 
                   value="${citizen.neighborhood || ''}" 
                   placeholder="Bairro">
          </div>
          <div class="detail-field">
            <span class="detail-label">Complemento</span>
            <span class="detail-value">${(citizen.survey && citizen.survey.complemento) || '—'}</span>
          </div>
        </div>
      `;
    }
    
    return `
      <div class="detail-card">
        <h3>Informações Pessoais</h3>
        <div class="detail-field">
          <span class="detail-label">Nome Completo</span>
          <span class="detail-value">${citizen.name || '—'}</span>
        </div>
        <div class="detail-field">
          <span class="detail-label">Idade</span>
          <span class="detail-value">${citizen.age || '—'} ${citizen.age ? 'anos' : ''}</span>
        </div>
        <div class="detail-field">
          <span class="detail-label">Bairro</span>
          <span class="detail-value">${citizen.neighborhood || '—'}</span>
        </div>
        <div class="detail-field">
          <span class="detail-label">Complemento</span>
          <span class="detail-value">${(citizen.survey && citizen.survey.complemento) || '—'}</span>
        </div>
      </div>
    `;
  }

  renderContactInfo(citizen) {
    if (this.isEditing) {
      return `
        <div class="detail-card">
          <h3>Contato</h3>
          <div class="detail-field detail-field-editing">
            <span class="detail-label">WhatsApp</span>
            <input type="text" 
                   id="edit-whatsapp" 
                   class="detail-input" 
                   value="${citizen.whatsapp || ''}" 
                   placeholder="11999999999">
            <small class="detail-hint">Formato: 11999999999</small>
          </div>
          <div class="detail-field">
            <span class="detail-label">Status de Envio</span>
            <span class="detail-value">
              ${citizen.whatsappSentAt
                ? `<span class="status-badge status-sent">Enviado em ${DateFormatter.formatDateTime(citizen.whatsappSentAt)}</span>`
                : '<span class="status-badge status-pending">Não enviado</span>'
              }
            </span>
          </div>
          <div class="detail-field">
            <span class="detail-label">Status WhatsApp</span>
            <span class="detail-value">
              ${citizen.whatsappStatus
                ? `<span class="status-badge status-${citizen.whatsappStatus}">${citizen.whatsappStatus}</span>`
                : '—'
              }
            </span>
          </div>
        </div>
      `;
    }
    
    return `
      <div class="detail-card">
        <h3>Contato</h3>
        <div class="detail-field">
          <span class="detail-label">WhatsApp</span>
          <span class="detail-value">${citizen.formattedPhone || '—'}</span>
        </div>
        <div class="detail-field">
          <span class="detail-label">Status de Envio</span>
          <span class="detail-value">
            ${citizen.whatsappSentAt
              ? `<span class="status-badge status-sent">Enviado em ${DateFormatter.formatDateTime(citizen.whatsappSentAt)}</span>`
              : '<span class="status-badge status-pending">Não enviado</span>'
            }
          </span>
        </div>
        <div class="detail-field">
          <span class="detail-label">Status WhatsApp</span>
          <span class="detail-value">
            ${citizen.whatsappStatus
              ? `<span class="status-badge status-${citizen.whatsappStatus}">${citizen.whatsappStatus}</span>`
              : '—'
            }
          </span>
        </div>
      </div>
    `;
  }

  renderEngagementHistory(citizen) {
    return `
      <div class="detail-card">
        <h3>Histórico de Interação</h3>
        <div class="detail-field">
          <span class="detail-label">Link Clicado</span>
          <span class="detail-value">
            ${citizen.clickedAt
              ? `✅ ${DateFormatter.formatDateTime(citizen.clickedAt)}`
              : '<span class="status-badge status-pending">Não clicou</span>'
            }
          </span>
        </div>
        <div class="detail-field">
          <span class="detail-label">Pesquisa Respondida</span>
          <span class="detail-value">
            ${citizen.hasResponded
              ? `✅ ${DateFormatter.formatDateTime(citizen.survey.answeredAt)}`
              : '<span class="status-badge status-pending">Não respondeu</span>'
            }
          </span>
        </div>
      </div>
    `;
  }

  renderSystemData(citizen) {
    return `
      <div class="detail-card">
        <h3>Dados do Sistema</h3>
        <div class="detail-field">
          <span class="detail-label">ID do Contato</span>
          <span class="detail-value">#${citizen.id}</span>
        </div>
        <div class="detail-field">
          <span class="detail-label">Criado em</span>
          <span class="detail-value">${DateFormatter.formatDateTime(citizen.createdAt)}</span>
        </div>
        <div class="detail-field">
          <span class="detail-label">Última Atualização</span>
          <span class="detail-value">${DateFormatter.formatDateTime(citizen.updatedAt)}</span>
        </div>
      </div>
    `;
  }

  renderSurveyResponse(survey) {
    return `
      <div class="survey-response">
        <h4>Resposta da Pesquisa</h4>

        <div class="detail-field">
          <span class="detail-label">Satisfação</span>
          <span class="detail-value">${survey.satisfaction || '—'}</span>
        </div>

        <div class="detail-field">
          <span class="detail-label">Problema principal</span>
          <span class="detail-value">${survey.issue || '—'}</span>
        </div>

        ${survey.otherIssueDetails ? `
          <div class="detail-field">
            <span class="detail-label">Detalhe do problema</span>
            <span class="detail-value">${survey.otherIssueDetails}</span>
          </div>
        ` : ''}

        <div class="detail-field">
          <span class="detail-label">Interessado em participar</span>
          <span class="detail-value">${survey.participate || '—'}</span>
        </div>

        <div class="detail-field">
          <span class="detail-label">Respondido em</span>
          <span class="detail-value">${DateFormatter.formatDateTime(survey.answeredAt)}</span>
        </div>
      </div>
    `;
  }

  renderNoSurvey() {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">📝</div>
        <h3>Nenhuma resposta de pesquisa</h3>
        <p>Este cidadão ainda não respondeu à pesquisa de satisfação.</p>
      </div>
    `;
  }

  renderActionButtons(citizen) {
    if (this.isEditing) {
      return `
        <div class="action-buttons">
          <button class="panel-action-button secondary" onclick="window.detailsPanel.cancelEdit()">
            Cancelar
          </button>
          <button class="panel-action-button" onclick="window.detailsPanel.saveEdit()">
            Salvar Alterações
          </button>
        </div>
      `;
    }
    
    return `
      <div class="action-buttons">
        <button class="panel-action-button secondary" onclick="window.detailsPanel.startEdit()">
          Editar
        </button>
        <button class="panel-action-button secondary" onclick="window.detailsPanel.openWhatsApp(${citizen.id})">
          Abrir no WhatsApp
        </button>
        <button class="panel-action-button" onclick="window.detailsPanel.copySurveyLink(${citizen.id})">
          Copiar Link
        </button>
        <button class="panel-action-button danger" onclick="window.detailsPanel.deleteCitizen(${citizen.id})">
          Excluir
        </button>
      </div>
      <p class="${this.getCopyFeedbackClasses()}" data-copy-feedback role="status" aria-live="polite">
        ${this.copyLinkMessage || ''}
      </p>
    `;
  }

  async openWhatsApp(citizenId) {
    // This will be handled by the view model
    if (window.adminViewModel) {
      await window.adminViewModel.openWhatsApp(citizenId);
    }
  }

  async copySurveyLink(citizenId) {
    if (!window.adminViewModel) {
      this.setCopyFeedback('Não foi possível copiar o link.', 'error');
      return;
    }

    try {
      const result = await window.adminViewModel.copySurveyLink(citizenId);

      if (result?.success) {
        this.setCopyFeedback('Link copiado.', 'success');
      } else {
        const message = result?.errorMessage || 'Não foi possível copiar o link automaticamente.';
        this.setCopyFeedback(message, 'error');
      }
    } catch (error) {
      console.error('[CitizenDetailsPanel] copySurveyLink error:', error);
      this.setCopyFeedback('Erro ao copiar o link.', 'error');
    }
  }

  setCopyFeedback(message, type = 'success') {
    this.copyLinkMessage = message || '';
    this.copyLinkMessageType = this.copyLinkMessage ? type : null;
    this.updateCopyFeedback();
  }

  getCopyFeedbackClasses() {
    const baseClass = 'copy-link-feedback';

    if (!this.copyLinkMessage) {
      return baseClass;
    }

    const typeClass = this.copyLinkMessageType === 'error' ? ' is-error' : ' is-success';
    return `${baseClass} is-visible${typeClass}`;
  }

  updateCopyFeedback() {
    if (!this.panel) {
      return;
    }

    const feedbackElement = this.panel.querySelector('[data-copy-feedback]');
    if (!feedbackElement) {
      return;
    }

    feedbackElement.textContent = this.copyLinkMessage || '';
    feedbackElement.className = this.getCopyFeedbackClasses();
  }

  startEdit() {
    this.isEditing = true;
    this.copyLinkMessage = '';
    this.copyLinkMessageType = null;
    if (this.currentCitizen && this.detailsElement) {
      this.detailsElement.innerHTML = this.generateDetailsHTML(this.currentCitizen);
      this.updateCopyFeedback();
    }
  }

  cancelEdit() {
    this.isEditing = false;
    this.copyLinkMessage = '';
    this.copyLinkMessageType = null;
    if (this.currentCitizen && this.detailsElement) {
      this.detailsElement.innerHTML = this.generateDetailsHTML(this.currentCitizen);
      this.updateCopyFeedback();
    }
  }

  async saveEdit() {
    if (!this.currentCitizen || !this.updateCitizenUseCase) {
      this.toastManager?.error('Não foi possível salvar as alterações', { title: 'Erro' });
      return;
    }

    // Get values from input fields
    const nameInput = document.getElementById('edit-name');
    const ageInput = document.getElementById('edit-age');
    const neighborhoodInput = document.getElementById('edit-neighborhood');
    const whatsappInput = document.getElementById('edit-whatsapp');

    if (!nameInput || !ageInput || !neighborhoodInput || !whatsappInput) {
      this.toastManager?.error('Erro ao ler os campos', { title: 'Erro' });
      return;
    }

    const updateData = {
      name: nameInput.value.trim(),
      age: ageInput.value ? Number(ageInput.value) : undefined,
      neighborhood: neighborhoodInput.value.trim(),
      whatsapp: whatsappInput.value.trim()
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined || updateData[key] === '') {
        delete updateData[key];
      }
    });

    // Show loading toast
    const loadingToast = this.toastManager?.info('Salvando alterações...', {
      title: 'Processando',
      progress: true,
      duration: 10000
    });

    try {
      const result = await this.updateCitizenUseCase.execute(this.currentCitizen.id, updateData);

      if (loadingToast) this.toastManager.remove(loadingToast);

      if (result.success) {
        this.toastManager?.success('Alterações salvas com sucesso!', { title: 'Sucesso' });
        
        // Convert Citizen entity to DTO format for the panel
        const { CitizenDTO } = await import('../../application/dto/CitizenDTO.js');
        const updatedDto = new CitizenDTO(result.citizen);
        
        // Update current citizen with new data
        this.currentCitizen = updatedDto;
        
        // Exit edit mode
        this.isEditing = false;
        this.copyLinkMessage = '';
        this.copyLinkMessageType = null;
        
        // Re-render panel
        if (this.detailsElement) {
          this.detailsElement.innerHTML = this.generateDetailsHTML(this.currentCitizen);
          this.updateCopyFeedback();
        }
        
        // Update name in header
        if (this.nameElement) {
          this.nameElement.textContent = this.currentCitizen.name || 'Cidadão';
        }

        // Refresh the table if available
        if (window.adminViewModel) {
          await window.adminViewModel.refresh();
        }
      } else {
        this.toastManager?.error(result.error || 'Erro ao salvar alterações', { title: 'Erro' });
      }
    } catch (error) {
      if (loadingToast) this.toastManager.remove(loadingToast);
      this.toastManager?.error('Erro ao processar solicitação', { title: 'Erro' });
      console.error('[CitizenDetailsPanel] saveEdit error:', error);
    }
  }

  async deleteCitizen(citizenId) {
    if (!this.deleteCitizenUseCase) {
      this.toastManager?.error('Não foi possível excluir o contato', { title: 'Erro' });
      return;
    }

    this.openDeleteConfirmation(citizenId);
  }

  async performCitizenDeletion(citizenId) {
    const loadingToast = this.toastManager?.info('Excluindo contato...', {
      title: 'Processando',
      progress: true,
      duration: 10000
    });

    try {
      const result = await this.deleteCitizenUseCase.execute(citizenId);

      if (loadingToast) this.toastManager.remove(loadingToast);

      if (result.success) {
        this.toastManager?.success('Contato excluído com sucesso!', { title: 'Sucesso' });

        // Close panel
        this.close();

        // Refresh the table if available
        if (window.adminViewModel) {
          await window.adminViewModel.refresh();
        }
      } else {
        this.toastManager?.error(result.error || 'Erro ao excluir contato', { title: 'Erro' });
      }
    } catch (error) {
      if (loadingToast) this.toastManager.remove(loadingToast);
      this.toastManager?.error('Erro ao processar solicitação', { title: 'Erro' });
      console.error('[CitizenDetailsPanel] deleteCitizen error:', error);
    }
    this.pendingDeleteCitizenId = null;
  }
}
