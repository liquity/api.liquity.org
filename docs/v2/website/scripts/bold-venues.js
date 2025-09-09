(function () {
  const tableId = "table-BOLD_Venues";
  const apiUrl = "https://api.liquity.org/v2/website/bold-venues.json";
  const linkIcon =
    "https://cdn.prod.website-files.com/5fd883457ba5da4c3822b02c/671bb202be9edeb45787c0f6_right.svg";
  const updateIntervalMs = 60_000;

  const columns = {
    venue: d => [d.protocol],
    asset: d => [d.link ? link(d.link, d.asset) : d.asset],
    apr: d => [typeof d.weekly_apr === "number" ? percent(d.weekly_apr) : "-"],
    "base-apr": d => [typeof d.total_apr === "string" ? d.total_apr : "-"],
    tvl: d => [typeof d.tvl === "number" ? usd(d.tvl) : "-"]
  };

  const numberFormatUsd = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact"
  });

  const numberFormatPercent = new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 2
  });

  function link(href, ...children) {
    const a = document.createElement("a");
    a.href = href;
    a.target = "_blank";

    const img = document.createElement("img");
    img.src = linkIcon;

    a.append(...children, img);
    return a;
  }

  function usd(value) {
    return numberFormatUsd.format(value);
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
