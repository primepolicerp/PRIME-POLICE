import {discordRequest} from './discord-client.ts';
export const WEEKLY_REPORT_CHANNEL='1539970136839163960';
const GUILD='1539970134469378068';
const REQUIRED:Record<string,string[]>={applications:['received','accepted','rejected'],transfers:['received','accepted','rejected'],intakes:['received','accepted','rejected'],personnel:['new_files','departures','reentries'],ranks:['promotions','demotions','assignments'],service:['seconds','agents','started','closed'],absences:['registered','agents'],sanctions:['warnings','strikes','failed'],notes:['added','edited','archived'],tasks:['created','completed'],directiva:['approved','discarded','failed'],notifications:['sent','failed'],current:['active','inactive','open_shifts','applications','transfers','intakes','proposals','tasks','notification_pending','notification_failed']};
function validateReport(data:any){
 if(data?.channel_id!==WEEKLY_REPORT_CHANNEL||data.eventId!==data.week_start||!/^\d{4}-\d{2}-\d{2}$/.test(data.week_start||'')||!/^\d{4}-\d{2}-\d{2}$/.test(data.week_end||'')||Date.parse(data.week_end)-Date.parse(data.week_start)!==7*86400000||new Date(data.week_start).getUTCDay()!==1||!Number.isFinite(Date.parse(data.generated_at)))throw Error('Invalid weekly period');
 for(const [group,keys]of Object.entries(REQUIRED))for(const key of keys)if(typeof data[group]?.[key]!=='number'||!Number.isFinite(data[group][key])||data[group][key]<0||data[group][key]>Number.MAX_SAFE_INTEGER)throw Error('Incomplete weekly statistics');
}
const count=(value:number)=>Math.floor(value).toLocaleString('es-ES');
const hours=(value:number)=>{const minutes=Math.floor(Math.max(0,Number(value)||0)/60);return count(Math.floor(minutes/60))+' h '+String(minutes%60).padStart(2,'0')+' min';};
const date=(value:string)=>new Intl.DateTimeFormat('es-ES',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(value));
export function weeklyReportCard(data:any){
 validateReport(data);
 const period=date(data.week_start)+' — '+date(new Date(Date.parse(data.week_end)-86400000).toISOString()),field=(name:string,value:string,inline=true)=>({name,value,inline});
 const received=(g:any)=>'Recibidas: **'+count(g.received)+'**\nAceptadas: **'+count(g.accepted)+'** · Rechazadas: **'+count(g.rejected)+'**';
 const current=data.current;
 return {nonce:'weekly-'+data.week_start,enforce_nonce:true,allowed_mentions:{parse:[]},embeds:[{
  title:'📊 PRIME POLICE · Informe semanal',color:0x4d98c9,description:'**'+period+'**\nResumen de la actividad registrada en la web · Semana de lunes a domingo.',
  fields:[
   field('Personal','Altas de ficha: **'+count(data.personnel.new_files)+'**\nBajas: **'+count(data.personnel.departures)+'** · Reingresos: **'+count(data.personnel.reentries)+'**'),
   field('Postulaciones',received(data.applications)),field('Traslados',received(data.transfers)),field('Solicitudes de nuevo ingreso',received(data.intakes)),
   field('Carrera policial','Ascensos: **'+count(data.ranks.promotions)+'**\nDescensos: **'+count(data.ranks.demotions)+'** · Asignaciones: **'+count(data.ranks.assignments)+'**'),
   field('Actividad de servicio','Tiempo dentro de la semana: **'+hours(data.service.seconds)+'**\nAgentes con actividad: **'+count(data.service.agents)+'**\nTurnos iniciados: **'+count(data.service.started)+'** · Cerrados: **'+count(data.service.closed)+'**'),
   field('Horas por rama','Policía / sin rama: **'+hours(data.service_by_unit?.POLICIA||0)+'**\nUCOP: **'+hours(data.service_by_unit?.UCOP||0)+'** · CIC: **'+hours(data.service_by_unit?.CIC||0)+'**'),
   field('Ausencias y licencias','Registradas y aprobadas: **'+count(data.absences.registered)+'**\nAgentes con ausencia durante la semana: **'+count(data.absences.agents)+'**'),
  ],footer:{text:'PRIME POLICE · Gestión y actividad · Fechas registradas en la web'}
 },{
  title:'📋 Gestión administrativa y seguimiento',color:0x769cce,
  fields:[
   field('Sanciones registradas','Amonestaciones: **'+count(data.sanctions.warnings)+'**\nStrikes: **'+count(data.sanctions.strikes)+'** · No aplicadas: **'+count(data.sanctions.failed)+'**'),
   field('Observaciones internas','Añadidas: **'+count(data.notes.added)+'** · Editadas: **'+count(data.notes.edited)+'**\nArchivadas: **'+count(data.notes.archived)+'**'),
   field('Tareas del equipo','Creadas: **'+count(data.tasks.created)+'**\nCompletadas durante la semana: **'+count(data.tasks.completed)+'**'),
   field('Revisión de Directiva','Propuestas aprobadas: **'+count(data.directiva.approved)+'**\nDescartadas: **'+count(data.directiva.discarded)+'** · Fallidas: **'+count(data.directiva.failed)+'**'),
   field('Avisos de Discord durante la semana','Enviados: **'+count(data.notifications.sent)+'**\nFallidos al generar el informe: **'+count(data.notifications.failed)+'**'),
   field('Situación al generar el informe','Personal activo: **'+count(current.active)+'** · De baja: **'+count(current.inactive)+'**\nBitácoras abiertas: **'+count(current.open_shifts)+'**',false),
   field('Pendientes al generar el informe','Postulaciones: **'+count(current.applications)+'** · Traslados: **'+count(current.transfers)+'** · Ingresos: **'+count(current.intakes)+'**\nPropuestas para Directiva: **'+count(current.proposals)+'** · Tareas abiertas: **'+count(current.tasks)+'**',false),
   field('Sincronización actual','Avisos en cola: **'+count(current.notification_pending)+'** · Necesitan revisión: **'+count(current.notification_failed)+'**',false),
  ],timestamp:data.generated_at,footer:{text:'PRIME POLICE · Estadísticas agregadas · Los detalles personales permanecen en la web'}
 }]};
}
export async function weeklyReportChannelCheck(send=discordRequest){
 const channel=await send('/channels/'+WEEKLY_REPORT_CHANNEL);
 if(channel.guild_id!==GUILD||![0,5].includes(channel.type))throw Error('El canal de informes no es un canal de texto del servidor PRIME POLICE.');
 const [roles,self]=await Promise.all([send('/guilds/'+GUILD+'/roles'),send('/users/@me')]),member=await send('/guilds/'+GUILD+'/members/'+self.id),ids=new Set<string>(member.roles||[]);
 let permissions=roles.filter((r:any)=>r.id===GUILD||ids.has(r.id)).reduce((v:bigint,r:any)=>v|BigInt(r.permissions||'0'),0n);
 const administrator=Boolean(permissions&8n);
 if(!administrator){
  const overwrites=channel.permission_overwrites||[],everyone=overwrites.find((o:any)=>o.id===GUILD);
  if(everyone)permissions=(permissions&~BigInt(everyone.deny||'0'))|BigInt(everyone.allow||'0');
  let allow=0n,deny=0n;for(const entry of overwrites)if(entry.type===0&&ids.has(entry.id)){allow|=BigInt(entry.allow||'0');deny|=BigInt(entry.deny||'0');}permissions=(permissions&~deny)|allow;
  const own=overwrites.find((o:any)=>o.type===1&&o.id===self.id);if(own)permissions=(permissions&~BigInt(own.deny||'0'))|BigInt(own.allow||'0');
 }
 const required=(1n<<10n)|(1n<<11n)|(1n<<14n)|(1n<<16n);
 if(!administrator&&(permissions&required)!==required)throw Error('El bot necesita Ver canal, Enviar mensajes, Insertar enlaces y Leer historial en el canal de informes.');
 return {id:channel.id,name:channel.name,type:channel.type,can_send:true};
}
export async function deliverWeeklyReport(data:any,send=discordRequest){
 try{
  const card=weeklyReportCard(data);await weeklyReportChannelCheck(send);
  await send('/channels/'+WEEKLY_REPORT_CHANNEL+'/messages',{method:'POST',body:JSON.stringify(card)});return '';
 }catch(error){console.error('Weekly report delivery:',String(error));return 'El informe semanal está guardado, pero no se pudo confirmar su envío. Revisa el canal y los permisos del bot en Sincronización.';}
}
