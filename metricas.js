import { db } from "./firebase-config.js";
import { exigirLogin, sair } from "./auth.js";
import { initPerfil } from "./perfil.js";
import {
  collection, query, orderBy, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const MESES_ABREV = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
let cultosGlobal = [];
let rankingGlobal = [];

function escapeHtml(texto) {
  if (!texto) return "";
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

exigirLogin((usuario) => {
  initPerfil(usuario);
  carregarMetricas();
});

document.getElementById("logoutBtn").addEventListener("click", sair);

async function carregarMetricas() {
  const snap = await getDocs(query(collection(db, "cultos"), orderBy("data", "asc")));
  const cultos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  cultosGlobal = cultos;

  const snapUsuarios = await getDocs(collection(db, "usuarios"));
  const usuarios = snapUsuarios.docs.map((d) => d.data());

  renderEquipe(usuarios);
  renderAniversarios(usuarios);

  if (cultos.length === 0) {
    document.getElementById("emptyState").style.display = "block";
    return;
  }

  renderGeral(cultos);
  renderStreak(cultos);
  renderPorMes(cultos);
  renderRanking(cultos);
}

function renderStreak(cultos) {
  const hoje = new Date();
  const chaveMesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth()).padStart(2, "0")}`;

  const grupos = new Map();
  cultos.forEach((c) => {
    if (!c.data) return;
    const d = c.data.toDate();
    const chave = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
    if (!grupos.has(chave)) grupos.set(chave, { total: 0, postados: 0 });
    const g = grupos.get(chave);
    g.total++;
    if (c.status === "postado") g.postados++;
  });

  // Só considera meses já encerrados (ignora o mês atual, que ainda tá em andamento)
  const chavesOrdenadas = [...grupos.keys()].filter((c) => c < chaveMesAtual).sort().reverse();

  let streak = 0;
  for (const chave of chavesOrdenadas) {
    const g = grupos.get(chave);
    if (g.total > 0 && g.postados === g.total) streak++;
    else break;
  }

  if (streak > 0) {
    document.getElementById("metricaStreakNum").textContent = streak;
    document.getElementById("metricaStreakLinha").style.display = "block";
  }
}

function renderGeral(cultos) {
  const postados = cultos.filter((c) => c.status === "postado");
  const pct = Math.round((postados.length / cultos.length) * 100);

  const circunferencia = 327;
  document.getElementById("anelGeralPreenchido").style.strokeDashoffset =
    circunferencia - (circunferencia * pct) / 100;
  document.getElementById("anelGeralPct").textContent = `${pct}%`;
  document.getElementById("metricaTotalCultos").textContent = cultos.length;
  document.getElementById("metricaTotalPostados").textContent = postados.length;

  // Tempo médio até postar (em dias), só considerando quem tem os dois timestamps
  const comAtraso = postados.filter((c) => c.data && c.postadoEm);
  if (comAtraso.length > 0) {
    const totalDias = comAtraso.reduce((soma, c) => {
      const diffMs = c.postadoEm.toDate() - c.data.toDate();
      return soma + diffMs / (1000 * 60 * 60 * 24);
    }, 0);
    const media = totalDias / comAtraso.length;
    document.getElementById("metricaAtrasoDias").textContent = media.toFixed(1);
    document.getElementById("metricaAtrasoLinha").style.display = "block";
  }
}

function renderPorMes(cultos) {
  const grupos = new Map(); // "YYYY-MM" -> { total, postados, label }
  cultos.forEach((c) => {
    if (!c.data) return;
    const d = c.data.toDate();
    const chave = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
    if (!grupos.has(chave)) {
      grupos.set(chave, { total: 0, postados: 0, label: `${MESES_ABREV[d.getMonth()]}/${String(d.getFullYear()).slice(2)}` });
    }
    const g = grupos.get(chave);
    g.total++;
    if (c.status === "postado") g.postados++;
  });

  const listaOrdenada = [...grupos.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 6);
  const container = document.getElementById("listaMeses");
  container.innerHTML = "";

  listaOrdenada.forEach(([chave, g], index) => {
    const pct = Math.round((g.postados / g.total) * 100);
    const linha = document.createElement("div");
    linha.className = "metrica-barra-linha";
    linha.style.animationDelay = `${index * 0.05}s`;
    linha.innerHTML = `
      <div class="metrica-barra-label">${g.label}</div>
      <div class="metrica-barra-trilho">
        <div class="metrica-barra-fill" style="width:${pct}%;"></div>
      </div>
      <div class="metrica-barra-valor">${g.postados}/${g.total}</div>
    `;
    container.appendChild(linha);
  });
}

function renderRanking(cultos) {
  const contagem = new Map();
  cultos.forEach((c) => {
    if (c.status === "postado" && c.postadoPor) {
      contagem.set(c.postadoPor, (contagem.get(c.postadoPor) || 0) + 1);
    }
  });

  const ranking = [...contagem.entries()].sort((a, b) => b[1] - a[1]);
  rankingGlobal = ranking;
  const container = document.getElementById("listaRanking");
  container.innerHTML = "";

  if (ranking.length === 0) {
    container.innerHTML = `<p style="color:var(--text-faint); font-size:13px;">Ninguém postou nenhum culto ainda.</p>`;
    return;
  }

  const max = ranking[0][1];
  const medalhas = ["🥇", "🥈", "🥉"];

  ranking.forEach(([nome, qtd], index) => {
    const pct = Math.round((qtd / max) * 100);
    const linha = document.createElement("div");
    linha.className = "metrica-barra-linha";
    linha.style.animationDelay = `${index * 0.05}s`;
    linha.innerHTML = `
      <div class="metrica-barra-label">${medalhas[index] || ""} ${escapeHtml(nome)}</div>
      <div class="metrica-barra-trilho">
        <div class="metrica-barra-fill amber" style="width:${pct}%;"></div>
      </div>
      <div class="metrica-barra-valor">${qtd}</div>
    `;
    container.appendChild(linha);
  });
}

// ---------- Equipe (perfis) ----------
function renderEquipe(usuarios) {
  const container = document.getElementById("equipeGrid");
  container.innerHTML = "";

  usuarios.forEach((u, index) => {
    const iniciais = (u.nome || "?").trim().charAt(0).toUpperCase();

    const item = document.createElement("button");
    item.className = "equipe-membro";
    item.style.animationDelay = `${index * 0.03}s`;
    item.innerHTML = `
      <div class="equipe-avatar">
        ${u.fotoUrl ? `<img src="${escapeHtml(u.fotoUrl)}" alt="">` : `<span>${iniciais}</span>`}
      </div>
      <div class="equipe-nome">${escapeHtml(u.nome) || "—"}</div>
    `;
    item.addEventListener("click", () => abrirPerfilMembro(u));
    container.appendChild(item);
  });
}

// ---------- Aniversários ----------
function renderAniversarios(usuarios) {
  const hoje = new Date();
  const hojeDia = hoje.getDate();
  const hojeMes = hoje.getMonth() + 1;

  const comAniversario = usuarios
    .filter((u) => u.aniversarioDia && u.aniversarioMes)
    .map((u) => {
      // calcula quantos dias faltam pro próximo aniversário, dando a volta no ano se preciso
      let diasRestantes = diferencaEmDias(hojeDia, hojeMes, u.aniversarioDia, u.aniversarioMes);
      return { ...u, diasRestantes };
    })
    .sort((a, b) => a.diasRestantes - b.diasRestantes)
    .slice(0, 5);

  const container = document.getElementById("listaAniversarios");
  container.innerHTML = "";

  if (comAniversario.length === 0) {
    container.innerHTML = `<p style="color:var(--text-faint); font-size:13px;">Ninguém cadastrou aniversário ainda.</p>`;
    return;
  }

  const MESES_NOME = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

  comAniversario.forEach((u, index) => {
    const iniciais = (u.nome || "?").trim().charAt(0).toUpperCase();
    const ehHoje = u.diasRestantes === 0;
    const label = ehHoje ? "🎉 hoje!" : u.diasRestantes === 1 ? "amanhã" : `em ${u.diasRestantes} dias`;

    const item = document.createElement("div");
    item.className = `aniversario-item ${ehHoje ? "hoje" : ""}`;
    item.style.animationDelay = `${index * 0.05}s`;
    item.innerHTML = `
      <div class="aniversario-avatar">
        ${u.fotoUrl ? `<img src="${escapeHtml(u.fotoUrl)}" alt="">` : `<span>${iniciais}</span>`}
      </div>
      <div class="aniversario-info">
        <div class="aniversario-nome">${escapeHtml(u.nome)}</div>
        <div class="aniversario-data">${String(u.aniversarioDia).padStart(2,"0")} de ${MESES_NOME[u.aniversarioMes-1]} · ${label}</div>
      </div>
    `;
    container.appendChild(item);
  });
}

function diferencaEmDias(hojeDia, hojeMes, aniDia, aniMes) {
  const anoBase = 2024; // ano bissexto neutro, só pra calcular a diferença de datas
  const hoje = new Date(anoBase, hojeMes - 1, hojeDia);
  let alvo = new Date(anoBase, aniMes - 1, aniDia);
  if (alvo < hoje) alvo = new Date(anoBase + 1, aniMes - 1, aniDia);
  return Math.round((alvo - hoje) / (1000 * 60 * 60 * 24));
}

function abrirPerfilMembro(u) {
  const iniciais = (u.nome || "?").trim().charAt(0).toUpperCase();
  document.getElementById("perfilMembroAvatar").innerHTML = u.fotoUrl
    ? `<img src="${escapeHtml(u.fotoUrl)}" alt="">`
    : `<span>${iniciais}</span>`;
  document.getElementById("perfilMembroNome").textContent = u.nome || "—";
  document.getElementById("perfilMembroPapel").textContent = u.papel === "admin" ? "administrador" : "membro da equipe";

  const postadosPorEla = cultosGlobal.filter((c) => c.status === "postado" && c.postadoPor === u.nome).length;
  document.getElementById("perfilMembroPostados").textContent = postadosPorEla;

  const posicao = rankingGlobal.findIndex(([nome]) => nome === u.nome);
  document.getElementById("perfilMembroPosicao").textContent = posicao >= 0 ? `${posicao + 1}º` : "—";

  document.getElementById("perfilMembroOverlay").classList.add("active");
}

document.getElementById("perfilMembroFecharBtn").addEventListener("click", () => {
  document.getElementById("perfilMembroOverlay").classList.remove("active");
});
document.getElementById("perfilMembroOverlay").addEventListener("click", (e) => {
  if (e.target === document.getElementById("perfilMembroOverlay")) {
    document.getElementById("perfilMembroOverlay").classList.remove("active");
  }
});
