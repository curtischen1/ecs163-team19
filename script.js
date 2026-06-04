(function () {
    "use strict";

    const incidentSlider = document.querySelector("#incident-slider");
    const incidentCountInput = document.querySelector("#incident-count-input");

    function sendSampleSize(size) {
        mapFrame.contentWindow.postMessage({ type: "SET_SAMPLE_SIZE", size }, "*");
    }

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

        barChartLabel.textContent = "Income by Zipcode";


        //mapFrame.src = "zip.html";
        //mapFrame.src = "map.html";
        updateMapSrc();

        updateMapSettings();
    });

    tractToggle.addEventListener("click", function () {
        currentBoundary = "tract";

        tractToggle.classList.add("selected");
        zipcodeToggle.classList.remove("selected");

        barChartLabel.textContent = "Income by Census Tract Area";


        //mapFrame.src = "heatmap.html";
        //mapFrame.src = "map.html?boundary=tract";
        updateMapSrc();

        updateMapSettings();
    });

    firestationToggle.addEventListener("click", function () {
        firestationsVisible = !firestationsVisible;
        firestationToggle.classList.toggle("on");
        sendFirestationState();
        updateMapSettings();
    });

    incidentSlider.addEventListener("input", function () {
        const val = parseInt(incidentSlider.value);
        incidentCountInput.value = val;
        sendSampleSize(val);
    });

    incidentCountInput.addEventListener("change", function () {
        let val = parseInt(incidentCountInput.value) || 0;
        val = Math.max(0, Math.min(10000, val));
        incidentCountInput.value = val;
        incidentSlider.value = val;
        sendSampleSize(val);
    });

    /*mapFrame.addEventListener("load", function () {
        sendFirestationState();
    });*/
    window.addEventListener("message", function (event) {
        if (event.data.type === "MAP_READY") {
            sendFirestationState();
            sendSampleSize(parseInt(incidentSlider.value));
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
        if (currentBoundary === "tract") params.set("boundary", "tract");
        params.set("month", currentMonth);
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
})();


