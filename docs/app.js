(() => {
  "use strict";

  const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  const $ = (id) => document.getElementById(id);
  const initData = tg ? tg.initData : "";
  const notice = $("notice");
  const API_BASE = String(window.NH_API_BASE || "").trim().replace(/\/+$/, "");

  if (tg) {
    tg.ready();
    tg.expand();
    try {
      tg.setHeaderColor("#100f18");
      tg.setBackgroundColor("#100f18");
    } catch (_) {
      // Older Telegram clients may not support every colour method.
    }
  }

  function showNotice(message, visible = true) {
    notice.textContent = message;
    notice.classList.toggle("visible", visible);
  }

  function setConnection(state, label) {
    const connection = $("connection");
    connection.classList.toggle("online", state === "online");
    connection.classList.toggle("offline", state === "offline");
    $("connection-label").textContent = label;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[character]));
  }

  function formatDate(timestamp) {
    if (!timestamp) return "дата неизвестна";
    const date = new Date(Number(timestamp) * 1000);
    return Number.isNaN(date.getTime())
      ? "дата неизвестна"
      : date.toLocaleString("ru-RU", {
          day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
        });
  }

  function formatNumber(value, maximumFractionDigits = 2) {
    const number = Number(value);
    return Number.isFinite(number)
      ? number.toLocaleString("ru-RU", { maximumFractionDigits })
      : "—";
  }

  function formatPercent(value) {
    if (value === null || value === undefined || value === "") return "";
    const number = Number(value);
    if (!Number.isFinite(number)) return "";
    const sign = number > 0 ? "+" : "";
    return `${sign}${formatNumber(number)}%`;
  }

  async function api(path) {
    if (!initData) {
      throw new Error("Открой NFT Hunter через меню Telegram-бота.");
    }
    if (!API_BASE) {
      throw new Error(
        "Сервер NFT Hunter пока не подключён к сайту. После размещения API на HTTPS укажем его адрес в docs/api-config.js."
      );
    }

    let response;
    try {
      response = await fetch(`${API_BASE}${path}`, {
        headers: {
          "Authorization": `tma ${initData}`,
          "Accept": "application/json"
        }
      });
    } catch (_) {
      throw new Error("Не удалось связаться с сервером NFT Hunter. Проверь адрес API и доступность сервера.");
    }

    const responseText = await response.text();
    let payload;
    try {
      payload = responseText ? JSON.parse(responseText) : {};
    } catch (_) {
      throw new Error("Сервер вернул не JSON. Проверь адрес API: Mini App не должен обращаться к GitHub Pages вместо backend.");
    }

    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || `Ошибка сервера: ${response.status}`);
    }
    return payload;
  }

  function offerCard(item) {
    const title = escapeHtml(item.gift_title || `Подарок ${item.gift_id ?? ""}`);
    const price = formatNumber(item.price_stars);
    const difference = formatPercent(item.difference_percent);
    const attributes = [
      item.model ? `Модель: ${item.model}` : null,
      item.backdrop ? `Фон: ${item.backdrop}` : null,
      item.symbol ? `Символ: ${item.symbol}` : null
    ].filter(Boolean).map((value) => `<span class="attribute">${escapeHtml(value)}</span>`).join("");

    return `<article class="offer-card">
      <div class="offer-top">
        <div>
          <h4 class="offer-title">${title}</h4>
          <div class="offer-id">ID подарка: ${escapeHtml(item.unique_id ?? item.gift_id ?? "—")}</div>
        </div>
        <div class="price-area">
          <div class="price">${price} <small>⭐</small></div>
          ${difference ? `<div class="difference-value">${escapeHtml(difference)} к ориентиру</div>` : ""}
        </div>
      </div>
      <div class="attributes">${attributes || '<span class="attribute">Характеристики не указаны</span>'}</div>
      <div class="meta-row"><span>Обновлено: ${formatDate(item.last_seen_at)}</span><span>${escapeHtml(item.currency || "STARS")}</span></div>
    </article>`;
  }

  function renderOffers(target, items, emptyText) {
    const container = $(target);
    container.innerHTML = items.length
      ? items.map(offerCard).join("")
      : `<div class="empty-state">${escapeHtml(emptyText)}</div>`;
  }

  function renderRows(target, items, kind) {
    const container = $(target);
    if (!items.length) {
      const labels = {
        history: "История пока пуста.",
        alerts: "Сохранённых сигналов пока нет.",
        collection: "Список наблюдения пока пуст."
      };
      container.innerHTML = `<div class="empty-state">${labels[kind]}</div>`;
      return;
    }

    container.innerHTML = items.map((item) => {
      if (kind === "history") {
        return `<article class="data-card">
          <div class="data-row">
            <div class="data-main">
              <div class="data-title">${escapeHtml(item.gift_title || `Подарок ${item.gift_id}`)}</div>
              <div class="data-sub">${formatDate(item.recorded_at)}</div>
            </div>
            <div class="data-value">${formatNumber(item.price_stars, 0)} ⭐</div>
          </div>
        </article>`;
      }

      if (kind === "alerts") {
        const level = String(item.level || "").toUpperCase();
        const levelName = { RED: "ВЫСОКИЙ", ORANGE: "СРЕДНИЙ", YELLOW: "НИЗКИЙ" }[level] || "СИГНАЛ";
        return `<article class="data-card">
          <div class="data-row">
            <div class="data-main">
              <div class="data-title">${escapeHtml(item.gift_title || "Подарок")}</div>
              <div class="data-sub">${formatDate(item.recorded_at)} · ориентир ${formatNumber(item.reference_price, 0)} ⭐</div>
            </div>
            <span class="level ${escapeHtml(level)}">${levelName}</span>
          </div>
          <div class="meta-row"><span>Цена предложения</span><strong>${formatNumber(item.price_stars, 0)} ⭐</strong></div>
        </article>`;
      }

      return `<article class="data-card">
        <div class="data-row">
          <div class="data-main">
            <div class="data-title">${escapeHtml(item.title || "Без названия")}</div>
            <div class="data-sub">Gift ID: ${escapeHtml(item.gift_id)}</div>
          </div>
          <div class="data-value">◈</div>
        </div>
      </article>`;
    }).join("");
  }

  async function loadDashboard() {
    const data = await api("/api/dashboard");
    const stats = data.stats || {};
    $("stat-offers").textContent = formatNumber(stats.offers || 0, 0);
    $("stat-history").textContent = formatNumber(stats.price_records || 0, 0);
    $("stat-alerts").textContent = formatNumber(stats.alerts || 0, 0);
    renderOffers("overview-offers", data.offers || [], "В базе пока нет объявлений. Они появятся после сканирования.");
    setConnection("online", "Сервер доступен");
    showNotice("Данные загружены из базы NFT Hunter.", false);
  }

  async function loadHistory() {
    const data = await api("/api/history?limit=40");
    renderRows("history-list", data.items || [], "history");
  }

  async function loadAlerts() {
    const data = await api("/api/alerts?limit=40");
    renderRows("alerts-list", data.items || [], "alerts");
  }

  async function loadCollection() {
    // This is the route exposed by the current NFT Hunter backend.
    const data = await api("/api/collection");
    renderRows("collection-list", data.items || [], "collection");
  }

  async function searchOffers() {
    const query = $("search-input").value.trim();
    if (!query) {
      $("search-results").innerHTML = '<div class="empty-state">Введи название, модель, фон или ID.</div>';
      return;
    }
    const data = await api(`/api/offers?q=${encodeURIComponent(query)}&limit=50`);
    renderOffers("search-results", data.items || [], "По этому запросу ничего не найдено.");
  }

  async function runSafely(action) {
    try {
      await action();
    } catch (error) {
      setConnection("offline", API_BASE ? "Нет соединения" : "API не подключён");
      showNotice(error.message || "Не удалось загрузить данные.");
    }
  }

  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab === button));
      document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === `view-${button.dataset.view}`));
      const loaders = { overview: loadDashboard, history: loadHistory, alerts: loadAlerts, collection: loadCollection };
      if (loaders[button.dataset.view]) runSafely(loaders[button.dataset.view]);
    });
  });

  $("refresh-button").addEventListener("click", () => runSafely(loadDashboard));

  let searchTimer = null;
  $("search-input").addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => runSafely(searchOffers), 300);
  });

  if (!initData) {
    setConnection("offline", "Ожидает Telegram");
    showNotice("Это предварительный просмотр. Для загрузки личных данных открой NFT Hunter через кнопку в Telegram-боте.");
  } else if (!API_BASE) {
    setConnection("offline", "API не подключён");
    showNotice("Mini App открыт в Telegram, но сервер API ещё не подключён. После размещения backend на HTTPS укажем его адрес в docs/api-config.js.");
  } else {
    runSafely(loadDashboard);
  }
})();
