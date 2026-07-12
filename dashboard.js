import { db } from "./firebase-config.js";
import { exigirLogin, sair } from "./auth.js";
import { initPerfil } from "./perfil.js";
import { confirmarExclusao } from "./confirm.js";
import { atualizarBadgeApp } from "./badge.js";
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp, Timestamp,
  getDoc, getDocs, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

let usuarioAtual = null;
let mesAtual = new Date();
mesAtual.setDate(1);
let editandoId = null; // null = criando novo culto; senão, id do culto sendo editado
let cultosCache = new Map(); // id -> dados, usado pra preencher o modal de edição
let solicitacoesCache = new Map();
let respostaAtualId = null;
let contagemCultosPendentes = 0;

const listaCultos = document.getElementById("listaCultos");
const emptyState = document.getElementById("emptyState");
const monthLabel = document.getElementById("monthLabel");

// ---------- Sessão ----------
exigirLogin((usuario) => {
  usuarioAtual = usuario;
  initPerfil(usuario);
  carregarCultosDoMes();
  checarNotificacoes();
  carregarSolicitacoes();
  carregarPedidos();
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

function renderChecklistItem(cultoId, chave, label, feito) {
  return `<button class="checklist-item ${feito ? "feito" : ""}" data-culto="${cultoId}" data-chave="${chave}">${label}</button>`;
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
      ${c.pregador ? `<div class="culto-tema">🎤 ${escapeHtml(c.pregador)}</div>` : ""}
      ${c.eventoParte ? `<div class="culto-tema">📎 ${escapeHtml(c.eventoParte)}</div>` : ""}
      ${c.versiculo
        ? `<div class="culto-versiculo">"${escapeHtml(c.versiculo)}"</div>`
        : `<div class="culto-versiculo culto-versiculo-vazio">Versículo da pregação ainda não adicionado</div>`
      }
      ${c.origemPublica ? `<div class="culto-origem-form">📝 preenchido pelo formulário de líderes</div>` : ""}
      <div class="checklist-dia">
        ${renderChecklistItem(id, "foto", "📸 Foto", c.checklist?.foto)}
        ${renderChecklistItem(id, "story", "📱 Story", c.checklist?.story)}
        ${renderChecklistItem(id, "feed", "📰 Feed", c.checklist?.feed)}
      </div>
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
  contagemCultosPendentes = pendentes;
  atualizarBadgeApp(contagemCultosPendentes + contagemLideresRespondidos + contagemPedidosAbertos);

  const anelPreenchido = document.getElementById("anelPreenchido");
  const anelPct = document.getElementById("anelPct");
  if (anelPreenchido) {
    const pct = docs.length ? Math.round((postados / docs.length) * 100) : 0;
    const circunferencia = 327; // 2 * PI * 52
    const offset = circunferencia - (circunferencia * pct) / 100;
    anelPreenchido.style.strokeDashoffset = offset;
    anelPct.textContent = `${pct}%`;
  }

  listaCultos.querySelectorAll(".checklist-item").forEach((btn) => {
    btn.addEventListener("click", () => toggleChecklistItem(btn.dataset.culto, btn.dataset.chave, btn));
  });

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
  const dataInput = document.getElementById("cData").value; // yyyy-mm-dd
  const [ano, mes, dia] = dataInput.split("-").map(Number);
  const dataCulto = new Date(ano, mes - 1, dia, 12, 0); // meio-dia evita fuso

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

// ---------- Seção unificada "Pedidos" (líderes + ajuda interna) ----------
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
// (o toggle de abrir/fechar agora é único, ver seção "Pedidos" unificada mais abaixo)
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
      const statusLabel = { aguardando: "aguardando resposta", respondido: "respondido, revisar", aplicado: "já aplicado" };
      item.innerHTML = `
        <div class="solicitacao-info">
          <div class="solicitacao-titulo">${escapeHtml(s.titulo)}</div>
          <div class="solicitacao-status ${s.status}">${statusLabel[s.status] || s.status}</div>
        </div>
        ${s.status === "aguardando" ? `<button class="btn" data-id="${id}" data-acao="link">🔗 Link</button>` : ""}
        ${s.status === "respondido" ? `<button class="btn btn-mark" data-id="${id}" data-acao="ver">Ver</button>` : ""}
        <button class="btn btn-excluir" data-id="${id}" data-acao="excluir">🗑</button>
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
  } catch (e) {
    // usuário cancelou o compartilhamento, ignora
  }
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

  // Abre o modal de culto já preenchido com a resposta, pra revisão antes de salvar
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
  btn.textContent = "Preparando...";
  btn.disabled = true;

  const hoje = new Date();
  const dataFormatada = `${String(hoje.getDate()).padStart(2,"0")}/${String(hoje.getMonth()+1).padStart(2,"0")}`;

  let mensagem = `📋 *Pendências SINAL* — ${dataFormatada}\n`;

  // Cultos pendentes do mês em exibição
  const cultosPendentes = [...cultosCache.values()].filter((c) => c.status !== "postado");
  if (cultosPendentes.length > 0) {
    mensagem += `\n🎥 *Cultos pendentes:*\n`;
    cultosPendentes.forEach((c) => {
      const d = c.data.toDate();
      mensagem += `• ${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")} — ${c.tipo || "Culto"}\n`;
    });
  }

  // Cartazes pendentes (busca avulsa, só na hora de gerar)
  try {
    const snapCartazes = await getDocs(query(collection(db, "cartazes")));
    const cartazesPendentes = snapCartazes.docs
      .map((d) => d.data())
      .filter((c) => c.status !== "postado");
    if (cartazesPendentes.length > 0) {
      mensagem += `\n🖼️ *Cartazes pendentes:*\n`;
      cartazesPendentes.forEach((c) => {
        mensagem += `• ${c.titulo}\n`;
      });
    }
  } catch (e) {
    console.error("Erro ao buscar cartazes pendentes:", e);
  }

  // Pedidos de ajuda em aberto
  const pedidosAbertos = [...pedidosCache.values()].filter((p) => p.status === "aberto");
  if (pedidosAbertos.length > 0) {
    mensagem += `\n🆘 *Pedidos em aberto:*\n`;
    pedidosAbertos.forEach((p) => {
      mensagem += `• ${p.titulo}\n`;
    });
  }

  if (cultosPendentes.length === 0 && pedidosAbertos.length === 0) {
    mensagem += `\n✅ Tudo em dia por aqui!`;
  }

  const link = `https://wa.me/?text=${encodeURIComponent(mensagem)}`;
  window.open(link, "_blank");

  btn.textContent = "📤 Compartilhar pendências no zap";
  btn.disabled = false;
}
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
        acoes.innerHTML += `<button class="btn btn-mark" data-id="${id}" data-acao="assumir">Assumir</button>`;
      }
      if (p.status === "andamento") {
        acoes.innerHTML += `<button class="btn btn-mark" data-id="${id}" data-acao="feito">✓ Feito</button>`;
      }
      if (p.status === "feito" && !p.enviado) {
        acoes.innerHTML += `<button class="btn btn-primary" data-id="${id}" data-acao="enviado">📨 Marcar enviado</button>`;
      }
      acoes.innerHTML += `<button class="btn btn-excluir" data-id="${id}" data-acao="excluir">🗑</button>`;

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
}

async function marcarPedidoFeito(id) {
  await updateDoc(doc(db, "pedidos", id), {
    status: "feito",
    feitoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp()
  });
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
