import { exigirLogin } from "./auth.js";


exigirLogin(async (usuario)=>{


console.log("Admin conectado:", usuario.uid);


document.getElementById("usuario").innerHTML =
"Logado: " + usuario.email;



});
