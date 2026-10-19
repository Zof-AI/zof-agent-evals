import test from 'node:test';import assert from 'node:assert/strict';import {evaluateCandidate} from '../dist/index.js';import {validateEvidence} from '@zof-ai/evidence-spec';
import {mkdtemp,symlink,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {execFileSync} from 'node:child_process';
test('absent Docker is missing evidence, never a pass',async()=>{
 const previous=process.env.PATH;const python=execFileSync('python3',['-I','-S','-c','import sys; print(sys.executable)'],{encoding:'utf8'}).trim();
 const dir=await mkdtemp(path.join(tmpdir(),'zof-no-docker-'));await symlink(python,path.join(dir,'python3'));process.env.PATH=dir;
 try{const r=await evaluateCandidate({root:'examples',candidate:'correct.mjs',task:'deduplicate-payments'});assert.deepEqual(r.evidence.execution,{status:'missing',result:'unknown'});assert.ok(r.outcomes.every(o=>o.reason==='SANDBOX_UNAVAILABLE'));assert.equal(validateEvidence(r.evidence).valid,true);}
 finally{process.env.PATH=previous;await rm(dir,{recursive:true,force:true});}
});
test('absent Python rejects input without producing passing evidence',async()=>{const previous=process.env.PATH;process.env.PATH='/nonexistent';try{await assert.rejects(evaluateCandidate({root:'examples',candidate:'correct.mjs',task:'deduplicate-payments'}),e=>e.code==='PYTHON_REQUIRED');}finally{process.env.PATH=previous;}});
