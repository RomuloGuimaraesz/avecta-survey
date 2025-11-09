/**
 * AdminViewModel - Presentation Layer
 * Coordinates UI components and application use cases
 * Single Responsibility: Manage admin page state and user interactions
 */
import { FilterCriteriaDTO } from '../../application/dto/FilterCriteriaDTO.js';

export class AdminViewModel {
  constructor(dependencies) {
    this.loadCitizensUseCase = dependencies.loadCitizensUseCase;
    this.sendWhatsAppUseCase = dependencies.sendWhatsAppUseCase;
    this.exportCitizensUseCase = dependencies.exportCitizensUseCase;

    this.statisticsPanel = dependencies.statisticsPanel;
    this.citizenTable = dependencies.citizenTable;
    this.detailsPanel = dependencies.detailsPanel;
    this.toastManager = dependencies.toastManager;

    this.currentCitizens = [];
    this.currentFilterCriteria = FilterCriteriaDTO.empty();

    this.initializeUI();
  }

  initializeUI() {
    this.attachFilterListeners();
    this.attachActionListeners();
    this.loadInitialData();
  }

  attachFilterListeners() {
    const btnFilter = document.getElementById('btnFilter');
    btnFilter?.addEventListener('click', () => this.applyFilters());
  }

  attachActionListeners() {
    const btnExport = document.getElementById('btnExport');
    btnExport?.addEventListener('click', () => this.exportData());

    const toggleActions = document.getElementById('toggleActions');
    const actionsBar = document.getElementById('actionsBar');

    toggleActions?.addEventListener('click', (e) => {
      e.preventDefault();
      const willOpen = !actionsBar.classList.contains('open');
      actionsBar.classList.toggle('open', willOpen);
      toggleActions.textContent = willOpen ? 'Ocultar ações' : 'Mostrar ações';
      toggleActions.setAttribute('aria-expanded', String(willOpen));
    });
  }

  async loadInitialData() {
    await this.loadCitizens(FilterCriteriaDTO.empty());
  }

  async applyFilters() {
    const neighborhood = document.getElementById('filterNeighborhood')?.value || '';
    const answered = document.getElementById('filterAnswered')?.value || '';

    this.currentFilterCriteria = FilterCriteriaDTO.fromFormData({
      neighborhood,
      answered
    });

    await this.loadCitizens(this.currentFilterCriteria);
  }

  async loadCitizens(filterCriteria) {
    try {
      const result = await this.loadCitizensUseCase.execute(filterCriteria);

      if (result.success) {
        this.currentCitizens = result.citizens;

        // Update UI components
        this.citizenTable.render(result.citizens);
        this.statisticsPanel.render(result.statistics);

        return result;
      } else {
        this.toastManager?.error(result.error || 'Falha ao carregar cidadãos', {
          title: 'Erro'
        });
        return null;
      }
    } catch (error) {
      console.error('[AdminViewModel] loadCitizens error:', error);
      this.toastManager?.error('Erro ao carregar dados', { title: 'Erro' });
      return null;
    }
  }

  async refresh() {
    await this.loadCitizens(this.currentFilterCriteria);
  }

  openCitizenDetails(citizen) {
    this.detailsPanel.open(citizen);
  }

  async openWhatsApp(citizenId) {
    const loadingToast = this.toastManager?.info('Abrindo WhatsApp...', {
      title: 'Processando',
      progress: true,
      duration: 8000
    });

    try {
      const result = await this.sendWhatsAppUseCase.execute(citizenId);

      if (result.success) {
        // Open WhatsApp
        window.open(result.whatsappUrl, '_blank');

        if (loadingToast) this.toastManager.remove(loadingToast);
        this.toastManager?.success('Marcado como enviado.', { title: 'Concluído' });

        // Refresh data
        await this.refresh();
      } else {
        if (loadingToast) this.toastManager.remove(loadingToast);
        this.toastManager?.error(result.error || 'Erro ao enviar mensagem', {
          title: 'Erro'
        });
      }
    } catch (error) {
      if (loadingToast) this.toastManager.remove(loadingToast);
      this.toastManager?.error('Erro ao processar solicitação', { title: 'Erro' });
    }
  }

  async copySurveyLink(citizenId) {
    const citizen = this.currentCitizens.find(c => c.id === citizenId);

    if (!citizen) {
      return {
        success: false,
        errorMessage: 'Cidadão não encontrado.'
      };
    }

    const base = window.APP_BASE_URL || window.location.origin;
    const surveyLink = `${base}/survey.html?id=${citizen.id}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(surveyLink);
        return { success: true };
      } catch {
        return this.fallbackCopy(surveyLink);
      }
    }

    return this.fallbackCopy(surveyLink);
  }

  fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();

    let success = false;

    try {
      success = document.execCommand('copy');
    } catch {
      success = false;
    } finally {
      document.body.removeChild(ta);
    }

    if (success) {
      return { success: true };
    }

    return {
      success: false,
      errorMessage: 'Não foi possível copiar automaticamente. Copie manualmente: ' + text
    };
  }

  async exportData() {
    try {
      const result = await this.exportCitizensUseCase.execute();

      if (result.success) {
        this.toastManager?.success('Exportação iniciada', { title: 'Sucesso' });
      } else {
        this.toastManager?.error(result.error || 'Erro ao exportar', { title: 'Erro' });
      }
    } catch (error) {
      this.toastManager?.error('Erro ao exportar dados', { title: 'Erro' });
    }
  }

  getCitizen(citizenId) {
    return this.currentCitizens.find(c => c.id === citizenId);
  }
}
