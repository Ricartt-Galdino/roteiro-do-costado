export function registerReadTool(read:()=>unknown) {
 const context=(document as Document & {modelContext?:{registerTool:(tool:unknown)=>Promise<void>|void}}).modelContext;
 if(!context)return;
 try {Promise.resolve(context.registerTool({name:'read_costado_forecast',description:'Ler o roteiro, andamento e previsão atuais sem alterar dados.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute(input:unknown){if(!input||typeof input!=='object'||Object.keys(input).length)throw Error('Nenhum parâmetro é aceito.');return read();}})).catch(()=>{});}catch{/* API experimental, sem impacto no acompanhamento. */}
}
