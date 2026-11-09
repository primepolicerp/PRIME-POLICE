// Only actual police/UCOP ranks. Administrative, branch and separator roles are excluded.
export const REAL_RANKS=[
 {id:'1539970134482092040',name:'Raso en Prácticas',short:'Raso Prác.',track:'police',order:1},
 {id:'1564309793802428567',name:'Raso',short:'Raso',track:'police',order:2},
 {id:'1539970134494421002',name:'Patrullero',short:'Patr.',track:'police',order:3},
 {id:'1539970134494421003',name:'Cabo',short:'Cabo',track:'police',order:4},
 {id:'1539970134494421004',name:'Sargento',short:'Sgto.',track:'police',order:5},
 {id:'1539970134494421005',name:'Sargento 1ro',short:'Sgto. 1ro',track:'police',order:6},
 {id:'1539970134494421007',name:'Primer Inspector',short:'1er Insp.',track:'police',order:7},
 {id:'1564309369636520077',name:'Inspector Agregado',short:'Insp. Agr.',track:'police',order:8},
 {id:'1539970134494421008',name:'Inspector Jefe',short:'Insp. Jefe',track:'police',order:9},
 {id:'1539970134519578766',name:'Capitán',short:'Cap.',track:'police',order:10},
 {id:'1539970134519578767',name:'Comandante',short:'Cmdte.',track:'police',order:11},
 {id:'1539970134519578768',name:'Teniente Coronel',short:'Tte. Cnel.',track:'police',order:12},
 {id:'1539970134544748560',name:'Coronel',short:'Cnel.',track:'police',order:13},
 {id:'1539970134544748561',name:'Comisionado',short:'Comis.',track:'police',order:14},
 {id:'1564308664557506691',name:'Pasante UCOP',short:'Pasante UCOP',track:'ucop',order:101},
 {id:'1539970134519578769',name:'Oficial UCOP',short:'Oficial UCOP',track:'ucop',order:102},
 {id:'1539970134519578770',name:'RH UCOP',short:'RH',track:'ucop',order:103},
 {id:'1539970134544748558',name:'Subjefe de División',short:'Sub-Jefe UCOP',track:'ucop',order:104},
 {id:'1539970134544748559',name:'Jefe de División',short:'Jefe UCOP',track:'ucop',order:105},
] as const;
export const realRank=(id:unknown)=>REAL_RANKS.find(rank=>rank.id===String(id));
export function realRankRows(rows:any[]){return (rows||[]).filter(row=>realRank(row.role_id)).map(row=>({...row,role_name:realRank(row.role_id)!.name,rank_order:realRank(row.role_id)!.order,rank_track:realRank(row.role_id)!.track}));}
export const sameRankTrack=(a:unknown,b:unknown)=>Boolean(realRank(a)&&realRank(a)?.track===realRank(b)?.track);
export function displayRank(roles:string[]){return REAL_RANKS.filter(rank=>roles.includes(rank.id)).sort((a,b)=>b.order-a.order)[0]||null;}
export function shouldAssignUcopBranch(roles:string[],selectedRankId?:string){
 const selected=realRank(selectedRankId),current=selected?.track==='ucop'?selected:displayRank(roles.filter(id=>realRank(id)?.track==='ucop'));
 return current?.id!=='1564308664557506691';
}
export function rankedNickname(name:string,plate:string,roles:string[]){
 const rank=displayRank(roles),cleanName=String(name||'').trim().replace(/\s+/g,' '),cleanPlate=String(plate||'').trim().replace(/^#+/,'');
 const suffix=cleanPlate?' #'+cleanPlate:'';
 const points=(s:string)=>Array.from(s);
 let label=rank?(rank.track==='ucop'?rank.short:rank.name):'';
 if(rank&&['1539970134544748558','1539970134544748559'].includes(rank.id)&&roles.includes('1539970134519578772'))label=rank.id==='1539970134544748558'?'Sub-Jefe CIC':'Jefe CIC';
 if(rank&&points(label+' | '+cleanName+suffix).length>32&&!label.endsWith(' CIC'))label=rank.short;
 const prefix=label?label+' | ':'';
 const room=32-points(prefix+suffix).length;
 if(room<1)throw Error('La placa es demasiado larga para incluir rango, nombre y placa en el apodo.');
 return prefix+points(cleanName).slice(0,room).join('').trimEnd()+suffix;
}

// Division leaders share their existing Discord role; the personnel unit identifies CIC/UCOP.
export const DIVISION_LEADER_IDS=['1539970134544748558','1539970134544748559'];
export const isDivisionLeader=(id:unknown)=>DIVISION_LEADER_IDS.includes(String(id));
export function divisionRankName(id:unknown,unit:unknown){
 if(!isDivisionLeader(id))return realRank(id)?.name||'';
 const title=String(id)===DIVISION_LEADER_IDS[0]?'Subjefe de División':'Jefe de División';
 return title+(['CIC','UCOP'].includes(String(unit))?' '+String(unit):'');
}
