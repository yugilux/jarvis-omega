import express from "express";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";
const app=express(), dir=path.dirname(fileURLToPath(import.meta.url));
app.use(express.json({limit:"30kb"})); app.use(express.static(path.join(dir,"public")));
const members=[
["Jin-Woo","Comandante e estrategista","calmo e estratégico"],
["Kaleb","Caos e humor","brincalhão e imprevisível"],
["Patrick Jane","Observação e análise","observador e lógico"],
["Thorfinn","Consciência e autocontrole","reflexivo e responsável"],
["Conselheira da Amizade","Amizade e empatia","acolhedora e honesta"]
];
app.get("/api/status",(_,r)=>r.json({configured:!!process.env.OPENAI_API_KEY}));
app.post("/api/round",async(req,res)=>{
 if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:"Falta configurar OPENAI_API_KEY nos Secrets do servidor. Nunca coloques a chave no site."});
 const prompt=String(req.body?.prompt||"").slice(0,2500), history=Array.isArray(req.body?.history)?req.body.history.slice(-12):[];
 const recent=history.map(x=>`${String(x.speaker).slice(0,40)}: ${String(x.text).slice(0,600)}`).join("\n");
 try{
  const ai=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
  const out=await ai.chat.completions.create({model:process.env.OPENAI_MODEL||"gpt-4o-mini",temperature:.9,response_format:{type:"json_object"},messages:[
   {role:"system",content:`És o motor do SHADOW COUNCIL Ω. Yugi é o Monarca Supremo. Membros: ${members.map(m=>m.join(" — ")).join("; ")}. Conversa em português brasileiro, com falas curtas, personalidade distinta e discordâncias respeitosas. Conteúdo seguro para adolescente. Retorna JSON válido: {"messages":[{"speaker":"nome exato","text":"fala de 1-3 frases"}]}. Cria 3 a 5 falas variadas por rodada. Usa apenas estes nomes: ${members.map(m=>m[0]).join(", ")}.`},
   {role:"user",content:`ORDEM/ASSUNTO DO MONARCA: ${prompt||"Continuem o debate com uma ideia nova."}\nHISTÓRICO RECENTE:\n${recent||"(início)"}`}
  ]});
  const parsed=JSON.parse(out.choices[0]?.message?.content||"{}");
  const messages=(parsed.messages||[]).filter(m=>members.some(x=>x[0]===m.speaker)&&typeof m.text==="string").slice(0,5);
  if(!messages.length)throw Error("Resposta vazia");
  res.json({messages});
 }catch(e){console.error(e.message);res.status(500).json({error:"Falha ao gerar a rodada. Confere a chave e tenta novamente."});}
});
app.listen(process.env.PORT||3000,"0.0.0.0",()=>console.log("SHADOW COUNCIL Ω online"));
