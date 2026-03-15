/**
 * About modal dialog management for Old World Atlas
 */

class AboutModal {
    constructor() {
        this.modal = null;
        this.overlay = null;
        this.contentDiv = null;
        this.closeBtn = null;
        this.aboutBtn = null;
    }

    /**
     * Initialize the About modal functionality
     */
    initialize() {
        this.modal = document.getElementById('about-modal');
        this.overlay = document.getElementById('modal-overlay');
        this.contentDiv = document.getElementById('about-modal-content');
        this.closeBtn = document.getElementById('about-modal-close');
        this.aboutBtn = document.getElementById('about-button');

        if (!this.modal || !this.overlay || !this.contentDiv || !this.closeBtn || !this.aboutBtn) {
            console.error('About modal elements not found');
            return;
        }

        // Bind event listeners
        this.aboutBtn.addEventListener('click', () => this.open());
        this.closeBtn.addEventListener('click', () => this.close());
        this.overlay.addEventListener('click', () => this.close());

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen()) {
                this.close();
            }
        });

        // Load content
        this.loadContent();
    }

    /**
     * Load content from about-content.html
     * @private
     */
    async loadContent() {
        try {
            const response = await fetch('about-content.html?v=12');
            if (!response.ok) {
                throw new Error('Failed to load about content');
            }
            const html = await response.text();
            this.contentDiv.innerHTML = html;
        } catch (error) {
            console.error('Error loading about content:', error);
            this.contentDiv.innerHTML = '<div class="about-content"><h1>About</h1><p>Failed to load content. Please try again later.</p></div>';
        }
    }

    /**
     * Open the modal dialog
     */
    open() {
        if (this.modal && this.overlay) {
            this.overlay.style.display = 'block';
            this.modal.style.display = 'block';
            
            // Prevent scrolling on the body
            document.body.style.overflow = 'hidden';
            
            // Add animation class after display is set
            setTimeout(() => {
                this.overlay.classList.add('active');
                this.modal.classList.add('active');
            }, 10);
        }
    }

    /**
     * Close the modal dialog
     */
    close() {
        if (this.modal && this.overlay) {
            this.overlay.classList.remove('active');
            this.modal.classList.remove('active');
            
            // Wait for animation to complete before hiding
            setTimeout(() => {
                this.overlay.style.display = 'none';
                this.modal.style.display = 'none';
                document.body.style.overflow = '';
            }, 300);
        }
    }

    /**
     * Check if modal is currently open
     * @returns {boolean}
     */
    isOpen() {
        return this.modal && this.modal.style.display === 'block';
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.aboutModal = new AboutModal();
    window.aboutModal.initialize();
});
