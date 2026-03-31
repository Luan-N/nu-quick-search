document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEY = "novel-search-popup-state";
  const PENDING_QUERY_KEY = "pendingSelectedQuery";
  const STATUS_BASE_CLASSES =
    "flex min-h-24 items-center justify-center rounded-[14px] border px-4 py-4 text-center text-xs leading-5";
  const STATUS_TONE_CLASSES = {
    neutral:
      "border-[#bfd0e7] bg-[#f4f8fd] text-[#64748a]",
    empty:
      "border-[#bfd0e7] bg-[#f4f8fd] text-[#64748a]",
    loading: "border-[#c9d7ea] bg-[#e7effa] text-[#5a82b3]",
    error: "border-[#f0d6da] bg-[#fff7f8] text-[#a53844]",
  };
  const CARD_CLASSES =
    "grid grid-cols-[72px_minmax(0,1fr)] items-start gap-3 rounded-[14px] border border-[#c3d2e6] bg-[#f8fbff] p-3 text-inherit no-underline transition-[border-color,box-shadow] hover:border-[rgba(92,134,182,0.34)] focus-visible:shadow-[0_0_0_3px_rgba(92,134,182,0.14)]";
  const CONTENT_CLASSES = "flex min-w-0 flex-col gap-2 pt-0.5";
  const TITLE_CLASSES =
    "overflow-hidden text-[15px] leading-[1.35] font-bold text-[#1d2a3f] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]";
  const META_STACK_CLASSES = "flex flex-col gap-2";
  const DETAIL_CLASSES = "text-xs leading-[1.45] text-[#64748a]";
  const PILL_CLASSES =
    "self-start rounded-full bg-[#e7effa] px-[9px] py-[5px] text-[11px] font-bold text-[#5a82b3]";
  const COVER_CLASSES =
    "h-[98px] w-[72px] rounded-xl object-cover bg-[#d7e5f6]";
  const COVER_FALLBACK_CLASSES =
    "flex h-[98px] w-[72px] items-center justify-center rounded-xl bg-[#6f94c0] text-[28px] font-extrabold text-white";
  const searchForm = document.getElementById("search-form");
  const searchInput = document.getElementById("search-input");
  const searchBtn = document.getElementById("search-btn");
  const fullListBtn = document.getElementById("full-list-btn");
  const resultsMeta = document.getElementById("results-meta");
  const resultsDiv = document.getElementById("results");
  let popupState = loadState();

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");

      return {
        query: typeof parsed.query === "string" ? parsed.query : "",
        lastSearchedQuery:
          typeof parsed.lastSearchedQuery === "string"
            ? parsed.lastSearchedQuery
            : "",
        meta: typeof parsed.meta === "string" ? parsed.meta : "",
        items: Array.isArray(parsed.items) ? parsed.items : [],
        status:
          parsed.status &&
          typeof parsed.status.message === "string" &&
          typeof parsed.status.tone === "string"
            ? parsed.status
            : null,
      };
    } catch (error) {
      console.error("Failed to load popup state:", error);

      return {
        query: "",
        lastSearchedQuery: "",
        meta: "",
        items: [],
        status: null,
      };
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(popupState));
  }

  async function consumePendingQuery() {
    if (!chrome.storage?.local) {
      return "";
    }

    const stored = await chrome.storage.local.get(PENDING_QUERY_KEY);
    const query =
      typeof stored[PENDING_QUERY_KEY] === "string"
        ? stored[PENDING_QUERY_KEY].trim()
        : "";

    if (query) {
      await chrome.storage.local.remove(PENDING_QUERY_KEY);
    }

    return query;
  }

  function normalizeString(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function normalizeItems(items) {
    if (!Array.isArray(items)) {
      return [];
    }

    return items.map((item) => ({
      title: normalizeString(item?.title),
      url: normalizeString(item?.url),
      cover_url: normalizeString(item?.cover_url),
      last_updated: normalizeString(item?.last_updated),
      chapters: normalizeString(item?.chapters),
    }));
  }

  function buildFullListUrl(query) {
    return `https://www.novelupdates.com/series-finder/?sf=1&sh=${encodeURIComponent(
      query
    )}&sort=sdate&order=desc`;
  }

  function getActiveQuery() {
    return (
      searchInput.value.trim() ||
      popupState.lastSearchedQuery ||
      popupState.query ||
      ""
    );
  }

  function updateFullListButton() {
    const query = getActiveQuery();
    fullListBtn.classList.toggle("hidden", !query);
    fullListBtn.disabled = !query;
  }

  function setMeta(label = "") {
    resultsMeta.hidden = !label;
    resultsMeta.textContent = label;
    popupState.meta = label;
    saveState();
  }

  function setStatus(message, tone = "neutral") {
    resultsDiv.innerHTML = "";

    const state = document.createElement("div");
    state.className = `${STATUS_BASE_CLASSES} ${
      STATUS_TONE_CLASSES[tone] || STATUS_TONE_CLASSES.neutral
    }`;
    state.textContent = message;
    resultsDiv.appendChild(state);

    popupState.items = [];
    popupState.status = { message, tone };
    saveState();
  }

  function createCover(title, coverUrl) {
    const fallback = document.createElement("div");
    fallback.className = COVER_FALLBACK_CLASSES;
    fallback.textContent = (title.trim().charAt(0) || "?").toUpperCase();

    if (!coverUrl) {
      return fallback;
    }

    const img = document.createElement("img");
    img.className = COVER_CLASSES;
    img.src = coverUrl;
    img.alt = `${title} cover`;
    img.addEventListener("error", () => img.replaceWith(fallback), {
      once: true,
    });

    return img;
  }

  function showResults(items) {
    resultsDiv.innerHTML = "";

    if (!items.length) {
      setMeta("0 results");
      setStatus("No results.", "empty");
      return;
    }

    popupState.items = items;
    popupState.status = null;
    setMeta(`${items.length} result${items.length === 1 ? "" : "s"}`);

    items.forEach((item) => {
      const el = document.createElement(item.url ? "a" : "article");
      el.className = CARD_CLASSES;

      if (item.url) {
        el.href = item.url;
        el.target = "_blank";
        el.rel = "noreferrer";
      }

      const content = document.createElement("div");
      content.className = CONTENT_CLASSES;

      const title = document.createElement("div");
      title.className = TITLE_CLASSES;
      title.textContent = item.title || "Untitled";

      const meta = document.createElement("div");
      meta.className = META_STACK_CLASSES;

      const updated = document.createElement("div");
      updated.className = DETAIL_CLASSES;
      updated.textContent = item.last_updated
        ? `Updated: ${item.last_updated}`
        : "Updated: -";

      meta.appendChild(updated);

      if (item.chapters) {
        const chapters = document.createElement("div");
        chapters.className = PILL_CLASSES;
        chapters.textContent = item.chapters;
        meta.appendChild(chapters);
      }

      content.appendChild(title);
      content.appendChild(meta);

      el.appendChild(createCover(item.title || "", item.cover_url));
      el.appendChild(content);

      resultsDiv.appendChild(el);
    });

    saveState();
  }

  async function runSearch(query) {
    searchBtn.disabled = true;
    searchBtn.textContent = "...";
    popupState.query = query;
    popupState.lastSearchedQuery = query;
    saveState();
    setMeta("Searching...");
    setStatus("Searching...", "loading");

    try {
      const response = await fetch("https://novelshaven.com/api/nu-search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const data = await response.json();
      const results = normalizeItems(data?.items);
      showResults(results);
    } catch (error) {
      console.error("Search failed:", error);
      setMeta("");
      setStatus("Search failed.", "error");
    } finally {
      searchBtn.disabled = false;
      searchBtn.textContent = "Search";
    }
  }

  async function handleSearch(event) {
    event.preventDefault();

    const query = searchInput.value.trim();
    if (!query) {
      searchInput.focus();
      return;
    }

    await runSearch(query);
  }

  function restoreState() {
    if (popupState.query) {
      searchInput.value = popupState.query;
    }

    if (popupState.items.length) {
      showResults(popupState.items);
      return;
    }

    if (popupState.status?.tone === "loading" && popupState.lastSearchedQuery) {
      runSearch(popupState.lastSearchedQuery);
      return;
    }

    if (popupState.status?.message) {
      setMeta(popupState.meta);
      setStatus(popupState.status.message, popupState.status.tone);
      return;
    }

    if (popupState.meta) {
      setMeta(popupState.meta);
    }
  }

  async function initializePopup() {
    const pendingQuery = await consumePendingQuery();

    if (pendingQuery) {
      searchInput.value = pendingQuery;
      popupState.query = pendingQuery;
      popupState.lastSearchedQuery = pendingQuery;
      saveState();
      await runSearch(pendingQuery);
      return;
    }

    restoreState();
  }

  searchInput.addEventListener("input", () => {
    popupState.query = searchInput.value;
    saveState();
    updateFullListButton();
  });

  searchForm.addEventListener("submit", handleSearch);
  fullListBtn.addEventListener("click", async () => {
    const query = getActiveQuery();
    if (!query) {
      return;
    }

    const url = buildFullListUrl(query);

    if (chrome.tabs?.create) {
      await chrome.tabs.create({
        url,
      });
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  });

  initializePopup().finally(updateFullListButton);
});
