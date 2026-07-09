import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { state, autoSave } from './state.js';
import { uid, todayStr, formatDate, showToast, closeModal, esc } from './utils.js';
import { pushNotif } from './notifications.js';

export function getSubjectStats(subjectId) {
  const logs = state.attendance.logs.filter(l => l.subjectId === subjectId);
  const total = logs.length;
  const present = logs.filter(l => l.status === 'present').length;
  const absent = total - present;
  const pct = total > 0 ? Math.round((present / total) * 100) : 0;
  return { total, present, absent, pct };
}

export function canSkipCount(attended, total, required) {
  let skip = 0;
  while (((attended) / (total + skip + 1)) * 100 >= required) { skip++; }
  return skip;
}

export function lecturesNeeded(attended, total, required) {
  return Math.max(0, Math.ceil(((required * total) - (100 * attended)) / (100 - required)));
}

export function initAttendance() {
  document.getElementById('attendDate').textContent =
    new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  document.getElementById('addSubjectBtn').addEventListener('click', openAddSubjectModal);
  document.getElementById('logLectureBtn').addEventListener('click', openLogLectureModal);
  document.getElementById('attendExportPdfBtn')?.addEventListener('click', exportAttendancePDF);
  document.getElementById('saveSubjectBtn').addEventListener('click', saveSubject);
  document.getElementById('cancelSubjectBtn').addEventListener('click', () => closeModal('addSubjectModal'));
  document.getElementById('saveLogBtn').addEventListener('click', saveLog);
  document.getElementById('cancelLogBtn').addEventListener('click', () => closeModal('logLectureModal'));
  document.getElementById('logFilterSubject').addEventListener('change', renderAttendanceLog);
  document.getElementById('logFilterType').addEventListener('change', renderAttendanceLog);
  document.getElementById('logDate').value = todayStr();

  renderAttendance();
}

export function openAddSubjectModal() {
  ['subjectName', 'subjectShort', 'subjectProf'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('subjectRequired').value = '75';
  document.getElementById('addSubjectModal').classList.remove('hidden');
}

export function openLogLectureModal() {
  populateSubjectDropdown('logSubjectSel');
  document.getElementById('logDate').value = todayStr();
  document.getElementById('logLectureModal').classList.remove('hidden');
}

function populateSubjectDropdown(selId) {
  const sel = document.getElementById(selId);
  sel.innerHTML = state.attendance.subjects.length
    ? state.attendance.subjects.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')
    : '<option value="">No subjects added yet</option>';
}

function saveSubject() {
  const name = document.getElementById('subjectName').value.trim();
  const short = document.getElementById('subjectShort').value.trim();
  const prof = document.getElementById('subjectProf').value.trim();
  const req = +document.getElementById('subjectRequired').value || 75;
  const color = document.getElementById('subjectColor').value;
  if (!name) { showToast('Enter subject name'); return; }
  state.attendance.subjects.push({ id: uid(), name, shortName: short || name.slice(0, 4).toUpperCase(), professor: prof, requiredAttendance: req, color });
  autoSave();
  closeModal('addSubjectModal');
  renderAttendance();
  showToast(`${name} added!`);
}

function saveLog() {
  const subjectId = document.getElementById('logSubjectSel').value;
  if (!subjectId) { showToast('Add a subject first'); return; }
  const status = document.getElementById('logStatus').value;
  const lectureType = document.getElementById('logLectureType').value;
  const date = document.getElementById('logDate').value || todayStr();
  const notes = document.getElementById('logNotes').value.trim();
  state.attendance.logs.push({ id: uid(), date, subjectId, status, lectureType, notes });
  autoSave();
  closeModal('logLectureModal');
  document.getElementById('logNotes').value = '';
  renderAttendance();
  showToast(status === 'present' ? '✓ Present logged' : '✗ Absent logged');
  checkAttendanceNotifications();
}

export function renderAttendance() {
  renderSubjectCards();
  renderAttendanceLog();
  renderAttendanceKpi();
  const filterSel = document.getElementById('logFilterSubject');
  filterSel.innerHTML = '<option value="">All Subjects</option>' +
    state.attendance.subjects.map(s => `<option value="${s.id}">${esc(s.shortName || s.name)}</option>`).join('');
}

function renderAttendanceKpi() {
  const subjects = state.attendance.subjects;
  if (!subjects.length) return;
  let totalPresent = 0, totalLectures = 0, safe = 0, risk = 0;
  subjects.forEach(sub => {
    const st = getSubjectStats(sub.id);
    totalPresent += st.present;
    totalLectures += st.total;
    if (st.pct >= 85 && st.total > 0) safe++;
    if (st.pct < 75 && st.total > 0) risk++;
  });
  const overallPct = totalLectures > 0 ? Math.round((totalPresent / totalLectures) * 100) : 0;
  document.getElementById('attendOverall').textContent = overallPct + '%';
  document.getElementById('attendTotal').textContent = totalLectures;
  document.getElementById('attendSafe').textContent = safe;
  document.getElementById('attendRisk').textContent = risk;

  const setBar = (id, val, max) => { const el = document.getElementById(id); if (el) el.style.width = Math.min((val / (max || 1)) * 100, 100) + '%'; };
  setBar('attendOverallBar', overallPct, 100);
  setBar('attendSafeBar', safe, subjects.length || 1);
  setBar('attendRiskBar', risk, subjects.length || 1);
}

function renderSubjectCards() {
  const grid = document.getElementById('subjectCardsGrid');
  const subjects = state.attendance.subjects;
  if (!subjects.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">No subjects yet. Add your first subject to start tracking attendance.</div>`;
    return;
  }
  grid.innerHTML = subjects.map(sub => {
    const st = getSubjectStats(sub.id);
    const req = sub.requiredAttendance || 75;
    const statusClass = st.total === 0 ? 'status-safe' : st.pct >= 85 ? 'status-safe' : st.pct >= req ? 'status-warning' : 'status-critical';
    const statusText = st.total === 0 ? 'No Data' : st.pct >= 85 ? 'Safe' : st.pct >= req ? 'Warning' : 'Critical';
    const skip = st.total > 0 ? canSkipCount(st.present, st.total, req) : 0;
    const needed = st.total > 0 && st.pct < req ? lecturesNeeded(st.present, st.total, req) : 0;
    let insight = '';
    if (st.total === 0) insight = 'No lectures logged yet.';
    else if (st.pct >= 85) insight = `Can skip <strong>${skip}</strong> more lecture${skip !== 1 ? 's' : ''} safely.`;
    else if (st.pct >= req) insight = `At threshold. Attend <strong>${needed + 1}</strong> more to reach 85%.`;
    else insight = `Needs <strong>${needed}</strong> consecutive lectures to reach ${req}%.`;
    return `
      <div class="subject-card" style="--subject-color:${esc(sub.color)}">
        <div class="subject-card-header">
          <div class="subject-name-wrap">
            <div class="subject-name">${esc(sub.name)}</div>
            <div class="subject-short">${esc(sub.shortName)}</div>
            ${sub.professor ? `<div class="subject-prof">Prof. ${esc(sub.professor)}</div>` : ''}
          </div>
          <span class="subject-status-badge ${statusClass}">${statusText}</span>
        </div>
        <div class="subject-ring-row">
          <div>
            <div class="subject-pct" style="color:${esc(sub.color)}">${st.pct}%</div>
            <div class="subject-pct-label">Attendance</div>
          </div>
          <div style="flex:1;height:6px;background:var(--surface-light);border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${st.pct}%;background:${esc(sub.color)};border-radius:3px;transition:width .8s var(--spring)"></div>
          </div>
        </div>
        <div class="subject-stat-grid">
          <div class="subject-stat"><div class="subject-stat-val" style="color:var(--accent-green)">${st.present}</div><div class="subject-stat-key">Present</div></div>
          <div class="subject-stat"><div class="subject-stat-val" style="color:var(--danger)">${st.absent}</div><div class="subject-stat-key">Absent</div></div>
          <div class="subject-stat"><div class="subject-stat-val">${st.total}</div><div class="subject-stat-key">Total</div></div>
        </div>
        <div class="subject-insight">${insight}</div>
        <div class="subject-actions">
          <button class="attend-btn attend-btn-present" data-id="${sub.id}" data-action="present">✓ Present</button>
          <button class="attend-btn attend-btn-absent" data-id="${sub.id}" data-action="absent">✗ Absent</button>
          <button class="attend-btn-delete" data-id="${sub.id}" data-action="delete" title="Delete subject">✕</button>
        </div>
      </div>`;
  }).join('');

  grid.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      if (action === 'delete') {
        if (!confirm('Delete this subject and all its logs?')) return;
        state.attendance.subjects = state.attendance.subjects.filter(s => s.id !== id);
        state.attendance.logs = state.attendance.logs.filter(l => l.subjectId !== id);
        autoSave();
        renderAttendance();
        showToast('Subject deleted');
      } else {
        state.attendance.logs.push({ id: uid(), date: todayStr(), subjectId: id, status: action, lectureType: 'theory', notes: '' });
        autoSave();
        renderAttendance();
        showToast(action === 'present' ? '✓ Present logged' : '✗ Absent logged');
        checkAttendanceNotifications();
      }
    });
  });
}

function renderAttendanceLog() {
  const container = document.getElementById('attendanceLog');
  const filterSub = document.getElementById('logFilterSubject').value;
  const filterType = document.getElementById('logFilterType').value;
  let logs = [...state.attendance.logs].reverse().slice(0, 60);
  if (filterSub) logs = logs.filter(l => l.subjectId === filterSub);
  if (filterType) logs = logs.filter(l => l.status === filterType);
  if (!logs.length) {
    container.innerHTML = `<div class="empty-state">No lectures logged yet</div>`;
    return;
  }
  const subMap = {};
  state.attendance.subjects.forEach(s => { subMap[s.id] = s; });
  container.innerHTML = `
    <div class="attend-log-row attend-log-header" style="font-size:.7rem;color:var(--text-dim);padding:.55rem 1rem">
      <span>Date</span><span>Subject</span><span>Type</span><span>Status</span><span></span>
    </div>
    ${logs.map(l => {
      const sub = subMap[l.subjectId];
      if (!sub) return '';
      return `
        <div class="attend-log-row">
          <span class="log-date">${formatDate(l.date)}</span>
          <span class="log-subject">${esc(sub.shortName)}</span>
          <span class="log-type">${esc(l.lectureType)}</span>
          <span class="log-status ${l.status}">${l.status}</span>
          <button class="btn-icon" data-lid="${l.id}" title="Delete" style="width:26px;height:26px;font-size:.7rem">✕</button>
        </div>`;
    }).join('')}`;
  container.querySelectorAll('[data-lid]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.attendance.logs = state.attendance.logs.filter(l => l.id !== btn.dataset.lid);
      autoSave();
      renderAttendance();
      showToast('Log entry removed');
    });
  });
}

export function exportAttendancePDF() {
  const btn = document.getElementById('attendExportPdfBtn');
  if (btn) btn.disabled = true;
  try {
    const doc  = new jsPDF({ unit: 'pt', format: 'a4' });
    const PW   = doc.internal.pageSize.getWidth();
    const PH   = doc.internal.pageSize.getHeight();
    const M    = 40;
    const INK  = [28, 28, 30];
    const SUB  = [120, 120, 128];
    const BLUE = [10, 132, 255];
    const BAND = [16, 18, 28];
    const LINE = [225, 226, 232];
    const ALT  = [244, 245, 248];

    const subjects = state.attendance.subjects;
    let   totalP = 0, totalL = 0;
    const statsPerSub = subjects.map(s => {
      const st = getSubjectStats(s.id);
      totalP += st.present; totalL += st.total;
      return { sub: s, st };
    });
    const overallPct = totalL > 0 ? Math.round((totalP / totalL) * 100) : 0;

    // ── Header ────────────────────────────────────────────────────────────────
    doc.setFillColor(...BAND);
    doc.rect(0, 0, PW, 130, 'F');
    doc.setFillColor(...BLUE);
    doc.rect(0, 130, PW, 3, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.text('Ezlifz', M, 56);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(180, 185, 195);
    doc.text('Attendance Report', M, 76);
    doc.setFontSize(9);
    doc.text('Generated ' + new Date().toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' }), M, 96);

    // ── Summary chips ──────────────────────────────────────────────────────────
    const chips = [
      ['Subjects', subjects.length],
      ['Total Classes', totalL],
      ['Attended', totalP],
      ['Missed', totalL - totalP],
      ['Overall', overallPct + '%'],
    ];
    let cx = PW - M - chips.length * 78;
    chips.forEach(([label, val]) => {
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(String(val), cx, 60);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(170, 175, 188);
      doc.text(label.toUpperCase(), cx, 74);
      cx += 78;
    });

    let y = 158;

    // ── Attendance table ───────────────────────────────────────────────────────
    if (subjects.length) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(...INK);
      doc.setFillColor(...BLUE);
      doc.rect(M, y - 10, 4, 18, 'F');
      doc.text('Attendance by Subject', M + 10, y + 4);
      y += 18;
      doc.setDrawColor(...LINE);
      doc.setLineWidth(0.5);
      doc.line(M, y, PW - M, y);
      y += 8;

      doc.autoTable({
        head: [['Subject', 'Professor', 'Required %', 'Total', 'Present', 'Absent', 'Attendance %', 'Status']],
        body: statsPerSub.map(({ sub, st }) => {
          const req    = sub.requiredAttendance || 75;
          const status = st.total === 0 ? 'No Data' : st.pct >= 85 ? 'Safe' : st.pct >= req ? 'Warning' : 'Critical';
          return [sub.name, sub.professor || '—', req + '%', st.total, st.present, st.absent, st.pct + '%', status];
        }),
        startY: y,
        margin: { left: M, right: M },
        styles:           { font: 'helvetica', fontSize: 8.5, cellPadding: 5.5, textColor: INK, lineColor: LINE, lineWidth: 0.4 },
        headStyles:       { fillColor: BLUE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
        alternateRowStyles: { fillColor: ALT },
        columnStyles: {
          6: { fontStyle: 'bold' },
          7: { fontStyle: 'bold' },
        },
        theme: 'grid',
        didParseCell: ({ cell, row, column }) => {
          if (column.index === 7 && row.section === 'body') {
            const v = cell.raw;
            if (v === 'Safe')     cell.styles.textColor = [40, 190, 90];
            if (v === 'Warning')  cell.styles.textColor = [230, 145, 10];
            if (v === 'Critical') cell.styles.textColor = [220, 60, 50];
          }
        }
      });
      y = doc.lastAutoTable.finalY + 28;
    }

    // ── Lecture log table ──────────────────────────────────────────────────────
    const logs = [...state.attendance.logs].sort((a, b) => b.date.localeCompare(a.date));
    if (logs.length) {
      if (y > PH - 120) { doc.addPage(); y = M + 10; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(...INK);
      doc.setFillColor(...BLUE);
      doc.rect(M, y - 10, 4, 18, 'F');
      doc.text('Lecture Log', M + 10, y + 4);
      y += 18;
      doc.setDrawColor(...LINE);
      doc.line(M, y, PW - M, y);
      y += 8;

      const subMap = {};
      subjects.forEach(s => subMap[s.id] = s);
      doc.autoTable({
        head: [['Date', 'Subject', 'Type', 'Status', 'Notes']],
        body: logs.map(l => {
          const s = subMap[l.subjectId];
          return [
            new Date(l.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
            s ? s.name : 'Unknown',
            l.lectureType || '—',
            l.status === 'present' ? 'Present' : 'Absent',
            l.notes || ''
          ];
        }),
        startY: y,
        margin: { left: M, right: M },
        styles:           { font: 'helvetica', fontSize: 8, cellPadding: 5, textColor: INK, lineColor: LINE, lineWidth: 0.4 },
        headStyles:       { fillColor: [40, 190, 90], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: ALT },
        theme: 'grid',
        didParseCell: ({ cell, row, column }) => {
          if (column.index === 3 && row.section === 'body') {
            cell.styles.textColor = cell.raw === 'Present' ? [40, 190, 90] : [220, 60, 50];
            cell.styles.fontStyle = 'bold';
          }
        }
      });
      y = doc.lastAutoTable.finalY + 20;
    }

    // ── Footer on each page ───────────────────────────────────────────────────
    const pageCount = doc.internal.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...SUB);
      doc.text('Generated using Ezlifz — Life OS', M, PH - 20);
      doc.text(`Page ${p} of ${pageCount}`, PW - M, PH - 20, { align: 'right' });
    }

    doc.save('Attendance_Report_' + todayStr() + '.pdf');
    showToast('Attendance PDF downloaded');
  } catch (err) {
    console.error('Attendance PDF failed:', err);
    showToast('Could not generate PDF — try again');
  } finally {
    if (btn) btn.disabled = false;
  }
}

export function checkAttendanceNotifications() {
  state.attendance.subjects.forEach(sub => {
    const st = getSubjectStats(sub.id);
    const req = sub.requiredAttendance || 75;
    if (st.total < 3) return;
    if (st.pct < req) pushNotif('danger', 'Attendance Critical', `${sub.name}: ${st.pct}% — ${lecturesNeeded(st.present, st.total, req)} lectures needed`);
    else if (st.pct < 85) pushNotif('warning', 'Attendance Warning', `${sub.name}: ${st.pct}% — approaching minimum threshold`);
  });
}
