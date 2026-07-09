import { db } from "./firebase-config.js";
import { exigirLogin, sair } from "./auth.js";
import { initPerfil } from "./perfil.js";
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp, Timestamp,
  getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

let usuarioAtual = null;
let mesAtual = new Date();
mesAtual.setDate(1);
let editandoId = null; // null = criando novo culto; senão, id do culto sendo editado
let cultosCache = new Map(); // id -> dados, usado pra preencher o modal de edição

const listaCultos = document.getElementById("listaCultos");
const emptyState = document.getElementById("emptyState");
const monthLabel = document.getElementById("monthLabel");

// ---------- Sessão ----------
exigirLogin((usuario) => {
  usuarioAtual = usuario;
  initPerfil(usuario);
  carregarCultosDoMes();
  checarNotificacoes();
});

document.getElementById("logoutBtn").addEventListener("click", sair);

// ---------- Navegação de mês ----------
document.getElementById("prevMonth").addEventListener("click", () => {
  mesAtual.setMonth(mesAtual.getMonth() - 1);
  carregarCultosDoMes();
});
document.getElementById("nextMonth").addEventListener("click", () => {
  mesAtual.setMonth(mesAtual.getMonth() + 1);
  carregarCultosDoMes();
});

function atualizarLabelMes() {
  monthLabel.textContent = `${MESES[mesAtual.getMonth()]} ${mesAtual.getFullYear()}`;
}

// ---------- Segurança básica de exibição (evita HTML quebrado com texto livre) ----------
function escapeHtml(texto) {
  if (!texto) return "";
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

// ---------- Carregar cultos do mês (tempo real) ----------
let unsubscribe = null;

function carregarCultosDoMes() {
  atualizarLabelMes();

  const inicio = new Date(mesAtual.getFullYear(), mesAtual.getMonth(), 1);
  const fim = new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 1);

  const q = query(
    collection(db, "cultos"),
    where("data", ">=", Timestamp.fromDate(inicio)),
    where("data", "<", Timestamp.fromDate(fim)),
    orderBy("data", "asc")
  );

  if (unsubscribe) unsubscribe();
  unsubscribe = onSnapshot(q, (snapshot) => {
    renderCultos(snapshot.docs);
  }, (erro) => {
    console.error("Erro ao carregar cultos:", erro);
  });
}

function formatarData(timestamp) {
  const d = timestamp.toDate();
  const dias = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  return `${dias[d.getDay()]}, ${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`;
}

function formatarDataInput(timestamp) {
  const d = timestamp.toDate();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function renderCultos(docs) {
  listaCultos.innerHTML = "";
  cultosCache.clear();

  if (docs.length === 0) {
    emptyState.style.display = "block";
  } else {
    emptyState.style.display = "none";
  }

  let postados = 0, pendentes = 0;

  docs.forEach((docSnap, index) => {
    const c = docSnap.data();
    const id = docSnap.id;
    cultosCache.set(id, c);
    const isPostado = c.status === "postado";
    if (isPostado) postados++; else pendentes++;

    const card = document.createElement("div");
    card.className = "culto-card";
    card.style.animationDelay = `${index * 0.05}s`;
    card.innerHTML = `
      <div class="culto-top">
        <div class="tally ${isPostado ? "postado" : "pendente"}"></div>
        <div class="culto-data">${formatarData(c.data)}</div>
        <div class="culto-status-label ${isPostado ? "postado" : "pendente"}">
          ${isPostado ? "postado" : "pendente"}
        </div>
      </div>
      <div class="culto-tipo">${escapeHtml(c.tipo) || "Culto"}</div>
      ${c.tema ? `<div class="culto-tema">📌 ${escapeHtml(c.tema)}</div>` : ""}
      ${c.versiculo
        ? `<div class="culto-versiculo">"${escapeHtml(c.versiculo)}"</div>`
        : `<div class="culto-versiculo culto-versiculo-vazio">Versículo da pregação ainda não adicionado</div>`
      }
      <div class="culto-actions">
        ${isPostado
          ? `<button class="btn btn-undo" data-id="${id}" data-action="desmarcar">Desmarcar</button>`
          : `<button class="btn btn-mark" data-id="${id}" data-action="marcar">✓ Marcar como postado</button>`
        }
        <button class="btn" data-id="${id}" data-action="editar">Editar</button>
        <button class="btn btn-excluir" data-id="${id}" data-action="excluir">🗑</button>
      </div>
      ${isPostado ? `<div class="culto-postado-por">postado por ${escapeHtml(c.postadoPor) || "—"}</div>` : ""}
    `;
    listaCultos.appendChild(card);
  });

  document.getElementById("totalCultos").textContent = docs.length;
  document.getElementById("totalPostados").textContent = postados;
  document.getElementById("totalPendentes").textContent = pendentes;

  const progressFill = document.getElementById("progressFill");
  if (progressFill) {
    const pct = docs.length ? Math.round((postados / docs.length) * 100) : 0;
    progressFill.style.width = `${pct}%`;
  }

  listaCultos.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const acao = btn.dataset.action;
      const id = btn.dataset.id;
      if (acao === "marcar" || acao === "desmarcar") toggleStatus(id, acao);
      else if (acao === "editar") abrirModalEdicao(id);
      else if (acao === "excluir") excluirCulto(id);
    });
  });
}

async function toggleStatus(id, action) {
  const ref = doc(db, "cultos", id);
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

async function excluirCulto(id) {
  const c = cultosCache.get(id);
  const confirmar = window.confirm(
    `Excluir o culto "${c?.tipo || "sem nome"}" de ${c ? formatarData(c.data) : ""}?\n\nEssa ação não pode ser desfeita.`
  );
  if (!confirmar) return;
  await deleteDoc(doc(db, "cultos", id));
}

// ---------- Modal: criar/editar culto ----------
const modalOverlay = document.getElementById("modalOverlay");
const cultoForm = document.getElementById("cultoForm");
const modalTitle = document.querySelector(".modal-title");
const submitBtn = cultoForm.querySelector("button[type=submit]");

document.getElementById("addBtn").addEventListener("click", () => {
  abrirModalCriacao();
});
document.getElementById("cancelBtn").addEventListener("click", fecharModal);
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) fecharModal();
});

function abrirModalCriacao() {
  editandoId = null;
  modalTitle.textContent = "Novo culto";
  submitBtn.textContent = "Salvar culto";
  cultoForm.reset();
  modalOverlay.classList.add("active");
}

function abrirModalEdicao(id) {
  const c = cultosCache.get(id);
  if (!c) return;
  editandoId = id;
  modalTitle.textContent = "Editar culto";
  submitBtn.textContent = "Salvar alterações";
  document.getElementById("cData").value = formatarDataInput(c.data);
  document.getElementById("cTipo").value = c.tipo || "";
  document.getElementById("cTema").value = c.tema || "";
  document.getElementById("cVersiculo").value = c.versiculo || "";
  modalOverlay.classList.add("active");
}

function fecharModal() {
  modalOverlay.classList.remove("active");
  editandoId = null;
}

cultoForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const dataInput = document.getElementById("cData").value; // yyyy-mm-dd
  const [ano, mes, dia] = dataInput.split("-").map(Number);
  const dataCulto = new Date(ano, mes - 1, dia, 12, 0); // meio-dia evita fuso

  const payload = {
    data: Timestamp.fromDate(dataCulto),
    tipo: document.getElementById("cTipo").value,
    tema: document.getElementById("cTema").value,
    versiculo: document.getElementById("cVersiculo").value,
    atualizadoEm: serverTimestamp()
  };

  if (editandoId) {
    await updateDoc(doc(db, "cultos", editandoId), payload);
  } else {
    await addDoc(collection(db, "cultos"), {
      ...payload,
      status: "pendente",
      postadoPor: null,
      postadoEm: null,
      criadoPor: usuarioAtual.uid
    });
  }

  cultoForm.reset();
  fecharModal();
});

// ---------- Notificações (bolinha vermelha) ----------
// Compara a última atualização de cada coleção com a última visita do usuário.
async function checarNotificacoes() {
  const visitaRef = doc(db, "visitas", usuarioAtual.uid);
  const visitaSnap = await getDoc(visitaRef);
  const visitas = visitaSnap.exists() ? visitaSnap.data() : {};

  checarColecao("escalas", visitas.ultimaVisitaEscalas, "dotEscala");
  checarColecao("cartazes", visitas.ultimaVisitaCartazes, "dotCartazes");

  // Marca a visita ao dashboard como agora (não bloqueante)
  setDoc(visitaRef, { ultimaVisitaDashboard: serverTimestamp() }, { merge: true });
}

function checarColecao(nomeColecao, ultimaVisita, idBolinha) {
  const q = query(collection(db, nomeColecao), orderBy("atualizadoEm", "desc"));
  onSnapshot(q, (snapshot) => {
    if (snapshot.empty) return;
    const maisRecente = snapshot.docs[0].data().atualizadoEm;
    const bolinha = document.getElementById(idBolinha);
    if (!bolinha) return;
    if (!ultimaVisita || (maisRecente && maisRecente.toMillis() > ultimaVisita.toMillis())) {
      bolinha.classList.add("active");
    } else {
      bolinha.classList.remove("active");
    }
  }, (erro) => {
    console.error(`Erro ao checar notificações de ${nomeColecao}:`, erro);
  });
}
