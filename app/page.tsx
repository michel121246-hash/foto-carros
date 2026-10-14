'use client';
import {useState,useRef,useEffect} from 'react';
import {Aperture,ArrowUpRight,Upload,Check,Plus,ChevronRight,Sparkles,ImageIcon,Download,X,LoaderCircle,ShieldCheck,Maximize2,ArrowRight,RotateCcw} from 'lucide-react';
import {styles,ratios,type Ratio} from '@/lib/styles';
import {importPhoto} from '@/lib/import-photo';
import {validateFile} from '@/lib/validation';
type Photo=Awaited<ReturnType<typeof importPhoto>>;
type Result={id:string;style:string;url?:string;error?:string;status:'pending'|'done'|'error';ratio:Ratio};
export default function Studio(){
 const [photo,setPhoto]=useState<Photo|null>(null),[preview,setPreview]=useState<string|null>(null);
 const [selected,setSelected]=useState<string[]>(['proshot']),[ratio,setRatio]=useState<Ratio>('4:5');
 const [importing,setImporting]=useState(false),[generating,setGenerating]=useState(false),[error,setError]=useState('');
 const [results,setResults]=useState<Result[]>([]),[viewer,setViewer]=useState<string|null>(null),[help,setHelp]=useState(false),[password,setPassword]=useState('');
 const input=useRef<HTMLInputElement>(null), importId=useRef(0), photoUrl=useRef<string|null>(null),resultUrls=useRef<string[]>([]),controller=useRef<AbortController|null>(null);
 useEffect(()=>()=>{importId.current++;if(photoUrl.current)URL.revokeObjectURL(photoUrl.current);resultUrls.current.forEach(URL.revokeObjectURL);controller.current?.abort();},[]);
 useEffect(()=>{if(!viewer&&!help)return;const handler=(e:KeyboardEvent)=>{if(e.key==='Escape'){setViewer(null);setHelp(false);}};document.addEventListener('keydown',handler);return()=>document.removeEventListener('keydown',handler);},[viewer,help]);
 async function accept(file?:File){
  if(!file||generating)return;
  setError('');
  try{validateFile(file);}catch(e){setError((e as Error).message);return;}
  const id=++importId.current;
  setImporting(true);setPhoto(null);
  if(photoUrl.current)URL.revokeObjectURL(photoUrl.current);
  const immediate=URL.createObjectURL(file);photoUrl.current=immediate;setPreview(immediate);
  try{const imported=await importPhoto(file);if(id!==importId.current){URL.revokeObjectURL(imported.preview);return;}URL.revokeObjectURL(immediate);photoUrl.current=imported.preview;setPreview(imported.preview);setPhoto(imported);}
  catch(e){if(id===importId.current){URL.revokeObjectURL(immediate);photoUrl.current=null;setPreview(null);setError((e as Error).message);}}
  finally{if(id===importId.current)setImporting(false);}
 }
 function toggle(id:string){setSelected(previous=>previous.includes(id)?previous.filter(s=>s!==id):[...previous,id]);}
 async function generate(){
  if(!photo||!selected.length||generating||importing)return;
  setGenerating(true);setError('');
  resultUrls.current.forEach(URL.revokeObjectURL);resultUrls.current=[];
  const work=selected.map(style=>({id:crypto.randomUUID(),style,status:'pending' as const,ratio}));setResults(work);
  setTimeout(()=>document.getElementById('results')?.scrollIntoView({behavior:'smooth',block:'start'}),100);
  const abort=new AbortController();controller.current=abort;
  for(const item of work){
   if(abort.signal.aborted)break;
   try{
    const body=new FormData();body.append('image',photo.file);body.append('style',item.style);body.append('ratio',ratio);
    const response=await fetch('/api/edit',{method:'POST',headers:password?{'x-app-password':password}:{},body,signal:abort.signal});
    if(!response.ok){const message=await response.json().catch(()=>({error:'Falha na conexão com o servidor.'}));throw new Error(message.error||'Não foi possível gerar esta versão.');}
    if(!response.headers.get('content-type')?.startsWith('image/'))throw new Error('O servidor não retornou uma imagem válida.');
    const blob=await response.blob();const url=URL.createObjectURL(blob);resultUrls.current.push(url);
    setResults(previous=>previous.map(r=>r.id===item.id?{...r,status:'done',url}:r));
   }catch(e){const message=abort.signal.aborted?'Geração cancelada.':(e as Error).message;setResults(previous=>previous.map(r=>r.id===item.id?{...r,status:'error',error:message}:r));
    if(/configurad|senha|APP_PASSWORD|OPENAI_API_KEY/.test(message)){setResults(previous=>previous.map(r=>r.status==='pending'?{...r,status:'error',error:message}:r));break;}
   }
  }
  if(abort.signal.aborted)setResults(previous=>previous.map(r=>r.status==='pending'?{...r,status:'error',error:'Geração cancelada.'}:r));
  setGenerating(false);controller.current=null;
 }
 const finished=results.filter(r=>r.status==='done').length;
 return <>
  <header className="header"><a className="brand" href="/" aria-label="Auto Vision AI início"><span className="brand-icon"><Aperture size={25}/></span><span>AUTO VISION<span className="ai">AI</span></span></a><nav><a className="active" href="#studio">Estúdio</a><a href="#results">Resultados {finished>0&&<span className="nav-count">{finished}</span>}</a><button onClick={()=>setHelp(true)}>Como funciona</button></nav><div className="header-right"><span className="status-dot"/> Seu estúdio criativo</div></header>
  <main id="studio">
   <section className="intro"><div><div className="eyebrow"><span/> FOTOGRAFIA AUTOMOTIVA, REIMAGINADA</div><h1>Seu veículo.<br/>Uma nova <span>visão.</span></h1><p>Transforme suas fotos em imagens extraordinárias.<br className="desktop-br"/> Escolha o cenário. A inteligência artificial cuida do resto.</p></div><div className="intro-art"><img src="/styles/hero.jpg" alt="Fotografia editorial de um veículo esportivo"/><div className="art-shade"/><div className="art-label"><Sparkles size={15}/> A próxima perspectiva é sua <ArrowUpRight size={18}/></div><span className="art-corner">AUTO VISION / 01</span></div></section>
   <div className="workspace-heading"><div><span className="blue-line"/><h2>Crie algo extraordinário</h2></div><span>DA FOTO À NOVA PERSPECTIVA</span></div>
   <div className="workspace">
    <aside className="source-panel"><div className="step-heading"><span className="step">01</span><h3>Sua fotografia</h3></div>
     <input ref={input} id="vehicle-input" type="file" accept="image/jpeg,image/png,image/heic,image/heif,.jpg,.jpeg,.png,.heic,.heif" className="file-input" aria-label="Selecionar fotografia do veículo" disabled={generating} onChange={e=>{const file=e.target.files?.[0];e.target.value='';void accept(file);}}/>
     <div className={`upload-zone ${preview?'has-photo':''}`} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();void accept(e.dataTransfer.files[0]);}}>
      {preview?<><img className="photo-preview" src={preview} alt="Sua fotografia importada" onError={()=>{/* HEIC conversion supplies a compatible preview. */}}/>{importing&&<div className="preparing"><LoaderCircle className="spin"/> Preparando foto…</div>}<button className="change-photo" disabled={generating||importing} onClick={()=>input.current?.click()}><RotateCcw size={14}/> Trocar foto</button></>:<button className="upload-trigger" disabled={generating||importing} onClick={()=>input.current?.click()}><span className="upload-icon"><Upload size={27}/></span><strong>Comece com a sua foto</strong><span>Toque para escolher ou<br/>arraste sua imagem aqui</span><span className="upload-action">Selecionar fotografia <Plus size={15}/></span></button>}
     </div>
     <div className="file-meta">{photo?<><Check size={13}/><span title={photo.originalName}>{photo.originalName}</span><small>{photo.width} × {photo.height}</small></>:<><ImageIcon size={14}/><span>JPG, PNG ou HEIC</span><small>Até 20 MB</small></>}</div>
     {error&&<div role="alert" className="error-message">{error}</div>}
     <div className="source-tip"><ShieldCheck size={18}/><p>Seu carro continua sendo seu carro.<br/><span>A IA recebe instruções para preservar sua identidade e seus detalhes.</span></p></div>
     <div className="ratio-section"><div className="step-heading"><span className="step">03</span><h3>Proporção da imagem</h3></div><div className="ratio-options">{(Object.keys(ratios) as Ratio[]).map(value=><button key={value} aria-pressed={ratio===value} className={ratio===value?'selected':''} disabled={generating} onClick={()=>setRatio(value)}><span className="ratio-shape" style={{aspectRatio:value.replace(':','/'),height:value==='16:9'?16:24}}/>{value}</button>)}</div><p className="muted">{ratio==='1:1'?'Perfeito para posts quadrados':ratio==='4:5'?'Perfeito para o feed do Instagram':ratio==='9:16'?'Perfeito para Stories e Reels':'Perfeito para capas e telas amplas'}</p></div>
     <details className="access"><summary>Acesso ao estúdio</summary><label htmlFor="password">Senha definida pelo proprietário</label><input id="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" placeholder="Senha do estúdio"/><p>A senha protege o uso da geração. A chave da API permanece no servidor.</p></details>
    </aside>
    <section className="styles-panel"><div className="styles-heading"><div className="step-heading"><span className="step">02</span><h3>Escolha sua visão</h3></div><span className="selection-count">{selected.length} {selected.length===1?'estilo selecionado':'estilos selecionados'}</span></div><p className="styles-description">Uma foto, inúmeras possibilidades. Selecione um ou mais estilos.</p>
     <div className="style-grid">{styles.map((style,i)=><button key={style.id} className={`style-card ${selected.includes(style.id)?'chosen':''}`} onClick={()=>toggle(style.id)} disabled={generating} aria-pressed={selected.includes(style.id)}><div className="style-image"><span role="img" aria-label={`Referência visual do estilo ${style.name}`} className="style-reference" style={{backgroundPosition:`${(i%3)*50}% ${Math.floor(i/3)*50}%`}}/><span className="style-select">{selected.includes(style.id)?<Check size={15}/>:<Plus size={14}/>}</span>{i===0&&<span className="recommended">POPULAR</span>}</div><div className="style-text"><span className="style-tag">{style.tag}</span><h4>{style.name}<ArrowUpRight size={15}/></h4><p>{style.description}</p></div></button>)}</div><div className="example-note"><ImageIcon size={13}/> Imagens de referência. O resultado será criado a partir do seu veículo.</div>
    </section>
   </div>
   <section className="generate-bar"><div className="generate-summary"><span className="summary-icon"><Sparkles size={22}/></span><div><strong>{generating?'Criando sua nova visão…':'Tudo pronto para uma nova visão?'}</strong><p>{generating?`${finished} de ${selected.length} versões concluídas`:`${selected.length} ${selected.length===1?'versão':'versões'} · ${ratio} · Edição com inteligência artificial`}</p></div></div><div className="generate-actions">{generating?<button className="cancel" onClick={()=>controller.current?.abort()}>Cancelar</button>:<span className="generate-hint">{!photo?'Importe uma foto para começar':!selected.length?'Selecione ao menos um estilo':'Cada estilo gera uma edição'}</span>}<button className="primary" onClick={()=>void generate()} disabled={!photo||!selected.length||generating||importing}>{generating?<LoaderCircle className="spin" size={19}/>:<Sparkles size={19}/>} {generating?'Gerando versões…':'Gerar minhas imagens'} {!generating&&<ArrowRight size={19}/>}</button></div></section>
   <section id="results" className="results-section"><div className="result-heading"><div><div className="eyebrow">SUA GALERIA</div><h2>Uma foto. Novas possibilidades.</h2></div><span>{finished} {finished===1?'imagem pronta':'imagens prontas'}</span></div>{!results.length?<div className="empty-results"><div><ImageIcon size={25}/></div><p>Suas próximas grandes fotos começam aqui.</p><span>As imagens geradas aparecerão nesta galeria.</span></div>:<div className="results-grid">{results.map(result=><article className="result-card" key={result.id}><div className="result-image" style={{aspectRatio:result.ratio.replace(':','/')}}>{result.status==='pending'?<div className="result-state"><LoaderCircle className="spin"/><strong>{generating?'Aguardando edição':'Preparando'}</strong><span>A edição pode levar alguns minutos.</span></div>:result.url?<button onClick={()=>setViewer(result.url!)} aria-label="Ampliar resultado"><img src={result.url} alt={`Seu veículo no estilo ${styles.find(s=>s.id===result.style)?.name}`}/><span className="expand"><Maximize2 size={18}/></span></button>:<div className="result-state error"><X/><strong>Não foi possível gerar</strong><span>{result.error}</span></div>}</div><div className="result-caption"><div><strong>{styles.find(s=>s.id===result.style)?.name}</strong><span>{result.ratio} · JPEG</span></div>{result.url&&<a className="download" href={result.url} download={`auto-vision-${result.style}-${result.ratio.replace(':','x')}.jpg`} aria-label={`Baixar ${result.style}`}><Download size={19}/></a>}</div></article>)}</div>}</section>
   <footer><a href="#studio" className="footer-brand"><Aperture size={17}/> AUTO VISION AI</a><span>Novas perspectivas. A mesma paixão.</span><button onClick={()=>setHelp(true)}>Guia do estúdio <ChevronRight size={14}/></button></footer>
  </main>
  {(viewer||help)&&<div className="modal-backdrop" onClick={()=>{setViewer(null);setHelp(false);}}><div className={`modal ${viewer?'image-modal':''}`} role="dialog" aria-modal="true" aria-label={viewer?'Visualização da imagem':'Como funciona'} onClick={e=>e.stopPropagation()}><button className="modal-close" autoFocus onClick={()=>{setViewer(null);setHelp(false);}} aria-label="Fechar"><X/></button>{viewer?<><img src={viewer} alt="Resultado ampliado"/><a className="primary" href={viewer} download="auto-vision.jpg"><Download size={18}/> Baixar imagem</a></>:<><div className="eyebrow">AUTO VISION AI</div><h2>Seu estúdio, em três passos.</h2><ol><li><strong>Importe seu veículo.</strong><p>Escolha JPG, PNG ou HEIC de até 20 MB. A prévia aparece ao importar; arquivos HEIC podem precisar de alguns segundos para conversão.</p></li><li><strong>Escolha sua visão.</strong><p>Selecione vários cartões e uma proporção. Cada estilo cria uma versão independente.</p></li><li><strong>Gere e baixe.</strong><p>As edições usam uma API real e podem levar alguns minutos. Revise os detalhes do veículo antes de publicar. A IA pode alterar detalhes mesmo com instruções de preservação.</p></li></ol><p className="help-note">As fotografias são enviadas à OpenAI apenas ao gerar. Não mantemos fotos em um banco de dados. A geração depende da chave, dos créditos e das políticas da conta da API; há cobrança por edição.</p></>}</div></div>}
 </>;
}
