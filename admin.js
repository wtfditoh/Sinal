import { exigirLogin } from "./auth.js";


exigirLogin(async (usuario)=>{


document.getElementById("usuario").innerHTML =
"Usuário conectado";


document.getElementById("enviar")
.addEventListener("click", async ()=>{


const titulo = document.getElementById("titulo").value;

const mensagem = document.getElementById("mensagem").value;


if(!titulo || !mensagem){

alert("Preencha título e mensagem");

return;

}



const resposta = await fetch(
"/.netlify/functions/enviar-notificacao",
{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body: JSON.stringify({

titulo,
mensagem

})

});


const resultado = await resposta.json();


console.log(resultado);


alert("Notificação enviada!");



});


});
