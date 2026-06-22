(function () {
  "use strict";

  const STORAGE_KEY = "roleta-nmdp-cards";
  const USERS_STORAGE_KEY = "roleta-nmdp-users";
  const SESSION_STORAGE_KEY = "roleta-nmdp-session";

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

  // User Session elements
  const userLoginForm = document.getElementById("user-login-form");
  const userProfileStatus = document.getElementById("user-profile-status");
  const usernameInput = document.getElementById("username-input");
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const activeUsername = document.getElementById("active-username");
  const activeUserVotes = document.getElementById("active-user-votes");
  const clearVotesBtn = document.getElementById("clear-votes-btn");

  // Backup elements
  const exportDataBtn = document.getElementById("export-data-btn");
  const importDataBtn = document.getElementById("import-data-btn");
  const importFileInput = document.getElementById("import-file-input");

  // Users List elements
  const toggleUsersListBtn = document.getElementById("toggle-users-list-btn");
  const usersListDropdown = document.getElementById("users-list-dropdown");
  const usersListContainer = document.getElementById("users-list-container");
  const usersEmptyMsg = document.getElementById("users-empty-msg");

  let cards = [];
  let users = []; // each: { name, votedCardIds: [] }
  let currentUsername = null;
  let pendingImageDataUrl = null;
  let editingCardId = null;

  // --- User Profiles state persistence ---
  function loadUsers() {
    try {
      const raw = localStorage.getItem(USERS_STORAGE_KEY);
      if (raw) {
        users = JSON.parse(raw);
      } else {
        users = [];
      }
    } catch (e) {
      users = [];
    }
  }

  function saveUsers() {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  }

  function loadSession() {
    currentUsername = localStorage.getItem(SESSION_STORAGE_KEY) || null;
  }

  function saveSession() {
    if (currentUsername) {
      localStorage.setItem(SESSION_STORAGE_KEY, currentUsername);
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }

  function getOrCreateUser(name) {
    let user = users.find(u => u.name.toLowerCase() === name.toLowerCase());
    if (!user) {
      user = { name: name, votedCardIds: [] };
      users.push(user);
      saveUsers();
    }
    return user;
  }

  function updateUserBar() {
    if (currentUsername) {
      userLoginForm.style.display = "none";
      userProfileStatus.style.display = "flex";
      activeUsername.textContent = currentUsername;

      const user = getOrCreateUser(currentUsername);
      activeUserVotes.textContent = user.votedCardIds.length;
    } else {
      userLoginForm.style.display = "flex";
      userProfileStatus.style.display = "none";
      usernameInput.value = "";
    }
    renderUsers();
  }

  function renderUsers() {
    usersListContainer.innerHTML = "";
    if (users.length === 0) {
      usersEmptyMsg.hidden = false;
      return;
    }
    usersEmptyMsg.hidden = true;

    // Sort users alphabetically
    const sortedUsers = [...users].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

    sortedUsers.forEach((user) => {
      const cardCount = user.votedCardIds.length;
      const remaining = Math.max(0, 20 - cardCount);
      
      const el = document.createElement("div");
      el.className = "user-status-card";
      if (currentUsername && user.name.toLowerCase() === currentUsername.toLowerCase()) {
        el.classList.add("active-user-highlight");
      }

      el.innerHTML = `
        <span class="user-status-card__name">${escapeHtml(user.name)}</span>
        <span class="user-status-card__votes">Votos: <strong>${cardCount}</strong>/20 (Restam: <strong>${remaining}</strong>)</span>
      `;
      usersListContainer.appendChild(el);
    });
  }

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
      if (currentUsername) {
        const user = getOrCreateUser(currentUsername);
        if (user.votedCardIds.includes(card.id)) {
          el.classList.add("voted");
        }
      }
      // Find all users who voted for this card
      const voters = users
        .filter((u) => u.votedCardIds.includes(card.id))
        .map((u) => u.name);

      const votersHtml = voters.length > 0
        ? `<div class="vote-card__voters" title="Eleitores: ${voters.join(', ')}">👥 ${voters.map(escapeHtml).join(', ')}</div>`
        : '';

      el.dataset.id = card.id;
      el.innerHTML = `
        <span class="card-votes-badge">${card.votes}</span>
        <div class="card-menu-container">
          <button class="btn-card-menu" title="Opções">⋮</button>
          <div class="card-menu-dropdown" hidden>
            <button class="btn-card-menu-item btn-edit-card" data-id="${card.id}">✏️ Editar</button>
            <button class="btn-card-menu-item btn-delete-card" data-id="${card.id}">🗑️ Excluir</button>
          </div>
        </div>
        <button class="btn-remove-vote" data-id="${card.id}" title="Remover Voto">
          <span class="btn-remove-vote__icon">✕</span>
          <span class="btn-remove-vote__text">Remover Voto</span>
        </button>
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
          ${votersHtml}
        </div>
      `;

      // Vote on card click (excluding menu button, menu dropdown, or remove-vote button)
      el.addEventListener("click", (e) => {
        if (
          e.target.closest(".btn-card-menu") ||
          e.target.closest(".card-menu-dropdown") ||
          e.target.closest(".btn-remove-vote")
        ) {
          return;
        }

        if (!currentUsername) {
          alert("Identifique-se primeiro digitando seu nome no topo da página!");
          usernameInput.focus();
          return;
        }

        const user = getOrCreateUser(currentUsername);

        // Check if already voted for this card
        if (user.votedCardIds.includes(card.id)) {
          alert("Você já votou neste card!");
          return;
        }

        // Check if 20 votes limit reached
        if (user.votedCardIds.length >= 20) {
          alert("Você já esgotou seu limite de 20 votos!");
          return;
        }

        card.votes++;
        user.votedCardIds.push(card.id);
        
        saveCards();
        saveUsers();
        renderCards();
        updateUserBar();
      });

      const menuBtn = el.querySelector(".btn-card-menu");
      const menuDropdown = el.querySelector(".card-menu-dropdown");

      // Toggle menu dropdown
      menuBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        document.querySelectorAll(".card-menu-dropdown").forEach((drop) => {
          if (drop !== menuDropdown) drop.hidden = true;
        });
        menuDropdown.hidden = !menuDropdown.hidden;
      });

      // Edit listener
      el.querySelector(".btn-edit-card").addEventListener("click", (e) => {
        e.stopPropagation();
        menuDropdown.hidden = true;
        editingCardId = card.id;
        editTitleInput.value = card.title;
        editDescInput.value = card.description || "";
        editOverlay.hidden = false;
      });

      // Delete listener
      el.querySelector(".btn-delete-card").addEventListener("click", (e) => {
        e.stopPropagation();
        menuDropdown.hidden = true;
        cards = cards.filter((c) => c.id !== card.id);
        saveCards();
        renderCards();
      });

      // Remove vote listener
      el.querySelector(".btn-remove-vote").addEventListener("click", (e) => {
        e.stopPropagation();

        if (!currentUsername) {
          alert("Identifique-se primeiro no topo da página!");
          usernameInput.focus();
          return;
        }

        const user = getOrCreateUser(currentUsername);
        const index = user.votedCardIds.indexOf(card.id);

        if (index === -1) {
          alert("Você não votou neste card, por isso não pode remover o voto!");
          return;
        }

        if (card.votes > 0) {
          card.votes--;
          user.votedCardIds.splice(index, 1);
          
          saveCards();
          saveUsers();
          renderCards();
          updateUserBar();
        }
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

  toggleUsersListBtn.addEventListener("click", () => {
    const isHidden = usersListDropdown.hidden;
    usersListDropdown.hidden = !isHidden;
    toggleUsersListBtn.classList.toggle("open", isHidden);
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

  // Close card menus when clicking outside
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".card-menu-container")) {
      document.querySelectorAll(".card-menu-dropdown").forEach((drop) => {
        drop.hidden = true;
      });
    }
  });

  // --- Sort change ---
  cardSortSelect.addEventListener("change", renderCards);

  // --- User Session Listeners ---
  loginBtn.addEventListener("click", () => {
    const name = usernameInput.value.trim();
    if (!name) {
      usernameInput.focus();
      return;
    }
    currentUsername = name;
    getOrCreateUser(currentUsername);
    saveSession();
    updateUserBar();
    renderCards();
  });

  logoutBtn.addEventListener("click", () => {
    currentUsername = null;
    saveSession();
    updateUserBar();
    renderCards();
  });

  clearVotesBtn.addEventListener("click", () => {
    if (!currentUsername) return;

    const confirmClear = confirm("Tem certeza que deseja remover todos os seus votos? Esta ação não pode ser desfeita.");
    if (!confirmClear) return;

    const user = getOrCreateUser(currentUsername);

    // Decrement vote counts on all cards the user voted for
    user.votedCardIds.forEach((cardId) => {
      const card = cards.find((c) => c.id === cardId);
      if (card && card.votes > 0) {
        card.votes--;
      }
    });

    // Reset user votedCardIds
    user.votedCardIds = [];

    saveCards();
    saveUsers();
    updateUserBar();
    renderCards();
  });

  // --- Backup Data Listeners ---
  exportDataBtn.addEventListener("click", () => {
    const data = {
      cards: cards,
      users: users
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `roleta-nmdp-backup-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  importDataBtn.addEventListener("click", () => {
    importFileInput.click();
  });

  importFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.cards && data.users) {
          cards = data.cards;
          users = data.users;
          saveCards();
          saveUsers();
          renderCards();
          updateUserBar();
          alert("Backup importado com sucesso!");
        } else {
          alert("Arquivo de backup inválido! O arquivo deve conter cards e usuários.");
        }
      } catch (err) {
        alert("Erro ao ler o arquivo de backup!");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  // --- Init ---
  loadCards();
  loadUsers();
  loadSession();
  updateUserBar();
  renderCards();
})();
