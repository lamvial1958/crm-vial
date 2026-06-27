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
const setorFilter = document.getElementById("setor-filter");
const newContactBtn = document.getElementById("new-contact-btn");
const exportCsvBtn = document.getElementById("export-csv-btn");
const tbody = document.getElementById("contacts-tbody");
const emptyMsg = document.getElementById("empty-msg");
const resultsCounter = document.getElementById("results-counter");

const contactModal = document.getElementById("contact-modal");
const contactForm = document.getElementById("contact-form");
const modalTitle = document.getElementById("modal-title");
const cancelModalBtn = document.getElementById("cancel-modal-btn");
const deleteContactBtn = document.getElementById("delete-contact-btn");

const deleteConfirmModal = document.getElementById("delete-confirm-modal");
const deleteCancelBtn = document.getElementById("delete-cancel-btn");
const deleteConfirmBtn = document.getElementById("delete-confirm-btn");

const fieldId = document.getElementById("contact-id");
const fieldEmpresa = document.getElementById("field-empresa");
const fieldSetor = document.getElementById("field-setor");
const fieldNome = document.getElementById("field-nome");
const fieldCargo = document.getElementById("field-cargo");
const fieldEmail = document.getElementById("field-email");
const fieldTelefone = document.getElementById("field-telefone");
const fieldLinkedin = document.getElementById("field-linkedin");
const fieldData = document.getElementById("field-data");
const fieldStatus = document.getElementById("field-status");
const fieldProximoPasso = document.getElementById("field-proximo-passo");
const fieldNotas = document.getElementById("field-notas");
const fieldAcompanhamento = document.getElementById("field-acompanhamento");

const historicoList = document.getElementById("historico-list");
const historicoInput = document.getElementById("historico-input");
const historicoAddBtn = document.getElementById("historico-add-btn");

const followupAlertModal = document.getElementById("followup-alert-modal");
const followupAlertList = document.getElementById("followup-alert-list");
const followupAlertCloseBtn = document.getElementById("followup-alert-close-btn");

const toastContainer = document.getElementById("toast-container");

const dashTotal = document.getElementById("dash-total");
const dashInteressado = document.getElementById("dash-interessado");
const dashSemResposta = document.getElementById("dash-sem-resposta");
const dashVencidos = document.getElementById("dash-vencidos");

let allContacts = [];
let unsubscribeContacts = null;
let followupCheckedThisSession = false;
let sortField = "empresa";
let sortAsc = true;
let pendingDeleteId = null;
let currentHistorico = [];

// ---------- Autenticação ----------
googleLoginBtn.addEventListener("click", async () => {
  loginError.textContent = "";
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    loginError.textContent = `Erro: ${err.code || err.message}`;
    console.error("Erro no login Google:", err);
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
    followupCheckedThisSession = false;
    renderTable();
  }
});

// ---------- Dados (Firestore em tempo real) ----------
function listenToContacts() {
  const q = query(collection(db, CONTACTS_COLLECTION), orderBy("empresa"));
  unsubscribeContacts = onSnapshot(q, (snapshot) => {
    allContacts = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    updateSetorFilter();
    updateDashboard();
    renderTable();
    if (!followupCheckedThisSession) {
      followupCheckedThisSession = true;
      checkOverdueFollowups();
    }
  });
}

// ---------- #11 Dashboard ----------
function updateDashboard() {
  const todayStr = new Date().toISOString().slice(0, 10);
  dashTotal.textContent = allContacts.length;
  dashInteressado.textContent = allContacts.filter(
    (c) => c.status === "Interessado"
  ).length;
  dashSemResposta.textContent = allContacts.filter(
    (c) => !c.status || c.status === "Sem resposta"
  ).length;
  dashVencidos.textContent = allContacts.filter(
    (c) =>
      c.acompanhamento &&
      c.acompanhamento <= todayStr &&
      c.acompanhamentoDismissedDate !== c.acompanhamento
  ).length;
}

// ---------- #7 Filtro por setor ----------
function updateSetorFilter() {
  const setores = [...new Set(allContacts.map((c) => c.setor).filter(Boolean))].sort();
  const current = setorFilter.value;
  setorFilter.innerHTML = '<option value="">Todos os setores</option>';
  for (const s of setores) {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    setorFilter.appendChild(opt);
  }
  if (setores.includes(current)) setorFilter.value = current;
}

// ---------- #4 Ordenação por coluna ----------
document.querySelectorAll("th[data-sort]").forEach((th) => {
  th.addEventListener("click", () => {
    const field = th.dataset.sort;
    if (sortField === field) {
      sortAsc = !sortAsc;
    } else {
      sortField = field;
      sortAsc = true;
    }
    updateSortIcons();
    renderTable();
  });
});

function updateSortIcons() {
  document.querySelectorAll("th[data-sort]").forEach((th) => {
    const icon = th.querySelector(".sort-icon");
    if (th.dataset.sort === sortField) {
      icon.textContent = sortAsc ? "↑" : "↓";
      th.classList.add("sort-active");
    } else {
      icon.textContent = "↕";
      th.classList.remove("sort-active");
    }
  });
}

function sortContacts(contacts) {
  return [...contacts].sort((a, b) => {
    const va = (a[sortField] || "").toLowerCase();
    const vb = (b[sortField] || "").toLowerCase();
    if (va < vb) return sortAsc ? -1 : 1;
    if (va > vb) return sortAsc ? 1 : -1;
    return 0;
  });
}

// ---------- Status ----------
function statusClass(status) {
  const map = {
    "Interessado": "status-interessado",
    "Recusado": "status-recusado",
    "Proposta enviada": "status-proposta",
    "Em negociação": "status-negociacao",
    "Em espera": "status-espera",
  };
  return map[status] || "status-sem-resposta";
}

// ---------- Render ----------
function renderTable() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const statusValue = statusFilter.value;
  const setorValue = setorFilter.value;
  const todayStr = new Date().toISOString().slice(0, 10);

  const filtered = allContacts.filter((c) => {
    const matchesSearch =
      !searchTerm ||
      [c.empresa, c.setor, c.nome, c.cargo, c.email]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(searchTerm));
    const matchesStatus = !statusValue || c.status === statusValue;
    const matchesSetor = !setorValue || c.setor === setorValue;
    return matchesSearch && matchesStatus && matchesSetor;
  });

  const sorted = sortContacts(filtered);

  // #8 Contador de resultados
  resultsCounter.textContent =
    allContacts.length > 0
      ? `Exibindo ${sorted.length} de ${allContacts.length} contatos`
      : "";

  tbody.innerHTML = "";
  emptyMsg.classList.toggle("hidden", sorted.length > 0);

  for (const c of sorted) {
    const isOverdue =
      c.acompanhamento &&
      c.acompanhamento <= todayStr &&
      c.acompanhamentoDismissedDate !== c.acompanhamento;

    const tr = document.createElement("tr");

    // #1 Destaque visual de follow-up vencido na tabela
    if (isOverdue) tr.classList.add("row-overdue");

    tr.innerHTML = `
      <td>${escapeHtml(c.empresa)}</td>
      <td>${escapeHtml(c.setor)}</td>
      <td>${escapeHtml(c.nome)}</td>
      <td>${escapeHtml(c.cargo)}</td>
      <td></td>
      <td></td>
      <td>${escapeHtml(formatDate(c.data))}</td>
      <td><span class="status-badge ${statusClass(c.status)}">${escapeHtml(c.status || "Sem resposta")}</span></td>
      <td>${escapeHtml(c.proximoPasso)}</td>
      <td>${isOverdue ? '<span class="overdue-dot" title="Follow-up vencido">⚠</span> ' : ""}${escapeHtml(formatDate(c.acompanhamento))}</td>
    `;

    // #2 E-mail e telefone clicáveis (adicionados após innerHTML para evitar XSS)
    const emailTd = tr.cells[4];
    if (c.email) {
      const a = document.createElement("a");
      a.href = `mailto:${c.email}`;
      a.className = "table-link";
      a.textContent = c.email;
      a.addEventListener("click", (e) => e.stopPropagation());
      emailTd.appendChild(a);
    }

    const phoneTd = tr.cells[5];
    if (c.telefone) {
      const digits = c.telefone.replace(/\D/g, "");
      const waNum = digits.startsWith("55") ? digits : `55${digits}`;
      const a = document.createElement("a");
      a.href = `https://wa.me/${waNum}`;
      a.target = "_blank";
      a.className = "table-link";
      a.textContent = c.telefone;
      a.addEventListener("click", (e) => e.stopPropagation());
      phoneTd.appendChild(a);
    }

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
setorFilter.addEventListener("change", renderTable);

// ---------- #9 Exportar CSV ----------
exportCsvBtn.addEventListener("click", () => {
  const headers = [
    "Empresa", "Setor", "Nome", "Cargo", "E-mail", "Telefone",
    "LinkedIn/Site", "Data do Envio", "Status", "Próximo Passo",
    "Acompanhamento", "Notas",
  ];
  const rows = allContacts.map((c) =>
    [
      c.empresa, c.setor, c.nome, c.cargo, c.email, c.telefone,
      c.linkedin, formatDate(c.data), c.status, c.proximoPasso,
      formatDate(c.acompanhamento), c.notas,
    ].map((v) => `"${(v || "").replace(/"/g, '""')}"`)
  );

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `CRM_Vial_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("CSV exportado com sucesso.");
});

// ---------- #5 Toast ----------
function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("toast-show"));
  setTimeout(() => {
    toast.classList.remove("toast-show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ---------- Modal: abrir/fechar ----------
function openModal(contact) {
  currentHistorico = [];
  if (contact) {
    modalTitle.textContent = "Editar contato";
    fieldId.value = contact.id;
    fieldEmpresa.value = contact.empresa || "";
    fieldSetor.value = contact.setor || "";
    fieldNome.value = contact.nome || "";
    fieldCargo.value = contact.cargo || "";
    fieldEmail.value = contact.email || "";
    fieldTelefone.value = contact.telefone || "";
    fieldLinkedin.value = contact.linkedin || "";
    fieldData.value = contact.data || "";
    fieldStatus.value = contact.status || "Sem resposta";
    fieldProximoPasso.value = contact.proximoPasso || "";
    fieldNotas.value = contact.notas || "";
    fieldAcompanhamento.value = contact.acompanhamento || "";
    currentHistorico = Array.isArray(contact.historico) ? [...contact.historico] : [];
    deleteContactBtn.classList.remove("hidden");
  } else {
    modalTitle.textContent = "Novo contato";
    contactForm.reset();
    fieldId.value = "";
    fieldStatus.value = "Sem resposta";
    currentHistorico = [];
    deleteContactBtn.classList.add("hidden");
  }
  renderHistorico();
  contactModal.classList.remove("hidden");
  fieldEmpresa.focus();
}

function closeModal() {
  contactModal.classList.add("hidden");
  contactForm.reset();
  currentHistorico = [];
  historicoInput.value = "";
}

newContactBtn.addEventListener("click", () => openModal(null));
cancelModalBtn.addEventListener("click", closeModal);
contactModal.addEventListener("click", (e) => {
  if (e.target === contactModal) closeModal();
});

// ---------- #13 Histórico de interações ----------
function renderHistorico() {
  historicoList.innerHTML = "";
  if (!currentHistorico.length) {
    const p = document.createElement("p");
    p.className = "historico-empty";
    p.textContent = "Nenhuma interação registrada ainda.";
    historicoList.appendChild(p);
    return;
  }
  for (const entry of [...currentHistorico].reverse()) {
    const div = document.createElement("div");
    div.className = "historico-entry";
    const dateSpan = document.createElement("span");
    dateSpan.className = "historico-date";
    dateSpan.textContent = formatDate(entry.data);
    const textoSpan = document.createElement("span");
    textoSpan.className = "historico-texto";
    textoSpan.textContent = entry.texto;
    div.appendChild(dateSpan);
    div.appendChild(textoSpan);
    historicoList.appendChild(div);
  }
}

historicoAddBtn.addEventListener("click", () => {
  const texto = historicoInput.value.trim();
  if (!texto) return;
  currentHistorico.push({ data: new Date().toISOString().slice(0, 10), texto });
  historicoInput.value = "";
  renderHistorico();
});

historicoInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    historicoAddBtn.click();
  }
});

// ---------- Salvar ----------
contactForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    empresa: fieldEmpresa.value.trim(),
    setor: fieldSetor.value.trim(),
    nome: fieldNome.value.trim(),
    cargo: fieldCargo.value.trim(),
    email: fieldEmail.value.trim(),
    telefone: fieldTelefone.value.trim(),
    linkedin: fieldLinkedin.value.trim(),
    data: fieldData.value,
    status: fieldStatus.value,
    proximoPasso: fieldProximoPasso.value.trim(),
    notas: fieldNotas.value.trim(),
    acompanhamento: fieldAcompanhamento.value,
    historico: currentHistorico,
  };

  const id = fieldId.value;
  if (id) {
    await updateDoc(doc(db, CONTACTS_COLLECTION, id), payload);
  } else {
    await addDoc(collection(db, CONTACTS_COLLECTION), payload);
  }
  closeModal();
  showToast("Contato salvo com sucesso.");
});

// ---------- #10 Excluir com modal de confirmação ----------
deleteContactBtn.addEventListener("click", () => {
  pendingDeleteId = fieldId.value;
  if (!pendingDeleteId) return;
  deleteConfirmModal.classList.remove("hidden");
});

deleteCancelBtn.addEventListener("click", () => {
  deleteConfirmModal.classList.add("hidden");
  pendingDeleteId = null;
});

deleteConfirmBtn.addEventListener("click", async () => {
  if (!pendingDeleteId) return;
  await deleteDoc(doc(db, CONTACTS_COLLECTION, pendingDeleteId));
  deleteConfirmModal.classList.add("hidden");
  pendingDeleteId = null;
  closeModal();
  showToast("Contato excluído.", "error");
});

deleteConfirmModal.addEventListener("click", (e) => {
  if (e.target === deleteConfirmModal) {
    deleteConfirmModal.classList.add("hidden");
    pendingDeleteId = null;
  }
});

// ---------- Aviso de acompanhamentos vencidos ----------
function checkOverdueFollowups() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const overdue = allContacts.filter(
    (c) =>
      c.acompanhamento &&
      c.acompanhamento <= todayStr &&
      c.acompanhamentoDismissedDate !== c.acompanhamento
  );
  if (overdue.length === 0) return;
  renderFollowupAlert(overdue);
}

function renderFollowupAlert(overdueContacts) {
  followupAlertList.innerHTML = "";
  for (const c of overdueContacts) {
    const li = document.createElement("li");
    li.className = "followup-alert-item";
    li.innerHTML = `
      <div class="followup-alert-info">
        <strong>${escapeHtml(c.empresa)}</strong>
        <span>${escapeHtml(c.nome)} · ${escapeHtml(formatDate(c.acompanhamento))}</span>
      </div>
      <div class="followup-alert-actions">
        <button type="button" class="btn-primary followup-view-btn">Ver contato</button>
        <button type="button" class="btn-secondary followup-ignore-btn">Deixar passar</button>
      </div>
    `;
    li.querySelector(".followup-view-btn").addEventListener("click", async () => {
      await dismissFollowup(c);
      followupAlertModal.classList.add("hidden");
      openModal(c);
    });
    li.querySelector(".followup-ignore-btn").addEventListener("click", async () => {
      await dismissFollowup(c);
      li.remove();
      if (!followupAlertList.children.length) {
        followupAlertModal.classList.add("hidden");
      }
    });
    followupAlertList.appendChild(li);
  }
  followupAlertModal.classList.remove("hidden");
}

async function dismissFollowup(contact) {
  await updateDoc(doc(db, CONTACTS_COLLECTION, contact.id), {
    acompanhamentoDismissedDate: contact.acompanhamento,
  });
}

followupAlertCloseBtn.addEventListener("click", () => {
  followupAlertModal.classList.add("hidden");
});
followupAlertModal.addEventListener("click", (e) => {
  if (e.target === followupAlertModal) followupAlertModal.classList.add("hidden");
});

// ---------- Atalho Escape para fechar modais ----------
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!deleteConfirmModal.classList.contains("hidden")) {
    deleteConfirmModal.classList.add("hidden");
    pendingDeleteId = null;
  } else if (!contactModal.classList.contains("hidden")) {
    closeModal();
  } else if (!followupAlertModal.classList.contains("hidden")) {
    followupAlertModal.classList.add("hidden");
  }
});
