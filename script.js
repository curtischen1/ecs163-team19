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

        barChartLabel.textContent = "Income by Zipcode";


        mapFrame.src = "zip.html";

        updateMapSettings();
    });

    tractToggle.addEventListener("click", function () {
        currentBoundary = "tract";

        tractToggle.classList.add("selected");
        zipcodeToggle.classList.remove("selected");

        barChartLabel.textContent = "Income by Census Tract Area";


        mapFrame.src = "heatmap.html";

        updateMapSettings();
    });

    firestationToggle.addEventListener("click", function () {
        firestationsVisible = !firestationsVisible;

        firestationToggle.classList.toggle("on");

        /*
            Where could tell map to show or hide firestations
        */

        updateMapSettings();
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


