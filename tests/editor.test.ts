import {describe,it,expect,vi,afterEach} from 'vitest';
import sharp from 'sharp';
import {validateFile,detectImage,MAX_UPLOAD} from '../lib/validation';
import {editVehicle,validateEdit} from '../lib/editor';
import {buildPrompt,ratios} from '../lib/styles';
import {POST} from '../app/api/edit/route';
afterEach(()=>vi.unstubAllEnvs());
describe('import validation for iPhone',()=>{
 it('accepts uppercase HEIC and blank MIME from Files',()=>expect(validateFile({name:'IMG_001.HEIC',size:40,type:''})).toBe('heic'));
 it('accepts HEIF MIME without an extension',()=>expect(validateFile({name:'image',size:40,type:'image/heif'})).toBe('heic'));
 it('accepts JPEG selected from Photos',()=>expect(validateFile({name:'IMG.JPG',size:40,type:'image/jpeg'})).toBe('standard'));
 it('rejects unsupported, empty and oversized files',()=>{
  expect(()=>validateFile({name:'car.pdf',size:20,type:'application/pdf'})).toThrow('Formato');
  expect(()=>validateFile({name:'car.jpg',size:0,type:''})).toThrow('vazio');
  expect(()=>validateFile({name:'car.jpg',size:MAX_UPLOAD+1,type:''})).toThrow('20 MB');
 });
 it('sniffs content rather than trusting the extension',()=>{
  expect(detectImage(new Uint8Array([255,216,255,224]))).toBe('jpeg');
  expect(detectImage(new TextEncoder().encode('not an image'))).toBeNull();
  expect(detectImage(new Uint8Array([137,80,78,71,13,10,26,10]))).toBe('png');
 });
});
describe('real image edit adapter',()=>{
 it('rejects arbitrary style and ratio input',()=>{
  expect(()=>validateEdit('injected','1:1')).toThrow();
  expect(()=>validateEdit('proshot','__proto__')).toThrow();
 });
 it('includes vehicle identity and selected composition instructions',()=>{
  expect(buildPrompt('rolling','16:9')).toContain('Preserve the exact vehicle identity');
  expect(buildPrompt('rolling','16:9')).toContain('motion blur');
 });
 it.each(Object.keys(ratios))('sends source to edit API and returns exact %s ratio',async ratio=>{
  const input=await sharp({create:{width:300,height:200,channels:3,background:'#123456'}}).jpeg().toBuffer();
  const output=await sharp({create:{width:300,height:200,channels:3,background:'#abcdef'}}).png().toBuffer();
  const fetcher=vi.fn(async()=>Response.json({data:[{b64_json:output.toString('base64')}]}));
  const result=await editVehicle(new File([new Uint8Array(input)],'vehicle.jpg',{type:'image/jpeg'}),'proshot',ratio as keyof typeof ratios,'server-key',fetcher);
  const call=fetcher.mock.calls as unknown as [string,RequestInit][];
  expect(call[0][0]).toBe('https://api.openai.com/v1/images/edits');
  expect((call[0][1].body as FormData).get('image')).toBeInstanceOf(File);
  expect((call[0][1].body as FormData).get('n')).toBe('1');
  const meta=await sharp(result).metadata();expect([meta.width,meta.height]).toEqual(ratios[ratio as keyof typeof ratios]);
 });
 it('rejects corrupt input before calling the provider',async()=>{
  const fetcher=vi.fn();
  await expect(editVehicle(new File(['fake'],'fake.jpg'),'proshot','1:1','key',fetcher)).rejects.toThrow('JPEG');
  expect(fetcher).not.toHaveBeenCalled();
 });
 it('maps quota errors without exposing provider responses',async()=>{
  const input=await sharp({create:{width:30,height:20,channels:3,background:'#000'}}).jpeg().toBuffer();
  const fetcher=vi.fn(async()=>Response.json({error:{message:'private provider message'}},{status:429}));
  await expect(editVehicle(new File([new Uint8Array(input)],'car.jpg'),'proshot','1:1','secret',fetcher)).rejects.toThrow('créditos');
 });
});
describe('server protection',()=>{
 it('rejects cross-origin requests',async()=>{
  const res=await POST(new Request('https://studio.test/api/edit',{method:'POST',headers:{origin:'https://evil.test'}}));expect(res.status).toBe(403);
 });
 it('returns honest configuration error without a key',async()=>{
  vi.stubEnv('OPENAI_API_KEY','');const res=await POST(new Request('https://studio.test/api/edit',{method:'POST',headers:{origin:'https://studio.test'}}));expect(res.status).toBe(503);expect(await res.text()).toContain('OPENAI_API_KEY');
 });
 it('accepts same-origin behind a proxy with a different internal URL',async()=>{
  vi.stubEnv('OPENAI_API_KEY','');
  const res=await POST(new Request('http://0.0.0.0:3000/api/edit',{method:'POST',headers:{origin:'https://studio.test',host:'studio.test'}}));
  expect(res.status).toBe(503);expect(await res.text()).toContain('OPENAI_API_KEY');
 });
 it('protects configured API with server password',async()=>{
  vi.stubEnv('OPENAI_API_KEY','private-key');vi.stubEnv('APP_PASSWORD','secret');
  const res=await POST(new Request('https://studio.test/api/edit',{method:'POST',headers:{origin:'https://studio.test','x-app-password':'wrong'}}));expect(res.status).toBe(401);expect(await res.text()).not.toContain('private-key');
 });
 it('requires a password in production',async()=>{
  vi.stubEnv('NODE_ENV','production');vi.stubEnv('OPENAI_API_KEY','key');vi.stubEnv('APP_PASSWORD','');
  const res=await POST(new Request('https://studio.test/api/edit',{method:'POST',headers:{origin:'https://studio.test'}}));expect(res.status).toBe(503);
 });
});
