// Badge API: coloca um número no ícone do app na tela inicial (like contador
// de não lidas). Só funciona com o app instalado ("Adicionar à tela inicial"),
// e é atualizado toda vez que a pessoa abre o app — não é em tempo real,
// mas fica visível no ícone mesmo depois de fechar o app.
export function atualizarBadgeApp(contagem) {
  if (!("setAppBadge" in navigator)) return; // navegador não suporta, ignora silenciosamente

  try {
    if (contagem > 0) {
      navigator.setAppBadge(contagem);
    } else {
      navigator.clearAppBadge();
    }
  } catch (e) {
    // alguns navegadores lançam erro se o app não estiver instalado — ignora
  }
}
