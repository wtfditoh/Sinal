const ICONE_OLHO = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>';
const ICONE_OLHO_FECHADO = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M6.61 6.61A18.5 18.5 0 0 0 1 12s4 8 11 8a9.26 9.26 0 0 0 5.39-1.61M14.12 14.12a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/></svg>';

// Liga o botão de olho em cada campo de senha da página.
// Uso no HTML: campo dentro de <div class="campo-senha">, com um
// <button type="button" class="toggle-senha" data-alvo="idDoInput">
export function iniciarToggleSenha() {
  document.querySelectorAll(".toggle-senha").forEach((btn) => {
    btn.innerHTML = ICONE_OLHO;
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.alvo);
      if (!input) return;
      const vaiMostrar = input.type === "password";
      input.type = vaiMostrar ? "text" : "password";
      btn.innerHTML = vaiMostrar ? ICONE_OLHO_FECHADO : ICONE_OLHO;
      btn.setAttribute("aria-label", vaiMostrar ? "Esconder senha" : "Mostrar senha");
    });
  });
}
