(function () {
  "use strict";

  const STORAGE_KEY = "roleta-nmdp-cards";

  const cardTitleInput = document.getElementById("card-title-input");
  const cardImageInput = document.getElementById("card-image-input");
  const addCardBtn = document.getElementById("add-card-btn");
  const cardSortSelect = document.getElementById("card-sort-select");
  const cardsContainer = document.getElementById("cards-container");
  const cardsEmptyMsg = document.getElementById("cards-empty-msg");
  const cardImagePreview = document.getElementById("card-image-preview");
  const cardPreviewImg = document.getElementById("card-preview-img");
  const removeCardPreview = document.getElementById("remove-card-preview");

  let cards = [];
  let pendingImageDataUrl = null;

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
      el.innerHTML = `
        <div class="vote-card__img-wrap">
          ${card.imageDataUrl
            ? `<img src="${card.imageDataUrl}" alt="${card.title}" class="vote-card__img" />`
            : `<div class="vote-card__no-img">Sem imagem</div>`
          }
        </div>
        <div class="vote-card__body">
          <h3 class="vote-card__title">${escapeHtml(card.title)}</h3>
          <p class="vote-card__date">${formatDate(card.timestamp)}</p>
          <div class="vote-card__actions">
            <button class="btn-vote" data-id="${card.id}">❤️ ${card.votes}</button>
            <button class="btn-delete-card" data-id="${card.id}">🗑️</button>
          </div>
        </div>
      `;
      cardsContainer.appendChild(el);
    });

    // Attach vote listeners
    cardsContainer.querySelectorAll(".btn-vote").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const card = cards.find((c) => c.id === id);
        if (card) {
          card.votes++;
          saveCards();
          renderCards();
        }
      });
    });

    // Attach delete listeners
    cardsContainer.querySelectorAll(".btn-delete-card").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        cards = cards.filter((c) => c.id !== id);
        saveCards();
        renderCards();
      });
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

    const newCard = {
      id: generateId(),
      title: title,
      imageDataUrl: pendingImageDataUrl,
      timestamp: Date.now(),
      votes: 0,
    };

    cards.push(newCard);
    saveCards();
    renderCards();

    // Reset form
    cardTitleInput.value = "";
    clearPreview();
  });

  // --- Sort change ---
  cardSortSelect.addEventListener("change", renderCards);

  // --- Init ---
  loadCards();
  renderCards();
})();
