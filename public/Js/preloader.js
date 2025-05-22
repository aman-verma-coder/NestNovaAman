/**
 * Page Preloader Script
 * Controls the display of the loading animation while page content loads
 */

document.addEventListener('DOMContentLoaded', function () {
    // Get the preloader element
    const preloader = document.getElementById('preloader');
    const contentContainer = document.querySelector('.container');

    if (!preloader) return;

    // Function to hide preloader
    function hidePreloader() {
        preloader.classList.add('hidden');

        // Make content visible
        if (contentContainer) {
            contentContainer.classList.add('visible');
        }

        // Remove preloader from DOM after transition completes
        setTimeout(() => {
            preloader.style.display = 'none';
        }, 1000);
    }

    // Hide preloader when page is fully loaded
    window.addEventListener('load', function () {
        // Add a delay to make the loader visible for a longer duration
        // even if the page loads very quickly
        setTimeout(hidePreloader, 2000);
    });

    // Fallback: Hide preloader after a maximum time (8 seconds)
    // This ensures the preloader doesn't stay indefinitely if there's an issue
    setTimeout(hidePreloader, 8000);
});