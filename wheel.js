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

  // Audio library state
  let audioLibrary = [];
  let currentAudio = null;

  const audioLibraryInput = document.getElementById("audio-library-input");
  const audioListEl = document.getElementById("audio-list");
  const removeAudioBtn = document.getElementById("remove-audio-btn");
  const audioModeSelect = document.getElementById("audio-mode-select");
  const audioFixedSelect = document.getElementById("audio-fixed-select");

  // Helper to refresh UI for audio library
  function refreshAudioUI() {
    audioListEl.innerHTML = "";
    audioLibrary.forEach((item, idx) => {
      const li = document.createElement("li");
      li.textContent = item.name;
      const removeBtn = document.createElement("button");
      removeBtn.textContent = "Remover";
      removeBtn.className = "btn-danger";
      removeBtn.style.marginLeft = "0.5rem";
      removeBtn.addEventListener("click", () => {
        audioLibrary.splice(idx, 1);
        refreshAudioUI();
      });
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

  audioLibraryInput.addEventListener("change", (e) => {
    const files = Array.from(e.target.files);
    files.forEach((file) => {
      const url = URL.createObjectURL(file);
      audioLibrary.push({ name: file.name, url });
    });
    e.target.value = "";
    refreshAudioUI();
  });

  removeAudioBtn.addEventListener("click", () => {
    audioLibrary.forEach(item => URL.revokeObjectURL(item.url));
    audioLibrary = [];
    refreshAudioUI();
  });

  audioModeSelect.addEventListener("change", () => {
    refreshAudioUI();
  });

  function playWinnerSound() {
    if (audioLibrary.length === 0) return;
    let soundUrl;
    if (audioModeSelect.value === "random") {
      const idx = Math.floor(Math.random() * audioLibrary.length);
      soundUrl = audioLibrary[idx].url;
    } else {
      const idx = parseInt(audioFixedSelect.value, 10);
      if (isNaN(idx) || idx < 0 || idx >= audioLibrary.length) return;
      soundUrl = audioLibrary[idx].url;
    }
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    currentAudio = new Audio(soundUrl);
    currentAudio.play().catch(() => {});
  }

  const POINTER_ANGLE = -Math.PI / 2;
  const MIN_SPINS = 5;
  const MAX_SPINS = 10;

  let names = [];
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

    if (names.length === 0) {
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
      ctx.fillText("Adicione nomes", cx, cy);
      return;
    }

    const sliceAngle = (Math.PI * 2) / names.length;

    names.forEach((name, i) => {
      const startAngle = rotation + i * sliceAngle;
      const endAngle = startAngle + sliceAngle;
      const color = getSliceColor(i, names.length);

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

      const fontSize = Math.max(11, Math.min(16, 220 / names.length));
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
    if (names.length === 0) return -1;
    const sliceAngle = (Math.PI * 2) / names.length;
    const pointerInWheel = normalizeAngle(POINTER_ANGLE - rotation);
    const index = Math.floor(pointerInWheel / sliceAngle) % names.length;
    return index;
  }

  function updateUI() {
    names = parseNames(namesInput.value);
    const count = names.length;

    nameCountEl.textContent = count === 1 ? "1 nome" : `${count} nomes`;

    const canSpin = count >= 2 && !isSpinning;
    spinBtn.disabled = !canSpin;
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

    drawWheel();
  }

  function showWinner(name) {
    winnerNameEl.textContent = name;
    if (names.length > 2) {
      winnerLabelEl.textContent = "Nome Sorteado";
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

    const winner = names[winningIndex];
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
    if (isSpinning || names.length < 2) return;

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
      removeName(winningIndex);
    }
    hideWinner();
  });
  closeWinnerBtn.addEventListener("click", hideWinner);
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

  updateDurationLabel();
  updateUI();
})();
