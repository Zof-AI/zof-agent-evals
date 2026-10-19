export function solve(payments){const seen=new Set();return payments.reduce((sum,p)=>{if(seen.has(p.id))return sum;seen.add(p.id);return sum+p.amount;},0);}
