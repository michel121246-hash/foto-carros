import {timingSafeEqual} from 'node:crypto';
import {EditError,editVehicle,validateEdit} from '@/lib/editor';
import type {Ratio} from '@/lib/styles';
export const runtime='nodejs';
export const maxDuration=300;
export async function POST(request:Request) {
 const json=(message:string,status:number)=>Response.json({error:message},{status,headers:{'Cache-Control':'no-store'}});
 const origin=request.headers.get('origin');
 const expectedHost=request.headers.get('host') || new URL(request.url).host;
 let validOrigin=false;
 try { const parsed=new URL(origin || ''); validOrigin=['https:','http:'].includes(parsed.protocol) && parsed.host===expectedHost; } catch {}
 if(!validOrigin) return json('Origem da solicitação inválida.',403);
 if(!process.env.OPENAI_API_KEY) return json('A geração ainda não está configurada. Adicione OPENAI_API_KEY nos segredos do servidor.',503);
 if(process.env.NODE_ENV==='production' && !process.env.APP_PASSWORD) return json('Configure APP_PASSWORD no servidor para proteger a geração.',503);
 if(process.env.APP_PASSWORD) {
  const supplied=request.headers.get('x-app-password')||'';
  const expected=process.env.APP_PASSWORD;
  const a=Buffer.from(supplied),b=Buffer.from(expected);
  if(a.length!==b.length || !timingSafeEqual(a,b)) return json('Senha do estúdio incorreta.',401);
 }
 if(Number(request.headers.get('content-length')||0)>4.5*1024*1024) return json('O arquivo preparado excede o limite de envio.',413);
 try {
  const form=await request.formData(); const file=form.get('image'); const style=form.get('style');const ratio=form.get('ratio');
  if(!(file instanceof File)||typeof style!=='string'||typeof ratio!=='string') return json('Envie uma foto, um estilo e uma proporção.',400);
  validateEdit(style,ratio);
  const result=await editVehicle(file,style,ratio as Ratio,process.env.OPENAI_API_KEY);
  return new Response(new Uint8Array(result),{headers:{'Content-Type':'image/jpeg','Cache-Control':'no-store','Content-Disposition':`attachment; filename="auto-vision-${style}-${ratio.replace(':','x')}.jpg"`}});
 } catch(error) {return json(error instanceof EditError?error.message:'Não foi possível processar o envio. Importe a foto novamente.',error instanceof EditError?error.status:400);}
}
