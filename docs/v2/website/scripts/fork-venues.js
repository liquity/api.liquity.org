(function () {
  const tableId = "table-fork-venues";
  const apiUrl = "https://api.liquity.org/v2/website/fork-venues.json";
  const updateIntervalMs = 60_000;

  const columns = {
    fork: d => [d.fork],
    asset: d => [d.link ? link(d.link, d.asset) : d.asset],
    protocol: d => [d.protocol],
    chain: d => [d.chain],
    "total-apr": d => [typeof d.total_apr === "string" ? d.total_apr : "-"],
    tvl: d => [typeof d.tvl === "number" ? usd(d.tvl) : "-"]
  };

  const numberFormatUsd = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact"
  });

  function link(href, children) {
    const a = document.createElement("a");
    a.href = href;
    a.append(children);
    return a;
  }

  function usd(value) {
    return numberFormatUsd.format(value);
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

      for (const rowData of data) {
        const row = rowTemplate.cloneNode(true);

        for (const [i, columnName] of substitutions) {
          row.children[i].replaceChildren(...columns[columnName](rowData));
        }

        newChildren.push(row);
      }

      table.replaceChildren(...newChildren);
    }

    populateTable();
    setInterval(populateTable, updateIntervalMs);
  });
})();
