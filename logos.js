import { db } from "./firebase-config.js";
import { exigirLogin, sair } from "./auth.js";
import { initPerfil } from "./perfil.js";
import { aplicarModoVisitante } from "./visitante.js";
import { confirmarExclusao } from "./confirm.js";
import { baixarImagem } from "./baixar.js";
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let usuarioAtual = null;
let logosCache = new Map();
let senhasCache = new Map();
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
  aplicarModoVisitante(usuario);
  carregarLogos();
  carregarSenhas();
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
        <button class="cartaz-link" data-baixar="${escapeHtml(l.link)}" data-nome="${escapeHtml(l.departamento)}">⬇ Baixar imagem</button>
        <div class="cartaz-actions">
          <button class="btn" data-id="${id}" data-action="editar">Editar</button>
          <button class="btn btn-excluir" data-id="${id}" data-action="excluir">🗑</button>
        </div>
      </div>
    `;
    listaLogos.appendChild(card);
  });

  listaLogos.querySelectorAll("[data-baixar]").forEach((btn) => {
    btn.addEventListener("click", () => baixarImagem(btn.dataset.baixar, btn.dataset.nome, btn));
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
  if (abaAtiva === "senhas") {
    abrirModalNovaSenha();
    return;
  }
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

// ---------- Sub-abas: Logos / Senhas ----------
let abaAtiva = "logos";
const tabLogos = document.getElementById("tabLogos");
const tabSenhas = document.getElementById("tabSenhas");
const painelLogos = document.getElementById("painelLogos");
const painelSenhas = document.getElementById("painelSenhas");
const addBtnEl = document.getElementById("addBtn");

tabLogos.addEventListener("click", () => {
  abaAtiva = "logos";
  tabLogos.classList.add("active");
  tabSenhas.classList.remove("active");
  painelLogos.style.display = "block";
  painelSenhas.style.display = "none";
  addBtnEl.title = "Nova logo";
});
tabSenhas.addEventListener("click", () => {
  abaAtiva = "senhas";
  tabSenhas.classList.add("active");
  tabLogos.classList.remove("active");
  painelLogos.style.display = "none";
  painelSenhas.style.display = "block";
  addBtnEl.title = "Nova senha";
});

// ---------- Senhas da igreja ----------
const listaSenhas = document.getElementById("listaSenhas");
const emptyStateSenhas = document.getElementById("emptyStateSenhas");

function carregarSenhas() {
  const q = query(collection(db, "senhas"), orderBy("servico", "asc"));
  onSnapshot(q, (snapshot) => {
    senhasCache.clear();
    snapshot.docs.forEach((docSnap) => senhasCache.set(docSnap.id, docSnap.data()));
    renderSenhas();
  }, (erro) => console.error("Erro ao carregar senhas:", erro));
}

function renderSenhas() {
  listaSenhas.innerHTML = "";
  emptyStateSenhas.style.display = senhasCache.size === 0 ? "block" : "none";

  [...senhasCache.entries()].forEach(([id, s], index) => {
    const card = document.createElement("div");
    card.className = "senha-card";
    card.style.animationDelay = `${index * 0.03}s`;
    card.innerHTML = `
      <div class="senha-servico">${escapeHtml(s.servico)}</div>
      ${s.usuario ? `
        <div class="senha-linha">
          <span>👤 ${escapeHtml(s.usuario)}</span>
          <button class="senha-copiar" data-copiar="${escapeHtml(s.usuario)}">copiar</button>
        </div>` : ""}
      <div class="senha-linha">
        <span>🔑 ${escapeHtml(s.senha)}</span>
        <button class="senha-copiar" data-copiar="${escapeHtml(s.senha)}">copiar</button>
      </div>
      ${s.observacao ? `<div class="senha-obs">${escapeHtml(s.observacao)}</div>` : ""}
      <div class="senha-actions">
        <button class="btn" data-id="${id}" data-action="editar">Editar</button>
        <button class="btn btn-excluir" data-id="${id}" data-action="excluir">🗑</button>
      </div>
    `;
    listaSenhas.appendChild(card);
  });

  listaSenhas.querySelectorAll("[data-copiar]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copiar);
        const original = btn.textContent;
        btn.textContent = "copiado!";
        setTimeout(() => { btn.textContent = original; }, 1500);
      } catch (e) { /* ignora */ }
    });
  });

  listaSenhas.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const acao = btn.dataset.action;
      const id = btn.dataset.id;
      if (acao === "editar") abrirModalEdicaoSenha(id);
      else if (acao === "excluir") excluirSenha(id);
    });
  });
}

async function excluirSenha(id) {
  const confirmar = await confirmarExclusao("Excluir essa senha?");
  if (!confirmar) return;
  await deleteDoc(doc(db, "senhas", id));
}

// ---------- Modal de senha ----------
const senhaModalOverlay = document.getElementById("senhaModalOverlay");
const senhaForm = document.getElementById("senhaForm");
const senhaModalTitle = document.getElementById("senhaModalTitle");
const senhaSubmitBtn = document.getElementById("senhaSubmitBtn");
let editandoSenhaId = null;

function abrirModalNovaSenha() {
  editandoSenhaId = null;
  senhaModalTitle.textContent = "Nova senha";
  senhaSubmitBtn.textContent = "Salvar";
  senhaForm.reset();
  senhaModalOverlay.classList.add("active");
}

function abrirModalEdicaoSenha(id) {
  const s = senhasCache.get(id);
  if (!s) return;
  editandoSenhaId = id;
  senhaModalTitle.textContent = "Editar senha";
  senhaSubmitBtn.textContent = "Salvar alterações";
  document.getElementById("szServico").value = s.servico || "";
  document.getElementById("szUsuario").value = s.usuario || "";
  document.getElementById("szSenha").value = s.senha || "";
  document.getElementById("szObs").value = s.observacao || "";
  senhaModalOverlay.classList.add("active");
}

document.getElementById("senhaCancelBtn").addEventListener("click", () => {
  senhaModalOverlay.classList.remove("active");
});
senhaModalOverlay.addEventListener("click", (e) => {
  if (e.target === senhaModalOverlay) senhaModalOverlay.classList.remove("active");
});

senhaForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    servico: document.getElementById("szServico").value,
    usuario: document.getElementById("szUsuario").value,
    senha: document.getElementById("szSenha").value,
    observacao: document.getElementById("szObs").value,
    atualizadoEm: serverTimestamp()
  };

  if (editandoSenhaId) {
    await updateDoc(doc(db, "senhas", editandoSenhaId), payload);
  } else {
    await addDoc(collection(db, "senhas"), {
      ...payload,
      criadoPor: usuarioAtual.uid,
      criadoEm: serverTimestamp()
    });
  }

  senhaForm.reset();
  senhaModalOverlay.classList.remove("active");
});
