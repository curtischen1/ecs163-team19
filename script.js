(function () {
    "use strict";

    const zipcodeToggle = document.querySelector("#zipcode-toggle");
    const tractToggle = document.querySelector("#tract-toggle");
    const firestationToggle = document.querySelector("#firestation-toggle");
    const incomeModeBtn = document.querySelector("#income-mode");
    const severityModeBtn = document.querySelector("#severity-mode");
    const mapFrame = document.querySelector("#heatmap-frame");
    const barChartLabel = document.querySelector("#bar-chart-label");
    const months = document.querySelectorAll(".month");

    let currentBoundary = "zipcode";
    let currentMonth = "mar";
    let currentChartMode = "income"; // "income" | "severity"
    let firestationsVisible = false;

    // Region selected by clicking the map (zcta or geoid). Highlights its income
    // bracket on the chart + outlines the region on the map. Null = none.
    let selectedRegionId = null;
    let lastIncomeMap = null; // income Map from the most recent income render

    const barChartYLabel = document.querySelector("#bar-chart-ylabel");
    const barLegend = document.querySelector("#bar-legend");

    // Axis captions + legend depend on the chart mode (and, for income, boundary).
    function updateChartLabel() {
        if (currentChartMode === "severity") {
            barChartLabel.textContent = "Call Severity";
            barChartYLabel.textContent = "EMS Response (min)";
            barLegend.style.display = "none";
        } else {
            barChartLabel.textContent = currentBoundary === "tract"
                ? "Median Income, Census Tract ($k)"
                : "Median Income, Zipcode ($k)";
            barChartYLabel.textContent = "EMS Calls";
            barLegend.style.display = "";
        }
    }

    zipcodeToggle.addEventListener("click", function () {
        currentBoundary = "zipcode";

        zipcodeToggle.classList.add("selected");
        tractToggle.classList.remove("selected");

        clearRegionSelection(); // region ids differ between zip/tract
        updateChartLabel();

        //mapFrame.src = "zip.html";
        //mapFrame.src = "map.html";
        updateMapSrc();

        updateMapSettings();
        renderBarChart(); // re-bin the chart using zip-level income
    });

    tractToggle.addEventListener("click", function () {
        currentBoundary = "tract";

        tractToggle.classList.add("selected");
        zipcodeToggle.classList.remove("selected");

        clearRegionSelection(); // region ids differ between zip/tract
        updateChartLabel();

        //mapFrame.src = "heatmap.html";
        //mapFrame.src = "map.html?boundary=tract";
        updateMapSrc();

        updateMapSettings();
        renderBarChart(); // re-bin the chart using tract-level income
    });

    // Switch the chart to income mode (no re-render; caller renders).
    function switchToIncomeMode() {
        currentChartMode = "income";
        incomeModeBtn.classList.add("selected");
        severityModeBtn.classList.remove("selected");
        updateChartLabel();
    }

    // Income / Severity view switch. Severity is city-wide, so it ignores the
    // zip/tract boundary but still responds to the selected month.
    incomeModeBtn.addEventListener("click", function () {
        switchToIncomeMode();
        renderBarChart();
    });

    severityModeBtn.addEventListener("click", function () {
        currentChartMode = "severity";
        severityModeBtn.classList.add("selected");
        incomeModeBtn.classList.remove("selected");
        updateChartLabel();
        renderBarChart();
    });

    firestationToggle.addEventListener("click", function () {
        firestationsVisible = !firestationsVisible;
        firestationToggle.classList.toggle("on");
        sendFirestationState();
        updateMapSettings();
    });

    /*mapFrame.addEventListener("load", function () {
        sendFirestationState();
    });*/
    window.addEventListener("message", function (event) {
        if (event.data.type === "MAP_READY") {
            sendFirestationState();
            sendRegionHighlight(); // re-apply the outline after a (re)load
        }
        if (event.data.type === "INCIDENT_CLICK") {
            const { date, responseTime, callTypeGroup, stationArea, address, zipcode } = event.data.data;
            document.getElementById("incident-text").style.display = "none";
            document.getElementById("incident-details").style.display = "";
            document.getElementById("incident-date").textContent = date;
            document.getElementById("incident-response-time").textContent = responseTime;
            document.getElementById("incident-call-type-group").textContent = callTypeGroup;
            document.getElementById("incident-station").textContent = stationArea;
            document.getElementById("incident-address").textContent = address;
            document.getElementById("incident-zipcode").textContent = zipcode;
        }
        if (event.data.type === "REGION_CLICK") {
            handleRegionClick(event.data.id, event.data.boundary);
        }
    });

    // A region was clicked on the map: toggle selection, ensure income mode,
    // re-render (which draws the bar highlight), then sync the note + map outline.
    async function handleRegionClick(id, boundary) {
        if (boundary !== currentBoundary) return; // stale message mid-transition
        selectedRegionId = (selectedRegionId === id) ? null : id;

        if (currentChartMode !== "income") switchToIncomeMode();
        await renderBarChart();

        updateRegionNote();
        sendRegionHighlight();
    }

    function clearRegionSelection() {
        selectedRegionId = null;
        updateRegionNote();
    }

    // Tell the map which region to outline (id may be null to clear).
    function sendRegionHighlight() {
        mapFrame.contentWindow.postMessage(
            { type: "SET_REGION_HIGHLIGHT", id: selectedRegionId },
            "*"
        );
    }

    // Small caption under the chart describing the selected region.
    function updateRegionNote() {
        const note = document.getElementById("region-note");
        if (!note) return;
        if (selectedRegionId == null) {
            note.textContent = "";
            return;
        }
        const inc = lastIncomeMap ? lastIncomeMap.get(selectedRegionId) : null;
        note.textContent = inc != null
            ? `${selectedRegionId} · $${Math.round(inc / 1000)}k median`
            : `${selectedRegionId} · no income data`;
    }

    function sendFirestationState() {
        mapFrame.contentWindow.postMessage(
            { type: "SET_FIRESTATIONS", visible: firestationsVisible },
            "*"
        );
    }

    function updateMapSrc() {
        const params = new URLSearchParams();
        params.set("month", currentMonth);
        if (currentBoundary === "tract") params.set("boundary", "tract");
        mapFrame.src = "map.html?" + params.toString();
    }

    const zoomInButton = document.querySelector("#zoom-in");
    const zoomOutButton = document.querySelector("#zoom-out");
    zoomInButton.addEventListener("click", function () {
        mapFrame.contentWindow.postMessage({ type: "ZOOM_IN" }, "*");
    });
    zoomOutButton.addEventListener("click", function () {
        mapFrame.contentWindow.postMessage({ type: "ZOOM_OUT" }, "*");
    });

    months.forEach(function (monthButton) {
        monthButton.addEventListener("click", function () {
            months.forEach(function (button) {
                button.classList.remove("selected-month");
            });

            monthButton.classList.add("selected-month");
            currentMonth = monthButton.dataset.month;

            /*
                skeleton code for later monthly heatmaps
            */

            console.log("Selected month:", currentMonth);
            updateMapSrc();
            updateMapSettings();
            renderBarChart(); // re-draw bars for the chosen month
        });
    });

    function updateMapSettings() {
        /*
            Here stores all the current UI choices

            currentBoundary:
                "zipcode" or "tract"

            currentMonth:
                "jan", "feb", "mar", ...

            firestationsVisible:
                true or false

            Later, can use these values to update:
                heatmap, bar chart, firestation markers, incident report txt
        */

        console.log({
            boundary: currentBoundary,
            month: currentMonth,
            firestations: firestationsVisible
        });


    }

    /* =========================================================================
       Income mode: EMS call volume by income bracket, split by severity
       -------------------------------------------------------------------------
       Reads severity_by_region.json, precomputed per-region call counts:
         { "<month>": { "zip":   { "<zcta>":  {lt, total}, ... },
                        "tract": { "<geoid>": {lt, total}, ... } }, ... }
       where lt = life-threatening calls, total = all calls.
       At runtime we:
         1. Load that file + the income CSV for the current boundary.
         2. Build EVEN income brackets from the data (quantiles), since SF income
            is right-skewed and fixed-width bins pile most regions into one bar.
         3. Pool each region's lt/total into its bracket.
         4. Draw stacked bars: life-threatening vs. other calls.
       The stack height shows volume (poorer areas call more); the highlighted
       segment shows the life-threatening share (higher in poorer areas).
       ========================================================================= */

    const NUM_BRACKETS = 5; // income quantile bins

    // Split regions into NUM_BRACKETS even-sized income bins. Returns the upper
    // edges (length NUM_BRACKETS-1) plus short multi-line labels per bar.
    function incomeBrackets(incomes) {
        const sorted = [...incomes].sort((a, b) => a - b);
        const edges = [];
        for (let i = 1; i < NUM_BRACKETS; i++) {
            const e = sorted[Math.min(Math.floor((i / NUM_BRACKETS) * sorted.length), sorted.length - 1)];
            edges.push(Math.round(e / 5000) * 5000); // round to $5k for clean labels
        }
        const k = (v) => Math.round(v / 1000); // → $k
        const labels = edges.map((e, i) =>
            i === 0
                ? { label: "b0", lines: ["<" + k(e)] }
                : { label: "b" + i, lines: [k(edges[i - 1]) + "–", String(k(e))] }
        );
        labels.push({ label: "b" + edges.length, lines: [k(edges[edges.length - 1]) + "+"] });
        return { edges, labels };
    }

    // Which bracket (0..NUM_BRACKETS-1) an income falls into, given the edges.
    function bracketIndex(income, edges) {
        let b = 0;
        while (b < edges.length && income >= edges[b]) b++;
        return b;
    }

    // Per boundary: which income CSV + which column is the join id.
    const BOUNDARY_CONFIG = {
        zipcode: { csv: "sf_zip_income.csv",   csvKey: "zcta",  dataKey: "zip" },
        tract:   { csv: "sf_tract_income.csv", csvKey: "geoid", dataKey: "tract" }
    };

    // Severity categories (SFFD call_type_group), in a fixed display order.
    // `label` is the unique x-scale key; `lines` is how it wraps under the bar.
    const SEVERITIES = [
        { key: "Potentially Life-Threatening", label: "Life-Threatening", lines: ["Life-", "Threat."] },
        { key: "Fire",                         label: "Fire",             lines: ["Fire"] },
        { key: "Non Life-threatening",         label: "Non Life-threat.", lines: ["Non Life-", "threat."] },
        { key: "Alarm",                        label: "Alarm",            lines: ["Alarm"] }
    ];

    // Caches so toggling/re-selecting doesn't re-load files.
    const incomeCache = {};               // csv file -> Map(id -> income)
    let regionCounts = null;              // parsed severity_by_region.json
    let severityData = null;              // parsed response_by_severity.json

    // Parse the income CSV into Map(joinId -> median income), dropping blanks.
    async function loadIncome(cfg) {
        if (!incomeCache[cfg.csv]) {
            const rows = await d3.csv(cfg.csv);
            const map = new Map();
            for (const r of rows) {
                const income = +r.median_household_income;
                if (r.median_household_income && Number.isFinite(income)) {
                    map.set(r[cfg.csvKey], income);
                }
            }
            incomeCache[cfg.csv] = map;
        }
        return incomeCache[cfg.csv];
    }

    // Load the precomputed per-region call counts once.
    // Shape: { "<month>": { "zip": {id:{lt,total}}, "tract": {id:{lt,total}} } }
    async function loadRegionCounts() {
        if (!regionCounts) {
            regionCounts = await d3.json("severity_by_region.json");
        }
        return regionCounts;
    }

    // Load the precomputed severity file once.
    // Shape: { "<month>": { "<call_type_group>": {avgMin, median, n}, ... }, ... }
    async function loadSeverity() {
        if (!severityData) {
            severityData = await d3.json("response_by_severity.json");
        }
        return severityData;
    }

    // Draw a short message in the SVG instead of bars (e.g. data failed to load).
    function showChartMessage(text) {
        const svg = d3.select("#bar-svg");
        svg.selectAll("*").remove();
        svg.append("text")
            .attr("class", "chart-msg")
            .attr("x", 125)
            .attr("y", 95)
            .attr("text-anchor", "middle")
            .text(text);
    }

    // Dispatch to the chart for the active mode.
    function renderBarChart() {
        return currentChartMode === "severity"
            ? renderSeverityChart()
            : renderIncomeChart();
    }

    async function renderIncomeChart() {
        const cfg = BOUNDARY_CONFIG[currentBoundary];

        try {
            showChartMessage("Loading…");

            const [counts, income] = await Promise.all([
                loadRegionCounts(),
                loadIncome(cfg)
            ]);
            lastIncomeMap = income; // used by the region-click note

            const monthData = counts[currentMonth];
            const regionMap = monthData ? monthData[cfg.dataKey] : null;
            if (!regionMap) {
                showChartMessage("No data for this month.");
                return;
            }

            // Regions that have both income and calls this month.
            const regions = [];
            for (const [id, rec] of Object.entries(regionMap)) {
                const inc = income.get(id);
                if (inc != null && rec.total > 0) regions.push({ inc, rec });
            }
            if (!regions.length) {
                showChartMessage("No data for this month.");
                return;
            }

            // Even (quantile) income bins computed from the regions present.
            const { edges, labels } = incomeBrackets(regions.map((r) => r.inc));

            const totals = labels.map(() => ({ lt: 0, total: 0 }));
            for (const { inc, rec } of regions) {
                const t = totals[bracketIndex(inc, edges)];
                t.lt += rec.lt;
                t.total += rec.total;
            }

            // Stacked: life-threatening vs. everything else.
            const data = labels.map((l, i) => ({
                label: l.label,
                lines: l.lines,
                lt: totals[i].lt,
                other: totals[i].total - totals[i].lt,
                total: totals[i].total
            }));

            // Which bar to outline: the selected region's income bracket.
            let highlightIdx = -1;
            if (selectedRegionId != null) {
                const selInc = income.get(selectedRegionId);
                if (selInc != null) highlightIdx = bracketIndex(selInc, edges);
            }

            drawStackedBars(data, highlightIdx);
        } catch (err) {
            console.error(err);
            showChartMessage("Chart data could not load.");
        }
    }

    // City-wide average EMS response time per call-severity tier for the month.
    async function renderSeverityChart() {
        try {
            showChartMessage("Loading…");

            const severity = await loadSeverity();
            const monthData = severity[currentMonth];
            if (!monthData) {
                showChartMessage("No data for this month.");
                return;
            }

            const data = SEVERITIES.map((s) => {
                const rec = monthData[s.key];
                return {
                    label: s.label,
                    lines: s.lines,
                    minutes: rec ? rec.avgMin : 0,
                    count: rec ? rec.n : 0
                };
            });

            drawBars(data);
        } catch (err) {
            console.error(err);
            showChartMessage("Chart data could not load.");
        }
    }

    // Render the bars + axes into #bar-svg.
    function drawBars(data) {
        const svg = d3.select("#bar-svg");
        svg.selectAll("*").remove();

        const W = 250;
        const H = 190;
        const margin = { top: 8, right: 6, bottom: 34, left: 30 };
        const innerW = W - margin.left - margin.right;
        const innerH = H - margin.top - margin.bottom;

        const g = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        const x = d3.scaleBand()
            .domain(data.map((d) => d.label))
            .range([0, innerW])
            .padding(0.25);

        const y = d3.scaleLinear()
            .domain([0, d3.max(data, (d) => d.minutes) || 1])
            .nice()
            .range([innerH, 0]);

        // Bars
        g.selectAll(".bar")
            .data(data)
            .enter()
            .append("rect")
            .attr("class", "bar")
            .attr("x", (d) => x(d.label))
            .attr("y", (d) => y(d.minutes))
            .attr("width", x.bandwidth())
            .attr("height", (d) => innerH - y(d.minutes));

        // Y axis (a few minute ticks)
        const yTicks = y.ticks(4);
        g.selectAll(".y-tick")
            .data(yTicks)
            .enter()
            .append("text")
            .attr("class", "tick-label")
            .attr("x", -6)
            .attr("y", (d) => y(d) + 3)
            .attr("text-anchor", "end")
            .text((d) => d);

        // X axis labels (income brackets render on one line; severity labels
        // may wrap onto multiple lines via d.lines).
        g.selectAll(".x-tick")
            .data(data)
            .enter()
            .append("text")
            .attr("class", "tick-label")
            .attr("y", innerH + 14)
            .attr("text-anchor", "middle")
            .each(function (d) {
                const cx = x(d.label) + x.bandwidth() / 2;
                const lines = d.lines || [d.label];
                const t = d3.select(this);
                lines.forEach((ln, i) => {
                    t.append("tspan")
                        .attr("x", cx)
                        .attr("dy", i === 0 ? 0 : 10)
                        .text(ln);
                });
            });

        // Axis lines
        g.append("line")
            .attr("class", "axis-line")
            .attr("x1", 0).attr("y1", 0)
            .attr("x2", 0).attr("y2", innerH);
        g.append("line")
            .attr("class", "axis-line")
            .attr("x1", 0).attr("y1", innerH)
            .attr("x2", innerW).attr("y2", innerH);
    }

    // Stacked bars: life-threatening (bottom, highlighted) + other calls (top).
    // data: [{ label, lines, lt, other, total }]
    // highlightIdx: bracket index to outline (selected region), or -1 for none.
    function drawStackedBars(data, highlightIdx = -1) {
        const svg = d3.select("#bar-svg");
        svg.selectAll("*").remove();

        const W = 250;
        const H = 190;
        const margin = { top: 8, right: 6, bottom: 34, left: 34 };
        const innerW = W - margin.left - margin.right;
        const innerH = H - margin.top - margin.bottom;

        const g = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        const x = d3.scaleBand()
            .domain(data.map((d) => d.label))
            .range([0, innerW])
            .padding(0.25);

        const y = d3.scaleLinear()
            .domain([0, d3.max(data, (d) => d.total) || 1])
            .nice()
            .range([innerH, 0]);

        // Two stacked segments per bar.
        const groups = g.selectAll(".bar-group")
            .data(data)
            .enter()
            .append("g")
            .attr("transform", (d) => `translate(${x(d.label)},0)`);

        // life-threatening sits on the axis…
        groups.append("rect")
            .attr("class", "bar-lt")
            .attr("x", 0)
            .attr("y", (d) => y(d.lt))
            .attr("width", x.bandwidth())
            .attr("height", (d) => innerH - y(d.lt));

        // …other calls stack on top of it.
        groups.append("rect")
            .attr("class", "bar-other")
            .attr("x", 0)
            .attr("y", (d) => y(d.total))
            .attr("width", x.bandwidth())
            .attr("height", (d) => y(d.lt) - y(d.total));

        // Outline the selected region's bracket bar (drawn on top of the bars).
        if (highlightIdx >= 0 && highlightIdx < data.length) {
            const d = data[highlightIdx];
            g.append("rect")
                .attr("class", "bar-highlight")
                .attr("x", x(d.label) - 2)
                .attr("y", y(d.total) - 2)
                .attr("width", x.bandwidth() + 4)
                .attr("height", innerH - y(d.total) + 4);
        }

        // Y axis ticks (call counts, abbreviated as k).
        const fmt = (d) => (d >= 1000 ? d / 1000 + "k" : d);
        g.selectAll(".y-tick")
            .data(y.ticks(4))
            .enter()
            .append("text")
            .attr("class", "tick-label")
            .attr("x", -6)
            .attr("y", (d) => y(d) + 3)
            .attr("text-anchor", "end")
            .text(fmt);

        // X axis income-bracket labels (multi-line via d.lines).
        g.selectAll(".x-tick")
            .data(data)
            .enter()
            .append("text")
            .attr("class", "tick-label")
            .attr("y", innerH + 14)
            .attr("text-anchor", "middle")
            .each(function (d) {
                const cx = x(d.label) + x.bandwidth() / 2;
                const lines = d.lines || [d.label];
                const t = d3.select(this);
                lines.forEach((ln, i) => {
                    t.append("tspan")
                        .attr("x", cx)
                        .attr("dy", i === 0 ? 0 : 10)
                        .text(ln);
                });
            });

        // Axis lines
        g.append("line")
            .attr("class", "axis-line")
            .attr("x1", 0).attr("y1", 0)
            .attr("x2", 0).attr("y2", innerH);
        g.append("line")
            .attr("class", "axis-line")
            .attr("x1", 0).attr("y1", innerH)
            .attr("x2", innerW).attr("y2", innerH);
    }

    updateChartLabel();
    renderBarChart(); // draw the chart on initial page load
})();