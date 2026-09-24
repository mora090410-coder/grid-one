import { sha256Hex } from './crypto';
import { adminClient } from './http';

export interface FamilyEnv {
 VITE_SUPABASE_URL: string;
 VITE_SUPABASE_ANON_KEY: string;
 SUPABASE_SERVICE_ROLE_KEY?: string;
 PUBLIC_SITE_URL?: string;
}
export const familyResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
 status, headers: { 'Content-Type':'application/json', 'Cache-Control':'no-store', 'Referrer-Policy':'no-referrer', 'X-Content-Type-Options':'nosniff' },
});
export const familyAdmin = (env: FamilyEnv) => {
 if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('family_unavailable');
 return adminClient(env);
};
export const hashFamilyToken = sha256Hex;
export const newFamilyToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32)),byte=>byte.toString(16).padStart(2,'0')).join('');
export const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value==='object' && !Array.isArray(value);
export const validCells = (cells: unknown): cells is number[] => Array.isArray(cells) && cells.length>0 && cells.length<=100 && new Set(cells).size===cells.length && cells.every(index=>Number.isInteger(index)&&index>=0&&index<100);
export const validRevision = (value: unknown) => Number.isSafeInteger(value) && Number(value)>0;
export const validLabel = (value: unknown): value is string => typeof value==='string' && value.length>0 && value.length<=80 && value.trim()===value;
export const familyFailure = (error: unknown) => {
 const message=isRecord(error)&&typeof error.message==='string'?error.message:'';
 if(message.includes('revision_conflict')) return familyResponse({error:'This board changed. Your edits are still here. Reload the latest board before saving.',code:'REVISION_CONFLICT'},409);
 if(message.includes('family_board_locked')) return familyResponse({error:'This board is finalized. Contact the organizer for a correction.',code:'BOARD_LOCKED'},409);
 if(message.includes('family_access_denied')) return familyResponse({error:'This family link is unavailable or expired. Ask the organizer for a new link.'},403);
 if(message.includes('family_invalid_request')) return familyResponse({error:'Check the selected squares and entered names.'},400);
 return familyResponse({error:'Family editing is temporarily unavailable. Please try again.'},503);
};
/** Bounded JSON input, including requests without Content-Length. */
export const readFamilyBody = async (request: Request): Promise<Record<string,unknown> | null> => {
 if(Number(request.headers.get('Content-Length'))>24000) return null;
 const reader=request.body?.getReader(); if(!reader)return null;
 let text='';let size=0;const decoder=new TextDecoder();
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>24000){await reader.cancel();return null;}text+=decoder.decode(value,{stream:true});}
 text+=decoder.decode();
 try {const value:unknown=JSON.parse(text);return isRecord(value)?value:null;}catch{return null;}
};
