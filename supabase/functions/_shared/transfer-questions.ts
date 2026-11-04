export const TRANSFER_QUESTIONS=[
 {key:'previous_police',number:1,title:'Experiencia policial previa',question:'¿De qué ciudad o facción policial provienes? Indica el nombre de la institución, el rango que desempeñabas y cuánto tiempo perteneciste a ella.'},
 {key:'roleplay_experience',number:3,title:'Experiencia en Roleplay',question:'¿Cuánto tiempo llevas roleando en FiveM y cuánto tiempo de experiencia tienes específicamente como policía?'},
 {key:'transfer_reason',number:4,title:'Motivo del traslado',question:'¿Por qué deseas trasladarte desde tu antigua institución policial a nuestra ciudad? Explica brevemente tus motivos.'},
 {key:'police_knowledge',number:5,title:'Conocimientos policiales',question:'¿Conoces los procedimientos básicos de la policía? Explica cuáles has realizado anteriormente (10-14, 10-20, detenciones, persecuciones, negociaciones, códigos radiales, procedimientos de tráfico, etc.).'},
 {key:'previous_responsibilities',number:6,title:'Rango y responsabilidades anteriores',question:'¿Cuál fue tu último rango policial y qué funciones o responsabilidades desempeñabas dentro de tu antigua institución?'},
 {key:'disciplinary_history',number:7,title:'Historial disciplinario',question:'¿Has recibido alguna sanción, suspensión o expulsión de una facción policial? En caso afirmativo, explica el motivo.'},
 {key:'adaptation',number:8,title:'Adaptación a la nueva institución',question:'¿Estarías dispuesto a recibir una capacitación, adaptarte a nuestra normativa y comenzar con un rango diferente al que tenías anteriormente?'},
 {key:'availability',number:9,title:'Disponibilidad y compromiso',question:'¿Cuántas horas diarias o semanales puedes dedicar al servicio policial en nuestra ciudad?'},
 {key:'contribution',number:10,title:'Aportación a la institución',question:'¿Qué habilidades, conocimientos o experiencia consideras que puedes aportar a nuestro departamento policial?'}
];
export function validTransferAnswers(answers:any){return answers&&typeof answers==='object'&&TRANSFER_QUESTIONS.every(q=>typeof answers[q.key]==='string'&&answers[q.key].trim().length>0&&answers[q.key].length<=4000);}
