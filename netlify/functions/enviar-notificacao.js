exports.handler = async (event)=>{


console.log("Recebi pedido de notificação");


const dados = JSON.parse(event.body);


console.log(dados);



return {

statusCode:200,

body:JSON.stringify({

ok:true,

mensagem:"Function funcionando"

})

};


};
