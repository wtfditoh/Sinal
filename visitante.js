// Ativa o "modo visitante": esconde botões de criar/editar/excluir/marcar,
// deixando só leitura. Usado por quem tem papel "visitante" (ex: pastor,
// liderança que só quer acompanhar sem mexer em nada).
export function aplicarModoVisitante(usuario) {
  if (usuario.papel !== "visitante") return;

  document.body.classList.add("modo-visitante");

  const banner = document.createElement("div");
  banner.className = "banner-visitante";
  banner.textContent = "👁️ Modo visitante — só visualização";

  const appShell = document.querySelector(".app-shell");
  const main = document.querySelector("main");
  if (appShell && main) {
    appShell.insertBefore(banner, main);
  } else {
    document.body.prepend(banner);
  }
}
