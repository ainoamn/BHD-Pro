/** Download Excel-compatible spreadsheet (SpreadsheetML / .xls). */
export function downloadExcel(
  filename: string,
  headers: string[],
  rows: (string | number)[][],
  sheetName = "Report"
) {
  const escapeXml = (v: string | number) =>
    String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const headerRow = `<Row>${headers
    .map((h) => `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`)
    .join("")}</Row>`;

  const dataRows = rows
    .map((row) => {
      const cells = row
        .map((cell) => {
          const isNum = typeof cell === "number" || (typeof cell === "string" && cell !== "" && !Number.isNaN(Number(cell)));
          const type = isNum ? "Number" : "String";
          const value = isNum ? Number(cell) : escapeXml(cell);
          return `<Cell><Data ss:Type="${type}">${value}</Data></Cell>`;
        })
        .join("");
      return `<Row>${cells}</Row>`;
    })
    .join("");

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${escapeXml(sheetName).slice(0, 31)}">
  <Table>
   ${headerRow}
   ${dataRows}
  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const base = filename.replace(/\.(csv|xlsx|xls)$/i, "");
  link.download = `${base}.xls`;
  link.click();
  URL.revokeObjectURL(url);
}

/** Download a simple multi-page PDF table using jsPDF. */
export async function downloadReportPdf(
  filename: string,
  title: string,
  headers: string[],
  rows: (string | number)[][]
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const usableWidth = pageWidth - margin * 2;
  const colCount = Math.max(headers.length, 1);
  const colWidth = usableWidth / colCount;
  const rowHeight = 7;
  let y = margin;

  const drawHeader = () => {
    doc.setFontSize(14);
    doc.text(title, margin, y);
    y += 8;
    doc.setFontSize(9);
    doc.setFillColor(6, 95, 70);
    doc.setTextColor(255, 255, 255);
    doc.rect(margin, y, usableWidth, rowHeight, "F");
    headers.forEach((h, i) => {
      doc.text(String(h).slice(0, 28), margin + i * colWidth + 1.5, y + 4.8);
    });
    y += rowHeight + 1;
    doc.setTextColor(20, 20, 20);
  };

  drawHeader();

  for (const row of rows) {
    if (y + rowHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
      drawHeader();
    }
    const shade = rows.indexOf(row) % 2 === 0;
    if (shade) {
      doc.setFillColor(245, 248, 250);
      doc.rect(margin, y, usableWidth, rowHeight, "F");
    }
    row.forEach((cell, i) => {
      doc.text(String(cell ?? "").slice(0, 32), margin + i * colWidth + 1.5, y + 4.8);
    });
    y += rowHeight;
  }

  const base = filename.replace(/\.(csv|xlsx|xls|pdf)$/i, "");
  doc.save(`${base}.pdf`);
}
