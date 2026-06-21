(function () {
  "use strict";

  const STORAGE_KEY = "roleta-nmdp-cards";

  const cardTitleInput = document.getElementById("card-title-input");
  const cardDescInput = document.getElementById("card-desc-input");
  const cardImageInput = document.getElementById("card-image-input");
  const addCardBtn = document.getElementById("add-card-btn");
  const cardSortSelect = document.getElementById("card-sort-select");
  const cardsContainer = document.getElementById("cards-container");
  const cardsEmptyMsg = document.getElementById("cards-empty-msg");
  const cardImagePreview = document.getElementById("card-image-preview");
  const cardPreviewImg = document.getElementById("card-preview-img");
  const removeCardPreview = document.getElementById("remove-card-preview");

  // Dropdown toggle controls
  const toggleControlsBtn = document.getElementById("toggle-controls-btn");
  const votingControlsDropdown = document.getElementById("voting-controls-dropdown");

  // Edit Card Modal elements
  const editOverlay = document.getElementById("edit-overlay");
  const editTitleInput = document.getElementById("edit-title-input");
  const editDescInput = document.getElementById("edit-desc-input");
  const saveEditBtn = document.getElementById("save-edit-btn");
  const cancelEditBtn = document.getElementById("cancel-edit-btn");

  let cards = [];
  let pendingImageDataUrl = null;
  let editingCardId = null;

  // --- localStorage persistence ---
  function loadCards() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        cards = JSON.parse(raw);
      }
    } catch (e) {
      cards = [];
    }
  }

  // --- Save cards ---
  function saveCards() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
  }

  // --- Rendering ---
  function renderCards() {
    const sortMode = cardSortSelect.value;
    const sorted = [...cards];

    if (sortMode === "votes") {
      sorted.sort((a, b) => b.votes - a.votes);
    } else {
      sorted.sort((a, b) => b.timestamp - a.timestamp);
    }

    cardsContainer.innerHTML = "";

    if (sorted.length === 0) {
      cardsEmptyMsg.hidden = false;
      return;
    }
    cardsEmptyMsg.hidden = true;

    sorted.forEach((card) => {
      const el = document.createElement("div");
      el.className = "vote-card";
      el.dataset.id = card.id;
      el.innerHTML = `
        <div class="vote-card__img-wrap">
          ${card.imageDataUrl
            ? `<img src="${card.imageDataUrl}" alt="${card.title}" class="vote-card__img" />`
            : `<div class="vote-card__no-img">Sem imagem</div>`
          }
        </div>
        <div class="vote-card__body">
          <h3 class="vote-card__title">${escapeHtml(card.title)}</h3>
          ${card.description ? `<p class="vote-card__desc">${escapeHtml(card.description)}</p>` : ""}
          <p class="vote-card__date">${formatDate(card.timestamp)}</p>
          <div class="vote-card__actions">
            <button class="btn-vote" tabindex="-1">❤️ ${card.votes}</button>
            <button class="btn-edit-card" data-id="${card.id}">✏️</button>
            <button class="btn-delete-card" data-id="${card.id}">🗑️</button>
          </div>
        </div>
      `;

      // Vote on card click (excluding delete/edit buttons)
      el.addEventListener("click", (e) => {
        if (e.target.closest(".btn-delete-card") || e.target.closest(".btn-edit-card")) {
          return;
        }
        card.votes++;
        saveCards();
        renderCards();
      });

      // Edit listener
      el.querySelector(".btn-edit-card").addEventListener("click", (e) => {
        e.stopPropagation();
        editingCardId = card.id;
        editTitleInput.value = card.title;
        editDescInput.value = card.description || "";
        editOverlay.hidden = false;
      });

      // Delete listener
      el.querySelector(".btn-delete-card").addEventListener("click", (e) => {
        e.stopPropagation();
        cards = cards.filter((c) => c.id !== card.id);
        saveCards();
        renderCards();
      });

      cardsContainer.appendChild(el);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function formatDate(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // --- Image handling ---
  function showPreview(dataUrl) {
    pendingImageDataUrl = dataUrl;
    cardPreviewImg.src = dataUrl;
    cardImagePreview.hidden = false;
  }

  function clearPreview() {
    pendingImageDataUrl = null;
    cardPreviewImg.src = "";
    cardImagePreview.hidden = true;
    cardImageInput.value = "";
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
    });
  }

  // File input handler
  cardImageInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (file) {
      const dataUrl = await readFileAsDataUrl(file);
      showPreview(dataUrl);
    }
  });

  // Clipboard paste handler (Ctrl+V)
  document.addEventListener("paste", async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const dataUrl = await readFileAsDataUrl(file);
          showPreview(dataUrl);
        }
        return;
      }
    }
  });

  removeCardPreview.addEventListener("click", clearPreview);

  // --- Add card ---
  addCardBtn.addEventListener("click", () => {
    const title = cardTitleInput.value.trim();
    if (!title) {
      cardTitleInput.focus();
      cardTitleInput.style.borderColor = "#ff7675";
      setTimeout(() => { cardTitleInput.style.borderColor = ""; }, 1500);
      return;
    }

    const description = cardDescInput.value.trim();

    const newCard = {
      id: generateId(),
      title: title,
      description: description || null,
      imageDataUrl: pendingImageDataUrl,
      timestamp: Date.now(),
      votes: 0,
    };

    cards.push(newCard);
    saveCards();
    renderCards();

    // Reset form
    cardTitleInput.value = "";
    cardDescInput.value = "";
    clearPreview();
  });

  // --- Dropdown Toggle ---
  toggleControlsBtn.addEventListener("click", () => {
    const isHidden = votingControlsDropdown.hidden;
    votingControlsDropdown.hidden = !isHidden;
    toggleControlsBtn.classList.toggle("open", isHidden);
  });

  // --- Edit Modal Handlers ---
  saveEditBtn.addEventListener("click", () => {
    const title = editTitleInput.value.trim();
    if (!title) {
      editTitleInput.focus();
      return;
    }
    const card = cards.find((c) => c.id === editingCardId);
    if (card) {
      card.title = title;
      card.description = editDescInput.value.trim() || null;
      saveCards();
      renderCards();
    }
    editOverlay.hidden = true;
    editingCardId = null;
  });

  cancelEditBtn.addEventListener("click", () => {
    editOverlay.hidden = true;
    editingCardId = null;
  });

  editOverlay.addEventListener("click", (e) => {
    if (e.target === editOverlay) {
      editOverlay.hidden = true;
      editingCardId = null;
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !editOverlay.hidden) {
      editOverlay.hidden = true;
      editingCardId = null;
    }
  });

  // --- Sort change ---
  cardSortSelect.addEventListener("change", renderCards);

  // --- Init ---
  loadCards();
  renderCards();
})();
