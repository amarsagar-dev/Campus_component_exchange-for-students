// frontend/app.js
const API_URL = "http://localhost:5000";

let currentUser = null;

// DOM
const authSection = document.getElementById("authSection");
const marketplaceSection = document.getElementById("marketplaceSection");
const dashboardSection = document.getElementById("dashboardSection");

const fullname = document.getElementById("fullname");
const email = document.getElementById("email");
const password = document.getElementById("password");
const authTitle = document.getElementById("authTitle");
const authForm = document.getElementById("authForm");
const toggleAuth = document.getElementById("toggleAuth");
const authBtn = document.getElementById("authBtn");

const userName = document.getElementById("userName");
const logoutBtn = document.getElementById("logoutBtn");
const dashboardBtn = document.getElementById("dashboardBtn");
const closeDashboardBtn = document.getElementById("closeDashboardBtn");

const viewProductsBtn = document.getElementById("viewProductsBtn");
const addProductBtn = document.getElementById("addProductBtn");
const productContainer = document.getElementById("productContainer");
const addProductForm = document.getElementById("addProductForm");

const feedbackModal = document.getElementById("feedbackModal");
const feedbackProduct = document.getElementById("feedbackProduct");
const feedbackRating = document.getElementById("feedbackRating");
const feedbackComments = document.getElementById("feedbackComments");
const submitFeedbackBtn = document.getElementById("submitFeedbackBtn");
const cancelFeedbackBtn = document.getElementById("cancelFeedbackBtn");

const feedbackList = document.getElementById("feedbackList");

let isLogin = true;
let pendingListingForFeedback = null;

// Toggle signup/login
toggleAuth.addEventListener("click", () => {
  isLogin = !isLogin;
  fullname.classList.toggle("hidden", isLogin);
  authTitle.textContent = isLogin ? "Login" : "Sign Up";
  authBtn.textContent = isLogin ? "Login" : "Create Account";
  toggleAuth.innerHTML = isLogin ? 'Don’t have an account? <span>Sign Up</span>' : 'Already have an account? <span>Login</span>';
});

// Auth submit
authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const mail = email.value.trim();
  const pass = password.value.trim();
  const name = fullname.value.trim();

  if (!mail || !pass) return alert("Fill fields");

  if (!isLogin) {
    const res = await fetch(`${API_URL}/add-user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ FullName: name, Email: mail, PasswordHash: pass })
    });
    const data = await res.json();
    if (res.ok) { alert(data.message); toggleAuth.click(); }
    else alert(data.error || "Signup failed");
    return;
  }

  // login
  try {
    const res = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Email: mail, Password: pass })
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error || "Login failed");
    currentUser = data.user;
    email.value = ""; password.value = ""; fullname.value = "";
    showMarketplace();
  } catch (err) {
    console.error("login", err);
    alert("Server error");
  }
});

// show marketplace
function showMarketplace() {
  authSection.classList.add("hidden");
  dashboardSection.classList.add("hidden");
  marketplaceSection.classList.remove("hidden");
  userName.textContent = currentUser.FullName || "User";

  // show dashboard button (visible after login)
  dashboardBtn.style.display = "inline-block";

  loadProducts();
}

// logout
logoutBtn.addEventListener("click", () => {
  currentUser = null;
  marketplaceSection.classList.add("hidden");
  dashboardSection.classList.add("hidden");
  authSection.classList.remove("hidden");
  dashboardBtn.style.display = "none";
});

// tabs
viewProductsBtn.addEventListener("click", () => {
  addProductForm.classList.add("hidden");
  productContainer.classList.remove("hidden");
  viewProductsBtn.classList.add("active");
  addProductBtn.classList.remove("active");
  loadProducts();
});
addProductBtn.addEventListener("click", () => {
  productContainer.classList.add("hidden");
  addProductForm.classList.remove("hidden");
  addProductBtn.classList.add("active");
  viewProductsBtn.classList.remove("active");
});

// add listing
addProductForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return alert("Login to add listing");
  const title = document.getElementById("title").value.trim();
  const description = document.getElementById("description").value.trim();
  const price = Number(document.getElementById("price").value);
  const itemCondition = document.getElementById("itemCondition").value;

  if (!title || !price) return alert("Title and price required");

  const res = await fetch(`${API_URL}/add-listing`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sellerId: currentUser.UserId, title, description, price, itemCondition })
  });
  const data = await res.json();
  if (res.ok) { alert(data.message); addProductForm.reset(); viewProductsBtn.click(); }
  else alert(data.error || "Failed");
});

// load products
async function loadProducts() {
  productContainer.innerHTML = "<p>Loading...</p>";
  try {
    const res = await fetch(`${API_URL}/listings`);
    const items = await res.json();
    if (!items.length) { productContainer.innerHTML = "<p>No items available</p>"; return; }
    productContainer.innerHTML = "";
    items.forEach(it => {
      const card = document.createElement("div");
      card.className = "card";
      const title = it.Title || "Untitled";
      const desc = it.Description || "";
      const seller = it.SellerName || "Unknown";
      const price = it.Price || 0;

      // If logged-in user is the seller, do not show Buy button
      let actionHtml = "";
      if (currentUser && currentUser.UserId === it.SellerId) {
        actionHtml = `<span class="badge-own">Your listing</span>`;
      } else {
        actionHtml = `<button class="btn-primary" data-listing="${it.ListingId}" data-seller="${it.SellerId}">Buy Now</button>`;
      }

      card.innerHTML = `
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(desc)}</p>
        <p><strong>Seller:</strong> ${escapeHtml(seller)}</p>
        <p class="price">₹${price}</p>
        <div style="display:flex;gap:8px;margin-top:8px">${actionHtml}</div>
      `;
      productContainer.appendChild(card);
    });

    // attach buy handlers
    document.querySelectorAll('button[data-listing]').forEach(b => {
      b.addEventListener('click', async (e) => {
        const listingId = Number(b.getAttribute('data-listing'));
        const sellerId = Number(b.getAttribute('data-seller'));
        await buyItem(listingId, sellerId);
      });
    });

  } catch (err) {
    console.error("loadProducts", err);
    productContainer.innerHTML = "<p>Error loading</p>";
  }
}

// buy item
async function buyItem(listingId, sellerId) {
  if (!currentUser) return alert("Login to buy");
  if (sellerId === currentUser.UserId) return alert("You cannot buy your own listing.");

  const amount = await promptPriceConfirm();
  if (!amount) return;

  try {
    const res = await fetch(`${API_URL}/purchase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, buyerId: currentUser.UserId, amount, paymentMethod: "UPI" })
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error || "Purchase failed");
    alert(data.message || "Purchased");

    pendingListingForFeedback = { listingId, sellerId };
    openFeedbackModal(listingId);
    loadProducts();
  } catch (err) {
    console.error("buyItem", err);
    alert("Server error");
  }
}

// helper to ask buyer amount confirmation
function promptPriceConfirm() {
  return new Promise((resolve) => {
    const val = prompt("Enter amount to pay (confirm):");
    if (!val) return resolve(null);
    const num = Number(val);
    if (isNaN(num) || num <= 0) return resolve(null);
    resolve(num);
  });
}

// feedback modal
function openFeedbackModal(listingId) {
  feedbackProduct.textContent = `Listing ID: ${listingId}`;
  feedbackRating.value = "";
  feedbackComments.value = "";
  feedbackModal.classList.add("show");
}

// cancel feedback
cancelFeedbackBtn.addEventListener("click", () => {
  feedbackModal.classList.remove("show");
  pendingListingForFeedback = null;
});

// submit feedback
submitFeedbackBtn.addEventListener("click", async () => {
  if (!pendingListingForFeedback) return alert("No purchase to rate");
  const rating = Number(feedbackRating.value);
  if (!rating || rating < 1 || rating > 5) return alert("Enter rating 1-5");
  const comments = feedbackComments.value.trim();

  try {
    const res = await fetch(`${API_URL}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromUserId: currentUser.UserId,
        toUserId: pendingListingForFeedback.sellerId,
        listingId: pendingListingForFeedback.listingId,
        rating,
        comments
      })
    });
    const data = await res.json();
    if (!res.ok) alert(data.error || "Feedback failed");
    else alert(data.message || "Feedback saved");
  } catch (err) {
    console.error("submitFeedback", err);
    alert("Server error");
  } finally {
    feedbackModal.classList.remove("show");
    pendingListingForFeedback = null;
  }
});

// --- Dashboard logic ---
dashboardBtn.addEventListener("click", async () => {
  if (!currentUser) return alert("Login first");
  marketplaceSection.classList.add("hidden");
  dashboardSection.classList.remove("hidden");

  feedbackList.innerHTML = "<p>Loading feedback...</p>";
  try {
    const res = await fetch(`${API_URL}/feedback/seller/${currentUser.UserId}`);
    const rows = await res.json();
    if (!rows.length) { feedbackList.innerHTML = "<p>No feedback yet</p>"; return; }
    feedbackList.innerHTML = "";
    rows.forEach(r => {
      const div = document.createElement("div");
      div.className = "feedback-item";
      div.innerHTML = `
        <h4>${escapeHtml(r.ListingTitle || '—')}</h4>
        <p><strong>Buyer:</strong> ${escapeHtml(r.BuyerName || 'Anonymous')}</p>
        <p class="feedback-rating">⭐ ${r.Rating}/5</p>
        <p>${escapeHtml(r.Comments || '')}</p>
      `;
      feedbackList.appendChild(div);
    });
  } catch (err) {
    console.error("dashboard fetch", err);
    feedbackList.innerHTML = "<p>Error loading</p>";
  }
});

// close dashboard
closeDashboardBtn.addEventListener("click", () => {
  dashboardSection.classList.add("hidden");
  marketplaceSection.classList.remove("hidden");
});

// small helper
function escapeHtml(s) {
  if (!s) return "";
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;");
}

// initial state
(function init() {
  marketplaceSection.classList.add("hidden");
  dashboardSection.classList.add("hidden");
  feedbackModal.classList.remove("show");
  dashboardBtn.style.display = "none"; // show after login
})();
