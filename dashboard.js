import { db } from "./firebase-config.js";
import { exigirLogin, sair } from "./auth.js";
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, doc, serverTimestamp, Timestamp,
  getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

let usuarioAtual = null;
let mesAtual = new Date();
mesAtual.setDate(1);

const listaCultos = document.getElementById("listaCultos");
const emptyState = document.getElementById("emptyState");
const monthLabel = document.getElementById("monthLabel");

// ---------- Sessão ----------
exigirLogin((usuario) => {
  usuarioAtual = usuario;
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
  });
}

function formatarData(timestamp) {
  const d = timestamp.toDate();
  const dias = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  return `${dias[d.getDay()]}, ${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`;
}

function renderCultos(docs) {
  listaCultos.innerHTML = "";

  if (docs.length === 0) {
    emptyState.style.display = "block";
  } else {
    emptyState.style.display = "none";
  }

  let postados = 0, pendentes = 0;

  docs.forEach((docSnap) => {
    const c = docSnap.data();
    const id = docSnap.id;
    const isPostado = c.status === "postado";
    if (isPostado) postados++; else pendentes++;

    const card = document.createElement("div");
    card.className = "culto-card";
    card.innerHTML = `
      <div class="culto-top">
        <div class="tally ${isPostado ? "postado" : "pendente"}"></div>
        <div class="culto-data">${formatarData(c.data)}</div>
        <div class="culto-status-label ${isPostado ? "postado" : "pendente"}">
          ${isPostado ? "postado" : "pendente"}
        </div>
      </div>
      <div class="culto-tipo">${c.tipo || "Culto"}</div>
      ${c.tema ? `<div class="culto-tema">📌 ${c.tema}</div>` : ""}
      ${c.versiculo ? `<div class="culto-versiculo">“${c.versiculo}”</div>` : ""}
      <div class="culto-actions">
        ${isPostado
          ? `<button class="btn btn-undo" data-id="${id}" data-action="desmarcar">Desmarcar</button>
             <span class="btn" style="border:none;background:none;color:var(--text-faint);pointer-events:none;">
               por ${c.postadoPor || "—"}
             </span>`
          : `<button class="btn btn-mark" data-id="${id}" data-action="marcar">✓ Marcar como postado</button>`
        }
      </div>
    `;
    listaCultos.appendChild(card);
  });

  document.getElementById("totalCultos").textContent = docs.length;
  document.getElementById("totalPostados").textContent = postados;
  document.getElementById("totalPendentes").textContent = pendentes;

  listaCultos.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => toggleStatus(btn.dataset.id, btn.dataset.action));
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

// ---------- Modal: novo culto ----------
const modalOverlay = document.getElementById("modalOverlay");
const cultoForm = document.getElementById("cultoForm");

document.getElementById("addBtn").addEventListener("click", () => {
  modalOverlay.classList.add("active");
});
document.getElementById("cancelBtn").addEventListener("click", () => {
  modalOverlay.classList.remove("active");
});
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) modalOverlay.classList.remove("active");
});

cultoForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const dataInput = document.getElementById("cData").value; // yyyy-mm-dd
  const [ano, mes, dia] = dataInput.split("-").map(Number);
  const dataCulto = new Date(ano, mes - 1, dia, 12, 0); // meio-dia evita fuso

  await addDoc(collection(db, "cultos"), {
    data: Timestamp.fromDate(dataCulto),
    tipo: document.getElementById("cTipo").value,
    tema: document.getElementById("cTema").value,
    versiculo: document.getElementById("cVersiculo").value,
    status: "pendente",
    postadoPor: null,
    postadoEm: null,
    criadoPor: usuarioAtual.uid,
    atualizadoEm: serverTimestamp()
  });

  cultoForm.reset();
  modalOverlay.classList.remove("active");
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
  });
}
