const messagesEl = document.getElementById("messages");
const textarea = document.getElementById("input");
const sendBtn = document.getElementById("send-btn");
const welcomeEl = document.getElementById("welcome");
const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebar-overlay");
const menuBtn = document.getElementById("menu-btn");
const newChatBtn = document.getElementById("new-chat-btn");
const convListEl = document.getElementById("conversation-list");

const STORAGE_KEY = "viki-chat-conversations";

let conversations = loadConversations();
let currentConvId = null;
let currentMessages = [];
let isStreaming = false;

// Start with a fresh conversation
startNewConversation();
renderSidebar();

// ── Sidebar toggle (mobile) ──
menuBtn.addEventListener("click", () => {
  sidebar.classList.toggle("open");
  sidebarOverlay.classList.toggle("active");
});

sidebarOverlay.addEventListener("click", () => {
  sidebar.classList.remove("open");
  sidebarOverlay.classList.remove("active");
});

// ── New chat ──
newChatBtn.addEventListener("click", () => {
  startNewConversation();
  sidebar.classList.remove("open");
  sidebarOverlay.classList.remove("active");
});

// ── Input ──
textarea.addEventListener("input", () => {
  textarea.style.height = "auto";
  textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
  sendBtn.disabled = !textarea.value.trim() || isStreaming;
});

textarea.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (textarea.value.trim() && !isStreaming) sendMessage();
  }
});

sendBtn.addEventListener("click", () => {
  if (textarea.value.trim() && !isStreaming) sendMessage();
});

// ── Suggestion buttons ──
document.querySelectorAll(".welcome__suggestion").forEach((btn) => {
  btn.addEventListener("click", () => {
    textarea.value = btn.textContent;
    sendMessage();
  });
});

// ── Storage ──
function loadConversations() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveConversations() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch {
    // storage full
  }
}

// ── Conversations ──
function startNewConversation() {
  currentConvId = Date.now().toString();
  currentMessages = [];

  // Clear messages area
  messagesEl.innerHTML = "";
  if (welcomeEl) {
    messagesEl.appendChild(welcomeEl);
    welcomeEl.style.display = "";
  }

  // Deactivate sidebar items
  document.querySelectorAll(".conv-item--active").forEach((el) => {
    el.classList.remove("conv-item--active");
  });
}

function loadConversation(convId) {
  const conv = conversations.find((c) => c.id === convId);
  if (!conv) return;

  currentConvId = conv.id;
  currentMessages = [...conv.messages];

  // Clear and render messages
  messagesEl.innerHTML = "";
  if (welcomeEl) welcomeEl.style.display = "none";

  currentMessages.forEach((msg) => addMessage(msg.role, msg.content, false));
  scrollToBottom();
  renderSidebar();

  // Close sidebar on mobile
  sidebar.classList.remove("open");
  sidebarOverlay.classList.remove("active");
}

function deleteConversation(convId, e) {
  e.stopPropagation();
  conversations = conversations.filter((c) => c.id !== convId);
  saveConversations();

  if (currentConvId === convId) {
    startNewConversation();
  }

  renderSidebar();
}

function saveCurrentConversation() {
  if (currentMessages.length === 0) return;

  const existing = conversations.findIndex((c) => c.id === currentConvId);
  const title =
    currentMessages[0]?.content.slice(0, 50) +
    (currentMessages[0]?.content.length > 50 ? "..." : "");

  const conv = {
    id: currentConvId,
    title,
    date: new Date().toISOString(),
    messages: [...currentMessages],
  };

  if (existing >= 0) {
    conversations[existing] = conv;
  } else {
    conversations.unshift(conv);
  }

  saveConversations();
  renderSidebar();
}

// ── Sidebar rendering ──
function renderSidebar() {
  convListEl.innerHTML = "";

  if (conversations.length === 0) {
    convListEl.innerHTML =
      '<div style="padding: 1rem; text-align: center; color: var(--text-dim); font-size: 0.75rem;">Még nincsenek korábbi beszélgetések</div>';
    return;
  }

  // Group by date
  const groups = {};
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  conversations.forEach((conv) => {
    const d = new Date(conv.date).toDateString();
    let label;
    if (d === today) label = "Ma";
    else if (d === yesterday) label = "Tegnap";
    else label = new Date(conv.date).toLocaleDateString("hu-HU", { month: "long", day: "numeric" });

    if (!groups[label]) groups[label] = [];
    groups[label].push(conv);
  });

  Object.entries(groups).forEach(([label, convs]) => {
    const groupLabel = document.createElement("div");
    groupLabel.className = "sidebar__group-label";
    groupLabel.textContent = label;
    convListEl.appendChild(groupLabel);

    convs.forEach((conv) => {
      const item = document.createElement("div");
      item.className = "conv-item" + (conv.id === currentConvId ? " conv-item--active" : "");
      item.onclick = () => loadConversation(conv.id);

      item.innerHTML = `
        <div class="conv-item__text">
          <div class="conv-item__title">${escapeHtml(conv.title)}</div>
          <div class="conv-item__date">${new Date(conv.date).toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" })}</div>
        </div>
        <button class="conv-item__delete" title="Törlés">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
        </button>
      `;

      item.querySelector(".conv-item__delete").onclick = (e) =>
        deleteConversation(conv.id, e);

      convListEl.appendChild(item);
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ── Messages ──
function scrollToBottom() {
  messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: "smooth" });
}

function renderMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/^### (.*$)/gm, "<h4>$1</h4>")
    .replace(/^## (.*$)/gm, "<h3>$1</h3>")
    .replace(/^- (.*$)/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>")
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>'
    )
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>")
    .replace(/^(.+)$/s, "<p>$1</p>")
    .replace(/<p><\/p>/g, "")
    .replace(/<p>(<h[34]>)/g, "$1")
    .replace(/(<\/h[34]>)<\/p>/g, "$1")
    .replace(/<p>(<ul>)/g, "$1")
    .replace(/(<\/ul>)<\/p>/g, "$1");
}

function addMessage(role, content, animate = true) {
  if (welcomeEl) welcomeEl.style.display = "none";

  const div = document.createElement("div");
  div.className = `message message--${role}`;
  if (!animate) div.style.animation = "none";

  const avatar = document.createElement("div");
  avatar.className = "message__avatar";
  avatar.textContent = role === "user" ? "Te" : "A";

  const bubble = document.createElement("div");
  bubble.className = "message__bubble";
  bubble.innerHTML = renderMarkdown(content);

  div.appendChild(avatar);
  div.appendChild(bubble);
  messagesEl.appendChild(div);
  if (animate) scrollToBottom();

  return bubble;
}

function showTyping() {
  const div = document.createElement("div");
  div.className = "typing";
  div.id = "typing-indicator";

  const avatar = document.createElement("div");
  avatar.className = "message__avatar";
  avatar.textContent = "A";

  const dots = document.createElement("div");
  dots.className = "typing__dots";
  dots.innerHTML =
    '<span class="typing__dot"></span><span class="typing__dot"></span><span class="typing__dot"></span>';

  div.appendChild(avatar);
  div.appendChild(dots);
  messagesEl.appendChild(div);
  scrollToBottom();
}

function hideTyping() {
  const el = document.getElementById("typing-indicator");
  if (el) el.remove();
}

async function sendMessage() {
  const content = textarea.value.trim();
  if (!content || isStreaming) return;

  isStreaming = true;
  sendBtn.disabled = true;
  textarea.value = "";
  textarea.style.height = "auto";

  currentMessages.push({ role: "user", content });
  saveCurrentConversation();
  addMessage("user", content);

  showTyping();

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: currentMessages }),
    });

    hideTyping();

    if (!response.ok) throw new Error("API error");

    let fullText = "";
    const bubble = addMessage("assistant", "");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") break;

          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              fullText += parsed.text;
              bubble.innerHTML = renderMarkdown(fullText);
              scrollToBottom();
            }
            if (parsed.error) {
              bubble.innerHTML = `<p>${parsed.error}</p>`;
            }
          } catch (e) {
            // skip malformed chunks
          }
        }
      }
    }

    currentMessages.push({ role: "assistant", content: fullText });
    saveCurrentConversation();
  } catch (error) {
    hideTyping();
    addMessage(
      "assistant",
      "Elnézést, hiba történt. Próbáld újra, vagy írj Attilának: hello@expertflow.hu"
    );
  }

  isStreaming = false;
  sendBtn.disabled = !textarea.value.trim();
}
