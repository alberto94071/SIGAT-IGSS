import { neon } from "@neondatabase/serverless";

const DB = "postgresql://neondb_owner:npg_gaDnJLs0lK4T@ep-winter-boat-atha96e8-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const sql = neon(DB);

// 1. Recrear base_datos_central simplificada
await sql`DROP TABLE IF EXISTS base_datos_central`;
await sql`
  CREATE TABLE base_datos_central (
    id              SERIAL PRIMARY KEY,
    codigo_igss     INTEGER,
    codigo_ppr      INTEGER,
    nombre          TEXT NOT NULL,
    caracteristicas TEXT,
    presentacion    TEXT,
    renglon         INTEGER,
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
    updated_at      TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
  )
`;

// 2. Crear tabla proveedores
await sql`
  CREATE TABLE IF NOT EXISTS proveedores (
    id          SERIAL PRIMARY KEY,
    nit         TEXT,
    nombre      TEXT NOT NULL,
    contacto    TEXT,
    telefono    TEXT,
    email       TEXT,
    direccion   TEXT,
    activo      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
    updated_at  TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
  )
`;

// 3. Seed simplificado: solo 6 campos útiles
await sql`
INSERT INTO base_datos_central (codigo_igss, codigo_ppr, nombre, caracteristicas, presentacion, renglon) VALUES
-- GRUPO 001-001-0001 (Insumos administrativos)
(NULL,1941,'Combustible','Clase: Diésel','2269 - Envase (1 Galón)',262),
(NULL,2025,'Marcador','Color: Negro; Tipo: Permanente','2336 - Unidad (1 Unidad(es))',291),
(NULL,2092,'Fastener','Material: Metal','5638 - Caja (50 Unidad(es))',291),
(NULL,2191,'Folder','Clase: Manila; Tamaño: Oficio','2512 - Paquete (100 Unidad(es))',243),
(NULL,2204,'Sobre','Clase: Manila; Tamaño: Oficio','29028 - Unidad (1 Unidad(es))',243),
(NULL,2209,'Archivador','Material: Cartón; Tamaño: Carta','2532 - Unidad (1 Unidad(es))',244),
(NULL,2210,'Archivador','Material: Cartón; Tamaño: Oficio','2533 - Unidad (1 Unidad(es))',244),
(NULL,2212,'Bloc adhesivo','Ancho: 3 Pulgadas; Largo: 3 Pulgadas; Número de hojas: 100; Tipo: Notas','26798 - Unidad (1 Unidad(es))',244),
(NULL,2845,'Jabón','Estado: Polvo','3425 - Bolsa (20 Libra)',292),
(NULL,2858,'Jabón de tocador','Consistencia: Líquido; Uso: Manos','47824 - Envase (500 Mililitro)',292),
(NULL,4811,'Sobre','Clase: Manila; Tamaño: Carta','5015 - Unidad (1 Unidad(es))',243),
(NULL,5732,'Aromatizante','Estado: Sólido; Forma: Pastilla; Uso: Sanitario','30683 - Unidad (50 Gramos)',292),
(NULL,10282,'Bolsa para basura','Material: Plástico; Tamaño: Extra grande','35546 - Rollo (30 Unidad(es))',268),
(NULL,25393,'Papel higiénico','Clase: Bobina; Hoja: Simple; Largo de bobina: 500 Metro(s)','27082 - Caja (12 Unidad(es))',243),
(NULL,27699,'Dispensador','Alto: 35 cm; Ancho: 24 cm; Largo: 27 cm; Material: Plástico; Tipo: Roll down; Uso: Papel de manos','30174 - Unidad (1 Unidad(es))',292),
(NULL,30628,'Lápiz','Material: Madera; No: 2; Tipo: Hb','51175 - Unidad (1 Unidad(es))',291),
(NULL,32327,'Papel bond','Color: Blanco; Gramaje: 80 Gramos; Tamaño: Carta','35227 - Resma (500 Unidad(es))',241),
(NULL,33979,'Limpiavidrios','Estado: Líquido; Tipo: Biodegradable','37215 - Envase (1 Galón)',292),
(NULL,34579,'Marcador','Color: Varios; Tipo: Resaltador','37885 - Unidad (1 Unidad(es))',291),
(NULL,42957,'Desinfectante','Aplicación: Piso; Aroma: Varios; Estado: Líquido','48785 - Envase (1 Galón)',292),
(NULL,43653,'Caja','Alto: 32 cm; Ancho: 40 cm; Capacidad: 50 kg; Largo: 60 cm; Material: Plástico; Tapadera: Si','50149 - Unidad (1 Unidad(es))',268),
(NULL,43770,'Desodorante ambiental','Tipo: Aerosol','55459 - Envase (400 Mililitro)',292),
(NULL,47756,'Papel kraft','Ancho: 18 Pulgadas; Calibre: 30','55662 - Bobina (200 Yarda)',242),
(NULL,47890,'Engrapadora','Capacidad máxima de engrapado: 25 hojas; Material: Metal; Tamaño de grapas: 26/6','55855 - Unidad (1 Unidad(es))',291),
(NULL,51290,'Papel térmico','Ancho: 79 mm; Color: Blanco; Largo: 74 Metro(s); Uso: Impresora','60309 - Unidad (1 Unidad(es))',269),
(NULL,61670,'Toalla','Ancho: 200 mm; Clase: Ultra absorbente; Largo: 305 Metro; Material: Papel; Uso: Manos','74046 - Caja (6 Unidad(es))',243),
(NULL,79664,'Consulta de medicina general','Tipo: Servicio','94110 - Unidad (1 Unidad(es))',182),
(NULL,80361,'Servicios técnicos de atención básica en salud','Tipo: Servicio','94965 - Unidad (1 Unidad(es))',182),
(NULL,84060,'Perforador','Capacidad: 30 hojas; Material: Metal; Tipo: 3 agujeros','99442 - Unidad (1 Unidad(es))',291),
(NULL,108555,'Paño limpiador','Ancho: 30 cm; Largo: 32 cm; Material: Microfibra','126208 - Unidad (1 Unidad(es))',292),
(NULL,113292,'Sello','Ancho: 2 cm; Largo: 4.5 cm; Material: Plástico; Tipo: Automático','131737 - Unidad (1 Unidad(es))',291),
(NULL,134092,'Caja isotérmica','Aislante: Doble; Capacidad: 50 Litro; Espuma: Poliuretano','156470 - Unidad (1 Unidad(es))',268),
(NULL,157652,'Tóner','Código: W1510a; Color: Negro; Número: 151a; Uso: Impresora','184625 - Unidad (1 Unidad(es))',267),
(NULL,158856,'Lámpara led','Alimentación: 120 Voltio; Material: Metal y plástico; Potencia: 18 Vatio; Tipo: Ojo de buey','186007 - Unidad (1 Unidad(es))',297),
-- GRUPO 001-003-0001 (Hospitalización adultos)
(NULL,9987,'Atención médica de encamamiento de medicina interna','Tipo: Servicio','10407 - Unidad (1 Unidad(es))',182),
(NULL,9990,'Atención médica de encamamiento de ginecología','Tipo: Servicio','10410 - Unidad (1 Unidad(es))',182),
(NULL,68569,'Procedimiento de operación sobre piel y tejido subcutáneo','Tipo: Servicio','82080 - Unidad (1 Unidad(es))',182),
(NULL,69758,'Procedimiento de apendicectomía','Tipo: Servicio','83297 - Unidad (1 Unidad(es))',182),
-- GRUPO 001-003-0005 (Hospitalización pediátrica)
(NULL,67807,'Procedimiento de apendicectomía en paciente pediátrico','Tipo: Servicio','81307 - Unidad (1 Unidad(es))',182),
(NULL,68360,'Hospitalización y encamamiento en pediatría','Tipo: Servicio','81868 - Unidad (1 Unidad(es))',182),
-- GRUPO 001-004-0001 (Consulta externa adultos — medicamentos y servicios)
(NULL,11,'Acetaminofén (paracetamol)','Concentración: 500mg; Forma farmacéutica: Tableta; Vía: Oral','103 - Unidad (1 Unidad(es))',266),
(NULL,37,'Ácido acetilsalicílico','Concentración: 100mg; Forma farmacéutica: Tableta; Vía: Oral','129 - Unidad (1 Unidad(es))',266),
(NULL,39,'Ácido ascórbico (vitamina C)','Concentración: 500mg; Forma farmacéutica: Tableta; Vía: Oral','131 - Unidad (1 Unidad(es))',266),
(NULL,42,'Ácido fólico','Concentración: 5mg; Forma farmacéutica: Tableta; Vía: Oral','31014 - Unidad (1 Unidad(es))',266),
(NULL,68,'Alcohol etílico desnaturalizado','Concentración: 88°; Forma farmacéutica: Solución; Vía: Tópico','56257 - Frasco (500 Mililitro)',261),
(NULL,83,'Alopurinol','Concentración: 300mg; Presentación: Tableta; Vía: Oral','175 - Unidad (1 Unidad(es))',266),
(NULL,85,'Alprazolam','Concentración: 0.5mg; Forma farmacéutica: Tableta; Vía: Oral','71891 - Unidad (1 Unidad(es))',266),
(NULL,122,'Amiodarona clorhidrato','Concentración: 200mg; Presentación: Tableta; Vía: Oral','215 - Unidad (1 Unidad(es))',266),
(NULL,161,'Atorvastatina','Concentración: 20mg; Forma farmacéutica: Tableta; Vía: Oral','256 - Unidad (1 Unidad(es))',266),
(NULL,207,'Biperideno clorhidrato','Concentración: 2mg; Forma farmacéutica: Tableta; Vía: Oral','56242 - Unidad (1 Unidad(es))',266),
(NULL,214,'Brea de hulla + ácido salicílico','Concentración: 1%-2%; Forma farmacéutica: Champú; Vía: Tópico','56398 - Frasco (120 Mililitro)',266),
(NULL,236,'Calcio carbonato o citrato','Concentración: 600mg; Forma farmacéutica: Tableta; Vía: Oral','55034 - Unidad (1 Unidad(es))',266),
(NULL,248,'Carbamazepina','Concentración: 400mg; Forma farmacéutica: Tableta; Vía: Oral','346 - Unidad (1 Unidad(es))',266),
(NULL,259,'Candesartán','Concentración: 32mg; Forma farmacéutica: Tableta; Vía: Oral','358 - Unidad (1 Unidad(es))',266),
(NULL,263,'Carvedilol','Concentración: 12.5mg; Presentación: Tableta; Vía: Oral','362 - Unidad (1 Unidad(es))',266),
(NULL,288,'Cefixima','Concentración: 400mg; Forma farmacéutica: Tableta; Vía: Oral','387 - Unidad (1 Unidad(es))',266),
(NULL,389,'Clorhexidina gluconato','Concentración: 5%; Vía: Tópico','10532 - Envase (1 Galón)',266),
(NULL,436,'Desloratadina','Concentración: 5mg; Forma farmacéutica: Tableta; Vía: Oral','78301 - Unidad (1 Unidad(es))',266),
(NULL,453,'Dexketoprofeno trometamol','Concentración: 25mg; Presentación: Tableta; Vía: Oral','558 - Unidad (1 Unidad(es))',266),
(NULL,507,'Difenidol','Concentración: 25mg; Forma farmacéutica: Tableta; Vía: Oral','620 - Unidad (1 Unidad(es))',266),
(NULL,517,'Dimenhidrinato','Concentración: 50mg; Forma farmacéutica: Tableta; Vía: Oral','630 - Unidad (1 Unidad(es))',266),
(NULL,593,'Espironolactona','Concentración: 100mg; Presentación: Tableta; Vía: Oral','708 - Unidad (1 Unidad(es))',266),
(NULL,661,'Fluconazol','Concentración: 150mg; Presentación: Cápsula/tableta; Vía: Oral','778 - Unidad (1 Unidad(es))',266),
(NULL,685,'Formoterol fumarato','Concentración: 12mcg/inhalación; Forma farmacéutica: Cápsula con polvo seco; Vía: Inhalatoria','803 - Unidad (1 Unidad(es))',266),
(NULL,715,'Furosemida','Concentración: 40mg; Forma farmacéutica: Tableta; Vía: Oral','846 - Unidad (1 Unidad(es))',266),
(NULL,774,'Hidroclorotiazida clorhidrato','Concentración: 50mg; Forma farmacéutica: Tableta; Vía: Oral','906 - Unidad (1 Unidad(es))',266),
(NULL,776,'Hidrocortisona','Concentración: 0.25%; Forma farmacéutica: Crema; Vía: Tópico','56284 - Tubo (15 Gramos)',266),
(NULL,787,'Hidróxido de aluminio y magnesio','Concentración: 185+200mg/5ml; Presentación: Suspensión/frasco; Vía: Oral','31979 - Frasco (360 Mililitro)',266),
(NULL,801,'Ibuprofeno','Concentración: 400mg; Forma farmacéutica: Tableta; Vía: Oral','934 - Unidad (1 Unidad(es))',266),
(NULL,893,'Lactulosa','Concentración: 10g/15ml; Forma farmacéutica: Jarabe; Vía: Oral','55247 - Frasco (240 Mililitro)',266),
(NULL,931,'Levotiroxina','Concentración: 100mcg; Forma farmacéutica: Tableta; Vía: Oral','1074 - Unidad (1 Unidad(es))',266),
(NULL,1011,'Metformina','Concentración: 1000mg; Forma farmacéutica: Tableta; Vía: Oral','1155 - Unidad (1 Unidad(es))',266),
(NULL,1046,'Metronidazol','Concentración: 500mg; Forma farmacéutica: Tableta; Vía: Oral','1192 - Unidad (1 Unidad(es))',266),
(NULL,1218,'Piridostigmina bromuro','Concentración: 60mg; Presentación: Tableta; Vía: Oral','1368 - Unidad (1 Unidad(es))',266),
(NULL,1235,'Prednicarbato (tubo 10g)','Concentración: 0.25%; Presentación: Crema; Vía: Tópica','77946 - Tubo (10 Gramos)',266),
(NULL,1235,'Prednicarbato (tubo 30g)','Concentración: 0.25%; Presentación: Crema; Vía: Tópica','77947 - Tubo (30 Gramos)',266),
(NULL,1240,'Prednisona','Concentración: 5mg; Forma farmacéutica: Tableta; Vía: Oral','30468 - Unidad (1 Unidad(es))',266),
(NULL,1247,'Propafenona clorhidrato','Concentración: 150mg; Presentación: Tableta; Vía: Oral','1400 - Unidad (1 Unidad(es))',266),
(NULL,1258,'Psyllium plántago','Concentración: 400gr; Presentación: Polvo; Vía: Oral','54482 - Bote (400 Gramos)',266),
(NULL,1262,'Ramipril','Concentración: 5mg; Forma farmacéutica: Cápsula; Vía: Oral','1415 - Unidad (1 Unidad(es))',266),
(NULL,1320,'Sildenafil','Concentración: 50mg; Presentación: Cápsula/tableta/comprimido; Vía: Oral','1473 - Cápsula/tableta (1 Unidad(es))',266),
(NULL,1350,'Sucralfato','Concentración: 1g/5ml; Forma farmacéutica: Suspensión; Vía: Oral','56704 - Frasco (240 Mililitro)',266),
(NULL,1372,'Tartrato de ergotamina + clonixinato de lisina','Concentración: 1mg+125mg; Presentación: Tableta; Vía: Oral','1526 - Unidad (1 Unidad(es))',266),
(NULL,1399,'Tioconazol','Concentración: 1%; Forma farmacéutica: Crema; Vía: Tópico','1553 - Tubo (30 Gramos)',266),
(NULL,1466,'Vitamina B12 (hidroxi- o cianocobalamina)','Concentración: 5000mcg; Forma farmacéutica: Solución inyectable','1622 - Ampolla (2 Mililitro)',266),
(NULL,2506,'Jeringa 1ml (27g x 1/2")','Capacidad: 1ml; Condición: Estéril; Aguja: 27g x 1/2 pulgada tribiselada; Piezas: 3','2946 - Unidad (1 Unidad(es))',295),
(NULL,2601,'Hoja de bisturí','Calibre: 10; Condición: Estéril; Material: Acero inoxidable','3161 - Unidad (1 Unidad(es))',295),
(NULL,2754,'Esparadrapo','Ancho: 1 Pulgada; Clase: Impermeable; Largo: 10 Yardas; Material: Seda; Tipo: Hipoalergénico','7272 - Rollo (1 Unidad(es))',295),
(NULL,2919,'Electroencefalograma','Tipo: Servicio','3503 - Unidad (1 Unidad(es))',182),
(NULL,2960,'Ultrasonido hepático y biliar','Tipo: Servicio','3544 - Unidad (1 Unidad(es))',182),
(NULL,4807,'Algodón','Absorbente: Si; Pureza: 100%','39453 - Rollo (1 Libra)',295),
(NULL,7769,'Ultrasonido renal','Tipo: Servicio','8129 - Unidad (1 Unidad(es))',182),
(NULL,7771,'Ultrasonido testicular','Tipo: Servicio','8131 - Unidad (1 Unidad(es))',182),
(NULL,7772,'Ultrasonido abdomen superior','Tipo: Servicio','8132 - Unidad (1 Unidad(es))',182),
(NULL,7773,'Ultrasonido abdomen inferior','Tipo: Servicio','8133 - Unidad (1 Unidad(es))',182),
(NULL,7774,'Ultrasonido tiroides','Tipo: Servicio','8134 - Unidad (1 Unidad(es))',182),
(NULL,9943,'Ultrasonido abdomen completo','Tipo: Servicio','10363 - Unidad (1 Unidad(es))',182),
(NULL,9949,'Elastografía hepática por ultrasonido','Tipo: Servicio','10369 - Unidad (1 Unidad(es))',182),
(NULL,25683,'Benzoilo peróxido','Concentración: 5%; Forma farmacéutica: Crema; Vía: Tópico','27553 - Tubo (40 Gramos)',266),
(NULL,26566,'Bromuro de otilonio','Concentración: 40mg; Forma farmacéutica: Tableta; Vía: Oral','119964 - Unidad (1 Unidad(es))',266),
(NULL,26571,'Carboximetilcelulosa','Concentración: 0.5%; Forma farmacéutica: Solución; Vía: Oftálmica','120542 - Gotero (30 Mililitro)',266),
(NULL,26578,'Pasta lassar (óxido de zinc)','Concentración: 25%; Forma farmacéutica: Crema; Vía: Tópico','103555 - Tarro (120 Gramos)',266),
(NULL,27986,'Sales de rehidratación oral','Concentración: 3.5+2.9+1.5+20g; Forma farmacéutica: Polvo; Vía: Oral','41099 - Sobre (1 Unidad(es))',266),
(NULL,30046,'Timolol maleato','Concentración: 0.5%; Forma farmacéutica: Gotas oftálmicas; Vía: Oftálmico','32696 - Frasco gotero (5 Mililitro)',266),
(NULL,30109,'Clobetasol propionato','Concentración: 0.05%; Forma farmacéutica: Crema; Vía: Tópico','32761 - Tubo (30 Gramos)',266),
(NULL,32081,'Jeringa 5cc (22g x 1 1/2")','Capacidad: 5cc; Aguja: 22g x 1 1/2 pulgada; Tipo: Desechable','34926 - Unidad (1 Unidad(es))',295),
(NULL,34556,'Bromopride','Acción: Antiemético; Concentración: 10mg; Forma farmacéutica: Cápsula; Vía: Oral','56774 - Unidad (1 Unidad(es))',266),
(NULL,35088,'Tomografía helicoidal abdomen inferior','Tipo: Servicio','38473 - Unidad (1 Unidad(es))',182),
(NULL,35106,'Tomografía helicoidal parótida','Tipo: Servicio','38491 - Unidad (1 Unidad(es))',182),
(NULL,35116,'Tomografía helicoidal tórax','Tipo: Servicio','38499 - Unidad (1 Unidad(es))',182),
(NULL,35319,'Diosmina + hesperidina','Concentración: 450mg+50mg; Forma farmacéutica: Tableta; Vía: Oral','38714 - Unidad (1 Unidad(es))',266),
(NULL,36796,'Jeringa 1ml insulina (29g x 1/2")','Capacidad: 1ml; Condición: Estéril; Aguja: 29g x 1/2 pulgada; Escala de 100 unidades','41318 - Unidad (1 Unidad(es))',295),
(NULL,37284,'Insulina glargina','Concentración: 100u/ml; Forma farmacéutica: Solución inyectable','129930 - Vial (10 Mililitro)',266),
(NULL,37313,'Amoxicilina','Concentración: 500mg; Forma farmacéutica: Tableta; Vía: Oral','41052 - Unidad (1 Unidad(es))',266),
(NULL,37316,'Amoxicilina + ácido clavulánico','Concentración: 500mg+125mg; Forma farmacéutica: Cápsula; Vía: Oral','41054 - Unidad (1 Unidad(es))',266),
(NULL,37351,'Antiespasmódico simple','Concentración: 10mg; Forma farmacéutica: Cápsula; Vía: Oral','56816 - Unidad (1 Unidad(es))',266),
(NULL,37559,'Fenitoína sódica','Concentración: 100mg; Forma farmacéutica: Tableta; Vía: Oral','85243 - Unidad (1 Unidad(es))',266),
(NULL,37571,'Lidocaína clorhidrato','Concentración: 20mg/ml (2%); Forma farmacéutica: Solución inyectable','41373 - Vial (50 Mililitro)',266),
(NULL,37829,'Salbutamol','Concentración: 90mcg; Forma farmacéutica: Aerosol; Vía: Por aspersión','77809 - Frasco aspersor (200 dosis)',266)
`;

const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM base_datos_central`;
console.log(`✅ Migración completada. ${count} registros en base_datos_central.`);
console.log(`✅ Tabla proveedores lista.`);
process.exit(0);
