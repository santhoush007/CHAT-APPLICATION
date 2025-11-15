// app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
  getFirestore, collection, addDoc, onSnapshot, query, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAFbhB2Yl0nxHUXrLMYOnFG_oiTT_nfe7o",
  authDomain: "my-chat-app-ae668.firebaseapp.com",
  projectId: "my-chat-app-ae668",
  storageBucket: "my-chat-app-ae668.firebasestorage.app",
  messagingSenderId: "129196373941",
  appId: "1:129196373941:web:8faee71e3d191a34884bfc",
  measurementId: "G-E7J1QMSW82"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const CHAT_COLLECTION_PATH = "messages";

const loginForm = document.getElementById("loginForm");
const chatForm = document.getElementById("chatForm");
const displayNameInput = document.getElementById("displayNameInput");
const messageInput = document.getElementById("messageInput");
const messageContainer = document.getElementById("messageContainer");
const loginContainer = document.getElementById("loginContainer");
const chatContainer = document.getElementById("chatContainer");
const displayNameDisplay = document.getElementById("displayNameDisplay");
const userIdDisplay = document.getElementById("userIdDisplay");

let currentDisplayName = "";
let currentUserId = "";
let sessionStartTime = null;

function getChatHistoryKey(displayName) {
  return `chat_history_${displayName}`;
}

function saveChatToLocalStorage(displayName, messages) {
  const key = getChatHistoryKey(displayName);
  localStorage.setItem(key, JSON.stringify(messages));
}

function loadChatFromLocalStorage(displayName) {
  const key = getChatHistoryKey(displayName);
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : [];
}

// --- 🔑 Auth ---
// --- Always start from login page ---
import { signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

window.addEventListener("load", async () => {
  await signOut(auth); // forces a fresh login every time
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  currentDisplayName = displayNameInput.value.trim();
  if (!currentDisplayName) return alert("Enter your name!");
  try {
    await signInAnonymously(auth);
  } catch (err) {
    console.error("Auth error:", err);
    alert("Firebase Auth Error: Check if Anonymous login is enabled!");
  }
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUserId = user.uid;
    sessionStartTime = new Date();
    displayNameDisplay.textContent = currentDisplayName;
    userIdDisplay.textContent = user.uid;
    loginContainer.classList.add("hidden");
    chatContainer.classList.remove("hidden");
    initChat();
  }
});

// --- 💬 Chat Logic ---
function initChat() {
  // Load saved chat history from localStorage
  const savedHistory = loadChatFromLocalStorage(currentDisplayName);
  
  const messagesRef = collection(db, CHAT_COLLECTION_PATH);
  const q = query(messagesRef);

  // Real-time updates
  onSnapshot(q, (snapshot) => {
    const firestoreMessages = snapshot.docs.map((d) => d.data());
    
    // Filter Firestore messages to only show those from current session
    const sessionMessages = firestoreMessages.filter(msg => {
      if (!msg.timestamp) return false;
      const messageTime = new Date(msg.timestamp.seconds * 1000);
      return messageTime >= sessionStartTime;
    });
    
    // Combine saved history with new session messages
    const allMessages = [...savedHistory, ...sessionMessages];
    
    // Remove duplicates based on text, displayName, and timestamp
    const uniqueMessages = Array.from(
      new Map(
        allMessages.map(msg => [
          `${msg.displayName}-${msg.text}-${msg.timestamp?.seconds || 0}`,
          msg
        ])
      ).values()
    );
    
    renderMessages(uniqueMessages);
    // Save combined messages to localStorage
    saveChatToLocalStorage(currentDisplayName, uniqueMessages);
  });

  // Send message
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (!text) return;

    await addDoc(messagesRef, {
      text,
      displayName: currentDisplayName,
      userId: currentUserId,
      timestamp: serverTimestamp()
    });

    messageInput.value = "";
    getBotReply(text);
  });
}

// --- 🤖 Gemini ChatBot ---
async function getBotReply(userText) {
  const apiKey = "AIzaSyDLr86l3V1w5Gfooy8qZbVtlKeJfTggwro";
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ parts: [{ text: userText }] }],
    systemInstruction: { parts: [{ text: "You are a helpful AI ChatBot." }] },
  };

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    const botText = data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm not sure!";
    postBotMessage(botText);
  } catch (err) {
    console.error("Bot error:", err);
  }
}

// --- 🪄 Add Bot Message ---
async function postBotMessage(text) {
  const messagesRef = collection(db, CHAT_COLLECTION_PATH);
  await addDoc(messagesRef, {
    text,
    displayName: "AI ChatBot",
    userId: "bot",
    timestamp: serverTimestamp()
  });
}

// --- 🖼️ Render Messages ---
function renderMessages(messages) {
  messageContainer.innerHTML = "";
  messages.sort((a, b) => a.timestamp?.seconds - b.timestamp?.seconds);
  messages.forEach(msg => {
    const mine = msg.userId === currentUserId;
    const div = document.createElement("div");
    div.className = `flex ${mine ? "justify-end" : "justify-start"}`;
    div.innerHTML = `
      <div class="p-3 rounded-2xl max-w-xs md:max-w-md shadow-md ${mine ? "bg-emerald-600 text-white" : "bg-gray-700 text-white"}">
        <div class="text-xs opacity-70 mb-1">${msg.displayName}</div>
        <div>${msg.text}</div>
      </div>`;
    messageContainer.appendChild(div);
  });
  messageContainer.scrollTop = messageContainer.scrollHeight;
}
