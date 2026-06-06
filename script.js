(function () {
    "use strict";

    // get all of the page controls and display areas that this script needs to update
    const chartSelect = document.querySelector("#chart-select");
    const regionZipBtn = document.querySelector("#region-zip");
    const regionTractBtn = document.querySelector("#region-tract");
    const firestationToggle = document.querySelector("#firestation-toggle");
    const barLegend = document.querySelector("#bar-legend");
    const barChartYLabel = document.querySelector("#bar-chart-ylabel");
    const regionNote = document.querySelector("#region-note");
    const mapFrame = document.querySelector("#heatmap-frame");
    const barChartLabel = document.querySelector("#bar-chart-label");
    const months = document.querySelectorAll(".month");
    const incidentSlider = document.querySelector("#incident-slider");
    const incidentCountInput = document.querySelector("#incident-count-input");

    // keep track of the user’s current selections so the map and chart stay in sync
    let currentBoundary = "zipcode"; 
    let currentChart = "boundary";
    let currentChartMode = "income";
    let currentMonth = "mar";
    let firestationsVisible = false;
    let selectedRegionId = null;
    let lastIncomeMap = null;

    // abv month buttons and the month response chart
    const MONTH_LABELS = {
        jan: "Jan",
        feb: "Feb",
        mar: "Mar",
        apr: "Apr",
        may: "May",
        jun: "Jun",
        jul: "Jul",
        aug: "Aug",
        sep: "Sep",
        oct: "Oct",
        nov: "Nov",
        dec: "Dec"
    };

    const MONTH_ORDER = Object.keys(MONTH_LABELS);

    // read the curr num of incident dots the user wants shown on the map
    function currentIncidentCount() {
        if (!incidentSlider) return 750;
        return parseInt(incidentSlider.value, 10) || 0; 
    }

    // tell the map how many incident dots to display
    function sendSampleSize(size) {
        if (!mapFrame || !mapFrame.contentWindow) return;
        mapFrame.contentWindow.postMessage({ type: "SET_SAMPLE_SIZE", size }, "*");
    }

    // each dropdown option maps to a chart + boundary + mode combination
    const CHART_OPTIONS = {
        "income-zip": { chart: "boundary", boundary: "zipcode", mode: "income" },
        "income-tract": { chart: "boundary", boundary: "tract", mode: "income" },
        "severity": { chart: "boundary", mode: "severity" },
        "month": { chart: "monthResponse" },
        "density": { chart: "callDensity" },
        "distance": { chart: "stationDistance" },
        "coverage": { chart: "stationCoverage" }
    };

    // single dropdown drives the whole bar chart: set state, then redraw map + chart
    chartSelect.addEventListener("change", function () {
        const opt = CHART_OPTIONS[chartSelect.value];
        if (!opt) return;

        currentChart = opt.chart;
        if (opt.boundary) currentBoundary = opt.boundary;
        if (opt.mode) currentChartMode = opt.mode;

        updateRegionToggleStyles();
        clearRegionSelection();
        updateChartLabel();
        updateMapSrc();
        updateMapSettings();
        renderBarChart();
    });

    // map-region strip: shares the geographic granularity with the income chart
    function selectRegionLayer(boundary) {
        if (currentBoundary === boundary) return;
        currentBoundary = boundary;
        updateRegionToggleStyles();
        clearRegionSelection();
        updateMapSrc();

        // if the income chart is up, keep the dropdown + chart in sync with the map
        if (currentChart === "boundary" && currentChartMode === "income") {
            chartSelect.value = currentBoundary === "tract" ? "income-tract" : "income-zip";
            updateChartLabel();
            renderBarChart();
        }
    }

    regionZipBtn.addEventListener("click", function () { selectRegionLayer("zipcode"); });
    regionTractBtn.addEventListener("click", function () { selectRegionLayer("tract"); });

    // highlight whichever region granularity is active on the map strip
    function updateRegionToggleStyles() {
        regionZipBtn.classList.toggle("selected", currentBoundary === "zipcode");
        regionTractBtn.classList.toggle("selected", currentBoundary === "tract");
    }

    // turn fire station markrs on and off on the map
    firestationToggle.addEventListener("click", function () {
        firestationsVisible = !firestationsVisible;
        firestationToggle.classList.toggle("on");
        firestationToggle.setAttribute("aria-checked", String(firestationsVisible));
        sendFirestationState();
        updateMapSettings();
    });


    // keep the incident slider and number input matched, then update the map dot count
    if (incidentSlider && incidentCountInput) {
        incidentSlider.addEventListener("input", function () {
            const val = parseInt(incidentSlider.value, 10) || 0;
            incidentCountInput.value = val;

            sendSampleSize(val);
        });

        incidentCountInput.addEventListener("change", function () {
            let val = parseInt(incidentCountInput.value, 10) || 0;
            val = Math.max(0, Math.min(10000, val));
            incidentCountInput.value = val;
            incidentSlider.value = val;
            sendSampleSize(val);
        });
    }

    // listen for msgs from the embedded map iframe, such as map ready, incident click, or region click
    window.addEventListener("message", function (event) {
        if (event.data.type === "MAP_READY") {
            sendFirestationState();
            sendRegionHighlight();
            sendSampleSize(currentIncidentCount()); 
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

    // when user clicks a zipcode/tract, select it and highlight its matching income bracket
    async function handleRegionClick(id, boundary) {
        if (currentChart !== "boundary") return;
        if (boundary !== currentBoundary) return;

        selectedRegionId = (selectedRegionId === id) ? null : id;
        if (currentChartMode !== "income") switchToIncomeMode();

        await renderBarChart();
        updateRegionNote();

        sendRegionHighlight();
    }

    // helper for returning the chart controls back t income mode
    function switchToIncomeMode() {
        currentChartMode = "income";
        syncChartSelect();
        updateChartLabel();
    }

    // rmv selected zipcode/tract highlight
    function clearRegionSelection() {
        selectedRegionId = null;
        updateRegionNote();
        sendRegionHighlight();
    }

    // tell the map which selected region is highlighted
    function sendRegionHighlight() {
        const highlightedRegion = currentChart === "boundary" && currentChartMode === "income"
            ? selectedRegionId
            : null;

        mapFrame.contentWindow.postMessage(
            { type: "SET_REGION_HIGHLIGHT", id: highlightedRegion },
            "*"
        );
    }

    // update small note under the chart identifies selected region + income
    function updateRegionNote() {
        if (!regionNote) return;

        if (selectedRegionId == null || currentChart !== "boundary" || currentChartMode !== "income") {
            regionNote.textContent = "";
            regionNote.style.display = "none";
            return;
        }

        regionNote.style.display = "block"; 

        const inc = lastIncomeMap ? lastIncomeMap.get(selectedRegionId) : null;
        regionNote.textContent = inc != null
            ? `${selectedRegionId} · $${Math.round(inc / 1000)}k median`
            : `${selectedRegionId} · no income data`;
    }

    // tell the map if fire station markers should be visible
    function sendFirestationState() {
        mapFrame.contentWindow.postMessage(
            { type: "SET_FIRESTATIONS", visible: firestationsVisible },
            "*"
        );
    }

    // keep the dropdown value matching the current chart state
    function syncChartSelect() {
        if (currentChart === "boundary") {
            chartSelect.value = currentChartMode === "severity"
                ? "severity"
                : (currentBoundary === "tract" ? "income-tract" : "income-zip");
        } else if (currentChart === "monthResponse") {
            chartSelect.value = "month";
        } else if (currentChart === "callDensity") {
            chartSelect.value = "density";
        } else if (currentChart === "stationDistance") {
            chartSelect.value = "distance";
        } else if (currentChart === "stationCoverage") {
            chartSelect.value = "coverage";
        }
    }

    // change the chart title, y-axis label, and legend based on active chart
    function updateChartLabel() {
        const usesResponseAxis = currentChart !== "boundary" || currentChartMode === "severity";
        barChartYLabel.classList.toggle("response-axis-label", usesResponseAxis);

        if (currentChart === "boundary") {
            if (currentChartMode === "severity") {
                barChartLabel.textContent = "Call Severity";
                barChartYLabel.textContent = "EMS Response (min)";
                barLegend.style.display = "none";
                if (regionNote) {
                    regionNote.textContent = "";
                    regionNote.style.display = "none";
                }
            } else { 
                barChartLabel.textContent = currentBoundary === "tract"
                    ? "Median Income, Census Tract ($k)"
                    : "Median Income, Zipcode ($k)";
                barChartYLabel.textContent = "EMS Calls";
                barLegend.style.display = "flex";
                updateRegionNote();
            }
            return;

        }


        barLegend.style.display = "none";
        regionNote.style.display = "none";
        barChartYLabel.textContent = "EMS Response (min)";

        if (currentChart ===  "monthResponse") barChartLabel.textContent = "Month";
        if (currentChart === "callDensity") barChartLabel.textContent = "Call Density";
        if (currentChart === "stationDistance") barChartLabel.textContent = "Distance to Firestation (km)";
        if (currentChart === "stationCoverage") barChartLabel.textContent = "Firestations within 1.5 km";
    }

    // reload iframe map with the correct month and region granularity
    function updateMapSrc() {
        const params = new URLSearchParams();
        params.set("month", currentMonth);
        if (currentBoundary === "tract") params.set("boundary", "tract");
        mapFrame.src = "map.html?" + params.toString();
    }

    // connect the custom zoom buttons to map iframe
    const zoomInButton = document.querySelector("#zoom-in");
    const zoomOutButton =  document.querySelector("#zoom-out");

    zoomInButton.addEventListener("click", function () {
        mapFrame.contentWindow.postMessage({ type: "ZOOM_IN" }, "*");
    });

    zoomOutButton.addEventListener("click", function () {
        mapFrame.contentWindow.postMessage({ type: "ZOOM_OUT" }, "*");
    });

    // when month is clicked, update the map, incident dots, and current chart
    months.forEach(function (monthButton) {
        monthButton.addEventListener("click", function () { 
            months.forEach(function (button) {
                button.classList.remove("selected-month");
            });

            monthButton.classList.add("selected-month");
            currentMonth = monthButton.dataset.month;

            mapFrame.contentWindow.postMessage({ type: "SET_MONTH", month: currentMonth }, "*");
            sendSampleSize(currentIncidentCount());
            updateMapSettings();

            if (currentChart === "boundary") { 
                renderBarChart();
            } else if (currentChart === "monthResponse") {
                updateMonthHighlight();

            }
        });
    });

    // debug helper: logs the current settings in the browser console
    function updateMapSettings() { 
        console.log({
            boundary: currentBoundary,
            chart: currentChart,
            chartMode: currentChartMode,
            month: currentMonth,

            firestations: firestationsVisible
        });
    }

    // num of income groups used in the income bar chart 
    const NUM_BRACKETS = 5;

    // split income vals into brackets for the income chart
    function incomeBrackets(incomes) {
        const sorted = [...incomes].sort((a, b) => a - b);
        const edges = [];

        for (let i = 1; i < NUM_BRACKETS; i++) { 
            const e = sorted[Math.min(Math.floor((i / NUM_BRACKETS) * sorted.length), sorted.length - 1)];
            edges.push(Math.round(e / 5000) * 5000);
        }

        const k = (v) => Math.round(v / 1000);
        const labels = edges.map((e, i) =>
            i === 0
                ? { label: "b0", lines: ["<" + k(e)] }
                : { label: "b" + i, lines: [k(edges[i - 1]) + "–", String(k(e))] }
        );
        labels.push({ label: "b" + edges.length, lines: [k(edges[edges.length - 1]) + "+"] });
        return { edges, labels };
    }

    // find wh ich income bracket a selcted region belongs to
    function bracketIndex(income, edges) {
        let b = 0;
        while (b < edges.length && income >= edges[b]) b++;
        return b;
    }

    // settings for loading eith zipcode incom data or census tract income data
    const BOUNDARY_CONFIG = {
        zipcode: { csv: "sf_zip_income.csv", csvKey: "zcta", dataKey: "zip" },
        tract: { csv: "sf_tract_income.csv", csvKey: "geoid", dataKey: "tract" }
    };

    // labels + keys used for the severity response time chart
    const SEVERITIES = [ 
        { key: "Potentially Life-Threatening", label: "Life-Threatening", lines: ["Life-", "Threat."] },
        { key: "Fire", label: "Fire", lines: ["Fire"] },
        { key: "Non Life-threatening", label: "Non Life-threat.", lines: ["Non Life-", "threat."] },
        { key: "Alarm", label: "Alarm", lines: ["Alarm"] }
    ];

    // cache loaded data so files are not fetched again every time the chart changes.
    const incomeCache = {};
    let regionCounts = null;
    let severityData = null;
    let responseData = null;

    let distanceResponseData = null;
    let coverageResponseData = null;

    // stores  last drawn bar geometry so chart updates morph from the
    // prev values (shows difference more clearly between months seeing grow or shrink)
    let lastBarPositions = null;
    let lastStackedPositions = null; 
    let lastChartShape = null;

    // load income CSV data + convert to lookup map by zipcode or tract id
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

    // load monthly call counts by region and severity
    async function loadRegionCounts() {
        if (!regionCounts) regionCounts = await d3.json("severity_by_region.json");
        return regionCounts;
    }

    // load response time data grouped by call severity 
    async function loadSeverity() {
        if (!severityData) severityData = await d3.json("response_by_severity.json");
        return severityData; 
    }

    // load response time data grouped by region/month
    async function loadResponse() {
        if (!responseData) responseData = await d3.json("response_by_region.json");
        return responseData;
    }


    // load response time data grouped by distance to nearest fire station 
    async function loadDistanceResponse() {
        if (!distanceResponseData) distanceResponseData = await d3.json("distance_response.json");
        return distanceResponseData; 
    }

    // load response time data grouped by nearby fire station coverage
    async function loadCoverageResponse() {
        if (!coverageResponseData) coverageResponseData = await d3.json("coverage_response.json");
        return coverageResponseData;

    }

    // show msg inside the chart area when data canot be displayed
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


    // draw chart based on toggle selection
    async function renderBarChart() {
        try {
            if (currentChart === "boundary") {
                return currentChartMode === "severity"
                    ? renderSeverityChart()
                    : renderIncomeChart();
            }

            if (currentChart === "monthResponse") {
                const response = await loadResponse();
                drawMonthResponseBars(buildMonthlyResponseData(response));
                return;
            } 

            if (currentChart === "callDensity") {
                const response = await loadResponse();
                drawBars(buildCallDensityData(response), { skewY: true, wideX: true });
                return;
            }

            if (currentChart === "stationDistance") {
                const distanceResponse = await loadDistanceResponse();
                drawBars(distanceResponse.data, { skewY: true, wideX: true });
                return;
            }

            if (currentChart === "stationCoverage") {
                const coverageResponse = await loadCoverageResponse();
                drawBars(coverageResponse.data, { skewY: true });
            }
        } catch (err) {
            console.error(err);
            showChartMessage("Chart data could not load.");
        }
    }

    // build and draw the stacked income chart using income brackets and call totals 
    async function renderIncomeChart() {
        const cfg = BOUNDARY_CONFIG[currentBoundary];

        try { 
            const [counts, income] = await Promise.all([
                loadRegionCounts(),
                loadIncome(cfg)
            ]);

            lastIncomeMap = income;

            const monthData = counts[currentMonth];
            const regionMap = monthData ? monthData[cfg.dataKey] : null;
            if (!regionMap) {
                showChartMessage("No data for this month.");
                return;
            }

            const regions = [];
            for (const [id, rec] of Object.entries(regionMap)) {
                const inc = income.get(id);
                if (inc != null && rec.total > 0) regions.push({ inc, rec });
            }

            if (!regions.length) {
                showChartMessage("No matching income data.");
                return; 
            }

            const { edges, labels } = incomeBrackets(regions.map((d) => d.inc));
            const totals = labels.map(() => ({ lt: 0, total: 0 }));

            for (const { inc, rec } of regions) {
                const t = totals[bracketIndex(inc, edges)];
                t.lt += rec.lt;
                t.total += rec.total;
            }

            const data = labels.map((l, i) => ({
                label: l.label, 
                lines: l.lines,
                lt: totals[i].lt, 
                other: totals[i].total - totals[i].lt,
                total: totals[i].total
            }));

            let highlightIdx = -1;
            if (selectedRegionId != null) {
                const selInc = income.get(selectedRegionId);
                if (selInc != null) highlightIdx = bracketIndex(selInc, edges);
            }

            drawStackedBars(data, highlightIdx);
            updateRegionNote();
        } catch (err) {
            console.error(err);
            showChartMessage("Chart data could not load.");
        }
    }

    // build and draw the response time chart grouped by call severity 
    async function renderSeverityChart() {
        try {
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

            drawBars(data, { bottomMargin: 34 });
        } catch (err) { 
            console.error(err);
            showChartMessage("Chart data could not load.");
        }
    }

    // calc weighted average response time for a month using zipcode records
    function summarizeMonth(monthData) {
        const regionMap = monthData && monthData.zip ? monthData.zip : null;
        let sum = 0;
        let count = 0;

        if (!regionMap) return { minutes: 0, count: 0 }; 

        for (const rec of Object.values(regionMap)) {
            sum += rec.avgMin * rec.n;
            count += rec.n;

        }

        return { minutes: count ? sum / count : 0, count };
    }

    // convert the monthly response data into chart ready rows
    function buildMonthlyResponseData(response) {
        return MONTH_ORDER.map((month) => {
            const summary =  summarizeMonth(response[month]);
            return {
                label: MONTH_LABELS[month],
                month,
                minutes: summary.minutes,
                count: summary.count
            };
        });
    }

    // group months by tot call volume to compare density with response time
    function buildCallDensityData(response) {
        const monthly = buildMonthlyResponseData(response).filter((d) => d.count > 0);
        const counts = monthly.map((d) => d.count);
        const minCount = d3.min(counts) || 0; 

        const maxCount = d3.max(counts) || 1;
        const bracketCount = 5;
        const step = Math.ceil((maxCount - minCount + 1) / bracketCount) || 1;

        const brackets = d3.range(bracketCount).map((i) => {
            const min = minCount + i * step;
            const max = i ===  bracketCount - 1 ? maxCount + 1 : min + step;
            return {
                min,
                max,
                label: `${formatCompact(min)}–${formatCompact(max - 1)}`,
                sum: 0,
                count: 0,
                months: 0
            };
        });

        monthly.forEach((d) => {
            const bi = Math.min(Math.floor((d.count - minCount) / step), bracketCount - 1);
            brackets[bi].sum += d.minutes * d.count;
            brackets[bi].count += d.count; 
            brackets[bi].months += 1;
        });

        return brackets.map((b) => ({
            label: b.label,
            minutes: b.count ? b.sum / b.count : 0,
            count: b.count,
            months: b.months

        }));

    }

    // format lrge vals 12000 as 12k for chart labels
    function formatCompact(num) {
        if (num >= 1000) return `${Math.round(num / 1000)}k`;
        return String(num);
    }

    // fraw month rsponse chart and highligh currently selected month
    function drawMonthResponseBars(data) {
        drawBars(data, {
            highlightMonth: currentMonth,
            getBarClass: (d) => d.month === currentMonth ? "bar selected-bar" : "bar",
            skewY: true, 
            wideX: true
        });
    }

    // update  month chart highligh
    function updateMonthHighlight() {
        d3.select("#bar-svg")
            .selectAll(".bar")
            .attr("class", (d) => d.month === currentMonth ? "bar selected-bar" : "bar")
            .attr("fill", (d) => d.month === currentMonth ? "#8a0fcb" : "#6f88b9");
    }

    // y-scale that makes small response-time differences easier to see
    function createSkewedYScale(maxValue, innerH) {
        const splitValue = 10; 
        const upperValue = Math.max(12, Math.ceil(maxValue * 10) / 10);

        const lowerScale = d3.scaleLinear()
            .domain([0, splitValue])
            .range([innerH, innerH / 2]);

        const upperScale = d3.scaleLinear()
            .domain([splitValue, upperValue])
            .range([innerH / 2, 0]);

        return {
            map(value) {
                if (value <= splitValue) return lowerScale(value);
                return upperScale(value);
            },
            ticks: [0, 2, 4, 6, 8, 10, 11, 12, 13, 14, 15, 16, 17, 18].filter((d) => d <= upperValue)
        }; 
    }

    // draw standard  bar chart for response time based views
    function drawBars(data, options = {}) {

        const svg = d3.select("#bar-svg");
        const previous = lastBarPositions;
        const useWideX = options.wideX === true;
        d3.select("#bar-chart").classed("wide-bar-chart", useWideX);
        svg.selectAll("*").remove();

        const W = useWideX ? 320 : 250;
        const H = 190;
        svg.attr("width", W).attr("height", H);
        
        const margin = { top: 8, right: 6, bottom: options.bottomMargin || 22, left: 30 };
        const innerW = W - margin.left - margin.right;
        const innerH = H - margin.top - margin.bottom;

        const g = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        const x = d3.scaleBand()
            .domain(data.map((d) => d.label))
            .range([0, innerW])
            .padding(data.length > 8 ? 0.18 : 0.25);

        const maxMinutes = d3.max(data, (d) => d.minutes) || 1; 
        const skewedY = options.skewY ? createSkewedYScale(maxMinutes, innerH) : null;
        const y = options.skewY
            ? (value) =>  skewedY.map(value)
            : d3.scaleLinear().domain([0, maxMinutes]).nice().range([innerH, 0]);

        const baseFill = "#6f88b9";
        const highlightFill = "#8a0fcb";
        const targetPositions = data.map((d) => ({
            y: y(d.minutes),
            height: innerH - y(d.minutes)
        }));

        const bars = g.selectAll(".bar")
            .data(data)
            .enter()
            .append("rect") 
            .attr("class", options.getBarClass ? options.getBarClass : "bar")
            .attr("x", (d) => x(d.label))
            .attr("width", x.bandwidth())
            .attr("y", (d, i) => previous && previous[i] ? previous[i].y : targetPositions[i].y)
            .attr("height", (d, i) => previous && previous[i] ? previous[i].height : targetPositions[i].height)
            .attr("fill", (d) => options.highlightMonth && d.month === options.highlightMonth ? highlightFill : baseFill);

        bars.transition("shift")
            .duration(550)
            .ease(d3.easeCubicOut)
            .attr("y", (d, i) => targetPositions[i].y)
            .attr("height", (d, i) => targetPositions[i].height);

        const yTicks = options.skewY ? skewedY.ticks : y.ticks(4);
        g.selectAll(".y-tick")
            .data(yTicks) 
            .enter()
            .append("text")
            .attr("class", "tick-label")
            .attr("x", -6)
            .attr("y", (d) => y(d) + 3)
            .attr("text-anchor", "end")
            .text((d) => d);

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

        drawAxes(g, innerW, innerH); 
        lastBarPositions = targetPositions;
        lastStackedPositions = null;
        lastChartShape = "regular";
    }

    // draw  income chart with life threatening calls and other calls
    function drawStackedBars(data, highlightIdx = -1) {
        const svg = d3.select("#bar-svg");
        const previousTotals = lastBarPositions;
        const previousStacked = lastStackedPositions;
        d3.select("#bar-chart").classed("wide-bar-chart", false);
        svg.selectAll("*").remove();

        const W = 250;
        const H = 190; 
        svg.attr("width", W).attr("height", H);
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

        const targetPositions = data.map((d) => ({
            totalY: y(d.total),
            totalH: innerH - y(d.total), 

            ltY: y(d.lt),
            ltH: innerH - y(d.lt),
            otherY: y(d.total),
            otherH: y(d.lt) - y(d.total)
        }));

        const groups = g.selectAll(".bar-group")
            .data(data)
            .enter()
            .append("g")
            .attr("transform", (d) => `translate(${x(d.label)},0)`);

        groups.append("rect")
            .attr("class", "bar-lt")
            .attr("x", 0)
            .attr("width", x.bandwidth())

            .attr("y", (d, i) => previousStacked && previousStacked[i] ? previousStacked[i].ltY : targetPositions[i].ltY)
            .attr("height", (d, i) => previousStacked && previousStacked[i] ? previousStacked[i].ltH : targetPositions[i].ltH)
            .transition("shift")
            .duration(550)
            .ease(d3.easeCubicOut)
            .attr("y", (d, i) => targetPositions[i].ltY)
            .attr("height", (d, i) => targetPositions[i].ltH);

        groups.append("rect")
            .attr("class", "bar-other")
            .attr("x", 0)
            .attr("width", x.bandwidth()) 
            .attr("y", (d, i) => {
                if (previousStacked && previousStacked[i]) return previousStacked[i].otherY;
                if (previousTotals && previousTotals[i]) return previousTotals[i].y;
                return targetPositions[i].otherY;
            })
            .attr("height", (d, i) => {
                if (previousStacked && previousStacked[i]) return previousStacked[i].otherH;
                if (previousTotals && previousTotals[i]) return previousTotals[i].height;
                return targetPositions[i].otherH;
            })
            .transition("shift")
            .duration(550)
            .ease(d3.easeCubicOut)
            .attr("y", (d, i) => targetPositions[i].otherY)
            .attr("height", (d, i) => targetPositions[i].otherH);

        if (highlightIdx >= 0 && highlightIdx < data.length) {
            const d = data[highlightIdx];
            g.append("rect")
                .attr("class", "bar-highlight")
                .attr("x", x(d.label) - 2) 
                .attr("y", y(d.total) - 2)
                .attr("width", x.bandwidth() + 4)
                .attr("height", innerH - y(d.total) + 4);
        }

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

        drawAxes(g, innerW, innerH);
        lastBarPositions = targetPositions.map((d) => ({ y: d.totalY, height: d.totalH }));
        lastStackedPositions = targetPositions;
        lastChartShape = "stacked";
    }

    // Draw x and y axis lines used by each bar chart
    function drawAxes(g, innerW, innerH) {
        g.append("line")
            .attr("class", "axis-line")
            .attr("x1", 0).attr("y1", 0)
            .attr("x2", 0).attr("y2", innerH);

        g.append("line")
            .attr("class", "axis-line")
            .attr("x1", 0).attr("y1", innerH)
            .attr("x2", innerW).attr("y2", innerH);
    } 

    syncChartSelect();
    updateRegionToggleStyles();
    updateChartLabel();
    renderBarChart();

})();







