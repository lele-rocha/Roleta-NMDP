(function () {
  "use strict";

  const canvas = document.getElementById("wheel-canvas");
  const ctx = canvas.getContext("2d");
  const namesInput = document.getElementById("names-input");
  const spinBtn = document.getElementById("spin-btn");
  const nameCountEl = document.getElementById("name-count");
  const wheelHint = document.getElementById("wheel-hint");
  const winnerOverlay = document.getElementById("winner-overlay");
  const winnerNameEl = document.getElementById("winner-name");
  const winnerLabelEl = document.getElementById("winner-label");
  const confirmWinnerBtn = document.getElementById("confirm-winner-btn");
  const closeWinnerBtn = document.getElementById("close-winner-btn");
  const spinDurationSlider = document.getElementById("spin-duration");
  const spinDurationValue = document.getElementById("spin-duration-value");
  const tabButtons = document.querySelectorAll(".sidebar-tab");
  const tabPanels = document.querySelectorAll(".tab-panel");
  const centerImageInput = document.getElementById("center-image-input");
  const removeCenterImageBtn = document.getElementById("remove-center-image-btn");
  const bgImageInput = document.getElementById("bg-image-input");
  const removeBgImageBtn = document.getElementById("remove-bg-image-btn");
  const wheelCenterEl = document.querySelector(".wheel-center");

  const supabaseUrl = window.SUPABASE_URL;
  const supabaseKey = window.SUPABASE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase credentials not found in config.js");
  }
  const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

  const toggleDefaultWheelBtn = document.getElementById("toggle-default-wheel");
  const toggleCardsWheelBtn = document.getElementById("toggle-cards-wheel");
  const defaultNamesControls = document.getElementById("default-names-controls");
  const cardsNamesControls = document.getElementById("cards-names-controls");
  const importCardsBtn = document.getElementById("import-cards-btn");
  const importedCardsList = document.getElementById("imported-cards-list");
  const clearDefaultNamesBtn = document.getElementById("clear-default-names-btn");
  const clearCardsBtn = document.getElementById("clear-cards-btn");

  // Audio library state
  let audioLibrary = []; // each: { id, name, url, normalizedGain }
  let currentAudio = null;
  let currentAudioItem = null;
  let playingAudioId = null;

  // Master volume and audio normalization state
  let masterVolume = parseFloat(localStorage.getItem("roleta-nmdp-master-volume") || "1.0");
  let normalizeAudioEnabled = localStorage.getItem("roleta-nmdp-normalize-audio") !== "false";

  const audioLibraryInput = document.getElementById("audio-library-input");
  const audioListEl = document.getElementById("audio-list");
  const removeAudioBtn = document.getElementById("remove-audio-btn");
  const audioModeSelect = document.getElementById("audio-mode-select");
  const audioFixedSelect = document.getElementById("audio-fixed-select");
  const audioNoticeBox = document.getElementById("audio-notice-box");

  const masterVolumeSlider = document.getElementById("master-volume-slider");
  const masterVolumeValue = document.getElementById("master-volume-value");
  const masterVolumeIcon = document.getElementById("master-volume-icon");
  const normalizeAudioCheckbox = document.getElementById("normalize-audio-checkbox");

  // Web Audio Context for audio normalization / peak analysis
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) audioCtx = new AudioCtx();
    }
    return audioCtx;
  }

  async function calculateAudioNormalizedGain(url) {
    try {
      const ctx = getAudioContext();
      if (!ctx) return 1.0;
      const res = await fetch(url);
      const buf = await res.arrayBuffer();
      const audioBuf = await ctx.decodeAudioData(buf);
      
      let maxPeak = 0;
      for (let c = 0; c < audioBuf.numberOfChannels; c++) {
        const data = audioBuf.getChannelData(c);
        for (let i = 0; i < data.length; i += 10) {
          const val = Math.abs(data[i]);
          if (val > maxPeak) maxPeak = val;
        }
      }

      if (maxPeak <= 0.01) return 1.0;

      // Target peak amplitude: 0.70 (standardized comfortable loudness level)
      const targetPeak = 0.70;
      const gain = targetPeak / maxPeak;

      // Restrict gain scale between 0.3 (if super loud) and 2.5 (if super quiet)
      return Math.min(2.5, Math.max(0.3, gain));
    } catch (err) {
      console.warn("Could not calculate normalized gain:", err);
      return 1.0;
    }
  }

  function calculateEffectiveVolume(item) {
    let vol = masterVolume;
    if (normalizeAudioEnabled && item && item.normalizedGain) {
      vol = vol * item.normalizedGain;
    }
    return Math.min(1.0, Math.max(0.0, vol));
  }

  function updateVolumeUI() {
    if (masterVolumeSlider) {
      masterVolumeSlider.value = Math.round(masterVolume * 100);
    }
    if (masterVolumeValue) {
      masterVolumeValue.textContent = Math.round(masterVolume * 100) + "%";
    }
    if (masterVolumeIcon) {
      if (masterVolume <= 0) masterVolumeIcon.textContent = "🔇";
      else if (masterVolume < 0.5) masterVolumeIcon.textContent = "🔉";
      else masterVolumeIcon.textContent = "🔊";
    }
    if (normalizeAudioCheckbox) {
      normalizeAudioCheckbox.checked = normalizeAudioEnabled;
    }
  }

  if (masterVolumeSlider) {
    masterVolumeSlider.addEventListener("input", (e) => {
      masterVolume = parseFloat(e.target.value) / 100;
      localStorage.setItem("roleta-nmdp-master-volume", masterVolume.toString());
      updateVolumeUI();
      if (currentAudio) {
        currentAudio.volume = calculateEffectiveVolume(currentAudioItem);
      }
    });
  }

  if (normalizeAudioCheckbox) {
    normalizeAudioCheckbox.addEventListener("change", (e) => {
      normalizeAudioEnabled = e.target.checked;
      localStorage.setItem("roleta-nmdp-normalize-audio", normalizeAudioEnabled ? "true" : "false");
      if (currentAudio) {
        currentAudio.volume = calculateEffectiveVolume(currentAudioItem);
      }
    });
  }

  function showAudioDatabaseErrorNotice() {
    if (!audioNoticeBox) return;
    audioNoticeBox.hidden = false;
    audioNoticeBox.innerHTML = `
      <div style="background: rgba(235, 77, 75, 0.1); border: 1px dashed #eb4d4b; padding: 0.75rem; border-radius: 8px; margin-top: 0.75rem; text-align: left; animation: fade-in 0.3s ease;">
        <p style="color: #ff7675; font-size: 0.8rem; font-weight: bold; margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.35rem;">
          ⚠️ Tabela "audios" não encontrada no Supabase!
        </p>
        <p style="color: var(--text-muted); font-size: 0.75rem; line-height: 1.3; margin-bottom: 0.5rem;">
          Para salvar os sons no site para todos os usuários, execute o comando SQL abaixo no <strong>SQL Editor</strong> do seu Supabase:
        </p>
        <pre style="background: #000; color: #74b9ff; padding: 0.5rem; border-radius: 6px; font-size: 0.7rem; overflow-x: auto; font-family: monospace; white-space: pre-wrap; word-break: break-all; border: 1px solid var(--border);">CREATE TABLE public.audios (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    audio_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.audios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select" ON public.audios FOR SELECT USING (true);
CREATE POLICY "Allow insert" ON public.audios FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update" ON public.audios FOR UPDATE USING (true);
CREATE POLICY "Allow delete" ON public.audios FOR DELETE USING (true);</pre>
      </div>
    `;
  }

  async function loadAudios() {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from("audios")
        .select("id, name, audio_url")
        .order("created_at", { ascending: true });

      if (error) {
        if (error.code === "PGRST205" || (error.message && error.message.includes("public.audios"))) {
          showAudioDatabaseErrorNotice();
          return;
        }
        throw error;
      }

      if (audioNoticeBox) audioNoticeBox.hidden = true;
      audioLibrary = (data || []).map(item => ({
        id: item.id,
        name: item.name,
        url: item.audio_url,
        normalizedGain: 1.0
      }));
      refreshAudioUI();
      updateVolumeUI();

      // Compute peak gain in background for seamless normalization
      audioLibrary.forEach(async (item) => {
        item.normalizedGain = await calculateAudioNormalizedGain(item.url);
      });
    } catch (e) {
      console.error("Erro ao carregar áudios do Supabase:", e);
    }
  }

  function togglePlayAudio(item) {
    if (!item || !item.url) return;

    if (playingAudioId === item.id && currentAudio) {
      if (currentAudio.paused) {
        currentAudio.play().catch(() => {});
      } else {
        currentAudio.pause();
      }
      refreshAudioUI();
      return;
    }

    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }

    playingAudioId = item.id;
    currentAudioItem = item;
    currentAudio = new Audio(item.url);
    currentAudio.volume = calculateEffectiveVolume(item);

    currentAudio.onended = () => {
      playingAudioId = null;
      currentAudioItem = null;
      refreshAudioUI();
    };

    currentAudio.onpause = () => {
      refreshAudioUI();
    };

    currentAudio.onplay = () => {
      refreshAudioUI();
    };

    currentAudio.play().catch((err) => {
      console.error("Erro ao reproduzir áudio:", err);
      playingAudioId = null;
      currentAudioItem = null;
      refreshAudioUI();
    });

    refreshAudioUI();
  }

  // Helper to refresh UI for audio library
  function refreshAudioUI() {
    audioListEl.innerHTML = "";
    audioLibrary.forEach((item, idx) => {
      const li = document.createElement("li");
      li.className = "audio-item-card";

      const isCurrentlyPlaying = (playingAudioId === item.id && currentAudio && !currentAudio.paused);
      if (isCurrentlyPlaying) {
        li.classList.add("playing");
      }

      const infoDiv = document.createElement("div");
      infoDiv.className = "audio-item-info";

      // Play / Pause toggle button
      const playBtn = document.createElement("button");
      playBtn.className = "btn-play-audio";
      if (isCurrentlyPlaying) {
        playBtn.classList.add("playing");
      }
      playBtn.textContent = isCurrentlyPlaying ? "⏸️" : "▶️";
      playBtn.title = isCurrentlyPlaying ? "Pausar Áudio" : "Tocar Áudio";
      playBtn.addEventListener("click", () => {
        togglePlayAudio(item);
      });

      const titleSpan = document.createElement("span");
      titleSpan.className = "audio-item-name";
      titleSpan.textContent = item.name;
      titleSpan.title = item.name;

      infoDiv.appendChild(playBtn);
      infoDiv.appendChild(titleSpan);

      // Remove single sound button
      const removeBtn = document.createElement("button");
      removeBtn.textContent = "🗑️ Excluir";
      removeBtn.className = "btn-remove-single-audio";
      removeBtn.addEventListener("click", async () => {
        const confirmDel = confirm(`Deseja remover o áudio "${item.name}" para todos os usuários?`);
        if (!confirmDel) return;

        removeBtn.disabled = true;
        try {
          if (playingAudioId === item.id && currentAudio) {
            currentAudio.pause();
            currentAudio = null;
            playingAudioId = null;
          }
          if (item.id) {
            await supabase.from("audios").delete().eq("id", item.id);
          }
          audioLibrary.splice(idx, 1);
          refreshAudioUI();
        } catch (err) {
          console.error("Erro ao remover áudio:", err);
          alert("Erro ao remover áudio do banco de dados.");
        }
      });

      li.appendChild(infoDiv);
      li.appendChild(removeBtn);
      audioListEl.appendChild(li);
    });

    removeAudioBtn.style.display = audioLibrary.length ? "inline-block" : "none";

    audioFixedSelect.innerHTML = "";
    audioLibrary.forEach((item, idx) => {
      const opt = document.createElement("option");
      opt.value = idx;
      opt.textContent = item.name;
      audioFixedSelect.appendChild(opt);
    });

    if (audioModeSelect.value === "fixed") {
      audioFixedSelect.style.display = "block";
    } else {
      audioFixedSelect.style.display = "none";
    }
  }

  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  }

  audioLibraryInput.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    if (!supabase) {
      alert("Erro: Conexão com Supabase não está ativa!");
      return;
    }

    const uploadLabel = document.querySelector('label[for="audio-library-input"]');
    const originalText = uploadLabel ? uploadLabel.textContent : "Adicionar Áudios";
    if (uploadLabel) uploadLabel.textContent = "Salvando no Banco...";
    audioLibraryInput.disabled = true;

    try {
      for (const file of files) {
        const dataUrl = await fileToDataURL(file);
        const newId = "audio-" + Date.now().toString(36) + "-" + Math.random().toString(36).substr(2, 5);

        const { error } = await supabase.from("audios").insert([{
          id: newId,
          name: file.name,
          audio_url: dataUrl,
          created_at: new Date().toISOString()
        }]);

        if (error) {
          if (error.code === "PGRST205" || (error.message && error.message.includes("public.audios"))) {
            showAudioDatabaseErrorNotice();
            alert("A tabela 'audios' não existe no Supabase. Crie-a no painel do Supabase conforme o aviso!");
            break;
          }
          throw error;
        }
      }
      await loadAudios();
    } catch (err) {
      console.error("Erro ao fazer upload dos áudios:", err);
      alert("Houve um erro ao salvar o áudio no banco de dados.");
    } finally {
      audioLibraryInput.disabled = false;
      if (uploadLabel) uploadLabel.textContent = originalText;
      e.target.value = "";
    }
  });

  removeAudioBtn.addEventListener("click", async () => {
    if (!audioLibrary.length) return;
    const confirmClear = confirm("Tem certeza que deseja excluir TODOS os áudios da biblioteca para todos os usuários?");
    if (!confirmClear) return;

    removeAudioBtn.disabled = true;
    removeAudioBtn.textContent = "Removendo...";

    try {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
        playingAudioId = null;
      }
      const ids = audioLibrary.map(a => a.id).filter(Boolean);
      if (ids.length) {
        await supabase.from("audios").delete().in("id", ids);
      }
      audioLibrary = [];
      refreshAudioUI();
    } catch (err) {
      console.error("Erro ao remover todos os áudios:", err);
      alert("Erro ao remover áudios do banco de dados.");
    } finally {
      removeAudioBtn.disabled = false;
      removeAudioBtn.textContent = "Remover Todos";
    }
  });

  audioModeSelect.addEventListener("change", () => {
    refreshAudioUI();
  });

  function setupAudioRealtime() {
    if (!supabase) return;
    supabase
      .channel("audios-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "audios" },
        () => {
          loadAudios();
        }
      )
      .subscribe();
  }

  function playWinnerSound() {
    if (audioLibrary.length === 0) return;
    let selectedItem;
    if (audioModeSelect.value === "random") {
      const idx = Math.floor(Math.random() * audioLibrary.length);
      selectedItem = audioLibrary[idx];
    } else {
      const idx = parseInt(audioFixedSelect.value, 10);
      if (isNaN(idx) || idx < 0 || idx >= audioLibrary.length) return;
      selectedItem = audioLibrary[idx];
    }
    if (selectedItem) {
      togglePlayAudio(selectedItem);
    }
  }

  const POINTER_ANGLE = -Math.PI / 2;
  const MIN_SPINS = 5;
  const MAX_SPINS = 10;

  let names = [];
  let activeWheelMode = "default"; // "default" or "cards"
  let cardsWheelItems = []; // { id, title, lives }

  // Confetti Animation Logic
  let confettiActive = false;
  let confettiCanvas = null;
  let confettiCtx = null;
  let confettiParticles = [];
  const CONFETTI_COLORS = ["#6c5ce7", "#7f70f0", "#fdcb6e", "#ff7675", "#55efc4", "#81ecec", "#a29bfe"];

  function startConfetti() {
    if (confettiActive) return;
    confettiCanvas = document.getElementById("confetti-canvas");
    if (!confettiCanvas) {
      confettiCanvas = document.createElement("canvas");
      confettiCanvas.id = "confetti-canvas";
      confettiCanvas.style.position = "fixed";
      confettiCanvas.style.inset = "0";
      confettiCanvas.style.width = "100vw";
      confettiCanvas.style.height = "100vh";
      confettiCanvas.style.pointerEvents = "none";
      confettiCanvas.style.zIndex = "999";
      document.body.appendChild(confettiCanvas);
    }
    confettiCtx = confettiCanvas.getContext("2d");
    resizeConfettiCanvas();
    window.addEventListener("resize", resizeConfettiCanvas);

    confettiActive = true;
    confettiParticles = [];
    for (let i = 0; i < 150; i++) {
      confettiParticles.push(createConfettiParticle());
    }
    requestAnimationFrame(updateConfetti);
  }

  function stopConfetti() {
    confettiActive = false;
    window.removeEventListener("resize", resizeConfettiCanvas);
    if (confettiCanvas && confettiCanvas.parentNode) {
      confettiCanvas.parentNode.removeChild(confettiCanvas);
      confettiCanvas = null;
      confettiCtx = null;
    }
  }

  function resizeConfettiCanvas() {
    if (confettiCanvas) {
      confettiCanvas.width = window.innerWidth;
      confettiCanvas.height = window.innerHeight;
    }
  }

  function createConfettiParticle() {
    return {
      x: Math.random() * window.innerWidth,
      y: Math.random() * -window.innerHeight - 20,
      size: Math.random() * 8 + 6,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      speedX: Math.random() * 4 - 2,
      speedY: Math.random() * 5 + 4,
      rotation: Math.random() * 360,
      rotationSpeed: Math.random() * 4 - 2,
    };
  }

  function updateConfetti() {
    if (!confettiActive) return;
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

    let activeParticles = 0;
    confettiParticles.forEach((p) => {
      p.y += p.speedY;
      p.x += p.speedX;
      p.rotation += p.rotationSpeed;

      confettiCtx.save();
      confettiCtx.translate(p.x, p.y);
      confettiCtx.rotate((p.rotation * Math.PI) / 180);
      confettiCtx.fillStyle = p.color;
      confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      confettiCtx.restore();

      if (p.y < window.innerHeight) {
        activeParticles++;
      } else {
        p.y = -20;
        p.x = Math.random() * window.innerWidth;
        p.speedY = Math.random() * 5 + 4;
      }
    });

    if (activeParticles > 0) {
      requestAnimationFrame(updateConfetti);
    }
  }

  function showUltimateWinner(name) {
    winnerNameEl.textContent = name;
    winnerLabelEl.textContent = "🏆 Vencedor Absoluto 🏆";
    confirmWinnerBtn.style.display = "none";
    closeWinnerBtn.textContent = "Celebrar!";
    winnerOverlay.hidden = false;
    startConfetti();
  }

  function saveCardsWheelState() {
    localStorage.setItem("roleta-nmdp-cards-wheel", JSON.stringify(cardsWheelItems));
  }

  function loadCardsWheelState() {
    try {
      const raw = localStorage.getItem("roleta-nmdp-cards-wheel");
      if (raw) {
        cardsWheelItems = JSON.parse(raw);
      }
    } catch (e) {
      cardsWheelItems = [];
    }
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
  let rotation = 0;
  let isSpinning = false;
  let animationId = null;
  let winningIndex = -1;
  let centerImage = null;
  let spinStartTime = 0;
  let spinStartRotation = 0;
  let spinTotalRotation = 0;
  let spinDurationMs = 5000;

  function parseNames(text) {
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  function getSpinDurationMs() {
    return parseFloat(spinDurationSlider.value) * 1000;
  }

  function updateDurationLabel() {
    spinDurationValue.textContent = `${parseFloat(spinDurationSlider.value).toFixed(1)}s`;
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function switchTab(tabId) {
    tabButtons.forEach((btn) => {
      const isActive = btn.dataset.tab === tabId;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-selected", String(isActive));
    });

    tabPanels.forEach((panel) => {
      const isActive = panel.id === `tab-${tabId}`;
      panel.classList.toggle("active", isActive);
      panel.hidden = !isActive;
    });
  }

  function getSliceColor(index, total) {
    const hue = (index * 360) / total;
    const lightness = index % 2 === 0 ? 52 : 44;
    return `hsl(${hue}, 68%, ${lightness}%)`;
  }

  function getContrastColor(hslColor) {
    const match = hslColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (!match) return "#ffffff";
    const l = parseInt(match[3], 10);
    return l > 50 ? "#1a1d27" : "#ffffff";
  }

  function fitText(text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let truncated = text;
    while (truncated.length > 1 && ctx.measureText(truncated + "…").width > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    return truncated + "…";
  }

  function drawWheel() {
    const size = canvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 4;

    ctx.clearRect(0, 0, size, size);

    let currentItems = [];
    if (activeWheelMode === "default") {
      currentItems = names;
    } else {
      currentItems = cardsWheelItems.filter(item => item.lives > 0).map(item => `${item.title} (${item.lives})`);
    }

    if (currentItems.length === 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = "#242836";
      ctx.fill();
      ctx.strokeStyle = "#2e3345";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#9aa3b8";
      ctx.font = "600 18px Outfit, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(activeWheelMode === "default" ? "Adicione nomes" : "Importe os cards", cx, cy);
      return;
    }

    const sliceAngle = (Math.PI * 2) / currentItems.length;

    currentItems.forEach((name, i) => {
      const startAngle = rotation + i * sliceAngle;
      const endAngle = startAngle + sliceAngle;
      const color = getSliceColor(i, currentItems.length);

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();

      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const midAngle = startAngle + sliceAngle / 2;
      const normAngle = normalizeAngle(midAngle);
      const isBottomHalf = normAngle > 0 && normAngle < Math.PI;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(midAngle);

      const textDist = radius * 0.55;
      ctx.translate(textDist, 0);

      if (isBottomHalf) {
        ctx.rotate(Math.PI);
      }

      const fontSize = Math.max(11, Math.min(16, 220 / currentItems.length));
      ctx.font = `600 ${fontSize}px Outfit, sans-serif`;
      ctx.fillStyle = getContrastColor(color);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const maxTextWidth = radius * 0.55;
      ctx.fillText(fitText(name, maxTextWidth), 0, 0);
      ctx.restore();

      if (i === winningIndex && !isSpinning) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = "rgba(253, 203, 110, 0.35)";
        ctx.fill();
        ctx.strokeStyle = "#fdcb6e";
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    });

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 3;
    ctx.stroke();

    if (centerImage) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rotation);

      const imgSize = size * 0.18;
      const x = -imgSize / 2;
      const y = -imgSize / 2;

      ctx.beginPath();
      ctx.arc(0, 0, imgSize / 2, 0, Math.PI * 2);
      ctx.clip();

      ctx.drawImage(centerImage, x, y, imgSize, imgSize);
      ctx.restore();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.beginPath();
      ctx.arc(0, 0, imgSize / 2, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
  }

  function normalizeAngle(angle) {
    const twoPi = Math.PI * 2;
    return ((angle % twoPi) + twoPi) % twoPi;
  }

  function getWinnerIndex() {
    let totalItems = 0;
    if (activeWheelMode === "default") {
      totalItems = names.length;
    } else {
      totalItems = cardsWheelItems.filter(item => item.lives > 0).length;
    }
    if (totalItems === 0) return -1;
    const sliceAngle = (Math.PI * 2) / totalItems;
    const pointerInWheel = normalizeAngle(POINTER_ANGLE - rotation);
    const index = Math.floor(pointerInWheel / sliceAngle) % totalItems;
    return index;
  }

  function renderImportedCardsList() {
    if (!importedCardsList) return;

    if (cardsWheelItems.length === 0) {
      importedCardsList.innerHTML = `
        <p class="setting-desc" style="text-align: center; padding: 1.5rem 0;">
          Nenhum card importado ainda. Clique no botão acima para carregar.
        </p>
      `;
      return;
    }

    importedCardsList.innerHTML = "";
    cardsWheelItems.forEach((item) => {
      const el = document.createElement("div");
      el.className = "imported-card-item";
      if (item.lives === 0) {
        el.classList.add("eliminated");
      }
      el.innerHTML = `
        <span class="imported-card-title">${escapeHtml(item.title)}</span>
        <span class="imported-card-lives">${item.lives > 0 ? `❤️ ${item.lives}` : "💀 Eliminado"}</span>
      `;
      importedCardsList.appendChild(el);
    });
  }

  function updateUI() {
    let count = 0;
    let canSpin = false;

    if (activeWheelMode === "default") {
      names = parseNames(namesInput.value);
      count = names.length;
      nameCountEl.textContent = count === 1 ? "1 nome" : `${count} nomes`;
      canSpin = count >= 2 && !isSpinning;

      namesInput.disabled = isSpinning;
      spinDurationSlider.disabled = isSpinning;

      if (isSpinning) {
        wheelHint.textContent = "Girando…";
      } else if (count < 2) {
        wheelHint.textContent =
          count === 1
            ? "Adicione mais um nome para girar"
            : "Adicione pelo menos 2 nomes para girar";
      } else {
        wheelHint.textContent = "Clique em Girar para sortear!";
      }
    } else {
      const activeItems = cardsWheelItems.filter(item => item.lives > 0);
      count = activeItems.length;
      nameCountEl.textContent = count === 1 ? "1 card" : `${count} cards`;
      canSpin = count >= 2 && !isSpinning;

      spinDurationSlider.disabled = isSpinning;

      if (isSpinning) {
        wheelHint.textContent = "Girando…";
      } else if (count < 2) {
        wheelHint.textContent =
          count === 1
            ? "Importe mais cards com votos para girar"
            : "Importe pelo menos 2 cards com votos para girar";
      } else {
        wheelHint.textContent = "Clique em Girar para sortear!";
      }

      renderImportedCardsList();
    }

    spinBtn.disabled = !canSpin;
    drawWheel();
  }

  function showWinner(name) {
    winnerNameEl.textContent = name;
    
    let totalItems = 0;
    if (activeWheelMode === "default") {
      totalItems = names.length;
    } else {
      totalItems = cardsWheelItems.filter(item => item.lives > 0).length;
    }

    const canConfirm = (activeWheelMode === "default" && totalItems > 2) || 
                       (activeWheelMode === "cards" && totalItems >= 2);

    if (canConfirm) {
      winnerLabelEl.textContent = activeWheelMode === "default" ? "Nome Sorteado" : "Card Sorteado";
      confirmWinnerBtn.style.display = "";
      closeWinnerBtn.textContent = "Cancelar";
    } else {
      winnerLabelEl.textContent = "Vencedor";
      confirmWinnerBtn.style.display = "none";
      closeWinnerBtn.textContent = "Fechar";
    }
    winnerOverlay.hidden = false;
  }

  function hideWinner() {
    winnerOverlay.hidden = true;
    stopConfetti();
  }

  function removeName(index) {
    if (index >= 0 && index < names.length) {
      names.splice(index, 1);
      namesInput.value = names.join("\n");
      winningIndex = -1;
      updateUI();
    }
  }

  function stopSpin() {
    isSpinning = false;
    spinBtn.classList.remove("spinning");
    winningIndex = getWinnerIndex();
    updateUI();

    let winner = "";
    if (activeWheelMode === "default") {
      winner = names[winningIndex];
    } else {
      const activeItems = cardsWheelItems.filter(item => item.lives > 0);
      winner = activeItems[winningIndex] ? activeItems[winningIndex].title : "";
    }

    playWinnerSound();
    if (winner) {
      setTimeout(() => showWinner(winner), 400);
    }
  }

  function animate(timestamp) {
    const elapsed = timestamp - spinStartTime;
    const progress = Math.min(elapsed / spinDurationMs, 1);
    const eased = easeOutCubic(progress);

    rotation = spinStartRotation + spinTotalRotation * eased;
    drawWheel();

    if (progress < 1) {
      animationId = requestAnimationFrame(animate);
      return;
    }

    animationId = null;
    stopSpin();
  }

  function spin() {
    let totalItems = 0;
    if (activeWheelMode === "default") {
      totalItems = names.length;
    } else {
      totalItems = cardsWheelItems.filter(item => item.lives > 0).length;
    }

    if (isSpinning || totalItems < 2) return;

    hideWinner();
    isSpinning = true;
    winningIndex = -1;
    spinBtn.classList.add("spinning");
    updateUI();

    spinDurationMs = getSpinDurationMs();
    spinStartRotation = rotation;
    spinStartTime = performance.now();

    const extraSpins = MIN_SPINS + Math.random() * (MAX_SPINS - MIN_SPINS);
    const randomOffset = Math.random() * Math.PI * 2;
    spinTotalRotation = extraSpins * Math.PI * 2 + randomOffset;

    if (animationId) {
      cancelAnimationFrame(animationId);
    }
    animationId = requestAnimationFrame(animate);
  }

  // Event listeners
  tabButtons.forEach((btn) => btn.addEventListener("click", () => switchTab(btn.dataset.tab)));

  spinDurationSlider.addEventListener("input", updateDurationLabel);
  namesInput.addEventListener("input", () => {
    winningIndex = -1;
    updateUI();
  });
  spinBtn.addEventListener("click", spin);
  confirmWinnerBtn.addEventListener("click", () => {
    if (winningIndex !== -1) {
      if (activeWheelMode === "default") {
        removeName(winningIndex);
        hideWinner();
      } else {
        const activeItems = cardsWheelItems.filter(item => item.lives > 0);
        const item = activeItems[winningIndex];
        if (item) {
          item.lives--;
          saveCardsWheelState();
          winningIndex = -1;
          updateUI();

          const remainingActive = cardsWheelItems.filter(item => item.lives > 0);
          if (remainingActive.length === 1) {
            setTimeout(() => {
              showUltimateWinner(remainingActive[0].title);
            }, 500);
            return;
          }
        }
        hideWinner();
      }
    } else {
      hideWinner();
    }
  });
  closeWinnerBtn.addEventListener("click", hideWinner);

  // Mode toggle event listeners
  toggleDefaultWheelBtn.addEventListener("click", () => setWheelMode("default"));
  toggleCardsWheelBtn.addEventListener("click", () => setWheelMode("cards"));

  // Clear buttons event listeners
  if (clearDefaultNamesBtn) {
    clearDefaultNamesBtn.addEventListener("click", () => {
      namesInput.value = "";
      namesInput.dispatchEvent(new Event("input"));
      winningIndex = -1;
      updateUI();
    });
  }

  if (clearCardsBtn) {
    clearCardsBtn.addEventListener("click", () => {
      if (confirm("Tem certeza que deseja limpar todos os cards importados?")) {
        cardsWheelItems = [];
        saveCardsWheelState();
        winningIndex = -1;
        updateUI();
      }
    });
  }

  function setWheelMode(mode) {
    activeWheelMode = mode;
    winningIndex = -1;
    
    if (mode === "default") {
      toggleDefaultWheelBtn.classList.add("active");
      toggleCardsWheelBtn.classList.remove("active");
      defaultNamesControls.style.display = "block";
      cardsNamesControls.style.display = "none";
    } else {
      toggleDefaultWheelBtn.classList.remove("active");
      toggleCardsWheelBtn.classList.add("active");
      defaultNamesControls.style.display = "none";
      cardsNamesControls.style.display = "block";
    }

    updateUI();
  }

  // Import button event listener
  importCardsBtn.addEventListener("click", importCardsFromStorage);

  async function importCardsFromStorage() {
    try {
      const { data, error } = await supabase
        .from("cards")
        .select("id, title, votes")
        .gte("votes", 1);
      if (error) throw error;

      if (data && data.length > 0) {
        const categorySelect = document.getElementById("wheel-card-category-select");
        const category = categorySelect ? categorySelect.value : "games";

        const filteredData = data.filter(c => {
          if (category === "anime") {
            return c.id.startsWith("anime_");
          } else if (category === "filmes") {
            return c.id.startsWith("filmes_");
          } else if (category === "games") {
            return !c.id.startsWith("anime_") && !c.id.startsWith("filmes_");
          }
          return true; // "all"
        });

        if (filteredData.length === 0) {
          const catName = category === "anime" ? "Anime" : category === "filmes" ? "Filmes" : category === "games" ? "Games" : "Todos";
          alert(`Nenhum card com 1 ou mais votos encontrado para a categoria selecionada (${catName})!`);
          return;
        }

        cardsWheelItems = filteredData.map(c => ({
          id: c.id,
          title: c.title,
          lives: c.votes
        }));
        saveCardsWheelState();
        updateUI();

        if (cardsWheelItems.length === 1) {
          setTimeout(() => {
            showUltimateWinner(cardsWheelItems[0].title);
          }, 400);
        }
      } else {
        alert("Nenhum card cadastrado com 1 ou mais votos encontrado no banco de dados!");
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao importar cards do banco de dados!");
    }
  }
  winnerOverlay.addEventListener("click", (e) => {
    if (e.target === winnerOverlay) hideWinner();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !winnerOverlay.hidden) {
      hideWinner();
    }
    if (e.key === "Enter" && e.ctrlKey && !spinBtn.disabled) {
      spin();
    }
  });

  centerImageInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          centerImage = img;
          wheelCenterEl.style.display = "none";
          removeCenterImageBtn.style.display = "inline-block";
          drawWheel();
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  });

  removeCenterImageBtn.addEventListener("click", () => {
    centerImage = null;
    centerImageInput.value = "";
    wheelCenterEl.style.display = "";
    removeCenterImageBtn.style.display = "none";
    drawWheel();
  });

  bgImageInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        document.body.style.backgroundImage = `url('${event.target.result}')`;
        document.body.style.backgroundSize = "cover";
        document.body.style.backgroundPosition = "center";
        document.body.style.backgroundAttachment = "fixed";
        removeBgImageBtn.style.display = "inline-block";
      };
      reader.readAsDataURL(file);
    }
  });

  removeBgImageBtn.addEventListener("click", () => {
    document.body.style.backgroundImage = "";
    document.body.style.backgroundSize = "";
    document.body.style.backgroundPosition = "";
    document.body.style.backgroundAttachment = "";
    bgImageInput.value = "";
    removeBgImageBtn.style.display = "none";
  });

  loadCardsWheelState();
  updateDurationLabel();
  updateUI();
  loadAudios();
  setupAudioRealtime();
})();
