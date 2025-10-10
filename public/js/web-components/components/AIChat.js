/**
 * <ai-chat> Web Component
 * AI Assistant Chat Widget with full functionality
 */

import { ReactiveComponent } from '../base/ReactiveComponent.js';
import { EventEmitterMixin } from '../mixins/EventEmitterMixin.js';
import { html, css } from '../utils/html.js';

export class AIChat extends EventEmitterMixin(ReactiveComponent) {
  constructor() {
    super();

    // Define reactive properties (only those that should trigger re-render)
    this.defineProperty('isOpen', false, {
      type: 'boolean',
      reflect: true
    });

    this.defineProperty('showNotificationBadge', false, {
      type: 'boolean'
    });

    // Non-reactive messages array (we update DOM manually)
    this.messages = [];

    // Dependencies (to be injected)
    this.processAIQueryUseCase = null;
    this.toastManager = null;

    // Internal state
    this._initialMessageAdded = false;
  }

  static get observedAttributes() {
    return ['open'];
  }

  // ========== Dependency Injection ==========

  /**
   * Set dependencies (called from main.js)
   */
  setDependencies(processAIQueryUseCase, toastManager) {
    this.processAIQueryUseCase = processAIQueryUseCase;
    this.toastManager = toastManager;
  }

  // ========== Lifecycle ==========

  onConnect() {
    this.setupEventListeners();
    // Add initial message after first render
    this.updateComplete.then(() => {
      this.addInitialMessage();
    });
  }

  onAttributeChange(name, oldValue, newValue) {
    if (name === 'open') {
      this.isOpen = newValue !== null;
    }
  }

  setupEventListeners() {
    // No click-outside-to-close behavior
    // Chat only closes via X button or toggleChat()
  }

  // ========== Public API ==========

  /**
   * Toggle chat visibility
   */
  toggleChat() {
    this.isOpen ? this.closeChat() : this.openChat();
  }

  /**
   * Open chat
   */
  openChat() {
    this.isOpen = true;
    this.showNotificationBadge = false;
    this.emitEvent('chat-opened', {});

    // Focus input after render
    this.updateComplete.then(() => {
      const input = this.$('.chat-input');
      if (input) input.focus();
      this.scrollToBottom();
    });
  }

  /**
   * Close chat
   */
  closeChat() {
    this.isOpen = false;
    this.emitEvent('chat-closed', {});
  }

  /**
   * Show notification badge
   */
  showNotification() {
    if (!this.isOpen) {
      this.showNotificationBadge = true;
    }
  }

  /**
   * Hide notification badge
   */
  hideNotification() {
    this.showNotificationBadge = false;
  }

  /**
   * Send message
   */
  async sendMessage(messageText = null) {
    const input = this.$('.chat-input');
    const sendBtn = this.$('.send-button');
    const message = messageText || (input ? input.value.trim() : '');

    // Check if input is disabled (processing) or message is empty
    if (!message || (sendBtn && sendBtn.disabled)) return;

    // Add user message
    this.addMessage(message, 'user');

    // Clear input
    if (input) {
      input.value = '';
      this.autoResize(input);
    }

    // Process message
    await this.processMessage(message);
  }

  /**
   * Add message to chat
   */
  addMessage(content, sender, metadata = null) {
    const message = {
      content,
      sender,
      metadata,
      timestamp: Date.now()
    };

    // Add to messages array without triggering reactive update
    this.messages.push(message);

    // Manually append the message to DOM (avoids full re-render)
    this.appendMessageToDOM(message);

    this.updateComplete.then(() => this.scrollToBottom());
  }

  /**
   * Append single message to DOM without full re-render
   */
  appendMessageToDOM(msg) {
    const messagesContainer = this.$('.chat-messages');
    if (!messagesContainer) return;

    const messageEl = document.createElement('div');
    messageEl.className = `message ${msg.sender}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = msg.sender === 'user' ? '👤' : '🤖';

    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';

    if (msg.metadata && msg.metadata.agent) {
      const badge = document.createElement('div');
      badge.className = `agent-badge ${msg.metadata.agent.toLowerCase().replace(' ', '-')}`;
      badge.textContent = msg.metadata.agent;
      messageContent.appendChild(badge);
    }

    const contentDiv = document.createElement('div');
    contentDiv.innerHTML = this.formatMessageContent(msg.content);
    messageContent.appendChild(contentDiv);

    if (msg.metadata) {
      const metaDiv = document.createElement('div');
      metaDiv.className = 'response-metadata';
      metaDiv.innerHTML = this.formatMetadata(msg.metadata);
      messageContent.appendChild(metaDiv);
    }

    messageEl.appendChild(avatar);
    messageEl.appendChild(messageContent);
    messagesContainer.appendChild(messageEl);

    // Reattach event listeners for any new buttons in the message
    this.attachMessageEventListeners(messageEl);
  }

  /**
   * Attach event listeners to buttons within a message
   */
  attachMessageEventListeners(messageEl) {
    // Handle quick suggestion buttons
    const suggestions = messageEl.querySelectorAll('.quick-suggestion');
    suggestions.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const message = e.target.getAttribute('data-message');
        if (message) this.handleQuickSuggestion(message);
      });
    });

    // Handle age report button
    const openAgeReportBtn = messageEl.querySelector('[data-open-age-report]');
    if (openAgeReportBtn) {
      openAgeReportBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.open('age-satisfaction.html', '_blank');
      });
    }
  }

  /**
   * Process AI message
   */
  async processMessage(message) {
    if (!this.processAIQueryUseCase) {
      console.error('[AIChat] processAIQueryUseCase not set');
      this.addMessage('Erro: Serviço de IA não configurado', 'bot', {
        agent: 'System',
        timestamp: new Date().toISOString()
      });
      return;
    }

    this.showTypingIndicator();
    this.updateStatus('Processando consulta...');

    const startTime = Date.now();

    try {
      const result = await this.processAIQueryUseCase.execute(message);
      const processingTime = Date.now() - startTime;

      this.hideTypingIndicator();

      if (result.success) {
        this.renderSuccessResponse(result, message, processingTime);
      } else {
        this.addMessage(result.response || `Erro: ${result.error}`, 'bot', {
          agent: 'System',
          timestamp: new Date().toISOString()
        });
        this.updateStatus('Erro - Tente novamente');
      }

      // Note: Removed automatic refresh to prevent unnecessary reloads
      // Data refresh should be triggered only when needed (e.g., after actions that modify data)

    } catch (error) {
      console.error('[AIChat] Error:', error);
      this.hideTypingIndicator();
      this.addMessage(`Erro de conexão: ${error.message}`, 'bot', {
        agent: 'System',
        timestamp: new Date().toISOString()
      });
      this.updateStatus('Erro de Conexão');
    }
  }

  /**
   * Render success response from AI
   */
  renderSuccessResponse(result, query, processingTime) {
    const residents = Array.isArray(result.residents) ? result.residents : [];
    let summaryText = result.response || 'Query processed successfully';

    if (residents.length) {
      const list = residents.map((r, idx) =>
        `${idx + 1}. ${r.name} (${r.neighborhood || '—'})${r.satisfaction ? ` • ${r.satisfaction}` : ''}`
      ).join('\n');
      summaryText += `\n\nRESIDENTES (${residents.length}):\n${list}`;
    }

    const analysisPayload = {
      analysis: {
        summary: summaryText,
        residents,
        insights: Array.isArray(result.insights) ? result.insights : [],
        recommendations: Array.isArray(result.recommendations) ? result.recommendations : []
      }
    };

    // Store for report
    const rid = `r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    try {
      localStorage.setItem(`reportPayload:${rid}`, JSON.stringify({ query, result }));
    } catch (e) {
      console.warn('Failed to store report payload:', e);
    }

    // Add report link
    const base = window.APP_BASE_URL || window.location.origin;
    const linkHtml = `<div class="mt-10"><a href="${base}/report.html?rid=${encodeURIComponent(rid)}&q=${encodeURIComponent(query)}" target="_blank" class="link-primary bold">Abrir relatório completo ↗</a></div>`;
    analysisPayload.analysis.summary = (analysisPayload.analysis.summary || '') + `\n\n` + linkHtml;

    this.addMessage(analysisPayload, 'bot', {
      agent: result.intent ? `${result.intent.charAt(0).toUpperCase() + result.intent.slice(1)} Agent` : 'AI Assistant',
      intent: result.intent,
      timestamp: result.timestamp,
      confidence: result.confidence
    });

    this.updateStatus(`Agente ${result.intent ? result.intent.charAt(0).toUpperCase() + result.intent.slice(1) : 'IA'} Pronto`);
  }

  /**
   * Update status text without triggering re-render
   */
  updateStatus(statusText) {
    const statusEl = this.$('.chat-status');
    if (statusEl) {
      statusEl.textContent = statusText;
    }
  }

  /**
   * Show typing indicator
   */
  showTypingIndicator() {
    const indicator = this.$('.typing-indicator');
    const input = this.$('.chat-input');
    const sendBtn = this.$('.send-button');

    if (indicator) {
      indicator.style.display = 'flex';
    }
    if (input) {
      input.disabled = true;
    }
    if (sendBtn) {
      sendBtn.disabled = true;
    }
    this.scrollToBottom();
  }

  /**
   * Hide typing indicator
   */
  hideTypingIndicator() {
    const indicator = this.$('.typing-indicator');
    const input = this.$('.chat-input');
    const sendBtn = this.$('.send-button');

    if (indicator) {
      indicator.style.display = 'none';
    }
    if (input) {
      input.disabled = false;
    }
    if (sendBtn) {
      sendBtn.disabled = false;
    }
  }

  /**
   * Load system health
   */
  async loadSystemHealth() {
    try {
      const response = await fetch('/api/health');
      const data = await response.json();

      if (data.database?.contacts > 0) {
        this.performance = `${data.database.contacts} contatos`;
      }

      if (data.status !== 'healthy') {
        this.showNotification();
      }
    } catch (error) {
      console.error('[AIChat] Failed to load system health:', error);
      this.performance = 'Offline';
    }
  }

  /**
   * Auto-resize textarea
   */
  autoResize(textarea) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 80) + 'px';
  }

  /**
   * Scroll chat to bottom
   */
  scrollToBottom() {
    const messagesContainer = this.$('.chat-messages');
    if (messagesContainer) {
      setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }, 100);
    }
  }

  /**
   * Add initial welcome message
   */
  addInitialMessage() {
    if (this._initialMessageAdded) return;
    this._initialMessageAdded = true;

    this.addMessage({
      type: 'welcome',
      text: 'Sou o Assistente de IA da AvectaAI! Tenho acesso aos dados reais de pesquisa e posso ajudar com:',
      features: [
        { icon: '📊', title: 'Agente de Conhecimento', items: 'Análise de Satisfação, Análise de Problemas, Análise de Bairros' },
        { icon: '📱', title: 'Agente de Notificação', items: 'Notificações de Atualizações, Notificações Generalistas, Notificações Segmentadas' },
        { icon: '🎫', title: 'Agente de Sistema', items: 'Status do Sistema, Dados e Informações, Exportações' }
      ],
      suggestions: [
        'Mostrar análise de satisfação',
        'Encontrar moradores insatisfeitos',
        'Quais bairros precisam de acompanhamento',
        'Status do sistema',
        'Listar moradores interessados em participar',
        'Mostrar moradores que não querem participar',
        'Relatório: Satisfação por idade'
      ]
    }, 'bot', {
      agent: 'System'
    });
  }

  /**
   * Show age report preview
   */
  showAgeReportPreview() {
    // Add placeholder loading message
    this.addMessage({ type: 'age_report_preview', data: { loading: true } }, 'bot', { agent: 'Relatório' });

    fetch('/api/age-satisfaction')
      .then(r => r.json())
      .then(data => {
        // Replace last message with actual preview (simple approach: push another message)
        this.addMessage({ type: 'age_report_preview', data }, 'bot', { agent: 'Relatório', timestamp: new Date().toISOString() });
      })
      .catch(err => {
        this.addMessage('Erro ao carregar dados de satisfação por idade: ' + err.message, 'bot', { agent: 'Relatório', timestamp: new Date().toISOString() });
      });
  }

  // ========== Event Handlers ==========

  handleToggleClick(e) {
    e.stopPropagation();
    this.toggleChat();
  }

  handleCloseClick(e) {
    e.stopPropagation();
    this.closeChat();
  }

  handleSendClick(e) {
    e.preventDefault();
    this.sendMessage();
  }

  handleInputKeypress(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.sendMessage();
    }
  }

  handleInputChange(e) {
    this.autoResize(e.target);
  }

  handleQuickSuggestion(message) {
    // Special client-side commands
    if (message.toLowerCase().includes('relatório: satisfação por idade')) {
      this.showAgeReportPreview();
      return;
    }

    const input = this.$('.chat-input');
    if (input) {
      input.value = message;
    }
    if (!this.isOpen) {
      this.openChat();
    }
    this.sendMessage(message);
  }

  // ========== Rendering ==========

  render() {
    // Always render full template with current property values
    const template = html`
      <style>${this.styles()}</style>
      <div class="chat-widget">
        <button class="chat-toggle" part="toggle">
          <div class="notification-badge ${this.showNotificationBadge ? 'show' : ''}">!</div>
          <img src="./ia-icon.svg" alt="IA">
        </button>

        <div class="chat-container ${this.isOpen ? 'open' : ''}" part="container">
          <div class="chat-header">
            <div>
              <div class="chat-title">Assistente IA</div>
              <div class="chat-status">Ativo</div>
            </div>
            <button class="chat-close">&times;</button>
          </div>

          <div class="chat-messages">
            <!-- Messages appended via DOM manipulation to avoid re-render issues -->
          </div>

          <div class="chat-input-container">
            <div class="typing-indicator" style="display: none;">
              <div class="message-avatar">🤖</div>
              <div class="typing-dots">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
              </div>
              <span class="text-xs text-muted ml-8">IA analisando dados...</span>
            </div>

            <div class="chat-input-wrapper">
              <textarea
                class="chat-input"
                placeholder="Experimente: 'analisar satisfação por bairro' ou 'enviar acompanhamento para moradores insatisfeitos'"
                rows="1"
              ></textarea>
              <button class="send-button">
                <img src="./send-icon.svg" alt="Enviar">
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.shadowRoot.innerHTML = template;
    this.attachRenderedEventListeners();
  }

  formatMessageContent(content) {
    // Handle welcome message
    if (typeof content === 'object' && content.type === 'welcome') {
      return html`
        <p>${content.text}</p>
        <ul>
          ${content.features.map(f => html`
            <li>${f.icon} <strong>${f.title}</strong> - ${f.items}</li>
          `)}
        </ul>
        <div class="quick-suggestions">
          ${content.suggestions.map(s => html`
            <button class="quick-suggestion" data-message="${s}">${this.getButtonLabel(s)}</button>
          `)}
        </div>
      `;
    }

    // Inline age report preview
    if (typeof content === 'object' && content.type === 'age_report_preview') {
      const age = content.data?.age;
      const overall = content.data?.overall;
      if (!age) {
        return html`<div class="summary-box">Nenhum dado de idade disponível para gerar pré-visualização.</div>`;
      }
      return html`
        <div class="summary-box">
          <strong>Satisfação por Idade (pré-visualização)</strong><br>
          Respostas com idade: <span class="metric-highlight">${age.totalResponses}</span><br>
          Média Global: <span class="metric-highlight">${overall?.averageScore ?? '—'}/5</span><br>
          Faixas: ${age.brackets.length}<br>
          ${age.brackets.slice(0,3).map(b => `${b.label}: ${b.averageScore}/5 (n=${b.count})`).join('<br>')}
          ${age.brackets.length > 3 ? '<br>...':''}
          <div class="mt-8">
            <button class="open-age-report-btn" data-open-age-report>Abrir relatório completo ↗</button>
          </div>
        </div>
      `;
    }

    // Handle string content
    if (typeof content === 'string') {
      return content.replace(/\n/g, '<br>');
    }

    // Handle analysis payload
    if (typeof content === 'object' && content.analysis) {
      const analysis = content.analysis;
      let result = '';

      if (analysis.summary) {
        result += `<div class="summary-box">${analysis.summary.replace(/\n/g, '<br>')}</div>`;
      }

      if (Array.isArray(analysis.residents) && analysis.residents.length > 0) {
        result += `<div class="mt-12"><strong>Lista de residentes:</strong><ul class="list-offset">`;
        analysis.residents.forEach(r => {
          result += `<li><strong>${r.name}</strong> (${r.neighborhood || '—'})<br>`;
          result += `Satisfação: <span class="metric-highlight">${r.satisfaction || '—'}</span>`;
          if (r.whatsapp) {
            result += `<br>WhatsApp: <a href="https://wa.me/${r.whatsapp.replace(/\D/g, '')}" target="_blank">${r.whatsapp}</a>`;
          }
          result += `</li>`;
        });
        result += `</ul></div>`;
      }

      return result;
    }

    return String(content);
  }

  formatMetadata(metadata) {
    const parts = [];
    if (metadata.intent) parts.push(`Intent: ${metadata.intent}`);
    if (metadata.confidence) parts.push(`Confidence: ${(metadata.confidence * 100).toFixed(0)}%`);
    if (metadata.timestamp) {
      const time = new Date(metadata.timestamp).toLocaleTimeString();
      parts.push(`Time: ${time}`);
    }
    return parts.join(' • ');
  }

  getButtonLabel(message) {
    const labels = {
      'Mostrar análise de satisfação': 'Análise de Satisfação',
      'Encontrar moradores insatisfeitos': 'Análise de Insatisfação',
      'Quais bairros precisam de acompanhamento': 'Análise de Bairros',
      'Status do sistema': 'Status do Sistema',
      'Listar moradores interessados em participar': 'Participação: interessados',
      'Mostrar moradores que não querem participar': 'Participação: não interessados'
    };
    return labels[message] || message;
  }

  /**
   * Attach event listeners after render
   */
  attachRenderedEventListeners() {
    const toggle = this.$('.chat-toggle');
    const close = this.$('.chat-close');
    const sendBtn = this.$('.send-button');
    const input = this.$('.chat-input');
    const suggestions = this.$$('.quick-suggestion');
    const openAgeReportBtn = this.$('[data-open-age-report]');

    if (toggle) {
      toggle.addEventListener('click', (e) => this.handleToggleClick(e));
    }

    if (close) {
      close.addEventListener('click', (e) => this.handleCloseClick(e));
    }

    if (sendBtn) {
      sendBtn.addEventListener('click', (e) => this.handleSendClick(e));
    }

    if (input) {
      input.addEventListener('keypress', (e) => this.handleInputKeypress(e));
      input.addEventListener('input', (e) => this.handleInputChange(e));
    }

    suggestions.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const message = e.target.getAttribute('data-message');
        if (message) this.handleQuickSuggestion(message);
      });
    });

    if (openAgeReportBtn) {
      openAgeReportBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.open('age-satisfaction.html', '_blank');
      });
    }
  }

  styles() {
    return css`
      :host {
        display: inline-block;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      }

      * {
        box-sizing: border-box;
      }

      .chat-widget {
        position: relative;
        display: inline-block;
      }


      .chat-toggle {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: linear-gradient(135deg, #ce00c2ff 0%, #5200e7ff 100%);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 20px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        transition: transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1), box-shadow 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
        position: relative;
      }

      .chat-toggle:hover {
        transform: scale(1.05);
        box-shadow: 0 6px 16px rgba(0,0,0,0.2);
      }

      .chat-toggle img {
        width: 24px;
        height: 24px;
      }

      .notification-badge {
        position: absolute;
        top: -2px;
        right: -2px;
        background: #ff4757;
        color: white;
        border-radius: 50%;
        width: 16px;
        height: 16px;
        font-size: 9px;
        display: none;
        align-items: center;
        justify-content: center;
        border: 2px solid white;
        animation: pulse 2s infinite;
      }

      .notification-badge.show {
        display: flex;
      }

      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
      }

      /* QuickStats-style slide animation - adapted for right slide */
      @keyframes slideInFromRight {
        from {
          opacity: 0;
          transform: translateX(100%);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }

      @keyframes slideOutToRight {
        from {
          opacity: 1;
          transform: translateX(0);
        }
        to {
          opacity: 0;
          transform: translateX(100%);
        }
      }

      .chat-container {
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        width: 420px;
        height: 100vh;
        background: white;
        box-shadow: -4px 0 24px rgba(0,0,0,0.15);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border-left: 1px solid #e1e5e9;
        transform: translateX(100%);
        opacity: 0;
        visibility: hidden;
        z-index: 999;
        pointer-events: none;
        backface-visibility: hidden;
        -webkit-font-smoothing: antialiased;
      }

      .chat-container.open {
        visibility: visible;
        pointer-events: auto;
        animation: slideInFromRight 420ms cubic-bezier(0.05, 0.7, 0.1, 1) both;
      }

      .chat-container:not(.open) {
        animation: slideOutToRight 420ms cubic-bezier(0.05, 0.7, 0.1, 1) both;
      }

      .chat-header {
        background: linear-gradient(135deg, #ce00c2ff 0%, #5200e7ff 100%);
        color: white;
        padding: 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .chat-title {
        font-weight: 600;
        font-size: 16px;
      }

      .chat-status {
        font-size: 12px;
        opacity: 0.9;
        margin-top: 2px;
      }

      .chat-close {
        background: none;
        border: none;
        color: white;
        font-size: 24px;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        transition: background-color 0.15s cubic-bezier(0.4, 0.0, 0.2, 1);
      }

      .chat-close:hover {
        background: rgba(255,255,255,0.1);
      }

      .chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        background: #f8f9fa;
      }

      .message {
        margin-bottom: 16px;
        display: flex;
        align-items: flex-start;
        gap: 12px;
      }

      .message.user {
        flex-direction: row-reverse;
      }

      .message-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        flex-shrink: 0;
      }

      .message.bot .message-avatar {
        background: #e8f4fd;
        color: #1976d2;
      }

      .message.user .message-avatar {
        background: #f3e5f5;
        color: #7b1fa2;
      }

      .message-content {
        max-width: 80%;
        padding: 14px 18px;
        border-radius: 20px;
        font-size: 14px;
        line-height: 1.5;
        word-wrap: break-word;
      }

      .message.bot .message-content {
        background: white;
        border: 1px solid #e1e5e9;
        border-bottom-left-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      }

      .message.user .message-content {
        background: linear-gradient(135deg, #ce00c2ff 0%, #5200e7ff 100%);
        color: white;
        border-bottom-right-radius: 8px;
      }

      .agent-badge {
        background: #e8f5e8;
        color: #2e7d32;
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        margin-bottom: 8px;
        display: inline-block;
      }

      .notification-agent .agent-badge {
        background: #fff3e0;
        color: #f57c00;
      }

      .ticket-agent .agent-badge {
        background: #fce4ec;
        color: #c2185b;
      }

      .chat-input-container {
        padding: 16px;
        border-top: 1px solid #e1e5e9;
        background: white;
      }

      .typing-indicator {
        display: none;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
      }

      .typing-indicator.show {
        display: flex;
      }

      .typing-dots {
        display: flex;
        gap: 4px;
      }

      .typing-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #999;
        animation: typingBounce 1.4s infinite ease-in-out;
      }

      .typing-dot:nth-child(1) {
        animation-delay: 0s;
      }

      .typing-dot:nth-child(2) {
        animation-delay: 0.2s;
      }

      .typing-dot:nth-child(3) {
        animation-delay: 0.4s;
      }

      @keyframes typingBounce {
        0%, 60%, 100% { transform: translateY(0); }
        30% { transform: translateY(-8px); }
      }

      .text-xs {
        font-size: 11px;
      }

      .text-muted {
        color: #666;
      }

      .ml-8 {
        margin-left: 8px;
      }

      .chat-input-wrapper {
        display: flex;
        gap: 12px;
        align-items: flex-end;
      }

      .chat-input {
        flex: 1;
        border: 1px solid #e1e5e9;
        border-radius: 20px;
        padding: 12px 16px;
        font-size: 14px;
        outline: none;
        resize: none;
        max-height: 80px;
        min-height: 40px;
        font-family: inherit;
        transition: border-color 0.15s cubic-bezier(0.4, 0.0, 0.2, 1), box-shadow 0.15s cubic-bezier(0.4, 0.0, 0.2, 1);
      }

      .chat-input:focus {
        border-color: #667eea;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
      }

      .send-button {
        width: 40px;
        height: 40px;
        border: none;
        border-radius: 50%;
        background: linear-gradient(135deg, #ce00c2ff 0%, #5200e7ff 100%);
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.15s cubic-bezier(0.4, 0.0, 0.2, 1), box-shadow 0.15s cubic-bezier(0.4, 0.0, 0.2, 1);
      }

      .send-button:hover:not(:disabled) {
        transform: scale(1.05);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
      }

      .send-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }

      .send-button img {
        width: 18px;
        height: 18px;
      }

      .quick-suggestions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
        position: relative;
        z-index: 100;
        isolation: isolate;
      }

      .quick-suggestion {
        background: #f0f0f0;
        border: 1px solid #ddd;
        border-radius: 16px;
        padding: 6px 12px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.15s cubic-bezier(0.4, 0.0, 0.2, 1);
        position: relative;
        z-index: 100;
        pointer-events: auto !important;
        user-select: none;
        -webkit-user-select: none;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
      }

      .quick-suggestion:hover {
        background: #e0e0e0;
        border-color: #667eea;
        color: #667eea;
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        z-index: 101;
      }

      .quick-suggestion:active {
        transform: translateY(0);
        box-shadow: none;
      }

      .response-metadata {
        font-size: 11px;
        color: #666;
        margin-top: 12px;
        padding-top: 8px;
        border-top: 1px solid #f0f0f0;
      }

      .summary-box {
        background: #f8f9ff;
        border: 1px solid #e1e8ff;
        border-radius: 8px;
        padding: 12px;
        margin: 8px 0;
      }


      .open-age-report-btn {
        background: linear-gradient(135deg, #ce00c2ff 0%, #5200e7ff 100%);
        color: #fff;
        border: none;
        padding: 6px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        box-shadow: 0 2px 4px rgba(0,0,0,0.15);
      }
      .open-age-report-btn:hover { filter: brightness(1.05); }
      .mt-10 {
        margin-top: 10px;
      }

      .mt-12 {
        margin-top: 12px;
      }

      .link-primary {
        color: #667eea;
        text-decoration: none;
      }

      .link-primary:hover {
        text-decoration: underline;
      }

      .bold {
        font-weight: 600;
      }

      .list-offset {
        margin-left: 20px;
      }

      .list-offset li {
        margin: 8px 0;
      }

      .metric-highlight {
        background: #fff9e6;
        padding: 2px 6px;
        border-radius: 4px;
        font-weight: 600;
        color: #b8860b;
      }

      ul {
        margin: 12px 0;
        padding-left: 20px;
      }

      li {
        margin: 6px 0;
      }

      /* Responsive */
      @media (max-width: 768px) {
        .chat-container {
          width: 100%;
          left: 0;
        }

        .chat-toggle {
          width: 42px;
          height: 42px;
          font-size: 18px;
        }

        .chat-toggle img {
          width: 20px;
          height: 20px;
        }
      }

      @media (max-width: 480px) {
        .chat-container {
          width: 100%;
        }

        .chat-header {
          padding: 16px;
        }

        .chat-messages {
          padding: 12px;
        }
      }
    `;
  }
}
