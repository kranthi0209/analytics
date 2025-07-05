fetch('officerDataIPS.json')
  .then(response => response.json())
  .then(officerData => {
    const groupedData = {};
    const categories = new Set();

    officerData.forEach(entry => {
      const name = entry["NameoftheOfficer"].trim();
      if (!groupedData[name]) {
        groupedData[name] = { meta: entry, services: [] };
      }
      groupedData[name].services.push(entry);
      categories.add(entry.Category);
    });

    const allCategories = Array.from(categories).sort();

    const officerEntries = Object.entries(groupedData).sort((a, b) => {
      return parseInt(a[1].meta.SeniorityNo) - parseInt(b[1].meta.SeniorityNo);
    });

    const categoryColorClassMap = {};
    allCategories.forEach((cat, index) => {
      categoryColorClassMap[cat] = `bar-color-${index % 10}`;
    });

    function getColorFromClass(className) {
      const dummy = document.createElement('div');
      dummy.style.display = 'none';
      dummy.className = className;
      document.body.appendChild(dummy);
      const color = getComputedStyle(dummy).backgroundColor;
      document.body.removeChild(dummy);
      return color;
    }

    const legendContainer = document.getElementById("legend");
    allCategories.forEach(cat => {
      const color = getColorFromClass(categoryColorClassMap[cat]);
      const item = document.createElement("div");
      item.className = "legend-item";
      item.innerHTML = `<span class="legend-box" style="background-color: ${color};"></span>${cat}`;
      legendContainer.appendChild(item);
    });

    const chartGrid = document.getElementById("chartGrid");

    officerEntries.forEach(([name, { meta, services }]) => {
      const categoryYearMap = {};
      allCategories.forEach(cat => categoryYearMap[cat] = 0);

      services.forEach(entry => {
        const category = entry.Category;
        const years = parseFloat(entry.Years) || 0;
        categoryYearMap[category] += years;
      });

      const chartContainer = document.createElement("div");
      chartContainer.className = "chart-container";

      const title = document.createElement("div");
      title.className = "chart-title";
      title.textContent = `${meta.SeniorityNo}. ${name}`;

      const canvas = document.createElement("canvas");

      chartContainer.appendChild(title);
      chartContainer.appendChild(canvas);
      chartGrid.appendChild(chartContainer);

      const backgroundColors = allCategories.map(cat =>
        getColorFromClass(categoryColorClassMap[cat])
      );

      new Chart(canvas.getContext("2d"), {
        type: 'bar',
        data: {
          labels: allCategories,
          datasets: [{
            label: 'Years',
            data: allCategories.map(cat => categoryYearMap[cat]),
            backgroundColor: backgroundColors
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
              padding: { top: 4 },
              font: {
                weight: 'bold',
                size: 11
              },
              formatter: value => value.toFixed(2)
            }
          },
          scales: {
            x: {
              display: false // ❌ Hide category names under bars
            },
            y: {
              beginAtZero: true,
              title: { display: false, text: 'Years' }
            }
          }
        },
        plugins: [ChartDataLabels]
      });
    });
  })
  .catch(error => console.error('Error loading officer data:', error));

  lucide.createIcons();