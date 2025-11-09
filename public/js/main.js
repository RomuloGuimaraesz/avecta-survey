/**
 * Main - Composition Root (Dependency Injection)
 * Wires all dependencies following Dependency Inversion Principle
 * This is the only place where concrete implementations are instantiated
 */

// Web Components (register first)
import { registerAllComponents } from './web-components/index.js';

// Domain
import { CitizenFilterService } from './domain/services/CitizenFilterService.js';
import { StatisticsService } from './domain/services/StatisticsService.js';

// Application
import { LoadCitizensUseCase } from './application/usecases/LoadCitizensUseCase.js';
import { SendWhatsAppMessageUseCase } from './application/usecases/SendWhatsAppMessageUseCase.js';
import { ExportCitizensUseCase } from './application/usecases/ExportCitizensUseCase.js';
import { ProcessAIQueryUseCase } from './application/usecases/ProcessAIQueryUseCase.js';
import { UpdateCitizenUseCase } from './application/usecases/UpdateCitizenUseCase.js';
import { DeleteCitizenUseCase } from './application/usecases/DeleteCitizenUseCase.js';

// Infrastructure
import { ApiClient } from './infrastructure/api/ApiClient.js';
import { HttpCitizenRepository } from './infrastructure/repositories/HttpCitizenRepository.js';
import { AIAssistantService } from './infrastructure/services/AIAssistantService.js';

// Presentation
import { StatisticsPanel } from './presentation/components/StatisticsPanel.js';
import { CitizenTable } from './presentation/components/CitizenTable.js';
import { CitizenDetailsPanel } from './presentation/components/CitizenDetailsPanel.js';
import { AdminViewModel } from './presentation/viewmodels/AdminViewModel.js';

// Shared
import { columnDefinitions } from './shared/utils/columnDefinitions.js';

/**
 * Application Bootstrap
 */
class Application {
  constructor() {
    this.dependencies = {};
  }

  async initialize() {
    console.log('[Application] Initializing...');

    try {
      // 0. Register Web Components first
      registerAllComponents();

      // 1. Infrastructure Layer
      this.setupInfrastructure();

      // 2. Domain Services
      this.setupDomainServices();

      // 3. Application Use Cases
      this.setupUseCases();

      // 4. Presentation Components
      this.setupPresentationComponents();

      // 5. View Model
      this.setupViewModel();

      // 6. Configuration
      await this.loadConfiguration();

      // 7. Global exposure (for compatibility with existing inline handlers)
      this.exposeGlobals();

      console.log('[Application] Initialization complete');
    } catch (error) {
      console.error('[Application] Initialization failed:', error);
      this.showFatalError(error);
    }
  }

  setupInfrastructure() {
    // API Client
    const baseUrl = window.APP_BASE_URL || '';
    this.dependencies.apiClient = new ApiClient(baseUrl);

    // Repositories
    this.dependencies.citizenRepository = new HttpCitizenRepository(
      this.dependencies.apiClient
    );

    // Services
    this.dependencies.aiAssistantService = new AIAssistantService(
      this.dependencies.apiClient
    );
  }

  setupDomainServices() {
    this.dependencies.filterService = new CitizenFilterService();
    this.dependencies.statisticsService = new StatisticsService();
  }

  setupUseCases() {
    this.dependencies.loadCitizensUseCase = new LoadCitizensUseCase(
      this.dependencies.citizenRepository,
      this.dependencies.filterService,
      this.dependencies.statisticsService
    );

    this.dependencies.sendWhatsAppUseCase = new SendWhatsAppMessageUseCase(
      this.dependencies.citizenRepository
    );

    this.dependencies.exportCitizensUseCase = new ExportCitizensUseCase(
      this.dependencies.citizenRepository
    );

    this.dependencies.processAIQueryUseCase = new ProcessAIQueryUseCase(
      this.dependencies.aiAssistantService
    );

    this.dependencies.updateCitizenUseCase = new UpdateCitizenUseCase(
      this.dependencies.citizenRepository
    );

    this.dependencies.deleteCitizenUseCase = new DeleteCitizenUseCase(
      this.dependencies.citizenRepository
    );
  }

  setupPresentationComponents() {
    // Toast Manager (already exists in page)
    this.dependencies.toastManager = window.toastManager;

    // Statistics Panel (using web component)
    this.dependencies.statisticsPanel = new StatisticsPanel('#quick-stats');

    // Details Panel (will be created after table for dependency)
    this.dependencies.detailsPanel = new CitizenDetailsPanel(
      'slidePanel',
      'slidePanelOverlay',
      this.dependencies.toastManager
    );

    // Citizen Table
    this.dependencies.citizenTable = new CitizenTable(
      'newContactsTable',
      columnDefinitions,
      (citizen) => this.dependencies.detailsPanel.open(citizen)
    );

    // AI Chat Widget (Web Component)
    // Get the web component instance and inject dependencies
    this.dependencies.chatWidget = document.getElementById('aiChat');
    if (this.dependencies.chatWidget) {
      this.dependencies.chatWidget.setDependencies(
        this.dependencies.processAIQueryUseCase,
        this.dependencies.toastManager
      );
    }
  }

  setupViewModel() {
    // Set update and delete use cases in details panel
    this.dependencies.detailsPanel.setUpdateCitizenUseCase(
      this.dependencies.updateCitizenUseCase
    );
    this.dependencies.detailsPanel.setDeleteCitizenUseCase(
      this.dependencies.deleteCitizenUseCase
    );

    this.dependencies.adminViewModel = new AdminViewModel({
      loadCitizensUseCase: this.dependencies.loadCitizensUseCase,
      sendWhatsAppUseCase: this.dependencies.sendWhatsAppUseCase,
      exportCitizensUseCase: this.dependencies.exportCitizensUseCase,
      statisticsPanel: this.dependencies.statisticsPanel,
      citizenTable: this.dependencies.citizenTable,
      detailsPanel: this.dependencies.detailsPanel,
      toastManager: this.dependencies.toastManager
    });
  }

  async loadConfiguration() {
    try {
      const config = await this.dependencies.apiClient.get('/api/config');
      if (config?.baseUrl) {
        window.APP_BASE_URL = config.baseUrl;
      }

    } catch (error) {
      console.warn('[Application] Failed to load configuration:', error);
    }

    // Load system health
    if (this.dependencies.chatWidget) {
      await this.dependencies.chatWidget.loadSystemHealth();
    }
  }


  exposeGlobals() {
    // Expose for compatibility with inline HTML handlers
    window.adminViewModel = this.dependencies.adminViewModel;
    window.detailsPanel = this.dependencies.detailsPanel;
    window.chatWidget = this.dependencies.chatWidget;
    window.citizenTable = this.dependencies.citizenTable;

    // Global helper functions
    window.closeCitizenPanel = () => this.dependencies.detailsPanel.close();
    window.openCitizenPanel = (citizen) => this.dependencies.detailsPanel.open(citizen);
    window.openCitizenPanelById = (id) => {
      const citizen = this.dependencies.adminViewModel.getCitizen(id);
      if (citizen) {
        this.dependencies.detailsPanel.open(citizen);
      }
    };
    window.switchColumn = (direction) => this.dependencies.citizenTable.switchColumn(direction);

    // Global function for AI Chat quick suggestions (backwards compatibility)
    window.sendQuickMessage = (message) => {
      const chatWidget = document.getElementById('aiChat');
      if (chatWidget) {
        if (!chatWidget.isOpen) {
          chatWidget.openChat();
        }
        chatWidget.sendMessage(message);
      }
    };
  }

  showFatalError(error) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#ff4444;color:white;padding:20px;border-radius:8px;z-index:10000;';
    errorDiv.innerHTML = `
      <h3>Erro Fatal</h3>
      <p>Falha ao inicializar a aplicação: ${error.message}</p>
      <button onclick="location.reload()">Recarregar Página</button>
    `;
    document.body.appendChild(errorDiv);
  }
}

// Initialize application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const app = new Application();
    app.initialize();
  });
} else {
  const app = new Application();
  app.initialize();
}

// Show notification after 5 seconds
setTimeout(() => {
  if (window.chatWidget && !window.chatWidget.isOpen) {
    window.chatWidget.showNotification();
  }
}, 5000);
