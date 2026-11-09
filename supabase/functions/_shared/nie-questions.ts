export const NIE_GUILD='1539970134469378068';
export const NIE_CHANNEL='1539970136302288950';
export const NIE_POLICE='1539970134482092038';
export const NIE_CIC='1539970134519578772';
export const NIE_QUESTIONS=[
 {key:'full_name',label:'1. Nombre IC',question:'Nombre y apellido de tu personaje.',short:true},
 {key:'current_rank',label:'2. Rango actual',question:'¿Cuál es tu rango en PRIME POLICE?',short:true},
 {key:'motivation',label:'3. Motivación',question:'¿Por qué quisieras formar parte de la NIE?'},
 {key:'experience',label:'4. Experiencia previa',question:'¿Qué experiencia has tenido en roles de Asuntos Internos o investigación?'},
 {key:'kidnapping',label:'5. Secuestro e información',question:'Si te secuestran y te piden información de la policía o de un agente en específico, ¿qué harías?'},
 {key:'restraints',label:'6. Colocación de grilletes',question:'¿Cómo colocarías unos grilletes? Explica el procedimiento dentro del rol.'},
 {key:'priority_crimes',label:'7. Delitos prioritarios',question:'¿Qué tipos de delitos consideras más importantes para la NIE? ¿Por qué?'},
 {key:'seizure',label:'8. Procedimiento de incautación',question:'¿Cómo te prepararías para realizar una incautación a un sujeto? Describe el proceso antes, durante y después.'},
 {key:'confidentiality',label:'9. Confidencialidad de un caso',question:'Un superior que no pertenece a la NIE te pide información de un caso. ¿Qué harías?'},
 {key:'evidence_integrity',label:'10. Protección de evidencias',question:'¿Cómo evitarías perder o contaminar evidencias durante un operativo?'},
 {key:'terms',label:'11. Términos y compromiso',question:'¿Aceptas todos los términos de la NIE y asumes las consecuencias de incumplirlos?',choice:true},
] as const;
export const nieStepQuestions=(step:number)=>NIE_QUESTIONS.slice((step-1)*4,step*4);
export const NIE_PANEL={
 embeds:[{title:'🕵️ PRIME POLICE | POSTULACIONES NIE · CIC',description:'¿Quieres comenzar tus pasantías en la NIE y formar parte de la rama de investigación y operaciones tácticas de PRIME POLICE?\n\nCompleta la postulación con sinceridad y explica tus respuestas. Todas las preguntas son obligatorias.\n\n🔒 Responderás en privado, en **3 pasos**. Directiva, los jefes de ramas y los subjefes de CIC revisarán tus respuestas desde la web. Necesitas el rol Policía para enviar el formulario.\n\nEl envío no asigna roles ni supone el ingreso automático.',color:2065322,footer:{text:'PRIME POLICE · NIE / CIC · Postulación privada'}}],
 components:[{type:1,components:[{type:2,style:1,label:'Iniciar postulación NIE · CIC',custom_id:'prime_nie_apply'}]}],
 allowed_mentions:{parse:[]},
};
