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

  function createItemElement(item) {
    const img = document.createElement("img");
    img.className = "tier-item-img";
    img.src = item.src;
    img.dataset.id = item.id;
    img.title = item.title || "";
    img.draggable = true;

    setupDragEvents(img);
    setupHoverPreview(img);
    return img;
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
        if (category === "games" && card.id.startsWith("anime_")) return;
        if (category === "anime" && !card.id.startsWith("anime_")) return;

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

  // --- Saved Board Collection Controls (Supabase Shared DB) ---

  async function saveBoardToCollection() {
    if (!supabase) {
      alert("A conexão com o banco de dados não está configurada!");
      return;
    }

    // 1. Gather Tiers state
    const tiers = [];
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
    saveBoardBtn.textContent = "Salvando...";

    const userName = localStorage.getItem("roleta-nmdp-session") || "Anônimo";

    try {
      const { error } = await supabase.from("tier_lists").upsert({
        id: activeBoardId,
        title: boardTitle,
        created_by: userName,
        tiers: tiers,
        bank: bank,
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
        alert("Erro ao salvar tabuleiro no banco de dados.");
      }
    } finally {
      saveBoardBtn.disabled = false;
      saveBoardBtn.textContent = "💾 Salvar Tabuleiro";
    }
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

    try {
      // 2. Query only metadata columns to ensure instant speed
      const { data, error } = await supabase
        .from("tier_lists")
        .select("id, title, created_by, updated_at")
        .order("updated_at", { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        savedBoardsList.innerHTML = `
          <p class="empty-saved-msg" style="color: var(--text-muted); font-size: 0.95rem; text-align: center; padding: 2rem 0; width: 100%;">
            Nenhum tabuleiro salvo ainda. Crie um acima!
          </p>
        `;
        return;
      }

      // Clear spinner and render cards
      savedBoardsList.innerHTML = "";

      data.forEach(board => {
        const card = document.createElement("div");
        card.className = "saved-board-card";

        // 1. Board Title
        const titleEl = document.createElement("h3");
        titleEl.className = "saved-board-title";
        titleEl.textContent = board.title || "Sem Título";
        card.appendChild(titleEl);

        // 2. Mini CSS preview of layout (Generic, fast-loading placeholder visual)
        const previewEl = document.createElement("div");
        previewEl.className = "mini-board-preview";

        const placeholderTiers = [
          { color: "#ff7f7f", count: 2 },
          { color: "#ffbf7f", count: 3 },
          { color: "#ffdf7f", count: 1 },
          { color: "#ffff7f", count: 2 },
          { color: "#7fff7f", count: 0 },
          { color: "#7fbbff", count: 1 }
        ];

        placeholderTiers.forEach(tier => {
          const rowEl = document.createElement("div");
          rowEl.className = "mini-board-row";

          const labelEl = document.createElement("div");
          labelEl.className = "mini-board-label";
          labelEl.style.backgroundColor = tier.color;
          rowEl.appendChild(labelEl);

          const itemsEl = document.createElement("div");
          itemsEl.className = "mini-board-items";

          for (let i = 0; i < tier.count; i++) {
            const itemEl = document.createElement("div");
            itemEl.className = "mini-board-item";
            itemEl.style.background = "rgba(255, 255, 255, 0.15)";
            itemsEl.appendChild(itemEl);
          }

          rowEl.appendChild(itemsEl);
          previewEl.appendChild(rowEl);
        });

        card.appendChild(previewEl);

        // 3. Metadata footer
        const footerEl = document.createElement("div");
        footerEl.className = "saved-board-meta";

        // Creator badge
        const creatorEl = document.createElement("span");
        creatorEl.className = "saved-board-creator";
        creatorEl.innerHTML = `👤 Criado por: <strong>${board.created_by || "Anônimo"}</strong>`;
        footerEl.appendChild(creatorEl);

        const dateEl = document.createElement("span");
        dateEl.className = "saved-board-date";
        const dateObj = new Date(board.updated_at || Date.now());
        dateEl.textContent = `Atualizado: ${dateObj.toLocaleDateString("pt-BR")} ${dateObj.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}`;
        footerEl.appendChild(dateEl);

        card.appendChild(footerEl);

        // Click event on whole card to edit/load details ON DEMAND
        card.addEventListener("click", async () => {
          // Prevent double clicks
          if (card.dataset.loading === "true") return;
          card.dataset.loading = "true";
          
          const originalTitle = titleEl.textContent;
          titleEl.textContent = "⏳ Carregando...";

          try {
            // Lazy load the full tiers and bank payload point-lookup query
            const { data: details, error: detailsError } = await supabase
              .from("tier_lists")
              .select("tiers, bank")
              .eq("id", board.id)
              .single();

            if (detailsError) throw detailsError;

            // Load details into editor state
            activeBoardId = board.id;
            boardTitle = board.title;
            tiersData = JSON.parse(JSON.stringify(details.tiers || []));
            bankData = JSON.parse(JSON.stringify(details.bank || []));
            activeEditing = true;

            // Switch to editor
            activeTierlistTitle.textContent = boardTitle;
            renderBoard();
            renderBank();

            // Save the newly rendered state to local storage
            saveBoardState();

            landingWrapper.style.display = "none";
            editScreen.style.display = "flex";

            // Show delete board button since it is a saved board
            deleteBoardBtn.style.display = "inline-block";
          } catch (err) {
            console.error("Erro ao carregar detalhes:", err);
            const errMsg = err.message || err.details || (typeof err === "object" ? JSON.stringify(err) : err);
            alert("Não foi possível abrir o tabuleiro: " + errMsg);
            titleEl.textContent = originalTitle;
            card.dataset.loading = "false";
          }
        });

        savedBoardsList.appendChild(card);
      });
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
    tiers JSONB NOT NULL,
    bank JSONB NOT NULL,
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
            if (category === "games" && card.id.startsWith("anime_")) return;
            if (category === "anime" && !card.id.startsWith("anime_")) return;
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
