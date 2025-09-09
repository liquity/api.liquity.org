(function () {
  const tableId = "table-borrow-rates";
  const apiUrl = "https://api.liquity.org/v2/website/borrow-rates.json";
  const updateIntervalMs = 60_000;

  const columns = {
    asset: d => [d.collateral],
    "liquity-avg": d => [percent(d.liquity_avg_borrow_rate)],
    "defi-avg": d => [percent(d.defi_avg_borrow_rate)]
  };

  const numberFormatPercent = new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 2
  });

  function percent(value) {
    return numberFormatPercent.format(value);
  }

  document.addEventListener("DOMContentLoaded", function () {
    const table = document.getElementById(tableId);
    if (!table) return;

    const rowContainer = table.children[1];
    const rowTemplate = rowContainer.children[0].cloneNode(true);
    const columnNames = Object.keys(columns);
    const substitutions = [];

    for (const [i, column] of [...rowTemplate.children].entries()) {
      for (const className of column.classList) {
        if (columnNames.includes(className)) {
          substitutions.push([i, className]);
        }
      }
    }

    async function populateTable() {
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error("Failed to fetch " + apiUrl);

      const data = await response.json();
      const newChildren = [header.cloneNode(true)];

      for (const rowData of data.rows) {
        const row = rowTemplate.cloneNode(true);

        for (const [i, columnName] of substitutions) {
          row.children[i].children[0].replaceChildren(...columns[columnName](rowData));
        }

        newChildren.push(row);
      }

      rowContainer.replaceChildren(...newChildren);
    }

    populateTable();
    setInterval(populateTable, updateIntervalMs);
  });
})();
