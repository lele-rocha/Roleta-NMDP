(function () {
  "use strict";

  // Painel lateral global de usuários: disponível em todas as abas do site.
  const SESSION_KEY = "roleta-nmdp-session";
  const OPEN_KEY = "roleta-nmdp-users-panel-open";
  const GALLERY_KEY = "roleta-nmdp-panel-gallery";
  const DEFAULT_GALLERY = { owner: "lele", slug: "games", name: "Games" };

  if (!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_KEY) return;
  const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  let users = []; // { name, votedCardIds }
  let loading = true;

  function getSession() {
    try {
      return (localStorage.getItem(SESSION_KEY) || "").trim();
    } catch (e) {
      return "";
    }
  }

  function getGallery() {
    try {
      const parsed = JSON.parse(localStorage.getItem(GALLERY_KEY) || "null");
      if (parsed && parsed.owner && parsed.slug) return parsed;
    } catch (e) {}
    return DEFAULT_GALLERY;
  }

  function isOpenSaved() {
    try {
      const saved = localStorage.getItem(OPEN_KEY);
      if (saved === null) return window.innerWidth > 1100;
      return saved === "1";
    } catch (e) {
      return false;
    }
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function cardBelongsToGallery(cardId, owner, slug) {
    const cid = cardId || "";
    const lowerOwner = (owner || "").toLowerCase();
    const lowerSlug = (slug || "").toLowerCase();
    if (lowerOwner === "lele") {
      if (lowerSlug === "games") return !cid.startsWith("anime_") && !cid.startsWith("filmes_") && !cid.startsWith("u_");
      if (lowerSlug === "anime") return cid.startsWith("anime_");
      if (lowerSlug === "filmes") return cid.startsWith("filmes_");
    }
    return cid.startsWith(`u_${lowerOwner}__${lowerSlug}_`);
  }

  // --- DOM ---
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.id = "users-panel-toggle";
  toggle.className = "users-panel-toggle";
  toggle.title = "Abrir painel de usuários";

  const panel = document.createElement("aside");
  panel.id = "users-panel";
  panel.className = "users-panel";
  panel.setAttribute("aria-label", "Usuários cadastrados");
  panel.innerHTML = `
    <div class="users-panel__header">
      <div class="users-panel__header-top">
        <div class="users-panel__active">
          <span class="users-panel__active-label">Usuário ativo</span>
          <strong id="users-panel-active-name" class="users-panel__active-name"></strong>
        </div>
        <button type="button" id="users-panel-close" class="users-panel__close" title="Fechar painel">✕</button>
      </div>
      <div id="users-panel-session"></div>
    </div>
    <div class="users-panel__title">
      <span>👥 Usuários Cadastrados</span>
      <span id="users-panel-count" class="users-panel__count"></span>
    </div>
    <div id="users-panel-list" class="users-panel__list"></div>
  `;

  const activeNameEl = panel.querySelector("#users-panel-active-name");
  const sessionEl = panel.querySelector("#users-panel-session");
  const listEl = panel.querySelector("#users-panel-list");
  const countEl = panel.querySelector("#users-panel-count");

  function setOpen(open) {
    panel.classList.toggle("open", open);
    toggle.classList.toggle("hidden", open);
    try {
      localStorage.setItem(OPEN_KEY, open ? "1" : "0");
    } catch (e) {}
  }

  toggle.addEventListener("click", () => setOpen(true));
  panel.querySelector("#users-panel-close").addEventListener("click", () => setOpen(false));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && panel.classList.contains("open")) setOpen(false);
  });

  // --- Session header ---
  function renderHeader() {
    const current = getSession();
    activeNameEl.textContent = current || "Nenhum";
    toggle.innerHTML = `<span class="users-panel-toggle__icon">👥</span><span class="users-panel-toggle__name">${current ? escapeHtml(current) : "Usuários"}</span>`;

    sessionEl.innerHTML = "";
    if (current) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-secondary-sm users-panel__switch";
      btn.textContent = "Sair / Trocar de Usuário";
      btn.addEventListener("click", () => {
        try {
          localStorage.removeItem(SESSION_KEY);
        } catch (e) {}
        window.location.reload();
      });
      sessionEl.appendChild(btn);
    } else {
      const form = document.createElement("div");
      form.className = "users-panel__login";
      form.innerHTML = `
        <input type="text" class="input-text-sm" id="users-panel-login-input" placeholder="Digite seu nome" maxlength="40" />
        <button type="button" class="btn-primary-sm" id="users-panel-login-btn">Entrar</button>
      `;
      const input = form.querySelector("input");
      const btn = form.querySelector("button");
      const doLogin = async () => {
        const name = input.value.trim();
        if (!name) {
          input.focus();
          return;
        }
        btn.disabled = true;
        try {
          const exists = users.some(u => u.name.toLowerCase() === name.toLowerCase());
          if (!exists) {
            await sb.from("users").upsert({ name, voted_card_ids: [] });
          }
          const canonical = (users.find(u => u.name.toLowerCase() === name.toLowerCase()) || { name }).name;
          localStorage.setItem(SESSION_KEY, canonical);
        } catch (e) {
          console.warn("Erro ao entrar pelo painel de usuários:", e);
          try {
            localStorage.setItem(SESSION_KEY, name);
          } catch (err) {}
        }
        window.location.reload();
      };
      btn.addEventListener("click", doLogin);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") doLogin();
      });
      sessionEl.appendChild(form);
    }
  }

  // --- Users list ---
  async function deleteUser(user) {
    const confirmDelete = confirm(`Tem certeza que deseja excluir o usuário ${user.name} e todos os seus votos permanentemente?`);
    if (!confirmDelete) return;
    try {
      for (const cardId of user.votedCardIds) {
        const { data } = await sb.from("cards").select("votes").eq("id", cardId).maybeSingle();
        if (data && data.votes > 0) {
          await sb.from("cards").update({ votes: data.votes - 1 }).eq("id", cardId);
        }
      }
      await sb.from("users").delete().eq("name", user.name);
      await loadUsers();
    } catch (err) {
      console.error("Erro ao excluir usuário pelo admin:", err);
      alert("Não foi possível excluir o usuário.");
    }
  }

  function renderUsers() {
    listEl.innerHTML = "";
    countEl.textContent = users.length ? `(${users.length})` : "";

    if (loading) {
      listEl.innerHTML = `<p class="users-panel__empty">Carregando usuários...</p>`;
      return;
    }
    if (users.length === 0) {
      listEl.innerHTML = `<p class="users-panel__empty">Nenhum usuário cadastrado ainda.</p>`;
      return;
    }

    const current = getSession().toLowerCase();
    const isAdmin = current === "lele";
    const gallery = getGallery();

    [...users].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).forEach(user => {
      const galleryVotes = user.votedCardIds.filter(id => cardBelongsToGallery(id, gallery.owner, gallery.slug)).length;
      const card = document.createElement("div");
      card.className = "user-status-card";
      if (current && user.name.toLowerCase() === current) card.classList.add("active-user-highlight");

      const canDelete = isAdmin && user.name.toLowerCase() !== "lele";
      card.innerHTML = `
        ${canDelete ? `<button type="button" class="btn-delete-user" title="Excluir usuário e todos os seus votos">🗑️</button>` : ""}
        <span class="user-status-card__name">${escapeHtml(user.name)}</span>
        <span class="user-status-card__votes">
          Nesta galeria (${escapeHtml(gallery.name || gallery.slug)}): <strong>${galleryVotes}</strong>/20 | Total: <strong>${user.votedCardIds.length}</strong> ${user.votedCardIds.length === 1 ? "voto" : "votos"}
        </span>
      `;
      if (canDelete) {
        card.querySelector(".btn-delete-user").addEventListener("click", (e) => {
          e.stopPropagation();
          deleteUser(user);
        });
      }
      listEl.appendChild(card);
    });
  }

  async function loadUsers() {
    try {
      const { data, error } = await sb.from("users").select("name, voted_card_ids");
      if (error) throw error;
      users = (data || [])
        .filter(u => u.name && !u.name.startsWith("__gallery_def__"))
        .map(u => ({ name: u.name, votedCardIds: u.voted_card_ids || [] }));
    } catch (e) {
      console.warn("Erro ao carregar usuários no painel:", e);
      users = [];
    }
    loading = false;
    renderUsers();
  }

  // --- Sync with the rest of the site ---
  window.addEventListener("roleta:gallery", () => renderUsers());
  window.addEventListener("storage", (e) => {
    if (e.key === GALLERY_KEY) renderUsers();
    if (e.key === SESSION_KEY) {
      renderHeader();
      renderUsers();
    }
  });

  let refreshTimer = null;
  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(loadUsers, 400);
  }

  function init() {
    document.body.appendChild(toggle);
    document.body.appendChild(panel);
    setOpen(isOpenSaved());
    renderHeader();
    renderUsers();
    loadUsers();
    try {
      sb.channel("users-panel-changes")
        .on("postgres_changes", { event: "*", schema: "public", table: "users" }, scheduleRefresh)
        .subscribe();
    } catch (e) {
      console.warn("Realtime indisponível no painel de usuários:", e);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
