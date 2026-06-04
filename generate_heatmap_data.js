// generate_heatmap_data.js
// Run once with: node generate_heatmap_data.js
// Requires Node 18+ (built-in fetch). Output: heatmap_by_month.json

const APP_TOKEN = process.env.SF_APP_TOKEN || "paste_your_token_here";

const MONTHS = {
    jan: { from: "2024-01-01", to: "2024-02-01" },
    feb: { from: "2024-02-01", to: "2024-03-01" },
    mar: { from: "2024-03-01", to: "2024-04-01" },
    apr: { from: "2024-04-01", to: "2024-05-01" },
    may: { from: "2024-05-01", to: "2024-06-01" },
    jun: { from: "2024-06-01", to: "2024-07-01" },
    jul: { from: "2024-07-01", to: "2024-08-01" },
    aug: { from: "2024-08-01", to: "2024-09-01" },
    sep: { from: "2024-09-01", to: "2024-10-01" },
    oct: { from: "2024-10-01", to: "2024-11-01" },
    nov: { from: "2024-11-01", to: "2024-12-01" },
    dec: { from: "2024-12-01", to: "2025-01-01" }
};

const SF_URL = `https://data.sfgov.org/api/v3/views/gfpk-269f/query.geojson?$$app_token=${encodeURIComponent(APP_TOKEN)}`;

// Approximate centroid of a GeoJSON feature (mean of exterior ring coordinates)
function getCentroid(feature) {
    const geom = feature.geometry;
    let coords = [];

    if (geom.type === "Polygon") {
        coords = geom.coordinates[0];
    } else if (geom.type === "MultiPolygon") {
        // use the polygon with the most coordinates
        for (const polygon of geom.coordinates) {
            if (polygon[0].length > coords.length) coords = polygon[0];
        }
    }

    if (coords.length === 0) return null;

    const lng = coords.reduce((s, c) => s + c[0], 0) / coords.length;
    const lat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
    return { lat, lng };
}

function distSq(lat1, lng1, lat2, lng2) {
    const dlat = lat1 - lat2;
    const dlng = lng1 - lng2;
    return dlat * dlat + dlng * dlng;
}

async function fetchEMS(from, to) {
    const url = `https://data.sfgov.org/resource/nuek-vuh3.json?$where=received_dttm >= '${from}T00:00:00' AND received_dttm < '${to}T00:00:00'&$limit=50000&$$app_token=${encodeURIComponent(APP_TOKEN)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`EMS fetch failed for ${from}: ${res.status}`);
    return res.json();
}

async function main() {
    console.log("Fetching SF boundary GeoJSON...");
    const geoRes = await fetch(SF_URL);
    if (!geoRes.ok) throw new Error("SF GeoJSON failed");
    const geo = await geoRes.json();

    const centroids = geo.features.map(getCentroid).filter(c => c !== null);
    console.log(`${centroids.length} centroids found`);

    const output = {};

    for (const [monthKey, { from, to }] of Object.entries(MONTHS)) {
        console.log(`Processing ${monthKey}...`);

        const ems = await fetchEMS(from, to);

        const rows = ems
            .filter(d => d.received_dttm && d.on_scene_dttm && d.case_location?.coordinates)
            .map(d => {
                const [lng, lat] = d.case_location.coordinates;
                const t = (new Date(d.on_scene_dttm) - new Date(d.received_dttm)) / 1000;
                return { lat, lng, t };
            })
            .filter(d => d.t > 0 && d.t < 3600);

        const tSum = new Array(centroids.length).fill(0);
        const count = new Array(centroids.length).fill(0);

        for (const row of rows) {
            let bestIdx = 0, bestDist = Infinity;
            for (let i = 0; i < centroids.length; i++) {
                const d = distSq(row.lat, row.lng, centroids[i].lat, centroids[i].lng);
                if (d < bestDist) { bestDist = d; bestIdx = i; }
            }
            tSum[bestIdx] += row.t;
            count[bestIdx]++;
        }

        output[monthKey] = centroids
            .map((c, i) => count[i] > 0 ? { lat: c.lat, lng: c.lng, t: tSum[i] / count[i] } : null)
            .filter(c => c !== null);

        console.log(`  → ${output[monthKey].length} centroids with data from ${rows.length} incidents`);
    }

    const fs = await import("fs");
    fs.writeFileSync("heatmap_by_month.json", JSON.stringify(output));
    console.log("Done. Written to heatmap_by_month.json");
}

main().catch(console.error);