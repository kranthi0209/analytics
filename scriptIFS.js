let groupedData = {};
let currentGroupedData = {}; // ✅ Required for filtered views
let departments = new Set();
let categories = new Set();
let allOfficerData = [];
const sortState = { column: '', direction: 'asc' };
let selectedHCMs = new Set();

const categoryOrder = [
 "TRADITIONAL FOREST SERVICE","FOREST & PLANTS DEVELOPMENT SERVICE","ANIMAL PROTECTION AND CARE SERVICES","RESEARCH & TECHNICAL","ELITE INSTITUTIONS","NON FOREST DEPTS"
];

const customDepartmentOrder = {
"TRADITIONAL FOREST SERVICE":["TERRITORIAL","PLANNING","VIGILLANCE","OTHER ADMINISTRATIVE ROLES"],
"FOREST & PLANTS DEVELOPMENT SERVICE":["FOREST DEVELOPMENT CORPORATION","SILVICULTURE","SOCIAL FORESTRY","PRODUCTION","RED SANDERS"],
"ANIMAL PROTECTION AND CARE SERVICES":["PROJECT TIGER","WILD LIFE","ZOO PARKS"],
"RESEARCH & TECHNICAL":["GIS & OTHER TECHNICAL","RESEARCH"],
"ELITE INSTITUTIONS":["FOREST SURVEY OF INDIA","ICFRE"],
"NON FOREST DEPTS":["AGRICULTURE DEPT","EDUCATION","ENERGY","FINANCE","GSWS","HEALTH","HOUSING","INDUSTRIES","IT & ELECTRONICS","MAUD","PLANNING DEPT","PR & RD","SOCIAL WELFARE","TOURISM","TTD"]



};

fetch('officerDataIFS.json')
  .then(res => res.json())
  .then(data => {
    allOfficerData = data;
    const hcmSet = new Set();
    data.forEach(entry => { if (entry.HCM?.trim()) hcmSet.add(entry.HCM.trim()); });
    populateHCMCheckboxes([...hcmSet]);
    updateGroupedData(data);
  });

function updateGroupedData(data) {
  groupedData = {};
  departments.clear();
  categories.clear();
  data.forEach(entry => {
    const name = entry.NameoftheOfficer.trim();
    if (!groupedData[name]) groupedData[name] = { meta: entry, services: [] };
    groupedData[name].services.push(entry);
    departments.add(entry.Department);
    categories.add(entry.Category);
  });
  currentGroupedData = { ...groupedData }; // ✅ cache original
  renderTable(Object.values(currentGroupedData).flatMap(e => e.services));
}


function renderTable() {
  const categoriesList = categoryOrder.filter(cat => categories.has(cat));
  const headerRow1 = [
    '<th rowspan="2" class="sticky-col" onclick="sortBySeniority()">S.No</th>',
    '<th rowspan="2" class="sticky-col-2" onclick="sortByName()">Name of the Officer</th>'
  ];
  const headerRow2 = [];

  // ✅ Always use full groupedData to preserve full column layout
  const categoryDeptMap = getOrderedDeptMap(Object.entries(groupedData));

  categoriesList.forEach(cat => {
    const depts = categoryDeptMap[cat] || [];
    headerRow1.push(`<th colspan="${depts.length + 1}" class="category-header" data-category="${cat}">${cat}</th>`);
    depts.forEach(dept => {
      headerRow2.push(`<th data-department-category="${cat}">${dept}</th>`);
    });
    headerRow2.push(`<th class="clickable category-total-header" data-category="${cat}" onclick="sortByCategoryTotal('${cat}')">Total</th>`);
  });

  document.getElementById('table-header').innerHTML = `
    <tr>${headerRow1.join('')}</tr>
    <tr>${headerRow2.join('')}</tr>
  `;

  // ✅ Use currentGroupedData for body (filtered or full)
  renderBody(Object.entries(currentGroupedData), categoriesList, categoryDeptMap);
}

function sortByCategoryTotal(category) {
  const arr = Object.entries(currentGroupedData);
  const columnId = `categoryTotal_${category}`;
  sortState.direction = sortState.column === columnId && sortState.direction === 'asc' ? 'desc' : 'asc';
  sortState.column = columnId;

  arr.sort(([, a], [, b]) => {
    const aTotal = a.services.filter(s => s.Category === category).reduce((sum, s) => sum + (+s.Years || 0), 0);
    const bTotal = b.services.filter(s => s.Category === category).reduce((sum, s) => sum + (+s.Years || 0), 0);
    return sortState.direction === 'asc' ? aTotal - bTotal : bTotal - aTotal;
  });

  // ✅ Always use full column map from unfiltered data
  renderBody(arr, categoryOrder.filter(cat => categories.has(cat)), getOrderedDeptMap(Object.entries(groupedData)));
}



function renderBody(entries, categoriesList, categoryDeptMap) {
  let tbodyHTML = '';
  entries.forEach(([name, { meta, services }]) => {
    const colorClass = `cadre-${meta.Cadre.replace(/\s/g, '-')}`;
    tbodyHTML += `<tr class="${colorClass}">`;
    tbodyHTML += `<td class="sticky-col"><a href="#" onclick='event.preventDefault(); showOfficer(${JSON.stringify(meta)})'>${meta["SeniorityNo"]}</a></td>`;
    tbodyHTML += `<td class="sticky-col-2"><a href="#" onclick='event.preventDefault(); showOfficer(${JSON.stringify(meta)})'>${escapeHtml(name)}</a></td>`;

    categoriesList.forEach(cat => {
      let categoryTotal = 0;
      categoryDeptMap[cat].forEach(dept => {
        const filtered = services.filter(s => s.Category === cat && s.Department === dept);
        const totalYears = filtered.reduce((sum, s) => sum + (parseFloat(s.Years) || 0), 0);
        const sortedFiltered = filtered.slice().sort((a, b) => new Date(b.From) - new Date(a.From));
const detailRows = sortedFiltered.map(s =>
  `<tr><td>${escapeHtml(s.PostName)}</td><td>${s.From}</td><td>${s.To}</td><td>${s.Years}</td><td>${escapeHtml(s.HCM || "")}</td></tr>`
).join('');

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
  const arr = Object.entries(currentGroupedData);
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
  renderBody(arr, categoryOrder.filter(cat => categories.has(cat)), getOrderedDeptMap(arr));
}

function sortBySeniority() { sortAndRender(m => +m.SeniorityNo, 'seniority'); }
function sortByName() { sortAndRender(m => m.NameoftheOfficer.trim().toLowerCase(), 'name'); }
function sortByDepartment(category, department) {
  const arr = Object.entries(currentGroupedData);
  const columnId = `${category}_${department}`;
  sortState.direction = sortState.column === columnId && sortState.direction === 'asc' ? 'desc' : 'asc';
  sortState.column = columnId;

  arr.sort(([, a], [, b]) => {
    const aTotal = a.services.filter(s => s.Category === category && s.Department === department).reduce((sum, s) => sum + (+s.Years || 0), 0);
    const bTotal = b.services.filter(s => s.Category === category && s.Department === department).reduce((sum, s) => sum + (+s.Years || 0), 0);
    return sortState.direction === 'asc' ? aTotal - bTotal : bTotal - aTotal;
  });

  // ✅ Always use full column map from unfiltered data
  renderBody(arr, categoryOrder.filter(cat => categories.has(cat)), getOrderedDeptMap(Object.entries(groupedData)));
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
  const name = data.NameoftheOfficer.trim();
  const services = groupedData[name]?.services || [];

  const fieldLabels = {
    "Cadre": "Cadre", "NameoftheOfficer": "Name of the Officer", "IdentityNo": "Identity No",
    "currentposting": "Current Posting", "DateofAppointment": "Date of Appointment",
    "SourceOfRecruitment": "Source of Recruitment", "EducationalQualification": "Educational Qualification",
    "DateOfBirth": "Date of Birth", "AllotmentYear": "Allotment Year", "Domicile": "Domicile",
    "EmailId": "Email", "PhoneNo": "Phone Number"
  };

  const excludeKeys = ["From", "To", "Years", "PostName", "Department", "Category", "SLNO", "SeniorityNo", "HCM"];
  const entries = Object.entries(data).filter(([k]) => !excludeKeys.includes(k));
  const half = Math.ceil(entries.length / 2);

  let html = `
    <h2 style="text-align:center; margin-top:0; color:#1d3557;">Officer Details</h2>
    <div style="display: flex; gap: 20px;">
      <table class="popupa-table" style="flex: 1;">
        ${entries.slice(0, half).map(([k, v]) => {
          const label = fieldLabels[k] || k;
          const highlight = k.toLowerCase().includes("education") ? 'style="color:red;font-weight:bold;"' : '';
          return `<tr><th>${label}</th><td ${highlight}>${escapeHtml(v.toString())}</td></tr>`;
        }).join('')}
      </table>
      <table class="popupa-table" style="flex: 1;">
        ${entries.slice(half).map(([k, v]) => {
          const label = fieldLabels[k] || k;
          const highlight = k.toLowerCase().includes("education") ? 'style="color:red;font-weight:bold;"' : '';
          return `<tr><th>${label}</th><td ${highlight}>${escapeHtml(v.toString())}</td></tr>`;
        }).join('')}
      </table>
    </div>`;

  const sortedServices = services.slice().sort((a, b) => new Date(b.From) - new Date(a.From));
  html += `
    <h2 style="text-align:center; margin-top:20px; color:#1d3557;">Service History</h2>
    <table class="popupc-table" style="width:100%; margin-top: 10px;">
      <thead>
        <tr>
          <th>Post Name</th>
          <th>Department</th>
          <th>Category</th>
          <th>From</th>
          <th>To</th>
          <th>Years</th>
          <th>HCM</th>
        </tr>
      </thead>
      <tbody>
        ${sortedServices.map(s => `
          <tr>
            <td>${escapeHtml(s.PostName)}</td>
            <td>${escapeHtml(s.Department)}</td>
            <td>${escapeHtml(s.Category)}</td>
            <td>${s.From}</td>
            <td>${s.To}</td>
            <td>${parseFloat(s.Years).toFixed(2)}</td>
            <td>${escapeHtml(s.HCM || '')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  $('#officer-details').html(html);
  $('#officer-popupa').fadeIn();
}

function showService(name, rows) {
  $('#service-details').html(
    `<h3>${name}</h3>
    <table class="popupb-table">
      <thead><tr><th>Post Name</th><th>From</th><th>To</th><th>Years</th><th>HCM</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`
  );
  $('#service-popupb').show();
}

function showTotalPopupb(name, category, total, encodedRows) {
  try {
    const services = JSON.parse(decodeURIComponent(encodedRows));
    const sortedServices = services.slice().sort((a, b) => new Date(b.From) - new Date(a.From));
const rowsHtml = sortedServices.map(row =>
  `<tr><td>${escapeHtml(row.PostName)}</td><td>${row.From}</td><td>${row.To}</td><td>${row.Years}</td><td>${escapeHtml(row.HCM || "")}</td></tr>`
).join('');

    $('#service-details').html(
      `<h3>${name} - ${category} Total: ${total}</h3>
      <table class="popupb-table">
        <thead><tr><th>Post Name</th><th>From</th><th>To</th><th>Years</th><th>HCM</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>`
    );
    $('#service-popupb').show();
  } catch (err) {
    console.error('Popup data decode/render error:', err);
  }
}

function showAllServices(name) {
  const officer = currentGroupedData[name];
  if (!officer) return;
  const services = officer.services;

  let html = `
    <h2 style="text-align:center; color: #2b4a7e; font-size: 22px; margin-bottom: 20px;">
      Service History - ${escapeHtml(name)}
    </h2>
    <table class="popupc-table">
      <thead>
        <tr>
          <th>Post Name</th>
          <th>Department</th>
          <th>Category</th>
          <th>From</th>
          <th>To</th>
          <th>Years</th>
          <th>HCM</th>
        </tr>
      </thead>
      <tbody>`;

  services.forEach(s => {
    html += `
      <tr>
        <td>${escapeHtml(s.PostName)}</td>
        <td>${escapeHtml(s.Department)}</td>
        <td>${escapeHtml(s.Category)}</td>
        <td>${s.From}</td>
        <td>${s.To}</td>
        <td>${parseFloat(s.Years).toFixed(2)}</td>
        <td>${escapeHtml((s.HCM || "").trim())}</td>
      </tr>`;
  });

  html += '</tbody></table>';
  $('#service-details-c').html(html);
  $('#service-popupc').fadeIn();
}

const customHCMOrder = [
  "Nedurumalli Janardhana Reddy",
  "Kotla Vijaya Bhaskara Reddy",
  "Nandamuri Taraka Rama Rao-3.0",
  "Nara Chandrababu Naidu-1.0",
  "Nara Chandrababu Naidu-2.0",
  "Yeduguri Sandinti Rajasekhara Reddy-1.0",
  "Yeduguri Sandinti Rajasekhara Reddy-2.0",
  "Konijeti Rosaiah",
  "Nallari Kiran Kumar Reddy",
  "Presidents Rule (Narasimhan)",
  "Nara Chandrababu Naidu-3.0",
  "Yeduguri Sandinti Jagan Mohan Reddy",
  "Nara Chandrababu Naidu-4.0"
];

function populateHCMCheckboxes(hcmList) {
  const container = document.getElementById('hcmDropdown');
  container.innerHTML = '';

  // Add Select/Deselect buttons
  const buttonGroup = document.createElement('div');
  buttonGroup.innerHTML = `
    <div style="text-align:center; margin-bottom:10px;">
      <button id="selectAllBtn" style="margin-right:10px; padding:4px 10px; border-radius:6px; background:#10b981; color:white; border:none; cursor:pointer;">Select All</button>
      <button id="deselectAllBtn" style="padding:4px 10px; border-radius:6px; background:#ef4444; color:white; border:none; cursor:pointer;">Deselect All</button>
    </div>`;
  container.appendChild(buttonGroup);

  // Reorder HCMs as per custom order
  const hcmSet = new Set(hcmList);
  const sortedHCMs = [
    ...customHCMOrder.filter(h => hcmSet.has(h)),
    ...[...hcmSet].filter(h => !customHCMOrder.includes(h)).sort()
  ];

   // Render checkboxes with image
  sortedHCMs.forEach(hcm => {
    const id = `hcm_${hcm.replace(/\W+/g, '_')}`;
    const div = document.createElement('div');
    div.className = 'hcm-item';
    div.innerHTML = `
      <input type="checkbox" id="${id}" value="${hcm}" />
      <label for="${id}">${hcm}</label>
    `;
    container.appendChild(div);
  });

  // Attach change handler
  container.querySelectorAll('input[type="checkbox"]').forEach(cb =>
    cb.addEventListener('change', handleHCMCheckboxChange)
  );

  // Select/Deselect buttons
  document.getElementById('selectAllBtn').addEventListener('click', () => {
    document.querySelectorAll('#hcmDropdown input[type="checkbox"]').forEach(cb => cb.checked = true);
    handleHCMCheckboxChange();
  });

  document.getElementById('deselectAllBtn').addEventListener('click', () => {
    document.querySelectorAll('#hcmDropdown input[type="checkbox"]').forEach(cb => cb.checked = false);
    handleHCMCheckboxChange();
  });
}
function renderHCMWithImage(hcm) {
  if (!hcm || !hcm.trim()) return '';
  const cleanHCM = hcm.trim();
}
function handleHCMCheckboxChange() {
  const selectedHCMs = Array.from(document.querySelectorAll('#hcmDropdown input:checked'))
    .map(cb => cb.value.trim());
  filterByHCM(selectedHCMs);
}

function filterByHCM(selectedHCMs) {
  if (!selectedHCMs.length) {
    currentGroupedData = { ...groupedData };
  } else {
    const filteredData = Object.values(groupedData).map(entry => ({
      meta: entry.meta,
      services: entry.services.filter(s => selectedHCMs.includes(s.HCM?.trim()))
    })).filter(entry => entry.services.length > 0);

    currentGroupedData = {};
    filteredData.forEach(entry => {
      const name = entry.meta.NameoftheOfficer.trim();
      currentGroupedData[name] = entry;
    });
  }

  // ✅ Render table with full structure using all original department mapping
  renderTable();  // This will use renderBody internally with full column structure
}

// Toggle dropdown visibility
let isDropdownVisible = false;
document.getElementById('hcmFilterBtn').addEventListener('click', (e) => {
  const dropdown = document.getElementById('hcmDropdown');
  isDropdownVisible = !isDropdownVisible;
  dropdown.style.display = isDropdownVisible ? 'block' : 'none';
  e.stopPropagation();
});

// Close dropdown if clicked outside
document.addEventListener('click', function (e) {
  const dropdown = document.getElementById('hcmDropdown');
  if (!e.target.closest('#hcmDropdown') && !e.target.closest('#hcmFilterBtn')) {
    dropdown.style.display = 'none';
    isDropdownVisible = false;
  }

  // Department sorting
  const deptTh = e.target.closest("th[data-department-category]");
  if (deptTh && !deptTh.classList.contains("category-header")) {
    const department = deptTh.textContent.trim();
    const category = deptTh.dataset.departmentCategory;
    sortByDepartment(category, department);
  }

  // Category total click popup
  const target = e.target.closest(".category-total");
  if (target) {
    const data = target.dataset;
    showTotalPopupb(data.name, data.category, data.total, data.rows);
  }
});

function getOrderedDeptMap(entryArray = Object.entries(currentGroupedData)) {
  const map = {};
  categoryOrder.forEach(cat => {
    if (!categories.has(cat)) return;
    const deptsInCat = [...new Set(entryArray.flatMap(([, entry]) => entry.services.filter(s => s.Category === cat).map(s => s.Department)))];
    const customOrder = customDepartmentOrder[cat] || [];
    map[cat] = customOrder.filter(d => deptsInCat.includes(d)).concat(deptsInCat.filter(d => !customOrder.includes(d)).sort());
  });
  return map;
}
function escapeHtml(text) {
  return text.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[m]));
}

lucide.createIcons();
