import sharp from 'sharp';
import {buildPrompt, ratios, type Ratio, styles} from './styles';
import {detectImage, MAX_API_UPLOAD} from './validation';
export class EditError extends Error {constructor(message:string,public status:number){super(message);}}
export function validateEdit(style:string,ratio:string) {
 if(!styles.some(s=>s.id===style)) throw new EditError('Escolha um estilo válido.',400);
 if(!Object.hasOwn(ratios,ratio)) throw new EditError('Escolha uma proporção válida.',400);
}
export async function editVehicle(file: File, style:string, ratio:Ratio, key:string, fetcher: typeof fetch = fetch) {
 validateEdit(style,ratio);
 if(file.size===0 || file.size>MAX_API_UPLOAD) throw new EditError('Envie uma foto válida de até 4 MB após preparação.',413);
 const bytes=Buffer.from(await file.arrayBuffer());
 const format=detectImage(bytes);
 if(format!=='jpeg' && format!=='png') throw new EditError('A foto precisa ser preparada como JPEG ou PNG. Importe-a novamente.',415);
 let source:Buffer;
 try {source=await sharp(bytes,{limitInputPixels:40_000_000}).rotate().resize({width:2048,height:2048,fit:'inside',withoutEnlargement:true}).jpeg({quality:90}).toBuffer();}
 catch {throw new EditError('Não foi possível ler a foto. O arquivo está danificado ou é grande demais.',422);}
 const body=new FormData();
 body.append('image',new Blob([new Uint8Array(source)],{type:'image/jpeg'}),'vehicle.jpg');
 body.append('model',process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1');
 body.append('prompt',buildPrompt(style,ratio));
 body.append('n','1'); body.append('quality','medium'); body.append('output_format','jpeg');
 body.append('size',ratio==='1:1'?'1024x1024':ratio==='16:9'?'1536x1024':'1024x1536');
 let response: Response;
 try {response=await fetcher('https://api.openai.com/v1/images/edits',{method:'POST',headers:{Authorization:`Bearer ${key}`},body,signal:AbortSignal.timeout(180_000)});}
 catch {throw new EditError('A API não respondeu a tempo. Tente novamente em alguns instantes.',504);}
 if(!response.ok) {
  const status=response.status;
  // Never forward provider payloads or credentials to the browser.
  throw new EditError(status===429?'A API atingiu seu limite ou está sem créditos. Verifique o faturamento e tente mais tarde.':status===401||status===403?'A configuração da API precisa ser verificada no servidor.':status===400?'A API não aceitou esta edição. Tente outra foto ou estilo.':'O serviço de edição está indisponível. Tente novamente mais tarde.',status===429?429:502);
 }
 const payload=await response.json();
 const base64=payload?.data?.[0]?.b64_json;
 if(typeof base64!=='string' || !base64.length || base64.length>30_000_000) throw new EditError('A API não retornou uma imagem válida.',502);
 try {
  const [width,height]=ratios[ratio];
  return await sharp(Buffer.from(base64,'base64'),{limitInputPixels:40_000_000}).resize(width,height,{fit:'cover',position:'centre'}).jpeg({quality:95}).toBuffer();
 } catch {throw new EditError('A imagem retornada pela API não pôde ser aberta.',502);}
}
