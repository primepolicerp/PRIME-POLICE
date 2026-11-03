export const RECRUITMENT_VETO_ROLE='1564310246128619560';
export const RECRUITMENT_VETO_MESSAGE='Tienes el rol Vetado. No puedes enviar postulaciones, traslados ni solicitudes de ingreso mientras conserves ese rol. Contacta con Directiva si necesitas una revisión.';
export async function isRecruitmentVetoed(user:string,discord:(path:string,init?:RequestInit)=>Promise<any>){
 if(!/^\d{17,20}$/.test(user))throw Error('Invalid recruitment account');
 const member=await discord('/guilds/1539970134469378068/members/'+encodeURIComponent(user));
 if(!Array.isArray(member?.roles))throw Error('Could not verify recruitment roles');
 return member.roles.includes(RECRUITMENT_VETO_ROLE);
}
