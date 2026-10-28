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
  const addDropZone = document.getElementById("add-card-drop-zone");
  const cardTitleSuggestions = document.getElementById("card-title-suggestions");
  const cardReusedNotice = document.getElementById("card-reused-notice");
  const votingGalleryNormalView = document.getElementById("voting-gallery-normal-view");
  const untitledCurationSection = document.getElementById("untitled-curation-section");
  const curationImagesGrid = document.getElementById("curation-images-grid");
  const curationEmptyMsg = document.getElementById("curation-empty-msg");
  const refreshCurationBtn = document.getElementById("refresh-curation-btn");
  const bankImagesGrid = document.getElementById("bank-images-grid");
  const bankSearchInput = document.getElementById("bank-search-input");
  const bankCountEl = document.getElementById("bank-count");
  const bankEmptyMsg = document.getElementById("bank-empty-msg");
  const untitledExpanderBadge = document.getElementById("untitled-expander-badge");

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
  const editDropZone = document.getElementById("edit-card-drop-zone");
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

  // User Galleries Elements
  const galleryOwnerSelect = document.getElementById("gallery-owner-select");
  const galleryTabsContainer = document.getElementById("gallery-tabs-container");
  const createGalleryBtn = document.getElementById("create-gallery-btn");
  const createGalleryOverlay = document.getElementById("create-gallery-overlay");
  const newGalleryNameInput = document.getElementById("new-gallery-name-input");
  const newGalleryIconInput = document.getElementById("new-gallery-icon-input");
  const cancelCreateGalleryBtn = document.getElementById("cancel-create-gallery-btn");
  const confirmCreateGalleryBtn = document.getElementById("confirm-create-gallery-btn");
  const deleteCurrentGalleryBtn = document.getElementById("delete-current-gallery-btn");
  const votingGalleryTitle = document.getElementById("voting-gallery-title");

  let cards = [];
  let users = []; // each: { name, votedCardIds: [] }
  let currentUsername = null;
  let pendingImageDataUrl = null;
  let editingCardId = null;
  let editingImageDataUrl = null;

  // Multi-User Galleries State
  const DEFAULT_LELE_GALLERIES = [
    { owner: "lele", slug: "games", name: "Games", icon: "🎮" },
    { owner: "lele", slug: "anime", name: "Anime", icon: "🍿" },
    { owner: "lele", slug: "filmes", name: "Filmes", icon: "🎬" }
  ];

  let customGalleries = []; // Array of { owner, slug, name, icon }
  let currentGalleryOwner = "lele";
  let currentGallerySlug = "games";

  function getAllGalleries() {
    const list = [...DEFAULT_LELE_GALLERIES];
    customGalleries.forEach(cg => {
      const exists = list.some(g => g.owner.toLowerCase() === cg.owner.toLowerCase() && g.slug.toLowerCase() === cg.slug.toLowerCase());
      if (!exists) {
        list.push(cg);
      }
    });
    return list;
  }

  function getActiveGallery() {
    if (currentGallerySlug === "__curation_untitled__") {
      return { owner: "lele", slug: "__curation_untitled__", name: "Banco de Imagens", icon: "🖼️" };
    }
    const all = getAllGalleries();
    const found = all.find(g => g.owner.toLowerCase() === currentGalleryOwner.toLowerCase() && g.slug.toLowerCase() === currentGallerySlug.toLowerCase());
    if (found) return found;
    const fallback = all.find(g => g.owner.toLowerCase() === currentGalleryOwner.toLowerCase()) || all[0];
    if (fallback) {
      currentGalleryOwner = fallback.owner;
      currentGallerySlug = fallback.slug;
    }
    return fallback || DEFAULT_LELE_GALLERIES[0];
  }

  function cardBelongsToGallery(card, owner, slug) {
    const cid = card.id || "";
    const lowerOwner = (owner || "").toLowerCase();
    const lowerSlug = (slug || "").toLowerCase();

    if (lowerOwner === "lele") {
      if (lowerSlug === "games") {
        return !cid.startsWith("anime_") && !cid.startsWith("filmes_") && !cid.startsWith("u_");
      } else if (lowerSlug === "anime") {
        return cid.startsWith("anime_");
      } else if (lowerSlug === "filmes") {
        return cid.startsWith("filmes_");
      }
    }

    const prefix = `u_${lowerOwner}__${lowerSlug}_`;
    return cid.startsWith(prefix);
  }

  // Image cache and fetching state
  const imageCache = {}; // cardId -> base64 or 'none'
  const imageFetchPromises = {}; // cardId -> Promise
  let imageObserver = null;

  // Tab and form indicators
  const activeCategoryFormBadge = document.getElementById("active-category-form-badge");

  // --- User Profiles state persistence ---
  async function loadUsers() {
    try {
      const { data, error } = await supabase.from("users").select("*");
      if (error) throw error;
      
      const normalUsers = [];
      customGalleries = [];

      (data || []).forEach(u => {
        if (u.name.startsWith("__gallery_def__")) {
          // Parse saved gallery definition
          try {
            const rawJson = (u.voted_card_ids || []).join("");
            const parsed = JSON.parse(rawJson);
            if (parsed && parsed.owner && parsed.slug) {
              customGalleries.push(parsed);
            }
          } catch (e) {
            console.warn("Erro ao fazer parse da galeria customizada:", u.name, e);
          }
        } else {
          normalUsers.push({
            name: u.name,
            votedCardIds: u.voted_card_ids || []
          });
        }
      });

      users = normalUsers;
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

  function renderGalleriesNavigation() {
    const allGalleries = getAllGalleries();

    // 1. Gather distinct owners
    const ownersMap = new Map();
    // Ensure 'lele' is always first
    ownersMap.set("lele", 0);

    allGalleries.forEach(g => {
      const o = g.owner.toLowerCase();
      ownersMap.set(o, (ownersMap.get(o) || 0) + 1);
    });

    // Also include logged in user even if they haven't created any custom galleries yet
    if (currentUsername) {
      const curLower = currentUsername.toLowerCase();
      if (!ownersMap.has(curLower)) {
        ownersMap.set(curLower, 0);
      }
    }

    // Populate galleryOwnerSelect
    if (galleryOwnerSelect) {
      const prevOwner = currentGalleryOwner.toLowerCase();
      galleryOwnerSelect.innerHTML = "";

      const sortedOwners = Array.from(ownersMap.keys()).sort((a, b) => {
        if (a === "lele") return -1;
        if (b === "lele") return 1;
        return a.localeCompare(b);
      });

      sortedOwners.forEach(ownerKey => {
        const opt = document.createElement("option");
        opt.value = ownerKey;
        const count = allGalleries.filter(g => g.owner.toLowerCase() === ownerKey).length;
        const displayName = (ownerKey === "lele") ? "lele (Oficial)" : ownerKey;
        opt.textContent = `${displayName} (${count} ${count === 1 ? 'galeria' : 'galerias'})`;
        if (ownerKey === prevOwner) {
          opt.selected = true;
        }
        galleryOwnerSelect.appendChild(opt);
      });

      // Ensure currentGalleryOwner is valid
      if (!ownersMap.has(currentGalleryOwner.toLowerCase())) {
        currentGalleryOwner = sortedOwners[0] || "lele";
      }
    }

    // 2. Render gallery tabs for currentGalleryOwner
    if (galleryTabsContainer) {
      galleryTabsContainer.innerHTML = "";
      const ownerGalleries = allGalleries.filter(g => g.owner.toLowerCase() === currentGalleryOwner.toLowerCase());

      if (ownerGalleries.length === 0) {
        galleryTabsContainer.innerHTML = `
          <p style="color: var(--text-muted); font-size: 0.85rem; padding: 0.5rem 1rem; margin: 0;">
            Nenhuma galeria criada por este usuário ainda.
          </p>
        `;
      } else {
        // Ensure currentGallerySlug belongs to this owner (skip if in curation mode)
        if (currentGallerySlug !== "__curation_untitled__" && !ownerGalleries.some(g => g.slug.toLowerCase() === currentGallerySlug.toLowerCase())) {
          currentGallerySlug = ownerGalleries[0].slug;
        }

        ownerGalleries.forEach(g => {
          const btn = document.createElement("button");
          btn.type = "button";
          const isActive = (currentGallerySlug !== "__curation_untitled__" && g.slug.toLowerCase() === currentGallerySlug.toLowerCase());
          btn.className = "gallery-tab" + (isActive ? " active" : "");
          btn.dataset.owner = g.owner;
          btn.dataset.slug = g.slug;
          btn.innerHTML = `${g.icon || '📁'} ${escapeHtml(g.name)}`;
          btn.addEventListener("click", () => {
            currentGalleryOwner = g.owner;
            currentGallerySlug = g.slug;
            renderGalleriesNavigation();
            updateUserBar();
            renderCards();
          });
          galleryTabsContainer.appendChild(btn);
        });

        // Add exclusive Curation Tab for 'lele'
        if (currentGalleryOwner.toLowerCase() === "lele" || (currentUsername && currentUsername.toLowerCase() === "lele")) {
          const isCurating = (currentGallerySlug === "__curation_untitled__");
          const curBtn = document.createElement("button");
          curBtn.type = "button";
          curBtn.className = "gallery-tab gallery-tab--curation" + (isCurating ? " active" : "");
          curBtn.style.border = "1px dashed #ff9f43";
          curBtn.style.color = isCurating ? "#fff" : "#ff9f43";
          const countDisplay = bankItemsCache ? bankItems.length : "...";
          curBtn.innerHTML = `🖼️ Banco de Imagens <span id="bank-tab-badge" style="background:#ff9f43; color:#000; font-size:0.75rem; font-weight:800; padding: 2px 6px; border-radius: 10px; margin-left: 4px;">${countDisplay}</span>`;
          curBtn.addEventListener("click", () => {
            currentGalleryOwner = "lele";
            currentGallerySlug = "__curation_untitled__";
            renderGalleriesNavigation();
            updateUserBar();
            renderCards();
          });
          galleryTabsContainer.appendChild(curBtn);
          updateUntitledCountBadge();
        }
      }
    }

    // 3. Update Delete Gallery Button visibility
    if (deleteCurrentGalleryBtn) {
      if (currentGallerySlug === "__curation_untitled__") {
        deleteCurrentGalleryBtn.style.display = "none";
      } else {
        const activeG = getActiveGallery();
        const isDefault = activeG.owner.toLowerCase() === "lele" && ["games", "anime", "filmes"].includes(activeG.slug.toLowerCase());
        const canDelete = !isDefault && currentUsername && (
          currentUsername.toLowerCase() === "lele" ||
          currentUsername.toLowerCase() === activeG.owner.toLowerCase()
        );
        deleteCurrentGalleryBtn.style.display = canDelete ? "inline-block" : "none";
      }
    }

    // 4. Update Header Title
    if (votingGalleryTitle) {
      if (currentGallerySlug === "__curation_untitled__") {
        votingGalleryTitle.textContent = `🖼️ Banco de Imagens`;
      } else {
        const activeG = getActiveGallery();
        votingGalleryTitle.textContent = `${activeG.icon || '📁'} Galeria de ${activeG.name} (${activeG.owner})`;
      }
    }

    // 5. Update Form Badge
    if (activeCategoryFormBadge) {
      if (currentGallerySlug === "__curation_untitled__") {
        activeCategoryFormBadge.textContent = `Banco de Imagens`;
      } else {
        const activeG = getActiveGallery();
        activeCategoryFormBadge.textContent = `${activeG.name} (${activeG.owner})`;
      }
    }
  }

  function updateUserBar() {
    if (currentUsername) {
      userLoginForm.style.display = "none";
      userProfileStatus.style.display = "flex";
      activeUsername.textContent = currentUsername;

      const user = users.find(u => u.name.toLowerCase() === currentUsername.toLowerCase());
      
      // Calculate active gallery specific votes
      let categoryVotes = 0;
      if (user && Array.isArray(user.votedCardIds)) {
        categoryVotes = user.votedCardIds.filter(id => {
          return cardBelongsToGallery({ id }, currentGalleryOwner, currentGallerySlug);
        }).length;
      }
      activeUserVotes.textContent = categoryVotes;

      // O Banco de Imagens não tem votação
      const votesStatusEl = activeUserVotes.closest(".user-votes-status");
      if (votesStatusEl) votesStatusEl.style.display = currentGallerySlug === "__curation_untitled__" ? "none" : "";

      const categoryLabelEl = document.getElementById("active-user-votes-category");
      if (categoryLabelEl) {
        const activeG = getActiveGallery();
        categoryLabelEl.textContent = `${activeG.name}`;
      }
    } else {
      userLoginForm.style.display = "flex";
      userProfileStatus.style.display = "none";
      usernameInput.value = "";
    }
    renderUsers();
  }

  // A lista de usuários agora vive no painel global (users-panel.js).
  // Aqui só publicamos a galeria ativa para o painel mostrar os votos dela.
  function renderUsers() {
    const g = getActiveGallery();
    try {
      localStorage.setItem("roleta-nmdp-panel-gallery", JSON.stringify({ owner: g.owner, slug: g.slug, name: g.name }));
    } catch (e) {}
    window.dispatchEvent(new CustomEvent("roleta:gallery"));
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

  async function fetchCardImage(cardId) {
    if (imageCache[cardId] && imageCache[cardId] !== "none") return imageCache[cardId];
    await triggerImageFetch(cardId);
    return imageCache[cardId] || "none";
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
    if (currentGallerySlug === "__curation_untitled__") {
      if (votingGalleryNormalView) votingGalleryNormalView.style.display = "none";
      if (untitledCurationSection) untitledCurationSection.style.display = "flex";
      loadAndRenderUntitledCuration();
      return;
    }

    if (votingGalleryNormalView) votingGalleryNormalView.style.display = "block";
    if (untitledCurationSection) untitledCurationSection.style.display = "none";

    const sortMode = cardSortSelect.value;
    const activeG = getActiveGallery();

    // Filter cards by active gallery (owner + slug)
    const categoryCards = cards.filter(c => {
      return cardBelongsToGallery(c, activeG.owner, activeG.slug);
    });

    const sorted = [...categoryCards];

    if (sortMode === "votes") {
      sorted.sort((a, b) => b.votes - a.votes);
    } else {
      sorted.sort((a, b) => b.timestamp - a.timestamp);
    }

    cardsContainer.innerHTML = "";

    if (sorted.length === 0) {
      cardsEmptyMsg.hidden = false;
      cardsEmptyMsg.textContent = `Nenhum card adicionado ainda na galeria "${activeG.name}" (${activeG.owner}). Crie o primeiro acima!`;
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

        // Check if 20 votes limit reached for active gallery
        const activeG = getActiveGallery();
        const galleryVotesCount = user.votedCardIds.filter(id => {
          return cardBelongsToGallery({ id }, activeG.owner, activeG.slug);
        }).length;

        if (galleryVotesCount >= 20) {
          alert(`Você já esgotou seu limite de 20 votos para a galeria ${activeG.name} (${activeG.owner})!`);
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
    if (cardReusedNotice) cardReusedNotice.style.display = "none";
  }

  // --- Card Title Autocomplete & Duplicate Prevention ---
  let titleSuggestionTimeout = null;
  if (cardTitleInput) {
    cardTitleInput.addEventListener("input", () => {
      clearTimeout(titleSuggestionTimeout);
      titleSuggestionTimeout = setTimeout(renderTitleSuggestions, 120);
    });

    cardTitleInput.addEventListener("focus", () => {
      if (cardTitleInput.value.trim().length >= 1) {
        renderTitleSuggestions();
      }
    });

    cardTitleInput.addEventListener("keydown", (e) => {
      if (!cardTitleSuggestions || cardTitleSuggestions.hidden) return;
      const items = cardTitleSuggestions.querySelectorAll(".suggestion-item");
      if (items.length === 0) return;
      const activeItem = cardTitleSuggestions.querySelector(".suggestion-item.active");
      let activeIndex = Array.from(items).indexOf(activeItem);

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (activeItem) activeItem.classList.remove("active");
        activeIndex = (activeIndex + 1) % items.length;
        items[activeIndex].classList.add("active");
        items[activeIndex].scrollIntoView({ block: "nearest" });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (activeItem) activeItem.classList.remove("active");
        activeIndex = (activeIndex - 1 + items.length) % items.length;
        items[activeIndex].classList.add("active");
        items[activeIndex].scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter" && activeItem) {
        e.preventDefault();
        activeItem.dispatchEvent(new MouseEvent("mousedown"));
      } else if (e.key === "Escape") {
        cardTitleSuggestions.hidden = true;
      }
    });
  }

  async function renderTitleSuggestions() {
    if (!cardTitleSuggestions || !cardTitleInput) return;
    const query = cardTitleInput.value.trim().toLowerCase();
    if (query.length < 1) {
      cardTitleSuggestions.innerHTML = "";
      cardTitleSuggestions.hidden = true;
      return;
    }

    // Filter matching cards (limit 8, unique by title)
    const matches = [];
    const seenTitles = new Set();
    for (const c of cards) {
      if (!c.title) continue;
      const tLower = c.title.toLowerCase();
      if (tLower.includes(query) && !seenTitles.has(tLower)) {
        seenTitles.add(tLower);
        matches.push(c);
        if (matches.length >= 8) break;
      }
    }

    if (matches.length === 0) {
      cardTitleSuggestions.innerHTML = "";
      cardTitleSuggestions.hidden = true;
      return;
    }

    cardTitleSuggestions.innerHTML = "";
    matches.forEach(card => {
      const item = document.createElement("div");
      item.className = "suggestion-item";

      const thumb = document.createElement("img");
      thumb.className = "suggestion-thumb";
      if (imageCache[card.id] && imageCache[card.id] !== "none") {
        thumb.src = imageCache[card.id];
      } else {
        thumb.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' fill='%23222'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='16' fill='%23666'%3E🖼️%3C/text%3E%3C/svg%3E";
        fetchCardImage(card.id).then(url => {
          if (url && url !== "none") thumb.src = url;
        });
      }

      const info = document.createElement("div");
      info.className = "suggestion-info";

      const titleEl = document.createElement("div");
      titleEl.className = "suggestion-title";
      const idx = card.title.toLowerCase().indexOf(query);
      if (idx !== -1) {
        const before = card.title.substring(0, idx);
        const match = card.title.substring(idx, idx + query.length);
        const after = card.title.substring(idx + query.length);
        titleEl.innerHTML = `${escapeHtml(before)}<strong style="color:var(--accent); text-decoration:underline;">${escapeHtml(match)}</strong>${escapeHtml(after)}`;
      } else {
        titleEl.textContent = card.title;
      }

      const meta = document.createElement("div");
      meta.className = "suggestion-meta";
      meta.textContent = `Card existente (${card.votes || 0} votos)`;

      info.appendChild(titleEl);
      info.appendChild(meta);
      item.appendChild(thumb);
      item.appendChild(info);

      item.addEventListener("mousedown", async (e) => {
        e.preventDefault();
        cardTitleInput.value = card.title;
        if (card.description && cardDescInput) {
          cardDescInput.value = card.description;
        }

        let imgSrc = imageCache[card.id];
        if (!imgSrc || imgSrc === "none") {
          imgSrc = await fetchCardImage(card.id);
        }
        if (imgSrc && imgSrc !== "none") {
          showPreview(imgSrc);
          if (cardReusedNotice) cardReusedNotice.style.display = "flex";
        }

        cardTitleSuggestions.innerHTML = "";
        cardTitleSuggestions.hidden = true;
      });

      cardTitleSuggestions.appendChild(item);
    });

    cardTitleSuggestions.hidden = false;
  }

  document.addEventListener("click", (e) => {
    if (cardTitleSuggestions && !cardTitleSuggestions.contains(e.target) && e.target !== cardTitleInput) {
      cardTitleSuggestions.hidden = true;
    }
  });

  function setupDragAndDrop(dropZone, fileInput, onImageProcessed) {
    if (!dropZone || !fileInput) return;

    // Clicking triggers file input
    dropZone.addEventListener("click", (e) => {
      if (e.target !== fileInput) {
        fileInput.click();
      }
    });

    // Drag events
    ["dragenter", "dragover"].forEach((eventName) => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add("dragover");
      }, false);
    });

    ["dragleave", "drop"].forEach((eventName) => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove("dragover");
      }, false);
    });

    // Handle dropped files
    dropZone.addEventListener("drop", async (e) => {
      const dt = e.dataTransfer;
      const file = dt.files[0];
      if (file && file.type.startsWith("image/")) {
        try {
          const dataUrl = await compressImageToWebp(file);
          onImageProcessed(dataUrl);
        } catch (err) {
          console.error("Erro ao processar imagem arrastada:", err);
        }
      }
    });
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
    const activeG = getActiveGallery();

    let generatedId = generateId();
    const lowerOwner = (activeG.owner || "").toLowerCase();
    const lowerSlug = (activeG.slug || "").toLowerCase();

    if (lowerOwner === "lele") {
      if (lowerSlug === "anime") {
        generatedId = `anime_${generatedId}`;
      } else if (lowerSlug === "filmes") {
        generatedId = `filmes_${generatedId}`;
      } else if (lowerSlug !== "games") {
        generatedId = `u_${lowerOwner}__${lowerSlug}_${generatedId}`;
      }
      // games keeps plain ID for backward compatibility
    } else {
      generatedId = `u_${lowerOwner}__${lowerSlug}_${generatedId}`;
    }

    const newCard = {
      id: generatedId,
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
    currentGalleryOwner = currentUsername;
    saveSession();
    renderGalleriesNavigation();
    updateUserBar();
    renderCards();
  });

  logoutBtn.addEventListener("click", () => {
    currentUsername = null;
    currentGalleryOwner = "lele";
    currentGallerySlug = "games";
    saveSession();
    renderGalleriesNavigation();
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
          renderGalleriesNavigation();
          updateUserBar();
        }
      )
      .subscribe();
  }

  // --- Gallery Creation & Management Handlers ---
  if (galleryOwnerSelect) {
    galleryOwnerSelect.addEventListener("change", () => {
      currentGalleryOwner = galleryOwnerSelect.value;
      renderGalleriesNavigation();
      updateUserBar();
      renderCards();
    });
  }

  if (createGalleryBtn) {
    createGalleryBtn.addEventListener("click", () => {
      if (!currentUsername) {
        alert("Por favor, identifique-se com seu nome no topo da página antes de criar uma galeria!");
        usernameInput.focus();
        return;
      }
      newGalleryNameInput.value = "";
      newGalleryIconInput.value = "📁";
      if (createGalleryOverlay) createGalleryOverlay.hidden = false;
      newGalleryNameInput.focus();
    });
  }

  if (cancelCreateGalleryBtn) {
    cancelCreateGalleryBtn.addEventListener("click", () => {
      if (createGalleryOverlay) createGalleryOverlay.hidden = true;
    });
  }

  // Quick select emoji buttons
  document.querySelectorAll(".emoji-choice-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (newGalleryIconInput) {
        newGalleryIconInput.value = btn.textContent.trim();
      }
    });
  });

  if (confirmCreateGalleryBtn) {
    confirmCreateGalleryBtn.addEventListener("click", async () => {
      const name = newGalleryNameInput.value.trim();
      if (!name) {
        newGalleryNameInput.focus();
        return;
      }

      const icon = (newGalleryIconInput.value.trim()) || "📁";
      const slug = name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "");

      if (!slug) {
        alert("Nome de galeria inválido.");
        return;
      }

      const owner = currentUsername.trim();
      const allG = getAllGalleries();
      const exists = allG.some(g => g.owner.toLowerCase() === owner.toLowerCase() && g.slug.toLowerCase() === slug.toLowerCase());
      if (exists) {
        alert("Você já possui uma galeria com este nome/slug!");
        return;
      }

      const newGalleryDef = {
        owner: owner,
        slug: slug,
        name: name,
        icon: icon
      };

      confirmCreateGalleryBtn.disabled = true;
      confirmCreateGalleryBtn.textContent = "Criando...";

      try {
        const recordName = `__gallery_def__${owner.toLowerCase()}__${slug}`;
        const jsonPayload = JSON.stringify(newGalleryDef);

        const { error } = await supabase.from("users").upsert({
          name: recordName,
          voted_card_ids: [jsonPayload]
        });

        if (error) throw error;

        customGalleries.push(newGalleryDef);
        currentGalleryOwner = owner;
        currentGallerySlug = slug;

        if (createGalleryOverlay) createGalleryOverlay.hidden = true;
        renderGalleriesNavigation();
        updateUserBar();
        renderCards();
      } catch (err) {
        console.error("Erro ao salvar nova galeria:", err);
        alert("Erro ao criar galeria: " + (err.message || err));
      } finally {
        confirmCreateGalleryBtn.disabled = false;
        confirmCreateGalleryBtn.textContent = "Criar Galeria";
      }
    });
  }

  // Delete current custom gallery
  if (deleteCurrentGalleryBtn) {
    deleteCurrentGalleryBtn.addEventListener("click", async () => {
      const activeG = getActiveGallery();
      const isDefault = activeG.owner.toLowerCase() === "lele" && ["games", "anime", "filmes"].includes(activeG.slug.toLowerCase());
      if (isDefault) {
        alert("As galerias oficiais padrão não podem ser excluídas.");
        return;
      }

      const confirmDel = confirm(`Tem certeza de que deseja excluir a galeria "${activeG.name}" (${activeG.owner}) e todos os cards nela?`);
      if (!confirmDel) return;

      deleteCurrentGalleryBtn.disabled = true;
      deleteCurrentGalleryBtn.textContent = "Excluindo...";

      try {
        // 1. Delete all cards belonging to this gallery
        const toDelete = cards.filter(c => cardBelongsToGallery(c, activeG.owner, activeG.slug));
        for (const card of toDelete) {
          await supabase.from("cards").delete().eq("id", card.id);
          delete imageCache[card.id];
          delete imageFetchPromises[card.id];
        }
        cards = cards.filter(c => !cardBelongsToGallery(c, activeG.owner, activeG.slug));

        // 2. Delete gallery record from users table
        const recordName = `__gallery_def__${activeG.owner.toLowerCase()}__${activeG.slug.toLowerCase()}`;
        await supabase.from("users").delete().eq("name", recordName);

        customGalleries = customGalleries.filter(g => !(g.owner.toLowerCase() === activeG.owner.toLowerCase() && g.slug.toLowerCase() === activeG.slug.toLowerCase()));

        // 3. Fallback to lele / games
        currentGalleryOwner = "lele";
        currentGallerySlug = "games";

        renderGalleriesNavigation();
        updateUserBar();
        renderCards();
      } catch (err) {
        console.error("Erro ao excluir galeria:", err);
        alert("Erro ao excluir galeria: " + (err.message || err));
      } finally {
        deleteCurrentGalleryBtn.disabled = false;
        deleteCurrentGalleryBtn.textContent = "🗑️ Excluir Galeria";
      }
    });
  }

  // --- Image Bank (Exclusive for user 'lele') ---
  // Todas as imagens do sistema (cards + itens de tier list). As sem título
  // aparecem também na seção expansível de curadoria.
  let bankItems = [];
  let bankItemsCache = null; // { at, items }
  const BANK_CACHE_MS = 20000;
  let cachedUntitledItems = [];
  let bankObserver = null;

  function isUntitledTitle(title) {
    const t = (title || "").trim().toLowerCase();
    return !t ||
      t.startsWith("image.") ||
      t.startsWith("image_") ||
      t === "item sem título" ||
      t === "sem titulo" ||
      t === "sem título";
  }

  function normalizeSearch(str) {
    return (str || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  function describeCardGallery(cardId) {
    const cid = cardId || "";
    if (cid.startsWith("anime_")) return "Anime (lele)";
    if (cid.startsWith("filmes_")) return "Filmes (lele)";
    const m = /^u_(.+?)__(.+?)_[a-z0-9]+$/i.exec(cid);
    if (cid.startsWith("u_") && m) return `${m[2]} (${m[1]})`;
    return "Games (lele)";
  }

  async function fetchAllBankItems(force = false) {
    if (!force && bankItemsCache && Date.now() - bankItemsCache.at < BANK_CACHE_MS) {
      return bankItemsCache.items;
    }

    const items = [];
    const cardEntryById = new Map();
    const entryBySrc = new Map();

    // 1. Cards in memory
    cards.forEach(card => {
      const src = card.imageDataUrl || imageCache[card.id] || null;
      const entry = {
        type: "card",
        cardId: card.id,
        src: (src && src !== "none") ? src : null,
        title: card.title || "",
        sourceDesc: `Card na Galeria (${card.id})`,
        galleryLabel: describeCardGallery(card.id)
      };
      items.push(entry);
      cardEntryById.set(card.id, entry);
      if (entry.src) entryBySrc.set(entry.src, entry);
    });

    // 2. Tier lists from Supabase
    try {
      const { data: tls, error } = await supabase.from("tier_lists").select("id, title, tiers, bank, row_metadata");
      if (!error && Array.isArray(tls)) {
        tls.forEach(tl => {
          const metaUnvoted = (tl.row_metadata || []).find(m => m && m.unvoted_bank)?.unvoted_bank || [];
          const allItems = [...(tl.tiers || []).flatMap(t => t.items || []), ...(tl.bank || []), ...metaUnvoted];

          allItems.forEach(item => {
            if (!item || !item.src) return;
            const ref = { tlId: tl.id, tlTitle: tl.title, itemId: item.id };

            // Item importado de um card: agrupa no mesmo registro do card
            const fromCard = (item.id || "").startsWith("item-") ? cardEntryById.get(item.id.slice(5)) : null;
            const existing = fromCard || entryBySrc.get(item.src);

            if (existing) {
              if (!existing.src) {
                existing.src = item.src;
                entryBySrc.set(item.src, existing);
              }
              if (isUntitledTitle(existing.title) && !isUntitledTitle(item.title)) {
                existing.title = item.title;
              }
              if (!existing.tierListRefs) existing.tierListRefs = [];
              if (!existing.tierListRefs.some(r => r.tlId === tl.id && r.itemId === item.id)) {
                existing.tierListRefs.push(ref);
              }
              return;
            }

            const entry = {
              type: "tier_item",
              src: item.src,
              title: item.title || "",
              sourceDesc: `Tier List: "${tl.title}"`,
              tierListRefs: [ref]
            };
            items.push(entry);
            entryBySrc.set(item.src, entry);
          });
        });
      }
    } catch (e) {
      console.warn("Erro ao buscar itens de tier list para o banco de imagens:", e);
    }

    bankItemsCache = { at: Date.now(), items };
    return items;
  }

  function updateBankBadges() {
    const total = bankItems.length;
    const untitled = bankItems.filter(i => isUntitledTitle(i.title)).length;
    const tabBadge = document.getElementById("bank-tab-badge");
    if (tabBadge) tabBadge.textContent = total;
    if (untitledExpanderBadge) {
      untitledExpanderBadge.textContent = untitled;
      untitledExpanderBadge.style.display = untitled > 0 ? "inline-block" : "none";
    }
  }

  async function updateUntitledCountBadge() {
    try {
      bankItems = await fetchAllBankItems();
      updateBankBadges();
    } catch (e) {
      const tabBadge = document.getElementById("bank-tab-badge");
      if (tabBadge) tabBadge.textContent = "0";
    }
  }

  function bankTileSourceText(item) {
    const parts = [];
    if (item.galleryLabel) parts.push(item.galleryLabel);
    if (item.tierListRefs && item.tierListRefs.length === 1) {
      parts.push(`Tier List: ${item.tierListRefs[0].tlTitle}`);
    } else if (item.tierListRefs && item.tierListRefs.length > 1) {
      parts.push(`${item.tierListRefs.length} Tabuleiros`);
    }
    return parts.join(" • ") || item.sourceDesc || "";
  }

  function renderBankGrid() {
    if (!bankImagesGrid) return;
    if (bankObserver) {
      bankObserver.disconnect();
      bankObserver = null;
    }
    bankImagesGrid.innerHTML = "";

    const query = normalizeSearch(bankSearchInput ? bankSearchInput.value.trim() : "");
    const filtered = bankItems.filter(item => {
      if (!query) return true;
      return normalizeSearch(item.title).includes(query);
    });

    // Com título em ordem alfabética; sem título ao final
    filtered.sort((a, b) => {
      const au = isUntitledTitle(a.title), bu = isUntitledTitle(b.title);
      if (au !== bu) return au ? 1 : -1;
      return (a.title || "").localeCompare(b.title || "", "pt-BR");
    });

    if (bankCountEl) {
      bankCountEl.textContent = query
        ? `${filtered.length} de ${bankItems.length} imagens`
        : `${bankItems.length} ${bankItems.length === 1 ? "imagem" : "imagens"}`;
    }
    if (bankEmptyMsg) bankEmptyMsg.style.display = filtered.length === 0 ? "block" : "none";

    if ("IntersectionObserver" in window) {
      bankObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          bankObserver.unobserve(entry.target);
          if (entry.target._loadImage) entry.target._loadImage();
        });
      }, { rootMargin: "300px 0px", threshold: 0.01 });
    }

    filtered.forEach(item => {
      const untitled = isUntitledTitle(item.title);
      const tile = document.createElement("div");
      tile.className = "bank-tile";
      tile.title = untitled ? "Sem título" : item.title;

      const imgWrap = document.createElement("div");
      imgWrap.className = "bank-tile__img";
      const img = document.createElement("img");
      img.alt = item.title || "Imagem sem título";
      img.loading = "lazy";
      imgWrap.appendChild(img);

      const titleEl = document.createElement("div");
      titleEl.className = "bank-tile__title" + (untitled ? " bank-tile__title--untitled" : "");
      titleEl.textContent = untitled ? "Sem título" : item.title;

      const sourceEl = document.createElement("div");
      sourceEl.className = "bank-tile__source";
      sourceEl.textContent = bankTileSourceText(item);

      const actionsEl = document.createElement("div");
      actionsEl.className = "bank-tile__actions";

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "bank-tile__btn";
      editBtn.textContent = "✏️ Editar";
      editBtn.title = "Editar o nome desta imagem";

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "bank-tile__btn bank-tile__btn--danger";
      deleteBtn.textContent = "🗑️ Deletar";
      deleteBtn.title = "Deletar esta imagem de todos os bancos de dados";

      actionsEl.appendChild(editBtn);
      actionsEl.appendChild(deleteBtn);

      editBtn.addEventListener("click", () => {
        // Troca o título por um campo de edição na própria miniatura
        const form = document.createElement("div");
        form.className = "bank-tile__edit";
        const input = document.createElement("input");
        input.type = "text";
        input.className = "bank-tile__input";
        input.value = untitled ? "" : item.title;
        input.placeholder = "Novo nome...";
        const okBtn = document.createElement("button");
        okBtn.type = "button";
        okBtn.className = "bank-tile__btn bank-tile__btn--ok";
        okBtn.textContent = "✓";
        okBtn.title = "Salvar nome";
        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.className = "bank-tile__btn";
        cancelBtn.textContent = "✕";
        cancelBtn.title = "Cancelar";
        form.appendChild(input);
        form.appendChild(okBtn);
        form.appendChild(cancelBtn);

        titleEl.style.display = "none";
        actionsEl.style.display = "none";
        tile.insertBefore(form, sourceEl);
        input.focus();
        input.select();

        const closeForm = () => {
          form.remove();
          titleEl.style.display = "";
          actionsEl.style.display = "";
        };

        let saving = false;
        const save = async () => {
          if (saving) return;
          const newTitle = input.value.trim();
          if (!newTitle) {
            input.focus();
            input.style.borderColor = "#ff7675";
            setTimeout(() => { input.style.borderColor = ""; }, 1500);
            return;
          }
          if (newTitle === item.title) {
            closeForm();
            return;
          }
          saving = true;
          okBtn.disabled = true;
          okBtn.textContent = "…";
          try {
            await renameBankItem(item, newTitle);
            refreshBankViews();
          } catch (err) {
            console.error("Erro ao renomear imagem:", err);
            alert("Erro ao salvar o nome: " + (err.message || err));
            saving = false;
            okBtn.disabled = false;
            okBtn.textContent = "✓";
          }
        };

        okBtn.addEventListener("click", save);
        cancelBtn.addEventListener("click", closeForm);
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          } else if (e.key === "Escape") {
            e.stopPropagation();
            closeForm();
          }
        });
      });

      deleteBtn.addEventListener("click", async () => {
        const label = untitled ? "esta imagem" : `"${item.title}"`;
        const places = [];
        if (item.cardId) places.push("a galeria de cards");
        if (item.tierListRefs && item.tierListRefs.length > 0) {
          places.push(`${item.tierListRefs.length} ${item.tierListRefs.length === 1 ? "tabuleiro" : "tabuleiros"} da Tier List`);
        }
        const where = places.length ? ` (${places.join(" e ")})` : "";
        if (!confirm(`Deseja realmente deletar ${label} permanentemente de todos os bancos de dados${where}? Esta ação não pode ser desfeita.`)) return;

        deleteBtn.disabled = true;
        editBtn.disabled = true;
        deleteBtn.textContent = "Deletando...";
        try {
          await deleteBankItem(item);
          tile.style.transition = "all 0.3s ease";
          tile.style.opacity = "0";
          tile.style.transform = "scale(0.85)";
          setTimeout(refreshBankViews, 300);
        } catch (err) {
          console.error("Erro ao deletar imagem:", err);
          alert("Erro ao deletar imagem: " + (err.message || err));
          deleteBtn.disabled = false;
          editBtn.disabled = false;
          deleteBtn.textContent = "🗑️ Deletar";
        }
      });

      tile.appendChild(imgWrap);
      tile.appendChild(titleEl);
      tile.appendChild(sourceEl);
      tile.appendChild(actionsEl);
      bankImagesGrid.appendChild(tile);

      if (item.src) {
        img.src = item.src;
      } else if (item.cardId) {
        // Imagem do card é baixada só quando o item aparece na tela
        tile._loadImage = () => {
          fetchCardImage(item.cardId).then(src => {
            if (src && src !== "none") {
              img.src = src;
              item.src = src;
            }
          });
        };
        if (bankObserver) bankObserver.observe(tile);
        else tile._loadImage();
      }
    });
  }

  if (bankSearchInput) {
    let bankSearchTimer = null;
    bankSearchInput.addEventListener("input", () => {
      clearTimeout(bankSearchTimer);
      bankSearchTimer = setTimeout(renderBankGrid, 150);
    });
  }

  // Atualiza o título de um item do banco: card (se houver) e cada tabuleiro onde ele aparece.
  // Diferente da curadoria, não cria cards novos.
  async function renameBankItem(item, newTitle) {
    if (item.cardId) {
      const { error } = await supabase.from("cards").update({ title: newTitle }).eq("id", item.cardId);
      if (error) throw error;
      const foundCard = cards.find(c => c.id === item.cardId);
      if (foundCard) foundCard.title = newTitle;
    }

    for (const ref of (item.tierListRefs || [])) {
      const { data: tlData, error: tlErr } = await supabase
        .from("tier_lists")
        .select("tiers, bank, row_metadata")
        .eq("id", ref.tlId)
        .single();
      if (tlErr || !tlData) continue;

      const matches = (i) => i && (i.src === item.src || i.id === ref.itemId);
      const tiers = tlData.tiers || [];
      const bank = tlData.bank || [];
      const row_metadata = tlData.row_metadata || [];

      tiers.forEach(t => (t.items || []).forEach(i => { if (matches(i)) i.title = newTitle; }));
      bank.forEach(i => { if (matches(i)) i.title = newTitle; });
      row_metadata.forEach(m => {
        if (m && Array.isArray(m.unvoted_bank)) m.unvoted_bank.forEach(i => { if (matches(i)) i.title = newTitle; });
      });

      const { error: upErr } = await supabase.from("tier_lists").update({
        tiers, bank, row_metadata, updated_at: new Date().toISOString()
      }).eq("id", ref.tlId);
      if (upErr) throw upErr;
    }

    item.title = newTitle;
  }

  // Remove o item de todos os bancos: cards e tabuleiros da Tier List.
  async function deleteBankItem(item) {
    if (item.cardId) {
      const { error } = await supabase.from("cards").delete().eq("id", item.cardId);
      if (error) throw error;
      delete imageCache[item.cardId];
      delete imageFetchPromises[item.cardId];
      cards = cards.filter(c => c.id !== item.cardId);
    }
    if (item.src) {
      const sameImage = cards.filter(c => c.imageDataUrl && c.imageDataUrl === item.src);
      for (const mc of sameImage) {
        await supabase.from("cards").delete().eq("id", mc.id);
        delete imageCache[mc.id];
        delete imageFetchPromises[mc.id];
        cards = cards.filter(c => c.id !== mc.id);
      }
    }

    for (const ref of (item.tierListRefs || [])) {
      const { data: tlData, error: tlErr } = await supabase
        .from("tier_lists")
        .select("tiers, bank, row_metadata")
        .eq("id", ref.tlId)
        .single();
      if (tlErr || !tlData) continue;

      const keep = (i) => !(i && (i.src === item.src || i.id === ref.itemId));
      const tiers = tlData.tiers || [];
      const row_metadata = tlData.row_metadata || [];
      tiers.forEach(t => { if (Array.isArray(t.items)) t.items = t.items.filter(keep); });
      const bank = (tlData.bank || []).filter(keep);
      row_metadata.forEach(m => {
        if (m && Array.isArray(m.unvoted_bank)) m.unvoted_bank = m.unvoted_bank.filter(keep);
      });
      // Mantém a contagem por linha dos metadados em dia
      tiers.forEach((t, idx) => {
        const meta = row_metadata[idx];
        if (meta && typeof meta.count === "number" && meta.name === t.name) meta.count = (t.items || []).length;
      });

      const { error: upErr } = await supabase.from("tier_lists").update({
        tiers, bank, row_metadata, updated_at: new Date().toISOString()
      }).eq("id", ref.tlId);
      if (upErr) throw upErr;
    }

    const idx = bankItems.indexOf(item);
    if (idx >= 0) bankItems.splice(idx, 1);
  }

  function refreshBankViews() {
    if (bankItemsCache) bankItemsCache.at = Date.now();
    updateBankBadges();
    renderBankGrid();
    loadAndRenderUntitledCuration(false, true);
  }

  async function loadAndRenderUntitledCuration(force = false, quiet = false) {
    if (!curationImagesGrid) return;
    if (!quiet) {
      curationImagesGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
          <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">🔍 Varrendo banco de dados e tabuleiros...</p>
          <span style="font-size: 0.85rem;">Localizando imagens do sistema</span>
        </div>
      `;
      if (curationEmptyMsg) curationEmptyMsg.style.display = "none";
      if (bankImagesGrid) bankImagesGrid.innerHTML = "";
    }

    bankItems = await fetchAllBankItems(force);
    const items = bankItems.filter(i => isUntitledTitle(i.title));
    cachedUntitledItems = items;
    updateBankBadges();
    renderBankGrid();

    curationImagesGrid.innerHTML = "";
    if (items.length === 0) {
      if (curationEmptyMsg) curationEmptyMsg.style.display = "block";
      return;
    }

    items.forEach((item, index) => {
      const cardEl = document.createElement("div");
      cardEl.className = "curation-card";
      cardEl.id = `curation-card-${index}`;

      const imgWrap = document.createElement("div");
      imgWrap.className = "curation-img-wrap";

      const img = document.createElement("img");
      if (item.src) {
        img.src = item.src;
      } else if (item.cardId) {
        img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Crect width='120' height='120' fill='%23222'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='24' fill='%23666'%3E🖼️%3C/text%3E%3C/svg%3E";
        fetchCardImage(item.cardId).then(src => {
          if (src && src !== "none") {
            img.src = src;
            item.src = src;
          }
        });
      }
      img.alt = "Imagem sem título";
      imgWrap.appendChild(img);

      const sourceBadge = document.createElement("span");
      sourceBadge.className = "curation-source-badge";
      let sourceText = item.sourceDesc;
      if (item.tierListRefs && item.tierListRefs.length > 1) {
        sourceText = `Presente em ${item.tierListRefs.length} Tabuleiros`;
      }
      sourceBadge.textContent = sourceText;

      const formRow = document.createElement("div");
      formRow.className = "curation-form-row";
      formRow.style.flexDirection = "column";
      formRow.style.gap = "0.5rem";

      const input = document.createElement("input");
      input.type = "text";
      input.className = "curation-title-input";
      input.placeholder = "Digite o título (ex: Nome do Jogo)...";
      if (item.title && !item.title.toLowerCase().startsWith("image.")) {
        input.value = item.title;
      }

      const actionsRow = document.createElement("div");
      actionsRow.style.display = "flex";
      actionsRow.style.gap = "0.5rem";
      actionsRow.style.width = "100%";

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "btn-delete-curation";
      deleteBtn.textContent = "🗑️ Deletar";
      deleteBtn.title = "Deletar esta imagem permanentemente de todos os bancos de dados";

      const saveBtn = document.createElement("button");
      saveBtn.type = "button";
      saveBtn.className = "btn-save-curation";
      saveBtn.style.flex = "1";
      saveBtn.textContent = "💾 Salvar Título";

      actionsRow.appendChild(deleteBtn);
      actionsRow.appendChild(saveBtn);

      const performDelete = async () => {
        const confirmDel = confirm("Deseja realmente deletar esta imagem permanentemente de todos os bancos de dados (cards e tabuleiros da tier list)?");
        if (!confirmDel) return;

        deleteBtn.disabled = true;
        deleteBtn.textContent = "Deletando...";
        saveBtn.disabled = true;

        try {
          // 1. Delete from cards table
          if (item.cardId) {
            await supabase.from("cards").delete().eq("id", item.cardId);
            delete imageCache[item.cardId];
            delete imageFetchPromises[item.cardId];
            cards = cards.filter(c => c.id !== item.cardId);
          }
          if (item.src) {
            const matchingCards = cards.filter(c => c.imageDataUrl && c.imageDataUrl === item.src);
            for (const mc of matchingCards) {
              await supabase.from("cards").delete().eq("id", mc.id);
              delete imageCache[mc.id];
              delete imageFetchPromises[mc.id];
              cards = cards.filter(c => c.id !== mc.id);
            }
          }

          // 2. Delete from tier lists where referenced
          if (Array.isArray(item.tierListRefs) && item.tierListRefs.length > 0) {
            for (const ref of item.tierListRefs) {
              const { data: tlData, error: tlErr } = await supabase.from("tier_lists").select("*").eq("id", ref.tlId).single();
              if (!tlErr && tlData) {
                let tiers = tlData.tiers || [];
                let bank = tlData.bank || [];
                let row_metadata = tlData.row_metadata || [];

                tiers.forEach(t => {
                  if (Array.isArray(t.items)) {
                    t.items = t.items.filter(i => i.src !== item.src && i.id !== ref.itemId);
                  }
                });

                bank = bank.filter(i => i.src !== item.src && i.id !== ref.itemId);

                row_metadata.forEach(m => {
                  if (m && Array.isArray(m.unvoted_bank)) {
                    m.unvoted_bank = m.unvoted_bank.filter(i => i.src !== item.src && i.id !== ref.itemId);
                  }
                });

                await supabase.from("tier_lists").update({
                  tiers: tiers,
                  bank: bank,
                  row_metadata: row_metadata,
                  updated_at: new Date().toISOString()
                }).eq("id", ref.tlId);
              }
            }
          }

          // Visual deletion feedback
          cardEl.style.transition = "all 0.35s ease";
          cardEl.style.borderColor = "#ff4757";
          cardEl.style.boxShadow = "0 0 15px rgba(255, 71, 87, 0.4)";
          cardEl.style.opacity = "0";
          cardEl.style.transform = "scale(0.8)";

          setTimeout(() => {
            cardEl.remove();
            bankItems = bankItems.filter(x => x !== item);
            cachedUntitledItems = cachedUntitledItems.filter(x => x !== item);
            bankItemsCache = null;
            updateBankBadges();
            if (curationImagesGrid.querySelectorAll(".curation-card").length === 0 && curationEmptyMsg) {
              curationEmptyMsg.style.display = "block";
            }
            renderBankGrid();
          }, 350);

        } catch (err) {
          console.error("Erro ao deletar imagem:", err);
          alert("Erro ao deletar imagem: " + (err.message || err));
          deleteBtn.disabled = false;
          deleteBtn.textContent = "🗑️ Deletar";
          saveBtn.disabled = false;
        }
      };

      deleteBtn.addEventListener("click", performDelete);

      const performSave = async () => {
        const newTitle = input.value.trim();
        if (!newTitle) {
          input.focus();
          input.style.borderColor = "#ff7675";
          setTimeout(() => input.style.borderColor = "", 1500);
          return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = "Salvando...";

        try {
          // 1. If it's a card in cards table, update it
          if (item.cardId) {
            await supabase.from("cards").update({ title: newTitle }).eq("id", item.cardId);
            const foundCard = cards.find(c => c.id === item.cardId);
            if (foundCard) foundCard.title = newTitle;
          }

          // 2. If it belongs to tier lists, update each tier list in Supabase
          if (Array.isArray(item.tierListRefs) && item.tierListRefs.length > 0) {
            for (const ref of item.tierListRefs) {
              const { data: tlData, error: tlErr } = await supabase.from("tier_lists").select("*").eq("id", ref.tlId).single();
              if (!tlErr && tlData) {
                const tiers = tlData.tiers || [];
                const bank = tlData.bank || [];
                let row_metadata = tlData.row_metadata || [];

                tiers.forEach(t => {
                  (t.items || []).forEach(i => {
                    if (i.src === item.src || i.id === ref.itemId) {
                      i.title = newTitle;
                    }
                  });
                });
                bank.forEach(i => {
                  if (i.src === item.src || i.id === ref.itemId) {
                    i.title = newTitle;
                  }
                });
                row_metadata.forEach(m => {
                  if (m && Array.isArray(m.unvoted_bank)) {
                    m.unvoted_bank.forEach(i => {
                      if (i.src === item.src || i.id === ref.itemId) {
                        i.title = newTitle;
                      }
                    });
                  }
                });

                await supabase.from("tier_lists").update({
                  tiers: tiers,
                  bank: bank,
                  row_metadata: row_metadata,
                  updated_at: new Date().toISOString()
                }).eq("id", ref.tlId);
              }
            }
          }

          // 3. Register image in cards table so it becomes searchable and reusable across the site
          if (!item.cardId && item.src) {
            const newCardId = `u_lele__games_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
            await supabase.from("cards").insert([{
              id: newCardId,
              title: newTitle,
              image_data_url: item.src,
              timestamp: Date.now(),
              votes: 0
            }]);
            cards.push({
              id: newCardId,
              title: newTitle,
              imageDataUrl: item.src,
              timestamp: Date.now(),
              votes: 0
            });
            imageCache[newCardId] = item.src;
          }

          // Success visual feedback
          cardEl.style.transition = "all 0.4s ease";
          cardEl.style.borderColor = "#2ed573";
          cardEl.style.boxShadow = "0 0 15px rgba(46, 213, 115, 0.4)";
          saveBtn.textContent = "✓ Salvo!";
          saveBtn.style.background = "#2ed573";

          setTimeout(() => {
            cardEl.style.opacity = "0";
            cardEl.style.transform = "scale(0.8)";
            setTimeout(() => {
              cardEl.remove();
              // O item continua no banco, agora com título
              item.title = newTitle;
              cachedUntitledItems = cachedUntitledItems.filter(x => x !== item);
              bankItemsCache = null;
              updateBankBadges();
              if (curationImagesGrid.querySelectorAll(".curation-card").length === 0 && curationEmptyMsg) {
                curationEmptyMsg.style.display = "block";
              }
              renderBankGrid();
            }, 300);
          }, 800);

        } catch (err) {
          console.error("Erro ao salvar título curado:", err);
          alert("Erro ao salvar: " + (err.message || err));
          saveBtn.disabled = false;
          saveBtn.textContent = "💾 Salvar Título";
        }
      };

      saveBtn.addEventListener("click", performSave);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          performSave();
        }
      });

      formRow.appendChild(input);
      formRow.appendChild(actionsRow);

      cardEl.appendChild(imgWrap);
      cardEl.appendChild(sourceBadge);
      cardEl.appendChild(formRow);

      curationImagesGrid.appendChild(cardEl);
    });
  }

  if (refreshCurationBtn) {
    refreshCurationBtn.addEventListener("click", () => {
      loadAndRenderUntitledCuration(true);
    });
  }

  // --- Init ---
  async function init() {
    await loadUsers();
    await loadCards();
    loadSession();
    if (currentUsername) {
      await getOrCreateUser(currentUsername);
      currentGalleryOwner = currentUsername; // Default to active logged in user's galleries
    } else {
      currentGalleryOwner = "lele";
    }
    currentGallerySlug = "games";

    renderGalleriesNavigation();
    updateUserBar();
    initImageObserver();
    setupDragAndDrop(addDropZone, cardImageInput, showPreview);
    setupDragAndDrop(editDropZone, editImageInput, showEditPreview);

    renderCards();
    setupRealtime();
  }
  init();
})();
