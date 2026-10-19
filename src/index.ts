import { execFile,spawn } from 'node:child_process';import { promisify,isDeepStrictEqual } from 'node:util';import { mkdtemp,writeFile,rm,mkdir } from 'node:fs/promises';import { tmpdir } from 'node:os';import path from 'node:path';import { randomUUID } from 'node:crypto';
import { createEvidence,safeReadFile,assertBounded,parseJson,redactText } from '@zofai/evidence-spec';import type {Evidence,JsonValue} from '@zofai/evidence-spec';
import {getEvaluationTask} from '@zofai/reliability-bench';import type {EvaluationTask} from '@zofai/reliability-bench';
export const SANDBOX_IMAGE='node@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c';
const exec=promisify(execFile);const MAX_SOURCE_BYTES=128*1024;const MAX_OUTPUT_BYTES=64*1024;
export interface EvaluationOptions {root:string;candidate:string;task:string|EvaluationTask;timeoutMs?:number;agent?:{name:string;version?:string}}
export interface EvaluationResult {taskId:string;outcomes:Array<{name:string;status:'passed'|'failed'|'error';reason:'MATCH'|'MISMATCH'|'CANDIDATE_ERROR'|'TIMEOUT'|'OUTPUT_LIMIT'|'SANDBOX_UNAVAILABLE'|'CLEANUP_UNCONFIRMED'}>;evidence:Evidence}
/** Bounded public data-only task format. No shell commands, harness code, imports or endpoint fields. */
export function validateTask(value:unknown):EvaluationTask{
 assertBounded(value);if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid evaluation task.');
 const t=value as Record<string,unknown>;
 if(t.version!=='1.0.0'||typeof t.id!=='string'||!(/^[a-z0-9][a-z0-9-]{0,99}$/).test(t.id)||typeof t.description!=='string'||t.description.length>1000||!Array.isArray(t.cases)||!t.cases.length||t.cases.length>32||Object.keys(t).some(k=>!['version','id','description','cases'].includes(k)))throw new Error('Invalid evaluation task.');
 for(const item of t.cases){if(!item||typeof item!=='object'||Array.isArray(item))throw new Error('Invalid test case.');const c=item as Record<string,unknown>;if(typeof c.name!=='string'||!c.name||c.name.length>200||!Object.hasOwn(c,'input')||!Object.hasOwn(c,'expected')||Object.keys(c).some(k=>!['name','input','expected'].includes(k)))throw new Error('Invalid test case.');if(Buffer.byteLength(JSON.stringify(c))>32*1024)throw new Error('Test case exceeds limit.');}
 return structuredClone(value) as EvaluationTask;
}
export function sandboxArguments(directory:string,name:string):string[]{
 if(!path.isAbsolute(directory)||/[\x00-\x1f,]/.test(directory)||!/^zof-eval-[a-z0-9-]+$/.test(name))throw new Error('Invalid sandbox path or name.');
 return ['run','--rm','--pull=never','--name',name,'--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--pids-limit=32','--memory=128m','--memory-swap=128m','--cpus=0.5','--user=65534:65534','--tmpfs=/tmp:rw,noexec,nosuid,size=16m','--workdir=/task','--mount',`type=bind,src=${directory},dst=/task,readonly`,SANDBOX_IMAGE,'node','--max-old-space-size=64','/task/runner.mjs'];
}
const harness="import fs from 'node:fs'; const write=process.stdout.write.bind(process.stdout);const stringify=JSON.stringify; const input=JSON.parse(fs.readFileSync('/task/input.json','utf8'));try{const module=await import('/task/candidate.mjs');if(typeof module.solve!=='function')process.exit(41);const output=await module.solve(input);const text=stringify(output);if(typeof text!=='string')process.exit(42);write(text);}catch{process.exit(43);}";
async function ready():Promise<string|undefined>{try{
 const context=await exec('docker',['context','inspect','--format','{{(index .Endpoints "docker").Host}}'],{timeout:5000,maxBuffer:4096});
 // Only local Unix/named-pipe engines are supported. Never redirect evaluation to a remote endpoint.
 const endpoint=process.env.DOCKER_HOST??context.stdout.trim();if(!endpoint.startsWith('unix://')&&!endpoint.startsWith('npipe://'))return;
 await exec('docker',['--host',endpoint,'image','inspect',SANDBOX_IMAGE,'--format','{{.Id}}'],{timeout:5000,maxBuffer:4096});return endpoint;
}catch{return;}}
async function runOne(directory:string,timeoutMs:number,endpoint:string):Promise<{reason:EvaluationResult['outcomes'][number]['reason'];value?:unknown}>{
 const name=`zof-eval-${randomUUID()}`;let result:Awaited<ReturnType<typeof runOne>>={reason:'CANDIDATE_ERROR'};
 try{
  result=await new Promise(resolve=>{
   const child=spawn('docker',['--host',endpoint,...sandboxArguments(directory,name)],{stdio:['ignore','pipe','pipe']});let stdout=Buffer.alloc(0),count=0,stopped=false,reason:EvaluationResult['outcomes'][number]['reason']|undefined;
   const stop=(why:EvaluationResult['outcomes'][number]['reason'])=>{if(!stopped){stopped=true;reason=why;child.kill('SIGKILL');}};
   const timer=setTimeout(()=>stop('TIMEOUT'),timeoutMs);
   child.stdout.on('data',(chunk:Buffer)=>{count+=chunk.length;if(count>MAX_OUTPUT_BYTES)stop('OUTPUT_LIMIT');else stdout=Buffer.concat([stdout,chunk]);});
   // Raw stderr is counted and discarded; it is never recorded or returned.
   child.stderr.on('data',(chunk:Buffer)=>{count+=chunk.length;if(count>MAX_OUTPUT_BYTES)stop('OUTPUT_LIMIT');});
   child.on('error',()=>{clearTimeout(timer);resolve({reason:'SANDBOX_UNAVAILABLE'});});
   child.on('close',code=>{clearTimeout(timer);if(reason){resolve({reason});return;}if(code!==0){resolve({reason:code===125?'SANDBOX_UNAVAILABLE':'CANDIDATE_ERROR'});return;}try{resolve({reason:'MATCH',value:parseJson(stdout.toString('utf8'),MAX_OUTPUT_BYTES)});}catch{resolve({reason:'CANDIDATE_ERROR'});}});
  });
 }finally{
  // Killing a Docker client alone does not stop its container. Always remove the unique job container.
  let confirmed=false;
  for(let attempt=0;attempt<5&&!confirmed;attempt++){
   try{await exec('docker',['--host',endpoint,'rm','-f',name],{timeout:5000,maxBuffer:4096});confirmed=true;}
   catch{try{const remaining=await exec('docker',['--host',endpoint,'ps','-a','--filter',`name=^/${name}$`,'--format','{{.ID}}'],{timeout:5000,maxBuffer:4096});confirmed=!remaining.stdout.trim();}catch{}}
   if(!confirmed)await new Promise(resolve=>setTimeout(resolve,100));
  }
  if(!confirmed)result={reason:'CLEANUP_UNCONFIRMED'};
 }
 return result;
}
/** Explicit invocation authorizes only this bounded source file and data-only task in local Docker. */
let activeEvaluations=0;
export async function evaluateCandidate(options:EvaluationOptions):Promise<EvaluationResult>{
 if(activeEvaluations>=2)throw new Error('Concurrent evaluation limit reached.');
 activeEvaluations++;try{return await evaluateInternal(options);}finally{activeEvaluations--;}
}
async function evaluateInternal(options:EvaluationOptions):Promise<EvaluationResult>{
 if(typeof options.candidate!=='string'||!options.candidate.endsWith('.mjs'))throw new Error('Candidate must be an mjs module.');
 const task=validateTask(typeof options.task==='string'?getEvaluationTask(options.task):options.task);const timeout=options.timeoutMs??2000;
 if(!Number.isInteger(timeout)||timeout<500||timeout>10000)throw new Error('Timeout must be between 500 and 10000 milliseconds.');
 const source=await safeReadFile(options.root,options.candidate,MAX_SOURCE_BYTES);
 if(options.agent!==undefined){assertBounded(options.agent);if(typeof options.agent.name!=='string'||options.agent.name.length>100||(options.agent.version!==undefined&&(typeof options.agent.version!=='string'||options.agent.version.length>100)))throw new Error('Invalid agent metadata.');}
 const outcomes:EvaluationResult['outcomes']=[];let status:Evidence['execution']['status']='completed';
 const endpoint=await ready();
 if(!endpoint){
  outcomes.push(...task.cases.map(c=>({name:redactText(c.name),status:'error' as const,reason:'SANDBOX_UNAVAILABLE' as const})));status='missing';
 }else{
  const stagingRoot=await mkdtemp(path.join(tmpdir(),'zof-eval-'));const directory=path.join(stagingRoot,'task');
  try{
   await mkdir(directory,{mode:0o755});await writeFile(path.join(directory,'candidate.mjs'),source,{mode:0o444});await writeFile(path.join(directory,'runner.mjs'),harness,{mode:0o444});
   for(const item of task.cases){
    await rm(path.join(directory,'input.json'),{force:true});
    await writeFile(path.join(directory,'input.json'),JSON.stringify(item.input),{mode:0o444});
    const result=await runOne(directory,timeout,endpoint);const matched=result.reason==='MATCH'&&isDeepStrictEqual(result.value,item.expected);
    const reason=result.reason==='MATCH'?(matched?'MATCH':'MISMATCH'):result.reason;
    outcomes.push({name:redactText(item.name),status:reason==='MATCH'?'passed':reason==='MISMATCH'?'failed':'error',reason});
    if(reason==='TIMEOUT'||reason==='OUTPUT_LIMIT')status='partial';if(reason==='SANDBOX_UNAVAILABLE'||reason==='CLEANUP_UNCONFIRMED'){status='error';break;}
   }
  }finally{await rm(stagingRoot,{recursive:true,force:true});}
 }
 const failed=outcomes.some(o=>o.status!=='passed');const agent:Record<string,JsonValue>={};if(options.agent){agent.name=redactText(options.agent.name);if(options.agent.version)agent.version=redactText(options.agent.version);}
 const evidence=createEvidence({tool:{name:'zof-agent-evals',version:'0.1.0'},type:'agent-evaluation',execution:{status,result:status==='missing'||status==='error'?'unknown':failed?'fail':'pass'},tests:outcomes.map(o=>({name:o.name,status:o.status})),findings:outcomes.filter(o=>o.reason!=='MATCH').map((o,i)=>({id:`case-${i+1}`,severity:'info',message:o.reason})),environment:{os:process.platform,architecture:process.arch,runtime:process.version},extensions:{'org.zof.evaluation':{taskId:task.id,taskVersion:task.version,engine:'docker',image:SANDBOX_IMAGE,timeoutMs:timeout,agent}}});
 return {taskId:task.id,outcomes,evidence};
}
