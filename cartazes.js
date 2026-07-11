import { db } from "./firebase-config.js";
import { exigirLogin, sair } from "./auth.js";
import { initPerfil } from "./perfil.js";
import { confirmarExclusao } from "./confirm.js";
import { baixarImagem } from "./baixar.js";
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp, Timestamp,
  setDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let usuarioAtual = null;
let cartazesCache = new Map();

const listaCartazes = document.getElementById("listaCartazes");
const emptyState = document.getElementById("emptyState");

function escapeHtml(texto) {
  if (!texto) return "";
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

exigirLogin((usuario) => {
  usuarioAtual = usuario;
  initPerfil(usuario);
  carregarCartazes();
  marcarVisita();
});

document.getElementById("logoutBtn").addEventListener("click", sair);

let unsubscribe = null;

function carregarCartazes() {
  const q = query(collection(db, "cartazes"), orderBy("criadoEm", "desc"));
  if (unsubscribe) unsubscribe();
  unsubscribe = onSnapshot(q, (snapshot) => {
    renderCartazes(snapshot.docs);
  }, (erro) => console.error("Erro ao carregar cartazes:", erro));
}

function formatarDataCurta(timestamp) {
  if (!timestamp) return "";
  const d = timestamp.toDate();
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`;
}

function renderCartazes(docs) {
  listaCartazes.innerHTML = "";
  cartazesCache.clear();
  emptyState.style.display = docs.length === 0 ? "block" : "none";

  docs.forEach((docSnap, index) => {
    const c = docSnap.data();
    const id = docSnap.id;
    cartazesCache.set(id, c);
    const isPostado = c.status === "postado";

    const card = document.createElement("div");
    card.className = "cartaz-card";
    card.style.animationDelay = `${index * 0.04}s`;
    card.innerHTML = `
      <div class="cartaz-thumb">
        <img src="${escapeHtml(c.link)}" alt="" onerror="this.parentElement.textContent='🖼️'">
      </div>
      <div class="cartaz-body">
        <div class="cartaz-titulo">${escapeHtml(c.titulo)}</div>
        ${c.lembreteTexto ? `<div class="cartaz-lembrete">⏰ ${escapeHtml(c.lembreteTexto)}${c.lembreteData ? " · " + formatarDataCurta(c.lembreteData) : ""}</div>` : ""}
        <button class="cartaz-link" data-baixar="${escapeHtml(c.link)}" data-nome="${escapeHtml(c.titulo)}">⬇ Baixar imagem</button>
        <div class="cartaz-actions">
          <div class="tally ${isPostado ? "postado" : "pendente"}" style="margin-right:2px;"></div>
          ${isPostado
            ? `<button class="btn btn-undo" data-id="${id}" data-action="desmarcar">Desmarcar</button>`
            : `<button class="btn btn-mark" data-id="${id}" data-action="marcar">✓ Postado</button>`
          }
          <button class="btn" data-id="${id}" data-action="editar">Editar</button>
          <button class="btn btn-excluir" data-id="${id}" data-action="excluir">🗑</button>
        </div>
      </div>
    `;
    listaCartazes.appendChild(card);
  });

  listaCartazes.querySelectorAll("[data-baixar]").forEach((btn) => {
    btn.addEventListener("click", () => baixarImagem(btn.dataset.baixar, btn.dataset.nome, btn));
  });

  listaCartazes.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const acao = btn.dataset.action;
      const id = btn.dataset.id;
      if (acao === "marcar" || acao === "desmarcar") toggleStatus(id, acao);
      else if (acao === "editar") abrirModalEdicao(id);
      else if (acao === "excluir") excluirCartaz(id);
    });
  });
}

async function toggleStatus(id, action) {
  const ref = doc(db, "cartazes", id);
  if (action === "marcar") {
    await updateDoc(ref, {
      status: "postado",
      postadoPor: usuarioAtual.nome,
      postadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp()
    });
  } else {
    await updateDoc(ref, {
      status: "pendente",
      postadoPor: null,
      postadoEm: null,
      atualizadoEm: serverTimestamp()
    });
  }
}

async function excluirCartaz(id) {
  const confirmar = await confirmarExclusao("Excluir esse cartaz? Essa ação não pode ser desfeita.");
  if (!confirmar) return;
  await deleteDoc(doc(db, "cartazes", id));
}

// ---------- Modal ----------
const modalOverlay = document.getElementById("modalOverlay");
const cartazForm = document.getElementById("cartazForm");
const modalTitle = document.getElementById("cartazModalTitle");
const submitBtn = document.getElementById("cartazSubmitBtn");
const linkInput = document.getElementById("pLink");
const linkPreviewBox = document.getElementById("linkPreviewBox");
const linkPreviewImg = document.getElementById("linkPreviewImg");
let editandoId = null;

linkInput.addEventListener("input", () => {
  const url = linkInput.value.trim();
  if (url) {
    linkPreviewImg.src = url;
    linkPreviewBox.style.display = "block";
  } else {
    linkPreviewBox.style.display = "none";
  }
});
linkPreviewImg.addEventListener("error", () => {
  linkPreviewBox.style.display = "none";
});

document.getElementById("addBtn").addEventListener("click", () => {
  editandoId = null;
  modalTitle.textContent = "Novo cartaz";
  submitBtn.textContent = "Salvar";
  cartazForm.reset();
  linkPreviewBox.style.display = "none";
  modalOverlay.classList.add("active");
});
document.getElementById("cancelBtn").addEventListener("click", fecharModal);
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) fecharModal();
});

function fecharModal() {
  modalOverlay.classList.remove("active");
  editandoId = null;
}

function abrirModalEdicao(id) {
  const c = cartazesCache.get(id);
  if (!c) return;
  editandoId = id;
  modalTitle.textContent = "Editar cartaz";
  submitBtn.textContent = "Salvar alterações";
  document.getElementById("pTitulo").value = c.titulo || "";
  document.getElementById("pLink").value = c.link || "";
  document.getElementById("pLembreteTexto").value = c.lembreteTexto || "";
  if (c.link) {
    linkPreviewImg.src = c.link;
    linkPreviewBox.style.display = "block";
  } else {
    linkPreviewBox.style.display = "none";
  }
  if (c.lembreteData) {
    const d = c.lembreteData.toDate();
    document.getElementById("pLembreteData").value =
      `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  } else {
    document.getElementById("pLembreteData").value = "";
  }
  modalOverlay.classList.add("active");
}

cartazForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const lembreteDataInput = document.getElementById("pLembreteData").value;
  let lembreteData = null;
  if (lembreteDataInput) {
    const [ano, mes, dia] = lembreteDataInput.split("-").map(Number);
    lembreteData = Timestamp.fromDate(new Date(ano, mes - 1, dia, 12, 0));
  }

  const payload = {
    titulo: document.getElementById("pTitulo").value,
    link: document.getElementById("pLink").value,
    lembreteTexto: document.getElementById("pLembreteTexto").value,
    lembreteData,
    atualizadoEm: serverTimestamp()
  };

  if (editandoId) {
    await updateDoc(doc(db, "cartazes", editandoId), payload);
  } else {
    await addDoc(collection(db, "cartazes"), {
      ...payload,
      status: "pendente",
      postadoPor: null,
      postadoEm: null,
      criadoPor: usuarioAtual.uid,
      criadoEm: serverTimestamp()
    });
  }

  cartazForm.reset();
  fecharModal();
});

// ---------- Marca visita e checa notificação de escala ----------
async function marcarVisita() {
  const visitaRef = doc(db, "visitas", usuarioAtual.uid);
  await setDoc(visitaRef, { ultimaVisitaCartazes: serverTimestamp() }, { merge: true });

  const visitaSnap = await getDoc(visitaRef);
  const visitas = visitaSnap.exists() ? visitaSnap.data() : {};
  const q = query(collection(db, "escalas"), orderBy("atualizadoEm", "desc"));
  onSnapshot(q, (snapshot) => {
    if (snapshot.empty) return;
    const maisRecente = snapshot.docs[0].data().atualizadoEm;
    const bolinha = document.getElementById("dotEscala");
    if (!bolinha) return;
    if (!visitas.ultimaVisitaEscalas || (maisRecente && maisRecente.toMillis() > visitas.ultimaVisitaEscalas.toMillis())) {
      bolinha.classList.add("active");
    } else {
      bolinha.classList.remove("active");
    }
  });
}
