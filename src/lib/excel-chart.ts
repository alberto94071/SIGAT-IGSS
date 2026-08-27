import JSZip from "jszip";

// ExcelJS (única librería de Excel que ya usaba este proyecto capaz de
// escribir .xlsx desde cero) no sabe escribir gráficos nativos — no tiene
// ningún método `addChart` ni genera las partes OOXML de un chart. La
// librería `xlsx`/SheetJS tampoco puede (community edition). El cliente
// confirmó que necesita gráficos nativos de verdad (editables al abrir en
// Excel, no una imagen pegada), así que esta función inyecta manualmente
// las partes OOXML de un gráfico de barras en el .xlsx que ya generó
// ExcelJS, después de escribirlo a buffer — construye a mano
// xl/charts/chart1.xml + xl/drawings/drawing1.xml + sus relaciones y
// referencia esas partes desde la hoja. Cada reporte solo necesita UN
// gráfico, así que esto no soporta múltiples gráficos por archivo (usa
// siempre chart1.xml/drawing1.xml — si algún día se necesita más de uno,
// hay que parametrizar el índice).
export type SerieGrafico = { categorias: string[]; valores: number[]; nombreSerie: string };

function escaparXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// Convierte un índice de columna 1-based a letra (1 -> A, 27 -> AA)
function colALetra(n: number): string {
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export async function agregarGraficoBarras(
  buffer: Buffer,
  opts: {
    sheetXmlIndex: number; // 1-based, orden en que ExcelJS agregó la hoja (addWorksheet) -> sheet{N}.xml
    sheetName: string;
    titulo: string;
    // Fila/columna (1-based) donde arranca la tabla de datos que alimenta el gráfico.
    filaEncabezado: number;
    colCategoria: number;
    colValor: number;
    cantidadFilasDatos: number;
    serie: SerieGrafico;
    anchorColDesde?: number; anchorFilaDesde?: number;
    anchorColHasta?: number; anchorFilaHasta?: number;
  }
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer);

  const hoja = escaparXml(opts.sheetName);
  const colCat = colALetra(opts.colCategoria);
  const colVal = colALetra(opts.colValor);
  const filaIni = opts.filaEncabezado + 1;
  const filaFin = opts.filaEncabezado + opts.cantidadFilasDatos;
  const catRef = `${hoja}!$${colCat}$${filaIni}:$${colCat}$${filaFin}`;
  const valRef = `${hoja}!$${colVal}$${filaIni}:$${colVal}$${filaFin}`;
  const valHeaderRef = `${hoja}!$${colVal}$${opts.filaEncabezado}`;

  const axId1 = "111111111";
  const axId2 = "222222222";

  const catPts = opts.serie.categorias.map((c, i) =>
    `<c:pt idx="${i}"><c:v>${escaparXml(c)}</c:v></c:pt>`
  ).join("");
  const valPts = opts.serie.valores.map((v, i) =>
    `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`
  ).join("");

  const chartXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<c:chart>
<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${escaparXml(opts.titulo)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>
<c:autoTitleDeleted val="0"/>
<c:plotArea>
<c:layout/>
<c:barChart>
<c:barDir val="col"/>
<c:grouping val="clustered"/>
<c:varyColors val="0"/>
<c:ser>
<c:idx val="0"/>
<c:order val="0"/>
<c:tx><c:strRef><c:f>${escaparXml(valHeaderRef)}</c:f><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${escaparXml(opts.serie.nombreSerie)}</c:v></c:pt></c:strCache></c:strRef></c:tx>
<c:cat><c:strRef><c:f>${escaparXml(catRef)}</c:f><c:strCache><c:ptCount val="${opts.serie.categorias.length}"/>${catPts}</c:strCache></c:strRef></c:cat>
<c:val><c:numRef><c:f>${escaparXml(valRef)}</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${opts.serie.valores.length}"/>${valPts}</c:numCache></c:numRef></c:val>
</c:ser>
<c:axId val="${axId1}"/>
<c:axId val="${axId2}"/>
</c:barChart>
<c:catAx>
<c:axId val="${axId1}"/>
<c:scaling><c:orientation val="minMax"/></c:scaling>
<c:delete val="0"/>
<c:axPos val="b"/>
<c:crossAx val="${axId2}"/>
</c:catAx>
<c:valAx>
<c:axId val="${axId2}"/>
<c:scaling><c:orientation val="minMax"/></c:scaling>
<c:delete val="0"/>
<c:axPos val="l"/>
<c:crossAx val="${axId1}"/>
</c:valAx>
</c:plotArea>
<c:legend><c:legendPos val="b"/></c:legend>
<c:plotVisOnly val="1"/>
</c:chart>
</c:chartSpace>`;

  const desdeCol = opts.anchorColDesde ?? (opts.colValor + 2);
  const desdeFila = opts.anchorFilaDesde ?? 1;
  const hastaCol = opts.anchorColHasta ?? (desdeCol + 8);
  const hastaFila = opts.anchorFilaHasta ?? (desdeFila + 16);

  const drawingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
<xdr:twoCellAnchor>
<xdr:from><xdr:col>${desdeCol - 1}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${desdeFila - 1}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
<xdr:to><xdr:col>${hastaCol - 1}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${hastaFila - 1}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
<xdr:graphicFrame macro="">
<xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="Grafico 1"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>
<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/></a:graphicData></a:graphic>
</xdr:graphicFrame>
<xdr:clientData/>
</xdr:twoCellAnchor>
</xdr:wsDr>`;

  const drawingRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/>
</Relationships>`;

  zip.file("xl/charts/chart1.xml", chartXml);
  zip.file("xl/drawings/drawing1.xml", drawingXml);
  zip.file("xl/drawings/_rels/drawing1.xml.rels", drawingRels);

  // Content types: registrar las dos partes nuevas.
  const ctPath = "[Content_Types].xml";
  let ct = await zip.file(ctPath)!.async("string");
  const overrides = `<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/><Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`;
  ct = ct.replace("</Types>", `${overrides}</Types>`);
  zip.file(ctPath, ct);

  // Relación hoja -> drawing (crea el .rels de la hoja si no existía).
  const sheetPath = `xl/worksheets/sheet${opts.sheetXmlIndex}.xml`;
  const sheetRelsPath = `xl/worksheets/_rels/sheet${opts.sheetXmlIndex}.xml.rels`;
  let sheetRelsFile = zip.file(sheetRelsPath);
  let rId = "rId1";
  if (sheetRelsFile) {
    let relsXml = await sheetRelsFile.async("string");
    const existentes = relsXml.match(/Id="rId(\d+)"/g) ?? [];
    const maxId = existentes.reduce((m, s) => Math.max(m, Number(s.match(/\d+/)![0])), 0);
    rId = `rId${maxId + 1}`;
    relsXml = relsXml.replace(
      "</Relationships>",
      `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>`
    );
    zip.file(sheetRelsPath, relsXml);
  } else {
    zip.file(sheetRelsPath, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>
</Relationships>`);
  }

  let sheetXml = await zip.file(sheetPath)!.async("string");
  const drawingTag = `<drawing r:id="${rId}"/>`;
  if (/<(tableParts|extLst)/.test(sheetXml)) {
    sheetXml = sheetXml.replace(/<(tableParts|extLst)/, `${drawingTag}<$1`);
  } else {
    sheetXml = sheetXml.replace("</worksheet>", `${drawingTag}</worksheet>`);
  }
  zip.file(sheetPath, sheetXml);

  const out = await zip.generateAsync({ type: "nodebuffer" });
  return out;
}
