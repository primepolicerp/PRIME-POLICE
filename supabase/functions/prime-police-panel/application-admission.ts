import {attachPersonnelMembership} from './personnel-membership.ts';
export async function attachApplicationAdmission(rows:any[],read:(path:string)=>Promise<{rows:any[]}>){
 const accepted=rows.filter(row=>row.status==='accepted');if(!accepted.length)return rows;
 const checked=await attachPersonnelMembership(accepted,read);
 const ids=[...new Set(checked.filter(row=>row.personnel_registered===false&&!row.personnel_membership_unavailable).map(row=>String(row.discord_user_id)))].filter(id=>/^\d{17,20}$/.test(id));
 let candidates:any[]=[],unavailable=false;
 if(ids.length)try{candidates=(await read('police_preselections?select=discord_user_id,discord_username,full_name,source_application_id,status,updated_at&discord_user_id=in.('+ids.join(',')+')&limit=100')).rows;}catch{unavailable=true;}
 const byId=new Map(checked.map(row=>[row.id,row]));
 return rows.map(row=>{
  if(row.status!=='accepted')return row;
  const person=byId.get(row.id),candidate=candidates.find(c=>c.discord_user_id===row.discord_user_id&&c.source_application_id===row.id&&c.status==='active');
  return {...person,...(unavailable?{admission_lookup_unavailable:true}:{}),...(candidate&&person.personnel_registered===false?{admission_candidate:candidate}:{})};
 });
}
