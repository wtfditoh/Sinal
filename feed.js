import { db } from "./firebase-config.js";
import {
  collection, query, orderBy, limit, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function escapeHtml(texto) {
  if (!texto) return "";
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

function tempoRelativo(timestamp) {
  if (!timestamp) return "";
  const agora = Date.now();
  const alvo = timestamp.toDate().getTime();
  const diffMin = Math.round((agora - alvo) / 60000);

  if (diffMin < 1) return "agora mesmo";
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffHoras = Math.round(diffMin / 60);
  if (diffHoras < 24) return `há ${diffHoras}h`;
  const diffDias = Math.round(diffHoras / 24);
  return `há ${diffDias}d`;
}

// Monta o feed dentro do elemento com o id passado. Mantém-se atualizado sozinho.
export function iniciarFeedAtividades(idContainer) {
  const container = document.getElementById(idContainer);
  if (!container) return;

  const q = query(collection(db, "atividades"), orderBy("criadoEm", "desc"), limit(15));
  onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      container.innerHTML = `<p style="color:var(--text-faint); font-size:13px;">Nenhuma atividade ainda.</p>`;
      return;
    }
    container.innerHTML = snapshot.docs.map((docSnap) => {
      const a = docSnap.data();
      return `
        <div class="atividade-item">
          <div class="atividade-ponto"></div>
          <div class="atividade-texto">
            <strong>${escapeHtml(a.usuario)}</strong> ${escapeHtml(a.texto)}
          </div>
          <div class="atividade-tempo">${tempoRelativo(a.criadoEm)}</div>
        </div>
      `;
    }).join("");
  });
}
