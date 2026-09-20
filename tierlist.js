(function() {
  // Supabase initialization
  const supabaseUrl = window.SUPABASE_URL;
  const supabaseKey = window.SUPABASE_KEY;
  const supabase = window.supabase && supabaseUrl && supabaseKey ? window.supabase.createClient(supabaseUrl, supabaseKey) : null;

  // State keys
  const STORAGE_KEY = "roleta-nmdp-tierlist";

  // Preset Colors
  const PRESET_COLORS = [
    { name: "Vermelho", hex: "#ff7f7f" },
    { name: "Laranja", hex: "#ffbf7f" },
    { name: "Amarelo", hex: "#ffdf7f" },
    { name: "Verde Claro", hex: "#ffff7f" },
    { name: "Verde", hex: "#7fff7f" },
    { name: "Verde Água", hex: "#7fffbf" },
    { name: "Ciano", hex: "#7fffff" },
    { name: "Azul Claro", hex: "#7fbbff" },
    { name: "Azul", hex: "#7f7fff" },
    { name: "Roxo", hex: "#bf7fff" },
    { name: "Rosa", hex: "#ff7fbf" },
    { name: "Cinza", hex: "#95a5a6" }
  ];

  // Default rows structure
  const DEFAULT_TIERS = [
    { id: "row-s", name: "S", color: "#ff7f7f", minScore: 9.0, items: [] },
    { id: "row-a", name: "A", color: "#ffbf7f", minScore: 7.5, items: [] },
    { id: "row-b", name: "B", color: "#ffdf7f", minScore: 5.5, items: [] },
    { id: "row-c", name: "C", color: "#ffff7f", minScore: 3.5, items: [] },
    { id: "row-d", name: "D", color: "#7fff7f", minScore: 1.5, items: [] },
    { id: "row-f", name: "F", color: "#7fbbff", minScore: 0.0, items: [] }
  ];

  function getRowMinScore(tier, index, totalRows) {
    if (tier && typeof tier.minScore === "number" && !isNaN(tier.minScore)) {
      return tier.minScore;
    }
    const n = Math.max(1, totalRows || (tiersData ? tiersData.length : 6));
    if (n === 6) {
      const defaults = [9.0, 7.5, 5.5, 3.5, 1.5, 0.0];
      if (typeof index === "number" && index < defaults.length) return defaults[index];
    } else if (n === 7) {
      const defaults = [9.0, 7.5, 6.0, 4.5, 3.0, 1.5, 0.0];
      if (typeof index === "number" && index < defaults.length) return defaults[index];
    } else if (n === 5) {
      const defaults = [8.5, 7.0, 5.0, 3.0, 0.0];
      if (typeof index === "number" && index < defaults.length) return defaults[index];
    }
    if (typeof index === "number") {
      const step = 10 / n;
      const score = Math.round((10 - (index + 1) * step) * 10) / 10;
      return Math.max(0.0, Math.min(10.0, score));
    }
    return 0.0;
  }

  const SAVED_COLLECTION_KEY = "roleta-nmdp-saved-tierlists";

  // DOM View Containers
  const setupScreen = document.getElementById("tierlist-setup-screen");
  const editScreen = document.getElementById("tierlist-edit-screen");
  const landingWrapper = document.getElementById("tierlist-landing-wrapper");
  const savedBoardsList = document.getElementById("saved-boards-list");
  const databaseErrorNotice = document.getElementById("database-error-notice");
  const toggleSetupBtn = document.getElementById("toggle-setup-btn");
  const setupCollapseContainer = document.getElementById("setup-collapse-container");

  // Setup Form Selectors
  const setupTitleInput = document.getElementById("setup-title-input");
  const setupImportCheckbox = document.getElementById("setup-import-checkbox");
  const setupImportOptions = document.getElementById("setup-import-options");
  const setupImportCategory = document.getElementById("setup-import-category");
  const setupImportVotes = document.getElementById("setup-import-votes");
  const startCreationBtn = document.getElementById("start-creation-btn");

  const setupParamInput = document.getElementById("setup-param-input");
  const addSetupParamBtn = document.getElementById("add-setup-param-btn");
  const setupParamsContainer = document.getElementById("setup-params-container");
  const noParamsMsg = document.getElementById("no-params-msg");

  // DOM Edit Selectors
  const activeTierlistTitle = document.getElementById("active-tierlist-title");
  const goBackSetupBtn = document.getElementById("go-back-setup-btn");
  const saveBoardBtn = document.getElementById("save-board-btn");
  const addRowBtn = document.getElementById("add-row-btn");
  const resetTiersBtn = document.getElementById("reset-tiers-btn");
  const clearItemsBtn = document.getElementById("clear-items-btn");
  const clearAllBtn = document.getElementById("clear-all-btn");
  const deleteBoardBtn = document.getElementById("delete-board-btn");
  const openImportModalBtn = document.getElementById("open-import-modal-btn");
  const downloadPngBtn = document.getElementById("download-png-btn");
  const editParametersBtn = document.getElementById("edit-parameters-btn");

  const addStockImagesBtn = document.getElementById("add-stock-images-btn");
  const fileInputUpload = document.getElementById("tier-image-input");

  const boardContainer = document.getElementById("tier-list-board");
  const bankContainer = document.getElementById("unplaced-images-bank");
  const unvotedBankContainer = document.getElementById("unvoted-images-bank");
  const unvotedBankCountEl = document.getElementById("unvoted-bank-count");

  // Modal Selectors
  const rowSettingsOverlay = document.getElementById("row-settings-overlay");
  const rowLabelInput = document.getElementById("row-label-input");
  const presetsGrid = document.getElementById("color-presets-grid");
  const deleteRowConfirmBtn = document.getElementById("delete-row-confirm-btn");
  const cancelRowSettingsBtn = document.getElementById("cancel-row-settings-btn");
  const saveRowSettingsBtn = document.getElementById("save-row-settings-btn");

  // Parameters Modal Selectors
  const parametersOverlay = document.getElementById("parameters-overlay");
  const modalParamInput = document.getElementById("modal-param-input");
  const modalAddParamBtn = document.getElementById("modal-add-param-btn");
  const modalParamsList = document.getElementById("modal-params-list");
  const cancelParametersBtn = document.getElementById("cancel-parameters-btn");
  const saveParametersBtn = document.getElementById("save-parameters-btn");

  // Import Modal Selectors
  const importOverlay = document.getElementById("import-overlay");
  const cancelImportBtn = document.getElementById("cancel-import-btn");

  // Export Presentation Modal Selectors
  const exportPreviewOverlay = document.getElementById("export-preview-overlay");
  const exportPreviewImg = document.getElementById("export-preview-img");
  const copyImageBtn = document.getElementById("copy-image-btn");
  const downloadFinalPngBtn = document.getElementById("download-final-png-btn");
  const closeExportModalBtn = document.getElementById("close-export-modal-btn");
  let activeExportCanvas = null;
  let activeExportTitle = "";

  // Local State variables
  let activeBoardId = null;
  let activeEditing = false;
  let boardTitle = "Minha Tier List";
  let activeBoardIsFeatured = false;
  let activeBoardCreatedBy = null;
  let tiersData = [];
  let bankData = [];
  let unvotedBankData = [];
  let draggedEl = null;
  let activeEditingRowId = null;
  let selectedPresetColor = "";

  // Parameters State
  let activeBoardParameters = [];
  let setupParameters = [];
  let editingModalParameters = [];

  // User Session selectors
  const userLoginForm = document.getElementById("user-login-form");
  const userProfileStatus = document.getElementById("user-profile-status");
  const usernameInput = document.getElementById("username-input");
  const activeUsernameEl = document.getElementById("active-username");
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");

  const SESSION_STORAGE_KEY = "roleta-nmdp-session";

  function loadSessionUser() {
    return (localStorage.getItem(SESSION_STORAGE_KEY) || "").trim();
  }

  function updateUserSessionUI() {
    const currentUsername = loadSessionUser();

    if (currentUsername) {
      if (userLoginForm) userLoginForm.style.display = "none";
      if (userProfileStatus) userProfileStatus.style.display = "flex";
      if (activeUsernameEl) activeUsernameEl.textContent = currentUsername;
    } else {
      if (userLoginForm) userLoginForm.style.display = "flex";
      if (userProfileStatus) userProfileStatus.style.display = "none";
      if (activeUsernameEl) activeUsernameEl.textContent = "";
    }

    if (typeof renderSavedBoards === "function") {
      renderSavedBoards();
    }
    if (activeEditing && typeof updateBoardPermissionsUI === "function") {
      updateBoardPermissionsUI();
    }
  }

  if (loginBtn && usernameInput) {
    loginBtn.addEventListener("click", () => {
      const name = usernameInput.value.trim();
      if (name) {
        localStorage.setItem(SESSION_STORAGE_KEY, name);
        usernameInput.value = "";
        updateUserSessionUI();
      }
    });
    usernameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        loginBtn.click();
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      updateUserSessionUI();
    });
  }

  function canUserVoteOnActiveBoard() {
    if (activeBoardIsFeatured) return true;
    const sessionUser = loadSessionUser().toLowerCase();
    const creator = (activeBoardCreatedBy || "").trim().toLowerCase();

    if (!sessionUser) return false;
    if (sessionUser === "lele") return true;
    if (!creator || creator === "anônimo" || creator === sessionUser) return true;
    return false;
  }

  function canUserEditActiveBoard() {
    const sessionUser = loadSessionUser().toLowerCase();
    return sessionUser === "lele";
  }

  function updateBoardPermissionsUI() {
    const canVote = canUserVoteOnActiveBoard();
    const canEdit = canUserEditActiveBoard();

    // Action buttons visibility (only 'lele' can edit board layout/structure)
    const saveBoardBtn = document.getElementById("save-board-btn");
    const addRowBtn = document.getElementById("add-row-btn");
    const resetTiersBtn = document.getElementById("reset-tiers-btn");
    const clearItemsBtn = document.getElementById("clear-items-btn");
    const clearAllBtn = document.getElementById("clear-all-btn");
    const deleteBoardBtn = document.getElementById("delete-board-btn");
    const changeOwnerBtn = document.getElementById("change-owner-btn");
    const openThresholdsBtn = document.getElementById("open-thresholds-modal-btn");
    const editParametersBtn = document.getElementById("edit-parameters-btn");

    if (saveBoardBtn) saveBoardBtn.style.display = canEdit ? "inline-block" : "none";
    if (addRowBtn) addRowBtn.style.display = canEdit ? "inline-block" : "none";
    if (resetTiersBtn) resetTiersBtn.style.display = canEdit ? "inline-block" : "none";
    if (clearItemsBtn) clearItemsBtn.style.display = canEdit ? "inline-block" : "none";
    if (clearAllBtn) clearAllBtn.style.display = canEdit ? "inline-block" : "none";
    if (deleteBoardBtn) deleteBoardBtn.style.display = (canEdit && activeBoardId) ? "inline-block" : "none";
    if (changeOwnerBtn) changeOwnerBtn.style.display = (canEdit && activeBoardId) ? "inline-block" : "none";
    if (openThresholdsBtn) openThresholdsBtn.style.display = canEdit ? "inline-block" : "none";
    if (editParametersBtn) editParametersBtn.style.display = canEdit ? "inline-block" : "none";

    // Row controls visibility (only 'lele' can edit rows)
    document.querySelectorAll(".btn-tier-ctrl, .tier-controls").forEach(ctrl => {
      ctrl.style.display = canEdit ? "flex" : "none";
    });

    // Make images non-draggable for non-editors (only 'lele' can drag/rearrange)
    document.querySelectorAll(".tier-item-img").forEach(img => {
      img.draggable = canEdit;
    });

    // Permission notice header badge
    let permNotice = document.getElementById("board-permission-notice");
    if (!permNotice) {
      permNotice = document.createElement("div");
      permNotice.id = "board-permission-notice";
      permNotice.style.fontSize = "0.85rem";
      permNotice.style.marginTop = "0.35rem";
      permNotice.style.padding = "0.35rem 0.75rem";
      permNotice.style.borderRadius = "6px";
      permNotice.style.fontWeight = "700";
      permNotice.style.display = "inline-block";

      const titleHeader = document.getElementById("active-tierlist-title");
      if (titleHeader && titleHeader.parentElement) {
        titleHeader.parentElement.appendChild(permNotice);
      }
    }

    if (permNotice) {
      const sessionUser = loadSessionUser();
      if (activeBoardIsFeatured) {
        permNotice.style.background = "rgba(255, 215, 0, 0.15)";
        permNotice.style.color = "#ffd700";
        permNotice.style.border = "1px solid rgba(255, 215, 0, 0.4)";
        if (canEdit) {
          permNotice.textContent = "⭐ Tabuleiro em Destaque Global (Modo Admin lele | Votação aberta a todos)";
        } else {
          permNotice.textContent = "⭐ Tabuleiro em Destaque Global (Votação aberta a todos | Edição restrita ao lele)";
        }
      } else if (canEdit) {
        permNotice.style.background = "rgba(46, 204, 113, 0.15)";
        permNotice.style.color = "#2ecc71";
        permNotice.style.border = "1px solid rgba(46, 204, 113, 0.4)";
        permNotice.textContent = `🔓 Modo Admin lele (Criado por: ${activeBoardCreatedBy || sessionUser})`;
      } else if (canVote) {
        permNotice.style.background = "rgba(52, 152, 219, 0.15)";
        permNotice.style.color = "#3498db";
        permNotice.style.border = "1px solid rgba(52, 152, 219, 0.4)";
        permNotice.textContent = `🗳️ Modo Votação (Criado por: ${activeBoardCreatedBy || "Você"} | Edição restrita ao lele)`;
      } else {
        permNotice.style.background = "rgba(231, 76, 60, 0.15)";
        permNotice.style.color = "#e74c3c";
        permNotice.style.border = "1px solid rgba(231, 76, 60, 0.4)";
        permNotice.textContent = `🔒 Somente Leitura (Criado por: ${activeBoardCreatedBy || "outro usuário"} | Votação e edição restritas)`;
      }
    }
  }

  // --- State persistence ---

  function saveBoardState() {
    const state = {
      activeBoardId: activeBoardId,
      activeEditing: activeEditing,
      boardTitle: boardTitle,
      tiers: [],
      bank: []
    };

    // Extract Tiers
    document.querySelectorAll(".tier-row").forEach(row => {
      const rowId = row.dataset.id;
      const labelEl = row.querySelector(".tier-label");
      const nameSpan = labelEl.querySelector("span");
      const labelName = nameSpan ? nameSpan.textContent.trim() : labelEl.textContent.trim();
      const color = labelEl.dataset.color;

      const existingTier = tiersData.find(t => t.id === rowId);
      const minScore = (existingTier && typeof existingTier.minScore === "number") ? existingTier.minScore : undefined;

      const items = [];
      row.querySelectorAll(".tier-item-img").forEach(img => {
        items.push({
          id: img.dataset.id,
          src: img.src,
          title: img.title || ""
        });
      });

      state.tiers.push({
        id: rowId,
        name: labelName,
        color: color,
        minScore: minScore,
        items: items
      });
    });

    // Extract Bank
    document.querySelectorAll("#unplaced-images-bank .tier-item-img").forEach(img => {
      state.bank.push({
        id: img.dataset.id,
        src: img.src,
        title: img.title || ""
      });
    });

    // Extract Unvoted Bank
    state.unvotedBank = [];
    document.querySelectorAll("#unvoted-images-bank .tier-item-img").forEach(img => {
      state.unvotedBank.push({
        id: img.dataset.id,
        src: img.src,
        title: img.title || ""
      });
    });

    state.activeBoardIsFeatured = activeBoardIsFeatured;
    state.activeBoardCreatedBy = activeBoardCreatedBy;
    state.activeBoardRatings = activeBoardRatings;
    state.activeBoardParameters = activeBoardParameters;

    // Keep in-memory arrays strictly synchronized with DOM state
    tiersData = state.tiers;
    bankData = state.bank;
    unvotedBankData = state.unvotedBank;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (quotaError) {
      console.warn("LocalStorage quota exceeded: saving local state draft failed.", quotaError);
    }
    updateEmptyBankMessage();
  }

  function loadBoardState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        activeBoardId = parsed.activeBoardId || null;
        activeEditing = parsed.activeEditing || false;
        boardTitle = parsed.boardTitle || "Minha Tier List";
        tiersData = parsed.tiers || [];
        bankData = parsed.bank || [];
        unvotedBankData = parsed.unvotedBank || [];
        activeBoardIsFeatured = parsed.activeBoardIsFeatured || false;
        activeBoardCreatedBy = parsed.activeBoardCreatedBy || null;
        activeBoardRatings = parsed.activeBoardRatings || {};
        activeBoardParameters = parsed.activeBoardParameters || [];
        return;
      } catch (e) {
        console.error("Erro ao ler estado do localStorage:", e);
      }
    }
    activeBoardIsFeatured = false;
    activeBoardCreatedBy = null;
    activeBoardRatings = {};
    activeBoardParameters = [];
    activeEditing = false;
    boardTitle = "Minha Tier List";
    tiersData = JSON.parse(JSON.stringify(DEFAULT_TIERS));
    bankData = [];
    unvotedBankData = [];
  }

  // --- Rendering UI elements ---

  function renderBoard() {
    boardContainer.innerHTML = "";
    tiersData.forEach((tier, index) => {
      const rowEl = createRowElement(tier, index);
      boardContainer.appendChild(rowEl);
    });
    updateBoardPermissionsUI();
    renderUnvotedBank();
  }

  function renderBank() {
    // Clear out items except the empty bank message template
    const msg = bankContainer.querySelector(".empty-bank-msg");
    bankContainer.innerHTML = "";
    if (msg) bankContainer.appendChild(msg);

    bankData.forEach(item => {
      const imgEl = createItemElement(item);
      bankContainer.appendChild(imgEl);
    });

    updateEmptyBankMessage();
  }

  function renderUnvotedBank() {
    if (!unvotedBankContainer) return;
    const msg = unvotedBankContainer.querySelector(".empty-unvoted-msg");
    unvotedBankContainer.innerHTML = "";
    if (msg) unvotedBankContainer.appendChild(msg);

    unvotedBankData.forEach(item => {
      const imgEl = createItemElement(item);
      unvotedBankContainer.appendChild(imgEl);
    });

    updateEmptyUnvotedMessage();
  }

  function updateEmptyBankMessage() {
    const msg = bankContainer.querySelector(".empty-bank-msg");
    const itemElements = bankContainer.querySelectorAll(".tier-item-img");
    if (msg) {
      msg.style.display = itemElements.length === 0 ? "block" : "none";
    }
  }

  function updateEmptyUnvotedMessage() {
    if (!unvotedBankContainer) return;
    const msg = unvotedBankContainer.querySelector(".empty-unvoted-msg");
    const itemElements = unvotedBankContainer.querySelectorAll(".tier-item-img");
    const count = itemElements.length;

    if (msg) {
      msg.style.display = count === 0 ? "block" : "none";
    }
    if (unvotedBankCountEl) {
      unvotedBankCountEl.textContent = `(${count} ${count === 1 ? 'item' : 'itens'})`;
    }
  }

  function createRowElement(tier, index) {
    const row = document.createElement("div");
    row.className = "tier-row";
    row.dataset.id = tier.id;

    // Label
    const label = document.createElement("div");
    label.className = "tier-label";
    label.textContent = tier.name;
    label.style.backgroundColor = tier.color;
    label.dataset.color = tier.color;

    const minScoreVal = getRowMinScore(tier, index, tiersData.length);
    label.title = `Categoria: ${tier.name} (Nota Mínima Requerida: ≥ ${minScoreVal.toFixed(1)})`;

    label.addEventListener("click", () => openRowSettings(tier.id));

    // Items Zone
    const itemsZone = document.createElement("div");
    itemsZone.className = "tier-items dropzone";

    tier.items.forEach(item => {
      const img = createItemElement(item);
      itemsZone.appendChild(img);
    });

    setupDropzoneEvents(itemsZone);

    // Controls
    const controls = document.createElement("div");
    controls.className = "tier-controls";

    const moveUp = document.createElement("button");
    moveUp.type = "button";
    moveUp.className = "btn-tier-ctrl";
    moveUp.innerHTML = "▲";
    moveUp.title = "Mover para cima";
    moveUp.addEventListener("click", () => moveRow(tier.id, -1));

    const moveDown = document.createElement("button");
    moveDown.type = "button";
    moveDown.className = "btn-tier-ctrl";
    moveDown.innerHTML = "▼";
    moveDown.title = "Mover para baixo";
    moveDown.addEventListener("click", () => moveRow(tier.id, 1));

    const settings = document.createElement("button");
    settings.type = "button";
    settings.className = "btn-tier-ctrl";
    settings.innerHTML = "⚙️";
    settings.title = "Configurações";
    settings.addEventListener("click", () => openRowSettings(tier.id));

    controls.appendChild(moveUp);
    controls.appendChild(settings);
    controls.appendChild(moveDown);

    row.appendChild(label);
    row.appendChild(itemsZone);
    row.appendChild(controls);

    return row;
  }

  // --- Featured Ratings & Auto Re-Sorting System ---
  let activeBoardRatings = {}; // itemId -> Array of { userName, score }
  let activeRatingItem = null;

  const inlineRatingCard = document.getElementById("inline-rating-card");
  const inlineRatingItemTitle = document.getElementById("inline-rating-item-title");
  const inlineRatingSlider = document.getElementById("inline-rating-slider");
  const inlineRatingValue = document.getElementById("inline-rating-value");
  const submitInlineRatingBtn = document.getElementById("submit-inline-rating-btn");
  const closeInlineRatingBtn = document.getElementById("close-inline-rating-btn");

  const imageHoverPreviewRatingBox = document.getElementById("image-hover-preview-rating-box");
  const hoverAvgRating = document.getElementById("hover-avg-rating");
  const hoverUserRatingsList = document.getElementById("hover-user-ratings-list");

  if (inlineRatingSlider && inlineRatingValue) {
    inlineRatingSlider.addEventListener("input", () => {
      inlineRatingValue.textContent = `${Number(inlineRatingSlider.value).toFixed(1)} / 10`;
    });
  }

  function getItemRatingStats(itemId) {
    if (!itemId) return { avg: 0, count: 0, ratings: [] };
    const ratings = activeBoardRatings[itemId] || [];
    if (ratings.length === 0) {
      return { avg: 0, count: 0, ratings: [] };
    }
    const sum = ratings.reduce((acc, r) => acc + r.score, 0);
    const avg = Math.round((sum / ratings.length) * 10) / 10;
    return { avg, count: ratings.length, ratings };
  }

  async function loadFeaturedBoardRatings(boardId, rowMetadata) {
    activeBoardRatings = {};
    if (!boardId) return;

    // 1. Load embedded ratings & parameters from rowMetadata array if present
    if (Array.isArray(rowMetadata)) {
      const metaRatingsObj = rowMetadata.find(m => m && m.ratings !== undefined);
      if (metaRatingsObj && metaRatingsObj.ratings) {
        activeBoardRatings = JSON.parse(JSON.stringify(metaRatingsObj.ratings));
      }
      const metaParamObj = rowMetadata.find(m => m && m.parameters !== undefined);
      if (metaParamObj && metaParamObj.parameters) {
        activeBoardParameters = JSON.parse(JSON.stringify(metaParamObj.parameters));
      }
    }

    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from("featured_ratings")
        .select("*")
        .eq("board_id", boardId);

      if (!error && data && data.length > 0) {
        data.forEach(r => {
          if (!activeBoardRatings[r.item_id]) activeBoardRatings[r.item_id] = [];
          const sessionUser = (r.user_name || "").toLowerCase();
          const existing = activeBoardRatings[r.item_id].find(x => (x.userName || "").toLowerCase() === sessionUser);
          if (existing) {
            existing.score = Number(r.score);
          } else {
            activeBoardRatings[r.item_id].push({
              userName: r.user_name,
              score: Number(r.score)
            });
          }
        });
      }
    } catch (err) {
      console.warn("Tabela 'featured_ratings' não disponível ou vazia:", err);
    }
  }

  function showAutoSaveToast(message) {
    let toast = document.getElementById("autosave-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "autosave-toast";
      toast.style.position = "fixed";
      toast.style.bottom = "20px";
      toast.style.right = "20px";
      toast.style.backgroundColor = "rgba(46, 204, 113, 0.95)";
      toast.style.color = "#fff";
      toast.style.padding = "10px 18px";
      toast.style.borderRadius = "8px";
      toast.style.boxShadow = "0 4px 15px rgba(0,0,0,0.4)";
      toast.style.fontSize = "0.9rem";
      toast.style.fontWeight = "600";
      toast.style.zIndex = "10000";
      toast.style.transition = "opacity 0.3s ease, transform 0.3s ease";
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      toast.style.pointerEvents = "none";
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
    }, 2500);
  }

  async function autoSaveActiveBoard() {
    if (!supabase || !activeBoardId) return;

    try {
      const row_metadata = [];
      tiersData.forEach(tier => {
        row_metadata.push({
          name: tier.name,
          color: tier.color,
          minScore: (typeof tier.minScore === "number") ? tier.minScore : undefined,
          count: (tier.items || []).length
        });
      });

      if (activeBoardIsFeatured) {
        row_metadata.push({
          is_featured: true,
          ratings: activeBoardRatings
        });
      } else if (Object.keys(activeBoardRatings).length > 0) {
        row_metadata.push({
          ratings: activeBoardRatings
        });
      }

      if (Array.isArray(activeBoardParameters) && activeBoardParameters.length > 0) {
        row_metadata.push({
          parameters: activeBoardParameters
        });
      }

      if (Array.isArray(unvotedBankData) && unvotedBankData.length > 0) {
        row_metadata.push({
          unvoted_bank: unvotedBankData
        });
      }

      const upsertPayload = {
        id: activeBoardId,
        title: boardTitle,
        created_by: activeBoardCreatedBy || loadSessionUser() || "Anônimo",
        tiers: tiersData,
        bank: bankData,
        row_metadata: row_metadata,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase.from("tier_lists").upsert(upsertPayload);
      if (error) {
        console.warn("Erro ao auto-salvar tabuleiro no Supabase:", error);
      } else {
        showAutoSaveToast("⭐ Voto e tabuleiro salvos automaticamente!");
      }
    } catch (err) {
      console.warn("Erro ao auto-salvar tabuleiro:", err);
    }
  }

  async function submitItemRating(itemId, score, paramScores) {
    if (!activeBoardId) {
      activeBoardId = "tl-" + Date.now().toString(36) + "-" + Math.random().toString(36).substr(2, 5);
    }
    if (!itemId && activeRatingItem && activeRatingItem.id) {
      itemId = activeRatingItem.id;
    }
    if (!itemId) return;

    if (!canUserVoteOnActiveBoard()) {
      const creatorName = activeBoardCreatedBy || "o criador";
      alert(`Apenas o criador deste tabuleiro (${creatorName}) pode votar nele.`);
      return;
    }

    let sessionUser = loadSessionUser();
    if (!sessionUser) {
      sessionUser = prompt("Digite seu nome para registrar seu voto no tabuleiro:") || "";
      sessionUser = sessionUser.trim();
      if (!sessionUser) {
        alert("Você precisa informar seu nome para votar.");
        return;
      }
      localStorage.setItem(SESSION_STORAGE_KEY, sessionUser);
      updateUserSessionUI();
    }

    const recordId = `rate-${activeBoardId}-${itemId}-${sessionUser.toLowerCase().replace(/\s+/g, '_')}`;

    // 1. Update local state
    if (!activeBoardRatings[itemId]) activeBoardRatings[itemId] = [];
    const existingIdx = activeBoardRatings[itemId].findIndex(r => (r.userName || "").toLowerCase() === sessionUser.toLowerCase());
    
    const ratingRecord = { userName: sessionUser, score: score };
    if (paramScores && typeof paramScores === "object" && Object.keys(paramScores).length > 0) {
      ratingRecord.paramScores = paramScores;
    }

    if (existingIdx >= 0) {
      activeBoardRatings[itemId][existingIdx] = ratingRecord;
    } else {
      activeBoardRatings[itemId].push(ratingRecord);
    }

    // 2. Synchronize current state from DOM first
    saveBoardState();

    // 3. Locate the item being rated
    let itemObj = null;

    // Check tiersData
    for (const tier of tiersData) {
      if (Array.isArray(tier.items)) {
        const idx = tier.items.findIndex(it => it.id === itemId);
        if (idx >= 0) {
          itemObj = tier.items[idx];
          break;
        }
      }
    }

    // Check bankData
    if (!itemObj && Array.isArray(bankData)) {
      const idx = bankData.findIndex(it => it.id === itemId);
      if (idx >= 0) {
        itemObj = bankData[idx];
      }
    }

    // Check unvotedBankData
    if (!itemObj && Array.isArray(unvotedBankData)) {
      const idx = unvotedBankData.findIndex(it => it.id === itemId);
      if (idx >= 0) {
        itemObj = unvotedBankData[idx];
      }
    }

    // Fallback to activeRatingItem or DOM
    if (!itemObj) {
      if (activeRatingItem && (activeRatingItem.id === itemId || !activeRatingItem.id)) {
        itemObj = { id: itemId, src: activeRatingItem.src, title: activeRatingItem.title || "" };
      } else {
        const domImg = document.querySelector(`.tier-item-img[data-id="${itemId}"]`);
        if (domImg) {
          itemObj = { id: itemId, src: domImg.src, title: domImg.title || "" };
        }
      }
    }

    // 4. Remove item from bankData and unvotedBankData, and from all tiers
    if (itemObj) {
      itemObj.id = itemId;
      bankData = bankData.filter(it => it.id !== itemId);
      unvotedBankData = unvotedBankData.filter(it => it.id !== itemId);
      tiersData.forEach(t => {
        if (Array.isArray(t.items)) {
          t.items = t.items.filter(it => it.id !== itemId);
        }
      });

      // Place into tiersData in the row corresponding to score
      const stats = getItemRatingStats(itemId);
      const avgScore = stats.count > 0 ? stats.avg : score;
      const numRows = tiersData.length || 1;
      let targetRowIndex = numRows - 1;

      for (let i = 0; i < numRows; i++) {
        const reqScore = getRowMinScore(tiersData[i], i, numRows);
        if (avgScore >= reqScore) {
          targetRowIndex = i;
          break;
        }
      }

      if (tiersData[targetRowIndex]) {
        tiersData[targetRowIndex].items.push(itemObj);
      }
    }

    // 5. Auto re-sort board items across rows and within rows based on average scores
    applyFeaturedAutoSorting();
    renderBoard();
    renderBank();
    renderUnvotedBank();
    saveBoardState();

    // 6. Save to Supabase featured_ratings table & auto-save board state
    if (supabase && activeBoardId) {
      try {
        await supabase.from("featured_ratings").upsert({
          id: recordId,
          board_id: activeBoardId,
          item_id: itemId,
          user_name: sessionUser,
          score: score,
          updated_at: new Date().toISOString()
        });
      } catch (err) {
        console.warn("Erro ao salvar nota em featured_ratings:", err);
      }

      await autoSaveActiveBoard();
    }
  }

  async function removeUserItemRating(itemId, targetUserName) {
    if (!activeBoardId || !itemId || !targetUserName) return;

    const isLele = loadSessionUser().toLowerCase() === "lele";
    const currentSessionUser = loadSessionUser().toLowerCase();

    if (!isLele && currentSessionUser !== targetUserName.toLowerCase()) {
      alert("Apenas o usuário 'lele' pode remover votos de outros usuários.");
      return;
    }

    const confirmRemove = confirm(`Deseja remover o voto de "${targetUserName}" para este item?`);
    if (!confirmRemove) return;

    // 1. Remove from local memory activeBoardRatings
    if (activeBoardRatings[itemId]) {
      activeBoardRatings[itemId] = activeBoardRatings[itemId].filter(
        r => (r.userName || "").toLowerCase() !== targetUserName.toLowerCase()
      );
      if (activeBoardRatings[itemId].length === 0) {
        delete activeBoardRatings[itemId];
      }
    }

    // 2. Remove from Supabase featured_ratings table
    if (supabase) {
      try {
        const recordId = `rate-${activeBoardId}-${itemId}-${targetUserName.toLowerCase().replace(/\s+/g, '_')}`;
        const { error } = await supabase
          .from("featured_ratings")
          .delete()
          .eq("id", recordId);

        if (error) {
          await supabase
            .from("featured_ratings")
            .delete()
            .eq("board_id", activeBoardId)
            .eq("item_id", itemId)
            .ilike("user_name", targetUserName);
        }
      } catch (err) {
        console.warn("Erro ao remover voto de featured_ratings:", err);
      }
    }

    // 3. Re-sort, auto-save state and re-render board
    applyFeaturedAutoSorting();
    if (supabase && activeBoardId) {
      await autoSaveActiveBoard();
    }
    renderBoard();
    renderBank();
    renderUnvotedBank();
    saveBoardState();

    alert(`Voto de "${targetUserName}" foi removido com sucesso!`);
  }

  function applyFeaturedAutoSorting() {
    // Collect all placed items and unvoted bank items
    const allPlacedItems = [];
    tiersData.forEach(tier => {
      if (Array.isArray(tier.items)) {
        allPlacedItems.push(...tier.items);
      }
    });

    if (Array.isArray(unvotedBankData)) {
      allPlacedItems.push(...unvotedBankData);
    }

    // Also promote any items in bankData that have votes (stats.count > 0)
    if (Array.isArray(bankData)) {
      const remainingBank = [];
      bankData.forEach(item => {
        if (!item.id) {
          item.id = "item-" + Date.now().toString(36) + "-" + Math.random().toString(36).substr(2, 5);
        }
        const stats = getItemRatingStats(item.id);
        if (stats.count > 0) {
          allPlacedItems.push(item);
        } else {
          remainingBank.push(item);
        }
      });
      bankData = remainingBank;
    }

    // Ensure all items have an ID
    allPlacedItems.forEach(item => {
      if (!item.id) {
        item.id = "item-" + Date.now().toString(36) + "-" + Math.random().toString(36).substr(2, 5);
      }
    });

    if (allPlacedItems.length === 0) return;

    // Deduplicate allPlacedItems by id
    const seenIds = new Set();
    const uniqueItems = [];
    allPlacedItems.forEach(item => {
      if (item && item.id && !seenIds.has(item.id)) {
        seenIds.add(item.id);
        uniqueItems.push(item);
      }
    });

    // Clear items from tiers and unvoted bank
    tiersData.forEach(tier => {
      tier.items = [];
    });
    unvotedBankData = [];

    const numRows = tiersData.length;

    // Distribute items: voted items to tiersData, unvoted items ALWAYS to unvotedBankData ("Aguardando Aprovação")
    uniqueItems.forEach(item => {
      const stats = getItemRatingStats(item.id);
      if (stats.count > 0) {
        let targetRowIndex = numRows - 1; // Default to lowest tier
        for (let i = 0; i < numRows; i++) {
          const reqScore = getRowMinScore(tiersData[i], i, numRows);
          if (stats.avg >= reqScore) {
            targetRowIndex = i;
            break;
          }
        }

        if (tiersData[targetRowIndex]) {
          tiersData[targetRowIndex].items.push(item);
        }
      } else {
        // Any item without votes goes to unvoted bank ("Aguardando Aprovação")
        unvotedBankData.push(item);
      }
    });

    // Sort items inside each tier row descending by average score
    tiersData.forEach(tier => {
      tier.items.sort((a, b) => {
        const statsA = getItemRatingStats(a.id);
        const statsB = getItemRatingStats(b.id);
        if (statsB.avg !== statsA.avg) {
          return statsB.avg - statsA.avg;
        }
        return statsB.count - statsA.count;
      });
    });

    renderBoard();
    renderBank();
    renderUnvotedBank();
  }

  function openInlineRatingCard(item, targetImgElement) {
    if (!item || !inlineRatingCard) return;

    if (!canUserVoteOnActiveBoard()) {
      const creatorName = activeBoardCreatedBy || "o criador";
      alert(`Apenas o criador deste tabuleiro (${creatorName}) pode votar nele.`);
      return;
    }

    if (!item.id) {
      if (targetImgElement && targetImgElement.dataset.id) {
        item.id = targetImgElement.dataset.id;
      } else {
        item.id = "item-" + Date.now().toString(36) + "-" + Math.random().toString(36).substr(2, 5);
      }
    }
    if (targetImgElement) {
      targetImgElement.dataset.id = item.id;
    }
    activeRatingItem = item;

    if (inlineRatingItemTitle) {
      inlineRatingItemTitle.textContent = item.title || "Item sem título";
    }

    const editInlineItemTitleBtn = document.getElementById("edit-inline-item-title-btn");
    const handleRename = () => {
      const currentTitle = item.title && !item.title.toLowerCase().startsWith("image.") ? item.title : "";
      const newTitle = prompt("Digite o título/nome deste item:", currentTitle);
      if (newTitle !== null && newTitle.trim()) {
        item.title = newTitle.trim();
        if (inlineRatingItemTitle) inlineRatingItemTitle.textContent = item.title;
        if (targetImgElement) targetImgElement.title = item.title;

        // Update title across board state
        tiersData.forEach(t => {
          (t.items || []).forEach(i => {
            if (i.id === item.id || (i.src && i.src === item.src)) i.title = item.title;
          });
        });
        bankData.forEach(i => {
          if (i.id === item.id || (i.src && i.src === item.src)) i.title = item.title;
        });
        unvotedBankData.forEach(i => {
          if (i.id === item.id || (i.src && i.src === item.src)) i.title = item.title;
        });

        saveBoardState();
        autoSaveActiveBoard();
      }
    };

    if (editInlineItemTitleBtn) {
      editInlineItemTitleBtn.onclick = handleRename;
    }
    if (inlineRatingItemTitle) {
      inlineRatingItemTitle.onclick = handleRename;
    }

    const singleRatingContainer = document.getElementById("single-rating-container");
    const parametersRatingContainer = document.getElementById("parameters-rating-container");
    const inlineRatingValueLabel = document.getElementById("inline-rating-value-label");

    const sessionUser = localStorage.getItem("roleta-nmdp-session") || "Anônimo";
    const ratings = activeBoardRatings[item.id] || [];
    const myRatingObj = ratings.find(r => (r.userName || "").toLowerCase() === sessionUser.toLowerCase());
    const myCurrentScore = myRatingObj ? myRatingObj.score : 5.0;
    const myParamScores = (myRatingObj && myRatingObj.paramScores) ? myRatingObj.paramScores : {};

    if (Array.isArray(activeBoardParameters) && activeBoardParameters.length > 0) {
      if (singleRatingContainer) singleRatingContainer.style.display = "none";
      if (parametersRatingContainer) parametersRatingContainer.style.display = "flex";
      if (inlineRatingValueLabel) inlineRatingValueLabel.style.display = "block";

      if (parametersRatingContainer) {
        parametersRatingContainer.innerHTML = "";

        const updateCalculatedAverage = () => {
          const sliders = parametersRatingContainer.querySelectorAll(".param-rating-slider");
          if (sliders.length === 0) return;
          let sum = 0;
          sliders.forEach(s => sum += Number(s.value));
          const avg = Math.round((sum / sliders.length) * 10) / 10;
          if (inlineRatingValue) {
            inlineRatingValue.textContent = `${avg.toFixed(1)} / 10`;
          }
        };

        activeBoardParameters.forEach(paramName => {
          const row = document.createElement("div");
          row.style.display = "flex";
          row.style.flexDirection = "column";
          row.style.gap = "0.2rem";

          const header = document.createElement("div");
          header.style.display = "flex";
          header.style.justifyContent = "space-between";
          header.style.fontSize = "0.75rem";
          header.style.fontWeight = "700";
          header.style.color = "var(--text)";

          const titleSpan = document.createElement("span");
          titleSpan.textContent = paramName;

          const valSpan = document.createElement("span");
          valSpan.className = "param-value-badge";
          valSpan.style.color = "#ffd700";
          const initVal = myParamScores[paramName] !== undefined ? myParamScores[paramName] : myCurrentScore;
          valSpan.textContent = `${Number(initVal).toFixed(1)} / 10`;

          header.appendChild(titleSpan);
          header.appendChild(valSpan);

          const slider = document.createElement("input");
          slider.type = "range";
          slider.min = "0";
          slider.max = "10";
          slider.step = "0.1";
          slider.value = initVal;
          slider.className = "param-rating-slider";
          slider.dataset.param = paramName;
          slider.style.width = "100%";
          slider.style.height = "6px";
          slider.style.borderRadius = "3px";
          slider.style.accentColor = "var(--accent)";
          slider.style.cursor = "pointer";

          slider.addEventListener("input", () => {
            valSpan.textContent = `${Number(slider.value).toFixed(1)} / 10`;
            updateCalculatedAverage();
          });

          row.appendChild(header);
          row.appendChild(slider);
          parametersRatingContainer.appendChild(row);
        });

        updateCalculatedAverage();
      }
    } else {
      if (singleRatingContainer) singleRatingContainer.style.display = "block";
      if (parametersRatingContainer) parametersRatingContainer.style.display = "none";
      if (inlineRatingValueLabel) inlineRatingValueLabel.style.display = "none";

      if (inlineRatingSlider) {
        inlineRatingSlider.value = myCurrentScore;
      }
      if (inlineRatingValue) {
        inlineRatingValue.textContent = `${Number(myCurrentScore).toFixed(1)} / 10`;
      }
    }

    // Calculate position relative to targetImgElement
    if (targetImgElement) {
      const rect = targetImgElement.getBoundingClientRect();
      const cardWidth = 290;
      
      let left = window.scrollX + rect.left + (rect.width / 2) - (cardWidth / 2);
      let top = window.scrollY + rect.bottom + 8;

      // Ensure card stays within viewport
      if (left < 10) left = 10;
      if (left + cardWidth > window.innerWidth - 20) {
        left = window.innerWidth - cardWidth - 20;
      }

      inlineRatingCard.style.left = `${left}px`;
      inlineRatingCard.style.top = `${top}px`;
    }

    // Render list of votes with delete option for lele
    let votesListContainer = document.getElementById("inline-rating-votes-list");
    if (!votesListContainer) {
      votesListContainer = document.createElement("div");
      votesListContainer.id = "inline-rating-votes-list";
      votesListContainer.style.marginTop = "0.75rem";
      votesListContainer.style.borderTop = "1px solid var(--border)";
      votesListContainer.style.paddingTop = "0.5rem";
      votesListContainer.style.fontSize = "0.75rem";
      votesListContainer.style.maxHeight = "120px";
      votesListContainer.style.overflowY = "auto";
      inlineRatingCard.appendChild(votesListContainer);
    }

    const isLele = loadSessionUser().toLowerCase() === "lele";
    votesListContainer.innerHTML = "";

    if (ratings.length > 0) {
      const header = document.createElement("div");
      header.style.fontWeight = "700";
      header.style.marginBottom = "0.35rem";
      header.style.color = "var(--text-muted)";
      header.textContent = "Votos Registrados:";
      votesListContainer.appendChild(header);

      ratings.forEach(r => {
        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.justifyContent = "space-between";
        row.style.alignItems = "center";
        row.style.marginBottom = "0.25rem";

        const text = document.createElement("span");
        let paramSubtext = "";
        if (r.paramScores && typeof r.paramScores === "object") {
          const parts = Object.entries(r.paramScores).map(([k, v]) => `${k}: ${v}`);
          if (parts.length > 0) {
            paramSubtext = `<br/><span style="font-size: 0.68rem; color: var(--text-muted);">(${parts.join(", ")})</span>`;
          }
        }
        text.innerHTML = `👤 <strong>${r.userName}</strong>: ⭐ ${r.score}/10${paramSubtext}`;
        row.appendChild(text);

        if (isLele) {
          const delBtn = document.createElement("button");
          delBtn.type = "button";
          delBtn.textContent = "🗑️";
          delBtn.title = `Remover voto de ${r.userName}`;
          delBtn.className = "btn-danger-sm";
          delBtn.style.padding = "0.1rem 0.35rem";
          delBtn.style.fontSize = "0.65rem";
          delBtn.style.borderRadius = "4px";

          delBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            closeInlineRatingCard();
            await removeUserItemRating(item.id, r.userName);
          });

          row.appendChild(delBtn);
        }

        votesListContainer.appendChild(row);
      });
    }

    inlineRatingCard.style.display = "flex";
  }

  function closeInlineRatingCard() {
    if (inlineRatingCard) {
      inlineRatingCard.style.display = "none";
    }
  }

  if (closeInlineRatingBtn) {
    closeInlineRatingBtn.addEventListener("click", closeInlineRatingCard);
  }

  if (submitInlineRatingBtn) {
    submitInlineRatingBtn.addEventListener("click", async () => {
      if (!activeRatingItem) return;

      const parametersRatingContainer = document.getElementById("parameters-rating-container");
      if (Array.isArray(activeBoardParameters) && activeBoardParameters.length > 0 && parametersRatingContainer) {
        const sliders = parametersRatingContainer.querySelectorAll(".param-rating-slider");
        const paramScores = {};
        let sum = 0;
        sliders.forEach(s => {
          const val = Number(s.value);
          paramScores[s.dataset.param] = val;
          sum += val;
        });
        const finalScore = Math.round((sum / Math.max(1, sliders.length)) * 10) / 10;
        closeInlineRatingCard();
        await submitItemRating(activeRatingItem.id, finalScore, paramScores);
      } else if (inlineRatingSlider) {
        const score = Number(inlineRatingSlider.value);
        closeInlineRatingCard();
        await submitItemRating(activeRatingItem.id, score, null);
      }
    });
  }

  // Close rating popover on click outside
  window.addEventListener("click", (e) => {
    if (inlineRatingCard && inlineRatingCard.style.display !== "none") {
      if (!inlineRatingCard.contains(e.target) && !e.target.classList.contains("tier-item-img")) {
        closeInlineRatingCard();
      }
    }
  });

  function createItemElement(item) {
    if (!item.id) {
      item.id = "item-" + Date.now().toString(36) + "-" + Math.random().toString(36).substr(2, 5);
    }
    const wrapper = document.createElement("div");
    wrapper.className = "tier-item-wrapper";
    wrapper.dataset.id = item.id;
    wrapper.style.position = "relative";
    wrapper.style.display = "inline-flex";
    wrapper.style.alignItems = "center";
    wrapper.style.justifyContent = "center";

    const img = document.createElement("img");
    img.className = "tier-item-img";
    img.src = item.src;
    img.dataset.id = item.id;
    img.title = item.title || "";
    img.draggable = true;

    setupDragEvents(wrapper);
    setupHoverPreview(img);

    // Check if current session user has voted on this item
    const sessionUser = (localStorage.getItem("roleta-nmdp-session") || "Anônimo").toLowerCase();
    const itemRatings = activeBoardRatings[item.id] || [];
    const hasVoted = itemRatings.some(r => (r.userName || "").toLowerCase() === sessionUser);

    if (!hasVoted && canUserVoteOnActiveBoard()) {
      const badge = document.createElement("span");
      badge.className = "unvoted-warning-badge";
      badge.title = "Você ainda não avaliou este item!";
      badge.textContent = "⚠️";
      wrapper.appendChild(badge);
    }

    wrapper.appendChild(img);

    // Click on item inside tier list row opens Floating Inline Rating Card Popover
    img.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!canUserVoteOnActiveBoard()) {
        const creatorName = activeBoardCreatedBy || "o criador";
        alert(`Apenas o criador deste tabuleiro (${creatorName}) pode votar nele.`);
        return;
      }
      openInlineRatingCard(item, img);
    });

    return wrapper;
  }

  // --- Drag and Drop Logic ---

  function setupDragEvents(el) {
    el.addEventListener("dragstart", (e) => {
      if (!canUserVoteOnActiveBoard()) {
        e.preventDefault();
        return false;
      }
      draggedEl = el;
      el.classList.add("dragging");
      e.dataTransfer.setData("text/plain", el.dataset.id);
      e.dataTransfer.effectAllowed = "move";
    });

    el.addEventListener("dragend", () => {
      if (draggedEl) {
        draggedEl.classList.remove("dragging");
      }
      draggedEl = null;
      saveBoardState();
    });
  }

  // --- Hover Preview Logic ---

  function setupHoverPreview(el) {
    el.addEventListener("mouseenter", (e) => {
      // Don't show preview if dragging
      if (draggedEl) return;

      const previewImg = document.getElementById("image-hover-preview-img");
      const previewTitle = document.getElementById("image-hover-preview-title");
      const previewPopup = document.getElementById("image-hover-preview");

      if (previewImg && previewTitle && previewPopup) {
        previewImg.src = el.src;
        previewTitle.textContent = el.title || "Sem Título";

        // Display Ratings Readout & User Breakdown List (0-10 Scale)
        const itemId = el.dataset.id;
        const stats = getItemRatingStats(itemId);

        if (imageHoverPreviewRatingBox && hoverAvgRating && hoverUserRatingsList) {
          imageHoverPreviewRatingBox.style.display = "block";
          if (stats.count > 0) {
            const isLeleHover = loadSessionUser().toLowerCase() === "lele";
            hoverAvgRating.innerHTML = `⭐ Média: <strong>${stats.avg} / 10</strong> (${stats.count} ${stats.count === 1 ? 'voto' : 'votos'})`;
            hoverUserRatingsList.innerHTML = "";
            
            stats.ratings.forEach(r => {
              const itemDiv = document.createElement("div");
              itemDiv.className = "hover-rating-item";
              itemDiv.style.display = "flex";
              itemDiv.style.justifyContent = "space-between";
              itemDiv.style.alignItems = "center";

              const infoSpan = document.createElement("span");
              infoSpan.innerHTML = `👤 <strong>${r.userName}</strong>: <span style="color:#ffd700; font-weight:bold;">⭐ ${r.score}/10</span>`;
              itemDiv.appendChild(infoSpan);

              if (isLeleHover) {
                const delBtn = document.createElement("button");
                delBtn.type = "button";
                delBtn.textContent = "❌";
                delBtn.title = `Remover voto de ${r.userName}`;
                delBtn.style.background = "none";
                delBtn.style.border = "none";
                delBtn.style.color = "#ff4d4d";
                delBtn.style.cursor = "pointer";
                delBtn.style.fontSize = "0.75rem";
                delBtn.style.padding = "0 0.2rem";

                delBtn.addEventListener("click", async (e) => {
                  e.stopPropagation();
                  await removeUserItemRating(itemId, r.userName);
                  hideHoverPreview();
                });

                itemDiv.appendChild(delBtn);
              }

              hoverUserRatingsList.appendChild(itemDiv);
            });
          } else {
            hoverAvgRating.innerHTML = `⭐ <em>Sem avaliações ainda</em>`;
            if (canUserVoteOnActiveBoard()) {
              hoverUserRatingsList.innerHTML = `<span style="text-align:center; font-style:italic; font-size: 0.7rem;">Clique no item para dar sua nota!</span>`;
            } else {
              const creatorName = activeBoardCreatedBy || "o criador";
              hoverUserRatingsList.innerHTML = `<span style="text-align:center; font-style:italic; font-size: 0.7rem;">Apenas o criador (${creatorName}) pode votar neste tabuleiro.</span>`;
            }
          }
        }

        // Position popup near cursor
        previewPopup.style.display = "block";
        previewPopup.style.left = e.clientX + "px";
        previewPopup.style.top = e.clientY + "px";

        // Trigger transition fade-in
        setTimeout(() => {
          previewPopup.classList.add("visible");
        }, 10);
      }
    });

    el.addEventListener("mousemove", (e) => {
      const previewPopup = document.getElementById("image-hover-preview");
      if (previewPopup && previewPopup.classList.contains("visible")) {
        previewPopup.style.left = e.clientX + "px";
        previewPopup.style.top = e.clientY + "px";
      }
    });

    el.addEventListener("mouseleave", () => {
      hideHoverPreview();
    });

    el.addEventListener("dragstart", () => {
      hideHoverPreview();
    });
  }

  function hideHoverPreview() {
    const previewPopup = document.getElementById("image-hover-preview");
    if (previewPopup) {
      previewPopup.classList.remove("visible");
      // Hide container after transition ends
      setTimeout(() => {
        if (!previewPopup.classList.contains("visible")) {
          previewPopup.style.display = "none";
        }
      }, 150);
    }
  }

  function setupDropzoneEvents(zone) {
    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (!canUserVoteOnActiveBoard()) return;
      zone.classList.add("drag-over");

      // Implement inline sorting placement
      if (draggedEl) {
        const afterElement = getDragAfterElement(zone, e.clientX);
        if (afterElement == null) {
          zone.appendChild(draggedEl);
        } else {
          zone.insertBefore(draggedEl, afterElement);
        }
      }
    });

    zone.addEventListener("dragenter", (e) => {
      e.preventDefault();
      if (!canUserVoteOnActiveBoard()) return;
      zone.classList.add("drag-over");
    });

    zone.addEventListener("dragleave", () => {
      zone.classList.remove("drag-over");
    });

    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("drag-over");
      if (!canUserVoteOnActiveBoard()) return;

      if (draggedEl) {
        const afterElement = getDragAfterElement(zone, e.clientX);
        if (afterElement == null) {
          zone.appendChild(draggedEl);
        } else {
          zone.insertBefore(draggedEl, afterElement);
        }
      }
      saveBoardState();

      if (draggedEl && zone.classList.contains("tier-items")) {
        const img = draggedEl.querySelector(".tier-item-img") || draggedEl;
        const itemId = img.dataset.id;
        const stats = getItemRatingStats(itemId);
        if (stats.count === 0) {
          const item = {
            id: itemId,
            src: img.src,
            title: img.title || ""
          };
          openInlineRatingCard(item, img);
        }
      }
    });
  }

  function getDragAfterElement(container, x) {
    const draggableElements = [...container.querySelectorAll(".tier-item-img:not(.dragging)")];
    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = x - box.left - box.width / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  // --- Row Settings Management ---

  function renderColorPresets() {
    presetsGrid.innerHTML = "";
    PRESET_COLORS.forEach(color => {
      const box = document.createElement("div");
      box.className = "color-box";
      box.style.backgroundColor = color.hex;
      box.dataset.hex = color.hex;
      box.title = color.name;

      if (color.hex === selectedPresetColor) {
        box.classList.add("selected");
      }

      box.addEventListener("click", () => {
        presetsGrid.querySelectorAll(".color-box").forEach(b => b.classList.remove("selected"));
        box.classList.add("selected");
        selectedPresetColor = color.hex;
      });

      presetsGrid.appendChild(box);
    });
  }

  function openRowSettings(rowId) {
    activeEditingRowId = rowId;
    const tier = tiersData.find(t => t.id === rowId);
    const rowEl = document.querySelector(`.tier-row[data-id="${rowId}"]`);
    if (!rowEl) return;

    const labelEl = rowEl.querySelector(".tier-label");
    const nameSpan = labelEl.querySelector("span");
    rowLabelInput.value = nameSpan ? nameSpan.textContent.trim() : labelEl.textContent.trim();
    selectedPresetColor = labelEl.dataset.color || "#95a5a6";

    const minScoreInput = document.getElementById("row-min-score-input");
    const minScoreGroup = document.getElementById("row-min-score-group");
    const isLele = canUserEditActiveBoard();

    if (minScoreGroup) {
      minScoreGroup.style.display = isLele ? "block" : "none";
    }
    if (minScoreInput) {
      const rowIndex = tiersData.findIndex(t => t.id === rowId);
      const currentMinScore = (tier && typeof tier.minScore === "number") ? tier.minScore : getRowMinScore(tier || {}, rowIndex, tiersData.length);
      minScoreInput.value = currentMinScore;
    }

    renderColorPresets();
    rowSettingsOverlay.hidden = false;
  }

  function closeRowSettings() {
    rowSettingsOverlay.hidden = true;
    activeEditingRowId = null;
  }

  // Bind Settings actions
  cancelRowSettingsBtn.addEventListener("click", closeRowSettings);

  saveRowSettingsBtn.addEventListener("click", () => {
    if (!activeEditingRowId) return;

    const tier = tiersData.find(t => t.id === activeEditingRowId);
    const minScoreInput = document.getElementById("row-min-score-input");

    if (tier && minScoreInput && canUserEditActiveBoard()) {
      const parsedVal = parseFloat(minScoreInput.value);
      if (!isNaN(parsedVal)) {
        tier.minScore = Math.max(0, Math.min(10, parsedVal));
      }
    }

    const newTitle = rowLabelInput.value.trim() || "NEW";
    if (tier) {
      tier.name = newTitle;
      tier.color = selectedPresetColor;
    }

    const rowEl = document.querySelector(`.tier-row[data-id="${activeEditingRowId}"]`);
    if (rowEl) {
      const labelEl = rowEl.querySelector(".tier-label");
      labelEl.dataset.color = selectedPresetColor;
      labelEl.style.backgroundColor = selectedPresetColor;
    }

    if (activeBoardIsFeatured) {
      applyFeaturedAutoSorting();
      if (supabase) autoSaveFeaturedBoard();
    } else {
      renderBoard();
    }
    saveBoardState();
    closeRowSettings();
  });

  // --- Admin Rating Thresholds Overview Modal ---
  const openThresholdsModalBtn = document.getElementById("open-thresholds-modal-btn");
  const thresholdsOverlay = document.getElementById("thresholds-overlay");
  const thresholdsRowsList = document.getElementById("thresholds-rows-list");
  const cancelThresholdsBtn = document.getElementById("cancel-thresholds-btn");
  const saveThresholdsBtn = document.getElementById("save-thresholds-btn");

  function openThresholdsModal() {
    if (!thresholdsOverlay || !thresholdsRowsList) return;
    thresholdsRowsList.innerHTML = "";

    tiersData.forEach((tier, idx) => {
      const rowItem = document.createElement("div");
      rowItem.style.display = "flex";
      rowItem.style.alignItems = "center";
      rowItem.style.justifyContent = "space-between";
      rowItem.style.padding = "0.6rem 0.8rem";
      rowItem.style.background = "var(--surface-raised)";
      rowItem.style.border = "1px solid var(--border)";
      rowItem.style.borderRadius = "8px";
      rowItem.style.gap = "0.75rem";

      const left = document.createElement("div");
      left.style.display = "flex";
      left.style.alignItems = "center";
      left.style.gap = "0.6rem";

      const colorBox = document.createElement("div");
      colorBox.style.width = "24px";
      colorBox.style.height = "24px";
      colorBox.style.borderRadius = "4px";
      colorBox.style.backgroundColor = tier.color || "#95a5a6";

      const label = document.createElement("span");
      label.style.fontWeight = "700";
      label.style.fontSize = "0.95rem";
      label.textContent = tier.name || `Linha ${idx + 1}`;

      left.appendChild(colorBox);
      left.appendChild(label);

      const right = document.createElement("div");
      right.style.display = "flex";
      right.style.alignItems = "center";
      right.style.gap = "0.4rem";

      const inputLabel = document.createElement("span");
      inputLabel.style.fontSize = "0.8rem";
      inputLabel.style.color = "var(--text-muted)";
      inputLabel.textContent = "Nota Mínima:";

      const numInput = document.createElement("input");
      numInput.type = "number";
      numInput.className = "input-text-sm threshold-input";
      numInput.style.width = "75px";
      numInput.style.textAlign = "center";
      numInput.min = "0";
      numInput.max = "10";
      numInput.step = "0.1";
      numInput.dataset.rowId = tier.id;
      numInput.value = getRowMinScore(tier, idx, tiersData.length);

      right.appendChild(inputLabel);
      right.appendChild(numInput);

      rowItem.appendChild(left);
      rowItem.appendChild(right);
      thresholdsRowsList.appendChild(rowItem);
    });

    thresholdsOverlay.hidden = false;
  }

  if (openThresholdsModalBtn) {
    openThresholdsModalBtn.addEventListener("click", openThresholdsModal);
  }

  if (cancelThresholdsBtn) {
    cancelThresholdsBtn.addEventListener("click", () => {
      if (thresholdsOverlay) thresholdsOverlay.hidden = true;
    });
  }

  if (saveThresholdsBtn) {
    saveThresholdsBtn.addEventListener("click", async () => {
      const inputs = thresholdsRowsList.querySelectorAll(".threshold-input");
      inputs.forEach(input => {
        const rId = input.dataset.rowId;
        const val = parseFloat(input.value);
        const tier = tiersData.find(t => t.id === rId);
        if (tier && !isNaN(val)) {
          tier.minScore = Math.max(0, Math.min(10, val));
        }
      });

      if (thresholdsOverlay) thresholdsOverlay.hidden = true;

      applyFeaturedAutoSorting();
      saveBoardState();

      if (supabase) {
        await autoSaveActiveBoard();
      }

      showAutoSaveToast("📊 Requisitos de notas atualizados e tabuleiro re-ordenado!");
    });
  }

  deleteRowConfirmBtn.addEventListener("click", () => {
    if (!activeEditingRowId) return;

    const rowEl = document.querySelector(`.tier-row[data-id="${activeEditingRowId}"]`);
    if (rowEl) {
      // Return images back to reservoir bank
      rowEl.querySelectorAll(".tier-item-img").forEach(img => {
        bankContainer.appendChild(img);
      });
      rowEl.remove();
      saveBoardState();
    }
    closeRowSettings();
  });

  // --- Row operations ---

  function moveRow(rowId, direction) {
    const rows = [...boardContainer.querySelectorAll(".tier-row")];
    const index = rows.findIndex(r => r.dataset.id === rowId);
    if (index === -1) return;

    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= rows.length) return;

    const rowEl = rows[index];
    const targetEl = rows[newIndex];

    if (direction < 0) {
      boardContainer.insertBefore(rowEl, targetEl);
    } else {
      boardContainer.insertBefore(rowEl, targetEl.nextSibling);
    }
    saveBoardState();
  }

  addRowBtn.addEventListener("click", () => {
    const id = "row-" + Date.now().toString(36);
    const newTier = {
      id: id,
      name: "NEW",
      color: "#95a5a6",
      items: []
    };

    const rowEl = createRowElement(newTier);
    boardContainer.appendChild(rowEl);
    saveBoardState();
  });

  resetTiersBtn.addEventListener("click", () => {
    const confirmReset = confirm("Tem certeza que deseja resetar todas as categorias para o padrão? As imagens retornarão ao banco.");
    if (!confirmReset) return;

    // Move all items to bank
    document.querySelectorAll(".tier-item-img").forEach(img => {
      bankContainer.appendChild(img);
    });

    // Rebuild default tiers
    tiersData = JSON.parse(JSON.stringify(DEFAULT_TIERS));
    renderBoard();
    saveBoardState();
  });

  clearItemsBtn.addEventListener("click", () => {
    const confirmClear = confirm("Tem certeza que deseja mover todas as imagens de volta ao banco?");
    if (!confirmClear) return;

    document.querySelectorAll(".tier-row .tier-item-img").forEach(img => {
      bankContainer.appendChild(img);
    });
    saveBoardState();
  });

  clearAllBtn.addEventListener("click", () => {
    const confirmClearAll = confirm("Tem certeza que deseja esvaziar todo o tabuleiro e deletar todas as imagens?");
    if (!confirmClearAll) return;

    bankContainer.innerHTML = "";
    document.querySelectorAll(".tier-items").forEach(zone => {
      zone.innerHTML = "";
    });

    tiersData = JSON.parse(JSON.stringify(DEFAULT_TIERS));
    renderBoard();
    saveBoardState();
  });

  // --- Upload Images (Local Files) ---

  function convertToWebP(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");

          const maxDim = 200;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxDim) {
              height *= maxDim / width;
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width *= maxDim / height;
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          resolve(canvas.toDataURL("image/webp", 0.8));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function handleFilesUpload(files) {
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      try {
        const webpSrc = await convertToWebP(file);
        let titleName = file.name.replace(/\.[^/.]+$/, ""); // strip extension
        if (!titleName || titleName.toLowerCase() === "image" || titleName.toLowerCase() === "blob") {
          titleName = "Novo Item";
        }
        const item = {
          id: "item-" + Math.random().toString(36).slice(2, 9),
          src: webpSrc,
          title: titleName
        };

        const imgEl = createItemElement(item);
        bankContainer.appendChild(imgEl);
      } catch (err) {
        console.error("Erro ao converter arquivo:", file.name, err);
      }
    }
    saveBoardState();
  }

  // Setup drag-and-drop & clipboard paste file upload triggers
  if (addStockImagesBtn) {
    addStockImagesBtn.addEventListener("click", () => fileInputUpload.click());
  }

  fileInputUpload.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      handleFilesUpload(e.target.files);
      fileInputUpload.value = "";
    }
  });

  bankContainer.addEventListener("dragover", (e) => {
    e.preventDefault();
    bankContainer.classList.add("drag-over");
  });

  bankContainer.addEventListener("dragleave", () => {
    bankContainer.classList.remove("drag-over");
  });

  bankContainer.addEventListener("drop", (e) => {
    e.preventDefault();
    bankContainer.classList.remove("drag-over");
    if (e.dataTransfer.files.length > 0) {
      handleFilesUpload(e.dataTransfer.files);
    }
  });

  // Global Clipboard Paste Event
  window.addEventListener("paste", (e) => {
    if (!activeEditing) return;

    const items = e.clipboardData.items;
    let foundImage = false;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          foundImage = true;
          handleFilesUpload([file]);
        }
      }
    }

    if (foundImage) {
      e.preventDefault();
    }
  });

  // --- Search & Add Existing Cards by Title to Bank ---
  const tierSearchCardInput = document.getElementById("tier-search-card-input");
  const tierCardSuggestions = document.getElementById("tier-card-suggestions");
  let cachedDbCardsForSearch = null;
  let tierSearchTimeout = null;

  async function getDbCardsForSearch() {
    if (cachedDbCardsForSearch) return cachedDbCardsForSearch;
    if (!supabase) return [];
    try {
      const { data, error } = await supabase.from("cards").select("id, title, image_data_url, votes");
      if (error) throw error;
      cachedDbCardsForSearch = data || [];
      return cachedDbCardsForSearch;
    } catch (e) {
      console.warn("Erro ao buscar cards para pesquisa na tier list:", e);
      return [];
    }
  }

  if (tierSearchCardInput) {
    tierSearchCardInput.addEventListener("input", () => {
      clearTimeout(tierSearchTimeout);
      tierSearchTimeout = setTimeout(renderTierSearchSuggestions, 120);
    });

    tierSearchCardInput.addEventListener("focus", () => {
      if (tierSearchCardInput.value.trim().length >= 1) {
        renderTierSearchSuggestions();
      }
    });

    tierSearchCardInput.addEventListener("keydown", (e) => {
      if (!tierCardSuggestions || tierCardSuggestions.hidden) return;
      const items = tierCardSuggestions.querySelectorAll(".suggestion-item");
      if (items.length === 0) return;
      const activeItem = tierCardSuggestions.querySelector(".suggestion-item.active");
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
        tierCardSuggestions.hidden = true;
      }
    });
  }

  async function renderTierSearchSuggestions() {
    if (!tierCardSuggestions || !tierSearchCardInput) return;
    const query = tierSearchCardInput.value.trim().toLowerCase();
    if (query.length < 1) {
      tierCardSuggestions.innerHTML = "";
      tierCardSuggestions.hidden = true;
      return;
    }

    const allCards = await getDbCardsForSearch();
    const matches = [];
    for (const c of allCards) {
      if (!c.title || !c.image_data_url) continue;
      if (c.title.toLowerCase().includes(query)) {
        matches.push(c);
        if (matches.length >= 8) break;
      }
    }

    if (matches.length === 0) {
      tierCardSuggestions.innerHTML = "";
      tierCardSuggestions.hidden = true;
      return;
    }

    tierCardSuggestions.innerHTML = "";
    matches.forEach(card => {
      const item = document.createElement("div");
      item.className = "suggestion-item";

      const thumb = document.createElement("img");
      thumb.className = "suggestion-thumb";
      thumb.src = card.image_data_url;

      const info = document.createElement("div");
      info.className = "suggestion-info";

      const titleEl = document.createElement("div");
      titleEl.className = "suggestion-title";
      const idx = card.title.toLowerCase().indexOf(query);
      if (idx !== -1) {
        const before = card.title.substring(0, idx);
        const match = card.title.substring(idx, idx + query.length);
        const after = card.title.substring(idx + query.length);
        titleEl.innerHTML = `${before}<strong style="color:var(--accent); text-decoration:underline;">${match}</strong>${after}`;
      } else {
        titleEl.textContent = card.title;
      }

      const meta = document.createElement("div");
      meta.className = "suggestion-meta";
      meta.textContent = `Card cadastrado (${card.votes || 0} votos)`;

      info.appendChild(titleEl);
      info.appendChild(meta);
      item.appendChild(thumb);
      item.appendChild(info);

      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        // Check if this card is already in the board / bank
        const exists = [...document.querySelectorAll(".tier-item-img")].some(
          img => img.src === card.image_data_url || img.dataset.id === "item-" + card.id
        );

        if (exists) {
          alert(`O item "${card.title}" já está presente neste tabuleiro!`);
          tierCardSuggestions.hidden = true;
          return;
        }

        const newItem = {
          id: "item-" + card.id,
          src: card.image_data_url,
          title: card.title
        };

        const imgEl = createItemElement(newItem);
        bankContainer.appendChild(imgEl);
        saveBoardState();

        tierSearchCardInput.value = "";
        tierCardSuggestions.innerHTML = "";
        tierCardSuggestions.hidden = true;

        // Auto save if active
        autoSaveActiveBoard();
      });

      tierCardSuggestions.appendChild(item);
    });

    tierCardSuggestions.hidden = false;
  }

  document.addEventListener("click", (e) => {
    if (tierCardSuggestions && !tierCardSuggestions.contains(e.target) && e.target !== tierSearchCardInput) {
      tierCardSuggestions.hidden = true;
    }
  });

  // --- Supabase Cards Importing ---

  function cardBelongsToGallery(card, owner, slug) {
    const cid = card.id || "";
    const lowerOwner = (owner || "").toLowerCase();
    const lowerSlug = (slug || "").toLowerCase();

    if (lowerOwner === "lele") {
      if (lowerSlug === "games") {
        if (cid.startsWith("u_lele__games_")) return true;
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

  async function fetchCustomGalleries() {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase.from("users").select("name, voted_card_ids");
      if (error) throw error;
      const galleries = [];
      (data || []).forEach(u => {
        if (u.name && u.name.startsWith("__gallery_def__")) {
          try {
            const raw = (u.voted_card_ids || []).join("");
            const parsed = JSON.parse(raw);
            if (parsed && parsed.owner && parsed.slug) {
              galleries.push(parsed);
            }
          } catch (e) {
            console.warn("Erro ao fazer parse da galeria:", u.name, e);
          }
        }
      });
      return galleries;
    } catch (e) {
      console.error("Erro ao buscar galerias customizadas:", e);
      return [];
    }
  }

  openImportModalBtn.addEventListener("click", async () => {
    if (!supabase) {
      alert("A conexão com o banco de dados não está configurada!");
      return;
    }

    // Load custom galleries dynamically into import modal
    const customListEl = document.getElementById("dynamic-custom-galleries-import-list");
    if (customListEl) {
      customListEl.innerHTML = "";
      const customGals = await fetchCustomGalleries();
      customGals.forEach(g => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn-secondary";
        btn.style.padding = "0.85rem";
        btn.style.fontSize = "1rem";
        btn.style.width = "100%";
        btn.style.display = "flex";
        btn.style.alignItems = "center";
        btn.style.justifyContent = "center";
        btn.style.gap = "0.5rem";

        const iconSpan = document.createElement("span");
        iconSpan.textContent = g.icon || "📁";
        const nameStrong = document.createElement("strong");
        nameStrong.textContent = g.name;
        const ownerSpan = document.createElement("span");
        ownerSpan.style.fontSize = "0.8rem";
        ownerSpan.style.color = "var(--text-muted)";
        ownerSpan.textContent = `(${g.owner})`;

        btn.appendChild(iconSpan);
        btn.appendChild(nameStrong);
        btn.appendChild(ownerSpan);

        btn.addEventListener("click", () => executeImport({ owner: g.owner, slug: g.slug }));
        customListEl.appendChild(btn);
      });
    }

    importOverlay.hidden = false;
  });

  cancelImportBtn.addEventListener("click", () => {
    importOverlay.hidden = true;
  });

  async function executeImport(target) {
    importOverlay.hidden = true;
    try {
      let query = supabase.from("cards").select("id, title, image_data_url, votes");
      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        alert("Nenhum card cadastrado no banco de dados.");
        return;
      }

      let importedCount = 0;
      data.forEach(card => {
        if (!card.image_data_url) return;

        // 1. Filter Category / Gallery
        if (target === "games" && !cardBelongsToGallery(card, "lele", "games")) return;
        if (target === "anime" && !cardBelongsToGallery(card, "lele", "anime")) return;
        if (target === "filmes" && !cardBelongsToGallery(card, "lele", "filmes")) return;
        if (typeof target === "object" && target.owner && target.slug) {
          if (!cardBelongsToGallery(card, target.owner, target.slug)) return;
        }

        // Check if already imported
        const exists = [...document.querySelectorAll(".tier-item-img")].some(
          img => img.src === card.image_data_url
        );
        if (exists) return;

        const item = {
          id: "item-" + card.id,
          src: card.image_data_url,
          title: card.title
        };

        const imgEl = createItemElement(item);
        bankContainer.appendChild(imgEl);
        importedCount++;
      });

      if (importedCount > 0) {
        saveBoardState();
        alert(`${importedCount} imagens importadas com sucesso!`);
      } else {
        alert("Nenhuma imagem nova encontrada para importar.");
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao carregar cards do banco de dados!");
    }
  }

  document.getElementById("import-games-choice-btn").addEventListener("click", () => executeImport("games"));
  document.getElementById("import-anime-choice-btn").addEventListener("click", () => executeImport("anime"));
  document.getElementById("import-filmes-choice-btn").addEventListener("click", () => executeImport("filmes"));
  document.getElementById("import-all-choice-btn").addEventListener("click", () => executeImport("all"));

  // --- Export Presentation Image (html2canvas) with Download and Copy ---

  if (closeExportModalBtn) {
    closeExportModalBtn.addEventListener("click", () => {
      if (exportPreviewOverlay) exportPreviewOverlay.hidden = true;
    });
  }

  if (exportPreviewOverlay) {
    exportPreviewOverlay.addEventListener("click", (e) => {
      if (e.target === exportPreviewOverlay) {
        exportPreviewOverlay.hidden = true;
      }
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && exportPreviewOverlay && !exportPreviewOverlay.hidden) {
      exportPreviewOverlay.hidden = true;
    }
  });

  downloadPngBtn.addEventListener("click", async () => {
    const originalText = downloadPngBtn.textContent;
    downloadPngBtn.disabled = true;
    downloadPngBtn.textContent = "⏳ Diagramando...";

    let presentationContainer = null;
    try {
      const titleText = (activeTierlistTitle ? activeTierlistTitle.textContent.trim() : "Tier List") || "Tier List";
      activeExportTitle = titleText;

      // 1. Create offscreen presentation wrapper
      presentationContainer = document.createElement("div");
      presentationContainer.id = "tier-presentation-capture";
      presentationContainer.style.position = "fixed";
      presentationContainer.style.left = "-99999px";
      presentationContainer.style.top = "0";
      presentationContainer.style.width = "1180px";
      presentationContainer.style.zIndex = "-99999";
      presentationContainer.style.pointerEvents = "none";
      presentationContainer.style.backgroundColor = "#0e1118";
      presentationContainer.style.backgroundImage = "radial-gradient(ellipse 90% 40% at 50% -10%, rgba(108, 92, 231, 0.18), rgba(14, 17, 24, 0))";
      presentationContainer.style.padding = "28px 24px 22px 24px";
      presentationContainer.style.boxSizing = "border-box";
      presentationContainer.style.fontFamily = "'Outfit', sans-serif";
      presentationContainer.style.color = "#f1f2f6";
      presentationContainer.style.display = "flex";
      presentationContainer.style.flexDirection = "column";
      presentationContainer.style.gap = "20px";

      // 2. Header: Brand, Title, and Creator
      const header = document.createElement("div");
      header.style.display = "flex";
      header.style.flexDirection = "column";
      header.style.alignItems = "center";
      header.style.justifyContent = "center";
      header.style.textAlign = "center";
      header.style.gap = "6px";
      header.style.paddingBottom = "4px";

      const brand = document.createElement("div");
      brand.style.fontSize = "0.85rem";
      brand.style.fontWeight = "700";
      brand.style.letterSpacing = "3px";
      brand.style.textTransform = "uppercase";
      brand.style.color = "#a29bfe";
      brand.textContent = "Roleta NMDP • Tier List";
      header.appendChild(brand);

      const titleEl = document.createElement("h1");
      titleEl.style.margin = "0";
      titleEl.style.fontSize = "2.35rem";
      titleEl.style.fontWeight = "800";
      titleEl.style.color = "#ffffff";
      titleEl.style.textShadow = "0 3px 14px rgba(0, 0, 0, 0.6)";
      titleEl.style.letterSpacing = "-0.5px";
      titleEl.textContent = titleText;
      header.appendChild(titleEl);

      if (activeBoardCreatedBy || activeBoardIsFeatured) {
        const sub = document.createElement("div");
        sub.style.fontSize = "0.9rem";
        sub.style.fontWeight = "600";
        sub.style.color = "#a4b0be";
        sub.style.marginTop = "2px";
        if (activeBoardIsFeatured) {
          sub.innerHTML = `<span style="color: #ffd700;">⭐ Destaque Global</span>${activeBoardCreatedBy ? ` • Criado por ${activeBoardCreatedBy}` : ""}`;
        } else if (activeBoardCreatedBy) {
          sub.textContent = `Criado por ${activeBoardCreatedBy}`;
        }
        header.appendChild(sub);
      }

      presentationContainer.appendChild(header);

      // 3. Board Container with Clean Rows (no controls, no edit buttons)
      const boardWrap = document.createElement("div");
      boardWrap.style.display = "flex";
      boardWrap.style.flexDirection = "column";
      boardWrap.style.backgroundColor = "#121520";
      boardWrap.style.border = "1px solid rgba(255, 255, 255, 0.12)";
      boardWrap.style.borderRadius = "12px";
      boardWrap.style.overflow = "hidden";
      boardWrap.style.boxShadow = "0 14px 40px rgba(0, 0, 0, 0.6)";

      const originalRows = boardContainer.querySelectorAll(".tier-row");
      originalRows.forEach((origRow, rIdx) => {
        const rowClone = document.createElement("div");
        rowClone.style.display = "flex";
        rowClone.style.minHeight = "112px";
        if (rIdx < originalRows.length - 1) {
          rowClone.style.borderBottom = "1px solid rgba(255, 255, 255, 0.08)";
        }

        // Tier Label
        const origLabel = origRow.querySelector(".tier-label");
        const labelClone = document.createElement("div");
        labelClone.style.width = "135px";
        labelClone.style.minWidth = "135px";
        labelClone.style.minHeight = "112px";
        labelClone.style.display = "flex";
        labelClone.style.alignItems = "center";
        labelClone.style.justifyContent = "center";
        labelClone.style.textAlign = "center";
        labelClone.style.padding = "10px 14px";
        labelClone.style.fontSize = "1rem";
        labelClone.style.fontWeight = "800";
        labelClone.style.color = "#0f1117";
        labelClone.style.wordBreak = "break-word";
        labelClone.style.boxShadow = "inset -4px 0 10px rgba(0,0,0,0.18)";
        labelClone.style.backgroundColor = (origLabel && (origLabel.dataset.color || origLabel.style.backgroundColor)) || "#5f27cd";
        labelClone.textContent = origLabel ? origLabel.textContent.trim() : `Tier ${rIdx + 1}`;
        rowClone.appendChild(labelClone);

        // Tier Items (stretching all the way to the right, preserving original aspect ratio)
        const itemsClone = document.createElement("div");
        itemsClone.style.flex = "1";
        itemsClone.style.minHeight = "112px";
        itemsClone.style.backgroundColor = "#0f1117";
        itemsClone.style.display = "flex";
        itemsClone.style.flexWrap = "wrap";
        itemsClone.style.alignContent = "flex-start";
        itemsClone.style.alignItems = "center";
        itemsClone.style.gap = "8px";
        itemsClone.style.padding = "8px 12px";

        const origItems = origRow.querySelectorAll(".tier-item-img");
        origItems.forEach(origImg => {
          const itemImg = document.createElement("img");
          itemImg.src = origImg.src;
          // Maintain original poster/card aspect ratio
          itemImg.style.height = "96px";
          itemImg.style.width = "auto";
          itemImg.style.maxWidth = "140px";
          itemImg.style.objectFit = "contain";
          itemImg.style.borderRadius = "6px";
          itemImg.style.boxShadow = "0 3px 10px rgba(0,0,0,0.45)";
          itemImg.style.display = "block";
          itemsClone.appendChild(itemImg);
        });

        rowClone.appendChild(itemsClone);
        boardWrap.appendChild(rowClone);
      });

      presentationContainer.appendChild(boardWrap);

      // 4. Footer Watermark
      const footer = document.createElement("div");
      footer.style.display = "flex";
      footer.style.justifyContent = "space-between";
      footer.style.alignItems = "center";
      footer.style.fontSize = "0.8rem";
      footer.style.color = "rgba(255, 255, 255, 0.45)";
      footer.style.fontWeight = "600";
      footer.style.padding = "0 4px";

      const leftNote = document.createElement("span");
      leftNote.textContent = "🎮 Roleta NMDP";
      footer.appendChild(leftNote);

      const rightNote = document.createElement("span");
      rightNote.textContent = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
      footer.appendChild(rightNote);

      presentationContainer.appendChild(footer);

      // 5. Append offscreen & wait for images
      document.body.appendChild(presentationContainer);

      const images = Array.from(presentationContainer.querySelectorAll("img"));
      await Promise.all(images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(res => {
          img.onload = res;
          img.onerror = res;
        });
      }));

      // 6. Capture with html2canvas (Ultra HD 4K Scale: 3)
      const canvas = await window.html2canvas(presentationContainer, {
        backgroundColor: "#0e1118",
        logging: false,
        useCORS: true,
        scale: 3
      });

      activeExportCanvas = canvas;
      if (exportPreviewImg) {
        exportPreviewImg.src = canvas.toDataURL("image/png");
      }
      if (exportPreviewOverlay) {
        exportPreviewOverlay.hidden = false;
      }
    } catch (err) {
      console.error("Erro ao gerar apresentação da Tier List:", err);
      alert("Houve um erro ao gerar a imagem de apresentação da Tier List.");
    } finally {
      if (presentationContainer && presentationContainer.parentNode) {
        presentationContainer.parentNode.removeChild(presentationContainer);
      }
      downloadPngBtn.disabled = false;
      downloadPngBtn.textContent = originalText;
    }
  });

  // Action: Download Final PNG
  if (downloadFinalPngBtn) {
    downloadFinalPngBtn.addEventListener("click", () => {
      if (!activeExportCanvas) return;
      const sanitized = (activeExportTitle || "tierlist")
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "tierlist";

      const link = document.createElement("a");
      link.download = `tierlist-${sanitized}.png`;
      link.href = activeExportCanvas.toDataURL("image/png");
      link.click();
    });
  }

  // Action: Copy Image to Clipboard
  if (copyImageBtn) {
    copyImageBtn.addEventListener("click", () => {
      if (!activeExportCanvas) return;
      const originalText = copyImageBtn.innerHTML;
      copyImageBtn.disabled = true;
      copyImageBtn.textContent = "⏳ Copiando...";

      activeExportCanvas.toBlob(async (blob) => {
        try {
          if (!blob) throw new Error("Falha ao preparar blob da imagem.");
          if (!navigator.clipboard || !navigator.clipboard.write) {
            throw new Error("API de Área de Transferência não disponível.");
          }
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob })
          ]);
          showAutoSaveToast("📋 Imagem copiada para a área de transferência!");
          copyImageBtn.innerHTML = "✅ Imagem Copiada!";
          setTimeout(() => {
            copyImageBtn.innerHTML = originalText;
            copyImageBtn.disabled = false;
          }, 2000);
        } catch (err) {
          console.warn("Clipboard write failed:", err);
          alert("Não foi possível copiar diretamente para a área de transferência pelo navegador. Você pode clicar com o botão direito na imagem e escolher 'Copiar Imagem', ou utilizar o botão 'Baixar Imagem'.");
          copyImageBtn.innerHTML = originalText;
          copyImageBtn.disabled = false;
        }
      }, "image/png");
    });
  }

  // Helper to compress image data URLs for database saving
  function compressImageDataUrl(src, maxDim = 600, quality = 0.95) {
    if (!src || !src.startsWith("data:image/") || src.length < 50000) {
      return Promise.resolve(src);
    }
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round(height * (maxDim / width));
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round(width * (maxDim / height));
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        const compressed = canvas.toDataURL("image/webp", quality);
        resolve(compressed.length < src.length ? compressed : src);
      };
      img.onerror = () => resolve(src);
      img.src = src;
    });
  }

  // --- Saved Board Collection Controls (Supabase Shared DB) ---

  async function saveBoardToCollection() {
    if (!supabase) {
      alert("A conexão com o banco de dados não está configurada!");
      return;
    }

    if (!canUserEditActiveBoard()) {
      const creatorName = activeBoardCreatedBy || "o criador";
      alert(`Apenas o criador deste tabuleiro (${creatorName}) pode salvá-lo.`);
      return;
    }

    // 1. Gather Tiers state
    const tiers = [];
    const row_metadata = [];
    document.querySelectorAll(".tier-row").forEach(row => {
      const rowId = row.dataset.id;
      const labelEl = row.querySelector(".tier-label");
      const nameSpan = labelEl.querySelector("span");
      const labelName = nameSpan ? nameSpan.textContent.trim() : labelEl.textContent.trim();
      const color = labelEl.dataset.color;

      const existingTier = tiersData.find(t => t.id === rowId);
      const minScore = (existingTier && typeof existingTier.minScore === "number") ? existingTier.minScore : undefined;

      const items = [];
      row.querySelectorAll(".tier-item-img").forEach(img => {
        items.push({
          id: img.dataset.id,
          src: img.src,
          title: img.title || ""
        });
      });

      tiers.push({
        id: rowId,
        name: labelName,
        color: color,
        minScore: minScore,
        items: items
      });

      row_metadata.push({
        name: labelName,
        color: color,
        minScore: minScore,
        count: items.length
      });
    });

    // 2. Gather Bank state
    const bank = [];
    document.querySelectorAll("#unplaced-images-bank .tier-item-img").forEach(img => {
      bank.push({
        id: img.dataset.id,
        src: img.src,
        title: img.title || ""
      });
    });

    // 3. Ensure Board ID is active
    if (!activeBoardId) {
      activeBoardId = "tl-" + Date.now().toString(36) + "-" + Math.random().toString(36).substr(2, 5);
    }

    // 4. Save to Supabase
    saveBoardBtn.disabled = true;
    saveBoardBtn.textContent = "Otimizando Imagens...";

    try {
      // Compress any large Base64 images in tiers and bank before saving to prevent payload limits
      for (const tier of tiers) {
        for (const item of tier.items) {
          if (item.src) {
            item.src = await compressImageDataUrl(item.src);
          }
        }
      }

      for (const item of bank) {
        if (item.src) {
          item.src = await compressImageDataUrl(item.src);
        }
      }

      // Preserve featured status, ratings, parameters, and unvotedBank inside row_metadata array
      if (activeBoardIsFeatured) {
        row_metadata.push({
          is_featured: true,
          ratings: activeBoardRatings
        });
      } else if (Object.keys(activeBoardRatings).length > 0) {
        row_metadata.push({
          ratings: activeBoardRatings
        });
      }

      if (Array.isArray(activeBoardParameters) && activeBoardParameters.length > 0) {
        row_metadata.push({
          parameters: activeBoardParameters
        });
      }

      if (Array.isArray(unvotedBankData) && unvotedBankData.length > 0) {
        row_metadata.push({
          unvoted_bank: unvotedBankData
        });
      }

      saveBoardBtn.textContent = "Salvando...";

      const userName = localStorage.getItem("roleta-nmdp-session") || "Anônimo";
      if (!activeBoardCreatedBy) {
        activeBoardCreatedBy = userName;
      }

      const upsertPayload = {
        id: activeBoardId,
        title: boardTitle,
        created_by: activeBoardCreatedBy,
        tiers: tiers,
        bank: bank,
        row_metadata: row_metadata,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase.from("tier_lists").upsert(upsertPayload);

      if (error) throw error;

      saveBoardState();
      alert("Tabuleiro salvo na nuvem com sucesso!");
      renderSavedBoards();
      
      // Make delete board button visible since it is now saved
      deleteBoardBtn.style.display = "inline-block";
    } catch (err) {
      console.error(err);
      if (err.code === "PGRST205" || err.status === 404) {
        alert("Erro: A tabela 'tier_lists' não existe no Supabase. Crie-a no painel do Supabase conforme as instruções do menu.");
      } else {
        const detail = err.message || err.details || err.hint || (typeof err === "string" ? err : JSON.stringify(err));
        alert(`Erro ao salvar tabuleiro no banco de dados:\n${detail}`);
      }
    } finally {
      saveBoardBtn.disabled = false;
      saveBoardBtn.textContent = "💾 Salvar Tabuleiro";
    }
  }

  function isBoardFeatured(board) {
    if (!board) return false;
    if (board.is_featured === true) return true;
    if (board.created_by && board.created_by.toLowerCase() === "global") return true;
    if (Array.isArray(board.row_metadata)) {
      const meta = board.row_metadata.find(m => m && m.is_featured !== undefined);
      if (meta && meta.is_featured === true) return true;
    }
    return false;
  }

  let selectedUserFilter = "all";

  const savedBoardsCountEl = document.getElementById("saved-boards-count");
  const featuredBoardsList = document.getElementById("featured-boards-list");
  const userCardsGrid = document.getElementById("user-cards-grid");
  const selectedUserHeading = document.getElementById("selected-user-heading");
  const clearUserFilterBtn = document.getElementById("clear-user-filter-btn");

  if (clearUserFilterBtn) {
    clearUserFilterBtn.addEventListener("click", () => {
      selectedUserFilter = "all";
      renderSavedBoards();
    });
  }

  async function renderSavedBoards() {
    if (!savedBoardsList) return;
    
    // 1. Show immediate loading spinner
    savedBoardsList.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem 0; width: 100%;">
        <div style="width: 40px; height: 40px; border: 4px solid rgba(255, 255, 255, 0.1); border-top-color: var(--accent); border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 1rem;"></div>
        <p style="color: var(--text-muted); font-size: 0.95rem;">Carregando tabuleiros da nuvem...</p>
      </div>
    `;
    
    databaseErrorNotice.hidden = true;
    databaseErrorNotice.innerHTML = "";

    if (!supabase) {
      savedBoardsList.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 2rem 0; width:100%;">Supabase não configurado.</p>`;
      return;
    }

    const currentSessionUser = (localStorage.getItem("roleta-nmdp-session") || "").toLowerCase().trim();
    const isLeleUser = (currentSessionUser === "lele");

    try {
      // 2. Query lightweight columns
      const { data, error } = await supabase
        .from("tier_lists")
        .select("id, title, created_by, updated_at, tiers, row_metadata")
        .order("updated_at", { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        if (featuredBoardsList) {
          featuredBoardsList.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 1rem 0;">Nenhum tabuleiro em destaque no momento.</p>`;
        }
        if (userCardsGrid) userCardsGrid.innerHTML = "";
        savedBoardsList.innerHTML = `
          <p class="empty-saved-msg" style="color: var(--text-muted); font-size: 0.95rem; text-align: center; padding: 2rem 0; width: 100%;">
            Nenhum tabuleiro salvo ainda. Crie um acima!
          </p>
        `;
        if (savedBoardsCountEl) savedBoardsCountEl.textContent = "(0 tabuleiros)";
        return;
      }

      // Separate featured boards vs normal user boards
      const featuredBoards = data.filter(b => isBoardFeatured(b));
      const normalBoards = data.filter(b => !isBoardFeatured(b));

      // Calculate count per creator
      const userCounts = {};
      normalBoards.forEach(board => {
        const creator = board.created_by || "Anônimo";
        userCounts[creator] = (userCounts[creator] || 0) + 1;
      });

      // Render User Cards Grid
      if (userCardsGrid) {
        userCardsGrid.innerHTML = "";

        // 1. "Todos" Card
        const allCard = document.createElement("button");
        allCard.type = "button";
        allCard.className = "user-card-btn" + (selectedUserFilter === "all" ? " active" : "");
        allCard.innerHTML = `
          <span>👥 Todos</span>
          <span class="user-card-count">(${normalBoards.length})</span>
        `;
        allCard.addEventListener("click", () => {
          selectedUserFilter = "all";
          renderSavedBoards();
        });
        userCardsGrid.appendChild(allCard);

        // 2. Individual User Cards
        Object.keys(userCounts).sort().forEach(creator => {
          const userCard = document.createElement("button");
          userCard.type = "button";
          const isSelected = (selectedUserFilter.toLowerCase() === creator.toLowerCase());
          userCard.className = "user-card-btn" + (isSelected ? " active" : "");

          userCard.innerHTML = `
            <span>${creator}</span>
            <span class="user-card-count">(${userCounts[creator]} ${userCounts[creator] === 1 ? 'tabuleiro' : 'tabuleiros'})</span>
          `;

          userCard.addEventListener("click", () => {
            selectedUserFilter = creator.toLowerCase();
            renderSavedBoards();
          });

          userCardsGrid.appendChild(userCard);
        });
      }

      // Filter normal user boards by selected creator
      const filteredUserBoards = (selectedUserFilter === "all")
        ? normalBoards
        : normalBoards.filter(b => (b.created_by || "").toLowerCase() === selectedUserFilter.toLowerCase());

      // Update Section Header & Clear Filter Button
      if (selectedUserHeading) {
        if (selectedUserFilter === "all") {
          selectedUserHeading.textContent = "Todos os Tabuleiros";
        } else {
          const displayCreatorName = Object.keys(userCounts).find(k => k.toLowerCase() === selectedUserFilter) || selectedUserFilter;
          selectedUserHeading.textContent = `Tabuleiros de ${displayCreatorName}`;
        }
      }

      if (clearUserFilterBtn) {
        clearUserFilterBtn.style.display = (selectedUserFilter !== "all") ? "inline-flex" : "none";
      }

      if (savedBoardsCountEl) {
        savedBoardsCountEl.textContent = `(${filteredUserBoards.length} ${filteredUserBoards.length === 1 ? 'tabuleiro' : 'tabuleiros'})`;
      }

      // Helper function to build board card HTML element
      function buildBoardCard(board, isFeaturedCard) {
        const card = document.createElement("div");
        card.className = "saved-board-card";
        if (isFeaturedCard) {
          card.style.border = "1px solid rgba(255, 215, 0, 0.4)";
          card.style.background = "rgba(255, 215, 0, 0.02)";
          card.style.boxShadow = "0 4px 16px rgba(255, 215, 0, 0.08)";
        }

        // Title Header
        const headerEl = document.createElement("div");
        headerEl.style.display = "flex";
        headerEl.style.justifyContent = "space-between";
        headerEl.style.alignItems = "center";
        headerEl.style.marginBottom = "0.5rem";

        const titleEl = document.createElement("h3");
        titleEl.className = "saved-board-title";
        titleEl.style.margin = "0";
        titleEl.textContent = board.title || "Sem Título";
        headerEl.appendChild(titleEl);

        if (isFeaturedCard) {
          const badgeEl = document.createElement("span");
          badgeEl.style.background = "rgba(255, 215, 0, 0.15)";
          badgeEl.style.color = "#ffd700";
          badgeEl.style.border = "1px solid rgba(255, 215, 0, 0.4)";
          badgeEl.style.padding = "0.2rem 0.55rem";
          badgeEl.style.borderRadius = "6px";
          badgeEl.style.fontSize = "0.75rem";
          badgeEl.style.fontWeight = "700";
          badgeEl.textContent = "⭐ Destaque Global";
          headerEl.appendChild(badgeEl);
        }

        card.appendChild(headerEl);

        // Mini CSS preview layout
        const previewEl = document.createElement("div");
        previewEl.className = "mini-board-preview";
        const tiers = board.tiers || [];

        tiers.forEach(tier => {
          const rowEl = document.createElement("div");
          rowEl.className = "mini-board-row";

          const labelEl = document.createElement("div");
          labelEl.className = "mini-board-label";
          labelEl.style.backgroundColor = tier.color || "#95a5a6";
          labelEl.textContent = (tier.name || "").substring(0, 2);
          labelEl.style.color = "#0f1117";
          labelEl.style.fontSize = "0.55rem";
          labelEl.style.fontWeight = "800";
          labelEl.style.display = "flex";
          labelEl.style.alignItems = "center";
          labelEl.style.justifyContent = "center";
          labelEl.style.textShadow = "0px 0px 1px rgba(255,255,255,0.4)";
          rowEl.appendChild(labelEl);

          const itemsEl = document.createElement("div");
          itemsEl.className = "mini-board-items";

          const items = tier.items || [];
          items.forEach(item => {
            const itemEl = document.createElement("div");
            itemEl.className = "mini-board-item";
            if (item.src) {
              itemEl.style.backgroundImage = `url(${item.src})`;
            }
            itemsEl.appendChild(itemEl);
          });

          rowEl.appendChild(itemsEl);
          previewEl.appendChild(rowEl);
        });

        card.appendChild(previewEl);

        // Metadata footer
        const footerEl = document.createElement("div");
        footerEl.className = "saved-board-meta";
        footerEl.style.display = "flex";
        footerEl.style.alignItems = "center";
        footerEl.style.justifyContent = "space-between";
        footerEl.style.gap = "0.5rem";
        footerEl.style.flexWrap = "wrap";

        const metaInfo = document.createElement("div");
        metaInfo.style.display = "flex";
        metaInfo.style.alignItems = "center";
        metaInfo.style.gap = "0.75rem";
        metaInfo.style.flexWrap = "wrap";

        const creatorEl = document.createElement("span");
        creatorEl.className = "saved-board-creator";
        if (isFeaturedCard) {
          creatorEl.innerHTML = `⭐ <strong>Global / Oficial</strong>`;
        } else {
          creatorEl.innerHTML = `👤 Criado por: <strong>${board.created_by || "Anônimo"}</strong>`;
        }
        metaInfo.appendChild(creatorEl);

        const dateEl = document.createElement("span");
        dateEl.className = "saved-board-date";
        const dateObj = new Date(board.updated_at || Date.now());
        dateEl.textContent = `Atualizado: ${dateObj.toLocaleDateString("pt-BR")} ${dateObj.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}`;
        metaInfo.appendChild(dateEl);

        footerEl.appendChild(metaInfo);

        // EXCLUSIVE ACTION FOR USER "lele": Feature & Change Owner Buttons
        if (isLeleUser) {
          const btnGroup = document.createElement("div");
          btnGroup.style.display = "flex";
          btnGroup.style.gap = "0.4rem";
          btnGroup.style.alignItems = "center";

          const featureBtn = document.createElement("button");
          featureBtn.type = "button";
          if (isFeaturedCard) {
            featureBtn.textContent = "❌ Remover Destaque";
            featureBtn.className = "btn-secondary";
            featureBtn.style.padding = "0.25rem 0.6rem";
            featureBtn.style.fontSize = "0.75rem";
          } else {
            featureBtn.textContent = "⭐ Destacar em Globais";
            featureBtn.className = "btn-primary";
            featureBtn.style.background = "linear-gradient(135deg, #f1c40f, #f39c12)";
            featureBtn.style.color = "#000";
            featureBtn.style.fontWeight = "700";
            featureBtn.style.padding = "0.25rem 0.6rem";
            featureBtn.style.fontSize = "0.75rem";
          }

          featureBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            featureBtn.disabled = true;
            featureBtn.textContent = "Atualizando...";

            try {
              let updatedMetadata = Array.isArray(board.row_metadata) ? [...board.row_metadata] : [];
              updatedMetadata = updatedMetadata.filter(m => !m || m.is_featured === undefined);

              if (!isFeaturedCard) {
                updatedMetadata.push({ is_featured: true });
              }

              const updatePayload = {
                row_metadata: updatedMetadata
              };

              const { error: updateErr } = await supabase
                .from("tier_lists")
                .update(updatePayload)
                .eq("id", board.id);

              if (board.id === activeBoardId) {
                activeBoardIsFeatured = !isFeaturedCard;
              }

              renderSavedBoards();
            } catch (err) {
              console.error("Erro ao alterar destaque:", err);
              alert("Erro ao alterar destaque: " + (err.message || err));
            }
          });

          const changeOwnerBtnCard = document.createElement("button");
          changeOwnerBtnCard.type = "button";
          changeOwnerBtnCard.textContent = "👤 Alterar Criador";
          changeOwnerBtnCard.className = "btn-secondary";
          changeOwnerBtnCard.style.padding = "0.25rem 0.6rem";
          changeOwnerBtnCard.style.fontSize = "0.75rem";

          changeOwnerBtnCard.addEventListener("click", async (e) => {
            e.stopPropagation();
            const currentOwner = board.created_by || "Anônimo";
            const newOwner = prompt(`Alterar o criador do tabuleiro "${board.title || 'Sem Título'}":`, currentOwner);
            if (newOwner === null) return;
            const cleanNewOwner = newOwner.trim();
            if (!cleanNewOwner) {
              alert("O nome do criador não pode ser vazio.");
              return;
            }

            changeOwnerBtnCard.disabled = true;
            changeOwnerBtnCard.textContent = "Salvando...";

            try {
              const { error: updateErr } = await supabase
                .from("tier_lists")
                .update({ created_by: cleanNewOwner })
                .eq("id", board.id);

              if (updateErr) throw updateErr;

              if (board.id === activeBoardId) {
                activeBoardCreatedBy = cleanNewOwner;
              }

              alert(`Criador do tabuleiro "${board.title}" alterado para: ${cleanNewOwner}`);
              renderSavedBoards();
            } catch (err) {
              console.error("Erro ao alterar criador:", err);
              alert("Erro ao alterar criador: " + (err.message || err));
            } finally {
              changeOwnerBtnCard.disabled = false;
              changeOwnerBtnCard.textContent = "👤 Alterar Criador";
            }
          });

          btnGroup.appendChild(featureBtn);
          btnGroup.appendChild(changeOwnerBtnCard);
          footerEl.appendChild(btnGroup);
        }

        card.appendChild(footerEl);

        // Click event on card to open editor ON DEMAND
        card.addEventListener("click", async () => {
          if (card.dataset.loading === "true") return;
          card.dataset.loading = "true";
          
          const originalTitle = titleEl.textContent;
          titleEl.textContent = "⏳ Carregando...";

          try {
            const { data: details, error: detailsError } = await supabase
              .from("tier_lists")
              .select("tiers, bank, created_by, row_metadata")
              .eq("id", board.id)
              .single();

            if (detailsError) throw detailsError;

            activeBoardId = board.id;
            boardTitle = board.title;
            activeBoardIsFeatured = isFeaturedCard || isBoardFeatured(details) || isBoardFeatured(board);
            activeBoardCreatedBy = details.created_by || board.created_by || "Anônimo";
            tiersData = JSON.parse(JSON.stringify(details.tiers || []));
            bankData = JSON.parse(JSON.stringify(details.bank || []));

            // Restore minScore from row_metadata if missing in tiersData (for backward compatibility)
            if (Array.isArray(details.row_metadata)) {
              tiersData.forEach((tier, idx) => {
                if (typeof tier.minScore !== "number") {
                  const metaTier = details.row_metadata.find(m => m && m.name === tier.name && typeof m.minScore === "number");
                  if (metaTier) {
                    tier.minScore = metaTier.minScore;
                  }
                }
              });
            }

            let embeddedUnvoted = [];
            if (Array.isArray(details.row_metadata)) {
              const metaObj = details.row_metadata.find(m => m && m.unvoted_bank !== undefined);
              if (metaObj && metaObj.unvoted_bank) {
                embeddedUnvoted = metaObj.unvoted_bank;
              }
            }
            unvotedBankData = JSON.parse(JSON.stringify(embeddedUnvoted || []));
            activeEditing = true;

            await loadFeaturedBoardRatings(board.id, details.row_metadata);
            applyFeaturedAutoSorting();

            activeTierlistTitle.textContent = boardTitle;
            renderBoard();
            renderBank();

            saveBoardState();

            landingWrapper.style.display = "none";
            editScreen.style.display = "flex";

            updateBoardPermissionsUI();
          } catch (err) {
            console.error("Erro ao carregar detalhes:", err);
            const errMsg = err.message || err.details || (typeof err === "object" ? JSON.stringify(err) : err);
            alert("Não foi possível abrir o tabuleiro: " + errMsg);
            titleEl.textContent = originalTitle;
            card.dataset.loading = "false";
          }
        });

        return card;
      }

      // Render Featured Boards Section
      if (featuredBoardsList) {
        featuredBoardsList.innerHTML = "";
        if (featuredBoards.length === 0) {
          featuredBoardsList.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 1rem 0;">Nenhum tabuleiro em destaque no momento.</p>`;
        } else {
          featuredBoards.forEach(board => {
            const card = buildBoardCard(board, true);
            featuredBoardsList.appendChild(card);
          });
        }
      }

      // Render User Boards Section
      savedBoardsList.innerHTML = "";
      if (filteredUserBoards.length === 0) {
        savedBoardsList.innerHTML = `
          <p class="empty-saved-msg" style="color: var(--text-muted); font-size: 0.95rem; text-align: center; padding: 2rem 0; width: 100%;">
            Nenhum tabuleiro encontrado para o criador selecionado.
          </p>
        `;
      } else {
        filteredUserBoards.forEach(board => {
          const card = buildBoardCard(board, false);
          savedBoardsList.appendChild(card);
        });
      }
    } catch (err) {
      console.error(err);
      if (err.code === "PGRST205" || err.status === 404) {
        showDatabaseErrorInstructions();
      } else {
        savedBoardsList.innerHTML = `<p style="color: #ff7675; text-align: center; padding: 2rem 0; width:100%;">Erro ao carregar os tabuleiros do Supabase.</p>`;
      }
    }
  }

  function showDatabaseErrorInstructions() {
    databaseErrorNotice.hidden = false;
    databaseErrorNotice.innerHTML = `
      <div class="supabase-notice-box" style="background: rgba(235, 77, 75, 0.1); border: 1px dashed #eb4d4b; padding: 1rem; border-radius: 8px; margin-top: 1rem; text-align: left; animation: fade-in 0.3s ease;">
        <p style="color: #ff7675; font-size: 0.9rem; font-weight: bold; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.35rem;">
          ⚠️ Tabela "tier_lists" não encontrada no Supabase!
        </p>
        <p style="color: var(--text-muted); font-size: 0.8rem; line-height: 1.4; margin-bottom: 0.75rem;">
          Para salvar e compartilhar os tabuleiros entre todos os usuários, execute o comando SQL abaixo no <strong>SQL Editor</strong> do painel do seu Supabase:
        </p>
        <pre style="background: #000; color: #74b9ff; padding: 0.75rem; border-radius: 6px; font-size: 0.75rem; overflow-x: auto; font-family: monospace; white-space: pre-wrap; word-break: break-all; max-height: 150px; border: 1px solid var(--border);">CREATE TABLE public.tier_lists (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_by TEXT,
    tiers JSONB NOT NULL,
    bank JSONB NOT NULL,
    row_metadata JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.tier_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select" ON public.tier_lists FOR SELECT USING (true);
CREATE POLICY "Allow insert" ON public.tier_lists FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update" ON public.tier_lists FOR UPDATE USING (true);
CREATE POLICY "Allow delete" ON public.tier_lists FOR DELETE USING (true);</pre>
        <p style="color: var(--text-muted); font-size: 0.75rem; margin-top: 0.5rem; text-align: center;">
          Após executar no painel, recarregue esta página!
        </p>
      </div>
    `;
  }

  saveBoardBtn.addEventListener("click", () => {
    saveBoardToCollection();
  });

  deleteBoardBtn.addEventListener("click", async () => {
    if (!activeBoardId) return;
    const confirmDelete = confirm(`Deseja excluir permanentemente o tabuleiro "${boardTitle}"?`);
    if (!confirmDelete) return;

    deleteBoardBtn.disabled = true;
    deleteBoardBtn.textContent = "Excluindo...";

    try {
      const { error } = await supabase
        .from("tier_lists")
        .delete()
        .eq("id", activeBoardId);

      if (error) throw error;

      // Reset editor session
      activeBoardId = null;
      activeBoardIsFeatured = false;
      activeBoardCreatedBy = null;
      activeEditing = false;
      boardTitle = "Minha Tier List";
      tiersData = JSON.parse(JSON.stringify(DEFAULT_TIERS));
      bankData = [];
      saveBoardState();

      // Go back to setup screen
      editScreen.style.display = "none";
      landingWrapper.style.display = "flex";
      renderSavedBoards();
      
      // Close collapse form
      setupCollapseContainer.classList.remove("expanded");
      toggleSetupBtn.innerHTML = "<span>➕ Criar Novo Tabuleiro</span>";
    } catch (err) {
      console.error(err);
      alert("Erro ao excluir o tabuleiro do banco de dados.");
    } finally {
      deleteBoardBtn.disabled = false;
      deleteBoardBtn.textContent = "🗑️ Excluir Tabuleiro";
    }
  });

  const changeOwnerBtn = document.getElementById("change-owner-btn");
  if (changeOwnerBtn) {
    changeOwnerBtn.addEventListener("click", async () => {
      if (!canUserEditActiveBoard()) return;
      if (!activeBoardId) return;

      const currentOwner = activeBoardCreatedBy || "Anônimo";
      const newOwner = prompt(`Alterar o criador deste tabuleiro ("${boardTitle}"):`, currentOwner);
      if (newOwner === null) return;
      const cleanNewOwner = newOwner.trim();
      if (!cleanNewOwner) {
        alert("O nome do criador não pode ser vazio.");
        return;
      }

      changeOwnerBtn.disabled = true;
      changeOwnerBtn.textContent = "Salvando...";

      try {
        if (supabase) {
          const { error } = await supabase
            .from("tier_lists")
            .update({ created_by: cleanNewOwner })
            .eq("id", activeBoardId);
          if (error) throw error;
        }

        activeBoardCreatedBy = cleanNewOwner;
        saveBoardState();
        alert(`Criador do tabuleiro alterado com sucesso para: ${cleanNewOwner}`);

        renderSavedBoards();
        updateBoardPermissionsUI();
      } catch (err) {
        console.error("Erro ao alterar criador:", err);
        alert("Erro ao alterar criador no banco: " + (err.message || err));
      } finally {
        changeOwnerBtn.disabled = false;
        changeOwnerBtn.textContent = "👤 Alterar Criador";
      }
    });
  }

  // --- Setup Form Parameters Logic ---
  function renderSetupParams() {
    if (!setupParamsContainer) return;
    setupParamsContainer.innerHTML = "";

    if (setupParameters.length === 0) {
      if (noParamsMsg) {
        noParamsMsg.style.display = "inline";
        setupParamsContainer.appendChild(noParamsMsg);
      }
      return;
    }

    setupParameters.forEach((param, index) => {
      const chip = document.createElement("div");
      chip.style.display = "inline-flex";
      chip.style.alignItems = "center";
      chip.style.gap = "0.35rem";
      chip.style.background = "rgba(108, 92, 231, 0.2)";
      chip.style.border = "1px solid var(--accent)";
      chip.style.color = "var(--text)";
      chip.style.padding = "0.2rem 0.6rem";
      chip.style.borderRadius = "20px";
      chip.style.fontSize = "0.8rem";
      chip.style.fontWeight = "600";

      const text = document.createElement("span");
      text.textContent = param;

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.textContent = "✕";
      delBtn.style.background = "none";
      delBtn.style.border = "none";
      delBtn.style.color = "#ff7675";
      delBtn.style.cursor = "pointer";
      delBtn.style.fontSize = "0.85rem";
      delBtn.style.padding = "0";
      delBtn.style.lineHeight = "1";

      delBtn.addEventListener("click", () => {
        setupParameters.splice(index, 1);
        renderSetupParams();
      });

      chip.appendChild(text);
      chip.appendChild(delBtn);
      setupParamsContainer.appendChild(chip);
    });
  }

  function addSetupParameter(name) {
    const clean = (name || "").trim();
    if (!clean) return;
    if (setupParameters.some(p => p.toLowerCase() === clean.toLowerCase())) {
      alert("Este parâmetro já foi adicionado.");
      return;
    }
    setupParameters.push(clean);
    renderSetupParams();
  }

  if (addSetupParamBtn && setupParamInput) {
    addSetupParamBtn.addEventListener("click", () => {
      addSetupParameter(setupParamInput.value);
      setupParamInput.value = "";
    });
    setupParamInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addSetupParamBtn.click();
      }
    });
  }

  document.querySelectorAll(".param-preset-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const preset = btn.dataset.preset;
      if (preset === "games") {
        setupParameters = ["Jogabilidade", "Gráficos", "Trilha Sonora", "História"];
      } else if (preset === "anime") {
        setupParameters = ["Animação", "Enredo", "Personagens", "Trilha Sonora"];
      } else if (preset === "filmes") {
        setupParameters = ["Atuação", "Roteiro", "Efeitos Visuais", "Direção"];
      }
      renderSetupParams();
    });
  });

  // --- Parameters Modal Overlay Logic ---
  function renderModalParameters() {
    if (!modalParamsList) return;
    modalParamsList.innerHTML = "";

    if (editingModalParameters.length === 0) {
      const emptyMsg = document.createElement("p");
      emptyMsg.style.color = "var(--text-muted)";
      emptyMsg.style.fontSize = "0.85rem";
      emptyMsg.style.fontStyle = "italic";
      emptyMsg.style.textAlign = "center";
      emptyMsg.style.padding = "1rem 0";
      emptyMsg.textContent = "Nenhum parâmetro definido (avaliação direta de 0 a 10).";
      modalParamsList.appendChild(emptyMsg);
      return;
    }

    editingModalParameters.forEach((param, index) => {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "0.5rem";
      row.style.background = "var(--surface-raised)";
      row.style.padding = "0.4rem 0.75rem";
      row.style.borderRadius = "8px";
      row.style.border = "1px solid var(--border)";

      const input = document.createElement("input");
      input.type = "text";
      input.className = "input-text";
      input.style.flex = "1";
      input.style.padding = "0.3rem 0.6rem";
      input.style.fontSize = "0.85rem";
      input.value = param;

      input.addEventListener("change", () => {
        const clean = input.value.trim();
        if (clean) {
          editingModalParameters[index] = clean;
        } else {
          input.value = editingModalParameters[index];
        }
      });

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "btn-danger-sm";
      delBtn.textContent = "🗑️";
      delBtn.style.padding = "0.3rem 0.6rem";
      delBtn.style.fontSize = "0.75rem";

      delBtn.addEventListener("click", () => {
        editingModalParameters.splice(index, 1);
        renderModalParameters();
      });

      row.appendChild(input);
      row.appendChild(delBtn);
      modalParamsList.appendChild(row);
    });
  }

  if (editParametersBtn) {
    editParametersBtn.addEventListener("click", () => {
      if (!canUserEditActiveBoard()) return;
      editingModalParameters = [...activeBoardParameters];
      renderModalParameters();
      if (parametersOverlay) parametersOverlay.hidden = false;
    });
  }

  if (modalAddParamBtn && modalParamInput) {
    const addModalParam = () => {
      const clean = modalParamInput.value.trim();
      if (!clean) return;
      if (editingModalParameters.some(p => p.toLowerCase() === clean.toLowerCase())) {
        alert("Este parâmetro já existe.");
        return;
      }
      editingModalParameters.push(clean);
      modalParamInput.value = "";
      renderModalParameters();
    };

    modalAddParamBtn.addEventListener("click", addModalParam);
    modalParamInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addModalParam();
      }
    });
  }

  if (cancelParametersBtn) {
    cancelParametersBtn.addEventListener("click", () => {
      if (parametersOverlay) parametersOverlay.hidden = true;
    });
  }

  if (saveParametersBtn) {
    saveParametersBtn.addEventListener("click", async () => {
      activeBoardParameters = [...editingModalParameters];
      saveBoardState();

      if (supabase) {
        await autoSaveActiveBoard();
      }

      if (parametersOverlay) parametersOverlay.hidden = true;
      showAutoSaveToast("⚙️ Parâmetros atualizados!");
    });
  }

  // --- Setup Landing Screen Events ---

  toggleSetupBtn.addEventListener("click", () => {
    setupCollapseContainer.classList.toggle("expanded");
    const isExpanded = setupCollapseContainer.classList.contains("expanded");
    toggleSetupBtn.innerHTML = isExpanded 
      ? "<span>➖ Recolher Criador</span>" 
      : "<span>➕ Criar Novo Tabuleiro</span>";
  });

  async function populateSetupCategories() {
    if (!setupImportCategory || !supabase) return;
    try {
      const customGals = await fetchCustomGalleries();
      const existingCustom = setupImportCategory.querySelectorAll("option[data-custom='true']");
      existingCustom.forEach(opt => opt.remove());

      customGals.forEach(g => {
        const opt = document.createElement("option");
        opt.value = `custom:${g.owner}:${g.slug}`;
        opt.setAttribute("data-custom", "true");
        opt.textContent = `${g.icon || "📁"} ${g.name} (${g.owner})`;
        setupImportCategory.appendChild(opt);
      });
    } catch (e) {
      console.warn("Erro ao popular categorias customizadas:", e);
    }
  }

  setupImportCheckbox.addEventListener("change", () => {
    setupImportOptions.style.display = setupImportCheckbox.checked ? "flex" : "none";
    if (setupImportCheckbox.checked) {
      populateSetupCategories();
    }
  });

  startCreationBtn.addEventListener("click", async () => {
    boardTitle = setupTitleInput.value.trim() || "Minha Tier List";
    activeTierlistTitle.textContent = boardTitle;

    // A fresh board creation reset
    activeBoardId = null;
    activeBoardIsFeatured = false;
    activeBoardCreatedBy = localStorage.getItem("roleta-nmdp-session") || "Anônimo";
    activeBoardParameters = [...setupParameters];
    deleteBoardBtn.style.display = "none";

    // Template selection
    const templateVal = document.querySelector('input[name="setup-template"]:checked').value;
    if (templateVal === "blank") {
      tiersData = [];
    } else {
      tiersData = JSON.parse(JSON.stringify(DEFAULT_TIERS));
    }

    // Pre-import gallery images
    if (setupImportCheckbox.checked) {
      const category = setupImportCategory.value;
      const votesFilter = setupImportVotes.value;

      startCreationBtn.disabled = true;
      startCreationBtn.textContent = "Carregando Galeria...";

      try {
        let query = supabase.from("cards").select("id, title, image_data_url, votes");
        const { data, error } = await query;
        if (error) throw error;

        bankData = [];
        if (data && data.length > 0) {
          data.forEach(card => {
            if (!card.image_data_url) return;
            if (category === "games" && !cardBelongsToGallery(card, "lele", "games")) return;
            if (category === "anime" && !cardBelongsToGallery(card, "lele", "anime")) return;
            if (category === "filmes" && !cardBelongsToGallery(card, "lele", "filmes")) return;
            if (category.startsWith("custom:")) {
              const parts = category.split(":");
              const cOwner = parts[1];
              const cSlug = parts[2];
              if (!cardBelongsToGallery(card, cOwner, cSlug)) return;
            }
            if (votesFilter === "voted" && (!card.votes || card.votes < 1)) return;

            bankData.push({
              id: "item-" + card.id,
              src: card.image_data_url,
              title: card.title
            });
          });
        }
      } catch (err) {
        console.error(err);
        alert("Erro ao importar imagens do banco de dados!");
      }

      startCreationBtn.disabled = false;
      startCreationBtn.textContent = "🚀 Começar a Criar";
    } else {
      bankData = [];
    }

    activeEditing = true;

    // Render workspace
    renderBoard();
    renderBank();
    saveBoardState();

    // Toggle views
    landingWrapper.style.display = "none";
    editScreen.style.display = "flex";
  });

  goBackSetupBtn.addEventListener("click", () => {
    try {
      const confirmNew = confirm("Deseja voltar ao menu? Lembre-se de salvar suas alterações!");
      if (!confirmNew) return;

      activeEditing = false;
      activeBoardId = null;
      activeBoardIsFeatured = false;
      activeBoardCreatedBy = null;
      activeBoardParameters = [];
      setupParameters = [];
      boardTitle = "Minha Tier List";
      tiersData = JSON.parse(JSON.stringify(DEFAULT_TIERS));
      bankData = [];
      
      saveBoardState();

      // Toggle screens
      if (editScreen) editScreen.style.display = "none";
      if (landingWrapper) landingWrapper.style.display = "flex";
      renderSavedBoards();

      // Reset setup inputs
      if (setupTitleInput) setupTitleInput.value = "Minha Tier List";
      if (setupImportCheckbox) setupImportCheckbox.checked = false;
      if (setupImportOptions) setupImportOptions.style.display = "none";
      renderSetupParams();
      
      // Reset collapse state
      if (setupCollapseContainer) setupCollapseContainer.classList.remove("expanded");
      if (toggleSetupBtn) toggleSetupBtn.innerHTML = "<span>➕ Criar Novo Tabuleiro</span>";
    } catch (err) {
      console.error("Erro ao voltar para a tela inicial:", err);
    }
  });

  // --- Initialization ---

  async function init() {
    loadBoardState();
    updateUserSessionUI();
    renderSetupParams();
    
    if (activeEditing) {
      landingWrapper.style.display = "none";
      editScreen.style.display = "flex";
      activeTierlistTitle.textContent = boardTitle;

      if (activeBoardId && supabase) {
        try {
          const { data: details } = await supabase
            .from("tier_lists")
            .select("tiers, bank, created_by, row_metadata")
            .eq("id", activeBoardId)
            .single();

          if (details) {
            if (Array.isArray(details.tiers)) tiersData = JSON.parse(JSON.stringify(details.tiers));
            if (Array.isArray(details.bank)) bankData = JSON.parse(JSON.stringify(details.bank));

            let embeddedUnvoted = [];
            if (Array.isArray(details.row_metadata)) {
              const metaObj = details.row_metadata.find(m => m && m.unvoted_bank !== undefined);
              if (metaObj && metaObj.unvoted_bank) {
                embeddedUnvoted = metaObj.unvoted_bank;
              }
            }
            unvotedBankData = JSON.parse(JSON.stringify(embeddedUnvoted || []));

            await loadFeaturedBoardRatings(activeBoardId, details.row_metadata);
            applyFeaturedAutoSorting();
          }
        } catch (e) {
          console.warn("Erro ao recarregar dados do tabuleiro em destaque no init:", e);
        }
      }

      applyFeaturedAutoSorting();
      renderBoard();
      renderBank();
      renderUnvotedBank();
      
      if (activeBoardId) {
        deleteBoardBtn.style.display = "inline-block";
      } else {
        deleteBoardBtn.style.display = "none";
      }
    } else {
      landingWrapper.style.display = "flex";
      editScreen.style.display = "none";
      renderSavedBoards();
    }

    setupDropzoneEvents(bankContainer);
    if (unvotedBankContainer) {
      setupDropzoneEvents(unvotedBankContainer);
    }
  }

  init();
})();
