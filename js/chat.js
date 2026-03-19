const messagesEl = document.getElementById("messages");
const textarea = document.getElementById("input");
const sendBtn = document.getElementById("send-btn");
const welcomeEl = document.getElementById("welcome");

const STORAGE_KEY = "viki-chat-history";

// Load saved messages
let messages = loadMessages();
let isStreaming = false;

// Restore previous conversation on load
if (messages.length > 0) {
  if (welcomeEl) welcomeEl.style.display = "none";
  messages.forEach((msg) => addMessage(msg.role, msg.content, false));
  scrollToBottom();
}

// Auto-resize textarea
textarea.addEventListener("input", () => {
  textarea.style.height = "auto";
  textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
  sendBtn.disabled = !textarea.value.trim() || isStreaming;
});

// Send on Enter (Shift+Enter for new line)
textarea.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (textarea.value.trim() && !isStreaming) sendMessage();
  }
});

sendBtn.addEventListener("click", () => {
  if (textarea.value.trim() && !isStreaming) sendMessage();
});

// Suggestion buttons
document.querySelectorAll(".welcome__suggestion").forEach((btn) => {
  btn.addEventListener("click", () => {
    textarea.value = btn.textContent;
    sendMessage();
  });
});

function scrollToBottom() {
  messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: "smooth" });
}

function loadMessages() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveMessages() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // storage full or unavailable
  }
}

function renderMarkdown(text) {
  return text
    // Bold
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    // Italic
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    // Inline code
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // Headers
    .replace(/^### (.*$)/gm, "<h4>$1</h4>")
    .replace(/^## (.*$)/gm, "<h3>$1</h3>")
    // Unordered lists
    .replace(/^- (.*$)/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>")
    // Links
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>'
    )
    // Paragraphs
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>")
    .replace(/^(.+)$/s, "<p>$1</p>")
    // Clean empty paragraphs
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

  // Add user message
  messages.push({ role: "user", content });
  saveMessages();
  addMessage("user", content);

  // Show typing
  showTyping();

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });

    hideTyping();

    if (!response.ok) throw new Error("API error");

    // Create assistant bubble
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

    messages.push({ role: "assistant", content: fullText });
    saveMessages();
  } catch (error) {
    hideTyping();
    addMessage(
      "assistant",
      "Elnezest, hiba tortent. Probald ujra, vagy irj Attilanak: hello@expertflow.hu"
    );
  }

  isStreaming = false;
  sendBtn.disabled = !textarea.value.trim();
}
