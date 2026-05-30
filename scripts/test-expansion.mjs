function expandFixed(parentDate, allowedDays, endDate, maxCount = 999) {
  const weekIntervalDays = 7;
  const parentDay = parentDate.getDay();
  const weekStart = new Date(parentDate);
  weekStart.setDate(weekStart.getDate() - parentDay);
  weekStart.setHours(0, 0, 0, 0);
  const parentTime = { h: parentDate.getHours(), m: parentDate.getMinutes(), s: parentDate.getSeconds() };
  const sortedDays = [...allowedDays].sort((a, b) => a - b);
  const inclusiveEndDate = endDate ? new Date(endDate.getTime() + 24 * 60 * 60 * 1000) : null;
  let occurrenceNum = 1, weekOffset = 0;
  let done = false;
  const instances = [];
  while (!done && occurrenceNum < maxCount) {
    for (const d of sortedDays) {
      const c = new Date(weekStart);
      c.setDate(c.getDate() + weekOffset * weekIntervalDays + d);
      c.setHours(parentTime.h, parentTime.m, parentTime.s, 0);
      if (c <= parentDate) continue;
      if (inclusiveEndDate && c >= inclusiveEndDate) { done = true; break; }
      if (occurrenceNum >= maxCount) { done = true; break; }
      occurrenceNum++;
      instances.push(c.toDateString());
    }
    weekOffset++;
    if (weekOffset > 520) break;
  }
  return instances;
}

// Parent 1: days 2,3,4, start 2026-06-02T23:30Z, end 2026-06-19T00:00Z
const p1 = expandFixed(new Date('2026-06-02T23:30:00Z'), [2,3,4], new Date('2026-06-19T00:00:00Z'));
// Parent 30003: days 1,2, start 2026-06-22T23:30Z, end 2026-06-25T00:00Z
const p30003 = expandFixed(new Date('2026-06-22T23:30:00Z'), [1,2], new Date('2026-06-25T00:00:00Z'));
// Parent 30004: days 4,5, start 2026-07-02T23:30Z, end 2026-07-05T00:00Z
const p30004 = expandFixed(new Date('2026-07-02T23:30:00Z'), [4,5], new Date('2026-07-05T00:00:00Z'));
// Parent 30005: days 2,3,4, start 2026-07-07T23:30Z, end 2026-08-13T00:00Z
const p30005 = expandFixed(new Date('2026-07-07T23:30:00Z'), [2,3,4], new Date('2026-08-13T00:00:00Z'));
// Parent 30006: days 1,2,3, start 2026-08-17T13:00Z, end 2026-08-21T00:00Z
const p30006 = expandFixed(new Date('2026-08-17T13:00:00Z'), [1,2,3], new Date('2026-08-21T00:00:00Z'));

console.log('P1 (Jun 2-19, T/W/Th):', p1.length, p1);
console.log('P30003 (Jun 22-25, M/T):', p30003.length, p30003);
console.log('P30004 (Jul 2-5, Th/F):', p30004.length, p30004);
console.log('P30005 (Jul 7-Aug 13, T/W/Th):', p30005.length, p30005);
console.log('P30006 (Aug 17-21, M/T/W):', p30006.length, p30006);
const total = p1.length + p30003.length + p30004.length + p30005.length + p30006.length;
console.log('Total children:', total, '+ 5 parents =', total + 5, 'total sessions');
