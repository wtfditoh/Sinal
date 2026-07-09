import { db } from "./firebase-config.js";
import { exigirLogin, sair } from "./auth.js";
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, deleteDoc, doc, serverTimestamp, Timestamp,
  setDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const DIAS = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];

let usuarioAtual = null;
let mesAtual = new Date();
mesAtual.setDate(1);

const listaEscala = document.getElementById("listaEscala");
const emptyState = document.getElementById("emptyState");
const monthLabel = document.getElementById("monthLabel");

function escapeHtml(texto) {
  if (!texto) return "";
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

exigirLogin((usuario) => {
  usuarioAtual = usuario;
  carregarEscalaDoMes();
  marcarVisita();
});

document.getElementById("logoutBtn").addEventListener("click", sair);

document.getElementById("prevMonth").addEventListener("click", () => {
  mesAtual.setMonth(mesAtual.getMonth() - 1);
  carregarEscalaDoMes();
});
document.getElementById("nextMonth").addEventListener("click", () => {
  mesAtual.setMonth(mesAtual.getMonth() + 1);
  carregarEscalaDoMes();
});

function atualizarLabelMes() {
  monthLabel.textContent = `${MESES[mesAtual.getMonth()]} ${mesAtual.getFullYear()}`;
}

let unsubscribe = null;

function carregarEscalaDoMes() {
  atualizarLabelMes();
  const inicio = new Date(mesAtual.getFullYear(), mesAtual.getMonth(), 1);
  const fim = new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 1);

  const q = query(
    collection(db, "escalas"),
    where("data", ">=", Timestamp.fromDate(inicio)),
    where("data", "<", Timestamp.fromDate(fim)),
    orderBy("data", "asc")
  );

  if (unsubscribe) unsubscribe();
  unsubscribe = onSnapshot(q, (snapshot) => {
    renderEscala(snapshot.docs);
  }, (erro) => console.error("Erro ao carregar escala:", erro));
}

function renderEscala(docs) {
  listaEscala.innerHTML = "";
  emptyState.style.display = docs.length === 0 ? "block" : "none";

  // Agrupa por data (dia)
  const grupos = new Map();
  docs.forEach((docSnap) => {
    const d = docSnap.data();
    const chave = d.data.toDate().toDateString();
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push({ id: docSnap.id, ...d });
  });

  grupos.forEach((itens) => {
    const dataObj = itens[0].data.toDate();
    const bloco = document.createElement("div");
    bloco.className = "escala-dia";
    bloco.innerHTML = `
      <div class="escala-dia-header">
        ${DIAS[dataObj.getDay()]}, ${String(dataObj.getDate()).padStart(2,"0")}/${String(dataObj.getMonth()+1).padStart(2,"0")}
      </div>
    `;
    itens.forEach((item) => {
      const linha = document.createElement("div");
      linha.className = "escala-item";
      linha.innerHTML = `
        <span class="escala-funcao-tag">${escapeHtml(item.funcao)}</span>
        <span class="escala-pessoa">${escapeHtml(item.pessoa)}</span>
        <button class="escala-del" data-id="${item.id}" title="Remover">✕</button>
      `;
      bloco.appendChild(linha);
    });
    listaEscala.appendChild(bloco);
  });

  listaEscala.querySelectorAll(".escala-del").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!window.confirm("Remover essa escala?")) return;
      await deleteDoc(doc(db, "escalas", btn.dataset.id));
    });
  });
}

// ---------- Modal ----------
const modalOverlay = document.getElementById("modalOverlay");
const escalaForm = document.getElementById("escalaForm");

document.getElementById("addBtn").addEventListener("click", () => {
  modalOverlay.classList.add("active");
});
document.getElementById("cancelBtn").addEventListener("click", () => {
  modalOverlay.classList.remove("active");
});
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) modalOverlay.classList.remove("active");
});

escalaForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const dataInput = document.getElementById("eData").value;
  const [ano, mes, dia] = dataInput.split("-").map(Number);
  const dataEscala = new Date(ano, mes - 1, dia, 12, 0);

  await addDoc(collection(db, "escalas"), {
    data: Timestamp.fromDate(dataEscala),
    funcao: document.getElementById("eFuncao").value,
    pessoa: document.getElementById("ePessoa").value,
    criadoPor: usuarioAtual.uid,
    atualizadoEm: serverTimestamp()
  });

  escalaForm.reset();
  modalOverlay.classList.remove("active");
});

// ---------- Marca visita (zera notificação dessa aba) e checa cartazes ----------
async function marcarVisita() {
  const visitaRef = doc(db, "visitas", usuarioAtual.uid);
  await setDoc(visitaRef, { ultimaVisitaEscalas: serverTimestamp() }, { merge: true });

  const visitaSnap = await getDoc(visitaRef);
  const visitas = visitaSnap.exists() ? visitaSnap.data() : {};
  const q = query(collection(db, "cartazes"), orderBy("atualizadoEm", "desc"));
  onSnapshot(q, (snapshot) => {
    if (snapshot.empty) return;
    const maisRecente = snapshot.docs[0].data().atualizadoEm;
    const bolinha = document.getElementById("dotCartazes");
    if (!bolinha) return;
    if (!visitas.ultimaVisitaCartazes || (maisRecente && maisRecente.toMillis() > visitas.ultimaVisitaCartazes.toMillis())) {
      bolinha.classList.add("active");
    } else {
      bolinha.classList.remove("active");
    }
  });
}
