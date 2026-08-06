import PDFDocument from 'pdfkit';

export interface ReportCardCourseRow {
  courseTitle: string;
  score: number;
  maxScore: number;
  average: number | null;
  attendancePercentage: number | null;
}

export interface ReportCardData {
  institutionName: string;
  studentName: string;
  programName: string;
  className: string;
  sectionName: string;
  academicYearName: string;
  courses: ReportCardCourseRow[];
  overallAverage: number | null;
  overallAttendance: number | null;
  overallGrade: string;
}

const fmtPct = (value: number | null): string => (value === null ? '—' : `${value.toFixed(1)}%`);

/** The only file that touches pdfkit directly, per CLAUDE.md's "vendor SDKs
 * only in services/" rule — reportCard.controller.ts hands this
 * already-aggregated data and gets a Buffer back, no pdfkit imports
 * anywhere else. Named distinctly from pdf.service.ts, which is PDF text
 * *extraction* (course-material ingestion) — this is PDF *generation*. */
export const generateReportCardPdf = (data: ReportCardData): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).font('Helvetica-Bold').text(data.institutionName, { align: 'center' });
    doc.fontSize(12).font('Helvetica').text('Report Card / Marksheet', { align: 'center' });
    doc.moveDown(1.5);

    doc.fontSize(10).font('Helvetica-Bold').text('Student: ', { continued: true }).font('Helvetica').text(data.studentName);
    doc.font('Helvetica-Bold').text('Program: ', { continued: true }).font('Helvetica').text(data.programName);
    doc.font('Helvetica-Bold').text('Class: ', { continued: true }).font('Helvetica').text(`${data.className} — Section ${data.sectionName}`);
    doc.font('Helvetica-Bold').text('Academic year: ', { continued: true }).font('Helvetica').text(data.academicYearName);
    doc.moveDown(1.5);

    const tableTop = doc.y;
    const columns = [
      { label: 'Course', x: 50, width: 200 },
      { label: 'Score', x: 250, width: 80 },
      { label: 'Average', x: 330, width: 80 },
      { label: 'Attendance', x: 410, width: 100 },
    ];

    doc.font('Helvetica-Bold').fontSize(10);
    columns.forEach((c) => doc.text(c.label, c.x, tableTop, { width: c.width }));
    doc.moveTo(50, tableTop + 15).lineTo(510, tableTop + 15).stroke();

    let y = tableTop + 22;
    doc.font('Helvetica').fontSize(10);
    for (const course of data.courses) {
      doc.text(course.courseTitle, columns[0]!.x, y, { width: columns[0]!.width });
      doc.text(`${course.score}/${course.maxScore}`, columns[1]!.x, y, { width: columns[1]!.width });
      doc.text(fmtPct(course.average), columns[2]!.x, y, { width: columns[2]!.width });
      doc.text(fmtPct(course.attendancePercentage), columns[3]!.x, y, { width: columns[3]!.width });
      y += 20;
    }

    doc.moveTo(50, y + 5).lineTo(510, y + 5).stroke();
    y += 15;
    doc.font('Helvetica-Bold').fontSize(11);
    doc.text(`Overall average: ${fmtPct(data.overallAverage)}`, 50, y);
    y += 18;
    doc.text(`Overall attendance: ${fmtPct(data.overallAttendance)}`, 50, y);
    y += 18;
    doc.text(`Overall grade: ${data.overallGrade}`, 50, y);

    doc.end();
  });
};
