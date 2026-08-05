import { db } from "./firebase-config.js";
import { exigirLogin, sair } from "./auth.js";
import { initPerfil } from "./perfil.js";
import { aplicarModoVisitante } from "./visitante.js";
import { iniciarMenuMais } from "./menu-mais.js";
import { baixarImagem } from "./baixar.js";
import {
  collection, query, orderBy, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const MESES_ABREV = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const DIAS_ABREV = ["dom","seg","ter","qua","qui","sex","sáb"];

function escapeHtml(texto) {
  if (!texto) return "";
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

iniciarMenuMais();

exigirLogin((usuario) => {
  initPerfil(usuario);
  aplicarModoVisitante(usuario);
  carregarEventos();
});

document.getElementById("logoutBtn").addEventListener("click", sair);

function formatarData(timestamp) {
  if (!timestamp) return "";
  const d = timestamp.toDate();
  return `${DIAS_ABREV[d.getDay()]}, ${String(d.getDate()).padStart(2,"0")} de ${MESES_ABREV[d.getMonth()]}`;
}

function diasRestantes(timestamp) {
  if (!timestamp) return null;
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const alvo = timestamp.toDate(); alvo.setHours(0,0,0,0);
  return Math.round((alvo - hoje) / (1000 * 60 * 60 * 24));
}

function carregarEventos() {
  const q = query(collection(db, "eventos"), orderBy("data", "asc"));
  onSnapshot(q, (snapshot) => {
    const container = document.getElementById("listaEventos");
    const empty = document.getElementById("emptyState");

    // Só mostra eventos de hoje pra frente (eventos passados somem sozinhos)
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const eventos = snapshot.docs.filter((d) => {
      const dt = d.data().data?.toDate();
      return dt && dt >= hoje;
    });

    if (eventos.length === 0) {
      container.innerHTML = "";
      empty.style.display = "block";
      return;
    }
    empty.style.display = "none";

    container.innerHTML = eventos.map((docSnap, index) => {
      const e = docSnap.data();
      const dias = diasRestantes(e.data);
      const label = dias === 0 ? "🔴 hoje" : dias === 1 ? "amanhã" : `em ${dias} dias`;

      return `
        <div class="cartaz-card" style="animation-delay:${index * 0.04}s; flex-direction:column;">
          ${e.banner ? `
            <div class="cartaz-thumb carregando" style="width:100%; height:150px; border-radius:10px; margin-bottom:12px;">
              <img src="${escapeHtml(e.banner)}" alt="" style="width:100%; height:100%; object-fit:cover;" onload="this.parentElement.classList.remove('carregando')" onerror="this.parentElement.classList.remove('carregando')">
            </div>
          ` : ""}
          <div class="cartaz-body" style="width:100%;">
            <div class="cartaz-titulo">${escapeHtml(e.nome)}</div>
            <div class="cartaz-lembrete">📅 ${formatarData(e.data)}${e.horario ? " às " + escapeHtml(e.horario) : ""} · ${label}</div>
            ${e.local ? `<div style="font-size:12.5px; color:var(--text-dim); margin-top:4px;">📍 ${escapeHtml(e.local)}</div>` : ""}
            ${e.descricao ? `<div style="font-size:13px; color:var(--text-dim); margin-top:8px; line-height:1.5;">${escapeHtml(e.descricao)}</div>` : ""}
            ${e.banner ? `
              <div class="cartaz-actions">
                <button class="btn btn-icone" data-baixar="${escapeHtml(e.banner)}" data-nome="${escapeHtml(e.nome)}" title="Baixar banner">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>
                </button>
              </div>
            ` : ""}
          </div>
        </div>
      `;
    }).join("");

    container.querySelectorAll("[data-baixar]").forEach((btn) => {
      btn.addEventListener("click", () => baixarImagem(btn.dataset.baixar, btn.dataset.nome, btn));
    });
  });
}
