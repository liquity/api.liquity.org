(function () {
  const tableId = "table-leaderboard";
  const numParticipantsId = "leaderboard-value";
  const apiUrl = "https://api.liquity.org/v2/website/leaderboard.json";
  const updateIntervalMs = 60_000;

  const columns = {
    rank: d => [String(d.rank)],
    address: d => [squeeze(d.address)],
    points: d => [points(d.points)],
    total: d => [percent(d.percent)]
  };

  const numberFormatPoints = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2
  });

  const numberFormatPercent = new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 2
  });

  function squeeze(address) {
    const span = document.createElement("span");
    span.title = address;
    span.append(address.slice(0, 6) + "…" + address.slice(-4));
    return span;
  }

  function points(value) {
    return numberFormatPoints.format(value);
  }

  function percent(value) {
    return numberFormatPercent.format(value);
  }

  document.addEventListener("DOMContentLoaded", function () {
    const table = document.getElementById(tableId);
    if (!table) return;

    const header = table.children[0].cloneNode(true);
    const rowTemplate = table.children[1].cloneNode(true);
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
          row.children[i].replaceChildren(...columns[columnName](rowData));
        }

        newChildren.push(row);
      }

      table.replaceChildren(...newChildren);

      const numParticipants = document.getElementById(numParticipantsId);
      numParticipants.replaceChildren(String(data.total_row_count));
    }

    populateTable();
    setInterval(populateTable, updateIntervalMs);
  });
})();
