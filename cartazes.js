import { db } from "./firebase-config.js";
import { exigirLogin, sair } from "./auth.js";
import { initPerfil } from "./perfil.js";
import { aplicarModoVisitante } from "./visitante.js";
import { iniciarMenuMais } from "./menu-mais.js";
import { confirmarExclusao } from "./confirm.js";
import { baixarImagem } from "./baixar.js";
import { registrarAtividade } from "./atividade.js";
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

iniciarMenuMais();
exigirLogin((usuario) => {
  usuarioAtual = usuario;
  initPerfil(usuario);
  aplicarModoVisitante(usuario);
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

function formatarDataRelativa(timestamp) {
  if (!timestamp) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = timestamp.toDate();
  alvo.setHours(0, 0, 0, 0);
  const diffDias = Math.round((alvo - hoje) / (1000 * 60 * 60 * 24));

  if (diffDias === 0) return { texto: "hoje", urgente: true };
  if (diffDias === 1) return { texto: "amanhã", urgente: false };
  if (diffDias === -1) return { texto: "atrasado há 1 dia", urgente: true };
  if (diffDias < -1) return { texto: `atrasado há ${Math.abs(diffDias)} dias`, urgente: true };
  if (diffDias > 1 && diffDias <= 6) return { texto: `em ${diffDias} dias`, urgente: false };
  return { texto: formatarDataCurta(timestamp), urgente: false };
}

function estaAtrasado(c) {
  if (c.status === "postado" || !c.lembreteData) return false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return c.lembreteData.toDate() < hoje;
}

function renderCartazes(docsOriginais) {
  listaCartazes.innerHTML = "";
  cartazesCache.clear();
  emptyState.style.display = docsOriginais.length === 0 ? "block" : "none";

  // Ordena por urgência: atrasados primeiro, depois por data de lembrete mais próxima,
  // sem lembrete no meio, e os já postados sempre no final.
  const docs = [...docsOriginais].sort((a, b) => {
    const ca = a.data(), cb = b.data();
    const aPostado = ca.status === "postado", bPostado = cb.status === "postado";
    if (aPostado !== bPostado) return aPostado ? 1 : -1;

    const aAtrasado = estaAtrasado(ca), bAtrasado = estaAtrasado(cb);
    if (aAtrasado !== bAtrasado) return aAtrasado ? -1 : 1;

    if (ca.lembreteData && cb.lembreteData) return ca.lembreteData.toMillis() - cb.lembreteData.toMillis();
    if (ca.lembreteData) return -1;
    if (cb.lembreteData) return 1;
    return 0;
  });

  let totalAtrasados = 0, totalPostados = 0;

  docs.forEach((docSnap, index) => {
    const c = docSnap.data();
    const id = docSnap.id;
    cartazesCache.set(id, c);
    const isPostado = c.status === "postado";
    const atrasado = estaAtrasado(c);
    if (atrasado) totalAtrasados++;
    if (isPostado) totalPostados++;

    const relativa = formatarDataRelativa(c.lembreteData);

    const card = document.createElement("div");
    card.className = `cartaz-card ${atrasado ? "atrasado" : ""}`;
    card.style.animationDelay = `${index * 0.04}s`;
    card.innerHTML = `
      <div class="cartaz-thumb carregando">
        <img src="${escapeHtml(c.link)}" alt="" onload="this.parentElement.classList.remove('carregando')" onerror="this.parentElement.textContent='🖼️'; this.parentElement.classList.remove('carregando')">
      </div>
      <div class="cartaz-body">
        ${atrasado ? `<div class="cartaz-atrasado-tag">⚠️ ATRASADO</div>` : ""}
        <div class="cartaz-titulo">${escapeHtml(c.titulo)}</div>
        ${c.lembreteTexto ? `<div class="cartaz-lembrete ${relativa?.urgente ? "urgente" : ""}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px; margin-right:3px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${escapeHtml(c.lembreteTexto)}${relativa ? " · " + relativa.texto : ""}</div>` : ""}
        <div class="cartaz-actions">
          <div class="tally ${isPostado ? "postado" : "pendente"}" style="margin-right:2px;"></div>
          <button class="btn btn-icone" data-baixar="${escapeHtml(c.link)}" data-nome="${escapeHtml(c.titulo)}" title="Baixar imagem">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>
          </button>
          ${isPostado
            ? `<button class="btn btn-undo" data-id="${id}" data-action="desmarcar">Desmarcar</button>`
            : `<button class="btn btn-mark" data-id="${id}" data-action="marcar"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Postado</button>`
          }
          <button class="btn" data-id="${id}" data-action="editar"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg> Editar</button>
          <button class="btn btn-excluir" data-id="${id}" data-action="excluir" title="Excluir">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </div>
    `;
    listaCartazes.appendChild(card);
  });

  document.getElementById("totalCartazes").textContent = docs.length;
  document.getElementById("totalAtrasados").textContent = totalAtrasados;
  document.getElementById("totalPostadosCartaz").textContent = totalPostados;

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
  const tituloCartaz = cartazesCache.get(id)?.titulo || "um cartaz";
  if (action === "marcar") {
    await updateDoc(ref, {
      status: "postado",
      postadoPor: usuarioAtual.nome,
      postadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp()
    });
    registrarAtividade(usuarioAtual, `postou o cartaz "${tituloCartaz}" ✅`);
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
