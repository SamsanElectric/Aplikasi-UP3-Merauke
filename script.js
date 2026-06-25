const API_URL = "https://script.google.com/macros/s/AKfycbzOGS_rPVO-FVI4a947A7uygoewm_aBNxaUoRh_ApI-ySsXnPooWd2jasUJJ_pAZ_-c/exec";

let rawData = [];
let filteredData = [];
let selectedIndex = 0;

/* =========================
   ELEMENTS
========================= */
const lokasiFilter = document.getElementById("lokasiFilter");
const pemutusFilter = document.getElementById("pemutusFilter");
const zonaFilter = document.getElementById("zonaFilter");
const searchInput = document.getElementById("searchInput");
const resetBtn = document.getElementById("resetBtn");

const totalData = document.getElementById("totalData");
const activeLokasi = document.getElementById("activeLokasi");

const sumLokasi = document.getElementById("sumLokasi");
const sumPemutus = document.getElementById("sumPemutus");
const sumCt = document.getElementById("sumCt");
const sumRelay = document.getElementById("sumRelay");
const sumBeban = document.getElementById("sumBeban");
const sumZona = document.getElementById("sumZona");

const infoGrid = document.getElementById("infoGrid");
const zoneGrid = document.getElementById("zoneGrid");
const ocrRow = document.getElementById("ocrRow");
const gfrRow = document.getElementById("gfrRow");
const extraBox = document.getElementById("extraBox");
const tableBody = document.getElementById("tableBody");

/* =========================
   HELPERS
========================= */
function safe(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function numLike(v) {
  return safe(v).replace(/\./g, "").replace(",", ".");
}

function sortAlpha(a, b) {
  return a.localeCompare(b, "id", { sensitivity: "base", numeric: true });
}

function getSearchBlob(item) {
  return [
    item.no,
    item.nama_lokasi,
    item.zona_aktif,
    item.lokasi,
    item.z1,
    item.z2,
    item.z3,
    item.z4,
    item.z5,
    item.z6,
    item.merek,
    item.tipe,
    item.pemutus,
    item.ct_ratio,
    item.relay,
    item.beban_kw,
    item.ocr_i,
    item.ocr_tms,
    item.ocr_curve,
    item.ocr_ii,
    item.ocr_delay,
    item.ocr_curve_hs,
    item.gfr_i,
    item.gfr_tms,
    item.gfr_curve,
    item.gfr_ii,
    item.gfr_delay,
    item.gfr_curve_hs,
    item.proteksi_tambahan
  ]
    .map(safe)
    .join(" ")
    .toLowerCase();
}

function highlightRowByIndex(idx) {
  document.querySelectorAll("#tableBody tr").forEach((tr) => {
    tr.classList.remove("active-row");
  });

  const active = document.querySelector(`#tableBody tr[data-index="${idx}"]`);
  if (active) active.classList.add("active-row");
}

function normalizeData(data) {
  return (data || []).map((d, i) => ({
    _id: i + 1,
    no: safe(d.no),
    nama_lokasi: safe(d.nama_lokasi || d.lokasi),
    zona_aktif: safe(d.zona_aktif),
    lokasi: safe(d.lokasi),
    z1: safe(d.z1),
    z2: safe(d.z2),
    z3: safe(d.z3),
    z4: safe(d.z4),
    z5: safe(d.z5),
    z6: safe(d.z6),
    merek: safe(d.merek),
    tipe: safe(d.tipe),
    pemutus: safe(d.pemutus),
    ct_ratio: safe(d.ct_ratio),
    relay: safe(d.relay),
    beban_kw: safe(d.beban_kw),
    ocr_i: safe(d.ocr_i),
    ocr_tms: safe(d.ocr_tms),
    ocr_curve: safe(d.ocr_curve),
    ocr_ii: safe(d.ocr_ii),
    ocr_delay: safe(d.ocr_delay),
    ocr_curve_hs: safe(d.ocr_curve_hs),
    gfr_i: safe(d.gfr_i),
    gfr_tms: safe(d.gfr_tms),
    gfr_curve: safe(d.gfr_curve),
    gfr_ii: safe(d.gfr_ii),
    gfr_delay: safe(d.gfr_delay),
    gfr_curve_hs: safe(d.gfr_curve_hs),
    proteksi_tambahan: safe(d.proteksi_tambahan)
  }));
}

/* =========================
   LOAD DATA
========================= */
async function loadData() {
  try {
    tableBody.innerHTML = `
      <tr>
        <td colspan="11" style="padding:18px;text-align:center;">Memuat data...</td>
      </tr>
    `;

    const res = await fetch(API_URL, { method: "GET" });
    const json = await res.json();

    if (!json.success) {
      throw new Error(json.error || "Apps Script tidak mengembalikan data");
    }

    rawData = normalizeData(json.data || []);
    filteredData = [...rawData];

    buildFilters(rawData);
    renderTable(filteredData);
    updateCounters(filteredData);

    if (filteredData.length > 0) {
      selectedIndex = 0;
      showDetail(filteredData[0], 0);
    } else {
      clearDetail();
    }
  } catch (err) {
    console.error("Load data error:", err);
    tableBody.innerHTML = `
      <tr>
        <td colspan="11" style="padding:20px;color:red;text-align:center;">
          Gagal memuat data: ${err.message}
        </td>
      </tr>
    `;
    clearDetail();
  }
}

/* =========================
   BUILD FILTERS
========================= */
function buildFilters(data) {
  const lokasiSet = new Set();
  const pemutusSet = new Set();
  const zonaSet = new Set();

  data.forEach((d) => {
    if (d.nama_lokasi) lokasiSet.add(d.nama_lokasi);
    if (d.pemutus) pemutusSet.add(d.pemutus);
    if (d.zona_aktif) zonaSet.add(d.zona_aktif);
  });

  if (lokasiFilter) {
    lokasiFilter.innerHTML = `<option value="">Semua Lokasi / Recloser</option>`;
    [...lokasiSet].sort(sortAlpha).forEach((v) => {
      lokasiFilter.innerHTML += `<option value="${v}">${v}</option>`;
    });
  }

  if (pemutusFilter) {
    pemutusFilter.innerHTML = `<option value="">Semua Pemutus</option>`;
    [...pemutusSet].sort(sortAlpha).forEach((v) => {
      pemutusFilter.innerHTML += `<option value="${v}">${v}</option>`;
    });
  }

  if (zonaFilter) {
    zonaFilter.innerHTML = `<option value="">Semua Zona</option>`;
    [...zonaSet].sort(sortAlpha).forEach((v) => {
      zonaFilter.innerHTML += `<option value="${v}">${v}</option>`;
    });
  }
}

/* =========================
   FILTER
========================= */
function applyFilters() {
  const lokasiVal = lokasiFilter ? lokasiFilter.value.toLowerCase() : "";
  const pemutusVal = pemutusFilter ? pemutusFilter.value.toLowerCase() : "";
  const zonaVal = zonaFilter ? zonaFilter.value.toLowerCase() : "";
  const keyword = searchInput ? searchInput.value.toLowerCase() : "";

  filteredData = rawData.filter((item) => {
    const matchLokasi =
      !lokasiVal || safe(item.nama_lokasi).toLowerCase().includes(lokasiVal);

    const matchPemutus =
      !pemutusVal || safe(item.pemutus).toLowerCase().includes(pemutusVal);

    const matchZona =
      !zonaVal || safe(item.zona_aktif).toLowerCase().includes(zonaVal);

    const matchKeyword =
      !keyword || getSearchBlob(item).includes(keyword);

    return matchLokasi && matchPemutus && matchZona && matchKeyword;
  });

  renderTable(filteredData);
  updateCounters(filteredData);

  if (filteredData.length > 0) {
    selectedIndex = 0;
    showDetail(filteredData[0], 0);
  } else {
    clearDetail();
  }
}

/* =========================
   TABLE
========================= */
function renderTable(data) {
  if (!tableBody) return;

  if (!data.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="11" style="padding:20px;text-align:center;">
          Data tidak ditemukan
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = data
    .map((d, i) => {
      return `
        <tr data-index="${i}">
          <td>${d.no || i + 1}</td>
          <td>${d.nama_lokasi || "-"}</td>
          <td>${d.zona_aktif || "-"}</td>
          <td>${d.pemutus || "-"}</td>
          <td>${d.merek || "-"}</td>
          <td>${d.tipe || "-"}</td>
          <td>${d.ct_ratio || "-"}</td>
          <td>${d.relay || "-"}</td>
          <td>${d.beban_kw || "-"}</td>
          <td>${d.ocr_i || "-"}</td>
          <td>${d.gfr_i || "-"}</td>
        </tr>
      `;
    })
    .join("");

  document.querySelectorAll("#tableBody tr").forEach((row, idx) => {
    row.addEventListener("click", () => {
      selectedIndex = idx;
      showDetail(data[idx], idx);
    });
  });

  highlightRowByIndex(selectedIndex);
}

/* =========================
   DETAIL PANEL
========================= */
function showDetail(d, idx = 0) {
  if (!d) {
    clearDetail();
    return;
  }

  selectedIndex = idx;

  if (activeLokasi) activeLokasi.textContent = d.nama_lokasi || "-";
  if (sumLokasi) sumLokasi.textContent = d.nama_lokasi || "-";
  if (sumPemutus) sumPemutus.textContent = d.pemutus || "-";
  if (sumCt) sumCt.textContent = d.ct_ratio || "-";
  if (sumRelay) sumRelay.textContent = d.relay || "-";
  if (sumBeban) sumBeban.textContent = d.beban_kw || "-";
  if (sumZona) sumZona.textContent = d.zona_aktif || "-";

  if (infoGrid) {
    infoGrid.innerHTML = `
      <div class="info-item"><span>Lokasi / Recloser</span><strong>${d.nama_lokasi || "-"}</strong></div>
      <div class="info-item"><span>Zona Aktif</span><strong>${d.zona_aktif || "-"}</strong></div>
      <div class="info-item"><span>Pemutus</span><strong>${d.pemutus || "-"}</strong></div>
      <div class="info-item"><span>Merek</span><strong>${d.merek || "-"}</strong></div>
      <div class="info-item"><span>Tipe</span><strong>${d.tipe || "-"}</strong></div>
      <div class="info-item"><span>CT Ratio</span><strong>${d.ct_ratio || "-"}</strong></div>
      <div class="info-item"><span>Relay / Arus</span><strong>${d.relay || "-"}</strong></div>
      <div class="info-item"><span>Beban (kW)</span><strong>${d.beban_kw || "-"}</strong></div>
    `;
  }

  if (zoneGrid) {
    zoneGrid.innerHTML = `
      <div class="zone ${d.z1 ? "filled" : ""}"><span>Z1</span><strong>${d.z1 || "-"}</strong></div>
      <div class="zone ${d.z2 ? "filled" : ""}"><span>Z2</span><strong>${d.z2 || "-"}</strong></div>
      <div class="zone ${d.z3 ? "filled" : ""}"><span>Z3</span><strong>${d.z3 || "-"}</strong></div>
      <div class="zone ${d.z4 ? "filled" : ""}"><span>Z4</span><strong>${d.z4 || "-"}</strong></div>
      <div class="zone ${d.z5 ? "filled" : ""}"><span>Z5</span><strong>${d.z5 || "-"}</strong></div>
      <div class="zone ${d.z6 ? "filled" : ""}"><span>Z6</span><strong>${d.z6 || "-"}</strong></div>
    `;
  }

  if (ocrRow) {
    ocrRow.innerHTML = `
      <td>${d.ocr_i || "-"}</td>
      <td>${d.ocr_tms || "-"}</td>
      <td>${d.ocr_curve || "-"}</td>
      <td>${d.ocr_ii || "-"}</td>
      <td>${d.ocr_delay || "-"}</td>
      <td>${d.ocr_curve_hs || "-"}</td>
    `;
  }

  if (gfrRow) {
    gfrRow.innerHTML = `
      <td>${d.gfr_i || "-"}</td>
      <td>${d.gfr_tms || "-"}</td>
      <td>${d.gfr_curve || "-"}</td>
      <td>${d.gfr_ii || "-"}</td>
      <td>${d.gfr_delay || "-"}</td>
      <td>${d.gfr_curve_hs || "-"}</td>
    `;
  }

  if (extraBox) {
    extraBox.textContent = d.proteksi_tambahan || "Tidak ada proteksi tambahan";
  }

  highlightRowByIndex(idx);
}

/* =========================
   CLEAR DETAIL
========================= */
function clearDetail() {
  if (activeLokasi) activeLokasi.textContent = "-";
  if (sumLokasi) sumLokasi.textContent = "-";
  if (sumPemutus) sumPemutus.textContent = "-";
  if (sumCt) sumCt.textContent = "-";
  if (sumRelay) sumRelay.textContent = "-";
  if (sumBeban) sumBeban.textContent = "-";
  if (sumZona) sumZona.textContent = "-";

  if (infoGrid) {
    infoGrid.innerHTML = `
      <div class="info-item"><span>Lokasi / Recloser</span><strong>-</strong></div>
      <div class="info-item"><span>Zona Aktif</span><strong>-</strong></div>
      <div class="info-item"><span>Pemutus</span><strong>-</strong></div>
      <div class="info-item"><span>Merek</span><strong>-</strong></div>
      <div class="info-item"><span>Tipe</span><strong>-</strong></div>
      <div class="info-item"><span>CT Ratio</span><strong>-</strong></div>
      <div class="info-item"><span>Relay / Arus</span><strong>-</strong></div>
      <div class="info-item"><span>Beban (kW)</span><strong>-</strong></div>
    `;
  }

  if (zoneGrid) {
    zoneGrid.innerHTML = `
      <div class="zone"><span>Z1</span><strong>-</strong></div>
      <div class="zone"><span>Z2</span><strong>-</strong></div>
      <div class="zone"><span>Z3</span><strong>-</strong></div>
      <div class="zone"><span>Z4</span><strong>-</strong></div>
      <div class="zone"><span>Z5</span><strong>-</strong></div>
      <div class="zone"><span>Z6</span><strong>-</strong></div>
    `;
  }

  if (ocrRow) {
    ocrRow.innerHTML = `<td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td>`;
  }

  if (gfrRow) {
    gfrRow.innerHTML = `<td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td>`;
  }

  if (extraBox) {
    extraBox.textContent = "Belum ada data";
  }
}

/* =========================
   COUNTER
========================= */
function updateCounters(data) {
  if (totalData) totalData.textContent = data.length;
}

/* =========================
   RESET
========================= */
function resetFilters() {
  if (lokasiFilter) lokasiFilter.value = "";
  if (pemutusFilter) pemutusFilter.value = "";
  if (zonaFilter) zonaFilter.value = "";
  if (searchInput) searchInput.value = "";

  filteredData = [...rawData];
  renderTable(filteredData);
  updateCounters(filteredData);

  if (filteredData.length > 0) {
    selectedIndex = 0;
    showDetail(filteredData[0], 0);
  } else {
    clearDetail();
  }
}

/* =========================
   EVENTS
========================= */
if (lokasiFilter) lokasiFilter.addEventListener("change", applyFilters);
if (pemutusFilter) pemutusFilter.addEventListener("change", applyFilters);
if (zonaFilter) zonaFilter.addEventListener("change", applyFilters);
if (searchInput) searchInput.addEventListener("input", applyFilters);
if (resetBtn) resetBtn.addEventListener("click", resetFilters);

/* =========================
   INIT
========================= */
loadData();
