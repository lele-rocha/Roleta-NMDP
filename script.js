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
  const closeWinnerBtn = document.getElementById("close-winner-btn");
  const spinDurationSlider = document.getElementById("spin-duration");
  const spinDurationValue = document.getElementById("spin-duration-value");
  const tabButtons = document.querySelectorAll(".sidebar-tab");
  const tabPanels = document.querySelectorAll(".tab-panel");

  const POINTER_ANGLE = -Math.PI / 2;
  const MIN_SPINS = 5;
  const MAX_SPINS = 10;

  let names = [];
  let rotation = 0;
  let isSpinning = false;
  let animationId = null;
  let winningIndex = -1;
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

      // Place the names along the radius of each slice
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

    nameCountEl.textContent =
      count === 1 ? "1 nome" : `${count} nomes`;

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

    if (!isSpinning) {
      winningIndex = -1;
    }

    drawWheel();
  }

  function showWinner(name) {
    winnerNameEl.textContent = name;
    winnerOverlay.hidden = false;
  }

  function hideWinner() {
    winnerOverlay.hidden = true;
  }

  function stopSpin() {
    isSpinning = false;
    spinBtn.classList.remove("spinning");
    winningIndex = getWinnerIndex();
    drawWheel();
    updateUI();

    const winner = names[winningIndex];
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

    const extraSpins =
      MIN_SPINS + Math.random() * (MAX_SPINS - MIN_SPINS);
    const randomOffset = Math.random() * Math.PI * 2;
    spinTotalRotation = extraSpins * Math.PI * 2 + randomOffset;

    if (animationId) {
      cancelAnimationFrame(animationId);
    }
    animationId = requestAnimationFrame(animate);
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  spinDurationSlider.addEventListener("input", updateDurationLabel);
  namesInput.addEventListener("input", updateUI);
  spinBtn.addEventListener("click", spin);
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

  updateDurationLabel();
  updateUI();
})();
