import { db } from "./firebase-config.js";
import { exigirLogin, sair } from "./auth.js";
import { initPerfil } from "./perfil.js";
import { aplicarModoVisitante } from "./visitante.js";
import { iniciarMenuMais } from "./menu-mais.js";
import { confirmarExclusao } from "./confirm.js";
import { atualizarBadgeApp } from "./badge.js";
import { registrarAtividade } from "./atividade.js";
import { iniciarFeedAtividades } from "./feed.js";
import { dispararNotificacao } from "./notificar.js";
import {
  collection, query, where, orderBy, onSnapshot, limit,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp, Timestamp,
  getDoc, getDocs, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

let usuarioAtual = null;
let mesAtual = new Date();
mesAtual.setDate(1);
let editandoId = null;
let cultosCache = new Map();
let solicitacoesCache = new Map();
let respostaAtualId = null;
let contagemCultosPendentes = 0;

const listaCultos = document.getElementById("listaCultos");
const emptyState = document.getElementById("emptyState");
const monthLabel = document.getElementById("monthLabel");

// ---------- Sessão ----------
iniciarMenuMais();
exigirLogin((usuario) => {
  usuarioAtual = usuario;
  initPerfil(usuario);
  aplicarModoVisitante(usuario);
  carregarCultosDoMes();
  checarNotificacoes();
  carregarProximoCulto();
  carregarSolicitacoes();
  carregarPedidos();
  iniciarFeedAtividades("listaFeed");
  carregarMural();
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

// ---------- Segurança básica de exibição ----------
function escapeHtml(texto) {
  if (!texto) return "";
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

// Função para baixar uma imagem
window.baixarImagem = function(url, nomeArquivo) {
  fetch(url)
    .then(res => res.blob())
    .then(blob => {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = nomeArquivo || "imagem.jpg";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
    })
    .catch(() => {
      window.open(url, "_blank");
    });
};

// Função para baixar várias imagens
window.baixarVarias = async function(urls, prefixo) {
  for (let i = 0; i < urls.length; i++) {
    await new Promise((resolve) => {
      setTimeout(() => {
        window.baixarImagem(urls[i], `${prefixo}-${i + 1}.jpg`);
        resolve();
      }, 500);
    });
  }
};

// ---------- Carregar cultos do mês ----------
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

function carregarProximoCulto() {
  const DIAS_SEMANA = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
  const agora = Timestamp.fromDate(new Date());
  const q = query(
    collection(db, "cultos"),
    where("data", ">=", agora),
    orderBy("data", "asc"),
    limit(1)
  );

  onSnapshot(q, (snapshot) => {
    const box = document.getElementById("proximoCultoBox");
    if (snapshot.empty) { box.style.display = "none"; return; }

    const c = snapshot.docs[0].data();
    const dataCulto = c.data.toDate();
    const hoje0h = new Date(); hoje0h.setHours(0,0,0,0);
    const alvo0h = new Date(dataCulto); alvo0h.setHours(0,0,0,0);
    const diffDias = Math.round((alvo0h - hoje0h) / (1000 * 60 * 60 * 24));

    const contagem = document.getElementById("proximoCultoContagem");
    if (contagem) {
      if (diffDias === 0) { contagem.textContent = "HOJE"; box.classList.add("hoje"); }
      else if (diffDias === 1) { contagem.textContent = "AMANHÃ"; box.classList.remove("hoje"); }
      else { contagem.textContent = `EM ${diffDias} DIAS`; box.classList.remove("hoje"); }
    }

    const nomeEl = document.getElementById("proximoCultoTexto");
    if (nomeEl) nomeEl.textContent = c.tipo || "Culto";

        const subEl = document.getElementById("proximoCultoSub");
    if (subEl) {
      const diaSemana = DIAS_SEMANA[dataCulto.getDay()];
      const diaMes = `${String(dataCulto.getDate()).padStart(2,"0")}/${String(dataCulto.getMonth()+1).padStart(2,"0")}`;
      subEl.textContent = `${diaSemana} · ${diaMes}`;
    }
    box.style.display = "block";
  });
}

// ---- Modal de detalhe do culto ----
const IMGBB_KEY = "5e3b2c6eae12635e0d9b00e9af54edb6";

async function abrirModalCultoDetalhe(id) {
  const c = cultosCache.get(id);
  if (!c) return;

  const overlay = document.getElementById("cultoDetalheOverlay");
  const el = (sel) => document.getElementById(sel);

  el("detalheData").textContent = formatarData(c.data);
  el("detalheTipo").textContent = c.tipo || "Culto";
  el("detalheTema").textContent = c.tema || "—";
  el("detalhePregador").textContent = c.pregador || "—";
  el("detalheVersiculo").textContent = c.versiculo || "—";
  el("detalheEventoParte").textContent = c.eventoParte || "—";
  el("detalheStatus").textContent = c.status === "postado"
    ? `✓ Postado por ${c.postadoPor || "—"}`
    : "Pendente";
  el("detalheStatus").className = `detalhe-status ${c.status === "postado" ? "postado" : "pendente"}`;

  const fotosPredefinidas = [];
  if (c.fotoPregador) fotosPredefinidas.push({ url: c.fotoPregador, legenda: "Pregador" });
  if (c.fotoLouvor)   fotosPredefinidas.push({ url: c.fotoLouvor,   legenda: "Louvor" });

  await renderGaleriaCulto(id, fotosPredefinidas);
  await renderEscaladosDia(c.data);

  overlay.dataset.cultoAberto = id;
  overlay.classList.add("active");
}

async function renderGaleriaCulto(cultoId, fotosPredefinidas = []) {
  const container = document.getElementById("detalheGaleria");
  container.innerHTML = "";

  let fotosSalvas = [];
  try {
    const snap = await getDocs(
      query(collection(db, "cultos", cultoId, "fotos"), orderBy("criadoEm", "desc"))
    );
    fotosSalvas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) { /* vazio é ok */ }

  const todasFotos = [
    ...fotosPredefinidas.map((f) => ({ ...f, predefinida: true })),
    ...fotosSalvas
  ];

  if (todasFotos.length === 0) {
    container.innerHTML = `<div class="galeria-vazia">Nenhuma foto ainda. Adicione abaixo ↓</div>`;
    return;
  }

  container.innerHTML = `
    <div style="grid-column:1/-1; display:flex; justify-content:flex-end; margin-bottom:8px;">
      <button type="button" class="galeria-add-btn" onclick="window.baixarVarias([${todasFotos.map(f => `'${f.url}'`).join(",")}], 'culto')">
        📥 Baixar todas (${todasFotos.length})
      </button>
    </div>
    ${todasFotos.map((foto, i) => `
      <div class="galeria-item" style="animation-delay:${i*0.04}s;">
        <div class="galeria-thumb carregando">
          <img src="${escapeHtml(foto.url)}" alt="" onload="this.parentElement.classList.remove('carregando')" onerror="this.parentElement.classList.remove('carregando')">
        </div>
        ${foto.legenda ? `<div class="galeria-legenda">${escapeHtml(foto.legenda)}</div>` : ""}
        <button class="galeria-download" data-url="${foto.url}" title="Baixar" style="position:absolute; bottom:5px; right:5px; width:24px; height:24px; border-radius:50%; background:rgba(0,0,0,0.7); border:none; color:#fff; font-size:12px; cursor:pointer; display:flex; align-items:center; justify-content:center;">📥</button>
        ${foto.id ? `<button class="galeria-del" data-foto-id="${foto.id}" data-culto-id="${cultoId}" title="Remover">✕</button>` : ""}
      </div>
    `).join("")}
  `;

  container.querySelectorAll(".galeria-download").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      window.baixarImagem(btn.dataset.url, "foto-culto.jpg");
    });
  });

  container.querySelectorAll(".galeria-del").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await deleteDoc(doc(db, "cultos", btn.dataset.cultoId, "fotos", btn.dataset.fotoId));
      renderGaleriaCulto(cultoId, fotosPredefinidas);
    });
  });
}

async function renderEscaladosDia(dataCulto) {
  const container = document.getElementById("detalheEscalados");
  container.innerHTML = "";
  if (!dataCulto) { container.innerHTML = `<span class="detalhe-vazio">—</span>`; return; }

  try {
    const d = dataCulto.toDate();
    const inicio = new Date(d); inicio.setHours(0,0,0,0);
    const fim    = new Date(d); fim.setHours(23,59,59,999);
    const snap = await getDocs(query(
      collection(db, "escalas"),
      where("data", ">=", Timestamp.fromDate(inicio)),
      where("data", "<=", Timestamp.fromDate(fim))
    ));

    if (snap.empty) {
      container.innerHTML = `<span class="detalhe-vazio">Ninguém escalado nesse dia ainda.</span>`;
    } else {
      container.innerHTML = snap.docs.map((d) => {
        const e = d.data();
        return `<div class="detalhe-escalado">
          <span class="escala-funcao-tag">${escapeHtml(e.funcao)}</span>
          <span>${escapeHtml(e.pessoa)}</span>
          ${e.confirmado ? `<span style="color:var(--green); font-size:11px;">✓ confirmado</span>` : ""}
        </div>`;
      }).join("");
    }
  } catch(e) {
    container.innerHTML = `<span class="detalhe-vazio">—</span>`;
  }
}

async function uploadFotoCulto(cultoId, arquivo) {
  const form = new FormData();
  form.append("image", arquivo);

  const resp = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, {
    method: "POST", body: form
  });
  const data = await resp.json();
  if (!data.success) throw new Error("Falha no upload");

  await addDoc(collection(db, "cultos", cultoId, "fotos"), {
    url: data.data.url,
    thumb: data.data.thumb?.url || data.data.url,
    criadoEm: serverTimestamp(),
    enviadoPor: usuarioAtual?.nome || "—"
  });

  return data.data.url;
}

function formatarHorarioEdicao(timestamp) {
  if (!timestamp) return "";
  const d = timestamp.toDate();
  return ` · ${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")} às ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function renderChecklistItem(cultoId, chave, label, feito) {
  return `<button class="checklist-item ${feito ? "feito" : ""}" data-culto="${cultoId}" data-chave="${chave}">${label}</button>`;
}

function renderCultos(docs) {
  listaCultos.innerHTML = "";
  cultosCache.clear();

  emptyState.style.display = docs.length === 0 ? "block" : "none";

  let postados = 0, pendentes = 0;

  docs.forEach((docSnap, index) => {
    const c = docSnap.data();
    const id = docSnap.id;
    cultosCache.set(id, c);
    const isPostado = c.status === "postado";
    if (isPostado) postados++; else pendentes++;

    const card = document.createElement("div");
    card.className = "culto-card";
    card.dataset.cultoId = id;
    card.style.animationDelay = `${index * 0.05}s`;

    const d = c.data?.toDate ? c.data.toDate() : new Date();
    const diaNum = String(d.getDate()).padStart(2,"0");
    const mesAbrev = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"][d.getMonth()];
    const subTitulo = c.tema
      ? escapeHtml(c.tema)
      : c.pregador
        ? `🎤 ${escapeHtml(c.pregador)}`
        : c.versiculo
          ? "Versículo pendente"
          : "Sem detalhes ainda";

    const totalCheck = [c.checklist?.foto, c.checklist?.story, c.checklist?.feed].filter(Boolean).length;

    card.innerHTML = `
      <div class="culto-data-badge ${isPostado ? "postado" : ""}">
        <div class="culto-data-badge-dia">${diaNum}</div>
        <div class="culto-data-badge-mes">${mesAbrev}</div>
      </div>
      <div class="culto-corpo">
        <div class="culto-linha-top">
          <div class="culto-tipo">${escapeHtml(c.tipo) || "Culto"}</div>
         <div class="culto-status-dot ${isPostado ? "postado" : "pendente"}">${isPostado ? "postado" : "pendente"}</div>
        </div>
        <div class="culto-tema">${subTitulo}</div>
                <div class="culto-checklist-row">
          <span class="culto-check ${c.checklist?.foto ? "feito" : ""}" title="Foto">📸</span>
          <span class="culto-check ${c.checklist?.story ? "feito" : ""}" title="Story">📱</span>
          <span class="culto-check ${c.checklist?.feed ? "feito" : ""}" title="Feed">📰</span>
          ${c.origemPublica ? `<span class="culto-meta-item amber" style="margin-left:auto;">📝 líder</span>` : ""}
        </div>
      </div>
      <button class="culto-quick-btn ${isPostado ? "undo" : "mark"}" data-id="${id}" data-action="${isPostado ? "desmarcar" : "marcar"}" title="${isPostado ? "Desmarcar" : "Marcar como postado"}">
        ${isPostado 
          ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>` 
          : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`
        }
      </button>
    `;
    listaCultos.appendChild(card);
  });

  document.getElementById("totalCultos").textContent = docs.length;
  document.getElementById("totalPostados").textContent = postados;
  document.getElementById("totalPendentes").textContent = pendentes;
  contagemCultosPendentes = pendentes;
  atualizarBadgeApp(contagemCultosPendentes + contagemLideresRespondidos + contagemPedidosAbertos);

  const anelPreenchido = document.getElementById("anelPreenchido");
  const anelPct = document.getElementById("anelPct");
  if (anelPreenchido) {
    const pct = docs.length ? Math.round((postados / docs.length) * 100) : 0;
    const circunferencia = 327;
    const offset = circunferencia - (circunferencia * pct) / 100;
    anelPreenchido.style.strokeDashoffset = offset;
    anelPct.textContent = `${pct}%`;
  }

  // Botão rápido de postar/desmarcar
  listaCultos.querySelectorAll(".culto-quick-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleStatus(btn.dataset.id, btn.dataset.action);
    });
  });

  // Clique no card abre modal
  listaCultos.querySelectorAll(".culto-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest("button, input, label, a")) return;
      const id = card.dataset.cultoId;
      if (id) abrirModalCultoDetalhe(id);
    });
  });
}

async function toggleChecklistItem(cultoId, chave, btn) {
  const jaFeito = btn.classList.contains("feito");
  btn.classList.toggle("feito", !jaFeito);
  await updateDoc(doc(db, "cultos", cultoId), {
    [`checklist.${chave}`]: !jaFeito,
    atualizadoEm: serverTimestamp()
  });
}

async function toggleStatus(id, action) {
  const ref = doc(db, "cultos", id);
  const tipoCulto = cultosCache.get(id)?.tipo || "um culto";
  if (action === "marcar") {
    await updateDoc(ref, {
      status: "postado",
      postadoPor: usuarioAtual.nome,
      postadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp()
    });
    registrarAtividade(usuarioAtual, `postou "${tipoCulto}" ✅`);
  } else {
    await updateDoc(ref, {
      status: "pendente",
      postadoPor: null,
      postadoEm: null,
      atualizadoEm: serverTimestamp()
    });
    registrarAtividade(usuarioAtual, `desmarcou "${tipoCulto}"`);
  }
}

async function excluirCulto(id) {
  const c = cultosCache.get(id);
  const confirmar = await confirmarExclusao(
    `Excluir o culto "${c?.tipo || "sem nome"}" de ${c ? formatarData(c.data) : ""}? Essa ação não pode ser desfeita.`
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
  document.getElementById("cPregador").value = c.pregador || "";
  document.getElementById("cEventoParte").value = c.eventoParte || "";
  document.getElementById("cVersiculo").value = c.versiculo || "";
  modalOverlay.classList.add("active");
}

function fecharModal() {
  modalOverlay.classList.remove("active");
  editandoId = null;
}

cultoForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const dataInput = document.getElementById("cData").value;
  const [ano, mes, dia] = dataInput.split("-").map(Number);
  const dataCulto = new Date(ano, mes - 1, dia, 12, 0);

  const payload = {
    data: Timestamp.fromDate(dataCulto),
    tipo: document.getElementById("cTipo").value,
    tema: document.getElementById("cTema").value,
    pregador: document.getElementById("cPregador").value,
    eventoParte: document.getElementById("cEventoParte").value,
    versiculo: document.getElementById("cVersiculo").value,
    atualizadoEm: serverTimestamp()
  };

  if (editandoId) {
    await updateDoc(doc(db, "cultos", editandoId), {
      ...payload,
      editadoPor: usuarioAtual.nome,
      editadoEm: serverTimestamp()
    });
  } else {
    await addDoc(collection(db, "cultos"), {
      ...payload,
      status: "pendente",
      postadoPor: null,
      postadoEm: null,
      criadoPor: usuarioAtual.uid
    });

    const dataFormatada = `${String(dia).padStart(2,"0")}/${String(mes).padStart(2,"0")}`;
    dispararNotificacao(db, usuarioAtual, {
      titulo: `🔔 Novo culto: ${payload.tipo || "Culto"}`,
      mensagem: `Culto marcado pra ${dataFormatada}${payload.tema ? " — " + payload.tema : ""}. Confira no app.`,
      tipo: "culto",
      cor: "#FFB020",
      destino: "dashboard.html"
    });
  }

  cultoForm.reset();
  fecharModal();
});

// ---------- Notificações ----------
async function checarNotificacoes() {
  const visitaRef = doc(db, "visitas", usuarioAtual.uid);
  const visitaSnap = await getDoc(visitaRef);
  const visitas = visitaSnap.exists() ? visitaSnap.data() : {};

  checarColecao("escalas", visitas.ultimaVisitaEscalas, "dotEscala");
  checarColecao("cartazes", visitas.ultimaVisitaCartazes, "dotCartazes");

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

document.getElementById("feedToggle").addEventListener("click", () => {
  const body = document.getElementById("feedBody");
  const seta = document.getElementById("feedSeta");
  const aberta = body.style.display !== "none";
  body.style.display = aberta ? "none" : "block";
  seta.classList.toggle("aberta", !aberta);
});

// ---------- Seção unificada "Pedidos" ----------
let contagemLideresRespondidos = 0;
let contagemPedidosAbertos = 0;

const pedidosSectionToggle = document.getElementById("pedidosSectionToggle");
const pedidosSectionBody = document.getElementById("pedidosSectionBody");
const pedidosSectionSeta = document.getElementById("pedidosSectionSeta");

pedidosSectionToggle.addEventListener("click", () => {
  const aberta = pedidosSectionBody.style.display !== "none";
  pedidosSectionBody.style.display = aberta ? "none" : "block";
  pedidosSectionSeta.classList.toggle("aberta", !aberta);
});

function atualizarBadgePedidos() {
  const badge = document.getElementById("pedidosSectionBadge");
  const total = contagemLideresRespondidos + contagemPedidosAbertos;
  if (total > 0) {
    badge.textContent = total;
    badge.style.display = "inline-block";
  } else {
    badge.style.display = "none";
  }
  atualizarBadgeApp(contagemCultosPendentes + contagemLideresRespondidos + contagemPedidosAbertos);
}

const tabLideres = document.getElementById("tabLideres");
const tabAjuda = document.getElementById("tabAjuda");
const painelLideres = document.getElementById("painelLideres");
const painelAjuda = document.getElementById("painelAjuda");

tabLideres.addEventListener("click", () => {
  tabLideres.classList.add("active");
  tabAjuda.classList.remove("active");
  painelLideres.style.display = "block";
  painelAjuda.style.display = "none";
});
tabAjuda.addEventListener("click", () => {
  tabAjuda.classList.add("active");
  tabLideres.classList.remove("active");
  painelAjuda.style.display = "block";
  painelLideres.style.display = "none";
});

// ---------- Solicitações a líderes ----------
const listaSolicitacoes = document.getElementById("listaSolicitacoes");

function carregarSolicitacoes() {
  const q = query(collection(db, "solicitacoes"), orderBy("criadoEm", "desc"));
  onSnapshot(q, (snapshot) => {
    solicitacoesCache.clear();
    listaSolicitacoes.innerHTML = "";
    let pendentesRespondidos = 0;

    snapshot.docs.forEach((docSnap) => {
      const s = docSnap.data();
      const id = docSnap.id;
      solicitacoesCache.set(id, s);
      if (s.status === "respondido") pendentesRespondidos++;

      const item = document.createElement("div");
      item.className = "solicitacao-item";
      const statusLabel = {
        aguardando: s.visualizadoEm ? "👁️ visualizado, aguardando resposta" : "aguardando resposta",
        respondido: "respondido, revisar",
        aplicado: "já aplicado"
      };
      item.innerHTML = `
        <div class="solicitacao-info">
          <div class="solicitacao-titulo">${escapeHtml(s.titulo)}</div>
          <div class="solicitacao-status ${s.status}">${statusLabel[s.status] || s.status}</div>
        </div>
        ${s.status === "aguardando" ? `<button class="btn" data-id="${id}" data-acao="link"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> Link</button>` : ""}
        ${s.status === "respondido" ? `<button class="btn btn-mark" data-id="${id}" data-acao="ver"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg> Ver</button>` : ""}
        <button class="btn btn-excluir" data-id="${id}" data-acao="excluir" title="Excluir"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
      `;
      listaSolicitacoes.appendChild(item);
    });

    if (snapshot.empty) {
      listaSolicitacoes.innerHTML = `<p style="color:var(--text-faint); font-size:13px;">Nenhum pedido gerado ainda.</p>`;
    }

    contagemLideresRespondidos = pendentesRespondidos;
    atualizarBadgePedidos();

    listaSolicitacoes.querySelectorAll("button[data-acao]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const acao = btn.dataset.acao;
        if (acao === "link") mostrarLink(id);
        else if (acao === "ver") abrirModalResposta(id);
        else if (acao === "excluir") excluirSolicitacao(id);
      });
    });
  });
}

async function excluirSolicitacao(id) {
  const confirmar = await confirmarExclusao("Excluir esse pedido? O link deixa de funcionar.");
  if (!confirmar) return;
  await deleteDoc(doc(db, "solicitacoes", id));
}

// ---------- Modal: nova solicitação ----------
const solicitacaoModalOverlay = document.getElementById("solicitacaoModalOverlay");
const solicitacaoForm = document.getElementById("solicitacaoForm");

document.getElementById("novaSolicitacaoBtn").addEventListener("click", () => {
  solicitacaoForm.reset();
  solicitacaoModalOverlay.classList.add("active");
});
document.getElementById("solicitacaoCancelBtn").addEventListener("click", () => {
  solicitacaoModalOverlay.classList.remove("active");
});
solicitacaoModalOverlay.addEventListener("click", (e) => {
  if (e.target === solicitacaoModalOverlay) solicitacaoModalOverlay.classList.remove("active");
});

solicitacaoForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const dataInput = document.getElementById("sData").value;
  let dataCulto = null;
  if (dataInput) {
    const [ano, mes, dia] = dataInput.split("-").map(Number);
    dataCulto = Timestamp.fromDate(new Date(ano, mes - 1, dia, 12, 0));
  }

  const novoDoc = await addDoc(collection(db, "solicitacoes"), {
    titulo: document.getElementById("sTitulo").value,
    dataCulto,
    status: "aguardando",
    resposta: null,
    criadoPor: usuarioAtual.uid,
    criadoEm: serverTimestamp()
  });

  solicitacaoModalOverlay.classList.remove("active");
  mostrarLink(novoDoc.id);
});

// ---------- Modal: link gerado ----------
const linkModalOverlay = document.getElementById("linkModalOverlay");
const linkGeradoTexto = document.getElementById("linkGeradoTexto");
let linkAtual = "";

function mostrarLink(id) {
  linkAtual = `${window.location.origin}${window.location.pathname.replace("dashboard.html", "")}formulario.html?id=${id}`;
  linkGeradoTexto.textContent = linkAtual;
  linkModalOverlay.classList.add("active");
}

document.getElementById("linkFecharBtn").addEventListener("click", () => {
  linkModalOverlay.classList.remove("active");
});
linkModalOverlay.addEventListener("click", (e) => {
  if (e.target === linkModalOverlay) linkModalOverlay.classList.remove("active");
});
document.getElementById("linkCopiarBtn").addEventListener("click", async () => {
  const btn = document.getElementById("linkCopiarBtn");
  try {
    if (navigator.share) {
      await navigator.share({ title: "SINAL — Formulário do culto", url: linkAtual });
    } else {
      await navigator.clipboard.writeText(linkAtual);
      btn.textContent = "Copiado!";
      setTimeout(() => { btn.textContent = "Copiar link"; }, 1800);
    }
  } catch (e) { /* cancelado */ }
});

// ---------- Modal: ver resposta / aplicar ----------
const respostaModalOverlay = document.getElementById("respostaModalOverlay");
const respostaModalTitulo = document.getElementById("respostaModalTitulo");
const respostaModalCorpo = document.getElementById("respostaModalCorpo");

function abrirModalResposta(id) {
  const s = solicitacoesCache.get(id);
  if (!s || !s.resposta) return;
  respostaAtualId = id;
  respostaModalTitulo.textContent = s.titulo;
  const r = s.resposta;
  respostaModalCorpo.innerHTML = `
    <div class="resposta-linha"><strong>Preenchido por</strong>${escapeHtml(r.nomeLider) || "—"}</div>
    ${r.pregador ? `<div class="resposta-linha"><strong>Pregador</strong>${escapeHtml(r.pregador)}</div>` : ""}
    ${r.tema ? `<div class="resposta-linha"><strong>Tema</strong>${escapeHtml(r.tema)}</div>` : ""}
    ${r.versiculo ? `<div class="resposta-linha"><strong>Versículo</strong>${escapeHtml(r.versiculo)}</div>` : ""}
    ${r.eventoParte ? `<div class="resposta-linha"><strong>Evento à parte</strong>${escapeHtml(r.eventoParte)}</div>` : ""}
  `;
  respostaModalOverlay.classList.add("active");
}

document.getElementById("respostaFecharBtn").addEventListener("click", () => {
  respostaModalOverlay.classList.remove("active");
});
respostaModalOverlay.addEventListener("click", (e) => {
  if (e.target === respostaModalOverlay) respostaModalOverlay.classList.remove("active");
});

document.getElementById("respostaAplicarBtn").addEventListener("click", async () => {
  const s = solicitacoesCache.get(respostaAtualId);
  if (!s) return;
  respostaModalOverlay.classList.remove("active");

  abrirModalCriacao();
  if (s.dataCulto) document.getElementById("cData").value = formatarDataInput(s.dataCulto);
  document.getElementById("cTipo").value = s.titulo;
  document.getElementById("cTema").value = s.resposta.tema || "";
  document.getElementById("cPregador").value = s.resposta.pregador || "";
  document.getElementById("cVersiculo").value = s.resposta.versiculo || "";
  document.getElementById("cEventoParte").value = s.resposta.eventoParte || "";

  await updateDoc(doc(db, "solicitacoes", respostaAtualId), { status: "aplicado" });
});

// ---------- Compartilhar pendências no zap ----------
document.getElementById("compartilharPendenciasBtn").addEventListener("click", compartilharPendencias);

async function compartilharPendencias() {
  const btn = document.getElementById("compartilharPendenciasBtn");
  btn.textContent = "Gerando imagem...";
  btn.disabled = true;

  try {
    const cultosPendentes = [...cultosCache.values()]
      .filter((c) => c.status !== "postado")
      .sort((a, b) => a.data.toMillis() - b.data.toMillis());

    const snapCartazes = await getDocs(query(collection(db, "cartazes")));
    const hoje0h = new Date(); hoje0h.setHours(0, 0, 0, 0);
    const cartazesPendentes = snapCartazes.docs
      .map((d) => d.data())
      .filter((c) => c.status !== "postado")
      .map((c) => ({ ...c, atrasado: c.lembreteData ? c.lembreteData.toDate() < hoje0h : false }));

    const pedidosAbertos = [...pedidosCache.values()].filter((p) => p.status === "aberto");

    const blob = await gerarImagemPendencias(cultosPendentes, cartazesPendentes, pedidosAbertos);
    const arquivo = new File([blob], "pendencias-sinal.png", { type: "image/png" });

    if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
      await navigator.share({ files: [arquivo], title: "Pendências SINAL" });
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "pendencias-sinal.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      alert("Imagem baixada! Agora é só anexar no WhatsApp.");
    }
  } catch (e) {
    if (e.name !== "AbortError") console.error("Erro ao gerar pendências:", e);
  }

  btn.textContent = "📤 Compartilhar pendências no zap";
  btn.disabled = false;
}

function gerarImagemPendencias(cultos, cartazes, pedidos) {
  return new Promise((resolve) => {
    const largura = 520;
    const margem = 32;
    const ESCALA = 2.5;
    const totalItens = cultos.length + cartazes.length + pedidos.length;

    const alturaHeader = 100;
    const alturaSecaoTitulo = 34;
    const alturaLinha = 40;
    const alturaFooter = 40;

    let numSecoes = 0;
    if (cultos.length) numSecoes++;
    if (cartazes.length) numSecoes++;
    if (pedidos.length) numSecoes++;

    const altura = totalItens === 0
      ? alturaHeader + 100 + alturaFooter
      : alturaHeader + numSecoes * alturaSecaoTitulo + totalItens * alturaLinha + alturaFooter + 10;

    const canvas = document.createElement("canvas");
    canvas.width = largura * ESCALA;
    canvas.height = altura * ESCALA;
    const ctx = canvas.getContext("2d");
    ctx.scale(ESCALA, ESCALA);

    ctx.fillStyle = "#0E1016";
    ctx.fillRect(0, 0, largura, altura);

    ctx.beginPath();
    ctx.arc(margem + 14, 44, 14, 0, Math.PI * 2);
    const anelGrad = ctx.createLinearGradient(margem, 30, margem + 28, 58);
    anelGrad.addColorStop(0, "#2EE896");
    anelGrad.addColorStop(0.5, "#FFB020");
    anelGrad.addColorStop(1, "#FF5C5C");
    ctx.strokeStyle = anelGrad;
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = "#E8E9ED";
    ctx.font = "600 22px Arial, sans-serif";
    ctx.fillText("SINAL — Pendências", margem + 38, 50);

    const hoje = new Date();
    ctx.fillStyle = "#6B7280";
    ctx.font = "15px Arial, sans-serif";
    ctx.fillText(`${String(hoje.getDate()).padStart(2,"0")}/${String(hoje.getMonth()+1).padStart(2,"0")}`, margem + 38, 74);

    let y = alturaHeader;

    if (totalItens === 0) {
      ctx.fillStyle = "#2EE896";
      ctx.font = "600 20px Arial, sans-serif";
      ctx.fillText("✓ Tudo em dia por aqui", margem, y + 40);
    } else {
      const secoes = [
        { titulo: "CULTOS PENDENTES", itens: cultos.map((c) => {
            const d = c.data.toDate();
            return { texto: c.tipo || "Culto", sub: `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`, urgente: false };
          }) },
        { titulo: "CARTAZES PENDENTES", itens: cartazes.map((c) => ({ texto: c.titulo, sub: c.atrasado ? "atrasado" : null, urgente: c.atrasado })) },
        { titulo: "PEDIDOS EM ABERTO", itens: pedidos.map((p) => ({ texto: p.titulo, sub: null, urgente: false })) }
      ];

      secoes.forEach((secao) => {
        if (secao.itens.length === 0) return;

        ctx.fillStyle = "#4A5163";
        ctx.font = "600 11px Arial, sans-serif";
        ctx.fillText(secao.titulo, margem, y + 16);
        y += alturaSecaoTitulo;

        secao.itens.forEach((item) => {
          ctx.fillStyle = item.urgente ? "#FF5C5C" : "#E8E9ED";
          ctx.font = "500 15px Arial, sans-serif";
          ctx.fillText(`•  ${item.texto}`, margem, y + 16);

          if (item.sub) {
            ctx.fillStyle = item.urgente ? "#FF5C5C" : "#6B7280";
            ctx.font = "400 11px Arial, sans-serif";
            ctx.textAlign = "right";
            ctx.fillText(item.sub, largura - margem, y + 16);
            ctx.textAlign = "left";
          }
          y += alturaLinha;
        });
      });
    }

    ctx.fillStyle = "#3A4152";
    ctx.font = "11px Arial, sans-serif";
    ctx.fillText("Gerado pelo app SINAL", margem, altura - 16);

    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

// ---------- Pedidos de ajuda interna ----------
let pedidosCache = new Map();
const listaPedidos = document.getElementById("listaPedidos");

function carregarPedidos() {
  const q = query(collection(db, "pedidos"), orderBy("criadoEm", "desc"));
  onSnapshot(q, (snapshot) => {
    pedidosCache.clear();
    listaPedidos.innerHTML = "";
    let abertosCount = 0;

    if (snapshot.empty) {
      listaPedidos.innerHTML = `<p style="color:var(--text-faint); font-size:13px;">Nenhum pedido no momento.</p>`;
    }

    snapshot.docs.forEach((docSnap) => {
      const p = docSnap.data();
      const id = docSnap.id;
      pedidosCache.set(id, p);
      if (p.status === "aberto") abertosCount++;

      const statusLabel = {
        aberto: "aberto",
        andamento: `com ${p.assumidoPorNome || "alguém"}`,
        feito: p.enviado ? "concluído e enviado" : "feito, falta enviar"
      };

      const item = document.createElement("div");
      item.className = "solicitacao-item";
      item.style.alignItems = "flex-start";
      item.innerHTML = `
        <div class="solicitacao-info">
          <div class="solicitacao-titulo">${escapeHtml(p.titulo)}</div>
          ${p.descricao ? `<div style="font-size:12px; color:var(--text-dim); margin-top:2px;">${escapeHtml(p.descricao)}</div>` : ""}
          ${p.solicitante ? `<div style="font-size:11px; color:var(--text-faint); margin-top:2px;">pedido por ${escapeHtml(p.solicitante)}</div>` : ""}
          <div class="solicitacao-status ${p.status === "feito" ? "aplicado" : p.status === "andamento" ? "respondido" : "aguardando"}" style="margin-top:4px;">
            ${statusLabel[p.status] || p.status}
          </div>
        </div>
      `;

      const acoes = document.createElement("div");
      acoes.style.display = "flex";
      acoes.style.flexDirection = "column";
      acoes.style.gap = "6px";

      if (p.status === "aberto") {
        acoes.innerHTML += `<button class="btn btn-mark" data-id="${id}" data-acao="assumir"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Assumir</button>`;
      }
      if (p.status === "andamento") {
        acoes.innerHTML += `<button class="btn btn-mark" data-id="${id}" data-acao="feito"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Feito</button>`;
      }
      if (p.status === "feito" && !p.enviado) {
        acoes.innerHTML += `<button class="btn btn-primary" data-id="${id}" data-acao="enviado">📨 Marcar enviado</button>`;
      }
      acoes.innerHTML += `<button class="btn btn-excluir" data-id="${id}" data-acao="excluir" title="Excluir"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>`;

      item.appendChild(acoes);
      listaPedidos.appendChild(item);
    });

    contagemPedidosAbertos = abertosCount;
    atualizarBadgePedidos();

    listaPedidos.querySelectorAll("button[data-acao]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const acao = btn.dataset.acao;
        if (acao === "assumir") assumirPedido(id);
        else if (acao === "feito") marcarPedidoFeito(id);
        else if (acao === "enviado") marcarPedidoEnviado(id);
        else if (acao === "excluir") excluirPedido(id);
      });
    });
  });
}

async function assumirPedido(id) {
  await updateDoc(doc(db, "pedidos", id), {
    status: "andamento",
    assumidoPor: usuarioAtual.uid,
    assumidoPorNome: usuarioAtual.nome,
    atualizadoEm: serverTimestamp()
  });
  registrarAtividade(usuarioAtual, `assumiu o pedido "${pedidosCache.get(id)?.titulo || ""}"`);
}

async function marcarPedidoFeito(id) {
  await updateDoc(doc(db, "pedidos", id), {
    status: "feito",
    feitoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp()
  });
  registrarAtividade(usuarioAtual, `concluiu o pedido "${pedidosCache.get(id)?.titulo || ""}" ✅`);
}

async function marcarPedidoEnviado(id) {
  await updateDoc(doc(db, "pedidos", id), {
    enviado: true,
    enviadoPor: usuarioAtual.nome,
    atualizadoEm: serverTimestamp()
  });
}

async function excluirPedido(id) {
  const confirmar = await confirmarExclusao("Excluir esse pedido?");
  if (!confirmar) return;
  await deleteDoc(doc(db, "pedidos", id));
}

// ---------- Modal: novo pedido ----------
const pedidoModalOverlay = document.getElementById("pedidoModalOverlay");
const pedidoForm = document.getElementById("pedidoForm");

document.getElementById("novoPedidoBtn").addEventListener("click", () => {
  pedidoForm.reset();
  pedidoModalOverlay.classList.add("active");
});
document.getElementById("pedidoCancelBtn").addEventListener("click", () => {
  pedidoModalOverlay.classList.remove("active");
});
pedidoModalOverlay.addEventListener("click", (e) => {
  if (e.target === pedidoModalOverlay) pedidoModalOverlay.classList.remove("active");
});

pedidoForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  await addDoc(collection(db, "pedidos"), {
    titulo: document.getElementById("pdTitulo").value,
    descricao: document.getElementById("pdDescricao").value,
    solicitante: document.getElementById("pdSolicitante").value,
    status: "aberto",
    assumidoPor: null,
    assumidoPorNome: null,
    enviado: false,
    criadoPor: usuarioAtual.uid,
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp()
  });
  pedidoForm.reset();
  pedidoModalOverlay.classList.remove("active");
});

// ---------- Mural da equipe ----------
document.getElementById("tabAtividade").addEventListener("click", () => {
  document.getElementById("tabAtividade").classList.add("active");
  document.getElementById("tabMural").classList.remove("active");
  document.getElementById("painelAtividade").style.display = "block";
  document.getElementById("painelMural").style.display = "none";
});
document.getElementById("tabMural").addEventListener("click", () => {
  document.getElementById("tabMural").classList.add("active");
  document.getElementById("tabAtividade").classList.remove("active");
  document.getElementById("painelMural").style.display = "block";
  document.getElementById("painelAtividade").style.display = "none";
});

function tempoRelativoMural(timestamp) {
  if (!timestamp) return "agora";
  const diffMin = Math.round((Date.now() - timestamp.toDate().getTime()) / 60000);
  if (diffMin < 1) return "agora mesmo";
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffHoras = Math.round(diffMin / 60);
  if (diffHoras < 24) return `há ${diffHoras}h`;
  return `há ${Math.round(diffHoras / 24)}d`;
}

function carregarMural() {
  const q = query(collection(db, "mural"), orderBy("criadoEm", "desc"), limit(20));
  onSnapshot(q, (snapshot) => {
    const container = document.getElementById("listaMural");
    if (snapshot.empty) {
      container.innerHTML = `<p style="color:var(--text-faint); font-size:13px;">Nenhum recado ainda. Seja o primeiro!</p>`;
      return;
    }
    container.innerHTML = snapshot.docs.map((docSnap) => {
      const m = docSnap.data();
      const ehAviso = m.tipo === "aviso";
      return `
        <div class="mural-item ${ehAviso ? "mural-aviso" : ""}">
          ${ehAviso ? `<div class="mural-aviso-selo">📢 AVISO OFICIAL${m.categoria ? " · " + escapeHtml(m.categoria) : ""}</div>` : ""}
          ${ehAviso && m.titulo ? `<div class="mural-aviso-titulo">${escapeHtml(m.titulo)}</div>` : ""}
          <div class="mural-texto">${escapeHtml(m.texto)}</div>
          <div class="mural-meta">
            <span>${escapeHtml(m.autor)} · ${tempoRelativoMural(m.criadoEm)}</span>
            <button class="mural-del" data-id="${docSnap.id}">remover</button>
          </div>
        </div>
      `;
    }).join("");

    container.querySelectorAll(".mural-del").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const confirmar = await confirmarExclusao("Remover esse recado do mural?");
        if (!confirmar) return;
        await deleteDoc(doc(db, "mural", btn.dataset.id));
      });
    });
  });
}

document.getElementById("muralForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = document.getElementById("muralInput");
  const texto = input.value.trim();
  if (!texto) return;

  await addDoc(collection(db, "mural"), {
    texto,
    autor: usuarioAtual.nome,
    criadoPor: usuarioAtual.uid,
    criadoEm: serverTimestamp()
  });

  input.value = "";
});

// ---- Modal detalhe: fechar, editar, excluir e upload ----

document.getElementById("cultoDetalheFecharBtn").addEventListener("click", () => {
  document.getElementById("cultoDetalheOverlay").classList.remove("active");
});

document.getElementById("detalheEditarBtn").addEventListener("click", () => {
  const id = document.getElementById("cultoDetalheOverlay").dataset.cultoAberto;
  if (!id) return;
  document.getElementById("cultoDetalheOverlay").classList.remove("active");
  abrirModalEdicao(id);
});

document.getElementById("detalheExcluirBtn").addEventListener("click", async () => {
  const id = document.getElementById("cultoDetalheOverlay").dataset.cultoAberto;
  if (!id) return;
  document.getElementById("cultoDetalheOverlay").classList.remove("active");
  await excluirCulto(id);
});

document.getElementById("cultoDetalheOverlay").addEventListener("click", (e) => {
  if (e.target === document.getElementById("cultoDetalheOverlay")) {
    document.getElementById("cultoDetalheOverlay").classList.remove("active");
  }
});

document.getElementById("galeriaFileInput").addEventListener("change", async (e) => {
  const arquivos = [...e.target.files];
  if (!arquivos.length) return;

  const overlay = document.getElementById("cultoDetalheOverlay");
  const cultoId = overlay.dataset.cultoAberto;
  if (!cultoId) return;

  const status = document.getElementById("galeriaUploadStatus");
  status.style.display = "block";
  status.textContent = `⏳ Enviando ${arquivos.length} foto(s)...`;

  let ok = 0;
  for (const arquivo of arquivos) {
    try {
      await uploadFotoCulto(cultoId, arquivo);
      ok++;
      status.textContent = `⏳ ${ok}/${arquivos.length} foto(s) enviada(s)...`;
    } catch (err) {
      console.error("Erro no upload:", err);
    }
  }

  status.textContent = `✓ ${ok} foto(s) adicionada(s) com sucesso!`;
  setTimeout(() => { status.style.display = "none"; }, 2500);

  const c = cultosCache.get(cultoId);
  const fotos = [];
  if (c?.fotoPregador) fotos.push({ url: c.fotoPregador, legenda: "Pregador" });
  if (c?.fotoLouvor)   fotos.push({ url: c.fotoLouvor,   legenda: "Louvor" });
  await renderGaleriaCulto(cultoId, fotos);

  e.target.value = "";
});
