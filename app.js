import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const CONTACTS_COLLECTION = "contacts";
const AUTHORIZED_EMAIL = "viallamv@gmail.com";
const googleProvider = new GoogleAuthProvider();

// ---------- Elementos ----------
const loginScreen = document.getElementById("login-screen");
const appScreen = document.getElementById("app-screen");
const googleLoginBtn = document.getElementById("google-login-btn");
const loginError = document.getElementById("login-error");
const userEmailLabel = document.getElementById("user-email");
const logoutBtn = document.getElementById("logout-btn");

const searchInput = document.getElementById("search-input");
const statusFilter = document.getElementById("status-filter");
const newContactBtn = document.getElementById("new-contact-btn");
const tbody = document.getElementById("contacts-tbody");
const emptyMsg = document.getElementById("empty-msg");

const contactModal = document.getElementById("contact-modal");
const contactForm = document.getElementById("contact-form");
const modalTitle = document.getElementById("modal-title");
const cancelModalBtn = document.getElementById("cancel-modal-btn");
const deleteContactBtn = document.getElementById("delete-contact-btn");

const fieldId = document.getElementById("contact-id");
const fieldEmpresa = document.getElementById("field-empresa");
const fieldSetor = document.getElementById("field-setor");
const fieldNome = document.getElementById("field-nome");
const fieldCargo = document.getElementById("field-cargo");
const fieldEmail = document.getElementById("field-email");
const fieldData = document.getElementById("field-data");
const fieldStatus = document.getElementById("field-status");
const fieldProximoPasso = document.getElementById("field-proximo-passo");

let allContacts = [];
let unsubscribeContacts = null;

// ---------- Autenticação ----------
googleLoginBtn.addEventListener("click", async () => {
  loginError.textContent = "";
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    loginError.textContent = "Não foi possível entrar com o Google. Tente novamente.";
  }
});

logoutBtn.addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  if (user && user.email !== AUTHORIZED_EMAIL) {
    loginError.textContent = "Esta conta Google não tem acesso a este CRM.";
    await signOut(auth);
    return;
  }

  if (user) {
    loginScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");
    userEmailLabel.textContent = user.email;
    listenToContacts();
  } else {
    appScreen.classList.add("hidden");
    loginScreen.classList.remove("hidden");
    if (unsubscribeContacts) {
      unsubscribeContacts();
      unsubscribeContacts = null;
    }
    allContacts = [];
    renderTable();
  }
});

// ---------- Dados (Firestore em tempo real) ----------
function listenToContacts() {
  const q = query(collection(db, CONTACTS_COLLECTION), orderBy("empresa"));
  unsubscribeContacts = onSnapshot(q, (snapshot) => {
    allContacts = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderTable();
  });
}

function statusClass(status) {
  if (status === "Interessado") return "status-interessado";
  if (status === "Recusado") return "status-recusado";
  return "status-sem-resposta";
}

function renderTable() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const statusValue = statusFilter.value;

  const filtered = allContacts.filter((c) => {
    const matchesSearch =
      !searchTerm ||
      [c.empresa, c.setor, c.nome, c.cargo, c.email]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(searchTerm));
    const matchesStatus = !statusValue || c.status === statusValue;
    return matchesSearch && matchesStatus;
  });

  tbody.innerHTML = "";
  emptyMsg.classList.toggle("hidden", filtered.length > 0);

  for (const c of filtered) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(c.empresa)}</td>
      <td>${escapeHtml(c.setor)}</td>
      <td>${escapeHtml(c.nome)}</td>
      <td>${escapeHtml(c.cargo)}</td>
      <td>${escapeHtml(c.email)}</td>
      <td>${escapeHtml(formatDate(c.data))}</td>
      <td><span class="status-badge ${statusClass(c.status)}">${escapeHtml(c.status || "Sem resposta")}</span></td>
      <td>${escapeHtml(c.proximoPasso)}</td>
      <td></td>
    `;
    tr.addEventListener("click", () => openModal(c));
    tbody.appendChild(tr);
  }
}

function escapeHtml(value) {
  if (!value) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatDate(isoDate) {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

// ---------- Filtros ----------
searchInput.addEventListener("input", renderTable);
statusFilter.addEventListener("change", renderTable);

// ---------- Modal: abrir/fechar ----------
function openModal(contact) {
  if (contact) {
    modalTitle.textContent = "Editar contato";
    fieldId.value = contact.id;
    fieldEmpresa.value = contact.empresa || "";
    fieldSetor.value = contact.setor || "";
    fieldNome.value = contact.nome || "";
    fieldCargo.value = contact.cargo || "";
    fieldEmail.value = contact.email || "";
    fieldData.value = contact.data || "";
    fieldStatus.value = contact.status || "Sem resposta";
    fieldProximoPasso.value = contact.proximoPasso || "";
    deleteContactBtn.classList.remove("hidden");
  } else {
    modalTitle.textContent = "Novo contato";
    contactForm.reset();
    fieldId.value = "";
    fieldStatus.value = "Sem resposta";
    deleteContactBtn.classList.add("hidden");
  }
  contactModal.classList.remove("hidden");
}

function closeModal() {
  contactModal.classList.add("hidden");
  contactForm.reset();
}

newContactBtn.addEventListener("click", () => openModal(null));
cancelModalBtn.addEventListener("click", closeModal);
contactModal.addEventListener("click", (e) => {
  if (e.target === contactModal) closeModal();
});

// ---------- Salvar / Excluir ----------
contactForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    empresa: fieldEmpresa.value.trim(),
    setor: fieldSetor.value.trim(),
    nome: fieldNome.value.trim(),
    cargo: fieldCargo.value.trim(),
    email: fieldEmail.value.trim(),
    data: fieldData.value,
    status: fieldStatus.value,
    proximoPasso: fieldProximoPasso.value.trim(),
  };

  const id = fieldId.value;
  if (id) {
    await updateDoc(doc(db, CONTACTS_COLLECTION, id), payload);
  } else {
    await addDoc(collection(db, CONTACTS_COLLECTION), payload);
  }
  closeModal();
});

deleteContactBtn.addEventListener("click", async () => {
  const id = fieldId.value;
  if (!id) return;
  if (!confirm("Excluir este contato?")) return;
  await deleteDoc(doc(db, CONTACTS_COLLECTION, id));
  closeModal();
});
