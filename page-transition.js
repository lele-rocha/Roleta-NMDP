/**
 * Page Transitions for Roleta NMDP
 * Provides sleek, modern transitions with directional sliding, glowing neon progress bar,
 * and instant tactile nav feedback between Wheel, Voting Gallery, and Tier List tabs.
 */
(function () {
  "use strict";

  const PAGE_MAP = {
    "wheel.html": 0,
    "voting.html": 1,
    "tierlist.html": 2
  };

  function normalizePageName(path) {
    let name = (path || "").split("/").pop().split("?")[0].split("#")[0].toLowerCase();
    if (!name || name === "index.html") name = "wheel.html";
    return name;
  }

  const currentFile = normalizePageName(window.location.pathname);
  const currentIndex = PAGE_MAP[currentFile] !== undefined ? PAGE_MAP[currentFile] : 0;

  // Apply entrance animation class immediately to <html> to avoid any layout flash
  const transitionDir = sessionStorage.getItem("nmdp_page_transition_dir");
  if (transitionDir) {
    document.documentElement.classList.add("page-entering-" + transitionDir);
    try {
      sessionStorage.removeItem("nmdp_page_transition_dir");
    } catch (e) {}
  } else {
    document.documentElement.classList.add("page-entering-default");
  }

  let isNavigating = false;

  function ensureProgressBar() {
    let bar = document.getElementById("page-transition-bar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "page-transition-bar";
      bar.className = "page-transition-bar";
      document.body.appendChild(bar);
    }
    return bar;
  }

  function completeProgressBar() {
    const bar = ensureProgressBar();
    bar.style.width = "100%";
    bar.classList.add("completing");

    setTimeout(() => {
      if (bar && bar.parentElement) {
        bar.parentElement.removeChild(bar);
      }
      document.documentElement.classList.remove(
        "page-entering-from-right",
        "page-entering-from-left",
        "page-entering-default",
        "page-is-transitioning"
      );
    }, 340);
  }

  function startProgressBar() {
    const bar = ensureProgressBar();
    bar.classList.remove("completing");
    bar.style.width = "0%";
    void bar.offsetWidth; // Force layout reflow
    bar.style.width = "75%";
  }

  function setupTransitions() {
    const navLinks = document.querySelectorAll(".top-nav__link");

    navLinks.forEach((link) => {
      link.addEventListener("click", (e) => {
        // Allow user to open in new tab (Ctrl/Cmd/Shift/Alt or middle click)
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
          return;
        }

        const href = link.getAttribute("href");
        if (!href || href.startsWith("#") || href.startsWith("javascript:")) {
          return;
        }

        const targetFile = normalizePageName(href);

        // Clicking currently active tab
        if (targetFile === currentFile) {
          e.preventDefault();
          link.classList.remove("active-pulse");
          void link.offsetWidth; // Trigger reflow for re-animation
          link.classList.add("active-pulse");
          return;
        }

        const targetIndex = PAGE_MAP[targetFile];
        if (targetIndex === undefined) {
          return; // External or unmapped link
        }

        e.preventDefault();
        if (isNavigating) return;
        isNavigating = true;

        // Direction:
        // targetIndex > currentIndex => moving forward (Wheel -> Voting -> Tierlist)
        // targetIndex < currentIndex => moving backward (Tierlist -> Voting -> Wheel)
        const isForward = targetIndex > currentIndex;
        const exitClass = isForward ? "page-exiting-to-left" : "page-exiting-to-right";
        const enterDir = isForward ? "from-right" : "from-left";

        try {
          sessionStorage.setItem("nmdp_page_transition_dir", enterDir);
        } catch (err) {}

        // Immediate tactile feedback on navbar
        navLinks.forEach((l) => l.classList.remove("transitioning-target"));
        link.classList.add("transitioning-target");

        document.documentElement.classList.add("page-is-transitioning", exitClass);
        startProgressBar();

        // Perform swift and fluid transition
        setTimeout(() => {
          window.location.href = href;
        }, 190);
      });
    });
  }

  // Handle browser back/forward cache (pageshow)
  window.addEventListener("pageshow", () => {
    isNavigating = false;
    document.documentElement.classList.remove(
      "page-exiting-to-left",
      "page-exiting-to-right",
      "page-is-transitioning"
    );
    const bar = document.getElementById("page-transition-bar");
    if (bar && bar.parentElement) {
      bar.parentElement.removeChild(bar);
    }
    document.querySelectorAll(".top-nav__link").forEach((l) => {
      l.classList.remove("transitioning-target", "active-pulse");
    });
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      completeProgressBar();
      setupTransitions();
    });
  } else {
    completeProgressBar();
    setupTransitions();
  }
})();
