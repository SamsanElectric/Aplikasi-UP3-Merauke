const SHEET_API = "https://docs.google.com/spreadsheets/d/124-TV0rQEl1tmTaOEP-zlWY1Y4QdphhYENoWn-W-z58/gviz/tq?tqx=out:json&gid=1762573641";

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
const mobileList = document.getElementById("mobileList");

const statusOCR = document.getElementById("statusOCR");
const statusGFR = document.getElementById("statusGFR");
const statusCT = document.getElementById("statusCT");
const statusExtra = document.getElementById("statusExtra");

/* =========================
   HELPERS
========================= */
function safe(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function sortAlpha(a, b) {
  return a.localeCompare(b, "id", { sensitivity: "base", numeric: true });
}

function getSearchBlob(item) {
  return Object.values(item).map(safe).join(" ").toLowerCase();
}

function highlightRowByIndex(idx) {
  document.querySelectorAll("#tableBody tr").forEach((tr) => {
    tr.classList.remove("active-row");
  });

  const active = document.querySelector(`#tableBody tr[data-index="${idx}"]`);
  if (active) active.classList.add("active-row");
}

/* =========================
   PARSE GOOGLE SHEET GVIZ
========================= */
function parseGvizResponse(text) {
  // format gviz: google.visualization.Query.setResponse({...});
  const jsonText = text
    .replace("google.visualization.Query.setResponse(", "")
    .replace(/\);$/, "");

  const obj = JSON.parse(jsonText);
  const rows = obj.table.rows || [];

  // ambil data dari row ke-3 dst (baris 1-2 header)
  const result = [];

  rows.forEach((row, idx) => {
    const cells = (row.c || []).map(c => (c && c.v !== null && c.v !== undefined) ? String(c.v) : "");

    // skip 2 baris header awal
    if (idx < 2) return;

    const no = safe(cells[0]);
    const lokasi = safe(cells[1]);

    const z1 = safe(cells[2]);
    const z2 = safe(cells[3]);
    const z3 = safe(cells[4]);
    const z4 = safe(cells[5]);
    const z5 = safe(cells[6]);
    const z6 = safe(cells[7]);

    const merek = safe(cells[8]);
    const tipe = safe(cells[9]);
    const pemutus = safe(cells[10]);
    const ct_ratio = safe(cells[11]);
    const relay = safe(cells[12]);
    const beban_kw = safe(cells[13]);

    const ocr_i = safe(cells[14]);
    const ocr_tms = safe(cells[15]);
    const ocr_curve = safe(cells[16]);
    const ocr_ii = safe(cells[17]);
    const ocr_delay = safe(cells[18]);
    const ocr_curve_hs = safe(cells[19]);

    const gfr_i = safe(cells[20]);
    const gfr_tms = safe(cells[21]);
    const gfr_curve = safe(cells[22]);
    const gfr_ii = safe(cells[23]);
    const gfr_delay = safe(cells[24]);
    const gfr_curve_hs = safe(cells[25]);

    const proteksi_tambahan = safe(cells[26]);

    // skip baris kosong
    const gabung = cells.join("").trim();
    if (!gabung) return;

    // skip baris header internal yang ikut kebaca
    if (
      lokasi === "Z1" ||
      z1 === "Z2" ||
      z2 === "Z3" ||
      z3 === "Z4" ||
      z4 === "Z5" ||
      z5 === "Z6" ||
      z6 === "MEREK"
    ) {
      return;
    }

    // tentukan nama lokasi aktif
    let nama_lokasi = "";
    let zona_aktif = "";

    if (lokasi) {
      nama_lokasi = lokasi;
      zona_aktif = "LOKASI";
    } else if (z1) {
      nama_lokasi = z1;
      zona_aktif = "Z1";
    } else if (z2) {
      nama_lokasi = z2;
      zona_aktif = "Z2";
    } else if (z3) {
      nama_lokasi = z3;
      zona_aktif = "Z3";
    } else if (z4) {
      nama_lokasi = z4;
      zona_aktif = "Z4";
    } else if (z5) {
      nama_lokasi = z5;
      zona_aktif = "Z5";
    } else if (z6) {
      nama_lokasi = z6;
      zona_aktif = "Z6";
    }

    if (!nama_lokasi) return;

    result.push({
      no,
      nama_lokasi,
      zona_aktif,
      lokasi,
      z1, z2, z3, z4, z5, z6,
      merek,
      tipe,
      pemutus,
      ct_ratio,
      relay,
      beban_kw,
      ocr_i,
      ocr_tms,
      ocr_curve,
      ocr_ii,
      ocr_delay,
      ocr_curve_hs,
      gfr_i,
      gfr_tms,
      gfr_curve,
      gfr_ii,
      gfr_delay,
      gfr_curve_hs,
      proteksi_tambahan
    });
  });

  return result;
}

/* =========================
   LOAD DATA
========================= */
async function loadData() {
  try {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" style="padding:18px;text-align:center;">Memuat data...</td>
      </tr>
    `;

    const res = await fetch(SHEET_API);
    const text = await res.text();

    rawData = parseGvizResponse(text);
    filteredData = [...rawData];

    buildFilters(rawData);
    renderTable(filteredData);
    renderMobileList(filteredData);
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
        <td colspan="8" style="padding:20px;color:red;text-align:center;">
          Gagal memuat data: ${err.message}
        </td>
      </tr>
    `;
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
  renderMobileList(filteredData);
  updateCounters(filteredData);

  if (filteredData.length > 0) {
    selectedIndex = 0;
    showDetail(filteredData[0], 0);
  } else {
    clearDetail();
  }
}

/* =========================
   TABLE + MOBILE
========================= */
function renderTable(data) {
  if (!tableBody) return;

  if (!data.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" style="padding:20px;text-align:center;">Data tidak ditemukan</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = data.map((d, i) => `
    <tr data-index="${i}">
      <td>${d.no || i + 1}</td>
      <td>${d.nama_lokasi || "-"}</td>
      <td>${d.zona_aktif || "-"}</td>
      <td>${d.pemutus || "-"}</td>
      <td>${d.merek || "-"}</td>
      <td>${d.relay || "-"}</td>
      <td>${d.ocr_i || "-"}</td>
      <td>${d.gfr_i || "-"}</td>
    </tr>
  `).join("");

  document.querySelectorAll("#tableBody tr").forEach((row, idx) => {
    row.addEventListener("click", () => {
      selectedIndex = idx;
      showDetail(data[idx], idx);
    });
  });

  highlightRowByIndex(selectedIndex);
}

function renderMobileList(data) {
  if (!mobileList) return;
  if (!data.length) {
    mobileList.innerHTML = `<div class="mobile-card">Data tidak ditemukan</div>`;
    return;
  }

  mobileList.innerHTML = data.map((d, i) => `
    <div class="mobile-card" data-index="${i}">
      <div class="mobile-title">${d.nama_lokasi || "-"}</div>
      <div class="mobile-meta">
        <span>${d.zona_aktif || "-"}</span>
        <span>${d.pemutus || "-"}</span>
      </div>
      <div class="mobile-sub">OCR: ${d.ocr_i || "-"} | GFR: ${d.gfr_i || "-"}</div>
    </div>
  `).join("");

  mobileList.querySelectorAll(".mobile-card").forEach((card, idx) => {
    card.addEventListener("click", () => {
      selectedIndex = idx;
      showDetail(data[idx], idx);
    });
  });
}

/* =========================
   DETAIL
========================= */
function showDetail(d, idx = 0) {
  if (!d) return clearDetail();

  selectedIndex = idx;

  if (activeLokasi) activeLokasi.textContent = d.nama_lokasi || "-";
  if (sumLokasi) sumLokasi.textContent = d.nama_lokasi || "-";
  if (sumPemutus) sumPemutus.textContent = d.pemutus || "-";
  if (sumCt) sumCt.textContent = `CT ${d.ct_ratio || "-"}`;
  if (sumRelay) sumRelay.textContent = `Relay ${d.relay || "-"}`;
  if (sumBeban) sumBeban.textContent = `Beban ${d.beban_kw || "-"}`;
  if (sumZona) sumZona.textContent = `Zona ${d.zona_aktif || "-"}`;

  if (statusOCR) statusOCR.textContent = d.ocr_i ? "TERISI" : "KOSONG";
  if (statusGFR) statusGFR.textContent = d.gfr_i ? "TERISI" : "KOSONG";
  if (statusCT) statusCT.textContent = d.ct_ratio ? d.ct_ratio : "KOSONG";
  if (statusExtra) statusExtra.textContent = d.proteksi_tambahan ? "ADA" : "TIDAK ADA";

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
   CLEAR
========================= */
function clearDetail() {
  if (activeLokasi) activeLokasi.textContent = "-";
  if (sumLokasi) sumLokasi.textContent = "-";
  if (sumPemutus) sumPemutus.textContent = "-";
  if (sumCt) sumCt.textContent = "-";
  if (sumRelay) sumRelay.textContent = "-";
  if (sumBeban) sumBeban.textContent = "-";
  if (sumZona) sumZona.textContent = "-";
  if (statusOCR) statusOCR.textContent = "-";
  if (statusGFR) statusGFR.textContent = "-";
  if (statusCT) statusCT.textContent = "-";
  if (statusExtra) statusExtra.textContent = "-";
}

/* =========================
   COUNTER / RESET
========================= */
function updateCounters(data) {
  if (totalData) totalData.textContent = data.length;
}

function resetFilters() {
  if (lokasiFilter) lokasiFilter.value = "";
  if (pemutusFilter) pemutusFilter.value = "";
  if (zonaFilter) zonaFilter.value = "";
  if (searchInput) searchInput.value = "";

  filteredData = [...rawData];
  renderTable(filteredData);
  renderMobileList(filteredData);
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
