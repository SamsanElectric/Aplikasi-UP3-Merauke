#!/usr/bin/env python3
"""
Peringatan cuaca ringkas untuk tim teknik - Kurik, Merauke
Alur: BMKG (data terbuka) -> olah jadi pesan ringkas -> kirim ke WhatsApp Group via Fonnte

Dijalankan otomatis lewat GitHub Actions (lihat .github/workflows/weather-alert.yml),
BUKAN dari sesi Claude - sesi cloud Claude diblokir mengakses domain BMKG/Fonnte secara
langsung, jadi eksekusi harus terjadi di runner GitHub Actions.

Environment variable yang dibutuhkan (diisi lewat GitHub Secrets):
- FONNTE_TOKEN   : token device Fonnte Anda
- WAG_TARGET     : ID grup WhatsApp tujuan (format: 120363xxxxxxxxx@g.us)
- BMKG_ADM4      : kode wilayah BMKG (default: Kurik, Merauke = 93.01.11.2002)
"""

import os
import sys
from datetime import datetime, timezone, timedelta
import requests

WIT = timezone(timedelta(hours=9))  # Asia/Jayapura, tidak kenal DST

BMKG_ADM4 = os.environ.get("BMKG_ADM4", "93.01.11.2002")  # Kurik, Merauke
FONNTE_TOKEN = os.environ.get("FONNTE_TOKEN", "")
WAG_TARGET = os.environ.get("WAG_TARGET", "")

WIND_WARNING_MS = 10.0   # waspada
WIND_DANGER_MS = 15.0    # bahaya
RAIN_KEYWORDS = ["Hujan", "Petir"]

BMKG_URL = f"https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4={BMKG_ADM4}"
FONNTE_URL = "https://api.fonnte.com/send"


def ambil_data_cuaca():
    """Ambil data prakiraan cuaca BMKG untuk lokasi target.

    Struktur ASLI dari api.bmkg.go.id/publik/prakiraan-cuaca (dikonfirmasi dari contoh JSON
    resmi di github.com/infoBMKG/data-cuaca):

        {
          "lokasi": {...ringkasan lokasi di level root...},
          "data": [
            {
              "lokasi": {...detail lokasi...},
              "cuaca": [ [entry per-3-jam hari-1], [entry hari-2], [entry hari-3] ]
            }
          ]
        }

    'cuaca' ada di dalam data[0], BUKAN langsung di root. 'data' adalah list per-hari,
    tiap hari berisi entry per-3-jam. Kita ratakan (flatten) semua entry jadi satu list
    kronologis.
    """
    resp = requests.get(BMKG_URL, timeout=20)
    resp.raise_for_status()
    payload = resp.json()

    data_arr = payload.get("data", [])
    blok = data_arr[0] if data_arr else {}

    lokasi = blok.get("lokasi", payload.get("lokasi", {}))
    hari_list = blok.get("cuaca", [])
    entries = [item for hari in hari_list for item in hari]
    return lokasi, entries


def evaluasi_risiko(entries):
    """Tandai setiap entry dengan level risiko berdasarkan ambang angin & kondisi hujan."""
    hasil = []
    for e in entries:
        angin = float(e.get("ws", 0) or 0)
        cuaca = e.get("weather_desc", "") or ""
        level = "normal"
        if angin >= WIND_DANGER_MS or "Petir" in cuaca:
            level = "bahaya"
        elif angin >= WIND_WARNING_MS or "Hujan" in cuaca:
            level = "waspada"
        hasil.append({**e, "alert_level": level})
    return hasil


WEATHER_ICON = {
    "Cerah": "☀️",
    "Cerah Berawan": "🌤️",
    "Berawan": "⛅",
    "Berawan Tebal": "☁️",
    "Udara Kabur": "🌫️",
    "Asap": "🌫️",
    "Kabut": "🌫️",
    "Hujan Ringan": "🌦️",
    "Hujan Lokal": "🌦️",
    "Hujan Sedang": "🌧️",
    "Hujan Lebat": "🌧️",
    "Hujan Petir": "⛈️",
    "Petir": "⛈️",
}


def ikon_cuaca(weather_desc):
    return WEATHER_ICON.get((weather_desc or "").strip(), "🌡️")


def ikon_level(level):
    return {"bahaya": "🔴", "waspada": "🟡", "normal": "🟢"}.get(level, "⚪")


BULAN_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]


def _tanggal_jam(dt_str):
    """Pecah 'YYYY-MM-DD HH:MM:SS' jadi (tanggal 'YYYY-MM-DD', label 'DD Bln', jam 'HH:MM')."""
    dt_str = dt_str or ""
    tanggal = dt_str[:10]
    jam = dt_str[11:16] if len(dt_str) >= 16 else "?"
    try:
        d = datetime.strptime(tanggal, "%Y-%m-%d")
        label_tanggal = f"{d.day} {BULAN_ID[d.month - 1]}"
    except ValueError:
        label_tanggal = tanggal
    return tanggal, label_tanggal, jam


def format_entry(e, tanggal_acuan=None):
    """Format satu entry cuaca. Kalau tanggalnya beda dari tanggal_acuan (atau tanggal_acuan
    None -> selalu tampil), tanggal ikut ditampilkan di depan jam."""
    icon = ikon_cuaca(e.get("weather_desc"))
    tanggal, label_tanggal, jam = _tanggal_jam(e.get("local_datetime"))
    prefix_tanggal = f"{label_tanggal}, " if (tanggal_acuan is None or tanggal != tanggal_acuan) else ""
    return (
        f"{icon} {prefix_tanggal}{jam} WIT — {e.get('weather_desc', '?')}, "
        f"🌡️ {e.get('t', '?')}°C, 💨 {e.get('ws', '?')} m/s ({e.get('wd', '?')}), "
        f"💧 {e.get('hu', '?')}%"
    )


def risiko_tertinggi_per_hari(entries_risiko):
    """Dari entry-entry berisiko (level 'bahaya'), ambil satu yang paling parah (angin
    tertinggi) untuk tiap tanggal, supaya tidak menumpuk banyak baris di hari yang sama."""
    per_hari = {}
    for e in entries_risiko:
        tanggal, _, _ = _tanggal_jam(e.get("local_datetime"))
        angin = float(e.get("ws", 0) or 0)
        terbaik = per_hari.get(tanggal)
        if terbaik is None or angin > float(terbaik.get("ws", 0) or 0):
            per_hari[tanggal] = e
    # urutkan berdasarkan tanggal
    return [per_hari[t] for t in sorted(per_hari.keys())]


def susun_pesan(lokasi, entries):
    """Susun pesan ringkas + iconful untuk WAG, selalu menampilkan nilai cuaca aktual."""
    nama_lokasi = f"{lokasi.get('desa', '?')}, {lokasi.get('kotkab', '?')}"
    bahaya = [e for e in entries if e["alert_level"] == "bahaya"]
    waspada = [e for e in entries if e["alert_level"] == "waspada"]

    now = datetime.now(WIT).strftime("%d %b %Y")
    sekarang = entries[0] if entries else {}
    level_sekarang = sekarang.get("alert_level", "normal")
    tanggal_hari_ini, _, _ = _tanggal_jam(sekarang.get("local_datetime"))

    lines = [
        "🌅 *KURIK HEBAT, MERAUKE MEROKET JUARA!* 🔥",
        "",
        "⚠️ *PERINGATAN CUACA - TIM TEKNIK*",
        f"📍 {nama_lokasi} | 🗓️ {now}",
        "Sumber: BMKG Data Terbuka",
        "",
        f"{ikon_level(level_sekarang)} *Kondisi saat ini:*",
        format_entry(sekarang, tanggal_acuan=tanggal_hari_ini),
        "",
        "*Prakiraan 9 jam ke depan:*",
    ]

    for e in entries[1:4]:
        lines.append(format_entry(e, tanggal_acuan=tanggal_hari_ini))

    lines.append("")

    if bahaya:
        lines.append("🔴 *RISIKO TINGGI (titik paling parah per hari):*")
        for e in risiko_tertinggi_per_hari(bahaya):
            lines.append(f"- {format_entry(e, tanggal_acuan=None)}")
    elif waspada:
        lines.append("🟡 Kondisi waspada (angin/hujan terdeteksi di beberapa jam). Pantau berkala.")
    else:
        lines.append("🟢 Tidak ada risiko signifikan terdeteksi untuk periode ini.")

    lines.append("")
    lines.append("🦺 *Pesan Keselamatan:* Utamakan K3 — gunakan APD lengkap, waspada jalur licin "
                  "dan instalasi bertegangan saat cuaca buruk, dan segera laporkan kondisi tidak "
                  "aman ke pengawas lapangan.")
    lines.append("")
    lines.append("_Pesan otomatis - bukan pengganti pemantauan langsung di lapangan._")
    return "\n".join(lines)


def kirim_ke_wag(pesan):
    """Kirim pesan ke WhatsApp Group lewat Fonnte."""
    headers = {"Authorization": FONNTE_TOKEN}
    payload = {"target": WAG_TARGET, "message": pesan}
    resp = requests.post(FONNTE_URL, headers=headers, data=payload, timeout=20)
    resp.raise_for_status()
    return resp.json()


def main():
    if not FONNTE_TOKEN or not WAG_TARGET:
        print("FONNTE_TOKEN atau WAG_TARGET belum diset sebagai secret/environment variable.")
        sys.exit(1)

    lokasi, entries = ambil_data_cuaca()
    entries = evaluasi_risiko(entries)
    pesan = susun_pesan(lokasi, entries)
    print("--- Pesan yang dikirim ---")
    print(pesan)
    print("--------------------------")

    hasil = kirim_ke_wag(pesan)
    print("Hasil kirim Fonnte:", hasil)

    if isinstance(hasil, dict) and hasil.get("status") is False:
        print("Fonnte melaporkan gagal kirim.")
        sys.exit(1)


if __name__ == "__main__":
    main()
