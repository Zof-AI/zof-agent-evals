#!/usr/bin/env node
import {parseArgs} from 'node:util';import {safeReadJson,serializeEvidence} from '@zof-ai/evidence-spec';import {listEvaluationTasks} from '@zof-ai/reliability-bench';import {evaluateCandidate,validateTask} from './index.js';
try{const {values,positionals}=parseArgs({options:{root:{type:'string',default:'.'},task:{type:'string',default:'deduplicate-payments'},'task-file':{type:'string'},timeout:{type:'string',default:'2000'},agent:{type:'string'},help:{type:'boolean'},version:{type:'boolean'}},allowPositionals:true});
 if(values.help)console.log('Usage: zof-agent-evals evaluate <candidate.mjs> --root directory [--task id | --task-file relative.json] [--timeout 500..10000] [--agent name]\nCandidates run only in constrained local Docker; no automatic image pull. Exit0 pass,1 candidate failure,2 incomplete/missing/input.\nUse zof-agent-evals tasks to list public data-only tasks.');
 else if(values.version)console.log('0.1.1');
 else if(positionals.length===1&&positionals[0]==='tasks')console.log(JSON.stringify(listEvaluationTasks(),null,2));
 else if(positionals.length===2&&positionals[0]==='evaluate'){
  const task=values['task-file']?validateTask(await safeReadJson(values.root!,values['task-file'])):values.task!;
  const result=await evaluateCandidate({root:values.root!,candidate:positionals[1]!,task,timeoutMs:Number(values.timeout),...(values.agent?{agent:{name:values.agent}}:{})});
  process.stdout.write(serializeEvidence(result.evidence));process.exitCode=result.evidence.execution.status==='completed'?(result.evidence.execution.result==='pass'?0:1):2;
 }else throw new Error('usage');
}catch{console.error(JSON.stringify({error:'Invalid candidate, task or evaluation options.'}));process.exitCode=2;}
