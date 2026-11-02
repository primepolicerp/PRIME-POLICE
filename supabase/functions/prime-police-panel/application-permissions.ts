const DIRECTORS = new Set(['1539970134565982313','1539970134544748562','1539970134519578774']);
export const UCOP_APPLICATION_ROLES = ['1539970134519578773','1539970134519578769','1539970134519578770','1539970134544748558','1539970134544748559'];
export const UCOP_TRAINEE_ROLE = '1564308664557506691';
export function applicationPermissions(roles:string[] = []) {
 const director=roles.some(role=>DIRECTORS.has(role));
 const senior=roles.some(role=>UCOP_APPLICATION_ROLES.slice(1).includes(role));
 const trainee=roles.includes(UCOP_TRAINEE_ROLE)&&!senior&&!director;
 return {
  direct:director||(!trainee&&roles.some(role=>UCOP_APPLICATION_ROLES.includes(role))),
  // A trainee rank never grants access to the rest of the personnel database.
  applicationsOnly:trainee&&!roles.some(role=>['1539970134544748556','1539970134544748557'].includes(role)),
 };
}
export function applicationScopeAllowed(action:string,params:URLSearchParams) {
 if(action==='records')return params.get('kind')==='applications';
 if(action==='application-review')return !params.has('kind')||params.get('kind')==='applications';
 return ['me','data','decision','application-review-save','workspace-search'].includes(action);
}
