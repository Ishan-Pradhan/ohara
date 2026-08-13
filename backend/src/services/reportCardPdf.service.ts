import PDFDocument from 'pdfkit';

import type { ReportCardSemesterSection } from '../serializers/examMark.serializer.js';

export interface ReportCardData {
  institutionName: string;
  studentName: string;
  programName: string;
  className: string;
  sectionName: string;
  batchName: string;
  semesters: ReportCardSemesterSection[];
  overallPercentage: number | null;
  overallGrade: string;
}

const fmtPct = (value: number | null): string => (value === null ? '—' : `${value.toFixed(1)}%`);

/** Generates an Academic Transcript PDF, grouping exam marks by semester/class in matrix tables. */
export const generateReportCardPdf = (data: ReportCardData): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).font('Helvetica-Bold').text(data.institutionName, { align: 'center' });
    doc.fontSize(12).font('Helvetica').text('Academic Transcript', { align: 'center' });
    doc.moveDown(1.5);

    doc.fontSize(10).font('Helvetica-Bold').text('Student: ', { continued: true }).font('Helvetica').text(data.studentName);
    doc.font('Helvetica-Bold').text('Program: ', { continued: true }).font('Helvetica').text(data.programName);
    doc.font('Helvetica-Bold').text('Class: ', { continued: true }).font('Helvetica').text(`${data.className} — Section ${data.sectionName}`);
    doc.font('Helvetica-Bold').text('Batch: ', { continued: true }).font('Helvetica').text(data.batchName);
    doc.moveDown(1.5);

    if (data.semesters.length === 0) {
      doc.font('Helvetica').fontSize(11).text('No exam marks have been entered yet.');
    }

    for (const sem of data.semesters) {
      if (doc.y > 680) doc.addPage();

      doc.font('Helvetica-Bold').fontSize(13).text(sem.className);
      doc.moveDown(0.3);

      const leftMargin = 50;
      const courseWidth = 160;
      const termColWidth = 65;
      const totalColWidth = 85;

      const columns: { label: string; x: number; width: number }[] = [
        { label: 'Course', x: leftMargin, width: courseWidth },
      ];

      let currentX = leftMargin + courseWidth;
      for (const term of sem.examTerms) {
        columns.push({ label: term.examTermName, x: currentX, width: termColWidth });
        currentX += termColWidth;
      }
      columns.push({ label: 'Total', x: currentX, width: totalColWidth });

      const tableTop = doc.y;
      doc.font('Helvetica-Bold').fontSize(9);
      columns.forEach((c) => {
        doc.text(c.label, c.x, tableTop, {
          width: c.width,
          align: c.label === 'Course' ? 'left' : 'center',
        });
      });
      
      const lineEndX = Math.min(540, currentX + totalColWidth);
      doc.moveTo(50, tableTop + 15).lineTo(lineEndX, tableTop + 15).stroke();

      let y = tableTop + 22;
      doc.font('Helvetica').fontSize(9);
      for (const course of sem.courses) {
        if (y > 700) {
          doc.addPage();
          y = 50;
        }
        doc.text(course.courseTitle, columns[0]!.x, y, { width: columns[0]!.width });

        let colIndex = 1;
        for (const term of sem.examTerms) {
          const mark = course.marks[term.examTermId];
          const text = mark ? `${mark.marksObtained}/${mark.maxMarks}` : '—';
          doc.text(text, columns[colIndex]!.x, y, { width: columns[colIndex]!.width, align: 'center' });
          colIndex++;
        }

        const totalText = `${course.courseTotalObtained}/${course.courseTotalMax} (${fmtPct(course.coursePercentage)})`;
        doc.text(totalText, columns[colIndex]!.x, y, { width: columns[colIndex]!.width, align: 'center' });

        y += 18;
      }

      doc.moveTo(50, y + 3).lineTo(lineEndX, y + 3).stroke();
      y += 12;
      doc.font('Helvetica-Bold').fontSize(9);
      doc.text(
        `Semester total: ${sem.totalObtained}/${sem.totalMax} (${fmtPct(sem.percentage)}) · Grade: ${sem.grade}`,
        50,
        y,
      );
      doc.moveDown(1.5);
    }

    if (doc.y > 680) doc.addPage();
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(12);
    doc.text(`Overall cumulative percentage: ${fmtPct(data.overallPercentage)}`);
    doc.text(`Overall cumulative grade: ${data.overallGrade}`);

    doc.end();
  });
};
