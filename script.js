// Get references to DOM elements
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateRoutineBtn = document.getElementById("generateRoutine");
const productSearch = document.getElementById("productSearch");
const rtlToggle = document.getElementById("rtlToggle");

// Store selected products in an array
let selectedProducts = [];

// Load selected products from localStorage if available
function loadSelectedProducts() {
  const saved = localStorage.getItem("selectedProducts");
  if (saved) {
    try {
      selectedProducts = JSON.parse(saved);
    } catch {
      selectedProducts = [];
    }
  }
}

// Save selected products to localStorage
function saveSelectedProducts() {
  localStorage.setItem("selectedProducts", JSON.stringify(selectedProducts));
}

// Show initial placeholder until user selects a category
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

// Load product data from JSON file
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

// Create HTML for displaying product cards
function displayProducts(products) {
  productsContainer.innerHTML = products
    .map((product) => {
      // Check if product is selected
      const isSelected = selectedProducts.some((p) => p.name === product.name);
      return `
        <div class="product-card${isSelected ? " selected" : ""}" data-name="${
        product.name
      }">
          <img src="${product.image}" alt="${product.name}">
          <div class="product-info">
            <h3>${product.name}</h3>
            <p>${product.brand}</p>
            <button class="desc-btn" data-name="${
              product.name
            }">Show Description</button>
            <div class="product-desc" style="display:none;">${
              product.description
            }</div>
          </div>
        </div>
      `;
    })
    .join("");

  // Add click event listeners for product selection
  document.querySelectorAll(".product-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      // Prevent click on description button from toggling selection
      if (e.target.classList.contains("desc-btn")) return;
      const name = card.getAttribute("data-name");
      toggleProductSelection(name, products);
    });
  });

  // Add click event listeners for description buttons
  document.querySelectorAll(".desc-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const card = btn.closest(".product-card");
      const desc = card.querySelector(".product-desc");
      if (desc.style.display === "none") {
        desc.style.display = "block";
        btn.textContent = "Hide Description";
      } else {
        desc.style.display = "none";
        btn.textContent = "Show Description";
      }
    });
  });
}

// Toggle product selection
function toggleProductSelection(name, products) {
  const product = products.find((p) => p.name === name);
  const index = selectedProducts.findIndex((p) => p.name === name);
  if (index === -1) {
    selectedProducts.push(product);
  } else {
    selectedProducts.splice(index, 1);
  }
  saveSelectedProducts();
  displayProducts(products);
  updateSelectedProductsList();
}

// Update the Selected Products section
function updateSelectedProductsList() {
  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML =
      '<div class="placeholder-message">No products selected.</div>';
    return;
  }
  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product) => `
        <div class="selected-product" data-name="${product.name}">
          <span>${product.name} (${product.brand})</span>
          <button class="remove-selected" title="Remove">&times;</button>
        </div>
      `
    )
    .join("");

  // Add remove button listeners
  document.querySelectorAll(".remove-selected").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const name = btn.parentElement.getAttribute("data-name");
      selectedProducts = selectedProducts.filter((p) => p.name !== name);
      saveSelectedProducts();
      updateSelectedProductsList();
      // Also update product grid selection
      loadProducts().then((products) =>
        displayProducts(
          products.filter((p) => p.category === categoryFilter.value)
        )
      );
    });
  });
}

// Store last loaded products for search
let lastLoadedProducts = [];

// Filter and display products when category changes
categoryFilter.addEventListener("change", async (e) => {
  const products = await loadProducts();
  lastLoadedProducts = products;
  const selectedCategory = e.target.value;
  const filteredProducts = products.filter(
    (product) => product.category === selectedCategory
  );
  displayProducts(filteredProducts);
  // Clear product search field
  productSearch.value = "";
});

// Product search filter
productSearch.addEventListener("input", async (e) => {
  // If no category selected, do nothing
  if (!categoryFilter.value) return;
  const searchTerm = e.target.value.toLowerCase();
  const products = lastLoadedProducts.length
    ? lastLoadedProducts
    : await loadProducts();
  const filtered = products.filter(
    (p) =>
      p.category === categoryFilter.value &&
      (p.name.toLowerCase().includes(searchTerm) ||
        p.brand.toLowerCase().includes(searchTerm) ||
        (p.description && p.description.toLowerCase().includes(searchTerm)))
  );
  displayProducts(filtered);
});

// RTL toggle
rtlToggle.addEventListener("click", () => {
  const html = document.documentElement;
  if (html.getAttribute("dir") === "rtl") {
    html.setAttribute("dir", "ltr");
    rtlToggle.textContent = "RTL";
  } else {
    html.setAttribute("dir", "rtl");
    rtlToggle.textContent = "LTR";
  }
});

// On page load, restore selected products and update list
loadSelectedProducts();
updateSelectedProductsList();

// Store chat history for context
let chatHistory = [];

// Helper: Render chat messages
function renderChat() {
  chatWindow.innerHTML = chatHistory
    .map(
      (msg) =>
        `<div class="chat-msg ${msg.role}"><strong>${
          msg.role === "user" ? "You" : "AI"
        }:</strong> ${msg.content}</div>`
    )
    .join("");
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Helper: Send messages to Cloudflare Worker
async function sendToAI(messages) {
  try {
    const response = await fetch("https://sparky.imorfin2.workers.dev/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });
    const data = await response.json();
    if (
      data &&
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content
    ) {
      return data.choices[0].message.content;
    } else {
      return "Sorry, I couldn't get a response from the AI.";
    }
  } catch (err) {
    return "Error connecting to the AI service.";
  }
}

// Generate Routine button handler
generateRoutineBtn.addEventListener("click", async () => {
  if (selectedProducts.length === 0) {
    chatWindow.innerHTML =
      "<div class='placeholder-message'>Please select at least one product to generate a routine.</div>";
    return;
  }
  // Prepare system prompt and user message
  chatWindow.innerHTML =
    "<div class='placeholder-message'>Generating your personalized routine...</div>";
  const routinePrompt = {
    role: "system",
    content:
      "You are a helpful L'Oréal beauty advisor. Use the provided product data to create a step-by-step routine. Be clear, friendly, and explain why each product is used.",
  };
  const userMsg = {
    role: "user",
    content: `Here are my selected products: ${selectedProducts
      .map(
        (p, i) =>
          `\n${i + 1}. ${p.name} (${p.brand}) - ${p.category}\nDescription: ${
            p.description
          }`
      )
      .join(
        "\n"
      )}\nPlease generate a personalized routine using these products.`,
  };
  chatHistory = [routinePrompt, userMsg];
  renderChat();
  const aiReply = await sendToAI(chatHistory);
  chatHistory.push({ role: "assistant", content: aiReply });
  renderChat();
});

// Chat form submission handler
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const userInput = document.getElementById("userInput").value;
  if (!userInput.trim()) return;
  // Add user message to chat history
  chatHistory.push({ role: "user", content: userInput });
  renderChat();
  document.getElementById("userInput").value = "";
  // Send full chat history to AI
  const aiReply = await sendToAI(chatHistory);
  chatHistory.push({ role: "assistant", content: aiReply });
  renderChat();
});
