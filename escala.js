import { db } from "./firebase-config.js";
import { exigirLogin, sair } from "./auth.js";
import { initPerfil } from "./perfil.js";
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, deleteDoc, doc, serverTimestamp, Timestamp,
  setDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const DIAS_LONGO = ["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"];

let usuarioAtual = null;
let mesAtual = new Date();
mesAtual.setDate(1);
let escalasPorDia = new Map(); // "YYYY-MM-DD" -> [{id, funcao, pessoa}]
let diaSelecionado = null; // Date do dia aberto no modal

const calendarGrid = document.getElementById("calendarGrid");
const monthLabel = document.getElementById("monthLabel");

function escapeHtml(texto) {
  if (!texto) return "";
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

function chaveDia(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

exigirLogin((usuario) => {
  usuarioAtual = usuario;
  initPerfil(usuario);
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
    escalasPorDia.clear();
    snapshot.docs.forEach((docSnap) => {
      const d = docSnap.data();
      const dia = d.data.toDate();
      const chave = chaveDia(dia);
      if (!escalasPorDia.has(chave)) escalasPorDia.set(chave, []);
      escalasPorDia.get(chave).push({ id: docSnap.id, ...d });
    });
    renderCalendario();
    if (diaSelecionado) renderModalDia(diaSelecionado);
  }, (erro) => console.error("Erro ao carregar escala:", erro));
}

function renderCalendario() {
  calendarGrid.innerHTML = "";
  const ano = mesAtual.getFullYear();
  const mes = mesAtual.getMonth();
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();
  const hoje = new Date();

  for (let i = 0; i < primeiroDiaSemana; i++) {
    const vazio = document.createElement("div");
    vazio.className = "cal-day vazio";
    calendarGrid.appendChild(vazio);
  }

  for (let dia = 1; dia <= totalDias; dia++) {
    const dataObj = new Date(ano, mes, dia);
    const chave = chaveDia(dataObj);
    const itens = escalasPorDia.get(chave) || [];
    const isHoje = chaveDia(hoje) === chave;

    const celula = document.createElement("div");
    celula.className = `cal-day ${itens.length ? "tem-culto" : ""} ${isHoje ? "hoje" : ""}`;
    celula.style.animationDelay = `${dia * 0.01}s`;

    const nomesVisiveis = itens.slice(0, 2);
    const resto = itens.length - nomesVisiveis.length;

    celula.innerHTML = `
      <div class="cal-day-num">${dia}</div>
      <div class="cal-day-nomes">
        ${nomesVisiveis.map(it => `<div class="cal-day-nome">${escapeHtml(it.pessoa)}</div>`).join("")}
        ${resto > 0 ? `<div class="cal-day-mais">+${resto}</div>` : ""}
      </div>
    `;
    celula.addEventListener("click", () => abrirModalDia(dataObj));
    calendarGrid.appendChild(celula);
  }
}

// ---------- Modal de detalhe do dia ----------
const diaModalOverlay = document.getElementById("diaModalOverlay");
const diaModalTitle = document.getElementById("diaModalTitle");
const diaModalLista = document.getElementById("diaModalLista");

function abrirModalDia(dataObj) {
  diaSelecionado = dataObj;
  renderModalDia(dataObj);
  diaModalOverlay.classList.add("active");
}

function renderModalDia(dataObj) {
  const chave = chaveDia(dataObj);
  const itens = escalasPorDia.get(chave) || [];
  diaModalTitle.textContent = `${DIAS_LONGO[dataObj.getDay()]}, ${String(dataObj.getDate()).padStart(2,"0")}/${String(dataObj.getMonth()+1).padStart(2,"0")}`;

  diaModalLista.innerHTML = itens.length === 0
    ? `<p style="color:var(--text-faint); font-size:13px;">Ninguém escalado ainda pra esse dia.</p>`
    : itens.map(it => `
        <div class="dia-item">
          <span class="escala-funcao-tag">${escapeHtml(it.funcao)}</span>
          <span class="escala-pessoa">${escapeHtml(it.pessoa)}</span>
          <button class="escala-del" data-id="${it.id}" title="Remover">✕</button>
        </div>
      `).join("");

  diaModalLista.querySelectorAll(".escala-del").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!window.confirm("Remover essa escala?")) return;
      await deleteDoc(doc(db, "escalas", btn.dataset.id));
    });
  });
}

diaModalOverlay.addEventListener("click", (e) => {
  if (e.target === diaModalOverlay) fecharModalDia();
});

function fecharModalDia() {
  diaModalOverlay.classList.remove("active");
  diaSelecionado = null;
}

document.getElementById("diaAddBtn").addEventListener("click", () => {
  const dataInput = document.getElementById("eData");
  if (diaSelecionado) {
    dataInput.value = chaveDia(diaSelecionado);
  }
  modalOverlay.classList.add("active");
});

// ---------- Modal: nova escala ----------
const modalOverlay = document.getElementById("modalOverlay");
const escalaForm = document.getElementById("escalaForm");

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

document.getElementById("addBtn").addEventListener("click", () => {
  document.getElementById("eData").value = "";
  modalOverlay.classList.add("active");
});

// ---------- Marca visita e checa notificação de cartazes ----------
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
