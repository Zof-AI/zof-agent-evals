import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
const cli=(...a)=>spawnSync(process.execPath,['dist/cli.js',...a],{encoding:'utf8',timeout:10000});
test('CLI lists actual supported tasks',()=>{const r=cli('tasks');assert.equal(r.status,0);assert.equal(JSON.parse(r.stdout).length,3);});
test('CLI malicious paths/options rejected safely',()=>{for(const args of [['evaluate','../secret','--root','examples'],['evaluate','correct.mjs','--token=synthetic-secret'],['evaluate','correct.mjs','--root','examples','--timeout','-1']]){const r=cli(...args);assert.equal(r.status,2);assert.doesNotMatch(r.stderr,/synthetic-secret|private/);}});
test('CLI help and version work',()=>{assert.equal(cli('--help').status,0);assert.equal(cli('--version').stdout.trim(),'0.1.0');});
