import { exigirLogin } from "./auth.js";


exigirLogin(async (usuario)=>{


console.log("Usuário:", usuario);


document.getElementById("usuario").innerHTML =
"Usuário conectado";


});
