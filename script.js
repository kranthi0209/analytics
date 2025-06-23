let groupedData = {};
let departments = new Set();
let categories = new Set();
const sortState = { column: '', direction: 'asc' };

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, m => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":"&#039;"
  }[m]));
}

const categoryOrder = [
  "Agriculture & Allied", "Energy, Infra & Industries", "Finance",
  "IT & other Tech", "Local Bodies Administration", "Regulatory",
  "Welfare & Development", "Personal Office", "District Administration"
];

const customDepartmentOrder = {
  "Agriculture & Allied": ["Agriculture", "AH,Fisheries etc", "Horticulture"],
  "Energy, Infra & Industries": ["Energy", "Industries & Infrastructure", "Handloom & Textiles", "Water Resource", "Roads & Buildings", "Tourism"],
  "Finance": ["Finance", "Commercial Tax"],
  "IT & other Tech": ["APSFL", "APTS", "e-Seva", "IT & Electronics", "RTGS"],
  "Local Bodies Administration": ["MAUD", "CRDA & AMRDA", "Municipal Commissioner", "PR & RD", "CEO, ZP", "GSWS"],
  "Regulatory": ["Planning", "GAD", "Revenue (Lands)", "Endowment", "TTD", "Prohibition & Excise", "Stamps & Registration", "Disaster Management", "Mines & Geology", "CoE & APVC", "EFST", "Election Commision", "Labour", "Transport"],
  "Welfare & Development": ["Welfare", "Education", "Health", "Skill Development", "Food & Civil Supplies", "Housing", "Youth, Sports & Culture"],
  "Personal Office": ["Governors Office", "Prime Ministers Office", "Chief Ministers Office"],
  "District Administration": ["Assistant Collector (Trainee)", "District Collector", "Joint Collector", "Other Dist Posts", "PO ITDA", "Sub Collector"]
};

fetch('officerData.json')
  .then(response => response.json())
  .then(officerData => {
    officerData.forEach(entry => {
      const name = entry["NameoftheOfficer"].trim();
      if (!groupedData[name]) groupedData[name] = { meta: entry, services: [] };
      groupedData[name].services.push(entry);
      departments.add(entry.Department);
      categories.add(entry.Category);
    });
    renderTable(officerData);
  })
  .catch(error => console.error('Error loading officer data:', error));

function renderTable(officerData) {
  const departmentsList = Array.from(departments);
  const categoriesList = categoryOrder.filter(cat => categories.has(cat));
  const headerRow1 = ['<th rowspan="2" class="sticky-col" onclick="sortBySeniority()">S.No</th>', '<th rowspan="2" class="sticky-col-2" onclick="sortByName()">Name of the Officer</th>'];
  const headerRow2 = [];
  const categoryDeptMap = {};

  categoriesList.forEach(cat => {
    const uniqueDepts = [...new Set(officerData.filter(o => o.Category === cat).map(o => o.Department))];
    const customOrder = customDepartmentOrder[cat] || [];
    const depts = customOrder.filter(d => uniqueDepts.includes(d)).concat(uniqueDepts.filter(d => !customOrder.includes(d)).sort());
    categoryDeptMap[cat] = depts;
    headerRow1.push(`<th colspan="${depts.length + 1}" class="category-header" data-category="${cat}">${cat}</th>`);
    depts.forEach(dept => {
      headerRow2.push(`<th data-department-category="${cat}">${dept}</th>`);
    });
    headerRow2.push(`<th data-department-category="${cat}" data-type="total">Total</th>`);
  });

  document.getElementById('table-header').innerHTML = `<tr>${headerRow1.join('')}</tr><tr>${headerRow2.join('')}</tr>`;
  renderBody(Object.entries(groupedData), categoriesList, categoryDeptMap);
}

function renderBody(entries, categoriesList, categoryDeptMap) {
  let tbodyHTML = '';
  entries.forEach(([name, { meta, services }]) => {
    const colorClass = `cadre-${meta.Cadre.replace(/\s/g, '-')}`;
    tbodyHTML += `<tr class="${colorClass}">`;
    tbodyHTML += `<td class="sticky-col">${meta["SeniorityNo"]}</td>`;
    tbodyHTML += `<td class="sticky-col-2"><a href="#" onclick='event.preventDefault(); showOfficer(${JSON.stringify(meta)})'>${escapeHtml(name)}</a></td>`;

    categoriesList.forEach(cat => {
      let categoryTotal = 0;
      categoryDeptMap[cat].forEach(dept => {
        const filtered = services.filter(s => s.Category === cat && s.Department === dept);
        const totalYears = filtered.reduce((sum, s) => sum + (parseFloat(s.Years) || 0), 0);
        const detailRows = filtered.map(s =>
          `<tr><td>${escapeHtml(s.PostName)}</td><td>${s.From}</td><td>${s.To}</td><td>${s.Years}</td></tr>`).join('');
        categoryTotal += totalYears;
        tbodyHTML += `<td data-department-category="${cat}">${totalYears ? `<a href="#" onclick='event.preventDefault(); showService("${escapeHtml(name)}", \`${detailRows}\`)'>${totalYears.toFixed(2)}</a>` : ''}</td>`;
      });
      const filteredServices = services.filter(s => s.Category === cat);
      tbodyHTML += `<td class="category-total" data-name="${escapeHtml(name)}" data-category="${cat}" data-total="${categoryTotal.toFixed(2)}" data-rows="${encodeURIComponent(JSON.stringify(filteredServices))}">${categoryTotal.toFixed(2)}</td>`;
    });

    tbodyHTML += '</tr>';
  });
  document.getElementById('table-body').innerHTML = tbodyHTML;
}

function sortAndRender(keyFn, columnId) {
  const arr = Object.entries(groupedData);
  if (sortState.column === columnId) {
    sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
  } else {
    sortState.column = columnId;
    sortState.direction = 'asc';
  }
  arr.sort(([, a], [, b]) => {
    const aKey = keyFn(a.meta);
    const bKey = keyFn(b.meta);
    return sortState.direction === 'asc' ? (aKey > bKey ? 1 : -1) : (aKey < bKey ? 1 : -1);
  });
  renderBody(arr, categoryOrder.filter(cat => categories.has(cat)), getOrderedDeptMap());
}

function sortBySeniority() {
  sortAndRender(m => +m.SeniorityNo, 'seniority');
}

function sortByName() {
  sortAndRender(m => m.NameoftheOfficer.trim().toLowerCase(), 'name');
}

function sortByDepartment(category, department) {
  const arr = Object.entries(groupedData);
  const columnId = `${category}_${department}`;
  sortState.direction = sortState.column === columnId && sortState.direction === 'asc' ? 'desc' : 'asc';
  sortState.column = columnId;

  arr.sort(([, a], [, b]) => {
    const aTotal = a.services.filter(s => s.Category === category && s.Department === department).reduce((sum, s) => sum + (+s.Years || 0), 0);
    const bTotal = b.services.filter(s => s.Category === category && s.Department === department).reduce((sum, s) => sum + (+s.Years || 0), 0);
    return sortState.direction === 'asc' ? aTotal - bTotal : bTotal - aTotal;
  });
  renderBody(arr, categoryOrder.filter(cat => categories.has(cat)), getOrderedDeptMap());
}

function getOrderedDeptMap() {
  const map = {};
  categoryOrder.forEach(cat => {
    if (!categories.has(cat)) return;
    const deptsInCat = [...new Set(Object.values(groupedData).flatMap(entry =>
      entry.services.filter(s => s.Category === cat).map(s => s.Department)
    ))];
    const customOrder = customDepartmentOrder[cat] || [];
    map[cat] = customOrder.filter(d => deptsInCat.includes(d)).concat(deptsInCat.filter(d => !customOrder.includes(d)).sort());
  });
  return map;
}

function showOfficer(data) {
  const fieldLabels = {
    "Cadre": "Cadre", "NameoftheOfficer": "Name of the Officer", "IdentityNo": "Identity No",
    "currentposting": "Current Posting", "DateofAppointment": "Date of Appointment",
    "SourceOfRecruitment": "Source of Recruitment", "EducationalQualification": "Educational Qualification",
    "DateOfBirth": "Date of Birth", "AllotmentYear": "Allotment Year", "Domicile": "Domicile",
    "EmailId": "Email", "PhoneNo": "Phone Number"
  };
  const excludeKeys = ["From", "To", "Years", "PostName", "Department", "Category", "SLNO", "SeniorityNo"];
  let html = '<table class="popupa-table">';
  for (const [key, value] of Object.entries(data)) {
    if (excludeKeys.includes(key)) continue;
    const label = fieldLabels[key] || key;
    const highlight = key.toLowerCase().includes("education") ? 'style="color:red;font-weight:bold;"' : '';
    html += `<tr><th>${label}</th><td ${highlight}>${escapeHtml(value.toString())}</td></tr>`;
  }
  html += '</table>';
  $('#officer-details').html(html).parent().show();
}

function showService(name, rows) {
  $('#service-details').html(
    `<h3>${name}</h3>
    <table class="popupb-table">
      <thead><tr><th>Post Name</th><th>From</th><th>To</th><th>Years</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`
  );
  $('#service-popupb').show();
}

function showTotalPopupb(name, category, total, encodedRows) {
  try {
    const services = JSON.parse(decodeURIComponent(encodedRows));
    const rowsHtml = services.map(row =>
      `<tr><td>${escapeHtml(row.PostName)}</td><td>${row.From}</td><td>${row.To}</td><td>${row.Years}</td></tr>`
    ).join('');
    $('#service-details').html(
      `<h3>${name} - ${category} Total: ${total}</h3>
      <table class="popupb-table">
        <thead><tr><th>Post Name</th><th>From</th><th>To</th><th>Years</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>`
    );
    $('#service-popupb').show();
  } catch (err) {
    console.error('Popup data decode/render error:', err);
  }
}

document.addEventListener("click", function (e) {
  const deptTh = e.target.closest("th[data-department-category]");
  if (deptTh && !deptTh.classList.contains("category-header")) {
    const department = deptTh.textContent.trim();
    const category = deptTh.dataset.departmentCategory;
    sortByDepartment(category, department);
  }
  const target = e.target.closest(".category-total");
  if (target) {
    const data = target.dataset;
    showTotalPopupb(data.name, data.category, data.total, data.rows);
  }
});
