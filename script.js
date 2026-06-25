const API_URL = "https://script.google.com/macros/s/AKfycbzyjusxWTqrqy4fA0G7RBvY1RUcyVAtD0urEwND_6rB7KL_3GOlHf1616_91zkOQbqc/exec";

let rawData = [];
let filteredData = [];

// ELEMENT
const lokasiFilter = document.getElementById("lokasiFilter");
const pemutusFilter = document.getElementById("pemutusFilter");
const searchInput = document.getElementById("searchInput");
const resetBtn = document.getElementById("resetBtn");

const totalData = document.getElementById("totalData");
const activeLokasi = document.getElementById("activeLokasi");

const sumLokasi = document.getElementById("sumLokasi");
const sumPemutus = document.getElementById("sumPemutus");
const sumCt = document.getElementById("sumCt");
const sumRelay = document.getElementById("sumRelay");
const sumBeban = document.getElementById("sumBeban");

const infoGrid = document.getElementById("infoGrid");
const zoneGrid = document.getElementById("zoneGrid");
const ocrRow = document.getElementById("ocrRow");
const gfrRow = document.getElementById("gfrRow");
const extraBox = document.getElementById("extraBox");
const tableBody = document.getElementById("tableBody");

/* =========================================================
   LOAD DATA DARI APPS SCRIPT
========================================================= */
async function loadData() {
  try {
    const res = await fetch(API_URL);
    const json = await res.json();

    // format response dari Apps Script:
    // { success: true/false, total: n, data: [...] }

    if (!json.success) {
      throw new Error(json.error || "Apps Script tidak mengembalikan data");
    }

    rawData = json.data || [];
    filteredData = [...rawData];

    buildFilters(rawData);
    renderTable(filteredData);
    updateCounters(filteredData);

    if (filteredData.length > 0) {
      showDetail(filteredData[0]);
    } else {
      clearDetail();
    }

  } catch (err) {
    console.error("Load data error:", err);
    tableBody.innerHTML = `
      <tr>
        <td colspan="10" style="padding:20px;color:red;text-align:center;">
          Gagal memuat data: ${err.message}
        </td>
      </tr>
    `;
  }
}

/* =========================================================
   BUILD FILTER DROPDOWN
========================================================= */
function buildFilters(data) {
  const lokasiSet = new Set();
  const pemutusSet = new Set();

  data.forEach(d => {
    if (d.lokasi) lokasiSet.add(d.lokasi);
    if (d.pemutus) pemutusSet.add(d.pemutus);
  });

  lokasiFilter.innerHTML = `<option value="">Semua Lokasi</option>`;
  [...lokasiSet].sort().forEach(v => {
    lokasiFilter.innerHTML += `<option value="${v}">${v}</option>`;
  });

  pemutusFilter.innerHTML = `<option value="">Semua Pemutus</option>`;
  [...pemutusSet].sort().forEach(v => {
    pemutusFilter.innerHTML += `<option value="${v}">${v}</option>`;
  });
}

/* =========================================================
   FILTER DATA
========================================================= */
function applyFilters() {
  const lokasiVal = lokasiFilter.value.toLowerCase();
  const pemutusVal = pemutusFilter.value.toLowerCase();
  const keyword = searchInput.value.toLowerCase();

  filteredData = rawData.filter(item => {
    const matchLokasi =
      !lokasiVal || (item.lokasi || "").toLowerCase().includes(lokasiVal);

    const matchPemutus =
      !pemutusVal || (item.pemutus || "").toLowerCase().includes(pemutusVal);

    const searchable = Object.values(item).join(" ").toLowerCase();
    const matchKeyword = !keyword || searchable.includes(keyword);

    return matchLokasi && matchPemutus && matchKeyword;
  });

  renderTable(filteredData);
  updateCounters(filteredData);

  if (filteredData.length > 0) {
    showDetail(filteredData[0]);
  } else {
    clearDetail();
  }
}

/* =========================================================
   RENDER TABEL
========================================================= */
function renderTable(data) {
  if (!data.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="10" style="padding:20px;text-align:center;">
          Data tidak ditemukan
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = data.map((d, i) => `
    <tr data-index="${i}">
      <td>${d.no || ""}</td>
      <td>${d.lokasi || ""}</td>
      <td>${d.pemutus || ""}</td>
      <td>${d.merek || ""}</td>
      <td>${d.tipe || ""}</td>
      <td>${d.ct_ratio || ""}</td>
      <td>${d.relay || ""}</td>
      <td>${d.beban_kw || ""}</td>
      <td>${d.ocr_i || ""}</td>
      <td>${d.gfr_i || ""}</td>
    </tr>
  `).join("");

  document.querySelectorAll("#tableBody tr").forEach((row, idx) => {
    row.addEventListener("click", () => showDetail(data[idx]));
  });
}

/* =========================================================
   TAMPILKAN DETAIL DATA TERPILIH
========================================================= */
function showDetail(d) {
  activeLokasi.textContent = d.lokasi || "-";

  sumLokasi.textContent = d.lokasi || "-";
  sumPemutus.textContent = d.pemutus || "-";
  sumCt.textContent = d.ct_ratio || "-";
  sumRelay.textContent = d.relay || "-";
  sumBeban.textContent = d.beban_kw || "-";

  infoGrid.innerHTML = `
    <div class="info-item"><span>Lokasi</span><strong>${d.lokasi || "-"}</strong></div>
    <div class="info-item"><span>Pemutus</span><strong>${d.pemutus || "-"}</strong></div>
    <div class="info-item"><span>Merek</span><strong>${d.merek || "-"}</strong></div>
    <div class="info-item"><span>Tipe</span><strong>${d.tipe || "-"}</strong></div>
    <div class="info-item"><span>CT Ratio</span><strong>${d.ct_ratio || "-"}</strong></div>
    <div class="info-item"><span>Relay</span><strong>${d.relay || "-"}</strong></div>
    <div class="info-item"><span>Beban (kW)</span><strong>${d.beban_kw || "-"}</strong></div>
  `;

  zoneGrid.innerHTML = `
    <div class="zone">Z1: ${d.z1 || "-"}</div>
    <div class="zone">Z2: ${d.z2 || "-"}</div>
    <div class="zone">Z3: ${d.z3 || "-"}</div>
    <div class="zone">Z4: ${d.z4 || "-"}</div>
    <div class="zone">Z5: ${d.z5 || "-"}</div>
    <div class="zone">Z6: ${d.z6 || "-"}</div>
  `;

  ocrRow.innerHTML = `
    <td>${d.ocr_i || "-"}</td>
    <td>${d.ocr_tms || "-"}</td>
    <td>${d.ocr_curve || "-"}</td>
    <td>${d.ocr_ii || "-"}</td>
    <td>${d.ocr_delay || "-"}</td>
    <td>${d.ocr_curve_hs || "-"}</td>
  `;

  gfrRow.innerHTML = `
    <td>${d.gfr_i || "-"}</td>
    <td>${d.gfr_tms || "-"}</td>
    <td>${d.gfr_curve || "-"}</td>
    <td>${d.gfr_ii || "-"}</td>
    <td>${d.gfr_delay || "-"}</td>
    <td>${d.gfr_curve_hs || "-"}</td>
  `;

  extraBox.textContent = d.proteksi_tambahan || "Tidak ada proteksi tambahan";
}

/* =========================================================
   CLEAR DETAIL
========================================================= */
function clearDetail() {
  activeLokasi.textContent = "-";

  sumLokasi.textContent = "-";
  sumPemutus.textContent = "-";
  sumCt.textContent = "-";
  sumRelay.textContent = "-";
  sumBeban.textContent = "-";

  infoGrid.innerHTML = `
    <div class="info-item"><span>Lokasi</span><strong>-</strong></div>
    <div class="info-item"><span>Pemutus</span><strong>-</strong></div>
    <div class="info-item"><span>Merek</span><strong>-</strong></div>
    <div class="info-item"><span>Tipe</span><strong>-</strong></div>
    <div class="info-item"><span>CT Ratio</span><strong>-</strong></div>
    <div class="info-item"><span>Relay</span><strong>-</strong></div>
    <div class="info-item"><span>Beban (kW)</span><strong>-</strong></div>
  `;

  zoneGrid.innerHTML = `
    <div class="zone">Z1: -</div>
    <div class="zone">Z2: -</div>
    <div class="zone">Z3: -</div>
    <div class="zone">Z4: -</div>
    <div class="zone">Z5: -</div>
    <div class="zone">Z6: -</div>
  `;

  ocrRow.innerHTML = `<td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td>`;
  gfrRow.innerHTML = `<td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td>`;
  extraBox.textContent = "Belum ada data";
}

/* =========================================================
   COUNTER
========================================================= */
function updateCounters(data) {
  totalData.textContent = data.length;
}

/* =========================================================
   RESET FILTER
========================================================= */
function resetFilters() {
  lokasiFilter.value = "";
  pemutusFilter.value = "";
  searchInput.value = "";

  filteredData = [...rawData];
  renderTable(filteredData);
  updateCounters(filteredData);

  if (filteredData.length > 0) {
    showDetail(filteredData[0]);
  } else {
    clearDetail();
  }
}

/* =========================================================
   EVENT LISTENER
========================================================= */
lokasiFilter.addEventListener("change", applyFilters);
pemutusFilter.addEventListener("change", applyFilters);
searchInput.addEventListener("input", applyFilters);
resetBtn.addEventListener("click", resetFilters);

/* =========================================================
   INIT
========================================================= */
loadData();
