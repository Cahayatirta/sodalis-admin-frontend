import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

/**
 * Format currency in Indonesian Rupiah
 */
const formatIDR = (val) => {
  if (val === null || val === undefined || isNaN(val)) return 'Rp 0';
  return `Rp ${Number(val).toLocaleString('id-ID')}`;
};

/**
 * Generate Excel (.xlsx) stream for Loans, Users, or Audit Logs
 */
export const exportToExcel = async (module, data, res) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sodalis Micro-Finance Admin Terminal';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(module.toUpperCase(), {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  if (module === 'loans') {
    worksheet.columns = [
      { header: 'Loan Code', key: 'loan_code', width: 16 },
      { header: 'Borrower Name', key: 'borrower_name', width: 24 },
      { header: 'Major', key: 'major', width: 20 },
      { header: 'Amount', key: 'amount', width: 18 },
      { header: 'Tenor (Mo)', key: 'tenor_months', width: 12 },
      { header: 'Monthly Installment', key: 'monthly_installment', width: 20 },
      { header: 'Purpose', key: 'purpose', width: 20 },
      { header: 'Risk Tier', key: 'risk_tier', width: 14 },
      { header: 'AI Score', key: 'ai_score', width: 12 },
      { header: 'Status', key: 'status', width: 16 },
      { header: 'Created Date', key: 'created_at', width: 22 },
    ];

    data.forEach((item) => {
      worksheet.addRow({
        loan_code: item.loan_code,
        borrower_name: item.borrower_name,
        major: item.major,
        amount: formatIDR(item.amount),
        tenor_months: item.tenor_months,
        monthly_installment: formatIDR(item.monthly_installment),
        purpose: item.purpose,
        risk_tier: item.risk_tier,
        ai_score: item.ai_score,
        status: item.status,
        created_at: item.created_at ? new Date(item.created_at).toLocaleString('id-ID') : '-',
      });
    });
  } else if (module === 'users') {
    worksheet.columns = [
      { header: 'User ID', key: 'id', width: 36 },
      { header: 'Full Name', key: 'full_name', width: 24 },
      { header: 'Email', key: 'email', width: 26 },
      { header: 'Role', key: 'role', width: 14 },
      { header: 'Phone', key: 'phone', width: 18 },
      { header: 'Verified', key: 'is_verified', width: 12 },
      { header: 'KYC Document', key: 'kyc_document_path', width: 30 },
      { header: 'Registered At', key: 'created_at', width: 22 },
    ];

    data.forEach((item) => {
      worksheet.addRow({
        id: item.id,
        full_name: item.full_name,
        email: item.email,
        role: item.role,
        phone: item.phone || '-',
        is_verified: item.is_verified ? 'YES' : 'NO',
        kyc_document_path: item.kyc_document_path || 'None',
        created_at: item.created_at ? new Date(item.created_at).toLocaleString('id-ID') : '-',
      });
    });
  } else if (module === 'audit_logs') {
    worksheet.columns = [
      { header: 'Log ID', key: 'id', width: 36 },
      { header: 'Timestamp', key: 'timestamp', width: 22 },
      { header: 'Actor', key: 'actor', width: 18 },
      { header: 'Action', key: 'action', width: 24 },
      { header: 'Target Type', key: 'targetType', width: 16 },
      { header: 'Reason / Details', key: 'reason', width: 35 },
      { header: 'SHA-256 Hash', key: 'integrityHash', width: 40 },
    ];

    data.forEach((item) => {
      worksheet.addRow({
        id: item.id,
        timestamp: item.timestamp ? new Date(item.timestamp).toLocaleString('id-ID') : '-',
        actor: item.actor,
        action: item.action,
        targetType: item.targetType,
        reason: item.reason || '-',
        integrityHash: item.integrityHash || '-',
      });
    });
  }

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' }, // Dark slate
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="sodalis-${module}-report-${Date.now()}.xlsx"`
  );

  await workbook.xlsx.write(res);
  res.end();
};

/**
 * Generate PDF document stream for Loans, Users, or Audit Logs
 */
export const exportToPdf = (module, data, res) => {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="sodalis-${module}-report-${Date.now()}.pdf"`
  );

  doc.pipe(res);

  // Title & Header Banner
  doc.fontSize(18).fillColor('#1E293B').text('SODALIS MICRO-FINANCE', { align: 'center' });
  doc
    .fontSize(11)
    .fillColor('#64748B')
    .text('Admin Underwriting Terminal — Official Compliance Report', { align: 'center' });
  doc.moveDown(0.5);

  doc.fontSize(9).fillColor('#94A3B8').text(`Module: ${module.toUpperCase()} | Generated: ${new Date().toISOString()}`, {
    align: 'center',
  });
  doc.moveDown(1.5);

  doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#CBD5E1').stroke();
  doc.moveDown(1);

  // Content rendering based on module
  if (module === 'loans') {
    doc.fontSize(12).fillColor('#0F172A').text(`Loan Applications Summary (Total: ${data.length})`);
    doc.moveDown(0.5);

    data.slice(0, 35).forEach((item, index) => {
      doc
        .fontSize(9)
        .fillColor('#1E293B')
        .text(
          `${index + 1}. [${item.loan_code || 'N/A'}] ${item.borrower_name || 'Borrower'} - ${item.major || ''}`
        );
      doc
        .fontSize(8)
        .fillColor('#475569')
        .text(
          `   Amount: ${formatIDR(item.amount)} | Tenor: ${item.tenor_months || 0} Mo | Risk: ${
            item.risk_tier || 'N/A'
          } | AI Score: ${item.ai_score || 'N/A'} | Status: ${item.status || 'pending'}`
        );
      doc.moveDown(0.4);
    });
  } else if (module === 'users') {
    doc.fontSize(12).fillColor('#0F172A').text(`User Registrations & KYC Summary (Total: ${data.length})`);
    doc.moveDown(0.5);

    data.slice(0, 35).forEach((item, index) => {
      doc
        .fontSize(9)
        .fillColor('#1E293B')
        .text(`${index + 1}. ${item.full_name || 'User'} (${item.role || 'user'}) - ${item.email}`);
      doc
        .fontSize(8)
        .fillColor('#475569')
        .text(
          `   Verified: ${item.is_verified ? 'YES' : 'NO'} | Phone: ${item.phone || '-'} | KYC Doc: ${
            item.kyc_document_path ? 'Present' : 'Missing'
          }`
        );
      doc.moveDown(0.4);
    });
  } else if (module === 'audit_logs') {
    doc.fontSize(12).fillColor('#0F172A').text(`Compliance Audit Trail (Total: ${data.length})`);
    doc.moveDown(0.5);

    data.slice(0, 30).forEach((item, index) => {
      doc
        .fontSize(9)
        .fillColor('#1E293B')
        .text(`${index + 1}. [${item.action}] by ${item.actor} at ${item.timestamp || 'N/A'}`);
      doc
        .fontSize(8)
        .fillColor('#475569')
        .text(`   Target: ${item.targetType} (${item.targetId || '-'}) | Reason: ${item.reason || '-'}`);
      if (item.integrityHash) {
        doc.fontSize(7).fillColor('#94A3B8').text(`   SHA-256: ${item.integrityHash}`);
      }
      doc.moveDown(0.4);
    });
  }

  doc.moveDown(1);
  doc.fontSize(8).fillColor('#94A3B8').text('*** END OF REPORT — IMMUTABLE COMPLIANCE EXPORT ***', {
    align: 'center',
  });

  doc.end();
};

