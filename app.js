
const API_URL = "https://script.google.com/macros/s/AKfycbxAjXSD-xmSkk3D1s0gqzAEm4EvIIa_jUSdWVDdDaulw2WYKeiRZhO2_D02lxLyz_6h4Q/exec";
const PERSON_KEY = "granburyPlannerPerson";
let tripData = null;
let currentPerson = localStorage.getItem(PERSON_KEY) || "";
let currentActivityCategory = "All";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function money(value) {
  const amount = Number(value) || 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(amount);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function apiField(record, name, fallback = "") {
  const value = record?.[name];
  if (value && typeof value === "object" && "display" in value) {
    return value.display;
  }
  return value ?? fallback;
}

function apiNumber(record, name) {
  const value = record?.[name];
  return Number(value) || 0;
}

function apiBoolean(record, name) {
  return record?.[name] === true;
}

async function loadTripData(showBusy = true) {
  setApiStatus(showBusy ? "Loading shared trip data…" : "", "loading");
  const response = await fetch(`${API_URL}?action=all&cache=${Date.now()}`, {
    method: "GET",
    cache: "no-store",
    redirect: "follow"
  });

  if (!response.ok) {
    throw new Error(`The trip database returned ${response.status}.`);
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || "The trip database could not be loaded.");
  }

  tripData = data;
  setApiStatus("Shared planner connected", "success");
  return data;
}

async function postAction(payload) {
  setApiStatus("Saving…", "loading");

  const body = new URLSearchParams();
  Object.entries(payload).forEach(([key, value]) => {
    body.append(key, value ?? "");
  });

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
    },
    body,
    redirect: "follow"
  });

  if (!response.ok) {
    throw new Error(`The update returned ${response.status}.`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || "The update could not be saved.");
  }

  await loadTripData(false);
  renderCurrentPage();
  setApiStatus("Saved to the shared planner", "success");
  return result;
}

function setApiStatus(message, state = "") {
  let status = $("#api-status");
  if (!status) {
    status = document.createElement("div");
    status.id = "api-status";
    status.className = "api-status";
    document.body.appendChild(status);
  }

  status.textContent = message;
  status.dataset.state = state;
  status.hidden = !message;

  if (state === "success") {
    window.clearTimeout(setApiStatus.timer);
    setApiStatus.timer = window.setTimeout(() => {
      status.hidden = true;
    }, 2200);
  }
}

function showError(error) {
  console.error(error);
  setApiStatus(error.message || String(error), "error");
}

function ensurePerson() {
  if (currentPerson) {
    updatePersonBadges();
    return Promise.resolve(currentPerson);
  }

  return new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.className = "person-modal";
    modal.innerHTML = `
      <div class="person-dialog" role="dialog" aria-modal="true" aria-labelledby="person-title">
        <span class="section-kicker">Shared trip planner</span>
        <h2 id="person-title">Who is planning right now?</h2>
        <p>Your choice tells the site which vote and packing column to update.</p>
        <div class="person-options">
          <button type="button" class="person-choice" data-person="Shelley">🌿 Shelley</button>
          <button type="button" class="person-choice" data-person="Kristi">🌸 Kristi</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    $$(".person-choice", modal).forEach((button) => {
      button.addEventListener("click", () => {
        currentPerson = button.dataset.person;
        localStorage.setItem(PERSON_KEY, currentPerson);
        modal.remove();
        updatePersonBadges();
        resolve(currentPerson);
      });
    });
  });
}

function addPersonControl() {
  const nav = $(".nav");
  if (!nav || $("#person-control")) return;

  const control = document.createElement("button");
  control.id = "person-control";
  control.className = "person-control";
  control.type = "button";
  control.addEventListener("click", async () => {
    localStorage.removeItem(PERSON_KEY);
    currentPerson = "";
    await ensurePerson();
    renderCurrentPage();
  });
  nav.appendChild(control);
  updatePersonBadges();
}

function updatePersonBadges() {
  const control = $("#person-control");
  if (control) {
    control.textContent = currentPerson ? `Planning as ${currentPerson}` : "Choose planner";
  }
}

function setupMobileMenu() {
  const button = $("#menu-toggle");
  const nav = $("#nav-links");
  if (!button || !nav) return;
  button.addEventListener("click", () => nav.classList.toggle("open"));
}

function setupCountdown() {
  const element = $("#countdown");
  if (!element) return;

  // 9:00 AM Central Standard Time on November 13, 2026 = 15:00 UTC.
  const target = Date.UTC(2026, 10, 13, 15, 0, 0);

  function update() {
    const difference = Math.max(0, target - Date.now());
    const days = Math.floor(difference / 86400000);
    const hours = Math.floor(difference / 3600000) % 24;
    const minutes = Math.floor(difference / 60000) % 60;
    const seconds = Math.floor(difference / 1000) % 60;

    element.innerHTML = `
      <div><strong>${days}</strong>Days</div>
      <div><strong>${hours}</strong>Hours</div>
      <div><strong>${minutes}</strong>Minutes</div>
      <div><strong>${seconds}</strong>Seconds</div>
    `;
  }

  update();
  window.setInterval(update, 1000);
}

function getVote(itemId) {
  return tripData?.votes?.find((vote) =>
    String(apiField(vote, "Item ID")).trim() === String(itemId).trim()
  ) || null;
}

function personVote(vote, person) {
  return apiBoolean(vote, `${person} Vote`);
}

function voteSummaryHtml(itemId) {
  const vote = getVote(itemId);
  const shelley = personVote(vote, "Shelley");
  const kristi = personVote(vote, "Kristi");

  return `
    <div class="vote-summary">
      <span class="${shelley ? "yes" : ""}">🌿 Shelley ${shelley ? "♥" : "♡"}</span>
      <span class="${kristi ? "yes" : ""}">🌸 Kristi ${kristi ? "♥" : "♡"}</span>
      ${shelley && kristi ? '<strong class="both-pick">Both picked it!</strong>' : ""}
    </div>
  `;
}

async function toggleVote(itemId, selected) {
  await ensurePerson();
  return postAction({
    action: "updateVote",
    itemId,
    person: currentPerson,
    selected
  });
}

function itineraryControls(item, type) {
  const itemId = apiField(item, "ID");
  const name = apiField(item, "Name");
  const estimatedCost =
    type === "Activity"
      ? apiNumber(item, "Price")
      : apiNumber(item, "Estimated Cost");

  return `
    <div class="itinerary-add">
      <label>
        Add to:
        <select data-day>
          <option value="Friday">Friday</option>
          <option value="Saturday">Saturday</option>
          <option value="Sunday">Sunday</option>
        </select>
      </label>
      <button type="button" class="btn mini" data-add-itinerary
        data-item-id="${escapeHtml(itemId)}"
        data-item-name="${escapeHtml(name)}"
        data-item-type="${escapeHtml(type)}"
        data-cost="${estimatedCost}">
        Add to itinerary
      </button>
    </div>
  `;
}

function bindSharedCardActions(root = document) {
  $$("[data-vote-toggle]", root).forEach((checkbox) => {
    checkbox.addEventListener("change", async () => {
      checkbox.disabled = true;
      try {
        await toggleVote(checkbox.dataset.itemId, checkbox.checked);
      } catch (error) {
        checkbox.checked = !checkbox.checked;
        showError(error);
      } finally {
        checkbox.disabled = false;
      }
    });
  });

  $$("[data-add-itinerary]", root).forEach((button) => {
    button.addEventListener("click", async () => {
      const wrapper = button.closest(".itinerary-add");
      const day = $("[data-day]", wrapper).value;
      button.disabled = true;

      try {
        await postAction({
          action: "addItineraryItem",
          day,
          itemId: button.dataset.itemId,
          itemType: button.dataset.itemType,
          itemName: button.dataset.itemName,
          estimatedCost: button.dataset.cost,
          startTime: "",
          endTime: "",
          notes: `Added by ${currentPerson || "trip planner"}`
        });
      } catch (error) {
        showError(error);
      } finally {
        button.disabled = false;
      }
    });
  });
}

function renderHome() {
  const count = $("#home-choice-count");
  const total = $("#home-trip-total");

  if (count) {
    const agreed = tripData.votes.filter((vote) =>
      personVote(vote, "Shelley") && personVote(vote, "Kristi")
    );
    count.textContent = agreed.length;
  }

  if (total) {
    total.textContent = money(tripData.summary?.estimatedTripCost || 0);
  }

  const label = $(".stat-label");
  const chosen = $("#home-choice-count")?.closest(".stat-box")?.querySelector(".stat-label");
  if (chosen) chosen.textContent = "Choices you both selected";
}

function renderActivities() {
  const list = $("#activity-list");
  const toolbar = $("#category-toolbar");
  if (!list || !toolbar) return;

  const activeItems = tripData.activities.filter((item) => apiBoolean(item, "Active"));
  const categories = ["All", ...new Set(activeItems.map((item) => apiField(item, "Category")))];

  toolbar.innerHTML = categories.map((category) => `
    <button type="button" class="${category === currentActivityCategory ? "active" : ""}"
      data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>
  `).join("");

  $$("[data-category]", toolbar).forEach((button) => {
    button.addEventListener("click", () => {
      currentActivityCategory = button.dataset.category;
      renderActivities();
    });
  });

  const filtered = activeItems.filter((item) =>
    currentActivityCategory === "All" ||
    apiField(item, "Category") === currentActivityCategory
  );

  list.innerHTML = filtered.map((item) => {
    const id = apiField(item, "ID");
    const vote = getVote(id);
    const selected = personVote(vote, currentPerson);

    return `
      <article class="card">
        <div class="card-body">
          <span class="badge">${escapeHtml(apiField(item, "Category"))}</span>
          <h3>${escapeHtml(apiField(item, "Name"))}</h3>
          <p class="price">${escapeHtml(apiField(item, "Price Display"))}</p>
          <p>${escapeHtml(apiField(item, "Description"))}</p>
          <p class="muted"><strong>Date:</strong> ${escapeHtml(apiField(item, "Date") || "Flexible")}</p>
          <p class="muted"><strong>Time:</strong> ${escapeHtml(apiField(item, "Time") || "Flexible")}</p>
          <p class="card-note">${escapeHtml(apiField(item, "Notes"))}</p>
          ${voteSummaryHtml(id)}
          <label class="shared-vote">
            <input type="checkbox" data-vote-toggle data-item-id="${escapeHtml(id)}" ${selected ? "checked" : ""}>
            <span>${escapeHtml(currentPerson)} wants to do this</span>
          </label>
          ${itineraryControls(item, "Activity")}
          <div class="card-actions">
            <a class="btn secondary" href="${escapeHtml(apiField(item, "Website"))}" target="_blank" rel="noopener">Official site</a>
            <a class="btn secondary" href="${escapeHtml(apiField(item, "Map Link"))}" target="_blank" rel="noopener">Directions</a>
          </div>
        </div>
      </article>
    `;
  }).join("");

  const count = $("#choice-count");
  if (count) {
    count.textContent = tripData.votes.filter((vote) =>
      personVote(vote, "Shelley") && personVote(vote, "Kristi")
    ).length;
  }

  const total = $("#trip-total");
  if (total) total.textContent = money(tripData.summary?.estimatedTripCost || 0);

  bindSharedCardActions(list);
}

function renderRestaurants() {
  const list = $("#restaurant-list");
  if (!list) return;

  list.innerHTML = tripData.restaurants
    .filter((item) => apiBoolean(item, "Active"))
    .map((item) => {
      const id = apiField(item, "ID");
      const vote = getVote(id);
      const selected = personVote(vote, currentPerson);

      return `
        <article class="card">
          <div class="card-body">
            <span class="badge">Dining</span>
            <h3>${escapeHtml(apiField(item, "Name"))}</h3>
            <p class="price">${escapeHtml(apiField(item, "Price Display"))}</p>
            <p>${escapeHtml(apiField(item, "Description"))}</p>
            <p class="card-note">${escapeHtml(apiField(item, "Notes"))}</p>
            ${voteSummaryHtml(id)}
            <label class="shared-vote">
              <input type="checkbox" data-vote-toggle data-item-id="${escapeHtml(id)}" ${selected ? "checked" : ""}>
              <span>${escapeHtml(currentPerson)} wants to eat here</span>
            </label>
            ${itineraryControls(item, "Restaurant")}
            <div class="card-actions">
              <a class="btn secondary" href="${escapeHtml(apiField(item, "Website"))}" target="_blank" rel="noopener">Menu / website</a>
              <a class="btn secondary" href="${escapeHtml(apiField(item, "Map Link"))}" target="_blank" rel="noopener">Directions</a>
            </div>
          </div>
        </article>
      `;
    }).join("");

  bindSharedCardActions(list);
}

function renderLodging() {
  const list = $("#lodging-list");
  if (!list) return;

  list.innerHTML = tripData.lodging
    .filter((item) => apiBoolean(item, "Active"))
    .map((item) => {
      const id = apiField(item, "ID");
      const selected = apiBoolean(item, "Selected");

      return `
        <article class="card ${selected ? "selected-card" : ""}">
          <div class="card-body">
            ${selected ? '<span class="badge">Current selection</span>' : '<span class="badge">Lodging option</span>'}
            <h3>${escapeHtml(apiField(item, "Name"))}</h3>
            <p class="price">${money(apiNumber(item, "Cost Per Person"))} per person</p>
            <p>${escapeHtml(apiField(item, "Description"))}</p>
            <div class="pros-cons">
              <div><strong>Why choose it</strong><p>${escapeHtml(apiField(item, "Pros"))}</p></div>
              <div><strong>Keep in mind</strong><p>${escapeHtml(apiField(item, "Cons"))}</p></div>
            </div>
            ${voteSummaryHtml(id)}
            <button type="button" class="btn" data-select-lodging="${escapeHtml(id)}" ${selected ? "disabled" : ""}>
              ${selected ? "Selected" : "Choose this lodging"}
            </button>
            <div class="card-actions">
              <a class="btn secondary" href="${escapeHtml(apiField(item, "Website"))}" target="_blank" rel="noopener">View property</a>
              <a class="btn secondary" href="${escapeHtml(apiField(item, "Map Link"))}" target="_blank" rel="noopener">Map</a>
            </div>
          </div>
        </article>
      `;
    }).join("");

  $$("[data-select-lodging]", list).forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await postAction({
          action: "selectLodging",
          lodgingId: button.dataset.selectLodging
        });
      } catch (error) {
        showError(error);
        button.disabled = false;
      }
    });
  });

  const total = $("#trip-total");
  if (total) total.textContent = money(tripData.summary?.estimatedTripCost || 0);
}

function renderItinerary() {
  if (!$("#itinerary-builder")) return;

  ["Friday", "Saturday", "Sunday"].forEach((day) => {
    const list = $(`#${day.toLowerCase()}-list`);
    if (!list) return;

    const items = tripData.itinerary
      .filter((item) => apiBoolean(item, "Active") && apiField(item, "Day") === day)
      .sort((a, b) => apiNumber(a, "Order") - apiNumber(b, "Order"));

    list.innerHTML = items.length
      ? items.map((item) => `
          <li>
            <div>
              <strong>${escapeHtml(apiField(item, "Item Name"))}</strong>
              <small>${escapeHtml(apiField(item, "Start Time") || "Time not set")} · ${money(apiNumber(item, "Estimated Cost"))}</small>
            </div>
            <button type="button" class="btn secondary mini" data-remove-itinerary="${escapeHtml(apiField(item, "ID"))}">Remove</button>
          </li>
        `).join("")
      : '<li class="empty-state">Nothing scheduled yet.</li>';
  });

  $$("[data-remove-itinerary]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await postAction({
          action: "removeItineraryItem",
          itineraryId: button.dataset.removeItinerary
        });
      } catch (error) {
        showError(error);
        button.disabled = false;
      }
    });
  });

  const oldBuilderPanel = $("#itinerary-day")?.closest(".panel");
  if (oldBuilderPanel) {
    oldBuilderPanel.innerHTML = `
      <h2>Shared itinerary</h2>
      <p class="muted">Add items from the Activities and Eat &amp; Drink pages. Removing an item here updates the shared budget immediately.</p>
      <div class="summary-strip">
        <span><strong>${tripData.summary?.itineraryItems || 0}</strong> scheduled items</span>
        <span><strong>${money(tripData.summary?.itineraryEstimatedCost || 0)}</strong> activities &amp; dining</span>
        <span><strong>${money(tripData.summary?.estimatedTripCost || 0)}</strong> including lodging</span>
      </div>
    `;
  }
}

function renderPlanner() {
  const packing = $("#packing-list");
  const reservations = $("#reservation-list");
  if (!packing && !reservations) return;

  if (packing) {
    packing.innerHTML = tripData.packing.map((item) => {
      const checked = apiBoolean(item, `${currentPerson} Packed`);
      return `
        <label class="checklist-row">
          <input type="checkbox" data-packing-id="${escapeHtml(apiField(item, "ID"))}" ${checked ? "checked" : ""}>
          <span><strong>${escapeHtml(apiField(item, "Item"))}</strong><small>${escapeHtml(apiField(item, "Category"))}</small></span>
        </label>
      `;
    }).join("");

    $$("[data-packing-id]", packing).forEach((input) => {
      input.addEventListener("change", async () => {
        input.disabled = true;
        try {
          await postAction({
            action: "updatePacking",
            packingId: input.dataset.packingId,
            person: currentPerson,
            packed: input.checked
          });
        } catch (error) {
          input.checked = !input.checked;
          showError(error);
        } finally {
          input.disabled = false;
        }
      });
    });
  }

  if (reservations) {
    reservations.innerHTML = tripData.reservations.map((item) => {
      const checked = apiBoolean(item, "Reservation Made");
      return `
        <label class="checklist-row">
          <input type="checkbox" data-reservation-id="${escapeHtml(apiField(item, "ID"))}" ${checked ? "checked" : ""}>
          <span>
            <strong>${escapeHtml(apiField(item, "Item Name"))}</strong>
            <small>${escapeHtml(apiField(item, "Category"))}${checked ? " · Completed" : ""}</small>
          </span>
        </label>
      `;
    }).join("");

    $$("[data-reservation-id]", reservations).forEach((input) => {
      input.addEventListener("change", async () => {
        input.disabled = true;
        try {
          await postAction({
            action: "updateReservation",
            reservationId: input.dataset.reservationId,
            completed: input.checked
          });
        } catch (error) {
          input.checked = !input.checked;
          showError(error);
        } finally {
          input.disabled = false;
        }
      });
    });
  }

  const sharePanel = $(".share-panel");
  if (sharePanel) {
    sharePanel.innerHTML = `
      <h2>Shared automatically</h2>
      <p>This version saves votes, lodging, itinerary, packing and reservations directly to the Google Sheet. Shelley and Kristi see the same plan after refreshing.</p>
      <div class="summary-strip">
        <span><strong>${tripData.summary?.reservationsCompleted || 0}/${tripData.summary?.reservationsTotal || 0}</strong> reservations complete</span>
        <span><strong>${money(tripData.summary?.estimatedTripCost || 0)}</strong> current estimated cost</span>
      </div>
    `;
  }
}

function renderCurrentPage() {
  if (!tripData) return;
  renderHome();
  renderActivities();
  renderRestaurants();
  renderLodging();
  renderItinerary();
  renderPlanner();
  updatePersonBadges();
}

async function initializeApp() {
  setupMobileMenu();
  setupCountdown();
  await ensurePerson();
  addPersonControl();

  try {
    await loadTripData();
    renderCurrentPage();
  } catch (error) {
    showError(error);
  }
}

document.addEventListener("DOMContentLoaded", initializeApp);
