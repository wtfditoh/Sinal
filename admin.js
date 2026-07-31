// ===============================
// SINAL ADMIN • admin.js
// PARTE 1/4
// ===============================


// Firebase

import { 
  auth, 
  db 
} from "./firebase-config.js";


import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ===============================
// VARIÁVEIS
// ===============================


let usuarioAtual = null;


let tituloAtual = "";
let mensagemAtual = "";



// ===============================
// ELEMENTOS
// ===============================


const tituloInput = document.getElementById("titulo");

const mensagemInput = document.getElementById("mensagem");


const tituloCount = document.getElementById("tituloCount");

const mensagemCount = document.getElementById("mensagemCount");



const previewTitulo = document.getElementById("previewTitulo");

const previewMensagem = document.getElementById("previewMensagem");




// ===============================
// VERIFICA LOGIN ADMIN
// ===============================


onAuthStateChanged(auth, (usuario)=>{


    if(!usuario){

        window.location.href = "index.html";

        return;

    }


    usuarioAtual = usuario;


    console.log(
        "Admin conectado:",
        usuario.email
    );


});




// ===============================
// CONTADORES DE TEXTO
// ===============================


if(tituloInput){


    tituloInput.addEventListener(
        "input",
        ()=>{


            tituloAtual = tituloInput.value;


            tituloCount.textContent =
            tituloAtual.length;



            atualizarPreview();


        }

    );


}



if(mensagemInput){


    mensagemInput.addEventListener(
        "input",
        ()=>{


            mensagemAtual = mensagemInput.value;


            mensagemCount.textContent =
            mensagemAtual.length;



            atualizarPreview();


        }

    );


}



// ===============================
// PREVIEW
// ===============================


function atualizarPreview(){


    if(
        previewTitulo &&
        previewMensagem
    ){


        previewTitulo.textContent =
        tituloAtual ||
        "Título da notificação";



        previewMensagem.textContent =
        mensagemAtual ||
        "A mensagem aparecerá aqui conforme você digita.";


    }


}

// ===============================
// CHIPS DE MENSAGENS RÁPIDAS
// ===============================


const chips = document.querySelectorAll(".chip");

chips.forEach((chip)=>{

    chip.addEventListener("click",()=>{

        const titulo = chip.dataset.title;
        const mensagem = chip.dataset.message;


        tituloInput.value = titulo;
        mensagemInput.value = mensagem;


        // Atualiza as variáveis
        tituloAtual = titulo;
        mensagemAtual = mensagem;


        // Atualiza contadores
        tituloCount.textContent = titulo.length;
        mensagemCount.textContent = mensagem.length;


        // Atualiza preview
        atualizarPreview();


        // Dispara evento para o sistema reconhecer a mudança
        tituloInput.dispatchEvent(new Event("input"));
        mensagemInput.dispatchEvent(new Event("input"));


    });

});



// ===============================
// MODAL DE CONFIRMAÇÃO
// ===============================


const btnEnviar =
document.getElementById("btnEnviar");


const confirmModal =
document.getElementById("confirmModal");


const cancelarEnvio =
document.getElementById("cancelarEnvio");


const confirmarEnvio =
document.getElementById("confirmarEnvio");





if(btnEnviar){


    btnEnviar.addEventListener(
        "click",
        ()=>{


            if(
                !tituloAtual ||
                !mensagemAtual
            ){

                mostrarToast(
                    "Atenção",
                    "Preencha o título e a mensagem."
                );

                return;

            }



            confirmModal.classList.remove(
                "hidden"
            );


        }

    );


}





if(cancelarEnvio){


    cancelarEnvio.addEventListener(
        "click",
        ()=>{


            confirmModal.classList.add(
                "hidden"
            );


        }

    );


}





if(confirmarEnvio){


    confirmarEnvio.addEventListener(
        "click",
        ()=>{


            confirmModal.classList.add(
                "hidden"
            );


            enviarNotificacao();


        }

    );


}



// ===============================
// FUNÇÃO TOAST
// ===============================


function mostrarToast(
    titulo,
    mensagem
){


    const toast =
    document.getElementById("toast");


    const toastTitulo =
    document.getElementById("toastTitulo");


    const toastMensagem =
    document.getElementById("toastMensagem");



    toastTitulo.textContent =
    titulo;


    toastMensagem.textContent =
    mensagem;



    toast.classList.remove(
        "hidden"
    );



    setTimeout(()=>{


        toast.classList.add(
            "hidden"
        );


    },4000);


}

// ===============================
// ENVIO DA NOTIFICAÇÃO
// ===============================


async function enviarNotificacao(){


    const btnText =
    document.getElementById("btnText");


    const btnIcon =
    document.getElementById("btnIcon");


    const loadingScreen =
    document.getElementById("loadingScreen");



    try{


        // Loading


        if(loadingScreen){

            loadingScreen.classList.remove(
                "hidden"
            );

        }



        if(btnText){

            btnText.textContent =
            "Enviando...";

        }


        if(btnIcon){

            btnIcon.textContent =
            "⏳";

        }




        // Salva histórico no Firestore


        const registro =
        await addDoc(
            collection(db,"notificacoes"),
            {


                titulo: tituloAtual,


                mensagem: mensagemAtual,


                enviadoPor:
                usuarioAtual?.email || "admin",



                data:
                serverTimestamp(),



                totalEnviados:
                0



            }

        );





        // Chama Netlify Function
        // responsável pelo FCM


        const resposta =
        await fetch(
    "/.netlify/functions/enviar-notificacao",
            {

                method:"POST",


                headers:{

                    "Content-Type":
                    "application/json"

                },


                body:JSON.stringify({

                    titulo:
                    tituloAtual,


                    mensagem:
                    mensagemAtual,


                    id:
                    registro.id


                })

            }

        );




        if(!resposta.ok){

            throw new Error(
                "Falha no envio"
            );

        }




        mostrarToast(
            "Sucesso",
            "Notificação enviada para os membros."
        );




        // Limpa campos


        tituloInput.value="";

        mensagemInput.value="";


        tituloAtual="";

        mensagemAtual="";



        tituloCount.textContent="0";

        mensagemCount.textContent="0";



        atualizarPreview();




    }catch(error){


        console.error(
            "Erro ao enviar:",
            error
        );



        mostrarToast(
    "Erro",
    error.message
);



    }finally{


        if(loadingScreen){

            loadingScreen.classList.add(
                "hidden"
            );

        }


        if(btnText){

            btnText.textContent =
            "Enviar notificação";

        }


        if(btnIcon){

            btnIcon.textContent =
            "🚀";

        }


    }


}

// ===============================
// HISTÓRICO DE NOTIFICAÇÕES
// ===============================



// Elementos


const historico =
document.getElementById("historico");


const deviceCount =
document.getElementById("deviceCount");


const lastSend =
document.getElementById("lastSend");


const todayCount =
document.getElementById("todayCount");




// ===============================
// CARREGAR HISTÓRICO
// ===============================


async function carregarHistorico(){


    if(!historico) return;



    try{


        const q =
        query(

            collection(db,"notificacoes"),

            orderBy(
                "data",
                "desc"
            ),

            limit(20)

        );



        const resultado =
        await getDocs(q);



        if(resultado.empty){


            return;


        }



        historico.innerHTML="";



        resultado.forEach((item)=>{


            const dados =
            item.data();



            const data =
            dados.data?.toDate
            ? dados.data.toDate()
            : null;



            historico.innerHTML += `


            <div class="history-item">


                <h4>
                    ${dados.titulo}
                </h4>


                <p>
                    ${dados.mensagem}
                </p>


                <small>

                    ${
                        data
                        ? data.toLocaleString("pt-BR")
                        : "Agora"

                    }

                </small>


            </div>


            `;


        });



    }catch(error){


        console.error(
            "Erro histórico:",
            error
        );


    }


}




// ===============================
// ATUALIZAR DASHBOARD
// ===============================


async function atualizarDashboard(){



    try{


        const q =
        query(

            collection(db,"notificacoes"),

            orderBy(
                "data",
                "desc"
            ),

            limit(1)

        );



        const resultado =
        await getDocs(q);



        if(!resultado.empty){


            const ultima =
            resultado.docs[0].data();



            lastSend.textContent =
            "Agora";


        }




        // Aqui depois podemos ligar
        // com a coleção de tokens FCM


        deviceCount.textContent =
        "--";



        todayCount.textContent =
        resultado.size;



    }catch(error){


        console.error(
            "Erro dashboard:",
            error
        );


    }


}




// ===============================
// INICIAR PAINEL
// ===============================


carregarHistorico();

atualizarDashboard();
