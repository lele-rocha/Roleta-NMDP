(function () {
  "use strict";

  const SESSION_STORAGE_KEY = "roleta-nmdp-session";

  const supabaseUrl = window.SUPABASE_URL;
  const supabaseKey = window.SUPABASE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase credentials not found in config.js");
  }
  const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

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
  const editImageInput = document.getElementById("edit-image-input");
  const editImagePreview = document.getElementById("edit-image-preview");
  const editPreviewImg = document.getElementById("edit-preview-img");
  const removeEditImageBtn = document.getElementById("remove-edit-image-btn");
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
  let editingImageDataUrl = null;

  // Image cache and fetching state
  const imageCache = {}; // cardId -> base64 or 'none'
  const imageFetchPromises = {}; // cardId -> Promise
  let imageObserver = null;

  // --- User Profiles state persistence ---
  async function loadUsers() {
    try {
      const { data, error } = await supabase.from("users").select("*");
      if (error) throw error;
      users = (data || []).map(u => ({
        name: u.name,
        votedCardIds: u.voted_card_ids || []
      }));
    } catch (e) {
      console.error("Erro ao carregar usuários:", e);
      users = [];
    }
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

  async function getOrCreateUser(name) {
    let user = users.find(u => u.name.toLowerCase() === name.toLowerCase());
    if (!user) {
      user = { name: name, votedCardIds: [] };
      users.push(user);
      try {
        const { error } = await supabase.from("users").upsert({
          name: user.name,
          voted_card_ids: user.votedCardIds
        });
        if (error) throw error;
      } catch (e) {
        console.error("Erro ao criar usuário:", e);
      }
    }
    return user;
  }

  function updateUserBar() {
    if (currentUsername) {
      userLoginForm.style.display = "none";
      userProfileStatus.style.display = "flex";
      activeUsername.textContent = currentUsername;

      const user = users.find(u => u.name.toLowerCase() === currentUsername.toLowerCase());
      activeUserVotes.textContent = user ? user.votedCardIds.length : 0;
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
    const isAdmin = currentUsername && currentUsername.toLowerCase() === "lele";

    sortedUsers.forEach((user) => {
      const cardCount = user.votedCardIds.length;
      const remaining = Math.max(0, 20 - cardCount);
      
      const el = document.createElement("div");
      el.className = "user-status-card";
      if (currentUsername && user.name.toLowerCase() === currentUsername.toLowerCase()) {
        el.classList.add("active-user-highlight");
      }

      const deleteBtnHtml = (isAdmin && user.name.toLowerCase() !== "lele")
        ? `<button class="btn-delete-user" data-username="${escapeHtml(user.name)}" title="Excluir usuário e todos os seus votos">🗑️</button>`
        : '';

      el.innerHTML = `
        ${deleteBtnHtml}
        <span class="user-status-card__name">${escapeHtml(user.name)}</span>
        <span class="user-status-card__votes">Votos: <strong>${cardCount}</strong>/20 (Restam: <strong>${remaining}</strong>)</span>
      `;
      usersListContainer.appendChild(el);
    });

    // Attach click listeners for delete user buttons
    if (isAdmin) {
      usersListContainer.querySelectorAll(".btn-delete-user").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const username = btn.dataset.username;
          
          const confirmDelete = confirm(`Tem certeza que deseja excluir o usuário ${username} e todos os seus votos permanentemente?`);
          if (!confirmDelete) return;

          const user = users.find(u => u.name.toLowerCase() === username.toLowerCase());
          if (user) {
            try {
              // 1. Decrement votes on all cards the user voted for
              for (const cardId of user.votedCardIds) {
                const card = cards.find(c => c.id === cardId);
                if (card && card.votes > 0) {
                  card.votes--;
                  await supabase.from("cards").update({ votes: card.votes }).eq("id", card.id);
                }
              }

              // 2. Delete user from database
              await supabase.from("users").delete().eq("name", user.name);

              // Real-time will refresh everything, but we trigger a local update just in case
              await loadUsers();
              await loadCards();
              renderCards();
              updateUserBar();
            } catch (err) {
              console.error("Erro ao excluir usuário pelo admin:", err);
            }
          }
        });
      });
    }
  }

  // --- Database Persistence ---
  async function loadCards() {
    try {
      const { data, error } = await supabase.from("cards").select("id, title, description, timestamp, votes");
      if (error) throw error;
      cards = (data || []).map(c => ({
        id: c.id,
        title: c.title,
        description: c.description,
        imageDataUrl: imageCache[c.id] || null, // Keep cached image if available
        timestamp: Number(c.timestamp),
        votes: c.votes
      }));
    } catch (e) {
      console.error("Erro ao carregar cards:", e);
      cards = [];
    }
  }

  // --- Lazy Loading & Image Caching ---
  function initImageObserver() {
    if (!("IntersectionObserver" in window)) return;

    imageObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const placeholder = entry.target;
          const cardId = placeholder.dataset.id;
          imageObserver.unobserve(placeholder);
          triggerImageFetch(cardId);
        }
      });
    }, {
      rootMargin: "200px 0px", // Trigger loading when card is within 200px of viewport
      threshold: 0.01
    });
  }

  async function triggerImageFetch(cardId) {
    // If already loaded or fetched
    if (imageCache[cardId]) {
      updatePlaceholderWithImage(cardId);
      return;
    }

    if (imageFetchPromises[cardId]) {
      try {
        await imageFetchPromises[cardId];
        updatePlaceholderWithImage(cardId);
      } catch (err) {
        console.error("Erro ao aguardar carregamento da imagem:", err);
      }
      return;
    }

    // Start a new promise to fetch from Supabase
    imageFetchPromises[cardId] = (async () => {
      try {
        const { data, error } = await supabase
          .from("cards")
          .select("image_data_url")
          .eq("id", cardId)
          .single();

        if (error) throw error;

        if (data && data.image_data_url) {
          imageCache[cardId] = data.image_data_url;
          const card = cards.find(c => c.id === cardId);
          if (card) {
            card.imageDataUrl = data.image_data_url;
          }
        } else {
          imageCache[cardId] = "none";
          const card = cards.find(c => c.id === cardId);
          if (card) {
            card.imageDataUrl = null;
          }
        }
      } catch (err) {
        console.error(`Erro ao buscar imagem para card ${cardId}:`, err);
        imageCache[cardId] = "none";
      } finally {
        delete imageFetchPromises[cardId];
      }
    })();

    try {
      await imageFetchPromises[cardId];
      updatePlaceholderWithImage(cardId);
    } catch (err) {
      // Handled in promise
    }
  }

  function updatePlaceholderWithImage(cardId) {
    const cardEl = cardsContainer.querySelector(`.vote-card[data-id="${cardId}"]`);
    if (!cardEl) return;

    const imgWrap = cardEl.querySelector(".vote-card__img-wrap");
    if (!imgWrap) return;

    const cachedUrl = imageCache[cardId];
    if (cachedUrl && cachedUrl !== "none") {
      imgWrap.innerHTML = `<img src="${cachedUrl}" alt="" class="vote-card__img" />`;
    } else {
      imgWrap.innerHTML = `<div class="vote-card__no-img">Sem imagem</div>`;
    }
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
        const user = users.find(u => u.name.toLowerCase() === currentUsername.toLowerCase());
        if (user && user.votedCardIds && user.votedCardIds.includes(card.id)) {
          el.classList.add("voted");
        }
      }
      // Find all users who voted for this card
      const voters = users
        .filter((u) => u.votedCardIds && u.votedCardIds.includes(card.id))
        .map((u) => u.name);

      const isAdmin = currentUsername && currentUsername.toLowerCase() === "lele";

      let votersHtml = '';
      if (voters.length > 0) {
        if (isAdmin) {
          const badges = voters.map(name => 
            `<span class="voter-badge">${escapeHtml(name)} <button class="btn-remove-voter" data-username="${escapeHtml(name)}" data-cardid="${card.id}" title="Remover voto de ${escapeHtml(name)}">✕</button></span>`
          ).join('');
          votersHtml = `<div class="vote-card__voters">👥 ${badges}</div>`;
        } else {
          votersHtml = `<div class="vote-card__voters" title="Eleitores: ${voters.join(', ')}">👥 ${voters.map(escapeHtml).join(', ')}</div>`;
        }
      }

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
          ${(function() {
            const cached = imageCache[card.id];
            if (cached) {
              if (cached === "none") {
                return `<div class="vote-card__no-img">Sem imagem</div>`;
              }
              return `<img src="${cached}" alt="${escapeHtml(card.title)}" class="vote-card__img" />`;
            }
            // If not cached, render placeholder
            return `<div class="vote-card__no-img img-loading-placeholder" data-id="${card.id}">Carregando imagem...</div>`;
          })()}
        </div>
        <div class="vote-card__body">
          <h3 class="vote-card__title">${escapeHtml(card.title)}</h3>
          ${card.description ? `<p class="vote-card__desc">${escapeHtml(card.description)}</p>` : ""}
          <p class="vote-card__date">${formatDate(card.timestamp)}</p>
          ${votersHtml}
        </div>
      `;

      // Vote on card click (excluding menu button, menu dropdown, or remove-vote button)
      el.addEventListener("click", async (e) => {
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

        const user = users.find(u => u.name.toLowerCase() === currentUsername.toLowerCase());
        if (!user) return;

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
        
        try {
          await supabase.from("cards").update({ votes: card.votes }).eq("id", card.id);
          await supabase.from("users").update({ voted_card_ids: user.votedCardIds }).eq("name", user.name);
          renderCards();
          updateUserBar();
        } catch (err) {
          console.error("Erro ao registrar voto:", err);
        }
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

        // Initialize edit image state
        editingImageDataUrl = card.imageDataUrl;
        if (editingImageDataUrl) {
          editPreviewImg.src = editingImageDataUrl;
          editImagePreview.hidden = false;
        } else {
          editPreviewImg.src = "";
          editImagePreview.hidden = true;
        }
        editImageInput.value = ""; // Reset file input

        editOverlay.hidden = false;
      });

      // Delete listener
      el.querySelector(".btn-delete-card").addEventListener("click", async (e) => {
        e.stopPropagation();
        menuDropdown.hidden = true;
        if (!confirm("Tem certeza de que deseja excluir este card?")) return;

        try {
          await supabase.from("cards").delete().eq("id", card.id);
          cards = cards.filter((c) => c.id !== card.id);
          delete imageCache[card.id];
          delete imageFetchPromises[card.id];
          renderCards();
        } catch (err) {
          console.error("Erro ao excluir card:", err);
        }
      });

      // Remove vote listener
      el.querySelector(".btn-remove-vote").addEventListener("click", async (e) => {
        e.stopPropagation();

        if (!currentUsername) {
          alert("Identifique-se primeiro no topo da página!");
          usernameInput.focus();
          return;
        }

        const user = users.find(u => u.name.toLowerCase() === currentUsername.toLowerCase());
        if (!user) return;
        const index = user.votedCardIds.indexOf(card.id);

        if (index === -1) {
          alert("Você não votou neste card, por isso não pode remover o voto!");
          return;
        }

        if (card.votes > 0) {
          card.votes--;
          user.votedCardIds.splice(index, 1);
          
          try {
            await supabase.from("cards").update({ votes: card.votes }).eq("id", card.id);
            await supabase.from("users").update({ voted_card_ids: user.votedCardIds }).eq("name", user.name);
            renderCards();
            updateUserBar();
          } catch (err) {
            console.error("Erro ao remover voto:", err);
          }
        }
      });

      cardsContainer.appendChild(el);
    });

    // Attach admin remove-voter click listeners
    const isAdmin = currentUsername && currentUsername.toLowerCase() === "lele";
    if (isAdmin) {
      cardsContainer.querySelectorAll(".btn-remove-voter").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const username = btn.dataset.username;
          const cardId = btn.dataset.cardid;

          const confirmRemove = confirm(`Remover o voto de ${username} neste card?`);
          if (!confirmRemove) return;

          const user = users.find(u => u.name.toLowerCase() === username.toLowerCase());
          const card = cards.find(c => c.id === cardId);

          if (user && card) {
            const index = user.votedCardIds.indexOf(card.id);
            if (index !== -1) {
              user.votedCardIds.splice(index, 1);
              if (card.votes > 0) {
                card.votes--;
              }
              try {
                await supabase.from("cards").update({ votes: card.votes }).eq("id", card.id);
                await supabase.from("users").update({ voted_card_ids: user.votedCardIds }).eq("name", user.name);
                renderCards();
                updateUserBar();
              } catch (err) {
                console.error("Erro ao remover voto pelo admin:", err);
              }
            }
          }
        });
      });
    }

    // Register placeholders with intersection observer
    if (imageObserver) {
      cardsContainer.querySelectorAll(".img-loading-placeholder").forEach((placeholder) => {
        imageObserver.observe(placeholder);
      });
    } else {
      // Fallback if IntersectionObserver is not supported
      cardsContainer.querySelectorAll(".img-loading-placeholder").forEach((placeholder) => {
        const cardId = placeholder.dataset.id;
        triggerImageFetch(cardId);
      });
    }
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

  function compressImageToWebp(file, maxWidth = 600, maxHeight = 600, quality = 0.7) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;

          // Resize if exceeding max dimensions
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to WebP format with quality compression
          const compressedDataUrl = canvas.toDataURL("image/webp", quality);
          resolve(compressedDataUrl);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  }

  // File input handler
  cardImageInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const dataUrl = await compressImageToWebp(file);
        showPreview(dataUrl);
      } catch (err) {
        console.error("Erro ao processar imagem:", err);
      }
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
          try {
            const dataUrl = await compressImageToWebp(file);
            if (!editOverlay.hidden) {
              showEditPreview(dataUrl);
            } else {
              showPreview(dataUrl);
            }
          } catch (err) {
            console.error("Erro ao colar imagem:", err);
          }
        }
        return;
      }
    }
  });

  removeCardPreview.addEventListener("click", clearPreview);

  // --- Add card ---
  addCardBtn.addEventListener("click", async () => {
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

    try {
      await supabase.from("cards").insert([{
        id: newCard.id,
        title: newCard.title,
        description: newCard.description,
        image_data_url: newCard.imageDataUrl,
        timestamp: newCard.timestamp,
        votes: newCard.votes
      }]);
      
      // Update local state and render (Real-time will also trigger, but this ensures immediate feedback)
      if (newCard.imageDataUrl) {
        imageCache[newCard.id] = newCard.imageDataUrl;
      } else {
        imageCache[newCard.id] = "none";
      }
      cards.push(newCard);
      renderCards();

      // Reset form
      cardTitleInput.value = "";
      cardDescInput.value = "";
      clearPreview();
    } catch (err) {
      console.error("Erro ao adicionar card:", err);
    }
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
  function showEditPreview(dataUrl) {
    editingImageDataUrl = dataUrl;
    editPreviewImg.src = dataUrl;
    editImagePreview.hidden = false;
  }

  function clearEditPreview() {
    editingImageDataUrl = null;
    editPreviewImg.src = "";
    editImagePreview.hidden = true;
    editImageInput.value = "";
  }

  editImageInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const dataUrl = await compressImageToWebp(file);
        showEditPreview(dataUrl);
      } catch (err) {
        console.error("Erro ao processar imagem de edição:", err);
      }
    }
  });

  removeEditImageBtn.addEventListener("click", clearEditPreview);

  saveEditBtn.addEventListener("click", async () => {
    const title = editTitleInput.value.trim();
    if (!title) {
      editTitleInput.focus();
      return;
    }
    const card = cards.find((c) => c.id === editingCardId);
    if (card) {
      card.title = title;
      card.description = editDescInput.value.trim() || null;
      card.imageDataUrl = editingImageDataUrl;

      // Update cache
      if (editingImageDataUrl) {
        imageCache[card.id] = editingImageDataUrl;
      } else {
        imageCache[card.id] = "none";
      }

      try {
        await supabase.from("cards").update({
          title: card.title,
          description: card.description,
          image_data_url: card.imageDataUrl
        }).eq("id", card.id);
        renderCards();
      } catch (err) {
        console.error("Erro ao editar card:", err);
      }
    }
    editOverlay.hidden = true;
    editingCardId = null;
    editingImageDataUrl = null;
  });

  cancelEditBtn.addEventListener("click", () => {
    editOverlay.hidden = true;
    editingCardId = null;
    editingImageDataUrl = null;
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
  loginBtn.addEventListener("click", async () => {
    const name = usernameInput.value.trim();
    if (!name) {
      usernameInput.focus();
      return;
    }
    currentUsername = name;
    await getOrCreateUser(currentUsername);
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

  clearVotesBtn.addEventListener("click", async () => {
    if (!currentUsername) return;

    const confirmClear = confirm("Tem certeza que deseja remover todos os seus votos? Esta ação não pode ser desfeita.");
    if (!confirmClear) return;

    const user = users.find(u => u.name.toLowerCase() === currentUsername.toLowerCase());
    if (!user) return;

    try {
      // Decrement vote counts on all cards the user voted for
      for (const cardId of user.votedCardIds) {
        const card = cards.find((c) => c.id === cardId);
        if (card && card.votes > 0) {
          card.votes--;
          await supabase.from("cards").update({ votes: card.votes }).eq("id", card.id);
        }
      }

      // Reset user votedCardIds
      user.votedCardIds = [];
      await supabase.from("users").update({ voted_card_ids: [] }).eq("name", user.name);

      updateUserBar();
      renderCards();
    } catch (err) {
      console.error("Erro ao limpar votos:", err);
    }
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
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.cards && data.users) {
          // Upsert cards in Supabase
          for (const c of data.cards) {
            if (c.imageDataUrl) {
              imageCache[c.id] = c.imageDataUrl;
            } else {
              imageCache[c.id] = "none";
            }
            await supabase.from("cards").upsert({
              id: c.id,
              title: c.title,
              description: c.description,
              image_data_url: c.imageDataUrl,
              timestamp: c.timestamp,
              votes: c.votes
            });
          }
          // Upsert users in Supabase
          for (const u of data.users) {
            await supabase.from("users").upsert({
              name: u.name,
              voted_card_ids: u.votedCardIds
            });
          }
          await loadCards();
          await loadUsers();
          renderCards();
          updateUserBar();
          alert("Backup importado com sucesso e sincronizado no banco de dados!");
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

  // --- Real-time Sync ---
  function handleRealtimeCardChange(payload) {
    const { eventType, new: newRow, old: oldRow } = payload;

    if (eventType === "INSERT") {
      if (!cards.some(c => c.id === newRow.id)) {
        const newCard = {
          id: newRow.id,
          title: newRow.title,
          description: newRow.description,
          timestamp: Number(newRow.timestamp),
          votes: newRow.votes
        };
        cards.push(newCard);
        if (newRow.image_data_url) {
          imageCache[newRow.id] = newRow.image_data_url;
        } else {
          imageCache[newRow.id] = "none";
        }
      }
    } else if (eventType === "UPDATE") {
      const card = cards.find(c => c.id === newRow.id);
      if (card) {
        // Detect if it was a metadata edit (title or description changed)
        const isEdit = card.title !== newRow.title || card.description !== newRow.description;

        card.title = newRow.title;
        card.description = newRow.description;
        card.timestamp = Number(newRow.timestamp);
        card.votes = newRow.votes;

        if (newRow.image_data_url) {
          if (imageCache[newRow.id] !== newRow.image_data_url) {
            imageCache[newRow.id] = newRow.image_data_url;
            card.imageDataUrl = newRow.image_data_url;
          }
        } else {
          // If image_data_url is null/undefined in the real-time update payload,
          // it could be because the image was deleted or because it is too large and was omitted.
          if (isEdit) {
            // Since it was edited, the image might have changed or been removed. Fetch from DB to verify.
            delete imageCache[newRow.id]; // Force re-fetch
            triggerImageFetch(newRow.id);
          }
          // If it was just a vote change, do not touch the image cache!
        }
      } else {
        // If it wasn't in our local state but was updated, add it
        const newCard = {
          id: newRow.id,
          title: newRow.title,
          description: newRow.description,
          timestamp: Number(newRow.timestamp),
          votes: newRow.votes
        };
        cards.push(newCard);
        if (newRow.image_data_url) {
          imageCache[newRow.id] = newRow.image_data_url;
        } else {
          imageCache[newRow.id] = "none";
        }
      }
    } else if (eventType === "DELETE") {
      cards = cards.filter(c => c.id !== oldRow.id);
      delete imageCache[oldRow.id];
      delete imageFetchPromises[oldRow.id];
    }

    renderCards();
  }

  function setupRealtime() {
    supabase
      .channel("public-db-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cards" },
        (payload) => {
          handleRealtimeCardChange(payload);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "users" },
        async () => {
          await loadUsers();
          updateUserBar();
        }
      )
      .subscribe();
  }

  // --- Init ---
  async function init() {
    await loadUsers();
    await loadCards();
    loadSession();
    if (currentUsername) {
      await getOrCreateUser(currentUsername);
    }
    updateUserBar();
    initImageObserver();
    renderCards();
    setupRealtime();
  }
  init();
})();
