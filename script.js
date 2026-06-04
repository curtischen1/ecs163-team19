(function () {
    "use strict";

    const zipcodeToggle = document.querySelector("#zipcode-toggle");
    const tractToggle = document.querySelector("#tract-toggle");
    const firestationToggle = document.querySelector("#firestation-toggle");
    const mapFrame = document.querySelector("#heatmap-frame");
    const barChartLabel = document.querySelector("#bar-chart-label");
    const months = document.querySelectorAll(".month");

    let currentBoundary = "zipcode";
    let currentMonth = "mar";
    let firestationsVisible = false;

    zipcodeToggle.addEventListener("click", function () {
        currentBoundary = "zipcode";

        zipcodeToggle.classList.add("selected");
        tractToggle.classList.remove("selected");

        barChartLabel.textContent = "Income by Zipcode ($k)";


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

        barChartLabel.textContent = "Income by Census Tract ($k)";


        //mapFrame.src = "heatmap.html";
        //mapFrame.src = "map.html?boundary=tract";
        updateMapSrc();

        updateMapSettings();
        renderBarChart(); // re-bin the chart using tract-level income
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
    });

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
            //updateMapSrc();
            mapFrame.contentWindow.postMessage({ type: "SET_MONTH", month: currentMonth }, "*");
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
       Income vs. EMS response-time bar chart
       -------------------------------------------------------------------------
       Reads response_by_region.json, a precomputed average EMS response time
       per region for each month:
         { "<month>": { "zip":   { "<zcta>":  {avgMin, n}, ... },
                        "tract": { "<geoid>": {avgMin, n}, ... } }, ... }
       At runtime we:
         1. Load that file + the income CSV for the current boundary.
         2. Join each region's avgMin/n to its income by ID.
         3. Pool into income brackets, weighted by incident count n.
         4. Draw the bars.
       ========================================================================= */

    // Income brackets ($). Fixed count -> chart stays legible in both modes.
    const BRACKETS = [
        { label: "<50",     min: 0,      max: 50000 },
        { label: "50–75",   min: 50000,  max: 75000 },
        { label: "75–100",  min: 75000,  max: 100000 },
        { label: "100–150", min: 100000, max: 150000 },
        { label: "150+",    min: 150000, max: Infinity }
    ];

    // Per boundary: which income CSV + which column is the join id.
    const BOUNDARY_CONFIG = {
        zipcode: { csv: "sf_zip_income.csv",   csvKey: "zcta",  dataKey: "zip" },
        tract:   { csv: "sf_tract_income.csv", csvKey: "geoid", dataKey: "tract" }
    };

    // Caches so toggling/re-selecting doesn't re-load files.
    const incomeCache = {};               // csv file -> Map(id -> income)
    let responseData = null;              // parsed response_by_region.json

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

    // Load the precomputed response file once.
    async function loadResponse() {
        if (!responseData) {
            responseData = await d3.json("response_by_region.json");
        }
        return responseData;
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

    async function renderBarChart() {
        const cfg = BOUNDARY_CONFIG[currentBoundary];

        try {
            showChartMessage("Loading…");

            // load the precomputed response file + income CSV (both cached)
            const [response, income] = await Promise.all([
                loadResponse(),
                loadIncome(cfg)
            ]);

            const monthData = response[currentMonth];
            const regionMap = monthData ? monthData[cfg.dataKey] : null;
            if (!regionMap) {
                showChartMessage("No data for this month.");
                return;
            }

            // Pool into brackets, weighted by incident count n.
            const totals = BRACKETS.map(() => ({ sum: 0, count: 0 }));
            for (const [id, rec] of Object.entries(regionMap)) {
                const inc = income.get(id);
                if (inc == null) continue; // skip regions with no income (blanks)

                const bi = BRACKETS.findIndex((b) => inc >= b.min && inc < b.max);
                if (bi >= 0) {
                    totals[bi].sum += rec.avgMin * rec.n; // weight by incidents
                    totals[bi].count += rec.n;
                }
            }

            // Weighted average response time (minutes) per bracket.
            const data = BRACKETS.map((b, i) => ({
                label: b.label,
                minutes: totals[i].count ? totals[i].sum / totals[i].count : 0,
                count: totals[i].count
            }));

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
        const margin = { top: 8, right: 6, bottom: 22, left: 30 };
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

        // X axis bracket labels
        g.selectAll(".x-tick")
            .data(data)
            .enter()
            .append("text")
            .attr("class", "tick-label")
            .attr("x", (d) => x(d.label) + x.bandwidth() / 2)
            .attr("y", innerH + 14)
            .attr("text-anchor", "middle")
            .text((d) => d.label);

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

    renderBarChart(); // draw the chart on initial page load
})();