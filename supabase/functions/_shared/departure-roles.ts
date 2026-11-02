export const DEPARTURE_ROLES={voluntary:{id:'1539970134482092035',name:'Baja Voluntaria'},expelled:{id:'1539970134482092034',name:'Expulsado'},banned:{id:'1564310246128619560',name:'Vetado'}} as const;
export function departureRoleChoice(type:string,choice?:string){
 if(choice!==undefined)return choice==='none'||Object.prototype.hasOwnProperty.call(DEPARTURE_ROLES,choice)?choice:null;
 return ['renuncia','jubilacion'].includes(type)?'voluntary':['despido','corrupcion'].includes(type)?'expelled':'none';
}
export function hasPersonnelRestriction(roles:string[]){return roles.includes(DEPARTURE_ROLES.expelled.id)||roles.includes(DEPARTURE_ROLES.banned.id);}
