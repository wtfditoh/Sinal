// Menu "Mais": um sheet com as seções secundárias (Recursos, Métricas, Modo TV),
// pra não precisar de mais abas no rodapé conforme o app cresce.
export function iniciarMenuMais() {
  criarSheetSeNaoExiste();
  const btn = document.getElementById("btnMais");
  if (btn) btn.addEventListener("click", abrirMais);
}

function criarSheetSeNaoExiste() {
  if (document.getElementById("maisOverlay")) return;

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "maisOverlay";
  overlay.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-title">Mais opções</div>
      <a href="logos.html" class="mais-item">
        <span class="mais-icone">🏷️</span>
        <span>Recursos <small>(logos e senhas)</small></span>
      </a>
      <a href="metricas.html" class="mais-item">
        <span class="mais-icone">📊</span>
        <span>Métricas <small>(equipe e ranking)</small></span>
      </a>
      <a href="tv.html" target="_blank" class="mais-item">
        <span class="mais-icone">📺</span>
        <span>Modo TV <small>(painel pra monitor)</small></span>
      </a>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) fecharMais();
  });
}

function abrirMais() {
  document.getElementById("maisOverlay").classList.add("active");
}

function fecharMais() {
  document.getElementById("maisOverlay").classList.remove("active");
}
