function escapeHtml(text) {
  return text.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[m]));
}

function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

let groupedData = {};
let currentGroupedData = {};
let allCategories = [];
let categoryColorClassMap = {};
let cachedColors = {};
let isDropdownVisible = false;

const customHCMOrder = [
  "Nedurumalli Janardhana Reddy", "Kotla Vijaya Bhaskara Reddy",
  "Nandamuri Taraka Rama Rao-3.0", "Nara Chandrababu Naidu-1.0",
  "Nara Chandrababu Naidu-2.0", "Yeduguri Sandinti Rajasekhara Reddy-1.0",
  "Yeduguri Sandinti Rajasekhara Reddy-2.0", "Konijeti Rosaiah",
  "Nallari Kiran Kumar Reddy", "Presidents Rule (Narasimhan)",
  "Nara Chandrababu Naidu-3.0", "Yeduguri Sandinti Jagan Mohan Reddy",
  "Nara Chandrababu Naidu-4.0"
];

fetch('officerDataIFS.json')
  .then(response => response.json())
  .then(officerData => {
    groupedData = {};
    const categories = new Set();
    const hcmSet = new Set();

    officerData.forEach(entry => {
      const name = entry["NameoftheOfficer"].trim();
      const hcm = entry.HCM?.trim();
      if (!groupedData[name]) {
        groupedData[name] = { meta: entry, services: [] };
      }
      groupedData[name].services.push(entry);
      categories.add(entry.Category);
      if (hcm) hcmSet.add(hcm);
    });

    for (const [name, group] of Object.entries(groupedData)) {
      const min = group.services.reduce((a, b) => parseInt(a.SeniorityNo) < parseInt(b.SeniorityNo) ? a : b);
      group.meta = min;
    }

    allCategories = Array.from(categories).sort();

    categoryColorClassMap = {};
    allCategories.forEach((cat, i) => {
      categoryColorClassMap[cat] = `bar-color-${i % 10}`;
    });

    cachedColors = getAllCategoryColors();
    currentGroupedData = structuredClone(groupedData);
    populateHCMCheckboxes(Array.from(hcmSet).sort());
    renderLegend();
    renderCharts(currentGroupedData);
  })
  .catch(error => console.error('Error loading officer data:', error));

function getAllCategoryColors() {
  const dummy = document.createElement('div');
  dummy.style.display = 'none';
  document.body.appendChild(dummy);

  const colorMap = {};
  allCategories.forEach(cat => {
    dummy.className = categoryColorClassMap[cat];
    colorMap[cat] = getComputedStyle(dummy).backgroundColor;
  });

  document.body.removeChild(dummy);
  return colorMap;
}

function renderLegend() {
  const legendContainer = document.getElementById("legend");
  legendContainer.innerHTML = '';
  allCategories.forEach(cat => {
    const color = cachedColors[cat];
    const item = document.createElement("div");
    item.className = "legend-item";
    item.innerHTML = `<span class="legend-box" style="background-color: ${color};"></span>${cat}`;
    legendContainer.appendChild(item);
  });
}

function renderCharts(dataToUse) {
  const chartGrid = document.getElementById("chartGrid");
  chartGrid.innerHTML = "";

  const officerEntries = Object.entries(dataToUse)
    .filter(([_, { services }]) => services.length > 0)
    .sort((a, b) => {
      const sa = parseInt(a[1].meta.SeniorityNo) || 9999;
      const sb = parseInt(b[1].meta.SeniorityNo) || 9999;
      return sa - sb;
    });

  officerEntries.forEach(([name, { meta, services }]) => {
    const categoryYearMap = Object.fromEntries(allCategories.map(cat => [cat, 0]));
    services.forEach(entry => {
      const cat = entry.Category;
      const years = parseFloat(entry.Years) || 0;
      categoryYearMap[cat] += years;
    });

    const chartContainer = document.createElement("div");
    chartContainer.className = "chart-container";

    const title = document.createElement("div");
    title.className = "chart-title";
    title.innerHTML = `<a href="#" class="officer-link" data-officer="${escapeHtml(name)}">${meta.SeniorityNo}. ${escapeHtml(name)}</a>`;

    const canvas = document.createElement("canvas");
    chartContainer.appendChild(title);
    chartContainer.appendChild(canvas);
    chartGrid.appendChild(chartContainer);

    new Chart(canvas.getContext("2d"), {
      type: 'bar',
      data: {
        labels: allCategories,
        datasets: [{
          label: 'Years',
          data: allCategories.map(cat => categoryYearMap[cat]),
          backgroundColor: allCategories.map(cat => cachedColors[cat])
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${ctx.raw.toFixed(2)} years`
            }
          },
          datalabels: {
            color: 'black',
            anchor: 'end',
            align: 'top',
            font: { weight: 'bold', size: 11 },
            formatter: value => value.toFixed(2)
          }
        },
        scales: {
          x: { display: false },
          y: { beginAtZero: true }
        }
      },
      plugins: [ChartDataLabels]
    });
  });
}

function populateHCMCheckboxes(hcmList) {
  const container = document.getElementById('hcmDropdown');
  const hcmSet = new Set(hcmList);
  const sortedHCMs = [
    ...customHCMOrder.filter(h => hcmSet.has(h)),
    ...[...hcmSet].filter(h => !customHCMOrder.includes(h)).sort()
  ];

  const html = [`<div style="text-align:center; margin-bottom:10px;">
    <button id="selectAllBtn" style="margin-right:10px; padding:4px 10px; border-radius:6px; background:#10b981; color:white; border:none; cursor:pointer;">Select All</button>
    <button id="deselectAllBtn" style="padding:4px 10px; border-radius:6px; background:#ef4444; color:white; border:none; cursor:pointer;">Deselect All</button>
  </div>`];

  sortedHCMs.forEach(hcm => {
    const id = `hcm_${hcm.replace(/\W+/g, '_')}`;
    html.push(`<div class="hcm-item">
      <input type="checkbox" id="${id}" value="${hcm}" />
      <label for="${id}">${hcm}</label>
    </div>`);
  });

  container.innerHTML = html.join('');
  container.querySelectorAll('input[type="checkbox"]').forEach(cb =>
    cb.addEventListener('change', debounce(handleHCMCheckboxChange, 50))
  );

  document.getElementById('selectAllBtn').onclick = () => {
    document.querySelectorAll('#hcmDropdown input[type="checkbox"]').forEach(cb => cb.checked = true);
    handleHCMCheckboxChange();
  };
  document.getElementById('deselectAllBtn').onclick = () => {
    document.querySelectorAll('#hcmDropdown input[type="checkbox"]').forEach(cb => cb.checked = false);
    handleHCMCheckboxChange();
  };

  document.getElementById('hcmFilterBtn').addEventListener('click', (e) => {
    isDropdownVisible = !isDropdownVisible;
    document.getElementById('hcmDropdown').style.display = isDropdownVisible ? 'block' : 'none';
    e.stopPropagation();
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#hcmDropdown') && !e.target.closest('#hcmFilterBtn')) {
      document.getElementById('hcmDropdown').style.display = 'none';
      isDropdownVisible = false;
    }
  });

  lucide.createIcons();
}

function handleHCMCheckboxChange() {
  const selectedHCMs = Array.from(document.querySelectorAll('#hcmDropdown input:checked'))
    .map(cb => cb.value.trim());

  if (selectedHCMs.length === 0) {
    currentGroupedData = structuredClone(groupedData);
  } else {
    currentGroupedData = {};
    for (const [name, { services }] of Object.entries(groupedData)) {
      const filtered = services.filter(s => selectedHCMs.includes(s.HCM?.trim()));
      if (filtered.length) {
        const meta = filtered.reduce((a, b) => parseInt(a.SeniorityNo) < parseInt(b.SeniorityNo) ? a : b);
        currentGroupedData[name] = { meta, services: filtered };
      }
    }
  }

  renderCharts(currentGroupedData);
}

document.addEventListener("click", function (e) {
  const link = e.target.closest(".officer-link");
  if (link) {
    e.preventDefault();
    const officerName = link.getAttribute("data-officer");
    const officerData = groupedData[officerName]?.meta;
    if (officerData) showOfficer(officerData);
  }
});

function showOfficer(data) {
  const name = data.NameoftheOfficer.trim();
  const services = currentGroupedData[name]?.services || [];
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

  let html = `<h2 style="text-align:center; margin-top:0; color:#1d3557;">Officer Details</h2>
    <div style="display: flex; gap: 20px;">
      <table class="popupa-table" style="flex: 1;">
        ${entries.slice(0, half).map(([k, v]) => `<tr><th>${fieldLabels[k] || k}</th><td>${escapeHtml(v.toString())}</td></tr>`).join('')}
      </table>
      <table class="popupa-table" style="flex: 1;">
        ${entries.slice(half).map(([k, v]) => `<tr><th>${fieldLabels[k] || k}</th><td>${escapeHtml(v.toString())}</td></tr>`).join('')}
      </table>
    </div>`;

  const sortedServices = services.slice().sort((a, b) => new Date(b.From) - new Date(a.From));
  html += `<h2 style="text-align:center; margin-top:20px; color:#1d3557;">Service History</h2>
    <table class="popupc-table" style="width:100%; margin-top: 10px;">
      <thead><tr>
        <th>Post Name</th><th>Department</th><th>Category</th>
        <th>From</th><th>To</th><th>Years</th><th>HCM</th>
      </tr></thead>
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
          </tr>`).join('')}
      </tbody>
    </table>`;

  document.getElementById('officer-details').innerHTML = html;
  document.getElementById('officer-popupa').style.display = 'block';
}
