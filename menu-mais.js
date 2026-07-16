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
        <span class="mais-icone"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3H4a1 1 0 0 0-1 1v5.59a2 2 0 0 0 .59 1.41l9.58 9.58a2 2 0 0 0 2.82 0l4.6-4.6a2 2 0 0 0 0-2.82Z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg></span>
        <span>Recursos <small>logos e senhas</small></span>
      </a>
      <a href="metricas.html" class="mais-item">
        <span class="mais-icone"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="5" width="3" height="13"/></svg></span>
        <span>Métricas <small>equipe e ranking</small></span>
      </a>
      <a href="tv.html" target="_blank" class="mais-item">
        <span class="mais-icone"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg></span>
        <span>Modo TV <small>painel pra monitor</small></span>
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
