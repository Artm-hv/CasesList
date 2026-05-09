const Utils = {
    /**
     * Escape HTML special characters to prevent XSS
     */
    escapeHTML: (str) => {
        if (!str) return '';
        return str.replace(/[&<>'"]/g, t => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[t] || t));
    },

    /**
     * Format date for display (e.g., "7 травня, 12:00")
     */
    formatDateTime: (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const taskDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

        const time = d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
        
        if (taskDate.getTime() === today.getTime()) {
            return `Сьогодні, ${time}`;
        } else if (taskDate.getTime() === tomorrow.getTime()) {
            return `Завтра, ${time}`;
        }

        return d.toLocaleString('uk-UA', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    /**
     * Format date to ISO string (YYYY-MM-DD)
     */
    formatDateISO: (year, month, day) => {
        return `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    },

    /**
     * Get unique ID
     */
    generateId: () => Date.now().toString() + Math.random().toString(36).substr(2, 5),

    /**
     * Vibrate device if supported
     */
    vibrate: (ms = 50) => {
        if ('navigator' in window && navigator.vibrate) {
            navigator.vibrate(ms);
        }
    }
};
