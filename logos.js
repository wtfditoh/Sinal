import { db } from "./firebase-config.js";
import { exigirLogin, sair } from "./auth.js";
import { initPerfil } from "./perfil.js";
import { confirmarExclusao } from "./confirm.js";
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let usuarioAtual = null;
let logosCache = new Map();
let termoBusca = "";

const listaLogos = document.getElementById("listaLogos");
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
  carregarLogos();
});

document.getElementById("logoutBtn").addEventListener("click", sair);

document.getElementById("buscaInput").addEventListener("input", (e) => {
  termoBusca = e.target.value.trim().toLowerCase();
  renderLogos();
});

function carregarLogos() {
  const q = query(collection(db, "logos"), orderBy("departamento", "asc"));
  onSnapshot(q, (snapshot) => {
    logosCache.clear();
    snapshot.docs.forEach((docSnap) => logosCache.set(docSnap.id, docSnap.data()));
    renderLogos();
  }, (erro) => console.error("Erro ao carregar logos:", erro));
}

function renderLogos() {
  listaLogos.innerHTML = "";

  const itens = [...logosCache.entries()].filter(([id, l]) =>
    !termoBusca || l.departamento.toLowerCase().includes(termoBusca)
  );

  emptyState.style.display = itens.length === 0 ? "block" : "none";

  itens.forEach(([id, l], index) => {
    const card = document.createElement("div");
    card.className = "cartaz-card";
    card.style.animationDelay = `${index * 0.03}s`;
    card.innerHTML = `
      <div class="cartaz-thumb">
        <img src="${escapeHtml(l.link)}" alt="" onerror="this.parentElement.textContent='🏷️'">
      </div>
      <div class="cartaz-body">
        <div class="cartaz-titulo">${escapeHtml(l.departamento)}</div>
        <a href="${escapeHtml(l.link)}" target="_blank" rel="noopener" class="cartaz-link">Abrir imagem ↗</a>
        <div class="cartaz-actions">
          <button class="btn" data-id="${id}" data-action="editar">Editar</button>
          <button class="btn btn-excluir" data-id="${id}" data-action="excluir">🗑</button>
        </div>
      </div>
    `;
    listaLogos.appendChild(card);
  });

  listaLogos.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const acao = btn.dataset.action;
      const id = btn.dataset.id;
      if (acao === "editar") abrirModalEdicao(id);
      else if (acao === "excluir") excluirLogo(id);
    });
  });
}

async function excluirLogo(id) {
  const confirmar = await confirmarExclusao("Excluir essa logo?");
  if (!confirmar) return;
  await deleteDoc(doc(db, "logos", id));
}

// ---------- Modal ----------
const modalOverlay = document.getElementById("modalOverlay");
const logoForm = document.getElementById("logoForm");
const modalTitle = document.getElementById("logoModalTitle");
const submitBtn = document.getElementById("logoSubmitBtn");
const linkInput = document.getElementById("lLink");
const previewBox = document.getElementById("logoPreviewBox");
const previewImg = document.getElementById("logoPreviewImg");
let editandoId = null;

linkInput.addEventListener("input", () => {
  const url = linkInput.value.trim();
  if (url) {
    previewImg.src = url;
    previewBox.style.display = "block";
  } else {
    previewBox.style.display = "none";
  }
});
previewImg.addEventListener("error", () => { previewBox.style.display = "none"; });

document.getElementById("addBtn").addEventListener("click", () => {
  editandoId = null;
  modalTitle.textContent = "Nova logo";
  submitBtn.textContent = "Salvar";
  logoForm.reset();
  previewBox.style.display = "none";
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
  const l = logosCache.get(id);
  if (!l) return;
  editandoId = id;
  modalTitle.textContent = "Editar logo";
  submitBtn.textContent = "Salvar alterações";
  document.getElementById("lDepartamento").value = l.departamento || "";
  document.getElementById("lLink").value = l.link || "";
  if (l.link) {
    previewImg.src = l.link;
    previewBox.style.display = "block";
  }
  modalOverlay.classList.add("active");
}

logoForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    departamento: document.getElementById("lDepartamento").value,
    link: document.getElementById("lLink").value,
    atualizadoEm: serverTimestamp()
  };

  if (editandoId) {
    await updateDoc(doc(db, "logos", editandoId), payload);
  } else {
    await addDoc(collection(db, "logos"), {
      ...payload,
      criadoPor: usuarioAtual.uid,
      criadoEm: serverTimestamp()
    });
  }

  logoForm.reset();
  fecharModal();
});
