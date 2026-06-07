# EMS Response Time in San Francisco

## Description

This repository is an interactive browser based visualization dashboard designed for exploring what factors influence EMS response times in San Francisco. The project contains a D3 map along with a few linked bar charts so that users are able to investigate how response time relates to variables such as income, geography, emergency severity, call density, distance to fire stations, and fire station coverage. The main point of entry is the `index.html` file, which loads the complete dashboard layout. It is connected to `styles.css` for styling, and uses `script.js` to control everything from the chart interactions, month selection, boundary toggles, incident slider, to the communication with the embedded map.

The map section is handled mainly through the `map.html` file, which renders the San Francisco geography, response time heatmap, ZIP code or census tract boundaries, fire station markers, incident dots, and the tooltips. The other supporting map files such as `heatmap.html` as well as `zip.html` are both included as development or testing files. The project uses local JSON and CSV files in order to store the geographic boundaries, income data, fire station locations, response time summaries, severity summaries, and derived infrastructure metrics.

The data files include both the original supporting data and several derived analytical summaries. Boundary files such as `sf_tracts.json`, `sf_tracts_border.json`, `zip.json`, and `zip_borders.json` are utilized to define the map shapes and borders. Income files like `sf_tract_income.csv` and `sf_zip_income.csv` support the income comparisons shown on the charts. The other files including: `response_by_region.json`, `response_by_severity.json`, `severity_by_region.json`, `distance_response.json`, `coverage_response.json`, and `heatmap_by_month.json` provide several precomputed values that are used by the dashboard charts and the map. The preprocessing script `generate_heatmap_data.js` was utilized in order to pre-generate monthly heatmap summaries so that the final visualization can load and update more efficiently within the browser. Running this script is not required to use the dashboard.

## Data Sources and Reproducibility

Most datasets required to run the dashboard are included in this repository. Incident dot data is fetched live from the SF Open Data EMS API and requires an internet connection, no account or API key is needed for normal use. Geographic boundary and income datasets were obtained from the U.S. Census Bureau.

## Installation and Setup

No package installation is required in order to view the final dashboard. This project runs in a browser using just standard HTML, CSS, JavaScript, and D3.js which is loaded through a CDN.

One thing to keep in mind however is that the project should be opened through a local development server rather than by simply double clicking `index.html`. This is because browsers often block any local file loading for JSON and CSV files when opening HTML files directly from the filesystem (and the user will see loading errors in the browser space instead). This repository already includes all the precomputed datasets needed to run the dashboard, therefore, there is no need to regenerate any of the data.

### The recommended setup using Visual Studio Code

1. First, download or clone the GitHub repository.

```bash
git clone <repository-url>
cd <repository-folder>
```

2. Open the project folder in Visual Studio Code.

3. Install the **Live Server** extension in VS Code if it is not already installed.

4. Right-click `index.html`.

5. Select **Open with Live Server**.

6. The dashboard should open in the browser, usually at a local URL.

7. Wait for the dashboard to load, after loading, the map, charts, and controls should appear automatically.

8. Use the interface controls:

   * You can use the chart dropdown to switch between income, severity, month, call density, distance, and station coverage views.
   * The month buttons can be used to move through 2024 (be aware this can sometimes take a few seconds for the initial and next maps to load).
   * Use the ZIP code / census tract toggle to change the map boundary type.
   * The fire station toggles to show or hide fire station locations, which when paired with a selected incident will show the user which fire station answered that particular call.
   * The incident slider can control how many incident dots appear on the map, as there are too many to display all at once. Click on an individual incident dot to read an incident report with specific details about the call.
   * Click a region on the map to view more detailed information paired with the income related charts.

This dashboard is designed to support user exploration. There is no one required path to go through the visualization.

