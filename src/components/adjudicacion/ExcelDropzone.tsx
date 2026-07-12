"use client";
import { useRef, useState } from "react";
import { UploadCloud, Download, FileSpreadsheet } from "lucide-react";
import { descargarPlantillaExcel } from "@/lib/excel-utils";

interface Props {
  headers: string[];
  ejemplo: (string | number)[];
  templateFilename: string;
  onFile: (file: File) => void;
  hint?: string;
}

// Zona de arrastrar-y-soltar (o clic para elegir) un archivo Excel, con
// instrucciones claras del formato esperado y una plantilla descargable ya
// llena con un ejemplo — así se sabe exactamente qué columna llena qué campo,
// sin depender de video ni de que alguien recuerde una convención de memoria.
export default function ExcelDropzone({ headers, ejemplo, templateFilename, onFile, hint }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
          <FileSpreadsheet className="w-3.5 h-3.5" /> Cargar desde Excel
        </p>
        <button type="button" onClick={() => descargarPlantillaExcel(templateFilename, headers, ejemplo)}
          className="flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800">
          <Download className="w-3.5 h-3.5" /> Descargar plantilla de ejemplo
        </button>
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault(); setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) onFile(file);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-1.5 border-2 border-dashed rounded-xl px-4 py-6 cursor-pointer transition-colors ${dragOver ? "border-brand-500 bg-brand-50" : "border-gray-300 bg-white hover:border-brand-300"}`}
      >
        <UploadCloud className="w-6 h-6 text-gray-400" />
        <p className="text-xs text-gray-600 text-center">
          Arrastra tu archivo .xlsx aquí, o haz clic para seleccionarlo
        </p>
        <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
      </div>

      <div className="text-[11px] text-gray-500">
        <p className="font-semibold text-gray-600 mb-1">
          Formato esperado — fila 1: encabezados, los datos empiezan en la fila 2:
        </p>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-gray-100">
                {headers.map((h, i) => (
                  <th key={i} className="px-2 py-1 text-left font-semibold text-gray-600 whitespace-nowrap">
                    {String.fromCharCode(65 + i)}: {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="bg-white">
                {ejemplo.map((e, i) => (
                  <td key={i} className="px-2 py-1 text-gray-500 whitespace-nowrap">{e}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        {hint && <p className="mt-1.5">{hint}</p>}
      </div>
    </div>
  );
}
