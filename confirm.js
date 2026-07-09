let resolver = null;

function criarModalSeNaoExiste() {
  if (document.getElementById("confirmModalOverlay")) return;

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "confirmModalOverlay";
  overlay.innerHTML = `
    <div class="modal-sheet confirm-sheet">
      <div class="confirm-icone">🗑️</div>
      <div class="modal-title" id="confirmTitulo">Excluir?</div>
      <p class="confirm-mensagem" id="confirmMensagem"></p>
      <div class="modal-actions">
        <button type="button" class="btn" id="confirmCancelBtn">Cancelar</button>
        <button type="button" class="btn btn-danger" id="confirmOkBtn">Excluir</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) resolverModal(false);
  });
  document.getElementById("confirmCancelBtn").addEventListener("click", () => resolverModal(false));
  document.getElementById("confirmOkBtn").addEventListener("click", () => resolverModal(true));
}

function resolverModal(valor) {
  document.getElementById("confirmModalOverlay").classList.remove("active");
  if (resolver) resolver(valor);
  resolver = null;
}

// Retorna uma Promise<boolean> — true se confirmou, false se cancelou.
export function confirmarExclusao(mensagem, titulo = "Excluir?") {
  criarModalSeNaoExiste();
  document.getElementById("confirmTitulo").textContent = titulo;
  document.getElementById("confirmMensagem").textContent = mensagem;
  document.getElementById("confirmModalOverlay").classList.add("active");
  return new Promise((res) => { resolver = res; });
}
