import { db } from "./firebase-config.js";
import { exigirLogin, sair } from "./auth.js";
import { initPerfil } from "./perfil.js";
import { confirmarExclusao } from "./confirm.js";
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
    renderListaMes();
    if (diaSelecionado) renderModalDia(diaSelecionado);
  }, (erro) => console.error("Erro ao carregar escala:", erro));
}

function renderListaMes() {
  const container = document.getElementById("listaEscalaMes");
  const empty = document.getElementById("emptyStateMes");
  container.innerHTML = "";

  const chavesOrdenadas = [...escalasPorDia.keys()].sort();

  if (chavesOrdenadas.length === 0) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  chavesOrdenadas.forEach((chave) => {
    const itens = escalasPorDia.get(chave);
    const dataObj = itens[0].data.toDate();

    const bloco = document.createElement("div");
    bloco.className = "escala-dia";
    bloco.innerHTML = `
      <div class="escala-dia-header">
        ${DIAS_LONGO[dataObj.getDay()]}, ${String(dataObj.getDate()).padStart(2,"0")}/${String(dataObj.getMonth()+1).padStart(2,"0")}
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
    container.appendChild(bloco);
  });

  container.querySelectorAll(".escala-del").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const confirmar = await confirmarExclusao("Remover essa pessoa da escala desse dia?");
      if (!confirmar) return;
      await deleteDoc(doc(db, "escalas", btn.dataset.id));
    });
  });
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
      const confirmar = await confirmarExclusao("Remover essa pessoa da escala desse dia?");
      if (!confirmar) return;
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

// ---------- Baixar escala como imagem (pra compartilhar no zap) ----------
document.getElementById("baixarEscalaBtn").addEventListener("click", gerarImagemEscala);

async function gerarImagemEscala() {
  const todos = [];
  [...escalasPorDia.keys()].sort().forEach((chave) => {
    escalasPorDia.get(chave).forEach((item) => todos.push(item));
  });

  if (todos.length === 0) {
    alert("Não tem escala cadastrada nesse mês ainda.");
    return;
  }

  const DIAS_ABREV = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const DIAS_MINI = ["D", "S", "T", "Q", "Q", "S", "S"];
  const largura = 760;
  const margem = 40;

  // ---- Cálculo do mini calendário ----
  const ano = mesAtual.getFullYear();
  const mesIdx = mesAtual.getMonth();
  const primeiroDiaSemana = new Date(ano, mesIdx, 1).getDay();
  const totalDiasMes = new Date(ano, mesIdx + 1, 0).getDate();
  const totalCelulas = primeiroDiaSemana + totalDiasMes;
  const totalLinhasCal = Math.ceil(totalCelulas / 7);

  const celulaLargura = (largura - margem * 2) / 7;
  const celulaAltura = 46;
  const espacoCelula = 4;
  const alturaHeader = 130;
  const alturaLabelsDias = 30;
  const alturaCalendario = totalLinhasCal * celulaAltura;
  const alturaSeparadorCal = 44;
  const alturaLinha = 68;
  const alturaFooter = 50;

  const topoCalendario = alturaHeader + alturaLabelsDias;
  const topoLista = topoCalendario + alturaCalendario + alturaSeparadorCal;
  const altura = topoLista + todos.length * alturaLinha + alturaFooter;

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");

  function retanguloArredondado(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // fundo
  const grad = ctx.createLinearGradient(0, 0, largura, altura);
  grad.addColorStop(0, "#181C26");
  grad.addColorStop(1, "#08090D");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, largura, altura);

  // ---- Cabeçalho ----
  ctx.beginPath();
  ctx.arc(margem + 18, 50, 18, 0, Math.PI * 2);
  const anelGrad = ctx.createLinearGradient(margem, 32, margem + 36, 68);
  anelGrad.addColorStop(0, "#2EE896");
  anelGrad.addColorStop(0.5, "#FFB020");
  anelGrad.addColorStop(1, "#FF5C5C");
  ctx.strokeStyle = anelGrad;
  ctx.lineWidth = 6;
  ctx.stroke();

  ctx.fillStyle = "#F5F6F8";
  ctx.font = "bold 30px Arial, sans-serif";
  ctx.fillText("SINAL — Escala", margem + 52, 58);

  ctx.fillStyle = "#9CA3B5";
  ctx.font = "20px Arial, sans-serif";
  ctx.fillText(`${MESES[mesIdx]} ${ano}`, margem + 52, 86);

  // ---- Mini calendário ----
  ctx.font = "bold 11px Arial, sans-serif";
  ctx.textAlign = "center";
  DIAS_MINI.forEach((d, i) => {
    ctx.fillStyle = "#5C6478";
    ctx.fillText(d, margem + celulaLargura * i + celulaLargura / 2, alturaHeader + 18);
  });

  for (let dia = 1; dia <= totalDiasMes; dia++) {
    const posicao = primeiroDiaSemana + dia - 1;
    const col = posicao % 7;
    const lin = Math.floor(posicao / 7);
    const x = margem + col * celulaLargura + espacoCelula / 2;
    const y = topoCalendario + lin * celulaAltura + espacoCelula / 2;
    const w = celulaLargura - espacoCelula;
    const h = celulaAltura - espacoCelula;

    const chaveDia = `${ano}-${String(mesIdx + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    const qtdPessoas = escalasPorDia.get(chaveDia)?.length || 0;
    const temEscala = qtdPessoas > 0;

    retanguloArredondado(x, y, w, h, 8);
    if (temEscala) {
      ctx.fillStyle = "rgba(255,176,32,0.10)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,176,32,0.55)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.02)";
      ctx.fill();
    }

    ctx.fillStyle = temEscala ? "#FFB020" : "#4A5163";
    ctx.font = temEscala ? "bold 15px Arial, sans-serif" : "13px Arial, sans-serif";
    ctx.fillText(String(dia), x + w / 2, y + h / 2 - (temEscala ? 3 : 0));

    if (temEscala) {
      const raioPonto = 2.4;
      const espacoPontos = 7;
      const qtdPontos = Math.min(qtdPessoas, 3);
      const inicioX = x + w / 2 - ((qtdPontos - 1) * espacoPontos) / 2;
      for (let p = 0; p < qtdPontos; p++) {
        ctx.beginPath();
        ctx.arc(inicioX + p * espacoPontos, y + h - 9, raioPonto, 0, Math.PI * 2);
        ctx.fillStyle = "#2EE896";
        ctx.fill();
      }
    }
  }
  ctx.textAlign = "left";

  // separador
  ctx.strokeStyle = "#2E3444";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(margem, topoLista - 25);
  ctx.lineTo(largura - margem, topoLista - 25);
  ctx.stroke();

  ctx.fillStyle = "#9CA3B5";
  ctx.font = "bold 14px Arial, sans-serif";
  ctx.fillText("DETALHES DA ESCALA", margem, topoLista - 5);

  // ---- Lista detalhada ----
  todos.forEach((item, i) => {
    const y = topoLista + 15 + i * alturaLinha;
    const d = item.data.toDate();

    if (i % 2 === 0) {
      ctx.fillStyle = "rgba(255,255,255,0.025)";
      ctx.fillRect(margem - 10, y, largura - margem * 2 + 20, alturaLinha - 8);
    }

    ctx.fillStyle = "#F5F6F8";
    ctx.font = "bold 22px Arial, sans-serif";
    ctx.fillText(`${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`, margem, y + 32);

    ctx.fillStyle = "#5C6478";
    ctx.font = "13px Arial, sans-serif";
    ctx.fillText(DIAS_ABREV[d.getDay()], margem, y + 52);

    ctx.fillStyle = "#FFB020";
    ctx.font = "bold 13px Arial, sans-serif";
    ctx.fillText(item.funcao.toUpperCase(), margem + 115, y + 26);

    ctx.fillStyle = "#2EE896";
    ctx.font = "bold 24px Arial, sans-serif";
    ctx.fillText(item.pessoa, margem + 115, y + 54);
  });

  ctx.fillStyle = "#5C6478";
  ctx.font = "13px Arial, sans-serif";
  ctx.fillText("Gerado pelo app SINAL", margem, altura - 18);

  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `escala-${MESES[mesIdx]}-${ano}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, "image/png");
}

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
