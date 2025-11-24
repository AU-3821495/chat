const socket = io();

let current = {
  room: "",
  displayName: "",
  userId: "",
  iconBase64: "",
  bubbleColor: "#e6f7ff",
  textColor: "#222222"
};

const el = {
  joinPanel: document.getElementById("joinPanel"),
  chatPanel: document.getElementById("chatPanel"),
  roomInput: document.getElementById("roomInput"),
  displayNameInput: document.getElementById("displayNameInput"),
  userIdInput: document.getElementById("userIdInput"),
  iconInput: document.getElementById("iconInput"),
  bubbleColorInput: document.getElementById("bubbleColorInput"),
  textColorInput: document.getElementById("textColorInput"),
  joinBtn: document.getElementById("joinBtn"),
  leaveBtn: document.getElementById("leaveBtn"),

  roster: document.getElementById("roster"),

  textInput: document.getElementById("textInput"),
  imageInput: document.getElementById("imageInput"),
  sendBtn: document.getElementById("sendBtn"),
  stamps: document.querySelectorAll(".stamp"),

  messages: document.getElementById("messages"),

  iconUpdateInput: document.getElementById("iconUpdateInput"),
  bubbleColorUpdateInput: document.getElementById("bubbleColorUpdateInput"),
  textColorUpdateInput: document.getElementById("textColorUpdateInput"),
  confirmUpdateBtn: document.getElementById("confirmUpdateBtn")
};

function fileToBase64(file) {
  return new Promise((resolve) => {
    if (!file) return resolve("");
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

el.joinBtn.addEventListener("click", async () => {
  const room = el.roomInput.value.trim();
  const displayName = el.displayNameInput.value.trim();
  const userId = el.userIdInput.value.trim();
  const iconBase64 = await fileToBase64(el.iconInput.files[0]);
  const bubbleColor = el.bubbleColorInput.value;
  const textColor = el.textColorInput.value;

  if (!room || !displayName || !userId) {
    alert("ヘヤ名・表じ名・ID を入力してください");
    return;
  }

  current = { room, displayName, userId, iconBase64, bubbleColor, textColor };
  socket.emit("join", current);

  el.joinPanel.classList.add("hidden");
  el.chatPanel.classList.remove("hidden");
});

el.leaveBtn.addEventListener("click", () => {
  socket.emit("leave");
  el.chatPanel.classList.add("hidden");
  el.joinPanel.classList.remove("hidden");
  el.messages.innerHTML = "";
  el.roster.innerHTML = "";
});

el.sendBtn.addEventListener("click", async () => {
  const text = el.textInput.value.trim();
  const imageBase64 = await fileToBase64(el.imageInput.files[0]);

  if (!text && !imageBase64) return;

  socket.emit("chat", { text, imageBase64, fromUserId: current.userId });
  el.textInput.value = "";
  el.imageInput.value = "";
});

el.stamps.forEach((btn) => {
  btn.addEventListener("click", () => {
    const stamp = btn.dataset.stamp;
    socket.emit("chat", { stamp, fromUserId: current.userId });
  });
});

el.confirmUpdateBtn.addEventListener("click", async () => {
  const iconBase64 = await fileToBase64(el.iconUpdateInput.files[0]);
  const bubbleColor = el.bubbleColorUpdateInput.value || undefined;
  const textColor = el.textColorUpdateInput.value || undefined;

  socket.emit("updateProfile", { iconBase64, bubbleColor, textColor });

  // 入力をクリア
  el.iconUpdateInput.value = "";
  el.bubbleColorUpdateInput.value = "";
  el.textColorUpdateInput.value = "";
});

socket.on("roster", (list) => {
  el.roster.innerHTML = "";
  list.forEach((u) => {
    const li = document.createElement("li");
    const img = document.createElement("img");
    img.src = u.iconBase64 || "";
    const name = document.createElement("span");
    name.textContent = `${u.displayName} (${u.userId})`;
    li.appendChild(img);
    li.appendChild(name);
    li.addEventListener("click", async () => {
      const text = prompt(`個別送信: ${u.displayName} へメッセージ`);
      if (!text) return;
      socket.emit("private", { toUserId: u.userId, text });
    });
    el.roster.appendChild(li);
  });
});

function addMessage(payload, isMe, isPrivate) {
  const li = document.createElement("li");
  const box = document.createElement("div");
  box.className = "message" + (isMe ? " me" : "");

  const avatar = document.createElement("img");
  avatar.className = "avatar";
  avatar.src = payload.from.iconBase64 || "";
  box.appendChild(avatar);

  const content = document.createElement("div");
  content.className = "content";

  const title = document.createElement("div");
  title.textContent = `${isPrivate ? "【個別】" : ""}${payload.from.displayName}`;
  title.style.color = "#aaa";
  content.appendChild(title);

  const bubble = document.createElement("div");
  bubble.style.backgroundColor = payload.from.bubbleColor || "#222";
  bubble.style.color = payload.from.textColor || "#eee";
  bubble.style.padding = "8px";
  bubble.style.borderRadius = "8px";
  bubble.style.border = "1px solid #333";

  if (payload.text) {
    const p = document.createElement("p");
    p.textContent = payload.text;
    bubble.appendChild(p);
  }
  if (payload.stamp) {
    const s = document.createElement("p");
    s.textContent = `【スタンプ】${payload.stamp}`;
    bubble.appendChild(s);
  }
  if (payload.imageBase64) {
    const img = document.createElement("img");
    img.className = "payload";
    img.src = payload.imageBase64;
    bubble.appendChild(img);
  }

  content.appendChild(bubble);
  box.appendChild(content);
  li.appendChild(box);
  el.messages.appendChild(li);
}

socket.on("chat", (payload) => {
  const isMe = payload.from.userId === current.userId;
  addMessage(payload, isMe, false);
});

socket.on("private", (payload) => {
  const isMe = payload.from.userId === current.userId;
  addMessage(payload, isMe, true);
});
