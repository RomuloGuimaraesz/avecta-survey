// Toast Notification System (shared)
// Canonical implementation from index.html
(function () {
  class ToastManager {
    constructor() {
      this.container = document.getElementById('toastContainer');
      if (!this.container) {
        // Create container if missing
        this.container = document.createElement('div');
        this.container.id = 'toastContainer';
        this.container.className = 'toast-container';
        document.body.appendChild(this.container);
      }
      this.toasts = new Map();
    }

    show(message, type = 'info', options = {}) {
      const toast = this.createToast(message, type, options);
      this.container.appendChild(toast);

      // Trigger animation
      setTimeout(() => toast.classList.add('show'), 10);

      // Auto-remove after duration
      const duration = options.duration || 10000;
      if (duration > 0) {
        setTimeout(() => this.remove(toast), duration);
      }

      return toast;
    }

    createToast(message, type, options = {}) {
      const toast = document.createElement('div');
      toast.className = `toast ${type}`;

      const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
      };

      const titles = {
        success: options.title || 'Sucesso!',
        error: options.title || 'Erro!',
        warning: options.title || 'Atenção!',
        info: options.title || 'Informação'
      };

      const actions = Array.isArray(options.actions) ? options.actions : [];
      const hasProgress = options.progress !== false;
      const actionButtons = actions
        .map((action, index) => {
          const variantClass = action?.variant ? ` toast-action-button--${action.variant}` : '';
          const label = action?.label || 'Ação';
          return `<button type="button" class="toast-action-button${variantClass}" data-action-index="${index}">${label}</button>`;
        })
        .join('');

      toast.innerHTML = `
        <div class="toast-icon">${icons[type] || icons.info}</div>
        <div class="toast-content">
          <div class="toast-title">${titles[type]}</div>
          <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="toastManager.remove(this.parentElement)">×</button>
        ${hasProgress ? '<div class="toast-progress"></div>' : ''}
        ${actions.length ? `<div class="toast-actions">${actionButtons}</div>` : ''}
      `;

      // Store reference
      this.toasts.set(toast, { type, message, options });

      if (actions.length) {
        const buttons = toast.querySelectorAll('.toast-action-button');
        buttons.forEach((button) => {
          const index = Number(button.getAttribute('data-action-index'));
          const action = actions[index];

          if (!action) {
            return;
          }

          button.addEventListener('click', async (event) => {
            event.stopPropagation();

            try {
              if (typeof action.onClick === 'function') {
                await action.onClick(event, { manager: this, toast, actionIndex: index });
              }
            } catch (error) {
              console.error('[ToastManager] action handler error:', error);
            }

            if (action.dismissOnClick !== false) {
              this.remove(toast);
            }
          });
        });
      }

      return toast;
    }

    remove(toast) {
      if (!toast || !toast.parentElement) return;

      const toastData = this.toasts.get(toast);

      toast.classList.add('hide');
      setTimeout(() => {
        if (toast.parentElement) {
          toast.parentElement.removeChild(toast);
        }
        this.toasts.delete(toast);
        if (toastData?.options?.onClose) {
          try {
            toastData.options.onClose(toast);
          } catch (error) {
            console.error('[ToastManager] onClose handler error:', error);
          }
        }
      }, 300);
    }

    success(message, options = {}) {
      return this.show(message, 'success', { duration: 10000, ...options });
    }

    error(message, options = {}) {
      return this.show(message, 'error', { duration: 10000, ...options });
    }

    warning(message, options = {}) {
      return this.show(message, 'warning', { duration: 10000, ...options });
    }

    info(message, options = {}) {
      return this.show(message, 'info', { duration: 10000, ...options });
    }

    clear() {
      this.toasts.forEach(toast => this.remove(toast));
    }
  }

  // Expose globally
  window.ToastManager = ToastManager;
})();
