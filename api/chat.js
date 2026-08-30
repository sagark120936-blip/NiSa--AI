export default async function handler(req,res){
 if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
 try{
  const {message,image,mode}=req.body||{};
  if(!message&&!image)return res.status(400).json({error:"Message is required."});
  const key=process.env.GROQ_API_KEY;
  if(!key)return res.status(500).json({error:"GROQ_API_KEY is missing in Vercel."});
  const content=[{type:"text",text:message||"Analyze this image and give only the final answer. Do not show reasoning."}];
  if(image)content.push({type:"image_url",image_url:{url:image}});
  const response=await fetch("https://api.groq.com/openai/v1/chat/completions",{
   method:"POST",
   headers:{"Content-Type":"application/json","Authorization":`Bearer ${key}`},
   body:JSON.stringify({
    model:"qwen/qwen3.6-27b",
    messages:[
     {role:"system",content:`You are NiSa AI. Answer directly and clearly. Never output hidden reasoning, chain-of-thought, or <think> tags. If an image is provided, analyze what is visible and do not invent unclear text. Mode: ${mode||"Normal"}.`},
     {role:"user",content}
    ],
    reasoning_format:"hidden",
    temperature:.7,
    max_completion_tokens:2048
   })
  });
  const data=await response.json();
  if(!response.ok)return res.status(response.status).json({error:data?.error?.message||"Groq API error."});
  let answer=data?.choices?.[0]?.message?.content||"";
  answer=answer.replace(/<think>[\s\S]*?<\/think>/gi,"").trim();
  return res.status(200).json({answer});
 }catch(e){return res.status(500).json({error:e?.message||"Server error."})}
}