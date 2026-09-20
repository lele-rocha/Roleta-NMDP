(function () {
  "use strict";

  // Floating ambient cards background effect
  const NUM_FLOATING_CARDS = 15;

  function initAmbientBackground() {
    if (document.getElementById("ambient-bg-canvas")) return;

    const canvas = document.createElement("canvas");
    canvas.id = "ambient-bg-canvas";
    canvas.className = "ambient-bg-canvas";
    document.body.prepend(canvas);

    const ctx = canvas.getContext("2d");
    let width = 0;
    let height = 0;
    let dpr = window.devicePixelRatio || 1;

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.scale(dpr, dpr);
    }

    resize();
    window.addEventListener("resize", resize);

    const loadedImages = [];
    const particles = [];

    function createParticle(initialYRandom) {
      const size = Math.floor(Math.random() * 55) + 60; // 60px to 115px
      const aspectRatio = 1.35; // typical card aspect ratio (h / w)
      const w = size;
      const h = size * aspectRatio;
      const x = Math.random() * (width - w);
      const y = initialYRandom ? Math.random() * (height + h) - h : -h - (Math.random() * 80);
      const speed = 0.35 + Math.random() * 0.45; // Constant smooth falling speed
      const baseOpacity = 0.08 + Math.random() * 0.12; // 0.08 to 0.20 reduced opacity
      const rotation = (Math.random() - 0.5) * 0.25; // subtle tilt in radians
      const img = loadedImages.length > 0 ? loadedImages[Math.floor(Math.random() * loadedImages.length)] : null;
      const radius = 8;

      return { x, y, w, h, speed, baseOpacity, rotation, img, radius };
    }

    function spawnParticles() {
      particles.length = 0;
      for (let i = 0; i < NUM_FLOATING_CARDS; i++) {
        particles.push(createParticle(true));
      }
    }

    function drawRoundedRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.lineTo(x + w, y + h - r);
      ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
      ctx.lineTo(x + r, y + h);
      ctx.arcTo(x, y + h, x, y + h - r, r);
      ctx.lineTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
      ctx.closePath();
    }

    function render() {
      ctx.clearRect(0, 0, width, height);

      // If user uploaded a custom background image in settings, do not paint
      const customBg = document.body.style.backgroundImage;
      if (customBg && customBg !== "none" && customBg !== 'url("")') {
        requestAnimationFrame(render);
        return;
      }

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Constant speed falling
        p.y += p.speed;

        // Loop seamlessly when completely off-screen
        if (p.y > height + 20) {
          const newP = createParticle(false);
          particles[i] = newP;
          continue;
        }

        // Draw particle
        ctx.save();
        ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = p.baseOpacity;

        const rx = -p.w / 2;
        const ry = -p.h / 2;

        if (p.img && p.img.complete && p.img.naturalWidth > 0) {
          // Draw clipped card
          drawRoundedRect(ctx, rx, ry, p.w, p.h, p.radius);
          ctx.save();
          ctx.clip();
          ctx.drawImage(p.img, rx, ry, p.w, p.h);
          ctx.restore();

          // Subtle cyan / purple border glow outline
          ctx.strokeStyle = "rgba(0, 238, 252, 0.4)";
          ctx.lineWidth = 1.2;
          drawRoundedRect(ctx, rx, ry, p.w, p.h, p.radius);
          ctx.stroke();
        } else {
          // Fallback sleek geometric card placeholder while loading
          ctx.fillStyle = "rgba(157, 78, 221, 0.12)";
          drawRoundedRect(ctx, rx, ry, p.w, p.h, p.radius);
          ctx.fill();
          ctx.strokeStyle = "rgba(0, 238, 252, 0.25)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        ctx.restore();
      }

      requestAnimationFrame(render);
    }

    // Fetch random card images from Supabase
    async function loadRandomCards() {
      const supabaseUrl = window.SUPABASE_URL;
      const supabaseKey = window.SUPABASE_KEY;
      if (!supabaseUrl || !supabaseKey) return;

      try {
        // First get list of all card IDs with images
        const idRes = await fetch(`${supabaseUrl}/rest/v1/cards?select=id&image_data_url=not.is.null`, {
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
        });
        if (!idRes.ok) return;
        const idList = await idRes.json();
        if (!Array.isArray(idList) || idList.length === 0) return;

        // Shuffle and pick 18 random cards
        const randomIds = idList
          .sort(() => 0.5 - Math.random())
          .slice(0, 18)
          .map(c => c.id);

        if (randomIds.length === 0) return;

        // Fetch the image data for the selected sample
        const cardsRes = await fetch(`${supabaseUrl}/rest/v1/cards?select=id,image_data_url&id=in.(${randomIds.join(",")})`, {
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
        });
        if (!cardsRes.ok) return;
        const cardsData = await cardsRes.json();

        // Preload images into Image objects
        cardsData.forEach(c => {
          if (!c.image_data_url) return;
          const img = new Image();
          img.onload = () => {
            loadedImages.push(img);
            // Assign to any particle that doesn't have an image yet
            particles.forEach(p => {
              if (!p.img) {
                p.img = loadedImages[Math.floor(Math.random() * loadedImages.length)];
              }
            });
          };
          img.src = c.image_data_url;
        });
      } catch (err) {
        console.warn("Ambient background card images fetch error:", err);
      }
    }

    spawnParticles();
    render();
    loadRandomCards();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAmbientBackground);
  } else {
    initAmbientBackground();
  }
})();
