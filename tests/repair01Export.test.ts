import { afterEach,expect,it,vi } from 'vitest';
import { shareBoardPng } from '../utils/boardImage';
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
it.each(['shared','cancelled','fallback'] as const)('native export %s contract does not confuse share with download',async mode=>{
 const click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
 const create=vi.fn(()=> 'blob:local-test'),revoke=vi.fn();
 vi.stubGlobal('URL',Object.assign(URL,{createObjectURL:create,revokeObjectURL:revoke}));
 Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
 const share=vi.fn(async()=>{if(mode==='cancelled')throw new DOMException('Cancelled','AbortError');if(mode==='fallback')throw new DOMException('Unavailable','NotAllowedError');});
 Object.defineProperty(navigator,'share',{configurable:true,value:share});
 expect(await shareBoardPng(new Blob(['local fixture'],{type:'image/png'}),'quarter.png')).toBe(mode==='fallback'?'downloaded':mode);
 expect(share).toHaveBeenCalledOnce();expect(click).toHaveBeenCalledTimes(mode==='fallback'?1:0);
 expect(create).toHaveBeenCalledTimes(mode==='fallback'?1:0);
 delete (navigator as any).share;delete (navigator as any).canShare;
});
