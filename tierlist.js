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
    { id: "row-s", name: "S", color: "#ff7f7f", items: [] },
    { id: "row-a", name: "A", color: "#ffbf7f", items: [] },
    { id: "row-b", name: "B", color: "#ffdf7f", items: [] },
    { id: "row-c", name: "C", color: "#ffff7f", items: [] },
    { id: "row-d", name: "D", color: "#7fff7f", items: [] },
    { id: "row-f", name: "F", color: "#7fbbff", items: [] }
  ];

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

  const addStockImagesBtn = document.getElementById("add-stock-images-btn");
  const fileInputUpload = document.getElementById("tier-image-input");

  const boardContainer = document.getElementById("tier-list-board");
  const bankContainer = document.getElementById("unplaced-images-bank");

  // Modal Selectors
  const rowSettingsOverlay = document.getElementById("row-settings-overlay");
  const rowLabelInput = document.getElementById("row-label-input");
  const presetsGrid = document.getElementById("color-presets-grid");
  const deleteRowConfirmBtn = document.getElementById("delete-row-confirm-btn");
  const cancelRowSettingsBtn = document.getElementById("cancel-row-settings-btn");
  const saveRowSettingsBtn = document.getElementById("save-row-settings-btn");

  // Import Modal Selectors
  const importOverlay = document.getElementById("import-overlay");
  const cancelImportBtn = document.getElementById("cancel-import-btn");

  // Local State variables
  let activeBoardId = null;
  let activeEditing = false;
  let boardTitle = "Minha Tier List";
  let tiersData = [];
  let bankData = [];
  let draggedEl = null;
  let activeEditingRowId = null;
  let selectedPresetColor = "";

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
      const labelName = labelEl.textContent.trim();
      const color = labelEl.dataset.color;

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
        return;
      } catch (e) {
        console.error("Erro ao ler estado do localStorage:", e);
      }
    }
    activeEditing = false;
    boardTitle = "Minha Tier List";
    tiersData = JSON.parse(JSON.stringify(DEFAULT_TIERS));
    bankData = [];
  }

  // --- Rendering UI elements ---

  function renderBoard() {
    boardContainer.innerHTML = "";
    tiersData.forEach(tier => {
      const rowEl = createRowElement(tier);
      boardContainer.appendChild(rowEl);
    });
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

  function updateEmptyBankMessage() {
    const msg = bankContainer.querySelector(".empty-bank-msg");
    const itemElements = bankContainer.querySelectorAll(".tier-item-img");
    if (msg) {
      msg.style.display = itemElements.length === 0 ? "block" : "none";
    }
  }

  function createRowElement(tier) {
    const row = document.createElement("div");
    row.className = "tier-row";
    row.dataset.id = tier.id;

    // Label
    const label = document.createElement("div");
    label.className = "tier-label";
    label.textContent = tier.name;
    label.style.backgroundColor = tier.color;
    label.dataset.color = tier.color;
    label.title = "Clique para configurar a linha";
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

  async function loadFeaturedBoardRatings(boardId) {
    activeBoardRatings = {};
    if (!supabase || !boardId) return;

    try {
      const { data, error } = await supabase
        .from("featured_ratings")
        .select("*")
        .eq("board_id", boardId);

      if (!error && data) {
        data.forEach(r => {
          if (!activeBoardRatings[r.item_id]) activeBoardRatings[r.item_id] = [];
          activeBoardRatings[r.item_id].push({
            userName: r.user_name,
            score: Number(r.score)
          });
        });
      }
    } catch (err) {
      console.warn("Tabela 'featured_ratings' não disponível ou vazia:", err);
    }
  }

  async function submitItemRating(itemId, score) {
    if (!activeBoardId || !itemId) return;

    const sessionUser = localStorage.getItem("roleta-nmdp-session") || "Anônimo";
    const recordId = `rate-${activeBoardId}-${itemId}-${sessionUser.toLowerCase().replace(/\s+/g, '_')}`;

    // 1. Update local state
    if (!activeBoardRatings[itemId]) activeBoardRatings[itemId] = [];
    const existingIdx = activeBoardRatings[itemId].findIndex(r => r.userName.toLowerCase() === sessionUser.toLowerCase());
    if (existingIdx >= 0) {
      activeBoardRatings[itemId][existingIdx].score = score;
    } else {
      activeBoardRatings[itemId].push({ userName: sessionUser, score });
    }

    // 2. Auto re-sort board items across rows and within rows based on average scores (0-10 scale)
    applyFeaturedAutoSorting();
    saveBoardState();

    // 3. Save to Supabase featured_ratings table
    if (supabase) {
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

      // Save updated board state to Supabase
      saveBoardToCollection();
    }
  }

  function applyFeaturedAutoSorting() {
    // Collect all placed items
    const allPlacedItems = [];
    tiersData.forEach(tier => {
      if (Array.isArray(tier.items)) {
        allPlacedItems.push(...tier.items);
      }
    });

    if (allPlacedItems.length === 0) return;

    // Clear items from tiers
    tiersData.forEach(tier => {
      tier.items = [];
    });

    const numRows = tiersData.length;

    // Distribute items into tier rows based on 0-10 average rating thresholds
    allPlacedItems.forEach(item => {
      const stats = getItemRatingStats(item.id);
      let targetRowIndex = numRows - 1; // Default to lowest tier

      if (stats.count > 0) {
        if (stats.avg >= 9.0) targetRowIndex = 0;
        else if (stats.avg >= 7.5) targetRowIndex = Math.min(1, numRows - 1);
        else if (stats.avg >= 5.5) targetRowIndex = Math.min(2, numRows - 1);
        else if (stats.avg >= 3.5) targetRowIndex = Math.min(3, numRows - 1);
        else targetRowIndex = numRows - 1;
      }

      if (tiersData[targetRowIndex]) {
        tiersData[targetRowIndex].items.push(item);
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
  }

  function openInlineRatingCard(item, targetImgElement) {
    if (!item || !inlineRatingCard) return;
    activeRatingItem = item;

    if (inlineRatingItemTitle) {
      inlineRatingItemTitle.textContent = item.title || "Item sem título";
    }

    const sessionUser = localStorage.getItem("roleta-nmdp-session") || "Anônimo";
    const ratings = activeBoardRatings[item.id] || [];
    const myRatingObj = ratings.find(r => r.userName.toLowerCase() === sessionUser.toLowerCase());
    const myCurrentScore = myRatingObj ? myRatingObj.score : 5.0;

    if (inlineRatingSlider) {
      inlineRatingSlider.value = myCurrentScore;
    }
    if (inlineRatingValue) {
      inlineRatingValue.textContent = `${Number(myCurrentScore).toFixed(1)} / 10`;
    }

    // Calculate position relative to targetImgElement
    if (targetImgElement) {
      const rect = targetImgElement.getBoundingClientRect();
      const cardWidth = 260;
      
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
      if (activeRatingItem && inlineRatingSlider) {
        const score = Number(inlineRatingSlider.value);
        closeInlineRatingCard();
        await submitItemRating(activeRatingItem.id, score);
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
    const wrapper = document.createElement("div");
    wrapper.className = "tier-item-wrapper";
    wrapper.style.position = "relative";
    wrapper.style.display = "inline-flex";
    wrapper.style.alignItems = "center";
    wrapper.style.justifyContent = "center";

    const img = document.createElement("img");
    img.className = "tier-item-img";
    img.src = item.src;
    img.dataset.id = item.id || ("item-" + Date.now().toString(36) + "-" + Math.random().toString(36).substr(2, 5));
    img.title = item.title || "";
    img.draggable = true;

    setupDragEvents(wrapper);
    setupHoverPreview(img);

    // Check if current session user has voted on this item
    const sessionUser = (localStorage.getItem("roleta-nmdp-session") || "Anônimo").toLowerCase();
    const itemRatings = activeBoardRatings[item.id] || [];
    const hasVoted = itemRatings.some(r => (r.userName || "").toLowerCase() === sessionUser);

    if (!hasVoted) {
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
      openInlineRatingCard(item, img);
    });

    return wrapper;
  }

  // --- Drag and Drop Logic ---

  function setupDragEvents(el) {
    el.addEventListener("dragstart", (e) => {
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
            hoverAvgRating.innerHTML = `⭐ Média: <strong>${stats.avg} / 10</strong> (${stats.count} ${stats.count === 1 ? 'voto' : 'votos'})`;
            hoverUserRatingsList.innerHTML = stats.ratings.map(r => `
              <div class="hover-rating-item">
                <span>👤 <strong>${r.userName}</strong></span>
                <span style="color:#ffd700; font-weight:bold;">⭐ ${r.score}/10</span>
              </div>
            `).join("");
          } else {
            hoverAvgRating.innerHTML = `⭐ <em>Sem avaliações ainda</em>`;
            hoverUserRatingsList.innerHTML = `<span style="text-align:center; font-style:italic; font-size: 0.7rem;">Clique no item para dar sua nota!</span>`;
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
      zone.classList.add("drag-over");
    });

    zone.addEventListener("dragleave", () => {
      zone.classList.remove("drag-over");
    });

    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("drag-over");

      if (draggedEl) {
        const afterElement = getDragAfterElement(zone, e.clientX);
        if (afterElement == null) {
          zone.appendChild(draggedEl);
        } else {
          zone.insertBefore(draggedEl, afterElement);
        }
      }
      saveBoardState();
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
    const rowEl = document.querySelector(`.tier-row[data-id="${rowId}"]`);
    if (!rowEl) return;

    const labelEl = rowEl.querySelector(".tier-label");
    rowLabelInput.value = labelEl.textContent.trim();
    selectedPresetColor = labelEl.dataset.color || "#95a5a6";

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

    const rowEl = document.querySelector(`.tier-row[data-id="${activeEditingRowId}"]`);
    if (rowEl) {
      const labelEl = rowEl.querySelector(".tier-label");
      labelEl.textContent = rowLabelInput.value.trim() || "NEW";
      labelEl.style.backgroundColor = selectedPresetColor;
      labelEl.dataset.color = selectedPresetColor;
      saveBoardState();
    }
    closeRowSettings();
  });

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
        const item = {
          id: "item-" + Math.random().toString(36).slice(2, 9),
          src: webpSrc,
          title: file.name
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

  // --- Supabase Cards Importing ---

  openImportModalBtn.addEventListener("click", () => {
    if (!supabase) {
      alert("A conexão com o banco de dados não está configurada!");
      return;
    }
    importOverlay.hidden = false;
  });

  cancelImportBtn.addEventListener("click", () => {
    importOverlay.hidden = true;
  });

  async function executeImport(category) {
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

        // 1. Filter Category
        if (category === "games" && (card.id.startsWith("anime_") || card.id.startsWith("filmes_"))) return;
        if (category === "anime" && !card.id.startsWith("anime_")) return;
        if (category === "filmes" && !card.id.startsWith("filmes_")) return;

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

  // --- Save as PNG using html2canvas ---

  downloadPngBtn.addEventListener("click", () => {
    const originalText = downloadPngBtn.textContent;
    downloadPngBtn.disabled = true;
    downloadPngBtn.textContent = "Gerando Imagem...";

    // Use html2canvas to render the board
    window.html2canvas(boardContainer, {
      backgroundColor: "#0f1117",
      logging: false,
      useCORS: true,
      scale: 2 // double scale for crisp image quality
    }).then(canvas => {
      const link = document.createElement("a");
      link.download = `tierlist-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();

      downloadPngBtn.disabled = false;
      downloadPngBtn.textContent = originalText;
    }).catch(err => {
      console.error("Erro ao gerar PNG:", err);
      alert("Houve um erro ao tentar salvar o tabuleiro como imagem.");
      downloadPngBtn.disabled = false;
      downloadPngBtn.textContent = originalText;
    });
  });

  // Helper to compress image data URLs for database saving
  function compressImageDataUrl(src, maxDim = 250, quality = 0.8) {
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

    // 1. Gather Tiers state
    const tiers = [];
    const row_metadata = [];
    document.querySelectorAll(".tier-row").forEach(row => {
      const rowId = row.dataset.id;
      const labelEl = row.querySelector(".tier-label");
      const labelName = labelEl.textContent.trim();
      const color = labelEl.dataset.color;

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
        items: items
      });

      row_metadata.push({
        name: labelName,
        color: color,
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

      saveBoardBtn.textContent = "Salvando...";

      const userName = localStorage.getItem("roleta-nmdp-session") || "Anônimo";

      const { error } = await supabase.from("tier_lists").upsert({
        id: activeBoardId,
        title: boardTitle,
        created_by: userName,
        tiers: tiers,
        bank: bank,
        row_metadata: row_metadata,
        updated_at: new Date().toISOString()
      });

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

        // EXCLUSIVE ACTION FOR USER "lele": Feature / Unfeature Button
        if (isLeleUser) {
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

              if (updateErr) throw updateErr;

              renderSavedBoards();
            } catch (err) {
              console.error("Erro ao alterar destaque:", err);
              alert("Erro ao alterar destaque: " + (err.message || err));
            }
          });

          footerEl.appendChild(featureBtn);
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
              .select("tiers, bank")
              .eq("id", board.id)
              .single();

            if (detailsError) throw detailsError;

            activeBoardId = board.id;
            boardTitle = board.title;
            tiersData = JSON.parse(JSON.stringify(details.tiers || []));
            bankData = JSON.parse(JSON.stringify(details.bank || []));
            activeEditing = true;

            await loadFeaturedBoardRatings(board.id);
            if (isFeaturedCard) {
              applyFeaturedAutoSorting();
            }

            activeTierlistTitle.textContent = boardTitle;
            renderBoard();
            renderBank();

            saveBoardState();

            landingWrapper.style.display = "none";
            editScreen.style.display = "flex";

            deleteBoardBtn.style.display = "inline-block";
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

  // --- Setup Landing Screen Events ---

  toggleSetupBtn.addEventListener("click", () => {
    setupCollapseContainer.classList.toggle("expanded");
    const isExpanded = setupCollapseContainer.classList.contains("expanded");
    toggleSetupBtn.innerHTML = isExpanded 
      ? "<span>➖ Recolher Criador</span>" 
      : "<span>➕ Criar Novo Tabuleiro</span>";
  });

  setupImportCheckbox.addEventListener("change", () => {
    setupImportOptions.style.display = setupImportCheckbox.checked ? "flex" : "none";
  });

  startCreationBtn.addEventListener("click", async () => {
    boardTitle = setupTitleInput.value.trim() || "Minha Tier List";
    activeTierlistTitle.textContent = boardTitle;

    // A fresh board creation reset
    activeBoardId = null;
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
            if (category === "games" && (card.id.startsWith("anime_") || card.id.startsWith("filmes_"))) return;
            if (category === "anime" && !card.id.startsWith("anime_")) return;
            if (category === "filmes" && !card.id.startsWith("filmes_")) return;
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
      
      // Reset collapse state
      if (setupCollapseContainer) setupCollapseContainer.classList.remove("expanded");
      if (toggleSetupBtn) toggleSetupBtn.innerHTML = "<span>➕ Criar Novo Tabuleiro</span>";
    } catch (err) {
      console.error("Erro ao voltar para a tela inicial:", err);
    }
  });

  // --- Initialization ---

  function init() {
    loadBoardState();
    
    if (activeEditing) {
      landingWrapper.style.display = "none";
      editScreen.style.display = "flex";
      activeTierlistTitle.textContent = boardTitle;
      renderBoard();
      renderBank();
      
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
  }

  init();
})();
